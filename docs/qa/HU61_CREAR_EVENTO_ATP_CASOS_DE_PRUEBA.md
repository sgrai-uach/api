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
> * `docs(qa): documentar primera versión de casos de prueba para HU-61`  
> * `fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.`  
>  
> **Entorno de Pruebas:** Local (Docker PostgreSQL 16 + PostGIS + Redis 7 / Node.js / Servidor API en `http://localhost:3001`)  
> **Fecha de Auditoría Inicial:** 12/11/2026 13:37  
> **Fecha de Certificación Re-Test:** 16/11/2026 22:40  
> **Estado de Certificación:** 🟢 **APROBADO PARA INTEGRACIÓN (100% PASS TRAS RE-TEST)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Ciclo de Re-Test

Tras la notificación de fixes aplicados por el desarrollador en el commit `fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.`, se ejecutó el ciclo formal de **Re-Test** sobre la rama `feature/H61-crear-evento-atp`. La auditoría incluyó verificación estática de código (`ESLint` y compilación TypeScript), ejecución de las suites automatizadas unitarias y de integración en Vitest, pruebas de concurrencia sobre PostgreSQL 16 real y pruebas HTTP en vivo contra el endpoint `POST /api/eventos-atp` expuesto en el servidor local.

Se certifica que los **7 defectos técnicos detectados en la auditoría inicial** (`BUG-H61-API-01` a `BUG-H61-API-07`) fueron subsanados en su totalidad, garantizando la estabilidad operativa del correlativo anual, la captura segura de concurrencia (`SQLSTATE 23505` a `HTTP 409`), el filtrado de fechas estrictas sin desbordes de calendario, la focalización de emisiones WebSocket a las salas autorizadas, la autogeneración ante códigos vacíos, la validación de delegaciones activas en transacción y la sincronización del contrato OpenAPI y documentación.

