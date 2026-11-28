# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-43 — Adjuntar Evidencia Multimedia a Incidentes y Misiones desde Terreno (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Evidencia / Operaciones de Terreno e Incidentes (`sgrai-api` — `POST /api/evidencia/adjuntos`, `GET /api/evidencia/adjuntos` y `GET /uploads/evidencia/[filename]`).  
> **Historia de Usuario:** HU-43 — *"Como Delegado de cuadrilla Quiero adjuntar fotografías, videos y documentos técnicos al incidente y su misión desde el dispositivo móvil. Para respaldar las condiciones del lugar, documentar los trabajos ejecutados y contar con evidencia técnica para la auditoría operativa."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Sharp 0.35.5 + FFmpeg + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h43-adjuntar-evidencia-multimedia`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)`  
> * `feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)`  
> * `chore(docker): configurar ffmpeg y volumen persistente uploads_data para evidencias (HU-43)`  
> * `test(evidencia): agregar pruebas unitarias para migracion 058, almacenamiento, servicio y rutas (HU-43)`  
> * `docs(api): registrar endpoint POST /api/evidencia/adjuntos en OpenAPI y documentar modulo de evidencia (HU-43)`  
> * `merge: integrar H39 (informe tecnico de verificacion y cierre) en feature/h43-adjuntar-evidencia-multimedia`  
> * `merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia`  
> * `fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)`  
>  
> **Fecha de Auditoría Inicial:** 24/11/2026 14:26.  
> **Fecha de Re-Test y Certificación Final:** 26/11/2026 21:56.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Backend Cumplidos — 6 Defectos Subsanados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la auditoría integral de **Re-Test** sobre la rama `feature/h43-adjuntar-evidencia-multimedia` mediante inspección estática de código, validación de migraciones Kysely (`npm run db:migrate`), verificación de tipos (`npx tsc --noEmit`), compilación de producción (`npm run build`), análisis estático ESLint (`npm run lint`), validación de contratos OpenAPI 3.0, ejecución completa de la suite Vitest y pruebas funcionales/adversariales en vivo vía HTTP y Redis Pub/Sub (`sgrai:socket-events`) contra PostgreSQL 16 + Redis 7 + FFmpeg + Sharp, se certifica el estado **APROBADO** al comprobarse la subsanación íntegra de los **6 defectos** detectados en la revisión inicial (`BUG-H43-API-01` a `BUG-H43-API-06`).

### Verificación de Correcciones en Re-Test (26/11/2026 21:56)
1. **Exposición de Adjuntos en Centro de Mando e Integridad Relacional (`BUG-H43-API-01` — Resuelto):** `GET /api/incidentes/{id}` (`incidente-kanban.repository.ts` / `incidente-kanban.service.ts`) y `GET /api/misiones/{id}` (`mision.repository.ts` / `mision.service.ts`) consultan los adjuntos vinculados directamente por `incidente_id` y los consolidan deduplicados por `id` junto con los adjuntos de `reporte_terreno` en `data.adjuntos`. Se habilitó además `GET /api/evidencia/adjuntos` protegido por RBAC (`reportes:crear`, `misiones:leer` o `incidentes:kanban`). En `POST /api/evidencia/adjuntos`, `validarAsociacionYAutorizacionAdjuntoRepo` resuelve `incidenteId` y `misionId` vía `innerJoin("mision", ...)` cuando solo se envía `reporte_terreno_id` (reflejado en HTTP `201` y en Redis `adjunto:creado`) y rechaza con `HTTP 409 Conflict` cualquier cruce inconsistente entre `reporte_terreno_id` e `incidente_id`.
2. **Autenticación JWT Estricta, Autorización Horizontal, Invariantes ICS y OpenAPI (`BUG-H43-API-02` — Resuelto):** `POST /api/evidencia/adjuntos` utiliza `exigirUsuarioId(request)` eliminando por completo el fallback `x-user-id` (verificado en vivo con `HTTP 401 Unauthorized`). Para usuarios no administradores, `validarAsociacionYAutorizacionAdjuntoRepo` verifica pertenencia a la patrulla (`usuario_lider_id` / `patrulla_personal`) o cuadrilla (`usuario_delegado_id` / `cuadrilla_personal` activa) asignada (verificado en vivo con `HTTP 403 Forbidden` para unidad ajena) y bloquea incidentes cerrados (`RESUELTO`, `NO_ABORDABLE`) con `HTTP 409 Conflict`. OpenAPI declara `security: [{ BearerAuth: [] }]` tanto en `POST` como en `GET` de `/api/evidencia/adjuntos`.
3. **Configuración de `proxyClientMaxBodySize` en Next.js 16 (`BUG-H43-API-03` — Resuelto):** `next.config.ts` incorpora `experimental: { proxyClientMaxBodySize: "20mb" }` y `route.ts` maneja excepciones de tamaño de cuerpo con `413 Payload Too Large`. Verificado en vivo en producción: archivo válido de `10,485,500` B (`<= 10 MB`) responde `HTTP 201 Created`; archivo de `10,485,860` B (`10 MB + 100 B`) responde `HTTP 413 Payload Too Large`; y envío de `12 MB` con `Transfer-Encoding: chunked` responde `HTTP 413 Payload Too Large`.
4. **Resiliencia `sharp`, Prevención de Huérfanos en Disco, Magic Bytes Estrictos y Tolerancia Socket (`BUG-H43-API-04` — Resuelto):** `optimizarImagen` captura excepciones de decodificación de `sharp` devolviendo `HTTP 415 Unsupported Media Type` (`corrupto.jpg` verificado en vivo). `subirEvidenciaService` valida formato en memoria y existencia/autorización en BD antes de escribir en disco, con rollback (`fs.unlink`) si falla la inserción en PostgreSQL (`404` verificado en vivo sin incrementar archivos en `uploads/evidencia/`). `detectarMimePorMagicBytes` restringe las marcas ISO BMFF a `MP4_BRANDS_PERMITIDOS`/`qt  ` y exige `DocType` `webm` en EBML (`falso_heic.mp4` rechazado con `HTTP 415`). `notificarAdjuntoCreado` se ejecuta dentro de `try/catch`.
5. **Sincronización con `develop` y Migración Idempotente `073` (`BUG-H43-API-05` — Resuelto):** La rama integró `develop` (`041_`, `051_`, `072_` y `rmSync('.next/dev')` en `package.json`) y renumeró la migración de HU-43 a `073_permiso_reportes_crear_y_adjuntos.ts` (correlativo único posterior a `072_evento_atp_base.ts`). `073.up()` usa `ON CONFLICT (codigo) DO NOTHING` preservando `nombre` y `modulo = 'Misiones'` de `056`, y `073.down()` revierte únicamente `idx_adjunto_sha256_hash` y `sha256_hash` sin eliminar `reportes:crear`.
6. **Cabeceras CORS / `nosniff` en `/uploads/evidencia/[filename]` y Pruebas OpenAPI (`BUG-H43-API-06` — Resuelto):** `GET` y `OPTIONS` en `/uploads/evidencia/[filename]` y `next.config.ts` exponen `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Expose-Headers` y `X-Content-Type-Options: nosniff` (`200 OK`, `204 No Content`, `206 Partial Content` verificados en vivo). `src/app/openapi.json/__tests__/route.test.ts` cubre `POST`/`GET /api/evidencia/adjuntos`, `BearerAuth` y esquemas asociados.

