import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AttachmentEntityType } from "../../generated/prisma/client.js";

type Target = { delegate: "grapeReception" | "productionWork" | "productionMeasurement" | "transformation" | "productionLoss"; label: string };
const targets: Record<AttachmentEntityType, Target> = {
  GRAPE_RECEPTION: { delegate: "grapeReception", label: "GrapeReception" },
  PRODUCTION_WORK: { delegate: "productionWork", label: "ProductionWork" },
  MEASUREMENT: { delegate: "productionMeasurement", label: "Measurement" },
  TRANSFORMATION: { delegate: "transformation", label: "Transformation" },
  PRODUCTION_LOSS: { delegate: "productionLoss", label: "ProductionLoss" },
};

export class AttachmentTargetAdapter {
  constructor(private readonly prisma: PrismaClient) {}
  async assertExists(entityType: AttachmentEntityType, entityId: string, client: PrismaClient = this.prisma) {
    const target = targets[entityType];
    if (!target) throw new AppError("ATTACHMENT_ENTITY_TYPE_UNSUPPORTED", "Unsupported attachment entity type", 400);
    const delegate = client[target.delegate] as unknown as { findUnique: (args: { where: { id: string } }) => Promise<unknown> };
    if (!await delegate.findUnique({ where: { id: entityId } })) {
      throw new AppError("ATTACHMENT_TARGET_NOT_FOUND", `${target.label} target was not found`, 404);
    }
  }
  static resolve(value: string): AttachmentEntityType {
    if (Object.prototype.hasOwnProperty.call(targets, value)) return value as AttachmentEntityType;
    throw new AppError("ATTACHMENT_ENTITY_TYPE_UNSUPPORTED", "Unsupported attachment entity type", 400);
  }
}