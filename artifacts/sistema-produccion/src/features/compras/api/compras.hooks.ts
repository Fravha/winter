import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/api-error';
import { cancelCompra, createCompra, getCompra, getCompras, receiveCompra, updateCompra } from './compras.api';
import { comprasKeys } from './compras.keys';
import type { CancelCompraInput, Compra, ComprasListFilters, ComprasListResponse, CreateCompraInput, ReceiveCompraInput, UpdateCompraInput } from '../types/compra.types';

const retryQuery = (count: number, error: Error) => count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500);
export function useCompras(filters: ComprasListFilters = {}, options?: Omit<UseQueryOptions<ComprasListResponse>, 'queryKey' | 'queryFn'>) {
  return useQuery({ ...options, queryKey: comprasKeys.list(filters), queryFn: ({ signal }) => getCompras(filters, signal), staleTime: options?.staleTime ?? 30_000, retry: options?.retry ?? retryQuery });
}
export function useCompra(id: string, options?: Omit<UseQueryOptions<Compra>, 'queryKey' | 'queryFn'>) {
  return useQuery({ ...options, queryKey: comprasKeys.detail(id), queryFn: ({ signal }) => getCompra(id, signal), enabled: Boolean(id) && (options?.enabled ?? true), staleTime: options?.staleTime ?? 30_000, retry: options?.retry ?? retryQuery });
}
function mutationOptions<T, V>(fn: (v: V) => Promise<T>, options?: Omit<UseMutationOptions<T, Error, V>, 'mutationFn'>) {
  return { ...options, mutationFn: fn, retry: false } as const;
}
export function useCreateCompra(options?: Omit<UseMutationOptions<Compra, Error, CreateCompraInput>, 'mutationFn'>) {
  const qc = useQueryClient();
  return useMutation({ ...mutationOptions(createCompra, options), onSuccess: async (data, vars, ctx, mutationCtx) => { await qc.invalidateQueries({ queryKey: comprasKeys.lists() }); await options?.onSuccess?.(data, vars, ctx, mutationCtx); } });
}
function useCompraMutation<V>(fn: (v: V) => Promise<Compra>, invalidateDetail: (v: V) => string, options?: Omit<UseMutationOptions<Compra, Error, V>, 'mutationFn'>) {
  const qc = useQueryClient();
  return useMutation({ ...mutationOptions(fn, options), onSuccess: async (data, vars, ctx, mutationCtx) => { await options?.onSuccess?.(data, vars, ctx, mutationCtx); await Promise.all([qc.invalidateQueries({ queryKey: comprasKeys.lists() }), qc.invalidateQueries({ queryKey: comprasKeys.detail(invalidateDetail(vars)) })]); } });
}
export function useUpdateCompra(options?: Omit<UseMutationOptions<Compra, Error, { id: string; input: UpdateCompraInput }>, 'mutationFn'>) {
  return useCompraMutation(({ id, input }) => updateCompra(id, input), (v) => v.id, options);
}
export function useReceiveCompra(options?: Omit<UseMutationOptions<Compra, Error, { id: string; input: ReceiveCompraInput }>, 'mutationFn'>) {
  return useCompraMutation(({ id, input }) => receiveCompra(id, input), (v) => v.id, options);
}
export function useCancelCompra(options?: Omit<UseMutationOptions<Compra, Error, { id: string; input?: CancelCompraInput }>, 'mutationFn'>) {
  return useCompraMutation(({ id, input }) => cancelCompra(id, input), (v) => v.id, options);
}