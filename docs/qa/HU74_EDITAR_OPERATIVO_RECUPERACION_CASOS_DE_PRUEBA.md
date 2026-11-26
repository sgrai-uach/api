# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-74 — Editar Planificación de Operativos de Recuperación (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Operativos de Recuperación (`sgrai-api` — `GET /api/eventos-atp/recuperacion/[id]` y `PATCH /api/eventos-atp/recuperacion/[id]`).  
> **Historia de Usuario:** HU-74 — *"Como Encargado Quiero modificar la descripción, fecha estimada y dotación de insumos o personal asignado a un operativo de recuperación en curso. Para adaptar el operativo ante variaciones en las necesidades de los sectores afectados o cambios en la disponibilidad logística."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript 5 + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis 7 + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H74-editar-operativo-recuperacion`  
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
>  
> **Fecha de Auditoría QA:** 24/11/2026 15:27.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested`) — 6 DEFECTOS REALES ABIERTOS PENDIENTES DE CORRECCIÓN**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense de código fuente, verificación de concurrencia y transacciones ACID sobre PostgreSQL 16 + PostGIS, evaluación del cumplimiento de Criterios de Aceptación (CA-1 a CA-5), revisión de seguridad RBAC/JWT, validación del contrato OpenAPI 3.0, análisis de difusión en tiempo real vía Socket.io/Redis Pub/Sub, comprobación de alineación con la rama principal `develop` y pruebas funcionales reales vía HTTP (`cURL` / peticiones concurrentes) y Vitest sobre `feature/H74-editar-operativo-recuperacion`, se identificaron **6 defectos reales** (**3 de severidad CRÍTICA**, **2 de severidad ALTA** y **1 de severidad MEDIA**) que impiden aprobar el Pull Request en su estado actual.

| Métrica de Calidad | Resultado de Auditoría | Observaciones |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **24** | 6 Defectos Abiertos (`BUG-H74-API-01` a `06`) + 18 Casos Funcionales, RBAC, Validación, BD y Regresión (`CP-H74-API-01` a `18`) |
| **Casos Aprobados (Passed)** | **18** | Flujos nominales de `GET`/`PATCH`, bloqueo en `COMPLETADA`/`CANCELADA`, auditoría `actualizado_por_id`, validaciones Zod/temporales y suite Vitest |
| **Defectos Abiertos (Failed)** | **6** | 3 Críticos (concurrencia/TOCTOU, patrulla huérfana sin misión y desfase de 75 commits con `develop`), 2 Altos (CA-5/RBAC/OpenAPI y activos individuales/`EN_MANTENCION`), 1 Medio (Socket.io/Redis) |
| **Casos Bloqueados (Blocked)** | **0** | Entorno operativo con PostgreSQL 16 + PostGIS (`puerto 5001`), Redis 7 (`puerto 6001`) y `sgrai-api` (`puerto 3001`) |
| **Tasa de Aprobación Actual (% Pass)** | **75.0%** | Se requiere subsanar los 6 defectos y obtener 100% de éxito en ciclo Re-Test antes de integrar a `develop` |
| **Análisis Estático ESLint (`npm run lint`)** | 🟢 **0 errores** | Ejecución limpia sin advertencias ni errores |
| **Compilación y Tipado (`npm run build` / `npx tsc --noEmit`)** | 🟢 **Exit code 0** | 27/27 rutas generadas tras depurar caché `.next/dev` |
| **Suite Automatizada Vitest (`npm test`)** | 🟢 **881/881 tests pass** | 73/73 archivos aprobados; 126/126 en `eventos-atp` + `openapi.json` (47/47 específicos en `recuperacion/[id]`, `recuperacion.service` y `openapi.json`) |
| **Sincronización con Rama `develop`** | 🔴 **Desfasada (75 commits detrás)** | Regresión sobre `HU-32` (`POST .../asignar`, migración `041`), `HU-61` (`072_evento_atp_base`) y `051_permiso_misiones_terreno_verificar` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H74-API-01`: Condición de Carrera (TOCTOU) en Recálculo de Stock y Reasignación de Patrulla sin `FOR UPDATE`, Precondición en `UPDATE` ni Filtro de Borrado Lógico (`eliminado_en IS NULL`)
* **Severidad:** **CRÍTICA** (Integridad Transaccional ACID, Consistencia de Inventario y Control de Concurrencia).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 68-76, 210-222, 258-264, 293-320)
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 395-405, 427-588)
* **Descripción Técnica:**
  1. `buscarRecuperacionPorId` (`recuperacion.repository.ts:258-264`) realiza un `SELECT *` simple sin bloqueo pesimista `.forUpdate()` y **sin filtrar `.where("eliminado_en", "is", null)`**. Aunque la migración `043_recuperacion_listado_rbac_e_indices.ts` incorporó `eliminado_en` y tanto `listarRecuperacionesPaginadoRepo` (`línea 428`) como `obtenerRecuperacionDetallePorIdRepo` (`línea 614`) excluyen registros eliminados lógicamente, `PATCH` permite modificar operativos ya dados de baja.
  2. En `editarEventoRecuperacionService` (`recuperacion.service.ts:427`), `listarRecursosAsignadosRecuperacion` consulta `recuperacion_recurso` **antes** de adquirir bloqueos de fila en `obtenerRecursosParaBloqueo` (`línea 456`). Bajo el nivel de aislamiento `READ COMMITTED`, múltiples solicitudes `PATCH` concurrentes leen la misma instantánea obsoleta de `recuperacion_recurso`, quedan serializadas en `recurso FOR UPDATE` y ejecutan ajustes diferenciales (`descontarStockRecurso` / `devolverStockRecurso`) sobre deltas erróneos, destruyendo o duplicando inventario físico en bodega.
  3. Adicionalmente, `actualizarRecuperacion` (`líneas 314-319`) no incluye precondición `.where("estado", "not in", ["COMPLETADA", "CANCELADA"])` ni `.where("eliminado_en", "is", null)`, exponiendo la mutación ante cierres concurrentes.
  4. En la reasignación de patrulla, `buscarPatrullaPorId` (`líneas 68-76`) no utiliza `.forUpdate()` y `actualizarEstadoPatrulla` (`líneas 210-222`) no exige `.where("estado", "=", "DISPONIBLE")` con `.returning()`, permitiendo asignar simultáneamente una misma patrulla verificadora a múltiples operativos de recuperación.
* **Pasos para Reproducir:**
  1. **Corrupción de stock:** Con `REC-2026-7401` teniendo `80` unidades de `Planchas de Zinc` (`74000000-...-0001`, inventario libre `500`, total `580`), ejecutar 6 peticiones `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` concurrentes (`Promise.all`) cambiando la cantidad a `100, 110, 120, 130, 140, 150`.
  2. **Doble asignación de patrulla:** Enviar 2 peticiones `PATCH` concurrentes asignando la patrulla `PV-H74-02` (`DISPONIBLE`) a `REC-2026-7401` y `REC-2026-7402`.
  3. **Edición de registro eliminado:** Marcar `eliminado_en = NOW()` en `REC-2026-7402` y consultar `GET` seguido de `PATCH`.
* **Comportamiento Actual:**
  1. Las 6 peticiones concurrentes responden `200 OK`; `recuperacion_recurso` queda en `150`, pero `recurso.cantidad_inventario` desciende a `330` (`330 + 150 = 480`, pérdida neta de **100 unidades** frente a las `580` iniciales).
  2. Ambas peticiones concurrentes de patrulla responden `200 OK`, dejando `MIS-2026-7401` y `MIS-2026-7402` asignadas simultáneamente a `74500000-0000-4000-8000-000000000002`.
  3. `GET` retorna `404 Not Found` sobre el operativo eliminado, mientras `PATCH` retorna `200 OK` y lo modifica.
* **Comportamiento Esperado:** `buscarRecuperacionPorId` debe filtrar `eliminado_en IS NULL` y adquirir `.forUpdate()` al iniciar la edición; `buscarPatrullaPorId` debe soportar `.forUpdate()` y `actualizarEstadoPatrulla` debe condicionar `.where("estado", "=", "DISPONIBLE")` retornando la fila para rechazar con `409 Conflict` las colisiones concurrentes.

---

### `BUG-H74-API-02`: Bloqueo Huérfano de Patrulla sin Misión Previa, Respuesta con UUID Ficticio `00000000-...`, Omisión de Reinicio de Misión `EN_CURSO` y Liberación Ciega del Líder
* **Severidad:** **CRÍTICA** (Integridad Operativa ICS y Consistencia de Misiones y Personal).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 238-318, 521-588)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 224-248, 282-291, 366-379)
* **Descripción Técnica:**
  1. El dominio y las pruebas de `H73` contemplan operativos en estado `PLANIFICADA` sin misión ni patrulla previa (`mision === null`). Sin embargo, cuando `editarEventoRecuperacionService` recibe `patrullaId` sobre un operativo sin fila en `mision` (`misionActual === undefined`), el bloque `if (misionActual)` (`línea 559`) se omite por completo sin crear la misión ni vincular la patrulla al operativo, pero las líneas `578-586` ejecutan igualmente `actualizarEstadoPatrulla(trx, nuevaPatrulla.id, "EN_RECUPERACION")` y `actualizarEstadoPersonalLider(..., "en_mision", false)`. A continuación, `construirRespuestaRecuperacion` (`líneas 283-300`) rellena los campos obligatorios con UUIDs ficticios `"00000000-0000-0000-0000-000000000000"` (`"Sin patrulla asignada"`), dejando a la patrulla bloqueada permanentemente sin misión asociada.
  2. Cuando `misionActual` sí existe, `buscarMisionPorRecuperacionId` (`recuperacion.repository.ts:282-291`) no excluye misiones `CANCELADA` ni `RECHAZADA` ni ordena por `creado_en DESC`. Además, `reasignarPatrullaMision` (`líneas 366-379`) reemplaza `patrulla_id` sin restablecer `estado = 'DESPACHADA'` / `fecha_inicio = null` cuando la misión estaba `EN_CURSO` (impidiendo que la nueva patrulla acepte formalmente la misión en `sgrai-pwa`) y omite insertar la notificación en `notificaciones_mision` (HU-35).
  3. Al liberar la patrulla anterior, `actualizarEstadoPersonalLider` (`líneas 224-248`) establece `usuario.estado_operativo = 'disponible'` sin validar `activo = true` ni verificar que el funcionario no pertenezca a otra patrulla o cuadrilla activa, y no actualiza el estado operativo de los demás integrantes en `patrulla_personal`.
* **Pasos para Reproducir:**
  1. Disponer de un operativo en estado `PLANIFICADA` sin fila en `mision` (ej. `REC-2026-7402` sin misión o escenario equivalente a `REC-2026-0013`).
  2. Enviar `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}`.
  3. Inspeccionar la respuesta JSON y consultar `patrulla_verificadora` y `mision` en PostgreSQL.
* **Comportamiento Actual:** La API retorna `200 OK` con `mision.id = "00000000-0000-0000-0000-000000000000"` y `patrulla = {"id":"00000000-0000-0000-0000-000000000000","nombre":"Sin patrulla asignada","estado":"DISPONIBLE"}`, mientras en PostgreSQL `PV-H74-02` cambia a `estado = 'EN_RECUPERACION'` con `0` misiones asociadas.
* **Comportamiento Esperado:** Si el operativo no posee misión previa, la asignación de `patrullaId` debe crear la misión `RECUPERACION` (`DESPACHADA`) con su código correlativo e hito inicial (o rechazarse explícitamente si la regla de negocio exige despacho previo vía HU-32), sin dejar patrullas bloqueadas ni emitir UUIDs ficticios; al reasignar una misión activa a otra patrulla debe restablecerse su flujo de despacho/notificación (`DESPACHADA` + `notificaciones_mision`) y liberar íntegramente al personal solo si no integra otras unidades activas.

---

### `BUG-H74-API-03`: Incumplimiento de CA-5 al Rechazar Permiso `recuperacion:crear`, Bypass de Autenticación JWT vía `x-user-id` en `GET` y Desalineación OpenAPI
* **Severidad:** **ALTA** (Seguridad RBAC/JWT, Cumplimiento de Criterio de Aceptación CA-5 y Contrato OpenAPI).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/app/api/eventos-atp/recuperacion/[id]/route.ts` (Líneas 35-38, 109-110)
  * `src/app/api/eventos-atp/recuperacion/route.ts` (Líneas 30-33)
  * `src/lib/openapi/index.ts` (Líneas 1808, 1910, 1923-1934, 1977-1988)
