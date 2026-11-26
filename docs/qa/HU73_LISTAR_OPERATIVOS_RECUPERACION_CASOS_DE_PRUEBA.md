# Informe de Auditoría Técnica, Re-Test y Matriz de Casos de Prueba (QA): HU-73 — Visualizar Listado Paginado y Filtrable de Operativos de Recuperación Post-Desastre

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Recuperación (`sgrai-api` — `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/{id}`).  
> **Historia de Usuario:** HU-73 — *"Como Encargado Quiero visualizar un listado paginado y filtrable de todos los operativos de recuperación post-desastre registrados en el sistema Para dar seguimiento al avance de los despliegues de entrega de ayuda y rehabilitación comunal desplegados en las delegaciones."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely Query Builder + PostgreSQL 16 + PostGIS + Zod + Vitest v3.2.7).  
> **Rama Git Evaluada:** `feature/H73-listar-operativos-recuperacion`  
> **Commits Evaluados — Auditoría Inicial (Conventional Commits):**  
> * `feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)`
> * `feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)`
> * `test(eventos-atp): agregar pruebas unitarias para listado y drawer de recuperacion (H73)`
> * `docs(api): documentar endpoints GET de recuperacion bajo estandar H34 (H73)`
> * `merge: integrar develop en feature/H73-listar-operativos-recuperacion`
> * `chore(seed): agregar fixture y comando seed:h73 para operativos de recuperacion (H73)`
>
> **Commits Evaluados — Ciclo de Re-Test (Conventional Commits):**  
> * `fix(db): remover evento_atp_id redundante en migracion 043`
> * `merge: integrar develop y resolver observaciones de QA en H73`
> * `fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop`
> * `fix(recuperacion): corregir mapeo de tipos en fallback de detalle para compilacion de produccion`
> * `test(recuperacion): agregar pruebas unitarias de repositorio y aserciones openapi con bearer auth`
>
> **Fecha de Auditoría Inicial:** 24 de Noviembre de 2026.  
> **Fecha de Re-Test:** 25 de Noviembre de 2026.  
> **Estado Global Tras Re-Test:** 🔴 **NO CONFORME — BLOQUEADO POR ERROR DE ANÁLISIS ESTÁTICO (`BUG-H73-API-08`)**.

---

## 1. Resumen Ejecutivo

Durante la primera auditoría técnica ejecutada el 24/11/2026 sobre la rama `feature/H73-listar-operativos-recuperacion`, se ejecutaron 25 casos de prueba y se reportaron **7 defectos reales** (`BUG-H73-API-01` a `BUG-H73-API-07`) vinculados a seguridad perimetral (`X-User-Id`), validación de fechas, soporte de aliases `pagina`/`limite`, sanitización de comodines `ILIKE`, ordenamiento jerárquico ICS por prioridad, integridad del script `seed:h73` y desincronización de contratos respecto a `develop`.

Tras los commits de corrección e integración aplicados por la desarrolladora, el 25/11/2026 se ejecutó el ciclo completo de **Re-Test** evaluando **26 casos totales** (los 7 defectos previos, 18 casos funcionales/regresión/calidad y 1 nuevo defecto introducido en la fase de corrección). Los resultados del Re-Test confirman que **todos los defectos originales (`BUG-H73-API-01` a `BUG-H73-API-07`) fueron subsanados correctamente**, las pruebas unitarias globales alcanzan **95/95 archivos (1025/1025 tests)** sin fallos, la migración limpia en PostgreSQL aplica las **43 migraciones** sin errores, `seed:h73` opera de manera autónoma y transaccional, y todos los endpoints HTTP/OpenAPI responden conforme a contrato y compatibilidad con HU-32.

Sin embargo, el último commit de ajuste de compilación (`fix(recuperacion): corregir mapeo de tipos en fallback de detalle para compilacion de produccion`) introdujo 5 usos explícitos de `as any` en `src/modules/eventos-atp/recuperacion.service.ts` (líneas 709–714) debido a que la consulta `buscarRecuperacionPorId` en `src/modules/eventos-atp/recuperacion.repository.ts` omite las columnas `fecha_cierre` y `observaciones_cierre`. Como consecuencia, el comando obligatorio **`npm run lint` finaliza con código de salida `1` (5 errores `@typescript-eslint/no-explicit-any`)**, generando la regresión **`BUG-H73-API-08`** (Severidad Alta) y fallando el caso de control de calidad estática `CP-H73-API-18`.

| Métrica de Calidad | Auditoría Inicial (24/11) | Re-Test (25/11) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos Evaluados** | **25** | **26** | 7 defectos previos + 18 casos base + 1 nuevo defecto (`BUG-H73-API-08`) |
| **Casos Aprobados / Corregidos** | **18** | **24** | 7 defectos previos corregidos (`BUG-H73-API-01`..`07`) + 17 casos funcionales/BD/E2E aprobados (`CP-H73-API-01`..`17`) |
| **Casos Abiertos / Fallidos** | **7** | **2** | Nuevo defecto `BUG-H73-API-08` (Alta — ESLint `no-explicit-any`) y regresión asociada en `CP-H73-API-18` |
| **Casos Bloqueados (Blocked)** | **0** | **0** | PostgreSQL 16 + PostGIS, Redis y servidor Next.js operativos en entorno de pruebas |
| **Tasa de Aprobación (% Pass)** | **72.0%** | **92.3%** | 24/26 aprobados o corregidos; pendiente limpieza de `as any` y Re-Test puntual de lint |
| **Chequeo de Tipos Estáticos (`npx tsc --noEmit`)** | 🟢 **0 errores** | 🟢 **0 errores** | Verificado sin errores en compilación TypeScript |
| **Análisis Estático de Código (`npm run lint`)** | 🟢 **0 errores** | 🔴 **5 errores (Exit 1)** | 5 errores `@typescript-eslint/no-explicit-any` en `recuperacion.service.ts` líneas 709, 710, 711, 712 y 714 |
| **Compilación Productiva (`npm run build`)** | 🟢 **Exitosa (27/27)** | 🟢 **Exitosa (28/28)** | Compilación de producción completa en Next.js 16.3.4 tras integración de `develop` |
| **Suite Global Automatizada (Vitest v3.2.7)** | 🟢 **860/860 tests** | 🟢 **1025/1025 tests** | 95/95 archivos aprobados (incluye `recuperacion.repository.test.ts` y pruebas OpenAPI BearerAuth) |
| **Migraciones Kysely (`npm run db:migrate`)** | 🟢 **38/38 aplicadas** | 🟢 **43/43 aplicadas** | Ejecución limpia en BD vacía incluyendo `043_recuperacion_listado_rbac_e_indices` y `072_evento_atp_base` |

---

## 2. Registro Técnico de Defectos

