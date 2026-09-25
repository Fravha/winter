import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import type { AuditService } from "../src/core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../src/core/audit/audit.types.js";
import type { ArticulosApi } from "../src/modules/articulos/articulos.api.js";
import type { CompraApi } from "../src/modules/compras/compra.api.js";
import type { InventoryApi } from "../src/modules/inventory/inventory.api.js";
import type { ProductionApi } from "../src/modules/production/production.api.js";
import type { ProductionBatchTraceDto } from "../src/modules/production/production.trace.js";
import { AppError } from "../src/shared/errors/app-error.js";
import { MAX_REPORT_ROWS } from "../src/shared/reports/report-limits.js";
import { ReportsService } from "../src/modules/reports/reports.service.js";
import { addReportSheet, createReportWorkbook, workbookBuffer } from "../src/modules/reports/reports.workbook.js";

const ids = {
  warehouse: "00000000-0000-4000-8000-000000000001",
  article: "00000000-0000-4000-8000-000000000002",
  lot: "00000000-0000-4000-8000-000000000003",
  order: "00000000-0000-4000-8000-000000000004",
  transformOrder: "00000000-0000-4000-8000-000000000005",
  work: "00000000-0000-4000-8000-000000000006",
  batch: "00000000-0000-4000-8000-000000000007",
  batch2: "00000000-0000-4000-8000-000000000008",
  container: "00000000-0000-4000-8000-000000000009",
  participant: "00000000-0000-4000-8000-000000000010",
  movement: "00000000-0000-4000-8000-000000000011",
  transformation: "00000000-0000-4000-8000-000000000012",
  loss: "00000000-0000-4000-8000-000000000013",
};
const date = new Date("2025-04-05T12:30:00.000Z");
const context: AuthenticatedAuditContext = { actorUserId: "test-user", requestId: "reports-test" };

function makeTrace(): ProductionBatchTraceDto {
  const containerMovement = {
    id: "container-movement-id", movementType: "TRANSFERRED",
    sourceContainerId: ids.container, destinationContainerId: "destination-container",
    sourceBatchId: ids.batch, destinationBatchId: ids.batch2, quantity: "0.250", unit: "L",
    occurredAt: date.toISOString(), productionWorkId: ids.work, observations: null,
    actorUserId: "actor-id", createdAt: date.toISOString(),
  };
  return {
    rootBatchId: ids.batch,
    batches: [{
      id: ids.batch, code: "BATCH-7", productionOrderId: ids.order, articuloId: ids.article,
      unit: "L", createdAt: date.toISOString(), observations: null, version: 1,
      article: { id: ids.article, codigo: "VIN-01", nombre: "Vino base", clasificacion: "PRODUCTO_PROCESO", unidadMedida: "L" },
      order: { id: ids.order, code: "OP-1", status: "OPEN", startDate: date.toISOString(), observations: null, closedAt: null },
      balance: { generated: "10.125", consumed: "1.000", separated: "0", lost: "0", transferredToInventory: "0", available: "9.125" },
    }],
    lineage: [],
    ledger: [],
    releases: [],
    receptions: [],
    works: [],
    measurements: [],
    transformations: [],
    losses: [],
    containers: [{
      id: ids.container, code: "T-1", name: "Origen", type: "TANQUE", location: null,
      material: null, capacity: "100", capacityUnit: "L", status: "DISPONIBLE",
      observations: null, occupancies: [], movements: [containerMovement],
    }, {
      id: "destination-container", code: "T-2", name: "Destino", type: "TANQUE", location: null,
      material: null, capacity: "100", capacityUnit: "L", status: "DISPONIBLE",
      observations: null, occupancies: [], movements: [containerMovement],
    }],
    inventory: { lots: [], movements: [], stocks: [] },
    warnings: [],
  };
}

