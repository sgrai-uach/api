# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-41 — Rechazo Motivado de Asignación de Misión por Cuadrilla (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones Tácticas en Terreno (`sgrai-api` — `POST /api/misiones/{id}/rechazar`).  
> **Historia de Usuario:** HU-41 — *"Como Delegado de cuadrilla Quiero rechazar la solicitud de asignación a un incidente ingresando una justificación técnica obligatoria. Para informar oportunamente al Centro de Mando los motivos de fuerza mayor que impiden la atención para que la emergencia sea reasignada de inmediato a otra unidad."*  
> **Desarrollador Asignado:** `zetastormy`  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h41-cuadrilla-rechazar-asignacion`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41)`  
> * `feat(socket): agregar evento mision:rechazada en socket.io y redis pub/sub (HU-41)`  
> * `feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)`  
> * `test(misiones): agregar pruebas unitarias para migracion 057, esquemas, repositorio, servicio y ruta de rechazo (HU-41)`  
> * `docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y regla §3.3 (HU-41)`  
>  
> **Fecha de Auditoría QA:** 24/11/2026 01:38.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested`) — 5 DEFECTOS REALES ABIERTOS PENDIENTES DE CORRECCIÓN**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección estática y forense del código fuente, evaluación de integración Gitflow respecto a `develop`, verificación de migraciones Kysely (`npm run db:migrate`), análisis de tipos TypeScript (`npx next typegen && npx tsc --noEmit`), análisis estático ESLint (`npm run lint`), compilación de producción (`npm run build`), ejecución de suites automatizadas en Vitest y pruebas vivas mediante peticiones HTTP (`cURL` y `fetch` concurrente) contra PostgreSQL 16 + PostGIS y Redis 7 (`sgrai:socket-events`) sobre la rama `feature/h41-cuadrilla-rechazar-asignacion`, se identificaron **5 defectos reales** (**1 de severidad CRÍTICA / BLOQUEANTE**, **2 de severidad ALTA** y **2 de severidad MEDIA**) que impiden la aprobación e integración del Pull Request hacia `develop`.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|:---|
| **Total de Casos de Prueba Evaluados** | **22** | 5 Defectos Abiertos (`BUG-H41-API-01` a `05`) + 17 Casos de Contrato, ACID, RBAC, Concurrencia y Socket.io (`CP-H41-API-01` a `17`) |
| **Casos Aprobados (Passed)** | **17** | Flujos nominales hacia `VERIFICANDO` y `REPORTADO`, regla §3.3 (≥ 5 caracteres), concurrencia `FOR UPDATE`, RBAC cuadrilla y migración `057_` |
| **Defectos Abiertos (Failed)** | **5** | 1 crítico (colisión con `develop` / HU-69 en la misma ruta), 2 altos (disponibilidad de dotación compartida e invariantes/mensajes de incidente) y 2 medios (OpenAPI/docs/cuerpo vacío y sala Socket/fallback `x-user-id`/tests) |
| **Casos Bloqueados (Blocked)** | **0** | Entorno PostgreSQL 16 + PostGIS (`5001`) y Redis 7 (`6001`) operativos |
| **Tasa de Aprobación Actual (% Pass)** | **77.3%** | Se requiere subsanar los 5 hallazgos y alcanzar 100% en Re-Test para certificar el merge |
| **Sincronización con `develop`** | 🔴 **78 commits detrás** | 12 archivos en conflicto y colisión funcional/RBAC en `POST /api/misiones/[id]/rechazar` con HU-69 |
| **Suite Focalizada HU-41 (Vitest)** | 🟢 **31/31 tests pass** | 5 archivos directos (`npm test -- -t "HU-41"`), 843 omitidos por filtro |
| **Suite Módulo Misiones + OpenAPI (Vitest)** | 🟢 **131/131 tests pass** | 19 archivos de prueba ejecutados en `5.22s` |
| **Suite Global del Repositorio (`npm test`)** | 🟢 **874/874 tests pass** | 77 archivos de prueba ejecutados en `9.36s` |
| **TypeScript / ESLint / Build (`next build`)** | 🟢 **0 errores** | `npx next typegen && npx tsc --noEmit`, `npx eslint` y `npm run build` limpios en rama aislada |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H41-API-01`: Desfase de 78 Commits con `develop` y Colisión Arquitectónica, Funcional y RBAC en `POST /api/misiones/[id]/rechazar` frente a HU-69
* **Severidad:** **CRÍTICA / BLOQUEANTE** (Integración Continua, Regresión Funcional de HU-69 y Conflictos Masivos de Merge).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/app/api/misiones/[id]/rechazar/route.ts`
  * `src/modules/misiones/mision.service.ts`
  * `src/modules/misiones/mision.repository.ts`
  * `src/modules/misiones/mision.schema.ts`
  * `src/modules/seguridad/permisos.constants.ts`
  * `src/lib/openapi/index.ts`
  * `src/lib/socket/index.ts` y `src/lib/socket/types.ts`
  * `docs/api/misiones.md`
  * `src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts` y `src/modules/misiones/__tests__/mision-rechazar.*.test.ts`
* **Descripción Técnica:**  
  1. La rama `feature/h41-cuadrilla-rechazar-asignacion` tiene como ancestro común el commit `f3c6860` (`Merge pull request #42`), encontrándose **78 commits por detrás de `develop`** (`014656a`). Al simular la fusión con `git merge-tree`, se producen conflictos directos en **12 archivos** (incluyendo toda la ruta de rechazo, capa de servicio, repositorio, esquemas, sockets, OpenAPI, documentación y pruebas).
  2. En `develop` ya se encuentra integrada la historia HU-69 (`feature/H69-rechazo-mision-patrulla`, PR #44 y PR #59), la cual implementa el **mismo endpoint** `POST /api/misiones/[id]/rechazar` exclusivo para **patrullas verificadoras** (`tipo_mision === 'VERIFICACION'`, `patrulla_id IS NOT NULL`, permiso `misiones:terreno:verificar`, función `rechazarMisionPatrullaRepo`).
  3. La implementación de HU-41 sobrescribe dicho endpoint de forma excluyente para **cuadrillas operativas** (`cuadrilla_id IS NOT NULL`, permiso `misiones:terreno:ejecutar` en `route.ts:44-47`, función `rechazarMisionCuadrillaRepo`). En pruebas vivas contra el servidor, una `PATRULLA_VERIFICADORA` intentando rechazar su misión asignada recibe `403 Forbidden` (*"No cuenta con el permiso requerido: misiones:terreno:ejecutar"*) y un `ADMIN` sobre una misión `VERIFICACION` recibe `409 Conflict` (*"La misión indicada no tiene una cuadrilla operativa asignada para ser rechazada."*).
  4. Adicionalmente, la rama carece de `PERMISO_CREAR_EVENTO_ATP` en `permisos.constants.ts` y de las migraciones `041_recuperacion_recurso_mision_id.ts`, `051_permiso_misiones_terreno_verificar.ts` y `072_evento_atp_base.ts` ya presentes en `develop`.
* **Pasos para Reproducir:**
  1. Ejecutar `git rev-list --count HEAD..develop` y `git merge-tree $(git merge-base develop HEAD) develop HEAD`.
  2. Enviar `POST /api/misiones/bb32f709-02d1-4a78-94ba-b2d548460652/rechazar` (misión `VERIFICACION` en estado `DESPACHADA`) con `x-user-id: d1000000-0000-4000-8000-000000000001` (`PATRULLA_VERIFICADORA`) o con `ADMIN`.
* **Comportamiento Actual:** `12` archivos en conflicto contra `develop`; `PATRULLA_VERIFICADORA` obtiene `403 Forbidden` y `ADMIN` obtiene `409 Conflict` rompiendo el flujo ya certificado de HU-69.
* **Comportamiento Esperado:** La rama debe sincronizarse con `develop` y el endpoint `POST /api/misiones/[id]/rechazar` debe operar polimórficamente según el tipo/unidad de la misión (análogo a la unificación de `POST /api/misiones` para HU-20 y HU-21), validando `misiones:terreno:ejecutar` + pertenencia a cuadrilla cuando la misión corresponde a cuadrilla, y `misiones:terreno:verificar` + pertenencia a patrulla cuando la misión es de `VERIFICACION` con patrulla asignada.
* **Sugerencia Técnica de Corrección:**
  - Ejecutar `git merge origin/develop` y resolver conflictos conservando `rechazarMisionPatrullaRepo` (HU-69) junto con `rechazarMisionCuadrillaRepo` (HU-41).
  - En `POST /api/misiones/[id]/rechazar/route.ts`, autenticar primero al usuario activo (`extraerUsuarioId` + validación de cuenta activa), consultar previamente la unidad de la misión (o delegar al servicio) y exigir el permiso RBAC correspondiente (`misiones:terreno:ejecutar` si posee `cuadrilla_id`, o `misiones:terreno:verificar` si es `VERIFICACION` con `patrulla_id`).
  - Unificar `RechazarMisionResponseSchema` (`cuadrilla` y `patrulla` opcionales/nullable o unión discriminada) en `mision.schema.ts` y `src/lib/openapi/index.ts`.

---

### `BUG-H41-API-02`: Corrupción de Disponibilidad Operativa (`usuario.estado_operativo`) en `liberarDotacionCuadrillaDeMision` cuando el Delegado o Integrante Posee Otra Misión o Cuadrilla Activa
* **Severidad:** **ALTA** (Integridad Operativa de Personal y Consistencia ICS).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 1281-1319 y 1481-1485).
* **Descripción Técnica:**  
  Al rechazar una misión, `liberarDotacionCuadrillaDeMision` actualiza `usuario.estado_operativo = 'disponible'` para todos los integrantes vigentes de `cuadrilla_personal` y para `usuario_delegado_id` cuyo `estado_operativo` sea `'en_mision'`, sin verificar si alguno de dichos usuarios participa simultáneamente en **otra cuadrilla** que permanece en estado `'EN_MISION'`, en otra misión activa (`DESPACHADA`/`EN_CURSO`) o en una patrulla activa.  
  En los propios datos semilla de la base de datos local (`c1000000-0000-4000-8000-000000000001` y `c1000000-0000-4000-8000-000000000002`), existen cuadrillas activas en estado `'EN_MISION'` que comparten el mismo `usuario_delegado_id`. En la prueba en vivo con `Cuadrilla QA H41 Alfa` y `Cuadrilla QA H41 Gamma` compartiendo al delegado `delegado1.h41qa@valdivia.cl` (`f4100000-0000-4000-8000-000000000001`), tras rechazar únicamente `MIS-H41-001` de `Cuadrilla Alfa`, el delegado quedó marcado como `'disponible'` en la tabla `usuario` a pesar de que `Cuadrilla Gamma` continuaba en `'EN_MISION'` atendiendo `MIS-H41-004` (`EN_CURSO`).
