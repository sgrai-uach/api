# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-37 — Categorizar o Reclasificar Tipología del Incidente en Terreno (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Incidentes / Operaciones de Terreno y Bitácora (`sgrai-api` — `GET /api/incidentes/tipos`, `PATCH /api/incidentes/[id]/tipologia`, `GET /api/incidentes`, `GET /api/incidentes/[id]`, `GET /api/misiones/[id]`).  
> **Historia de Usuario:** HU-37 — *"Como Patrulla verificadora Quiero categorizar o corregir la tipología del incidente tras la evaluación presencial en terreno. Para asegurar un registro técnico fidedigno de la naturaleza real de la emergencia, corrigiendo clasificaciones inexactas hechas por informantes ciudadanos."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h37-patrulla-categorizar-incidente`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `test(seguridad): actualizar asercion de version openapi a 0.10.0`  
> * `feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)`  
> * `chore(incidentes): formatear archivos del modulo de tipologia`  
> * `fix(misiones): transicionar incidente a VERIFICANDO y emitir evento socket al aceptar mision y reclasificar tipologia`  
> * `feat(incidentes): computar tieneMisionDespachada para incidentes en reporte (H69)`  
> * `fix(incidentes): sincronizar incidentes con misiones en curso a estado verificando y agregar flag tieneMisionEnCurso`  
> * `feat(seguridad): resolver asignacion de patrulla y cuadrilla en usuario-activo para operadores de terreno`  
> * `fix(tipado): corregir subconsulta en kanban repository y resolucion de unidad en seguridad repository`  
> * `feat(misiones): consultar hitos reales en detalle de mision y registrar reclasificacion en bitacora (HU-37)`  
> * `merge: integrar develop en feature/h37-patrulla-categorizar-incidente resolviendo conflictos y renumerando migraciones`  
> * `fix(incidentes): persistir estado verificado y reclasificado en consulta kanban`  
> * `fix(incidentes): persistir campos de verificacion en detalle y proteger paginacion con valores por defecto`  
> * `fix(test): alinear mocks de detalle incidente con esquema verificado y justificacionReclasificacion`  
> * `docs(qa): documentar primera versión de casos de prueba para HU-37`  
> * `merge: integrar develop en feature/h37-patrulla-categorizar-incidente`  
> * `fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)`  
> * `merge: rama 'develop' hacia feature/h37-patrulla-categorizar-incidente`  
>  
> **Fecha de Auditoría Inicial:** 17/11/2026 00:25.  
> **Fecha de Certificación Re-Test:** 18/11/2026 14:44.  
> **Estado de Certificación:** 🟢 **APROBADO PARA INTEGRACIÓN (100% PASS TRAS RE-TEST)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Ciclo de Re-Test

Tras ejecutar el ciclo formal de **Re-Test** sobre la rama `feature/h37-patrulla-categorizar-incidente` (sincronizada al día con `develop`, versión `0.12.0`), se verifica que los **5 defectos detectados** durante la auditoría inicial (`BUG-H37-API-01` a `BUG-H37-API-05`) fueron corregidos integralmente mediante el commit `fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)` y la sincronización con `develop`. Todas las pruebas unitarias, de integración contra PostgreSQL 16 + PostGIS y Redis Pub/Sub, validaciones estáticas (`eslint` y `tsc --noEmit`), compilación de producción (`npm run build`) y ejecución de migraciones Kysely (`npm run db:migrate`) finalizaron exitosamente sin errores ni regresiones.

| Métrica de Calidad | Evaluación Inicial (17/11/2026) | Ciclo Re-Test (18/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | **25** | 5 Defectos Subsanados (`BUG-H37-API-01` a `05`) + 20 Casos Funcionales, RBAC, Validación Zod, Bitácora y Contrato (`CP-H37-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | **25** | 100% de los casos de seguridad, autorización horizontal, ICS, concurrencia, Kanban, OpenAPI, Socket.io y regresión aprobados |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **0** | Todos los defectos (2 críticos, 2 altos, 1 medio) verificados y cerrados en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Entorno integrado operativo (PostgreSQL 16 + PostGIS en puerto `5001`, Redis 7 en puerto `6001`) |
| **Tasa de Aprobación Global (% Pass)** | **80.0%** | **100.0%** | Cumplimiento completo para fusión hacia `develop` |
| **Suite Focalizada HU-37 (Vitest)** | 36/36 tests pass | 🟢 **39/39 tests pass** | 8 archivos (`tipologia.repository.test.ts` ampliado de 6 a 9 tests validando estados cerrados, `patrulla_id = null` y patrulla inactiva) |
| **Suite Completa del Repositorio (Vitest)** | 813/813 tests pass | 🟢 **865/865 tests pass** | 75/75 archivos de prueba aprobados (`npm test`) |
| **Análisis Estático ESLint (`npm run lint`)** | 0 errores / 2 warnings | 🟢 **0 errores / 0 warnings** | Removidos los símbolos sin uso en `tipologia/__tests__/route.test.ts` y `mision.service.ts` |
| **Compilación y Tipado (`npm run build` / `tsc --noEmit`)** | Exit code 0 (con limpieza `.next`) | 🟢 **Exit code 0** | Compilación limpia Next.js 16.3.4 (`0.12.0`) y chequeo estricto TypeScript sin errores |
| **Secuencia de Migraciones Kysely (`npm run db:migrate`)** | 🔴 Fallo (`052_` vs `035_`) | 🟢 **Exit code 0** | Rama al día con `develop` (`035_`, `042_`, `061_`, `071_`); migrador Kysely finaliza sin colisiones |

---

## 2. Registro Técnico de Defectos Detectados y Verificación de Subsanación (Re-Test)

### `BUG-H37-API-01`: Bypass de Autenticación JWT mediante Cabecera Plana `x-user-id` en `PATCH /api/incidentes/[id]/tipologia` y Exposición en Contrato OpenAPI
* **Severidad:** **CRÍTICA** (Brecha de Seguridad / Suplantación de Identidad Administrativa y Evasión de Autorización Horizontal).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 18/11/2026 14:43)**.
* **Archivos Afectados:**
  * `src/app/api/incidentes/[id]/tipologia/route.ts` (Línea 41)
  * `src/lib/openapi/index.ts` (Líneas 995-1020)
  * `src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts` (Líneas 15-61)
* **Descripción Técnica del Defecto Original:**
  `route.ts` aceptaba fallback a la cabecera plana `x-user-id` sin firma JWT (`const usuarioId = tokenUserId || headerUserId;`) y OpenAPI exponía `x-user-id` y `authorization` opcional.
* **Verificación Técnica en Re-Test:**
  1. En `src/app/api/incidentes/[id]/tipologia/route.ts:41`, se reemplazó la extracción permisiva por `const usuarioId = await exigirUsuarioId(request);`, exigiendo token JWT Bearer firmado criptográficamente.
  2. En `src/lib/openapi/index.ts:995-1020`, se eliminó el parámetro de cabecera `x-user-id` y `authorization` opcional del contrato de `PATCH /api/incidentes/{id}/tipologia`. *(Observación menor no bloqueante: la propiedad `security` de la ruta en `src/lib/openapi/index.ts:1002` utiliza `bearerAuth` en minúscula en lugar de `BearerAuth` definido en `components.securitySchemes`)*
  3. En prueba HTTP en vivo (`PORT=3099`), enviar `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia` con `-H "x-user-id: 00000000-0000-4000-8000-000000000001"` y sin `Authorization` retornó **`HTTP/1.1 401 Unauthorized`**: `{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}`.

---

