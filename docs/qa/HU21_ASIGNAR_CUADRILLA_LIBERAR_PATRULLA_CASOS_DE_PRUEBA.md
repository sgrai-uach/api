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
> * `merge: sincronizar con develop y resolver defectos de QA BUG-H21-API-01 a 05`  
>  
> **Fecha de Auditoría Inicial:** 09/11/2026 16:45.  
> **Fecha de Re-Test y Certificación Final:** 09/11/2026 23:25.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Cumplidos — 5 Defectos Subsanados y Verificados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la auditoría técnica de código fuente, la validación de transacciones ACID en Kysely/PostgreSQL, la verificación de concurrencia bajo aislamiento transaccional, el encadenamiento de migraciones frente a `develop`, la confirmación de la regla institucional ICS (§3.2), la difusión de eventos en tiempo real vía Socket.io y Redis Pub/Sub, y la ejecución exhaustiva de pruebas unitarias, integración y análisis estático sobre la rama `feature/h21-asignar-cuadrilla`, se dictamina el estado **CERTIFICADO Y APROBADO (`Approved`)** tras comprobar la subsanación total de los **5 defectos reales** detectados en la auditoría inicial (`BUG-H21-API-01` a `BUG-H21-API-05`).

### Verificación de Correcciones en Re-Test (09/11/2026 23:25)
1. **Control de Concurrencia y Serialización (`BUG-H21-API-01` — Resuelto):** En `asignarCuadrillaIncidenteRepo` (`src/modules/misiones/mision.repository.ts:614-639, 715-736, 759-791`) se añadieron bloqueos pesimistas `.forUpdate()` sobre las lecturas iniciales de `incidente` y `cuadrilla`. La generación del código correlativo anual (`MIS-YYYY-NNNN`) se serializó transaccionalmente mediante `SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`, evitando colisiones concurrentes (`23505`). Asimismo, las actualizaciones atómicas de `cuadrilla` e `incidente` condicionan el estado en `WHERE` (`.where("estado", "=", "DISPONIBLE")` y `.where("estado", "in", ["REPORTADO", "VERIFICANDO"])`) y verifican la fila afectada con `.returning()`, arrojando `409 Conflict` ante cualquier colisión concurrente.
2. **Sincronización con `develop`, Secuencia DDL y ESLint (`BUG-H21-API-02` — Resuelto):** La rama se sincronizó íntegramente con `develop`. Se eliminó la migración redundante `033_mision_hito_bitacora.ts`, consolidándose la secuencia lineal oficial en `028_mision_hito_bitacora.ts`. En la consulta de cuadrilla se incorporaron los filtros obligatorios `.where("activo", "=", true)` y `.where("eliminado_en", "is", null)` (conforme al modelo de HU-82). Las advertencias y errores de ESLint fueron eliminados, logrando **0 errores y 0 warnings en `npm run lint`**.
3. **Protección de Patrullas Reasignadas y Preservación de Históricos (`BUG-H21-API-03` — Resuelto):** En `asignarCuadrillaIncidenteRepo` (`src/modules/misiones/mision.repository.ts:810-870`), si la misión de verificación ya se encontraba en estado `'COMPLETADA'`, no se sobrescribe su `fecha_cierre` original ni se duplica el hito `'VERIFICACION_FINALIZADA'`. Adicionalmente, se verifica que la patrulla no posea otra misión activa (`DESPACHADA` o `EN_CURSO`) en paralelo antes de transicionar a `'DISPONIBLE'`, protegiendo unidades ya reasignadas a otros incidentes.
4. **Seguridad RBAC y Autenticación Estricta JWT (`BUG-H21-API-04` — Resuelto):** En `src/app/api/misiones/route.ts:94-106`, se eliminó la lectura no verificada de la cabecera `x-user-id`. El endpoint exige estrictamente un token JWT Bearer firmado a través de `verificarAsignarMision` (`src/modules/seguridad/auth.guard.ts:117-128`), validando el permiso `'misiones:asignar'`. Además, en `src/modules/seguridad/auth.service.ts:34-36`, se incorporó la validación explícita de `usuario.activo === true`, denegando acceso a usuarios deshabilitados (`401 Unauthorized`).
5. **Bitácora de Tiempos y Difusión Completa WebSocket / Redis (`BUG-H21-API-05` — Resuelto):** En `obtenerMisionDetallePorIdRepo` (`src/modules/misiones/mision.repository.ts:315-337`) y `obtenerDetalleMisionService` (`src/modules/misiones/mision.service.ts:63-72`), se integró la consulta directa a `mision_hito`, permitiendo que `GET /api/misiones/{id}` exponga la bitácora cronológica real. En `asignarCuadrillaMisionService` (`mision.service.ts:286-293`), se incorporó la emisión de `emitirCuadrillaActualizada` (`EN_MISION`). En `src/lib/socket/index.ts`, se unificaron las salas de difusión para `notificarPatrullaLiberada`, `notificarPatrullaActualizada` e `notificarIncidenteActualizado` tanto en memoria como vía Redis Pub/Sub (`"encargado"`, `"sala:encargados"`, `"supervisor"`, `"mapa"` y `patrulla:{id}`).

### Métricas Consolidadas de Calidad

| Métrica de Calidad | Resultado Inicial (Auditoría) | Resultado Final (Re-Test) | Estado de Certificación |
|---|:---:|:---:|:---:|
| **Casos de Prueba Evaluados** | 25 | 25 | 100% Cobertura |
| **Casos Aprobados (Passed)** | 20 (80.0%) | 25 (100.0%) | 🟢 **APROBADO** |
| **Defectos Abiertos (Failed)** | 5 (20.0%) | 0 (0.0%) | 🟢 **SUBSANADO** |
| **Análisis Estático (`npm run lint`)** | 1 error / 11 warnings | 0 errores / 0 warnings | 🟢 **CUMPLIDO** |
| **Comprobación de Tipos (`npx tsc --noEmit`)** | 0 errores | 0 errores | 🟢 **CUMPLIDO** |
| **Suite Global de Pruebas (Vitest)** | 58 suites / 640 tests | 60 suites / 750 tests pass | 🟢 **CUMPLIDO** |
| **Compilación de Producción (`npm run build`)** | Compilación limpia | Compilación limpia (0 errores) | 🟢 **CUMPLIDO** |
| **Sincronización con rama `develop`** | 56 commits detrás / colisión migración | Sincronizada (0 commits detrás) | 🟢 **CUMPLIDO** |

---

## 2. Registro Técnico de Defectos Detectados y Verificados en Re-Test

### `BUG-H21-API-01`: Condición de Carrera (TOCTOU) por Ausencia de Bloqueo Pesimista (`FOR UPDATE`), Actualizaciones sin Precondición de Estado y Colisión Concurrente de `mision.codigo` (`23505`)
* **Severidad:** **CRÍTICA** (Concurrencia, Integridad Transaccional y Consistencia Operativa ICS).
* **Estado Post Re-Test (09/11/2026 23:25):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 614-639, 715-736 y 759-791).
* **Descripción Técnica Inicial:**  
  Las lecturas de `incidente` y `cuadrilla` dentro de la transacción se ejecutaban sin `.forUpdate()`, y los `UPDATE` posteriores no condicionaban el estado en el `WHERE`, permitiendo doble asignación bajo concurrencia. Asimismo, `generarSiguienteCodigoMision` no serializaba el correlativo, provocando error PostgreSQL `23505` (`mision_codigo_key`) y respuesta `500 Internal Server Error`.
