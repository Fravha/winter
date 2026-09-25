import type { ProductionBatchTraceDto } from "./production.trace.js";

export interface ProductionOptionFilters {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

export interface ProductionOptionPage<T> {
  items: readonly T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ProductionReportFilters {
  productionOrderId?: string;
  transformationOrderId?: string;
  from?: Date;
  toExclusive?: Date;
  workTypeId?: string;
  productionBatchId?: string;
  containerId?: string;
}

export interface ProductionReportWork {
  id: string;
  performedAt: Date;
  observations: string | null;
  productionOrder: { id: string; code: string };
  transformationOrder: { id: string; code: string } | null;
  workType: { id: string; code: string; name: string };
  createdBy: { id: string; displayName: string | null };
  batches: readonly { productionBatchId: string; code: string }[];
  containers: readonly { productionContainerId: string; code: string; name: string | null }[];
  participants: readonly { productionParticipantId: string; code: string; name: string; role: string | null }[];
  inputs: readonly {
    id: string;
    articuloId: string;
    articuloCodigo: string;
    articuloNombre: string;
    warehouseId: string | null;
    warehouse: { id: string; codigo: string; nombre: string } | null;
    inventoryLotId: string | null;
    lotCode: string | null;
    quantity: string;
    unit: string;
    inventoryMovementId: string | null;
    operationKey: string | null;
    status: "ACTIVE" | "REVERSED";
    reversedAt: Date | null;
    reversalInventoryMovementId: string | null;
    reversalOperationKey: string | null;
    reversalReason: string | null;
  }[];
}

export interface ProductionReportTransformation {
  id: string;
  performedAt: Date;
  observations: string | null;
  productionOrder: { id: string; code: string };
  transformationOrder: { id: string; code: string } | null;
  productionWork: { id: string; workType: { code: string; name: string } } | null;
  actorUserId: string;
  operationKey: string;
  inputs: readonly { productionBatchId: string; batchCode: string; quantity: string; unit: string }[];
  outputs: readonly { productionBatchId: string; batchCode: string; quantity: string; unit: string }[];
  losses: readonly { id: string; productionBatchId: string | null; batchCode: string | null; quantity: string; unit: string; observations: string | null; occurredAt: Date }[];
}

export interface ProductionApi {
  queryReportOrderOptions(type: "production" | "transformation", filters: ProductionOptionFilters): Promise<ProductionOptionPage<{ id: string; code: string; status: string }>>;
  queryReportBatchOptions(filters: ProductionOptionFilters): Promise<ProductionOptionPage<{ id: string; code: string; productionOrderId: string; articuloId: string }>>;
  queryReportWorkTypeOptions(filters: ProductionOptionFilters): Promise<ProductionOptionPage<{ id: string; code: string; name: string }>>;
  queryReportContainerOptions(filters: ProductionOptionFilters): Promise<ProductionOptionPage<{ id: string; code: string; name: string | null; status: string }>>;
  queryWorksForReport(filters: ProductionReportFilters): Promise<readonly ProductionReportWork[]>;
  queryTransformationsForReport(filters: Pick<ProductionReportFilters, "productionOrderId" | "transformationOrderId" | "from" | "toExclusive" | "productionBatchId">): Promise<readonly ProductionReportTransformation[]>;
  getBatchTrace(id: string): Promise<ProductionBatchTraceDto>;
}