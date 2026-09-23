import type { ComprasListFilters } from '../types/compra.types';

export const comprasKeys = {
  all: ['compras'] as const,
  lists: () => [...comprasKeys.all, 'list'] as const,
  list: (filters: ComprasListFilters = {}) => [...comprasKeys.lists(), filters] as const,
  details: () => [...comprasKeys.all, 'detail'] as const,
  detail: (id: string) => [...comprasKeys.details(), id] as const,
};