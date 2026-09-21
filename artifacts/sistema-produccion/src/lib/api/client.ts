import { auth } from '@/auth/firebase';

const getBaseUrl = () => {
  const url = import.meta.env.VITE_WINTER_API_URL;
  if (!url) return 'http://localhost:3000';
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
