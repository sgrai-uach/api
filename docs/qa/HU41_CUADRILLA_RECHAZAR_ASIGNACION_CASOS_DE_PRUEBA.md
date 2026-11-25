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
> * `merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y unificar rechazo de mision (H41/H69)`  
> * `fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)`  
> * `test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision`  
>  
> **Fecha de Auditoría Inicial:** 24/11/2026 01:38.  
> **Fecha de Re-Test Final:** 25/11/2026 14:20.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (`Approved`) — 5/5 DEFECTOS CORREGIDOS Y VERIFICADOS EN RE-TEST (100% PASS)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras la auditoría inicial del 24/11/2026 —en la cual se reportaron **5 defectos reales** (`1` crítico/bloqueante, `2` altos y `2` medios)— el equipo de desarrollo integró la rama `develop` y aplicó los correctivos correspondientes en `feature/h41-cuadrilla-rechazar-asignacion`.

El 25/11/2026 se ejecutó el ciclo completo de **Re-Test**, abarcando inspección de código fuente, verificación de sincronización Gitflow frente a `develop` (`0` commits de atraso), chequeo de tipos TypeScript (`npx next typegen && npx tsc --noEmit`), análisis estático ESLint (`npx eslint`), compilación de producción (`npm run build`), ejecución completa de suites Vitest (`95/95` archivos, `1040/1040` pruebas aprobadas) y pruebas en vivo contra el servidor en modo producción (`NODE_ENV=production`), PostgreSQL 16 + PostGIS (`5001`) y Redis 7 (`6001`, canal `sgrai:socket-events`).

Todos los defectos reportados (`BUG-H41-API-01` a `BUG-H41-API-05`) fueron subsanados satisfactoriamente y sin introducir regresiones en HU-41 ni en HU-69, por lo que el alcance backend de HU-41 queda **certificado para integración hacia `develop`**.

