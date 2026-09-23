import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test, { describe } from "node:test";
import express from "express";
import type { AuditService } from "../src/core/audit/audit.service.js";
import type { AuditEvent, AuthenticatedAuditContext } from "../src/core/audit/audit.types.js";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import { createUserAdminRouter } from "../src/modules/access-management/users/user-admin.routes.js";
import type { IdentityAdmin } from "../src/modules/access-management/users/identity-admin.js";
import type { PasswordResetSender } from "../src/core/auth/password-reset-sender.js";
import type {
  CreateLocalUserInput,
  UserAdminRepository,
} from "../src/modules/access-management/users/user-admin.repository.js";
import type { UpdateUserAdminDto } from "../src/modules/access-management/users/user-admin.dto.js";
import type { UserAdmin } from "../src/modules/access-management/users/user-admin.model.js";
import { UserAdminService } from "../src/modules/access-management/users/user-admin.service.js";
import type {
  CreateRoleDto,
  UpdateRoleDto,
} from "../src/modules/access-management/roles/role.dto.js";
import type { RoleModel } from "../src/modules/access-management/roles/role.model.js";
import type { RoleRepository } from "../src/modules/access-management/roles/role.repository.js";
import { RoleService } from "../src/modules/access-management/roles/role.service.js";
import type { PermissionRepository } from "../src/modules/access-management/permissions/permission.repository.js";
import type { PermissionModel } from "../src/modules/access-management/permissions/permission.model.js";
import { AssignmentService } from "../src/modules/access-management/assignments/assignment.service.js";
import type { AssignmentRepository } from "../src/modules/access-management/assignments/assignment.repository.js";

const context: AuthenticatedAuditContext = {
  actorUserId: "actor-id",
  requestId: "access-management-test",
  ipAddress: "127.0.0.1",
};

const now = new Date("2026-01-01T00:00:00.000Z");

