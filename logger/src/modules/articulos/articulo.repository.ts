import type { CreateArticuloDto, UpdateArticuloDto } from "./articulo.dto.js";
import type {
  Articulo,
  ListArticulosFilters,
  PaginatedArticulos,
} from "./articulo.model.js";

export interface ArticuloRepository {
  findById(id: string): Promise<Articulo | null>;
  findByCodeInsensitive(codigo: string): Promise<Articulo | null>;
  findAll(filters: ListArticulosFilters): Promise<PaginatedArticulos>;
  create(data: CreateArticuloDto): Promise<Articulo>;
  update(id: string, data: UpdateArticuloDto): Promise<Articulo>;
  setActive(id: string, activo: boolean): Promise<Articulo>;
}