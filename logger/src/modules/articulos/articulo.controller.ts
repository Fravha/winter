import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../shared/http/audit-context.js";
import {
  createArticuloSchema,
  listArticulosQuerySchema,
  updateArticuloSchema,
} from "./articulo.schema.js";
import type { ArticuloService } from "./articulo.service.js";

type ParamsWithId = { id: string };

export class ArticuloController {
  constructor(private readonly service: ArticuloService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listArticulosQuerySchema.parse(req.query);
      const result = await this.service.listArticulos({
        page: parsed.page,
        pageSize: parsed.pageSize,
        ...(parsed.search !== undefined ? { search: parsed.search } : {}),
        ...(parsed.clasificacion !== undefined
          ? { clasificacion: parsed.clasificacion }
          : {}),
        ...(parsed.activo !== undefined ? { activo: parsed.activo } : {}),
      });
      res.status(200).json({
        data: result.items,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  get = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const articulo = await this.service.getArticulo({
        articuloId: req.params.id,
      });
      res.status(200).json({ data: articulo });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createArticuloSchema.parse(req.body);
      const data = {
        codigo: parsed.codigo,
        ...(parsed.codigoExterno !== undefined
          ? { codigoExterno: parsed.codigoExterno }
          : {}),
        nombre: parsed.nombre,
        clasificacion: parsed.clasificacion,
        unidadMedida: parsed.unidadMedida,
      };
      const articulo = await this.service.createArticulo(
        data,
        buildAuthenticatedAuditContext(req, res),
      );
      res.status(201).json({ data: articulo });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const parsed = updateArticuloSchema.parse(req.body);
      const data = {
        ...(parsed.codigoExterno !== undefined
          ? { codigoExterno: parsed.codigoExterno }
          : {}),
        ...(parsed.nombre !== undefined ? { nombre: parsed.nombre } : {}),
        ...(parsed.clasificacion !== undefined
          ? { clasificacion: parsed.clasificacion }
          : {}),
        ...(parsed.unidadMedida !== undefined
          ? { unidadMedida: parsed.unidadMedida }
          : {}),
      };
      const articulo = await this.service.updateArticulo(
        req.params.id,
        data,
        buildAuthenticatedAuditContext(req, res),
      );
      res.status(200).json({ data: articulo });
    } catch (error) {
      next(error);
    }
  };

  activate = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const articulo = await this.service.activateArticulo(
        req.params.id,
        buildAuthenticatedAuditContext(req, res),
      );
      res.status(200).json({ data: articulo });
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const articulo = await this.service.deactivateArticulo(
        req.params.id,
        buildAuthenticatedAuditContext(req, res),
      );
      res.status(200).json({ data: articulo });
    } catch (error) {
      next(error);
    }
  };
}