# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-74 — Editar Planificación de Operativos de Recuperación (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Operativos de Recuperación (`sgrai-api` — `GET /api/eventos-atp/recuperacion/[id]` y `PATCH /api/eventos-atp/recuperacion/[id]`).  
> **Historia de Usuario:** HU-74 — *"Como Encargado Quiero modificar la descripción, fecha estimada y dotación de insumos o personal asignado a un operativo de recuperación en curso. Para adaptar el operativo ante variaciones en las necesidades de los sectores afectados o cambios en la disponibilidad logística."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript 5 + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis 7 + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H74-editar-operativo-recuperacion` (sincronizada con `develop`: `0` commits detrás, `24` commits delante).  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): agregar fecha_estimada_fin, actualizado_por_id y permiso recuperacion:editar (HU-74)`  
> * `feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)`  
> * `test(eventos-atp): agregar pruebas unitarias y de ruta para edicion de recuperacion (HU-74)`  
> * `docs(api): documentar PATCH /api/eventos-atp/recuperacion/{id} en openapi y eventos-atp.md (HU-74)`  
> * `feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)`  
> * `test(eventos-atp): agregar pruebas para reasignacion de patrulla y GET detalle (HU-74)`  
> * `docs(api): actualizar openapi y eventos-atp.md con GET y reasignacion de patrulla (HU-74)`  
> * `feat(seed): agregar fixture QA idempotente para operativos de recuperacion (HU-74)`  
> * `merge: integrar feature/H73-listar-operativos-recuperacion en feature/H74-editar-operativo-recuperacion`  
> * `fix(eventos-atp): robustecer detalle de operativo de recuperacion ante valores nulos y migraciones pendientes`  
> * `refactor(db): renombrar migracion a 045_recuperacion_edicion_auditoria (HU-74)`  
> * `chore(seed): corregir insert de patrulla y asegurar permiso recuperacion:editar en seed:h74`  
> * `docs(database): registrar migracion 045 en diccionario de datos de recuperacion`  
> * `merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)`  
> * `Merge remote-tracking branch 'origin/feature/H74-editar-operativo-recuperacion' into feature/H74-editar-operativo-recuperacion`  
> * `fix(test): restaurar imports de H74 y tipado en recuperacion.service.test.ts para next build`  
> * `style(test): ajustar formato en recuperacion.service.test.ts`  
>  
> **Fecha de Auditoría Inicial:** 24/11/2026 15:27.  
> **Fecha de Re-Test QA:** 25/11/2026 23:43.  
> **Estado de Certificación:** 🟢 **APROBADO EN RE-TEST — 100% DE CASOS DE PRUEBA Y CRITERIOS DE ACEPTACIÓN VERIFICADOS (24/24)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

En el ciclo inicial de auditoría (`24/11/2026 15:27`) sobre `feature/H74-editar-operativo-recuperacion`, se aprobaron `18` casos funcionales y se reportaron **6 defectos reales** (`BUG-H74-API-01` a `BUG-H74-API-06`) vinculados a condiciones de carrera TOCTOU y ausencia de filtro `eliminado_en IS NULL`, patrullas huérfanas sin misión previa ni reinicio de estado `DESPACHADA`, rechazo del permiso `recuperacion:crear` (CA-5) y bypass `x-user-id` en `GET`, manejo incorrecto de activos individuales/`EN_MANTENCION`, emisión incompleta de eventos Socket.io/Redis Pub/Sub y desfase de 75 commits frente a `develop`.

Tras la aplicación de los commits de corrección e integración por parte del equipo de desarrollo, se ejecutó el ciclo completo de **Re-Test QA (`25/11/2026 23:39–23:43`)** combinando auditoría de código, ejecución idempotente de migraciones Kysely sobre PostgreSQL 16 + PostGIS, análisis estático ESLint, compilación estricta TypeScript + Next.js, suite completa Vitest, pruebas de concurrencia ACID en vivo, validación de contrato OpenAPI 3.0 y peticiones `cURL` contra el servidor en producción (`localhost:3001`), comprobándose el cierre efectivo de los **6 defectos** y la aprobación de los **24 casos de prueba**.

| Métrica de Calidad | Auditoría Inicial (24/11) | Re-Test Final (25/11) | Observaciones |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **24** | **24** | 6 Defectos (`BUG-H74-API-01` a `06`) + 18 Casos Funcionales, RBAC, Validación, BD y Regresión (`CP-H74-API-01` a `18`) |
| **Casos Aprobados (Passed)** | **18** | **24** | Todos los flujos nominales, bordes, concurrencia, RBAC, migraciones y fixes cerrados sin observaciones |
| **Defectos Abiertos (Failed)** | **6** | **0** | 3 Críticos, 2 Altos y 1 Medio verificados como **APROBADO / CORREGIDO** en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Entorno operativo con PostgreSQL 16 + PostGIS (`puerto 5001`), Redis 7 (`puerto 6001`) y `sgrai-api` (`puerto 3001`) |
| **Tasa de Aprobación (% Pass)** | **75.0%** | **100.0%** | Cumplimiento íntegro de CA-1 a CA-5 y sin regresiones sobre `HU-32`, `HU-37`, `HU-38`, `HU-61`, `HU-69` ni `H73` |
| **Análisis Estático ESLint (`npm run lint`)** | 🟢 **0 errores** | 🟢 **0 errores** | Ejecución limpia sin advertencias ni errores (`exit code 0`) |
| **Compilación y Tipado (`tsc` / `next build`)** | 🟢 **27/27 rutas** | 🟢 **28/28 rutas** | `npx tsc --noEmit` y `npm run build` con Turbopack finalizados con `exit code 0` |
| **Suite Automatizada Vitest (`npm test`)** | 🟢 **881/881** | 🟢 **1040/1040** | `94/94` archivos aprobados; dirigidos `eventos-atp` + `openapi.json`: `3/3` archivos (`48/48` tests pass) |
| **Sincronización con Rama `develop`** | 🔴 **75 detrás** | 🟢 **0 detrás / 24 delante** | `HU-32` (`POST .../asignar`, `041`), `HU-61` (`072_evento_atp_base`) y `051` integrados y verificados |

---

## 2. Registro Técnico de Defectos Detectados y Verificación de Correcciones

### `BUG-H74-API-01`: Condición de Carrera (TOCTOU) en Recálculo de Stock y Reasignación de Patrulla sin `FOR UPDATE`, Precondición en `UPDATE` ni Filtro de Borrado Lógico (`eliminado_en IS NULL`)
* **Severidad:** **CRÍTICA** (Integridad Transaccional ACID, Consistencia de Inventario y Control de Concurrencia).
* **Estado Actual:** 🟢 **APROBADO / CORREGIDO EN RE-TEST (25/11/2026 23:42)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts`
  * `src/modules/eventos-atp/recuperacion.service.ts`
* **Descripción Técnica del Defecto Original:**
  1. `buscarRecuperacionPorId` carecía de `.forUpdate()` y del filtro `.where("eliminado_en", "is", null)`, permitiendo editar mediante `PATCH` registros eliminados lógicamente.
  2. `listarRecursosAsignadosRecuperacion` leía `recuperacion_recurso` antes de adquirir bloqueos de fila bajo aislamiento `READ COMMITTED`, causando pérdida de inventario físico (`100` unidades perdidas ante 6 peticiones concurrentes).
  3. `actualizarRecuperacion` omitía precondiciones de estado/borrado en el `UPDATE` y `buscarPatrullaPorId` / `actualizarEstadoPatrulla` no serializaban ni validaban `.where("estado", "=", "DISPONIBLE")`, habilitando doble asignación simultánea de una misma patrulla.
* **Verificación de Corrección en Re-Test (25/11/2026):**
  * `buscarRecuperacionPorId` (`recuperacion.repository.ts:762-778`) filtra `.where("eliminado_en", "is", null)` y aplica `.forUpdate()` cuando se invoca con `bloquear = true` desde `editarEventoRecuperacionService` (`recuperacion.service.ts:822`).
  * `listarRecursosAsignadosRecuperacion` (`recuperacion.repository.ts:424-439`) adquiere `.forUpdate()`, `buscarPatrullaPorId` (`líneas 88-101`) soporta `.forUpdate()`, `actualizarEstadoPatrulla` (`líneas 320-341`) exige `.where("estado", "=", "DISPONIBLE")` con `.returning(...)`, y `actualizarRecuperacion` (`líneas 456-481`) exige `.where("estado", "not in", ["COMPLETADA", "CANCELADA"]).where("eliminado_en", "is", null)`.
  * **Evidencia en vivo:**
    * 6 `PATCH` concurrentes (`[100, 110, 120, 130, 140, 150]`) conservaron exactamente el inventario: `cantidad_inventario = 450`, `cantidad_asignada = 130` (`450 + 130 = 580`, **0 unidades perdidas**).
    * 2 `PATCH` concurrentes asignando `PV-H74-02` a `REC-2026-7401` y `REC-2026-7402` resultaron en **`409 Conflict`** y **`200 OK`**, manteniendo asignación única en tabla `mision`.
    * `GET` y `PATCH` sobre registro con `eliminado_en = NOW()` retornaron ambos **`404 Not Found`**.

---

### `BUG-H74-API-02`: Bloqueo Huérfano de Patrulla sin Misión Previa, Respuesta con UUID Ficticio `00000000-...`, Omisión de Reinicio de Misión `EN_CURSO` y Liberación Ciega del Líder
* **Severidad:** **CRÍTICA** (Integridad Operativa ICS y Consistencia de Misiones y Personal).
* **Estado Actual:** 🟢 **APROBADO / CORREGIDO EN RE-TEST (25/11/2026 23:42)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts`
  * `src/modules/eventos-atp/recuperacion.repository.ts`
  * `src/modules/eventos-atp/recuperacion.schema.ts`
