import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../shared/http/audit-context.js";
import type { CompraApi } from "./compra.api.js";

type IdParams = { id: string };

export class CompraController {
  constructor(private readonly service: CompraApi) {}

  list = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const query = request.query as {
        page?: string;
        pageSize?: string;
        status?: "REGISTERED" | "RECEIVED" | "CANCELLED";
      };
      const result = await this.service.list({
        page: query.page === undefined ? 1 : Number(query.page),
        pageSize: query.pageSize === undefined ? 20 : Number(query.pageSize),
        ...(query.status === undefined ? {} : { status: query.status }),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  get = async (request: Request<IdParams>, response: Response, next: NextFunction) => {
    try {
      response.status(200).json({ data: await this.service.get(request.params.id) });
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.status(201).json({ data: await this.service.create(request.body, buildAuthenticatedAuditContext(request, response)) });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request<IdParams>, response: Response, next: NextFunction) => {
    try {
      response.status(200).json({ data: await this.service.update(request.params.id, request.body, buildAuthenticatedAuditContext(request, response)) });
    } catch (error) {
      next(error);
    }
  };

  receive = async (request: Request<IdParams>, response: Response, next: NextFunction) => {
    try {
      response.status(200).json({ data: await this.service.receive(request.params.id, request.body, buildAuthenticatedAuditContext(request, response)) });
    } catch (error) {
      next(error);
    }
  };

  cancel = async (request: Request<IdParams>, response: Response, next: NextFunction) => {
    try {
      response.status(200).json({ data: await this.service.cancel(request.params.id, request.body, buildAuthenticatedAuditContext(request, response)) });
    } catch (error) {
      next(error);
    }
  };
}