| Métrica de Calidad | Evaluación Inicial (12/11/2026) | Ciclo Re-Test (16/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **27** | **27** | 7 Defectos Auditados y Subsanados (`BUG-H61-API-01` a `07`) + 20 Casos de Contrato, RBAC, Transacción y OpenAPI (`CP-H61-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | **27** | 100% de los casos funcionales, transaccionales, de concurrencia, seguridad RBAC y regresión aprobados |
| **Defectos Abiertos / Fallidos (Failed)** | **7** | **0** | Los 7 defectos detectados (1 crítico, 3 altos, 2 medios, 1 bajo) fueron corregidos y verificados en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Sin bloqueos de entorno o infraestructura |
| **Tasa de Aprobación Global (% Pass)** | **74.1%** | **100.0%** | Cumplimiento íntegro de todos los Criterios de Aceptación (CA-1 al CA-7) |
| **Suite Automatizada de Eventos ATP (Vitest)** | **29/29 tests pass** | **47/47 tests pass** | `route.test.ts` (9), `evento-atp.schema.test.ts` (13), `evento-atp.service.test.ts` (7), `evento-atp.repository.test.ts` (11), `evento-atp.test.ts` (1), `072_evento_atp_base.test.ts` (5), `openapi.json/route.test.ts` (1) |
| **Suite Completa de la API (Vitest)** | **765/765 tests pass** | **782/782 tests pass** | 65 archivos de prueba ejecutados sin fallos ni regresiones |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores** | **0 errores** | 0 errores en todo el repositorio |
| **Migración Kysely `072_evento_atp_base.ts`** | **Reversible en transacción** | 🟢 **Ejecutada y persistida** | `evento_atp`, `evento_atp_delegacion`, índices, checks y FKs aplicadas en base de datos local |

---

## 2. Registro Técnico de Defectos Detectados y Verificación de Subsanación (Re-Test)

### `BUG-H61-API-01`: Colisión Permanente del Correlativo Automático `ATP-AAAA-####` (`SQLSTATE 23505` / HTTP 500) tras Registrar Códigos Manuales con Prefijo `ATP-AAAA-`
* **Severidad:** **CRÍTICA** (Criterio de Aceptación 2 y Disponibilidad del Servicio).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivos Afectados:** `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 120–161).
* **Descripción Técnica del Defecto Original:**  
  `generarSiguienteCodigoEventoAtp` recuperaba el último código mediante `ORDER BY codigo DESC LIMIT 1`. Ante códigos manuales válidos con sufijos alfabéticos (ej. `ATP-2026-MAYO`), el orden lexicográfico devolvía dicho código, `Number.parseInt("MAYO", 10)` evaluaba a `NaN` y retrocedía la secuencia a `1` (`ATP-2026-0001`), provocando colisión por clave duplicada `SQLSTATE 23505` y respuesta `HTTP 500` en todas las creaciones automáticas subsecuentes.
* **Verificación Técnica en Re-Test:**  
  1. En `evento-atp.repository.ts` (líneas 138–148), la consulta SQL utiliza la expresión regular `codigo ~ ('^' || prefijo || '[0-9]{4,15}$')` y calcula el máximo numérico real con `COALESCE(MAX(SUBSTRING(codigo FROM ${prefijo.length + 1})::bigint), 0) AS maximo`.
  2. Incorpora una guarda defensiva transaccional `while (await existeCodigoEventoAtp(candidato, trx))` para avanzar la secuencia ante cualquier valor intermedio ocupado.
  3. Verificado en vivo creando `ATP-2026-MAYO` seguido de dos creaciones automáticas consecutivas: el backend generó correctamente `ATP-2026-0001` y `ATP-2026-0002` con `HTTP 201 Created` sin colisión ni fallas.

---

### `BUG-H61-API-02`: Condición de Carrera (TOCTOU) en Unicidad de Código Manual y Ausencia de Captura de `SQLSTATE 23505` (HTTP 500 en lugar de 409 Conflict)
* **Severidad:** **ALTA** (Concurrencia y Contrato de Errores HTTP).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-atp.service.ts` (líneas 74–95)
  * `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 95–118 y 194–239)
* **Descripción Técnica del Defecto Original:**  
  La verificación de unicidad previa se ejecutaba fuera de la transacción sin bloqueo pesimista. Peticiones concurrentes con el mismo código manual pasaban la comprobación y la segunda fallaba en el `INSERT` arrojando `SQLSTATE 23505`, devolviendo `HTTP 500` no controlado.
* **Verificación Técnica en Re-Test:**  
  1. En `evento-atp.repository.ts` (líneas 194–204), los códigos manuales adquieren un advisory lock transaccional exclusivo `pg_advisory_xact_lock(hashtext('evento_atp_codigo_' || codigoManual)::bigint)` y re-validan unicidad en `trx`.
  2. En las líneas 231–236, el bloque de inserción captura el error mediante `esViolacionCodigoEventoAtpUnico(error)` (`error.code === "23505"` y `constraint === "evento_atp_codigo_key"`) lanzando `ConflictError`.
  3. Verificado en vivo mediante `curl`: el reenvío de `ATP-2026-MAYO` respondió inmediatamente `HTTP 409 Conflict` con el mensaje `{"message":"Ya existe un Evento ATP registrado con el código 'ATP-2026-MAYO'."}`.

---

### `BUG-H61-API-03`: Validación Laxa de Fechas en `FechaHoraEventoAtpSchema` (`Date.parse`) Acepta Textos Arbitrarios y Fechas Calendario Inexistentes
* **Severidad:** **ALTA** (Criterio de Aceptación 4 e Integridad Temporal).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivo Afectado:** `src/modules/eventos-atp/evento-atp.schema.ts` (líneas 44–97 y 105–119).
* **Descripción Técnica del Defecto Original:**  
  `FechaHoraEventoAtpSchema` validaba únicamente mediante `!Number.isNaN(Date.parse(valor))`. Textos como `"abc 1"`, `"2026"` o fechas inexistentes como `"2026-02-30T10:00"` eran aceptados por Node.js con conversiones no deseadas (*rollover* silencioso a marzo).
* **Verificación Técnica en Re-Test:**  
  1. Se implementó la función estricta `esFechaHoraEventoAtpValida(valor)` con el patrón `REGEX_FECHA_HORA_ISO` (`^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$`).
  2. Valida rangos exactos de año, mes (1–12), día (1–31), hora (0–23), minuto (0–59) y offsets, comprobando mediante `Date.UTC` que año, mes y día coincidan exactamente con los valores suministrados (impidiendo fechas imposibles como 30 de febrero).
  3. Verificado en vivo mediante `curl`: peticiones con `"fechaInicio": "abc 1"` y `"fechaInicio": "2026-02-30T10:00"` respondieron `HTTP 400 Bad Request` indicando `"El formato de fecha y hora no es válido"`.

---

### `BUG-H61-API-04`: Emisión WebSocket `emitirEventoAtpCreado` Ejecuta Broadcast Global Indiscriminado (`ioInstance.emit`), Duplica Entregas e Inconsiste con Redis Pub/Sub
* **Severidad:** **ALTA** (Criterio de Aceptación 6 y Seguridad en Tiempo Real).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (líneas 356–389)
  * `src/lib/socket/__tests__/evento-atp.test.ts` (líneas 1–39)
* **Descripción Técnica del Defecto Original:**  
  La implementación ejecutaba un `(ioInstance as any).emit("evento_atp:creado", payload)` global adicional al bucle por salas, difundiendo la alerta a clientes no autorizados (informantes, call-center, patrullas) y duplicando mensajes en clientes suscritos a múltiples salas.
* **Verificación Técnica en Re-Test:**  
  1. En `src/lib/socket/index.ts` (líneas 366–371), se eliminó la llamada global y se configuró una sola emisión multi-sala `(ioInstance.to(salas) as any).emit("evento_atp:creado", payload)`, aprovechando la deduplicación nativa de Socket.io.
  2. Se incorporó la prueba unitaria `src/lib/socket/__tests__/evento-atp.test.ts` que valida que `to` es invocado con las salas institucionales autorizadas (`sala:encargados`, `encargado`, `supervisor`, `mapa`, `admin`, `administrador`) y que `emitGlobal` no es llamado jamás.

---

### `BUG-H61-API-05`: El Campo Opcional `codigo` Enviado como Cadena Vacía (`""`) o `null` es Rechazado con HTTP 400 en Lugar de Autogenerar el Correlativo
* **Severidad:** **MEDIA** (Criterio de Aceptación 2 e Integración Frontend-API).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivo Afectado:** `src/modules/eventos-atp/evento-atp.schema.ts` (líneas 127–148).
* **Descripción Técnica del Defecto Original:**  
  Si un formulario web enviaba `"codigo": ""` o `"codigo": null`, la validación Zod arrojaba `HTTP 400 Bad Request` por longitud mínima de 3 caracteres o tipo no string, impidiendo la generación automática.
* **Verificación Técnica en Re-Test:**  
  1. Se implementó `CodigoEventoAtpSchema` utilizando `z.preprocess`, normalizando `null`, `""` o cadenas de espacios en blanco a `undefined`.
  2. Verificado en vivo mediante `curl`: peticiones enviando `"codigo": ""` y `"codigo": null` retornaron `HTTP 201 Created` autogenerando correlativos válidos (`ATP-2026-0003` y `ATP-2026-0004`).

---

### `BUG-H61-API-06`: `verificarDelegacionesExisten` No Filtra Delegaciones Activas (`activo = true`) y Opera Fuera de la Transacción
* **Severidad:** **MEDIA** (Integridad Territorial y Consistencia Transaccional).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivos Afectados:** `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 56–76 y 179–189).
* **Descripción Técnica del Defecto Original:**  
  La consulta previa en `delegacion` no filtraba por `activo = true` y corría fuera de `db.transaction()`, permitiendo asociar delegaciones inactivas o deshabilitadas concurrentemente.
* **Verificación Técnica en Re-Test:**  
  1. `verificarDelegacionesExisten` acepta `trx?: Transaction<Database>` e incorpora `.where("activo", "=", true)` (línea 68).
  2. La validación se ejecuta dentro de la misma transacción de `insertarEventoAtpConDelegaciones` (líneas 180–189).
  3. Verificado en pruebas unitarias y en vivo: delegaciones inexistentes o inactivas son rechazadas con `HTTP 400 Bad Request`.

---

### `BUG-H61-API-07`: Desalineación del Mensaje HTTP `403`, Diccionario de Datos Desactualizado y Cobertura Incompleta en Tests de OpenAPI
* **Severidad:** **BAJA** (Alineación Documental y Cobertura de Contrato).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 16/11/2026 22:40)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-atp.service.ts` (líneas 18–20 y 70–74)
  * `docs/api/eventos-atp.md` (líneas 979, 1000–1085)
  * `src/app/openapi.json/__tests__/route.test.ts` (líneas 41–53)
* **Descripción Técnica del Defecto Original:**  
  La respuesta ante acceso denegado devolvía un mensaje genérico de gestión de roles en vez del mensaje institucional de Eventos ATP, la documentación OpenAPI carecía de aserciones en el test de integración y `docs/api/eventos-atp.md` requería precisiones en las reglas.
* **Verificación Técnica en Re-Test:**  
  1. En `evento-atp.service.ts`, se invoca `seguridadService.validarAccesoRoles` pasando `MENSAJE_ACCESO_DENEGADO_EVENTO_ATP` (`"Acceso denegado. Se requiere el perfil de Administrador o el permiso eventos_atp:crear."`).
  2. Verificado en vivo mediante `curl` con usuario `callcenter@valdivia.cl`: respondió `HTTP 403 Forbidden` con el mensaje exacto institucional.
  3. `src/app/openapi.json/__tests__/route.test.ts` incorpora aserciones completas para `/api/eventos-atp` validando `post`, `bearerAuth` y respuestas `201`, `400`, `401`, `403`, `409` y `500`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H61-API-01` | Colisión permanente de correlativo automático ATP-AAAA-#### tras código manual con prefijo ATP-AAAA- no numérico o de distinta longitud | Concurrencia / Correlativo | Repository / PostgreSQL | Crítica | Tabla evento_atp con ATP-2026-0001 y código manual ATP-2026-MAYO | generarSiguienteCodigoEventoAtp(trx, 2026) seguido de INSERT en evento_atp | Debe generar ATP-2026-0002 ignorando sufijos no numéricos y comparar numéricamente | Genera correlativo numérico real mediante regex SQL y MAX bigint; eventos posteriores asignan ATP-2026-0001 y ATP-2026-0002 sin colisión | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `BUG-H61-API-02` | Condición de carrera TOCTOU en código manual duplicado y ausencia de manejo de SQLSTATE 23505 | Concurrencia / Integridad | Service / Repository | Alta | Dos solicitudes concurrentes con el mismo codigo manual o colisión manual vs automático | codigo: "ATP-2026-MAYO" duplicado en POST /api/eventos-atp | Una petición retorna 201 Created y la segunda 409 Conflict | Advisory lock por código y captura de 23505 retornan HTTP 409 Conflict con mensaje institucional | APROBADO | 12/11/2026 13:34 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `BUG-H61-API-03` | Validación laxa de fechas en FechaHoraEventoAtpSchema acepta textos arbitrarios y fechas calendario inexistentes | Validación / Borde | Schema / API Live | Alta | Endpoint POST /api/eventos-atp activo y token de Administrador válido | fechaInicio: "abc 1", fechaTermino: "2026" y fechaInicio: "2026-02-30T10:00" | HTTP 400 Bad Request rechazando formato no ISO-8601 y fechas calendario inválidas | esFechaHoraEventoAtpValida valida regex ISO estricto y fecha calendario real retornando HTTP 400 Bad Request | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `BUG-H61-API-04` | Broadcast global indiscriminado (ioInstance.emit) y duplicación de entregas en emitirEventoAtpCreado | Seguridad / Tiempo Real | Socket.io / Service | Alta | Servidor Socket.io (ioInstance) inicializado con clientes en múltiples salas | emitirEventoAtpCreado({ id: "test" }) con mock de ioInstance | Emitir evento_atp:creado exclusivamente a salas autorizadas sin broadcast global ni duplicación | ioInstance.to(salas).emit emite en una sola llamada multi-sala sin broadcast global | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `BUG-H61-API-05` | Rechazo HTTP 400 cuando el campo opcional codigo se envía como cadena vacía "" o null | Validación / Borde | Schema / API Live | Media | Token de Administrador válido y formulario enviando codigo vacío | POST /api/eventos-atp con codigo: "" o codigo: null | Normalizar vacío/null a undefined para autogenerar correlativo ATP-AAAA-#### | z.preprocess normaliza valores vacíos y null a undefined; API responde HTTP 201 Created con correlativo | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `BUG-H61-API-06` | verificarDelegacionesExisten permite vincular delegaciones inactivas (activo = false) fuera de transacción | Integridad Territorial | Repository / Service | Media | Registro en tabla delegacion con activo = false | delegacionIds: ["<uuid_delegacion_inactiva>"] | Rechazar con 400 Bad Request delegaciones inactivas y validar dentro de trx | Consulta filtra .where("activo", "=", true) y se ejecuta dentro de db.transaction(trx) | APROBADO | 12/11/2026 13:34 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `BUG-H61-API-07` | Desalineación de mensaje HTTP 403, diccionario docs/database/README.md desactualizado y falta de aserciones OpenAPI en test | Contrato / Documentación | Service / Docs / Test | Baja | Usuario callcenter@valdivia.cl sin permiso y revisión de docs y tests | POST /api/eventos-atp con Bearer de Call Center e inspección de archivos | Mensaje 403 institucional exacto y ruta cubierta en prueba unitaria de OpenAPI | Mensaje institucional unificado, docs/api actualizados y aserciones agregadas en openapi.json/route.test.ts | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R. |