function makeService() {
  const calls: Array<{ method: string; filters: unknown }> = [];
  const auditCalls: unknown[] = [];
  const inventory = {
    async queryReportStock(filters: unknown) {
      calls.push({ method: "stock", filters });
      return [{
        id: "stock-id", warehouse: { id: ids.warehouse, codigo: "ALM-1", nombre: "Bodega" },
        articulo: { id: ids.article, codigo: "VIN-01", nombre: "Vino base", unidadMedida: "L" },
        inventoryLotId: ids.lot, lotCode: "LOT-1", classification: "PRODUCTO_TERMINADO", quantity: "1.375", unit: "L",
      }];
    },
    async queryReportMovements(filters: unknown) {
      calls.push({ method: "movements", filters });
      return [{
        id: ids.movement, type: "TRANSFER", source: "MANUAL", reason: null,
        quantity: "2.125", unit: "L", createdAt: date,
        articulo: { id: ids.article, codigo: "VIN-01", nombre: "Vino base" },
        warehouse: { id: ids.warehouse, codigo: "ALM-1", nombre: "Bodega" },
        destinationWarehouse: { id: "destination", codigo: "ALM-2", nombre: "Depósito" },
        lot: { id: ids.lot, lotCode: "LOT-1" }, actor: { id: "actor-id", displayName: "Operador" },
      }];
    },
  } as unknown as InventoryApi;
  const compras = {
    async queryForReport(filters: unknown) {
      calls.push({ method: "purchases", filters });
      return [
        { compraId: "purchase-id", documentNumber: "FAC-2", date, itemReceivedAt: date, status: "RECEIVED", supplierName: "Proveedor", articuloId: ids.article, articuloCodigo: "VIN-01", articuloNombre: "Vino base", brand: "Marca", quantity: "0.125", unit: "L", unitPrice: "2.500", currency: "BOB" },
        { compraId: "purchase-id", documentNumber: "FAC-2", date, itemReceivedAt: null, status: "RECEIVED", supplierName: "Proveedor", articuloId: "article-2", articuloCodigo: "INS-1", articuloNombre: "Insumo", brand: null, quantity: "2.000", unit: "KG", unitPrice: null, currency: "BOB" },
      ];
    },
  } as unknown as CompraApi;
  const production = {
    async queryWorksForReport(filters: unknown) {
      calls.push({ method: "works", filters });
      return [{
        id: ids.work, performedAt: date, observations: "Trabajo",
        productionOrder: { id: ids.order, code: "OP-1" },
        transformationOrder: { id: ids.transformOrder, code: "TOP-1" },
        workType: { id: "work-type", code: "FERM", name: "Fermentación" },
        createdBy: { id: "actor", displayName: "Operador" },
        batches: [{ productionBatchId: ids.batch, code: "BATCH-7" }, { productionBatchId: ids.batch2, code: "BATCH-8" }],
        containers: [{ productionContainerId: ids.container, code: "T-1", name: "Tanque" }],
        participants: [{ productionParticipantId: ids.participant, code: "P-1", name: "Participante", role: "Enólogo" }],
        inputs: [{
          id: "input-id", articuloId: ids.article, articuloCodigo: "INS-1", articuloNombre: "Insumo",
          inventoryLotId: ids.lot, lotCode: "LOT-1", quantity: "0.125", unit: "KG",
          inventoryMovementId: ids.movement, operationKey: "operation-1", status: "ACTIVE",
        }],
      }];
    },
    async queryTransformationsForReport(filters: unknown) {
      calls.push({ method: "transformations", filters });
      return [{
        id: ids.transformation, performedAt: date, observations: "Corte",
        actorUserId: "actor-id", operationKey: "transformation-key",
        productionOrder: { id: ids.order, code: "OP-1" },
        transformationOrder: { id: ids.transformOrder, code: "TOP-1" },
        productionWork: { id: ids.work, workType: { code: "CORTE", name: "Corte" } },
        inputs: [{ productionBatchId: ids.batch, batchCode: "BATCH-7", quantity: "1.125", unit: "L" }],
        outputs: [{ productionBatchId: ids.batch2, batchCode: "BATCH-8", quantity: "1.000", unit: "L" }],
        losses: [{ id: ids.loss, productionBatchId: ids.batch, batchCode: "BATCH-7", quantity: "0.125", unit: "L", observations: "Merma", occurredAt: date }],
      }];
    },
    async getBatchTrace() { calls.push({ method: "trace", filters: ids.batch }); return makeTrace(); },
  } as unknown as ProductionApi;
  const audit = {
    async record(...args: unknown[]) { auditCalls.push(args); },
  } as unknown as AuditService;
  return {
    service: new ReportsService(inventory, compras, production, audit),
    inventory, compras, production, audit, calls, auditCalls,
  };
}

async function load(file: { content: Buffer; filename: string }) {
  assert.match(file.filename, /\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.content);
  return workbook;
}