* **Descripción Técnica:**
  1. **Incumplimiento de CA-5:** El Criterio de Aceptación 5 exige explícitamente: *"El endpoint `PATCH /api/eventos-atp/recuperacion/{id}` debe requerir permiso `recuperacion:crear` o rol Encargado."* Sin embargo, `PATCH` (`route.ts:110`) invoca `verificarPermiso(usuarioId, PERMISO_EDITAR_RECUPERACION)` (`"recuperacion:editar"`), y `verificarPermiso` (`src/modules/seguridad/auth.service.ts:38-56`) únicamente omite el chequeo para `"Administrador"` (no `"Encargado"`) y acepta un solo código de permiso. Todo rol con `recuperacion:crear` que no posea `recuperacion:editar` es rechazado con `403 Forbidden`.
  2. **Inconsistencia y bypass de autenticación:** En `GET /api/eventos-atp/recuperacion/[id]` (`route.ts:35-38`) y `GET /api/eventos-atp/recuperacion` (`recuperacion/route.ts:30-33`), el controlador admite la cabecera plana sin firma `x-user-id` (`(await extraerUsuarioId(req)) || req.headers.get("x-user-id")?.trim()`), permitiendo suplantar cualquier UUID de usuario sin token JWT Bearer. Por el contrario, `PATCH` (`route.ts:109`) exige exclusivamente `extraerUsuarioId(req)` y rechaza `x-user-id` con `401 Unauthorized`.
  3. **Desalineación OpenAPI:** En `src/lib/openapi/index.ts` (`líneas 1923-1933` y `1977-1987`), ni `GET` ni `PATCH` `/api/eventos-atp/recuperacion/{id}` declaran `security: [{ BearerAuth: [] }]`, documentan `x-user-id` como cabecera aceptada en `PATCH` (provocando `401` al seguir la spec), y `registry.register("ObtenerRecuperacionDetalleResponse", ...)` está duplicado en las líneas `1808` y `1910`.
* **Pasos para Reproducir:**
  1. Autenticar un usuario cuyo rol posea exclusivamente el permiso `recuperacion:crear` y enviar `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001`.
  2. Enviar `GET /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` sin cabecera `Authorization`, enviando únicamente `-H "x-user-id: 00000000-0000-4000-8000-000000000003"`.
  3. Enviar `PATCH` siguiendo la cabecera `x-user-id` expuesta en `GET /openapi.json`.
* **Comportamiento Actual:** (1) `PATCH` retorna `403 Forbidden` (`"No cuenta con el permiso requerido: recuperacion:editar"`); (2) `GET` retorna `200 OK` exponiendo todos los datos sin token JWT; (3) `PATCH` retorna `401 Unauthorized` contradiciendo la especificación OpenAPI.
* **Comportamiento Esperado:** `PATCH` debe validar mediante `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_CREAR_RECUPERACION, PERMISO_EDITAR_RECUPERACION])` (o validar explícitamente rol `Encargado` / `Administrador` y `recuperacion:crear` conforme a CA-5); `GET` y `PATCH` deben requerir autenticación JWT exclusiva vía `extraerUsuarioId(req)` eliminando el fallback inseguro `x-user-id`, y `openapi/index.ts` debe declarar `security: [{ BearerAuth: [] }]` sin registros duplicados.

---

### `BUG-H74-API-04`: Asignación Permitida de Recursos en Estado `EN_MANTENCION` y Corrupción de `cantidad_inventario` en Activos Individuales (`es_individual = true`)
* **Severidad:** **ALTA** (Regla Logística de Inventario y Disponibilidad de Activos).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 460-500)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 81-96, 160-208)
* **Descripción Técnica:**  
  Aunque `obtenerRecursosParaBloqueo` (`recuperacion.repository.ts:89-90`) selecciona las columnas `estado` y `es_individual`, `editarEventoRecuperacionService` (`líneas 460-500`) nunca valida el estado operativo del recurso ni diferencia activos individuales serializados (`es_individual = true`) de insumos consumibles a granel:
  1. Permite asignar un recurso en estado `EN_MANTENCION` o `NO_DISPONIBLE` siempre que `cantidad_inventario - cantidad_en_uso >= delta`.
  2. Al asignar o incrementar un recurso individual (`es_individual = true`), invoca `descontarStockRecurso` -> `ajustarStockRecurso` (`líneas 160-192`), restando directamente de `cantidad_inventario` (`1 -> 0`) y pasando el recurso a `NO_DISPONIBLE` con `cantidad_en_uso = 0` en lugar de mantener el inventario en `1`, incrementar `cantidad_en_uso` y establecer `estado = 'ASIGNADO'` (como exige el modelo híbrido de inventario de SGRAI).
* **Pasos para Reproducir:**
  1. Registrar un activo individual en estado `EN_MANTENCION` (`es_individual = true`, `cantidad_inventario = 1`, `cantidad_en_uso = 0`).
  2. Enviar `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002` asignando `{ "recursos": [{ "recursoId": "<ID_ACTIVO>", "cantidad": 1 }] }`.
* **Comportamiento Actual:** `PATCH` responde `200 OK` asignando un activo en mantención y altera la tabla `recurso` a `cantidad_inventario = 0`, `cantidad_en_uso = 0`, `estado = 'NO_DISPONIBLE'`.
* **Comportamiento Esperado:** Rechazar con `409 Conflict` cualquier incremento/asignación de un recurso en estado `EN_MANTENCION` o inactivo (`NO_DISPONIBLE` cuando no está disponible para despacho), validar `cantidad === 1` para activos `es_individual = true` y actualizar `cantidad_en_uso` / `estado = 'ASIGNADO'` sin destruir `cantidad_inventario`.

---

