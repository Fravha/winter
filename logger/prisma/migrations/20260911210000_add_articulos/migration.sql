CREATE TYPE "ArticuloClassification" AS ENUM (
  'MATERIA_PRIMA',
  'INSUMO_ENOLOGICO',
  'MATERIAL_ENVASE',
  'MATERIAL_EMPAQUE',
  'PRODUCTO_PROCESO',
  'PRODUCTO_ENVASADO',
  'PRODUCTO_TERMINADO'
);

CREATE TYPE "ArticuloUnit" AS ENUM (
  'KG',
  'G',
  'L',
  'ML',
  'UNIDAD'
);

CREATE TABLE "articulos" (
  "id" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "clasificacion" "ArticuloClassification" NOT NULL,
  "unidad_medida" "ArticuloUnit" NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "articulos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "articulos_codigo_idx" ON "articulos"("codigo");
CREATE INDEX "articulos_clasificacion_activo_idx"
  ON "articulos"("clasificacion", "activo");
CREATE UNIQUE INDEX "articulos_codigo_case_insensitive_key"
  ON "articulos"(LOWER("codigo"));