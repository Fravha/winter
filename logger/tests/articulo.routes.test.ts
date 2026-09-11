import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import { createArticuloRouter } from "../src/modules/articulos/articulo.routes.js";
import type { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";

const articuloId = "62d78084-e485-4d93-9603-30f00b72115f";
const now = new Date("2026-09-11T00:00:00.000Z");
const articulo = {
  id: articuloId,
  codigo: "ART-001",
  nombre: "Botella",
  clasificacion: "MATERIAL_ENVASE" as const,
  unidadMedida: "UNIDAD" as const,
  activo: true,
  createdAt: now,
  updatedAt: now,
};

const verifier: TokenVerifier = {
  async verify(token) {
    assert.equal(token, "valid-token");
    return { uid: "firebase-id", email: "user@example.com" };
  },
};

type ServiceCalls = {
  list: unknown[];
  get: unknown[];
  create: unknown[];
  update: unknown[];
  activate: unknown[];
  deactivate: unknown[];
};

function createService() {
  const calls: ServiceCalls = {
    list: [],
    get: [],
    create: [],
    update: [],
    activate: [],
    deactivate: [],
  };
  const service = {
    async listArticulos(filters: unknown) {
      calls.list.push(filters);
      return {
        items: [articulo],
        pagination: { page: 2, pageSize: 5, total: 6, totalPages: 2 },
      };
    },
    async getArticulo(input: unknown) {
      calls.get.push(input);
      return articulo;
    },
    async createArticulo(data: unknown, context: unknown) {
      calls.create.push({ data, context });
      return articulo;
    },
    async updateArticulo(id: string, data: unknown, context: unknown) {
      calls.update.push({ id, data, context });
      return { ...articulo, nombre: "Botella premium" };
    },
    async activateArticulo(id: string, context: unknown) {
      calls.activate.push({ id, context });
      return articulo;
    },
    async deactivateArticulo(id: string, context: unknown) {
      calls.deactivate.push({ id, context });
      return { ...articulo, activo: false };
    },
  } as unknown as ArticuloService;
  return { calls, service };
}

async function request({
  method,
  path,
  permissions,
  body,
}: {
  method: string;
  path: string;
  permissions: string[];
  body?: unknown;
}) {
  const user: AuthenticatedUser = {
    id: "user-id",
    firebaseUid: "firebase-id",
    email: "user@example.com",
    displayName: "Logger User",
    status: "ACTIVE",
    lastLoginAt: null,
    roles: [],
    permissions,
  };
  const userRepository: UserRepository = {
    async findByFirebaseUid() {
      return user;
    },
    async updateLastLoginAt() {},
  };
  const { calls, service } = createService();
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use(
    "/api/v1/articulos",
    createArticuloRouter(verifier, userRepository, service),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/articulos${path}`,
      {
        method,
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
          "x-request-id": "articulos-route-test",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    return { calls, response, json: await response.json() as unknown };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

describe("Articulos HTTP RBAC", () => {
  const cases = [
    { method: "GET", path: "/", permission: "articulos:read" },
    { method: "GET", path: `/${articuloId}`, permission: "articulos:read" },
    { method: "POST", path: "/", permission: "articulos:create", body: {} },
    {
      method: "PATCH",
      path: `/${articuloId}`,
      permission: "articulos:update",
      body: {},
    },
    {
      method: "POST",
      path: `/${articuloId}/activate`,
      permission: "articulos:activate",
    },
    {
      method: "POST",
      path: `/${articuloId}/deactivate`,
      permission: "articulos:deactivate",
    },
  ];

  for (const testCase of cases) {
    it(`denies ${testCase.method} ${testCase.path} without ${testCase.permission}`, async () => {
      const { json, response } = await request({
        method: testCase.method,
        path: testCase.path,
        permissions: [],
        body: testCase.body,
      });
      assert.equal(response.status, 403);
      assert.equal(
        (json as { error: { code: string } }).error.code,
        "AUTH_FORBIDDEN",
      );
    });
  }
});

describe("Articulos HTTP contracts", () => {
  it("returns list data in an envelope with pagination metadata and parsed filters", async () => {
    const { calls, json, response } = await request({
      method: "GET",
      path:
        "/?page=2&pageSize=5&search=botella&clasificacion=MATERIAL_ENVASE&activo=true",
      permissions: ["articulos:read"],
    });
    assert.equal(response.status, 200);
    assert.deepEqual(calls.list, [{
      page: 2,
      pageSize: 5,
      search: "botella",
      clasificacion: "MATERIAL_ENVASE",
      activo: true,
    }]);
    assert.deepEqual(json, {
      data: [{ ...articulo, createdAt: now.toISOString(), updatedAt: now.toISOString() }],
      meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 },
    });
  });

  it("returns one articulo in a data envelope", async () => {
    const { calls, json, response } = await request({
      method: "GET",
      path: `/${articuloId}`,
      permissions: ["articulos:read"],
    });
    assert.equal(response.status, 200);
    assert.deepEqual(calls.get, [{ articuloId }]);
    assert.deepEqual(json, {
      data: { ...articulo, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    });
  });

  it("creates through the allowed contract and cannot force activo", async () => {
    const { calls, json, response } = await request({
      method: "POST",
      path: "/",
      permissions: ["articulos:create"],
      body: {
        codigo: "ART-001",
        nombre: "Botella",
        clasificacion: "MATERIAL_ENVASE",
        unidadMedida: "UNIDAD",
        activo: false,
      },
    });
    assert.equal(response.status, 201);
    assert.deepEqual((calls.create[0] as { data: unknown }).data, {
      codigo: "ART-001",
      nombre: "Botella",
      clasificacion: "MATERIAL_ENVASE",
      unidadMedida: "UNIDAD",
    });
    assert.equal((json as { data: { activo: boolean } }).data.activo, true);
  });

  it("updates allowed fields without accepting codigo or activo", async () => {
    const { calls, json, response } = await request({
      method: "PATCH",
      path: `/${articuloId}`,
      permissions: ["articulos:update"],
      body: {
        nombre: "Botella premium",
        codigo: "HACKED",
        activo: false,
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(calls.update.map(({ context: _context, ...call }) => call), [{
      id: articuloId,
      data: { nombre: "Botella premium" },
    }]);
    assert.equal((json as { data: { codigo: string; activo: boolean } }).data.codigo, "ART-001");
    assert.equal((json as { data: { codigo: string; activo: boolean } }).data.activo, true);
  });

  it("activates and deactivates only with their independent permissions", async () => {
    const activated = await request({
      method: "POST",
      path: `/${articuloId}/activate`,
      permissions: ["articulos:activate"],
    });
    assert.equal(activated.response.status, 200);
    assert.equal((activated.json as { data: { activo: boolean } }).data.activo, true);
    assert.equal(activated.calls.activate.length, 1);

    const deactivated = await request({
      method: "POST",
      path: `/${articuloId}/deactivate`,
      permissions: ["articulos:deactivate"],
    });
    assert.equal(deactivated.response.status, 200);
    assert.equal((deactivated.json as { data: { activo: boolean } }).data.activo, false);
    assert.equal(deactivated.calls.deactivate.length, 1);
  });
});