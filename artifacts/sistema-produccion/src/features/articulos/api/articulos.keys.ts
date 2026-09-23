import type { ArticulosListFilters } from '../types/articulo.types';

export const articulosKeys = {
  all: ['articulos'] as const,
  lists: () => [...articulosKeys.all, 'list'] as const,
  list: (filters: ArticulosListFilters = {}) =>
    [...articulosKeys.lists(), filters] as const,
  details: () => [...articulosKeys.all, 'detail'] as const,
  detail: (id: string) => [...articulosKeys.details(), id] as const,
};
