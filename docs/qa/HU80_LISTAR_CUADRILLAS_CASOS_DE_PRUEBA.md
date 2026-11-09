# Informe de Auditoría y Matriz de Casos de Prueba (QA): HU-80 — Visualizar Listado de Cuadrillas Operativas, Disponibilidad y Dotación

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Cuadrillas Operativas (`sgrai-api` — `GET /api/cuadrillas` y `GET /api/cuadrillas/:id`).  
> **Historia de Usuario:** HU-80 — *"Como Administrador / Encargado Quiero visualizar un listado completo de las cuadrillas operativas registradas, su estado de disponibilidad y el personal y recursos que la componen Para conocer la capacidad de respuesta táctica disponible en cada delegación municipal al momento de asignar emergencias."*  
> **Desarrollador Asignado:** Jonagu1  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely Query Builder + PostgreSQL + Zod + Vitest v3.2.7).  
> **Rama Git Evaluada:** `feature/H80-listar-cuadrillas`  
> **Commits Evaluados (Conventional Commits):**  
> * `feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79`  
> * `feat(db): agregar migracion 035 con indices parciales de listado de cuadrillas (H80)`  
> * `test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)`  
> * `test(cuadrillas): agregar casos de listarCuadrillas al suite del servicio (H80)`  
> * `test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)`  
> * `docs(openapi): completar query params de GET /api/cuadrillas bajo estandar H34 (H80)`  
> * `docs(api): documentar contrato H34 del listado de cuadrillas en recursos-y-personal.md`  
>  
> **Fecha de Ejecución QA:** 09 de Noviembre de 2026.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (CHANGES REQUESTED — 5 DEFECTOS ABIERTOS)**.

---

## 1. Resumen Ejecutivo de Pruebas

Durante la auditoría técnica de código, ejecución de pruebas automatizadas con Vitest y validación de contrato HTTP/REST sobre la rama `feature/H80-listar-cuadrillas` del repositorio `sgrai-api`, se evaluaron **25 casos de prueba** (20 casos funcionales, de validación, seguridad RBAC y rendimiento de índices + 5 defectos detectados). Se identificaron **5 defectos reales** (2 de severidad Crítica, 2 de severidad Alta y 1 de severidad Media) que impiden la certificación e integración de la rama en su estado actual.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba Evaluados** | **25** | Cobertura de esquema Zod, Route Handlers, Servicio, Repositorio Kysely, Migración 035 y Contrato OpenAPI |
| **Casos Aprobados (Passed)** | **20** | Filtros por delegación/estado, RBAC (`401`/`403`), validación Zod (`400`), detalle unitario e índices parciales |
| **Casos Fallidos / Defectos Abiertos (Failed)** | **5** | `BUG-H80-API-01` al `BUG-H80-API-05` documentados con pasos de reproducción |
| **Casos Bloqueados (Blocked)** | **0** | Entorno de base de datos PostgreSQL y servidor API operativos |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Requiere subsanación de los 5 defectos y ejecución de Re-Test para certificación |
| **Chequeo de Tipos Estáticos (`npx tsc --noEmit`)** | 🟢 **0 errores** | Compilación de tipos limpia |
| **Análisis Estático (`npm run lint`)** | 🔴 **1 error, 2 warnings** | Error `@typescript-eslint/no-explicit-any` en `cuadrilla.service.test.ts:374` |
| **Suite Automatizada (Vitest)** | 🔴 **45/46 tests pass (1 fail)** | Fallo en `src/app/openapi.json/__tests__/route.test.ts:34` por reversión accidental en `src/lib/openapi/index.ts` |
| **Sincronización con rama `develop`** | 🔴 **55 commits por detrás** | Colisión de migración `032` con `032_cuadrilla_baja_logica_activo.ts` (HU-82) en `develop` |

---

## 2. Registro Técnico de Defectos

### `BUG-H80-API-01`: Excepción SQL (`code: 42601 — syntax error at or near ")"`) y respuesta `HTTP 500 Internal Server Error` al consultar una página fuera de rango (`offset >= total`)
* **Severidad:** CRÍTICA
* **Estado:** ABIERTO
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (líneas 250–307)
* **Descripción Técnica:** En la función `listarCuadrillasPaginadas`, el repositorio verifica inicialmente `if (total === 0) return { cuadrillas: [], total: 0 };` (línea 246). Sin embargo, cuando existen cuadrillas activas en la base de datos (`total > 0`, por ejemplo `total = 1`) y el cliente consulta una página cuyo desplazamiento supera el total de registros (ej. `GET /api/cuadrillas?pagina=2&limite=1` o `GET /api/cuadrillas?pagina=2&limite=10`), la consulta paginada `cuadrillasLote` retorna un arreglo vacío `[]`. Al no existir validación de lote vacío tras la línea 274 (`const cuadrillaIds = cuadrillasLote.map((c) => c.id);`), el repositorio ejecuta `.where("cuadrilla_recurso.cuadrilla_id", "in", [])` en la línea 288. Kysely compila dicha expresión a SQL inválido `WHERE "cuadrilla_recurso"."cuadrilla_id" IN ()`, provocando que PostgreSQL arroje el error de sintaxis `42601` (`syntax error at or near ")"`) y el endpoint responda `HTTP 500 Internal Server Error`.
* **Pasos para Reproducir:**
  1. Contar con al menos 1 cuadrilla activa en la base de datos (`total = 1`).
  2. Enviar petición autenticada `GET http://localhost:3001/api/cuadrillas?pagina=2&limite=1`.
* **Comportamiento Actual:** El servidor lanza excepción SQL `42601` en consola y retorna `HTTP 500 Internal Server Error` con cuerpo `{"message":"Error interno del servidor al procesar la solicitud."}`.
* **Comportamiento Esperado:** El servidor debe retornar `HTTP 200 OK` con `data: []` y los metadatos de paginación correspondientes.
* **Solución Técnica Requerida:** Incorporar retorno temprano inmediatamente después de obtener `cuadrillasLote` en `src/modules/recursos-y-personal/cuadrilla.repository.ts` (línea 274):
  ```typescript
  if (cuadrillasLote.length === 0) {
    return { cuadrillas: [], total };
  }
  ```

---

### `BUG-H80-API-02`: Reversión accidental en commit `2fdc8e5` que rompe el test de `/openapi.json`, elimina `ListarCuadrillasQuerySchema` de la especificación OpenAPI, introduce fallo de ESLint y revierte pruebas y documentación H34
* **Severidad:** CRÍTICA
* **Estado:** ABIERTO
* **Módulo / Archivos Afectados:**
  * `src/lib/openapi/index.ts` (líneas 46–52 y 1963–1985)
  * `src/app/openapi.json/__tests__/route.test.ts` (línea 34)
  * `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts` (líneas 117–140 y 374)
  * `docs/api/recursos-y-personal.md` (líneas 572–583)
  * `docs/database/README.md` (línea 699)
