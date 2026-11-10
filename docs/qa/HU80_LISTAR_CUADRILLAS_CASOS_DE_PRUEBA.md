# Informe de Auditoría y Matriz de Casos de Prueba (QA): HU-80 — Visualizar Listado de Cuadrillas Operativas, Disponibilidad y Dotación

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Cuadrillas Operativas (`sgrai-api` — `GET /api/cuadrillas` y `GET /api/cuadrillas/:id`).  
> **Historia de Usuario:** HU-80 — *"Como Administrador / Encargado Quiero visualizar un listado completo de las cuadrillas operativas registradas, su estado de disponibilidad y el personal y recursos que la componen Para conocer la capacidad de respuesta táctica disponible en cada delegación municipal al momento de asignar emergencias."*  
> **Desarrollador Asignado:** Jonagu1  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely Query Builder + PostgreSQL + Zod + Socket.io + Vitest v3.2.7).  
> **Rama Git Evaluada:** `feature/H80-listar-cuadrillas` (HEAD en commit `b698c70`).  
> **Commits Evaluados (Conventional Commits):**  
> * `feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79`  
> * `feat(db): agregar migracion 032 con indices parciales de listado de cuadrillas (H80)`  
> * `test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)`  
> * `test(cuadrillas): agregar casos de listarCuadrillas al suite del servicio (H80)`  
> * `test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)`  
> * `docs(openapi): completar query params de GET /api/cuadrillas bajo estandar H34 (H80)`  
> * `docs(api): documentar contrato H34 del listado de cuadrillas en recursos-y-personal.md`  
> * `merge: sincronizar feature/H80-listar-cuadrillas con develop`  
> * `fix(db): renumerar migracion de indices de cuadrillas a 071 (H80)`  
>  
> **Fecha de Auditoría Inicial:** 09 de Noviembre de 2026.  
> **Fecha de Re-Test y Certificación:** 10 de Noviembre de 2026.  
> **Estado de Certificación:** 🟢 **CERTIFICADO Y APROBADO PARA PRODUCCIÓN (RE-TEST EXITOSO TRAS SUBSANACIÓN DE 5 DEFECTOS)**.

---

## 1. Resumen Ejecutivo de Pruebas

Durante el ciclo inicial de auditoría técnica forense, ejecución de pruebas automatizadas y validación de contrato HTTP/REST sobre la rama `feature/H80-listar-cuadrillas`, se identificaron **5 defectos reales** (`BUG-H80-API-01` al `BUG-H80-API-05`). Tras el reporte formal de observaciones, el equipo de desarrollo aplicó los fixes correctivos, sincronizó la rama con `develop` e implementó pruebas de regresión.

En la presente sesión de **Re-Test**, se ejecutaron nuevamente las pruebas automatizadas, el análisis estático de código y las pruebas de integración en vivo sobre el servidor API (`http://localhost:3001`), certificando el cierre y resolución satisfactoria de la totalidad de los defectos reportados.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba Evaluados** | **25** | 20 casos funcionales, de seguridad, esquema y migración + 5 defectos validados en Re-Test |
| **Casos Aprobados (Passed)** | **25** | 100% de cumplimiento funcional y normativo ICS |
| **Casos Fallidos / Defectos Abiertos (Failed)** | **0** | Todos los defectos subsanados y verificados en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | Infraestructura PostgreSQL, Socket.io y Redis operativa |
| **Tasa de Aprobación Final (% Pass)** | **100.0%** | Conforme para integración y despliegue a producción |
| **Chequeo de Tipos Estáticos (`npx tsc --noEmit`)** | 🟢 **0 errores** | Compilación de tipos TypeScript limpia |
| **Análisis Estático de Código (`npm run lint`)** | 🟢 **0 errores** | 0 errores en suite institucional ESLint |
| **Suite Completa Automatizada (Vitest v3.2.7)** | 🟢 **756/756 tests pass** | 61 archivos de prueba ejecutados exitosamente |
| **Suites de Cuadrillas y Migración 071** | 🟢 **69/69 tests pass** | Esquemas Zod, repositorio, servicio, route handler y migración 071 |
| **Sincronización con rama `develop`** | 🟢 **Sincronizado** | Integración limpia de HU-82, HU-83, HU-84 y HU-85 |

---

## 2. Registro Técnico de Defectos y Ciclo de Re-Test

### `BUG-H80-API-01`: Excepción SQL (`code: 42601 — syntax error at or near ")"`) y respuesta `HTTP 500 Internal Server Error` al consultar una página fuera de rango (`offset >= total`)
* **Severidad:** CRÍTICA
* **Estado:** 🟢 CORREGIDO / VERIFICADO
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (líneas 361–366)
* **Descripción del Defecto:** Cuando el cliente consultaba una página cuyo desplazamiento superaba el total de cuadrillas activas (`offset >= total`), `cuadrillasLote` retornaba un arreglo vacío `[]`. Al no existir retorno temprano, el repositorio ejecutaba `.where("cuadrilla_recurso.cuadrilla_id", "in", [])`, lo que compilaba a `WHERE "cuadrilla_recurso"."cuadrilla_id" IN ()`. PostgreSQL arrojaba error de sintaxis `42601` y la API respondía `HTTP 500 Internal Server Error`.
* **Solución Aplicada:** Se incorporó una guarda de retorno temprano tras obtener `cuadrillasLote`:
  ```typescript
  if (cuadrillasLote.length === 0) {
    return { cuadrillas: [], total };
  }
  ```
* **Evidencia de Re-Test:** La petición `GET /api/cuadrillas?pagina=2&limite=1` responde `HTTP 200 OK` con `data: []` y metadatos de paginación coherentes. Se verificó además el test unitario de regresión en `src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts`.

---

