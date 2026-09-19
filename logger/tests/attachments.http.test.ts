import assert from "node:assert/strict";
import express from "express";
import { after, before, test } from "node:test";
import { createAttachmentRouter } from "../src/modules/attachments/attachment.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { AppError } from "../src/shared/errors/app-error.js";

const user = { id: "11111111-1111-4111-8111-111111111111", status: "ACTIVE", roles: [], permissions: ["production:read", "attachments:create", "attachments:read"] } as any;
const verifier = { verify: async () => ({ uid: "firebase-test" }) };
const users = { findByFirebaseUid: async () => user } as any;
const calls: string[] = [];
const service = {
  create: async (input: any) => {
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(input.file.mimetype)) throw new AppError("ATTACHMENT_MIME_NOT_ALLOWED", "unsupported", 400);
    if (!/^[0-9a-f-]{36}$/i.test(input.entityId)) throw new AppError("ATTACHMENT_INVALID_TARGET_ID", "uuid", 400);
    if (typeof input.observations !== "undefined" && typeof input.observations !== "string") throw new AppError("ATTACHMENT_INVALID_OBSERVATIONS", "Observations must be text", 400);
    calls.push(`create:${input.entityType}:${input.entityId}`); return { id: "33333333-3333-4333-8333-333333333333", entityType: input.entityType, entityId: input.entityId, fileName: input.file.originalname, mimeType: input.file.mimetype };
  },
  list: async (entityType: string, entityId: string) => [{ id: "33333333-3333-4333-8333-333333333333", entityType, entityId }],
  detail: async (id: string) => ({ id, fileName: "x.jpg" }),
  downloadUrl: async () => "https://signed.invalid/object",
} as any;
const app = express();
app.use("/attachments", createAttachmentRouter(verifier, users, service, 300));
app.use(errorHandler);
let server: ReturnType<typeof app.listen>;
let base = "";
before(async () => { server = app.listen(0); await new Promise<void>((resolve) => server.once("listening", resolve)); base = `http://127.0.0.1:${(server.address() as any).port}/attachments`; });
after(() => server.close());

function multipart(fields: Record<string, string>, file?: { name: string; type: string; data: Uint8Array }) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (file) form.append("file", new Blob([file.data], { type: file.type }), file.name);
  return form;
}
const id = "22222222-2222-4222-8222-222222222222";

test("HTTP multipart POST valid, GET list/detail/download URL and no DELETE", async () => {
  const post = await fetch(base, { method: "POST", headers: { Authorization: "Bearer test" }, body: multipart({ entityType: "PRODUCTION_WORK", entityId: id, observations: "ok" }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255,0]) }) });
  assert.equal(post.status, 201);
  const list = await fetch(`${base}?entityType=PRODUCTION_WORK&entityId=${id}`, { headers: { Authorization: "Bearer test" } });
  assert.equal(list.status, 200);
  const detail = await fetch(`${base}/33333333-3333-4333-8333-333333333333`, { headers: { Authorization: "Bearer test" } });
  assert.equal(detail.status, 200);
  const download = await fetch(`${base}/33333333-3333-4333-8333-333333333333/download-url`, { headers: { Authorization: "Bearer test" } });
  assert.equal(download.status, 200);
  assert.deepEqual(await download.json(), { url: "https://signed.invalid/object", expiresIn: 300 });
  assert.equal((await fetch(`${base}/33333333-3333-4333-8333-333333333333`, { method: "DELETE", headers: { Authorization: "Bearer test" } })).status, 404);
});

test("HTTP rejects missing file, unsupported MIME, malformed target, unexpected fields and extra file", async () => {
  const headers = { Authorization: "Bearer test" };
  assert.equal((await fetch(base, { method: "POST", headers, body: multipart({ entityType: "PRODUCTION_WORK", entityId: id }) })).status, 400);
  assert.equal((await fetch(base, { method: "POST", headers, body: multipart({ entityType: "PRODUCTION_WORK", entityId: id }, { name: "x.bin", type: "application/octet-stream", data: new Uint8Array([1]) }) })).status, 400);
  assert.equal((await fetch(base, { method: "POST", headers, body: multipart({ entityType: "PRODUCTION_WORK", entityId: "bad" }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255]) }) })).status, 400);
  const extra = multipart({ entityType: "PRODUCTION_WORK", entityId: id, extra: "no" }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255]) });
  assert.equal((await fetch(base, { method: "POST", headers, body: extra })).status, 400);
  const two = multipart({ entityType: "PRODUCTION_WORK", entityId: id }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255]) });
  two.append("file", new Blob([new Uint8Array([255,216,255])], { type: "image/jpeg" }), "y.jpg");
  assert.equal((await fetch(base, { method: "POST", headers, body: two })).status, 400);
});

test("HTTP maps multipart file-size limit to 413", async () => {
  const data = new Uint8Array(10 * 1024 * 1024 + 1);
  data[0] = 0xff; data[1] = 0xd8; data[2] = 0xff;
  const response = await fetch(base, { method: "POST", headers: { Authorization: "Bearer test" }, body: multipart({ entityType: "PRODUCTION_WORK", entityId: id }, { name: "large.jpg", type: "image/jpeg", data }) });
  assert.equal(response.status, 413);
});

test("HTTP maps oversized and duplicate observations to stable errors", async () => {
  const headers = { Authorization: "Bearer test" };
  const oversized = multipart({ entityType: "PRODUCTION_WORK", entityId: id, observations: "x".repeat(4097) }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255]) });
  const tooLarge = await fetch(base, { method: "POST", headers, body: oversized });
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).error.code, "ATTACHMENT_TOO_LARGE");
  const duplicate = multipart({ entityType: "PRODUCTION_WORK", entityId: id, observations: "first" }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255]) });
  duplicate.append("observations", "second");
  const duplicated = await fetch(base, { method: "POST", headers, body: duplicate });
  assert.equal(duplicated.status, 400);
  assert.ok(["ATTACHMENT_INVALID_OBSERVATIONS", "ATTACHMENT_MULTIPART_INVALID"].includes((await duplicated.json()).error.code));
});

for (const permission of ["production:read", "attachments:create", "attachments:read"] as const) {
  test(`HTTP RBAC denies missing ${permission}`, async () => {
    const previous = [...user.permissions];
    user.permissions = previous.filter((candidate: string) => candidate !== permission);
    const response = permission === "attachments:read"
      ? await fetch(`${base}?entityType=PRODUCTION_WORK&entityId=${id}`, { headers: { Authorization: "Bearer test" } })
      : await fetch(base, { method: "POST", headers: { Authorization: "Bearer test" }, body: multipart({ entityType: "PRODUCTION_WORK", entityId: id }, { name: "x.jpg", type: "image/jpeg", data: new Uint8Array([255,216,255]) }) });
    assert.equal(response.status, 403);
    user.permissions = previous;
  });
}