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
const measurementValue = z.string().trim().regex(/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
export const containerCreateSchema = z.object({ code: code, capacity: quantity, capacityUnit: z.string().trim().min(1).max(30), observations: z.string().max(2000).optional() }).strict();
export const containerUpdateSchema = z.object({ capacity: quantity.optional(), observations: z.string().max(2000).optional() }).strict();
export const containerMoveSchema = z.object({ batchId: z.string().uuid(), sourceContainerId: z.string().uuid().optional(), destinationContainerId: z.string().uuid(), quantity: quantity.optional(), childCode: code.optional(), operationKey: code, requestHash: z.string().trim().min(1).max(500), occurredAt: z.coerce.date().optional() }).strict();
export const workListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), productionOrderId: z.string().uuid().optional(), workTypeId: z.string().uuid().optional() }).strict();
export const workParticipantSchema = z.object({ participantId: z.string().uuid(), role: z.string().trim().min(1).max(100).optional() }).strict();
export const workCreateSchema = z.object({
  productionOrderId: z.string().uuid(), transformationOrderId: z.string().uuid().optional(), workTypeId: z.string().uuid(),
  performedAt: z.coerce.date(), observations: z.string().max(2000).optional(),
  batchIds: z.array(z.string().uuid()).default([]), containerIds: z.array(z.string().uuid()).default([]),
  participants: z.array(workParticipantSchema).default([]),
}).strict();
export const workCorrectionSchema = z.object({
  field: z.enum(["performedAt", "workTypeId", "transformationOrderId", "observations"]),
  newValue: z.string().nullable(),
  reason: z.string().trim().min(1).max(2000),
}).strict();
export const grapeReceptionSchema = z.object({
  productionOrderId: z.string().uuid(), producerId: z.string().uuid().optional(),
  receivedAt: z.coerce.date(), status: z.enum(["ACCEPTED", "ACCEPTED_WITH_OBSERVATIONS"]),
  observations: z.string().max(2000).optional(),
  items: z.array(z.object({ grapeVarietyId: z.string().uuid(), articuloId: z.string().uuid(), quantity, unit: z.enum(["KG","G","L","M","UNIDAD"]) }).strict()).min(1),
  customFields: z.array(z.object({ definitionId: z.string().uuid(), value: z.union([z.string(), z.number(), z.boolean()]) }).strict()).optional(),
  operationKey: z.string().trim().min(1).max(200), requestHash: z.string().trim().min(1).max(500),
}).strict();
export const measurementCreateSchema = z.object({
  measurementTypeId: z.string().uuid(), productionBatchId: z.string().uuid().optional(),
  productionContainerId: z.string().uuid().optional(), productionWorkId: z.string().uuid().optional(),
  participantId: z.string().uuid().optional(), value: measurementValue,
  unit: z.string().trim().min(1).max(100), measuredAt: z.coerce.date(), observations: z.string().max(2000).optional(),
}).strict().refine(
  value => Boolean(value.productionBatchId || value.productionContainerId || value.productionWorkId),
  { message: "At least one production context is required" },
);
export const measurementListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  measurementTypeId: z.string().uuid().optional(), productionBatchId: z.string().uuid().optional(),
  productionContainerId: z.string().uuid().optional(), productionWorkId: z.string().uuid().optional(),
  measuredAtFrom: z.coerce.date().optional(), measuredAtTo: z.coerce.date().optional(),
}).strict();
const positiveQuantity = quantity.refine(value => Number(value) > 0, "Quantity must be positive");
const transformationInputSchema = z.object({ productionBatchId: z.string().uuid(), quantity: positiveQuantity }).strict();
const transformationOutputSchema = z.object({ articuloId: z.string().uuid(), quantity: positiveQuantity, unit: z.enum(["KG","G","L","M","UNIDAD"]), observations: z.string().max(2000).optional() }).strict();
const transformationLossSchema = z.object({ productionBatchId: z.string().uuid().optional(), quantity: positiveQuantity, unit: z.enum(["KG","G","L","M","UNIDAD"]), operationKey: z.string().trim().min(1).max(200).optional(), requestHash: z.string().trim().min(1).max(500).optional(), observations: z.string().max(2000).optional() }).strict();
export const transformationCreateSchema = z.object({
  productionOrderId: z.string().uuid(), transformationOrderId: z.string().uuid().optional(), productionWorkId: z.string().uuid().optional(),
  performedAt: z.coerce.date(), observations: z.string().max(2000).optional(),
  operationKey: z.string().trim().min(1).max(200), requestHash: z.string().trim().min(1).max(500),
  inputs: z.array(transformationInputSchema).min(1), outputs: z.array(transformationOutputSchema).min(1), losses: z.array(transformationLossSchema).optional(),
}).strict();
export const transformationListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), productionOrderId: z.string().uuid().optional() }).strict();