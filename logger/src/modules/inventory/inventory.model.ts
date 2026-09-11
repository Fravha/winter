export type InventoryMovementType = "INBOUND" | "OUTBOUND" | "TRANSFER" | "ADJUSTMENT";
export type InventoryLotClassification = "PRODUCTO_ENVASADO" | "PRODUCTO_TERMINADO" | "PRODUCTO_TERMINADO_EXPORTACION";
export type InventoryUnit = "KG" | "G" | "L" | "M" | "UNIDAD";
export interface ExecutionContext { actorUserId: string; permissions: readonly string[]; requestId?: string; }
export interface StockPosition { warehouseId: string; articuloId: string; inventoryLotId?: string | null; quantity: string; unit: InventoryUnit; hasNegativeStock: boolean; }
export interface CommandResult { movementId: string; articuloId: string; inventoryLotId?: string | null; quantity: string; unit: InventoryUnit; resultingStock: string; createdAt: Date; }