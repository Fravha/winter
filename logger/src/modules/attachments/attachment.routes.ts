import { Router } from "express";
import multer from "multer";
import { authenticate, resolveCurrentUser } from "../../core/auth/auth.middleware.js";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { AttachmentService, MAX_ATTACHMENT_BYTES } from "./attachment.service.js";
import { AppError } from "../../shared/errors/app-error.js";

const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 3, parts: 4,
  fieldSize: 4096, headerPairs: 100,
} });
const uploadFile = (req: Parameters<import("express").RequestHandler>[0], res: Parameters<import("express").RequestHandler>[1], next: Parameters<import("express").RequestHandler>[2]) =>
  upload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const code = ["LIMIT_FILE_SIZE", "LIMIT_FIELD_VALUE"].includes(error.code) ? "ATTACHMENT_TOO_LARGE" :
        ["LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE", "LIMIT_FIELD_COUNT", "LIMIT_PART_COUNT", "LIMIT_FIELD_KEY", "LIMIT_HEADER_COUNT"].includes(error.code)
          ? "ATTACHMENT_MULTIPART_INVALID" : undefined;
      next(code ? new AppError(code, code === "ATTACHMENT_TOO_LARGE" ? "Attachment exceeds the configured attachment limit" : "Invalid multipart attachment request", code === "ATTACHMENT_TOO_LARGE" ? 413 : 400) : error);
    } else next(error);
  });
const productionRead = requirePermission("production:read");
const read = requirePermission("attachments:read");
const create = requirePermission("attachments:create");

export function createAttachmentRouter(verifier: TokenVerifier, users: UserRepository, service: AttachmentService, signedSeconds: number) {
  const router = Router();
  const auth = [authenticate(verifier), resolveCurrentUser(users), productionRead] as const;
  router.post("/", ...auth, create, uploadFile, async (req, res, next) => {
    try {
      if (!req.file) throw new AppError("ATTACHMENT_FILE_REQUIRED", "A file is required", 400);
      const unexpected = Object.keys(req.body).filter((key) => !["entityType", "entityId", "observations"].includes(key));
      if (unexpected.length > 0) throw new AppError("ATTACHMENT_MULTIPART_INVALID", "Invalid multipart attachment request", 400);
      const result = await service.create({ entityType: String(req.body.entityType ?? ""), entityId: String(req.body.entityId ?? ""), observations: req.body.observations, file: req.file, actorUserId: req.currentUser!.id });
      res.status(201).json(result);
    } catch (error) { next(error); }
  });
  router.get("/", ...auth, read, async (req, res, next) => {
    try { res.json(await service.list(String(req.query.entityType ?? ""), String(req.query.entityId ?? ""))); } catch (error) { next(error); }
  });
  router.get("/:id/download-url", ...auth, read, async (req, res, next) => {
    try { res.json({ url: await service.downloadUrl(String(req.params.id), signedSeconds), expiresIn: signedSeconds }); } catch (error) { next(error); }
  });
  router.get("/:id", ...auth, read, async (req, res, next) => {
    try { res.json(await service.detail(String(req.params.id))); } catch (error) { next(error); }
  });
  return router;
}