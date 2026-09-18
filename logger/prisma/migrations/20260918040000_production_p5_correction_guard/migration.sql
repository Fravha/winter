DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM production_work_corrections)
     OR EXISTS (SELECT 1 FROM production_works WHERE version <> 0) THEN
    RAISE EXCEPTION 'P5 correction guard requires version-zero works and no pre-guard corrections';
  END IF;
END;
$$;

ALTER TABLE production_work_corrections
  ADD COLUMN from_version INTEGER NOT NULL,
  ADD COLUMN to_version INTEGER NOT NULL;
ALTER TABLE production_work_corrections
  ADD CONSTRAINT production_work_corrections_version_check CHECK (from_version >= 0 AND to_version = from_version + 1);
CREATE UNIQUE INDEX production_work_corrections_work_to_version_key ON production_work_corrections (production_work_id, to_version);
CREATE INDEX production_work_corrections_work_version_idx ON production_work_corrections (production_work_id, from_version, to_version);

CREATE OR REPLACE FUNCTION "production_work_correction_update_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  correction_id UUID;
  correction_field TEXT;
  correction_previous JSONB;
  correction_new JSONB;
  correction_from_version INTEGER;
  correction_to_version INTEGER;
  changed_count INTEGER;
  expected_previous JSONB;
  expected_new JSONB;
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.production_order_id IS DISTINCT FROM NEW.production_order_id
     OR OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Immutable ProductionWork fields cannot be changed';
  END IF;

  BEGIN
    correction_id := current_setting('app.production_work_correction_id', true)::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    correction_id := NULL;
  END;
  IF correction_id IS NULL THEN
    RAISE EXCEPTION 'ProductionWork updates require an authorized correction';
  END IF;

  SELECT field, previous_value, new_value, from_version, to_version
    INTO correction_field, correction_previous, correction_new, correction_from_version, correction_to_version
    FROM production_work_corrections
   WHERE id = correction_id
     AND production_work_id = OLD.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction does not authorize this ProductionWork';
  END IF;
  IF correction_from_version <> OLD.version OR correction_to_version <> NEW.version THEN
    RAISE EXCEPTION 'Correction version does not match the materialized update';
  END IF;

  changed_count :=
    (OLD.transformation_order_id IS DISTINCT FROM NEW.transformation_order_id)::INTEGER +
    (OLD.work_type_id IS DISTINCT FROM NEW.work_type_id)::INTEGER +
    (OLD.performed_at IS DISTINCT FROM NEW.performed_at)::INTEGER +
    (OLD.observations IS DISTINCT FROM NEW.observations)::INTEGER;
  IF changed_count <> 1 OR NEW.version <> OLD.version + 1
     OR NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    RAISE EXCEPTION 'Correction must change exactly one business field and increment version';
  END IF;

  IF correction_field = 'transformationOrderId' THEN
    expected_previous := COALESCE(to_jsonb(OLD.transformation_order_id), 'null'::jsonb);
    expected_new := COALESCE(to_jsonb(NEW.transformation_order_id), 'null'::jsonb);
  ELSIF correction_field = 'workTypeId' THEN
    expected_previous := to_jsonb(OLD.work_type_id);
    expected_new := to_jsonb(NEW.work_type_id);
  ELSIF correction_field = 'performedAt' THEN
    expected_previous := to_jsonb(to_char(OLD.performed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    expected_new := to_jsonb(to_char(NEW.performed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  ELSIF correction_field = 'observations' THEN
    expected_previous := COALESCE(to_jsonb(OLD.observations), 'null'::jsonb);
    expected_new := COALESCE(to_jsonb(NEW.observations), 'null'::jsonb);
  ELSE
    RAISE EXCEPTION 'Correction field is not permitted';
  END IF;
  IF correction_field = 'performedAt' THEN
    IF (correction_previous #>> '{}') IS DISTINCT FROM (expected_previous #>> '{}')
       OR (correction_new #>> '{}') IS DISTINCT FROM (expected_new #>> '{}') THEN
      RAISE EXCEPTION 'Correction values do not match the materialized update';
    END IF;
  ELSIF correction_previous IS DISTINCT FROM expected_previous
     OR correction_new IS DISTINCT FROM expected_new THEN
    RAISE EXCEPTION 'Correction values do not match the materialized update';
  END IF;
  IF (correction_field = 'transformationOrderId' AND OLD.transformation_order_id IS NOT DISTINCT FROM NEW.transformation_order_id)
     OR (correction_field = 'workTypeId' AND OLD.work_type_id IS NOT DISTINCT FROM NEW.work_type_id)
     OR (correction_field = 'performedAt' AND OLD.performed_at IS NOT DISTINCT FROM NEW.performed_at)
     OR (correction_field = 'observations' AND OLD.observations IS NOT DISTINCT FROM NEW.observations) THEN
    RAISE EXCEPTION 'No-op corrections are not permitted';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "production_works_correction_update_guard"
BEFORE UPDATE ON "production_works"
FOR EACH ROW EXECUTE FUNCTION "production_work_correction_update_guard"();

CREATE OR REPLACE FUNCTION "production_work_correction_commit_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_version INTEGER;
BEGIN
  SELECT version INTO target_version FROM production_works WHERE id = NEW.production_work_id;
  IF target_version IS NULL OR target_version < NEW.to_version THEN
    RAISE EXCEPTION 'Correction target version was not materialized';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER "production_work_correction_commit_guard"
AFTER INSERT ON production_work_corrections
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "production_work_correction_commit_guard"();