* **Pasos para Reproducir:**
  1. Disponer de dos cuadrillas activas en `'EN_MISION'` que compartan `usuario_delegado_id` (o un brigadista en transición) con el usuario en `estado_operativo = 'en_mision'`.
  2. Rechazar la misión `DESPACHADA` de la primera cuadrilla vía `POST /api/misiones/{id}/rechazar`.
  3. Consultar `SELECT id, email, estado_operativo FROM usuario` y `SELECT id, nombre, estado FROM cuadrilla`.
* **Comportamiento Actual:** El usuario cambia a `estado_operativo = 'disponible'` en tabla `usuario`, contradiciendo que sigue liderando otra cuadrilla desplegada en `'EN_MISION'`.
* **Comportamiento Esperado:** Solo se debe restaurar `usuario.estado_operativo = 'disponible'` para los usuarios (integrantes o delegado) que no estén vinculados a otra cuadrilla activa en `'EN_MISION'` ni a otra misión activa (`DESPACHADA` o `EN_CURSO`) o patrulla en despliegue operativo.
* **Sugerencia Técnica de Corrección:**
  - Añadir subconsultas `NOT EXISTS` en `liberarDotacionCuadrillaDeMision` (siguiendo el criterio de `verificarUsuarioEnOtrasUnidadesActivas` en `cuadrilla.repository.ts:1528-1590`) verificando que el `usuario_id` no lidere otra cuadrilla activa con `estado = 'EN_MISION'` ni pertenezca vía `cuadrilla_personal` a otra cuadrilla activa en `'EN_MISION'` ni a una patrulla en estado operativo activo.

---

### `BUG-H41-API-03`: Omisión de Validación de Estado Terminal del Incidente (`RESUELTO` / `NO_ABORDABLE`) y de Otras Misiones Activas, más Mensaje de Respuesta Contradictorio en `rechazarMisionService`
* **Severidad:** **ALTA** (Violación de Invariantes ICS, Coherencia de Eventos WebSocket y Contrato de Respuesta).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 1490-1538)
  * `src/modules/misiones/mision.service.ts` (Líneas 559-583)
* **Descripción Técnica:**  
  1. `rechazarMisionCuadrillaRepo` no valida que el incidente asociado no se encuentre ya en un estado terminal (`RESUELTO` o `NO_ABORDABLE`) ni verifica si el incidente posee otra misión activa (`DESPACHADA` o `EN_CURSO`) antes de revertir su estado. Al rechazar la misión `MIS-H41-003` asociada a `INC-H41-003` (`estado = 'RESUELTO'`), la consulta `UPDATE incidente ... WHERE estado IN ('EN_ATENCION', 'VERIFICANDO', 'REPORTADO')` afecta `0` filas y retorna el estado previo `'RESUELTO'`. Acto seguido, `rechazarMisionService` emite el evento WebSocket `incidente:actualizado` con `nuevoEstado: "RESUELTO"` y responde `HTTP 200 OK` con el mensaje erróneo: `"Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a RESUELTO para su reasignación."` (pese a que la cuadrilla quedó en `EN_MISION` por tener `MIS-H41-004` activa y el incidente estaba cerrado).
  2. De forma análoga, al rechazar `MIS-H41-005` cuya cuadrilla estaba dada de baja (`NO_DISPONIBLE`) y sin incidente asociado (`incidente_id = null`), `mision.service.ts:579-582` construye el texto hardcoded `"Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a REPORTADO para su reasignación."`, contradiciendo los propios datos del JSON (`cuadrilla.estado: "NO_DISPONIBLE"`, `incidente: null`).
* **Pasos para Reproducir:**
  1. Invocar `POST /api/misiones/{id}/rechazar` sobre una misión `DESPACHADA` cuyo incidente esté en `RESUELTO` o cuya cuadrilla posea otra misión `EN_CURSO` (o sin incidente).
  2. Inspeccionar el campo `message` de la respuesta `200 OK` y los eventos publicados en `sgrai:socket-events`.
* **Comportamiento Actual:** Permite rechazar misiones sobre incidentes terminales `RESUELTO`/`NO_ABORDABLE`, emite `incidente:actualizado` redundante y retorna un `message` falso afirmando que la cuadrilla volvió a `DISPONIBLE` y el incidente retornó a `RESUELTO` o `REPORTADO` para reasignación.
* **Comportamiento Esperado:** Validar invariantes ICS del incidente (bloquear con `409 Conflict` si el incidente está cerrado en `RESUELTO`/`NO_ABORDABLE`, o no emitir `incidente:actualizado` ni revertir el incidente si existe otra misión activa sobre él), y redactar dinámicamente `message` en `rechazarMisionService` reflejando el estado real resultante de la cuadrilla y del incidente.
* **Sugerencia Técnica de Corrección:**
  - En `rechazarMisionCuadrillaRepo`, rechazar con `ConflictError` si `incidente_estado === "RESUELTO" || incidente_estado === "NO_ABORDABLE"` (homólogo a HU-36), o bien devolver un flag `incidenteActualizado: boolean` y solo revertir `incidente.estado` si no existe otra misión `ATENCION_CUADRILLA` activa (`DESPACHADA`/`EN_CURSO`) sobre ese incidente.
  - En `rechazarMisionService`, emitir `notificarIncidenteActualizado` solo si el incidente fue efectivamente actualizado y construir `message` condicionalmente según `resultado.cuadrilla.estado` y `resultado.incidente`.

---

### `BUG-H41-API-04`: Divergencia OpenAPI vs Runtime en Paridad GPS (`RechazarMisionBodySchema`), Error Zod en Inglés para Cuerpo Vacío y Omisiones en `docs/api/misiones.md` y Tests OpenAPI
* **Severidad:** **MEDIA** (Contrato OpenAPI 3.0, Experiencia de Validación y Trazabilidad Documental).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.schema.ts` (Líneas 523-555)
  * `src/app/api/misiones/[id]/rechazar/route.ts` (Líneas 66-104)
  * `docs/api/misiones.md` (Líneas 641-686)
  * `src/app/openapi.json/__tests__/route.test.ts`
* **Descripción Técnica:**  
  1. `RechazarMisionBodySchema` (`mision.schema.ts:523-555`), utilizado para publicar el contrato en `src/lib/openapi/index.ts:2645`, no incluye la regla `.refine()` de paridad entre `latitud` y `longitud` que sí aplica en tiempo de ejecución `RechazarMisionInputSchema` (`mision.schema.ts:583-589`). Así, la especificación OpenAPI declara como válido enviar solo `latitud` sin `longitud`, mientras el endpoint responde `400 Bad Request`.
  2. En `route.ts:68-79`, cuando el cliente envía `Content-Type: application/json` con cuerpo vacío (`""`), `bodyRaw` permanece `undefined` y Zod v4 emite el mensaje por defecto en inglés con campo vacío: `{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"","mensaje":"Invalid input: expected object, received undefined"}]}`.
  3. En `docs/api/misiones.md` (Sección 4, líneas 641-686), los apartados `403 Forbidden`, `404 Not Found` y `409 Conflict` omiten documentar los casos de error del endpoint `POST /api/misiones/{id}/rechazar` (permiso `misiones:terreno:ejecutar`, pertenencia a cuadrilla, `404` de misión inexistente en rechazo y `409` por estado distinto a `DESPACHADA` / ya rechazada / sin cuadrilla).
  4. `src/app/openapi.json/__tests__/route.test.ts` carece de aserciones que validen el registro de `/api/misiones/{id}/rechazar`, `RechazarMisionBody` y `RechazarMisionResponse`.
* **Pasos para Reproducir:**
  1. Ejecutar `curl -s -X POST http://localhost:3001/api/misiones/{id}/rechazar -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d ''`.
  2. Inspeccionar `RechazarMisionBody` en `GET /openapi.json` y revisar la Sección 4 de `docs/api/misiones.md` y `src/app/openapi.json/__tests__/route.test.ts`.
* **Comportamiento Actual:** Mensaje de error en inglés (`expected object, received undefined`), esquema OpenAPI sin restricción de paridad GPS, errores 403/404/409 incompletos en `docs/api/misiones.md` y 0 aserciones de HU-41 en `route.test.ts` de OpenAPI.
* **Comportamiento Esperado:** Paridad exacta entre esquema OpenAPI y validación runtime, mensaje de error normalizado en español al recibir cuerpo vacío o no-objeto, catálogo de errores completo en `docs/api/misiones.md` y pruebas de contrato en `src/app/openapi.json/__tests__/route.test.ts`.
* **Sugerencia Técnica de Corrección:**
  - Añadir la validación de paridad GPS a `RechazarMisionBodySchema` (o derivarlo de un objeto base compartido) y fijar `.max(1000)` en `justificacion_rechazo`.
  - En `route.ts`, retornar `400 Bad Request` con mensaje en español (`"El cuerpo de la petición debe contener un objeto JSON con 'justificacion_rechazo'."`) si `bodyRaw === undefined` o no es un objeto plano.
  - Actualizar la Sección 4 de `docs/api/misiones.md` y añadir verificaciones de `/api/misiones/{id}/rechazar` en `src/app/openapi.json/__tests__/route.test.ts`.

