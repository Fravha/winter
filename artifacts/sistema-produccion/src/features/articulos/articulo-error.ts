import { ApiError } from '@/lib/api/api-error';

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Los datos enviados no son válidos. Revisa los campos e intenta nuevamente.',
  ARTICULO_NOT_FOUND: 'El artículo solicitado no existe o ya no está disponible.',
  ARTICULO_CODE_ALREADY_EXISTS: 'Ya existe un artículo con este código. Utiliza un código único.',
  ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE:
    'La clasificación o unidad de medida ya no puede modificarse porque el artículo tiene movimientos o referencias operativas.',
};

export function getArticuloErrorMessage(error: Error, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'NETWORK_ERROR') {
    return 'No fue posible conectar con el servidor del sistema. Intenta nuevamente.';
  }
  return ERROR_MESSAGES[error.code] ?? fallback;
}

export function withRequestId(message: string, error: Error) {
  if (!(error instanceof ApiError) || !error.requestId) return message;
  return `${message} (Req ID: ${error.requestId})`;
}