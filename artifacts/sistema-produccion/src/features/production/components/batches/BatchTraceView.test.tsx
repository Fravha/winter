/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { PermissionGuard } from '@/components/shared/PermissionGuard';
import * as AuthContextModule from '@/auth/AuthContext';
import BatchTracePage from '@/pages/produccion/BatchTracePage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchTraceContent } from './BatchTraceView';
import { ProductionBatchTraceDto } from '../../types/production.types';
import { productionKeys } from '../../api/production.keys';
import { BATCH_TRACE_PERMISSION } from '@/pages/produccion/BatchTracePage';

const mockTrace: ProductionBatchTraceDto = {
  rootBatchId: 'b-1',
  batches: [
    {
      id: 'b-0',
      code: 'BAT-000',
      productionOrderId: 'o-1',
      articuloId: 'art-1',
      unit: 'L',
      createdAt: '2023-09-30T10:00:00Z',
      observations: null,
      version: 1,
      article: { id: 'art-1', codigo: 'ART-001', nombre: 'Uva', clasificacion: 'Materia Prima', unidadMedida: 'KG' },
      order: { id: 'o-1', code: 'ORD-001', status: 'OPEN', startDate: '2023-10-01T08:00:00Z', observations: null, closedAt: null },
      balance: { generated: '110', consumed: '10', separated: '0', lost: '0', transferredToInventory: '0', available: '100' }
    },
    {
      id: 'b-1',
      code: 'BAT-001',
      productionOrderId: 'o-1',
      articuloId: 'art-1',
      unit: 'L',
      createdAt: '2023-10-01T10:00:00Z',
      observations: null,
      version: 1,
      article: { id: 'art-1', codigo: 'ART-001', nombre: 'Uva', clasificacion: 'Materia Prima', unidadMedida: 'KG' },
      order: { id: 'o-1', code: 'ORD-001', status: 'OPEN', startDate: '2023-10-01T08:00:00Z', observations: null, closedAt: null },
      balance: { generated: '100', consumed: '0', separated: '0', lost: '0', transferredToInventory: '0', available: '100' }
    },
    {
      id: 'b-2',
      code: 'BAT-002',
      productionOrderId: 'o-1',
      articuloId: 'art-2',
      unit: 'L',
      createdAt: '2023-10-02T10:00:00Z',
      observations: null,
      version: 1,
      article: null,
      order: { id: 'o-1', code: 'ORD-001', status: 'OPEN', startDate: '2023-10-01T08:00:00Z', observations: null, closedAt: null },
      balance: { generated: '90', consumed: '0', separated: '0', lost: '0', transferredToInventory: '0', available: '90' }
    }
  ],
  lineage: [
    { id: 'l-0', parentBatchId: 'b-0', childBatchId: 'b-1', quantity: '100', unit: 'L', operationKey: 'op-0', createdAt: '2023-10-01T09:00:00Z' },
    { id: 'l-1', parentBatchId: 'b-1', childBatchId: 'b-2', quantity: '90', unit: 'L', operationKey: 'op-1', createdAt: '2023-10-02T10:00:00Z' }
  ],
  ledger: [],
  receptions: [
    {
      id: 'rec-1',
      productionOrderId: 'o-1',
      producerId: 'prod-1',
      receivedAt: '2023-10-01T09:00:00Z',
      status: 'ACCEPTED',
      observations: 'All good',
      version: 1,
      items: [
        { id: 'item-1', productionBatchId: 'b-1', grapeVarietyId: 'gv-1', articuloId: 'art-1', quantity: '150', unit: 'KG' }
      ],
      corrections: [
        {
          id: 'corr-1',
          field: 'observations',
          previousValue: 'Bad',
          newValue: 'All good',
          reason: 'Typo',
          correctedAt: '2023-10-01T09:05:00Z',
          actorUserId: 'u-1',
          fromVersion: 1,
          toVersion: 2
        }
      ]
    }
  ],
  works: [
    {
      id: 'w-1',
      productionOrderId: 'o-1',
      transformationOrderId: null,
      workTypeId: 'wt-1',
      performedAt: '2023-10-01T11:00:00Z',
      observations: 'Mixed',
      version: 1,
      workType: { id: 'wt-1', code: 'MIX', name: 'Mezcla' },
      batches: ['b-1'],
      containers: ['c-1'],
      participants: [{ participantId: 'part-1', role: 'Operator' }],
      inputs: [
        {
          id: 'wi-1',
          productionWorkId: 'w-1',
          articuloId: 'art-3',
          article: { id: 'art-3', codigo: 'LEV-1', nombre: 'Levadura XYZ' },
          warehouseId: 'wh-1',
          warehouse: { id: 'wh-1', codigo: 'WH-1', nombre: 'Almacen de Insumos' },
          inventoryLotId: 'lot-1',
          quantity: '5',
          unit: 'KG',
          inventoryMovementId: 'mov-1',
          operationKey: 'op-1',
          status: 'REVERSED',
          reversedAt: '2023-10-01T12:00:00Z',
          reversalInventoryMovementId: 'mov-2',
          reversalOperationKey: 'op-2',
          reversalReason: 'Wrong quantity'
        }
      ],
      corrections: []
    }
  ],
  measurements: [
    {
      id: 'm-1',
      measurementTypeId: 'mt-1',
      value: '12.5',
      unit: '%',
      measuredAt: '2023-10-01T11:30:00Z',
      observations: null,
      productionBatchId: 'b-1',
      productionContainerId: null,
      productionWorkId: null,
      participantId: 'part-1',
      corrections: []
    }
  ],
  transformations: [
    {
      id: 'tf-1',
      productionOrderId: 'o-1',
      transformationOrderId: 'to-1',
      productionWorkId: 'w-1',
      actorUserId: 'u-1',
      operationKey: 'tf-op-1',
      performedAt: '2023-10-01T14:00:00Z',
      observations: 'Transformed',
      inputs: [{ productionBatchId: 'b-1', quantity: '10', unit: 'L' }],
      outputs: [{ productionBatchId: 'b-2', quantity: '9', unit: 'L' }],
      losses: [{ id: 'loss-1', productionBatchId: 'b-1', quantity: '1', unit: 'L', occurredAt: '2023-10-01T14:00:00Z' }]
    }
  ],
  losses: [
    {
      id: 'loss-1',
      productionBatchId: 'b-1',
      quantity: '1',
      unit: 'L',
      occurredAt: '2023-10-01T14:00:00Z',
      observations: 'Spill'
    }
  ],
  containers: [
    {
      id: 'c-1',
      code: 'TANK-01',
      name: 'Tanque 1',
      type: 'TANQUE',
      location: 'Bodega A',
      material: 'Inox',
      capacity: '1000',
      capacityUnit: 'L',
      status: 'OCUPADO',
      observations: null,
      occupancies: [
        { id: 'occ-1', batchId: 'b-1', quantity: '100', unit: 'L', openedAt: '2023-10-01T10:00:00Z', closedAt: null }
      ],
      movements: [
        {
          id: 'cm-1',
          movementType: 'ASSIGNED',
          sourceContainerId: null,
          destinationContainerId: 'c-1',
          sourceBatchId: 'b-1',
          destinationBatchId: null,
          quantity: '100',
          unit: 'L',
          occurredAt: '2023-10-01T10:00:00Z',
          productionWorkId: 'w-1',
          observations: 'Initial fill',
          actorUserId: 'u-1',
          createdAt: '2023-10-01T10:00:00Z'
        }
      ]
    }
  ],
  releases: [],
  inventory: {
    lots: [
      { id: 'lot-1', lotCode: 'LOT-INV-1', articuloId: 'art-3', article: { id: 'art-3', codigo: 'LEV-1', nombre: 'Levadura XYZ' }, classification: 'Insumo', fechaIngreso: '2023-09-01T00:00:00Z', observations: null, originProductionBatchId: null }
    ],
    movements: [
      { id: 'mov-1', type: 'CONSUMPTION', source: 'Production', reason: 'Consumo por orden', articuloId: 'art-3', article: { id: 'art-3', codigo: 'LEV-1', nombre: 'Levadura XYZ' }, warehouseId: 'wh-1', warehouse: { id: 'wh-1', codigo: 'WH-1', nombre: 'Almacen de Insumos' }, destinationWarehouseId: null, destinationWarehouse: null, inventoryLotId: 'lot-1', quantity: '5', unit: 'KG', stockBefore: '10', resultingStock: '5', createdAt: '2023-10-01T11:00:00Z' },
      { id: 'mov-2', type: 'REVERSAL', source: 'Production', reason: 'Reversión por error', articuloId: 'art-3', article: { id: 'art-3', codigo: 'LEV-1', nombre: 'Levadura XYZ' }, warehouseId: 'wh-1', warehouse: { id: 'wh-1', codigo: 'WH-1', nombre: 'Almacen de Insumos' }, destinationWarehouseId: null, destinationWarehouse: null, inventoryLotId: 'lot-1', quantity: '5', unit: 'KG', stockBefore: '5', resultingStock: '10', createdAt: '2023-10-01T12:00:00Z' }
    ],
    stocks: [
      { id: 'st-1', warehouseId: 'wh-1', warehouse: { id: 'wh-1', codigo: 'WH-1', nombre: 'Almacen de Insumos' }, articuloId: 'art-3', article: { id: 'art-3', codigo: 'LEV-1', nombre: 'Levadura XYZ' }, inventoryLotId: 'lot-1', quantity: '10', unit: 'KG' }
    ]
  },
  warnings: ['Batch references missing Articulo art-2']
};

