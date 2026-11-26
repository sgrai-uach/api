# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-39 — Enviar Informe Técnico de Verificación en Terreno y Cerrar Misión Inicial de Patrullaje (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones de Terreno y Verificación (`sgrai-api` — `POST /api/misiones/[id]/reporte`, `GET /api/misiones/[id]`, `GET /api/incidentes`, `GET /api/incidentes/[id]`).  
> **Historia de Usuario:** HU-39 — *"Como Patrulla verificadora Quiero enviar el informe técnico de verificación en terreno y cerrar la misión inicial de patrullaje. Para proveer a la central el diagnóstico consolidado de la emergencia para fundamentar el despacho de cuadrillas y finalizar la intervención de la patrulla."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h39-patrulla-enviar-reporte-cerrar`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86)`  
> * `feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)`  
> * `fix(misiones): habilitar lectura de detalle a personal de terreno y trazabilidad de evaluador`  
> * `docs(api): documentar contrato de reporte de verificacion y esquema actualizado (H39)`  
> * `docs (qa): documentar casos de prueba para HU-39`  
> * `merge: integrar develop en feature/h39-patrulla-enviar-reporte-cerrar`  
> * `fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)`  
>  
> **Fecha de Auditoría Inicial:** 24/11/2026 01:10.  
> **Fecha de Re-Test y Certificación Final:** 25/11/2026 01:06.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Backend Cumplidos — 5/5 Defectos Subsanados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la auditoría integral de **Re-Test** sobre la rama `feature/h39-patrulla-enviar-reporte-cerrar` —incluyendo revisión forense de los cambios de seguridad, autenticación JWT estricta, permisos RBAC, invariantes del Sistema de Comando de Incidentes (ICS), bloqueos pesimistas `.forUpdate("mision")`, integridad de evidencia fotográfica, validación de sincronización limpia frente a `origin/develop`, migraciones Kysely (`npm run db:migrate`), contrato OpenAPI 3.0 (`/openapi.json`), proyección Kanban (`GET /api/incidentes`), ejecución de suites automatizadas Vitest, chequeo estático TypeScript/ESLint, compilación de producción Next.js 16.3.4 y batería de pruebas en vivo sobre servidor activo (`PORT=3001`) con PostgreSQL 16 y broker Redis Pub/Sub (`sgrai:socket-events`)— se certifica el estado **APROBADO** al comprobarse la subsanación completa de los **5 defectos** detectados en la revisión inicial (`BUG-H39-API-01` a `BUG-H39-API-05`) sin regresiones funcionales.

### Verificación de Correcciones en Re-Test (25/11/2026 01:06)
1. **Bloqueo Pesimista e Invariantes ICS sin Bypass Horizontal (`BUG-H39-API-01` — Resuelto):** En `crearReporteVerificacionYCerrarMisionRepo` (`src/modules/misiones/mision.repository.ts:1280-1354`) se incorporó `.forUpdate("mision")` en el `SELECT` inicial dentro de la transacción, validación estricta de `tipo_mision === "VERIFICACION"` y `patrulla_id !== null`, validación de pertenencia incondicional para `!esAdmin`, verificación de patrulla activa (`patrulla_activo !== false`) en estado `'EN_VERIFICACION'` y protección de `incidente_estado IN ('REPORTADO', 'VERIFICANDO')`. Verificado en vivo con `HTTP 409 Conflict` sobre misiones `ATENCION_CUADRILLA` (`MIS-2026-0002`, preservando `EN_CURSO|EN_ATENCION`), `PREVENCION` (`MIS-PREV-2026-001`), patrulla inactiva (`activo = false`) e incidente en `EN_ATENCION`, además de concurrencia `Promise.all` (`[201, 409]`, `1` registro en PostgreSQL).
2. **Autenticación JWT Estricta y Contención RBAC (`BUG-H39-API-02` — Resuelto):** `POST /api/misiones/[id]/reporte` (`src/app/api/misiones/[id]/reporte/route.ts:43`) utiliza exclusivamente `exigirUsuarioId(request)` sin respaldo a `x-user-id`, rechazando con `HTTP 401 Unauthorized` intentos de suplantación con `x-user-id` (incluso UUID de `ADMIN`). La migración `056_reporte_verificacion_cierre_y_no_abordable.ts` retiró la asignación de `misiones:leer` a `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA` (y `asegurarColumnasHu38EnEsquema` ya no existe tras integrar `develop`). Verificado en vivo: `PATCH /api/patrullas/f1000000-0000-4000-8000-000000000020` con JWT de `PATRULLA_VERIFICADORA` retorna `HTTP 403 Forbidden`, mientras `GET /api/misiones/{id}` continúa respondiendo `HTTP 200 OK` mediante `misiones:terreno:verificar` / `reportes:crear`.
3. **Sincronización Limpia con `origin/develop`, Migraciones y Documentación (`BUG-H39-API-03` — Resuelto):** La rama integró `develop` (`merge: integrar develop en feature/h39-patrulla-enviar-reporte-cerrar`), obteniendo código de salida `0` (0 conflictos) en `git merge-tree --write-tree --name-only origin/develop HEAD`. Se eliminó `052_permiso_misiones_terreno_verificar.ts`, quedando `056_reporte_verificacion_cierre_y_no_abordable.ts` como única migración diferencial respecto a `develop`. Al ejecutar `npm run db:migrate` sobre base `develop`, `035_` reconcilió limpiamente a `051_`, se preservó `041_recuperacion_recurso_mision_id` y se aplicaron `053_`–`056_` y `072_evento_atp_base` (43 migraciones en `kysely_migration`). En `docs/api/misiones.md` se depuraron las secciones duplicadas dejando la numeración correlativa `3.1` a `3.9`.
4. **Protección Anti-IDOR en Adjuntos, Validación de URL Segura y Transacción Limpia (`BUG-H39-API-04` — Resuelto):** `AdjuntoReporteInputSchema` (`src/modules/misiones/mision.schema.ts:581-606`) exige `id` o `url` válida que cumpla `^(\/uploads\/[^\s]+|https?:\/\/[^\s]+)$`, rechazando objetos vacíos y esquemas inseguros (`javascript:alert(1)`) con `HTTP 400 Bad Request`. En `mision.repository.ts:1496-1540` se consulta primero la tabla `adjunto` rechazando con `404 Not Found` UUIDs inexistentes, `409 Conflict` adjuntos ya vinculados a otro reporte y `403 Forbidden` adjuntos libres pertenecientes a otro incidente (verificados los tres escenarios en vivo), además de eliminar los bloques `try/catch` silenciosos dentro de `db.transaction()`.
5. **Paridad GPS, Tolerancia a `null`, Contrato OpenAPI `BearerAuth` y Proyección Kanban (`BUG-H39-API-05` — Resuelto):** `CrearReporteVerificacionInputSchema` (`mision.schema.ts:647-770`) incorpora paridad obligatoria `latitud`/`longitud` (`400 Bad Request` ante coordenada huérfana) y `.nullable()` en `estado_terreno`, `personas_afectadas`, `latitud` y `longitud` (verificado en vivo con `HTTP 201` rescatando `personasAfectadas: 7` desde HU-38 y fijando `estadoTerreno: "FINALIZADO"`). En `GET /openapi.json` todas las operaciones referencian `BearerAuth` (`0` ocurrencias de `bearerAuth`), `GET /api/misiones/{id}` documenta los permisos de terreno en `403`, y `GET /api/incidentes` proyecta tanto `totalReportesTerreno` (`>= 1`) como `dictamenTerreno` (`"REQUIERE_CUADRILLA"` / `"NO_ABORDABLE"`).

| Métrica de Calidad | Auditoría Inicial (24/11/2026) | Re-Test Final (25/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | **25** | 5 Defectos Subsanados (`BUG-H39-API-01` a `05`) + 20 Casos Funcionales, RBAC, Validación Zod, Concurrencia, Tiempo Real y Contrato (`CP-H39-API-01` a `20`) |
| **Casos Aprobados / Corregidos** | **20** | **25** | 20 casos `APROBADO` + 5 defectos `CORREGIDO` en Re-Test (100% de cobertura verificada en backend) |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **0** | 5/5 defectos subsanados (2 críticos, 2 altos, 1 medio) |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Entorno integrado operativo (PostgreSQL 16 + PostGIS en puerto `5001`, Redis 7 en puerto `6001`) |
| **Tasa de Aprobación Global (% Pass)** | **80.0%** | **100.0%** | Cumplimiento total de los criterios de aceptación backend de HU-39 para merge hacia `develop` |
| **Suite Directa HU-39 + 056 + OpenAPI (Vitest)** | **23/23 tests pass** | **22/22 tests pass** | 6 archivos ejecutados en `1.12s` (`mision-reporte.schema.test.ts` ampliado a 9 tests y `mision-reporte.repository.test.ts` ampliado a 7 tests; `route.test.ts` focalizado en 1 test de JWT estricto) |
| **Suite del Módulo Misiones + OpenAPI (Vitest)** | **122/122 tests pass** | **155/155 tests pass** | 22 archivos ejecutados en `1.68s` sin fallos ni omisiones (incluye HU-69, HU-38 y HU-39 integradas) |
| **Suite Global del Repositorio (`npm test`)** | **907/907 tests pass** | **1031/1031 tests pass** | 99 archivos ejecutados en `9.36s` sin fallos ni omisiones |
| **Chequeo de Tipos (`npx tsc --noEmit`) y Build** | **0 errores** | **0 errores** | `npm run build` (Next.js 16.3.4 Turbopack) y `npx tsc --noEmit` finalizan con código de salida `0` |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errors / 1 warning** | **0 errors / 0 warnings** | Análisis estático limpio con código de salida `0` |
| **Sincronización con `origin/develop`** | 🔴 **Desfasada (10 conflictos)** | 🟢 **Limpia (0 conflictos)** | `git merge-tree --write-tree --name-only origin/develop HEAD` finaliza con `EXIT=0` y `npm run db:migrate` preserva 43/43 migraciones |

---

## 2. Registro Técnico de Defectos Subsanados

### `BUG-H39-API-01`: Bypass de Autorización Horizontal y de Invariantes ICS cuando `mision.patrulla_id` es `NULL` o `tipo_mision !== 'VERIFICACION'`, Sobrescritura Incondicional de `incidente.estado` y Ausencia de Bloqueo Pesimista (`.forUpdate("mision")`)
* **Severidad:** **CRÍTICA** (Brecha de Autorización Horizontal entre Unidades Operativas, Corrupción de Estados ICS y Concurrencia).
* **Estado Post Re-Test (25/11/2026 01:06):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 1280-1354).
* **Descripción Técnica del Defecto Inicial:**  
  En la implementación inicial, la validación de pertenencia omitía todo control cuando `mision.patrulla_id` era `NULL`, no exigía `tipo_mision === "VERIFICACION"`, carecía de `.forUpdate("mision")` en el `SELECT` inicial y no validaba que la patrulla estuviera activa en `EN_VERIFICACION` ni que el incidente estuviera en `REPORTADO` o `VERIFICANDO`, permitiendo que un patrullero cerrara misiones `ATENCION_CUADRILLA` o `PREVENCION` y sobreescribiera incidentes `EN_ATENCION` a `NO_ABORDABLE`.