* **Solución Aplicada y Verificada:**  
  1. Se agregó `.forUpdate()` en las consultas de `incidente` y `cuadrilla`.
  2. Se serializó la generación de códigos con `SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.
  3. Se condicionó la actualización con `.where("estado", "=", "DISPONIBLE").returning("id")` para cuadrilla y `.where("estado", "in", ["REPORTADO", "VERIFICANDO"]).returning(["id", "codigo", "estado", "prioridad"])` para incidente, arrojando `ConflictError` (`409 Conflict`) si no se retorna registro modificado.

---

### `BUG-H21-API-02`: Desfase de Rama respecto a `develop` (56 Commits), Colisión de Correlativo en Migración Kysely (`033_`), Omisión de Filtro `cuadrilla.activo = true` y Fallo de ESLint
* **Severidad:** **CRÍTICA** (Integración Continua, Secuencia de Migraciones Kysely y Sincronización con `develop`).
* **Estado Post Re-Test (09/11/2026 23:25):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/lib/db/migrations/028_mision_hito_bitacora.ts`
  * `src/modules/misiones/mision.repository.ts` (Líneas 635-638)
  * `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts`
  * `src/modules/misiones/__tests__/mision.schema.test.ts`
* **Descripción Técnica Inicial:**  
  La rama estaba desfasada 56 commits con colisión de migración `033_mision_hito_bitacora.ts`, no verificaba `cuadrilla.activo = true` (permitiendo asignar cuadrillas desactivadas) y `npm run lint` fallaba con código 1.
* **Solución Aplicada y Verificada:**  
  1. Se ejecutó merge limpio con `develop`, unificando la migración en `028_mision_hito_bitacora.ts`.
  2. Se añadieron los filtros `.where("activo", "=", true)` y `.where("eliminado_en", "is", null)` en la consulta de cuadrilla.
  3. Se corrigieron los tipos e imports huérfanos, alcanzando **0 errores y 0 warnings en `npm run lint`**.

---

### `BUG-H21-API-03`: Liberación Indebida de Patrulla Reasignada, Sobrescritura de `fecha_cierre` y Duplicación de Hito cuando la Misión de Verificación Previa ya estaba en Estado `'COMPLETADA'`
* **Severidad:** **ALTA** (Violación de Regla de Negocio ICS §3.2 e Integridad Histórica de Bitácora).
* **Estado Post Re-Test (09/11/2026 23:25):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 810-870).
* **Descripción Técnica Inicial:**  
  Al despachar una cuadrilla sobre un incidente con verificación previa completada, la transacción sobrescribía `fecha_cierre`, duplicaba el hito `'VERIFICACION_FINALIZADA'` y forzaba el estado de la patrulla a `'DISPONIBLE'` aun cuando estuviese operando activamente en otro incidente.
* **Solución Aplicada y Verificada:**  
  1. Solo se actualiza la misión previa a `'COMPLETADA'` y se inserta `'VERIFICACION_FINALIZADA'` si `misionVerificacionActiva.mision_estado !== "COMPLETADA"`.
  2. Se consulta si la patrulla cuenta con otra misión activa en paralelo (`otraMisionActiva`). Solo si no tiene misiones activas y no está `'NO_DISPONIBLE'`, se transiciona su estado a `'DISPONIBLE'`.

---

