ALTER TABLE "production_works"
  ADD COLUMN "transformation_order_id" UUID,
  ADD COLUMN "work_type_id" UUID,
  ADD COLUMN "performed_at" TIMESTAMP(3),
  ADD COLUMN "observations" TEXT,
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "production_works" LIMIT 1) THEN
    RAISE EXCEPTION 'Existing production works require P5 backfill before migration';
  END IF;
END $$;

ALTER TABLE "production_works"
  ALTER COLUMN "transformation_order_id" DROP DEFAULT,
  ALTER COLUMN "work_type_id" SET NOT NULL,
  ALTER COLUMN "performed_at" SET NOT NULL,
  ALTER COLUMN "created_by_user_id" SET NOT NULL;

CREATE TABLE "production_work_batches" (
  "production_work_id" UUID NOT NULL,
  "production_batch_id" UUID NOT NULL,
  CONSTRAINT "production_work_batches_pkey" PRIMARY KEY ("production_work_id","production_batch_id")
);
CREATE INDEX "production_work_batches_production_batch_id_idx" ON "production_work_batches"("production_batch_id");

CREATE TABLE "production_work_containers" (
  "production_work_id" UUID NOT NULL,
  "production_container_id" UUID NOT NULL,
  CONSTRAINT "production_work_containers_pkey" PRIMARY KEY ("production_work_id","production_container_id")
);
CREATE INDEX "production_work_containers_production_container_id_idx" ON "production_work_containers"("production_container_id");

CREATE TABLE "production_work_participants" (
  "production_work_id" UUID NOT NULL,
  "production_participant_id" UUID NOT NULL,
  "role" TEXT,
  CONSTRAINT "production_work_participants_pkey" PRIMARY KEY ("production_work_id","production_participant_id"),
  CONSTRAINT "production_work_participants_role_not_blank" CHECK ("role" IS NULL OR length(btrim("role")) > 0)
);
CREATE INDEX "production_work_participants_production_participant_id_idx" ON "production_work_participants"("production_participant_id");

CREATE TABLE "production_work_corrections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_work_id" UUID NOT NULL,
  "field" TEXT NOT NULL,
  "previous_value" JSONB NOT NULL,
  "new_value" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "corrected_at" TIMESTAMP(3) NOT NULL,
  "actor_user_id" UUID NOT NULL,
  CONSTRAINT "production_work_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_work_corrections_field" CHECK ("field" IN ('performedAt','workTypeId','transformationOrderId','observations')),
  CONSTRAINT "production_work_corrections_reason" CHECK (length(btrim("reason")) > 0)
);
CREATE INDEX "production_work_corrections_production_work_id_corrected_at_idx" ON "production_work_corrections"("production_work_id","corrected_at");

ALTER TABLE "production_works"
  ADD CONSTRAINT "production_works_transformation_order_id_fkey" FOREIGN KEY ("transformation_order_id") REFERENCES "transformation_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_works_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "production_work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_works_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_work_batches"
  ADD CONSTRAINT "production_work_batches_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_batches_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_work_containers"
  ADD CONSTRAINT "production_work_containers_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_containers_production_container_id_fkey" FOREIGN KEY ("production_container_id") REFERENCES "production_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_work_participants"
  ADD CONSTRAINT "production_work_participants_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_participants_production_participant_id_fkey" FOREIGN KEY ("production_participant_id") REFERENCES "production_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_work_corrections"
  ADD CONSTRAINT "production_work_corrections_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_corrections_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "production_work_history_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Production work history is append-only';
END;
$$;
CREATE TRIGGER "production_work_batches_append_only" BEFORE UPDATE OR DELETE ON "production_work_batches" FOR EACH ROW EXECUTE FUNCTION "production_work_history_guard"();
CREATE TRIGGER "production_work_containers_append_only" BEFORE UPDATE OR DELETE ON "production_work_containers" FOR EACH ROW EXECUTE FUNCTION "production_work_history_guard"();
CREATE TRIGGER "production_work_participants_append_only" BEFORE UPDATE OR DELETE ON "production_work_participants" FOR EACH ROW EXECUTE FUNCTION "production_work_history_guard"();
CREATE TRIGGER "production_work_corrections_append_only" BEFORE UPDATE OR DELETE ON "production_work_corrections" FOR EACH ROW EXECUTE FUNCTION "production_work_history_guard"();

CREATE OR REPLACE FUNCTION "production_work_delete_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Production work history cannot be deleted';
END;
$$;
CREATE TRIGGER "production_works_no_delete" BEFORE DELETE ON "production_works" FOR EACH ROW EXECUTE FUNCTION "production_work_delete_guard"();