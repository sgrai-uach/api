# Informe y Matriz de Casos de Prueba (QA): HU-22 — Detalle Técnico y Composición en Tiempo Real de Cuadrilla (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Cuadrillas Operativas (`sgrai-api` — `GET /api/cuadrillas/[id]`).  
> **Historia de Usuario:** HU-22 — *"Como Encargado Quiero consultar el detalle técnico y la composición en tiempo real de una cuadrilla al cliquearla en la tabla o mapa Para conocer los integrantes de la brigada, delegado a cargo, recursos y herramientas asignadas, y su misión en ejecución."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H22-detalles-cuadrillas` (asignada a `MayraCarrillo`).  
> **Commits Evaluados en Rama:**
> * `feat(db): agregar compatibilidad de vistas e interfaces de integrantes de cuadrilla y patrulla`
> * `feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle`
> * `test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa`
> * `chore(release): bump version to 0.11.0`
>
> **Fecha de Auditoría Inicial:** 12/11/2026 11:45.  
> **Estado de Certificación QA:** 🔴 **RECHAZADO (4 Defectos Abiertos — Pendiente de Corrección)**.

---

## 1. Resumen Ejecutivo

Tras realizar la inspección técnica de código fuente, verificación de sincronización respecto a `origin/develop`, auditoría del contrato OpenAPI 3.0, inspección directa sobre PostgreSQL 16 + PostGIS, ejecución de pruebas automatizadas en Vitest, análisis estático con ESLint y pruebas funcionales en vivo mediante peticiones HTTP/cURL, se determinó que la rama `feature/H22-detalles-cuadrillas` presenta **4 defectos abiertos** (`BUG-H22-API-01` a `BUG-H22-API-04`), siendo uno de severidad **Crítica** y uno de severidad **Alta** que impiden su aprobación para merge a `develop`.

### Hallazgos Principales
1. **Fallo `404 Not Found` en cuadrillas `EN_MISION` (`BUG-H22-API-01` — Crítica):** La rama quedó desincronizada respecto a `origin/develop` (ramificada desde el merge del PR #35, previo a los PR #40, #41 y #49) y mantiene `.innerJoin("delegacion", ...)` y `.innerJoin("usuario", ...)` en `obtenerCuadrillaDetalleUnitario` y `listarCuadrillasPaginadas`. En la base de datos activa, las dos cuadrillas operativas en estado `EN_MISION` (`Cuadrilla Aguas Lluvias Alfa` y `Cuadrilla Vías y Despeje Urbano`) tienen `delegacion_id = NULL`, por lo que `GET /api/cuadrillas/{id}` devuelve `404 Not Found` al intentar consultarlas.
2. **Ordenamiento ambiguo en `mision_activa` (`BUG-H22-API-02` — Alta):** La consulta de misión activa en `cuadrilla.repository.ts` ordena por `mision.fecha_inicio DESC` sin cláusula `NULLS LAST` ni desempate determinista, provocando que en PostgreSQL una misión `DESPACHADA` con `fecha_inicio = NULL` preceda a una misión `EN_CURSO` con marca temporal registrada.
3. **Desalineación de versión y seguridad en OpenAPI (`BUG-H22-API-03` — Media):** `package.json` fue incrementado a `0.11.0`, pero `src/lib/openapi/index.ts` continúa declarando `version: "0.10.0"`, referencia `BearerAuth` sin registrar `components.securitySchemes`, y no actualiza las aserciones en `src/app/openapi.json/__tests__/route.test.ts`.
4. **Brechas de cobertura, migración y calidad estática (`BUG-H22-API-04` — Media):** `npm run lint` finaliza con 3 errores `@typescript-eslint/no-explicit-any` en el módulo de cuadrillas; `cuadrilla.repository.test.ts` carece de pruebas para `mision_activa`, `telefono` y `detalles`; y la migración `035_cuadrilla_patrulla_integrantes_vistas.ts` no cuenta con prueba unitaria `up`/`down` ni se encuentra aplicada en el esquema local, además de colisionar en prefijo con `035_permiso_misiones_terreno_verificar`.

| Métrica de Calidad | Evaluación Inicial (12/11/2026) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba Diseñados** | **15** | Casos funcionales, seguridad RBAC, validación, persistencia, OpenAPI y estáticos |
| **Casos Aprobados (Passed)** | **11** | Flujos HTTP `200`/`400`/`401`/`403`/`404` sobre cuadrillas con FK completas, proyecciones en servicio y docs |
| **Casos Fallidos (Failed)** | **4** | `CP-H22-API-03`, `CP-H22-API-12`, `CP-H22-API-13`, `CP-H22-API-15` |
| **Defectos Abiertos (Bugs)** | **4** | 1 Crítico (`BUG-H22-API-01`), 1 Alto (`BUG-H22-API-02`), 2 Medios (`BUG-H22-API-03`, `BUG-H22-API-04`) |
| **Tasa de Aprobación de Casos (% Pass)** | **73.33%** | 11 de 15 casos aprobados |
| **Suite Vitest Módulo Cuadrillas** | **72/72 passed** | 4 archivos (`cuadrilla.repository.test.ts`, `cuadrilla.service.test.ts`, `route.test.ts` x2) |
| **Suite Vitest Global (`npm test`)** | **704/704 passed** | 59 archivos de prueba ejecutados con mocks |
| **Análisis Estático ESLint (`npm run lint`)** | **Fallido (3 errores)** | 3 errores `no-explicit-any` (`cuadrilla.service.ts:696`, `api/cuadrillas/[id]/__tests__/route.test.ts:199,499`) |
| **Chequeo TypeScript (`npx tsc --noEmit`)** | **Con observaciones** | 2 errores residuales en caché `.next/dev/types/validator.ts` de rutas inexistentes |
| **Sincronización con `origin/develop`** | **Desincronizada** | Faltan PR #40 (HU-21), PR #41 (HU-80) y PR #49 (HU-85) |

---

## 2. Registro Técnico de Defectos

| ID Defecto | Severidad | Módulo / Archivo Afectado | Descripción Técnica | Evidencia / Reproducción | Estado |
|---|:---:|---|---|---|:---:|
| `BUG-H22-API-01` | Crítica | `src/modules/recursos-y-personal/cuadrilla.repository.ts` (L143-147, L350-354), `cuadrilla.service.ts`, `cuadrilla.schema.ts`, `src/lib/db/migrator.ts` | Reintroducción de `.innerJoin("delegacion", ...)` y `.innerJoin("usuario", ...)` en `obtenerCuadrillaDetalleUnitario` y `listarCuadrillasPaginadas` debido a desincronización de la rama respecto a `origin/develop` (omite fixes de PR #40, #41 y #49, migraciones `028_`, `034_`, `071_` y `allowUnorderedMigrations`). Cuando `delegacion_id` o `usuario_delegado_id` son `NULL`, el endpoint descarta el registro existente y responde `404 Not Found`. | `GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001` (*Cuadrilla Aguas Lluvias Alfa*, `EN_MISION`, `delegacion_id = NULL`) y `.../c1000000-0000-4000-8000-000000000002` retornaron HTTP `404` en vivo contra PostgreSQL. | ABIERTO |
| `BUG-H22-API-02` | Alta | `src/modules/recursos-y-personal/cuadrilla.repository.ts` (L249-282), `cuadrilla.service.ts` (L208-242) | La consulta de `mision_activa` utiliza `.orderBy("mision.fecha_inicio", "desc")` sin `NULLS LAST` ni orden secundario determinista ni priorización de estado `EN_CURSO` sobre `DESPACHADA`. En PostgreSQL, `DESC` ordena `NULLS FIRST`, seleccionando una misión `DESPACHADA` sin `fecha_inicio` por encima de una misión `EN_CURSO`. Además, ante `fecha_inicio = NULL`, `fecha_despacho` cae en `mision.creado_en`, mezclando fecha de planificación con despacho efectivo. | Inspección de `cuadrilla.repository.ts` L267-270 y contraste con `mision.repository.ts` (inserción de misiones `DESPACHADA` con `fecha_inicio: null`). | ABIERTO |
| `BUG-H22-API-03` | Media | `package.json` (L3), `src/lib/openapi/index.ts` (L2162, L2291), `src/app/openapi.json/__tests__/route.test.ts` (L12), `cuadrilla.schema.ts` (L176-177) | Inconsistencia SemVer entre `package.json` (`0.11.0`) y `GET /openapi.json` (`info.version: "0.10.0"`). El endpoint `GET /api/cuadrillas/{id}` declara `security: [{ BearerAuth: [] }]`, pero `components.securitySchemes` no está registrado (`undefined` en el JSON generado) y coexiste con `bearerAuth`. Además, `route.test.ts` no valida la ruta ni los esquemas `MisionActivaCuadrilla` / `MisionActivaIncidente`, y se exponen campos duplicados `detalles` y `especificaciones`. | `curl -s http://localhost:3001/openapi.json` devolvió `version: "0.10.0"` y `securitySchemes: undefined`. | ABIERTO |
| `BUG-H22-API-04` | Media | `cuadrilla.service.ts` (L696), `src/app/api/cuadrillas/[id]/__tests__/route.test.ts` (L199, L499), `cuadrilla.repository.test.ts`, `035_cuadrilla_patrulla_integrantes_vistas.ts` | `npm run lint` falla con 3 errores `@typescript-eslint/no-explicit-any`. `cuadrilla.repository.test.ts` no prueba la consulta `mision_activa` ni la proyección de `usuario.telefono`, `recurso.descripcion` y `recurso.detalles`. La migración `035_cuadrilla_patrulla_integrantes_vistas.ts` carece de test `up`/`down`, no fue aplicada en la BD local y comparte prefijo `035_` con `035_permiso_misiones_terreno_verificar`. | Ejecución de `npm run lint` (exit code 1, 3 errores) y consulta `\dv` en PostgreSQL sin vistas `cuadrilla_integrante` ni `patrulla_integrante`. | ABIERTO |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H22-API-01` | Regresión INNER JOIN en obtenerCuadrillaDetalleUnitario y desincronización con origin/develop causa HTTP 404 en cuadrillas EN_MISION con FK nula | Defecto / Regresión & Git | Repositorio / Integración | Crítica | Cuadrilla existente en BD con estado EN_MISION y delegacion_id o usuario_delegado_id en NULL | `GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK retornando ficha de cuadrilla y misionActiva mediante leftJoin y rama sincronizada con origin/develop | HTTP 404 Not Found (`La cuadrilla operativa especificada no existe.`) y exclusión en listado por uso de innerJoin | ABIERTO | 12/11/2026 11:44 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H22-API-02` | Ordenamiento SQL ORDER BY mision.fecha_inicio DESC sin NULLS LAST ni desempate en mision_activa (CA-5) | Defecto / SQL & Lógica | Repositorio Kysely | Alta | Cuadrilla con misión DESPACHADA (fecha_inicio NULL) y misión EN_CURSO (fecha_inicio poblada) | Inspección de `obtenerCuadrillaDetalleUnitario` en `cuadrilla.repository.ts` L249-282 | Priorizar misión EN_CURSO y ordenar con `NULLS LAST` y `mision.creado_en DESC` | `orderBy("mision.fecha_inicio", "desc")` coloca NULLS FIRST en PostgreSQL y no desempata por estado ni creado_en | ABIERTO | 12/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H22-API-03` | Desalineación SemVer en OpenAPI (0.10.0 vs 0.11.0), ausencia de components.securitySchemes y duplicidad detalles/especificaciones | Defecto / Contrato OpenAPI | Contrato / Spec | Media | Servidor Next.js sirviendo `GET /openapi.json` y `package.json` en versión 0.11.0 | `GET http://localhost:3001/openapi.json` e inspección de `src/lib/openapi/index.ts` | `info.version: "0.11.0"`, `components.securitySchemes.BearerAuth` registrado y esquema sin duplicidad | `info.version: "0.10.0"`, `securitySchemes: undefined` y propiedad duplicada `detalles` / `especificaciones` | ABIERTO | 12/11/2026 11:45 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H22-API-04` | Errores ESLint no-explicit-any, ausencia de tests de repositorio para mision_activa/telefono y colisión de prefijo en migración 035_ | Defecto / Calidad & Cobertura | Estático / Unit Test / DB | Media | Rama `feature/H22-detalles-cuadrillas` y base PostgreSQL en contenedor local | `npm run lint`, `cuadrilla.repository.test.ts` y `\dv` en PostgreSQL | 0 errores ESLint, tests unitarios para mision_activa y migración 035_ verificada y aplicada | `npm run lint` falla con 3 errores `no-explicit-any`; 0 tests en repo para mision_activa; vistas no creadas en BD | ABIERTO | 12/11/2026 11:40 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H22-API-01` | Consulta exitosa de ficha técnica de cuadrilla DISPONIBLE por rol Encargado con permiso recursos:leer (CA-2, CA-7) | Funcional / API REST | Integración E2E | Crítica | Usuario `encargado@valdivia.cl` activo con permiso `recursos:leer` y cuadrilla `26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` en BD | `GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con nombre, delegacion, estado `DISPONIBLE`, delegado, trabajadores, recursos y `misionActiva: null` | HTTP 200 OK con payload completo de la cuadrilla `delta`, delegación Costa y delegado Supervisor Estratégico | APROBADO | 12/11/2026 11:44 | N/A | feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle |
| `CP-H22-API-02` | Consulta exitosa de ficha técnica de cuadrilla DISPONIBLE por rol Administrador | Seguridad / RBAC | Integración E2E | Alta | Usuario `admin@valdivia.cl` con rol `ADMIN` y cuadrilla `26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` en BD | `GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85` con `Authorization: Bearer <TOKEN_ADM>` | HTTP 200 OK con detalle consolidado de la cuadrilla | HTTP 200 OK retornando estructura `DetalleCuadrillaResponse` válida | APROBADO | 12/11/2026 11:45 | N/A | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H22-API-03` | Consulta en vivo de cuadrilla EN_MISION con recursos e incidente en ejecución en PostgreSQL (CA-2, CA-4, CA-5) | Funcional / API REST | Integración E2E | Crítica | Cuadrilla `c1000000-0000-4000-8000-000000000001` (`EN_MISION`) con misión `MIS-2026-0002` (`EN_CURSO`) e incidente vinculado en BD | `GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `estado: "EN_MISION"`, 3 recursos asignados, `misionActiva` e `incidente` | HTTP 404 Not Found (`La cuadrilla operativa especificada no existe.`) debido a `delegacion_id = NULL` e `innerJoin` (`BUG-H22-API-01`) | FALLIDO | 12/11/2026 11:44 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H22-API-04` | Consulta histórica de cuadrilla desactivada (NO_DISPONIBLE, activo=false) preservando recursos asignados | Trazabilidad / API REST | Integración E2E | Alta | Cuadrilla `79d547c8-180c-4258-8b29-4a968a18fe0d` dada de baja lógica con recurso histórico en BD | `GET /api/cuadrillas/79d547c8-180c-4258-8b29-4a968a18fe0d` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 200 OK con `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminadoEn` y lista histórica de recursos | HTTP 200 OK retornando 1 recurso (`Sacos de Arena de Contención Fluvial`, cantidad 1) y metadatos de baja lógica | APROBADO | 12/11/2026 11:44 | N/A | feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle |
| `CP-H22-API-05` | Proyección de nómina completa de integrantes incluyendo RUT, nombre, cargo, especialidad y teléfono de contacto (CA-3) | Funcional / Servicio & Route | Unitaria | Crítica | Mocks de repositorio y servicio en `cuadrilla.service.test.ts` y `route.test.ts` | Invocación de `obtenerCuadrillaPorId` y `GET` en Vitest con `telefono: "+56912345678"` | Arreglo `trabajadores` con `id`, `personalId`, `usuarioId`, `nombre`, `rut`, `cargo`, `especialidad`, `telefono` y `asignadoEn` | Tests en `cuadrilla.service.test.ts` y `route.test.ts` verifican `telefono`, `cargo`, `especialidad` y `rut` | APROBADO | 12/11/2026 11:39 | N/A | test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa |
| `CP-H22-API-06` | Proyección de recursos materiales, vehículos y herramientas con cantidades, descripción y especificaciones JSONB (CA-4) | Funcional / Servicio & Route | Unitaria | Alta | Mocks con recurso `Camioneta 4x4` (`cantidadAsignada: 1`, `detalles: { patente, marca, modelo }`) | Invocación de `obtenerCuadrillaPorId` y `GET` en Vitest | Arreglo `recursos` con `cantidadAsignada`, `esIndividual`, `descripcion` y `especificaciones` | Tests verifican `descripcion` y `especificaciones` con `{ patente: "KKLX-89", marca: "Toyota", modelo: "Hilux" }` | APROBADO | 12/11/2026 11:39 | N/A | test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa |
| `CP-H22-API-07` | Cálculo de tiempoTranscurridoMinutos y datos de incidente asociado en misionActiva cuando la cuadrilla está EN_MISION (CA-5) | Funcional / Servicio & Route | Unitaria | Crítica | Misión activa simulada con `fecha_despacho` 45 minutos atrás e incidente asociado | Invocación de `obtenerCuadrillaPorId` y `GET` en Vitest con mock `EN_MISION` | `misionActiva` no nulo con `tiempoTranscurridoMinutos` entre 44 y 46 e `incidente` con `id`, `codigo`, `tipo`, `direccion`, `latitud`, `longitud` | Aserciones de tiempo transcurrido (44..46 min) y coordenadas del incidente pasan correctamente | APROBADO | 12/11/2026 11:39 | N/A | test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa |
| `CP-H22-API-08` | Rechazo con HTTP 401 Unauthorized ante petición sin cabecera Authorization Bearer | Seguridad / Auth | Integración E2E | Crítica | Servidor API activo sin credenciales en la petición | `GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001` sin cabecera `Authorization` | HTTP 401 Unauthorized indicando necesidad de token Bearer | HTTP 401 Unauthorized (`Se requiere cabecera de autenticación Authorization: Bearer <token>.`) | APROBADO | 12/11/2026 11:44 | N/A | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H22-API-09` | Rechazo con HTTP 403 Forbidden para usuario sin permiso recursos:leer ni rol Encargado/Admin (CA-7) | Seguridad / RBAC | Integración E2E | Crítica | Usuario `callcenter@valdivia.cl` con rol `CALL_CENTER` sin permiso `recursos:leer` | `GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_CC>` | HTTP 403 Forbidden rechazando acceso al detalle de cuadrilla | HTTP 403 Forbidden (`{"statusCode":403,"error":"Forbidden",...}`) | APROBADO | 12/11/2026 11:44 | N/A | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H22-API-10` | Rechazo con HTTP 400 Bad Request cuando el parámetro id no corresponde a un UUID válido | Validación / Zod | Integración E2E | Media | Token JWT válido de Encargado | `GET /api/cuadrillas/id-invalido` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 400 Bad Request con detalle de validación de campo `id` | HTTP 400 Bad Request (`Identificador de cuadrilla inválido.`) con detalle en `errors` | APROBADO | 12/11/2026 11:44 | N/A | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H22-API-11` | Rechazo con HTTP 404 Not Found cuando el UUID de cuadrilla no existe en base de datos | Robustez / Negocio | Integración E2E | Alta | Token JWT válido de Encargado y UUID inexistente `99999999-9999-4999-8999-999999999999` | `GET /api/cuadrillas/99999999-9999-4999-8999-999999999999` con `Authorization: Bearer <TOKEN_ENC>` | HTTP 404 Not Found indicando que la cuadrilla no existe | HTTP 404 Not Found (`La cuadrilla operativa especificada no existe.`) | APROBADO | 12/11/2026 11:44 | N/A | feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79 |
| `CP-H22-API-12` | Verificación de migración 035_cuadrilla_patrulla_integrantes_vistas.ts, vistas en PostgreSQL y tipos Kysely | Esquema / DB | Migración & Tipos | Alta | Base PostgreSQL local y archivo `035_cuadrilla_patrulla_integrantes_vistas.ts` | Inspección de `035_...ts`, `src/lib/db/types.ts`, `kysely_migration` y `\dv` en psql | Vistas `cuadrilla_integrante` y `patrulla_integrante` creadas en BD sin colisión de prefijo y con test `up`/`down` | `CuadrillaIntegranteTable` y `PatrullaIntegranteTable` existen en `types.ts`, pero las vistas no existen en BD y existe colisión con `035_permiso_misiones_terreno_verificar` | FALLIDO | 12/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H22-API-13` | Validación del contrato OpenAPI 3.0 en GET /openapi.json para GET /api/cuadrillas/{id}, versión y seguridad | Contrato OpenAPI | API / Spec | Media | Servidor activo y test `src/app/openapi.json/__tests__/route.test.ts` | `curl -s http://localhost:3001/openapi.json` | Versión `0.11.0`, esquema `BearerAuth` definido en `components.securitySchemes` y esquemas `MisionActiva*` registrados | `MisionActiva*` registrados, pero `info.version` sigue en `0.10.0` y `components.securitySchemes` es `undefined` | FALLIDO | 12/11/2026 11:45 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H22-API-14` | Actualización de documentación técnica en docs/api/recursos-y-personal.md y docs/database/README.md | Documentación | Docs Técnicas | Media | Revisión de `docs/api/recursos-y-personal.md` §3.10 y `docs/database/README.md` | Inspección de `git diff develop...HEAD -- docs/` | Sección §3.10 y diccionario de datos documentan integrantes, especificaciones, misión activa y vista `cuadrilla_integrante` | Documentación actualizada acorde al contrato implementado | APROBADO | 12/11/2026 11:39 | N/A | feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle |
| `CP-H22-API-15` | Ejecución de suites automatizadas Vitest (módulo Cuadrillas y global) y análisis estático ESLint | Automatización QA | Unit / Estático | Alta | Entorno Node.js con dependencias instaladas | `npx vitest run ...`, `npm test` y `npm run lint` | 100% de pruebas unitarias pasando y 0 errores ESLint | Vitest aprueba 72/72 en Cuadrillas y 704/704 global, pero `npm run lint` falla con 3 errores `no-explicit-any` (`BUG-H22-API-04`) | FALLIDO | 12/11/2026 11:40 | (Pendiente) | Pendiente (Rechazado en Code Review) |

---

### 3.1. Bloque TSV para Exportación Tabular

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H22-API-01	Regresión INNER JOIN en obtenerCuadrillaDetalleUnitario y desincronización con origin/develop causa HTTP 404 en cuadrillas EN_MISION con FK nula	Defecto / Regresión & Git	Repositorio / Integración	Crítica	Cuadrilla existente en BD con estado EN_MISION y delegacion_id o usuario_delegado_id en NULL	GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK retornando ficha de cuadrilla y misionActiva mediante leftJoin y rama sincronizada con origin/develop	HTTP 404 Not Found (La cuadrilla operativa especificada no existe.) y exclusión en listado por uso de innerJoin	ABIERTO	12/11/2026 11:44	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H22-API-02	Ordenamiento SQL ORDER BY mision.fecha_inicio DESC sin NULLS LAST ni desempate en mision_activa (CA-5)	Defecto / SQL & Lógica	Repositorio Kysely	Alta	Cuadrilla con misión DESPACHADA (fecha_inicio NULL) y misión EN_CURSO (fecha_inicio poblada)	Inspección de obtenerCuadrillaDetalleUnitario en cuadrilla.repository.ts L249-282	Priorizar misión EN_CURSO y ordenar con NULLS LAST y mision.creado_en DESC	orderBy("mision.fecha_inicio", "desc") coloca NULLS FIRST en PostgreSQL y no desempata por estado ni creado_en	ABIERTO	12/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H22-API-03	Desalineación SemVer en OpenAPI (0.10.0 vs 0.11.0), ausencia de components.securitySchemes y duplicidad detalles/especificaciones	Defecto / Contrato OpenAPI	Contrato / Spec	Media	Servidor Next.js sirviendo GET /openapi.json y package.json en versión 0.11.0	GET http://localhost:3001/openapi.json e inspección de src/lib/openapi/index.ts	info.version: "0.11.0", components.securitySchemes.BearerAuth registrado y esquema sin duplicidad	info.version: "0.10.0", securitySchemes: undefined y propiedad duplicada detalles / especificaciones	ABIERTO	12/11/2026 11:45	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H22-API-04	Errores ESLint no-explicit-any, ausencia de tests de repositorio para mision_activa/telefono y colisión de prefijo en migración 035_	Defecto / Calidad & Cobertura	Estático / Unit Test / DB	Media	Rama feature/H22-detalles-cuadrillas y base PostgreSQL en contenedor local	npm run lint, cuadrilla.repository.test.ts y \dv en PostgreSQL	0 errores ESLint, tests unitarios para mision_activa y migración 035_ verificada y aplicada	npm run lint falla con 3 errores no-explicit-any; 0 tests en repo para mision_activa; vistas no creadas en BD	ABIERTO	12/11/2026 11:40	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H22-API-01	Consulta exitosa de ficha técnica de cuadrilla DISPONIBLE por rol Encargado con permiso recursos:leer (CA-2, CA-7)	Funcional / API REST	Integración E2E	Crítica	Usuario encargado@valdivia.cl activo con permiso recursos:leer y cuadrilla 26c3b3d7-1cf3-409b-9d4e-eb49d6369a85 en BD	GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con nombre, delegacion, estado DISPONIBLE, delegado, trabajadores, recursos y misionActiva: null	HTTP 200 OK con payload completo de la cuadrilla delta, delegación Costa y delegado Supervisor Estratégico	APROBADO	12/11/2026 11:44	N/A	feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle
CP-H22-API-02	Consulta exitosa de ficha técnica de cuadrilla DISPONIBLE por rol Administrador	Seguridad / RBAC	Integración E2E	Alta	Usuario admin@valdivia.cl con rol ADMIN y cuadrilla 26c3b3d7-1cf3-409b-9d4e-eb49d6369a85 en BD	GET /api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85 con Authorization: Bearer <TOKEN_ADM>	HTTP 200 OK con detalle consolidado de la cuadrilla	HTTP 200 OK retornando estructura DetalleCuadrillaResponse válida	APROBADO	12/11/2026 11:45	N/A	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H22-API-03	Consulta en vivo de cuadrilla EN_MISION con recursos e incidente en ejecución en PostgreSQL (CA-2, CA-4, CA-5)	Funcional / API REST	Integración E2E	Crítica	Cuadrilla c1000000-0000-4000-8000-000000000001 (EN_MISION) con misión MIS-2026-0002 (EN_CURSO) e incidente vinculado en BD	GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con estado EN_MISION, 3 recursos asignados, misionActiva e incidente	HTTP 404 Not Found (La cuadrilla operativa especificada no existe.) debido a delegacion_id = NULL e innerJoin (BUG-H22-API-01)	FALLIDO	12/11/2026 11:44	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H22-API-04	Consulta histórica de cuadrilla desactivada (NO_DISPONIBLE, activo=false) preservando recursos asignados	Trazabilidad / API REST	Integración E2E	Alta	Cuadrilla 79d547c8-180c-4258-8b29-4a968a18fe0d dada de baja lógica con recurso histórico en BD	GET /api/cuadrillas/79d547c8-180c-4258-8b29-4a968a18fe0d con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con activo: false, estado: NO_DISPONIBLE, eliminadoEn y lista histórica de recursos	HTTP 200 OK retornando 1 recurso (Sacos de Arena de Contención Fluvial, cantidad 1) y metadatos de baja lógica	APROBADO	12/11/2026 11:44	N/A	feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle
CP-H22-API-05	Proyección de nómina completa de integrantes incluyendo RUT, nombre, cargo, especialidad y teléfono de contacto (CA-3)	Funcional / Servicio & Route	Unitaria	Crítica	Mocks de repositorio y servicio en cuadrilla.service.test.ts y route.test.ts	Invocación de obtenerCuadrillaPorId y GET en Vitest con telefono: +56912345678	Arreglo trabajadores con id, personalId, usuarioId, nombre, rut, cargo, especialidad, telefono y asignadoEn	Tests en cuadrilla.service.test.ts y route.test.ts verifican telefono, cargo, especialidad y rut	APROBADO	12/11/2026 11:39	N/A	test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa
CP-H22-API-06	Proyección de recursos materiales, vehículos y herramientas con cantidades, descripción y especificaciones JSONB (CA-4)	Funcional / Servicio & Route	Unitaria	Alta	Mocks con recurso Camioneta 4x4 (cantidadAsignada: 1, detalles: { patente, marca, modelo })	Invocación de obtenerCuadrillaPorId y GET en Vitest	Arreglo recursos con cantidadAsignada, esIndividual, descripcion y especificaciones	Tests verifican descripcion y especificaciones con { patente: KKLX-89, marca: Toyota, modelo: Hilux }	APROBADO	12/11/2026 11:39	N/A	test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa
CP-H22-API-07	Cálculo de tiempoTranscurridoMinutos y datos de incidente asociado en misionActiva cuando la cuadrilla está EN_MISION (CA-5)	Funcional / Servicio & Route	Unitaria	Crítica	Misión activa simulada con fecha_despacho 45 minutos atrás e incidente asociado	Invocación de obtenerCuadrillaPorId y GET en Vitest con mock EN_MISION	misionActiva no nulo con tiempoTranscurridoMinutos entre 44 y 46 e incidente con id, codigo, tipo, direccion, latitud, longitud	Aserciones de tiempo transcurrido (44..46 min) y coordenadas del incidente pasan correctamente	APROBADO	12/11/2026 11:39	N/A	test(cuadrillas): agregar pruebas unitarias y de endpoint para telefono de integrantes y mision activa
CP-H22-API-08	Rechazo con HTTP 401 Unauthorized ante petición sin cabecera Authorization Bearer	Seguridad / Auth	Integración E2E	Crítica	Servidor API activo sin credenciales en la petición	GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001 sin cabecera Authorization	HTTP 401 Unauthorized indicando necesidad de token Bearer	HTTP 401 Unauthorized (Se requiere cabecera de autenticación Authorization: Bearer <token>.)	APROBADO	12/11/2026 11:44	N/A	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H22-API-09	Rechazo con HTTP 403 Forbidden para usuario sin permiso recursos:leer ni rol Encargado/Admin (CA-7)	Seguridad / RBAC	Integración E2E	Crítica	Usuario callcenter@valdivia.cl con rol CALL_CENTER sin permiso recursos:leer	GET /api/cuadrillas/c1000000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_CC>	HTTP 403 Forbidden rechazando acceso al detalle de cuadrilla	HTTP 403 Forbidden ({"statusCode":403,"error":"Forbidden",...})	APROBADO	12/11/2026 11:44	N/A	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H22-API-10	Rechazo con HTTP 400 Bad Request cuando el parámetro id no corresponde a un UUID válido	Validación / Zod	Integración E2E	Media	Token JWT válido de Encargado	GET /api/cuadrillas/id-invalido con Authorization: Bearer <TOKEN_ENC>	HTTP 400 Bad Request con detalle de validación de campo id	HTTP 400 Bad Request (Identificador de cuadrilla inválido.) con detalle en errors	APROBADO	12/11/2026 11:44	N/A	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H22-API-11	Rechazo con HTTP 404 Not Found cuando el UUID de cuadrilla no existe en base de datos	Robustez / Negocio	Integración E2E	Alta	Token JWT válido de Encargado y UUID inexistente 99999999-9999-4999-8999-999999999999	GET /api/cuadrillas/99999999-9999-4999-8999-999999999999 con Authorization: Bearer <TOKEN_ENC>	HTTP 404 Not Found indicando que la cuadrilla no existe	HTTP 404 Not Found (La cuadrilla operativa especificada no existe.)	APROBADO	12/11/2026 11:44	N/A	feat(recursos-y-personal): implementar endpoints GET y POST de cuadrillas operativas H81 H79
CP-H22-API-12	Verificación de migración 035_cuadrilla_patrulla_integrantes_vistas.ts, vistas en PostgreSQL y tipos Kysely	Esquema / DB	Migración & Tipos	Alta	Base PostgreSQL local y archivo 035_cuadrilla_patrulla_integrantes_vistas.ts	Inspección de 035_...ts, src/lib/db/types.ts, kysely_migration y \dv en psql	Vistas cuadrilla_integrante y patrulla_integrante creadas en BD sin colisión de prefijo y con test up/down	CuadrillaIntegranteTable y PatrullaIntegranteTable existen en types.ts, pero las vistas no existen en BD y existe colisión con 035_permiso_misiones_terreno_verificar	FALLIDO	12/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H22-API-13	Validación del contrato OpenAPI 3.0 en GET /openapi.json para GET /api/cuadrillas/{id}, versión y seguridad	Contrato OpenAPI	API / Spec	Media	Servidor activo y test src/app/openapi.json/__tests__/route.test.ts	curl -s http://localhost:3001/openapi.json	Versión 0.11.0, esquema BearerAuth definido en components.securitySchemes y esquemas MisionActiva* registrados	MisionActiva* registrados, pero info.version sigue en 0.10.0 y components.securitySchemes es undefined	FALLIDO	12/11/2026 11:45	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H22-API-14	Actualización de documentación técnica en docs/api/recursos-y-personal.md y docs/database/README.md	Documentación	Docs Técnicas	Media	Revisión de docs/api/recursos-y-personal.md §3.10 y docs/database/README.md	Inspección de git diff develop...HEAD -- docs/	Sección §3.10 y diccionario de datos documentan integrantes, especificaciones, misión activa y vista cuadrilla_integrante	Documentación actualizada acorde al contrato implementado	APROBADO	12/11/2026 11:39	N/A	feat(cuadrillas): incorporar telefono de integrantes, especificaciones y mision activa en detalle
CP-H22-API-15	Ejecución de suites automatizadas Vitest (módulo Cuadrillas y global) y análisis estático ESLint	Automatización QA	Unit / Estático	Alta	Entorno Node.js con dependencias instaladas	npx vitest run ..., npm test y npm run lint	100% de pruebas unitarias pasando y 0 errores ESLint	Vitest aprueba 72/72 en Cuadrillas y 704/704 global, pero npm run lint falla con 3 errores no-explicit-any (BUG-H22-API-04)	FALLIDO	12/11/2026 11:40	(Pendiente)	Pendiente (Rechazado en Code Review)
````

---

## 4. Guía Detallada de Ejecución Paso a Paso

### 4.1. Pruebas Automatizadas en Vitest (Módulo Cuadrillas y Suite Global)

#### Comando — Módulo de Cuadrillas:
```bash
npx vitest run src/app/api/cuadrillas src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts
```

**Salida Obtenida:**
```text
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts (8 tests) 11ms
 ✓ src/app/api/cuadrillas/__tests__/route.test.ts (8 tests) 23ms
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts (33 tests) 41ms
 ✓ src/app/api/cuadrillas/[id]/__tests__/route.test.ts (23 tests) 33ms

 Test Files  4 passed (4)
      Tests  72 passed (72)
   Start at  11:39:58
   Duration  862ms
