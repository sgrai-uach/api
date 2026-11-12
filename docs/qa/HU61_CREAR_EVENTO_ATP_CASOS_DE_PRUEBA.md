# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-61 — Crear Evento de Alerta Temprana Preventiva (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP (`sgrai-api` — `POST /api/eventos-atp`).  
> **Historia de Usuario:** HU-61 — *"Como Administrador Quiero crear un Evento de Alerta Temprana Preventiva (ATP) en el sistema para registrar y anticipar amenazas climáticas o de emergencia comunal. Para establecer un marco oficial y categorizado que permita agrupar y coordinar incidentes, eventos de prevención, operativos de recuperación y casos de asistencia social bajo un mismo fenómeno."*  
> **Desarrollador Asignado:** Jonagu1  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H61-crear-evento-atp`  
> **Commits Evaluados en la Rama:**  
> * `feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)`  
> * `test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)`  
> * `docs(eventos-atp): documentar endpoint y QA de creacion de eventos ATP (H61)`  
> * `docs(eventos-atp): corregir numeracion de la seccion H61`  
> * `fix(db): renumerar migracion de eventos ATP a 072`  
>  
> **Entorno de Pruebas:** Local (Docker PostgreSQL 16 + PostGIS + Redis 7 / Node.js / Servidor API en `http://localhost:3001`)  
> **Fecha de Auditoría Inicial:** 12/11/2026 13:37  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (7 DEFECTOS ABIERTOS)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Durante la auditoría forense de la rama `feature/H61-crear-evento-atp` para el repositorio `sgrai-api` (`POST /api/eventos-atp` y migración `072_evento_atp_base.ts`), se ejecutó la inspección integral del código fuente, las validaciones de esquema Zod, la lógica transaccional Kysely, el control de concurrencia en PostgreSQL 16, el control de acceso RBAC, la emisión de eventos en tiempo real vía Socket.io/Redis, el contrato OpenAPI 3.0 y las pruebas en vivo sobre el servidor local.

Si bien la suite unitaria automatizada con mocks aprueba en su totalidad (`29/29` pruebas del módulo y `765/765` en el repositorio) y ESLint no reporta errores, las pruebas funcionales, de concurrencia en PostgreSQL real, de borde de entrada y de seguridad en tiempo real revelaron **7 defectos reales abiertos** (`BUG-H61-API-01` a `BUG-H61-API-07`) que impiden aprobar la integración hacia `develop`.

| Métrica de Calidad | Evaluación Inicial (12/11/2026) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **27** | 7 Defectos Detectados (`BUG-H61-API-01` a `07`) + 20 Casos de Contrato, RBAC, Transacción, Migración y OpenAPI (`CP-H61-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Funcionalidad base con mocks, RBAC HTTP 401/403, desvinculación de `eventos_atp:crear` en puntos críticos y publicación OpenAPI |
| **Defectos Abiertos (Open)** | **7** | 1 Crítico, 3 Altos, 2 Medios y 1 Bajo |
| **Casos Bloqueados (Blocked)** | **0** | Entorno PostgreSQL 16, Redis 7 y API local operativos |
| **Tasa de Aprobación Global (% Pass)** | **74.1%** | Rechazado hasta subsanar defectos de correlativo, concurrencia, fechas, Socket.io y contrato |
| **Suite Automatizada del Módulo (Vitest)** | **29/29 tests pass** | 5 archivos (`route.test.ts`, `evento-atp.schema.test.ts`, `evento-atp.service.test.ts`, `evento-atp.repository.test.ts`, `072_evento_atp_base.test.ts`) |
| **Suite Completa de la API (Vitest)** | **64 archivos / 765 tests pass** | Incluye 43 tests de `punto-critico.test.ts` y contrato `/openapi.json` |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores** | 11 advertencias preexistentes fuera del alcance de H61 |
| **Chequeo de Tipos TypeScript (`npx tsc --noEmit`)** | **Con error de caché `.next`** | Error en `.next/types/validator.ts:202` por artefacto obsoleto de otra rama; `0` errores en archivos `src/` de H61 |
| **Migración Kysely `072_evento_atp_base.ts`** | **Reversible en PostgreSQL 16** | `up(trx)` y `down(trx)` ejecutados en transacción real; pendiente de aplicación persistente en entorno local |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H61-API-01`: Colisión Permanente del Correlativo Automático `ATP-AAAA-####` (`SQLSTATE 23505` / HTTP 500) tras Registrar Códigos Manuales con Prefijo `ATP-AAAA-`
* **Severidad:** **CRÍTICA** (Criterio de Aceptación 2 y Disponibilidad del Servicio).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 95-122)
* **Descripción Técnica del Defecto:**  
  `CrearEventoAtpInputSchema` permite códigos manuales alfanuméricos con guiones bajo el patrón `/^[A-Za-z0-9-]+$/`. Sin embargo, `generarSiguienteCodigoEventoAtp` busca el último código mediante:
  ```ts
  .where("codigo", "like", `${prefijo}%`)
  .orderBy("codigo", "desc")
  .limit(1)
  ```
  1. Si existe un evento automático previo (`ATP-2026-0001`) y luego se registra un código manual válido como `ATP-2026-MAYO`, el ordenamiento lexicográfico `ORDER BY codigo DESC` ubica `'M' > '0'` por delante, devolviendo `ATP-2026-MAYO`. Luego `Number.parseInt("MAYO", 10)` evalúa a `NaN`, haciendo retroceder `siguienteSecuencia` a `1` (`ATP-2026-0001`). Al insertar, PostgreSQL arroja `SQLSTATE 23505` (`evento_atp_codigo_key`), provocando **HTTP 500 Internal Server Error** en toda creación automática posterior del mismo año.
  2. El mismo fallo ocurre con sufijos numéricos de distinta longitud (por ejemplo `ATP-2026-99` frente a `ATP-2026-0100`, ya que lexicográficamente `'9' > '0'`, generando `ATP-2026-0100` ya existente).
* **Evidencia Empírica (PostgreSQL 16):**  
  Tras insertar `ATP-2026-0001` y `ATP-2026-MAYO`, la invocación real a `generarSiguienteCodigoEventoAtp(trx, 2026)` retornó `ATP-2026-0001` y la inserción falló con `PG_ERROR_CODE: 23505 DETAIL: Key (codigo)=(ATP-2026-0001) already exists. CONSTRAINT: evento_atp_codigo_key`.
* **Sugerencia de Corrección:**  
  Filtrar exclusivamente códigos estrictamente correlativos mediante expresión regular PostgreSQL (`codigo ~ ('^ATP-' || anio || '-[0-9]{4,}$')`) y obtener el máximo numérico real (`COALESCE(MAX(SUBSTRING(codigo FROM LENGTH(prefijo) + 1)::integer), 0) + 1`), verificando además colisión con `existeCodigoEventoAtp` en bucle dentro de la transacción.

---

### `BUG-H61-API-02`: Condición de Carrera (TOCTOU) en Unicidad de Código Manual y Ausencia de Captura de `SQLSTATE 23505` (HTTP 500 en lugar de 409 Conflict)
* **Severidad:** **ALTA** (Concurrencia y Contrato de Errores HTTP).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-atp.service.ts` (líneas 74-81 y 106-107)
  * `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 128-151)
