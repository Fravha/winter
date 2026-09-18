-- Remove an unversioned column that is not part of the approved Production contracts.
-- IF EXISTS keeps the corrective migration safe on databases where the stray DDL
-- was already removed before this migration entered the official history.
ALTER TABLE "production_orders"
  DROP COLUMN IF EXISTS "production_process_id";