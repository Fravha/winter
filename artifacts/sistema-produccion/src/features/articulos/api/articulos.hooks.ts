import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  activateArticulo,
  createArticulo,
  deactivateArticulo,
  getArticulo,
  getArticulos,
  updateArticulo,
} from './articulos.api';
import { articulosKeys } from './articulos.keys';
import type {
  Articulo,
  ArticulosListFilters,
  ArticulosListResponse,
  CreateArticuloInput,
  UpdateArticuloInput,
} from '../types/articulo.types';
import { ApiError } from '@/lib/api/api-error';

const shouldRetryQuery = (failureCount: number, error: Error) => {
  if (failureCount >= 1) return false;
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
};

export function useArticulos(
  filters: ArticulosListFilters = {},
  options?: Omit<UseQueryOptions<ArticulosListResponse>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    ...options,
    queryKey: articulosKeys.list(filters),
    queryFn: ({ signal }) => getArticulos(filters, signal),
    staleTime: options?.staleTime ?? 30_000,
    retry: options?.retry ?? shouldRetryQuery,
  });
}

export function useArticulo(
  id: string,
  options?: Omit<UseQueryOptions<Articulo>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    ...options,
    queryKey: articulosKeys.detail(id),
    queryFn: ({ signal }) => getArticulo(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30_000,
    retry: options?.retry ?? shouldRetryQuery,
  });
}

export function useCreateArticulo(
  options?: Omit<UseMutationOptions<Articulo, Error, CreateArticuloInput>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: createArticulo,
    retry: false,
    onSuccess: async (data, variables, onMutateResult, mutationContext) => {
      await queryClient.invalidateQueries({ queryKey: articulosKeys.lists() });
      await options?.onSuccess?.(data, variables, onMutateResult, mutationContext);
    },
  });
}

function useArticuloMutation(
  mutationFn: (id: string) => Promise<Articulo>,
  options?: Omit<UseMutationOptions<Articulo, Error, string>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn,
    retry: false,
    onSuccess: async (data, id, onMutateResult, mutationContext) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: articulosKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: articulosKeys.detail(id) }),
      ]);
      await options?.onSuccess?.(data, id, onMutateResult, mutationContext);
    },
  });
}

export function useUpdateArticulo(
  options?: Omit<UseMutationOptions<Articulo, Error, { id: string; input: UpdateArticuloInput }>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: ({ id, input }) => updateArticulo(id, input),
    retry: false,
    onSuccess: async (data, variables, onMutateResult, mutationContext) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: articulosKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: articulosKeys.detail(variables.id) }),
      ]);
      await options?.onSuccess?.(data, variables, onMutateResult, mutationContext);
    },
  });
}

export function useActivateArticulo(
  options?: Omit<UseMutationOptions<Articulo, Error, string>, 'mutationFn'>,
) {
  return useArticuloMutation(activateArticulo, options);
}

export function useDeactivateArticulo(
  options?: Omit<UseMutationOptions<Articulo, Error, string>, 'mutationFn'>,
) {
  return useArticuloMutation(deactivateArticulo, options);
}
