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