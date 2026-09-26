import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCorrectGrapeReception,
  useCreateProductionWork,
  useCorrectProductionWork,
  useCreateProductionMeasurement,
  useCorrectProductionMeasurement,
  useCreateTransformation,
  useUpsertCustomFieldValue,
  useReleaseBatchToInventory,
  useReverseBatchRelease,
} from './production.hooks';
import * as api from './production.api';
import React from 'react';

vi.mock('./production.api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
  correctGrapeReception: vi.fn(),
  createProductionWork: vi.fn(),
  correctProductionWork: vi.fn(),
  createProductionMeasurement: vi.fn(),
  correctProductionMeasurement: vi.fn(),
  createTransformation: vi.fn(),
  upsertCustomFieldValue: vi.fn(),
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

  async function expectInvalidation(hook: () => any, apiMutation: { mockResolvedValueOnce: (value: any) => unknown }, input: any, result: any, key: readonly unknown[]) {
    apiMutation.mockResolvedValueOnce(result);
    const { result: hookResult } = renderHook(hook, { wrapper });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    hookResult.current.mutate(input);
    await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: key }));
    return invalidateSpy;
  }

  it('invalidates reception lists, detail, and all batch traces after a reception correction', async () => {
    const invalidateSpy = await expectInvalidation(
      () => useCorrectGrapeReception(),
      vi.mocked(api.correctGrapeReception),
      { id: 'R-1', input: { field: 'observations', newValue: 'fixed', reason: 'correction' } },
      { id: 'R-1' },
      ['production', 'trace'],
    );
    const keys = invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(['production', 'receptions', 'list']);
    expect(keys).toContainEqual(['production', 'receptions', 'detail', 'R-1']);
  });

  it('invalidates batch traces after work creation and correction', async () => {
    await expectInvalidation(
      () => useCreateProductionWork(),
      vi.mocked(api.createProductionWork),
      { productionOrderId: 'O-1', workTypeId: 'WT-1', performedAt: '2024-01-01T00:00:00Z' },
      { id: 'W-1' },
      ['production', 'trace'],
    );
    await expectInvalidation(
      () => useCorrectProductionWork(),
      vi.mocked(api.correctProductionWork),
      { id: 'W-1', input: { field: 'observations', newValue: 'fixed', reason: 'correction' } },
      { id: 'W-1' },
      ['production', 'trace'],
    );
  });

  it('invalidates batch traces after measurement creation and correction', async () => {
    await expectInvalidation(
      () => useCreateProductionMeasurement(),
      vi.mocked(api.createProductionMeasurement),
      { measurementTypeId: 'MT-1', productionBatchId: 'B-1', value: '1', unit: 'L', measuredAt: '2024-01-01T00:00:00Z' },
      { id: 'M-1' },
      ['production', 'trace'],
    );
    await expectInvalidation(
      () => useCorrectProductionMeasurement(),
      vi.mocked(api.correctProductionMeasurement),
      { id: 'M-1', input: { field: 'value', newValue: '2', reason: 'correction', operationKey: 'op-1' } },
      { id: 'M-1' },
      ['production', 'trace'],
    );
  });

  it('invalidates traces for every input and output batch after a transformation', async () => {
    const invalidateSpy = await expectInvalidation(
      () => useCreateTransformation(),
      vi.mocked(api.createTransformation),
      { inputs: [{ productionBatchId: 'B-IN', quantity: '1' }] },
      { id: 'T-1', outputs: [{ productionBatchId: 'B-OUT' }] },
      ['production', 'trace', 'B-IN'],
    );
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['production', 'trace', 'B-OUT'] }));
  });

  it('invalidates the custom-field values key after upsert', async () => {
    const invalidateSpy = await expectInvalidation(
      () => useUpsertCustomFieldValue(),
      vi.mocked(api.upsertCustomFieldValue),
      { definitionId: 'CF-1', entityType: 'GRAPE_RECEPTION', entityId: 'R-1', value: 'value' },
      { id: 'CFV-1' },
      ['production', 'customFields', 'values'],
    );
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['production', 'receptions', 'detail', 'R-1'] }));
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
