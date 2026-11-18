# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-21 — Asignar Cuadrilla a Incidente y Liberar Patrulla (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones Tácticas e Incidentes (`sgrai-api` — `POST /api/misiones` y `GET /api/cuadrillas?estado=DISPONIBLE`).  
> **Historia de Usuario:** HU-21 — *"Como Encargado Quiero asignar cuadrillas operativas a incidentes verificados para su resolución táctica, liberando automáticamente a la patrulla verificadora Para desplegar la respuesta de intervención pesada en terreno y devolver inmediatamente la patrulla a disponibilidad operativa según el protocolo ICS."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h21-asignar-cuadrilla`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): agregar tabla y migracion mision_hito para bitacora de misiones (HU-21)`  
> * `feat(seguridad): registrar permiso misiones:asignar (HU-21)`  
> * `feat(socket): incorporar evento patrulla:liberada y emisores de misiones (HU-21)`  
> * `feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)`  
> * `test(misiones): agregar pruebas unitarias e integracion para asignacion de cuadrillas y liberacion (HU-21)`  
> * `docs(api): documentar endpoint POST /api/misiones y regla de negocio §3.2 (HU-21)`  
> * `feat(misiones): validar evaluacion tecnica previa de patrulla y estructurar error VERIFICACION_EN_CURSO (HU-21)`  
> * `test(misiones): agregar pruebas y documentacion para error VERIFICACION_EN_CURSO (HU-21)`  
> * `chore(seed): agregar script seed:estados con incidentes en todos los estados operacionales`  
> * `fix(cuadrillas): habilitar leftJoin en consulta de cuadrillas y sembrar cuadrillas con delegados (HU-21)`  
> * `fix(misiones): soportar despacho de cuadrilla sobre incidente con verificacion completada (HU-21)`  
> * `feat(incidentes): agregar campo verificado y ordenamiento prioritario en kanban`  
> * `test(seguridad): actualizar version esperada de openapi a 0.10.0`  
> * `fix(build): corregir tipado de cuadrillas e incorporar verificado en mocks para compilacion limpia`  
>  
> **Fecha de Auditoría QA:** 09/11/2026 16:45.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested`) — 5 DEFECTOS REALES ABIERTOS PENDIENTES DE CORRECCIÓN**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense del código fuente, revisión de transacciones ACID en Kysely/PostgreSQL, análisis de concurrencia, verificación del encadenamiento de migraciones respecto a `develop`, validación de las reglas de negocio del Sistema de Comando de Incidentes (ICS §3.2), difusión de eventos en tiempo real vía Socket.io/Redis, contratos OpenAPI 3.0 y ejecución de pruebas automatizadas y de integración sobre la rama `feature/h21-asignar-cuadrilla`, se identificaron **5 defectos reales** (**2 de severidad CRÍTICA**, **2 de severidad ALTA** y **1 de severidad MEDIA**) que impiden la aprobación del Pull Request en su estado actual.

| Métrica de Calidad | Resultado de Auditoría | Observaciones |
|---|:---:|---|
| **Total de Casos de Prueba Diseñados y Evaluados** | **25** | Cobertura de Concurrencia, Regla ICS §3.2, Transacciones ACID, RBAC, Validación Zod, OpenAPI y Eventos Socket.io |
| **Casos Aprobados (Passed)** | **20** | Flujo nominal de despacho, bloqueo `VERIFICACION_EN_CURSO`, validaciones Zod, errores 401/403/404/409 y suite Vitest |
| **Casos Fallidos / Defectos Abiertos (Failed)** | **5** | `BUG-H21-API-01` a `BUG-H21-API-05` documentados en la Sección 2 |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de infraestructura local (PostgreSQL 16 + Redis 7 operativos) |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere 100% de aprobación en Re-Test para certificar el merge a `develop` |
| **Análisis Estático de Código (`npm run lint`)** | 🔴 **1 error / 11 warnings** | Error `@typescript-eslint/no-explicit-any` en `cuadrilla.service.test.ts:374` y warning en `mision.schema.test.ts:8` |
| **Suite Automatizada del Módulo Misiones (Vitest)** | 🟢 **41/41 tests pass** | 6 archivos de prueba en `src/app/api/misiones` y `src/modules/misiones` pasando |
| **Compilación de Producción (`npm run build`)** | 🟢 **Compilación exitosa** | Next.js 16.3.4 compila sin errores de TypeScript |
| **Sincronización con rama principal `develop`** | 🔴 **Desfasada (56 commits detrás)** | Colisión en migración `033_mision_hito_bitacora.ts` con `033_patrullas_codigo_vehiculo.ts` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H21-API-01`: Condición de Carrera (TOCTOU) por Ausencia de Bloqueo Pesimista (`FOR UPDATE`), Actualizaciones sin Precondición de Estado y Colisión Concurrente de `mision.codigo` (`23505`)
* **Severidad:** **CRÍTICA** (Concurrencia, Integridad Transaccional y Consistencia Operativa ICS).
* **Estado Actual:** 🔴 **ABIERTO / FALLIDO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 318-354, 411-443 y 531-550).
* **Descripción Técnica:**  
  1. En `asignarCuadrillaIncidenteRepo`, las consultas iniciales a las tablas `incidente` (líneas 411-415) y `cuadrilla` (líneas 428-433) dentro de `db.transaction()` se ejecutan mediante `SELECT` ordinario sin bloqueo pesimista `.forUpdate()`. Asimismo, las sentencias `updateTable("cuadrilla")` (líneas 532-540) y `updateTable("incidente")` (líneas 543-550) no incluyen precondición de estado en la cláusula `WHERE` (`.where("estado", "=", "DISPONIBLE")` y `.where("estado", "in", ["REPORTADO", "VERIFICANDO"])`) ni verifican la fila afectada mediante `.returning()`. Bajo el nivel de aislamiento por defecto de PostgreSQL (`READ COMMITTED`), dos peticiones simultáneas permiten despachar dos cuadrillas distintas a un mismo incidente o asignar una misma cuadrilla a dos emergencias simultáneamente.
  2. La función `generarSiguienteCodigoMision(trx)` (líneas 318-354) descarga todos los códigos del año en memoria y verifica existencia sin adquirir un bloqueo consultivo transaccional (`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`). Ante dos asignaciones concurrentes, ambas transacciones leen el mismo máximo correlativo, generan idéntico `codigoCandidato` y al ejecutar el `INSERT INTO mision` una de ellas falla con error PostgreSQL `23505` (`unique_violation` sobre `mision_codigo_key`), provocando un `500 Internal Server Error`.
* **Pasos para Reproducir:**
  1. Disponer de un incidente en estado `'REPORTADO'` y una cuadrilla en estado `'DISPONIBLE'`.
  2. Ejecutar dos peticiones `POST /api/misiones` concurrentes (`Promise.all`) asignando la cuadrilla o despachando dos cuadrillas sobre el mismo incidente.
