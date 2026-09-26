import { ApiError } from '@/lib/api/api-error';
const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados.', IDEMPOTENCY_KEY_REQUIRED: 'Esta operación requiere una clave de idempotencia.',
  IDEMPOTENCY_CONFLICT: 'La clave de idempotencia ya fue utilizada con otra operación.',
  WAREHOUSE_HAS_STOCK: 'No se puede desactivar un almacén que tiene stock.', WAREHOUSE_INACTIVE: 'El almacén está inactivo.',
  ARTICULO_INVALID: 'El artículo no existe o no está activo.', UNIT_MISMATCH: 'La unidad no coincide con la unidad del artículo.',
  INVALID_UNIT: 'La unidad indicada no es válida.', INVALID_QUANTITY: 'La cantidad debe ser positiva y válida.',
  LOT_ARTICULO_MISMATCH: 'El lote no corresponde al artículo.', NOT_FOUND: 'No se encontró el recurso solicitado.',
  INVALID_CLASSIFICATION_TRANSITION: 'La clasificación del lote no permite esa transición.',
  INVALID_TRANSFER: 'Los almacenes de origen y destino deben ser distintos.',
  NEGATIVE_STOCK_AUTHORIZATION_REQUIRED: 'Se requiere autorización para dejar stock negativo.',
  AUTH_FORBIDDEN: 'No tienes permiso para autorizar stock negativo.', WAREHOUSE_NOT_FOUND: 'No se encontró el almacén.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor.', INTERNAL_ERROR: 'Ocurrió un error interno.',
  UNAUTHORIZED: 'Tu sesión no es válida o ha expirado.', FORBIDDEN: 'No tienes permisos para realizar esta operación.',
  AUTH_REQUIRED: 'Debes iniciar sesión para realizar esta operación.',
};
export type InventoryError = ApiError & { userMessage: string };
export function mapInventoryError(error: unknown): InventoryError {
  const source = error instanceof ApiError ? error : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor.' });
  return Object.assign(source, { userMessage: messages[source.code] ?? source.message }) as InventoryError;
}