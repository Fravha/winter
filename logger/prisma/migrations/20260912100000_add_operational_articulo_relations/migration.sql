CREATE TYPE "ProductionOrderStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "purchase_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchase_id" TEXT NOT NULL,
  "articulo_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" "ArticuloUnit" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "status" "ProductionOrderStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_works" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_order_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_works_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_work_inputs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "production_work_id" UUID NOT NULL,
  "articulo_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" "ArticuloUnit" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_work_inputs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "production_orders_reference_key" ON "production_orders"("reference");
CREATE INDEX "purchase_lines_articulo_id_idx" ON "purchase_lines"("articulo_id");
CREATE INDEX "production_works_production_order_id_idx" ON "production_works"("production_order_id");
CREATE INDEX "production_work_inputs_articulo_id_idx" ON "production_work_inputs"("articulo_id");

ALTER TABLE "purchase_lines"
  ADD CONSTRAINT "purchase_lines_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_lines"
  ADD CONSTRAINT "purchase_lines_articulo_id_fkey"
  FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_works"
  ADD CONSTRAINT "production_works_production_order_id_fkey"
  FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_work_inputs"
  ADD CONSTRAINT "production_work_inputs_production_work_id_fkey"
  FOREIGN KEY ("production_work_id") REFERENCES "production_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_work_inputs"
  ADD CONSTRAINT "production_work_inputs_articulo_id_fkey"
  FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;