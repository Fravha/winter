ALTER TABLE "production_orders" RENAME COLUMN "reference" TO "code";
ALTER INDEX "production_orders_reference_key" RENAME TO "production_orders_code_key";
ALTER TABLE "production_orders"
  ADD COLUMN "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "observations" TEXT,
  ADD COLUMN "closed_at" TIMESTAMP(3),
  ADD COLUMN "closed_by_user_id" UUID,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "production_orders" ALTER COLUMN "start_date" DROP DEFAULT;
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");
CREATE INDEX "production_orders_start_date_idx" ON "production_orders"("start_date");

CREATE TABLE "transformation_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "production_order_id" UUID NOT NULL,
  "status" "ProductionOrderStatus" NOT NULL DEFAULT 'OPEN',
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3),
  "observations" TEXT,
  "closed_at" TIMESTAMP(3),
  "closed_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "transformation_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transformation_orders_production_order_id_code_key" ON "transformation_orders"("production_order_id", "code");
CREATE INDEX "transformation_orders_production_order_id_status_idx" ON "transformation_orders"("production_order_id", "status");
CREATE INDEX "transformation_orders_period_start_period_end_idx" ON "transformation_orders"("period_start", "period_end");
ALTER TABLE "transformation_orders"
  ADD CONSTRAINT "transformation_orders_production_order_id_fkey"
  FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'production:order_create', 'Create production orders', 'Create ProductionOrder aggregates', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'production:order_close', 'Close production orders', 'Close ProductionOrder aggregates', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'production:transformation_order_create', 'Create transformation orders', 'Create TransformationOrder aggregates', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'production:transformation_order_close', 'Close transformation orders', 'Close TransformationOrder aggregates', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'production:read', 'Read production', 'Read production orders and transformations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;