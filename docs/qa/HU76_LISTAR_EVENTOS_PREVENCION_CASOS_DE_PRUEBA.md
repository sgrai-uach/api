# Informe y Matriz de Casos de Prueba (QA): HU-76 — Listado de Eventos y Misiones de Prevención en Puntos Críticos (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Prevención y Puntos Críticos (`sgrai-api` — `GET /api/eventos-atp/prevencion`).  
> **Historia de Usuario:** HU-76 — *"Como Encargado Quiero consultar un listado de los eventos y misiones preventivas desplegadas en puntos críticos comunales Para supervisar las obras de mitigación activas (limpieza de sumideros, fajas cortafuego) y asegurar la protección anticipada de sectores vulnerables."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H76-listar-eventos-prevencion` (desarrollador asignado: `zetastormy`).  
> **Commits Evaluados en Rama (Conventional Commits):**
> * `feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)`
> * `chore(seed): agregar eventos preventivos de prueba para H76`
> * `fix(seed): omitir filtro activo en consulta de cuadrilla y patrulla`
>
> **Fecha de Auditoría Inicial:** 25/11/2026 17:23.  
> **Fecha de Ciclo Re-Test Final:** (Pendiente).  
> **Estado de Certificación QA:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Abiertos — 1 Crítico, 2 Altos, 2 Medios)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Se realizó la auditoría técnica de código fuente, verificación de esquema relacional y migraciones Kysely en PostgreSQL 16 + PostGIS, revisión de contrato OpenAPI 3.0, análisis de sincronización Git frente a `origin/develop`, ejecución de pruebas automatizadas con Vitest, análisis estático con ESLint y pruebas funcionales de integración en vivo mediante `curl` sobre el endpoint `GET /api/eventos-atp/prevencion`.

Si bien la estructura base del listado paginado bajo estándar H34 (`data`, `meta`, filtros por `delegacionId`, `estado` y `busqueda`, escapado de comodines `ILIKE`, proyección de geometría PostGIS y control de acceso con el permiso `prevencion:eventos:leer`) opera adecuadamente en el flujo nominal, **se detectaron 5 defectos reales que impiden aprobar la integración hacia `develop`**:

1. **Fallo SQL crítico (`HTTP 500`, código PostgreSQL `42601`) en paginación fuera de rango (`BUG-H76-API-01`):** Al consultar una página superior a `totalPages` cuando existen registros en base de datos (`total > 0`, p.ej. `page=4&limit=2` o `page=99&limit=20`), el repositorio ejecuta `.where("m.evento_prevencion_id", "in", [])` sobre un arreglo vacío, generando `syntax error at or near ")"` y una respuesta `500 Internal Server Error`.
2. **Incumplimiento del Criterio de Aceptación CA-2 en el catálogo de estados (`BUG-H76-API-02`):** El CA-2 especifica los estados `PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA` y `CANCELADA` (en concordancia con `EstadoRecuperacionSchema` en el módulo de recuperación), pero `EstadoEventoPrevencionSchema` define `EN_CURSO` y rechaza explícitamente `estado=EN_EJECUCION` con HTTP `400 Bad Request`.
3. **Desincronización grave con `origin/develop`, conflictos de fusión y ruptura del orquestador de seeds (`BUG-H76-API-03`):** La rama se encuentra 86 commits detrás de `origin/develop`, presenta 3 conflictos de fusión activos (`docs/api/eventos-atp.md`, `package.json` y `src/modules/seguridad/permisos.constants.ts`), omite la columna `evento_atp_id` en `EventoPrevencionTable`, conserva el prefijo legado `035_` (renombrado a `051_` en `develop`) y en `scripts/seed-eventos-prevencion.ts` asigna un usuario con rol `PATRULLA_VERIFICADORA` como creador/encargado de eventos preventivos.
4. **Mensaje HTTP `403` inconsistente y rechazo ante query params vacíos (`BUG-H76-API-04`):** El controlador omite el parámetro `mensajeError` en `seguridadService.validarAccesoRoles`, devolviendo un mensaje de error referido a "gestión de roles" en lugar de `prevencion:eventos:leer`; además, parámetros vacíos como `?delegacionId=&estado=` devuelven `400 Bad Request` en lugar de ignorarse como filtros no aplicados.
5. **Ordenamiento no determinista, tipado OpenAPI incompleto de GeoJSON y falta de cobertura unitaria de repositorio y migración (`BUG-H76-API-05`):** La consulta paginada y la selección de misión carecen de desempate determinista y priorización de misiones activas; `ubicacionGeoJson` se expone sin esquema estructural en OpenAPI (`z.unknown().nullable()`); y no existen pruebas unitarias dedicadas para `evento-prevencion.repository.ts` ni para la migración `046_eventos_prevencion_permiso_leer_y_borrado_logico.ts`.

| Métrica de Calidad | Evaluación Inicial (25/11/2026) | Ciclo Re-Test | Estado Actual |
|---|:---:|:---:|:---:|
| **Total Casos Diseñados en Matriz** | 19 Casos (5 Defectos + 14 Funcionales/Técnicos) | (Pendiente) | 19 Casos |
| **Casos Aprobados (Passed)** | 14 | (Pendiente) | 🟡 **14/19 Aprobados (73.68%)** |
| **Casos Fallidos / Defectos Abiertos** | 5 (`BUG-H76-API-01` a `05`) | (Pendiente) | 🔴 **5 Defectos Abiertos** |
| **Defectos Subsanados** | 0/5 | (Pendiente) | 🔴 **0% Subsanados** |
| **Suite Vitest Módulo Prevención y OpenAPI** | 32/32 tests (3 archivos) | (Pendiente) | 🟢 **32/32 Aprobados (1.22s)** |
| **Suite Vitest Global (`npm test`)** | 851/851 tests (72 archivos) | (Pendiente) | 🟢 **851/851 Aprobados (6.35s)** |
| **Análisis Estático ESLint (`npm run lint`)** | 0 errores, 0 warnings | (Pendiente) | 🟢 **Código Limpio** |
| **Chequeo TypeScript (`npx tsc --noEmit`)** | 0 errores en `src/` (7 por caché `.next/types` de `develop`) | (Pendiente) | 🟡 **Requiere resync con `develop`** |
| **Sincronización con `origin/develop`** | 86 commits atrás, 3 conflictos de fusión | (Pendiente) | 🔴 **Bloqueado para Merge** |
| **Migración Kysely `046_` en PostgreSQL** | Ejecutada en BD local sin test unitario `up`/`down` | (Pendiente) | 🟡 **Operativa sin cobertura unitaria** |

---

## 2. Registro Técnico de Defectos (Bugs)

### `BUG-H76-API-01`: Error HTTP `500` (`42601: syntax error at or near ")"`) al consultar una página fuera de rango (`page > totalPages`) cuando `total > 0`
* **Severidad:** Crítica (Disponibilidad del Endpoint / Integridad de Paginación H34).
* **Estado:** 🔴 **ABIERTO** (Pendiente de corrección).
* **Archivo Afectado:** `src/modules/eventos-atp/evento-prevencion.repository.ts` (líneas 305–391).
* **Descripción Técnica:** En `listarEventosPrevencionPaginados`, existe un retorno temprano únicamente cuando `total === 0` (línea 305), pero no se valida si `eventos.length === 0` tras aplicar `.limit(limit).offset(offset)` (líneas 344–346). Cuando existen eventos activos en base de datos (`total = 6`) y el cliente consulta una página fuera de rango (p.ej. `page=4&limit=2` o `page=99&limit=20`), `eventos` resulta vacío (`[]`), `eventoIds` resulta `[]` y la consulta subsecuente `.where("m.evento_prevencion_id", "in", eventoIds)` (línea 370) falla en PostgreSQL con `error: syntax error at or near ")"` (`code: '42601'`). El mismo riesgo se replica en la consulta a `evento_prevencion_recurso` (línea 390).
* **Pasos para Reproducir:**
  1. Garantizar al menos 1 registro activo en `evento_prevencion` (p.ej. tras `npm run seed:eventos-prevencion`, con 6 registros).
  2. Ejecutar `GET /api/eventos-atp/prevencion?page=99&limit=20` (o `page=4&limit=2`) con token JWT válido de `Encargado` o `Administrador`.
* **Comportamiento Actual:** HTTP `500 Internal Server Error` con cuerpo `{"message":"Error interno del servidor al consultar eventos de prevención."}` y excepción PostgreSQL `42601` en `evento-prevencion.repository.ts:350:24`.
* **Comportamiento Esperado:** HTTP `200 OK` bajo estándar H34 retornando `data: []` y `meta: { total: 6, page: 99, limit: 20, totalPages: 1, hasNext: false, hasPrev: true }`.
* **Recomendación de Corrección:** Incorporar guardia temprana inmediatamente después de la consulta paginada:
  ```typescript
  if (eventos.length === 0) {
    return {
      total,
      eventos: [],
      misionesPorEvento: new Map(),
      recursosPorEvento: new Map(),
    };
  }
  ```

---

### `BUG-H76-API-02`: Discrepancia de contrato en enum de estado operativo — el endpoint rechaza `EN_EJECUCION` (HTTP `400`) exigido por CA-2 y emplea `EN_CURSO`
* **Severidad:** Alta (Incumplimiento Directo de Criterio de Aceptación CA-2 / Ruptura de Contrato con `sgrai-web`).
* **Estado:** 🔴 **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-prevencion.schema.ts` (líneas 10–15)
  * `src/modules/eventos-atp/__tests__/evento-prevencion.test.ts` (líneas 412–417)
  * `scripts/seed-eventos-prevencion.ts` (línea 71)
  * `docs/api/eventos-atp.md` (línea 985)
  * `src/lib/openapi/index.ts` (especificación derivada del esquema Zod)