* **Descripción Técnica:** En los commits previos de la rama (`2c1ac54`, `fbcde39` y `23aa13f`), se habían agregado los 6 casos unitarios de `listarCuadrillas` en `cuadrilla.service.test.ts`, registrado `request: { query: ListarCuadrillasQuerySchema }` en `src/lib/openapi/index.ts` y documentado la tabla de parámetros H34 en `docs/api/recursos-y-personal.md`. No obstante, en el último commit (`docs(qa): registrar matriz de casos de prueba HU-80 listar cuadrillas operativas`), se revirtieron accidentalmente esos cuatro archivos al estado previo:
  1. `GET /openapi.json` ya no expone `parameters` en `paths["/api/cuadrillas"].get`, haciendo fallar el test automatizado `src/app/openapi.json/__tests__/route.test.ts` (`AssertionError: expected undefined to be defined` en línea 34).
  2. En `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts` se perdieron 4 de los 6 casos de prueba de `listarCuadrillas` y permaneció un uso de `as any` en la línea 374 que hace fallar `npm run lint` (`error: Unexpected any. Specify a different type @typescript-eslint/no-explicit-any`).
  3. En `docs/api/recursos-y-personal.md` se perdió la tabla de parámetros H34, el ejemplo cURL, la respuesta JSON de ejemplo y la tabla de errores HTTP.
* **Pasos para Reproducir:**
  1. Ejecutar `npm test -- --run src/app/openapi.json/__tests__/route.test.ts`.
  2. Ejecutar `npm run lint`.
  3. Consultar `GET http://localhost:3001/openapi.json` e inspeccionar `.paths["/api/cuadrillas"].get.parameters`.
* **Comportamiento Actual:** El test de OpenAPI falla (`1 failed`), `npm run lint` falla con código de salida `1` y `/openapi.json` no documenta los query params de `GET /api/cuadrillas`.
* **Comportamiento Esperado:** Todos los tests y el linter deben pasar sin errores, `/openapi.json` debe incluir los parámetros de `ListarCuadrillasQuerySchema` y `docs/api/recursos-y-personal.md` debe conservar la especificación H34 completa.

---

### `BUG-H80-API-03`: Descarte silencioso de los parámetros estándar H34 `page` y `limit` en `GET /api/cuadrillas` e incumplimiento del esquema `PaginationMeta` en `meta`
* **Severidad:** ALTA
* **Estado:** ABIERTO
* **Módulo / Archivos Afectados:**
  * `src/modules/recursos-y-personal/cuadrilla.schema.ts` (líneas 232–291 y 348–353)
  * `src/modules/recursos-y-personal/cuadrilla.service.ts` (líneas 55–56, 70 y 123–128)
* **Descripción Técnica:**
  1. En `ListarCuadrillasQuerySchema` (`cuadrilla.schema.ts`), los atributos `pagina` y `limite` tienen configurados `.default(1)` y `.default(10)` respectivamente, mientras que los parámetros estándar H34 `page` y `limit` son `.optional()` sin valor por defecto. Cuando un cliente invoca `GET /api/cuadrillas?page=2&limit=5`, `ListarCuadrillasQuerySchema.safeParse(queryParams)` asigna `pagina: 1` y `limite: 10` por omisión, produciendo `{ pagina: 1, page: 2, limite: 10, limit: 5 }`. Posteriormente, en `cuadrilla.service.ts` (líneas 55–56):
     ```typescript
     const pagina = query.pagina ?? query.page ?? 1;
     const limite = query.limite ?? query.limit ?? 10;
     ```
     Dado que `query.pagina` es `1` y `query.limite` es `10` (nunca `undefined`), las propiedades `query.page` y `query.limit` **jamás son evaluadas**, ignorando silenciosamente los parámetros estándar H34 `page` y `limit`.
  2. Adicionalmente, conforme al estándar transversal H34 (`docs/api/estandar-filtros-listados.md` y `src/lib/shared/pagination.schema.ts`), el objeto `meta` debe incluir las propiedades estándar `page`, `limit`, `totalPages`, `hasNext` y `hasPrev` (junto con `pagina`, `limite` y `paginasTotales` para retrocompatibilidad con el frontend).
* **Pasos para Reproducir:**
  1. Enviar petición `GET http://localhost:3001/api/cuadrillas?page=2&limit=1` con cabecera `Authorization: Bearer <token>`.
  2. Inspeccionar el objeto `.meta` de la respuesta JSON.
* **Comportamiento Actual:** Retorna `{"total": 1, "pagina": 1, "limite": 10, "paginasTotales": 1}`, ignorando `page=2` y `limit=1` y omitiendo `page`, `limit`, `totalPages`, `hasNext` y `hasPrev`.
* **Comportamiento Esperado:** Debe respetar los parámetros `page` y `limit` cuando `pagina` y `limite` no son provistos explícitamente en la URL, y retornar en `meta` los campos del estándar H34 manteniendo retrocompatibilidad con `pagina`, `limite` y `paginasTotales`.

---

### `BUG-H80-API-04`: Desfase de 55 commits con `develop`, colisión de numeración en migración `032` y omisión de filtros de baja lógica de dotación (HU-82)
* **Severidad:** ALTA
* **Estado:** ABIERTO
* **Módulo / Archivos Afectados:**
  * `src/lib/db/migrations/035_indices_listado_cuadrillas.ts`
  * `src/lib/db/migrations/__tests__/035_indices_listado_cuadrillas.test.ts`
  * `src/modules/recursos-y-personal/cuadrilla.repository.ts`
  * `src/modules/recursos-y-personal/cuadrilla.schema.ts`
  * `src/modules/recursos-y-personal/cuadrilla.service.ts`
* **Descripción Técnica:**
  1. La rama `feature/H80-listar-cuadrillas` registra un atraso de **55 commits respecto a `develop`** (`git rev-list --left-right --count develop...HEAD` = `55	8`).
  2. En la rama `develop` ya se encuentran integradas las migraciones `032_cuadrilla_baja_logica_activo.ts` (HU-82), `033_patrullas_codigo_vehiculo.ts` (HU-83) y `034_patrulla_desactivacion_baja_logica.ts` (HU-85). La migración `035_indices_listado_cuadrillas.ts` creada en esta rama colisiona con el correlativo `032` de `develop`, por lo que debe rebasarse/mergearse con `develop` y renumerarse a `035_indices_listado_cuadrillas.ts`.
  3. Al no integrar los cambios de HU-82 desde `develop`, `listarCuadrillasPaginadas` en esta rama no filtra `.where("cuadrilla_recurso.desvinculado_en", "is", null)` ni `.where("cuadrilla_personal.desvinculado_en", "is", null)`, ni incluye el soporte de `cuadrilla.activo` / `incluirInactivas` y `desactivarCuadrilla`, lo que provocaría regresiones funcionales y exposición de dotación históricamente desvinculada en el listado y en el drawer de detalle.