* **Descripción Técnica del Defecto Original:**
  1. Al enviar `patrullaId` sobre un operativo `PLANIFICADA` sin misión previa (`misionActual === undefined`), el servicio marcaba la patrulla en `EN_RECUPERACION` sin crear registro en `mision` y retornaba UUIDs ficticios `00000000-0000-0000-0000-000000000000`.
  2. `buscarMisionPorRecuperacionId` no filtraba misiones `CANCELADA`/`RECHAZADA`, `reasignarPatrullaMision` no reiniciaba una misión `EN_CURSO` a `DESPACHADA` (`fecha_inicio = null`) ni registraba fila en `notificaciones_mision`.
  3. La liberación del líder no verificaba `activo = true`, otras asignaciones activas en patrullas/cuadrillas ni contemplaba a los demás integrantes de `patrulla_personal`.
* **Verificación de Corrección en Re-Test (25/11/2026):**
  * `EventoRecuperacionResponseSchema` y `construirRespuestaRecuperacion` aceptan `mision` y `patrulla` nulos sin fabricar UUIDs ficticios; si `!misionActual`, `editarEventoRecuperacionService` (`recuperacion.service.ts:983-1118`) crea la misión `RECUPERACION` (`DESPACHADA`) con `generarSiguienteCodigoMision` (`pg_advisory_xact_lock`) y `registrarHitoMisionInicial`.
  * `buscarMisionPorRecuperacionId` (`recuperacion.repository.ts:441-454`) excluye `CANCELADA` y `RECHAZADA` ordenando por `creado_en DESC`; `reasignarPatrullaMision` (`líneas 483-532`) restablece `estado = 'DESPACHADA'` y `fecha_inicio = null`, insertando notificación en `notificaciones_mision` (`insertarNotificacionMisionRecuperacion`); `contarOtrasAsignacionesActivasUsuario` (`líneas 360-399`) verifica patrullas y cuadrillas activas considerando `listarIntegrantesPatrullaIds` y `activo = true`.
  * **Evidencia en vivo:**
    * `PATCH` con `patrullaId` sobre `REC-2026-7402` sin fila previa en `mision` retornó `200 OK` creando la misión real `MIS-2026-9102` en estado `DESPACHADA` asociada a `PV-H74-02` (`EN_RECUPERACION`).
    * Reasignación sobre `MIS-2026-7401` (`EN_CURSO`) retornó `200 OK` reiniciando la misión en BD a `estado = 'DESPACHADA'` y `fecha_inicio = null`, insertando fila en `notificaciones_mision` (`PENDIENTE_ENVIO`) y el hito `REASIGNACION_PATRULLA`; al liberar `PV-H74-02` con `0` misiones activas remanentes volvió a `DISPONIBLE`, mientras `PV-H74-01` mantuvo `EN_RECUPERACION` mientras conservó `MIS-2026-7402`.

---

### `BUG-H74-API-03`: Incumplimiento de CA-5 al Rechazar Permiso `recuperacion:crear`, Bypass de Autenticación JWT vía `x-user-id` en `GET` y Desalineación OpenAPI
* **Severidad:** **ALTA** (Seguridad RBAC/JWT, Cumplimiento de Criterio de Aceptación CA-5 y Contrato OpenAPI).
* **Estado Actual:** 🟢 **APROBADO / CORREGIDO EN RE-TEST (25/11/2026 23:42)**.
* **Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/[id]/route.ts`
  * `src/app/api/eventos-atp/recuperacion/route.ts`
  * `src/lib/openapi/index.ts`
* **Descripción Técnica del Defecto Original:**
  1. `PATCH` utilizaba `verificarPermiso(usuarioId, PERMISO_EDITAR_RECUPERACION)`, rechazando con `403` a usuarios con permiso `recuperacion:crear` (incumpliendo CA-5).
  2. `GET /api/eventos-atp/recuperacion` y `GET /api/eventos-atp/recuperacion/[id]` aceptaban cabecera plana `x-user-id` sin token JWT Bearer.
  3. `openapi/index.ts` omitía `security: [{ BearerAuth: [] }]` en `GET`/`PATCH`, exponía `x-user-id` y duplicaba el registro `ObtenerRecuperacionDetalleResponse`.
* **Verificación de Corrección en Re-Test (25/11/2026):**
  * Ambos handlers `GET` (`recuperacion/route.ts:25` y `recuperacion/[id]/route.ts:34`) eliminan `x-user-id` y autentican estrictamente con `extraerUsuarioId(req)`.
  * `PATCH` (`recuperacion/[id]/route.ts:96-101`) valida acceso mediante `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_CREAR_RECUPERACION, PERMISO_EDITAR_RECUPERACION], "Acceso denegado. Se requiere permiso 'recuperacion:crear', 'recuperacion:editar' o rol Encargado.")`.
  * `src/lib/openapi/index.ts` declara `security: [{ BearerAuth: [] }]` sin cabecera `x-user-id` ni registros duplicados.
  * **Evidencia en vivo:**
    * Peticiones con solo `-H "x-user-id: 00000000-0000-4000-8000-000000000003"` (sin JWT) a `GET` listado, `GET {id}` y `PATCH {id}` retornaron todas **`401 Unauthorized`**.
    * Usuario temporal con rol conteniendo únicamente `recuperacion:crear` recibió **`200 OK`** en `PATCH`; usuario `ENCARGADO` recibió **`200 OK`**; usuario `CALL_CENTER` recibió **`403 Forbidden`**.
    * `GET /openapi.json` (`v0.12.0`) expuso `security: [{"BearerAuth":[]}]` y parámetro único `path:id` en `GET`/`PATCH`.

---

### `BUG-H74-API-04`: Asignación Permitida de Recursos en Estado `EN_MANTENCION` y Corrupción de `cantidad_inventario` en Activos Individuales (`es_individual = true`)
* **Severidad:** **ALTA** (Regla Logística de Inventario y Disponibilidad de Activos).
* **Estado Actual:** 🟢 **APROBADO / CORREGIDO EN RE-TEST (25/11/2026 23:42)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts`
  * `src/modules/eventos-atp/recuperacion.repository.ts`
* **Descripción Técnica del Defecto Original:**
  No se validaba el estado `EN_MANTENCION` ni `NO_DISPONIBLE` al incrementar/asignar recursos, y al operar sobre activos con `es_individual = true` se restaba directamente `cantidad_inventario` (`1 -> 0`) en vez de actualizar `cantidad_en_uso` y el estado `ASIGNADO` / `DISPONIBLE`.
* **Verificación de Corrección en Re-Test (25/11/2026):**
  * `editarEventoRecuperacionService` (`recuperacion.service.ts:906-913`) rechaza con `StockInsuficienteError` (`409 Conflict`) cuando `delta > 0` y `recursoBd.estado === "EN_MANTENCION" || recursoBd.estado === "NO_DISPONIBLE"`.
  * `ajustarStockRecurso` (`recuperacion.repository.ts:204-285`) bifurca por `es_individual`: para activos serializados actualiza `cantidad_en_uso` manteniendo íntegro `cantidad_inventario` y transiciona entre `ASIGNADO` y `DISPONIBLE`.
  * **Evidencia en vivo:**
    * Activo individual `EN_MANTENCION`: `PATCH` retornó **`409 Conflict`** (`"El recurso \"Motobomba QA Mantencion\" no está disponible para asignación (estado actual: EN_MANTENCION)."`).
    * Activo individual `DISPONIBLE` (`cantidad_inventario: 1, cantidad_en_uso: 0`): tras asignación retornó **`200 OK`** con `estado: "ASIGNADO", cantidad_inventario: 1, cantidad_en_uso: 1`; tras devolución diferencial retornó **`200 OK`** restaurando `estado: "DISPONIBLE", cantidad_inventario: 1, cantidad_en_uso: 0`.

---

