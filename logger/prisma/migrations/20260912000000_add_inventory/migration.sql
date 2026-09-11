CREATE TYPE "InventoryMovementType" AS ENUM ('INBOUND','OUTBOUND','TRANSFER','ADJUSTMENT');
CREATE TYPE "InventoryLotClassification" AS ENUM ('PRODUCTO_ENVASADO','PRODUCTO_TERMINADO','PRODUCTO_TERMINADO_EXPORTACION');
CREATE TABLE "warehouses" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "codigo" TEXT NOT NULL, "nombre" TEXT NOT NULL,
 "ubicacion" TEXT, "encargado_user_id" UUID, "activo" BOOLEAN NOT NULL DEFAULT true,
 "observaciones" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "inventory_lots" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lot_code" TEXT NOT NULL, "articulo_id" UUID NOT NULL,
 "origin_production_batch_id" TEXT, "classification" "InventoryLotClassification" NOT NULL,
 "fecha_ingreso" TIMESTAMP(3) NOT NULL, "observations" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "inventory_stocks" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "warehouse_id" UUID NOT NULL, "articulo_id" UUID NOT NULL,
 "inventory_lot_id" UUID, "quantity" DECIMAL(18,3) NOT NULL, "unit" "ArticuloUnit" NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "inventory_movements" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "type" "InventoryMovementType" NOT NULL, "source" TEXT NOT NULL,
 "reason" TEXT, "articulo_id" UUID NOT NULL, "warehouse_id" UUID NOT NULL,
 "destination_warehouse_id" UUID, "inventory_lot_id" UUID, "quantity" DECIMAL(18,3) NOT NULL,
 "unit" "ArticuloUnit" NOT NULL, "stock_before" DECIMAL(18,3) NOT NULL, "resulting_stock" DECIMAL(18,3) NOT NULL,
 "actor_user_id" UUID, "negative_stock_authorized" BOOLEAN NOT NULL DEFAULT false,
 "negative_stock_authorizer_user_id" UUID, "negative_stock_reason" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "inventory_idempotency" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "key" TEXT NOT NULL, "operation" TEXT NOT NULL, "request_fingerprint" TEXT NOT NULL,
 "response" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "inventory_idempotency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warehouses_codigo_key" ON "warehouses" (lower("codigo"));
CREATE UNIQUE INDEX "inventory_lots_articulo_id_lot_code_key" ON "inventory_lots" ("articulo_id","lot_code");
CREATE UNIQUE INDEX "inventory_lots_articulo_id_lot_code_ci_key" ON "inventory_lots" ("articulo_id",lower("lot_code"));
CREATE UNIQUE INDEX "inventory_stocks_position_with_lot_key" ON "inventory_stocks" ("warehouse_id","articulo_id","inventory_lot_id") WHERE "inventory_lot_id" IS NOT NULL;
CREATE UNIQUE INDEX "inventory_stocks_position_without_lot_key" ON "inventory_stocks" ("warehouse_id","articulo_id") WHERE "inventory_lot_id" IS NULL;
CREATE UNIQUE INDEX "inventory_idempotency_key_key" ON "inventory_idempotency" ("key");
CREATE INDEX "inventory_movements_position_idx" ON "inventory_movements" ("articulo_id","warehouse_id","inventory_lot_id","created_at");
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_user_id_fkey" FOREIGN KEY ("encargado_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_authorizer_user_id_fkey" FOREIGN KEY ("negative_stock_authorizer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_unidad_integer_check" CHECK ("unit" <> 'UNIDAD' OR "quantity" = trunc("quantity"));