import { z } from 'zod';
import { ADJUSTMENT_DIRECTIONS, INVENTORY_UNITS, LOT_CLASSIFICATIONS } from '../types/inventory.types';

const uuid = z.string().uuid();
const optionalUuid = z.preprocess((value) => value === '' ? undefined : value, uuid.optional());
const optionalText = z.string().trim().optional();
const quantity = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/, 'La cantidad debe ser un decimal válido de hasta 3 posiciones').refine((value) => Number(value) > 0, 'La cantidad debe ser mayor que cero');
const validateMovement = <T extends { quantity: string; unit: string; authorizeNegativeStock?: boolean; negativeStockReason?: string }>(schema: z.ZodType<T>) => schema.superRefine((value, context) => {
  if (value.unit === 'UNIDAD' && !Number.isInteger(Number(value.quantity))) context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'La cantidad de UNIDAD debe ser entera' });
  if (value.authorizeNegativeStock && !value.negativeStockReason?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['negativeStockReason'], message: 'Indica el motivo de autorización de stock negativo' });
});
const commonMovement = {
  articuloId: uuid, warehouseId: uuid, quantity, unit: z.enum(INVENTORY_UNITS),
  source: z.string().trim().min(1, 'La fuente es obligatoria'),
  inventoryLotId: optionalUuid, reason: optionalText, authorizeNegativeStock: z.boolean().optional(),
  negativeStockReason: optionalText,
};
export const createWarehouseSchema = z.object({ codigo: z.string().trim().min(1), nombre: z.string().trim().min(1), ubicacion: optionalText, encargadoUserId: optionalUuid, observaciones: optionalText }).strict();
export const updateWarehouseSchema = z.object({ nombre: z.string().trim().min(1), ubicacion: optionalText, encargadoUserId: optionalUuid, observaciones: optionalText }).strict();
export const stockFiltersSchema = z.object({ warehouseId: uuid, articuloId: uuid, inventoryLotId: optionalUuid }).strict();
export const classifyLotSchema = z.object({ classification: z.enum(LOT_CLASSIFICATIONS) }).strict();
export const movementSchema = validateMovement(z.object(commonMovement).strict());
export const transferSchema = validateMovement(z.object({ articuloId: uuid, sourceWarehouseId: uuid, destinationWarehouseId: uuid, quantity, unit: z.enum(INVENTORY_UNITS), source: z.string().trim().min(1), inventoryLotId: optionalUuid, reason: optionalText, authorizeNegativeStock: z.boolean().optional(), negativeStockReason: optionalText }).strict().superRefine((value, context) => {
  if (value.sourceWarehouseId === value.destinationWarehouseId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationWarehouseId'], message: 'Los almacenes de origen y destino deben ser distintos' });
}));
export const adjustmentSchema = validateMovement(z.object({ ...commonMovement, direction: z.enum(ADJUSTMENT_DIRECTIONS) }).strict());
export type CreateWarehouseFormValues = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseFormValues = z.infer<typeof updateWarehouseSchema>;
export type MovementFormValues = z.infer<typeof movementSchema>;
export type TransferFormValues = z.infer<typeof transferSchema>;
export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;