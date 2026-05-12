CREATE TYPE "UploadResourceType" AS ENUM ('WASABI_S3', 'SERVER_STORAGE');

ALTER TABLE "OrganizationMaster"
  ADD COLUMN "fileUpload" "UploadResourceType" NOT NULL DEFAULT 'SERVER_STORAGE';