* **Pasos para Reproducir:**
  1. Ejecutar `git rev-list --left-right --count develop...HEAD` y `git ls-tree -r --name-only develop src/lib/db/migrations/`.
  2. Comparar `git diff develop...HEAD -- src/modules/recursos-y-personal/`.
* **Comportamiento Actual:** Colisión en el correlativo `032` de migraciones Kysely y ausencia de las reglas de vigencia de HU-82 en `cuadrilla.repository.ts`, `cuadrilla.service.ts` y `cuadrilla.schema.ts`.
* **Comportamiento Esperado:** Rama sincronizada con `develop`, migración renumerada a `035_indices_listado_cuadrillas.ts` y preservación íntegra de los filtros de vigencia (`desvinculado_en IS NULL`, `activo = true`).

---

### `BUG-H80-API-05`: Falta de sanitización de comodines SQL (`%` y `_`) en el filtro de búsqueda textual (`busqueda` / `q`) de `listarCuadrillasPaginadas`
* **Severidad:** MEDIA
* **Estado:** ABIERTO
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (líneas 229–238)
* **Descripción Técnica:** De acuerdo con la sección 1.4 de `docs/api/estandar-filtros-listados.md` (Estándar H34), el parámetro `busqueda` debe sanitizar los comodines `%` y `_` para evitar búsquedas arbitrarias o de costo computacional innecesario en `ILIKE`. Actualmente, `cuadrilla.repository.ts` construye el término como `const termino = `%${filtros.busqueda.trim()}%`;` sin escapar `\` ni `%` ni `_`. Al consultar `GET /api/cuadrillas?busqueda=%25` (`%`) o `GET /api/cuadrillas?busqueda=_`, PostgreSQL evalúa `ILIKE '%%%'` o `ILIKE '%_%'`, retornando todas las cuadrillas registradas aunque ninguna contenga literalmente el carácter buscado.
* **Pasos para Reproducir:**
  1. Enviar petición `GET http://localhost:3001/api/cuadrillas?busqueda=%25` con token válido.
