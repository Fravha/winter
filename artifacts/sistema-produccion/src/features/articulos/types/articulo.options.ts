import type { Clasificacion, ClasificacionOficial, UnidadMedida } from './articulo.types';

export const CLASIFICACION_OPTIONS: ReadonlyArray<{ value: ClasificacionOficial; label: string }> = [
  { value: 'MATERIA_PRIMA', label: 'Materia prima' },
  { value: 'INSUMO_ENOLOGICO', label: 'Insumo enológico' },
  { value: 'MATERIAL_ENVASE_EMPAQUE', label: 'Material de envase y empaque' },
  { value: 'MATERIAL_ENVASE_EMPAQUE_EXPORTACION', label: 'Material de envase y empaque de Exportacion' },
  { value: 'MATERIAL_LABORATORIO', label: 'Material de laboratorio' },
  { value: 'INSUMO_LABORATORIO', label: 'Insumos de laboratorio' },
  { value: 'PRODUCTO_AGROQUIMICO', label: 'Productos agroquímicos' },
  { value: 'MATERIAL_COMERCIAL', label: 'Material comercial' },
  { value: 'OTRO_INVENTARIABLE', label: 'Otro inventariable' },
  { value: 'PRODUCTO_PROCESO', label: 'Producto en proceso' },
  { value: 'PRODUCTO_TERMINADO', label: 'Producto terminado' },
  { value: 'PRODUCTO_TERMINADO_EXPORTACION', label: 'Producto terminado de Exportación' },
  { value: 'MATERIAL_AUXILIAR', label: 'Material auxiliar' },
  { value: 'INSUMO_LIMPIEZA', label: 'Insumos de limpieza' },
];

const LEGACY_CLASIFICACION_LABELS: Record<string, string> = {
  MATERIAL_ENVASE: 'Material de envase',
  MATERIAL_EMPAQUE: 'Material de empaque',
  PRODUCTO_ENVASADO: 'Producto envasado',
};

export const CLASIFICACION_LEGACY_OPTIONS = [
  { value: 'MATERIAL_ENVASE', label: LEGACY_CLASIFICACION_LABELS.MATERIAL_ENVASE },
  { value: 'MATERIAL_EMPAQUE', label: LEGACY_CLASIFICACION_LABELS.MATERIAL_EMPAQUE },
  { value: 'PRODUCTO_ENVASADO', label: LEGACY_CLASIFICACION_LABELS.PRODUCTO_ENVASADO },
] as const;

export function isClasificacionOficial(value: Clasificacion): value is ClasificacionOficial {
  return CLASIFICACION_OPTIONS.some((option) => option.value === value);
}

export function getClasificacionLabel(value: Clasificacion): string {
  return CLASIFICACION_OPTIONS.find((option) => option.value === value)?.label
    ?? LEGACY_CLASIFICACION_LABELS[value]
    ?? value;
}

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
