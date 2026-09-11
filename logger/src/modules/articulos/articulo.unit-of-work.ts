import type { AuditService } from "../../core/audit/audit.service.js";
import type { ArticuloRepository } from "./articulo.repository.js";

export interface ArticuloTransaction {
  articulos: ArticuloRepository;
  audit: AuditService;
}

export interface ArticuloUnitOfWork {
  execute<T>(
    work: (transaction: ArticuloTransaction) => Promise<T>,
  ): Promise<T>;
}