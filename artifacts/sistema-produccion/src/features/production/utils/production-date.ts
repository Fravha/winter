export function toLocalDateTimeInput(date?: string | Date): string {
  const d = date ? new Date(date) : new Date();
  const localTime = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}