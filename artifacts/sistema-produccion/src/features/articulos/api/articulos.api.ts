import { request } from '@/lib/api/request';
import type {
  Articulo,
  ArticulosListFilters,
  ArticulosListResponse,
  CreateArticuloInput,
  UpdateArticuloInput,
} from '../types/articulo.types';

type DataResponse<T> = { data: T };

export async function getArticulos(
  filters: ArticulosListFilters = {},
  signal?: AbortSignal,
): Promise<ArticulosListResponse> {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.clasificacion !== undefined) params.set('clasificacion', filters.clasificacion);
  if (filters.activo !== undefined) params.set('activo', String(filters.activo));
  const query = params.toString();
  const response = await request<{ data: Articulo[]; meta: ArticulosListResponse['meta'] }>(
    `articulos${query ? `?${query}` : ''}`,
    { signal },
  );
  return { items: response.data, meta: response.meta };
}

export async function getArticulo(id: string, signal?: AbortSignal): Promise<Articulo> {
  const response = await request<DataResponse<Articulo>>(`articulos/${id}`, { signal });
  return response.data;
}

export async function createArticulo(input: CreateArticuloInput): Promise<Articulo> {
  const response = await request<DataResponse<Articulo>>('articulos', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

export async function updateArticulo(id: string, input: UpdateArticuloInput): Promise<Articulo> {
  const response = await request<DataResponse<Articulo>>(`articulos/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return response.data;
}

export async function activateArticulo(id: string): Promise<Articulo> {
  const response = await request<DataResponse<Articulo>>(`articulos/${id}/activate`, {
    method: 'POST',
  });
  return response.data;
}

export async function deactivateArticulo(id: string): Promise<Articulo> {
  const response = await request<DataResponse<Articulo>>(`articulos/${id}/deactivate`, {
    method: 'POST',
  });
  return response.data;
}