### `BUG-H74-API-05`: Difusión WebSocket Incompleta en `PATCH` (`emitirRecursoActualizado`, `notificarPatrullaActualizada`), Salas Omitidas en Redis Pub/Sub y Tipado Ausente en `ServerToClientEvents`
* **Severidad:** **MEDIA** (Sincronización en Tiempo Real Socket.io / Redis Pub/Sub y Seguridad de Tipos).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/lib/socket/types.ts` (Líneas 3-94)
  * `src/lib/socket/index.ts` (Líneas 386-444)
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 615-641)
* **Descripción Técnica:**
  1. La interfaz `ServerToClientEvents` (`src/lib/socket/types.ts:3-94`) no declara los eventos `"recuperacion:actualizada"` ni `"mision:reasignada"`, obligando al uso de `as any` en `src/lib/socket/index.ts`.
  2. En `emitirRecuperacionActualizada` (`src/lib/socket/index.ts:399-411`), la rama de publicación vía Redis Pub/Sub (utilizada cuando `ioInstance` es nulo en contextos de Route Handler aislados) publica únicamente en la sala `"sala:encargados"`, omitiendo las salas `"encargado"` y `"mapa"` que sí reciben el evento en modo memoria (`líneas 389-393`).
  3. En `editarEventoRecuperacionService` (`recuperacion.service.ts:615-641`), cuando se modifica el stock en `recurso` o el estado de patrullas (`DISPONIBLE` / `EN_RECUPERACION`), no se invoca `emitirRecursoActualizado` ni `notificarPatrullaActualizada` para la patrulla liberada y la nueva patrulla asignada.
* **Pasos para Reproducir:**
  1. Inspeccionar `ServerToClientEvents` en `src/lib/socket/types.ts` y la rama `redisPublisher` de `emitirRecuperacionActualizada` en `src/lib/socket/index.ts:399-411`.
  2. Ejecutar `PATCH /api/eventos-atp/recuperacion/{id}` reasignando `recursos` y `patrullaId` y verificar los emisores invocados en `recuperacion.service.ts:615-641`.
* **Comportamiento Actual:** No se emiten eventos de actualización de stock de recursos ni de estado de patrullas hacia los tableros en tiempo real, y en modo Redis Pub/Sub las salas `"encargado"` y `"mapa"` no reciben `"recuperacion:actualizada"`.
* **Comportamiento Esperado:** Declarar `"recuperacion:actualizada"` y `"mision:reasignada"` en `ServerToClientEvents`, unificar el listado de salas (`["sala:encargados", "encargado", "mapa"]`) en el publicador Redis de `emitirRecuperacionActualizada`, e invocar `emitirRecursoActualizado` y `notificarPatrullaActualizada` tras el commit cuando corresponda.

---

### `BUG-H74-API-06`: Desfase Crítico respecto a `develop` (75 Commits Detrás) con Regresión de `HU-32` (`POST .../asignar`), `HU-61` (`evento_atp`), Omisión de `pg_advisory_xact_lock` y Pérdida de `mision_id` en `recuperacion_recurso`
* **Severidad:** **CRÍTICA** (Integración Continua, Consistencia de Base de Datos y Regresión Funcional).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * Rama `feature/H74-editar-operativo-recuperacion` vs `develop`
  * `src/lib/db/migrations/035_permiso_misiones_terreno_verificar.ts` (vs `051_...` en `develop`) y `043_recuperacion_listado_rbac_e_indices.ts` (vs `072_evento_atp_base.ts` en `develop`)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 40-66, 337-345, 503-511)
  * `src/app/api/eventos-atp/recuperacion/[id]/route.ts` y módulos eliminados en el diff frente a `develop` (`asignar/route.ts`, `evento-atp.*`)
* **Descripción Técnica:**
  1. La rama `feature/H74-editar-operativo-recuperacion` se encuentra **75 commits por detrás de `develop`** (`git rev-list --left-right --count develop...HEAD` = `75 / 19`). No contiene las integraciones ya cerradas en `develop` de `HU-32` (`PR #46`), `HU-61` (`PR #43`), `HU-37` (`PR #47`) ni `HU-69` (`PR #59`).
  2. Como consecuencia de este desfase:
     * `generarSiguienteCodigoRecuperacion` y `generarSiguienteCodigoMision` (`recuperacion.repository.ts:40-66`) carecen del bloqueo consultivo `SELECT pg_advisory_xact_lock(...)` y usan `COUNT(*)` (ya corregido en `develop`), exponiendo colisiones `23505` bajo concurrencia.
     * `eliminarRecursosRecuperacion` + `insertarRecursosRecuperacion` (`líneas 503-511`) borran y reinsertan filas en `recuperacion_recurso` sin preservar la columna `mision_id` introducida en `develop` mediante `041_recuperacion_recurso_mision_id.ts`.
     * `GET /api/eventos-atp/recuperacion/[id]` y `GET /api/eventos-atp/recuperacion` en esta rama colisionan en contrato con los endpoints existentes en `develop` (HU-32), y el merge sin resolución hacia `develop` suprimiría `POST /api/eventos-atp/recuperacion/[id]/asignar` y las tablas/rutas de `evento_atp` (`072_evento_atp_base.ts`).
     * La migración `035_permiso_misiones_terreno_verificar.ts` permanece con correlativo antiguo frente a `051_permiso_misiones_terreno_verificar.ts` en `develop`, y `043_recuperacion_listado_rbac_e_indices.ts` declara `evento_atp_id UUID` sin restricción de clave foránea hacia `evento_atp`.
* **Pasos para Reproducir:**
  1. Ejecutar `git rev-list --left-right --count develop...HEAD` y `git diff --stat develop..HEAD`.
  2. Comparar `src/lib/db/migrations/` y `src/modules/eventos-atp/recuperacion.repository.ts` contra `develop`.