---

### `BUG-H41-API-05`: Omisión de Sala `sala:encargados` en `emitirCuadrillaActualizada`, Aceptación Incondicional de `x-user-id` en Producción y Brechas de Cobertura Unitaria
* **Severidad:** **MEDIA** (Tiempo Real WebSocket, Endurecimiento de Seguridad y Cobertura de Pruebas).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (Líneas 556-560)
  * `src/app/api/misiones/[id]/rechazar/route.ts` (Líneas 40-42)
  * `src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts`
  * `src/modules/misiones/__tests__/mision-rechazar.repository.test.ts`
* **Descripción Técnica:**  
  1. En `src/lib/socket/index.ts:556-560`, `emitirCuadrillaActualizada` publica el evento `cuadrilla:actualizada` únicamente en las salas `["operaciones", "encargado", "supervisor"]`, omitiendo `"sala:encargados"` (sala estándar sí incluida en `notificarMisionRechazada`, `notificarIncidenteActualizado`, `notificarIncidenteCreado` y `notificarPatrullaActualizada`). Comprobado en vivo en Redis (`sgrai:socket-events`), donde `cuadrilla:actualizada` no llega a clientes suscritos únicamente a `"sala:encargados"`.
  2. En `src/app/api/misiones/[id]/rechazar/route.ts:40-42`, el fallback `request.headers.get("x-user-id")` se acepta incluso cuando `NODE_ENV === "production"` (verificado en ejecución sobre `npm run start` con `NODE_ENV=production`), permitiendo omitir la verificación de firma JWT si el proxy reverso no filtra dicha cabecera.
  3. Las suites unitarias de HU-41 no cubren casos clave ya presentes en el código: `route.test.ts` no prueba JSON malformado, cuerpo vacío, paridad/rango GPS desde el handler, `ForbiddenError` propagado desde el servicio (delegado ajeno) ni manejo `500`; y `mision-rechazar.repository.test.ts` no prueba bypass `esAdmin = true`, integrante en `cuadrilla_personal`, `otraMisionActiva`, cuadrilla en baja lógica ni conflicto concurrente al ejecutar `UPDATE mision ... WHERE estado = 'DESPACHADA'`.
* **Pasos para Reproducir:**
  1. Ejecutar rechazo de misión contra servidor en `NODE_ENV=production` enviando únicamente `-H "x-user-id: <uuid>"` sin cabecera `Authorization`, y capturar eventos publicados en `REDIS_SOCKET_CHANNEL` (`sgrai:socket-events`).
  2. Revisar casos de prueba en `route.test.ts` y `mision-rechazar.repository.test.ts`.
* **Comportamiento Actual:** `cuadrilla:actualizada` omite `"sala:encargados"`, `x-user-id` opera sin restricción en `NODE_ENV=production` y faltan 9 escenarios unitarios clave en los tests de HU-41.
* **Comportamiento Esperado:** `emitirCuadrillaActualizada` debe incluir `"sala:encargados"`, el fallback `x-user-id` debe limitarse a entornos no productivos (o alinearse con `BearerAuth` estricto como `POST /api/misiones`), y los tests unitarios deben cubrir todos los caminos de error y concurrencia.
* **Sugerencia Técnica de Corrección:**
  - Agregar `emitirEvento("sala:encargados", "cuadrilla:actualizada", payload);` en `src/lib/socket/index.ts:556-560`.
  - Condicionar `const headerUserId = process.env.NODE_ENV !== "production" ? request.headers.get("x-user-id") : null;` en `route.ts`.
  - Incorporar los tests unitarios faltantes en `route.test.ts` y `mision-rechazar.repository.test.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H41-API-01` | Desfase de 78 commits con `develop` y colisión arquitectónica/RBAC en `POST /api/misiones/[id]/rechazar` frente a HU-69 | Integración / Gitflow / RBAC | API / Arquitectura | Crítica | Rama `feature/h41-cuadrilla-rechazar-asignacion` frente a `develop` (`014656a`) y misión `VERIFICACION` `DESPACHADA` (`bb32f709-...`) | `git merge-tree` y `POST /api/misiones/bb32f709-02d1-4a78-94ba-b2d548460652/rechazar` con `PATRULLA_VERIFICADORA` o `ADMIN` | Integración limpia con `develop` y despacho polimórfico por tipo de unidad sin romper rechazo de patrulla (HU-69) ni de cuadrilla (HU-41) | 12 archivos en conflicto; `PATRULLA_VERIFICADORA` recibe `403 Forbidden` y `ADMIN` recibe `409 Conflict` rompiendo HU-69 | ABIERTO | 24/11/2026 01:37 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-API-02` | Liberación prematura de `usuario.estado_operativo` a `disponible` en `liberarDotacionCuadrillaDeMision` con otra cuadrilla activa en `EN_MISION` | Regla de Negocio / Integridad | Repositorio / BD | Alta | Delegado compartido entre `Cuadrilla Alfa` (`EN_MISION`, `MIS-H41-001` `DESPACHADA`) y `Cuadrilla Gamma` (`EN_MISION`, `MIS-H41-004` `EN_CURSO`) | `POST /api/misiones/f4140000-0000-4000-8000-000000000001/rechazar` y consulta SQL sobre tabla `usuario` | El delegado mantiene `estado_operativo = 'en_mision'` mientras continúe asignado a `Cuadrilla Gamma` activa en `EN_MISION` | La tabla `usuario` cambia `delegado1.h41qa@valdivia.cl` a `'disponible'` pese a que `Cuadrilla Gamma` sigue en `'EN_MISION'` | ABIERTO | 24/11/2026 01:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-API-03` | Omisión de guardia sobre estado terminal del incidente (`RESUELTO`/`NO_ABORDABLE`) y mensaje engañoso en `rechazarMisionService` | Regla de Negocio ICS / Contrato | Repositorio / Servicio | Alta | Misión `MIS-H41-003` vinculada a incidente `RESUELTO` (`INC-H41-003`) con `Cuadrilla Gamma` en `EN_MISION`; y `MIS-H41-005` con cuadrilla `NO_DISPONIBLE` sin incidente | `POST /api/misiones/f4140000-...-003/rechazar` y `POST /api/misiones/f4140000-...-005/rechazar` | Bloquear rechazo en incidente terminal (`409`) o adaptar `message` y emisión `incidente:actualizado` al estado real | Retorna `200 OK` con mensaje falso (`"La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a RESUELTO/REPORTADO"`) y emite `incidente:actualizado` con `RESUELTO` | ABIERTO | 24/11/2026 01:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-API-04` | Divergencia OpenAPI vs runtime en paridad GPS, error Zod en inglés para cuerpo vacío y omisiones en `docs/api/misiones.md` y tests OpenAPI | Contrato / Validación / Docs | OpenAPI / Route / Docs | Media | Endpoint activo en `http://localhost:3001` y especificación `GET /openapi.json` | `POST /api/misiones/{id}/rechazar` con `Content-Type: application/json` y `-d ''`; revisión de `RechazarMisionBody` y `docs/api/misiones.md` | Error en español claro ante cuerpo vacío, paridad GPS declarada en `RechazarMisionBodySchema`, Sección 4 de `docs/api/misiones.md` completa y cobertura en test OpenAPI | Cuerpo vacío retorna `"Invalid input: expected object, received undefined"`; `RechazarMisionBody` omite paridad GPS; `docs/api/misiones.md` omite 403/404/409 de rechazo; sin test OpenAPI específico | ABIERTO | 24/11/2026 01:37 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-API-05` | Omisión de sala `sala:encargados` en `emitirCuadrillaActualizada`, fallback `x-user-id` en producción y brechas de tests unitarios | Tiempo Real / Seguridad / Tests | Socket / Route / Unit | Media | Servidor corriendo en `NODE_ENV=production`, Redis `sgrai:socket-events` y revisión de suites unitarias | Captura en Redis Pub/Sub durante `POST /rechazar` y petición con `-H "x-user-id: ..."` sin Bearer en producción | `cuadrilla:actualizada` publicado en `sala:encargados`, `x-user-id` restringido a dev/test y cobertura unitaria de bordes | `cuadrilla:actualizada` solo emite a `operaciones`, `encargado` y `supervisor`; `x-user-id` aceptado en `NODE_ENV=production`; faltan pruebas unitarias de bordes | ABIERTO | 24/11/2026 01:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H41-API-01` | Rechazo motivado exitoso (`200 OK`) con retorno del incidente a `VERIFICANDO` (verificación previa `COMPLETADA`) y registro de coordenadas GPS | Funcional / Positiva | API / E2E Local | Crítica | Misión `MIS-H41-001` (`DESPACHADA`), `Cuadrilla Alfa` (`EN_MISION`), incidente `INC-H41-001` (`EN_ATENCION`) con misión `VERIFICACION` `COMPLETADA` | `POST /api/misiones/f4140000-...-001/rechazar` con JWT y `{"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida desde base.","latitud":-39.81422,"longitud":-73.24589}` | `HTTP 200 OK`, misión `RECHAZADA`, cuadrilla `DISPONIBLE`, incidente `VERIFICANDO` e hito `RECHAZADA` con coordenadas GPS | `HTTP 200 OK` con transición completa, `incidente.estado: "VERIFICANDO"`, `cuadrilla.estado: "DISPONIBLE"` y coordenadas `-39.81422, -73.24589` | APROBADO | 24/11/2026 01:38 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-02` | Autorización exitosa para integrante activo en `cuadrilla_personal` con permiso `misiones:terreno:ejecutar` | Seguridad / Autorización | API / Repositorio | Alta | Usuario `integrante.del.h41qa@valdivia.cl` (`DELEGADO_CUADRILLA`) registrado en `cuadrilla_personal` de `Cuadrilla Alfa` | `POST /api/misiones/f4140000-...-001/rechazar` con `Authorization: Bearer <token_integrante>` | `HTTP 200 OK` registrando `registradoPorId` del integrante autenticado en `mision_hito` | `HTTP 200 OK` autorizando al integrante activo y registrando `registradoPorId: f4100000-...-005` | APROBADO | 24/11/2026 01:38 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-03` | Rechazo motivado exitoso (`200 OK`) sobre incidente sin verificación previa retornando a `REPORTADO` con alias `justificacionRechazo` y borde exacto de 5 caracteres | Funcional / Límite | API / Schema | Crítica | Misión `MIS-H41-002` (`DESPACHADA`), incidente `INC-H41-002` (`EN_ATENCION`) sin misión `VERIFICACION` `COMPLETADA` | `POST /api/misiones/f4140000-...-002/rechazar` con `{"justificacionRechazo":"  12345  "}` | `HTTP 200 OK` aplicando `.trim()` a `"12345"` y revirtiendo `incidente.estado` a `"REPORTADO"` | `HTTP 200 OK` con `justificacionRechazo: "12345"` e `incidente.estado: "REPORTADO"` | APROBADO | 24/11/2026 01:38 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-04` | Persistencia ACID en PostgreSQL y trazabilidad de bitácora e historial en `GET /api/misiones/{id}` | Integridad / ACID | Base de Datos / API | Crítica | Rechazo confirmado de `MIS-H41-001` en PostgreSQL 16 | Consultas SQL en `mision`, `cuadrilla`, `incidente`, `mision_hito` y `GET /api/misiones/f4140000-...-001` | Las 4 tablas actualizadas atómicamente con `fecha_cierre` no nula y `GET /api/misiones/{id}` exponiendo `justificacionRechazo` y hito `RECHAZADA` en `bitacoraTiempos` | Verificado en PostgreSQL y en respuesta `200 OK` de `GET /api/misiones/{id}` con `bitacoraTiempos[0].hito === "RECHAZADA"` | APROBADO | 24/11/2026 01:38 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-05` | Emisión de alerta prioritaria WebSocket `mision:rechazada` hacia sala `encargado`, `sala:encargados`, `supervisor` y `cuadrilla:{id}` vía Redis Pub/Sub | Tiempo Real / Socket.io | Servicio / Redis | Crítica | Suscriptor conectado al canal Redis `sgrai:socket-events` y rechazo exitoso de `MIS-H41-001` | `POST /api/misiones/f4140000-...-001/rechazar` y lectura de mensajes en `sgrai:socket-events` | Emisión de `mision:rechazada` hacia `encargado`, `sala:encargados`, `supervisor` y `cuadrilla:{id}` junto a `incidente:actualizado` | Capturados 4 mensajes `mision:rechazada` (incluyendo `encargado` y `sala:encargados`) con motivo, cuadrilla e incidente | APROBADO | 24/11/2026 01:38 | - | feat(socket): agregar evento mision:rechazada en socket.io y redis pub/sub (HU-41) |