```

#### Comando — Suite Específica de HU-22 (Filtro `-t`):
```bash
npm test -- -t "obtenerCuadrillaPorId|GET /api/cuadrillas/\[id\]"
```

#### Comando — Suite Completa del Repositorio:
```bash
npm test
```

**Salida Obtenida:**
```text
 Test Files  59 passed (59)
      Tests  704 passed (704)
   Start at  11:40:44
   Duration  4.72s
```

---

### 4.2. Análisis Estático (ESLint) y Verificación de Tipos (TypeScript)

#### Comando ESLint:
```bash
npm run lint
```

**Salida Obtenida (Exit code 1):**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/app/api/cuadrillas/[id]/__tests__/route.test.ts
  199:102  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  499:92   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/modules/recursos-y-personal/cuadrilla.service.ts
  696:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 12 problems (3 errors, 9 warnings)
```

---

### 4.3. Pruebas de Integración en Vivo vía cURL (contra PostgreSQL 16 + PostGIS)

#### Paso 1 — Obtener Tokens JWT de Encargado, Administrador y Call Center:
```bash
TOKEN_ENC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token ?? d.accessToken ?? d.data?.token ?? "")')

TOKEN_ADM=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"admin@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token ?? d.accessToken ?? d.data?.token ?? "")')

TOKEN_CC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token ?? d.accessToken ?? d.data?.token ?? "")')
```