### `BUG-H74-API-05`: Difusión WebSocket Incompleta en `PATCH` (`emitirRecursoActualizado`, `notificarPatrullaActualizada`), Salas Omitidas en Redis Pub/Sub y Tipado Ausente en `ServerToClientEvents`
* **Severidad:** **MEDIA** (Sincronización en Tiempo Real Socket.io / Redis Pub/Sub y Seguridad de Tipos).
* **Estado Actual:** 🟢 **APROBADO / CORREGIDO EN RE-TEST (25/11/2026 23:41)**.
* **Archivos Afectados:**
  * `src/lib/socket/types.ts`
  * `src/lib/socket/index.ts`
  * `src/modules/eventos-atp/recuperacion.service.ts`
* **Descripción Técnica del Defecto Original:**
  Faltaba tipado en `ServerToClientEvents` para `"recuperacion:actualizada"` y `"mision:reasignada"`, la rama Redis Pub/Sub de `emitirRecuperacionActualizada` omitía las salas `"encargado"` y `"mapa"`, y el servicio no emitía eventos de actualización de stock ni estado de patrullas tras `PATCH`.
* **Verificación de Corrección en Re-Test (25/11/2026):**
  * `ServerToClientEvents` (`src/lib/socket/types.ts:12, 67-73`) declara tipado fuerte para `"recuperacion:actualizada"` y `"mision:reasignada"`.
  * `emitirRecuperacionActualizada` (`src/lib/socket/index.ts:435-463`) publica en Redis Pub/Sub sobre las tres salas `["sala:encargados", "encargado", "mapa"]`.
  * `editarEventoRecuperacionService` (`src/modules/eventos-atp/recuperacion.service.ts:1150-1204`) invoca `emitirRecursoActualizado` por cada recurso con variación de stock y `emitirPatrullaActualizada` para patrulla liberada y nueva patrulla asignada, además de `emitirRecuperacionActualizada`, `notificarMisionAsignada` y `emitirPatrullaLiberadaDeOperativo`.
  * Validado mediante inspección de código, arranque con adaptador Redis Pub/Sub activo, `npx tsc --noEmit` sin errores y `recuperacion.service.test.ts` (`33/33` tests pass).

---

### `BUG-H74-API-06`: Desfase Crítico respecto a `develop` (75 Commits Detrás) con Regresión de `HU-32` (`POST .../asignar`), `HU-61` (`evento_atp`), Omisión de `pg_advisory_xact_lock` y Pérdida de `mision_id` en `recuperacion_recurso`
* **Severidad:** **CRÍTICA** (Integración Continua, Consistencia de Base de Datos y Regresión Funcional).
* **Estado Actual:** 🟢 **APROBADO / CORREGIDO EN RE-TEST (25/11/2026 23:42)**.
* **Archivos Afectados:**
  * Rama `feature/H74-editar-operativo-recuperacion` sincronizada con `origin/develop`
  * `src/lib/db/migrations/` (`041`, `043`, `045`, `051`, `071`, `072`)
  * `src/modules/eventos-atp/recuperacion.repository.ts`
* **Descripción Técnica del Defecto Original:**
  La rama acumulaba 75 commits de desfase respecto a `develop`, carecía de `pg_advisory_xact_lock`, perdía la columna `mision_id` de `recuperacion_recurso` al editar recursos, conservaba la migración `035` obsoleta y excluía los módulos de `HU-32` (`POST .../asignar`) y `HU-61` (`072_evento_atp_base.ts`).
* **Verificación de Corrección en Re-Test (25/11/2026):**
  * `git rev-list --left-right --count develop...HEAD` = **`0 24`** (rama completamente al día con `develop`, 0 commits detrás).
  * Migraciones limpias y secuenciales (`44` registros en `kysely_migration` verificados en PostgreSQL, incluyendo `041_recuperacion_recurso_mision_id`, `043`, `045`, `051_permiso_misiones_terreno_verificar`, `071` y `072_evento_atp_base` con clave foránea `recuperacion_evento_atp_id_fkey` verificada en `\d recuperacion`).
  * `generarSiguienteCodigoRecuperacion` y `generarSiguienteCodigoMision` (`recuperacion.repository.ts:40-86`) ejecutan `pg_advisory_xact_lock`.
  * **Evidencia en vivo:** Tras editar dotación mediante `PATCH`, `SELECT recurso_id, cantidad_asignada, mision_id FROM recuperacion_recurso` conservó intacto `mision_id = '74200000-0000-4000-8000-000000000001'`; además `POST /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002/asignar` (HU-32) respondió **`200 OK`**.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H74-API-01` | Control de concurrencia TOCTOU en recálculo de stock/patrulla (`FOR UPDATE`) y rechazo de edición en operativos eliminados lógicamente | Concurrencia / ACID | Repo / Service | Crítica | Operativo `REC-2026-7401` (`EN_EJECUCION`, 80 planchas, inventario 500), patrulla `PV-H74-02` `DISPONIBLE`, u operativo con `eliminado_en IS NOT NULL` | 6 peticiones `PATCH` concurrentes de stock (`100..150`), 2 `PATCH` concurrentes de `patrullaId`, y `PATCH` sobre registro con `eliminado_en IS NOT NULL` | Serialización transaccional con `.forUpdate()`, inventario conservado (`580`), rechazo `409` en doble asignación de patrulla y `404` sobre eliminado lógico | 6 `PATCH` conservan inventario (`450+130=580`, 0 pérdidas); carrera de patrulla resulta en `409` y `200`; `GET` y `PATCH` sobre eliminado retornan `404` | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `BUG-H74-API-02` | Consistencia de misión y personal al reasignar `patrullaId` (operativo sin misión previa, misión `EN_CURSO` y liberación de líder/integrantes) | Regla de Negocio / ICS | Service / Repo | Crítica | Operativo `PLANIFICADA` sin fila en `mision`, o misión `EN_CURSO` reasignada a nueva patrulla `DISPONIBLE` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}` sin misión previa y reasignación sobre `MIS-2026-7401` (`EN_CURSO`) | Crear misión vinculada sin dejar patrulla huérfana ni UUIDs `00000000-...`; reiniciar estado `DESPACHADA` y registrar `notificaciones_mision` | Crea `MIS-2026-9102` (`DESPACHADA`); `MIS-2026-7401` reinicia a `DESPACHADA` (`fecha_inicio: null`) con fila en `notificaciones_mision`; patrulla sin otras misiones vuelve a `DISPONIBLE` | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `BUG-H74-API-03` | Autorización de permiso `recuperacion:crear` / rol Encargado en `PATCH` (CA-5), bloqueo de bypass `x-user-id` en `GET` y alineación OpenAPI | Seguridad / RBAC / Contrato | Route / OpenAPI | Alta | Usuario autenticado con permiso `recuperacion:crear`, petición `GET`/`PATCH` sin JWT con solo `x-user-id`, y consulta a `/openapi.json` | `PATCH` con JWT de rol con `recuperacion:crear`; `GET`/`PATCH` con `-H "x-user-id: ...0003"` sin Bearer; inspección `GET /openapi.json` | `PATCH` permite acceso con `recuperacion:crear` o rol Encargado (CA-5); `GET` y `PATCH` rechazan `x-user-id` con `401`; OpenAPI declara `BearerAuth` sin duplicados | `PATCH` con `recuperacion:crear` responde `200 OK`; `GET` listado, `GET {id}` y `PATCH {id}` con solo `x-user-id` retornan `401`; OpenAPI declara `BearerAuth` único | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `BUG-H74-API-04` | Validación de estado `EN_MANTENCION` y manejo de `cantidad_en_uso` / `ASIGNADO` para activos individuales (`es_individual = true`) | Regla de Negocio / Inventario | Service / Repo | Alta | Recursos en tabla `recurso` con `es_individual = true`: uno en `EN_MANTENCION` y otro en `DISPONIBLE` (`inv: 1, uso: 0`) | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002` asignando activo `EN_MANTENCION` y luego asignando/devolviendo activo `DISPONIBLE` | Rechazar con `409 Conflict` activo en `EN_MANTENCION` y gestionar activos individuales vía `cantidad_en_uso` y estado `ASIGNADO`/`DISPONIBLE` sin restar `cantidad_inventario` | `EN_MANTENCION` rechazado con `409 Conflict`; activo `DISPONIBLE` pasa a `ASIGNADO` (`inv:1, uso:1`) y tras devolución retorna a `DISPONIBLE` (`inv:1, uso:0`) | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `BUG-H74-API-05` | Emisión completa Socket.io (`emitirRecursoActualizado`, `emitirPatrullaActualizada`), salas Redis Pub/Sub y tipado en `ServerToClientEvents` | Tiempo Real / Socket | Service / Socket | Media | Inspección de `src/lib/socket/types.ts`, `src/lib/socket/index.ts`, `recuperacion.service.ts` y compilación/tests activos | Revisión de `ServerToClientEvents`, rama Redis de `emitirRecuperacionActualizada`, `editarEventoRecuperacionService`, `tsc --noEmit` y `vitest` | Emisión de actualización de recursos/patrullas, publicación en `["sala:encargados","encargado","mapa"]` en Redis y eventos tipados sin `as any` | Tipos declarados en `ServerToClientEvents`, Redis Pub/Sub unificado en las 3 salas, llamadas emisoras integradas en servicio y `tsc`/`vitest` limpios | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:41 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `BUG-H74-API-06` | Sincronización con rama `develop`, preservación de `HU-32` (`POST .../asignar`, `mision_id` en `recuperacion_recurso`), `HU-61` y `pg_advisory_xact_lock` | Integridad / CI / BD | Git / Migraciones / Repo | Crítica | Comparativa de rama actual frente a `origin/develop` y prueba viva de `HU-32` / `recuperacion_recurso` | `git rev-list --left-right --count develop...HEAD`, `npm run db:migrate`, `PATCH` + `SELECT mision_id`, y `POST .../asignar` | Rama sincronizada con `develop` (`0` detrás) preservando `HU-32`, `HU-61`, `pg_advisory_xact_lock` y correlativos de migración únicos | `develop...HEAD` = `0 24`; `44` migraciones limpias (`041`, `043`, `045`, `051`, `072`); `mision_id` preservado tras `PATCH`; `POST .../asignar` responde `200 OK` | **APROBADO** | 24/11/2026 15:21 | 25/11/2026 23:42 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `CP-H74-API-01` | Consulta de detalle de operativo de recuperación vía `GET /api/eventos-atp/recuperacion/{id}` para precarga de edición (CA-1) | Funcional / API | Route / Service / Repo | Crítica | Operativo `REC-2026-7401` sembrado en BD en estado `EN_EJECUCION` y usuario `ENCARGADO` autenticado | `GET /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_ENC>` | `HTTP 200 OK` con ficha completa incluyendo `descripcion`, `fechaEstimadaFin`, `actualizadoPorId`, `patrulla`, `mision`, `recursos` e `historial` | `HTTP 200 OK` retornando estructura `RecuperacionDetalleResponse` completa (`REC-2026-7401`, 2 recursos, `cantidadInsumosAsignados: 100`) | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:43 | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-02` | Rechazo `400 Bad Request` y `404 Not Found` en `GET /api/eventos-atp/recuperacion/{id}` ante UUID inválido u operativo inexistente | Validación / Robustez | Route / Service | Media | Usuario `ENCARGADO` autenticado con JWT Bearer | `GET .../recuperacion/id-invalido` y `GET .../recuperacion/74999999-0000-4000-8000-000000000999` | `HTTP 400` para UUID malformado y `HTTP 404` para UUID inexistente | Retorna `HTTP 400 Bad Request` y `HTTP 404 Not Found`; verificado en Re-Test en `route.test.ts` (`14/14` pass) | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:41 | fix(eventos-atp): robustecer detalle de operativo de recuperacion ante valores nulos y migraciones pendientes |
