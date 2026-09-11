import type { DocType } from "../doc-types/doc-type.js";
import type { InventoryApi } from "./inventory.api.js";
import { InventoryService } from "./inventory.service.js";
import { createInventoryRouter } from "./inventory.routes.js";
export const inventoryDocType: DocType<InventoryApi> = {
 name: "inventory", route: "/inventory",
 permissions: [
  "read","inbound","outbound","transfer","adjust","lot_classify","warehouse_create","warehouse_update","warehouse_activate","warehouse_deactivate","negative_stock_authorize",
 ].map((suffix) => ({ code: `inventory:${suffix}`, name: `Inventory ${suffix}` })),
 dependencies: ["articulos"],
 register(dependencies, resolve) { const service = new InventoryService(dependencies.prisma, resolve<import("../articulos/articulos.api.js").ArticulosApi>("articulos")); return { api: service, router: createInventoryRouter(dependencies.tokenVerifier, dependencies.userRepository, service) }; },
};