| Métrica de Calidad | Auditoría Inicial (24/11/2026) | Re-Test Final (26/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **26** | **26** | 6 defectos subsanados (`BUG-H43-API-01` a `06`) + 20 casos de contrato, RBAC, optimización, streaming y tiempo real (`CP-H43-API-01` a `20`) |
| **Casos Aprobados / Corregidos** | **20** | **26** | 20 casos `APROBADO` + 6 defectos `CORREGIDO` en Re-Test (100% cobertura backend) |
| **Defectos Abiertos / Fallidos (Failed)** | **6** | **0** | 6/6 defectos subsanados (2 críticos, 3 altos, 1 medio) |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Sin bloqueos de infraestructura (PostgreSQL 16, Redis 7, FFmpeg y Next.js 16.3.4) |
| **Tasa de Aprobación Global (% Pass)** | **76.9%** | **100.0%** | Cumplimiento total de los criterios de aceptación backend de HU-43 para merge a `develop` |
| **Suite Directa HU-43 (Vitest)** | **16/16 tests pass** | **29/29 tests pass** | 6 archivos (`adjuntos/route`, `uploads/route`, `073_...`, `evidencia.repository`, `evidencia.service`, `evidencia.storage`) |
| **Suite Global del Repositorio (`npm test`)** | **954/954 tests pass** | **1094/1094 tests pass** | 106 archivos de prueba ejecutados en `8.73s` sin fallos |
| **Compilación y Linter (`tsc`, `build`, `lint`)** | 0 errors / 1 warning | **0 errors / 0 warnings** | `npx tsc --noEmit`, `npm run build` (`proxyClientMaxBodySize: "20mb"`) y `npm run lint` limpios |
| **Migraciones Kysely (`npm run db:migrate`)** | Desfasada (`058` / `052`) | 🟢 **Limpia (`073_`)** | `073_permiso_reportes_crear_y_adjuntos.ts` aplicada sin colisiones ni sobrescritura de `056` |

---

## 2. Registro Técnico de Defectos Subsanados

### `BUG-H43-API-01`: Omisión de Exposición de Adjuntos Asociados a `incidente_id` en Centro de Mando (`GET /api/incidentes/{id}` y `GET /api/misiones/{id}`), Ausencia de `GET /api/evidencia/adjuntos` e Inconsistencia Relacional con `reporte_terreno_id`
* **Severidad:** **CRÍTICA** (Criterios de Aceptación CA-4 y CA-6 e Integridad Relacional en Base de Datos).
* **Estado Post Re-Test (26/11/2026 21:56):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/incidentes/incidente-kanban.repository.ts` / `incidente-kanban.service.ts` / `incidente-kanban.schema.ts`
  * `src/modules/misiones/mision.repository.ts` / `mision.service.ts` / `mision.schema.ts`
  * `src/modules/evidencia/evidencia.repository.ts` / `evidencia.service.ts` / `evidencia.schema.ts`
  * `src/app/api/evidencia/adjuntos/route.ts`
* **Descripción Técnica del Defecto Inicial:**
  `GET /api/incidentes/{id}` y `GET /api/misiones/{id}` consultaban únicamente adjuntos por `reporte_terreno_id`, dejando invisibles los adjuntos directos por `incidente_id`, y no existía `GET /api/evidencia/adjuntos`. Al subir con solo `reporte_terreno_id`, `incidente_id` quedaba en `null` en BD y en el evento `adjunto:creado`, y al combinar un `reporte_terreno_id` con un `incidente_id` ajeno se persistía la relación cruzada.
* **Solución Aplicada y Verificada en Re-Test:**
  1. `GET /api/incidentes/{id}` y `GET /api/misiones/{id}` consultan `adjunto` por `incidente_id`, consolidan y deduplican por `id` junto con los de `reporte_terreno` y exponen `data.adjuntos` (verificado en vivo con `INC-2026-0004` y `MIS-2026-0002`).
  2. Se implementó `GET /api/evidencia/adjuntos` protegido por RBAC (`reportes:crear`, `misiones:leer` o `incidentes:kanban`), verificado en vivo con `200 OK`, `400 Bad Request` sin filtros y `403 Forbidden` para `CALL_CENTER`.
  3. `validarAsociacionYAutorizacionAdjuntoRepo` deriva `incidenteId` y `misionId` vía `innerJoin("mision", ...)` (verificado en HTTP `201` y Redis `adjunto:creado`) y rechaza cruces inconsistentes con `HTTP 409 Conflict`.

---

### `BUG-H43-API-02`: Bypass de Autenticación JWT mediante Cabecera Plana `x-user-id`, Ausencia de Autorización Horizontal (Pertenencia a Misión) y Omisión de `security` en OpenAPI
* **Severidad:** **CRÍTICA** (Autenticación JWT, Control de Acceso Horizontal e Invariantes Operativas ICS).
* **Estado Post Re-Test (26/11/2026 21:56):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/app/api/evidencia/adjuntos/route.ts` (Líneas 69, 113–114)
  * `src/modules/evidencia/evidencia.repository.ts` (Líneas 41–215)
  * `src/lib/openapi/index.ts` (Líneas 2930–3035)
* **Descripción Técnica del Defecto Inicial:**
  El controlador aceptaba `x-user-id` sin verificar firma JWT, omitía verificar pertenencia del usuario a la cuadrilla/patrulla asignada al incidente o reporte, permitía adjuntar archivos en incidentes cerrados (`RESUELTO`/`NO_ABORDABLE`) y no declaraba `security` en OpenAPI.
* **Solución Aplicada y Verificada en Re-Test:**
  1. Se sustituyó por `exigirUsuarioId(request)` sin lectura de `x-user-id` (verificado en vivo con `HTTP 401 Unauthorized` al enviar `-H "x-user-id: 00000000-0000-4000-8000-000000000001"` sin JWT).
  2. `validarAsociacionYAutorizacionAdjuntoRepo` valida pertenencia a patrulla (`usuario_lider_id` / `patrulla_personal`) o cuadrilla (`usuario_delegado_id` / `cuadrilla_personal` activa) salvo Administrador (verificado con `HTTP 403 Forbidden` para `pedro.patrulla@valdivia.cl` sobre `INC-2026-0004`) y rechaza incidentes en `RESUELTO`/`NO_ABORDABLE` con `HTTP 409 Conflict` (verificado en `INC-2026-0006`).
  3. OpenAPI declara `security: [{ BearerAuth: [] }]` en `POST` y `GET` de `/api/evidencia/adjuntos`.

---

### `BUG-H43-API-03`: Truncamiento Silencioso del Cuerpo Multipart a 10 MB por `src/proxy.ts` (`proxyClientMaxBodySize` por Defecto), Devolviendo `400 Bad Request` en Archivos Válidos Cercanos a 10 MB y en Excesos de 10–11 MB o Chunked
* **Severidad:** **ALTA** (Cumplimiento del Límite de 10 MB del Criterio de Aceptación CA-3 en Runtime Next.js 16).
* **Estado Post Re-Test (26/11/2026 21:56):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `next.config.ts` (Líneas 5–7)
  * `src/app/api/evidencia/adjuntos/route.ts` (Líneas 136–155)
* **Descripción Técnica del Defecto Inicial:**
  El límite por defecto de `proxyClientMaxBodySize` (`10mb`) en Next.js 16 truncaba el stream multipart antes del Route Handler, provocando `400 Bad Request` en archivos válidos de `10,485,500` B (`<= 10 MB`) y en excesos entre 10–11 MB o envíos `chunked`.
* **Solución Aplicada y Verificada en Re-Test:**
  Se configuró `experimental: { proxyClientMaxBodySize: "20mb" }` en `next.config.ts` y mapeo defensivo a `413` en `route.ts`. Verificado en vivo en producción: `casi_10mb.pdf` (`10,485,500` B) retorna `HTTP 201 Created`; `grande_10mb.pdf` (`10,485,860` B) retorna `HTTP 413 Payload Too Large`; y `grande_12mb.pdf` con `Transfer-Encoding: chunked` retorna `HTTP 413 Payload Too Large`.

---

### `BUG-H43-API-04`: Excepción No Controlada `500` en `sharp` ante Imágenes Corruptas, Fuga de Archivos Huérfanos en Disco tras Error `404`/`500`, Falsos Positivos `ftyp` en Magic Bytes y Falta de `try/catch` en Emisión Socket
* **Severidad:** **ALTA** (Estabilidad del Servicio, Integridad de Almacenamiento en Disco y Validación Binaria CA-3).
* **Estado Post Re-Test (26/11/2026 21:56):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/evidencia/evidencia.storage.ts` (Líneas 29–56, 115–142, 207–227, 330–347)
  * `src/modules/evidencia/evidencia.service.ts` (Líneas 57–118)
* **Descripción Técnica del Defecto Inicial:**
  Imágenes corruptas lanzaban error no capturado en `sharp` (`500`), el archivo se escribía en disco antes de verificar existencia en BD dejando huérfanos tras `404`, `ftyp` aceptaba `ftypheic`/`ftypavif`/`ftypM4A ` como `video/mp4`, y `notificarAdjuntoCreado` carecía de `try/catch`.
* **Solución Aplicada y Verificada en Re-Test:**
  1. `optimizarImagen` captura fallos de decodificación lanzando `UnsupportedMediaTypeError` (verificado en vivo con `corrupto.jpg` -> `HTTP 415 Unsupported Media Type`).
  2. `subirEvidenciaService` valida primero formato en memoria y existencia/autorización en BD antes de escribir en disco, con limpieza `fs.unlink` ante fallo de inserción (verificado en vivo tras `404`: `FILES BEFORE 404=1 AFTER 404=1`).
  3. `detectarMimePorMagicBytes` valida `MP4_BRANDS_PERMITIDOS`/`qt  ` y `DocType` `webm` en EBML (verificado con `falso_heic.mp4` -> `HTTP 415`).
  4. `notificarAdjuntoCreado` protegido con `try/catch` y cubierto en `evidencia.service.test.ts`.

---

### `BUG-H43-API-05`: Desfase de 65 Commits respecto a `develop`, Divergencia de Migraciones (`052_` vs `035_`/`051_` y Omisión de `041_`/`072_`), y Sobrescritura/Destrucción de `reportes:crear` entre Migración `058` y `056`
* **Severidad:** **ALTA** (Integración Continua, Consistencia del Historial Kysely y Riesgo de Regresión al Mergear).
* **Estado Post Re-Test (26/11/2026 21:56):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/lib/db/migrations/073_permiso_reportes_crear_y_adjuntos.ts`
  * `src/lib/db/migrations/__tests__/073_permiso_reportes_crear_y_adjuntos.test.ts`
  * `package.json` (script `build`)
* **Descripción Técnica del Defecto Inicial:**
  La rama estaba 65 commits detrás de `develop`, carecía de `041_`/`051_`/`072_` y del fix de `build`, y la migración `058` sobrescribía los metadatos de `reportes:crear` de `056` y eliminaba el permiso en `down()`.
* **Solución Aplicada y Verificada en Re-Test:**
  Se integró `develop` en la rama (`merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia`), se recuperó la secuencia completa hasta `072_evento_atp_base.ts` y el script `build` con `rmSync('.next/dev')`, y se renumeró la migración propia a `073_permiso_reportes_crear_y_adjuntos.ts` con `ON CONFLICT (codigo) DO NOTHING` y `down()` no destructivo. Verificado ejecutando `npm run db:migrate` (código `0`) y comprobando intacto el registro `reportes:crear` (`modulo = 'Misiones'`) en PostgreSQL.

---

### `BUG-H43-API-06`: Ausencia de Cabeceras CORS y `X-Content-Type-Options: nosniff` en `GET /uploads/evidencia/[filename]` y Falta de Cobertura OpenAPI en Pruebas de Contrato
* **Severidad:** **MEDIA** (Interoperabilidad Cross-Origin con `sgrai-web`/`sgrai-pwa`, Endurecimiento HTTP y Cobertura de Contrato).
* **Estado Post Re-Test (26/11/2026 21:56):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/app/uploads/evidencia/[filename]/route.ts` (Líneas 26–52, 60–159)
  * `next.config.ts` (Líneas 23–32)
  * `src/app/openapi.json/__tests__/route.test.ts` (Líneas 254–269)
* **Descripción Técnica del Defecto Inicial:**
  `GET /uploads/evidencia/[filename]` omitía `Access-Control-Allow-Origin` y `X-Content-Type-Options: nosniff`, carecía de manejador `OPTIONS`, y `openapi.json/__tests__/route.test.ts` no validaba las rutas de evidencia.
* **Solución Aplicada y Verificada en Re-Test:**
  Se incorporó `buildMediaHeaders`, handler `OPTIONS` (`204 No Content`) y regla `/uploads/:path*` en `next.config.ts`; verificado en vivo en `200 OK`, `204 No Content` y `206 Partial Content`. La suite `src/app/openapi.json/__tests__/route.test.ts` valida `POST`/`GET /api/evidencia/adjuntos`, `BearerAuth` y sus esquemas (`1/1` pass).

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H43-API-01` | Omisión de adjuntos asociados a `incidente_id` en Centro de Mando (`GET /api/incidentes/{id}` y `GET /api/misiones/{id}`), ausencia de `GET /api/evidencia/adjuntos` e incoherencia con `reporte_terreno_id` | Integración / Contrato CA-4 y CA-6 | Repositorio / API | Crítica | Evidencia subida vía `POST /api/evidencia/adjuntos` con `incidente_id` y prueba con `reporte_terreno_id` solo y cruzado | `GET /api/incidentes/a1000000-0000-4000-8000-000000000004`, `GET /api/misiones/d1000000-0000-4000-8000-000000000002`, `GET /api/evidencia/adjuntos` y `POST` con `reporte_terreno_id` solo/cruzado | Centro de Mando expone `data.adjuntos`; `GET /api/evidencia/adjuntos` responde `200`; `reporte_terreno_id` deriva `incidenteId` y `misionId` y rechaza cruce con `409` | `GET /api/incidentes/{id}` y `GET /api/misiones/{id}` exponen `data.adjuntos`; `GET /api/evidencia/adjuntos` retorna `200`; `reporte_terreno_id` deriva `incidenteId`+`misionId` en HTTP y Redis; cruce retorna `409 Conflict` | CORREGIDO | 24/11/2026 14:24 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `BUG-H43-API-02` | Bypass de autenticación JWT mediante cabecera plana `x-user-id`, ausencia de autorización horizontal de misión/unidad e invariantes ICS, y falta de `security` en OpenAPI | Seguridad / Auth / RBAC | Route / Repo / OpenAPI | Crítica | Petición sin `Authorization: Bearer` usando `x-user-id`, usuario de otra patrulla sobre incidente abierto y delegado sobre incidente `RESUELTO` | `POST /api/evidencia/adjuntos` con `-H "x-user-id: 00000000-...0001"`, JWT de `pedro.patrulla@valdivia.cl` en `INC-0004` y `delegado.kanban1` en `INC-0006` (`RESUELTO`) | `401 Unauthorized` sin JWT válido; `403 Forbidden` ante unidad ajena; `409 Conflict` en incidente cerrado; `BearerAuth` declarado en OpenAPI | `x-user-id` retorna `401 Unauthorized`; patrulla ajena retorna `403 Forbidden`; incidente `RESUELTO` retorna `409 Conflict`; OpenAPI expone `security: [{ BearerAuth: [] }]` | CORREGIDO | 24/11/2026 14:23 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `BUG-H43-API-03` | Truncamiento silencioso del cuerpo multipart a 10 MB por `src/proxy.ts` (`proxyClientMaxBodySize`), retornando `400` en archivos válidos de 9.999 MB y en excesos de 10–11 MB o chunked | Límite / Middleware Next.js 16 CA-3 | Proxy / Route | Alta | Servidor Next.js 16.3.4 compilado con `proxyClientMaxBodySize: "20mb"` y archivos de 10,485,500 B, 10,485,860 B y 12 MB chunked | `POST /api/evidencia/adjuntos` con `casi_10mb.pdf` (10,485,500 B), `grande_10mb.pdf` (10,485,860 B) y `grande_12mb.pdf` con `Transfer-Encoding: chunked` | `201 Created` para 10,485,500 B (`<= 10 MB`) y `413 Payload Too Large` para archivos `> 10 MB` (con o sin `Content-Length`) | `casi_10mb.pdf` responde `201 Created` (`tamanoBytes: 10485500`); `grande_10mb.pdf` y `grande_12mb.pdf` chunked responden `413 Payload Too Large` | CORREGIDO | 24/11/2026 14:24 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `BUG-H43-API-04` | Error `500` no controlado en `sharp` por imagen corrupta, fuga de archivos huérfanos en disco tras `404`, falsos positivos `ftyp` (HEIC como MP4) y falta de `try/catch` en Socket | Robustez / Almacenamiento CA-3 y CA-4 | Storage / Service | Alta | Imagen JPEG truncada `corrupto.jpg` (16 B), `incidente_id` inexistente `99999999-...` y `falso_heic.mp4` (`ftypheic`) | `POST /api/evidencia/adjuntos` con `corrupto.jpg`, `foto_orphan.jpg` hacia `99999999-...` y `falso_heic.mp4` como `video/mp4` | `415 Unsupported Media Type` para JPEG corrupto y HEIC; cero archivos huérfanos tras `404`; emisión socket con `try/catch` | `corrupto.jpg` y `falso_heic.mp4` responden `415 Unsupported Media Type`; tras `404` `FILES BEFORE=1 AFTER=1` (0 huérfanos); `try/catch` verificado en Vitest | CORREGIDO | 24/11/2026 14:23 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `BUG-H43-API-05` | Desfase de 65 commits con `develop`, divergencia de migraciones (`052_` vs `035_`/`051_` y omisión `041_`/`072_`), sobrescritura/borrado de `reportes:crear` entre `058` y `056` | Integración / Base de Datos | Git / Migraciones | Alta | Integración de `develop` y migración renumerada `073_permiso_reportes_crear_y_adjuntos.ts` | `npm run db:migrate`, diff de `src/lib/db/migrations/` frente a `develop` y consulta SQL a `permiso` y `kysely_migration` | Rama sincronizada con `develop`, `073_` única tras `072_`, `reportes:crear` sin sobrescritura ni borrado en `down()`, y `build` con `rmSync('.next/dev')` | `npm run db:migrate` exit `0` aplicando `073_`; `permiso` preserva `modulo='Misiones'` de `056`; `073.down()` solo revierte `sha256_hash`; `build` sincronizado | CORREGIDO | 24/11/2026 14:16 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `BUG-H43-API-06` | Ausencia de cabeceras CORS y `nosniff` en `GET /uploads/evidencia/[filename]` y falta de cobertura de `/api/evidencia/adjuntos` en tests OpenAPI | Interoperabilidad / Seguridad HTTP CA-6 | Route / Config / Test | Media | Archivo servido en `/uploads/evidencia/` con origen `http://localhost:3000` y suite `openapi.json/__tests__/route.test.ts` | `curl -I` / `OPTIONS` / `Range` con `-H "Origin: http://localhost:3000"` y `npm test -- src/app/openapi.json/__tests__/route.test.ts` | Cabeceras `Access-Control-Allow-Origin`, `X-Content-Type-Options: nosniff`, `OPTIONS 204` y cobertura OpenAPI en Vitest | `200 OK`, `204 No Content` y `206 Partial Content` incluyen CORS y `nosniff`; `openapi.json/__tests__/route.test.ts` pasa validando `POST`/`GET` y esquemas | CORREGIDO | 24/11/2026 14:24 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-01` | Rechazo de petición `POST /api/evidencia/adjuntos` sin credenciales de autenticación (`401 Unauthorized`) | Seguridad / Auth | Route Handler | Crítica | Servidor activo; petición sin cabecera `Authorization` | `POST /api/evidencia/adjuntos` con `informe.pdf` e `incidente_id=a1000000-0000-4000-8000-000000000004` sin JWT | `HTTP 401 Unauthorized` con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | `HTTP 401 Unauthorized` con mensaje exacto esperado | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-02` | Rechazo RBAC para usuario autenticado sin permiso `reportes:crear` (`403 Forbidden` — CA-7) | Seguridad / RBAC | Route / Auth | Crítica | Usuario `callcenter@valdivia.cl` (`CALL_CENTER`) autenticado vía JWT | `POST /api/evidencia/adjuntos` y `GET /api/evidencia/adjuntos` con `Authorization: Bearer <TOKEN_CALLCENTER>` | `HTTP 403 Forbidden` indicando ausencia del permiso requerido | `HTTP 403 Forbidden` en ambos endpoints denegando acceso a `CALL_CENTER` | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:56 | feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43) |
| `CP-H43-API-03` | Verificación de asignación del permiso `reportes:crear` a `DELEGADO_CUADRILLA`, `PATRULLA_VERIFICADORA` y `ADMIN` (CA-7) | Seguridad / RBAC | BD / Endpoint | Alta | Migración `073` ejecutada y usuarios sembrados en PostgreSQL | Subida con JWT de `delegado.kanban1@valdivia.cl` (`DELEGADO_CUADRILLA`) y `matias.patrulla@valdivia.cl` (`PATRULLA_VERIFICADORA`) y consulta SQL a `permiso`/`rol_permiso` | Los 3 roles poseen `reportes:crear` y operan sobre sus misiones asignadas | `DELEGADO_CUADRILLA` y `PATRULLA_VERIFICADORA` autorizados (`201 Created`) y `permiso` íntegro en BD | APROBADO | 24/11/2026 14:25 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-04` | Rechazo de petición sin formato `multipart/form-data` (`400 Bad Request`) | Validación / Contrato | Route Handler | Media | Usuario autorizado con JWT válido | `POST /api/evidencia/adjuntos` con `-H "Content-Type: application/json" -d '{}'` | `HTTP 400 Bad Request` indicando que debe enviarse como `multipart/form-data` | `HTTP 400 Bad Request`: `{"message":"La solicitud debe enviarse en formato multipart/form-data."}` | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-05` | Rechazo de petición `multipart/form-data` sin campo binario `file` (`400 Bad Request`) | Validación / Multipart | Route Handler | Media | Usuario autorizado con JWT válido | `POST /api/evidencia/adjuntos` enviando únicamente `-F "incidente_id=a1000000-0000-4000-8000-000000000004"` | `HTTP 400 Bad Request` solicitando el campo `file` | `HTTP 400 Bad Request`: `{"message":"Debe adjuntar un archivo en el campo 'file'."}` | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-06` | Rechazo de archivo vacío de `0` bytes (`400 Bad Request`) | Validación / Límite | Storage / Route | Media | Archivo `vacio.jpg` de `0` bytes | `POST /api/evidencia/adjuntos` con `vacio.jpg;type=image/jpeg` e `incidente_id` válido y `evidencia.storage.test.ts` | `HTTP 400 Bad Request` indicando que el archivo está vacío | `HTTP 400 Bad Request`: `{"message":"El archivo proporcionado está vacío."}` | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-07` | Rechazo cuando se omiten ambos identificadores de asociación `incidente_id` y `reporte_terreno_id` (`400 Bad Request` — CA-4) | Validación / Zod | Schema / Route | Alta | Archivo `informe.pdf` válido y usuario autorizado | `POST /api/evidencia/adjuntos` y `GET /api/evidencia/adjuntos` sin IDs | `HTTP 400 Bad Request` exigiendo al menos `incidente_id` o `reporte_terreno_id` | `HTTP 400 Bad Request` en `POST` (`campo: "asociacion"`) y `GET` (`campo: "query"`) | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:56 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-08` | Rechazo por formato UUID inválido en `incidente_id` o `reporte_terreno_id` (`400 Bad Request`) | Validación / Zod | Schema / Route | Media | Archivo válido y usuario autorizado | `POST /api/evidencia/adjuntos` con `incidente_id=no-es-uuid` | `HTTP 400 Bad Request` detallando error en campo `incidente_id` | `HTTP 400 Bad Request` con `errors[0].campo: "incidente_id"` | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-09` | Rechazo de archivo superior a `10 MB` con o sin cabecera `Content-Length` (`413 Payload Too Large` — CA-3) | Validación / Límite | Route Handler | Alta | `grande_10mb.pdf` (`10,485,860` B) y `grande_12mb.pdf` (`12,582,912` B) | `POST /api/evidencia/adjuntos` con `grande_10mb.pdf` y `grande_12mb.pdf` (`Transfer-Encoding: chunked`) | `HTTP 413 Payload Too Large` indicando límite máximo de 10 MB | `HTTP 413 Payload Too Large` en ambos escenarios | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-10` | Rechazo de tipo MIME no autorizado en lista blanca (`application/x-msdownload` — CA-3) | Seguridad / Validación | Storage / Route | Crítica | Archivo `malware.exe` con cabecera `MZ` | `POST /api/evidencia/adjuntos` con `malware.exe;type=application/x-msdownload` y suite `evidencia.storage.test.ts` | `HTTP 415 Unsupported Media Type` rechazando el archivo | `HTTP 415 Unsupported Media Type` rechazando MIME fuera de lista blanca | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-11` | Rechazo de suplantación de extensión/MIME mediante inspección binaria de magic bytes (`415 Unsupported Media Type` — CA-3) | Seguridad / Magic Bytes | Storage / Route | Crítica | Archivo `informe.pdf` (`%PDF-1.4`) declarado como `image/jpeg` y `falso_heic.mp4` como `video/mp4` | `POST /api/evidencia/adjuntos` con firmas falsificadas y `evidencia.storage.test.ts` | `HTTP 415 Unsupported Media Type` detectando discrepancia de firma binaria | `HTTP 415 Unsupported Media Type` rechazando suplantación PDF->JPEG y HEIC->MP4 | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-12` | Rechazo HTTP `404 Not Found` cuando `incidente_id` o `reporte_terreno_id` no existe en PostgreSQL sin escritura en disco | Funcional / Negativa | Repository / Route | Alta | UUID inexistente `99999999-9999-4999-8999-999999999999` | `POST /api/evidencia/adjuntos` con `foto_orphan.jpg` e `incidente_id=99999999-9999-4999-8999-999999999999` | `HTTP 404 Not Found` y 0 archivos creados en `uploads/evidencia/` | `HTTP 404 Not Found` y `FILES BEFORE 404=1 AFTER 404=1` | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-13` | Carga exitosa, redimensionamiento (`<= 1920px`) y compresión WebP de imagen `image/png` (`201 Created` — CA-3 y CA-4) | Funcional / Optimización | End-to-End API | Crítica | Imagen `foto_valida.png` (`2200x1400`, `11,226` B) y JWT de `delegado.kanban1@valdivia.cl` | `POST /api/evidencia/adjuntos` con `foto_valida.png;type=image/png` e `incidente_id=a1000000-0000-4000-8000-000000000004` | `HTTP 201 Created`, conversión a `image/webp` con reducción de peso, hash SHA-256 y fila en `adjunto` | `HTTP 201 Created` con `tipoMime: "image/webp"`, `tamanoBytes: 4292`, `url: "/uploads/evidencia/e4148a...webp"` | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:56 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-14` | Carga exitosa y optimización a WebP de imágenes `image/jpeg` e `image/webp` (`201 Created` — CA-3 y CA-4) | Funcional / Positiva | End-to-End API | Alta | `foto_orphan.jpg` (`3,120` B) y `foto_webp.webp` (`628` B) | `POST /api/evidencia/adjuntos` con `image/jpeg` e `image/webp` hacia incidente asignado | `HTTP 201 Created` con `tipoMime: "image/webp"` y registro persistido en tabla `adjunto` | `HTTP 201 Created` (`tamanoBytes: 952` para JPEG y `628` para WebP) persistidos en `adjunto` | APROBADO | 24/11/2026 14:25 | 26/11/2026 21:55 | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-15` | Carga exitosa de documento técnico `application/pdf` (incluyendo archivo de 9.999 MB) y persistencia en `adjunto` (`201 Created` — CA-3 y CA-4) | Funcional / Positiva | End-to-End API | Alta | `informe.pdf` (`77` B) y `casi_10mb.pdf` (`10,485,500` B) | `POST /api/evidencia/adjuntos` con `casi_10mb.pdf` a `INC-0004` e `informe.pdf` a `reporte_terreno_id` en `MIS-0001` | `HTTP 201 Created` preservando `tipoMime: "application/pdf"`, tamaño exacto y `sha256_hash` en BD | `HTTP 201 Created` (`10485500` B y `77` B con `incidenteId` y `misionId` derivados) | APROBADO | 24/11/2026 14:23 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-16` | Carga exitosa y transcodificación de video `video/mp4` con `ffmpeg` (`201 Created`) | Funcional / Multimedia | End-to-End API | Alta | Video MP4 real (`1600x900`, `4,781` B) y binario `ffmpeg` disponible en entorno | `POST /api/evidencia/adjuntos` con `video_prueba.mp4;type=video/mp4` e `incidente_id=a1000000-0000-4000-8000-000000000004` | `HTTP 201 Created` con video escalado a 720p/H.264/AAC y tamaño optimizado en disco | `HTTP 201 Created` con `tipoMime: "video/mp4"`, `tamanoBytes: 4296` (`url: "/uploads/evidencia/9c7ef9...mp4"`) | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:56 | chore(docker): configurar ffmpeg y volumen persistente uploads_data para evidencias (HU-43) |
| `CP-H43-API-17` | Deduplicación física en disco mediante `sha256_hash` ante reintentos offline repetidos (`201 Created` — CA-5) | Integridad / Almacenamiento | Storage / BD | Alta | Misma imagen subida consecutivamente en `evidencia.storage.test.ts` y API en vivo | Dos envíos de la misma imagen y verificación de `uploads/evidencia/` | Ambas respuestas comparten el mismo `url` (`/uploads/evidencia/<hash>.webp`) y existe un único archivo físico en disco | Deduplicación verificada en `evidencia.storage.test.ts` (`6/6` pass) y en vivo con hash idéntico `e4148a...webp` | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:55 | feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43) |
| `CP-H43-API-18` | Descarga (`200 OK`), `OPTIONS` (`204`), streaming `Range` (`206`), CORS + `nosniff`, bloqueo de path traversal (`400`) y no encontrado (`404`) en `/uploads/evidencia/[filename]` | Funcional / Seguridad | Route Handler | Alta | Archivos almacenados en `${UPLOAD_DIR}/evidencia/` | `GET`, `OPTIONS`, `GET` con `Range: bytes=0-15`, `GET ..secret.mp4` y `GET inexistente.webp` con `Origin: http://localhost:3000` | `200 OK`, `204 No Content`, `206 Partial Content` (`bytes 0-15/4296`) con CORS+`nosniff`, `400` en traversal y `404` si no existe | Todos los códigos HTTP y cabeceras CORS/`nosniff`/`Accept-Ranges` verificados en vivo y en Vitest (`4/4` pass) | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-19` | Emisión del evento WebSocket `adjunto:creado` en Redis Pub/Sub (`sgrai:socket-events`) con `incidenteId` y `misionId` hacia salas del Centro de Mando (CA-6) | Tiempo Real / Socket.io | Service / Redis | Alta | Redis activo en `localhost:6001` y suscriptor en canal `sgrai:socket-events` | Subida con `incidente_id` (PNG/MP4) y con `reporte_terreno_id` solo (PDF) | Publicación simétrica hacia `encargado`, `sala:encargados` y `supervisor` incluyendo `incidenteId` y `misionId` cuando corresponda | Canal `sgrai:socket-events` recibió 3 mensajes por adjunto; con `reporte_terreno_id` solo incluyó `incidenteId: a1000000-...0003` y `misionId: d1000000-...0001` | APROBADO | 24/11/2026 14:24 | 26/11/2026 21:56 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `CP-H43-API-20` | Compilación limpia (`tsc` / `next build`), linter (`eslint`) y ejecución de suite Vitest (HU-43 y global) | Automatización / CI | Unit / Build | Alta | Código fuente actualizado tras fixes de Re-Test | `npx tsc --noEmit`, `npm run build`, `npm run lint` y `npm test` (6 archivos HU-43 y 106 globales) | `0` errores en TypeScript, build y ESLint; 100% de pruebas unitarias pasando | `tsc` y `build` exit `0`; `eslint` `0 errors, 0 warnings`; Vitest `29/29` en HU-43 (`6/6` archivos) y `1094/1094` global (`106/106` archivos) | APROBADO | 24/11/2026 14:26 | 26/11/2026 21:55 | fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H43-API-01	Omisión de adjuntos asociados a incidente_id en Centro de Mando (GET /api/incidentes/{id} y GET /api/misiones/{id}), ausencia de GET /api/evidencia/adjuntos e incoherencia con reporte_terreno_id	Integración / Contrato CA-4 y CA-6	Repositorio / API	Crítica	Evidencia subida vía POST /api/evidencia/adjuntos con incidente_id y prueba con reporte_terreno_id solo y cruzado	GET /api/incidentes/a1000000-0000-4000-8000-000000000004, GET /api/misiones/d1000000-0000-4000-8000-000000000002, GET /api/evidencia/adjuntos y POST con reporte_terreno_id solo/cruzado	Centro de Mando expone data.adjuntos; GET /api/evidencia/adjuntos responde 200; reporte_terreno_id deriva incidenteId y misionId y rechaza cruce con 409	GET /api/incidentes/{id} y GET /api/misiones/{id} exponen data.adjuntos; GET /api/evidencia/adjuntos retorna 200; reporte_terreno_id deriva incidenteId+misionId en HTTP y Redis; cruce retorna 409 Conflict	CORREGIDO	24/11/2026 14:24	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
BUG-H43-API-02	Bypass de autenticación JWT mediante cabecera plana x-user-id, ausencia de autorización horizontal de misión/unidad e invariantes ICS, y falta de security en OpenAPI	Seguridad / Auth / RBAC	Route / Repo / OpenAPI	Crítica	Petición sin Authorization: Bearer usando x-user-id, usuario de otra patrulla sobre incidente abierto y delegado sobre incidente RESUELTO	POST /api/evidencia/adjuntos con -H "x-user-id: 00000000-...0001", JWT de pedro.patrulla@valdivia.cl en INC-0004 y delegado.kanban1 en INC-0006 (RESUELTO)	401 Unauthorized sin JWT válido; 403 Forbidden ante unidad ajena; 409 Conflict en incidente cerrado; BearerAuth declarado en OpenAPI	x-user-id retorna 401 Unauthorized; patrulla ajena retorna 403 Forbidden; incidente RESUELTO retorna 409 Conflict; OpenAPI expone security: [{ BearerAuth: [] }]	CORREGIDO	24/11/2026 14:23	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
BUG-H43-API-03	Truncamiento silencioso del cuerpo multipart a 10 MB por src/proxy.ts (proxyClientMaxBodySize), retornando 400 en archivos válidos de 9.999 MB y en excesos de 10–11 MB o chunked	Límite / Middleware Next.js 16 CA-3	Proxy / Route	Alta	Servidor Next.js 16.3.4 compilado con proxyClientMaxBodySize: "20mb" y archivos de 10,485,500 B, 10,485,860 B y 12 MB chunked	POST /api/evidencia/adjuntos con casi_10mb.pdf (10,485,500 B), grande_10mb.pdf (10,485,860 B) y grande_12mb.pdf con Transfer-Encoding: chunked	201 Created para 10,485,500 B (<= 10 MB) y 413 Payload Too Large para archivos > 10 MB (con o sin Content-Length)	casi_10mb.pdf responde 201 Created (tamanoBytes: 10485500); grande_10mb.pdf y grande_12mb.pdf chunked responden 413 Payload Too Large	CORREGIDO	24/11/2026 14:24	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
BUG-H43-API-04	Error 500 no controlado en sharp por imagen corrupta, fuga de archivos huérfanos en disco tras 404, falsos positivos ftyp (HEIC como MP4) y falta de try/catch en Socket	Robustez / Almacenamiento CA-3 y CA-4	Storage / Service	Alta	Imagen JPEG truncada corrupto.jpg (16 B), incidente_id inexistente 99999999-... y falso_heic.mp4 (ftypheic)	POST /api/evidencia/adjuntos con corrupto.jpg, foto_orphan.jpg hacia 99999999-... y falso_heic.mp4 como video/mp4	415 Unsupported Media Type para JPEG corrupto y HEIC; cero archivos huérfanos tras 404; emisión socket con try/catch	corrupto.jpg y falso_heic.mp4 responden 415 Unsupported Media Type; tras 404 FILES BEFORE=1 AFTER=1 (0 huérfanos); try/catch verificado en Vitest	CORREGIDO	24/11/2026 14:23	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
BUG-H43-API-05	Desfase de 65 commits con develop, divergencia de migraciones (052_ vs 035_/051_ y omisión 041_/072_), sobrescritura/borrado de reportes:crear entre 058 y 056	Integración / Base de Datos	Git / Migraciones	Alta	Integración de develop y migración renumerada 073_permiso_reportes_crear_y_adjuntos.ts	npm run db:migrate, diff de src/lib/db/migrations/ frente a develop y consulta SQL a permiso y kysely_migration	Rama sincronizada con develop, 073_ única tras 072_, reportes:crear sin sobrescritura ni borrado en down(), y build con rmSync('.next/dev')	npm run db:migrate exit 0 aplicando 073_; permiso preserva modulo='Misiones' de 056; 073.down() solo revierte sha256_hash; build sincronizado	CORREGIDO	24/11/2026 14:16	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
BUG-H43-API-06	Ausencia de cabeceras CORS y nosniff en GET /uploads/evidencia/[filename] y falta de cobertura de /api/evidencia/adjuntos en tests OpenAPI	Interoperabilidad / Seguridad HTTP CA-6	Route / Config / Test	Media	Archivo servido en /uploads/evidencia/ con origen http://localhost:3000 y suite openapi.json/__tests__/route.test.ts	curl -I / OPTIONS / Range con -H "Origin: http://localhost:3000" y npm test -- src/app/openapi.json/__tests__/route.test.ts	Cabeceras Access-Control-Allow-Origin, X-Content-Type-Options: nosniff, OPTIONS 204 y cobertura OpenAPI en Vitest	200 OK, 204 No Content y 206 Partial Content incluyen CORS y nosniff; openapi.json/__tests__/route.test.ts pasa validando POST/GET y esquemas	CORREGIDO	24/11/2026 14:24	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-01	Rechazo de petición POST /api/evidencia/adjuntos sin credenciales de autenticación (401 Unauthorized)	Seguridad / Auth	Route Handler	Crítica	Servidor activo; petición sin cabecera Authorization	POST /api/evidencia/adjuntos con informe.pdf e incidente_id=a1000000-0000-4000-8000-000000000004 sin JWT	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	HTTP 401 Unauthorized con mensaje exacto esperado	APROBADO	24/11/2026 14:23	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-02	Rechazo RBAC para usuario autenticado sin permiso reportes:crear (403 Forbidden — CA-7)	Seguridad / RBAC	Route / Auth	Crítica	Usuario callcenter@valdivia.cl (CALL_CENTER) autenticado vía JWT	POST /api/evidencia/adjuntos y GET /api/evidencia/adjuntos con Authorization: Bearer <TOKEN_CALLCENTER>	HTTP 403 Forbidden indicando ausencia del permiso requerido	HTTP 403 Forbidden en ambos endpoints denegando acceso a CALL_CENTER	APROBADO	24/11/2026 14:23	26/11/2026 21:56	feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)
CP-H43-API-03	Verificación de asignación del permiso reportes:crear a DELEGADO_CUADRILLA, PATRULLA_VERIFICADORA y ADMIN (CA-7)	Seguridad / RBAC	BD / Endpoint	Alta	Migración 073 ejecutada y usuarios sembrados en PostgreSQL	Subida con JWT de delegado.kanban1@valdivia.cl (DELEGADO_CUADRILLA) y matias.patrulla@valdivia.cl (PATRULLA_VERIFICADORA) y consulta SQL a permiso/rol_permiso	Los 3 roles poseen reportes:crear y operan sobre sus misiones asignadas	DELEGADO_CUADRILLA y PATRULLA_VERIFICADORA autorizados (201 Created) y permiso íntegro en BD	APROBADO	24/11/2026 14:25	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-04	Rechazo de petición sin formato multipart/form-data (400 Bad Request)	Validación / Contrato	Route Handler	Media	Usuario autorizado con JWT válido	POST /api/evidencia/adjuntos con -H "Content-Type: application/json" -d '{}'	HTTP 400 Bad Request indicando que debe enviarse como multipart/form-data	HTTP 400 Bad Request: {"message":"La solicitud debe enviarse en formato multipart/form-data."}	APROBADO	24/11/2026 14:23	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-05	Rechazo de petición multipart/form-data sin campo binario file (400 Bad Request)	Validación / Multipart	Route Handler	Media	Usuario autorizado con JWT válido	POST /api/evidencia/adjuntos enviando únicamente -F "incidente_id=a1000000-0000-4000-8000-000000000004"	HTTP 400 Bad Request solicitando el campo file	HTTP 400 Bad Request: {"message":"Debe adjuntar un archivo en el campo 'file'."}	APROBADO	24/11/2026 14:23	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-06	Rechazo de archivo vacío de 0 bytes (400 Bad Request)	Validación / Límite	Storage / Route	Media	Archivo vacio.jpg de 0 bytes	POST /api/evidencia/adjuntos con vacio.jpg;type=image/jpeg e incidente_id válido y evidencia.storage.test.ts	HTTP 400 Bad Request indicando que el archivo está vacío	HTTP 400 Bad Request: {"message":"El archivo proporcionado está vacío."}	APROBADO	24/11/2026 14:23	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-07	Rechazo cuando se omiten ambos identificadores de asociación incidente_id y reporte_terreno_id (400 Bad Request — CA-4)	Validación / Zod	Schema / Route	Alta	Archivo informe.pdf válido y usuario autorizado	POST /api/evidencia/adjuntos y GET /api/evidencia/adjuntos sin IDs	HTTP 400 Bad Request exigiendo al menos incidente_id o reporte_terreno_id	HTTP 400 Bad Request en POST (campo: "asociacion") y GET (campo: "query")	APROBADO	24/11/2026 14:23	26/11/2026 21:56	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-08	Rechazo por formato UUID inválido en incidente_id o reporte_terreno_id (400 Bad Request)	Validación / Zod	Schema / Route	Media	Archivo válido y usuario autorizado	POST /api/evidencia/adjuntos con incidente_id=no-es-uuid	HTTP 400 Bad Request detallando error en campo incidente_id	HTTP 400 Bad Request con errors[0].campo: "incidente_id"	APROBADO	24/11/2026 14:23	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-09	Rechazo de archivo superior a 10 MB con o sin cabecera Content-Length (413 Payload Too Large — CA-3)	Validación / Límite	Route Handler	Alta	grande_10mb.pdf (10,485,860 B) y grande_12mb.pdf (12,582,912 B)	POST /api/evidencia/adjuntos con grande_10mb.pdf y grande_12mb.pdf (Transfer-Encoding: chunked)	HTTP 413 Payload Too Large indicando límite máximo de 10 MB	HTTP 413 Payload Too Large en ambos escenarios	APROBADO	24/11/2026 14:24	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-10	Rechazo de tipo MIME no autorizado en lista blanca (application/x-msdownload — CA-3)	Seguridad / Validación	Storage / Route	Crítica	Archivo malware.exe con cabecera MZ	POST /api/evidencia/adjuntos con malware.exe;type=application/x-msdownload y suite evidencia.storage.test.ts	HTTP 415 Unsupported Media Type rechazando el archivo	HTTP 415 Unsupported Media Type rechazando MIME fuera de lista blanca	APROBADO	24/11/2026 14:23	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-11	Rechazo de suplantación de extensión/MIME mediante inspección binaria de magic bytes (415 Unsupported Media Type — CA-3)	Seguridad / Magic Bytes	Storage / Route	Crítica	Archivo informe.pdf (%PDF-1.4) declarado como image/jpeg y falso_heic.mp4 como video/mp4	POST /api/evidencia/adjuntos con firmas falsificadas y evidencia.storage.test.ts	HTTP 415 Unsupported Media Type detectando discrepancia de firma binaria	HTTP 415 Unsupported Media Type rechazando suplantación PDF->JPEG y HEIC->MP4	APROBADO	24/11/2026 14:23	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-12	Rechazo HTTP 404 Not Found cuando incidente_id o reporte_terreno_id no existe en PostgreSQL sin escritura en disco	Funcional / Negativa	Repository / Route	Alta	UUID inexistente 99999999-9999-4999-8999-999999999999	POST /api/evidencia/adjuntos con foto_orphan.jpg e incidente_id=99999999-9999-4999-8999-999999999999	HTTP 404 Not Found y 0 archivos creados en uploads/evidencia/	HTTP 404 Not Found y FILES BEFORE 404=1 AFTER 404=1	APROBADO	24/11/2026 14:24	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-13	Carga exitosa, redimensionamiento (<= 1920px) y compresión WebP de imagen image/png (201 Created — CA-3 y CA-4)	Funcional / Optimización	End-to-End API	Crítica	Imagen foto_valida.png (2200x1400, 11,226 B) y JWT de delegado.kanban1@valdivia.cl	POST /api/evidencia/adjuntos con foto_valida.png;type=image/png e incidente_id=a1000000-0000-4000-8000-000000000004	HTTP 201 Created, conversión a image/webp con reducción de peso, hash SHA-256 y fila en adjunto	HTTP 201 Created con tipoMime: "image/webp", tamanoBytes: 4292, url: "/uploads/evidencia/e4148a...webp"	APROBADO	24/11/2026 14:24	26/11/2026 21:56	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-14	Carga exitosa y optimización a WebP de imágenes image/jpeg e image/webp (201 Created — CA-3 y CA-4)	Funcional / Positiva	End-to-End API	Alta	foto_orphan.jpg (3,120 B) y foto_webp.webp (628 B)	POST /api/evidencia/adjuntos con image/jpeg e image/webp hacia incidente asignado	HTTP 201 Created con tipoMime: "image/webp" y registro persistido en tabla adjunto	HTTP 201 Created (tamanoBytes: 952 para JPEG y 628 para WebP) persistidos en adjunto	APROBADO	24/11/2026 14:25	26/11/2026 21:55	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-15	Carga exitosa de documento técnico application/pdf (incluyendo archivo de 9.999 MB) y persistencia en adjunto (201 Created — CA-3 y CA-4)	Funcional / Positiva	End-to-End API	Alta	informe.pdf (77 B) y casi_10mb.pdf (10,485,500 B)	POST /api/evidencia/adjuntos con casi_10mb.pdf a INC-0004 e informe.pdf a reporte_terreno_id en MIS-0001	HTTP 201 Created preservando tipoMime: "application/pdf", tamaño exacto y sha256_hash en BD	HTTP 201 Created (10485500 B y 77 B con incidenteId y misionId derivados)	APROBADO	24/11/2026 14:23	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-16	Carga exitosa y transcodificación de video video/mp4 con ffmpeg (201 Created)	Funcional / Multimedia	End-to-End API	Alta	Video MP4 real (1600x900, 4,781 B) y binario ffmpeg disponible en entorno	POST /api/evidencia/adjuntos con video_prueba.mp4;type=video/mp4 e incidente_id=a1000000-0000-4000-8000-000000000004	HTTP 201 Created con video escalado a 720p/H.264/AAC y tamaño optimizado en disco	HTTP 201 Created con tipoMime: "video/mp4", tamanoBytes: 4296 (url: "/uploads/evidencia/9c7ef9...mp4")	APROBADO	24/11/2026 14:24	26/11/2026 21:56	chore(docker): configurar ffmpeg y volumen persistente uploads_data para evidencias (HU-43)
CP-H43-API-17	Deduplicación física en disco mediante sha256_hash ante reintentos offline repetidos (201 Created — CA-5)	Integridad / Almacenamiento	Storage / BD	Alta	Misma imagen subida consecutivamente en evidencia.storage.test.ts y API en vivo	Dos envíos de la misma imagen y verificación de uploads/evidencia/	Ambas respuestas comparten el mismo url (/uploads/evidencia/<hash>.webp) y existe un único archivo físico en disco	Deduplicación verificada en evidencia.storage.test.ts (6/6 pass) y en vivo con hash idéntico e4148a...webp	APROBADO	24/11/2026 14:24	26/11/2026 21:55	feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)
CP-H43-API-18	Descarga (200 OK), OPTIONS (204), streaming Range (206), CORS + nosniff, bloqueo de path traversal (400) y no encontrado (404) en /uploads/evidencia/[filename]	Funcional / Seguridad	Route Handler	Alta	Archivos almacenados en ${UPLOAD_DIR}/evidencia/	GET, OPTIONS, GET con Range: bytes=0-15, GET ..secret.mp4 y GET inexistente.webp con Origin: http://localhost:3000	200 OK, 204 No Content, 206 Partial Content (bytes 0-15/4296) con CORS+nosniff, 400 en traversal y 404 si no existe	Todos los códigos HTTP y cabeceras CORS/nosniff/Accept-Ranges verificados en vivo y en Vitest (4/4 pass)	APROBADO	24/11/2026 14:24	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-19	Emisión del evento WebSocket adjunto:creado en Redis Pub/Sub (sgrai:socket-events) con incidenteId y misionId hacia salas del Centro de Mando (CA-6)	Tiempo Real / Socket.io	Service / Redis	Alta	Redis activo en localhost:6001 y suscriptor en canal sgrai:socket-events	Subida con incidente_id (PNG/MP4) y con reporte_terreno_id solo (PDF)	Publicación simétrica hacia encargado, sala:encargados y supervisor incluyendo incidenteId y misionId cuando corresponda	Canal sgrai:socket-events recibió 3 mensajes por adjunto; con reporte_terreno_id solo incluyó incidenteId: a1000000-...0003 y misionId: d1000000-...0001	APROBADO	24/11/2026 14:24	26/11/2026 21:56	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
CP-H43-API-20	Compilación limpia (tsc / next build), linter (eslint) y ejecución de suite Vitest (HU-43 y global)	Automatización / CI	Unit / Build	Alta	Código fuente actualizado tras fixes de Re-Test	npx tsc --noEmit, npm run build, npm run lint y npm test (6 archivos HU-43 y 106 globales)	0 errores en TypeScript, build y ESLint; 100% de pruebas unitarias pasando	tsc y build exit 0; eslint 0 errors, 0 warnings; Vitest 29/29 en HU-43 (6/6 archivos) y 1094/1094 global (106/106 archivos)	APROBADO	24/11/2026 14:26	26/11/2026 21:55	fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Pruebas Automatizadas (Vitest), Compilación, Linter y Migraciones (`CP-H43-API-20` y `BUG-H43-API-05`)