* **Descripción Técnica del Defecto:**  
  1. `existeCodigoEventoAtp(codigoManual)` se ejecuta fuera de `db.transaction()`. Si dos administradores envían concurrentemente el mismo código manual, ambas peticiones superan la verificación previa y la segunda falla en `INSERT INTO evento_atp` con `SQLSTATE 23505`, cayendo al bloque `catch` genérico de `route.ts` que devuelve **HTTP 500 Internal Server Error** en vez de **HTTP 409 Conflict**.
  2. `insertarEventoAtpConDelegaciones` solo adquiere `pg_advisory_xact_lock` cuando `datos.codigo` es `undefined`. Una inserción manual con `codigo: "ATP-2026-0001"` no adquiere el bloqueo ni captura la violación de restricción única, compitiendo también con creaciones automáticas concurrentes.
* **Sugerencia de Corrección:**  
  Ejecutar la verificación de unicidad dentro de la transacción `trx` (o adquirir el advisory lock al registrar códigos con prefijo `ATP-AAAA-`) y capturar el código PostgreSQL `23505` (`evento_atp_codigo_key`) en repositorio/servicio para lanzar `ConflictError` (`HTTP 409`).

---

### `BUG-H61-API-03`: Validación Laxa de Fechas en `FechaHoraEventoAtpSchema` (`Date.parse`) Acepta Textos Arbitrarios y Fechas Calendario Inexistentes
* **Severidad:** **ALTA** (Criterio de Aceptación 4 e Integridad Temporal).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivo Afectado:** `src/modules/eventos-atp/evento-atp.schema.ts` (líneas 42-55 y 149-157).
* **Descripción Técnica del Defecto:**  
  `FechaHoraEventoAtpSchema` delega la validez del formato exclusivamente en `!Number.isNaN(Date.parse(valor))`. En Node.js (V8):
  1. Cadenas no ISO como `"abc 1"`, `"1"` o `"2026"` superan `Date.parse` (`"abc 1"` -> `2001-01-01T03:00:00.000Z`, `"2026"` -> `2026-01-01T00:00:00.000Z`).
  2. Fechas calendario inválidas como `"2026-02-30T10:00"` realizan *rollover* silencioso a `"2026-03-02"`, persistiendo una fecha distinta a la solicitada.
  3. Valores solo-fecha (`"2026-05-01"`) se interpretan en UTC mientras `datetime-local` sin zona (`"2026-05-01T00:00"`) se interpreta en hora local del servidor, alterando la comparación `fechaTermino >= fechaInicio`.
* **Evidencia Empírica (HTTP en vivo `POST /api/eventos-atp`):**  
  Al enviar `fechaInicio: "abc 1"` y `fechaTermino: "2026"` (y también `fechaInicio: "2026-02-30T10:00"`), el endpoint superó por completo la validación Zod y alcanzó la verificación de delegaciones en BD.
* **Sugerencia de Corrección:**  
  Exigir formato ISO-8601 estricto con fecha y hora (`YYYY-MM-DDTHH:mm[:ss[.sss]][Z|±HH:mm]`) mediante expresión regular y verificar que año, mes y día coincidan exactamente tras construir el objeto `Date` (sin *rollover*).

---

### `BUG-H61-API-04`: Emisión WebSocket `emitirEventoAtpCreado` Ejecuta Broadcast Global Indiscriminado (`ioInstance.emit`), Duplica Entregas e Inconsiste con Redis Pub/Sub
* **Severidad:** **ALTA** (Criterio de Aceptación 6 y Seguridad en Tiempo Real).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivo Afectado:** `src/lib/socket/index.ts` (líneas 356-391).
* **Descripción Técnica del Defecto:**  
  1. Cuando `ioInstance` está activo, la línea 372 ejecuta `(ioInstance as any).emit("evento_atp:creado", payload)`, emitiendo el evento a **todos** los clientes conectados al servidor Socket.io (incluyendo salas ajenas como `informante`, `call-center`, `patrulla:*` o `cuadrilla:*`), lo que incumple el CA-6 que restringe la difusión a `admin`, `encargado`, `supervisor` y `mapa`.
  2. Al iterar sala por sala (`for (const sala of salas) { ioInstance.to(sala).emit(...) }`) y sumar el broadcast global, un cliente presente en `admin` y `mapa` recibe entregas duplicadas/triplicadas del mismo evento.
  3. La rama de Redis Pub/Sub (líneas 376-390) solo publica en las 6 salas listadas sin broadcast global, generando comportamiento asimétrico según el proceso emisor.
* **Sugerencia de Corrección:**  
  Eliminar el broadcast global de la línea 372, utilizar `ioInstance.to(salas).emit("evento_atp:creado", payload)` en una sola invocación (Socket.io deduplica sockets pertenecientes a múltiples salas) y unificar las salas con las efectivamente suscritas por los clientes (`admin`, `administrador`, `encargado`, `sala:encargados`, `supervisor`, `mapa`).

---

### `BUG-H61-API-05`: El Campo Opcional `codigo` Enviado como Cadena Vacía (`""`) o `null` es Rechazado con HTTP 400 en Lugar de Autogenerar el Correlativo
* **Severidad:** **MEDIA** (Criterio de Aceptación 2 e Integración Frontend-API).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivo Afectado:** `src/modules/eventos-atp/evento-atp.schema.ts` (líneas 85-99).
* **Descripción Técnica del Defecto:**  
  Cuando un formulario web serializa el campo opcional `codigo` vacío (`"codigo": ""`, `"codigo": "   "` o `"codigo": null`), `CrearEventoAtpInputSchema` rechaza la petición con **HTTP 400 Bad Request** (`"El código debe tener al menos 3 caracteres"`, `"El código solo puede contener letras, números y guiones"` o `"Invalid input: expected string, received null"`), impidiendo que el backend genere automáticamente `ATP-AAAA-####`.
* **Sugerencia de Corrección:**  
  Normalizar mediante `z.preprocess((v) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v), ...)` antes de validar longitud y regex.

---

### `BUG-H61-API-06`: `verificarDelegacionesExisten` No Filtra Delegaciones Activas (`activo = true`) y Opera Fuera de la Transacción
* **Severidad:** **MEDIA** (Integridad Territorial y Consistencia Transaccional).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivo Afectado:** `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 52-70) y `src/modules/eventos-atp/evento-atp.service.ts` (línea 85).
* **Descripción Técnica del Defecto:**  
  A diferencia de `GET /api/catalogos` (`src/app/api/catalogos/route.ts:22`), que expone únicamente delegaciones con `activo = true`, `verificarDelegacionesExisten` consulta `delegacion` sin `.where("activo", "=", true)` y fuera de `db.transaction()`. Esto permite vincular un Evento ATP nuevo a una delegación desactivada.
* **Sugerencia de Corrección:**  
  Añadir `.where("activo", "=", true)` en `verificarDelegacionesExisten` y ejecutar la comprobación dentro de la transacción de `insertarEventoAtpConDelegaciones`.

---

### `BUG-H61-API-07`: Desalineación del Mensaje HTTP `403`, Diccionario de Datos Desactualizado y Cobertura Incompleta en Tests de OpenAPI
* **Severidad:** **BAJA** (Alineación Documental y Cobertura de Contrato).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 12/11/2026)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-atp.service.ts` (líneas 67-69)
  * `docs/api/eventos-atp.md` (línea 1081)
  * `docs/database/README.md` (líneas 104 y 576-580)
  * `src/app/openapi.json/__tests__/route.test.ts` (líneas 31-40)