### `BUG-H73-API-08`: Regresión de análisis estático ESLint (`5` errores `@typescript-eslint/no-explicit-any`) y omisión de campos de cierre en `buscarRecuperacionPorId`
* **Severidad:** ALTA
* **Estado:** 🔴 ABIERTO (Detectado en Re-Test del 25/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts` (líneas 709–714)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (función `buscarRecuperacionPorId`, líneas 280–313)
* **Descripción del Defecto:** Durante el ajuste posterior a la integración con `develop` (`fix(recuperacion): corregir mapeo de tipos en fallback de detalle para compilacion de produccion`), el bloque de respaldo (*fallback*) de `obtenerDetalleRecuperacionService` convierte repetidamente `eventoExistente` mediante `as any` para leer `fecha_cierre` y `observaciones_cierre`:
  ```typescript
  fechaCierre: (eventoExistente as any).fecha_cierre
    ? ((eventoExistente as any).fecha_cierre instanceof Date
        ? (eventoExistente as any).fecha_cierre.toISOString()
        : String((eventoExistente as any).fecha_cierre))
    : null,
  observacionesCierre: (eventoExistente as any).observaciones_cierre ?? null,
  ```
  Esto produce **5 errores bloqueantes de ESLint** (`@typescript-eslint/no-explicit-any`), haciendo que `npm run lint` retorne código de salida `1`. Adicionalmente, aunque `RecuperacionTable` en `src/lib/db/types.ts` ya tipa `fecha_cierre` y `observaciones_cierre`, la función `buscarRecuperacionPorId` en `recuperacion.repository.ts` no incluye dichas columnas en su cláusula `.select([...])`, por lo que en la ruta de respaldo ambos valores siempre resultarían `null` aun cuando existan en PostgreSQL.
* **Pasos para Reproducir:**
  1. Ejecutar `npm run lint` sobre el directorio raíz de `sgrai-api`.
  2. Inspeccionar la cláusula `.select([...])` de `buscarRecuperacionPorId` en `src/modules/eventos-atp/recuperacion.repository.ts`.
* **Comportamiento Esperado vs. Actual:** `npm run lint` debe finalizar con código de salida `0` (0 errores) y `buscarRecuperacionPorId` debe proyectar y tipar `fecha_cierre` y `observaciones_cierre` sin recurrir a `any`. Actualmente `npm run lint` aborta con código `1` reportando 5 errores en `recuperacion.service.ts`.
* **Sugerencia Técnica:** Agregar `"fecha_cierre"` y `"observaciones_cierre"` en el arreglo `.select([...])` de `buscarRecuperacionPorId` en `src/modules/eventos-atp/recuperacion.repository.ts` y acceder a `eventoExistente.fecha_cierre` y `eventoExistente.observaciones_cierre` directamente en `src/modules/eventos-atp/recuperacion.service.ts` eliminando los cinco casts `as any`.

---

### `BUG-H73-API-01`: Bypass de autenticación JWT mediante cabecera `X-User-Id` sin verificación criptográfica y ausencia de esquema `BearerAuth` en OpenAPI
* **Severidad:** CRÍTICA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/route.ts`
  * `src/app/api/eventos-atp/recuperacion/[id]/route.ts`
  * `src/lib/openapi/index.ts`
  * `docs/api/eventos-atp.md`
* **Verificación en Re-Test:**
  * Ambos Route Handlers `GET` resuelven la identidad exclusivamente mediante `await extraerUsuarioId(req)`, descartando `X-User-Id` sin JWT.
  * Pruebas en vivo enviando `X-User-Id: 00000000-0000-4000-8000-000000000001` sin cabecera `Authorization` devolvieron `HTTP 401 Unauthorized` (`{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}`) tanto en listado como en detalle.
  * La inspección de `GET /openapi.json` confirmó `security: [{"BearerAuth":[]}]` y ausencia de parámetros manuales `authorization`/`x-user-id` en ambos endpoints `GET`, preservando además la definición completa de los 12 query parameters.

---

### `BUG-H73-API-02`: Excepción no controlada (`HTTP 500 Internal Server Error`) al recibir `fechaDesde` o `fechaHasta` inválidos o con espacios en blanco
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.schema.ts`
  * `src/modules/eventos-atp/recuperacion.repository.ts`
* **Verificación en Re-Test:**
  * `ListarRecuperacionesQuerySchema` aplica `.trim()`, validación ISO 8601 (`FechaFiltroSchema`) y consistencia `fechaDesde <= fechaHasta`.
  * En servidor vivo: `?fechaDesde=fecha-invalida` y `?fechaHasta=no-es-fecha` devolvieron `HTTP 400 Bad Request` (`"Formato de fecha inválido. Se espera una fecha ISO 8601 válida."`); `?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z` devolvió `HTTP 400 Bad Request` (`"fechaDesde debe ser menor o igual a fechaHasta."`); y `?fechaDesde=%20` devolvió `HTTP 200 OK` tratando el espacio en blanco como parámetro vacío.

---

### `BUG-H73-API-03`: Descarte silencioso de los aliases de paginación `pagina` y `limite` documentados en OpenAPI y `docs/api/eventos-atp.md`
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.schema.ts`
  * `src/modules/eventos-atp/recuperacion.service.ts`
  * `src/modules/eventos-atp/recuperacion.repository.ts`
* **Verificación en Re-Test:**
  * `ListarRecuperacionesQuerySchema` omite `.default()` en `page` y `limit` y normaliza en `.transform()` (`data.page ?? data.pagina ?? 1` y `data.limit ?? data.limite ?? 20`).
  * Al consultar `GET /api/eventos-atp/recuperacion?pagina=2&limite=2`, la API respondió `HTTP 200 OK` entregando exactamente 2 registros (`REC-2026-0014`, `REC-2026-0015`) con `meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}`.

---

### `BUG-H73-API-04`: Falta de sanitización de comodines SQL (`%`, `_`, `\`) en el filtro de búsqueda textual `busqueda`
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulo / Archivo Afectado:** `src/modules/eventos-atp/recuperacion.repository.ts`
* **Verificación en Re-Test:**
  * `listarRecuperacionesPaginadoRepo` escapa `\` , `%` y `_` mediante `.replace(/[\\%_]/g, "\\$&")` antes de construir el patrón `ILIKE`.
  * En servidor vivo, `?busqueda=%25` (`%`) y `?busqueda=_` devolvieron ambos `HTTP 200 OK` con `total: 0`, `data: []` y `totalPages: 0`.

---

### `BUG-H73-API-05`: Ordenamiento alfabético incorrecto en `ordenarPor=prioridad` (`MEDIA > CRITICA > BAJA > ALTA`) en lugar de jerarquía de severidad ICS
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulo / Archivo Afectado:** `src/modules/eventos-atp/recuperacion.repository.ts`
* **Verificación en Re-Test:**
  * Implementación de expresión SQL ponderada `CASE` (`CRITICA=4`, `ALTA=3`, `MEDIA=2`, `BAJA=1`).
  * `?ordenarPor=prioridad&orden=desc` retornó en orden exacto: `REC-2026-0013(CRITICA) -> REC-2026-0011(ALTA) -> REC-2026-0014(ALTA) -> REC-2026-0012(MEDIA) -> REC-2026-0016(MEDIA) -> REC-2026-0015(BAJA)`.
  * `?ordenarPor=prioridad&orden=asc` retornó la secuencia inversa exacta `BAJA -> MEDIA -> ALTA -> CRITICA`.

---

### `BUG-H73-API-06`: Fallo de integridad referencial (`mision_patrulla_id_fkey`) y falta de atomicidad transaccional en `scripts/seed-h73.ts` sobre base de datos limpia
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulo / Archivo Afectado:** `scripts/seed-h73.ts`
* **Verificación en Re-Test:**
  * Sobre base limpia recién migrada (`sgrai_qa_test`) sin ejecutar `seed:patrullas`, `npm run seed:h73` ejecutó `limpiarFixtureH73` y `sembrarFixtureH73` dentro de `db.transaction()`, verificó la ausencia de patrullas aplicando fallback seguro (`patrulla_id: null`) y sembró los 6 operativos sin errores de FK.
  * La re-ejecución idempotente mantuvo 6 registros y `npm run seed:h73 -- --clean` dejó `0` registros del fixture.

---

### `BUG-H73-API-07`: Desincronización con `develop` y colisiones directas de contrato, rutas y migración con HU-32 y HU-61
* **Severidad:** CRÍTICA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test 25/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/route.ts` y `[id]/route.ts`
  * `src/modules/eventos-atp/recuperacion.schema.ts`, `recuperacion.service.ts` y `recuperacion.repository.ts`
  * `src/lib/db/migrations/043_recuperacion_listado_rbac_e_indices.ts` y `src/lib/openapi/index.ts`
* **Verificación en Re-Test:**
  * La rama integró `origin/develop` mediante merge, unificando los contratos de respuesta y permisos RBAC de HU-32 y HU-73 (`POST /api/eventos-atp/recuperacion/{id}/asignar`, `misiones`, `recursosAsignados`, `recursos`, `cantidadInsumosAsignados`, `historial` con enum `CREACION | HITO_MISION | REPORTE_TERRENO | CIERRE`).
  * `043_recuperacion_listado_rbac_e_indices.ts` removió la columna redundante `evento_atp_id` y el índice `idx_recuperacion_evento_atp_id` delegados a `072_evento_atp_base.ts`. `npm run db:migrate` aplicó las 43 migraciones limpiamente en base nueva (`allowUnorderedMigrations: true` habilitado en `src/lib/db/migrator.ts`).

---

### Observaciones Técnicas No Bloqueantes y Estado de Mejoras Previas
* **Subsanación de observaciones de la ronda inicial:** En `obtenerRecuperacionDetallePorIdRepo` ya se incorporó `.orderBy("mision.creado_en", "desc")` para garantizar selección determinista de misión principal, se creó la suite unitaria `src/modules/eventos-atp/__tests__/recuperacion.repository.test.ts` (6/6 tests aprobados) y `src/app/openapi.json/__tests__/route.test.ts` valida ahora explícitamente el esquema `BearerAuth` sobre las rutas de recuperación.
* **Mensaje de error RBAC en `verificarAutorizacionLecturaRecuperacion`:** Al validar secuencialmente cuatro permisos alternativos (`recuperacion:leer`, `misiones:leer`, `recuperacion:crear`, `misiones:asignar`), cuando un perfil no autorizado (`CALL_CENTER`) falla la verificación, el `ForbiddenError` emitido menciona el último permiso evaluado (`No cuenta con el permiso requerido: misiones:asignar`) con código `HTTP 403`. El bloqueo de seguridad opera correctamente, aunque mencionar `recuperacion:leer` resulta más descriptivo para el consumidor.
* **Numeración de migración `043` y avances recientes en `origin/develop`:** `043_recuperacion_listado_rbac_e_indices.ts` conservó el prefijo `043` (con `allowUnorderedMigrations: true` activo en `migrator.ts`, sin error de ejecución), y `origin/develop` incorporó 4 commits posteriores al merge que no presentan conflictos con los archivos de HU-73 (`git rev-list --left-right --count origin/develop...HEAD` = `4  12`).

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H73-API-08` | Regresión ESLint (5 errores `@typescript-eslint/no-explicit-any`) en fallback de detalle y omisión de campos de cierre en `buscarRecuperacionPorId` | Calidad Estática / Tipos | Servicio & Repositorio | Alta | Código actualizado en `feature/H73-listar-operativos-recuperacion` tras ajuste de compilación | `npm run lint` sobre `src/modules/eventos-atp/recuperacion.service.ts` (líneas 709–714) y `recuperacion.repository.ts` | Exit code 0 sin usos de `any` explícito y columnas `fecha_cierre`/`observaciones_cierre` proyectadas en repositorio | Exit code 1 con 5 errores `@typescript-eslint/no-explicit-any` en líneas 709, 710, 711, 712 y 714 de `recuperacion.service.ts` | **ABIERTO** | 25/11/2026 22:48 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-01` | Bypass de autenticación JWT mediante cabecera X-User-Id sin firma y ausencia de security BearerAuth en OpenAPI | Seguridad / Auth | Route Handler / OpenAPI | Crítica | Servidor API activo y fixture H73 sembrado en PostgreSQL | `GET /api/eventos-atp/recuperacion?limit=1` y `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `X-User-Id: 00000000-0000-4000-8000-000000000001` sin JWT] | HTTP 401 Unauthorized rechazando acceso sin JWT Bearer y registro `security: [{ BearerAuth: [] }]` en `/openapi.json` | HTTP 401 Unauthorized en ambos endpoints sin JWT y `security: [{"BearerAuth":[]}]` + 12 query params verificados en `/openapi.json` | **CORREGIDO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-02` | Excepción SQL no controlada (HTTP 500) ante parámetros fechaDesde o fechaHasta inválidos o en blanco | Robustez / Validación | Schema / Repository | Alta | Usuario autenticado con permiso `recuperacion:leer` | `GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida`, `?fechaHasta=no-es-fecha`, `?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z`, `?fechaDesde=%20` [Header: `Bearer <TOKEN_ENC>`] | HTTP 400 Bad Request para formatos/rangos inválidos y HTTP 200 OK ignorando parámetro en blanco tras `.trim()` | HTTP 400 Bad Request para fechas y rango invertido; HTTP 200 OK (`total: 6`) para espacio en blanco | **CORREGIDO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-03` | Descarte silencioso de aliases de paginación pagina y limite documentados en OpenAPI | Paginación / Contrato | Schema / Service / Repo | Alta | 6 operativos registrados en BD y usuario Encargado autenticado | `GET /api/eventos-atp/recuperacion?pagina=2&limite=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK retornando 2 registros de la página 2 y `meta: { total: 6, page: 2, limit: 2, totalPages: 3 }` | HTTP 200 OK retornando `REC-2026-0014` y `REC-2026-0015` con `meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}` | **CORREGIDO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-04` | Falta de sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda | Seguridad / SQL | Repository / Kysely | Media | 6 operativos en BD sin los caracteres literales `%` ni `_` en código, título, sector o descripción | `GET /api/eventos-atp/recuperacion?busqueda=%25` y `?busqueda=_` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `data: []` y `meta.total: 0` tras escapar comodines `ILIKE` | HTTP 200 OK con `total: 0`, `data: []` y `totalPages: 0` en ambos caracteres especiales | **CORREGIDO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-05` | Ordenamiento alfabético erróneo en ordenarPor=prioridad en lugar de jerarquía de severidad ICS | Lógica de Negocio / ICS | Repository / Kysely | Media | Operativos con prioridades `CRITICA`, `ALTA`, `MEDIA` y `BAJA` | `GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc` y `orden=asc` [Header: `Authorization: Bearer <TOKEN_ENC>`] | Orden descendente por severidad ICS: `CRITICA -> ALTA -> MEDIA -> BAJA` (y viceversa en `asc`) | Secuencia exacta `CRITICA -> ALTA -> ALTA -> MEDIA -> MEDIA -> BAJA` en `desc` y orden inverso en `asc` | **CORREGIDO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-06` | Fallo de clave foránea mision_patrulla_id_fkey y ausencia de transacción en seed:h73 sobre BD limpia | Integridad / Seed DB | Script Seed / PostgreSQL | Media | Base de datos PostgreSQL recién migrada con `npm run db:migrate` sin siembra previa de patrullas | `DATABASE_URL=.../sgrai_qa_test npm run seed:h73` y `npm run seed:h73 -- --clean` | Ejecución autónoma, transaccional e idempotente creando los 6 operativos sin errores de FK | Ejecución exitosa sin `seed:patrullas` dentro de transacción, re-ejecución idempotente (`6` filas) y `--clean` (`0` filas) | **CORREGIDO** | 24/11/2026 01:58 | 25/11/2026 22:48 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-07` | Desincronización con develop y colisiones de contratos, rutas y migración 043 vs HU-32 y HU-61 | Integración / Git & DB | Rama / Contratos / Migración | Crítica | Rama `feature/H73-listar-operativos-recuperacion` frente a `origin/develop` | `git rev-list --left-right --count origin/develop...HEAD`, `/openapi.json` (HU-32 + HU-73) y `043_recuperacion_listado_rbac_e_indices.ts` | Rama integrada con `develop`, contratos unificados con HU-32 y migración sin colisión de columna/índice `evento_atp_id` | Merge completado, ruta `POST .../asignar` y campos HU-32/HU-73 intactos en OpenAPI, `evento_atp_id` removido de `043` y 43/43 migraciones aplicadas | **CORREGIDO** | 24/11/2026 02:07 | 25/11/2026 22:48 | merge: integrar develop y resolver observaciones de QA en H73 |
| `CP-H73-API-01` | Listado paginado base sin filtros con valores por defecto (page=1, limit=20) y campos de tabla (CA-1, CA-2, CA-5) | Funcional / API REST | Integración E2E | Crítica | Usuario Encargado autenticado y 6 operativos del fixture sembrados | `GET /api/eventos-atp/recuperacion` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con código, nombre, delegación, estado, `cantidadInsumosAsignados`, `creadoEn` y `meta` H34 | HTTP 200 OK con los 6 operativos ordenados por `creadoEn` descendente y estructura H34 + campo `fechaCierre` | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-02` | Paginación estándar H34 mediante page=2 y limit=2 con metadatos completos (CA-1, CA-5) | Funcional / Paginación | Integración E2E | Crítica | 6 operativos en BD y token JWT de Encargado | `GET /api/eventos-atp/recuperacion?page=2&limit=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con 2 ítems y `meta: { total: 6, page: 2, limit: 2, totalPages: 3, hasNext: true, hasPrev: true }` | HTTP 200 OK retornando `REC-2026-0014` y `REC-2026-0015` con `meta` exacto | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-03` | Consulta de página fuera de rango (page=99&limit=2) sin error SQL IN () | Robustez / Borde | Repository / E2E | Alta | 6 operativos en BD y token JWT de Encargado | `GET /api/eventos-atp/recuperacion?page=99&limit=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `data: []` y `meta: { total: 6, page: 99, limit: 2, totalPages: 3, hasNext: false, hasPrev: true }` | HTTP 200 OK con `data: []` sin ejecutar consulta `IN ()` vacía | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-04` | Rechazo de peticiones sin credenciales o con token JWT inválido o manipulado | Seguridad / Auth | Route Handler / Guard | Crítica | Servidor API activo sin token o con JWT adulterado | `GET /api/eventos-atp/recuperacion` (sin headers) y con `Authorization: Bearer invalid.jwt.token` | HTTP 401 Unauthorized en ambos escenarios | HTTP 401 (`Se requiere cabecera de autenticación Authorization: Bearer <token>.` y `Token de sesión inválido o expirado.`) | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-05` | Acceso autorizado al listado para perfiles Administrador y Encargado con permiso recuperacion:leer | Seguridad / RBAC | Integración E2E | Crítica | Usuarios `admin@valdivia.cl` y `encargado@valdivia.cl` autenticados vía `/api/seguridad/login` | `GET /api/eventos-atp/recuperacion?limit=1` con `Bearer <TOKEN_ADM>` y `Bearer <TOKEN_ENC>` | HTTP 200 OK para ambos roles autorizados | HTTP 200 OK validando permiso `recuperacion:leer` para ambos perfiles | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-06` | Acceso autorizado al listado y detalle para perfil Supervisor Estratégico tras migración 043 | Seguridad / RBAC | Integración E2E | Alta | Usuario `supervisor@valdivia.cl` (`SUPERVISOR`) autenticado con JWT Bearer | `GET /api/eventos-atp/recuperacion?limit=1` y `GET .../73100000-...0001` [Header: `Bearer <TOKEN_SUP>`] | HTTP 200 OK permitiendo monitoreo gerencial de operativos de recuperación | HTTP 200 OK en listado y detalle bajo estándar H34 | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:50 | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-07` | Bloqueo RBAC (HTTP 403 Forbidden) para usuario autenticado sin permisos de lectura | Seguridad / RBAC | Integración E2E | Crítica | Usuario `callcenter@valdivia.cl` (`CALL_CENTER`) autenticado con JWT Bearer | `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `Bearer <TOKEN_CC>`] | HTTP 403 Forbidden bloqueando acceso a listado y detalle | HTTP 403 Forbidden (`No cuenta con el permiso requerido: misiones:asignar`) en ambos endpoints | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-08` | Filtrado territorial por delegacionId UUID válido (CA-3, CA-5) | Funcional / Filtro | Integración E2E | Crítica | Operativos distribuidos en las 4 delegaciones de Valdivia | `GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK retornando solo operativos de Delegación Municipal Costa (`REC-2026-0011` y `REC-2026-0015`) | HTTP 200 OK con `meta.total: 2` (`REC-2026-0011`, `REC-2026-0015`) | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-09` | Filtrado por estado operativo (EN_EJECUCION) y por prioridad (CRITICA) (CA-2, CA-3, CA-5) | Funcional / Filtro | Integración E2E | Crítica | Operativos en los 4 estados del ciclo de vida y 4 niveles de prioridad | `GET /api/eventos-atp/recuperacion?estado=EN_EJECUCION` y `?prioridad=CRITICA` | HTTP 200 OK filtrando exactamente por el estado y prioridad solicitados | HTTP 200 OK retornando `REC-2026-0011`/`REC-2026-0014` (`total: 2`) para `EN_EJECUCION` y `REC-2026-0013` (`total: 1`) para `CRITICA` | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-10` | Filtrado combinado conjuntivo AND entre delegacionId y estado (CA-3, CA-5) | Integración / Filtro | Integración E2E | Alta | Operativos en Costa en estados `EN_EJECUCION` y `CANCELADA` | `GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION` | HTTP 200 OK retornando exclusivamente la intersección (`REC-2026-0011`) | HTTP 200 OK con `meta.total: 1` (`REC-2026-0011`) | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-11` | Búsqueda textual parcial insensible a mayúsculas por código o título y estado vacío (CA-3, CA-5) | Funcional / Búsqueda | Integración E2E | Crítica | Operativos registrados con códigos `REC-2026-0011..0016` | `?busqueda=REC-2026-0013`, `?busqueda=techumbres` y `?busqueda=INEXISTENTE_XYZ_999` | Coincidencias exactas para código (1) y título (2), y `data: []` con `total: 0` para término inexistente | HTTP 200 OK retornando `REC-2026-0013` (`total: 1`), `REC-2026-0011`/`0016` (`total: 2`) y `data: []` (`total: 0`) | **APROBADO** | 24/11/2026 02:00 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-12` | Filtrado temporal válido ISO 8601 (fechaDesde/fechaHasta) y ordenamiento por codigo y familiasAfectadas (CA-5) | Funcional / Filtro & Orden | Integración E2E | Alta | Operativos con timestamps escalonados en BD | `?fechaDesde=2026-11-25T20:00:00Z&fechaHasta=2026-11-26T01:00:00Z`, `?ordenarPor=codigo&orden=asc` y `?ordenarPor=familiasAfectadas&orden=desc` | Rango temporal acotado a 3 registros recientes y ordenamiento correcto por código ascendente y familias descendente | HTTP 200 OK con `total: 3` (`0013`, `0011`, `0014`) y secuencias exactas (`REC-2026-0011..0016` y `42,35,18,12,8,5`) | **APROBADO** | 24/11/2026 02:01 | 25/11/2026 22:50 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-13` | Validación Zod ante parámetros de consulta inválidos (delegacionId, estado, limit > 100, page < 1) (CA-5) | Validación / Schema | Integración E2E & Vitest | Alta | Esquema `ListarRecuperacionesQuerySchema` activo | `?delegacionId=no-uuid`, `?estado=OTRO`, `?limit=150` y unit test Zod | HTTP 400 Bad Request con arreglo `errors` detallando campo y mensaje | HTTP 400 Bad Request en los 3 casos (`Parámetros de consulta inválidos para el listado de operativos de recuperación.`) | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-14` | Consulta de detalle consolidado GET /api/eventos-atp/recuperacion/{id} para drawer lateral con recursos, misiones e historial (CA-4) | Funcional / Drawer | Integración E2E | Crítica | Operativo `REC-2026-0011` (`73100000-...0001`) con misión, 2 insumos, 2 hitos y 1 reporte | `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `recursos`, `recursosAsignados`, `cantidadInsumosAsignados: 100`, `mision`, `misiones` e `historial` | HTTP 200 OK entregando `MIS-2026-0073-1`, 2 recursos (`100` uds), e historial de 4 hitos (`CREACION`, `HITO_MISION` x2, `REPORTE_TERRENO`) | **APROBADO** | 24/11/2026 01:59 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-15` | Consulta de detalle para operativo COMPLETADA (con cierre) y operativos sin misión o sin patrulla asignada (CA-4) | Borde / Drawer | Integración E2E | Alta | Operativos `REC-2026-0012` (`COMPLETADA`), `REC-2026-0013` (sin misión) y `REC-2026-0014` (sin patrulla) | `GET /api/eventos-atp/recuperacion/{id}` para IDs `...0002`, `...0003` y `...0004` | HTTP 200 OK incluyendo `CIERRE` y `observacionesCierre` en `...0002`, `mision: null`/`misiones: []` en `...0003` y `patrulla: null` en `...0004` | HTTP 200 OK sin excepciones de join; `...0002` incluye `CIERRE`, `fechaCierre` y `observacionesCierre` | **APROBADO** | 24/11/2026 02:01 | 25/11/2026 22:49 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-16` | Rechazo de UUID inválido (400), inexistente (404) y exclusión por baja lógica (eliminado_en IS NOT NULL) (CA-4, CA-5) | Validación / Integridad | Integración E2E | Alta | Operativo `REC-2026-0016` marcado temporalmente con `eliminado_en = NOW()` en BD | `GET .../id-invalido`, `GET .../70000000-0000-4000-8000-000000000099`, `GET .../73100000-...0006` (baja lógica) | HTTP 400 Bad Request, HTTP 404 Not Found y exclusión de registro eliminado en detalle (`404`) y listado (`total: 5`) | HTTP 400, HTTP 404 y exclusión verificada en listado (`total: 5`) y detalle (`404`) | **APROBADO** | 24/11/2026 02:00 | 25/11/2026 22:49 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-17` | Ejecución limpia de migraciones tras integración con develop (043_recuperacion_listado_rbac_e_indices.ts + 072_evento_atp_base.ts) | Migración / DB | Migrator Kysely | Crítica | Base de datos limpia `sgrai_qa_test` en PostgreSQL 16 + PostGIS | `DATABASE_URL=.../sgrai_qa_test npm run db:migrate` | 43/43 migraciones aplicadas sin colisión agregando columnas, índices y permiso `recuperacion:leer` sin duplicar `evento_atp_id` | 43/43 migraciones ejecutadas con éxito (`[OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"` y `"072_evento_atp_base"`) | **APROBADO** | 24/11/2026 01:58 | 25/11/2026 22:48 | fix(db): remover evento_atp_id redundante en migracion 043 |
| `CP-H73-API-18` | Verificación de build productivo, tipado TypeScript, análisis estático ESLint, documentación API y suite global Vitest | Calidad / CI | Estático & Unitario | Crítica | Rama `feature/H73-listar-operativos-recuperacion` actualizada tras merge e inclusiones de tests | `npm run build && npx tsc --noEmit && npm run lint && npm test` | Build, `tsc` y `lint` con 0 errores, docs actualizados y 100% de tests unitarios aprobados | Build 28/28 OK, `tsc` 0 errores, 95/95 archivos (1025/1025 tests) OK, pero `npm run lint` FALLA con 5 errores `@typescript-eslint/no-explicit-any` en `recuperacion.service.ts` | **FALLIDO** | 24/11/2026 01:57 | 25/11/2026 22:48 | Pendiente (Rechazado en Code Review) |

---

## 4. Bloque TSV

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H73-API-08	Regresión ESLint (5 errores @typescript-eslint/no-explicit-any) en fallback de detalle y omisión de campos de cierre en buscarRecuperacionPorId	Calidad Estática / Tipos	Servicio & Repositorio	Alta	Código actualizado en feature/H73-listar-operativos-recuperacion tras ajuste de compilación	npm run lint sobre src/modules/eventos-atp/recuperacion.service.ts (líneas 709–714) y recuperacion.repository.ts	Exit code 0 sin usos de any explícito y columnas fecha_cierre/observaciones_cierre proyectadas en repositorio	Exit code 1 con 5 errores @typescript-eslint/no-explicit-any en líneas 709, 710, 711, 712 y 714 de recuperacion.service.ts	ABIERTO	25/11/2026 22:48	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-01	Bypass de autenticación JWT mediante cabecera X-User-Id sin firma y ausencia de security BearerAuth en OpenAPI	Seguridad / Auth	Route Handler / OpenAPI	Crítica	Servidor API activo y fixture H73 sembrado en PostgreSQL	GET /api/eventos-atp/recuperacion?limit=1 y GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: X-User-Id: 00000000-0000-4000-8000-000000000001 sin JWT]	HTTP 401 Unauthorized rechazando acceso sin JWT Bearer y registro security: [{ BearerAuth: [] }] en /openapi.json	HTTP 401 Unauthorized en ambos endpoints sin JWT y security: [{"BearerAuth":[]}] + 12 query params verificados en /openapi.json	CORREGIDO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-02	Excepción SQL no controlada (HTTP 500) ante parámetros fechaDesde o fechaHasta inválidos o en blanco	Robustez / Validación	Schema / Repository	Alta	Usuario autenticado con permiso recuperacion:leer	GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida, ?fechaHasta=no-es-fecha, ?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z, ?fechaDesde=%20 [Header: Bearer <TOKEN_ENC>]	HTTP 400 Bad Request para formatos/rangos inválidos y HTTP 200 OK ignorando parámetro en blanco tras .trim()	HTTP 400 Bad Request para fechas y rango invertido; HTTP 200 OK (total: 6) para espacio en blanco	CORREGIDO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-03	Descarte silencioso de aliases de paginación pagina y limite documentados en OpenAPI	Paginación / Contrato	Schema / Service / Repo	Alta	6 operativos registrados en BD y usuario Encargado autenticado	GET /api/eventos-atp/recuperacion?pagina=2&limite=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK retornando 2 registros de la página 2 y meta: { total: 6, page: 2, limit: 2, totalPages: 3 }	HTTP 200 OK retornando REC-2026-0014 y REC-2026-0015 con meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}	CORREGIDO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-04	Falta de sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda	Seguridad / SQL	Repository / Kysely	Media	6 operativos en BD sin los caracteres literales % ni _ en código, título, sector o descripción	GET /api/eventos-atp/recuperacion?busqueda=%25 y ?busqueda=_ [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con data: [] y meta.total: 0 tras escapar comodines ILIKE	HTTP 200 OK con total: 0, data: [] y totalPages: 0 en ambos caracteres especiales	CORREGIDO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-05	Ordenamiento alfabético erróneo en ordenarPor=prioridad en lugar de jerarquía de severidad ICS	Lógica de Negocio / ICS	Repository / Kysely	Media	Operativos con prioridades CRITICA, ALTA, MEDIA y BAJA	GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc y orden=asc [Header: Authorization: Bearer <TOKEN_ENC>]	Orden descendente por severidad ICS: CRITICA -> ALTA -> MEDIA -> BAJA (y viceversa en asc)	Secuencia exacta CRITICA -> ALTA -> ALTA -> MEDIA -> MEDIA -> BAJA en desc y orden inverso en asc	CORREGIDO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-06	Fallo de clave foránea mision_patrulla_id_fkey y ausencia de transacción en seed:h73 sobre BD limpia	Integridad / Seed DB	Script Seed / PostgreSQL	Media	Base de datos PostgreSQL recién migrada con npm run db:migrate sin siembra previa de patrullas	DATABASE_URL=.../sgrai_qa_test npm run seed:h73 y npm run seed:h73 -- --clean	Ejecución autónoma, transaccional e idempotente creando los 6 operativos sin errores de FK	Ejecución exitosa sin seed:patrullas dentro de transacción, re-ejecución idempotente (6 filas) y --clean (0 filas)	CORREGIDO	24/11/2026 01:58	25/11/2026 22:48	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-07	Desincronización con develop y colisiones de contratos, rutas y migración 043 vs HU-32 y HU-61	Integración / Git & DB	Rama / Contratos / Migración	Crítica	Rama feature/H73-listar-operativos-recuperacion frente a origin/develop	git rev-list --left-right --count origin/develop...HEAD, /openapi.json (HU-32 + HU-73) y 043_recuperacion_listado_rbac_e_indices.ts	Rama integrada con develop, contratos unificados con HU-32 y migración sin colisión de columna/índice evento_atp_id	Merge completado, ruta POST .../asignar y campos HU-32/HU-73 intactos en OpenAPI, evento_atp_id removido de 043 y 43/43 migraciones aplicadas	CORREGIDO	24/11/2026 02:07	25/11/2026 22:48	merge: integrar develop y resolver observaciones de QA en H73
CP-H73-API-01	Listado paginado base sin filtros con valores por defecto (page=1, limit=20) y campos de tabla (CA-1, CA-2, CA-5)	Funcional / API REST	Integración E2E	Crítica	Usuario Encargado autenticado y 6 operativos del fixture sembrados	GET /api/eventos-atp/recuperacion [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con código, nombre, delegación, estado, cantidadInsumosAsignados, creadoEn y meta H34	HTTP 200 OK con los 6 operativos ordenados por creadoEn descendente y estructura H34 + campo fechaCierre	APROBADO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-02	Paginación estándar H34 mediante page=2 y limit=2 con metadatos completos (CA-1, CA-5)	Funcional / Paginación	Integración E2E	Crítica	6 operativos en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion?page=2&limit=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con 2 ítems y meta: { total: 6, page: 2, limit: 2, totalPages: 3, hasNext: true, hasPrev: true }	HTTP 200 OK retornando REC-2026-0014 y REC-2026-0015 con meta exacto	APROBADO	24/11/2026 01:59	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-03	Consulta de página fuera de rango (page=99&limit=2) sin error SQL IN ()	Robustez / Borde	Repository / E2E	Alta	6 operativos en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion?page=99&limit=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con data: [] y meta: { total: 6, page: 99, limit: 2, totalPages: 3, hasNext: false, hasPrev: true }	HTTP 200 OK con data: [] sin ejecutar consulta IN () vacía	APROBADO	24/11/2026 01:59	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-04	Rechazo de peticiones sin credenciales o con token JWT inválido o manipulado	Seguridad / Auth	Route Handler / Guard	Crítica	Servidor API activo sin token o con JWT adulterado	GET /api/eventos-atp/recuperacion (sin headers) y con Authorization: Bearer invalid.jwt.token	HTTP 401 Unauthorized en ambos escenarios	HTTP 401 (Se requiere cabecera de autenticación Authorization: Bearer <token>. y Token de sesión inválido o expirado.)	APROBADO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-05	Acceso autorizado al listado para perfiles Administrador y Encargado con permiso recuperacion:leer	Seguridad / RBAC	Integración E2E	Crítica	Usuarios admin@valdivia.cl y encargado@valdivia.cl autenticados vía /api/seguridad/login	GET /api/eventos-atp/recuperacion?limit=1 con Bearer <TOKEN_ADM> y Bearer <TOKEN_ENC>	HTTP 200 OK para ambos roles autorizados	HTTP 200 OK validando permiso recuperacion:leer para ambos perfiles	APROBADO	24/11/2026 01:59	25/11/2026 22:49	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-06	Acceso autorizado al listado y detalle para perfil Supervisor Estratégico tras migración 043	Seguridad / RBAC	Integración E2E	Alta	Usuario supervisor@valdivia.cl (SUPERVISOR) autenticado con JWT Bearer	GET /api/eventos-atp/recuperacion?limit=1 y GET .../73100000-...0001 [Header: Bearer <TOKEN_SUP>]	HTTP 200 OK permitiendo monitoreo gerencial de operativos de recuperación	HTTP 200 OK en listado y detalle bajo estándar H34	APROBADO	24/11/2026 01:59	25/11/2026 22:50	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-07	Bloqueo RBAC (HTTP 403 Forbidden) para usuario autenticado sin permisos de lectura	Seguridad / RBAC	Integración E2E	Crítica	Usuario callcenter@valdivia.cl (CALL_CENTER) autenticado con JWT Bearer	GET /api/eventos-atp/recuperacion y GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: Bearer <TOKEN_CC>]	HTTP 403 Forbidden bloqueando acceso a listado y detalle	HTTP 403 Forbidden (No cuenta con el permiso requerido: misiones:asignar) en ambos endpoints	APROBADO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-08	Filtrado territorial por delegacionId UUID válido (CA-3, CA-5)	Funcional / Filtro	Integración E2E	Crítica	Operativos distribuidos en las 4 delegaciones de Valdivia	GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK retornando solo operativos de Delegación Municipal Costa (REC-2026-0011 y REC-2026-0015)	HTTP 200 OK con meta.total: 2 (REC-2026-0011, REC-2026-0015)	APROBADO	24/11/2026 01:59	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-09	Filtrado por estado operativo (EN_EJECUCION) y por prioridad (CRITICA) (CA-2, CA-3, CA-5)	Funcional / Filtro	Integración E2E	Crítica	Operativos en los 4 estados del ciclo de vida y 4 niveles de prioridad	GET /api/eventos-atp/recuperacion?estado=EN_EJECUCION y ?prioridad=CRITICA	HTTP 200 OK filtrando exactamente por el estado y prioridad solicitados	HTTP 200 OK retornando REC-2026-0011/REC-2026-0014 (total: 2) para EN_EJECUCION y REC-2026-0013 (total: 1) para CRITICA	APROBADO	24/11/2026 01:59	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-10	Filtrado combinado conjuntivo AND entre delegacionId y estado (CA-3, CA-5)	Integración / Filtro	Integración E2E	Alta	Operativos en Costa en estados EN_EJECUCION y CANCELADA	GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION	HTTP 200 OK retornando exclusivamente la intersección (REC-2026-0011)	HTTP 200 OK con meta.total: 1 (REC-2026-0011)	APROBADO	24/11/2026 01:59	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-11	Búsqueda textual parcial insensible a mayúsculas por código o título y estado vacío (CA-3, CA-5)	Funcional / Búsqueda	Integración E2E	Crítica	Operativos registrados con códigos REC-2026-0011..0016	?busqueda=REC-2026-0013, ?busqueda=techumbres y ?busqueda=INEXISTENTE_XYZ_999	Coincidencias exactas para código (1) y título (2), y data: [] con total: 0 para término inexistente	HTTP 200 OK retornando REC-2026-0013 (total: 1), REC-2026-0011/0016 (total: 2) y data: [] (total: 0)	APROBADO	24/11/2026 02:00	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-12	Filtrado temporal válido ISO 8601 (fechaDesde/fechaHasta) y ordenamiento por codigo y familiasAfectadas (CA-5)	Funcional / Filtro & Orden	Integración E2E	Alta	Operativos con timestamps escalonados en BD	?fechaDesde=2026-11-25T20:00:00Z&fechaHasta=2026-11-26T01:00:00Z, ?ordenarPor=codigo&orden=asc y ?ordenarPor=familiasAfectadas&orden=desc	Rango temporal acotado a 3 registros recientes y ordenamiento correcto por código ascendente y familias descendente	HTTP 200 OK con total: 3 (0013, 0011, 0014) y secuencias exactas (REC-2026-0011..0016 y 42,35,18,12,8,5)	APROBADO	24/11/2026 02:01	25/11/2026 22:50	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-13	Validación Zod ante parámetros de consulta inválidos (delegacionId, estado, limit > 100, page < 1) (CA-5)	Validación / Schema	Integración E2E & Vitest	Alta	Esquema ListarRecuperacionesQuerySchema activo	?delegacionId=no-uuid, ?estado=OTRO, ?limit=150 y unit test Zod	HTTP 400 Bad Request con arreglo errors detallando campo y mensaje	HTTP 400 Bad Request en los 3 casos (Parámetros de consulta inválidos para el listado de operativos de recuperación.)	APROBADO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-14	Consulta de detalle consolidado GET /api/eventos-atp/recuperacion/{id} para drawer lateral con recursos, misiones e historial (CA-4)	Funcional / Drawer	Integración E2E	Crítica	Operativo REC-2026-0011 (73100000-...0001) con misión, 2 insumos, 2 hitos y 1 reporte	GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con recursos, recursosAsignados, cantidadInsumosAsignados: 100, mision, misiones e historial	HTTP 200 OK entregando MIS-2026-0073-1, 2 recursos (100 uds), e historial de 4 hitos (CREACION, HITO_MISION x2, REPORTE_TERRENO)	APROBADO	24/11/2026 01:59	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-15	Consulta de detalle para operativo COMPLETADA (con cierre) y operativos sin misión o sin patrulla asignada (CA-4)	Borde / Drawer	Integración E2E	Alta	Operativos REC-2026-0012 (COMPLETADA), REC-2026-0013 (sin misión) y REC-2026-0014 (sin patrulla)	GET /api/eventos-atp/recuperacion/{id} para IDs ...0002, ...0003 y ...0004	HTTP 200 OK incluyendo CIERRE y observacionesCierre en ...0002, mision: null/misiones: [] en ...0003 y patrulla: null en ...0004	HTTP 200 OK sin excepciones de join; ...0002 incluye CIERRE, fechaCierre y observacionesCierre	APROBADO	24/11/2026 02:01	25/11/2026 22:49	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-16	Rechazo de UUID inválido (400), inexistente (404) y exclusión por baja lógica (eliminado_en IS NOT NULL) (CA-4, CA-5)	Validación / Integridad	Integración E2E	Alta	Operativo REC-2026-0016 marcado temporalmente con eliminado_en = NOW() en BD	GET .../id-invalido, GET .../70000000-0000-4000-8000-000000000099, GET .../73100000-...0006 (baja lógica)	HTTP 400 Bad Request, HTTP 404 Not Found y exclusión de registro eliminado en detalle (404) y listado (total: 5)	HTTP 400, HTTP 404 y exclusión verificada en listado (total: 5) y detalle (404)	APROBADO	24/11/2026 02:00	25/11/2026 22:49	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-17	Ejecución limpia de migraciones tras integración con develop (043_recuperacion_listado_rbac_e_indices.ts + 072_evento_atp_base.ts)	Migración / DB	Migrator Kysely	Crítica	Base de datos limpia sgrai_qa_test en PostgreSQL 16 + PostGIS	DATABASE_URL=.../sgrai_qa_test npm run db:migrate	43/43 migraciones aplicadas sin colisión agregando columnas, índices y permiso recuperacion:leer sin duplicar evento_atp_id	43/43 migraciones ejecutadas con éxito ([OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices" y "072_evento_atp_base")	APROBADO	24/11/2026 01:58	25/11/2026 22:48	fix(db): remover evento_atp_id redundante en migracion 043
CP-H73-API-18	Verificación de build productivo, tipado TypeScript, análisis estático ESLint, documentación API y suite global Vitest	Calidad / CI	Estático & Unitario	Crítica	Rama feature/H73-listar-operativos-recuperacion actualizada tras merge e inclusiones de tests	npm run build && npx tsc --noEmit && npm run lint && npm test	Build, tsc y lint con 0 errores, docs actualizados y 100% de tests unitarios aprobados	Build 28/28 OK, tsc 0 errores, 95/95 archivos (1025/1025 tests) OK, pero npm run lint FALLA con 5 errores @typescript-eslint/no-explicit-any en recuperacion.service.ts	FALLIDO	24/11/2026 01:57	25/11/2026 22:48	Pendiente (Rechazado en Code Review)
````

---

## 5. Guía de Ejecución Paso a Paso (Re-Test)

### 5.1. Verificación de Calidad Estática, Build y Pruebas Unitarias (Vitest)

1. **Compilación productiva, verificación TypeScript y análisis estático:**
   ```bash
   npm run build && npx tsc --noEmit && npm run lint
   ```
   Salida observada (código de salida `1` en ESLint):
   ```text
   ✓ Compiled successfully in 4.9s
   Finished TypeScript in 7.3s
   ✓ Generating static pages using 15 workers (28/28) in 225ms
   (npx tsc --noEmit -> exit code 0)

   /home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/modules/eventos-atp/recuperacion.service.ts
     709:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
     710:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
     711:33  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
     712:40  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
     714:46  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

   ✖ 5 problems (5 errors, 0 warnings)
   ```

2. **Pruebas unitarias de servicio, repositorio, Route Handlers y OpenAPI:**
   ```bash
   npm test -- src/modules/eventos-atp/__tests__/recuperacion.service.test.ts -t "Listado Paginado"
   npm test -- src/modules/eventos-atp/__tests__/recuperacion.service.test.ts -t "Drawer"
   npm test -- src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts -t "HU-73"
   npm test -- "src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts" -t "Drawer"
   npx vitest run src/modules/eventos-atp/__tests__/recuperacion.repository.test.ts src/app/openapi.json/__tests__/route.test.ts
   ```
   Salidas observadas:
   ```text
   Test Files  1 passed (1) | Tests  6 passed | 14 skipped (20)   [recuperacion.service.test.ts -t "Listado Paginado"]
   Test Files  1 passed (1) | Tests  2 passed | 18 skipped (20)   [recuperacion.service.test.ts -t "Drawer"]
   Test Files  1 passed (1) | Tests  5 passed | 8 skipped (13)    [recuperacion/__tests__/route.test.ts -t "HU-73"]
   Test Files  1 passed (1) | Tests  5 passed (5)                 [recuperacion/[id]/__tests__/route.test.ts -t "Drawer"]
   Test Files  2 passed (2) | Tests  7 passed (7)                 [recuperacion.repository.test.ts (6) + openapi.json (1)]
   ```

3. **Suite completa del repositorio y módulo Eventos ATP:**
   ```bash
   npm test
   npx vitest run src/modules/eventos-atp/__tests__/ src/app/api/eventos-atp/recuperacion/__tests__/ "src/app/api/eventos-atp/recuperacion/[id]/__tests__/" src/app/openapi.json/__tests__/
   ```
   Salidas observadas:
   ```text
   Test Files  95 passed (95)
        Tests  1025 passed (1025)

   Test Files  13 passed (13)
        Tests  159 passed (159)
   ```

---

### 5.2. Preparación de Base de Datos Limpia, Migración 043 + 072 y Siembra Autónoma `seed:h73`

1. **Creación de BD limpia, ejecución de 43 migraciones Kysely y siembra autónoma sin `seed:patrullas`:**
   ```bash
   docker exec grupo1_postgres psql -U sgrai -d postgres -c "DROP DATABASE IF EXISTS sgrai_qa_test;"
   docker exec grupo1_postgres psql -U sgrai -d postgres -c "CREATE DATABASE sgrai_qa_test;"
   docker exec grupo1_postgres psql -U sgrai -d sgrai_qa_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run db:migrate
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run seed:h73
   ```
   Salidas observadas:
   ```text
   [OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"
   ...
   [OK] Migración Kysely ejecutada con éxito: "072_evento_atp_base"
   Todas las migraciones se completaron correctamente.
   Limpiando fixture H73 (operativos de recuperación de prueba)...
   Limpieza de fixture H73 completada.
   Sembrando fixture H73 en la base de datos dentro de transacción...
   Fixture H73 sembrado exitosamente dentro de transacción.
   ```

2. **Verificación de idempotencia y limpieza (`--clean`):**
   ```bash
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run seed:h73
   DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm run seed:h73 -- --clean
   ```

---

### 5.3. Pruebas HTTP en Vivo (cURL) y Validación de Correcciones en Re-Test

#### Obtención de tokens JWT Bearer y arranque del servidor
```bash
PORT=3001 DATABASE_URL="postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_test" npm start

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

#### Evidencia de Re-Test sobre Defectos Corregidos (`BUG-H73-API-01` a `BUG-H73-API-05` y `OpenAPI`)

1. **`BUG-H73-API-01` (Rechazo de `X-User-Id` sin JWT y contrato OpenAPI):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
     "http://localhost:3001/api/eventos-atp/recuperacion?limit=1"
   curl -s -w "\nHTTP:%{http_code}\n" -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
     "http://localhost:3001/api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001"
   ```
   Respuesta obtenida en ambos endpoints:
   ```text
   {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
   HTTP:401
   ```
   Verificación sobre `GET /openapi.json`:
   ```text
   GET list security: [{"BearerAuth":[]}]
   GET list params: ["page:query","limit:query","pagina:query","limite:query","delegacionId:query","estado:query","prioridad:query","busqueda:query","fechaDesde:query","fechaHasta:query","ordenarPor:query","orden:query"]
   GET det security: [{"BearerAuth":[]}]
   GET det params: ["id:path"]
   POST asignar security: [{"BearerAuth":[]}]
   ```

2. **`BUG-H73-API-02` (Fechas inválidas, rango invertido y espacio en blanco):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?fechaDesde=fecha-invalida"
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z"
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?fechaDesde=%20"
   ```
   Salidas obtenidas:
   ```text
   {"message":"Parámetros de consulta inválidos para el listado de operativos de recuperación.","errors":[{"campo":"fechaDesde","mensaje":"Formato de fecha inválido. Se espera una fecha ISO 8601 válida."}]} | HTTP:400
   {"message":"Parámetros de consulta inválidos para el listado de operativos de recuperación.","errors":[{"campo":"fechaDesde","mensaje":"fechaDesde debe ser menor o igual a fechaHasta."}]} | HTTP:400
   (?fechaDesde=%20 -> HTTP:200 | total: 6)
   ```

3. **`BUG-H73-API-03` (Aliases `pagina` y `limite`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?pagina=2&limite=2"
   ```
   Salida observada:
   ```text
   HTTP:200 | codes: [ 'REC-2026-0014', 'REC-2026-0015' ] | meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}
   ```

4. **`BUG-H73-API-04` (Sanitización de comodines `ILIKE`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?busqueda=%25"
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?busqueda=_"
   ```
   Salida obtenida en ambas consultas:
   ```json
   {"message":"Operativos de recuperación obtenidos exitosamente.","total":0,"data":[],"meta":{"total":0,"page":1,"limit":20,"totalPages":0,"hasNext":false,"hasPrev":false}}
   HTTP:200
   ```

5. **`BUG-H73-API-05` (Ordenamiento por severidad ICS):**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc"
   ```
   Secuencia observada en `data`:
   ```text
   DESC: REC-2026-0013(CRITICA) -> REC-2026-0011(ALTA) -> REC-2026-0014(ALTA) -> REC-2026-0012(MEDIA) -> REC-2026-0016(MEDIA) -> REC-2026-0015(BAJA)
   ASC:  REC-2026-0015(BAJA) -> REC-2026-0012(MEDIA) -> REC-2026-0016(MEDIA) -> REC-2026-0011(ALTA) -> REC-2026-0014(ALTA) -> REC-2026-0013(CRITICA)
   ```

#### Evidencia de Regresión E2E (`CP-H73-API-01` a `CP-H73-API-16`)
```bash
curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_CC" "http://localhost:3001/api/eventos-atp/recuperacion"
# {"message":"No cuenta con el permiso requerido: misiones:asignar"} | HTTP:403

curl -s -H "Authorization: Bearer $TOKEN_ENC" "http://localhost:3001/api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION"
# total: 1 | ['REC-2026-0011']

curl -s -H "Authorization: Bearer $TOKEN_ENC" "http://localhost:3001/api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000002"
# HTTP:200 | estado: COMPLETADA | mision: MIS-2026-0073-2 | historialTipos: ['CREACION','HITO_MISION','HITO_MISION','CIERRE'] | fechaCierre != null
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (HU-73 — Alcance Backend API)

| Criterio de Aceptación (HU-73) | Cobertura / Implementación en `sgrai-api` | Casos de Prueba y Defectos Vinculados | Estado en Backend |
|---|---|---|---|
| **CA-1:** Vista tabular en `/gestion/centro-incidentes` (pestaña Recuperación) bajo estándar de contratos H34 (`page`, `limit`, `total`, `totalPages`). | Contrato de datos `ListarRecuperacionesResponseSchema`, objeto `meta` (`total`, `page`, `limit`, `totalPages`, `hasNext`, `hasPrev`) y soporte efectivo de `page`/`limit` y `pagina`/`limite` en `GET /api/eventos-atp/recuperacion`. *(La vista visual reside en `sgrai-web`)*. | `CP-H73-API-01`, `CP-H73-API-02`, `CP-H73-API-03`, `BUG-H73-API-03` | 🟢 Cumplido |
| **CA-2:** Mostrar Código de evento, Título descriptivo, Delegación, Estado (`PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA`), Cantidad de insumos asignados y Fecha de registro. | `OperativoRecuperacionItemSchema` expone `codigo`, `nombre`, `delegacion`, `estado`, `cantidadInsumosAsignados`, `totalTiposInsumos`, `recursosResumen`, `creadoEn`, `actualizadoEn` y `fechaCierre`. | `CP-H73-API-01`, `CP-H73-API-09` | 🟢 Cumplido |
| **CA-3:** Permitir filtrar por delegación municipal, estado del operativo y búsqueda textual por código o título. | `ListarRecuperacionesQuerySchema` y `listarRecuperacionesPaginadoRepo` filtran por `delegacionId`, `estado`, `prioridad`, `fechaDesde`, `fechaHasta` y `busqueda` sanitizada, con ordenamiento ICS por prioridad. | `CP-H73-API-08` a `CP-H73-API-12`, `BUG-H73-API-02`, `BUG-H73-API-04`, `BUG-H73-API-05` | 🟢 Cumplido |
| **CA-4:** Al hacer clic en un registro, abrir drawer lateral con detalle de recursos asignados e historial. | Endpoint unificado `GET /api/eventos-atp/recuperacion/{id}` retorna `recursos`, `recursosAsignados`, `cantidadInsumosAsignados`, `mision`, `misiones`, `patrulla` e `historial` cronológico (`CREACION`, `HITO_MISION`, `REPORTE_TERRENO`, `CIERRE`) con autenticación JWT estricta. *(El drawer visual reside en `sgrai-web`)*. | `CP-H73-API-14`, `CP-H73-API-15`, `CP-H73-API-16`, `BUG-H73-API-01`, `BUG-H73-API-07` | 🟢 Cumplido |
| **CA-5:** El endpoint `GET /api/eventos-atp/recuperacion` debe soportar los filtros y responder bajo estándar H34. | Cumple en runtime HTTP, Kysely, RBAC, BD y OpenAPI; pendiente únicamente corregir el fallo bloqueante de análisis estático `npm run lint` (`BUG-H73-API-08`). | `CP-H73-API-01` a `CP-H73-API-18`, `BUG-H73-API-01` a `BUG-H73-API-08` | 🔴 Bloqueado por `BUG-H73-API-08` (`npm run lint`) |

---

## 7. Dictamen Final de QA (Re-Test)

**Estado:** 🔴 **RECHAZADO PARA MERGE — NO CONFORME EN RE-TEST (`BUG-H73-API-08` ABIERTO)**

Los 7 defectos levantados en la auditoría inicial (`BUG-H73-API-01` a `BUG-H73-API-07`) quedaron verificados como **`CORREGIDO`** en ejecución real contra PostgreSQL 16 + PostGIS, migraciones, fixture `seed:h73`, especificación OpenAPI 3.0 y compatibilidad con `develop` (HU-32 / HU-61). No obstante, la integración no puede certificarse debido a la regresión **`BUG-H73-API-08`**: `npm run lint` falla con código de salida `1` por **5 errores `@typescript-eslint/no-explicit-any`** en `src/modules/eventos-atp/recuperacion.service.ts` (líneas 709–714), originados al omitir `fecha_cierre` y `observaciones_cierre` en `buscarRecuperacionPorId` (`src/modules/eventos-atp/recuperacion.repository.ts`). Una vez eliminados esos casts y proyectadas ambas columnas en el repositorio, bastará con validar `npm run build && npx tsc --noEmit && npm run lint && npm test` para cerrar el Re-Test final.
