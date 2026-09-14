import { Router } from "express";
import { authenticate, resolveCurrentUser } from "../../core/auth/auth.middleware.js";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { InventoryController } from "./inventory.controller.js";
import { movementSchema, transferSchema, warehouseSchema, adjustmentSchema, classificationSchema } from "./inventory.schema.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import type { InventoryService } from "./inventory.service.js";
import type { MovementInput, TransferInput, AdjustmentInput, WarehouseInput } from "./inventory.dto.js";
export function createInventoryRouter(verifier: TokenVerifier, users: UserRepository, service: InventoryService) {
    const router = Router(), auth = [authenticate(verifier), resolveCurrentUser(users)] as const, c = new InventoryController(service);
    router.get("/warehouses", ...auth, requirePermission("inventory:read"), c.get((p) => service.listWarehouses(p)));
    router.get("/warehouses/:warehouseId", ...auth, requirePermission("inventory:read"), c.get((p) => service.getWarehouse(p as { warehouseId: string })));
    router.post("/warehouses", ...auth, requirePermission("inventory:warehouse_create"), validateRequest({ body: warehouseSchema }), c.command((b, x) => service.createWarehouse(b as unknown as WarehouseInput, x)));
    router.patch("/warehouses/:id", ...auth, requirePermission("inventory:warehouse_update"), validateRequest({ body: warehouseSchema }), c.command((b, x) => service.updateWarehouse(String(b.id), b as unknown as WarehouseInput, x)));
    router.post("/warehouses/:id/deactivate", ...auth, requirePermission("inventory:warehouse_deactivate"), c.command((b, x) => service.setWarehouseActive(String(b.id), false, x)));
    router.post("/warehouses/:id/activate", ...auth, requirePermission("inventory:warehouse_activate"), c.command((b, x) => service.setWarehouseActive(String(b.id), true, x)));
    router.get("/stock", ...auth, requirePermission("inventory:read"), c.get((p) => service.getStock(p as { warehouseId: string; articuloId: string; inventoryLotId?: string })));
    router.get("/stock/available", ...auth, requirePermission("inventory:read"), c.get((p) => service.getAvailableQuantity(p as { warehouseId: string; articuloId: string; inventoryLotId?: string })));
    router.get("/lots/:inventoryLotId", ...auth, requirePermission("inventory:read"), c.get((p) => service.getInventoryLot(p as { inventoryLotId: string })));
    router.post(
        "/lots/:inventoryLotId/classification",
        ...auth,
        requirePermission("inventory:lot_classify"),
        validateRequest({ body: classificationSchema }),
        c.idempotentCommand((b, x) =>
            service.transitionInventoryLotClassification(
                {
                    inventoryLotId: String(b.inventoryLotId),
                    classification: b.classification as
                        | "PRODUCTO_ENVASADO"
                        | "PRODUCTO_TERMINADO"
                        | "PRODUCTO_TERMINADO_EXPORTACION",
                    idempotencyKey: String(b.idempotencyKey),
                },
                x,
            ),
        ),
    );

    router.post(
        "/inbound",
        ...auth,
        requirePermission("inventory:inbound"),
        validateRequest({ body: movementSchema }),
        c.idempotentCommand((b, x) =>
            service.registerInbound(b as unknown as MovementInput, x),
        ),
    );

    router.post(
        "/outbound",
        ...auth,
        requirePermission("inventory:outbound"),
        validateRequest({ body: movementSchema }),
        c.idempotentCommand((b, x) =>
            service.registerOutbound(b as unknown as MovementInput, x),
        ),
    );

    router.post(
        "/transfer",
        ...auth,
        requirePermission("inventory:transfer"),
        validateRequest({ body: transferSchema }),
        c.idempotentCommand((b, x) =>
            service.registerTransfer(b as unknown as TransferInput, x),
        ),
    );

    router.post(
        "/adjustment",
        ...auth,
        requirePermission("inventory:adjust"),
        validateRequest({ body: adjustmentSchema }),
        c.idempotentCommand((b, x) =>
            service.registerAdjustment(b as unknown as AdjustmentInput, x),
        ),
    );
    
    return router;
}