| Métrica de Calidad | Auditoría Inicial (24/11/2026) | Re-Test Final (25/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba Evaluados** | **22** | **22** | 5 Defectos (`BUG-H41-API-01` a `05`) + 17 Casos de Contrato, ACID, RBAC, Concurrencia y Socket.io (`CP-H41-API-01` a `17`) |
| **Casos Aprobados / Corregidos** | **17** | **22** | 5 defectos cerrados como `CORREGIDO` y 17 casos funcionales/regresión `APROBADO` |
| **Defectos Abiertos (Failed)** | **5** | **0** | 0 defectos críticos, altos o medios pendientes |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Entorno PostgreSQL 16 + PostGIS (`5001`) y Redis 7 (`6001`) operativos |
| **Tasa de Aprobación (% Pass)** | **77.3%** | **100.0%** | Criterio de salida QA alcanzado |
| **Sincronización con `develop`** | 🔴 **78 commits detrás** | 🟢 **0 commits detrás** | Rama actualizada con `develop`; despacho polimórfico HU-41 + HU-69 operativo |
| **Suite Focalizada HU-41 (Vitest)** | 🟢 **31/31 tests pass** | 🟢 **58/58 tests pass** | `npm test -- -t "HU-41"` (5 archivos); `67/67` tests en ejecución directa de 6 archivos incluyendo OpenAPI |
| **Suite Global del Repositorio (`npm test`)** | 🟢 **874/874 tests pass** | 🟢 **1040/1040 tests pass** | `95/95` archivos de prueba ejecutados en `8.67s` sin regresiones |
| **TypeScript / ESLint / Build (`next build`)** | 🟢 **0 errores** | 🟢 **0 errores** | `next typegen`, `tsc --noEmit`, `eslint` y `npm run build` limpios |

---

## 2. Registro Técnico de Defectos Detectados y Verificación de Re-Test

### `BUG-H41-API-01`: Desfase de 78 Commits con `develop` y Colisión Arquitectónica, Funcional y RBAC en `POST /api/misiones/[id]/rechazar` frente a HU-69
* **Severidad:** **CRÍTICA / BLOQUEANTE** (Integración Continua, Regresión Funcional de HU-69 y Conflictos Masivos de Merge).
* **Estado Actual:** 🟢 **CORREGIDO** *(Verificado en Re-Test el 25/11/2026 14:20)*.
* **Archivos Modificados en el Fix:**
  * `src/app/api/misiones/[id]/rechazar/route.ts`
  * `src/modules/seguridad/auth.service.ts`
  * `src/modules/misiones/mision.service.ts`
  * `src/modules/misiones/mision.repository.ts`
  * `src/modules/misiones/mision.schema.ts`
  * `src/lib/openapi/index.ts`
  * `src/lib/socket/index.ts` y `src/lib/socket/types.ts`
  * `docs/api/misiones.md`
* **Descripción del Defecto Original:**  
  La rama `feature/h41-cuadrilla-rechazar-asignacion` presentaba un desfase de 78 commits respecto a `develop` con 12 archivos en conflicto directo y sobrescribía de forma excluyente `POST /api/misiones/[id]/rechazar` (previamente certificado en `develop` para patrullas verificadoras bajo HU-69), devolviendo `403 Forbidden` a `PATRULLA_VERIFICADORA` y `409 Conflict` a `ADMIN` sobre misiones `VERIFICACION`.
* **Evidencia de Corrección en Re-Test:**
  1. `git rev-list --count HEAD..develop` retorna **`0`** (rama completamente sincronizada con `develop`, sin conflictos pendientes).
  2. Se incorporó `verificarAlgunPermiso` en `auth.service.ts` exigiendo `misiones:terreno:ejecutar` o `misiones:terreno:verificar`, y `rechazarMisionRepo` en `mision.repository.ts` resuelve polimórficamente el rechazo por tipo de unidad bajo bloqueo pesimista `.forUpdate("mision")`.
  3. Verificado en vivo contra el servidor en producción:
     - `PATRULLA_VERIFICADORA` rechazando su misión `VERIFICACION` `DESPACHADA` (`MIS-H41-PAT-01`): **`HTTP 200 OK`**, `patrulla.estado = "DISPONIBLE"`, `incidente.estado = "REPORTADO"`, emitiendo `mision:rechazada`, `incidente:actualizado` y `patrulla:actualizada`.
     - Control RBAC cruzado: `PATRULLA_VERIFICADORA` sobre misión de cuadrilla responde **`403 Forbidden`** (*"No cuenta con el permiso requerido para rechazar misiones de cuadrilla: misiones:terreno:ejecutar"*); `DELEGADO_CUADRILLA` sobre misión de patrulla responde **`403 Forbidden`** (*"No cuenta con el permiso requerido para rechazar misiones de patrulla: misiones:terreno:verificar"*); `ENCARGADO` responde **`403 Forbidden`** (*"No cuenta con ninguno de los permisos requeridos..."*).
     - Misión sin unidad compatible invocada por `ADMIN` responde **`409 Conflict`**.
* **Solución / Commit:** `merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y unificar rechazo de mision (H41/H69)`

---

### `BUG-H41-API-02`: Corrupción de Disponibilidad Operativa (`usuario.estado_operativo`) en `liberarDotacionCuadrillaDeMision` cuando el Delegado o Integrante Posee Otra Misión o Cuadrilla Activa
* **Severidad:** **ALTA** (Integridad Operativa de Personal y Consistencia ICS).
* **Estado Actual:** 🟢 **CORREGIDO** *(Verificado en Re-Test el 25/11/2026 14:20)*.
* **Archivo Modificado en el Fix:** `src/modules/misiones/mision.repository.ts` (`condicionSinOtrasUnidadesActivas` y `liberarDotacionCuadrillaDeMision`).
* **Descripción del Defecto Original:**  
  Al rechazar una misión, `liberarDotacionCuadrillaDeMision` pasaba a `estado_operativo = 'disponible'` a todos los integrantes y al delegado sin comprobar si participaban en otra cuadrilla activa en `'EN_MISION'`, otra misión activa o una patrulla activa.
* **Evidencia de Corrección en Re-Test:**
  1. Se implementó la guarda correlacionada `condicionSinOtrasUnidadesActivas` con subconsultas `NOT EXISTS` sobre `cuadrilla`, `cuadrilla_personal`, `patrulla_verificadora` y `patrulla_personal` excluyendo la cuadrilla actual.
  2. Verificado en vivo sobre PostgreSQL 16 (confirmando además que el SQL compilado por Kysely ejecuta sin errores de alias ni sintaxis): al rechazar `MIS-H41-001` de `Cuadrilla QA H41 Alfa`, `brigadista.h41qa@valdivia.cl` e `integrante.del.h41qa@valdivia.cl` pasaron a **`disponible`**, mientras que el delegado compartido `delegado1.h41qa@valdivia.cl` **mantuvo `estado_operativo = 'en_mision'`** al continuar asignado a `Cuadrilla QA H41 Gamma` (`EN_MISION`).
* **Solución / Commit:** `fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)`

---

### `BUG-H41-API-03`: Omisión de Validación de Estado Terminal del Incidente (`RESUELTO` / `NO_ABORDABLE`) y de Otras Misiones Activas, más Mensaje de Respuesta Contradictorio en `rechazarMisionService`
* **Severidad:** **ALTA** (Violación de Invariantes ICS, Coherencia de Eventos WebSocket y Contrato de Respuesta).
* **Estado Actual:** 🟢 **CORREGIDO** *(Verificado en Re-Test el 25/11/2026 14:20)*.
* **Archivos Modificados en el Fix:**
  * `src/modules/misiones/mision.repository.ts`
  * `src/modules/misiones/mision.service.ts`
* **Descripción del Defecto Original:**  
  Se permitía rechazar misiones sobre incidentes ya cerrados (`RESUELTO`/`NO_ABORDABLE`), no se verificaba si el incidente poseía otra misión activa antes de revertirlo, se emitía `incidente:actualizado` sin cambio real y `rechazarMisionService` devolvía un `message` fijo que contradecía los estados efectivos en JSON.
* **Evidencia de Corrección en Re-Test:**
  1. Rechazo de `MIS-H41-003` asociada a incidente terminal `INC-H41-003` (`RESUELTO`): responde **`HTTP 409 Conflict`** (*"No es posible rechazar la misión porque el incidente asociado ya se encuentra en estado terminal 'RESUELTO'."*).
  2. Rechazo de `MIS-H41-008` asociada a `INC-H41-004` (que cuenta con `MIS-H41-004` en estado `EN_CURSO`): responde **`HTTP 200 OK`**, `incidente.estado` permanece **`EN_ATENCION`** (verificado en SQL), el campo `message` informa exactamente *"Misión rechazada exitosamente. La cuadrilla permanece en estado EN_MISION y el incidente mantiene su estado EN_ATENCION al contar con otra misión activa."* y **no se emite ningún evento `incidente:actualizado`** en Redis Pub/Sub.
  3. Rechazo de `MIS-H41-005` (`Cuadrilla Baja` en estado `NO_DISPONIBLE`, `incidente_id = null`): responde **`HTTP 200 OK`** con `message`: *"Misión rechazada exitosamente. La cuadrilla permanece en estado NO_DISPONIBLE."* y sin emitir `incidente:actualizado`.
* **Solución / Commit:** `fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)`

---

### `BUG-H41-API-04`: Divergencia OpenAPI vs Runtime en Paridad GPS (`RechazarMisionBodySchema`), Error Zod en Inglés para Cuerpo Vacío y Omisiones en `docs/api/misiones.md` y Tests OpenAPI
* **Severidad:** **MEDIA** (Contrato OpenAPI 3.0, Experiencia de Validación y Trazabilidad Documental).
* **Estado Actual:** 🟢 **CORREGIDO** *(Verificado en Re-Test el 25/11/2026 14:20)*.
* **Archivos Modificados en el Fix:**
  * `src/modules/misiones/mision.schema.ts`
  * `src/app/api/misiones/[id]/rechazar/route.ts`
  * `src/lib/openapi/index.ts`
  * `docs/api/misiones.md`
  * `src/app/openapi.json/__tests__/route.test.ts`
* **Descripción del Defecto Original:**  
  `RechazarMisionBodySchema` omitía la paridad GPS y límite superior de longitud (`maxLength: 1000`); el cuerpo vacío retornaba un error Zod en inglés (`expected object, received undefined`); la Sección 4 de `docs/api/misiones.md` omitía errores `403/404/409` del endpoint de rechazo y `src/app/openapi.json/__tests__/route.test.ts` carecía de aserciones para `/api/misiones/{id}/rechazar`.
* **Evidencia de Corrección en Re-Test:**
  1. Verificado en vivo en `POST /api/misiones/{id}/rechazar`:
     - Cuerpo vacío (`-d ''`) y arreglo JSON (`[]`) devuelven **`400 Bad Request`** en español con `campo: "justificacion_rechazo"` (*"El cuerpo de la solicitud es obligatorio y debe contener justificacion_rechazo (mínimo 5 caracteres)."*).
     - `justificacion_rechazo` de `1001` caracteres devuelve **`400 Bad Request`** (*"no puede exceder los 1000 caracteres"*).
     - Paridad GPS (`latitud` sin `longitud`) devuelve **`400 Bad Request`** y la regla `.refine()` reside también en `RechazarMisionBodySchema`.
  2. `GET /openapi.json` publica `/api/misiones/{id}/rechazar` unificado (`HU-41 / HU-69`) con `maxLength: 1000` en `RechazarMisionBody` y propiedades `cuadrilla`/`patrulla` en `RechazarMisionResponse`.
  3. `docs/api/misiones.md` (Secciones 3.9, 4 y 5) cubre integralmente los errores `400/401/403/404/409` y salas WebSocket, y `src/app/openapi.json/__tests__/route.test.ts` valida explícitamente la ruta y esquemas de rechazo.
* **Solución / Commit:** `fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)`

---

### `BUG-H41-API-05`: Omisión de Sala `sala:encargados` en `emitirCuadrillaActualizada`, Aceptación Incondicional de `x-user-id` en Producción y Brechas de Cobertura Unitaria
* **Severidad:** **MEDIA** (Tiempo Real WebSocket, Endurecimiento de Seguridad y Cobertura de Pruebas).
* **Estado Actual:** 🟢 **CORREGIDO** *(Verificado en Re-Test el 25/11/2026 14:20)*.
* **Archivos Modificados en el Fix:**
  * `src/lib/socket/index.ts`
  * `src/app/api/misiones/[id]/rechazar/route.ts`
  * `src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts`
  * `src/modules/misiones/__tests__/mision-rechazar.repository.test.ts`
  * `src/modules/misiones/__tests__/mision-rechazar.schema.test.ts`
  * `src/modules/misiones/__tests__/mision-rechazar.service.test.ts`
* **Descripción del Defecto Original:**  
  `emitirCuadrillaActualizada` omitía la sala `"sala:encargados"`, el fallback `x-user-id` seguía habilitado en `NODE_ENV=production` y existían brechas en las suites unitarias de ruta y repositorio.
* **Evidencia de Corrección en Re-Test:**
  1. Captura en vivo sobre Redis Pub/Sub (`sgrai:socket-events`): `cuadrilla:actualizada` se publica ahora en las 4 salas **`operaciones`, `encargado`, `sala:encargados` y `supervisor`**.
  2. Verificación en vivo sobre servidor en producción (`NODE_ENV=production`): enviar `-H "x-user-id: f4100000-0000-4000-8000-000000000001"` sin cabecera `Authorization: Bearer` retorna **`HTTP 401 Unauthorized`** (*"Se requiere cabecera de autenticación Authorization: Bearer <token>."*).
  3. Cobertura unitaria ampliada en los archivos de HU-41/HU-69 de `31` a **`58` tests bajo filtro `"HU-41"`** (`67/67` tests en ejecución directa de los 6 archivos, incluyendo JSON malformado, cuerpo vacío, GPS, `ForbiddenError`, `NODE_ENV=production`, `esAdmin`, `cuadrilla_personal`, concurrencia y estado terminal).
* **Solución / Commit:** `fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)`

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H41-API-01` | Desfase con `develop` y colisión arquitectónica/RBAC en `POST /api/misiones/[id]/rechazar` frente a HU-69 | Integración / Gitflow / RBAC | API / Arquitectura | Crítica | Rama `feature/h41-cuadrilla-rechazar-asignacion` sincronizada con `develop` y misión `VERIFICACION` `DESPACHADA` (`MIS-H41-PAT-01`) | `git rev-list --count HEAD..develop`, `POST /api/misiones/f4140000-...-007/rechazar` con `PATRULLA_VERIFICADORA` y pruebas cruzadas RBAC | `0` commits detrás de `develop`, `200 OK` para patrulla (HU-69), `200 OK` para cuadrilla (HU-41) y `403` en intentos cruzados | Verificado: `0` commits detrás de `develop`; patrulla rechaza su misión con `200 OK` (`patrulla: DISPONIBLE`, `incidente: REPORTADO`); cruces RBAC bloqueados con `403 Forbidden` | CORREGIDO | 24/11/2026 01:37 | 25/11/2026 14:20 | merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y unificar rechazo de mision (H41/H69) |
| `BUG-H41-API-02` | Preservación de `usuario.estado_operativo = 'en_mision'` en `liberarDotacionCuadrillaDeMision` cuando el delegado posee otra cuadrilla activa en `EN_MISION` | Regla de Negocio / Integridad | Repositorio / BD | Alta | Delegado compartido entre `Cuadrilla Alfa` (`EN_MISION`, `MIS-H41-001` `DESPACHADA`) y `Cuadrilla Gamma` (`EN_MISION`, `MIS-H41-004` `EN_CURSO`), más brigadista e integrante exclusivos en Alfa | `POST /api/misiones/f4140000-0000-4000-8000-000000000001/rechazar` y consulta SQL sobre tabla `usuario` | `delegado1` mantiene `estado_operativo = 'en_mision'` mientras continúe en `Cuadrilla Gamma`; personal exclusivo de Alfa pasa a `'disponible'` | Verificado en PostgreSQL 16: `brigadista` e `integrante.del` pasan a `'disponible'` y `delegado1.h41qa@valdivia.cl` permanece en `'en_mision'` | CORREGIDO | 24/11/2026 01:38 | 25/11/2026 14:20 | fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05) |
| `BUG-H41-API-03` | Guardia de estado terminal del incidente (`RESUELTO`/`NO_ABORDABLE`), preservación ante otra misión activa y `message`/eventos coherentes en `rechazarMisionService` | Regla de Negocio ICS / Contrato | Repositorio / Servicio | Alta | `MIS-H41-003` sobre incidente `RESUELTO`; `MIS-H41-008` sobre `INC-H41-004` con `MIS-H41-004` `EN_CURSO`; `MIS-H41-005` en cuadrilla `NO_DISPONIBLE` sin incidente | `POST /rechazar` sobre `MIS-H41-003`, `MIS-H41-008` y `MIS-H41-005` y monitoreo Redis `sgrai:socket-events` | `409 Conflict` en incidente terminal; `200 OK` sin revertir `INC-H41-004` ni emitir `incidente:actualizado` si hay otra misión activa; `message` fiel al estado resultante | `MIS-H41-003` responde `409 Conflict`; `MIS-H41-008` mantiene `INC-H41-004` en `EN_ATENCION` sin emitir `incidente:actualizado`; `MIS-H41-005` informa exactamente `"La cuadrilla permanece en estado NO_DISPONIBLE."` | CORREGIDO | 24/11/2026 01:38 | 25/11/2026 14:20 | fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05) |
| `BUG-H41-API-04` | Paridad OpenAPI vs runtime en GPS y `maxLength: 1000`, error en español ante cuerpo vacío/no-objeto y actualización de `docs/api/misiones.md` y tests OpenAPI | Contrato / Validación / Docs | OpenAPI / Route / Docs | Media | Servidor activo en `http://localhost:3001`, especificación `GET /openapi.json` y suite OpenAPI | `POST /rechazar` con `-d ''`, `-d '[]'`, `1001` caracteres y solo `latitud`; consulta `GET /openapi.json` y `src/app/openapi.json/__tests__/route.test.ts` | `400 Bad Request` en español sobre `campo: "justificacion_rechazo"`, paridad GPS y `maxLength: 1000` en OpenAPI, docs completas y test OpenAPI verde | Cuerpo vacío y `[]` responden `400` en español; `1001` chars y paridad GPS retornan `400`; `GET /openapi.json`, `docs/api/misiones.md` y `openapi.json/route.test.ts` actualizados y verdes | CORREGIDO | 24/11/2026 01:37 | 25/11/2026 14:20 | fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05) |
| `BUG-H41-API-05` | Inclusión de `sala:encargados` en `emitirCuadrillaActualizada`, bloqueo de `x-user-id` en `NODE_ENV=production` y ampliación de cobertura unitaria | Tiempo Real / Seguridad / Tests | Socket / Route / Unit | Media | Servidor ejecutando en `NODE_ENV=production`, Redis `sgrai:socket-events` y suites unitarias Vitest | Petición con `-H "x-user-id: ..."` sin Bearer en producción; captura Redis durante `POST /rechazar`; `npm test -- -t "HU-41"` | `401 Unauthorized` para `x-user-id` en producción; `cuadrilla:actualizada` publicado en `sala:encargados`; cobertura unitaria de todos los casos borde | `x-user-id` en producción retorna `401 Unauthorized`; Redis confirma `cuadrilla:actualizada` en `operaciones`, `encargado`, `sala:encargados` y `supervisor`; tests HU-41 ampliados a `58/58` (`67/67` directos) | CORREGIDO | 24/11/2026 01:38 | 25/11/2026 14:20 | test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision |
| `CP-H41-API-01` | Rechazo motivado exitoso (`200 OK`) con retorno del incidente a `VERIFICANDO` (verificación previa `COMPLETADA`) y registro de coordenadas GPS | Funcional / Positiva | API / E2E Local | Crítica | Misión `MIS-H41-001` (`DESPACHADA`), `Cuadrilla Alfa` (`EN_MISION`), incidente `INC-H41-001` (`EN_ATENCION`) con misión `VERIFICACION` `COMPLETADA` | `POST /api/misiones/f4140000-...-001/rechazar` con JWT y `{"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida desde base.","latitud":-39.81422,"longitud":-73.24589}` | `HTTP 200 OK`, misión `RECHAZADA`, cuadrilla `DISPONIBLE`, incidente `VERIFICANDO` e hito `RECHAZADA` con coordenadas GPS | `HTTP 200 OK` con transición completa, `incidente.estado: "VERIFICANDO"`, `cuadrilla.estado: "DISPONIBLE"` y coordenadas `-39.81422, -73.24589` | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-02` | Autorización exitosa para integrante activo en `cuadrilla_personal` con permiso `misiones:terreno:ejecutar` | Seguridad / Autorización | API / Repositorio | Alta | Usuario `integrante.del.h41qa@valdivia.cl` (`DELEGADO_CUADRILLA`) registrado en `cuadrilla_personal` de `Cuadrilla Alfa` | `POST /api/misiones/f4140000-...-001/rechazar` con `Authorization: Bearer <token_integrante>` | `HTTP 200 OK` registrando `registradoPorId` del integrante autenticado en `mision_hito` | `HTTP 200 OK` autorizando al integrante activo y registrando `registradoPorId: f4100000-...-005` | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-03` | Rechazo motivado exitoso (`200 OK`) sobre incidente sin verificación previa retornando a `REPORTADO` con alias `justificacionRechazo` y borde exacto de 5 caracteres | Funcional / Límite | API / Schema | Crítica | Misión `MIS-H41-002` (`DESPACHADA`), incidente `INC-H41-002` (`EN_ATENCION`) sin misión `VERIFICACION` `COMPLETADA` | `POST /api/misiones/f4140000-...-002/rechazar` con `{"justificacionRechazo":"  12345  "}` | `HTTP 200 OK` aplicando `.trim()` a `"12345"` y revirtiendo `incidente.estado` a `"REPORTADO"` | `HTTP 200 OK` con `justificacionRechazo: "12345"` e `incidente.estado: "REPORTADO"` | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-04` | Persistencia ACID en PostgreSQL y trazabilidad de bitácora e historial en `GET /api/misiones/{id}` | Integridad / ACID | Base de Datos / API | Crítica | Rechazo confirmado de `MIS-H41-001` en PostgreSQL 16 | Consultas SQL en `mision`, `cuadrilla`, `incidente`, `mision_hito` y `GET /api/misiones/f4140000-...-001` | Las 4 tablas actualizadas atómicamente con `fecha_cierre` no nula y `GET /api/misiones/{id}` exponiendo `justificacionRechazo` y hito `RECHAZADA` en `bitacoraTiempos` | Verificado en PostgreSQL y en respuesta `200 OK` de `GET /api/misiones/{id}` con `bitacoraTiempos[0].hito === "RECHAZADA"` | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-05` | Emisión de alerta prioritaria WebSocket `mision:rechazada` hacia sala `encargado`, `sala:encargados`, `supervisor` y `cuadrilla:{id}` vía Redis Pub/Sub | Tiempo Real / Socket.io | Servicio / Redis | Crítica | Suscriptor conectado al canal Redis `sgrai:socket-events` y rechazo exitoso de `MIS-H41-001` | `POST /api/misiones/f4140000-...-001/rechazar` y lectura de mensajes en `sgrai:socket-events` | Emisión de `mision:rechazada` hacia `encargado`, `sala:encargados`, `supervisor` y `cuadrilla:{id}` junto a `incidente:actualizado` y `cuadrilla:actualizada` | Capturados en Redis los 4 mensajes `mision:rechazada`, 3 `incidente:actualizado` y 4 `cuadrilla:actualizada` (incluyendo `sala:encargados`) | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | feat(socket): agregar evento mision:rechazada en socket.io y redis pub/sub (HU-41) |
| `CP-H41-API-06` | Resiliencia de respuesta `200 OK` ante falla del broker Redis/Socket.io tras confirmar la transacción en BD | Robustez / Tolerancia a Fallos | Servicio / Unitaria | Media | Mock de `notificarMisionRechazada` lanzando excepción `Error("Redis offline")` | Ejecución de `mision-rechazar.service.test.ts` | La excepción en socket se registra en log sin revertir ni fallar la respuesta del servicio | `rechazarMisionService` retorna `estado: "RECHAZADA"` con `6/6` tests aprobados en `mision-rechazar.service.test.ts` | APROBADO | 24/11/2026 01:39 | 25/11/2026 14:20 | test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision |
| `CP-H41-API-07` | Cumplimiento Regla §3.3: bloqueo `400 Bad Request` ante justificación ausente (`{}`), vacía (`""`), espacios (`"    "`) o < 5 caracteres (`"abcd"`) | Validación / Límite | API / Schema | Crítica | Usuario autenticado con permiso `misiones:terreno:ejecutar` | `POST /api/misiones/{id}/rechazar` con `{}`, `{"justificacion_rechazo":""}`, `{"justificacion_rechazo":"abcd"}`, `{"justificacion_rechazo":"    "}` | `HTTP 400 Bad Request` indicando mínimo 5 caracteres en `justificacion_rechazo` y cero mutaciones en BD | Todas las variantes devuelven `HTTP 400 Bad Request` con mensaje `"El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres."` | APROBADO | 24/11/2026 01:37 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-08` | Validación de parámetro UUID inválido, sintaxis JSON malformada, cotas geográficas WGS84 y paridad GPS (`400 Bad Request`) | Validación / Contrato | API / Route / Zod | Media | Usuario autenticado con permiso `misiones:terreno:ejecutar` | `id-invalido`, body `{malformed`, `{"justificacion_rechazo":"...","latitud":-95,"longitud":-73.24}` y `{"justificacion_rechazo":"...","latitud":-39.81422}` | `HTTP 400 Bad Request` controlado sin excepciones `500` ni desbordamientos numéricos en PostgreSQL | Las 4 peticiones responden `HTTP 400 Bad Request` con detalles descriptivos por campo | APROBADO | 24/11/2026 01:37 | 25/11/2026 14:20 | fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05) |
| `CP-H41-API-09` | Control de autenticación (`401 Unauthorized`): ausencia de credenciales, token JWT inválido y usuario con `activo = false` | Seguridad / Autenticación | API / Auth | Crítica | Petición sin credenciales, JWT manipulado e identidad inactiva (`f4100000-...-004`) | `POST /api/misiones/{id}/rechazar` sin headers, con `Bearer token.invalido.123` y con usuario inactivo | `HTTP 401 Unauthorized` impidiendo el acceso en los tres escenarios | Los tres escenarios responden `HTTP 401 Unauthorized` con mensajes diferenciados | APROBADO | 24/11/2026 01:37 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-10` | Control de acceso RBAC (`403 Forbidden`): denegación a roles sin permisos de rechazo en terreno (`BRIGADISTA`, `ENCARGADO`) y a delegado de otra cuadrilla | Seguridad / RBAC | API / Repositorio | Crítica | Usuarios `BRIGADISTA`, `ENCARGADO` y `delegado2.h41qa@valdivia.cl` (asignado a `Cuadrilla Beta`) | `POST /api/misiones/f4140000-...-001/rechazar` (`Cuadrilla Alfa`) con cada perfil | `HTTP 403 Forbidden` por ausencia de permisos requeridos y `403 Forbidden` por pertenencia horizontal a otra cuadrilla | `BRIGADISTA` y `ENCARGADO` reciben `403 Forbidden` por permisos y `delegado2` recibe `"No está autorizado para rechazar una misión asignada a otra cuadrilla operativa."` | APROBADO | 24/11/2026 01:37 | 25/11/2026 14:20 | feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41) |
| `CP-H41-API-11` | Manejo de misión inexistente en base de datos (`404 Not Found`) | Funcional / Negativa | API / Repositorio | Alta | UUID inexistente en tabla `mision` y delegado autenticado | `POST /api/misiones/99999999-0000-4000-8000-000000000999/rechazar` con justificación válida | `HTTP 404 Not Found` con mensaje `"No se encontró ninguna misión con el identificador proporcionado."` | `HTTP 404 Not Found` retornado con el mensaje esperado | APROBADO | 24/11/2026 01:37 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-12` | Bloqueo `409 Conflict` ante misión ya `RECHAZADA`, misión en estado `EN_CURSO` o misión sin unidad operativa compatible asignada | Regla de Negocio / Idempotencia | API / Repositorio | Crítica | Misiones en estado `RECHAZADA`, `EN_CURSO` (`MIS-H41-004`) y sin unidad (`MIS-H41-009`) | `POST /rechazar` sobre cada una con usuario autorizado / `ADMIN` | `HTTP 409 Conflict` impidiendo transiciones ilícitas o doble rechazo | Los tres casos devuelven `HTTP 409 Conflict` con sus mensajes específicos de conflicto | APROBADO | 24/11/2026 01:37 | 25/11/2026 14:20 | merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y unificar rechazo de mision (H41/H69) |
| `CP-H41-API-13` | Control de concurrencia ante carrera simultánea (`Promise.all`) mediante bloqueo pesimista `FOR UPDATE OF mision` | Concurrencia / ACID | API / PostgreSQL | Crítica | Misión `MIS-H41-006` en estado `DESPACHADA` asignada a `Cuadrilla Beta` | 2 peticiones simultáneas `POST /api/misiones/f4140000-...-006/rechazar` con `Promise.all` | Exactamente una respuesta `200 OK`, una respuesta `409 Conflict` y 1 solo registro `'RECHAZADA'` en `mision_hito` | Confirmado en Re-Test en vivo: una petición `200 OK`, una `409 Conflict` (`"La misión ya ha sido rechazada previamente."`) y `hitos_rechazo = 1` | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41) |
| `CP-H41-API-14` | Protección de cuadrilla ante `otraMisionActiva` (`EN_MISION`) y ante baja lógica (`activo = false` / `eliminado_en IS NOT NULL`) | Regla de Negocio / Integridad | Repositorio / BD | Alta | `Cuadrilla Beta` con otra misión activa y `Cuadrilla Baja` desactivada en `NO_DISPONIBLE` | `POST /rechazar` sobre `MIS-H41-008` y `MIS-H41-005` | `Cuadrilla Beta` permanece en `EN_MISION` y `Cuadrilla Baja` permanece en `NO_DISPONIBLE` sin reactivarse | Verificado en PostgreSQL y respuesta JSON: `Cuadrilla Beta` queda `EN_MISION` y `Cuadrilla Baja` permanece `NO_DISPONIBLE` | APROBADO | 24/11/2026 01:38 | 25/11/2026 14:20 | fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05) |
| `CP-H41-API-15` | Ejecución idempotente de migración `057_permiso_misiones_terreno_ejecutar.ts` asignando `misiones:terreno:ejecutar` a `ADMIN` y `DELEGADO_CUADRILLA` | Base de Datos / Migraciones | Migración / DDL | Alta | PostgreSQL 16 operativo y migración `057_permiso_misiones_terreno_ejecutar.ts` | Verificación en `permiso`/`rol_permiso` y suite `057_permiso_misiones_terreno_ejecutar.test.ts` | Permiso `misiones:terreno:ejecutar` asignado exclusivamente a `ADMIN` y `DELEGADO_CUADRILLA` coexistiendo con `misiones:terreno:verificar` | Verificado en `rol_permiso`: `misiones:terreno:ejecutar` (`ADMIN`, `DELEGADO_CUADRILLA`) y `misiones:terreno:verificar` (`ADMIN`, `PATRULLA_VERIFICADORA`), `2/2` tests pass | APROBADO | 24/11/2026 01:35 | 25/11/2026 14:17 | feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41) |
| `CP-H41-API-16` | Exposición del endpoint `POST /api/misiones/{id}/rechazar` unificado en `GET /openapi.json` y documentación funcional en `docs/api/misiones.md` | Contrato API / Docs | OpenAPI / Docs | Alta | Servidor en ejecución y módulo `src/lib/openapi/index.ts` | `curl -s http://localhost:3001/openapi.json` y revisión de `docs/api/misiones.md` (Secciones 3.9, 4 y 5) | Ruta `/api/misiones/{id}/rechazar` registrada con `BearerAuth`, `maxLength: 1000`, `cuadrilla`/`patrulla` y docs completas | Endpoint unificado (`HU-41 / HU-69`) y esquemas `RechazarMisionBody` / `RechazarMisionResponse` expuestos en OpenAPI v0.12.0 y validados en `openapi.json/route.test.ts` | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision |
| `CP-H41-API-17` | Ejecución limpia de suites Vitest, análisis estático ESLint, chequeo TypeScript (`tsc --noEmit`) y compilación de producción (`npm run build`) | Automatización / Build | CI / Unit / Build | Alta | Rama `feature/h41-cuadrilla-rechazar-asignacion` sincronizada con `develop` | `npm test -- -t "HU-41"`, `npm test`, `npx next typegen && npx tsc --noEmit`, `npx eslint`, `npm run build` | 100% de tests verdes y 0 errores de compilación, tipos o linter | HU-41: `58/58` pass (`67/67` directos); Global: `1040/1040` pass (`95/95` archivos); `tsc`, `eslint` y `next build` con `0` errores | APROBADO | 24/11/2026 01:39 | 25/11/2026 14:15 | test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H41-API-01	Desfase con develop y colisión arquitectónica/RBAC en POST /api/misiones/[id]/rechazar frente a HU-69	Integración / Gitflow / RBAC	API / Arquitectura	Crítica	Rama feature/h41-cuadrilla-rechazar-asignacion sincronizada con develop y misión VERIFICACION DESPACHADA (MIS-H41-PAT-01)	git rev-list --count HEAD..develop, POST /api/misiones/f4140000-...-007/rechazar con PATRULLA_VERIFICADORA y pruebas cruzadas RBAC	0 commits detrás de develop, 200 OK para patrulla (HU-69), 200 OK para cuadrilla (HU-41) y 403 en intentos cruzados	Verificado: 0 commits detrás de develop; patrulla rechaza su misión con 200 OK (patrulla: DISPONIBLE, incidente: REPORTADO); cruces RBAC bloqueados con 403 Forbidden	CORREGIDO	24/11/2026 01:37	25/11/2026 14:20	merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y unificar rechazo de mision (H41/H69)
BUG-H41-API-02	Preservación de usuario.estado_operativo = 'en_mision' en liberarDotacionCuadrillaDeMision cuando el delegado posee otra cuadrilla activa en EN_MISION	Regla de Negocio / Integridad	Repositorio / BD	Alta	Delegado compartido entre Cuadrilla Alfa (EN_MISION, MIS-H41-001 DESPACHADA) y Cuadrilla Gamma (EN_MISION, MIS-H41-004 EN_CURSO), más brigadista e integrante exclusivos en Alfa	POST /api/misiones/f4140000-0000-4000-8000-000000000001/rechazar y consulta SQL sobre tabla usuario	delegado1 mantiene estado_operativo = 'en_mision' mientras continúe en Cuadrilla Gamma; personal exclusivo de Alfa pasa a 'disponible'	Verificado en PostgreSQL 16: brigadista e integrante.del pasan a 'disponible' y delegado1.h41qa@valdivia.cl permanece en 'en_mision'	CORREGIDO	24/11/2026 01:38	25/11/2026 14:20	fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)
BUG-H41-API-03	Guardia de estado terminal del incidente (RESUELTO/NO_ABORDABLE), preservación ante otra misión activa y message/eventos coherentes en rechazarMisionService	Regla de Negocio ICS / Contrato	Repositorio / Servicio	Alta	MIS-H41-003 sobre incidente RESUELTO; MIS-H41-008 sobre INC-H41-004 con MIS-H41-004 EN_CURSO; MIS-H41-005 en cuadrilla NO_DISPONIBLE sin incidente	POST /rechazar sobre MIS-H41-003, MIS-H41-008 y MIS-H41-005 y monitoreo Redis sgrai:socket-events	409 Conflict en incidente terminal; 200 OK sin revertir INC-H41-004 ni emitir incidente:actualizado si hay otra misión activa; message fiel al estado resultante	MIS-H41-003 responde 409 Conflict; MIS-H41-008 mantiene INC-H41-004 en EN_ATENCION sin emitir incidente:actualizado; MIS-H41-005 informa exactamente "La cuadrilla permanece en estado NO_DISPONIBLE."	CORREGIDO	24/11/2026 01:38	25/11/2026 14:20	fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)
BUG-H41-API-04	Paridad OpenAPI vs runtime en GPS y maxLength: 1000, error en español ante cuerpo vacío/no-objeto y actualización de docs/api/misiones.md y tests OpenAPI	Contrato / Validación / Docs	OpenAPI / Route / Docs	Media	Servidor activo en http://localhost:3001, especificación GET /openapi.json y suite OpenAPI	POST /rechazar con -d '', -d '[]', 1001 caracteres y solo latitud; consulta GET /openapi.json y src/app/openapi.json/__tests__/route.test.ts	400 Bad Request en español sobre campo: "justificacion_rechazo", paridad GPS y maxLength: 1000 en OpenAPI, docs completas y test OpenAPI verde	Cuerpo vacío y [] responden 400 en español; 1001 chars y paridad GPS retornan 400; GET /openapi.json, docs/api/misiones.md y openapi.json/route.test.ts actualizados y verdes	CORREGIDO	24/11/2026 01:37	25/11/2026 14:20	fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)
BUG-H41-API-05	Inclusión de sala:encargados en emitirCuadrillaActualizada, bloqueo de x-user-id en NODE_ENV=production y ampliación de cobertura unitaria	Tiempo Real / Seguridad / Tests	Socket / Route / Unit	Media	Servidor ejecutando en NODE_ENV=production, Redis sgrai:socket-events y suites unitarias Vitest	Petición con -H "x-user-id: ..." sin Bearer en producción; captura Redis durante POST /rechazar; npm test -- -t "HU-41"	401 Unauthorized para x-user-id en producción; cuadrilla:actualizada publicado en sala:encargados; cobertura unitaria de todos los casos borde	x-user-id en producción retorna 401 Unauthorized; Redis confirma cuadrilla:actualizada en operaciones, encargado, sala:encargados y supervisor; tests HU-41 ampliados a 58/58 (67/67 directos)	CORREGIDO	24/11/2026 01:38	25/11/2026 14:20	test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision
CP-H41-API-01	Rechazo motivado exitoso (200 OK) con retorno del incidente a VERIFICANDO (verificación previa COMPLETADA) y registro de coordenadas GPS	Funcional / Positiva	API / E2E Local	Crítica	Misión MIS-H41-001 (DESPACHADA), Cuadrilla Alfa (EN_MISION), incidente INC-H41-001 (EN_ATENCION) con misión VERIFICACION COMPLETADA	POST /api/misiones/f4140000-...-001/rechazar con JWT y {"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida desde base.","latitud":-39.81422,"longitud":-73.24589}	HTTP 200 OK, misión RECHAZADA, cuadrilla DISPONIBLE, incidente VERIFICANDO e hito RECHAZADA con coordenadas GPS	HTTP 200 OK con transición completa, incidente.estado: "VERIFICANDO", cuadrilla.estado: "DISPONIBLE" y coordenadas -39.81422, -73.24589	APROBADO	24/11/2026 01:38	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-02	Autorización exitosa para integrante activo en cuadrilla_personal con permiso misiones:terreno:ejecutar	Seguridad / Autorización	API / Repositorio	Alta	Usuario integrante.del.h41qa@valdivia.cl (DELEGADO_CUADRILLA) registrado en cuadrilla_personal de Cuadrilla Alfa	POST /api/misiones/f4140000-...-001/rechazar con Authorization: Bearer <token_integrante>	HTTP 200 OK registrando registradoPorId del integrante autenticado en mision_hito	HTTP 200 OK autorizando al integrante activo y registrando registradoPorId: f4100000-...-005	APROBADO	24/11/2026 01:38	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-03	Rechazo motivado exitoso (200 OK) sobre incidente sin verificación previa retornando a REPORTADO con alias justificacionRechazo y borde exacto de 5 caracteres	Funcional / Límite	API / Schema	Crítica	Misión MIS-H41-002 (DESPACHADA), incidente INC-H41-002 (EN_ATENCION) sin misión VERIFICACION COMPLETADA	POST /api/misiones/f4140000-...-002/rechazar con {"justificacionRechazo":"  12345  "}	HTTP 200 OK aplicando .trim() a "12345" y revirtiendo incidente.estado a "REPORTADO"	HTTP 200 OK con justificacionRechazo: "12345" e incidente.estado: "REPORTADO"	APROBADO	24/11/2026 01:38	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-04	Persistencia ACID en PostgreSQL y trazabilidad de bitácora e historial en GET /api/misiones/{id}	Integridad / ACID	Base de Datos / API	Crítica	Rechazo confirmado de MIS-H41-001 en PostgreSQL 16	Consultas SQL en mision, cuadrilla, incidente, mision_hito y GET /api/misiones/f4140000-...-001	Las 4 tablas actualizadas atómicamente con fecha_cierre no nula y GET /api/misiones/{id} exponiendo justificacionRechazo y hito RECHAZADA en bitacoraTiempos	Verificado en PostgreSQL y en respuesta 200 OK de GET /api/misiones/{id} con bitacoraTiempos[0].hito === "RECHAZADA"	APROBADO	24/11/2026 01:38	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-05	Emisión de alerta prioritaria WebSocket mision:rechazada hacia sala encargado, sala:encargados, supervisor y cuadrilla:{id} vía Redis Pub/Sub	Tiempo Real / Socket.io	Servicio / Redis	Crítica	Suscriptor conectado al canal Redis sgrai:socket-events y rechazo exitoso de MIS-H41-001	POST /api/misiones/f4140000-...-001/rechazar y lectura de mensajes en sgrai:socket-events	Emisión de mision:rechazada hacia encargado, sala:encargados, supervisor y cuadrilla:{id} junto a incidente:actualizado y cuadrilla:actualizada	Capturados en Redis los 4 mensajes mision:rechazada, 3 incidente:actualizado y 4 cuadrilla:actualizada (incluyendo sala:encargados)	APROBADO	24/11/2026 01:38	25/11/2026 14:20	feat(socket): agregar evento mision:rechazada en socket.io y redis pub/sub (HU-41)
CP-H41-API-06	Resiliencia de respuesta 200 OK ante falla del broker Redis/Socket.io tras confirmar la transacción en BD	Robustez / Tolerancia a Fallos	Servicio / Unitaria	Media	Mock de notificarMisionRechazada lanzando excepción Error("Redis offline")	Ejecución de mision-rechazar.service.test.ts	La excepción en socket se registra en log sin revertir ni fallar la respuesta del servicio	rechazarMisionService retorna estado: "RECHAZADA" con 6/6 tests aprobados en mision-rechazar.service.test.ts	APROBADO	24/11/2026 01:39	25/11/2026 14:20	test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision
CP-H41-API-07	Cumplimiento Regla §3.3: bloqueo 400 Bad Request ante justificación ausente ({}), vacía (""), espacios ("    ") o < 5 caracteres ("abcd")	Validación / Límite	API / Schema	Crítica	Usuario autenticado con permiso misiones:terreno:ejecutar	POST /api/misiones/{id}/rechazar con {}, {"justificacion_rechazo":""}, {"justificacion_rechazo":"abcd"}, {"justificacion_rechazo":"    "}	HTTP 400 Bad Request indicando mínimo 5 caracteres en justificacion_rechazo y cero mutaciones en BD	Todas las variantes devuelven HTTP 400 Bad Request con mensaje "El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres."	APROBADO	24/11/2026 01:37	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-08	Validación de parámetro UUID inválido, sintaxis JSON malformada, cotas geográficas WGS84 y paridad GPS (400 Bad Request)	Validación / Contrato	API / Route / Zod	Media	Usuario autenticado con permiso misiones:terreno:ejecutar	id-invalido, body {malformed, {"justificacion_rechazo":"...","latitud":-95,"longitud":-73.24} y {"justificacion_rechazo":"...","latitud":-39.81422}	HTTP 400 Bad Request controlado sin excepciones 500 ni desbordamientos numéricos en PostgreSQL	Las 4 peticiones responden HTTP 400 Bad Request con detalles descriptivos por campo	APROBADO	24/11/2026 01:37	25/11/2026 14:20	fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)
CP-H41-API-09	Control de autenticación (401 Unauthorized): ausencia de credenciales, token JWT inválido y usuario con activo = false	Seguridad / Autenticación	API / Auth	Crítica	Petición sin credenciales, JWT manipulado e identidad inactiva (f4100000-...-004)	POST /api/misiones/{id}/rechazar sin headers, con Bearer token.invalido.123 y con usuario inactivo	HTTP 401 Unauthorized impidiendo el acceso en los tres escenarios	Los tres escenarios responden HTTP 401 Unauthorized con mensajes diferenciados	APROBADO	24/11/2026 01:37	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-10	Control de acceso RBAC (403 Forbidden): denegación a roles sin permisos de rechazo en terreno (BRIGADISTA, ENCARGADO) y a delegado de otra cuadrilla	Seguridad / RBAC	API / Repositorio	Crítica	Usuarios BRIGADISTA, ENCARGADO y delegado2.h41qa@valdivia.cl (asignado a Cuadrilla Beta)	POST /api/misiones/f4140000-...-001/rechazar (Cuadrilla Alfa) con cada perfil	HTTP 403 Forbidden por ausencia de permisos requeridos y 403 Forbidden por pertenencia horizontal a otra cuadrilla	BRIGADISTA y ENCARGADO reciben 403 Forbidden por permisos y delegado2 recibe "No está autorizado para rechazar una misión asignada a otra cuadrilla operativa."	APROBADO	24/11/2026 01:37	25/11/2026 14:20	feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41)
CP-H41-API-11	Manejo de misión inexistente en base de datos (404 Not Found)	Funcional / Negativa	API / Repositorio	Alta	UUID inexistente en tabla mision y delegado autenticado	POST /api/misiones/99999999-0000-4000-8000-000000000999/rechazar con justificación válida	HTTP 404 Not Found con mensaje "No se encontró ninguna misión con el identificador proporcionado."	HTTP 404 Not Found retornado con el mensaje esperado	APROBADO	24/11/2026 01:37	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-12	Bloqueo 409 Conflict ante misión ya RECHAZADA, misión en estado EN_CURSO o misión sin unidad operativa compatible asignada	Regla de Negocio / Idempotencia	API / Repositorio	Crítica	Misiones en estado RECHAZADA, EN_CURSO (MIS-H41-004) y sin unidad (MIS-H41-009)	POST /rechazar sobre cada una con usuario autorizado / ADMIN	HTTP 409 Conflict impidiendo transiciones ilícitas o doble rechazo	Los tres casos devuelven HTTP 409 Conflict con sus mensajes específicos de conflicto	APROBADO	24/11/2026 01:37	25/11/2026 14:20	merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y unificar rechazo de mision (H41/H69)
CP-H41-API-13	Control de concurrencia ante carrera simultánea (Promise.all) mediante bloqueo pesimista FOR UPDATE OF mision	Concurrencia / ACID	API / PostgreSQL	Crítica	Misión MIS-H41-006 en estado DESPACHADA asignada a Cuadrilla Beta	2 peticiones simultáneas POST /api/misiones/f4140000-...-006/rechazar con Promise.all	Exactamente una respuesta 200 OK, una respuesta 409 Conflict y 1 solo registro 'RECHAZADA' en mision_hito	Confirmado en Re-Test en vivo: una petición 200 OK, una 409 Conflict ("La misión ya ha sido rechazada previamente.") y hitos_rechazo = 1	APROBADO	24/11/2026 01:38	25/11/2026 14:20	feat(misiones): implementar esquemas, transaccion atomica y endpoint POST /api/misiones/[id]/rechazar (HU-41)
CP-H41-API-14	Protección de cuadrilla ante otraMisionActiva (EN_MISION) y ante baja lógica (activo = false / eliminado_en IS NOT NULL)	Regla de Negocio / Integridad	Repositorio / BD	Alta	Cuadrilla Beta con otra misión activa y Cuadrilla Baja desactivada en NO_DISPONIBLE	POST /rechazar sobre MIS-H41-008 y MIS-H41-005	Cuadrilla Beta permanece en EN_MISION y Cuadrilla Baja permanece en NO_DISPONIBLE sin reactivarse	Verificado en PostgreSQL y respuesta JSON: Cuadrilla Beta queda EN_MISION y Cuadrilla Baja permanece NO_DISPONIBLE	APROBADO	24/11/2026 01:38	25/11/2026 14:20	fix(misiones): corregir validacion, liberacion de dotacion y eventos en rechazo de mision (BUG-H41-API-02..05)
CP-H41-API-15	Ejecución idempotente de migración 057_permiso_misiones_terreno_ejecutar.ts asignando misiones:terreno:ejecutar a ADMIN y DELEGADO_CUADRILLA	Base de Datos / Migraciones	Migración / DDL	Alta	PostgreSQL 16 operativo y migración 057_permiso_misiones_terreno_ejecutar.ts	Verificación en permiso/rol_permiso y suite 057_permiso_misiones_terreno_ejecutar.test.ts	Permiso misiones:terreno:ejecutar asignado exclusivamente a ADMIN y DELEGADO_CUADRILLA coexistiendo con misiones:terreno:verificar	Verificado en rol_permiso: misiones:terreno:ejecutar (ADMIN, DELEGADO_CUADRILLA) y misiones:terreno:verificar (ADMIN, PATRULLA_VERIFICADORA), 2/2 tests pass	APROBADO	24/11/2026 01:35	25/11/2026 14:17	feat(db): agregar migracion 057 y permiso misiones:terreno:ejecutar (HU-41)
CP-H41-API-16	Exposición del endpoint POST /api/misiones/{id}/rechazar unificado en GET /openapi.json y documentación funcional en docs/api/misiones.md	Contrato API / Docs	OpenAPI / Docs	Alta	Servidor en ejecución y módulo src/lib/openapi/index.ts	curl -s http://localhost:3001/openapi.json y revisión de docs/api/misiones.md (Secciones 3.9, 4 y 5)	Ruta /api/misiones/{id}/rechazar registrada con BearerAuth, maxLength: 1000, cuadrilla/patrulla y docs completas	Endpoint unificado (HU-41 / HU-69) y esquemas RechazarMisionBody / RechazarMisionResponse expuestos en OpenAPI v0.12.0 y validados en openapi.json/route.test.ts	APROBADO	24/11/2026 01:36	25/11/2026 14:17	test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision
CP-H41-API-17	Ejecución limpia de suites Vitest, análisis estático ESLint, chequeo TypeScript (tsc --noEmit) y compilación de producción (npm run build)	Automatización / Build	CI / Unit / Build	Alta	Rama feature/h41-cuadrilla-rechazar-asignacion sincronizada con develop	npm test -- -t "HU-41", npm test, npx next typegen && npx tsc --noEmit, npx eslint, npm run build	100% de tests verdes y 0 errores de compilación, tipos o linter	HU-41: 58/58 pass (67/67 directos); Global: 1040/1040 pass (95/95 archivos); tsc, eslint y next build con 0 errores	APROBADO	24/11/2026 01:39	25/11/2026 14:15	test(misiones): agregar pruebas de regresion y actualizar docs OpenAPI para rechazo de mision
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test Final)

