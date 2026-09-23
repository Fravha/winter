CREATE INDEX "production_inventory_releases_batch_occurred_id_idx"
  ON "production_inventory_releases" ("production_batch_id", "occurred_at", "id");