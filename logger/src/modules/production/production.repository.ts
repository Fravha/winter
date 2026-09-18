import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { CatalogFilters, CatalogInput, CatalogKind, ReadCatalogKind } from "./production.dto.js";
type Db = PrismaClient | Prisma.TransactionClient;
export class ProductionRepository {
  constructor(private readonly db: Db) {}
  async list(kind: ReadCatalogKind, f: CatalogFilters) {
    const where = { ...(f.active === undefined ? {} : { active: f.active }), ...(f.search ? { OR: [{ code: { contains: f.search, mode: "insensitive" as const } }, { name: { contains: f.search, mode: "insensitive" as const } }] } : {}) };
    const skip = ((f.page ?? 1) - 1) * (f.pageSize ?? 20); const take = f.pageSize ?? 20;
    const query = async <T>(delegate: { findMany: (a: object) => Promise<T[]>; count: (a: object) => Promise<number> }) => { const [items, total] = await Promise.all([delegate.findMany({ where, skip, take, orderBy: { code: "asc" } }), delegate.count({ where })]); return { items, pagination: { page: f.page ?? 1, pageSize: take, total, totalPages: Math.ceil(total / take) } }; };
    switch (kind) {
      case "participants": return query(this.db.productionParticipant);
      case "producers": return query(this.db.producer);
      case "grape-varieties": return query(this.db.grapeVariety);
      case "work-types": return query(this.db.workType);
      case "measurement-types": return query(this.db.measurementType);
    }
  }
  async find(kind: CatalogKind, id: string) { switch (kind) { case "participants": return this.db.productionParticipant.findUnique({ where: { id } }); case "producers": return this.db.producer.findUnique({ where: { id } }); default: return this.db.grapeVariety.findUnique({ where: { id } }); } }
  async findCode(kind: CatalogKind, code: string) { switch (kind) { case "participants": return this.db.productionParticipant.findUnique({ where: { code } }); case "producers": return this.db.producer.findUnique({ where: { code } }); default: return this.db.grapeVariety.findUnique({ where: { code } }); } }
  async create(kind: CatalogKind, data: CatalogInput) { switch (kind) { case "participants": return this.db.productionParticipant.create({ data }); case "producers": return this.db.producer.create({ data: { code: data.code, name: data.name } }); default: return this.db.grapeVariety.create({ data: { code: data.code, name: data.name } }); } }
  async update(kind: CatalogKind, id: string, data: { name?: string; active?: boolean; userId?: string }) { const clean = { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.active !== undefined ? { active: data.active } : {}), ...(data.userId !== undefined ? { userId: data.userId } : {}) }; switch (kind) { case "participants": return this.db.productionParticipant.update({ where: { id }, data: clean }); case "producers": return this.db.producer.update({ where: { id }, data: clean }); default: return this.db.grapeVariety.update({ where: { id }, data: clean }); } }
}