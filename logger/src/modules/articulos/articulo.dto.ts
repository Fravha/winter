import type {
  ArticuloClassification,
  ArticuloUnit,
} from "./articulo.model.js";

export interface CreateArticuloDto {
  codigo: string;
  codigoExterno?: string;
  nombre: string;
  clasificacion: ArticuloClassification;
  unidadMedida: ArticuloUnit;
}

export interface UpdateArticuloDto {
  codigoExterno?: string | null;
  nombre?: string;
  clasificacion?: ArticuloClassification;
  unidadMedida?: ArticuloUnit;
}