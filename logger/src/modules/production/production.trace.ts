import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";

export interface ProductionBatchTraceDto {
  rootBatchId: string;
  batches: Array<{ id: string; code: string; productionOrderId: string; articuloId: string; unit: string; createdAt: string; observations: string | null; version: number; article: { id: string; codigo: string; nombre: string; clasificacion: string; unidadMedida: string } | null; order: { id: string; code: string; status: string; startDate: string; observations: string | null; closedAt: string | null }; balance: Record<string, string | number> | null }>;
  lineage: Array<{ id: string; parentBatchId: string; childBatchId: string; quantity: string | null; unit: string | null; operationKey: string; createdAt: string }>;
  ledger: Array<{ id: string; productionBatchId: string; entryType: string; quantity: string; unit: string; occurredAt: string; operationKey: string; metadata: JsonValue | null }>;
  receptions: Array<{ id: string; productionOrderId: string; producerId: string | null; receivedAt: string; status: string; observations: string | null; version: number; items: Array<{ id: string; productionBatchId: string; grapeVarietyId: string; articuloId: string; quantity: string; unit: string }>; corrections: CorrectionDto[] }>;
  works: Array<{ id: string; productionOrderId: string; transformationOrderId: string | null; workTypeId: string; performedAt: string; observations: string | null; version: number; workType: { id: string; code: string; name: string }; batches: string[]; containers: string[]; participants: Array<{ participantId: string; role: string | null }>; inputs: Array<{ articuloId: string; quantity: string; unit: string }>; corrections: CorrectionDto[] }>;
  measurements: Array<{ id: string; measurementTypeId: string; value: string; unit: string; measuredAt: string; observations: string | null; productionBatchId: string | null; productionContainerId: string | null; productionWorkId: string | null; participantId: string | null; corrections: CorrectionDto[] }>;
  transformations: Array<{ id: string; performedAt: string; observations: string | null; inputs: Array<{ productionBatchId: string; quantity: string; unit: string }>; outputs: Array<{ productionBatchId: string; quantity: string; unit: string }>; losses: Array<{ id: string; productionBatchId: string | null; quantity: string; unit: string; occurredAt: string }> }>;
  losses: Array<{ id: string; productionBatchId: string | null; quantity: string; unit: string; occurredAt: string; observations: string | null }>;
  containers: Array<{ id: string; code: string; capacity: string; capacityUnit: string; status: string; observations: string | null; occupancies: Array<{ id: string; batchId: string; quantity: string; unit: string; openedAt: string; closedAt: string | null }>; movements: Array<{ id: string; movementType: string; sourceBatchId: string; destinationBatchId: string | null; quantity: string; unit: string; occurredAt: string }> }>;
  inventory: { lots: Array<{ id: string; lotCode: string; articuloId: string; classification: string; fechaIngreso: string; observations: string | null; originProductionBatchId: string | null }>; movements: Array<{ id: string; type: string; source: string; articuloId: string; warehouseId: string; inventoryLotId: string | null; quantity: string; unit: string; stockBefore: string; resultingStock: string; createdAt: string }>; stocks: Array<{ id: string; warehouseId: string; articuloId: string; inventoryLotId: string | null; quantity: string; unit: string }> };
  warnings: string[];
}
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue; }
export interface CorrectionDto { id: string; field: string; previousValue: JsonValue; newValue: JsonValue; reason: string; correctedAt: string; actorUserId: string; fromVersion: number; toVersion: number; }
const iso = (value: Date) => value.toISOString();
const decimal = (value: Prisma.Decimal) => value.toString();
const localJson = (value: Prisma.JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(item => localJson(item));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localJson(item ?? null)]));
};
const traceMetadata = (value: Prisma.JsonValue | null): JsonValue | null => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(item => traceMetadata(item)) as JsonValue[];
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "requestHash").map(([key, item]) => [key, traceMetadata(item ?? null)]));
};
const correction = (row: { id: string; field: string; previousValue: Prisma.JsonValue; newValue: Prisma.JsonValue; reason: string; correctedAt: Date; actorUserId: string; fromVersion: number; toVersion: number }): CorrectionDto => ({ id: row.id, field: row.field, previousValue: localJson(row.previousValue), newValue: localJson(row.newValue), reason: row.reason, correctedAt: iso(row.correctedAt), actorUserId: row.actorUserId, fromVersion: row.fromVersion, toVersion: row.toVersion });