### 5.1 Verificación de Integración Gitflow, Tipos, Linter, Compilación y Suites Vitest

#### 5.1.1 Sincronización con `develop` (`BUG-H41-API-01`)
```bash
git rev-list --count HEAD..develop
git rev-list --count develop..HEAD
```
**Resultado observado:**
- Commits pendientes en `develop`: **`0`**
- Commits por delante de `develop`: **`9`**

#### 5.1.2 Suites Vitest, Chequeo de Tipos, ESLint y Build de Producción (`CP-H41-API-17` y `BUG-H41-API-05`)
```bash
npm test -- -t "HU-41"
npx vitest run \
  src/modules/misiones/__tests__/mision-rechazar.schema.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.service.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.repository.test.ts \
  src/app/api/misiones/\[id\]/rechazar/__tests__/route.test.ts \
  src/lib/db/migrations/__tests__/057_permiso_misiones_terreno_ejecutar.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
npm test
npx next typegen && npx tsc --noEmit
npx eslint
npm run build
```
**Resultados observados:**
```text
# npm test -- -t "HU-41"
Test Files  5 passed | 90 skipped (95)
     Tests  58 passed | 982 skipped (1040)
  Duration  7.90s

# Ejecución directa de los 6 archivos (incluyendo OpenAPI)
Test Files  6 passed (6)
     Tests  67 passed (67)
  Duration  1.78s

# Suite global (npm test)
Test Files  95 passed (95)
     Tests  1040 passed (1040)
  Duration  8.67s

# Verificaciones estáticas y build
npx next typegen && npx tsc --noEmit  -> exit code 0 (0 errores)
npx eslint                            -> exit code 0 (0 errores)
npm run build                         -> Next.js 16.3.4 Turbopack compilado sin errores (28/28 páginas estáticas)
```