| `CP-H74-API-03` | Rechazo `401 Unauthorized` en `PATCH /api/eventos-atp/recuperacion/{id}` ante ausencia de token JWT Bearer | Seguridad / Auth | Route Handler | Crítica | Servidor API activo y petición sin cabecera `Authorization` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` sin headers de autenticación | `HTTP 401 Unauthorized` con mensaje indicando requerimiento de `Authorization: Bearer <token>` | Retorna `HTTP 401 Unauthorized`: `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:42 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-04` | Bloqueo `403 Forbidden` en `PATCH /api/eventos-atp/recuperacion/{id}` para perfil sin permiso (`CALL_CENTER`) | Seguridad / RBAC | Route / Auth Service | Crítica | Usuario autenticado con rol `CALL_CENTER` (`callcenter@valdivia.cl`) | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_CC>` | `HTTP 403 Forbidden` denegando la edición de planificación | Retorna `HTTP 403 Forbidden`: `"Acceso denegado. Se requiere permiso 'recuperacion:crear', 'recuperacion:editar' o rol Encargado."` | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:43 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `CP-H74-API-05` | Validación `400 Bad Request` ante parámetro `id` no UUID, payload vacío `{}` o JSON malformado en `PATCH` | Validación / Zod | Route / Schema | Alta | Usuario `ENCARGADO` autenticado con JWT Bearer | `PATCH .../no-es-uuid` y `PATCH .../74100000-...-0001` con body `{}` | `HTTP 400 Bad Request` con arreglo `errors` detallando validación de UUID y regla `.refine()` de al menos un campo | Retorna `HTTP 400 Bad Request` con detalle de `campo` y `mensaje`; revalidado en `route.test.ts` y `recuperacion.service.test.ts` | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:41 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-06` | Validación `400 Bad Request` para `fechaEstimadaFin` sin zona horaria ISO-8601 y para fecha anterior a `creado_en` | Validación / Negocio | Schema / Service | Alta | Operativo `REC-2026-7401` activo | `{"fechaEstimadaFin":"2026-11-28T18:00:00"}` y `{"fechaEstimadaFin":"2020-01-01T00:00:00.000Z"}` | `HTTP 400 Bad Request` por formato ISO-8601 sin offset y `FechaEstimadaInvalidaError` por fecha anterior a `creado_en` | Validado con rechazo `HTTP 400 Bad Request` y cobertura en `recuperacion.service.test.ts` (`33/33` pass) | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:41 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-07` | Edición exitosa de descripción, fecha estimada de término y dotación diferencial de recursos en operativo `EN_EJECUCION` (CA-2) | Funcional / Transacción | Route / Service / DB | Crítica | `REC-2026-7401` con 80 planchas (`inv:500`) y 20 frazadas (`inv:400`), más cajas alimentos (`inv:300`) | `PATCH` con nueva `descripcion`, `fechaEstimadaFin` y `recursos: [{planchas:60}, {cajas:15}]` | `HTTP 200 OK`; inventario actualizado atómicamente: planchas `520`, frazadas `420` (devueltas) y cajas `285` (descontadas) | `HTTP 200 OK` y tabla `recurso` en PostgreSQL reflejando `520`, `420` y `285` con `mision_id` preservado en `recuperacion_recurso` | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:43 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-08` | Registro inmutable de auditoría (`actualizado_en`, `actualizado_por_id`) y sincronización de `mision.descripcion` (CA-4) | Auditoría / DB | Repository / DB | Crítica | Ejecución exitosa de `CP-H74-API-07` por Encargado (`00000000-0000-4000-8000-000000000003`) | Consulta SQL sobre tablas `recuperacion` y `mision` tras `PATCH` | `actualizado_por_id = 00000000-...-0003`, `actualizado_en > creado_en` y `mision.descripcion` sincronizada | Columnas `actualizado_por_id`, `actualizado_en`, `fecha_estimada_fin` y `mision.descripcion` verificadas en PostgreSQL | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-09` | Limpieza explícita `fechaEstimadaFin: null` e idempotencia al enviar la misma `patrullaId` asignada | Caso de Borde | Service / Repo | Media | Operativo activo con `fechaEstimadaFin` definida y patrulla asignada `74500000-...-0002` | `PATCH` con `{"fechaEstimadaFin":null}` y `PATCH` con la misma `patrullaId` actual | `HTTP 200 OK` anulando `fechaEstimadaFin` a `null` y omitiendo error `409` ante reenvío idempotente de misma patrulla | Comportamiento verificado sin duplicación de hitos en `recuperacion.service.test.ts` (`33/33` tests pass) | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:41 | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-10` | Bloqueo de edición cuando el operativo se encuentra en estado `COMPLETADA` (`409 Conflict` — CA-3) | Regla de Negocio | Service / Route | Crítica | Operativo `REC-2026-7403` (`74100000-...-0003`) en estado `COMPLETADA` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000003` con `{"descripcion":"Intento completada"}` | `HTTP 409 Conflict` bloqueando cualquier modificación sobre operativo completado | Retorna `HTTP 409 Conflict`: `"No es posible editar un operativo de recuperación en estado COMPLETADA."` | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:43 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-11` | Bloqueo de edición cuando el operativo se encuentra en estado `CANCELADA` (`409 Conflict` — CA-3) | Regla de Negocio | Service / Route | Crítica | Operativo `REC-2026-7404` (`74100000-...-0004`) en estado `CANCELADA` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000004` con `{"descripcion":"Intento cancelada"}` | `HTTP 409 Conflict` bloqueando cualquier modificación sobre operativo cancelado | Retorna `HTTP 409 Conflict`: `"No es posible editar un operativo de recuperación en estado CANCELADA."` | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:43 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-12` | Reasignación exitosa de `patrullaId` a patrulla `DISPONIBLE` con registro de hito `REASIGNACION_PATRULLA` en `mision_hito` e historial | Funcional / ICS | Service / Repo / DB | Alta | `REC-2026-7401` con `PV-H74-01` y patrulla `PV-H74-02` en estado `DISPONIBLE` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}` | `HTTP 200 OK`, `PV-H74-02` pasa a `EN_RECUPERACION`, misión reinicia a `DESPACHADA` y se inserta hito `REASIGNACION_PATRULLA` en `mision_hito` | `HTTP 200 OK`, `PV-H74-02` en `EN_RECUPERACION`, `MIS-2026-7401` en `DESPACHADA`, notificación y hito registrados en PostgreSQL | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-13` | Protección de patrulla anterior con otras misiones activas (`contarOtrasMisionesActivasPatrulla > 0`) | Regla de Negocio / ICS | Repository | Alta | `PV-H74-01` asignada simultáneamente a `MIS-2026-7401` (`EN_CURSO`) y `MIS-2026-7402` (`DESPACHADA`) | Reasignación de `REC-2026-7401` desde `PV-H74-01` hacia `PV-H74-02` | `PV-H74-01` conserva estado `EN_RECUPERACION` mientras mantenga `MIS-2026-7402` activa | Consulta SQL confirma `PV-H74-01` permaneció en `EN_RECUPERACION` al tener 1 misión activa remanente | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-14` | Rechazo `409 Conflict` por stock insuficiente al incrementar o añadir insumo en `PATCH` | Regla de Negocio | Service / Route | Crítica | `REC-2026-7401` con 80 planchas asignadas y `500` disponibles en bodega | `PATCH` solicitando `{"recursos":[{"recursoId":"74000000-...-0001","cantidad":9999}]}` | `HTTP 409 Conflict` detallando incremento solicitado (`9919`) y disponible (`500`) | Retorna `HTTP 409 Conflict` por stock insuficiente; cubierto también en pruebas unitarias/ruta Vitest | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:41 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-15` | Rechazo `409 Conflict` al reasignar `patrullaId` cuya unidad ya se encuentra en estado `EN_RECUPERACION` | Regla de Negocio / ICS | Service / Route | Alta | Patrulla `PV-H74-02` ocupada en estado `EN_RECUPERACION` | `PATCH .../74100000-...-0002` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}` | `HTTP 409 Conflict` indicando que la patrulla no está disponible | Retorna `HTTP 409 Conflict`: `"La patrulla \"Patrulla Verificadora Norte H74\" no está disponible para asignación (estado actual: EN_RECUPERACION)."` | **APROBADO** | 24/11/2026 15:26 | 25/11/2026 23:42 | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-16` | Rechazo `404 Not Found` cuando el operativo, el recurso o la patrulla no existen en PostgreSQL | Robustez / DAL | Service / Repo | Alta | UUIDs inexistentes (`74999999-0000-4000-8000-000000000999`) | Peticiones `PATCH` con ID inexistente de operativo, recurso y patrulla | `HTTP 404 Not Found` específico por entidad inexistente | Retorna `HTTP 404 Not Found`: `"El operativo de recuperación indicado no fue encontrado."` | **APROBADO** | 24/11/2026 15:24 | 25/11/2026 23:42 | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-17` | Ejecución idempotente de migraciones `043` y `045` (sobre secuencia unificada con `develop`) y siembra del fixture `seed:h74` en PostgreSQL 16 | Base de Datos | Migración / Seed | Alta | Contenedor PostgreSQL 16 + PostGIS operativo en puerto `5001` | `npm run db:migrate && npm run seed:h74` | Columnas `fecha_estimada_fin`, `actualizado_por_id`, FK `recuperacion_evento_atp_id_fkey`, `mision_id` en `recuperacion_recurso`, `44` migraciones limpias y 4 operativos | Migraciones `043` y `045` aplicadas sobre `develop` (`44` registros en `kysely_migration`) y fixture `seed:h74` sembrado con exit code `0` | **APROBADO** | 24/11/2026 15:23 | 25/11/2026 23:40 | merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74) |
| `CP-H74-API-18` | Verificación integral de `npm run lint`, `tsc --noEmit`, `npm run build` y suite Vitest (`1040/1040`) | Calidad / Regresión | Unit / Build / Lint | Alta | Rama `feature/H74-editar-operativo-recuperacion` sincronizada con `develop` | `npm run lint && npx tsc --noEmit && npm run build && npm test` | Cero errores de lint/build/tipos y 100% de pruebas unitarias aprobadas | `lint` `0` errores, `tsc --noEmit` exit `0`, `next build` `28/28` rutas, `npm test` `94/94` archivos (`1040/1040` tests pass) | **APROBADO** | 24/11/2026 15:23 | 25/11/2026 23:41 | fix(test): restaurar imports de H74 y tipado en recuperacion.service.test.ts para next build |

