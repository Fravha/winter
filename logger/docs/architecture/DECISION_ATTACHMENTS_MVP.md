# DECISION_ATTACHMENTS_MVP.md

## Estado

**Aprobado para roadmap MVP**

## Objetivo

Definir cómo Winter manejará imágenes y otros archivos adjuntos asociados a registros operativos, evitando almacenar archivos binarios dentro de PostgreSQL y evitando agregar campos específicos de imagen en cada entidad del dominio.

## Decisión

Winter permitirá adjuntar **0..N archivos** a determinadas entidades operativas.

Los archivos físicos serán almacenados en un proveedor externo de almacenamiento. PostgreSQL conservará únicamente la metadata necesaria y una referencia estable al archivo.

Inicialmente, el MVP habilitará attachments para:

- `GrapeReception`
- `ProductionWork`
- `Measurement`
- `Transformation`
- `ProductionLoss`

La incorporación de nuevas entidades será evaluada según necesidad operativa, sin modificar el dominio principal del registro.

## Principio de diseño

No se agregará un campo `imageUrl`, `photoUrl`, `filePath` o equivalente en cada tabla productiva.

Se utilizará una entidad transversal `Attachment`.

Modelo conceptual:

```text
Attachment
- id
- entityType
- entityId
- fileName
- mimeType
- fileSize
- storageProvider
- storageKey
- uploadedByUserId
- createdAt
- observations?
```

## Reglas

1. Una entidad habilitada puede tener cero, uno o múltiples attachments.
2. PostgreSQL no almacena el archivo físico.
3. PostgreSQL almacena únicamente metadata y una referencia estable al archivo.
4. El archivo físico se almacena en un servicio externo.
5. Inicialmente se utilizará `SUPABASE` como proveedor de almacenamiento.
6. Winter debe persistir `storageKey`, no depender de una URL pública permanente.
7. Las URLs de acceso podrán generarse dinámicamente cuando sea necesario.
8. El almacenamiento debe poder operar con archivos privados y URLs firmadas temporales.
9. Los attachments no cambian cantidades, estados, balances, Artículos, Inventory ni reglas de negocio de la entidad asociada.
10. Adjuntar un archivo no debe sustituir la información estructurada del registro.
11. No se agregará una relación física específica de imagen en cada tabla principal.
12. La habilitación de attachments para nuevas entidades requerirá una decisión explícita de producto/dominio.
13. La política de eliminación física del archivo debe definirse considerando trazabilidad y auditoría.

## Storage Provider

Para el MVP:

```text
storageProvider = SUPABASE
```

La arquitectura debe permitir incorporar otros proveedores en el futuro sin modificar el dominio principal, por ejemplo:

```text
SUPABASE
S3
DRIVE
```

Esto no implica que todos deban implementarse en el MVP.

## Referencia al archivo

Ejemplo recomendado:

```text
storageProvider = SUPABASE
storageKey = production/grape-receptions/{receptionId}/photo-001.jpg
```

Winter podrá resolver posteriormente una URL de acceso a partir de `storageProvider + storageKey`.

No se debe almacenar como fuente de verdad una URL pública permanente.

## Alcance MVP inicial

### GrapeReception

Uso esperado:

- estado de la uva al recibirla;
- documentación visual de la recepción;
- condiciones observadas;
- respaldo de incidencias.

### ProductionWork

Uso esperado:

- evidencia del trabajo realizado;
- estado antes/durante/después del trabajo;
- documentación de procedimientos o incidencias.

### Measurement

Uso esperado:

- fotografía de instrumentos;
- lectura visible;
- respaldo de mediciones cuando sea requerido.

### Transformation

Uso esperado:

- evidencia visual de la transformación;
- estado del producto o proceso;
- documentación operativa.

### ProductionLoss

Uso esperado:

- evidencia de derrames;
- descarte;
- rotura;
- daño;
- otras pérdidas documentables visualmente.

## Entidades fuera del alcance inicial

No se habilitarán attachments automáticamente para todas las entidades de Winter.

Ejemplos que pueden evaluarse posteriormente:

- ProductionContainer
- ProductionBatch
- ProductionOrder
- TransformationOrder
- Purchase
- InventoryLot
- InventoryMovement
- Articulo

Agregar attachments a una nueva entidad debe responder a una necesidad operativa real.

## Consideraciones de seguridad

La implementación deberá contemplar al menos:

- validación de tipo MIME permitido;
- tamaño máximo de archivo;
- nombres de archivo no confiables;
- autorización para subir y consultar archivos;
- bucket privado cuando corresponda;
- URLs firmadas temporales;
- no exponer credenciales del storage al frontend;
- auditoría del usuario que adjuntó el archivo.

Los límites concretos de tamaño y formatos se definirán durante la implementación del módulo.

## Auditoría y trazabilidad

Cada attachment debe conservar como mínimo:

- usuario que lo registró;
- fecha de registro;
- entidad asociada;
- identificador de la entidad;
- metadata del archivo;
- referencia estable al objeto almacenado.

No debe existir eliminación destructiva de evidencia histórica sin una política explícitamente aprobada.

## Roadmap

La capacidad se implementará como fase transversal independiente:

```text
P8    Transformations + inputs + outputs + losses
P9    Production -> Inventory
P10   Trace API + correcciones históricas
P10.5 Attachments MVP
P11   E2E completo + hardening final
```

P8, P9 y P10 no deben depender de la existencia de Attachments.

P10.5 debe integrarse sin modificar las reglas principales de las entidades ya implementadas.

## Restricciones para implementación por IA

La IA NO debe:

- agregar columnas `imageUrl` o equivalentes a cada tabla productiva;
- guardar archivos binarios directamente en PostgreSQL;
- asumir Google Drive como proveedor inicial;
- crear relaciones nuevas fuera del alcance MVP sin aprobación;
- modificar reglas de negocio de Production para soportar archivos;
- convertir attachments en requisito obligatorio para crear registros;
- inventar política de eliminación definitiva;
- implementar almacenamiento antes de P10.5 salvo instrucción explícita.

La IA SÍ debe:

- mantener el diseño transversal mediante `Attachment`;
- usar almacenamiento externo;
- conservar metadata y `storageKey` en PostgreSQL;
- mantener la trazabilidad del usuario que adjunta el archivo;
- respetar las entidades habilitadas inicialmente;
- reportar cualquier vacío contractual antes de inventar reglas.

## Decisión final aprobada

> **Attachments MVP:** Winter permitirá adjuntar 0..N archivos a determinadas entidades operativas. Los archivos físicos serán almacenados externamente y PostgreSQL conservará únicamente su metadata, proveedor y clave de almacenamiento. Inicialmente se habilitarán attachments para GrapeReception, ProductionWork, Measurement, Transformation y ProductionLoss. La incorporación de nuevas entidades será evaluada según necesidad operativa, sin modificar el dominio principal del registro.
