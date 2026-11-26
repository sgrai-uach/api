# Informe y Matriz de Casos de Prueba (QA): HU-76 — Listado de Eventos y Misiones de Prevención en Puntos Críticos (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Prevención y Puntos Críticos (`sgrai-api` — `GET /api/eventos-atp/prevencion`).  
> **Historia de Usuario:** HU-76 — *"Como Encargado Quiero consultar un listado de los eventos y misiones preventivas desplegadas en puntos críticos comunales Para supervisar las obras de mitigación activas (limpieza de sumideros, fajas cortafuego) y asegurar la protección anticipada de sectores vulnerables."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H76-listar-eventos-prevencion` (desarrollador asignado: `zetastormy`).  
> **Commits Clave Evaluados en Rama (Conventional Commits):**
> * `fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05`
> * `feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)`
> * `chore(seed): agregar eventos preventivos de prueba para H76`
> * `fix(seed): omitir filtro activo en consulta de cuadrilla y patrulla`
>
> **Fecha de Auditoría Inicial:** 25/11/2026 17:23.  
> **Fecha de Ciclo Re-Test Final:** 26/11/2026 14:53.  
> **Estado de Certificación QA:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Backend Cumplidos — 5 Defectos Subsanados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test Definitivo

Tras completar el ciclo de Re-Test técnico sobre la rama `feature/H76-listar-eventos-prevencion` —incluyendo inspección de código fuente, verificación de fusión limpia contra `origin/develop`, ejecución de migraciones Kysely y orquestador unificado de semillas en PostgreSQL 16 + PostGIS, validación de contrato OpenAPI 3.0, análisis estático (`npm run lint` y `npx tsc --noEmit`), suites automatizadas Vitest (`npm test`) y pruebas funcionales E2E en vivo mediante `curl`—, se certifica que los 5 defectos detectados en la auditoría inicial (`BUG-H76-API-01` a `BUG-H76-API-05`) fueron subsanados satisfactoriamente.

### Resultado de la Re-Evaluación Técnica (Re-Test Definitivo — 26/11/2026 14:53):
1. **Resolución de Error SQL `42601` en Paginación Fuera de Rango (`BUG-H76-API-01`):** Se incorporó guardia temprana `if (eventos.length === 0)` en `evento-prevencion.repository.ts` antes de consultar `mision` y `evento_prevencion_recurso`. Las peticiones `GET /api/eventos-atp/prevencion?page=99&limit=20` y `?page=4&limit=2` con 6 registros activos responden ahora HTTP `200 OK` con `data: []` y metadatos `meta` consistentes bajo estándar H34.
2. **Alineación de Enum de Estados con CA-2 (`BUG-H76-API-02`):** Se actualizó `EstadoEventoPrevencionSchema` a `["PLANIFICADA", "EN_EJECUCION", "COMPLETADA", "CANCELADA"]`, alineándolo con CA-2, `EstadoRecuperacionSchema`, OpenAPI 3.0, `docs/api/eventos-atp.md`, `scripts/seed-eventos-prevencion.ts` y la migración `046_` (que normaliza registros históricos de `EN_CURSO` a `EN_EJECUCION`). El filtro `?estado=EN_EJECUCION` responde HTTP `200 OK` devolviendo `PREV-2026-9001`, y `?estado=EN_CURSO` se rechaza correctamente con `400 Bad Request`.
3. **Sincronización con `develop`, Esquema Kysely y Seed Unificado (`BUG-H76-API-03`):** Se integró `develop` resolviendo los 3 conflictos previos (`docs/api/eventos-atp.md`, `package.json`, `permisos.constants.ts`), logrando `0` conflictos en `git merge-tree --write-tree origin/develop HEAD`. `EventoPrevencionTable` en `src/lib/db/types.ts` conserva `evento_atp_id` junto a `activo`, `eliminado_en` y `eliminado_por_id`; se eliminó la migración duplicada `035_`; se integró `eventos-prevencion` dentro del orquestador `scripts/seed/index.ts` (`npm run seed -- --only=eventos-prevencion`); y la consulta de usuario creador en `scripts/seed-eventos-prevencion.ts` filtra por roles `ENCARGADO` o `ADMIN`.
4. **Mensaje RBAC Contextual y Manejo de Query Params Vacíos (`BUG-H76-API-04`):** En `route.ts` se agregó el mensaje explícito `"Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'."` en `validarAccesoRoles`, verificado en vivo con usuarios `CALL_CENTER` y `PATRULLA_VERIFICADORA` (`403 Forbidden`), y se filtraron cadenas vacías al construir `queryParams`, validando que `?delegacionId=&estado=&busqueda=` responde HTTP `200 OK` retornando el listado completo.
5. **Determinismo SQL, Tipado OpenAPI GeoJSON y Cobertura Unitaria (`BUG-H76-API-05`):** Se añadió desempate determinista `.orderBy("ep.id", "desc")` en eventos y ordenamiento ponderado priorizando misiones activas (`EN_CURSO`, `DESPACHADA`) con `m.creado_en DESC` y `m.id DESC`; se definió `GeoJsonPointSchema` con `type: "Point"` y `coordinates: [number, number]` reflejado como campo requerido en `GET /openapi.json` (tanto en el evento como en `puntoCritico`); y se agregaron suites unitarias dedicadas para `evento-prevencion.repository.test.ts` (2 tests) y `046_eventos_prevencion_permiso_leer_y_borrado_logico.test.ts` (2 tests).

| Métrica de Calidad | Evaluación Inicial (25/11/2026) | Ciclo Re-Test (26/11/2026) | Estado Actual |
|---|:---:|:---:|:---:|
| **Total Casos Diseñados en Matriz** | 19 Casos (5 Defectos + 14 Funcionales/Técnicos) | 19 Casos | 19 Casos |
| **Casos Aprobados (Passed)** | 14 | 19 | 🟢 **19/19 Aprobados (100%)** |
| **Casos Fallidos / Defectos Abiertos** | 5 (`BUG-H76-API-01` a `05`) | 0 | 🟢 **0 Defectos Abiertos** |
| **Defectos Subsanados** | 0/5 | 5/5 | 🟢 **100% Subsanados** |
| **Tasa de Aprobación Global (% Pass)** | 73.68% | **100.0%** | 🟢 **Certificado para Integración** |
| **Suite Vitest Módulo Prevención, Repo, Migración 046 y OpenAPI** | 32/32 tests (3 archivos) | 37/37 tests (5 archivos) | 🟢 **37/37 Aprobados (4.59s)** |
| **Suite Vitest Global (`npm test`)** | 851/851 tests (72 archivos) | 1021/1021 tests (96 archivos) | 🟢 **1021/1021 Aprobados (6.93s)** |
| **Análisis Estático ESLint (`npm run lint`)** | 0 errores, 0 warnings | 0 errores, 0 warnings | 🟢 **Código Limpio** |
| **Chequeo TypeScript (`npx tsc --noEmit`)** | 7 errores por desfase `.next/types` | 0 errores | 🟢 **Tipos Kysely y Zod Alineados** |
| **Sincronización con `origin/develop`** | 86 commits atrás, 3 conflictos | 0 conflictos en `merge-tree` | 🟢 **Merge Limpio sin Conflictos** |
| **Migración Kysely `046_` y Seed Unificado** | Aplicada sin test unitario ni orquestador | Aplicada, con test `up`/`down` y en `npm run seed` | 🟢 **Verificado en PostgreSQL** |

---

## 2. Registro Técnico de Defectos Subsanados (Bugs)

### `BUG-H76-API-01`: Error HTTP `500` (`42601: syntax error at or near ")"`) al consultar una página fuera de rango (`page > totalPages`) cuando `total > 0`
* **Severidad:** Crítica (Disponibilidad del Endpoint / Integridad de Paginación H34).
* **Estado Post Re-Test (26/11/2026 14:53):** 🟢 **SUBSANADO Y CERTIFICADO.**
* **Archivo Afectado:** `src/modules/eventos-atp/evento-prevencion.repository.ts` (líneas 349–356).
* **Solución Implementada:** Se agregó el retorno temprano `if (eventos.length === 0)` inmediatamente después de la consulta paginada de eventos, evitando invocar `.where("m.evento_prevencion_id", "in", [])` y `.where("epr.evento_prevencion_id", "in", [])`.
* **Verificación en Vivo y Automatizada:** Las peticiones `GET /api/eventos-atp/prevencion?page=99&limit=20` y `?page=4&limit=2` con 6 registros en PostgreSQL devolvieron HTTP `200 OK` con `data: []` y `meta` consistente. Adicionalmente, la prueba unitaria `BUG-H76-API-01` en `evento-prevencion.repository.test.ts` verifica que se ejecutan únicamente 2 consultas SQL.

---

### `BUG-H76-API-02`: Discrepancia de contrato en enum de estado operativo — el endpoint rechazaba `EN_EJECUCION` (HTTP `400`) exigido por CA-2 y empleaba `EN_CURSO`
* **Severidad:** Alta (Cumplimiento de Criterio de Aceptación CA-2 / Contrato con `sgrai-web`).
* **Estado Post Re-Test (26/11/2026 14:53):** 🟢 **SUBSANADO Y CERTIFICADO.**
* **Archivos Afectados:** `src/modules/eventos-atp/evento-prevencion.schema.ts`, `src/lib/db/migrations/046_eventos_prevencion_permiso_leer_y_borrado_logico.ts`, `scripts/seed-eventos-prevencion.ts`, `docs/api/eventos-atp.md`, `src/modules/eventos-atp/__tests__/evento-prevencion.test.ts`, `src/app/api/eventos-atp/prevencion/__tests__/route.test.ts`.
* **Solución Implementada:** Se actualizó `EstadoEventoPrevencionSchema` a `["PLANIFICADA", "EN_EJECUCION", "COMPLETADA", "CANCELADA"]`, se agregó normalización SQL `UPDATE evento_prevencion SET estado = 'EN_EJECUCION' WHERE estado = 'EN_CURSO'` en la migración `046_`, y se actualizaron seed, documentación y pruebas.
* **Verificación en Vivo:** `GET /api/eventos-atp/prevencion?estado=EN_EJECUCION` devolvió HTTP `200 OK` con `PREV-2026-9001` (`estado: "EN_EJECUCION"`), y `GET /openapi.json` expone exactamente `["PLANIFICADA","EN_EJECUCION","COMPLETADA","CANCELADA"]`.

---

### `BUG-H76-API-03`: Rama desincronizada respecto a `origin/develop`, conflictos de fusión activos y desalineación con el orquestador unificado de seeds y `evento_atp_id`
* **Severidad:** Alta (Integración CI/CD y Consistencia de Dominio ICS).
* **Estado Post Re-Test (26/11/2026 14:53):** 🟢 **SUBSANADO Y CERTIFICADO.**
* **Archivos Afectados:** `package.json`, `docs/api/eventos-atp.md`, `src/modules/seguridad/permisos.constants.ts`, `src/lib/db/types.ts`, `scripts/seed/index.ts`, `scripts/seed-eventos-prevencion.ts`.
* **Solución Implementada:** Se integró `develop` resolviendo los 3 conflictos de contenido, se preservó `evento_atp_id: string | null` en `EventoPrevencionTable`, se retiró la migración duplicada `035_`, se integró el módulo `eventos-prevencion` en `scripts/seed/index.ts` y se corrigió la selección de usuario creador en `scripts/seed-eventos-prevencion.ts` filtrando por `r.codigo IN ('ENCARGADO', 'ADMIN')`.
* **Verificación:** `git merge-tree --write-tree origin/develop HEAD` finalizó con 0 conflictos, `npx tsc --noEmit` arrojó 0 errores y `npm run seed -- --only=eventos-prevencion` ejecutó satisfactoriamente.

---

### `BUG-H76-API-04`: Mensaje HTTP `403 Forbidden` incorrecto al omitir `mensajeError` en RBAC y rechazo HTTP `400` ante parámetros de filtro vacíos (`?delegacionId=&estado=`)
* **Severidad:** Media (Seguridad RBAC / Integración Frontend).
* **Estado Post Re-Test (26/11/2026 14:53):** 🟢 **SUBSANADO Y CERTIFICADO.**
* **Archivo Afectado:** `src/app/api/eventos-atp/prevencion/route.ts` (líneas 34–45).
* **Solución Implementada:** Se pasó `"Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'."` como tercer argumento de `validarAccesoRoles` y se omitieron parámetros con `value.trim() === ""` al construir `queryParams`.
* **Verificación en Vivo:** `callcenter@valdivia.cl` y `pedro.patrulla@valdivia.cl` reciben HTTP `403` con el mensaje contextual exacto, y `GET /api/eventos-atp/prevencion?delegacionId=&estado=&busqueda=` responde HTTP `200 OK` con los 6 eventos activos.

---

### `BUG-H76-API-05`: Ordenamiento SQL no determinista, contrato OpenAPI sin estructura GeoJSON para `ubicacionGeoJson` y ausencia de pruebas unitarias de repositorio y migración `046_`
* **Severidad:** Media (Consistencia de Paginación / Contrato OpenAPI / Cobertura de Pruebas).
* **Estado Post Re-Test (26/11/2026 14:53):** 🟢 **SUBSANADO Y CERTIFICADO.**
* **Archivos Afectados:** `src/modules/eventos-atp/evento-prevencion.repository.ts`, `src/modules/eventos-atp/evento-prevencion.schema.ts`, `src/modules/eventos-atp/evento-prevencion.service.ts`, `src/modules/eventos-atp/__tests__/evento-prevencion.repository.test.ts`, `src/lib/db/migrations/__tests__/046_eventos_prevencion_permiso_leer_y_borrado_logico.test.ts`.
* **Solución Implementada:** Se añadió `.orderBy("ep.id", "desc")` en eventos y priorización de misiones activas (`CASE WHEN m.estado IN ('EN_CURSO', 'DESPACHADA') THEN 0 ELSE 1 END`, `m.creado_en DESC`, `m.id DESC`); se creó `GeoJsonPointSchema` y el normalizador `toGeoJsonPoint`; y se incorporaron las suites unitarias dedicadas de repositorio y migración `046_`.
* **Verificación:** `GET /openapi.json` expone `ubicacionGeoJson` tipado como objeto GeoJSON Point con `required: ["type", "coordinates"]` e incluido en `required` de ambos esquemas; las 5 suites del módulo/OpenAPI aprobaron 37/37 pruebas.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H76-API-01` | Error HTTP 500 (SQL 42601) al solicitar una página fuera de rango (page > totalPages) cuando existen registros (total > 0) | Defecto / Paginación & SQL | Integración E2E / Repositorio | Crítica | Al menos 1 evento preventivo activo en PostgreSQL (6 registros sembrados) y token JWT válido de Encargado | `GET /api/eventos-atp/prevencion?page=99&limit=20` y `?page=4&limit=2` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `data: []` y `meta: { total: 6, page: 99, limit: 20, totalPages: 1, hasNext: false, hasPrev: true }` | HTTP 200 OK en ambos casos (`data: []`, `meta` coherente) y test unitario de repositorio verificado sin cláusula `IN ()` | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `BUG-H76-API-02` | Rechazo HTTP 400 al filtrar por estado=EN_EJECUCION exigido por CA-2 debido a uso de EN_CURSO en EstadoEventoPrevencionSchema | Defecto / Contrato & CA-2 | Integración E2E / Esquema Zod | Alta | Usuario `encargado@valdivia.cl` autenticado y especificación CA-2 exigiendo `PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA` | `GET /api/eventos-atp/prevencion?estado=EN_EJECUCION` y `?estado=EN_CURSO` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK aceptando `EN_EJECUCION` (y rechazando `EN_CURSO` con HTTP 400) alineado con CA-2, OpenAPI y migración `046_` | HTTP 200 OK para `estado=EN_EJECUCION` retornando `PREV-2026-9001`, HTTP 400 para `EN_CURSO` y enum OpenAPI alineado | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `BUG-H76-API-03` | Desincronización de 86 commits con origin/develop, 3 conflictos de merge activos, omisión de evento_atp_id y rol erróneo en seed | Defecto / Git, Esquema & Seed | Integración / CI-CD | Alta | Rama `feature/H76-listar-eventos-prevencion` sincronizada con `develop` y ejecución de `npm run seed -- --only=eventos-prevencion` | `git merge-tree --write-tree origin/develop HEAD`, `npx tsc --noEmit`, `npm run seed -- --only=eventos-prevencion` | 0 conflictos de fusión, `evento_atp_id` presente en `types.ts`, seed unificado en `scripts/seed/index.ts` con filtro de rol Encargado/Admin y `tsc` limpio | `git merge-tree` sin conflictos, `tsc --noEmit` con 0 errores, `evento_atp_id` preservado y orquestador de seed ejecutado correctamente | APROBADO | 25/11/2026 17:21 | 26/11/2026 14:52 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `BUG-H76-API-04` | Mensaje HTTP 403 engañoso por omisión de mensajeError en validarAccesoRoles y rechazo HTTP 400 ante query params vacíos | Defecto / Seguridad & Validación | Integración E2E / Route Handler | Media | Tokens JWT válidos de `callcenter@valdivia.cl`, `pedro.patrulla@valdivia.cl` y `encargado@valdivia.cl` | `GET /api/eventos-atp/prevencion` (Call Center/Patrulla) y `?delegacionId=&estado=&busqueda=` (Encargado) | HTTP 403 citando permiso `prevencion:eventos:leer` y HTTP 200 ignorando parámetros opcionales vacíos | HTTP 403 exacto (`Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'.`) y HTTP 200 retornando 6 registros con query params vacíos | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `BUG-H76-API-05` | Ordenamiento SQL sin desempate ni prioridad de misión activa, ubicacionGeoJson sin tipo en OpenAPI y falta de tests de repositorio y migración 046 | Defecto / Calidad, OpenAPI & Cobertura | Estático / Spec / Unit Test | Media | Revisión de `evento-prevencion.repository.ts`, `GET /openapi.json` y suites de repositorio y migración `046_` | `GET /openapi.json`, `evento-prevencion.repository.test.ts` y `046_eventos_prevencion_permiso_leer_y_borrado_logico.test.ts` | Ordenamiento determinista con `ep.id DESC` y prioridad de misión activa, `ubicacionGeoJson` tipado como GeoJSON Point requerido y tests unitarios aprobados | Ordenamiento determinista verificado, `ubicacionGeoJson` tipado como `Point` requerido en OpenAPI y 4/4 pruebas nuevas de repositorio/migración aprobadas | APROBADO | 25/11/2026 17:23 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `CP-H76-API-01` | Consulta exitosa de listado paginado por rol Encargado con permiso prevencion:eventos:leer bajo estándar H34 (CA-2, CA-5) | Funcional / API REST | Integración E2E | Crítica | Usuario `encargado@valdivia.cl` activo con permiso `prevencion:eventos:leer` y 6 eventos preventivos activos en BD | `GET /api/eventos-atp/prevencion` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `message`, arreglo `data` (código, punto crítico, delegación, estado, cuadrilla/patrulla, fechas) y `meta` H34 (`page=1`, `limit=20`) | HTTP 200 OK retornando 6 eventos con estructura completa y `meta: { total: 6, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false }` | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-02` | Consulta exitosa de listado paginado por rol Administrador con límite personalizado (limit=1) | Seguridad / RBAC | Integración E2E | Alta | Usuario `admin@valdivia.cl` con rol `ADMIN` y 6 eventos preventivos en PostgreSQL | `GET /api/eventos-atp/prevencion?limit=1` con `Authorization: Bearer <TOKEN_ADM>` | HTTP 200 OK retornando 1 elemento y `meta` con `total: 6`, `totalPages: 6`, `hasNext: true`, `hasPrev: false` | HTTP 200 OK retornando `PREV-2026-9005` y `meta: { total: 6, page: 1, limit: 1, totalPages: 6, hasNext: true, hasPrev: false }` | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-03` | Filtro por delegación municipal (Delegación Costa) y proyección de detalle PostGIS del punto crítico asociado y cuadrilla (CA-2, CA-3, CA-4) | Funcional / Filtros & PostGIS | Integración E2E | Crítica | Evento `PREV-2026-9002` en Delegación Costa (`30000000-0000-4000-8000-000000000003`) vinculado a `PC-NIE-03` y `Cuadrilla Aguas Lluvias Alfa` | `GET /api/eventos-atp/prevencion?delegacionId=30000000-0000-4000-8000-000000000003` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK retornando exclusivamente eventos de Costa con `puntoCritico.ubicacionGeoJson` (`Point` EPSG:4326), `cuadrilla`, `mision` y `recursos` | HTTP 200 OK retornando `PREV-2026-9002`, `puntoCritico` `PC-NIE-03` con `ubicacionGeoJson: {"type":"Point","coordinates":[-73.385,-39.851]}` y `cuadrilla` poblada | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-04` | Filtro por estado operativo para el catálogo canónico de CA-2 (PLANIFICADA, EN_EJECUCION, COMPLETADA, CANCELADA) (CA-2, CA-3) | Funcional / Filtros | Integración E2E | Alta | Eventos sembrados cubriendo `PLANIFICADA` (3), `EN_EJECUCION` (1), `COMPLETADA` (1) y `CANCELADA` (1) | `GET /api/eventos-atp/prevencion?estado=<ESTADO>` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK retornando solo registros del estado solicitado y `meta.total` consistente | HTTP 200 OK para todos los estados CA-2, incluyendo `EN_EJECUCION` retornando `PREV-2026-9001` (`total: 1`) | APROBADO | 25/11/2026 17:23 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `CP-H76-API-05` | Búsqueda textual por código de punto crítico (PC-NIE-03) y combinación simultánea de filtros delegación + estado + búsqueda (CA-3) | Funcional / Buscador | Integración E2E | Alta | Eventos vinculados a puntos críticos y evento en Delegación Sur (`Guacamayo`, `PLANIFICADA`) | `GET /api/eventos-atp/prevencion?busqueda=PC-NIE-03` y `?delegacionId=30000000-0000-4000-8000-000000000002&estado=PLANIFICADA&busqueda=Guacamayo` | HTTP 200 OK retornando únicamente los registros coincidentes con cada criterio combinado | HTTP 200 OK: `PC-NIE-03` retornó `PREV-2026-9002` (`total: 1`); filtro combinado retornó `PREV-2026-9005` (`total: 1`) | APROBADO | 25/11/2026 17:23 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-06` | Sanitización de comodín SQL ILIKE (%) y respuesta limpia de lista vacía ante búsqueda sin coincidencias (CA-3, Estándar H34) | Seguridad / Robustez | Integración E2E | Alta | Token JWT válido de Encargado y eventos activos en BD | `GET /api/eventos-atp/prevencion?busqueda=%25` y `?busqueda=NO_EXISTE_XYZ` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `data: []` y `meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false }` sin exponer todos los registros con `%` | HTTP 200 OK en ambos casos con `data: []`, `meta.total: 0` y `totalPages: 0` | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-07` | Navegación de paginación dentro y fuera de rango (page=1..4 con limit=2) verificando hasNext y hasPrev (CA-5) | Funcional / Paginación H34 | Integración E2E | Alta | 6 eventos preventivos activos en PostgreSQL | `GET /api/eventos-atp/prevencion?page=1&limit=2`, `?page=2&limit=2`, `?page=3&limit=2` y `?page=4&limit=2` | HTTP 200 OK devolviendo 2 registros por página en págs. 1..3, lista vacía en pág. 4 y banderas `hasPrev`/`hasNext` coherentes | HTTP 200 OK en todas las páginas incluyendo `page=4&limit=2` (`data: []`, `total: 6`, `totalPages: 3`, `hasNext: false`, `hasPrev: true`) | APROBADO | 25/11/2026 17:23 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `CP-H76-API-08` | Rechazo con HTTP 401 Unauthorized ante petición sin cabecera Authorization y ante token Bearer inválido | Seguridad / Auth | Integración E2E | Crítica | Servidor `sgrai-api` activo en puerto 3001 | `GET /api/eventos-atp/prevencion` sin cabecera y con `Authorization: Bearer token.invalido.xyz` | HTTP 401 Unauthorized rechazando el acceso anónimo o con firma inválida | HTTP 401 Unauthorized en ambos casos (`Se requiere cabecera de autenticación...` y `Token de sesión inválido o expirado.`) | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-09` | Bloqueo de acceso RBAC (HTTP 403 Forbidden) para usuarios sin permiso prevencion:eventos:leer (Call Center y Patrulla Verificadora) | Seguridad / RBAC | Integración E2E | Crítica | Usuarios `callcenter@valdivia.cl` (`CALL_CENTER`) y `pedro.patrulla@valdivia.cl` (`PATRULLA_VERIFICADORA`) sin permiso `prevencion:eventos:leer` | `GET /api/eventos-atp/prevencion` con `Authorization: Bearer <TOKEN_CC>` y `<TOKEN_PAT>` | HTTP 403 Forbidden citando explícitamente el permiso `'prevencion:eventos:leer'` | HTTP 403 Forbidden en ambos perfiles con mensaje `Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'.` | APROBADO | 25/11/2026 17:23 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `CP-H76-API-10` | Rechazo con HTTP 400 Bad Request ante parámetros de consulta inválidos (UUID malformado, estado inexistente, page=0, limit=101) | Validación / Zod | Integración E2E | Media | Token JWT válido de Encargado | `GET /api/eventos-atp/prevencion?delegacionId=no-uuid&estado=INVALIDO` y `?page=0&limit=101` | HTTP 400 Bad Request con arreglo `errors` detallando cada campo inválido | HTTP 400 Bad Request retornando arreglo `errors` con los campos `delegacionId`, `estado`, `page` y `limit` | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-11` | Soporte a eventos preventivos desplegados con coordenadas libres sin punto crítico catalogado ni incidente previo (Regla de Dominio ICS) | Funcional / Dominio ICS | Integración E2E | Alta | Evento `PREV-2026-9005` (`punto_critico_id = NULL`, sector Guacamayo) en PostgreSQL | `GET /api/eventos-atp/prevencion?busqueda=Guacamayo` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `puntoCritico: null`, `ubicacionGeoJson` propio del evento y `patrulla` asignada sin error de JOIN | HTTP 200 OK retornando `PREV-2026-9005` con `puntoCritico: null`, `ubicacionGeoJson: {"type":"Point","coordinates":[-73.2295,-39.864]}` y `patrulla` poblada | APROBADO | 25/11/2026 17:23 | 26/11/2026 14:53 | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-12` | Ejecución de migración 046_eventos_prevencion_permiso_leer_y_borrado_logico.ts, normalización EN_EJECUCION y test unitario up/down | Esquema / DB | Migración & Unit Test | Alta | Instancia PostgreSQL 16 + PostGIS en contenedor `grupo1_postgres` | `npm run db:migrate` y `npx vitest run src/lib/db/migrations/__tests__/046_...test.ts` | Columnas de borrado lógico, índices, normalización `EN_EJECUCION`, permiso `prevencion:eventos:leer` asignado y suite `up`/`down` aprobada | Migración `046_` aplicada en PostgreSQL, `PREV-2026-9001` en `EN_EJECUCION`, 3 roles asignados y 2/2 tests de migración aprobados | APROBADO | 25/11/2026 17:21 | 26/11/2026 14:52 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `CP-H76-API-13` | Ejecución de suites automatizadas Vitest (módulo Eventos Prevención, repositorio, migración 046, OpenAPI y global), ESLint y TypeScript | Automatización QA | Unit / Estático | Alta | Entorno Node.js con dependencias instaladas en rama `feature/H76-listar-eventos-prevencion` | `npx vitest run ...`, `npm test`, `npm run lint` y `npx tsc --noEmit` | 100% de pruebas unitarias aprobadas, 0 errores ESLint y 0 errores TypeScript | 37/37 tests H76/OpenAPI aprobados, 1021/1021 tests globales (96 archivos) aprobados, `npm run lint` con 0 errores y `tsc --noEmit` con 0 errores | APROBADO | 25/11/2026 17:19 | 26/11/2026 14:52 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |
| `CP-H76-API-14` | Registro del endpoint GET /api/eventos-atp/prevencion en OpenAPI 3.0 (/openapi.json) y documentación técnica en docs/api/eventos-atp.md | Contrato & Docs | API / Spec | Media | Servidor local activo sirviendo `/openapi.json` e inspección de `docs/api/eventos-atp.md` | `curl -s http://localhost:3001/openapi.json` y revisión de `docs/api/eventos-atp.md` sección 13 | Ruta registrada bajo tag `Eventos ATP`, `BearerAuth`, enum `EN_EJECUCION`, `ubicacionGeoJson` GeoJSON Point requerido y documentación sincronizada | `/openapi.json` (v0.12.0) expone enum CA-2 y `GeoJsonPointSchema` en `required`, y `docs/api/eventos-atp.md` §13 sincronizado sin conflictos | APROBADO | 25/11/2026 17:22 | 26/11/2026 14:53 | fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05 |