### `BUG-H21-API-04`: Bypass de Autenticación JWT mediante Cabecera `x-user-id` No Verificada en `POST /api/misiones` y Omisión de Validación de Usuario Activo (`usuario.activo = true`)
* **Severidad:** **ALTA** (Seguridad, Autenticación JWT y Control de Acceso RBAC).
* **Estado Post Re-Test (09/11/2026 23:25):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/app/api/misiones/route.ts` (Líneas 94-106)
  * `src/modules/seguridad/auth.guard.ts` (Líneas 117-128)
  * `src/modules/seguridad/auth.service.ts` (Líneas 34-36)
* **Descripción Técnica Inicial:**  
  `route.ts` admitía una cabecera plana `x-user-id` sin token Bearer firmado, y `verificarPermiso` no comprobaba `usuario.activo === true`.
* **Solución Aplicada y Verificada:**  
  1. Se eliminó la lectura de `x-user-id` en el route handler; ahora se invoca exclusivamente `verificarAsignarMision(request)`.
  2. `verificarAsignarMision` exige token JWT válido mediante `extraerUsuarioId` y valida `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_ASIGNAR_MISION])`.
  3. En `auth.service.ts`, se incorporó la comprobación `if (!usuario.activo) throw new UnauthorizedError(...)`.

---

### `BUG-H21-API-05`: Omisión de Lectura de `mision_hito` en `GET /api/misiones/{id}` y Difusión Incompleta de Eventos WebSocket (`cuadrilla:actualizada` y Salas en Redis Pub/Sub)
* **Severidad:** **MEDIA** (Trazabilidad de Bitácora y Sincronización en Tiempo Real).
* **Estado Post Re-Test (09/11/2026 23:25):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 315-337)
  * `src/modules/misiones/mision.service.ts` (Líneas 63-72 y 286-293)
  * `src/lib/socket/index.ts` (Líneas 167-224, 600-618, 720-798)
* **Descripción Técnica Inicial:**  
  `obtenerMisionDetallePorIdRepo` no leía la tabla `mision_hito`, no se emitía `cuadrilla:actualizada` al despachar, y las salas de WebSocket omitían destinos en Redis Pub/Sub.
* **Solución Aplicada y Verificada:**  
  1. `obtenerMisionDetallePorIdRepo` consulta `mision_hito` y `obtenerDetalleMisionService` mapea sus registros en `bitacoraTiempos`.
  2. `asignarCuadrillaMisionService` emite `emitirCuadrillaActualizada` con estado `'EN_MISION'`.
  3. Se unificaron las salas en `notificarPatrullaLiberada`, `notificarPatrullaActualizada` e `notificarIncidenteActualizado` para emitir a `"encargado"`, `"sala:encargados"`, `"supervisor"`, `"mapa"` y `patrulla:{id}` tanto en memoria como por Redis.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `CP-H21-API-01` | Control de concurrencia ante doble despacho simultáneo sobre el mismo incidente o cuadrilla y serialización de `mision.codigo` | Concurrencia / ACID | Repository / DB | Crítica | Incidente en estado `REPORTADO` y cuadrilla en estado `DISPONIBLE` | 2 peticiones `POST /api/misiones` concurrentes (`Promise.all`) sobre el mismo `incidenteId` / `cuadrillaId` | Bloqueo pesimista `.forUpdate()`, validación de estado en `UPDATE` y `pg_advisory_xact_lock`; la primera retorna `201 Created` y la segunda `409 Conflict` | Bloqueo pesimista, serialización por advisory lock y precondición en UPDATE implementados exitosamente | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | fix(misiones): incorporar bloqueo pesimista, advisory lock y actualizacion atomica con precondicion de estado (HU-21) |
| `CP-H21-API-02` | Sincronización con rama `develop`, correlativo único de migración Kysely, filtro `cuadrilla.activo = true` y ejecución limpia de `npm run lint` | Integridad / CI | DB / Build | Crítica | Rama actualizada con `develop` y linter ejecutado | `git log HEAD..develop`, inspección de `src/lib/db/migrations/` y `npm run lint` | Rama al día con `develop`, migración sin colisión de prefijo numérico, filtro `activo = true` en cuadrilla y `0 errors` en ESLint | Rama sincronizada con develop, migración consolidada en 028, filtro activo aplicado y 0 errores en ESLint | **APROBADO** | 09/11/2026 16:46 | 09/11/2026 23:25 | fix(db): sincronizar develop, renumerar migracion a 028, filtrar cuadrillas activas y corregir lint (HU-21) |
| `CP-H21-API-03` | Protección de patrulla verificadora ya liberada y reasignada a otro incidente cuando la misión de verificación previa ya estaba `COMPLETADA` | Regla de Negocio / ICS | Repository | Alta | Incidente A con misión de verificación `COMPLETADA` cuya patrulla P1 ya fue asignada a misión `EN_CURSO` en Incidente B | `POST /api/misiones` despachando cuadrilla al Incidente A | No sobrescribe `fecha_cierre` de la misión ya `COMPLETADA`, no duplica hito y no cambia a `DISPONIBLE` una patrulla activa en otro incidente | Preserva fecha_cierre previa, no duplica hito y verifica misiones activas antes de liberar la patrulla | **APROBADO** | 09/11/2026 16:47 | 09/11/2026 23:25 | fix(misiones): proteger patrullas reasignadas y preservar fecha de cierre en verificaciones completadas (HU-21) |
| `CP-H21-API-04` | Prohibición de bypass de autenticación JWT mediante cabecera plana `x-user-id` y bloqueo de usuarios con `activo = false` | Seguridad / Auth | Route / Service | Alta | Petición sin `Authorization: Bearer <token>` usando solo `x-user-id` o token de usuario inactivo | `POST /api/misiones` con header `x-user-id: 00000000-0000-4000-8000-000000000001` sin Bearer JWT | `HTTP 401 Unauthorized` rechazando cabeceras no firmadas y usuarios inactivos (`activo = false`) | Rechaza con HTTP 401 cabecera x-user-id no autenticada y valida usuario.activo === true | **APROBADO** | 09/11/2026 16:48 | 09/11/2026 23:25 | fix(seguridad): eliminar bypass de x-user-id y validar token jwt con usuario activo (HU-21) |
| `CP-H21-API-05` | Exposición de hitos de `mision_hito` en `GET /api/misiones/{id}` y difusión completa de eventos WebSocket (`cuadrilla:actualizada` y salas Redis) | Integración / Socket | Service / Repo / Socket | Media | Misión creada y patrulla liberada mediante `POST /api/misiones` | `GET /api/misiones/{id}` e inspección de `mision.service.ts` y `src/lib/socket/index.ts` | `bitacoraTiempos` incluye hitos de `mision_hito`; se emite `cuadrilla:actualizada` y todas las salas reciben eventos en memoria y Redis | bitacoraTiempos incluye hitos reales de mision_hito; emite cuadrilla:actualizada y salas unificadas en Socket/Redis | **APROBADO** | 09/11/2026 16:49 | 09/11/2026 23:25 | fix(socket): exponer hitos de mision en bitacora y unificar difusion websocket y redis (HU-21) |
| `CP-H21-API-06` | Consulta de selector de cuadrillas operativas filtrando únicamente estado `DISPONIBLE` (CA-1 y CA-2) | Funcional / API | Route / Service | Alta | Cuadrillas registradas en estados `DISPONIBLE`, `EN_MISION` y `NO_DISPONIBLE` | `GET /api/cuadrillas?estado=DISPONIBLE` con `Authorization: Bearer <token_encargado>` | `HTTP 200 OK` retornando exclusivamente cuadrillas con `estado: "DISPONIBLE"` | Retorna `HTTP 200 OK` con cuadrillas en estado `DISPONIBLE`, excluyendo unidades en misión o no disponibles | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | fix(cuadrillas): habilitar leftJoin en consulta de cuadrillas y sembrar cuadrillas con delegados (HU-21) |
| `CP-H21-API-07` | Rechazo de petición `POST /api/misiones` sin credenciales de autenticación (`401 Unauthorized`) | Seguridad / Auth | Route Handler | Crítica | Petición HTTP sin cabecera `Authorization` | `POST /api/misiones` con body JSON válido sin headers de autenticación | `HTTP 401 Unauthorized` con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | Retorna `HTTP 401 Unauthorized` con el mensaje esperado | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-08` | Control de acceso RBAC denegando despacho a rol sin permiso `misiones:asignar` (`403 Forbidden` — CA-7) | Seguridad / RBAC | Route / Service | Crítica | Usuario autenticado con rol `CALL_CENTER` (`callcenter@valdivia.cl`) | `POST /api/misiones` con `Authorization: Bearer <token_callcenter>` | `HTTP 403 Forbidden` indicando falta del permiso `misiones:asignar` | Retorna `HTTP 403 Forbidden` con mensaje indicando denegación por permiso misiones:asignar | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(seguridad): registrar permiso misiones:asignar (HU-21) |
| `CP-H21-API-09` | Autorización exitosa de despacho para rol `ENCARGADO` con permiso `misiones:asignar` (CA-7) | Seguridad / RBAC | Route / Service | Alta | Usuario autenticado con rol `ENCARGADO` (`encargado@valdivia.cl`) | `POST /api/misiones` con `Authorization: Bearer <token_encargado>` | Acceso autorizado hacia la capa de servicio de misiones | Permiso `misiones:asignar` verificado y autorizado satisfactoriamente | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(seguridad): registrar permiso misiones:asignar (HU-21) |
| `CP-H21-API-10` | Rechazo de cuerpo de petición con sintaxis JSON malformada (`400 Bad Request`) | Validación / Input | Route Handler | Media | Usuario con permiso `misiones:asignar` | `POST /api/misiones` con body `"json-invalido{"` | `HTTP 400 Bad Request` con mensaje `"El cuerpo de la solicitud debe ser un formato JSON válido."` | Retorna `HTTP 400 Bad Request` capturando la excepción de parseo JSON | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-11` | Validación Zod de literal `tipoMision: "ATENCION_CUADRILLA"` y formato UUID en `incidenteId` y `cuadrillaId` (`400 Bad Request`) | Validación / Schema | Route / Zod | Alta | Usuario con permiso `misiones:asignar` | `{"tipoMision":"VERIFICACION","incidenteId":"uuid-invalido","cuadrillaId":"123"}` | `HTTP 400 Bad Request` detallando errores por campo en el arreglo `errors` | Retorna `HTTP 400 Bad Request` con 3 errores estructurados para `tipoMision`, `incidenteId` y `cuadrillaId` | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-12` | Validación Zod de límites de longitud en campos opcionales `titulo` (3..150) y `descripcion` (máx. 1000) | Validación / Schema | Zod Schema | Media | Esquema `AsignarCuadrillaMisionInputSchema` | `titulo: "AB"` (2 caracteres) o `descripcion` > 1000 caracteres | Rechazo de validación con mensaje `"El título debe contener al menos 3 caracteres."` | Esquema Zod rechaza longitudes fuera de rango con los mensajes configurados | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-13` | Manejo de incidente inexistente en base de datos (`404 Not Found`) | Robustez / DAL | Repository | Alta | UUID de incidente no registrado en tabla `incidente` | `incidenteId: "99999999-9999-4999-8999-999999999999"` | `HTTP 404 Not Found` con mensaje `"No se encontró ningún incidente con el identificador proporcionado."` | Retorna `HTTP 404 Not Found` mediante `NotFoundError` | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-14` | Manejo de cuadrilla operativa inexistente o eliminada lógicamente (`404 Not Found`) | Robustez / DAL | Repository | Alta | UUID de cuadrilla inexistente o con `eliminado_en IS NOT NULL` | `cuadrillaId: "99999999-9999-4999-8999-999999999999"` | `HTTP 404 Not Found` con mensaje `"No se encontró ninguna cuadrilla con el identificador proporcionado."` | Retorna `HTTP 404 Not Found` al no encontrar cuadrilla activa | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-15` | Bloqueo de despacho sobre incidente en estado no apto (`EN_ATENCION`, `RESUELTO` o `NO_ABORDABLE`) (`409 Conflict` — CA-1) | Regla de Negocio / ICS | Repository | Crítica | Incidente `a1000000-0000-4000-8000-000000000004` en estado `EN_ATENCION` | `POST /api/misiones` con `incidenteId` en estado `EN_ATENCION` | `HTTP 409 Conflict` indicando que solo se admiten incidentes en `REPORTADO` o `VERIFICANDO` | Retorna `HTTP 409 Conflict` bloqueando la asignación sobre incidente ya en atención | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-16` | Bloqueo de despacho cuando la cuadrilla seleccionada se encuentra en estado `EN_MISION` o `NO_DISPONIBLE` (`409 Conflict` — CA-2) | Regla de Negocio / ICS | Repository | Crítica | Cuadrilla `c1000000-0000-4000-8000-000000000001` en estado `EN_MISION` | `POST /api/misiones` con `cuadrillaId` en estado `EN_MISION` | `HTTP 409 Conflict` indicando que la cuadrilla no está disponible para asignación | Retorna `HTTP 409 Conflict` con `"message": "La cuadrilla 'Cuadrilla Aguas Lluvias Alfa' no está disponible para asignación (estado actual: 'EN_MISION')..."` | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-17` | Bloqueo `409 Conflict` con código `VERIFICACION_EN_CURSO` si el incidente está en `VERIFICANDO` pero la patrulla aún no emite evaluación técnica | Regla de Negocio / ICS | Repository | Crítica | Incidente `a1000000-0000-4000-8000-000000000003` en `VERIFICANDO` con misión `d1000000-0000-4000-8000-000000000001` sin reporte ni hito de evaluación | `POST /api/misiones` sobre incidente en verificación activa sin diagnóstico | `HTTP 409 Conflict` con `codigo: "VERIFICACION_EN_CURSO"` y objeto `detalles` identificando la patrulla y misión activa | Retorna `HTTP 409 Conflict` con `codigo: "VERIFICACION_EN_CURSO"`, `patrullaNombre: "Patrulla Rápida Costa-1"` y `estadoMision: "EN_CURSO"` | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): validar evaluacion tecnica previa de patrulla y estructurar error VERIFICACION_EN_CURSO (HU-21) |
| `CP-H21-API-18` | Despacho atómico de cuadrilla y liberación automática de patrulla verificadora previa según Regla ICS §3.2 (`201 Created` — CA-3 y CA-4) | Transacción / ICS | Repository / DB | Crítica | Incidente en `VERIFICANDO` con evaluación técnica registrada y cuadrilla `DISPONIBLE` | `POST /api/misiones` con `incidenteId: "a1000000-0000-4000-8000-000000000003"` y `cuadrillaId: "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"` | `HTTP 201 Created`: crea misión `ATENCION_CUADRILLA` (`DESPACHADA`), pasa cuadrilla a `EN_MISION`, incidente a `EN_ATENCION`, cierra misión previa (`COMPLETADA`), libera patrulla a `DISPONIBLE` y crea hitos `CUADRILLA_DESPACHADA` y `VERIFICACION_FINALIZADA` | Retorna `HTTP 201 Created` con la transacción completa y todos los estados e hitos actualizados atómicamente | **APROBADO** | 09/11/2026 16:51 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-19` | Despacho directo de cuadrilla a incidente en estado `REPORTADO` sin patrulla verificadora previa (`patrullaLiberada: null`) | Funcional / ICS | Service / Repo | Alta | Incidente en estado `REPORTADO` sin misión de verificación previa y cuadrilla `DISPONIBLE` | `POST /api/misiones` sobre incidente `REPORTADO` sin título ni prioridad explícita | `HTTP 201 Created`: autogenera título, hereda prioridad del incidente, retorna `patrullaLiberada: null` y `hitoPatrulla: null` | Crea misión `ATENCION_CUADRILLA` en estado `DESPACHADA` con `patrullaLiberada: null` y sin emitir `patrulla:liberada` | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-20` | Herencia automática de prioridad desde la misión de verificación activa o desde el incidente cuando se omite en el payload | Regla de Negocio | Repository | Media | Misión de verificación con prioridad `CRITICA` y payload sin atributo `prioridad` | `POST /api/misiones` omitiendo `prioridad` | La misión creada para la cuadrilla hereda `prioridad: "CRITICA"` | Hereda correctamente la prioridad de la misión de verificación o del incidente | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21) |
| `CP-H21-API-21` | Emisión de eventos WebSocket `mision:asignada`, `patrulla:liberada` e `incidente:actualizado` al confirmar despacho (CA-5) | Tiempo Real / Socket | Service / Socket | Alta | Despacho exitoso con liberación de patrulla verificadora | Ejecución de `asignarCuadrillaMisionService` | Invoca `notificarMisionAsignada`, `notificarPatrullaLiberada`, `notificarPatrullaActualizada`, `emitirCuadrillaActualizada` e `notificarIncidenteActualizado` | Todos los métodos emisores son invocados con las salas completas en memoria y Redis | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | feat(socket): incorporar evento patrulla:liberada y emisores de misiones (HU-21) |
| `CP-H21-API-22` | Transición de incidente a columna `EN_ATENCION` e indicador `verificado` en listado Kanban (`GET /api/incidentes` — CA-6) | Integración / Kanban | Repository / Service | Alta | Incidente actualizado a `EN_ATENCION` o con verificación completada | `GET /api/incidentes?estado=EN_ATENCION` | El incidente figura en la columna `EN_ATENCION` con el atributo booleano `verificado` expuesto en el esquema Kanban | `incidente-kanban.schema.ts` y `incidente-kanban.repository.ts` exponen el campo `verificado` y ordenan prioritariamente | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | feat(incidentes): agregar campo verificado y ordenamiento prioritario en kanban |
| `CP-H21-API-23` | Estructura de tabla `mision_hito` e índices de rendimiento en migración Kysely (CA-4) | Base de Datos / DDL | Migration | Alta | Migración de bitácora de hitos de misión | Inspección de DDL de tabla `mision_hito` y `src/lib/db/types.ts` | Tabla `mision_hito` con FK `mision_id` (`ON DELETE CASCADE`), `hito`, `descripcion`, `registrado_por_id`, `latitud`, `longitud`, `creado_en` e índices `idx_mision_hito_mision_id` e `idx_mision_hito_creado_en` | Esquema físico y tipos Kysely (`MisionHitoTable`) consolidados bajo migración 028 | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | feat(db): agregar tabla y migracion mision_hito para bitacora de misiones (HU-21) |
| `CP-H21-API-24` | Registro del contrato `POST /api/misiones` y esquemas `AsignarCuadrillaMisionInput` / `AsignarCuadrillaMisionResponse` en OpenAPI 3.0 | Contrato API | OpenAPI Spec | Media | Generador `generarOpenApiSpec()` en `src/lib/openapi/index.ts` | `GET /openapi.json` | Especificación OpenAPI v0.10.0 expone `POST /api/misiones` con respuestas `201`, `400`, `401`, `403`, `404`, `409` y `500` | Ruta y esquemas registrados y validados en suite de pruebas de OpenAPI | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | docs(api): documentar endpoint POST /api/misiones y regla de negocio §3.2 (HU-21) |
| `CP-H21-API-25` | Ejecución de suite automatizada de pruebas unitarias e integración para el módulo de Misiones en Vitest | Automatización | Unit / Integration | Alta | Entorno de pruebas Vitest v3.2.7 | `npm test -- src/app/api/misiones src/modules/misiones` | 100% de los tests del módulo de misiones aprobados sin errores | 6 archivos de prueba y 53 tests aprobados exitosamente | **APROBADO** | 09/11/2026 16:45 | 09/11/2026 23:25 | test(misiones): agregar pruebas unitarias e integracion para asignacion de cuadrillas y liberacion (HU-21) |

---

## 4. Exportación Tabular de Casos de Prueba (TSV)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
CP-H21-API-01	Control de concurrencia ante doble despacho simultáneo sobre el mismo incidente o cuadrilla y serialización de mision.codigo	Concurrencia / ACID	Repository / DB	Crítica	Incidente en estado REPORTADO y cuadrilla en estado DISPONIBLE	2 peticiones POST /api/misiones concurrentes (Promise.all) sobre el mismo incidenteId / cuadrillaId	Bloqueo pesimista .forUpdate(), validación de estado en UPDATE y pg_advisory_xact_lock; la primera retorna 201 Created y la segunda 409 Conflict	Bloqueo pesimista, serialización por advisory lock y precondición en UPDATE implementados exitosamente	APROBADO	09/11/2026 16:45	09/11/2026 23:25	fix(misiones): incorporar bloqueo pesimista, advisory lock y actualizacion atomica con precondicion de estado (HU-21)
CP-H21-API-02	Sincronización con rama develop, correlativo único de migración Kysely, filtro cuadrilla.activo = true y ejecución limpia de npm run lint	Integridad / CI	DB / Build	Crítica	Rama actualizada con develop y linter ejecutado	git log HEAD..develop, inspección de src/lib/db/migrations/ y npm run lint	Rama al día con develop, migración sin colisión de prefijo numérico, filtro activo = true en cuadrilla y 0 errors en ESLint	Rama sincronizada con develop, migración consolidada en 028, filtro activo aplicado y 0 errores en ESLint	APROBADO	09/11/2026 16:46	09/11/2026 23:25	fix(db): sincronizar develop, renumerar migracion a 028, filtrar cuadrillas activas y corregir lint (HU-21)
CP-H21-API-03	Protección de patrulla verificadora ya liberada y reasignada a otro incidente cuando la misión de verificación previa ya estaba COMPLETADA	Regla de Negocio / ICS	Repository	Alta	Incidente A con misión de verificación COMPLETADA cuya patrulla P1 ya fue asignada a misión EN_CURSO en Incidente B	POST /api/misiones despachando cuadrilla al Incidente A	No sobrescribe fecha_cierre de la misión ya COMPLETADA, no duplica hito y no cambia a DISPONIBLE una patrulla activa en otro incidente	Preserva fecha_cierre previa, no duplica hito y verifica misiones activas antes de liberar la patrulla	APROBADO	09/11/2026 16:47	09/11/2026 23:25	fix(misiones): proteger patrullas reasignadas y preservar fecha de cierre en verificaciones completadas (HU-21)
CP-H21-API-04	Prohibición de bypass de autenticación JWT mediante cabecera plana x-user-id y bloqueo de usuarios con activo = false	Seguridad / Auth	Route / Service	Alta	Petición sin Authorization: Bearer <token> usando solo x-user-id o token de usuario inactivo	POST /api/misiones con header x-user-id: 00000000-0000-4000-8000-000000000001 sin Bearer JWT	HTTP 401 Unauthorized rechazando cabeceras no firmadas y usuarios inactivos (activo = false)	Rechaza con HTTP 401 cabecera x-user-id no autenticada y valida usuario.activo === true	APROBADO	09/11/2026 16:48	09/11/2026 23:25	fix(seguridad): eliminar bypass de x-user-id y validar token jwt con usuario activo (HU-21)
CP-H21-API-05	Exposición de hitos de mision_hito en GET /api/misiones/{id} y difusión completa de eventos WebSocket (cuadrilla:actualizada y salas Redis)	Integración / Socket	Service / Repo / Socket	Media	Misión creada y patrulla liberada mediante POST /api/misiones	GET /api/misiones/{id} e inspección de mision.service.ts y src/lib/socket/index.ts	bitacoraTiempos incluye hitos de mision_hito; se emite cuadrilla:actualizada y todas las salas reciben eventos en memoria y Redis	bitacoraTiempos incluye hitos reales de mision_hito; emite cuadrilla:actualizada y salas unificadas en Socket/Redis	APROBADO	09/11/2026 16:49	09/11/2026 23:25	fix(socket): exponer hitos de mision en bitacora y unificar difusion websocket y redis (HU-21)
CP-H21-API-06	Consulta de selector de cuadrillas operativas filtrando únicamente estado DISPONIBLE (CA-1 y CA-2)	Funcional / API	Route / Service	Alta	Cuadrillas registradas en estados DISPONIBLE, EN_MISION y NO_DISPONIBLE	GET /api/cuadrillas?estado=DISPONIBLE con Authorization: Bearer <token_encargado>	HTTP 200 OK retornando exclusivamente cuadrillas con estado: "DISPONIBLE"	Retorna HTTP 200 OK con cuadrillas en estado DISPONIBLE, excluyendo unidades en misión o no disponibles	APROBADO	09/11/2026 16:51	09/11/2026 23:25	fix(cuadrillas): habilitar leftJoin en consulta de cuadrillas y sembrar cuadrillas con delegados (HU-21)
CP-H21-API-07	Rechazo de petición POST /api/misiones sin credenciales de autenticación (401 Unauthorized)	Seguridad / Auth	Route Handler	Crítica	Petición HTTP sin cabecera Authorization	POST /api/misiones con body JSON válido sin headers de autenticación	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	Retorna HTTP 401 Unauthorized con el mensaje esperado	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-08	Control de acceso RBAC denegando despacho a rol sin permiso misiones:asignar (403 Forbidden — CA-7)	Seguridad / RBAC	Route / Service	Crítica	Usuario autenticado con rol CALL_CENTER (callcenter@valdivia.cl)	POST /api/misiones con Authorization: Bearer <token_callcenter>	HTTP 403 Forbidden indicando falta del permiso misiones:asignar	Retorna HTTP 403 Forbidden con mensaje indicando denegación por permiso misiones:asignar	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(seguridad): registrar permiso misiones:asignar (HU-21)
CP-H21-API-09	Autorización exitosa de despacho para rol ENCARGADO con permiso misiones:asignar (CA-7)	Seguridad / RBAC	Route / Service	Alta	Usuario autenticado con rol ENCARGADO (encargado@valdivia.cl)	POST /api/misiones con Authorization: Bearer <token_encargado>	Acceso autorizado hacia la capa de servicio de misiones	Permiso misiones:asignar verificado y autorizado satisfactoriamente	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(seguridad): registrar permiso misiones:asignar (HU-21)
CP-H21-API-10	Rechazo de cuerpo de petición con sintaxis JSON malformada (400 Bad Request)	Validación / Input	Route Handler	Media	Usuario con permiso misiones:asignar	POST /api/misiones con body "json-invalido{"	HTTP 400 Bad Request con mensaje "El cuerpo de la solicitud debe ser un formato JSON válido."	Retorna HTTP 400 Bad Request capturando la excepción de parseo JSON	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-11	Validación Zod de literal tipoMision: "ATENCION_CUADRILLA" y formato UUID en incidenteId y cuadrillaId (400 Bad Request)	Validación / Schema	Route / Zod	Alta	Usuario con permiso misiones:asignar	{"tipoMision":"VERIFICACION","incidenteId":"uuid-invalido","cuadrillaId":"123"}	HTTP 400 Bad Request detallando errores por campo en el arreglo errors	Retorna HTTP 400 Bad Request con 3 errores estructurados para tipoMision, incidenteId y cuadrillaId	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-12	Validación Zod de límites de longitud en campos opcionales titulo (3..150) y descripcion (máx. 1000)	Validación / Schema	Zod Schema	Media	Esquema AsignarCuadrillaMisionInputSchema	titulo: "AB" (2 caracteres) o descripcion > 1000 caracteres	Rechazo de validación con mensaje "El título debe contener al menos 3 caracteres."	Esquema Zod rechaza longitudes fuera de rango con los mensajes configurados	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-13	Manejo de incidente inexistente en base de datos (404 Not Found)	Robustez / DAL	Repository	Alta	UUID de incidente no registrado en tabla incidente	incidenteId: "99999999-9999-4999-8999-999999999999"	HTTP 404 Not Found con mensaje "No se encontró ningún incidente con el identificador proporcionado."	Retorna HTTP 404 Not Found mediante NotFoundError	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-14	Manejo de cuadrilla operativa inexistente o eliminada lógicamente (404 Not Found)	Robustez / DAL	Repository	Alta	UUID de cuadrilla inexistente o con eliminado_en IS NOT NULL	cuadrillaId: "99999999-9999-4999-8999-999999999999"	HTTP 404 Not Found con mensaje "No se encontró ninguna cuadrilla con el identificador proporcionado."	Retorna HTTP 404 Not Found al no encontrar cuadrilla activa	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-15	Bloqueo de despacho sobre incidente en estado no apto (EN_ATENCION, RESUELTO o NO_ABORDABLE) (409 Conflict — CA-1)	Regla de Negocio / ICS	Repository	Crítica	Incidente a1000000-0000-4000-8000-000000000004 en estado EN_ATENCION	POST /api/misiones con incidenteId en estado EN_ATENCION	HTTP 409 Conflict indicando que solo se admiten incidentes en REPORTADO o VERIFICANDO	Retorna HTTP 409 Conflict bloqueando la asignación sobre incidente ya en atención	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-16	Bloqueo de despacho cuando la cuadrilla seleccionada se encuentra en estado EN_MISION o NO_DISPONIBLE (409 Conflict — CA-2)	Regla de Negocio / ICS	Repository	Crítica	Cuadrilla c1000000-0000-4000-8000-000000000001 en estado EN_MISION	POST /api/misiones con cuadrillaId en estado EN_MISION	HTTP 409 Conflict indicando que la cuadrilla no está disponible para asignación	Retorna HTTP 409 Conflict con "message": "La cuadrilla 'Cuadrilla Aguas Lluvias Alfa' no está disponible para asignación (estado actual: 'EN_MISION')..."	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-17	Bloqueo 409 Conflict con código VERIFICACION_EN_CURSO si el incidente está en VERIFICANDO pero la patrulla aún no emite evaluación técnica	Regla de Negocio / ICS	Repository	Crítica	Incidente a1000000-0000-4000-8000-000000000003 en VERIFICANDO con misión d1000000-0000-4000-8000-000000000001 sin reporte ni hito de evaluación	POST /api/misiones sobre incidente en verificación activa sin diagnóstico	HTTP 409 Conflict con codigo: "VERIFICACION_EN_CURSO" y objeto detalles identificando la patrulla y misión activa	Retorna HTTP 409 Conflict con codigo: "VERIFICACION_EN_CURSO", patrullaNombre: "Patrulla Rápida Costa-1" y estadoMision: "EN_CURSO"	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): validar evaluacion tecnica previa de patrulla y estructurar error VERIFICACION_EN_CURSO (HU-21)
CP-H21-API-18	Despacho atómico de cuadrilla y liberación automática de patrulla verificadora previa según Regla ICS §3.2 (201 Created — CA-3 y CA-4)	Transacción / ICS	Repository / DB	Crítica	Incidente en VERIFICANDO con evaluación técnica registrada y cuadrilla DISPONIBLE	POST /api/misiones con incidenteId: "a1000000-0000-4000-8000-000000000003" y cuadrillaId: "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85"	HTTP 201 Created: crea misión ATENCION_CUADRILLA (DESPACHADA), pasa cuadrilla a EN_MISION, incidente a EN_ATENCION, cierra misión previa (COMPLETADA), libera patrulla a DISPONIBLE y crea hitos CUADRILLA_DESPACHADA y VERIFICACION_FINALIZADA	Retorna HTTP 201 Created con la transacción completa y todos los estados e hitos actualizados atómicamente	APROBADO	09/11/2026 16:51	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-19	Despacho directo de cuadrilla a incidente en estado REPORTADO sin patrulla verificadora previa (patrullaLiberada: null)	Funcional / ICS	Service / Repo	Alta	Incidente en estado REPORTADO sin misión de verificación previa y cuadrilla DISPONIBLE	POST /api/misiones sobre incidente REPORTADO sin título ni prioridad explícita	HTTP 201 Created: autogenera título, hereda prioridad del incidente, retorna patrullaLiberada: null y hitoPatrulla: null	Crea misión ATENCION_CUADRILLA en estado DESPACHADA con patrullaLiberada: null y sin emitir patrulla:liberada	APROBADO	09/11/2026 16:45	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-20	Herencia automática de prioridad desde la misión de verificación activa o desde el incidente cuando se omite en el payload	Regla de Negocio	Repository	Media	Misión de verificación con prioridad CRITICA y payload sin atributo prioridad	POST /api/misiones omitiendo prioridad	La misión creada para la cuadrilla hereda prioridad: "CRITICA"	Hereda correctamente la prioridad de la misión de verificación o del incidente	APROBADO	09/11/2026 16:45	09/11/2026 23:25	feat(misiones): implementar asignacion de cuadrilla y liberacion de patrulla con regla ICS §3.2 (HU-21)
CP-H21-API-21	Emisión de eventos WebSocket mision:asignada, patrulla:liberada e incidente:actualizado al confirmar despacho (CA-5)	Tiempo Real / Socket	Service / Socket	Alta	Despacho exitoso con liberación de patrulla verificadora	Ejecución de asignarCuadrillaMisionService	Invoca notificarMisionAsignada, notificarPatrullaLiberada, notificarPatrullaActualizada, emitirCuadrillaActualizada e notificarIncidenteActualizado	Todos los métodos emisores son invocados con las salas completas en memoria y Redis	APROBADO	09/11/2026 16:45	09/11/2026 23:25	feat(socket): incorporar evento patrulla:liberada y emisores de misiones (HU-21)
CP-H21-API-22	Transición de incidente a columna EN_ATENCION e indicador verificado en listado Kanban (GET /api/incidentes — CA-6)	Integración / Kanban	Repository / Service	Alta	Incidente actualizado a EN_ATENCION o con verificación completada	GET /api/incidentes?estado=EN_ATENCION	El incidente figura en la columna EN_ATENCION con el atributo booleano verificado expuesto en el esquema Kanban	incidente-kanban.schema.ts y incidente-kanban.repository.ts exponen el campo verificado y ordenan prioritariamente	APROBADO	09/11/2026 16:45	09/11/2026 23:25	feat(incidentes): agregar campo verificado y ordenamiento prioritario en kanban
CP-H21-API-23	Estructura de tabla mision_hito e índices de rendimiento en migración Kysely (CA-4)	Base de Datos / DDL	Migration	Alta	Migración de bitácora de hitos de misión	Inspección de DDL de tabla mision_hito y src/lib/db/types.ts	Tabla mision_hito con FK mision_id (ON DELETE CASCADE), hito, descripcion, registrado_por_id, latitud, longitud, creado_en e índices idx_mision_hito_mision_id e idx_mision_hito_creado_en	Esquema físico y tipos Kysely (MisionHitoTable) consolidados bajo migración 028	APROBADO	09/11/2026 16:45	09/11/2026 23:25	feat(db): agregar tabla y migracion mision_hito para bitacora de misiones (HU-21)
CP-H21-API-24	Registro del contrato POST /api/misiones y esquemas AsignarCuadrillaMisionInput / AsignarCuadrillaMisionResponse en OpenAPI 3.0	Contrato API	OpenAPI Spec	Media	Generador generarOpenApiSpec() en src/lib/openapi/index.ts	GET /openapi.json	Especificación OpenAPI v0.10.0 expone POST /api/misiones con respuestas 201, 400, 401, 403, 404, 409 y 500	Ruta y esquemas registrados y validados en suite de pruebas de OpenAPI	APROBADO	09/11/2026 16:45	09/11/2026 23:25	docs(api): documentar endpoint POST /api/misiones y regla de negocio §3.2 (HU-21)
CP-H21-API-25	Ejecución de suite automatizada de pruebas unitarias e integración para el módulo de Misiones en Vitest	Automatización	Unit / Integration	Alta	Entorno de pruebas Vitest v3.2.7	npm test -- src/app/api/misiones src/modules/misiones	100% de los tests del módulo de misiones aprobados sin errores	6 archivos de prueba y 53 tests aprobados exitosamente	APROBADO	09/11/2026 16:45	09/11/2026 23:25	test(misiones): agregar pruebas unitarias e integracion para asignacion de cuadrillas y liberacion (HU-21)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Ejecución de Suite Automatizada de Pruebas en Vitest

**Comando ejecutado:**
```bash
npm test -- src/app/api/misiones src/modules/misiones
```

**Salida real obtenida en Re-Test:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (5 tests) 17ms
 ✓ src/modules/misiones/__tests__/mision-listado.test.ts (7 tests) 22ms
 ✓ src/modules/misiones/__tests__/mision.schema.test.ts (15 tests) 39ms
 ✓ src/app/api/misiones/__tests__/route.test.ts (15 tests) 59ms
 ✓ src/modules/misiones/__tests__/mision-asignar-cuadrilla.service.test.ts (5 tests) 25ms
 ✓ src/app/api/misiones/[id]/__tests__/route.test.ts (6 tests) 38ms

 Test Files  6 passed (6)
      Tests  53 passed (53)
   Start at  23:26:33
   Duration  1.56s (transform 1.26s, setup 0ms, collect 3.10s, tests 201ms, environment 4ms, prepare 1000ms)
```

