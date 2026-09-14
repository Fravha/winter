export type CompraStatus = "REGISTERED" | "RECEIVED" | "CANCELLED";
export type CompraUnit = "KG" | "G" | "L" | "M" | "UNIDAD";

export interface CompraItem {
  id: string;
  compraId: string;
  articuloId: string;
  brand: string | null;
  requestedQuantity: string;
  unit: CompraUnit;
  unitPrice: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Compra {
  id: string;
  supplierName: string;
  supplierTaxId: string | null;
  documentNumber: string | null;
  documentDate: Date | null;
  currency: string | null;
  observations: string | null;
  status: CompraStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  items: CompraItem[];
}

export interface CompraListFilters {
  page?: number;
  pageSize?: number;
  status?: CompraStatus;
}

export interface PaginatedCompras {
  items: Compra[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}