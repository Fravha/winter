import { request } from '@/lib/api/request';
import type { CancelCompraInput, Compra, ComprasListFilters, ComprasListResponse, CreateCompraInput, ReceiveCompraInput, UpdateCompraInput } from '../types/compra.types';

type DataResponse<T> = { data: T };

export async function getCompras(filters: ComprasListFilters = {}, signal?: AbortSignal): Promise<ComprasListResponse> {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.status !== undefined) params.set('status', filters.status);
  const query = params.toString();
  const response = await request<{ data: Compra[]; meta: ComprasListResponse['meta'] }>(`compras${query ? `?${query}` : ''}`, { signal });
  return { items: response.data, meta: response.meta };
}

export async function getCompra(id: string, signal?: AbortSignal): Promise<Compra> {
  return (await request<DataResponse<Compra>>(`compras/${id}`, { signal })).data;
}
export async function createCompra(input: CreateCompraInput): Promise<Compra> {
  return (await request<DataResponse<Compra>>('compras', { method: 'POST', body: input })).data;
}
export async function updateCompra(id: string, input: UpdateCompraInput): Promise<Compra> {
  return (await request<DataResponse<Compra>>(`compras/${id}`, { method: 'PATCH', body: input })).data;
}
export async function receiveCompra(id: string, input: ReceiveCompraInput): Promise<Compra> {
  return (await request<DataResponse<Compra>>(`compras/${id}/receive`, { method: 'POST', body: input })).data;
}
export async function cancelCompra(id: string, input: CancelCompraInput = {}): Promise<Compra> {
  return (await request<DataResponse<Compra>>(`compras/${id}/cancel`, { method: 'POST', body: input })).data;
}