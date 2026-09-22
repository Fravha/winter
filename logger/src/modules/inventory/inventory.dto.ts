import type { InventoryLotClassification, InventoryMovementType } from "./inventory.model.js";
import type { InventoryUnit } from "./inventory.model.js";
export interface MovementInput {
  articuloId: string; warehouseId: string; inventoryLotId?: string; quantity: string | number;
  unit: string; source: string; reason?: string; idempotencyKey: string;
  authorizeNegativeStock?: boolean; negativeStockReason?: string;
}
export interface TransferInput extends Omit<MovementInput, "warehouseId"> { sourceWarehouseId: string; destinationWarehouseId: string; }
export interface LotInput { articuloId: string; lotCode: string; classification: InventoryLotClassification; fechaIngreso: Date; observations?: string; }
export interface WarehouseInput { codigo: string; nombre: string; ubicacion?: string; encargadoUserId?: string; observaciones?: string; }
export interface WarehouseUpdateInput { nombre: string; ubicacion?: string; encargadoUserId?: string; observaciones?: string; }
export interface AdjustmentInput extends MovementInput { direction: "INCREASE" | "DECREASE"; }

export interface RegisterInboundInput {
  warehouseId: string;
  entries: readonly RegisterInboundEntry[];
}

export interface RegisterInboundEntry {
  articuloId: string;
  inventoryLotId?: string;
  quantity: string | number;
  unit: InventoryUnit;
  idempotencyKey: string;
}

export interface RegisterInboundResult {
  movementId: string;
  articuloId: string;
  inventoryLotId: string | null;
  quantity: string;
  unit: InventoryUnit;
  resultingStock: string;
  createdAt: string;
}

export interface InventoryMovementListInput {
  articuloId: string;
  warehouseId?: string;
  inventoryLotId?: string;
  type?: InventoryMovementType;
  page?: number | string;
  pageSize?: number | string;
}

export interface InventoryMovementListItem {
  id: string;
  type: InventoryMovementType;
  source: string;
  reason: string | null;
  quantity: string;
  unit: InventoryUnit;
  stockBefore: string;
  resultingStock: string;
  createdAt: string;

  articulo: {
    id: string;
    codigo: string;
    nombre: string;
  };

  warehouse: {
    id: string;
    codigo: string;
    nombre: string;
  };

  destinationWarehouse: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;

  lot: {
    id: string;
    lotCode: string;
  } | null;
}

export interface InventoryMovementListResult {
  items: InventoryMovementListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}