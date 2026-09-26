import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/api-error';
import { adminApi } from './admin.api';
import { adminKeys } from './admin.keys';
import type { AuditLogListResponse, AuditLogQuery, PermissionAdmin, PermissionInput, PermissionUpdateInput, RoleAdmin, RoleInput, RoleUpdateInput, UserAdmin, UserInput, UserUpdateInput } from '../types';

const retryQuery = (count: number, error: Error) => count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500);
type QueryOptions<T> = Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>;

export function useAuditLogs(filters: AuditLogQuery, options?: QueryOptions<AuditLogListResponse>) {
  return useQuery({
    ...options,
    queryKey: adminKeys.auditLogs.list(filters),
    queryFn: ({ signal }) => adminApi.auditLogs.list(filters, signal),
    retry: options?.retry ?? retryQuery,
    staleTime: options?.staleTime ?? 30_000,
  });
}

export function useUsers(options?: QueryOptions<UserAdmin[]>) {
  return useQuery({ ...options, queryKey: adminKeys.users.all, queryFn: ({ signal }) => adminApi.users.list(signal), retry: options?.retry ?? retryQuery, staleTime: options?.staleTime ?? 30_000 });
}
export function useUser(id: string, options?: QueryOptions<UserAdmin>) {
  return useQuery({ ...options, queryKey: adminKeys.users.detail(id), queryFn: ({ signal }) => adminApi.users.get(id, signal), enabled: Boolean(id) && (options?.enabled ?? true), retry: options?.retry ?? retryQuery, staleTime: options?.staleTime ?? 30_000 });
}
export function useRoles(options?: QueryOptions<RoleAdmin[]>) {
  return useQuery({ ...options, queryKey: adminKeys.roles.all, queryFn: ({ signal }) => adminApi.roles.list(signal), retry: options?.retry ?? retryQuery, staleTime: options?.staleTime ?? 30_000 });
}
export function useRole(id: string, options?: QueryOptions<RoleAdmin>) {
  return useQuery({ ...options, queryKey: adminKeys.roles.detail(id), queryFn: ({ signal }) => adminApi.roles.get(id, signal), enabled: Boolean(id) && (options?.enabled ?? true), retry: options?.retry ?? retryQuery, staleTime: options?.staleTime ?? 30_000 });
}
export function usePermissions(options?: QueryOptions<PermissionAdmin[]>) {
  return useQuery({ ...options, queryKey: adminKeys.permissions.all, queryFn: ({ signal }) => adminApi.permissions.list(signal), retry: options?.retry ?? retryQuery, staleTime: options?.staleTime ?? 30_000 });
}
export function usePermission(id: string, options?: QueryOptions<PermissionAdmin>) {
  return useQuery({ ...options, queryKey: adminKeys.permissions.detail(id), queryFn: ({ signal }) => adminApi.permissions.get(id, signal), enabled: Boolean(id) && (options?.enabled ?? true), retry: options?.retry ?? retryQuery, staleTime: options?.staleTime ?? 30_000 });
}

function useUserMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<UserAdmin | void>,
  options?: Omit<UseMutationOptions<UserAdmin | void, Error, TVariables>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options, mutationFn, retry: false,
    onSuccess: async (data, variables, context, mutationContext) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
      if (typeof variables === 'string') await queryClient.invalidateQueries({ queryKey: adminKeys.users.detail(variables) });
      else if (variables && typeof variables === 'object' && 'id' in variables) await queryClient.invalidateQueries({ queryKey: adminKeys.users.detail(variables.id as string) });
      await options?.onSuccess?.(data, variables, context, mutationContext);
    },
  });
}

