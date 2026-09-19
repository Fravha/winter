import { AppError } from "../../shared/errors/app-error.js";

export interface AttachmentStorageProvider {
  upload(key: string, content: Buffer, mimeType: string): Promise<void>;
  createSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export class SupabaseAttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(
    private readonly url: string | undefined,
    private readonly serviceRole: string | undefined,
    private readonly bucket = "winter-attachments",
  ) {}

  private configured(): { url: string; serviceRole: string } {
    if (!this.url || !this.serviceRole) {
      throw new AppError("ATTACHMENTS_STORAGE_NOT_CONFIGURED", "Supabase attachment storage is not configured", 503);
    }
    return { url: this.url, serviceRole: this.serviceRole };
  }
  private endpoint(path: string) { return `${this.configured().url}/storage/v1${path}`; }
  private headers() { const { serviceRole } = this.configured(); return { Authorization: `Bearer ${serviceRole}`, apikey: serviceRole }; }
  private async request(path: string, init: RequestInit = {}) {
    try {
      return await fetch(this.endpoint(path), { ...init, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new AppError("ATTACHMENTS_STORAGE_UNAVAILABLE", "Attachment storage is unavailable", 503);
    }
  }
  private async ensurePrivateBucket() {
    const response = await this.request(`/bucket/${this.bucket}`, { headers: this.headers() });
    if (!response.ok) throw new AppError("ATTACHMENTS_BUCKET_UNAVAILABLE", "Attachment storage bucket is unavailable", 503);
    const body = await response.json() as { public?: boolean };
    if (body.public !== false) throw new AppError("ATTACHMENTS_BUCKET_NOT_PRIVATE", "Attachment storage bucket is not private", 503);
  }

  async upload(key: string, content: Buffer, mimeType: string) {
    await this.ensurePrivateBucket();
    const response = await this.request(`/object/${this.bucket}/${key}`, {
      method: "POST", headers: { ...this.headers(), "Content-Type": mimeType, "x-upsert": "false" }, body: new Uint8Array(content),
    });
    if (!response.ok) throw new AppError("ATTACHMENTS_STORAGE_UPLOAD_FAILED", "Attachment storage upload failed", 502);
  }
  async createSignedDownloadUrl(key: string, expiresInSeconds: number) {
    await this.ensurePrivateBucket();
    const response = await this.request(`/object/sign/${this.bucket}/${key}`, {
      method: "POST", headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!response.ok) throw new AppError("ATTACHMENTS_SIGNED_URL_FAILED", "Attachment signed URL could not be created", 502);
    const body = await response.json() as { signedURL?: string };
    if (!body.signedURL) throw new AppError("ATTACHMENTS_SIGNED_URL_FAILED", "Attachment storage returned no signed URL", 502);
    return body.signedURL.startsWith("http") ? body.signedURL : `${this.configured().url}/storage/v1${body.signedURL}`;
  }
  async exists(key: string) {
    await this.ensurePrivateBucket();
    const response = await this.request(`/object/${this.bucket}/${key}`, { method: "HEAD", headers: this.headers() });
    if (response.status === 404) return false;
    if (!response.ok) throw new AppError("ATTACHMENTS_STORAGE_UNAVAILABLE", "Attachment storage availability could not be verified", 503);
    return true;
  }
  async delete(key: string) {
    await this.ensurePrivateBucket();
    const response = await this.request(`/object/${this.bucket}`, {
      method: "DELETE", headers: { ...this.headers(), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [key] }),
    });
    if (!response.ok) throw new AppError("ATTACHMENTS_STORAGE_DELETE_FAILED", "Attachment storage cleanup failed", 502);
  }
}