* **Descripción Técnica del Defecto:**  
  1. `crearEventoAtpService` invoca `seguridadService.validarAccesoAdministrador(usuarioId, [PERMISO_CREAR_EVENTO_ATP])` sin `mensajeError` específico; ante un usuario sin permiso (verificado con `callcenter@valdivia.cl`), el endpoint devuelve `"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."`, mientras `docs/api/eventos-atp.md:1081` documenta `"Acceso denegado. Se requiere el perfil de Administrador o el permiso eventos_atp:crear."`.
  2. `docs/database/README.md` mantiene a `evento_atp` en la sección "Hoja de Ruta (Roadmap de Persistencia)" con columnas proyectadas obsoletas (`tipo_evento`, `FINALIZADO`) y omite `evento_atp_delegacion` y las FK `evento_atp_id` creadas por la migración `072`.
  3. `src/app/openapi.json/__tests__/route.test.ts` no incluye aserciones automatizadas para `POST /api/eventos-atp` ni sus esquemas asociados.
* **Sugerencia de Corrección:**  
  Usar `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_CREAR_EVENTO_ATP], "Acceso denegado. Se requiere el perfil de Administrador o el permiso eventos_atp:crear.")`, actualizar `docs/database/README.md` con las tablas físicas de la migración `072` y agregar aserciones en `src/app/openapi.json/__tests__/route.test.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H61-API-01` | Colisión permanente de correlativo automático `ATP-AAAA-####` tras código manual con prefijo `ATP-AAAA-` no numérico o de distinta longitud | Concurrencia / Correlativo | Repository / PostgreSQL | Crítica | Tabla `evento_atp` con `ATP-2026-0001` y código manual `ATP-2026-MAYO` | `generarSiguienteCodigoEventoAtp(trx, 2026)` seguido de `INSERT` en `evento_atp` | Debe generar `ATP-2026-0002` ignorando sufijos no numéricos y comparar numéricamente | Retorna `ATP-2026-0001` (`NaN -> 1`) y falla con `SQLSTATE 23505` (`evento_atp_codigo_key`) generando HTTP 500 | ABIERTO | 12/11/2026 13:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H61-API-02` | Condición de carrera TOCTOU en código manual duplicado y ausencia de manejo de `SQLSTATE 23505` | Concurrencia / Integridad | Service / Repository | Alta | Dos solicitudes concurrentes con el mismo `codigo` manual o colisión manual vs automático | `codigo: "ATP-2026-0001"` en dos `POST /api/eventos-atp` paralelos | Una petición retorna `201 Created` y la segunda `409 Conflict` | `existeCodigoEventoAtp` corre fuera de `trx` y no captura `23505`; retorna HTTP 500 | ABIERTO | 12/11/2026 13:34 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H61-API-03` | Validación laxa de fechas en `FechaHoraEventoAtpSchema` acepta textos arbitrarios y fechas calendario inexistentes | Validación / Borde | Schema / API Live | Alta | Endpoint `POST /api/eventos-atp` activo y token de Administrador válido | `fechaInicio: "abc 1", fechaTermino: "2026"` y `fechaInicio: "2026-02-30T10:00"` | HTTP 400 Bad Request rechazando formato no ISO-8601 y fechas calendario inválidas | Supera validación Zod (`safeParse.success === true`) y alcanza capa de repositorio en vivo | ABIERTO | 12/11/2026 13:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H61-API-04` | Broadcast global indiscriminado (`ioInstance.emit`) y duplicación de entregas en `emitirEventoAtpCreado` | Seguridad / Tiempo Real | Socket.io / Service | Alta | Servidor Socket.io (`ioInstance`) inicializado con clientes en múltiples salas | `emitirEventoAtpCreado({ id: "test" })` con mock de `ioInstance` | Emitir `evento_atp:creado` exclusivamente a salas autorizadas sin broadcast global ni duplicación | Invoca `(ioInstance as any).emit("evento_atp:creado")` globalmente además de 6 emisiones por sala | ABIERTO | 12/11/2026 13:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H61-API-05` | Rechazo HTTP 400 cuando el campo opcional `codigo` se envía como cadena vacía `""` o `null` | Validación / Borde | Schema / API Live | Media | Token de Administrador válido y formulario enviando `codigo` vacío | `POST /api/eventos-atp` con `codigo: ""` o `codigo: null` | Normalizar vacío/`null` a `undefined` para autogenerar correlativo `ATP-AAAA-####` | Retorna HTTP 400 (`El código debe tener al menos 3 caracteres` / `expected string, received null`) | ABIERTO | 12/11/2026 13:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H61-API-06` | `verificarDelegacionesExisten` permite vincular delegaciones inactivas (`activo = false`) fuera de transacción | Integridad Territorial | Repository / Service | Media | Registro en tabla `delegacion` con `activo = false` | `delegacionIds: ["<uuid_delegacion_inactiva>"]` | Rechazar con `400 Bad Request` delegaciones inactivas y validar dentro de `trx` | Consulta `delegacion` sin `.where("activo", "=", true)` y fuera de `db.transaction()` | ABIERTO | 12/11/2026 13:34 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H61-API-07` | Desalineación de mensaje HTTP `403`, diccionario `docs/database/README.md` desactualizado y falta de aserciones OpenAPI en test | Contrato / Documentación | Service / Docs / Test | Baja | Usuario `callcenter@valdivia.cl` sin permiso y revisión de `docs/database/README.md` y `route.test.ts` | `POST /api/eventos-atp` con Bearer de Call Center e inspección de archivos | Mensaje 403 alineado con `eventos_atp:crear`, `README.md` actualizado y ruta cubierta en test OpenAPI | Devuelve mensaje de `gestión de roles`; `README.md` conserva `evento_atp` en Hoja de Ruta y falta aserción en `openapi.json/__tests__/route.test.ts` | ABIERTO | 12/11/2026 13:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H61-API-01` | Creación exitosa de Evento ATP con código automático `ATP-AAAA-####`, estado `ACTIVO` y una delegación | Funcional | Route / Service | Crítica | Usuario Administrador autenticado | `POST /api/eventos-atp` con payload válido y `delegacionIds: [DEL_NORTE]` | HTTP 201 Created con `estado: "ACTIVO"`, `codigo: "ATP-2026-0001"` y 1 delegación | Verificado en suite Vitest (`route.test.ts` y `evento-atp.service.test.ts`) | APROBADO | 12/11/2026 13:37 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-02` | Normalización a mayúsculas de código manual válido en creación de Evento ATP | Lógica de Negocio | Service | Alta | Código manual no duplicado | `codigo: "atp-2026-0099"` | El repositorio recibe `codigo: "ATP-2026-0099"` en mayúsculas | Verificado en `evento-atp.service.test.ts` | APROBADO | 12/11/2026 13:37 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-03` | Creación con alcance comunal centralizado sin delegaciones (`delegacionIds: []` u omitido) | Funcional | Schema / Service / Repo | Alta | Payload válido sin delegaciones | `delegacionIds: []` y `delegacionIds: undefined` | HTTP 201 sin inserciones en tabla puente `evento_atp_delegacion` | Verificado en `evento-atp.schema.test.ts`, `service.test.ts` y `repository.test.ts` | APROBADO | 12/11/2026 13:37 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-04` | Inserción transaccional atómica en `evento_atp` y `evento_atp_delegacion` | Persistencia / Transacción | Repository | Crítica | Transacción Kysely activa | `insertarEventoAtpConDelegaciones` con delegación Norte | Ambas tablas se insertan dentro de una sola llamada a `db.transaction()` | Verificado en `evento-atp.repository.test.ts` | APROBADO | 12/11/2026 13:37 | — | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-05` | Reversión atómica de la transacción ante fallo en inserción de tabla puente `evento_atp_delegacion` | Persistencia / Rollback | Repository | Crítica | Fallo simulado al insertar en `evento_atp_delegacion` | `crearTransaccionFalsa({ fallarEnPuente: true })` | La excepción se propaga y la transacción revierte la inserción de `evento_atp` | Verificado en `evento-atp.repository.test.ts` | APROBADO | 12/11/2026 13:37 | — | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-06` | Rechazo HTTP 409 Conflict cuando el código manual ya existe antes de iniciar inserción | Validación / Negocio | Service | Crítica | Código manual ya existente en BD | `codigo: "ATP-2026-0001"` existente (`existeCodigoEventoAtp = true`) | Lanza `ConflictError` (HTTP 409) sin invocar `insertarEventoAtpConDelegaciones` | Verificado en `evento-atp.service.test.ts` | APROBADO | 12/11/2026 13:37 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-07` | Rechazo HTTP 400 Bad Request ante `fechaTermino` anterior a `fechaInicio` | Validación / Regla CA-4 | Schema / API Live | Crítica | Token de Administrador válido | `fechaInicio: "2026-05-03T18:00"`, `fechaTermino: "2026-05-01T10:00"` | HTTP 400 con error en campo `fechaTermino` | HTTP 400 confirmado en vivo vía `curl` y en `route.test.ts` / `schema.test.ts` | APROBADO | 12/11/2026 13:36 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-08` | Aceptación válida de `fechaTermino` igual a `fechaInicio` | Validación / Límite CA-4 | Schema | Media | Esquema Zod activo | `fechaInicio: "2026-05-01T10:00"`, `fechaTermino: "2026-05-01T10:00"` | Validación exitosa (`success: true`) | Verificado en `evento-atp.schema.test.ts` | APROBADO | 12/11/2026 13:37 | — | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-09` | Rechazo de `nombre` menor a 3 caracteres, `tipoAmenaza` o `nivelAlerta` fuera de catálogo y `codigo` con símbolos inválidos | Validación / Zod | Schema | Alta | Esquema Zod activo | `nombre: "AB"`, `tipoAmenaza: "VOLCANICA"`, `nivelAlerta: "NARANJA"`, `codigo: "ATP 2026/0001"` | Validación rechazada identificando cada campo inválido | Verificado en `evento-atp.schema.test.ts` | APROBADO | 12/11/2026 13:37 | — | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-10` | Rechazo de identificadores repetidos en `delegacionIds` | Validación / Zod | Schema | Media | Esquema Zod activo | `delegacionIds: ["30000000-...-0001", "30000000-...-0001"]` | Error de validación en `delegacionIds` (`No se puede repetir una misma delegación`) | Verificado en `evento-atp.schema.test.ts` | APROBADO | 12/11/2026 13:37 | — | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-11` | Rechazo HTTP 400 Bad Request ante delegación inexistente en PostgreSQL | Validación / Integridad | Service / API Live | Alta | Token de Administrador válido y BD activa | `delegacionIds: ["30000000-0000-4000-8000-999999999999"]` | HTTP 400 con mensaje `Las siguientes delegaciones no existen en el sistema: 30000000-0000-4000-8000-999999999999.` | HTTP 400 exacto observado en vivo vía `curl` y en `service.test.ts` | APROBADO | 12/11/2026 13:36 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-12` | Rechazo HTTP 400 Bad Request ante cuerpo JSON malformado | Validación / HTTP | Route Handler / API Live | Media | Token de Administrador válido | Body `{no-es-json` | HTTP 400 con `{"message":"El cuerpo de la solicitud no es un JSON válido."}` | HTTP 400 exacto observado en vivo vía `curl` y en `route.test.ts` | APROBADO | 12/11/2026 13:36 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-13` | Rechazo HTTP 401 Unauthorized sin cabecera Bearer o con token inválido/expirado | Seguridad / Auth | Route Handler / API Live | Crítica | Endpoint `POST /api/eventos-atp` expuesto | Sin `Authorization` y con `Authorization: Bearer token.invalido.123` | HTTP 401 Unauthorized impidiendo ejecución del servicio | HTTP 401 exacto observado en vivo vía `curl` y en `route.test.ts` | APROBADO | 12/11/2026 13:36 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-14` | Rechazo HTTP 403 Forbidden para usuario autenticado sin rol Administrador ni permiso `eventos_atp:crear` | Seguridad / RBAC | Route / Service / API Live | Crítica | Usuario `callcenter@valdivia.cl` autenticado sin permiso `eventos_atp:crear` | `POST /api/eventos-atp` con JWT Bearer de Call Center y payload válido | HTTP 403 Forbidden denegando la creación del Evento ATP | HTTP 403 observado en vivo vía `curl` y en `route.test.ts` / `service.test.ts` | APROBADO | 12/11/2026 13:36 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-15` | Desvinculación formal del permiso `eventos_atp:crear` como fallback en Puntos Críticos (`punto-critico.service.ts`) | Seguridad / Regresión CA-7 | Service / Unit | Alta | Código de `punto-critico.service.ts` y suite `punto-critico.test.ts` | Inspección de `crearPuntoCritico` y ejecución de `punto-critico.test.ts` | `crearPuntoCritico` exige únicamente `PERMISO_CREAR_PUNTO_CRITICO` (`puntos_criticos:crear`) y los 43 tests pasan | `43/43` tests aprobados en `punto-critico.test.ts` y fallback eliminado en `punto-critico.service.ts:164` | APROBADO | 12/11/2026 13:37 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-16` | Ejecución DDL reversible (`up` y `down`) de la migración `072_evento_atp_base.ts` en PostgreSQL 16 real | Integridad BD | Migración / PostgreSQL | Crítica | PostgreSQL 16 con migraciones previas (`001`..`035`) | Ejecución transaccional de `up(trx)` y `down(trx)` en `072_evento_atp_base.ts` | Crea `evento_atp`, `evento_atp_delegacion`, índices, FKs `evento_atp_id` y revierte limpiamente en `down` | `UP_OK`, `DOWN_OK` y `TX_ROLLED_BACK_CLEANLY` en PostgreSQL 16 y `5/5` tests en `072_evento_atp_base.test.ts` | APROBADO | 12/11/2026 13:35 | — | fix(db): renumerar migracion de eventos ATP a 072 |
