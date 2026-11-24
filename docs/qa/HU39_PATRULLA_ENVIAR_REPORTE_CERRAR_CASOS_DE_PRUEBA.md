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
> * `Merge branch 'develop' into feature/h39-patrulla-enviar-reporte-cerrar`  
>  
> **Fecha de Auditoría:** 24/11/2026 01:10.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested` — 5 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense del código fuente, revisión de control de acceso RBAC y pertenencia horizontal, auditoría de transacciones ACID e invariantes del Sistema de Comando de Incidentes (ICS) en Kysely/PostgreSQL 16, análisis de concurrencia, verificación de migraciones frente a `origin/develop`, inspección del contrato OpenAPI 3.0, pruebas en vivo sobre servidor activo (`PORT=3001`) con suscripción a Redis Pub/Sub (`sgrai:socket-events`) y ejecución de la suite automatizada Vitest sobre la rama `feature/h39-patrulla-enviar-reporte-cerrar`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** al haberse verificado **5 defectos reales** (**2 de severidad CRÍTICA**, **2 de severidad ALTA** y **1 de severidad MEDIA**).

| Métrica de Calidad | Resultado de Auditoría (24/11/2026) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H39-API-01` a `05`) + 20 Casos Funcionales, RBAC, Validación Zod, Concurrencia, Tiempo Real y Contrato (`CP-H39-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Flujos nominales `REQUIERE_CUADRILLA` y `NO_ABORDABLE`, rescate de `personas_afectadas` desde HU-38, Ficha FIBE, registro de hito `VERIFICACION_COMPLETADA`, rechazo `401`/`403`/`404`/`409`/`400`, concurrencia doble envío y emisión Redis Pub/Sub |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Entorno integrado operativo (PostgreSQL 16 + PostGIS en puerto `5001`, Redis 7 en puerto `6001`) |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere el 100.0% (0 defectos abiertos) tras Re-Test para autorizar el merge a `develop` |
| **Suite Directa HU-39 + OpenAPI (Vitest)** | **23/23 tests pass** | 6 archivos de prueba (`route.test.ts`, `mision-reporte.{schema,service,repository}.test.ts`, `056_...test.ts`, `openapi.json/...test.ts`) |
| **Suite del Módulo Misiones + OpenAPI (Vitest)** | **122/122 tests pass** | 18 archivos ejecutados en `3.02s` sin fallos ni omisiones |
| **Suite Global del Repositorio (`npm test`)** | **907/907 tests pass** | 85 archivos ejecutados en `9.95s` (las pruebas de repositorio operan con mock de `db.transaction`) |
| **Chequeo de Tipos (`npx tsc --noEmit`) y Build** | **0 errores** | `npx tsc --noEmit` y `npm run build` (Next.js 16.3.4 Turbopack) finalizan con código de salida `0` |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errors / 1 warning** | 1 warning preexistente por importación sin uso `BadRequestError` en `src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts:13` |
| **Sincronización con `origin/develop`** | 🔴 **Desfasada (10 conflictos)** | Colisión de migración `052_` vs `035_`/`051_` y 10 conflictos de fusión frente a `develop` (`014656a`) |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H39-API-01`: Bypass de Autorización Horizontal y de Invariantes ICS cuando `mision.patrulla_id` es `NULL` o `tipo_mision !== 'VERIFICACION'`, Sobrescritura Incondicional de `incidente.estado` y Ausencia de Bloqueo Pesimista (`.forUpdate("mision")`)
* **Severidad:** **CRÍTICA** (Brecha de Autorización Horizontal entre Unidades Operativas, Corrupción de Estados ICS y Concurrencia).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 1289-1363, 1650-1725).
* **Descripción Técnica:**
  1. En `crearReporteVerificacionYCerrarMisionRepo` (línea 1346), el control de pertenencia a la patrulla asignada está condicionado por `if (!esAdmin && misionExistente.patrulla_id)`. Si la misión carece de `patrulla_id` (`patrulla_id IS NULL`, como toda misión de tipo `ATENCION_CUADRILLA` o misiones `PREVENCION` sin patrulla), el bloque completo se omite, permitiendo que cualquier usuario con permiso `reportes:crear` (`PATRULLA_VERIFICADORA` o `DELEGADO_CUADRILLA`) cierre misiones ajenas.
  2. La función no verifica que `misionExistente.tipo_mision === "VERIFICACION"`. Invocada sobre una misión `ATENCION_CUADRILLA`, marca la misión como `COMPLETADA` sin liberar la cuadrilla asignada (que permanece huérfana en `EN_MISION`) y, si recibe `dictamen: "NO_ABORDABLE"`, sobreescribe el incidente desde `EN_ATENCION` (o incluso `RESUELTO`) a `NO_ABORDABLE` en la actualización incondicional de las líneas 1690-1709 (`.where("id", "=", misionExistente.incidente_id)` sin filtrar por `estado`). Invocada sobre una misión `PREVENCION` con `incidente_id = null` y `dictamen = "NO_ABORDABLE"`, retorna `HTTP 201` anunciando `"incidente marcado como NO_ABORDABLE"` con `"incidente": null`.
  3. La lectura inicial en la línea 1289-1320 dentro de `db.transaction()` carece de `.forUpdate("mision")` (a diferencia de `aceptarMisionPatrullaRepo` en la línea 1956) y no valida las invariantes ICS (`patrulla_activo !== false`, `patrulla_estado === 'EN_VERIFICACION'`, ni `incidente_estado IN ('REPORTADO', 'VERIFICANDO')`).
* **Pasos para Reproducir:**
  1. Autenticarse como `loreto.patrulla@valdivia.cl` (`PATRULLA_VERIFICADORA`, UUID `d1000000-0000-4000-8000-000000000002`).
  2. Enviar `POST /api/misiones/d1000000-0000-4000-8000-000000000002/reporte` (`MIS-2026-0002`, `tipo_mision = 'ATENCION_CUADRILLA'`, `patrulla_id = null`, incidente `INC-2026-0004` en `EN_ATENCION`) con `dictamen: "NO_ABORDABLE"`.
  3. Enviar `POST /api/misiones/50000000-0000-4000-8000-000000000001/reporte` (`MIS-PREV-2026-001`, `tipo_mision = 'PREVENCION'`, `patrulla_id = null`, `incidente_id = null`) con usuario `pedro.patrulla@valdivia.cl`.
* **Comportamiento Actual:** Ambos llamados retornan `HTTP 201 Created`, cierran misiones que no corresponden a verificación ni pertenecen al operador, dejan la cuadrilla en `EN_MISION` y transicionan el incidente `EN_ATENCION` a `NO_ABORDABLE`.
* **Comportamiento Esperado:** Debe aplicar `.forUpdate("mision")`, exigir `tipo_mision === "VERIFICACION"` y `patrulla_id !== null` (lanzando `ConflictError` / `409 Conflict` en caso contrario), validar pertenencia obligatoria cuando `!esAdmin`, exigir patrulla activa en `EN_VERIFICACION` e incidente en `['REPORTADO', 'VERIFICANDO']` antes de cerrar la misión o marcar `NO_ABORDABLE`.
* **Sugerencia Técnica de Solución:**
  * Añadir `.forUpdate("mision")` en el `SELECT` inicial de `crearReporteVerificacionYCerrarMisionRepo`.
  * Validar `if (misionExistente.tipo_mision !== "VERIFICACION" || !misionExistente.patrulla_id) throw new ConflictError(...)`.
  * Validar `patrulla_activo !== false`, `patrulla_estado === "EN_VERIFICACION"` e `incidente_estado === "REPORTADO" || incidente_estado === "VERIFICANDO"` antes de insertar el reporte y cerrar la misión.

---

### `BUG-H39-API-02`: Bypass de Autenticación JWT mediante Cabecera `x-user-id` y Escalamiento de Privilegios RBAC al Asignar `misiones:leer` en Migración `056` (Permite Mutar Patrullas Ajenas vía `PATCH /api/patrullas/[id]`)
* **Severidad:** **CRÍTICA** (Seguridad / Suplantación de Identidad y Escalamiento de Privilegios RBAC).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/app/api/misiones/[id]/reporte/route.ts` (Líneas 43-50)
  * `src/lib/db/migrations/056_reporte_verificacion_cierre_y_no_abordable.ts` (Líneas 103-111)
  * `src/modules/incidentes/prioridad.repository.ts` (Líneas 655-662)
* **Descripción Técnica:**
  1. **Aceptación de cabecera plana `x-user-id` sin firma JWT:** `POST /api/misiones/[id]/reporte` (`route.ts:43-45`) utiliza `extraerUsuarioId(request)` con fallback directo a `request.headers.get("x-user-id")`. Cualquier solicitante sin token Bearer puede enviar `x-user-id: 00000000-0000-4000-8000-000000000001` para suplantar al perfil `ADMIN` (evadiendo además el control de pertenencia de patrulla en el repositorio), a diferencia del estándar vigente en `develop` (`exigirUsuarioId(request)` en `src/app/api/incidentes/[id]/tipologia/route.ts`).
  2. **Escalamiento de privilegios por asignación de `misiones:leer` en migración `056`:** Pese a que en `GET /api/misiones/[id]` (`src/app/api/misiones/[id]/route.ts:34-52`) ya se habilitó el acceso alternativo por `misiones:terreno:verificar` o `reportes:crear`, la migración `056` (líneas 103-111) y `asegurarColumnasHu38EnEsquema` (líneas 655-662) asignan igualmente el permiso `misiones:leer` a `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA` (y `056.down()` no lo revierte). En la API actual, `misiones:leer` autoriza `GET /api/patrullas`, `GET /api/patrullas/[id]` y **`PATCH /api/patrullas/[id]`** (`src/app/api/patrullas/[id]/route.ts:81`), permitiendo a un patrullero alterar el estado operativo y coordenadas de cualquier otra patrulla del municipio.
* **Pasos para Reproducir:**
  1. Enviar `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte` sin cabecera `Authorization`, enviando únicamente `-H "x-user-id: d1000000-0000-4000-8000-000000000001"`.
  2. Iniciar sesión con `pedro.patrulla@valdivia.cl` (`PATRULLA_VERIFICADORA`) y ejecutar `PATCH /api/patrullas/f1000000-0000-4000-8000-000000000020` (patrulla de Loreto Sánchez) con `{"estado": "NO_DISPONIBLE"}`.
* **Comportamiento Actual:** La petición sin JWT con `x-user-id` supera la autenticación (llegando al negocio con `409 Conflict` / `201 Created`) y `PATCH /api/patrullas/f1000000-0000-4000-8000-000000000020` responde `HTTP 200 OK`, cambiando el estado de la patrulla ajena a `NO_DISPONIBLE`.
* **Comportamiento Esperado:** El endpoint `POST /api/misiones/[id]/reporte` debe exigir token Bearer JWT válido mediante `exigirUsuarioId(request)` (`401 Unauthorized` si falta), y los roles `PATRULLA_VERIFICADORA` / `DELEGADO_CUADRILLA` no deben recibir `misiones:leer` sobre recursos de mando en la migración `056` ni en `asegurarColumnasHu38EnEsquema`.
* **Sugerencia Técnica de Solución:**
  * Reemplazar `extraerUsuarioId` + `x-user-id` por `const usuarioId = await exigirUsuarioId(request);` en `src/app/api/misiones/[id]/reporte/route.ts`.
  * Retirar la inserción de `misiones:leer` para `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA` en `src/lib/db/migrations/056_reporte_verificacion_cierre_y_no_abordable.ts:103-111` y `src/modules/incidentes/prioridad.repository.ts:655-662` (manteniendo el acceso de terreno mediante `misiones:terreno:verificar` / `reportes:crear` en `GET /api/misiones/[id]`).

---

### `BUG-H39-API-03`: Desfase de Rama respecto a `origin/develop` (10 Conflictos), Colisión de Migración `052_permiso_misiones_terreno_verificar.ts` y Borrado de `041_` en `migrator.ts`
* **Severidad:** **ALTA** (Integración Continua, Integridad de Migraciones Kysely y Documentación Duplicada).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/db/migrations/052_permiso_misiones_terreno_verificar.ts` vs `develop` (`035_` y `051_`)
  * `src/lib/db/migrator.ts` (Líneas 14-90)
  * `docs/api/misiones.md` (Secciones `3.5` y `3.6` duplicadas)
