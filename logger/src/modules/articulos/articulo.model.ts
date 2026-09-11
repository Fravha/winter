export const articuloClassifications = [
  "MATERIA_PRIMA",
  "INSUMO_ENOLOGICO",
  "MATERIAL_ENVASE",
  "MATERIAL_EMPAQUE",
  "PRODUCTO_PROCESO",
  "PRODUCTO_ENVASADO",
  "PRODUCTO_TERMINADO",
] as const;

export const articuloUnits = ["KG", "G", "L", "ML", "UNIDAD"] as const;

export type ArticuloClassification = typeof articuloClassifications[number];
export type ArticuloUnit = typeof articuloUnits[number];

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  clasificacion: ArticuloClassification;
  unidadMedida: ArticuloUnit;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListArticulosFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  clasificacion?: ArticuloClassification;
  activo?: boolean;
}

export interface ArticuloPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedArticulos {
  items: Articulo[];
  pagination: ArticuloPagination;
}

export interface ValidateArticuloResult {
  valid: boolean;
  articulo?: Articulo;
}