export class ProductionTraceService {
  constructor(private readonly prisma: PrismaClient) {}
  async get(id: string): Promise<ProductionBatchTraceDto> {
    const root = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!root) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    const depths = new Map<string, number>([[id, 0]]); const queue = [id]; const edgeMap = new Map<string, { id: string; parentBatchId: string; childBatchId: string; quantity: Prisma.Decimal | null; unit: string | null; operationKey: string; createdAt: Date }>();
    while (queue.length) {
      const layer = queue.splice(0); const layerDepth = Math.max(...layer.map(batchId => depths.get(batchId) ?? 0));
      const edges = await this.prisma.productionBatchLineage.findMany({ where: { OR: [{ parentBatchId: { in: layer } }, { childBatchId: { in: layer } }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      for (const edge of edges) {
        edgeMap.set(edge.id, edge);
        for (const next of [edge.parentBatchId, edge.childBatchId]) if (!depths.has(next)) { const depth = layerDepth + 1; if (depth > 100) throw new AppError("TRACE_LIMIT_EXCEEDED", "Trace exceeds the maximum depth", 422); depths.set(next, depth); queue.push(next); }
        if (depths.size > 1000) throw new AppError("TRACE_LIMIT_EXCEEDED", "Trace exceeds the maximum number of batches", 422);
      }
    }
    const ids = [...depths.keys()];
    const batches = await this.prisma.productionBatch.findMany({ where: { id: { in: ids } }, include: { productionOrder: true, balance: true } });
    const articles = await this.prisma.articulo.findMany({ where: { id: { in: [...new Set(batches.map(batch => batch.articuloId))] } } });
    const articlesById = new Map(articles.map(article => [article.id, article]));
    const ledgers = await this.prisma.productionBatchLedgerEntry.findMany({ where: { productionBatchId: { in: ids } }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
    const receptions = await this.prisma.grapeReception.findMany({ where: { items: { some: { productionBatchId: { in: ids } } } }, include: { items: true, corrections: { orderBy: { toVersion: "asc" } } } });
    const transformations = await this.prisma.transformation.findMany({ where: { OR: [{ inputs: { some: { productionBatchId: { in: ids } } } }, { outputs: { some: { productionBatchId: { in: ids } } } }] }, include: { inputs: true, outputs: true, losses: true }, orderBy: [{ performedAt: "asc" }, { id: "asc" }] });
    const workLinks = await this.prisma.productionWorkBatch.findMany({ where: { productionBatchId: { in: ids } }, select: { productionWorkId: true } });
    const workIds = [...new Set(workLinks.map(row => row.productionWorkId).concat(transformations.flatMap(row => [row.productionWorkId, ...row.losses.map(loss => loss.productionWorkId)]).filter((value): value is string => value !== null)))];
    const works = await this.prisma.productionWork.findMany({ where: { id: { in: workIds } }, include: { workType: true, batches: true, containers: true, participants: true, inputs: true, corrections: { orderBy: { toVersion: "asc" } } } });
    const occupancyContainerIds = (await this.prisma.productionContainerOccupancy.findMany({ where: { batchId: { in: ids } }, select: { containerId: true } })).map(row => row.containerId);
    const workContainerIds = (await this.prisma.productionWorkContainer.findMany({ where: { productionWorkId: { in: workIds } }, select: { productionContainerId: true } })).map(row => row.productionContainerId);
    const containerIds = [...new Set(occupancyContainerIds.concat(workContainerIds))];
    const containers = await this.prisma.productionContainer.findMany({ where: { id: { in: containerIds } }, include: { occupancies: true, movementsFrom: true, movementsTo: true } });
    const measurements = await this.prisma.productionMeasurement.findMany({ where: { OR: [{ productionBatchId: { in: ids } }, { productionWorkId: { in: workIds } }, { productionContainerId: { in: containerIds } }] }, include: { corrections: { orderBy: { toVersion: "asc" } } }, orderBy: [{ measuredAt: "asc" }, { id: "asc" }] });
    const losses = await this.prisma.productionLoss.findMany({ where: { OR: [{ productionBatchId: { in: ids } }, { productionWorkId: { in: workIds } }, { transformationId: { in: transformations.map(row => row.id) } }] }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
    const lots = await this.prisma.inventoryLot.findMany({ where: { originProductionBatchId: { in: ids } }, orderBy: { id: "asc" } });
    const lotIds = lots.map(lot => lot.id); const movementRows = await this.prisma.inventoryMovement.findMany({ where: { OR: [{ inventoryLotId: { in: lotIds } }, { source: "PRODUCTION_OUTPUT", inventoryLotId: { in: lotIds } }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const stocks = await this.prisma.inventoryStock.findMany({ where: { inventoryLotId: { in: lotIds } }, orderBy: { id: "asc" } });
    const knownLotIds = new Set(lotIds);
    const warnings = batches.filter(batch => !articlesById.has(batch.articuloId)).map(batch => `Batch ${batch.id} references missing Articulo ${batch.articuloId}`).concat(ledgers.flatMap(entry => {
      if (entry.entryType !== "TRANSFERRED_TO_INVENTORY") return [];
      if (!entry.metadata || typeof entry.metadata !== "object" || !("inventoryLotId" in entry.metadata) || typeof entry.metadata.inventoryLotId !== "string") return [`Ledger ${entry.id} has malformed inventory linkage`];
      return knownLotIds.has(entry.metadata.inventoryLotId) ? [] : [`Ledger ${entry.id} references missing InventoryLot ${entry.metadata.inventoryLotId}`];
    }));
    return {
      rootBatchId: id,
      batches: batches.sort((a, b) => a.id.localeCompare(b.id)).map(batch => { const balance = batch.balance; const article = articlesById.get(batch.articuloId); return { id: batch.id, code: batch.code, productionOrderId: batch.productionOrderId, articuloId: batch.articuloId, unit: batch.unit, createdAt: iso(batch.createdAt), observations: batch.observations, version: batch.version, article: article ? { id: article.id, codigo: article.codigo, nombre: article.nombre, clasificacion: article.clasificacion, unidadMedida: article.unidadMedida } : null, order: { id: batch.productionOrder.id, code: batch.productionOrder.code, status: batch.productionOrder.status, startDate: iso(batch.productionOrder.startDate), observations: batch.productionOrder.observations, closedAt: batch.productionOrder.closedAt ? iso(batch.productionOrder.closedAt) : null }, balance: balance ? Object.fromEntries(["generated","consumed","separated","lost","transferredToInventory","available"].map(key => [key, decimal(balance[key as keyof typeof balance] as Prisma.Decimal)])) : null }; }),
      lineage: [...edgeMap.values()].sort((a, b) => a.id.localeCompare(b.id)).map(edge => ({ id: edge.id, parentBatchId: edge.parentBatchId, childBatchId: edge.childBatchId, quantity: edge.quantity ? decimal(edge.quantity) : null, unit: edge.unit, operationKey: edge.operationKey, createdAt: iso(edge.createdAt) })),
      ledger: ledgers.map(entry => ({ id: entry.id, productionBatchId: entry.productionBatchId, entryType: entry.entryType, quantity: decimal(entry.quantity), unit: entry.unit, occurredAt: iso(entry.occurredAt), operationKey: entry.operationKey, metadata: traceMetadata(entry.metadata) })),
      receptions: receptions.map(row => ({ id: row.id, productionOrderId: row.productionOrderId, producerId: row.producerId, receivedAt: iso(row.receivedAt), status: row.status, observations: row.observations, version: row.version, items: row.items.map(item => ({ id: item.id, productionBatchId: item.productionBatchId, grapeVarietyId: item.grapeVarietyId, articuloId: item.articuloId, quantity: decimal(item.quantity), unit: item.unit })), corrections: row.corrections.map(correction) })),
      works: works.map(work => ({ id: work.id, productionOrderId: work.productionOrderId, transformationOrderId: work.transformationOrderId, workTypeId: work.workTypeId, performedAt: iso(work.performedAt), observations: work.observations, version: work.version, workType: { id: work.workType.id, code: work.workType.code, name: work.workType.name }, batches: work.batches.map(row => row.productionBatchId).sort(), containers: work.containers.map(row => row.productionContainerId).sort(), participants: work.participants.map(row => ({ participantId: row.productionParticipantId, role: row.role })), inputs: work.inputs.map(row => ({ articuloId: row.articuloId, quantity: decimal(row.quantity), unit: row.unit })), corrections: work.corrections.map(correction) })),
      measurements: measurements.map(row => ({ id: row.id, measurementTypeId: row.measurementTypeId, value: decimal(row.value), unit: row.unit, measuredAt: iso(row.measuredAt), observations: row.observations, productionBatchId: row.productionBatchId, productionContainerId: row.productionContainerId, productionWorkId: row.productionWorkId, participantId: row.participantId, corrections: row.corrections.map(correction) })),
      transformations: transformations.map(row => ({ id: row.id, performedAt: iso(row.performedAt), observations: row.observations, inputs: row.inputs.map(input => ({ productionBatchId: input.productionBatchId, quantity: decimal(input.quantity), unit: input.unit })), outputs: row.outputs.map(output => ({ productionBatchId: output.productionBatchId, quantity: decimal(output.quantity), unit: output.unit })), losses: row.losses.map(loss => ({ id: loss.id, productionBatchId: loss.productionBatchId, quantity: decimal(loss.quantity), unit: loss.unit, occurredAt: iso(loss.occurredAt) })) })),
      losses: losses.map(loss => ({ id: loss.id, productionBatchId: loss.productionBatchId, quantity: decimal(loss.quantity), unit: loss.unit, occurredAt: iso(loss.occurredAt), observations: loss.observations })),
      containers: containers.map(container => ({ id: container.id, code: container.code, capacity: decimal(container.capacity), capacityUnit: container.capacityUnit, status: container.status, observations: container.observations, occupancies: container.occupancies.map(row => ({ id: row.id, batchId: row.batchId, quantity: decimal(row.quantity), unit: row.unit, openedAt: iso(row.openedAt), closedAt: row.closedAt ? iso(row.closedAt) : null })), movements: [...container.movementsFrom, ...container.movementsTo].sort((a, b) => a.id.localeCompare(b.id)).map(row => ({ id: row.id, movementType: row.movementType, sourceBatchId: row.sourceBatchId, destinationBatchId: row.destinationBatchId, quantity: decimal(row.quantity), unit: row.unit, occurredAt: iso(row.occurredAt) })) })),
      inventory: { lots: lots.map(lot => ({ id: lot.id, lotCode: lot.lotCode, articuloId: lot.articuloId, classification: lot.classification, fechaIngreso: iso(lot.fechaIngreso), observations: lot.observations, originProductionBatchId: lot.originProductionBatchId })), movements: movementRows.map(row => ({ id: row.id, type: row.type, source: row.source, articuloId: row.articuloId, warehouseId: row.warehouseId, inventoryLotId: row.inventoryLotId, quantity: decimal(row.quantity), unit: row.unit, stockBefore: decimal(row.stockBefore), resultingStock: decimal(row.resultingStock), createdAt: iso(row.createdAt) })), stocks: stocks.map(row => ({ id: row.id, warehouseId: row.warehouseId, articuloId: row.articuloId, inventoryLotId: row.inventoryLotId, quantity: decimal(row.quantity), unit: row.unit })) },
      warnings,
    };
  }
}