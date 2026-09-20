# Winter Project

Sistema de gestión de producción e inventario desarrollado para **Bodega Cruce del Zorro**, orientado al control y trazabilidad de los procesos productivos de vinos y singanis.

Winter permite administrar artículos, compras, inventario y operaciones de producción, manteniendo trazabilidad desde la recepción de materias primas hasta el ingreso del producto al inventario.

## Origen del proyecto

Winter fue construido utilizando **Logger** como base técnica.

Logger aporta la infraestructura transversal del sistema:

* Autenticación mediante Firebase.
* Usuarios, roles y permisos.
* Control de acceso RBAC.
* Auditoría.
* Arquitectura modular.
* Manejo estandarizado de errores y requests.

Sobre esta base se desarrollaron los módulos específicos del dominio de Winter.

## Tecnologías

| Componente     | Tecnología                               |
| -------------- | ---------------------------------------- |
| Runtime        | Node.js 22+                              |
| Lenguaje       | TypeScript                               |
| API            | Express 5                                |
| Base de datos  | PostgreSQL                               |
| ORM            | Prisma ORM 7                             |
| Autenticación  | Firebase Authentication / Firebase Admin |
| Validación     | Zod                                      |
| Logging        | Pino                                     |
| Seguridad HTTP | Helmet, CORS, Rate Limiting              |
| Archivos       | Supabase Storage                         |
| Pruebas        | Node Test Runner + TSX                   |

## Arquitectura

Winter utiliza un **monolito modular**.

Cada módulo mantiene la responsabilidad sobre su propio dominio y se comunica con otros módulos mediante APIs internas y contratos definidos.

```text
Winter
│
├── Core / Logger
│   ├── Authentication
│   ├── Users
│   ├── Roles & Permissions
│   └── Audit
│
├── Artículos
├── Compras
├── Inventory
├── Production
└── Attachments
```

## Módulos implementados

### Artículos

Catálogo maestro de artículos utilizados por el sistema.

Incluye materias primas, insumos, materiales y productos relacionados con producción e inventario.

### Compras

Registro de compras y recepción de artículos.

La recepción confirmada genera los movimientos correspondientes en Inventory.

### Inventory

Gestión del inventario físico.

Incluye:

* Almacenes.
* Lotes.
* Movimientos.
* Transferencias.
* Ajustes.
* Stock disponible.
* Integración con Compras y Producción.

`InventoryMovement` mantiene el historial de movimientos y `InventoryStock` representa los saldos materializados.

### Production

Gestión de los procesos productivos de la bodega.

Incluye, entre otros:

* Órdenes de producción.
* Recepción de uva.
* Lotes de producción.
* Trabajos de producción.
* Mediciones.
* Recipientes.
* Transformaciones.
* Pérdidas.
* Salida de producto hacia Inventory.

### Attachments

Gestión de archivos y documentos asociados a los registros del sistema utilizando almacenamiento privado.

### Administración y seguridad

Winter conserva las capacidades administrativas heredadas de Logger:

* Usuarios.
* Roles.
* Permisos.
* Autenticación.
* Auditoría.
* Control de acceso.

## API

La API se encuentra versionada bajo:

```text
/api/v1
```

Los contratos HTTP utilizados por el frontend se encuentran en:

```text
logger/docs/api/
```

La documentación de arquitectura y reglas de implementación se encuentra en:

```text
logger/docs/architecture/
```

## Desarrollo

Instalar dependencias:

```bash
npm ci
```

Validar y generar Prisma:

```bash
npm run db:validate
npm run db:generate
```

Aplicar migraciones:

```bash
npm run db:migrate:deploy
```

Iniciar desarrollo:

```bash
npm run dev
```

Validación general del proyecto:

```bash
npm run typecheck
npm test
npm run build
```

## Estado

Backend MVP de Winter implementado.

El proyecto continúa con:

* Despliegue del backend.
* Desarrollo del frontend.
* Carga inicial de datos maestros.
* Pruebas operativas con usuarios.

---

**Winter Project**
Bodega Cruce del Zorro
Sistema de Producción e Inventario