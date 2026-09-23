export const PRODUCTION_STATUSES = ['OPEN', 'CLOSED'] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];
export const CUSTOM_FIELD_ENTITY_TYPES = ['PRODUCER', 'GRAPE_VARIETY', 'GRAPE_RECEPTION'] as const;
export type CustomFieldEntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];
export const CUSTOM_FIELD_DATA_TYPES = ['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'SELECT'] as const;
export type CustomFieldDataType = (typeof CUSTOM_FIELD_DATA_TYPES)[number];

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type Envelope<T> = { data: T };
export type ListEnvelope<T> = { data: T[]; meta: PageMeta };
export type Catalog = { id: string; code: string; name: string; active: boolean; createdAt: string; updatedAt: string };
export type Participant = Catalog & { userId: string | null };
export type CatalogFilters = { page?: number; pageSize?: number; search?: string; active?: boolean };
export type ProductionOrderFilters = { page?: number; pageSize?: number; status?: ProductionStatus };
export type TransformationOrderFilters = ProductionOrderFilters;
export type CatalogCreateInput = { code: string; name: string };
export type ParticipantCreateInput = CatalogCreateInput & { userId?: string };
export type CatalogUpdateInput = { name: string };
export type ParticipantUpdateInput = CatalogUpdateInput;
export type CatalogKind = 'participants' | 'producers' | 'grapeVarieties' | 'workTypes' | 'measurementTypes';

export type CustomFieldDefinition = {
  id: string; entityType: CustomFieldEntityType; code: string; label: string;
  dataType: CustomFieldDataType; required: boolean; active: boolean;
  options: string[] | null; displayOrder: number; createdAt: string; updatedAt: string;
};
export type CustomFieldDefinitionCreateInput = {
  entityType: CustomFieldEntityType; code: string; label: string; dataType: CustomFieldDataType;
  required?: boolean; active?: boolean; options?: string[]; displayOrder?: number;
};
export type CustomFieldDefinitionUpdateInput = {
  label?: string; required?: boolean; options?: string[]; displayOrder?: number;
};
export type CustomFieldValue = {
  id: string; definitionId: string; entityType: CustomFieldEntityType; entityId: string;
  textValue: string | null; integerValue: number | null; decimalValue: string | null;
  booleanValue: boolean | null; dateValue: string | null; selectValue: string | null;
};
export type CustomFieldValueInput = {
  definitionId: string; entityType: CustomFieldEntityType; entityId: string;
  value: string | number | boolean;
};

export type ProductionOrder = {
  id: string; code: string; status: ProductionStatus; startDate: string;
  observations: string | null; closedAt: string | null; closedByUserId: string | null;
  createdAt: string; updatedAt: string; version: number;
};
export type TransformationOrder = {
  id: string; code: string; productionOrderId: string; status: ProductionStatus;
  periodStart: string; periodEnd: string | null; observations: string | null;
  closedAt: string | null; closedByUserId: string | null; createdAt: string; updatedAt: string; version: number;
};
export type ProductionOrderDetail = ProductionOrder & { transformationOrders: TransformationOrder[] };
export type TransformationOrderDetail = TransformationOrder & { productionOrder: ProductionOrder };
export type ProductionOrderCreateInput = { code: string; startDate: string; observations?: string };
export type TransformationOrderCreateInput = {
  code: string; productionOrderId: string; periodStart: string; periodEnd?: string; observations?: string;
};

export const RECEPTION_STATUSES = ['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS'] as const;
export type ReceptionStatus = (typeof RECEPTION_STATUSES)[number];
export const RECEPTION_UNITS = ['KG', 'G', 'L', 'M', 'UNIDAD'] as const;
export type ReceptionUnit = (typeof RECEPTION_UNITS)[number];
export type ReceptionListFilters = { page?: number; pageSize?: number };
export type BatchListFilters = { page?: number; pageSize?: number; articuloId?: string; productionOrderId?: string };
export type ReceptionCustomField = { definitionId: string; entityType: 'GRAPE_RECEPTION'; value: string | number | boolean };
export type ReceptionItem = {
  id?: string; grapeVarietyId: string; articuloId: string; quantity: string;
  unit: ReceptionUnit; productionBatchId?: string;
};
export type ReceptionCorrection = {
  id: string; field: 'receivedAt' | 'producerId' | 'observations' | 'status';
  previousValue: string | null; newValue: string | null; reason: string;
  correctedAt: string; actorUserId: string; fromVersion: number; toVersion: number;
};
export type GrapeReceptionBase = {
  id: string; productionOrderId: string; producerId: string | null; receivedAt: string;
  status: ReceptionStatus; observations: string | null; actorUserId: string;
  createdAt: string; updatedAt: string; version: number;
};
export type GrapeReceptionListItem = GrapeReceptionBase & {
  items: ReceptionItem[];
};
export type GrapeReceptionDetail = GrapeReceptionBase & {
  items: ReceptionItem[]; corrections: ReceptionCorrection[]; customFields: ReceptionCustomField[];
};
export type GrapeReceptionCreateInput = {
  productionOrderId: string; producerId?: string; observations?: string; customFields?: Array<Omit<ReceptionCustomField, 'entityType'>>;
  receivedAt: string; status: ReceptionStatus; items: Array<Omit<ReceptionItem, 'id' | 'productionBatchId'>>;
  operationKey: string; requestHash: string;
};
export type ReceptionResult = { reception: GrapeReceptionBase; items: ReceptionItem[]; batchIds: string[] };
export type ReceptionCorrectionInput =
  | { field: 'receivedAt'; newValue: string; reason: string; operationKey: string }
  | { field: 'producerId'; newValue: string; reason: string; operationKey: string }
  | { field: 'observations'; newValue: string | null; reason: string; operationKey: string }
  | { field: 'status'; newValue: ReceptionStatus; reason: string; operationKey: string };
export type ReceptionCorrectionResult = { id: string; field: ReceptionCorrectionInput['field']; value: string | null; version: number; correctionId: string };
export type ProductionBatchBalance = {
  productionBatchId: string; generated: string; consumed: string; separated: string;
  lost: string; transferredToInventory: string; available: string; ledgerVersion: number; updatedAt: string;
};
export type ProductionBatch = {
  id: string; code: string; productionOrderId: string; articuloId: string; unit: ReceptionUnit;
  createdAt: string; observations: string | null; version: number; balance: ProductionBatchBalance;
};
export type ProductionBatchBalanceResult = { productionBatchId: string; unit: ReceptionUnit; available: string };

export type TransformationInput = { productionBatchId: string; quantity: string; unit: string; };
export type TransformationOutput = { productionBatchId: string; articuloId: string; quantity: string; unit: string; code: string; };
export type TransformationLoss = { id: string; productionBatchId: string | null; quantity: string; unit: string; operationKey: string; };

export type Transformation = {
  id: string;
  productionOrderId: string;
  transformationOrderId: string | null;
  productionWorkId: string | null;
  performedAt: string;
  actorUserId: string;
  observations: string | null;
  operationKey: string;
  requestHash: string;
  inputs: TransformationInput[];
  outputs: TransformationOutput[];
  losses: TransformationLoss[];
};

export type TransformationListFilters = { page?: number; pageSize?: number; productionOrderId?: string; };

export type TransformationCreateInputItem = { productionBatchId: string; quantity: string; };
export type TransformationCreateOutputItem = { articuloId: string; quantity: string; unit: string; observations?: string; };
export type TransformationCreateLossItem = { productionBatchId?: string; quantity: string; unit: string; observations?: string; };

export type TransformationCreateInput = {
  productionOrderId: string;
  transformationOrderId?: string;
  productionWorkId?: string;
  performedAt: string;
  observations?: string;
  operationKey: string;
  requestHash: string;
  inputs: TransformationCreateInputItem[];
  outputs: TransformationCreateOutputItem[];
  losses?: TransformationCreateLossItem[];
};

export const CONTAINER_STATUSES = ['DISPONIBLE', 'OCUPADO', 'FUERA_DE_SERVICIO'] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];
export type ContainerType = 'TANQUE' | 'BARRICA' | 'OTRO';