---

### 3.1. Bloque TSV para Exportación Tabular

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H76-API-01	Error HTTP 500 (SQL 42601) al solicitar una página fuera de rango (page > totalPages) cuando existen registros (total > 0)	Defecto / Paginación & SQL	Integración E2E / Repositorio	Crítica	Al menos 1 evento preventivo activo en PostgreSQL (6 registros sembrados) y token JWT válido de Encargado	GET /api/eventos-atp/prevencion?page=99&limit=20 y ?page=4&limit=2 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con data: [] y meta: { total: 6, page: 99, limit: 20, totalPages: 1, hasNext: false, hasPrev: true }	HTTP 200 OK en ambos casos (data: [], meta coherente) y test unitario de repositorio verificado sin cláusula IN ()	APROBADO	25/11/2026 17:22	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
BUG-H76-API-02	Rechazo HTTP 400 al filtrar por estado=EN_EJECUCION exigido por CA-2 debido a uso de EN_CURSO en EstadoEventoPrevencionSchema	Defecto / Contrato & CA-2	Integración E2E / Esquema Zod	Alta	Usuario encargado@valdivia.cl autenticado y especificación CA-2 exigiendo PLANIFICADA, EN_EJECUCION, COMPLETADA, CANCELADA	GET /api/eventos-atp/prevencion?estado=EN_EJECUCION y ?estado=EN_CURSO con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK aceptando EN_EJECUCION (y rechazando EN_CURSO con HTTP 400) alineado con CA-2, OpenAPI y migración 046_	HTTP 200 OK para estado=EN_EJECUCION retornando PREV-2026-9001, HTTP 400 para EN_CURSO y enum OpenAPI alineado	APROBADO	25/11/2026 17:22	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
BUG-H76-API-03	Desincronización de 86 commits con origin/develop, 3 conflictos de merge activos, omisión de evento_atp_id y rol erróneo en seed	Defecto / Git, Esquema & Seed	Integración / CI-CD	Alta	Rama feature/H76-listar-eventos-prevencion sincronizada con develop y ejecución de npm run seed -- --only=eventos-prevencion	git merge-tree --write-tree origin/develop HEAD, npx tsc --noEmit, npm run seed -- --only=eventos-prevencion	0 conflictos de fusión, evento_atp_id presente en types.ts, seed unificado en scripts/seed/index.ts con filtro de rol Encargado/Admin y tsc limpio	git merge-tree sin conflictos, tsc --noEmit con 0 errores, evento_atp_id preservado y orquestador de seed ejecutado correctamente	APROBADO	25/11/2026 17:21	26/11/2026 14:52	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
BUG-H76-API-04	Mensaje HTTP 403 engañoso por omisión de mensajeError en validarAccesoRoles y rechazo HTTP 400 ante query params vacíos	Defecto / Seguridad & Validación	Integración E2E / Route Handler	Media	Tokens JWT válidos de callcenter@valdivia.cl, pedro.patrulla@valdivia.cl y encargado@valdivia.cl	GET /api/eventos-atp/prevencion (Call Center/Patrulla) y ?delegacionId=&estado=&busqueda= (Encargado)	HTTP 403 citando permiso prevencion:eventos:leer y HTTP 200 ignorando parámetros opcionales vacíos	HTTP 403 exacto (Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'.) y HTTP 200 retornando 6 registros con query params vacíos	APROBADO	25/11/2026 17:22	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
BUG-H76-API-05	Ordenamiento SQL sin desempate ni prioridad de misión activa, ubicacionGeoJson sin tipo en OpenAPI y falta de tests de repositorio y migración 046	Defecto / Calidad, OpenAPI & Cobertura	Estático / Spec / Unit Test	Media	Revisión de evento-prevencion.repository.ts, GET /openapi.json y suites de repositorio y migración 046_	GET /openapi.json, evento-prevencion.repository.test.ts y 046_eventos_prevencion_permiso_leer_y_borrado_logico.test.ts	Ordenamiento determinista con ep.id DESC y prioridad de misión activa, ubicacionGeoJson tipado como GeoJSON Point requerido y tests unitarios aprobados	Ordenamiento determinista verificado, ubicacionGeoJson tipado como Point requerido en OpenAPI y 4/4 pruebas nuevas de repositorio/migración aprobadas	APROBADO	25/11/2026 17:23	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
CP-H76-API-01	Consulta exitosa de listado paginado por rol Encargado con permiso prevencion:eventos:leer bajo estándar H34 (CA-2, CA-5)	Funcional / API REST	Integración E2E	Crítica	Usuario encargado@valdivia.cl activo con permiso prevencion:eventos:leer y 6 eventos preventivos activos en BD	GET /api/eventos-atp/prevencion con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con message, arreglo data (código, punto crítico, delegación, estado, cuadrilla/patrulla, fechas) y meta H34 (page=1, limit=20)	HTTP 200 OK retornando 6 eventos con estructura completa y meta: { total: 6, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false }	APROBADO	25/11/2026 17:22	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-02	Consulta exitosa de listado paginado por rol Administrador con límite personalizado (limit=1)	Seguridad / RBAC	Integración E2E	Alta	Usuario admin@valdivia.cl con rol ADMIN y 6 eventos preventivos en PostgreSQL	GET /api/eventos-atp/prevencion?limit=1 con Authorization: Bearer <TOKEN_ADM>	HTTP 200 OK retornando 1 elemento y meta con total: 6, totalPages: 6, hasNext: true, hasPrev: false	HTTP 200 OK retornando PREV-2026-9005 y meta: { total: 6, page: 1, limit: 1, totalPages: 6, hasNext: true, hasPrev: false }	APROBADO	25/11/2026 17:22	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-03	Filtro por delegación municipal (Delegación Costa) y proyección de detalle PostGIS del punto crítico asociado y cuadrilla (CA-2, CA-3, CA-4)	Funcional / Filtros & PostGIS	Integración E2E	Crítica	Evento PREV-2026-9002 en Delegación Costa (30000000-0000-4000-8000-000000000003) vinculado a PC-NIE-03 y Cuadrilla Aguas Lluvias Alfa	GET /api/eventos-atp/prevencion?delegacionId=30000000-0000-4000-8000-000000000003 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK retornando exclusivamente eventos de Costa con puntoCritico.ubicacionGeoJson (Point EPSG:4326), cuadrilla, mision y recursos	HTTP 200 OK retornando PREV-2026-9002, puntoCritico PC-NIE-03 con ubicacionGeoJson Point [-73.385,-39.851] y cuadrilla poblada	APROBADO	25/11/2026 17:22	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-04	Filtro por estado operativo para el catálogo canónico de CA-2 (PLANIFICADA, EN_EJECUCION, COMPLETADA, CANCELADA) (CA-2, CA-3)	Funcional / Filtros	Integración E2E	Alta	Eventos sembrados cubriendo PLANIFICADA (3), EN_EJECUCION (1), COMPLETADA (1) y CANCELADA (1)	GET /api/eventos-atp/prevencion?estado=<ESTADO> con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK retornando solo registros del estado solicitado y meta.total consistente	HTTP 200 OK para todos los estados CA-2, incluyendo EN_EJECUCION retornando PREV-2026-9001 (total: 1)	APROBADO	25/11/2026 17:23	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
CP-H76-API-05	Búsqueda textual por código de punto crítico (PC-NIE-03) y combinación simultánea de filtros delegación + estado + búsqueda (CA-3)	Funcional / Buscador	Integración E2E	Alta	Eventos vinculados a puntos críticos y evento en Delegación Sur (Guacamayo, PLANIFICADA)	GET /api/eventos-atp/prevencion?busqueda=PC-NIE-03 y ?delegacionId=30000000-0000-4000-8000-000000000002&estado=PLANIFICADA&busqueda=Guacamayo	HTTP 200 OK retornando únicamente los registros coincidentes con cada criterio combinado	HTTP 200 OK: PC-NIE-03 retornó PREV-2026-9002 (total: 1); filtro combinado retornó PREV-2026-9005 (total: 1)	APROBADO	25/11/2026 17:23	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-06	Sanitización de comodín SQL ILIKE (%) y respuesta limpia de lista vacía ante búsqueda sin coincidencias (CA-3, Estándar H34)	Seguridad / Robustez	Integración E2E	Alta	Token JWT válido de Encargado y eventos activos en BD	GET /api/eventos-atp/prevencion?busqueda=%25 y ?busqueda=NO_EXISTE_XYZ con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con data: [] y meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } sin exponer todos los registros con %	HTTP 200 OK en ambos casos con data: [], meta.total: 0 y totalPages: 0	APROBADO	25/11/2026 17:22	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-07	Navegación de paginación dentro y fuera de rango (page=1..4 con limit=2) verificando hasNext y hasPrev (CA-5)	Funcional / Paginación H34	Integración E2E	Alta	6 eventos preventivos activos en PostgreSQL	GET /api/eventos-atp/prevencion?page=1&limit=2, ?page=2&limit=2, ?page=3&limit=2 y ?page=4&limit=2	HTTP 200 OK devolviendo 2 registros por página en págs. 1..3, lista vacía en pág. 4 y banderas hasPrev/hasNext coherentes	HTTP 200 OK en todas las páginas incluyendo page=4&limit=2 (data: [], total: 6, totalPages: 3, hasNext: false, hasPrev: true)	APROBADO	25/11/2026 17:23	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
CP-H76-API-08	Rechazo con HTTP 401 Unauthorized ante petición sin cabecera Authorization y ante token Bearer inválido	Seguridad / Auth	Integración E2E	Crítica	Servidor sgrai-api activo en puerto 3001	GET /api/eventos-atp/prevencion sin cabecera y con Authorization: Bearer token.invalido.xyz	HTTP 401 Unauthorized rechazando el acceso anónimo o con firma inválida	HTTP 401 Unauthorized en ambos casos (Se requiere cabecera de autenticación... y Token de sesión inválido o expirado.)	APROBADO	25/11/2026 17:22	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-09	Bloqueo de acceso RBAC (HTTP 403 Forbidden) para usuarios sin permiso prevencion:eventos:leer (Call Center y Patrulla Verificadora)	Seguridad / RBAC	Integración E2E	Crítica	Usuarios callcenter@valdivia.cl (CALL_CENTER) y pedro.patrulla@valdivia.cl (PATRULLA_VERIFICADORA) sin permiso prevencion:eventos:leer	GET /api/eventos-atp/prevencion con Authorization: Bearer <TOKEN_CC> y <TOKEN_PAT>	HTTP 403 Forbidden citando explícitamente el permiso 'prevencion:eventos:leer'	HTTP 403 Forbidden en ambos perfiles con mensaje Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'.	APROBADO	25/11/2026 17:23	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
CP-H76-API-10	Rechazo con HTTP 400 Bad Request ante parámetros de consulta inválidos (UUID malformado, estado inexistente, page=0, limit=101)	Validación / Zod	Integración E2E	Media	Token JWT válido de Encargado	GET /api/eventos-atp/prevencion?delegacionId=no-uuid&estado=INVALIDO y ?page=0&limit=101	HTTP 400 Bad Request con arreglo errors detallando cada campo inválido	HTTP 400 Bad Request retornando arreglo errors con los campos delegacionId, estado, page y limit	APROBADO	25/11/2026 17:22	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-11	Soporte a eventos preventivos desplegados con coordenadas libres sin punto crítico catalogado ni incidente previo (Regla de Dominio ICS)	Funcional / Dominio ICS	Integración E2E	Alta	Evento PREV-2026-9005 (punto_critico_id = NULL, sector Guacamayo) en PostgreSQL	GET /api/eventos-atp/prevencion?busqueda=Guacamayo con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con puntoCritico: null, ubicacionGeoJson propio del evento y patrulla asignada sin error de JOIN	HTTP 200 OK retornando PREV-2026-9005 con puntoCritico: null, ubicacionGeoJson Point [-73.2295,-39.864] y patrulla poblada	APROBADO	25/11/2026 17:23	26/11/2026 14:53	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-12	Ejecución de migración 046_eventos_prevencion_permiso_leer_y_borrado_logico.ts, normalización EN_EJECUCION y test unitario up/down	Esquema / DB	Migración & Unit Test	Alta	Instancia PostgreSQL 16 + PostGIS en contenedor grupo1_postgres	npm run db:migrate y npx vitest run src/lib/db/migrations/__tests__/046_...test.ts	Columnas de borrado lógico, índices, normalización EN_EJECUCION, permiso prevencion:eventos:leer asignado y suite up/down aprobada	Migración 046_ aplicada en PostgreSQL, PREV-2026-9001 en EN_EJECUCION, 3 roles asignados y 2/2 tests de migración aprobados	APROBADO	25/11/2026 17:21	26/11/2026 14:52	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
CP-H76-API-13	Ejecución de suites automatizadas Vitest (módulo Eventos Prevención, repositorio, migración 046, OpenAPI y global), ESLint y TypeScript	Automatización QA	Unit / Estático	Alta	Entorno Node.js con dependencias instaladas en rama feature/H76-listar-eventos-prevencion	npx vitest run ..., npm test, npm run lint y npx tsc --noEmit	100% de pruebas unitarias aprobadas, 0 errores ESLint y 0 errores TypeScript	37/37 tests H76/OpenAPI aprobados, 1021/1021 tests globales (96 archivos) aprobados, npm run lint con 0 errores y tsc --noEmit con 0 errores	APROBADO	25/11/2026 17:19	26/11/2026 14:52	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
CP-H76-API-14	Registro del endpoint GET /api/eventos-atp/prevencion en OpenAPI 3.0 (/openapi.json) y documentación técnica en docs/api/eventos-atp.md	Contrato & Docs	API / Spec	Media	Servidor local activo sirviendo /openapi.json e inspección de docs/api/eventos-atp.md	curl -s http://localhost:3001/openapi.json y revisión de docs/api/eventos-atp.md sección 13	Ruta registrada bajo tag Eventos ATP, BearerAuth, enum EN_EJECUCION, ubicacionGeoJson GeoJSON Point requerido y documentación sincronizada	/openapi.json (v0.12.0) expone enum CA-2 y GeoJsonPointSchema en required, y docs/api/eventos-atp.md §13 sincronizado sin conflictos	APROBADO	25/11/2026 17:22	26/11/2026 14:53	fix(eventos-atp): resolver merge con develop y defectos QA BUG-H76-API-01 a BUG-H76-API-05
````

