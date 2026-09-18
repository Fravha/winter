import { z } from "zod";

const code = z.string().trim().min(1).max(100);
const name = z.string().trim().min(1).max(200);
export const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const catalogInputSchema = z.object({ code, name, userId: z.string().uuid().optional() }).strict();
export const administrativeCatalogInputSchema = z.object({ code, name }).strict();
export const catalogUpdateSchema = z.object({ name: name.optional() }).strict();
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();
export const customDefinitionSchema = z.object({
  entityType: z.enum(["PRODUCER", "GRAPE_VARIETY", "GRAPE_RECEPTION"]),
  code, label: name,
  dataType: z.enum(["TEXT", "INTEGER", "DECIMAL", "BOOLEAN", "DATE", "SELECT"]),
  required: z.boolean().default(false), active: z.boolean().default(true),
  options: z.array(z.string()).optional(), displayOrder: z.number().int().default(0),
}).strict();
export const customDefinitionUpdateSchema = customDefinitionSchema.pick({ label: true, required: true, options: true, displayOrder: true }).partial().strict();
export const customValueSchema = z.object({
  definitionId: z.string().uuid(), entityType: z.enum(["PRODUCER", "GRAPE_VARIETY", "GRAPE_RECEPTION"]),
  entityId: z.string().uuid(), value: z.union([z.string(), z.number(), z.boolean()]),
}).strict();
export const orderListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
}).strict();
export const productionOrderCreateSchema = z.object({
  code, startDate: z.coerce.date(), observations: z.string().max(2000).optional(),
}).strict();
export const transformationOrderCreateSchema = z.object({
  code, productionOrderId: z.string().uuid(), periodStart: z.coerce.date(),
  periodEnd: z.coerce.date().optional(), observations: z.string().max(2000).optional(),
}).strict();
export const batchListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  articuloId: z.string().uuid().optional(),
  productionOrderId: z.string().uuid().optional(),
}).strict();
const quantity = z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/);
export const containerCreateSchema = z.object({ code: code, capacity: quantity, capacityUnit: z.string().trim().min(1).max(30), observations: z.string().max(2000).optional() }).strict();
export const containerUpdateSchema = z.object({ capacity: quantity.optional(), observations: z.string().max(2000).optional() }).strict();
export const containerMoveSchema = z.object({ batchId: z.string().uuid(), sourceContainerId: z.string().uuid().optional(), destinationContainerId: z.string().uuid(), quantity: quantity.optional(), childCode: code.optional(), operationKey: code, requestHash: z.string().trim().min(1).max(500), occurredAt: z.coerce.date().optional() }).strict();