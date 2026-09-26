import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCancelCompra, useReceiveCompra, useUpdateCompra } from './compras.hooks';
import * as api from './compras.api';
import type { Compra } from '../types/compra.types';

vi.mock('./compras.api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    cancelCompra: vi.fn(),
    receiveCompra: vi.fn(),
    updateCompra: vi.fn(),
  };
});

describe('compras.hooks inventory invalidation', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;
  const compra: Compra = {
    id: 'COMPRA-1',
    supplierName: 'Proveedor',
    supplierTaxId: null,
    documentNumber: null,
    documentDate: null,
    currency: null,
    observations: null,
    status: 'RECEIVED',
    createdByUserId: 'USER-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    items: [
      {
        id: 'ITEM-1',
        compraId: 'COMPRA-1',
        articuloId: 'ART-1',
        brand: null,
        requestedQuantity: '10',
        unit: 'KG',
        unitPrice: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'ITEM-2',
        compraId: 'COMPRA-1',
        articuloId: 'ART-2',
        brand: null,
        requestedQuantity: '5',
        unit: 'KG',
        unitPrice: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  });

  it('invalidates relevant stock, available, movement, and lot queries after receiving', async () => {
    vi.mocked(api.receiveCompra).mockResolvedValueOnce(compra);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onSuccess = vi.fn(async () => {
      expect(invalidateSpy).toHaveBeenCalled();
    });
    const { result } = renderHook(() => useReceiveCompra({ onSuccess }), { wrapper });

    result.current.mutate({
      id: compra.id,
      input: {
        warehouseId: 'WH-1',
        items: [{ compraItemId: 'ITEM-1', inventoryLotId: 'LOT-1' }],
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const predicateCalls = invalidateSpy.mock.calls.filter(([filters]) => typeof filters?.predicate === 'function');
    expect(predicateCalls).toHaveLength(2);
    const [stockPredicate, movementPredicate] = predicateCalls.map(([filters]) => filters!.predicate!);

    expect(stockPredicate({ queryKey: ['inventory', 'stock', 'value', { warehouseId: 'WH-1', articuloId: 'ART-1' }] } as never)).toBe(true);
    expect(stockPredicate({ queryKey: ['inventory', 'available', { warehouseId: 'WH-1', articuloId: 'ART-1', inventoryLotId: 'LOT-1' }] } as never)).toBe(true);
    expect(stockPredicate({ queryKey: ['inventory', 'stock', 'value', { warehouseId: 'WH-2', articuloId: 'ART-1' }] } as never)).toBe(false);
    expect(stockPredicate({ queryKey: ['inventory', 'stock', 'value', { warehouseId: 'WH-1', articuloId: 'ART-1', inventoryLotId: 'LOT-2' }] } as never)).toBe(false);
    expect(stockPredicate({ queryKey: ['inventory', 'stock', 'value', { warehouseId: 'WH-1', articuloId: 'ART-2' }] } as never)).toBe(false);

    expect(movementPredicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-1', inventoryLotId: 'LOT-1', type: 'INBOUND' }] } as never)).toBe(true);
    expect(movementPredicate({ queryKey: ['inventory', 'movements', 'ART-1', { type: 'INBOUND' }] } as never)).toBe(true);
    expect(movementPredicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-2' }] } as never)).toBe(false);
    expect(movementPredicate({ queryKey: ['inventory', 'movements', 'ART-1', { type: 'OUTBOUND' }] } as never)).toBe(false);
    expect(movementPredicate({ queryKey: ['inventory', 'movements', 'ART-1', { inventoryLotId: 'LOT-2' }] } as never)).toBe(false);
    expect(movementPredicate({ queryKey: ['inventory', 'movements', 'ART-2', {}] } as never)).toBe(false);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory', 'lots'] });
    const lastInvalidationOrder = invalidateSpy.mock.invocationCallOrder[invalidateSpy.mock.calls.length - 1]!;
    expect(onSuccess.mock.invocationCallOrder[0]!).toBeGreaterThan(lastInvalidationOrder);
  });

  it.each(['update', 'cancel'] as const)('%s does not invalidate inventory', async (operation) => {
    if (operation === 'update') vi.mocked(api.updateCompra).mockResolvedValueOnce(compra);
    else vi.mocked(api.cancelCompra).mockResolvedValueOnce(compra);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => operation === 'update' ? useUpdateCompra() : useCancelCompra(),
      { wrapper },
    );

    if (operation === 'update') {
      (result.current as ReturnType<typeof useUpdateCompra>).mutate({ id: compra.id, input: { observations: 'Ajuste' } });
    } else {
      (result.current as ReturnType<typeof useCancelCompra>).mutate({ id: compra.id, input: { reason: 'Cancelación' } });
    }

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy.mock.calls.some(([filters]) =>
      filters?.queryKey?.[0] === 'inventory' || typeof filters?.predicate === 'function'
    )).toBe(false);
  });
});