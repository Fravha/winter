import { getApiUrl, getAuthToken } from '@/lib/api/client';
import { ApiError } from '@/lib/api/api-error';
import { reportPaths, type ReportKind, type ReportFilters } from '../schemas/report.schema';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Never trust a filename from a response header as a path or markup. */
export function safeFilename(disposition: string | null, fallback: string): string {
  const extended = disposition?.match(/(?:^|;)\s*filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const ordinary = disposition?.match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;]*))/i);
  let raw = ordinary?.[1] ?? ordinary?.[2] ?? ordinary?.[3] ?? '';
  if (extended) {
    try { raw = decodeURIComponent(extended); } catch { /* use ordinary filename */ }
  }
  raw = raw.replace(/[/\\\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return raw && /\.xlsx$/i.test(raw) ? raw : fallback;
}

export async function exportReport(kind: ReportKind, filters: ReportFilters, signal?: AbortSignal): Promise<string> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value?.trim()) params.set(key, value.trim()); });
  const path = `reports/${reportPaths[kind]}/export`;
  const token = await getAuthToken();
  if (!token) throw new ApiError({ status: 401, code: 'AUTH_REQUIRED', message: 'Inicia sesión para descargar reportes.' });
  const response = await fetch(`${getApiUrl(path)}${params.size ? `?${params}` : ''}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: MIME },
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = payload?.error ?? payload;
    throw new ApiError({
      status: response.status, code: error?.code ?? `HTTP_ERROR_${response.status}`,
      message: error?.message ?? response.statusText ?? 'No se pudo generar el reporte.',
      requestId: error?.requestId ?? payload?.requestId, details: error?.details ?? payload?.details,
    });
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes(MIME)) {
    throw new ApiError({ status: response.status, code: 'INVALID_REPORT_RESPONSE', message: 'El servidor no devolvió un archivo Excel.' });
  }
  const blob = await response.blob();
  if (!blob.size) throw new ApiError({ status: response.status, code: 'EMPTY_REPORT_RESPONSE', message: 'El archivo Excel recibido está vacío.' });
  const filename = safeFilename(response.headers.get('content-disposition'), `${reportPaths[kind]}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  } finally {
    // Defer until the browser has consumed the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return filename;
}