---

## 4. Exportación Tabular de Casos de Prueba (TSV)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H74-API-01	Control de concurrencia TOCTOU en recálculo de stock/patrulla (FOR UPDATE) y rechazo de edición en operativos eliminados lógicamente	Concurrencia / ACID	Repo / Service	Crítica	Operativo REC-2026-7401 (EN_EJECUCION, 80 planchas, inventario 500), patrulla PV-H74-02 DISPONIBLE, u operativo con eliminado_en IS NOT NULL	6 peticiones PATCH concurrentes de stock (100..150), 2 PATCH concurrentes de patrullaId, y PATCH sobre registro con eliminado_en IS NOT NULL	Serialización transaccional con .forUpdate(), inventario conservado (580), rechazo 409 en doble asignación de patrulla y 404 sobre eliminado lógico	6 PATCH conservan inventario (450+130=580, 0 pérdidas); carrera de patrulla resulta en 409 y 200; GET y PATCH sobre eliminado retornan 404	APROBADO	24/11/2026 15:26	25/11/2026 23:42	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
BUG-H74-API-02	Consistencia de misión y personal al reasignar patrullaId (operativo sin misión previa, misión EN_CURSO y liberación de líder/integrantes)	Regla de Negocio / ICS	Service / Repo	Crítica	Operativo PLANIFICADA sin fila en mision, o misión EN_CURSO reasignada a nueva patrulla DISPONIBLE	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002 con {"patrullaId":"74500000-0000-4000-8000-000000000002"} sin misión previa y reasignación sobre MIS-2026-7401 (EN_CURSO)	Crear misión vinculada sin dejar patrulla huérfana ni UUIDs 00000000-...; reiniciar estado DESPACHADA y registrar notificaciones_mision	Crea MIS-2026-9102 (DESPACHADA); MIS-2026-7401 reinicia a DESPACHADA (fecha_inicio: null) con fila en notificaciones_mision; patrulla sin otras misiones vuelve a DISPONIBLE	APROBADO	24/11/2026 15:26	25/11/2026 23:42	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
BUG-H74-API-03	Autorización de permiso recuperacion:crear / rol Encargado en PATCH (CA-5), bloqueo de bypass x-user-id en GET y alineación OpenAPI	Seguridad / RBAC / Contrato	Route / OpenAPI	Alta	Usuario autenticado con permiso recuperacion:crear, petición GET/PATCH sin JWT con solo x-user-id, y consulta a /openapi.json	PATCH con JWT de rol con recuperacion:crear; GET/PATCH con -H "x-user-id: ...0003" sin Bearer; inspección GET /openapi.json	PATCH permite acceso con recuperacion:crear o rol Encargado (CA-5); GET y PATCH rechazan x-user-id con 401; OpenAPI declara BearerAuth sin duplicados	PATCH con recuperacion:crear responde 200 OK; GET listado, GET {id} y PATCH {id} con solo x-user-id retornan 401; OpenAPI declara BearerAuth único	APROBADO	24/11/2026 15:26	25/11/2026 23:42	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
BUG-H74-API-04	Validación de estado EN_MANTENCION y manejo de cantidad_en_uso / ASIGNADO para activos individuales (es_individual = true)	Regla de Negocio / Inventario	Service / Repo	Alta	Recursos en tabla recurso con es_individual = true: uno en EN_MANTENCION y otro en DISPONIBLE (inv: 1, uso: 0)	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002 asignando activo EN_MANTENCION y luego asignando/devolviendo activo DISPONIBLE	Rechazar con 409 Conflict activo en EN_MANTENCION y gestionar activos individuales vía cantidad_en_uso y estado ASIGNADO/DISPONIBLE sin restar cantidad_inventario	EN_MANTENCION rechazado con 409 Conflict; activo DISPONIBLE pasa a ASIGNADO (inv:1, uso:1) y tras devolución retorna a DISPONIBLE (inv:1, uso:0)	APROBADO	24/11/2026 15:26	25/11/2026 23:42	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
BUG-H74-API-05	Emisión completa Socket.io (emitirRecursoActualizado, emitirPatrullaActualizada), salas Redis Pub/Sub y tipado en ServerToClientEvents	Tiempo Real / Socket	Service / Socket	Media	Inspección de src/lib/socket/types.ts, src/lib/socket/index.ts, recuperacion.service.ts y compilación/tests activos	Revisión de ServerToClientEvents, rama Redis de emitirRecuperacionActualizada, editarEventoRecuperacionService, tsc --noEmit y vitest	Emisión de actualización de recursos/patrullas, publicación en ["sala:encargados","encargado","mapa"] en Redis y eventos tipados sin as any	Tipos declarados en ServerToClientEvents, Redis Pub/Sub unificado en las 3 salas, llamadas emisoras integradas en servicio y tsc/vitest limpios	APROBADO	24/11/2026 15:26	25/11/2026 23:41	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
BUG-H74-API-06	Sincronización con rama develop, preservación de HU-32 (POST .../asignar, mision_id en recuperacion_recurso), HU-61 y pg_advisory_xact_lock	Integridad / CI / BD	Git / Migraciones / Repo	Crítica	Comparativa de rama actual frente a origin/develop y prueba viva de HU-32 / recuperacion_recurso	git rev-list --left-right --count develop...HEAD, npm run db:migrate, PATCH + SELECT mision_id, y POST .../asignar	Rama sincronizada con develop (0 detrás) preservando HU-32, HU-61, pg_advisory_xact_lock y correlativos de migración únicos	develop...HEAD = 0 24; 44 migraciones limpias (041, 043, 045, 051, 072); mision_id preservado tras PATCH; POST .../asignar responde 200 OK	APROBADO	24/11/2026 15:21	25/11/2026 23:42	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
CP-H74-API-01	Consulta de detalle de operativo de recuperación vía GET /api/eventos-atp/recuperacion/{id} para precarga de edición (CA-1)	Funcional / API	Route / Service / Repo	Crítica	Operativo REC-2026-7401 sembrado en BD en estado EN_EJECUCION y usuario ENCARGADO autenticado	GET /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con ficha completa incluyendo descripcion, fechaEstimadaFin, actualizadoPorId, patrulla, mision, recursos e historial	HTTP 200 OK retornando estructura RecuperacionDetalleResponse completa (REC-2026-7401, 2 recursos, cantidadInsumosAsignados: 100)	APROBADO	24/11/2026 15:24	25/11/2026 23:43	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-02	Rechazo 400 Bad Request y 404 Not Found en GET /api/eventos-atp/recuperacion/{id} ante UUID inválido u operativo inexistente	Validación / Robustez	Route / Service	Media	Usuario ENCARGADO autenticado con JWT Bearer	GET .../recuperacion/id-invalido y GET .../recuperacion/74999999-0000-4000-8000-000000000999	HTTP 400 para UUID malformado y HTTP 404 para UUID inexistente	Retorna HTTP 400 Bad Request y HTTP 404 Not Found; verificado en Re-Test en route.test.ts (14/14 pass)	APROBADO	24/11/2026 15:26	25/11/2026 23:41	fix(eventos-atp): robustecer detalle de operativo de recuperacion ante valores nulos y migraciones pendientes
CP-H74-API-03	Rechazo 401 Unauthorized en PATCH /api/eventos-atp/recuperacion/{id} ante ausencia de token JWT Bearer	Seguridad / Auth	Route Handler	Crítica	Servidor API activo y petición sin cabecera Authorization	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 sin headers de autenticación	HTTP 401 Unauthorized con mensaje indicando requerimiento de Authorization: Bearer <token>	Retorna HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>."	APROBADO	24/11/2026 15:24	25/11/2026 23:42	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-04	Bloqueo 403 Forbidden en PATCH /api/eventos-atp/recuperacion/{id} para perfil sin permiso (CALL_CENTER)	Seguridad / RBAC	Route / Auth Service	Crítica	Usuario autenticado con rol CALL_CENTER (callcenter@valdivia.cl)	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_CC>	HTTP 403 Forbidden denegando la edición de planificación	Retorna HTTP 403 Forbidden: "Acceso denegado. Se requiere permiso 'recuperacion:crear', 'recuperacion:editar' o rol Encargado."	APROBADO	24/11/2026 15:24	25/11/2026 23:43	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
CP-H74-API-05	Validación 400 Bad Request ante parámetro id no UUID, payload vacío {} o JSON malformado en PATCH	Validación / Zod	Route / Schema	Alta	Usuario ENCARGADO autenticado con JWT Bearer	PATCH .../no-es-uuid y PATCH .../74100000-...-0001 con body {}	HTTP 400 Bad Request con arreglo errors detallando validación de UUID y regla .refine() de al menos un campo	Retorna HTTP 400 Bad Request con detalle de campo y mensaje; revalidado en route.test.ts y recuperacion.service.test.ts	APROBADO	24/11/2026 15:24	25/11/2026 23:41	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-06	Validación 400 Bad Request para fechaEstimadaFin sin zona horaria ISO-8601 y para fecha anterior a creado_en	Validación / Negocio	Schema / Service	Alta	Operativo REC-2026-7401 activo	{"fechaEstimadaFin":"2026-11-28T18:00:00"} y {"fechaEstimadaFin":"2020-01-01T00:00:00.000Z"}	HTTP 400 Bad Request por formato ISO-8601 sin offset y FechaEstimadaInvalidaError por fecha anterior a creado_en	Validado con rechazo HTTP 400 Bad Request y cobertura en recuperacion.service.test.ts (33/33 pass)	APROBADO	24/11/2026 15:24	25/11/2026 23:41	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-07	Edición exitosa de descripción, fecha estimada de término y dotación diferencial de recursos en operativo EN_EJECUCION (CA-2)	Funcional / Transacción	Route / Service / DB	Crítica	REC-2026-7401 con 80 planchas (inv:500) y 20 frazadas (inv:400), más cajas alimentos (inv:300)	PATCH con nueva descripcion, fechaEstimadaFin y recursos: [{planchas:60}, {cajas:15}]	HTTP 200 OK; inventario actualizado atómicamente: planchas 520, frazadas 420 (devueltas) y cajas 285 (descontadas)	HTTP 200 OK y tabla recurso en PostgreSQL reflejando 520, 420 y 285 con mision_id preservado en recuperacion_recurso	APROBADO	24/11/2026 15:26	25/11/2026 23:43	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-08	Registro inmutable de auditoría (actualizado_en, actualizado_por_id) y sincronización de mision.descripcion (CA-4)	Auditoría / DB	Repository / DB	Crítica	Ejecución exitosa de CP-H74-API-07 por Encargado (00000000-0000-4000-8000-000000000003)	Consulta SQL sobre tablas recuperacion y mision tras PATCH	actualizado_por_id = 00000000-...-0003, actualizado_en > creado_en y mision.descripcion sincronizada	Columnas actualizado_por_id, actualizado_en, fecha_estimada_fin y mision.descripcion verificadas en PostgreSQL	APROBADO	24/11/2026 15:26	25/11/2026 23:42	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-09	Limpieza explícita fechaEstimadaFin: null e idempotencia al enviar la misma patrullaId asignada	Caso de Borde	Service / Repo	Media	Operativo activo con fechaEstimadaFin definida y patrulla asignada 74500000-...-0002	PATCH con {"fechaEstimadaFin":null} y PATCH con la misma patrullaId actual	HTTP 200 OK anulando fechaEstimadaFin a null y omitiendo error 409 ante reenvío idempotente de misma patrulla	Comportamiento verificado sin duplicación de hitos en recuperacion.service.test.ts (33/33 tests pass)	APROBADO	24/11/2026 15:26	25/11/2026 23:41	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-10	Bloqueo de edición cuando el operativo se encuentra en estado COMPLETADA (409 Conflict — CA-3)	Regla de Negocio	Service / Route	Crítica	Operativo REC-2026-7403 (74100000-...-0003) en estado COMPLETADA	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000003 con {"descripcion":"Intento completada"}	HTTP 409 Conflict bloqueando cualquier modificación sobre operativo completado	Retorna HTTP 409 Conflict: "No es posible editar un operativo de recuperación en estado COMPLETADA."	APROBADO	24/11/2026 15:24	25/11/2026 23:43	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-11	Bloqueo de edición cuando el operativo se encuentra en estado CANCELADA (409 Conflict — CA-3)	Regla de Negocio	Service / Route	Crítica	Operativo REC-2026-7404 (74100000-...-0004) en estado CANCELADA	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000004 con {"descripcion":"Intento cancelada"}	HTTP 409 Conflict bloqueando cualquier modificación sobre operativo cancelado	Retorna HTTP 409 Conflict: "No es posible editar un operativo de recuperación en estado CANCELADA."	APROBADO	24/11/2026 15:24	25/11/2026 23:43	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-12	Reasignación exitosa de patrullaId a patrulla DISPONIBLE con registro de hito REASIGNACION_PATRULLA en mision_hito e historial	Funcional / ICS	Service / Repo / DB	Alta	REC-2026-7401 con PV-H74-01 y patrulla PV-H74-02 en estado DISPONIBLE	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 con {"patrullaId":"74500000-0000-4000-8000-000000000002"}	HTTP 200 OK, PV-H74-02 pasa a EN_RECUPERACION, misión reinicia a DESPACHADA y se inserta hito REASIGNACION_PATRULLA en mision_hito	HTTP 200 OK, PV-H74-02 en EN_RECUPERACION, MIS-2026-7401 en DESPACHADA, notificación y hito registrados en PostgreSQL	APROBADO	24/11/2026 15:26	25/11/2026 23:42	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-13	Protección de patrulla anterior con otras misiones activas (contarOtrasMisionesActivasPatrulla > 0)	Regla de Negocio / ICS	Repository	Alta	PV-H74-01 asignada simultáneamente a MIS-2026-7401 (EN_CURSO) y MIS-2026-7402 (DESPACHADA)	Reasignación de REC-2026-7401 desde PV-H74-01 hacia PV-H74-02	PV-H74-01 conserva estado EN_RECUPERACION mientras mantenga MIS-2026-7402 activa	Consulta SQL confirma PV-H74-01 permaneció en EN_RECUPERACION al tener 1 misión activa remanente	APROBADO	24/11/2026 15:26	25/11/2026 23:42	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-14	Rechazo 409 Conflict por stock insuficiente al incrementar o añadir insumo en PATCH	Regla de Negocio	Service / Route	Crítica	REC-2026-7401 con 80 planchas asignadas y 500 disponibles en bodega	PATCH solicitando {"recursos":[{"recursoId":"74000000-...-0001","cantidad":9999}]}	HTTP 409 Conflict detallando incremento solicitado (9919) y disponible (500)	Retorna HTTP 409 Conflict por stock insuficiente; cubierto también en pruebas unitarias/ruta Vitest	APROBADO	24/11/2026 15:24	25/11/2026 23:41	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-15	Rechazo 409 Conflict al reasignar patrullaId cuya unidad ya se encuentra en estado EN_RECUPERACION	Regla de Negocio / ICS	Service / Route	Alta	Patrulla PV-H74-02 ocupada en estado EN_RECUPERACION	PATCH .../74100000-...-0002 con {"patrullaId":"74500000-0000-4000-8000-000000000002"}	HTTP 409 Conflict indicando que la patrulla no está disponible	Retorna HTTP 409 Conflict: "La patrulla \"Patrulla Verificadora Norte H74\" no está disponible para asignación (estado actual: EN_RECUPERACION)."	APROBADO	24/11/2026 15:26	25/11/2026 23:42	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-16	Rechazo 404 Not Found cuando el operativo, el recurso o la patrulla no existen en PostgreSQL	Robustez / DAL	Service / Repo	Alta	UUIDs inexistentes (74999999-0000-4000-8000-000000000999)	Peticiones PATCH con ID inexistente de operativo, recurso y patrulla	HTTP 404 Not Found específico por entidad inexistente	Retorna HTTP 404 Not Found: "El operativo de recuperación indicado no fue encontrado."	APROBADO	24/11/2026 15:24	25/11/2026 23:42	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-17	Ejecución idempotente de migraciones 043 y 045 (sobre secuencia unificada con develop) y siembra del fixture seed:h74 en PostgreSQL 16	Base de Datos	Migración / Seed	Alta	Contenedor PostgreSQL 16 + PostGIS operativo en puerto 5001	npm run db:migrate && npm run seed:h74	Columnas fecha_estimada_fin, actualizado_por_id, FK recuperacion_evento_atp_id_fkey, mision_id en recuperacion_recurso, 44 migraciones limpias y 4 operativos	Migraciones 043 y 045 aplicadas sobre develop (44 registros en kysely_migration) y fixture seed:h74 sembrado con exit code 0	APROBADO	24/11/2026 15:23	25/11/2026 23:40	merge: sincronizar origin/develop y corregir BUG-H74-API-01 a 06 (HU-74)
CP-H74-API-18	Verificación integral de npm run lint, tsc --noEmit, npm run build y suite Vitest (1040/1040)	Calidad / Regresión	Unit / Build / Lint	Alta	Rama feature/H74-editar-operativo-recuperacion sincronizada con develop	npm run lint && npx tsc --noEmit && npm run build && npm test	Cero errores de lint/build/tipos y 100% de pruebas unitarias aprobadas	lint 0 errores, tsc --noEmit exit 0, next build 28/28 rutas, npm test 94/94 archivos (1040/1040 tests pass)	APROBADO	24/11/2026 15:23	25/11/2026 23:41	fix(test): restaurar imports de H74 y tipado en recuperacion.service.test.ts para next build
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Preparación de Base de Datos, Migraciones y Fixture HU-74

