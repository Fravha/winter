import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { getAdminErrorMessage } from './admin-error-mapper';

describe('administration domain errors', () => {
  it.each([
    ['USER_CANNOT_SUSPEND_SELF', 'No puede suspender su propio usuario.'],
    ['LAST_ADMIN_PROTECTED', 'último administrador'],
    ['ROLE_IN_USE', 'rol está en uso'],
    ['SYSTEM_ROLE_PROTECTED', 'rol de sistema'],
    ['SYSTEM_ROLE_PERMISSIONS_PROTECTED', 'permisos de un rol de sistema'],
    ['PERMISSION_IN_USE', 'retirarse de los roles'],
    ['PERMISSION_CODE_ALREADY_EXISTS', 'permiso con este código'],
    ['AUTH_FORBIDDEN', 'No tiene permisos'],
  ])('maps %s to a useful message', (code, fragment) => {
    const error = new ApiError({ status: 409, code, message: 'backend detail', requestId: 'req-1', details: { source: 'test' } });
    expect(getAdminErrorMessage(error)).toContain(fragment);
  });

  it('preserves backend messages for unknown errors', () => {
    expect(getAdminErrorMessage(new ApiError({ status: 422, code: 'OTHER', message: 'invalid role' }))).toContain('invalid role');
  });
});