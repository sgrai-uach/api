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
> **Commits Evaluados — Ciclos de Re-Test (Conventional Commits):**  
> * `fix(db): remover evento_atp_id redundante en migracion 043`
> * `merge: integrar develop y resolver observaciones de QA en H73`
> * `fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop`
> * `fix(recuperacion): corregir mapeo de tipos en fallback de detalle para compilacion de produccion`
> * `test(recuperacion): agregar pruebas unitarias de repositorio y aserciones openapi con bearer auth`
> * `docs(qa): actualizar casos de prueba con casos corregidos`
> * `fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre`
>
> **Fecha de Auditoría Inicial:** 24 de Noviembre de 2026.  
> **Fecha de Re-Test (Ronda 1):** 25 de Noviembre de 2026.  
> **Fecha de Re-Test (Ronda 2):** 26 de Noviembre de 2026.  
> **Estado Global Tras Re-Test:** 🔴 **NO CONFORME — BLOQUEADO POR REGRESIÓN EN BORRADO LÓGICO DE DETALLE (`BUG-H73-API-09`)**.

---

## 1. Resumen Ejecutivo

Durante la primera auditoría técnica (24/11/2026) sobre `feature/H73-listar-operativos-recuperacion`, se reportaron **7 defectos reales** (`BUG-H73-API-01` a `BUG-H73-API-07`). En el primer ciclo de Re-Test (25/11/2026) dichos defectos quedaron subsanados, pero se detectó una regresión de análisis estático ESLint (`BUG-H73-API-08`, 5 errores `@typescript-eslint/no-explicit-any`).

En el segundo ciclo de **Re-Test (26/11/2026)** sobre `fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre`, se confirmó la **corrección completa de `BUG-H73-API-08`**: `npm run build` (28/28 páginas estáticas), `npx tsc --noEmit` (0 errores), `npm run lint` (0 errores ni advertencias) y la suite global Vitest (**95/95 archivos, 1025/1025 tests**) aprobaron sin incidencias, además de normalizarse el mensaje `403` RBAC (`No cuenta con el permiso requerido: recuperacion:leer`).

No obstante, al ejecutar la verificación exhaustiva en vivo contra PostgreSQL para el escenario de baja lógica (`CP-H73-API-16`: operativo con `eliminado_en IS NOT NULL`), se detectó el defecto **`BUG-H73-API-09`** (Severidad Alta): aunque el listado paginado excluye correctamente el registro eliminado (`total: 5`), el endpoint de detalle `GET /api/eventos-atp/recuperacion/{id}` responde **`HTTP 200 OK`** entregando los datos del operativo eliminado en lugar de **`HTTP 404 Not Found`**, debido a que `buscarRecuperacionPorId` en `src/modules/eventos-atp/recuperacion.repository.ts` omite `.where("eliminado_en", "is", null)` y provoca la ejecución del bloque de respaldo en `obtenerDetalleRecuperacionService` cuando `obtenerRecuperacionDetallePorIdRepo` retorna `null`.

| Métrica de Calidad | Auditoría (24/11) | Re-Test R1 (25/11) | Re-Test R2 (26/11) | Observaciones Técnicas |
|---|:---:|:---:|:---:|---|
| **Total de Casos Evaluados** | **25** | **26** | **27** | 8 defectos previos + 18 casos base + 1 nuevo defecto (`BUG-H73-API-09`) |
| **Casos Aprobados / Corregidos** | **18** | **24** | **25** | 8 defectos previos corregidos (`BUG-H73-API-01`..`08`) + 17 casos funcionales/CI/BD aprobados (`CP-01`..`15`, `CP-17`..`18`) |
| **Casos Abiertos / Fallidos** | **7** | **2** | **2** | Defecto `BUG-H73-API-09` (Alta — exposición 200 en baja lógica) y fallo asociado en `CP-H73-API-16` |
| **Casos Bloqueados (Blocked)** | **0** | **0** | **0** | PostgreSQL 16 + PostGIS, Redis y servidor Next.js operativos en entorno de pruebas |
| **Tasa de Aprobación (% Pass)** | **72.0%** | **92.3%** | **92.6%** | 25/27 aprobados o corregidos; pendiente filtro `eliminado_en IS NULL` en `buscarRecuperacionPorId` |
| **Chequeo de Tipos Estáticos (`npx tsc --noEmit`)** | 🟢 **0 errores** | 🟢 **0 errores** | 🟢 **0 errores** | Verificado sin errores en compilación TypeScript |
| **Análisis Estático de Código (`npm run lint`)** | 🟢 **0 errores** | 🔴 **5 errores** | 🟢 **0 errores** | `BUG-H73-API-08` corregido tras eliminar los 5 `as any` y proyectar columnas de cierre |
| **Compilación Productiva (`npm run build`)** | 🟢 **27/27 OK** | 🟢 **28/28 OK** | 🟢 **28/28 OK** | Compilación de producción completa en Next.js 16.3.4 |
| **Suite Global Automatizada (Vitest v3.2.7)** | 🟢 **860/860** | 🟢 **1025/1025** | 🟢 **1025/1025** | 95/95 archivos aprobados (incluye 13/13 archivos y 159/159 tests de Eventos ATP / OpenAPI) |
| **Migraciones Kysely (`npm run db:migrate`)** | 🟢 **38/38** | 🟢 **43/43** | 🟢 **43/43** | Ejecución limpia en BD vacía incluyendo `043_recuperacion_listado_rbac_e_indices` y `072_evento_atp_base` |

---

## 2. Registro Técnico de Defectos