| `CP-H61-API-17` | Asignación idempotente del permiso `eventos_atp:crear` al rol Administrador en migración `072` | Seguridad / Configuración | Migración Kysely | Alta | Tabla `permiso` con `eventos_atp:crear` y rol Administrador | Ejecución de `up(db)` de `072_evento_atp_base.ts` | Actualiza descripción/módulo y ejecuta `INSERT INTO rol_permiso ... ON CONFLICT DO NOTHING` | Verificado en SQL ejecutado en PostgreSQL 16 y en `072_evento_atp_base.test.ts` | APROBADO | 12/11/2026 13:35 | — | fix(db): renumerar migracion de eventos ATP a 072 |
| `CP-H61-API-18` | Publicación de ruta y esquemas OpenAPI 3.0 en `GET /openapi.json` | Contrato OpenAPI | OpenAPI 3.0 | Alta | Servidor local activo en `:3001` y `generarOpenAPISpec()` | `GET http://localhost:3001/openapi.json` | Expone `post /api/eventos-atp`, `bearerAuth`, `CrearEventoAtpInput`, `EventoAtpResponse`, `CrearEventoAtpResponse` y códigos `201/400/401/403/409/500` | Verificado en vivo en `http://localhost:3001/openapi.json` (`has /api/eventos-atp: true`) | APROBADO | 12/11/2026 13:35 | — | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-19` | Documentación técnica del endpoint `POST /api/eventos-atp` en `docs/api/eventos-atp.md` | Documentación | API Docs | Media | Revisión de `docs/api/eventos-atp.md` | Lectura de sección 11 (`POST /api/eventos-atp`) | Reglas de negocio, ejemplos de request/response y evento Socket.io documentados | Sección 11 presente y alineada en estructura y códigos de estado | APROBADO | 12/11/2026 13:33 | — | docs(eventos-atp): corregir numeracion de la seccion H61 |
| `CP-H61-API-20` | Ejecución completa de la suite de regresión y análisis estático ESLint | Regresión / Calidad | Suite Completa | Alta | Entorno Node.js y Vitest configurados | `npm run lint && npm test` | `0` errores ESLint y `100%` de pruebas unitarias pasando sin regresiones | `0` errores ESLint y `64/64` archivos / `765/765` tests pasando | APROBADO | 12/11/2026 13:33 | — | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H61-API-01	Colisión permanente de correlativo automático ATP-AAAA-#### tras código manual con prefijo ATP-AAAA- no numérico o de distinta longitud	Concurrencia / Correlativo	Repository / PostgreSQL	Crítica	Tabla evento_atp con ATP-2026-0001 y código manual ATP-2026-MAYO	generarSiguienteCodigoEventoAtp(trx, 2026) seguido de INSERT en evento_atp	Debe generar ATP-2026-0002 ignorando sufijos no numéricos y comparar numéricamente	Retorna ATP-2026-0001 (NaN -> 1) y falla con SQLSTATE 23505 (evento_atp_codigo_key) generando HTTP 500	ABIERTO	12/11/2026 13:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H61-API-02	Condición de carrera TOCTOU en código manual duplicado y ausencia de manejo de SQLSTATE 23505	Concurrencia / Integridad	Service / Repository	Alta	Dos solicitudes concurrentes con el mismo codigo manual o colisión manual vs automático	codigo: "ATP-2026-0001" en dos POST /api/eventos-atp paralelos	Una petición retorna 201 Created y la segunda 409 Conflict	existeCodigoEventoAtp corre fuera de trx y no captura 23505; retorna HTTP 500	ABIERTO	12/11/2026 13:34	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H61-API-03	Validación laxa de fechas en FechaHoraEventoAtpSchema acepta textos arbitrarios y fechas calendario inexistentes	Validación / Borde	Schema / API Live	Alta	Endpoint POST /api/eventos-atp activo y token de Administrador válido	fechaInicio: "abc 1", fechaTermino: "2026" y fechaInicio: "2026-02-30T10:00"	HTTP 400 Bad Request rechazando formato no ISO-8601 y fechas calendario inválidas	Supera validación Zod (safeParse.success === true) y alcanza capa de repositorio en vivo	ABIERTO	12/11/2026 13:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H61-API-04	Broadcast global indiscriminado (ioInstance.emit) y duplicación de entregas en emitirEventoAtpCreado	Seguridad / Tiempo Real	Socket.io / Service	Alta	Servidor Socket.io (ioInstance) inicializado con clientes en múltiples salas	emitirEventoAtpCreado({ id: "test" }) con mock de ioInstance	Emitir evento_atp:creado exclusivamente a salas autorizadas sin broadcast global ni duplicación	Invoca (ioInstance as any).emit("evento_atp:creado") globalmente además de 6 emisiones por sala	ABIERTO	12/11/2026 13:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H61-API-05	Rechazo HTTP 400 cuando el campo opcional codigo se envía como cadena vacía "" o null	Validación / Borde	Schema / API Live	Media	Token de Administrador válido y formulario enviando codigo vacío	POST /api/eventos-atp con codigo: "" o codigo: null	Normalizar vacío/null a undefined para autogenerar correlativo ATP-AAAA-####	Retorna HTTP 400 (El código debe tener al menos 3 caracteres / expected string, received null)	ABIERTO	12/11/2026 13:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H61-API-06	verificarDelegacionesExisten permite vincular delegaciones inactivas (activo = false) fuera de transacción	Integridad Territorial	Repository / Service	Media	Registro en tabla delegacion con activo = false	delegacionIds: ["<uuid_delegacion_inactiva>"]	Rechazar con 400 Bad Request delegaciones inactivas y validar dentro de trx	Consulta delegacion sin .where("activo", "=", true) y fuera de db.transaction()	ABIERTO	12/11/2026 13:34	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H61-API-07	Desalineación de mensaje HTTP 403, diccionario docs/database/README.md desactualizado y falta de aserciones OpenAPI en test	Contrato / Documentación	Service / Docs / Test	Baja	Usuario callcenter@valdivia.cl sin permiso y revisión de docs/database/README.md y route.test.ts	POST /api/eventos-atp con Bearer de Call Center e inspección de archivos	Mensaje 403 alineado con eventos_atp:crear, README.md actualizado y ruta cubierta en test OpenAPI	Devuelve mensaje de gestión de roles; README.md conserva evento_atp en Hoja de Ruta y falta aserción en openapi.json/__tests__/route.test.ts	ABIERTO	12/11/2026 13:36	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H61-API-01	Creación exitosa de Evento ATP con código automático ATP-AAAA-####, estado ACTIVO y una delegación	Funcional	Route / Service	Crítica	Usuario Administrador autenticado	POST /api/eventos-atp con payload válido y delegacionIds: [DEL_NORTE]	HTTP 201 Created con estado: "ACTIVO", codigo: "ATP-2026-0001" y 1 delegación	Verificado en suite Vitest (route.test.ts y evento-atp.service.test.ts)	APROBADO	12/11/2026 13:37	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-02	Normalización a mayúsculas de código manual válido en creación de Evento ATP	Lógica de Negocio	Service	Alta	Código manual no duplicado	codigo: "atp-2026-0099"	El repositorio recibe codigo: "ATP-2026-0099" en mayúsculas	Verificado en evento-atp.service.test.ts	APROBADO	12/11/2026 13:37	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-03	Creación con alcance comunal centralizado sin delegaciones (delegacionIds: [] u omitido)	Funcional	Schema / Service / Repo	Alta	Payload válido sin delegaciones	delegacionIds: [] y delegacionIds: undefined	HTTP 201 sin inserciones en tabla puente evento_atp_delegacion	Verificado en evento-atp.schema.test.ts, service.test.ts y repository.test.ts	APROBADO	12/11/2026 13:37	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-04	Inserción transaccional atómica en evento_atp y evento_atp_delegacion	Persistencia / Transacción	Repository	Crítica	Transacción Kysely activa	insertarEventoAtpConDelegaciones con delegación Norte	Ambas tablas se insertan dentro de una sola llamada a db.transaction()	Verificado en evento-atp.repository.test.ts	APROBADO	12/11/2026 13:37	—	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-05	Reversión atómica de la transacción ante fallo en inserción de tabla puente evento_atp_delegacion	Persistencia / Rollback	Repository	Crítica	Fallo simulado al insertar en evento_atp_delegacion	crearTransaccionFalsa({ fallarEnPuente: true })	La excepción se propaga y la transacción revierte la inserción de evento_atp	Verificado en evento-atp.repository.test.ts	APROBADO	12/11/2026 13:37	—	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-06	Rechazo HTTP 409 Conflict cuando el código manual ya existe antes de iniciar inserción	Validación / Negocio	Service	Crítica	Código manual ya existente en BD	codigo: "ATP-2026-0001" existente (existeCodigoEventoAtp = true)	Lanza ConflictError (HTTP 409) sin invocar insertarEventoAtpConDelegaciones	Verificado en evento-atp.service.test.ts	APROBADO	12/11/2026 13:37	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-07	Rechazo HTTP 400 Bad Request ante fechaTermino anterior a fechaInicio	Validación / Regla CA-4	Schema / API Live	Crítica	Token de Administrador válido	fechaInicio: "2026-05-03T18:00", fechaTermino: "2026-05-01T10:00"	HTTP 400 con error en campo fechaTermino	HTTP 400 confirmado en vivo vía curl y en route.test.ts / schema.test.ts	APROBADO	12/11/2026 13:36	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-08	Aceptación válida de fechaTermino igual a fechaInicio	Validación / Límite CA-4	Schema	Media	Esquema Zod activo	fechaInicio: "2026-05-01T10:00", fechaTermino: "2026-05-01T10:00"	Validación exitosa (success: true)	Verificado en evento-atp.schema.test.ts	APROBADO	12/11/2026 13:37	—	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-09	Rechazo de nombre menor a 3 caracteres, tipoAmenaza o nivelAlerta fuera de catálogo y codigo con símbolos inválidos	Validación / Zod	Schema	Alta	Esquema Zod activo	nombre: "AB", tipoAmenaza: "VOLCANICA", nivelAlerta: "NARANJA", codigo: "ATP 2026/0001"	Validación rechazada identificando cada campo inválido	Verificado en evento-atp.schema.test.ts	APROBADO	12/11/2026 13:37	—	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-10	Rechazo de identificadores repetidos en delegacionIds	Validación / Zod	Schema	Media	Esquema Zod activo	delegacionIds: ["30000000-...-0001", "30000000-...-0001"]	Error de validación en delegacionIds (No se puede repetir una misma delegación)	Verificado en evento-atp.schema.test.ts	APROBADO	12/11/2026 13:37	—	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-11	Rechazo HTTP 400 Bad Request ante delegación inexistente en PostgreSQL	Validación / Integridad	Service / API Live	Alta	Token de Administrador válido y BD activa	delegacionIds: ["30000000-0000-4000-8000-999999999999"]	HTTP 400 con mensaje Las siguientes delegaciones no existen en el sistema: 30000000-0000-4000-8000-999999999999.	HTTP 400 exacto observado en vivo vía curl y en service.test.ts	APROBADO	12/11/2026 13:36	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-12	Rechazo HTTP 400 Bad Request ante cuerpo JSON malformado	Validación / HTTP	Route Handler / API Live	Media	Token de Administrador válido	Body {no-es-json	HTTP 400 con {"message":"El cuerpo de la solicitud no es un JSON válido."}	HTTP 400 exacto observado en vivo vía curl y en route.test.ts	APROBADO	12/11/2026 13:36	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-13	Rechazo HTTP 401 Unauthorized sin cabecera Bearer o con token inválido/expirado	Seguridad / Auth	Route Handler / API Live	Crítica	Endpoint POST /api/eventos-atp expuesto	Sin Authorization y con Authorization: Bearer token.invalido.123	HTTP 401 Unauthorized impidiendo ejecución del servicio	HTTP 401 exacto observado en vivo vía curl y en route.test.ts	APROBADO	12/11/2026 13:36	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-14	Rechazo HTTP 403 Forbidden para usuario autenticado sin rol Administrador ni permiso eventos_atp:crear	Seguridad / RBAC	Route / Service / API Live	Crítica	Usuario callcenter@valdivia.cl autenticado sin permiso eventos_atp:crear	POST /api/eventos-atp con JWT Bearer de Call Center y payload válido	HTTP 403 Forbidden denegando la creación del Evento ATP	HTTP 403 observado en vivo vía curl y en route.test.ts / service.test.ts	APROBADO	12/11/2026 13:36	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-15	Desvinculación formal del permiso eventos_atp:crear como fallback en Puntos Críticos (punto-critico.service.ts)	Seguridad / Regresión CA-7	Service / Unit	Alta	Código de punto-critico.service.ts y suite punto-critico.test.ts	Inspección de crearPuntoCritico y ejecución de punto-critico.test.ts	crearPuntoCritico exige únicamente PERMISO_CREAR_PUNTO_CRITICO (puntos_criticos:crear) y los 43 tests pasan	43/43 tests aprobados en punto-critico.test.ts y fallback eliminado en punto-critico.service.ts:164	APROBADO	12/11/2026 13:37	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-16	Ejecución DDL reversible (up y down) de la migración 072_evento_atp_base.ts en PostgreSQL 16 real	Integridad BD	Migración / PostgreSQL	Crítica	PostgreSQL 16 con migraciones previas (001..035)	Ejecución transaccional de up(trx) y down(trx) en 072_evento_atp_base.ts	Crea evento_atp, evento_atp_delegacion, índices, FKs evento_atp_id y revierte limpiamente en down	UP_OK, DOWN_OK y TX_ROLLED_BACK_CLEANLY en PostgreSQL 16 y 5/5 tests en 072_evento_atp_base.test.ts	APROBADO	12/11/2026 13:35	—	fix(db): renumerar migracion de eventos ATP a 072
CP-H61-API-17	Asignación idempotente del permiso eventos_atp:crear al rol Administrador en migración 072	Seguridad / Configuración	Migración Kysely	Alta	Tabla permiso con eventos_atp:crear y rol Administrador	Ejecución de up(db) de 072_evento_atp_base.ts	Actualiza descripción/módulo y ejecuta INSERT INTO rol_permiso ... ON CONFLICT DO NOTHING	Verificado en SQL ejecutado en PostgreSQL 16 y en 072_evento_atp_base.test.ts	APROBADO	12/11/2026 13:35	—	fix(db): renumerar migracion de eventos ATP a 072
CP-H61-API-18	Publicación de ruta y esquemas OpenAPI 3.0 en GET /openapi.json	Contrato OpenAPI	OpenAPI 3.0	Alta	Servidor local activo en :3001 y generarOpenAPISpec()	GET http://localhost:3001/openapi.json	Expone post /api/eventos-atp, bearerAuth, CrearEventoAtpInput, EventoAtpResponse, CrearEventoAtpResponse y códigos 201/400/401/403/409/500	Verificado en vivo en http://localhost:3001/openapi.json (has /api/eventos-atp: true)	APROBADO	12/11/2026 13:35	—	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-19	Documentación técnica del endpoint POST /api/eventos-atp en docs/api/eventos-atp.md	Documentación	API Docs	Media	Revisión de docs/api/eventos-atp.md	Lectura de sección 11 (POST /api/eventos-atp)	Reglas de negocio, ejemplos de request/response y evento Socket.io documentados	Sección 11 presente y alineada en estructura y códigos de estado	APROBADO	12/11/2026 13:33	—	docs(eventos-atp): corregir numeracion de la seccion H61
CP-H61-API-20	Ejecución completa de la suite de regresión y análisis estático ESLint	Regresión / Calidad	Suite Completa	Alta	Entorno Node.js y Vitest configurados	npm run lint && npm test	0 errores ESLint y 100% de pruebas unitarias pasando sin regresiones	0 errores ESLint y 64/64 archivos / 765/765 tests pasando	APROBADO	12/11/2026 13:33	—	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Análisis Estático y Suite Automatizada (Vitest)

#### 5.1.1 Suite Focalizada del Módulo Eventos ATP, Migración 072 y OpenAPI
```bash
npx vitest run \
  src/app/api/eventos-atp/__tests__/route.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.schema.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.service.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.repository.test.ts \
  src/lib/db/migrations/__tests__/072_evento_atp_base.test.ts \
  src/modules/eventos-atp/__tests__/punto-critico.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 ✓ src/modules/eventos-atp/__tests__/evento-atp.schema.test.ts (9 tests) 11ms
 ✓ src/modules/eventos-atp/__tests__/evento-atp.service.test.ts (6 tests) 14ms
 ✓ src/modules/eventos-atp/__tests__/evento-atp.repository.test.ts (4 tests) 8ms
 ✓ src/lib/db/migrations/__tests__/072_evento_atp_base.test.ts (5 tests) 11ms
 ✓ src/app/api/eventos-atp/__tests__/route.test.ts (5 tests) 18ms
 ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (43 tests) 34ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 131ms

 Test Files  7 passed (7)
      Tests  73 passed (73)