```bash
npm run db:migrate && npm run lint && npx tsc --noEmit && npm run build
npm test -- \
  src/app/api/evidencia/adjuntos/__tests__/route.test.ts \
  src/app/uploads/evidencia/[filename]/__tests__/route.test.ts \
  src/lib/db/migrations/__tests__/073_permiso_reportes_crear_y_adjuntos.test.ts \
  src/modules/evidencia/__tests__/evidencia.repository.test.ts \
  src/modules/evidencia/__tests__/evidencia.service.test.ts \
  src/modules/evidencia/__tests__/evidencia.storage.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
npm test
```

**Salidas reales obtenidas en Re-Test (26/11/2026):**
```text
npm run db:migrate:
[OK] Migración Kysely ejecutada con éxito: "073_permiso_reportes_crear_y_adjuntos"
Todas las migraciones se completaron correctamente.

npm run lint:
exit code 0 (0 errors, 0 warnings)

npx tsc --noEmit && npm run build:
- Experiments (use with caution):
  · proxyClientMaxBodySize: "20mb"
✓ Compiled successfully in 13.2s
✓ Finished TypeScript in 46s

Vitest HU-43 (6 archivos):
 ✓ src/modules/evidencia/__tests__/evidencia.repository.test.ts (5 tests)
 ✓ src/modules/evidencia/__tests__/evidencia.service.test.ts (4 tests)
 ✓ src/lib/db/migrations/__tests__/073_permiso_reportes_crear_y_adjuntos.test.ts (2 tests)
 ✓ src/app/api/evidencia/adjuntos/__tests__/route.test.ts (8 tests)
 ✓ src/app/uploads/evidencia/[filename]/__tests__/route.test.ts (4 tests)
 ✓ src/modules/evidencia/__tests__/evidencia.storage.test.ts (6 tests)
 Test Files  6 passed (6) | Tests 29 passed (29) in 1.04s

Vitest Global:
 Test Files  106 passed (106)
      Tests  1094 passed (1094)
   Duration  8.73s
```

