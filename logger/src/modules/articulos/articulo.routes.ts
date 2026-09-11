import { Router } from "express";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import {
  authenticate,
  resolveCurrentUser,
} from "../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { ArticuloController } from "./articulo.controller.js";
import {
  articuloIdParamsSchema,
  createArticuloSchema,
  listArticulosQuerySchema,
  updateArticuloSchema,
} from "./articulo.schema.js";
import type { ArticuloService } from "./articulo.service.js";

export function createArticuloRouter(
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  service: ArticuloService,
) {
  const controller = new ArticuloController(service);
  const router = Router();
  const auth = [
    authenticate(tokenVerifier),
    resolveCurrentUser(userRepository),
  ] as const;

  router.get(
    "/",
    ...auth,
    requirePermission("articulos:read"),
    validateRequest({ query: listArticulosQuerySchema }),
    controller.list,
  );
  router.get(
    "/:id",
    ...auth,
    requirePermission("articulos:read"),
    validateRequest({ params: articuloIdParamsSchema }),
    controller.get,
  );
  router.post(
    "/",
    ...auth,
    requirePermission("articulos:create"),
    validateRequest({ body: createArticuloSchema }),
    controller.create,
  );
  router.patch(
    "/:id",
    ...auth,
    requirePermission("articulos:update"),
    validateRequest({
      params: articuloIdParamsSchema,
      body: updateArticuloSchema,
    }),
    controller.update,
  );
  router.post(
    "/:id/activate",
    ...auth,
    requirePermission("articulos:activate"),
    validateRequest({ params: articuloIdParamsSchema }),
    controller.activate,
  );
  router.post(
    "/:id/deactivate",
    ...auth,
    requirePermission("articulos:deactivate"),
    validateRequest({ params: articuloIdParamsSchema }),
    controller.deactivate,
  );

  return router;
}