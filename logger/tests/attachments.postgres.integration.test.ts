import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";
import { AttachmentService } from "../src/modules/attachments/attachment.service.js";

const url = getTemporaryProductionDatabaseUrl("P10_5_DATABASE_URL");

class FakeStorage {
  uploads: string[] = [];
  deletes: string[] = [];
  existsCalls: string[] = [];
  signedCalls: { key: string; seconds: number }[] = [];
  failDelete = false;
  async upload(key: string) { this.uploads.push(key); }
  async delete(key: string) { if (this.failDelete) throw new Error("cleanup failure"); this.deletes.push(key); }
  async exists(key: string) { this.existsCalls.push(key); return true; }
  async createSignedDownloadUrl(key: string, seconds: number) { this.signedCalls.push({ key, seconds }); return "https://signed.invalid/private"; }
}

test("P10.5 PostgreSQL end-to-end metadata, isolation, audit, rollback and immutability", { skip: !url }, async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const suffix = `p105_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let userId = "";
  let orderId = "";
  let workId = "";
  let measurementId = "";
  let measurementTypeId = "";
  const storage = new FakeStorage();
  try {
    const user = await prisma.user.create({ data: { firebaseUid: `${suffix}_firebase`, email: `${suffix}@example.test`, status: "ACTIVE" } });
    userId = user.id;
    const order = await prisma.productionOrder.create({ data: { code: `${suffix}_order`, startDate: new Date(), status: "OPEN" } });
    orderId = order.id;
    const workType = await prisma.workType.create({ data: { code: `${suffix}_work`, name: "P10.5 work", active: true } });
    const work = await prisma.productionWork.create({ data: { productionOrderId: order.id, workTypeId: workType.id, performedAt: new Date(), createdByUserId: user.id } });
    workId = work.id;
    const measurementType = await prisma.measurementType.create({ data: { code: `${suffix}_measurement`, name: "P10.5 measurement", active: true } });
    measurementTypeId = measurementType.id;
    const measurement = await prisma.productionMeasurement.create({ data: { measurementTypeId: measurementType.id, productionWorkId: work.id, value: "12.5", unit: "kg", measuredAt: new Date(), actorUserId: user.id } });
    measurementId = measurement.id;
    const service = new AttachmentService(prisma, storage);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
    const png = Buffer.from([137,80,78,71,13,10,26,10]);
    const pdf = Buffer.from("%PDF-1.7");
    const beforeWork = await prisma.productionWork.findUnique({ where: { id: work.id } });
    const beforeMeasurement = await prisma.productionMeasurement.findUnique({ where: { id: measurement.id } });
    const a = await service.create({ entityType: "PRODUCTION_WORK", entityId: work.id, actorUserId: user.id, observations: "first", file: { originalname: "../first.jpg", mimetype: "image/jpeg", size: jpeg.length, buffer: jpeg } });
    const b = await service.create({ entityType: "PRODUCTION_WORK", entityId: work.id, actorUserId: user.id, observations: "second", file: { originalname: "second.png", mimetype: "image/png", size: png.length, buffer: png } });
    const c = await service.create({ entityType: "MEASUREMENT", entityId: measurement.id, actorUserId: user.id, observations: "reading", file: { originalname: "reading.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf } });
    assert.equal(a.storageProvider, "SUPABASE");
    assert.equal(a.fileName, "first.jpg");
    assert.equal(a.observations, "first");
    assert.equal(a.uploadedByUserId, user.id);
    assert.match(storage.uploads[0], new RegExp(`^production/production_work/${work.id}/`));
    assert.notEqual(storage.uploads[0], storage.uploads[1]);
    assert.ok(storage.uploads.every((key) => !key.includes("..")));
    const rows = await prisma.attachment.findMany({ where: { entityId: work.id }, orderBy: { createdAt: "asc" } });
    assert.equal(rows.length, 2);
    assert.equal((await service.list("PRODUCTION_WORK", work.id)).length, 2);
    assert.equal((await service.list("MEASUREMENT", measurement.id)).length, 1);
    const snapshot = JSON.stringify(await prisma.attachment.findUnique({ where: { id: a.id } }));
    assert.deepEqual(await service.detail(a.id), { id: a.id, entityType: "PRODUCTION_WORK", entityId: work.id, fileName: "first.jpg", mimeType: "image/jpeg", fileSize: jpeg.length, storageProvider: "SUPABASE", uploadedByUserId: user.id, createdAt: (await prisma.attachment.findUnique({ where: { id: a.id } }))!.createdAt, observations: "first" });
    assert.equal(await service.downloadUrl(a.id, 300), "https://signed.invalid/private");
    assert.deepEqual(storage.signedCalls[0], { key: storage.uploads[0], seconds: 300 });
    assert.deepEqual(JSON.stringify(await prisma.attachment.findUnique({ where: { id: a.id } })), snapshot);
    const audit = await prisma.auditLog.findFirst({ where: { action: "ATTACHMENT_CREATED", resourceId: a.id } });
    assert.equal(audit?.actorUserId, user.id);
    assert.equal((audit?.metadata as any).storageKey, storage.uploads[0]);
    assert.equal((audit?.metadata as any).entityId, work.id);
    assert.equal((audit?.metadata as any).fileSize, jpeg.length);
    assert.deepEqual(await prisma.productionWork.findUnique({ where: { id: work.id } }), beforeWork);
    assert.deepEqual(await prisma.productionMeasurement.findUnique({ where: { id: measurement.id } }), beforeMeasurement);
    await assert.rejects(service.create({ entityType: "PRODUCTION_WORK", entityId: "33333333-3333-4333-8333-333333333333", actorUserId: user.id, file: { originalname: "x.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf } }), (error: any) => error.code === "ATTACHMENT_TARGET_NOT_FOUND");
    assert.equal(storage.uploads.length, 3);

    const failingAudit = new AttachmentService(prisma, storage, async () => { throw new Error("injected audit failure"); });
    await assert.rejects(failingAudit.create({ entityType: "PRODUCTION_WORK", entityId: work.id, actorUserId: user.id, file: { originalname: "rollback.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf } }), /injected audit failure/);
    assert.equal(await prisma.attachment.count({ where: { fileName: "rollback.pdf" } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { resourceType: "Attachment", resourceId: { not: null } } }), 3);
    storage.failDelete = true;
    await assert.rejects(failingAudit.create({ entityType: "PRODUCTION_WORK", entityId: work.id, actorUserId: user.id, file: { originalname: "orphan.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf } }), (error: any) => error.code === "ATTACHMENT_ORPHANED_STORAGE" && !error.message.includes("storageKey") && !error.message.includes("provider"));
    assert.equal(await prisma.attachment.count({ where: { fileName: "orphan.pdf" } }), 0);
  } finally {
    if (userId) {
      await prisma.attachment.deleteMany({ where: { uploadedByUserId: userId } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: userId, resourceType: "Attachment" } });
    }
    // Production history is intentionally append-only. These uniquely named
    // fixtures remain only in the disposable P10.5 test database.
    await prisma.$disconnect();
  }
});

test("P10.5 PostgreSQL physical contract", { skip: !url }, async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  try {
    const columns = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attachments'`);
    assert.ok(columns.length > 0);
    assert.ok(columns.every((column) => !["bytea", "oid"].includes(column.data_type)));
    const indexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(`SELECT indexname FROM pg_indexes WHERE tablename = 'attachments'`);
    for (const index of ["entity_type_entity_id", "uploaded_by_user_id", "created_at"]) assert.ok(indexes.some(({ indexname }) => indexname.includes(index)));
    const enums = await prisma.$queryRawUnsafe<{ typname: string }[]>(`SELECT typname FROM pg_type WHERE typname IN ('AttachmentEntityType','StorageProvider')`);
    assert.equal(enums.length, 2);
    const fks = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`SELECT kcu.column_name FROM information_schema.key_column_usage kcu JOIN information_schema.table_constraints tc ON tc.constraint_name=kcu.constraint_name WHERE tc.table_name='attachments' AND tc.constraint_type='FOREIGN KEY'`);
    assert.deepEqual(fks.map(({ column_name }) => column_name), ["uploaded_by_user_id"]);
    assert.equal(await prisma.permission.count({ where: { code: "attachments:read" } }), 1);
    assert.equal(await prisma.permission.count({ where: { code: "attachments:create" } }), 1);
  } finally { await prisma.$disconnect(); }
});