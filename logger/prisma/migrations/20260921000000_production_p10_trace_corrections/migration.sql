ALTER TABLE "production_measurements" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "grape_receptions" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "production_measurement_corrections" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "production_measurement_id" UUID NOT NULL, "field" TEXT NOT NULL,
 "previous_value" JSONB NOT NULL, "new_value" JSONB NOT NULL, "reason" TEXT NOT NULL, "corrected_at" TIMESTAMP(3) NOT NULL,
 "actor_user_id" UUID NOT NULL, "from_version" INTEGER NOT NULL, "to_version" INTEGER NOT NULL,
 "operation_key" TEXT NOT NULL, "request_hash" TEXT NOT NULL, "result" JSONB NOT NULL,
 CONSTRAINT "production_measurement_corrections_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "production_measurement_corrections_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1),
 CONSTRAINT "production_measurement_corrections_reason_check" CHECK (length(btrim("reason")) > 0)
);
CREATE UNIQUE INDEX "production_measurement_corrections_operation_key_key" ON "production_measurement_corrections"("operation_key");
CREATE UNIQUE INDEX "production_measurement_corrections_measurement_to_version_key" ON "production_measurement_corrections"("production_measurement_id","to_version");
CREATE INDEX "production_measurement_corrections_production_measurement_i_idx" ON "production_measurement_corrections"("production_measurement_id","corrected_at");
ALTER TABLE "production_measurement_corrections" ADD CONSTRAINT "production_measurement_corrections_production_measurement__fkey" FOREIGN KEY ("production_measurement_id") REFERENCES "production_measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT "production_measurement_corrections_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "grape_reception_corrections" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "grape_reception_id" UUID NOT NULL, "field" TEXT NOT NULL,
 "previous_value" JSONB NOT NULL, "new_value" JSONB NOT NULL, "reason" TEXT NOT NULL, "corrected_at" TIMESTAMP(3) NOT NULL,
 "actor_user_id" UUID NOT NULL, "from_version" INTEGER NOT NULL, "to_version" INTEGER NOT NULL,
 "operation_key" TEXT NOT NULL, "request_hash" TEXT NOT NULL, "result" JSONB NOT NULL,
 CONSTRAINT "grape_reception_corrections_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "grape_reception_corrections_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1),
 CONSTRAINT "grape_reception_corrections_reason_check" CHECK (length(btrim("reason")) > 0)
);
CREATE UNIQUE INDEX "grape_reception_corrections_operation_key_key" ON "grape_reception_corrections"("operation_key");
CREATE UNIQUE INDEX "grape_reception_corrections_reception_to_version_key" ON "grape_reception_corrections"("grape_reception_id","to_version");
CREATE INDEX "grape_reception_corrections_grape_reception_id_corrected_at_idx" ON "grape_reception_corrections"("grape_reception_id","corrected_at");
ALTER TABLE "grape_reception_corrections" ADD CONSTRAINT "grape_reception_corrections_grape_reception_id_fkey" FOREIGN KEY ("grape_reception_id") REFERENCES "grape_receptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT "grape_reception_corrections_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS "production_measurements_append_only" ON "production_measurements";
DROP TRIGGER IF EXISTS "grape_receptions_history_guard" ON "grape_receptions";
CREATE OR REPLACE FUNCTION "production_p10_measurement_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid UUID; c RECORD; BEGIN
 IF OLD.id IS DISTINCT FROM NEW.id OR OLD.actor_user_id IS DISTINCT FROM NEW.actor_user_id OR OLD.created_at IS DISTINCT FROM NEW.created_at OR OLD.measurement_type_id IS DISTINCT FROM NEW.measurement_type_id OR OLD.production_batch_id IS DISTINCT FROM NEW.production_batch_id OR OLD.production_container_id IS DISTINCT FROM NEW.production_container_id OR OLD.production_work_id IS DISTINCT FROM NEW.production_work_id THEN RAISE EXCEPTION 'Immutable measurement fields cannot change'; END IF;
 BEGIN cid := current_setting('app.production_measurement_correction_id',true)::uuid; EXCEPTION WHEN invalid_text_representation THEN cid := NULL; END;
 IF cid IS NULL THEN RAISE EXCEPTION 'Measurement history is append-only; update requires correction'; END IF;
 SELECT * INTO c FROM production_measurement_corrections WHERE id=cid AND production_measurement_id=OLD.id;
 IF NOT FOUND OR c.from_version<>OLD.version OR c.to_version<>NEW.version THEN RAISE EXCEPTION 'Invalid measurement correction'; END IF;
 IF (OLD.value IS NOT DISTINCT FROM NEW.value AND OLD.unit IS NOT DISTINCT FROM NEW.unit AND OLD.measured_at IS NOT DISTINCT FROM NEW.measured_at AND OLD.participant_id IS NOT DISTINCT FROM NEW.participant_id AND OLD.observations IS NOT DISTINCT FROM NEW.observations) OR NEW.version<>OLD.version+1 OR NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN RAISE EXCEPTION 'Invalid measurement correction'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER "production_measurements_p10_guard" BEFORE UPDATE OR DELETE ON "production_measurements" FOR EACH ROW EXECUTE FUNCTION "production_p10_measurement_guard"();
