---
name: Disciplina de migraciones de Production
description: Regla para preservar checksums y procedencia cuando una migración nueva ya alcanzó la base de desarrollo.
---

Una migración de Production debe considerarse inmutable desde el momento en que se aplica a desarrollo. Antes del deploy, comparar su checksum local con cualquier registro existente. Si después hacen falta nuevos constraints, triggers o guards, restaurar el archivo original al checksum aplicado y crear una migración posterior explícita.

**Why:** Una migración P4 alcanzó desarrollo durante la implementación y luego siguió cambiando. Prisma reportaba status y drift limpios aunque el checksum y los objetos no coincidían, porque triggers y ciertos checks no participan en su drift normal.

**How to apply:** Validar primero toda migración nueva en PostgreSQL temporal. Inmediatamente antes de `migrate deploy`, comprobar que siga pendiente; inmediatamente después, guardar/verificar checksum y consultar físicamente constraints y triggers relevantes.

Las suites que escriben entidades históricas o append-only deben ejecutarse solo cuando su variable específica (`P3_DATABASE_URL`, `P4_DATABASE_URL`, `P5_DATABASE_URL`, etc.) apunta explícitamente a PostgreSQL temporal. No ejecutar `npm test` con una `WINTER_DATABASE_URL` heredada de desarrollo.

**Why:** Una ejecución P5 heredó la URL de desarrollo, creó un `ProductionWork` de prueba y no pudo limpiarlo porque el contrato prohíbe su borrado físico.

**How to apply:** Sobrescribir todas las variables de base relevantes en el mismo comando de test; exigir host `127.0.0.1`, nombre terminado en `_test` o `_temp`, URL sin parámetros de query, y comprobar que no sea la misma base identificada por `WINTER_DATABASE_URL`. Las pruebas de entidades inmutables deben usar una base efímera, no cleanup destructivo sobre desarrollo.

En este workspace, la conexión DEV de Winter puede llegar al shell con caracteres reservados de credenciales sin escapar, aunque host, puerto y base sean correctos.

**Why:** Prisma y el parser PostgreSQL rechazaron la variable con un error de puerto, mientras una normalización en memoria de usuario/contraseña identificó correctamente la DEV con las migraciones esperadas.

**How to apply:** Antes de un deploy, exigir que `migrate status` identifique exactamente la historia esperada. Si la URL falla por formato, normalizar únicamente sus credenciales en memoria; nunca imprimir, persistir ni sustituirla por `DATABASE_URL` sin verificar la historia.