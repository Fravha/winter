import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { isSerializationConflict, SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { ProductionRepository } from "./production.repository.js";
import type { CatalogFilters, CatalogInput, CatalogKind, OrderFilters, ProductionOrderInput, TransformationOrderInput } from "./production.dto.js";
const kindMap = { participants: "participants", producers: "producers", "grape-varieties": "grape-varieties", "work-types": "work-types", "measurement-types": "measurement-types" } as const;
export class ProductionService {
  constructor(private readonly prisma: PrismaClient, private readonly audit: AuditService) {}
  private auditIn(tx: SharedTransactionContext): AuditService { return new AuditService(new PrismaAuditRepository(tx)); }
  list(kind: CatalogKind | "work-types" | "measurement-types", f: CatalogFilters) { return new ProductionRepository(this.prisma).list(kindMap[kind], f); }
  async create(kind: CatalogKind, data: CatalogInput, context: AuthenticatedAuditContext) {
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      const repo = new ProductionRepository(tx);
      if (await repo.findCode(kindMap[kind], data.code)) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Code already exists", 409);
       let item;
       try { item = await repo.create(kindMap[kind], data); } catch (error: unknown) { if (isPrismaCode(error, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Code already exists", 409); throw error; }
       await this.auditIn(tx).record(context, { action: "PRODUCTION_CATALOG_CREATED", resourceType: `production.${kind}`, resourceId: item.id, metadata: { code: item.code } });
      return item;
    });
  }
  async update(kind: CatalogKind, id: string, data: { name?: string }, context: AuthenticatedAuditContext) { return this.change(kind, id, data, context, "UPDATED"); }
  async setActive(kind: CatalogKind, id: string, active: boolean, context: AuthenticatedAuditContext) { return this.change(kind, id, { active }, context, active ? "ACTIVATED" : "DEACTIVATED"); }
  private async change(kind: CatalogKind, id: string, data: { name?: string; active?: boolean }, context: AuthenticatedAuditContext, action: string) {
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      const repo = new ProductionRepository(tx); const existing = await repo.find(kindMap[kind], id);
      if (!existing) throw new AppError("PRODUCTION_NOT_FOUND", "Production catalog entry not found", 404);
      let item;
      try { item = await repo.update(kindMap[kind], id, data); } catch (error: unknown) { if (isPrismaCode(error, "P2025")) throw new AppError("PRODUCTION_NOT_FOUND", "Production catalog entry not found", 404); throw error; }
      await this.auditIn(tx).record(context, { action: `PRODUCTION_CATALOG_${action}`, resourceType: `production.${kind}`, resourceId: id, metadata: { code: existing.code } });
      return item;
    });
  }
  async listDefinitions(filters: { entityType?: string; active?: boolean }) {
    return this.prisma.customFieldDefinition.findMany({ where: filters as any, orderBy: { displayOrder: "asc" } });
  }
  async createDefinition(data: DefinitionInput, context: AuthenticatedAuditContext) {
    if (data.entityType === "GRAPE_RECEPTION" && !data.code) throw new AppError("VALIDATION_ERROR", "Code is required", 400);
    if (data.dataType === "SELECT" && (!Array.isArray(data.options) || data.options.length === 0)) throw new AppError("CUSTOM_FIELD_OPTIONS_REQUIRED", "SELECT fields require options", 400);
    if (data.dataType !== "SELECT" && data.options !== undefined) throw new AppError("CUSTOM_FIELD_OPTIONS_INVALID", "Only SELECT fields may have options", 400);
    const created = await new SharedUnitOfWork(this.prisma).execute(async tx => {
      try { const item = await tx.customFieldDefinition.create({ data: { ...data, ...(data.options !== undefined ? { options: data.options } : {}), createdByUserId: context.actorUserId } as Prisma.CustomFieldDefinitionUncheckedCreateInput }); await this.auditIn(tx).record(context, { action: "PRODUCTION_CUSTOM_FIELD_DEFINITION_CREATED", resourceType: "production.custom_field_definition", resourceId: item.id }); return item; }
      catch (e: unknown) { if (isPrismaCode(e, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Custom field code already exists for entity", 409); throw e; }
    });
    return created;
  }
  async updateDefinition(id: string, data: { label?: string | undefined; required?: boolean | undefined; options?: string[] | undefined; displayOrder?: number | undefined }, context: AuthenticatedAuditContext) {
    if (data.options !== undefined && data.options.length === 0) throw new AppError("CUSTOM_FIELD_OPTIONS_REQUIRED", "SELECT fields require options", 400);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      const existing = await tx.customFieldDefinition.findUnique({ where: { id } });
      if (!existing) throw new AppError("CUSTOM_FIELD_DEFINITION_NOT_FOUND", "Custom field definition not found", 404);
      if (existing.dataType !== "SELECT" && data.options !== undefined) throw new AppError("CUSTOM_FIELD_OPTIONS_INVALID", "Only SELECT fields may have options", 400);
      const item = await tx.customFieldDefinition.update({ where: { id }, data: data as Prisma.CustomFieldDefinitionUpdateInput });
      await this.auditIn(tx).record(context, { action: "PRODUCTION_CUSTOM_FIELD_DEFINITION_UPDATED", resourceType: "production.custom_field_definition", resourceId: id });
      return item;
    });
  }
  async setDefinitionActive(id: string, active: boolean, context: AuthenticatedAuditContext) {
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      const existing = await tx.customFieldDefinition.findUnique({ where: { id } });
      if (!existing) throw new AppError("CUSTOM_FIELD_DEFINITION_NOT_FOUND", "Custom field definition not found", 404);
      const item = await tx.customFieldDefinition.update({ where: { id }, data: { active } });
      await this.auditIn(tx).record(context, { action: active ? "PRODUCTION_CUSTOM_FIELD_DEFINITION_ACTIVATED" : "PRODUCTION_CUSTOM_FIELD_DEFINITION_DEACTIVATED", resourceType: "production.custom_field_definition", resourceId: id });
      return item;
    });
  }
  async setValue(data: ValueInput, context: AuthenticatedAuditContext) {
    if (data.entityType === "GRAPE_RECEPTION") throw new AppError("CUSTOM_FIELD_ENTITY_NOT_AVAILABLE", "GrapeReception custom values are unavailable until P6", 409);
    const item = await new SharedUnitOfWork(this.prisma).execute(async tx => {
      const definition = await tx.customFieldDefinition.findUnique({ where: { id: data.definitionId } });
      if (!definition || definition.entityType !== data.entityType) throw new AppError("CUSTOM_FIELD_DEFINITION_NOT_FOUND", "Custom field definition not found", 404);
      if (!definition.active) throw new AppError("CUSTOM_FIELD_DEFINITION_INACTIVE", "Custom field definition is inactive", 409);
      const owner = data.entityType === "PRODUCER" ? await tx.producer.findUnique({ where: { id: data.entityId } }) : await tx.grapeVariety.findUnique({ where: { id: data.entityId } });
      if (!owner) throw new AppError("CUSTOM_FIELD_ENTITY_NOT_FOUND", "Custom field entity not found", 404);
      if (!owner.active) throw new AppError("CUSTOM_FIELD_ENTITY_INACTIVE", "Custom field entity is inactive", 409);
      const keys: Record<string, string> = { TEXT: "textValue", INTEGER: "integerValue", DECIMAL: "decimalValue", BOOLEAN: "booleanValue", DATE: "dateValue", SELECT: "selectValue" };
      const field = keys[definition.dataType];
      const valid = field !== undefined && ((definition.dataType === "TEXT" && typeof data.value === "string") || (definition.dataType === "INTEGER" && typeof data.value === "number" && Number.isInteger(data.value) && data.value >= -2_147_483_648 && data.value <= 2_147_483_647) || (definition.dataType === "DECIMAL" && typeof data.value === "string" && /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(data.value)) || (definition.dataType === "BOOLEAN" && typeof data.value === "boolean") || (definition.dataType === "DATE" && typeof data.value === "string" && !Number.isNaN(Date.parse(data.value))) || (definition.dataType === "SELECT" && typeof data.value === "string" && ((definition.options as string[] | null) ?? []).includes(data.value)));
      if (!valid) throw new AppError("CUSTOM_FIELD_VALUE_INVALID", "Value does not match custom field type", 400);
      const valueForDb = definition.dataType === "DATE" ? new Date(data.value as string) : data.value;
      const value = await tx.customFieldValue.upsert({ where: { definitionId_entityId: { definitionId: data.definitionId, entityId: data.entityId } }, update: { entityType: data.entityType, [field]: valueForDb }, create: { definitionId: data.definitionId, entityType: data.entityType, entityId: data.entityId, [field]: valueForDb } });
      await this.auditIn(tx).record(context, { action: "PRODUCTION_CUSTOM_FIELD_VALUE_SET", resourceType: "production.custom_field_value", resourceId: value.id }); return value;
    });
    return item;
  }
  listOrders(filters: OrderFilters) { return new ProductionRepository(this.prisma).listOrders(filters); }
  getOrder(id: string) { return new ProductionRepository(this.prisma).findOrder(id); }
  listTransformationOrders(filters: OrderFilters) { return new ProductionRepository(this.prisma).listTransformationOrders(filters); }
  getTransformationOrder(id: string) { return new ProductionRepository(this.prisma).findTransformationOrder(id); }
  async createOrder(data: ProductionOrderInput, context: AuthenticatedAuditContext) {
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      const repo = new ProductionRepository(tx);
      if (await tx.productionOrder.findUnique({ where: { code: data.code } })) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Production order code already exists", 409);
      try {
        const item = await repo.createOrder(data);
        await this.auditIn(tx).record(context, { action: "PRODUCTION_ORDER_CREATED", resourceType: "production.order", resourceId: item.id, metadata: { code: item.code } });
        return item;
      } catch (error) { if (isPrismaCode(error, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Production order code already exists", 409); throw error; }
    });
  }
  async closeOrder(id: string, context: AuthenticatedAuditContext) {
    try {
      return await new SharedUnitOfWork(this.prisma).execute(async tx => {
        const order = await tx.productionOrder.findUnique({ where: { id } });
        if (!order) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
        if (order.status === "CLOSED") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is already closed", 409);
        const openChild = await tx.transformationOrder.count({ where: { productionOrderId: id, status: "OPEN" } });
        if (openChild > 0) throw new AppError("PRODUCTION_ORDER_NOT_CLOSABLE", "Production order has open transformation orders", 409);
        const item = await tx.productionOrder.update({ where: { id, version: order.version }, data: { status: "CLOSED", closedAt: new Date(), closedByUserId: context.actorUserId, version: { increment: 1 } } });
        await this.auditIn(tx).record(context, { action: "PRODUCTION_ORDER_CLOSED", resourceType: "production.order", resourceId: id });
        return item;
      });
    } catch (error) {
      if (!isConcurrentWriteError(error)) throw error;
      const current = await this.prisma.productionOrder.findUnique({ where: { id } });
      if (!current) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
      if (current.status === "CLOSED") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is already closed", 409);
      throw new AppError("PRODUCTION_ORDER_NOT_CLOSABLE", "Production order changed concurrently", 409);
    }
  }
  async createTransformationOrder(data: TransformationOrderInput, context: AuthenticatedAuditContext) {
    try {
      return await new SharedUnitOfWork(this.prisma).execute(async tx => {
        const parent = await tx.productionOrder.findUnique({ where: { id: data.productionOrderId } });
        if (!parent) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
        if (parent.status === "CLOSED") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is closed", 409);
        if (await tx.transformationOrder.findUnique({ where: { productionOrderId_code: { productionOrderId: data.productionOrderId, code: data.code } } })) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Transformation order code already exists", 409);
        try {
          const item = await new ProductionRepository(tx).createTransformationOrder(data);
          await this.auditIn(tx).record(context, { action: "TRANSFORMATION_ORDER_CREATED", resourceType: "production.transformation_order", resourceId: item.id, metadata: { code: item.code, productionOrderId: item.productionOrderId } });
          return item;
        } catch (error) { if (isPrismaCode(error, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Transformation order code already exists", 409); throw error; }
      });
    } catch (error) {
      if (!isConcurrentWriteError(error)) throw error;
      const parent = await this.prisma.productionOrder.findUnique({ where: { id: data.productionOrderId } });
      if (!parent) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
      if (parent.status === "CLOSED") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is closed", 409);
      throw new AppError("PRODUCTION_ORDER_NOT_CLOSABLE", "Production order changed concurrently", 409);
    }
  }
  async closeTransformationOrder(id: string, context: AuthenticatedAuditContext) {
    try {
      return await new SharedUnitOfWork(this.prisma).execute(async tx => {
        const item = await tx.transformationOrder.findUnique({ where: { id } });
        if (!item) throw new AppError("TRANSFORMATION_ORDER_NOT_FOUND", "Transformation order not found", 404);
        if (item.status === "CLOSED") throw new AppError("TRANSFORMATION_ORDER_CLOSED", "Transformation order is already closed", 409);
        // P2 has no operational child entities yet; this hook is intentionally extensible for P3/P5/P8.
        const notClosable = await this.transformationOrderHasIncompleteOperations(tx, id);
        if (notClosable) throw new AppError("TRANSFORMATION_ORDER_NOT_CLOSABLE", "Transformation order has incomplete operations", 409);
        const closed = await tx.transformationOrder.update({ where: { id, version: item.version }, data: { status: "CLOSED", closedAt: new Date(), closedByUserId: context.actorUserId, version: { increment: 1 } } });
        await this.auditIn(tx).record(context, { action: "TRANSFORMATION_ORDER_CLOSED", resourceType: "production.transformation_order", resourceId: id });
        return closed;
      });
    } catch (error) {
      if (!isConcurrentWriteError(error)) throw error;
      const current = await this.prisma.transformationOrder.findUnique({ where: { id } });
      if (!current) throw new AppError("TRANSFORMATION_ORDER_NOT_FOUND", "Transformation order not found", 404);
      if (current.status === "CLOSED") throw new AppError("TRANSFORMATION_ORDER_CLOSED", "Transformation order is already closed", 409);
      throw new AppError("TRANSFORMATION_ORDER_NOT_CLOSABLE", "Transformation order changed concurrently", 409);
    }
  }
  private async transformationOrderHasIncompleteOperations(_tx: SharedTransactionContext, _id: string) { return false; }
}
type DefinitionInput = { entityType: "PRODUCER" | "GRAPE_VARIETY" | "GRAPE_RECEPTION"; code: string; label: string; dataType: "TEXT" | "INTEGER" | "DECIMAL" | "BOOLEAN" | "DATE" | "SELECT"; required: boolean; active: boolean; options?: string[] | undefined; displayOrder: number };
type ValueInput = { definitionId: string; entityType: "PRODUCER" | "GRAPE_VARIETY" | "GRAPE_RECEPTION"; entityId: string; value: string | number | boolean };
function isPrismaCode(error: unknown, code: string): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code; }
function isConcurrentWriteError(error: unknown): boolean { return isPrismaCode(error, "P2025") || isSerializationConflict(error); }