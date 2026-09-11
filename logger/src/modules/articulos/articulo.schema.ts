import { z } from "zod";
import {
  articuloClassifications,
  articuloUnits,
} from "./articulo.model.js";

export const articuloIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createArticuloSchema = z.object({
  codigo: z.string().trim().min(1, "Codigo is required"),
  nombre: z.string().trim().min(1, "Nombre is required"),
  clasificacion: z.enum(articuloClassifications),
  unidadMedida: z.enum(articuloUnits),
});

export const updateArticuloSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre is required").optional(),
  clasificacion: z.enum(articuloClassifications).optional(),
  unidadMedida: z.enum(articuloUnits).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

export const listArticulosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  clasificacion: z.enum(articuloClassifications).optional(),
  activo: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});