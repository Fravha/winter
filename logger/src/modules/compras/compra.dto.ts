import type { CompraStatus, CompraUnit } from "./compra.model.js";

export interface CompraItemInput {
  articuloId: string;
  brand?: string;
  requestedQuantity: string;
  unit: CompraUnit;
  unitPrice?: string;
}

export interface CreateCompraDto {
  supplierName: string;
  supplierTaxId?: string;
  documentNumber?: string;
  documentDate?: Date;
  currency?: string;
  observations?: string;
  items: readonly CompraItemInput[];
}

export interface UpdateCompraDto {
  supplierName?: string;
  supplierTaxId?: string | null;
  documentNumber?: string | null;
  documentDate?: Date | null;
  currency?: string | null;
  observations?: string | null;
  items?: readonly CompraItemInput[];
}

export interface ListComprasDto {
  page?: number;
  pageSize?: number;
  status?: CompraStatus;
}

export interface ReceiveCompraItemDto {
  compraItemId: string;
  inventoryLotId?: string;
}

export interface ReceiveCompraDto {
  warehouseId: string;
  items?: readonly ReceiveCompraItemDto[];
}

export interface CancelCompraDto {
  reason?: string;
}