#### Paso 2 — `CP-H22-API-01`: Consultar Cuadrilla `DISPONIBLE` con Perfil Encargado (`200 OK`):
```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/26c3b3d7-1cf3-409b-9d4e-eb49d6369a85 \
  -H "Authorization: Bearer $TOKEN_ENC"
```
**Respuesta Real Obtenida:**
```json
{
  "message": "Detalle de cuadrilla operativa obtenido exitosamente",
  "data": {
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
    "misionActiva": null,
    "creadoEn": "2026-11-03T21:10:08.355Z",
    "actualizadoEn": "2026-11-10T02:27:33.782Z",
    "actualizadoPorId": "00000000-0000-4000-8000-000000000003",
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "eliminadoEn": null,
    "eliminadoPorId": null
  }
}
HTTP_CODE:200
```

#### Paso 3 — `CP-H22-API-03` / `BUG-H22-API-01`: Consultar Cuadrilla `EN_MISION` con `delegacion_id = NULL` (`404 Not Found` — Fallido):
```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/c1000000-0000-4000-8000-000000000001 \
  -H "Authorization: Bearer $TOKEN_ENC"
```
**Respuesta Real Obtenida:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "La cuadrilla operativa especificada no existe."
}
HTTP_CODE:404
```

#### Paso 4 — `CP-H22-API-04`: Consultar Cuadrilla Desactivada (`NO_DISPONIBLE`, `activo: false`, con recurso histórico):
```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/79d547c8-180c-4258-8b29-4a968a18fe0d \
  -H "Authorization: Bearer $TOKEN_ENC"
