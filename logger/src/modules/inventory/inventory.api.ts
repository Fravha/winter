import type { CommandResult, ExecutionContext, StockPosition, TrustedIntermoduleContext, InventoryLotClassification } from "./inventory.model.js";
import type { AdjustmentInput, InventoryMovementListInput, InventoryMovementListResult, LotInput, MovementInput, RegisterInboundInput, RegisterInboundResult, TransferInput, WarehouseInput, WarehouseUpdateInput } from "./inventory.dto.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
export interface InventoryApi {
 getWarehouse(input: { warehouseId: string }, context?: ExecutionContext): Promise<unknown>;
 listWarehouses(input?: { page?: number; pageSize?: number }, context?: ExecutionContext): Promise<unknown>;
 listMovements(
  input: InventoryMovementListInput,
  context?: ExecutionContext,
): Promise<InventoryMovementListResult>;
 getInventoryLot(input: { inventoryLotId: string }, context?: ExecutionContext): Promise<unknown>;
 getStock(input: { warehouseId: string; articuloId: string; inventoryLotId?: string }, context?: ExecutionContext): Promise<StockPosition>;
 getAvailableQuantity(input: { warehouseId: string; articuloId: string; inventoryLotId?: string }, context?: ExecutionContext): Promise<unknown>;
  registerInbound(input: MovementInput, context: ExecutionContext): Promise<unknown>;
  registerInbounds(input: RegisterInboundInput, context: TrustedIntermoduleContext, transaction: SharedTransactionContext): Promise<readonly RegisterInboundResult[]>;
 registerOutbound(input: MovementInput, context: ExecutionContext): Promise<unknown>;
 registerTransfer(input: TransferInput, context: ExecutionContext): Promise<unknown>;
 registerAdjustment(input: AdjustmentInput, context: ExecutionContext): Promise<unknown>;
 registerProductionConsumption(input: MovementInput, context: ExecutionContext): Promise<unknown>;
  consumeProductionInput(input: MovementInput, context: TrustedIntermoduleContext, transaction: SharedTransactionContext): Promise<CommandResult>;
  reverseProductionInputConsumption(input: MovementInput, context: TrustedIntermoduleContext, transaction: SharedTransactionContext): Promise<CommandResult>;
 registerProductionOutput(input: MovementInput & { lot?: LotInput }, context: ExecutionContext): Promise<unknown>;
  releaseProductionOutput(input: { warehouseId: string; articuloId: string; unit: string; quantity: string; lotCode: string; classification: "PRODUCTO_ENVASADO"; fechaIngreso: Date; observations?: string; originProductionBatchId: string; idempotencyKey: string }, context: TrustedIntermoduleContext, transaction: SharedTransactionContext): Promise<{ inventoryLotId: string; inventoryMovementId: string; warehouseId: string }>;
 transitionInventoryLotClassification(input: { inventoryLotId: string; classification: LotInput["classification"]; idempotencyKey: string }, context: ExecutionContext): Promise<unknown>;
 createWarehouse(input: WarehouseInput, context: ExecutionContext): Promise<unknown>;
  updateWarehouse(warehouseId: string, input: WarehouseUpdateInput, context: ExecutionContext): Promise<unknown>;
 setWarehouseActive(warehouseId: string, active: boolean, context: ExecutionContext): Promise<unknown>;
}