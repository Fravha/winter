import { useMutation, useQuery, useQueryClient, type QueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/api-error';
import { inventoryKeys } from '@/features/inventory/api/inventory.keys';
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
type ReceiveCompraVariables = { id: string; input: ReceiveCompraInput };
function receiveInventoryInvalidations(data: Compra, variables: ReceiveCompraVariables, qc: QueryClient) {
  const requestedItems = variables.input.items;
  const receivedItems = data.items
    .filter((item) => !requestedItems || requestedItems.some((requested) => requested.compraItemId === item.id))
    .map((item) => ({
      articuloId: item.articuloId,
      inventoryLotId: requestedItems?.find((requested) => requested.compraItemId === item.id)?.inventoryLotId,
    }));
  const matchesItem = (articuloId: unknown, inventoryLotId?: unknown) => receivedItems.some((item) =>
    item.articuloId === articuloId && (!inventoryLotId || item.inventoryLotId === inventoryLotId)
  );
  const matchesWarehouseStock = (query: { queryKey: readonly unknown[] }) => {
    const key = query.queryKey;
    if (key[0] !== 'inventory' || (key[1] !== 'stock' && key[1] !== 'available')) return false;
    return key.slice(2).some((part) => {
      if (!part || typeof part !== 'object') return false;
      const filters = part as { warehouseId?: unknown; articuloId?: unknown; inventoryLotId?: unknown };
      return filters.warehouseId === variables.input.warehouseId &&
        matchesItem(filters.articuloId, filters.inventoryLotId);
    });
  };
  const matchesMovement = (query: { queryKey: readonly unknown[] }) => {
    const key = query.queryKey;
    if (key[0] !== 'inventory' || key[1] !== 'movements') return false;
    const filters = key.slice(3).find((part) => part && typeof part === 'object') as
      | { warehouseId?: unknown; inventoryLotId?: unknown; type?: unknown }
      | undefined;
    if (filters?.warehouseId && filters.warehouseId !== variables.input.warehouseId) return false;
    if (filters?.type && filters.type !== 'INBOUND') return false;
    return matchesItem(key[2], filters?.inventoryLotId);
  };

  return [
    qc.invalidateQueries({ predicate: matchesWarehouseStock }),
    qc.invalidateQueries({ predicate: matchesMovement }),
    qc.invalidateQueries({ queryKey: inventoryKeys.lots() }),
  ];
}
function useCompraMutation<V>(
  fn: (v: V) => Promise<Compra>,
  invalidateDetail: (v: V) => string,
  options?: Omit<UseMutationOptions<Compra, Error, V>, 'mutationFn'>,
  invalidateInventory?: (data: Compra, variables: V) => Promise<unknown>[],
) {
  const qc = useQueryClient();
  return useMutation({ ...mutationOptions(fn, options), onSuccess: async (data, vars, ctx, mutationCtx) => { await Promise.all([qc.invalidateQueries({ queryKey: comprasKeys.lists() }), qc.invalidateQueries({ queryKey: comprasKeys.detail(invalidateDetail(vars)) }), ...(invalidateInventory?.(data, vars) ?? [])]); await options?.onSuccess?.(data, vars, ctx, mutationCtx); } });
}
export function useUpdateCompra(options?: Omit<UseMutationOptions<Compra, Error, { id: string; input: UpdateCompraInput }>, 'mutationFn'>) {
  return useCompraMutation(({ id, input }) => updateCompra(id, input), (v) => v.id, options);
}
export function useReceiveCompra(options?: Omit<UseMutationOptions<Compra, Error, { id: string; input: ReceiveCompraInput }>, 'mutationFn'>) {
  const qc = useQueryClient();
  return useCompraMutation(
    ({ id, input }) => receiveCompra(id, input),
    (v) => v.id,
    options,
    (data, variables) => receiveInventoryInvalidations(data, variables, qc),
  );
}
export function useCancelCompra(options?: Omit<UseMutationOptions<Compra, Error, { id: string; input?: CancelCompraInput }>, 'mutationFn'>) {
  return useCompraMutation(({ id, input }) => cancelCompra(id, input), (v) => v.id, options);
}