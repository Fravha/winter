import assert from "node:assert/strict";
import test from "node:test";
import { catalogInputSchema, customValueSchema } from "../src/modules/production/production.schema.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { AppError } from "../src/shared/errors/app-error.js";

function productionFake(definition: Record<string, unknown>, owner: Record<string, unknown> | null = { id: "owner", active: true }) {
  let stored: Record<string, unknown> | undefined;
  let currentDefinition = definition;
  const audits: Record<string, unknown>[] = [];
  const lookups = { producer: [] as string[], grapeVariety: [] as string[], grapeReception: [] as string[] };
  const tx = {
    customFieldDefinition: {
      findUnique: async () => currentDefinition,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        currentDefinition = { id: "created-definition", ...data };
        return currentDefinition;
      },
    },
    producer: { findUnique: async ({ where }: { where: { id: string } }) => { lookups.producer.push(where.id); return owner; } },
    grapeVariety: { findUnique: async ({ where }: { where: { id: string } }) => { lookups.grapeVariety.push(where.id); return owner; } },
    grapeReception: { findUnique: async ({ where }: { where: { id: string } }) => { lookups.grapeReception.push(where.id); return owner; } },
    customFieldValue: {
      upsert: async (args: { create: Record<string, unknown> }) => {
        stored = args.create;
        return { id: "value-id", ...args.create };
      },
    },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { audits.push(data); } },
  };
  const prisma = { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
  return { prisma, read: () => stored, audits, lookups };
}

test("Production P1 schemas are strict and preserve custom value primitives", () => {
  assert.throws(() => catalogInputSchema.parse({ code: "P", name: "Producer", extra: true }));
  assert.equal(customValueSchema.parse({
    definitionId: "00000000-0000-4000-8000-000000000001",
    entityType: "PRODUCER",
    entityId: "00000000-0000-4000-8000-000000000002",
    value: "2026-01-01T00:00:00.000Z",
  }).value, "2026-01-01T00:00:00.000Z");
});

test("Production P1 custom value schema does not coerce JSON numbers or dates", () => {
  assert.equal(typeof customValueSchema.parse({
    definitionId: "00000000-0000-4000-8000-000000000001",
    entityType: "PRODUCER",
    entityId: "00000000-0000-4000-8000-000000000002",
    value: "12.3400",
  }).value, "string");
  assert.equal(typeof customValueSchema.parse({
    definitionId: "00000000-0000-4000-8000-000000000001",
    entityType: "PRODUCER",
    entityId: "00000000-0000-4000-8000-000000000002",
    value: 12,
  }).value, "number");
});

test("Production P1 service validates typed values and audits in its transaction", async () => {
  const fake = productionFake({
    id: "definition-id", entityType: "PRODUCER", active: true, dataType: "DATE", options: null,
  });
  const service = new ProductionService(fake.prisma, {} as never);
  await service.setValue({
    definitionId: "00000000-0000-4000-8000-000000000001",
    entityType: "PRODUCER", entityId: "00000000-0000-4000-8000-000000000002",
    value: "2026-01-01T00:00:00.000Z",
  }, { actorUserId: "actor-id", requestId: "request-id" });
  assert.ok(fake.read()?.dateValue instanceof Date);
});

test("Production P1 service preserves decimal strings and accepts reception values", async () => {
  const fake = productionFake({
    id: "definition-id", entityType: "PRODUCER", active: true, dataType: "DECIMAL", options: null,
  });
  const service = new ProductionService(fake.prisma, {} as never);
  await service.setValue({
    definitionId: "00000000-0000-4000-8000-000000000001",
    entityType: "PRODUCER", entityId: "00000000-0000-4000-8000-000000000002",
    value: "123456789012.123456",
  }, { actorUserId: "actor-id" });
  assert.equal(fake.read()?.decimalValue, "123456789012.123456");
  const receptionFake = productionFake({
    id: "reception-definition-id", entityType: "GRAPE_RECEPTION", active: true, dataType: "DECIMAL", options: null,
  });
  await new ProductionService(receptionFake.prisma, {} as never).setValue({
    definitionId: "00000000-0000-4000-8000-000000000001",
    entityType: "GRAPE_RECEPTION", entityId: "00000000-0000-4000-8000-000000000002",
    value: "123456789012.123456",
  }, { actorUserId: "actor-id" });
  assert.equal(receptionFake.read()?.decimalValue, "123456789012.123456");
});

