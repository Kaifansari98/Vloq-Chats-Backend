import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import {
  PrismaService,
  type DirectConversationSummaryRecord,
  type GroupConversationSummaryRecord,
  type DirectMessageRecord,
  type MessageAttachmentRecord,
  type UploadResourceType,
  type UserMasterRecord,
} from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ChatsGateway } from './chats.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateDirectChatDto } from './dto/create-direct-chat.schema';
import type { CreateDirectMessageDto } from './dto/create-direct-message.schema';
import type { CreateGroupChatDto } from './dto/create-group-chat.schema';
import type { CreateGroupMessageDto } from './dto/create-group-message.schema';
import type { UploadGroupMessageDto } from './dto/upload-group-message.schema';
import type { MarkDirectChatReadDto } from './dto/mark-direct-chat-read.schema';
import type { UploadDirectMessageDto } from './dto/upload-direct-message.schema';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type DirectChatsResponse = {
  data: (DirectConversationSummaryRecord | GroupConversationSummaryRecord)[];
  total: number;
  page: number;
  limit: number;
};

type DirectChatResponse = {
  message: string;
  data: DirectConversationSummaryRecord;
};

type DirectMessagesResponse = {
  data: DirectMessageRecord[];
};

type DirectMessageResponse = {
  message: string;
  data: DirectMessageRecord;
};

type MarkDirectChatReadResponse = {
  message: string;
};