* **Solución Aplicada y Verificada en Re-Test:**  
  1. Se añadió `.forUpdate("mision")` al `SELECT` inicial de `crearReporteVerificacionYCerrarMisionRepo`.
  2. Se incorporaron guardas explícitas que lanzan `ConflictError` (`HTTP 409`) si `tipo_mision !== "VERIFICACION" || !patrulla_id`, si `patrulla_activo === false || patrulla_estado !== "EN_VERIFICACION"` o si `incidente_estado` no pertenece a `['REPORTADO', 'VERIFICANDO']`.
  3. El control de pertenencia `if (!esAdmin)` se ejecuta de forma incondicional.
  4. Verificado en pruebas unitarias (`mision-reporte.repository.test.ts:223-288`) y en vivo sobre `MIS-2026-0002` (`ATENCION_CUADRILLA` → `409 Conflict`, preservando `EN_CURSO|EN_ATENCION` en PostgreSQL), `MIS-PREV-2026-001` (`PREVENCION` → `409 Conflict`), patrulla desactivada (`activo = false` → `409 Conflict`), incidente en `EN_ATENCION` (`409 Conflict`) y concurrencia real `Promise.all` (`[201, 409]`).

---

### `BUG-H39-API-02`: Bypass de Autenticación JWT mediante Cabecera `x-user-id` y Escalamiento de Privilegios RBAC al Asignar `misiones:leer` en Migración `056` (Permite Mutar Patrullas Ajenas vía `PATCH /api/patrullas/[id]`)
* **Severidad:** **CRÍTICA** (Seguridad / Suplantación de Identidad y Escalamiento de Privilegios RBAC).
* **Estado Post Re-Test (25/11/2026 01:05):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/app/api/misiones/[id]/reporte/route.ts` (Línea 43)
  * `src/lib/db/migrations/056_reporte_verificacion_cierre_y_no_abordable.ts` (Líneas 96-102)
  * `src/app/api/misiones/[id]/reporte/__tests__/route.test.ts` y `src/lib/db/migrations/__tests__/056_reporte_verificacion_cierre_y_no_abordable.test.ts`
* **Descripción Técnica del Defecto Inicial:**  
  `POST /api/misiones/[id]/reporte` aceptaba la cabecera sin firma `x-user-id` como respaldo de autenticación, y la migración `056` (junto al fallback en `prioridad.repository.ts`) otorgaba el permiso `misiones:leer` a `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`, habilitando la mutación de patrullas ajenas en `PATCH /api/patrullas/[id]`.
* **Solución Aplicada y Verificada en Re-Test:**  
  1. Se reemplazó `extraerUsuarioId` + `x-user-id` por `const usuarioId = await exigirUsuarioId(request);` en `src/app/api/misiones/[id]/reporte/route.ts:43`.
  2. Se retiró la inserción de `misiones:leer` en la migración `056` (verificado por test automatizado `expect(sqlEjecutado).not.toContain("misiones:leer")`) y se eliminó `asegurarColumnasHu38EnEsquema` tras la sincronización con `develop`.
  3. Verificado en vivo tras ejecutar `npm run db:migrate` sobre base `develop`: `POST /reporte` con `x-user-id` de `ADMIN` o `PATRULLA_VERIFICADORA` sin token Bearer responde `HTTP 401 Unauthorized`; `rol_permiso` mantiene `misiones:leer` exclusivamente en `ADMIN`, `ENCARGADO` y `SUPERVISOR`; `PATCH /api/patrullas/f1000000-0000-4000-8000-000000000020` con JWT de `PATRULLA_VERIFICADORA` responde `HTTP 403 Forbidden`, mientras `GET /api/misiones/{id}` mantiene `HTTP 200 OK` vía `misiones:terreno:verificar` / `reportes:crear`.

---

### `BUG-H39-API-03`: Desfase de Rama respecto a `origin/develop` (10 Conflictos), Colisión de Migración `052_permiso_misiones_terreno_verificar.ts` y Borrado de `041_` en `migrator.ts`
* **Severidad:** **ALTA** (Integración Continua, Integridad de Migraciones Kysely y Documentación Duplicada).
* **Estado Post Re-Test (25/11/2026 01:04):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/lib/db/migrations/` (eliminación de `052_permiso_misiones_terreno_verificar.ts`)
  * `src/lib/db/migrator.ts` (reconciliación segura sin eliminación destructiva de migraciones existentes)
  * `docs/api/misiones.md` (secciones `3.1` a `3.9` saneadas)
* **Descripción Técnica del Defecto Inicial:**  
  La rama presentaba 10 conflictos de fusión frente a `origin/develop`, duplicaba `052_permiso_misiones_terreno_verificar.ts` frente a `035_`/`051_`, eliminaba `041_recuperacion_recurso_mision_id` de `kysely_migration` al migrar y contenía secciones `3.5` y `3.6` duplicadas en `docs/api/misiones.md`.
* **Solución Aplicada y Verificada en Re-Test:**  
  1. Se fusionó `develop` en la rama resolviendo todos los conflictos (`git merge-tree --write-tree --name-only origin/develop HEAD` finaliza con `EXIT=0`).
  2. Se eliminó la migración duplicada `052_` y se verificó mediante `git ls-tree` que `056_reporte_verificacion_cierre_y_no_abordable.ts` es la única migración nueva respecto a `origin/develop`.
  3. Al ejecutar `npm run db:migrate` sobre base `develop`, `035_` se reconcilió a `051_`, `041_recuperacion_recurso_mision_id` se conservó intacta y se aplicaron exitosamente `053_`, `054_`, `055_`, `056_` y `072_evento_atp_base` (43 filas en `kysely_migration`).
  4. `docs/api/misiones.md` expone numeración única y continua desde `3.1` hasta `3.9` incluyendo HU-69 (`POST /api/misiones/{id}/rechazar`) y HU-39 (`POST /api/misiones/{id}/reporte`).

---

### `BUG-H39-API-04`: IDOR / Secuestro Cruzado de Adjuntos entre Incidentes en `adjuntoIds`, Silencio ante Adjuntos Inexistentes o Sin `url`, y Bloques `catch` Internos que Abortan la Transacción PostgreSQL (`25P02`)
* **Severidad:** **ALTA** (Seguridad IDOR en Evidencia Multimedia, Pérdida Silenciosa de Adjuntos y Robustez Transaccional).
* **Estado Post Re-Test (25/11/2026 01:06):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 1395-1409, 1496-1604, 1746-1753)
  * `src/modules/misiones/mision.schema.ts` (Líneas 581-606)
* **Descripción Técnica del Defecto Inicial:**  
  El repositorio actualizaba `adjunto` por `id IN (...)` sin comprobar existencia ni pertenencia al mismo `incidente_id` ni estado libre (`reporte_terreno_id IS NULL`), `AdjuntoReporteInputSchema` permitía objetos sin `id` ni `url` (descartados silenciosamente con `201`), y los bloques `try/catch` vacíos dentro de `db.transaction()` ocultaban errores SQL dejando transacciones abortadas (`25P02`).
* **Solución Aplicada y Verificada en Re-Test:**  
  1. `AdjuntoReporteInputSchema` aplica `.refine((a) => Boolean(a.id || (a.url && a.url.trim().length > 0)))` y valida `url` con `^(\/uploads\/[^\s]+|https?:\/\/[^\s]+)$/i`. Verificado en vivo con `HTTP 400 Bad Request` ante objeto vacío (`{"nombreArchivo":"foto_sin_url.jpg"}`) y ante protocolo inseguro (`javascript:alert(1)`).
  2. `crearReporteVerificacionYCerrarMisionRepo` consulta previamente los `adjuntoIds` y valida existencia (`NotFoundError` / `404`), disponibilidad (`reporte_terreno_id !== null` → `ConflictError` / `409`) y pertenencia al incidente (`incidente_id !== misionExistente.incidente_id` → `ForbiddenError` / `403`). Los tres escenarios y la vinculación válida de adjunto propio fueron verificados en vivo y en `mision-reporte.repository.test.ts`.
  3. Se eliminaron todos los `try/catch` silenciosos sobre consultas SQL dentro de `db.transaction()`.

---

