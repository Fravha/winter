-- P5.5A: legacy work inputs remain readable; application-created rows populate
-- the new provenance columns. Nullable columns preserve any pre-existing rows.
ALTER TABLE "production_work_inputs"
  ADD COLUMN "warehouse_id" UUID,
  ADD COLUMN "inventory_lot_id" UUID,
  ADD COLUMN "inventory_movement_id" UUID,
  ADD COLUMN "observations" TEXT,
  ADD COLUMN "operation_key" TEXT,
  ADD COLUMN "request_hash" TEXT,
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "reversed_at" TIMESTAMP(3),
  ADD COLUMN "reversal_inventory_movement_id" UUID,
  ADD COLUMN "reversal_operation_key" TEXT,
  ADD COLUMN "reversal_request_hash" TEXT,
  ADD COLUMN "reversed_by_user_id" UUID,
  ADD COLUMN "reversal_reason" TEXT;

CREATE UNIQUE INDEX "production_work_inputs_inventory_movement_id_key"
  ON "production_work_inputs"("inventory_movement_id");
CREATE UNIQUE INDEX "production_work_inputs_operation_key_key"
  ON "production_work_inputs"("operation_key");
CREATE UNIQUE INDEX "production_work_inputs_reversal_inventory_movement_id_key"
  ON "production_work_inputs"("reversal_inventory_movement_id");
CREATE UNIQUE INDEX "production_work_inputs_reversal_operation_key_key"
  ON "production_work_inputs"("reversal_operation_key");
CREATE INDEX "production_work_inputs_work_created_idx" ON "production_work_inputs"("production_work_id","created_at");
CREATE INDEX "production_work_inputs_position_idx" ON "production_work_inputs"("warehouse_id","articulo_id","inventory_lot_id");

ALTER TABLE "production_work_inputs"
  ADD CONSTRAINT "production_work_inputs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_inputs_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_inputs_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_inputs_reversal_inventory_movement_id_fkey" FOREIGN KEY ("reversal_inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_inputs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_work_inputs_reversed_by_user_id_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_work_inputs"
  ADD CONSTRAINT "production_work_inputs_quantity_positive_chk" CHECK ("quantity" > 0) NOT VALID;

CREATE OR REPLACE FUNCTION prevent_production_work_input_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.production_work_id = OLD.production_work_id
     AND NEW.articulo_id = OLD.articulo_id
     AND NEW.quantity = OLD.quantity
     AND NEW.unit = OLD.unit
     AND NEW.warehouse_id IS NOT DISTINCT FROM OLD.warehouse_id
     AND NEW.inventory_lot_id IS NOT DISTINCT FROM OLD.inventory_lot_id
     AND NEW.inventory_movement_id IS NOT DISTINCT FROM OLD.inventory_movement_id
     AND NEW.observations IS NOT DISTINCT FROM OLD.observations
     AND NEW.operation_key IS NOT DISTINCT FROM OLD.operation_key
     AND NEW.request_hash IS NOT DISTINCT FROM OLD.request_hash
     AND NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
     AND NEW.created_at = OLD.created_at
     AND OLD.reversed_at IS NULL
     AND OLD.reversal_inventory_movement_id IS NULL
     AND OLD.reversal_operation_key IS NULL
     AND OLD.reversal_request_hash IS NULL
     AND OLD.reversed_by_user_id IS NULL
     AND OLD.reversal_reason IS NULL
     AND NEW.reversed_at IS NOT NULL
     AND NEW.reversal_inventory_movement_id IS NOT NULL
     AND NEW.reversal_operation_key IS NOT NULL
     AND NEW.reversal_request_hash IS NOT NULL
     AND NEW.reversed_by_user_id IS NOT NULL
     AND NEW.reversal_reason IS NOT NULL
  THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'production_work_inputs is append-only; use reversal';
END $$;
CREATE TRIGGER production_work_inputs_append_only
  BEFORE UPDATE OR DELETE ON "production_work_inputs"
  FOR EACH ROW EXECUTE FUNCTION prevent_production_work_input_mutation();