type DirectAttachmentDownloadResponse = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  body: Readable;
};

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatsGateway: ChatsGateway,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listDirectChats(
    user: UserMasterRecord,
    page: number,
    limit: number,
    search?: string,
    filter: 'ALL' | 'UNREAD' | 'GROUPS' = 'ALL',
  ): Promise<DirectChatsResponse> {
    const { conversations, total } =
      await this.prisma.conversation.findDirectConversationsForUser({
        userId: user.id,
        organizationId: user.organizationId,
        page,
        limit,
        search,
        filter,
      });

    return { data: conversations, total, page, limit };
  }

  async createOrGetDirectChat(
    user: UserMasterRecord,
    data: CreateDirectChatDto,
  ): Promise<DirectChatResponse> {
    if (data.participantUserId === user.id) {
      throw new BadRequestException(
        'You cannot create a direct chat with yourself',
      );
    }

    const participant = await this.ensureDirectParticipant(
      user,
      data.participantUserId,
    );

    const conversation =
      await this.prisma.conversation.createOrGetDirectConversation({
        organizationId: user.organizationId,
        currentUserId: user.id,
        participantUserId: participant.id,
      });

    return {
      message: 'Direct chat ready',
      data: conversation,
    };
  }

  async listDirectMessages(
    user: UserMasterRecord,
    participantUserId: number,
  ): Promise<DirectMessagesResponse> {
    if (participantUserId === user.id) {
      throw new BadRequestException(
        'You cannot open a direct chat with yourself',
      );
    }

    await this.ensureDirectParticipant(user, participantUserId);

    const messages = await this.prisma.message.findDirectMessages({
      organizationId: user.organizationId,
      currentUserId: user.id,
      participantUserId,
    });

    const provider = await this.getOrganizationUploadProvider(
      user.organizationId,
    );

    return { data: await this.enrichWithAccessUrls(messages, provider) };
  }

  async createDirectMessage(
    user: UserMasterRecord,
    data: CreateDirectMessageDto,
  ): Promise<DirectMessageResponse> {
    if (data.participantUserId === user.id) {
      throw new BadRequestException('You cannot send a message to yourself');
    }

    await this.ensureDirectParticipant(user, data.participantUserId);

    const message = await this.prisma.message.createDirectMessage({
      organizationId: user.organizationId,
      currentUserId: user.id,
      participantUserId: data.participantUserId,
      content: data.content.trim(),
    });

    // Text messages have no attachments — no enrichment needed
    this.chatsGateway.emitDirectMessage(message, data.participantUserId);
    this.notifyOfflineUsers([data.participantUserId], message, 'DIRECT');

    return {
      message: 'Message sent successfully',
      data: message,
    };
  }

  async uploadDirectMessage(
    user: UserMasterRecord,
    data: UploadDirectMessageDto,
    files: UploadFile[],
  ): Promise<DirectMessageResponse> {
    if (data.participantUserId === user.id) {
      throw new BadRequestException('You cannot send a message to yourself');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 files allowed per message');
    }

    const maxMb = Math.round(this.storageService.maxFileSize / (1024 * 1024));

    for (const file of files) {
      if (!this.storageService.isAllowedMimeType(file.mimetype)) {
        throw new BadRequestException(
          `File type "${file.mimetype}" is not allowed`,
        );
      }
      if (file.size > this.storageService.maxFileSize) {
        throw new BadRequestException(
          `"${file.originalname}" exceeds the ${maxMb} MB size limit`,
        );
      }
    }

    await this.ensureDirectParticipant(user, data.participantUserId);

    // Wasabi folder: direct/{min}_{max} — matches the directKey convention
    const [a, b] = [user.id, data.participantUserId].sort((x, y) => x - y);
    const folder = `direct/${a}_${b}`;
    const provider = await this.getOrganizationUploadProvider(
      user.organizationId,
    );

    const uploaded = await Promise.all(
      files.map((f) => this.storageService.uploadFile(f, folder, provider)),
    );

    const allImages = files.every((f) =>
      this.storageService.isImageMimeType(f.mimetype),
    );
    const messageType = allImages ? 'IMAGE' : 'FILE';

    const attachmentInputs = uploaded.map((uf, i) => ({
      uuid: randomUUID(),
      // files and uploaded have identical length — index is always valid
      attachmentType: this.storageService.isImageMimeType(files[i].mimetype)
        ? ('IMAGE' as const)
        : ('DOCUMENT' as const),
      name: uf.originalName,
      key: uf.key,
      mimeType: uf.mimeType,
      sizeBytes: uf.sizeBytes,
    }));

    const message = await this.prisma.message.createDirectMessage({
      organizationId: user.organizationId,
      currentUserId: user.id,
      participantUserId: data.participantUserId,
      content: data.content?.trim() || null,
      messageType,
      attachments: attachmentInputs,
    });

    const [enriched] = await this.enrichWithAccessUrls([message], provider);

    this.chatsGateway.emitDirectMessage(enriched, data.participantUserId);
    this.notifyOfflineUsers([data.participantUserId], enriched, 'DIRECT');

    return {
      message: 'Message sent successfully',
      data: enriched,
    };
  }

  async markDirectChatRead(
    user: UserMasterRecord,
    data: MarkDirectChatReadDto,
  ): Promise<MarkDirectChatReadResponse> {
    if (data.participantUserId === user.id) {
      throw new BadRequestException('You cannot mark your own chat as read');
    }

    await this.ensureDirectParticipant(user, data.participantUserId);

    const readAt = new Date();

    await this.prisma.message.markDirectChatRead({
      organizationId: user.organizationId,
      currentUserId: user.id,
      participantUserId: data.participantUserId,
    });

    this.chatsGateway.emitDirectMessageRead(
      user.id,
      data.participantUserId,
      readAt,
    );

    return {
      message: 'Direct chat marked as read',
    };
  }

  async downloadDirectAttachment(
    user: UserMasterRecord,
    attachmentUuid: string,
  ): Promise<DirectAttachmentDownloadResponse> {
    const attachment = await this.prisma.message.findDirectAttachmentForUser({
      organizationId: user.organizationId,
      currentUserId: user.id,
      attachmentUuid,
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const provider = await this.getOrganizationUploadProvider(
      user.organizationId,
    );
    const file = await this.storageService.downloadFile(
      attachment.url,
      provider,
    );

    return {
      fileName: attachment.name,
      mimeType:
        attachment.mimeType || file.contentType || 'application/octet-stream',
      sizeBytes: attachment.sizeBytes || file.contentLength,
      body: file.body,
    };
  }

  private async enrichWithAccessUrls(
    messages: DirectMessageRecord[],
    provider: UploadResourceType,
  ): Promise<DirectMessageRecord[]> {
    return Promise.all(
      messages.map(async (msg): Promise<DirectMessageRecord> => {
        // attachments flows through any-heavy prisma internals; cast is correct at runtime
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const atts = msg.attachments as MessageAttachmentRecord[];
        if (atts.length === 0) return msg;
        const enrichedAtts: MessageAttachmentRecord[] = await Promise.all(
          atts.map(
            async (
              att: MessageAttachmentRecord,
            ): Promise<MessageAttachmentRecord> => ({
              ...att,
              url: await this.storageService.getAccessibleUrl(
                att.url as string,
                provider,
              ),
            }),
          ),
        );
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return { ...msg, attachments: enrichedAtts };
      }),
    );
  }

  async listGroupMessages(
    user: UserMasterRecord,
    conversationUuid: string,
  ): Promise<DirectMessagesResponse> {
    const messages = await this.prisma.message.findGroupMessages({
      conversationUuid,
      currentUserId: user.id,
      organizationId: user.organizationId,
    });

    const provider = await this.getOrganizationUploadProvider(
      user.organizationId,
    );

    return { data: await this.enrichWithAccessUrls(messages, provider) };
  }

  async sendGroupMessage(
    user: UserMasterRecord,
    conversationUuid: string,
    data: CreateGroupMessageDto,
  ): Promise<DirectMessageResponse> {
    const {
      message,
      participantIds,
      mentionRecipientIds,
      conversationName,
      messageId,
    } = await this.prisma.message.createGroupMessage({
      conversationUuid,
      currentUserId: user.id,
      organizationId: user.organizationId,
      content: data.content.trim(),
      mentions: data.mentions ?? [],
    });

    this.chatsGateway.emitGroupMessage(message, participantIds);
    await this.createMentionNotifications(
      mentionRecipientIds,
      message,
      messageId,
      conversationName,
    );
    this.notifyOfflineUsers(
      participantIds.filter((id) => !mentionRecipientIds.includes(id)),
      message,
      'GROUP',
      conversationName,
    );
    this.notifyMentionedOfflineUsers(
      mentionRecipientIds,
      message,
      conversationName,
    );

    return { message: 'Message sent successfully', data: message };
  }

  async uploadGroupMessage(
    user: UserMasterRecord,
    conversationUuid: string,
    data: UploadGroupMessageDto,
    files: UploadFile[],
  ): Promise<DirectMessageResponse> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 files allowed per message');
    }

    const maxMb = Math.round(this.storageService.maxFileSize / (1024 * 1024));

    for (const file of files) {
      if (!this.storageService.isAllowedMimeType(file.mimetype)) {
        throw new BadRequestException(
          `File type "${file.mimetype}" is not allowed`,
        );
      }
      if (file.size > this.storageService.maxFileSize) {
        throw new BadRequestException(
          `"${file.originalname}" exceeds the ${maxMb} MB size limit`,
        );
      }
    }

    const folder = `group/${conversationUuid}`;
    const provider = await this.getOrganizationUploadProvider(
      user.organizationId,
    );
    const uploaded = await Promise.all(
      files.map((f) => this.storageService.uploadFile(f, folder, provider)),
    );

    const allImages = files.every((f) =>
      this.storageService.isImageMimeType(f.mimetype),
    );
    const messageType = allImages ? 'IMAGE' : 'FILE';

    const attachmentInputs = uploaded.map((uf, i) => ({
      uuid: randomUUID(),
      attachmentType: this.storageService.isImageMimeType(files[i].mimetype)
        ? ('IMAGE' as const)
        : ('DOCUMENT' as const),
      name: uf.originalName,
      key: uf.key,
      mimeType: uf.mimeType,
      sizeBytes: uf.sizeBytes,
    }));

    const {
      message,
      participantIds,
      mentionRecipientIds,
      conversationName,
      messageId,
    } = await this.prisma.message.createGroupMessage({
      conversationUuid,
      currentUserId: user.id,
      organizationId: user.organizationId,
      content: data.content?.trim() || null,
      messageType,
      attachments: attachmentInputs,
      mentions: data.mentions ?? [],
    });

    const [enriched] = await this.enrichWithAccessUrls([message], provider);
    this.chatsGateway.emitGroupMessage(enriched, participantIds);
    await this.createMentionNotifications(
      mentionRecipientIds,
      enriched,
      messageId,
      conversationName,
    );
    this.notifyOfflineUsers(
      participantIds.filter((id) => !mentionRecipientIds.includes(id)),
      enriched,
      'GROUP',
      conversationName,
    );
    this.notifyMentionedOfflineUsers(
      mentionRecipientIds,
      enriched,
      conversationName,
    );

    return { message: 'Message sent successfully', data: enriched };
  }

  async createGroupChat(
    user: UserMasterRecord,
    data: CreateGroupChatDto,
  ): Promise<{ message: string; data: GroupConversationSummaryRecord }> {
    const uniqueMemberIds = [
      ...new Set(data.memberIds.filter((id) => id !== user.id)),
    ];

    if (uniqueMemberIds.length === 0) {
      throw new BadRequestException('At least one other member is required');
    }

    for (const memberId of uniqueMemberIds) {
      await this.ensureDirectParticipant(user, memberId);
    }

    const group = await this.prisma.conversation.createGroupConversation({
      organizationId: user.organizationId,
      creatorId: user.id,
      name: data.name.trim(),
      memberIds: uniqueMemberIds,
    });

    this.chatsGateway.emitGroupCreated(
      group.participants.map((p) => p.id),
      group.uuid,
    );

    return { message: 'Group created successfully', data: group };
  }

  private async ensureDirectParticipant(
    user: UserMasterRecord,
    participantUserId: number,
  ): Promise<UserMasterRecord> {
    const participant = await this.prisma.userMaster.findUnique({
      where: { id: participantUserId },
    });

    if (
      !participant ||
      participant.organizationId !== user.organizationId ||
      participant.isDeleted ||
      !participant.isActive
    ) {
      throw new NotFoundException('Participant not found in your organization');
    }

    return participant;
  }

  private async getOrganizationUploadProvider(
    organizationId: number,
  ): Promise<UploadResourceType> {
    const organization = await this.prisma.organizationMaster.findById({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization.fileUpload ?? 'SERVER_STORAGE';
  }

  private notifyOfflineUsers(
    participantIds: number[],
    message: DirectMessageRecord,
    conversationType: 'DIRECT' | 'GROUP',
    conversationName?: string,
  ) {
    const offlineUserIds = [...new Set(participantIds)].filter(
      (userId) =>
        userId !== message.senderId && !this.chatsGateway.isUserOnline(userId),
    );

    if (offlineUserIds.length === 0) {
      return;
    }

    void this.notificationsService.sendChatMessageNotification({
      recipientUserIds: offlineUserIds,
      message,
      conversationType,
      conversationName,
    });
  }

  private notifyMentionedOfflineUsers(
    participantIds: number[],
    message: DirectMessageRecord,
    conversationName: string,
  ) {
    const offlineUserIds = [...new Set(participantIds)].filter(
      (userId) =>
        userId !== message.senderId && !this.chatsGateway.isUserOnline(userId),
    );

    if (offlineUserIds.length === 0) {
      return;
    }

    void this.notificationsService.sendMentionPushNotification(
      offlineUserIds,
      message,
      conversationName,
    );
  }

  private async createMentionNotifications(
    recipientUserIds: number[],
    message: DirectMessageRecord,
    messageId: number,
    conversationName: string,
  ) {
    if (typeof message.conversationId !== 'number') {
      return;
    }

    const notifications =
      await this.notificationsService.createMentionNotifications({
        recipientUserIds,
        message,
        messageId,
        conversationId: message.conversationId,
        conversationName,
      });

    notifications.forEach((notification) => {
      const mentionedUserId = notification.metadata?.mentionedUserId;
      if (typeof mentionedUserId === 'number') {
        this.chatsGateway.emitNotification(mentionedUserId, notification);
      }
    });
  }
}
