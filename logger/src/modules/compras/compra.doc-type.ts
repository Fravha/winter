import type { DocType } from "../doc-types/doc-type.js";
import type { CompraApi } from "./compra.api.js";
import { CompraService } from "./compra.service.js";
import { createCompraRouter } from "./compra.routes.js";

export const compraDocType: DocType<CompraApi> = {
  name: "compras",
  route: "/compras",
  permissions: [
    "read",
    "create",
    "update",
    "receive",
    "cancel",
  ].map((suffix) => ({
    code: `compras:${suffix}`,
    name: `Compras ${suffix}`,
  })),
  dependencies: ["articulos", "inventory"],
  register(dependencies, resolve) {
    const service = new CompraService(
      dependencies.prisma,
      resolve("articulos"),
      resolve("inventory"),
    );
    return {
      api: service,
      router: createCompraRouter(
        dependencies.tokenVerifier,
        dependencies.userRepository,
        service,
      ),
    };
  },
};