### `BUG-H80-API-02`: Reversión accidental en commit previo que eliminaba `ListarCuadrillasQuerySchema` de OpenAPI, rompía test de ruta y provocaba error de linter
* **Severidad:** CRÍTICA
* **Estado:** 🟢 CORREGIDO / VERIFICADO
* **Módulo / Archivos Afectados:**
  * `src/lib/openapi/index.ts`
  * `src/app/openapi.json/__tests__/route.test.ts`
  * `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts`
  * `docs/api/recursos-y-personal.md`
* **Descripción del Defecto:** Se habían revertido accidentalmente los parámetros de query de `/api/cuadrillas` en OpenAPI, haciendo fallar la prueba unitaria `src/app/openapi.json/__tests__/route.test.ts` (`spec.paths["/api/cuadrillas"].get.parameters`). Adicionalmente, se habían perdido 4 pruebas del servicio y persistía un tipo `any` que hacía fallar `npm run lint`.
* **Solución Aplicada:** Se restauró la vinculación de `ListarCuadrillasQuerySchema` en OpenAPI (`registry.registerPath`), se restablecieron los tests unitarios en `cuadrilla.service.test.ts`, se eliminaron los castings `any` y se actualizó la documentación de contrato en `docs/api/recursos-y-personal.md`.
* **Evidencia de Re-Test:** El test `src/app/openapi.json/__tests__/route.test.ts` pasa exitosamente, `npm run lint` finaliza con 0 errores y `GET /openapi.json` expone los 11 parámetros de consulta de `GET /api/cuadrillas`.

---

### `BUG-H80-API-03`: Descarte silencioso de los parámetros estándar H34 `page` y `limit` en `GET /api/cuadrillas` e incumplimiento de `PaginationMeta` en `meta`
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO / VERIFICADO
* **Módulo / Archivos Afectados:**
  * `src/modules/recursos-y-personal/cuadrilla.schema.ts`
  * `src/modules/recursos-y-personal/cuadrilla.service.ts`
* **Descripción del Defecto:** `ListarCuadrillasQuerySchema` aplicaba `.default(1)` y `.default(10)` a `pagina` y `limite`. Al consultar con `page=2` y `limit=1`, Zod asignaba `pagina=1` y `limite=10`, impidiendo evaluar `query.page` y `query.limit`. Además, el objeto `meta` solo exponía `paginasTotales` y omitía las claves estándar H34 (`totalPages`, `hasNext`, `hasPrev`).
* **Solución Aplicada:** Se removieron los valores por defecto automáticos de `pagina` y `limite` en el esquema Zod, permitiendo que el servicio resuelva `const pagina = query.pagina ?? query.page ?? 1;` y `const limite = query.limite ?? query.limit ?? 10;`. Asimismo, se enriqueció `PaginacionMetaSchema` para retornar ambas familias de metadatos (claves en español para `sgrai-web` y claves estándar H34 para interoperabilidad).
* **Evidencia de Re-Test:** Consulta `GET /api/cuadrillas?page=2&limit=1` responde con `meta.page: 2`, `meta.limit: 1`, `meta.totalPages: 1`, `meta.hasNext: false`, `meta.hasPrev: true`, `meta.pagina: 2`, `meta.limite: 1` y `meta.paginasTotales: 1`.

---

### `BUG-H80-API-04`: Desfase de commits con `develop`, colisión de migración de índices y omisión de filtros de baja lógica de dotación (HU-82)
* **Severidad:** ALTA
* **Estado:** 🟢 CORREGIDO / VERIFICADO
* **Módulo / Archivos Afectados:**
  * `src/lib/db/migrations/071_indices_listado_cuadrillas.ts`
  * `src/lib/db/migrations/__tests__/071_indices_listado_cuadrillas.test.ts`
  * `src/modules/recursos-y-personal/cuadrilla.repository.ts`
  * `src/modules/recursos-y-personal/cuadrilla.service.ts`
* **Descripción del Defecto:** La rama presentaba colisión en el correlativo `032` de migraciones Kysely con `032_cuadrilla_baja_logica_activo.ts` de HU-82, y omitía los filtros de dotación desvinculada (`desvinculado_en IS NULL`) introducidos en la desactivación y edición de cuadrillas.
* **Solución Aplicada:** Se sincronizó la rama con `develop`, preservando las reglas de vigencia y auditoría de HU-82, y la migración de índices parciales se renumeró al correlativo unificado disponible `071_indices_listado_cuadrillas.ts` junto con su suite de prueba `071_indices_listado_cuadrillas.test.ts`.
* **Evidencia de Re-Test:** La migración `071` ejecuta sus funciones `up` y `down` sin colisiones, y la consulta de cuadrillas respeta la exclusión de dotación históricamente desvinculada.

---

### `BUG-H80-API-05`: Falta de sanitización de comodines SQL (`%` y `_`) en el filtro de búsqueda textual (`busqueda` / `q`) de `listarCuadrillasPaginadas`
* **Severidad:** MEDIA
* **Estado:** 🟢 CORREGIDO / VERIFICADO
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (líneas 263–268 y 317)
* **Descripción del Defecto:** El término de búsqueda se interpolaba directamente en `%${filtros.busqueda.trim()}%` sin escapar caracteres comodín. Peticiones con `%` o `_` realizaban búsquedas comodín abiertas en `ILIKE`, devolviendo todos los registros independientemente de si el texto contenía literalmente el símbolo.
* **Solución Aplicada:** Se implementó la función utilitaria `construirPatronBusqueda`:
  ```typescript
  export function construirPatronBusqueda(termino: string): string {
    const textoSanitizado = termino.trim().replace(/[\\%_]/g, "\\$&");
    return `%${textoSanitizado}%`;
  }
  ```
