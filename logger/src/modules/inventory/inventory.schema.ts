import { z } from "zod";
export const idSchema = z.object({ id: z.string().uuid() });
export const movementSchema = z.object({ articuloId: z.string().uuid(), warehouseId: z.string().uuid(), inventoryLotId: z.string().uuid().optional(), quantity: z.union([z.string(), z.number()]), unit: z.enum(["KG","G","L","M","UNIDAD"]), source: z.string().min(1), reason: z.string().optional(), authorizeNegativeStock: z.boolean().optional(), negativeStockReason: z.string().optional() });
export const transferSchema = movementSchema.omit({ warehouseId: true }).extend({ sourceWarehouseId: z.string().uuid(), destinationWarehouseId: z.string().uuid() });
export const adjustmentSchema = movementSchema.extend({ direction: z.enum(["INCREASE", "DECREASE"]) });
export const warehouseSchema = z.object({ codigo: z.string().trim().min(1), nombre: z.string().trim().min(1), ubicacion: z.string().optional(), encargadoUserId: z.string().uuid().optional(), observaciones: z.string().optional() });
export const warehouseUpdateSchema = z.object({
  nombre: z.string().trim().min(1),
  ubicacion: z.string().optional(),
  encargadoUserId: z.string().uuid().optional(),
  observaciones: z.string().optional(),
}).strict();
export const idempotencySchema = z.string().min(1);
export const classificationSchema = z.object({ classification: z.enum(["PRODUCTO_ENVASADO", "PRODUCTO_TERMINADO", "PRODUCTO_TERMINADO_EXPORTACION"]) });
export const movementHistoryQuerySchema = z.object({
  articuloId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  inventoryLotId: z.string().uuid().optional(),
  type: z.enum(["INBOUND", "OUTBOUND", "TRANSFER", "ADJUSTMENT"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
}).strict();