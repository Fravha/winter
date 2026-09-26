import { z } from 'zod';
import { COMPRA_STATUSES, COMPRA_UNITS } from '../types/compra.types';

const uuid = z.string().uuid();
const decimal = /^\d+(?:\.\d{1,3})?$/;
const quantity = z.string().trim().regex(decimal, 'La cantidad debe ser un decimal válido').refine((v) => Number(v) > 0, 'La cantidad debe ser mayor que cero');
const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalNullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDecimal = z
  .string()
  .trim()
  .refine((value) => value === '' || /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(value), 'El precio debe ser un decimal válido')
  .optional();
const item = z.object({
  articuloId: uuid,
  brand: optionalText(150),
  requestedQuantity: quantity,
  unit: z.enum(COMPRA_UNITS),
  unitPrice: optionalDecimal,
}).strict().superRefine((value, ctx) => {
  if (value.unit === 'UNIDAD' && !Number.isInteger(Number(value.requestedQuantity))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['requestedQuantity'], message: 'La unidad exige una cantidad entera' });
  }
});

const common = {
  supplierName: z.string().trim().min(1).max(200),
  supplierTaxId: optionalText(80),
  documentNumber: optionalText(100),
  documentDate: z.union([z.string().datetime({ offset: true }), z.literal('')]).optional(),
  currency: optionalText(12),
  observations: z.string().max(5000).optional(),
};

function uniqueItems(items: Array<{ articuloId: string }>, ctx: z.RefinementCtx) {
  if (new Set(items.map((x) => x.articuloId)).size !== items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'No puede repetirse un artículo' });
  }
}

export const createCompraSchema = z.object({ ...common, items: z.array(item).min(1) }).strict().superRefine((v, ctx) => uniqueItems(v.items, ctx));
export const updateCompraSchema = z.object({
  supplierName: common.supplierName.optional(),
  supplierTaxId: optionalNullableText(80),
  documentNumber: optionalNullableText(100),
  documentDate: z.string().datetime({ offset: true }).nullable().optional(),
  currency: optionalNullableText(12),
  observations: z.string().max(5000).nullable().optional(),
  items: z.array(item).min(1).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Debe indicar al menos un campo para actualizar').superRefine((v, ctx) => v.items && uniqueItems(v.items, ctx));
export const receiveCompraSchema = z.object({
  warehouseId: uuid,
  items: z.array(z.object({ compraItemId: uuid, inventoryLotId: uuid.optional() }).strict()).min(1).optional(),
}).strict();
export const cancelCompraSchema = z.object({ reason: z.string().trim().max(2000).optional() }).strict();
export const comprasListFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(COMPRA_STATUSES).optional(),
}).strict();

export type CreateCompraFormValues = z.infer<typeof createCompraSchema>;
export type UpdateCompraFormValues = z.infer<typeof updateCompraSchema>;