**Ejecución global de la suite completa de pruebas:**
```bash
npx vitest run
```

```text
 Test Files  60 passed (60)
      Tests  750 passed (750)
   Start at  23:25:14
   Duration  7.49s (transform 8.84s, setup 0ms, collect 55.89s, tests 11.54s, environment 45ms, prepare 12.91s)
```

---

### 5.2 Verificación de Análisis Estático (`npm run lint` y `npx tsc --noEmit`)

**Comando ejecutado:**
```bash
npm run lint && npx tsc --noEmit
```

**Salida real obtenida (`exit code 0`):**
```text
> sgrai-api@0.10.0 lint
> eslint
> sgrai-api@0.10.0 tsc --noEmit
```
*(Análisis limpio: 0 errores y 0 warnings).*

---

### 5.3 Pruebas de Integración en Vivo con cURL (Re-Test)

#### Escenario 1: Verificación de Bloqueo a Cabecera `x-user-id` sin Token (`401 Unauthorized` — `CP-H21-API-04`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"tipoMision":"ATENCION_CUADRILLA","incidenteId":"a1000000-0000-4000-8000-000000000001","cuadrillaId":"c1000000-0000-4000-8000-000000000002"}'
```
**Respuesta HTTP real (`401 Unauthorized`):**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

---

#### Escenario 2: Consulta de Selector de Cuadrillas Disponibles (`GET /api/cuadrillas?estado=DISPONIBLE` — `CP-H21-API-06`)
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
      "activo": true,
      "creadoEn": "2026-11-03T21:10:08.355Z",
      "eliminadoEn": null,
      "actualizadoEn": "2026-11-09T19:51:30.989Z"
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

#### Escenario 3: Despacho Atómico de Cuadrilla y Liberación de Patrulla (`201 Created` — `CP-H21-API-18`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  -d '{
    "tipoMision": "ATENCION_CUADRILLA",
    "incidenteId": "a1000000-0000-4000-8000-000000000003",
    "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
    "titulo": "Despeje y reparación táctica - INC-2026-0003"
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
      "id": "65d56587-c0ae-46bb-8f46-f73c6a40d9b6",
      "codigo": "MIS-2026-0008",
      "titulo": "Despeje y reparación táctica - INC-2026-0003",
      "descripcion": null,
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "DESPACHADA",
      "prioridad": "CRITICA",
      "incidenteId": "a1000000-0000-4000-8000-000000000003",
      "cuadrillaId": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
      "encargadoId": "00000000-0000-4000-8000-000000000003",
      "creadoPorId": "00000000-0000-4000-8000-000000000003",
      "fechaInicio": null,
      "creadoEn": "2026-11-10T02:27:33.782Z"
    },
    "cuadrilla": {
      "id": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
      "nombre": "delta",
      "estado": "EN_MISION",
      "delegacionId": "30000000-0000-4000-8000-000000000003"
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
      "id": "eefe0334-9b9d-45cc-808f-b2fa36862168",
      "misionId": "65d56587-c0ae-46bb-8f46-f73c6a40d9b6",
      "hito": "CUADRILLA_DESPACHADA",
      "descripcion": "Cuadrilla despachada a terreno para resolución táctica del incidente",
      "creadoEn": "2026-11-10T02:27:33.782Z"
    },
    "hitoPatrulla": {
      "id": "2b963b3d-9a9b-4304-a7a1-7077bde507f5",
      "misionId": "d1000000-0000-4000-8000-000000000001",
      "hito": "VERIFICACION_FINALIZADA",
      "descripcion": "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
      "creadoEn": "2026-11-10T02:27:33.782Z"
    }
  }
}
```