### `BUG-H39-API-05`: Regresión de Paridad GPS (`latitud`/`longitud`) y Manejo de `null` en `CrearReporteVerificacionInputSchema`, Desalineación OpenAPI (`bearerAuth` vs `BearerAuth`, `403` de `GET /api/misiones/{id}`) y Campo `totalReportesTerreno` Siempre en `0` en Kanban
* **Severidad:** **MEDIA** (Validación de Contrato Zod, Especificación OpenAPI 3.0 y Proyección Kanban).
* **Estado Post Re-Test (25/11/2026 01:06):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.schema.ts` (Líneas 31-38, 647-770)
  * `src/lib/openapi/index.ts` (Líneas 1583, 1610, 3065, 3100)
  * `src/modules/incidentes/incidente-kanban.repository.ts` (Líneas 22, 164-179)
  * `src/modules/incidentes/incidente-kanban.schema.ts` (Líneas 107-113) y `incidente-kanban.service.ts` (Líneas 45-46)
* **Descripción Técnica del Defecto Inicial:**  
  `CrearReporteVerificacionInputSchema` admitía coordenadas GPS parciales y rechazaba `null` en opcionales; OpenAPI declaraba `bearerAuth` en lugar de `BearerAuth` y omitía permisos de terreno en el `403` de `GET /api/misiones/{id}`; y `GET /api/incidentes` devolvía `totalReportesTerreno: 0`.
* **Solución Aplicada y Verificada en Re-Test:**  
  1. Se añadió validación de paridad GPS en `superRefine` (`HTTP 400` verificado en vivo enviando solo `latitud` o solo `longitud`) y `.nullable()` en `estadoTerreno`/`estado_terreno`, `personasAfectadas`/`personas_afectadas`, `latitud` y `longitud` (verificado en vivo con `HTTP 201` rescatando `personasAfectadas: 7` desde HU-38 y fijando `estadoTerreno: "FINALIZADO"`).
  2. Se unificó `security: [{ BearerAuth: [] }]` en todo el spec OpenAPI (`0` ocurrencias de `bearerAuth` en `/openapi.json`) y se actualizó la descripción del `403` de `GET /api/misiones/{id}` incluyendo `misiones:leer, misiones:terreno:verificar o reportes:crear`.
  3. `GET /api/incidentes` proyecta en vivo `totalReportesTerreno: 1` y `dictamenTerreno: "REQUIERE_CUADRILLA"` (`INC-2026-9932`) / `"NO_ABORDABLE"` (`INC-2026-0002`), ambos declarados en el esquema OpenAPI de `IncidenteResumen`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H39-API-01` | Bypass de autorización horizontal e invariantes ICS con `patrulla_id` null o `tipo_mision !== 'VERIFICACION'`, sobrescritura de `incidente.estado` y falta de `.forUpdate("mision")` | Seguridad / Regla de Negocio ICS | Repositorio / Endpoint | Crítica | Misión `ATENCION_CUADRILLA` (`d1000000-...0002`, `patrulla_id = null`), `PREVENCION` (`50000000-...0001`), patrulla con `activo = false` e incidente en `EN_ATENCION` | `POST /api/misiones/{id}/reporte` con JWT de `PATRULLA_VERIFICADORA` sobre misiones `ATENCION_CUADRILLA`, `PREVENCION`, patrulla inactiva e incidente `EN_ATENCION` | Rechazo `HTTP 409 Conflict` preservando estados ICS y bloqueo `.forUpdate("mision")` en PostgreSQL | Retorna `HTTP 409 Conflict` en los 4 escenarios (`MIS-2026-0002` permanece `EN_CURSO` e `INC-2026-0004` en `EN_ATENCION`); `.forUpdate("mision")` verificado en PostgreSQL 16 y en tests unitarios | CORREGIDO | 24/11/2026 01:06 | 25/11/2026 01:06 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `BUG-H39-API-02` | Bypass de autenticación JWT mediante cabecera `x-user-id` y escalamiento RBAC por asignación de `misiones:leer` en migración `056` | Seguridad / Autenticación y RBAC | Route Handler / Migraciones | Crítica | Petición sin `Authorization: Bearer` enviando `x-user-id` (Admin/Patrulla) y migración `056` aplicada sobre base `develop` | `POST /api/misiones/247be4dd-.../reporte` con `x-user-id` y `PATCH /api/patrullas/f1000000-...0020` + `GET /api/misiones/247be4dd-...` con JWT de `pedro.patrulla@valdivia.cl` | `HTTP 401` sin JWT Bearer en `/reporte`, `HTTP 403` en `PATCH /api/patrullas/{id}` (sin `misiones:leer`) y `HTTP 200` en `GET /api/misiones/{id}` | `POST /reporte` con `x-user-id` retorna `HTTP 401 Unauthorized`, `PATCH /api/patrullas/{id}` retorna `HTTP 403 Forbidden`, `rol_permiso` excluye `misiones:leer` en roles de terreno y `GET /misiones/{id}` responde `HTTP 200 OK` | CORREGIDO | 24/11/2026 01:08 | 25/11/2026 01:05 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `BUG-H39-API-03` | Desfase con `origin/develop` (10 conflictos), colisión de migración `052_` vs `035_`/`051_`, eliminación de `041_` en `migrator.ts` y secciones duplicadas en `docs/api/misiones.md` | Integración / Base de Datos | Migraciones / Git / Docs | Alta | Rama `feature/h39-patrulla-enviar-reporte-cerrar` sincronizada con `origin/develop` y base `develop` previa a `056` | `git merge-tree --write-tree --name-only origin/develop HEAD`, `npm run db:migrate` e inspección de `kysely_migration` y `docs/api/misiones.md` | Fusión limpia (`EXIT=0`), `052_` eliminada, `041_` preservada, `053_`–`056_` y `072_` aplicadas y documentación sin encabezados duplicados | `git merge-tree` finaliza con `EXIT=0` (0 conflictos); `npm run db:migrate` reconcilia `035_ -> 051_`, preserva `041_` y aplica 43/43 migraciones; `docs/api/misiones.md` numerado limpiamente `3.1`–`3.9` | CORREGIDO | 24/11/2026 01:11 | 25/11/2026 01:04 | merge: integrar develop en feature/h39-patrulla-enviar-reporte-cerrar; fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `BUG-H39-API-04` | Secuestro cruzado (IDOR) de `adjuntoIds` entre incidentes, descarte silencioso de adjuntos inexistentes/sin `url` y `catch` internos que abortan transacción (`25P02`) | Seguridad / Integridad Transaccional | Repositorio / Schema | Alta | Misión `VERIFICACION` en `EN_CURSO` sometida a adjunto inexistente, adjunto ya vinculado, adjunto libre de otro incidente, objeto sin `url` y URL `javascript:` | `POST /api/misiones/{id}/reporte` con `adjuntoIds` inexistente, ya vinculado, de otro incidente, y `adjuntos` vacío / `javascript:alert(1)` | `404` ante inexistente, `409` ante ya vinculado, `403` ante IDOR de otro incidente, `400` ante objeto sin `url`/esquema inseguro y sin `catch` vacíos en transacción | Retorna `404 Not Found` (inexistente), `409 Conflict` (vinculado), `403 Forbidden` (otro incidente), `400 Bad Request` (vacío y `javascript:`), y `201 Created` con adjunto propio; `try/catch` internos eliminados | CORREGIDO | 24/11/2026 01:08 | 25/11/2026 01:06 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `BUG-H39-API-05` | Ausencia de paridad GPS (`latitud`/`longitud`) y tolerancia a `null` en Zod, esquema `bearerAuth` roto en OpenAPI y `totalReportesTerreno` siempre en `0` en Kanban | Validación / Contrato OpenAPI / Kanban | Schema / OpenAPI / Repo | Media | Payload con GPS parcial, payload con opcionales en `null`, consulta a `GET /openapi.json` y `GET /api/incidentes` | `POST /reporte` con solo `latitud` o solo `longitud`, con `personas_afectadas: null` / `estado_terreno: null`, `GET /openapi.json` y `GET /api/incidentes?busqueda=INC-2026-9932` | `400` ante GPS parcial, `201` con opcionales en `null` rescatando HU-38, OpenAPI con `BearerAuth` y `403` completo, Kanban con `totalReportesTerreno >= 1` y `dictamenTerreno` | GPS parcial retorna `400 Bad Request`; opcionales `null` retornan `201` (`personasAfectadas: 7`, `estadoTerreno: "FINALIZADO"`); `/openapi.json` tiene `0` `bearerAuth` y `BearerAuth` válido; Kanban retorna `totalReportesTerreno: 1` y `dictamenTerreno` | CORREGIDO | 24/11/2026 01:08 | 25/11/2026 01:06 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `CP-H39-API-01` | Envío exitoso de informe técnico con dictamen `REQUIERE_CUADRILLA`, Ficha FIBE y adjunto válido (`201 Created`) | Funcional / Positiva | Integración / Endpoint | Crítica | Misión `247be4dd-...` (`MIS-2026-0008`) en estado `EN_CURSO` con incidente `INC-2026-9932` en `VERIFICANDO` y JWT de `pedro.patrulla@valdivia.cl` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte` con `dictamen: "REQUIERE_CUADRILLA"`, `requiere_asistencia_social: true`, `adjuntos` con `url: "/uploads/evidencia/sumidero_colapsado.jpg"` y GPS completo | `HTTP 201 Created` creando `reporte_terreno` (`evaluador_id = usuario.id`), `mision.estado = "COMPLETADA"` con `fechaCierre`, `patrulla.estado = "DISPONIBLE"` e `incidente.requiereAsistenciaSocial = true` | `HTTP 201 Created` con `reporteTerreno`, `mision.estado: "COMPLETADA"`, `patrulla.estado: "DISPONIBLE"`, `incidente.estado: "VERIFICANDO"`, `requiereAsistenciaSocial: true` y adjunto persistido | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-02` | Envío exitoso con dictamen `NO_ABORDABLE` y `motivo_no_abordable >= 15` caracteres cerrando misión, liberando patrulla y cerrando incidente (`201 Created`) | Funcional / Positiva | Integración / Endpoint | Crítica | Misión `df7b5280-...` (`MIS-2026-0010`) en `EN_CURSO` con JWT de `loreto.patrulla@valdivia.cl` | `POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/reporte` con `dictamen: "NO_ABORDABLE"`, `motivo_no_abordable` de 97 caracteres y `personas_afectadas: 0` | `HTTP 201 Created` con `mision.estado = "COMPLETADA"`, `patrulla.estado = "DISPONIBLE"`, `incidente.estado = "NO_ABORDABLE"`, `fechaCierre` y `motivoNoAbordable` | `HTTP 201 Created` actualizando atómicamente `mision`, `patrulla` y `incidente` (`estado: "NO_ABORDABLE"`, `fechaCierre: "2026-11-25T04:05:33.398Z"`) | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-03` | Rescate automático de `personas_afectadas` desde el reporte previo de prioridad (HU-38) cuando se omite o es `null` en HU-39 | Funcional / Integración HU-38 | Integración / Repositorio | Alta | Misión `553b5ca5-...` (`MIS-2026-0013`) con reporte previo `EVALUACION_PRIORIDAD` (`personas_afectadas = 7`) | `POST /api/misiones/553b5ca5-7a6d-4ba1-bf03-531dfa2d0f2c/reporte` enviando `personas_afectadas: null` y `estado_terreno: null` | `reporteTerreno.personasAfectadas === 7`, `detallesEvaluacion.personasAfectadasPrevias === 7`, `personasAfectadasModificadas === false` y `versionReporte === 2` | `HTTP 201 Created` rescatando `personasAfectadas: 7`, `personasAfectadasPrevias: 7`, `personasAfectadasModificadas: false` y `versionReporte: 2` | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:06 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-04` | Rectificación de `personas_afectadas` respecto al valor previo de HU-38 con trazabilidad en `detalles_evaluacion` | Funcional / Integración HU-38 | Unitaria / Repositorio | Media | Reporte previo `EVALUACION_PRIORIDAD` con `personas_afectadas = 3` en mock de transacción | `crearReporteVerificacionYCerrarMisionRepo` con `personasAfectadas: 0` (`mision-reporte.repository.test.ts`) | Persiste `personas_afectadas: 0` y marca `personasAfectadasModificadas: true` manteniendo `personasAfectadasPrevias: 3` | Test unitario aprobado verificando `personas_afectadas: 0`, `personasAfectadasPrevias: 3` y `personasAfectadasModificadas: true` | APROBADO | 24/11/2026 01:09 | 25/11/2026 01:01 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-05` | Registro automático del hito `VERIFICACION_COMPLETADA` en `mision_hito` y proyección en `GET /api/misiones/{id}` (`bitacoraTiempos` y `evaluaciones`) | Funcional / Trazabilidad ICS | Integración / BD | Crítica | Misión `247be4dd-...` cerrada con informe técnico de verificación | `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` con JWT de `encargado@valdivia.cl` | `bitacoraTiempos` incluye `DESPACHADA`, `MISION_ACEPTADA` y `VERIFICACION_COMPLETADA`; `evaluaciones.reporteVerificacionEnviado === true` y `dictamenVerificacion === "REQUIERE_CUADRILLA"` | `HTTP 200 OK` exponiendo los 3 hitos cronológicos y `evaluaciones.reporteVerificacionEnviado: true` con `dictamenVerificacion: "REQUIERE_CUADRILLA"` | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:05 | fix(misiones): habilitar lectura de detalle a personal de terreno y trazabilidad de evaluador |
| `CP-H39-API-06` | Emisión de eventos WebSocket `mision:actualizada`, `incidente:actualizado`, `patrulla:actualizada` y `patrulla:liberada` en Redis Pub/Sub | Tiempo Real / Socket.io | Integración / Redis | Crítica | Broker Redis activo en `localhost:6001` y escucha en canal `sgrai:socket-events` | Suscripción a `sgrai:socket-events` durante `POST /api/misiones/{id}/reporte` para `REQUIERE_CUADRILLA` y `NO_ABORDABLE` | Emisión de `mision:actualizada` (`encargado`, `sala:encargados`, `supervisor`), `incidente:actualizado` (`sala:encargados`, `encargado`, `mapa`), `patrulla:actualizada` y `patrulla:liberada` | 19 eventos (`REQUIERE_CUADRILLA`) y 16 eventos (`NO_ABORDABLE`) recibidos en `sgrai:socket-events` incluyendo `incidente:actualizado` en las 3 salas | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-07` | Rechazo por ausencia total de credenciales de autenticación (`401 Unauthorized`) | Seguridad / Autenticación | Endpoint / Route Handler | Crítica | Petición sin `Authorization: Bearer` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte` sin cabeceras | `HTTP 401 Unauthorized` indicando cabecera requerida | `HTTP 401 Unauthorized`: `{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}` | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-08` | Rechazo RBAC para usuario sin permiso `reportes:crear` (`403 Forbidden`) | Seguridad / RBAC | Endpoint / Auth | Crítica | Usuario `carlos.miranda@valdivia.cl` (`CALL_CENTER`, sin `reportes:crear`) con JWT válido | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte` con `Authorization: Bearer <token_call_center>` | `HTTP 403 Forbidden` indicando ausencia del permiso `reportes:crear` | `HTTP 403 Forbidden`: `{"message":"No cuenta con el permiso requerido: reportes:crear"}` | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86) |
| `CP-H39-API-09` | Rechazo de autorización horizontal cuando un patrullero intenta cerrar una misión asignada a otra patrulla (`403 Forbidden`) | Seguridad / Autorización | Endpoint / Repositorio | Crítica | Misión `d1000000-...0001` (`patrulla_id` asignado a Costa-1) e invocación con JWT de `loreto.patrulla@valdivia.cl` | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte` con `Authorization: Bearer <token_loreto>` | `HTTP 403 Forbidden` impidiendo cerrar misión de otra patrulla | `HTTP 403 Forbidden`: `{"message":"No está autorizado para enviar el informe técnico ni cerrar una misión asignada a otra patrulla verificadora."}` | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-10` | Rechazo por parámetro de ruta `id` con formato UUID inválido y por cuerpo JSON malformado (`400 Bad Request`) | Validación / Robustez | Endpoint / Route Handler | Media | Petición autenticada con JWT y `id` inválido o body corrupto | `POST /api/misiones/no-es-uuid/reporte` y `POST /api/misiones/d1000000-.../reporte` con `-d '{malformed'` | `HTTP 400 Bad Request` para ambos casos | `HTTP 400 Bad Request` con mensajes `"El identificador de la misión proporcionado no es un UUID válido."` y `"El cuerpo de la petición no es un JSON válido."` | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-11` | Rechazo de validación Zod cuando `dictamen` es `NO_ABORDABLE` con `motivo_no_abordable < 15` chars y `resumen_tecnico < 10` chars (`400 Bad Request`) | Validación / Esquema Zod | Endpoint / Schema | Crítica | Petición autenticada con dictamen `NO_ABORDABLE` sin justificación suficiente | `POST /api/misiones/d1000000-.../reporte` con `{"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Corto","resumen_tecnico":"Corto"}` | `HTTP 400 Bad Request` reportando ambos errores de longitud mínima (`10` y `15` caracteres) | `HTTP 400 Bad Request` con `errors` detallando `resumen_tecnico` (>= 10) y `motivo_no_abordable` (>= 15) | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-12` | Rechazo cuando el identificador UUID de la misión no existe en base de datos (`404 Not Found`) | Funcional / Negativa | Endpoint / Repositorio | Alta | UUID inexistente en tabla `mision` | `POST /api/misiones/60000000-0000-4000-8000-000000000999/reporte` con payload válido | `HTTP 404 Not Found` | `HTTP 404 Not Found`: `{"message":"No se encontró ninguna misión con el identificador proporcionado."}` | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-13` | Rechazo cuando la misión aún se encuentra en estado `DESPACHADA` sin haber sido aceptada por la patrulla (`409 Conflict`) | Regla de Negocio ICS | Endpoint / Repositorio | Alta | Misión `247be4dd-...` en estado `DESPACHADA` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte` con JWT de `pedro.patrulla@valdivia.cl` | `HTTP 409 Conflict` exigiendo aceptación previa (`EN_CURSO`) | `HTTP 409 Conflict`: `{"message":"La patrulla debe aceptar la misión asignada antes de poder enviar el informe técnico de verificación."}` | APROBADO | 24/11/2026 01:06 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-14` | Idempotencia / bloqueo de reenvío cuando la misión ya fue cerrada (`COMPLETADA`) y control de concurrencia en doble envío simultáneo (`409 Conflict`) | Concurrencia / Idempotencia | Integración / Transacción | Crítica | Misión cerrada (`247be4dd-...`) y misión `EN_CURSO` (`3e2f1690-...`) sometida a 2 peticiones `Promise.all` con `.forUpdate("mision")` | `POST /reporte` posterior al cierre y 2 `POST /reporte` simultáneos con JWT de `ignacio.patrulla@valdivia.cl` | Exactamente 1 petición retorna `201 Created` (1 fila en `reporte_terreno`) y las restantes `409 Conflict` | Reenvío retorna `409`; `Promise.all` retorna `[201, 409]` con exactamente `1` reporte `VERIFICACION_CIERRE` en PostgreSQL | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-15` | Bloqueo de despacho de cuadrilla (`HU-21`) tras cierre `NO_ABORDABLE` y habilitación de despacho tras `REQUIERE_CUADRILLA` | Integración Inter-HU (HU-21) | Integración / Endpoint | Alta | Incidente `a1000000-...0002` cerrado como `NO_ABORDABLE` e incidente en `VERIFICANDO` evaluado | `POST /api/misiones` (`ATENCION_CUADRILLA`) con JWT de `encargado@valdivia.cl` sobre ambos incidentes | `409 Conflict` sobre `NO_ABORDABLE` y `201 Created` transicionando a `EN_ATENCION` sobre incidente apto | `409 Conflict` sobre `NO_ABORDABLE` y `201 Created` (`MIS-2026-0015`) sobre incidente verificado | APROBADO | 24/11/2026 01:09 | 25/11/2026 01:05 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-16` | Exposición de campos de cierre (`tipoReporte`, `dictamen`, `motivoNoAbordable`, `fechaCierre`, `ultimoReporte`) en `GET /api/incidentes/{id}` y `dictamenTerreno` en `GET /api/incidentes` | Funcional / Proyección | Integración / Servicio | Alta | Incidentes `INC-2026-9932` (`REQUIERE_CUADRILLA`) e `INC-2026-0002` (`NO_ABORDABLE`) con informes `VERIFICACION_CIERRE` | `GET /api/incidentes/dd7db71e-...`, `GET /api/incidentes?busqueda=INC-2026-9932` y `GET /api/incidentes?busqueda=INC-2026-0002` con JWT de `encargado@valdivia.cl` | `HTTP 200 OK` proyectando `ultimoReporte` en detalle y `totalReportesTerreno: 1` + `dictamenTerreno` en Kanban | `HTTP 200 OK` con `ultimoReporte` completo (`evaluadorNombre: "Pedro Valenzuela"`) y Kanban con `totalReportesTerreno: 1` y `dictamenTerreno: "REQUIERE_CUADRILLA"` / `"NO_ABORDABLE"` | APROBADO | 24/11/2026 01:08 | 25/11/2026 01:06 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `CP-H39-API-17` | Creación de columnas de cierre y dictamen (`incidente`, `reporte_terreno`), restricción `chk_reporte_terreno_dictamen` y permiso `reportes:crear` sin `misiones:leer` en Migración `056` | Base de Datos / Esquema | Migración / Tipos Kysely | Alta | Base `develop` limpia y migración `056_reporte_verificacion_cierre_y_no_abordable.ts` | `npm run db:migrate`, inspección de `rol_permiso` / `kysely_migration` y `056_...test.ts` | Columnas, constraint e índice creados; `reportes:crear` asignado a `ADMIN`, `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA` sin insertar `misiones:leer` | Migración `056` aplicada con código `0`, `rol_permiso` verificado limpio y `2/2` tests de migración aprobados | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:04 | feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86) |
| `CP-H39-API-18` | Resiliencia del servicio `enviarReporteVerificacionService` si falla la emisión WebSocket tras confirmar la transacción | Tolerancia a Fallos | Unitaria / Servicio | Media | Error en emisión Socket.io rodeado de `try/catch` en `mision.service.ts:685-751` | Revisión de `enviarReporteVerificacionService` y ejecución de `mision-reporte.service.test.ts` | El servicio captura excepciones de socket sin revertir el cierre persistido y retorna el DTO completo | `mision-reporte.service.test.ts` (`2/2` tests pass) y manejo `try/catch` no bloqueante verificado en `mision.service.ts:746-751` | APROBADO | 24/11/2026 01:09 | 25/11/2026 01:01 | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-19` | Validación de esquema Zod para alias `camelCase`/`snake_case`, `DictamenAtencionEnum`, `EstadoTerrenoVerificacionEnum`, paridad GPS, URLs de adjuntos y `personas_afectadas >= 0` | Validación / Contrato | Unitaria / Schema | Media | Esquema `CrearReporteVerificacionInputSchema` y `AdjuntoReporteInputSchema` | `npm test -- src/modules/misiones/__tests__/mision-reporte.schema.test.ts` | Acepta solo `'REQUIERE_CUADRILLA'` \| `'NO_ABORDABLE'`, exige resumen >= 10, motivo >= 15 en `NO_ABORDABLE`, paridad GPS, URLs seguras y opcionales `null` | `9/9` tests aprobados en `mision-reporte.schema.test.ts` | APROBADO | 24/11/2026 01:09 | 25/11/2026 01:01 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |
| `CP-H39-API-20` | Ejecución completa de suites Vitest, chequeo de tipos TypeScript, ESLint y compilación de producción Next.js | Automatización / Build | Unit / Build / TS | Alta | Código fuente de `feature/h39-patrulla-enviar-reporte-cerrar` tras correcciones | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | 100% de pruebas automatizadas aprobadas, compilación limpia y `0` errores TypeScript/ESLint | `1031/1031` tests pass (`99` archivos; `22/22` directos HU-39+056+OpenAPI; `155/155` Misiones+OpenAPI), `tsc` y `build` exit code `0`, `lint` `0 errors / 0 warnings` | APROBADO | 24/11/2026 01:09 | 25/11/2026 01:02 | fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H39-API-01	Bypass de autorización horizontal e invariantes ICS con patrulla_id null o tipo_mision !== 'VERIFICACION', sobrescritura de incidente.estado y falta de .forUpdate("mision")	Seguridad / Regla de Negocio ICS	Repositorio / Endpoint	Crítica	Misión ATENCION_CUADRILLA (d1000000-...0002, patrulla_id = null), PREVENCION (50000000-...0001), patrulla con activo = false e incidente en EN_ATENCION	POST /api/misiones/{id}/reporte con JWT de PATRULLA_VERIFICADORA sobre misiones ATENCION_CUADRILLA, PREVENCION, patrulla inactiva e incidente EN_ATENCION	Rechazo HTTP 409 Conflict preservando estados ICS y bloqueo .forUpdate("mision") en PostgreSQL	Retorna HTTP 409 Conflict en los 4 escenarios (MIS-2026-0002 permanece EN_CURSO e INC-2026-0004 en EN_ATENCION); .forUpdate("mision") verificado en PostgreSQL 16 y en tests unitarios	CORREGIDO	24/11/2026 01:06	25/11/2026 01:06	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
BUG-H39-API-02	Bypass de autenticación JWT mediante cabecera x-user-id y escalamiento RBAC por asignación de misiones:leer en migración 056	Seguridad / Autenticación y RBAC	Route Handler / Migraciones	Crítica	Petición sin Authorization: Bearer enviando x-user-id (Admin/Patrulla) y migración 056 aplicada sobre base develop	POST /api/misiones/247be4dd-.../reporte con x-user-id y PATCH /api/patrullas/f1000000-...0020 + GET /api/misiones/247be4dd-... con JWT de pedro.patrulla@valdivia.cl	HTTP 401 sin JWT Bearer en /reporte, HTTP 403 en PATCH /api/patrullas/{id} (sin misiones:leer) y HTTP 200 en GET /api/misiones/{id}	POST /reporte con x-user-id retorna HTTP 401 Unauthorized, PATCH /api/patrullas/{id} retorna HTTP 403 Forbidden, rol_permiso excluye misiones:leer en roles de terreno y GET /misiones/{id} responde HTTP 200 OK	CORREGIDO	24/11/2026 01:08	25/11/2026 01:05	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
BUG-H39-API-03	Desfase con origin/develop (10 conflictos), colisión de migración 052_ vs 035_/051_, eliminación de 041_ en migrator.ts y secciones duplicadas en docs/api/misiones.md	Integración / Base de Datos	Migraciones / Git / Docs	Alta	Rama feature/h39-patrulla-enviar-reporte-cerrar sincronizada con origin/develop y base develop previa a 056	git merge-tree --write-tree --name-only origin/develop HEAD, npm run db:migrate e inspección de kysely_migration y docs/api/misiones.md	Fusión limpia (EXIT=0), 052_ eliminada, 041_ preservada, 053_–056_ y 072_ aplicadas y documentación sin encabezados duplicados	git merge-tree finaliza con EXIT=0 (0 conflictos); npm run db:migrate reconcilia 035_ -> 051_, preserva 041_ y aplica 43/43 migraciones; docs/api/misiones.md numerado limpiamente 3.1–3.9	CORREGIDO	24/11/2026 01:11	25/11/2026 01:04	merge: integrar develop en feature/h39-patrulla-enviar-reporte-cerrar; fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
BUG-H39-API-04	Secuestro cruzado (IDOR) de adjuntoIds entre incidentes, descarte silencioso de adjuntos inexistentes/sin url y catch internos que abortan transacción (25P02)	Seguridad / Integridad Transaccional	Repositorio / Schema	Alta	Misión VERIFICACION en EN_CURSO sometida a adjunto inexistente, adjunto ya vinculado, adjunto libre de otro incidente, objeto sin url y URL javascript:	POST /api/misiones/{id}/reporte con adjuntoIds inexistente, ya vinculado, de otro incidente, y adjuntos vacío / javascript:alert(1)	404 ante inexistente, 409 ante ya vinculado, 403 ante IDOR de otro incidente, 400 ante objeto sin url/esquema inseguro y sin catch vacíos en transacción	Retorna 404 Not Found (inexistente), 409 Conflict (vinculado), 403 Forbidden (otro incidente), 400 Bad Request (vacío y javascript:), y 201 Created con adjunto propio; try/catch internos eliminados	CORREGIDO	24/11/2026 01:08	25/11/2026 01:06	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
BUG-H39-API-05	Ausencia de paridad GPS (latitud/longitud) y tolerancia a null en Zod, esquema bearerAuth roto en OpenAPI y totalReportesTerreno siempre en 0 en Kanban	Validación / Contrato OpenAPI / Kanban	Schema / OpenAPI / Repo	Media	Payload con GPS parcial, payload con opcionales en null, consulta a GET /openapi.json y GET /api/incidentes	POST /reporte con solo latitud o solo longitud, con personas_afectadas: null / estado_terreno: null, GET /openapi.json y GET /api/incidentes?busqueda=INC-2026-9932	400 ante GPS parcial, 201 con opcionales en null rescatando HU-38, OpenAPI con BearerAuth y 403 completo, Kanban con totalReportesTerreno >= 1 y dictamenTerreno	GPS parcial retorna 400 Bad Request; opcionales null retornan 201 (personasAfectadas: 7, estadoTerreno: "FINALIZADO"); /openapi.json tiene 0 bearerAuth y BearerAuth válido; Kanban retorna totalReportesTerreno: 1 y dictamenTerreno	CORREGIDO	24/11/2026 01:08	25/11/2026 01:06	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
CP-H39-API-01	Envío exitoso de informe técnico con dictamen REQUIERE_CUADRILLA, Ficha FIBE y adjunto válido (201 Created)	Funcional / Positiva	Integración / Endpoint	Crítica	Misión 247be4dd-... (MIS-2026-0008) en estado EN_CURSO con incidente INC-2026-9932 en VERIFICANDO y JWT de pedro.patrulla@valdivia.cl	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte con dictamen: "REQUIERE_CUADRILLA", requiere_asistencia_social: true, adjuntos con url: "/uploads/evidencia/sumidero_colapsado.jpg" y GPS completo	HTTP 201 Created creando reporte_terreno (evaluador_id = usuario.id), mision.estado = "COMPLETADA" con fechaCierre, patrulla.estado = "DISPONIBLE" e incidente.requiereAsistenciaSocial = true	HTTP 201 Created con reporteTerreno, mision.estado: "COMPLETADA", patrulla.estado: "DISPONIBLE", incidente.estado: "VERIFICANDO", requiereAsistenciaSocial: true y adjunto persistido	APROBADO	24/11/2026 01:08	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-02	Envío exitoso con dictamen NO_ABORDABLE y motivo_no_abordable >= 15 caracteres cerrando misión, liberando patrulla y cerrando incidente (201 Created)	Funcional / Positiva	Integración / Endpoint	Crítica	Misión df7b5280-... (MIS-2026-0010) en EN_CURSO con JWT de loreto.patrulla@valdivia.cl	POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/reporte con dictamen: "NO_ABORDABLE", motivo_no_abordable de 97 caracteres y personas_afectadas: 0	HTTP 201 Created con mision.estado = "COMPLETADA", patrulla.estado = "DISPONIBLE", incidente.estado = "NO_ABORDABLE", fechaCierre y motivoNoAbordable	HTTP 201 Created actualizando atómicamente mision, patrulla y incidente (estado: "NO_ABORDABLE", fechaCierre: "2026-11-25T04:05:33.398Z")	APROBADO	24/11/2026 01:08	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-03	Rescate automático de personas_afectadas desde el reporte previo de prioridad (HU-38) cuando se omite o es null en HU-39	Funcional / Integración HU-38	Integración / Repositorio	Alta	Misión 553b5ca5-... (MIS-2026-0013) con reporte previo EVALUACION_PRIORIDAD (personas_afectadas = 7)	POST /api/misiones/553b5ca5-7a6d-4ba1-bf03-531dfa2d0f2c/reporte enviando personas_afectadas: null y estado_terreno: null	reporteTerreno.personasAfectadas === 7, detallesEvaluacion.personasAfectadasPrevias === 7, personasAfectadasModificadas === false y versionReporte === 2	HTTP 201 Created rescatando personasAfectadas: 7, personasAfectadasPrevias: 7, personasAfectadasModificadas: false y versionReporte: 2	APROBADO	24/11/2026 01:08	25/11/2026 01:06	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-04	Rectificación de personas_afectadas respecto al valor previo de HU-38 con trazabilidad en detalles_evaluacion	Funcional / Integración HU-38	Unitaria / Repositorio	Media	Reporte previo EVALUACION_PRIORIDAD con personas_afectadas = 3 en mock de transacción	crearReporteVerificacionYCerrarMisionRepo con personasAfectadas: 0 (mision-reporte.repository.test.ts)	Persiste personas_afectadas: 0 y marca personasAfectadasModificadas: true manteniendo personasAfectadasPrevias: 3	Test unitario aprobado verificando personas_afectadas: 0, personasAfectadasPrevias: 3 y personasAfectadasModificadas: true	APROBADO	24/11/2026 01:09	25/11/2026 01:01	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-05	Registro automático del hito VERIFICACION_COMPLETADA en mision_hito y proyección en GET /api/misiones/{id} (bitacoraTiempos y evaluaciones)	Funcional / Trazabilidad ICS	Integración / BD	Crítica	Misión 247be4dd-... cerrada con informe técnico de verificación	GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02 con JWT de encargado@valdivia.cl	bitacoraTiempos incluye DESPACHADA, MISION_ACEPTADA y VERIFICACION_COMPLETADA; evaluaciones.reporteVerificacionEnviado === true y dictamenVerificacion === "REQUIERE_CUADRILLA"	HTTP 200 OK exponiendo los 3 hitos cronológicos y evaluaciones.reporteVerificacionEnviado: true con dictamenVerificacion: "REQUIERE_CUADRILLA"	APROBADO	24/11/2026 01:08	25/11/2026 01:05	fix(misiones): habilitar lectura de detalle a personal de terreno y trazabilidad de evaluador
CP-H39-API-06	Emisión de eventos WebSocket mision:actualizada, incidente:actualizado, patrulla:actualizada y patrulla:liberada en Redis Pub/Sub	Tiempo Real / Socket.io	Integración / Redis	Crítica	Broker Redis activo en localhost:6001 y escucha en canal sgrai:socket-events	Suscripción a sgrai:socket-events durante POST /api/misiones/{id}/reporte para REQUIERE_CUADRILLA y NO_ABORDABLE	Emisión de mision:actualizada (encargado, sala:encargados, supervisor), incidente:actualizado (sala:encargados, encargado, mapa), patrulla:actualizada y patrulla:liberada	19 eventos (REQUIERE_CUADRILLA) y 16 eventos (NO_ABORDABLE) recibidos en sgrai:socket-events incluyendo incidente:actualizado en las 3 salas	APROBADO	24/11/2026 01:08	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-07	Rechazo por ausencia total de credenciales de autenticación (401 Unauthorized)	Seguridad / Autenticación	Endpoint / Route Handler	Crítica	Petición sin Authorization: Bearer	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte sin cabeceras	HTTP 401 Unauthorized indicando cabecera requerida	HTTP 401 Unauthorized: {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-08	Rechazo RBAC para usuario sin permiso reportes:crear (403 Forbidden)	Seguridad / RBAC	Endpoint / Auth	Crítica	Usuario carlos.miranda@valdivia.cl (CALL_CENTER, sin reportes:crear) con JWT válido	POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte con Authorization: Bearer <token_call_center>	HTTP 403 Forbidden indicando ausencia del permiso reportes:crear	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: reportes:crear"}	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86)
CP-H39-API-09	Rechazo de autorización horizontal cuando un patrullero intenta cerrar una misión asignada a otra patrulla (403 Forbidden)	Seguridad / Autorización	Endpoint / Repositorio	Crítica	Misión d1000000-...0001 (patrulla_id asignado a Costa-1) e invocación con JWT de loreto.patrulla@valdivia.cl	POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte con Authorization: Bearer <token_loreto>	HTTP 403 Forbidden impidiendo cerrar misión de otra patrulla	HTTP 403 Forbidden: {"message":"No está autorizado para enviar el informe técnico ni cerrar una misión asignada a otra patrulla verificadora."}	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-10	Rechazo por parámetro de ruta id con formato UUID inválido y por cuerpo JSON malformado (400 Bad Request)	Validación / Robustez	Endpoint / Route Handler	Media	Petición autenticada con JWT y id inválido o body corrupto	POST /api/misiones/no-es-uuid/reporte y POST /api/misiones/d1000000-.../reporte con -d '{malformed'	HTTP 400 Bad Request para ambos casos	HTTP 400 Bad Request con mensajes "El identificador de la misión proporcionado no es un UUID válido." y "El cuerpo de la petición no es un JSON válido."	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-11	Rechazo de validación Zod cuando dictamen es NO_ABORDABLE con motivo_no_abordable < 15 chars y resumen_tecnico < 10 chars (400 Bad Request)	Validación / Esquema Zod	Endpoint / Schema	Crítica	Petición autenticada con dictamen NO_ABORDABLE sin justificación suficiente	POST /api/misiones/d1000000-.../reporte con {"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Corto","resumen_tecnico":"Corto"}	HTTP 400 Bad Request reportando ambos errores de longitud mínima (10 y 15 caracteres)	HTTP 400 Bad Request con errors detallando resumen_tecnico (>= 10) y motivo_no_abordable (>= 15)	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-12	Rechazo cuando el identificador UUID de la misión no existe en base de datos (404 Not Found)	Funcional / Negativa	Endpoint / Repositorio	Alta	UUID inexistente en tabla mision	POST /api/misiones/60000000-0000-4000-8000-000000000999/reporte con payload válido	HTTP 404 Not Found	HTTP 404 Not Found: {"message":"No se encontró ninguna misión con el identificador proporcionado."}	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-13	Rechazo cuando la misión aún se encuentra en estado DESPACHADA sin haber sido aceptada por la patrulla (409 Conflict)	Regla de Negocio ICS	Endpoint / Repositorio	Alta	Misión 247be4dd-... en estado DESPACHADA	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte con JWT de pedro.patrulla@valdivia.cl	HTTP 409 Conflict exigiendo aceptación previa (EN_CURSO)	HTTP 409 Conflict: {"message":"La patrulla debe aceptar la misión asignada antes de poder enviar el informe técnico de verificación."}	APROBADO	24/11/2026 01:06	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-14	Idempotencia / bloqueo de reenvío cuando la misión ya fue cerrada (COMPLETADA) y control de concurrencia en doble envío simultáneo (409 Conflict)	Concurrencia / Idempotencia	Integración / Transacción	Crítica	Misión cerrada (247be4dd-...) y misión EN_CURSO (3e2f1690-...) sometida a 2 peticiones Promise.all con .forUpdate("mision")	POST /reporte posterior al cierre y 2 POST /reporte simultáneos con JWT de ignacio.patrulla@valdivia.cl	Exactamente 1 petición retorna 201 Created (1 fila en reporte_terreno) y las restantes 409 Conflict	Reenvío retorna 409; Promise.all retorna [201, 409] con exactamente 1 reporte VERIFICACION_CIERRE en PostgreSQL	APROBADO	24/11/2026 01:08	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-15	Bloqueo de despacho de cuadrilla (HU-21) tras cierre NO_ABORDABLE y habilitación de despacho tras REQUIERE_CUADRILLA	Integración Inter-HU (HU-21)	Integración / Endpoint	Alta	Incidente a1000000-...0002 cerrado como NO_ABORDABLE e incidente en VERIFICANDO evaluado	POST /api/misiones (ATENCION_CUADRILLA) con JWT de encargado@valdivia.cl sobre ambos incidentes	409 Conflict sobre NO_ABORDABLE y 201 Created transicionando a EN_ATENCION sobre incidente apto	409 Conflict sobre NO_ABORDABLE y 201 Created (MIS-2026-0015) sobre incidente verificado	APROBADO	24/11/2026 01:09	25/11/2026 01:05	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-16	Exposición de campos de cierre (tipoReporte, dictamen, motivoNoAbordable, fechaCierre, ultimoReporte) en GET /api/incidentes/{id} y dictamenTerreno en GET /api/incidentes	Funcional / Proyección	Integración / Servicio	Alta	Incidentes INC-2026-9932 (REQUIERE_CUADRILLA) e INC-2026-0002 (NO_ABORDABLE) con informes VERIFICACION_CIERRE	GET /api/incidentes/dd7db71e-..., GET /api/incidentes?busqueda=INC-2026-9932 y GET /api/incidentes?busqueda=INC-2026-0002 con JWT de encargado@valdivia.cl	HTTP 200 OK proyectando ultimoReporte en detalle y totalReportesTerreno: 1 + dictamenTerreno en Kanban	HTTP 200 OK con ultimoReporte completo (evaluadorNombre: "Pedro Valenzuela") y Kanban con totalReportesTerreno: 1 y dictamenTerreno: "REQUIERE_CUADRILLA" / "NO_ABORDABLE"	APROBADO	24/11/2026 01:08	25/11/2026 01:06	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
CP-H39-API-17	Creación de columnas de cierre y dictamen (incidente, reporte_terreno), restricción chk_reporte_terreno_dictamen y permiso reportes:crear sin misiones:leer en Migración 056	Base de Datos / Esquema	Migración / Tipos Kysely	Alta	Base develop limpia y migración 056_reporte_verificacion_cierre_y_no_abordable.ts	npm run db:migrate, inspección de rol_permiso / kysely_migration y 056_...test.ts	Columnas, constraint e índice creados; reportes:crear asignado a ADMIN, PATRULLA_VERIFICADORA y DELEGADO_CUADRILLA sin insertar misiones:leer	Migración 056 aplicada con código 0, rol_permiso verificado limpio y 2/2 tests de migración aprobados	APROBADO	24/11/2026 01:05	25/11/2026 01:04	feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86)
CP-H39-API-18	Resiliencia del servicio enviarReporteVerificacionService si falla la emisión WebSocket tras confirmar la transacción	Tolerancia a Fallos	Unitaria / Servicio	Media	Error en emisión Socket.io rodeado de try/catch en mision.service.ts:685-751	Revisión de enviarReporteVerificacionService y ejecución de mision-reporte.service.test.ts	El servicio captura excepciones de socket sin revertir el cierre persistido y retorna el DTO completo	mision-reporte.service.test.ts (2/2 tests pass) y manejo try/catch no bloqueante verificado en mision.service.ts:746-751	APROBADO	24/11/2026 01:09	25/11/2026 01:01	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-19	Validación de esquema Zod para alias camelCase/snake_case, DictamenAtencionEnum, EstadoTerrenoVerificacionEnum, paridad GPS, URLs de adjuntos y personas_afectadas >= 0	Validación / Contrato	Unitaria / Schema	Media	Esquema CrearReporteVerificacionInputSchema y AdjuntoReporteInputSchema	npm test -- src/modules/misiones/__tests__/mision-reporte.schema.test.ts	Acepta solo 'REQUIERE_CUADRILLA' | 'NO_ABORDABLE', exige resumen >= 10, motivo >= 15 en NO_ABORDABLE, paridad GPS, URLs seguras y opcionales null	9/9 tests aprobados en mision-reporte.schema.test.ts	APROBADO	24/11/2026 01:09	25/11/2026 01:01	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
CP-H39-API-20	Ejecución completa de suites Vitest, chequeo de tipos TypeScript, ESLint y compilación de producción Next.js	Automatización / Build	Unit / Build / TS	Alta	Código fuente de feature/h39-patrulla-enviar-reporte-cerrar tras correcciones	npm test, npx tsc --noEmit, npm run lint, npm run build	100% de pruebas automatizadas aprobadas, compilación limpia y 0 errores TypeScript/ESLint	1031/1031 tests pass (99 archivos; 22/22 directos HU-39+056+OpenAPI; 155/155 Misiones+OpenAPI), tsc y build exit code 0, lint 0 errors / 0 warnings	APROBADO	24/11/2026 01:09	25/11/2026 01:02	fix(misiones): resolver observaciones QA H39 (seguridad, invariantes ICS, adjuntos, OpenAPI y dictamen Kanban)
```