* **Comportamiento Actual:** Desfase de 75 commits con regresiones sobre `HU-32` (`041`), `HU-61` (`072`) y bloqueo `pg_advisory_xact_lock`, más incompatibilidad de contrato en `GET /api/eventos-atp/recuperacion/[id]`.
* **Comportamiento Esperado:** Sincronizar la rama integrando `develop` (`git merge develop`), resolver conflictos preservando `HU-32` (`POST .../asignar`, `mision_id` en `recuperacion_recurso`, `pg_advisory_xact_lock`), `HU-61` (`072_evento_atp_base.ts`), `HU-73` y `HU-74`, y alinear la secuencia oficial de migraciones sin duplicidades.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H74-API-01` | Control de concurrencia TOCTOU en recálculo de stock/patrulla (`FOR UPDATE`) y rechazo de edición en operativos eliminados lógicamente | Concurrencia / ACID | Repo / Service | Crítica | Operativo `REC-2026-7401` (`EN_EJECUCION`, 80 planchas, inventario 500), patrulla `PV-H74-02` `DISPONIBLE`, u operativo con `eliminado_en IS NOT NULL` | 6 peticiones `PATCH` concurrentes de stock (`100..150`), 2 `PATCH` concurrentes de `patrullaId`, y `PATCH` sobre registro con `eliminado_en IS NOT NULL` | Serialización transaccional con `.forUpdate()`, inventario conservado (`580`), rechazo `409` en doble asignación de patrulla y `404` sobre eliminado lógico | 6 `PATCH` retornan `200` perdiendo 100 unidades (`330+150=480`); 2 `PATCH` retornan `200` asignando misma patrulla a 2 misiones; `PATCH` edita registro eliminado (`200`) | **ABIERTO** | 24/11/2026 15:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H74-API-02` | Consistencia de misión y personal al reasignar `patrullaId` (operativo sin misión previa, misión `EN_CURSO` y liberación de líder/integrantes) | Regla de Negocio / ICS | Service / Repo | Crítica | Operativo `PLANIFICADA` sin fila en `mision`, o misión `EN_CURSO` reasignada a nueva patrulla `DISPONIBLE` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}` sin misión previa | Crear misión vinculada o rechazar explícitamente sin dejar patrulla huérfana ni UUIDs `00000000-...`; reiniciar estado `DESPACHADA` y `notificaciones_mision` | Retorna `200 OK` con UUIDs ficticios `00000000-...` (`"Sin patrulla asignada"`) mientras deja `PV-H74-02` en `EN_RECUPERACION` con `0` misiones en BD | **ABIERTO** | 24/11/2026 15:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H74-API-03` | Autorización de permiso `recuperacion:crear` / rol Encargado en `PATCH` (CA-5), bloqueo de bypass `x-user-id` en `GET` y alineación OpenAPI | Seguridad / RBAC / Contrato | Route / OpenAPI | Alta | Usuario autenticado con permiso `recuperacion:crear`, petición `GET` sin JWT con solo `x-user-id`, y consulta a `/openapi.json` | `PATCH` con JWT de rol con `recuperacion:crear`; `GET` con `-H "x-user-id: ...0003"` sin Bearer; `PATCH` con `x-user-id` según OpenAPI | `PATCH` permite acceso con `recuperacion:crear` o rol Encargado (CA-5); `GET` rechaza `x-user-id` con `401`; OpenAPI declara `BearerAuth` sin duplicados | `PATCH` rechaza `recuperacion:crear` con `403`; `GET` permite acceso `200` sin JWT vía `x-user-id`; `PATCH` rechaza `x-user-id` con `401` contra OpenAPI | **ABIERTO** | 24/11/2026 15:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H74-API-04` | Validación de estado `EN_MANTENCION` y manejo de `cantidad_en_uso` / `ASIGNADO` para activos individuales (`es_individual = true`) | Regla de Negocio / Inventario | Service / Repo | Alta | Recurso en tabla `recurso` con `es_individual = true`, `estado = 'EN_MANTENCION'`, `cantidad_inventario = 1`, `cantidad_en_uso = 0` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002` con `recursos: [{ recursoId: "<ACTIVO_IND>", cantidad: 1 }]` | Rechazar con `409 Conflict` activo en `EN_MANTENCION` y gestionar activos individuales vía `cantidad_en_uso` sin descontar `cantidad_inventario` | Retorna `200 OK`, asigna activo `EN_MANTENCION` y reduce `cantidad_inventario` a `0` (`NO_DISPONIBLE`) | **ABIERTO** | 24/11/2026 15:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H74-API-05` | Emisión completa Socket.io (`emitirRecursoActualizado`, `notificarPatrullaActualizada`), salas Redis Pub/Sub y tipado en `ServerToClientEvents` | Tiempo Real / Socket | Service / Socket | Media | Edición de recursos y patrulla en `PATCH` e inspección de `src/lib/socket/types.ts` y `src/lib/socket/index.ts` | Inspección de `ServerToClientEvents`, `emitirRecuperacionActualizada` y `editarEventoRecuperacionService` | Emisión de actualización de recursos/patrullas, publicación en `["sala:encargados","encargado","mapa"]` en Redis y eventos tipados | Faltan eventos en `ServerToClientEvents`, Redis Pub/Sub omite `"encargado"` y `"mapa"`, y servicio no emite `recurso:actualizado` ni `patrulla:actualizada` | **ABIERTO** | 24/11/2026 15:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H74-API-06` | Sincronización con rama `develop`, preservación de `HU-32` (`POST .../asignar`, `mision_id` en `recuperacion_recurso`), `HU-61` y `pg_advisory_xact_lock` | Integridad / CI / BD | Git / Migraciones / Repo | Crítica | Comparativa de rama actual frente a `origin/develop` | `git rev-list --left-right --count develop...HEAD` y `git diff --stat develop..HEAD` | Rama sincronizada con `develop` preservando `HU-32`, `HU-61`, `pg_advisory_xact_lock` y correlativos de migración únicos | Rama 75 commits detrás de `develop`; omite `pg_advisory_xact_lock`, borra `mision_id` al editar recursos, desalinea migración `035` vs `051` y suprime `HU-32`/`HU-61` | **ABIERTO** | 24/11/2026 15:21 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H74-API-01` | Consulta de detalle de operativo de recuperación vía `GET /api/eventos-atp/recuperacion/{id}` para precarga de edición (CA-1) | Funcional / API | Route / Service / Repo | Crítica | Operativo `REC-2026-7401` sembrado en BD en estado `EN_EJECUCION` y usuario `ENCARGADO` autenticado | `GET /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_ENC>` | `HTTP 200 OK` con ficha completa incluyendo `descripcion`, `fechaEstimadaFin`, `actualizadoPorId`, `patrulla`, `mision`, `recursos` e `historial` | `HTTP 200 OK` retornando estructura `RecuperacionDetalleResponse` completa (`REC-2026-7401`, 2 recursos, `cantidadInsumosAsignados: 100`) | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-02` | Rechazo `400 Bad Request` y `404 Not Found` en `GET /api/eventos-atp/recuperacion/{id}` ante UUID inválido u operativo inexistente | Validación / Robustez | Route / Service | Media | Usuario `ENCARGADO` autenticado con JWT Bearer | `GET .../recuperacion/id-invalido` y `GET .../recuperacion/74999999-0000-4000-8000-000000000999` | `HTTP 400` para UUID malformado y `HTTP 404` para UUID inexistente | Retorna `HTTP 400 Bad Request` (`"no es un UUID válido"`) y `HTTP 404 Not Found` (`"no encontrado"`) respectivamente | **APROBADO** | 24/11/2026 15:26 | - | fix(eventos-atp): robustecer detalle de operativo de recuperacion ante valores nulos y migraciones pendientes |
| `CP-H74-API-03` | Rechazo `401 Unauthorized` en `PATCH /api/eventos-atp/recuperacion/{id}` ante ausencia de token JWT Bearer | Seguridad / Auth | Route Handler | Crítica | Servidor API activo y petición sin cabecera `Authorization` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` sin headers de autenticación | `HTTP 401 Unauthorized` con mensaje indicando requerimiento de `Authorization: Bearer <token>` | Retorna `HTTP 401 Unauthorized`: `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-04` | Bloqueo `403 Forbidden` en `PATCH /api/eventos-atp/recuperacion/{id}` para perfil sin permiso (`CALL_CENTER`) | Seguridad / RBAC | Route / Auth Service | Crítica | Usuario autenticado con rol `CALL_CENTER` (`callcenter@valdivia.cl`) | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` con `Authorization: Bearer <TOKEN_CC>` | `HTTP 403 Forbidden` denegando la edición de planificación | Retorna `HTTP 403 Forbidden`: `"No cuenta con el permiso requerido: recuperacion:editar"` | **APROBADO** | 24/11/2026 15:24 | - | feat(db): agregar fecha_estimada_fin, actualizado_por_id y permiso recuperacion:editar (HU-74) |
| `CP-H74-API-05` | Validación `400 Bad Request` ante parámetro `id` no UUID, payload vacío `{}` o JSON malformado en `PATCH` | Validación / Zod | Route / Schema | Alta | Usuario `ENCARGADO` autenticado con JWT Bearer | `PATCH .../no-es-uuid` y `PATCH .../74100000-...-0001` con body `{}` | `HTTP 400 Bad Request` con arreglo `errors` detallando validación de UUID y regla `.refine()` de al menos un campo | Retorna `HTTP 400 Bad Request` en ambos escenarios con el detalle de `campo` y `mensaje` | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-06` | Validación `400 Bad Request` para `fechaEstimadaFin` sin zona horaria ISO-8601 y para fecha anterior a `creado_en` | Validación / Negocio | Schema / Service | Alta | Operativo `REC-2026-7401` creado el `24/11/2026` | `{"fechaEstimadaFin":"2026-11-28T18:00:00"}` y `{"fechaEstimadaFin":"2020-01-01T00:00:00.000Z"}` | `HTTP 400 Bad Request` por formato ISO-8601 sin offset y `FechaEstimadaInvalidaError` por fecha anterior a `creado_en` | Ambos casos retornan `HTTP 400 Bad Request` con los mensajes de validación esperados | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-07` | Edición exitosa de descripción, fecha estimada de término y dotación diferencial de recursos en operativo `EN_EJECUCION` (CA-2) | Funcional / Transacción | Route / Service / DB | Crítica | `REC-2026-7401` con 80 planchas (`inv:500`) y 20 frazadas (`inv:400`), más cajas alimentos (`inv:300`) | `PATCH` con nueva `descripcion`, `fechaEstimadaFin` y `recursos: [{planchas:60}, {cajas:15}]` | `HTTP 200 OK`; inventario actualizado atómicamente: planchas `520`, frazadas `420` (devueltas) y cajas `285` (descontadas) | `HTTP 200 OK` y tabla `recurso` en PostgreSQL reflejando `520`, `420` y `285` con `recuperacion_recurso` actualizado | **APROBADO** | 24/11/2026 15:26 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-08` | Registro inmutable de auditoría (`actualizado_en`, `actualizado_por_id`) y sincronización de `mision.descripcion` (CA-4) | Auditoría / DB | Repository / DB | Crítica | Ejecución exitosa de `CP-H74-API-07` por Encargado (`00000000-0000-4000-8000-000000000003`) | Consulta SQL sobre tablas `recuperacion` y `mision` tras `PATCH` | `actualizado_por_id = 00000000-...-0003`, `actualizado_en > creado_en` y `mision.descripcion` sincronizada | Columnas `actualizado_por_id`, `actualizado_en`, `fecha_estimada_fin` y `mision.descripcion` verificadas en PostgreSQL | **APROBADO** | 24/11/2026 15:26 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-09` | Limpieza explícita `fechaEstimadaFin: null` e idempotencia al enviar la misma `patrullaId` asignada | Caso de Borde | Service / Repo | Media | Operativo activo con `fechaEstimadaFin` definida y patrulla asignada `74500000-...-0002` | `PATCH` con `{"fechaEstimadaFin":null}` y `PATCH` con la misma `patrullaId` actual | `HTTP 200 OK` anulando `fechaEstimadaFin` a `null` y omitiendo error `409` ante reenvío idempotente de misma patrulla | Ambos retornan `HTTP 200 OK` sin duplicar hitos ni bloquear la patrulla ya asignada al operativo | **APROBADO** | 24/11/2026 15:26 | - | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-10` | Bloqueo de edición cuando el operativo se encuentra en estado `COMPLETADA` (`409 Conflict` — CA-3) | Regla de Negocio | Service / Route | Crítica | Operativo `REC-2026-7403` (`74100000-...-0003`) en estado `COMPLETADA` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000003` con `{"descripcion":"Intento editar..."}` | `HTTP 409 Conflict` bloqueando cualquier modificación sobre operativo completado | Retorna `HTTP 409 Conflict`: `"No es posible editar un operativo de recuperación en estado COMPLETADA."` | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-11` | Bloqueo de edición cuando el operativo se encuentra en estado `CANCELADA` (`409 Conflict` — CA-3) | Regla de Negocio | Service / Route | Crítica | Operativo `REC-2026-7404` (`74100000-...-0004`) en estado `CANCELADA` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000004` con `{"descripcion":"Intento editar..."}` | `HTTP 409 Conflict` bloqueando cualquier modificación sobre operativo cancelado | Retorna `HTTP 409 Conflict`: `"No es posible editar un operativo de recuperación en estado CANCELADA."` | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-12` | Reasignación exitosa de `patrullaId` a patrulla `DISPONIBLE` con registro de hito `REASIGNACION_PATRULLA` en `mision_hito` e historial | Funcional / ICS | Service / Repo / DB | Alta | `REC-2026-7401` con `PV-H74-01` y patrulla `PV-H74-02` en estado `DISPONIBLE` | `PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}` | `HTTP 200 OK`, `PV-H74-02` pasa a `EN_RECUPERACION`, se inserta hito `REASIGNACION_PATRULLA` en `mision_hito` y aparece en `GET` | `HTTP 200 OK`, `PV-H74-02` en `EN_RECUPERACION`, hito registrado en `mision_hito` y expuesto en `historial` de `GET` | **APROBADO** | 24/11/2026 15:26 | - | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-13` | Protección de patrulla anterior con otras misiones activas (`contarOtrasMisionesActivasPatrulla > 0`) | Regla de Negocio / ICS | Repository | Alta | `PV-H74-01` asignada simultáneamente a `MIS-2026-7401` (`EN_CURSO`) y `MIS-2026-7402` (`DESPACHADA`) | Reasignación de `REC-2026-7401` desde `PV-H74-01` hacia `PV-H74-02` | `PV-H74-01` conserva estado `EN_RECUPERACION` mientras mantenga `MIS-2026-7402` activa | Consulta SQL confirma `PV-H74-01` permaneció en `EN_RECUPERACION` al tener 1 misión activa remanente | **APROBADO** | 24/11/2026 15:26 | - | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-14` | Rechazo `409 Conflict` por stock insuficiente al incrementar o añadir insumo en `PATCH` | Regla de Negocio | Service / Route | Crítica | `REC-2026-7401` con 80 planchas asignadas y `500` disponibles en bodega | `PATCH` solicitando `{"recursos":[{"recursoId":"74000000-...-0001","cantidad":9999}]}` | `HTTP 409 Conflict` detallando incremento solicitado (`9919`) y disponible (`500`) | Retorna `HTTP 409 Conflict`: `"Stock insuficiente para el recurso \"Planchas de Zinc Acanaladas 3.66m (H74)\". Incremento solicitado: 9919, Disponible: 500."` | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-15` | Rechazo `409 Conflict` al reasignar `patrullaId` cuya unidad ya se encuentra en estado `EN_RECUPERACION` | Regla de Negocio / ICS | Service / Route | Alta | Patrulla `PV-H74-02` ocupada en estado `EN_RECUPERACION` | `PATCH .../74100000-...-0002` con `{"patrullaId":"74500000-0000-4000-8000-000000000002"}` | `HTTP 409 Conflict` indicando que la patrulla no está disponible | Retorna `HTTP 409 Conflict`: `"La patrulla \"Patrulla Verificadora Norte H74\" no está disponible para asignación (estado actual: EN_RECUPERACION)."` | **APROBADO** | 24/11/2026 15:26 | - | feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74) |
| `CP-H74-API-16` | Rechazo `404 Not Found` cuando el operativo, el recurso o la patrulla no existen en PostgreSQL | Robustez / DAL | Service / Repo | Alta | UUIDs inexistentes (`74999999-0000-4000-8000-000000000999`) | Tres peticiones `PATCH` con ID inexistente de operativo, recurso y patrulla | `HTTP 404 Not Found` específico por entidad inexistente | Retorna `HTTP 404 Not Found` en los 3 escenarios sin errores 500 | **APROBADO** | 24/11/2026 15:24 | - | feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74) |
| `CP-H74-API-17` | Ejecución idempotente de migraciones `043` y `045` y siembra del fixture `seed:h74` en PostgreSQL 16 | Base de Datos | Migración / Seed | Alta | Contenedor PostgreSQL 16 + PostGIS operativo en puerto `5001` | `npm run db:migrate && npm run seed:h74` | Columnas `fecha_estimada_fin`, `actualizado_por_id`, índice `idx_recuperacion_actualizado_por`, permiso `recuperacion:editar` y 4 operativos creados | Migraciones `035`, `043` y `045` aplicadas y fixture `seed:h74` sembrado con exit code `0` | **APROBADO** | 24/11/2026 15:23 | - | refactor(db): renombrar migracion a 045_recuperacion_edicion_auditoria (HU-74) |
| `CP-H74-API-18` | Verificación integral de `npm run lint`, `npm run build`, `tsc --noEmit` y suite Vitest (`881/881`) | Calidad / Regresión | Unit / Build / Lint | Alta | Rama `feature/H74-editar-operativo-recuperacion` con dependencias instaladas | `npm run lint`, `npm run build && npx tsc --noEmit` y `npm test` | Cero errores de lint/build/tipos y 100% de pruebas unitarias aprobadas | `lint` `0` errores, `build`/`tsc` exit code `0` (`27/27` páginas), `npm test` `73/73` archivos (`881/881` tests pass) | **APROBADO** | 24/11/2026 15:23 | - | test(eventos-atp): agregar pruebas para reasignacion de patrulla y GET detalle (HU-74) |

