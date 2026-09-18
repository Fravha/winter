export type CatalogKind = "participants" | "producers" | "grape-varieties" | "work-types" | "measurement-types";
export interface CatalogInput { code: string; name: string; userId?: string }
export interface CatalogFilters { page?: number; pageSize?: number; search?: string; active?: boolean }
export interface ProductionActor { actorUserId: string; ipAddress?: string; requestId?: string }
export type ReadCatalogKind = CatalogKind | "work-types" | "measurement-types";