CREATE OR REPLACE FUNCTION "production_p10_reception_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid UUID; c RECORD; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Grape reception history is append-only'; END IF;
 IF OLD.id IS DISTINCT FROM NEW.id OR OLD.actor_user_id IS DISTINCT FROM NEW.actor_user_id OR OLD.created_at IS DISTINCT FROM NEW.created_at OR OLD.production_order_id IS DISTINCT FROM NEW.production_order_id THEN RAISE EXCEPTION 'Immutable reception fields cannot change'; END IF;
 BEGIN cid := current_setting('app.grape_reception_correction_id',true)::uuid; EXCEPTION WHEN invalid_text_representation THEN cid := NULL; END;
 IF cid IS NULL THEN RAISE EXCEPTION 'Grape reception history is append-only; update requires correction'; END IF;
 SELECT * INTO c FROM grape_reception_corrections WHERE id=cid AND grape_reception_id=OLD.id;
 IF NOT FOUND OR c.from_version<>OLD.version OR c.to_version<>NEW.version THEN RAISE EXCEPTION 'Invalid reception correction'; END IF;
 IF (OLD.received_at IS NOT DISTINCT FROM NEW.received_at AND OLD.producer_id IS NOT DISTINCT FROM NEW.producer_id AND OLD.observations IS NOT DISTINCT FROM NEW.observations AND OLD.status IS NOT DISTINCT FROM NEW.status) OR NEW.version<>OLD.version+1 OR NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN RAISE EXCEPTION 'Invalid reception correction'; END IF;
 IF NEW.status='ACCEPTED_WITH_OBSERVATIONS' AND length(btrim(coalesce(NEW.observations,'')))=0 THEN RAISE EXCEPTION 'Observations required'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER "grape_receptions_p10_guard" BEFORE UPDATE OR DELETE ON "grape_receptions" FOR EACH ROW EXECUTE FUNCTION "production_p10_reception_guard"();
