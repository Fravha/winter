import { request } from '@/lib/api/request';

export type ActiveWarehouse = {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion: string | null;
  encargadoUserId: string | null;
  activo: boolean;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getActiveWarehouses(signal?: AbortSignal): Promise<ActiveWarehouse[]> {
  const response = await request<{ data: ActiveWarehouse[] }>('inventory/warehouses?page=1&pageSize=100', { signal });
  return response.data.filter((warehouse) => warehouse.activo);
}