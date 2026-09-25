import { z } from 'zod';
import { COMPRA_STATUSES } from '@/features/compras/types/compra.types';
import { LOT_CLASSIFICATIONS, MOVEMENT_TYPES } from '@/features/inventory/types/inventory.types';

export const reportPaths = {
  stock: 'stock',
  movements: 'inventory-movements',
  purchases: 'purchases',
  works: 'production-works',
  transformations: 'transformations',
  traceability: 'traceability',
} as const;
export type ReportKind = keyof typeof reportPaths;

const optionalId = z.union([z.literal(''), z.string().uuid()]).optional();
const optionalDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha YYYY-MM-DD.').refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Fecha inválida.')]).optional();
const range = { from: optionalDate, to: optionalDate };
const dateRange = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).refine(v => !('from' in v && 'to' in v) || !v.from || !v.to || String(v.from) <= String(v.to), {
    path: ['to'], message: 'La fecha fin debe ser igual o posterior a la fecha inicio.',
  });

export const reportSchemas = {
  stock: z.object({ warehouseId: optionalId, articuloId: optionalId, classification: z.union([z.literal(''), z.enum(LOT_CLASSIFICATIONS)]).optional() }),
  movements: dateRange({ ...range, warehouseId: optionalId, articuloId: optionalId, movementType: z.union([z.literal(''), z.enum(MOVEMENT_TYPES)]).optional() }),
  purchases: dateRange({ ...range, status: z.union([z.literal(''), z.enum(COMPRA_STATUSES)]).optional(), supplier: z.string().trim().max(200).optional(), articuloId: optionalId }),
  works: dateRange({ ...range, productionOrderId: optionalId, transformationOrderId: optionalId, workTypeId: optionalId, productionBatchId: optionalId, containerId: optionalId }),
  transformations: dateRange({ ...range, productionOrderId: optionalId, transformationOrderId: optionalId, productionBatchId: optionalId }),
  traceability: z.object({ productionBatchId: z.string({ required_error: 'Selecciona un batch para descargar la trazabilidad.' }).uuid('Selecciona un batch para descargar la trazabilidad.') }),
} as const;

export type ReportFilters = Record<string, string>;
export function validateReport(kind: ReportKind, filters: ReportFilters): { values?: Record<string, string>; errors: Record<string, string> } {
  const parsed = reportSchemas[kind].safeParse(filters);
  if (!parsed.success) {
    return { errors: Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])) };
  }
  return { values: Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== '' && value !== undefined)), errors: {} };
}