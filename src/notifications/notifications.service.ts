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
import { StorageService } from '../storage/storage.service';

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
    private readonly storageService: StorageService,
  ) {
    const firebaseApp = this.initializeFirebaseAdmin();
    this.messaging = firebaseApp ? getMessaging(firebaseApp) : null;
    this.appUrl =
      this.configService.get<string>('FRONTEND_APP_URL') ??
      'http://localhost:3999';
  }

  async listForUser(userId: number, organizationId: number, page: number, limit: number) {
    const [{ notifications, total }, unreadCount, org] = await Promise.all([
      this.prisma.userNotification.listForUser({ userId, page, limit }),
      this.prisma.userNotification.countUnreadForUser({ userId }),
      this.prisma.organizationMaster.findById({ where: { id: organizationId } }),
    ]);

    const provider = org?.fileUpload ?? 'SERVER_STORAGE';

    const notificationsWithPics = await Promise.all(
      notifications.map(async (n) => {
        if (!n.senderProfilePicKey) {
          return { ...n, senderProfilePicUrl: null };
        }
        const url = await this.storageService.getAccessibleUrl(n.senderProfilePicKey, provider);
        return { ...n, senderProfilePicUrl: url };
      }),
    );

    return {
      data: notificationsWithPics,
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
    const isGroup = conversationType === 'GROUP';
    const title = isGroup
      ? conversationName || 'New group message'
      : message.senderName;
    const body = this.buildMessageBody(message, conversationType);
    const link = `${this.appUrl}/?chat=${encodeURIComponent(message.conversationUuid)}`;

    const dataPayload: Record<string, string> = {
      type: isGroup ? 'group_message' : 'chat_message',
      chatType: isGroup ? 'group' : 'direct',
      conversationId: message.conversationUuid,
      messageId: message.uuid,
      senderId: String(message.senderId),
      senderName: message.senderName,
    };

    if (isGroup) {
      dataPayload.groupId = message.conversationUuid;
      if (conversationName) {
        dataPayload.conversationName = conversationName;
      }
    }

    await this.sendPushToUsers(recipientUserIds, {
      title,
      body,
      link,
      data: dataPayload,
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
        type: 'group_message',
        chatType: 'group',
        conversationId: message.conversationUuid,
        groupId: message.conversationUuid,
        messageId: message.uuid,
        senderId: String(message.senderId),
        senderName: message.senderName,
        conversationName,
        isMention: 'true',
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
    if (!this.messaging) {
      console.warn(
        '⚠️ [FCM BACKEND WARNING] Firebase Messaging is NOT initialized! Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in backend .env file.',
      );
      return;
    }

    if (userIds.length === 0) {
      console.log('[FCM BACKEND] No recipient user IDs provided for push notification.');
      return;
    }

    try {
      const dbTokens = await this.prisma.userPushToken.findTokensByUserIds({
        userIds,
      });

      if (dbTokens.length === 0) {
        console.warn(
          `⚠️ [FCM BACKEND WARNING] No FCM Push Tokens found in DB for user IDs: [${userIds.join(
            ', ',
          )}]. Ensure the mobile app has logged in and registered push tokens via POST /users/push-tokens.`,
        );
        return;
      }

      // Deduplicate tokens
      const uniqueTokens = [...new Set(dbTokens.map((item) => item.token))];

      console.log(
        `🚀 [FCM BACKEND] Sending FCM Push Notification to ${uniqueTokens.length} unique token(s) for user IDs: [${userIds.join(
          ', ',
        )}]`,
      );
      console.log(`   Title: "${payload.title}" | Body: "${payload.body}"`);

      // FCM Multicast limit is 500 tokens per request. Chunk tokens into batches of 500.
      const BATCH_SIZE = 500;
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
        chunks.push(uniqueTokens.slice(i, i + BATCH_SIZE));
      }

      const invalidTokensToCleanup: string[] = [];

      for (const tokenChunk of chunks) {
        const multicastPayload: MulticastMessage = {
          tokens: tokenChunk,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            ...payload.data,
            title: payload.title,
            body: payload.body,
            categoryId: 'message',
            category: 'message',
            _category: 'message',
            categoryIdentifier: 'message',
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'messages',
              title: payload.title,
              body: payload.body,
              sound: 'default',
              priority: 'high',
              clickAction: 'message',
              tag: 'message',
              defaultVibrateTimings: true,
              defaultLightSettings: true,
              visibility: 'public',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: payload.title,
                  body: payload.body,
                },
                category: 'message',
                sound: 'default',
                badge: 1,
              },
            },
          },
          webpush: {
            fcmOptions: {
              link: payload.link,
            },
          },
        };

        const response = await this.messaging.sendEachForMulticast(
          multicastPayload,
        );

        console.log(
          `✅ [FCM BACKEND SUCCESS] Multicast batch result: ${response.successCount} succeeded, ${response.failureCount} failed.`,
        );

        response.responses.forEach((result, index) => {
          if (!result.success) {
            const code = result.error?.code;
            console.warn(
              `❌ [FCM BACKEND ERROR] Token [${tokenChunk[index]?.slice(
                0,
                20,
              )}...] failed: ${result.error?.message} (code: ${code})`,
            );

            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              const badToken = tokenChunk[index];
              if (badToken) {
                invalidTokensToCleanup.push(badToken);
              }
            }
          }
        });
      }

      if (invalidTokensToCleanup.length > 0) {
        const uniqueBadTokens = [...new Set(invalidTokensToCleanup)];
        await this.prisma.userPushToken.deleteManyByTokens({
          tokens: uniqueBadTokens,
        });
        console.log(
          `🧹 [FCM BACKEND] Cleaned up ${uniqueBadTokens.length} expired/invalid FCM tokens from DB.`,
        );
      }
    } catch (error) {
      console.error('❌ [FCM BACKEND FATAL ERROR] Failed to send push notification:', error);
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
