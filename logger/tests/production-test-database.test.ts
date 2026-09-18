import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";

describe("Production history test database guard", () => {
  it("does not inherit the development database when the suite-specific variable is absent", () => {
    assert.equal(getTemporaryProductionDatabaseUrl("P3_DATABASE_URL", {
      WINTER_DATABASE_URL: "postgresql://user:pass@development.example.com/winter",
    }), undefined);
  });

  it("rejects a development URL supplied accidentally through the suite-specific variable", () => {
    assert.throws(
      () => getTemporaryProductionDatabaseUrl("P5_DATABASE_URL", {
        P5_DATABASE_URL: "postgresql://user:pass@development.example.com/winter",
      }),
      /temporary PostgreSQL database on 127\.0\.0\.1/,
    );
  });

  it("rejects a normal localhost development database without a disposable-test name", () => {
    assert.throws(
      () => getTemporaryProductionDatabaseUrl("P5_DATABASE_URL", {
        P5_DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/winter",
      }),
      /name ends in _test or _temp/,
    );
  });

  it("rejects a suite URL that identifies the same localhost database as development", () => {
    assert.throws(
      () => getTemporaryProductionDatabaseUrl("P5_DATABASE_URL", {
        P5_DATABASE_URL: "postgresql://test_user:test_pass@127.0.0.1/winter_test",
        WINTER_DATABASE_URL: "postgresql://development_user:development_pass@127.0.0.1:5432/winter_test?schema=public",
      }),
      /must not identify the same database as WINTER_DATABASE_URL/,
    );
  });

  it("rejects query parameters that can override the validated PostgreSQL destination", () => {
    for (const query of [
      "host=development.example.com",
      "hostaddr=203.0.113.10",
      "port=6543",
      "dbname=winter",
    ]) {
      assert.throws(
        () => getTemporaryProductionDatabaseUrl("P5_DATABASE_URL", {
          P5_DATABASE_URL: `postgresql://test:test@127.0.0.1/winter_test?${query}`,
        }),
        /without query parameters/,
      );
    }
  });

  it("accepts an explicit temporary PostgreSQL URL on 127.0.0.1", () => {
    const connectionString = "postgresql://postgres:postgres@127.0.0.1:5432/winter_p5_test";
    assert.equal(
      getTemporaryProductionDatabaseUrl("P5_DATABASE_URL", { P5_DATABASE_URL: connectionString }),
      connectionString,
    );
  });
});