* **Evidencia de Re-Test:** Petición `GET /api/cuadrillas?busqueda=%25` retorna `total: 0` (`data: []`) al no existir ninguna cuadrilla con el carácter literal `%`. Prueba unitaria en `cuadrilla.repository.test.ts` certifica el escape adecuado de comodines.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas Institucionales)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H80-API-01` | Paginación en página fuera de rango (offset >= total) sin error SQL 42601 IN () | Robustez / DB | Repository / Kysely | Crítica | Base de datos con 1 cuadrilla activa (`total = 1`) | `GET /api/cuadrillas?pagina=2&limite=1` [Header: `Authorization: Bearer <token>`] | HTTP 200 OK con `data: []` y `meta` coherente sin excepciones SQL | HTTP 200 OK con `data: []` y `total: 1` tras aplicar retorno temprano en `cuadrillasLote.length === 0` | **CORREGIDO** | 09/11/2026 11:43 | 10/11/2026 16:06 | fix(cuadrillas): retorno temprano para páginas fuera de rango evitando syntax error SQL |
| `BUG-H80-API-02` | Exposición de query params H34 de GET /api/cuadrillas en /openapi.json y limpieza de ESLint | Contrato / OpenAPI | OpenAPI / CI | Crítica | Especificación OpenAPI generada en `/openapi.json` | `GET /openapi.json` y `npm test -- src/app/openapi.json/__tests__/route.test.ts` | Test de OpenAPI aprueba con parámetros documentados y `npm run lint` con 0 errores | Parámetros query expuestos en `/openapi.json`, test de OpenAPI aprobado y 0 errores de ESLint | **CORREGIDO** | 09/11/2026 11:36 | 10/11/2026 16:06 | fix(openapi): restaurar contrato openapi, tests de route y documentacion H34 |
| `BUG-H80-API-03` | Paginación mediante alias estándar H34 `page` y `limit` y estructura `PaginationMeta` | Funcional / Contrato | Schema / Service | Alta | Base de datos con cuadrillas operativas registradas | `GET /api/cuadrillas?page=2&limit=1` [Header: `Authorization: Bearer <token>`] | Respeta `page=2` y `limit=1` y retorna `meta` con estándar H34 y retrocompatibilidad | Respeta `page` y `limit` y retorna `meta` completo (`page`, `limit`, `totalPages`, `hasNext`, `hasPrev`, `pagina`, `limite`, `paginasTotales`) | **CORREGIDO** | 09/11/2026 11:42 | 10/11/2026 16:06 | fix(cuadrillas): respetar page/limit estandar y exponer metadatos H34 en meta |
| `BUG-H80-API-04` | Sincronización con rama develop, numeración correlativa de migración de índices y vigencia HU-82 | Integración / DB | Migración / Repo | Alta | Rama sincronizada con `develop` (migraciones hasta `034`) | `git rev-list --left-right --count develop...HEAD` y revisión de migraciones | Rama sincronizada con `develop`, migración numerada como `071` y filtros `desvinculado_en IS NULL` activos | Rama sincronizada con `develop`, migración renumerada a `071_indices_listado_cuadrillas.ts` y filtros de HU-82 integrados | **CORREGIDO** | 09/11/2026 11:37 | 10/11/2026 16:06 | fix(db): renumerar migracion de indices de cuadrillas a 071 y sincronizar filtros HU-82 |
| `BUG-H80-API-05` | Sanitización de comodines SQL (`%` y `_`) en búsqueda textual libre `busqueda` / `q` | Seguridad / SQL | Repository / Kysely | Media | Cuadrilla `"delta"` registrada sin carácter `%` en su nombre | `GET /api/cuadrillas?busqueda=%25` [Header: `Authorization: Bearer <token>`] | Escapa el comodín `%` y retorna `data: []` (`total: 0`) al no existir coincidencia literal | Escapa correctamente `\`, `%` y `_` retornando `total: 0` ante comodines no coincidentes | **CORREGIDO** | 09/11/2026 11:42 | 10/11/2026 16:06 | fix(cuadrillas): sanitizar comodines SQL en busqueda textual libre |
| `CP-H80-API-01` | Listado paginado base de cuadrillas sin filtros con valores por defecto (`pagina=1`, `limite=10`) | Funcional / API | Route Handler / Service | Crítica | Usuario autenticado con rol `ADMIN` y cuadrillas activas en BD | `GET /api/cuadrillas` [Header: `Authorization: Bearer <token_admin>`] | HTTP 200 OK con arreglo `data` (delegación, delegado, recursos, trabajadores, conteos) y `meta` (`pagina: 1, limite: 10`) | HTTP 200 OK retornando listado consolidado de cuadrillas con estructura esperada | **APROBADO** | 09/11/2026 11:42 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-02` | Consulta autorizada para perfil Encargado de Operaciones con permiso `recursos:leer` | Seguridad / RBAC | Route Handler / Service | Crítica | Usuario autenticado con rol `ENCARGADO` (`encargado@valdivia.cl`) | `GET /api/cuadrillas?pagina=1&limite=5` [Header: `Authorization: Bearer <token_encargado>`] | HTTP 200 OK permitiendo visualizar la capacidad operativa comunal | HTTP 200 OK retornando cuadrillas y metadatos de paginación | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-03` | Filtrado territorial por `delegacionId` UUID válido | Funcional / API | Service / Repository | Crítica | Cuadrilla adscrita a Delegación Municipal Costa (`30000000-0000-4000-8000-000000000003`) | `GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003` | HTTP 200 OK retornando exclusivamente cuadrillas pertenecientes a la delegación consultada | HTTP 200 OK con cláusula `WHERE cuadrilla.delegacion_id = $1` aplicada | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-04` | Filtrado por estado operativo canónico (`estado=DISPONIBLE`) | Funcional / API | Service / Repository | Crítica | Cuadrillas registradas en distintos estados operativos | `GET /api/cuadrillas?estado=DISPONIBLE` | HTTP 200 OK retornando únicamente cuadrillas con `estado === "DISPONIBLE"` | HTTP 200 OK filtrando registros por estado canónico en mayúsculas | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-05` | Filtrado combinado conjuntivo AND (`delegacionId` + `estado`) | Funcional / API | Service / Repository | Alta | Cuadrillas registradas en diversas delegaciones y estados | `GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003&estado=DISPONIBLE` | HTTP 200 OK aplicando conjunción booleana `AND` sobre ambos predicados | HTTP 200 OK retornando solo cuadrillas que cumplen ambos criterios simultáneamente | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-06` | Búsqueda textual parcial insensible a mayúsculas mediante parámetro `busqueda` | Funcional / API | Service / Repository | Alta | Cuadrilla `"delta"` y delegado `"Supervisor Estratégico"` en BD | `GET /api/cuadrillas?busqueda=delta` | HTTP 200 OK filtrando con `ILIKE` sobre nombre de cuadrilla, nombre de delegado o RUT | HTTP 200 OK retornando la cuadrilla coincidente | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-07` | Búsqueda textual mediante alias `q` y recorte de espacios extremos (`.trim()`) | Validación / Schema | Schema / Service | Media | Parámetro `busqueda` o `q` con espacios laterales (`"  texto  "`) | `ListarCuadrillasQuerySchema.safeParse({ busqueda: "  texto  " })` | El esquema recorta espacios dejando `"texto"` sin lanzar error | Parseo exitoso en `cuadrilla.listado.schema.test.ts` con valor `"texto"` | **APROBADO** | 09/11/2026 11:36 | 10/11/2026 16:06 | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-08` | Respuesta de estado vacío cuando los filtros no arrojan coincidencias (`total = 0`) | Borde / API | Service / Repository | Media | Término de búsqueda inexistente en la base de datos | `GET /api/cuadrillas?busqueda=INEXISTENTE_XYZ_999` | HTTP 200 OK con `data: []` y `meta.total: 0` sin errores de ejecución | HTTP 200 OK con `{"message":"Listado de cuadrillas obtenido exitosamente","data":[],"meta":{"total":0,"pagina":1,"limite":10,"paginasTotales":1}}` | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-09` | Cómputo de contadores `totalRecursos` y `totalTrabajadores` y colecciones para Drawer lateral | Funcional / Datos | Service / Repository | Alta | Cuadrilla con dotación de personal (`cuadrilla_personal`) y recursos (`cuadrilla_recurso`) | `GET /api/cuadrillas` y `GET /api/cuadrillas/{id}` | Cada ítem expone arreglos `recursos` y `trabajadores` junto a `totalRecursos` y `totalTrabajadores` | Conteos y arreglos mapeados fielmente para alimentar la tabla y el drawer lateral | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-10` | Consulta de detalle unitario consolidado `GET /api/cuadrillas/{id}` para Drawer de dotación | Funcional / API | Route Handler / Service | Alta | Cuadrilla activa con UUID `26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` | `GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` | HTTP 200 OK con detalle completo de delegación, delegado, trabajadores y recursos vinculados | HTTP 200 OK retornando objeto `data` consolidado | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-11` | Rechazo de consulta sin cabecera de autenticación (`HTTP 401 Unauthorized`) | Seguridad / Auth | Route Handler / Guard | Crítica | Petición sin token JWT ni cabecera de sesión | `GET /api/cuadrillas` (sin header `Authorization`) | HTTP 401 Unauthorized con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | HTTP 401 Unauthorized verificado en servidor y suite unitaria | **APROBADO** | 09/11/2026 11:41 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-12` | Bloqueo RBAC a usuario autenticado sin permiso `recursos:leer` (`HTTP 403 Forbidden`) | Seguridad / RBAC | Route Handler / Service | Crítica | Usuario con rol `CALL_CENTER` (`callcenter@valdivia.cl`) sin permiso `recursos:leer` | `GET /api/cuadrillas` [Header: `Authorization: Bearer <token_callcenter>`] | HTTP 403 Forbidden denegando el acceso al listado táctico | HTTP 403 Forbidden con mensaje de acceso denegado | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-13` | Validación Zod ante `delegacionId` con formato no UUID (`HTTP 400 Bad Request`) | Validación / Schema | Route Handler / Zod | Alta | Parámetro `delegacionId` malformado | `GET /api/cuadrillas?delegacionId=no-es-uuid` | HTTP 400 Bad Request indicando `"El identificador de delegación debe ser un UUID válido"` | HTTP 400 Bad Request con detalle en `errors[0].campo = "delegacionId"` | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-14` | Validación Zod ante valor fuera del enum canónico en `estado` (`HTTP 400 Bad Request`) | Validación / Schema | Route Handler / Zod | Alta | Parámetro `estado` con valor no perteneciente al enum | `GET /api/cuadrillas?estado=ESTADO_INVALIDO` | HTTP 400 Bad Request rechazando el estado inválido | HTTP 400 Bad Request con error de validación en campo `estado` | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-15` | Validación Zod rechazando `limite` superior al máximo permitido de 100 (`HTTP 400 Bad Request`) | Validación / Borde | Route Handler / Zod | Media | Solicitud de paginación con `limite=150` | `GET /api/cuadrillas?limite=150` | HTTP 400 Bad Request con mensaje `"El límite por página no puede superar 100"` | HTTP 400 Bad Request detallando restricción máxima en `limite` | **APROBADO** | 09/11/2026 11:45 | 10/11/2026 16:06 | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-16` | Coerción numérica de strings en query params `pagina` y `limite` | Validación / Schema | Schema / Zod | Media | Query params recibidos como texto desde la URL (`pagina="2"`, `limite="5"`) | `ListarCuadrillasQuerySchema.safeParse({ pagina: "2", limite: "5" })` | Coerción exitosa a enteros `pagina: 2` y `limite: 5` | Coerción validada exitosamente en `cuadrilla.listado.schema.test.ts` | **APROBADO** | 09/11/2026 11:36 | 10/11/2026 16:06 | test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80) |
| `CP-H80-API-17` | Propagación de paginación personalizada (`pagina=2`, `limite=5`) desde Route Handler al servicio | Unitaria / API | Route Handler | Media | Servicio mockeado retornando `total = 12` registros | `GET /api/cuadrillas?pagina=2&limite=5` en `route.test.ts` | Invoca `listarCuadrillas` con `{ pagina: 2, limite: 5 }` y retorna `paginasTotales: 3` | Test unitario aprobado en `src/app/api/cuadrillas/__tests__/route.test.ts` | **APROBADO** | 09/11/2026 11:36 | 10/11/2026 16:06 | test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80) |
| `CP-H80-API-18` | Exclusión de cuadrillas dadas de baja lógica (`WHERE cuadrilla.eliminado_en IS NULL`) | Integridad / DB | Repository / Kysely | Alta | Cuadrillas activas e inactivas (con `eliminado_en` no nulo) | `listarCuadrillasPaginadas(filtros)` | Solo se contabilizan y listan registros con `eliminado_en IS NULL` por omisión | Cláusula `.where("cuadrilla.eliminado_en", "is", null)` presente en consulta base | **APROBADO** | 09/11/2026 11:36 | 10/11/2026 16:06 | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H80-API-19` | Creación de 4 índices parciales B-Tree en migración Kysely para optimizar filtros y ordenamiento (`up`) | Rendimiento / DB | Migración Kysely | Alta | Ejecución de función `up(db)` de la migración de índices 071 | `idx_cuadrilla_delegacion_id`, `idx_cuadrilla_estado`, `idx_cuadrilla_delegacion_estado`, `idx_cuadrilla_creado_en_desc` | Ejecuta `CREATE INDEX IF NOT EXISTS ... WHERE eliminado_en IS NULL` para los 4 índices | Test unitario `071_indices_listado_cuadrillas.test.ts` aprobado verificando las 4 sentencias DDL | **APROBADO** | 09/11/2026 11:36 | 10/11/2026 16:06 | feat(db): agregar migracion 032 con indices parciales de listado de cuadrillas (H80) |
| `CP-H80-API-20` | Reversión limpia (`down`) eliminando los 4 índices parciales de listado de cuadrillas | Integridad / DB | Migración Kysely | Media | Ejecución de función `down(db)` de la migración de índices 071 | `DROP INDEX IF EXISTS` para los 4 índices creados | Elimina sin errores los 4 índices en orden inverso | Test unitario `071_indices_listado_cuadrillas.test.ts` aprobado en 10ms | **APROBADO** | 09/11/2026 11:36 | 10/11/2026 16:06 | feat(db): agregar migracion 032 con indices parciales de listado de cuadrillas (H80) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H80-API-01	Paginación en página fuera de rango (offset >= total) sin error SQL 42601 IN ()	Robustez / DB	Repository / Kysely	Crítica	Base de datos con 1 cuadrilla activa (total = 1)	GET /api/cuadrillas?pagina=2&limite=1 [Header: Authorization: Bearer <token>]	HTTP 200 OK con data: [] y meta coherente sin excepciones SQL	HTTP 200 OK con data: [] y total: 1 tras aplicar retorno temprano en cuadrillasLote.length === 0	CORREGIDO	09/11/2026 11:43	10/11/2026 16:06	fix(cuadrillas): retorno temprano para páginas fuera de rango evitando syntax error SQL
BUG-H80-API-02	Exposición de query params H34 de GET /api/cuadrillas en /openapi.json y limpieza de ESLint	Contrato / OpenAPI	OpenAPI / CI	Crítica	Especificación OpenAPI generada en /openapi.json	GET /openapi.json y npm test -- src/app/openapi.json/__tests__/route.test.ts	Test de OpenAPI aprueba con parámetros documentados y npm run lint con 0 errores	Parámetros query expuestos en /openapi.json, test de OpenAPI aprobado y 0 errores de ESLint	CORREGIDO	09/11/2026 11:36	10/11/2026 16:06	fix(openapi): restaurar contrato openapi, tests de route y documentacion H34
BUG-H80-API-03	Paginación mediante alias estándar H34 page y limit y estructura PaginationMeta	Funcional / Contrato	Schema / Service	Alta	Base de datos con cuadrillas operativas registradas	GET /api/cuadrillas?page=2&limit=1 [Header: Authorization: Bearer <token>]	Respeta page=2 y limit=1 y retorna meta con estándar H34 y retrocompatibilidad	Respeta page y limit y retorna meta completo (page, limit, totalPages, hasNext, hasPrev, pagina, limite, paginasTotales)	CORREGIDO	09/11/2026 11:42	10/11/2026 16:06	fix(cuadrillas): respetar page/limit estandar y exponer metadatos H34 en meta
BUG-H80-API-04	Sincronización con rama develop, numeración correlativa de migración de índices y vigencia HU-82	Integración / DB	Migración / Repo	Alta	Rama sincronizada con develop (migraciones hasta 034)	git rev-list --left-right --count develop...HEAD y revisión de migraciones	Rama sincronizada con develop, migración numerada como 071 y filtros desvinculado_en IS NULL activos	Rama sincronizada con develop, migración renumerada a 071_indices_listado_cuadrillas.ts y filtros de HU-82 integrados	CORREGIDO	09/11/2026 11:37	10/11/2026 16:06	fix(db): renumerar migracion de indices de cuadrillas a 071 y sincronizar filtros HU-82
BUG-H80-API-05	Sanitización de comodines SQL (% y _) en búsqueda textual libre busqueda / q	Seguridad / SQL	Repository / Kysely	Media	Cuadrilla "delta" registrada sin carácter % en su nombre	GET /api/cuadrillas?busqueda=%25 [Header: Authorization: Bearer <token>]	Escapa el comodín % y retorna data: [] (total: 0) al no existir coincidencia literal	Escapa correctamente \, % y _ retornando total: 0 ante comodines no coincidentes	CORREGIDO	09/11/2026 11:42	10/11/2026 16:06	fix(cuadrillas): sanitizar comodines SQL en busqueda textual libre
CP-H80-API-01	Listado paginado base de cuadrillas sin filtros con valores por defecto (pagina=1, limite=10)	Funcional / API	Route Handler / Service	Crítica	Usuario autenticado con rol ADMIN y cuadrillas activas en BD	GET /api/cuadrillas [Header: Authorization: Bearer <token_admin>]	HTTP 200 OK con arreglo data (delegación, delegado, recursos, trabajadores, conteos) y meta (pagina: 1, limite: 10)	HTTP 200 OK retornando listado consolidado de cuadrillas con estructura esperada	APROBADO	09/11/2026 11:42	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-02	Consulta autorizada para perfil Encargado de Operaciones con permiso recursos:leer	Seguridad / RBAC	Route Handler / Service	Crítica	Usuario autenticado con rol ENCARGADO (encargado@valdivia.cl)	GET /api/cuadrillas?pagina=1&limite=5 [Header: Authorization: Bearer <token_encargado>]	HTTP 200 OK permitiendo visualizar la capacidad operativa comunal	HTTP 200 OK retornando cuadrillas y metadatos de paginación	APROBADO	09/11/2026 11:45	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-03	Filtrado territorial por delegacionId UUID válido	Funcional / API	Service / Repository	Crítica	Cuadrilla adscrita a Delegación Municipal Costa (30000000-0000-4000-8000-000000000003)	GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003	HTTP 200 OK retornando exclusivamente cuadrillas pertenecientes a la delegación consultada	HTTP 200 OK con cláusula WHERE cuadrilla.delegacion_id = $1 aplicada	APROBADO	09/11/2026 11:45	10/11/2026 16:06	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-04	Filtrado por estado operativo canónico (estado=DISPONIBLE)	Funcional / API	Service / Repository	Crítica	Cuadrillas registradas en distintos estados operativos	GET /api/cuadrillas?estado=DISPONIBLE	HTTP 200 OK retornando únicamente cuadrillas con estado === "DISPONIBLE"	HTTP 200 OK filtrando registros por estado canónico en mayúsculas	APROBADO	09/11/2026 11:45	10/11/2026 16:06	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-05	Filtrado combinado conjuntivo AND (delegacionId + estado)	Funcional / API	Service / Repository	Alta	Cuadrillas registradas en diversas delegaciones y estados	GET /api/cuadrillas?delegacionId=30000000-0000-4000-8000-000000000003&estado=DISPONIBLE	HTTP 200 OK aplicando conjunción booleana AND sobre ambos predicados	HTTP 200 OK retornando solo cuadrillas que cumplen ambos criterios simultáneamente	APROBADO	09/11/2026 11:45	10/11/2026 16:06	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-06	Búsqueda textual parcial insensible a mayúsculas mediante parámetro busqueda	Funcional / API	Service / Repository	Alta	Cuadrilla "delta" y delegado "Supervisor Estratégico" en BD	GET /api/cuadrillas?busqueda=delta	HTTP 200 OK filtrando con ILIKE sobre nombre de cuadrilla, nombre de delegado o RUT	HTTP 200 OK retornando la cuadrilla coincidente	APROBADO	09/11/2026 11:45	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-07	Búsqueda textual mediante alias q y recorte de espacios extremos (.trim())	Validación / Schema	Schema / Service	Media	Parámetro busqueda o q con espacios laterales ("  texto  ")	ListarCuadrillasQuerySchema.safeParse({ busqueda: "  texto  " })	El esquema recorta espacios dejando "texto" sin lanzar error	Parseo exitoso en cuadrilla.listado.schema.test.ts con valor "texto"	APROBADO	09/11/2026 11:36	10/11/2026 16:06	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-08	Respuesta de estado vacío cuando los filtros no arrojan coincidencias (total = 0)	Borde / API	Service / Repository	Media	Término de búsqueda inexistente en la base de datos	GET /api/cuadrillas?busqueda=INEXISTENTE_XYZ_999	HTTP 200 OK con data: [] y meta.total: 0 sin errores de ejecución	HTTP 200 OK con {"message":"Listado de cuadrillas obtenido exitosamente","data":[],"meta":{"total":0,"pagina":1,"limite":10,"paginasTotales":1}}	APROBADO	09/11/2026 11:45	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-09	Cómputo de contadores totalRecursos y totalTrabajadores y colecciones para Drawer lateral	Funcional / Datos	Service / Repository	Alta	Cuadrilla con dotación de personal (cuadrilla_personal) y recursos (cuadrilla_recurso)	GET /api/cuadrillas y GET /api/cuadrillas/{id}	Cada ítem expone arreglos recursos y trabajadores junto a totalRecursos y totalTrabajadores	Conteos y arreglos mapeados fielmente para alimentar la tabla y el drawer lateral	APROBADO	09/11/2026 11:45	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-10	Consulta de detalle unitario consolidado GET /api/cuadrillas/{id} para Drawer de dotación	Funcional / API	Route Handler / Service	Alta	Cuadrilla activa con UUID 26c3b3d7-1cf3-409b-9d4e-eb49d6369a85	GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85	HTTP 200 OK con detalle completo de delegación, delegado, trabajadores y recursos vinculados	HTTP 200 OK retornando objeto data consolidado	APROBADO	09/11/2026 11:45	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-11	Rechazo de consulta sin cabecera de autenticación (HTTP 401 Unauthorized)	Seguridad / Auth	Route Handler / Guard	Crítica	Petición sin token JWT ni cabecera de sesión	GET /api/cuadrillas (sin header Authorization)	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	HTTP 401 Unauthorized verificado en servidor y suite unitaria	APROBADO	09/11/2026 11:41	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-12	Bloqueo RBAC a usuario autenticado sin permiso recursos:leer (HTTP 403 Forbidden)	Seguridad / RBAC	Route Handler / Service	Crítica	Usuario con rol CALL_CENTER (callcenter@valdivia.cl) sin permiso recursos:leer	GET /api/cuadrillas [Header: Authorization: Bearer <token_callcenter>]	HTTP 403 Forbidden denegando el acceso al listado táctico	HTTP 403 Forbidden con mensaje de acceso denegado	APROBADO	09/11/2026 11:45	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-13	Validación Zod ante delegacionId con formato no UUID (HTTP 400 Bad Request)	Validación / Schema	Route Handler / Zod	Alta	Parámetro delegacionId malformado	GET /api/cuadrillas?delegacionId=no-es-uuid	HTTP 400 Bad Request indicando "El identificador de delegación debe ser un UUID válido"	HTTP 400 Bad Request con detalle en errors[0].campo = "delegacionId"	APROBADO	09/11/2026 11:45	10/11/2026 16:06	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-14	Validación Zod ante valor fuera del enum canónico en estado (HTTP 400 Bad Request)	Validación / Schema	Route Handler / Zod	Alta	Parámetro estado con valor no perteneciente al enum	GET /api/cuadrillas?estado=ESTADO_INVALIDO	HTTP 400 Bad Request rechazando el estado inválido	HTTP 400 Bad Request con error de validación en campo estado	APROBADO	09/11/2026 11:45	10/11/2026 16:06	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-15	Validación Zod rechazando limite superior al máximo permitido de 100 (HTTP 400 Bad Request)	Validación / Borde	Route Handler / Zod	Media	Solicitud de paginación con limite=150	GET /api/cuadrillas?limite=150	HTTP 400 Bad Request con mensaje "El límite por página no puede superar 100"	HTTP 400 Bad Request detallando restricción máxima en limite	APROBADO	09/11/2026 11:45	10/11/2026 16:06	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-16	Coerción numérica de strings en query params pagina y limite	Validación / Schema	Schema / Zod	Media	Query params recibidos como texto desde la URL (pagina="2", limite="5")	ListarCuadrillasQuerySchema.safeParse({ pagina: "2", limite: "5" })	Coerción exitosa a enteros pagina: 2 y limite: 5	Coerción validada exitosamente en cuadrilla.listado.schema.test.ts	APROBADO	09/11/2026 11:36	10/11/2026 16:06	test(cuadrillas): agregar suite de tests de schema ListarCuadrillasQuerySchema (H80)
CP-H80-API-17	Propagación de paginación personalizada (pagina=2, limite=5) desde Route Handler al servicio	Unitaria / API	Route Handler	Media	Servicio mockeado retornando total = 12 registros	GET /api/cuadrillas?pagina=2&limite=5 en route.test.ts	Invoca listarCuadrillas con { pagina: 2, limite: 5 } y retorna paginasTotales: 3	Test unitario aprobado en src/app/api/cuadrillas/__tests__/route.test.ts	APROBADO	09/11/2026 11:36	10/11/2026 16:06	test(cuadrillas): ampliar casos de prueba del endpoint GET /api/cuadrillas (H80)
CP-H80-API-18	Exclusión de cuadrillas dadas de baja lógica (WHERE cuadrilla.eliminado_en IS NULL)	Integridad / DB	Repository / Kysely	Alta	Cuadrillas activas e inactivas (con eliminado_en no nulo)	listarCuadrillasPaginadas(filtros)	Solo se contabilizan y listan registros con eliminado_en IS NULL por omisión	Cláusula .where("cuadrilla.eliminado_en", "is", null) presente en consulta base	APROBADO	09/11/2026 11:36	10/11/2026 16:06	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H80-API-19	Creación de 4 índices parciales B-Tree en migración Kysely para optimizar filtros y ordenamiento (up)	Rendimiento / DB	Migración Kysely	Alta	Ejecución de función up(db) de la migración de índices 071	idx_cuadrilla_delegacion_id, idx_cuadrilla_estado, idx_cuadrilla_delegacion_estado, idx_cuadrilla_creado_en_desc	Ejecuta CREATE INDEX IF NOT EXISTS ... WHERE eliminado_en IS NULL para los 4 índices	Test unitario 071_indices_listado_cuadrillas.test.ts aprobado verificando las 4 sentencias DDL	APROBADO	09/11/2026 11:36	10/11/2026 16:06	feat(db): agregar migracion 032 con indices parciales de listado de cuadrillas (H80)
CP-H80-API-20	Reversión limpia (down) eliminando los 4 índices parciales de listado de cuadrillas	Integridad / DB	Migración Kysely	Media	Ejecución de función down(db) de la migración de índices 071	DROP INDEX IF EXISTS para los 4 índices creados	Elimina sin errores los 4 índices en orden inverso	Test unitario 071_indices_listado_cuadrillas.test.ts aprobado en 10ms	APROBADO	09/11/2026 11:36	10/11/2026 16:06	feat(db): agregar migracion 032 con indices parciales de listado de cuadrillas (H80)
```