* **Descripción Técnica:** El Criterio de Aceptación CA-2 de HU-76 establece explícitamente el dominio de estados: `PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA` y `CANCELADA`, en consistencia con `EstadoRecuperacionSchema` en `src/modules/eventos-atp/recuperacion.schema.ts`. Sin embargo, `EstadoEventoPrevencionSchema` define `"EN_CURSO"` y rechaza `"EN_EJECUCION"` (incluso validando su rechazo en la prueba unitaria de la línea 412). Al invocar el filtro desde el frontend con `?estado=EN_EJECUCION`, la API devuelve `400 Bad Request`.
* **Pasos para Reproducir:**
  1. Autenticarse como `encargado@valdivia.cl`.
  2. Ejecutar `GET /api/eventos-atp/prevencion?estado=EN_EJECUCION`.
* **Comportamiento Actual:** HTTP `400 Bad Request` con `{"message":"Parámetros de consulta inválidos para listar eventos de prevención.","errors":[{"campo":"estado","mensaje":"Invalid option: expected one of \"PLANIFICADA\"|\"EN_CURSO\"|\"COMPLETADA\"|\"CANCELADA\""}]}`.
* **Comportamiento Esperado:** Aceptar `EN_EJECUCION` como valor canónico del enum `EstadoEventoPrevencionSchema` (`["PLANIFICADA", "EN_EJECUCION", "COMPLETADA", "CANCELADA"]`), actualizar seed, pruebas unitarias, OpenAPI y `docs/api/eventos-atp.md`, y normalizar eventuales registros legados con `EN_CURSO` en la migración `046_` (coordinando con el módulo de edición H77 y `sgrai-web`).

---

### `BUG-H76-API-03`: Rama desincronizada 86 commits respecto a `origin/develop`, 3 conflictos de fusión activos y desalineación con el orquestador unificado de seeds y `evento_atp_id`
* **Severidad:** Alta (Bloqueante de Integración CI/CD y Consistencia de Dominio ICS).
* **Estado:** 🔴 **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:** `package.json`, `docs/api/eventos-atp.md`, `src/modules/seguridad/permisos.constants.ts`, `src/lib/db/types.ts`, `src/lib/db/migrations/035_permiso_misiones_terreno_verificar.ts`, `scripts/seed-eventos-prevencion.ts`.
* **Descripción Técnica:**
  1. La rama `feature/H76-listar-eventos-prevencion` diverge 86 commits por detrás de `origin/develop` (ancestro común del 16/11/2026). La validación `git merge-tree --write-tree origin/develop HEAD` reporta **3 conflictos de contenido activos** en `docs/api/eventos-atp.md`, `package.json` y `src/modules/seguridad/permisos.constants.ts`.
  2. En `origin/develop`, los scripts de semilla fueron unificados en un único orquestador `npm run seed` (`scripts/seed/index.ts`), mientras que esta rama reintroduce la lista antigua de scripts `seed:*` más `seed:eventos-prevencion`.
  3. En `origin/develop`, la migración `072_evento_atp_base.ts` agregó `evento_atp_id` a la tabla `evento_prevencion` (columna ya existente en PostgreSQL), pero `EventoPrevencionTable` en `src/lib/db/types.ts` de esta rama no la declara; asimismo, esta rama mantiene `035_permiso_misiones_terreno_verificar.ts`, que en `origin/develop` fue renombrada a `051_permiso_misiones_terreno_verificar.ts`.
  4. En `scripts/seed-eventos-prevencion.ts` (líneas 26–30), la consulta de usuario creador obtiene el primer usuario activo sin filtrar por rol `ENCARGADO` o `ADMIN`, lo que asignó a un usuario con rol `PATRULLA_VERIFICADORA` (`d1000000-0000-4000-8000-000000000004`, `ignacio.patrulla@valdivia.cl`) como `creado_por_id` y `encargado_id` de todos los eventos y misiones sembradas.
* **Comportamiento Actual:** Fusión bloqueada con 3 conflictos en `origin/develop`, desfase de tipos Kysely respecto al esquema real de BD y datos semilla con autoría incoherente frente al modelo ICS.
* **Comportamiento Esperado:** Rama sincronizada limpiamente con `origin/develop` sin conflictos, `EventoPrevencionTable` incluyendo `evento_atp_id: string | null`, semilla integrada en `scripts/seed/index.ts` seleccionando un usuario con rol `ENCARGADO` o `ADMIN`, y ausencia de migraciones duplicadas.

---

### `BUG-H76-API-04`: Mensaje HTTP `403 Forbidden` incorrecto al omitir `mensajeError` en RBAC y rechazo HTTP `400` ante parámetros de filtro vacíos (`?delegacionId=&estado=`)
* **Severidad:** Media (Seguridad RBAC / Experiencia de Integración Frontend).
* **Estado:** 🔴 **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:** `src/app/api/eventos-atp/prevencion/route.ts` (líneas 34–41), `src/modules/eventos-atp/evento-prevencion.schema.ts` (líneas 187–200).
* **Descripción Técnica:**
  1. En `route.ts` líneas 34–36, `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_LEER_EVENTOS_PREVENCION])` no pasa el tercer argumento `mensajeError`. Por ello, cuando un usuario sin permiso (p.ej. `CALL_CENTER` o `PATRULLA_VERIFICADORA`) consulta el endpoint, la API responde `403 Forbidden` con el mensaje genérico de otro módulo: `"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."`, en lugar de informar que requiere el permiso `'prevencion:eventos:leer'`.
  2. En `route.ts` líneas 38–41, `searchParams.forEach` transfiere cadenas vacías (`""`) al objeto `queryParams`. Cuando un cliente web serializa filtros limpios (`?delegacionId=&estado=`), Zod falla con HTTP `400 Bad Request` en lugar de tratar los parámetros vacíos como no aplicados (`undefined`).