### `BUG-H37-API-02`: Bypass de Pertenencia con `patrulla_id = NULL`, Omisión de Filtro `tipo_mision = 'VERIFICACION'`, Falta de Validación de Estado ICS/Patrulla Activa y Ausencia de Bloqueo Pesimista (`forUpdate()`)
* **Severidad:** **CRÍTICA** (Control de Acceso Horizontal entre Unidades, Corrupción de Ciclo de Vida ICS y Condición de Carrera TOCTOU).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 18/11/2026 14:44)**.
* **Archivos Afectados:**
  * `src/modules/incidentes/tipologia.repository.ts` (Líneas 99-203)
  * `src/modules/incidentes/__tests__/tipologia.repository.test.ts` (Líneas 104-272)
* **Descripción Técnica del Defecto Original:**
  La consulta a `mision` no filtraba `tipo_mision = 'VERIFICACION'` ni bloqueaba filas con `.forUpdate()`; `if (!esAdmin && misionSeleccionada.patrulla_id)` omitía el control de pertenencia cuando `patrulla_id` era `null` (ej. misiones `ATENCION_CUADRILLA`); y no se validaban ni `incidente.estado` (`REPORTADO` / `VERIFICANDO`) ni la vigencia de la patrulla (`activo = true`, `eliminado_en IS NULL`).
* **Verificación Técnica en Re-Test:**
  1. En `src/modules/incidentes/tipologia.repository.ts`:
     * Líneas 99-114: adquiere `.forUpdate()` sobre `incidente` y valida `["REPORTADO", "VERIFICANDO"].includes(incidenteExistente.estado.toUpperCase())`, lanzando `ConflictError` (`409`) ante incidentes en `EN_ATENCION`, `RESUELTO` o `NO_ABORDABLE`.
     * Líneas 117-140: filtra `.where("mision.tipo_mision", "=", "VERIFICACION")`, ordena `.orderBy("mision.creado_en", "desc")` y adquiere `.forUpdate("mision")`.
     * Líneas 168-185: rechaza con `ConflictError` si `!misionSeleccionada.patrulla_id` o si `patrulla_activo === false || patrulla_eliminado_en !== null`, y exige validación incondicional de liderazgo o pertenencia en `patrulla_personal` cuando `!esAdmin`.
  2. Verificado en servidor activo contra PostgreSQL 16 real (`PORT=3099`):
     * `INC-2026-0004` (`EN_ATENCION` con `ATENCION_CUADRILLA` `EN_CURSO` y `patrulla_id = NULL`) -> `HTTP 409 Conflict`.
     * Incidente `RESUELTO` con misión `VERIFICACION` `EN_CURSO` -> `HTTP 409 Conflict`.
     * Incidente `VERIFICANDO` con patrulla dada de baja lógica (`activo = false`, `eliminado_en != null`) -> `HTTP 409 Conflict`.
     * Incidente `VERIFICANDO` con misión `VERIFICACION` sin `patrulla_id` -> `HTTP 409 Conflict`.
     * Incidente `VERIFICANDO` solo con misión `ATENCION_CUADRILLA` -> `HTTP 409 Conflict`.
     * Ejecución concurrente (`Promise.all`) y flujo nominal con `.forUpdate("mision")` + `LEFT JOIN` -> `HTTP 200 OK` sin error SQL ni deadlocks.

---

### `BUG-H37-API-03`: Corrupción Semántica de `verificado` y `reclasificadoEnTerreno` en Tablero Kanban (Contradicción con `VERIFICACION_EN_CURSO` de HU-21) y Mutación de BD en Consulta `GET`
* **Severidad:** **ALTA** (Inconsistencia Funcional entre Tablero Kanban y Despacho de Cuadrillas HU-21, y Violación de Semántica HTTP `GET`).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 18/11/2026 14:44)**.
* **Archivos Afectados:**
  * `src/modules/incidentes/incidente-kanban.repository.ts` (Líneas 34-226)
  * `src/modules/incidentes/incidente-kanban.service.ts` (Líneas 37-50, 84-93, 174-180)
* **Descripción Técnica del Defecto Original:**
  `verificado` se marcaba en `true` ante `TIPOLOGIA_RECLASIFICADA` (contradiciendo a HU-21 `VERIFICACION_EN_CURSO`), `reclasificadoEnTerreno` se marcaba en `true` ante misiones `COMPLETADA` sin reclasificación, y `listarIncidentesPaginadosRepo` ejecutaba un `UPDATE incidente` dentro de peticiones `GET`.
* **Verificación Técnica en Re-Test:**
  1. `listarIncidentesPaginadosRepo` eliminó la sentencia `UPDATE incidente` en peticiones `GET`.
  2. `verificado` evalúa exclusivamente `mision.tipo_mision = 'VERIFICACION' AND mision.estado = 'COMPLETADA'` (en listado y detalle), mientras `reclasificadoEnTerreno` evalúa exclusivamente la existencia del hito `TIPOLOGIA_RECLASIFICADA` / `justificacionReclasificacion`.
  3. Verificado en vivo (`PORT=3099`):
     * Incidente reclasificado con misión `VERIFICACION` aún `EN_CURSO`: tanto `GET /api/incidentes` como `GET /api/incidentes/{id}` retornan `verificado: false` y `reclasificadoEnTerreno: true`.
     * Incidente con misión `VERIFICACION` `COMPLETADA` sin reclasificación: ambos retornan `verificado: true` y `reclasificadoEnTerreno: false`.
     * Incidente en `REPORTADO` con misión `EN_CURSO` consultado por `GET /api/incidentes`: conserva `estado: "REPORTADO"` intacto en PostgreSQL.

---

### `BUG-H37-API-04`: Desfase de 35 Commits con `develop`, Colisión de Migración Kysely (`052_` vs `035_`), Fallo de `npm run db:migrate`, 8 Conflictos de Fusión y Regresión de Fixes HU-36
* **Severidad:** **ALTA** (Ruptura de Integración Continua, Bloqueo de Migraciones Kysely y Conflictos de Merge).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 18/11/2026 14:42)**.
* **Archivos Afectados:**
  * `src/lib/db/migrations/035_permiso_misiones_terreno_verificar.ts`, `042_cuadrilla_patrulla_integrantes_vistas.ts`, `061_notificaciones_mision.ts`
  * `src/modules/misiones/mision.repository.ts`, `src/modules/misiones/mision.service.ts`, `src/lib/socket/index.ts`, `src/lib/openapi/index.ts`, `package.json` (`0.12.0`)
  * `src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts`
* **Descripción Técnica del Defecto Original:**
  La rama presentaba 35 commits de desfase frente a `develop`, colisión `052_` vs `035_` con fallo de `npm run db:migrate`, 8 conflictos de fusión y 2 warnings de ESLint.
* **Verificación Técnica en Re-Test:**
  1. `git log HEAD..origin/develop` vacío (`0` commits detrás de `develop`).
  2. Eliminada la migración duplicada `052_permiso_misiones_terreno_verificar.ts` y preservadas `035_`, `042_` y `061_` de `develop`. `npm run db:migrate` ejecuta con éxito (`exit code 0`).
  3. Removidos los símbolos sin uso (`BadRequestError` en `tipologia/__tests__/route.test.ts` y `hitos` en `mision.service.ts`); `npm run lint` finaliza con `0` errores y `0` warnings.
  4. `npm test` aprueba `75/75` archivos (`865/865` tests) y `npm run build` / `npx tsc --noEmit` finalizan con código `0`.

---

