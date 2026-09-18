CREATE TYPE "ProductionContainerStatus" AS ENUM ('DISPONIBLE', 'OCUPADO', 'FUERA_DE_SERVICIO');
CREATE TYPE "ProductionBatchContainerMovementType" AS ENUM ('ASSIGNED', 'TRANSFERRED', 'PARTIAL_TRANSFERRED');

CREATE TABLE "production_containers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "capacity" DECIMAL(18,3) NOT NULL,
  "capacity_unit" TEXT NOT NULL,
  "status" "ProductionContainerStatus" NOT NULL DEFAULT 'DISPONIBLE',
  "observations" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "production_containers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_containers_capacity_positive" CHECK ("capacity" > 0)
);
CREATE UNIQUE INDEX "production_containers_code_key" ON "production_containers"("code");
CREATE INDEX "production_containers_status_code_idx" ON "production_containers"("status", "code");

CREATE TABLE "production_container_occupancies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "container_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "production_container_occupancies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_container_occupancies_quantity_positive" CHECK ("quantity" > 0)
);
CREATE INDEX "production_container_occupancies_container_idx" ON "production_container_occupancies"("container_id", "closed_at", "opened_at");
CREATE INDEX "production_container_occupancies_batch_idx" ON "production_container_occupancies"("batch_id", "closed_at", "opened_at");
CREATE UNIQUE INDEX "production_container_occupancies_one_open_container_key" ON "production_container_occupancies"("container_id") WHERE "closed_at" IS NULL;
ALTER TABLE "production_container_occupancies"
  ADD CONSTRAINT "production_container_occupancies_container_fkey" FOREIGN KEY ("container_id") REFERENCES "production_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_container_occupancies_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "production_batch_container_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "movement_type" "ProductionBatchContainerMovementType" NOT NULL,
  "source_container_id" UUID,
  "destination_container_id" UUID NOT NULL,
  "source_batch_id" UUID NOT NULL,
  "destination_batch_id" UUID,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "operation_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_batch_container_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_batch_container_movements_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "production_batch_container_movements_destination_diff_source" CHECK ("source_container_id" IS NULL OR "source_container_id" <> "destination_container_id")
);
CREATE UNIQUE INDEX "production_batch_container_movements_operation_key_key" ON "production_batch_container_movements"("operation_key");
CREATE INDEX "production_batch_container_movements_destination_idx" ON "production_batch_container_movements"("destination_container_id", "occurred_at");
CREATE INDEX "production_batch_container_movements_source_batch_idx" ON "production_batch_container_movements"("source_batch_id", "occurred_at");
ALTER TABLE "production_batch_container_movements"
  ADD CONSTRAINT "production_batch_container_movements_source_container_fkey" FOREIGN KEY ("source_container_id") REFERENCES "production_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_batch_container_movements_destination_container_fkey" FOREIGN KEY ("destination_container_id") REFERENCES "production_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_batch_container_movements_source_batch_fkey" FOREIGN KEY ("source_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_batch_container_movements_destination_batch_fkey" FOREIGN KEY ("destination_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "production_container_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operation_key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_container_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "production_container_operations_operation_key_key" ON "production_container_operations"("operation_key");

CREATE OR REPLACE FUNCTION "production_container_immutable_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Production container historical records are append-only'; END;
$$;
CREATE TRIGGER "production_batch_container_movements_append_only"
BEFORE UPDATE OR DELETE ON "production_batch_container_movements"
FOR EACH ROW EXECUTE FUNCTION "production_container_immutable_guard"();
CREATE TRIGGER "production_container_operations_append_only"
BEFORE UPDATE OR DELETE ON "production_container_operations"
FOR EACH ROW EXECUTE FUNCTION "production_container_immutable_guard"();