* **Descripción Técnica:**
  1. La rama `feature/h39-patrulla-enviar-reporte-cerrar` fusionó `develop` en `f3c6860`, quedando desactualizada frente a `origin/develop` (`014656a`, donde ya fueron integradas HU-69 rechazo de misión, HU-61 `072_evento_atp_base.ts`, HU-37 final y HU-32 `041_recuperacion_recurso_mision_id.ts`). La simulación `git merge-tree --write-tree --name-only develop HEAD` arroja **10 conflictos de contenido** (`docs/api/{incidentes,misiones}.md`, `src/lib/db/types.ts`, `src/lib/openapi/index.ts`, `incidente-kanban.{repository,service}.ts`, `mision.{repository,schema,service}.ts`, `permisos.constants.ts`).
  2. La rama mantiene `052_permiso_misiones_terreno_verificar.ts` en disco, mientras `develop` contiene `035_permiso_misiones_terreno_verificar.ts` y `051_permiso_misiones_terreno_verificar.ts` con idéntico propósito. Al ejecutar `npm run db:migrate` en la rama sobre la BD de `develop`, `src/lib/db/migrator.ts` renombra `035_` a `052_` y ejecuta `DELETE FROM kysely_migration WHERE name NOT IN (...)` eliminando el registro de `041_recuperacion_recurso_mision_id`.
  3. En `docs/api/misiones.md`, la resolución de merge anterior dejó encabezados `### 3.5.` y `### 3.6.` repetidos con numeración colisionada (`3.5` aceptacion, `3.6` notificacion, `3.7` pendientes, y nuevamente `3.5` aceptacion y `3.6` reporte).
* **Pasos para Reproducir:**
  1. Ejecutar `git merge-tree --write-tree --name-only develop HEAD`.
  2. Comparar `src/lib/db/migrations/` entre `develop` y `HEAD`.
  3. Ejecutar `npm run db:migrate` sobre una BD migrada con `develop` e inspeccionar la tabla `kysely_migration`.
* **Comportamiento Actual:** Existen 10 conflictos con `develop`, falta `POST /api/misiones/[id]/rechazar` (HU-69) y `072_evento_atp_base.ts` (HU-61), `npm run db:migrate` borra `041_recuperacion_recurso_mision_id` de `kysely_migration` y `docs/api/misiones.md` contiene secciones duplicadas.
* **Comportamiento Esperado:** La rama debe sincronizarse limpiamente con `origin/develop`, eliminando la migración duplicada `052_permiso_misiones_terreno_verificar.ts`, preservando todas las migraciones integradas en `develop` (`035_`, `041_`, `051_`, `072_`) y ordenando secuencialmente `053_`–`056_` sin colisiones, junto con `docs/api/misiones.md` saneado.
* **Sugerencia Técnica de Solución:**
  * Ejecutar `git merge origin/develop` resolviendo los 10 conflictos conservando tanto HU-69/HU-61/HU-37/HU-32 como HU-38/HU-39.
  * Eliminar `052_permiso_misiones_terreno_verificar.ts` y verificar que las migraciones de `053_` a `056_` no colisionen con los archivos presentes en `develop`.
  * Depurar las secciones `### 3.5.` y `### 3.6.` duplicadas en `docs/api/misiones.md` y actualizar la tabla resumen de endpoints con `POST /api/misiones/{id}/rechazar` y el soporte de permisos de terreno en `GET /api/misiones/{id}`.

---

### `BUG-H39-API-04`: IDOR / Secuestro Cruzado de Adjuntos entre Incidentes en `adjuntoIds`, Silencio ante Adjuntos Inexistentes o Sin `url`, y Bloques `catch` Internos que Abortan la Transacción PostgreSQL (`25P02`)
* **Severidad:** **ALTA** (Seguridad IDOR en Evidencia Multimedia, Pérdida Silenciosa de Adjuntos y Robustez Transaccional).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 1413-1430, 1509-1617, 1763-1774)
  * `src/modules/misiones/mision.schema.ts` (Líneas 583-594)
* **Descripción Técnica:**
  1. **Secuestro cruzado (IDOR) de `adjuntoIds`:** En `mision.repository.ts:1512-1522` y `1546-1556`, al vincular `adjuntoIds` o `adjuntos[i].id`, el `UPDATE adjunto SET reporte_terreno_id = ..., incidente_id = ... WHERE id IN (...)` no valida que los registros pertenezcan al mismo `incidente_id` ni que estén libres (`reporte_terreno_id IS NULL`). Verificado en vivo: una patrulla asignada al incidente `INC-2026-8869` (`980f2584-...`) envió el `adjuntoId` (`d74b87ab-70cf-4e83-95f8-6866756c3eb8`) de una fotografía ya asociada a `INC-2026-9932` (`dd7db71e-...`), y la API respondió `HTTP 201` reasignando la fotografía en PostgreSQL al reporte e incidente del atacante.
  2. **Pérdida silenciosa de evidencia por validación permisiva:** Si `adjuntoIds` incluye un UUID inexistente (`99999999-9999-4999-8999-999999999999`), o si `adjuntos` contiene un objeto sin `id` ni `url` (ej. `{"nombreArchivo": "foto_sin_url.jpg", "tipoMime": "image/jpeg"}`, permitido porque todos los campos de `AdjuntoReporteInputSchema` son opcionales), la API responde `HTTP 201 Created` con `adjuntos: []` descartando silenciosamente la evidencia.
  3. **Ruptura de transacción (`25P02`) por `catch` internos:** Los bloques `try { ... } catch {}` alrededor de consultas SQL dentro de `db.transaction()` (líneas 1428, 1536, 1570, 1612, 1772) absorben errores SQL en tiempo de ejecución. Si una sentencia falla dentro de una transacción PostgreSQL (ej. columna faltante `42703` por migración pendiente), PostgreSQL aborta la transacción y la siguiente sentencia lanza `25P02` (`current transaction is aborted`), impidiendo que opere el retry de `esErrorColumnaInexistente` en línea 1878.
* **Pasos para Reproducir:**
  1. Crear/obtener un adjunto vinculado al incidente A (`d74b87ab-70cf-4e83-95f8-6866756c3eb8` en `INC-2026-9932`).
  2. Desde una misión de otro incidente B (`d980eb79-4d8a-441a-8765-6c9e984914d9` / `INC-2026-8869`), enviar `POST /api/misiones/{id}/reporte` con `"adjuntoIds": ["d74b87ab-70cf-4e83-95f8-6866756c3eb8"]`.
  3. Enviar `"adjuntoIds": ["99999999-9999-4999-8999-999999999999"]` y `"adjuntos": [{"nombreArchivo": "foto_sin_url.jpg"}]`.
* **Comportamiento Actual:** En el paso 2, retorna `201 Created` y mueve `adjunto.incidente_id` e `adjunto.reporte_terreno_id` al incidente B. En el paso 3, retorna `201 Created` con `"adjuntos": []`.
* **Comportamiento Esperado:** Todo `adjuntoId` enviado debe existir y no pertenecer a otro `incidente_id` ni a otro `reporte_terreno_id` (lanzando `404`/`409`/`403` si falla), cada ítem de `adjuntos` debe requerir al menos `id` o `url` válida en Zod (`400 Bad Request` si viene vacío), y no deben silenciarse errores SQL dentro de una transacción PostgreSQL activa.
* **Sugerencia Técnica de Solución:**
  * Agregar `.refine((adj) => Boolean(adj.id || (adj.url && adj.url.trim().length > 0)), ...)` en `AdjuntoReporteInputSchema` y validar URL segura (`/uploads/...` o `http(s)://...`).
  * En `crearReporteVerificacionYCerrarMisionRepo`, consultar primero los `adjuntoIds` y validar que la cantidad encontrada coincida con los IDs únicos enviados y que `reporte_terreno_id === null` y `(incidente_id === null || incidente_id === misionExistente.incidente_id)` antes de actualizar.
  * Eliminar los `try/catch` silenciosos sobre queries SQL dentro de `db.transaction()`.

