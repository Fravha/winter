import type {
  Articulo,
  ArticuloClassification,
  ListArticulosFilters,
  PaginatedArticulos,
  ValidateArticuloResult,
} from "./articulo.model.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";

export interface ArticulosApi {
  getArticulo(input: { articuloId: string }): Promise<Articulo>;
  listArticulos(filters: ListArticulosFilters): Promise<PaginatedArticulos>;
  validateArticulo(input: {
    articuloId: string;
    allowedClassifications?: readonly ArticuloClassification[];
  }): Promise<ValidateArticuloResult>;
  validateArticuloInTransaction(input: {
    articuloId: string;
    allowedClassifications?: readonly ArticuloClassification[];
  }, transaction: SharedTransactionContext): Promise<ValidateArticuloResult>;
}