CREATE OR REPLACE FUNCTION "production_p10_correction_delete_guard"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Corrections are append-only'; END $$;
CREATE TRIGGER "production_measurement_corrections_append_only" BEFORE UPDATE OR DELETE ON "production_measurement_corrections" FOR EACH ROW EXECUTE FUNCTION "production_p10_correction_delete_guard"();
CREATE TRIGGER "grape_reception_corrections_append_only" BEFORE UPDATE OR DELETE ON "grape_reception_corrections" FOR EACH ROW EXECUTE FUNCTION "production_p10_correction_delete_guard"();
CREATE OR REPLACE FUNCTION "production_p10_measurement_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid UUID; c RECORD; changed INTEGER := 0; expected_old JSONB; expected_new JSONB;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Production measurements are append-only'; END IF;
 IF OLD.id IS DISTINCT FROM NEW.id OR OLD.actor_user_id IS DISTINCT FROM NEW.actor_user_id OR OLD.created_at IS DISTINCT FROM NEW.created_at OR OLD.measurement_type_id IS DISTINCT FROM NEW.measurement_type_id OR OLD.production_batch_id IS DISTINCT FROM NEW.production_batch_id OR OLD.production_container_id IS DISTINCT FROM NEW.production_container_id OR OLD.production_work_id IS DISTINCT FROM NEW.production_work_id THEN RAISE EXCEPTION 'Immutable measurement fields cannot change'; END IF;
 BEGIN cid := current_setting('app.production_measurement_correction_id',true)::uuid; EXCEPTION WHEN invalid_text_representation THEN cid := NULL; END;
 IF cid IS NULL THEN RAISE EXCEPTION 'Measurement history is append-only; update requires correction'; END IF;
 SELECT * INTO c FROM production_measurement_corrections WHERE id=cid AND production_measurement_id=OLD.id;
 IF NOT FOUND OR c.actor_user_id IS NULL OR c.from_version<>OLD.version OR c.to_version<>NEW.version THEN RAISE EXCEPTION 'Invalid measurement correction'; END IF;
 changed := (OLD.value IS DISTINCT FROM NEW.value)::int + (OLD.unit IS DISTINCT FROM NEW.unit)::int + (OLD.measured_at IS DISTINCT FROM NEW.measured_at)::int + (OLD.participant_id IS DISTINCT FROM NEW.participant_id)::int + (OLD.observations IS DISTINCT FROM NEW.observations)::int;
 IF changed<>1 OR NEW.version<>OLD.version+1 OR NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN RAISE EXCEPTION 'Exactly one measurement field must change'; END IF;
 IF c.field='value' THEN expected_old:=to_jsonb(to_char(OLD.value,'FM9999999999999999990.000000')); expected_new:=to_jsonb(to_char(NEW.value,'FM9999999999999999990.000000'));
 ELSIF c.field='unit' THEN expected_old:=to_jsonb(OLD.unit); expected_new:=to_jsonb(NEW.unit);
 ELSIF c.field='measuredAt' THEN expected_old:=to_jsonb(to_char(OLD.measured_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')); expected_new:=to_jsonb(to_char(NEW.measured_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 ELSIF c.field='participantId' THEN expected_old:=coalesce(to_jsonb(OLD.participant_id),'null'::jsonb); expected_new:=coalesce(to_jsonb(NEW.participant_id),'null'::jsonb);
 ELSIF c.field='observations' THEN expected_old:=coalesce(to_jsonb(OLD.observations),'null'::jsonb); expected_new:=coalesce(to_jsonb(NEW.observations),'null'::jsonb);
 ELSE RAISE EXCEPTION 'Measurement correction field is not permitted'; END IF;
 IF c.previous_value IS DISTINCT FROM expected_old OR c.new_value IS DISTINCT FROM expected_new THEN RAISE EXCEPTION 'Measurement correction values do not match'; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION "production_p10_reception_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid UUID; c RECORD; changed INTEGER := 0; expected_old JSONB; expected_new JSONB;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Grape reception history is append-only'; END IF;
 IF OLD.id IS DISTINCT FROM NEW.id OR OLD.actor_user_id IS DISTINCT FROM NEW.actor_user_id OR OLD.created_at IS DISTINCT FROM NEW.created_at OR OLD.production_order_id IS DISTINCT FROM NEW.production_order_id THEN RAISE EXCEPTION 'Immutable reception fields cannot change'; END IF;
 BEGIN cid := current_setting('app.grape_reception_correction_id',true)::uuid; EXCEPTION WHEN invalid_text_representation THEN cid := NULL; END;
 IF cid IS NULL THEN RAISE EXCEPTION 'Reception update requires correction'; END IF;
 SELECT * INTO c FROM grape_reception_corrections WHERE id=cid AND grape_reception_id=OLD.id;
 IF NOT FOUND OR c.from_version<>OLD.version OR c.to_version<>NEW.version THEN RAISE EXCEPTION 'Invalid reception correction'; END IF;
 changed := (OLD.received_at IS DISTINCT FROM NEW.received_at)::int + (OLD.producer_id IS DISTINCT FROM NEW.producer_id)::int + (OLD.observations IS DISTINCT FROM NEW.observations)::int + (OLD.status IS DISTINCT FROM NEW.status)::int;
 IF changed<>1 OR NEW.version<>OLD.version+1 OR NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN RAISE EXCEPTION 'Exactly one reception field must change'; END IF;
 IF c.field='receivedAt' THEN expected_old:=to_jsonb(to_char(OLD.received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')); expected_new:=to_jsonb(to_char(NEW.received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 ELSIF c.field='producerId' THEN expected_old:=coalesce(to_jsonb(OLD.producer_id),'null'::jsonb); expected_new:=coalesce(to_jsonb(NEW.producer_id),'null'::jsonb);
 ELSIF c.field='observations' THEN expected_old:=coalesce(to_jsonb(OLD.observations),'null'::jsonb); expected_new:=coalesce(to_jsonb(NEW.observations),'null'::jsonb);
 ELSIF c.field='status' THEN expected_old:=to_jsonb(OLD.status); expected_new:=to_jsonb(NEW.status);
 ELSE RAISE EXCEPTION 'Reception correction field is not permitted'; END IF;
 IF c.previous_value IS DISTINCT FROM expected_old OR c.new_value IS DISTINCT FROM expected_new THEN RAISE EXCEPTION 'Reception correction values do not match'; END IF;
 IF NEW.status='ACCEPTED_WITH_OBSERVATIONS' AND length(btrim(coalesce(NEW.observations,'')))=0 THEN RAISE EXCEPTION 'Observations required'; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION "production_p10_measurement_commit_guard"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE v INTEGER; BEGIN SELECT version INTO v FROM production_measurements WHERE id=NEW.production_measurement_id; IF v IS NULL OR v<NEW.to_version THEN RAISE EXCEPTION 'Measurement correction target version was not materialized'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION "production_p10_reception_commit_guard"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE v INTEGER; BEGIN SELECT version INTO v FROM grape_receptions WHERE id=NEW.grape_reception_id; IF v IS NULL OR v<NEW.to_version THEN RAISE EXCEPTION 'Reception correction target version was not materialized'; END IF; RETURN NEW; END $$;
CREATE CONSTRAINT TRIGGER "production_measurement_correction_commit_guard" AFTER INSERT ON "production_measurement_corrections" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "production_p10_measurement_commit_guard"();
CREATE CONSTRAINT TRIGGER "grape_reception_correction_commit_guard" AFTER INSERT ON "grape_reception_corrections" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "production_p10_reception_commit_guard"();
INSERT INTO "permissions" ("id","code","name","description","created_at","updated_at") VALUES
(gen_random_uuid(),'production:measurement_correct','Correct production measurements','Correct measurement history',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'production:reception_correct','Correct grape receptions','Correct reception administration fields',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;