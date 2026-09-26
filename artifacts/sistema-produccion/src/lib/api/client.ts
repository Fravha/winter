import { auth } from '@/auth/firebase';
import { ApiError } from './api-error';

const getBaseUrl = () => {
  const url = import.meta.env.VITE_WINTER_API_URL?.trim();
  if (!url) {
    throw new ApiError({
      status: 0,
      code: 'API_CONFIGURATION_ERROR',
      message: 'La URL de la API no está configurada. Define VITE_WINTER_API_URL para conectar con el servidor.',
    });
  }
  return url.replace(/\/$/, '');
};

export const getAuthToken = async (): Promise<string | null> => {
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  // Use forceRefresh=false unless needed, but to avoid 401 we rely on the client handling retry or just standard Firebase token refresh.
  return await user.getIdToken();
};

export const getApiUrl = (path: string) => {
  const baseUrl = getBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/api/v1${normalizedPath}`;
};
