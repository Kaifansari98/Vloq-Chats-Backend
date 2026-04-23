-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "OrganizationMaster" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT,
    "countryCode" TEXT,
    "logo" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTypeMaster" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTypeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMaster" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" INTEGER NOT NULL,
    "userTypeId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "deletedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAuthProvider" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMaster_uuid_key" ON "OrganizationMaster"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMaster_slug_key" ON "OrganizationMaster"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMaster_slug_idx" ON "OrganizationMaster"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserTypeMaster_uuid_key" ON "UserTypeMaster"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "UserTypeMaster_code_key" ON "UserTypeMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserMaster_uuid_key" ON "UserMaster"("uuid");

-- CreateIndex
CREATE INDEX "UserMaster_organizationId_idx" ON "UserMaster"("organizationId");

-- CreateIndex
CREATE INDEX "UserMaster_organizationId_isDeleted_idx" ON "UserMaster"("organizationId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "UserMaster_email_organizationId_key" ON "UserMaster"("email", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthProvider_uuid_key" ON "UserAuthProvider"("uuid");

-- CreateIndex
CREATE INDEX "UserAuthProvider_userId_idx" ON "UserAuthProvider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthProvider_provider_providerId_key" ON "UserAuthProvider"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "OrganizationMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_userTypeId_fkey" FOREIGN KEY ("userTypeId") REFERENCES "UserTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "UserMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuthProvider" ADD CONSTRAINT "UserAuthProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