### `BUG-H73-API-09`: Exposición de operativos dados de baja lógica (`HTTP 200 OK` en lugar de `HTTP 404`) en `GET /api/eventos-atp/recuperacion/{id}` por omisión de filtro `eliminado_en IS NULL` en `buscarRecuperacionPorId`
* **Severidad:** ALTA
* **Estado:** 🔴 ABIERTO (Detectado en Re-Test Ronda 2 el 26/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts` (`buscarRecuperacionPorId`, líneas 280–315)
  * `src/modules/eventos-atp/recuperacion.service.ts` (`obtenerDetalleRecuperacionService`, líneas 630–649)
* **Descripción del Defecto:** Al marcar un operativo de recuperación con baja lógica (`eliminado_en = NOW()`), la función `buscarRecuperacionPorId` en `recuperacion.repository.ts` consulta `recuperacion` filtrando únicamente por `id` sin aplicar `.where("eliminado_en", "is", null)` (a diferencia de `buscarPatrullaPorId`, `listarRecuperacionesPaginadoRepo` y `obtenerRecuperacionDetallePorIdRepo` en el mismo archivo). En consecuencia, dentro de `obtenerDetalleRecuperacionService`:
  1. `repo.buscarRecuperacionPorId(db, id)` (línea 631) devuelve el registro eliminado (`eventoExistente` válido).
  2. `repo.obtenerRecuperacionDetallePorIdRepo(id)` (línea 642) sí filtra `.where("recuperacion.eliminado_en", "is", null)` y retorna `null`.
  3. Dado que `if (detalle)` no se cumple sin lanzar excepción, el flujo sale del bloque `try` (líneas 641–648) y ejecuta el bloque de respaldo (*fallback*, líneas 650–721), devolviendo **`HTTP 200 OK`** con los datos del registro eliminado (`historial: []`). Adicionalmente, `asignarRecursosRecuperacionService` (HU-32, línea 339) reutiliza `buscarRecuperacionPorId`, quedando también expuesto a operar sobre registros eliminados.
* **Pasos para Reproducir:**
  1. Marcar el registro de prueba en PostgreSQL con baja lógica: `UPDATE recuperacion SET eliminado_en = NOW() WHERE id = '73100000-0000-4000-8000-000000000006';`.
  2. Consultar el listado `GET /api/eventos-atp/recuperacion` con token válido (excluye el registro: `meta.total = 5`).
  3. Consultar el detalle `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000006` con token válido.
* **Comportamiento Esperado vs. Actual:** Debe responder **`HTTP 404 Not Found`** rechazando el acceso a operativos con baja lógica (`eliminado_en IS NOT NULL`), en consistencia con el listado paginado. Actualmente responde **`HTTP 200 OK`** entregando `{"message":"Detalle del evento de recuperación obtenido exitosamente.","data":{"id":"73100000-0000-4000-8000-000000000006","codigo":"REC-2026-0016",...}}`.
* **Sugerencia Técnica:**
  1. En `src/modules/eventos-atp/recuperacion.repository.ts`, agregar `.where("eliminado_en", "is", null)` dentro de `buscarRecuperacionPorId` (respetando la convención de `buscarPatrullaPorId`).
  2. En `src/modules/eventos-atp/recuperacion.service.ts` (líneas 641–648), si `obtenerRecuperacionDetallePorIdRepo(id)` ejecuta sin excepción y retorna `null`, lanzar `NotFoundError` en lugar de caer al *fallback* (manteniendo el bloque de respaldo exclusivamente dentro de `catch` para compatibilidad con tests unitarios mockeados de HU-32).
  3. Incorporar aserción explícita de `.where("eliminado_en", "is", null)` en `src/modules/eventos-atp/__tests__/recuperacion.repository.test.ts` y caso de prueba de baja lógica en servicio.

---

### `BUG-H73-API-08`: Regresión de análisis estático ESLint (`5` errores `@typescript-eslint/no-explicit-any`) y omisión de campos de cierre en `buscarRecuperacionPorId`
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R2 el 26/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts`
  * `src/modules/eventos-atp/recuperacion.repository.ts`
  * `src/modules/eventos-atp/__tests__/recuperacion.asignar.service.test.ts`
* **Verificación en Re-Test R2:**
  * `buscarRecuperacionPorId` incorpora `"fecha_cierre"` y `"observaciones_cierre"` en `.select([...])`.
  * `obtenerDetalleRecuperacionService` accede directamente a `eventoExistente.fecha_cierre` y `eventoExistente.observaciones_cierre` sin `as any`.
  * `npm run lint` finalizó con código `0` (0 errores, 0 advertencias), `npm run build` compiló 28/28 rutas y `npm test` aprobó 95/95 archivos (1025/1025 tests).

---

### `BUG-H73-API-01`: Bypass de autenticación JWT mediante cabecera `X-User-Id` sin verificación criptográfica y ausencia de esquema `BearerAuth` en OpenAPI
* **Severidad:** CRÍTICA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Módulos / Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/route.ts`
  * `src/app/api/eventos-atp/recuperacion/[id]/route.ts`
  * `src/lib/openapi/index.ts` y `docs/api/eventos-atp.md`
* **Verificación en Re-Test:**
  * Enviar `X-User-Id: 00000000-0000-4000-8000-000000000001` sin cabecera `Authorization` retorna `HTTP 401 Unauthorized` (`{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}`) en ambos endpoints `GET`.
  * `GET /openapi.json` declara `security: [{"BearerAuth":[]}]` en ambos endpoints `GET` y conserva los 12 parámetros query del listado.

---

### `BUG-H73-API-02`: Excepción no controlada (`HTTP 500 Internal Server Error`) al recibir `fechaDesde` o `fechaHasta` inválidos o con espacios en blanco
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Verificación en Re-Test:** `?fechaDesde=fecha-invalida`, `?fechaHasta=no-es-fecha` y `?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z` devuelven `HTTP 400 Bad Request`; `?fechaDesde=%20` retorna `HTTP 200 OK` (`total: 6`).

---

### `BUG-H73-API-03`: Descarte silencioso de los aliases de paginación `pagina` y `limite` documentados en OpenAPI y `docs/api/eventos-atp.md`
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Verificación en Re-Test:** `?pagina=2&limite=2` devuelve exactamente `['REC-2026-0014', 'REC-2026-0015']` con `meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}`.

---

### `BUG-H73-API-04`: Falta de sanitización de comodines SQL (`%`, `_`, `\`) en el filtro de búsqueda textual `busqueda`
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Verificación en Re-Test:** `?busqueda=%25` y `?busqueda=_` retornan `HTTP 200 OK` con `total: 0` y `data: []`.

---

### `BUG-H73-API-05`: Ordenamiento alfabético incorrecto en `ordenarPor=prioridad` (`MEDIA > CRITICA > BAJA > ALTA`) en lugar de jerarquía de severidad ICS
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Verificación en Re-Test:** `?ordenarPor=prioridad&orden=desc` ordena `CRITICA -> ALTA -> ALTA -> MEDIA -> MEDIA -> BAJA`; `orden=asc` ordena la secuencia inversa exacta.

---

### `BUG-H73-API-06`: Fallo de integridad referencial (`mision_patrulla_id_fkey`) y falta de atomicidad transaccional en `scripts/seed-h73.ts` sobre base de datos limpia
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Verificación en Re-Test:** Ejecución autónoma sin `seed:patrullas` sobre `sgrai_qa_test` recién migrada crea 6 operativos dentro de transacción, la re-ejecución idempotente mantiene `6` y `--clean` deja `0`.

---

### `BUG-H73-API-07`: Desincronización con `develop` y colisiones directas de contrato, rutas y migración con HU-32 y HU-61
* **Severidad:** CRÍTICA
* **Estado:** 🟢 CORREGIDO (Verificado en Re-Test R1 y R2 el 26/11/2026)
* **Verificación en Re-Test:** Merge con `develop` unificó contratos HU-32 y HU-73 preservando `POST .../asignar`; `043_recuperacion_listado_rbac_e_indices.ts` removió la columna e índice redundantes de `evento_atp_id`; `git merge-tree --write-tree HEAD origin/develop` confirma **0 conflictos** incluso frente a los últimos merges de `origin/develop` (`056` y `057`, sin colisión con `043`).

---

### Observaciones Técnicas Verificadas
* **Subsanación de mensaje RBAC 403 (`verificarAutorizacionLecturaRecuperacion`):** En el commit de ajuste de `BUG-H73-API-08` se corrigió además el mensaje emitido ante fallo de autorización: `CALL_CENTER` recibe `HTTP 403 Forbidden` con `{"message":"No cuenta con el permiso requerido: recuperacion:leer"}` en lugar de `misiones:asignar`.
* **Numeración de migración `043`:** `043_recuperacion_listado_rbac_e_indices.ts` ejecuta correctamente sobre BD limpia y frente al catálogo actual de `origin/develop` gracias a `allowUnorderedMigrations: true` en `src/lib/db/migrator.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H73-API-09` | Exposición de operativo dado de baja lógica (`eliminado_en IS NOT NULL`) con HTTP 200 OK en endpoint de detalle por omisión de filtro en `buscarRecuperacionPorId` | Seguridad / Integridad | Repository / Service / E2E | Alta | Operativo `REC-2026-0016` marcado en BD con `eliminado_en = NOW()` y usuario Encargado autenticado | `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000006` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 404 Not Found excluyendo registros con baja lógica (`eliminado_en IS NOT NULL`) en consistencia con el listado | HTTP 200 OK exponiendo datos del operativo eliminado (`REC-2026-0016`) vía bloque de respaldo en `obtenerDetalleRecuperacionService` | **ABIERTO** | 26/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H73-API-08` | Regresión ESLint (5 errores `@typescript-eslint/no-explicit-any`) en fallback de detalle y omisión de campos de cierre en `buscarRecuperacionPorId` | Calidad Estática / Tipos | Servicio & Repositorio | Alta | Código actualizado en `feature/H73-listar-operativos-recuperacion` | `npm run lint`, inspección de `buscarRecuperacionPorId` y `recuperacion.service.ts` | Exit code 0 sin `any` explícito y columnas `fecha_cierre`/`observaciones_cierre` proyectadas en repositorio | `npm run lint` Exit code 0 (0 errores, 0 warnings); `fecha_cierre` y `observaciones_cierre` proyectadas con tipado estático | **CORREGIDO** | 25/11/2026 22:48 | 26/11/2026 14:23 | fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre |
| `BUG-H73-API-01` | Bypass de autenticación JWT mediante cabecera X-User-Id sin firma y ausencia de security BearerAuth en OpenAPI | Seguridad / Auth | Route Handler / OpenAPI | Crítica | Servidor API activo y fixture H73 sembrado en PostgreSQL | `GET /api/eventos-atp/recuperacion?limit=1` y `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `X-User-Id: 00000000-0000-4000-8000-000000000001` sin JWT] | HTTP 401 Unauthorized rechazando acceso sin JWT Bearer y registro `security: [{ BearerAuth: [] }]` en `/openapi.json` | HTTP 401 Unauthorized en ambos endpoints sin JWT y `security: [{"BearerAuth":[]}]` + 12 query params verificados en `/openapi.json` | **CORREGIDO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-02` | Excepción SQL no controlada (HTTP 500) ante parámetros fechaDesde o fechaHasta inválidos o en blanco | Robustez / Validación | Schema / Repository | Alta | Usuario autenticado con permiso `recuperacion:leer` | `GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida`, `?fechaHasta=no-es-fecha`, `?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z`, `?fechaDesde=%20` [Header: `Bearer <TOKEN_ENC>`] | HTTP 400 Bad Request para formatos/rangos inválidos y HTTP 200 OK ignorando parámetro en blanco tras `.trim()` | HTTP 400 Bad Request para fechas y rango invertido; HTTP 200 OK (`total: 6`) para espacio en blanco | **CORREGIDO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-03` | Descarte silencioso de aliases de paginación pagina y limite documentados en OpenAPI | Paginación / Contrato | Schema / Service / Repo | Alta | 6 operativos registrados en BD y usuario Encargado autenticado | `GET /api/eventos-atp/recuperacion?pagina=2&limite=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK retornando 2 registros de la página 2 y `meta: { total: 6, page: 2, limit: 2, totalPages: 3 }` | HTTP 200 OK retornando `REC-2026-0014` y `REC-2026-0015` con `meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}` | **CORREGIDO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-04` | Falta de sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda | Seguridad / SQL | Repository / Kysely | Media | 6 operativos en BD sin los caracteres literales `%` ni `_` en código, título, sector o descripción | `GET /api/eventos-atp/recuperacion?busqueda=%25` y `?busqueda=_` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `data: []` y `meta.total: 0` tras escapar comodines `ILIKE` | HTTP 200 OK con `total: 0`, `data: []` y `totalPages: 0` en ambos caracteres especiales | **CORREGIDO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-05` | Ordenamiento alfabético erróneo en ordenarPor=prioridad en lugar de jerarquía de severidad ICS | Lógica de Negocio / ICS | Repository / Kysely | Media | Operativos con prioridades `CRITICA`, `ALTA`, `MEDIA` y `BAJA` | `GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc` y `orden=asc` [Header: `Authorization: Bearer <TOKEN_ENC>`] | Orden descendente por severidad ICS: `CRITICA -> ALTA -> MEDIA -> BAJA` (y viceversa en `asc`) | Secuencia exacta `CRITICA -> ALTA -> ALTA -> MEDIA -> MEDIA -> BAJA` en `desc` y orden inverso en `asc` | **CORREGIDO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-06` | Fallo de clave foránea mision_patrulla_id_fkey y ausencia de transacción en seed:h73 sobre BD limpia | Integridad / Seed DB | Script Seed / PostgreSQL | Media | Base de datos PostgreSQL recién migrada con `npm run db:migrate` sin siembra previa de patrullas | `DATABASE_URL=.../sgrai_qa_test npm run seed:h73` y `npm run seed:h73 -- --clean` | Ejecución autónoma, transaccional e idempotente creando los 6 operativos sin errores de FK | Ejecución exitosa sin `seed:patrullas` dentro de transacción, re-ejecución idempotente (`6` filas) y `--clean` (`0` filas) | **CORREGIDO** | 24/11/2026 01:58 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `BUG-H73-API-07` | Desincronización con develop y colisiones de contratos, rutas y migración 043 vs HU-32 y HU-61 | Integración / Git & DB | Rama / Contratos / Migración | Crítica | Rama `feature/H73-listar-operativos-recuperacion` frente a `origin/develop` | `git merge-tree --write-tree HEAD origin/develop`, `/openapi.json` (HU-32 + HU-73) y `043_recuperacion_listado_rbac_e_indices.ts` | Rama integrada con `develop`, contratos unificados con HU-32 y migración sin colisión de columna/índice `evento_atp_id` | Merge limpio (`MERGE_CLEAN=true`), ruta `POST .../asignar` y campos HU-32/HU-73 intactos en OpenAPI, 43/43 migraciones aplicadas | **CORREGIDO** | 24/11/2026 02:07 | 26/11/2026 14:23 | merge: integrar develop y resolver observaciones de QA en H73 |
| `CP-H73-API-01` | Listado paginado base sin filtros con valores por defecto (page=1, limit=20) y campos de tabla (CA-1, CA-2, CA-5) | Funcional / API REST | Integración E2E | Crítica | Usuario Encargado autenticado y 6 operativos del fixture sembrados | `GET /api/eventos-atp/recuperacion` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con código, nombre, delegación, estado, `cantidadInsumosAsignados`, `creadoEn` y `meta` H34 | HTTP 200 OK con los 6 operativos ordenados por `creadoEn` descendente y estructura H34 completa | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-02` | Paginación estándar H34 mediante page=2 y limit=2 con metadatos completos (CA-1, CA-5) | Funcional / Paginación | Integración E2E | Crítica | 6 operativos en BD y token JWT de Encargado | `GET /api/eventos-atp/recuperacion?page=2&limit=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con 2 ítems y `meta: { total: 6, page: 2, limit: 2, totalPages: 3, hasNext: true, hasPrev: true }` | HTTP 200 OK retornando `REC-2026-0014` y `REC-2026-0015` con `meta` exacto | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-03` | Consulta de página fuera de rango (page=99&limit=2) sin error SQL IN () | Robustez / Borde | Repository / E2E | Alta | 6 operativos en BD y token JWT de Encargado | `GET /api/eventos-atp/recuperacion?page=99&limit=2` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `data: []` y `meta: { total: 6, page: 99, limit: 2, totalPages: 3, hasNext: false, hasPrev: true }` | HTTP 200 OK con `data: []` sin ejecutar consulta `IN ()` vacía | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-04` | Rechazo de peticiones sin credenciales o con token JWT inválido o manipulado | Seguridad / Auth | Route Handler / Guard | Crítica | Servidor API activo sin token o con JWT adulterado | `GET /api/eventos-atp/recuperacion` (sin headers) y con `Authorization: Bearer invalid.jwt.token` | HTTP 401 Unauthorized en ambos escenarios | HTTP 401 (`Se requiere cabecera de autenticación Authorization: Bearer <token>.` y `Token de sesión inválido o expirado.`) | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-05` | Acceso autorizado al listado para perfiles Administrador y Encargado con permiso recuperacion:leer | Seguridad / RBAC | Integración E2E | Crítica | Usuarios `admin@valdivia.cl` y `encargado@valdivia.cl` autenticados vía `/api/seguridad/login` | `GET /api/eventos-atp/recuperacion?limit=1` con `Bearer <TOKEN_ADM>` y `Bearer <TOKEN_ENC>` | HTTP 200 OK para ambos roles autorizados | HTTP 200 OK validando permiso `recuperacion:leer` para ambos perfiles | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-06` | Acceso autorizado al listado y detalle para perfil Supervisor Estratégico tras migración 043 | Seguridad / RBAC | Integración E2E | Alta | Usuario `supervisor@valdivia.cl` (`SUPERVISOR`) autenticado con JWT Bearer | `GET /api/eventos-atp/recuperacion?limit=1` y `GET .../73100000-...0001` [Header: `Bearer <TOKEN_SUP>`] | HTTP 200 OK permitiendo monitoreo gerencial de operativos de recuperación | HTTP 200 OK en listado y detalle bajo estándar H34 | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73) |
| `CP-H73-API-07` | Bloqueo RBAC (HTTP 403 Forbidden) para usuario autenticado sin permiso recuperacion:leer | Seguridad / RBAC | Integración E2E | Crítica | Usuario `callcenter@valdivia.cl` (`CALL_CENTER`) autenticado con JWT Bearer | `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `Bearer <TOKEN_CC>`] | HTTP 403 Forbidden indicando ausencia de permiso `recuperacion:leer` | HTTP 403 Forbidden (`No cuenta con el permiso requerido: recuperacion:leer`) en ambos endpoints | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre |
| `CP-H73-API-08` | Filtrado territorial por delegacionId UUID válido (CA-3, CA-5) | Funcional / Filtro | Integración E2E | Crítica | Operativos distribuidos en las 4 delegaciones de Valdivia | `GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK retornando solo operativos de Delegación Municipal Costa (`REC-2026-0011` y `REC-2026-0015`) | HTTP 200 OK con `meta.total: 2` (`REC-2026-0011`, `REC-2026-0015`) | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-09` | Filtrado por estado operativo (EN_EJECUCION) y por prioridad (CRITICA) (CA-2, CA-3, CA-5) | Funcional / Filtro | Integración E2E | Crítica | Operativos en los 4 estados del ciclo de vida y 4 niveles de prioridad | `GET /api/eventos-atp/recuperacion?estado=EN_EJECUCION` y `?prioridad=CRITICA` | HTTP 200 OK filtrando exactamente por el estado y prioridad solicitados | HTTP 200 OK retornando `REC-2026-0011`/`REC-2026-0014` (`total: 2`) para `EN_EJECUCION` y `REC-2026-0013` (`total: 1`) para `CRITICA` | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-10` | Filtrado combinado conjuntivo AND entre delegacionId y estado (CA-3, CA-5) | Integración / Filtro | Integración E2E | Alta | Operativos en Costa en estados `EN_EJECUCION` y `CANCELADA` | `GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION` | HTTP 200 OK retornando exclusivamente la intersección (`REC-2026-0011`) | HTTP 200 OK con `meta.total: 1` (`REC-2026-0011`) | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-11` | Búsqueda textual parcial insensible a mayúsculas por código o título y estado vacío (CA-3, CA-5) | Funcional / Búsqueda | Integración E2E | Crítica | Operativos registrados con códigos `REC-2026-0011..0016` | `?busqueda=REC-2026-0013`, `?busqueda=techumbres` y `?busqueda=INEXISTENTE_XYZ_999` | Coincidencias exactas para código (1) y título (2), y `data: []` con `total: 0` para término inexistente | HTTP 200 OK retornando `REC-2026-0013` (`total: 1`), `REC-2026-0011`/`0016` (`total: 2`) y `data: []` (`total: 0`) | **APROBADO** | 24/11/2026 02:00 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-12` | Filtrado temporal válido ISO 8601 (fechaDesde/fechaHasta) y ordenamiento por codigo y familiasAfectadas (CA-5) | Funcional / Filtro & Orden | Integración E2E | Alta | Operativos con timestamps escalonados en BD | `?fechaDesde=2026-11-26T11:24:05Z&fechaHasta=2026-11-26T18:24:05Z`, `?ordenarPor=codigo&orden=asc` y `?ordenarPor=familiasAfectadas&orden=desc` | Rango temporal acotado a 3 registros recientes y ordenamiento correcto por código ascendente y familias descendente | HTTP 200 OK con `total: 3` (`0013`, `0011`, `0014`) y secuencias exactas (`REC-2026-0011..0016` y `42,35,18,12,8,5`) | **APROBADO** | 24/11/2026 02:01 | 26/11/2026 14:24 | feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73) |
| `CP-H73-API-13` | Validación Zod ante parámetros de consulta inválidos (delegacionId, estado, limit > 100, page < 1, limit < 1, ordenarPor inválido) (CA-5) | Validación / Schema | Integración E2E & Vitest | Alta | Esquema `ListarRecuperacionesQuerySchema` activo | `?delegacionId=no-uuid`, `?estado=OTRO`, `?limit=150`, `?page=0`, `?limit=0`, `?ordenarPor=invalido` | HTTP 400 Bad Request con arreglo `errors` detallando campo y mensaje | HTTP 400 Bad Request en los 6 casos verificados | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-14` | Consulta de detalle consolidado GET /api/eventos-atp/recuperacion/{id} para drawer lateral con recursos, misiones e historial (CA-4) | Funcional / Drawer | Integración E2E | Crítica | Operativo `REC-2026-0011` (`73100000-...0001`) con misión, 2 insumos, 2 hitos y 1 reporte | `GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001` [Header: `Authorization: Bearer <TOKEN_ENC>`] | HTTP 200 OK con `recursos`, `recursosAsignados`, `cantidadInsumosAsignados: 100`, `mision`, `misiones` e `historial` | HTTP 200 OK entregando `MIS-2026-0073-1`, 2 recursos (`100` uds), e historial de 4 hitos (`CREACION`, `HITO_MISION` x2, `REPORTE_TERRENO`) | **APROBADO** | 24/11/2026 01:59 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-15` | Consulta de detalle para operativo COMPLETADA (con cierre) y operativos sin misión o sin patrulla asignada (CA-4) | Borde / Drawer | Integración E2E | Alta | Operativos `REC-2026-0012` (`COMPLETADA`), `REC-2026-0013` (sin misión) y `REC-2026-0014` (sin patrulla) | `GET /api/eventos-atp/recuperacion/{id}` para IDs `...0002`, `...0003` y `...0004` | HTTP 200 OK incluyendo `CIERRE` y `observacionesCierre` en `...0002`, `mision: null`/`misiones: []` en `...0003` y `patrulla: null` en `...0004` | HTTP 200 OK sin excepciones de join; `...0002` incluye `CIERRE`, `fechaCierre` y `observacionesCierre` | **APROBADO** | 24/11/2026 02:01 | 26/11/2026 14:24 | fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop |
| `CP-H73-API-16` | Rechazo de UUID inválido (400), inexistente (404) y exclusión por baja lógica (eliminado_en IS NOT NULL) (CA-4, CA-5) | Validación / Integridad | Integración E2E | Alta | Operativo `REC-2026-0016` marcado temporalmente con `eliminado_en = NOW()` en BD | `GET .../id-invalido`, `GET .../70000000-0000-4000-8000-000000000099`, `GET .../73100000-...0006` (baja lógica) | HTTP 400 Bad Request, HTTP 404 Not Found y exclusión de registro eliminado en detalle (`404`) y listado (`total: 5`) | HTTP 400, HTTP 404 (inexistente) y exclusión en listado (`total: 5`) OK, pero detalle de registro eliminado retorna HTTP 200 OK (`BUG-H73-API-09`) | **FALLIDO** | 24/11/2026 02:00 | 26/11/2026 14:24 | Pendiente (Rechazado en Code Review) |
| `CP-H73-API-17` | Ejecución limpia de migraciones tras integración con develop (043_recuperacion_listado_rbac_e_indices.ts + 072_evento_atp_base.ts) | Migración / DB | Migrator Kysely | Crítica | Base de datos limpia `sgrai_qa_test` en PostgreSQL 16 + PostGIS | `DATABASE_URL=.../sgrai_qa_test npm run db:migrate` | 43/43 migraciones aplicadas sin colisión agregando columnas, índices y permiso `recuperacion:leer` sin duplicar `evento_atp_id` | 43/43 migraciones ejecutadas con éxito (`[OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"` y `"072_evento_atp_base"`) | **APROBADO** | 24/11/2026 01:58 | 26/11/2026 14:23 | fix(db): remover evento_atp_id redundante en migracion 043 |
| `CP-H73-API-18` | Verificación de build productivo, tipado TypeScript, análisis estático ESLint, documentación API y suite global Vitest | Calidad / CI | Estático & Unitario | Crítica | Rama `feature/H73-listar-operativos-recuperacion` en commit final de corrección | `npm run build && npx tsc --noEmit && npm run lint && npm test` | Build, `tsc` y `lint` con 0 errores, docs actualizados y 100% de tests unitarios aprobados | Build 28/28 OK, `tsc` 0 errores, `npm run lint` 0 errores, 95/95 archivos (1025/1025 tests) OK | **APROBADO** | 24/11/2026 01:57 | 26/11/2026 14:23 | fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre |

---

## 4. Bloque TSV

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H73-API-09	Exposición de operativo dado de baja lógica (eliminado_en IS NOT NULL) con HTTP 200 OK en endpoint de detalle por omisión de filtro en buscarRecuperacionPorId	Seguridad / Integridad	Repository / Service / E2E	Alta	Operativo REC-2026-0016 marcado en BD con eliminado_en = NOW() y usuario Encargado autenticado	GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000006 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 404 Not Found excluyendo registros con baja lógica (eliminado_en IS NOT NULL) en consistencia con el listado	HTTP 200 OK exponiendo datos del operativo eliminado (REC-2026-0016) vía bloque de respaldo en obtenerDetalleRecuperacionService	ABIERTO	26/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H73-API-08	Regresión ESLint (5 errores @typescript-eslint/no-explicit-any) en fallback de detalle y omisión de campos de cierre en buscarRecuperacionPorId	Calidad Estática / Tipos	Servicio & Repositorio	Alta	Código actualizado en feature/H73-listar-operativos-recuperacion	npm run lint, inspección de buscarRecuperacionPorId y recuperacion.service.ts	Exit code 0 sin any explícito y columnas fecha_cierre/observaciones_cierre proyectadas en repositorio	npm run lint Exit code 0 (0 errores, 0 warnings); fecha_cierre y observaciones_cierre proyectadas con tipado estático	CORREGIDO	25/11/2026 22:48	26/11/2026 14:23	fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre
BUG-H73-API-01	Bypass de autenticación JWT mediante cabecera X-User-Id sin firma y ausencia de security BearerAuth en OpenAPI	Seguridad / Auth	Route Handler / OpenAPI	Crítica	Servidor API activo y fixture H73 sembrado en PostgreSQL	GET /api/eventos-atp/recuperacion?limit=1 y GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: X-User-Id: 00000000-0000-4000-8000-000000000001 sin JWT]	HTTP 401 Unauthorized rechazando acceso sin JWT Bearer y registro security: [{ BearerAuth: [] }] en /openapi.json	HTTP 401 Unauthorized en ambos endpoints sin JWT y security: [{"BearerAuth":[]}] + 12 query params verificados en /openapi.json	CORREGIDO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-02	Excepción SQL no controlada (HTTP 500) ante parámetros fechaDesde o fechaHasta inválidos o en blanco	Robustez / Validación	Schema / Repository	Alta	Usuario autenticado con permiso recuperacion:leer	GET /api/eventos-atp/recuperacion?fechaDesde=fecha-invalida, ?fechaHasta=no-es-fecha, ?fechaDesde=2026-12-01T00:00:00Z&fechaHasta=2026-11-01T00:00:00Z, ?fechaDesde=%20 [Header: Bearer <TOKEN_ENC>]	HTTP 400 Bad Request para formatos/rangos inválidos y HTTP 200 OK ignorando parámetro en blanco tras .trim()	HTTP 400 Bad Request para fechas y rango invertido; HTTP 200 OK (total: 6) para espacio en blanco	CORREGIDO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-03	Descarte silencioso de aliases de paginación pagina y limite documentados en OpenAPI	Paginación / Contrato	Schema / Service / Repo	Alta	6 operativos registrados en BD y usuario Encargado autenticado	GET /api/eventos-atp/recuperacion?pagina=2&limite=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK retornando 2 registros de la página 2 y meta: { total: 6, page: 2, limit: 2, totalPages: 3 }	HTTP 200 OK retornando REC-2026-0014 y REC-2026-0015 con meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}	CORREGIDO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-04	Falta de sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda	Seguridad / SQL	Repository / Kysely	Media	6 operativos en BD sin los caracteres literales % ni _ en código, título, sector o descripción	GET /api/eventos-atp/recuperacion?busqueda=%25 y ?busqueda=_ [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con data: [] y meta.total: 0 tras escapar comodines ILIKE	HTTP 200 OK con total: 0, data: [] y totalPages: 0 en ambos caracteres especiales	CORREGIDO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-05	Ordenamiento alfabético erróneo en ordenarPor=prioridad en lugar de jerarquía de severidad ICS	Lógica de Negocio / ICS	Repository / Kysely	Media	Operativos con prioridades CRITICA, ALTA, MEDIA y BAJA	GET /api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc y orden=asc [Header: Authorization: Bearer <TOKEN_ENC>]	Orden descendente por severidad ICS: CRITICA -> ALTA -> MEDIA -> BAJA (y viceversa en asc)	Secuencia exacta CRITICA -> ALTA -> ALTA -> MEDIA -> MEDIA -> BAJA en desc y orden inverso en asc	CORREGIDO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-06	Fallo de clave foránea mision_patrulla_id_fkey y ausencia de transacción en seed:h73 sobre BD limpia	Integridad / Seed DB	Script Seed / PostgreSQL	Media	Base de datos PostgreSQL recién migrada con npm run db:migrate sin siembra previa de patrullas	DATABASE_URL=.../sgrai_qa_test npm run seed:h73 y npm run seed:h73 -- --clean	Ejecución autónoma, transaccional e idempotente creando los 6 operativos sin errores de FK	Ejecución exitosa sin seed:patrullas dentro de transacción, re-ejecución idempotente (6 filas) y --clean (0 filas)	CORREGIDO	24/11/2026 01:58	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
BUG-H73-API-07	Desincronización con develop y colisiones de contratos, rutas y migración 043 vs HU-32 y HU-61	Integración / Git & DB	Rama / Contratos / Migración	Crítica	Rama feature/H73-listar-operativos-recuperacion frente a origin/develop	git merge-tree --write-tree HEAD origin/develop, /openapi.json (HU-32 + HU-73) y 043_recuperacion_listado_rbac_e_indices.ts	Rama integrada con develop, contratos unificados con HU-32 y migración sin colisión de columna/índice evento_atp_id	Merge limpio (MERGE_CLEAN=true), ruta POST .../asignar y campos HU-32/HU-73 intactos en OpenAPI, 43/43 migraciones aplicadas	CORREGIDO	24/11/2026 02:07	26/11/2026 14:23	merge: integrar develop y resolver observaciones de QA en H73
CP-H73-API-01	Listado paginado base sin filtros con valores por defecto (page=1, limit=20) y campos de tabla (CA-1, CA-2, CA-5)	Funcional / API REST	Integración E2E	Crítica	Usuario Encargado autenticado y 6 operativos del fixture sembrados	GET /api/eventos-atp/recuperacion [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con código, nombre, delegación, estado, cantidadInsumosAsignados, creadoEn y meta H34	HTTP 200 OK con los 6 operativos ordenados por creadoEn descendente y estructura H34 completa	APROBADO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-02	Paginación estándar H34 mediante page=2 y limit=2 con metadatos completos (CA-1, CA-5)	Funcional / Paginación	Integración E2E	Crítica	6 operativos en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion?page=2&limit=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con 2 ítems y meta: { total: 6, page: 2, limit: 2, totalPages: 3, hasNext: true, hasPrev: true }	HTTP 200 OK retornando REC-2026-0014 y REC-2026-0015 con meta exacto	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-03	Consulta de página fuera de rango (page=99&limit=2) sin error SQL IN ()	Robustez / Borde	Repository / E2E	Alta	6 operativos en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion?page=99&limit=2 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con data: [] y meta: { total: 6, page: 99, limit: 2, totalPages: 3, hasNext: false, hasPrev: true }	HTTP 200 OK con data: [] sin ejecutar consulta IN () vacía	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-04	Rechazo de peticiones sin credenciales o con token JWT inválido o manipulado	Seguridad / Auth	Route Handler / Guard	Crítica	Servidor API activo sin token o con JWT adulterado	GET /api/eventos-atp/recuperacion (sin headers) y con Authorization: Bearer invalid.jwt.token	HTTP 401 Unauthorized en ambos escenarios	HTTP 401 (Se requiere cabecera de autenticación Authorization: Bearer <token>. y Token de sesión inválido o expirado.)	APROBADO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-05	Acceso autorizado al listado para perfiles Administrador y Encargado con permiso recuperacion:leer	Seguridad / RBAC	Integración E2E	Crítica	Usuarios admin@valdivia.cl y encargado@valdivia.cl autenticados vía /api/seguridad/login	GET /api/eventos-atp/recuperacion?limit=1 con Bearer <TOKEN_ADM> y Bearer <TOKEN_ENC>	HTTP 200 OK para ambos roles autorizados	HTTP 200 OK validando permiso recuperacion:leer para ambos perfiles	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-06	Acceso autorizado al listado y detalle para perfil Supervisor Estratégico tras migración 043	Seguridad / RBAC	Integración E2E	Alta	Usuario supervisor@valdivia.cl (SUPERVISOR) autenticado con JWT Bearer	GET /api/eventos-atp/recuperacion?limit=1 y GET .../73100000-...0001 [Header: Bearer <TOKEN_SUP>]	HTTP 200 OK permitiendo monitoreo gerencial de operativos de recuperación	HTTP 200 OK en listado y detalle bajo estándar H34	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(db): agregar columnas, indices y permiso rbac recuperacion:leer (H73)
CP-H73-API-07	Bloqueo RBAC (HTTP 403 Forbidden) para usuario autenticado sin permiso recuperacion:leer	Seguridad / RBAC	Integración E2E	Crítica	Usuario callcenter@valdivia.cl (CALL_CENTER) autenticado con JWT Bearer	GET /api/eventos-atp/recuperacion y GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: Bearer <TOKEN_CC>]	HTTP 403 Forbidden indicando ausencia de permiso recuperacion:leer	HTTP 403 Forbidden (No cuenta con el permiso requerido: recuperacion:leer) en ambos endpoints	APROBADO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre
CP-H73-API-08	Filtrado territorial por delegacionId UUID válido (CA-3, CA-5)	Funcional / Filtro	Integración E2E	Crítica	Operativos distribuidos en las 4 delegaciones de Valdivia	GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK retornando solo operativos de Delegación Municipal Costa (REC-2026-0011 y REC-2026-0015)	HTTP 200 OK con meta.total: 2 (REC-2026-0011, REC-2026-0015)	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-09	Filtrado por estado operativo (EN_EJECUCION) y por prioridad (CRITICA) (CA-2, CA-3, CA-5)	Funcional / Filtro	Integración E2E	Crítica	Operativos en los 4 estados del ciclo de vida y 4 niveles de prioridad	GET /api/eventos-atp/recuperacion?estado=EN_EJECUCION y ?prioridad=CRITICA	HTTP 200 OK filtrando exactamente por el estado y prioridad solicitados	HTTP 200 OK retornando REC-2026-0011/REC-2026-0014 (total: 2) para EN_EJECUCION y REC-2026-0013 (total: 1) para CRITICA	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-10	Filtrado combinado conjuntivo AND entre delegacionId y estado (CA-3, CA-5)	Integración / Filtro	Integración E2E	Alta	Operativos en Costa en estados EN_EJECUCION y CANCELADA	GET /api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000003&estado=EN_EJECUCION	HTTP 200 OK retornando exclusivamente la intersección (REC-2026-0011)	HTTP 200 OK con meta.total: 1 (REC-2026-0011)	APROBADO	24/11/2026 01:59	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-11	Búsqueda textual parcial insensible a mayúsculas por código o título y estado vacío (CA-3, CA-5)	Funcional / Búsqueda	Integración E2E	Crítica	Operativos registrados con códigos REC-2026-0011..0016	?busqueda=REC-2026-0013, ?busqueda=techumbres y ?busqueda=INEXISTENTE_XYZ_999	Coincidencias exactas para código (1) y título (2), y data: [] con total: 0 para término inexistente	HTTP 200 OK retornando REC-2026-0013 (total: 1), REC-2026-0011/0016 (total: 2) y data: [] (total: 0)	APROBADO	24/11/2026 02:00	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-12	Filtrado temporal válido ISO 8601 (fechaDesde/fechaHasta) y ordenamiento por codigo y familiasAfectadas (CA-5)	Funcional / Filtro & Orden	Integración E2E	Alta	Operativos con timestamps escalonados en BD	?fechaDesde=2026-11-26T11:24:05Z&fechaHasta=2026-11-26T18:24:05Z, ?ordenarPor=codigo&orden=asc y ?ordenarPor=familiasAfectadas&orden=desc	Rango temporal acotado a 3 registros recientes y ordenamiento correcto por código ascendente y familias descendente	HTTP 200 OK con total: 3 (0013, 0011, 0014) y secuencias exactas (REC-2026-0011..0016 y 42,35,18,12,8,5)	APROBADO	24/11/2026 02:01	26/11/2026 14:24	feat(eventos-atp): implementar listado paginado H34 y detalle de operativos de recuperacion (H73)
CP-H73-API-13	Validación Zod ante parámetros de consulta inválidos (delegacionId, estado, limit > 100, page < 1, limit < 1, ordenarPor inválido) (CA-5)	Validación / Schema	Integración E2E & Vitest	Alta	Esquema ListarRecuperacionesQuerySchema activo	?delegacionId=no-uuid, ?estado=OTRO, ?limit=150, ?page=0, ?limit=0, ?ordenarPor=invalido	HTTP 400 Bad Request con arreglo errors detallando campo y mensaje	HTTP 400 Bad Request en los 6 casos verificados	APROBADO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-14	Consulta de detalle consolidado GET /api/eventos-atp/recuperacion/{id} para drawer lateral con recursos, misiones e historial (CA-4)	Funcional / Drawer	Integración E2E	Crítica	Operativo REC-2026-0011 (73100000-...0001) con misión, 2 insumos, 2 hitos y 1 reporte	GET /api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000001 [Header: Authorization: Bearer <TOKEN_ENC>]	HTTP 200 OK con recursos, recursosAsignados, cantidadInsumosAsignados: 100, mision, misiones e historial	HTTP 200 OK entregando MIS-2026-0073-1, 2 recursos (100 uds), e historial de 4 hitos (CREACION, HITO_MISION x2, REPORTE_TERRENO)	APROBADO	24/11/2026 01:59	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-15	Consulta de detalle para operativo COMPLETADA (con cierre) y operativos sin misión o sin patrulla asignada (CA-4)	Borde / Drawer	Integración E2E	Alta	Operativos REC-2026-0012 (COMPLETADA), REC-2026-0013 (sin misión) y REC-2026-0014 (sin patrulla)	GET /api/eventos-atp/recuperacion/{id} para IDs ...0002, ...0003 y ...0004	HTTP 200 OK incluyendo CIERRE y observacionesCierre en ...0002, mision: null/misiones: [] en ...0003 y patrulla: null en ...0004	HTTP 200 OK sin excepciones de join; ...0002 incluye CIERRE, fechaCierre y observacionesCierre	APROBADO	24/11/2026 02:01	26/11/2026 14:24	fix(recuperacion): corregir observaciones de QA y compatibilizar contratos con develop
CP-H73-API-16	Rechazo de UUID inválido (400), inexistente (404) y exclusión por baja lógica (eliminado_en IS NOT NULL) (CA-4, CA-5)	Validación / Integridad	Integración E2E	Alta	Operativo REC-2026-0016 marcado temporalmente con eliminado_en = NOW() en BD	GET .../id-invalido, GET .../70000000-0000-4000-8000-000000000099, GET .../73100000-...0006 (baja lógica)	HTTP 400 Bad Request, HTTP 404 Not Found y exclusión de registro eliminado en detalle (404) y listado (total: 5)	HTTP 400, HTTP 404 (inexistente) y exclusión en listado (total: 5) OK, pero detalle de registro eliminado retorna HTTP 200 OK (BUG-H73-API-09)	FALLIDO	24/11/2026 02:00	26/11/2026 14:24	Pendiente (Rechazado en Code Review)
CP-H73-API-17	Ejecución limpia de migraciones tras integración con develop (043_recuperacion_listado_rbac_e_indices.ts + 072_evento_atp_base.ts)	Migración / DB	Migrator Kysely	Crítica	Base de datos limpia sgrai_qa_test en PostgreSQL 16 + PostGIS	DATABASE_URL=.../sgrai_qa_test npm run db:migrate	43/43 migraciones aplicadas sin colisión agregando columnas, índices y permiso recuperacion:leer sin duplicar evento_atp_id	43/43 migraciones ejecutadas con éxito ([OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices" y "072_evento_atp_base")	APROBADO	24/11/2026 01:58	26/11/2026 14:23	fix(db): remover evento_atp_id redundante en migracion 043
CP-H73-API-18	Verificación de build productivo, tipado TypeScript, análisis estático ESLint, documentación API y suite global Vitest	Calidad / CI	Estático & Unitario	Crítica	Rama feature/H73-listar-operativos-recuperacion en commit final de corrección	npm run build && npx tsc --noEmit && npm run lint && npm test	Build, tsc y lint con 0 errores, docs actualizados y 100% de tests unitarios aprobados	Build 28/28 OK, tsc 0 errores, npm run lint 0 errores, 95/95 archivos (1025/1025 tests) OK	APROBADO	24/11/2026 01:57	26/11/2026 14:23	fix(recuperacion): resolver BUG-H73-API-08 eliminando any y proyectando fecha_cierre
````

---

## 5. Guía de Ejecución Paso a Paso (Re-Test Ronda 2 — 26/11/2026)

### 5.1. Verificación de Calidad Estática, Build y Pruebas Unitarias (Vitest)

1. **Compilación productiva, verificación TypeScript, análisis estático ESLint y suite completa:**
   ```bash
   npm run build && npx tsc --noEmit && npm run lint && npm test
   ```
   Salidas observadas (código de salida `0`):
   ```text
   ✓ Compiled successfully in 3.2s
   Finished TypeScript in 4.8s
   ✓ Generating static pages using 15 workers (28/28) in 278ms
   (npx tsc --noEmit -> exit code 0)
   (npm run lint -> exit code 0, 0 errors, 0 warnings)

   Test Files  95 passed (95)
        Tests  1025 passed (1025)
   ```

2. **Pruebas unitarias focalizadas de servicio, repositorio, Route Handlers y OpenAPI:**
   ```bash
   npx vitest run src/modules/eventos-atp/__tests__/ src/app/api/eventos-atp/recuperacion/__tests__/ "src/app/api/eventos-atp/recuperacion/[id]/__tests__/" src/app/openapi.json/__tests__/
   npm test -- src/modules/eventos-atp/__tests__/recuperacion.service.test.ts -t "Listado Paginado"
   npm test -- src/modules/eventos-atp/__tests__/recuperacion.service.test.ts -t "Drawer"
   npm test -- src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts -t "HU-73"
   npm test -- "src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts" -t "Drawer"
   npx vitest run src/modules/eventos-atp/__tests__/recuperacion.repository.test.ts src/app/openapi.json/__tests__/route.test.ts
   ```
   Salidas observadas:
   ```text
   Test Files  13 passed (13) | Tests  159 passed (159)             [Módulo Eventos ATP + OpenAPI]
   Test Files  1 passed (1)   | Tests  6 passed | 14 skipped (20)   [recuperacion.service.test.ts -t "Listado Paginado"]
   Test Files  1 passed (1)   | Tests  2 passed | 18 skipped (20)   [recuperacion.service.test.ts -t "Drawer"]
   Test Files  1 passed (1)   | Tests  5 passed | 8 skipped (13)    [recuperacion/__tests__/route.test.ts -t "HU-73"]
   Test Files  1 passed (1)   | Tests  5 passed (5)                 [recuperacion/[id]/__tests__/route.test.ts -t "Drawer"]
   Test Files  2 passed (2)   | Tests  7 passed (7)                 [recuperacion.repository.test.ts (6) + openapi.json (1)]
   ```

---

### 5.2. Preparación de Base de Datos Limpia, Migraciones y Siembra Autónoma `seed:h73`

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

---

### 5.3. Pruebas HTTP en Vivo (cURL), Reproducción de `BUG-H73-API-09` y Regresión E2E

1. **Verificación RBAC (403 actualizado) y autenticación (`BUG-H73-API-01`):**
   ```bash
   curl -s -w "\nHTTP:%{http_code}\n" -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
     "http://localhost:3001/api/eventos-atp/recuperacion?limit=1"
   # {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."} | HTTP:401

   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_CC" \
     "http://localhost:3001/api/eventos-atp/recuperacion"
   # {"message":"No cuenta con el permiso requerido: recuperacion:leer"} | HTTP:403
   ```

2. **Verificación OpenAPI, aliases, fechas, comodines y prioridad ICS (`BUG-H73-API-02` a `BUG-H73-API-05`):**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?pagina=2&limite=2"
   # codes: ['REC-2026-0014', 'REC-2026-0015'] | meta: {"total":6,"page":2,"limit":2,"totalPages":3,"hasNext":true,"hasPrev":true}

   curl -s -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?busqueda=%25"
   # {"message":"Operativos de recuperación obtenidos exitosamente.","total":0,"data":[],"meta":{"total":0,"page":1,"limit":20,"totalPages":0,"hasNext":false,"hasPrev":false}}

   curl -s -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion?ordenarPor=prioridad&orden=desc"
   # REC-2026-0013(CRITICA) -> REC-2026-0011(ALTA) -> REC-2026-0014(ALTA) -> REC-2026-0012(MEDIA) -> REC-2026-0016(MEDIA) -> REC-2026-0015(BAJA)
   ```

3. **Reproducción de `BUG-H73-API-09` (baja lógica en detalle vs listado — `CP-H73-API-16`):**
   ```bash
   docker exec grupo1_postgres psql -U sgrai -d sgrai_qa_test \
     -c "UPDATE recuperacion SET eliminado_en = NOW() WHERE id = '73100000-0000-4000-8000-000000000006';"

   # Listado excluye correctamente:
   curl -s -H "Authorization: Bearer $TOKEN_ENC" "http://localhost:3001/api/eventos-atp/recuperacion"
   # meta.total: 5

   # Detalle expone indebidamente HTTP 200 OK en lugar de HTTP 404:
   curl -s -w "\nHTTP:%{http_code}\n" -H "Authorization: Bearer $TOKEN_ENC" \
     "http://localhost:3001/api/eventos-atp/recuperacion/73100000-0000-4000-8000-000000000006"
   # {"message":"Detalle del evento de recuperación obtenido exitosamente.","data":{"id":"73100000-0000-4000-8000-000000000006","codigo":"REC-2026-0016",...}} | HTTP:200
   ```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (HU-73 — Alcance Backend API)

| Criterio de Aceptación (HU-73) | Cobertura / Implementación en `sgrai-api` | Casos de Prueba y Defectos Vinculados | Estado en Backend |
|---|---|---|---|
| **CA-1:** Vista tabular en `/gestion/centro-incidentes` (pestaña Recuperación) bajo estándar de contratos H34 (`page`, `limit`, `total`, `totalPages`). | Contrato de datos `ListarRecuperacionesResponseSchema`, objeto `meta` (`total`, `page`, `limit`, `totalPages`, `hasNext`, `hasPrev`) y soporte efectivo de `page`/`limit` y `pagina`/`limite` en `GET /api/eventos-atp/recuperacion`. *(La vista visual reside en `sgrai-web`)*. | `CP-H73-API-01`, `CP-H73-API-02`, `CP-H73-API-03`, `BUG-H73-API-03` | 🟢 Cumplido |
| **CA-2:** Mostrar Código de evento, Título descriptivo, Delegación, Estado (`PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA`), Cantidad de insumos asignados y Fecha de registro. | `OperativoRecuperacionItemSchema` expone `codigo`, `nombre`, `delegacion`, `estado`, `cantidadInsumosAsignados`, `totalTiposInsumos`, `recursosResumen`, `creadoEn`, `actualizadoEn` y `fechaCierre`. | `CP-H73-API-01`, `CP-H73-API-09` | 🟢 Cumplido |
| **CA-3:** Permitir filtrar por delegación municipal, estado del operativo y búsqueda textual por código o título. | `ListarRecuperacionesQuerySchema` y `listarRecuperacionesPaginadoRepo` filtran por `delegacionId`, `estado`, `prioridad`, `fechaDesde`, `fechaHasta` y `busqueda` sanitizada, con ordenamiento ICS por prioridad. | `CP-H73-API-08` a `CP-H73-API-12`, `BUG-H73-API-02`, `BUG-H73-API-04`, `BUG-H73-API-05` | 🟢 Cumplido |
| **CA-4:** Al hacer clic en un registro, abrir drawer lateral con detalle de recursos asignados e historial. | Endpoint unificado `GET /api/eventos-atp/recuperacion/{id}` retorna `recursos`, `recursosAsignados`, `cantidadInsumosAsignados`, `mision`, `misiones`, `patrulla` e `historial` cronológico (`CREACION`, `HITO_MISION`, `REPORTE_TERRENO`, `CIERRE`), pero expone registros con baja lógica (`BUG-H73-API-09`). | `CP-H73-API-14`, `CP-H73-API-15`, `CP-H73-API-16`, `BUG-H73-API-01`, `BUG-H73-API-09` | 🟡 Parcial (`BUG-H73-API-09` en baja lógica) |
| **CA-5:** El endpoint `GET /api/eventos-atp/recuperacion` debe soportar los filtros y responder bajo estándar H34. | Cumple en runtime HTTP, Kysely, RBAC, BD, OpenAPI, build, TypeScript, ESLint y Vitest; integridad global de baja lógica pendiente en endpoint `{id}`. | `CP-H73-API-01` a `CP-H73-API-18`, `BUG-H73-API-01` a `BUG-H73-API-09` | 🟢 Cumplido (listado) / 🔴 Bloqueado en detalle (`BUG-H73-API-09`) |

---

## 7. Dictamen Final de QA (Re-Test Ronda 2)

**Estado:** 🔴 **NO CONFORME PARA MERGE (`BUG-H73-API-09` ABIERTO)**

El equipo de desarrollo subsanó satisfactoriamente los 8 defectos reportados anteriormente (`BUG-H73-API-01` a `BUG-H73-API-08`), alcanzando compilación limpia (`build`, `tsc`, `eslint` con 0 errores) y 100% de pruebas unitarias aprobadas (**95/95 archivos, 1025/1025 tests**). Sin embargo, durante las pruebas de regresión sobre PostgreSQL se verificó la persistencia de **`BUG-H73-API-09`** en `GET /api/eventos-atp/recuperacion/{id}`, el cual retorna `HTTP 200 OK` para operativos marcados con `eliminado_en IS NOT NULL`. Se requiere añadir el filtro `.where("eliminado_en", "is", null)` en `buscarRecuperacionPorId` (`src/modules/eventos-atp/recuperacion.repository.ts`) y asegurar retorno `HTTP 404` cuando `obtenerRecuperacionDetallePorIdRepo` retorne `null` sin excepción antes de proceder con la certificación final.
