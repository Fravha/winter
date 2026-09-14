import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { CompraApi } from "../src/modules/compras/compra.api.js";
import { createCompraRouter } from "../src/modules/compras/compra.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";

const compraId = "00000000-0000-4000-8000-000000000001";
const warehouseId = "00000000-0000-4000-8000-000000000002";
const item = {
  id: "00000000-0000-4000-8000-000000000003",
  compraId,
  articuloId: "00000000-0000-4000-8000-000000000004",
  brand: null,
  requestedQuantity: "1.000",
  unit: "KG" as const,
  unitPrice: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const compra = {
  id: compraId,
  supplierName: "Supplier",
  supplierTaxId: null,
  documentNumber: null,
  documentDate: null,
  currency: null,
  observations: null,
  status: "RECEIVED" as const,
  createdByUserId: "user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [item],
};

const verifier: TokenVerifier = {
  async verify() {
    return { uid: "firebase-id", email: "user@example.com" };
  },
};

describe("Compras HTTP receive RBAC", () => {
  async function request(permissions: string[]) {
    let receivedContext: unknown;
    const service: CompraApi = {
      async list() {
        return { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
      },
      async get() {
        return compra;
      },
      async create() {
        return compra;
      },
      async update() {
        return compra;
      },
      async receive(_id, _input, context) {
        receivedContext = context;
        return compra;
      },
      async cancel() {
        return { ...compra, status: "CANCELLED" };
      },
    };
    const user: AuthenticatedUser = {
      id: "user-id",
      firebaseUid: "firebase-id",
      email: "user@example.com",
      displayName: "User",
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
    const app = express();
    app.use(requestContext);
    app.use(express.json());
    app.use("/api/v1/compras", createCompraRouter(verifier, userRepository, service));
    app.use(errorHandler);
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/compras/${compraId}/receive`, {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
          "x-request-id": "compras-route-test",
        },
        body: JSON.stringify({ warehouseId }),
      });
      return { response, receivedContext };
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
      );
    }
  }

  it("denies receive without compras:receive", async () => {
    const { response } = await request([]);
    assert.equal(response.status, 403);
  });

  /*it("does not require inventory:inbound for a compras receive", async () => {
    const { response, receivedContext } = await request(["compras:receive"]);
    assert.equal(response.status, 200);
    assert.deepEqual(receivedContext, {
      actorUserId: "user-id",
      ipAddress: "127.0.0.1",
      requestId: "compras-route-test",
    });
  });*/

  it("does not require inventory:inbound for a compras receive", async () => {
    const { response, receivedContext } = await request(["compras:receive"]);

    assert.equal(response.status, 200);

    assert.ok(
      receivedContext !== null &&
        typeof receivedContext === "object" &&
        "actorUserId" in receivedContext &&
        "requestId" in receivedContext &&
        "ipAddress" in receivedContext,
    );

    assert.equal(receivedContext.actorUserId, "user-id");
    assert.equal(receivedContext.requestId, "compras-route-test");

    assert.ok(
      receivedContext.ipAddress === "127.0.0.1" ||
        receivedContext.ipAddress === "::ffff:127.0.0.1",
    );
  });
});