test("Production custom fields support GRAPE_RECEPTION definitions, assignment, reads and audit", async () => {
  const fake = productionFake({});
  const service = new ProductionService(fake.prisma, {} as never);
  const context = { actorUserId: "actor-id", requestId: "custom-field-request" };
  const definition = await service.createDefinition({
    entityType: "GRAPE_RECEPTION", code: "ARRIVAL_NOTE", label: "Arrival note",
    dataType: "TEXT", required: true, active: true, displayOrder: 2,
  }, context);
  assert.equal((definition as { entityType: string }).entityType, "GRAPE_RECEPTION");
  assert.equal((definition as { required: boolean }).required, true);
  assert.equal(fake.audits[0]?.action, "PRODUCTION_CUSTOM_FIELD_DEFINITION_CREATED");
  const value = await service.setValue({
    definitionId: (definition as { id: string }).id,
    entityType: "GRAPE_RECEPTION",
    entityId: "reception-id",
    value: "dock-a",
  }, context);
  assert.equal(value.textValue, "dock-a");
  assert.deepEqual(fake.read(), {
    definitionId: (definition as { id: string }).id,
    entityType: "GRAPE_RECEPTION",
    entityId: "reception-id",
    textValue: "dock-a",
  });
  assert.deepEqual(fake.lookups.grapeReception, ["reception-id"]);
  assert.equal(fake.audits[1]?.action, "PRODUCTION_CUSTOM_FIELD_VALUE_SET");
  assert.equal(fake.audits[1]?.actorUserId, "actor-id");
  assert.equal(fake.audits[1]?.resourceId, "value-id");
});

test("Production custom fields reject missing/inactive reception definitions and invalid typed values", async () => {
  const context = { actorUserId: "actor-id" };
  const missing = productionFake({
    id: "definition-id", entityType: "GRAPE_RECEPTION", active: true, dataType: "TEXT", options: null,
  }, null);
  await assert.rejects(() => new ProductionService(missing.prisma, {} as never).setValue({
    definitionId: "definition-id", entityType: "GRAPE_RECEPTION", entityId: "missing-reception", value: "x",
  }, context), (error: unknown) => error instanceof AppError && error.code === "CUSTOM_FIELD_ENTITY_NOT_FOUND");
  assert.deepEqual(missing.lookups.grapeReception, ["missing-reception"]);

  const inactive = productionFake({
    id: "definition-id", entityType: "GRAPE_RECEPTION", active: false, dataType: "TEXT", options: null,
  });
  await assert.rejects(() => new ProductionService(inactive.prisma, {} as never).setValue({
    definitionId: "definition-id", entityType: "GRAPE_RECEPTION", entityId: "reception-id", value: "x",
  }, context), (error: unknown) => error instanceof AppError && error.code === "CUSTOM_FIELD_DEFINITION_INACTIVE");

  const select = productionFake({
    id: "definition-id", entityType: "GRAPE_RECEPTION", active: true, dataType: "SELECT", options: ["red"],
  });
  const selectService = new ProductionService(select.prisma, {} as never);
  await assert.rejects(() => selectService.setValue({
    definitionId: "definition-id", entityType: "GRAPE_RECEPTION", entityId: "reception-id", value: "blue",
  }, context), (error: unknown) => error instanceof AppError && error.code === "CUSTOM_FIELD_VALUE_INVALID");
  const integer = productionFake({
    id: "definition-id", entityType: "GRAPE_RECEPTION", active: true, dataType: "INTEGER", options: null,
  });
  await assert.rejects(() => new ProductionService(integer.prisma, {} as never).setValue({
    definitionId: "definition-id", entityType: "GRAPE_RECEPTION", entityId: "reception-id", value: 1.5,
  }, context), (error: unknown) => error instanceof AppError && error.code === "CUSTOM_FIELD_VALUE_INVALID");
});