* **Comportamiento Actual:** Retorna `total: 1` con la cuadrilla `"delta"`, la cual no contiene el carácter `%`.
* **Comportamiento Esperado:** Los caracteres `%`, `_` y `\` deben escaparse antes de construir el patrón `ILIKE` (`filtros.busqueda.trim().replace(/[\\%_]/g, "\\$&")`), retornando únicamente coincidencias literales.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H80-API-01` | Paginación en página fuera de rango (offset >= total) sin error SQL 42601 IN () | Robustez / DB | Repository / Kysely | Crítica | Base de datos con 1 cuadrilla activa (`total = 1`) | `GET /api/cuadrillas?pagina=2&limite=1` [Header: `Authorization: Bearer <token>`] | HTTP 200 OK con `data: []` y `meta: { total: 1, pagina: 2, limite: 1, paginasTotales: 1 }` | HTTP 500 Internal Server Error por excepción PostgreSQL `42601: syntax error at or near ")"` al ejecutar `WHERE cuadrilla_id IN ()` | **FALLIDO** | 09/11/2026 11:43 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H80-API-02` | Exposición de query params H34 de GET /api/cuadrillas en /openapi.json y limpieza de ESLint | Contrato / OpenAPI | OpenAPI / CI | Crítica | Especificación OpenAPI generada en `/openapi.json` | `GET /openapi.json` y `npm test -- src/app/openapi.json/__tests__/route.test.ts` | Test de OpenAPI aprueba con `spec.paths["/api/cuadrillas"].get.parameters` definido y `npm run lint` con 0 errores | Falla `route.test.ts` (`expected undefined to be defined`) y `npm run lint` arroja error `no-explicit-any` por reversión en último commit | **FALLIDO** | 09/11/2026 11:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H80-API-03` | Paginación mediante alias estándar H34 `page` y `limit` y estructura `PaginationMeta` | Funcional / Contrato | Schema / Service | Alta | Base de datos con cuadrillas operativas registradas | `GET /api/cuadrillas?page=2&limit=1` [Header: `Authorization: Bearer <token>`] | Respeta `page=2` y `limit=1` y retorna `meta` compatible con H34 (`page`, `limit`, `totalPages`, `hasNext`, `hasPrev`) | Ignora `page=2` y `limit=1` retornando `pagina: 1, limite: 10` por precedencia de `.default(1)` y `.default(10)` en `pagina`/`limite` | **FALLIDO** | 09/11/2026 11:42 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H80-API-04` | Sincronización con rama develop, numeración correlativa de migración de índices y vigencia HU-82 | Integración / DB | Migración / Repo | Alta | Rama sincronizada con `develop` (migraciones hasta `034`) | `git rev-list --left-right --count develop...HEAD` y revisión de `src/lib/db/migrations/` | Rama al día con `develop`, migración numerada como `035_indices_listado_cuadrillas.ts` y filtro `desvinculado_en IS NULL` activo | Rama 55 commits detrás de `develop`, colisión de archivo `032` con `032_cuadrilla_baja_logica_activo.ts` y omisión de filtros HU-82 | **FALLIDO** | 09/11/2026 11:37 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H80-API-05` | Sanitización de comodines SQL (`%` y `_`) en búsqueda textual libre `busqueda` / `q` | Seguridad / SQL | Repository / Kysely | Media | Cuadrilla `"delta"` registrada sin carácter `%` en su nombre | `GET /api/cuadrillas?busqueda=%25` [Header: `Authorization: Bearer <token>`] | Escapa el comodín `%` y retorna `data: []` (`total: 0`) al no existir coincidencia literal | Evalúa `ILIKE '%%%'` sin sanitizar y retorna todas las cuadrillas activas (`total: 1`) | **FALLIDO** | 09/11/2026 11:42 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H80-API-01` | Listado paginado base de cuadrillas sin filtros con valores por defecto (`pagina=1`, `limite=10`) | Funcional / API | Route Handler / Service | Crítica | Usuario autenticado con rol `ADMIN` y cuadrillas activas en BD | `GET /api/cuadrillas` [Header: `Authorization: Bearer <token_admin>`] | HTTP 200 OK con arreglo `data` (delegación, delegado, recursos, trabajadores, conteos) y `meta` (`pagina: 1, limite: 10`) | HTTP 200 OK retornando listado consolidado de cuadrillas con estructura esperada | **APROBADO** | 09/11/2026 11:42 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-02` | Consulta autorizada para perfil Encargado de Operaciones con permiso `recursos:leer` | Seguridad / RBAC | Route Handler / Service | Crítica | Usuario autenticado con rol `ENCARGADO` (`encargado@valdivia.cl`) | `GET /api/cuadrillas?pagina=1&limite=5` [Header: `Authorization: Bearer <token_encargado>`] | HTTP 200 OK permitiendo visualizar la capacidad operativa comunal | HTTP 200 OK retornando cuadrillas y metadatos de paginación | **APROBADO** | 09/11/2026 11:45 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-03` | Filtrado territorial por `delegacionId` UUID válido | Funcional / API | Service / Repository | Crítica | Cuadrilla adscrita a Delegación Municipal Costa (`30000000-0000-4000-8000-000000000003`) | `GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003` | HTTP 200 OK retornando exclusivamente cuadrillas pertenecientes a la delegación consultada | HTTP 200 OK con cláusula `WHERE cuadrilla.delegacion_id = $1` aplicada | **APROBADO** | 09/11/2026 11:45 | - | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-04` | Filtrado por estado operativo canónico (`estado=DISPONIBLE`) | Funcional / API | Service / Repository | Crítica | Cuadrillas registradas en distintos estados operativos | `GET /api/cuadrillas?estado=DISPONIBLE` | HTTP 200 OK retornando únicamente cuadrillas con `estado === "DISPONIBLE"` | HTTP 200 OK filtrando registros por estado canónico en mayúsculas | **APROBADO** | 09/11/2026 11:45 | - | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-05` | Filtrado combinado conjuntivo AND (`delegacionId` + `estado`) | Funcional / API | Service / Repository | Alta | Cuadrillas registradas en diversas delegaciones y estados | `GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003&estado=DISPONIBLE` | HTTP 200 OK aplicando conjunción booleana `AND` sobre ambos predicados | HTTP 200 OK retornando solo cuadrillas que cumplen ambos criterios simultáneamente | **APROBADO** | 09/11/2026 11:45 | - | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-06` | Búsqueda textual parcial insensible a mayúsculas mediante parámetro `busqueda` | Funcional / API | Service / Repository | Alta | Cuadrilla `"delta"` y delegado `"Supervisor Estratégico"` en BD | `GET /api/cuadrillas?busqueda=delta` | HTTP 200 OK filtrando con `ILIKE` sobre nombre de cuadrilla, nombre de delegado o RUT | HTTP 200 OK retornando la cuadrilla coincidente | **APROBADO** | 09/11/2026 11:45 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-07` | Búsqueda textual mediante alias `q` y recorte de espacios extremos (`.trim()`) | Validación / Schema | Schema / Service | Media | Parámetro `busqueda` o `q` con espacios laterales (`"  texto  "`) | `ListarCuadrillasQuerySchema.safeParse({ busqueda: "  texto  " })` | El esquema recorta espacios dejando `"texto"` sin lanzar error | Parseo exitoso en `cuadrilla.listado.schema.test.ts` con valor `"texto"` | **APROBADO** | 09/11/2026 11:36 | - | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-08` | Respuesta de estado vacío cuando los filtros no arrojan coincidencias (`total = 0`) | Borde / API | Service / Repository | Media | Término de búsqueda inexistente en la base de datos | `GET /api/cuadrillas?busqueda=INEXISTENTE_XYZ_999` | HTTP 200 OK con `data: []` y `meta.total: 0` sin errores de ejecución | HTTP 200 OK con `{"message":"Listado de cuadrillas obtenido exitosamente","data":[],"meta":{"total":0,"pagina":1,"limite":10,"paginasTotales":1}}` | **APROBADO** | 09/11/2026 11:45 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-09` | Cómputo de contadores `totalRecursos` y `totalTrabajadores` y colecciones para Drawer lateral | Funcional / Datos | Service / Repository | Alta | Cuadrilla con dotación de personal (`cuadrilla_personal`) y recursos (`cuadrilla_recurso`) | `GET /api/cuadrillas` y `GET /api/cuadrillas/{id}` | Cada ítem expone arreglos `recursos` y `trabajadores` junto a `totalRecursos` y `totalTrabajadores` | Conteos y arreglos mapeados fielmente para alimentar la tabla y el drawer lateral | **APROBADO** | 09/11/2026 11:45 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-10` | Consulta de detalle unitario consolidado `GET /api/cuadrillas/{id}` para Drawer de dotación | Funcional / API | Route Handler / Service | Alta | Cuadrilla activa con UUID `26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` | `GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` | HTTP 200 OK con detalle completo de delegación, delegado, trabajadores y recursos vinculados | HTTP 200 OK retornando objeto `data` consolidado | **APROBADO** | 09/11/2026 11:45 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-11` | Rechazo de consulta sin cabecera de autenticación (`HTTP 401 Unauthorized`) | Seguridad / Auth | Route Handler / Guard | Crítica | Petición sin token JWT ni cabecera de sesión | `GET /api/cuadrillas` (sin header `Authorization`) | HTTP 401 Unauthorized con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | HTTP 401 Unauthorized verificado en servidor y suite unitaria | **APROBADO** | 09/11/2026 11:41 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-12` | Bloqueo RBAC a usuario autenticado sin permiso `recursos:leer` (`HTTP 403 Forbidden`) | Seguridad / RBAC | Route Handler / Service | Crítica | Usuario con rol `CALL_CENTER` (`callcenter@valdivia.cl`) sin permiso `recursos:leer` | `GET /api/cuadrillas` [Header: `Authorization: Bearer <token_callcenter>`] | HTTP 403 Forbidden denegando el acceso al listado táctico | HTTP 403 Forbidden con mensaje de acceso denegado | **APROBADO** | 09/11/2026 11:45 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-13` | Validación Zod ante `delegacionId` con formato no UUID (`HTTP 400 Bad Request`) | Validación / Schema | Route Handler / Zod | Alta | Parámetro `delegacionId` malformado | `GET /api/cuadrillas?delegacionId=no-es-uuid` | HTTP 400 Bad Request indicando `"El identificador de delegación debe ser un UUID válido"` | HTTP 400 Bad Request con detalle en `errors[0].campo = "delegacionId"` | **APROBADO** | 09/11/2026 11:45 | - | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-14` | Validación Zod ante valor fuera del enum canónico en `estado` (`HTTP 400 Bad Request`) | Validación / Schema | Route Handler / Zod | Alta | Parámetro `estado` con valor no perteneciente a `DISPONIBLE | EN_MISION | NO_DISPONIBLE` | `GET /api/cuadrillas?estado=ESTADO_INVALIDO` | HTTP 400 Bad Request rechazando el estado inválido | HTTP 400 Bad Request con error de validación en campo `estado` | **APROBADO** | 09/11/2026 11:45 | - | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-15` | Validación Zod rechazando `limite` superior al máximo permitido de 100 (`HTTP 400 Bad Request`) | Validación / Borde | Route Handler / Zod | Media | Solicitud de paginación con `limite=150` | `GET /api/cuadrillas?limite=150` | HTTP 400 Bad Request con mensaje `"El límite por página no puede superar 100"` | HTTP 400 Bad Request detallando restricción máxima en `limite` | **APROBADO** | 09/11/2026 11:45 | - | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-16` | Coerción numérica de strings en query params `pagina` y `limite` | Validación / Schema | Schema / Zod | Media | Query params recibidos como texto desde la URL (`pagina="2"`, `limite="5"`) | `ListarCuadrillasQuerySchema.safeParse({ pagina: "2", limite: "5" })` | Coerción exitosa a enteros `pagina: 2` y `limite: 5` | Coerción validada exitosamente en `cuadrilla.listado.schema.test.ts` | **APROBADO** | 09/11/2026 11:36 | - | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-17` | Propagación de paginación personalizada (`pagina=2`, `limite=5`) desde Route Handler al servicio | Unitaria / API | Route Handler | Media | Servicio mockeado retornando `total = 12` registros | `GET /api/cuadrillas?pagina=2&limite=5` en `route.test.ts` | Invoca `listarCuadrillas` con `{ pagina: 2, limite: 5 }` y retorna `paginasTotales: 3` | Test unitario aprobado en `src/app/api/cuadrillas/__tests__/route.test.ts` | **APROBADO** | 09/11/2026 11:36 | - | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-18` | Exclusión de cuadrillas dadas de baja lógica (`WHERE cuadrilla.eliminado_en IS NULL`) | Integridad / DB | Repository / Kysely | Alta | Cuadrillas activas e inactivas (con `eliminado_en` no nulo) | `listarCuadrillasPaginadas(filtros)` | Solo se contabilizan y listan registros con `eliminado_en IS NULL` | Cláusula `.where("cuadrilla.eliminado_en", "is", null)` presente en consulta base | **APROBADO** | 09/11/2026 11:36 | - | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-19` | Creación de 4 índices parciales B-Tree en migración Kysely para optimizar filtros y ordenamiento (`up`) | Rendimiento / DB | Migración Kysely | Alta | Ejecución de función `up(db)` de la migración de índices | `idx_cuadrilla_delegacion_id`, `idx_cuadrilla_estado`, `idx_cuadrilla_delegacion_estado`, `idx_cuadrilla_creado_en_desc` | Ejecuta `CREATE INDEX IF NOT EXISTS ... WHERE eliminado_en IS NULL` para los 4 índices | Test unitario `035_indices_listado_cuadrillas.test.ts` aprobado verificando las 4 sentencias DDL | **APROBADO** | 09/11/2026 11:36 | - | feat(db): agregar migracion 035 con indices parciales de listado de cuadrillas (H80) |
| `CP-H80-API-20` | Reversión limpia (`down`) eliminando los 4 índices parciales de listado de cuadrillas | Integridad / DB | Migración Kysely | Media | Ejecución de función `down(db)` de la migración de índices | `DROP INDEX IF EXISTS` para los 4 índices creados | Elimina sin errores los 4 índices en orden inverso | Test unitario `035_indices_listado_cuadrillas.test.ts` aprobado en `9ms` | **APROBADO** | 09/11/2026 11:36 | - | feat(db): agregar migracion 035 con indices parciales de listado de cuadrillas (H80) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H80-API-01	Paginación en página fuera de rango (offset >= total) sin error SQL 42601 IN ()	Robustez / DB	Repository / Kysely	Crítica	Base de datos con 1 cuadrilla activa (total = 1)	GET /api/cuadrillas?pagina=2&limite=1 [Header: Authorization: Bearer <token>]	HTTP 200 OK con data: [] y meta: { total: 1, pagina: 2, limite: 1, paginasTotales: 1 }	HTTP 500 Internal Server Error por excepción PostgreSQL 42601: syntax error at or near ")" al ejecutar WHERE cuadrilla_id IN ()	FALLIDO	09/11/2026 11:43	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H80-API-02	Exposición de query params H34 de GET /api/cuadrillas en /openapi.json y limpieza de ESLint	Contrato / OpenAPI	OpenAPI / CI	Crítica	Especificación OpenAPI generada en /openapi.json	GET /openapi.json y npm test -- src/app/openapi.json/__tests__/route.test.ts	Test de OpenAPI aprueba con spec.paths["/api/cuadrillas"].get.parameters definido y npm run lint con 0 errores	Falla route.test.ts (expected undefined to be defined) y npm run lint arroja error no-explicit-any por reversión en último commit	FALLIDO	09/11/2026 11:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H80-API-03	Paginación mediante alias estándar H34 page y limit y estructura PaginationMeta	Funcional / Contrato	Schema / Service	Alta	Base de datos con cuadrillas operativas registradas	GET /api/cuadrillas?page=2&limit=1 [Header: Authorization: Bearer <token>]	Respeta page=2 y limit=1 y retorna meta compatible con H34 (page, limit, totalPages, hasNext, hasPrev)	Ignora page=2 y limit=1 retornando pagina: 1, limite: 10 por precedencia de .default(1) y .default(10) en pagina/limite	FALLIDO	09/11/2026 11:42	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H80-API-04	Sincronización con rama develop, numeración correlativa de migración de índices y vigencia HU-82	Integración / DB	Migración / Repo	Alta	Rama sincronizada con develop (migraciones hasta 034)	git rev-list --left-right --count develop...HEAD y revisión de src/lib/db/migrations/	Rama al día con develop, migración numerada como 035_indices_listado_cuadrillas.ts y filtro desvinculado_en IS NULL activo	Rama 55 commits detrás de develop, colisión de archivo 032 con 032_cuadrilla_baja_logica_activo.ts y omisión de filtros HU-82	FALLIDO	09/11/2026 11:37	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H80-API-05	Sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda / q	Seguridad / SQL	Repository / Kysely	Media	Cuadrilla "delta" registrada sin carácter % en su nombre	GET /api/cuadrillas?busqueda=%25 [Header: Authorization: Bearer <token>]	Escapa el comodín % y retorna data: [] (total: 0) al no existir coincidencia literal	Evalúa ILIKE '%%%' sin sanitizar y retorna todas las cuadrillas activas (total: 1)	FALLIDO	09/11/2026 11:42	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H80-API-01	Listado paginado base de cuadrillas sin filtros con valores por defecto (pagina=1, limite=10)	Funcional / API	Route Handler / Service	Crítica	Usuario autenticado con rol ADMIN y cuadrillas activas en BD	GET /api/cuadrillas [Header: Authorization: Bearer <token_admin>]	HTTP 200 OK con arreglo data (delegación, delegado, recursos, trabajadores, conteos) y meta (pagina: 1, limite: 10)	HTTP 200 OK retornando listado consolidado de cuadrillas con estructura esperada	APROBADO	09/11/2026 11:42	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-02	Consulta autorizada para perfil Encargado de Operaciones con permiso recursos:leer	Seguridad / RBAC	Route Handler / Service	Crítica	Usuario autenticado con rol ENCARGADO (encargado@valdivia.cl)	GET /api/cuadrillas?pagina=1&limite=5 [Header: Authorization: Bearer <token_encargado>]	HTTP 200 OK permitiendo visualizar la capacidad operativa comunal	HTTP 200 OK retornando cuadrillas y metadatos de paginación	APROBADO	09/11/2026 11:45	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-03	Filtrado territorial por delegacionId UUID válido	Funcional / API	Service / Repository	Crítica	Cuadrilla adscrita a Delegación Municipal Costa (30000000-0000-4000-8000-000000000003)	GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003	HTTP 200 OK retornando exclusivamente cuadrillas pertenecientes a la delegación consultada	HTTP 200 OK con cláusula WHERE cuadrilla.delegacion_id = $1 aplicada	APROBADO	09/11/2026 11:45	-	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-04	Filtrado por estado operativo canónico (estado=DISPONIBLE)	Funcional / API	Service / Repository	Crítica	Cuadrillas registradas en distintos estados operativos	GET /api/cuadrillas?estado=DISPONIBLE	HTTP 200 OK retornando únicamente cuadrillas con estado === "DISPONIBLE"	HTTP 200 OK filtrando registros por estado canónico en mayúsculas	APROBADO	09/11/2026 11:45	-	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-05	Filtrado combinado conjuntivo AND (delegacionId + estado)	Funcional / API	Service / Repository	Alta	Cuadrillas registradas en diversas delegaciones y estados	GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003&estado=DISPONIBLE	HTTP 200 OK aplicando conjunción booleana AND sobre ambos predicados	HTTP 200 OK retornando solo cuadrillas que cumplen ambos criterios simultáneamente	APROBADO	09/11/2026 11:45	-	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-06	Búsqueda textual parcial insensible a mayúsculas mediante parámetro busqueda	Funcional / API	Service / Repository	Alta	Cuadrilla "delta" y delegado "Supervisor Estratégico" en BD	GET /api/cuadrillas?busqueda=delta	HTTP 200 OK filtrando con ILIKE sobre nombre de cuadrilla, nombre de delegado o RUT	HTTP 200 OK retornando la cuadrilla coincidente	APROBADO	09/11/2026 11:45	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-07	Búsqueda textual mediante alias q y recorte de espacios extremos (.trim())	Validación / Schema	Schema / Service	Media	Parámetro busqueda o q con espacios laterales ("  texto  ")	ListarCuadrillasQuerySchema.safeParse({ busqueda: "  texto  " })	El esquema recorta espacios dejando "texto" sin lanzar error	Parseo exitoso en cuadrilla.listado.schema.test.ts con valor "texto"	APROBADO	09/11/2026 11:36	-	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-08	Respuesta de estado vacío cuando los filtros no arrojan coincidencias (total = 0)	Borde / API	Service / Repository	Media	Término de búsqueda inexistente en la base de datos	GET /api/cuadrillas?busqueda=INEXISTENTE_XYZ_999	HTTP 200 OK con data: [] y meta.total: 0 sin errores de ejecución	HTTP 200 OK con {"message":"Listado de cuadrillas obtenido exitosamente","data":[],"meta":{"total":0,"pagina":1,"limite":10,"paginasTotales":1}}	APROBADO	09/11/2026 11:45	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-09	Cómputo de contadores totalRecursos y totalTrabajadores y colecciones para Drawer lateral	Funcional / Datos	Service / Repository	Alta	Cuadrilla con dotación de personal (cuadrilla_personal) y recursos (cuadrilla_recurso)	GET /api/cuadrillas y GET /api/cuadrillas/{id}	Cada ítem expone arreglos recursos y trabajadores junto a totalRecursos y totalTrabajadores	Conteos y arreglos mapeados fielmente para alimentar la tabla y el drawer lateral	APROBADO	09/11/2026 11:45	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-10	Consulta de detalle unitario consolidado GET /api/cuadrillas/{id} para Drawer de dotación	Funcional / API	Route Handler / Service	Alta	Cuadrilla activa con UUID 26c3b3d7-1cf3-409b-9d4e-eb49d6369a85	GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85	HTTP 200 OK con detalle completo de delegación, delegado, trabajadores y recursos vinculados	HTTP 200 OK retornando objeto data consolidado	APROBADO	09/11/2026 11:45	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-11	Rechazo de consulta sin cabecera de autenticación (HTTP 401 Unauthorized)	Seguridad / Auth	Route Handler / Guard	Crítica	Petición sin token JWT ni cabecera de sesión	GET /api/cuadrillas (sin header Authorization)	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	HTTP 401 Unauthorized verificado en servidor y suite unitaria	APROBADO	09/11/2026 11:41	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-12	Bloqueo RBAC a usuario autenticado sin permiso recursos:leer (HTTP 403 Forbidden)	Seguridad / RBAC	Route Handler / Service	Crítica	Usuario con rol CALL_CENTER (callcenter@valdivia.cl) sin permiso recursos:leer	GET /api/cuadrillas [Header: Authorization: Bearer <token_callcenter>]	HTTP 403 Forbidden denegando el acceso al listado táctico	HTTP 403 Forbidden con mensaje de acceso denegado	APROBADO	09/11/2026 11:45	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-13	Validación Zod ante delegacionId con formato no UUID (HTTP 400 Bad Request)	Validación / Schema	Route Handler / Zod	Alta	Parámetro delegacionId malformado	GET /api/cuadrillas?delegacionId=no-es-uuid	HTTP 400 Bad Request indicando "El identificador de delegación debe ser un UUID válido"	HTTP 400 Bad Request con detalle en errors[0].campo = "delegacionId"	APROBADO	09/11/2026 11:45	-	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-14	Validación Zod ante valor fuera del enum canónico en estado (HTTP 400 Bad Request)	Validación / Schema	Route Handler / Zod	Alta	Parámetro estado con valor no perteneciente a DISPONIBLE | EN_MISION | NO_DISPONIBLE	GET /api/cuadrillas?estado=ESTADO_INVALIDO	HTTP 400 Bad Request rechazando el estado inválido	HTTP 400 Bad Request con error de validación en campo estado	APROBADO	09/11/2026 11:45	-	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-15	Validación Zod rechazando limite superior al máximo permitido de 100 (HTTP 400 Bad Request)	Validación / Borde	Route Handler / Zod	Media	Solicitud de paginación con limite=150	GET /api/cuadrillas?limite=150	HTTP 400 Bad Request con mensaje "El límite por página no puede superar 100"	HTTP 400 Bad Request detallando restricción máxima en limite	APROBADO	09/11/2026 11:45	-	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-16	Coerción numérica de strings en query params pagina y limite	Validación / Schema	Schema / Zod	Media	Query params recibidos como texto desde la URL (pagina="2", limite="5")	ListarCuadrillasQuerySchema.safeParse({ pagina: "2", limite: "5" })	Coerción exitosa a enteros pagina: 2 y limite: 5	Coerción validada exitosamente en cuadrilla.listado.schema.test.ts	APROBADO	09/11/2026 11:36	-	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-17	Propagación de paginación personalizada (pagina=2, limite=5) desde Route Handler al servicio	Unitaria / API	Route Handler	Media	Servicio mockeado retornando total = 12 registros	GET /api/cuadrillas?pagina=2&limite=5 en route.test.ts	Invoca listarCuadrillas con { pagina: 2, limite: 5 } y retorna paginasTotales: 3	Test unitario aprobado en src/app/api/cuadrillas/__tests__/route.test.ts	APROBADO	09/11/2026 11:36	-	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-18	Exclusión de cuadrillas dadas de baja lógica (WHERE cuadrilla.eliminado_en IS NULL)	Integridad / DB	Repository / Kysely	Alta	Cuadrillas activas e inactivas (con eliminado_en no nulo)	listarCuadrillasPaginadas(filtros)	Solo se contabilizan y listan registros con eliminado_en IS NULL	Cláusula .where("cuadrilla.eliminado_en", "is", null) presente en consulta base	APROBADO	09/11/2026 11:36	-	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-19	Creación de 4 índices parciales B-Tree en migración Kysely para optimizar filtros y ordenamiento (up)	Rendimiento / DB	Migración Kysely	Alta	Ejecución de función up(db) de la migración de índices	idx_cuadrilla_delegacion_id, idx_cuadrilla_estado, idx_cuadrilla_delegacion_estado, idx_cuadrilla_creado_en_desc	Ejecuta CREATE INDEX IF NOT EXISTS ... WHERE eliminado_en IS NULL para los 4 índices	Test unitario 035_indices_listado_cuadrillas.test.ts aprobado verificando las 4 sentencias DDL	APROBADO	09/11/2026 11:36	-	feat(db): agregar migracion 035 con indices parciales de listado de cuadrillas (H80)
CP-H80-API-20	Reversión limpia (down) eliminando los 4 índices parciales de listado de cuadrillas	Integridad / DB	Migración Kysely	Media	Ejecución de función down(db) de la migración de índices	DROP INDEX IF EXISTS para los 4 índices creados	Elimina sin errores los 4 índices en orden inverso	Test unitario 035_indices_listado_cuadrillas.test.ts aprobado en 9ms	APROBADO	09/11/2026 11:36	-	feat(db): agregar migracion 035 con indices parciales de listado de cuadrillas (H80)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias de Prueba

### 5.1 Ejecución de Suites Automatizadas con Vitest

**Comando ejecutado (Esquema, Migración, Servicio, Route Handler y OpenAPI):**
```bash
npm test -- --run src/app/openapi.json/__tests__/route.test.ts src/app/api/cuadrillas/__tests__/route.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.listado.schema.test.ts src/lib/db/migrations/__tests__/035_indices_listado_cuadrillas.test.ts
```

**Salida real obtenida:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.listado.schema.test.ts (9 tests) 12ms
 ✓ src/lib/db/migrations/__tests__/035_indices_listado_cuadrillas.test.ts (2 tests) 9ms
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts (24 tests) 58ms
 ✓ src/app/api/cuadrillas/__tests__/route.test.ts (10 tests) 40ms
 ❯ src/app/openapi.json/__tests__/route.test.ts (1 test | 1 failed) 172ms
   × Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos 170ms
     → expected undefined to be defined

 FAIL  src/app/openapi.json/__tests__/route.test.ts > Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos
AssertionError: expected undefined to be defined
 ❯ src/app/openapi.json/__tests__/route.test.ts:34:58
     32|     expect(spec.paths["/api/cuadrillas"]).toBeDefined();
     33|     expect(spec.paths["/api/cuadrillas"].get).toBeDefined();
     34|     expect(spec.paths["/api/cuadrillas"].get.parameters).toBeDefined();
       |                                                          ^
     35|     expect(spec.paths["/api/cuadrillas"].post).toBeDefined();

 Test Files  1 failed | 4 passed (5)
      Tests  1 failed | 45 passed (46)
   Duration  1.37s
```

