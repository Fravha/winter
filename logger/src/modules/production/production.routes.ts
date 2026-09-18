import { Router } from "express";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import { authenticate, resolveCurrentUser } from "../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { ProductionController } from "./production.controller.js";
import { catalogInputSchema, administrativeCatalogInputSchema, catalogUpdateSchema, idParamsSchema, listSchema, customDefinitionSchema, customDefinitionUpdateSchema, customValueSchema, orderListSchema, productionOrderCreateSchema, transformationOrderCreateSchema } from "./production.schema.js";
import type { ProductionService } from "./production.service.js";
const manage: Record<string, string> = { participants: "production:participant_manage", producers: "production:producer_manage", "grape-varieties": "production:grape_variety_manage", "work-types": "production:work_type_manage", "measurement-types": "production:measurement_type_manage" };
export function createProductionRouter(verifier: TokenVerifier, users: UserRepository, service: ProductionService) {
  const router = Router(); const auth = [authenticate(verifier), resolveCurrentUser(users)] as const;
  for (const kind of ["participants", "producers", "grape-varieties", "work-types", "measurement-types"] as const) {
    const r = Router(); const permission = manage[kind]!; const controller = new ProductionController(service, kind);
    r.get("/", ...auth, requirePermission("production:read"), validateRequest({ query: listSchema }), controller.list);
    r.post("/", ...auth, requirePermission(permission), validateRequest({ body: kind === "participants" ? catalogInputSchema : administrativeCatalogInputSchema }), controller.create);
    r.patch("/:id", ...auth, requirePermission(permission), validateRequest({ params: idParamsSchema, body: catalogUpdateSchema }), controller.update);
    r.post("/:id/activate", ...auth, requirePermission(permission), validateRequest({ params: idParamsSchema }), controller.activate);
    r.post("/:id/deactivate", ...auth, requirePermission(permission), validateRequest({ params: idParamsSchema }), controller.deactivate);
    router.use(`/${kind}`, r);
  }
  const controller = new ProductionController(service, "participants");
  router.get("/orders", ...auth, requirePermission("production:read"), validateRequest({ query: orderListSchema }), controller.listOrders);
  router.get("/orders/:id", ...auth, requirePermission("production:read"), validateRequest({ params: idParamsSchema }), controller.getOrder);
  router.post("/orders", ...auth, requirePermission("production:order_create"), validateRequest({ body: productionOrderCreateSchema }), controller.createOrder);
  router.post("/orders/:id/close", ...auth, requirePermission("production:order_close"), validateRequest({ params: idParamsSchema }), controller.closeOrder);
  router.get("/transformation-orders", ...auth, requirePermission("production:read"), validateRequest({ query: orderListSchema }), controller.listTransformationOrders);
  router.get("/transformation-orders/:id", ...auth, requirePermission("production:read"), validateRequest({ params: idParamsSchema }), controller.getTransformationOrder);
  router.post("/transformation-orders", ...auth, requirePermission("production:transformation_order_create"), validateRequest({ body: transformationOrderCreateSchema }), controller.createTransformationOrder);
  router.post("/transformation-orders/:id/close", ...auth, requirePermission("production:transformation_order_close"), validateRequest({ params: idParamsSchema }), controller.closeTransformationOrder);
  router.get("/custom-fields/definitions", ...auth, requirePermission("production:read"), controller.definitions);
  router.post("/custom-fields/definitions", ...auth, requirePermission("production:custom_fields_manage"), validateRequest({ body: customDefinitionSchema }), controller.createDefinition);
  router.patch("/custom-fields/definitions/:id", ...auth, requirePermission("production:custom_fields_manage"), validateRequest({ params: idParamsSchema, body: customDefinitionUpdateSchema }), controller.updateDefinition);
  router.post("/custom-fields/definitions/:id/activate", ...auth, requirePermission("production:custom_fields_manage"), validateRequest({ params: idParamsSchema }), controller.activateDefinition);
  router.post("/custom-fields/definitions/:id/deactivate", ...auth, requirePermission("production:custom_fields_manage"), validateRequest({ params: idParamsSchema }), controller.deactivateDefinition);
  router.put("/custom-fields/values", ...auth, requirePermission("production:custom_fields_manage"), validateRequest({ body: customValueSchema }), controller.setValue);
  return router;
}