import type { DocType } from "../doc-types/doc-type.js";
import { createProductionRouter } from "./production.routes.js";
import { ProductionService } from "./production.service.js";
export const productionDocType: DocType = {
  name: "production", route: "/production",
  permissions: [
    { code: "production:read", name: "Read production catalogs" },
    { code: "production:participant_manage", name: "Manage production participants" },
    { code: "production:producer_manage", name: "Manage producers" },
    { code: "production:grape_variety_manage", name: "Manage grape varieties" },
    { code: "production:custom_fields_manage", name: "Manage production custom fields" },
    { code: "production:work_type_manage", name: "Manage production work types" },
    { code: "production:measurement_type_manage", name: "Manage production measurement types" },
    { code: "production:order_create", name: "Create production orders" },
    { code: "production:order_close", name: "Close production orders" },
    { code: "production:transformation_order_create", name: "Create transformation orders" },
    { code: "production:transformation_order_close", name: "Close transformation orders" },
    { code: "production:container_manage", name: "Manage production containers" },
  ],
  register(dependencies) {
    const service = new ProductionService(dependencies.prisma, dependencies.auditService);
    return { api: service, router: createProductionRouter(dependencies.tokenVerifier, dependencies.userRepository, service) };
  },
};