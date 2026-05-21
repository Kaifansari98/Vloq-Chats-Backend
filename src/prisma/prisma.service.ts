/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'crypto';

type UserAuthProviderRecord = {
  id: number;
  uuid: string;
  userId: number;
  provider: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  email: string | null;
  countryCode: string | null;
  logo: string | null;
  status: string;
  isActive: boolean;
  fileUpload: UploadResourceType;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadResourceType = 'WASABI_S3' | 'SERVER_STORAGE';

export type UserTypeMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
};

type ConversationRecord = {
  id: number;
  uuid: string;
  type: 'DIRECT' | 'GROUP';
  organizationId: number;
  name: string | null;
  description: string | null;
  avatar: string | null;
  directKey: string | null;
  isActive: boolean;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
};

export type DirectConversationSummaryRecord = {
  uuid: string;
  type: 'DIRECT';
  createdAt: Date;
  updatedAt: Date;
  unreadCount: number;
  otherParticipant: {
    id: number;
    uuid: string;
    name: string;
    email: string;
    profile_pic_url: string | null;
  };
  lastMessage: {
    uuid: string;
    content: string | null;
    type: string;
    createdAt: Date;
  } | null;
};

export type GroupConversationSummaryRecord = {
  uuid: string;
  type: 'GROUP';
  name: string;
  createdAt: Date;
  updatedAt: Date;
  unreadCount: number;
  participants: Array<{
    id: number;
    uuid: string;
    name: string;
    email: string;
    profile_pic_url: string | null;
  }>;
  lastMessage: {
    uuid: string;
    content: string | null;
    type: string;
    createdAt: Date;
  } | null;
};

export type MessageAttachmentRecord = {
  uuid: string;
  attachmentType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER';
  name: string;
  url: string; // Storage key — replaced with an access URL by ChatsService before serving
  mimeType: string;
  sizeBytes: number;
};

export type DirectAttachmentAccessRecord = {
  uuid: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

export type DirectMessageRecord = {
  uuid: string;
  conversationId?: number;
  conversationUuid: string;
  senderId: number;
  senderUuid: string;
  senderName: string;
  content: string | null;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  isOwnMessage: boolean;
  status: 'sent' | 'read';
  readAt: Date | null;
  attachments: MessageAttachmentRecord[];
  replyTo?: {
    uuid: string;
    senderName: string;
    content: string | null;
    attachmentType: string | null;
  } | null;
};

export type UserNotificationRecord = {
  uuid: string;
  type: 'CHAT_MENTION';
  title: string;
  body: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  conversationUuid: string | null;
  messageUuid: string | null;
  metadata: Record<string, unknown> | null;
};

export type UserMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  email: string;
  password: string | null;
  isActive: boolean;
  profile_pic: string | null;
  organizationId: number;
  userTypeId: number;
  createdById: number | null;
  updatedById: number | null;
  deletedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
  authProviders?: UserAuthProviderRecord[];
};

