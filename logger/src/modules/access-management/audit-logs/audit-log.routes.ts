import { Router } from "express";
import { requirePermission } from "../../../core/access-control/authorization.middleware.js";
import { authenticate, resolveCurrentUser } from "../../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../../core/auth/auth.types.js";
import type { UserRepository } from "../../../core/users/user.repository.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../../shared/http/validate-request.js";
import { PrismaAuditRepository } from "../../../core/audit/prisma-audit.repository.js";
import { AuditLogController } from "./audit-log.controller.js";
import { AuditLogService } from "./audit-log.service.js";
import { auditLogQuerySchema } from "./audit-log.schema.js";

export function createAuditLogRouter(
  client: PrismaClient,
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
) {
  const controller = new AuditLogController(
    new AuditLogService(new PrismaAuditRepository(client)),
  );
  const router = Router();
  const auth = [
    authenticate(tokenVerifier),
    resolveCurrentUser(userRepository),
  ] as const;

  router.get(
    "/",
    ...auth,
    requirePermission("audit:read"),
    validateRequest({ query: auditLogQuerySchema }),
    controller.list,
  );

  return router;
}