---

## 4. Exportación Tabular de Casos de Prueba (TSV)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H74-API-01	Control de concurrencia TOCTOU en recálculo de stock/patrulla (FOR UPDATE) y rechazo de edición en operativos eliminados lógicamente	Concurrencia / ACID	Repo / Service	Crítica	Operativo REC-2026-7401 (EN_EJECUCION, 80 planchas, inventario 500), patrulla PV-H74-02 DISPONIBLE, u operativo con eliminado_en IS NOT NULL	6 peticiones PATCH concurrentes de stock (100..150), 2 PATCH concurrentes de patrullaId, y PATCH sobre registro con eliminado_en IS NOT NULL	Serialización transaccional con .forUpdate(), inventario conservado (580), rechazo 409 en doble asignación de patrulla y 404 sobre eliminado lógico	6 PATCH retornan 200 perdiendo 100 unidades (330+150=480); 2 PATCH retornan 200 asignando misma patrulla a 2 misiones; PATCH edita registro eliminado (200)	ABIERTO	24/11/2026 15:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H74-API-02	Consistencia de misión y personal al reasignar patrullaId (operativo sin misión previa, misión EN_CURSO y liberación de líder/integrantes)	Regla de Negocio / ICS	Service / Repo	Crítica	Operativo PLANIFICADA sin fila en mision, o misión EN_CURSO reasignada a nueva patrulla DISPONIBLE	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002 con {"patrullaId":"74500000-0000-4000-8000-000000000002"} sin misión previa	Crear misión vinculada o rechazar explícitamente sin dejar patrulla huérfana ni UUIDs 00000000-...; reiniciar estado DESPACHADA y notificaciones_mision	Retorna 200 OK con UUIDs ficticios 00000000-... ("Sin patrulla asignada") mientras deja PV-H74-02 en EN_RECUPERACION con 0 misiones en BD	ABIERTO	24/11/2026 15:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H74-API-03	Autorización de permiso recuperacion:crear / rol Encargado en PATCH (CA-5), bloqueo de bypass x-user-id en GET y alineación OpenAPI	Seguridad / RBAC / Contrato	Route / OpenAPI	Alta	Usuario autenticado con permiso recuperacion:crear, petición GET sin JWT con solo x-user-id, y consulta a /openapi.json	PATCH con JWT de rol con recuperacion:crear; GET con -H "x-user-id: ...0003" sin Bearer; PATCH con x-user-id según OpenAPI	PATCH permite acceso con recuperacion:crear o rol Encargado (CA-5); GET rechaza x-user-id con 401; OpenAPI declara BearerAuth sin duplicados	PATCH rechaza recuperacion:crear con 403; GET permite acceso 200 sin JWT vía x-user-id; PATCH rechaza x-user-id con 401 contra OpenAPI	ABIERTO	24/11/2026 15:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H74-API-04	Validación de estado EN_MANTENCION y manejo de cantidad_en_uso / ASIGNADO para activos individuales (es_individual = true)	Regla de Negocio / Inventario	Service / Repo	Alta	Recurso en tabla recurso con es_individual = true, estado = 'EN_MANTENCION', cantidad_inventario = 1, cantidad_en_uso = 0	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002 con recursos: [{ recursoId: "<ACTIVO_IND>", cantidad: 1 }]	Rechazar con 409 Conflict activo en EN_MANTENCION y gestionar activos individuales vía cantidad_en_uso sin descontar cantidad_inventario	Retorna 200 OK, asigna activo EN_MANTENCION y reduce cantidad_inventario a 0 (NO_DISPONIBLE)	ABIERTO	24/11/2026 15:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H74-API-05	Emisión completa Socket.io (emitirRecursoActualizado, notificarPatrullaActualizada), salas Redis Pub/Sub y tipado en ServerToClientEvents	Tiempo Real / Socket	Service / Socket	Media	Edición de recursos y patrulla en PATCH e inspección de src/lib/socket/types.ts y src/lib/socket/index.ts	Inspección de ServerToClientEvents, emitirRecuperacionActualizada y editarEventoRecuperacionService	Emisión de actualización de recursos/patrullas, publicación en ["sala:encargados","encargado","mapa"] en Redis y eventos tipados	Faltan eventos en ServerToClientEvents, Redis Pub/Sub omite "encargado" y "mapa", y servicio no emite recurso:actualizado ni patrulla:actualizada	ABIERTO	24/11/2026 15:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H74-API-06	Sincronización con rama develop, preservación de HU-32 (POST .../asignar, mision_id en recuperacion_recurso), HU-61 y pg_advisory_xact_lock	Integridad / CI / BD	Git / Migraciones / Repo	Crítica	Comparativa de rama actual frente a origin/develop	git rev-list --left-right --count develop...HEAD y git diff --stat develop..HEAD	Rama sincronizada con develop preservando HU-32, HU-61, pg_advisory_xact_lock y correlativos de migración únicos	Rama 75 commits detrás de develop; omite pg_advisory_xact_lock, borra mision_id al editar recursos, desalinea migración 035 vs 051 y suprime HU-32/HU-61	ABIERTO	24/11/2026 15:21	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H74-API-01	Consulta de detalle de operativo de recuperación vía GET /api/eventos-atp/recuperacion/{id} para precarga de edición (CA-1)	Funcional / API	Route / Service / Repo	Crítica	Operativo REC-2026-7401 sembrado en BD en estado EN_EJECUCION y usuario ENCARGADO autenticado	GET /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_ENC>	HTTP 200 OK con ficha completa incluyendo descripcion, fechaEstimadaFin, actualizadoPorId, patrulla, mision, recursos e historial	HTTP 200 OK retornando estructura RecuperacionDetalleResponse completa (REC-2026-7401, 2 recursos, cantidadInsumosAsignados: 100)	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-02	Rechazo 400 Bad Request y 404 Not Found en GET /api/eventos-atp/recuperacion/{id} ante UUID inválido u operativo inexistente	Validación / Robustez	Route / Service	Media	Usuario ENCARGADO autenticado con JWT Bearer	GET .../recuperacion/id-invalido y GET .../recuperacion/74999999-0000-4000-8000-000000000999	HTTP 400 para UUID malformado y HTTP 404 para UUID inexistente	Retorna HTTP 400 Bad Request ("no es un UUID válido") y HTTP 404 Not Found ("no encontrado") respectivamente	APROBADO	24/11/2026 15:26	-	fix(eventos-atp): robustecer detalle de operativo de recuperacion ante valores nulos y migraciones pendientes
CP-H74-API-03	Rechazo 401 Unauthorized en PATCH /api/eventos-atp/recuperacion/{id} ante ausencia de token JWT Bearer	Seguridad / Auth	Route Handler	Crítica	Servidor API activo y petición sin cabecera Authorization	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 sin headers de autenticación	HTTP 401 Unauthorized con mensaje indicando requerimiento de Authorization: Bearer <token>	Retorna HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>."	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-04	Bloqueo 403 Forbidden en PATCH /api/eventos-atp/recuperacion/{id} para perfil sin permiso (CALL_CENTER)	Seguridad / RBAC	Route / Auth Service	Crítica	Usuario autenticado con rol CALL_CENTER (callcenter@valdivia.cl)	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 con Authorization: Bearer <TOKEN_CC>	HTTP 403 Forbidden denegando la edición de planificación	Retorna HTTP 403 Forbidden: "No cuenta con el permiso requerido: recuperacion:editar"	APROBADO	24/11/2026 15:24	-	feat(db): agregar fecha_estimada_fin, actualizado_por_id y permiso recuperacion:editar (HU-74)
CP-H74-API-05	Validación 400 Bad Request ante parámetro id no UUID, payload vacío {} o JSON malformado en PATCH	Validación / Zod	Route / Schema	Alta	Usuario ENCARGADO autenticado con JWT Bearer	PATCH .../no-es-uuid y PATCH .../74100000-...-0001 con body {}	HTTP 400 Bad Request con arreglo errors detallando validación de UUID y regla .refine() de al menos un campo	Retorna HTTP 400 Bad Request en ambos escenarios con el detalle de campo y mensaje	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-06	Validación 400 Bad Request para fechaEstimadaFin sin zona horaria ISO-8601 y para fecha anterior a creado_en	Validación / Negocio	Schema / Service	Alta	Operativo REC-2026-7401 creado el 24/11/2026	{"fechaEstimadaFin":"2026-11-28T18:00:00"} y {"fechaEstimadaFin":"2020-01-01T00:00:00.000Z"}	HTTP 400 Bad Request por formato ISO-8601 sin offset y FechaEstimadaInvalidaError por fecha anterior a creado_en	Ambos casos retornan HTTP 400 Bad Request con los mensajes de validación esperados	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-07	Edición exitosa de descripción, fecha estimada de término y dotación diferencial de recursos en operativo EN_EJECUCION (CA-2)	Funcional / Transacción	Route / Service / DB	Crítica	REC-2026-7401 con 80 planchas (inv:500) y 20 frazadas (inv:400), más cajas alimentos (inv:300)	PATCH con nueva descripcion, fechaEstimadaFin y recursos: [{planchas:60}, {cajas:15}]	HTTP 200 OK; inventario actualizado atómicamente: planchas 520, frazadas 420 (devueltas) y cajas 285 (descontadas)	HTTP 200 OK y tabla recurso en PostgreSQL reflejando 520, 420 y 285 con recuperacion_recurso actualizado	APROBADO	24/11/2026 15:26	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-08	Registro inmutable de auditoría (actualizado_en, actualizado_por_id) y sincronización de mision.descripcion (CA-4)	Auditoría / DB	Repository / DB	Crítica	Ejecución exitosa de CP-H74-API-07 por Encargado (00000000-0000-4000-8000-000000000003)	Consulta SQL sobre tablas recuperacion y mision tras PATCH	actualizado_por_id = 00000000-...-0003, actualizado_en > creado_en y mision.descripcion sincronizada	Columnas actualizado_por_id, actualizado_en, fecha_estimada_fin y mision.descripcion verificadas en PostgreSQL	APROBADO	24/11/2026 15:26	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-09	Limpieza explícita fechaEstimadaFin: null e idempotencia al enviar la misma patrullaId asignada	Caso de Borde	Service / Repo	Media	Operativo activo con fechaEstimadaFin definida y patrulla asignada 74500000-...-0002	PATCH con {"fechaEstimadaFin":null} y PATCH con la misma patrullaId actual	HTTP 200 OK anulando fechaEstimadaFin a null y omitiendo error 409 ante reenvío idempotente de misma patrulla	Ambos retornan HTTP 200 OK sin duplicar hitos ni bloquear la patrulla ya asignada al operativo	APROBADO	24/11/2026 15:26	-	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-10	Bloqueo de edición cuando el operativo se encuentra en estado COMPLETADA (409 Conflict — CA-3)	Regla de Negocio	Service / Route	Crítica	Operativo REC-2026-7403 (74100000-...-0003) en estado COMPLETADA	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000003 con {"descripcion":"Intento editar..."}	HTTP 409 Conflict bloqueando cualquier modificación sobre operativo completado	Retorna HTTP 409 Conflict: "No es posible editar un operativo de recuperación en estado COMPLETADA."	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-11	Bloqueo de edición cuando el operativo se encuentra en estado CANCELADA (409 Conflict — CA-3)	Regla de Negocio	Service / Route	Crítica	Operativo REC-2026-7404 (74100000-...-0004) en estado CANCELADA	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000004 con {"descripcion":"Intento editar..."}	HTTP 409 Conflict bloqueando cualquier modificación sobre operativo cancelado	Retorna HTTP 409 Conflict: "No es posible editar un operativo de recuperación en estado CANCELADA."	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-12	Reasignación exitosa de patrullaId a patrulla DISPONIBLE con registro de hito REASIGNACION_PATRULLA en mision_hito e historial	Funcional / ICS	Service / Repo / DB	Alta	REC-2026-7401 con PV-H74-01 y patrulla PV-H74-02 en estado DISPONIBLE	PATCH /api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001 con {"patrullaId":"74500000-0000-4000-8000-000000000002"}	HTTP 200 OK, PV-H74-02 pasa a EN_RECUPERACION, se inserta hito REASIGNACION_PATRULLA en mision_hito y aparece en GET	HTTP 200 OK, PV-H74-02 en EN_RECUPERACION, hito registrado en mision_hito y expuesto en historial de GET	APROBADO	24/11/2026 15:26	-	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-13	Protección de patrulla anterior con otras misiones activas (contarOtrasMisionesActivasPatrulla > 0)	Regla de Negocio / ICS	Repository	Alta	PV-H74-01 asignada simultáneamente a MIS-2026-7401 (EN_CURSO) y MIS-2026-7402 (DESPACHADA)	Reasignación de REC-2026-7401 desde PV-H74-01 hacia PV-H74-02	PV-H74-01 conserva estado EN_RECUPERACION mientras mantenga MIS-2026-7402 activa	Consulta SQL confirma PV-H74-01 permaneció en EN_RECUPERACION al tener 1 misión activa remanente	APROBADO	24/11/2026 15:26	-	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-14	Rechazo 409 Conflict por stock insuficiente al incrementar o añadir insumo en PATCH	Regla de Negocio	Service / Route	Crítica	REC-2026-7401 con 80 planchas asignadas y 500 disponibles en bodega	PATCH solicitando {"recursos":[{"recursoId":"74000000-...-0001","cantidad":9999}]}	HTTP 409 Conflict detallando incremento solicitado (9919) y disponible (500)	Retorna HTTP 409 Conflict: "Stock insuficiente para el recurso \"Planchas de Zinc Acanaladas 3.66m (H74)\". Incremento solicitado: 9919, Disponible: 500."	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-15	Rechazo 409 Conflict al reasignar patrullaId cuya unidad ya se encuentra en estado EN_RECUPERACION	Regla de Negocio / ICS	Service / Route	Alta	Patrulla PV-H74-02 ocupada en estado EN_RECUPERACION	PATCH .../74100000-...-0002 con {"patrullaId":"74500000-0000-4000-8000-000000000002"}	HTTP 409 Conflict indicando que la patrulla no está disponible	Retorna HTTP 409 Conflict: "La patrulla \"Patrulla Verificadora Norte H74\" no está disponible para asignación (estado actual: EN_RECUPERACION)."	APROBADO	24/11/2026 15:26	-	feat(eventos-atp): agregar GET [id] y reasignacion de patrulla en PATCH recuperacion (HU-74)
CP-H74-API-16	Rechazo 404 Not Found cuando el operativo, el recurso o la patrulla no existen en PostgreSQL	Robustez / DAL	Service / Repo	Alta	UUIDs inexistentes (74999999-0000-4000-8000-000000000999)	Tres peticiones PATCH con ID inexistente de operativo, recurso y patrulla	HTTP 404 Not Found específico por entidad inexistente	Retorna HTTP 404 Not Found en los 3 escenarios sin errores 500	APROBADO	24/11/2026 15:24	-	feat(eventos-atp): implementar endpoint PATCH /api/eventos-atp/recuperacion/[id] (HU-74)
CP-H74-API-17	Ejecución idempotente de migraciones 043 y 045 y siembra del fixture seed:h74 en PostgreSQL 16	Base de Datos	Migración / Seed	Alta	Contenedor PostgreSQL 16 + PostGIS operativo en puerto 5001	npm run db:migrate && npm run seed:h74	Columnas fecha_estimada_fin, actualizado_por_id, índice idx_recuperacion_actualizado_por, permiso recuperacion:editar y 4 operativos creados	Migraciones 035, 043 y 045 aplicadas y fixture seed:h74 sembrado con exit code 0	APROBADO	24/11/2026 15:23	-	refactor(db): renombrar migracion a 045_recuperacion_edicion_auditoria (HU-74)
CP-H74-API-18	Verificación integral de npm run lint, npm run build, tsc --noEmit y suite Vitest (881/881)	Calidad / Regresión	Unit / Build / Lint	Alta	Rama feature/H74-editar-operativo-recuperacion con dependencias instaladas	npm run lint, npm run build && npx tsc --noEmit y npm test	Cero errores de lint/build/tipos y 100% de pruebas unitarias aprobadas	lint 0 errores, build/tsc exit code 0 (27/27 páginas), npm test 73/73 archivos (881/881 tests pass)	APROBADO	24/11/2026 15:23	-	test(eventos-atp): agregar pruebas para reasignacion de patrulla y GET detalle (HU-74)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Preparación de Base de Datos y Fixture HU-74

