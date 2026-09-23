ALTER TABLE "production_inventory_releases"
  ADD CONSTRAINT "production_inventory_releases_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT;

ALTER TABLE "production_inventory_releases"
  ADD CONSTRAINT "production_inventory_releases_inventory_lot_id_fkey"
  FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT;