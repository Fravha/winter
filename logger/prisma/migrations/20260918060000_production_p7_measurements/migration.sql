CREATE TABLE "production_measurements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "measurement_type_id" UUID NOT NULL,
  "production_batch_id" UUID,
  "production_container_id" UUID,
  "production_work_id" UUID,
  "participant_id" UUID,
  "value" DECIMAL(18,6) NOT NULL,
  "unit" TEXT NOT NULL,
  "measured_at" TIMESTAMP(3) NOT NULL,
  "observations" TEXT,
  "actor_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_measurements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_measurements_context_check" CHECK ("production_batch_id" IS NOT NULL OR "production_container_id" IS NOT NULL OR "production_work_id" IS NOT NULL),
  CONSTRAINT "production_measurements_unit_check" CHECK (length(btrim("unit")) > 0)
);
CREATE INDEX "production_measurements_measurement_type_id_measured_at_id_idx" ON "production_measurements"("measurement_type_id","measured_at","id");
CREATE INDEX "production_measurements_production_batch_id_measured_at_idx" ON "production_measurements"("production_batch_id","measured_at");
CREATE INDEX "production_measurements_production_container_id_measured_at_idx" ON "production_measurements"("production_container_id","measured_at");
CREATE INDEX "production_measurements_production_work_id_measured_at_idx" ON "production_measurements"("production_work_id","measured_at");
ALTER TABLE "production_measurements"
 ADD CONSTRAINT "production_measurements_measurement_type_id_fkey" FOREIGN KEY ("measurement_type_id") REFERENCES "production_measurement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "production_measurements_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "production_measurements_production_container_id_fkey" FOREIGN KEY ("production_container_id") REFERENCES "production_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "production_measurements_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "production_measurements_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "production_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "production_measurements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION "production_measurement_history_guard"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Production measurements are append-only'; END; $$;
CREATE TRIGGER "production_measurements_append_only" BEFORE UPDATE OR DELETE ON "production_measurements" FOR EACH ROW EXECUTE FUNCTION "production_measurement_history_guard"();
INSERT INTO "permissions" ("id","code","name","description","created_at","updated_at") VALUES (gen_random_uuid(),'production:measurement_create','Create production measurements','Create append-only production measurements',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("code") DO NOTHING;