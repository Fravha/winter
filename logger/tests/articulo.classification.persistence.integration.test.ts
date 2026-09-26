import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";

const connectionString = getTemporaryProductionDatabaseUrl(
  "ARTICULOS_TEST_DATABASE_URL",
);
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("Articulo classification enum persistence", () => {
  it("creates, reads, filters, and updates official and legacy classifications", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    const suffix = randomUUID();
    const officialCode = `CLASS-OFFICIAL-${suffix}`;
    const legacyCode = `CLASS-LEGACY-${suffix}`;

    try {
      const official = await prisma.articulo.create({
        data: {
          codigo: officialCode,
          nombre: "Official classification persistence test",
          clasificacion: "MATERIAL_ENVASE_EMPAQUE_EXPORTACION",
          unidadMedida: "UNIDAD",
        },
      });
      const legacy = await prisma.articulo.create({
        data: {
          codigo: legacyCode,
          nombre: "Legacy classification persistence test",
          clasificacion: "MATERIAL_ENVASE",
          unidadMedida: "UNIDAD",
        },
      });

      const officialRead = await prisma.articulo.findUniqueOrThrow({
        where: { id: official.id },
      });
      const legacyRead = await prisma.articulo.findUniqueOrThrow({
        where: { id: legacy.id },
      });
      assert.equal(officialRead.clasificacion, "MATERIAL_ENVASE_EMPAQUE_EXPORTACION");
      assert.equal(legacyRead.clasificacion, "MATERIAL_ENVASE");

      const officialFilter = await prisma.articulo.findMany({
        where: { codigo: officialCode, clasificacion: "MATERIAL_ENVASE_EMPAQUE_EXPORTACION" },
      });
      const legacyFilter = await prisma.articulo.findMany({
        where: { codigo: legacyCode, clasificacion: "MATERIAL_ENVASE" },
      });
      assert.deepEqual(officialFilter.map(({ id }) => id), [official.id]);
      assert.deepEqual(legacyFilter.map(({ id }) => id), [legacy.id]);

      const officialUpdated = await prisma.articulo.update({
        where: { id: official.id },
        data: { clasificacion: "MATERIAL_AUXILIAR" },
      });
      const legacyUpdated = await prisma.articulo.update({
        where: { id: legacy.id },
        data: { clasificacion: "PRODUCTO_ENVASADO" },
      });
      assert.equal(officialUpdated.clasificacion, "MATERIAL_AUXILIAR");
      assert.equal(legacyUpdated.clasificacion, "PRODUCTO_ENVASADO");

      const officialUpdatedFilter = await prisma.articulo.findMany({
        where: { codigo: officialCode, clasificacion: "MATERIAL_AUXILIAR" },
      });
      const legacyUpdatedFilter = await prisma.articulo.findMany({
        where: { codigo: legacyCode, clasificacion: "PRODUCTO_ENVASADO" },
      });
      assert.deepEqual(officialUpdatedFilter.map(({ id }) => id), [official.id]);
      assert.deepEqual(legacyUpdatedFilter.map(({ id }) => id), [legacy.id]);
    } finally {
      // Keep both rows as a durable trace; never delete articles in this test.
      await prisma.$disconnect();
    }
  });
});