---

### `BUG-H39-API-05`: Regresión de Paridad GPS (`latitud`/`longitud`) y Manejo de `null` en `CrearReporteVerificacionInputSchema`, Desalineación OpenAPI (`bearerAuth` vs `BearerAuth`, `403` de `GET /api/misiones/{id}`) y Campo `totalReportesTerreno` Siempre en `0` en Kanban
* **Severidad:** **MEDIA** (Validación de Contrato Zod, Especificación OpenAPI 3.0 y Proyección Kanban).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.schema.ts` (Líneas 635-667, 731-786)
  * `src/lib/openapi/index.ts` (Líneas 1551, 2807)
  * `src/modules/incidentes/incidente-kanban.repository.ts` (Líneas 28, 160-267)
* **Descripción Técnica:**
  1. **Ausencia de paridad GPS (`latitud`/`longitud`) y rechazo de `null` en opcionales:** `CrearReporteVerificacionInputSchema` no incorpora la validación de paridad que sí posee `AceptarMisionInputSchema` (`mision.schema.ts:388-394`), permitiendo enviar únicamente `{"latitud": -39.819588}` sin `longitud` (persistiendo `latitud: -39.819588, longitud: null` en `mision_hito` con `201 Created`). Asimismo, `personas_afectadas`/`personasAfectadas`, `estado_terreno`/`estadoTerreno`, `latitud` y `longitud` omiten `.nullable()`, rechazando con `400 Bad Request` payloads de la PWA que envíen `null` en campos opcionales no editados.
  2. **Esquema de seguridad `bearerAuth` inexistente en OpenAPI:** En `src/lib/openapi/index.ts:198`, el esquema se registra como `BearerAuth`, pero `POST /api/misiones/{id}/reporte` (línea 2807) declara `security: [{ bearerAuth: [] }]` en minúscula, provocando una referencia rota en `/openapi.json`. Además, `GET /api/misiones/{id}` (línea 1551) sigue documentando `403` exclusivamente para `misiones:leer`, sin mencionar `misiones:terreno:verificar` ni `reportes:crear`.
  3. **`totalReportesTerreno` siempre en `0` en `GET /api/incidentes`:** `incidente-kanban.service.ts:37` lee `fila.total_reportes_terreno ?? 0`, pero `listarIncidentesPaginadosRepo` (`incidente-kanban.repository.ts:160-267`) nunca proyecta la subconsulta sobre `reporte_terreno`, devolviendo siempre `totalReportesTerreno: 0` aunque el incidente cuente con reportes en terreno persistidos.
* **Pasos para Reproducir:**
  1. Enviar `POST /api/misiones/{id}/reporte` con `{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Prueba coordenada huerfana","latitud":-39.819588}` y luego con `{"personas_afectadas":null,"estado_terreno":null}`.
  2. Consultar `GET /openapi.json` e inspeccionar `components.securitySchemes`, `paths["/api/misiones/{id}/reporte"].post.security` y `paths["/api/misiones/{id}"].get.responses["403"]`.
  3. Consultar `GET /api/incidentes?busqueda=INC-2026-9932` tras emitir el informe técnico de verificación.
* **Comportamiento Actual:** La coordenada huérfana responde `201 Created` (`lat: -39.819588, lng: null`); `personas_afectadas: null` responde `400`; `/openapi.json` expone `bearerAuth` en lugar de `BearerAuth`; y `GET /api/incidentes` retorna `"totalReportesTerreno": 0`.
* **Comportamiento Esperado:** Coordenadas parciales deben rechazarse con `400 Bad Request`; campos opcionales deben tolerar `null` cuando corresponda rescatar el valor por defecto/previo; OpenAPI debe referenciar `BearerAuth` y reflejar los permisos reales de `GET /api/misiones/{id}`; y `GET /api/incidentes` debe proyectar el conteo real de `reporte_terreno`.
* **Sugerencia Técnica de Solución:**
  * Agregar en `CrearReporteVerificacionInputSchema` el `.refine()` de paridad GPS (`(latitud != null) === (longitud != null)`) y añadir `.nullable().optional()` en `personasAfectadas`, `personas_afectadas`, `estadoTerreno`, `estado_terreno`, `latitud` y `longitud`.
  * Corregir `security: [{ BearerAuth: [] }]` en `src/lib/openapi/index.ts:2807` (y endpoints relacionados) y actualizar la descripción del `403` en `GET /api/misiones/{id}`.
  * Incluir la subconsulta `count(reporte_terreno.id)::int` en `listarIncidentesPaginadosRepo` bajo el alias `total_reportes_terreno`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H39-API-01` | Bypass de autorización horizontal e invariantes ICS con `patrulla_id` null o `tipo_mision !== 'VERIFICACION'`, sobrescritura de `incidente.estado` y falta de `.forUpdate("mision")` | Seguridad / Regla de Negocio ICS | Repositorio / Endpoint | Crítica | Misión `ATENCION_CUADRILLA` (`d1000000-...0002`, `patrulla_id = null`, incidente `EN_ATENCION`) o misión `PREVENCION` (`50000000-...0001`, `patrulla_id = null`) en estado `EN_CURSO` | `POST /api/misiones/d1000000-0000-4000-8000-000000000002/reporte` con JWT de `loreto.patrulla@valdivia.cl` y `dictamen: "NO_ABORDABLE"` | Rechazo `HTTP 409 Conflict` / `403 Forbidden` al no ser misión `VERIFICACION` con patrulla asignada, bloqueo `.forUpdate("mision")` y protección de estado `EN_ATENCION` | Retorna `HTTP 201 Created`, cierra misión de cuadrilla ajena dejando cuadrilla en `EN_MISION` y cambia incidente `INC-2026-0004` de `EN_ATENCION` a `NO_ABORDABLE` | ABIERTO | 24/11/2026 01:06 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-API-02` | Bypass de autenticación JWT mediante cabecera `x-user-id` y escalamiento RBAC por asignación de `misiones:leer` en migración `056` | Seguridad / Autenticación y RBAC | Route Handler / Migraciones | Crítica | Petición sin `Authorization: Bearer` usando `x-user-id` y usuario `PATRULLA_VERIFICADORA` tras ejecutar migración `056` | `POST /api/misiones/247be4dd-.../reporte` con `x-user-id` y `PATCH /api/patrullas/f1000000-...0020` con JWT de `pedro.patrulla@valdivia.cl` y `{"estado":"NO_DISPONIBLE"}` | `HTTP 401` sin JWT Bearer válido en `/reporte` y `HTTP 403` para patrullero en `PATCH /api/patrullas/{id}` (sin `misiones:leer`) | `POST /reporte` acepta `x-user-id` sin JWT y `PATCH /api/patrullas/f1000000-...0020` responde `HTTP 200 OK` mutando el estado de una patrulla ajena | ABIERTO | 24/11/2026 01:08 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-API-03` | Desfase con `origin/develop` (10 conflictos), colisión de migración `052_` vs `035_`/`051_`, eliminación de `041_` en `migrator.ts` y secciones duplicadas en `docs/api/misiones.md` | Integración / Base de Datos | Migraciones / Git / Docs | Alta | Rama `feature/h39-patrulla-enviar-reporte-cerrar` frente a `origin/develop` (`014656a`) y BD integrada | `git merge-tree --write-tree --name-only develop HEAD`, `npm run db:migrate` y lectura de `docs/api/misiones.md` | Fusión limpia sin colisiones ni borrado de migraciones de `develop` (`035_`, `041_`, `051_`, `072_`) y documentación sin secciones repetidas | `git merge-tree` reporta 10 conflictos; `migrator.ts` renombra `035_` a `052_` y elimina `041_recuperacion_recurso_mision_id` de `kysely_migration`; `docs/api/misiones.md` duplica `3.5` y `3.6` | ABIERTO | 24/11/2026 01:11 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-API-04` | Secuestro cruzado (IDOR) de `adjuntoIds` entre incidentes, descarte silencioso de adjuntos inexistentes/sin `url` y `catch` internos que abortan transacción (`25P02`) | Seguridad / Integridad Transaccional | Repositorio / Schema | Alta | Adjunto `d74b87ab-...` vinculado a `INC-2026-9932` y envío desde misión `d980eb79-...` de `INC-2026-8869` | `POST /api/misiones/d980eb79-.../reporte` con `adjuntoIds: ["d74b87ab-..."]` y caso con `adjuntoIds: ["99999999-..."]` y `adjuntos: [{"nombreArchivo":"foto_sin_url.jpg"}]` | Rechazo `403`/`404`/`409` ante adjunto ajeno o inexistente, `400` ante objeto adjunto vacío y propagación limpia de errores SQL | Retorna `HTTP 201`, reasigna `adjunto.incidente_id` al incidente ajeno en PostgreSQL y acepta UUID inexistente/objeto sin `url` devolviendo `adjuntos: []` | ABIERTO | 24/11/2026 01:08 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-API-05` | Ausencia de paridad GPS (`latitud`/`longitud`) y tolerancia a `null` en Zod, esquema `bearerAuth` roto en OpenAPI y `totalReportesTerreno` siempre en `0` en Kanban | Validación / Contrato OpenAPI / Kanban | Schema / OpenAPI / Repo | Media | Payload con `latitud` sin `longitud` o `null` en opcionales; consulta `/openapi.json` y `GET /api/incidentes` | `POST /api/misiones/553b5ca5-.../reporte` con `latitud: -39.819588` sin `longitud`, `GET /openapi.json` y `GET /api/incidentes?busqueda=INC-2026-9932` | `400 Bad Request` ante GPS incompleto, OpenAPI con `BearerAuth` y permisos de terreno en `GET /misiones/{id}`, y `totalReportesTerreno >= 1` | Coordenada huérfana retorna `201 Created` (`lng: null`), `personas_afectadas: null` falla con `400`, `/openapi.json` declara `bearerAuth` y Kanban retorna `totalReportesTerreno: 0` | ABIERTO | 24/11/2026 01:08 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H39-API-01` | Envío exitoso de informe técnico con dictamen `REQUIERE_CUADRILLA`, Ficha FIBE y adjunto válido (`201 Created`) | Funcional / Positiva | Integración / Endpoint | Crítica | Misión `247be4dd-...` (`MIS-2026-0008`) en estado `EN_CURSO` con incidente `INC-2026-9932` en `VERIFICANDO` y JWT de `pedro.patrulla@valdivia.cl` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte` con `dictamen: "REQUIERE_CUADRILLA"`, `requiere_asistencia_social: true`, `adjuntos` con `url` y GPS completo | `HTTP 201 Created` creando `reporte_terreno` (`evaluador_id = usuario.id`), `mision.estado = "COMPLETADA"` con `fechaCierre`, `patrulla.estado = "DISPONIBLE"` e `incidente.requiereAsistenciaSocial = true` | `HTTP 201 Created` con `reporteTerreno`, `mision.estado: "COMPLETADA"`, `patrulla.estado: "DISPONIBLE"`, `incidente.estado: "VERIFICANDO"`, `requiereAsistenciaSocial: true` y adjunto persistido | APROBADO | 24/11/2026 01:08 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-02` | Envío exitoso con dictamen `NO_ABORDABLE` y `motivo_no_abordable >= 15` caracteres cerrando misión, liberando patrulla y cerrando incidente (`201 Created`) | Funcional / Positiva | Integración / Endpoint | Crítica | Misión `df7b5280-...` (`MIS-2026-0010`) en `EN_CURSO` con JWT de `loreto.patrulla@valdivia.cl` | `POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/reporte` con `dictamen: "NO_ABORDABLE"`, `motivo_no_abordable` de 97 caracteres y `personas_afectadas: 0` | `HTTP 201 Created` con `mision.estado = "COMPLETADA"`, `patrulla.estado = "DISPONIBLE"`, `incidente.estado = "NO_ABORDABLE"`, `fechaCierre` y `motivoNoAbordable` | `HTTP 201 Created` actualizando atómicamente `mision`, `patrulla` y `incidente` (`estado: "NO_ABORDABLE"`, `fechaCierre: "2026-11-24T04:08:14.774Z"`) | APROBADO | 24/11/2026 01:08 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-03` | Rescate automático de `personas_afectadas` desde el reporte previo de prioridad (HU-38) cuando se omite en HU-39 | Funcional / Integración HU-38 | Integración / Repositorio | Alta | Misión `d980eb79-...` con reporte previo `EVALUACION_PRIORIDAD` (`personas_afectadas = 7`) | `POST /api/misiones/d980eb79-4d8a-441a-8765-6c9e984914d9/reporte` omitiendo `personas_afectadas` | `reporteTerreno.personasAfectadas === 7`, `detallesEvaluacion.personasAfectadasPrevias === 7`, `personasAfectadasModificadas === false` y `versionReporte === 2` | `HTTP 201 Created` rescatando `personasAfectadas: 7`, `personasAfectadasPrevias: 7` y `versionReporte: 2` | APROBADO | 24/11/2026 01:08 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-04` | Rectificación de `personas_afectadas` respecto al valor previo de HU-38 con trazabilidad en `detalles_evaluacion` | Funcional / Integración HU-38 | Unitaria / Repositorio | Media | Reporte previo `EVALUACION_PRIORIDAD` con `personas_afectadas = 3` en mock de transacción | `crearReporteVerificacionYCerrarMisionRepo` con `personasAfectadas: 0` (`mision-reporte.repository.test.ts`) | Persiste `personas_afectadas: 0` y marca `personasAfectadasModificadas: true` manteniendo `personasAfectadasPrevias: 3` | Test unitario aprobado verificando `personas_afectadas: 0`, `personasAfectadasPrevias: 3` y `personasAfectadasModificadas: true` | APROBADO | 24/11/2026 01:09 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-05` | Registro automático del hito `VERIFICACION_COMPLETADA` en `mision_hito` y proyección en `GET /api/misiones/{id}` (`bitacoraTiempos` y `evaluaciones`) | Funcional / Trazabilidad ICS | Integración / BD | Crítica | Misión `247be4dd-...` cerrada con informe técnico de verificación | `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` con JWT de `encargado@valdivia.cl` | `bitacoraTiempos` incluye `DESPACHADA`, `MISION_ACEPTADA` y `VERIFICACION_COMPLETADA`; `evaluaciones.reporteVerificacionEnviado === true` y `dictamenVerificacion === "REQUIERE_CUADRILLA"` | `HTTP 200 OK` exponiendo los 3 hitos cronológicos y `evaluaciones.reporteVerificacionEnviado: true` | APROBADO | 24/11/2026 01:08 | - | fix(misiones): habilitar lectura de detalle a personal de terreno y trazabilidad de evaluador |
| `CP-H39-API-06` | Emisión de eventos WebSocket `mision:actualizada`, `incidente:actualizado`, `patrulla:actualizada` y `patrulla:liberada` en Redis Pub/Sub | Tiempo Real / Socket.io | Integración / Redis | Crítica | Broker Redis activo en `localhost:6001` y escucha en canal `sgrai:socket-events` | Suscripción a `sgrai:socket-events` durante `POST /api/misiones/{id}/reporte` para `REQUIERE_CUADRILLA` y `NO_ABORDABLE` | Emisión de `mision:actualizada` (`encargado`, `sala:encargados`, `supervisor`), `incidente:actualizado` (`sala:encargados`, `encargado`, `mapa`), `patrulla:actualizada` y `patrulla:liberada` | 16 mensajes recibidos por cada cierre en `sgrai:socket-events` incluyendo `nuevoEstado: "NO_ABORDABLE"` y `dictamen` | APROBADO | 24/11/2026 01:08 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-07` | Rechazo por ausencia total de credenciales de autenticación (`401 Unauthorized`) | Seguridad / Autenticación | Endpoint / Route Handler | Crítica | Petición sin `Authorization` ni `x-user-id` | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte` sin cabeceras | `HTTP 401 Unauthorized` indicando cabecera requerida | `HTTP 401 Unauthorized`: `{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}` | APROBADO | 24/11/2026 01:06 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-08` | Rechazo RBAC para usuario sin permiso `reportes:crear` (`403 Forbidden`) | Seguridad / RBAC | Endpoint / Auth | Crítica | Usuario `carlos.miranda@valdivia.cl` (`CALL_CENTER`, sin `reportes:crear`) | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte` con `x-user-id: c1111111-1111-4111-8111-111111111111` | `HTTP 403 Forbidden` indicando ausencia del permiso `reportes:crear` | `HTTP 403 Forbidden`: `{"message":"No cuenta con el permiso requerido: reportes:crear"}` | APROBADO | 24/11/2026 01:06 | - | feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86) |
| `CP-H39-API-09` | Rechazo de autorización horizontal cuando un patrullero intenta cerrar una misión asignada a otra patrulla (`403 Forbidden`) | Seguridad / Autorización | Endpoint / Repositorio | Crítica | Misión `d1000000-...0001` (`patrulla_id` asignado a Costa-1) e invocación por `loreto.patrulla@valdivia.cl` (otra patrulla) | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte` con `x-user-id: d1000000-0000-4000-8000-000000000002` | `HTTP 403 Forbidden` impidiendo cerrar misión de otra patrulla | `HTTP 403 Forbidden`: `{"message":"No está autorizado para enviar el informe técnico ni cerrar una misión asignada a otra patrulla verificadora."}` | APROBADO | 24/11/2026 01:06 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-10` | Rechazo por parámetro de ruta `id` con formato UUID inválido y por cuerpo JSON malformado (`400 Bad Request`) | Validación / Robustez | Endpoint / Route Handler | Media | Petición autenticada con `id` inválido o body corrupto | `POST /api/misiones/no-es-uuid/reporte` y `POST /api/misiones/d1000000-.../reporte` con `-d '{malformed'` | `HTTP 400 Bad Request` para ambos casos | `HTTP 400 Bad Request` con mensaje `"El identificador de la misión proporcionado no es un UUID válido."` y `"El cuerpo de la petición no es un JSON válido."` | APROBADO | 24/11/2026 01:06 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-11` | Rechazo de validación Zod cuando `dictamen` es `NO_ABORDABLE` con `motivo_no_abordable < 15` chars y `resumen_tecnico < 10` chars (`400 Bad Request`) | Validación / Esquema Zod | Endpoint / Schema | Crítica | Petición autenticada con dictamen `NO_ABORDABLE` sin justificación suficiente | `POST /api/misiones/d1000000-.../reporte` con `{"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Corto","resumen_tecnico":"Corto"}` | `HTTP 400 Bad Request` reportando ambos errores de longitud mínima (`10` y `15` caracteres) | `HTTP 400 Bad Request` con `errors` detallando `resumen_tecnico` (>= 10) y `motivo_no_abordable` (>= 15) | APROBADO | 24/11/2026 01:06 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-12` | Rechazo cuando el identificador UUID de la misión no existe en base de datos (`404 Not Found`) | Funcional / Negativa | Endpoint / Repositorio | Alta | UUID inexistente en tabla `mision` | `POST /api/misiones/60000000-0000-4000-8000-000000000999/reporte` con payload válido | `HTTP 404 Not Found` | `HTTP 404 Not Found`: `{"message":"No se encontró ninguna misión con el identificador proporcionado."}` | APROBADO | 24/11/2026 01:06 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-13` | Rechazo cuando la misión aún se encuentra en estado `DESPACHADA` sin haber sido aceptada por la patrulla (`409 Conflict`) | Regla de Negocio ICS | Endpoint / Repositorio | Alta | Misión `247be4dd-...` en estado `DESPACHADA` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte` con JWT o ID de Pedro | `HTTP 409 Conflict` exigiendo aceptación previa (`EN_CURSO`) | `HTTP 409 Conflict`: `{"message":"La patrulla debe aceptar la misión asignada antes de poder enviar el informe técnico de verificación."}` | APROBADO | 24/11/2026 01:06 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-14` | Idempotencia / bloqueo de reenvío cuando la misión ya fue cerrada (`COMPLETADA`) y control de concurrencia en doble envío simultáneo (`409 Conflict`) | Concurrencia / Idempotencia | Integración / Transacción | Crítica | Misión cerrada (`247be4dd-...`) y misión `EN_CURSO` (`3e2f1690-...`) sometida a 2 peticiones `Promise.all` | `POST /reporte` posterior al cierre y 2 `POST /reporte` simultáneos con JWT de `ignacio.patrulla@valdivia.cl` | Exactamente 1 petición retorna `201 Created` (1 fila en `reporte_terreno`) y las restantes `409 Conflict` | Reenvío retorna `409`; `Promise.all` retorna `[201, 409]` con exactamente `1` reporte en PostgreSQL | APROBADO | 24/11/2026 01:08 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-15` | Bloqueo de despacho de cuadrilla (`HU-21`) tras cierre `NO_ABORDABLE` y habilitación de despacho tras `REQUIERE_CUADRILLA` | Integración Inter-HU (HU-21) | Integración / Endpoint | Alta | Incidente `a1000000-...0002` cerrado como `NO_ABORDABLE` e incidente `980f2584-...` cerrado con `REQUIERE_CUADRILLA` | `POST /api/misiones` (`ATENCION_CUADRILLA`) con JWT de `encargado@valdivia.cl` sobre ambos incidentes | `409 Conflict` sobre `NO_ABORDABLE` y `201 Created` transicionando a `EN_ATENCION` sobre `REQUIERE_CUADRILLA` | `409 Conflict` sobre `NO_ABORDABLE` y `201 Created` (`MIS-2026-0015`, incidente `EN_ATENCION`) sobre `REQUIERE_CUADRILLA` | APROBADO | 24/11/2026 01:09 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-16` | Exposición de campos de cierre (`tipoReporte`, `dictamen`, `motivoNoAbordable`, `fechaCierre`, `ultimoReporte`) en `GET /api/incidentes/{id}` | Funcional / Proyección | Integración / Servicio | Alta | Incidente `INC-2026-9932` con informe `VERIFICACION_CIERRE` registrado | `GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38` con JWT de `encargado@valdivia.cl` | `HTTP 200 OK` proyectando `ultimoReporte` (`tipoReporte: "VERIFICACION_CIERRE"`, `dictamen: "REQUIERE_CUADRILLA"`) y `reportesEvaluacionTerreno` | `HTTP 200 OK` con `ultimoReporte` completo (`evaluadorNombre: "Pedro Valenzuela"`, `dictamen: "REQUIERE_CUADRILLA"`) y `totalReportes: 1` | APROBADO | 24/11/2026 01:08 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-17` | Creación de columnas de cierre y dictamen (`incidente`, `reporte_terreno`), restricción `chk_reporte_terreno_dictamen` y permiso `reportes:crear` en Migración `056` | Base de Datos / Esquema | Migración / Tipos Kysely | Alta | Migración `056_reporte_verificacion_cierre_y_no_abordable.ts` aplicada | `npm run db:migrate`, `\d reporte_terreno`, `\d incidente` y `056_...test.ts` | Columnas `fecha_cierre`, `motivo_no_abordable`, `tipo_reporte`, `dictamen`, `requiere_asistencia_social`, índice y permiso `reportes:crear` creados | Migración `056` aplicada con código `0`, esquema y constraint verificados en PostgreSQL y 2/2 tests de migración aprobados | APROBADO | 24/11/2026 01:05 | - | feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86) |
| `CP-H39-API-18` | Resiliencia del servicio `enviarReporteVerificacionService` si falla la emisión WebSocket tras confirmar la transacción | Tolerancia a Fallos | Unitaria / Servicio | Media | Error en emisión Socket.io rodeado de `try/catch` en `mision.service.ts:694-760` | Revisión de `enviarReporteVerificacionService` y ejecución de `mision-reporte.service.test.ts` | El servicio captura excepciones de socket sin revertir el cierre persistido y retorna el DTO completo | `mision-reporte.service.test.ts` (`2/2` tests pass) y manejo `try/catch` no bloqueante verificado en `mision.service.ts:755-760` | APROBADO | 24/11/2026 01:09 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-19` | Validación de esquema Zod para alias `camelCase`/`snake_case`, valores de `DictamenAtencionEnum`, cotas WGS84 y `personas_afectadas >= 0` | Validación / Contrato | Unitaria / Schema | Media | Esquema `CrearReporteVerificacionInputSchema` | `npm test -- src/modules/misiones/__tests__/mision-reporte.schema.test.ts` | Acepta solo `'REQUIERE_CUADRILLA'` \| `'NO_ABORDABLE'`, exige resumen >= 10, motivo >= 15 en `NO_ABORDABLE` y valida cotas numéricas | `7/7` tests aprobados en `mision-reporte.schema.test.ts` | APROBADO | 24/11/2026 01:09 | - | feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39) |
| `CP-H39-API-20` | Ejecución completa de suites Vitest, chequeo de tipos TypeScript y compilación de producción Next.js | Automatización / Build | Unit / Build / TS | Alta | Código fuente de `feature/h39-patrulla-enviar-reporte-cerrar` | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | 100% de pruebas automatizadas aprobadas, compilación limpia y `0` errores TypeScript/ESLint | `907/907` tests pass (`85` archivos; `23/23` directos HU-39; `122/122` Misiones+OpenAPI), `tsc` y `build` exit code `0`, `lint` `0 errors` | APROBADO | 24/11/2026 01:09 | - | docs(api): documentar contrato de reporte de verificacion y esquema actualizado (H39) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H39-API-01	Bypass de autorización horizontal e invariantes ICS con patrulla_id null o tipo_mision !== 'VERIFICACION', sobrescritura de incidente.estado y falta de .forUpdate("mision")	Seguridad / Regla de Negocio ICS	Repositorio / Endpoint	Crítica	Misión ATENCION_CUADRILLA (d1000000-...0002, patrulla_id = null, incidente EN_ATENCION) o misión PREVENCION (50000000-...0001, patrulla_id = null) en estado EN_CURSO	POST /api/misiones/d1000000-0000-4000-8000-000000000002/reporte con JWT de loreto.patrulla@valdivia.cl y dictamen: "NO_ABORDABLE"	Rechazo HTTP 409 Conflict / 403 Forbidden al no ser misión VERIFICACION con patrulla asignada, bloqueo .forUpdate("mision") y protección de estado EN_ATENCION	Retorna HTTP 201 Created, cierra misión de cuadrilla ajena dejando cuadrilla en EN_MISION y cambia incidente INC-2026-0004 de EN_ATENCION a NO_ABORDABLE	ABIERTO	24/11/2026 01:06	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-API-02	Bypass de autenticación JWT mediante cabecera x-user-id y escalamiento RBAC por asignación de misiones:leer en migración 056	Seguridad / Autenticación y RBAC	Route Handler / Migraciones	Crítica	Petición sin Authorization: Bearer usando x-user-id y usuario PATRULLA_VERIFICADORA tras ejecutar migración 056	POST /api/misiones/247be4dd-.../reporte con x-user-id y PATCH /api/patrullas/f1000000-...0020 con JWT de pedro.patrulla@valdivia.cl y {"estado":"NO_DISPONIBLE"}	HTTP 401 sin JWT Bearer válido en /reporte y HTTP 403 para patrullero en PATCH /api/patrullas/{id} (sin misiones:leer)	POST /reporte acepta x-user-id sin JWT y PATCH /api/patrullas/f1000000-...0020 responde HTTP 200 OK mutando el estado de una patrulla ajena	ABIERTO	24/11/2026 01:08	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-API-03	Desfase con origin/develop (10 conflictos), colisión de migración 052_ vs 035_/051_, eliminación de 041_ en migrator.ts y secciones duplicadas en docs/api/misiones.md	Integración / Base de Datos	Migraciones / Git / Docs	Alta	Rama feature/h39-patrulla-enviar-reporte-cerrar frente a origin/develop (014656a) y BD integrada	git merge-tree --write-tree --name-only develop HEAD, npm run db:migrate y lectura de docs/api/misiones.md	Fusión limpia sin colisiones ni borrado de migraciones de develop (035_, 041_, 051_, 072_) y documentación sin secciones repetidas	git merge-tree reporta 10 conflictos; migrator.ts renombra 035_ a 052_ y elimina 041_recuperacion_recurso_mision_id de kysely_migration; docs/api/misiones.md duplica 3.5 y 3.6	ABIERTO	24/11/2026 01:11	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-API-04	Secuestro cruzado (IDOR) de adjuntoIds entre incidentes, descarte silencioso de adjuntos inexistentes/sin url y catch internos que abortan transacción (25P02)	Seguridad / Integridad Transaccional	Repositorio / Schema	Alta	Adjunto d74b87ab-... vinculado a INC-2026-9932 y envío desde misión d980eb79-... de INC-2026-8869	POST /api/misiones/d980eb79-.../reporte con adjuntoIds: ["d74b87ab-..."] y caso con adjuntoIds: ["99999999-..."] y adjuntos: [{"nombreArchivo":"foto_sin_url.jpg"}]	Rechazo 403/404/409 ante adjunto ajeno o inexistente, 400 ante objeto adjunto vacío y propagación limpia de errores SQL	Retorna HTTP 201, reasigna adjunto.incidente_id al incidente ajeno en PostgreSQL y acepta UUID inexistente/objeto sin url devolviendo adjuntos: []	ABIERTO	24/11/2026 01:08	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-API-05	Ausencia de paridad GPS (latitud/longitud) y tolerancia a null en Zod, esquema bearerAuth roto en OpenAPI y totalReportesTerreno siempre en 0 en Kanban	Validación / Contrato OpenAPI / Kanban	Schema / OpenAPI / Repo	Media	Payload con latitud sin longitud o null en opcionales; consulta /openapi.json y GET /api/incidentes	POST /api/misiones/553b5ca5-.../reporte con latitud: -39.819588 sin longitud, GET /openapi.json y GET /api/incidentes?busqueda=INC-2026-9932	400 Bad Request ante GPS incompleto, OpenAPI con BearerAuth y permisos de terreno en GET /misiones/{id}, y totalReportesTerreno >= 1	Coordenada huérfana retorna 201 Created (lng: null), personas_afectadas: null falla con 400, /openapi.json declara bearerAuth y Kanban retorna totalReportesTerreno: 0	ABIERTO	24/11/2026 01:08	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H39-API-01	Envío exitoso de informe técnico con dictamen REQUIERE_CUADRILLA, Ficha FIBE y adjunto válido (201 Created)	Funcional / Positiva	Integración / Endpoint	Crítica	Misión 247be4dd-... (MIS-2026-0008) en estado EN_CURSO con incidente INC-2026-9932 en VERIFICANDO y JWT de pedro.patrulla@valdivia.cl	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte con dictamen: "REQUIERE_CUADRILLA", requiere_asistencia_social: true, adjuntos con url y GPS completo	HTTP 201 Created creando reporte_terreno (evaluador_id = usuario.id), mision.estado = "COMPLETADA" con fechaCierre, patrulla.estado = "DISPONIBLE" e incidente.requiereAsistenciaSocial = true	HTTP 201 Created con reporteTerreno, mision.estado: "COMPLETADA", patrulla.estado: "DISPONIBLE", incidente.estado: "VERIFICANDO", requiereAsistenciaSocial: true y adjunto persistido	APROBADO	24/11/2026 01:08	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-02	Envío exitoso con dictamen NO_ABORDABLE y motivo_no_abordable >= 15 caracteres cerrando misión, liberando patrulla y cerrando incidente (201 Created)	Funcional / Positiva	Integración / Endpoint	Crítica	Misión df7b5280-... (MIS-2026-0010) en EN_CURSO con JWT de loreto.patrulla@valdivia.cl	POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/reporte con dictamen: "NO_ABORDABLE", motivo_no_abordable de 97 caracteres y personas_afectadas: 0	HTTP 201 Created con mision.estado = "COMPLETADA", patrulla.estado = "DISPONIBLE", incidente.estado = "NO_ABORDABLE", fechaCierre y motivoNoAbordable	HTTP 201 Created actualizando atómicamente mision, patrulla y incidente (estado: "NO_ABORDABLE", fechaCierre: "2026-11-24T04:08:14.774Z")	APROBADO	24/11/2026 01:08	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-03	Rescate automático de personas_afectadas desde el reporte previo de prioridad (HU-38) cuando se omite en HU-39	Funcional / Integración HU-38	Integración / Repositorio	Alta	Misión d980eb79-... con reporte previo EVALUACION_PRIORIDAD (personas_afectadas = 7)	POST /api/misiones/d980eb79-4d8a-441a-8765-6c9e984914d9/reporte omitiendo personas_afectadas	reporteTerreno.personasAfectadas === 7, detallesEvaluacion.personasAfectadasPrevias === 7, personasAfectadasModificadas === false y versionReporte === 2	HTTP 201 Created rescatando personasAfectadas: 7, personasAfectadasPrevias: 7 y versionReporte: 2	APROBADO	24/11/2026 01:08	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-04	Rectificación de personas_afectadas respecto al valor previo de HU-38 con trazabilidad en detalles_evaluacion	Funcional / Integración HU-38	Unitaria / Repositorio	Media	Reporte previo EVALUACION_PRIORIDAD con personas_afectadas = 3 en mock de transacción	crearReporteVerificacionYCerrarMisionRepo con personasAfectadas: 0 (mision-reporte.repository.test.ts)	Persiste personas_afectadas: 0 y marca personasAfectadasModificadas: true manteniendo personasAfectadasPrevias: 3	Test unitario aprobado verificando personas_afectadas: 0, personasAfectadasPrevias: 3 y personasAfectadasModificadas: true	APROBADO	24/11/2026 01:09	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-05	Registro automático del hito VERIFICACION_COMPLETADA en mision_hito y proyección en GET /api/misiones/{id} (bitacoraTiempos y evaluaciones)	Funcional / Trazabilidad ICS	Integración / BD	Crítica	Misión 247be4dd-... cerrada con informe técnico de verificación	GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02 con JWT de encargado@valdivia.cl	bitacoraTiempos incluye DESPACHADA, MISION_ACEPTADA y VERIFICACION_COMPLETADA; evaluaciones.reporteVerificacionEnviado === true y dictamenVerificacion === "REQUIERE_CUADRILLA"	HTTP 200 OK exponiendo los 3 hitos cronológicos y evaluaciones.reporteVerificacionEnviado: true	APROBADO	24/11/2026 01:08	-	fix(misiones): habilitar lectura de detalle a personal de terreno y trazabilidad de evaluador
CP-H39-API-06	Emisión de eventos WebSocket mision:actualizada, incidente:actualizado, patrulla:actualizada y patrulla:liberada en Redis Pub/Sub	Tiempo Real / Socket.io	Integración / Redis	Crítica	Broker Redis activo en localhost:6001 y escucha en canal sgrai:socket-events	Suscripción a sgrai:socket-events durante POST /api/misiones/{id}/reporte para REQUIERE_CUADRILLA y NO_ABORDABLE	Emisión de mision:actualizada (encargado, sala:encargados, supervisor), incidente:actualizado (sala:encargados, encargado, mapa), patrulla:actualizada y patrulla:liberada	16 mensajes recibidos por cada cierre en sgrai:socket-events incluyendo nuevoEstado: "NO_ABORDABLE" y dictamen	APROBADO	24/11/2026 01:08	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-07	Rechazo por ausencia total de credenciales de autenticación (401 Unauthorized)	Seguridad / Autenticación	Endpoint / Route Handler	Crítica	Petición sin Authorization ni x-user-id	POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte sin cabeceras	HTTP 401 Unauthorized indicando cabecera requerida	HTTP 401 Unauthorized: {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}	APROBADO	24/11/2026 01:06	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-08	Rechazo RBAC para usuario sin permiso reportes:crear (403 Forbidden)	Seguridad / RBAC	Endpoint / Auth	Crítica	Usuario carlos.miranda@valdivia.cl (CALL_CENTER, sin reportes:crear)	POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte con x-user-id: c1111111-1111-4111-8111-111111111111	HTTP 403 Forbidden indicando ausencia del permiso reportes:crear	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: reportes:crear"}	APROBADO	24/11/2026 01:06	-	feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86)
CP-H39-API-09	Rechazo de autorización horizontal cuando un patrullero intenta cerrar una misión asignada a otra patrulla (403 Forbidden)	Seguridad / Autorización	Endpoint / Repositorio	Crítica	Misión d1000000-...0001 (patrulla_id asignado a Costa-1) e invocación por loreto.patrulla@valdivia.cl (otra patrulla)	POST /api/misiones/d1000000-0000-4000-8000-000000000001/reporte con x-user-id: d1000000-0000-4000-8000-000000000002	HTTP 403 Forbidden impidiendo cerrar misión de otra patrulla	HTTP 403 Forbidden: {"message":"No está autorizado para enviar el informe técnico ni cerrar una misión asignada a otra patrulla verificadora."}	APROBADO	24/11/2026 01:06	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-10	Rechazo por parámetro de ruta id con formato UUID inválido y por cuerpo JSON malformado (400 Bad Request)	Validación / Robustez	Endpoint / Route Handler	Media	Petición autenticada con id inválido o body corrupto	POST /api/misiones/no-es-uuid/reporte y POST /api/misiones/d1000000-.../reporte con -d '{malformed'	HTTP 400 Bad Request para ambos casos	HTTP 400 Bad Request con mensaje "El identificador de la misión proporcionado no es un UUID válido." y "El cuerpo de la petición no es un JSON válido."	APROBADO	24/11/2026 01:06	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-11	Rechazo de validación Zod cuando dictamen es NO_ABORDABLE con motivo_no_abordable < 15 chars y resumen_tecnico < 10 chars (400 Bad Request)	Validación / Esquema Zod	Endpoint / Schema	Crítica	Petición autenticada con dictamen NO_ABORDABLE sin justificación suficiente	POST /api/misiones/d1000000-.../reporte con {"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Corto","resumen_tecnico":"Corto"}	HTTP 400 Bad Request reportando ambos errores de longitud mínima (10 y 15 caracteres)	HTTP 400 Bad Request con errors detallando resumen_tecnico (>= 10) y motivo_no_abordable (>= 15)	APROBADO	24/11/2026 01:06	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-12	Rechazo cuando el identificador UUID de la misión no existe en base de datos (404 Not Found)	Funcional / Negativa	Endpoint / Repositorio	Alta	UUID inexistente en tabla mision	POST /api/misiones/60000000-0000-4000-8000-000000000999/reporte con payload válido	HTTP 404 Not Found	HTTP 404 Not Found: {"message":"No se encontró ninguna misión con el identificador proporcionado."}	APROBADO	24/11/2026 01:06	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-13	Rechazo cuando la misión aún se encuentra en estado DESPACHADA sin haber sido aceptada por la patrulla (409 Conflict)	Regla de Negocio ICS	Endpoint / Repositorio	Alta	Misión 247be4dd-... en estado DESPACHADA	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte con JWT o ID de Pedro	HTTP 409 Conflict exigiendo aceptación previa (EN_CURSO)	HTTP 409 Conflict: {"message":"La patrulla debe aceptar la misión asignada antes de poder enviar el informe técnico de verificación."}	APROBADO	24/11/2026 01:06	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-14	Idempotencia / bloqueo de reenvío cuando la misión ya fue cerrada (COMPLETADA) y control de concurrencia en doble envío simultáneo (409 Conflict)	Concurrencia / Idempotencia	Integración / Transacción	Crítica	Misión cerrada (247be4dd-...) y misión EN_CURSO (3e2f1690-...) sometida a 2 peticiones Promise.all	POST /reporte posterior al cierre y 2 POST /reporte simultáneos con JWT de ignacio.patrulla@valdivia.cl	Exactamente 1 petición retorna 201 Created (1 fila en reporte_terreno) y las restantes 409 Conflict	Reenvío retorna 409; Promise.all retorna [201, 409] con exactamente 1 reporte en PostgreSQL	APROBADO	24/11/2026 01:08	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-15	Bloqueo de despacho de cuadrilla (HU-21) tras cierre NO_ABORDABLE y habilitación de despacho tras REQUIERE_CUADRILLA	Integración Inter-HU (HU-21)	Integración / Endpoint	Alta	Incidente a1000000-...0002 cerrado como NO_ABORDABLE e incidente 980f2584-... cerrado con REQUIERE_CUADRILLA	POST /api/misiones (ATENCION_CUADRILLA) con JWT de encargado@valdivia.cl sobre ambos incidentes	409 Conflict sobre NO_ABORDABLE y 201 Created transicionando a EN_ATENCION sobre REQUIERE_CUADRILLA	409 Conflict sobre NO_ABORDABLE y 201 Created (MIS-2026-0015, incidente EN_ATENCION) sobre REQUIERE_CUADRILLA	APROBADO	24/11/2026 01:09	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-16	Exposición de campos de cierre (tipoReporte, dictamen, motivoNoAbordable, fechaCierre, ultimoReporte) en GET /api/incidentes/{id}	Funcional / Proyección	Integración / Servicio	Alta	Incidente INC-2026-9932 con informe VERIFICACION_CIERRE registrado	GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38 con JWT de encargado@valdivia.cl	HTTP 200 OK proyectando ultimoReporte (tipoReporte: "VERIFICACION_CIERRE", dictamen: "REQUIERE_CUADRILLA") y reportesEvaluacionTerreno	HTTP 200 OK con ultimoReporte completo (evaluadorNombre: "Pedro Valenzuela", dictamen: "REQUIERE_CUADRILLA") y totalReportes: 1	APROBADO	24/11/2026 01:08	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-17	Creación de columnas de cierre y dictamen (incidente, reporte_terreno), restricción chk_reporte_terreno_dictamen y permiso reportes:crear en Migración 056	Base de Datos / Esquema	Migración / Tipos Kysely	Alta	Migración 056_reporte_verificacion_cierre_y_no_abordable.ts aplicada	npm run db:migrate, \d reporte_terreno, \d incidente y 056_...test.ts	Columnas fecha_cierre, motivo_no_abordable, tipo_reporte, dictamen, requiere_asistencia_social, índice y permiso reportes:crear creados	Migración 056 aplicada con código 0, esquema y constraint verificados en PostgreSQL y 2/2 tests de migración aprobados	APROBADO	24/11/2026 01:05	-	feat(db): agregar migracion 056, tipos y permiso reportes:crear para cierre de verificacion (H39/H86)
CP-H39-API-18	Resiliencia del servicio enviarReporteVerificacionService si falla la emisión WebSocket tras confirmar la transacción	Tolerancia a Fallos	Unitaria / Servicio	Media	Error en emisión Socket.io rodeado de try/catch en mision.service.ts:694-760	Revisión de enviarReporteVerificacionService y ejecución de mision-reporte.service.test.ts	El servicio captura excepciones de socket sin revertir el cierre persistido y retorna el DTO completo	mision-reporte.service.test.ts (2/2 tests pass) y manejo try/catch no bloqueante verificado en mision.service.ts:755-760	APROBADO	24/11/2026 01:09	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-19	Validación de esquema Zod para alias camelCase/snake_case, valores de DictamenAtencionEnum, cotas WGS84 y personas_afectadas >= 0	Validación / Contrato	Unitaria / Schema	Media	Esquema CrearReporteVerificacionInputSchema	npm test -- src/modules/misiones/__tests__/mision-reporte.schema.test.ts	Acepta solo 'REQUIERE_CUADRILLA' | 'NO_ABORDABLE', exige resumen >= 10, motivo >= 15 en NO_ABORDABLE y valida cotas numéricas	7/7 tests aprobados en mision-reporte.schema.test.ts	APROBADO	24/11/2026 01:09	-	feat(misiones): implementar endpoint de informe tecnico de verificacion y cierre de mision (H39)
CP-H39-API-20	Ejecución completa de suites Vitest, chequeo de tipos TypeScript y compilación de producción Next.js	Automatización / Build	Unit / Build / TS	Alta	Código fuente de feature/h39-patrulla-enviar-reporte-cerrar	npm test, npx tsc --noEmit, npm run lint, npm run build	100% de pruebas automatizadas aprobadas, compilación limpia y 0 errores TypeScript/ESLint	907/907 tests pass (85 archivos; 23/23 directos HU-39; 122/122 Misiones+OpenAPI), tsc y build exit code 0, lint 0 errors	APROBADO	24/11/2026 01:09	-	docs(api): documentar contrato de reporte de verificacion y esquema actualizado (H39)
```

---

## 5. Guía de Ejecución Replicable Paso a Paso (Vitest, cURL y Evidencias)

### 5.1 Verificación de Compilación, Tipado, Linter y Suite Vitest (`CP-H39-API-04`, `17`, `18`, `19`, `20`)

```bash
# 1. Pruebas automatizadas directas de HU-39, Migración 056 y OpenAPI
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

