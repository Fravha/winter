CREATE TYPE "CompraStatus" AS ENUM ('REGISTERED', 'RECEIVED', 'CANCELLED');

CREATE TABLE "compras" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supplier_name" TEXT NOT NULL,
  "supplier_tax_id" TEXT,
  "document_number" TEXT,
  "document_date" TIMESTAMP(3),
  "currency" TEXT,
  "observations" TEXT,
  "status" "CompraStatus" NOT NULL DEFAULT 'REGISTERED',
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compra_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "compra_id" UUID NOT NULL,
  "articulo_id" UUID NOT NULL,
  "brand" TEXT,
  "requested_quantity" DECIMAL(18,3) NOT NULL,
  "unit" "ArticuloUnit" NOT NULL,
  "unit_price" DECIMAL(18,3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compra_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compra_items_positive_quantity_check" CHECK ("requested_quantity" > 0),
  CONSTRAINT "compra_items_unidad_integer_check" CHECK ("unit" <> 'UNIDAD' OR "requested_quantity" = trunc("requested_quantity"))
);

CREATE TABLE "compra_inventory_movement_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "compra_id" UUID NOT NULL,
  "compra_item_id" UUID NOT NULL,
  "inventory_movement_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compra_inventory_movement_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compra_items_compra_id_articulo_id_key"
  ON "compra_items"("compra_id", "articulo_id");
CREATE INDEX "compras_status_created_at_idx" ON "compras"("status", "created_at");
CREATE INDEX "compra_items_articulo_id_idx" ON "compra_items"("articulo_id");
CREATE UNIQUE INDEX "compra_inventory_movement_references_compra_item_id_key"
  ON "compra_inventory_movement_references"("compra_item_id");
CREATE UNIQUE INDEX "compra_inventory_movement_references_compra_item_id_inventory_movement_id_key"
  ON "compra_inventory_movement_references"("compra_item_id", "inventory_movement_id");
CREATE INDEX "compra_inventory_movement_references_compra_id_idx"
  ON "compra_inventory_movement_references"("compra_id");
CREATE INDEX "compra_inventory_movement_references_inventory_movement_id_idx"
  ON "compra_inventory_movement_references"("inventory_movement_id");

ALTER TABLE "compra_items"
  ADD CONSTRAINT "compra_items_compra_id_fkey"
  FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compra_items"
  ADD CONSTRAINT "compra_items_articulo_id_fkey"
  FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compra_inventory_movement_references"
  ADD CONSTRAINT "compra_inventory_movement_references_compra_id_fkey"
  FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compra_inventory_movement_references"
  ADD CONSTRAINT "compra_inventory_movement_references_compra_item_id_fkey"
  FOREIGN KEY ("compra_item_id") REFERENCES "compra_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compra_inventory_movement_references"
  ADD CONSTRAINT "compra_inventory_movement_references_inventory_movement_id_fkey"
  FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'compras:read', 'Compras read', 'Read purchases', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'compras:create', 'Compras create', 'Create purchases', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'compras:update', 'Compras update', 'Update registered purchases', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'compras:receive', 'Compras receive', 'Receive purchases into inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'compras:cancel', 'Compras cancel', 'Cancel registered purchases', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;