export type Occupancy = {
  id: string; containerId: string; batchId: string; quantity: string; unit: string; openedAt: string; closedAt: string | null;
};

export type ProcessMovement = {
  id: string; movementType: 'ASSIGNED' | 'TRANSFERRED' | 'PARTIAL_TRANSFERRED';
  sourceContainerId: string | null; destinationContainerId: string;
  sourceBatchId: string; destinationBatchId: string | null;
  quantity: string; unit: string; occurredAt: string;
  productionWorkId: string | null; observations: string | null;
  actorUserId: string; createdAt: string;
};

export type ProductionContainer = {
  id: string; code: string; name: string | null; type: ContainerType | null;
  location: string | null; material: string | null;
  capacity: string; capacityUnit: string; status: ContainerStatus;
  observations: string | null; createdAt: string; updatedAt: string; version: number;
  currentOccupancy?: {
    batchId: string; batchCode: string; quantity: string; unit: string; openedAt: string;
  } | null;
};

export type ProductionContainerDetail = ProductionContainer & {
  occupancies: Occupancy[];
  movements?: ProcessMovement[];
};

export type ContainerCreateInput = {
  code: string; name?: string; type: ContainerType;
  location?: string; material?: string;
  capacity: string; capacityUnit: string;
  observations?: string;
};