describe('BatchTraceContent', () => {
  it('has correct query key prefix for batchTrace', () => {
    const key = productionKeys.batchTrace('123');
    expect(key[0]).toBe('production');
    expect(key[1]).toBe('trace');
    expect(key[2]).toBe('123');
  });

  describe('Route Guard', () => {
    const renderWithGuard = (can: (p: string) => boolean) => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        can,
        // Provide dummy values for remaining required fields if needed
        isFirebaseConfigured: true, firebaseUser: null, user: null, role: null, permissions: [], loading: false, authenticated: true, authorized: true, contractualError: null, technicalError: null, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn()
      } as any);

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={queryClient}>
          <PermissionGuard permission={BATCH_TRACE_PERMISSION} showErrorPage>
            <BatchTracePage batchId="b-1" />
          </PermissionGuard>
        </QueryClientProvider>
      );
    };

    it('denies access if user lacks production:read', () => {
      renderWithGuard(() => false);
      expect(screen.getByText(/Acceso denegado/i)).toBeTruthy(); // from AccessDeniedPage
    });

    it('grants access if user has production:read', () => {
      renderWithGuard((p) => p === 'production:read');
      // Should render the page header
      expect(screen.getByText('Historial de Lote')).toBeTruthy();
    });
  });

  it('renders full trace seamlessly', () => {
    const maps = {
      articulosMap: new Map([['art-1', 'Uva'], ['art-3', 'Levadura (should be overridden)']]),
      producersMap: new Map([['prod-1', 'Juan']]),
      varietiesMap: new Map([['gv-1', 'Malbec']]),
      ordersMap: new Map([['o-1', 'ORD-001']]),
      tfOrdersMap: new Map([['to-1', 'TO-001']]),
      participantsMap: new Map([['part-1', 'Carlos']]),
      measurementTypesMap: new Map([['mt-1', 'Densidad']])
    };

    render(<BatchTraceContent trace={mockTrace} {...maps} />);

    expect(screen.getByTestId('trace-header')).toBeTruthy();
    expect(screen.getAllByText('ORD-001')[0]).toBeTruthy();

    expect(screen.getAllByText(/Juan/i)[0]).toBeTruthy();
    expect(screen.getAllByText(/Malbec/i)[0]).toBeTruthy();

    expect(screen.getAllByText('Densidad')[0]).toBeTruthy();
    expect(screen.getAllByText(/Carlos/i)[0]).toBeTruthy();

    expect(screen.getAllByText(/Almacen de Insumos/i)[0]).toBeTruthy();
    expect(screen.getAllByText(/Levadura XYZ/i)[0]).toBeTruthy();
    expect(screen.getByText(/"Consumo por orden"/i)).toBeTruthy();

    expect(screen.getAllByText(/Asignación/i)[0]).toBeTruthy();
    expect(screen.getAllByText(/Initial fill/i)[0]).toBeTruthy();
    expect(screen.getByTestId('trace-transformation-tf-1')).toBeTruthy();
    expect(screen.getByTestId('trace-work-w-1')).toBeTruthy();
    expect(screen.getByTestId('trace-measurement-m-1')).toBeTruthy();
    expect(screen.getByTestId('trace-process-movement-cm-1')).toBeTruthy();
    expect(screen.getByTestId('trace-inv-lot-lot-1')).toBeTruthy();
    expect(screen.getByTestId('trace-inv-stock-st-1')).toBeTruthy();
    expect(screen.getByTestId('trace-inv-mov-mov-1')).toBeTruthy();
    expect(screen.getByTestId('trace-loss-loss-1')).toBeTruthy();
  });

  it('handles warnings expansion properly', async () => {
    const user = userEvent.setup();
    render(<BatchTraceContent trace={mockTrace} />);

    const warningHeader = screen.getByText('Trazabilidad parcial (1 aviso)');
    expect(warningHeader).toBeTruthy();

    // Check collapsible item functionality
    const btn = screen.getByRole('button', { name: /Trazabilidad parcial/i });
    await user.click(btn);

    expect(screen.getByText('Batch references missing Articulo art-2')).toBeTruthy();
  });

  it('renders parent/child canonical hrefs', () => {
    render(<BatchTraceContent trace={mockTrace} />);
    const links = screen.getAllByRole('link');
    expect(links.some(link => link.getAttribute('href') === '/produccion/batches/b-0/trace')).toBe(true);
    expect(links.some(link => link.getAttribute('href') === '/produccion/batches/b-2/trace')).toBe(true);
  });

  it('renders concrete compensation movement for reversed input', () => {
    render(<BatchTraceContent trace={mockTrace} />);
    expect(screen.getAllByText(/mov-2/i)[0]).toBeTruthy();
    expect(screen.getAllByText('REVERSAL')[0]).toBeTruthy();
    expect(screen.getAllByText('Stock: 5 → 10')[0]).toBeTruthy();
  });

  it('renders empty trace placeholder if no history', () => {
    const emptyTrace: ProductionBatchTraceDto = {
      ...mockTrace,
      receptions: [], works: [], transformations: [], measurements: [],
      containers: [], losses: [], releases: [],
      inventory: { lots: [], movements: [], stocks: [] }
    };
    render(<BatchTraceContent trace={emptyTrace} />);
    expect(screen.getByTestId('trace-empty-history')).toBeTruthy();
    expect(screen.getByText('Sin historial operativo')).toBeTruthy();
  });
});
