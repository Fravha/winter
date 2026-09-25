import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { AuditService } from "../src/core/audit/audit.service.js";
import type { ArticulosApi } from "../src/modules/articulos/articulos.api.js";
import { CompraService } from "../src/modules/compras/compra.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { ProductionService } from "../src/modules/production/production.service.js";

const id = "00000000-0000-4000-8000-000000000001";
const id2 = "00000000-0000-4000-8000-000000000002";
const calls: Array<{ source: string; args: any }> = [];
const createdAt = new Date("2025-05-01T10:00:00.000Z");

const prisma = {
  inventoryStock: {
    async findMany(args: unknown) {
      calls.push({ source: "stock", args });
      return [{
        id: "stock-id", quantity: { toString: () => "1.250" }, unit: "L",
        warehouse: { id, codigo: "W-1", nombre: "Bodega" },
        articulo: { id: id2, codigo: "A-1", nombre: "Vino", unidadMedida: "L" },
        lot: { id: "lot-id", lotCode: "LOT-1", classification: "PRODUCTO_TERMINADO" },
      }];
    },
  },
  inventoryMovement: {
    async findMany(args: unknown) {
      calls.push({ source: "movement", args });
      return [{
        id: "movement-id", type: "TRANSFER", source: "MANUAL", reason: null,
        quantity: { toString: () => "0.125" }, unit: "L", createdAt,
        articulo: { id: id2, codigo: "A-1", nombre: "Vino" },
        warehouse: { id, codigo: "W-1", nombre: "Bodega" },
        destinationWarehouse: null, lot: null, actor: null,
      }];
    },
  },
  compra: {
    async findMany(args: unknown) {
      calls.push({ source: "purchase", args });
      return [{
        id: "purchase-id", documentNumber: "F-1", documentDate: createdAt,
        createdAt, status: "RECEIVED", supplierName: "Supplier", currency: "BOB",
        items: [{
          articuloId: id2, brand: null, requestedQuantity: { toString: () => "2.125" },
          unit: "KG", unitPrice: { toString: () => "3.125" },
          movementRefs: [
            { inventoryMovement: { createdAt } },
            { inventoryMovement: { createdAt: new Date("2025-05-03T10:00:00Z") } },
          ],
          articulo: { codigo: "A-1", nombre: "Vino" },
        }, {
          articuloId: "article-2", brand: null, requestedQuantity: { toString: () => "1.000" },
          unit: "L", unitPrice: null,
          movementRefs: [{ inventoryMovement: { createdAt: new Date("2025-05-02T10:00:00Z") } }],
          articulo: { codigo: "A-2", nombre: "Otro" },
        }],
      }];
    },
  },
  productionWork: {
    async findMany(args: unknown) {
      calls.push({ source: "work", args });
      return [{
        id: "work-id", performedAt: createdAt, observations: null,
        productionOrder: { id, code: "OP-1" }, transformationOrder: { id: id2, code: "TOP-1" },
        workType: { id: "type-id", code: "FERM", name: "Fermentación" },
        createdBy: { id: "user-id", displayName: "Operador" },
        batches: [{ productionBatchId: "batch-id", productionBatch: { code: "B-1" } }],
        containers: [{ productionContainerId: "container-id", productionContainer: { code: "T-1", name: "Tanque" } }],
        participants: [{ productionParticipantId: "participant-id", role: "Enólogo", productionParticipant: { code: "P-1", name: "Persona" } }],
        inputs: [{
          id: "input-id", articuloId: id2, quantity: { toString: () => "0.125" }, unit: "KG",
          inventoryLotId: "lot-id", inventoryMovementId: "movement-id", operationKey: "op", reversedAt: null,
          articulo: { codigo: "A-1", nombre: "Insumo" }, inventoryLot: { lotCode: "LOT-1" },
        }],
      }];
    },
  },
  transformation: {
    async findMany(args: unknown) {
      calls.push({ source: "transformation", args });
      return [{
        id: "transformation-id", performedAt: createdAt, observations: null,
        productionOrder: { id, code: "OP-1" }, transformationOrder: null,
        productionWork: null,
        inputs: [{ productionBatchId: "batch-id", quantity: { toString: () => "1.250" }, unit: "L", productionBatch: { code: "B-1" } }],
        outputs: [{ productionBatchId: "batch-2", quantity: { toString: () => "1.125" }, unit: "L", productionBatch: { code: "B-2" } }],
        losses: [{ id: "loss-id", productionBatchId: null, quantity: { toString: () => "0.125" }, unit: "L", observations: "Merma", productionBatch: null }],
      }];
    },
  },
} as unknown as PrismaClient;

