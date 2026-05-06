import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import {
  getMessaging,
  type Messaging,
  type MulticastMessage,
} from 'firebase-admin/messaging';
import type {
  DirectMessageRecord,
  UserNotificationRecord,
} from '../prisma/prisma.service';
import { PrismaService } from '../prisma/prisma.service';

type ChatPushArgs = {
  recipientUserIds: number[];
  message: DirectMessageRecord;
  conversationType: 'DIRECT' | 'GROUP';
  conversationName?: string;
};

type MentionNotificationArgs = {
  recipientUserIds: number[];
  message: DirectMessageRecord;
  messageId: number;
  conversationId: number;
  conversationName: string;
};

@Injectable()
export class NotificationsService {
  private readonly messaging: Messaging | null;
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const firebaseApp = this.initializeFirebaseAdmin();
    this.messaging = firebaseApp ? getMessaging(firebaseApp) : null;
    this.appUrl =
      this.configService.get<string>('FRONTEND_APP_URL') ??
      'http://localhost:3999';
  }

  async listForUser(userId: number, page: number, limit: number) {
    const [{ notifications, total }, unreadCount] = await Promise.all([
      this.prisma.userNotification.listForUser({ userId, page, limit }),
      this.prisma.userNotification.countUnreadForUser({ userId }),
    ]);

    return {
      data: notifications,
      total,
      page,
      limit,
      unreadCount,
    };
  }

  async getUnreadCount(userId: number) {
    const unreadCount = await this.prisma.userNotification.countUnreadForUser({
      userId,
    });

    return { unreadCount };
  }

  async markRead(userId: number, notificationUuid: string) {
    await this.prisma.userNotification.markRead({
      userId,
      notificationUuid,
    });

    return { message: 'Notification marked as read' };
  }

  async markAllRead(userId: number) {
    await this.prisma.userNotification.markAllRead({ userId });
    return { message: 'All notifications marked as read' };
  }

  async createMentionNotifications({
    recipientUserIds,
    message,
    messageId,
    conversationId,
    conversationName,
  }: MentionNotificationArgs): Promise<UserNotificationRecord[]> {
    const uniqueRecipientIds = [...new Set(recipientUserIds)].filter(
      (userId) => userId !== message.senderId,
    );

    if (uniqueRecipientIds.length === 0) {
      return [];
    }

    const preview =
      message.content?.trim() ||
      (message.type === 'IMAGE'
        ? 'Sent an image'
        : message.type === 'FILE'
          ? 'Sent a file'
          : 'New mention');

    return this.prisma.userNotification.createMentions({
      userIds: uniqueRecipientIds,
      conversationId,
      messageId,
      title: `${message.senderName} mentioned you`,
      body: `${conversationName}: ${preview.slice(0, 160)}`,
      metadata: {
        conversationUuid: message.conversationUuid,
        messageUuid: message.uuid,
        senderId: message.senderId,
        senderName: message.senderName,
        conversationName,
      },
    });
  }

  async sendChatMessageNotification({
    recipientUserIds,
    message,
    conversationType,
    conversationName,
  }: ChatPushArgs): Promise<void> {
    const title =
      conversationType === 'GROUP'
        ? conversationName || 'New group message'
        : message.senderName;
    const body = this.buildMessageBody(message, conversationType);
    const link = `${this.appUrl}/?chat=${encodeURIComponent(message.conversationUuid)}`;

    await this.sendPushToUsers(recipientUserIds, {
      title,
      body,
      link,
      data: {
        conversationType,
        conversationUuid: message.conversationUuid,
        senderId: String(message.senderId),
        senderName: message.senderName,
      },
    });
  }

  async sendMentionPushNotification(
    recipientUserIds: number[],
    message: DirectMessageRecord,
    conversationName: string,
  ): Promise<void> {
    const body =
      message.content?.trim()?.slice(0, 160) ||
      this.buildMessageBody(message, 'GROUP');

    await this.sendPushToUsers(recipientUserIds, {
      title: `${message.senderName} mentioned you`,
      body: `${conversationName}: ${body}`,
      link: `${this.appUrl}/?chat=${encodeURIComponent(message.conversationUuid)}`,
      data: {
        conversationType: 'GROUP',
        conversationUuid: message.conversationUuid,
        senderId: String(message.senderId),
        senderName: message.senderName,
      },
    });
  }

  private async sendPushToUsers(
    userIds: number[],
    payload: {
      title: string;
      body: string;
      link: string;
      data: Record<string, string>;
    },
  ): Promise<void> {
    if (!this.messaging || userIds.length === 0) {
      return;
    }

    try {
      const tokens = await this.prisma.userPushToken.findTokensByUserIds({
        userIds,
      });

      if (tokens.length === 0) {
        return;
      }

      const multicastPayload: MulticastMessage = {
        tokens: tokens.map((item) => item.token),
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        webpush: {
          fcmOptions: {
            link: payload.link,
          },
        },
      };

      const response = await this.messaging.sendEachForMulticast(
        multicastPayload,
      );
      const invalidTokens = response.responses.flatMap((result, index) => {
        if (result.success) {
          return [];
        }

        const code = result.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          return [multicastPayload.tokens[index] as string];
        }

        return [];
      });

      if (invalidTokens.length > 0) {
        await this.prisma.userPushToken.deleteManyByTokens({
          tokens: invalidTokens,
        });
      }
    } catch (error) {
      console.error('Failed to send push notification', error);
    }
  }

  private buildMessageBody(
    message: DirectMessageRecord,
    conversationType: 'DIRECT' | 'GROUP',
  ): string {
    const preview = message.content?.trim();

    if (preview) {
      return conversationType === 'GROUP'
        ? `${message.senderName}: ${preview.slice(0, 140)}`
        : preview.slice(0, 140);
    }

    switch (message.type) {
      case 'IMAGE':
        return conversationType === 'GROUP'
          ? `${message.senderName} sent an image`
          : 'Sent an image';
      case 'FILE':
        return conversationType === 'GROUP'
          ? `${message.senderName} sent a file`
          : 'Sent a file';
      case 'AUDIO':
        return conversationType === 'GROUP'
          ? `${message.senderName} sent an audio message`
          : 'Sent an audio message';
      case 'VIDEO':
        return conversationType === 'GROUP'
          ? `${message.senderName} sent a video`
          : 'Sent a video';
      default:
        return conversationType === 'GROUP'
          ? `${message.senderName} sent a message`
          : 'New message';
    }
  }

  private initializeFirebaseAdmin(): App | null {
    if (getApps().length > 0) {
      return getApp();
    }

    const serviceAccountJson =
      this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson) as {
        projectId: string;
        clientEmail: string;
        privateKey: string;
      };

      return initializeApp({
        credential: cert({
          projectId: parsed.projectId,
          clientEmail: parsed.clientEmail,
          privateKey: parsed.privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }
}
