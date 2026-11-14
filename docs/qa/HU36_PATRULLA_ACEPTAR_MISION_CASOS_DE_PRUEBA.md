# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-36 — Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones de Terreno y Despliegue (`sgrai-api` — `POST /api/misiones/[id]/aceptar`).  
> **Historia de Usuario:** HU-36 — *"Como Patrulla verificadora Quiero confirmar y aceptar la misión asignada desde el dispositivo móvil para informar que el equipo se dirige al lugar. Para notificar a la central que la patrulla ha tomado conocimiento de la emergencia y va en trayecto para iniciar la evaluación."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h36-patrulla-aceptar-mision`  
> **Commits Evaluados en la Rama:**  
> * `feat(db): agregar tabla mision_hito y permiso misiones:terreno:verificar (#37)`  
> * `feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)`  
> * `test(misiones): agregar pruebas unitarias para aceptacion de mision por patrulla (#37)`  
> * `docs(misiones): documentar endpoint de aceptacion de mision y esquema mision_hito (#37)`  
> * `docs(qa): documentar primera versión de casos de prueba para HU-36`  
> * `fix(db): renumerar migracion a 028 y habilitar allowUnorderedMigrations`  
> * `fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36)`  
>  
> **Fecha de Auditoría Inicial:** 09/11/2026 12:15.  
> **Fecha de Re-Test y Certificación Final:** 11/11/2026 11:08.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Cumplidos — 5 Defectos Subsanados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la auditoría integral de **Re-Test** sobre la rama `feature/h36-patrulla-aceptar-mision` mediante inspección estática de código, verificación de bloqueos pesimistas y transacciones ACID contra PostgreSQL 16, validación de migraciones Kysely (`npm run db:migrate`), chequeo de tipos (`npx tsc --noEmit`), análisis estático ESLint (`npm run lint`), validación de contratos OpenAPI 3.0, pruebas en vivo vía HTTP (`POST /api/misiones/[id]/aceptar` y `GET /api/misiones/[id]`), comprobación de publicación Redis Pub/Sub (`sgrai:socket-events`) y ejecución completa de la suite Vitest, se certifica el estado **APROBADO** al comprobarse la subsanación íntegra de los **5 defectos** detectados en la revisión inicial (`BUG-H36-API-01` a `BUG-H36-API-05`).

### Verificación de Correcciones en Re-Test (11/11/2026 11:08)
1. **Validación Estricta de Patrulla Asignada y Pertenencia (`BUG-H36-API-01` — Resuelto):** En `aceptarMisionPatrullaRepo` (`src/modules/misiones/mision.repository.ts:628-653`) se exige explícitamente `misionExistente.patrulla_id !== null` (lanzando `ConflictError` / `409 Conflict` ante misiones de cuadrilla o sin patrulla), y para todo usuario no administrador se valida pertenencia directa como líder (`patrulla_lider_id === usuarioId`) o mediante consulta a `patrulla_personal` sin condicionar al rol del líder. Verificado en vivo con `HTTP 403 Forbidden` sobre la misión `68abde99-780d-41a9-aee6-f68371d226aa` y `HTTP 409 Conflict` sobre `d1000000-0000-4000-8000-000000000004`.
2. **Trazabilidad del Hito `'Misión Aceptada por Patrulla'` en `GET /api/misiones/{id}` (`BUG-H36-API-02` — Resuelto):** `obtenerMisionDetallePorIdRepo` (`src/modules/misiones/mision.repository.ts:313-334`) consulta la tabla `mision_hito` ordenada por `creado_en ASC`, y `obtenerDetalleMisionService` (`src/modules/misiones/mision.service.ts:65-70`) construye `bitacoraTiempos` con los hitos persistidos. Verificado en vivo mediante `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` exponiendo `"hito": "MISION_ACEPTADA"` y `"descripcion": "Misión Aceptada por Patrulla"`.
3. **Sincronización con `develop`, Secuencia de Migraciones y Permiso `misiones:terreno:verificar` (`BUG-H36-API-03` — Resuelto):** La rama incorpora las migraciones de `develop` (`027_`, `028_mision_hito_bitacora.ts`, `032_`, `033_`, `034_`), renumera el permiso RBAC a `035_permiso_misiones_terreno_verificar.ts` y habilita `allowUnorderedMigrations: true` en `src/lib/db/migrator.ts:37`. Verificado con `npm run db:migrate` (código de salida `0`), asignación en `rol_permiso` para `PATRULLA_VERIFICADORA` y `ADMIN`, y aceptación exitosa `HTTP 200 OK` ejecutada con JWT de `PATRULLA_VERIFICADORA`.
4. **Bloqueo Pesimista e Invariantes ICS (`BUG-H36-API-04` — Resuelto):** `aceptarMisionPatrullaRepo` (`src/modules/misiones/mision.repository.ts:621, 655-684`) aplica `.forUpdate("mision")` en PostgreSQL y valida dentro de la transacción que la patrulla esté activa (`eliminado_en IS NULL`) en estado `'EN_VERIFICACION'` y que el incidente asociado (cuando existe) se encuentre en `'VERIFICANDO'`, rechazando con `ConflictError` (`409 Conflict`) cualquier anomalía.
5. **Difusión Simétrica en WebSocket/Redis y Paridad GPS en Zod (`BUG-H36-API-05` — Resuelto):** En `notificarMisionActualizada` (`src/lib/socket/index.ts:786-812`) se eliminó la emisión global duplicada en memoria y se publican eventos simétricos hacia las salas `["encargado", "sala:encargados", "supervisor"]` tanto en Socket.io en memoria como en `REDIS_SOCKET_CHANNEL` (`sgrai:socket-events`). Además, `AceptarMisionInputSchema` (`src/modules/misiones/mision.schema.ts:318-324`) impone paridad obligatoria entre `latitud` y `longitud`, verificado en vivo con `HTTP 400 Bad Request`.

| Métrica de Calidad | Auditoría Inicial (09/11/2026) | Re-Test Final (11/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | **25** | 5 Defectos Subsanados (`BUG-H36-API-01` a `05`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io (`CP-H36-API-01` a `20`) |
| **Casos Aprobados / Corregidos** | **20** | **25** | 20 casos `APROBADO` + 5 defectos `CORREGIDO` en Re-Test (100% de cobertura en backend) |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **0** | 5/5 defectos subsanados (2 críticos, 2 altos, 1 medio) |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Sin bloqueos de infraestructura externa |
| **Tasa de Aprobación Global (% Pass)** | **80.0%** | **100.0%** | Cumplimiento total de los criterios de aceptación backend de HU-36 para merge a `develop` |
| **Suite de Misiones y OpenAPI (Vitest)** | **41/41 tests pass** | **59/59 tests pass** | 9 archivos en `src/app/api/misiones`, `src/modules/misiones` y `src/app/openapi.json` (incluye 24/24 pruebas directas de HU-36/bitácora) |
| **Suite Global del Repositorio (`npm test`)** | *(Con bloqueo en árbol)* | **755/755 tests pass** | 62 archivos de prueba ejecutados en `4.84s` sin omisiones ni fallos |
| **Chequeo de Tipos y ESLint (`tsc` / `lint`)** | Con error heredado | **0 errores** | `npx tsc --noEmit` limpio; `npm run lint` con `0 errors` (`11 warnings` preexistentes fuera de `misiones`) |
| **Migraciones Kysely (`npm run db:migrate`)** | 🔴 **Colisión `033_`/`034_`** | 🟢 **Ejecución limpia (`035_`)** | `028_mision_hito_bitacora.ts` y `035_permiso_misiones_terreno_verificar.ts` aplicadas sin colisiones |

---

## 2. Registro Técnico de Defectos Subsanados

### `BUG-H36-API-01`: Bypass de Autorización de Patrulla Verificadora en `aceptarMisionPatrullaRepo` Cuando `patrulla_id` es `NULL` o el Líder de Patrulla Posee un Rol Distinto a `PATRULLA_VERIFICADORA`
* **Severidad:** **CRÍTICA** (Brecha de Seguridad / Control de Acceso Horizontal entre Unidades Operativas y Violación ICS).
* **Estado Post Re-Test (11/11/2026 11:08):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 628-653).
* **Descripción Técnica del Defecto Inicial:**  
  En la implementación inicial de `aceptarMisionPatrullaRepo`, la validación omitía verificar que `misionExistente.patrulla_id` no fuera `null` y condicionaba la consulta a `patrulla_personal` mediante `&& liderEsPatrulla`. Esto permitía aceptar misiones de cuadrillas (`patrulla_id = null`) y omitía el control de pertenencia cuando el líder asignado a la patrulla tenía un rol distinto a `PATRULLA_VERIFICADORA` (ej. `ENCARGADO`).
* **Solución Aplicada y Verificada en Re-Test:**  
  1. Se incorporó validación explícita para rechazar misiones sin patrulla asignada (`!misionExistente.patrulla_id`) lanzando `ConflictError` (`HTTP 409`).
  2. Se eliminó la condición `liderEsPatrulla`; todo usuario con `!esAdmin` que no sea `patrulla_lider_id` pasa obligatoriamente por la consulta a `patrulla_personal` vinculada a `personal.usuario_id`, lanzando `ForbiddenError` (`HTTP 403`) si no es integrante.
  3. Verificado en pruebas unitarias (`src/modules/misiones/__tests__/mision-aceptar.repository.test.ts:187-222`) y en vivo contra PostgreSQL sobre `68abde99-780d-41a9-aee6-f68371d226aa` (`HTTP 403 Forbidden`) y `d1000000-0000-4000-8000-000000000004` (`HTTP 409 Conflict`).

---

### `BUG-H36-API-02`: Omisión de Consulta a la Tabla `mision_hito` en `obtenerMisionDetallePorIdRepo` y `obtenerDetalleMisionService` — El Hito `'Misión Aceptada por Patrulla'` No se Refleja en la Bitácora del Centro de Mando (`GET /api/misiones/{id}`)
* **Severidad:** **CRÍTICA** (Incumplimiento de Trazabilidad de Bitácora del Centro de Mando y Criterio de Aceptación 3).
* **Estado Post Re-Test (11/11/2026 11:08):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 313-334)
  * `src/modules/misiones/mision.service.ts` (Líneas 65-70)
  * `src/modules/misiones/__tests__/mision.service.test.ts` (5 tests)
* **Descripción Técnica del Defecto Inicial:**  
  `obtenerMisionDetallePorIdRepo` no consultaba `mision_hito` y `obtenerDetalleMisionService` solo armaba `bitacoraTiempos` con hitos sintéticos derivados de columnas de `mision`, impidiendo que el Centro de Mando visualizara `'Misión Aceptada por Patrulla'` al consultar `GET /api/misiones/{id}`.
* **Solución Aplicada y Verificada en Re-Test:**  
  `obtenerMisionDetallePorIdRepo` ejecuta `SELECT` sobre `mision_hito` filtrado por `mision_id` y ordenado por `creado_en ASC`, retornando el arreglo `hitos`. En `obtenerDetalleMisionService`, si existen hitos persistidos, estos pueblan `bitacoraTiempos` preservando la cronología exacta. Verificado en vivo invocando `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` tras aceptar la misión (`bitacoraTiempos` incluye `DESPACHADA` seguido de `MISION_ACEPTADA`: `"Misión Aceptada por Patrulla"`).

---

### `BUG-H36-API-03`: Desfase de 39 Commits con `develop`, Colisión de Numeración en Migraciones Kysely (`033_` y `034_`) y Fallo de `npm run db:migrate` que Impide Aplicar el Permiso `misiones:terreno:verificar`
* **Severidad:** **ALTA** (Ruptura de Integración Continua, Corrupción del Árbol de Migraciones Kysely y Bloqueo RBAC en Entorno Integrado).
* **Estado Post Re-Test (11/11/2026 11:08):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/lib/db/migrator.ts` (Línea 37 — `allowUnorderedMigrations: true`)
  * `src/lib/db/migrations/028_mision_hito_bitacora.ts`
  * `src/lib/db/migrations/035_permiso_misiones_terreno_verificar.ts`
* **Descripción Técnica del Defecto Inicial:**  
  La rama carecía de las migraciones integradas en `develop` (`027_`, `032_`, `033_`, `034_`) y colisionaba en los prefijos `033_` y `034_`, abortando `npm run db:migrate` con `corrupted migrations` y dejando al rol `PATRULLA_VERIFICADORA` sin el permiso `misiones:terreno:verificar` (`HTTP 403`).
* **Solución Aplicada y Verificada en Re-Test:**  
  Se integraron las migraciones base desde `develop`, se consolidó `028_mision_hito_bitacora.ts`, se renumeró el permiso RBAC a `035_permiso_misiones_terreno_verificar.ts` y se habilitó `allowUnorderedMigrations: true` en `src/lib/db/migrator.ts`. Verificado ejecutando `npm run db:migrate` (éxito), confirmando `rol_permiso` para `PATRULLA_VERIFICADORA` y `ADMIN`, ejecutando `npm run lint` (`0 errors`) y aceptando en vivo una misión con usuario `PATRULLA_VERIFICADORA` (`HTTP 200 OK`).

---

### `BUG-H36-API-04`: Ausencia de Bloqueo Pesimista (`forUpdate()`) y de Validación de Invariantes ICS sobre Patrulla (`EN_VERIFICACION` / Activa) e Incidente (`VERIFICANDO`) en `aceptarMisionPatrullaRepo`
* **Severidad:** **ALTA** (Violación del Criterio de Aceptación 4 e Inconsistencia de Estado Operativo ICS).
* **Estado Post Re-Test (11/11/2026 11:08):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 621 y 655-684).
* **Descripción Técnica del Defecto Inicial:**  
  La lectura inicial dentro de la transacción carecía de `.forUpdate("mision")` y no validaba que la patrulla siguiera activa (`eliminado_en IS NULL`) en `'EN_VERIFICACION'` ni que el incidente estuviera en `'VERIFICANDO'`, permitiendo transicionar misiones asociadas a patrullas dadas de baja o incidentes ya cerrados.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se agregó `.forUpdate("mision")` al `SELECT` inicial dentro de `db.transaction()` (verificado en ejecución real contra PostgreSQL 16) y se añadieron validaciones explícitas que lanzan `ConflictError` (`HTTP 409`) si `patrulla_eliminado_en !== null`, `patrulla_estado !== "EN_VERIFICACION"` o `incidente_id && incidente_estado !== "VERIFICANDO"`. Cubierto en pruebas unitarias (`src/modules/misiones/__tests__/mision-aceptar.repository.test.ts:224-260`) y validado en flujo real `200 OK`.

---

### `BUG-H36-API-05`: Asimetría de Emisión WebSocket en `notificarMisionActualizada` (Duplicidad en Memoria vs Omisión de Salas en Redis) y Falta de Validación de Paridad de Coordenadas GPS en `AceptarMisionInputSchema`
* **Severidad:** **MEDIA** (Desincronización de Tiempo Real en Redis Pub/Sub y Validación Incompleta de Payload Geográfico).
* **Estado Post Re-Test (11/11/2026 11:08):** 🟢 **`CORREGIDO` Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (Líneas 786-812)
  * `src/modules/misiones/mision.schema.ts` (Líneas 318-324)
* **Descripción Técnica del Defecto Inicial:**  
  En `notificarMisionActualizada`, la rama en memoria ejecutaba además un broadcast global duplicado y la rama Redis publicaba únicamente hacia `room: "encargado"`, omitiendo `"sala:encargados"` y `"supervisor"`. Asimismo, `AceptarMisionInputSchema` admitía enviar `latitud` sin `longitud` o viceversa.
* **Solución Aplicada y Verificada en Re-Test:**  
  1. `notificarMisionActualizada` utiliza el arreglo unificado `rooms = ["encargado", "sala:encargados", "supervisor"]`, eliminó `(ioInstance as any).emit(...)` y publica los tres mensajes simétricos en `REDIS_SOCKET_CHANNEL` (`sgrai:socket-events`). Verificado en vivo suscribiéndose a Redis durante la petición HTTP `POST /aceptar`.
  2. `AceptarMisionInputSchema` incorpora `.refine((data) => !data || (data.latitud !== undefined) === (data.longitud !== undefined), ...)` sobre el path `["longitud"]`, rechazando en vivo coordenadas parciales con `HTTP 400 Bad Request` y verificado en `src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H36-API-01` | Bypass de autorización de patrulla cuando patrulla_id es null o cuando el líder de la patrulla posee un rol distinto a PATRULLA_VERIFICADORA | Seguridad / Regla de Negocio ICS | Repositorio / BD | Crítica | Misión DESPACHADA asignada a patrulla con líder ENCARGADO o misión sin patrulla_id | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `x-user-id: d1000000-0000-4000-8000-000000000001` y `POST /api/misiones/d1000000-0000-4000-8000-000000000004/aceptar` | HTTP 403 Forbidden ante patrulla ajena sin importar rol del líder y HTTP 409 Conflict si patrulla_id es null | HTTP 403 Forbidden (`No está autorizado para aceptar una misión asignada a otra patrulla verificadora.`) y HTTP 409 Conflict (`La misión indicada no tiene una patrulla verificadora asignada.`) | CORREGIDO | 09/11/2026 12:10 | 11/11/2026 11:05 | fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36) |
| `BUG-H36-API-02` | Omisión de consulta a mision_hito en obtenerMisionDetallePorIdRepo impidiendo reflejar el hito Misión Aceptada por Patrulla en bitácora | Funcional / Trazabilidad ICS | Repositorio / Servicio | Crítica | Misión `247be4dd-a0b8-490f-8d66-4de1144ddd02` aceptada mediante `POST /api/misiones/{id}/aceptar` | `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` con `Authorization: Bearer <token_encargado>` | `data.bitacoraTiempos` incluye el hito `MISION_ACEPTADA` (`"Misión Aceptada por Patrulla"`) persistido en `mision_hito` | HTTP 200 OK retornando `bitacoraTiempos` cronológica con `DESPACHADA` y `MISION_ACEPTADA` (`"Misión Aceptada por Patrulla"`) | CORREGIDO | 09/11/2026 12:12 | 11/11/2026 11:06 | fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36) |
| `BUG-H36-API-03` | Desfase de 39 commits con develop y colisión de migraciones Kysely 033_ y 034_ bloqueando npm run db:migrate y permiso misiones:terreno:verificar | Integración / Base de Datos | Migraciones / RBAC | Alta | Base de datos sincronizada con `develop` y migraciones `028_` y `035_` en la rama | `npm run db:migrate` y `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar` con JWT de `PATRULLA_VERIFICADORA` | Migraciones ejecutadas sin colisión y rol `PATRULLA_VERIFICADORA` autorizado con `misiones:terreno:verificar` | `npm run db:migrate` finaliza con código 0 (`035_permiso_misiones_terreno_verificar`) y usuario `PATRULLA_VERIFICADORA` acepta misión con HTTP 200 OK | CORREGIDO | 09/11/2026 12:14 | 11/11/2026 11:06 | fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36) |
| `BUG-H36-API-04` | Ausencia de bloqueo pesimista forUpdate() y falta de validación de invariantes ICS sobre patrulla activa (EN_VERIFICACION) e incidente (VERIFICANDO) | Regla de Negocio / Concurrencia ICS | Repositorio / BD | Alta | Misión DESPACHADA con `.forUpdate("mision")`; caso patrulla inactiva o incidente `RESUELTO` | `POST /api/misiones/{id}/aceptar` y tests de `mision-aceptar.repository.test.ts` | Bloqueo `.forUpdate("mision")` funcional en PostgreSQL y rechazo `409 Conflict` ante patrulla de baja/no `EN_VERIFICACION` o incidente no `VERIFICANDO` | `.forUpdate("mision")` validado en PostgreSQL 16 y rechazo `ConflictError` verificado en `mision-aceptar.repository.test.ts` (líneas 224-260) | CORREGIDO | 09/11/2026 12:15 | 11/11/2026 11:07 | fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36) |
| `BUG-H36-API-05` | Asimetría de difusión WebSocket mision:actualizada entre memoria y Redis Pub/Sub y aceptación de coordenada GPS huérfana sin paridad | Tiempo Real / Validación Zod | Socket / Schema | Media | `REDIS_URL=redis://localhost:6001` activo y envío de payload con coordenada GPS incompleta | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `{"latitud":-39.819588}` o `{"longitud":-73.245209}` y escucha en `sgrai:socket-events` | Emisión simétrica en Redis hacia `encargado`, `sala:encargados` y `supervisor` sin broadcast duplicado y `400 Bad Request` ante GPS parcial | Canal `sgrai:socket-events` recibe 3 mensajes (`encargado`, `sala:encargados`, `supervisor`) y API responde `HTTP 400 Bad Request` en campo `longitud` | CORREGIDO | 09/11/2026 12:15 | 11/11/2026 11:06 | fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36) |
| `CP-H36-API-01` | Aceptación exitosa de misión en estado DESPACHADA sin cuerpo en la petición (`200 OK`) | Funcional / Positiva | Integración / Route Handler | Crítica | Misión en estado `DESPACHADA` y usuario autorizado | `POST /api/misiones/{id}/aceptar` sin body en `route.test.ts` y `mision-aceptar.repository.test.ts` | HTTP 200 OK con `mision.estado: "EN_CURSO"`, `fechaInicio` ISO 8601 y `hito.hito: "MISION_ACEPTADA"` | HTTP 200 OK con transición a `EN_CURSO` e hito registrado (suite Vitest 100% pass) | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:07 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-02` | Aceptación exitosa de misión en estado DESPACHADA enviando coordenadas GPS válidas desde la PWA (`200 OK`) | Funcional / Positiva | Integración / Endpoint | Crítica | Misión `247be4dd-a0b8-490f-8d66-4de1144ddd02` en estado `DESPACHADA` y JWT de `d1000000-0000-4000-8000-000000000001` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar` con `{"latitud":-39.819588,"longitud":-73.245209}` | HTTP 200 OK persistiendo `latitud: -39.819588` y `longitud: -73.245209` en `data.hito` | HTTP 200 OK con coordenadas GPS almacenadas en `mision_hito` y devueltas en `data.hito` | APROBADO | 09/11/2026 12:16 | 11/11/2026 11:06 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-03` | Fijación automática de `mision.fecha_inicio = CURRENT_TIMESTAMP` y `mision.actualizado_en = CURRENT_TIMESTAMP` al aceptar | Integridad / Base de Datos | Repositorio / Transacción | Crítica | Misión `247be4dd-a0b8-490f-8d66-4de1144ddd02` en estado `DESPACHADA` con `fecha_inicio = null` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar` con JWT de patrullero asignado | Columnas `fecha_inicio` y `actualizado_en` actualizadas con timestamp del servidor en formato ISO 8601 | `fechaInicio` y `actualizadoEn` fijados atómicamente en `2026-11-11T14:06:42.614Z` | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:06 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-04` | Registro automático del hito `'MISION_ACEPTADA'` con glosa `'Misión Aceptada por Patrulla'` y `registrado_por_id` en `mision_hito` | Funcional / Auditoría ICS | Repositorio / Transacción | Crítica | Misión `247be4dd-a0b8-490f-8d66-4de1144ddd02` en estado `DESPACHADA` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar` | Inserción en `mision_hito` con `hito: "MISION_ACEPTADA"`, `descripcion: "Misión Aceptada por Patrulla"` y `registrado_por_id` del usuario en sesión | Registro insertado en `mision_hito` (`registradoPorId: d1000000-0000-4000-8000-000000000001`) y retornado en `data.hito` | APROBADO | 09/11/2026 12:16 | 11/11/2026 11:06 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-05` | Preservación del estado canónico `VERIFICANDO` en el incidente y `EN_VERIFICACION` en la patrulla al aceptar misión (evitando estado ambiguo `'En camino'`) | Regla de Negocio ICS | Servicio / Repositorio | Crítica | Misión `247be4dd-a0b8-490f-8d66-4de1144ddd02` con incidente `INC-2026-9932` en `VERIFICANDO` y patrulla en `EN_VERIFICACION` | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar` | `data.patrulla.estado === "EN_VERIFICACION"` y `data.incidente.estado === "VERIFICANDO"` (nunca `"En camino"`) | Retorna `patrulla.estado: "EN_VERIFICACION"` e `incidente.estado: "VERIFICANDO"` | APROBADO | 09/11/2026 12:16 | 11/11/2026 11:06 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-06` | Emisión del evento WebSocket `mision:actualizada` al aceptar la misión exitosamente | Tiempo Real / Socket.io | Servicio / Redis | Alta | Servicio `aceptarMisionService` ejecutado exitosamente y Redis Pub/Sub activo | `POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar` y `mision-aceptar.service.test.ts` | Emisión de `mision:actualizada` con `misionId`, `codigo`, `estado: "EN_CURSO"`, `fechaInicio` y objeto `hito` | Emisión verificada en `mision-aceptar.service.test.ts` y capturada en canal Redis `sgrai:socket-events` | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:06 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-07` | Rechazo de petición sin credenciales de autenticación (`401 Unauthorized`) | Seguridad / Autenticación | Route Handler | Crítica | Petición sin cabecera `Authorization` ni `x-user-id` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` sin cabeceras | HTTP 401 Unauthorized con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | HTTP 401 Unauthorized con el mensaje esperado | APROBADO | 09/11/2026 12:14 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-08` | Rechazo RBAC para usuario con rol sin permiso `misiones:terreno:verificar` (`403 Forbidden`) | Seguridad / RBAC | Route Handler / Auth | Crítica | Usuario con rol `CALL_CENTER` (`c1111111-1111-4111-8111-111111111111`) | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `x-user-id: c1111111-1111-4111-8111-111111111111` | HTTP 403 Forbidden indicando ausencia del permiso `misiones:terreno:verificar` | HTTP 403 Forbidden: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-09` | Rechazo por intento de aceptar misión asignada a otra patrulla verificadora (`403 Forbidden`) | Seguridad / Autorización | Repositorio / Servicio | Alta | Misión asignada a una patrulla e invocada por un patrullero de otra unidad | `aceptarMisionPatrullaRepo(misionId, otroPatrulleroId, false)` y prueba viva con `68abde99-...` | Lanza `ForbiddenError` (`403`) y no emite evento WebSocket | HTTP 403 Forbidden (`"No está autorizado para aceptar una misión asignada a otra patrulla verificadora."`) | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-10` | Rechazo por parámetro de ruta `id` con formato UUID inválido (`400 Bad Request`) | Validación / Contrato | Route Handler / Zod | Media | Petición con `id` no UUID en la URL | `POST /api/misiones/id-no-es-uuid/aceptar` con `x-user-id: d1000000-0000-4000-8000-000000000001` | HTTP 400 Bad Request con mensaje `"El identificador de la misión proporcionado no es un UUID válido."` | HTTP 400 Bad Request con detalle de error en `errors[0].campo = "id"` | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-11` | Rechazo por cuerpo de petición con sintaxis JSON malformada (`400 Bad Request`) | Validación / Robustez | Route Handler | Media | Cabecera `Content-Type: application/json` y cuerpo `{malformed` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `-d "{malformed"` | HTTP 400 Bad Request con mensaje `"El cuerpo de la petición no es un JSON válido."` | HTTP 400 Bad Request: `{"message":"El cuerpo de la petición no es un JSON válido."}` | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-12` | Rechazo por coordenadas GPS fuera de rango geográfico WGS84 (`latitud < -90` o `> 90`, `longitud < -180` o `> 180`) (`400 Bad Request`) | Validación / Esquema Zod | Route Handler / Schema | Media | Payload con `{"latitud": -120, "longitud": -73.245}` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `{"latitud":-120,"longitud":-73.245}` | HTTP 400 Bad Request con mensaje `"Datos de entrada inválidos."` y detalle en `latitud` | HTTP 400 Bad Request: `{"message":"Datos de entrada inválidos.","errors":[{"campo":"latitud","mensaje":"La latitud no puede ser menor a -90."}]}` | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-13` | Rechazo cuando el identificador UUID de la misión no existe en la base de datos (`404 Not Found`) | Funcional / Negativa | Repositorio / Route Handler | Alta | UUID `60000000-0000-4000-8000-000000000999` inexistente en `mision` | `POST /api/misiones/60000000-0000-4000-8000-000000000999/aceptar` con `x-user-id: d1000000-0000-4000-8000-000000000001` | HTTP 404 Not Found con mensaje `"No se encontró ninguna misión con el identificador proporcionado."` | HTTP 404 Not Found con el mensaje esperado | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-14` | Control de concurrencia e idempotencia: rechazo cuando la misión ya se encuentra en estado `EN_CURSO` (`409 Conflict`) | Concurrencia / Regla de Negocio | Repositorio / Endpoint | Crítica | Misión `d1000000-0000-4000-8000-000000000001` en estado `EN_CURSO` (o reintento concurrente sobre `247be4dd-...`) | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/aceptar` con `x-user-id: 00000000-0000-4000-8000-000000000001` | HTTP 409 Conflict indicando que el estado actual es `'EN_CURSO'` y solo se aceptan misiones `'DESPACHADA'` | HTTP 409 Conflict: `{"message":"La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}` | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-15` | Rechazo de transición cuando la misión con patrulla asignada se encuentra en estado cerrado `COMPLETADA`, `CANCELADA` o `RECHAZADA` (`409 Conflict`) | Regla de Negocio ICS | Repositorio / Endpoint | Alta | Misión `f3a3c065-8c1b-4fb8-a79a-2ca53447108a` (`MIS-2026-0005`) en estado `COMPLETADA` | `POST /api/misiones/f3a3c065-8c1b-4fb8-a79a-2ca53447108a/aceptar` con `x-user-id: 00000000-0000-4000-8000-000000000001` | HTTP 409 Conflict bloqueando la transición e impidiendo insertar hitos en `mision_hito` | HTTP 409 Conflict: `{"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}` | APROBADO | 09/11/2026 12:15 | 11/11/2026 11:05 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-16` | Definición estructural de la tabla `mision_hito` e índices `idx_mision_hito_mision_id` e `idx_mision_hito_creado_en` | Base de Datos / Esquema | Migración / Tipos Kysely | Alta | Migraciones `028_mision_hito_bitacora.ts` y `035_permiso_misiones_terreno_verificar.ts` aplicadas | `npm run db:migrate` e inspección de `mision_hito` y `rol_permiso` en PostgreSQL | Columnas `id`, `mision_id` (FK cascade), `hito`, `descripcion`, `registrado_por_id` (FK set null), `latitud`, `longitud`, `creado_en` e índices creados | Tabla `mision_hito`, migración `028_` y permiso `misiones:terreno:verificar` (`035_`) activos en PostgreSQL | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:07 | fix(db): renumerar migracion a 028 y habilitar allowUnorderedMigrations |
| `CP-H36-API-17` | Registro del contrato OpenAPI 3.0 para `POST /api/misiones/{id}/aceptar` y esquemas `AceptarMisionInput`, `MisionHitoRegistrado` y `AceptarMisionResponse` | Contrato API / OpenAPI | Especificación OpenAPI | Alta | Generador OpenAPI en `src/lib/openapi/index.ts` | `npm test -- src/app/openapi.json/__tests__/route.test.ts` y `GET /openapi.json` | Operación `POST /api/misiones/{id}/aceptar` documentada con respuestas `200`, `400`, `401`, `403`, `404`, `409` y `500` | Endpoint `GET /openapi.json` expone las 7 respuestas y `AceptarMisionInput`; test de contrato aprobado | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:07 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-18` | Resiliencia del endpoint si la emisión del evento WebSocket `mision:actualizada` lanza una excepción | Robustez / Tolerancia a Fallos | Servicio | Media | `notificarMisionActualizada` rodeado de bloque `try/catch` en `aceptarMisionService` | Ejecución de `mision-aceptar.service.test.ts` | La transacción en BD se mantiene confirmada y el servicio retorna `200 OK` registrando el error en log | `aceptarMisionService` captura errores de socket sin revertir la aceptación persistida (`4/4` tests pass) | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:07 | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-19` | Documentación técnica del endpoint `POST /api/misiones/{id}/aceptar` y de la tabla `mision_hito` en `docs/api/misiones.md` y `docs/database/README.md` | Documentación | Documentación Técnica | Media | Archivos `docs/api/misiones.md` y `docs/database/README.md` | Revisión de sección `3.4. POST /api/misiones/{id}/aceptar` y diccionario de datos | Reglas de transición atómica, invariantes ICS, payload, paridad GPS y salas WebSocket documentadas | Documentación verificada en `docs/api/misiones.md` (sección 3.4 y 4) y `docs/database/README.md` | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:08 | docs(misiones): documentar endpoint de aceptacion de mision y esquema mision_hito (#37) |
| `CP-H36-API-20` | Ejecución completa de la suite de pruebas automatizadas en Vitest (módulo Misiones y suite global) | Automatización | Unit / Service / Route / Repo | Alta | Entorno de pruebas Vitest en `sgrai-api` | `npm test -- src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts src/modules/misiones/__tests__/mision-aceptar.service.test.ts src/modules/misiones/__tests__/mision-aceptar.repository.test.ts src/modules/misiones/__tests__/mision.service.test.ts` y `npm test` | 24/24 tests directos de HU-36 y bitácora aprobados; 59/59 en módulo Misiones+OpenAPI y 755/755 en suite global | 24/24 tests directos (8 route + 4 service + 7 repository + 5 detalle), 59/59 Misiones+OpenAPI y 755/755 global aprobados | APROBADO | 09/11/2026 12:11 | 11/11/2026 11:07 | test(misiones): agregar pruebas unitarias para aceptacion de mision por patrulla (#37) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H36-API-01	Bypass de autorización de patrulla cuando patrulla_id es null o cuando el líder de la patrulla posee un rol distinto a PATRULLA_VERIFICADORA	Seguridad / Regla de Negocio ICS	Repositorio / BD	Crítica	Misión DESPACHADA asignada a patrulla con líder ENCARGADO o misión sin patrulla_id	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con x-user-id: d1000000-0000-4000-8000-000000000001 y POST /api/misiones/d1000000-0000-4000-8000-000000000004/aceptar	HTTP 403 Forbidden ante patrulla ajena sin importar rol del líder y HTTP 409 Conflict si patrulla_id es null	HTTP 403 Forbidden (No está autorizado para aceptar una misión asignada a otra patrulla verificadora.) y HTTP 409 Conflict (La misión indicada no tiene una patrulla verificadora asignada.)	CORREGIDO	09/11/2026 12:10	11/11/2026 11:05	fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36)
BUG-H36-API-02	Omisión de consulta a mision_hito en obtenerMisionDetallePorIdRepo impidiendo reflejar el hito Misión Aceptada por Patrulla en bitácora	Funcional / Trazabilidad ICS	Repositorio / Servicio	Crítica	Misión 247be4dd-a0b8-490f-8d66-4de1144ddd02 aceptada mediante POST /api/misiones/{id}/aceptar	GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02 con Authorization: Bearer <token_encargado>	data.bitacoraTiempos incluye el hito MISION_ACEPTADA ("Misión Aceptada por Patrulla") persistido en mision_hito	HTTP 200 OK retornando bitacoraTiempos cronológica con DESPACHADA y MISION_ACEPTADA ("Misión Aceptada por Patrulla")	CORREGIDO	09/11/2026 12:12	11/11/2026 11:06	fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36)
BUG-H36-API-03	Desfase de 39 commits con develop y colisión de migraciones Kysely 033_ y 034_ bloqueando npm run db:migrate y permiso misiones:terreno:verificar	Integración / Base de Datos	Migraciones / RBAC	Alta	Base de datos sincronizada con develop y migraciones 028_ y 035_ en la rama	npm run db:migrate y POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar con JWT de PATRULLA_VERIFICADORA	Migraciones ejecutadas sin colisión y rol PATRULLA_VERIFICADORA autorizado con misiones:terreno:verificar	npm run db:migrate finaliza con código 0 (035_permiso_misiones_terreno_verificar) y usuario PATRULLA_VERIFICADORA acepta misión con HTTP 200 OK	CORREGIDO	09/11/2026 12:14	11/11/2026 11:06	fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36)
BUG-H36-API-04	Ausencia de bloqueo pesimista forUpdate() y falta de validación de invariantes ICS sobre patrulla activa (EN_VERIFICACION) e incidente (VERIFICANDO)	Regla de Negocio / Concurrencia ICS	Repositorio / BD	Alta	Misión DESPACHADA con .forUpdate("mision"); caso patrulla inactiva o incidente RESUELTO	POST /api/misiones/{id}/aceptar y tests de mision-aceptar.repository.test.ts	Bloqueo .forUpdate("mision") funcional en PostgreSQL y rechazo 409 Conflict ante patrulla de baja/no EN_VERIFICACION o incidente no VERIFICANDO	.forUpdate("mision") validado en PostgreSQL 16 y rechazo ConflictError verificado en mision-aceptar.repository.test.ts (líneas 224-260)	CORREGIDO	09/11/2026 12:15	11/11/2026 11:07	fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36)
BUG-H36-API-05	Asimetría de difusión WebSocket mision:actualizada entre memoria y Redis Pub/Sub y aceptación de coordenada GPS huérfana sin paridad	Tiempo Real / Validación Zod	Socket / Schema	Media	REDIS_URL=redis://localhost:6001 activo y envío de payload con coordenada GPS incompleta	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con {"latitud":-39.819588} o {"longitud":-73.245209} y escucha en sgrai:socket-events	Emisión simétrica en Redis hacia encargado, sala:encargados y supervisor sin broadcast duplicado y 400 Bad Request ante GPS parcial	Canal sgrai:socket-events recibe 3 mensajes (encargado, sala:encargados, supervisor) y API responde HTTP 400 Bad Request en campo longitud	CORREGIDO	09/11/2026 12:15	11/11/2026 11:06	fix(misiones): resolver observaciones de qa sobre pertenencia de patrulla, bitacora, migraciones, invariantes ics y sockets (HU-36)
CP-H36-API-01	Aceptación exitosa de misión en estado DESPACHADA sin cuerpo en la petición (200 OK)	Funcional / Positiva	Integración / Route Handler	Crítica	Misión en estado DESPACHADA y usuario autorizado	POST /api/misiones/{id}/aceptar sin body en route.test.ts y mision-aceptar.repository.test.ts	HTTP 200 OK con mision.estado: "EN_CURSO", fechaInicio ISO 8601 y hito.hito: "MISION_ACEPTADA"	HTTP 200 OK con transición a EN_CURSO e hito registrado (suite Vitest 100% pass)	APROBADO	09/11/2026 12:11	11/11/2026 11:07	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-02	Aceptación exitosa de misión en estado DESPACHADA enviando coordenadas GPS válidas desde la PWA (200 OK)	Funcional / Positiva	Integración / Endpoint	Crítica	Misión 247be4dd-a0b8-490f-8d66-4de1144ddd02 en estado DESPACHADA y JWT de d1000000-0000-4000-8000-000000000001	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar con {"latitud":-39.819588,"longitud":-73.245209}	HTTP 200 OK persistiendo latitud: -39.819588 y longitud: -73.245209 en data.hito	HTTP 200 OK con coordenadas GPS almacenadas en mision_hito y devueltas en data.hito	APROBADO	09/11/2026 12:16	11/11/2026 11:06	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-03	Fijación automática de mision.fecha_inicio = CURRENT_TIMESTAMP y mision.actualizado_en = CURRENT_TIMESTAMP al aceptar	Integridad / Base de Datos	Repositorio / Transacción	Crítica	Misión 247be4dd-a0b8-490f-8d66-4de1144ddd02 en estado DESPACHADA con fecha_inicio = null	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar con JWT de patrullero asignado	Columnas fecha_inicio y actualizado_en actualizadas con timestamp del servidor en formato ISO 8601	fechaInicio y actualizadoEn fijados atómicamente en 2026-11-11T14:06:42.614Z	APROBADO	09/11/2026 12:11	11/11/2026 11:06	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-04	Registro automático del hito 'MISION_ACEPTADA' con glosa 'Misión Aceptada por Patrulla' y registrado_por_id en mision_hito	Funcional / Auditoría ICS	Repositorio / Transacción	Crítica	Misión 247be4dd-a0b8-490f-8d66-4de1144ddd02 en estado DESPACHADA	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar	Inserción en mision_hito con hito: "MISION_ACEPTADA", descripcion: "Misión Aceptada por Patrulla" y registrado_por_id del usuario en sesión	Registro insertado en mision_hito (registradoPorId: d1000000-0000-4000-8000-000000000001) y retornado en data.hito	APROBADO	09/11/2026 12:16	11/11/2026 11:06	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-05	Preservación del estado canónico VERIFICANDO en el incidente y EN_VERIFICACION en la patrulla al aceptar misión (evitando estado ambiguo 'En camino')	Regla de Negocio ICS	Servicio / Repositorio	Crítica	Misión 247be4dd-a0b8-490f-8d66-4de1144ddd02 con incidente INC-2026-9932 en VERIFICANDO y patrulla en EN_VERIFICACION	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar	data.patrulla.estado === "EN_VERIFICACION" y data.incidente.estado === "VERIFICANDO" (nunca "En camino")	Retorna patrulla.estado: "EN_VERIFICACION" e incidente.estado: "VERIFICANDO"	APROBADO	09/11/2026 12:16	11/11/2026 11:06	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-06	Emisión del evento WebSocket mision:actualizada al aceptar la misión exitosamente	Tiempo Real / Socket.io	Servicio / Redis	Alta	Servicio aceptarMisionService ejecutado exitosamente y Redis Pub/Sub activo	POST /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar y mision-aceptar.service.test.ts	Emisión de mision:actualizada con misionId, codigo, estado: "EN_CURSO", fechaInicio y objeto hito	Emisión verificada en mision-aceptar.service.test.ts y capturada en canal Redis sgrai:socket-events	APROBADO	09/11/2026 12:11	11/11/2026 11:06	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-07	Rechazo de petición sin credenciales de autenticación (401 Unauthorized)	Seguridad / Autenticación	Route Handler	Crítica	Petición sin cabecera Authorization ni x-user-id	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar sin cabeceras	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	HTTP 401 Unauthorized con el mensaje esperado	APROBADO	09/11/2026 12:14	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-08	Rechazo RBAC para usuario con rol sin permiso misiones:terreno:verificar (403 Forbidden)	Seguridad / RBAC	Route Handler / Auth	Crítica	Usuario con rol CALL_CENTER (c1111111-1111-4111-8111-111111111111)	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con x-user-id: c1111111-1111-4111-8111-111111111111	HTTP 403 Forbidden indicando ausencia del permiso misiones:terreno:verificar	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-09	Rechazo por intento de aceptar misión asignada a otra patrulla verificadora (403 Forbidden)	Seguridad / Autorización	Repositorio / Servicio	Alta	Misión asignada a una patrulla e invocada por un patrullero de otra unidad	aceptarMisionPatrullaRepo(misionId, otroPatrulleroId, false) y prueba viva con 68abde99-...	Lanza ForbiddenError (403) y no emite evento WebSocket	HTTP 403 Forbidden ("No está autorizado para aceptar una misión asignada a otra patrulla verificadora.")	APROBADO	09/11/2026 12:11	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-10	Rechazo por parámetro de ruta id con formato UUID inválido (400 Bad Request)	Validación / Contrato	Route Handler / Zod	Media	Petición con id no UUID en la URL	POST /api/misiones/id-no-es-uuid/aceptar con x-user-id: d1000000-0000-4000-8000-000000000001	HTTP 400 Bad Request con mensaje "El identificador de la misión proporcionado no es un UUID válido."	HTTP 400 Bad Request con detalle de error en errors[0].campo = "id"	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-11	Rechazo por cuerpo de petición con sintaxis JSON malformada (400 Bad Request)	Validación / Robustez	Route Handler	Media	Cabecera Content-Type: application/json y cuerpo {malformed	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con -d "{malformed"	HTTP 400 Bad Request con mensaje "El cuerpo de la petición no es un JSON válido."	HTTP 400 Bad Request: {"message":"El cuerpo de la petición no es un JSON válido."}	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-12	Rechazo por coordenadas GPS fuera de rango geográfico WGS84 (latitud < -90 o > 90, longitud < -180 o > 180) (400 Bad Request)	Validación / Esquema Zod	Route Handler / Schema	Media	Payload con {"latitud": -120, "longitud": -73.245}	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con {"latitud":-120,"longitud":-73.245}	HTTP 400 Bad Request con mensaje "Datos de entrada inválidos." y detalle en latitud	HTTP 400 Bad Request: {"message":"Datos de entrada inválidos.","errors":[{"campo":"latitud","mensaje":"La latitud no puede ser menor a -90."}]}	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-13	Rechazo cuando el identificador UUID de la misión no existe en la base de datos (404 Not Found)	Funcional / Negativa	Repositorio / Route Handler	Alta	UUID 60000000-0000-4000-8000-000000000999 inexistente en mision	POST /api/misiones/60000000-0000-4000-8000-000000000999/aceptar con x-user-id: d1000000-0000-4000-8000-000000000001	HTTP 404 Not Found con mensaje "No se encontró ninguna misión con el identificador proporcionado."	HTTP 404 Not Found con el mensaje esperado	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-14	Control de concurrencia e idempotencia: rechazo cuando la misión ya se encuentra en estado EN_CURSO (409 Conflict)	Concurrencia / Regla de Negocio	Repositorio / Endpoint	Crítica	Misión d1000000-0000-4000-8000-000000000001 en estado EN_CURSO (o reintento concurrente sobre 247be4dd-...)	POST /api/misiones/d1000000-0000-4000-8000-000000000001/aceptar con x-user-id: 00000000-0000-4000-8000-000000000001	HTTP 409 Conflict indicando que el estado actual es 'EN_CURSO' y solo se aceptan misiones 'DESPACHADA'	HTTP 409 Conflict: {"message":"La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-15	Rechazo de transición cuando la misión con patrulla asignada se encuentra en estado cerrado COMPLETADA, CANCELADA o RECHAZADA (409 Conflict)	Regla de Negocio ICS	Repositorio / Endpoint	Alta	Misión f3a3c065-8c1b-4fb8-a79a-2ca53447108a (MIS-2026-0005) en estado COMPLETADA	POST /api/misiones/f3a3c065-8c1b-4fb8-a79a-2ca53447108a/aceptar con x-user-id: 00000000-0000-4000-8000-000000000001	HTTP 409 Conflict bloqueando la transición e impidiendo insertar hitos en mision_hito	HTTP 409 Conflict: {"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}	APROBADO	09/11/2026 12:15	11/11/2026 11:05	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-16	Definición estructural de la tabla mision_hito e índices idx_mision_hito_mision_id e idx_mision_hito_creado_en	Base de Datos / Esquema	Migración / Tipos Kysely	Alta	Migraciones 028_mision_hito_bitacora.ts y 035_permiso_misiones_terreno_verificar.ts aplicadas	npm run db:migrate e inspección de mision_hito y rol_permiso en PostgreSQL	Columnas id, mision_id (FK cascade), hito, descripcion, registrado_por_id (FK set null), latitud, longitud, creado_en e índices creados	Tabla mision_hito, migración 028_ y permiso misiones:terreno:verificar (035_) activos en PostgreSQL	APROBADO	09/11/2026 12:11	11/11/2026 11:07	fix(db): renumerar migracion a 028 y habilitar allowUnorderedMigrations
CP-H36-API-17	Registro del contrato OpenAPI 3.0 para POST /api/misiones/{id}/aceptar y esquemas AceptarMisionInput, MisionHitoRegistrado y AceptarMisionResponse	Contrato API / OpenAPI	Especificación OpenAPI	Alta	Generador OpenAPI en src/lib/openapi/index.ts	npm test -- src/app/openapi.json/__tests__/route.test.ts y GET /openapi.json	Operación POST /api/misiones/{id}/aceptar documentada con respuestas 200, 400, 401, 403, 404, 409 y 500	Endpoint GET /openapi.json expone las 7 respuestas y AceptarMisionInput; test de contrato aprobado	APROBADO	09/11/2026 12:11	11/11/2026 11:07	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-18	Resiliencia del endpoint si la emisión del evento WebSocket mision:actualizada lanza una excepción	Robustez / Tolerancia a Fallos	Servicio	Media	notificarMisionActualizada rodeado de bloque try/catch en aceptarMisionService	Ejecución de mision-aceptar.service.test.ts	La transacción en BD se mantiene confirmada y el servicio retorna 200 OK registrando el error en log	aceptarMisionService captura errores de socket sin revertir la aceptación persistida (4/4 tests pass)	APROBADO	09/11/2026 12:11	11/11/2026 11:07	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-19	Documentación técnica del endpoint POST /api/misiones/{id}/aceptar y de la tabla mision_hito en docs/api/misiones.md y docs/database/README.md	Documentación	Documentación Técnica	Media	Archivos docs/api/misiones.md y docs/database/README.md	Revisión de sección 3.4. POST /api/misiones/{id}/aceptar y diccionario de datos	Reglas de transición atómica, invariantes ICS, payload, paridad GPS y salas WebSocket documentadas	Documentación verificada en docs/api/misiones.md (sección 3.4 y 4) y docs/database/README.md	APROBADO	09/11/2026 12:11	11/11/2026 11:08	docs(misiones): documentar endpoint de aceptacion de mision y esquema mision_hito (#37)
CP-H36-API-20	Ejecución completa de la suite de pruebas automatizadas en Vitest (módulo Misiones y suite global)	Automatización	Unit / Service / Route / Repo	Alta	Entorno de pruebas Vitest en sgrai-api	npm test -- src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts src/modules/misiones/__tests__/mision-aceptar.service.test.ts src/modules/misiones/__tests__/mision-aceptar.repository.test.ts src/modules/misiones/__tests__/mision.service.test.ts y npm test	24/24 tests directos de HU-36 y bitácora aprobados; 59/59 en módulo Misiones+OpenAPI y 755/755 en suite global	24/24 tests directos (8 route + 4 service + 7 repository + 5 detalle), 59/59 Misiones+OpenAPI y 755/755 global aprobados	APROBADO	09/11/2026 12:11	11/11/2026 11:07	test(misiones): agregar pruebas unitarias para aceptacion de mision por patrulla (#37)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Migraciones Kysely, Análisis Estático y Pruebas Automatizadas

#### 5.1.1 Ejecución Limpia de Migraciones Kysely (`BUG-H36-API-03`)
```bash
npm run db:migrate
```

**Salida de Consola:**
```text
Ejecutando migraciones Kysely de base de datos...
Todas las migraciones se completaron correctamente.
```

#### 5.1.2 Suite Directa de Aceptación de Misión y Bitácora (`HU-36` + `BUG-H36-API-01/02/04/05`)
```bash
npm test -- src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts src/modules/misiones/__tests__/mision-aceptar.service.test.ts src/modules/misiones/__tests__/mision-aceptar.repository.test.ts src/modules/misiones/__tests__/mision.service.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (5 tests) 9ms
 ✓ src/modules/misiones/__tests__/mision-aceptar.service.test.ts (4 tests) 7ms
 ✓ src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts (8 tests) 18ms
 ✓ src/modules/misiones/__tests__/mision-aceptar.repository.test.ts (7 tests) 10ms

 Test Files  4 passed (4)
      Tests  24 passed (24)
   Start at  11:07:48
   Duration  545ms (transform 250ms, setup 0ms, collect 567ms, tests 44ms, environment 1ms, prepare 284ms)
```

#### 5.1.3 Suite Completa del Módulo Misiones y Contrato OpenAPI
```bash
npm test -- src/app/api/misiones src/modules/misiones src/app/openapi.json
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (5 tests) 16ms
 ✓ src/modules/misiones/__tests__/mision-aceptar.service.test.ts (4 tests) 10ms
 ✓ src/modules/misiones/__tests__/mision.schema.test.ts (11 tests) 32ms
 ✓ src/modules/misiones/__tests__/mision-listado.test.ts (7 tests) 23ms
 ✓ src/app/api/misiones/__tests__/route.test.ts (10 tests) 46ms
 ✓ src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts (8 tests) 36ms
 ✓ src/modules/misiones/__tests__/mision-aceptar.repository.test.ts (7 tests) 17ms
 ✓ src/app/api/misiones/[id]/__tests__/route.test.ts (6 tests) 28ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 254ms

 Test Files  9 passed (9)
      Tests  59 passed (59)
   Start at  11:07:23
   Duration  1.42s (transform 1.36s, setup 0ms, collect 3.85s, tests 462ms, environment 2ms, prepare 882ms)
```

#### 5.1.4 Suite Global, Chequeo de Tipos y ESLint
```bash
npm test && npx tsc --noEmit && npm run lint
```

**Salida Resumida:**
```text
 Test Files  62 passed (62)
      Tests  755 passed (755)
   Start at  11:07:49
   Duration  4.84s

npx tsc --noEmit -> exit code 0 (0 errors)
eslint           -> ✖ 11 problems (0 errors, 11 warnings — 0 en módulos misiones/socket/db)
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`POST /api/misiones/[id]/aceptar` y `GET /api/misiones/[id]`)

#### Caso 1: Rechazo por Falta de Autenticación (`401 Unauthorized` — `CP-H36-API-07`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 2: Rechazo RBAC para Usuario sin Permiso `misiones:terreno:verificar` (`403 Forbidden` — `CP-H36-API-08`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: c1111111-1111-4111-8111-111111111111"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 3: Rechazo a Patrullero de Otra Unidad Aunque el Líder Tenga Rol `ENCARGADO` (`403 Forbidden` — `BUG-H36-API-01` + `BUG-H36-API-03`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No está autorizado para aceptar una misión asignada a otra patrulla verificadora."}
```

#### Caso 4: Rechazo de Misión Sin Patrulla Verificadora Asignada (`409 Conflict` — `BUG-H36-API-01`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000004/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La misión indicada no tiene una patrulla verificadora asignada."}
```

#### Caso 5: Rechazo por Parámetro UUID Inválido (`400 Bad Request` — `CP-H36-API-10`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/id-no-es-uuid/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"El identificador de la misión proporcionado no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador de la misión debe ser un UUID válido."}]}
```

#### Caso 6: Rechazo por Cuerpo JSON Malformado (`400 Bad Request` — `CP-H36-API-11`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d "{malformed"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"El cuerpo de la petición no es un JSON válido."}
```

#### Caso 7: Rechazo por Coordenadas GPS Fuera de Rango WGS84 y Paridad Incompleta (`400 Bad Request` — `CP-H36-API-12` y `BUG-H36-API-05`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-120,"longitud":-73.245}'

curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos.","errors":[{"campo":"latitud","mensaje":"La latitud no puede ser menor a -90."}]}
```
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos.","errors":[{"campo":"longitud","mensaje":"Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS."}]}
```

#### Caso 8: Rechazo por Misión Inexistente (`404 Not Found` — `CP-H36-API-13`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/60000000-0000-4000-8000-000000000999/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
content-type: application/json

{"message":"No se encontró ninguna misión con el identificador proporcionado."}
```

#### Caso 9: Rechazos de Concurrencia y Estados Cerrados (`409 Conflict` — `CP-H36-API-14` y `CP-H36-API-15`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"

curl -s -i -X POST "http://localhost:3001/api/misiones/f3a3c065-8c1b-4fb8-a79a-2ca53447108a/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}
```
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}
```

#### Caso 10: Aceptación Exitosa con JWT de `PATRULLA_VERIFICADORA`, Emisión Redis y Consulta en Bitácora del Centro de Mando (`200 OK` — `CP-H36-API-02/03/04/05/06`, `BUG-H36-API-02/03/05`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar" \
  -H "Authorization: Bearer <TOKEN_JWT_PEDRO_PATRULLA>" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588,"longitud":-73.245209}'
```

**Respuesta HTTP/JSON (`POST /aceptar`):**
```http
HTTP/1.1 200 OK
content-type: application/json

{
  "message": "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
  "data": {
    "mision": {
      "id": "247be4dd-a0b8-490f-8d66-4de1144ddd02",
      "codigo": "MIS-2026-0008",
      "titulo": "Verificación: Corte de energía - INC-2026-9932",
      "descripcion": null,
      "tipoMision": "VERIFICACION",
      "estado": "EN_CURSO",
      "prioridad": "MEDIA",
      "incidenteId": "dd7db71e-e878-4b58-a115-a848dc88bb38",
      "patrullaId": "f1000000-0000-4000-8000-000000000010",
      "fechaInicio": "2026-11-11T14:06:42.614Z",
      "actualizadoEn": "2026-11-11T14:06:42.614Z"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000010",
      "nombre": "Patrulla Rápida Las Ánimas",
      "estado": "EN_VERIFICACION"
    },
    "incidente": {
      "id": "dd7db71e-e878-4b58-a115-a848dc88bb38",
      "codigo": "INC-2026-9932",
      "estado": "VERIFICANDO"
    },
    "hito": {
      "id": "8b58937a-e4f6-44d0-845f-a682b71f4295",
      "misionId": "247be4dd-a0b8-490f-8d66-4de1144ddd02",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Misión Aceptada por Patrulla",
      "registradoPorId": "d1000000-0000-4000-8000-000000000001",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-11T14:06:42.614Z"
    }
  }
}
```

**Consulta Posterior en Centro de Mando (`GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02`):**
```bash
curl -s -i -X GET "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```

**Fragmento de Respuesta (`bitacoraTiempos`):**
```json
{
  "estado": "EN_CURSO",
  "fechaInicio": "2026-11-11T14:06:42.614Z",
  "bitacoraTiempos": [
    {
      "hito": "DESPACHADA",
      "fecha": "2026-11-10",
      "hora": "22:01:45",
      "timestamp": "2026-11-10T22:01:45.343Z",
      "descripcion": "Misión de verificación asignada y despachada a la patrulla Patrulla Rápida Las Ánimas."
    },
    {
      "hito": "MISION_ACEPTADA",
      "fecha": "2026-11-11",
      "hora": "14:06:42",
      "timestamp": "2026-11-11T14:06:42.614Z",
      "descripcion": "Misión Aceptada por Patrulla"
    }
  ]
}
```

**Eventos Publicados en Broker Redis (`SUBSCRIBE sgrai:socket-events`):**
```text
1) room: "encargado"       | event: "mision:actualizada" | payload.misionId: "247be4dd-a0b8-490f-8d66-4de1144ddd02"
2) room: "sala:encargados" | event: "mision:actualizada" | payload.misionId: "247be4dd-a0b8-490f-8d66-4de1144ddd02"
3) room: "supervisor"      | event: "mision:actualizada" | payload.misionId: "247be4dd-a0b8-490f-8d66-4de1144ddd02"
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La vista de detalle de la misión asignada en la PWA debe presentar un botón prominente 'Aceptar Misión'. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz de usuario en el repositorio `sgrai-pwa`. |
| **CA-2:** Al presionar 'Aceptar Misión', la PWA debe invocar el endpoint `POST /api/misiones/{id}/aceptar`. | `CP-H36-API-01`, `CP-H36-API-02`, `CP-H36-API-10` a `15`, `CP-H36-API-17`, `BUG-H36-API-05` | 🟢 **CUMPLIDO** | Endpoint `POST /api/misiones/{id}/aceptar` expuesto, validado en OpenAPI 3.0 y con paridad GPS obligatoria (`latitud`/`longitud`). |
| **CA-3:** La API debe ejecutar una transición atómica: (1) Actualizar `mision.estado` de `DESPACHADA` a `EN_CURSO`, (2) Fijar `mision.fecha_inicio = CURRENT_TIMESTAMP`, y (3) Registrar el hito 'Misión Aceptada por Patrulla' en la tabla `mision_hito`. | `CP-H36-API-03`, `CP-H36-API-04`, `CP-H36-API-14`, `CP-H36-API-16`, `BUG-H36-API-01`, `BUG-H36-API-02` | 🟢 **CUMPLIDO** | Transacción Kysely con `.forUpdate("mision")`, validación estricta de `patrulla_id` y pertenencia a la patrulla, inserción en `mision_hito` y exposición verificada en `GET /api/misiones/{id}`. |
| **CA-4:** El estado de la patrulla verificadora debe mantenerse en `EN_VERIFICACION` y el incidente permanece en `VERIFICANDO` (corrigiendo la ambigüedad de 'En camino', que no es un estado canónico de incidente). | `CP-H36-API-05`, `BUG-H36-API-04` | 🟢 **CUMPLIDO** | Invariantes ICS validadas atómicamente en BD (`patrulla` activa en `EN_VERIFICACION` e `incidente` en `VERIFICANDO`), garantizando estados canónicos sin transicionar a `'En camino'`. |
| **CA-5:** El sistema debe emitir en tiempo real el evento WebSocket `mision:actualizada` hacia la sala `encargado` del Centro de Mando. | `CP-H36-API-06`, `CP-H36-API-18`, `BUG-H36-API-05` | 🟢 **CUMPLIDO** | `notificarMisionActualizada` emite simétricamente por Socket.io en memoria y Redis Pub/Sub (`sgrai:socket-events`) hacia `encargado`, `sala:encargados` y `supervisor`. |
| **CA-6:** La PWA debe cambiar el estado de la vista a 'En Trayecto / Evaluación' habilitando los formularios de reporte técnico. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | El backend provee `data.mision.estado = "EN_CURSO"` y `data.mision.fechaInicio` para habilitar la transición de estado en `sgrai-pwa`. |
| **CA-7:** El endpoint debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H36-API-07`, `CP-H36-API-08`, `CP-H36-API-09`, `BUG-H36-API-01`, `BUG-H36-API-03` | 🟢 **CUMPLIDO** | Migración `035_permiso_misiones_terreno_verificar.ts` ejecutada sin colisiones asignando el permiso a `PATRULLA_VERIFICADORA` y `ADMIN`, y control de acceso horizontal verificado en `aceptarMisionPatrullaRepo`. |
