CREATE TYPE "GrapeReceptionStatus" AS ENUM ('ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS');

CREATE TABLE "grape_receptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_order_id" UUID NOT NULL,
  "producer_id" UUID,
  "received_at" TIMESTAMP(3) NOT NULL,
  "status" "GrapeReceptionStatus" NOT NULL,
  "observations" TEXT,
  "actor_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grape_receptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "grape_receptions_production_order_id_received_at_idx" ON "grape_receptions"("production_order_id","received_at");
ALTER TABLE "grape_receptions" ADD CONSTRAINT "grape_receptions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grape_receptions" ADD CONSTRAINT "grape_receptions_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "production_producers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grape_receptions" ADD CONSTRAINT "grape_receptions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "grape_reception_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operation_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "reception_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grape_reception_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "grape_reception_operations_operation_key_key" ON "grape_reception_operations"("operation_key");
CREATE UNIQUE INDEX "grape_reception_operations_reception_id_key" ON "grape_reception_operations"("reception_id");
ALTER TABLE "grape_reception_operations" ADD CONSTRAINT "grape_reception_operations_reception_id_fkey" FOREIGN KEY ("reception_id") REFERENCES "grape_receptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "grape_reception_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reception_id" UUID NOT NULL,
  "grape_variety_id" UUID NOT NULL,
  "articulo_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" "ArticuloUnit" NOT NULL,
  "production_batch_id" UUID NOT NULL,
  CONSTRAINT "grape_reception_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "grape_reception_items_production_batch_id_key" ON "grape_reception_items"("production_batch_id");
CREATE INDEX "grape_reception_items_reception_id_idx" ON "grape_reception_items"("reception_id");
ALTER TABLE "grape_reception_items" ADD CONSTRAINT "grape_reception_items_reception_id_fkey" FOREIGN KEY ("reception_id") REFERENCES "grape_receptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grape_reception_items" ADD CONSTRAINT "grape_reception_items_grape_variety_id_fkey" FOREIGN KEY ("grape_variety_id") REFERENCES "production_grape_varieties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grape_reception_items" ADD CONSTRAINT "grape_reception_items_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grape_reception_items" ADD CONSTRAINT "grape_reception_items_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grape_receptions" ADD CONSTRAINT "grape_receptions_status_observations_check" CHECK ("status" IN ('ACCEPTED','ACCEPTED_WITH_OBSERVATIONS'));
ALTER TABLE "grape_reception_items" ADD CONSTRAINT "grape_reception_items_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "grape_reception_operations" ADD CONSTRAINT "grape_reception_operations_key_nonblank_check" CHECK (length(btrim("operation_key")) > 0);
ALTER TABLE "grape_reception_operations" ADD CONSTRAINT "grape_reception_operations_hash_nonblank_check" CHECK (length(btrim("request_hash")) > 0);

CREATE OR REPLACE FUNCTION "production_grape_reception_history_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Grape reception history is append-only';
END;
$$;
CREATE TRIGGER "grape_receptions_history_guard" BEFORE UPDATE OR DELETE ON "grape_receptions"
FOR EACH ROW EXECUTE FUNCTION "production_grape_reception_history_guard"();
CREATE TRIGGER "grape_reception_items_history_guard" BEFORE UPDATE OR DELETE ON "grape_reception_items"
FOR EACH ROW EXECUTE FUNCTION "production_grape_reception_history_guard"();
CREATE TRIGGER "grape_reception_operations_history_guard" BEFORE UPDATE OR DELETE ON "grape_reception_operations"
FOR EACH ROW EXECUTE FUNCTION "production_grape_reception_history_guard"();

CREATE OR REPLACE FUNCTION "production_grape_reception_custom_value_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.entity_type = 'GRAPE_RECEPTION'
     OR (TG_OP = 'UPDATE' AND NEW.entity_type = 'GRAPE_RECEPTION') THEN
    RAISE EXCEPTION 'Grape reception custom values are historical and append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "grape_reception_custom_value_update_guard"
BEFORE UPDATE ON "production_custom_field_values"
FOR EACH ROW EXECUTE FUNCTION "production_grape_reception_custom_value_guard"();
CREATE TRIGGER "grape_reception_custom_value_delete_guard"
BEFORE DELETE ON "production_custom_field_values"
FOR EACH ROW EXECUTE FUNCTION "production_grape_reception_custom_value_guard"();

INSERT INTO "permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'production:reception_create',
  'Create grape receptions',
  'Create accepted grape receptions and their initial production batches',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;