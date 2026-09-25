import type { DocType } from "../doc-types/doc-type.js";
import type { CompraApi } from "../compras/compra.api.js";
import type { InventoryApi } from "../inventory/inventory.api.js";
import type { ProductionApi } from "../production/production.api.js";
import type { ArticulosApi } from "../articulos/articulos.api.js";
import type { ReportsApi } from "./reports.api.js";
import { ReportsService } from "./reports.service.js";
import { createReportsRouter } from "./reports.routes.js";

export const reportsDocType: DocType<ReportsApi> = {
  name: "reports",
  route: "/reports",
  permissions: [{ code: "reports:export", name: "Export operational reports" }],
  dependencies: ["articulos", "compras", "inventory", "production"],
  register(dependencies, resolve) {
    const service = new ReportsService(
      resolve<InventoryApi>("inventory"),
      resolve<CompraApi>("compras"),
      resolve<ProductionApi>("production"),
      dependencies.auditService,
      resolve<ArticulosApi>("articulos"),
    );
    return {
      api: service,
      router: createReportsRouter(dependencies.tokenVerifier, dependencies.userRepository, service),
    };
  },
};