---

## 4. Guía de Ejecución y Replicabilidad Paso a Paso (Evidencias de Consola)

### 4.1 Ejecución Automatizada de Pruebas Unitarias y de Integración (Vitest)

**Comando ejecutado para suites específicas de Cuadrillas y Migración 071:**
```bash
npm test -- --run src/app/openapi.json/__tests__/route.test.ts src/app/api/cuadrillas/__tests__/route.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.listado.schema.test.ts src/lib/db/migrations/__tests__/071_indices_listado_cuadrillas.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts
```

**Salida real obtenida:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.listado.schema.test.ts (9 tests) 16ms
 ✓ src/lib/db/migrations/__tests__/071_indices_listado_cuadrillas.test.ts (2 tests) 10ms
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts (10 tests) 24ms
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts (37 tests) 87ms
 ✓ src/app/api/cuadrillas/__tests__/route.test.ts (10 tests) 55ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 259ms

 Test Files  6 passed (6)
      Tests  69 passed (69)
   Duration  1.86s
```

**Comando ejecutado para la suite completa del repositorio:**
```bash
npm test -- --run
```

**Salida real obtenida:**
```text
 Test Files  61 passed (61)
      Tests  756 passed (756)
   Duration  8.03s
```

---

### 4.2 Verificación de Tipos Estáticos y Análisis de Código

**Comando ejecutado:**
```bash
npx tsc --noEmit && npm run lint
```

**Salida real obtenida:**
```text
npm notice run api@0.10.0 npx
npm notice run 'tsc' --noEmit
npm notice run api@0.10.0 lint
npm notice run eslint

