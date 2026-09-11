import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditRepository } from "../src/core/audit/audit.repository.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import type {
  AuditRecord,
  AuthenticatedAuditContext,
} from "../src/core/audit/audit.types.js";
import type {
  CreateArticuloDto,
  UpdateArticuloDto,
} from "../src/modules/articulos/articulo.dto.js";
import type {
  Articulo,
  ListArticulosFilters,
} from "../src/modules/articulos/articulo.model.js";
import type { ArticuloRepository } from "../src/modules/articulos/articulo.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import type { ArticuloUnitOfWork } from "../src/modules/articulos/articulo.unit-of-work.js";
import { AppError } from "../src/shared/errors/app-error.js";

const context: AuthenticatedAuditContext = {
  actorUserId: "actor-id",
  requestId: "request-id",
};

class MemoryArticuloRepository implements ArticuloRepository {
  private records = new Map<string, Articulo>();
  private operationalReferences = new Map<string, Set<ConsumerModule>>();
  private nextId = 1;

  findById(id: string) {
    return Promise.resolve(this.records.get(id) ?? null);
  }

  findByCodeInsensitive(codigo: string) {
    const normalized = codigo.toLocaleLowerCase();
    return Promise.resolve(
      [...this.records.values()].find(
        (articulo) => articulo.codigo.toLocaleLowerCase() === normalized,
      ) ?? null,
    );
  }

  hasOperationalReferences(id: string) {
    return Promise.resolve((this.operationalReferences.get(id)?.size ?? 0) > 0);
  }

  async findAll(filters: ListArticulosFilters) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const filtered = [...this.records.values()]
      .filter((item) =>
        filters.activo === undefined || item.activo === filters.activo
      )
      .filter((item) =>
        filters.clasificacion === undefined
        || item.clasificacion === filters.clasificacion
      )
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      },
    };
  }

  create(data: CreateArticuloDto) {
    const now = new Date("2026-09-11T00:00:00.000Z");
    const articulo: Articulo = {
      id: `articulo-${this.nextId++}`,
      codigo: data.codigo,
      codigoExterno: data.codigoExterno ?? null,
      nombre: data.nombre,
      clasificacion: data.clasificacion,
      unidadMedida: data.unidadMedida,
      activo: true,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(articulo.id, articulo);
    return Promise.resolve(articulo);
  }

  async update(id: string, data: UpdateArticuloDto) {
    const current = await this.findById(id);
    assert.ok(current);
    const articulo = { ...current, ...data };
    this.records.set(id, articulo);
    return articulo;
  }

  async setActive(id: string, activo: boolean) {
    const current = await this.findById(id);
    assert.ok(current);
    const articulo = { ...current, activo };
    this.records.set(id, articulo);
    return articulo;
  }

  snapshot() {
    return new Map(this.records);
  }

  restore(snapshot: Map<string, Articulo>) {
    this.records = snapshot;
  }

  addOperationalReference(id: string, module: ConsumerModule = "inventory") {
    const references = this.operationalReferences.get(id) ?? new Set();
    references.add(module);
    this.operationalReferences.set(id, references);
  }
}

type ConsumerModule = "inventory" | "compras" | "production";

class MemoryAuditRepository implements AuditRepository {
  readonly records: AuditRecord[] = [];
  create(record: AuditRecord) {
    this.records.push(record);
    return Promise.resolve();
  }
}

class MemoryArticuloUnitOfWork implements ArticuloUnitOfWork {
  constructor(
    private readonly articulos: MemoryArticuloRepository,
    private readonly auditRepository: MemoryAuditRepository,
  ) {}

  async execute<T>(
    work: Parameters<ArticuloUnitOfWork["execute"]>[0],
  ): Promise<T> {
    const snapshot = this.articulos.snapshot();
    try {
      return await work({
        articulos: this.articulos,
        audit: new AuditService(this.auditRepository),
      }) as T;
    } catch (error) {
      this.articulos.restore(snapshot);
      throw error;
    }
  }
}

function createSubject() {
  const repository = new MemoryArticuloRepository();
  const auditRepository = new MemoryAuditRepository();
  const service = new ArticuloService(
    repository,
    new MemoryArticuloUnitOfWork(repository, auditRepository),
  );
  return { auditRepository, repository, service };
}

