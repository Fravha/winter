import { Router } from "express";
import type { RequestHandler } from "express";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import { authenticate, resolveCurrentUser } from "../../core/auth/auth.middleware.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { ReportsApi } from "./reports.api.js";
import {
  inventoryMovementsQuerySchema,
  purchasesQuerySchema,
  productionWorksQuerySchema,
  stockQuerySchema,
  traceabilityQuerySchema,
  transformationsQuerySchema,
  reportOptionsQuerySchema,
} from "./reports.schema.js";
import { ReportsController } from "./reports.controller.js";

let activeExports = 0;
const guardExport = (handler: RequestHandler): RequestHandler => async (request, response, next) => {
  if (activeExports >= 1) {
    next(new AppError("REPORT_EXPORT_BUSY", "Another report export is already being generated. Retry when it has completed.", 429));
    return;
  }
  activeExports += 1;
  try {
    await handler(request, response, next);
  } catch (error) {
    next(error);
  } finally {
    // Keep the slot until generation finishes, even if the client disconnects.
    activeExports -= 1;
  }
};

export function createReportsRouter(
  verifier: TokenVerifier,
  users: UserRepository,
  reports: ReportsApi,
) {
  const router = Router();
  const auth = [authenticate(verifier), resolveCurrentUser(users)] as const;
  const controller = new ReportsController(reports);
  const exportPermission = requirePermission("reports:export");

  router.get("/options/articles", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.articles);
  router.get("/options/warehouses", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.warehouses);
  router.get("/options/production-orders", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.productionOrders);
  router.get("/options/transformation-orders", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.transformationOrders);
  router.get("/options/batches", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.batches);
  router.get("/options/work-types", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.workTypes);
  router.get("/options/containers", ...auth, exportPermission, validateRequest({ query: reportOptionsQuerySchema }), controller.containers);

  router.get("/stock/export", ...auth, exportPermission, validateRequest({ query: stockQuerySchema }), guardExport(controller.stock));
  router.get("/inventory-movements/export", ...auth, exportPermission, validateRequest({ query: inventoryMovementsQuerySchema }), guardExport(controller.inventoryMovements));
  router.get("/purchases/export", ...auth, exportPermission, validateRequest({ query: purchasesQuerySchema }), guardExport(controller.purchases));
  router.get("/production-works/export", ...auth, exportPermission, validateRequest({ query: productionWorksQuerySchema }), guardExport(controller.productionWorks));
  router.get("/transformations/export", ...auth, exportPermission, validateRequest({ query: transformationsQuerySchema }), guardExport(controller.transformations));
  router.get("/traceability/export", ...auth, exportPermission, validateRequest({ query: traceabilityQuerySchema }), guardExport(controller.traceability));
  return router;
}