describe("Reports Excel exports", () => {
  it("delegates selector lookups to their owner APIs and asks for active article options", async () => {
    const articleFilters: unknown[] = [];
    const articles = {
      async listArticulos(filters: unknown) {
        articleFilters.push(filters);
        return {
          items: [{
            id: ids.article, codigo: "VIN-01", nombre: "Vino base", clasificacion: "PRODUCTO_PROCESO",
            unidadMedida: "L", activo: true,
          }],
          pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
        };
      },
    } as unknown as ArticulosApi;
    const inventory = {
      async queryReportWarehouseOptions(filters: unknown) {
        return { items: [{ id: ids.warehouse, codigo: "ALM-1", nombre: "Bodega" }], pagination: filters };
      },
    } as unknown as InventoryApi;
    const production = {
      async queryReportOrderOptions(type: string, filters: unknown) {
        return { items: [{ id: ids.order, code: type === "production" ? "OP-1" : "TOP-1", status: "OPEN" }], pagination: filters };
      },
      async queryReportBatchOptions(filters: unknown) { return { items: [], pagination: filters }; },
      async queryReportWorkTypeOptions(filters: unknown) { return { items: [], pagination: filters }; },
      async queryReportContainerOptions(filters: unknown) { return { items: [], pagination: filters }; },
    } as unknown as ProductionApi;
    const service = new ReportsService(inventory, {} as CompraApi, production, {} as AuditService, articles);
    const filters = { page: 2, pageSize: 10, search: "vino" };
    const articlePage = await service.listArticleOptions(filters);
    assert.equal(articlePage.items[0]?.clasificacion, "PRODUCTO_PROCESO");
    assert.deepEqual(articleFilters, [{ ...filters, activo: true }]);
    const warehousePage = await service.listWarehouseOptions(filters);
    assert.equal(warehousePage.items[0]?.codigo, "ALM-1");
    assert.equal((await service.listProductionOrderOptions(filters)).items[0]?.code, "OP-1");
    assert.equal((await service.listTransformationOrderOptions(filters)).items[0]?.code, "TOP-1");
    await service.listBatchOptions(filters);
    await service.listWorkTypeOptions(filters);
    await service.listContainerOptions(filters);
  });

  it("exports stock as a valid workbook with human columns and exact quantities", async () => {
    const { service, calls } = makeService();
    const workbook = await load(await service.exportStock({ warehouseId: ids.warehouse }, context));
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Stock actual"]);
    const sheet = workbook.getWorksheet("Stock actual")!;
    assert.equal(sheet.getRow(1).getCell(1).value, "Almacén código");
    assert.equal(sheet.getRow(2).getCell(8).value, 1.375);
    assert.equal(sheet.getRow(2).getCell(1).value, "ALM-1");
    assert.equal((calls[0]?.filters as { warehouseId: string }).warehouseId, ids.warehouse);
  });

  it("exports inventory movements with both warehouse relations and inclusive UTC date filters", async () => {
    const { service, calls } = makeService();
    const workbook = await load(await service.exportInventoryMovements({
      from: "2025-04-05", to: "2025-04-05", movementType: "TRANSFER", warehouseId: ids.warehouse,
    }, context));
    const sheet = workbook.getWorksheet("Movimientos")!;
    assert.equal(sheet.getRow(2).getCell(1).value instanceof Date, true);
    assert.equal(sheet.getRow(2).getCell(8).value, "Bodega");
    assert.equal(sheet.getRow(2).getCell(10).value, "Depósito");
    assert.equal(sheet.getRow(2).getCell(6).value, 2.125);
    const filters = calls[0]?.filters as { from: Date; toExclusive: Date; movementType: string };
    assert.equal(filters.from.toISOString(), "2025-04-05T00:00:00.000Z");
    assert.equal(filters.toExclusive.toISOString(), "2025-04-06T00:00:00.000Z");
    assert.equal(filters.movementType, "TRANSFER");
  });

  it("exports purchases one row per item and multiplies decimals without floating point", async () => {
    const { service } = makeService();
    const workbook = await load(await service.exportPurchases({ supplier: "Proveedor" }, context));
    const sheet = workbook.getWorksheet("Compras")!;
    assert.equal(sheet.rowCount, 3);
    assert.equal(sheet.getRow(2).getCell(11).value, 0.3125);
    assert.equal(sheet.getRow(2).getCell(10).value, 2.5);
    assert.equal(sheet.getRow(3).getCell(10).value, null);
    assert.equal(sheet.getRow(2).getCell(5).value, "VIN-01");
    assert.equal(sheet.getRow(1).getCell(13).value, "Fecha recepción del ítem (UTC)");
    assert.equal(sheet.getRow(2).getCell(13).value instanceof Date, true);
    assert.equal(sheet.getRow(3).getCell(13).value, null);
  });

  it("rejects oversized workbooks without silently truncating rows", () => {
    const workbook = createReportWorkbook();
    assert.throws(
      () => addReportSheet(
        workbook,
        "Too many",
        [{ header: "ID", key: "id" }],
        Array.from({ length: MAX_REPORT_ROWS + 1 }, () => ({ id: "x" })),
      ),
      (error: unknown) => error instanceof AppError
        && error.code === "REPORT_RESULT_TOO_LARGE"
        && error.statusCode === 413
        && error.message.includes("no rows were truncated"),
    );
    assert.equal(workbook.worksheets.length, 0);
  });

  it("exports safe decimals as numbers and preserves oversized decimals as exact text", async () => {
    const workbook = createReportWorkbook();
    addReportSheet(workbook, "Decimal precision", [
      { header: "Quantity", key: "quantity" },
      { header: "Price", key: "unitPrice" },
      { header: "Subtotal", key: "subtotal" },
      { header: "Code", key: "code" },
    ], [
      { quantity: "123456789012.345", unitPrice: "0.125", subtotal: "0.3125", code: "000123" },
      { quantity: "123456789012345.678", unitPrice: "999999999999999.999", subtotal: "123456789012345678.901234", code: "000456" },
    ]);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbookBuffer(workbook));
    const sheet = loaded.getWorksheet("Decimal precision")!;
    assert.equal(sheet.getRow(2).getCell(1).value, 123456789012.345);
    assert.equal(sheet.getRow(2).getCell(2).value, 0.125);
    assert.equal(sheet.getRow(2).getCell(3).value, 0.3125);
    assert.equal(sheet.getRow(2).getCell(4).value, "000123");
    assert.equal(sheet.getRow(3).getCell(1).value, "123456789012345.678");
    assert.equal(sheet.getRow(3).getCell(2).value, "999999999999999.999");
    assert.equal(sheet.getRow(3).getCell(3).value, "123456789012345678.901234");
    assert.equal(sheet.getRow(2).getCell(1).numFmt, "#,##0.000");
    assert.equal(sheet.getRow(2).getCell(3).numFmt, "#,##0.000000");
  });

  it("preserves N:N work relationships in dedicated sheets", async () => {
    const { service, calls } = makeService();
    const workbook = await load(await service.exportProductionWorks({
      productionOrderId: ids.order, transformationOrderId: ids.transformOrder,
      productionBatchId: ids.batch, containerId: ids.container, from: "2025-04-05",
    }, context));
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Trabajos", "Batches", "Recipientes", "Participantes", "Insumos"]);
    assert.equal(workbook.getWorksheet("Batches")!.rowCount, 3);
    assert.equal(workbook.getWorksheet("Insumos")!.getRow(2).getCell(5).value, 0.125);
    assert.equal((calls[0]?.filters as { containerId: string }).containerId, ids.container);
  });

  it("exports transformation inputs, outputs, losses and leaves empty relations as header-only sheets", async () => {
    const { service } = makeService();
    const workbook = await load(await service.exportTransformations({ productionBatchId: ids.batch }, context));
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Transformaciones", "Entradas", "Salidas", "Pérdidas"]);
    assert.equal(workbook.getWorksheet("Entradas")!.getRow(2).getCell(3).value, 1.125);
    assert.equal(workbook.getWorksheet("Salidas")!.getRow(2).getCell(2).value, "BATCH-8");
    assert.equal(workbook.getWorksheet("Pérdidas")!.getRow(2).getCell(4).value, "L");
  });

  it("reuses Production's batch trace API and creates an Excel workbook", async () => {
    const { service, calls } = makeService();
    const workbook = await load(await service.exportTraceability({ productionBatchId: ids.batch }, context));
    assert.match(workbook.worksheets[0]!.name, /Resumen/);
    assert.equal(workbook.getWorksheet("Resumen")!.getRow(2).getCell(1).value, "BATCH-7");
    assert.ok(workbook.getWorksheet("Genealogía"));
    assert.ok(workbook.getWorksheet("Libro de lotes"));
    assert.ok(workbook.getWorksheet("Correcciones"));
    assert.ok(workbook.getWorksheet("Mov. recipiente"));
    assert.equal(workbook.getWorksheet("Mov. recipiente")!.rowCount, 2);
    assert.equal(workbook.getWorksheet("Mov. recipiente")!.getRow(2).getCell(3).value, "T-2");
    assert.ok(workbook.getWorksheet("Pérdidas"));
    assert.equal(calls.some((call) => call.method === "trace"), true);
  });

  it("emits REPORT_EXPORTED audit events without storing workbook content", async () => {
    const { service, auditCalls } = makeService();
    const file = await service.exportStock({}, context);
    assert.ok(file.content.byteLength > 1000);
    assert.equal(auditCalls.length, 1);
    const event = auditCalls[0]![1] as { action: string; metadata: Record<string, unknown> };
    assert.equal(event.action, "REPORT_EXPORTED");
    assert.equal(event.metadata.reportType, "stock");
    assert.equal("content" in event.metadata, false);
  });

  it("supports valid header-only reports when no data is returned", async () => {
    const { service } = makeService();
    const dependencies = makeService();
    const inventory = {
      async queryReportStock() { return []; },
      async queryReportMovements() { return []; },
    } as unknown as InventoryApi;
    const emptyService = new ReportsService(
      inventory,
      dependencies.compras,
      dependencies.production,
      dependencies.audit,
    );
    const workbook = await load(await emptyService.exportStock({}, context));
    assert.equal(workbook.getWorksheet("Stock actual")!.rowCount, 1);
    assert.equal(workbook.getWorksheet("Stock actual")!.getRow(1).getCell(1).value, "Almacén código");
  });
});