---

### 5.2 Evidencias HTTP/JSON Reales en Vivo del Re-Test (`POST` / `GET` `/api/evidencia/adjuntos`, Centro de Mando y `/uploads`)

#### Autenticación JWT de Perfiles de Prueba
```bash
get_token() {
  curl -s -X POST http://localhost:3001/api/seguridad/login \
    -H "Content-Type: application/json" \
    -d "{\"identificador\":\"$1\",\"password\":\"Valdivia2026!\"}" | \
    node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.token ?? d.data?.token ?? '')"
}
TOKEN_DEL1=$(get_token "delegado.kanban1@valdivia.cl")
TOKEN_MATIAS=$(get_token "matias.patrulla@valdivia.cl")
TOKEN_PEDRO=$(get_token "pedro.patrulla@valdivia.cl")
TOKEN_ENCARGADO=$(get_token "encargado@valdivia.cl")
TOKEN_CALLCENTER=$(get_token "callcenter@valdivia.cl")
```

#### Verificación `BUG-H43-API-02`: Rechazo `x-user-id` (`401`), Autorización Horizontal (`403`) e Incidente Cerrado (`409`)
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000006"
```
**Respuestas reales obtenidas:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```
```http
HTTP/1.1 403 Forbidden
{"message":"No tiene autorización para adjuntar evidencia en un incidente o reporte asignado a otra unidad."}
```
```http
HTTP/1.1 409 Conflict
{"message":"No es posible adjuntar evidencia a un incidente en estado cerrado (RESUELTO)."}
```

