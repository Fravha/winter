import type {
  Articulo as PrismaArticulo,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateArticuloDto, UpdateArticuloDto } from "./articulo.dto.js";
import type {
  Articulo,
  ArticuloClassification,
  ArticuloUnit,
  ListArticulosFilters,
  PaginatedArticulos,
} from "./articulo.model.js";
import type { ArticuloRepository } from "./articulo.repository.js";

export class PrismaArticuloRepository implements ArticuloRepository {
  constructor(private readonly client: Pick<PrismaClient, "articulo">) {}

  async findById(id: string): Promise<Articulo | null> {
    const articulo = await this.client.articulo.findUnique({ where: { id } });
    return articulo ? this.toDomain(articulo) : null;
  }

  async findByCodeInsensitive(codigo: string): Promise<Articulo | null> {
    const articulo = await this.client.articulo.findFirst({
      where: { codigo: { equals: codigo, mode: "insensitive" } },
    });
    return articulo ? this.toDomain(articulo) : null;
  }

  async findAll(filters: ListArticulosFilters): Promise<PaginatedArticulos> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = {
      ...(filters.clasificacion !== undefined
        ? { clasificacion: filters.clasificacion }
        : {}),
      ...(filters.activo !== undefined ? { activo: filters.activo } : {}),
      ...(filters.search !== undefined
        ? {
            OR: [
              { codigo: { contains: filters.search, mode: "insensitive" as const } },
              { nombre: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [articulos, total] = await Promise.all([
      this.client.articulo.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.client.articulo.count({ where }),
    ]);

    return {
      items: articulos.map((articulo) => this.toDomain(articulo)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async create(data: CreateArticuloDto): Promise<Articulo> {
    try {
      const articulo = await this.client.articulo.create({
        data: {
          codigo: data.codigo,
          ...(data.codigoExterno !== undefined
            ? { codigoExterno: data.codigoExterno }
            : {}),
          nombre: data.nombre,
          clasificacion: data.clasificacion,
          unidadMedida: data.unidadMedida,
        },
      });
      return this.toDomain(articulo);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async update(id: string, data: UpdateArticuloDto): Promise<Articulo> {
    try {
      const articulo = await this.client.articulo.update({
        where: { id },
        data: {
          ...(data.codigoExterno !== undefined
            ? { codigoExterno: data.codigoExterno }
            : {}),
          ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
          ...(data.clasificacion !== undefined
            ? { clasificacion: data.clasificacion }
            : {}),
          ...(data.unidadMedida !== undefined
            ? { unidadMedida: data.unidadMedida }
            : {}),
        },
      });
      return this.toDomain(articulo);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async setActive(id: string, activo: boolean): Promise<Articulo> {
    try {
      const articulo = await this.client.articulo.update({
        where: { id },
        data: { activo },
      });
      return this.toDomain(articulo);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private toDomain(articulo: PrismaArticulo): Articulo {
    return {
      id: articulo.id,
      codigo: articulo.codigo,
      codigoExterno: articulo.codigoExterno,
      nombre: articulo.nombre,
      clasificacion: articulo.clasificacion as ArticuloClassification,
      unidadMedida: articulo.unidadMedida as ArticuloUnit,
      activo: articulo.activo,
      createdAt: articulo.createdAt,
      updatedAt: articulo.updatedAt,
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError(
          "ARTICULO_CODE_ALREADY_EXISTS",
          "An articulo with this code already exists",
          409,
        );
      }
      if (error.code === "P2025") {
        throw new AppError("ARTICULO_NOT_FOUND", "Articulo not found", 404);
      }
    }
    throw error;
  }
}