export const articuloClassifications = [
  "MATERIA_PRIMA",
  "INSUMO_ENOLOGICO",
  "MATERIAL_ENVASE",
  "MATERIAL_EMPAQUE",
  "MATERIAL_ENVASE_EMPAQUE",
  "MATERIAL_ENVASE_EMPAQUE_EXPORTACION",
  "MATERIAL_LABORATORIO",
  "INSUMO_LABORATORIO",
  "PRODUCTO_AGROQUIMICO",
  "MATERIAL_COMERCIAL",
  "OTRO_INVENTARIABLE",
  "PRODUCTO_PROCESO",
  "PRODUCTO_ENVASADO",
  "PRODUCTO_TERMINADO",
  "PRODUCTO_TERMINADO_EXPORTACION",
  "MATERIAL_AUXILIAR",
  "INSUMO_LIMPIEZA",
] as const;

export const articuloUnits = ["KG", "G", "L", "M", "UNIDAD"] as const;

export type ArticuloClassification = typeof articuloClassifications[number];
export type ArticuloUnit = typeof articuloUnits[number];

export interface Articulo {
  id: string;
  codigo: string;
  codigoExterno: string | null;
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
  reason?: "NOT_FOUND" | "INACTIVE" | "INVALID_CLASSIFICATION";
}