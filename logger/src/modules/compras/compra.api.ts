import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import type { CancelCompraDto, CreateCompraDto, ListComprasDto, ReceiveCompraDto, UpdateCompraDto } from "./compra.dto.js";
import type { Compra } from "./compra.model.js";

export interface CompraApi {
  list(input?: ListComprasDto): Promise<{
    data: readonly Compra[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }>;
  get(id: string): Promise<Compra>;
  create(input: CreateCompraDto, context: AuthenticatedAuditContext): Promise<Compra>;
  update(id: string, input: UpdateCompraDto, context: AuthenticatedAuditContext): Promise<Compra>;
  receive(id: string, input: ReceiveCompraDto, context: AuthenticatedAuditContext): Promise<Compra>;
  cancel(id: string, input: CancelCompraDto, context: AuthenticatedAuditContext): Promise<Compra>;
}