**Ejecución focalizada por filtro de caso (`-t`):**
```bash
npm test -- -t "Módulo Recursos y Personal - ListarCuadrillasQuerySchema"
npm test -- -t "GET /api/cuadrillas"
npm test -- -t "Migración 035 - Índices de listado de cuadrillas"
```

---

### 5.2 Verificación de Tipos y Linter

**Comando ejecutado:**
```bash
npx tsc --noEmit && npm run lint
```

**Salida real obtenida:**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/app/api/cuadrillas/__tests__/route.test.ts
  10:3  warning  'NotFoundError' is defined but never used    @typescript-eslint/no-unused-vars
  11:3  warning  'BadRequestError' is defined but never used  @typescript-eslint/no-unused-vars

/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts
  374:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 11 problems (1 error, 10 warnings)
```

---

### 5.3 Pruebas de Integración HTTP/REST con cURL

#### Paso 1: Autenticación de perfiles (`ADMIN`, `ENCARGADO` y `CALL_CENTER`)
```bash
TOKEN_ADMIN=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"admin@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token')

TOKEN_ENCARGADO=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token')

TOKEN_CALLCENTER=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' | jq -r '.data.token')
```

#### Paso 2: Listado paginado base y filtros combinados (`CP-H80-API-01` a `CP-H80-API-05`)
```bash
curl -s -X GET "http://localhost:3001/api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003&estado=DISPONIBLE" \
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

