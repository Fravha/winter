import type { RequestHandler } from "express";
import type { Request } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { ExecutionContext } from "./inventory.model.js";
import type { InventoryService } from "./inventory.service.js";
const context = (req: Request): ExecutionContext => {
 if (!req.currentUser) throw new AppError("AUTH_REQUIRED", "Authentication is required", 401);
 const requestId = req.get("x-request-id");
 return { actorUserId: req.currentUser.id, permissions: req.currentUser.permissions, ...(requestId ? { requestId } : {}) };
};
export class InventoryController {
 constructor(private readonly service: InventoryService) {}
 command(method: (body: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>): RequestHandler { return async (req, res, next) => { try { const key = req.get("Idempotency-Key"); if (!key?.trim()) throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required", 400); const body: Record<string, unknown> = { ...req.body, ...req.params, idempotencyKey: key.trim() }; res.status(201).json({ data: await method(body, context(req)), meta: { requestId: req.get("x-request-id") ?? null } }); } catch (e) { next(e); } }; }
 get(method: (params: Record<string, string>) => Promise<unknown>): RequestHandler { return async (req, res, next) => { try { res.json({ data: await method({ ...req.params, ...req.query } as Record<string, string>), meta: { requestId: req.get("x-request-id") ?? null } }); } catch (e) { next(e); } }; }
}