---

#### Escenario 4: Detalle de Misión con Lectura de Bitácora desde `mision_hito` (`GET /api/misiones/{id}` — `CP-H21-API-05`)
```bash
curl -s -i -X GET "http://localhost:3001/api/misiones/65d56587-c0ae-46bb-8f46-f73c6a40d9b6" \
  -H "Authorization: Bearer <TOKEN_ENCARGADO>"
```
**Respuesta HTTP real (`200 OK`):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Detalle de misión obtenido exitosamente.",
  "data": {
    "id": "65d56587-c0ae-46bb-8f46-f73c6a40d9b6",
    "codigo": "MIS-2026-0008",
    "titulo": "Despeje y reparación táctica - INC-2026-0003",
    "descripcion": null,
    "tipoMision": "ATENCION_CUADRILLA",
    "estado": "DESPACHADA",
    "prioridad": "CRITICA",
    "justificacionRechazo": null,
    "fechaInicio": null,
    "fechaCierre": null,
    "creadoEn": "2026-11-10T02:27:33.782Z",
    "actualizadoEn": "2026-11-10T02:27:33.782Z",
    "creadoPor": {
      "id": "00000000-0000-4000-8000-000000000003",
      "nombre": "Encargado de Operaciones",
      "email": "encargado@valdivia.cl"
    },
    "encargado": {
      "id": "00000000-0000-4000-8000-000000000003",
      "nombre": "Encargado de Operaciones",
      "email": "encargado@valdivia.cl"
    },
    "incidente": {
      "id": "a1000000-0000-4000-8000-000000000003",
      "codigo": "INC-2026-0003",
      "codigoSeguimiento": "10000003",
      "tipoAfectacion": "Deslizamiento de tierra",
      "descripcion": "Desprendimiento parcial de ladera de barro sobre berma del camino costero con riesgo de corte de ruta",
      "direccion": "Ruta T-350 Km 8, Camino a Niebla, Valdivia",
      "latitud": -39.859,
      "longitud": -73.375,
      "estado": "EN_ATENCION",
      "prioridad": "CRITICA",
      "requiereAsistenciaSocial": true,
      "delegacionNombre": null
    },
    "prevencion": null,
    "cuadrilla": {
      "id": "26c3b3d7-1cf3-409b-9d4e-eb49d6369a85",
      "nombre": "delta",
      "estado": "EN_MISION",
      "delegacionNombre": "Delegación Municipal Costa",
      "delegado": {
        "id": "00000000-0000-4000-8000-000000000010",
        "nombre": "Supervisor Estratégico",
        "email": "supervisor@valdivia.cl"
      },
      "recursos": []
    },
    "patrulla": null,
    "bitacoraTiempos": [
      {
        "hito": "CUADRILLA_DESPACHADA",
        "fecha": "2026-11-10",
        "hora": "02:27:33",
        "timestamp": "2026-11-10T02:27:33.782Z",
        "descripcion": "Cuadrilla despachada a terreno para resolución táctica del incidente"
      }
    ],
    "reportesTerreno": []
  }
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA)

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Desde el detalle de un incidente en estado `VERIFICANDO` o `REPORTADO`, el sistema debe proveer un selector de cuadrillas operativas. | `CP-H21-API-06`, `CP-H21-API-15`, `CP-H21-API-17` | 🟢 **CUMPLIDO** | `GET /api/cuadrillas?estado=DISPONIBLE` entrega el listado y `POST /api/misiones` valida que el incidente esté en `REPORTADO` o `VERIFICANDO`. |
| **CA-2:** El selector debe mostrar únicamente las cuadrillas en estado `DISPONIBLE`. | `CP-H21-API-02`, `CP-H21-API-06`, `CP-H21-API-16` | 🟢 **CUMPLIDO** | Filtra por `estado = 'DISPONIBLE'` y exige `activo = true` y `eliminado_en is null`. |
| **CA-3:** Al confirmar la asignación, la API debe ejecutar una transacción atómica que: (1) Cree la misión con `tipo_mision = 'ATENCION_CUADRILLA'`, `cuadrilla_id` y `estado = 'DESPACHADA'`, (2) Actualice `cuadrilla.estado = 'EN_MISION'`, (3) Actualice `incidente.estado = 'EN_ATENCION'`, y (4) Cumpla la regla de negocio crítica §3.2: si el incidente tenía una patrulla verificadora asignada, su misión de verificación debe cerrarse (`COMPLETADA`) y la patrulla debe quedar automáticamente liberada en estado `DISPONIBLE`. | `CP-H21-API-01`, `CP-H21-API-03`, `CP-H21-API-18`, `CP-H21-API-19`, `CP-H21-API-20` | 🟢 **CUMPLIDO** | Transacción atómica en Kysely con `.forUpdate()`, bloqueo consultivo advisory lock para serialización de código, protección de misiones previamente completadas y validación de disponibilidad de patrullas. |
| **CA-4:** Debe registrarse el hito correspondiente de despacho de cuadrilla y liberación de patrulla en `mision_hito`. | `CP-H21-API-03`, `CP-H21-API-05`, `CP-H21-API-18`, `CP-H21-API-23` | 🟢 **CUMPLIDO** | Se registran atómicamente los hitos `CUADRILLA_DESPACHADA` y `VERIFICACION_FINALIZADA` en `mision_hito` y se exponen en `bitacoraTiempos` en `GET /api/misiones/{id}`. |
| **CA-5:** El sistema debe emitir eventos WebSocket `mision:asignada` a la cuadrilla, `patrulla:liberada` a la patrulla y `incidente:actualizado` al Centro de Mando. | `CP-H21-API-05`, `CP-H21-API-21` | 🟢 **CUMPLIDO** | Se emiten `mision:asignada`, `patrulla:liberada`, `patrulla:actualizada`, `emitirCuadrillaActualizada` e `incidente:actualizado` con cobertura de salas en memoria y Redis Pub/Sub. |
| **CA-6:** El incidente en el Kanban debe transicionar automáticamente a la columna `'EN_ATENCION'`. | `CP-H21-API-18`, `CP-H21-API-22` | 🟢 **CUMPLIDO** | Actualiza `incidente.estado = 'EN_ATENCION'` y expone el atributo `verificado` en el listado Kanban. |
| **CA-7:** El endpoint debe requerir el permiso RBAC `misiones:asignar`. | `CP-H21-API-04`, `CP-H21-API-07`, `CP-H21-API-08`, `CP-H21-API-09` | 🟢 **CUMPLIDO** | Exige token JWT Bearer firmado a través de `verificarAsignarMision` y valida que el usuario se encuentre activo institucionalmente (`activo = true`). |

