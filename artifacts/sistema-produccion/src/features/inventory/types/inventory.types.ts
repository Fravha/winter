export const INVENTORY_UNITS = ['KG', 'G', 'L', 'M', 'UNIDAD'] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export const LOT_CLASSIFICATIONS = ['PRODUCTO_ENVASADO', 'PRODUCTO_TERMINADO', 'PRODUCTO_TERMINADO_EXPORTACION'] as const;
export type LotClassification = (typeof LOT_CLASSIFICATIONS)[number];
export const ADJUSTMENT_DIRECTIONS = ['INCREASE', 'DECREASE'] as const;
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number];
export const MOVEMENT_TYPES = ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type Warehouse = { id: string; codigo: string; nombre: string; ubicacion: string | null; encargadoUserId: string | null; activo: boolean; observaciones: string | null; createdAt: string; updatedAt: string };
export type WarehouseListFilters = { page?: number; pageSize?: number };
export type CreateWarehouseInput = { codigo: string; nombre: string; ubicacion?: string; encargadoUserId?: string; observaciones?: string };
export type UpdateWarehouseInput = { nombre: string; ubicacion?: string; encargadoUserId?: string; observaciones?: string };

export type Stock = { warehouseId: string; articuloId: string; inventoryLotId: string | null; quantity: string; unit: InventoryUnit; hasNegativeStock: boolean };
export type StockFilters = { warehouseId: string; articuloId: string; inventoryLotId?: string };
export type InventoryLot = { id: string; lotCode: string; articuloId: string; originProductionBatchId: string | null; classification: LotClassification; fechaIngreso: string; observations: string | null; createdAt: string; updatedAt: string };
export type ClassifyLotInput = { classification: LotClassification };
export type LotClassificationResult = { inventoryLotId: string; previousClassification: LotClassification; classification: LotClassification; updatedAt: string };

export type MovementInput = { articuloId: string; warehouseId: string; quantity: string; unit: InventoryUnit; source: string; inventoryLotId?: string; reason?: string; authorizeNegativeStock?: boolean; negativeStockReason?: string };
export type TransferInput = { articuloId: string; sourceWarehouseId: string; destinationWarehouseId: string; quantity: string; unit: InventoryUnit; source: string; inventoryLotId?: string; reason?: string; authorizeNegativeStock?: boolean; negativeStockReason?: string };
export type AdjustmentInput = MovementInput & { direction: AdjustmentDirection };
export type MovementResult = { movementId: string; articuloId: string; inventoryLotId: string | null; quantity: string; unit: InventoryUnit; resultingStock: string; createdAt: string };
export type TransferResult = MovementResult & { destinationResultingStock: string };
export type IdempotentCommand<T> = { input: T; idempotencyKey: string };

export type MovementReference = { id: string; codigo: string; nombre: string };
export type MovementLot = { id: string; lotCode: string };
export type InventoryMovement = {
  id: string;
  type: MovementType;
  source: string;
  reason: string | null;
  quantity: string;
  unit: InventoryUnit;
  stockBefore: string;
  resultingStock: string;
  createdAt: string;
  articulo: MovementReference;
  warehouse: MovementReference;
  destinationWarehouse: MovementReference | null;
  lot: MovementLot | null;
};
export type MovementListFilters = {
  articuloId: string;
  warehouseId?: string;
  inventoryLotId?: string;
  type?: MovementType;
  page?: number;
  pageSize?: number;
};
export type MovementPagination = { page: number; pageSize: number; total: number; totalPages: number };
export type MovementHistoryResponse = {
  items: InventoryMovement[];
  pagination: MovementPagination;
  requestId: string | null;
};