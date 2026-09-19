import { randomUUID } from "node:crypto";
import type { PrismaClient, AttachmentEntityType } from "../../generated/prisma/client.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AttachmentTargetAdapter } from "./attachment.targets.js";
import type { AttachmentStorageProvider } from "./attachment.storage.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { contentMatches, safeFileName } from "./attachment.validation.js";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export interface UploadedFile { originalname: string; mimetype: string; size: number; buffer: Buffer }
export type AttachmentAuditRecorder = (transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], attachment: { id: string; entityType: AttachmentEntityType; entityId: string; fileName: string; mimeType: string; fileSize: number; storageKey: string; storageProvider: string; actorUserId: string }) => Promise<void>;
export { contentMatches };

export class AttachmentService {
  private readonly uow: SharedUnitOfWork;
  private readonly targets: AttachmentTargetAdapter;
  constructor(private readonly prisma: PrismaClient, private readonly storage: AttachmentStorageProvider, private readonly auditRecorder?: AttachmentAuditRecorder) {
    this.uow = new SharedUnitOfWork(prisma);
    this.targets = new AttachmentTargetAdapter(prisma);
  }
  private validate(file: UploadedFile) {
    if (!file || !ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_ATTACHMENT_MIME_TYPES[number])) throw new AppError("ATTACHMENT_MIME_NOT_ALLOWED", "Unsupported attachment MIME type", 400);
    if (file.size > MAX_ATTACHMENT_BYTES) throw new AppError("ATTACHMENT_TOO_LARGE", "Attachment exceeds the 10 MiB limit", 413);
    if (!contentMatches(file)) throw new AppError("ATTACHMENT_CONTENT_MISMATCH", "Attachment content does not match its declared MIME type", 400);
    safeFileName(file.originalname);
  }
  async create(input: { entityType: string; entityId: string; file: UploadedFile; observations?: string; actorUserId: string }) {
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(input.entityId)) throw new AppError("ATTACHMENT_INVALID_TARGET_ID", "Target id must be a UUID", 400);
    if (input.observations !== undefined && typeof input.observations !== "string") throw new AppError("ATTACHMENT_INVALID_OBSERVATIONS", "Observations must be text", 400);
    const observations = input.observations === undefined ? undefined : input.observations.trim();
    if (observations !== undefined && observations.length > 1000) throw new AppError("ATTACHMENT_INVALID_OBSERVATIONS", "Observations are too long", 400);
    this.validate(input.file);
    const entityType = AttachmentTargetAdapter.resolve(input.entityType);
    await this.targets.assertExists(entityType, input.entityId);
    const id = randomUUID();
    const fileName = safeFileName(input.file.originalname);
    const storageKey = `production/${entityType.toLowerCase()}/${input.entityId}/${id}/${fileName}`;
    await this.storage.upload(storageKey, input.file.buffer, input.file.mimetype);
    try {
      return await this.uow.execute(async (tx) => {
        const attachment = await tx.attachment.create({ data: {
          id, entityType, entityId: input.entityId, fileName, mimeType: input.file.mimetype,
          fileSize: input.file.size, storageProvider: "SUPABASE", storageKey,
          uploadedByUserId: input.actorUserId,
          ...(observations !== undefined ? { observations } : {}),
        } });
        const audit = {
          id, entityType, entityId: input.entityId, fileName, mimeType: input.file.mimetype,
          fileSize: input.file.size, storageProvider: "SUPABASE", storageKey, actorUserId: input.actorUserId,
        };
        if (this.auditRecorder) await this.auditRecorder(tx, audit);
        else await tx.auditLog.create({ data: {
          actorUserId: input.actorUserId, action: "ATTACHMENT_CREATED", resourceType: "Attachment", resourceId: id,
          metadata: { attachmentId: id, entityType, entityId: input.entityId, fileName, mimeType: input.file.mimetype, fileSize: input.file.size, storageProvider: "SUPABASE", storageKey },
        } });
        return publicDto(attachment);
      });
    } catch (error) {
      try { await this.storage.delete(storageKey); }
      catch (cleanupError) {
        logger.error({ attachmentId: id, entityType, entityId: input.entityId, orphaned: true }, "attachment storage compensation failed");
        throw new AppError("ATTACHMENT_ORPHANED_STORAGE", "Attachment could not be persisted and requires operational cleanup", 500);
      }
      throw error;
    }
  }
  async list(entityType: string, entityId: string) {
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(entityId)) throw new AppError("ATTACHMENT_INVALID_TARGET_ID", "Target id must be a UUID", 400);
    const type = AttachmentTargetAdapter.resolve(entityType);
    await this.targets.assertExists(type, entityId);
    return (await this.prisma.attachment.findMany({ where: { entityType: type, entityId }, orderBy: { createdAt: "asc" } })).map(publicDto);
  }
  async detail(id: string) {
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id)) throw new AppError("ATTACHMENT_INVALID_ID", "Attachment id must be a UUID", 400);
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new AppError("ATTACHMENT_NOT_FOUND", "Attachment not found", 404);
    await this.targets.assertExists(attachment.entityType, attachment.entityId);
    return publicDto(attachment);
  }
  async downloadUrl(id: string, seconds: number) {
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id)) throw new AppError("ATTACHMENT_INVALID_ID", "Attachment id must be a UUID", 400);
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new AppError("ATTACHMENT_NOT_FOUND", "Attachment not found", 404);
    await this.targets.assertExists(attachment.entityType, attachment.entityId);
    if (!await this.storage.exists(attachment.storageKey)) throw new AppError("ATTACHMENT_STORAGE_NOT_FOUND", "Attachment object was not found", 404);
    return this.storage.createSignedDownloadUrl(attachment.storageKey, seconds);
  }
}
function publicDto(attachment: { id: string; entityType: AttachmentEntityType; entityId: string; fileName: string; mimeType: string; fileSize: number; storageProvider: string; uploadedByUserId: string; createdAt: Date; observations: string | null }) {
  return { id: attachment.id, entityType: attachment.entityType, entityId: attachment.entityId, fileName: attachment.fileName, mimeType: attachment.mimeType, fileSize: attachment.fileSize, storageProvider: attachment.storageProvider, uploadedByUserId: attachment.uploadedByUserId, createdAt: attachment.createdAt, observations: attachment.observations };
}