test("Production custom field definition validation preserves SELECT options contract", async () => {
  const fake = productionFake({});
  const service = new ProductionService(fake.prisma, {} as never);
  const context = { actorUserId: "actor-id" };
  await assert.rejects(() => service.createDefinition({
    entityType: "GRAPE_RECEPTION", code: "SELECT_EMPTY", label: "Empty select",
    dataType: "SELECT", required: false, active: true, displayOrder: 0,
  }, context), (error: unknown) => error instanceof AppError && error.code === "CUSTOM_FIELD_OPTIONS_REQUIRED");
  await assert.rejects(() => service.createDefinition({
    entityType: "GRAPE_RECEPTION", code: "TEXT_OPTIONS", label: "Text with options",
    dataType: "TEXT", required: false, active: true, options: ["unexpected"], displayOrder: 0,
  }, context), (error: unknown) => error instanceof AppError && error.code === "CUSTOM_FIELD_OPTIONS_INVALID");
  const created = await service.createDefinition({
    entityType: "GRAPE_RECEPTION", code: "SELECT_VALID", label: "Valid select",
    dataType: "SELECT", required: false, active: true, options: ["red", "white"], displayOrder: 0,
  }, context);
  assert.deepEqual((created as { options: string[] }).options, ["red", "white"]);
});

test("Production custom fields retain Producer and GrapeVariety assignment regressions", async () => {
  for (const entityType of ["PRODUCER", "GRAPE_VARIETY"] as const) {
    const fake = productionFake({
      id: "definition-id", entityType, active: true, dataType: "TEXT", options: null,
    });
    const value = await new ProductionService(fake.prisma, {} as never).setValue({
      definitionId: "definition-id", entityType, entityId: `${entityType.toLowerCase()}-id`, value: "value",
    }, { actorUserId: "actor-id" });
    assert.equal(value.textValue, "value");
    assert.deepEqual(entityType === "PRODUCER" ? fake.lookups.producer : fake.lookups.grapeVariety, [`${entityType.toLowerCase()}-id`]);
  }
});

test("Production custom values accept TEXT, INTEGER, BOOLEAN and SELECT values", async () => {
  for (const [dataType, value, field] of [
    ["TEXT", "hello", "textValue"],
    ["INTEGER", 42, "integerValue"],
    ["BOOLEAN", true, "booleanValue"],
    ["SELECT", "red", "selectValue"],
  ] as const) {
    const fake = productionFake({
      id: "definition-id", entityType: "PRODUCER", active: true, dataType,
      options: dataType === "SELECT" ? ["red", "white"] : null,
    });
    await new ProductionService(fake.prisma, {} as never).setValue({
      definitionId: "00000000-0000-4000-8000-000000000001",
      entityType: "PRODUCER", entityId: "00000000-0000-4000-8000-000000000002", value,
    }, { actorUserId: "actor-id" });
    assert.equal(fake.read()?.[field], value);
  }
});

