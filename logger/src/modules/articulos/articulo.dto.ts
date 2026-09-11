import type {
  ArticuloClassification,
  ArticuloUnit,
} from "./articulo.model.js";

export interface CreateArticuloDto {
  codigo: string;
  nombre: string;
  clasificacion: ArticuloClassification;
  unidadMedida: ArticuloUnit;
}

export interface UpdateArticuloDto {
  nombre?: string;
  clasificacion?: ArticuloClassification;
  unidadMedida?: ArticuloUnit;
}