import type {
  Articulo,
  ArticuloClassification,
  ListArticulosFilters,
  PaginatedArticulos,
  ValidateArticuloResult,
} from "./articulo.model.js";

export interface ArticulosApi {
  getArticulo(input: { articuloId: string }): Promise<Articulo>;
  listArticulos(filters: ListArticulosFilters): Promise<PaginatedArticulos>;
  validateArticulo(input: {
    articuloId: string;
    allowedClassifications?: readonly ArticuloClassification[];
  }): Promise<ValidateArticuloResult>;
}