| `CP-H61-API-01` | Creación exitosa de Evento ATP con código automático ATP-AAAA-####, estado ACTIVO y una delegación | Funcional | Route / Service | Crítica | Usuario Administrador autenticado | POST /api/eventos-atp con payload válido y delegacionIds: [DEL_NORTE] | HTTP 201 Created con estado: "ACTIVO", codigo: "ATP-2026-0001" y 1 delegación | HTTP 201 Created retornando Evento ATP persistido con correlativo anual | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-02` | Normalización a mayúsculas de código manual válido en creación de Evento ATP | Lógica de Negocio | Service | Alta | Código manual no duplicado | codigo: "atp-2026-0099" | El repositorio recibe codigo: "ATP-2026-0099" en mayúsculas | Código normalizado a mayúsculas en base de datos y respuesta JSON | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-03` | Creación con alcance comunal centralizado sin delegaciones (delegacionIds: [] u omitido) | Funcional | Schema / Service / Repo | Alta | Payload válido sin delegaciones | delegacionIds: [] y delegacionIds: undefined | HTTP 201 sin inserciones en tabla puente evento_atp_delegacion | HTTP 201 Created con delegaciones vacías representando alcance comunal | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-04` | Inserción transaccional atómica en evento_atp y evento_atp_delegacion | Persistencia / Transacción | Repository | Crítica | Transacción Kysely activa | insertarEventoAtpConDelegaciones con delegación Norte | Ambas tablas se insertan dentro de una sola llamada a db.transaction() | Ambas tablas escritas de forma atómica bajo el mismo contexto transaccional | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-05` | Reversión atómica de la transacción ante fallo en inserción de tabla puente evento_atp_delegacion | Persistencia / Rollback | Repository | Crítica | Fallo simulado al insertar en evento_atp_delegacion | crearTransaccionFalsa({ fallarEnPuente: true }) | La excepción se propaga y la transacción revierte la inserción de evento_atp | Rollback verificado revirtiendo la inserción de evento_atp ante fallos | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-06` | Rechazo HTTP 409 Conflict cuando el código manual ya existe antes de iniciar inserción | Validación / Negocio | Service | Crítica | Código manual ya existente en BD | codigo: "ATP-2026-0001" existente (existeCodigoEventoAtp = true) | Lanza ConflictError (HTTP 409) sin invocar insertarEventoAtpConDelegaciones | Retorna HTTP 409 Conflict indicando código existente | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-07` | Rechazo HTTP 400 Bad Request ante fechaTermino anterior a fechaInicio | Validación / Regla CA-4 | Schema / API Live | Crítica | Token de Administrador válido | fechaInicio: "2026-05-03T18:00", fechaTermino: "2026-05-01T10:00" | HTTP 400 con error en campo fechaTermino | Retorna HTTP 400 Bad Request validado por superRefine de Zod | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-08` | Aceptación válida de fechaTermino igual a fechaInicio | Validación / Límite CA-4 | Schema | Media | Esquema Zod activo | fechaInicio: "2026-05-01T10:00", fechaTermino: "2026-05-01T10:00" | Validación exitosa (success: true) | Fechas idénticas aceptadas satisfactoriamente | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-09` | Rechazo de nombre menor a 3 caracteres, tipoAmenaza o nivelAlerta fuera de catálogo y codigo con símbolos inválidos | Validación / Zod | Schema | Alta | Esquema Zod activo | nombre: "AB", tipoAmenaza: "VOLCANICA", nivelAlerta: "NARANJA", codigo: "ATP 2026/0001" | Validación rechazada identificando cada campo inválido | Zod rechaza campos fuera de catálogo y longitudes inválidas | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-10` | Rechazo de identificadores repetidos en delegacionIds | Validación / Zod | Schema | Media | Esquema Zod activo | delegacionIds: ["30000000-...-0001", "30000000-...-0001"] | Error de validación en delegacionIds (No se puede repetir una misma delegación) | superRefine rechaza delegaciones repetidas con mensaje claro | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |
| `CP-H61-API-11` | Rechazo HTTP 400 Bad Request ante delegación inexistente en PostgreSQL | Validación / Integridad | Service / API Live | Alta | Token de Administrador válido y BD activa | delegacionIds: ["30000000-0000-4000-8000-999999999999"] | HTTP 400 con mensaje Las siguientes delegaciones no existen en el sistema: 30000000-0000-4000-8000-999999999999. | Retorna HTTP 400 Bad Request detallando los identificadores faltantes | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-12` | Rechazo HTTP 400 Bad Request ante cuerpo JSON malformado | Validación / HTTP | Route Handler / API Live | Media | Token de Administrador válido | Body {no-es-json | HTTP 400 con {"message":"El cuerpo de la solicitud no es un JSON válido."} | Captura en try-catch de req.json() retornando HTTP 400 Bad Request | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-13` | Rechazo HTTP 401 Unauthorized sin cabecera Bearer o con token inválido/expirado | Seguridad / Auth | Route Handler / API Live | Crítica | Endpoint POST /api/eventos-atp expuesto | Sin Authorization y con Authorization: Bearer token.invalido.123 | HTTP 401 Unauthorized impidiendo ejecución del servicio | authGuard bloquea la petición con HTTP 401 Unauthorized | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-14` | Rechazo HTTP 403 Forbidden para usuario autenticado sin rol Administrador ni permiso eventos_atp:crear | Seguridad / RBAC | Route / Service / API Live | Crítica | Usuario callcenter@valdivia.cl autenticado sin permiso eventos_atp:crear | POST /api/eventos-atp con JWT Bearer de Call Center y payload válido | HTTP 403 Forbidden denegando la creación del Evento ATP | Retorna HTTP 403 Forbidden con mensaje institucional unificado | APROBADO | 12/11/2026 13:36 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-15` | Desvinculación formal del permiso eventos_atp:crear como fallback en Puntos Críticos (punto-critico.service.ts) | Seguridad / Regresión CA-7 | Service / Unit | Alta | Código de punto-critico.service.ts y suite punto-critico.test.ts | Inspección de crearPuntoCritico y ejecución de punto-critico.test.ts | crearPuntoCritico exige únicamente PERMISO_CREAR_PUNTO_CRITICO (puntos_criticos:crear) y los 43 tests pasan | Fallback removido y 43/43 pruebas unitarias aprobadas | APROBADO | 12/11/2026 13:37 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-16` | Ejecución DDL reversible (up y down) de la migración 072_evento_atp_base.ts en PostgreSQL 16 real | Integridad BD | Migración / PostgreSQL | Crítica | PostgreSQL 16 con migraciones previas (001..034) | Ejecución transaccional de up(trx) y down(trx) en 072_evento_atp_base.ts | Crea evento_atp, evento_atp_delegacion, índices, FKs evento_atp_id y revierte limpiamente en down | Migración aplicada y tablas evento_atp y evento_atp_delegacion verificadas en base física | APROBADO | 12/11/2026 13:35 | 16/11/2026 22:40 | fix(db): renumerar migracion de eventos ATP a 072 |
| `CP-H61-API-17` | Asignación idempotente del permiso eventos_atp:crear al rol Administrador en migración 072 | Seguridad / Configuración | Migración Kysely | Alta | Tabla permiso con eventos_atp:crear y rol Administrador | Ejecución de up(db) de 072_evento_atp_base.ts | Actualiza descripción/módulo y ejecuta INSERT INTO rol_permiso ... ON CONFLICT DO NOTHING | Permiso asignado de forma idempotente al rol Administrador | APROBADO | 12/11/2026 13:35 | 16/11/2026 22:40 | fix(db): renumerar migracion de eventos ATP a 072 |
| `CP-H61-API-18` | Publicación de ruta y esquemas OpenAPI 3.0 en GET /openapi.json | Contrato OpenAPI | OpenAPI 3.0 | Alta | Servidor local activo en :3001 y generarOpenAPISpec() | GET http://localhost:3001/openapi.json | Expone post /api/eventos-atp, bearerAuth, CrearEventoAtpInput, EventoAtpResponse, CrearEventoAtpResponse y códigos 201/400/401/403/409/500 | Ruta y esquemas expuestos y verificados mediante suite automatizada route.test.ts | APROBADO | 12/11/2026 13:35 | 16/11/2026 22:40 | feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61) |
| `CP-H61-API-19` | Documentación técnica del endpoint POST /api/eventos-atp en docs/api/eventos-atp.md | Documentación | API Docs | Media | Revisión de docs/api/eventos-atp.md | Lectura de sección 11 (POST /api/eventos-atp) | Reglas de negocio, ejemplos de request/response y evento Socket.io documentados | Documentación técnica exhaustiva actualizada en docs/api/eventos-atp.md | APROBADO | 12/11/2026 13:33 | 16/11/2026 22:40 | docs(eventos-atp): corregir numeracion de la seccion H61 |
| `CP-H61-API-20` | Ejecución completa de la suite de regresión y análisis estático ESLint | Regresión / Calidad | Suite Completa | Alta | Entorno Node.js y Vitest configurados | npm run lint && npm test | 0 errores ESLint y 100% de pruebas unitarias pasando sin regresiones | 0 errores ESLint y 782/782 tests pasando en 65 suites | APROBADO | 12/11/2026 13:33 | 16/11/2026 22:40 | test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61) |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H61-API-01	Colisión permanente de correlativo automático ATP-AAAA-#### tras código manual con prefijo ATP-AAAA- no numérico o de distinta longitud	Concurrencia / Correlativo	Repository / PostgreSQL	Crítica	Tabla evento_atp con ATP-2026-0001 y código manual ATP-2026-MAYO	generarSiguienteCodigoEventoAtp(trx, 2026) seguido de INSERT en evento_atp	Debe generar ATP-2026-0002 ignorando sufijos no numéricos y comparar numéricamente	Genera correlativo numérico real mediante regex SQL y MAX bigint; eventos posteriores asignan ATP-2026-0001 y ATP-2026-0002 sin colisión	APROBADO	12/11/2026 13:36	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
BUG-H61-API-02	Condición de carrera TOCTOU en código manual duplicado y ausencia de manejo de SQLSTATE 23505	Concurrencia / Integridad	Service / Repository	Alta	Dos solicitudes concurrentes con el mismo codigo manual o colisión manual vs automático	codigo: "ATP-2026-MAYO" duplicado en POST /api/eventos-atp	Una petición retorna 201 Created y la segunda 409 Conflict	Advisory lock por código y captura de 23505 retornan HTTP 409 Conflict con mensaje institucional	APROBADO	12/11/2026 13:34	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
BUG-H61-API-03	Validación laxa de fechas en FechaHoraEventoAtpSchema acepta textos arbitrarios y fechas calendario inexistentes	Validación / Borde	Schema / API Live	Alta	Endpoint POST /api/eventos-atp activo y token de Administrador válido	fechaInicio: "abc 1", fechaTermino: "2026" y fechaInicio: "2026-02-30T10:00"	HTTP 400 Bad Request rechazando formato no ISO-8601 y fechas calendario inválidas	esFechaHoraEventoAtpValida valida regex ISO estricto y fecha calendario real retornando HTTP 400 Bad Request	APROBADO	12/11/2026 13:36	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
BUG-H61-API-04	Broadcast global indiscriminado (ioInstance.emit) y duplicación de entregas en emitirEventoAtpCreado	Seguridad / Tiempo Real	Socket.io / Service	Alta	Servidor Socket.io (ioInstance) inicializado con clientes en múltiples salas	emitirEventoAtpCreado({ id: "test" }) con mock de ioInstance	Emitir evento_atp:creado exclusivamente a salas autorizadas sin broadcast global ni duplicación	ioInstance.to(salas).emit emite en una sola llamada multi-sala sin broadcast global	APROBADO	12/11/2026 13:36	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
BUG-H61-API-05	Rechazo HTTP 400 cuando el campo opcional codigo se envía como cadena vacía "" o null	Validación / Borde	Schema / API Live	Media	Token de Administrador válido y formulario enviando codigo vacío	POST /api/eventos-atp con codigo: "" o codigo: null	Normalizar vacío/null a undefined para autogenerar correlativo ATP-AAAA-####	z.preprocess normaliza valores vacíos y null a undefined; API responde HTTP 201 Created con correlativo	APROBADO	12/11/2026 13:36	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
BUG-H61-API-06	verificarDelegacionesExisten permite vincular delegaciones inactivas (activo = false) fuera de transacción	Integridad Territorial	Repository / Service	Media	Registro en tabla delegacion con activo = false	delegacionIds: ["<uuid_delegacion_inactiva>"]	Rechazar con 400 Bad Request delegaciones inactivas y validar dentro de trx	Consulta filtra .where("activo", "=", true) y se ejecuta dentro de db.transaction(trx)	APROBADO	12/11/2026 13:34	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
BUG-H61-API-07	Desalineación de mensaje HTTP 403, diccionario docs/database/README.md desactualizado y falta de aserciones OpenAPI en test	Contrato / Documentación	Service / Docs / Test	Baja	Usuario callcenter@valdivia.cl sin permiso y revisión de docs y tests	POST /api/eventos-atp con Bearer de Call Center e inspección de archivos	Mensaje 403 institucional exacto y ruta cubierta en prueba unitaria de OpenAPI	Mensaje institucional unificado, docs/api actualizados y aserciones agregadas en openapi.json/route.test.ts	APROBADO	12/11/2026 13:36	16/11/2026 22:40	fix(feature): Correcciones H61 según lo que mandó nuestro QA Alen R.
CP-H61-API-01	Creación exitosa de Evento ATP con código automático ATP-AAAA-####, estado ACTIVO y una delegación	Funcional	Route / Service	Crítica	Usuario Administrador autenticado	POST /api/eventos-atp con payload válido y delegacionIds: [DEL_NORTE]	HTTP 201 Created con estado: "ACTIVO", codigo: "ATP-2026-0001" y 1 delegación	HTTP 201 Created retornando Evento ATP persistido con correlativo anual	APROBADO	12/11/2026 13:37	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-02	Normalización a mayúsculas de código manual válido en creación de Evento ATP	Lógica de Negocio	Service	Alta	Código manual no duplicado	codigo: "atp-2026-0099"	El repositorio recibe codigo: "ATP-2026-0099" en mayúsculas	Código normalizado a mayúsculas en base de datos y respuesta JSON	APROBADO	12/11/2026 13:37	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-03	Creación con alcance comunal centralizado sin delegaciones (delegacionIds: [] u omitido)	Funcional	Schema / Service / Repo	Alta	Payload válido sin delegaciones	delegacionIds: [] y delegacionIds: undefined	HTTP 201 sin inserciones en tabla puente evento_atp_delegacion	HTTP 201 Created con delegaciones vacías representando alcance comunal	APROBADO	12/11/2026 13:37	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-04	Inserción transaccional atómica en evento_atp y evento_atp_delegacion	Persistencia / Transacción	Repository	Crítica	Transacción Kysely activa	insertarEventoAtpConDelegaciones con delegación Norte	Ambas tablas se insertan dentro de una sola llamada a db.transaction()	Ambas tablas escritas de forma atómica bajo el mismo contexto transaccional	APROBADO	12/11/2026 13:37	16/11/2026 22:40	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-05	Reversión atómica de la transacción ante fallo en inserción de tabla puente evento_atp_delegacion	Persistencia / Rollback	Repository	Crítica	Fallo simulado al insertar en evento_atp_delegacion	crearTransaccionFalsa({ fallarEnPuente: true })	La excepción se propaga y la transacción revierte la inserción de evento_atp	Rollback verificado revirtiendo la inserción de evento_atp ante fallos	APROBADO	12/11/2026 13:37	16/11/2026 22:40	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-06	Rechazo HTTP 409 Conflict cuando el código manual ya existe antes de iniciar inserción	Validación / Negocio	Service	Crítica	Código manual ya existente en BD	codigo: "ATP-2026-0001" existente (existeCodigoEventoAtp = true)	Lanza ConflictError (HTTP 409) sin invocar insertarEventoAtpConDelegaciones	Retorna HTTP 409 Conflict indicando código existente	APROBADO	12/11/2026 13:37	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-07	Rechazo HTTP 400 Bad Request ante fechaTermino anterior a fechaInicio	Validación / Regla CA-4	Schema / API Live	Crítica	Token de Administrador válido	fechaInicio: "2026-05-03T18:00", fechaTermino: "2026-05-01T10:00"	HTTP 400 con error en campo fechaTermino	Retorna HTTP 400 Bad Request validado por superRefine de Zod	APROBADO	12/11/2026 13:36	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-08	Aceptación válida de fechaTermino igual a fechaInicio	Validación / Límite CA-4	Schema	Media	Esquema Zod activo	fechaInicio: "2026-05-01T10:00", fechaTermino: "2026-05-01T10:00"	Validación exitosa (success: true)	Fechas idénticas aceptadas satisfactoriamente	APROBADO	12/11/2026 13:37	16/11/2026 22:40	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-09	Rechazo de nombre menor a 3 caracteres, tipoAmenaza o nivelAlerta fuera de catálogo y codigo con símbolos inválidos	Validación / Zod	Schema	Alta	Esquema Zod activo	nombre: "AB", tipoAmenaza: "VOLCANICA", nivelAlerta: "NARANJA", codigo: "ATP 2026/0001"	Validación rechazada identificando cada campo inválido	Zod rechaza campos fuera de catálogo y longitudes inválidas	APROBADO	12/11/2026 13:37	16/11/2026 22:40	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-10	Rechazo de identificadores repetidos en delegacionIds	Validación / Zod	Schema	Media	Esquema Zod activo	delegacionIds: ["30000000-...-0001", "30000000-...-0001"]	Error de validación en delegacionIds (No se puede repetir una misma delegación)	superRefine rechaza delegaciones repetidas con mensaje claro	APROBADO	12/11/2026 13:37	16/11/2026 22:40	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
CP-H61-API-11	Rechazo HTTP 400 Bad Request ante delegación inexistente en PostgreSQL	Validación / Integridad	Service / API Live	Alta	Token de Administrador válido y BD activa	delegacionIds: ["30000000-0000-4000-8000-999999999999"]	HTTP 400 con mensaje Las siguientes delegaciones no existen en el sistema: 30000000-0000-4000-8000-999999999999.	Retorna HTTP 400 Bad Request detallando los identificadores faltantes	APROBADO	12/11/2026 13:36	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-12	Rechazo HTTP 400 Bad Request ante cuerpo JSON malformado	Validación / HTTP	Route Handler / API Live	Media	Token de Administrador válido	Body {no-es-json	HTTP 400 con {"message":"El cuerpo de la solicitud no es un JSON válido."}	Captura en try-catch de req.json() retornando HTTP 400 Bad Request	APROBADO	12/11/2026 13:36	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-13	Rechazo HTTP 401 Unauthorized sin cabecera Bearer o con token inválido/expirado	Seguridad / Auth	Route Handler / API Live	Crítica	Endpoint POST /api/eventos-atp expuesto	Sin Authorization y con Authorization: Bearer token.invalido.123	HTTP 401 Unauthorized impidiendo ejecución del servicio	authGuard bloquea la petición con HTTP 401 Unauthorized	APROBADO	12/11/2026 13:36	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-14	Rechazo HTTP 403 Forbidden para usuario autenticado sin rol Administrador ni permiso eventos_atp:crear	Seguridad / RBAC	Route / Service / API Live	Crítica	Usuario callcenter@valdivia.cl autenticado sin permiso eventos_atp:crear	POST /api/eventos-atp con JWT Bearer de Call Center y payload válido	HTTP 403 Forbidden denegando la creación del Evento ATP	Retorna HTTP 403 Forbidden con mensaje institucional unificado	APROBADO	12/11/2026 13:36	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-15	Desvinculación formal del permiso eventos_atp:crear como fallback en Puntos Críticos (punto-critico.service.ts)	Seguridad / Regresión CA-7	Service / Unit	Alta	Código de punto-critico.service.ts y suite punto-critico.test.ts	Inspección de crearPuntoCritico y ejecución de punto-critico.test.ts	crearPuntoCritico exige únicamente PERMISO_CREAR_PUNTO_CRITICO (puntos_criticos:crear) y los 43 tests pasan	Fallback removido y 43/43 pruebas unitarias aprobadas	APROBADO	12/11/2026 13:37	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-16	Ejecución DDL reversible (up y down) de la migración 072_evento_atp_base.ts en PostgreSQL 16 real	Integridad BD	Migración / PostgreSQL	Crítica	PostgreSQL 16 con migraciones previas (001..034)	Ejecución transaccional de up(trx) y down(trx) en 072_evento_atp_base.ts	Crea evento_atp, evento_atp_delegacion, índices, FKs evento_atp_id y revierte limpiamente en down	Migración aplicada y tablas evento_atp y evento_atp_delegacion verificadas en base física	APROBADO	12/11/2026 13:35	16/11/2026 22:40	fix(db): renumerar migracion de eventos ATP a 072
CP-H61-API-17	Asignación idempotente del permiso eventos_atp:crear al rol Administrador en migración 072	Seguridad / Configuración	Migración Kysely	Alta	Tabla permiso con eventos_atp:crear y rol Administrador	Ejecución de up(db) de 072_evento_atp_base.ts	Actualiza descripción/módulo y ejecuta INSERT INTO rol_permiso ... ON CONFLICT DO NOTHING	Permiso asignado de forma idempotente al rol Administrador	APROBADO	12/11/2026 13:35	16/11/2026 22:40	fix(db): renumerar migracion de eventos ATP a 072
CP-H61-API-18	Publicación de ruta y esquemas OpenAPI 3.0 en GET /openapi.json	Contrato OpenAPI	OpenAPI 3.0	Alta	Servidor local activo en :3001 y generarOpenAPISpec()	GET http://localhost:3001/openapi.json	Expone post /api/eventos-atp, bearerAuth, CrearEventoAtpInput, EventoAtpResponse, CrearEventoAtpResponse y códigos 201/400/401/403/409/500	Ruta y esquemas expuestos y verificados mediante suite automatizada route.test.ts	APROBADO	12/11/2026 13:35	16/11/2026 22:40	feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)
CP-H61-API-19	Documentación técnica del endpoint POST /api/eventos-atp en docs/api/eventos-atp.md	Documentación	API Docs	Media	Revisión de docs/api/eventos-atp.md	Lectura de sección 11 (POST /api/eventos-atp)	Reglas de negocio, ejemplos de request/response y evento Socket.io documentados	Documentación técnica exhaustiva actualizada en docs/api/eventos-atp.md	APROBADO	12/11/2026 13:33	16/11/2026 22:40	docs(eventos-atp): corregir numeracion de la seccion H61
CP-H61-API-20	Ejecución completa de la suite de regresión y análisis estático ESLint	Regresión / Calidad	Suite Completa	Alta	Entorno Node.js y Vitest configurados	npm run lint && npm test	0 errores ESLint y 100% de pruebas unitarias pasando sin regresiones	0 errores ESLint y 782/782 tests pasando en 65 suites	APROBADO	12/11/2026 13:33	16/11/2026 22:40	test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Focalizada del Módulo Eventos ATP, Socket.io, Migración 072 y OpenAPI
```bash
npx vitest run \
  src/app/api/eventos-atp/__tests__/route.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.schema.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.service.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.repository.test.ts \
  src/lib/socket/__tests__/evento-atp.test.ts \
  src/lib/db/migrations/__tests__/072_evento_atp_base.test.ts \
  src/modules/eventos-atp/__tests__/punto-critico.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola (Re-Test):**
