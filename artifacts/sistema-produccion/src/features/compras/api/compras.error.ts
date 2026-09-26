import { ApiError } from '@/lib/api/api-error';

const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  COMPRA_ITEMS_REQUIRED: 'La compra debe contener al menos un artículo.',
  COMPRA_DUPLICATE_ITEM: 'No se puede repetir un artículo en la compra.',
  DUPLICATE_COMPRA_ITEM: 'No se puede repetir un artículo al recibir la compra.',
  ARTICULO_INVALID: 'El artículo no existe o no está activo.',
  UNIT_MISMATCH: 'La unidad no coincide con la unidad base del artículo.',
  INVALID_UNIT_PRICE: 'El precio unitario no es válido.',
  COMPRA_NOT_FOUND: 'No se encontró la compra.',
  COMPRA_NOT_EDITABLE: 'La compra ya no está registrada y no se puede editar.',
  COMPRA_ITEM_REMOVAL_FORBIDDEN: 'Los artículos ya registrados en una compra no pueden eliminarse.',
  COMPRA_NOT_RECEIVABLE: 'La compra no puede recibirse en su estado actual.',
  COMPRA_NOT_CANCELLABLE: 'La compra no puede cancelarse en su estado actual.',
  WAREHOUSE_INACTIVE: 'El almacén seleccionado está inactivo.',
  COMPRA_TRANSITION_FAILED: 'No se pudo completar la transición de la compra.',
  RECEIVE_ITEMS_MISMATCH: 'Los artículos de la recepción no coinciden con la compra.',
  LOT_ARTICULO_MISMATCH: 'El lote no corresponde al artículo de la compra.',
  INVENTORY_BATCH_INVALID: 'No se pudo registrar el ingreso en inventario.',
  NOT_FOUND: 'No se encontró el recurso solicitado.',
};

export type CompraError = ApiError & { userMessage: string; requestId?: string; details?: unknown };
export function mapCompraError(error: unknown): CompraError {
  const source = error instanceof ApiError ? error : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor.' });
  const mapped = Object.assign(source, { userMessage: messages[source.code] ?? source.message });
  return mapped as CompraError;
}