---

## 5. Guía de Ejecución Replicable Paso a Paso y Evidencias (Re-Test)

### 5.1 Ejecución de Pruebas Automatizadas (Vitest), TypeScript, ESLint y Build (`CP-H39-API-04`, `18`, `19`, `20`)

```bash
# 1. Pruebas directas HU-39, Migración 056 y Contrato OpenAPI
npm test -- \
  src/app/api/misiones/[id]/reporte/__tests__/route.test.ts \
  src/modules/misiones/__tests__/mision-reporte.schema.test.ts \
  src/modules/misiones/__tests__/mision-reporte.service.test.ts \
  src/modules/misiones/__tests__/mision-reporte.repository.test.ts \
  src/lib/db/migrations/__tests__/056_reporte_verificacion_cierre_y_no_abordable.test.ts \
  src/app/openapi.json/__tests__/route.test.ts

# 2. Suite del módulo Misiones + OpenAPI y suite global
npm test -- src/app/api/misiones/ src/modules/misiones/ src/app/openapi.json/
npm test

# 3. Compilación limpia Next.js, chequeo de tipos TypeScript y ESLint
npm run build
npx tsc --noEmit
npm run lint
```

**Salidas observadas en Re-Test (25/11/2026):**
```text
# Directas HU-39 + Migración 056 + OpenAPI
 ✓ src/lib/db/migrations/__tests__/056_reporte_verificacion_cierre_y_no_abordable.test.ts (2 tests)
 ✓ src/modules/misiones/__tests__/mision-reporte.schema.test.ts (9 tests)
 ✓ src/app/api/misiones/[id]/reporte/__tests__/route.test.ts (1 test)
 ✓ src/modules/misiones/__tests__/mision-reporte.repository.test.ts (7 tests)
 ✓ src/modules/misiones/__tests__/mision-reporte.service.test.ts (2 tests)
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test)
 Test Files  6 passed (6) | Tests  22 passed (22) | Duration 1.12s

# Módulo Misiones + OpenAPI
 Test Files  22 passed (22) | Tests  155 passed (155) | Duration 1.68s

# Suite Global
 Test Files  99 passed (99) | Tests  1031 passed (1031) | Duration 9.36s

npm run build    -> ✓ Compiled successfully in 6.6s (Next.js 16.3.4 Turbopack)
npx tsc --noEmit -> exit code 0
npm run lint     -> exit code 0 (0 errors, 0 warnings)
```