# 3. Chequeo de tipos TypeScript, ESLint y compilación Next.js
npx tsc --noEmit
npm run lint
npm run build
```

**Salidas observadas:**
```text
# Directas HU-39 + Migración 056 + OpenAPI
 ✓ src/lib/db/migrations/__tests__/056_reporte_verificacion_cierre_y_no_abordable.test.ts (2 tests)
 ✓ src/modules/misiones/__tests__/mision-reporte.schema.test.ts (7 tests)
 ✓ src/app/api/misiones/[id]/reporte/__tests__/route.test.ts (6 tests)
 ✓ src/modules/misiones/__tests__/mision-reporte.repository.test.ts (5 tests)
 ✓ src/modules/misiones/__tests__/mision-reporte.service.test.ts (2 tests)
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test)
 Test Files  6 passed (6) | Tests  23 passed (23) | Duration 2.25s

# Módulo Misiones + OpenAPI
 Test Files  18 passed (18) | Tests  122 passed (122) | Duration 3.02s

# Suite Global
 Test Files  85 passed (85) | Tests  907 passed (907) | Duration 9.95s

npx tsc --noEmit -> exit code 0
npm run lint     -> ✖ 1 problem (0 errors, 1 warning en tipologia/__tests__/route.test.ts:13)
npm run build    -> ✓ Compiled successfully (Next.js 16.3.4 Turbopack)
```

---

### 5.2 Verificación de Migraciones Kysely y Sincronización con `develop` (`BUG-H39-API-03`, `CP-H39-API-17`)

```bash
npm run db:migrate
git merge-tree --write-tree --name-only develop HEAD
docker exec grupo1_postgres psql -U sgrai -d sgrai -c "SELECT name FROM kysely_migration ORDER BY name;"
```

**Evidencia observada:**
```text
[RECONCILIACIÓN] Migración renumerada actualizada en kysely_migration: "035_permiso_misiones_terreno_verificar" -> "052_permiso_misiones_terreno_verificar"
[OK] Migración Kysely ejecutada con éxito: "053_incidente_prioridad_y_evaluacion_terreno"
[OK] Migración Kysely ejecutada con éxito: "054_resync_titulo_mision_verificacion"
[OK] Migración Kysely ejecutada con éxito: "055_mision_hito_metadatos"
[OK] Migración Kysely ejecutada con éxito: "056_reporte_verificacion_cierre_y_no_abordable"