| `CP-H41-API-06` | Resiliencia de respuesta `200 OK` ante falla del broker Redis/Socket.io tras confirmar la transacción en BD | Robustez / Tolerancia a Fallos | Servicio / Unitaria | Media | Mock de `notificarMisionRechazada` lanzando excepción `Error("Redis offline")` | Ejecución de `mision-rechazar.service.test.ts` | La excepción en socket se registra en log sin revertir ni fallar la respuesta del servicio | `rechazarMisionService` retorna `estado: "RECHAZADA"` con `2/2` tests aprobados | APROBADO | 24/11/2026 01:39 | - | test(misiones): agregar pruebas unitarias para migracion 057, esquemas, repositorio, servicio y ruta de rechazo (HU-41) |
| `CP-H41-API-07` | Cumplimiento Regla §3.3: bloqueo `400 Bad Request` ante justificación ausente (`{}`), vacía (`""`), espacios (`"    "`) o < 5 caracteres (`"abcd"`) | Validación / Límite | API / Schema | Crítica | Usuario autenticado con permiso `misiones:terreno:ejecutar` | `POST /api/misiones/{id}/rechazar` con `{}`, `{"justificacion_rechazo":""}`, `{"justificacion_rechazo":"abcd"}`, `{"justificacion_rechazo":"    "}` | `HTTP 400 Bad Request` indicando mínimo 5 caracteres en `justificacion_rechazo` y cero mutaciones en BD | Todas las variantes devuelven `HTTP 400 Bad Request` con mensaje `"El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres."` | APROBADO | 24/11/2026 01:37 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-08` | Validación de parámetro UUID inválido, sintaxis JSON malformada, cotas geográficas WGS84 y paridad GPS (`400 Bad Request`) | Validación / Contrato | API / Route / Zod | Media | Usuario autenticado con permiso `misiones:terreno:ejecutar` | `id-invalido`, body `{malformed`, `{"justificacion_rechazo":"...","latitud":-95,"longitud":-73.24}` y `{"justificacion_rechazo":"...","latitud":-39.81422}` | `HTTP 400 Bad Request` controlado sin excepciones `500` ni desbordamientos numéricos en PostgreSQL | Las 4 peticiones responden `HTTP 400 Bad Request` con detalles descriptivos por campo | APROBADO | 24/11/2026 01:37 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-09` | Control de autenticación (`401 Unauthorized`): ausencia de credenciales, token JWT inválido y usuario con `activo = false` | Seguridad / Autenticación | API / Auth | Crítica | Petición sin credenciales, JWT manipulado e identidad inactiva (`f4100000-...-004`) | `POST /api/misiones/{id}/rechazar` sin headers, con `Bearer token.invalido.123` y con `x-user-id` de usuario inactivo | `HTTP 401 Unauthorized` impidiendo el acceso en los tres escenarios | Los tres escenarios responden `HTTP 401 Unauthorized` con mensajes diferenciados | APROBADO | 24/11/2026 01:37 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-10` | Control de acceso RBAC (`403 Forbidden`): denegación a roles sin `misiones:terreno:ejecutar` (`BRIGADISTA`, `ENCARGADO`) y a delegado de otra cuadrilla | Seguridad / RBAC | API / Repositorio | Crítica | Usuarios `BRIGADISTA`, `ENCARGADO` y `delegado2.h41qa@valdivia.cl` (asignado a `Cuadrilla Beta`) | `POST /api/misiones/f4140000-...-001/rechazar` (`Cuadrilla Alfa`) con cada perfil | `HTTP 403 Forbidden` por ausencia de permiso `misiones:terreno:ejecutar` y `403 Forbidden` por pertenencia horizontal a otra cuadrilla | `BRIGADISTA` y `ENCARGADO` reciben `"No cuenta con el permiso requerido: misiones:terreno:ejecutar"` y `delegado2` recibe `"No está autorizado para rechazar una misión asignada a otra cuadrilla operativa."` | APROBADO | 24/11/2026 01:37 | - | feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41) |
| `CP-H41-API-11` | Manejo de misión inexistente en base de datos (`404 Not Found`) | Funcional / Negativa | API / Repositorio | Alta | UUID inexistente en tabla `mision` y delegado autenticado | `POST /api/misiones/99999999-0000-4000-8000-000000000999/rechazar` con justificación válida | `HTTP 404 Not Found` con mensaje `"No se encontró ninguna misión con el identificador proporcionado."` | `HTTP 404 Not Found` retornado con el mensaje esperado | APROBADO | 24/11/2026 01:37 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-12` | Bloqueo `409 Conflict` ante misión ya `RECHAZADA`, misión en estado `EN_CURSO` o misión sin `cuadrilla_id` asignada | Regla de Negocio / Idempotencia | API / Repositorio | Crítica | Misiones en estado `RECHAZADA` (`MIS-H41-001`), `EN_CURSO` (`MIS-H41-004`) y sin cuadrilla (`bb32f709-...`) | `POST /rechazar` sobre cada una con usuario autorizado / `ADMIN` | `HTTP 409 Conflict` impidiendo transiciones ilícitas o doble rechazo | Los tres casos devuelven `HTTP 409 Conflict` con sus mensajes específicos de conflicto | APROBADO | 24/11/2026 01:37 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-13` | Control de concurrencia ante carrera simultánea (`Promise.all`) mediante bloqueo pesimista `FOR UPDATE OF mision` | Concurrencia / ACID | API / PostgreSQL | Crítica | Misión `MIS-H41-006` en estado `DESPACHADA` asignada a `Cuadrilla Beta` | 2 peticiones simultáneas `POST /api/misiones/f4140000-...-006/rechazar` con `Promise.all` | Exactamente una respuesta `200 OK`, una respuesta `409 Conflict` y 1 solo registro `'RECHAZADA'` en `mision_hito` | Confirmado en vivo: una petición `200 OK`, una `409 Conflict` (`"La misión ya ha sido rechazada previamente."`) y `hitos_rechazo = 1` | APROBADO | 24/11/2026 01:38 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-14` | Protección de cuadrilla ante `otraMisionActiva` (`EN_MISION`) y ante baja lógica (`activo = false` / `eliminado_en IS NOT NULL`) | Regla de Negocio / Integridad | Repositorio / BD | Alta | `Cuadrilla Gamma` con `MIS-H41-004` `EN_CURSO` y `Cuadrilla Baja` desactivada en `NO_DISPONIBLE` | `POST /rechazar` sobre `MIS-H41-003` y `MIS-H41-005` | `Cuadrilla Gamma` permanece en `EN_MISION` y `Cuadrilla Baja` permanece en `NO_DISPONIBLE` sin reactivarse | Verificado en PostgreSQL: `Cuadrilla Gamma` queda `EN_MISION` y `Cuadrilla Baja` permanece `NO_DISPONIBLE` | APROBADO | 24/11/2026 01:38 | - | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-15` | Ejecución idempotente de migración `057_permiso_misiones_terreno_ejecutar.ts` asignando `misiones:terreno:ejecutar` a `ADMIN` y `DELEGADO_CUADRILLA` | Base de Datos / Migraciones | Migración / DDL | Alta | PostgreSQL 16 operativo y migración `057_permiso_misiones_terreno_ejecutar.ts` | `npm run db:migrate` y consulta `SELECT` en `permiso` y `rol_permiso` | Permiso `misiones:terreno:ejecutar` (`10000000-...-0042`) asignado exclusivamente a `ADMIN` y `DELEGADO_CUADRILLA` | `npm run db:migrate` finaliza con código 0 y `rol_permiso` registra exactamente `ADMIN` y `DELEGADO_CUADRILLA` | APROBADO | 24/11/2026 01:35 | - | feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41) |
| `CP-H41-API-16` | Exposición del endpoint `POST /api/misiones/{id}/rechazar` en `GET /openapi.json` y documentación funcional en `docs/api/misiones.md` | Contrato API / Docs | OpenAPI / Docs | Alta | Servidor en ejecución y módulo `src/lib/openapi/index.ts` | `curl -s http://localhost:3001/openapi.json` y revisión de `docs/api/misiones.md` (Sección 3.8 y 5) | Ruta `/api/misiones/{id}/rechazar` registrada con seguridad `BearerAuth`, respuestas `200/400/401/403/404/409/500` y sección 3.8 documentada | Endpoint y esquemas `RechazarMisionBody` / `RechazarMisionResponse` expuestos en OpenAPI v0.12.0 | APROBADO | 24/11/2026 01:36 | - | docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y regla §3.3 (HU-41) |
| `CP-H41-API-17` | Ejecución limpia de suites Vitest, análisis estático ESLint, chequeo TypeScript (`tsc --noEmit`) y compilación de producción (`npm run build`) | Automatización / Build | CI / Unit / Build | Alta | Rama `feature/h41-cuadrilla-rechazar-asignacion` aislada | `npm test -- -t "HU-41"`, `npm test`, `npx next typegen && npx tsc --noEmit`, `npx eslint`, `npm run build` | 100% de tests verdes y 0 errores de compilación, tipos o linter | HU-41: `31/31` pass; Misiones+OpenAPI: `131/131` pass; Global: `874/874` pass; `tsc`, `eslint` y `next build` con `0` errores | APROBADO | 24/11/2026 01:39 | - | test(misiones): agregar pruebas unitarias para migracion 057, esquemas, repositorio, servicio y ruta de rechazo (HU-41) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H41-API-01	Desfase de 78 commits con develop y colisión arquitectónica/RBAC en POST /api/misiones/[id]/rechazar frente a HU-69	Integración / Gitflow / RBAC	API / Arquitectura	Crítica	Rama feature/h41-cuadrilla-rechazar-asignacion frente a develop (014656a) y misión VERIFICACION DESPACHADA (bb32f709-...)	git merge-tree y POST /api/misiones/bb32f709-02d1-4a78-94ba-b2d548460652/rechazar con PATRULLA_VERIFICADORA o ADMIN	Integración limpia con develop y despacho polimórfico por tipo de unidad sin romper rechazo de patrulla (HU-69) ni de cuadrilla (HU-41)	12 archivos en conflicto; PATRULLA_VERIFICADORA recibe 403 Forbidden y ADMIN recibe 409 Conflict rompiendo HU-69	ABIERTO	24/11/2026 01:37	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-API-02	Liberación prematura de usuario.estado_operativo a disponible en liberarDotacionCuadrillaDeMision con otra cuadrilla activa en EN_MISION	Regla de Negocio / Integridad	Repositorio / BD	Alta	Delegado compartido entre Cuadrilla Alfa (EN_MISION, MIS-H41-001 DESPACHADA) y Cuadrilla Gamma (EN_MISION, MIS-H41-004 EN_CURSO)	POST /api/misiones/f4140000-0000-4000-8000-000000000001/rechazar y consulta SQL sobre tabla usuario	El delegado mantiene estado_operativo = 'en_mision' mientras continúe asignado a Cuadrilla Gamma activa en EN_MISION	La tabla usuario cambia delegado1.h41qa@valdivia.cl a 'disponible' pese a que Cuadrilla Gamma sigue en 'EN_MISION'	ABIERTO	24/11/2026 01:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-API-03	Omisión de guardia sobre estado terminal del incidente (RESUELTO/NO_ABORDABLE) y mensaje engañoso en rechazarMisionService	Regla de Negocio ICS / Contrato	Repositorio / Servicio	Alta	Misión MIS-H41-003 vinculada a incidente RESUELTO (INC-H41-003) con Cuadrilla Gamma en EN_MISION; y MIS-H41-005 con cuadrilla NO_DISPONIBLE sin incidente	POST /api/misiones/f4140000-...-003/rechazar y POST /api/misiones/f4140000-...-005/rechazar	Bloquear rechazo en incidente terminal (409) o adaptar message y emisión incidente:actualizado al estado real	Retorna 200 OK con mensaje falso ("La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a RESUELTO/REPORTADO") y emite incidente:actualizado con RESUELTO	ABIERTO	24/11/2026 01:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-API-04	Divergencia OpenAPI vs runtime en paridad GPS, error Zod en inglés para cuerpo vacío y omisiones en docs/api/misiones.md y tests OpenAPI	Contrato / Validación / Docs	OpenAPI / Route / Docs	Media	Endpoint activo en http://localhost:3001 y especificación GET /openapi.json	POST /api/misiones/{id}/rechazar con Content-Type: application/json y -d ''; revisión de RechazarMisionBody y docs/api/misiones.md	Error en español claro ante cuerpo vacío, paridad GPS declarada en RechazarMisionBodySchema, Sección 4 de docs/api/misiones.md completa y cobertura en test OpenAPI	Cuerpo vacío retorna "Invalid input: expected object, received undefined"; RechazarMisionBody omite paridad GPS; docs/api/misiones.md omite 403/404/409 de rechazo; sin test OpenAPI específico	ABIERTO	24/11/2026 01:37	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-API-05	Omisión de sala sala:encargados en emitirCuadrillaActualizada, fallback x-user-id en producción y brechas de tests unitarios	Tiempo Real / Seguridad / Tests	Socket / Route / Unit	Media	Servidor corriendo en NODE_ENV=production, Redis sgrai:socket-events y revisión de suites unitarias	Captura en Redis Pub/Sub durante POST /rechazar y petición con -H "x-user-id: ..." sin Bearer en producción	cuadrilla:actualizada publicado en sala:encargados, x-user-id restringido a dev/test y cobertura unitaria de bordes	cuadrilla:actualizada solo emite a operaciones, encargado y supervisor; x-user-id aceptado en NODE_ENV=production; faltan pruebas unitarias de bordes	ABIERTO	24/11/2026 01:38	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H41-API-01	Rechazo motivado exitoso (200 OK) con retorno del incidente a VERIFICANDO (verificación previa COMPLETADA) y registro de coordenadas GPS	Funcional / Positiva	API / E2E Local	Crítica	Misión MIS-H41-001 (DESPACHADA), Cuadrilla Alfa (EN_MISION), incidente INC-H41-001 (EN_ATENCION) con misión VERIFICACION COMPLETADA	POST /api/misiones/f4140000-...-001/rechazar con JWT y {"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida desde base.","latitud":-39.81422,"longitud":-73.24589}	HTTP 200 OK, misión RECHAZADA, cuadrilla DISPONIBLE, incidente VERIFICANDO e hito RECHAZADA con coordenadas GPS	HTTP 200 OK con transición completa, incidente.estado: "VERIFICANDO", cuadrilla.estado: "DISPONIBLE" y coordenadas -39.81422, -73.24589	APROBADO	24/11/2026 01:38	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-02	Autorización exitosa para integrante activo en cuadrilla_personal con permiso misiones:terreno:ejecutar	Seguridad / Autorización	API / Repositorio	Alta	Usuario integrante.del.h41qa@valdivia.cl (DELEGADO_CUADRILLA) registrado en cuadrilla_personal de Cuadrilla Alfa	POST /api/misiones/f4140000-...-001/rechazar con Authorization: Bearer <token_integrante>	HTTP 200 OK registrando registradoPorId del integrante autenticado en mision_hito	HTTP 200 OK autorizando al integrante activo y registrando registradoPorId: f4100000-...-005	APROBADO	24/11/2026 01:38	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-03	Rechazo motivado exitoso (200 OK) sobre incidente sin verificación previa retornando a REPORTADO con alias justificacionRechazo y borde exacto de 5 caracteres	Funcional / Límite	API / Schema	Crítica	Misión MIS-H41-002 (DESPACHADA), incidente INC-H41-002 (EN_ATENCION) sin misión VERIFICACION COMPLETADA	POST /api/misiones/f4140000-...-002/rechazar con {"justificacionRechazo":"  12345  "}	HTTP 200 OK aplicando .trim() a "12345" y revirtiendo incidente.estado a "REPORTADO"	HTTP 200 OK con justificacionRechazo: "12345" e incidente.estado: "REPORTADO"	APROBADO	24/11/2026 01:38	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-04	Persistencia ACID en PostgreSQL y trazabilidad de bitácora e historial en GET /api/misiones/{id}	Integridad / ACID	Base de Datos / API	Crítica	Rechazo confirmado de MIS-H41-001 en PostgreSQL 16	Consultas SQL en mision, cuadrilla, incidente, mision_hito y GET /api/misiones/f4140000-...-001	Las 4 tablas actualizadas atómicamente con fecha_cierre no nula y GET /api/misiones/{id} exponiendo justificacionRechazo y hito RECHAZADA en bitacoraTiempos	Verificado en PostgreSQL y en respuesta 200 OK de GET /api/misiones/{id} con bitacoraTiempos[0].hito === "RECHAZADA"	APROBADO	24/11/2026 01:38	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-05	Emisión de alerta prioritaria WebSocket mision:rechazada hacia sala encargado, sala:encargados, supervisor y cuadrilla:{id} vía Redis Pub/Sub	Tiempo Real / Socket.io	Servicio / Redis	Crítica	Suscriptor conectado al canal Redis sgrai:socket-events y rechazo exitoso de MIS-H41-001	POST /api/misiones/f4140000-...-001/rechazar y lectura de mensajes en sgrai:socket-events	Emisión de mision:rechazada hacia encargado, sala:encargados, supervisor y cuadrilla:{id} junto a incidente:actualizado	Capturados 4 mensajes mision:rechazada (incluyendo encargado y sala:encargados) con motivo, cuadrilla e incidente	APROBADO	24/11/2026 01:38	-	feat(socket): agregar evento mision:rechazada en socket.io y redis pub/sub (HU-41)
CP-H41-API-06	Resiliencia de respuesta 200 OK ante falla del broker Redis/Socket.io tras confirmar la transacción en BD	Robustez / Tolerancia a Fallos	Servicio / Unitaria	Media	Mock de notificarMisionRechazada lanzando excepción Error("Redis offline")	Ejecución de mision-rechazar.service.test.ts	La excepción en socket se registra en log sin revertir ni fallar la respuesta del servicio	rechazarMisionService retorna estado: "RECHAZADA" con 2/2 tests aprobados	APROBADO	24/11/2026 01:39	-	test(misiones): agregar pruebas unitarias para migracion 057, esquemas, repositorio, servicio y ruta de rechazo (HU-41)
CP-H41-API-07	Cumplimiento Regla §3.3: bloqueo 400 Bad Request ante justificación ausente ({}), vacía (""), espacios ("    ") o < 5 caracteres ("abcd")	Validación / Límite	API / Schema	Crítica	Usuario autenticado con permiso misiones:terreno:ejecutar	POST /api/misiones/{id}/rechazar con {}, {"justificacion_rechazo":""}, {"justificacion_rechazo":"abcd"}, {"justificacion_rechazo":"    "}	HTTP 400 Bad Request indicando mínimo 5 caracteres en justificacion_rechazo y cero mutaciones en BD	Todas las variantes devuelven HTTP 400 Bad Request con mensaje "El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres."	APROBADO	24/11/2026 01:37	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-08	Validación de parámetro UUID inválido, sintaxis JSON malformada, cotas geográficas WGS84 y paridad GPS (400 Bad Request)	Validación / Contrato	API / Route / Zod	Media	Usuario autenticado con permiso misiones:terreno:ejecutar	id-invalido, body {malformed, {"justificacion_rechazo":"...","latitud":-95,"longitud":-73.24} y {"justificacion_rechazo":"...","latitud":-39.81422}	HTTP 400 Bad Request controlado sin excepciones 500 ni desbordamientos numéricos en PostgreSQL	Las 4 peticiones responden HTTP 400 Bad Request con detalles descriptivos por campo	APROBADO	24/11/2026 01:37	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-09	Control de autenticación (401 Unauthorized): ausencia de credenciales, token JWT inválido y usuario con activo = false	Seguridad / Autenticación	API / Auth	Crítica	Petición sin credenciales, JWT manipulado e identidad inactiva (f4100000-...-004)	POST /api/misiones/{id}/rechazar sin headers, con Bearer token.invalido.123 y con x-user-id de usuario inactivo	HTTP 401 Unauthorized impidiendo el acceso en los tres escenarios	Los tres escenarios responden HTTP 401 Unauthorized con mensajes diferenciados	APROBADO	24/11/2026 01:37	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-10	Control de acceso RBAC (403 Forbidden): denegación a roles sin misiones:terreno:ejecutar (BRIGADISTA, ENCARGADO) y a delegado de otra cuadrilla	Seguridad / RBAC	API / Repositorio	Crítica	Usuarios BRIGADISTA, ENCARGADO y delegado2.h41qa@valdivia.cl (asignado a Cuadrilla Beta)	POST /api/misiones/f4140000-...-001/rechazar (Cuadrilla Alfa) con cada perfil	HTTP 403 Forbidden por ausencia de permiso misiones:terreno:ejecutar y 403 Forbidden por pertenencia horizontal a otra cuadrilla	BRIGADISTA y ENCARGADO reciben "No cuenta con el permiso requerido: misiones:terreno:ejecutar" y delegado2 recibe "No está autorizado para rechazar una misión asignada a otra cuadrilla operativa."	APROBADO	24/11/2026 01:37	-	feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41)
CP-H41-API-11	Manejo de misión inexistente en base de datos (404 Not Found)	Funcional / Negativa	API / Repositorio	Alta	UUID inexistente en tabla mision y delegado autenticado	POST /api/misiones/99999999-0000-4000-8000-000000000999/rechazar con justificación válida	HTTP 404 Not Found con mensaje "No se encontró ninguna misión con el identificador proporcionado."	HTTP 404 Not Found retornado con el mensaje esperado	APROBADO	24/11/2026 01:37	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-12	Bloqueo 409 Conflict ante misión ya RECHAZADA, misión en estado EN_CURSO o misión sin cuadrilla_id asignada	Regla de Negocio / Idempotencia	API / Repositorio	Crítica	Misiones en estado RECHAZADA (MIS-H41-001), EN_CURSO (MIS-H41-004) y sin cuadrilla (bb32f709-...)	POST /rechazar sobre cada una con usuario autorizado / ADMIN	HTTP 409 Conflict impidiendo transiciones ilícitas o doble rechazo	Los tres casos devuelven HTTP 409 Conflict con sus mensajes específicos de conflicto	APROBADO	24/11/2026 01:37	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-13	Control de concurrencia ante carrera simultánea (Promise.all) mediante bloqueo pesimista FOR UPDATE OF mision	Concurrencia / ACID	API / PostgreSQL	Crítica	Misión MIS-H41-006 en estado DESPACHADA asignada a Cuadrilla Beta	2 peticiones simultáneas POST /api/misiones/f4140000-...-006/rechazar con Promise.all	Exactamente una respuesta 200 OK, una respuesta 409 Conflict y 1 solo registro 'RECHAZADA' en mision_hito	Confirmado en vivo: una petición 200 OK, una 409 Conflict ("La misión ya ha sido rechazada previamente.") y hitos_rechazo = 1	APROBADO	24/11/2026 01:38	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-14	Protección de cuadrilla ante otraMisionActiva (EN_MISION) y ante baja lógica (activo = false / eliminado_en IS NOT NULL)	Regla de Negocio / Integridad	Repositorio / BD	Alta	Cuadrilla Gamma con MIS-H41-004 EN_CURSO y Cuadrilla Baja desactivada en NO_DISPONIBLE	POST /rechazar sobre MIS-H41-003 y MIS-H41-005	Cuadrilla Gamma permanece en EN_MISION y Cuadrilla Baja permanece en NO_DISPONIBLE sin reactivarse	Verificado en PostgreSQL: Cuadrilla Gamma queda EN_MISION y Cuadrilla Baja permanece NO_DISPONIBLE	APROBADO	24/11/2026 01:38	-	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-15	Ejecución idempotente de migración 057_permiso_misiones_terreno_ejecutar.ts asignando misiones:terreno:ejecutar a ADMIN y DELEGADO_CUADRILLA	Base de Datos / Migraciones	Migración / DDL	Alta	PostgreSQL 16 operativo y migración 057_permiso_misiones_terreno_ejecutar.ts	npm run db:migrate y consulta SELECT en permiso y rol_permiso	Permiso misiones:terreno:ejecutar (10000000-...-0042) asignado exclusivamente a ADMIN y DELEGADO_CUADRILLA	npm run db:migrate finaliza con código 0 y rol_permiso registra exactamente ADMIN y DELEGADO_CUADRILLA	APROBADO	24/11/2026 01:35	-	feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41)
CP-H41-API-16	Exposición del endpoint POST /api/misiones/{id}/rechazar en GET /openapi.json y documentación funcional en docs/api/misiones.md	Contrato API / Docs	OpenAPI / Docs	Alta	Servidor en ejecución y módulo src/lib/openapi/index.ts	curl -s http://localhost:3001/openapi.json y revisión de docs/api/misiones.md (Sección 3.8 y 5)	Ruta /api/misiones/{id}/rechazar registrada con seguridad BearerAuth, respuestas 200/400/401/403/404/409/500 y sección 3.8 documentada	Endpoint y esquemas RechazarMisionBody / RechazarMisionResponse expuestos en OpenAPI v0.12.0	APROBADO	24/11/2026 01:36	-	docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y regla §3.3 (HU-41)
CP-H41-API-17	Ejecución limpia de suites Vitest, análisis estático ESLint, chequeo TypeScript (tsc --noEmit) y compilación de producción (npm run build)	Automatización / Build	CI / Unit / Build	Alta	Rama feature/h41-cuadrilla-rechazar-asignacion aislada	npm test -- -t "HU-41", npm test, npx next typegen && npx tsc --noEmit, npx eslint, npm run build	100% de tests verdes y 0 errores de compilación, tipos o linter	HU-41: 31/31 pass; Misiones+OpenAPI: 131/131 pass; Global: 874/874 pass; tsc, eslint y next build con 0 errores	APROBADO	24/11/2026 01:39	-	test(misiones): agregar pruebas unitarias para migracion 057, esquemas, repositorio, servicio y ruta de rechazo (HU-41)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Verificación de Integración Gitflow, Migraciones, Tipos, Linter y Pruebas Automatizadas