#### Verificación `BUG-H43-API-03`: Archivo Válido de 9.999 MB (`201`) y Excesos de 10 MB + 100 B / 12 MB Chunked (`413`)
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -F "file=@$FIXTURES/casi_10mb.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -F "file=@$FIXTURES/grande_10mb.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -H "Transfer-Encoding: chunked" \
  -F "file=@$FIXTURES/grande_12mb.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"
```
**Respuestas reales obtenidas:**
```http
HTTP/1.1 201 Created
{"id":"ecf589af-8cd1-48d2-8d78-ce4fe8bc6f78","nombreArchivo":"casi_10mb.pdf","url":"/uploads/evidencia/679a4ba6100f08cdf6d6932d9a893c07a64a6eb4ec3890008d8e5639a9424aa5.pdf","tipoMime":"application/pdf","tamanoBytes":10485500,"incidenteId":"a1000000-0000-4000-8000-000000000004","reporteTerrenoId":null,"creadoEn":"2026-11-27T00:55:56.335Z"}
```
```http
HTTP/1.1 413 Payload Too Large
{"message":"El archivo excede el tamaño máximo permitido de 10 MB."}
```
```http
HTTP/1.1 413 Payload Too Large
{"message":"El archivo excede el tamaño máximo permitido de 10 MB."}
```

#### Verificación `BUG-H43-API-04`: JPEG Corrupto (`415`), `ftypheic` (`415`) y Cero Huérfanos tras `404`
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -F "file=@$FIXTURES/corrupto.jpg;type=image/jpeg" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -F "file=@$FIXTURES/falso_heic.mp4;type=video/mp4" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DEL1" \
  -F "file=@$FIXTURES/foto_orphan.jpg;type=image/jpeg" \
  -F "incidente_id=99999999-9999-4999-8999-999999999999"
```
**Respuestas reales obtenidas:**
```http
HTTP/1.1 415 Unsupported Media Type
{"message":"La imagen proporcionada está corrupta o no puede decodificarse."}
```
```http
HTTP/1.1 415 Unsupported Media Type
{"message":"No se pudo verificar la firma binaria del archivo. Formato no soportado o corrupto."}
```
```http
HTTP/1.1 404 Not Found
{"message":"No existe ningún incidente con el identificador 99999999-9999-4999-8999-999999999999."}
# Conteo de archivos en uploads/evidencia/: FILES BEFORE 404=1 AFTER 404=1 (0 archivos huérfanos)
```

