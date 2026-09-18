import type { DocType } from "./doc-type.js";
import { articuloDocType } from "../articulos/articulo.doc-type.js";
import { productDocType } from "../products/product.doc-type.js";
import { purchaseDocType } from "../purchases/purchase.doc-type.js";
import { inventoryDocType } from "../inventory/inventory.doc-type.js";
import { compraDocType } from "../compras/compra.doc-type.js";
import { productionDocType } from "../production/production.doc-type.js";

export const businessDocTypes: readonly DocType[] = [
  articuloDocType,
  productDocType,
  purchaseDocType,
  inventoryDocType,
  compraDocType,
  productionDocType,
];
