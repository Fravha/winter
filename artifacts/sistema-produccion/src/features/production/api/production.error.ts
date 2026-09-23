import { ApiError } from '@/lib/api/api-error';
export type ProductionError = ApiError & { userMessage: string; requestId: string | undefined };
const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados.', AUTH_FORBIDDEN: 'No tienes permiso para realizar esta operación.',
  PRODUCTION_NOT_FOUND: 'No se encontró el recurso de producción.', PRODUCTION_ORDER_NOT_FOUND: 'No se encontró la orden de producción.',
  TRANSFORMATION_ORDER_NOT_FOUND: 'No se encontró la orden de transformación.', PRODUCTION_CODE_ALREADY_EXISTS: 'El código ya existe.',
  CONTAINER_NOT_FOUND: 'No se encontró el contenedor.', CONTAINER_CAPACITY_EXCEEDED: 'La capacidad del contenedor es insuficiente.',
  CONTAINER_OCCUPIED: 'El contenedor está ocupado.', PRODUCTION_WORK_NOT_FOUND: 'No se encontró el trabajo de producción.',
  PRODUCTION_MEASUREMENT_NOT_FOUND: 'No se encontró la medición.', IDEMPOTENCY_CONFLICT: 'La operación ya fue registrada con otros datos.',
  CORRECTION_NOOP: 'La corrección no modifica el valor actual.',
  CUSTOM_FIELD_OPTIONS_REQUIRED: 'Un campo SELECT requiere opciones.', CUSTOM_FIELD_OPTIONS_INVALID: 'Las opciones no son válidas.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor.',
};
export function mapProductionError(error: unknown): ProductionError {
  const source = error instanceof ApiError ? error : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor.' });
  return Object.assign(source, { userMessage: messages[source.code] ?? source.message, requestId: source.requestId }) as ProductionError;
}