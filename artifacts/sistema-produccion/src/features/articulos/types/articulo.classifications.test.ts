import { describe, expect, it } from 'vitest';
import { createArticuloSchema, updateArticuloSchema } from '../schemas/articulo.schema';
import { CLASIFICACION_OPTIONS, getClasificacionLabel } from './articulo.options';

const approved = [
  ['MATERIA_PRIMA', 'Materia prima'],
  ['INSUMO_ENOLOGICO', 'Insumo enológico'],
  ['MATERIAL_ENVASE_EMPAQUE', 'Material de envase y empaque'],
  ['MATERIAL_ENVASE_EMPAQUE_EXPORTACION', 'Material de envase y empaque de Exportacion'],
  ['MATERIAL_LABORATORIO', 'Material de laboratorio'],
  ['INSUMO_LABORATORIO', 'Insumos de laboratorio'],
  ['PRODUCTO_AGROQUIMICO', 'Productos agroquímicos'],
  ['MATERIAL_COMERCIAL', 'Material comercial'],
  ['OTRO_INVENTARIABLE', 'Otro inventariable'],
  ['PRODUCTO_PROCESO', 'Producto en proceso'],
  ['PRODUCTO_TERMINADO', 'Producto terminado'],
  ['PRODUCTO_TERMINADO_EXPORTACION', 'Producto terminado de Exportación'],
  ['MATERIAL_AUXILIAR', 'Material auxiliar'],
  ['INSUMO_LIMPIEZA', 'Insumos de limpieza'],
] as const;

describe('clasificaciones de Artículos', () => {
  it('expone exclusivamente las 14 clasificaciones oficiales y sus etiquetas aprobadas', () => {
    expect(CLASIFICACION_OPTIONS).toEqual(approved.map(([value, label]) => ({ value, label })));
  });

  it('accepts every official class for create and edit and rejects unknown or legacy classes', () => {
    for (const [clasificacion] of approved) {
      const create = createArticuloSchema.safeParse({
        codigo: 'ART-1',
        nombre: 'Artículo',
        clasificacion,
        unidadMedida: 'UNIDAD',
      });
      const update = updateArticuloSchema.safeParse({ clasificacion });
      expect(create.success).toBe(true);
      expect(update.success).toBe(true);
    }

    expect(createArticuloSchema.safeParse({
      codigo: 'ART-1', nombre: 'Artículo', clasificacion: 'INEXISTENTE', unidadMedida: 'UNIDAD',
    }).success).toBe(false);
    expect(createArticuloSchema.safeParse({
      codigo: 'ART-1', nombre: 'Artículo', clasificacion: 'MATERIAL_ENVASE', unidadMedida: 'UNIDAD',
    }).success).toBe(false);
    expect(updateArticuloSchema.safeParse({ clasificacion: 'INEXISTENTE' }).success).toBe(false);
    expect(updateArticuloSchema.safeParse({ clasificacion: 'PRODUCTO_ENVASADO' }).success).toBe(false);
  });

  it('keeps legacy values readable without offering them as new classification options', () => {
    expect(getClasificacionLabel('MATERIAL_ENVASE')).toBe('Material de envase');
    expect(getClasificacionLabel('MATERIAL_EMPAQUE')).toBe('Material de empaque');
    expect(getClasificacionLabel('PRODUCTO_ENVASADO')).toBe('Producto envasado');
  });
});