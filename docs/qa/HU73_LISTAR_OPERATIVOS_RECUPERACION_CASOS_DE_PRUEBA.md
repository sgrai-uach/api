# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-73 — Visualizar Listado Paginado y Filtrable de Operativos de Recuperación Post-Desastre

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Recuperación (`sgrai-api` — `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/{id}`).  
> **Historia de Usuario:** HU-73 — *"Como Encargado Quiero visualizar un listado paginado y filtrable de todos los operativos de recuperación post-desastre registrados en el sistema Para dar seguimiento al avance de los despliegues de entrega de ayuda y rehabilitación comunal desplegados en las delegaciones."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely Query Builder + PostgreSQL 16 + PostGIS + Zod + Vitest v3.2.7).  
> **Rama Git Evaluada:** `feature/H73-listar-operativos-recuperacion`  
> **Commits Evaluados (Conventional Commits):**  
> * `feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)`
> * `feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)`
> * `test(eventos-atp): agregar pruebas unitarias para listado y drawer de recuperacion (H73)`
> * `docs(api): documentar endpoints GET de recuperacion bajo estandar H34 (H73)`
> * `merge: integrar develop en feature/H73-listar-operativos-recuperacion`
> * `chore(seed): agregar fixture y comando seed:h73 para operativos de recuperacion (H73)`
>  
> **Fecha de Auditoría:** 24 de Noviembre de 2026.  
> **Estado Global:** 🔴 **RECHAZADO (CHANGES REQUESTED — 7 DEFECTOS ABIERTOS DETECTADOS EN AUDITORÍA)**.

---

## 1. Resumen Ejecutivo

Durante la auditoría técnica de código, validación de esquema de base de datos, análisis de seguridad RBAC, revisión del contrato OpenAPI 3.0, análisis de sincronización Git respecto a `develop` y ejecución de pruebas automatizadas y en vivo sobre la rama `feature/H73-listar-operativos-recuperacion`, se ejecutaron **25 casos de evaluación** (7 defectos reales formalizados y 18 casos funcionales, de seguridad, validación, base de datos y compilación).

La funcionalidad principal de consulta paginada (`GET /api/eventos-atp/recuperacion`) bajo el estándar H34 (`page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`) y la consulta de detalle consolidado para drawer lateral (`GET /api/eventos-atp/recuperacion/{id}`) operan correctamente cuando se invocan con tokens JWT Bearer válidos y parámetros estándar. No obstante, se detectaron **7 defectos reales** (`BUG-H73-API-01` a `BUG-H73-API-07`) que comprometen la seguridad perimetral de autenticación, la robustez ante fechas inválidas, el soporte efectivo de los aliases de paginación documentados, el escape de comodines SQL, el ordenamiento por prioridad operativa ICS, la ejecución limpia del script de siembra y la integración sin colisiones con `develop` (75 commits adelantados, incluyendo HU-32 y HU-61).

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos Evaluados** | **25** | 7 defectos abiertos + 18 casos funcionales, seguridad, contrato y BD |
| **Casos Aprobados (Passed)** | **18** | Flujo base H34, filtros estándar, RBAC con JWT válido, detalle de drawer y migración 043 |
| **Defectos Abiertos / Casos Fallidos** | **7** | `BUG-H73-API-01` (Crítica), `BUG-H73-API-07` (Crítica), `BUG-H73-API-02` (Alta), `BUG-H73-API-03` (Alta), `BUG-H73-API-04` (Media), `BUG-H73-API-05` (Media), `BUG-H73-API-06` (Media) |
| **Casos Bloqueados (Blocked)** | **0** | PostgreSQL 16 + PostGIS, Redis y servidor Next.js operativos en entorno de pruebas |
| **Tasa de Aprobación (% Pass)** | **72.0%** | 18/25 aprobados; pendiente corrección de defectos, merge de `develop` y Re-Test |
| **Chequeo de Tipos Estáticos (`npx tsc --noEmit`)** | 🟢 **0 errores** | Verificado tras compilación limpia (`npm run build`) |
| **Análisis Estático de Código (`npm run lint`)** | 🟢 **0 errores** | Suite ESLint sin errores ni advertencias |
| **Compilación Productiva (`npm run build`)** | 🟢 **Exitosa** | 27/27 rutas compiladas sin errores |
| **Suite Global Automatizada (Vitest v3.2.7)** | 🟢 **860/860 tests pass** | 73/73 archivos aprobados (incluye 17 casos unitarios H73 con dependencias mockeadas) |
| **Migraciones Kysely (`npm run db:migrate`)** | 🟢 **38/38 aplicadas** | Ejecución limpia en BD vacía incluyendo `043_recuperacion_listado_rbac_e_indices` |

---

## 2. Registro Técnico de Defectos

### `BUG-H73-API-01`: Bypass de autenticación JWT mediante cabecera `X-User-Id` sin verificación criptográfica y ausencia de esquema `BearerAuth` en OpenAPI
* **Severidad:** CRÍTICA
* **Estado:** 🔴 ABIERTO
* **Módulos / Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/route.ts` (líneas 30–40)
  * `src/app/api/eventos-atp/recuperacion/[id]/route.ts` (líneas 23–33)
  * `src/lib/openapi/index.ts` (líneas 1862–1956)
  * `docs/api/eventos-atp.md` (líneas 573–580)
* **Descripción del Defecto:** Ambos Route Handlers `GET` implementan una resolución permisiva que acepta la cabecera `X-User-Id` sin firma criptográfica cuando el cliente omite la cabecera `Authorization: Bearer <token>`:
  ```typescript
  const usuarioId =
    (await extraerUsuarioId(req)) ||
    req.headers.get("x-user-id")?.trim() ||
    null;
  ```
  Cualquier cliente no autenticado puede enviar únicamente `X-User-Id: 00000000-0000-4000-8000-000000000001` (Administrador) o `00000000-0000-4000-8000-000000000003` (Encargado) y obtener `HTTP 200 OK`, accediendo al listado completo de operativos y a datos sensibles de contacto vecinal (`contactoNombre`, `contactoTelefono`, coordenadas, patrulla e historial) en el endpoint de detalle. En contraste, el endpoint hermano `POST /api/eventos-atp/recuperacion` en el mismo archivo exige estrictamente `await extraerUsuarioId(req)` y rechaza `X-User-Id` sin token con `HTTP 401`. Adicionalmente, en `src/lib/openapi/index.ts`, ninguna de las dos operaciones `GET` declara `security: [{ BearerAuth: [] }]`, sino que exponen `"authorization"` y `"x-user-id"` como parámetros manuales opcionales en `request.headers`.
* **Pasos para Reproducir:**
  1. Enviar `GET http://localhost:3001/api/eventos-atp/recuperacion?limit=1` incluyendo únicamente la cabecera `X-User-Id: 00000000-0000-4000-8000-000000000001` sin token Bearer.
  2. Enviar `GET http://localhost:3001/api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` con la misma cabecera.
  3. Inspeccionar las definiciones de ambas rutas en `GET /openapi.json`.
* **Comportamiento Esperado vs. Actual:** Debe rechazarse con `HTTP 401 Unauthorized` al carecer de token JWT Bearer válido, y declarar `security: [{ BearerAuth: [] }]` en OpenAPI. Actualmente ambos endpoints retornan `HTTP 200 OK` con información operativa y datos personales de contacto sin validar autenticación JWT.
* **Sugerencia Técnica:** Reemplazar la lectura de `x-user-id` en `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/[id]` utilizando exclusivamente `const usuarioId = await extraerUsuarioId(req);`. En `src/lib/openapi/index.ts`, añadir `security: [{ BearerAuth: [] }]` en ambos registros `registry.registerPath` y remover `"authorization"` y `"x-user-id"` de `request.headers`. Actualizar `docs/api/eventos-atp.md` para reflejar la obligatoriedad de `Authorization: Bearer <token>`.

---

