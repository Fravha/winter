import type { DocType } from "../doc-types/doc-type.js";
import { createProductionRouter } from "./production.routes.js";
import { ProductionService } from "./production.service.js";
import { ArticuloService } from "../articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../articulos/prisma-articulo.unit-of-work.js";
import { InventoryService } from "../inventory/inventory.service.js";
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
    { code: "production:container_assign", name: "Assign production batches to containers" },
    { code: "production:container_transfer", name: "Transfer production batches between containers" },
    { code: "production:work_create", name: "Create production work" },
    { code: "production:work_correct", name: "Correct production work" },
    { code: "production:work_input_create", name: "Create production work inputs" },
    { code: "production:work_input_reverse", name: "Reverse production work inputs" },
    { code: "production:reception_create", name: "Create grape receptions" },
    { code: "production:measurement_create", name: "Create production measurements" },
    { code: "production:transformation_create", name: "Create production transformations" },
    { code: "production:loss_create", name: "Create production losses" },
    { code: "production:inventory_release", name: "Release production to inventory" },
    { code: "production:measurement_correct", name: "Correct production measurements" },
    { code: "production:reception_correct", name: "Correct grape receptions" },
  ],
  register(dependencies) {
    const articulos = new ArticuloService(new PrismaArticuloRepository(dependencies.prisma), new PrismaArticuloUnitOfWork(dependencies.prisma));
    const inventory = new InventoryService(dependencies.prisma, articulos);
    const service = new ProductionService(dependencies.prisma, dependencies.auditService, articulos, inventory);
    return { api: service, router: createProductionRouter(dependencies.tokenVerifier, dependencies.userRepository, service) };
  },
};