**Comandos ejecutados:**
```bash
npm run db:migrate && npm run seed:h74
```

**Salida real obtenida (`exit code 0`):**
```text
Ejecutando migraciones Kysely de base de datos...
[OK] Migración Kysely ejecutada con éxito: "035_permiso_misiones_terreno_verificar"
[OK] Migración Kysely ejecutada con éxito: "043_recuperacion_listado_rbac_e_indices"
[OK] Migración Kysely ejecutada con éxito: "045_recuperacion_edicion_auditoria"
Todas las migraciones se completaron correctamente.
Limpiando fixture H74 (operativos de recuperación)...
Limpieza de fixture H74 completada.
Sembrando fixture H74 en la base de datos...
Fixture H74 sembrado exitosamente (4 operativos: EN_EJECUCION, PLANIFICADA, COMPLETADA, CANCELADA y permiso RBAC asegurado).
```

---

### 5.2 Ejecución de Análisis Estático, Compilación y Pruebas Automatizadas (Vitest)

**Comandos de análisis estático y compilación:**
```bash
npm run lint
npm run build && npx tsc --noEmit
```

**Resultados observados:**
* `npm run lint`: finalizado con `exit code 0` (0 errores, 0 advertencias).
* `npm run build && npx tsc --noEmit`: finalizado con `exit code 0` tras depurar `.next/dev` y tipos residuales previos (`27/27` páginas generadas).

