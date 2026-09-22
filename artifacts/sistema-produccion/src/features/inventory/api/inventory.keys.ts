import type { MovementListFilters, StockFilters, WarehouseListFilters } from '../types/inventory.types';
export const inventoryKeys = {
  all: ['inventory'] as const,
  warehouses: () => [...inventoryKeys.all, 'warehouses'] as const,
  warehouseLists: () => [...inventoryKeys.warehouses(), 'list'] as const,
  warehouseList: (filters: WarehouseListFilters = {}) => [...inventoryKeys.warehouseLists(), filters] as const,
  activeWarehouses: () => [...inventoryKeys.warehouses(), 'active'] as const,
  warehouse: (id: string) => [...inventoryKeys.warehouses(), 'detail', id] as const,
  stock: () => [...inventoryKeys.all, 'stock'] as const,
  stockValue: (filters: StockFilters) => [...inventoryKeys.stock(), 'value', filters] as const,
  available: () => [...inventoryKeys.all, 'available'] as const,
  availableValue: (filters: StockFilters) => [...inventoryKeys.available(), filters] as const,
  lots: () => [...inventoryKeys.all, 'lots'] as const,
  lot: (id: string) => [...inventoryKeys.lots(), id] as const,
  movements: () => [...inventoryKeys.all, 'movements'] as const,
  movementList: (filters: MovementListFilters) => [...inventoryKeys.movements(), filters.articuloId, filters] as const,
};