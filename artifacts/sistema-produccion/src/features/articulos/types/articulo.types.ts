export const CLASIFICACIONES_OFICIALES = [
  'MATERIA_PRIMA',
  'INSUMO_ENOLOGICO',
  'MATERIAL_ENVASE_EMPAQUE',
  'MATERIAL_ENVASE_EMPAQUE_EXPORTACION',
  'MATERIAL_LABORATORIO',
  'INSUMO_LABORATORIO',
  'PRODUCTO_AGROQUIMICO',
  'MATERIAL_COMERCIAL',
  'OTRO_INVENTARIABLE',
  'PRODUCTO_PROCESO',
  'PRODUCTO_TERMINADO',
  'PRODUCTO_TERMINADO_EXPORTACION',
  'MATERIAL_AUXILIAR',
  'INSUMO_LIMPIEZA',
] as const;

export const CLASIFICACIONES_LEGACY = [
  'MATERIAL_ENVASE',
  'MATERIAL_EMPAQUE',
  'PRODUCTO_ENVASADO',
] as const;

export const CLASIFICACIONES = [...CLASIFICACIONES_OFICIALES, ...CLASIFICACIONES_LEGACY] as const;

export type ClasificacionOficial = (typeof CLASIFICACIONES_OFICIALES)[number];
export type ClasificacionLegacy = (typeof CLASIFICACIONES_LEGACY)[number];
export type Clasificacion = ClasificacionOficial | ClasificacionLegacy;

export const UNIDADES_MEDIDA = ['KG', 'G', 'L', 'M', 'UNIDAD'] as const;

export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number];

export type Articulo = {
  id: string;
  codigo: string;
  codigoExterno: string | null;
  nombre: string;
  clasificacion: Clasificacion;
  unidadMedida: UnidadMedida;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ArticulosListFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  clasificacion?: Clasificacion;
  activo?: boolean;
};

export type ArticulosListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ArticulosListResponse = {
  items: Articulo[];
  meta: ArticulosListMeta;
};

export type CreateArticuloInput = {
  codigo: string;
  codigoExterno?: string;
  nombre: string;
  clasificacion: ClasificacionOficial;
  unidadMedida: UnidadMedida;
};

export type UpdateArticuloInput = {
  codigoExterno?: string | null;
  nombre?: string;
  clasificacion?: ClasificacionOficial;
  unidadMedida?: UnidadMedida;
};