git merge-tree -> CONFLICTO (contenido) en 10 archivos:
  docs/api/incidentes.md, docs/api/misiones.md, src/lib/db/types.ts, src/lib/openapi/index.ts,
  src/modules/incidentes/incidente-kanban.{repository,service}.ts,
  src/modules/misiones/mision.{repository,schema,service}.ts, src/modules/seguridad/permisos.constants.ts
```

---

### 5.3 Casos Replicables mediante cURL y Respuestas HTTP/JSON Observadas

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
```

#### 2. Rechazos de Autenticación, RBAC, Pertenencia y Validación (`CP-H39-API-07` a `13`)
```bash
# CP-H39-API-07: Sin credenciales (401)
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/reporte" \
  -H "Content-Type: application/json" -d '{}'

# CP-H39-API-08: Rol CALL_CENTER sin permiso reportes:crear (403)
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/reporte" \
  -H "x-user-id: c1111111-1111-4111-8111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Prueba de rol sin permiso"}'

# CP-H39-API-09: Patrulla ajena sobre misión con patrulla_id presente (403)
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/reporte" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Resumen tecnico valido sobre diez chars"}'

# CP-H39-API-10: UUID inválido y JSON malformado (400)
curl -s -i -X POST "http://localhost:3001/api/misiones/no-es-uuid/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" -H "Content-Type: application/json" -d '{}'
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" -H "Content-Type: application/json" -d '{malformed'

# CP-H39-API-11: Dictamen NO_ABORDABLE con motivo < 15 y resumen < 10 (400)
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" -H "Content-Type: application/json" \
  -d '{"dictamen":"NO_ABORDABLE","motivo_no_abordable":"Corto","resumen_tecnico":"Corto"}'

# CP-H39-API-12: Misión inexistente (404)
curl -s -i -X POST "http://localhost:3001/api/misiones/60000000-0000-4000-8000-000000000999/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Resumen tecnico valido sobre diez chars"}'

# CP-H39-API-13: Misión en estado DESPACHADA aún no aceptada (409)
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/reporte" \
  -H "Authorization: Bearer $TOKEN_PEDRO" -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Resumen tecnico valido sobre diez chars"}'
```