```
**Respuesta Real Obtenida:**
```json
{
  "message": "Detalle de cuadrilla operativa obtenido exitosamente",
  "data": {
    "id": "79d547c8-180c-4258-8b29-4a968a18fe0d",
    "nombre": "Cuadrilla",
    "estado": "NO_DISPONIBLE",
    "activo": false,
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "nombre": "Delegación Municipal Norte",
      "codigo": "DEL_NORTE"
    },
    "delegado": {
      "id": "00000000-0000-4000-8000-000000000010",
      "nombre": "Supervisor Estratégico",
      "email": "supervisor@valdivia.cl",
      "rut": "44444444-4"
    },
    "recursos": [
      {
        "id": "9cd2ac73-9b42-492c-81a8-c697b31b8539",
        "recursoId": "e1000000-0000-4000-8000-000000000004",
        "nombre": "Sacos de Arena de Contención Fluvial",
        "cantidadAsignada": 1,
        "esIndividual": false,
        "descripcion": "Sacos para diques provisionales de desborde y protección domiciliaria",
        "detalles": {},
        "especificaciones": {}
      }
    ],
    "trabajadores": [],
    "totalRecursos": 1,
    "totalTrabajadores": 0,
    "misionActiva": null,
    "creadoEn": "2026-11-03T21:05:11.746Z",
    "actualizadoEn": "2026-11-03T21:08:27.454Z",
    "actualizadoPorId": "00000000-0000-4000-8000-000000000001",
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "eliminadoEn": "2026-11-03T21:08:27.454Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
  }
}
HTTP_CODE:200
```

#### Paso 5 — `CP-H22-API-08`, `CP-H22-API-09`, `CP-H22-API-10`, `CP-H22-API-11`: Seguridad y Validación de Parámetros:
```bash
# 401 Unauthorized (Sin token)
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/c1000000-0000-4000-8000-000000000001

