import { getApiUrl, getAuthToken } from './client';
import { ApiError } from './api-error';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = getApiUrl(path);

  const headers = new Headers(options.headers);

  const token = await getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Handle JSON
  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    body: options.body instanceof FormData
      ? options.body
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  };

  try {
    const response = await fetch(url, fetchOptions);

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      let errorData;
      if (isJson) {
        errorData = await response.json().catch(() => null);
      }

      const errorPayload = errorData?.error ?? errorData ?? {
        code: `HTTP_ERROR_${response.status}`,
        message: response.statusText || 'Unknown error occurred',
      };

      throw new ApiError({
        status: response.status,
        code: errorPayload.code ?? `HTTP_ERROR_${response.status}`,
        message: errorPayload.message ?? response.statusText ?? 'Unknown error occurred',
        requestId: errorPayload.requestId ?? errorData?.requestId,
        details: errorPayload.details || errorData?.details,
      });
    }

    if (isJson) {
      const data = await response.json();
      return data as T;
    }

    return response as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network error occurred',
    });
  }
}