#### 5.1.1 Verificación de Desfase con `develop` y Conflictos (`BUG-H41-API-01`)
```bash
git merge-base develop HEAD
git rev-list --count HEAD..develop
git merge-tree $(git merge-base develop HEAD) develop HEAD | grep -E "^(changed in both|added in both)"
```
**Resultado observado:**
- Ancestro común: `f3c6860b1236a53895e00e3b6f2e9fcb4bd057cc`
- Commits de diferencia pendientes en `develop`: `78`
- Archivos en conflicto directo detectados en `merge-tree`: `12` (`docs/api/misiones.md`, `route.ts`, `route.test.ts`, `src/lib/openapi/index.ts`, `src/lib/socket/index.ts`, `src/lib/socket/types.ts`, `mision.repository.ts`, `mision.schema.ts`, `mision.service.ts`, `mision-rechazar.repository.test.ts`, `mision-rechazar.schema.test.ts`, `mision-rechazar.service.test.ts`, `permisos.constants.ts`).

#### 5.1.2 Ejecución de Migraciones Kysely (`CP-H41-API-15`)
```bash
npm run db:migrate
docker exec grupo1_postgres psql -U sgrai -d sgrai -c "SELECT p.id, p.codigo, r.codigo as rol FROM permiso p JOIN rol_permiso rp ON rp.permiso_id = p.id JOIN rol r ON r.id = rp.rol_id WHERE p.codigo = 'misiones:terreno:ejecutar';"
```
**Salida de Consola:**
```text
Ejecutando migraciones Kysely de base de datos...
[OK] Migración Kysely ejecutada con éxito: "035_permiso_misiones_terreno_verificar"
[OK] Migración Kysely ejecutada con éxito: "057_permiso_misiones_terreno_ejecutar"
Todas las migraciones se completaron correctamente.

                  id                  |          codigo           |        rol
--------------------------------------+---------------------------+--------------------
 10000000-0000-4000-8000-000000000042 | misiones:terreno:ejecutar | ADMIN
 10000000-0000-4000-8000-000000000042 | misiones:terreno:ejecutar | DELEGADO_CUADRILLA
(2 rows)
```

