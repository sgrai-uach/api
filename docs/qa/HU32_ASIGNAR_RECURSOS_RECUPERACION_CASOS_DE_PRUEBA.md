# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-32 — Asignar Patrulla y Recursos Logísticos a Evento de Recuperación (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Recuperación (Sección de Operaciones y Logística ICS — Despacho Operativo y Control de Inventario Híbrido).  
> **Historia de Usuario:** HU-32 — *"Como Encargado Quiero asignar patrullas y recursos logísticos a eventos de recuperación comunal para coordinar las labores post-emergencia. Para mantener el control centralizado de los equipos y materiales destinados a la mitigación y apoyo posterior a desastres en los sectores afectados."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H32-asignar-recursos-recuperacion`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): migracion 035 y tipos kysely agregando mision_id a recuperacion_recurso (HU-32)`  
> * `feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32)`  
> * `feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)`  
> * `feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)`  
> * `test(eventos-atp): pruebas unitarias y de integracion para asignacion de recuperacion (HU-32)`  
> * `docs(api): documentar endpoints de recuperacion y eventos websocket en tiempo real (HU-32)`  
> * `chore(db): renumerar migracion a 041_recuperacion_recurso_mision_id (HU-32)`  
> * `fix(patrullas): eliminar duplicados y preservar paginacion exacta en GET /api/patrullas`  
> * `feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente`  
> * `test(eventos-atp): actualizar pruebas de listado y detalle de recuperacion`  
> * `chore(seed): agregar script seed-recuperacion y documentar GET /api/eventos-atp/recuperacion`  
> * `merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion`  
> * `fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07`  
> * `merge: integrar documentacion de casos de prueba remota de HU-32`  
> * `chore: agregar script seed:h74 a package.json`  
>  
> **Fecha de Auditoría Inicial:** 16/11/2026 23:50  
> **Fecha de Re-Test:** 18/11/2026 16:36  
> **Estado de Dictamen:** 🟢 **APROBADO (100% PASS TRAS RE-TEST DE LOS 7 DEFECTOS)**

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras el ciclo de Re-Test realizado sobre la rama `feature/H32-asignar-recursos-recuperacion` (incluyendo la inspección de código de las correcciones aplicadas en `fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07`, la sincronización con `origin/develop`, la ejecución de migraciones Kysely, pruebas unitarias y de contrato en Vitest, análisis estático de tipos y ESLint, compilación de producción Next.js Turbopack y validación E2E en servidor vivo contra PostgreSQL 16, Redis Pub/Sub y WebSockets), se certifica la subsanación íntegra de los **7 defectos detectados en la auditoría inicial** (`BUG-H32-API-01` a `BUG-H32-API-07`).

| Métrica de Calidad | Resultado Re-Test (18/11/2026 16:36) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **26** | 7 Defectos Subsanados (`BUG-H32-API-01` a `07`) + 19 Casos Funcionales, Seguridad/RBAC, Reglas §3.6/ICS, HTTP, BD y Build (`CP-H32-API-01` a `19`) |
| **Casos Aprobados (`APROBADO`)** | **26** | 100% de los casos aprobados tras el Re-Test |
| **Defectos Abiertos (`ABIERTO`)** | **0** | Todos los hallazgos fueron corregidos y verificados en ejecución real |
| **Casos Bloqueados (`BLOQUEADO`)** | **0** | Bloqueo de migración resuelto tras sincronización con `origin/develop` |
| **Tasa de Aprobación Global (% Pass)** | **100%** | 26 aprobados de 26 registros en matriz (`26/26`) |
| **Suite Completa del Repositorio (`npm test`)** | **875/875 tests pass** | 75 archivos de prueba ejecutados sin fallos (`Test Files 75 passed (75)`) |
| **Suite Focalizada HU-32 y OpenAPI** | **53/53 tests pass** | 6 archivos de prueba (`Test Files 6 passed (6)`) |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | **0 errores / 0 advertencias** | `npx next typegen && npx tsc --noEmit`: exit 0; `npm run lint`: exit 0 |
| **Compilación de Producción (`npm run build`)** | **Exitosa** | Next.js 16.3.4 Turbopack compila todas las rutas, incluyendo HU-32 y `/openapi.json` |
| **Ejecución de Migraciones (`npm run db:migrate`)** | 🟢 **Exitosa** | Sincronización limpia con `origin/develop`; migración `041_recuperacion_recurso_mision_id` aplicada en PostgreSQL |

---

## 2. Registro Técnico de Defectos Detectados y Certificados en Re-Test

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H32-API-01` | **Condición de carrera TOCTOU en `patrulla_verificadora` y `recuperacion`:** `buscarPatrullaPorId` y `buscarRecuperacionPorId` carecían de `.forUpdate()`, y `actualizarEstadoPatrulla` actualizaba sin `.where("estado", "=", "DISPONIBLE")` ni verificación de filas afectadas. | Crítica | `src/modules/eventos-atp/recuperacion.repository.ts`, `src/modules/eventos-atp/recuperacion.service.ts` | 16/11/2026 23:50 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 16:36 | 🟢 CORREGIDO |
| `BUG-H32-API-02` | **Colisión de correlativos concurrentes (`23505` -> HTTP 500) en `mision.codigo` y `recuperacion.codigo`:** Se utilizaba conteo simple sin bloqueo consultivo transaccional (`pg_advisory_xact_lock`) ni cálculo sobre el correlativo máximo. | Alta | `src/modules/eventos-atp/recuperacion.repository.ts` | 16/11/2026 23:50 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 16:36 | 🟢 CORREGIDO |
| `BUG-H32-API-03` | **Violación §3.6 en activos individuales (`es_individual = true`):** Se omitía validar saldo libre (`cantidad_inventario - cantidad_en_uso >= 1`) y se sobrescribía fijamente `cantidad_en_uso: 1`, corrompiendo activos multiunidad. | Crítica | `src/modules/eventos-atp/recuperacion.service.ts`, `src/modules/eventos-atp/recuperacion.repository.ts` | 16/11/2026 23:50 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 16:36 | 🟢 CORREGIDO |
| `BUG-H32-API-04` | **Invariantes ICS de misión y mutación errónea de `personal.disponible_terreno`:** `insertarMisionRecuperacion` fijaba `fecha_inicio` no nula al despachar, omitía el hito en `mision_hito` y desactivaba `personal.disponible_terreno`. | Alta | `src/modules/eventos-atp/recuperacion.repository.ts`, `src/modules/eventos-atp/recuperacion.service.ts` | 16/11/2026 23:50 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 16:36 | 🟢 CORREGIDO |
| `BUG-H32-API-05` | **Difusión incompleta en Redis Pub/Sub y payload WebSocket en `snake_case`:** En rama Redis faltaban salas operativas (`encargado`, `mapa`, `supervisor`) y `recurso:actualizado` se emitía sin normalización camelCase ni `cantidadDisponible`. | Media | `src/lib/socket/index.ts`, `src/modules/eventos-atp/recuperacion.service.ts` | 16/11/2026 23:50 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 16:36 | 🟢 CORREGIDO |
| `BUG-H32-API-06` | **Discrepancia OpenAPI / documentación vs `auth.guard.ts` (`x-user-id`), versión desfasada y cobertura de test:** OpenAPI documentaba `x-user-id` sin `BearerAuth` y omitía aserciones HU-32 en `src/app/openapi.json/__tests__/route.test.ts`. | Media | `src/lib/openapi/index.ts`, `docs/api/eventos-atp.md`, `src/app/openapi.json/__tests__/route.test.ts` | 16/11/2026 23:50 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 16:36 | 🟢 CORREGIDO |
| `BUG-H32-API-07` | **Desincronización con `origin/develop` y bloqueo de migración `041_recuperacion_recurso_mision_id`:** Conflicto en `package.json` y error de Kysely por migraciones previas (`035_`..`071_`) faltantes en la rama. | Alta | `package.json`, `src/lib/db/migrator.ts`, `src/lib/db/migrations/041_recuperacion_recurso_mision_id.ts` | 16/11/2026 23:50 | merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion | 18/11/2026 16:36 | 🟢 CORREGIDO |

### `BUG-H32-API-01`: Condición de Carrera TOCTOU sobre `patrulla_verificadora` y `recuperacion`
* **Severidad:** Crítica
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts` (`buscarRecuperacionPorId`, `buscarPatrullaPorId`, `actualizarEstadoPatrulla`)
  * `src/modules/eventos-atp/recuperacion.service.ts` (`asignarRecursosRecuperacionService`)