```

#### 5.1.2 Ejecución Individual por Nombre de Prueba (`-t`) y Suite Completa
```bash
npm test -- -t "Evento ATP"
npm run lint && npm test
```

**Salida de Consola:**
```text
✖ 11 problems (0 errors, 11 warnings)

 Test Files  64 passed (64)
      Tests  765 passed (765)
```

---

### 5.2 Reproducción de Defectos en PostgreSQL 16 Real, Esquema Zod y Socket.io

#### 5.2.1 Reproducción de `BUG-H61-API-01` (Colisión `23505` en `generarSiguienteCodigoEventoAtp`)
```bash
npx tsx -e '
import { db } from "./src/lib/db";
import { up } from "./src/lib/db/migrations/072_evento_atp_base";
import { generarSiguienteCodigoEventoAtp } from "./src/modules/eventos-atp/evento-atp.repository";

async function main() {
  try {
    await db.transaction().execute(async (trx) => {
      await up(trx as any);

      await trx.insertInto("evento_atp" as any).values({
        codigo: "ATP-2026-0001",
        nombre: "Evento Base 1",
        descripcion: "Descripcion valida de prueba para evento base.",
        tipo_amenaza: "METEOROLOGICA",
        nivel_alerta: "VERDE",
        fecha_inicio: new Date("2026-05-01T10:00:00Z"),
        fecha_termino: new Date("2026-05-02T10:00:00Z"),
        estado: "ACTIVO",
        creado_por_id: "00000000-0000-4000-8000-000000000001",
      }).execute();

      await trx.insertInto("evento_atp" as any).values({
        codigo: "ATP-2026-MAYO",
        nombre: "Evento Manual Mayo",
        descripcion: "Descripcion valida de prueba para evento manual.",
        tipo_amenaza: "METEOROLOGICA",
        nivel_alerta: "AMARILLA",
        fecha_inicio: new Date("2026-05-01T10:00:00Z"),
        fecha_termino: new Date("2026-05-02T10:00:00Z"),
        estado: "ACTIVO",
        creado_por_id: "00000000-0000-4000-8000-000000000001",
      }).execute();

      const codigoGenerado = await generarSiguienteCodigoEventoAtp(trx as any, 2026);
      console.log("CODIGO_GENERADO_TRAS_MANUAL_MAYO:", codigoGenerado);

      try {
        await trx.insertInto("evento_atp" as any).values({
          codigo: codigoGenerado,
          nombre: "Evento Auto Colision",
          descripcion: "Descripcion valida de prueba para colision.",
          tipo_amenaza: "METEOROLOGICA",
          nivel_alerta: "ROJA",
          fecha_inicio: new Date("2026-05-03T10:00:00Z"),
          fecha_termino: new Date("2026-05-04T10:00:00Z"),
          estado: "ACTIVO",
          creado_por_id: "00000000-0000-4000-8000-000000000001",
        }).execute();
      } catch (pgErr: any) {
        console.log("PG_ERROR_CODE:", pgErr.code, "DETAIL:", pgErr.detail, "CONSTRAINT:", pgErr.constraint);
      }

      throw new Error("ROLLBACK_TEST");
    });
  } catch (e: any) {
    if (e.message !== "ROLLBACK_TEST") console.error(e);
  } finally {
    await db.destroy();
  }
}
main();
'
```

**Salida Obtenida:**
```text
CODIGO_GENERADO_TRAS_MANUAL_MAYO: ATP-2026-0001
PG_ERROR_CODE: 23505 DETAIL: Key (codigo)=(ATP-2026-0001) already exists. CONSTRAINT: evento_atp_codigo_key
```

#### 5.2.2 Reproducción de `BUG-H61-API-03`, `BUG-H61-API-04` y `BUG-H61-API-05`
```bash
npx tsx -e '
import { CrearEventoAtpInputSchema } from "./src/modules/eventos-atp/evento-atp.schema";
import { setSocketServer, emitirEventoAtpCreado } from "./src/lib/socket";