### `BUG-H37-API-05`: Omisión de Query Params y Esquema Detallado `?catalogo=true` en OpenAPI de `GET /api/incidentes/tipos`, Discrepancia `"Incendio"` y Broadcast Global Duplicado en `notificarIncidenteActualizado`
* **Severidad:** **MEDIA** (Discrepancia de Contrato OpenAPI para Generación de Tipos en `sgrai-pwa`, Consistencia de Catálogo y Duplicidad WebSocket en Memoria).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 18/11/2026 14:43)**.
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts` (Líneas 889-930)
  * `src/modules/incidentes/aviso-incidente.schema.ts` (Líneas 7-19)
  * `src/lib/socket/index.ts` (Líneas 179-191)
* **Descripción Técnica del Defecto Original:**
  OpenAPI omitía los parámetros `catalogo`/`detallado` y `ListarTiposIncidenteResponse` en `/api/incidentes/tipos`; `TIPOS_AFECTACION` incluía `"Incendio"` inexistente en `tipo_incidente`; y `notificarIncidenteActualizado` ejecutaba `(ioInstance as any).emit` global en modo memoria.
* **Verificación Técnica en Re-Test:**
  1. `GET /openapi.json` expone en `paths["/api/incidentes/tipos"].get` los query parameters opcionales `catalogo` y `detallado` (`enum: ["true", "false"]`) y respuesta `200` con `anyOf` entre el arreglo `string[]` y `$ref: "#/components/schemas/ListarTiposIncidenteResponse"`.
  2. `TIPOS_AFECTACION` en `aviso-incidente.schema.ts` removió `"Incendio"`, quedando los 11 nombres exactos presentes en `tipo_incidente` (verificado en vivo vía `GET /api/incidentes/tipos`).
  3. `src/lib/socket/index.ts:179-191` removió `(ioInstance as any).emit("incidente:actualizado", payload)`, emitiendo exclusivamente a las salas `["sala:encargados", "encargado", "mapa"]` tanto en memoria como en Redis Pub/Sub (verificado en vivo: 1 evento recibido en `sala:encargados` y 3 mensajes en Redis).

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H37-API-01` | Bypass de autenticación JWT mediante cabecera plana `x-user-id` en `PATCH /api/incidentes/[id]/tipologia` y exposición en OpenAPI | Seguridad / Autenticación | Route Handler / OpenAPI | Crítica | Petición sin `Authorization: Bearer <token>` utilizando cabecera `x-user-id` con UUID de Administrador | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia` con header `x-user-id: 00000000-0000-4000-8000-000000000001` y body válido | `HTTP 401 Unauthorized` exigiendo JWT Bearer válido y OpenAPI sin `x-user-id` | Rechaza `x-user-id` con `HTTP 401 Unauthorized` mediante `exigirUsuarioId(request)` y OpenAPI omite `x-user-id` | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:43 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |
| `BUG-H37-API-02` | Bypass de pertenencia con `patrulla_id` null, omisión de filtro `tipo_mision = 'VERIFICACION'`, falta de validación de estado ICS/patrulla activa y falta de `.forUpdate()` | Seguridad / Concurrencia ICS | Repositorio / BD | Crítica | Incidente `EN_ATENCION`, `RESUELTO`, misión `VERIFICACION` sin `patrulla_id`, patrulla dada de baja o incidente solo con `ATENCION_CUADRILLA` | `PATCH /api/incidentes/{id}/tipologia` con JWT de `pedro.patrulla@valdivia.cl` en cada escenario de borde y ejecución concurrente `Promise.all` | Rechazo `409 Conflict` en estados cerrados/`EN_ATENCION`, sin misión `VERIFICACION`, `patrulla_id = null` o patrulla inactiva; bloqueo `.forUpdate()` | Todos los escenarios inválidos retornan `HTTP 409 Conflict`; `.forUpdate()` y `.forUpdate("mision")` operan sin errores SQL bajo concurrencia | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |
| `BUG-H37-API-03` | Corrupción semántica de `verificado` y `reclasificadoEnTerreno` en Kanban (contradicción `VERIFICACION_EN_CURSO` con HU-21) y `UPDATE` en `GET /api/incidentes` | Funcional / Integridad ICS | Repositorio / Servicio | Alta | Incidente reclasificado con misión `VERIFICACION` aún `EN_CURSO`, incidente `COMPLETADA` sin reclasificación e incidente `REPORTADO` con misión `EN_CURSO` | `GET /api/incidentes`, `GET /api/incidentes/{id}` y verificación directa de tabla `incidente` | `verificado: false` y `reclasificadoEnTerreno: true` si no ha cerrado; `verificado: true` y `reclasificadoEnTerreno: false` si cerró sin reclasificar; `GET` sin escrituras | Listado y detalle devuelven ambos flags con exactitud semántica y `GET /api/incidentes` mantiene `REPORTADO` sin mutar BD | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |
| `BUG-H37-API-04` | Desfase de 35 commits con `develop`, colisión de migración `052_` vs `035_`, fallo de `npm run db:migrate`, 8 conflictos de fusión y regresión HU-36 | Integración / CI | Migraciones / Git / Lint | Alta | BD sincronizada con `develop` (`035_`, `042_`, `061_`, `071_`) y rama actualizada con `origin/develop` | `npm run db:migrate`, `git log HEAD..origin/develop`, `npm run lint`, `npm test` y `npm run build` | Migraciones y fusión limpias sin colisiones ni regresiones HU-36; `0` errores y `0` warnings ESLint | Rama al día con `develop`, `npm run db:migrate` exit `0`, `npm run lint` (`0` errores, `0` warnings) y `865/865` tests pass | APROBADO | 17/11/2026 00:14 | 18/11/2026 14:42 | merge: integrar develop en feature/h37-patrulla-categorizar-incidente |
| `BUG-H37-API-05` | Omisión de `?catalogo=true` y `ListarTiposIncidenteResponse` en OpenAPI de `GET /api/incidentes/tipos`, discrepancia `"Incendio"` y broadcast global Socket.io en memoria | Contrato API / Tiempo Real | OpenAPI / Catálogo / Socket | Media | Servidor activo con `/openapi.json` (`0.12.0`), `GET /api/incidentes/tipos` y emisor `notificarIncidenteActualizado` | `GET /openapi.json`, `GET /api/incidentes/tipos` e inspección de `src/lib/socket/index.ts` | OpenAPI con query params `catalogo`/`detallado` y `ListarTiposIncidenteResponse`, 11 tipos alineados con BD y Socket.io solo por salas | OpenAPI expone `catalogo`/`detallado` y `anyOf`, catálogo simple retorna 11 ítems exactos (sin `"Incendio"`) y Socket.io emite solo a salas operativas | APROBADO | 17/11/2026 00:20 | 18/11/2026 14:43 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |
| `CP-H37-API-01` | Consulta del catálogo oficial detallado de tipos de incidente mediante `GET /api/incidentes/tipos?catalogo=true` (`200 OK`) | Funcional / Positiva | Integración / Endpoint | Crítica | Tabla `tipo_incidente` poblada con 11 registros activos | `GET /api/incidentes/tipos?catalogo=true` | `HTTP 200 OK` retornando arreglo de 11 objetos `{ id, nombre, descripcion, activo }` ordenados alfabéticamente | Retorna `HTTP 200 OK` con los 11 registros oficiales de `tipo_incidente` y sus UUIDs | APROBADO | 17/11/2026 00:20 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-02` | Consulta del catálogo oficial detallado mediante alias `?detallado=true` y preservación del modo simple para Chatbot (`200 OK`) | Funcional / Regresión | Integración / Endpoint | Alta | Endpoint `GET /api/incidentes/tipos` operativo | `GET /api/incidentes/tipos?detallado=true` y `GET /api/incidentes/tipos` | `HTTP 200 OK` con catálogo detallado cuando `?detallado=true` y `string[]` de 11 ítems sin parámetros | Ambos modos responden `HTTP 200 OK` preservando retrocompatibilidad del Chatbot | APROBADO | 17/11/2026 00:20 | 18/11/2026 14:43 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |
| `CP-H37-API-03` | Reclasificación exitosa de tipología con `tipoIncidenteId` (`camelCase`) por líder de patrulla asignada (`200 OK`) | Funcional / Positiva | Integración / Endpoint | Crítica | Incidente en `VERIFICANDO` con misión `VERIFICACION` `EN_CURSO` asignada a la patrulla del usuario autenticado | `PATCH /api/incidentes/{id}/tipologia` con JWT de `pedro.patrulla@valdivia.cl`, `tipoIncidenteId` (`Inundación`) y `justificacion` | `HTTP 200 OK`, actualización de `incidente.tipo_incidente_id` y `tipo_afectacion`, e inserción en `mision_hito` | Retorna `HTTP 200 OK` actualizando `tipo_incidente_id`, `tipo_afectacion: "Inundación"` e hito `TIPOLOGIA_RECLASIFICADA` | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-04` | Reclasificación exitosa usando alias `tipo_incidente_id` (`snake_case`) y actualización del tipo en BD (`200 OK`) | Funcional / Contrato | Integración / Schema | Alta | Incidente en `VERIFICANDO` con misión `VERIFICACION` `EN_CURSO` del patrullero autenticado | `PATCH /api/incidentes/{id}/tipologia` con `{"tipo_incidente_id":"40000000-0000-4000-8000-000000000002","justificacion":"..."}` | `HTTP 200 OK` aceptando `tipo_incidente_id` y actualizando `tipoAfectacion` a `"Deslizamiento de tierra"` | Retorna `HTTP 200 OK` actualizando `tipo_incidente_id` y `tipoAfectacion: "Deslizamiento de tierra"` | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-05` | Autorización exitosa para integrante de `patrulla_personal` (no líder) perteneciente a la patrulla asignada (`200 OK`) | Seguridad / Autorización | Integración / Repositorio | Alta | Usuario `matias.patrulla@valdivia.cl` registrado en `patrulla_personal` de `Patrulla verificadora alen` | `PATCH /api/incidentes/{id}/tipologia` con JWT de `matias.patrulla@valdivia.cl` | `HTTP 200 OK` registrando `registradoPorId` con el UUID del integrante evaluador | Retorna `HTTP 200 OK` con `registradoPorId: "d1000000-0000-4000-8000-000000000003"` | APROBADO | 17/11/2026 00:24 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-06` | Registro automático del hito `'TIPOLOGIA_RECLASIFICADA'` con texto `'Tipología reclasificada en terreno a: [Nombre del Tipo]'` y exposición en `GET /api/misiones/[id]` | Funcional / Trazabilidad ICS | Integración / Bitácora | Crítica | Reclasificación ejecutada sobre misión de verificación `EN_CURSO` | `GET /api/misiones/{misionId}` con JWT de `encargado@valdivia.cl` | `bitacoraTiempos` incluye hito `TIPOLOGIA_RECLASIFICADA` con la glosa exigida y `titulo` actualizado con nueva tipología | `GET /api/misiones/{id}` expone hitos cronológicos en `bitacoraTiempos` y actualiza el `titulo` dinámico | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | feat(misiones): consultar hitos reales en detalle de mision y registrar reclasificacion en bitacora (HU-37) |
| `CP-H37-API-07` | Emisión de notificación en tiempo real `incidente:actualizado` por Redis Pub/Sub hacia `sala:encargados`, `encargado` y `mapa` | Tiempo Real / Socket.io | Integración / Redis + WS | Crítica | Cliente WebSocket unido a `sala:encargados` y suscriptor Redis en `sgrai:socket-events` | `PATCH /api/incidentes/{id}/tipologia` exitoso con cambio de tipología | Recepción en tiempo real del evento `incidente:actualizado` con `id`, `codigo`, `tipoIncidenteId`, `tipoAfectacion`, `nuevoEstado` y `justificacion` | Cliente WebSocket recibe 1 evento y Redis publica 3 mensajes dirigidos a `sala:encargados`, `encargado` y `mapa` | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-08` | Rechazo de petición sin credenciales ni cabeceras de autenticación (`401 Unauthorized`) | Seguridad / Autenticación | Endpoint | Crítica | Petición sin `Authorization` ni `x-user-id` | `PATCH /api/incidentes/{id}/tipologia` sin cabeceras de autenticación | `HTTP 401 Unauthorized` con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | Retorna `HTTP 401 Unauthorized` con el mensaje esperado | APROBADO | 17/11/2026 00:20 | 18/11/2026 14:44 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |
| `CP-H37-API-09` | Rechazo por token JWT Bearer inválido o malformado (`401 Unauthorized`) | Seguridad / Autenticación | Endpoint / JWT | Crítica | Cabecera `Authorization: Bearer token.invalido.jwt` | `PATCH /api/incidentes/{id}/tipologia` con JWT manipulado | `HTTP 401 Unauthorized` con mensaje `"Token de sesión inválido o expirado."` | Retorna `HTTP 401 Unauthorized`: `{"message":"Token de sesión inválido o expirado."}` | APROBADO | 17/11/2026 00:20 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-10` | Rechazo RBAC para usuarios `CALL_CENTER` y `ENCARGADO` sin permiso `misiones:terreno:verificar` (`403 Forbidden`) | Seguridad / RBAC | Endpoint / Auth | Crítica | Tokens JWT válidos de `callcenter@valdivia.cl` y `encargado@valdivia.cl` | `PATCH /api/incidentes/{id}/tipologia` con `Authorization: Bearer <token_callcenter>` y `<token_encargado>` | `HTTP 403 Forbidden` indicando ausencia de `misiones:terreno:verificar` | Ambos retornan `HTTP 403 Forbidden`: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-11` | Rechazo de patrullero perteneciente a otra patrulla verificadora cuando la misión tiene `patrulla_id` asignado (`403 Forbidden`) | Seguridad / Autorización | Integración / Repositorio | Alta | Incidente `a1000000-0000-4000-8000-000000000003` asignado a `Patrulla Rápida Costa-1` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia` con JWT de `pedro.patrulla@valdivia.cl` | `HTTP 403 Forbidden` impidiendo reclasificar incidente ajeno | Retorna `HTTP 403 Forbidden`: `{"message":"No está autorizado para reclasificar la tipología de un incidente asignado a otra patrulla verificadora."}` | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-12` | Rechazo de parámetro de ruta `id` con formato UUID inválido (`400 Bad Request`) | Validación / Contrato | Endpoint / Zod | Media | Usuario autenticado con permiso `misiones:terreno:verificar` | `PATCH /api/incidentes/id-no-es-uuid/tipologia` con JWT válido | `HTTP 400 Bad Request` detallando error en campo `id` | Retorna `HTTP 400 Bad Request`: `"El identificador del incidente proporcionado no es un UUID válido."` | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-13` | Rechazo por cuerpo de petición JSON malformado (`400 Bad Request`) | Validación / Robustez | Endpoint | Media | Usuario autorizado enviando JSON sintácticamente inválido | `PATCH /api/incidentes/{id}/tipologia` con body `{malformed` | `HTTP 400 Bad Request` con mensaje `"El cuerpo de la petición no es un JSON válido."` | Retorna `HTTP 400 Bad Request` con el mensaje esperado | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-14` | Rechazo por `justificacion` menor a 5 caracteres o compuesta únicamente por espacios en blanco (`400 Bad Request`) | Validación / Schema Zod | Endpoint / Zod | Alta | Usuario autorizado enviando `justificacion: "abc"` o `"     "` | `PATCH /api/incidentes/{id}/tipologia` con `justificacion: "abc"` y `"     "` | `HTTP 400 Bad Request` indicando mínimo de 5 caracteres en `justificacion` | Ambos retornan `HTTP 400 Bad Request` con `errors[0].campo = "justificacion"` | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-15` | Rechazo por ausencia de `tipoIncidenteId` y `tipo_incidente_id` en el payload (`400 Bad Request`) | Validación / Schema Zod | Endpoint / Zod | Alta | Usuario autorizado enviando únicamente `justificacion` | `PATCH /api/incidentes/{id}/tipologia` con `{"justificacion":"Constatacion en terreno sin tipo"}` | `HTTP 400 Bad Request` exigiendo especificar `tipoIncidenteId` o `tipo_incidente_id` | Retorna `HTTP 400 Bad Request` con error estructurado en `tipoIncidenteId` | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-16` | Rechazo cuando se selecciona un `tipo_incidente` con estado `activo = false` (`400 Bad Request`) | Regla de Negocio / Catálogo | Integración / Repositorio | Alta | Registro en `tipo_incidente` con `activo = false` | `PATCH /api/incidentes/{id}/tipologia` con UUID del tipo inactivo | `HTTP 400 Bad Request` indicando que el tipo seleccionado no se encuentra activo | Retorna `HTTP 400 Bad Request`: `{"message":"El tipo de incidente seleccionado no se encuentra activo en el catálogo oficial."}` | APROBADO | 17/11/2026 00:23 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-17` | Rechazo cuando el `incidenteId` o el `tipoIncidenteId` no existen en la base de datos (`404 Not Found`) | Funcional / Negativa | Integración / Repositorio | Alta | UUID inexistente en tabla `incidente` o en `tipo_incidente` | `PATCH /api/incidentes/99999999-.../tipologia` y `tipoIncidenteId: "49999999-..."` | `HTTP 404 Not Found` diferenciando incidente inexistente vs tipo de incidente inexistente | Ambos retornan `HTTP 404 Not Found` con sus respectivos mensajes descriptivos | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-18` | Bloqueo cuando la patrulla aún no ha aceptado la misión asignada y permanece en estado `DESPACHADA` (`409 Conflict`) | Regla de Negocio ICS | Integración / Repositorio | Crítica | Misión `MIS-2026-0008` en estado `DESPACHADA` asignada a la patrulla de Pedro | `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/tipologia` con JWT de `pedro.patrulla@valdivia.cl` | `HTTP 409 Conflict` indicando que la patrulla debe aceptar la misión antes de reclasificar | Retorna `HTTP 409 Conflict`: `{"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}` | APROBADO | 17/11/2026 00:21 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-19` | Resiliencia del servicio si la emisión del evento WebSocket `incidente:actualizado` lanza una excepción | Tolerancia a Fallos | Unitaria / Servicio | Media | `notificarIncidenteActualizado` arrojando excepción simulada tras confirmar transacción | `npm test -- -t "TipologiaService \(HU-37\)"` | La transacción en BD se mantiene y el servicio retorna respuesta exitosa sin abortar | `TipologiaService` captura la excepción en `try/catch` y retorna el resultado completo | APROBADO | 17/11/2026 00:25 | 18/11/2026 14:44 | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-20` | Ejecución de suites unitarias Vitest y compilación Next.js / TypeScript de los módulos de tipología, Kanban y detalle de misión | Automatización / Build | Unit / Build / TS | Alta | Código fuente de la rama `feature/h37-patrulla-categorizar-incidente` sincronizado con `develop` | `npm test` (865/865), `npm run lint`, `npm run build` y `npx tsc --noEmit` | 100% de pruebas unitarias aprobadas, `0` errores/warnings de lint y compilación sin errores | `865/865` tests aprobados (`39/39` focalizados HU-37), `npm run lint` limpio, `npm run build` y `tsc --noEmit` exit code `0` | APROBADO | 17/11/2026 00:24 | 18/11/2026 14:44 | fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H37-API-01	Bypass de autenticación JWT mediante cabecera plana x-user-id en PATCH /api/incidentes/[id]/tipologia y exposición en OpenAPI	Seguridad / Autenticación	Route Handler / OpenAPI	Crítica	Petición sin Authorization: Bearer <token> utilizando cabecera x-user-id con UUID de Administrador	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia con header x-user-id: 00000000-0000-4000-8000-000000000001 y body válido	HTTP 401 Unauthorized exigiendo JWT Bearer válido y OpenAPI sin x-user-id	Rechaza x-user-id con HTTP 401 Unauthorized mediante exigirUsuarioId(request) y OpenAPI omite x-user-id	APROBADO	17/11/2026 00:23	18/11/2026 14:43	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
BUG-H37-API-02	Bypass de pertenencia con patrulla_id null, omisión de filtro tipo_mision = 'VERIFICACION', falta de validación de estado ICS/patrulla activa y falta de .forUpdate()	Seguridad / Concurrencia ICS	Repositorio / BD	Crítica	Incidente EN_ATENCION, RESUELTO, misión VERIFICACION sin patrulla_id, patrulla dada de baja o incidente solo con ATENCION_CUADRILLA	PATCH /api/incidentes/{id}/tipologia con JWT de pedro.patrulla@valdivia.cl en cada escenario de borde y ejecución concurrente Promise.all	Rechazo 409 Conflict en estados cerrados/EN_ATENCION, sin misión VERIFICACION, patrulla_id = null o patrulla inactiva; bloqueo .forUpdate()	Todos los escenarios inválidos retornan HTTP 409 Conflict; .forUpdate() y .forUpdate("mision") operan sin errores SQL bajo concurrencia	APROBADO	17/11/2026 00:23	18/11/2026 14:44	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
BUG-H37-API-03	Corrupción semántica de verificado y reclasificadoEnTerreno en Kanban (contradicción VERIFICACION_EN_CURSO con HU-21) y UPDATE en GET /api/incidentes	Funcional / Integridad ICS	Repositorio / Servicio	Alta	Incidente reclasificado con misión VERIFICACION aún EN_CURSO, incidente COMPLETADA sin reclasificación e incidente REPORTADO con misión EN_CURSO	GET /api/incidentes, GET /api/incidentes/{id} y verificación directa de tabla incidente	verificado: false y reclasificadoEnTerreno: true si no ha cerrado; verificado: true y reclasificadoEnTerreno: false si cerró sin reclasificar; GET sin escrituras	Listado y detalle devuelven ambos flags con exactitud semántica y GET /api/incidentes mantiene REPORTADO sin mutar BD	APROBADO	17/11/2026 00:23	18/11/2026 14:44	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
BUG-H37-API-04	Desfase de 35 commits con develop, colisión de migración 052_ vs 035_, fallo de npm run db:migrate, 8 conflictos de fusión y regresión HU-36	Integración / CI	Migraciones / Git / Lint	Alta	BD sincronizada con develop (035_, 042_, 061_, 071_) y rama actualizada con origin/develop	npm run db:migrate, git log HEAD..origin/develop, npm run lint, npm test y npm run build	Migraciones y fusión limpias sin colisiones ni regresiones HU-36; 0 errores y 0 warnings ESLint	Rama al día con develop, npm run db:migrate exit 0, npm run lint (0 errores, 0 warnings) y 865/865 tests pass	APROBADO	17/11/2026 00:14	18/11/2026 14:42	merge: integrar develop en feature/h37-patrulla-categorizar-incidente
BUG-H37-API-05	Omisión de ?catalogo=true y ListarTiposIncidenteResponse en OpenAPI de GET /api/incidentes/tipos, discrepancia "Incendio" y broadcast global Socket.io en memoria	Contrato API / Tiempo Real	OpenAPI / Catálogo / Socket	Media	Servidor activo con /openapi.json (0.12.0), GET /api/incidentes/tipos y emisor notificarIncidenteActualizado	GET /openapi.json, GET /api/incidentes/tipos e inspección de src/lib/socket/index.ts	OpenAPI con query params catalogo/detallado y ListarTiposIncidenteResponse, 11 tipos alineados con BD y Socket.io solo por salas	OpenAPI expone catalogo/detallado y anyOf, catálogo simple retorna 11 ítems exactos (sin "Incendio") y Socket.io emite solo a salas operativas	APROBADO	17/11/2026 00:20	18/11/2026 14:43	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
CP-H37-API-01	Consulta del catálogo oficial detallado de tipos de incidente mediante GET /api/incidentes/tipos?catalogo=true (200 OK)	Funcional / Positiva	Integración / Endpoint	Crítica	Tabla tipo_incidente poblada con 11 registros activos	GET /api/incidentes/tipos?catalogo=true	HTTP 200 OK retornando arreglo de 11 objetos { id, nombre, descripcion, activo } ordenados alfabéticamente	Retorna HTTP 200 OK con los 11 registros oficiales de tipo_incidente y sus UUIDs	APROBADO	17/11/2026 00:20	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-02	Consulta del catálogo oficial detallado mediante alias ?detallado=true y preservación del modo simple para Chatbot (200 OK)	Funcional / Regresión	Integración / Endpoint	Alta	Endpoint GET /api/incidentes/tipos operativo	GET /api/incidentes/tipos?detallado=true y GET /api/incidentes/tipos	HTTP 200 OK con catálogo detallado cuando ?detallado=true y string[] de 11 ítems sin parámetros	Ambos modos responden HTTP 200 OK preservando retrocompatibilidad del Chatbot	APROBADO	17/11/2026 00:20	18/11/2026 14:43	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
CP-H37-API-03	Reclasificación exitosa de tipología con tipoIncidenteId (camelCase) por líder de patrulla asignada (200 OK)	Funcional / Positiva	Integración / Endpoint	Crítica	Incidente en VERIFICANDO con misión VERIFICACION EN_CURSO asignada a la patrulla del usuario autenticado	PATCH /api/incidentes/{id}/tipologia con JWT de pedro.patrulla@valdivia.cl, tipoIncidenteId (Inundación) y justificacion	HTTP 200 OK, actualización de incidente.tipo_incidente_id y tipo_afectacion, e inserción en mision_hito	Retorna HTTP 200 OK actualizando tipo_incidente_id, tipo_afectacion: "Inundación" e hito TIPOLOGIA_RECLASIFICADA	APROBADO	17/11/2026 00:23	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-04	Reclasificación exitosa usando alias tipo_incidente_id (snake_case) y actualización del tipo en BD (200 OK)	Funcional / Contrato	Integración / Schema	Alta	Incidente en VERIFICANDO con misión VERIFICACION EN_CURSO del patrullero autenticado	PATCH /api/incidentes/{id}/tipologia con {"tipo_incidente_id":"40000000-0000-4000-8000-000000000002","justificacion":"..."}	HTTP 200 OK aceptando tipo_incidente_id y actualizando tipoAfectacion a "Deslizamiento de tierra"	Retorna HTTP 200 OK actualizando tipo_incidente_id y tipoAfectacion: "Deslizamiento de tierra"	APROBADO	17/11/2026 00:23	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-05	Autorización exitosa para integrante de patrulla_personal (no líder) perteneciente a la patrulla asignada (200 OK)	Seguridad / Autorización	Integración / Repositorio	Alta	Usuario matias.patrulla@valdivia.cl registrado en patrulla_personal de Patrulla verificadora alen	PATCH /api/incidentes/{id}/tipologia con JWT de matias.patrulla@valdivia.cl	HTTP 200 OK registrando registradoPorId con el UUID del integrante evaluador	Retorna HTTP 200 OK con registradoPorId: "d1000000-0000-4000-8000-000000000003"	APROBADO	17/11/2026 00:24	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-06	Registro automático del hito 'TIPOLOGIA_RECLASIFICADA' con texto 'Tipología reclasificada en terreno a: [Nombre del Tipo]' y exposición en GET /api/misiones/[id]	Funcional / Trazabilidad ICS	Integración / Bitácora	Crítica	Reclasificación ejecutada sobre misión de verificación EN_CURSO	GET /api/misiones/{misionId} con JWT de encargado@valdivia.cl	bitacoraTiempos incluye hito TIPOLOGIA_RECLASIFICADA con la glosa exigida y titulo actualizado con nueva tipología	GET /api/misiones/{id} expone hitos cronológicos en bitacoraTiempos y actualiza el titulo dinámico	APROBADO	17/11/2026 00:23	18/11/2026 14:44	feat(misiones): consultar hitos reales en detalle de mision y registrar reclasificacion en bitacora (HU-37)
CP-H37-API-07	Emisión de notificación en tiempo real incidente:actualizado por Redis Pub/Sub hacia sala:encargados, encargado y mapa	Tiempo Real / Socket.io	Integración / Redis + WS	Crítica	Cliente WebSocket unido a sala:encargados y suscriptor Redis en sgrai:socket-events	PATCH /api/incidentes/{id}/tipologia exitoso con cambio de tipología	Recepción en tiempo real del evento incidente:actualizado con id, codigo, tipoIncidenteId, tipoAfectacion, nuevoEstado y justificacion	Cliente WebSocket recibe 1 evento y Redis publica 3 mensajes dirigidos a sala:encargados, encargado y mapa	APROBADO	17/11/2026 00:23	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-08	Rechazo de petición sin credenciales ni cabeceras de autenticación (401 Unauthorized)	Seguridad / Autenticación	Endpoint	Crítica	Petición sin Authorization ni x-user-id	PATCH /api/incidentes/{id}/tipologia sin cabeceras de autenticación	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	Retorna HTTP 401 Unauthorized con el mensaje esperado	APROBADO	17/11/2026 00:20	18/11/2026 14:44	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
CP-H37-API-09	Rechazo por token JWT Bearer inválido o malformado (401 Unauthorized)	Seguridad / Autenticación	Endpoint / JWT	Crítica	Cabecera Authorization: Bearer token.invalido.jwt	PATCH /api/incidentes/{id}/tipologia con JWT manipulado	HTTP 401 Unauthorized con mensaje "Token de sesión inválido o expirado."	Retorna HTTP 401 Unauthorized: {"message":"Token de sesión inválido o expirado."}	APROBADO	17/11/2026 00:20	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-10	Rechazo RBAC para usuarios CALL_CENTER y ENCARGADO sin permiso misiones:terreno:verificar (403 Forbidden)	Seguridad / RBAC	Endpoint / Auth	Crítica	Tokens JWT válidos de callcenter@valdivia.cl y encargado@valdivia.cl	PATCH /api/incidentes/{id}/tipologia con Authorization: Bearer <token_callcenter> y <token_encargado>	HTTP 403 Forbidden indicando ausencia de misiones:terreno:verificar	Ambos retornan HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-11	Rechazo de patrullero perteneciente a otra patrulla verificadora cuando la misión tiene patrulla_id asignado (403 Forbidden)	Seguridad / Autorización	Integración / Repositorio	Alta	Incidente a1000000-0000-4000-8000-000000000003 asignado a Patrulla Rápida Costa-1	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia con JWT de pedro.patrulla@valdivia.cl	HTTP 403 Forbidden impidiendo reclasificar incidente ajeno	Retorna HTTP 403 Forbidden: {"message":"No está autorizado para reclasificar la tipología de un incidente asignado a otra patrulla verificadora."}	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-12	Rechazo de parámetro de ruta id con formato UUID inválido (400 Bad Request)	Validación / Contrato	Endpoint / Zod	Media	Usuario autenticado con permiso misiones:terreno:verificar	PATCH /api/incidentes/id-no-es-uuid/tipologia con JWT válido	HTTP 400 Bad Request detallando error en campo id	Retorna HTTP 400 Bad Request: "El identificador del incidente proporcionado no es un UUID válido."	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-13	Rechazo por cuerpo de petición JSON malformado (400 Bad Request)	Validación / Robustez	Endpoint	Media	Usuario autorizado enviando JSON sintácticamente inválido	PATCH /api/incidentes/{id}/tipologia con body {malformed	HTTP 400 Bad Request con mensaje "El cuerpo de la petición no es un JSON válido."	Retorna HTTP 400 Bad Request con el mensaje esperado	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-14	Rechazo por justificacion menor a 5 caracteres o compuesta únicamente por espacios en blanco (400 Bad Request)	Validación / Schema Zod	Endpoint / Zod	Alta	Usuario autorizado enviando justificacion: "abc" o "     "	PATCH /api/incidentes/{id}/tipologia con justificacion: "abc" y "     "	HTTP 400 Bad Request indicando mínimo de 5 caracteres en justificacion	Ambos retornan HTTP 400 Bad Request con errors[0].campo = "justificacion"	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-15	Rechazo por ausencia de tipoIncidenteId y tipo_incidente_id en el payload (400 Bad Request)	Validación / Schema Zod	Endpoint / Zod	Alta	Usuario autorizado enviando únicamente justificacion	PATCH /api/incidentes/{id}/tipologia con {"justificacion":"Constatacion en terreno sin tipo"}	HTTP 400 Bad Request exigiendo especificar tipoIncidenteId o tipo_incidente_id	Retorna HTTP 400 Bad Request con error estructurado en tipoIncidenteId	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-16	Rechazo cuando se selecciona un tipo_incidente con estado activo = false (400 Bad Request)	Regla de Negocio / Catálogo	Integración / Repositorio	Alta	Registro en tipo_incidente con activo = false	PATCH /api/incidentes/{id}/tipologia con UUID del tipo inactivo	HTTP 400 Bad Request indicando que el tipo seleccionado no se encuentra activo	Retorna HTTP 400 Bad Request: {"message":"El tipo de incidente seleccionado no se encuentra activo en el catálogo oficial."}	APROBADO	17/11/2026 00:23	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-17	Rechazo cuando el incidenteId o el tipoIncidenteId no existen en la base de datos (404 Not Found)	Funcional / Negativa	Integración / Repositorio	Alta	UUID inexistente en tabla incidente o en tipo_incidente	PATCH /api/incidentes/99999999-.../tipologia y tipoIncidenteId: "49999999-..."	HTTP 404 Not Found diferenciando incidente inexistente vs tipo de incidente inexistente	Ambos retornan HTTP 404 Not Found con sus respectivos mensajes descriptivos	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-18	Bloqueo cuando la patrulla aún no ha aceptado la misión asignada y permanece en estado DESPACHADA (409 Conflict)	Regla de Negocio ICS	Integración / Repositorio	Crítica	Misión MIS-2026-0008 en estado DESPACHADA asignada a la patrulla de Pedro	PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/tipologia con JWT de pedro.patrulla@valdivia.cl	HTTP 409 Conflict indicando que la patrulla debe aceptar la misión antes de reclasificar	Retorna HTTP 409 Conflict: {"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}	APROBADO	17/11/2026 00:21	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-19	Resiliencia del servicio si la emisión del evento WebSocket incidente:actualizado lanza una excepción	Tolerancia a Fallos	Unitaria / Servicio	Media	notificarIncidenteActualizado arrojando excepción simulada tras confirmar transacción	npm test -- -t "TipologiaService \(HU-37\)"	La transacción en BD se mantiene y el servicio retorna respuesta exitosa sin abortar	TipologiaService captura la excepción en try/catch y retorna el resultado completo	APROBADO	17/11/2026 00:25	18/11/2026 14:44	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-20	Ejecución de suites unitarias Vitest y compilación Next.js / TypeScript de los módulos de tipología, Kanban y detalle de misión	Automatización / Build	Unit / Build / TS	Alta	Código fuente de la rama feature/h37-patrulla-categorizar-incidente sincronizado con develop	npm test (865/865), npm run lint, npm run build y npx tsc --noEmit	100% de pruebas unitarias aprobadas, 0 errores/warnings de lint y compilación sin errores	865/865 tests aprobados (39/39 focalizados HU-37), npm run lint limpio, npm run build y tsc --noEmit exit code 0	APROBADO	17/11/2026 00:24	18/11/2026 14:44	fix(incidentes): resolver hallazgos QA BUG-H37-API-01 a BUG-H37-API-05 (HU-37)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Ejecución de Pruebas Automatizadas en Vitest, Migraciones, Linter y Compilación

#### 5.1.1 Suite Focalizada de Tipología, Kanban, Misiones y Contrato OpenAPI
```bash
npm test -- \
  src/app/api/incidentes/tipos/__tests__/route.test.ts \
  src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts \
  src/modules/incidentes/__tests__/tipologia.service.test.ts \
  src/modules/incidentes/__tests__/tipologia.repository.test.ts \
  src/modules/incidentes/__tests__/incidente-kanban.service.test.ts \
  src/app/api/incidentes/[id]/__tests__/route.test.ts \
  src/modules/misiones/__tests__/mision.service.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola (Re-Test):**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (6 tests) 114ms
 ✓ src/modules/incidentes/__tests__/incidente-kanban.service.test.ts (5 tests) 86ms
 ✓ src/modules/incidentes/__tests__/tipologia.service.test.ts (3 tests) 134ms
 ✓ src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts (8 tests) 121ms
 ✓ src/modules/incidentes/__tests__/tipologia.repository.test.ts (9 tests) 130ms
 ✓ src/app/api/incidentes/[id]/__tests__/route.test.ts (5 tests) 108ms
 ✓ src/app/api/incidentes/tipos/__tests__/route.test.ts (2 tests) 196ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 1212ms

 Test Files  8 passed (8)
      Tests  39 passed (39)
   Start at  14:44:39
   Duration  6.52s
```

#### 5.1.2 Validación Integral (Migraciones, ESLint, Vitest Completo, Build y TypeScript)
```bash
npm run db:migrate
npm run lint
npm test
npm run build
npx tsc --noEmit
```

**Salidas de Consola (Re-Test):**
```text
Ejecutando migraciones Kysely de base de datos...
Todas las migraciones se completaron correctamente.
(exit code 0)

> eslint
(0 errors, 0 warnings — exit code 0)

> vitest run
 Test Files  75 passed (75)
      Tests  865 passed (865)
   Start at  14:41:42
   Duration  13.68s

> build (Next.js 16.3.4 Turbopack)
✓ Compiled successfully in 2.8s
✓ Finished TypeScript in 12.9s
(exit code 0)

> tsc --noEmit
(exit code 0)
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`PORT=3099`, Re-Test)

#### Caso 1: Rechazo de Bypass JWT mediante Cabecera `x-user-id` (`401 Unauthorized` — `BUG-H37-API-01`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento bypass con x-user-id"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 2: Bloqueo de Incidente en Estado `EN_ATENCION`, `RESUELTO`, Patrulla Inactiva, `patrulla_id = NULL` y Sin Misión de Verificación (`409 Conflict` — `BUG-H37-API-02`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000004/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento sobre incidente EN_ATENCION sin mision verificacion"}'
```

**Respuestas HTTP/JSON Verificadas:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"El incidente se encuentra en estado 'EN_ATENCION'. Solo se puede reclasificar la tipología de incidentes en estado REPORTADO o VERIFICANDO."}
```
```text
RESUELTO:          409 {"message":"El incidente se encuentra en estado 'RESUELTO'. Solo se puede reclasificar la tipología de incidentes en estado REPORTADO o VERIFICANDO."}
PATRULLA_INACTIVA: 409 {"message":"La patrulla verificadora asignada a la misión ha sido desactivada o dada de baja."}
PATRULLA_NULL:     409 {"message":"La misión de verificación no tiene una patrulla verificadora asignada."}
SOLO_CUADRILLA:    409 {"message":"No existe una misión de verificación asociada a este incidente para registrar la evaluación de terreno."}
```

#### Caso 3: Verificación de Catálogo Simple Alineado y Contrato OpenAPI `0.12.0` (`BUG-H37-API-05`)
```bash
curl -s -i "http://localhost:3099/api/incidentes/tipos"
curl -s "http://localhost:3099/openapi.json"
```

**Respuestas HTTP/JSON Verificadas:**
```json
{"message":"Tipos de afectación obtenidos exitosamente.","data":["Anegamiento","Inundación","Caída de árbol","Corte de energía","Deslizamiento","Deslizamiento de tierra","Daño estructural","Corte de agua potable","Anegamiento de calzada","Incendio estructural / forestal","Otro"]}
```
* `/openapi.json` (`info.version: "0.12.0"`) expone en `paths["/api/incidentes/tipos"].get` los query parameters `catalogo` y `detallado` junto a `$ref: "#/components/schemas/ListarTiposIncidenteResponse"`, y en `paths["/api/incidentes/{id}/tipologia"].patch` únicamente el parámetro de ruta `id` (sin `x-user-id`).

#### Caso 4: Flujo Positivo con `.forUpdate("mision")`, Semántica Kanban y WebSocket/Redis (`CP-H37-API-03`, `CP-H37-API-07`, `BUG-H37-API-03`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/eeee0000-0000-4000-8000-000000000010/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Re-Test: Se constata inundación severa con ingreso de agua."}'
```

**Respuestas Verificadas:**
```json
{"message":"Tipología del incidente reclasificada exitosamente en terreno.","data":{"incidente":{"id":"eeee0000-0000-4000-8000-000000000010","codigo":"INC-QA-R37-01","tipoIncidenteId":"40000000-0000-4000-8000-000000000001","tipoAfectacion":"Inundación","estado":"VERIFICANDO","prioridad":"MEDIA","actualizadoEn":"2026-11-18T17:44:18.079Z"},"hito":{"id":"d319859f-311c-45bf-8f84-98831fc48aa8","misionId":"eeee0000-0000-4000-8000-000000000020","hito":"TIPOLOGIA_RECLASIFICADA","descripcion":"Tipología reclasificada en terreno a: Inundación. Justificación: Re-Test: Se constata inundación severa con ingreso de agua.","registradoPorId":"d1000000-0000-4000-8000-000000000001","creadoEn":"2026-11-18T17:44:18.079Z"}}}
```
```text
WS count (sala:encargados): 1 | Redis count (sgrai:socket-events): 3
Reclasificado sin completar verificación -> List/Detail: verificado: false, reclasificadoEnTerreno: true
Verificación COMPLETADA sin reclasificar -> List/Detail: verificado: true, reclasificadoEnTerreno: false
GET /api/incidentes sobre REPORTADO con misión EN_CURSO -> estado en BD permanece REPORTADO
Concurrencia Promise.all (.forUpdate) -> HTTP 200 / HTTP 200
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La pantalla de evaluación en la PWA debe proveer un selector desplegable con las categorías oficiales de incidentes. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de componente selector en el repositorio `sgrai-pwa`. |
| **CA-2:** El selector debe alimentarse del catálogo oficial `GET /api/incidentes/tipos` (ej. Inundación, Caída de árbol, Derrumbe, Incendio estructural, etc.). | `CP-H37-API-01`, `CP-H37-API-02`, `BUG-H37-API-05` | 🟢 **APROBADO** | `GET /api/incidentes/tipos?catalogo=true` y `?detallado=true` retornan los 11 registros activos de `tipo_incidente` con sus UUIDs; contrato OpenAPI y catálogo simple alineados sin `"Incendio"`. |
| **CA-3:** La patrulla debe poder seleccionar el tipo que mejor describe la situación real constatada en terreno. | `CP-H37-API-03`, `CP-H37-API-04`, `CP-H37-API-05`, `CP-H37-API-16`, `BUG-H37-API-02` | 🟢 **APROBADO** | Valida existencia y vigencia en `tipo_incidente`, misión `VERIFICACION` `EN_CURSO`, patrulla asignada activa, estado `REPORTADO`/`VERIFICANDO` del incidente y pertenencia a la patrulla. |
| **CA-4:** Al guardar, el sistema debe actualizar el campo `incidente.tipo_incidente_id` en la base de datos. | `CP-H37-API-03`, `CP-H37-API-04`, `CP-H37-API-20`, `BUG-H37-API-02`, `BUG-H37-API-03` | 🟢 **APROBADO** | Actualiza atómicamente `tipo_incidente_id` y `tipo_afectacion` con `.forUpdate()` en la transacción y mantiene separados `verificado` y `reclasificadoEnTerreno` en Kanban. |
| **CA-5:** Se debe registrar automáticamente un hito en `mision_hito` indicando: `'Tipología reclasificada en terreno a: [Nombre del Tipo]'`. | `CP-H37-API-03`, `CP-H37-API-06` | 🟢 **APROBADO** | Persiste el hito `TIPOLOGIA_RECLASIFICADA` con la descripción `'Tipología reclasificada en terreno a: [Nombre]. Justificación: [Texto]'` y lo expone en `GET /api/misiones/{id}`. |
| **CA-6:** El sistema debe emitir la notificación WebSocket `incidente:actualizado` al Centro de Mando para actualizar la tarjeta en el tablero Kanban. | `CP-H37-API-07`, `CP-H37-API-19`, `BUG-H37-API-05` | 🟢 **APROBADO** | Emite `incidente:actualizado` únicamente a las salas `sala:encargados`, `encargado` y `mapa` sin broadcast global duplicado ni pérdida de tolerancia a fallos. |
| **CA-7:** El endpoint de actualización debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H37-API-08`, `CP-H37-API-09`, `CP-H37-API-10`, `CP-H37-API-11`, `BUG-H37-API-01`, `BUG-H37-API-02`, `BUG-H37-API-04` | 🟢 **APROBADO** | Exige token JWT Bearer válido vía `exigirUsuarioId(request)`, verifica el permiso `misiones:terreno:verificar` y mantiene la secuencia de migraciones Kysely sincronizada con `develop`. |
