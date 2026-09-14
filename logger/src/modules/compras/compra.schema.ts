import { z } from "zod";

const decimal = z.string().regex(/^\d+(?:\.\d{1,3})?$/, "Must be a decimal with at most 3 places");
const unit = z.enum(["KG", "G", "L", "M", "UNIDAD"]);

export const compraIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

const itemSchema = z.object({
  articuloId: z.string().uuid(),
  brand: z.string().trim().min(1).max(150).optional(),
  requestedQuantity: decimal,
  unit,
  unitPrice: decimal.optional(),
}).strict();

const commonFields = {
  supplierName: z.string().trim().min(1).max(200),
  supplierTaxId: z.string().trim().min(1).max(80).optional(),
  documentNumber: z.string().trim().min(1).max(100).optional(),
  documentDate: z.coerce.date().optional(),
  currency: z.string().trim().min(1).max(12).optional(),
  observations: z.string().max(5000).optional(),
};

export const createCompraSchema = z.object({
  ...commonFields,
  items: z.array(itemSchema).min(1),
}).strict();

export const updateCompraSchema = z.object({
  supplierName: commonFields.supplierName.optional(),
  supplierTaxId: commonFields.supplierTaxId.nullable().optional(),
  documentNumber: commonFields.documentNumber.nullable().optional(),
  documentDate: commonFields.documentDate.nullable().optional(),
  currency: commonFields.currency.nullable().optional(),
  observations: commonFields.observations.nullable().optional(),
  items: z.array(itemSchema).min(1).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const listComprasSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["REGISTERED", "RECEIVED", "CANCELLED"]).optional(),
}).strict();

export const receiveCompraSchema = z.object({
  warehouseId: z.string().uuid(),
  items: z.array(z.object({
    compraItemId: z.string().uuid(),
    inventoryLotId: z.string().uuid().optional(),
  }).strict()).min(1).optional(),
}).strict();

export const cancelCompraSchema = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();