const base = {
  nombre: "Sistema Frontal Mayo 2026",
  descripcion: "Sistema frontal con precipitaciones intensas y vientos moderados.",
  tipoAmenaza: "METEOROLOGICA",
  nivelAlerta: "AMARILLA",
  fechaInicio: "2026-05-01T10:00",
  fechaTermino: "2026-05-03T18:00",
  delegacionIds: [],
};

console.log("EMPTY_CODIGO:", JSON.stringify(CrearEventoAtpInputSchema.safeParse({ ...base, codigo: "" })));
console.log("NULL_CODIGO:", JSON.stringify(CrearEventoAtpInputSchema.safeParse({ ...base, codigo: null })));
console.log("GARBAGE_DATE:", JSON.stringify(CrearEventoAtpInputSchema.safeParse({ ...base, fechaInicio: "abc 1", fechaTermino: "2026" })));
console.log("FEB30_DATE:", JSON.stringify(CrearEventoAtpInputSchema.safeParse({ ...base, fechaInicio: "2026-02-30T10:00", fechaTermino: "2026-03-03T10:00" })));

const emits: any[] = [];
const mockIo = {
  to: (room: string) => ({ emit: (ev: string) => emits.push({ scope: "room:" + room, ev }) }),
  emit: (ev: string) => emits.push({ scope: "GLOBAL_ALL_CLIENTS", ev }),
};
setSocketServer(mockIo as any);
emitirEventoAtpCreado({ id: "test" });
console.log("SOCKET_EMITS:", JSON.stringify(emits));
'
```

**Salida Obtenida:**
```text
EMPTY_CODIGO: {"success":false,...,"message":"El código debe tener al menos 3 caracteres"}
NULL_CODIGO: {"success":false,...,"message":"Invalid input: expected string, received null"}
GARBAGE_DATE: {"success":true,"data":{...,"fechaInicio":"abc 1","fechaTermino":"2026",...}}
FEB30_DATE: {"success":true,"data":{...,"fechaInicio":"2026-02-30T10:00","fechaTermino":"2026-03-03T10:00",...}}
SOCKET_EMITS: [{"scope":"room:sala:encargados","ev":"evento_atp:creado"},{"scope":"room:encargado","ev":"evento_atp:creado"},{"scope":"room:supervisor","ev":"evento_atp:creado"},{"scope":"room:mapa","ev":"evento_atp:creado"},{"scope":"room:admin","ev":"evento_atp:creado"},{"scope":"room:administrador","ev":"evento_atp:creado"},{"scope":"GLOBAL_ALL_CLIENTS","ev":"evento_atp:creado"}]
```

---

### 5.3 Pruebas HTTP Replicables mediante `cURL` (Servidor en `http://localhost:3001`)