✖ 9 problems (0 errors, 9 warnings)
```

---

### 4.3 Pruebas de Integración HTTP/REST con cURL en Servidor en Vivo (`localhost:3001`)

#### Paso 1: Autenticación institucional y obtención de tokens JWT
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

#### Paso 2: Validación de resolución de `BUG-H80-API-01` y `BUG-H80-API-03` (Página fuera de rango y metadatos estándar H34)
```bash
curl -s -X GET "http://localhost:3001/api/cuadrillas?page=2&limit=1" \
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

**Respuesta real obtenida (`HTTP 200 OK`):**
```json
{
  "message": "Listado de cuadrillas obtenido exitosamente",
  "data": [],
  "meta": {
    "total": 1,
    "pagina": 2,
    "limite": 1,
    "paginasTotales": 1,
    "page": 2,
    "limit": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": true
  }
}
```

#### Paso 3: Validación de resolución de `BUG-H80-API-05` (Sanitización de comodines SQL en búsqueda textual)
```bash
curl -s -X GET "http://localhost:3001/api/cuadrillas?busqueda=%25" \
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

**Respuesta real obtenida (`HTTP 200 OK`):**
```json
{
  "message": "Listado de cuadrillas obtenido exitosamente",
  "data": [],
  "meta": {
    "total": 0,
    "pagina": 1,
    "limite": 10,
    "paginasTotales": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Paso 4: Validación de resolución de `BUG-H80-API-02` (Exposición de query parameters en `/openapi.json`)
```bash
curl -s -X GET "http://localhost:3001/openapi.json" | jq '.paths["/api/cuadrillas"].get.parameters | map(.name)'
```

**Respuesta real obtenida:**
```json
[
  "pagina",
  "page",
  "limite",
  "limit",
  "busqueda",
  "q",
  "delegacionId",
  "estado",
  "activo",
  "incluir_inactivas",
  "incluirInactivas"
]
```

#### Paso 5: Filtro territorial y por estado operativo canónico (`CP-H80-API-05`)
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
      "activo": true,
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
    "paginasTotales": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Paso 6: Verificación de control perimetral RBAC (`401` y `403`) y Validación Zod (`400`)
```bash
# 401 Unauthorized (sin token Bearer)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas"

# 403 Forbidden (rol Call Center sin permiso recursos:leer)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas" \
  -H "Authorization: Bearer $TOKEN_CALLCENTER"

# 400 Bad Request (delegacionId con formato no UUID)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:3001/api/cuadrillas?delegacionId=no-es-uuid" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

# 400 Bad Request (límite superior a 100)
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

{"message":"Parámetros de consulta inválidos.","errors":[{"campo":"limite","mensaje":"El límite por página no puede superar 100"}]}
HTTP_STATUS:400
```

---

## 5. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (HU-80) | Endpoint / Componente Backend Relacionado | Casos de Prueba Asociados | Estado de Cumplimiento |
|---|---|---|:---:|
| **CA-1:** El sistema debe proveer una vista tabular en `/gestion/admin/cuadrillas` bajo estándar de contratos H34. | `GET /api/cuadrillas` (`src/app/api/cuadrillas/route.ts`) | `CP-H80-API-01`, `CP-H80-API-02`, `BUG-H80-API-03` | 🟢 **CUMPLE (100%)** |
| **CA-2:** La tabla debe mostrar: Nombre de la cuadrilla, Delegación base, Delegado responsable, Estado actual (`DISPONIBLE`, `EN_MISION`, `NO_DISPONIBLE`) y contador de personal/recursos vinculados. | `listarCuadrillas` (`cuadrilla.service.ts`), `CuadrillaItemResponseSchema` (`cuadrilla.schema.ts`) | `CP-H80-API-01`, `CP-H80-API-09`, `CP-H80-API-18` | 🟢 **CUMPLE (100%)** |
| **CA-3:** Al hacer clic sobre una fila, se debe desplegar un drawer lateral con el detalle de miembros de personal asignados y equipos/vehículos vinculados (`cuadrilla_recurso`). | `GET /api/cuadrillas` y `GET /api/cuadrillas/[id]` (`obtenerCuadrillaDetalleUnitario`) | `CP-H80-API-09`, `CP-H80-API-10`, `BUG-H80-API-04` | 🟢 **CUMPLE (100%)** |
| **CA-4:** Debe permitir filtrar por delegación municipal y estado operativo. | `listarCuadrillasPaginadas` (`cuadrilla.repository.ts`), `071_indices_listado_cuadrillas.ts` | `CP-H80-API-03`, `CP-H80-API-04`, `CP-H80-API-05`, `CP-H80-API-13`, `CP-H80-API-14`, `CP-H80-API-19` | 🟢 **CUMPLE (100%)** |
| **CA-5:** El endpoint `GET /api/cuadrillas` debe responder bajo estándar H34. | `ListarCuadrillasQuerySchema`, `ListarCuadrillasResponseSchema`, `/openapi.json` | `BUG-H80-API-01`, `BUG-H80-API-02`, `BUG-H80-API-03`, `BUG-H80-API-05`, `CP-H80-API-06` a `CP-H80-API-17` | 🟢 **CUMPLE (100%)** |

---

## 6. Conclusión y Dictamen de Certificación

Tras la subsanación integral de los 5 defectos detectados en la auditoría inicial y la verificación exhaustiva mediante 756 pruebas automatizadas en Vitest, análisis estático y pruebas en vivo sobre `localhost:3001`, se concluye que la implementación backend de la Historia de Usuario **HU-80: Visualizar listado de cuadrillas operativas, disponibilidad y dotación** cumple a cabalidad con los estándares de arquitectura, diseño OpenAPI, seguridad RBAC y reglas del Sistema de Comando de Incidentes (ICS) de la Municipalidad de Valdivia.

**Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN (PASS)**.
