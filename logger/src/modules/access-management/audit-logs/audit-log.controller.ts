import type { NextFunction, Request, Response } from "express";
import type { AuditLogListResponse, AuditLogService } from "./audit-log.service.js";
import { auditLogQuerySchema } from "./audit-log.schema.js";

export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const result = await this.service.list(query);
      res.status(200).json(result satisfies AuditLogListResponse);
    } catch (error) {
      next(error);
    }
  };
}