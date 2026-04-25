import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  type DirectConversationSummaryRecord,
  type DirectMessageRecord,
  type UserMasterRecord,
} from '../prisma/prisma.service';
import { ChatsGateway } from './chats.gateway';
import type { CreateDirectChatDto } from './dto/create-direct-chat.schema';
import type { CreateDirectMessageDto } from './dto/create-direct-message.schema';
import type { MarkDirectChatReadDto } from './dto/mark-direct-chat-read.schema';

type DirectChatsResponse = {
  data: DirectConversationSummaryRecord[];
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

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatsGateway: ChatsGateway,
  ) {}

  async listDirectChats(
    user: UserMasterRecord,
    page: number,
    limit: number,
    search?: string,
  ): Promise<DirectChatsResponse> {
    const { conversations, total } =
      await this.prisma.conversation.findDirectConversationsForUser({
        userId: user.id,
        organizationId: user.organizationId,
        page,
        limit,
        search,
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

    return { data: messages };
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

    this.chatsGateway.emitDirectMessage(message, data.participantUserId);

    return {
      message: 'Message sent successfully',
      data: message,
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

    await this.prisma.message.markDirectChatRead({
      organizationId: user.organizationId,
      currentUserId: user.id,
      participantUserId: data.participantUserId,
    });

    this.chatsGateway.emitDirectMessageRead(user.id, data.participantUserId);

    return {
      message: 'Direct chat marked as read',
    };
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
}
