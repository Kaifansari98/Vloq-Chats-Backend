-- Add IP restriction flag to OrganizationMaster
ALTER TABLE "OrganizationMaster"
  ADD COLUMN "isIpRestrictionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Create OrgRestrictedIpMapping table
CREATE TABLE "OrgRestrictedIpMapping" (
    "id"             SERIAL          NOT NULL,
    "uuid"           TEXT            NOT NULL,
    "organizationId" INTEGER         NOT NULL,
    "ipAddress"      TEXT            NOT NULL,
    "label"          TEXT,
    "createdAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgRestrictedIpMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgRestrictedIpMapping_uuid_key"
  ON "OrgRestrictedIpMapping"("uuid");

CREATE UNIQUE INDEX "OrgRestrictedIpMapping_organizationId_ipAddress_key"
  ON "OrgRestrictedIpMapping"("organizationId", "ipAddress");

CREATE INDEX "OrgRestrictedIpMapping_organizationId_idx"
  ON "OrgRestrictedIpMapping"("organizationId");

ALTER TABLE "OrgRestrictedIpMapping"
  ADD CONSTRAINT "OrgRestrictedIpMapping_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "OrganizationMaster"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