```text
 ✓ src/lib/socket/__tests__/evento-atp.test.ts (1 test) 10ms
 ✓ src/modules/eventos-atp/__tests__/evento-atp.schema.test.ts (13 tests) 28ms
 ✓ src/modules/eventos-atp/__tests__/evento-atp.service.test.ts (7 tests) 33ms
 ✓ src/lib/db/migrations/__tests__/072_evento_atp_base.test.ts (5 tests) 23ms
 ✓ src/modules/eventos-atp/__tests__/evento-atp.repository.test.ts (11 tests) 25ms
 ✓ src/app/api/eventos-atp/__tests__/route.test.ts (9 tests) 58ms
 ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (43 tests) 77ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 308ms

 Test Files  8 passed (8)
      Tests  90 passed (90)
   Duration  2.08s
```

#### 5.1.2 Suite Completa de Regresión y Análisis Estático
```bash
npm run lint && npm test
```

**Salida de Consola (Re-Test):**
```text
✖ 12 problems (0 errors, 12 warnings)

 Test Files  65 passed (65)
      Tests  782 passed (782)
   Duration  8.63s
```

---

### 5.2 Pruebas HTTP Replicables mediante `cURL` (Servidor en `http://localhost:3001`)

#### 5.2.1 Obtención de Tokens de Sesión
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

