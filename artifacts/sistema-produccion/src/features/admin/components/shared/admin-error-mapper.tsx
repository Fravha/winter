import { ApiError } from '@/lib/api/api-error';

export function getAdminErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'USER_CANNOT_SUSPEND_SELF': return 'No puede suspender su propio usuario.';
      case 'LAST_ADMIN_PROTECTED': return 'No puede modificar o suspender al último administrador del sistema.';
      case 'ROLE_IN_USE': return 'El rol está en uso y no puede ser eliminado.';
      case 'SYSTEM_ROLE_PROTECTED': return 'Este es un rol de sistema y está protegido contra modificaciones o eliminación.';
      case 'SYSTEM_ROLE_PERMISSIONS_PROTECTED': return 'Los permisos de un rol de sistema no pueden ser modificados.';
      case 'PERMISSION_IN_USE': return 'El permiso está asignado a uno o más roles y no puede eliminarse. Debe retirarse de los roles primero.';
      case 'PERMISSION_CODE_ALREADY_EXISTS': return 'Ya existe un permiso con este código.';
      case 'AUTH_FORBIDDEN': return 'No tiene permisos para realizar esta acción.';
      default: return error.message || 'Ha ocurrido un error inesperado.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ha ocurrido un error inesperado.';
}

export function AdminErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = getAdminErrorMessage(error);
  const reqId = error instanceof ApiError ? error.requestId : null;
  const code = error instanceof ApiError ? error.code : null;
  const details = error instanceof ApiError ? error.details : null;

  return (
    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md text-sm">
      <p className="font-medium">{msg}</p>
      {(reqId || code) && (
        <p className="text-xs opacity-80 mt-1 font-mono">
          {code && `Code: ${code} `}{reqId && `Req: ${reqId}`}
        </p>
      )}
      {details != null && (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs">
          {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
