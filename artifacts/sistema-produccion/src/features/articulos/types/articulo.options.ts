import type { Clasificacion, UnidadMedida } from './articulo.types';

export const CLASIFICACION_OPTIONS: ReadonlyArray<{ value: Clasificacion; label: string }> = [
  { value: 'MATERIA_PRIMA', label: 'Materia prima' },
  { value: 'INSUMO_ENOLOGICO', label: 'Insumo enológico' },
  { value: 'MATERIAL_ENVASE', label: 'Material de envase' },
  { value: 'MATERIAL_EMPAQUE', label: 'Material de empaque' },
  { value: 'PRODUCTO_PROCESO', label: 'Producto en proceso' },
  { value: 'PRODUCTO_ENVASADO', label: 'Producto envasado' },
  { value: 'PRODUCTO_TERMINADO', label: 'Producto terminado' },
];

export const UNIDAD_MEDIDA_OPTIONS: ReadonlyArray<{ value: UnidadMedida; label: string }> = [
  { value: 'KG', label: 'Kilogramo' },
  { value: 'G', label: 'Gramo' },
  { value: 'L', label: 'Litro' },
  { value: 'M', label: 'Metro' },
  { value: 'UNIDAD', label: 'Unidad' },
];

export const ACTIVO_OPTIONS = [
  { value: undefined, label: 'Todos' },
  { value: true, label: 'Activos' },
  { value: false, label: 'Inactivos' },
] as const;