---

### 5.2 Verificación de Migraciones Kysely, RBAC y Sincronización con `origin/develop` (`BUG-H39-API-02`, `BUG-H39-API-03`, `CP-H39-API-17`)

```bash
git merge-tree --write-tree --name-only origin/develop HEAD
npm run db:migrate
docker exec grupo1_postgres psql -U sgrai -d sgrai -c "SELECT name FROM kysely_migration ORDER BY name;"
docker exec grupo1_postgres psql -U sgrai -d sgrai -c "SELECT r.codigo AS rol, p.codigo AS permiso FROM rol_permiso rp JOIN rol r ON r.id=rp.rol_id JOIN permiso p ON p.id=rp.permiso_id WHERE p.codigo IN ('misiones:leer', 'reportes:crear', 'misiones:terreno:verificar') ORDER BY p.codigo, r.codigo;"
```

**Evidencia observada en Re-Test:**
```text
git merge-tree --write-tree --name-only origin/develop HEAD -> EXIT=0 (0 conflictos)

[RECONCILIACIÓN] Migración renumerada actualizada en kysely_migration: "035_permiso_misiones_terreno_verificar" -> "051_permiso_misiones_terreno_verificar"
[OK] Migración Kysely ejecutada con éxito: "053_incidente_prioridad_y_evaluacion_terreno"
[OK] Migración Kysely ejecutada con éxito: "054_resync_titulo_mision_verificacion"
[OK] Migración Kysely ejecutada con éxito: "055_mision_hito_metadatos"
[OK] Migración Kysely ejecutada con éxito: "056_reporte_verificacion_cierre_y_no_abordable"
[OK] Migración Kysely ejecutada con éxito: "072_evento_atp_base"
Todas las migraciones se completaron correctamente. (43 migraciones, 041_recuperacion_recurso_mision_id preservada)

          rol          |          permiso
-----------------------+----------------------------
 ADMIN                 | misiones:leer
 ENCARGADO             | misiones:leer
 SUPERVISOR            | misiones:leer
 ADMIN                 | misiones:terreno:verificar
 PATRULLA_VERIFICADORA | misiones:terreno:verificar
 ADMIN                 | reportes:crear
 DELEGADO_CUADRILLA    | reportes:crear
 PATRULLA_VERIFICADORA | reportes:crear
```