**Comando de pruebas unitarias y de ruta específicas de HU-74 y OpenAPI:**
```bash
npm test -- src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts src/modules/eventos-atp/__tests__/recuperacion.service.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida real obtenida:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/eventos-atp/__tests__/recuperacion.service.test.ts (32 tests) 38ms
 ✓ src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts (14 tests) 27ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 160ms

 Test Files  3 passed (3)
      Tests  47 passed (47)
   Start at  15:27:27
   Duration  1.07s (transform 478ms, setup 0ms, collect 1.48s, tests 225ms, environment 2ms, prepare 239ms)
```

**Ejecución filtrada por patrón de historia (`-t`) y suite completa:**
```bash
npm test -- -t "HU-74|H73|HU-29"
# Test Files  3 passed | 70 skipped (73) — Tests  48 passed | 833 skipped (881)

npm test
# Test Files  73 passed (73) — Tests  881 passed (881)
```

---

### 5.3 Pruebas de Integración Replicables vía HTTP (`cURL`)

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

#### 2. Consulta de Detalle de Operativo (`GET /api/eventos-atp/recuperacion/{id}` — `CP-H74-API-01`)
```bash
curl -s -i -X GET "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Authorization: Bearer $TOKEN_ENC"
```
**Respuesta HTTP real (`200 OK`):**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Detalle de operativo de recuperación obtenido exitosamente.","data":{"id":"74100000-0000-4000-8000-000000000001","codigo":"REC-2026-7401","nombre":"Entrega de techumbres y habitabilidad Niebla Alto","descripcion":"Despliegue de entrega de planchas de zinc y frazadas a viviendas afectadas.","sector":"Sector Niebla Alto","direccionTexto":"Calle Miramar #450, Niebla","prioridad":"ALTA","contactoNombre":"Mariana Cárdenas","contactoTelefono":"+56987654321","latitud":-39.8682,"longitud":-73.3965,"estado":"EN_EJECUCION","familiasAfectadas":18,"delegacion":{"id":"30000000-0000-4000-8000-000000000003","codigo":"DEL_COSTA","nombre":"Delegación Municipal Costa"},"creadoPor":{"id":"00000000-0000-4000-8000-000000000003","nombre":"Encargado de Operaciones"},"mision":{"id":"74200000-0000-4000-8000-000000000001","codigo":"MIS-2026-7401","titulo":"Entrega de techumbres y habitabilidad Niebla Alto","estado":"EN_CURSO","tipoMision":"RECUPERACION"},"patrulla":{"id":"74500000-0000-4000-8000-000000000001","nombre":"Patrulla Verificadora Costa H74","estado":"EN_RECUPERACION"},"recursos":[{"recursoId":"74000000-0000-4000-8000-000000000001","nombre":"Planchas de Zinc Acanaladas 3.66m (H74)","cantidadAsignada":80},{"recursoId":"74000000-0000-4000-8000-000000000003","nombre":"Frazadas Térmicas Polar (H74)","cantidadAsignada":20}],"cantidadInsumosAsignados":100,"totalTiposInsumos":2,"historial":[{"id":"rec-creacion-74100000-0000-4000-8000-000000000001","tipo":"CREACION","titulo":"Operativo Planificado y Despachado","descripcion":"Despliegue de entrega de planchas de zinc y frazadas a viviendas afectadas.","registradoPor":{"id":"00000000-0000-4000-8000-000000000003","nombre":"Encargado de Operaciones"},"creadoEn":"2026-11-24T15:23:03.408Z"}],"creadoEn":"2026-11-24T15:23:03.408Z","actualizadoEn":"2026-11-24T17:53:03.408Z","fechaEstimadaFin":"2026-11-26T18:23:03.408Z","actualizadoPorId":null,"fechaCierre":null,"observacionesCierre":null}}
```

#### 3. Rechazos de Autenticación y Control de Acceso (`CP-H74-API-03`, `CP-H74-API-04`)
```bash
# Sin cabecera Authorization -> 401 Unauthorized
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"descripcion":"Intento sin auth"}'

# Usuario Call Center sin permiso -> 403 Forbidden
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_CC" \
  -d '{"descripcion":"Intento call center"}'
```
**Respuestas HTTP reales:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: recuperacion:editar"}
```

#### 4. Validaciones Zod y Regla Temporal (`CP-H74-API-05`, `CP-H74-API-06`)
```bash
# UUID inválido -> 400 Bad Request
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/no-es-uuid" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"descripcion":"Prueba UUID"}'

# Payload vacío -> 400 Bad Request
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{}'

# Fecha sin zona horaria ISO-8601 -> 400 Bad Request
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"fechaEstimadaFin":"2026-11-28T18:00:00"}'

# Fecha anterior a creado_en -> 400 Bad Request
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"fechaEstimadaFin":"2020-01-01T00:00:00.000Z"}'
```
**Respuestas HTTP reales:**
```json
// UUID inválido (400)
{"message":"El identificador del operativo de recuperación no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador del operativo debe ser un UUID válido"}]}

// Body vacío (400)
{"message":"Datos de entrada inválidos para editar el operativo de recuperación.","errors":[{"campo":"","mensaje":"Debe proporcionar al menos un campo para actualizar (descripcion, fechaEstimadaFin, recursos o patrullaId)."}]}

// Fecha sin offset (400)
{"message":"Datos de entrada inválidos para editar el operativo de recuperación.","errors":[{"campo":"fechaEstimadaFin","mensaje":"La fecha estimada de término debe tener formato ISO-8601 con zona horaria"}]}

// Fecha anterior a creado_en (400)
{"message":"La fecha estimada de término no puede ser anterior a la fecha de creación del operativo."}
```

#### 5. Bloqueo de Edición en Operativos `COMPLETADA` y `CANCELADA` (`CP-H74-API-10`, `CP-H74-API-11`)
```bash
# Operativo COMPLETADA (REC-2026-7403)
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000003" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"descripcion":"Intento editar operativo completado"}'

# Operativo CANCELADA (REC-2026-7404)
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000004" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"descripcion":"Intento editar operativo cancelado"}'
```
**Respuestas HTTP reales (`409 Conflict`):**
```json
{"message":"No es posible editar un operativo de recuperación en estado COMPLETADA."}
{"message":"No es posible editar un operativo de recuperación en estado CANCELADA."}
```

#### 6. Edición Exitosa de Descripción, Fecha Estimada y Dotación Diferencial de Recursos + Verificación SQL (`CP-H74-API-07`, `CP-H74-API-08`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{
    "descripcion": "Ampliación de techumbre en sector Niebla Alto (actualizado QA)",
    "fechaEstimadaFin": "2026-11-30T18:00:00.000Z",
    "recursos": [
      {"recursoId": "74000000-0000-4000-8000-000000000001", "cantidad": 60},
      {"recursoId": "74000000-0000-4000-8000-000000000002", "cantidad": 15}
    ]
  }'
