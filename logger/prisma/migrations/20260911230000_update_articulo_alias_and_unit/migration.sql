ALTER TYPE "ArticuloUnit" RENAME TO "ArticuloUnit_old";

CREATE TYPE "ArticuloUnit" AS ENUM (
  'KG',
  'G',
  'L',
  'M',
  'UNIDAD'
);

ALTER TABLE "articulos"
  ALTER COLUMN "unidad_medida" TYPE "ArticuloUnit"
  USING ("unidad_medida"::text::"ArticuloUnit");

DROP TYPE "ArticuloUnit_old";

ALTER TABLE "articulos"
  ADD COLUMN "codigo_externo" TEXT;

CREATE INDEX "articulos_codigo_externo_idx"
  ON "articulos"("codigo_externo");