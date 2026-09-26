# UAT final y hardening — Sistema de Producción CDZ

## Estado y alcance

**Recomendación: NO READY para Vercel todavía.** El frontend compila y pasa las pruebas automatizadas, pero una revisión estática y capturas de la pantalla pública no sustituyen una UAT autenticada de los flujos operativos. No se efectuaron escrituras en producción, push ni deploy. Fotos/Evidencias no forma parte de este bloque.

Esta matriz distingue la **evidencia disponible** de una ejecución funcional real. `BLOCKED` significa que no se pudo validar el flujo completo, **no** que se haya demostrado que falla. No se declara `PASS` por inspección de código únicamente.

## Environment

| Elemento | Valor |
| --- | --- |
| Frontend | `artifacts/sistema-produccion/**`, Vite/React |
| Backend previsto | `https://winter-7p9d.onrender.com` mediante `VITE_WINTER_API_URL` |
| Backend local | `logger/**`, sin cambios en este bloque |
| Rama de trabajo | `feature/reports` |
| Rama nombrada en el pedido | `feature/frontend-winter` |
| Commit base antes de la UAT | `74389782b4fcabc1e2111e97082359fc58c5f988` |
| Commit de cierre | Commit que contiene este informe; obtener SHA con `git log -1 --format=%H` |

**Advertencia de rama:** `feature/frontend-winter` y `feature/reports` han divergido (1 commit exclusivo de la primera, 5 exclusivos de la segunda antes de esta UAT). No se movieron ramas ni se resolvió la integración automáticamente: antes de Vercel hay que decidir e integrar el commit correcto sin perder trabajo.

**Conectividad:** `GET /health` y `GET /health/ready` del backend previsto respondieron HTTP 200 (consulta de solo lectura; el segundo comprueba disponibilidad de base de datos). El healthcheck se monta fuera de `/api/v1`: una primera prueba a `/api/v1/health` agotó el plazo y otra a `/api/v1/health/ready` devolvió 404 por ruta incorrecta. La conectividad básica **sí** está confirmada; contratos operativos y descargas requieren sesión autorizada. No se consultaron ni modificaron datos operativos.

## Automated validation

| Verificación | Resultado |
| --- | --- |
| `pnpm --filter @workspace/sistema-produccion run typecheck` | PASS |
| `pnpm --filter @workspace/sistema-produccion test` | PASS — 86 tests, 20 archivos, 0 fallidos |
| `pnpm --filter @workspace/sistema-produccion run build` | PASS |
| `git diff --check` | PASS |
| Preview del login | PASS visual en 390 × 844, 768 × 950 y 1440 × 900; consola de esas capturas sin errores |
| Salud de backend previsto | PASS — `GET /health` HTTP 200; `GET /health/ready` HTTP 200 |
| Integridad de backend | Sin archivos `logger/**` modificados por este bloque; confirmar con `git diff --name-only 7438978..HEAD -- logger/` |

El build conserva el warning de chunk >500 KB (JS aproximadamente 1,267 kB, gzip aproximadamente 326 kB) y avisos de sourcemap para algunos componentes UI. No se hizo un refactor agresivo para ocultarlos.

## UAT matrix

