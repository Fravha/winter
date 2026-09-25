import type {
  InventoryMovementsReportFilters,
  ProductionWorksReportFilters,
  PurchasesReportFilters,
  StockReportFilters,
  TraceabilityReportFilters,
  TransformationsReportFilters,
  ReportFile,
} from "./reports.types.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";

export interface ReportOptionsFilters {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

export interface ReportOptionsPage<T> {
  items: readonly T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ReportsApi {
  listArticleOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; codigo: string; nombre: string; clasificacion: string; unidadMedida: string }>>;
  listWarehouseOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; codigo: string; nombre: string }>>;
  listProductionOrderOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; code: string; status: string }>>;
  listTransformationOrderOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; code: string; status: string }>>;
  listBatchOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; code: string; productionOrderId: string; articuloId: string }>>;
  listWorkTypeOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; code: string; name: string }>>;
  listContainerOptions(filters: ReportOptionsFilters): Promise<ReportOptionsPage<{ id: string; code: string; name: string | null; status: string }>>;
  exportStock(filters: StockReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile>;
  exportInventoryMovements(filters: InventoryMovementsReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile>;
  exportPurchases(filters: PurchasesReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile>;
  exportProductionWorks(filters: ProductionWorksReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile>;
  exportTransformations(filters: TransformationsReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile>;
  exportTraceability(filters: TraceabilityReportFilters, context: AuthenticatedAuditContext): Promise<ReportFile>;
}