import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentService } from "../src/modules/attachments/attachment.service.js";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

class FakeAttachmentStorageProvider {
  uploads: { key: string; content: Buffer; mime: string }[] = [];
  deletes: string[] = [];
  failUpload = false;
  failDelete = false;
  async upload(key: string, content: Buffer, mime: string) {
    if (this.failUpload) throw new Error("fake upload");
    this.uploads.push({ key, content, mime });
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error("fake delete");
    this.deletes.push(key);
  }
  async exists() { return true; }
  async createSignedDownloadUrl(key: string) { return `https://signed.invalid/${encodeURIComponent(key)}`; }
}

function fakePrisma(options: { auditFails?: boolean; attachmentFails?: boolean } = {}) {
  const row = (id = target) => ({ id });
  const attachments: any[] = [];
  const client: any = {
    grapeReception: { findUnique: async () => null },
    productionWork: { findUnique: async () => row() },
    productionMeasurement: { findUnique: async () => null },
    transformation: { findUnique: async () => null },
    productionLoss: { findUnique: async () => null },
    attachment: {
      create: async ({ data }: any) => {
        if (options.attachmentFails) throw new Error("db failure");
        const value = { ...data, createdAt: new Date(), observations: data.observations ?? null };
        attachments.push(value); return value;
      },
      findUnique: async ({ where }: any) => attachments.find((value) => value.id === where.id) ?? null,
      findMany: async () => attachments,
    },
    auditLog: { create: async () => { if (options.auditFails) throw new Error("audit failure"); } },
    $transaction: async (fn: any) => fn(client),
  };
  return { client, attachments };
}

const signatures = [
  ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
  ["image/png", Buffer.from([137,80,78,71,13,10,26,10])],
  ["image/webp", Buffer.from("RIFFxxxxWEBP")],
  ["application/pdf", Buffer.from("%PDF-1.7")],
] as const;

for (const [mime, buffer] of signatures) {
  test(`creates metadata for ${mime}`, async () => {
    const storage = new FakeAttachmentStorageProvider();
    const { client, attachments } = fakePrisma();
    const result = await new AttachmentService(client, storage).create({
      entityType: "PRODUCTION_WORK", entityId: target,
      file: { originalname: "../evidence unsafe.jpg", mimetype: mime, size: buffer.length, buffer },
      actorUserId: actor,
    });
    assert.equal(attachments.length, 1);
    assert.equal(result.uploadedByUserId, actor);
    assert.match(storage.uploads[0].key, new RegExp(`^production/production_work/${target}/`));
    assert.ok(!storage.uploads[0].key.includes(".."));
  });
}

test("audit/db failure compensates storage and cleanup failure is explicit", async () => {
  const storage = new FakeAttachmentStorageProvider();
  const { client } = fakePrisma({ auditFails: true });
  await assert.rejects(new AttachmentService(client, storage).create({
    entityType: "PRODUCTION_WORK", entityId: target,
    file: { originalname: "x.pdf", mimetype: "application/pdf", size: 8, buffer: Buffer.from("%PDF-1.7") },
    actorUserId: actor,
  }), /audit failure/);
  assert.equal(storage.deletes.length, 1);
  storage.failDelete = true;
  await assert.rejects(new AttachmentService(client, storage).create({
    entityType: "PRODUCTION_WORK", entityId: target,
    file: { originalname: "x.pdf", mimetype: "application/pdf", size: 8, buffer: Buffer.from("%PDF-1.7") },
    actorUserId: actor,
  }), (error: any) => error.code === "ATTACHMENT_ORPHANED_STORAGE" && !String(error.message).includes("storageKey"));
});

test("unsupported target, malformed UUID, spoof and provider failure never write metadata", async () => {
  const storage = new FakeAttachmentStorageProvider();
  const { client, attachments } = fakePrisma();
  const service = new AttachmentService(client, storage);
  await assert.rejects(service.create({ entityType: "Purchase", entityId: target, file: { originalname: "x.pdf", mimetype: "application/pdf", size: 8, buffer: Buffer.from("%PDF-1.7") }, actorUserId: actor }), /Unsupported/);
  await assert.rejects(service.create({ entityType: "PRODUCTION_WORK", entityId: "not-uuid", file: { originalname: "x.pdf", mimetype: "application/pdf", size: 8, buffer: Buffer.from("%PDF-1.7") }, actorUserId: actor }), /UUID/);
  await assert.rejects(service.create({ entityType: "PRODUCTION_WORK", entityId: target, file: { originalname: "x.pdf", mimetype: "application/pdf", size: 5, buffer: Buffer.from("hello") }, actorUserId: actor }));
  storage.failUpload = true;
  await assert.rejects(service.create({ entityType: "PRODUCTION_WORK", entityId: target, file: { originalname: "x.pdf", mimetype: "application/pdf", size: 8, buffer: Buffer.from("%PDF-1.7") }, actorUserId: actor }));
  assert.equal(attachments.length, 0);
});

test("enforces 10 MiB boundary without storing oversized input", async () => {
  const exact = Buffer.alloc(10 * 1024 * 1024);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(exact);
  const storage = new FakeAttachmentStorageProvider();
  const { client } = fakePrisma();
  const service = new AttachmentService(client, storage);
  await service.create({ entityType: "PRODUCTION_WORK", entityId: target, file: { originalname: "large.png", mimetype: "image/png", size: exact.length, buffer: exact }, actorUserId: actor });
  await assert.rejects(service.create({ entityType: "PRODUCTION_WORK", entityId: target, file: { originalname: "too-large.png", mimetype: "image/png", size: exact.length + 1, buffer: Buffer.from([137,80,78,71,13,10,26,10]) }, actorUserId: actor }), (error: any) => error.code === "ATTACHMENT_TOO_LARGE");
});