| Módulo / área | Estado | Evidencia y observación concreta |
| --- | --- | --- |
| Arquitectura / API base | PASS WITH OBSERVATION | Llamadas a través de capa API y URL por `VITE_WINTER_API_URL`; eliminado fallback implícito a localhost. No se encontró conexión directa a PostgreSQL/Supabase desde el frontend ni credenciales privadas en código. Integración remota no verificada. |
| Autenticación y acceso | BLOCKED | Login, contraseña oculta/Eye, guardas y manejo de usuario inactivo/no registrado revisados en código; pantalla pública visible. Sin cuenta UAT no se ejecutaron login real, logout, expiración, persistencia, roles, redirects ni Access Denied con servidor. |
| AppShell, navegación y tema | BLOCKED | Menú y ocho áreas de Producción presentes según código; la pantalla pública muestra logo y nombre correcto. Las pestañas de Producción tienen scroll/flechas según implementación. Sidebar/topbar, persistencia y contraste en páginas protegidas no comprobados visualmente con sesión. |
| Artículos | BLOCKED | Se revisaron listados, formularios, permisos y estados loading/empty/error/retry en código; no se hicieron altas, ediciones, activación ni consulta autenticada. |
| Compras | BLOCKED | Rutas REGISTERED→RECEIVED/CANCELLED revisadas; corregida invalidación de Inventario tras recepción y agregadas pruebas de caché. Sin operaciones reales ni verificación de atomicidad/stock productivo. |
| Inventario | BLOCKED | Código de almacenes, stock, lotes y movimientos inspeccionado; filtros por artículo y cachés respetados. No se probaron operaciones reales, permisos de stock negativo ni DECIMAL/UNIDAD contra API. |
| Producción: órdenes | BLOCKED | Creación/cierre, listas, detalle y invalidaciones revisadas en código; no se ejecutaron estados OPEN/CLOSED con backend. |
| Producción: recepciones | BLOCKED | Alta/correcciones y relación de trazas inspeccionadas; se invalida traza tras corrección. Sin productores, ítems ni batches reales bajo UAT. |
| Producción: lotes y trazabilidad | BLOCKED | Se revisaron balance, liberación, reversión soportada y ruta `/produccion/batches/:batchId/trace`; prueba nueva verifica aviso y reintento si fallan catálogos auxiliares sin ocultar la traza. No se verificaron historiales con datos reales. |
| Producción: trabajos | BLOCKED | Orden obligatoria, vínculos opcionales, insumos y reversión revisados; invalidación de traza al registrar/corregir trabajos e inputs. Sin consumo real ni permisos. |
| Producción: mediciones | BLOCKED | Hooks de crear/corregir y asociación con traza revisados; pruebas locales de invalidación. Sin altas/correcciones reales. |
| Producción: transformaciones | BLOCKED | Flujos de entrada/salida/pérdidas e invalidación de trazas revisados; la UI muestra error en petición fallida según código. Atomicidad y respuestas reales no verificadas. |
| Producción: recipientes | BLOCKED | Asignación, ocupación, transferencias e historial inspeccionados en código; sin operaciones reales. |
| Producción: catálogos | BLOCKED | Consulta, edición, campos personalizados y estados vacíos revisados; caché de valores invalidada al actualizar. Sin ejecución autenticada. |
| Administración: usuarios/roles/permisos | BLOCKED | Se revisaron permisos visuales y operaciones declaradas; no se probaron RBAC, suspensiones, soft delete, `PERMISSION_IN_USE` ni 409 reales. Autorización del backend no puede inferirse del menú. |
| Administración: auditoría | BLOCKED | UI de solo lectura inspeccionada; la tabla dispone de ancho mínimo y scroll interno para no recortar columnas en móvil. Filtros, actor, fechas y detalle no validados con datos reales. |
| Reportes (seis exportaciones) | BLOCKED | Seis definiciones y pruebas de capa de exportación presentes; fechas asociadas a sus labels (confirmado por test). No se obtuvo XLSX real para verificar filtros, `Content-Disposition`, filename, 413/429 o permiso efectivo `reports:export`. |
| Errores HTTP / loading / empty | PASS WITH OBSERVATION | Pruebas unitarias cubren errores directos/anidados y `requestId`; vistas principales muestran estados según inspección. No se simularon todas las respuestas 400/401/403/404/409/413/422/429/500 y network error en sesión real. |
| Responsive / dark mode / accesibilidad | PASS WITH OBSERVATION | Login sin desborde en tres anchuras; botón Eye y tabla de auditoría con contenedor de scroll revisados. Dark mode, tablas, sheets y dialogs protegidos no inspeccionados en navegador autenticado; no es auditoría WCAG. |
| Storage | PASS WITH OBSERVATION | No se alteró Supabase Storage; no se añadieron buckets, políticas ni funcionalidad de fotos. Flujos actuales no probados contra Storage. |
| Performance / build | PASS WITH OBSERVATION | Build exitoso con warning de bundle documentado; no se midió rendimiento con sesiones/datos reales. |

## Defects found

| ID | Severidad | Módulo | Descripción | Resolución |
| --- | --- | --- | --- | --- |
| UAT-01 | P2 | API | URL base ausente enviaba solicitudes a `localhost:3000` de forma silenciosa. | Ahora falla explícitamente con error de configuración; test agregado. |
| UAT-02 | P2 | API / errores | Los errores directos `{code,message,...}` podían perder mensaje y `requestId`. | Parser acepta respuesta directa o anidada y conserva metadatos; tests agregados. |
| UAT-03 | P2 | Compras / Inventario | Una recepción exitosa actualizaba Compras pero dejaba stock/movimientos/lotes en caché. | Invalidación de consultas pertinentes después de recibir, antes del callback de éxito; pruebas de selectividad. |
| UAT-04 | P2 | Producción | Trazas previamente consultadas podían quedar obsoletas tras trabajos, mediciones, correcciones y transformaciones; actualización de valores personalizados sin invalidación. | Invalidaciones de consultas dependientes y pruebas de regresión. Las correcciones tipadas de recepción solo cambian campos de cabecera; no se atribuye un cambio de cantidad de batch sin contrato que lo respalde. |
| UAT-05 | P2 | Trazabilidad | Una falla de catálogos auxiliares podía aparecer como identificadores crudos sin explicación. | Aviso no bloqueante con nombres afectados y reintento; la traza permanece visible. |
| UAT-06 | P3 | Auditoría | La tabla angosta podía comprimir siete columnas y hacer difícil consultar detalle. | Ancho mínimo dentro del scroll horizontal propio; test del contenedor. |

**P0 encontrados/restantes confirmados: 0/0. P1 encontrados/restantes confirmados: 0/0.** Estas cifras corresponden únicamente a evidencia disponible; los flujos bloqueados no han sido absueltos por UAT. **P2/P3 pendientes confirmados: 0**; no se cierran por eso las comprobaciones funcionales bloqueadas.

## Deferred items

- **Fotos/Evidencias — post-MVP.** Supabase Storage ya está habilitado como infraestructura prevista; su ampliación/integración funcional queda fuera de este release. No se eliminó ni reconfiguró.
- Optimización avanzada del bundle >500 KB y revisión de avisos de sourcemap, si las mediciones reales justifican el trabajo.
- UAT autenticada y sin escrituras productivas por perfiles adecuados, con entorno/datos de ensayo para flujos de mutación; comprobar permisos efectivos, respuestas HTTP y descargas XLSX válidas.

## Release recommendation

**NO READY.** Bloqueos de validación para Vercel: (1) no hubo acceso a cuentas/entorno UAT para ejecutar flujos protegidos y sus ocho áreas de Producción; (2) aunque el backend y su base de datos respondieron en los healthchecks, falta verificar contratos reales, permisos y descargas con una sesión autorizada; (3) la rama de trabajo difiere de la rama de frontend indicada y su integración debe resolverse deliberadamente. Repetir UAT autenticada y confirmar P0 = 0 y P1 = 0 antes de aprobar despliegue. No hubo push ni deploy.