* **Verificación Técnica del Fix:**
  * `buscarRecuperacionPorId(..., true)` y `buscarPatrullaPorId(..., true)` aplican `.forUpdate()` dentro de la transacción ACID en Kysely.
  * `actualizarEstadoPatrulla` condiciona el `UPDATE` con `.where("estado", "=", "DISPONIBLE").where("eliminado_en", "is", null).where("activo", "=", true).returning(...)`, y el servicio lanza `PatrullaNoDisponibleError` (`409 Conflict`) si no se actualiza fila.
  * Validado en prueba real concurrente contra PostgreSQL ejecutando dos peticiones `POST /api/eventos-atp/recuperacion/{id}/asignar` simultáneas sobre la misma patrulla (`200 OK` + `409 Conflict`, sin doble misión ni doble descuento de stock).

### `BUG-H32-API-02`: Colisión de Correlativos Concurrentes en Códigos de Misión y Recuperación
* **Severidad:** Alta
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivo Afectado:** `src/modules/eventos-atp/recuperacion.repository.ts` (`generarSiguienteCodigoRecuperacion`, `generarSiguienteCodigoMision`)
* **Verificación Técnica del Fix:**
  * Ambas funciones adquieren bloqueo consultivo transaccional `pg_advisory_xact_lock` y consultan el registro máximo mediante `.orderBy("codigo", "desc").limit(1)` antes de calcular el siguiente correlativo.
  * Validado en pruebas concurrentes en PostgreSQL real generando `MIS-2026-0015` y `MIS-2026-0016` sin colisión `23505` ni errores HTTP `500`.

### `BUG-H32-API-03`: Validación §3.6 de Saldo Libre y Conteo Multiunidad en Activos Individuales (`es_individual = true`)
* **Severidad:** Crítica
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts` (`asignarRecursosRecuperacionService`)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (`actualizarRecursoIndividualAsignado`)
* **Verificación Técnica del Fix:**
  * Para `es_individual = true`, el servicio valida `disponible = Math.max(0, inventario - enUso) >= 1` además de rechazar `EN_MANTENCION`, `NO_DISPONIBLE` y `ASIGNADO` (`409 Conflict`) y cantidades `> 1` (`400 Bad Request`).
  * `actualizarRecursoIndividualAsignado` calcula `nuevoEnUso = enUsoActual + 1` y deriva `nuevoEstado` (`ASIGNADO` cuando `nuevoDisponible === 0`, `BAJO_STOCK` cuando `nuevoDisponible <= cantidadMinima`, o `DISPONIBLE` en caso contrario).
  * Validado en vivo con `Motosierra Stihl MS 382 Profesional` (`cantidad_inventario: 6`, `cantidad_en_uso: 2`, `cantidad_minima: 2`), transicionando correctamente a `cantidadEnUso: 3` y conservando `estadoRecurso: "DISPONIBLE"`, y rechazando con `409 Conflict` activos en `EN_MANTENCION` y `ASIGNADO`.

### `BUG-H32-API-04`: Invariantes ICS de Misión (`fecha_inicio: null`, Hito en `mision_hito`) y Preservación de `personal.disponible_terreno`
* **Severidad:** Alta
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts` (`insertarMisionRecuperacion`, `registrarHitoMisionInicial`, `actualizarEstadoPersonalLider`)
  * `src/modules/eventos-atp/recuperacion.service.ts` (`asignarRecursosRecuperacionService`)
* **Verificación Técnica del Fix:**
  * `insertarMisionRecuperacion` crea la misión en estado `"DESPACHADA"` con `fecha_inicio: null`.
  * `registrarHitoMisionInicial` inserta el hito `"DESPACHADA"` en `mision_hito` dentro de la misma transacción.
  * `actualizarEstadoPersonalLider` actualiza únicamente `usuario.estado_operativo` sin mutar `personal.disponible_terreno`.
  * Verificado en PostgreSQL y vía `GET /api/misiones/{id}` (`fechaInicio: null`, `bitacoraTiempos[0].hito: "DESPACHADA"`, `personal.disponible_terreno: true`).

### `BUG-H32-API-05`: Difusión Completa en Redis Pub/Sub y Normalización camelCase WebSocket
* **Severidad:** Media
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (`emitirRecursoActualizado`, `emitirRecuperacionActualizada`)
  * `src/modules/eventos-atp/recuperacion.service.ts` (`asignarRecursosRecuperacionService`)
* **Verificación Técnica del Fix:**
  * En la rama Redis Pub/Sub (`REDIS_SOCKET_CHANNEL`), `emitirRecursoActualizado` publica hacia las salas `["encargado", "supervisor"]` y `emitirRecuperacionActualizada` hacia `["sala:encargados", "encargado", "mapa"]`.
  * El servicio mapea cada recurso actualizado a `camelCase` incluyendo `cantidadInventario`, `cantidadEnUso`, `cantidadDisponible` y `cantidadMinima`.
  * Verificado en tiempo real conectando cliente WebSocket Engine.IO v4 / Socket.io contra el servidor vivo y recibiendo los eventos `recuperacion:actualizada`, `recurso:actualizado` (en camelCase con `cantidadDisponible`) y `patrulla:actualizada`.