#### Verificación `BUG-H43-API-01` y `BUG-H43-API-06`: Centro de Mando (`GET` Incidentes/Misiones/Adjuntos), Derivación `reporte_terreno_id`, Redis, CORS + `nosniff` y OpenAPI
```bash
# Consulta galería en GET /api/evidencia/adjuntos
curl -s -i "http://localhost:3001/api/evidencia/adjuntos?incidente_id=a1000000-0000-4000-8000-000000000004" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO"

# Solo reporte_terreno_id (deriva incidenteId + misionId) y cruce inválido (409)
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_MATIAS" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "reporte_terreno_id=$REP_ID"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_MATIAS" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "reporte_terreno_id=$REP_ID" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

# Cabeceras CORS y nosniff en /uploads/evidencia/[filename] (GET 200, OPTIONS 204, Range 206)
curl -s -I -H "Origin: http://localhost:3000" \
  "http://localhost:3001/uploads/evidencia/e4148a3f13f922dd9d057d1f4912a07d16bad833d2fc0cbdd85b7290980b7ada.webp"
curl -s -i -X OPTIONS -H "Origin: http://localhost:3000" \
  "http://localhost:3001/uploads/evidencia/e4148a3f13f922dd9d057d1f4912a07d16bad833d2fc0cbdd85b7290980b7ada.webp"
curl -s -i -H "Origin: http://localhost:3000" -H "Range: bytes=0-15" \
  "http://localhost:3001/uploads/evidencia/9c7ef9c64210024aea6444a8cc22c429c32152a477b5e94db21a4b61cc330512.mp4" | head -n 15
```
**Respuestas reales obtenidas:**
```http
HTTP/1.1 201 Created
{"id":"c4565753-f9c7-48af-b3b2-326f7d727ab1","nombreArchivo":"informe.pdf","url":"/uploads/evidencia/68d3dbe223d4659eb030429ecc280a437eb6e9b042a59797cbbd9e16f56c1d56.pdf","tipoMime":"application/pdf","tamanoBytes":77,"incidenteId":"a1000000-0000-4000-8000-000000000003","reporteTerrenoId":"e4e0d81e-ff0d-4f45-bbe9-a4fedee2d0b8","misionId":"d1000000-0000-4000-8000-000000000001","creadoEn":"2026-11-27T00:56:28.362Z"}
```
```http
HTTP/1.1 409 Conflict
{"message":"El incidente_id proporcionado no coincide con el incidente asociado al reporte de terreno."}
```
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range, Content-Type, Authorization
Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges
X-Content-Type-Options: nosniff
access-control-max-age: 86400
```
```http
HTTP/1.1 206 Partial Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range, Content-Type, Authorization
Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges
X-Content-Type-Options: nosniff
accept-ranges: bytes
content-length: 16
content-range: bytes 0-15/4296
content-type: video/mp4
```
```text
Eventos Redis Pub/Sub (canal sgrai:socket-events) para reporte_terreno_id solo:
- room: "encargado"       | event: "adjunto:creado" | incidenteId: "a1000000-0000-4000-8000-000000000003" | misionId: "d1000000-0000-4000-8000-000000000001"
- room: "sala:encargados" | event: "adjunto:creado" | incidenteId: "a1000000-0000-4000-8000-000000000003" | misionId: "d1000000-0000-4000-8000-000000000001"
- room: "supervisor"      | event: "adjunto:creado" | incidenteId: "a1000000-0000-4000-8000-000000000003" | misionId: "d1000000-0000-4000-8000-000000000001"
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La PWA debe proveer un módulo de carga de evidencia multimedia dentro de la misión activa. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz en `sgrai-pwa`. El backend provee `POST` y `GET /api/evidencia/adjuntos`. |
| **CA-2:** Debe permitir la captura directa desde la cámara del dispositivo móvil o la selección desde la galería de archivos. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de captura nativa/galería en `sgrai-pwa`. |
| **CA-3:** Validación estricta de archivos: solo se permiten tipos MIME autorizados (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) y un peso máximo de 10 MB por archivo. | `CP-H43-API-09` a `11`, `CP-H43-API-13` a `16`, `BUG-H43-API-03`, `BUG-H43-API-04` | 🟢 **CUMPLIDO** | `proxyClientMaxBodySize: "20mb"` permite archivos `<= 10 MB` íntegros (`201`) y rechaza excesos con `413`; magic bytes estrictos (incluyendo `video/mp4`, `video/webm`, `video/quicktime` del alcance de video de la HU) y rechazo `415` para imágenes corruptas y contenedores `ftyp` no autorizados. |
| **CA-4:** Al cargar exitosamente, la API debe persistir los metadatos en la tabla `adjunto` asociando el archivo a `reporte_terreno_id` o `incidente_id`. | `CP-H43-API-07`, `CP-H43-API-12` a `17`, `BUG-H43-API-01`, `BUG-H43-API-04` | 🟢 **CUMPLIDO** | Persistencia en `adjunto` con `sha256_hash`, derivación automática de `incidente_id`/`mision_id` desde `reporte_terreno_id`, rechazo `409` ante cruces inconsistentes y validación previa antes de escribir en disco. |
| **CA-5:** Soporte offline: almacenamiento local en IndexedDB y sincronización automática en segundo plano al recuperar red. | `CP-H43-API-17` *(soporte API)* / *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API (SOPORTADO)** | La cola IndexedDB y Service Worker corresponden a `sgrai-pwa`. El backend aporta deduplicación física idempotente por `sha256_hash` ante reintentos de sincronización. |
| **CA-6:** Los adjuntos deben visualizarse inmediatamente en la galería de evidencia del Centro de Mando. | `CP-H43-API-18`, `CP-H43-API-19`, `BUG-H43-API-01`, `BUG-H43-API-06` | 🟢 **CUMPLIDO** | Exposición consolidada en `GET /api/incidentes/{id}`, `GET /api/misiones/{id}` y `GET /api/evidencia/adjuntos`; difusión simétrica `adjunto:creado` en Redis con `incidenteId`/`misionId`; streaming `200`/`206` con CORS y `nosniff` en `/uploads/evidencia/[filename]`. |
| **CA-7:** El endpoint de subida debe requerir el permiso RBAC `reportes:crear`. | `CP-H43-API-01` a `03`, `BUG-H43-API-02`, `BUG-H43-API-05` | 🟢 **CUMPLIDO** | Autenticación JWT estricta (`exigirUsuarioId`), verificación RBAC `reportes:crear` (`073_` idempotente sin afectar `056`), autorización horizontal por patrulla/cuadrilla asignada e invariantes de estado ICS cerrados (`409`). |