type UserPushTokenRecord = {
  id: number;
  uuid: string;
  userId: number;
  token: string;
  platform: string;
  userAgent: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type FindUniqueArgs = {
  where: {
    id: number;
  };
  include?: {
    authProviders?: boolean;
  };
};

type FindFirstArgs = {
  where: {
    email: string;
    organizationId?: number;
    isDeleted?: boolean;
  };
  include?: {
    authProviders?: boolean;
  };
};

type FindManyByEmailArgs = {
  where: {
    email: string;
    isDeleted?: boolean;
  };
  include?: {
    authProviders?: boolean;
  };
};

type CreateArgs = {
  data: {
    name: string;
    email: string;
    password: string | null;
    organizationId: number;
    userTypeId: number;
    authProviders: {
      create: {
        provider: string;
        providerId: string;
      };
    };
  };
  include?: {
    authProviders?: boolean;
  };
};

type FindOrganizationUniqueArgs = {
  where: {
    slug: string;
  };
};

type FindOrganizationByIdArgs = {
  where: {
    id: number;
  };
};

type FindMembersPageArgs = {
  where: { organizationId: number };
  page: number;
  limit: number;
  search?: string;
};

type FindUserByUuidArgs = {
  where: { uuid: string; organizationId: number };
};

type UpdateUserArgs = {
  where: { uuid: string; organizationId: number };
  data: {
    name?: string;
    email?: string;
    userTypeId?: number;
    password?: string | null;
    isActive?: boolean;
  };
};

type SoftDeleteUserArgs = {
  where: { uuid: string; organizationId: number };
};

type UpdateProfilePicKeyArgs = {
  where: { id: number };
  key: string | null;
};

type CreateOrganizationArgs = {
  data: {
    name: string;
    slug: string;
    email: string;
  };
};

type FindUserTypeUniqueArgs = {
  where: {
    code: string;
  };
};

type FindUserTypeByIdArgs = {
  where: {
    id: number;
  };
};

type CreateAuthProviderArgs = {
  data: {
    userId: number;
    provider: string;
    providerId: string;
  };
};

type FindDirectConversationsForUserArgs = {
  userId: number;
  organizationId: number;
  page: number;
  limit: number;
  search?: string;
  filter?: 'ALL' | 'UNREAD' | 'GROUPS';
};

type FindGroupConversationsForUserArgs = {
  userId: number;
  organizationId: number;
  page: number;
  limit: number;
  search?: string;
  unreadOnly?: boolean;
};

type CreateGroupConversationArgs = {
  organizationId: number;
  creatorId: number;
  name: string;
  memberIds: number[];
};

type CreateOrGetDirectConversationArgs = {
  organizationId: number;
  currentUserId: number;
  participantUserId: number;
};

type FindDirectMessagesArgs = {
  organizationId: number;
  currentUserId: number;
  participantUserId: number;
};

type FindDirectAttachmentForUserArgs = {
  organizationId: number;
  currentUserId: number;
  attachmentUuid: string;
};

type DirectMessageAttachmentInput = {
  uuid: string;
  attachmentType: 'IMAGE' | 'DOCUMENT';
  name: string;
  key: string; // Wasabi key — stored in the url column of MessageAttachment
  mimeType: string;
  sizeBytes: number;
};

type CreateDirectMessageArgs = {
  organizationId: number;
  currentUserId: number;
  participantUserId: number;
  content: string | null;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  attachments?: DirectMessageAttachmentInput[];
  parentMessageUuid?: string;
};

type MarkDirectChatReadArgs = {
  organizationId: number;
  currentUserId: number;
  participantUserId: number;
};

type FindGroupMessagesArgs = {
  conversationUuid: string;
  currentUserId: number;
  organizationId: number;
};

type CreateGroupMessageArgs = {
  conversationUuid: string;
  currentUserId: number;
  organizationId: number;
  content: string | null;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  attachments?: DirectMessageAttachmentInput[];
  mentions?: Array<{
    mentionedUserId: number;
    offset: number;
    length: number;
  }>;
  parentMessageUuid?: string;
};

type UpsertUserPushTokenArgs = {
  data: {
    userId: number;
    token: string;
    platform: string;
    userAgent: string | null;
  };
};

type DeleteUserPushTokenArgs = {
  where: {
    userId: number;
    token: string;
  };
};

type FindPushTokensByUserIdsArgs = {
  userIds: number[];
};

type DeleteManyPushTokensArgs = {
  tokens: string[];
};

type CreateMentionNotificationsArgs = {
  userIds: number[];
  conversationId: number;
  messageId: number;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

type ListUserNotificationsArgs = {
  userId: number;
  page: number;
  limit: number;
};

type CountUnreadNotificationsArgs = {
  userId: number;
};

type MarkNotificationReadArgs = {
  userId: number;
  notificationUuid: string;
};

type MarkAllNotificationsReadArgs = {
  userId: number;
};

type MarkConversationNotificationsReadArgs = {
  userId: number;
  conversationUuid: string;
};

type DirectConversationRow = {
  conversation_uuid: string;
  conversation_type: 'DIRECT';
  conversation_created_at: Date;
  conversation_updated_at: Date;
  unread_count: string;
  other_user_id: number;
  other_user_uuid: string;
  other_user_name: string;
  other_user_email: string;
  other_user_profile_pic: string | null;
  last_message_uuid: string | null;
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_created_at: Date | null;
  total_count?: string;
};

type GroupConversationRow = {
  conversation_uuid: string;
  conversation_name: string | null;
  conversation_created_at: Date;
  conversation_updated_at: Date;
  unread_count: string;
  last_message_uuid: string | null;
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_created_at: Date | null;
  participants_json: Array<{ id: number; uuid: string; name: string; email: string; profile_pic: string | null }> | null;
  total_count?: string;
};

type AttachmentJsonRow = {
  uuid: string;
  type: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

type DirectMessageRow = {
  message_uuid: string;
  conversation_id?: number;
  conversation_uuid: string;
  sender_id: number;
  sender_uuid: string;
  sender_name: string;
  message_content: string | null;
  message_type: string;
  message_created_at: Date;
  message_updated_at: Date;
  is_own_message: boolean;
  message_status: string;
  message_read_at?: Date | null;
  message_attachments: AttachmentJsonRow[];
  parent_message_uuid: string | null;
  parent_sender_name: string | null;
  parent_message_content: string | null;
  parent_message_type: string | null;
};

type NotificationRow = {
  notification_uuid: string;
  notification_type: 'CHAT_MENTION';
  notification_title: string;
  notification_body: string;
  notification_is_read: boolean;
  notification_read_at: Date | null;
  notification_created_at: Date;
  conversation_uuid: string | null;
  message_uuid: string | null;
  notification_metadata: Record<string, unknown> | null;
  total_count?: string;
};

type TransactionClient = {
  organizationMaster: {
    create(args: CreateOrganizationArgs): Promise<OrganizationMasterRecord>;
  };
  userMaster: {
    create(args: {
      data: Omit<CreateArgs['data'], 'authProviders'>;
    }): Promise<UserMasterRecord>;
  };
  userAuthProvider: {
    create(args: CreateAuthProviderArgs): Promise<UserAuthProviderRecord>;
  };
};

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
    });
  }

  readonly userMaster = {
    findUnique: async (args: FindUniqueArgs) => this.findUniqueUser(args),
    findFirst: async (args: FindFirstArgs) => this.findFirstUser(args),
    findManyByEmail: async (args: FindManyByEmailArgs) =>
      this.findManyUsersByEmail(args),
    create: async (args: CreateArgs) => this.createUser(args),
    findMembersPage: async (args: FindMembersPageArgs) =>
      this.findMembersPage(args),
    findByUuid: async (args: FindUserByUuidArgs) =>
      this.findUserByUuid(args),
    update: async (args: UpdateUserArgs) => this.updateUserRecord(args),
    softDelete: async (args: SoftDeleteUserArgs) =>
      this.softDeleteUser(args),
    updateProfilePicKey: async (args: UpdateProfilePicKeyArgs) =>
      this.updateProfilePicKey(args),
  };

  readonly organizationMaster = {
    findUnique: async (args: FindOrganizationUniqueArgs) =>
      this.findUniqueOrganization(args),
    findById: async (args: FindOrganizationByIdArgs) =>
      this.findOrganizationById(args),
    create: async (args: CreateOrganizationArgs) =>
      this.createOrganization(args),
  };

  readonly userTypeMaster = {
    findUnique: async (args: FindUserTypeUniqueArgs) =>
      this.findUniqueUserType(args),
    findById: async (args: FindUserTypeByIdArgs) =>
      this.findUserTypeById(args),
  };

  readonly userAuthProvider = {
    create: async (args: CreateAuthProviderArgs) =>
      this.createUserAuthProvider(args),
  };

  readonly userPushToken = {
    upsertForUser: async (args: UpsertUserPushTokenArgs) =>
      this.upsertUserPushToken(args),
    deleteForUser: async (args: DeleteUserPushTokenArgs) =>
      this.deleteUserPushToken(args),
    findTokensByUserIds: async (args: FindPushTokensByUserIdsArgs) =>
      this.findPushTokensByUserIds(args),
    deleteManyByTokens: async (args: DeleteManyPushTokensArgs) =>
      this.deleteManyPushTokens(args),
  };

  readonly userNotification = {
    createMentions: async (args: CreateMentionNotificationsArgs) =>
      this.createMentionNotifications(args),
    listForUser: async (args: ListUserNotificationsArgs) =>
      this.listUserNotifications(args),
    countUnreadForUser: async (args: CountUnreadNotificationsArgs) =>
      this.countUnreadNotifications(args),
    markRead: async (args: MarkNotificationReadArgs) =>
      this.markNotificationRead(args),
    markAllRead: async (args: MarkAllNotificationsReadArgs) =>
      this.markAllNotificationsRead(args),
    markConversationRead: async (args: MarkConversationNotificationsReadArgs) =>
      this.markConversationNotificationsRead(args),
  };

  readonly conversation = {
    findDirectConversationsForUser: async (
      args: FindDirectConversationsForUserArgs,
    ) => this.findDirectConversationsForUser(args),
    createOrGetDirectConversation: async (
      args: CreateOrGetDirectConversationArgs,
    ) => this.createOrGetDirectConversation(args),
    createGroupConversation: async (
      args: CreateGroupConversationArgs,
    ) => this.createGroupConversation(args),
  };

  readonly message: {
    findDirectMessages(args: FindDirectMessagesArgs): Promise<DirectMessageRecord[]>;
    findDirectAttachmentForUser(
      args: FindDirectAttachmentForUserArgs,
    ): Promise<DirectAttachmentAccessRecord | null>;
    createDirectMessage(args: CreateDirectMessageArgs): Promise<DirectMessageRecord>;
    markDirectChatRead(args: MarkDirectChatReadArgs): Promise<void>;
    findGroupMessages(args: FindGroupMessagesArgs): Promise<DirectMessageRecord[]>;
    createGroupMessage(args: CreateGroupMessageArgs): Promise<{
      message: DirectMessageRecord;
      participantIds: number[];
      mentionRecipientIds: number[];
      conversationName: string;
      messageId: number;
    }>;
  } = {
    findDirectMessages: (args) => this.findDirectMessages(args),
    findDirectAttachmentForUser: (args) => this.findDirectAttachmentForUser(args),
    createDirectMessage: (args) => this.createDirectMessage(args),
    markDirectChatRead: (args) => this.markDirectChatRead(args),
    findGroupMessages: (args) => this.findGroupMessages(args),
    createGroupMessage: (args) => this.createGroupMessage(args),
  };

  async $transaction<T>(
    callback: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(this.createTransactionClient(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async findGroupTypingTargets({
    conversationUuid,
    currentUserId,
    organizationId,
  }: {
    conversationUuid: string;
    currentUserId: number;
    organizationId: number;
  }): Promise<{ senderName: string; participantIds: number[] } | null> {
    const result = await this.pool.query<{
      sender_name: string;
      participant_ids: number[];
    }>(
      `
        SELECT
          sender.name AS sender_name,
          ARRAY(
            SELECT cp2."userId"
            FROM "ConversationParticipant" cp2
            WHERE cp2."conversationId" = c.id
              AND cp2."isActive" = true
          ) AS participant_ids
        FROM "Conversation" c
        INNER JOIN "ConversationParticipant" cp
          ON cp."conversationId" = c.id
         AND cp."userId" = $1
         AND cp."isActive" = true
        INNER JOIN "UserMaster" sender
          ON sender.id = $1
        WHERE c.uuid = $2
          AND c.type = 'GROUP'
          AND c."isDeleted" = false
          AND c."organizationId" = $3
        LIMIT 1
      `,
      [currentUserId, conversationUuid, organizationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      senderName: row.sender_name,
      participantIds: row.participant_ids ?? [],
    };
  }

  async getOrgSettings(
    organizationId: number,
  ): Promise<{ isIpRestrictionEnabled: boolean }> {
    const result = await this.pool.query<{ isIpRestrictionEnabled: boolean }>(
      `SELECT "isIpRestrictionEnabled" FROM "OrganizationMaster" WHERE id = $1 LIMIT 1`,
      [organizationId],
    );
    return {
      isIpRestrictionEnabled: result.rows[0]?.isIpRestrictionEnabled ?? false,
    };
  }

  async updateOrgIpRestriction(
    organizationId: number,
    enabled: boolean,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE "OrganizationMaster"
       SET "isIpRestrictionEnabled" = $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [enabled, organizationId],
    );
  }

  async listAllowedIps(organizationId: number): Promise<
    Array<{
      id: number;
      uuid: string;
      ipAddress: string;
      label: string | null;
      createdAt: Date;
    }>
  > {
    const result = await this.pool.query<{
      id: number;
      uuid: string;
      ipAddress: string;
      label: string | null;
      createdAt: Date;
    }>(
      `SELECT id, uuid, "ipAddress", label, "createdAt"
       FROM "OrgRestrictedIpMapping"
       WHERE "organizationId" = $1
       ORDER BY "createdAt" ASC`,
      [organizationId],
    );
    return result.rows;
  }

  async addAllowedIp(
    organizationId: number,
    ipAddress: string,
    uuid: string,
    label?: string,
  ): Promise<{
    id: number;
    uuid: string;
    ipAddress: string;
    label: string | null;
    createdAt: Date;
  }> {
    const existing = await this.pool.query<{
      id: number;
      uuid: string;
      ipAddress: string;
      label: string | null;
      createdAt: Date;
    }>(
      `SELECT id, uuid, "ipAddress", label, "createdAt"
       FROM "OrgRestrictedIpMapping"
       WHERE "organizationId" = $1 AND "ipAddress" = $2
       LIMIT 1`,
      [organizationId, ipAddress],
    );
    if (existing.rows.length > 0) return existing.rows[0]!;

    const result = await this.pool.query<{
      id: number;
      uuid: string;
      ipAddress: string;
      label: string | null;
      createdAt: Date;
    }>(
      `INSERT INTO "OrgRestrictedIpMapping" (uuid, "organizationId", "ipAddress", label)
       VALUES ($1, $2, $3, $4)
       RETURNING id, uuid, "ipAddress", label, "createdAt"`,
      [uuid, organizationId, ipAddress, label ?? null],
    );
    return result.rows[0]!;
  }

  async removeAllowedIp(organizationId: number, ipUuid: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM "OrgRestrictedIpMapping"
       WHERE uuid = $1 AND "organizationId" = $2`,
      [ipUuid, organizationId],
    );
  }

  async removeAllAllowedIps(organizationId: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM "OrgRestrictedIpMapping" WHERE "organizationId" = $1`,
      [organizationId],
    );
  }

  async checkIpRestriction(
    organizationId: number,
    rawIp: string,
  ): Promise<boolean> {
    const ip = rawIp.replace(/^::ffff:/, '');
    console.log('[IP-CHECK] orgId=%d rawIp=%s normalizedIp=%s', organizationId, rawIp, ip);

    // Loopback traffic always originates from the same machine as the server → always allow
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return false;

    const orgResult = await this.pool.query<{ isIpRestrictionEnabled: boolean }>(
      `SELECT "isIpRestrictionEnabled" FROM "OrganizationMaster" WHERE id = $1 LIMIT 1`,
      [organizationId],
    );

    const org = orgResult.rows[0];
    console.log('[IP-CHECK] isIpRestrictionEnabled=%s', org?.isIpRestrictionEnabled);
    if (!org || !org.isIpRestrictionEnabled) return false;

    // Single query: total allowed IPs + whether this specific IP is in the list
    const result = await this.pool.query<{
      total_ips: string;
      ip_allowed: string;
    }>(
      `SELECT
         COUNT(*)                                    AS total_ips,
         COUNT(*) FILTER (WHERE "ipAddress" = $2)   AS ip_allowed
       FROM "OrgRestrictedIpMapping"
       WHERE "organizationId" = $1`,
      [organizationId, ip],
    );

    const row = result.rows[0];
    const totalIps = parseInt(row?.total_ips ?? '0', 10);
    const ipAllowed = parseInt(row?.ip_allowed ?? '0', 10);

    // No IPs configured yet → restriction flag is on but not active yet
    if (totalIps === 0) return false;

    // IPs are configured → block anyone not in the list
    return ipAllowed === 0;
  }

  private async findUniqueUser({
    where,
    include,
  }: FindUniqueArgs): Promise<UserMasterRecord | null> {
    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE id = $1
        LIMIT 1
      `,
      [where.id],
    );

    const user = result.rows[0] ?? null;

    if (!user) {
      return null;
    }

    return this.withIncludes(user, include);
  }

  private async findUserByUuid({
    where,
  }: FindUserByUuidArgs): Promise<UserMasterRecord | null> {
    const result = await this.pool.query<UserMasterRecord>(
      `SELECT * FROM "UserMaster"
       WHERE uuid = $1 AND "organizationId" = $2 AND "isDeleted" = false
       LIMIT 1`,
      [where.uuid, where.organizationId],
    );
    return result.rows[0] ?? null;
  }

  private async updateUserRecord({
    where,
    data,
  }: UpdateUserArgs): Promise<UserMasterRecord | null> {
    const setClauses: string[] = ['"updatedAt" = CURRENT_TIMESTAMP'];
    const values: (string | number | boolean | null)[] = [];

    if (data.name !== undefined) {
      values.push(data.name);
      setClauses.push(`name = $${values.length}`);
    }
    if (data.email !== undefined) {
      values.push(data.email.toLowerCase());
      setClauses.push(`email = $${values.length}`);
    }
    if (data.userTypeId !== undefined) {
      values.push(data.userTypeId);
      setClauses.push(`"userTypeId" = $${values.length}`);
    }
    if (data.password !== undefined && data.password !== null) {
      values.push(data.password);
      setClauses.push(`password = $${values.length}`);
    }
    if (data.isActive !== undefined) {
      values.push(data.isActive);
      setClauses.push(`"isActive" = $${values.length}`);
    }

    values.push(where.uuid);
    const uuidIdx = values.length;
    values.push(where.organizationId);
    const orgIdx = values.length;

    const result = await this.pool.query<UserMasterRecord>(
      `UPDATE "UserMaster"
       SET ${setClauses.join(', ')}
       WHERE uuid = $${uuidIdx} AND "organizationId" = $${orgIdx} AND "isDeleted" = false
       RETURNING *`,
      values,
    );

    if (data.email !== undefined && result.rows[0]) {
      await this.pool.query(
        `UPDATE "UserAuthProvider"
         SET "providerId" = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "userId" = $2 AND provider = 'EMAIL'`,
        [data.email.toLowerCase(), result.rows[0].id],
      );
    }

    return result.rows[0] ?? null;
  }

  private async softDeleteUser({
    where,
  }: SoftDeleteUserArgs): Promise<UserMasterRecord | null> {
    const result = await this.pool.query<UserMasterRecord>(
      `UPDATE "UserMaster"
       SET "isDeleted" = true, "deletedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
       WHERE uuid = $1 AND "organizationId" = $2 AND "isDeleted" = false
       RETURNING *`,
      [where.uuid, where.organizationId],
    );
    return result.rows[0] ?? null;
  }

  private async updateProfilePicKey({
    where,
    key,
  }: UpdateProfilePicKeyArgs): Promise<UserMasterRecord | null> {
    const result = await this.pool.query<UserMasterRecord>(
      `UPDATE "UserMaster"
       SET "profile_pic" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND "isDeleted" = false
       RETURNING *`,
      [key, where.id],
    );
    return result.rows[0] ?? null;
  }

  private async findMembersPage({
    where,
    page,
    limit,
    search,
  }: FindMembersPageArgs): Promise<{
    members: UserMasterRecord[];
    total: number;
  }> {
    const offset = (page - 1) * limit;
    type Row = UserMasterRecord & { total_count: string };
    const values: (string | number)[] = [where.organizationId, limit, offset];
    let searchClause = '';
    const trimmed = search?.trim();
    if (trimmed) {
      values.push(`%${trimmed}%`);
      const idx = values.length;
      searchClause = ` AND (um.name ILIKE $${idx} OR um.email ILIKE $${idx})`;
    }
    const result = await this.pool.query<Row>(
      `SELECT um.*, COUNT(*) OVER() AS total_count
       FROM "UserMaster" um
       LEFT JOIN "UserTypeMaster" umt ON umt.id = um."userTypeId"
       WHERE um."organizationId" = $1 AND um."isDeleted" = false${searchClause}
       ORDER BY CASE WHEN umt.code = 'ADMIN' THEN 0 ELSE 1 END ASC, um.name ASC
       LIMIT $2 OFFSET $3`,
      values,
    );
    const total =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const members: UserMasterRecord[] = result.rows.map(
      ({ total_count: _tc, ...m }) => {
        void _tc;
        return m as UserMasterRecord;
      },
    );
    return { members, total };
  }

  private async upsertUserPushToken({
    data,
  }: UpsertUserPushTokenArgs): Promise<UserPushTokenRecord> {
    const result = await this.pool.query<UserPushTokenRecord>(
      `
        INSERT INTO "UserPushToken" (
          "uuid",
          "userId",
          "token",
          "platform",
          "userAgent",
          "lastSeenAt"
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT ("token")
        DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "platform" = EXCLUDED."platform",
          "userAgent" = EXCLUDED."userAgent",
          "lastSeenAt" = NOW(),
          "updatedAt" = NOW()
        RETURNING
          id,
          uuid,
          "userId",
          token,
          platform,
          "userAgent",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
      `,
      [
        randomUUID(),
        data.userId,
        data.token,
        data.platform,
        data.userAgent,
      ],
    );

    return result.rows[0]!;
  }

  private async deleteUserPushToken({
    where,
  }: DeleteUserPushTokenArgs): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM "UserPushToken"
        WHERE "userId" = $1
          AND token = $2
      `,
      [where.userId, where.token],
    );
  }

  private async findPushTokensByUserIds({
    userIds,
  }: FindPushTokensByUserIdsArgs): Promise<UserPushTokenRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.pool.query<UserPushTokenRecord>(
      `
        SELECT
          id,
          uuid,
          "userId",
          token,
          platform,
          "userAgent",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        FROM "UserPushToken"
        WHERE "userId" = ANY($1::int[])
      `,
      [userIds],
    );

    return result.rows;
  }

  private async deleteManyPushTokens({
    tokens,
  }: DeleteManyPushTokensArgs): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    await this.pool.query(
      `
        DELETE FROM "UserPushToken"
        WHERE token = ANY($1::text[])
      `,
      [tokens],
    );
  }

  private async createMentionNotifications({
    userIds,
    conversationId,
    messageId,
    title,
    body,
    metadata,
  }: CreateMentionNotificationsArgs): Promise<UserNotificationRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    const created: UserNotificationRecord[] = [];

    for (const userId of [...new Set(userIds)]) {
      const result = await this.pool.query<NotificationRow>(
        `
          INSERT INTO "UserNotification" (
            uuid,
            "userId",
            type,
            title,
            body,
            "messageId",
            "conversationId",
            metadata,
            "createdAt",
            "updatedAt"
          )
          VALUES (
            gen_random_uuid(),
            $1,
            'CHAT_MENTION',
            $2,
            $3,
            $4,
            $5,
            $6::jsonb,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING
            uuid AS notification_uuid,
            type AS notification_type,
            title AS notification_title,
            body AS notification_body,
            "isRead" AS notification_is_read,
            "readAt" AS notification_read_at,
            "createdAt" AS notification_created_at,
            metadata AS notification_metadata
        `,
        [
          userId,
          title,
          body,
          messageId,
          conversationId,
          JSON.stringify({
            ...metadata,
            mentionedUserId: userId,
          }),
        ],
      );

      created.push({
        ...this.mapNotificationRow(result.rows[0]!),
        conversationUuid: metadata.conversationUuid as string,
        messageUuid: metadata.messageUuid as string,
      });
    }

    return created;
  }

  private async listUserNotifications({
    userId,
    page,
    limit,
  }: ListUserNotificationsArgs): Promise<{
    notifications: UserNotificationRecord[];
    total: number;
  }> {
    const offset = (page - 1) * limit;
    const result = await this.pool.query<NotificationRow>(
      `
        SELECT
          n.uuid AS notification_uuid,
          n.type AS notification_type,
          n.title AS notification_title,
          n.body AS notification_body,
          n."isRead" AS notification_is_read,
          n."readAt" AS notification_read_at,
          n."createdAt" AS notification_created_at,
          c.uuid AS conversation_uuid,
          m.uuid AS message_uuid,
          n.metadata AS notification_metadata,
          COUNT(*) OVER() AS total_count
        FROM "UserNotification" n
        LEFT JOIN "Conversation" c ON c.id = n."conversationId"
        LEFT JOIN "Message" m ON m.id = n."messageId"
        WHERE n."userId" = $1
        ORDER BY n."createdAt" DESC, n.id DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset],
    );

    const total =
      result.rows.length > 0
        ? parseInt(result.rows[0].total_count ?? '0', 10)
        : 0;

    return {
      notifications: result.rows.map((row) => this.mapNotificationRow(row)),
      total,
    };
  }

  private async countUnreadNotifications({
    userId,
  }: CountUnreadNotificationsArgs): Promise<number> {
    const result = await this.pool.query<{ unread_count: string }>(
      `
        SELECT COUNT(*)::text AS unread_count
        FROM "UserNotification"
        WHERE "userId" = $1
          AND "isRead" = false
      `,
      [userId],
    );

    return parseInt(result.rows[0]?.unread_count ?? '0', 10);
  }

  private async markNotificationRead({
    userId,
    notificationUuid,
  }: MarkNotificationReadArgs): Promise<void> {
    await this.pool.query(
      `
        UPDATE "UserNotification"
        SET
          "isRead" = true,
          "readAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = $1
          AND uuid = $2
          AND "isRead" = false
      `,
      [userId, notificationUuid],
    );
  }

  private async markAllNotificationsRead({
    userId,
  }: MarkAllNotificationsReadArgs): Promise<void> {
    await this.pool.query(
      `
        UPDATE "UserNotification"
        SET
          "isRead" = true,
          "readAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = $1
          AND "isRead" = false
      `,
      [userId],
    );
  }

  private async markConversationNotificationsRead({
    userId,
    conversationUuid,
  }: MarkConversationNotificationsReadArgs): Promise<void> {
    await this.pool.query(
      `
        UPDATE "UserNotification" notification
        SET
          "isRead" = true,
          "readAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        FROM "Conversation" conversation
        WHERE notification."conversationId" = conversation.id
          AND notification."userId" = $1
          AND notification."isRead" = false
          AND conversation.uuid = $2
      `,
      [userId, conversationUuid],
    );
  }

  private async findOrganizationById({
    where,
  }: FindOrganizationByIdArgs): Promise<OrganizationMasterRecord | null> {
    const result = await this.pool.query<OrganizationMasterRecord>(
      `SELECT * FROM "OrganizationMaster" WHERE id = $1 LIMIT 1`,
      [where.id],
    );
    return result.rows[0] ?? null;
  }

  private async findUniqueOrganization({
    where,
  }: FindOrganizationUniqueArgs): Promise<OrganizationMasterRecord | null> {
    const result = await this.pool.query<OrganizationMasterRecord>(
      `
        SELECT *
        FROM "OrganizationMaster"
        WHERE slug = $1
        LIMIT 1
      `,
      [where.slug],
    );

    return result.rows[0] ?? null;
  }

  private async createOrganization({
    data,
  }: CreateOrganizationArgs): Promise<OrganizationMasterRecord> {
    const result = await this.pool.query<OrganizationMasterRecord>(
      `
        INSERT INTO "OrganizationMaster" (
          uuid,
          name,
          slug,
          email,
          "createdAt",
          "updatedAt"
        )
        VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [data.name, data.slug, data.email],
    );

    return result.rows[0];
  }

  private async findUniqueUserType({
    where,
  }: FindUserTypeUniqueArgs): Promise<UserTypeMasterRecord | null> {
    const result = await this.pool.query<UserTypeMasterRecord>(
      `
        SELECT *
        FROM "UserTypeMaster"
        WHERE code = $1
        LIMIT 1
      `,
      [where.code],
    );

    return result.rows[0] ?? null;
  }

  private async findUserTypeById({
    where,
  }: FindUserTypeByIdArgs): Promise<UserTypeMasterRecord | null> {
    const result = await this.pool.query<UserTypeMasterRecord>(
      `
        SELECT *
        FROM "UserTypeMaster"
        WHERE id = $1
        LIMIT 1
      `,
      [where.id],
    );

    return result.rows[0] ?? null;
  }

  private async findFirstUser({
    where,
    include,
  }: FindFirstArgs): Promise<UserMasterRecord | null> {
    const values: Array<string | number | boolean> = [where.email];
    let organizationClause = '';
    let isDeletedClause = '';

    if (typeof where.organizationId === 'number') {
      values.push(where.organizationId);
      organizationClause = ` AND "organizationId" = $${values.length}`;
    }

    if (typeof where.isDeleted === 'boolean') {
      values.push(where.isDeleted);
      isDeletedClause = ` AND "isDeleted" = $${values.length}`;
    }

    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE email = $1${organizationClause}${isDeletedClause}
        LIMIT 1
      `,
      values,
    );

    const user = result.rows[0] ?? null;

    if (!user) {
      return null;
    }

    return this.withIncludes(user, include);
  }

  private async findManyUsersByEmail({
    where,
    include,
  }: FindManyByEmailArgs): Promise<UserMasterRecord[]> {
    const values: Array<string | boolean> = [where.email];
    let isDeletedClause = '';

    if (typeof where.isDeleted === 'boolean') {
      values.push(where.isDeleted);
      isDeletedClause = ` AND "isDeleted" = $${values.length}`;
    }

    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE email = $1${isDeletedClause}
        ORDER BY id ASC
      `,
      values,
    );

    if (!include?.authProviders) {
      return result.rows;
    }

    return Promise.all(
      result.rows.map((user) => this.withIncludes(user, include)),
    );
  }

  private async createUser({
    data,
    include,
  }: CreateArgs): Promise<UserMasterRecord> {
    const user = await this.createBareUserWithClient(this.pool, data);
    const authProviderResult = await this.createUserAuthProviderWithClient(
      this.pool,
      {
        data: {
          userId: user.id,
          provider: data.authProviders.create.provider,
          providerId: data.authProviders.create.providerId,
        },
      },
    );

    if (include?.authProviders) {
      return {
        ...user,
        authProviders: [authProviderResult],
      };
    }

    return user;
  }

  private async createBareUserWithClient(
    client: Pool | PoolClient,
    data: CreateArgs['data'],
  ): Promise<UserMasterRecord> {
    const createdUserResult = await client.query<UserMasterRecord>(
      `
        INSERT INTO "UserMaster" (
          uuid,
          name,
          email,
          password,
          "organizationId",
          "userTypeId",
          "createdAt",
          "updatedAt"
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [
        data.name,
        data.email,
        data.password,
        data.organizationId,
        data.userTypeId,
      ],
    );

    return createdUserResult.rows[0];
  }

  private async createUserAuthProvider({
    data,
  }: CreateAuthProviderArgs): Promise<UserAuthProviderRecord> {
    return this.createUserAuthProviderWithClient(this.pool, { data });
  }

  private async createUserAuthProviderWithClient(
    client: Pool | PoolClient,
    { data }: CreateAuthProviderArgs,
  ): Promise<UserAuthProviderRecord> {
    const result = await client.query<UserAuthProviderRecord>(
      `
        INSERT INTO "UserAuthProvider" (
          uuid,
          "userId",
          provider,
          "providerId",
          "createdAt",
          "updatedAt"
        )
        VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [data.userId, data.provider, data.providerId],
    );

    return result.rows[0];
  }

  private async findDirectConversationsForUser({
    userId,
    organizationId,
    page,
    limit,
    search,
    filter = 'ALL',
  }: FindDirectConversationsForUserArgs): Promise<{
    conversations: (DirectConversationSummaryRecord | GroupConversationSummaryRecord)[];
    total: number;
  }> {
    if (filter === 'GROUPS') {
      return this.findGroupConversationsForUser({ userId, organizationId, page, limit, search });
    }

    const offset = (page - 1) * limit;
    const values: Array<number | string> = [
      userId,
      organizationId,
      limit,
      offset,
    ];
    let searchClause = '';
    let filterClause = '';
    const trimmed = search?.trim();

    if (trimmed) {
      values.push(`%${trimmed}%`);
      const idx = values.length;
      searchClause = ` AND (
        other_user.name ILIKE $${idx}
        OR other_user.email ILIKE $${idx}
        OR COALESCE(last_message.content, '') ILIKE $${idx}
      )`;
    }

    if (filter === 'UNREAD') {
      filterClause = ' AND COALESCE(unread.unread_count, 0) > 0';
    }

    const [directResult, groupResult] = await Promise.all([
      this.pool.query<DirectConversationRow>(
        `${this.directConversationSelect(true)}
         WHERE my_participant."userId" = $1
           AND my_participant."isActive" = true
           AND c."organizationId" = $2
           AND c.type = 'DIRECT'
           AND c."isDeleted" = false
           AND other_user."organizationId" = $2
           AND other_user."isDeleted" = false
           AND other_user."isActive" = true${filterClause}${searchClause}
         ORDER BY COALESCE(last_message."createdAt", c."createdAt") DESC, c.id DESC
         LIMIT $3 OFFSET $4`,
        values,
      ),
      this.findGroupConversationsForUser({
        userId,
        organizationId,
        page: 1,
        limit: 1000,
        search,
        unreadOnly: filter === 'UNREAD',
      }),
    ]);

    const directTotal =
      directResult.rows.length > 0
        ? parseInt(directResult.rows[0].total_count ?? '0', 10)
        : 0;

    const directConversations = directResult.rows.map((row) =>
      this.mapDirectConversationRow(row),
    );

    const allConversations = [
      ...directConversations,
      ...groupResult.conversations,
    ].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : new Date(a.createdAt).getTime();
      const bTime = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return {
      conversations: allConversations,
      total: directTotal + groupResult.total,
    };
  }

  private async createOrGetDirectConversation({
    organizationId,
    currentUserId,
    participantUserId,
  }: CreateOrGetDirectConversationArgs): Promise<DirectConversationSummaryRecord> {
    const directKey = [currentUserId, participantUserId]
      .sort((a, b) => a - b)
      .join('_');
    const existingConversation = await this.findDirectConversationByKey(
      directKey,
      currentUserId,
      organizationId,
    );

    if (existingConversation) {
      return existingConversation;
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const conversationResult = await client.query<ConversationRecord>(
        `
          INSERT INTO "Conversation" (
            uuid,
            type,
            "organizationId",
            "directKey",
            "createdById",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            gen_random_uuid(),
            'DIRECT',
            $1,
            $2,
            $3,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING *
        `,
        [organizationId, directKey, currentUserId],
      );

      const conversation = conversationResult.rows[0];

      await client.query(
        `
          INSERT INTO "ConversationParticipant" (
            uuid,
            "conversationId",
            "userId",
            role,
            "joinedAt",
            "isActive",
            "createdAt",
            "updatedAt"
          )
          VALUES
            (gen_random_uuid(), $1, $2, 'OWNER', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            (gen_random_uuid(), $1, $3, 'MEMBER', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [conversation.id, currentUserId, participantUserId],
      );

      await client.query('COMMIT');

      return {
        uuid: conversation.uuid,
        type: 'DIRECT',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        unreadCount: 0,
        otherParticipant:
          await this.findDirectConversationParticipant(participantUserId),
        lastMessage: null,
      };
    } catch (error) {
      await client.query('ROLLBACK');

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        const conversation = await this.findDirectConversationByKey(
          directKey,
          currentUserId,
          organizationId,
        );

        if (conversation) {
          return conversation;
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  private createTransactionClient(client: PoolClient): TransactionClient {
    return {
      organizationMaster: {
        create: (args) => this.createOrganizationWithClient(client, args),
      },
      userMaster: {
        create: (args) =>
          this.createBareUserWithClient(client, {
            ...args.data,
            authProviders: {
              create: {
                provider: 'EMAIL',
                providerId: args.data.email.toLowerCase(),
              },
            },
          }),
      },
      userAuthProvider: {
        create: (args) => this.createUserAuthProviderWithClient(client, args),
      },
    };
  }

  private async createOrganizationWithClient(
    client: Pool | PoolClient,
    { data }: CreateOrganizationArgs,
  ): Promise<OrganizationMasterRecord> {
    const result = await client.query<OrganizationMasterRecord>(
      `
        INSERT INTO "OrganizationMaster" (
          uuid,
          name,
          slug,
          email,
          "createdAt",
          "updatedAt"
        )
        VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [data.name, data.slug, data.email],
    );

    return result.rows[0];
  }

  private async withIncludes(
    user: UserMasterRecord,
    include?: {
      authProviders?: boolean;
    },
  ): Promise<UserMasterRecord> {
    if (!include?.authProviders) {
      return user;
    }

    return {
      ...user,
      authProviders: await this.findAuthProvidersByUserId(user.id),
    };
  }

  private async findAuthProvidersByUserId(
    userId: number,
    client: Pool | PoolClient = this.pool,
  ): Promise<UserAuthProviderRecord[]> {
    const result = await client.query<UserAuthProviderRecord>(
      `
        SELECT *
        FROM "UserAuthProvider"
        WHERE "userId" = $1
        ORDER BY id ASC
      `,
      [userId],
    );

    return result.rows;
  }

  private async findDirectConversationByKey(
    directKey: string,
    userId: number,
    organizationId: number,
  ): Promise<DirectConversationSummaryRecord | null> {
    const result = await this.pool.query<DirectConversationRow>(
      `${this.directConversationSelect(false)}
       WHERE my_participant."userId" = $1
         AND my_participant."isActive" = true
         AND c."organizationId" = $2
         AND c.type = 'DIRECT'
         AND c."directKey" = $3
         AND c."isDeleted" = false
         AND other_user."organizationId" = $2
         AND other_user."isDeleted" = false
         AND other_user."isActive" = true
       LIMIT 1`,
      [userId, organizationId, directKey],
    );

    return result.rows[0] ? this.mapDirectConversationRow(result.rows[0]) : null;
  }

  private async findDirectConversationParticipant(userId: number): Promise<{
    id: number;
    uuid: string;
    name: string;
    email: string;
    profile_pic_url: string | null;
  }> {
    const result = await this.pool.query<{
      id: number;
      uuid: string;
      name: string;
      email: string;
      profile_pic: string | null;
    }>(
      `
        SELECT id, uuid, name, email, "profile_pic"
        FROM "UserMaster"
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      email: row.email,
      profile_pic_url: row.profile_pic,
    };
  }

  private async findDirectMessages({
    organizationId,
    currentUserId,
    participantUserId,
  }: FindDirectMessagesArgs): Promise<DirectMessageRecord[]> {
    const directKey = [currentUserId, participantUserId]
      .sort((a, b) => a - b)
      .join('_');

    const result = await this.pool.query<DirectMessageRow>(
      `
        SELECT
          m.uuid         AS message_uuid,
          c.uuid         AS conversation_uuid,
          sender.id      AS sender_id,
          sender.uuid    AS sender_uuid,
          sender.name    AS sender_name,
          m.content      AS message_content,
          m.type         AS message_type,
          m."createdAt"  AS message_created_at,
          m."updatedAt"  AS message_updated_at,
          (m."senderId" = $1) AS is_own_message,
          CASE
            WHEN m."senderId" = $1
              AND other_participant."lastReadMessageId" IS NOT NULL
              AND m.id <= other_participant."lastReadMessageId"
            THEN 'read'
            ELSE 'sent'
          END AS message_status,
          CASE
            WHEN m."senderId" = $1
              AND other_participant."lastReadMessageId" IS NOT NULL
              AND m.id <= other_participant."lastReadMessageId"
            THEN other_participant."lastReadAt"
            ELSE NULL
          END AS message_read_at,
          COALESCE(
            json_agg(
              json_build_object(
                'uuid',      ma.uuid,
                'type',      ma.type,
                'name',      ma.name,
                'url',       ma.url,
                'mimeType',  ma."mimeType",
                'sizeBytes', ma.size
              ) ORDER BY ma.id ASC
            ) FILTER (WHERE ma.id IS NOT NULL),
            '[]'::json
          ) AS message_attachments,
          parent_msg.uuid    AS parent_message_uuid,
          parent_sender.name AS parent_sender_name,
          parent_msg.content AS parent_message_content,
          parent_msg.type    AS parent_message_type
        FROM "Conversation" c
        INNER JOIN "ConversationParticipant" my_participant
          ON my_participant."conversationId" = c.id
         AND my_participant."userId" = $1
         AND my_participant."isActive" = true
        INNER JOIN "ConversationParticipant" other_participant
          ON other_participant."conversationId" = c.id
         AND other_participant."userId" = $2
         AND other_participant."isActive" = true
        INNER JOIN "Message" m
          ON m."conversationId" = c.id
         AND m."isDeleted" = false
        INNER JOIN "UserMaster" sender
          ON sender.id = m."senderId"
        LEFT JOIN "MessageAttachment" ma ON ma."messageId" = m.id
        LEFT JOIN "Message" parent_msg ON parent_msg.id = m."parentMessageId"
        LEFT JOIN "UserMaster" parent_sender ON parent_sender.id = parent_msg."senderId"
        WHERE c."organizationId" = $3
          AND c.type = 'DIRECT'
          AND c."directKey" = $4
          AND c."isDeleted" = false
        GROUP BY
          m.id, m.uuid, m.content, m.type, m."createdAt", m."updatedAt", m."senderId",
          c.uuid,
          sender.id, sender.uuid, sender.name,
          other_participant."lastReadMessageId", other_participant."lastReadAt",
          parent_msg.uuid, parent_sender.name, parent_msg.content, parent_msg.type
        ORDER BY m."createdAt" ASC, m.id ASC
      `,
      [currentUserId, participantUserId, organizationId, directKey],
    );

    const conversationUuid = result.rows[0]?.conversation_uuid;
    if (conversationUuid) {
      await this.markConversationNotificationsRead({
        userId: currentUserId,
        conversationUuid,
      });
    }

    return result.rows.map((row) => this.mapDirectMessageRow(row));
  }

  private async findDirectAttachmentForUser({
    organizationId,
    currentUserId,
    attachmentUuid,
  }: FindDirectAttachmentForUserArgs): Promise<DirectAttachmentAccessRecord | null> {
    const result = await this.pool.query<DirectAttachmentAccessRecord>(
      `
        SELECT
          ma.uuid AS uuid,
          ma.name AS name,
          ma.url AS url,
          ma."mimeType" AS "mimeType",
          ma.size AS "sizeBytes"
        FROM "MessageAttachment" ma
        INNER JOIN "Message" m
          ON m.id = ma."messageId"
         AND m."isDeleted" = false
        INNER JOIN "Conversation" c
          ON c.id = m."conversationId"
         AND c.type = 'DIRECT'
         AND c."isDeleted" = false
        INNER JOIN "ConversationParticipant" cp
          ON cp."conversationId" = c.id
         AND cp."userId" = $1
         AND cp."isActive" = true
        WHERE c."organizationId" = $2
          AND ma.uuid = $3
        LIMIT 1
      `,
      [currentUserId, organizationId, attachmentUuid],
    );

    return result.rows[0] ?? null;
  }

  private async createDirectMessage({
    organizationId,
    currentUserId,
    participantUserId,
    content,
    messageType = 'TEXT',
    attachments = [],
    parentMessageUuid,
  }: CreateDirectMessageArgs): Promise<DirectMessageRecord> {
    const directKey = [currentUserId, participantUserId]
      .sort((a, b) => a - b)
      .join('_');

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let conversationResult = await client.query<{
        id: number;
        uuid: string;
      }>(
        `
          SELECT id, uuid
          FROM "Conversation"
          WHERE "organizationId" = $1
            AND type = 'DIRECT'
            AND "directKey" = $2
            AND "isDeleted" = false
          LIMIT 1
        `,
        [organizationId, directKey],
      );

      if (conversationResult.rows.length === 0) {
        const createdConversationResult = await client.query<ConversationRecord>(
          `
            INSERT INTO "Conversation" (
              uuid,
              type,
              "organizationId",
              "directKey",
              "createdById",
              "createdAt",
              "updatedAt"
            )
            VALUES (
              gen_random_uuid(),
              'DIRECT',
              $1,
              $2,
              $3,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            RETURNING *
          `,
          [organizationId, directKey, currentUserId],
        );

        const conversation = createdConversationResult.rows[0];

        await client.query(
          `
            INSERT INTO "ConversationParticipant" (
              uuid,
              "conversationId",
              "userId",
              role,
              "joinedAt",
              "isActive",
              "createdAt",
              "updatedAt"
            )
            VALUES
              (gen_random_uuid(), $1, $2, 'OWNER', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
              (gen_random_uuid(), $1, $3, 'MEMBER', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          [conversation.id, currentUserId, participantUserId],
        );

        conversationResult = {
          rows: [{ id: conversation.id, uuid: conversation.uuid }],
        } as { rows: Array<{ id: number; uuid: string }> };
      }

      const conversation = conversationResult.rows[0];

      let parentMessageId: number | null = null;
      if (parentMessageUuid) {
        const parentResult = await client.query<{ id: number }>(
          `SELECT id FROM "Message" WHERE uuid = $1 AND "conversationId" = $2 AND "isDeleted" = false LIMIT 1`,
          [parentMessageUuid, conversation.id],
        );
        parentMessageId = parentResult.rows[0]?.id ?? null;
      }

      type InsertedMessageRow = {
        message_id: number;
        message_uuid: string;
        sender_id: number;
        message_content: string | null;
        message_type: string;
        message_created_at: Date;
        message_updated_at: Date;
      };
      const messageResult = await client.query<InsertedMessageRow>(
        `
          INSERT INTO "Message" (
            uuid,
            "conversationId",
            "senderId",
            type,
            content,
            "parentMessageId",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $4,
            $3,
            $5,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING
            id AS message_id,
            uuid AS message_uuid,
            "senderId" AS sender_id,
            content AS message_content,
            type AS message_type,
            "createdAt" AS message_created_at,
            "updatedAt" AS message_updated_at
        `,
        [conversation.id, currentUserId, content, messageType, parentMessageId],
      );

      const baseMessage = messageResult.rows[0];

      // Insert attachments if any
      for (const att of attachments) {
        await client.query(
          `
            INSERT INTO "MessageAttachment" (
              uuid, "messageId", type, name, url, "mimeType", size, "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          `,
          [
            att.uuid,
            baseMessage.message_id,
            att.attachmentType,
            att.name,
            att.key,
            att.mimeType,
            att.sizeBytes,
          ],
        );
      }

      await client.query(
        `
          UPDATE "Conversation"
          SET "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [conversation.id],
      );

      await client.query(
        `
          UPDATE "ConversationParticipant"
          SET
            "lastReadAt" = CURRENT_TIMESTAMP,
            "lastReadMessageId" = $2,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "conversationId" = $1
            AND "userId" = $3
        `,
        [conversation.id, baseMessage.message_id, currentUserId],
      );

      const sender = await client.query<{
        id: number;
        uuid: string;
        name: string;
      }>(
        `
          SELECT id, uuid, name
          FROM "UserMaster"
          WHERE id = $1
          LIMIT 1
        `,
        [currentUserId],
      );

      await client.query('COMMIT');

      return this.mapDirectMessageRow({
        ...baseMessage,
        conversation_id: conversation.id,
        conversation_uuid: conversation.uuid,
        sender_uuid: sender.rows[0].uuid,
        sender_name: sender.rows[0].name,
        is_own_message: true,
        message_status: 'sent',
        message_attachments: attachments.map((a) => ({
          uuid: a.uuid,
          type: a.attachmentType,
          name: a.name,
          url: a.key,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
        parent_message_uuid: null,
        parent_sender_name: null,
        parent_message_content: null,
        parent_message_type: null,
      });
    } catch (error) {
      await client.query('ROLLBACK');

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return this.createDirectMessage({
          organizationId,
          currentUserId,
          participantUserId,
          content,
          messageType,
          attachments,
          parentMessageUuid,
        });
      }

      throw error;
    } finally {
      client.release();
    }
  }

  private async markDirectChatRead({
    organizationId,
    currentUserId,
    participantUserId,
  }: MarkDirectChatReadArgs): Promise<void> {
    const directKey = [currentUserId, participantUserId]
      .sort((a, b) => a - b)
      .join('_');

    await this.pool.query(
      `
        UPDATE "ConversationParticipant" participant
        SET
          "lastReadAt" = CURRENT_TIMESTAMP,
          "lastReadMessageId" = latest_message.id,
          "updatedAt" = CURRENT_TIMESTAMP
        FROM "Conversation" conversation
        LEFT JOIN LATERAL (
          SELECT id
          FROM "Message"
          WHERE "conversationId" = conversation.id
            AND "isDeleted" = false
          ORDER BY "createdAt" DESC, id DESC
          LIMIT 1
        ) AS latest_message ON true
        WHERE participant."conversationId" = conversation.id
          AND participant."userId" = $1
          AND participant."isActive" = true
          AND conversation."organizationId" = $2
          AND conversation.type = 'DIRECT'
          AND conversation."directKey" = $3
          AND conversation."isDeleted" = false
      `,
      [currentUserId, organizationId, directKey],
    );
  }

  private directConversationSelect(includeTotalCount: boolean): string {
    return `
      SELECT
        c.uuid AS conversation_uuid,
        c.type AS conversation_type,
        c."createdAt" AS conversation_created_at,
        c."updatedAt" AS conversation_updated_at,
        other_user.id AS other_user_id,
        other_user.uuid AS other_user_uuid,
        other_user.name AS other_user_name,
        other_user.email AS other_user_email,
        other_user."profile_pic" AS other_user_profile_pic,
        COALESCE(unread.unread_count, 0) AS unread_count,
        last_message.uuid AS last_message_uuid,
        last_message.content AS last_message_content,
        last_message.type AS last_message_type,
        last_message."createdAt" AS last_message_created_at${
          includeTotalCount ? ', COUNT(*) OVER() AS total_count' : ''
        }
      FROM "ConversationParticipant" my_participant
      INNER JOIN "Conversation" c
        ON c.id = my_participant."conversationId"
      INNER JOIN "ConversationParticipant" other_participant
        ON other_participant."conversationId" = c.id
       AND other_participant."userId" <> $1
       AND other_participant."isActive" = true
      INNER JOIN "UserMaster" other_user
        ON other_user.id = other_participant."userId"
      LEFT JOIN LATERAL (
        SELECT
          m.uuid,
          m.content,
          m.type,
          m."createdAt"
        FROM "Message" m
        WHERE m."conversationId" = c.id
          AND m."isDeleted" = false
        ORDER BY m."createdAt" DESC, m.id DESC
        LIMIT 1
      ) AS last_message ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM "Message" m
        WHERE m."conversationId" = c.id
          AND m."isDeleted" = false
          AND m."senderId" <> $1
          AND (
            my_participant."lastReadMessageId" IS NULL
            OR m.id > my_participant."lastReadMessageId"
          )
      ) AS unread ON true
    `;
  }

  private async findGroupMessages({
    conversationUuid,
    currentUserId,
    organizationId,
  }: FindGroupMessagesArgs): Promise<DirectMessageRecord[]> {
    const result = await this.pool.query<DirectMessageRow>(
      `
        SELECT
          m.uuid         AS message_uuid,
          c.uuid         AS conversation_uuid,
          sender.id      AS sender_id,
          sender.uuid    AS sender_uuid,
          sender.name    AS sender_name,
          m.content      AS message_content,
          m.type         AS message_type,
          m."createdAt"  AS message_created_at,
          m."updatedAt"  AS message_updated_at,
          (m."senderId" = $1) AS is_own_message,
          'sent' AS message_status,
          COALESCE(
            json_agg(
              json_build_object(
                'uuid',      ma.uuid,
                'type',      ma.type,
                'name',      ma.name,
                'url',       ma.url,
                'mimeType',  ma."mimeType",
                'sizeBytes', ma.size
              ) ORDER BY ma.id ASC
            ) FILTER (WHERE ma.id IS NOT NULL),
            '[]'::json
          ) AS message_attachments,
          parent_msg.uuid    AS parent_message_uuid,
          parent_sender.name AS parent_sender_name,
          parent_msg.content AS parent_message_content,
          parent_msg.type    AS parent_message_type
        FROM "Conversation" c
        INNER JOIN "ConversationParticipant" my_participant
          ON my_participant."conversationId" = c.id
         AND my_participant."userId" = $1
         AND my_participant."isActive" = true
        INNER JOIN "Message" m
          ON m."conversationId" = c.id
         AND m."isDeleted" = false
        INNER JOIN "UserMaster" sender
          ON sender.id = m."senderId"
        LEFT JOIN "MessageAttachment" ma ON ma."messageId" = m.id
        LEFT JOIN "Message" parent_msg ON parent_msg.id = m."parentMessageId"
        LEFT JOIN "UserMaster" parent_sender ON parent_sender.id = parent_msg."senderId"
        WHERE c.uuid = $2
          AND c.type = 'GROUP'
          AND c."isDeleted" = false
          AND c."organizationId" = $3
        GROUP BY
          m.id, m.uuid, m.content, m.type, m."createdAt", m."updatedAt", m."senderId",
          c.uuid,
          sender.id, sender.uuid, sender.name,
          parent_msg.uuid, parent_sender.name, parent_msg.content, parent_msg.type
        ORDER BY m."createdAt" ASC, m.id ASC
      `,
      [currentUserId, conversationUuid, organizationId],
    );

    await this.markGroupConversationRead({
      conversationUuid,
      currentUserId,
      organizationId,
    });
    await this.markConversationNotificationsRead({
      userId: currentUserId,
      conversationUuid,
    });

    return result.rows.map((row) => this.mapDirectMessageRow(row));
  }

  private async createGroupMessage({
    conversationUuid,
    currentUserId,
    organizationId,
    content,
    messageType = 'TEXT',
    attachments = [],
    mentions = [],
    parentMessageUuid,
  }: CreateGroupMessageArgs): Promise<{
    message: DirectMessageRecord;
    participantIds: number[];
    mentionRecipientIds: number[];
    conversationName: string;
    messageId: number;
  }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const convResult = await client.query<{
        id: number;
        uuid: string;
        name: string | null;
      }>(
        `
          SELECT c.id, c.uuid, c.name
          FROM "Conversation" c
          INNER JOIN "ConversationParticipant" cp
            ON cp."conversationId" = c.id
           AND cp."userId" = $1
           AND cp."isActive" = true
          WHERE c.uuid = $2
            AND c.type = 'GROUP'
            AND c."isDeleted" = false
            AND c."organizationId" = $3
          LIMIT 1
        `,
        [currentUserId, conversationUuid, organizationId],
      );

      if (convResult.rows.length === 0) {
        throw new Error('Group conversation not found or user is not a participant');
      }

      const conversation = convResult.rows[0];

      let parentMessageId: number | null = null;
      if (parentMessageUuid) {
        const parentResult = await client.query<{ id: number }>(
          `SELECT id FROM "Message" WHERE uuid = $1 AND "conversationId" = $2 AND "isDeleted" = false LIMIT 1`,
          [parentMessageUuid, conversation.id],
        );
        parentMessageId = parentResult.rows[0]?.id ?? null;
      }

      type InsertedMessageRow = {
        message_id: number;
        message_uuid: string;
        sender_id: number;
        message_content: string | null;
        message_type: string;
        message_created_at: Date;
        message_updated_at: Date;
      };

      const messageResult = await client.query<InsertedMessageRow>(
        `
          INSERT INTO "Message" (uuid, "conversationId", "senderId", type, content, "parentMessageId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, $2, $4, $3, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING
            id AS message_id,
            uuid AS message_uuid,
            "senderId" AS sender_id,
            content AS message_content,
            type AS message_type,
            "createdAt" AS message_created_at,
            "updatedAt" AS message_updated_at
        `,
        [conversation.id, currentUserId, content, messageType, parentMessageId],
      );

      const baseMessage = messageResult.rows[0];

      const participantsResult = await client.query<{ userId: number }>(
        `SELECT "userId" FROM "ConversationParticipant" WHERE "conversationId" = $1 AND "isActive" = true`,
        [conversation.id],
      );

      const participantIds = participantsResult.rows.map((r) => r.userId);
      const validMentionRecipientIds = [...new Set(
        mentions
          .filter(
            (mention) =>
              mention.mentionedUserId !== currentUserId &&
              participantIds.includes(mention.mentionedUserId),
          )
          .map((mention) => mention.mentionedUserId),
      )];

      for (const mention of mentions) {
        if (
          mention.mentionedUserId === currentUserId ||
          !participantIds.includes(mention.mentionedUserId)
        ) {
          continue;
        }

        await client.query(
          `
            INSERT INTO "MessageMention" (
              "messageId",
              "mentionedUserId",
              "offset",
              "length",
              "createdAt"
            )
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `,
          [
            baseMessage.message_id,
            mention.mentionedUserId,
            mention.offset,
            mention.length,
          ],
        );
      }

      for (const att of attachments) {
        await client.query(
          `
            INSERT INTO "MessageAttachment" (uuid, "messageId", type, name, url, "mimeType", size, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          `,
          [att.uuid, baseMessage.message_id, att.attachmentType, att.name, att.key, att.mimeType, att.sizeBytes],
        );
      }

      await client.query(
        `UPDATE "Conversation" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
        [conversation.id],
      );

      await client.query(
        `
          UPDATE "ConversationParticipant"
          SET "lastReadAt" = CURRENT_TIMESTAMP, "lastReadMessageId" = $2, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "conversationId" = $1 AND "userId" = $3
        `,
        [conversation.id, baseMessage.message_id, currentUserId],
      );

      const sender = await client.query<{ id: number; uuid: string; name: string }>(
        `SELECT id, uuid, name FROM "UserMaster" WHERE id = $1 LIMIT 1`,
        [currentUserId],
      );

      await client.query('COMMIT');

      const messageRecord = this.mapDirectMessageRow({
        ...baseMessage,
        conversation_id: conversation.id,
        conversation_uuid: conversation.uuid,
        sender_uuid: sender.rows[0].uuid,
        sender_name: sender.rows[0].name,
        is_own_message: true,
        message_status: 'sent',
        message_attachments: attachments.map((a) => ({
          uuid: a.uuid,
          type: a.attachmentType,
          name: a.name,
          url: a.key,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
        parent_message_uuid: null,
        parent_sender_name: null,
        parent_message_content: null,
        parent_message_type: null,
      });

      return {
        message: messageRecord,
        participantIds,
        mentionRecipientIds: validMentionRecipientIds,
        conversationName: conversation.name ?? 'Group chat',
        messageId: baseMessage.message_id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async findGroupConversationsForUser({
    userId,
    organizationId,
    page,
    limit,
    search,
    unreadOnly = false,
  }: FindGroupConversationsForUserArgs): Promise<{
    conversations: GroupConversationSummaryRecord[];
    total: number;
  }> {
    const offset = (page - 1) * limit;
    const values: Array<number | string> = [userId, organizationId, limit, offset];
    let searchClause = '';
    const unreadClause = unreadOnly ? '\n          AND COALESCE(unread.unread_count, 0) > 0' : '';
    const trimmed = search?.trim();

    if (trimmed) {
      values.push(`%${trimmed}%`);
      const idx = values.length;
      searchClause = ` AND (c.name ILIKE $${idx} OR COALESCE(last_message.content, '') ILIKE $${idx})`;
    }

    const result = await this.pool.query<GroupConversationRow>(
      `
        SELECT
          c.uuid AS conversation_uuid,
          c.name AS conversation_name,
          c."createdAt" AS conversation_created_at,
          c."updatedAt" AS conversation_updated_at,
          COALESCE(unread.unread_count, 0) AS unread_count,
          last_message.uuid AS last_message_uuid,
          last_message.content AS last_message_content,
          last_message.type AS last_message_type,
          last_message."createdAt" AS last_message_created_at,
          (
            SELECT json_agg(json_build_object(
              'id', u.id,
              'uuid', u.uuid,
              'name', u.name,
              'email', u.email,
              'profile_pic', u."profile_pic"
            ) ORDER BY u.name ASC)
            FROM "ConversationParticipant" cp
            INNER JOIN "UserMaster" u ON u.id = cp."userId"
            WHERE cp."conversationId" = c.id
              AND cp."isActive" = true
              AND u."isDeleted" = false
          ) AS participants_json,
          COUNT(*) OVER() AS total_count
        FROM "ConversationParticipant" my_participant
        INNER JOIN "Conversation" c
          ON c.id = my_participant."conversationId"
          AND c.type = 'GROUP'
          AND c."isDeleted" = false
          AND c."organizationId" = $2
        LEFT JOIN LATERAL (
          SELECT m.uuid, m.content, m.type, m."createdAt"
          FROM "Message" m
          WHERE m."conversationId" = c.id AND m."isDeleted" = false
          ORDER BY m."createdAt" DESC, m.id DESC
          LIMIT 1
        ) AS last_message ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS unread_count
          FROM "Message" m
          WHERE m."conversationId" = c.id
            AND m."isDeleted" = false
            AND m."senderId" <> $1
            AND (
              my_participant."lastReadMessageId" IS NULL
              OR m.id > my_participant."lastReadMessageId"
            )
        ) AS unread ON true
        WHERE my_participant."userId" = $1
          AND my_participant."isActive" = true${unreadClause}${searchClause}
        ORDER BY COALESCE(last_message."createdAt", c."createdAt") DESC, c.id DESC
        LIMIT $3 OFFSET $4
      `,
      values,
    );

    const total =
      result.rows.length > 0
        ? parseInt(result.rows[0].total_count ?? '0', 10)
        : 0;

    const conversations: GroupConversationSummaryRecord[] = result.rows.map((row) => ({
      uuid: row.conversation_uuid,
      type: 'GROUP' as const,
      name: row.conversation_name ?? 'Unnamed Group',
      createdAt: row.conversation_created_at,
      updatedAt: row.conversation_updated_at,
      unreadCount: parseInt(row.unread_count, 10),
      participants: (row.participants_json ?? []).map((p) => ({
        id: p.id,
        uuid: p.uuid,
        name: p.name,
        email: p.email,
        profile_pic_url: p.profile_pic,
      })),
      lastMessage: row.last_message_uuid
        ? {
            uuid: row.last_message_uuid,
            content: row.last_message_content,
            type: row.last_message_type ?? 'TEXT',
            createdAt: row.last_message_created_at ?? row.conversation_created_at,
          }
        : null,
    }));

    return { conversations, total };
  }

  private async markGroupConversationRead({
    conversationUuid,
    currentUserId,
    organizationId,
  }: FindGroupMessagesArgs): Promise<void> {
    await this.pool.query(
      `
        UPDATE "ConversationParticipant" participant
        SET
          "lastReadAt" = CURRENT_TIMESTAMP,
          "lastReadMessageId" = latest_message.id,
          "updatedAt" = CURRENT_TIMESTAMP
        FROM "Conversation" conversation
        LEFT JOIN LATERAL (
          SELECT id
          FROM "Message"
          WHERE "conversationId" = conversation.id
            AND "isDeleted" = false
          ORDER BY "createdAt" DESC, id DESC
          LIMIT 1
        ) AS latest_message ON true
        WHERE participant."conversationId" = conversation.id
          AND participant."userId" = $1
          AND participant."isActive" = true
          AND conversation.uuid = $2
          AND conversation."organizationId" = $3
          AND conversation.type = 'GROUP'
          AND conversation."isDeleted" = false
      `,
      [currentUserId, conversationUuid, organizationId],
    );
  }

  private async createGroupConversation({
    organizationId,
    creatorId,
    name,
    memberIds,
  }: CreateGroupConversationArgs): Promise<GroupConversationSummaryRecord> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const conversationResult = await client.query<ConversationRecord>(
        `
          INSERT INTO "Conversation" (
            uuid, type, "organizationId", name, "createdById", "createdAt", "updatedAt"
          )
          VALUES (gen_random_uuid(), 'GROUP', $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `,
        [organizationId, name, creatorId],
      );

      const conversation = conversationResult.rows[0];

      await client.query(
        `
          INSERT INTO "ConversationParticipant" (
            uuid, "conversationId", "userId", role, "joinedAt", "isActive", "createdAt", "updatedAt"
          )
          VALUES (gen_random_uuid(), $1, $2, 'OWNER', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [conversation.id, creatorId],
      );

      for (const memberId of memberIds) {
        await client.query(
          `
            INSERT INTO "ConversationParticipant" (
              uuid, "conversationId", "userId", role, "joinedAt", "isActive", "createdAt", "updatedAt"
            )
            VALUES (gen_random_uuid(), $1, $2, 'MEMBER', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          [conversation.id, memberId],
        );
      }

      await client.query('COMMIT');

      const participantsResult = await this.pool.query<{
        id: number;
        uuid: string;
        name: string;
        email: string;
        profile_pic: string | null;
      }>(
        `
          SELECT u.id, u.uuid, u.name, u.email, u."profile_pic"
          FROM "ConversationParticipant" cp
          INNER JOIN "UserMaster" u ON u.id = cp."userId"
          WHERE cp."conversationId" = $1
            AND cp."isActive" = true
            AND u."isDeleted" = false
          ORDER BY u.name ASC
        `,
        [conversation.id],
      );

      return {
        uuid: conversation.uuid,
        type: 'GROUP',
        name: conversation.name ?? name,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        unreadCount: 0,
        participants: participantsResult.rows.map((p) => ({
          id: p.id,
          uuid: p.uuid,
          name: p.name,
          email: p.email,
          profile_pic_url: p.profile_pic,
        })),
        lastMessage: null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapDirectConversationRow(
    row: DirectConversationRow,
  ): DirectConversationSummaryRecord {
    return {
      uuid: row.conversation_uuid,
      type: row.conversation_type,
      createdAt: row.conversation_created_at,
      updatedAt: row.conversation_updated_at,
      unreadCount: parseInt(row.unread_count, 10),
      otherParticipant: {
        id: row.other_user_id,
        uuid: row.other_user_uuid,
        name: row.other_user_name,
        email: row.other_user_email,
        profile_pic_url: row.other_user_profile_pic,
      },
      lastMessage: row.last_message_uuid
        ? {
            uuid: row.last_message_uuid,
            content: row.last_message_content,
            type: row.last_message_type ?? 'TEXT',
            createdAt:
              row.last_message_created_at ?? row.conversation_created_at,
          }
        : null,
    };
  }

  private mapDirectMessageRow(row: DirectMessageRow): DirectMessageRecord {
    return {
      uuid: row.message_uuid,
      conversationId: row.conversation_id,
      conversationUuid: row.conversation_uuid,
      senderId: row.sender_id,
      senderUuid: row.sender_uuid,
      senderName: row.sender_name,
      content: row.message_content,
      type: row.message_type,
      createdAt: row.message_created_at,
      updatedAt: row.message_updated_at,
      isOwnMessage: row.is_own_message,
      status: row.message_status === 'read' ? 'read' : 'sent',
      readAt: row.message_read_at ?? null,
      attachments: (row.message_attachments ?? []).map((a) => ({
        uuid: a.uuid,
        attachmentType: a.type as MessageAttachmentRecord['attachmentType'],
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: typeof a.sizeBytes === 'string' ? parseInt(a.sizeBytes, 10) : a.sizeBytes,
      })),
      replyTo: row.parent_message_uuid
        ? {
            uuid: row.parent_message_uuid,
            senderName: row.parent_sender_name ?? '',
            content: row.parent_message_content,
            attachmentType: row.parent_message_type !== 'TEXT' ? row.parent_message_type : null,
          }
        : null,
    };
  }

  private mapNotificationRow(row: NotificationRow): UserNotificationRecord {
    return {
      uuid: row.notification_uuid,
      type: row.notification_type,
      title: row.notification_title,
      body: row.notification_body,
      isRead: row.notification_is_read,
      readAt: row.notification_read_at,
      createdAt: row.notification_created_at,
      conversationUuid: row.conversation_uuid,
      messageUuid: row.message_uuid,
      metadata: row.notification_metadata,
    };
  }
}
