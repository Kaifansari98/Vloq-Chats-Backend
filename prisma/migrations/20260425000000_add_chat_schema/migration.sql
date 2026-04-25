-- ============================================================
--  Chat schema migration
--  Tables: Conversation, ConversationParticipant, Message,
--          MessageAttachment, MessageMention, MessageReaction
-- ============================================================

-- Enums
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "ConversationRole"  AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MessageType"       AS ENUM ('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'SYSTEM');
CREATE TYPE "AttachmentType"    AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER');


-- ── 1. Conversation ────────────────────────────────────────
-- Unified table for both 1-to-1 and group chats.
-- directKey = sorted "{userAId}_{userBId}" ensures at most one
-- DM per pair within an org (enforced by the unique index).
CREATE TABLE "Conversation" (
    "id"             SERIAL       NOT NULL,
    "uuid"           TEXT         NOT NULL,
    "type"           "ConversationType" NOT NULL,
    "organizationId" INTEGER      NOT NULL,

    -- group-only fields (null for DIRECT)
    "name"           TEXT,
    "description"    TEXT,
    "avatar"         TEXT,

    -- prevents duplicate DM conversations between the same two users
    "directKey"      TEXT,

    "isActive"       BOOLEAN      NOT NULL DEFAULT true,
    "createdById"    INTEGER      NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted"      BOOLEAN      NOT NULL DEFAULT false,
    "deletedAt"      TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);


-- ── 2. Message ─────────────────────────────────────────────
-- Created before ConversationParticipant so lastReadMessageId
-- FK can reference it without a deferred constraint.
CREATE TABLE "Message" (
    "id"              SERIAL       NOT NULL,
    "uuid"            TEXT         NOT NULL,
    "conversationId"  INTEGER      NOT NULL,
    "senderId"        INTEGER      NOT NULL,
    "type"            "MessageType" NOT NULL DEFAULT 'TEXT',

    -- null for pure-attachment messages
    "content"         TEXT,

    -- reply-to support (thread root = null)
    "parentMessageId" INTEGER,

    -- extensible: link previews, poll data, etc.
    "metadata"        JSONB,

    "isEdited"        BOOLEAN      NOT NULL DEFAULT false,
    "editedAt"        TIMESTAMP(3),

    "isDeleted"       BOOLEAN      NOT NULL DEFAULT false,
    "deletedAt"       TIMESTAMP(3),
    "deletedById"     INTEGER,

    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);


-- ── 3. ConversationParticipant ────────────────────────────
CREATE TABLE "ConversationParticipant" (
    "id"                  SERIAL              NOT NULL,
    "uuid"                TEXT                NOT NULL,
    "conversationId"      INTEGER             NOT NULL,
    "userId"              INTEGER             NOT NULL,
    "role"                "ConversationRole"  NOT NULL DEFAULT 'MEMBER',

    "joinedAt"            TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt"              TIMESTAMP(3),
    "isActive"            BOOLEAN             NOT NULL DEFAULT true,

    -- tracks read cursor for unread-count queries
    "lastReadAt"          TIMESTAMP(3),
    "lastReadMessageId"   INTEGER,

    "createdAt"           TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);


-- ── 4. MessageAttachment ──────────────────────────────────
CREATE TABLE "MessageAttachment" (
    "id"           SERIAL          NOT NULL,
    "uuid"         TEXT            NOT NULL,
    "messageId"    INTEGER         NOT NULL,
    "type"         "AttachmentType" NOT NULL,
    "name"         TEXT            NOT NULL,   -- original filename
    "url"          TEXT            NOT NULL,   -- storage URL (S3/Wasabi/etc.)
    "mimeType"     TEXT            NOT NULL,
    "size"         BIGINT          NOT NULL,   -- bytes

    -- image / video dimensions
    "width"        INTEGER,
    "height"       INTEGER,

    -- audio / video duration in seconds
    "duration"     INTEGER,

    "thumbnailUrl" TEXT,

    "createdAt"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);


-- ── 5. MessageMention ─────────────────────────────────────
-- Stores every @mention in a message with its exact position in
-- the content string so the UI can highlight it without parsing.
CREATE TABLE "MessageMention" (
    "id"              SERIAL       NOT NULL,
    "messageId"       INTEGER      NOT NULL,
    "mentionedUserId" INTEGER      NOT NULL,
    "offset"          INTEGER      NOT NULL,  -- char index in content
    "length"          INTEGER      NOT NULL,  -- length of the @handle text
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageMention_pkey" PRIMARY KEY ("id")
);


-- ── 6. MessageReaction ────────────────────────────────────
CREATE TABLE "MessageReaction" (
    "id"        SERIAL       NOT NULL,
    "messageId" INTEGER      NOT NULL,
    "userId"    INTEGER      NOT NULL,
    "emoji"     TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);


