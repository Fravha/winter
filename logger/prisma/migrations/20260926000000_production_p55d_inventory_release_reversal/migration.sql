ALTER TYPE "ProductionBatchLedgerEntryType" ADD VALUE IF NOT EXISTS 'INVENTORY_RELEASE_RESTORED';

CREATE TABLE "production_inventory_releases" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "production_batch_id" uuid NOT NULL,
  "quantity" decimal(18,3) NOT NULL,
  "unit" text NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "inventory_lot_id" uuid NOT NULL,
  "inventory_movement_id" uuid NOT NULL,
  "operation_key" text NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "occurred_at" timestamp(3) NOT NULL,
  "observations" text,
  CONSTRAINT "production_inventory_releases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_inventory_releases_operation_key_key" UNIQUE ("operation_key"),
  CONSTRAINT "production_inventory_releases_batch_fk" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT
);
CREATE TABLE "production_inventory_reversals" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "release_id" uuid NOT NULL,
  "operation_key" text NOT NULL,
  "reason" text NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "occurred_at" timestamp(3) NOT NULL,
  "inventory_movement_id" uuid NOT NULL,
  CONSTRAINT "production_inventory_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_inventory_reversals_release_key" UNIQUE ("release_id"),
  CONSTRAINT "production_inventory_reversals_operation_key_key" UNIQUE ("operation_key"),
  CONSTRAINT "production_inventory_reversals_release_fk" FOREIGN KEY ("release_id") REFERENCES "production_inventory_releases"("id") ON DELETE RESTRICT
);
INSERT INTO permissions (id, code, name, description, created_at, updated_at)
VALUES (gen_random_uuid(), 'production:inventory_release_reverse', 'Reverse production inventory releases', 'Compensate a production inventory release', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_production_release_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'production inventory releases are append-only'; END;
$$;
CREATE TRIGGER production_inventory_releases_no_delete
  BEFORE DELETE ON production_inventory_releases FOR EACH ROW EXECUTE FUNCTION prevent_production_release_delete();
CREATE TRIGGER production_inventory_releases_no_update
  BEFORE UPDATE ON production_inventory_releases FOR EACH ROW EXECUTE FUNCTION prevent_production_release_delete();
CREATE OR REPLACE FUNCTION prevent_production_reversal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'production inventory reversals are append-only'; END;
$$;
CREATE TRIGGER production_inventory_reversals_no_update
  BEFORE UPDATE OR DELETE ON production_inventory_reversals FOR EACH ROW EXECUTE FUNCTION prevent_production_reversal_mutation();