**Comandos ejecutados (`25/11/2026 23:40`):**
```bash
npm run db:migrate && npm run seed:h74
```

**Salida real obtenida (`exit code 0`):**
```text
Ejecutando migraciones Kysely de base de datos...
[OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"
[OK] Migración Kysely ejecutada con éxito: "045_recuperacion_edicion_auditoria"
Todas las migraciones se completaron correctamente.
Limpiando fixture H74 (operativos de recuperación)...
Limpieza de fixture H74 completada.
Sembrando fixture H74 en la base de datos...
Fixture H74 sembrado exitosamente (4 operativos: EN_EJECUCION, PLANIFICADA, COMPLETADA, CANCELADA y permiso RBAC asegurado).
```

**Verificación física en PostgreSQL (`kysely_migration` = `44` registros, FK `recuperacion_evento_atp_id_fkey` hacia `evento_atp` y columna `mision_id` en `recuperacion_recurso`):**
```text
"recuperacion_actualizado_por_id_fkey" FOREIGN KEY (actualizado_por_id) REFERENCES usuario(id) ON DELETE SET NULL
"recuperacion_evento_atp_id_fkey" FOREIGN KEY (evento_atp_id) REFERENCES evento_atp(id) ON DELETE SET NULL
"recuperacion_recurso_mision_id_fkey" FOREIGN KEY (mision_id) REFERENCES mision(id) ON DELETE SET NULL
```

