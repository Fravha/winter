import { AppError } from "../../shared/errors/app-error.js";
import {
  assertReportRecordLimit,
  MAX_REPORT_ROWS,
} from "../../shared/reports/report-limits.js";
import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { InventoryApi } from "./inventory.api.js";
import type { AdjustmentInput, InventoryMovementListInput, InventoryMovementListResult, InventoryReportFilters, InventoryReportMovementRow, InventoryReportStockRow, LotInput, MovementInput, RegisterInboundInput, RegisterInboundResult, TransferInput, WarehouseInput, WarehouseUpdateInput } from "./inventory.dto.js";
import { isTrustedIntermoduleContext } from "./inventory.model.js";
import type { ExecutionContext, InventoryLotClassification, InventoryUnit, TrustedIntermoduleContext, CommandResult } from "./inventory.model.js";
import { InventoryUnitOfWork } from "./inventory.unit-of-work.js";
import type { ArticulosApi } from "../articulos/articulos.api.js";
import { createHash } from "node:crypto";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
const prismaCode = (error: unknown, code: string) => typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;

export const parseInventoryQuantity = (value: string | number): bigint => {
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(text)) throw new AppError("INVALID_QUANTITY", "Quantity must be a non-zero decimal with at most 3 places", 400);
  const [whole = "0", fraction = ""] = text.split(".");
  const valueInThousandths = BigInt(whole) * 1000n
    + BigInt((whole.startsWith("-") ? "-" : "") + fraction.padEnd(3, "0"));
  return valueInThousandths;
};
export const parsePositiveInventoryQuantity = (
  value: string | number,
  unit?: InventoryUnit,
): bigint => {
  const result = parseInventoryQuantity(value);
  if (result <= 0n) throw new AppError("INVALID_QUANTITY", "Quantity must be positive", 400);
  if (unit === "UNIDAD" && result % 1000n !== 0n) {
    throw new AppError("INVALID_QUANTITY", "UNIDAD quantities must be integers", 400);
  }
  return result;
};
export const formatInventoryQuantity = (n: bigint) => `${n < 0n ? "-" : ""}${(n < 0n ? -n : n) / 1000n}.${String((n < 0n ? -n : n) % 1000n).padStart(3, "0")}`;
const required = (ctx: ExecutionContext, permission: string) => {
  if (!ctx?.actorUserId || !ctx.permissions.includes(permission)) throw new AppError("AUTH_FORBIDDEN", `Missing permission ${permission}`, 403);
};
const canonical = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
};
export const inventoryRequestFingerprint = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");

