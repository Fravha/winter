import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAppEnv } from "../src/config/env.js";

test("blank Supabase values are treated as absent without blocking app configuration", () => {
  const config = parseAppEnv({
    NODE_ENV: "test", WINTER_DATABASE_URL: "postgresql://localhost/test",
    FIREBASE_WEB_API_KEY: "test", FIREBASE_PROJECT_ID: "test",
    FIREBASE_CLIENT_EMAIL: "firebase@example.test", FIREBASE_PRIVATE_KEY: "private",
    SUPABASE_URL: "", SUPABASE_SECRET_KEY: "",
  });
  assert.equal(config.SUPABASE_URL, undefined);
  assert.equal(config.SUPABASE_SECRET_KEY, undefined);
  assert.equal(config.ATTACHMENTS_BUCKET, "winter-attachments");
});