---

### 5.2 Ejecución en Vivo vía HTTP (`cURL`), Base de Datos PostgreSQL 16 y Redis Pub/Sub

> **Precondición de prueba:** Servidor iniciado en modo producción (`npm run start` -> `NODE_ENV=production` en `http://localhost:3001`), conectado a PostgreSQL 16 (`localhost:5001`) y Redis 7 (`localhost:6001`). Tokens JWT emitidos vía `POST /api/seguridad/login` sobre un fixture temporal aislado (`f41*`), eliminado completamente al finalizar la sesión (`0` registros residuales verificados en BD).

#### Caso 1: Endurecimiento `x-user-id` en Producción (`401 Unauthorized` — `BUG-H41-API-05`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "x-user-id: f4100000-0000-4000-8000-000000000001" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 2: Validación de Cuerpo Vacío, No-Objeto, Límite 1000 Caracteres y Paridad GPS (`400 Bad Request` — `BUG-H41-API-04` y `CP-H41-API-07/08`)
```bash
# 2a. Cuerpo vacío con Content-Type application/json
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d ''

# 2b. Arreglo JSON no-objeto
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '[]'

# 2c. Justificación de 1001 caracteres (> maxLength 1000)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"<cadena de 1001 caracteres>"}'

# 2d. Paridad GPS (latitud sin longitud)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave","latitud":-39.81422}'
```
**Respuestas HTTP/JSON obtenidas:**
```http
HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"justificacion_rechazo","mensaje":"El cuerpo de la solicitud es obligatorio y debe contener justificacion_rechazo (mínimo 5 caracteres)."}]}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"justificacion_rechazo","mensaje":"El cuerpo de la solicitud es obligatorio y debe contener justificacion_rechazo (mínimo 5 caracteres)."}]}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"justificacion_rechazo","mensaje":"El motivo de rechazo (justificacion_rechazo) no puede exceder los 1000 caracteres."}]}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"longitud","mensaje":"Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS."}]}
```