### `BUG-H32-API-06`: Alineación OpenAPI, Documentación API y Cobertura en `route.test.ts`
* **Severidad:** Media
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts`
  * `docs/api/eventos-atp.md`
  * `src/app/openapi.json/__tests__/route.test.ts`
* **Verificación Técnica del Fix:**
  * `GET /openapi.json` expone `info.version: "0.12.0"` alineado con `package.json`, y las rutas `/api/eventos-atp/recuperacion/{id}` y `/api/eventos-atp/recuperacion/{id}/asignar` declaran `security: [{ BearerAuth: [] }]` sin el parámetro `x-user-id`.
  * `src/app/openapi.json/__tests__/route.test.ts` valida explícitamente ambas rutas y esquemas de seguridad.

### `BUG-H32-API-07`: Sincronización con `origin/develop` y Aplicación de Migración `041_recuperacion_recurso_mision_id`
* **Severidad:** Alta
* **Estado en Re-Test:** 🟢 `CORREGIDO` (Detectado: `16/11/2026 23:50` | Verificado: `18/11/2026 16:36`)
* **Archivos Afectados:**
  * `package.json`
  * `src/lib/db/migrator.ts`
  * `src/lib/db/migrations/041_recuperacion_recurso_mision_id.ts`
* **Verificación Técnica del Fix:**
  * `origin/develop` integrado sin conflictos; `npm run db:migrate` finaliza con código 0 y aplica la columna `recuperacion_recurso.mision_id` (FK a `mision(id) ON DELETE SET NULL` e índice `idx_recuperacion_recurso_mision`).
  * Verificado en flujo E2E comprobando la persistencia de `mision_id` en tabla `recuperacion_recurso` y su retorno como `misionId` no nulo en `GET /api/eventos-atp/recuperacion/{id}`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H32-API-01` | Bloqueo pesimista FOR UPDATE y condición atómica WHERE estado = DISPONIBLE en patrulla_verificadora y recuperacion para prevenir doble despacho TOCTOU | Concurrencia / ICS | Repositorio / E2E BD | Crítica | Patrulla en estado DISPONIBLE y dos eventos de recuperación activos con recursos distintos | 2 peticiones concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar con mismo patrullaId | Primera petición responde 200 OK y bloquea la patrulla; segunda aborta con 409 Conflict sin crear misión duplicada | Petición 1 retornó HTTP 200 OK (MIS-2026-0016); petición 2 retornó HTTP 409 Conflict sin duplicar misión ni doble descuento | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-02` | Generación secuencial segura de mision.codigo y recuperacion.codigo mediante pg_advisory_xact_lock y ORDER BY codigo DESC | Concurrencia / Integridad | Repositorio / E2E BD | Alta | Múltiples asignaciones o correlativos existentes heterogéneos en tabla mision (incluyendo MIS-PREV-2026-001) | Peticiones secuenciales y concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar | Correlativos únicos MIS-YYYY-NNNN sin colisión de clave única (23505) ni error HTTP 500 | Códigos MIS-2026-0015 y MIS-2026-0016 generados de forma única y serializada sin colisiones ni errores 500 | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-03` | Regla §3.6 para activos individuales (es_individual = true): validación de saldo libre (inventario - en_uso >= 1) e incremento +1 de cantidad_en_uso sin corrupción multiunidad | Regla de Negocio (§3.6) | Servicio / E2E BD | Alta | Activo individual Motosierra Stihl MS 382 Profesional con cantidad_inventario = 6, cantidad_en_uso = 2 y cantidad_minima = 2 | POST /api/eventos-atp/recuperacion/{id}/asignar con recursoId individual (cantidad: 1) | Rechaza 409 si disponible < 1; si disponible >= 1 incrementa cantidad_en_uso a 3 y deriva estado según remanente | Retornó HTTP 200 OK con cantidadEnUso: 3 y estadoRecurso: DISPONIBLE; rechazó 409 en activos ASIGNADO y EN_MANTENCION | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-04` | Ciclo de vida ICS en misión DESPACHADA (fecha_inicio null y registro de hito inicial en mision_hito) y preservación de personal.disponible_terreno | Regla de Negocio ICS | Repositorio / E2E BD | Alta | Patrulla disponible con usuario_lider_id vinculado a tabla personal (disponible_terreno = true) | POST /api/eventos-atp/recuperacion/{id}/asignar seguido de GET /api/misiones/{misionId} | Misión creada con fecha_inicio: null, hito 'DESPACHADA' en mision_hito y personal.disponible_terreno inalterado | Verificado en BD y GET /api/misiones/{id}: fechaInicio: null, hito DESPACHADA registrado y disponible_terreno intacto (true) | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-05` | Difusión completa en broker Redis Pub/Sub de recuperacion:actualizada (sala:encargados, encargado, mapa) y recurso:actualizado (encargado, supervisor) en camelCase | Tiempo Real / Redis | Socket / Servicio | Alta | Servidor Socket.io con Redis Pub/Sub activo y cliente suscrito a encargado, supervisor, sala:encargados y mapa | POST /api/eventos-atp/recuperacion/{id}/asignar con recursos granel e individual | Emisión multi-sala de recuperacion:actualizada y recurso:actualizado en camelCase con cantidadDisponible | Eventos recuperacion:actualizada, recurso:actualizado (camelCase con cantidadDisponible) y patrulla:actualizada recibidos por WebSocket | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-06` | Alineación de especificación OpenAPI (/openapi.json) y docs/api/eventos-atp.md con auth.guard (solo Bearer), versión de package.json y cobertura en route.test.ts | Contrato OpenAPI | OpenAPI / Docs / Tests | Media | Especificación generada en GET /openapi.json y suite de pruebas OpenAPI | GET /openapi.json y ejecución de src/app/openapi.json/__tests__/route.test.ts | OpenAPI declara BearerAuth sin x-user-id en endpoints HU-32, info.version 0.12.0 y pruebas de contrato aprobadas | GET /openapi.json retorna version: 0.12.0, security: [{BearerAuth: []}] en {id} y {id}/asignar sin x-user-id; test OpenAPI pass | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-07` | Sincronización de rama con origin/develop sin conflictos y ejecución limpia de migración 041_recuperacion_recurso_mision_id.ts en Kysely | Integración / Migraciones | Git / Base de Datos | Alta | BD con migraciones previas de develop (035_, 042_, 061_, 071_) y migración 041_ en la rama | npm run db:migrate e inspección de tabla recuperacion_recurso en PostgreSQL | Ejecución limpia sin conflictos y creación efectiva de columna e índice mision_id en recuperacion_recurso | npm run db:migrate exited 0; columna mision_id e índice idx_recuperacion_recurso_mision operativos y poblados en E2E | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion |
| `CP-H32-API-01` | Validación de esquema Zod AsignarRecursosRecuperacionInputSchema con patrullaId UUID y arreglo válido de recursos | Validación de Esquema | Unitaria / Zod | Alta | Esquema Zod importado en suite Vitest | {patrullaId:'50000000-0000-4000-8000-000000000001',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]} | safeParse retorna success: true con datos tipados | Validación exitosa confirmada en Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32) |
| `CP-H32-API-02` | Rechazo con HTTP 400 / fallo Zod cuando patrullaId no tiene formato UUID válido | Validación de Esquema | Unitaria / Zod | Alta | Esquema AsignarRecursosRecuperacionInputSchema | {patrullaId:'id-invalido',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]} | safeParse retorna success: false y HTTP 400 en Route Handler | Rechazo validado en Vitest (schema y route.test.ts) | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32) |
| `CP-H32-API-03` | Rechazo con HTTP 400 Bad Request cuando la lista de recursos está vacía (recursos: []) | Validación de Entrada | API HTTP / Vitest | Alta | Servidor activo y token JWT de Encargado | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con {patrullaId:'f1000000-0000-4000-8000-000000000002',recursos:[]} | HTTP 400 indicando que debe asignar al menos un recurso | HTTP 400 con error en campo 'recursos' verificado en Vitest y auditoría HTTP | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-04` | Rechazo con HTTP 400 Bad Request cuando la cantidad de recurso es menor o igual a 0 | Validación de Entrada | API HTTP / Vitest | Alta | Servidor activo y token JWT de Encargado | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con cantidad: 0 | HTTP 400 indicando 'La cantidad debe ser mayor a 0' | HTTP 400 con error en campo 'recursos.0.cantidad' verificado en Vitest y auditoría HTTP | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-05` | Rechazo con HTTP 400 Bad Request ante parámetro de ruta :id no UUID o cuerpo JSON sintácticamente inválido | Robustez / Validación | API HTTP / Vitest | Media | Servidor activo y token JWT de Encargado | POST /api/eventos-atp/recuperacion/no-es-uuid/asignar con payload válido y Bearer de Encargado | HTTP 400 Bad Request con mensaje descriptivo del identificador o payload inválido | HTTP 400: 'Identificador de evento de recuperación inválido.' verificado en servidor vivo y Vitest | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-06` | Denegación con HTTP 401 Unauthorized cuando las rutas de recuperación se invocan sin token JWT Bearer | Seguridad / Auth | API HTTP / Vitest | Crítica | Peticiones sin cabecera Authorization | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar sin Authorization | HTTP 401 Unauthorized impidiendo acceso anónimo | HTTP 401: 'Se requiere cabecera de autenticación Authorization: Bearer <token>.' verificado en vivo y Vitest | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-07` | Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar | Seguridad / RBAC | API HTTP / Vitest | Crítica | Usuario autenticado con rol Call Center (callcenter@valdivia.cl) sin permiso misiones:asignar | POST /api/eventos-atp/recuperacion/{id}/asignar con Bearer de Call Center | HTTP 403 Forbidden exigiendo permiso misiones:asignar | HTTP 403: 'No cuenta con el permiso requerido: misiones:asignar' verificado en servidor vivo y Vitest | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-08` | Consulta exitosa (HTTP 200) de ficha de detalle GET /api/eventos-atp/recuperacion/[id] y rechazo HTTP 404 para UUID inexistente | Funcional / Consulta | API HTTP / Servicio | Alta | Evento REC-2026-0001 y evento asignado E2E en BD y usuario Encargado | GET /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602 y detalle del evento asignado E2E | HTTP 200 con detalle, misiones y recursosAsignados (incluyendo misionId en nuevas asignaciones); HTTP 404 para UUID inexistente | HTTP 200 verificado en REC-2026-0001 y evento E2E con misionId persistido; HTTP 404 verificado en Vitest | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente |
| `CP-H32-API-09` | Consulta de listado GET /api/eventos-atp/recuperacion para mapa operativo con autenticación válida | Funcional / Consulta | API HTTP / Servicio | Alta | Evento REC-2026-0001 en BD y token JWT de Encargado | GET /api/eventos-atp/recuperacion (validado en suite de rutas y auditoría HTTP inicial) | HTTP 200 OK con total y arreglo data georreferenciado | Suite route.test.ts de listado aprobada (10/10 tests) y validada en entorno operativo | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente |
| `CP-H32-API-10` | Rechazo con HTTP 404 Not Found en POST /asignar si el evento, la patrulla o algún recurso no existe | Manejo de Errores | API HTTP / Vitest | Alta | UUID inexistente de evento en BD | POST /api/eventos-atp/recuperacion/00000000-0000-4000-8000-999999999999/asignar | HTTP 404 Not Found informando la entidad no encontrada | HTTP 404: 'El evento de recuperación indicado no fue encontrado.' verificado en servidor vivo y Vitest | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-11` | Rechazo con HTTP 409 Conflict si el evento de recuperación se encuentra en estado COMPLETADA o CANCELADA | Regla de Negocio | API HTTP / PostgreSQL | Alta | Evento temporal en estado COMPLETADA en BD | POST /api/eventos-atp/recuperacion/{id_completada}/asignar con Bearer de Encargado | HTTP 409 Conflict impidiendo asignar sobre evento cerrado | HTTP 409: 'No es posible asignar recursos a un evento de recuperación en estado COMPLETADA.' verificado en vivo y Vitest | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-12` | Rechazo con HTTP 409 Conflict si la patrulla verificadora seleccionada no está en estado DISPONIBLE | Regla de Negocio | API HTTP / PostgreSQL | Crítica | Patrulla f1000000-0000-4000-8000-000000000002 en estado EN_VERIFICACION en BD | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con patrulla en EN_VERIFICACION | HTTP 409 Conflict indicando el estado actual de la patrulla | HTTP 409: 'La patrulla "Patrulla Rápida Centro-Sur" no está disponible para asignación (estado actual: EN_VERIFICACION).' verificado en vivo | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-13` | Bloqueo pesimista FOR UPDATE sobre tabla recurso y rechazo HTTP 409 ante sobregiro de stock en insumos a granel | Concurrencia / §3.6 | API HTTP / PostgreSQL | Crítica | Recurso granel Sacos de Arena (inventario: 240, en_uso: 50 -> disponible: 190) | POST .../asignar solicitando cantidad: 500 para Sacos de Arena | obtenerRecursosParaBloqueo aplica .forUpdate() y endpoint retorna HTTP 409 Conflict | HTTP 409: 'Stock insuficiente para el recurso "Sacos de Arena de Contención Fluvial". Solicitado: 500, Disponible: 190.' | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-14` | Rechazo con HTTP 400 Bad Request cuando se solicita cantidad superior a 1 para un activo individual | Regla de Negocio (§3.6) | API HTTP / PostgreSQL | Crítica | Activo individual Motosierra Stihl MS 382 Profesional en BD | POST .../asignar solicitando cantidad: 2 para Motosierra Stihl MS 382 Profesional | HTTP 400 Bad Request rechazando cantidad > 1 en activo individual | HTTP 400: 'El activo individual o vehículo "Motosierra Stihl MS 382 Profesional" solo admite una cantidad asignada de 1 unidad.' | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-15` | Rechazo con HTTP 409 Conflict cuando el activo individual se encuentra en EN_MANTENCION, NO_DISPONIBLE o ASIGNADO | Regla de Negocio (§3.6) | API HTTP / PostgreSQL | Crítica | Recursos individuales en estado EN_MANTENCION y ASIGNADO (Camioneta 4x4 Navara) en BD | POST .../asignar solicitando cantidad: 1 para recurso en EN_MANTENCION y para Camioneta ASIGNADO | HTTP 409 Conflict impidiendo asignación en ambos estados no disponibles | HTTP 409 verificado en vivo tanto para EN_MANTENCION como para ASIGNADO (y validado en Vitest) | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-16` | Flujo nominal de asignación en servicio con mocks Vitest (creación de misión RECUPERACION, actualización de granel/individual y emisión de sockets) | Funcional / Unitaria | Servicio / Route (Mocks) | Crítica | Suite Vitest con mocks de Kysely y emisores Socket.io | npx vitest run sobre suites HU-32 y npm test -- -t "HU-32" | Todas las pruebas unitarias y de ruta de HU-32 aprobadas | 16/16 en recuperacion.asignar.service.test.ts, 9/9 en asignar/route.test.ts y 30/30 en filtro HU-32 aprobadas | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | test(eventos-atp): pruebas unitarias y de integracion para asignacion de recuperacion (HU-32) |
| `CP-H32-API-17` | Paginación exacta y eliminación de duplicados en listado de patrullas GET /api/patrullas?page=1&limit=5 | Regresión / Consulta | API HTTP / Vitest | Alta | 9 patrullas registradas en BD | Suite Vitest src/app/api/patrullas/__tests__/route.test.ts y verificación HTTP inicial | HTTP 200 OK retornando meta.total = 9, totalPages = 2 y exactamente 5 elementos únicos | Pruebas automatizadas en suite completa aprobadas (75/75 archivos) y paginación exacta verificada | APROBADO | 16/11/2026 23:50 | N/A | fix(patrullas): eliminar duplicados y preservar paginacion exacta en GET /api/patrullas |
| `CP-H32-API-18` | Ejecución integral POST /api/eventos-atp/recuperacion/[id]/asignar contra PostgreSQL real validando inserción de recuperacion_recurso.mision_id | Integración E2E BD | API HTTP / PostgreSQL | Crítica | Migración 041_ aplicada en PostgreSQL y patrulla temporal en estado DISPONIBLE | POST /api/eventos-atp/recuperacion/{id}/asignar con Sacos de Arena (10) y Motosierra (1) contra BD real | HTTP 200 OK creando misión RECUPERACION, fila en recuperacion_recurso con mision_id, transición EN_RECUPERACION y descuento en recurso | HTTP 200 OK verificado E2E contra PostgreSQL 16: MIS-2026-0015 creada, recuperacion_recurso.mision_id poblado y stock actualizado | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `CP-H32-API-19` | Validación de tipos estáticos TypeScript, ESLint y compilación de producción Next.js Turbopack | Calidad Estática / Build | Build / CI | Alta | Entorno Node.js con dependencias instaladas | npx next typegen && npx tsc --noEmit && npm run lint && npm run build | 0 errores de tipos, 0 errores ESLint y compilación exitosa incluyendo rutas HU-32 | 0 errores en tsc --noEmit, 0 errores/advertencias en lint y compilación Turbopack exitosa (exit 0) | APROBADO | 16/11/2026 23:50 | 18/11/2026 16:36 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H32-API-01	Bloqueo pesimista FOR UPDATE y condición atómica WHERE estado = DISPONIBLE en patrulla_verificadora y recuperacion para prevenir doble despacho TOCTOU	Concurrencia / ICS	Repositorio / E2E BD	Crítica	Patrulla en estado DISPONIBLE y dos eventos de recuperación activos con recursos distintos	2 peticiones concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar con mismo patrullaId	Primera petición responde 200 OK y bloquea la patrulla; segunda aborta con 409 Conflict sin crear misión duplicada	Petición 1 retornó HTTP 200 OK (MIS-2026-0016); petición 2 retornó HTTP 409 Conflict sin duplicar misión ni doble descuento	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-02	Generación secuencial segura de mision.codigo y recuperacion.codigo mediante pg_advisory_xact_lock y ORDER BY codigo DESC	Concurrencia / Integridad	Repositorio / E2E BD	Alta	Múltiples asignaciones o correlativos existentes heterogéneos en tabla mision (incluyendo MIS-PREV-2026-001)	Peticiones secuenciales y concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar	Correlativos únicos MIS-YYYY-NNNN sin colisión de clave única (23505) ni error HTTP 500	Códigos MIS-2026-0015 y MIS-2026-0016 generados de forma única y serializada sin colisiones ni errores 500	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-03	Regla §3.6 para activos individuales (es_individual = true): validación de saldo libre (inventario - en_uso >= 1) e incremento +1 de cantidad_en_uso sin corrupción multiunidad	Regla de Negocio (§3.6)	Servicio / E2E BD	Alta	Activo individual Motosierra Stihl MS 382 Profesional con cantidad_inventario = 6, cantidad_en_uso = 2 y cantidad_minima = 2	POST /api/eventos-atp/recuperacion/{id}/asignar con recursoId individual (cantidad: 1)	Rechaza 409 si disponible < 1; si disponible >= 1 incrementa cantidad_en_uso a 3 y deriva estado según remanente	Retornó HTTP 200 OK con cantidadEnUso: 3 y estadoRecurso: DISPONIBLE; rechazó 409 en activos ASIGNADO y EN_MANTENCION	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-04	Ciclo de vida ICS en misión DESPACHADA (fecha_inicio null y registro de hito inicial en mision_hito) y preservación de personal.disponible_terreno	Regla de Negocio ICS	Repositorio / E2E BD	Alta	Patrulla disponible con usuario_lider_id vinculado a tabla personal (disponible_terreno = true)	POST /api/eventos-atp/recuperacion/{id}/asignar seguido de GET /api/misiones/{misionId}	Misión creada con fecha_inicio: null, hito 'DESPACHADA' en mision_hito y personal.disponible_terreno inalterado	Verificado en BD y GET /api/misiones/{id}: fechaInicio: null, hito DESPACHADA registrado y disponible_terreno intacto (true)	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-05	Difusión completa en broker Redis Pub/Sub de recuperacion:actualizada (sala:encargados, encargado, mapa) y recurso:actualizado (encargado, supervisor) en camelCase	Tiempo Real / Redis	Socket / Servicio	Alta	Servidor Socket.io con Redis Pub/Sub activo y cliente suscrito a encargado, supervisor, sala:encargados y mapa	POST /api/eventos-atp/recuperacion/{id}/asignar con recursos granel e individual	Emisión multi-sala de recuperacion:actualizada y recurso:actualizado en camelCase con cantidadDisponible	Eventos recuperacion:actualizada, recurso:actualizado (camelCase con cantidadDisponible) y patrulla:actualizada recibidos por WebSocket	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-06	Alineación de especificación OpenAPI (/openapi.json) y docs/api/eventos-atp.md con auth.guard (solo Bearer), versión de package.json y cobertura en route.test.ts	Contrato OpenAPI	OpenAPI / Docs / Tests	Media	Especificación generada en GET /openapi.json y suite de pruebas OpenAPI	GET /openapi.json y ejecución de src/app/openapi.json/__tests__/route.test.ts	OpenAPI declara BearerAuth sin x-user-id en endpoints HU-32, info.version 0.12.0 y pruebas de contrato aprobadas	GET /openapi.json retorna version: 0.12.0, security: [{BearerAuth: []}] en {id} y {id}/asignar sin x-user-id; test OpenAPI pass	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-07	Sincronización de rama con origin/develop sin conflictos y ejecución limpia de migración 041_recuperacion_recurso_mision_id.ts en Kysely	Integración / Migraciones	Git / Base de Datos	Alta	BD con migraciones previas de develop (035_, 042_, 061_, 071_) y migración 041_ en la rama	npm run db:migrate e inspección de tabla recuperacion_recurso en PostgreSQL	Ejecución limpia sin conflictos y creación efectiva de columna e índice mision_id en recuperacion_recurso	npm run db:migrate exited 0; columna mision_id e índice idx_recuperacion_recurso_mision operativos y poblados en E2E	APROBADO	16/11/2026 23:50	18/11/2026 16:36	merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion
CP-H32-API-01	Validación de esquema Zod AsignarRecursosRecuperacionInputSchema con patrullaId UUID y arreglo válido de recursos	Validación de Esquema	Unitaria / Zod	Alta	Esquema Zod importado en suite Vitest	{patrullaId:'50000000-0000-4000-8000-000000000001',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]}	safeParse retorna success: true con datos tipados	Validación exitosa confirmada en Vitest	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32)
CP-H32-API-02	Rechazo con HTTP 400 / fallo Zod cuando patrullaId no tiene formato UUID válido	Validación de Esquema	Unitaria / Zod	Alta	Esquema AsignarRecursosRecuperacionInputSchema	{patrullaId:'id-invalido',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]}	safeParse retorna success: false y HTTP 400 en Route Handler	Rechazo validado en Vitest (schema y route.test.ts)	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32)
CP-H32-API-03	Rechazo con HTTP 400 Bad Request cuando la lista de recursos está vacía (recursos: [])	Validación de Entrada	API HTTP / Vitest	Alta	Servidor activo y token JWT de Encargado	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con {patrullaId:'f1000000-0000-4000-8000-000000000002',recursos:[]}	HTTP 400 indicando que debe asignar al menos un recurso	HTTP 400 con error en campo 'recursos' verificado en Vitest y auditoría HTTP	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-04	Rechazo con HTTP 400 Bad Request cuando la cantidad de recurso es menor o igual a 0	Validación de Entrada	API HTTP / Vitest	Alta	Servidor activo y token JWT de Encargado	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con cantidad: 0	HTTP 400 indicando 'La cantidad debe ser mayor a 0'	HTTP 400 con error en campo 'recursos.0.cantidad' verificado en Vitest y auditoría HTTP	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-05	Rechazo con HTTP 400 Bad Request ante parámetro de ruta :id no UUID o cuerpo JSON sintácticamente inválido	Robustez / Validación	API HTTP / Vitest	Media	Servidor activo y token JWT de Encargado	POST /api/eventos-atp/recuperacion/no-es-uuid/asignar con payload válido y Bearer de Encargado	HTTP 400 Bad Request con mensaje descriptivo del identificador o payload inválido	HTTP 400: 'Identificador de evento de recuperación inválido.' verificado en servidor vivo y Vitest	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-06	Denegación con HTTP 401 Unauthorized cuando las rutas de recuperación se invocan sin token JWT Bearer	Seguridad / Auth	API HTTP / Vitest	Crítica	Peticiones sin cabecera Authorization	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar sin Authorization	HTTP 401 Unauthorized impidiendo acceso anónimo	HTTP 401: 'Se requiere cabecera de autenticación Authorization: Bearer <token>.' verificado en vivo y Vitest	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-07	Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar	Seguridad / RBAC	API HTTP / Vitest	Crítica	Usuario autenticado con rol Call Center (callcenter@valdivia.cl) sin permiso misiones:asignar	POST /api/eventos-atp/recuperacion/{id}/asignar con Bearer de Call Center	HTTP 403 Forbidden exigiendo permiso misiones:asignar	HTTP 403: 'No cuenta con el permiso requerido: misiones:asignar' verificado en servidor vivo y Vitest	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-08	Consulta exitosa (HTTP 200) de ficha de detalle GET /api/eventos-atp/recuperacion/[id] y rechazo HTTP 404 para UUID inexistente	Funcional / Consulta	API HTTP / Servicio	Alta	Evento REC-2026-0001 y evento asignado E2E en BD y usuario Encargado	GET /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602 y detalle del evento asignado E2E	HTTP 200 con detalle, misiones y recursosAsignados (incluyendo misionId en nuevas asignaciones); HTTP 404 para UUID inexistente	HTTP 200 verificado en REC-2026-0001 y evento E2E con misionId persistido; HTTP 404 verificado en Vitest	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente
CP-H32-API-09	Consulta de listado GET /api/eventos-atp/recuperacion para mapa operativo con autenticación válida	Funcional / Consulta	API HTTP / Servicio	Alta	Evento REC-2026-0001 en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion (validado en suite de rutas y auditoría HTTP inicial)	HTTP 200 OK con total y arreglo data georreferenciado	Suite route.test.ts de listado aprobada (10/10 tests) y validada en entorno operativo	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente
CP-H32-API-10	Rechazo con HTTP 404 Not Found en POST /asignar si el evento, la patrulla o algún recurso no existe	Manejo de Errores	API HTTP / Vitest	Alta	UUID inexistente de evento en BD	POST /api/eventos-atp/recuperacion/00000000-0000-4000-8000-999999999999/asignar	HTTP 404 Not Found informando la entidad no encontrada	HTTP 404: 'El evento de recuperación indicado no fue encontrado.' verificado en servidor vivo y Vitest	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-11	Rechazo con HTTP 409 Conflict si el evento de recuperación se encuentra en estado COMPLETADA o CANCELADA	Regla de Negocio	API HTTP / PostgreSQL	Alta	Evento temporal en estado COMPLETADA en BD	POST /api/eventos-atp/recuperacion/{id_completada}/asignar con Bearer de Encargado	HTTP 409 Conflict impidiendo asignar sobre evento cerrado	HTTP 409: 'No es posible asignar recursos a un evento de recuperación en estado COMPLETADA.' verificado en vivo y Vitest	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-12	Rechazo con HTTP 409 Conflict si la patrulla verificadora seleccionada no está en estado DISPONIBLE	Regla de Negocio	API HTTP / PostgreSQL	Crítica	Patrulla f1000000-0000-4000-8000-000000000002 en estado EN_VERIFICACION en BD	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con patrulla en EN_VERIFICACION	HTTP 409 Conflict indicando el estado actual de la patrulla	HTTP 409: 'La patrulla "Patrulla Rápida Centro-Sur" no está disponible para asignación (estado actual: EN_VERIFICACION).' verificado en vivo	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-13	Bloqueo pesimista FOR UPDATE sobre tabla recurso y rechazo HTTP 409 ante sobregiro de stock en insumos a granel	Concurrencia / §3.6	API HTTP / PostgreSQL	Crítica	Recurso granel Sacos de Arena (inventario: 240, en_uso: 50 -> disponible: 190)	POST .../asignar solicitando cantidad: 500 para Sacos de Arena	obtenerRecursosParaBloqueo aplica .forUpdate() y endpoint retorna HTTP 409 Conflict	HTTP 409: 'Stock insuficiente para el recurso "Sacos de Arena de Contención Fluvial". Solicitado: 500, Disponible: 190.'	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-14	Rechazo con HTTP 400 Bad Request cuando se solicita cantidad superior a 1 para un activo individual	Regla de Negocio (§3.6)	API HTTP / PostgreSQL	Crítica	Activo individual Motosierra Stihl MS 382 Profesional en BD	POST .../asignar solicitando cantidad: 2 para Motosierra Stihl MS 382 Profesional	HTTP 400 Bad Request rechazando cantidad > 1 en activo individual	HTTP 400: 'El activo individual o vehículo "Motosierra Stihl MS 382 Profesional" solo admite una cantidad asignada de 1 unidad.'	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-15	Rechazo con HTTP 409 Conflict cuando el activo individual se encuentra en EN_MANTENCION, NO_DISPONIBLE o ASIGNADO	Regla de Negocio (§3.6)	API HTTP / PostgreSQL	Crítica	Recursos individuales en estado EN_MANTENCION y ASIGNADO (Camioneta 4x4 Navara) en BD	POST .../asignar solicitando cantidad: 1 para recurso en EN_MANTENCION y para Camioneta ASIGNADO	HTTP 409 Conflict impidiendo asignación en ambos estados no disponibles	HTTP 409 verificado en vivo tanto para EN_MANTENCION como para ASIGNADO (y validado en Vitest)	APROBADO	16/11/2026 23:50	18/11/2026 16:36	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-16	Flujo nominal de asignación en servicio con mocks Vitest (creación de misión RECUPERACION, actualización de granel/individual y emisión de sockets)	Funcional / Unitaria	Servicio / Route (Mocks)	Crítica	Suite Vitest con mocks de Kysely y emisores Socket.io	npx vitest run sobre suites HU-32 y npm test -- -t "HU-32"	Todas las pruebas unitarias y de ruta de HU-32 aprobadas	16/16 en recuperacion.asignar.service.test.ts, 9/9 en asignar/route.test.ts y 30/30 en filtro HU-32 aprobadas	APROBADO	16/11/2026 23:50	18/11/2026 16:36	test(eventos-atp): pruebas unitarias y de integracion para asignacion de recuperacion (HU-32)
CP-H32-API-17	Paginación exacta y eliminación de duplicados en listado de patrullas GET /api/patrullas?page=1&limit=5	Regresión / Consulta	API HTTP / Vitest	Alta	9 patrullas registradas en BD	Suite Vitest src/app/api/patrullas/__tests__/route.test.ts y verificación HTTP inicial	HTTP 200 OK retornando meta.total = 9, totalPages = 2 y exactamente 5 elementos únicos	Pruebas automatizadas en suite completa aprobadas (75/75 archivos) y paginación exacta verificada	APROBADO	16/11/2026 23:50	N/A	fix(patrullas): eliminar duplicados y preservar paginacion exacta en GET /api/patrullas
CP-H32-API-18	Ejecución integral POST /api/eventos-atp/recuperacion/[id]/asignar contra PostgreSQL real validando inserción de recuperacion_recurso.mision_id	Integración E2E BD	API HTTP / PostgreSQL	Crítica	Migración 041_ aplicada en PostgreSQL y patrulla temporal en estado DISPONIBLE	POST /api/eventos-atp/recuperacion/{id}/asignar con Sacos de Arena (10) y Motosierra (1) contra BD real	HTTP 200 OK creando misión RECUPERACION, fila en recuperacion_recurso con mision_id, transición EN_RECUPERACION y descuento en recurso	HTTP 200 OK verificado E2E contra PostgreSQL 16: MIS-2026-0015 creada, recuperacion_recurso.mision_id poblado y stock actualizado	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
CP-H32-API-19	Validación de tipos estáticos TypeScript, ESLint y compilación de producción Next.js Turbopack	Calidad Estática / Build	Build / CI	Alta	Entorno Node.js con dependencias instaladas	npx next typegen && npx tsc --noEmit && npm run lint && npm run build	0 errores de tipos, 0 errores ESLint y compilación exitosa incluyendo rutas HU-32	0 errores en tsc --noEmit, 0 errores/advertencias en lint y compilación Turbopack exitosa (exit 0)	APROBADO	16/11/2026 23:50	18/11/2026 16:36	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test 18/11/2026)

### 5.1 Pruebas Automatizadas en Vitest, Migraciones Kysely, Tipos Estáticos y Build

#### 5.1.1 Suite Completa del Repositorio
```bash
npm test
```

**Salida Observada:**
```text
 Test Files  75 passed (75)
      Tests  875 passed (875)
   Start at  16:36:06
   Duration  6.56s
