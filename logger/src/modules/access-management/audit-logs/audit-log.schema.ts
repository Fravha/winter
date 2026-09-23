import { z } from "zod";

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .optional();

export const auditLogQuerySchema = z
  .object({
    actorUserId: z.string().uuid().optional(),
    action: z.string().trim().min(1).optional(),
    resourceType: z.string().trim().min(1).optional(),
    resourceId: z.string().trim().min(1).optional(),
    from: optionalDate,
    to: optionalDate,
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "from must be earlier than or equal to to",
    path: ["from"],
  });