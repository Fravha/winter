import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api/request';

export const reportOptionPaths = {
  articuloId: 'articles',
  warehouseId: 'warehouses',
  productionOrderId: 'production-orders',
  transformationOrderId: 'transformation-orders',
  productionBatchId: 'batches',
  workTypeId: 'work-types',
  containerId: 'containers',
} as const;
export type OptionField = keyof typeof reportOptionPaths;

type ArticleOption = { id: string; codigo: string; nombre: string; clasificacion: string; unidadMedida: string };
type WarehouseOption = { id: string; codigo: string; nombre: string };
type OrderOption = { id: string; code: string; status: string };
type BatchOption = { id: string; code: string; productionOrderId: string; articuloId: string };
type WorkTypeOption = { id: string; code: string; name: string };
type ContainerOption = { id: string; code: string; name: string; status: string };
export type ReportOption = ArticleOption | WarehouseOption | OrderOption | BatchOption | WorkTypeOption | ContainerOption;
export type ReportOptionsResult = {
  data: ReportOption[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export function optionLabel(option: ReportOption): string {
  if ('codigo' in option) return `${option.codigo} · ${option.nombre}`;
  if ('name' in option) return `${option.code} · ${option.name}`;
  return option.code;
}

export function getReportOptions(field: OptionField, { page, search }: { page: number; search: string }, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search.trim()) params.set('search', search.trim());
  return request<ReportOptionsResult>(`reports/options/${reportOptionPaths[field]}?${params}`, { signal });
}

export function useReportOptions(field: OptionField, page: number, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'options', field, page, search],
    queryFn: ({ signal }) => getReportOptions(field, { page, search }, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}