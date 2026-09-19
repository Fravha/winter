import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTemporaryProductionDatabaseResource,
  getTemporaryProductionDatabaseUrl,
} from "./helpers/production-test-database.js";

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
    assert.throws(
      () => getTemporaryProductionDatabaseUrl("P7_DATABASE_URL", {
        P7_DATABASE_URL: "postgresql://user:pass@development.example.com/winter",
      }),
      /temporary PostgreSQL database on 127\.0\.0\.1/,
    );
  });

  it("rejects a remote host even when the database name looks temporary", () => {
    assert.throws(
      () => getTemporaryProductionDatabaseUrl("P5_DATABASE_URL", {
        P5_DATABASE_URL: "postgresql://user:pass@development.example.com/winter_p5_test",
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

  it("does not construct a database resource before the guard passes", () => {
    let resourceCreations = 0;
    const factory = (connectionString: string) => {
      resourceCreations += 1;
      return connectionString;
    };

    assert.equal(
      createTemporaryProductionDatabaseResource("P5_DATABASE_URL", factory, {
        WINTER_DATABASE_URL: "postgresql://user:pass@development.example.com/winter",
      }),
      undefined,
    );
    assert.equal(resourceCreations, 0);

    assert.throws(
      () => createTemporaryProductionDatabaseResource("P5_DATABASE_URL", factory, {
        P5_DATABASE_URL: "postgresql://user:pass@development.example.com/winter_p5_test",
      }),
      /temporary PostgreSQL database on 127\.0\.0\.1/,
    );
    assert.equal(resourceCreations, 0);

    const connectionString = "postgresql://postgres:postgres@127.0.0.1:5432/winter_p5_test";
    assert.equal(
      createTemporaryProductionDatabaseResource("P5_DATABASE_URL", factory, {
        P5_DATABASE_URL: connectionString,
      }),
      connectionString,
    );
    assert.equal(resourceCreations, 1);
  });
});