describe("ArticuloService", () => {
  it("creates active articulos and normalizes surrounding code spaces", async () => {
    const { auditRepository, service } = createSubject();
    const articulo = await service.createArticulo({
      codigo: "  ART-001  ",
      nombre: "Botella",
      clasificacion: "MATERIAL_ENVASE",
      unidadMedida: "UNIDAD",
    }, context);

    assert.equal(articulo.codigo, "ART-001");
    assert.equal(articulo.activo, true);
    assert.equal(auditRepository.records[0]?.action, "ARTICULO_CREATED");
  });

  it("rejects duplicate codes case-insensitively", async () => {
    const { service } = createSubject();
    const data: CreateArticuloDto = {
      codigo: "INS-001",
      nombre: "Insumo",
      clasificacion: "INSUMO_ENOLOGICO",
      unidadMedida: "KG",
    };
    await service.createArticulo(data, context);

    await assert.rejects(
      service.createArticulo({ ...data, codigo: "ins-001" }, context),
      (error: unknown) =>
        error instanceof Error && error.message.includes("already exists"),
    );
  });

  it("allows repeated external aliases because only codigo identifies an articulo", async () => {
    const { service } = createSubject();
    const first = await service.createArticulo({
      codigo: "PT-NACIONAL-001",
      codigoExterno: "LVD",
      nombre: "Producto nacional",
      clasificacion: "PRODUCTO_TERMINADO",
      unidadMedida: "UNIDAD",
    }, context);
    const second = await service.createArticulo({
      codigo: "PT-EXPORT-001",
      codigoExterno: "LVD",
      nombre: "Producto exportación",
      clasificacion: "PRODUCTO_TERMINADO",
      unidadMedida: "UNIDAD",
    }, context);

    assert.equal(first.codigoExterno, "LVD");
    assert.equal(second.codigoExterno, "LVD");
  });

  it("accepts M as a base unit", async () => {
    const { service } = createSubject();
    const articulo = await service.createArticulo({
      codigo: "MAT-001",
      nombre: "Material por metro",
      clasificacion: "MATERIAL_EMPAQUE",
      unidadMedida: "M",
    }, context);

    assert.equal(articulo.unidadMedida, "M");
  });

  it("rejects removed or unsupported units at the service boundary", () => {
    const { service } = createSubject();
    assert.throws(
      () => service.createArticulo({
        codigo: "MAT-ML-001",
        nombre: "Material en mililitros",
        clasificacion: "INSUMO_ENOLOGICO",
        unidadMedida: "ML",
      } as CreateArticuloDto, context),
      /Invalid option/,
    );
  });

  it("rejects empty trimmed identity and descriptive fields at the service boundary", () => {
    const { service } = createSubject();
    assert.throws(
      () => service.createArticulo({
        codigo: "   ",
        nombre: "Artículo",
        clasificacion: "MATERIA_PRIMA",
        unidadMedida: "KG",
      }, context),
      /Codigo is required/,
    );
    assert.throws(
      () => service.createArticulo({
        codigo: "MAT-002",
        codigoExterno: "   ",
        nombre: "Artículo",
        clasificacion: "MATERIA_PRIMA",
        unidadMedida: "KG",
      }, context),
      /Codigo externo cannot be empty/,
    );
  });

  it("validates active state and allowed classifications", async () => {
    const { service } = createSubject();
    const articulo = await service.createArticulo({
      codigo: "PP-001",
      nombre: "Producto en proceso",
      clasificacion: "PRODUCTO_PROCESO",
      unidadMedida: "L",
    }, context);

    assert.equal((await service.validateArticulo({
      articuloId: articulo.id,
      allowedClassifications: ["PRODUCTO_PROCESO"],
    })).valid, true);
    assert.equal((await service.validateArticulo({
      articuloId: articulo.id,
      allowedClassifications: ["MATERIA_PRIMA"],
    })).valid, false);
    await service.deactivateArticulo(articulo.id, context);
    assert.equal((await service.validateArticulo({
      articuloId: articulo.id,
    })).valid, false);
    assert.equal((await service.activateArticulo(
      articulo.id,
      context,
    )).activo, true);
  });

  it("ignores fields outside the create and update contracts", async () => {
    const { service } = createSubject();
    const articulo = await service.createArticulo({
      codigo: "SAFE-001",
      nombre: "Seguro",
      clasificacion: "MATERIA_PRIMA",
      unidadMedida: "KG",
      activo: false,
    } as CreateArticuloDto, context);
    assert.equal(articulo.activo, true);

    const updated = await service.updateArticulo(articulo.id, {
      nombre: "Actualizado",
      codigo: "CHANGED",
      activo: false,
    } as UpdateArticuloDto, context);
    assert.equal(updated.codigo, "SAFE-001");
    assert.equal(updated.activo, true);
  });

  for (const module of ["inventory", "compras", "production"] as const) {
    it(`blocks classification and unit but keeps name editable after a ${module} reference exists`, async () => {
      const { repository, service } = createSubject();
      const articulo = await service.createArticulo({
        codigo: `LOCKED-${module}`,
        nombre: "Nombre original",
        clasificacion: "MATERIA_PRIMA",
        unidadMedida: "KG",
      }, context);
      repository.addOperationalReference(articulo.id, module);

      await assert.rejects(
        service.updateArticulo(
          articulo.id,
          { clasificacion: "INSUMO_ENOLOGICO" },
          context,
        ),
        (error: unknown) =>
          error instanceof AppError
          && error.code === "ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE"
          && error.statusCode === 409,
      );
      await assert.rejects(
        service.updateArticulo(articulo.id, { unidadMedida: "G" }, context),
        (error: unknown) =>
          error instanceof AppError
          && error.code === "ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE",
      );

      const updated = await service.updateArticulo(
        articulo.id,
        { nombre: `Nombre actualizado por ${module}` },
        context,
      );
      assert.equal(updated.nombre, `Nombre actualizado por ${module}`);
    });
  }

  it("keeps name editable and accepts unchanged operational fields after references exist", async () => {
    const { repository, service } = createSubject();
    const articulo = await service.createArticulo({
      codigo: "LOCKED-002",
      nombre: "Nombre original",
      clasificacion: "MATERIA_PRIMA",
      unidadMedida: "KG",
    }, context);
    repository.addOperationalReference(articulo.id);

    const updated = await service.updateArticulo(articulo.id, {
      nombre: "Nombre actualizado",
      clasificacion: "MATERIA_PRIMA",
      unidadMedida: "KG",
    }, context);

    assert.equal(updated.nombre, "Nombre actualizado");
    assert.equal(updated.clasificacion, "MATERIA_PRIMA");
    assert.equal(updated.unidadMedida, "KG");
  });

  it("enforces pagination defaults and limits for intermodule callers", async () => {
    const { service } = createSubject();
    const result = await service.listArticulos({});
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.pageSize, 20);
    assert.throws(
      () => service.listArticulos({ pageSize: 101 }),
      /between 1 and 100/,
    );
    assert.throws(
      () => service.listArticulos({ page: 0 }),
      /greater than or equal to 1/,
    );
  });
});