### `BUG-H73-API-02`: Excepción no controlada (`HTTP 500 Internal Server Error`) al recibir `fechaDesde` o `fechaHasta` inválidos o con espacios en blanco
* **Severidad:** ALTA
* **Estado:** 🔴 ABIERTO
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.schema.ts` (líneas 220–227)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (líneas 270–276)
* **Descripción del Defecto:** `ListarRecuperacionesQuerySchema` define `fechaDesde` y `fechaHasta` únicamente como `z.string().optional()`, omitiendo la validación de formato de fecha/hora. Luego, `listarRecuperacionesPaginadoRepo` construye `new Date(filtros.fechaDesde)` y `new Date(filtros.fechaHasta)` directamente y los envía a PostgreSQL mediante Kysely. Ante cadenas inválidas (`fecha-invalida`, `no-es-fecha`) o espacios en blanco (`" "`), `new Date(...)` genera `Invalid Date`, provocando una excepción SQL/serialización no controlada en el driver `pg` que devuelve `HTTP 500 Internal Server Error` en vez de `HTTP 400 Bad Request`.
* **Pasos para Reproducir:**
  1. Autenticarse como Encargado (`Authorization: Bearer <TOKEN_ENC>`).
  2. Ejecutar `GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida` o `?fechaHasta=no-es-fecha` o `?fechaDesde=%20`.
* **Comportamiento Esperado vs. Actual:** Debe responder `HTTP 400 Bad Request` detallando el error de validación en `errors`. Actualmente responde `HTTP 500 Internal Server Error` con `{"message":"Error interno del servidor al procesar el listado de operativos de recuperación."}`.
* **Sugerencia Técnica:** Validar `fechaDesde` y `fechaHasta` en `ListarRecuperacionesQuerySchema` con `.trim()` y una aserción estricta de fecha ISO 8601 válida (`z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida; use formato ISO 8601")`), verificando además la consistencia cuando `fechaDesde > fechaHasta`.

---

