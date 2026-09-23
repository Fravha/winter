-- P5.5B: additive operational metadata and structured ProcessMovement context.
-- type is nullable during the legacy phase: existing containers are not assigned
-- a guessed type. New API-created containers must provide one.
CREATE TYPE "ProductionContainerType" AS ENUM ('TANQUE', 'BARRICA', 'OTRO');

ALTER TABLE "production_containers"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "type" "ProductionContainerType",
  ADD COLUMN "location" TEXT,
  ADD COLUMN "material" TEXT;

ALTER TABLE "production_batch_container_movements"
  ADD COLUMN "production_work_id" UUID,
  ADD COLUMN "observations" TEXT;

ALTER TABLE "production_batch_container_movements"
  ADD CONSTRAINT "production_batch_container_movements_production_work_id_fkey"
  FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "production_batch_container_movements_work_idx"
  ON "production_batch_container_movements"("production_work_id", "occurred_at");

CREATE OR REPLACE FUNCTION "production_container_code_immutable_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Production container code is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "production_containers_code_immutable"
BEFORE UPDATE ON "production_containers"
FOR EACH ROW EXECUTE FUNCTION "production_container_code_immutable_guard"();

ALTER TABLE "production_batch_container_movements"
  ADD CONSTRAINT "production_batch_container_movements_observations_length"
  CHECK ("observations" IS NULL OR char_length("observations") <= 2000) NOT VALID;