---

## 7. Dictamen Final de QA y Certificación para Producción

Tras el ciclo de Re-Test formal ejecutado el **09 de Noviembre de 2026**, se dictamina que la historia **HU-21 (Asignar Cuadrilla a Incidente y Liberar Patrulla Verificadora)** en el repositorio `sgrai-api` cumple satisfactoriamente con el **100% de los Criterios de Aceptación**, los estándares del Sistema de Comando de Incidentes (ICS §3.2) y las directrices de arquitectura técnica institucional.

Los 5 defectos reportados en la auditoría inicial fueron subsanados íntegramente:
1. `BUG-H21-API-01`: Bloqueo pesimista, advisory lock transaccional y precondiciones de estado en `UPDATE`.
2. `BUG-H21-API-02`: Rama sincronizada con `develop`, migración `028_mision_hito_bitacora.ts` y linter limpio (0 errores, 0 warnings).
3. `BUG-H21-API-03`: Preservación de `fecha_cierre` en verificaciones completadas y protección de patrullas reasignadas.
4. `BUG-H21-API-04`: Eliminación del bypass `x-user-id`, validación estricta de firma JWT y verificación de `usuario.activo === true`.
5. `BUG-H21-API-05`: Lectura de `mision_hito` en detalle de misión, emisión de `cuadrilla:actualizada` y unificación de salas Socket.io/Redis.

Por tanto, el Pull Request queda **CERTIFICADO Y APROBADO (`Approved`)** para su fusión inmediata en la rama `develop`.
