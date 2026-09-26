import { z } from 'zod';
import { CUSTOM_FIELD_DATA_TYPES, CUSTOM_FIELD_ENTITY_TYPES, PRODUCTION_STATUSES, RECEPTION_STATUSES, RECEPTION_UNITS } from '../types/production.types';

const code = z.string().trim().min(1).max(100);
const name = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(2000).optional();
export const catalogCreateSchema = z.object({ code, name }).strict();
export const participantCreateSchema = catalogCreateSchema.extend({ userId: z.string().uuid().optional() }).strict();
export const catalogUpdateSchema = z.object({ name }).strict();
export const catalogFiltersSchema = z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), search: z.string().trim().optional(), active: z.boolean().optional() }).strict();
const formDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/, 'Usa una fecha y hora válidas');
const customFieldOptions = z.array(z.string().trim().min(1).max(200)).optional();
function validateCustomFieldOptions(options: string[] | undefined, ctx: z.RefinementCtx, requireOptions: boolean) {
  if (options === undefined) {
    if (requireOptions) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Las opciones son obligatorias para SELECT' });
    return;
  }
  const normalized = options.map((option) => option.trim());
  if (normalized.some((option) => option.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Las opciones no pueden estar vacías' });
  }
  if (new Set(normalized).size !== normalized.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Las opciones no pueden repetirse' });
  }
  if (requireOptions && normalized.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'SELECT requiere al menos una opción' });
  }
}
export const customFieldDefinitionCreateSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES), code, label: name, dataType: z.enum(CUSTOM_FIELD_DATA_TYPES),
  required: z.boolean().optional(), active: z.boolean().optional(), options: customFieldOptions, displayOrder: z.number().int().nonnegative().optional(),
}).strict().superRefine((v, ctx) => {
  validateCustomFieldOptions(v.options, ctx, v.dataType === 'SELECT');
});
export const customFieldDefinitionUpdateSchema = z.object({ label: name.optional(), required: z.boolean().optional(), options: customFieldOptions, displayOrder: z.number().int().nonnegative().optional() }).strict().superRefine((v, ctx) => {
  validateCustomFieldOptions(v.options, ctx, false);
});
export const customFieldValueSchema = z.object({ definitionId: z.string().uuid(), entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES), entityId: z.string().uuid(), value: z.union([z.string(), z.number(), z.boolean()]) }).strict();
export const productionOrderCreateSchema = z.object({ code, startDate: formDateTime, observations: optionalText }).strict();
export const transformationOrderCreateSchema = z.object({
  code,
  productionOrderId: z.string().uuid(),
  periodStart: formDateTime,
  periodEnd: z.union([formDateTime, z.literal('')]).optional(),
  observations: optionalText,
}).strict().superRefine((v, ctx) => {
  if (v.periodEnd && new Date(v.periodEnd).getTime() < new Date(v.periodStart).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: 'El fin no puede ser anterior al inicio' });
  }
});
export const productionOrderFiltersSchema = z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), status: z.enum(PRODUCTION_STATUSES).optional() }).strict();
export const transformationOrderFiltersSchema = productionOrderFiltersSchema;
const decimalPositive = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/, 'Cantidad decimal inválida').refine(v => Number(v) > 0, 'Debe ser positiva');
const receptionItemSchema = z.object({
  grapeVarietyId: z.string().uuid(), articuloId: z.string().uuid(), quantity: decimalPositive, unit: z.enum(RECEPTION_UNITS),
}).strict();
const receptionObservations = z.string().max(2000);
export const grapeReceptionCreateSchema = z.object({
  productionOrderId: z.string().uuid(), producerId: z.string().uuid().optional(), receivedAt: z.string().datetime({ offset: true }),
  status: z.enum(RECEPTION_STATUSES), observations: receptionObservations.optional(), items: z.array(receptionItemSchema).min(1),
  customFields: z.array(z.object({ definitionId: z.string().uuid(), value: z.union([z.string(), z.number(), z.boolean()]) }).strict()).optional(),
  operationKey: z.string().trim().min(1).max(100), requestHash: z.string().trim().min(1),
}).strict().superRefine((v, ctx) => {
  if (v.status === 'ACCEPTED_WITH_OBSERVATIONS' && !v.observations?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'], message: 'Las observaciones son obligatorias' });
});
export const receptionCorrectionSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('receivedAt'), newValue: z.string().datetime({ offset: true }), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('producerId'), newValue: z.string().uuid(), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('observations'), newValue: z.string().max(2000).nullable(), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('status'), newValue: z.enum(RECEPTION_STATUSES), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
]);
export const receptionListFiltersSchema = z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional() }).strict();
export const batchListFiltersSchema = z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), articuloId: z.string().uuid().optional(), productionOrderId: z.string().uuid().optional() }).strict();
export const receptionCreateSchema = grapeReceptionCreateSchema;
export const correctionSchema = receptionCorrectionSchema;
export type CatalogCreateFormValues = z.infer<typeof catalogCreateSchema>;
export type ParticipantCreateFormValues = z.infer<typeof participantCreateSchema>;
export type CustomFieldDefinitionCreateFormValues = z.infer<typeof customFieldDefinitionCreateSchema>;
export type ProductionOrderCreateFormValues = z.infer<typeof productionOrderCreateSchema>;
export type TransformationOrderCreateFormValues = z.infer<typeof transformationOrderCreateSchema>;
export type GrapeReceptionCreateFormValues = z.infer<typeof grapeReceptionCreateSchema>;
export type ReceptionCorrectionFormValues = z.infer<typeof receptionCorrectionSchema>;