#### 5.2.2 Caso 1: Creación Exitosa con Código Manual Alfanumérico (`ATP-2026-MAYO` — `201 Created`)
```bash
curl -s -i -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "ATP-2026-MAYO",
    "nombre": "Evento Manual Mayo",
    "descripcion": "Descripcion detallada de prueba para evento manual.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T10:00",
    "fechaTermino": "2026-05-03T18:00",
    "delegacionIds": []
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "Evento ATP registrado exitosamente.",
  "data": {
    "id": "52d1ce84-1122-4f11-981d-2be3d0288493",
    "codigo": "ATP-2026-MAYO",
    "nombre": "Evento Manual Mayo",
    "descripcion": "Descripcion detallada de prueba para evento manual.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T14:00:00.000Z",
    "fechaTermino": "2026-05-03T22:00:00.000Z",
    "estado": "ACTIVO",
    "delegaciones": [],
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "creadoEn": "2026-11-17T01:39:02.599Z",
    "actualizadoEn": "2026-11-17T01:39:02.599Z"
  }
}
```

#### 5.2.3 Caso 2: Autogeneración Correlativa Sin Colisión tras Código Manual (`ATP-2026-0001` — `BUG-H61-API-01` Subsanado)
```bash
curl -s -i -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Sistema Frontal Auto 1",
    "descripcion": "Descripcion detallada de prueba para evento automatico 1.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T10:00",
    "fechaTermino": "2026-05-03T18:00",
    "delegacionIds": []
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "Evento ATP registrado exitosamente.",
  "data": {
    "id": "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531",
    "codigo": "ATP-2026-0001",
    "nombre": "Sistema Frontal Auto 1",
    "descripcion": "Descripcion detallada de prueba para evento automatico 1.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T14:00:00.000Z",
    "fechaTermino": "2026-05-03T22:00:00.000Z",
    "estado": "ACTIVO",
    "delegaciones": [],
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "creadoEn": "2026-11-17T01:39:02.692Z",
    "actualizadoEn": "2026-11-17T01:39:02.692Z"
  }
}
```

