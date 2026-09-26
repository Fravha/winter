import '@testing-library/jest-dom';
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn();
});
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BatchReleaseDialog } from './BatchReleaseDialog';
import { ReverseReleaseDialog } from './ReverseReleaseDialog';
import { ReleaseHistory } from './ReleaseHistory';
import * as hooks from '../../api/production.hooks';
import * as authHooks from '@/auth/AuthContext';

vi.mock('../../api/production.hooks');
vi.mock('@/auth/AuthContext');

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <select
      data-testid="mock-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('BatchReleaseDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authHooks.useAuth as any).mockReturnValue({ can: () => true });
    (hooks.useInventoryReleaseWarehouses as any).mockReturnValue({
      data: { data: [{ id: '123e4567-e89b-12d3-a456-426614174000', codigo: 'WH-1', nombre: 'Almacén Central' }] },
      isLoading: false
    });
  });

  it('validates form and requires confirmation', async () => {
    const mutate = vi.fn();
    (hooks.useReleaseBatchToInventory as any).mockReturnValue({
      mutate,
      isPending: false,
      reset: vi.fn()
    });

    render(<BatchReleaseDialog batchId="b-1" articuloId="art-1" articuloName="Vino Tinto" unit="L" open={true} onOpenChange={vi.fn()} />, { wrapper });

    // Try submit empty
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: '123e4567-e89b-12d3-a456-426614174000' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);
    expect(await screen.findByText(/Cantidad inválida/)).toBeTruthy();

    // Reject 14 integer digits
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '12345678901234' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);
    expect(await screen.findByText(/Cantidad inválida/)).toBeTruthy();

    // Reject 4 decimal digits
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '10.1234' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);
    expect(await screen.findByText(/Cantidad inválida/)).toBeTruthy();

    // Fill correctly
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Código de Lote/i), { target: { value: 'L-2023' } });

    // Select warehouse

    // Submit form -> goes to confirm step
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: '123e4567-e89b-12d3-a456-426614174000' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);

    // Confirm summary
    expect(await screen.findByText(/La existencia se transferirá/)).toBeTruthy();
    expect(screen.getByText('Vino Tinto')).toBeTruthy();
    expect(screen.getByText('100 L')).toBeTruthy();

    // Final submit
    fireEvent.click(await screen.findByText('Confirmar Envío'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
      const args = mutate.mock.calls[0][0];
      expect(args.batchId).toBe('b-1');
      expect(args.input.quantity).toBe('100');
      expect(args.input.warehouseId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(args.input.lotCode).toBe('L-2023');
      expect(args.input.classification).toBe('PRODUCTO_ENVASADO');
      expect(args.input.operationKey).toBeTruthy();
      expect(args.input).not.toHaveProperty('requestHash');
    });
  });

  it('preserves operationKey on error, prevents double submit', async () => {
    let callCount = 0;
    const mutate = vi.fn((params, options) => {
      callCount++;
      if (callCount === 1) {
        options.onError?.(new Error('Network Error'));
      }
    });

    (hooks.useReleaseBatchToInventory as any).mockReturnValue({
      mutate,
      isPending: false,
      error: new Error('No se pudo conectar con el servidor.'),
      reset: vi.fn()
    });

    const { rerender } = render(<BatchReleaseDialog batchId="b-1" articuloId="art-1" articuloName="Vino Tinto" unit="L" open={true} onOpenChange={vi.fn()} />, { wrapper });

    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Código de Lote/i), { target: { value: 'L-2023' } });
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: '123e4567-e89b-12d3-a456-426614174000' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);

    await screen.findByText(/La existencia se transferirá/);

    const confirmBtn = await screen.findByText('Confirmar Envío');
    fireEvent.click(confirmBtn); // First attempt

    // Change pending state to simulate loading -> double submit disabled
    (hooks.useReleaseBatchToInventory as any).mockReturnValue({
      mutate,
      isPending: true,
      error: null,
      reset: vi.fn()
    });
    rerender(<BatchReleaseDialog batchId="b-1" articuloId="art-1" articuloName="Vino Tinto" unit="L" open={true} onOpenChange={vi.fn()} />);

    expect(screen.getAllByText('Confirmar Envío')[0]).toHaveProperty('disabled', true);

    // Now error state
    (hooks.useReleaseBatchToInventory as any).mockReturnValue({
      mutate,
      isPending: false,
      reset: vi.fn()
    });
    rerender(<BatchReleaseDialog batchId="b-1" articuloId="art-1" articuloName="Vino Tinto" unit="L" open={true} onOpenChange={vi.fn()} />);

    expect(screen.getAllByRole('alert')[0]).toBeTruthy();

    // Retry submit
    fireEvent.click(await screen.findByText('Confirmar Envío'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2);
      // Ensure operationKey is exactly the same on retry
      expect(mutate.mock.calls[0][0].input.operationKey).toBe(mutate.mock.calls[1][0].input.operationKey);
    });
  });
  it('generates a new operationKey if payload changes after error', async () => {
    let callCount = 0;
    const mutate = vi.fn((params, options) => {
      callCount++;
      if (callCount === 1) {
        options.onError?.(new Error('Network Error'));
      }
    });

    (hooks.useReleaseBatchToInventory as any).mockReturnValue({
      mutate,
      isPending: false,
      error: new Error('Network error simulated'),
      reset: vi.fn()
    });

    const { rerender } = render(<BatchReleaseDialog batchId="b-1" articuloId="art-1" articuloName="Vino Tinto" unit="L" open={true} onOpenChange={vi.fn()} />, { wrapper });

    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Código de Lote/i), { target: { value: 'L-2023' } });
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: '123e4567-e89b-12d3-a456-426614174000' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);

    const confirmBtn = await screen.findByText('Confirmar Envío');
    fireEvent.click(confirmBtn); // First attempt

    // Now error state, go back
    const backBtn = screen.getAllByText('Atrás')[0];
    fireEvent.click(backBtn);

    // Change payload
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '200' } });
    fireEvent.click(screen.getAllByText('Continuar')[0]);

    // Retry submit
    fireEvent.click(await screen.findByText('Confirmar Envío'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2);
      expect(mutate.mock.calls[0][0].input.operationKey).not.toBe(mutate.mock.calls[1][0].input.operationKey);
    });
  });

