import { z } from 'zod';

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const auditLogQuerySchema = z.object({
  actorUserId: z.string().uuid().optional(),
  action: z.string().trim().min(1).optional(),
  resourceType: z.string().trim().min(1).optional(),
  resourceId: z.string().trim().min(1).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  path: ['from'],
  message: 'La fecha inicial no puede ser posterior a la final.',
});

export const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  roleId: z.string().uuid(),
  displayName: nonEmpty(150).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  displayName: z.union([nonEmpty(150), z.null()]).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const createRoleSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9:_-]*$/).min(2).max(80),
  name: nonEmpty(150),
  description: z.string().max(500).optional(),
});

export const updateRoleSchema = z.object({
  name: nonEmpty(150).optional(),
  description: z.union([z.string().max(500), z.null()]).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const createPermissionSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9:_-]+$/).min(1).max(100),
  name: nonEmpty(150),
  description: z.string().max(500).nullable().optional(),
});

export const updatePermissionSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9:_-]+$/).min(1).max(100).optional(),
  name: nonEmpty(150).optional(),
  description: z.union([z.string().max(500), z.null()]).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const replaceRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()).max(500),
});