import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiUrl } from './client';
import { ApiError } from './api-error';

vi.mock('@/auth/firebase', () => ({ auth: null }));

afterEach(() => vi.unstubAllEnvs());

describe('API URL configuration', () => {
  it('fails clearly instead of targeting localhost when the API URL is missing', () => {
    vi.stubEnv('VITE_WINTER_API_URL', '');

    expect(() => getApiUrl('/healthz')).toThrowError(ApiError);
    expect(() => getApiUrl('/healthz')).toThrow(
      'La URL de la API no está configurada. Define VITE_WINTER_API_URL',
    );
  });

  it('builds API URLs from the configured server base URL', () => {
    vi.stubEnv('VITE_WINTER_API_URL', 'https://api.example.test/');

    expect(getApiUrl('/healthz')).toBe('https://api.example.test/api/v1/healthz');
  });
});