* **Comportamiento Actual:** HTTP `403` con referencia errónea a "gestión de roles" y HTTP `400` ante `?delegacionId=&estado=`.
* **Comportamiento Esperado:** HTTP `403` con mensaje contextual `"Acceso denegado. Se requiere el permiso 'prevencion:eventos:leer' para consultar eventos de prevención."` y HTTP `200 OK` ignorando parámetros de filtro opcionales con cadena vacía.

---

### `BUG-H76-API-05`: Ordenamiento SQL no determinista, contrato OpenAPI sin estructura GeoJSON para `ubicacionGeoJson` y ausencia de pruebas unitarias de repositorio y migración `046_`
* **Severidad:** Media (Consistencia de Paginación / Contrato OpenAPI / Cobertura de Pruebas).
* **Estado:** 🔴 **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:** `src/modules/eventos-atp/evento-prevencion.repository.ts` (líneas 343 y 371), `src/modules/eventos-atp/evento-prevencion.schema.ts` (líneas 216–219 y 253–255), `src/lib/db/migrations/046_eventos_prevencion_permiso_leer_y_borrado_logico.ts`.
* **Descripción Técnica:**
  1. En `evento-prevencion.repository.ts` línea 343, el listado ordena únicamente por `.orderBy("ep.creado_en", "desc")` sin criterio de desempate (`ep.id DESC`), arriesgando duplicación u omisión de filas entre páginas con timestamps iguales. Además, en línea 371, la selección de misión por evento solo ordena por `m.creado_en DESC` sin priorizar misiones operativas activas (`EN_CURSO` / `DESPACHADA`) frente a misiones `CANCELADA` o `RECHAZADA` ni desempatar por `m.id DESC`.
  2. En `evento-prevencion.schema.ts`, `ubicacionGeoJson` se declara con `z.unknown().nullable()`, lo que en `GET /openapi.json` produce `{ "nullable": true }` sin `type: "object"` ni propiedades `type: "Point"` y `coordinates: [number, number]`, y además excluye el campo del arreglo `required`, debilitando la generación automática de tipos en `sgrai-web` para el drawer PostGIS (CA-4).
  3. No existe archivo de pruebas unitarias para `evento-prevencion.repository.ts` (motivo por el cual `BUG-H76-API-01` no fue detectado en CI) ni prueba unitaria `up`/`down` para la migración `046_eventos_prevencion_permiso_leer_y_borrado_logico.ts` (convención vigente en `src/lib/db/migrations/__tests__/`).