test("Production custom values reject inactive/missing/mismatched definitions and owners", async () => {
  const context = { actorUserId: "actor-id" };
  const inactive = productionFake({ id: "definition-id", entityType: "PRODUCER", active: false, dataType: "TEXT", options: null });
  await assert.rejects(() => new ProductionService(inactive.prisma, {} as never).setValue({
    definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "00000000-0000-4000-8000-000000000002", value: "x",
  }, context), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_DEFINITION_INACTIVE");
  const missingOwner = productionFake({ id: "definition-id", entityType: "PRODUCER", active: true, dataType: "TEXT", options: null }, null);
  await assert.rejects(() => new ProductionService(missingOwner.prisma, {} as never).setValue({
    definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "missing", value: "x",
  }, context), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_ENTITY_NOT_FOUND");
  const mismatch = productionFake({ id: "definition-id", entityType: "GRAPE_VARIETY", active: true, dataType: "TEXT", options: null });
  await assert.rejects(() => new ProductionService(mismatch.prisma, {} as never).setValue({
    definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "owner", value: "x",
  }, context), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_DEFINITION_NOT_FOUND");
  const inactiveOwner = productionFake({ id: "definition-id", entityType: "PRODUCER", active: true, dataType: "TEXT", options: null }, { id: "owner", active: false });
  await assert.rejects(() => new ProductionService(inactiveOwner.prisma, {} as never).setValue({
    definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "owner", value: "x",
  }, context), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_ENTITY_INACTIVE");
});

test("Production custom values reject invalid SELECT options and non-integer INTEGER values", async () => {
  const select = productionFake({ id: "definition-id", entityType: "PRODUCER", active: true, dataType: "SELECT", options: ["red"] });
  const service = new ProductionService(select.prisma, {} as never);
  await assert.rejects(() => service.setValue({
    definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "owner", value: "blue",
  }, { actorUserId: "actor" }), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_VALUE_INVALID");
  const integer = productionFake({ id: "definition-id", entityType: "PRODUCER", active: true, dataType: "INTEGER", options: null });
  await assert.rejects(() => new ProductionService(integer.prisma, {} as never).setValue({
    definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "owner", value: 1.5,
  }, { actorUserId: "actor" }), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_VALUE_INVALID");
  for (const value of [-2_147_483_649, 2_147_483_648]) {
    await assert.rejects(() => new ProductionService(integer.prisma, {} as never).setValue({
      definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "owner", value,
    }, { actorUserId: "actor" }), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_VALUE_INVALID");
  }
  const decimal = productionFake({ id: "definition-id", entityType: "PRODUCER", active: true, dataType: "DECIMAL", options: null });
  for (const value of ["1234567890123", "1.1234567"]) {
    await assert.rejects(() => new ProductionService(decimal.prisma, {} as never).setValue({
      definitionId: "00000000-0000-4000-8000-000000000001", entityType: "PRODUCER", entityId: "owner", value,
    }, { actorUserId: "actor" }), (e: unknown) => e instanceof AppError && e.code === "CUSTOM_FIELD_VALUE_INVALID");
  }
});

test("Production P1 migration declares exact-one value, uniqueness and required indexes", async () => {
  const fs = await import("node:fs/promises");
  const sql = await fs.readFile(new URL("../prisma/migrations/20260914000000_production_p1/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /num_nonnulls\("text_value", "integer_value", "decimal_value", "boolean_value", "date_value", "select_value"\) = 1/);
  assert.match(sql, /production_custom_field_values_definition_id_entity_id_key/);
  assert.match(sql, /production_participants_user_id_idx/);
});

function catalogFake(options: {
  existing?: Record<string, unknown> | null;
  codeExists?: boolean;
  create?: () => Promise<Record<string, unknown>>;
  update?: () => Promise<Record<string, unknown>>;
  audit?: () => Promise<void>;
}) {
  const audits: unknown[] = [];
  const item = options.existing ?? { id: "catalog-id", code: "P-1", name: "Old", active: true };
  const tx = {
    productionParticipant: {
      findUnique: async ({ where }: { where: { id?: string; code?: string } }) =>
        where.code !== undefined && options.codeExists !== true ? null : item,
      create: options.create ?? (async () => ({ ...item })),
      update: options.update ?? (async () => ({ ...item, name: "New" })),
      findMany: async () => [], count: async () => 0,
    },
    producer: { findUnique: async () => item, create: async () => ({ ...item }), update: options.update ?? (async () => ({ ...item })), findMany: async () => [], count: async () => 0 },
    grapeVariety: { findUnique: async () => item, create: async () => ({ ...item }), update: options.update ?? (async () => ({ ...item })), findMany: async () => [], count: async () => 0 },
    auditLog: { create: async (args: unknown) => { audits.push(args); await options.audit?.(); } },
  };
  const prisma = { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
  return { prisma, audits };
}

test("Production catalog create/update/activate/deactivate audit actor, request and immutable code", async () => {
  const fake = catalogFake({});
  const service = new ProductionService(fake.prisma, {} as never);
  const context = { actorUserId: "actor", ipAddress: "127.0.0.1", requestId: "request" };
  const created = await service.create("participants", { code: "P-1", name: "New" }, context);
  assert.equal(created.id, "catalog-id");
  await service.update("participants", "catalog-id", { name: "Changed" }, context);
  await service.setActive("participants", "catalog-id", true, context);
  await service.setActive("participants", "catalog-id", false, context);
  assert.equal(fake.audits.length, 4);
  const audit = fake.audits[0] as { data: { actorUserId: string; requestId: string; metadata: { code: string } } };
  assert.equal(audit.data.actorUserId, "actor");
  assert.equal(audit.data.requestId, "request");
  assert.deepEqual(audit.data.metadata, { code: "P-1" });
});

test("Production catalog maps P2002 to 409 and P2025 to 404", async () => {
  const duplicate = catalogFake({ create: async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); } });
  await assert.rejects(
    new ProductionService(duplicate.prisma, {} as never).create("participants", { code: "P-1", name: "P" }, { actorUserId: "a" }),
    (e: unknown) => e instanceof AppError && e.statusCode === 409,
  );
  const missing = catalogFake({ existing: null, update: async () => { throw Object.assign(new Error("missing"), { code: "P2025" }); } });
  await assert.rejects(
    new ProductionService(missing.prisma, {} as never).update("participants", "missing", { name: "P" }, { actorUserId: "a" }),
    (e: unknown) => e instanceof AppError && e.statusCode === 404,
  );
});

test("Production custom definitions validate SELECT options, non-SELECT options and duplicate codes", async () => {
  const fake = catalogFake({});
  const service = new ProductionService(fake.prisma, {} as never);
  const context = { actorUserId: "actor" };
  await assert.rejects(() => service.createDefinition({ entityType: "PRODUCER", code: "x", label: "X", dataType: "SELECT", required: false, active: true, displayOrder: 0 }, context), /options/);
  await assert.rejects(() => service.createDefinition({ entityType: "PRODUCER", code: "x", label: "X", dataType: "TEXT", required: false, active: true, options: ["bad"], displayOrder: 0 }, context), /Only SELECT/);
  const duplicate = catalogFake({});
  duplicate.prisma = { $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
    customFieldDefinition: { create: async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); } },
    auditLog: { create: async () => undefined },
  }) } as unknown as PrismaClient;
  await assert.rejects(() => new ProductionService(duplicate.prisma, {} as never).createDefinition({ entityType: "PRODUCER", code: "x", label: "X", dataType: "TEXT", required: false, active: true, displayOrder: 0 }, context), (e: unknown) => e instanceof AppError && e.statusCode === 409);
});

test("Production custom definitions support update/activate/deactivate with audit context", async () => {
  const audits: unknown[] = [];
  const definition = {
    id: "definition-id", entityType: "PRODUCER", code: "FIELD", label: "Old",
    dataType: "TEXT", required: false, active: true, options: null, displayOrder: 0,
  };
  const tx = {
    customFieldDefinition: {
      findUnique: async () => definition,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...definition, ...data }),
    },
    auditLog: { create: async (args: unknown) => { audits.push(args); } },
  };
  const prisma = { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
  const service = new ProductionService(prisma, {} as never);
  const context = { actorUserId: "actor", requestId: "definition-request" };
  const updated = await service.updateDefinition("definition-id", { label: "New", required: true }, context);
  assert.equal((updated as { label: string }).label, "New");
  await service.setDefinitionActive("definition-id", true, context);
  await service.setDefinitionActive("definition-id", false, context);
  assert.equal(audits.length, 3);
  assert.deepEqual((audits[0] as { data: Record<string, unknown> }).data, {
    action: "PRODUCTION_CUSTOM_FIELD_DEFINITION_UPDATED",
    resourceType: "production.custom_field_definition",
    resourceId: "definition-id",
    actorUserId: "actor",
    requestId: "definition-request",
  });
});