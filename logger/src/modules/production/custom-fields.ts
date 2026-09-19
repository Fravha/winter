import { Prisma } from "../../generated/prisma/client.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";

export type CustomFieldValueInput = { definitionId: string; entityType: "PRODUCER" | "GRAPE_VARIETY" | "GRAPE_RECEPTION"; entityId: string; value: string | number | boolean };
const columns: Record<string, string> = { TEXT: "textValue", INTEGER: "integerValue", DECIMAL: "decimalValue", BOOLEAN: "booleanValue", DATE: "dateValue", SELECT: "selectValue" };

export async function persistCustomFieldValue(tx: SharedTransactionContext, data: CustomFieldValueInput, context?: AuthenticatedAuditContext) {
  const definition = await tx.customFieldDefinition.findUnique({ where: { id: data.definitionId } });
  if (!definition || definition.entityType !== data.entityType) throw new AppError("CUSTOM_FIELD_DEFINITION_NOT_FOUND", "Custom field definition not found", 404);
  if (!definition.active) throw new AppError("CUSTOM_FIELD_DEFINITION_INACTIVE", "Custom field definition is inactive", 409);
  const owner = data.entityType === "PRODUCER"
    ? await tx.producer.findUnique({ where: { id: data.entityId } })
    : data.entityType === "GRAPE_VARIETY"
      ? await tx.grapeVariety.findUnique({ where: { id: data.entityId } })
      : await tx.grapeReception.findUnique({ where: { id: data.entityId } });
  if (!owner) throw new AppError("CUSTOM_FIELD_ENTITY_NOT_FOUND", "Custom field entity not found", 404);
  if ("active" in owner && !owner.active) throw new AppError("CUSTOM_FIELD_ENTITY_INACTIVE", "Custom field entity is inactive", 409);
  const valid = (definition.dataType === "TEXT" && typeof data.value === "string") ||
    (definition.dataType === "INTEGER" && typeof data.value === "number" && Number.isInteger(data.value) && data.value >= -2147483648 && data.value <= 2147483647) ||
    (definition.dataType === "DECIMAL" && typeof data.value === "string" && /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(data.value)) ||
    (definition.dataType === "BOOLEAN" && typeof data.value === "boolean") ||
    (definition.dataType === "DATE" && typeof data.value === "string" && !Number.isNaN(Date.parse(data.value))) ||
    (definition.dataType === "SELECT" && typeof data.value === "string" && ((definition.options as string[] | null) ?? []).includes(data.value));
  if (!valid) throw new AppError("CUSTOM_FIELD_VALUE_INVALID", "Value does not match custom field type", 400);
  const field = columns[definition.dataType]!;
  const valueForDb = definition.dataType === "DATE" ? new Date(data.value as string) : data.value;
  const value = await tx.customFieldValue.upsert({
    where: { definitionId_entityId: { definitionId: data.definitionId, entityId: data.entityId } },
    update: { entityType: data.entityType, [field]: valueForDb },
    create: { definitionId: data.definitionId, entityType: data.entityType, entityId: data.entityId, [field]: valueForDb },
  });
  if (context) await new AuditService(new PrismaAuditRepository(tx)).record(context, { action: "PRODUCTION_CUSTOM_FIELD_VALUE_SET", resourceType: "production.custom_field_value", resourceId: value.id });
  return value;
}