* **Comportamiento Actual:** Ambas transacciones superan las lecturas iniciales sin bloqueo; se produce doble asignación o fallo `500 Internal Server Error` por violación de clave única `mision_codigo_key`.
* **Comportamiento Esperado:** La primera transacción debe adquirir el bloqueo de fila y completar el despacho (`201 Created`), mientras que la segunda debe ser rechazada controladamente con `409 Conflict` (`ConflictError`). La generación de `mision.codigo` debe serializarse mediante `pg_advisory_xact_lock`.
* **Sugerencia Técnica de Corrección:**
  - Añadir `.forUpdate()` en las lecturas iniciales de `incidente` y `cuadrilla`.
  - Condicionar `updateTable("cuadrilla").where("id", "=", input.cuadrillaId).where("estado", "=", "DISPONIBLE").returning("id").executeTakeFirst()` y `updateTable("incidente").where("id", "=", input.incidenteId).where("estado", "in", ["REPORTADO", "VERIFICANDO"]).returning("id").executeTakeFirst()`, lanzando `ConflictError` si no retornan registro.
  - Invocar `await sql`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.execute(trx)` al inicio de `generarSiguienteCodigoMision(trx)`.

---

### `BUG-H21-API-02`: Desfase de Rama respecto a `develop` (56 Commits), Colisión de Correlativo en Migración Kysely (`033_`), Omisión de Validación `cuadrilla.activo = true` y Fallo de ESLint
* **Severidad:** **CRÍTICA** (Integración Continua, Secuencia de Migraciones Kysely y Sincronización con `develop`).
* **Estado Actual:** 🔴 **ABIERTO / FALLIDO**.
* **Archivos Afectados:**
  * `src/lib/db/migrations/033_mision_hito_bitacora.ts`
  * `src/modules/misiones/mision.repository.ts` (Líneas 428-437)
  * `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts` (Línea 374)
  * `src/modules/misiones/__tests__/mision.schema.test.ts` (Línea 8)
* **Descripción Técnica:**  
  1. La rama `feature/h21-asignar-cuadrilla` se encuentra 56 commits por detrás de `develop`. En `develop` ya fueron integradas las migraciones `027_cuadrilla_auditoria_y_unicidad.ts`, `032_cuadrilla_baja_logica_activo.ts`, `033_patrullas_codigo_vehiculo.ts` y `034_patrulla_desactivacion_baja_logica.ts`. El archivo `033_mision_hito_bitacora.ts` colisiona en su prefijo numérico `033_` con `033_patrullas_codigo_vehiculo.ts`.
  2. Debido a la falta de sincronización con HU-82 (`032_cuadrilla_baja_logica_activo.ts`), la consulta de cuadrilla en `asignarCuadrillaIncidenteRepo` (`mision.repository.ts:428-433`) solo verifica `.where("eliminado_en", "is", null)` y no valida `.where("activo", "=", true)`, permitiendo despachar cuadrillas desactivadas lógicamente si su columna `estado` permaneció en `'DISPONIBLE'`.
  3. El comando `npm run lint` falla con código de salida `1` debido a `error: Unexpected any. Specify a different type @typescript-eslint/no-explicit-any` en `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts:374` y warning por importación sin uso `AsignarCuadrillaMisionResponseSchema` en `src/modules/misiones/__tests__/mision.schema.test.ts:8`.
* **Pasos para Reproducir:**
  1. Ejecutar `git log HEAD..develop --oneline` y listar `src/lib/db/migrations/` frente a `develop`.
  2. Ejecutar `npm run lint`.
* **Comportamiento Actual:** Desfase de 56 commits con colisión de migración `033_` y fallo en el linter (`exit code 1`).
* **Comportamiento Esperado:** La rama debe estar sincronizada con `develop`, la migración de `mision_hito` debe tener correlativo único posterior a las migraciones existentes en `develop` (o unificarse con la migración `034_mision_hito_bitacora.ts` de HU-20 según orden de fusión), `asignarCuadrillaIncidenteRepo` debe filtrar `.where("activo", "=", true)` y `npm run lint` debe finalizar con `0 errors`.
* **Sugerencia Técnica de Corrección:**
  - Integrar `develop` en la rama (`git merge develop`), renumerar la migración al correlativo correspondiente (`035_mision_hito_bitacora.ts` tras `034_patrulla_desactivacion_baja_logica.ts`), añadir `.where("activo", "=", true)` en la consulta de `cuadrilla` y eliminar la importación no usada en `mision.schema.test.ts`.

---

### `BUG-H21-API-03`: Liberación Indebida de Patrulla Reasignada, Sobrescritura de `fecha_cierre` y Duplicación de Hito cuando la Misión de Verificación Previa ya estaba en Estado `'COMPLETADA'`
* **Severidad:** **ALTA** (Violación de Regla de Negocio ICS §3.2 e Integridad Histórica de Bitácora).
* **Estado Actual:** 🔴 **ABIERTO / FALLIDO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 446-462 y 568-601).
* **Descripción Técnica:**  
  En `asignarCuadrillaIncidenteRepo`, la consulta `misionVerificacionActiva` (línea 460) incluye misiones en estado `'COMPLETADA'`:
  ```typescript
  .where("mision.incidente_id", "=", input.incidenteId)
  .where("mision.tipo_mision", "=", "VERIFICACION")
  .where("mision.estado", "in", ["DESPACHADA", "EN_CURSO", "COMPLETADA"])
  ```
  Posteriormente, el bloque del paso 10 (líneas 568-601) ejecuta de manera incondicional sobre `misionVerificacionActiva`:
  1. `updateTable("mision").set({ estado: "COMPLETADA", fecha_cierre: sql`CURRENT_TIMESTAMP` })`: Si la misión de verificación ya estaba en `'COMPLETADA'` (cerrada previamente al finalizar la evaluación en terreno), sobrescribe su `fecha_cierre` original con la hora actual del despacho de cuadrilla, adulterando los tiempos operativos de respuesta.
  2. Inserta un nuevo registro `'VERIFICACION_FINALIZADA'` en `mision_hito` aunque la misión ya hubiese sido cerrada anteriormente.
  3. Ejecuta incondicionalmente `updateTable("patrulla_verificadora").set({ estado: "DISPONIBLE" }).where("id", "=", misionVerificacionActiva.patrulla_id)` sin comprobar si dicha patrulla ya había sido liberada y **reasignada a una nueva misión activa (`DESPACHADA` o `EN_CURSO`) en otro incidente distinto** (o si pasó a `'NO_DISPONIBLE'`). Si la patrulla ya se encontraba verificando un segundo incidente, el despacho de cuadrilla en el primer incidente fuerza erróneamente su estado a `'DISPONIBLE'` mientras está desplegada en terreno.
* **Pasos para Reproducir:**
  1. Tener un Incidente A en estado `'VERIFICANDO'` cuya misión de verificación (`MIS-1`) con la Patrulla P1 ya fue marcada como `'COMPLETADA'`.
  2. Asignar la Patrulla P1 a una nueva misión de verificación (`MIS-2`, estado `'EN_CURSO'`) en un Incidente B (quedando Patrulla P1 en estado `'EN_VERIFICACION'`).
  3. Despachar una cuadrilla operativa al Incidente A mediante `POST /api/misiones`.
* **Comportamiento Actual:** `POST /api/misiones` sobrescribe `fecha_cierre` de `MIS-1` y cambia el estado de la Patrulla P1 a `'DISPONIBLE'`, pese a que la Patrulla P1 tiene la misión `MIS-2` activa en el Incidente B.
* **Comportamiento Esperado:** Solo se debe cerrar la misión e insertar el hito `'VERIFICACION_FINALIZADA'` si `misionVerificacionActiva.mision_estado !== "COMPLETADA"`. Asimismo, antes de actualizar `patrulla_verificadora.estado = 'DISPONIBLE'`, se debe verificar que la patrulla no posea otra misión activa (`estado IN ('DESPACHADA', 'EN_CURSO')`) en curso ni se encuentre en `'NO_DISPONIBLE'`.
* **Sugerencia Técnica de Corrección:**
  ```typescript
  if (misionVerificacionActiva) {
    if (misionVerificacionActiva.mision_estado !== "COMPLETADA") {
      await trx
        .updateTable("mision")
        .set({
          estado: "COMPLETADA",
          fecha_cierre: sql`CURRENT_TIMESTAMP`,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", misionVerificacionActiva.mision_id)
        .execute();

      const hitoPatrullaRow = await trx
        .insertInto("mision_hito")
        .values({
          mision_id: misionVerificacionActiva.mision_id,
          hito: "VERIFICACION_FINALIZADA",
          descripcion: "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
          registrado_por_id: usuarioId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      hitoPatrulla = {
        id: hitoPatrullaRow.id,
        misionId: hitoPatrullaRow.mision_id,
        hito: hitoPatrullaRow.hito,
        descripcion: hitoPatrullaRow.descripcion,
        creadoEn: new Date(hitoPatrullaRow.creado_en).toISOString(),
      };
    }

    const otraMisionActivaPatrulla = await trx
      .selectFrom("mision")
      .select("id")
      .where("patrulla_id", "=", misionVerificacionActiva.patrulla_id)
      .where("id", "!=", misionVerificacionActiva.mision_id)
      .where("estado", "in", ["DESPACHADA", "EN_CURSO"])
      .executeTakeFirst();

    if (!otraMisionActivaPatrulla && misionVerificacionActiva.patrulla_estado !== "NO_DISPONIBLE") {
      await trx
        .updateTable("patrulla_verificadora")
        .set({
          estado: "DISPONIBLE",
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", misionVerificacionActiva.patrulla_id)
        .execute();

      patrullaLiberada = {
        id: misionVerificacionActiva.patrulla_id,
        nombre: misionVerificacionActiva.patrulla_nombre,
        estado: "DISPONIBLE",
        misionPreviaId: misionVerificacionActiva.mision_id,
      };
    }
  }
  ```

---

### `BUG-H21-API-04`: Bypass de Autenticación JWT mediante Cabecera `x-user-id` No Verificada en `POST /api/misiones` y Omisión de Validación de Usuario Activo (`usuario.activo = true`)
* **Severidad:** **ALTA** (Seguridad, Autenticación JWT y Control de Acceso RBAC).
* **Estado Actual:** 🔴 **ABIERTO / FALLIDO**.
* **Archivos Afectados:**
  * `src/app/api/misiones/route.ts` (Líneas 94-106)
  * `src/modules/seguridad/auth.service.ts` (Líneas 23-32)
* **Descripción Técnica:**  
  1. En `POST /api/misiones` (`src/app/api/misiones/route.ts:94-96`), el controlador acepta una cabecera plana `x-user-id` cuando no se envía un token Bearer:
     ```typescript
     const tokenUserId = await extraerUsuarioId(request);
     const headerUserId = request.headers.get("x-user-id");
     const usuarioId = tokenUserId || headerUserId;
     ```
     Cualquier cliente externo no autenticado puede omitir la cabecera `Authorization: Bearer <token>` y enviar `x-user-id: 00000000-0000-4000-8000-000000000001` (UUID del Administrador o Encargado), suplantando su identidad y eludiendo por completo la verificación criptográfica JWT.
  2. Adicionalmente, la función `verificarPermiso` (`src/modules/seguridad/auth.service.ts:23-32`) consulta la tabla `usuario` sin verificar que `usuario.activo === true`, permitiendo que cuentas de usuarios deshabilitados o dados de baja lógica en la institución continúen despachando cuadrillas operativas.
* **Pasos para Reproducir:**
  1. Enviar una petición `POST /api/misiones` sin cabecera `Authorization`, incluyendo únicamente `-H "x-user-id: 00000000-0000-4000-8000-000000000001"`.
  2. O bien, enviar un token de un usuario con `activo = false` y rol Encargado.
* **Comportamiento Actual:** La API autoriza la operación y ejecuta el despacho sin verificar firma JWT ni estado activo del usuario.
* **Comportamiento Esperado:** `POST /api/misiones` debe exigir un token JWT válido mediante `extraerUsuarioId(request)` y validar el permiso `'misiones:asignar'` y la vigencia del funcionario (`usuario.activo === true`) a través de `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_ASIGNAR_MISION])`.
* **Sugerencia Técnica de Corrección:**
  - En `src/app/api/misiones/route.ts`, reemplazar el uso de `x-user-id` y `verificarPermiso` por `extraerUsuarioId(request)` seguido de `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_ASIGNAR_MISION])` (y en `verificarPermiso` de `auth.service.ts`, validar `if (!usuario.activo) throw new UnauthorizedError("El usuario especificado se encuentra inactivo en la institución.")`).

---

### `BUG-H21-API-05`: Omisión de Lectura de `mision_hito` en `GET /api/misiones/{id}` y Difusión Incompleta de Eventos WebSocket (`cuadrilla:actualizada` y Salas en Redis Pub/Sub)
* **Severidad:** **MEDIA** (Trazabilidad de Bitácora y Sincronización en Tiempo Real).
* **Estado Actual:** 🔴 **ABIERTO / FALLIDO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 112-307)
  * `src/modules/misiones/mision.service.ts` (Líneas 50-92 y 253-295)
  * `src/lib/socket/index.ts` (Líneas 169-198, 567-580 y 634-671)
* **Descripción Técnica:**  
  1. Si bien `asignarCuadrillaIncidenteRepo` inserta los hitos `'CUADRILLA_DESPACHADA'` y `'VERIFICACION_FINALIZADA'` en la tabla `mision_hito`, la función `obtenerMisionDetallePorIdRepo` (`mision.repository.ts:112-307`) nunca consulta la tabla `mision_hito`. En consecuencia, al consultar `GET /api/misiones/{id}`, el arreglo `bitacoraTiempos` jamás incluye los hitos reales almacenados en `mision_hito`.
  2. En `asignarCuadrillaMisionService` (`mision.service.ts:253-295`), al cambiar el estado de la cuadrilla a `'EN_MISION'`, no se invoca `emitirCuadrillaActualizada`, impidiendo que los tableros de recursos actualicen en vivo la disponibilidad de la cuadrilla.
  3. En `src/lib/socket/index.ts`:
     - `notificarPatrullaLiberada` emite a `[patrullaRoom, "encargado", "supervisor"]`, omitiendo `"sala:encargados"`.
     - `notificarIncidenteActualizado` emite únicamente a `"sala:encargados"`, omitiendo `"encargado"` y `"mapa"`.
     - `notificarPatrullaActualizada` en modo Redis Pub/Sub (líneas 568-579) publica exclusivamente en la sala `"encargado"`, omitiendo `"sala:encargados"`, `"supervisor"`, `"mapa"` y `patrulla:${payload.patrullaId}`.
* **Pasos para Reproducir:**
  1. Despachar una cuadrilla con `POST /api/misiones` y consultar `GET /api/misiones/{id}` para la misión creada o la misión de verificación cerrada.
  2. Inspeccionar las salas notificadas en `src/lib/socket/index.ts` y `src/modules/misiones/mision.service.ts`.
* **Comportamiento Actual:** `bitacoraTiempos` en `GET /api/misiones/{id}` no muestra `'CUADRILLA_DESPACHADA'` ni `'VERIFICACION_FINALIZADA'`, y las salas de Socket.io/Redis reciben difusión parcial.
* **Comportamiento Esperado:** `obtenerMisionDetallePorIdRepo` debe consultar `mision_hito` e integrarlo en `bitacoraTiempos`; `asignarCuadrillaMisionService` debe emitir `emitirCuadrillaActualizada`; y los emisores de Socket.io deben publicar consistentemente en todas las salas operativas tanto en memoria como por Redis Pub/Sub.
* **Sugerencia Técnica de Corrección:**
  - Incorporar la consulta a `mision_hito` en `obtenerMisionDetallePorIdRepo` y mapear sus filas en `obtenerDetalleMisionService`.
  - Invocar `emitirCuadrillaActualizada` en `asignarCuadrillaMisionService`.
  - Unificar el arreglo de salas en `notificarPatrullaLiberada`, `notificarPatrullaActualizada` y `notificarIncidenteActualizado` tanto para `ioInstance` como para `redisPublisher`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `CP-H21-API-01` | Control de concurrencia ante doble despacho simultáneo sobre el mismo incidente o cuadrilla y serialización de `mision.codigo` | Concurrencia / ACID | Repository / DB | Crítica | Incidente en estado `REPORTADO` y cuadrilla en estado `DISPONIBLE` | 2 peticiones `POST /api/misiones` concurrentes (`Promise.all`) sobre el mismo `incidenteId` / `cuadrillaId` | Bloqueo pesimista `.forUpdate()`, validación de estado en `UPDATE` y `pg_advisory_xact_lock`; la primera retorna `201 Created` y la segunda `409 Conflict` | `asignarCuadrillaIncidenteRepo` carece de `.forUpdate()`, no valida estado previo en `UPDATE` ni usa bloqueo consultivo en `generarSiguienteCodigoMision` (`BUG-H21-API-01`) | **FALLIDO** | 09/11/2026 16:45 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H21-API-02` | Sincronización con rama `develop`, correlativo único de migración Kysely, filtro `cuadrilla.activo = true` y ejecución limpia de `npm run lint` | Integridad / CI | DB / Build | Crítica | Rama actualizada con `develop` y linter ejecutado | `git log HEAD..develop`, inspección de `src/lib/db/migrations/` y `npm run lint` | Rama al día con `develop`, migración sin colisión de prefijo numérico, filtro `activo = true` en cuadrilla y `0 errors` en ESLint | Rama 56 commits detrás de `develop`, colisión en `033_mision_hito_bitacora.ts` con `033_patrullas_codigo_vehiculo.ts`, falta `.where("activo", "=", true)` y 1 error ESLint (`BUG-H21-API-02`) | **FALLIDO** | 09/11/2026 16:46 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H21-API-03` | Protección de patrulla verificadora ya liberada y reasignada a otro incidente cuando la misión de verificación previa ya estaba `COMPLETADA` | Regla de Negocio / ICS | Repository | Alta | Incidente A con misión de verificación `COMPLETADA` cuya patrulla P1 ya fue asignada a misión `EN_CURSO` en Incidente B | `POST /api/misiones` despachando cuadrilla al Incidente A | No sobrescribe `fecha_cierre` de la misión ya `COMPLETADA`, no duplica hito y no cambia a `DISPONIBLE` una patrulla activa en otro incidente | Sobrescribe `fecha_cierre`, duplica `VERIFICACION_FINALIZADA` y fuerza `patrulla_verificadora.estado = 'DISPONIBLE'` aunque la patrulla atienda otro incidente (`BUG-H21-API-03`) | **FALLIDO** | 09/11/2026 16:47 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H21-API-04` | Prohibición de bypass de autenticación JWT mediante cabecera plana `x-user-id` y bloqueo de usuarios con `activo = false` | Seguridad / Auth | Route / Service | Alta | Petición sin `Authorization: Bearer <token>` usando solo `x-user-id` o token de usuario inactivo | `POST /api/misiones` con header `x-user-id: 00000000-0000-4000-8000-000000000001` sin Bearer JWT | `HTTP 401 Unauthorized` rechazando cabeceras no firmadas y usuarios inactivos (`activo = false`) | `route.ts` acepta `x-user-id` sin JWT y `verificarPermiso` no comprueba `usuario.activo === true` (`BUG-H21-API-04`) | **FALLIDO** | 09/11/2026 16:48 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H21-API-05` | Exposición de hitos de `mision_hito` en `GET /api/misiones/{id}` y difusión completa de eventos WebSocket (`cuadrilla:actualizada` y salas Redis) | Integración / Socket | Service / Repo / Socket | Media | Misión creada y patrulla liberada mediante `POST /api/misiones` | `GET /api/misiones/{id}` e inspección de `mision.service.ts` y `src/lib/socket/index.ts` | `bitacoraTiempos` incluye hitos de `mision_hito`; se emite `cuadrilla:actualizada` y todas las salas reciben eventos en memoria y Redis | `obtenerMisionDetallePorIdRepo` no consulta `mision_hito`; no se emite `cuadrilla:actualizada` y faltan salas en Redis Pub/Sub (`BUG-H21-API-05`) | **FALLIDO** | 09/11/2026 16:49 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H21-API-06` | Consulta de selector de cuadrillas operativas filtrando únicamente estado `DISPONIBLE` (CA-1 y CA-2) | Funcional / API | Route / Service | Alta | Cuadrillas registradas en estados `DISPONIBLE`, `EN_MISION` y `NO_DISPONIBLE` | `GET /api/cuadrillas?estado=DISPONIBLE` con `Authorization: Bearer <token_encargado>` | `HTTP 200 OK` retornando exclusivamente cuadrillas con `estado: "DISPONIBLE"` | Retorna `HTTP 200 OK` con 1 cuadrilla en estado `DISPONIBLE` (`delta`), excluyendo unidades en misión o no disponibles | **APROBADO** | 09/11/2026 16:51 | - | fix(cuadrillas): habilitar leftJoin en consulta de cuadrillas y sembrar cuadrillas con delegados (HU-21) |
| `CP-H21-API-07` | Rechazo de petición `POST /api/misiones` sin credenciales de autenticación (`401 Unauthorized`) | Seguridad / Auth | Route Handler | Crítica | Petición HTTP sin cabecera `Authorization` | `POST /api/misiones` con body JSON válido sin headers de autenticación | `HTTP 401 Unauthorized` con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | Retorna `HTTP 401 Unauthorized` con el mensaje esperado | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-08` | Control de acceso RBAC denegando despacho a rol sin permiso `misiones:asignar` (`403 Forbidden` — CA-7) | Seguridad / RBAC | Route / Service | Crítica | Usuario autenticado con rol `CALL_CENTER` (`callcenter@valdivia.cl`) | `POST /api/misiones` con `Authorization: Bearer <token_callcenter>` | `HTTP 403 Forbidden` indicando falta del permiso `misiones:asignar` | Retorna `HTTP 403 Forbidden` con `"message": "No cuenta con el permiso requerido: misiones:asignar"` | **APROBADO** | 09/11/2026 16:51 | - | feat(seguridad): registrar permiso misiones:asignar (HU-21) |
| `CP-H21-API-09` | Autorización exitosa de despacho para rol `ENCARGADO` con permiso `misiones:asignar` (CA-7) | Seguridad / RBAC | Route / Service | Alta | Usuario autenticado con rol `ENCARGADO` (`encargado@valdivia.cl`) | `POST /api/misiones` con `Authorization: Bearer <token_encargado>` | Acceso autorizado hacia la capa de servicio de misiones | Permiso `misiones:asignar` verificado y autorizado satisfactoriamente | **APROBADO** | 09/11/2026 16:51 | - | feat(seguridad): registrar permiso misiones:asignar (HU-21) |
| `CP-H21-API-10` | Rechazo de cuerpo de petición con sintaxis JSON malformada (`400 Bad Request`) | Validación / Input | Route Handler | Media | Usuario con permiso `misiones:asignar` | `POST /api/misiones` con body `"json-invalido{"` | `HTTP 400 Bad Request` con mensaje `"El cuerpo de la petición debe ser un formato JSON válido."` | Retorna `HTTP 400 Bad Request` capturando la excepción de parseo JSON | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-11` | Validación Zod de literal `tipoMision: "ATENCION_CUADRILLA"` y formato UUID en `incidenteId` y `cuadrillaId` (`400 Bad Request`) | Validación / Schema | Route / Zod | Alta | Usuario con permiso `misiones:asignar` | `{"tipoMision":"VERIFICACION","incidenteId":"uuid-invalido","cuadrillaId":"123"}` | `HTTP 400 Bad Request` detallando errores por campo en el arreglo `errors` | Retorna `HTTP 400 Bad Request` con 3 errores estructurados para `tipoMision`, `incidenteId` y `cuadrillaId` | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-12` | Validación Zod de límites de longitud en campos opcionales `titulo` (3..150) y `descripcion` (máx. 1000) | Validación / Schema | Zod Schema | Media | Esquema `AsignarCuadrillaMisionInputSchema` | `titulo: "AB"` (2 caracteres) o `descripcion` > 1000 caracteres | Rechazo de validación con mensaje `"El título debe contener al menos 3 caracteres."` | Esquema Zod rechaza longitudes fuera de rango con los mensajes configurados | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-13` | Manejo de incidente inexistente en base de datos (`404 Not Found`) | Robustez / DAL | Repository | Alta | UUID de incidente no registrado en tabla `incidente` | `incidenteId: "99999999-9999-4999-8999-999999999999"` | `HTTP 404 Not Found` con mensaje `"No se encontró ningún incidente con el identificador proporcionado."` | Retorna `HTTP 404 Not Found` mediante `NotFoundError` | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-14` | Manejo de cuadrilla operativa inexistente o eliminada lógicamente (`404 Not Found`) | Robustez / DAL | Repository | Alta | UUID de cuadrilla inexistente o con `eliminado_en IS NOT NULL` | `cuadrillaId: "99999999-9999-4999-8999-999999999999"` | `HTTP 404 Not Found` con mensaje `"No se encontró ninguna cuadrilla con el identificador proporcionado."` | Retorna `HTTP 404 Not Found` al no encontrar cuadrilla activa | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-15` | Bloqueo de despacho sobre incidente en estado no apto (`EN_ATENCION`, `RESUELTO` o `NO_ABORDABLE`) (`409 Conflict` — CA-1) | Regla de Negocio / ICS | Repository | Crítica | Incidente `a1000000-0000-4000-8000-000000000004` en estado `EN_ATENCION` | `POST /api/misiones` con `incidenteId` en estado `EN_ATENCION` | `HTTP 409 Conflict` indicando que solo se admiten incidentes en `REPORTADO` o `VERIFICANDO` | Retorna `HTTP 409 Conflict` bloqueando la asignación sobre incidente ya en atención | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-16` | Bloqueo de despacho cuando la cuadrilla seleccionada se encuentra en estado `EN_MISION` o `NO_DISPONIBLE` (`409 Conflict` — CA-2) | Regla de Negocio / ICS | Repository | Crítica | Cuadrilla `c1000000-0000-4000-8000-000000000001` en estado `EN_MISION` | `POST /api/misiones` con `cuadrillaId` en estado `EN_MISION` | `HTTP 409 Conflict` indicando que la cuadrilla no está disponible para asignación | Retorna `HTTP 409 Conflict` con `"message": "La cuadrilla 'Cuadrilla Aguas Lluvias Alfa' no está disponible para asignación (estado actual: 'EN_MISION')..."` | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-17` | Bloqueo `409 Conflict` con código `VERIFICACION_EN_CURSO` si el incidente está en `VERIFICANDO` pero la patrulla aún no emite evaluación técnica | Regla de Negocio / ICS | Repository | Crítica | Incidente `a1000000-0000-4000-8000-000000000003` en `VERIFICANDO` con misión `d1000000-0000-4000-8000-000000000001` sin reporte ni hito de evaluación | `POST /api/misiones` sobre incidente en verificación activa sin diagnóstico | `HTTP 409 Conflict` con `codigo: "VERIFICACION_EN_CURSO"` y objeto `detalles` identificando la patrulla y misión activa | Retorna `HTTP 409 Conflict` con `codigo: "VERIFICACION_EN_CURSO"`, `patrullaNombre: "Patrulla Rápida Costa-1"` y `estadoMision: "EN_CURSO"` | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): validar evaluacion tecnica previa de patrulla y estructurar error VERIFICACION_EN_CURSO (HU-21) |
| `CP-H21-API-18` | Despacho atómico de cuadrilla y liberación automática de patrulla verificadora previa según Regla ICS §3.2 (`201 Created` — CA-3 y CA-4) | Transacción / ICS | Repository / DB | Crítica | Incidente en `VERIFICANDO` con evaluación técnica registrada y cuadrilla `DISPONIBLE` | `POST /api/misiones` con `incidenteId: "a1000000-0000-4000-8000-000000000003"` y `cuadrillaId: "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"` | `HTTP 201 Created`: crea misión `ATENCION_CUADRILLA` (`DESPACHADA`), pasa cuadrilla a `EN_MISION`, incidente a `EN_ATENCION`, cierra misión previa (`COMPLETADA`), libera patrulla a `DISPONIBLE` y crea hitos `CUADRILLA_DESPACHADA` y `VERIFICACION_FINALIZADA` | Retorna `HTTP 201 Created` con la transacción completa y todos los estados e hitos actualizados atómicamente | **APROBADO** | 09/11/2026 16:51 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-19` | Despacho directo de cuadrilla a incidente en estado `REPORTADO` sin patrulla verificadora previa (`patrullaLiberada: null`) | Funcional / ICS | Service / Repo | Alta | Incidente en estado `REPORTADO` sin misión de verificación previa y cuadrilla `DISPONIBLE` | `POST /api/misiones` sobre incidente `REPORTADO` sin título ni prioridad explícita | `HTTP 201 Created`: autogenera título, hereda prioridad del incidente, retorna `patrullaLiberada: null` y `hitoPatrulla: null` | Crea misión `ATENCION_CUADRILLA` en estado `DESPACHADA` con `patrullaLiberada: null` y sin emitir `patrulla:liberada` | **APROBADO** | 09/11/2026 16:45 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-20` | Herencia automática de prioridad desde la misión de verificación activa o desde el incidente cuando se omite en el payload | Regla de Negocio | Repository | Media | Misión de verificación con prioridad `CRITICA` y payload sin atributo `prioridad` | `POST /api/misiones` omitiendo `prioridad` | La misión creada para la cuadrilla hereda `prioridad: "CRITICA"` | Hereda correctamente la prioridad de la misión de verificación o del incidente | **APROBADO** | 09/11/2026 16:45 | - | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-21` | Emisión de eventos WebSocket `mision:asignada`, `patrulla:liberada` e `incidente:actualizado` al confirmar despacho (CA-5) | Tiempo Real / Socket | Service / Socket | Alta | Despacho exitoso con liberación de patrulla verificadora | Ejecución de `asignarCuadrillaMisionService` | Invoca `notificarMisionAsignada`, `notificarPatrullaLiberada`, `notificarPatrullaActualizada` y `notificarIncidenteActualizado` | Los 4 métodos emisores son invocados con los payloads esperados en el servicio | **APROBADO** | 09/11/2026 16:45 | - | feat(socket): incorporar evento patrulla:liberada y emisores de misiones (HU-21) |
| `CP-H21-API-22` | Transición de incidente a columna `EN_ATENCION` e indicador `verificado` en listado Kanban (`GET /api/incidentes` — CA-6) | Integración / Kanban | Repository / Service | Alta | Incidente actualizado a `EN_ATENCION` o con verificación completada | `GET /api/incidentes?estado=EN_ATENCION` | El incidente figura en la columna `EN_ATENCION` con el atributo booleano `verificado` expuesto en el esquema Kanban | `incidente-kanban.schema.ts` y `incidente-kanban.repository.ts` exponen el campo `verificado` y ordenan prioritariamente | **APROBADO** | 09/11/2026 16:45 | - | feat(incidentes): agregar campo verificado y ordenamiento prioritario en kanban |
| `CP-H21-API-23` | Estructura de tabla `mision_hito` e índices de rendimiento en migración Kysely (CA-4) | Base de Datos / DDL | Migration | Alta | Migración de bitácora de hitos de misión | Inspección de DDL de tabla `mision_hito` y `src/lib/db/types.ts` | Tabla `mision_hito` con FK `mision_id` (`ON DELETE CASCADE`), `hito`, `descripcion`, `registrado_por_id`, `latitud`, `longitud`, `creado_en` e índices `idx_mision_hito_mision_id` e `idx_mision_hito_creado_en` | Esquema físico y tipos Kysely (`MisionHitoTable`) definidos con claves foráneas e índices | **APROBADO** | 09/11/2026 16:45 | - | feat(db): agregar tabla y migracion mision_hito para bitacora de misiones (HU-21) |
| `CP-H21-API-24` | Registro del contrato `POST /api/misiones` y esquemas `AsignarCuadrillaMisionInput` / `AsignarCuadrillaMisionResponse` en OpenAPI 3.0 | Contrato API | OpenAPI Spec | Media | Generador `generarOpenApiSpec()` en `src/lib/openapi/index.ts` | `GET /openapi.json` | Especificación OpenAPI v0.10.0 expone `POST /api/misiones` con respuestas `201`, `400`, `401`, `403`, `404`, `409` y `500` | Ruta y esquemas registrados y validados en suite de pruebas de OpenAPI | **APROBADO** | 09/11/2026 16:45 | - | docs(api): documentar endpoint POST /api/misiones y regla de negocio §3.2 (HU-21) |
| `CP-H21-API-25` | Ejecución de suite automatizada de pruebas unitarias e integración para el módulo de Misiones en Vitest | Automatización | Unit / Integration | Alta | Entorno de pruebas Vitest v3.2.7 | `npm test -- src/app/api/misiones src/modules/misiones` | 100% de los tests del módulo de misiones aprobados sin errores | 6 archivos de prueba y 41 tests aprobados en 764ms | **APROBADO** | 09/11/2026 16:45 | - | test(misiones): agregar pruebas unitarias e integracion para asignacion de cuadrillas y liberacion (HU-21) |

---

## 4. Exportación Tabular de Casos de Prueba (TSV)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
CP-H21-API-01	Control de concurrencia ante doble despacho simultáneo sobre el mismo incidente o cuadrilla y serialización de mision.codigo	Concurrencia / ACID	Repository / DB	Crítica	Incidente en estado REPORTADO y cuadrilla en estado DISPONIBLE	2 peticiones POST /api/misiones concurrentes (Promise.all) sobre el mismo incidenteId / cuadrillaId	Bloqueo pesimista .forUpdate(), validación de estado en UPDATE y pg_advisory_xact_lock; la primera retorna 201 Created y la segunda 409 Conflict	asignarCuadrillaIncidenteRepo carece de .forUpdate(), no valida estado previo en UPDATE ni usa bloqueo consultivo en generarSiguienteCodigoMision (BUG-H21-API-01)	FALLIDO	09/11/2026 16:45	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H21-API-02	Sincronización con rama develop, correlativo único de migración Kysely, filtro cuadrilla.activo = true y ejecución limpia de npm run lint	Integridad / CI	DB / Build	Crítica	Rama actualizada con develop y linter ejecutado	git log HEAD..develop, inspección de src/lib/db/migrations/ y npm run lint	Rama al día con develop, migración sin colisión de prefijo numérico, filtro activo = true en cuadrilla y 0 errors en ESLint	Rama 56 commits detrás de develop, colisión en 033_mision_hito_bitacora.ts con 033_patrullas_codigo_vehiculo.ts, falta .where("activo", "=", true) y 1 error ESLint (BUG-H21-API-02)	FALLIDO	09/11/2026 16:46	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H21-API-03	Protección de patrulla verificadora ya liberada y reasignada a otro incidente cuando la misión de verificación previa ya estaba COMPLETADA	Regla de Negocio / ICS	Repository	Alta	Incidente A con misión de verificación COMPLETADA cuya patrulla P1 ya fue asignada a misión EN_CURSO en Incidente B	POST /api/misiones despachando cuadrilla al Incidente A	No sobrescribe fecha_cierre de la misión ya COMPLETADA, no duplica hito y no cambia a DISPONIBLE una patrulla activa en otro incidente	Sobrescribe fecha_cierre, duplica VERIFICACION_FINALIZADA y fuerza patrulla_verificadora.estado = 'DISPONIBLE' aunque la patrulla atienda otro incidente (BUG-H21-API-03)	FALLIDO	09/11/2026 16:47	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H21-API-04	Prohibición de bypass de autenticación JWT mediante cabecera plana x-user-id y bloqueo de usuarios con activo = false	Seguridad / Auth	Route / Service	Alta	Petición sin Authorization: Bearer <token> usando solo x-user-id o token de usuario inactivo	POST /api/misiones con header x-user-id: 00000000-0000-4000-8000-000000000001 sin Bearer JWT	HTTP 401 Unauthorized rechazando cabeceras no firmadas y usuarios inactivos (activo = false)	route.ts acepta x-user-id sin JWT y verificarPermiso no comprueba usuario.activo === true (BUG-H21-API-04)	FALLIDO	09/11/2026 16:48	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H21-API-05	Exposición de hitos de mision_hito en GET /api/misiones/{id} y difusión completa de eventos WebSocket (cuadrilla:actualizada y salas Redis)	Integración / Socket	Service / Repo / Socket	Media	Misión creada y patrulla liberada mediante POST /api/misiones	GET /api/misiones/{id} e inspección de mision.service.ts y src/lib/socket/index.ts	bitacoraTiempos incluye hitos de mision_hito; se emite cuadrilla:actualizada y todas las salas reciben eventos en memoria y Redis	obtenerMisionDetallePorIdRepo no consulta mision_hito; no se emite cuadrilla:actualizada y faltan salas en Redis Pub/Sub (BUG-H21-API-05)	FALLIDO	09/11/2026 16:49	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H21-API-06	Consulta de selector de cuadrillas operativas filtrando únicamente estado DISPONIBLE (CA-1 y CA-2)	Funcional / API	Route / Service	Alta	Cuadrillas registradas en estados DISPONIBLE, EN_MISION y NO_DISPONIBLE	GET /api/cuadrillas?estado=DISPONIBLE con Authorization: Bearer <token_encargado>	HTTP 200 OK retornando exclusivamente cuadrillas con estado: "DISPONIBLE"	Retorna HTTP 200 OK con 1 cuadrilla en estado DISPONIBLE (delta), excluyendo unidades en misión o no disponibles	APROBADO	09/11/2026 16:51	-	fix(cuadrillas): habilitar leftJoin en consulta de cuadrillas y sembrar cuadrillas con delegados (HU-21)
CP-H21-API-07	Rechazo de petición POST /api/misiones sin credenciales de autenticación (401 Unauthorized)	Seguridad / Auth	Route Handler	Crítica	Petición HTTP sin cabecera Authorization	POST /api/misiones con body JSON válido sin headers de autenticación	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	Retorna HTTP 401 Unauthorized con el mensaje esperado	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-08	Control de acceso RBAC denegando despacho a rol sin permiso misiones:asignar (403 Forbidden — CA-7)	Seguridad / RBAC	Route / Service	Crítica	Usuario autenticado con rol CALL_CENTER (callcenter@valdivia.cl)	POST /api/misiones con Authorization: Bearer <token_callcenter>	HTTP 403 Forbidden indicando falta del permiso misiones:asignar	Retorna HTTP 403 Forbidden con "message": "No cuenta con el permiso requerido: misiones:asignar"	APROBADO	09/11/2026 16:51	-	feat(seguridad): registrar permiso misiones:asignar (HU-21)
CP-H21-API-09	Autorización exitosa de despacho para rol ENCARGADO con permiso misiones:asignar (CA-7)	Seguridad / RBAC	Route / Service	Alta	Usuario autenticado con rol ENCARGADO (encargado@valdivia.cl)	POST /api/misiones con Authorization: Bearer <token_encargado>	Acceso autorizado hacia la capa de servicio de misiones	Permiso misiones:asignar verificado y autorizado satisfactoriamente	APROBADO	09/11/2026 16:51	-	feat(seguridad): registrar permiso misiones:asignar (HU-21)
CP-H21-API-10	Rechazo de cuerpo de petición con sintaxis JSON malformada (400 Bad Request)	Validación / Input	Route Handler	Media	Usuario con permiso misiones:asignar	POST /api/misiones con body "json-invalido{"	HTTP 400 Bad Request con mensaje "El cuerpo de la petición debe ser un formato JSON válido."	Retorna HTTP 400 Bad Request capturando la excepción de parseo JSON	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-11	Validación Zod de literal tipoMision: "ATENCION_CUADRILLA" y formato UUID en incidenteId y cuadrillaId (400 Bad Request)	Validación / Schema	Route / Zod	Alta	Usuario con permiso misiones:asignar	{"tipoMision":"VERIFICACION","incidenteId":"uuid-invalido","cuadrillaId":"123"}	HTTP 400 Bad Request detallando errores por campo en el arreglo errors	Retorna HTTP 400 Bad Request con 3 errores estructurados para tipoMision, incidenteId y cuadrillaId	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-12	Validación Zod de límites de longitud en campos opcionales titulo (3..150) y descripcion (máx. 1000)	Validación / Schema	Zod Schema	Media	Esquema AsignarCuadrillaMisionInputSchema	titulo: "AB" (2 caracteres) o descripcion > 1000 caracteres	Rechazo de validación con mensaje "El título debe contener al menos 3 caracteres."	Esquema Zod rechaza longitudes fuera de rango con los mensajes configurados	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-13	Manejo de incidente inexistente en base de datos (404 Not Found)	Robustez / DAL	Repository	Alta	UUID de incidente no registrado en tabla incidente	incidenteId: "99999999-9999-4999-8999-999999999999"	HTTP 404 Not Found con mensaje "No se encontró ningún incidente con el identificador proporcionado."	Retorna HTTP 404 Not Found mediante NotFoundError	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-14	Manejo de cuadrilla operativa inexistente o eliminada lógicamente (404 Not Found)	Robustez / DAL	Repository	Alta	UUID de cuadrilla inexistente o con eliminado_en IS NOT NULL	cuadrillaId: "99999999-9999-4999-8999-999999999999"	HTTP 404 Not Found con mensaje "No se encontró ninguna cuadrilla con el identificador proporcionado."	Retorna HTTP 404 Not Found al no encontrar cuadrilla activa	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-15	Bloqueo de despacho sobre incidente en estado no apto (EN_ATENCION, RESUELTO o NO_ABORDABLE) (409 Conflict — CA-1)	Regla de Negocio / ICS	Repository	Crítica	Incidente a1000000-0000-4000-8000-000000000004 en estado EN_ATENCION	POST /api/misiones con incidenteId en estado EN_ATENCION	HTTP 409 Conflict indicando que solo se admiten incidentes en REPORTADO o VERIFICANDO	Retorna HTTP 409 Conflict bloqueando la asignación sobre incidente ya en atención	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-16	Bloqueo de despacho cuando la cuadrilla seleccionada se encuentra en estado EN_MISION o NO_DISPONIBLE (409 Conflict — CA-2)	Regla de Negocio / ICS	Repository	Crítica	Cuadrilla c1000000-0000-4000-8000-000000000001 en estado EN_MISION	POST /api/misiones con cuadrillaId en estado EN_MISION	HTTP 409 Conflict indicando que la cuadrilla no está disponible para asignación	Retorna HTTP 409 Conflict con "message": "La cuadrilla 'Cuadrilla Aguas Lluvias Alfa' no está disponible para asignación (estado actual: 'EN_MISION')..."	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-17	Bloqueo 409 Conflict con código VERIFICACION_EN_CURSO si el incidente está en VERIFICANDO pero la patrulla aún no emite evaluación técnica	Regla de Negocio / ICS	Repository	Crítica	Incidente a1000000-0000-4000-8000-000000000003 en VERIFICANDO con misión d1000000-0000-4000-8000-000000000001 sin reporte ni hito de evaluación	POST /api/misiones sobre incidente en verificación activa sin diagnóstico	HTTP 409 Conflict con codigo: "VERIFICACION_EN_CURSO" y objeto detalles identificando la patrulla y misión activa	Retorna HTTP 409 Conflict con codigo: "VERIFICACION_EN_CURSO", patrullaNombre: "Patrulla Rápida Costa-1" y estadoMision: "EN_CURSO"	APROBADO	09/11/2026 16:51	-	feat(misiones): validar evaluacion tecnica previa de patrulla y estructurar error VERIFICACION_EN_CURSO (HU-21)
CP-H21-API-18	Despacho atómico de cuadrilla y liberación automática de patrulla verificadora previa según Regla ICS §3.2 (201 Created — CA-3 y CA-4)	Transacción / ICS	Repository / DB	Crítica	Incidente en VERIFICANDO con evaluación técnica registrada y cuadrilla DISPONIBLE	POST /api/misiones con incidenteId: "a1000000-0000-4000-8000-000000000003" y cuadrillaId: "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"	HTTP 201 Created: crea misión ATENCION_CUADRILLA (DESPACHADA), pasa cuadrilla a EN_MISION, incidente a EN_ATENCION, cierra misión previa (COMPLETADA), libera patrulla a DISPONIBLE y crea hitos CUADRILLA_DESPACHADA y VERIFICACION_FINALIZADA	Retorna HTTP 201 Created con la transacción completa y todos los estados e hitos actualizados atómicamente	APROBADO	09/11/2026 16:51	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-19	Despacho directo de cuadrilla a incidente en estado REPORTADO sin patrulla verificadora previa (patrullaLiberada: null)	Funcional / ICS	Service / Repo	Alta	Incidente en estado REPORTADO sin misión de verificación previa y cuadrilla DISPONIBLE	POST /api/misiones sobre incidente REPORTADO sin título ni prioridad explícita	HTTP 201 Created: autogenera título, hereda prioridad del incidente, retorna patrullaLiberada: null y hitoPatrulla: null	Crea misión ATENCION_CUADRILLA en estado DESPACHADA con patrullaLiberada: null y sin emitir patrulla:liberada	APROBADO	09/11/2026 16:45	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-20	Herencia automática de prioridad desde la misión de verificación activa o desde el incidente cuando se omite en el payload	Regla de Negocio	Repository	Media	Misión de verificación con prioridad CRITICA y payload sin atributo prioridad	POST /api/misiones omitiendo prioridad	La misión creada para la cuadrilla hereda prioridad: "CRITICA"	Hereda correctamente la prioridad de la misión de verificación o del incidente	APROBADO	09/11/2026 16:45	-	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-21	Emisión de eventos WebSocket mision:asignada, patrulla:liberada e incidente:actualizado al confirmar despacho (CA-5)	Tiempo Real / Socket	Service / Socket	Alta	Despacho exitoso con liberación de patrulla verificadora	Ejecución de asignarCuadrillaMisionService	Invoca notificarMisionAsignada, notificarPatrullaLiberada, notificarPatrullaActualizada y notificarIncidenteActualizado	Los 4 métodos emisores son invocados con los payloads esperados en el servicio	APROBADO	09/11/2026 16:45	-	feat(socket): incorporar evento patrulla:liberada y emisores de misiones (HU-21)
CP-H21-API-22	Transición de incidente a columna EN_ATENCION e indicador verificado en listado Kanban (GET /api/incidentes — CA-6)	Integración / Kanban	Repository / Service	Alta	Incidente actualizado a EN_ATENCION o con verificación completada	GET /api/incidentes?estado=EN_ATENCION	El incidente figura en la columna EN_ATENCION con el atributo booleano verificado expuesto en el esquema Kanban	incidente-kanban.schema.ts y incidente-kanban.repository.ts exponen el campo verificado y ordenan prioritariamente	APROBADO	09/11/2026 16:45	-	feat(incidentes): agregar campo verificado y ordenamiento prioritario en kanban
CP-H21-API-23	Estructura de tabla mision_hito e índices de rendimiento en migración Kysely (CA-4)	Base de Datos / DDL	Migration	Alta	Migración de bitácora de hitos de misión	Inspección de DDL de tabla mision_hito y src/lib/db/types.ts	Tabla mision_hito con FK mision_id (ON DELETE CASCADE), hito, descripcion, registrado_por_id, latitud, longitud, creado_en e índices idx_mision_hito_mision_id e idx_mision_hito_creado_en	Esquema físico y tipos Kysely (MisionHitoTable) definidos con claves foráneas e índices	APROBADO	09/11/2026 16:45	-	feat(db): agregar tabla y migracion mision_hito para bitacora de misiones (HU-21)
CP-H21-API-24	Registro del contrato POST /api/misiones y esquemas AsignarCuadrillaMisionInput / AsignarCuadrillaMisionResponse en OpenAPI 3.0	Contrato API	OpenAPI Spec	Media	Generador generarOpenApiSpec() en src/lib/openapi/index.ts	GET /openapi.json	Especificación OpenAPI v0.10.0 expone POST /api/misiones con respuestas 201, 400, 401, 403, 404, 409 y 500	Ruta y esquemas registrados y validados en suite de pruebas de OpenAPI	APROBADO	09/11/2026 16:45	-	docs(api): documentar endpoint POST /api/misiones y regla de negocio §3.2 (HU-21)
CP-H21-API-25	Ejecución de suite automatizada de pruebas unitarias e integración para el módulo de Misiones en Vitest	Automatización	Unit / Integration	Alta	Entorno de pruebas Vitest v3.2.7	npm test -- src/app/api/misiones src/modules/misiones	100% de los tests del módulo de misiones aprobados sin errores	6 archivos de prueba y 41 tests aprobados en 764ms	APROBADO	09/11/2026 16:45	-	test(misiones): agregar pruebas unitarias e integracion para asignacion de cuadrillas y liberacion (HU-21)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Suite Automatizada de Pruebas en Vitest

**Comando ejecutado:**
```bash
npm test -- src/app/api/misiones src/modules/misiones
```

**Salida real obtenida:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (3 tests) 7ms
 ✓ src/modules/misiones/__tests__/mision.schema.test.ts (10 tests) 16ms
 ✓ src/modules/misiones/__tests__/mision-listado.test.ts (7 tests) 10ms
 ✓ src/app/api/misiones/__tests__/route.test.ts (10 tests) 21ms
 ✓ src/modules/misiones/__tests__/mision-asignar-cuadrilla.service.test.ts (5 tests) 9ms
 ✓ src/app/api/misiones/[id]/__tests__/route.test.ts (6 tests) 17ms

 Test Files  6 passed (6)
      Tests  41 passed (41)
   Start at  16:44:55
   Duration  764ms (transform 608ms, setup 0ms, collect 1.56s, tests 79ms, environment 1ms, prepare 426ms)
```

**Ejecución filtrada para los casos de HU-21:**
```bash
npm test -- -t "HU-21"
```

---

### 5.2 Verificación de Análisis Estático (`npm run lint`)

**Comando ejecutado:**
```bash
npm run lint
```

**Salida real obtenida (`exit code 1` — `BUG-H21-API-02`):**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/modules/misiones/__tests__/mision.schema.test.ts
  8:3  warning  'AsignarCuadrillaMisionResponseSchema' is defined but never used  @typescript-eslint/no-unused-vars

/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts
  374:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 12 problems (1 error, 11 warnings)
```

---

### 5.3 Autenticación de Roles de Prueba (Encargado y Call Center) vía cURL

```bash
curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}'
```

**Respuesta HTTP real (`200 OK`):**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDMiLCJydXQiOiIzMzMzMzMzMy0zIiwiZW1haWwiOiJlbmNhcmdhZG9AdmFsZGl2aWEuY2wiLCJyb2xJZCI6IjIwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMyIsInJvbENvZGlnbyI6IkVOQ0FSR0FETyIsInJvbE5vbWJyZSI6IkVuY2FyZ2FkbyIsImRlbGVnYWNpb25JZCI6IjMwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsImlhdCI6MTc5NDI1Mzg2NCwiZXhwIjoxNzk0MjgyNjY0fQ.2qEuCIkWJYZ67R5t836_jufAV2Z9HJq0RTDcSolrNf4",
    "tipoToken": "Bearer",
    "expiraEn": "2026-11-10T03:51:04.000Z",
    "usuario": {
      "id": "00000000-0000-4000-8000-000000000003",
      "rut": "33333333-3",
      "nombre": "Encargado de Operaciones",
      "email": "encargado@valdivia.cl",
      "rolId": "20000000-0000-4000-8000-000000000003",
      "rolNombre": "Encargado",
      "rolCodigo": "ENCARGADO",
      "delegacionId": "30000000-0000-4000-8000-000000000001",
      "permisos": [
        "misiones:asignar",
        "recursos:leer",
        "incidentes:kanban",
        "misiones:leer",
        "recuperacion:crear",
        "prevencion:eventos:crear",
        "asistencia_social:crear",
        "asistencia_social:leer",
        "personal:leer"
      ]
    }
  }
}
```

