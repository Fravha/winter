import type { InventoryLotClassification, InventoryMovementType } from "./inventory.model.js";
export interface MovementInput {
  articuloId: string; warehouseId: string; inventoryLotId?: string; quantity: string | number;
  unit: string; source: string; reason?: string; idempotencyKey: string;
  authorizeNegativeStock?: boolean; negativeStockReason?: string;
}
export interface TransferInput extends Omit<MovementInput, "warehouseId"> { sourceWarehouseId: string; destinationWarehouseId: string; }
export interface LotInput { articuloId: string; lotCode: string; classification: InventoryLotClassification; fechaIngreso: Date; observations?: string; }
export interface WarehouseInput { codigo: string; nombre: string; ubicacion?: string; encargadoUserId?: string; observaciones?: string; }
export interface AdjustmentInput extends MovementInput { direction: "INCREASE" | "DECREASE"; }