CREATE TYPE "AttachmentEntityType" AS ENUM ('GRAPE_RECEPTION', 'PRODUCTION_WORK', 'MEASUREMENT', 'TRANSFORMATION', 'PRODUCTION_LOSS');
CREATE TYPE "StorageProvider" AS ENUM ('SUPABASE');

CREATE TABLE "attachments" (
  "id" UUID NOT NULL,
  "entity_type" "AttachmentEntityType" NOT NULL,
  "entity_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "storage_provider" "StorageProvider" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "uploaded_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observations" TEXT,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");
CREATE INDEX "attachments_uploaded_by_user_id_idx" ON "attachments"("uploaded_by_user_id");
CREATE INDEX "attachments_created_at_idx" ON "attachments"("created_at");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'attachments:read', 'Read attachments', 'Read attachment metadata and signed download URLs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'attachments:create', 'Create attachments', 'Upload attachment evidence for supported Production entities', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;