```

#### 5.1.2 Suite Focalizada de HU-32 y Contrato OpenAPI
```bash
npx vitest run \
  src/modules/eventos-atp/__tests__/recuperacion.asignar.service.test.ts \
  src/modules/eventos-atp/__tests__/recuperacion.service.test.ts \
  "src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts" \
  "src/app/api/eventos-atp/recuperacion/[id]/asignar/__tests__/route.test.ts" \
  "src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts" \
  src/app/openapi.json/__tests__/route.test.ts --reporter=verbose
```

**Salida Observada:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/eventos-atp/__tests__/recuperacion.service.test.ts (12 tests) 37ms
 ✓ src/modules/eventos-atp/__tests__/recuperacion.asignar.service.test.ts (16 tests) 65ms
 ✓ src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts (5 tests) 116ms
 ✓ src/app/api/eventos-atp/recuperacion/[id]/asignar/__tests__/route.test.ts (9 tests) 81ms
 ✓ src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts (10 tests) 163ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 506ms

 Test Files  6 passed (6)
      Tests  53 passed (53)
   Start at  16:29:28
   Duration  4.44s
```

#### 5.1.3 Ejecución Filtrada por Patrón `HU-32` (`-t`)
```bash
npm test -- -t "HU-32"
```

**Salida Observada:**
```text
 Test Files  3 passed | 72 skipped (75)
      Tests  30 passed | 845 skipped (875)
   Start at  16:29:49
   Duration  11.27s
```