export type ContainerUpdateInput = {
  name?: string; type?: ContainerType;
  location?: string; material?: string;
  capacity?: string;
  observations?: string;
};

export type ContainerAssignInput = {
  batchId: string; quantity: string;
  occurredAt?: string; productionWorkId?: string; observations?: string;
  operationKey: string; requestHash: string;
};

export type ContainerTransferTotalInput = {
  destinationContainerId: string; batchId: string;
  occurredAt?: string; productionWorkId?: string; observations?: string;
  operationKey: string; requestHash: string;
};

export type ContainerTransferPartialInput = {
  destinationContainerId: string; batchId: string; quantity: string; childCode: string;
  occurredAt?: string; productionWorkId?: string; observations?: string;
  operationKey: string; requestHash: string;
};

export type WorkParticipant = { participantId: string; role?: string };
export type WorkCorrection = {
  id: string; field: 'performedAt' | 'workTypeId' | 'transformationOrderId' | 'observations';
  previousValue: string | null; newValue: string | null; reason: string;
  correctedAt: string; actorUserId: string; fromVersion: number; toVersion: number;
};
export type WorkInput = {
  id: string; productionWorkId: string; articuloId: string; warehouseId: string | null;
  inventoryLotId: string | null; inventoryMovementId: string | null; quantity: string; unit: string;
  observations: string | null; operationKey: string | null; requestHash: string | null; createdByUserId: string | null; createdAt: string;
  reversedAt: string | null; reversalInventoryMovementId: string | null; reversedByUserId: string | null;
  reversalReason: string | null; reversalOperationKey: string | null; reversalRequestHash: string | null; status: 'ACTIVE' | 'REVERSED';
};
export type ProductionWork = {
  id: string; productionOrderId: string; transformationOrderId: string | null; workTypeId: string;
  performedAt: string; observations: string | null; createdByUserId: string; createdAt: string;
  updatedAt: string; version: number; batchIds: string[]; containerIds: string[];
  participants: WorkParticipant[]; corrections: WorkCorrection[]; inputs: WorkInput[];
};
export type WorkListFilters = { page?: number; pageSize?: number; productionOrderId?: string; workTypeId?: string };
export type ProductionWorkCreateInput = {
  productionOrderId: string; transformationOrderId?: string; workTypeId: string; performedAt: string;
  observations?: string; batchIds?: string[]; containerIds?: string[]; participants?: WorkParticipant[];
};
export type WorkCorrectionInput =
  | { field: 'performedAt'; newValue: string; reason: string }
  | { field: 'workTypeId'; newValue: string; reason: string }
  | { field: 'transformationOrderId'; newValue: string | null; reason: string }
  | { field: 'observations'; newValue: string | null; reason: string };