#### 5.1.3 Suite Focalizada de HU-41 en Vitest (`CP-H41-API-17`)
```bash
npm test -- -t "HU-41"
```
**Salida de Consola:**
```text
 ✓ src/modules/misiones/__tests__/mision-rechazar.service.test.ts (2 tests) 26ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.schema.test.ts (12 tests) 18ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.repository.test.ts (7 tests)
 ✓ src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts (8 tests)
 ✓ src/lib/db/migrations/__tests__/057_permiso_misiones_terreno_ejecutar.test.ts (2 tests) 8ms

 Test Files  5 passed | 72 skipped (77)
      Tests  31 passed | 843 skipped (874)
   Start at  01:36:12
   Duration  7.53s
```

#### 5.1.4 Ejecución Directa de Archivos de Prueba de HU-41 y OpenAPI
```bash
npx vitest run \
  src/modules/misiones/__tests__/mision-rechazar.schema.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.service.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.repository.test.ts \
  src/app/api/misiones/\[id\]/rechazar/__tests__/route.test.ts \
  src/lib/db/migrations/__tests__/057_permiso_misiones_terreno_ejecutar.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```
**Salida de Consola:**
```text
 ✓ src/lib/db/migrations/__tests__/057_permiso_misiones_terreno_ejecutar.test.ts (2 tests) 10ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.schema.test.ts (12 tests) 26ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.repository.test.ts (7 tests) 17ms
 ✓ src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts (8 tests) 43ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.service.test.ts (2 tests) 23ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 310ms

 Test Files  6 passed (6)
      Tests  32 passed (32)
   Start at  01:39:47
   Duration  1.99s
```