* **Comportamiento Actual:** Ordenamiento sin tie-breaker ni prioridad de misión activa, `ubicacionGeoJson` sin tipo estructurado en OpenAPI y 0% de pruebas unitarias directas sobre el repositorio y la migración `046_`.
* **Comportamiento Esperado:** Orden determinista con `ep.id DESC` y priorización de misión activa, esquema Zod estructurado `GeoJsonPointSchema.nullable()` reflejado en OpenAPI, y suites unitarias completas para repositorio y migración `046_`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H76-API-01` | Error HTTP 500 (SQL 42601) al solicitar una página fuera de rango (page > totalPages) cuando existen registros (total > 0) | Defecto / Paginación & SQL | Integración E2E / Repositorio | Crítica | Al menos 1 evento preventivo activo en PostgreSQL (6 registros sembrados) y token JWT válido de Encargado | `GET /api/eventos-atp/prevencion?page=99&limit=20` y `?page=4&limit=2` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `data: []` y `meta: { total: 6, page: 99, limit: 20, totalPages: 1, hasNext: false, hasPrev: true }` | HTTP 500 Internal Server Error (`code: '42601', syntax error at or near ")"` en `evento-prevencion.repository.ts:350`) | ABIERTO | 25/11/2026 17:22 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H76-API-02` | Rechazo HTTP 400 al filtrar por estado=EN_EJECUCION exigido por CA-2 debido a uso de EN_CURSO en EstadoEventoPrevencionSchema | Defecto / Contrato & CA-2 | Integración E2E / Esquema Zod | Alta | Usuario `encargado@valdivia.cl` autenticado y especificación CA-2 exigiendo `PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA` | `GET /api/eventos-atp/prevencion?estado=EN_EJECUCION` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK aceptando `EN_EJECUCION` como estado válido y alineado con CA-2, OpenAPI y `EstadoRecuperacionSchema` | HTTP 400 Bad Request (`Invalid option: expected one of "PLANIFICADA"\|"EN_CURSO"\|"COMPLETADA"\|"CANCELADA"`) | ABIERTO | 25/11/2026 17:22 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H76-API-03` | Desincronización de 86 commits con origin/develop, 3 conflictos de merge activos, omisión de evento_atp_id y rol erróneo en seed | Defecto / Git, Esquema & Seed | Integración / CI-CD | Alta | Rama `feature/H76-listar-eventos-prevencion` comparada contra `origin/develop` y ejecución de `npm run seed:eventos-prevencion` | `git rev-list --left-right --count origin/develop...HEAD`, `git merge-tree --write-tree origin/develop HEAD`, inspección de `creadoPorId` | Rama sincronizada sin conflictos, `evento_atp_id` en `types.ts`, seed unificado en `scripts/seed/index.ts` con creador Encargado/Admin | 86 commits atrás, 3 conflictos (`docs/api/eventos-atp.md`, `package.json`, `permisos.constants.ts`), sin `evento_atp_id` y `creadoPorId` de rol `PATRULLA_VERIFICADORA` | ABIERTO | 25/11/2026 17:21 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H76-API-04` | Mensaje HTTP 403 engañoso por omisión de mensajeError en validarAccesoRoles y rechazo HTTP 400 ante query params vacíos | Defecto / Seguridad & Validación | Integración E2E / Route Handler | Media | Tokens JWT válidos de `callcenter@valdivia.cl` (sin permiso) y `encargado@valdivia.cl` (con permiso) | `GET /api/eventos-atp/prevencion` (Call Center) y `GET /api/eventos-atp/prevencion?delegacionId=&estado=` (Encargado) | HTTP 403 citando permiso `prevencion:eventos:leer` y HTTP 200 ignorando parámetros opcionales vacíos | HTTP 403 citando "permisos de gestión de roles" y HTTP 400 rechazando `delegacionId=""` y `estado=""` | ABIERTO | 25/11/2026 17:22 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H76-API-05` | Ordenamiento SQL sin desempate ni prioridad de misión activa, ubicacionGeoJson sin tipo en OpenAPI y falta de tests de repositorio y migración 046 | Defecto / Calidad, OpenAPI & Cobertura | Estático / Spec / Unit Test | Media | Revisión de `evento-prevencion.repository.ts`, `GET /openapi.json` y carpeta de tests de repositorio y migraciones | Inspección de `evento-prevencion.repository.ts:343,371`, `GET /openapi.json` y `src/lib/db/migrations/__tests__/` | Ordenamiento determinista con `ep.id DESC` y prioridad de misión activa, `ubicacionGeoJson` tipado como GeoJSON Point y tests unitarios de repo y `046_` | Sin `ep.id DESC`, sin prioridad de misión activa, `ubicacionGeoJson` sin `type`/`properties` ni `required` en OpenAPI y sin tests unitarios de repo ni migración `046_` | ABIERTO | 25/11/2026 17:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H76-API-01` | Consulta exitosa de listado paginado por rol Encargado con permiso prevencion:eventos:leer bajo estándar H34 (CA-2, CA-5) | Funcional / API REST | Integración E2E | Crítica | Usuario `encargado@valdivia.cl` activo con permiso `prevencion:eventos:leer` y 6 eventos preventivos activos en BD | `GET /api/eventos-atp/prevencion` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `message`, arreglo `data` (código, punto crítico, delegación, estado, cuadrilla/patrulla, fechas) y `meta` H34 (`page=1`, `limit=20`) | HTTP 200 OK retornando 6 eventos con estructura completa y `meta: { total: 6, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false }` | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-02` | Consulta exitosa de listado paginado por rol Administrador con límite personalizado (limit=1) | Seguridad / RBAC | Integración E2E | Alta | Usuario `admin@valdivia.cl` con rol `ADMIN` y 6 eventos preventivos en PostgreSQL | `GET /api/eventos-atp/prevencion?limit=1` con `Authorization: Bearer <TOKEN_ADM>` | HTTP 200 OK retornando 1 elemento y `meta` con `total: 6`, `totalPages: 6`, `hasNext: true`, `hasPrev: false` | HTTP 200 OK retornando `PREV-2026-9005` y `meta: { total: 6, page: 1, limit: 1, totalPages: 6, hasNext: true, hasPrev: false }` | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-03` | Filtro por delegación municipal (Delegación Costa) y proyección de detalle PostGIS del punto crítico asociado y cuadrilla (CA-2, CA-3, CA-4) | Funcional / Filtros & PostGIS | Integración E2E | Crítica | Evento `PREV-2026-9002` en Delegación Costa (`30000000-0000-4000-8000-000000000003`) vinculado a `PC-NIE-03` y `Cuadrilla Aguas Lluvias Alfa` | `GET /api/eventos-atp/prevencion?delegacionId=30000000-0000-4000-8000-000000000003` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK retornando exclusivamente eventos de Costa con `puntoCritico.ubicacionGeoJson` (`Point` EPSG:4326), `cuadrilla`, `mision` y `recursos` | HTTP 200 OK retornando `PREV-2026-9002`, `puntoCritico` `PC-NIE-03` con `ubicacionGeoJson: {"type":"Point","coordinates":[-73.385,-39.851]}` y `cuadrilla` poblada | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-04` | Filtro por estado operativo para estados actualmente implementados (PLANIFICADA, EN_CURSO, COMPLETADA, CANCELADA) (CA-3) | Funcional / Filtros | Integración E2E | Alta | Eventos sembrados cubriendo `PLANIFICADA` (3), `EN_CURSO` (1), `COMPLETADA` (1) y `CANCELADA` (1) | `GET /api/eventos-atp/prevencion?estado=<ESTADO>` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK retornando solo registros del estado solicitado y `meta.total` consistente | HTTP 200 OK: `PLANIFICADA` (3), `EN_CURSO` (1: `PREV-2026-9001`), `COMPLETADA` (1: `PREV-2026-9003`), `CANCELADA` (1: `PREV-2026-9004`) | APROBADO | 25/11/2026 17:23 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-05` | Búsqueda textual por código de punto crítico (PC-NIE-03) y combinación simultánea de filtros delegación + estado + búsqueda (CA-3) | Funcional / Buscador | Integración E2E | Alta | Eventos vinculados a puntos críticos y evento en Delegación Sur (`Guacamayo`, `PLANIFICADA`) | `GET /api/eventos-atp/prevencion?busqueda=PC-NIE-03` y `?delegacionId=30000000-0000-4000-8000-000000000002&estado=PLANIFICADA&busqueda=Guacamayo` | HTTP 200 OK retornando únicamente los registros coincidentes con cada criterio combinado | HTTP 200 OK: `PC-NIE-03` retornó `PREV-2026-9002` (`total: 1`); filtro combinado retornó `PREV-2026-9005` (`total: 1`) | APROBADO | 25/11/2026 17:23 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-06` | Sanitización de comodín SQL ILIKE (%) y respuesta limpia de lista vacía ante búsqueda sin coincidencias (CA-3, Estándar H34) | Seguridad / Robustez | Integración E2E | Alta | Token JWT válido de Encargado y eventos activos en BD | `GET /api/eventos-atp/prevencion?busqueda=%25` y `?busqueda=NO_EXISTE_XYZ` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `data: []` y `meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false }` sin exponer todos los registros con `%` | HTTP 200 OK en ambos casos con `data: []`, `meta.total: 0` y `totalPages: 0` | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-07` | Navegación de paginación dentro de rango válido (page=1, 2, 3 con limit=2) verificando hasNext y hasPrev (CA-5) | Funcional / Paginación H34 | Integración E2E | Alta | 6 eventos preventivos activos en PostgreSQL | `GET /api/eventos-atp/prevencion?page=1&limit=2`, `?page=2&limit=2` y `?page=3&limit=2` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK devolviendo 2 registros por página, `totalPages: 3` y banderas `hasPrev`/`hasNext` coherentes | HTTP 200 OK: pág. 1 (`hasNext: true, hasPrev: false`), pág. 2 (`hasNext: true, hasPrev: true`), pág. 3 (`hasNext: false, hasPrev: true`) | APROBADO | 25/11/2026 17:23 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-08` | Rechazo con HTTP 401 Unauthorized ante petición sin cabecera Authorization y ante token Bearer inválido | Seguridad / Auth | Integración E2E | Crítica | Servidor `sgrai-api` activo en puerto 3001 | `GET /api/eventos-atp/prevencion` sin cabecera y con `Authorization: Bearer token.invalido.xyz` | HTTP 401 Unauthorized rechazando el acceso anónimo o con firma inválida | HTTP 401 Unauthorized en ambos casos (`Se requiere cabecera de autenticación...` y `Token de sesión inválido o expirado.`) | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-09` | Bloqueo de acceso RBAC (HTTP 403 Forbidden) para usuarios sin permiso prevencion:eventos:leer (Call Center y Patrulla Verificadora) | Seguridad / RBAC | Integración E2E | Crítica | Usuarios `callcenter@valdivia.cl` (`CALL_CENTER`) y `pedro.patrulla@valdivia.cl` (`PATRULLA_VERIFICADORA`) sin permiso `prevencion:eventos:leer` | `GET /api/eventos-atp/prevencion` con `Authorization: Bearer <TOKEN_CC>` y `<TOKEN_PAT>` | HTTP 403 Forbidden impidiendo lectura de eventos preventivos a perfiles no autorizados | HTTP 403 Forbidden aplicado a ambos perfiles (redacción del mensaje de error trazada en `BUG-H76-API-04`) | APROBADO | 25/11/2026 17:23 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-10` | Rechazo con HTTP 400 Bad Request ante parámetros de consulta inválidos (UUID malformado, estado inexistente, page=0, limit=101) | Validación / Zod | Integración E2E | Media | Token JWT válido de Encargado | `GET /api/eventos-atp/prevencion?delegacionId=no-uuid&estado=INVALIDO` y `?page=0&limit=101` | HTTP 400 Bad Request con arreglo `errors` detallando cada campo inválido | HTTP 400 Bad Request retornando arreglo `errors` con los campos `delegacionId`, `estado`, `page` y `limit` | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-11` | Soporte a eventos preventivos desplegados con coordenadas libres sin punto crítico catalogado ni incidente previo (Regla de Dominio ICS) | Funcional / Dominio ICS | Integración E2E | Alta | Evento `PREV-2026-9005` (`punto_critico_id = NULL`, sector Guacamayo) en PostgreSQL | `GET /api/eventos-atp/prevencion?busqueda=Guacamayo` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `puntoCritico: null`, `ubicacionGeoJson` propio del evento y `patrulla` asignada sin error de JOIN | HTTP 200 OK retornando `PREV-2026-9005` con `puntoCritico: null`, `ubicacionGeoJson: {"type":"Point","coordinates":[-73.2295,-39.864]}` y `patrulla` poblada | APROBADO | 25/11/2026 17:23 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-12` | Ejecución de migración 046_eventos_prevencion_permiso_leer_y_borrado_logico.ts y asignación RBAC en PostgreSQL | Esquema / DB | Migración | Alta | Instancia PostgreSQL 16 + PostGIS en contenedor `grupo1_postgres` | `npm run db:migrate` y verificación en `psql` de columnas en `evento_prevencion` y filas en `rol_permiso` | Columnas `activo`, `eliminado_en`, `eliminado_por_id` e índices creados; permiso `prevencion:eventos:leer` asignado a `ADMIN`, `ENCARGADO` y `SUPERVISOR` | Migración `046_` aplicada exitosamente y 3 filas verificadas en `rol_permiso` (`ADMIN`, `ENCARGADO`, `SUPERVISOR`) | APROBADO | 25/11/2026 17:21 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-13` | Ejecución de suites automatizadas Vitest (módulo Eventos Prevención, OpenAPI y suite global) y análisis estático ESLint | Automatización QA | Unit / Estático | Alta | Entorno Node.js con dependencias instaladas en rama `feature/H76-listar-eventos-prevencion` | `npx vitest run ...`, `npm test` y `npm run lint` | 100% de pruebas existentes aprobadas y 0 errores de linting en ESLint | 32/32 tests de prevención y OpenAPI aprobados, 851/851 tests globales (72 archivos) aprobados y `npm run lint` con 0 errores | APROBADO | 25/11/2026 17:19 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |
| `CP-H76-API-14` | Registro del endpoint GET /api/eventos-atp/prevencion en OpenAPI 3.0 (/openapi.json) y documentación técnica en docs/api/eventos-atp.md | Contrato & Docs | API / Spec | Media | Servidor local activo sirviendo `/openapi.json` e inspección de `docs/api/eventos-atp.md` | `curl -s http://localhost:3001/openapi.json` y revisión de `docs/api/eventos-atp.md` líneas 968–991 | Ruta `GET /api/eventos-atp/prevencion` registrada bajo tag `Eventos ATP`, `security: BearerAuth`, parámetros H34 y documentada en `docs/api/eventos-atp.md` | Endpoint registrado en `/openapi.json` (v0.12.0) y documentado en `docs/api/eventos-atp.md` (observaciones de enum/GeoJSON/merge en `BUG-H76-API-02`, `03`, `05`) | APROBADO | 25/11/2026 17:22 | (No aplica) | feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76) |