---

### 5.2 Ejecución de Análisis Estático, Compilación y Pruebas Automatizadas (Vitest)

**Comandos de análisis estático y compilación (`25/11/2026 23:40–23:41`):**
```bash
npm run lint && npx tsc --noEmit && npm run build
```

**Resultados observados:**
* `npm run lint`: finalizado con `exit code 0` (0 errores).
* `npx tsc --noEmit`: finalizado con `exit code 0` (0 errores de tipado).
* `npm run build`: `Compiled successfully in 2.4s`, `Finished TypeScript in 16.4s`, `Generating static pages using 15 workers (28/28)` (incluye `/api/eventos-atp`, `/api/eventos-atp/recuperacion`, `/api/eventos-atp/recuperacion/[id]`, `/api/eventos-atp/recuperacion/[id]/asignar`).

**Suite completa y suites dirigidas (`25/11/2026 23:41`):**
```bash
npm test
# Test Files  94 passed (94)
#      Tests  1040 passed (1040)

npm test -- src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts src/modules/eventos-atp/__tests__/recuperacion.service.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida real de suites dirigidas (`exit code 0`):**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/eventos-atp/__tests__/recuperacion.service.test.ts (33 tests) 55ms
 ✓ src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts (14 tests) 34ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 216ms

 Test Files  3 passed (3)
      Tests  48 passed (48)
```

**Filtro por patrón de historia (`-t`):**
```bash
npm test -- -t "HU-74|H73|HU-29"
# Test Files  3 passed | 91 skipped (94)
#      Tests  49 passed | 991 skipped (1040)
```

---

### 5.3 Pruebas de Integración Replicables vía HTTP (`cURL`) y Verificación de Fixes

> **Precondición:** Iniciar el servidor de API (`npm run start`) en `http://localhost:3001` con PostgreSQL (`5001`) y Redis (`6001`) activos y ejecutar `npm run seed:h74`.

#### 1. Autenticación de Perfiles de Prueba (`Encargado` y `Call Center`)
```bash
LOGIN_ENC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}')
TOKEN_ENC=$(node -e "console.log(JSON.parse(process.argv[1]).data.token)" "$LOGIN_ENC")

LOGIN_CC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}')
TOKEN_CC=$(node -e "console.log(JSON.parse(process.argv[1]).data.token)" "$LOGIN_CC")
```

#### 2. Seguridad JWT / RBAC (`BUG-H74-API-03`, `CP-H74-API-01`, `CP-H74-API-03`, `CP-H74-API-04`)
```bash
# Bloqueo de x-user-id sin JWT en GET -> 401 Unauthorized
curl -s -i -X GET "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000003"

# Usuario Call Center sin permiso en PATCH -> 403 Forbidden
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_CC" \
  -d '{"descripcion":"Intento call center"}'

# Consulta de detalle con JWT Bearer -> 200 OK
curl -s -i -X GET "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Authorization: Bearer $TOKEN_ENC"
```
**Respuestas HTTP reales (`25/11/2026 23:43`):**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 403 Forbidden
{"message":"Acceso denegado. Se requiere permiso 'recuperacion:crear', 'recuperacion:editar' o rol Encargado."}

HTTP/1.1 200 OK
{"message":"Detalle de operativo de recuperación obtenido exitosamente.","data":{"id":"74100000-0000-4000-8000-000000000001","codigo":"REC-2026-7401",...,"cantidadInsumosAsignados":100,"totalTiposInsumos":2,...}}
```

#### 3. Edición Nominal, Auditoría, `mision_id` y Bloqueo en Culminados (`CP-H74-API-07`, `CP-H74-API-08`, `CP-H74-API-10`, `CP-H74-API-11`)
```bash
# Edición nominal Encargado -> 200 OK
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"descripcion":"Ampliación de techumbre en sector Niebla Alto (Re-Test QA)","fechaEstimadaFin":"2026-11-30T18:00:00.000Z","recursos":[{"recursoId":"74000000-0000-4000-8000-000000000001","cantidad":60},{"recursoId":"74000000-0000-4000-8000-000000000002","cantidad":15}]}'

