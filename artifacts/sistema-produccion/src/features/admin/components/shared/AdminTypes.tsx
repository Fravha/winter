import { type ReactNode } from 'react';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface PermissionAdmin {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface RoleAdmin {
  id: string;
  code: string;
  name: string;
  description?: string;
  permissions?: PermissionAdmin[];
}

export interface UserAdmin {
  id: string;
  email: string;
  displayName?: string;
  status: UserStatus;
  lastLoginAt?: string;
  role: RoleAdmin | null;
}