```
**Respuesta HTTP real (`200 OK`) y verificación en PostgreSQL:**
```json
{"message":"Planificación del operativo de recuperación actualizada exitosamente.","data":{"id":"74100000-0000-4000-8000-000000000001","codigo":"REC-2026-7401","nombre":"Entrega de techumbres y habitabilidad Niebla Alto","descripcion":"Ampliación de techumbre en sector Niebla Alto (actualizado QA)","sector":"Sector Niebla Alto","direccionTexto":"Calle Miramar #450, Niebla","prioridad":"ALTA","contactoNombre":"Mariana Cárdenas","contactoTelefono":"+56987654321","latitud":-39.8682,"longitud":-73.3965,"estado":"EN_EJECUCION","familiasAfectadas":18,"delegacion":{"id":"30000000-0000-4000-8000-000000000003","codigo":"DEL_COSTA","nombre":"Delegación Municipal Costa"},"mision":{"id":"74200000-0000-4000-8000-000000000001","codigo":"MIS-2026-7401","titulo":"Entrega de techumbres y habitabilidad Niebla Alto","estado":"EN_CURSO","tipoMision":"RECUPERACION"},"patrulla":{"id":"74500000-0000-4000-8000-000000000001","nombre":"Patrulla Verificadora Costa H74","estado":"EN_RECUPERACION"},"recursos":[{"recursoId":"74000000-0000-4000-8000-000000000001","nombre":"Planchas de Zinc Acanaladas 3.66m (H74)","cantidadAsignada":60},{"recursoId":"74000000-0000-4000-8000-000000000002","nombre":"Cajas de Alimentos de Emergencia (H74)","cantidadAsignada":15}],"creadoPorId":"00000000-0000-4000-8000-000000000003","fechaEstimadaFin":"2026-11-30T18:00:00.000Z","actualizadoPorId":"00000000-0000-4000-8000-000000000003","creadoEn":"2026-11-24T15:26:24.209Z","actualizadoEn":"2026-11-24T18:26:24.641Z"}}
```
```text
Recursos tras PATCH:
[{"id":"74000000-0000-4000-8000-000000000001","nombre":"Planchas de Zinc Acanaladas 3.66m (H74)","cantidad_inventario":520,"estado":"DISPONIBLE"},
 {"id":"74000000-0000-4000-8000-000000000002","nombre":"Cajas de Alimentos de Emergencia (H74)","cantidad_inventario":285,"estado":"DISPONIBLE"},
 {"id":"74000000-0000-4000-8000-000000000003","nombre":"Frazadas Térmicas Polar (H74)","cantidad_inventario":420,"estado":"DISPONIBLE"}]

Auditoría tras PATCH:
[{"codigo":"REC-2026-7401","descripcion":"Ampliación de techumbre en sector Niebla Alto (actualizado QA)","fecha_estimada_fin":"2026-11-30T18:00:00.000Z","actualizado_por_id":"00000000-0000-4000-8000-000000000003","actualizado_en":"2026-11-24T18:26:24.641Z","mision_desc":"Ampliación de techumbre en sector Niebla Alto (actualizado QA)"}]
```

#### 7. Reasignación de Patrulla, Hito `REASIGNACION_PATRULLA` y Bloqueos Operativos (`CP-H74-API-12` a `CP-H74-API-16`)
```bash
# Reasignar patrulla disponible PV-H74-02 -> 200 OK
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"patrullaId":"74500000-0000-4000-8000-000000000002"}'

# Intentar asignar PV-H74-02 (ahora EN_RECUPERACION) a REC-2026-7402 -> 409 Conflict
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"patrullaId":"74500000-0000-4000-8000-000000000002"}'

# Stock insuficiente -> 409 Conflict
curl -s -i -X PATCH "http://localhost:3001/api/eventos-atp/recuperacion/74100000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ENC" \
  -d '{"recursos":[{"recursoId":"74000000-0000-4000-8000-000000000001","cantidad":9999}]}'
```
**Respuestas y verificaciones en BD:**
```text
Patrullas tras reasignación:
[{"id":"74500000-0000-4000-8000-000000000001","codigo":"PV-H74-01","estado":"EN_RECUPERACION"},
 {"id":"74500000-0000-4000-8000-000000000002","codigo":"PV-H74-02","estado":"EN_RECUPERACION"}]

Hitos tras reasignación:
[{"hito":"REASIGNACION_PATRULLA","descripcion":"Patrulla reasignada a \"Patrulla Verificadora Norte H74\" durante edición de operativo REC-2026-7401.","registrado_por_id":"00000000-0000-4000-8000-000000000003"}]

409 Patrulla ocupada:
{"message":"La patrulla \"Patrulla Verificadora Norte H74\" no está disponible para asignación (estado actual: EN_RECUPERACION)."}

409 Stock insuficiente:
{"message":"Stock insuficiente para el recurso \"Planchas de Zinc Acanaladas 3.66m (H74)\". Incremento solicitado: 9919, Disponible: 500."}
```

#### 8. Evidencia de Reproducción de Defectos Abiertos (`BUG-H74-API-01` a `BUG-H74-API-04`)
```text
=== BUG-H74-API-01 (Concurrencia Stock, Doble Patrulla y Eliminado Lógico) ===
Antes -> inventario: { cantidad_inventario: 500 } asignada: { cantidad_asignada: 80 }
Concurrent statuses (6 PATCH de 100..150): [ 200, 200, 200, 200, 200, 200 ]
Después -> inventario: { cantidad_inventario: 330 } filas asignadas: [ { cantidad_asignada: 150 } ]
SUMA (inv + asig) esperada: 580, real: 480 (pérdida de 100 unidades)

Concurrent Patrol P1 status: 200 P2 status: 200
Misiones apuntando a misma patrulla:
[{"id":"74200000-0000-4000-8000-000000000001","codigo":"MIS-2026-7401","patrulla_id":"74500000-0000-4000-8000-000000000002"},
 {"id":"74200000-0000-4000-8000-000000000002","codigo":"MIS-2026-7402","patrulla_id":"74500000-0000-4000-8000-000000000002"}]

GET deleted status: 404 {"message":"Operativo de recuperación con ID '74100000-0000-4000-8000-000000000002' no encontrado."}
PATCH deleted status: 200 {"message":"Planificación del operativo de recuperación actualizada exitosamente.",...}

=== BUG-H74-API-02 (Patrulla Huérfana sin Misión Previa) ===
PATCH sin misión status: 200
"mision":{"id":"00000000-0000-0000-0000-000000000000","codigo":"","titulo":"Distribución preventiva de cajas de alimentos Angachilla","estado":"PLANIFICADA","tipoMision":"RECUPERACION"}
"patrulla":{"id":"00000000-0000-0000-0000-000000000000","nombre":"Sin patrulla asignada","estado":"DISPONIBLE"}
Patrulla huérfana en BD: [{"id":"74500000-0000-4000-8000-000000000002","codigo":"PV-H74-02","estado":"EN_RECUPERACION","misiones_count":0}]

=== BUG-H74-API-03 (Bypass x-user-id en GET, Rechazo OpenAPI en PATCH y CA-5) ===
GET con solo x-user-id (sin JWT) status: 200
PATCH con solo x-user-id (OpenAPI) status: 401 {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
PATCH con permiso recuperacion:crear (CA-5) status: 403 {"message":"No cuenta con el permiso requerido: recuperacion:editar"}

=== BUG-H74-API-04 (Recurso Individual es_individual=true y EN_MANTENCION) ===
PATCH recurso es_individual=true y EN_MANTENCION status: 200
Recurso individual tras PATCH: [{"id":"74000000-0000-4000-8000-000000000099","nombre":"Motobomba QA Individual","es_individual":true,"estado":"NO_DISPONIBLE","cantidad_inventario":0,"cantidad_en_uso":0}]
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA) y Dictamen Final

| Criterio de Aceptación (HU-74) | Casos de Prueba Asociados | Estado en Backend | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** En el detalle del operativo de recuperación, el sistema debe proveer la acción 'Editar Planificación'. | `CP-H74-API-01`, `CP-H74-API-02`, `BUG-H74-API-03`, `BUG-H74-API-06` | 🟡 **PARCIAL** | `GET /api/eventos-atp/recuperacion/[id]` expone `fechaEstimadaFin`, `actualizadoPorId`, recursos, patrulla e historial para precarga, pero admite bypass `x-user-id` sin JWT y colisiona en contrato respecto a `develop`. |
| **CA-2:** El formulario modal debe permitir modificar: descripción de tareas, fecha estimada de término y reasignación de insumos/recursos. | `CP-H74-API-05` a `CP-H74-API-09`, `CP-H74-API-12` a `CP-H74-API-16`, `BUG-H74-API-01`, `BUG-H74-API-02`, `BUG-H74-API-04`, `BUG-H74-API-05` | 🔴 **CON OBSERVACIONES** | El flujo nominal edita descripción, `fechaEstimadaFin`, recursos y `patrullaId`, pero falla ante concurrencia (pérdida de stock y doble asignación de patrulla), operativos sin misión previa y recursos individuales/`EN_MANTENCION`. |
| **CA-3:** No se debe permitir editar un operativo que se encuentre en estado `COMPLETADA` o `CANCELADA`. | `CP-H74-API-10`, `CP-H74-API-11`, `BUG-H74-API-01` | 🟡 **PARCIAL** | Rechaza `409 Conflict` para `COMPLETADA` y `CANCELADA`, pero carece de bloqueo `.forUpdate()` y de condición de estado en el `UPDATE` SQL ante transacciones concurrentes, además de no filtrar `eliminado_en IS NULL`. |
| **CA-4:** Cada edición debe registrar auditoría (`actualizado_en = CURRENT_TIMESTAMP`, `actualizado_por_id`). | `CP-H74-API-08`, `CP-H74-API-17` | 🟢 **CUMPLIDO** | La migración `045_recuperacion_edicion_auditoria.ts` crea `actualizado_por_id` (FK a `usuario(id)`) y `actualizarRecuperacion` persiste ambos atributos en cada edición exitosa. |
| **CA-5:** El endpoint `PATCH /api/eventos-atp/recuperacion/{id}` debe requerir permiso `recuperacion:crear` o rol Encargado. | `CP-H74-API-03`, `CP-H74-API-04`, `BUG-H74-API-03` | 🔴 **INCUMPLIDO** | El Route Handler exige exclusivamente `recuperacion:editar` mediante `verificarPermiso`, rechazando con `403 Forbidden` a roles con permiso `recuperacion:crear` y sin verificar el rol `Encargado` como exige el CA-5. |

**Dictamen QA:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested`)** — Se requiere subsanar los defectos `BUG-H74-API-01` a `BUG-H74-API-06`, sincronizar la rama con `develop` y ejecutar el ciclo formal de **Re-Test** antes de aprobar el merge.