Comandos equivalentes por suite individual:
```bash
npm test -- -t "Asignación de Recursos a Recuperación \(HU-32\)"
npm test -- -t "POST /api/eventos-atp/recuperacion/\[id\]/asignar \(HU-32\)"
npm test -- -t "GET /api/eventos-atp/recuperacion/\[id\] \(HU-32\)"
```

#### 5.1.4 Migraciones Kysely, Tipos Estáticos, ESLint y Compilación de Producción
```bash
npm run db:migrate && npx next typegen && npx tsc --noEmit && npm run lint && npm run build
```

**Salida Observada:**
```text
Ejecutando migraciones Kysely de base de datos...
Todas las migraciones se completaron correctamente.
Generating route types...
✓ Types generated successfully
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 401ms
✓ Finished TypeScript in 2.1s
✓ Collecting page data using 15 workers in 1187ms
✓ Generating static pages using 15 workers (27/27) in 199ms
✓ Finalizing page optimization in 176ms
```

---

### 5.2 Pruebas HTTP, WebSocket y Concurrencia Replicables (`PORT=3099 npm start`)

#### Caso 1: Contrato OpenAPI Vivo (`GET /openapi.json` — `BUG-H32-API-06`)
```bash
curl -sS http://localhost:3099/openapi.json | node -e '
const fs = require("fs");
const spec = JSON.parse(fs.readFileSync(0, "utf8"));
console.log("version:", spec.info?.version);
for (const p of ["/api/eventos-atp/recuperacion/{id}", "/api/eventos-atp/recuperacion/{id}/asignar"]) {
  console.log("PATH:", p, JSON.stringify(Object.keys(spec.paths[p]).map(m => ({
    m,
    security: spec.paths[p][m].security,
    params: (spec.paths[p][m].parameters || []).map(x => x.name)
  }))));
}
'
```

