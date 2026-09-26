import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticuloFormDialog } from './ArticuloFormDialog';

const mocks = vi.hoisted(() => ({
  articulo: null as any,
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../api/articulos.hooks', () => ({
  useArticulo: () => ({ data: mocks.articulo, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateArticulo: () => ({ mutate: mocks.createMutate, reset: vi.fn(), isPending: false }),
  useUpdateArticulo: () => ({ mutate: mocks.updateMutate, reset: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

const existingArticulo = (clasificacion: string) => ({
  id: 'art-1',
  codigo: 'ART-1',
  codigoExterno: null,
  nombre: 'Artículo de prueba',
  clasificacion,
  unidadMedida: 'UNIDAD',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('clasificación en el formulario de Artículos', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    mocks.articulo = null;
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.toast.mockReset();
  });

  it('crea artículos con las nuevas clasificaciones oficiales', async () => {
    render(<ArticuloFormDialog isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('input-codigo'), { target: { value: 'ART-NEW' } });
    fireEvent.change(screen.getByTestId('input-nombre'), { target: { value: 'Artículo nuevo' } });
    fireEvent.click(screen.getByTestId('select-form-clasificacion'));
    fireEvent.click(await screen.findByRole('option', { name: 'Material de laboratorio' }));
    fireEvent.click(screen.getByTestId('btn-submit-form'));

    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ clasificacion: 'MATERIAL_LABORATORIO' }),
      expect.any(Object),
    ));
  });

  it('permite actualizar a una nueva clasificación oficial', async () => {
    mocks.articulo = existingArticulo('MATERIA_PRIMA');
    render(<ArticuloFormDialog isOpen onClose={vi.fn()} articuloId="art-1" />);
    await screen.findByDisplayValue('Artículo de prueba');
    fireEvent.click(screen.getByTestId('select-form-clasificacion'));
    fireEvent.click(await screen.findByRole('option', { name: 'Insumos de limpieza' }));
    fireEvent.click(screen.getByTestId('btn-submit-form'));

    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ clasificacion: 'INSUMO_LIMPIEZA' }) }),
      expect.any(Object),
    ));
  });

  it('keeps a legacy classification read-only and omits it from unrelated edits', async () => {
    mocks.articulo = existingArticulo('MATERIAL_ENVASE');
    render(<ArticuloFormDialog isOpen onClose={vi.fn()} articuloId="art-1" />);
    expect((await screen.findByTestId('legacy-clasificacion-readonly')).textContent).toContain(
      'Material de envase (legacy; se conserva si no elige una clasificación oficial)',
    );
    expect(screen.getByTestId('select-form-clasificacion')).toBeTruthy();

    fireEvent.change(screen.getByTestId('input-nombre'), { target: { value: 'Nombre corregido' } });
    fireEvent.click(screen.getByTestId('btn-submit-form'));
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());
    expect(mocks.updateMutate.mock.calls[0][0].input).not.toHaveProperty('clasificacion');
  });
});