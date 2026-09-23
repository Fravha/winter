import { AppError } from "../../../shared/errors/app-error.js";
import type { AuditService } from "../../../core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../../../core/audit/audit.types.js";
import { isSerializationConflict } from "../../../core/database/shared-unit-of-work.js";
import type {
  CreatePermissionInput,
  PermissionRepository,
  UpdatePermissionInput,
} from "./permission.repository.js";
import type { PermissionUnitOfWork } from "./permission.unit-of-work.js";

export class PermissionService {
  constructor(
    private readonly repository: PermissionRepository,
    private readonly audit: AuditService,
    private readonly unitOfWork: PermissionUnitOfWork = {
      execute: (work) => work(this.repository, this.audit),
    },
  ) {}

  list() {
    return this.repository.findAll();
  }

  async getById(id: string) {
    const permission = await this.repository.findById(id);
    if (!permission) {
      throw new AppError("PERMISSION_NOT_FOUND", "Permission not found", 404);
    }
    return permission;
  }

  async create(
    data: CreatePermissionInput,
    context: AuthenticatedAuditContext,
  ) {
    return this.unitOfWork.execute(async (repository, audit) => {
      const existing = await repository.findByCode(data.code);
      if (existing) {
        throw new AppError(
          "PERMISSION_CODE_ALREADY_EXISTS",
          "A permission with this code already exists",
          409,
        );
      }
      const permission = await repository.create(data);
      await audit.record(context, {
        action: "PERMISSION_CREATED",
        resourceType: "permission",
        resourceId: permission.id,
        metadata: { code: permission.code, name: permission.name },
      });
      return permission;
    });
  }

  async update(
    id: string,
    data: UpdatePermissionInput,
    context: AuthenticatedAuditContext,
  ) {
    return this.unitOfWork.execute(async (repository, audit) => {
      const current = await this.getByIdFrom(repository, id);
      if (data.code) {
        const existing = await repository.findByCode(data.code);
        if (existing && existing.id !== id) {
          throw new AppError(
            "PERMISSION_CODE_ALREADY_EXISTS",
            "A permission with this code already exists",
            409,
          );
        }
      }
      const permission = await repository.update(id, data);
      await audit.record(context, {
        action: "PERMISSION_UPDATED",
        resourceType: "permission",
        resourceId: permission.id,
        metadata: {
          code: current.code,
          changedFields: Object.keys(data).sort(),
        },
      });
      return permission;
    });
  }

  async delete(id: string, context: AuthenticatedAuditContext) {
    try {
      await this.unitOfWork.execute(async (repository, audit) => {
        await repository.lockForDelete(id);
        const permission = await this.getByIdFrom(repository, id);
        if (await repository.countRoleAssignments(id)) {
          throw this.permissionInUse();
        }
        await repository.delete(id);
        await audit.record(context, {
          action: "PERMISSION_DELETED",
          resourceType: "permission",
          resourceId: permission.id,
          metadata: { code: permission.code, name: permission.name },
        });
      });
    } catch (error) {
      if (this.isInUseDatabaseError(error) || isSerializationConflict(error)) {
        throw this.permissionInUse();
      }
      throw error;
    }
  }

  private async getByIdFrom(repository: PermissionRepository, id: string) {
    const permission = await repository.findById(id);
    if (!permission) {
      throw new AppError("PERMISSION_NOT_FOUND", "Permission not found", 404);
    }
    return permission;
  }

  private permissionInUse() {
    return new AppError(
      "PERMISSION_IN_USE",
      "el permiso no puede eliminarse mientras esté asignado a uno o más roles.",
      409,
    );
  }

  private isInUseDatabaseError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const candidate = error as { code?: unknown; message?: unknown; meta?: unknown };
    return candidate.code === "P2003"
      || (typeof candidate.message === "string"
        && /rolepermission|permission/i.test(candidate.message));
  }
}