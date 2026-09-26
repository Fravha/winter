import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseBatchToInventory, reverseBatchRelease } from './production.api';
import * as client from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  getApiUrl: (path: string) => `http://localhost/${path}`,
  getAuthToken: vi.fn().mockResolvedValue('fake-token'),
}));

describe('production.api - P5.5D Transport Tests (Real Fetch)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('releaseBatchToInventory uses real request, stringifies once without requestHash', async () => {
    const mockResponseEnvelope = { data: { releaseId: 'r-1' } };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponseEnvelope,
    } as unknown as Response);

    const input = {
      quantity: '100',
      warehouseId: 'w-1',
      operationKey: 'op-1',
      lotCode: 'L-1',
      classification: 'PRODUCTO_ENVASADO' as const,
      fechaIngreso: '2023-10-01T00:00:00Z'
    };

    const result = await releaseBatchToInventory('b-1', input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchArgs = fetchMock.mock.calls[0];
    expect(fetchArgs[0]).toBe('http://localhost/production/batches/b-1/release-to-inventory');

    const requestInit = fetchArgs[1];
    expect(requestInit.method).toBe('POST');

    const bodyStr = requestInit.body as string;
    expect(typeof bodyStr).toBe('string');

    // Parse once
    const parsed = JSON.parse(bodyStr);
    expect(typeof parsed).toBe('object');
    expect(parsed).toEqual(input);
    expect(parsed).not.toHaveProperty('requestHash');

    // Assert parsing twice fails or yields a non-object (proves it wasn't doubly stringified)
    expect(() => {
      const doubleParsed = JSON.parse(parsed);
      // if parsed was already an object, JSON.parse(object) throws SyntaxError or returns something weird depending on JS, usually throws because it toString()s to "[object Object]"
    }).toThrow();

    expect(result).toEqual(mockResponseEnvelope);
  });

  it('reverseBatchRelease uses real request, stringifies once without requestHash', async () => {
    const mockResponseEnvelope = {
      data: {
        releaseId: 'r-1',
        reversalOperationKey: 'op-2',
        inventoryMovementId: 'mov-1',
        remainingProductionQuantity: '50'
      }
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponseEnvelope,
    } as unknown as Response);

    const input = {
      operationKey: 'op-2',
      reason: 'Error'
    };

    const result = await reverseBatchRelease('b-1', 'r-1', input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchArgs = fetchMock.mock.calls[0];
    expect(fetchArgs[0]).toBe('http://localhost/production/batches/b-1/releases/r-1/reverse');

    const requestInit = fetchArgs[1];
    expect(requestInit.method).toBe('POST');

    const bodyStr = requestInit.body as string;
    expect(typeof bodyStr).toBe('string');

    const parsed = JSON.parse(bodyStr);
    expect(typeof parsed).toBe('object');
    expect(parsed).toEqual(input);
    expect(parsed).not.toHaveProperty('requestHash');

    expect(() => JSON.parse(parsed)).toThrow();

    expect(result).toEqual(mockResponseEnvelope);
  });
});