const apiDate = z.string().datetime({ offset: true });
const uuid = z.string().uuid();
const page = z.number().int().positive().optional();
const pageSize = z.number().int().positive().max(100).optional();
const workParticipantSchema = z.object({ participantId: uuid, role: z.string().trim().min(1).max(100).optional() }).strict();
export const workListFiltersSchema = z.object({ page, pageSize, productionOrderId: uuid.optional(), workTypeId: uuid.optional() }).strict();
export const productionWorkCreateSchema = z.object({
  productionOrderId: uuid, transformationOrderId: uuid.optional(), workTypeId: uuid, performedAt: apiDate,
  observations: z.string().max(2000).optional(), batchIds: z.array(uuid).default([]),
  containerIds: z.array(uuid).default([]), participants: z.array(workParticipantSchema).default([]),
}).strict();
const workCorrectionCommon = { reason: z.string().trim().min(1).max(2000) };
export const workCorrectionSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('performedAt'), newValue: apiDate, ...workCorrectionCommon }).strict(),
  z.object({ field: z.literal('workTypeId'), newValue: uuid, ...workCorrectionCommon }).strict(),
  z.object({ field: z.literal('transformationOrderId'), newValue: uuid.nullable(), ...workCorrectionCommon }).strict(),
  z.object({ field: z.literal('observations'), newValue: z.string().max(2000).nullable(), ...workCorrectionCommon }).strict(),
]);
export const measurementListFiltersSchema = z.object({
  page, pageSize, measurementTypeId: uuid.optional(), productionBatchId: uuid.optional(),
  productionContainerId: uuid.optional(), productionWorkId: uuid.optional(),
  measuredAtFrom: apiDate.optional(), measuredAtTo: apiDate.optional(),
}).strict();
const measurementValue = z.string().regex(/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/, 'Decimal inválido');
export const productionMeasurementCreateSchema = z.object({
  measurementTypeId: uuid, productionBatchId: uuid.optional(), productionContainerId: uuid.optional(),
  productionWorkId: uuid.optional(), participantId: uuid.optional(), value: measurementValue,
  unit: z.string().trim().min(1).max(100), measuredAt: apiDate, observations: z.string().max(2000).optional(),
}).strict().refine(v => !!(v.productionBatchId || v.productionContainerId || v.productionWorkId), {
  message: 'Debe indicar al menos un contexto de medición',
});
export const measurementCorrectionSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('value'), newValue: measurementValue, reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('unit'), newValue: z.string().trim().min(1).max(100), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('measuredAt'), newValue: apiDate, reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('participantId'), newValue: uuid.nullable(), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
  z.object({ field: z.literal('observations'), newValue: z.string().max(2000).nullable(), reason: z.string().trim().min(1).max(2000), operationKey: z.string().trim().min(1).max(100) }).strict(),
]);
export type ProductionWorkCreateFormValues = z.infer<typeof productionWorkCreateSchema>;
export type WorkCorrectionFormValues = z.infer<typeof workCorrectionSchema>;
export type ProductionMeasurementCreateFormValues = z.infer<typeof productionMeasurementCreateSchema>;
export type MeasurementCorrectionFormValues = z.infer<typeof measurementCorrectionSchema>;

const transformationDecimalPositive = z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/, 'Cantidad decimal inválida (máx 13 enteros, 3 decimales)').refine(v => Number(v) > 0, 'Debe ser mayor a 0');

export const transformationCreateInputItemSchema = z.object({
  productionBatchId: z.string().uuid('Lote requerido'),
  quantity: transformationDecimalPositive,
}).strict();

export const transformationCreateOutputItemSchema = z.object({
  articuloId: z.string().uuid('Artículo requerido'),
  quantity: transformationDecimalPositive,
  unit: z.enum(RECEPTION_UNITS, { required_error: 'Unidad requerida' }),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
}).strict();

export const transformationCreateLossItemSchema = z.object({
  productionBatchId: z.string().uuid('Lote inválido').optional(),
  quantity: transformationDecimalPositive,
  unit: z.enum(RECEPTION_UNITS, { required_error: 'Unidad requerida' }),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
}).strict();

export const transformationCreateSchema = z.object({
  productionOrderId: z.string().uuid('Orden de producción requerida'),
  transformationOrderId: z.string().uuid('Orden de transformación inválida').optional(),
  productionWorkId: z.string().uuid('Trabajo inválido').optional(),
  performedAt: apiDate,
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  operationKey: z.string().trim().min(1).max(200),
  requestHash: z.string().trim().min(1).max(500),
  inputs: z.array(transformationCreateInputItemSchema).min(1, 'Se requiere al menos un input'),
  outputs: z.array(transformationCreateOutputItemSchema).min(1, 'Se requiere al menos un output'),
  losses: z.array(transformationCreateLossItemSchema).optional(),
}).strict().superRefine((v, ctx) => {
  const inputBatchIds = v.inputs.map(i => i.productionBatchId);
  if (new Set(inputBatchIds).size !== inputBatchIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inputs'], message: 'No se puede duplicar el mismo lote de entrada' });
  }
});
export type TransformationCreateFormValues = z.infer<typeof transformationCreateSchema>;