type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Deterministic JSON representation; undefined object properties are omitted. */
export function stableSerialize(value: unknown): string {
  const normalize = (v: unknown): JsonValue | undefined => {
    if (v === undefined) return undefined;
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') return v;
    if (Array.isArray(v)) return v.map(item => normalize(item) ?? null);
    if (typeof v === 'object') {
      return Object.keys(v as object).sort().reduce<Record<string, JsonValue>>((out, key) => {
        const item = normalize((v as Record<string, unknown>)[key]);
        if (item !== undefined) out[key] = item;
        return out;
      }, {});
    }
    return undefined;
  };
  return JSON.stringify(normalize(value));
}

export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export const createOperationKey = (): string => crypto.randomUUID();
/** Hashes only business payload fields, never transport idempotency fields. */
export async function hashPayload(payload: Record<string, unknown>): Promise<string> {
  const { operationKey: _operationKey, requestHash: _requestHash, ...businessPayload } = payload;
  return sha256Hex(businessPayload);
}
export const canonicalPayloadHash = hashPayload;