---

### 3.1. Bloque TSV para Exportación Tabular

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H76-API-01	Error HTTP 500 (SQL 42601) al solicitar una página fuera de rango (page > totalPages) cuando existen registros (total > 0)	Defecto / Paginación & SQL	Integración E2E / Repositorio	Crítica	Al menos 1 evento preventivo activo en PostgreSQL (6 registros sembrados) y token JWT válido de Encargado	GET /api/eventos-atp/prevencion?page=99&limit=20 y ?page=4&limit=2 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con data: [] y meta: { total: 6, page: 99, limit: 20, totalPages: 1, hasNext: false, hasPrev: true }	HTTP 500 Internal Server Error (code: 42601, syntax error at or near ")" en evento-prevencion.repository.ts:350)	ABIERTO	25/11/2026 17:22	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H76-API-02	Rechazo HTTP 400 al filtrar por estado=EN_EJECUCION exigido por CA-2 debido a uso de EN_CURSO en EstadoEventoPrevencionSchema	Defecto / Contrato & CA-2	Integración E2E / Esquema Zod	Alta	Usuario encargado@valdivia.cl autenticado y especificación CA-2 exigiendo PLANIFICADA, EN_EJECUCION, COMPLETADA, CANCELADA	GET /api/eventos-atp/prevencion?estado=EN_EJECUCION con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK aceptando EN_EJECUCION como estado válido y alineado con CA-2, OpenAPI y EstadoRecuperacionSchema	HTTP 400 Bad Request (Invalid option: expected one of PLANIFICADA|EN_CURSO|COMPLETADA|CANCELADA)	ABIERTO	25/11/2026 17:22	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H76-API-03	Desincronización de 86 commits con origin/develop, 3 conflictos de merge activos, omisión de evento_atp_id y rol erróneo en seed	Defecto / Git, Esquema & Seed	Integración / CI-CD	Alta	Rama feature/H76-listar-eventos-prevencion comparada contra origin/develop y ejecución de npm run seed:eventos-prevencion	git rev-list --left-right --count origin/develop...HEAD, git merge-tree --write-tree origin/develop HEAD, inspección de creadoPorId	Rama sincronizada sin conflictos, evento_atp_id en types.ts, seed unificado en scripts/seed/index.ts con creador Encargado/Admin	86 commits atrás, 3 conflictos (docs/api/eventos-atp.md, package.json, permisos.constants.ts), sin evento_atp_id y creadoPorId de rol PATRULLA_VERIFICADORA	ABIERTO	25/11/2026 17:21	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H76-API-04	Mensaje HTTP 403 engañoso por omisión de mensajeError en validarAccesoRoles y rechazo HTTP 400 ante query params vacíos	Defecto / Seguridad & Validación	Integración E2E / Route Handler	Media	Tokens JWT válidos de callcenter@valdivia.cl (sin permiso) y encargado@valdivia.cl (con permiso)	GET /api/eventos-atp/prevencion (Call Center) y GET /api/eventos-atp/prevencion?delegacionId=&estado= (Encargado)	HTTP 403 citando permiso prevencion:eventos:leer y HTTP 200 ignorando parámetros opcionales vacíos	HTTP 403 citando "permisos de gestión de roles" y HTTP 400 rechazando delegacionId="" y estado=""	ABIERTO	25/11/2026 17:22	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H76-API-05	Ordenamiento SQL sin desempate ni prioridad de misión activa, ubicacionGeoJson sin tipo en OpenAPI y falta de tests de repositorio y migración 046	Defecto / Calidad, OpenAPI & Cobertura	Estático / Spec / Unit Test	Media	Revisión de evento-prevencion.repository.ts, GET /openapi.json y carpeta de tests de repositorio y migraciones	Inspección de evento-prevencion.repository.ts:343,371, GET /openapi.json y src/lib/db/migrations/__tests__/	Ordenamiento determinista con ep.id DESC y prioridad de misión activa, ubicacionGeoJson tipado como GeoJSON Point y tests unitarios de repo y 046_	Sin ep.id DESC, sin prioridad de misión activa, ubicacionGeoJson sin type/properties ni required en OpenAPI y sin tests unitarios de repo ni migración 046_	ABIERTO	25/11/2026 17:23	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H76-API-01	Consulta exitosa de listado paginado por rol Encargado con permiso prevencion:eventos:leer bajo estándar H34 (CA-2, CA-5)	Funcional / API REST	Integración E2E	Crítica	Usuario encargado@valdivia.cl activo con permiso prevencion:eventos:leer y 6 eventos preventivos activos en BD	GET /api/eventos-atp/prevencion con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con message, arreglo data (código, punto crítico, delegación, estado, cuadrilla/patrulla, fechas) y meta H34 (page=1, limit=20)	HTTP 200 OK retornando 6 eventos con estructura completa y meta: { total: 6, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false }	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-02	Consulta exitosa de listado paginado por rol Administrador con límite personalizado (limit=1)	Seguridad / RBAC	Integración E2E	Alta	Usuario admin@valdivia.cl con rol ADMIN y 6 eventos preventivos en PostgreSQL	GET /api/eventos-atp/prevencion?limit=1 con Authorization: Bearer <TOKEN_ADM>	HTTP 200 OK retornando 1 elemento y meta con total: 6, totalPages: 6, hasNext: true, hasPrev: false	HTTP 200 OK retornando PREV-2026-9005 y meta: { total: 6, page: 1, limit: 1, totalPages: 6, hasNext: true, hasPrev: false }	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-03	Filtro por delegación municipal (Delegación Costa) y proyección de detalle PostGIS del punto crítico asociado y cuadrilla (CA-2, CA-3, CA-4)	Funcional / Filtros & PostGIS	Integración E2E	Crítica	Evento PREV-2026-9002 en Delegación Costa (30000000-0000-4000-8000-000000000003) vinculado a PC-NIE-03 y Cuadrilla Aguas Lluvias Alfa	GET /api/eventos-atp/prevencion?delegacionId=30000000-0000-4000-8000-000000000003 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK retornando exclusivamente eventos de Costa con puntoCritico.ubicacionGeoJson (Point EPSG:4326), cuadrilla, mision y recursos	HTTP 200 OK retornando PREV-2026-9002, puntoCritico PC-NIE-03 con ubicacionGeoJson Point [-73.385,-39.851] y cuadrilla poblada	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-04	Filtro por estado operativo para estados actualmente implementados (PLANIFICADA, EN_CURSO, COMPLETADA, CANCELADA) (CA-3)	Funcional / Filtros	Integración E2E	Alta	Eventos sembrados cubriendo PLANIFICADA (3), EN_CURSO (1), COMPLETADA (1) y CANCELADA (1)	GET /api/eventos-atp/prevencion?estado=<ESTADO> con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK retornando solo registros del estado solicitado y meta.total consistente	HTTP 200 OK: PLANIFICADA (3), EN_CURSO (1: PREV-2026-9001), COMPLETADA (1: PREV-2026-9003), CANCELADA (1: PREV-2026-9004)	APROBADO	25/11/2026 17:23	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-05	Búsqueda textual por código de punto crítico (PC-NIE-03) y combinación simultánea de filtros delegación + estado + búsqueda (CA-3)	Funcional / Buscador	Integración E2E	Alta	Eventos vinculados a puntos críticos y evento en Delegación Sur (Guacamayo, PLANIFICADA)	GET /api/eventos-atp/prevencion?busqueda=PC-NIE-03 y ?delegacionId=30000000-0000-4000-8000-000000000002&estado=PLANIFICADA&busqueda=Guacamayo	HTTP 200 OK retornando únicamente los registros coincidentes con cada criterio combinado	HTTP 200 OK: PC-NIE-03 retornó PREV-2026-9002 (total: 1); filtro combinado retornó PREV-2026-9005 (total: 1)	APROBADO	25/11/2026 17:23	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-06	Sanitización de comodín SQL ILIKE (%) y respuesta limpia de lista vacía ante búsqueda sin coincidencias (CA-3, Estándar H34)	Seguridad / Robustez	Integración E2E	Alta	Token JWT válido de Encargado y eventos activos en BD	GET /api/eventos-atp/prevencion?busqueda=%25 y ?busqueda=NO_EXISTE_XYZ con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con data: [] y meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } sin exponer todos los registros con %	HTTP 200 OK en ambos casos con data: [], meta.total: 0 y totalPages: 0	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-07	Navegación de paginación dentro de rango válido (page=1, 2, 3 con limit=2) verificando hasNext y hasPrev (CA-5)	Funcional / Paginación H34	Integración E2E	Alta	6 eventos preventivos activos en PostgreSQL	GET /api/eventos-atp/prevencion?page=1&limit=2, ?page=2&limit=2 y ?page=3&limit=2 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK devolviendo 2 registros por página, totalPages: 3 y banderas hasPrev/hasNext coherentes	HTTP 200 OK: pág. 1 (hasNext: true, hasPrev: false), pág. 2 (hasNext: true, hasPrev: true), pág. 3 (hasNext: false, hasPrev: true)	APROBADO	25/11/2026 17:23	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-08	Rechazo con HTTP 401 Unauthorized ante petición sin cabecera Authorization y ante token Bearer inválido	Seguridad / Auth	Integración E2E	Crítica	Servidor sgrai-api activo en puerto 3001	GET /api/eventos-atp/prevencion sin cabecera y con Authorization: Bearer token.invalido.xyz	HTTP 401 Unauthorized rechazando el acceso anónimo o con firma inválida	HTTP 401 Unauthorized en ambos casos (Se requiere cabecera de autenticación... y Token de sesión inválido o expirado.)	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-09	Bloqueo de acceso RBAC (HTTP 403 Forbidden) para usuarios sin permiso prevencion:eventos:leer (Call Center y Patrulla Verificadora)	Seguridad / RBAC	Integración E2E	Crítica	Usuarios callcenter@valdivia.cl (CALL_CENTER) y pedro.patrulla@valdivia.cl (PATRULLA_VERIFICADORA) sin permiso prevencion:eventos:leer	GET /api/eventos-atp/prevencion con Authorization: Bearer <TOKEN_CC> y <TOKEN_PAT>	HTTP 403 Forbidden impidiendo lectura de eventos preventivos a perfiles no autorizados	HTTP 403 Forbidden aplicado a ambos perfiles (redacción del mensaje de error trazada en BUG-H76-API-04)	APROBADO	25/11/2026 17:23	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-10	Rechazo con HTTP 400 Bad Request ante parámetros de consulta inválidos (UUID malformado, estado inexistente, page=0, limit=101)	Validación / Zod	Integración E2E	Media	Token JWT válido de Encargado	GET /api/eventos-atp/prevencion?delegacionId=no-uuid&estado=INVALIDO y ?page=0&limit=101	HTTP 400 Bad Request con arreglo errors detallando cada campo inválido	HTTP 400 Bad Request retornando arreglo errors con los campos delegacionId, estado, page y limit	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-11	Soporte a eventos preventivos desplegados con coordenadas libres sin punto crítico catalogado ni incidente previo (Regla de Dominio ICS)	Funcional / Dominio ICS	Integración E2E	Alta	Evento PREV-2026-9005 (punto_critico_id = NULL, sector Guacamayo) en PostgreSQL	GET /api/eventos-atp/prevencion?busqueda=Guacamayo con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con puntoCritico: null, ubicacionGeoJson propio del evento y patrulla asignada sin error de JOIN	HTTP 200 OK retornando PREV-2026-9005 con puntoCritico: null, ubicacionGeoJson Point [-73.2295,-39.864] y patrulla poblada	APROBADO	25/11/2026 17:23	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-12	Ejecución de migración 046_eventos_prevencion_permiso_leer_y_borrado_logico.ts y asignación RBAC en PostgreSQL	Esquema / DB	Migración	Alta	Instancia PostgreSQL 16 + PostGIS en contenedor grupo1_postgres	npm run db:migrate y verificación en psql de columnas en evento_prevencion y filas en rol_permiso	Columnas activo, eliminado_en, eliminado_por_id e índices creados; permiso prevencion:eventos:leer asignado a ADMIN, ENCARGADO y SUPERVISOR	Migración 046_ aplicada exitosamente y 3 filas verificadas en rol_permiso (ADMIN, ENCARGADO, SUPERVISOR)	APROBADO	25/11/2026 17:21	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-13	Ejecución de suites automatizadas Vitest (módulo Eventos Prevención, OpenAPI y suite global) y análisis estático ESLint	Automatización QA	Unit / Estático	Alta	Entorno Node.js con dependencias instaladas en rama feature/H76-listar-eventos-prevencion	npx vitest run ..., npm test y npm run lint	100% de pruebas existentes aprobadas y 0 errores de linting en ESLint	32/32 tests de prevención y OpenAPI aprobados, 851/851 tests globales (72 archivos) aprobados y npm run lint con 0 errores	APROBADO	25/11/2026 17:19	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
CP-H76-API-14	Registro del endpoint GET /api/eventos-atp/prevencion en OpenAPI 3.0 (/openapi.json) y documentación técnica en docs/api/eventos-atp.md	Contrato & Docs	API / Spec	Media	Servidor local activo sirviendo /openapi.json e inspección de docs/api/eventos-atp.md	curl -s http://localhost:3001/openapi.json y revisión de docs/api/eventos-atp.md líneas 968-991	Ruta GET /api/eventos-atp/prevencion registrada bajo tag Eventos ATP, security BearerAuth, parámetros H34 y documentada en docs/api/eventos-atp.md	Endpoint registrado en /openapi.json (v0.12.0) y documentado en docs/api/eventos-atp.md (observaciones de enum/GeoJSON/merge en BUG-H76-API-02, 03, 05)	APROBADO	25/11/2026 17:22	(No aplica)	feat(eventos-atp): implementar listado paginado de eventos de prevencion (H76)
````