#### 5.3.1 Obtención de Tokens de Sesión (`admin@valdivia.cl` y `callcenter@valdivia.cl`)
```bash
TOKEN_ADMIN=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"admin@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token ?? d.accessToken ?? d.data?.token ?? "")')

TOKEN_CC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token ?? d.accessToken ?? d.data?.token ?? "")')
```

#### 5.3.2 Rechazo Sin Autenticación y Token Inválido (`401 Unauthorized` — `CP-H61-API-13`)
```bash
curl -i -s -X POST http://localhost:3001/api/eventos-atp \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Sistema Frontal Mayo 2026","descripcion":"Sistema frontal con precipitaciones intensas.","tipoAmenaza":"METEOROLOGICA","nivelAlerta":"AMARILLA","fechaInicio":"2026-05-01T10:00","fechaTermino":"2026-05-03T18:00"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

```bash
curl -i -s -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer token.invalido.123" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Sistema Frontal Mayo 2026"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Token de sesión inválido o expirado."}
```

#### 5.3.3 Rechazo RBAC (`403 Forbidden` — `CP-H61-API-14` y `BUG-H61-API-07`)
```bash
curl -i -s -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_CC" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Sistema Frontal Mayo 2026","descripcion":"Sistema frontal con precipitaciones intensas y vientos moderados.","tipoAmenaza":"METEOROLOGICA","nivelAlerta":"AMARILLA","fechaInicio":"2026-05-01T10:00","fechaTermino":"2026-05-03T18:00","delegacionIds":[]}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."}
```

#### 5.3.4 Validación de JSON Malformado (`400 Bad Request` — `CP-H61-API-12`)
```bash
curl -i -s -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{no-es-json'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"El cuerpo de la solicitud no es un JSON válido."}
```

#### 5.3.5 Validación de Reglas de Fechas y Código Vacío (`400 Bad Request` — `CP-H61-API-07` y `BUG-H61-API-05`)
```bash
curl -i -s -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"codigo":"","nombre":"Sistema Frontal Mayo 2026","descripcion":"Sistema frontal con precipitaciones intensas y vientos moderados.","tipoAmenaza":"METEOROLOGICA","nivelAlerta":"AMARILLA","fechaInicio":"2026-05-03T18:00","fechaTermino":"2026-05-01T10:00","delegacionIds":[]}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de creación de Evento ATP inválidos.","errors":[{"campo":"codigo","mensaje":"El código debe tener al menos 3 caracteres"},{"campo":"codigo","mensaje":"El código solo puede contener letras, números y guiones"},{"campo":"fechaTermino","mensaje":"La fecha y hora de término debe ser mayor o igual a la fecha y hora de inicio"}]}
```

#### 5.3.6 Validación de Delegación Inexistente (`400 Bad Request` — `CP-H61-API-11`) y Paso Indebido de Fechas Inválidas (`BUG-H61-API-03`)
```bash
curl -i -s -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Sistema Frontal Mayo 2026","descripcion":"Sistema frontal con precipitaciones intensas y vientos moderados.","tipoAmenaza":"METEOROLOGICA","nivelAlerta":"AMARILLA","fechaInicio":"abc 1","fechaTermino":"2026","delegacionIds":["30000000-0000-4000-8000-999999999999"]}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Las siguientes delegaciones no existen en el sistema: 30000000-0000-4000-8000-999999999999."}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos y Defectos Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|---|----------|
| **CA-1:** Vista/formulario accesible exclusivamente para Administrador en `/gestion/admin/eventos-atp/nuevo`. | `CP-H61-API-18` | **NO APLICA (Alcance Frontend `sgrai-web`)** | En `sgrai-api` se provee el endpoint `POST /api/eventos-atp` y contrato `/openapi.json` para consumo del formulario. |
| **CA-2:** Captura de código único (generado o manual), nombre, descripción, tipo de amenaza, nivel de alerta, fecha/hora inicio y término. | `CP-H61-API-01`, `CP-H61-API-02`, `CP-H61-API-06`, `CP-H61-API-09`, `BUG-H61-API-01`, `BUG-H61-API-02`, `BUG-H61-API-05` | **CON OBSERVACIONES (BUG-01, BUG-02, BUG-05)** | El correlativo automático colisiona (`23505`) tras códigos manuales `ATP-AAAA-<texto>`; falta captura de `23505` en concurrencia y normalización de `codigo: ""` / `null`. |
| **CA-3:** Selector múltiple de delegaciones municipales (`Norte`, `Sur`, `Costa`, `Calle Calle`), una, varias o vacío para alcance comunal. | `CP-H61-API-03`, `CP-H61-API-10`, `CP-H61-API-11`, `BUG-H61-API-06` | **CON OBSERVACIONES (BUG-06)** | Permite una, varias o ninguna delegación, pero `verificarDelegacionesExisten` no filtra `activo = true` y opera fuera de `trx`. |
| **CA-4:** Validación Zod estricta: obligatoriedad de nombre, tipo de amenaza, nivel de alerta y `fecha_termino >= fecha_inicio`. | `CP-H61-API-07`, `CP-H61-API-08`, `CP-H61-API-09`, `BUG-H61-API-03` | **CON OBSERVACIONES (BUG-03)** | La regla `fechaTermino >= fechaInicio` opera correctamente en rangos ISO válidos, pero `Date.parse` acepta textos arbitrarios (`"abc 1"`, `"2026"`) y fechas inexistentes (`"2026-02-30T10:00"`). |
| **CA-5:** Persistir en `evento_atp` con estado inicial `ACTIVO` y poblar `evento_atp_delegacion` en una sola transacción PostgreSQL. | `CP-H61-API-04`, `CP-H61-API-05`, `CP-H61-API-16` | **CUMPLIDO** | `insertarEventoAtpConDelegaciones` inserta ambas tablas en `db.transaction()` con `estado: "ACTIVO"`; migración `072` validada en PostgreSQL 16. |
| **CA-6:** Emitir en tiempo real el evento WebSocket `evento_atp:creado` a las salas `admin`, `encargado`, `supervisor` y `mapa`. | `BUG-H61-API-04` | **INCUMPLIDO (BUG-04)** | `emitirEventoAtpCreado` ejecuta broadcast global `(ioInstance as any).emit(...)` hacia salas no autorizadas y genera emisiones duplicadas. |
| **CA-7:** Acceso protegido por permiso RBAC `eventos_atp:crear`, desvinculado formalmente como fallback de puntos críticos. | `CP-H61-API-13`, `CP-H61-API-14`, `CP-H61-API-15`, `CP-H61-API-17`, `BUG-H61-API-07` | **CUMPLIDO CON OBSERVACIÓN MENOR (BUG-07)** | `POST /api/eventos-atp` exige `eventos_atp:crear` / `Administrador` y se removió el fallback de `punto-critico.service.ts`; pendiente alinear el mensaje de error `403`. |
