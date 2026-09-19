import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Router } from "express";

import type { DocType, DocTypeDependencies } from "../src/modules/doc-types/doc-type.js";
import { DocTypeRegistry } from "../src/modules/doc-types/doc-type.registry.js";

const dependencies = {} as DocTypeDependencies;

function definition(
  name: string,
  route: `/${string}`,
  api: string,
  required: readonly string[] = [],
): DocType<string> {
  return {
    name,
    route,
    permissions: [{ code: `${name}:read`, name: `Read ${name}` }],
    dependencies: required,
    register(_dependencies, resolve) {
      const dependencyApi = required.map((dependency) => resolve<string>(dependency));
      return { router: Router(), api: [...dependencyApi, api].join(":") };
    },
  };
}

describe("DocTypeRegistry", () => {
  it("registers dependencies before dependants and exposes their public API", () => {
    const registry = new DocTypeRegistry(dependencies);
    registry.registerAll([
      definition("sales", "/sales", "sales", ["catalog"]),
      definition("catalog", "/catalog", "catalog"),
    ]);

    assert.equal(registry.resolve<string>("catalog"), "catalog");
    assert.equal(registry.resolve<string>("sales"), "catalog:sales");
    assert.deepEqual(registry.list().map(({ name }) => name), ["catalog", "sales"]);
  });

  it("rejects duplicate routes", () => {
    const registry = new DocTypeRegistry(dependencies);
    assert.throws(
      () => registry.registerAll([
        definition("catalog", "/catalog", "catalog"),
        definition("sales", "/catalog", "sales"),
      ]),
      /already registered/,
    );
  });

  it("rejects permissions duplicated across docTypes", () => {
    const catalog = definition("catalog", "/catalog", "catalog");
    const sales = definition("sales", "/sales", "sales");
    sales.permissions = [{ code: "catalog:read", name: "Read catalog" }];

    const registry = new DocTypeRegistry(dependencies);
    assert.throws(
      () => registry.registerAll([catalog, sales]),
      /permission 'catalog:read' is already registered/,
    );
  });

  it("rejects missing or circular dependencies", () => {
    const registry = new DocTypeRegistry(dependencies);
    assert.throws(
      () => registry.registerAll([
        definition("sales", "/sales", "sales", ["catalog"]),
      ]),
      /Unresolved docType dependencies/,
    );
  });
});