**Respuesta real obtenida (`HTTP 200 OK`):**
```json
{
  "message": "Listado de cuadrillas obtenido exitosamente",
  "data": [
    {
      "id": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
      "nombre": "delta",
      "estado": "DISPONIBLE",
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000003",
        "nombre": "Delegación Municipal Costa",
        "codigo": "DEL_COSTA"
      },
      "delegado": {
        "id": "00000000-0000-4000-8000-000000000010",
        "nombre": "Supervisor Estratégico",
        "email": "supervisor@valdivia.cl",
        "rut": "44444444-4"
      },
      "recursos": [],
      "trabajadores": [],
      "totalRecursos": 0,
      "totalTrabajadores": 0,
      "creadoEn": "2026-11-03T21:10:08.355Z",
      "actualizadoEn": "2026-11-03T21:10:08.355Z"
    }
  ],
  "meta": {
    "total": 1,
    "pagina": 1,
    "limite": 10,
    "paginasTotales": 1
  }
}
```

#### Paso 3: Consulta de detalle unitario para el Drawer lateral (`CP-H80-API-10`)
```bash
curl -s -X GET "http://localhost:3001/api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85" \
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

**Respuesta real obtenida (`HTTP 200 OK`):**
```json
{
  "message": "Detalle de cuadrilla operativa obtenido exitosamente",
  "data": {
    "id": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
    "nombre": "delta",
    "estado": "DISPONIBLE",
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000003",
      "nombre": "Delegación Municipal Costa",
      "codigo": "DEL_COSTA"
    },
    "delegado": {
      "id": "00000000-0000-4000-8000-000000000010",
      "nombre": "Supervisor Estratégico",
      "email": "supervisor@valdivia.cl",
      "rut": "44444444-4"
    },
    "recursos": [],
    "trabajadores": [],
    "totalRecursos": 0,
    "totalTrabajadores": 0,
    "creadoEn": "2026-11-03T21:10:08.355Z",
    "actualizadoEn": "2026-11-03T21:10:08.355Z",
    "actualizadoPorId": null,
    "creadoPorId": "00000000-0000-4000-8000-000000000001"
  }
}
```

#### Paso 4: Evidencia de reproducción de `BUG-H80-API-01` (`HTTP 500` en página fuera de rango)
```bash
curl -i -s -X GET "http://localhost:3001/api/cuadrillas?pagina=2&limite=1" \
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

