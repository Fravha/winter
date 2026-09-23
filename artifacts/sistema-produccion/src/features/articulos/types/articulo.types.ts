export const CLASIFICACIONES = [
  'MATERIA_PRIMA',
  'INSUMO_ENOLOGICO',
  'MATERIAL_ENVASE',
  'MATERIAL_EMPAQUE',
  'PRODUCTO_PROCESO',
  'PRODUCTO_ENVASADO',
  'PRODUCTO_TERMINADO',
] as const;

export type Clasificacion = (typeof CLASIFICACIONES)[number];

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
  clasificacion: Clasificacion;
  unidadMedida: UnidadMedida;
};

export type UpdateArticuloInput = {
  codigoExterno?: string | null;
  nombre?: string;
  clasificacion?: Clasificacion;
  unidadMedida?: UnidadMedida;
};