#### 5.2.4 Caso 3: Rechazo por Código Manual Duplicado (`409 Conflict` — `BUG-H61-API-02` Subsanado)
```bash
curl -s -i -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "ATP-2026-MAYO",
    "nombre": "Duplicado Mayo",
    "descripcion": "Descripcion valida de prueba para codigo duplicado.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T10:00",
    "fechaTermino": "2026-05-03T18:00",
    "delegacionIds": []
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "Ya existe un Evento ATP registrado con el código 'ATP-2026-MAYO'."
}
```

#### 5.2.5 Caso 4: Rechazo ante Fechas de Texto o Días Inexistentes (`400 Bad Request` — `BUG-H61-API-03` Subsanado)
```bash
curl -s -i -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Evento Febrero Inexistente",
    "descripcion": "Descripcion valida de prueba para 30 de febrero.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-02-30T10:00",
    "fechaTermino": "2026-03-03T10:00",
    "delegacionIds": []
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Datos de creación de Evento ATP inválidos.",
  "errors": [
    {
      "campo": "fechaInicio",
      "mensaje": "El formato de fecha y hora no es válido"
    }
  ]
}
```

#### 5.2.6 Caso 5: Autogeneración ante Código Vacío `""` o `null` (`201 Created` — `BUG-H61-API-05` Subsanado)
```bash
curl -s -i -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "",
    "nombre": "Evento Codigo Vacio",
    "descripcion": "Descripcion valida de prueba para codigo vacio.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T10:00",
    "fechaTermino": "2026-05-03T18:00",
    "delegacionIds": []
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "Evento ATP registrado exitosamente.",
  "data": {
    "id": "65d9934c-da5d-482a-aa62-a5bb4f71d746",
    "codigo": "ATP-2026-0003",
    "nombre": "Evento Codigo Vacio",
    "descripcion": "Descripcion valida de prueba para codigo vacio.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T14:00:00.000Z",
    "fechaTermino": "2026-05-03T22:00:00.000Z",
    "estado": "ACTIVO",
    "delegaciones": [],
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "creadoEn": "2026-11-17T01:39:24.414Z",
    "actualizadoEn": "2026-11-17T01:39:24.414Z"
  }
}
```