# Bloqueos COMPLETADA y CANCELADA -> 409 Conflict
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000003" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"descripcion":"Intento completada"}'
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000004" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"descripcion":"Intento cancelada"}'
```
**Respuestas HTTP reales y estado en PostgreSQL (`25/11/2026 23:42–23:43`):**
```text
HTTP/1.1 200 OK
{"message":"Planificación del operativo de recuperación actualizada exitosamente.","data":{"id":"74100000-0000-4000-8000-000000000001","codigo":"REC-2026-7401",...,"actualizadoPorId":"00000000-0000-4000-8000-000000000003",...}}

Recursos tras PATCH:
[{"id":"74000000-...-0001","cantidad_inventario":520,"cantidad_en_uso":0,"estado":"DISPONIBLE"},
 {"id":"74000000-...-0002","cantidad_inventario":285,"cantidad_en_uso":0,"estado":"DISPONIBLE"},
 {"id":"74000000-...-0003","cantidad_inventario":420,"cantidad_en_uso":0,"estado":"DISPONIBLE"}]

recuperacion_recurso (mision_id preservado - HU-32):
[{"recurso_id":"74000000-...-0001","cantidad_asignada":60,"mision_id":"74200000-0000-4000-8000-000000000001"},
 {"recurso_id":"74000000-...-0002","cantidad_asignada":15,"mision_id":"74200000-0000-4000-8000-000000000001"}]

COMPLETADA -> HTTP/1.1 409 Conflict: {"message":"No es posible editar un operativo de recuperación en estado COMPLETADA."}
CANCELADA  -> HTTP/1.1 409 Conflict: {"message":"No es posible editar un operativo de recuperación en estado CANCELADA."}
```

#### 4. Evidencia de Verificación en Re-Test de `BUG-H74-API-01` a `BUG-H74-API-06` (`25/11/2026 23:42`)
```text
=== BUG-H74-API-01 (Concurrencia Stock, Doble Patrulla y Eliminado Lógico) ===
Concurrent stock PATCH statuses (6 PATCH 100..150): [ 200, 200, 200, 200, 200, 200 ]
Despues -> inventario: { cantidad_inventario: 450 } asignadas: [ { cantidad_asignada: 130 } ]
SUMA (inv + asig) esperada 580, real: 580

Concurrent Patrol P1: 409 P2: 200
P1 body: {"message":"La patrulla \"Patrulla Verificadora Norte H74\" no está disponible para asignación (estado actual: EN_RECUPERACION)."}
Misiones en BD tras concurrencia:
[{"id":"74200000-...-0001","codigo":"MIS-2026-7401","patrulla_id":"74500000-0000-4000-8000-000000000001"},
 {"id":"74200000-...-0002","codigo":"MIS-2026-7402","patrulla_id":"74500000-0000-4000-8000-000000000002"}]

GET deleted status:   404 {"message":"Operativo de recuperación con ID '74100000-0000-4000-8000-000000000002' no encontrado."}
PATCH deleted status: 404 {"message":"El operativo de recuperación indicado no fue encontrado."}

=== BUG-H74-API-02 (Misión Faltante, Reinicio DESPACHADA, Notificación y Liberación) ===
PATCH sin misión previa -> 200 OK (mision creada: "MIS-2026-9102", estado: "DESPACHADA", patrulla: "PV-H74-02" EN_RECUPERACION)
Mision MIS-2026-7401 antes reasignar: estado="EN_CURSO", fecha_inicio="2026-11-26T00:42:22.189Z"
Mision MIS-2026-7401 despues reasignar: estado="DESPACHADA", fecha_inicio=null, patrulla_id="74500000-...-0002"
notificaciones_mision: [{"mision_id":"74200000-...-0001","patrulla_id":"74500000-...-0002","estado":"PENDIENTE_ENVIO"}]
Liberacion PV-H74-02 sin otras misiones -> 200 -> 200, DB: { codigo: 'PV-H74-02', estado: 'DISPONIBLE' }

=== BUG-H74-API-03 (Seguridad JWT, CA-5 recuperacion:crear y OpenAPI) ===
GET listado / GET {id} / PATCH {id} con solo x-user-id -> 401 Unauthorized
PATCH con rol exclusivo permiso recuperacion:crear (CA-5) -> 200 OK
OpenAPI v0.12.0 GET/PATCH {id}: security=[{"BearerAuth":[]}], params=["path:id"], POST /{id}/asignar present=true

=== BUG-H74-API-04 (Activos Individuales es_individual=true y EN_MANTENCION) ===
PATCH recurso EN_MANTENCION -> 409 {"message":"El recurso \"Motobomba QA Mantencion\" no está disponible para asignación (estado actual: EN_MANTENCION)."}
Assign individual DISPONIBLE -> 200, DB: { estado: 'ASIGNADO', cantidad_inventario: 1, cantidad_en_uso: 1 }
Return individual DISPONIBLE -> 200, DB: { estado: 'DISPONIBLE', cantidad_inventario: 1, cantidad_en_uso: 0 }

=== BUG-H74-API-06 (Regresión HU-32 POST .../asignar) ===
HU-32 POST /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002/asignar -> 200 OK
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA) y Dictamen Final

| Criterio de Aceptación (HU-74) | Casos de Prueba Asociados | Estado en Backend | Observaciones Técnicas Verificadas en Re-Test |
|---|---|:---:|---|
| **CA-1:** En el detalle del operativo de recuperación, el sistema debe proveer la acción 'Editar Planificación'. | `CP-H74-API-01`, `CP-H74-API-02`, `BUG-H74-API-03`, `BUG-H74-API-06` | 🟢 **CUMPLIDO** | `GET /api/eventos-atp/recuperacion/[id]` expone el detalle consolidado con `fechaEstimadaFin`, `actualizadoPorId`, recursos, patrulla, misión e historial bajo autenticación JWT estricta y contrato alineado con `develop`. |
| **CA-2:** El formulario modal debe permitir modificar: descripción de tareas, fecha estimada de término y reasignación de insumos/recursos. | `CP-H74-API-05` a `CP-H74-API-09`, `CP-H74-API-12` a `CP-H74-API-16`, `BUG-H74-API-01`, `BUG-H74-API-02`, `BUG-H74-API-04`, `BUG-H74-API-05` | 🟢 **CUMPLIDO** | `PATCH /api/eventos-atp/recuperacion/[id]` actualiza descripción, `fechaEstimadaFin`, dotación diferencial (consumibles e individuales `es_individual`), patrulla verificadora con creación/reinicio de misión `DESPACHADA`, notificación, bloqueos `FOR UPDATE` y difusión Socket.io/Redis. |
| **CA-3:** No se debe permitir editar un operativo que se encuentre en estado `COMPLETADA` o `CANCELADA`. | `CP-H74-API-10`, `CP-H74-API-11`, `BUG-H74-API-01` | 🟢 **CUMPLIDO** | Rechaza `409 Conflict` para `COMPLETADA` y `CANCELADA` tanto en servicio bajo `.forUpdate()` como en precondición SQL `.where("estado", "not in", ["COMPLETADA", "CANCELADA"])`, además de excluir `eliminado_en IS NOT NULL` (`404`). |
| **CA-4:** Cada edición debe registrar auditoría (`actualizado_en = CURRENT_TIMESTAMP`, `actualizado_por_id`). | `CP-H74-API-08`, `CP-H74-API-17` | 🟢 **CUMPLIDO** | La migración `045_recuperacion_edicion_auditoria.ts` crea `actualizado_por_id` (FK a `usuario(id)`) y `actualizarRecuperacion` persiste ambos atributos en cada edición exitosa verificada en PostgreSQL. |
| **CA-5:** El endpoint `PATCH /api/eventos-atp/recuperacion/{id}` debe requerir permiso `recuperacion:crear` o rol Encargado. | `CP-H74-API-03`, `CP-H74-API-04`, `BUG-H74-API-03` | 🟢 **CUMPLIDO** | El Route Handler valida acceso mediante `validarAccesoRoles(usuarioId, [PERMISO_CREAR_RECUPERACION, PERMISO_EDITAR_RECUPERACION], ...)` aceptando `recuperacion:crear`, `recuperacion:editar`, rol `Encargado` y `Administrador`, rechazando perfiles no autorizados (`403`) y peticiones sin JWT (`401`). |

**Dictamen QA:** 🟢 **APROBADO Y CERTIFICADO EN RE-TEST (`25/11/2026 23:43`)** — Todos los defectos reportados (`BUG-H74-API-01` a `BUG-H74-API-06`) fueron subsanados y verificados en ejecución real sin regresiones; el módulo cumple al **100%** con los Criterios de Aceptación y la calidad técnica requerida para su integración en `develop`.
