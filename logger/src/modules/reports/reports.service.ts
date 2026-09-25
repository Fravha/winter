import type { AuditService } from "../../core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import type { ArticulosApi } from "../articulos/articulos.api.js";
import type { CompraApi } from "../compras/compra.api.js";
import type { InventoryApi } from "../inventory/inventory.api.js";
import type { ProductionApi } from "../production/production.api.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  reportDateRange,
} from "./reports.schema.js";
import type { ReportsApi, ReportOptionsFilters } from "./reports.api.js";
import type {
  InventoryMovementsReportFilters,
  ProductionWorksReportFilters,
  PurchasesReportFilters,
  StockReportFilters,
  TraceabilityReportFilters,
  TransformationsReportFilters,
  ReportFile,
} from "./reports.types.js";
import {
  addReportSheet,
  createReportWorkbook,
  decimalProduct,
  workbookBuffer,
} from "./reports.workbook.js";

const safePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "batch";
const datePart = (value?: string) => value ?? "todas";
const currentUtcDate = () => new Date().toISOString().slice(0, 10);
const date = (value: string | Date | null | undefined) => value == null ? null : value instanceof Date ? value : new Date(value);

export class ReportsService implements ReportsApi {
  constructor(
    private readonly inventory: InventoryApi,
    private readonly compras: CompraApi,
    private readonly production: ProductionApi,
    private readonly audit: AuditService,
    private readonly articulos?: ArticulosApi,
  ) {}

  async listArticleOptions(filters: ReportOptionsFilters) {
    if (!this.articulos) throw new AppError("DEPENDENCY_UNAVAILABLE", "ArticulosApi is required for report article options", 500);
    const result = await this.articulos.listArticulos({
      page: filters.page,
      pageSize: filters.pageSize,
      ...(filters.search === undefined ? {} : { search: filters.search }),
      activo: true,
    });
    return {
      items: result.items.map(({ id, codigo, nombre, clasificacion, unidadMedida }) => ({ id, codigo, nombre, clasificacion, unidadMedida })),
      pagination: result.pagination,
    };
  }

  listWarehouseOptions(filters: ReportOptionsFilters) {
    return this.inventory.queryReportWarehouseOptions({
      page: filters.page,
      pageSize: filters.pageSize,
      ...(filters.search === undefined ? {} : { search: filters.search }),
    });
  }

  listProductionOrderOptions(filters: ReportOptionsFilters) {
    return this.production.queryReportOrderOptions("production", filters);
  }

  listTransformationOrderOptions(filters: ReportOptionsFilters) {
    return this.production.queryReportOrderOptions("transformation", filters);
  }

  listBatchOptions(filters: ReportOptionsFilters) {
    return this.production.queryReportBatchOptions(filters);
  }

  listWorkTypeOptions(filters: ReportOptionsFilters) {
    return this.production.queryReportWorkTypeOptions(filters);
  }

  listContainerOptions(filters: ReportOptionsFilters) {
    return this.production.queryReportContainerOptions(filters);
  }