---

## 4. Guía Detallada de Ejecución y Replicabilidad Paso a Paso (Ciclo Re-Test)

### 4.1. Pruebas Automatizadas con Vitest, ESLint y TypeScript

#### Comando — Suite del Módulo Eventos de Prevención, Repositorio, Migración 046 y OpenAPI:
```bash
npx vitest run \
  src/app/api/eventos-atp/prevencion/__tests__/route.test.ts \
  src/modules/eventos-atp/__tests__/evento-prevencion.test.ts \
  src/modules/eventos-atp/__tests__/evento-prevencion.repository.test.ts \
  src/lib/db/migrations/__tests__/046_eventos_prevencion_permiso_leer_y_borrado_logico.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida Obtenida:**
```text
 ✓ src/lib/db/migrations/__tests__/046_eventos_prevencion_permiso_leer_y_borrado_logico.test.ts (2 tests) 22ms
 ✓ src/modules/eventos-atp/__tests__/evento-prevencion.repository.test.ts (2 tests) 92ms
 ✓ src/modules/eventos-atp/__tests__/evento-prevencion.test.ts (18 tests) 174ms
 ✓ src/app/api/eventos-atp/prevencion/__tests__/route.test.ts (14 tests) 85ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 455ms

 Test Files  5 passed (5)
      Tests  37 passed (37)
   Start at  14:51:39
   Duration  4.59s