#### 5.1.5 Suite Completa, Chequeo de Tipos, ESLint y Build de Producción
```bash
npm test
npx next typegen && npx tsc --noEmit
npx eslint
npm run build
```
**Resultados observados:**
- `npm test`: `77 passed (77)`, `874 passed (874)` en `9.36s`.
- `npx next typegen && npx tsc --noEmit`: `exit code 0` (0 errores).
- `npx eslint`: `exit code 0` (0 errores).
- `npm run build`: Next.js 16.3.4 (Turbopack) compilado sin errores, ruta `/api/misiones/[id]/rechazar` y `/openapi.json` generadas.

---

### 5.2 Ejecución en Vivo vía HTTP (`cURL`), Base de Datos PostgreSQL y Redis Pub/Sub

> **Precondición de prueba:** Servidor iniciado en `http://localhost:3001` (`npm run start`) conectado a PostgreSQL (`localhost:5001`) y Redis (`localhost:6001`). Tokens JWT obtenidos vía `POST /api/seguridad/login` sobre fixture temporal aislado (`f41*`, limpiado al finalizar la sesión).

#### Caso 1: Control de Autenticación (`401 Unauthorized` — `CP-H41-API-09`)
```bash
# 1a. Sin credenciales
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 1b. Token JWT inválido
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token.invalido.123" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 1c. Usuario inactivo (activo = false)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "x-user-id: f4100000-0000-4000-8000-000000000004" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'
```
**Respuestas HTTP/JSON obtenidas:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 401 Unauthorized
{"message":"Token de sesión inválido o expirado."}

HTTP/1.1 401 Unauthorized
{"message":"El usuario especificado se encuentra inactivo en la institución."}
```

#### Caso 2: Control de Acceso RBAC y Pertenencia Horizontal (`403 Forbidden` — `CP-H41-API-10` y `BUG-H41-API-01`)
```bash
# 2a. Rol BRIGADISTA sin permiso misiones:terreno:ejecutar
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_BRIGADISTA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 2b. Rol ENCARGADO sin permiso misiones:terreno:ejecutar
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000003" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 2c. Delegado perteneciente a otra cuadrilla (Cuadrilla Beta intentando rechazar misión de Cuadrilla Alfa)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_BETA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 2d. Regresión HU-69 (BUG-H41-API-01): Patrulla Verificadora intentando rechazar su misión VERIFICACION
curl -s -i -X POST "http://localhost:3001/api/misiones/bb32f709-02d1-4a78-94ba-b2d548460652/rechazar" \
  -H "Content-Type: application/json" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en patrulla"}'
```
**Respuestas HTTP/JSON obtenidas:**
```http
HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: misiones:terreno:ejecutar"}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: misiones:terreno:ejecutar"}

HTTP/1.1 403 Forbidden
{"message":"No está autorizado para rechazar una misión asignada a otra cuadrilla operativa."}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: misiones:terreno:ejecutar"}
```

#### Caso 3: Validación Regla §3.3, UUID, JSON y GPS (`400 Bad Request` — `CP-H41-API-07`, `CP-H41-API-08` y `BUG-H41-API-04`)
```bash
# 3a. Justificación con menos de 5 caracteres ("abcd") y solo espacios ("    ")
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"abcd"}'

curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"    "}'

# 3b. GPS fuera de rango WGS84 y falta de paridad GPS
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave","latitud":-95,"longitud":-73.24}'

curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave","latitud":-39.81422}'

# 3c. Cuerpo vacío con Content-Type application/json (BUG-H41-API-04)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d ''
```
**Respuestas HTTP/JSON obtenidas:**
```http
HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"justificacion_rechazo","mensaje":"El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres."}]}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"latitud","mensaje":"La latitud debe estar entre -90 y 90."}]}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"longitud","mensaje":"Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS."}]}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"","mensaje":"Invalid input: expected object, received undefined"}]}
```

#### Caso 4: Misión Inexistente (`404`) y Conflictos de Estado (`409` — `CP-H41-API-11`, `CP-H41-API-12` y `BUG-H41-API-01`)
```bash
# 4a. Misión inexistente (404)
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000999/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 4b. Misión en estado EN_CURSO (409)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000004/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 4c. Misión VERIFICACION sin cuadrilla_id invocada por ADMIN (BUG-H41-API-01)
curl -s -i -X POST "http://localhost:3001/api/misiones/bb32f709-02d1-4a78-94ba-b2d548460652/rechazar" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en patrulla"}'
```
**Respuestas HTTP/JSON obtenidas:**
```http
HTTP/1.1 404 Not Found
{"message":"No se encontró ninguna misión con el identificador proporcionado."}

HTTP/1.1 409 Conflict
{"message":"La misión no se encuentra en estado 'DESPACHADA' para ser rechazada (estado actual: 'EN_CURSO')."}

HTTP/1.1 409 Conflict
{"message":"La misión indicada no tiene una cuadrilla operativa asignada para ser rechazada."}
```

#### Caso 5: Rechazo Exitoso con Verificación Previa (`VERIFICANDO` — `CP-H41-API-01/02/04/05`) y Sin Verificación Previa (`REPORTADO` — `CP-H41-API-03`)
```bash
# 5a. Integrante activo en cuadrilla_personal rechaza misión con verificación previa completada + GPS
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_INTEGRANTE_ALFA>" \
  -d '{"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida desde base.","latitud":-39.81422,"longitud":-73.24589}'