---

## 4. Guía Detallada de Ejecución y Replicabilidad Paso a Paso

### 4.1. Pruebas Automatizadas con Vitest y Análisis Estático

#### Comando — Suite del Módulo Eventos de Prevención y OpenAPI:
```bash
npx vitest run src/app/api/eventos-atp/prevencion/__tests__/route.test.ts src/modules/eventos-atp/__tests__/evento-prevencion.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida Obtenida:**
```text
 ✓ src/modules/eventos-atp/__tests__/evento-prevencion.test.ts (18 tests) 31ms
 ✓ src/app/api/eventos-atp/prevencion/__tests__/route.test.ts (13 tests) 40ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 153ms

 Test Files  3 passed (3)
      Tests  32 passed (32)
   Start at  17:19:16
   Duration  1.22s
```

#### Comando — Ejecución Filtrada por Nombre de Suite H76:
```bash
npm test -- -t "H76"
```

#### Comando — Suite Completa del Repositorio y ESLint:
```bash
npm test && npm run lint
```

**Salida Obtenida:**
```text
 Test Files  72 passed (72)
      Tests  851 passed (851)
   Start at  17:19:48
   Duration  6.35s

npm notice run api@0.12.0 lint
npm notice run eslint
(Exit code 0 — 0 errores, 0 warnings)
```

---

### 4.2. Verificación de Sincronización Git y Conflictos frente a `origin/develop` (`BUG-H76-API-03`)

```bash
git rev-list --left-right --count origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
```

**Salida Obtenida:**
```text
86	3

