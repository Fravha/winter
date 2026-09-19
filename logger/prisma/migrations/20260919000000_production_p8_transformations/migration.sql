CREATE TABLE "transformations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_order_id" UUID NOT NULL,
  "transformation_order_id" UUID,
  "production_work_id" UUID,
  "performed_at" TIMESTAMP(3) NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "observations" TEXT,
  "operation_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transformations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transformations_operation_key_key" UNIQUE ("operation_key")
);
CREATE TABLE "transformation_inputs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transformation_id" UUID NOT NULL,
  "production_batch_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transformation_inputs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transformation_inputs_quantity_check" CHECK ("quantity" > 0)
);
CREATE TABLE "transformation_outputs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transformation_id" UUID NOT NULL,
  "production_batch_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transformation_outputs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transformation_outputs_quantity_check" CHECK ("quantity" > 0)
);
CREATE TABLE "production_losses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_order_id" UUID NOT NULL,
  "transformation_order_id" UUID,
  "transformation_id" UUID,
  "production_work_id" UUID,
  "production_batch_id" UUID,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "observations" TEXT,
  "operation_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_losses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_losses_operation_key_key" UNIQUE ("operation_key"),
  CONSTRAINT "production_losses_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "production_losses_context_check" CHECK ("transformation_id" IS NOT NULL OR "production_work_id" IS NOT NULL)
);
CREATE INDEX "transformations_production_order_id_performed_at_idx" ON "transformations"("production_order_id","performed_at");
CREATE INDEX "transformations_transformation_order_id_idx" ON "transformations"("transformation_order_id");
CREATE INDEX "transformations_production_work_id_idx" ON "transformations"("production_work_id");
CREATE INDEX "transformation_inputs_transformation_id_idx" ON "transformation_inputs"("transformation_id");
CREATE INDEX "transformation_inputs_production_batch_id_idx" ON "transformation_inputs"("production_batch_id");
CREATE INDEX "transformation_outputs_transformation_id_idx" ON "transformation_outputs"("transformation_id");
CREATE INDEX "transformation_outputs_production_batch_id_idx" ON "transformation_outputs"("production_batch_id");
CREATE INDEX "production_losses_production_order_id_occurred_at_idx" ON "production_losses"("production_order_id","occurred_at");
CREATE INDEX "production_losses_transformation_id_idx" ON "production_losses"("transformation_id");
CREATE INDEX "production_losses_production_batch_id_idx" ON "production_losses"("production_batch_id");
ALTER TABLE "transformations"
  ADD CONSTRAINT "transformations_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "transformations_transformation_order_id_fkey" FOREIGN KEY ("transformation_order_id") REFERENCES "transformation_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "transformations_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "transformations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transformation_inputs"
  ADD CONSTRAINT "transformation_inputs_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "transformation_inputs_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transformation_outputs"
  ADD CONSTRAINT "transformation_outputs_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "transformation_outputs_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_losses"
  ADD CONSTRAINT "production_losses_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_losses_transformation_order_id_fkey" FOREIGN KEY ("transformation_order_id") REFERENCES "transformation_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_losses_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_losses_production_work_id_fkey" FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_losses_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_losses_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_batch_ledger_entries"
  ADD CONSTRAINT "production_batch_ledger_entries_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_batch_ledger_entries_production_loss_id_fkey" FOREIGN KEY ("production_loss_id") REFERENCES "production_losses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION "production_p8_append_only_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Production P8 records are append-only';
END;
$$;
CREATE TRIGGER "transformations_append_only" BEFORE UPDATE OR DELETE ON "transformations" FOR EACH ROW EXECUTE FUNCTION "production_p8_append_only_guard"();
CREATE TRIGGER "transformation_inputs_append_only" BEFORE UPDATE OR DELETE ON "transformation_inputs" FOR EACH ROW EXECUTE FUNCTION "production_p8_append_only_guard"();
CREATE TRIGGER "transformation_outputs_append_only" BEFORE UPDATE OR DELETE ON "transformation_outputs" FOR EACH ROW EXECUTE FUNCTION "production_p8_append_only_guard"();
CREATE TRIGGER "production_losses_append_only" BEFORE UPDATE OR DELETE ON "production_losses" FOR EACH ROW EXECUTE FUNCTION "production_p8_append_only_guard"();
INSERT INTO "permissions" ("id","code","name","description","created_at","updated_at")
VALUES (gen_random_uuid(),'production:transformation_create','Create production transformations','Create production transformations',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       (gen_random_uuid(),'production:loss_create','Create production losses','Create explicit production losses',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;