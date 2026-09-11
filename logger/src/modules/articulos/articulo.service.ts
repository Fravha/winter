import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateArticuloDto, UpdateArticuloDto } from "./articulo.dto.js";
import type { ArticuloRepository } from "./articulo.repository.js";
import type { ArticuloUnitOfWork } from "./articulo.unit-of-work.js";
import type { ArticulosApi } from "./articulos.api.js";
import {
  createArticuloSchema,
  updateArticuloSchema,
} from "./articulo.schema.js";
import type {
  ArticuloClassification,
  ListArticulosFilters,
} from "./articulo.model.js";

export class ArticuloService implements ArticulosApi {
  constructor(
    private readonly articuloRepository: ArticuloRepository,
    private readonly unitOfWork: ArticuloUnitOfWork,
  ) {}

  async getArticulo({ articuloId }: { articuloId: string }) {
    const articulo = await this.articuloRepository.findById(articuloId);

    if (!articulo) {
      throw new AppError(
        "ARTICULO_NOT_FOUND",
        "Articulo not found",
        404,
      );
    }

    return articulo;
  }

  listArticulos(filters: ListArticulosFilters) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1) {
      throw new AppError("VALIDATION_ERROR", "Page must be an integer greater than or equal to 1", 400);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new AppError("VALIDATION_ERROR", "Page size must be an integer between 1 and 100", 400);
    }
    return this.articuloRepository.findAll({
      page,
      pageSize,
      ...(filters.search !== undefined ? { search: filters.search.trim() } : {}),
      ...(filters.clasificacion !== undefined
        ? { clasificacion: filters.clasificacion }
        : {}),
      ...(filters.activo !== undefined ? { activo: filters.activo } : {}),
    });
  }

  async validateArticulo({
    articuloId,
    allowedClassifications,
  }: {
    articuloId: string;
    allowedClassifications?: readonly ArticuloClassification[];
  }) {
    const articulo = await this.articuloRepository.findById(articuloId);

    if (
      !articulo
      || !articulo.activo
      || (
        allowedClassifications !== undefined
        && !allowedClassifications.includes(articulo.clasificacion)
      )
    ) {
      return { valid: false };
    }

    return { valid: true, articulo };
  }

  createArticulo(
    data: CreateArticuloDto,
    context: AuthenticatedAuditContext,
  ) {
    const parsed = createArticuloSchema.parse(data);
    const normalized: CreateArticuloDto = {
      codigo: parsed.codigo,
      ...(parsed.codigoExterno !== undefined
        ? { codigoExterno: parsed.codigoExterno }
        : {}),
      nombre: parsed.nombre,
      clasificacion: parsed.clasificacion,
      unidadMedida: parsed.unidadMedida,
    };
    return this.unitOfWork.execute(async ({ articulos, audit }) => {
      if (await articulos.findByCodeInsensitive(normalized.codigo)) {
        throw new AppError(
          "ARTICULO_CODE_ALREADY_EXISTS",
          "An articulo with this code already exists",
          409,
        );
      }
      const articulo = await articulos.create(normalized);
      await audit.record(context, {
        action: "ARTICULO_CREATED",
        resourceType: "articulo",
        resourceId: articulo.id,
        metadata: { codigo: articulo.codigo },
      });
      return articulo;
    });
  }

  updateArticulo(
    articuloId: string,
    data: UpdateArticuloDto,
    context: AuthenticatedAuditContext,
  ) {
    const parsed = updateArticuloSchema.parse(data);
    const allowedData: UpdateArticuloDto = {
      ...(parsed.codigoExterno !== undefined
        ? {
            codigoExterno: parsed.codigoExterno === null
              ? null
              : parsed.codigoExterno,
          }
        : {}),
      ...(parsed.nombre !== undefined ? { nombre: parsed.nombre } : {}),
      ...(parsed.clasificacion !== undefined
        ? { clasificacion: parsed.clasificacion }
        : {}),
      ...(parsed.unidadMedida !== undefined
        ? { unidadMedida: parsed.unidadMedida }
        : {}),
    };
    return this.unitOfWork.execute(async ({ articulos, audit }) => {
      const existing = await this.requireArticulo(articulos, articuloId);
      const articulo = await articulos.update(articuloId, allowedData);
      await audit.record(context, {
        action: "ARTICULO_UPDATED",
        resourceType: "articulo",
        resourceId: articulo.id,
        metadata: {
          codigo: existing.codigo,
          changedFields: Object.keys(allowedData).sort(),
        },
      });
      return articulo;
    });
  }

  activateArticulo(
    articuloId: string,
    context: AuthenticatedAuditContext,
  ) {
    return this.changeActive(articuloId, true, context);
  }

  deactivateArticulo(
    articuloId: string,
    context: AuthenticatedAuditContext,
  ) {
    return this.changeActive(articuloId, false, context);
  }

  private changeActive(
    articuloId: string,
    activo: boolean,
    context: AuthenticatedAuditContext,
  ) {
    return this.unitOfWork.execute(async ({ articulos, audit }) => {
      const existing = await this.requireArticulo(articulos, articuloId);
      const articulo = existing.activo === activo
        ? existing
        : await articulos.setActive(articuloId, activo);
      await audit.record(context, {
        action: activo ? "ARTICULO_ACTIVATED" : "ARTICULO_DEACTIVATED",
        resourceType: "articulo",
        resourceId: articulo.id,
        metadata: { codigo: articulo.codigo },
      });
      return articulo;
    });
  }

  private async requireArticulo(
    repository: ArticuloRepository,
    articuloId: string,
  ) {
    const articulo = await repository.findById(articuloId);
    if (!articulo) {
      throw new AppError("ARTICULO_NOT_FOUND", "Articulo not found", 404);
    }
    return articulo;
  }
}