describe('ReverseReleaseDialog', () => {
  const mockRelease = {
    releaseId: 'r-1',
    quantity: '50.000',
    unit: 'L',
    warehouse: { id: '123e4567-e89b-12d3-a456-426614174000', code: 'W', name: 'Almacen' },
    inventoryLot: { id: 'l-1', lotCode: 'L-1', classification: 'PRODUCTO_ENVASADO' },
    status: 'ACTIVE',
    reversible: true,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (authHooks.useAuth as any).mockReturnValue({ can: () => true });
  });

  it('requires reason and submits', async () => {
    const mutate = vi.fn();
    (hooks.useReverseBatchRelease as any).mockReturnValue({
      mutate,
      isPending: false,
      reset: vi.fn()
    });

    render(<ReverseReleaseDialog batchId="b-1" articuloId="art-1" release={mockRelease} open={true} onOpenChange={vi.fn()} />, { wrapper });

    fireEvent.click(screen.getAllByText('Confirmar Reversión')[0]);
    expect(await screen.findByText('Debe especificar un motivo para la reversión')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Error en cantidad' } });
    fireEvent.click(screen.getAllByText('Confirmar Reversión')[0]);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
      const args = mutate.mock.calls[0][0];
      expect(args.batchId).toBe('b-1');
      expect(args.releaseId).toBe('r-1');
      expect(args.input.reason).toBe('Error en cantidad');
      expect(args.input.operationKey).toBeTruthy();
    });
  });
  it('preserves operationKey on retry, regenerates on change', async () => {
    let callCount = 0;
    const mutate = vi.fn((params, options) => {
      callCount++;
      if (callCount === 1) {
        options.onError?.(new Error('Network error'));
      }
    });

    (hooks.useReverseBatchRelease as any).mockReturnValue({
      mutate,
      isPending: false,
      error: new Error('Network error'),
      reset: vi.fn()
    });

    render(<ReverseReleaseDialog batchId="b-1" articuloId="art-1" release={mockRelease} open={true} onOpenChange={vi.fn()} />, { wrapper });

    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Error en cantidad' } });
    fireEvent.click(screen.getAllByText('Confirmar Reversión')[0]);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const firstKey = mutate.mock.calls[0][0].input.operationKey;

    // Same payload retry
    fireEvent.click(screen.getAllByText('Confirmar Reversión')[0]);
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate.mock.calls[1][0].input.operationKey).toBe(firstKey);

    // Changed payload
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Motivo distinto' } });
    fireEvent.click(screen.getAllByText('Confirmar Reversión')[0]);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(3));
    expect(mutate.mock.calls[2][0].input.operationKey).not.toBe(firstKey);
  });
});

