-- Align legacy PostgreSQL object names with the names derived from schema.prisma.
-- These metadata-only renames preserve columns, referential actions, uniqueness,
-- index definitions, and all existing data.
ALTER TABLE "production_inventory_releases"
  RENAME CONSTRAINT "production_inventory_releases_batch_fk"
  TO "production_inventory_releases_production_batch_id_fkey";

ALTER TABLE "production_inventory_reversals"
  RENAME CONSTRAINT "production_inventory_reversals_release_fk"
  TO "production_inventory_reversals_release_id_fkey";

ALTER INDEX "production_inventory_reversals_release_key"
  RENAME TO "production_inventory_reversals_release_id_key";

ALTER INDEX "production_work_inputs_work_created_idx"
  RENAME TO "production_work_inputs_production_work_id_created_at_idx";

ALTER INDEX "production_work_inputs_position_idx"
  RENAME TO "production_work_inputs_warehouse_id_articulo_id_inventory_lot_id_idx";