---

### 5.3 Casos Replicables mediante cURL y Respuestas HTTP/JSON Observadas en Re-Test

#### 1. Autenticación de Usuarios de Prueba (`POST /api/seguridad/login`)
```bash
TOKEN_PEDRO=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token // .token')

TOKEN_LORETO=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"loreto.patrulla@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token // .token')

TOKEN_MATIAS=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"matias.patrulla@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token // .token')

TOKEN_ENCARGADO=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token // .token')

TOKEN_CALLCENTER=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"carlos.miranda@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token // .token')
```

#### 2. Verificación de Correcciones de Seguridad, ICS, Adjuntos, GPS y OpenAPI (`BUG-H39-API-01`, `02`, `04`, `05`)
```bash
# BUG-H39-API-02: Rechazo de cabecera plana x-user-id sin JWT (401)
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Intento de suplantacion Admin via x-user-id"}'

# BUG-H39-API-02: Contención RBAC en PATCH /api/patrullas/{id} (403) y acceso operativo en GET /api/misiones/{id} (200)
curl -s -i -X PATCH "http://localhost:3001/api/patrullas/f1000000-0000-4000-8000-000000000020" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"estado":"NO_DISPONIBLE"}'

curl -s -i -X GET "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02" \
  -H "Authorization: Bearer $TOKEN_PEDRO"

# BUG-H39-API-01: Rechazo 409 sobre misión ATENCION_CUADRILLA y PREVENCION (patrulla_id=NULL)
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000002/reporte" \
  -H "Authorization: Bearer $TOKEN_LORETO" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Intento de cierre sobre mision de cuadrilla ajena","resumen_tecnico":"Prueba de bypass horizontal sobre mision sin patrulla"}'

curl -s -i -X POST "http://localhost:3001/api/misiones/50000000-0000-4000-8000-000000000001/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Intento de cierre sobre mision de prevencion sin patrulla","resumen_tecnico":"Prueba de bypass sobre mision PREVENCION"}'

# BUG-H39-API-04: Rechazo de adjunto vacío (400), URL insegura (400), UUID inexistente (404), ya vinculado (409) y otro incidente (403)
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Prueba adjunto con protocolo inseguro","adjuntos":[{"nombreArchivo":"xss.jpg","url":"javascript:alert(1)"}]}'

curl -s -i -X POST "http://localhost:3001/api/misiones/d980eb79-4d8a-441a-8765-6c9e984914d9/reporte" \
  -H "Authorization: Bearer $TOKEN_MATIAS" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Prueba adjunto UUID inexistente","adjuntoIds":["99999999-9999-4999-8999-999999999999"]}'

# BUG-H39-API-05: Paridad GPS (400), OpenAPI BearerAuth y proyección Kanban
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Prueba coordenada GPS huerfana sin longitud","latitud":-39.819588}'

curl -s http://localhost:3001/openapi.json | jq '{securitySchemes: (.components.securitySchemes | keys), reporteSecurity: .paths["/api/misiones/{id}/reporte"].post.security, misionGet403: .paths["/api/misiones/{id}"].get.responses["403"].description}'
```

