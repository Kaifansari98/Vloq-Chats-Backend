CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "UserPushToken" (
  "id" SERIAL NOT NULL,
  "uuid" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'WEB',
  "userAgent" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserPushToken_uuid_key" ON "UserPushToken"("uuid");
CREATE UNIQUE INDEX "UserPushToken_token_key" ON "UserPushToken"("token");
CREATE INDEX "UserPushToken_userId_idx" ON "UserPushToken"("userId");
CREATE INDEX "UserPushToken_userId_platform_idx" ON "UserPushToken"("userId", "platform");
