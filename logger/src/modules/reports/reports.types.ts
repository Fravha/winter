import type {
  inventoryMovementsQuerySchema,
  purchasesQuerySchema,
  productionWorksQuerySchema,
  stockQuerySchema,
  traceabilityQuerySchema,
  transformationsQuerySchema,
} from "./reports.schema.js";
import type { z } from "zod";

export type StockReportFilters = z.infer<typeof stockQuerySchema>;
export type InventoryMovementsReportFilters = z.infer<typeof inventoryMovementsQuerySchema>;
export type PurchasesReportFilters = z.infer<typeof purchasesQuerySchema>;
export type ProductionWorksReportFilters = z.infer<typeof productionWorksQuerySchema>;
export type TransformationsReportFilters = z.infer<typeof transformationsQuerySchema>;
export type TraceabilityReportFilters = z.infer<typeof traceabilityQuerySchema>;

export interface ReportFile {
  filename: string;
  content: Buffer;
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";