# 5b. Delegado rechaza misión sin verificación previa usando alias camelCase y exactamente 5 caracteres útiles
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000002/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_BETA>" \
  -d '{"justificacionRechazo":"  12345  "}'
```
**Respuestas HTTP/JSON obtenidas:**
```json
// Respuesta 5a (HTTP 200 OK -> VERIFICANDO):
{
  "message": "Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a VERIFICANDO para su reasignación.",
  "data": {
    "mision": {
      "id": "f4140000-0000-4000-8000-000000000001",
      "codigo": "MIS-H41-001",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "RECHAZADA",
      "justificacionRechazo": "Camión tolva presenta falla hidráulica en ruta de salida desde base.",
      "fechaCierre": "2026-11-24T04:38:06.074Z",
      "actualizadoEn": "2026-11-24T04:38:06.074Z"
    },
    "cuadrilla": {
      "id": "f4120000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla QA H41 Alfa",
      "estado": "DISPONIBLE",
      "delegacionId": "30000000-0000-4000-8000-000000000001",
      "usuarioDelegadoId": "f4100000-0000-4000-8000-000000000001"
    },
    "incidente": {
      "id": "f4130000-0000-4000-8000-000000000001",
      "codigo": "INC-H41-001",
      "estado": "VERIFICANDO",
      "prioridad": "ALTA"
    },
    "hito": {
      "id": "b4936e83-ac01-41c5-8e64-20879aaa4707",
      "misionId": "f4140000-0000-4000-8000-000000000001",
      "hito": "RECHAZADA",
      "descripcion": "Misión rechazada por cuadrilla: Camión tolva presenta falla hidráulica en ruta de salida desde base.",
      "registradoPorId": "f4100000-0000-4000-8000-000000000005",
      "latitud": -39.81422,
      "longitud": -73.24589,
      "creadoEn": "2026-11-24T04:38:06.074Z"
    }
  }
}
```
```json
// Respuesta 5b (HTTP 200 OK -> REPORTADO):
{
  "message": "Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a REPORTADO para su reasignación.",
  "data": {
    "mision": {
      "id": "f4140000-0000-4000-8000-000000000002",
      "codigo": "MIS-H41-002",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "RECHAZADA",
      "justificacionRechazo": "12345",
      "fechaCierre": "2026-11-24T04:38:06.246Z",
      "actualizadoEn": "2026-11-24T04:38:06.246Z"
    },
    "cuadrilla": {
      "id": "f4120000-0000-4000-8000-000000000002",
      "nombre": "Cuadrilla QA H41 Beta",
      "estado": "DISPONIBLE",
      "delegacionId": "30000000-0000-4000-8000-000000000002",
      "usuarioDelegadoId": "f4100000-0000-4000-8000-000000000002"
    },
    "incidente": {
      "id": "f4130000-0000-4000-8000-000000000002",
      "codigo": "INC-H41-002",
      "estado": "REPORTADO",
      "prioridad": "MEDIA"
    },
    "hito": {
      "id": "6c4a0b1b-c281-4411-a7d1-948c2bf92a0c",
      "misionId": "f4140000-0000-4000-8000-000000000002",
      "hito": "RECHAZADA",
      "descripcion": "Misión rechazada por cuadrilla: 12345",
      "registradoPorId": "f4100000-0000-4000-8000-000000000002",
      "latitud": null,
      "longitud": null,
      "creadoEn": "2026-11-24T04:38:06.246Z"
    }
  }
}
```
**Eventos Capturados en Redis Pub/Sub (`SUBSCRIBE sgrai:socket-events` — Caso 5a):**
```text
- room: "encargado"                                    | event: "mision:rechazada"       | payload.misionId: "f4140000-0000-4000-8000-000000000001"
- room: "sala:encargados"                              | event: "mision:rechazada"       | payload.misionId: "f4140000-0000-4000-8000-000000000001"
- room: "supervisor"                                   | event: "mision:rechazada"       | payload.misionId: "f4140000-0000-4000-8000-000000000001"
- room: "cuadrilla:f4120000-0000-4000-8000-000000000001" | event: "mision:rechazada"     | payload.misionId: "f4140000-0000-4000-8000-000000000001"
- room: "sala:encargados"                              | event: "incidente:actualizado"  | payload.datos.nuevoEstado: "VERIFICANDO"
- room: "encargado"                                    | event: "incidente:actualizado"  | payload.datos.nuevoEstado: "VERIFICANDO"
- room: "mapa"                                         | event: "incidente:actualizado"  | payload.datos.nuevoEstado: "VERIFICANDO"
- room: "operaciones"                                  | event: "cuadrilla:actualizada"  | payload.estado: "DISPONIBLE"
- room: "encargado"                                    | event: "cuadrilla:actualizada"  | payload.estado: "DISPONIBLE"
- room: "supervisor"                                   | event: "cuadrilla:actualizada"  | payload.estado: "DISPONIBLE" (omisión de sala:encargados -> BUG-H41-API-05)
```

#### Caso 6: Carrera Concurrente (`Promise.all`) y Verificación en PostgreSQL (`CP-H41-API-13` y `BUG-H41-API-02/03`)
```bash
# Prueba de concurrencia (dos invocaciones simultáneas sobre MIS-H41-006)
# Resultado observado:
#   Petición 1 -> HTTP 200 OK (mision.estado: "RECHAZADA", incidente.estado: "REPORTADO")
#   Petición 2 -> HTTP 409 Conflict {"message":"La misión ya ha sido rechazada previamente."}
#   SQL mision_hito COUNT(*) = 1
```
**Evidencia SQL de estado residual defectuoso en `BUG-H41-API-02`:**
```text
                  id                  |              email               | estado_operativo
--------------------------------------+----------------------------------+------------------
 f4100000-0000-4000-8000-000000000001 | delegado1.h41qa@valdivia.cl      | disponible   <-- (Cuadrilla Gamma sigue EN_MISION)
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La pantalla de solicitud de misión en la PWA debe proveer una opción visible 'Rechazar Misión'. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz gráfica en el repositorio `sgrai-pwa`. |
| **CA-2:** Al presionar 'Rechazar Misión', el sistema debe desplegar un modal o campo de texto obligatorio para ingresar la justificación del rechazo. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz gráfica en el repositorio `sgrai-pwa`. El backend provee el contrato OpenAPI en `GET /openapi.json`. |
| **CA-3:** Cumplimiento estricto de la regla de negocio §3.3: la API debe validar que `justificacion_rechazo` contenga al menos 5 caracteres; de lo contrario, debe rechazar la solicitud con `400 Bad Request`. | `CP-H41-API-03`, `CP-H41-API-07`, `CP-H41-API-08`, `BUG-H41-API-04` | 🟡 **PARCIAL (`BUG-H41-API-04`)** | Rechaza cadenas `< 5` caracteres tras `.trim()` con `400`, pero presenta discrepancia de paridad GPS en `RechazarMisionBodySchema` (OpenAPI) y error en inglés ante cuerpo vacío. |
| **CA-4:** Al confirmar el rechazo motivado, la API debe ejecutar una transacción atómica: (1) Actualizar `mision.estado = 'RECHAZADA'`, (2) Almacenar la `justificacion_rechazo` en la tabla `mision`, (3) Devolver la cuadrilla a estado `DISPONIBLE`, y (4) Registrar el hito de rechazo con la justificación en `mision_hito`. | `CP-H41-API-01`, `CP-H41-API-04`, `CP-H41-API-12`, `CP-H41-API-13`, `CP-H41-API-14`, `BUG-H41-API-02`, `BUG-H41-API-03` | 🟡 **PARCIAL (`BUG-H41-API-02`, `BUG-H41-API-03`)** | La transacción ACID con `.forUpdate("mision")` cumple en el caso nominal, pero `liberarDotacionCuadrillaDeMision` libera a `'disponible'` a delegados/integrantes desplegados en otra cuadrilla activa y `rechazarMisionService` entrega mensajes contradictorios si la cuadrilla conserva otra misión o está inactiva. |
| **CA-5:** El incidente debe retornar a estado `REPORTADO` o `VERIFICANDO` para permitir su reasignación en el Centro de Mando. | `CP-H41-API-01`, `CP-H41-API-03`, `BUG-H41-API-03` | 🟡 **PARCIAL (`BUG-H41-API-03`)** | Retorna correctamente a `VERIFICANDO` (con verificación `COMPLETADA`) o `REPORTADO`, pero carece de guarda frente a incidentes terminales (`RESUELTO`/`NO_ABORDABLE`) o con otra misión activa en curso. |
| **CA-6:** El sistema debe emitir una alerta prioritaria vía WebSocket (`mision:rechazada`) hacia la sala `encargado` del Centro de Mando. | `CP-H41-API-05`, `CP-H41-API-06`, `BUG-H41-API-05` | 🟡 **PARCIAL (`BUG-H41-API-05`)** | `notificarMisionRechazada` emite hacia `encargado`, `sala:encargados`, `supervisor` y `cuadrilla:{id}` en memoria y Redis Pub/Sub; sin embargo `emitirCuadrillaActualizada` omite `sala:encargados`. |
| **CA-7:** El endpoint `POST /api/misiones/{id}/rechazar` debe requerir el permiso RBAC `misiones:terreno:ejecutar`. | `CP-H41-API-02`, `CP-H41-API-09`, `CP-H41-API-10`, `CP-H41-API-15`, `BUG-H41-API-01`, `BUG-H41-API-05` | 🔴 **BLOQUEADO (`BUG-H41-API-01`, `BUG-H41-API-05`)** | Exige `misiones:terreno:ejecutar` (`057_`), pero colisiona frontalmente en `develop` con HU-69 (`misiones:terreno:verificar` sobre la misma ruta) y mantiene el fallback `x-user-id` sin restricción de entorno. |