#### Caso 3: Despacho Polimórfico HU-41 / HU-69 y Control RBAC Cruzado (`BUG-H41-API-01`)
```bash
# 3a. ENCARGADO sin permisos de rechazo en terreno (403)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 3b. PATRULLA_VERIFICADORA sobre misión de cuadrilla (403 cruzado)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_PATRULLA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 3c. DELEGADO_CUADRILLA sobre misión VERIFICACION de patrulla (403 cruzado)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000007/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Falla mecánica grave"}'

# 3d. Regresión HU-69: PATRULLA_VERIFICADORA rechaza su propia misión VERIFICACION (200 OK)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000007/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_PATRULLA>" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en camioneta de patrulla verificadora","latitud":-39.818,"longitud":-73.249}'
```
**Respuestas HTTP/JSON obtenidas:**
```http
HTTP/1.1 403 Forbidden
{"message":"No cuenta con ninguno de los permisos requeridos: misiones:terreno:ejecutar, misiones:terreno:verificar"}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido para rechazar misiones de cuadrilla: misiones:terreno:ejecutar"}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido para rechazar misiones de patrulla: misiones:terreno:verificar"}

HTTP/1.1 200 OK
{"message":"Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.","data":{"mision":{"id":"f4140000-0000-4000-8000-000000000007","codigo":"MIS-H41-PAT-01","tipoMision":"VERIFICACION","estado":"RECHAZADA"},"patrulla":{"id":"f4125000-0000-4000-8000-000000000001","nombre":"Patrulla QA H41","estado":"DISPONIBLE"},"incidente":{"id":"f4130000-0000-4000-8000-000000000005","codigo":"INC-H41-005","estado":"REPORTADO"},"hito":{"hito":"RECHAZADA","latitud":-39.818,"longitud":-73.249}}}
```