**Respuestas HTTP/JSON observadas en Re-Test:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: misiones:leer"}

HTTP/1.1 409 Conflict
{"message":"La misión indicada no corresponde a una verificación con patrulla asignada."}

HTTP/1.1 409 Conflict
{"message":"La patrulla verificadora asignada no se encuentra activa o en estado 'EN_VERIFICACION'."}

HTTP/1.1 409 Conflict
{"message":"El incidente asociado no puede cerrarse por verificación porque su estado actual es 'EN_ATENCION'."}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el informe técnico de verificación en terreno.","errors":[{"campo":"adjuntos.0.url","mensaje":"La URL del adjunto debe iniciar con '/uploads/' o 'http(s)://'."}]}

HTTP/1.1 404 Not Found
{"message":"El adjunto '99999999-9999-4999-8999-999999999999' no existe en el sistema."}

HTTP/1.1 409 Conflict
{"message":"El adjunto 'a298b4d4-037c-42f9-b681-d4c5b05462c9' ya se encuentra vinculado a otro reporte de terreno."}

HTTP/1.1 403 Forbidden
{"message":"El adjunto '154d5cdd-64da-4bd4-974a-d58ad8eff382' pertenece a otro incidente y no puede vincularse a esta misión."}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el informe técnico de verificación en terreno.","errors":[{"campo":"longitud","mensaje":"Debe proporcionar tanto 'latitud' como 'longitud' en conjunto, o omitir ambas coordenadas GPS."}]}
```
```json
{
  "securitySchemes": ["BearerAuth"],
  "reporteSecurity": [{ "BearerAuth": [] }],
  "misionGet403": "No cuenta con ninguno de los permisos requeridos: misiones:leer, misiones:terreno:verificar o reportes:crear"
}
```

#### 3. Flujo Completo `REQUIERE_CUADRILLA` + Ficha FIBE + Adjunto + Redis Pub/Sub + Kanban (`CP-H39-API-01`, `03`, `05`, `06`, `16`)
```bash
# 1. Aceptar misión MIS-2026-0008 (HU-36)
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588,"longitud":-73.245209}'

