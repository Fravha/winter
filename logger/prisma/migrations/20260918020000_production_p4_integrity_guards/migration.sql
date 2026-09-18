ALTER TABLE "production_container_occupancies"
  ADD CONSTRAINT "production_container_occupancies_closed_after_opened"
  CHECK ("closed_at" IS NULL OR "closed_at" >= "opened_at");

ALTER TABLE "production_batch_container_movements"
  ADD CONSTRAINT "production_batch_container_movements_shape"
  CHECK (
    ("movement_type" = 'ASSIGNED' AND "source_container_id" IS NULL AND "destination_batch_id" IS NULL)
    OR ("movement_type" = 'TRANSFERRED' AND "source_container_id" IS NOT NULL AND "destination_batch_id" IS NULL)
    OR ("movement_type" = 'PARTIAL_TRANSFERRED' AND "source_container_id" IS NOT NULL AND "destination_batch_id" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION "production_container_occupancy_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Production container occupancy history cannot be deleted';
  END IF;

  IF OLD.closed_at IS NOT NULL
     OR NEW.container_id <> OLD.container_id
     OR NEW.batch_id <> OLD.batch_id
     OR NEW.quantity <> OLD.quantity
     OR NEW.unit <> OLD.unit
     OR NEW.opened_at <> OLD.opened_at
     OR NEW.closed_at IS NULL
     OR NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Production container occupancy history is immutable except for closing an open record';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "production_container_occupancies_history_guard"
BEFORE UPDATE OR DELETE ON "production_container_occupancies"
FOR EACH ROW EXECUTE FUNCTION "production_container_occupancy_guard"();