#### Caso 4: Rechazo de Cuadrilla con Dotación Compartida y Salas Redis (`BUG-H41-API-02`, `BUG-H41-API-05` y `CP-H41-API-01/02/05`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000001/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_INTEGRANTE_ALFA>" \
  -d '{"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida desde base.","latitud":-39.81422,"longitud":-73.24589}'
```
**Verificación en PostgreSQL (`usuario.estado_operativo` tras el rechazo de `Cuadrilla Alfa`):**
```text
brigadista.h41qa@valdivia.cl     | disponible
delegado1.h41qa@valdivia.cl      | en_mision   <-- Preservado (Cuadrilla Gamma continúa EN_MISION)
integrante.del.h41qa@valdivia.cl | disponible
```
**Eventos Capturados en Redis Pub/Sub (`SUBSCRIBE sgrai:socket-events`):**
```text
- room: "encargado"                                      | event: "mision:rechazada"
- room: "sala:encargados"                                | event: "mision:rechazada"
- room: "supervisor"                                     | event: "mision:rechazada"
- room: "cuadrilla:f4120000-0000-4000-8000-000000000001" | event: "mision:rechazada"
- room: "sala:encargados"                                | event: "incidente:actualizado"  | estado: "VERIFICANDO"
- room: "encargado"                                      | event: "incidente:actualizado"  | estado: "VERIFICANDO"
- room: "mapa"                                           | event: "incidente:actualizado"  | estado: "VERIFICANDO"
- room: "operaciones"                                    | event: "cuadrilla:actualizada"  | estado: "DISPONIBLE"
- room: "encargado"                                      | event: "cuadrilla:actualizada"  | estado: "DISPONIBLE"
- room: "sala:encargados"                                | event: "cuadrilla:actualizada"  | estado: "DISPONIBLE"
- room: "supervisor"                                     | event: "cuadrilla:actualizada"  | estado: "DISPONIBLE"
```

#### Caso 5: Invariantes ICS del Incidente, Mensajes Dinámicos y Concurrencia (`BUG-H41-API-03`, `CP-H41-API-13/14`)
```bash
# 5a. Incidente en estado terminal RESUELTO (409 Conflict)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000003/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Intento sobre incidente ya resuelto"}'

