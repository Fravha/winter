import { Prisma, type Compra as PrismaCompra, type CompraItem as PrismaCompraItem } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateCompraDto, UpdateCompraDto } from "./compra.dto.js";
import type { Compra, CompraItem, CompraListFilters } from "./compra.model.js";
import type { CompraPrismaClient, CompraRepository } from "./compra.repository.js";

type CompraWithItems = PrismaCompra & { items: PrismaCompraItem[] };

export class PrismaCompraRepository implements CompraRepository {
  constructor(private readonly client: CompraPrismaClient) {}

  async findAll(filters: CompraListFilters): Promise<{ items: Compra[]; total: number }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = filters.status === undefined ? {} : { status: filters.status };
    const [rows, total] = await Promise.all([
      this.client.compra.findMany({
        where,
        include: { items: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.client.compra.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDomain(row)), total };
  }

  async findById(id: string): Promise<Compra | null> {
    const row = await this.client.compra.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: CreateCompraDto & { createdByUserId: string }): Promise<Compra> {
    try {
      const row = await this.client.compra.create({
        data: {
          supplierName: data.supplierName,
          supplierTaxId: data.supplierTaxId ?? null,
          documentNumber: data.documentNumber ?? null,
          documentDate: data.documentDate ?? null,
          currency: data.currency ?? null,
          observations: data.observations ?? null,
          createdByUserId: data.createdByUserId,
          items: {
            create: data.items.map((item) => ({
              articuloId: item.articuloId,
              brand: item.brand ?? null,
              requestedQuantity: item.requestedQuantity,
              unit: item.unit,
              unitPrice: item.unitPrice ?? null,
            })),
          },
        },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
      return this.toDomain(row);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(id: string, data: UpdateCompraDto): Promise<Compra> {
    try {
      const existing = await this.client.compra.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      const updated = await this.client.compra.update({
        where: { id },
        data: {
          ...(data.supplierName === undefined ? {} : { supplierName: data.supplierName }),
          ...(data.supplierTaxId === undefined ? {} : { supplierTaxId: data.supplierTaxId }),
          ...(data.documentNumber === undefined ? {} : { documentNumber: data.documentNumber }),
          ...(data.documentDate === undefined ? {} : { documentDate: data.documentDate }),
          ...(data.currency === undefined ? {} : { currency: data.currency }),
          ...(data.observations === undefined ? {} : { observations: data.observations }),
          ...(data.items === undefined ? {} : {}),
        },
      });
      if (data.items !== undefined) {
        const existingByArticle = new Map(existing.items.map((item) => [item.articuloId, item]));
        for (const item of data.items) {
          const previous = existingByArticle.get(item.articuloId);
          if (previous) {
            await this.client.compraItem.update({
              where: { id: previous.id },
              data: {
                brand: item.brand ?? null,
                requestedQuantity: item.requestedQuantity,
                unit: item.unit,
                unitPrice: item.unitPrice ?? null,
              },
            });
          } else {
            await this.client.compraItem.create({
              data: {
                compraId: id,
                articuloId: item.articuloId,
                brand: item.brand ?? null,
                requestedQuantity: item.requestedQuantity,
                unit: item.unit,
                unitPrice: item.unitPrice ?? null,
              },
            });
          }
        }
      }
      const result = await this.findById(id);
      if (!result) throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      return result;
    } catch (error) {
      this.rethrow(error);
    }
  }

  private toDomain(row: CompraWithItems): Compra {
    return {
      id: row.id,
      supplierName: row.supplierName,
      supplierTaxId: row.supplierTaxId,
      documentNumber: row.documentNumber,
      documentDate: row.documentDate,
      currency: row.currency,
      observations: row.observations,
      status: row.status,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: row.items.map((item): CompraItem => ({
        id: item.id,
        compraId: item.compraId,
        articuloId: item.articuloId,
        brand: item.brand,
        requestedQuantity: item.requestedQuantity.toString(),
        unit: item.unit,
        unitPrice: item.unitPrice?.toString() ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError("COMPRA_DUPLICATE_ITEM", "An articulo cannot be repeated in a compra", 409);
      }
      if (error.code === "P2025") {
        throw new AppError("COMPRA_NOT_FOUND", "Compra not found", 404);
      }
    }
    throw error;
  }
}