**Salida Observada:**
```text
version: 0.12.0
PATH: /api/eventos-atp/recuperacion/{id} [{"m":"get","security":[{"BearerAuth":[]}],"params":["id"]}]
PATH: /api/eventos-atp/recuperacion/{id}/asignar [{"m":"post","security":[{"BearerAuth":[]}],"params":["id"]}]
```

#### Caso 2: Rechazo sin Autenticación Bearer (`401 Unauthorized` — `CP-H32-API-06`)
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3099/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Respuesta HTTP/JSON Obtenida:**
```http
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
HTTP 401
```

#### Caso 3: Rechazo RBAC sin Permiso `misiones:asignar` (`403 Forbidden` — `CP-H32-API-07`)
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3099/api/eventos-atp/recuperacion/${EV_1}/asignar" \
  -H "Authorization: Bearer ${TOKEN_CALLCENTER}" \
  -H "Content-Type: application/json" \
  -d "{\"patrullaId\":\"${PAT_1}\",\"recursos\":[{\"recursoId\":\"e1000000-0000-4000-8000-000000000004\",\"cantidad\":5}]}"
```

**Respuesta HTTP/JSON Obtenida:**
```json
{"status":403,"json":{"message":"No cuenta con el permiso requerido: misiones:asignar"}}
```

#### Caso 4: Detalle de Evento de Recuperación (`GET /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602` — `200 OK` / `CP-H32-API-08`)
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer ${TOKEN_ENC}" \
  "http://localhost:3099/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602"
```

**Respuesta HTTP/JSON Obtenida:**
```http
{"message":"Detalle del evento de recuperación obtenido exitosamente.","data":{"id":"5837deb6-fe38-4b28-847c-0a59f4b0e602","codigo":"REC-2026-0001","nombre":"Test Recuperacion CLI","descripcion":"Entrega de prueba desde CLI","sector":"Collico","direccionTexto":"Pasaje Los Cipreses 450","prioridad":"ALTA","contactoNombre":"Sra. María González","contactoTelefono":"+56987654321","latitud":-39.8142,"longitud":-73.2459,"estado":"PLANIFICADA","familiasAfectadas":3,"delegacion":{"id":"30000000-0000-4000-8000-000000000001","codigo":"DEL_NORTE","nombre":"Delegación Municipal Norte"},"misiones":[{"id":"f3a3c065-8c1b-4fb8-a79a-2ca53447108a","codigo":"MIS-2026-0005","titulo":"Test Recuperacion CLI","estado":"COMPLETADA","tipoMision":"RECUPERACION","patrulla":{"id":"f1000000-0000-4000-8000-000000000002","nombre":"Patrulla Rápida Centro-Sur","estado":"EN_VERIFICACION"},"creadoEn":"2026-10-05T01:57:24.323Z"}],"recursosAsignados":[{"id":"f0328863-be79-421e-aa81-074a85801c07","recursoId":"e1000000-0000-4000-8000-000000000004","nombre":"Sacos de Arena de Contención Fluvial","esIndividual":false,"cantidadAsignada":10,"misionId":null,"creadoEn":"2026-10-05T01:57:24.323Z"}],"creadoPorId":"00000000-0000-4000-8000-000000000003","creadoEn":"2026-10-05T01:57:24.323Z","actualizadoEn":"2026-10-05T01:57:24.323Z"}}
HTTP 200
```

#### Caso 5: Rechazo por Patrulla No Disponible (`409 Conflict` — `CP-H32-API-12`)
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3099/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar" \
  -H "Authorization: Bearer ${TOKEN_ENC}" \
  -H "Content-Type: application/json" \
  -d '{"patrullaId":"f1000000-0000-4000-8000-000000000010","recursos":[{"recursoId":"e1000000-0000-4000-8000-000000000004","cantidad":5}]}'
```

**Respuesta HTTP/JSON Obtenida:**
```http
{"message":"La patrulla \"Patrulla Rápida Las Ánimas\" no está disponible para asignación (estado actual: EN_VERIFICACION)."}
HTTP 409
```

#### Caso 6: Reglas de Validación e Inventario Híbrido §3.6 en Servidor Real (`CP-H32-API-05, 10, 11, 13, 14, 15`)
Resultados JSON reales observados contra `http://localhost:3099` y PostgreSQL 16:
* **UUID inválido (`400 Bad Request`):** `{"message":"Identificador de evento de recuperación inválido.","errors":[{"campo":"id","mensaje":"El identificador del evento de recuperación debe ser un UUID válido"}]}`
* **Evento inexistente (`404 Not Found`):** `{"message":"El evento de recuperación indicado no fue encontrado."}`
* **Evento en estado `COMPLETADA` (`409 Conflict`):** `{"message":"No es posible asignar recursos a un evento de recuperación en estado COMPLETADA."}`
* **Activo individual en `EN_MANTENCION` (`409 Conflict`):** `{"message":"El activo individual \"Generador QA Mantención\" se encuentra en mantención y no puede ser asignado."}`
* **Activo individual en `ASIGNADO` (`409 Conflict`):** `{"message":"El activo individual \"Camioneta 4x4 Cuadrilla Navara (Patente: CD-FG-23)\" ya se encuentra asignado a otra misión u operación activa."}`
* **Activo individual con cantidad > 1 (`400 Bad Request`):** `{"message":"El activo individual o vehículo \"Motosierra Stihl MS 382 Profesional\" solo admite una cantidad asignada de 1 unidad."}`
* **Stock insuficiente en recurso a granel (`409 Conflict`):** `{"message":"Stock insuficiente para el recurso \"Sacos de Arena de Contención Fluvial\". Solicitado: 500, Disponible: 190."}`

#### Caso 7: Flujo E2E Real contra PostgreSQL 16 + WebSocket (`200 OK` — `BUG-H32-API-03, 04, 05, 07` y `CP-H32-API-18`)
Al asignar `PAT_1` (`DISPONIBLE`, líder con `personal.disponible_terreno = true`), `Sacos de Arena` (`cantidad: 10`, previo `50/240`) y `Motosierra Stihl MS 382 Profesional` (`cantidad: 1`, `es_individual: true`, previo `2/6`, `cantidad_minima: 2`) a `REC-QA-0001`:

**Respuesta HTTP `200 OK` Obtenida:**
```json
{
  "message": "Patrulla y recursos logísticos asignados exitosamente al evento de recuperación.",
  "data": {
    "evento": {
      "id": "99990000-0000-4000-8000-000000000101",
      "codigo": "REC-QA-0001",
      "nombre": "Operativo QA Despeje Temporal 1",
      "estado": "PLANIFICADA"
    },
    "mision": {
      "id": "76ad6861-d007-49b6-9ec1-1302438b7a4e",
      "codigo": "MIS-2026-0015",
      "titulo": "Despacho operativo: Operativo QA Despeje Temporal 1",
      "estado": "DESPACHADA",
      "tipoMision": "RECUPERACION"
    },
    "patrulla": {
      "id": "99990000-0000-4000-8000-000000000001",
      "nombre": "Patrulla QA Re-Test 1",
      "estado": "EN_RECUPERACION"
    },
    "recursos": [
      {
        "recursoId": "e1000000-0000-4000-8000-000000000003",
        "nombre": "Motosierra Stihl MS 382 Profesional",
        "esIndividual": true,
        "cantidadAsignada": 1,
        "cantidadEnUso": 3,
        "estadoRecurso": "DISPONIBLE"
      },
      {
        "recursoId": "e1000000-0000-4000-8000-000000000004",
        "nombre": "Sacos de Arena de Contención Fluvial",
        "esIndividual": false,
        "cantidadAsignada": 10,
        "cantidadEnUso": 60,
        "estadoRecurso": "DISPONIBLE"
      }
    ],
    "asignadoEn": "2026-11-18T19:34:55.955Z"
  }
}
```

**Verificaciones Complementarias Observadas Post-Commit:**
* `GET /api/misiones/76ad6861-d007-49b6-9ec1-1302438b7a4e` -> `estado: "DESPACHADA"`, `fechaInicio: null`, `bitacoraTiempos[0].hito: "DESPACHADA"`.
* `personal.disponible_terreno` del líder (`d1000000-0000-4000-8000-000000000001`): permanece `true`.
* `GET /api/eventos-atp/recuperacion/99990000-0000-4000-8000-000000000101` -> `recursosAsignados` incluye `misionId: "76ad6861-d007-49b6-9ec1-1302438b7a4e"` en ambos ítems.
* Eventos WebSocket recibidos en cliente conectado vía Engine.IO v4 / Socket.io: `recuperacion:actualizada`, `recurso:actualizado` (con `cantidadInventario: 6`, `cantidadEnUso: 3`, `cantidadDisponible: 3` para Motosierra; y `cantidadDisponible: 180` para Sacos) y `patrulla:actualizada` (`estado: "EN_RECUPERACION"`, `misionActivaId: "76ad6861-d007-49b6-9ec1-1302438b7a4e"`).

#### Caso 8: Prueba de Concurrencia TOCTOU sobre Misma Patrulla (`BUG-H32-API-01` y `BUG-H32-API-02`)
Al disparar simultáneamente con `Promise.all` dos solicitudes `POST .../asignar` sobre eventos distintos (`EV_2` y `EV_3`) apuntando a la misma patrulla `PAT_2` (`DISPONIBLE`) y `Sacos de Arena` (`cantidad: 5`):
* **Petición ganadora:** `HTTP 200 OK` -> misión `MIS-2026-0016` creada y `Sacos de Arena` actualizado de `60` a `65` en uso.
* **Petición competidora:** `HTTP 409 Conflict` -> `{"message":"La patrulla \"Patrulla QA Re-Test 2\" no está disponible para asignación (estado actual: EN_RECUPERACION)."}`
* **Integridad post-concurrencia:** `sacosPostConc = { cantidad_en_uso: 65, estado: "DISPONIBLE" }`, `pat2PostConc = { estado: "EN_RECUPERACION" }`.

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (Backend `sgrai-api`)

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Dentro de la vista de detalle de un evento de recuperación (`recuperacion`), el sistema debe proveer una sección para asignar patrullas e inventario logístico. | `CP-H32-API-08`, `CP-H32-API-09`, `CP-H32-API-17`, `BUG-H32-API-06` | 🟢 **CUMPLIDO (API)** | Los endpoints `GET /api/eventos-atp/recuperacion`, `GET /api/eventos-atp/recuperacion/[id]`, `GET /api/patrullas` y `POST /api/eventos-atp/recuperacion/[id]/asignar` operan según contrato OpenAPI `0.12.0` (`BearerAuth`). La interfaz de usuario corresponde al repositorio frontend `sgrai-web`. |
| **CA-2:** Permite seleccionar patrullas verificadoras disponibles. Al confirmar, se crea una misión con `tipo_mision = 'RECUPERACION'`, vinculada a la patrulla y al `recuperacion_id`, transicionando la patrulla a `EN_RECUPERACION`. | `CP-H32-API-12`, `CP-H32-API-16`, `BUG-H32-API-01`, `BUG-H32-API-02`, `BUG-H32-API-04` | 🟢 **CUMPLIDO** | Bloqueo pesimista `.forUpdate()`, actualización atómica condicional de patrulla a `EN_RECUPERACION`, correlativo serializado con `pg_advisory_xact_lock`, creación de misión `DESPACHADA` con `fecha_inicio: null` e hito en `mision_hito`. |
| **CA-3:** Permite seleccionar insumos y herramientas del inventario logístico (`recurso`), especificando la cantidad asignada. | `CP-H32-API-01`, `CP-H32-API-03`, `CP-H32-API-04`, `CP-H32-API-10` | 🟢 **CUMPLIDO** | `AsignarRecursosRecuperacionInputSchema` valida arreglo no vacío de `{ recursoId, cantidad >= 1 }`. |
| **CA-4:** Regla de negocio §3.6: la API debe ejecutar un bloqueo transaccional `SELECT ... FOR UPDATE` sobre `recurso`, verificando para `es_individual = false` que `cantidad_inventario - cantidad_en_uso >= cantidad_solicitada`, impidiendo la asignación si el stock es insuficiente. | `CP-H32-API-13`, `CP-H32-API-16` | 🟢 **CUMPLIDO** | `obtenerRecursosParaBloqueo` ejecuta `.forUpdate()` sobre `recurso` dentro de `db.transaction()` y rechaza sobregiros de stock con `HTTP 409 Conflict`. |
| **CA-5:** Para activos individuales (`es_individual = true`, vehículos, bombas), se prohíbe la asignación si el recurso se encuentra en estado `EN_MANTENCION` o `NO_DISPONIBLE`. | `CP-H32-API-14`, `CP-H32-API-15`, `BUG-H32-API-03` | 🟢 **CUMPLIDO** | Rechaza `EN_MANTENCION`, `NO_DISPONIBLE` y `ASIGNADO` (`409`), valida cantidad igual a `1` (`400`), verifica saldo disponible `>= 1` e incrementa `cantidad_en_uso` dinámicamente sin sobrescribir activos multiunidad. |
| **CA-6:** La asignación de materiales debe persistirse en la tabla `recuperacion_recurso` y actualizar el campo `cantidad_en_uso` en la tabla `recurso`. | `CP-H32-API-16`, `CP-H32-API-18`, `BUG-H32-API-03`, `BUG-H32-API-07` | 🟢 **CUMPLIDO** | Migración `041_recuperacion_recurso_mision_id` aplicada en PostgreSQL; `recuperacion_recurso` persiste `cantidad_asignada` y `mision_id`, y `recurso.cantidad_en_uso` se actualiza con transición de estado correcta. |
| **CA-7:** El sistema debe emitir los eventos WebSocket `recuperacion:actualizada` y `recurso:actualizado`. | `CP-H32-API-16`, `BUG-H32-API-05` | 🟢 **CUMPLIDO** | Emisión verificada en servidor vivo con Socket.io/Redis Pub/Sub hacia todas las salas operativas y payload normalizado en `camelCase` con `cantidadDisponible`. |
| **CA-8:** El endpoint debe requerir el permiso RBAC `misiones:asignar`. | `CP-H32-API-06`, `CP-H32-API-07` | 🟢 **CUMPLIDO** | `POST /api/eventos-atp/recuperacion/[id]/asignar` exige token JWT Bearer (`401 Unauthorized` si falta) y valida `PERMISO_ASIGNAR_MISION` (`403 Forbidden` si carece de `misiones:asignar`). |
