import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import {
  SharedUnitOfWork,
  type SharedTransactionContext,
} from "../../core/database/shared-unit-of-work.js";
import type { ArticulosApi } from "../articulos/articulos.api.js";
import type { InventoryApi } from "../inventory/inventory.api.js";
import { createTrustedIntermoduleContext } from "../inventory/inventory.model.js";
import { parsePositiveInventoryQuantity } from "../inventory/inventory.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  assertReportRecordLimit,
  MAX_REPORT_RELATED_RECORDS,
  MAX_REPORT_ROOT_RECORDS,
} from "../../shared/reports/report-limits.js";
import type { CompraApi } from "./compra.api.js";
import type { CancelCompraDto, CompraReportRow, ComprasReportFilters, CreateCompraDto, ListComprasDto, ReceiveCompraDto, UpdateCompraDto } from "./compra.dto.js";
import type { Compra, CompraItem } from "./compra.model.js";
import { PrismaCompraRepository } from "./prisma-compra.repository.js";
import type { CompraPrismaClient } from "./compra.repository.js";

export class CompraService implements CompraApi {
  private readonly unitOfWork: SharedUnitOfWork;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly articulos: ArticulosApi,
    private readonly inventory: InventoryApi,
  ) {
    this.unitOfWork = new SharedUnitOfWork(prisma);
  }

  async list(input: ListComprasDto = {}) {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const result = await new PrismaCompraRepository(this.prisma).findAll({
      page,
      pageSize,
      ...(input.status === undefined ? {} : { status: input.status }),
    });
    return {
      data: result.items,
      meta: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
    };
  }

  async get(id: string): Promise<Compra> {
    const compra = await new PrismaCompraRepository(this.prisma).findById(id);
    if (!compra) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
    return compra;
  }

  async queryForReport(filters: ComprasReportFilters): Promise<readonly CompraReportRow[]> {
    const dateFilter = filters.from || filters.toExclusive
      ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.toExclusive ? { lt: filters.toExclusive } : {}) }
      : undefined;
    const rows = await this.prisma.compra.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.supplier ? { supplierName: { contains: filters.supplier, mode: "insensitive" } } : {}),
        ...(filters.articuloId ? { items: { some: { articuloId: filters.articuloId } } } : {}),
        ...(dateFilter ? {
          OR: [
            { documentDate: dateFilter },
            { documentDate: null, createdAt: dateFilter },
          ],
        } : {}),
      },
      take: MAX_REPORT_ROOT_RECORDS + 1,
      select: {
        id: true,
        documentNumber: true,
        documentDate: true,
        createdAt: true,
        status: true,
        supplierName: true,
        currency: true,
        items: {
          take: MAX_REPORT_RELATED_RECORDS + 1,
          ...(filters.articuloId ? { where: { articuloId: filters.articuloId } } : {}),
          select: {
            articuloId: true,
            brand: true,
            requestedQuantity: true,
            unit: true,
            unitPrice: true,
            movementRefs: {
              take: MAX_REPORT_RELATED_RECORDS + 1,
              orderBy: { createdAt: "asc" },
              select: { inventoryMovement: { select: { createdAt: true } } },
            },
            articulo: { select: { codigo: true, nombre: true } },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    assertReportRecordLimit(rows.length, MAX_REPORT_ROOT_RECORDS, "Purchase report purchases");
    for (const compra of rows) {
      assertReportRecordLimit(compra.items.length, MAX_REPORT_RELATED_RECORDS, "Purchase report items per purchase");
      for (const item of compra.items) {
        assertReportRecordLimit(item.movementRefs.length, MAX_REPORT_RELATED_RECORDS, "Purchase report receipts per item");
      }
    }
    return rows.flatMap((compra): CompraReportRow[] => compra.items.map((item) => ({
      compraId: compra.id,
      documentNumber: compra.documentNumber,
      date: compra.documentDate ?? compra.createdAt,
      itemReceivedAt: item.movementRefs.length > 0
        ? item.movementRefs.reduce<Date | null>((latest, ref) =>
          latest === null || ref.inventoryMovement.createdAt > latest ? ref.inventoryMovement.createdAt : latest, null)
        : null,
      status: compra.status,
      supplierName: compra.supplierName,
      articuloId: item.articuloId,
      articuloCodigo: item.articulo.codigo,
      articuloNombre: item.articulo.nombre,
      brand: item.brand,
      quantity: item.requestedQuantity.toString(),
      unit: item.unit,
      unitPrice: item.unitPrice?.toString() ?? null,
      currency: compra.currency,
    })));
  }

  async create(input: CreateCompraDto, context: AuthenticatedAuditContext): Promise<Compra> {
    this.validateAdministrativeFields(input);
    await this.validateItems(input.items);
    return this.unitOfWork.execute(async (transaction) => {
      const repository = new PrismaCompraRepository(transaction as CompraPrismaClient);
      const compra = await repository.create({ ...input, createdByUserId: context.actorUserId });
      await this.audit(transaction, context, "COMPRA_CREATED", compra.id, {
        itemCount: compra.items.length,
      });
      return compra;
    });
  }

  async update(id: string, input: UpdateCompraDto, context: AuthenticatedAuditContext): Promise<Compra> {
    if (Object.keys(input).length === 0) {
      throw new AppError("VALIDATION_ERROR", "At least one field must be provided", 400);
    }
    this.validateAdministrativeFields(input);
    const current = await this.get(id);
    if (current.status !== "REGISTERED") {
      throw new AppError("COMPRA_NOT_EDITABLE", "Only REGISTERED compras can be updated", 409);
    }
    if (input.items !== undefined) {
      for (const item of current.items) {
        if (!input.items.some((candidate) => candidate.articuloId === item.articuloId)) {
          throw new AppError("COMPRA_ITEM_REMOVAL_FORBIDDEN", "Compra items cannot be deleted", 409);
        }
      }
      await this.validateItems(input.items);
    }
    return this.unitOfWork.execute(async (transaction) => {
      const repository = new PrismaCompraRepository(transaction as CompraPrismaClient);
      const locked = await repository.findById(id);
      if (!locked) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      if (locked.status !== "REGISTERED") {
        throw new AppError("COMPRA_NOT_EDITABLE", "Only REGISTERED compras can be updated", 409);
      }
      const compra = await repository.update(id, input);
      await this.audit(transaction, context, "COMPRA_UPDATED", id, {
        changedFields: Object.keys(input).sort(),
      });
      return compra;
    });
  }

  async receive(id: string, input: ReceiveCompraDto, context: AuthenticatedAuditContext): Promise<Compra> {
    return this.unitOfWork.execute(async (transaction) => {
      const repository = new PrismaCompraRepository(transaction as CompraPrismaClient);
      const compra = await repository.findById(id);
      if (!compra) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      if (compra.status !== "REGISTERED") {
        throw new AppError("COMPRA_NOT_RECEIVABLE", "Only REGISTERED compras can be received", 409);
      }

      const lotByItem = new Map<string, string | undefined>();
      for (const item of input.items ?? []) {
        if (lotByItem.has(item.compraItemId)) {
          throw new AppError("DUPLICATE_COMPRA_ITEM", "A receive item cannot be repeated", 400);
        }
        lotByItem.set(item.compraItemId, item.inventoryLotId);
      }
      for (const item of compra.items) {
        if (lotByItem.has(item.id) === false && input.items !== undefined) {
          throw new AppError("RECEIVE_ITEMS_MISMATCH", "Receive items must include every compra item", 400);
        }
      }
      if (input.items !== undefined && lotByItem.size !== compra.items.length) {
        throw new AppError("RECEIVE_ITEMS_MISMATCH", "Receive items must match the compra", 400);
      }

      await this.validateItems(compra.items.map((item) => ({
        articuloId: item.articuloId,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit,
      })), transaction);
      const claimed = await transaction.compra.updateMany({
        where: { id, status: "REGISTERED" },
        data: { status: "RECEIVED" },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "COMPRA_NOT_RECEIVABLE",
          "Compra was already claimed for receiving",
          409,
        );
      }
      const trustedContext = createTrustedIntermoduleContext(context);
      const result = await this.inventory.registerInbounds({
        warehouseId: input.warehouseId,
        entries: compra.items.map((item) => {
          const inventoryLotId = lotByItem.get(item.id);
          return {
            articuloId: item.articuloId,
            quantity: item.requestedQuantity,
            unit: item.unit,
            ...(inventoryLotId === undefined ? {} : { inventoryLotId }),
            idempotencyKey: `purchase-receive:${id}:${item.id}`,
          };
        }),
      }, trustedContext, transaction);

      for (let index = 0; index < compra.items.length; index++) {
        const item = compra.items[index];
        const movement = result[index];
        if (!item || !movement) throw new AppError("INVENTORY_BATCH_INVALID", "Inventory returned an incomplete inbound batch", 500);
        await transaction.compraInventoryMovementReference.create({
          data: {
            compraId: id,
            compraItemId: item.id,
            inventoryMovementId: movement.movementId,
          },
        });
      }
      await this.audit(transaction, context, "COMPRA_RECEIVED", id, {
        warehouseId: input.warehouseId,
        movementIds: result.map((movement) => movement.movementId),
      });
      const received = await repository.findById(id);
      if (!received) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      if (received.status !== "RECEIVED") {
        throw new AppError("COMPRA_TRANSITION_FAILED", "Compra receive transition did not complete", 500);
      }
      return received;
    });
  }

  async cancel(id: string, input: CancelCompraDto, context: AuthenticatedAuditContext): Promise<Compra> {
    return this.unitOfWork.execute(async (transaction) => {
      const repository = new PrismaCompraRepository(transaction as CompraPrismaClient);
      const current = await repository.findById(id);
      if (!current) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      if (current.status !== "REGISTERED") {
        throw new AppError("COMPRA_NOT_CANCELLABLE", "Only REGISTERED compras can be cancelled", 409);
      }
      const claimed = await transaction.compra.updateMany({
        where: { id, status: "REGISTERED" },
        data: { status: "CANCELLED" },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "COMPRA_NOT_CANCELLABLE",
          "Compra was already transitioned",
          409,
        );
      }
      await this.audit(transaction, context, "COMPRA_CANCELLED", id, {
        ...(input.reason === undefined ? {} : { cancellationReason: input.reason }),
      });
      const cancelled = await repository.findById(id);
      if (!cancelled) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      return cancelled;
    });
  }

  private async validateItems(
    items: readonly {
      articuloId: string;
      requestedQuantity: string;
      unit: CompraItem["unit"];
      unitPrice?: string;
    }[],
    transaction?: SharedTransactionContext,
  ): Promise<void> {
    if (items.length === 0) {
      throw new AppError("COMPRA_ITEMS_REQUIRED", "At least one item is required", 400);
    }
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.articuloId)) {
        throw new AppError("COMPRA_DUPLICATE_ITEM", "An articulo cannot be repeated in a compra", 400);
      }
      seen.add(item.articuloId);
      parsePositiveInventoryQuantity(item.requestedQuantity, item.unit);
      if (item.unitPrice !== undefined && !/^\d+(?:\.\d{1,3})?$/.test(item.unitPrice)) {
        throw new AppError("INVALID_UNIT_PRICE", "Unit price must be a non-negative decimal with at most 3 places", 400);
      }
      const validation = transaction
        ? await this.articulos.validateArticuloInTransaction(
          { articuloId: item.articuloId },
          transaction,
        )
        : await this.articulos.validateArticulo({ articuloId: item.articuloId });
      if (!validation.valid || !validation.articulo) {
        throw new AppError("ARTICULO_INVALID", "Articulo does not exist or is inactive", 400);
      }
      if (validation.articulo.unidadMedida !== item.unit) {
        throw new AppError("UNIT_MISMATCH", "Item unit must match the articulo base unit", 400, {
          expected: validation.articulo.unidadMedida,
          received: item.unit,
        });
      }
    }
  }

  private validateAdministrativeFields(
    input: CreateCompraDto | UpdateCompraDto,
  ): void {
    if ("supplierName" in input && input.supplierName !== undefined && !input.supplierName.trim()) {
      throw new AppError("VALIDATION_ERROR", "Supplier name is required", 400);
    }
    for (const value of [input.supplierTaxId, input.documentNumber, input.currency]) {
      if (value !== undefined && value !== null && !value.trim()) {
        throw new AppError("VALIDATION_ERROR", "Text fields cannot be empty", 400);
      }
    }
  }

  private async audit(
    transaction: CompraPrismaClient,
    context: AuthenticatedAuditContext,
    action: string,
    resourceId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await transaction.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        action,
        resourceType: "Compra",
        resourceId,
        requestId: context.requestId ?? null,
        metadata,
      },
    });
  }
}