Auto-fusionando docs/api/eventos-atp.md
CONFLICTO (contenido): Conflicto de fusión en docs/api/eventos-atp.md
Auto-fusionando package.json
CONFLICTO (contenido): Conflicto de fusión en package.json
Auto-fusionando src/lib/db/types.ts
Auto-fusionando src/lib/openapi/index.ts
Auto-fusionando src/modules/seguridad/permisos.constants.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/seguridad/permisos.constants.ts
```

---

### 4.3. Migración Kysely `046_` y Semilla de Datos en PostgreSQL (`CP-H76-API-12`)

```bash
npm run db:migrate && npm run seed:eventos-prevencion
```

**Salida Obtenida:**
```text
Ejecutando migraciones Kysely de base de datos...
[OK] Migración Kysely ejecutada con éxito: "035_permiso_misiones_terreno_verificar"
[OK] Migración Kysely ejecutada con éxito: "046_eventos_prevencion_permiso_leer_y_borrado_logico"
Todas las migraciones se completaron correctamente.

Iniciando inserción de eventos de prevención de prueba (H76)...
✅ 5 eventos de prevención de prueba sembrados correctamente.
```

Verificación de asignación RBAC en PostgreSQL:
```bash
docker exec grupo1_postgres psql -U sgrai -d sgrai -c "SELECT r.codigo, r.nombre, p.codigo as permiso FROM rol_permiso rp JOIN rol r ON r.id = rp.rol_id JOIN permiso p ON p.id = rp.permiso_id WHERE p.codigo = 'prevencion:eventos:leer' ORDER BY r.codigo;"
```

**Salida Obtenida:**
```text
   codigo   |         nombre         |         permiso         
------------+------------------------+-------------------------
 ADMIN      | Administrador          | prevencion:eventos:leer
 ENCARGADO  | Encargado              | prevencion:eventos:leer
 SUPERVISOR | Supervisor Estratégico | prevencion:eventos:leer
(3 rows)
```

---

### 4.4. Pruebas de Integración en Vivo vía `curl`

#### Obtención de Tokens JWT de Sesión:
```bash
BASE="http://localhost:3001"

