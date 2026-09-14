export type InventoryMovementType = "INBOUND" | "OUTBOUND" | "TRANSFER" | "ADJUSTMENT";
export type InventoryLotClassification = "PRODUCTO_ENVASADO" | "PRODUCTO_TERMINADO" | "PRODUCTO_TERMINADO_EXPORTACION";
export type InventoryUnit = "KG" | "G" | "L" | "M" | "UNIDAD";
export interface ExecutionContext { actorUserId: string; permissions: readonly string[]; requestId?: string; }
export interface StockPosition { warehouseId: string; articuloId: string; inventoryLotId?: string | null; quantity: string; unit: InventoryUnit; hasNegativeStock: boolean; }
export interface CommandResult { movementId: string; articuloId: string; inventoryLotId?: string | null; quantity: string; unit: InventoryUnit; resultingStock: string; createdAt: Date; }

const trustedIntermoduleBrand = Symbol("inventory.trustedIntermodule");
const trustedContexts = new WeakSet<object>();

/**
 * A trusted context is created by server-side module composition only. It is
 * deliberately distinct from ExecutionContext so an HTTP handler cannot
 * satisfy an intermodule operation by adding a flag to a request body.
 */
export interface TrustedIntermoduleContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly [trustedIntermoduleBrand]: true;
}

export const createTrustedIntermoduleContext = (
  context: Pick<ExecutionContext, "actorUserId" | "requestId">,
): TrustedIntermoduleContext => {
  const trusted = {
    actorUserId: context.actorUserId,
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
    [trustedIntermoduleBrand]: true as const,
  };
  trustedContexts.add(trusted);
  return trusted;
};

export const isTrustedIntermoduleContext = (
  context: TrustedIntermoduleContext,
): boolean => trustedContexts.has(context);