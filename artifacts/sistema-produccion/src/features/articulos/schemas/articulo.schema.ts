import { z } from 'zod';
import { CLASIFICACIONES, CLASIFICACIONES_OFICIALES, UNIDADES_MEDIDA } from '../types/articulo.types';

const optionalExternalCode = z.string().trim().nullable().optional();

export const createArticuloSchema = z.object({
  codigo: z.string().trim().min(1, 'El código es obligatorio'),
  codigoExterno: optionalExternalCode,
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  clasificacion: z.enum(CLASIFICACIONES_OFICIALES),
  unidadMedida: z.enum(UNIDADES_MEDIDA),
});

// The form accepts legacy classifications so existing records can be edited
// without coercing their stored value; creation is validated separately above.
export const articuloFormSchema = createArticuloSchema.extend({
  clasificacion: z.enum(CLASIFICACIONES),
});

export const updateArticuloSchema = z
  .object({
    codigoExterno: optionalExternalCode,
    nombre: z.string().trim().min(1, 'El nombre no puede estar vacío').optional(),
    clasificacion: z.enum(CLASIFICACIONES_OFICIALES).optional(),
    unidadMedida: z.enum(UNIDADES_MEDIDA).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debe indicar al menos un campo para actualizar',
  });

export type CreateArticuloFormValues = z.infer<typeof articuloFormSchema>;
export type UpdateArticuloFormValues = z.infer<typeof updateArticuloSchema>;
