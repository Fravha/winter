CREATE TYPE "ProductionBatchLedgerEntryType" AS ENUM ('GENERATED', 'CONSUMED', 'SEPARATED', 'LOSS', 'TRANSFERRED_TO_INVENTORY');

CREATE TABLE "production_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "production_order_id" UUID NOT NULL,
  "articulo_id" UUID NOT NULL,
  "unit" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observations" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "production_batches_code_key" ON "production_batches"("code");
CREATE INDEX "production_batches_production_order_id_idx" ON "production_batches"("production_order_id");
CREATE INDEX "production_batches_articulo_id_idx" ON "production_batches"("articulo_id");
CREATE INDEX "production_batches_created_at_idx" ON "production_batches"("created_at");
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_production_order_id_fkey"
  FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "production_batch_ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_batch_id" UUID NOT NULL,
  "entry_type" "ProductionBatchLedgerEntryType" NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "transformation_id" UUID,
  "production_work_id" UUID,
  "production_loss_id" UUID,
  "operation_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "production_batch_ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "production_batch_ledger_entries_operation_key_key" ON "production_batch_ledger_entries"("operation_key");
CREATE INDEX "production_batch_ledger_entries_batch_occurred_idx" ON "production_batch_ledger_entries"("production_batch_id", "occurred_at", "id");
CREATE INDEX "production_batch_ledger_entries_type_occurred_idx" ON "production_batch_ledger_entries"("entry_type", "occurred_at");
CREATE INDEX "production_batch_ledger_entries_transformation_idx" ON "production_batch_ledger_entries"("transformation_id");
CREATE INDEX "production_batch_ledger_entries_work_idx" ON "production_batch_ledger_entries"("production_work_id");
ALTER TABLE "production_batch_ledger_entries" ADD CONSTRAINT "production_batch_ledger_entries_production_batch_id_fkey"
  FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_batch_ledger_entries" ADD CONSTRAINT "production_batch_ledger_entries_quantity_positive" CHECK ("quantity" > 0);

CREATE TABLE "production_batch_balances" (
  "production_batch_id" UUID NOT NULL,
  "generated" DECIMAL(18,3) NOT NULL,
  "consumed" DECIMAL(18,3) NOT NULL,
  "separated" DECIMAL(18,3) NOT NULL,
  "lost" DECIMAL(18,3) NOT NULL,
  "transferred_to_inventory" DECIMAL(18,3) NOT NULL,
  "available" DECIMAL(18,3) NOT NULL,
  "ledger_version" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "production_batch_balances_pkey" PRIMARY KEY ("production_batch_id")
);
ALTER TABLE "production_batch_balances" ADD CONSTRAINT "production_batch_balances_production_batch_id_fkey"
  FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_batch_balances" ADD CONSTRAINT "production_batch_balances_available_nonnegative" CHECK ("available" >= 0);

CREATE TABLE "production_batch_lineage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "parent_batch_id" UUID NOT NULL,
  "child_batch_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3),
  "unit" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation_key" TEXT NOT NULL,
  CONSTRAINT "production_batch_lineage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "production_batch_lineage_parent_child_operation_key" ON "production_batch_lineage"("parent_batch_id", "child_batch_id", "operation_key");
CREATE INDEX "production_batch_lineage_parent_idx" ON "production_batch_lineage"("parent_batch_id");
CREATE INDEX "production_batch_lineage_child_idx" ON "production_batch_lineage"("child_batch_id");
ALTER TABLE "production_batch_lineage"
  ADD CONSTRAINT "production_batch_lineage_parent_batch_id_fkey" FOREIGN KEY ("parent_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_batch_lineage_child_batch_id_fkey" FOREIGN KEY ("child_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_batch_lineage_no_self_edge" CHECK ("parent_batch_id" <> "child_batch_id");
ALTER TABLE "production_batch_lineage" ADD CONSTRAINT "production_batch_lineage_quantity_positive" CHECK ("quantity" IS NULL OR "quantity" > 0);

CREATE TABLE "production_batch_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operation_key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_batch_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "production_batch_operations_operation_key_key" ON "production_batch_operations"("operation_key");

CREATE OR REPLACE FUNCTION "production_batch_immutable_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Production batch historical records are append-only';
END;
$$;

CREATE TRIGGER "production_batch_ledger_entries_append_only"
BEFORE UPDATE OR DELETE ON "production_batch_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION "production_batch_immutable_guard"();

CREATE TRIGGER "production_batch_lineage_append_only"
BEFORE UPDATE OR DELETE ON "production_batch_lineage"
FOR EACH ROW EXECUTE FUNCTION "production_batch_immutable_guard"();

CREATE TRIGGER "production_batch_operations_append_only"
BEFORE UPDATE OR DELETE ON "production_batch_operations"
FOR EACH ROW EXECUTE FUNCTION "production_batch_immutable_guard"();

CREATE TRIGGER "production_batches_historical_guard"
BEFORE DELETE ON "production_batches"
FOR EACH ROW EXECUTE FUNCTION "production_batch_immutable_guard"();