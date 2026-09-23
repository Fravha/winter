import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReleaseBatchToInventory, useReverseBatchRelease } from './production.hooks';
import * as api from './production.api';
import React from 'react';

vi.mock('./production.api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
  releaseBatchToInventory: vi.fn(),
  reverseBatchRelease: vi.fn(),
  };
});

describe('production.hooks - Cache Invalidation', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  });

  it('useReleaseBatchToInventory invalidates only relevant movement lists', async () => {
    vi.mocked(api.releaseBatchToInventory).mockResolvedValueOnce({
      data: {
        warehouseId: 'WH-1',
        inventoryLotId: 'LOT-1',
      }
    } as any);

    const { result } = renderHook(() => useReleaseBatchToInventory(), { wrapper });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate({
      batchId: 'B-1',
      input: {} as any,
      context: { articuloId: 'ART-1' }
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Find the predicate call for movements
    const movementCall = invalidateSpy.mock.calls.find(call =>
      call[0] && typeof (call[0] as any).predicate === 'function' &&
      !(call[0] as any).queryKey // to distinguish from exact queryKey calls if any
    );

    expect(movementCall).toBeDefined();
    const predicate = (movementCall![0] as any).predicate;

    // Matching article, no filters
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', undefined] })).toBe(true);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', {}] })).toBe(true);

    // Matching article, matching filters
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-1' }] })).toBe(true);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { inventoryLotId: 'LOT-1' }] })).toBe(true);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-1', inventoryLotId: 'LOT-1', type: 'INBOUND', page: 2 }] })).toBe(true);

    // Unrelated article
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-2', undefined] })).toBe(false);

    // Matching article, conflicting filters
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-2' }] })).toBe(false);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { inventoryLotId: 'LOT-2' }] })).toBe(false);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { type: 'OUTBOUND' }] })).toBe(false);
  });

  it('useReverseBatchRelease invalidates only relevant movement lists', async () => {
    vi.mocked(api.reverseBatchRelease).mockResolvedValueOnce({} as any);

    const { result } = renderHook(() => useReverseBatchRelease(), { wrapper });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate({
      batchId: 'B-1',
      releaseId: 'R-1',
      input: {} as any,
      context: { warehouseId: 'WH-1', articuloId: 'ART-1', inventoryLotId: 'LOT-1' }
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const movementCall = invalidateSpy.mock.calls.find(call =>
      call[0] && typeof (call[0] as any).predicate === 'function' &&
      !(call[0] as any).queryKey
    );

    expect(movementCall).toBeDefined();
    const predicate = (movementCall![0] as any).predicate;

    // Matching article, no filters
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', undefined] })).toBe(true);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', {}] })).toBe(true);

    // Matching article, matching filters
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-1' }] })).toBe(true);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { inventoryLotId: 'LOT-1' }] })).toBe(true);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-1', inventoryLotId: 'LOT-1', type: 'OUTBOUND', page: 2 }] })).toBe(true);

    // Unrelated article
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-2', undefined] })).toBe(false);

    // Matching article, conflicting filters
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { warehouseId: 'WH-2' }] })).toBe(false);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { inventoryLotId: 'LOT-2' }] })).toBe(false);
    expect(predicate({ queryKey: ['inventory', 'movements', 'ART-1', { type: 'INBOUND' }] })).toBe(false);
  });
});
