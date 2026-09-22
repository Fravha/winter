export const COMPRA_STATUSES = ['REGISTERED', 'RECEIVED', 'CANCELLED'] as const;
export type CompraStatus = (typeof COMPRA_STATUSES)[number];

export const COMPRA_UNITS = ['KG', 'G', 'L', 'M', 'UNIDAD'] as const;
export type CompraUnit = (typeof COMPRA_UNITS)[number];

export type CompraItem = {
  id: string;
  compraId: string;
  articuloId: string;
  brand: string | null;
  requestedQuantity: string;
  unit: CompraUnit;
  unitPrice: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Compra = {
  id: string;
  supplierName: string;
  supplierTaxId: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  currency: string | null;
  observations: string | null;
  status: CompraStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  items: CompraItem[];
};

export type ComprasListFilters = {
  page?: number;
  pageSize?: number;
  status?: CompraStatus;
};

export type ComprasListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ComprasListResponse = {
  items: Compra[];
  meta: ComprasListMeta;
};

export type CompraItemInput = {
  articuloId: string;
  brand?: string;
  requestedQuantity: string;
  unit: CompraUnit;
  unitPrice?: string;
};

export type CreateCompraInput = {
  supplierName: string;
  supplierTaxId?: string;
  documentNumber?: string;
  documentDate?: string;
  currency?: string;
  observations?: string;
  items: CompraItemInput[];
};

export type UpdateCompraInput = {
  supplierName?: string;
  supplierTaxId?: string | null;
  documentNumber?: string | null;
  documentDate?: string | null;
  currency?: string | null;
  observations?: string | null;
  items?: CompraItemInput[];
};

export type ReceiveCompraInput = {
  warehouseId: string;
  items?: Array<{ compraItemId: string; inventoryLotId?: string }>;
};

export type CancelCompraInput = {
  reason?: string;
};