import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../shared/http/audit-context.js";
import type { ReportsApi } from "./reports.api.js";
import {
  inventoryMovementsQuerySchema,
  reportOptionsQuerySchema,
  purchasesQuerySchema,
  productionWorksQuerySchema,
  stockQuerySchema,
  traceabilityQuerySchema,
  transformationsQuerySchema,
} from "./reports.schema.js";
import { XLSX_CONTENT_TYPE } from "./reports.types.js";

export class ReportsController {
  constructor(private readonly reports: ReportsApi) {}

  private options = async (
    response: Response,
    result: Promise<{ items: readonly unknown[]; pagination: unknown }>,
  ) => {
    const page = await result;
    response.json({ data: page.items, meta: page.pagination });
  };

  articles = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listArticleOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };
  warehouses = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listWarehouseOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };
  productionOrders = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listProductionOrderOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };
  transformationOrders = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listTransformationOrderOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };
  batches = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listBatchOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };
  workTypes = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listWorkTypeOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };
  containers = async (request: Request, response: Response, next: NextFunction) => {
    try { await this.options(response, this.reports.listContainerOptions(reportOptionsQuerySchema.parse(request.query))); } catch (error) { next(error); }
  };

  private download = async (
    response: Response,
    report: Promise<{ filename: string; content: Buffer }>,
  ) => {
    const file = await report;
    response
      .status(200)
      .setHeader("Content-Type", XLSX_CONTENT_TYPE)
      .setHeader("Content-Disposition", `attachment; filename="${file.filename}"`)
      .setHeader("Content-Length", file.content.byteLength)
      .send(file.content);
  };

  stock = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const filters = stockQuerySchema.parse(request.query);
      await this.download(response, this.reports.exportStock(filters, buildAuthenticatedAuditContext(request, response)));
    } catch (error) { next(error); }
  };

  inventoryMovements = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const filters = inventoryMovementsQuerySchema.parse(request.query);
      await this.download(response, this.reports.exportInventoryMovements(filters, buildAuthenticatedAuditContext(request, response)));
    } catch (error) { next(error); }
  };

  purchases = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const filters = purchasesQuerySchema.parse(request.query);
      await this.download(response, this.reports.exportPurchases(filters, buildAuthenticatedAuditContext(request, response)));
    } catch (error) { next(error); }
  };

  productionWorks = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const filters = productionWorksQuerySchema.parse(request.query);
      await this.download(response, this.reports.exportProductionWorks(filters, buildAuthenticatedAuditContext(request, response)));
    } catch (error) { next(error); }
  };

  transformations = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const filters = transformationsQuerySchema.parse(request.query);
      await this.download(response, this.reports.exportTransformations(filters, buildAuthenticatedAuditContext(request, response)));
    } catch (error) { next(error); }
  };

  traceability = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const filters = traceabilityQuerySchema.parse(request.query);
      await this.download(response, this.reports.exportTraceability(filters, buildAuthenticatedAuditContext(request, response)));
    } catch (error) { next(error); }
  };
}