### `BUG-H73-API-03`: Descarte silencioso de los aliases de paginación `pagina` y `limite` documentados en OpenAPI y `docs/api/eventos-atp.md`
* **Severidad:** ALTA
* **Estado:** 🔴 ABIERTO
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.schema.ts` (líneas 195–203)
  * `src/modules/eventos-atp/recuperacion.service.ts` (líneas 235–236)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (líneas 248–249)
* **Descripción del Defecto:** `ListarRecuperacionesQuerySchema` extiende `PaginationQuerySchema`, el cual asigna `.default(1)` a `page` y `.default(20)` a `limit`. Al recibir `?pagina=2&limite=2` sin `page` ni `limit`, Zod completa automáticamente `page: 1` y `limit: 20`. Posteriormente, tanto el servicio como el repositorio ejecutan `filtros.page ?? filtros.pagina ?? 1` y `filtros.limit ?? filtros.limite ?? 20`. Dado que `1` y `20` no son `undefined`, los aliases `pagina` y `limite` se descartan silenciosamente en todos los casos.
* **Pasos para Reproducir:**
  1. Con 6 operativos registrados en base de datos, autenticar la petición con token JWT de Encargado.
  2. Enviar `GET /api/eventos-atp/recuperacion?pagina=2&limite=2`.
* **Comportamiento Esperado vs. Actual:** Debe retornar los 2 registros de la página 2 (`meta.page: 2`, `meta.limit: 2`, `meta.totalPages: 3`). Actualmente retorna los 6 registros de la página 1 con `"meta":{"total":6,"page":1,"limit":20,"totalPages":1,"hasNext":false,"hasPrev":false}`.
* **Sugerencia Técnica:** En `ListarRecuperacionesQuerySchema`, sobrescribir `page` y `limit` como `.optional()` (sin `.default()` en Zod) para permitir que la resolución de prioridad `query.page ?? query.pagina ?? 1` y `query.limit ?? query.limite ?? 20` en servicio y repositorio aplique correctamente los valores legados cuando `page`/`limit` no fueron enviados.

---

### `BUG-H73-API-04`: Falta de sanitización de comodines SQL (`%`, `_`, `\`) en el filtro de búsqueda textual `busqueda`
* **Severidad:** MEDIA
* **Estado:** 🔴 ABIERTO
* **Módulo / Archivo Afectado:** `src/modules/eventos-atp/recuperacion.repository.ts` (líneas 278–288)
* **Descripción del Defecto:** El parámetro `busqueda` se interpola directamente en `const patron = \`%\${filtros.busqueda.trim()}%\`;` sin escapar los caracteres comodín de `ILIKE` en PostgreSQL (`\`, `%`, `_`). Peticiones con `?busqueda=%25` (`%`) o `?busqueda=_` generan los patrones `%%%` o `%_%`, devolviendo la totalidad de registros almacenados (`total: 6`) aunque ninguno contenga literalmente `%` o `_`.
* **Pasos para Reproducir:**
  1. Contar con registros en `recuperacion` sin los símbolos `%` ni `_` en `codigo`, `nombre`, `sector` o `descripcion`.
  2. Enviar `GET /api/eventos-atp/recuperacion?busqueda=%25` y `GET /api/eventos-atp/recuperacion?busqueda=_`.
* **Comportamiento Esperado vs. Actual:** Debe escapar los comodines SQL y retornar `data: []` (`meta.total: 0`). Actualmente retorna `HTTP 200 OK` con `meta.total: 6` (todos los registros del fixture).
* **Sugerencia Técnica:** Escapar `\`, `%` y `_` antes de envolver en `%...%` (homologando con `construirPatronBusqueda` de `cuadrilla.repository.ts`):
  ```typescript
  const textoSanitizado = filtros.busqueda.trim().replace(/[\\%_]/g, "\\$&");
  const patron = `%${textoSanitizado}%`;
  ```

---

### `BUG-H73-API-05`: Ordenamiento alfabético incorrecto en `ordenarPor=prioridad` (`MEDIA > CRITICA > BAJA > ALTA`) en lugar de jerarquía de severidad ICS
* **Severidad:** MEDIA
* **Estado:** 🔴 ABIERTO
* **Módulo / Archivo Afectado:** `src/modules/eventos-atp/recuperacion.repository.ts` (líneas 299–300)
* **Descripción del Defecto:** La cláusula `baseQuery = baseQuery.orderBy("recuperacion.prioridad", orden);` ordena la columna `VARCHAR` lexicográficamente. Al consultar `?ordenarPor=prioridad&orden=desc` para priorizar emergencias críticas en el Centro de Incidentes, el listado ubica primero los registros `MEDIA`, luego `CRITICA`, después `BAJA` y finalmente `ALTA`.
* **Pasos para Reproducir:**
  1. Contar con operativos en prioridades `CRITICA`, `ALTA`, `MEDIA` y `BAJA`.
  2. Enviar `GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc`.
* **Comportamiento Esperado vs. Actual:** Con `orden=desc` debe retornar en jerarquía `CRITICA → ALTA → MEDIA → BAJA`. Actualmente retorna en orden alfabético: `MEDIA` (`REC-2026-0012`, `REC-2026-0016`) → `CRITICA` (`REC-2026-0013`) → `BAJA` (`REC-2026-0015`) → `ALTA` (`REC-2026-0011`, `REC-2026-0014`).
* **Sugerencia Técnica:** Reemplazar el ordenamiento directo por una expresión `CASE` ponderada en SQL:
  ```typescript
  sql`CASE recuperacion.prioridad WHEN 'CRITICA' THEN 4 WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END`
  ```

---

### `BUG-H73-API-06`: Fallo de integridad referencial (`mision_patrulla_id_fkey`) y falta de atomicidad transaccional en `scripts/seed-h73.ts` sobre base de datos limpia
* **Severidad:** MEDIA
* **Estado:** 🔴 ABIERTO
* **Módulo / Archivo Afectado:** `scripts/seed-h73.ts` (líneas 41–42, 107–412)
* **Descripción del Defecto:** Al ejecutar `npm run db:migrate && npm run seed:h73` sobre una base de datos recién migrada, el script falla en el paso 4 (`INSERT INTO mision`) con error PostgreSQL `23503` porque referencia las patrullas `f1000000-0000-4000-8000-000000000030` y `f1000000-0000-4000-8000-000000000010` sin verificar ni garantizar su existencia previa (dependencia implícita no documentada ni validada de `npm run seed:patrullas`). Adicionalmente, `sembrarFixtureH73()` no ejecuta sus inserciones dentro de `db.transaction()`, dejando registros parciales (`recurso`, `recuperacion`, `recuperacion_recurso`) comprometidos en la base de datos tras el error.
* **Pasos para Reproducir:**
  1. Crear una base de datos limpia y ejecutar `npm run db:migrate`.
  2. Ejecutar `npm run seed:h73`.
* **Comportamiento Esperado vs. Actual:** El script debe ejecutarse de forma autónoma e idempotente dentro de una transacción atómica (o asegurar/verificar las patrullas requeridas antes de insertar misiones). Actualmente aborta con código de salida `1`: `insert or update on table "mision" violates foreign key constraint "mision_patrulla_id_fkey"`.
* **Sugerencia Técnica:** Envolver `limpiarFixtureH73()` y `sembrarFixtureH73()` en `db.transaction().execute(...)` y verificar/asegurar la existencia de las patrullas referenciadas mediante `ON CONFLICT DO NOTHING` (o usar `patrulla_id = NULL` si no existen, documentando el prerrequisito de `seed:patrullas`).

---

### `BUG-H73-API-07`: Desincronización de 75 commits con `develop` (`origin/develop`) y colisiones directas de contrato, rutas y migración con HU-32 y HU-61
* **Severidad:** CRÍTICA
* **Estado:** 🔴 ABIERTO
* **Módulos / Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/route.ts` y `src/app/api/eventos-atp/recuperacion/[id]/route.ts`
  * `src/modules/eventos-atp/recuperacion.schema.ts`, `recuperacion.service.ts` y `recuperacion.repository.ts`
  * `src/lib/db/migrations/043_recuperacion_listado_rbac_e_indices.ts` (frente a `072_evento_atp_base.ts` en `develop`)
  * `src/lib/openapi/index.ts`, `src/lib/db/types.ts`, `src/modules/seguridad/permisos.constants.ts`, `docs/api/eventos-atp.md`, `package.json` y suites de pruebas de `recuperacion`
* **Descripción del Defecto:** La rama `feature/H73-listar-operativos-recuperacion` se encuentra **75 commits por detrás de `develop` / `origin/develop`** (`git rev-list --left-right --count develop...HEAD` → `75  6`), omitiendo integraciones ya mergeadas como PR #46 (HU-32), PR #43 (HU-61), PR #47 (HU-37) y PR #59 (HU-69). Existen **13 archivos con modificaciones superpuestas** y colisiones semánticas directas:
  1. `develop` (HU-32) ya implementa `GET /api/eventos-atp/recuperacion`, `GET /api/eventos-atp/recuperacion/[id]` y `POST /api/eventos-atp/recuperacion/[id]/asignar`, redefiniendo `RecuperacionIdParamSchema`, `RecuperacionDetalleResponseSchema`, `listarEventosRecuperacionService()` (0 argumentos en `develop` vs 2 en H73) y `obtenerDetalleRecuperacionService(id)` (1 argumento en `develop` vs 2 en H73, con campos `misiones`/`recursosAsignados` vs `mision`/`patrulla`/`recursos`/`historial`).
  2. `develop` (HU-61) ya ejecutó `072_evento_atp_base.ts`, la cual crea `evento_atp` y agrega `recuperacion.evento_atp_id UUID REFERENCES evento_atp(id)` + `idx_recuperacion_evento_atp`. La migración `043_recuperacion_listado_rbac_e_indices.ts` agrega `evento_atp_id` sin FK e índice duplicado `idx_recuperacion_evento_atp_id`, su `down()` eliminaría la columna de `072`, y posee numeración `043` previa a `072`.
* **Pasos para Reproducir:**
  1. Ejecutar `git rev-list --left-right --count develop...HEAD`.
  2. Comparar archivos modificados desde el ancestro común entre `develop` y `HEAD`, e inspeccionar `src/lib/db/migrations/072_evento_atp_base.ts` y `src/app/api/eventos-atp/recuperacion/[id]/route.ts` en `develop`.
* **Comportamiento Esperado vs. Actual:** La rama debe incorporar `origin/develop`, resolver explícitamente los conflictos de contratos/servicios con HU-32 preservando la compatibilidad de `POST /api/eventos-atp/recuperacion/[id]/asignar` y renumerar la migración de HU-73 a `073_...` (posterior a `072_evento_atp_base.ts`) sin duplicar `evento_atp_id`. Actualmente presenta 13 archivos en colisión y bloqueo de merge automático.
* **Sugerencia Técnica:** Ejecutar `git merge origin/develop` en `feature/H73-listar-operativos-recuperacion`, unificar `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/[id]` integrando los permisos/contratos de HU-32 y HU-73 sin eliminar `asignarRecursosRecuperacionService`, remover `evento_atp_id` e `idx_recuperacion_evento_atp_id` de la migración de HU-73 y renumerarla a `073_recuperacion_listado_rbac_e_indices.ts`.

---

### Observaciones Técnicas Adicionales (No Bloqueantes)
* En `src/modules/eventos-atp/recuperacion.repository.ts` (líneas 481–495), la consulta de `mision` asociada en `obtenerRecuperacionDetallePorIdRepo` usa `.executeTakeFirst()` sin cláusula `.orderBy("mision.creado_en", "desc")`, lo que podría resultar no determinista si un operativo acumula más de una misión histórica (ej. tras rechazo y reasignación).
* No existe una suite unitaria dedicada para `recuperacion.repository.ts` (`src/modules/eventos-atp/__tests__/recuperacion.repository.test.ts`), por lo que la lógica Kysely de filtros, escapes `ILIKE`, ordenamiento y armado de historial solo se ejercita frente a PostgreSQL real. Asimismo, `src/app/openapi.json/__tests__/route.test.ts` aún no incluye aserciones explícitas sobre `GET /api/eventos-atp/recuperacion` ni `GET /api/eventos-atp/recuperacion/{id}`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H73-API-01` | Bypass de autenticación JWT mediante cabecera X-User-Id sin firma y ausencia de security BearerAuth en OpenAPI | Seguridad / Auth | Route Handler / OpenAPI | Crítica | Servidor API activo y fixture H73 sembrado en PostgreSQL | `GET /api/eventos-atp/recuperacion?limit=1` y `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `X-User-Id: 00000000-0000-4000-8000-000000000001` sin JWT] | HTTP 401 Unauthorized rechazando acceso sin JWT Bearer y registro `security: [{ BearerAuth: [] }]` en `/openapi.json` | HTTP 200 OK exponiendo listado y datos de contacto en ambos GET, y `security` ausente en OpenAPI | **ABIERTO** | 24/11/2026 01:59 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-02` | Excepción SQL no controlada (HTTP 500) ante parámetros fechaDesde o fechaHasta inválidos o en blanco | Robustez / Validación | Schema / Repository | Alta | Usuario autenticado con permiso `recuperacion:leer` | `GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida`, `?fechaHasta=no-es-fecha`, `?fechaDesde=%20` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 400 Bad Request con detalle de validación en `errors` | HTTP 500 Internal Server Error (`Error interno del servidor al procesar el listado de operativos de recuperación.`) | **ABIERTO** | 24/11/2026 01:59 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-03` | Descarte silencioso de aliases de paginación pagina y limite documentados en OpenAPI | Paginación / Contrato | Schema / Service / Repo | Alta | 6 operativos registrados en BD y usuario Encargado autenticado | `GET /api/eventos-atp/recuperacion?pagina=2&limite=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK retornando 2 registros de la página 2 y `meta: { total: 6, page: 2, limit: 2, totalPages: 3 }` | HTTP 200 OK retornando todos los 6 registros con `meta: { total: 6, page: 1, limit: 20, totalPages: 1 }` | **ABIERTO** | 24/11/2026 01:59 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-04` | Falta de sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda | Seguridad / SQL | Repository / Kysely | Media | 6 operativos en BD sin los caracteres literales `%` ni `_` en código, título, sector o descripción | `GET /api/eventos-atp/recuperacion?busqueda=%25` y `?busqueda=_` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `data: []` y `meta.total: 0` tras escapar comodines `ILIKE` | HTTP 200 OK retornando `meta.total: 6` (todos los registros de la tabla) | **ABIERTO** | 24/11/2026 01:59 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-05` | Ordenamiento alfabético erróneo en ordenarPor=prioridad en lugar de jerarquía de severidad ICS | Lógica de Negocio / ICS | Repository / Kysely | Media | Operativos con prioridades `CRITICA`, `ALTA`, `MEDIA` y `BAJA` | `GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc` [Header: `Authorization: Bearer <TOKEN_ENC>`] | Orden descendente por severidad ICS: `CRITICA -> ALTA -> MEDIA -> BAJA` | Orden lexicográfico invertido: `MEDIA -> CRITICA -> BAJA -> ALTA` | **ABIERTO** | 24/11/2026 01:59 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-06` | Fallo de clave foránea mision_patrulla_id_fkey y ausencia de transacción en seed:h73 sobre BD limpia | Integridad / Seed DB | Script Seed / PostgreSQL | Media | Base de datos PostgreSQL recién migrada con `npm run db:migrate` sin siembra previa de patrullas | `DATABASE_URL=.../sgrai_qa_test npm run seed:h73` | Ejecución autónoma, transaccional e idempotente creando los 6 operativos sin errores de FK | Falla con código 1 (`insert or update on table "mision" violates foreign key constraint "mision_patrulla_id_fkey"`) dejando datos parciales | **ABIERTO** | 24/11/2026 01:58 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-07` | Desincronización de 75 commits con develop y colisiones de contratos, rutas y migración 043 vs HU-32 y HU-61 | Integración / Git & DB | Rama / Contratos / Migración | Crítica | Rama `feature/H73-listar-operativos-recuperacion` frente a `develop` actualizado | `git rev-list --left-right --count develop...HEAD` y comparación con `072_evento_atp_base.ts` y HU-32 | Rama sincronizada con `origin/develop`, contratos unificados con HU-32 y migración numerada como `073_` posterior a `072_` | Rama 75 commits detrás de `develop` con 13 archivos en colisión directa y migración `043` redundante con `072` | **ABIERTO** | 24/11/2026 02:07 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H73-API-01` | Listado paginado base sin filtros con valores por defecto (page=1, limit=20) y campos de tabla (CA-1, CA-2, CA-5) | Funcional / API REST | Integración E2E | Crítica | Usuario Encargado autenticado y 6 operativos del fixture sembrados | `GET /api/eventos-atp/recuperacion` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con código, nombre, delegación, estado, `cantidadInsumosAsignados`, `creadoEn` y `meta` H34 | HTTP 200 OK con los 6 operativos ordenados por `creadoEn` descendente y estructura H34 completa | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-02` | Paginación estándar H34 mediante page=2 y limit=2 con metadatos completos (CA-1, CA-5) | Funcional / Paginación | Integración E2E | Crítica | 6 operativos en BD y token JWT de Encargado | `GET /api/eventos-atp/recuperacion?page=2&limit=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con 2 ítems y `meta: { total: 6, page: 2, limit: 2, totalPages: 3, hasNext: true, hasPrev: true }` | HTTP 200 OK retornando `REC-2026-0014` y `REC-2026-0015` con `meta` exacto | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-03` | Consulta de página fuera de rango (page=99&limit=2) sin error SQL IN () | Robustez / Borde | Repository / E2E | Alta | 6 operativos en BD y token JWT de Encargado | `GET /api/eventos-atp/recuperacion?page=99&limit=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `data: []` y `meta: { total: 6, page: 99, limit: 2, totalPages: 3, hasNext: false, hasPrev: true }` | HTTP 200 OK con `data: []` sin ejecutar consulta `IN ()` vacía | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-04` | Rechazo de peticiones sin credenciales o con token JWT inválido o manipulado | Seguridad / Auth | Route Handler / Guard | Crítica | Servidor API activo sin token o con JWT adulterado | `GET /api/eventos-atp/recuperacion` (sin headers) y con `Authorization: Bearer invalid.jwt.token` | HTTP 401 Unauthorized en ambos escenarios | HTTP 401 (`Se requiere cabecera...` y `Token de sesión inválido o expirado.`) | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-05` | Acceso autorizado al listado para perfiles Administrador y Encargado con permiso recuperacion:leer | Seguridad / RBAC | Integración E2E | Crítica | Usuarios `admin@valdivia.cl` y `encargado@valdivia.cl` autenticados vía `/api/seguridad/login` | `GET /api/eventos-atp/recuperacion?limit=1` con `Bearer <TOKEN_ADM>` y `Bearer <TOKEN_ENC>` | HTTP 200 OK para ambos roles autorizados | HTTP 200 OK validando permiso `recuperacion:leer` para ambos perfiles | **APROBADO** | 24/11/2026 01:59 | - | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-06` | Acceso autorizado al listado para perfil Supervisor Estratégico tras migración 043 | Seguridad / RBAC | Integración E2E | Alta | Usuario `supervisor@valdivia.cl` (`SUPERVISOR`) autenticado con JWT Bearer | `GET /api/eventos-atp/recuperacion?limit=1` [Header: `Authorization: Bearer <TOKEN_SUP>`] | HTTP 200 OK permitiendo monitoreo gerencial de operativos de recuperación | HTTP 200 OK retornando listado paginado y metadatos H34 | **APROBADO** | 24/11/2026 01:59 | - | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-07` | Bloqueo RBAC (HTTP 403 Forbidden) para usuario autenticado sin permiso recuperacion:leer | Seguridad / RBAC | Integración E2E | Crítica | Usuario `callcenter@valdivia.cl` (`CALL_CENTER`) autenticado con JWT Bearer | `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `Bearer <TOKEN_CC>`] | HTTP 403 Forbidden indicando ausencia de permiso `recuperacion:leer` | HTTP 403 Forbidden (`No cuenta con el permiso requerido: recuperacion:leer`) en ambos endpoints | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-08` | Filtrado territorial por delegacionId UUID válido (CA-3, CA-5) | Funcional / Filtro | Integración E2E | Crítica | Operativos distribuidos en las 4 delegaciones de Valdivia | `GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003` [Header: `Bearer <TOKEN_ENC>`] | HTTP 200 OK retornando solo operativos de Delegación Municipal Costa (`REC-2026-0011` y `REC-2026-0015`) | HTTP 200 OK con `meta.total: 2` pertenecientes exclusivamente a `DEL_COSTA` | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-09` | Filtrado por estado operativo (EN_EJECUCION) y por prioridad (CRITICA) (CA-2, CA-3, CA-5) | Funcional / Filtro | Integración E2E | Crítica | Operativos en los 4 estados del ciclo de vida y 4 niveles de prioridad | `GET /api/eventos-atp/recuperacion?estado=EN_EJECUCION` y `?prioridad=CRITICA` | HTTP 200 OK filtrando exactamente por el estado y prioridad solicitados | HTTP 200 OK retornando `REC-2026-0011`/`REC-2026-0014` (`total: 2`) para `EN_EJECUCION` y `REC-2026-0013` (`total: 1`) para `CRITICA` | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-10` | Filtrado combinado conjuntivo AND entre delegacionId y estado (CA-3, CA-5) | Integración / Filtro | Integración E2E | Alta | Operativos en Costa en estados `EN_EJECUCION` y `CANCELADA` | `GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION` | HTTP 200 OK retornando exclusivamente la intersección (`REC-2026-0011`) | HTTP 200 OK con `meta.total: 1` (`REC-2026-0011`) | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-11` | Búsqueda textual parcial insensible a mayúsculas por código o título y estado vacío (CA-3, CA-5) | Funcional / Búsqueda | Integración E2E | Crítica | Operativos registrados con códigos `REC-2026-0011..0016` | `?busqueda=REC-2026-0013`, `?busqueda=techumbres` y `?busqueda=INEXISTENTE_XYZ_999` | Coincidencias exactas para código (1) y título (2), y `data: []` con `total: 0` para término inexistente | HTTP 200 OK retornando `REC-2026-0013` (`total: 1`), `REC-2026-0011`/`0016` (`total: 2`) y `data: []` (`total: 0`, `totalPages: 0`) | **APROBADO** | 24/11/2026 02:00 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-12` | Filtrado temporal válido ISO 8601 (fechaDesde/fechaHasta) y ordenamiento por codigo y familiasAfectadas (CA-5) | Funcional / Filtro & Orden | Integración E2E | Alta | Operativos con timestamps escalonados en BD | `?fechaDesde=2026-11-23T23:01:01Z&fechaHasta=2026-11-24T06:01:01Z`, `?ordenarPor=codigo&orden=asc` y `?ordenarPor=familiasAfectadas&orden=desc` | Rango temporal acotado a 3 registros recientes y ordenamiento correcto por código ascendente y familias descendente | HTTP 200 OK con `total: 3` en ventana temporal y secuencias exactas (`REC-2026-0011..0016` y `42,35,18,12,8,5`) | **APROBADO** | 24/11/2026 02:01 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-13` | Validación Zod ante parámetros de consulta inválidos (delegacionId, estado, limit > 100, page < 1) (CA-5) | Validación / Schema | Integración E2E & Vitest | Alta | Esquema `ListarRecuperacionesQuerySchema` activo | `?delegacionId=no-uuid`, `?estado=OTRO`, `?limit=150` y unit test Zod | HTTP 400 Bad Request con arreglo `errors` detallando campo y mensaje | HTTP 400 Bad Request en los 3 casos y suite unitaria `recuperacion.service.test.ts` aprobada | **APROBADO** | 24/11/2026 01:59 | - | test(eventos-atp): agregar pruebas unitarias para listado y drawer de recuperacion (H73) |
| `CP-H73-API-14` | Consulta de detalle consolidado GET /api/eventos-atp/recuperacion/{id} para drawer lateral con recursos, misión, patrulla e historial (CA-4) | Funcional / Drawer | Integración E2E | Crítica | Operativo `REC-2026-0011` (`73100000-...0001`) con misión, patrulla, 2 insumos, 2 hitos y 1 reporte | `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `Bearer <TOKEN_ENC>`] | HTTP 200 OK con `recursos` detallados, `cantidadInsumosAsignados: 100`, `mision`, `patrulla` e `historial` de 4 eventos ordenados | HTTP 200 OK entregando estructura consolidada completa con línea de tiempo cronológica | **APROBADO** | 24/11/2026 01:59 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-15` | Consulta de detalle para operativo COMPLETADA (con cierre) y operativos sin misión o sin patrulla asignada (CA-4) | Borde / Drawer | Integración E2E | Alta | Operativos `REC-2026-0012` (`COMPLETADA`), `REC-2026-0013` (sin misión) y `REC-2026-0014` (sin patrulla) | `GET /api/eventos-atp/recuperacion/{id}` para IDs `...0002`, `...0003` y `...0004` | HTTP 200 OK incluyendo `ESTADO_OPERATIVO` y `observacionesCierre` en `...0002`, `mision: null` en `...0003` y `patrulla: null` en `...0004` | HTTP 200 OK sin excepciones de join en ningún caso de nulabilidad | **APROBADO** | 24/11/2026 02:01 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-16` | Rechazo de UUID inválido (400), inexistente (404) y exclusión por baja lógica (eliminado_en IS NOT NULL) (CA-4, CA-5) | Validación / Integridad | Integración E2E | Alta | Operativo `REC-2026-0016` marcado temporalmente con `eliminado_en = NOW()` en BD | `GET .../id-invalido`, `GET .../70000000-0000-4000-8000-000000000099`, `GET .../73100000-...0006` (baja lógica) | HTTP 400 Bad Request, HTTP 404 Not Found y exclusión de registro eliminado en detalle (404) y listado (`total: 5`) | HTTP 400, HTTP 404 y exclusión verificada en listado (`total: 5`) y detalle (`404`) | **APROBADO** | 24/11/2026 02:00 | - | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-17` | Ejecución limpia de migración 043_recuperacion_listado_rbac_e_indices.ts sobre base de datos nueva | Migración / DB | Migrator Kysely | Crítica | Base de datos limpia `sgrai_qa_test` en PostgreSQL 16 + PostGIS | `DATABASE_URL=.../sgrai_qa_test npm run db:migrate` | 38/38 migraciones aplicadas sin colisión agregando columnas, 4 índices y permiso `recuperacion:leer` a `ADMIN`, `ENCARGADO` y `SUPERVISOR` | 38/38 migraciones ejecutadas con éxito (`[OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"`) | **APROBADO** | 24/11/2026 01:58 | - | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-18` | Verificación de build productivo, tipado TypeScript, análisis estático ESLint, documentación API y suite global Vitest | Calidad / CI | Estático & Unitario | Crítica | Entorno Node.js con dependencias instaladas y rama `feature/H73-listar-operativos-recuperacion` | `npm run build && npx tsc --noEmit && npm run lint && npm test` y revisión de `docs/api/eventos-atp.md` | Build, `tsc` y `lint` con 0 errores, documentación §8.1/§8.2 presente y 100% de tests unitarios aprobados | Build 27/27 páginas OK, `tsc` 0 errores, `lint` 0 errores, 73/73 archivos (860/860 tests) aprobados y `docs/api/eventos-atp.md` documentado | **APROBADO** | 24/11/2026 01:57 | - | test(eventos-atp): agregar pruebas unitarias para listado y drawer de recuperacion (H73) |

---

## 4. Bloque TSV

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H73-API-01	Bypass de autenticación JWT mediante cabecera X-User-Id sin firma y ausencia de security BearerAuth en OpenAPI	Seguridad / Auth	Route Handler / OpenAPI	Crítica	Servidor API activo y fixture H73 sembrado en PostgreSQL	GET /api/eventos-atp/recuperacion?limit=1 y GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: X-User-Id: 00000000-0000-4000-8000-000000000001 sin JWT]	HTTP 401 Unauthorized rechazando acceso sin JWT Bearer y registro security: [{ BearerAuth: [] }] en /openapi.json	HTTP 200 OK exponiendo listado y datos de contacto en ambos GET, y security ausente en OpenAPI	ABIERTO	24/11/2026 01:59	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-02	Excepción SQL no controlada (HTTP 500) ante parámetros fechaDesde o fechaHasta inválidos o en blanco	Robustez / Validación	Schema / Repository	Alta	Usuario autenticado con permiso recuperacion:leer	GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida, ?fechaHasta=no-es-fecha, ?fechaDesde=%20 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 400 Bad Request con detalle de validación en errors	HTTP 500 Internal Server Error (Error interno del servidor al procesar el listado de operativos de recuperación.)	ABIERTO	24/11/2026 01:59	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-03	Descarte silencioso de aliases de paginación pagina y limite documentados en OpenAPI	Paginación / Contrato	Schema / Service / Repo	Alta	6 operativos registrados en BD y usuario Encargado autenticado	GET /api/eventos-atp/recuperacion?pagina=2&limite=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK retornando 2 registros de la página 2 y meta: { total: 6, page: 2, limit: 2, totalPages: 3 }	HTTP 200 OK retornando todos los 6 registros con meta: { total: 6, page: 1, limit: 20, totalPages: 1 }	ABIERTO	24/11/2026 01:59	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-04	Falta de sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda	Seguridad / SQL	Repository / Kysely	Media	6 operativos en BD sin los caracteres literales % ni _ en código, título, sector o descripción	GET /api/eventos-atp/recuperacion?busqueda=%25 y ?busqueda=_ [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con data: [] y meta.total: 0 tras escapar comodines ILIKE	HTTP 200 OK retornando meta.total: 6 (todos los registros de la tabla)	ABIERTO	24/11/2026 01:59	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-05	Ordenamiento alfabético erróneo en ordenarPor=prioridad en lugar de jerarquía de severidad ICS	Lógica de Negocio / ICS	Repository / Kysely	Media	Operativos con prioridades CRITICA, ALTA, MEDIA y BAJA	GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc [Header: Authorization: Bearer <TOKEN_ENC>]	Orden descendente por severidad ICS: CRITICA -> ALTA -> MEDIA -> BAJA	Orden lexicográfico invertido: MEDIA -> CRITICA -> BAJA -> ALTA	ABIERTO	24/11/2026 01:59	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-06	Fallo de clave foránea mision_patrulla_id_fkey y ausencia de transacción en seed:h73 sobre BD limpia	Integridad / Seed DB	Script Seed / PostgreSQL	Media	Base de datos PostgreSQL recién migrada con npm run db:migrate sin siembra previa de patrullas	DATABASE_URL=.../sgrai_qa_test npm run seed:h73	Ejecución autónoma, transaccional e idempotente creando los 6 operativos sin errores de FK	Falla con código 1 (insert or update on table "mision" violates foreign key constraint "mision_patrulla_id_fkey") dejando datos parciales	ABIERTO	24/11/2026 01:58	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-07	Desincronización de 75 commits con develop y colisiones de contratos, rutas y migración 043 vs HU-32 y HU-61	Integración / Git & DB	Rama / Contratos / Migración	Crítica	Rama feature/H73-listar-operativos-recuperacion frente a develop actualizado	git rev-list --left-right --count develop...HEAD y comparación con 072_evento_atp_base.ts y HU-32	Rama sincronizada con origin/develop, contratos unificados con HU-32 y migración numerada como 073_ posterior a 072_	Rama 75 commits detrás de develop con 13 archivos en colisión directa y migración 043 redundante con 072	ABIERTO	24/11/2026 02:07	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H73-API-01	Listado paginado base sin filtros con valores por defecto (page=1, limit=20) y campos de tabla (CA-1, CA-2, CA-5)	Funcional / API REST	Integración E2E	Crítica	Usuario Encargado autenticado y 6 operativos del fixture sembrados	GET /api/eventos-atp/recuperacion [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con código, nombre, delegación, estado, cantidadInsumosAsignados, creadoEn y meta H34	HTTP 200 OK con los 6 operativos ordenados por creadoEn descendente y estructura H34 completa	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-02	Paginación estándar H34 mediante page=2 y limit=2 con metadatos completos (CA-1, CA-5)	Funcional / Paginación	Integración E2E	Crítica	6 operativos en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion?page=2&limit=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con 2 ítems y meta: { total: 6, page: 2, limit: 2, totalPages: 3, hasNext: true, hasPrev: true }	HTTP 200 OK retornando REC-2026-0014 y REC-2026-0015 con meta exacto	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-03	Consulta de página fuera de rango (page=99&limit=2) sin error SQL IN ()	Robustez / Borde	Repository / E2E	Alta	6 operativos en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion?page=99&limit=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con data: [] y meta: { total: 6, page: 99, limit: 2, totalPages: 3, hasNext: false, hasPrev: true }	HTTP 200 OK con data: [] sin ejecutar consulta IN () vacía	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-04	Rechazo de peticiones sin credenciales o con token JWT inválido o manipulado	Seguridad / Auth	Route Handler / Guard	Crítica	Servidor API activo sin token o con JWT adulterado	GET /api/eventos-atp/recuperacion (sin headers) y con Authorization: Bearer invalid.jwt.token	HTTP 401 Unauthorized en ambos escenarios	HTTP 401 (Se requiere cabecera... y Token de sesión inválido o expirado.)	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-05	Acceso autorizado al listado para perfiles Administrador y Encargado con permiso recuperacion:leer	Seguridad / RBAC	Integración E2E	Crítica	Usuarios admin@valdivia.cl y encargado@valdivia.cl autenticados vía /api/seguridad/login	GET /api/eventos-atp/recuperacion?limit=1 con Bearer <TOKEN_ADM> y Bearer <TOKEN_ENC>	HTTP 200 OK para ambos roles autorizados	HTTP 200 OK validando permiso recuperacion:leer para ambos perfiles	APROBADO	24/11/2026 01:59	-	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-06	Acceso autorizado al listado para perfil Supervisor Estratégico tras migración 043	Seguridad / RBAC	Integración E2E	Alta	Usuario supervisor@valdivia.cl (SUPERVISOR) autenticado con JWT Bearer	GET /api/eventos-atp/recuperacion?limit=1 [Header: Authorization: Bearer <TOKEN_SUP>]	HTTP 200 OK permitiendo monitoreo gerencial de operativos de recuperación	HTTP 200 OK retornando listado paginado y metadatos H34	APROBADO	24/11/2026 01:59	-	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-07	Bloqueo RBAC (HTTP 403 Forbidden) para usuario autenticado sin permiso recuperacion:leer	Seguridad / RBAC	Integración E2E	Crítica	Usuario callcenter@valdivia.cl (CALL_CENTER) autenticado con JWT Bearer	GET /api/eventos-atp/recuperacion y GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: Bearer <TOKEN_CC>]	HTTP 403 Forbidden indicando ausencia de permiso recuperacion:leer	HTTP 403 Forbidden (No cuenta con el permiso requerido: recuperacion:leer) en ambos endpoints	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-08	Filtrado territorial por delegacionId UUID válido (CA-3, CA-5)	Funcional / Filtro	Integración E2E	Crítica	Operativos distribuidos en las 4 delegaciones de Valdivia	GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003 [Header: Bearer <TOKEN_ENC>]	HTTP 200 OK retornando solo operativos de Delegación Municipal Costa (REC-2026-0011 y REC-2026-0015)	HTTP 200 OK con meta.total: 2 pertenecientes exclusivamente a DEL_COSTA	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-09	Filtrado por estado operativo (EN_EJECUCION) y por prioridad (CRITICA) (CA-2, CA-3, CA-5)	Funcional / Filtro	Integración E2E	Crítica	Operativos en los 4 estados del ciclo de vida y 4 niveles de prioridad	GET /api/eventos-atp/recuperacion?estado=EN_EJECUCION y ?prioridad=CRITICA	HTTP 200 OK filtrando exactamente por el estado y prioridad solicitados	HTTP 200 OK retornando REC-2026-0011/REC-2026-0014 (total: 2) para EN_EJECUCION y REC-2026-0013 (total: 1) para CRITICA	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-10	Filtrado combinado conjuntivo AND entre delegacionId y estado (CA-3, CA-5)	Integración / Filtro	Integración E2E	Alta	Operativos en Costa en estados EN_EJECUCION y CANCELADA	GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION	HTTP 200 OK retornando exclusivamente la intersección (REC-2026-0011)	HTTP 200 OK con meta.total: 1 (REC-2026-0011)	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-11	Búsqueda textual parcial insensible a mayúsculas por código o título y estado vacío (CA-3, CA-5)	Funcional / Búsqueda	Integración E2E	Crítica	Operativos registrados con códigos REC-2026-0011..0016	?busqueda=REC-2026-0013, ?busqueda=techumbres y ?busqueda=INEXISTENTE_XYZ_999	Coincidencias exactas para código (1) y título (2), y data: [] con total: 0 para término inexistente	HTTP 200 OK retornando REC-2026-0013 (total: 1), REC-2026-0011/0016 (total: 2) y data: [] (total: 0, totalPages: 0)	APROBADO	24/11/2026 02:00	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-12	Filtrado temporal válido ISO 8601 (fechaDesde/fechaHasta) y ordenamiento por codigo y familiasAfectadas (CA-5)	Funcional / Filtro & Orden	Integración E2E	Alta	Operativos con timestamps escalonados en BD	?fechaDesde=2026-11-23T23:01:01Z&fechaHasta=2026-11-24T06:01:01Z, ?ordenarPor=codigo&orden=asc y ?ordenarPor=familiasAfectadas&orden=desc	Rango temporal acotado a 3 registros recientes y ordenamiento correcto por código ascendente y familias descendente	HTTP 200 OK con total: 3 en ventana temporal y secuencias exactas (REC-2026-0011..0016 y 42,35,18,12,8,5)	APROBADO	24/11/2026 02:01	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-13	Validación Zod ante parámetros de consulta inválidos (delegacionId, estado, limit > 100, page < 1) (CA-5)	Validación / Schema	Integración E2E & Vitest	Alta	Esquema ListarRecuperacionesQuerySchema activo	?delegacionId=no-uuid, ?estado=OTRO, ?limit=150 y unit test Zod	HTTP 400 Bad Request con arreglo errors detallando campo y mensaje	HTTP 400 Bad Request en los 3 casos y suite unitaria recuperacion.service.test.ts aprobada	APROBADO	24/11/2026 01:59	-	test(eventos-atp): agregar pruebas unitarias para listado y drawer de recuperacion (H73)
CP-H73-API-14	Consulta de detalle consolidado GET /api/eventos-atp/recuperacion/{id} para drawer lateral con recursos, misión, patrulla e historial (CA-4)	Funcional / Drawer	Integración E2E	Crítica	Operativo REC-2026-0011 (73100000-...0001) con misión, patrulla, 2 insumos, 2 hitos y 1 reporte	GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: Bearer <TOKEN_ENC>]	HTTP 200 OK con recursos detallados, cantidadInsumosAsignados: 100, mision, patrulla e historial de 4 eventos ordenados	HTTP 200 OK entregando estructura consolidada completa con línea de tiempo cronológica	APROBADO	24/11/2026 01:59	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-15	Consulta de detalle para operativo COMPLETADA (con cierre) y operativos sin misión o sin patrulla asignada (CA-4)	Borde / Drawer	Integración E2E	Alta	Operativos REC-2026-0012 (COMPLETADA), REC-2026-0013 (sin misión) y REC-2026-0014 (sin patrulla)	GET /api/eventos-atp/recuperacion/{id} para IDs ...0002, ...0003 y ...0004	HTTP 200 OK incluyendo ESTADO_OPERATIVO y observacionesCierre en ...0002, mision: null en ...0003 y patrulla: null en ...0004	HTTP 200 OK sin excepciones de join en ningún caso de nulabilidad	APROBADO	24/11/2026 02:01	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-16	Rechazo de UUID inválido (400), inexistente (404) y exclusión por baja lógica (eliminado_en IS NOT NULL) (CA-4, CA-5)	Validación / Integridad	Integración E2E	Alta	Operativo REC-2026-0016 marcado temporalmente con eliminado_en = NOW() en BD	GET .../id-invalido, GET .../70000000-0000-4000-8000-000000000099, GET .../73100000-...0006 (baja lógica)	HTTP 400 Bad Request, HTTP 404 Not Found y exclusión de registro eliminado en detalle (404) y listado (total: 5)	HTTP 400, HTTP 404 y exclusión verificada en listado (total: 5) y detalle (404)	APROBADO	24/11/2026 02:00	-	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-17	Ejecución limpia de migración 043_recuperacion_listado_rbac_e_indices.ts sobre base de datos nueva	Migración / DB	Migrator Kysely	Crítica	Base de datos limpia sgrai_qa_test en PostgreSQL 16 + PostGIS	DATABASE_URL=.../sgrai_qa_test npm run db:migrate	38/38 migraciones aplicadas sin colisión agregando columnas, 4 índices y permiso recuperacion:leer a ADMIN, ENCARGADO y SUPERVISOR	38/38 migraciones ejecutadas con éxito ([OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices")	APROBADO	24/11/2026 01:58	-	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-18	Verificación de build productivo, tipado TypeScript, análisis estático ESLint, documentación API y suite global Vitest	Calidad / CI	Estático & Unitario	Crítica	Entorno Node.js con dependencias instaladas y rama feature/H73-listar-operativos-recuperacion	npm run build && npx tsc --noEmit && npm run lint && npm test y revisión de docs/api/eventos-atp.md	Build, tsc y lint con 0 errores, documentación §8.1/§8.2 presente y 100% de tests unitarios aprobados	Build 27/27 páginas OK, tsc 0 errores, lint 0 errores, 73/73 archivos (860/860 tests) aprobados y docs/api/eventos-atp.md documentado	APROBADO	24/11/2026 01:57	-	test(eventos-atp): agregar pruebas unitarias para listado y drawer de recuperacion (H73)
````

---

## 5. Guía de Ejecución Paso a Paso

### 5.1. Verificación de Calidad Estática, Build y Pruebas Unitarias (Vitest)

1. **Compilación productiva, verificación TypeScript y análisis estático:**
   ```bash
   npm run build && npx tsc --noEmit && npm run lint
   ```
   Salida observada:
   ```text
   ✓ Compiled successfully in 855ms
   Finished TypeScript in 10.1s
   ✓ Generating static pages using 15 workers (27/27) in 213ms
   (npx tsc --noEmit -> exit code 0)
   (npm run lint -> exit code 0)
   ```

2. **Pruebas unitarias de servicio y esquemas (HU-73 Listado):**
   ```bash
   npm test -- src/modules/eventos-atp/__tests__/recuperacion.service.test.ts -t "Listado Paginado"
   ```
   Salida observada:
   ```text
   ✓ src/modules/eventos-atp/__tests__/recuperacion.service.test.ts (20 tests | 14 skipped) 27ms
   Test Files  1 passed (1)
        Tests  6 passed | 14 skipped (20)
   ```

3. **Pruebas unitarias de servicio para Drawer de detalle (HU-73 Drawer):**
   ```bash
   npm test -- src/modules/eventos-atp/__tests__/recuperacion.service.test.ts -t "Drawer"
   ```
   Salida observada:
   ```text
   ✓ src/modules/eventos-atp/__tests__/recuperacion.service.test.ts (20 tests | 18 skipped) 14ms
   Test Files  1 passed (1)
        Tests  2 passed | 18 skipped (20)
   ```

4. **Pruebas unitarias de Route Handlers (`GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/[id]`):**
   ```bash
   npm test -- src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts -t "HU-73"
   npm test -- "src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts" -t "Drawer"
   ```
   Salidas observadas:
   ```text
   ✓ src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts (12 tests | 8 skipped) 43ms
   Test Files  1 passed (1)
        Tests  4 passed | 8 skipped (12)

   ✓ src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts (5 tests) 36ms
   Test Files  1 passed (1)
        Tests  5 passed (5)
   ```

5. **Suite completa del repositorio:**
   ```bash
   npm test
   ```
   Salida observada:
   ```text
   Test Files  73 passed (73)
        Tests  860 passed (860)
   ```

---

### 5.2. Preparación de Base de Datos Limpia, Migración 043 y Reproducción de `BUG-H73-API-06`

1. **Ejecución limpia de migraciones Kysely (`001` a `071`, incluyendo `043_recuperacion_listado_rbac_e_indices`):**
   ```bash
   docker exec grupo1_postgres psql -U sgrai -d postgres -c "DROP DATABASE IF EXISTS sgrai_qa_test;" -c "CREATE DATABASE sgrai_qa_test;"
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run db:migrate
   ```
   Salida observada (extracto):
   ```text
   [OK] Migración Kysely ejecutada con éxito: "042_cuadrilla_patrulla_integrantes_vistas"
   [OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"
   [OK] Migración Kysely ejecutada con éxito: "061_notificaciones_mision"
   [OK] Migración Kysely ejecutada con éxito: "071_indices_listado_cuadrillas"
   Todas las migraciones se completaron correctamente.
   ```

2. **Reproducción de `BUG-H73-API-06` (ejecución directa de `seed:h73` sobre BD limpia):**
   ```bash
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run seed:h73
   ```
   Salida observada (código de salida `1`):
   ```text
   Error al ejecutar fixture H73: error: insert or update on table "mision" violates foreign key constraint "mision_patrulla_id_fkey"
   detail: 'Key (patrulla_id)=(f1000000-0000-4000-8000-000000000030) is not present in table "patrulla_verificadora".'
   ```

3. **Siembra previa de patrullas para habilitar la ejecución de pruebas en vivo contra el servidor:**
   ```bash
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run seed:patrullas
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run seed:h73
   PORT=3001 DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm start
   ```

---

### 5.3. Pruebas HTTP en Vivo (cURL) y Evidencia de Defectos y Casos Aprobados

#### Obtención de tokens JWT Bearer
```bash
TOKEN_ENC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.token)')

TOKEN_ADM=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"admin@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.token)')

TOKEN_SUP=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"supervisor@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.token)')

TOKEN_CC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.token)')
```

#### Evidencia de Defectos Abiertos (`BUG-H73-API-01` a `BUG-H73-API-05`)

1. **`BUG-H73-API-01` (Bypass de autenticación con `X-User-Id` sin JWT):**
   ```bash
   curl -i -s -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
     "http://localhost:3001/api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001"
   ```
   Respuesta obtenida (`HTTP/1.1 200 OK` en lugar de `401`):
   ```json
   {
     "message": "Detalle de operativo de recuperación obtenido exitosamente.",
     "data": {
       "id": "73100000-0000-4000-8000-000000000001",
       "codigo": "REC-2026-0011",
       "contactoNombre": "Mariana Cárdenas (Pdta. JJVV Niebla)",
       "contactoTelefono": "+56987654321",
       "estado": "EN_EJECUCION"
     }
   }
   ```
   Contraste con `POST /api/eventos-atp/recuperacion` usando la misma cabecera sin JWT:
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -X POST -H "Content-Type: application/json" \
     -H "X-User-Id: 00000000-0000-4000-8000-000000000001" -d '{}' \
     "http://localhost:3001/api/eventos-atp/recuperacion"
   ```
   ```text
   {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
   HTTP:401
   ```

2. **`BUG-H73-API-02` (Error HTTP 500 por `fechaDesde` / `fechaHasta` inválidos):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?fechaDesde=fecha-invalida"
   ```
   Respuesta obtenida:
   ```text
   {"message":"Error interno del servidor al procesar el listado de operativos de recuperación."}
   HTTP:500
   ```

3. **`BUG-H73-API-03` (Descarte silencioso de `pagina` y `limite`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?pagina=2&limite=2"
   ```
   Respuesta obtenida (retorna los 6 registros de la página 1):
   ```json
   {
     "message": "Listado de operativos de recuperación obtenido exitosamente",
     "data": [ "...", "...", "...", "...", "...", "..." ],
     "meta": {
       "total": 6,
       "page": 1,
       "limit": 20,
       "totalPages": 1,
       "hasNext": false,
       "hasPrev": false
     }
   }
   ```

4. **`BUG-H73-API-04` (Comodines SQL `%` y `_` sin escapar en `busqueda`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?busqueda=%25"
   ```
   Respuesta obtenida (`meta.total: 6` en vez de `0`):
   ```json
   {
     "meta": {
       "total": 6,
       "page": 1,
       "limit": 20,
       "totalPages": 1,
       "hasNext": false,
       "hasPrev": false
     }
   }
   ```

5. **`BUG-H73-API-05` (Ordenamiento lexicográfico de `prioridad`):**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc"
   ```
   Secuencia observada de prioridades en `data`:
   ```text
   REC-2026-0012 (MEDIA) -> REC-2026-0016 (MEDIA) -> REC-2026-0013 (CRITICA) -> REC-2026-0015 (BAJA) -> REC-2026-0011 (ALTA) -> REC-2026-0014 (ALTA)
   ```

#### Evidencia de Casos Aprobados (`CP-H73-API-01` a `CP-H73-API-16`)

1. **Paginación estándar H34 (`CP-H73-API-02`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?page=2&limit=2"
   ```
   Respuesta (`HTTP 200 OK`):
   ```json
   {
     "message": "Listado de operativos de recuperación obtenido exitosamente",
     "data": [
       {
         "id": "73100000-0000-4000-8000-000000000004",
         "codigo": "REC-2026-0014",
         "nombre": "Instalación de barreras y sacos fluviales en ribera",
         "estado": "EN_EJECUCION",
         "cantidadInsumosAsignados": 258,
         "totalTiposInsumos": 2
       },
       {
         "id": "73100000-0000-4000-8000-000000000005",
         "codigo": "REC-2026-0015",
         "nombre": "Operativo de apoyo con polietileno y carbón",
         "estado": "CANCELADA",
         "cantidadInsumosAsignados": 0,
         "totalTiposInsumos": 0
       }
     ],
     "meta": {
       "total": 6,
       "page": 2,
       "limit": 2,
       "totalPages": 3,
       "hasNext": true,
       "hasPrev": true
     }
   }
   ```

2. **Control de acceso RBAC (`CP-H73-API-04`, `CP-H73-API-06`, `CP-H73-API-07`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" "http://localhost:3001/api/eventos-atp/recuperacion"
   # {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id."} | HTTP:401

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_CC" "http://localhost:3001/api/eventos-atp/recuperacion"
   # {"message":"No cuenta con el permiso requerido: recuperacion:leer"} | HTTP:403

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_SUP" "http://localhost:3001/api/eventos-atp/recuperacion?limit=1"
   # HTTP:200
   ```

3. **Filtros combinados AND y búsqueda textual (`CP-H73-API-08`, `CP-H73-API-10`, `CP-H73-API-11`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION"
   # HTTP:200 | meta.total: 1 | data[0].codigo: "REC-2026-0011"

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?busqueda=techumbres"
   # HTTP:200 | meta.total: 2 | codigos: ["REC-2026-0011", "REC-2026-0016"]

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?busqueda=INEXISTENTE_XYZ_999"
   # {"message":"Listado de operativos de recuperación obtenido exitosamente","data":[],"meta":{"total":0,"page":1,"limit":20,"totalPages":0,"hasNext":false,"hasPrev":false}} | HTTP:200
   ```

4. **Validación de parámetros y detalle de Drawer (`CP-H73-API-13`, `CP-H73-API-14`, `CP-H73-API-16`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?limit=150"
   # {"message":"Parámetros de consulta de listado inválidos.","errors":[{"campo":"limit","mensaje":"Too big: expected number to be <=100"}]} | HTTP:400

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001"
   # HTTP:200 | data.recursos (2 ítems, cantidadInsumosAsignados: 100) | data.historial (4 ítems: CREACION, HITO_MISION x2, REPORTE_TERRENO)

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion/id-invalido"
   # {"message":"El identificador del operativo de recuperación no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador del operativo debe ser un UUID válido"}]} | HTTP:400

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion/70000000-0000-4000-8000-000000000099"
   # {"message":"Operativo de recuperación con ID '70000000-0000-4000-8000-000000000099' no encontrado."} | HTTP:404
   ```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (HU-73 — Alcance Backend API)

| Criterio de Aceptación (HU-73) | Cobertura / Implementación en `sgrai-api` | Casos de Prueba y Defectos Vinculados | Estado en Backend |
|---|---|---|---|
| **CA-1:** Vista tabular en `/gestion/centro-incidentes` (pestaña Recuperación) bajo estándar de contratos H34 (`page`, `limit`, `total`, `totalPages`). | Contrato de datos `ListarRecuperacionesResponseSchema` y objeto `meta` (`total`, `page`, `limit`, `totalPages`, `hasNext`, `hasPrev`) provisto por `GET /api/eventos-atp/recuperacion`. *(Nota: la interfaz visual de tabla reside en el repositorio `sgrai-web`)*. | `CP-H73-API-01`, `CP-H73-API-02`, `CP-H73-API-03`, `BUG-H73-API-03` | 🟡 Parcial (Aliases `pagina`/`limite` descartados) |
| **CA-2:** Mostrar Código de evento, Título descriptivo, Delegación, Estado (`PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA`), Cantidad de insumos asignados y Fecha de registro. | `OperativoRecuperacionItemSchema` expone `codigo`, `nombre`, `delegacion`, `estado` (enum exacto), `cantidadInsumosAsignados`, `totalTiposInsumos`, `recursosResumen` y `creadoEn`. | `CP-H73-API-01`, `CP-H73-API-09`, `CP-H73-API-18` | 🟢 Cumplido |
| **CA-3:** Permitir filtrar por delegación municipal, estado del operativo y búsqueda textual por código o título. | `ListarRecuperacionesQuerySchema` y `listarRecuperacionesPaginadoRepo` filtran por `delegacionId`, `estado` y `busqueda` (`codigo`, `nombre`, `sector`, `descripcion`), además de `prioridad`, `fechaDesde` y `fechaHasta`. | `CP-H73-API-08`, `CP-H73-API-09`, `CP-H73-API-10`, `CP-H73-API-11`, `BUG-H73-API-02`, `BUG-H73-API-04`, `BUG-H73-API-05` | 🟡 Parcial (Fallas en comodines `ILIKE`, fechas inválidas y orden por prioridad) |
| **CA-4:** Al hacer clic en un registro, abrir drawer lateral con detalle de recursos asignados e historial. | Endpoint dedicado `GET /api/eventos-atp/recuperacion/{id}` retorna `recursos`, `cantidadInsumosAsignados`, `mision`, `patrulla` e `historial` cronológico unificado (`CREACION`, `HITO_MISION`, `REPORTE_TERRENO`, `ESTADO_OPERATIVO`). *(El componente visual de drawer reside en `sgrai-web`)*. | `CP-H73-API-14`, `CP-H73-API-15`, `CP-H73-API-16`, `BUG-H73-API-01` | 🟡 Parcial (Afectado por bypass `X-User-Id` en autenticación) |
| **CA-5:** El endpoint `GET /api/eventos-atp/recuperacion` debe soportar los filtros y responder bajo estándar H34. | Handler `GET` implementado con Kysely, paginación H34, RBAC `recuperacion:leer`, contrato OpenAPI y documentación en `docs/api/eventos-atp.md`. | `CP-H73-API-01` a `CP-H73-API-18`, `BUG-H73-API-01` a `BUG-H73-API-07` | 🔴 Con observaciones bloqueantes de seguridad, validación e integración |

---

## 7. Dictamen Final de QA

**Estado:** 🔴 **RECHAZADO PARA MERGE (`CHANGES REQUESTED`)**

La rama `feature/H73-listar-operativos-recuperacion` requiere la subsanación de los defectos `BUG-H73-API-01` (Crítica — bypass de autenticación por cabecera `X-User-Id` y esquema `BearerAuth` en OpenAPI), `BUG-H73-API-07` (Crítica — merge obligatorio de `origin/develop` resolviendo colisiones con HU-32 y renumerando migración tras `072` de HU-61), `BUG-H73-API-02` (Alta — `HTTP 500` ante fechas inválidas), `BUG-H73-API-03` (Alta — descarte silencioso de `pagina`/`limite`), `BUG-H73-API-04` (Media — escape de comodines SQL), `BUG-H73-API-05` (Media — ordenamiento jerárquico de prioridad ICS) y `BUG-H73-API-06` (Media — atomicidad y prerrequisitos de `seed:h73`) antes de proceder con el ciclo formal de **Re-Test** y aprobación para integración en `develop`.