-- ────────────────────────────────────────────────────────────
--  Unique indexes
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "Conversation_uuid_key"
    ON "Conversation"("uuid");

-- Only one DM conversation per ordered pair of users (per org)
CREATE UNIQUE INDEX "Conversation_directKey_key"
    ON "Conversation"("directKey");

CREATE UNIQUE INDEX "ConversationParticipant_uuid_key"
    ON "ConversationParticipant"("uuid");

-- A user can only be a participant once per conversation
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key"
    ON "ConversationParticipant"("conversationId", "userId");

CREATE UNIQUE INDEX "Message_uuid_key"
    ON "Message"("uuid");

CREATE UNIQUE INDEX "MessageAttachment_uuid_key"
    ON "MessageAttachment"("uuid");

-- A user can react with the same emoji only once per message
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key"
    ON "MessageReaction"("messageId", "userId", "emoji");


-- ────────────────────────────────────────────────────────────
--  Performance indexes
-- ────────────────────────────────────────────────────────────

-- Conversation lookup by org
CREATE INDEX "Conversation_organizationId_idx"
    ON "Conversation"("organizationId");
CREATE INDEX "Conversation_organizationId_type_idx"
    ON "Conversation"("organizationId", "type");

-- Participant lookup
CREATE INDEX "ConversationParticipant_userId_idx"
    ON "ConversationParticipant"("userId");
CREATE INDEX "ConversationParticipant_conversationId_idx"
    ON "ConversationParticipant"("conversationId");

-- Message feed (primary query: latest messages in a conversation)
CREATE INDEX "Message_conversationId_createdAt_idx"
    ON "Message"("conversationId", "createdAt" DESC);
CREATE INDEX "Message_senderId_idx"
    ON "Message"("senderId");
CREATE INDEX "Message_parentMessageId_idx"
    ON "Message"("parentMessageId");
-- Used for unread count: WHERE conversationId = X AND isDeleted = false AND id > lastReadMessageId
CREATE INDEX "Message_conversationId_isDeleted_idx"
    ON "Message"("conversationId", "isDeleted");

-- Attachment / mention / reaction lookups
CREATE INDEX "MessageAttachment_messageId_idx"
    ON "MessageAttachment"("messageId");
CREATE INDEX "MessageMention_messageId_idx"
    ON "MessageMention"("messageId");
CREATE INDEX "MessageMention_mentionedUserId_idx"
    ON "MessageMention"("mentionedUserId");
CREATE INDEX "MessageReaction_messageId_idx"
    ON "MessageReaction"("messageId");


-- ────────────────────────────────────────────────────────────
--  Foreign keys — Conversation
-- ────────────────────────────────────────────────────────────
ALTER TABLE "Conversation"
    ADD CONSTRAINT "Conversation_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "OrganizationMaster"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
    ADD CONSTRAINT "Conversation_createdById_fkey"
    FOREIGN KEY ("createdById")
    REFERENCES "UserMaster"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
--  Foreign keys — Message
-- ────────────────────────────────────────────────────────────
ALTER TABLE "Message"
    ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId")
    REFERENCES "Conversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
    ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId")
    REFERENCES "UserMaster"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Message"
    ADD CONSTRAINT "Message_parentMessageId_fkey"
    FOREIGN KEY ("parentMessageId")
    REFERENCES "Message"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message"
    ADD CONSTRAINT "Message_deletedById_fkey"
    FOREIGN KEY ("deletedById")
    REFERENCES "UserMaster"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
--  Foreign keys — ConversationParticipant
-- ────────────────────────────────────────────────────────────
ALTER TABLE "ConversationParticipant"
    ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
    FOREIGN KEY ("conversationId")
    REFERENCES "Conversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
    ADD CONSTRAINT "ConversationParticipant_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "UserMaster"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
    ADD CONSTRAINT "ConversationParticipant_lastReadMessageId_fkey"
    FOREIGN KEY ("lastReadMessageId")
    REFERENCES "Message"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
--  Foreign keys — MessageAttachment
-- ────────────────────────────────────────────────────────────
ALTER TABLE "MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId")
    REFERENCES "Message"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
--  Foreign keys — MessageMention
-- ────────────────────────────────────────────────────────────
ALTER TABLE "MessageMention"
    ADD CONSTRAINT "MessageMention_messageId_fkey"
    FOREIGN KEY ("messageId")
    REFERENCES "Message"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageMention"
    ADD CONSTRAINT "MessageMention_mentionedUserId_fkey"
    FOREIGN KEY ("mentionedUserId")
    REFERENCES "UserMaster"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
--  Foreign keys — MessageReaction
-- ────────────────────────────────────────────────────────────
ALTER TABLE "MessageReaction"
    ADD CONSTRAINT "MessageReaction_messageId_fkey"
    FOREIGN KEY ("messageId")
    REFERENCES "Message"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReaction"
    ADD CONSTRAINT "MessageReaction_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "UserMaster"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