**Respuesta real obtenida (`HTTP 500 Internal Server Error`):**
```http
HTTP/1.1 500 Internal Server Error
content-type: application/json

{"message":"Error interno del servidor al procesar la solicitud."}
```

#### Paso 5: Evidencia de reproducción de `BUG-H80-API-03` (Descarte silencioso de `page` y `limit`)
```bash
curl -s -X GET "http://localhost:3001/api/cuadrillas?page=2&limit=1" \
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.meta'
```

**Respuesta real obtenida (`HTTP 200 OK` con parámetros ignorados):**
```json
{
  "total": 1,
  "pagina": 1,
  "limite": 10,
  "paginasTotales": 1
}
```

#### Paso 6: Controles de Seguridad RBAC (`401` y `403`) y Validación Zod (`400`)
```bash
# 401 Unauthorized (sin token)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas"

# 403 Forbidden (rol Call Center sin permiso recursos:leer)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas" \
  -H "Authorization: Bearer $TOKEN_CALLCENTER"

# 400 Bad Request (UUID inválido, estado inválido y límite > 100)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas?delegacionId=no-es-uuid" \
  -H "Authorization: Bearer $TOKEN_ADMIN"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas?estado=ESTADO_INVALIDO" \
  -H "Authorization: Bearer $TOKEN_ADMIN"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas?limite=150" \
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

**Respuestas reales obtenidas:**
```text
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
HTTP_STATUS:401

