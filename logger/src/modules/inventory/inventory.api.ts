import type { ExecutionContext, StockPosition, TrustedIntermoduleContext } from "./inventory.model.js";
import type { AdjustmentInput, LotInput, MovementInput, RegisterInboundInput, RegisterInboundResult, TransferInput, WarehouseInput } from "./inventory.dto.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
export interface InventoryApi {
 getWarehouse(input: { warehouseId: string }, context?: ExecutionContext): Promise<unknown>;
 listWarehouses(input?: { page?: number; pageSize?: number }, context?: ExecutionContext): Promise<unknown>;
 getInventoryLot(input: { inventoryLotId: string }, context?: ExecutionContext): Promise<unknown>;
 getStock(input: { warehouseId: string; articuloId: string; inventoryLotId?: string }, context?: ExecutionContext): Promise<StockPosition>;
 getAvailableQuantity(input: { warehouseId: string; articuloId: string; inventoryLotId?: string }, context?: ExecutionContext): Promise<unknown>;
  registerInbound(input: MovementInput, context: ExecutionContext): Promise<unknown>;
  registerInbounds(input: RegisterInboundInput, context: TrustedIntermoduleContext, transaction: SharedTransactionContext): Promise<readonly RegisterInboundResult[]>;
 registerOutbound(input: MovementInput, context: ExecutionContext): Promise<unknown>;
 registerTransfer(input: TransferInput, context: ExecutionContext): Promise<unknown>;
 registerAdjustment(input: AdjustmentInput, context: ExecutionContext): Promise<unknown>;
 registerProductionConsumption(input: MovementInput, context: ExecutionContext): Promise<unknown>;
 registerProductionOutput(input: MovementInput & { lot?: LotInput }, context: ExecutionContext): Promise<unknown>;
 transitionInventoryLotClassification(input: { inventoryLotId: string; classification: LotInput["classification"]; idempotencyKey: string }, context: ExecutionContext): Promise<unknown>;
 createWarehouse(input: WarehouseInput, context: ExecutionContext): Promise<unknown>;
 updateWarehouse(warehouseId: string, input: WarehouseInput, context: ExecutionContext): Promise<unknown>;
 setWarehouseActive(warehouseId: string, active: boolean, context: ExecutionContext): Promise<unknown>;
}