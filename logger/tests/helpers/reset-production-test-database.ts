import type { PrismaClient } from "../../src/generated/prisma/client.js";

export async function resetProductionTestDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const quotedTables = tables
    .map(({ tableName }) => `"public"."${tableName.replaceAll('"', '""')}"`)
    .join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
}