# 403 Forbidden (Usuario Call Center sin recursos:leer)
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/c1000000-0000-4000-8000-000000000001 \
  -H "Authorization: Bearer $TOKEN_CC"

# 400 Bad Request (UUID inválido)
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/id-invalido \
  -H "Authorization: Bearer $TOKEN_ENC"

# 404 Not Found (UUID inexistente)
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  http://localhost:3001/api/cuadrillas/99999999-9999-4999-8999-999999999999 \
  -H "Authorization: Bearer $TOKEN_ENC"
```
**Respuestas Reales Obtenidas:**
```json
{"statusCode":401,"error":"Unauthorized","message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
HTTP_CODE:401

{"statusCode":403,"error":"Forbidden","message":"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."}
HTTP_CODE:403

{"statusCode":400,"error":"Bad Request","message":"Identificador de cuadrilla inválido.","errors":[{"campo":"id","mensaje":"El identificador de cuadrilla debe ser un UUID válido"}]}
HTTP_CODE:400

{"statusCode":404,"error":"Not Found","message":"La cuadrilla operativa especificada no existe."}
HTTP_CODE:404
```

#### Paso 6 — `CP-H22-API-13` / `BUG-H22-API-03`: Inspección de Especificación OpenAPI en Vivo:
```bash
curl -s http://localhost:3001/openapi.json | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("version:", d.info.version); console.log("securitySchemes:", JSON.stringify(d.components.securitySchemes));'
```
**Salida Real Obtenida:**
```text
version: 0.10.0
securitySchemes: undefined
```

---

## 5. Matriz de Trazabilidad de Criterios de Aceptación (HU-22)

| Criterio de Aceptación (CA) | Capa Responsable | Casos / Defectos Asociados | Cobertura y Estado en `sgrai-api` |
|---|---|---|---|
| **CA-1:** Desplegar modal o drawer lateral al hacer clic sobre cuadrilla en tabla o mapa. | Frontend (`sgrai-web`) | Fuera de alcance `sgrai-api` | N/A en repositorio backend. |
| **CA-2:** Consultar `GET /api/cuadrillas/{id}` y mostrar nombre, delegación base, estado (`DISPONIBLE`, `EN_MISION`, `NO_DISPONIBLE`) y delegado responsable. | Backend (`sgrai-api`) | `CP-H22-API-01`, `CP-H22-API-02`, `CP-H22-API-03`, `BUG-H22-API-01` | 🔴 **Parcial / Fallido**: Falla con HTTP `404` cuando `delegacion_id` o `usuario_delegado_id` es `NULL` debido a `innerJoin` (`BUG-H22-API-01`). |
| **CA-3:** Listar nómina completa de funcionarios integrantes desde `cuadrilla_integrante` (RUT, nombre completo, cargo/especialidad y teléfono). | Backend (`sgrai-api`) | `CP-H22-API-05`, `CP-H22-API-12`, `BUG-H22-API-04` | 🟡 **Parcial**: Proyección de `telefono`, `rut`, `cargo` y `especialidad` implementada en `cuadrilla_personal`, pero migración `035_` con vista `cuadrilla_integrante` pendiente de ejecución y sin test unitario de repositorio/migración. |
| **CA-4:** Desplegar lista de recursos materiales, vehículos y herramientas (`cuadrilla_recurso`) indicando cantidades y especificaciones. | Backend (`sgrai-api`) | `CP-H22-API-04`, `CP-H22-API-06`, `BUG-H22-API-03` | 🟢 **Aprobado con observación**: Expone `cantidadAsignada`, `descripcion` y `especificaciones` (duplicado con `detalles` en OpenAPI). |
| **CA-5:** Si la cuadrilla está `EN_MISION`, mostrar enlace directo al incidente en atención y tiempo transcurrido desde el despacho. | Backend (`sgrai-api`) | `CP-H22-API-03`, `CP-H22-API-07`, `BUG-H22-API-01`, `BUG-H22-API-02` | 🔴 **Fallido**: Falla en vivo por `BUG-H22-API-01` y presenta ordenamiento defectuoso `ORDER BY fecha_inicio DESC` sin `NULLS LAST` (`BUG-H22-API-02`). |
| **CA-6:** Utilizar CSS Modules y paleta institucional, sin emojis. | Frontend (`sgrai-web`) | Fuera de alcance `sgrai-api` | N/A en repositorio backend. |
| **CA-7:** Requerir permiso RBAC `recursos:leer` o pertenecer al rol Encargado. | Backend (`sgrai-api`) | `CP-H22-API-01`, `CP-H22-API-08`, `CP-H22-API-09` | 🟢 **Aprobado**: Validado en vivo con `encargado@valdivia.cl` (`200 OK`), `callcenter@valdivia.cl` (`403 Forbidden`) y sin token (`401 Unauthorized`). |
