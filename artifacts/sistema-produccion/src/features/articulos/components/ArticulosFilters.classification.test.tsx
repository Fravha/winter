import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticulosFilters } from './ArticulosFilters';

describe('filtro de clasificación de Artículos', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('permite filtrar por clasificaciones nuevas y conserva acceso a registros legacy', async () => {
    const onChange = vi.fn();
    render(<ArticulosFilters filters={{ page: 1 }} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('select-clasificacion'));
    fireEvent.click(await screen.findByRole('option', { name: 'Material de envase y empaque' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ clasificacion: 'MATERIAL_ENVASE_EMPAQUE', page: 1 }),
    ));

    fireEvent.click(screen.getByTestId('select-clasificacion'));
    fireEvent.click(await screen.findByRole('option', { name: 'Producto envasado (legacy)' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ clasificacion: 'PRODUCTO_ENVASADO', page: 1 }),
    ));
  });
});