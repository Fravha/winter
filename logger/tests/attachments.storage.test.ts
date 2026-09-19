import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { SupabaseAttachmentStorageProvider } from "../src/modules/attachments/attachment.storage.js";
import { contentMatches } from "../src/modules/attachments/attachment.validation.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("attachment content sniffing accepts all four signatures and rejects spoofing", () => {
  const cases = [
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]), true],
    ["image/png", Buffer.from([137,80,78,71,13,10,26,10]), true],
    ["image/webp", Buffer.from("RIFFxxxxWEBP"), true],
    ["application/pdf", Buffer.from("%PDF-1.7"), true],
    ["image/png", Buffer.from("%PDF-"), false],
    ["application/pdf", Buffer.alloc(0), false],
  ] as const;
  for (const [mimetype, buffer, expected] of cases) {
    assert.equal(contentMatches({ mimetype, buffer, size: buffer.length, originalname: "x" }), expected);
  }
});

test("Supabase provider rejects missing and public buckets without exposing details", async () => {
  const unconfigured = new SupabaseAttachmentStorageProvider(undefined, undefined);
  await assert.rejects(unconfigured.exists("safe/key"), (error: unknown) => (error as { code: string }).code === "ATTACHMENTS_STORAGE_NOT_CONFIGURED");
  globalThis.fetch = async () => new Response(JSON.stringify({ public: true }), { status: 200 });
  const provider = new SupabaseAttachmentStorageProvider("https://example.test", "secret");
  await assert.rejects(provider.exists("safe/key"), (error: unknown) => (error as { code: string }).code === "ATTACHMENTS_BUCKET_NOT_PRIVATE");
  globalThis.fetch = async () => new Response("", { status: 404 });
  await assert.rejects(provider.exists("safe/key"), (error: unknown) => (error as { code: string }).code === "ATTACHMENTS_BUCKET_UNAVAILABLE");
});

test("Supabase provider distinguishes a missing object from storage failure", async () => {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ public: false }), { status: 200 });
    assert.equal(init?.method, "HEAD");
    return new Response("", { status: 404 });
  };
  const provider = new SupabaseAttachmentStorageProvider("https://example.test", "secret");
  assert.equal(await provider.exists("safe/key"), false);
});

test("Supabase provider uses private bucket checks and exact storage requests", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (requests.length === 1) return new Response(JSON.stringify({ public: false }), { status: 200 });
    if (requests.length === 2) return new Response("", { status: 200 });
    if (requests.length === 3) return new Response(JSON.stringify({ public: false }), { status: 200 });
    return new Response(JSON.stringify({ signedURL: "/object/sign/winter-attachments/safe%2Fkey?token=x" }), { status: 200 });
  };
  const provider = new SupabaseAttachmentStorageProvider("https://example.test", "secret", "winter-attachments");
  await provider.upload("safe/key", Buffer.from("x"), "application/pdf");
  assert.equal(requests[0].url, "https://example.test/storage/v1/bucket/winter-attachments");
  assert.equal(requests[1].url, "https://example.test/storage/v1/object/winter-attachments/safe/key");
  assert.equal((requests[1].init?.headers as Record<string, string>)["x-upsert"], "false");
  assert.equal(await provider.createSignedDownloadUrl("safe/key", 300), "https://example.test/storage/v1/object/sign/winter-attachments/safe%2Fkey?token=x");
  assert.equal(requests[3].url, "https://example.test/storage/v1/object/sign/winter-attachments/safe/key");
  assert.deepEqual(JSON.parse(String(requests[3].init?.body)), { expiresIn: 300 });
});

test("Supabase delete, malformed signed responses, non-2xx and timeout are safe errors", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (requests.length === 1) return new Response(JSON.stringify({ public: false }), { status: 200 });
    return new Response("", { status: 200 });
  };
  const provider = new SupabaseAttachmentStorageProvider("https://example.test", "secret");
  await provider.delete("safe/key");
  assert.equal(requests[1].init?.method, "DELETE");
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), { prefixes: ["safe/key"] });
  globalThis.fetch = async (_input, _init) => new Response(JSON.stringify({ public: false }), { status: 200 });
  await assert.rejects(provider.createSignedDownloadUrl("safe/key", 300), (error: any) => error.code === "ATTACHMENTS_SIGNED_URL_FAILED");
  globalThis.fetch = async () => new Response("", { status: 500 });
  await assert.rejects(provider.exists("safe/key"), (error: any) => error.code === "ATTACHMENTS_BUCKET_UNAVAILABLE");
  globalThis.fetch = async () => { throw new Error("timeout"); };
  await assert.rejects(provider.exists("safe/key"), (error: any) => error.code === "ATTACHMENTS_STORAGE_UNAVAILABLE");
});