export class InventoryService implements InventoryApi {
  async listActiveWarehouseOptions() {
    return this.prisma.warehouse.findMany({ where: { activo: true }, select: { id: true, codigo: true, nombre: true }, orderBy: [{ codigo: "asc" }, { id: "asc" }] });
  }
  async queryReportWarehouseOptions(filters: { page: number; pageSize: number; search?: string }) {
    const where = {
      activo: true,
      ...(filters.search ? {
        OR: [
          { codigo: { contains: filters.search, mode: "insensitive" as const } },
          { nombre: { contains: filters.search, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize,
        select: { id: true, codigo: true, nombre: true },
        orderBy: [{ codigo: "asc" }, { id: "asc" }],
      }),
      this.prisma.warehouse.count({ where }),
    ]);
    return { items, pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } };
  }
  private readonly uow: InventoryUnitOfWork;
  constructor(private readonly prisma: PrismaClient, private readonly articulos?: ArticulosApi) { this.uow = new InventoryUnitOfWork(prisma); }
  private async validateArticle(
    input: MovementInput,
    transaction?: SharedTransactionContext,
  ): Promise<void> {
    if (!this.articulos) throw new AppError("DEPENDENCY_UNAVAILABLE", "Articulos dependency is required", 500);
    const result = transaction
      ? await this.articulos.validateArticuloInTransaction(
        { articuloId: input.articuloId },
        transaction,
      )
      : await this.articulos.validateArticulo({ articuloId: input.articuloId });
    if (!result.valid || !result.articulo) throw new AppError("ARTICULO_INVALID", "Articulo does not exist or is inactive", 400);
    if (result.articulo.unidadMedida !== input.unit) throw new AppError("UNIT_MISMATCH", "Quantity must use the Articulo base unit", 400, { expected: result.articulo.unidadMedida, received: input.unit });
  }
  async registerInbounds(
    input: RegisterInboundInput,
    context: TrustedIntermoduleContext,
    transaction: SharedTransactionContext,
  ): Promise<readonly RegisterInboundResult[]> {
    if (!isTrustedIntermoduleContext(context)) {
      throw new AppError("AUTH_FORBIDDEN", "Inventory inbound context is not trusted", 403);
    }
    if (input.entries.length === 0) {
      throw new AppError("VALIDATION_ERROR", "At least one inbound entry is required", 400);
    }

    const articleIds = new Set<string>();
    const idempotencyKeys = new Set<string>();
    for (const entry of input.entries) {
      if (articleIds.has(entry.articuloId)) {
        throw new AppError("DUPLICATE_ARTICULO", "An articulo cannot be repeated in an inbound batch", 400);
      }
      articleIds.add(entry.articuloId);
      if (idempotencyKeys.has(entry.idempotencyKey)) {
        throw new AppError("IDEMPOTENCY_CONFLICT", "Inbound idempotency keys must be unique", 409);
      }
      idempotencyKeys.add(entry.idempotencyKey);
      parsePositiveInventoryQuantity(entry.quantity, entry.unit);
      if (!entry.idempotencyKey.trim()) {
        throw new AppError("VALIDATION_ERROR", "Inbound idempotency keys are required", 400);
      }
    }

    const warehouse = await transaction.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", 404);
    if (!warehouse.activo) {
      throw new AppError("WAREHOUSE_INACTIVE", "Warehouse is inactive", 409);
    }
    for (const entry of input.entries) {
      await this.validateArticle({
        articuloId: entry.articuloId,
        warehouseId: input.warehouseId,
        quantity: entry.quantity,
        unit: entry.unit,
        source: "COMPRAS",
        idempotencyKey: entry.idempotencyKey,
        ...(entry.inventoryLotId === undefined ? {} : { inventoryLotId: entry.inventoryLotId }),
      }, transaction);
    }
    for (const entry of input.entries) {
      if (entry.inventoryLotId === undefined) continue;
      const lot = await transaction.inventoryLot.findUnique({
        where: { id: entry.inventoryLotId },
      });
      if (!lot) throw new AppError("NOT_FOUND", "Inventory lot not found", 404);
      if (lot.articuloId !== entry.articuloId) {
        throw new AppError(
          "LOT_ARTICULO_MISMATCH",
          "Lot articulo does not match movement articulo",
          400,
        );
      }
    }

    const results: RegisterInboundResult[] = [];
    for (const entry of input.entries) {
      const amount = parsePositiveInventoryQuantity(entry.quantity, entry.unit);
      const fingerprint = inventoryRequestFingerprint({
        operation: "PURCHASE_INBOUND",
        warehouseId: input.warehouseId,
        entry,
      });
      const result = await this.idempotent(
        transaction,
        entry.idempotencyKey,
        "PURCHASE_INBOUND",
        fingerprint,
        async (): Promise<RegisterInboundResult> => {
          let inventoryLotId = entry.inventoryLotId ?? null;
          if (inventoryLotId) {
            const lot = await transaction.inventoryLot.findUnique({
              where: { id: inventoryLotId },
            });
            if (!lot) throw new AppError("NOT_FOUND", "Inventory lot not found", 404);
            if (lot.articuloId !== entry.articuloId) {
              throw new AppError(
                "LOT_ARTICULO_MISMATCH",
                "Lot articulo does not match movement articulo",
                400,
              );
            }
          }

          const existing = await transaction.inventoryStock.findFirst({
            where: {
              warehouseId: input.warehouseId,
              articuloId: entry.articuloId,
              inventoryLotId,
            },
          });
          const before = parseInventoryQuantity(existing?.quantity?.toString() ?? "0");
          const resulting = before + amount;
          const stock = existing
            ? await transaction.inventoryStock.update({
              where: { id: existing.id },
              data: { quantity: formatInventoryQuantity(resulting) },
            })
            : await transaction.inventoryStock.create({
              data: {
                warehouseId: input.warehouseId,
                articuloId: entry.articuloId,
                inventoryLotId,
                quantity: formatInventoryQuantity(resulting),
                unit: entry.unit,
              },
            });
          const movement = await transaction.inventoryMovement.create({
            data: {
              type: "INBOUND",
              source: "COMPRAS",
              reason: null,
              articuloId: entry.articuloId,
              warehouseId: input.warehouseId,
              inventoryLotId,
              quantity: formatInventoryQuantity(amount),
              unit: entry.unit,
              stockBefore: formatInventoryQuantity(before),
              resultingStock: formatInventoryQuantity(resulting),
              actorUserId: context.actorUserId,
              negativeStockAuthorized: false,
              negativeStockAuthorizerUserId: null,
              negativeStockReason: null,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: context.actorUserId,
              action: "INVENTORY_PURCHASE_INBOUND_REGISTERED",
              resourceType: "InventoryMovement",
              resourceId: movement.id,
              requestId: context.requestId ?? null,
              metadata: {
                articuloId: entry.articuloId,
                warehouseId: input.warehouseId,
                inventoryLotId,
                quantity: formatInventoryQuantity(amount),
                resultingStock: formatInventoryQuantity(resulting),
              },
            },
          });
          return {
            movementId: movement.id,
            articuloId: entry.articuloId,
            inventoryLotId,
            quantity: formatInventoryQuantity(amount),
            unit: entry.unit,
            resultingStock: stock.quantity.toString(),
            createdAt: movement.createdAt.toISOString(),
          };
        },
      );
      results.push(result);
    }
    return results;
  }
  private async idempotent<T>(tx: Prisma.TransactionClient, key: string, operation: string, requestFingerprint: string, work: () => Promise<T>): Promise<T> {
    const prior = await tx.inventoryIdempotency.findUnique({ where: { key } });
    if (prior) {
      if (prior.operation !== operation || prior.requestFingerprint !== requestFingerprint) throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for another operation or payload", 409);
      return prior.response as T;
    }
    const result = await work();
    await tx.inventoryIdempotency.create({ data: { key, operation, requestFingerprint, response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue } });
    return result;
  }
  private async movement(input: MovementInput, ctx: ExecutionContext, type: "INBOUND" | "OUTBOUND" | "ADJUSTMENT", permission: string, lotInput?: LotInput, operationName: string = type) {
    required(ctx, permission);
    await this.validateArticle(input);
    const amount = parsePositiveInventoryQuantity(input.quantity, input.unit as InventoryUnit);
    if (!["KG", "G", "L", "M", "UNIDAD"].includes(input.unit)) throw new AppError("INVALID_UNIT", "Unit is not supported", 400);
    return this.uow.execute(async (tx) => this.idempotent(tx, input.idempotencyKey, operationName, inventoryRequestFingerprint({ input, lotInput }), async () => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", 404);
      if (!warehouse.activo) throw new AppError("WAREHOUSE_INACTIVE", "Warehouse is inactive", 409);
      let inventoryLotId = input.inventoryLotId ?? null;
      if (lotInput) {
        if (lotInput.articuloId !== input.articuloId) throw new AppError("LOT_ARTICULO_MISMATCH", "Lot articulo does not match movement articulo", 400);
        const lot = await tx.inventoryLot.upsert({
          where: { articuloId_lotCode: { articuloId: lotInput.articuloId, lotCode: lotInput.lotCode } },
          update: {},
          create: { articuloId: lotInput.articuloId, lotCode: lotInput.lotCode, classification: lotInput.classification, fechaIngreso: lotInput.fechaIngreso, observations: lotInput.observations ?? null },
        });
        inventoryLotId = lot.id;
      }
      if (inventoryLotId) {
        const lot = await tx.inventoryLot.findUnique({ where: { id: inventoryLotId } });
        if (!lot) throw new AppError("NOT_FOUND", "Inventory lot not found", 404);
        if (lot.articuloId !== input.articuloId) throw new AppError("LOT_ARTICULO_MISMATCH", "Lot articulo does not match movement articulo", 400);
      }
      const existing = await tx.inventoryStock.findFirst({ where: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId } });
      const before = parseInventoryQuantity(existing?.quantity?.toString() ?? "0");
      const resulting = type === "INBOUND" || (type === "ADJUSTMENT" && (input as AdjustmentInput).direction === "INCREASE") ? before + amount : before - amount;
      const authorize = input.authorizeNegativeStock === true;
      if (resulting < 0n && (!authorize || !input.negativeStockReason?.trim())) throw new AppError("NEGATIVE_STOCK_AUTHORIZATION_REQUIRED", "Insufficient stock requires explicit authorization", 409, { available: formatInventoryQuantity(before), requested: formatInventoryQuantity(amount), resulting: formatInventoryQuantity(resulting), articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId: input.inventoryLotId ?? null, requiresNegativeStockAuthorization: true });
      if (resulting < 0n && !ctx.permissions.includes("inventory:negative_stock_authorize")) throw new AppError("AUTH_FORBIDDEN", "Negative stock authorization permission is required", 403);
      const row = existing
        ? await tx.inventoryStock.update({ where: { id: existing.id }, data: { quantity: formatInventoryQuantity(resulting) } })
        : await tx.inventoryStock.create({ data: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId, quantity: formatInventoryQuantity(resulting), unit: input.unit as InventoryUnit } });
      const movement = await tx.inventoryMovement.create({ data: { type, source: input.source, reason: input.reason ?? null, articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId, quantity: formatInventoryQuantity(amount), unit: input.unit as InventoryUnit, stockBefore: formatInventoryQuantity(before), resultingStock: formatInventoryQuantity(resulting), actorUserId: ctx.actorUserId, negativeStockAuthorized: resulting < 0n, negativeStockAuthorizerUserId: resulting < 0n ? ctx.actorUserId : null, negativeStockReason: resulting < 0n ? (input.negativeStockReason ?? null) : null } });
      await tx.auditLog.create({ data: { actorUserId: ctx.actorUserId, action: "INVENTORY_MOVEMENT_REGISTERED", resourceType: "InventoryMovement", resourceId: movement.id, requestId: ctx.requestId ?? null, metadata: { type, articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId, stockBefore: formatInventoryQuantity(before), requested: formatInventoryQuantity(amount), resultingStock: formatInventoryQuantity(resulting), negativeStockAuthorized: resulting < 0n, negativeStockReason: input.negativeStockReason ?? null } } });
      return { movementId: movement.id, articuloId: input.articuloId, inventoryLotId, quantity: formatInventoryQuantity(amount), unit: input.unit, resultingStock: row.quantity.toString(), createdAt: movement.createdAt.toISOString() };
    }));
  }
  registerInbound(input: MovementInput, c: ExecutionContext) { return this.movement(input, c, "INBOUND", "inventory:inbound"); }
  registerOutbound(input: MovementInput, c: ExecutionContext) { return this.movement(input, c, "OUTBOUND", "inventory:outbound"); }
  registerAdjustment(input: AdjustmentInput, c: ExecutionContext) { return this.movement(input, c, "ADJUSTMENT", "inventory:adjust"); }
  registerProductionConsumption(input: MovementInput, c: ExecutionContext) { return this.movement(input, c, "OUTBOUND", "inventory:outbound", undefined, "PRODUCTION_CONSUMPTION"); }
  private async productionConsumption(input: MovementInput, c: TrustedIntermoduleContext, tx: SharedTransactionContext, reverse: boolean): Promise<CommandResult> {
    if (!isTrustedIntermoduleContext(c)) throw new AppError("AUTH_FORBIDDEN", "Inventory context is not trusted", 403);
    await this.validateArticle(input, tx);
    const amount = parsePositiveInventoryQuantity(input.quantity, input.unit as InventoryUnit);
    const operation = reverse ? "PRODUCTION_INPUT_REVERSAL" : "PRODUCTION_INPUT_CONSUMPTION";
    const fingerprint = inventoryRequestFingerprint({ operation, input });
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`;
    return this.idempotent(tx, input.idempotencyKey, operation, fingerprint, async () => {
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${"inventory-stock:" + input.warehouseId + ":" + input.articuloId + ":" + (input.inventoryLotId ?? "none")}))`;
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", 404);
      if (!warehouse.activo) throw new AppError("WAREHOUSE_INACTIVE", "Warehouse is inactive", 409);
      if (input.inventoryLotId) {
        const lot = await tx.inventoryLot.findUnique({ where: { id: input.inventoryLotId } });
        if (!lot) throw new AppError("NOT_FOUND", "Inventory lot not found", 404);
        if (lot.articuloId !== input.articuloId) throw new AppError("LOT_ARTICULO_MISMATCH", "Lot articulo does not match movement articulo", 400);
      }
      const existing = await tx.inventoryStock.findFirst({ where: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null } });
      const before = parseInventoryQuantity(existing?.quantity?.toString() ?? "0");
      const resulting = reverse ? before + amount : before - amount;
      const authorized = input.authorizeNegativeStock === true;
      if (resulting < 0n && (!authorized || !input.negativeStockReason?.trim())) throw new AppError("NEGATIVE_STOCK_AUTHORIZATION_REQUIRED", "Insufficient stock requires explicit authorization", 409);
      if (resulting < 0n && !c.permissions.includes("inventory:negative_stock_authorize")) throw new AppError("AUTH_FORBIDDEN", "Negative stock authorization permission is required", 403);
      const row = existing
        ? await tx.inventoryStock.update({ where: { id: existing.id }, data: { quantity: formatInventoryQuantity(resulting) } })
        : await tx.inventoryStock.create({ data: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(resulting), unit: input.unit as InventoryUnit } });
      const movement = await tx.inventoryMovement.create({ data: { type: reverse ? "INBOUND" : "OUTBOUND", source: input.source, reason: input.reason ?? null, articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(amount), unit: input.unit as InventoryUnit, stockBefore: formatInventoryQuantity(before), resultingStock: formatInventoryQuantity(resulting), actorUserId: c.actorUserId, negativeStockAuthorized: resulting < 0n, negativeStockAuthorizerUserId: resulting < 0n ? c.actorUserId : null, negativeStockReason: resulting < 0n ? input.negativeStockReason ?? null : null } });
      await tx.auditLog.create({ data: { actorUserId: c.actorUserId, action: reverse ? "INVENTORY_PRODUCTION_INPUT_REVERSED" : "INVENTORY_PRODUCTION_INPUT_CONSUMED", resourceType: "InventoryMovement", resourceId: movement.id, requestId: c.requestId ?? null, metadata: { articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(amount) } } });
      return { movementId: movement.id, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(amount), unit: input.unit as InventoryUnit, resultingStock: row.quantity.toString(), createdAt: movement.createdAt };
    });
  }
  consumeProductionInput(input: MovementInput, c: TrustedIntermoduleContext, tx: SharedTransactionContext) { return this.productionConsumption(input, c, tx, false); }
  reverseProductionInputConsumption(input: MovementInput, c: TrustedIntermoduleContext, tx: SharedTransactionContext) { return this.productionConsumption(input, c, tx, true); }
  async registerTransfer(input: TransferInput, c: ExecutionContext) {
    required(c, "inventory:transfer"); const amount = parsePositiveInventoryQuantity(input.quantity, input.unit as InventoryUnit);
    if (input.sourceWarehouseId === input.destinationWarehouseId) throw new AppError("INVALID_TRANSFER", "Source and destination warehouses must differ", 400);
    await this.validateArticle({ ...input, warehouseId: input.sourceWarehouseId });
    return this.uow.execute(async (tx) => this.idempotent(tx, input.idempotencyKey, "TRANSFER", inventoryRequestFingerprint(input), async () => {
      const sourceWarehouse = await tx.warehouse.findUnique({ where: { id: input.sourceWarehouseId } });
      const destinationWarehouse = await tx.warehouse.findUnique({ where: { id: input.destinationWarehouseId } });
      if (!sourceWarehouse || !destinationWarehouse) throw new AppError("NOT_FOUND", "Transfer warehouse not found", 404);
      if (!sourceWarehouse.activo || !destinationWarehouse.activo) throw new AppError("WAREHOUSE_INACTIVE", "Transfer warehouses must be active", 409);
      if (input.inventoryLotId) {
        const lot = await tx.inventoryLot.findUnique({ where: { id: input.inventoryLotId } });
        if (!lot) throw new AppError("NOT_FOUND", "Inventory lot not found", 404);
        if (lot.articuloId !== input.articuloId) throw new AppError("LOT_ARTICULO_MISMATCH", "Lot articulo does not match movement articulo", 400);
      }
      const source = await tx.inventoryStock.findFirst({ where: { warehouseId: input.sourceWarehouseId, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null } });
      const before = parseInventoryQuantity(source?.quantity?.toString() ?? "0"), resulting = before - amount;
      if (resulting < 0n && (!input.authorizeNegativeStock || !input.negativeStockReason?.trim())) throw new AppError("NEGATIVE_STOCK_AUTHORIZATION_REQUIRED", "Insufficient stock requires explicit authorization", 409, { available: formatInventoryQuantity(before), requested: formatInventoryQuantity(amount), resulting: formatInventoryQuantity(resulting), articuloId: input.articuloId, warehouseId: input.sourceWarehouseId, inventoryLotId: input.inventoryLotId ?? null, requiresNegativeStockAuthorization: true });
      if (resulting < 0n && !c.permissions.includes("inventory:negative_stock_authorize")) throw new AppError("AUTH_FORBIDDEN", "Negative stock authorization permission is required", 403);
      if (source) {
        await tx.inventoryStock.update({
          where: { id: source.id },
          data: { quantity: formatInventoryQuantity(resulting) },
        });
      } else {
        await tx.inventoryStock.create({
          data: {
            warehouseId: input.sourceWarehouseId,
            articuloId: input.articuloId,
            inventoryLotId: input.inventoryLotId ?? null,
            quantity: formatInventoryQuantity(resulting),
            unit: input.unit as InventoryUnit,
          },
        });
      }
      const dest = await tx.inventoryStock.findFirst({ where: { warehouseId: input.destinationWarehouseId, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null } });
      const destResult = (parseInventoryQuantity(dest?.quantity?.toString() ?? "0") + amount);
      if (dest) await tx.inventoryStock.update({ where: { id: dest.id }, data: { quantity: formatInventoryQuantity(destResult) } }); else await tx.inventoryStock.create({ data: { warehouseId: input.destinationWarehouseId, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(destResult), unit: input.unit as InventoryUnit } });
      const m = await tx.inventoryMovement.create({ data: { type: "TRANSFER", source: input.source, reason: input.reason ?? null, articuloId: input.articuloId, warehouseId: input.sourceWarehouseId, destinationWarehouseId: input.destinationWarehouseId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(amount), unit: input.unit as InventoryUnit, stockBefore: formatInventoryQuantity(before), resultingStock: formatInventoryQuantity(resulting), actorUserId: c.actorUserId, negativeStockAuthorized: resulting < 0n, negativeStockAuthorizerUserId: resulting < 0n ? c.actorUserId : null, negativeStockReason: resulting < 0n ? (input.negativeStockReason ?? null) : null } });
      await tx.auditLog.create({ data: { actorUserId: c.actorUserId, action: "INVENTORY_MOVEMENT_REGISTERED", resourceType: "InventoryMovement", resourceId: m.id, requestId: c.requestId ?? null, metadata: { type: "TRANSFER", articuloId: input.articuloId, warehouseId: input.sourceWarehouseId, destinationWarehouseId: input.destinationWarehouseId, inventoryLotId: input.inventoryLotId ?? null, stockBefore: formatInventoryQuantity(before), requested: formatInventoryQuantity(amount), resultingStock: formatInventoryQuantity(resulting), destinationResultingStock: formatInventoryQuantity(destResult), negativeStockAuthorized: resulting < 0n } } });
      return { movementId: m.id, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId ?? null, quantity: formatInventoryQuantity(amount), unit: input.unit, resultingStock: formatInventoryQuantity(resulting), destinationResultingStock: formatInventoryQuantity(destResult), createdAt: m.createdAt.toISOString() };
    }));
  }
  async registerProductionOutput(input: MovementInput & { lot?: LotInput }, c: ExecutionContext) {
    if (!input.lot) throw new AppError("LOT_REQUIRED", "Production output requires a lot", 400);
    if (input.lot.classification !== "PRODUCTO_ENVASADO") throw new AppError("INVALID_LOT_CLASSIFICATION", "Production output lots must start as PRODUCTO_ENVASADO", 400);
    await this.validateArticle(input);
    return this.movement({ ...input, source: input.source || "PRODUCTION_OUTPUT" }, c, "INBOUND", "inventory:inbound", input.lot, "PRODUCTION_OUTPUT");
  }
  async releaseProductionOutput(input: { warehouseId: string; articuloId: string; unit: string; quantity: string; lotCode: string; classification: "PRODUCTO_ENVASADO"; fechaIngreso: Date; observations?: string; originProductionBatchId: string; idempotencyKey: string }, c: TrustedIntermoduleContext, tx: SharedTransactionContext) {
    if (!isTrustedIntermoduleContext(c)) throw new AppError("AUTH_FORBIDDEN", "Inventory context is not trusted", 403);
    if (input.classification !== "PRODUCTO_ENVASADO") throw new AppError("INVALID_LOT_CLASSIFICATION", "Production output lots must start as PRODUCTO_ENVASADO", 400);
    const fingerprint = inventoryRequestFingerprint(input);
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`;
    return this.idempotent(tx, input.idempotencyKey, "PRODUCTION_OUTPUT_RELEASE", fingerprint, async () => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", 404);
      if (!warehouse.activo) throw new AppError("WAREHOUSE_INACTIVE", "Warehouse is inactive", 409);
      await this.validateArticle({ articuloId: input.articuloId, warehouseId: input.warehouseId, quantity: input.quantity, unit: input.unit, source: "PRODUCTION_OUTPUT", idempotencyKey: input.idempotencyKey }, tx);
      const canonicalLotCode = input.lotCode.toLocaleLowerCase("en-US");
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${"inventory-lot:" + input.articuloId + ":" + canonicalLotCode}))`;
      const existingLot = await tx.inventoryLot.findFirst({
        where: { articuloId: input.articuloId, lotCode: { equals: input.lotCode, mode: "insensitive" } },
      });
      if (existingLot && existingLot.originProductionBatchId !== input.originProductionBatchId) {
        throw new AppError("LOT_ORIGIN_CONFLICT", "Inventory lot belongs to another origin", 409);
      }
      if (existingLot && (existingLot.classification !== input.classification || existingLot.fechaIngreso.getTime() !== input.fechaIngreso.getTime() || (existingLot.observations ?? null) !== (input.observations ?? null))) {
        throw new AppError("LOT_METADATA_CONFLICT", "Inventory lot metadata conflicts with the requested production output", 409);
      }
      // The production primitive supplies originProductionBatchId without exposing inventory tables to Production.
      let lot = existingLot;
      if (!lot) {
        await tx.inventoryLot.createMany({
          data: [{ articuloId: input.articuloId, lotCode: input.lotCode, classification: input.classification, fechaIngreso: input.fechaIngreso, observations: input.observations ?? null, originProductionBatchId: input.originProductionBatchId }],
          skipDuplicates: true,
        });
        lot = await tx.inventoryLot.findFirst({
          where: { articuloId: input.articuloId, lotCode: { equals: input.lotCode, mode: "insensitive" } },
        });
        if (!lot) throw new AppError("LOT_ORIGIN_CONFLICT", "Inventory lot could not be claimed", 409);
      }
      if (lot.originProductionBatchId !== input.originProductionBatchId) throw new AppError("LOT_ORIGIN_CONFLICT", "Inventory lot belongs to another origin", 409);
      const amount = parsePositiveInventoryQuantity(input.quantity, input.unit as InventoryUnit);
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${"inventory-stock:" + input.warehouseId + ":" + input.articuloId + ":" + lot.id}))`;
      const stock = await tx.inventoryStock.findFirst({ where: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId: lot.id } });
      const before = parseInventoryQuantity(stock?.quantity.toString() ?? "0");
      const resulting = before + amount;
      const row = stock ? await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: formatInventoryQuantity(resulting) } }) : await tx.inventoryStock.create({ data: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId: lot.id, quantity: formatInventoryQuantity(resulting), unit: input.unit as InventoryUnit } });
      const movement = await tx.inventoryMovement.create({ data: { type: "INBOUND", source: "PRODUCTION_OUTPUT", reason: null, articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId: lot.id, quantity: formatInventoryQuantity(amount), unit: input.unit as InventoryUnit, stockBefore: formatInventoryQuantity(before), resultingStock: formatInventoryQuantity(resulting), actorUserId: c.actorUserId, negativeStockAuthorized: false } });
      return { inventoryLotId: lot.id, inventoryMovementId: movement.id, warehouseId: input.warehouseId, resultingStock: row.quantity.toString() };
    });
  }
  async reverseProductionOutput(input: { warehouseId: string; articuloId: string; unit: string; quantity: string; inventoryLotId: string; idempotencyKey: string; reason: string }, c: TrustedIntermoduleContext, tx: SharedTransactionContext) {
    if (!isTrustedIntermoduleContext(c)) throw new AppError("AUTH_FORBIDDEN", "Inventory context is not trusted", 403);
    const fingerprint = inventoryRequestFingerprint(input);
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`;
    return this.idempotent(tx, input.idempotencyKey, "PRODUCTION_OUTPUT_REVERSAL", fingerprint, async () => {
      const lot = await tx.inventoryLot.findUnique({ where: { id: input.inventoryLotId } });
      if (!lot || lot.articuloId !== input.articuloId) throw new AppError("LOT_ARTICULO_MISMATCH", "Inventory lot does not match release", 409);
      if (lot.classification !== "PRODUCTO_ENVASADO") throw new AppError("INVALID_LOT_CLASSIFICATION", "Only PRODUCTO_ENVASADO output can be reversed", 409);
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${"inventory-stock:" + input.warehouseId + ":" + input.articuloId + ":" + lot.id}))`;
      const stock = await tx.inventoryStock.findFirst({ where: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId: lot.id } });
      const before = parseInventoryQuantity(stock?.quantity.toString() ?? "0");
      const amount = parseInventoryQuantity(input.quantity);
      const resulting = before - amount;
      if (resulting < 0n) throw new AppError("INSUFFICIENT_EXACT_STOCK", "Released inventory is no longer available for reversal", 409);
      const row = stock ? await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: formatInventoryQuantity(resulting) } }) : null;
      const movement = await tx.inventoryMovement.create({ data: { type: "OUTBOUND", source: "PRODUCTION_OUTPUT_REVERSAL", reason: input.reason, articuloId: input.articuloId, warehouseId: input.warehouseId, inventoryLotId: lot.id, quantity: formatInventoryQuantity(amount), unit: input.unit as InventoryUnit, stockBefore: formatInventoryQuantity(before), resultingStock: formatInventoryQuantity(resulting), actorUserId: c.actorUserId, negativeStockAuthorized: false } });
      return { inventoryMovementId: movement.id, inventoryLotId: lot.id, warehouseId: input.warehouseId, resultingStock: row?.quantity.toString() ?? "0.000" };
    });
  }
  async isProductionOutputReversible(input: { warehouseId: string; articuloId: string; unit: string; quantity: string; inventoryLotId: string }, c: TrustedIntermoduleContext) {
    if (!isTrustedIntermoduleContext(c)) throw new AppError("AUTH_FORBIDDEN", "Inventory context is not trusted", 403);
    const lot = await this.prisma.inventoryLot.findUnique({ where: { id: input.inventoryLotId } });
    if (!lot || lot.articuloId !== input.articuloId || lot.classification !== "PRODUCTO_ENVASADO") return false;
    const stock = await this.prisma.inventoryStock.findFirst({ where: { warehouseId: input.warehouseId, articuloId: input.articuloId, inventoryLotId: input.inventoryLotId } });
    if (!stock || stock.unit !== input.unit) return false;
    return parseInventoryQuantity(stock.quantity.toString()) >= parseInventoryQuantity(input.quantity);
  }
  async areProductionOutputsReversible(inputs: ReadonlyArray<{ warehouseId: string; articuloId: string; unit: string; quantity: string; inventoryLotId: string }>, c: TrustedIntermoduleContext) {
    if (!isTrustedIntermoduleContext(c)) throw new AppError("AUTH_FORBIDDEN", "Inventory context is not trusted", 403);
    if (inputs.length === 0) return [];
    const lotIds = [...new Set(inputs.map(input => input.inventoryLotId))];
    const warehouseIds = [...new Set(inputs.map(input => input.warehouseId))];
    const articuloIds = [...new Set(inputs.map(input => input.articuloId))];
    const [lots, stocks] = await Promise.all([
      this.prisma.inventoryLot.findMany({ where: { id: { in: lotIds } }, select: { id: true, articuloId: true, classification: true } }),
      this.prisma.inventoryStock.findMany({ where: { warehouseId: { in: warehouseIds }, articuloId: { in: articuloIds }, inventoryLotId: { in: lotIds } }, select: { warehouseId: true, articuloId: true, inventoryLotId: true, unit: true, quantity: true } }),
    ]);
    const lotMap = new Map(lots.map(lot => [lot.id, lot]));
    const stockMap = new Map(stocks.map(stock => [`${stock.warehouseId}:${stock.articuloId}:${stock.inventoryLotId}`, stock]));
    return inputs.map(input => {
      const lot = lotMap.get(input.inventoryLotId);
      const stock = stockMap.get(`${input.warehouseId}:${input.articuloId}:${input.inventoryLotId}`);
      return Boolean(lot && lot.articuloId === input.articuloId && lot.classification === "PRODUCTO_ENVASADO" && stock && stock.unit === input.unit && parseInventoryQuantity(stock.quantity.toString()) >= parseInventoryQuantity(input.quantity));
    });
  }
  async transitionInventoryLotClassification(input: { inventoryLotId: string; classification: InventoryLotClassification; idempotencyKey: string }, c: ExecutionContext) {
    required(c, "inventory:lot_classify");
    return this.uow.execute(async (tx) => this.idempotent(tx, input.idempotencyKey, "LOT_CLASSIFY", inventoryRequestFingerprint(input), async () => {
      const lot = await tx.inventoryLot.findUnique({ where: { id: input.inventoryLotId } }); if (!lot) throw new AppError("NOT_FOUND", "Lot not found", 404);
      const allowed = (lot.classification === "PRODUCTO_ENVASADO" && input.classification === "PRODUCTO_TERMINADO") || (lot.classification === "PRODUCTO_TERMINADO" && input.classification === "PRODUCTO_TERMINADO_EXPORTACION");
      if (!allowed) throw new AppError("INVALID_CLASSIFICATION_TRANSITION", "Classification transition is not allowed", 400);
      const updated = await tx.inventoryLot.update({ where: { id: lot.id }, data: { classification: input.classification } });
      await tx.auditLog.create({ data: { actorUserId: c.actorUserId, action: "INVENTORY_LOT_CLASSIFIED", resourceType: "InventoryLot", resourceId: lot.id, metadata: { previousClassification: lot.classification, classification: input.classification } } });
      return { inventoryLotId: lot.id, previousClassification: lot.classification, classification: updated.classification, updatedAt: updated.updatedAt.toISOString() };
    }));
  }
  getWarehouse(i: { warehouseId: string }) { return this.prisma.warehouse.findUniqueOrThrow({ where: { id: i.warehouseId } }); }

  listWarehouses(
    i: { page?: number | string; pageSize?: number | string } = {},
  ) {
    const page = Number(i.page ?? 1);
    const pageSize = Number(i.pageSize ?? 20);

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "page must be a positive integer",
        400,
      );
    }

    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "pageSize must be a positive integer",
        400,
      );
    }

    return this.prisma.warehouse.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { codigo: "asc" },
    });
  }

  async listMovements(
    i: InventoryMovementListInput,
  ): Promise<InventoryMovementListResult> {
    const page = Number(i.page ?? 1);
    const pageSize = Number(i.pageSize ?? 20);

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "page must be a positive integer",
        400,
      );
    }

    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "pageSize must be a positive integer",
        400,
      );
    }

    const where: Prisma.InventoryMovementWhereInput = {
      articuloId: i.articuloId,
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      ...(i.inventoryLotId ? { inventoryLotId: i.inventoryLotId } : {}),
      ...(i.type ? { type: i.type } : {}),
    };

    const [total, movements] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),

      this.prisma.inventoryMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        select: {
          id: true,
          type: true,
          source: true,
          reason: true,
          quantity: true,
          unit: true,
          stockBefore: true,
          resultingStock: true,
          createdAt: true,

          articulo: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
            },
          },

          warehouse: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
            },
          },

          destinationWarehouse: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
            },
          },

          lot: {
            select: {
              id: true,
              lotCode: true,
            },
          },
        },
      }),
    ]);

    return {
      items: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        source: movement.source,
        reason: movement.reason,
        quantity: formatInventoryQuantity(
          parseInventoryQuantity(movement.quantity.toString()),
        ),
        unit: movement.unit,
        stockBefore: formatInventoryQuantity(
          parseInventoryQuantity(movement.stockBefore.toString()),
        ),
        resultingStock: formatInventoryQuantity(
          parseInventoryQuantity(movement.resultingStock.toString()),
        ),
        createdAt: movement.createdAt.toISOString(),

        articulo: movement.articulo,
        warehouse: movement.warehouse,
        destinationWarehouse: movement.destinationWarehouse,
        lot: movement.lot,
      })),

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async queryReportStock(filters: Pick<InventoryReportFilters, "warehouseId" | "articuloId" | "classification">): Promise<readonly InventoryReportStockRow[]> {
    const rows = await this.prisma.inventoryStock.findMany({
      where: {
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(filters.articuloId ? { articuloId: filters.articuloId } : {}),
        ...(filters.classification ? { lot: { is: { classification: filters.classification } } } : {}),
      },
      take: MAX_REPORT_ROWS + 1,
      select: {
        id: true,
        quantity: true,
        unit: true,
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        articulo: { select: { id: true, codigo: true, nombre: true, unidadMedida: true } },
        lot: { select: { id: true, lotCode: true, classification: true } },
      },
      orderBy: [{ warehouse: { codigo: "asc" } }, { articulo: { codigo: "asc" } }, { id: "asc" }],
    });
    assertReportRecordLimit(rows.length, MAX_REPORT_ROWS, "Inventory stock report");
    return rows.map((row): InventoryReportStockRow => ({
      id: row.id,
      warehouse: row.warehouse,
      articulo: row.articulo,
      inventoryLotId: row.lot?.id ?? null,
      lotCode: row.lot?.lotCode ?? null,
      classification: row.lot?.classification ?? null,
      quantity: row.quantity.toString(),
      unit: row.unit,
    }));
  }

  async queryReportMovements(filters: InventoryReportFilters): Promise<readonly InventoryReportMovementRow[]> {
    const rows = await this.prisma.inventoryMovement.findMany({
      where: {
        ...(filters.articuloId ? { articuloId: filters.articuloId } : {}),
        ...(filters.warehouseId ? { OR: [{ warehouseId: filters.warehouseId }, { destinationWarehouseId: filters.warehouseId }] } : {}),
        ...(filters.movementType ? { type: filters.movementType } : {}),
        ...(filters.from || filters.toExclusive ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.toExclusive ? { lt: filters.toExclusive } : {}) } } : {}),
      },
      take: MAX_REPORT_ROWS + 1,
      select: {
        id: true,
        type: true,
        source: true,
        reason: true,
        quantity: true,
        unit: true,
        createdAt: true,
        articulo: { select: { id: true, codigo: true, nombre: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        destinationWarehouse: { select: { id: true, codigo: true, nombre: true } },
        lot: { select: { id: true, lotCode: true } },
        actor: { select: { id: true, displayName: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    assertReportRecordLimit(rows.length, MAX_REPORT_ROWS, "Inventory movement report");
    return rows.map((row): InventoryReportMovementRow => ({
      ...row,
      quantity: row.quantity.toString(),
    }));
  }

  getInventoryLot(i: { inventoryLotId: string }) { return this.prisma.inventoryLot.findUniqueOrThrow({ where: { id: i.inventoryLotId } }); }
  async getStock(i: { warehouseId: string; articuloId: string; inventoryLotId?: string }) {
    const row = await this.prisma.inventoryStock.findFirst({
      where: {
        warehouseId: i.warehouseId,
        articuloId: i.articuloId,
        inventoryLotId: i.inventoryLotId ?? null,
      },
    });
    const quantity = formatInventoryQuantity(
      parseInventoryQuantity(row?.quantity.toString() ?? "0"),
    );
    return {
      warehouseId: i.warehouseId,
      articuloId: i.articuloId,
      inventoryLotId: i.inventoryLotId ?? null,
      quantity,
      unit: (row?.unit ?? "UNIDAD") as InventoryUnit,
      hasNegativeStock: quantity.startsWith("-"),
    };
  }
  async getAvailableQuantity(i: { warehouseId: string; articuloId: string; inventoryLotId?: string }) { const stock = await this.getStock(i); return { quantity: stock.quantity, unit: stock.unit, hasNegativeStock: stock.hasNegativeStock, warehouseId: stock.warehouseId, articuloId: stock.articuloId, inventoryLotId: stock.inventoryLotId }; }
  async createWarehouse(input: WarehouseInput, c: ExecutionContext): Promise<unknown> { required(c, "inventory:warehouse_create"); return this.uow.execute(async (tx) => { const warehouse = await tx.warehouse.create({ data: { ...input, codigo: input.codigo.trim(), nombre: input.nombre.trim() } }); await tx.auditLog.create({ data: { actorUserId: c.actorUserId, action: "INVENTORY_WAREHOUSE_CREATED", resourceType: "Warehouse", resourceId: warehouse.id } }); return warehouse; }); }
  async updateWarehouse(id: string, input: WarehouseUpdateInput, c: ExecutionContext): Promise<unknown> { required(c, "inventory:warehouse_update"); return this.uow.execute(async (tx) => { const { codigo: _code, ...data } = input as WarehouseUpdateInput & { codigo?: unknown }; const warehouse = await tx.warehouse.update({ where: { id }, data: { ...data, nombre: data.nombre.trim() } }); await tx.auditLog.create({ data: { actorUserId: c.actorUserId, action: "INVENTORY_WAREHOUSE_UPDATED", resourceType: "Warehouse", resourceId: id } }); return warehouse; }); }
  async setWarehouseActive(id: string, active: boolean, c: ExecutionContext): Promise<unknown> { required(c, active ? "inventory:warehouse_activate" : "inventory:warehouse_deactivate"); return this.uow.execute(async (tx) => { if (!active) { const stocks = await tx.inventoryStock.findMany({ where: { warehouseId: id } }); if (stocks.some((s) => s.quantity.toString() !== "0.000")) throw new AppError("WAREHOUSE_HAS_STOCK", "Warehouse with stock cannot be deactivated", 409); } const warehouse = await tx.warehouse.update({ where: { id }, data: { activo: active } }); await tx.auditLog.create({ data: { actorUserId: c.actorUserId, action: active ? "INVENTORY_WAREHOUSE_ACTIVATED" : "INVENTORY_WAREHOUSE_DEACTIVATED", resourceType: "Warehouse", resourceId: id } }); return warehouse; }); }
}