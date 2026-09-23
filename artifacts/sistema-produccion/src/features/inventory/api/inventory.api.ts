import { request } from '@/lib/api/request';
import type { AdjustmentInput, ClassifyLotInput, CreateWarehouseInput, IdempotentCommand, InventoryLot, LotClassificationResult, MovementHistoryResponse, MovementInput, MovementListFilters, MovementResult, Stock, StockFilters, TransferInput, TransferResult, UpdateWarehouseInput, Warehouse, WarehouseListFilters } from '../types/inventory.types';
type Envelope<T> = { data: T; meta?: { requestId?: string | null } };
type MovementEnvelope = { data: Omit<MovementHistoryResponse, 'requestId'>; meta?: { requestId?: string | null } };
const json = (body: unknown, idempotencyKey: string) => ({ method: 'POST' as const, body, headers: { 'Idempotency-Key': idempotencyKey } });
export async function getWarehouses(filters: WarehouseListFilters = {}, signal?: AbortSignal): Promise<Warehouse[]> { const p = new URLSearchParams(); if (filters.page !== undefined) p.set('page', String(filters.page)); if (filters.pageSize !== undefined) p.set('pageSize', String(filters.pageSize)); const r = await request<Envelope<Warehouse[]>>(`inventory/warehouses${p.toString() ? `?${p}` : ''}`, { signal }); return r.data; }
export async function getAllActiveWarehouses(signal?: AbortSignal): Promise<Warehouse[]> {
  const warehouses: Warehouse[] = [];
  let page = 1;
  while (true) {
    const batch = await getWarehouses({ page, pageSize: 100 }, signal);
    warehouses.push(...batch.filter((warehouse) => warehouse.activo));
    if (batch.length < 100) return warehouses;
    page += 1;
  }
}
export async function getWarehouse(id: string, signal?: AbortSignal): Promise<Warehouse> { return (await request<Envelope<Warehouse>>(`inventory/warehouses/${id}`, { signal })).data; }
export async function createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> { return (await request<Envelope<Warehouse>>('inventory/warehouses', { method: 'POST', body: input })).data; }
export async function updateWarehouse(id: string, input: UpdateWarehouseInput): Promise<Warehouse> { return (await request<Envelope<Warehouse>>(`inventory/warehouses/${id}`, { method: 'PATCH', body: input })).data; }
export async function activateWarehouse(id: string): Promise<Warehouse> { return (await request<Envelope<Warehouse>>(`inventory/warehouses/${id}/activate`, { method: 'POST' })).data; }
export async function deactivateWarehouse(id: string): Promise<Warehouse> { return (await request<Envelope<Warehouse>>(`inventory/warehouses/${id}/deactivate`, { method: 'POST' })).data; }
export async function getStock(filters: StockFilters, signal?: AbortSignal): Promise<Stock> { const p = new URLSearchParams({ warehouseId: filters.warehouseId, articuloId: filters.articuloId }); if (filters.inventoryLotId) p.set('inventoryLotId', filters.inventoryLotId); return (await request<Envelope<Stock>>(`inventory/stock?${p}`, { signal })).data; }
export async function getAvailableStock(filters: StockFilters, signal?: AbortSignal): Promise<Stock> { const p = new URLSearchParams({ warehouseId: filters.warehouseId, articuloId: filters.articuloId }); if (filters.inventoryLotId) p.set('inventoryLotId', filters.inventoryLotId); return (await request<Envelope<Stock>>(`inventory/stock/available?${p}`, { signal })).data; }
export async function getMovements(filters: MovementListFilters, signal?: AbortSignal): Promise<MovementHistoryResponse> {
  const p = new URLSearchParams({ articuloId: filters.articuloId });
  if (filters.warehouseId) p.set('warehouseId', filters.warehouseId);
  if (filters.inventoryLotId) p.set('inventoryLotId', filters.inventoryLotId);
  if (filters.type) p.set('type', filters.type);
  if (filters.page !== undefined) p.set('page', String(filters.page));
  if (filters.pageSize !== undefined) p.set('pageSize', String(filters.pageSize));
  const response = await request<MovementEnvelope>(`inventory/movements?${p}`, { signal });
  return { ...response.data, requestId: response.meta?.requestId ?? null };
}
export async function getLot(id: string, signal?: AbortSignal): Promise<InventoryLot> { return (await request<Envelope<InventoryLot>>(`inventory/lots/${id}`, { signal })).data; }
export async function classifyLot(id: string, command: IdempotentCommand<ClassifyLotInput>): Promise<LotClassificationResult> { return (await request<Envelope<LotClassificationResult>>(`inventory/lots/${id}/classification`, json(command.input, command.idempotencyKey))).data; }
export async function registerInbound(command: IdempotentCommand<MovementInput>): Promise<MovementResult> { return (await request<Envelope<MovementResult>>('inventory/inbound', json(command.input, command.idempotencyKey))).data; }
export async function registerOutbound(command: IdempotentCommand<MovementInput>): Promise<MovementResult> { return (await request<Envelope<MovementResult>>('inventory/outbound', json(command.input, command.idempotencyKey))).data; }
export async function transferStock(command: IdempotentCommand<TransferInput>): Promise<TransferResult> { return (await request<Envelope<TransferResult>>('inventory/transfer', json(command.input, command.idempotencyKey))).data; }
export async function adjustStock(command: IdempotentCommand<AdjustmentInput>): Promise<MovementResult> { return (await request<Envelope<MovementResult>>('inventory/adjustment', json(command.input, command.idempotencyKey))).data; }