**Respuestas HTTP/JSON observadas:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: reportes:crear"}

HTTP/1.1 403 Forbidden
{"message":"No está autorizado para enviar el informe técnico ni cerrar una misión asignada a otra patrulla verificadora."}

HTTP/1.1 400 Bad Request
{"message":"El identificador de la misión proporcionado no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador de la misión debe ser un UUID válido."}]}

HTTP/1.1 400 Bad Request
{"message":"El cuerpo de la petición no es un JSON válido."}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el informe técnico de verificación en terreno.","errors":[{"campo":"resumen_tecnico","mensaje":"El resumen técnico del siniestro es obligatorio y debe contener al menos 10 caracteres."},{"campo":"motivo_no_abordable","mensaje":"Cuando el dictamen es 'NO_ABORDABLE', el campo 'motivo_no_abordable' es obligatorio y debe contener al menos 15 caracteres."}]}

HTTP/1.1 404 Not Found
{"message":"No se encontró ninguna misión con el identificador proporcionado."}

HTTP/1.1 409 Conflict
{"message":"La patrulla debe aceptar la misión asignada antes de poder enviar el informe técnico de verificación."}
```

#### 3. Flujo Completo `REQUIERE_CUADRILLA` + Ficha FIBE + Adjuntos + Redis Pub/Sub + Consulta en Central (`CP-H39-API-01`, `03`, `05`, `06`, `16`)
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
      "url": "uploads/evidencia/sumidero_colapsado.jpg",
      "tipoMime": "image/jpeg",
      "tamanoBytes": 345120
    }],
    "latitud": -39.819588,
    "longitud": -73.245209
  }'

# 3. Consultar bitácora y detalle en Centro de Mando (GET /api/misiones/{id} y GET /api/incidentes/{id})
curl -s -X GET "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO"
curl -s -X GET "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO"
```

