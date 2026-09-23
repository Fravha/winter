import { z } from 'zod';
import { CLASIFICACIONES, UNIDADES_MEDIDA } from '../types/articulo.types';

const optionalExternalCode = z.string().trim().nullable().optional();

export const createArticuloSchema = z.object({
  codigo: z.string().trim().min(1, 'El código es obligatorio'),
  codigoExterno: optionalExternalCode,
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  clasificacion: z.enum(CLASIFICACIONES),
  unidadMedida: z.enum(UNIDADES_MEDIDA),
});

export const updateArticuloSchema = z
  .object({
    codigoExterno: optionalExternalCode,
    nombre: z.string().trim().min(1, 'El nombre no puede estar vacío').optional(),
    clasificacion: z.enum(CLASIFICACIONES).optional(),
    unidadMedida: z.enum(UNIDADES_MEDIDA).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debe indicar al menos un campo para actualizar',
  });

export type CreateArticuloFormValues = z.infer<typeof createArticuloSchema>;
export type UpdateArticuloFormValues = z.infer<typeof updateArticuloSchema>;