# 5b. Incidente con otra misión activa EN_CURSO (200 OK, incidente mantiene EN_ATENCION, 0 eventos incidente:actualizado)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000008/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_BETA>" \
  -d '{"justificacion_rechazo":"Cuadrilla Beta bloqueada por corte vial"}'

# 5c. Cuadrilla dada de baja (NO_DISPONIBLE) sin incidente asociado (200 OK con mensaje fiel)
curl -s -i -X POST "http://localhost:3001/api/misiones/f4140000-0000-4000-8000-000000000005/rechazar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_JWT_DELEGADO_ALFA>" \
  -d '{"justificacion_rechazo":"Unidad fuera de servicio por mantención mayor"}'
```
**Respuestas HTTP/JSON y SQL obtenidas:**
```http
HTTP/1.1 409 Conflict
{"message":"No es posible rechazar la misión porque el incidente asociado ya se encuentra en estado terminal 'RESUELTO'."}

HTTP/1.1 200 OK
{"message":"Misión rechazada exitosamente. La cuadrilla permanece en estado EN_MISION y el incidente mantiene su estado EN_ATENCION al contar con otra misión activa.","data":{"incidente":{"codigo":"INC-H41-004","estado":"EN_ATENCION"}}}
# SQL: INC-H41-004|EN_ATENCION  |  Redis: 0 eventos incidente:actualizado

