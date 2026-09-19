import { AppError } from "../../shared/errors/app-error.js";

export interface AttachmentContent { mimetype: string; buffer: Buffer; size: number; originalname: string }
export function contentMatches(file: AttachmentContent): boolean {
  const b = file.buffer;
  if (file.size === 0) return false;
  if (file.mimetype === "image/jpeg") return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === "image/png") return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (file.mimetype === "image/webp") return b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
  return b.toString("ascii", 0, 5) === "%PDF-";
}
export function safeFileName(input: string): string {
  const base = input.normalize("NFKC").replace(/\\/g, "/").split("/").pop() ?? "";
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 180);
  if (!safe || safe === "." || safe === "..") throw new AppError("ATTACHMENT_INVALID_FILENAME", "Invalid attachment filename", 400);
  return safe;
}