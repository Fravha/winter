import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/api-error';
import { getActiveWarehouses, type ActiveWarehouse } from './inventory.api';

export const inventoryWarehousesKeys = {
  all: ['inventory', 'warehouses'] as const,
  active: () => [...inventoryWarehousesKeys.all, 'active'] as const,
};

const retryQuery = (count: number, error: Error) => count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500);
export function useActiveWarehouses(options?: Omit<UseQueryOptions<ActiveWarehouse[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    ...options,
    queryKey: inventoryWarehousesKeys.active(),
    queryFn: ({ signal }) => getActiveWarehouses(signal),
    staleTime: options?.staleTime ?? 30_000,
    retry: options?.retry ?? retryQuery,
  });
}