export type WorkInputCreateInput = {
  articuloId: string; warehouseId: string; inventoryLotId?: string; quantity: string; unit: string;
  observations?: string; authorizeNegativeStock?: boolean; negativeStockReason?: string;
  operationKey: string; requestHash: string;
};
export type WorkInputReverseInput = {
  reason: string; operationKey: string; requestHash: string;
};

export type ProductionMeasurement = {
  id: string; measurementTypeId: string; productionBatchId: string | null;
  productionContainerId: string | null; productionWorkId: string | null; participantId: string | null;
  value: string; unit: string; measuredAt: string; observations: string | null;
  createdAt: string; updatedAt: string; version: number;
};
export type MeasurementListFilters = {
  page?: number; pageSize?: number; measurementTypeId?: string; productionBatchId?: string;
  productionContainerId?: string; productionWorkId?: string; measuredAtFrom?: string; measuredAtTo?: string;
};
export type ProductionMeasurementCreateInput = {
  measurementTypeId: string; productionBatchId?: string; productionContainerId?: string;
  productionWorkId?: string; participantId?: string; value: string; unit: string;
  measuredAt: string; observations?: string;
};
export type MeasurementCorrectionInput =
  | { field: 'value'; newValue: string; reason: string; operationKey: string }
  | { field: 'unit'; newValue: string; reason: string; operationKey: string }
  | { field: 'measuredAt'; newValue: string; reason: string; operationKey: string }
  | { field: 'participantId'; newValue: string | null; reason: string; operationKey: string }
  | { field: 'observations'; newValue: string | null; reason: string; operationKey: string };
export type MeasurementCorrectionResult = {
  id: string; field: MeasurementCorrectionInput['field']; value: string | null;
  version: number; correctionId: string;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue; }

export interface CorrectionDto {
  id: string; field: string; previousValue: JsonValue; newValue: JsonValue;
  reason: string; correctedAt: string; actorUserId: string;
  fromVersion: number; toVersion: number;
}

export interface ProductionBatchTraceDto {
  releases: ProductionBatchTraceReleaseDto[];
  rootBatchId: string;
  batches: Array<{
    id: string; code: string; productionOrderId: string; articuloId: string; unit: string;
    createdAt: string; observations: string | null; version: number;
    article: { id: string; codigo: string; nombre: string; clasificacion: string; unidadMedida: string } | null;
    order: { id: string; code: string; status: string; startDate: string; observations: string | null; closedAt: string | null };
    balance: Record<string, string | number> | null;
  }>;
  lineage: Array<{ id: string; parentBatchId: string; childBatchId: string; quantity: string | null; unit: string | null; operationKey: string; createdAt: string }>;
  ledger: Array<{ id: string; productionBatchId: string; entryType: string; quantity: string; unit: string; occurredAt: string; operationKey: string; metadata: JsonValue | null }>;
  receptions: Array<{ id: string; productionOrderId: string; producerId: string | null; receivedAt: string; status: string; observations: string | null; version: number; items: Array<{ id: string; productionBatchId: string; grapeVarietyId: string; articuloId: string; quantity: string; unit: string }>; corrections: CorrectionDto[] }>;
  works: Array<{ id: string; productionOrderId: string; transformationOrderId: string | null; workTypeId: string; performedAt: string; observations: string | null; version: number; workType: { id: string; code: string; name: string }; batches: string[]; containers: string[]; participants: Array<{ participantId: string; role: string | null }>; inputs: Array<{ id: string; productionWorkId: string; articuloId: string; article: { id: string; codigo: string; nombre: string } | null; warehouseId: string | null; warehouse: { id: string; codigo: string; nombre: string } | null; inventoryLotId: string | null; quantity: string; unit: string; inventoryMovementId: string | null; operationKey: string | null; status: "ACTIVE"|"REVERSED"; reversedAt: string | null; reversalInventoryMovementId: string | null; reversalOperationKey: string | null; reversalReason: string | null }>; corrections: CorrectionDto[] }>;
  measurements: Array<{ id: string; measurementTypeId: string; value: string; unit: string; measuredAt: string; observations: string | null; productionBatchId: string | null; productionContainerId: string | null; productionWorkId: string | null; participantId: string | null; corrections: CorrectionDto[] }>;
  transformations: Array<{ id: string; productionOrderId: string; transformationOrderId: string | null; productionWorkId: string | null; actorUserId: string; operationKey: string; performedAt: string; observations: string | null; inputs: Array<{ productionBatchId: string; quantity: string; unit: string }>; outputs: Array<{ productionBatchId: string; quantity: string; unit: string }>; losses: Array<{ id: string; productionBatchId: string | null; quantity: string; unit: string; occurredAt: string }> }>;
  losses: Array<{ id: string; productionBatchId: string | null; quantity: string; unit: string; occurredAt: string; observations: string | null }>;
  containers: Array<{ id: string; code: string; name: string | null; type: string | null; location: string | null; material: string | null; capacity: string; capacityUnit: string; status: string; observations: string | null; occupancies: Array<{ id: string; batchId: string; quantity: string; unit: string; openedAt: string; closedAt: string | null }>; movements: Array<{ id: string; movementType: string; sourceContainerId: string | null; destinationContainerId: string; sourceBatchId: string; destinationBatchId: string | null; quantity: string; unit: string; occurredAt: string; productionWorkId: string | null; observations: string | null; actorUserId: string; createdAt: string }> }>;
  inventory: { lots: Array<{ id: string; lotCode: string; articuloId: string; article: { id: string; codigo: string; nombre: string } | null; classification: string; fechaIngreso: string; observations: string | null; originProductionBatchId: string | null }>; movements: Array<{ id: string; type: string; source: string; reason: string | null; articuloId: string; article: { id: string; codigo: string; nombre: string } | null; warehouseId: string; warehouse: { id: string; codigo: string; nombre: string } | null; destinationWarehouseId: string | null; destinationWarehouse: { id: string; codigo: string; nombre: string } | null; inventoryLotId: string | null; quantity: string; unit: string; stockBefore: string; resultingStock: string; createdAt: string }>; stocks: Array<{ id: string; warehouseId: string; warehouse: { id: string; codigo: string; nombre: string } | null; articuloId: string; article: { id: string; codigo: string; nombre: string } | null; inventoryLotId: string | null; quantity: string; unit: string }> };
  warnings: string[];
}