**Respuestas HTTP/JSON observadas:**
```http
HTTP/1.1 201 Created
{
  "message": "Informe técnico de verificación registrado y misión cerrada exitosamente.",
  "data": {
    "reporteTerreno": {
      "id": "23fa8729-0483-4a5c-803c-242219dc00c3",
      "misionId": "247be4dd-a0b8-490f-8d66-4de1144ddd02",
      "tipoReporte": "VERIFICACION_CIERRE",
      "dictamen": "REQUIERE_CUADRILLA",
      "requiereAsistenciaSocial": true,
      "personasAfectadas": 0,
      "estadoTerreno": "CRITICO",
      "adjuntos": [
        {
          "id": "d74b87ab-70cf-4e83-95f8-6866756c3eb8",
          "nombreArchivo": "sumidero_colapsado.jpg",
          "url": "/uploads/evidencia/sumidero_colapsado.jpg",
          "tipoMime": "image/jpeg",
          "tamanoBytes": 345120
        }
      ]
    },
    "mision": { "id": "247be4dd-a0b8-490f-8d66-4de1144ddd02", "estado": "COMPLETADA", "fechaCierre": "2026-11-24T04:08:14.411Z" },
    "patrulla": { "id": "f1000000-0000-4000-8000-000000000010", "estado": "DISPONIBLE" },
    "incidente": { "id": "dd7db71e-e878-4b58-a115-a848dc88bb38", "estado": "VERIFICANDO", "requiereAsistenciaSocial": true },
    "hito": { "hito": "VERIFICACION_COMPLETADA", "registradoPorId": "d1000000-0000-4000-8000-000000000001" }
  }
}
```
```text
Eventos en canal Redis sgrai:socket-events (16 mensajes):
- mision:actualizada    -> salas ["encargado", "sala:encargados", "supervisor"]
- incidente:actualizado -> salas ["sala:encargados", "encargado", "mapa"]
- patrulla:actualizada  -> salas ["encargado", "sala:encargados", "supervisor", "mapa", "patrulla:f1000000-...0010"]
- patrulla:liberada     -> salas ["encargado", "sala:encargados", "supervisor", "mapa", "patrulla:f1000000-...0010"]
```