```

#### Comando — Suite Completa del Repositorio, ESLint y TypeScript:
```bash
npm test && npm run lint && npx tsc --noEmit
```

**Salida Obtenida:**
```text
 Test Files  96 passed (96)
      Tests  1021 passed (1021)
   Start at  14:52:26
   Duration  6.93s

npm notice run api@0.12.0 lint
npm notice run eslint
(Exit code 0 — 0 errores, 0 warnings)

npm notice run api@0.12.0 npx
npm notice run 'tsc' --noEmit
(Exit code 0 — 0 errores)
```

---

### 4.2. Verificación de Fusión Limpia, Migración `046_` y Orquestador Unificado de Seeds (`BUG-H76-API-03`)

```bash
git merge-tree --write-tree origin/develop HEAD
npm run db:migrate && npm run seed -- --only=eventos-prevencion
```

**Salida Obtenida:**
```text
f50edcb8fe43f0237c4970525de34f3e0d4ef192

Ejecutando migraciones Kysely de base de datos...
[OK] Migración Kysely ejecutada con éxito: "046_eventos_prevencion_permiso_leer_y_borrado_logico"
Todas las migraciones se completaron correctamente.

════════════════════════════════════════════════════════════
 SGRAI — Orquestador de seeds
════════════════════════════════════════════════════════════
 Módulos: eventos-prevencion