HTTP/1.1 200 OK
{"message":"Misión rechazada exitosamente. La cuadrilla permanece en estado NO_DISPONIBLE.","data":{"cuadrilla":{"estado":"NO_DISPONIBLE"},"incidente":null}}
# Redis: 0 eventos incidente:actualizado

# Carrera concurrente Promise.all sobre MIS-H41-006:
#   Petición 1 -> HTTP 200 OK ("La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a REPORTADO para su reasignación.")
#   Petición 2 -> HTTP 409 Conflict ("La misión ya ha sido rechazada previamente.")
#   SQL mision_hito COUNT(*) = 1
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La pantalla de solicitud de misión en la PWA debe proveer una opción visible 'Rechazar Misión'. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz gráfica en el repositorio `sgrai-pwa`. |
| **CA-2:** Al presionar 'Rechazar Misión', el sistema debe desplegar un modal o campo de texto obligatorio para ingresar la justificación del rechazo. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz gráfica en el repositorio `sgrai-pwa`. El backend provee el contrato OpenAPI en `GET /openapi.json`. |
| **CA-3:** Cumplimiento estricto de la regla de negocio §3.3: la API debe validar que `justificacion_rechazo` contenga al menos 5 caracteres; de lo contrario, debe rechazar la solicitud con `400 Bad Request`. | `CP-H41-API-03`, `CP-H41-API-07`, `CP-H41-API-08`, `BUG-H41-API-04` | 🟢 **CUMPLIDO** | Rechaza cadenas `< 5` o `> 1000` caracteres tras `.trim()`, cuerpo vacío/no-objeto con error en español, y mantiene paridad exacta GPS entre validación runtime y OpenAPI. |
| **CA-4:** Al confirmar el rechazo motivado, la API debe ejecutar una transacción atómica: (1) Actualizar `mision.estado = 'RECHAZADA'`, (2) Almacenar la `justificacion_rechazo` en la tabla `mision`, (3) Devolver la cuadrilla a estado `DISPONIBLE`, y (4) Registrar el hito de rechazo con la justificación en `mision_hito`. | `CP-H41-API-01`, `CP-H41-API-04`, `CP-H41-API-12`, `CP-H41-API-13`, `CP-H41-API-14`, `BUG-H41-API-02`, `BUG-H41-API-03` | 🟢 **CUMPLIDO** | Transacción ACID con `.forUpdate("mision")`, preservación de `usuario.estado_operativo` ante dotación compartida (`NOT EXISTS`), respeto a baja lógica/`otraMisionActiva` y mensajes de respuesta fieles al estado final. |
| **CA-5:** El incidente debe retornar a estado `REPORTADO` o `VERIFICANDO` para permitir su reasignación en el Centro de Mando. | `CP-H41-API-01`, `CP-H41-API-03`, `BUG-H41-API-03` | 🟢 **CUMPLIDO** | Retorna a `VERIFICANDO` (si existe verificación `COMPLETADA`) o `REPORTADO`, bloquea incidentes terminales (`RESUELTO`/`NO_ABORDABLE`) con `409 Conflict` y conserva el estado si existe otra misión activa. |
| **CA-6:** El sistema debe emitir una alerta prioritaria vía WebSocket (`mision:rechazada`) hacia la sala `encargado` del Centro de Mando. | `CP-H41-API-05`, `CP-H41-API-06`, `BUG-H41-API-05` | 🟢 **CUMPLIDO** | `notificarMisionRechazada` emite hacia `encargado`, `sala:encargados`, `supervisor` y `cuadrilla:{id}`/`patrulla:{id}`, y `emitirCuadrillaActualizada` incluye `sala:encargados`. |
| **CA-7:** El endpoint `POST /api/misiones/{id}/rechazar` debe requerir el permiso RBAC `misiones:terreno:ejecutar`. | `CP-H41-API-02`, `CP-H41-API-09`, `CP-H41-API-10`, `CP-H41-API-15`, `BUG-H41-API-01`, `BUG-H41-API-05` | 🟢 **CUMPLIDO** | Exige `misiones:terreno:ejecutar` (`057_`) para cuadrillas coexistiendo polimórficamente con `misiones:terreno:verificar` (HU-69) para patrullas, con bloqueo estricto de `x-user-id` en producción. |