# 2. Enviar informe técnico consolidado y cerrar misión (HU-39)
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{
    "dictamen": "REQUIERE_CUADRILLA",
    "resumen_tecnico": "Se constata colapso total de sumidero y anegamiento de primer piso en dos viviendas.",
    "estado_terreno": "CRITICO",
    "danos_estimados": "Daño en pisos, mobiliario y enseres básicos.",
    "observaciones": "Acceso habilitado por calle paralela para camión vactor.",
    "acciones_realizadas": "Señalización preventiva y entrevista con residentes.",
    "requiere_asistencia_social": true,
    "adjuntos": [{
      "nombreArchivo": "sumidero_colapsado.jpg",
      "url": "/uploads/evidencia/sumidero_colapsado.jpg",
      "tipoMime": "image/jpeg",
      "tamanoBytes": 345120
    }],
    "latitud": -39.819588,
    "longitud": -73.245209
  }'

# 3. Verificar proyección Kanban y detalle en Centro de Mando
curl -s -X GET "http://localhost:3001/api/incidentes?busqueda=INC-2026-9932" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO" | jq '.data[0] | {codigo, estado, totalReportesTerreno, dictamenTerreno, requiereAsistenciaSocial}'

curl -s -X GET "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO" | jq '.data | {hitos: [.bitacoraTiempos[].hito], evaluaciones}'
```

**Respuestas observadas en Re-Test:**
```json
{
  "codigo": "INC-2026-9932",
  "estado": "VERIFICANDO",
  "totalReportesTerreno": 1,
  "dictamenTerreno": "REQUIERE_CUADRILLA",
  "requiereAsistenciaSocial": true
}
```
```json
{
  "hitos": ["DESPACHADA", "MISION_ACEPTADA", "VERIFICACION_COMPLETADA"],
  "evaluaciones": {
    "reporteVerificacionEnviado": true,
    "dictamenVerificacion": "REQUIERE_CUADRILLA"
  }
}
```

#### 4. Flujo `NO_ABORDABLE`, Rescate HU-38 con Opcionales en `null` e Integración HU-21 (`CP-H39-API-02`, `03`, `14`, `15`)
```bash
# Cierre fundado NO_ABORDABLE (201 Created)
curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/reporte" \
  -H "Authorization: Bearer $TOKEN_LORETO" \
  -H "Content-Type: application/json" \
  -d '{
    "dictamen": "NO_ABORDABLE",
    "motivo_no_abordable": "Emergencia emplazada al interior de predio privado cercado sin acceso ni riesgo a vía pública.",
    "resumen_tecnico": "Inspección visual perimetral confirma ausencia de afectación municipal.",
    "estado_terreno": "INACCESIBLE",
    "personas_afectadas": 0,
    "requiere_asistencia_social": false
  }'

# Proyección Kanban del incidente NO_ABORDABLE
curl -s -X GET "http://localhost:3001/api/incidentes?busqueda=INC-2026-0002" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO" | jq '.data[0] | {codigo, estado, totalReportesTerreno, dictamenTerreno, motivoNoAbordable}'

# Rescate de personas_afectadas desde HU-38 con opcionales en null (201 Created)
curl -s -i -X POST "http://localhost:3001/api/misiones/553b5ca5-7a6d-4ba1-bf03-531dfa2d0f2c/reporte" \
  -H "Authorization: Bearer $TOKEN_MATIAS" \
  -H "Content-Type: application/json" \
  -d '{
    "dictamen": "REQUIERE_CUADRILLA",
    "resumen_tecnico": "Prueba de campos opcionales nulos con rescate HU-38 y adjunto propio.",
    "estado_terreno": null,
    "personas_afectadas": null,
    "latitud": null,
    "longitud": null,
    "requiere_asistencia_social": true
  }'
```

**Respuestas observadas en Re-Test:**
```json
{
  "codigo": "INC-2026-0002",
  "estado": "NO_ABORDABLE",
  "totalReportesTerreno": 1,
  "dictamenTerreno": "NO_ABORDABLE",
  "motivoNoAbordable": "Emergencia emplazada al interior de predio privado cercado sin acceso ni riesgo a vía pública."
}
```
```text
Eventos en canal Redis sgrai:socket-events (NO_ABORDABLE — 16 mensajes):
- mision:actualizada    -> salas ["encargado", "sala:encargados", "supervisor"]
- incidente:actualizado -> salas ["sala:encargados", "encargado", "mapa"]
- patrulla:actualizada  -> salas ["encargado", "sala:encargados", "supervisor", "mapa", "patrulla:f1000000-...0020"]
- patrulla:liberada     -> salas ["encargado", "sala:encargados", "supervisor", "mapa", "patrulla:f1000000-...0020"]

Concurrencia Promise.all sobre MIS-2026-0011 (.forUpdate("mision")):
- Estados HTTP: [201, 409]
- Filas en reporte_terreno (tipo_reporte = 'VERIFICACION_CIERRE'): 1
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La PWA debe proveer un formulario de reporte técnico de verificación accesible para la patrulla. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz en el repositorio `sgrai-pwa`. |
| **CA-2:** El formulario en la PWA debe incorporar el selector de dictamen operativo: `Dictamen de Atención: ['REQUIERE_CUADRILLA', 'NO_ABORDABLE']`. | `CP-H39-API-01`, `CP-H39-API-02`, `CP-H39-API-19` | 🟢 **CUMPLIDO** | `DictamenAtencionEnum` valida estrictamente `'REQUIERE_CUADRILLA'` y `'NO_ABORDABLE'` en esquema Zod, constraint SQL `chk_reporte_terreno_dictamen` y proyección Kanban `dictamenTerreno`. |
| **CA-3:** Si selecciona `NO_ABORDABLE`, exige `motivo_no_abordable` (mín. 15 caracteres) y ejecuta transacción atómica: persiste reporte, `mision = COMPLETADA`, `patrulla = DISPONIBLE`, `incidente = NO_ABORDABLE` con `fecha_cierre` y motivo, emitiendo `incidente:actualizado`. | `CP-H39-API-02`, `CP-H39-API-06`, `CP-H39-API-11`, `CP-H39-API-15`, `BUG-H39-API-01` | 🟢 **CUMPLIDO** | Verificado en PostgreSQL y Redis; invariantes ICS reforzadas exigiendo `tipo_mision === 'VERIFICACION'`, `patrulla_id !== null`, patrulla activa en `EN_VERIFICACION` e incidente en `REPORTADO`/`VERIFICANDO`. |
| **CA-4:** Capturar `resumen_tecnico` (obligatorio, mín. 10 caracteres), `estado_terreno`, `personas_afectadas`, `danos_estimados`, observaciones y casilla `requiere_asistencia_social`. | `CP-H39-API-01`, `CP-H39-API-03`, `CP-H39-API-04`, `CP-H39-API-11`, `CP-H39-API-19`, `BUG-H39-API-05` | 🟢 **CUMPLIDO** | Validaciones Zod completas incluyendo paridad GPS (`latitud`/`longitud`), tolerancia a `null` en opcionales y rescate automático de `personas_afectadas` desde HU-38. |
| **CA-5:** Transacción atómica al cerrar: crear `reporte_terreno` con `evaluador_id = usuario.id`, actualizar `mision.estado = 'COMPLETADA'` con `fecha_cierre`, actualizar `incidente.requiere_asistencia_social = true` si aplica y registrar hito en `mision_hito`. | `CP-H39-API-01`, `CP-H39-API-05`, `CP-H39-API-14`, `CP-H39-API-17`, `BUG-H39-API-01`, `BUG-H39-API-04` | 🟢 **CUMPLIDO** | Transacción ACID protegida con `.forUpdate("mision")`, sin `try/catch` silenciosos internos, validada bajo concurrencia `Promise.all` (`[201, 409]`). |
| **CA-6:** Debe permitir adjuntar fotografías como evidencia técnica (integrándose con H43). | `CP-H39-API-01`, `BUG-H39-API-04` | 🟢 **CUMPLIDO** | Soporta `adjuntoIds` y `adjuntos` vinculados a `adjunto.reporte_terreno_id`, con validación anti-IDOR (`403`/`404`/`409`) y filtro estricto de URLs seguras (`/uploads/...` o `http(s)://`). |
| **CA-7:** El sistema debe emitir la notificación WebSocket `mision:actualizada` e `incidente:actualizado` al Centro de Mando. | `CP-H39-API-06`, `CP-H39-API-18` | 🟢 **CUMPLIDO** | Verificado en vivo en canal Redis `sgrai:socket-events` emitiendo `mision:actualizada`, `incidente:actualizado`, `patrulla:actualizada` y `patrulla:liberada` con manejo de fallos no bloqueante. |
| **CA-8:** La PWA debe notificar el éxito del envío y regresar a la pantalla de espera de nuevas asignaciones. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz en el repositorio `sgrai-pwa`. |
| **CA-9:** El endpoint debe requerir el permiso RBAC `reportes:crear`. | `CP-H39-API-07`, `CP-H39-API-08`, `CP-H39-API-09`, `CP-H39-API-17`, `BUG-H39-API-02` | 🟢 **CUMPLIDO** | Autenticación JWT Bearer estricta vía `exigirUsuarioId(request)`, verificación de permiso `reportes:crear` y control horizontal de patrulla sin otorgar `misiones:leer` a roles de terreno. |