describe('ReleaseHistory', () => {
  it('handles error explicitly using mapProductionError', async () => {
    const refetch = vi.fn();
    (hooks.useBatchReleases as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error simulated'),
      refetch
    });

    render(<ReleaseHistory batchId="b-1" articuloId="art-1" />, { wrapper });

    expect(await screen.findByText('Error al cargar el historial')).toBeTruthy();
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeTruthy();

    const retryBtn = screen.getByText('Reintentar');
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (authHooks.useAuth as any).mockReturnValue({ can: () => true });
  });

  it('renders ACTIVE and REVERSED releases, honors reversible flag', async () => {
    (authHooks.useAuth as any).mockReturnValue({ can: () => true }); // canReverse = true

    (hooks.useBatchReleases as any).mockReturnValue({
      data: {
        data: [
          {
            releaseId: 'r-1',
            quantity: '50.000',
            unit: 'L',
            warehouse: { name: 'Almacen A', code: 'A' },
            inventoryLot: { lotCode: 'LOT-A' },
            occurredAt: '2023-10-01T10:00:00Z',
            actorUserId: 'user-1',
            status: 'ACTIVE',
            reversible: true
          },
          {
            releaseId: 'r-2',
            quantity: '20.000',
            unit: 'L',
            warehouse: { name: 'Almacen B', code: 'B' },
            inventoryLot: { lotCode: 'LOT-B' },
            occurredAt: '2023-10-02T10:00:00Z',
            actorUserId: 'user-2',
            status: 'ACTIVE',
            reversible: false // Not reversible
          },
          {
            releaseId: 'r-3',
            quantity: '10.000',
            unit: 'L',
            warehouse: { name: 'Almacen C', code: 'C' },
            inventoryLot: { lotCode: 'LOT-C' },
            occurredAt: '2023-10-03T10:00:00Z',
            actorUserId: 'user-3',
            status: 'REVERSED',
            reversible: false,
            reversal: {
              reason: 'Revertido por error',
              occurredAt: '2023-10-04T10:00:00Z',
              actorUserId: 'user-admin'
            }
          }
        ]
      },
      isLoading: false
    });

    render(<ReleaseHistory batchId="b-1" articuloId="art-1" />, { wrapper });

    expect(screen.getByText('50.000 L')).toBeTruthy();
    expect(screen.getAllByText(/Almacen A/)[0]).toBeTruthy();

    // Only one reverse button because r-1 is reversible=true, r-2 is reversible=false, r-3 is REVERSED
    const reverseBtns = screen.getAllByRole('button', { name: /Revertir Envío/i });
    expect(reverseBtns).toHaveLength(1);

    // Check reversed item details
    expect(screen.getByText('Revertido por error')).toBeTruthy();
    expect(screen.getByText('Revertido')).toBeTruthy();
  });
});


describe('Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not run protected query when unauthorized', () => {
    (authHooks.useAuth as any).mockReturnValue({ can: () => false });
    const useWarehousesSpy = vi.spyOn(hooks, 'useInventoryReleaseWarehouses');
    useWarehousesSpy.mockReturnValue({ data: { data: [] }, isLoading: false } as any);

    render(
      <BatchReleaseDialog
        batchId="b-1"
        articuloName="Vino"
        articuloId="art-1"
        unit="L"
        open={true}
        onOpenChange={vi.fn()}
      />,
      { wrapper }
    );

    expect(useWarehousesSpy).toHaveBeenCalledWith({ enabled: false });
  });
});
});