════════════════════════════════════════════════════════════
[1/1] EVENTOS-PREVENCION — Eventos de prevención en puntos críticos y misiones preventivas (H76)
────────────────────────────────────────────────────────────
Iniciando inserción de eventos de prevención de prueba (H76)...
✅ 5 eventos de prevención de prueba sembrados correctamente.
```

---

### 4.3. Pruebas de Integración en Vivo vía `curl` (Verificación de Fixes)

#### Obtención de Tokens JWT de Sesión:
```bash
BASE="http://localhost:3001"

TOKEN_ENC=$(curl -s -X POST "$BASE/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data?.token || "")')

TOKEN_CC=$(curl -s -X POST "$BASE/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data?.token || "")')

TOKEN_PAT=$(curl -s -X POST "$BASE/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data?.token || "")')
```

---

#### Re-Test de `BUG-H76-API-01`: Paginación fuera de rango (`page=99&limit=20` y `page=4&limit=2`)
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?page=99&limit=20"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?page=4&limit=2"
```

**Respuestas Obtenidas:**
```json
{"message":"Eventos de prevención obtenidos exitosamente.","data":[],"meta":{"total":6,"page":99,"limit":20,"totalPages":1,"hasNext":false,"hasPrev":true}}
```
`HTTP_STATUS:200`

```json
{"message":"Eventos de prevención obtenidos exitosamente.","data":[],"meta":{"total":6,"page":4,"limit":2,"totalPages":3,"hasNext":false,"hasPrev":true}}
```
`HTTP_STATUS:200`

---

#### Re-Test de `BUG-H76-API-02`: Filtro por estado canónico `EN_EJECUCION` (CA-2) y rechazo de `EN_CURSO`
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?estado=EN_EJECUCION"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?estado=EN_CURSO"
```

**Respuestas Obtenidas:**
```json
{
  "message": "Eventos de prevención obtenidos exitosamente.",
  "data": [
    {
      "id": "81000000-0000-4000-8000-000000000001",
      "codigo": "PREV-2026-9001",
      "nombre": "Limpieza preventiva de sumideros en Angachilla",
      "estado": "EN_EJECUCION",
      "ubicacionGeoJson": { "type": "Point", "coordinates": [-73.2389, -39.8456] },
      "puntoCritico": {
        "id": "40000000-0000-4000-8000-000000000001",
        "codigo": "PC-ANG-01",
        "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
        "ubicacionGeoJson": { "type": "Point", "coordinates": [-73.2389, -39.8456] }
      },
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000002",
        "codigo": "DEL_SUR",
        "nombre": "Delegación Municipal Sur"
      }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```
`HTTP_STATUS:200`

```json
{
  "message": "Parámetros de consulta inválidos para listar eventos de prevención.",
  "errors": [
    {
      "campo": "estado",
      "mensaje": "Invalid option: expected one of \"PLANIFICADA\"|\"EN_EJECUCION\"|\"COMPLETADA\"|\"CANCELADA\""
    }
  ]
}
```
`HTTP_STATUS:400`

---

#### Re-Test de `BUG-H76-API-04`: Mensaje HTTP `403` contextual y query params vacíos
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_CC" \
  "http://localhost:3001/api/eventos-atp/prevencion"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_PAT" \
  "http://localhost:3001/api/eventos-atp/prevencion"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?delegacionId=&estado=&busqueda="
```

**Respuestas Obtenidas:**
```json
{"message":"Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer'."}
```
`HTTP_STATUS:403` (tanto para `CALL_CENTER` como para `PATRULLA_VERIFICADORA`)

```json
{"count":6,"meta":{"total":6,"page":1,"limit":20,"totalPages":1,"hasNext":false,"hasPrev":false}}
```
`HTTP_STATUS:200`

---

#### Re-Test de `BUG-H76-API-05`: Contrato OpenAPI 3.0 en Vivo (`GET /openapi.json`)
```bash
curl -s http://localhost:3001/openapi.json | node -e '
const spec = JSON.parse(require("fs").readFileSync(0,"utf8"));
const getOp = spec.paths["/api/eventos-atp/prevencion"].get;
const estadoParam = getOp.parameters.find(p => p.name === "estado");
const itemSchema = spec.components.schemas.ListarEventosPrevencionResponse.properties.data.items;
console.log("OpenAPI version:", spec.info.version);
console.log("estado param enum:", JSON.stringify(estadoParam.schema.enum));
console.log("item ubicacionGeoJson:", JSON.stringify(itemSchema.properties.ubicacionGeoJson));
console.log("item required includes ubicacionGeoJson:", itemSchema.required.includes("ubicacionGeoJson"));
console.log("pc required includes ubicacionGeoJson:", itemSchema.properties.puntoCritico.required.includes("ubicacionGeoJson"));
'
```

**Salida Obtenida:**
```text
OpenAPI version: 0.12.0
estado param enum: ["PLANIFICADA","EN_EJECUCION","COMPLETADA","CANCELADA"]
item ubicacionGeoJson: {"type":"object","nullable":true,"properties":{"type":{"type":"string","enum":["Point"]},"coordinates":{"type":"array","items":{"type":"number"},"minItems":2,"maxItems":2}},"required":["type","coordinates"],"description":"Geometría PostGIS Point del evento en formato GeoJSON (EPSG:4326)","example":{"type":"Point","coordinates":[-73.2389,-39.8456]}}
item required includes ubicacionGeoJson: true
pc required includes ubicacionGeoJson: true
```

---

## 5. Matriz de Trazabilidad de Criterios de Aceptación (HU-76)

| Criterio de Aceptación (CA) | Capa Responsable | Casos / Defectos Asociados | Cobertura y Estado en `sgrai-api` |
|---|---|---|---|
| **CA-1:** El sistema debe proveer una vista tabular en `/gestion/centro-incidentes` bajo el estándar de contratos H34. | Frontend (`sgrai-web`) | Fuera de alcance `sgrai-api` | Implementado y validado en el cliente web `sgrai-web`. |
| **CA-2:** La tabla debe listar: Código de prevención, Punto crítico asociado, Delegación, Estado (`PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA`), Cuadrilla/Patrulla a cargo y Fechas. | Backend (`sgrai-api`) | `CP-H76-API-01`, `CP-H76-API-03`, `CP-H76-API-04`, `BUG-H76-API-02` | 🟢 **Aprobado**: Proyecta código, punto crítico, delegación, catálogo canónico `PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA`, patrulla/cuadrilla y fechas operativas (`creadoEn`, `mision.fechaInicio`, `mision.fechaCierre`). |
| **CA-3:** Debe permitir filtros por delegación municipal, estado y buscador por punto crítico. | Backend (`sgrai-api`) | `CP-H76-API-03`, `CP-H76-API-04`, `CP-H76-API-05`, `CP-H76-API-06`, `BUG-H76-API-02`, `BUG-H76-API-04` | 🟢 **Aprobado**: Filtros por `delegacionId`, `estado` (incluyendo `EN_EJECUCION`) y `busqueda` (con sanitización `ILIKE`), tolerancia a query params vacíos y combinaciones simultáneas verificadas en vivo. |
| **CA-4:** Drawer lateral desplegable al hacer clic en una fila con información del punto crítico PostGIS. | Backend (`sgrai-api`) + Frontend (`sgrai-web`) | `CP-H76-API-03`, `CP-H76-API-11`, `BUG-H76-API-05` | 🟢 **Aprobado en API**: Proyecta detalle completo del punto crítico y geometría PostGIS `ubicacionGeoJson` (`Point` EPSG:4326) formalmente tipada como esquema estructurado requerido en OpenAPI 3.0, manteniendo soporte para `puntoCritico: null`. |
| **CA-5:** El endpoint `GET /api/eventos-atp/prevencion` debe responder bajo estándar H34. | Backend (`sgrai-api`) | `CP-H76-API-01`, `CP-H76-API-07`, `CP-H76-API-14`, `BUG-H76-API-01`, `BUG-H76-API-03`, `BUG-H76-API-05` | 🟢 **Aprobado**: Respuesta H34 (`message`, `data`, `meta`), paginación segura dentro y fuera de rango (`page > totalPages`), ordenamiento determinista, 0 conflictos frente a `origin/develop` y contrato OpenAPI 3.0 certificado. |