  async exportStock(filters: StockReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile> {
    const rows = await this.inventory.queryReportStock({
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.articuloId ? { articuloId: filters.articuloId } : {}),
      ...(filters.classification ? { classification: filters.classification } : {}),
    });
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Stock actual", [
      { header: "Almacén código", key: "warehouseCode" },
      { header: "Almacén", key: "warehouseName" },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 32 },
      { header: "Unidad", key: "unit" },
      { header: "Lote de inventario", key: "lotCode" },
      { header: "Clasificación", key: "classification" },
      { header: "Cantidad actual", key: "quantity" },
      { header: "Warehouse ID", key: "warehouseId", width: 38 },
      { header: "Artículo ID", key: "articuloId", width: 38 },
      { header: "Inventory lot ID", key: "inventoryLotId", width: 38 },
      { header: "Inventory stock ID", key: "stockId", width: 38 },
    ], rows.map((row) => ({
      warehouseCode: row.warehouse.codigo,
      warehouseName: row.warehouse.nombre,
      articleCode: row.articulo.codigo,
      articleName: row.articulo.nombre,
      unit: row.unit,
      lotCode: row.lotCode,
      classification: row.classification,
      quantity: row.quantity,
      warehouseId: row.warehouse.id,
      articuloId: row.articulo.id,
      inventoryLotId: row.inventoryLotId,
      stockId: row.id,
    })));
    return this.finish("stock", `stock_actual_${currentUtcDate()}.xlsx`, workbook, filters, context);
  }

  async exportInventoryMovements(filters: InventoryMovementsReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile> {
    const rows = await this.inventory.queryReportMovements({
      ...reportDateRange(filters),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.articuloId ? { articuloId: filters.articuloId } : {}),
      ...(filters.movementType ? { movementType: filters.movementType } : {}),
    });
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Movimientos", [
      { header: "Fecha/hora (UTC)", key: "createdAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Tipo movimiento", key: "type" },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 32 },
      { header: "Unidad", key: "unit" },
      { header: "Cantidad", key: "quantity" },
      { header: "Almacén origen código", key: "sourceWarehouseCode" },
      { header: "Almacén origen", key: "sourceWarehouseName" },
      { header: "Almacén destino código", key: "destinationWarehouseCode" },
      { header: "Almacén destino", key: "destinationWarehouseName" },
      { header: "Lote", key: "lotCode" },
      { header: "Referencia/origen", key: "source" },
      { header: "Motivo/observaciones", key: "reason", width: 40 },
      { header: "Actor", key: "actor" },
      { header: "Actor ID", key: "actorId", width: 38 },
      { header: "Movement ID", key: "movementId", width: 38 },
      { header: "Artículo ID", key: "articuloId", width: 38 },
      { header: "Almacén origen ID", key: "warehouseId", width: 38 },
      { header: "Almacén destino ID", key: "destinationWarehouseId", width: 38 },
      { header: "Inventory lot ID", key: "inventoryLotId", width: 38 },
    ], rows.map((row) => ({
      createdAt: row.createdAt,
      type: row.type,
      articleCode: row.articulo.codigo,
      articleName: row.articulo.nombre,
      unit: row.unit,
      quantity: row.quantity,
      sourceWarehouseCode: row.warehouse.codigo,
      sourceWarehouseName: row.warehouse.nombre,
      destinationWarehouseCode: row.destinationWarehouse?.codigo ?? null,
      destinationWarehouseName: row.destinationWarehouse?.nombre ?? null,
      lotCode: row.lot?.lotCode ?? null,
      source: row.source,
      reason: row.reason,
      actor: row.actor?.displayName ?? null,
      actorId: row.actor?.id ?? null,
      movementId: row.id,
      articuloId: row.articulo.id,
      warehouseId: row.warehouse.id,
      destinationWarehouseId: row.destinationWarehouse?.id ?? null,
      inventoryLotId: row.lot?.id ?? null,
    })));
    return this.finish("inventory-movements", `movimientos_inventario_${datePart(filters.from)}_${datePart(filters.to)}.xlsx`, workbook, filters, context);
  }

  async exportPurchases(filters: PurchasesReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile> {
    const rows = await this.compras.queryForReport({
      ...reportDateRange(filters),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplier ? { supplier: filters.supplier } : {}),
      ...(filters.articuloId ? { articuloId: filters.articuloId } : {}),
    });
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Compras", [
      { header: "Fecha", key: "date", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Código/referencia compra", key: "reference" },
      { header: "Estado", key: "status" },
      { header: "Proveedor", key: "supplier", width: 30 },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 32 },
      { header: "Marca", key: "brand" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Precio referencial", key: "unitPrice" },
      { header: "Subtotal referencial", key: "subtotal" },
      { header: "Moneda", key: "currency" },
      { header: "Fecha recepción del ítem (UTC)", key: "receivedAt", width: 28, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Purchase ID", key: "compraId", width: 38 },
      { header: "Artículo ID", key: "articuloId", width: 38 },
    ], rows.map((row) => ({
      date: row.date,
      reference: row.documentNumber,
      status: row.status,
      supplier: row.supplierName,
      articleCode: row.articuloCodigo,
      articleName: row.articuloNombre,
      brand: row.brand,
      quantity: row.quantity,
      unit: row.unit,
      unitPrice: row.unitPrice,
      subtotal: row.unitPrice === null ? null : decimalProduct(row.quantity, row.unitPrice),
      currency: row.currency,
      receivedAt: row.itemReceivedAt,
      compraId: row.compraId,
      articuloId: row.articuloId,
    })));
    return this.finish("purchases", `compras_${datePart(filters.from)}_${datePart(filters.to)}.xlsx`, workbook, filters, context);
  }

  async exportProductionWorks(filters: ProductionWorksReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile> {
    const works = await this.production.queryWorksForReport({
      ...reportDateRange(filters),
      ...(filters.productionOrderId ? { productionOrderId: filters.productionOrderId } : {}),
      ...(filters.transformationOrderId ? { transformationOrderId: filters.transformationOrderId } : {}),
      ...(filters.workTypeId ? { workTypeId: filters.workTypeId } : {}),
      ...(filters.productionBatchId ? { productionBatchId: filters.productionBatchId } : {}),
      ...(filters.containerId ? { containerId: filters.containerId } : {}),
    });
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Trabajos", [
      { header: "Fecha/hora (UTC)", key: "performedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Orden producción", key: "productionOrder" },
      { header: "Orden transformación", key: "transformationOrder" },
      { header: "Tipo trabajo código", key: "workTypeCode" },
      { header: "Tipo trabajo", key: "workTypeName" },
      { header: "Observaciones", key: "observations", width: 40 },
      { header: "Actor", key: "actor" },
      { header: "Actor ID", key: "actorId", width: 38 },
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Production order ID", key: "productionOrderId", width: 38 },
      { header: "Transformation order ID", key: "transformationOrderId", width: 38 },
      { header: "Work type ID", key: "workTypeId", width: 38 },
    ], works.map((work) => ({
      performedAt: work.performedAt,
      productionOrder: work.productionOrder.code,
      transformationOrder: work.transformationOrder?.code ?? null,
      workTypeCode: work.workType.code,
      workTypeName: work.workType.name,
      observations: work.observations,
      actor: work.createdBy.displayName,
      actorId: work.createdBy.id,
      workId: work.id,
      productionOrderId: work.productionOrder.id,
      transformationOrderId: work.transformationOrder?.id ?? null,
      workTypeId: work.workType.id,
    })));
    addReportSheet(workbook, "Batches", [
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Batch", key: "batchCode" },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], works.flatMap((work) => work.batches.map((batch) => ({
      workId: work.id, batchCode: batch.code, batchId: batch.productionBatchId,
    }))));
    addReportSheet(workbook, "Recipientes", [
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Recipiente", key: "container" },
      { header: "Nombre", key: "name" },
      { header: "Container ID", key: "containerId", width: 38 },
    ], works.flatMap((work) => work.containers.map((container) => ({
      workId: work.id, container: container.code, name: container.name, containerId: container.productionContainerId,
    }))));
    addReportSheet(workbook, "Participantes", [
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Participante código", key: "participantCode" },
      { header: "Participante", key: "participantName" },
      { header: "Rol", key: "role" },
      { header: "Participant ID", key: "participantId", width: 38 },
    ], works.flatMap((work) => work.participants.map((participant) => ({
      workId: work.id, participantCode: participant.code, participantName: participant.name,
      role: participant.role, participantId: participant.productionParticipantId,
    }))));
    addReportSheet(workbook, "Insumos", [
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 32 },
      { header: "Lote inventario", key: "lotCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Almacén código", key: "warehouseCode" },
      { header: "Almacén", key: "warehouseName" },
      { header: "Almacén ID", key: "warehouseId", width: 38 },
      { header: "Estado", key: "status" },
      { header: "Fecha reversión (UTC)", key: "reversedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Motivo reversión", key: "reversalReason", width: 36 },
      { header: "Inventory movement ID", key: "movementId", width: 38 },
      { header: "Operation key", key: "operationKey", width: 36 },
      { header: "Reversal movement ID", key: "reversalMovementId", width: 38 },
      { header: "Reversal operation key", key: "reversalOperationKey", width: 36 },
      { header: "Work input ID", key: "inputId", width: 38 },
      { header: "Artículo ID", key: "articuloId", width: 38 },
      { header: "Inventory lot ID", key: "lotId", width: 38 },
    ], works.flatMap((work) => work.inputs.map((input) => ({
      workId: work.id, articleCode: input.articuloCodigo, articleName: input.articuloNombre,
      lotCode: input.lotCode, quantity: input.quantity, unit: input.unit, status: input.status,
      warehouseCode: input.warehouse?.codigo ?? null, warehouseName: input.warehouse?.nombre ?? null,
      warehouseId: input.warehouseId, reversedAt: input.reversedAt,
      reversalReason: input.reversalReason,
      movementId: input.inventoryMovementId, operationKey: input.operationKey, inputId: input.id,
      reversalMovementId: input.reversalInventoryMovementId, reversalOperationKey: input.reversalOperationKey,
      articuloId: input.articuloId, lotId: input.inventoryLotId,
    }))));
    return this.finish("production-works", `trabajos_produccion_${datePart(filters.from)}_${datePart(filters.to)}.xlsx`, workbook, filters, context);
  }

  async exportTransformations(filters: TransformationsReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile> {
    const transformations = await this.production.queryTransformationsForReport({
      ...reportDateRange(filters),
      ...(filters.productionOrderId ? { productionOrderId: filters.productionOrderId } : {}),
      ...(filters.transformationOrderId ? { transformationOrderId: filters.transformationOrderId } : {}),
      ...(filters.productionBatchId ? { productionBatchId: filters.productionBatchId } : {}),
    });
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Transformaciones", [
      { header: "Fecha/hora (UTC)", key: "performedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Orden producción", key: "productionOrder" },
      { header: "Orden transformación", key: "transformationOrder" },
      { header: "Trabajo relacionado", key: "work" },
      { header: "Tipo de trabajo", key: "workType" },
      { header: "Observaciones", key: "observations", width: 40 },
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Production order ID", key: "productionOrderId", width: 38 },
      { header: "Transformation order ID", key: "transformationOrderId", width: 38 },
      { header: "Production work ID", key: "workId", width: 38 },
      { header: "Actor ID", key: "actorUserId", width: 38 },
      { header: "Operation key", key: "operationKey", width: 36 },
    ], transformations.map((row) => ({
      performedAt: row.performedAt,
      productionOrder: row.productionOrder.code,
      transformationOrder: row.transformationOrder?.code ?? null,
      work: row.productionWork?.workType.code ?? null,
      workType: row.productionWork?.workType.name ?? null,
      observations: row.observations,
      transformationId: row.id,
      productionOrderId: row.productionOrder.id,
      transformationOrderId: row.transformationOrder?.id ?? null,
      workId: row.productionWork?.id ?? null,
      actorUserId: row.actorUserId,
      operationKey: row.operationKey,
    })));
    addReportSheet(workbook, "Entradas", [
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Batch origen", key: "batchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], transformations.flatMap((row) => row.inputs.map((entry) => ({
      transformationId: row.id, batchCode: entry.batchCode, quantity: entry.quantity, unit: entry.unit, batchId: entry.productionBatchId,
    }))));
    addReportSheet(workbook, "Salidas", [
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Batch generado/destino", key: "batchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], transformations.flatMap((row) => row.outputs.map((entry) => ({
      transformationId: row.id, batchCode: entry.batchCode, quantity: entry.quantity, unit: entry.unit, batchId: entry.productionBatchId,
    }))));
    addReportSheet(workbook, "Pérdidas", [
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Batch relacionado", key: "batchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Fecha/hora (UTC)", key: "occurredAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Motivo/observaciones", key: "observations", width: 40 },
      { header: "Production loss ID", key: "lossId", width: 38 },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], transformations.flatMap((row) => row.losses.map((loss) => ({
      transformationId: row.id, batchCode: loss.batchCode, quantity: loss.quantity, unit: loss.unit,
      occurredAt: loss.occurredAt, observations: loss.observations,
      lossId: loss.id, batchId: loss.productionBatchId,
    }))));
    return this.finish("transformations", `transformaciones_${datePart(filters.from)}_${datePart(filters.to)}.xlsx`, workbook, filters, context);
  }

  async exportTraceability(filters: TraceabilityReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile> {
    const trace = await this.production.getBatchTrace(filters.productionBatchId);
    const selectedBatch = trace.batches.find((batch) => batch.id === filters.productionBatchId);
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Resumen", [
      { header: "Batch", key: "batchCode" },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 32 },
      { header: "Orden producción", key: "orderCode" },
      { header: "Estado orden", key: "orderStatus" },
      { header: "Unidad", key: "unit" },
      { header: "Creado (UTC)", key: "createdAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Observaciones", key: "observations", width: 36 },
      { header: "Clasificación artículo", key: "classification" },
      { header: "Cantidad generada", key: "generated" },
      { header: "Cantidad consumida", key: "consumed" },
      { header: "Cantidad separada", key: "separated" },
      { header: "Cantidad perdida", key: "lost" },
      { header: "Transferido a Inventory", key: "transferredToInventory" },
      { header: "Cantidad disponible", key: "available" },
      { header: "Inicio orden (UTC)", key: "orderStartDate", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Cierre orden (UTC)", key: "orderClosedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Versión batch", key: "version" },
      { header: "Production batch ID", key: "batchId", width: 38 },
      { header: "Production order ID", key: "orderId", width: 38 },
    ], trace.batches.map((batch) => ({
      batchCode: batch.code,
      articleCode: batch.article?.codigo ?? null,
      articleName: batch.article?.nombre ?? null,
      orderCode: batch.order.code,
      orderStatus: batch.order.status,
      unit: batch.unit,
      createdAt: date(batch.createdAt),
      observations: batch.observations,
      classification: batch.article?.clasificacion ?? null,
      generated: batch.balance?.generated?.toString() ?? null,
      consumed: batch.balance?.consumed?.toString() ?? null,
      separated: batch.balance?.separated?.toString() ?? null,
      lost: batch.balance?.lost?.toString() ?? null,
      transferredToInventory: batch.balance?.transferredToInventory?.toString() ?? null,
      available: batch.balance?.available?.toString() ?? null,
      orderStartDate: date(batch.order.startDate),
      orderClosedAt: date(batch.order.closedAt),
      version: batch.version,
      batchId: batch.id,
      orderId: batch.productionOrderId,
    })));
    addReportSheet(workbook, "Genealogía", [
      { header: "Batch padre", key: "parentCode" },
      { header: "Batch hijo", key: "childCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Operation key", key: "operationKey", width: 36 },
      { header: "Fecha/hora (UTC)", key: "createdAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Lineage ID", key: "lineageId", width: 38 },
      { header: "Batch padre ID", key: "parentBatchId", width: 38 },
      { header: "Batch hijo ID", key: "childBatchId", width: 38 },
    ], trace.lineage.map((edge) => ({
      parentCode: trace.batches.find((batch) => batch.id === edge.parentBatchId)?.code ?? null,
      childCode: trace.batches.find((batch) => batch.id === edge.childBatchId)?.code ?? null,
      quantity: edge.quantity, unit: edge.unit, operationKey: edge.operationKey,
      createdAt: date(edge.createdAt), lineageId: edge.id,
      parentBatchId: edge.parentBatchId, childBatchId: edge.childBatchId,
    })));
    addReportSheet(workbook, "Libro de lotes", [
      { header: "Fecha/hora (UTC)", key: "occurredAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Batch", key: "batchCode" },
      { header: "Tipo de movimiento", key: "entryType" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Operation key", key: "operationKey", width: 36 },
      { header: "Metadatos", key: "metadata", width: 40 },
      { header: "Ledger ID", key: "ledgerId", width: 38 },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], trace.ledger.map((entry) => ({
      occurredAt: date(entry.occurredAt),
      batchCode: trace.batches.find((batch) => batch.id === entry.productionBatchId)?.code ?? null,
      entryType: entry.entryType, quantity: entry.quantity, unit: entry.unit,
      operationKey: entry.operationKey, metadata: entry.metadata === null ? null : JSON.stringify(entry.metadata),
      ledgerId: entry.id, batchId: entry.productionBatchId,
    })));
    addReportSheet(workbook, "Recepciones", [
      { header: "Reception ID", key: "receptionId", width: 38 },
      { header: "Fecha recepción (UTC)", key: "receivedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Estado", key: "status" },
      { header: "Productor ID", key: "producerId", width: 38 },
      { header: "Production order ID", key: "productionOrderId", width: 38 },
      { header: "Batch ID", key: "batchId", width: 38 },
      { header: "Variedad ID", key: "grapeVarietyId", width: 38 },
      { header: "Artículo ID", key: "articuloId", width: 38 },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Observaciones", key: "observations", width: 36 },
    ], trace.receptions.flatMap((reception) => reception.items.map((item) => ({
      receptionId: reception.id, receivedAt: date(reception.receivedAt), status: reception.status,
      producerId: reception.producerId, productionOrderId: reception.productionOrderId,
      batchId: item.productionBatchId, grapeVarietyId: item.grapeVarietyId, articuloId: item.articuloId,
      quantity: item.quantity, unit: item.unit, observations: reception.observations,
    }))));
    addReportSheet(workbook, "Correcciones", [
      { header: "Entidad", key: "entity" },
      { header: "Entidad ID", key: "entityId", width: 38 },
      { header: "Campo", key: "field" },
      { header: "Valor anterior", key: "previousValue", width: 36 },
      { header: "Valor nuevo", key: "newValue", width: 36 },
      { header: "Motivo", key: "reason", width: 36 },
      { header: "Corregido (UTC)", key: "correctedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Actor ID", key: "actorUserId", width: 38 },
      { header: "Versión anterior", key: "fromVersion" },
      { header: "Versión nueva", key: "toVersion" },
      { header: "Correction ID", key: "correctionId", width: 38 },
    ], [
      ...trace.receptions.flatMap((item) => item.corrections.map((correction) => ({
        entity: "Recepción", entityId: item.id, ...correction,
      }))),
      ...trace.works.flatMap((item) => item.corrections.map((correction) => ({
        entity: "Trabajo", entityId: item.id, ...correction,
      }))),
      ...trace.measurements.flatMap((item) => item.corrections.map((correction) => ({
        entity: "Medición", entityId: item.id, ...correction,
      }))),
    ].map((correction) => ({
      entity: correction.entity, entityId: correction.entityId, field: correction.field,
      previousValue: JSON.stringify(correction.previousValue), newValue: JSON.stringify(correction.newValue),
      reason: correction.reason, correctedAt: date(correction.correctedAt), actorUserId: correction.actorUserId,
      fromVersion: correction.fromVersion, toVersion: correction.toVersion, correctionId: correction.id,
    })));
    addReportSheet(workbook, "Trabajos", [
      { header: "Fecha/hora (UTC)", key: "performedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Tipo trabajo código", key: "workTypeCode" },
      { header: "Tipo trabajo", key: "workTypeName" },
      { header: "Observaciones", key: "observations", width: 36 },
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Production order ID", key: "productionOrderId", width: 38 },
      { header: "Transformation order ID", key: "transformationOrderId", width: 38 },
    ], trace.works.map((work) => ({
      performedAt: date(work.performedAt), workTypeCode: work.workType.code, workTypeName: work.workType.name,
      observations: work.observations, workId: work.id, productionOrderId: work.productionOrderId,
      transformationOrderId: work.transformationOrderId,
    })));
    addReportSheet(workbook, "Vínculos de trabajo", [
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Relación", key: "relationship" },
      { header: "Identificador", key: "referenceId", width: 38 },
      { header: "Código", key: "code" },
      { header: "Rol", key: "role" },
    ], trace.works.flatMap((work) => [
      ...work.batches.map((id) => ({ workId: work.id, relationship: "Batch", referenceId: id, code: trace.batches.find((batch) => batch.id === id)?.code ?? null, role: null })),
      ...work.containers.map((id) => ({ workId: work.id, relationship: "Recipiente", referenceId: id, code: trace.containers.find((container) => container.id === id)?.code ?? null, role: null })),
      ...work.participants.map((participant) => ({ workId: work.id, relationship: "Participante", referenceId: participant.participantId, code: null, role: participant.role })),
    ]));
    addReportSheet(workbook, "Insumos de trabajo", [
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 32 },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Lote inventario ID", key: "lotId", width: 38 },
      { header: "Almacén", key: "warehouse" },
      { header: "Inventory movement ID", key: "movementId", width: 38 },
      { header: "Estado", key: "status" },
      { header: "Motivo reversión", key: "reversalReason", width: 36 },
      { header: "Work input ID", key: "inputId", width: 38 },
      { header: "Reversal movement ID", key: "reversalMovementId", width: 38 },
      { header: "Reversal operation key", key: "reversalOperationKey", width: 36 },
    ], trace.works.flatMap((work) => work.inputs.map((input) => ({
      workId: work.id, articleCode: input.article?.codigo ?? null, articleName: input.article?.nombre ?? null,
      quantity: input.quantity, unit: input.unit, lotId: input.inventoryLotId,
      warehouse: input.warehouse?.codigo ?? null, movementId: input.inventoryMovementId,
      status: input.status, reversalReason: input.reversalReason, inputId: input.id,
      reversalMovementId: input.reversalInventoryMovementId, reversalOperationKey: input.reversalOperationKey,
    }))));
    addReportSheet(workbook, "Transformaciones", [
      { header: "Fecha/hora (UTC)", key: "performedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Observaciones", key: "observations", width: 36 },
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Production order ID", key: "productionOrderId", width: 38 },
      { header: "Transformation order ID", key: "transformationOrderId", width: 38 },
      { header: "Production work ID", key: "workId", width: 38 },
      { header: "Actor ID", key: "actorUserId", width: 38 },
      { header: "Operation key", key: "operationKey", width: 36 },
    ], trace.transformations.map((item) => ({
      performedAt: date(item.performedAt), observations: item.observations, transformationId: item.id,
      productionOrderId: item.productionOrderId, transformationOrderId: item.transformationOrderId,
      workId: item.productionWorkId, actorUserId: item.actorUserId, operationKey: item.operationKey,
    })));
    addReportSheet(workbook, "Entradas tr.", [
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Batch", key: "batchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], trace.transformations.flatMap((item) => item.inputs.map((entry) => ({
      transformationId: item.id, batchCode: trace.batches.find((batch) => batch.id === entry.productionBatchId)?.code ?? null,
      quantity: entry.quantity, unit: entry.unit, batchId: entry.productionBatchId,
    }))));
    addReportSheet(workbook, "Salidas tr.", [
      { header: "Transformation ID", key: "transformationId", width: 38 },
      { header: "Batch", key: "batchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Production batch ID", key: "batchId", width: 38 },
    ], trace.transformations.flatMap((item) => item.outputs.map((entry) => ({
      transformationId: item.id, batchCode: trace.batches.find((batch) => batch.id === entry.productionBatchId)?.code ?? null,
      quantity: entry.quantity, unit: entry.unit, batchId: entry.productionBatchId,
    }))));
    addReportSheet(workbook, "Mediciones", [
      { header: "Fecha/hora (UTC)", key: "measuredAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Tipo de medición ID", key: "measurementTypeId", width: 38 },
      { header: "Valor", key: "value" },
      { header: "Unidad", key: "unit" },
      { header: "Observaciones", key: "observations", width: 36 },
      { header: "Production batch ID", key: "batchId", width: 38 },
      { header: "Production container ID", key: "containerId", width: 38 },
      { header: "Production work ID", key: "workId", width: 38 },
      { header: "Participante ID", key: "participantId", width: 38 },
    ], trace.measurements.map((item) => ({
      measuredAt: date(item.measuredAt), measurementTypeId: item.measurementTypeId, value: item.value,
      unit: item.unit, observations: item.observations, batchId: item.productionBatchId,
      containerId: item.productionContainerId, workId: item.productionWorkId, participantId: item.participantId,
    })));
    addReportSheet(workbook, "Recipientes", [
      { header: "Código", key: "code" },
      { header: "Nombre", key: "name" },
      { header: "Tipo", key: "type" },
      { header: "Ubicación", key: "location" },
      { header: "Material", key: "material" },
      { header: "Capacidad", key: "capacity" },
      { header: "Unidad capacidad", key: "capacityUnit" },
      { header: "Estado", key: "status" },
      { header: "Container ID", key: "containerId", width: 38 },
    ], trace.containers.map((item) => ({
      code: item.code, name: item.name, type: item.type, location: item.location, material: item.material,
      capacity: item.capacity, capacityUnit: item.capacityUnit, status: item.status, containerId: item.id,
    })));
    addReportSheet(workbook, "Ocupaciones", [
      { header: "Recipiente", key: "containerCode" },
      { header: "Batch", key: "batchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Desde (UTC)", key: "openedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Hasta (UTC)", key: "closedAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Occupancy ID", key: "occupancyId", width: 38 },
    ], trace.containers.flatMap((container) => container.occupancies.map((occupancy) => ({
      containerCode: container.code, batchCode: trace.batches.find((batch) => batch.id === occupancy.batchId)?.code ?? null,
      quantity: occupancy.quantity, unit: occupancy.unit, openedAt: date(occupancy.openedAt),
      closedAt: date(occupancy.closedAt), occupancyId: occupancy.id,
    }))));
    const containerMovements = [...new Map(
      trace.containers.flatMap((container) => container.movements.map((movement) => [movement.id, movement] as const)),
    ).values()];
    addReportSheet(workbook, "Mov. recipiente", [
      { header: "Movimiento", key: "movementType" },
      { header: "Recipiente origen ID", key: "sourceContainerId", width: 38 },
      { header: "Recipiente destino", key: "destinationContainerCode" },
      { header: "Recipiente destino ID", key: "destinationContainerId", width: 38 },
      { header: "Batch origen", key: "sourceBatchCode" },
      { header: "Batch destino", key: "destinationBatchCode" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Fecha/hora (UTC)", key: "occurredAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Work ID", key: "workId", width: 38 },
      { header: "Actor ID", key: "actorUserId", width: 38 },
      { header: "Observaciones", key: "observations", width: 36 },
      { header: "Container movement ID", key: "movementId", width: 38 },
    ], containerMovements.map((movement) => ({
      movementType: movement.movementType, sourceContainerId: movement.sourceContainerId,
      destinationContainerCode: trace.containers.find((item) => item.id === movement.destinationContainerId)?.code ?? null,
      destinationContainerId: movement.destinationContainerId,
      sourceBatchCode: trace.batches.find((batch) => batch.id === movement.sourceBatchId)?.code ?? null,
      destinationBatchCode: movement.destinationBatchId
        ? trace.batches.find((batch) => batch.id === movement.destinationBatchId)?.code ?? null : null,
      quantity: movement.quantity, unit: movement.unit, occurredAt: date(movement.occurredAt),
      workId: movement.productionWorkId, actorUserId: movement.actorUserId,
      observations: movement.observations, movementId: movement.id,
    })));
    addReportSheet(workbook, "Pérdidas", [
      { header: "Fecha/hora (UTC)", key: "occurredAt", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Batch", key: "batchCode" },
      { header: "Batch ID", key: "batchId", width: 38 },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Observaciones", key: "observations", width: 36 },
      { header: "Production loss ID", key: "lossId", width: 38 },
    ], trace.losses.map((loss) => ({
      occurredAt: date(loss.occurredAt),
      batchCode: loss.productionBatchId
        ? trace.batches.find((batch) => batch.id === loss.productionBatchId)?.code ?? null : null,
      batchId: loss.productionBatchId, quantity: loss.quantity, unit: loss.unit,
      observations: loss.observations, lossId: loss.id,
    })));
    addReportSheet(workbook, "Inventario relacionado", [
      { header: "Registro", key: "recordType" },
      { header: "Fecha/hora (UTC)", key: "date", width: 23, numFmt: "yyyy-mm-dd hh:mm:ss" },
      { header: "Código", key: "code" },
      { header: "Tipo/clasificación", key: "type" },
      { header: "Artículo código", key: "articleCode" },
      { header: "Artículo", key: "articleName", width: 30 },
      { header: "Almacén código", key: "warehouseCode" },
      { header: "Almacén", key: "warehouseName" },
      { header: "Cantidad", key: "quantity" },
      { header: "Unidad", key: "unit" },
      { header: "Motivo/referencia", key: "detail", width: 36 },
      { header: "Stock anterior", key: "stockBefore" },
      { header: "Stock resultante", key: "resultingStock" },
      { header: "Registro ID", key: "recordId", width: 38 },
      { header: "Production batch ID", key: "batchId", width: 38 },
      { header: "Inventory lot ID", key: "lotId", width: 38 },
      { header: "Actor ID", key: "actorUserId", width: 38 },
      { header: "Inventory movement ID", key: "movementId", width: 38 },
      { header: "Warehouse destino", key: "destinationWarehouseCode" },
    ], [
      ...trace.inventory.lots.map((lot) => ({
        recordType: "Lote de inventario", date: date(lot.fechaIngreso), code: lot.lotCode,
        type: lot.classification, articleCode: lot.article?.codigo, articleName: lot.article?.nombre,
        quantity: null, unit: null, detail: lot.observations, stockBefore: null, resultingStock: null,
        recordId: lot.id, batchId: lot.originProductionBatchId, lotId: lot.id,
        actorUserId: null, movementId: null, destinationWarehouseCode: null,
      })),
      ...trace.inventory.movements.map((movement) => ({
        recordType: "Movimiento", date: date(movement.createdAt), code: null, type: movement.type,
        articleCode: movement.article?.codigo, articleName: movement.article?.nombre,
        warehouseCode: movement.warehouse?.codigo, warehouseName: movement.warehouse?.nombre,
        quantity: movement.quantity, unit: movement.unit, detail: movement.reason ?? movement.source,
        stockBefore: movement.stockBefore, resultingStock: movement.resultingStock,
        recordId: movement.id, batchId: null, lotId: movement.inventoryLotId,
        actorUserId: movement.actorUserId, movementId: movement.id,
        destinationWarehouseCode: movement.destinationWarehouse?.codigo ?? null,
      })),
      ...trace.releases.map((release) => ({
        recordType: "Liberación a Inventory", date: date(release.occurredAt), code: null,
        type: release.status, articleCode: null, articleName: null,
        warehouseCode: trace.inventory.movements.find((movement) => movement.warehouseId === release.warehouseId)?.warehouse?.codigo,
        warehouseName: trace.inventory.movements.find((movement) => movement.warehouseId === release.warehouseId)?.warehouse?.nombre,
        quantity: release.quantity, unit: release.unit,
        detail: release.reversal?.reason ?? release.operationKey,
        stockBefore: null, resultingStock: null, actorUserId: release.actorUserId,
        recordId: release.releaseId, movementId: release.inventoryMovementId,
        destinationWarehouseCode: null, batchId: release.productionBatchId, lotId: release.inventoryLotId,
      })),
      ...trace.inventory.stocks.map((stock) => ({
        recordType: "Existencia materializada", date: null, code: null, type: null,
        articleCode: stock.article?.codigo, articleName: stock.article?.nombre,
        warehouseCode: stock.warehouse?.codigo, warehouseName: stock.warehouse?.nombre,
        quantity: stock.quantity, unit: stock.unit, detail: null,
        stockBefore: null, resultingStock: null, recordId: stock.id, actorUserId: null,
        movementId: null, destinationWarehouseCode: null,
        batchId: null, lotId: stock.inventoryLotId,
      })),
    ]);
    addReportSheet(workbook, "Advertencias", [
      { header: "Advertencia", key: "warning", width: 80 },
    ], trace.warnings.map((warning) => ({ warning })));
    const filename = `trazabilidad_${safePart(selectedBatch?.code ?? filters.productionBatchId)}.xlsx`;
    return this.finish("traceability", filename, workbook, filters, context);
  }

  private async finish(
    reportType: string,
    filename: string,
    workbook: ReturnType<typeof createReportWorkbook>,
    filters: Record<string, string | undefined>,
    context: AuthenticatedAuditContext,
  ): Promise<ReportFile> {
    const content = await workbookBuffer(workbook);
    const auditFilters = Object.fromEntries(
      Object.entries(filters).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    await this.audit.record(context, {
      action: "REPORT_EXPORTED",
      resourceType: `reports.${reportType}`,
      metadata: { reportType, filters: auditFilters },
    });
    return { filename, content };
  }
}