export function useCreateUser(options?: Omit<UseMutationOptions<UserAdmin, Error, UserInput>, 'mutationFn'>) {
  const queryClient = useQueryClient();
  return useMutation({ ...options, mutationFn: adminApi.users.create, retry: false, onSuccess: async (data, variables, context, mutationContext) => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
    await options?.onSuccess?.(data, variables, context, mutationContext);
  } });
}
export function useUpdateUser(options?: Omit<UseMutationOptions<UserAdmin, Error, { id: string; input: UserUpdateInput }>, 'mutationFn'>) {
  return useUserMutation(({ id, input }) => adminApi.users.update(id, input), options);
}
export function useActivateUser(options?: Omit<UseMutationOptions<UserAdmin, Error, string>, 'mutationFn'>) { return useUserMutation(adminApi.users.activate, options); }
export function useSuspendUser(options?: Omit<UseMutationOptions<UserAdmin, Error, string>, 'mutationFn'>) { return useUserMutation(adminApi.users.suspend, options); }
export function useSendPasswordSetup(options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>) {
  return useMutation({ ...options, mutationFn: adminApi.users.sendPasswordSetup, retry: false });
}
export function useReplaceUserRole(options?: Omit<UseMutationOptions<void, Error, { id: string; roleId: string }>, 'mutationFn'>) {
  return useUserMutation(({ id, roleId }) => adminApi.users.replaceRole(id, roleId), options);
}

function useRoleMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<RoleAdmin | void>,
  options?: Omit<UseMutationOptions<RoleAdmin | void, Error, TVariables>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation({ ...options, mutationFn, retry: false, onSuccess: async (data, variables, context, mutationContext) => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.roles.all });
    if (typeof variables === 'string') await queryClient.invalidateQueries({ queryKey: adminKeys.roles.detail(variables) });
    else if (variables && typeof variables === 'object' && 'id' in variables) await queryClient.invalidateQueries({ queryKey: adminKeys.roles.detail(variables.id as string) });
    await options?.onSuccess?.(data, variables, context, mutationContext);
  } });
}
export function useCreateRole(options?: Omit<UseMutationOptions<RoleAdmin, Error, RoleInput>, 'mutationFn'>) { return useRoleMutation(adminApi.roles.create, options); }
export function useUpdateRole(options?: Omit<UseMutationOptions<RoleAdmin, Error, { id: string; input: RoleUpdateInput }>, 'mutationFn'>) { return useRoleMutation(({ id, input }) => adminApi.roles.update(id, input), options); }
export function useDeleteRole(options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>) { return useRoleMutation(adminApi.roles.remove, options); }
export function useReplaceRolePermissions(options?: Omit<UseMutationOptions<void, Error, { id: string; permissionIds: string[] }>, 'mutationFn'>) { return useRoleMutation(({ id, permissionIds }) => adminApi.roles.replacePermissions(id, permissionIds), options); }

function usePermissionMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<PermissionAdmin | void>,
  options?: Omit<UseMutationOptions<PermissionAdmin | void, Error, TVariables>, 'mutationFn'>,
  relatedKey?: readonly unknown[],
) {
  const queryClient = useQueryClient();
  return useMutation({ ...options, mutationFn, retry: false, onSuccess: async (data, variables, context, mutationContext) => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.permissions.all });
    if (relatedKey) await queryClient.invalidateQueries({ queryKey: relatedKey });
    if (typeof variables === 'string') await queryClient.invalidateQueries({ queryKey: adminKeys.permissions.detail(variables) });
    else if (variables && typeof variables === 'object' && 'id' in variables) await queryClient.invalidateQueries({ queryKey: adminKeys.permissions.detail(variables.id as string) });
    await options?.onSuccess?.(data, variables, context, mutationContext);
  } });
}
export function useCreatePermission(options?: Omit<UseMutationOptions<PermissionAdmin, Error, PermissionInput>, 'mutationFn'>) { return usePermissionMutation(adminApi.permissions.create, options); }
export function useUpdatePermission(options?: Omit<UseMutationOptions<PermissionAdmin, Error, { id: string; input: PermissionUpdateInput }>, 'mutationFn'>) {
  return usePermissionMutation(({ id, input }) => adminApi.permissions.update(id, input), options, adminKeys.roles.all);
}
export function useDeletePermission(options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>) { return usePermissionMutation(adminApi.permissions.remove, options); }