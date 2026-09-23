import { z } from 'zod';

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

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