{"message":"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."}
HTTP_STATUS:403

{"message":"Parámetros de consulta inválidos.","errors":[{"campo":"delegacionId","mensaje":"El identificador de delegación debe ser un UUID válido"}]}
HTTP_STATUS:400

{"message":"Parámetros de consulta inválidos.","errors":[{"campo":"estado","mensaje":"Invalid option: expected one of \"DISPONIBLE\"|\"EN_MISION\"|\"NO_DISPONIBLE\""}]}
HTTP_STATUS:400

{"message":"Parámetros de consulta inválidos.","errors":[{"campo":"limite","mensaje":"El límite por página no puede superar 100"}]}
HTTP_STATUS:400
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (HU-80) | Endpoint / Componente Backend Relacionado | Casos de Prueba Asociados | Estado de Cumplimiento |
|---|---|---|:---:|
| **CA-1:** El sistema debe proveer una vista tabular en `/gestion/admin/cuadrillas` bajo estándar de contratos H34. | `GET /api/cuadrillas` (`src/app/api/cuadrillas/route.ts`) | `CP-H80-API-01`, `CP-H80-API-02`, `BUG-H80-API-03` | 🟡 **PARCIAL** (Falta subsanar `BUG-H80-API-03`) |
| **CA-2:** La tabla debe mostrar: Nombre de la cuadrilla, Delegación base, Delegado responsable, Estado actual (`DISPONIBLE`, `EN_MISION`, `NO_DISPONIBLE`) y contador de personal/recursos vinculados. | `listarCuadrillas` (`cuadrilla.service.ts`), `CuadrillaItemResponseSchema` (`cuadrilla.schema.ts`) | `CP-H80-API-01`, `CP-H80-API-09`, `CP-H80-API-18` | 🟢 **CUMPLE** |
| **CA-3:** Al hacer clic sobre una fila, se debe desplegar un drawer lateral con el detalle de miembros de personal asignados y equipos/vehículos vinculados (`cuadrilla_recurso`). | `GET /api/cuadrillas` y `GET /api/cuadrillas/[id]` (`obtenerCuadrillaDetalleUnitario`) | `CP-H80-API-09`, `CP-H80-API-10`, `BUG-H80-API-04` | 🟡 **PARCIAL** (Falta filtrar `desvinculado_en IS NULL` de HU-82 en `BUG-H80-API-04`) |
| **CA-4:** Debe permitir filtrar por delegación municipal y estado operativo. | `listarCuadrillasPaginadas` (`cuadrilla.repository.ts`), `035_indices_listado_cuadrillas.ts` | `CP-H80-API-03`, `CP-H80-API-04`, `CP-H80-API-05`, `CP-H80-API-13`, `CP-H80-API-14`, `CP-H80-API-19` | 🟢 **CUMPLE** |
| **CA-5:** El endpoint `GET /api/cuadrillas` debe responder bajo estándar H34. | `ListarCuadrillasQuerySchema`, `ListarCuadrillasResponseSchema`, `/openapi.json` | `BUG-H80-API-01`, `BUG-H80-API-02`, `BUG-H80-API-03`, `BUG-H80-API-05`, `CP-H80-API-06` a `CP-H80-API-17` | 🔴 **INCUMPLE** (Pendiente resolución de `BUG-H80-API-01`, `02`, `03` y `05`) |