TOKEN_ENC=$(curl -s -X POST "$BASE/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data?.token || "")')

TOKEN_ADM=$(curl -s -X POST "$BASE/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"admin@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data?.token || "")')

TOKEN_CC=$(curl -s -X POST "$BASE/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data?.token || "")')
```

---

#### Evidencia de `BUG-H76-API-01`: Paginación fuera de rango (`page=99&limit=20` y `page=4&limit=2`)
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?page=99&limit=20"
```

**Respuesta Obtenida:**
```json
{"message":"Error interno del servidor al consultar eventos de prevención."}
```
`HTTP_STATUS:500`

**Traza del Servidor:**
```text
Error al listar eventos de prevención: error: syntax error at or near ")"
    at async Module.listarEventosPrevencionPaginados (src/modules/eventos-atp/evento-prevencion.repository.ts:350:24)
    at async listarEventosPrevencionService (src/modules/eventos-atp/evento-prevencion.service.ts:243:5)
    at async GET (src/app/api/eventos-atp/prevencion/route.ts:58:23)
  severity: 'ERROR',
  code: '42601'
```

---

#### Evidencia de `BUG-H76-API-02`: Filtro por estado `EN_EJECUCION` (CA-2)
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?estado=EN_EJECUCION"
```

**Respuesta Obtenida:**
```json
{
  "message": "Parámetros de consulta inválidos para listar eventos de prevención.",
  "errors": [
    {
      "campo": "estado",
      "mensaje": "Invalid option: expected one of \"PLANIFICADA\"|\"EN_CURSO\"|\"COMPLETADA\"|\"CANCELADA\""
    }
  ]
}
```
`HTTP_STATUS:400`

---

#### Evidencia de `BUG-H76-API-04`: Mensaje HTTP `403` inconsistente y query params vacíos
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_CC" \
  "http://localhost:3001/api/eventos-atp/prevencion"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?delegacionId=&estado="
```

**Respuestas Obtenidas:**
```json
{"message":"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."}
```
`HTTP_STATUS:403`

```json
{
  "message": "Parámetros de consulta inválidos para listar eventos de prevención.",
  "errors": [
    {"campo": "delegacionId", "mensaje": "El UUID de la delegación debe ser válido"},
    {"campo": "estado", "mensaje": "Invalid option: expected one of \"PLANIFICADA\"|\"EN_CURSO\"|\"COMPLETADA\"|\"CANCELADA\""}
  ]
}
```
`HTTP_STATUS:400`

---

#### Evidencia de `CP-H76-API-03` y `CP-H76-API-05`: Filtro por Delegación Costa y Búsqueda por Punto Crítico `PC-NIE-03`
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?delegacionId=30000000-0000-4000-8000-000000000003"
```

**Respuesta Obtenida:**
```json
{
  "message": "Eventos de prevención obtenidos exitosamente.",
  "data": [
    {
      "id": "81000000-0000-4000-8000-000000000002",
      "codigo": "PREV-2026-9002",
      "nombre": "Faja cortafuego y desmalezado Camino a Niebla",
      "descripcion": "Construcción y mantención de faja cortafuego preventiva en ladera boscosa.",
      "sector": "Curva Los Pelúes",
      "direccionTexto": "Ruta T-350 km 6",
      "prioridad": "CRITICA",
      "estado": "PLANIFICADA",
      "latitud": -39.851,
      "longitud": -73.385,
      "ubicacionGeoJson": {
        "type": "Point",
        "coordinates": [-73.385, -39.851]
      },
      "puntoCritico": {
        "id": "40000000-0000-4000-8000-000000000003",
        "codigo": "PC-NIE-03",
        "nombre": "Camino a Niebla - Curva Los Pelúes",
        "descripcion": "Ladera de cerro con historial de remoción en masa y caída de árboles sobre la ruta T-350",
        "tipoRiesgo": "Remoción en masa y deslizamiento de ladera",
        "prioridad": "CRITICA",
        "latitud": -39.851,
        "longitud": -73.385,
        "ubicacionGeoJson": {
          "type": "Point",
          "coordinates": [-73.385, -39.851]
        }
      },
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000003",
        "codigo": "DEL_COSTA",
        "nombre": "Delegación Municipal Costa"
      },
      "mision": {
        "id": "82000000-0000-4000-8000-000000000002",
        "codigo": "MIS-2026-9002",
        "titulo": "Faja cortafuego y desmalezado Camino a Niebla",
        "estado": "DESPACHADA",
        "tipoMision": "PREVENCION",
        "fechaInicio": "2026-11-19T08:30:00.000Z",
        "fechaCierre": null
      },
      "patrulla": null,
      "cuadrilla": {
        "id": "c1000000-0000-4000-8000-000000000001",
        "nombre": "Cuadrilla Aguas Lluvias Alfa",
        "estado": "EN_MISION"
      },
      "recursos": [
        {
          "recursoId": "e1000000-0000-4000-8000-000000000001",
          "nombre": "Motobomba Caudal 4\"",
          "cantidadAsignada": 4
        }
      ],
      "creadoPorId": "d1000000-0000-4000-8000-000000000004",
      "creadoEn": "2026-11-25T20:21:49.559Z",
      "actualizadoEn": "2026-11-25T20:21:49.559Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```
`HTTP_STATUS:200`

---

#### Evidencia de `CP-H76-API-06`, `CP-H76-API-08` y `CP-H76-API-10`: Comodín `%`, Autenticación `401` y Validación `400`
```bash
# Sin autenticación (401)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/eventos-atp/prevencion"

# Comodín ILIKE % escapado (200 vacío)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?busqueda=%25"

# Parámetros fuera de rango (400)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  "http://localhost:3001/api/eventos-atp/prevencion?page=0&limit=101"
```

**Respuestas Obtenidas:**
```json
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```
`HTTP_STATUS:401`

```json
{"message":"Eventos de prevención obtenidos exitosamente.","data":[],"meta":{"total":0,"page":1,"limit":20,"totalPages":0,"hasNext":false,"hasPrev":false}}
```
`HTTP_STATUS:200`

```json
{"message":"Parámetros de consulta inválidos para listar eventos de prevención.","errors":[{"campo":"page","mensaje":"Too small: expected number to be >=1"},{"campo":"limit","mensaje":"Too big: expected number to be <=100"}]}
```
`HTTP_STATUS:400`

---

## 5. Matriz de Trazabilidad de Criterios de Aceptación (HU-76)

| Criterio de Aceptación (CA) | Capa Responsable | Casos / Defectos Asociados | Cobertura y Estado en `sgrai-api` |
|---|---|---|---|
| **CA-1:** El sistema debe proveer una vista tabular en `/gestion/centro-incidentes` bajo el estándar de contratos H34. | Frontend (`sgrai-web`) | Fuera de alcance `sgrai-api` | Implementado y validado en el repositorio `sgrai-web`. |
| **CA-2:** La tabla debe listar: Código de prevención, Punto crítico asociado, Delegación, Estado (`PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `CANCELADA`), Cuadrilla/Patrulla a cargo y Fechas. | Backend (`sgrai-api`) | `CP-H76-API-01`, `CP-H76-API-03`, `CP-H76-API-04`, `BUG-H76-API-02` | 🔴 **Incumplimiento Parcial**: Proyecta código, punto crítico, delegación, patrulla/cuadrilla y fechas (`creadoEn`, `mision.fechaInicio`, `mision.fechaCierre`), pero usa `EN_CURSO` en lugar de `EN_EJECUCION` (`BUG-H76-API-02`). |
| **CA-3:** Debe permitir filtros por delegación municipal, estado y buscador por punto crítico. | Backend (`sgrai-api`) | `CP-H76-API-03`, `CP-H76-API-04`, `CP-H76-API-05`, `CP-H76-API-06`, `BUG-H76-API-02`, `BUG-H76-API-04` | 🟡 **Observado**: Filtros por `delegacionId`, `estado` y `busqueda` (con sanitización `ILIKE`) operativos en flujo nominal; bloqueado por rechazo de `estado=EN_EJECUCION` (`BUG-H76-API-02`) y error `400` con query params vacíos (`BUG-H76-API-04`). |
| **CA-4:** Drawer lateral desplegable al hacer clic en una fila con información del punto crítico PostGIS. | Backend (`sgrai-api`) + Frontend (`sgrai-web`) | `CP-H76-API-03`, `CP-H76-API-11`, `BUG-H76-API-05` | 🟡 **Observado en API**: El endpoint entrega `puntoCritico` completo incluyendo `ubicacionGeoJson` (`ST_AsGeoJSON` EPSG:4326) y soporta `puntoCritico: null`, pero el esquema OpenAPI carece de tipado estructurado GeoJSON (`BUG-H76-API-05`). |
| **CA-5:** El endpoint `GET /api/eventos-atp/prevencion` debe responder bajo estándar H34. | Backend (`sgrai-api`) | `CP-H76-API-01`, `CP-H76-API-07`, `CP-H76-API-14`, `BUG-H76-API-01`, `BUG-H76-API-03`, `BUG-H76-API-05` | 🔴 **Rechazado**: Responde con formato H34 dentro de rango, pero cae con HTTP `500` (`42601`) cuando `page > totalPages` y `total > 0` (`BUG-H76-API-01`), carece de ordenamiento determinista (`BUG-H76-API-05`) y presenta 3 conflictos de fusión con `origin/develop` (`BUG-H76-API-03`). |

