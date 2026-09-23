-- Align P5.5D foreign-key update actions with schema.prisma.
ALTER TABLE "production_inventory_releases"
  DROP CONSTRAINT "production_inventory_releases_production_batch_id_fkey",
  ADD CONSTRAINT "production_inventory_releases_production_batch_id_fkey"
    FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT "production_inventory_releases_warehouse_id_fkey",
  ADD CONSTRAINT "production_inventory_releases_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT "production_inventory_releases_inventory_lot_id_fkey",
  ADD CONSTRAINT "production_inventory_releases_inventory_lot_id_fkey"
    FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_inventory_reversals"
  DROP CONSTRAINT "production_inventory_reversals_release_id_fkey",
  ADD CONSTRAINT "production_inventory_reversals_release_id_fkey"
    FOREIGN KEY ("release_id") REFERENCES "production_inventory_releases"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep explicit short names so PostgreSQL's 63-byte identifier limit cannot
-- diverge from Prisma's generated names.
ALTER INDEX "production_work_inputs_production_work_id_created_at_idx"
  RENAME TO "production_work_inputs_work_created_idx";

ALTER INDEX "production_work_inputs_warehouse_id_articulo_id_inventory_lot_i"
  RENAME TO "production_work_inputs_position_idx";