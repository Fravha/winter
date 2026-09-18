---
name: Disciplina de migraciones de Production
description: Regla para preservar checksums y procedencia cuando una migración nueva ya alcanzó la base de desarrollo.
---

Una migración de Production debe considerarse inmutable desde el momento en que se aplica a desarrollo. Antes del deploy, comparar su checksum local con cualquier registro existente. Si después hacen falta nuevos constraints, triggers o guards, restaurar el archivo original al checksum aplicado y crear una migración posterior explícita.

**Why:** Una migración P4 alcanzó desarrollo durante la implementación y luego siguió cambiando. Prisma reportaba status y drift limpios aunque el checksum y los objetos no coincidían, porque triggers y ciertos checks no participan en su drift normal.

**How to apply:** Validar primero toda migración nueva en PostgreSQL temporal. Inmediatamente antes de `migrate deploy`, comprobar que siga pendiente; inmediatamente después, guardar/verificar checksum y consultar físicamente constraints y triggers relevantes.