function user(overrides: Partial<UserAdmin> = {}): UserAdmin {
  return {
    id: "user-id",
    firebaseUid: "firebase-user-id",
    email: "user@example.com",
    displayName: "User",
    status: "ACTIVE",
    lastLoginAt: null,
    role: { id: "role-id", code: "operator", name: "Operator" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function role(overrides: Partial<RoleModel> = {}): RoleModel {
  return {
    id: "role-id",
    code: "operator",
    name: "Operator",
    description: "Operations",
    permissions: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeAudit implements AuditService {
  events: Array<{ context: AuthenticatedAuditContext; event: unknown }> = [];

  async record(auditContext: AuthenticatedAuditContext, event: AuditEvent): Promise<void> {
    this.events.push({ context: auditContext, event });
  }
}

class FakeIdentity implements IdentityAdmin {
  created: string[] = [];
  updates: Array<{ uid: string; data: unknown }> = [];
  disabled: Array<{ uid: string; disabled: boolean }> = [];
  deleted: string[] = [];

  async createUser(data: { uid: string }): Promise<void> {
    this.created.push(data.uid);
  }

  async updateUser(uid: string, data: unknown): Promise<void> {
    this.updates.push({ uid, data });
  }

  async setDisabled(uid: string, disabled: boolean): Promise<void> {
    this.disabled.push({ uid, disabled });
  }

  async deleteUser(uid: string): Promise<void> {
    this.deleted.push(uid);
  }
}

class FakeUserRepository implements UserAdminRepository {
  rows = new Map<string, UserAdmin>([["user-id", user()]]);
  roleExistsResult = true;
  adminUsers = 2;
  adminUserIds = new Set<string>();
  deleted: string[] = [];

  findAll(): Promise<UserAdmin[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  findById(id: string): Promise<UserAdmin | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByEmail(email: string): Promise<UserAdmin | null> {
    return Promise.resolve([...this.rows.values()].find((row) => row.email === email) ?? null);
  }

  create(data: CreateLocalUserInput): Promise<UserAdmin> {
    const created = user({
      id: "created-user-id",
      firebaseUid: data.firebaseUid,
      email: data.email,
      displayName: data.displayName ?? null,
      status: "ACTIVE",
      role: { id: data.roleId, code: "operator", name: "Operator" },
    });
    this.rows.set(created.id, created);
    return Promise.resolve(created);
  }

  update(id: string, data: UpdateUserAdminDto): Promise<UserAdmin> {
    const updated = user({ ...this.rows.get(id), id, ...data });
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }

  setStatus(id: string, status: UserAdmin["status"]): Promise<UserAdmin> {
    const updated = user({ ...this.rows.get(id), id, status });
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }

  delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.rows.delete(id);
    return Promise.resolve();
  }

  roleExists(): Promise<boolean> {
    return Promise.resolve(this.roleExistsResult);
  }

  userHasRole(userId: string, roleCode: string): Promise<boolean> {
    return Promise.resolve(this.adminUserIds.has(userId) && roleCode === "admin");
  }

  countActiveUsersWithRole(): Promise<number> {
    return Promise.resolve(this.adminUsers);
  }
}

function userServiceFixture() {
  const repository = new FakeUserRepository();
  const identity = new FakeIdentity();
  const passwordResetSender: PasswordResetSender = { send: async () => undefined };
  const audit = new FakeAudit();
  return {
    repository,
    identity,
    audit,
    service: new UserAdminService(repository, identity, passwordResetSender, audit),
  };
}

describe("Access Management users", () => {
  test("creates, updates and activates a user", async () => {
    const { service, repository, identity, audit } = userServiceFixture();

    const created = await service.create(
      { email: "new@example.com", displayName: "New User", roleId: "role-id" },
      context,
    );
    assert.equal(created.email, "new@example.com");
    assert.equal(identity.created.length, 1);

    const updated = await service.update("user-id", { displayName: "Updated" }, context);
    assert.equal(updated.displayName, "Updated");
    assert.equal(identity.updates.length, 1);

    repository.rows.set("user-id", user({ status: "SUSPENDED" }));
    const activated = await service.activate("user-id", context);
    assert.equal(activated.status, "ACTIVE");
    assert.deepEqual(identity.disabled.at(-1), { uid: "firebase-user-id", disabled: false });
    assert.deepEqual(audit.events.map(({ event }) => (event as { action: string }).action), [
      "USER_CREATED",
      "USER_UPDATED",
      "USER_ACTIVATED",
    ]);
  });

  test("suspends a user and protects self and the last administrator", async () => {
    const { service, repository, identity } = userServiceFixture();
    repository.rows.set("actor-id", user({
      id: "actor-id",
      role: { id: "admin-role", code: "admin", name: "Administrator" },
    }));

    const suspended = await service.suspend("user-id", context);
    assert.equal(suspended.status, "SUSPENDED");
    assert.deepEqual(identity.disabled.at(-1), { uid: "firebase-user-id", disabled: true });

    await assert.rejects(
      () => service.suspend("actor-id", context),
      (error: unknown) => (error as { code: string }).code === "USER_CANNOT_SUSPEND_SELF",
    );

    repository.rows.set("admin-user", user({
      id: "admin-user",
      role: { id: "admin-role", code: "admin", name: "Administrator" },
    }));
    repository.adminUserIds.add("admin-user");
    repository.adminUsers = 1;
    await assert.rejects(
      () => service.suspend("admin-user", context),
      (error: unknown) => (error as { code: string }).code === "LAST_ADMIN_PROTECTED",
    );
  });

  test("GET /users enforces users:read at route level", async () => {
    const verifier: TokenVerifier = { async verify() { return { uid: "firebase-id" }; } };
    const repository: UserRepository = {
      async findByFirebaseUid() {
        return {
          id: "actor-id",
          firebaseUid: "firebase-id",
          email: "actor@example.com",
          displayName: "Actor",
          status: "ACTIVE",
          roles: ["operator"],
          permissions: [],
        };
      },
    };
    const app = express();
    app.use("/users", createUserAdminRouter(
      { user: { findMany: async () => [] } } as never,
      verifier,
      repository,
      new FakeIdentity(),
      { send: async () => undefined },
      new FakeAudit(),
    ));
    app.use((
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status((error as { statusCode: number }).statusCode ?? 500).json({
        code: (error as { code: string }).code,
      });
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/users`, {
        headers: { authorization: "Bearer token" },
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { code: "AUTH_FORBIDDEN" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

class FakePermissionRepository implements PermissionRepository {
  rows = new Map<string, PermissionModel>([
    ["permission-1", {
      id: "permission-1", code: "users:read", name: "Users read", description: null,
      createdAt: now, updatedAt: now,
    }],
    ["permission-2", {
      id: "permission-2", code: "users:manage", name: "Users manage", description: null,
      createdAt: now, updatedAt: now,
    }],
  ]);

  findAll(): Promise<PermissionModel[]> { return Promise.resolve([...this.rows.values()]); }
  findById(id: string): Promise<PermissionModel | null> { return Promise.resolve(this.rows.get(id) ?? null); }
}

class FakeRoleRepository implements RoleRepository {
  rows = new Map<string, RoleModel>([["role-id", role()]]);
  users = 0;
  deleted: string[] = [];
  assigned: string[] = [];

  findAll(): Promise<RoleModel[]> { return Promise.resolve([...this.rows.values()]); }
  findById(id: string): Promise<RoleModel | null> { return Promise.resolve(this.rows.get(id) ?? null); }
  findByCode(code: string): Promise<RoleModel | null> {
    return Promise.resolve([...this.rows.values()].find((row) => row.code === code) ?? null);
  }
  create(data: CreateRoleDto): Promise<RoleModel> {
    const created = role({ id: "new-role-id", ...data, description: data.description ?? null });
    this.rows.set(created.id, created);
    return Promise.resolve(created);
  }
  update(id: string, data: UpdateRoleDto): Promise<RoleModel> {
    const updated = role({ ...this.rows.get(id), id, ...data });
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }
  delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.rows.delete(id);
    return Promise.resolve();
  }
  countUsers(): Promise<number> { return Promise.resolve(this.users); }
  setPermissions(id: string, permissionIds: string[]): Promise<void> {
    this.assigned = permissionIds;
    const current = this.rows.get(id);
    if (current) this.rows.set(id, { ...current, permissions: permissionIds.map((permissionId) => ({
      id: permissionId, code: permissionId === "permission-1" ? "users:read" : "users:manage", name: "Permission",
    })) });
    return Promise.resolve();
  }
}

function roleServiceFixture() {
  const repository = new FakeRoleRepository();
  const permissions = new FakePermissionRepository();
  const audit = new FakeAudit();
  return { repository, audit, service: new RoleService(repository, permissions, audit) };
}

describe("Access Management roles", () => {
  test("supports role create, read, update and soft delete", async () => {
    const { service, repository } = roleServiceFixture();
    const created = await service.create({ code: "warehouse", name: "Warehouse" }, context);
    assert.equal((await service.getById(created.id)).code, "warehouse");
    const updated = await service.update(created.id, { name: "Warehouse operators" }, context);
    assert.equal(updated.name, "Warehouse operators");
    await service.delete(created.id, context);
    assert.deepEqual(repository.deleted, [created.id]);
    assert.equal(await service.getById(created.id).catch((error: { code: string }) => error.code), "ROLE_NOT_FOUND");
  });

  test("protects roles in use and the administrator role", async () => {
    const { service, repository } = roleServiceFixture();
    repository.users = 1;
    await assert.rejects(
      () => service.delete("role-id", context),
      (error: unknown) => (error as { code: string }).code === "ROLE_IN_USE",
    );
    repository.users = 0;
    repository.rows.set("admin-role", role({ id: "admin-role", code: "admin", name: "Administrator" }));
    await assert.rejects(
      () => service.delete("admin-role", context),
      (error: unknown) => (error as { code: string }).code === "SYSTEM_ROLE_PROTECTED",
    );
  });

  test("replaces role permissions and keeps administrator permissions protected", async () => {
    const { service, repository } = roleServiceFixture();
    await service.setPermissions("role-id", ["permission-1", "permission-2"], context);
    assert.deepEqual(repository.assigned, ["permission-1", "permission-2"]);

    repository.rows.set("admin-role", role({ id: "admin-role", code: "admin", name: "Administrator" }));
    await assert.rejects(
      () => service.setPermissions("admin-role", ["permission-1"], context),
      (error: unknown) => (error as { code: string }).code === "SYSTEM_ROLE_PERMISSIONS_PROTECTED",
    );
  });
});

class FakeAssignmentRepository implements AssignmentRepository {
  users = new Set(["pending-user", "active-user", "suspended-user"]);
  roles = new Map([["operator-role", "operator"], ["admin-role", "admin"]]);
  currentRoles = new Map([
    ["pending-user", "operator"],
    ["active-user", "operator"],
    ["suspended-user", "operator"],
  ]);
  replacement: { userId: string; roleId: string } | undefined;
  activeAdmins = 2;

  userExists(userId: string): Promise<boolean> { return Promise.resolve(this.users.has(userId)); }
  roleExists(roleId: string): Promise<boolean> { return Promise.resolve(this.roles.has(roleId)); }
  replaceUserRole(userId: string, roleId: string): Promise<void> {
    this.replacement = { userId, roleId };
    this.currentRoles.set(userId, this.roles.get(roleId) ?? "");
    return Promise.resolve();
  }
  userHasRole(userId: string, roleCode: string): Promise<boolean> {
    return Promise.resolve(this.currentRoles.get(userId) === roleCode);
  }
  countActiveUsersWithRole(): Promise<number> { return Promise.resolve(this.activeAdmins); }
  roleCode(roleId: string): Promise<string | null> { return Promise.resolve(this.roles.get(roleId) ?? null); }
  userRoleCode(userId: string): Promise<string | null> {
    return Promise.resolve(this.currentRoles.get(userId) ?? null);
  }
}

test("replaces roles for PENDING, ACTIVE and SUSPENDED users without changing status", async () => {
  const repository = new FakeAssignmentRepository();
  const audit = new FakeAudit();
  const service = new AssignmentService(repository, audit);

  for (const userId of ["pending-user", "active-user", "suspended-user"]) {
    await service.replaceUserRole(userId, "admin-role", context);
    assert.equal(repository.currentRoles.get(userId), "admin");
  }
  assert.deepEqual(repository.replacement, { userId: "suspended-user", roleId: "admin-role" });
  assert.equal(audit.events.length, 3);
});