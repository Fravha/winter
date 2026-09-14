import { Router } from "express";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import { authenticate, resolveCurrentUser } from "../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { CompraController } from "./compra.controller.js";
import { cancelCompraSchema, compraIdParamsSchema, createCompraSchema, listComprasSchema, receiveCompraSchema, updateCompraSchema } from "./compra.schema.js";
import type { CompraApi } from "./compra.api.js";

export function createCompraRouter(
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  api: CompraApi,
) {
  const controller = new CompraController(api);
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;
  router.get("/", ...auth, requirePermission("compras:read"), validateRequest({ query: listComprasSchema }), controller.list);
  router.get("/:id", ...auth, requirePermission("compras:read"), validateRequest({ params: compraIdParamsSchema }), controller.get);
  router.post("/", ...auth, requirePermission("compras:create"), validateRequest({ body: createCompraSchema }), controller.create);
  router.patch("/:id", ...auth, requirePermission("compras:update"), validateRequest({ params: compraIdParamsSchema, body: updateCompraSchema }), controller.update);
  router.post("/:id/receive", ...auth, requirePermission("compras:receive"), validateRequest({ params: compraIdParamsSchema, body: receiveCompraSchema }), controller.receive);
  router.post("/:id/cancel", ...auth, requirePermission("compras:cancel"), validateRequest({ params: compraIdParamsSchema, body: cancelCompraSchema }), controller.cancel);
  return router;
}