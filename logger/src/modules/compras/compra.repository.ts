import type { PrismaClient } from "../../generated/prisma/client.js";
import type { CreateCompraDto, UpdateCompraDto } from "./compra.dto.js";
import type { Compra, CompraListFilters } from "./compra.model.js";

export type CompraPrismaClient = Pick<
  PrismaClient,
  "compra" | "compraItem" | "compraInventoryMovementReference" | "auditLog"
>;

export interface CompraRepository {
  findAll(filters: CompraListFilters): Promise<{ items: Compra[]; total: number }>;
  findById(id: string): Promise<Compra | null>;
  create(data: CreateCompraDto & { createdByUserId: string }): Promise<Compra>;
  update(id: string, data: UpdateCompraDto): Promise<Compra>;
}