export type InventoryReleaseWarehouseDto = { id: string; codigo: string; nombre: string; };


export type ProductionBatchTraceReleaseDto = {
  releaseId: string;
  productionBatchId: string;
  quantity: string;
  unit: string;
  warehouseId: string;
  inventoryLotId: string;
  inventoryMovementId: string;
  operationKey: string;
  actorUserId: string;
  occurredAt: string;
  status: "ACTIVE" | "REVERSED";
  reversal: {
    operationKey: string;
    reason: string;
    inventoryMovementId: string;
    occurredAt: string;
  } | null;
};

export type ProductionReleaseDto = {
  releaseId: string;
  productionBatchId: string;
  quantity: string;
  unit: string;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  inventoryLotId: string;
  inventoryLot: { id: string; lotCode: string; classification: string };
  inventoryMovementId: string;
  operationKey: string;
  actorUserId: string;
  occurredAt: string;
  observations: string | null;
  status: "ACTIVE" | "REVERSED";
  reversible: boolean;
  reversal: {
    operationKey: string;
    reason: string;
    actorUserId: string;
    occurredAt: string;
    inventoryMovementId: string;
  } | null;
};

export type ReleaseBatchInput = {
  quantity: string;
  warehouseId: string;
  operationKey: string;
  lotCode: string;
  classification: "PRODUCTO_ENVASADO";
  fechaIngreso: string;
  observations?: string;
};


export type ReleaseBatchResult = {
  releaseId: string;
  productionBatchId: string;
  quantity: string;
  remainingProductionQuantity: string;
  inventoryLotId: string;
  inventoryMovementId: string;
  warehouseId: string;
};

export type ReverseReleaseResult = {
  releaseId: string;
  reversalOperationKey: string;
  inventoryMovementId: string;
  remainingProductionQuantity: string;
};

export type ReverseReleaseInput = {
  operationKey: string;
  reason: string;
};