#### 4. Flujo `NO_ABORDABLE` y Reproducción de Defectos Abiertos (`CP-H39-API-02`, `15` y `BUG-H39-API-01`, `02`, `04`, `05`)
```bash
# CP-H39-API-02: Cierre fundado NO_ABORDABLE (201 Created)
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

# BUG-H39-API-01: Bypass sobre ATENCION_CUADRILLA con patrulla_id=NULL por patrullero ajeno (retorna 201 en vez de 403/409)
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000002/reporte" \
  -H "Authorization: Bearer $TOKEN_LORETO" \
  -H "Content-Type: application/json" \
  -d '{
    "dictamen": "NO_ABORDABLE",
    "motivo_no_abordable": "Intento de cierre no abordable sobre mision de cuadrilla ajena",
    "resumen_tecnico": "Prueba de bypass horizontal sobre mision sin patrulla asignada"
  }'

# BUG-H39-API-02: Escalamiento RBAC via misiones:leer sobre patrulla ajena (retorna 200 en vez de 403)
curl -s -i -X PATCH "http://localhost:3001/api/patrullas/f1000000-0000-4000-8000-000000000020" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"estado":"NO_DISPONIBLE"}'

# BUG-H39-API-04: IDOR de adjuntoId perteneciente a otro incidente (retorna 201 y secuestra adjunto)
curl -s -i -X POST "http://localhost:3001/api/misiones/d980eb79-4d8a-441a-8765-6c9e984914d9/reporte" \
  -H "Authorization: Bearer $TOKEN_MATIAS" \
  -H "Content-Type: application/json" \
  -d '{
    "dictamen": "REQUIERE_CUADRILLA",
    "resumen_tecnico": "Rescate de personas afectadas desde HU-38 y prueba de adjunto cruzado.",
    "estado_terreno": "CRITICO",
    "requiere_asistencia_social": true,
    "adjuntoIds": ["d74b87ab-70cf-4e83-95f8-6866756c3eb8"]
  }'

# BUG-H39-API-05: Coordenada GPS huérfana (retorna 201 con lng=null en vez de 400) y consulta OpenAPI
curl -s -i -X POST "http://localhost:3001/api/misiones/553b5ca5-7a6d-4ba1-bf03-531dfa2d0f2c/reporte" \
  -H "Authorization: Bearer $TOKEN_MATIAS" \
  -H "Content-Type: application/json" \
  -d '{"dictamen":"REQUIERE_CUADRILLA","resumen_tecnico":"Prueba coordenada GPS huerfana sin longitud","latitud":-39.819588}'

curl -s http://localhost:3001/openapi.json | jq '{securitySchemes: (.components.securitySchemes | keys), reporteSecurity: .paths["/api/misiones/{id}/reporte"].post.security}'
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La PWA debe proveer un formulario de reporte técnico de verificación accesible para la patrulla. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz en el repositorio `sgrai-pwa`. |
| **CA-2:** El formulario en la PWA debe incorporar el selector de dictamen operativo: `Dictamen de Atención: ['REQUIERE_CUADRILLA', 'NO_ABORDABLE']`. | `CP-H39-API-01`, `CP-H39-API-02`, `CP-H39-API-19` | 🟢 **CUMPLIDO** | `DictamenAtencionEnum` valida estrictamente `'REQUIERE_CUADRILLA'` y `'NO_ABORDABLE'` en esquema Zod y constraint SQL `chk_reporte_terreno_dictamen`. |
| **CA-3:** Si selecciona `NO_ABORDABLE`, exige `motivo_no_abordable` (mín. 15 caracteres) y ejecuta transacción atómica: persiste reporte, `mision = COMPLETADA`, `patrulla = DISPONIBLE`, `incidente = NO_ABORDABLE` con `fecha_cierre` y motivo, emitiendo `incidente:actualizado`. | `CP-H39-API-02`, `CP-H39-API-06`, `CP-H39-API-11`, `BUG-H39-API-01` | 🟡 **PARCIAL / OBSERVADO** | El flujo nominal cumple íntegramente (verificado en PostgreSQL y Redis); observado por `BUG-H39-API-01` al no restringir `tipo_mision === 'VERIFICACION'`, `patrulla_id !== null` ni estado previo del incidente. |
| **CA-4:** Capturar `resumen_tecnico` (obligatorio, mín. 10 caracteres), `estado_terreno`, `personas_afectadas`, `danos_estimados`, observaciones y casilla `requiere_asistencia_social`. | `CP-H39-API-01`, `CP-H39-API-03`, `CP-H39-API-04`, `CP-H39-API-11`, `CP-H39-API-19`, `BUG-H39-API-05` | 🟡 **PARCIAL / OBSERVADO** | Campos validados, con rescate automático de `personas_afectadas` desde HU-38; observado en `BUG-H39-API-05` por falta de paridad GPS y de tolerancia a `null` en campos opcionales. |
| **CA-5:** Transacción atómica al cerrar: crear `reporte_terreno` con `evaluador_id = usuario.id`, actualizar `mision.estado = 'COMPLETADA'` con `fecha_cierre`, actualizar `incidente.requiere_asistencia_social = true` si aplica y registrar hito en `mision_hito`. | `CP-H39-API-01`, `CP-H39-API-05`, `CP-H39-API-14`, `CP-H39-API-17`, `BUG-H39-API-01`, `BUG-H39-API-04` | 🟡 **PARCIAL / OBSERVADO** | Transacción atómica operativa en flujo nominal; observada por ausencia de `.forUpdate("mision")`, validación de tipo/patrulla (`BUG-H39-API-01`) y `catch` internos dentro de transacción (`BUG-H39-API-04`). |
| **CA-6:** Debe permitir adjuntar fotografías como evidencia técnica (integrándose con H43). | `CP-H39-API-01`, `BUG-H39-API-04` | 🟡 **PARCIAL / OBSERVADO** | Soporta `adjuntoIds` y `adjuntos` vinculados a `adjunto.reporte_terreno_id`; observado por vulnerabilidad IDOR y aceptación silenciosa de adjuntos inexistentes/sin `url` (`BUG-H39-API-04`). |
| **CA-7:** El sistema debe emitir la notificación WebSocket `mision:actualizada` e `incidente:actualizado` al Centro de Mando. | `CP-H39-API-06`, `CP-H39-API-18` | 🟢 **CUMPLIDO** | Verificado en vivo en canal Redis `sgrai:socket-events` emitiendo `mision:actualizada`, `incidente:actualizado`, `patrulla:actualizada` y `patrulla:liberada`. |
| **CA-8:** La PWA debe notificar el éxito del envío y regresar a la pantalla de espera de nuevas asignaciones. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz en el repositorio `sgrai-pwa`. |
| **CA-9:** El endpoint debe requerir el permiso RBAC `reportes:crear`. | `CP-H39-API-07`, `CP-H39-API-08`, `CP-H39-API-09`, `CP-H39-API-17`, `BUG-H39-API-02` | 🟡 **PARCIAL / OBSERVADO** | El permiso `reportes:crear` es validado en el route handler y migrado en `056`; observado por bypass vía cabecera plana `x-user-id` sin JWT y asignación excesiva de `misiones:leer` en `056` (`BUG-H39-API-02`). |

