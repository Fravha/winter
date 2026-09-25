import type { DocType } from "./doc-type.js";
import { articuloDocType } from "../articulos/articulo.doc-type.js";
import { inventoryDocType } from "../inventory/inventory.doc-type.js";
import { compraDocType } from "../compras/compra.doc-type.js";
import { productionDocType } from "../production/production.doc-type.js";
import { attachmentDocType } from "../attachments/attachment.doc-type.js";
import { reportsDocType } from "../reports/reports.doc-type.js";

export const businessDocTypes: readonly DocType[] = [
  articuloDocType,
  inventoryDocType,
  compraDocType,
  productionDocType,
  attachmentDocType,
  reportsDocType,
];
