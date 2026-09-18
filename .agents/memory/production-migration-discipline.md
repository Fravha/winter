---
name: Disciplina de migraciones de Production
description: Regla para preservar checksums y procedencia cuando una migración nueva ya alcanzó la base de desarrollo.
---

Una migración de Production debe considerarse inmutable desde el momento en que se aplica a desarrollo. Antes del deploy, comparar su checksum local con cualquier registro existente. Si después hacen falta nuevos constraints, triggers o guards, restaurar el archivo original al checksum aplicado y crear una migración posterior explícita.

**Why:** Una migración P4 alcanzó desarrollo durante la implementación y luego siguió cambiando. Prisma reportaba status y drift limpios aunque el checksum y los objetos no coincidían, porque triggers y ciertos checks no participan en su drift normal.

**How to apply:** Validar primero toda migración nueva en PostgreSQL temporal. Inmediatamente antes de `migrate deploy`, comprobar que siga pendiente; inmediatamente después, guardar/verificar checksum y consultar físicamente constraints y triggers relevantes.

Las suites que escriben entidades históricas o append-only deben ejecutarse solo cuando su variable específica (`P3_DATABASE_URL`, `P4_DATABASE_URL`, `P5_DATABASE_URL`, etc.) apunta explícitamente a PostgreSQL temporal. No ejecutar `npm test` con una `WINTER_DATABASE_URL` heredada de desarrollo.

**Why:** Una ejecución P5 heredó la URL de desarrollo, creó un `ProductionWork` de prueba y no pudo limpiarlo porque el contrato prohíbe su borrado físico.

**How to apply:** Sobrescribir todas las variables de base relevantes en el mismo comando de test y comprobar que el host sea `127.0.0.1`. Las pruebas de entidades inmutables deben usar una base efímera, no cleanup destructivo sobre desarrollo.