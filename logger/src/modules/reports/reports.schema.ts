import { z } from "zod";

export const reportOptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
}).strict();

const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO date YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, "Date must be a valid calendar date");
const dateRange = {
  from: dateOnly.optional(),
  to: dateOnly.optional(),
};
const chronological = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.strict().superRefine((filters, context) => {
    const range = filters as { from?: string | undefined; to?: string | undefined };
    if (range.from && range.to && range.from > range.to) {
      context.addIssue({
        code: "custom",
        message: "from must be earlier than or equal to to",
        path: ["from"],
      });
    }
  });

export const stockQuerySchema = z.object({
  warehouseId: uuid.optional(),
  articuloId: uuid.optional(),
  classification: z.enum([
    "PRODUCTO_ENVASADO",
    "PRODUCTO_TERMINADO",
    "PRODUCTO_TERMINADO_EXPORTACION",
  ]).optional(),
}).strict();

export const inventoryMovementsQuerySchema = chronological(z.object({
  ...dateRange,
  warehouseId: uuid.optional(),
  articuloId: uuid.optional(),
  movementType: z.enum(["INBOUND", "OUTBOUND", "TRANSFER", "ADJUSTMENT"]).optional(),
}));

export const purchasesQuerySchema = chronological(z.object({
  ...dateRange,
  status: z.enum(["REGISTERED", "RECEIVED", "CANCELLED"]).optional(),
  supplier: z.string().trim().min(1).max(200).optional(),
  articuloId: uuid.optional(),
}));

export const productionWorksQuerySchema = chronological(z.object({
  ...dateRange,
  productionOrderId: uuid.optional(),
  transformationOrderId: uuid.optional(),
  workTypeId: uuid.optional(),
  productionBatchId: uuid.optional(),
  containerId: uuid.optional(),
}));

export const transformationsQuerySchema = chronological(z.object({
  ...dateRange,
  productionOrderId: uuid.optional(),
  transformationOrderId: uuid.optional(),
  productionBatchId: uuid.optional(),
}));

export const traceabilityQuerySchema = z.object({
  productionBatchId: uuid,
}).strict();

export function reportDateRange(filters: { from?: string | undefined; to?: string | undefined }) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined;
  const toExclusive = filters.to
    ? new Date(new Date(`${filters.to}T00:00:00.000Z`).valueOf() + 86_400_000)
    : undefined;
  return {
    ...(from ? { from } : {}),
    ...(toExclusive ? { toExclusive } : {}),
  };
}