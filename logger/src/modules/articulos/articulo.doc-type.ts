import type { DocType } from "../doc-types/doc-type.js";
import { createArticuloRouter } from "./articulo.routes.js";
import { ArticuloService } from "./articulo.service.js";
import type { ArticulosApi } from "./articulos.api.js";
import { PrismaArticuloRepository } from "./prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "./prisma-articulo.unit-of-work.js";

export const articuloDocType: DocType<ArticulosApi> = {
  name: "articulos",
  route: "/articulos",
  permissions: [
    { code: "articulos:read", name: "Read articulos" },
    { code: "articulos:create", name: "Create articulos" },
    { code: "articulos:update", name: "Update articulos" },
    { code: "articulos:activate", name: "Activate articulos" },
    { code: "articulos:deactivate", name: "Deactivate articulos" },
  ],
  register(dependencies) {
    const service = new ArticuloService(
      new PrismaArticuloRepository(dependencies.prisma),
      new PrismaArticuloUnitOfWork(dependencies.prisma),
    );

    return {
      api: service,
      router: createArticuloRouter(
        dependencies.tokenVerifier,
        dependencies.userRepository,
        service,
      ),
    };
  },
};