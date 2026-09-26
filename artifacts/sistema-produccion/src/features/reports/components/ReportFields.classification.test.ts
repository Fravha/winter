import { describe, expect, it } from 'vitest';
import { LOT_CLASSIFICATION_OPTIONS } from './ReportFields';

describe('clasificaciones de lote para reportes', () => {
  it('conserva etiquetas independientes de las opciones de clasificación de Artículos', () => {
    expect(LOT_CLASSIFICATION_OPTIONS).toEqual([
      { id: 'PRODUCTO_ENVASADO', label: 'Producto envasado' },
      { id: 'PRODUCTO_TERMINADO', label: 'Producto terminado' },
      { id: 'PRODUCTO_TERMINADO_EXPORTACION', label: 'Producto terminado de Exportación' },
    ]);
  });
});