---

### 5.4 Pruebas de Integración Paso a Paso con cURL

#### Escenario 1: Consulta de Selector de Cuadrillas Disponibles (`GET /api/cuadrillas?estado=DISPONIBLE` — `CP-H21-API-06`)
```bash
curl -s -i -X GET "http://localhost:3001/api/cuadrillas?estado=DISPONIBLE" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>"
```
**Respuesta HTTP real (`200 OK`):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

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

---

#### Escenario 2: Rechazo por Ausencia de Token (`401 Unauthorized` — `CP-H21-API-07`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -d '{
    "tipoMision": "ATENCION_CUADRILLA",
    "incidenteId": "a1000000-0000-4000-8000-000000000003",
    "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"
  }'
```
**Respuesta HTTP real (`401 Unauthorized`):**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

---

#### Escenario 3: Denegación RBAC para Rol sin Permiso `misiones:asignar` (`403 Forbidden` — `CP-H21-API-08`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_CALL_CENTER>" \
  -d '{
    "tipoMision": "ATENCION_CUADRILLA",
    "incidenteId": "a1000000-0000-4000-8000-000000000003",
    "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"
  }'
```
**Respuesta HTTP real (`403 Forbidden`):**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"message":"No cuenta con el permiso requerido: misiones:asignar"}
```

---

#### Escenario 4: Validación Zod de Campos de Entrada (`400 Bad Request` — `CP-H21-API-11`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  -d '{
    "tipoMision": "VERIFICACION",
    "incidenteId": "uuid-invalido",
    "cuadrillaId": "123"
  }'
```
**Respuesta HTTP real (`400 Bad Request`):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Parámetros de entrada inválidos para asignar cuadrilla a la misión.",
  "errors": [
    {
      "campo": "tipoMision",
      "mensaje": "Invalid input: expected \"ATENCION_CUADRILLA\""
    },
    {
      "campo": "incidenteId",
      "mensaje": "El identificador del incidente debe ser un UUID válido."
    },
    {
      "campo": "cuadrillaId",
      "mensaje": "El identificador de la cuadrilla debe ser un UUID válido."
    }
  ]
}
```

---

#### Escenario 5: Bloqueo por Evaluación Primaria de Patrulla aún en Curso (`409 Conflict` / `VERIFICACION_EN_CURSO` — `CP-H21-API-17`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  -d '{
    "tipoMision": "ATENCION_CUADRILLA",
    "incidenteId": "a1000000-0000-4000-8000-000000000003",
    "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"
  }'
```
**Respuesta HTTP real (`409 Conflict`):**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "statusCode": 409,
  "error": "Conflict",
  "codigo": "VERIFICACION_EN_CURSO",
  "message": "No es posible despachar una cuadrilla operativa: la patrulla verificadora asignada ('Patrulla Rápida Costa-1') aún no ha finalizado la evaluación técnica en terreno.",
  "detalles": {
    "incidenteId": "a1000000-0000-4000-8000-000000000003",
    "misionVerificacionId": "d1000000-0000-4000-8000-000000000001",
    "patrullaId": "f1000000-0000-4000-8000-000000000001",
    "patrullaNombre": "Patrulla Rápida Costa-1",
    "estadoMision": "EN_CURSO"
  }
}
```

---

#### Escenario 6: Bloqueo por Cuadrilla No Disponible (`409 Conflict` — `CP-H21-API-16`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  -d '{
    "tipoMision": "ATENCION_CUADRILLA",
    "incidenteId": "a1000000-0000-4000-8000-000000000001",
    "cuadrillaId": "c1000000-0000-4000-8000-000000000001"
  }'
```
**Respuesta HTTP real (`409 Conflict`):**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "La cuadrilla 'Cuadrilla Aguas Lluvias Alfa' no está disponible para asignación (estado actual: 'EN_MISION'). Solo cuadrillas en estado 'DISPONIBLE' pueden ser despachadas."
}
```

---

#### Escenario 7: Despacho Atómico de Cuadrilla y Liberación Automática de Patrulla Verificadora (`201 Created` — `CP-H21-API-18`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  -d '{
    "tipoMision": "ATENCION_CUADRILLA",
    "incidenteId": "a1000000-0000-4000-8000-000000000003",
    "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
    "titulo": "Despeje táctico de vía y tendido - INC-2026-0003",
    "descripcion": "Intervención pesada con motosierras tras verificación de Patrulla Rápida Costa-1",
    "prioridad": "CRITICA"
  }'
```
**Respuesta HTTP real (`201 Created`):**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "Cuadrilla 'delta' asignada exitosamente al incidente INC-2026-0003. La patrulla verificadora previa ha sido liberada a estado DISPONIBLE.",
  "data": {
    "mision": {
      "id": "de434b6f-c213-45b2-98b7-b9162ffcc1d9",
      "codigo": "MIS-2026-0008",
      "titulo": "Despeje táctico de vía y tendido - INC-2026-0003",
      "descripcion": "Intervención pesada con motosierras tras verificación de Patrulla Rápida Costa-1",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "DESPACHADA",
      "prioridad": "CRITICA",
      "incidenteId": "a1000000-0000-4000-8000-000000000003",
      "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
      "encargadoId": "00000000-0000-4000-8000-000000000003",
      "creadoPorId": "00000000-0000-4000-8000-000000000003",
      "fechaInicio": null,
      "creadoEn": "2026-11-09T19:51:30.989Z"
    },
    "cuadrilla": {
      "id": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
      "nombre": "delta",
      "estado": "EN_MISION"
    },
    "incidente": {
      "id": "a1000000-0000-4000-8000-000000000003",
      "codigo": "INC-2026-0003",
      "estado": "EN_ATENCION",
      "prioridad": "CRITICA"
    },
    "patrullaLiberada": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Rápida Costa-1",
      "estado": "DISPONIBLE",
      "misionPreviaId": "d1000000-0000-4000-8000-000000000001"
    },
    "hitoCuadrilla": {
      "id": "3f8d504d-80e4-47c3-8ec3-539528f86079",
      "misionId": "de434b6f-c213-45b2-98b7-b9162ffcc1d9",
      "hito": "CUADRILLA_DESPACHADA",
      "descripcion": "Cuadrilla despachada a terreno para resolución táctica del incidente",
      "creadoEn": "2026-11-09T19:51:30.989Z"
    },
    "hitoPatrulla": {
      "id": "9c895f2f-7a98-4461-bd33-d5c95386721b",
      "misionId": "d1000000-0000-4000-8000-000000000001",
      "hito": "VERIFICACION_FINALIZADA",
      "descripcion": "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
      "creadoEn": "2026-11-09T19:51:30.989Z"
    }
  }
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA)

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Desde el detalle de un incidente en estado `VERIFICANDO` o `REPORTADO`, el sistema debe proveer un selector de cuadrillas operativas. | `CP-H21-API-06`, `CP-H21-API-15`, `CP-H21-API-17` | 🟢 **CUMPLIDO** | `GET /api/cuadrillas?estado=DISPONIBLE` provee el catálogo de cuadrillas y `POST /api/misiones` valida que el incidente esté en `REPORTADO` o `VERIFICANDO`. |
| **CA-2:** El selector debe mostrar únicamente las cuadrillas en estado `DISPONIBLE`. | `CP-H21-API-02`, `CP-H21-API-06`, `CP-H21-API-16` | 🟡 **PARCIAL (`BUG-H21-API-02`)** | Filtra `estado = 'DISPONIBLE'`, pero requiere sincronizar con `develop` (HU-82) y exigir `.where("activo", "=", true)` en `asignarCuadrillaIncidenteRepo`. |
| **CA-3:** Al confirmar la asignación, la API debe ejecutar una transacción atómica que: (1) Cree la misión con `tipo_mision = 'ATENCION_CUADRILLA'`, `cuadrilla_id` y `estado = 'DESPACHADA'`, (2) Actualice `cuadrilla.estado = 'EN_MISION'`, (3) Actualice `incidente.estado = 'EN_ATENCION'`, y (4) Cumpla la regla de negocio crítica §3.2: si el incidente tenía una patrulla verificadora asignada, su misión de verificación debe cerrarse (`COMPLETADA`) y la patrulla debe quedar automáticamente liberada en estado `DISPONIBLE`. | `CP-H21-API-01`, `CP-H21-API-03`, `CP-H21-API-18`, `CP-H21-API-19`, `CP-H21-API-20` | 🔴 **CON OBSERVACIONES (`BUG-H21-API-01`, `BUG-H21-API-03`)** | Flujo nominal implementado en `db.transaction()`, pero carece de bloqueo pesimista `.forUpdate()` / `pg_advisory_xact_lock` y libera indebidamente patrullas ya reasignadas cuando la misión previa ya estaba `COMPLETADA`. |
| **CA-4:** Debe registrarse el hito correspondiente de despacho de cuadrilla y liberación de patrulla en `mision_hito`. | `CP-H21-API-03`, `CP-H21-API-05`, `CP-H21-API-18`, `CP-H21-API-23` | 🟡 **PARCIAL (`BUG-H21-API-05`)** | Registra `CUADRILLA_DESPACHADA` y `VERIFICACION_FINALIZADA` en `mision_hito`, pero `GET /api/misiones/{id}` no consulta `mision_hito` para exponerlos en `bitacoraTiempos`. |
| **CA-5:** El sistema debe emitir eventos WebSocket `mision:asignada` a la cuadrilla, `patrulla:liberada` a la patrulla y `incidente:actualizado` al Centro de Mando. | `CP-H21-API-05`, `CP-H21-API-21` | 🟡 **PARCIAL (`BUG-H21-API-05`)** | Emite `mision:asignada`, `patrulla:liberada`, `patrulla:actualizada` e `incidente:actualizado`, pero omite `cuadrilla:actualizada` y algunas salas en modo Redis Pub/Sub. |
| **CA-6:** El incidente en el Kanban debe transicionar automáticamente a la columna `'EN_ATENCION'`. | `CP-H21-API-18`, `CP-H21-API-22` | 🟢 **CUMPLIDO** | Actualiza `incidente.estado = 'EN_ATENCION'` y expone el indicador `verificado` en el listado Kanban. |
| **CA-7:** El endpoint debe requerir el permiso RBAC `misiones:asignar`. | `CP-H21-API-04`, `CP-H21-API-07`, `CP-H21-API-08`, `CP-H21-API-09` | 🔴 **CON OBSERVACIONES (`BUG-H21-API-04`)** | Verifica `misiones:asignar`, pero `route.ts` permite bypass de JWT mediante la cabecera `x-user-id` y `verificarPermiso` no valida `usuario.activo === true`. |

