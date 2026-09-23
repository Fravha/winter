import assert from "node:assert/strict";
import test from "node:test";
import type { AuditService } from "../src/core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../src/core/audit/audit.types.js";
import type { PermissionModel } from "../src/modules/access-management/permissions/permission.model.js";
import type {
  CreatePermissionInput,
  PermissionRepository,
  UpdatePermissionInput,
} from "../src/modules/access-management/permissions/permission.repository.js";
import { PermissionService } from "../src/modules/access-management/permissions/permission.service.js";

const context: AuthenticatedAuditContext = {
  actorUserId: "actor-user-id",
  ipAddress: "127.0.0.1",
  requestId: "permission-request",
};

function permission(overrides: Partial<PermissionModel> = {}): PermissionModel {
  return {
    id: "permission-id",
    code: "users:read",
    name: "Users read",
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

class FakePermissionRepository implements PermissionRepository {
  rows = new Map<string, PermissionModel>();
  assigned = new Set<string>();
  deleted: string[] = [];

  constructor() {
    this.rows.set("permission-id", permission());
  }

  findAll(): Promise<PermissionModel[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  findById(id: string): Promise<PermissionModel | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByCode(code: string): Promise<PermissionModel | null> {
    return Promise.resolve(
      [...this.rows.values()].find((row) => row.code === code) ?? null,
    );
  }

  create(data: CreatePermissionInput): Promise<PermissionModel> {
    const row = permission({
      id: "created-permission-id",
      ...data,
      description: data.description ?? null,
    });
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  update(id: string, data: UpdatePermissionInput): Promise<PermissionModel> {
    const current = this.rows.get(id);
    if (!current) throw new Error("missing permission");
    const row = permission({ ...current, ...data, description: data.description ?? current.description });
    this.rows.set(id, row);
    return Promise.resolve(row);
  }

  countRoleAssignments(id: string): Promise<number> {
    return Promise.resolve(this.assigned.has(id) ? 1 : 0);
  }

  lockForDelete(_id: string): Promise<void> {
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.rows.delete(id);
    return Promise.resolve();
  }
}

function serviceFixture(
  unitOfWork?: {
    execute: (
      work: (
        repository: PermissionRepository,
        audit: AuditService,
      ) => Promise<unknown>,
    ) => Promise<unknown>;
  },
) {
  const repository = new FakePermissionRepository();
  const events: Array<{ context: AuthenticatedAuditContext; event: unknown }> = [];
  const audit = {
    record: async (auditContext: AuthenticatedAuditContext, event: unknown) => {
      events.push({ context: auditContext, event });
    },
  } as unknown as AuditService;
  return {
    repository,
    events,
    service: new PermissionService(repository, audit, unitOfWork),
  };
}

test("permission delete removes an unassigned permission and records audit", async () => {
  const { repository, events, service } = serviceFixture();

  await service.delete("permission-id", context);

  assert.deepEqual(repository.deleted, ["permission-id"]);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    context,
    event: {
      action: "PERMISSION_DELETED",
      resourceType: "permission",
      resourceId: "permission-id",
      metadata: { code: "users:read", name: "Users read" },
    },
  });
});

test("permission delete rejects an assigned permission without deleting or auditing", async () => {
  const { repository, events, service } = serviceFixture();
  repository.assigned.add("permission-id");

  await assert.rejects(
    () => service.delete("permission-id", context),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, "PERMISSION_IN_USE");
      assert.equal((error as { statusCode: number }).statusCode, 409);
      assert.equal(
        (error as { message: string }).message,
        "el permiso no puede eliminarse mientras esté asignado a uno o más roles.",
      );
      return true;
    },
  );

  assert.deepEqual(repository.deleted, []);
  assert.deepEqual(events, []);
});

test("permission create and update record authenticated audit context", async () => {
  const { events, service } = serviceFixture();

  await service.create(
    { code: "roles:read", name: "Roles read", description: "Read roles" },
    context,
  );
  await service.update("permission-id", { name: "Users read updated" }, context);

  assert.deepEqual(events.map(({ event }) => event), [
    {
      action: "PERMISSION_CREATED",
      resourceType: "permission",
      resourceId: "created-permission-id",
      metadata: { code: "roles:read", name: "Roles read" },
    },
    {
      action: "PERMISSION_UPDATED",
      resourceType: "permission",
      resourceId: "permission-id",
      metadata: { code: "users:read", changedFields: ["name"] },
    },
  ]);
  assert.deepEqual(events.map(({ context: auditContext }) => auditContext), [
    context,
    context,
  ]);
});

test("permission create rolls back when audit recording fails", async () => {
  const repository = new FakePermissionRepository();
  const audit = {
    record: async () => {
      throw new Error("audit unavailable");
    },
  } as unknown as AuditService;
  const unitOfWork = {
    execute: async (
      work: (repository: PermissionRepository, audit: AuditService) => Promise<unknown>,
    ) => {
      const before = new Map(repository.rows);
      try {
        return await work(repository, audit);
      } catch (error) {
        repository.rows = before;
        throw error;
      }
    },
  };
  const service = new PermissionService(repository, audit, unitOfWork);

  await assert.rejects(() =>
    service.create({ code: "roles:read", name: "Roles read" }, context),
  );
  assert.equal(await repository.findByCode("roles:read"), null);
});