describe("Reports owner-module public read queries", () => {
  it("queries materialized stock and movement relations within Inventory", async () => {
    calls.length = 0;
    const inventory = new InventoryService(prisma);
    const stock = await inventory.queryReportStock({ warehouseId: id, classification: "PRODUCTO_TERMINADO" });
    assert.equal(stock[0]?.quantity, "1.250");
    assert.equal(stock[0]?.warehouse.codigo, "W-1");
    const from = new Date("2025-05-01T00:00:00.000Z");
    const toExclusive = new Date("2025-05-02T00:00:00.000Z");
    const movements = await inventory.queryReportMovements({
      articuloId: id2, from, toExclusive, movementType: "TRANSFER", warehouseId: id,
    });
    assert.equal(movements[0]?.quantity, "0.125");
    const stockWhere = calls[0]?.args.where;
    assert.equal(stockWhere.warehouseId, id);
    assert.equal(stockWhere.lot.is.classification, "PRODUCTO_TERMINADO");
    const movementWhere = calls[1]?.args.where;
    assert.equal(movementWhere.createdAt.gte, from);
    assert.equal(movementWhere.createdAt.lt, toExclusive);
    assert.equal(movementWhere.type, "TRANSFER");
    assert.deepEqual(movementWhere.OR, [{ warehouseId: id }, { destinationWarehouseId: id }]);
    assert.equal(calls[0]?.args.take, 25_001);
    assert.equal(calls[1]?.args.take, 25_001);
  });

  it("returns item-specific latest receipt dates instead of repeating the purchase-wide latest date", async () => {
    calls.length = 0;
    const service = new CompraService(prisma, {} as ArticulosApi, {} as never);
    const result = await service.queryForReport({ supplier: "Supplier" });
    assert.equal(result.length, 2);
    assert.equal(result[0]?.quantity, "2.125");
    assert.equal(result[0]?.unitPrice, "3.125");
    assert.equal(result[0]?.itemReceivedAt?.toISOString(), "2025-05-03T10:00:00.000Z");
    assert.equal(result[1]?.itemReceivedAt?.toISOString(), "2025-05-02T10:00:00.000Z");
    const where = calls[0]?.args.where;
    assert.equal(where.supplierName.contains, "Supplier");
    assert.equal(calls[0]?.args.take, 1_001);
    assert.equal(calls[0]?.args.select.items.take, 26);
    assert.equal(calls[0]?.args.select.items.select.movementRefs.take, 26);
  });

  it("returns complete N:N work and transformation relations with supplied filters", async () => {
    calls.length = 0;
    const production = new ProductionService(prisma, {} as AuditService);
    const works = await production.queryWorksForReport({
      productionOrderId: id, transformationOrderId: id2, workTypeId: "type-id",
      from: createdAt, productionBatchId: "batch-id", containerId: "container-id",
    });
    assert.equal(works[0]?.batches.length, 1);
    assert.equal(works[0]?.participants[0]?.name, "Persona");
    assert.equal(works[0]?.inputs[0]?.quantity, "0.125");
    const workWhere = calls[0]?.args.where;
    assert.deepEqual(workWhere.batches.some, { productionBatchId: "batch-id" });
    assert.deepEqual(workWhere.containers.some, { productionContainerId: "container-id" });
    assert.equal(workWhere.transformationOrderId, id2);
    assert.equal(calls[0]?.args.take, 1_001);
    assert.equal(calls[0]?.args.select.inputs.take, 26);
    assert.equal(calls[0]?.args.select.inputs.select.inventoryLot.select.lotCode, true);

    const transformations = await production.queryTransformationsForReport({
      productionOrderId: id, productionBatchId: "batch-id", toExclusive: createdAt,
    });
    assert.equal(transformations[0]?.inputs[0]?.quantity, "1.250");
    assert.equal(transformations[0]?.outputs[0]?.batchCode, "B-2");
    assert.equal(transformations[0]?.losses[0]?.observations, "Merma");
    const transformationWhere = calls[1]?.args.where;
    assert.equal(transformationWhere.productionOrderId, id);
    assert.equal(transformationWhere.OR.length, 3);
    assert.equal(transformationWhere.performedAt.lt, createdAt);
  });
});