#### 5.2.7 Caso 6: Rechazo RBAC con Mensaje Institucional Exacto (`403 Forbidden` — `BUG-H61-API-07` Subsanado)
```bash
curl -s -i -X POST http://localhost:3001/api/eventos-atp \
  -H "Authorization: Bearer $TOKEN_CC" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Intento Call Center",
    "descripcion": "Descripcion valida de prueba para RBAC.",
    "tipoAmenaza": "METEOROLOGICA",
    "nivelAlerta": "AMARILLA",
    "fechaInicio": "2026-05-01T10:00",
    "fechaTermino": "2026-05-03T18:00",
    "delegacionIds": []
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "message": "Acceso denegado. Se requiere el perfil de Administrador o el permiso eventos_atp:crear."
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (Post Re-Test)

| Criterio de Aceptación (CA) | Casos y Defectos Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Vista/formulario accesible exclusivamente para Administrador en `/gestion/admin/eventos-atp/nuevo`. | `CP-H61-API-18` | 🟢 **CUMPLIDO** | Endpoint `POST /api/eventos-atp` y esquemas Zod publicados en `/openapi.json` para consumo exclusivo del formulario frontend de Administración. |
| **CA-2:** Captura de código único (generado o manual), nombre, descripción, tipo de amenaza, nivel de alerta, fecha/hora inicio y término. | `CP-H61-API-01`, `CP-H61-API-02`, `CP-H61-API-06`, `CP-H61-API-09`, `BUG-H61-API-01`, `BUG-H61-API-02`, `BUG-H61-API-05` | 🟢 **CUMPLIDO** | Correlativo anual `ATP-AAAA-####` robusto con MAX bigint numérico y regex SQL; soporte de códigos manuales únicos, advisory locks transaccionales y captura de `SQLSTATE 23505` a `HTTP 409`. Normalización de `codigo: ""` o `null`. |
| **CA-3:** Selector múltiple de delegaciones municipales (`Norte`, `Sur`, `Costa`, `Calle Calle`), una, varias o vacío para alcance comunal. | `CP-H61-API-03`, `CP-H61-API-10`, `CP-H61-API-11`, `BUG-H61-API-06` | 🟢 **CUMPLIDO** | Admite delegaciones múltiples, individuales o vacías (alcance comunal). `verificarDelegacionesExisten` filtra por `activo = true` y se ejecuta dentro de la misma transacción Kysely. |
| **CA-4:** Validación Zod estricta: obligatoriedad de nombre, tipo de amenaza, nivel de alerta y `fecha_termino >= fecha_inicio`. | `CP-H61-API-07`, `CP-H61-API-08`, `CP-H61-API-09`, `BUG-H61-API-03` | 🟢 **CUMPLIDO** | Validación estricta con `esFechaHoraEventoAtpValida`: exige formato ISO-8601 con hora y valida calendario real (rechaza textos arbitrarios y desbordes como 30 de febrero), además de la regla `fechaTermino >= fechaInicio`. |
| **CA-5:** Persistir en `evento_atp` con estado inicial `ACTIVO` y poblar `evento_atp_delegacion` en una sola transacción PostgreSQL. | `CP-H61-API-04`, `CP-H61-API-05`, `CP-H61-API-16` | 🟢 **CUMPLIDO** | Transacción atómica en `insertarEventoAtpConDelegaciones`: ambas tablas se insertan bajo `db.transaction(trx)` con estado `ACTIVO`. Migración `072_evento_atp_base.ts` aplicada y verificada en base de datos. |
| **CA-6:** Emitir en tiempo real el evento WebSocket `evento_atp:creado` a las salas `admin`, `encargado`, `supervisor` y `mapa`. | `BUG-H61-API-04` | 🟢 **CUMPLIDO** | Emisión multi-sala focalizada mediante `ioInstance.to(salas).emit` a `sala:encargados`, `encargado`, `supervisor`, `mapa`, `admin` y `administrador`, sin broadcast global ni entregas duplicadas. |
| **CA-7:** Acceso protegido por permiso RBAC `eventos_atp:crear`, desvinculado formalmente como fallback de puntos críticos. | `CP-H61-API-13`, `CP-H61-API-14`, `CP-H61-API-15`, `CP-H61-API-17`, `BUG-H61-API-07` | 🟢 **CUMPLIDO** | Endpoint protegido por `eventos_atp:crear` / rol Administrador con mensaje institucional unificado. Fallback desvinculado de `punto-critico.service.ts` y suites unitarias verificadas al 100%. |
