# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-60 — Vincular y Desvincular Entidades a Evento ATP (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP e Incidentes (`sgrai-api`).  
> **Historia de Usuario:** HU-60 — *"Como Encargado quiero vincular y desvincular incidentes, eventos de prevención, operativos de recuperación y casos de asistencia social a una Alerta Temprana Preventiva (ATP) activa, para mantener una trazabilidad integral y clasificar todo el despliegue operativo y social desencadenado a partir de un mismo fenómeno o amenaza climática comunal."*  
> **Desarrollador Asignado:** Jonagu1  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H60-vincular-evento-atp`  
> **Commits Evaluados en la Rama:**  
> * `feat(eventos-atp): implementar creacion de eventos ATP con alcance territorial y RBAC (H61)`  
> * `test(eventos-atp): cubrir creacion transaccional y RBAC de eventos ATP (H61)`  
> * `docs(eventos-atp): documentar endpoint y QA de creacion de eventos ATP (H61)`  
> * `docs(eventos-atp): corregir numeracion de la seccion H61`  
> * `fix(db): renumerar migracion de eventos ATP a 072`  
> * `feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)`  
>  
> **Endpoints Auditados:** `GET /api/eventos-atp`, `GET /api/eventos-atp/{id}`, `POST|DELETE /api/eventos-atp/{id}/vinculos`, `GET|POST /api/eventos-atp/prevencion`, `GET|POST /api/eventos-atp/recuperacion`, `GET|POST /api/eventos-atp/asistencia-social`, `GET /api/incidentes`, `GET /api/incidentes/{id}`.  
> **Migraciones Evaluadas:** `072_evento_atp_base.ts` y `073_evento_atp_vinculacion.ts`.  
> **Fecha de Auditoría:** 18/11/2026 23:43.  
> **Estado de Certificación:** 🔴 **RECHAZADO — PENDIENTE DE SUBSANACIÓN (7 Defectos Abiertos)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Se ejecutó la auditoría estática y dinámica sobre la rama `feature/H60-vincular-evento-atp` en `sgrai-api`, incluyendo inspección de código fuente, verificación de sincronización con `develop` y secuencia de migraciones Kysely, pruebas unitarias y de ruta en Vitest, compilación de producción (`next build`), validación de tipos (`tsc --noEmit`), análisis estático (`eslint`), inspección del contrato generado en `GET /openapi.json` y pruebas en vivo con PostgreSQL 16, Redis y Socket.io sobre servidor HTTP dedicado.

El dictamen global de esta primera revisión es **RECHAZADO** debido a la detección de **7 defectos reales** (1 Crítico, 4 Altos y 2 Medios) que impiden la integración segura en `develop`. Los hallazgos principales comprenden conflictos de fusión y desfase de migraciones frente a `develop`, clasificación errónea de entidades inexistentes en `noEncontradas`, condición de carrera TOCTOU entre Eventos ATP distintos sin actualización de `actualizado_en`, restricciones RBAC inadecuadas en listados del Centro de Mando con mensajes `403` imprecisos, esquema de seguridad indefinido en OpenAPI 3.0, omisión de la sala `sala:encargados` en Socket.io y ausencia de actualización documental en `docs/api/`.

| Métrica de Calidad | Evaluación Inicial (18/11/2026) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **27** | 7 Defectos Detectados (`BUG-H60-API-01` a `07`) + 20 Casos Funcionales, RBAC, Transacción, Filtros, Migración y Socket.io (`CP-H60-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Vinculación/desvinculación en lote sobre las 4 tablas, bloqueo de ATP `FINALIZADO`, filtros `eventoAtpId`, listado/detalle ATP, RBAC `401`/`403` y reversibilidad `073` |
| **Defectos Abiertos (Open)** | **7** | **1 Crítico, 4 Altos, 2 Medios** |
| **Casos Bloqueados (Blocked)** | **0** | Entorno PostgreSQL 16 + PostGIS, Redis y servidor Next.js + Socket.io operativos |
| **Tasa de Aprobación Actual (% Pass)** | **74.1%** | Se requiere 100.0% (0 defectos abiertos) tras Re-Test para aprobar integración a `develop` |
| **Suite Focalizada H60 (Vitest)** | **8 archivos / 63 tests pass** | `vinculacion.schema.test.ts` (5), `vinculacion.service.test.ts` (10), `eventos-atp/route.test.ts` (9), `eventos-atp/[id]/route.test.ts` (5), `vinculos/route.test.ts` (7), `073_evento_atp_vinculacion.test.ts` (4), `incidente-kanban.schema.test.ts` (14), `asistencia-social.schema.test.ts` (9) |
| **Filtro Vitest `-t "(H60)"`** | **8 archivos / 39 tests pass** | 39 pruebas activas etiquetadas `(H60)` y 765 omitidas |
| **Suite Completa de la API (Vitest)** | **69 archivos / 804 tests pass** | Con mocks en repositorios/servicios; no detectó los fallos de integración real ni TOCTOU |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores** | 11 advertencias preexistentes en módulos fuera de H60 |
| **Chequeo de Tipos (`tsc --noEmit`)** | **0 errores** | Verificado tras regenerar tipos con `npx next typegen` |
| **Compilación (`npm run build`)** | **Exitosa** | Build de producción Next.js 16.3.4 (Turbopack) limpio |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H60-API-01`: Desfase Bloqueante de Rama frente a `develop` con 5 Conflictos de Fusión y Migraciones Faltantes (`035_`, `042_`, `061_`, `071_`)
* **Severidad:** **CRÍTICA** (Integración Gitflow, Pipeline de CI/CD y Secuencia de Migraciones Kysely).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts`
  * `src/modules/incidentes/incidente-kanban.repository.ts`
  * `src/modules/incidentes/incidente-kanban.schema.ts`
  * `src/modules/incidentes/incidente-kanban.service.ts`
  * `src/modules/incidentes/__tests__/incidente-kanban.service.test.ts`
  * `src/lib/db/migrations/` (ausencia de `035_permiso_misiones_terreno_verificar.ts`, `042_cuadrilla_patrulla_integrantes_vistas.ts`, `061_notificaciones_mision.ts`, `071_indices_listado_cuadrillas.ts` y fixes H61 del commit `d1a63a7`).
* **Descripción Técnica del Defecto:**  
  La rama `feature/H60-vincular-evento-atp` diverge desde el ancestro antiguo `1cbb4a2`, previo a las integraciones ya consolidadas en `develop` (H21, H22, H35, H36, H80, H85 y unificación de seguridad OpenAPI `BearerAuth`). Adicionalmente, tampoco incluye los fixes de QA de H61 (`evento-atp.repository.ts`, `evento-atp.schema.ts`, `evento-atp.service.ts` y `socket/index.ts`).
* **Pasos para Reproducir:**
  1. Ejecutar `git merge-tree --write-tree develop HEAD` sobre la rama `feature/H60-vincular-evento-atp`.
  2. Ejecutar `npm run db:migrate` contra una base de datos que ya contiene el historial de `develop`.
* **Evidencia Obtenida:**
  * `git merge-tree --write-tree develop HEAD` reporta 5 conflictos de contenido en `src/lib/openapi/index.ts` y los 4 archivos de `incidente-kanban`.
  * `npm run db:migrate` falla con código de salida `1`: `Error: corrupted migrations: previously executed migration 035_permiso_misiones_terreno_verificar is missing`.
* **Sugerencia Técnica de Corrección:**  
  Mergear `develop` (y sincronizar los fixes de H61) en `feature/H60-vincular-evento-atp`, resolviendo manualmente los 5 conflictos conservando `trazabilidadNotificacion`, `verificado` y `eventoAtpId` en `incidente-kanban`, además del esquema `BearerAuth` de `develop` en OpenAPI.

---

### `BUG-H60-API-02`: Clasificación Errónea de `noEncontradas` (Hardcodeo a `"INCIDENTE"`), Enmascaramiento Cruzado y Emisión WebSocket Sin Modificaciones en `POST`/`DELETE /vinculos`
* **Severidad:** **ALTA** (Integridad de Contrato de Respuesta y Lógica de Negocio).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivo Afectado:** `src/modules/eventos-atp/vinculacion.service.ts` (líneas 115-127, 155, 189-201 y 230).
* **Descripción Técnica del Defecto:**  
  1. En `vincularEntidadesEventoAtpService` (líneas 116-126) y `desvincularEntidadesEventoAtpService` (líneas 190-200), los cuatro arreglos (`incidenteIds`, `eventoPrevencionIds`, `recuperacionIds`, `eventoAsistenciaSocialIds`) se combinan en un solo `Set<string>` (`idsSolicitados`) y se comparan contra `idsEncontrados`. Todo UUID faltante se mapea forzando `tipo: "INCIDENTE"`:
     ```ts
     const noEncontradas = Array.from(idsSolicitados)
       .filter((id) => !idsEncontrados.has(id))
       .map((id) => ({ tipo: "INCIDENTE" as TipoEntidadVinculable, id }));
     ```
  2. Como consecuencia, cualquier ID inexistente (o dado de baja lógica en asistencia social) enviado en `eventoPrevencionIds`, `recuperacionIds` o `eventoAsistenciaSocialIds` se reporta incorrectamente como `tipo: "INCIDENTE"`. Además, si un mismo UUID válido de una tabla se envía por error dentro de otro grupo en la misma llamada, `idsEncontrados.has(id)` oculta la ausencia.
  3. Cuando el 100% de los IDs no existen (`existentes.length === 0`) o cuando en `DELETE` ninguna entidad pertenecía al evento (`desvinculadas.length === 0`), ambos métodos responden HTTP `200 OK` (`"Entidades vinculadas/desvinculadas..."`) y emiten el evento WebSocket `evento_atp:vinculado` aunque cero registros fueron modificados en base de datos.
* **Evidencia Obtenida (cURL en vivo):**  
  Al enviar `POST /api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531/vinculos` con UUIDs inexistentes en `eventoPrevencionIds`, `recuperacionIds` y `eventoAsistenciaSocialIds`, la respuesta HTTP `200 OK` devolvió:
  `"noEncontradas":[{"tipo":"INCIDENTE","id":"99999999-9999-4999-8999-999999999992"},{"tipo":"INCIDENTE","id":"99999999-9999-4999-8999-999999999991"},{"tipo":"INCIDENTE","id":"99999999-9999-4999-8999-999999999993"}]`.
* **Sugerencia Técnica de Corrección:**  
  Calcular `noEncontradas` evaluando cada arreglo contra el subconjunto de filas encontradas de su propio `TipoEntidadVinculable`, y condicionar la emisión de `emitirEventoAtpVinculado` únicamente a que exista al menos una entidad vinculada o desvinculada efectivamente.

---

### `BUG-H60-API-03`: Condición de Carrera TOCTOU entre Eventos ATP Distintos, Respuesta Falsa en `DELETE` Concurrente y Omisión de `actualizado_en`
* **Severidad:** **ALTA** (Concurrencia Transaccional e Integridad de Auditoría).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/vinculacion.repository.ts` (líneas 43-234)
  * `src/modules/eventos-atp/vinculacion.service.ts` (líneas 128-156, 202-231)
  * `src/modules/eventos-atp/asistencia-social.service.ts` (líneas 99-141)
  * `src/modules/eventos-atp/evento-prevencion.service.ts` (líneas 125-131)
  * `src/modules/eventos-atp/recuperacion.service.ts` (líneas 52-57)
* **Descripción Técnica del Defecto:**  
  1. `buscarEventoAtpParaVinculacion` aplica `.forUpdate()` sobre la fila de `evento_atp`, lo cual serializa únicamente peticiones dirigidas al mismo `eventoAtpId`. Sin embargo, `obtenerEntidadesExistentes` consulta `incidente`, `evento_prevencion`, `recuperacion` y `evento_asistencia_social` **sin `.forUpdate()`**. Ante dos solicitudes simultáneas dirigidas a **Eventos ATP distintos** (`DELETE /eventos-atp/{ATP1}/vinculos` y `POST /eventos-atp/{ATP2}/vinculos`, o dos `POST` concurrentes sobre la misma entidad), ambas transacciones leen el `evento_atp_id` anterior bajo `READ COMMITTED`, produciendo inconsistencias entre el resultado persistido, el arreglo `reasignadas`/`entidades` retornado y el evento WebSocket emitido.
  2. Ni `actualizarEventoAtpDeEntidades` ni `desvincularEntidadesDelEvento` actualizan la columna `actualizado_en` en ninguna de las cuatro tablas al modificar `evento_atp_id`.
  3. Al crear un caso de asistencia social (`crearEventoAsistenciaSocialService`), `obtenerEstadoEventoAtp` se ejecuta fuera de transacción antes del `INSERT`; de igual forma, `crearEventoPrevencionService` y `crearEventoRecuperacionService` consultan `evento_atp` sin bloqueo `.forShare()`.
* **Evidencia Obtenida (Prueba de Concurrencia HTTP y cURL):**  
  * En la ejecución simultánea `Promise.all([DELETE ATP1, POST ATP2])` sobre `INC-90523930`, las rondas concurrentes retornaron `DELETE_ATP1` con `entidades.incidentes.length = 1` (indicando desvinculación exitosa) simultáneamente con `POST_ATP2` reportando `reasignadas: ["9ee56b03-..."]` y persistiendo `evento_atp_id = c1613cd9-...` (`ATP2`).
  * Tras vincular y desvincular `INC-90523930`, `GET /api/incidentes/8eba9228-87ab-4c06-840a-b889dd0d5d5b` mantuvo `actualizadoEn: "2026-09-30T02:16:49.522Z"` sin refrescar la marca temporal.
* **Sugerencia Técnica de Corrección:**  
  Incorporar `.forUpdate()` en las lecturas de `obtenerEntidadesExistentes` (ordenando por `id` ascendente para evitar interbloqueos) y utilizar `.returning(...)` en `actualizarEventoAtpDeEntidades` y `desvincularEntidadesDelEvento` para construir la respuesta exclusivamente con las filas realmente modificadas; asignar `actualizado_en: new Date()` en los cuatro `UPDATE`; y validar `eventoAtpId` en creación dentro de transacción con `.forShare()`.

---

### `BUG-H60-API-04`: Control RBAC Restrictivo en Listados de Prevención y Recuperación (`GET`) y Mensajes `403 Forbidden` Imprecisos
* **Severidad:** **ALTA** (Seguridad RBAC y Operatividad del Centro de Mando).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-prevencion.service.ts` (líneas 265-271)
  * `src/modules/eventos-atp/recuperacion.service.ts` (líneas 246-252)
  * `src/modules/eventos-atp/vinculacion.service.ts` (líneas 93-95, 173-175)
  * `src/modules/eventos-atp/evento-atp.service.ts` (líneas 147-149, 182-184)
* **Descripción Técnica del Defecto:**  
  1. Los endpoints de listado del Centro de Mando `GET /api/eventos-atp/prevencion` y `GET /api/eventos-atp/recuperacion` exigen únicamente el permiso `eventos_atp:vincular` (`PERMISO_VINCULAR_EVENTO_ATP`). Esto impide consultar dichos listados a operadores que posean `prevencion:eventos:crear` o `recuperacion:crear` (si no tienen permiso de vinculación) y al perfil estratégico `SUPERVISOR`, a diferencia de `GET /api/incidentes` (`incidentes:kanban`) y `GET /api/eventos-atp/asistencia-social` (`asistencia_social:leer`).
  2. Las 6 llamadas a `seguridadService.validarAccesoRoles(usuarioId, [PERMISO_VINCULAR_EVENTO_ATP])` omiten el tercer parámetro `mensajeError`, devolviendo el mensaje por defecto del módulo de Seguridad (`"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."`) en lugar de indicar el permiso funcional requerido (`eventos_atp:vincular`).
* **Evidencia Obtenida (cURL en vivo):**  
  * `GET /api/eventos-atp/prevencion` y `GET /api/eventos-atp/recuperacion` con token JWT de usuario `SUPERVISOR` respondieron HTTP `403 Forbidden` con `{"message":"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."}`.
  * `POST /api/eventos-atp/{id}/vinculos` con token JWT de `CALL_CENTER` respondió HTTP `403 Forbidden` con el mismo mensaje erróneo de gestión de roles.
* **Sugerencia Técnica de Corrección:**  
  Admitir los permisos propios del módulo (`prevencion:eventos:crear` / `recuperacion:crear` / lectura operativa) junto con `PERMISO_VINCULAR_EVENTO_ATP` en `listarEventosPrevencionService` y `listarRecuperacionesService`, y pasar mensajes `mensajeError` explícitos en todas las invocaciones a `validarAccesoRoles`.

---

### `BUG-H60-API-05`: Especificación OpenAPI 3.0 Inválida (`components.securitySchemes` Indefinido), Respuestas `404`/`409` Omitidas y Cambios Ajenos en Rutas de Cuadrillas/Misiones
* **Severidad:** **ALTA** (Contrato OpenAPI 3.0 y Generación de Tipos en Frontends).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts` (líneas 175, 1770-1815, 2163-2395, 2444, 2493, 2519, 2548, 2584, 2619, 2643)
  * `src/app/openapi.json/__tests__/route.test.ts`
* **Descripción Técnica del Defecto:**  
  1. Todas las operaciones registradas para H60 (y H61) declaran `security: [{ bearerAuth: [] }]`, pero `registry.registerComponent("securitySchemes", ...)` no está invocado en `src/lib/openapi/index.ts`. En consecuencia, `GET /openapi.json` retorna `components.securitySchemes = undefined`, dejando las referencias de seguridad colgantes e inválidas según la especificación OpenAPI 3.0.
  2. La operación `POST /api/eventos-atp/asistencia-social` (líneas 1770-1815) fue modificada en H60 para validar `eventoAtpId` y responder HTTP `404` / `409` (`EventoAtpVinculacionError`), pero sus respuestas OpenAPI documentan únicamente `201`, `400`, `401`, `403` y `500`.
  3. El commit de H60 modificó secciones no relacionadas de `Cuadrillas` y `Misiones` (líneas 2163-2395) agregando cabeceras `authorization` manuales, y `src/app/openapi.json/__tests__/route.test.ts` no contiene aserciones para los nuevos endpoints de H60.
* **Evidencia Obtenida (cURL a `/openapi.json`):**  
  * Inspección directa de `GET http://localhost:3099/openapi.json`: `securitySchemes: undefined`; `paths['/api/eventos-atp/asistencia-social'].post.responses` = `['201', '400', '401', '403', '500']` mientras que `POST /api/eventos-atp/asistencia-social` con ATP `FINALIZADO` respondió `409 Conflict`.
* **Sugerencia Técnica de Corrección:**  
  Registrar `securitySchemes` (`BearerAuth` al integrar con `develop`) y alinear el nombre en todas las rutas, documentar `404` y `409` en `POST /api/eventos-atp/asistencia-social`, revertir modificaciones innecesarias fuera de alcance y ampliar `src/app/openapi.json/__tests__/route.test.ts`.

---

### `BUG-H60-API-06`: Omisión de Sala `sala:encargados` en `emitirEventoAtpVinculado`, Emisión ante No-Op y Ausencia de `try/catch` Post-Commit
* **Severidad:** **MEDIA** (Sincronización en Tiempo Real Socket.io y Resiliencia Post-Transacción).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (líneas 397-423)
  * `src/modules/eventos-atp/vinculacion.service.ts` (líneas 155 y 230)
* **Descripción Técnica del Defecto:**  
  1. `emitirEventoAtpVinculado` emite únicamente a las salas `["encargado", "supervisor", "mapa"]`, omitiendo `"sala:encargados"`, que es la sala operativa estándar del Encargado documentada en `docs/api/incidentes.md:93` y empleada por `notificarIncidenteCreado`, `notificarIncidenteActualizado`, `emitirEventoAtpCreado`, `emitirRecuperacionCreada`, `emitirEventoPrevencionCreado`, `emitirAsistenciaSocialCreada`, `notificarPatrullaActualizada` y `notificarMisionAsignada`.
  2. `vincularEntidadesEventoAtpService` y `desvincularEntidadesEventoAtpService` llaman a `emitirEventoAtpVinculado(resultado)` sin bloque `try/catch` (exponiendo la petición a HTTP `500` tras un `COMMIT` exitoso si `ioInstance` arroja una excepción síncrona) y lo invocan aun cuando cero entidades resultaron afectadas.
* **Evidencia Obtenida (Cliente Socket.io en vivo):**  
  Al ejecutar `POST /api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531/vinculos`, los sockets suscritos a `encargado`, `supervisor` y `mapa` recibieron `evento_atp:vinculado`, mientras que el socket suscrito a `sala:encargados` finalizó en timeout sin recibir el evento.
* **Sugerencia Técnica de Corrección:**  
  Incorporar `"sala:encargados"` en `salas` dentro de `emitirEventoAtpVinculado`, envolver la emisión en `try/catch` en `vinculacion.service.ts` y emitir solo cuando exista al menos una entidad efectivamente vinculada o desvinculada.

---

### `BUG-H60-API-07`: Documentación `docs/api/` Desactualizada, Consulta N+1 en `listarEventosAtpService`, Formato `400` Inconsistente en `/vinculos` y Brechas de Cobertura en Tests
* **Severidad:** **MEDIA** (Mantenibilidad, Rendimiento y Estándares del Repositorio).
* **Estado:** 🔴 **`ABIERTO` (Rechazado en Code Review — 18/11/2026)**.
* **Archivos Afectados:**
  * `docs/api/eventos-atp.md` y `docs/api/incidentes.md`
  * `src/modules/eventos-atp/evento-atp.service.ts` (líneas 159-161) y `src/modules/eventos-atp/evento-atp.repository.ts` (líneas 332-366)
  * `src/app/api/eventos-atp/[id]/vinculos/route.ts` (líneas 50-56, 74-76)
  * `src/modules/eventos-atp/__tests__/evento-atp.service.test.ts`, `evento-atp.repository.test.ts`, `evento-prevencion.test.ts`, `recuperacion.service.test.ts`
* **Descripción Técnica del Defecto:**  
  1. Ni `docs/api/eventos-atp.md` ni `docs/api/incidentes.md` fueron actualizados para documentar los nuevos endpoints (`GET /api/eventos-atp`, `GET /api/eventos-atp/{id}`, `POST|DELETE /api/eventos-atp/{id}/vinculos`, `GET /api/eventos-atp/prevencion`, `GET /api/eventos-atp/recuperacion`), el filtro `eventoAtpId`, el evento `evento_atp:vinculado` o la transición de catálogo `CERRADO -> FINALIZADO`.
  2. `listarEventosAtpService` ejecuta `contarVinculosEventoAtp(evento.id)` en bucle (4 consultas SQL por cada fila retornada; hasta 400 consultas por página con `limit=100`).
  3. `POST` y `DELETE /api/eventos-atp/[id]/vinculos` retornan `{ message }` en errores Zod `400` sin incluir el arreglo estándar `errors: [{ campo, mensaje }]` usado en el resto de la API.
  4. Faltan pruebas automatizadas para `listarEventosAtpService`, `obtenerEventoAtpDetalleService`, `vinculacion.repository.ts`, `emitirEventoAtpVinculado`, `GET /api/eventos-atp/prevencion`, `GET /api/eventos-atp/recuperacion` y filtros `eventoAtpId` en `GET /api/incidentes`.
* **Sugerencia Técnica de Corrección:**  
  Actualizar `docs/api/eventos-atp.md` y `docs/api/incidentes.md`, reemplazar el conteo N+1 por agregación agrupada (`GROUP BY evento_atp_id`), estandarizar `errors` en respuestas `400` de `/vinculos` y añadir pruebas unitarias/ruta para los módulos descubiertos.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H60-API-01` | Desfase bloqueante de rama frente a develop con 5 conflictos de fusión y migraciones faltantes (035_, 042_, 061_, 071_) | Integración / Migraciones | Git / Base de Datos | Crítica | Rama `feature/H60-vincular-evento-atp` comparada contra `develop` y BD con migraciones de `develop` | `git merge-tree --write-tree develop HEAD` y `npm run db:migrate` | Fusión limpia sin conflictos y migración `073` ejecutada sin errores sobre BD `develop` | 5 conflictos en `openapi/index.ts` e `incidente-kanban.*`; `db:migrate` aborta por migración `035` faltante | ABIERTO | 18/11/2026 23:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H60-API-02` | Clasificación errónea de noEncontradas hardcodeada a INCIDENTE y emisión WebSocket sin entidades modificadas | Funcional / Contrato | Service / API Live | Alta | Evento ATP `ACTIVO` (`9ee56b03-c2ad-4fdf-9fc1-012c84d6c531`) y UUIDs inexistentes por tipo | `POST /api/eventos-atp/9ee56b03-.../vinculos` con `eventoPrevencionIds`, `recuperacionIds` y `eventoAsistenciaSocialIds` inexistentes | Reportar cada ID con su `tipo` real (`EVENTO_PREVENCION`, `RECUPERACION`, `EVENTO_ASISTENCIA_SOCIAL`) y no emitir WS ante 0 cambios | Retorna los 3 IDs con `"tipo": "INCIDENTE"`, HTTP `200 OK` y emite `evento_atp:vinculado` con 0 cambios | ABIERTO | 18/11/2026 23:39 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H60-API-03` | Condición de carrera TOCTOU entre Eventos ATP distintos, respuesta falsa en DELETE concurrente y omisión de actualizado_en | Concurrencia / Auditoría | Repository / API Live | Alta | Incidente `INC-90523930` vinculado a `ATP1` (`9ee56b03-...`) y segundo evento `ATP2` (`c1613cd9-...`) `ACTIVO` | `Promise.all` con `DELETE /ATP1/vinculos` y `POST /ATP2/vinculos` sobre `INC-90523930`; consulta `GET /api/incidentes/{id}` | Serialización mediante `.forUpdate()` por entidad, `entidades` consistente con filas mutadas y `actualizado_en` actualizado | `DELETE_ATP1` reporta `entCount: 1` mientras `INC1` queda en `ATP2`; `actualizadoEn` permanece inalterado (`2026-09-30T02:16:49.522Z`) | ABIERTO | 18/11/2026 23:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H60-API-04` | Control RBAC restrictivo en listados de prevención y recuperación y mensajes 403 imprecisos | Seguridad / RBAC | Service / API Live | Alta | Usuario `SUPERVISOR` autenticado y usuario `CALL_CENTER` sin permiso `eventos_atp:vincular` | `GET /api/eventos-atp/prevencion` y `/recuperacion` con JWT `SUPERVISOR`; `POST /vinculos` con JWT `CALL_CENTER` | Permitir consulta operativa a roles con lectura/creación de módulo y retornar mensaje `403` citando `eventos_atp:vincular` | `SUPERVISOR` recibe `403` y ambos roles reciben mensaje erróneo `"permisos de gestión de roles"` | ABIERTO | 18/11/2026 23:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H60-API-05` | Especificación OpenAPI 3.0 inválida con securitySchemes undefined y respuestas 404/409 omitidas en asistencia social | Contrato API / OpenAPI | OpenAPI Spec | Alta | Servidor activo exponiendo `GET /openapi.json` | `GET /openapi.json` inspeccionando `components.securitySchemes` y `/api/eventos-atp/asistencia-social` | `securitySchemes` definido y alineado con `security`, más respuestas `404` y `409` en `POST /asistencia-social` | `components.securitySchemes` es `undefined` y `POST /asistencia-social` solo documenta `201, 400, 401, 403, 500` | ABIERTO | 18/11/2026 23:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H60-API-06` | Omisión de sala sala:encargados en emitirEventoAtpVinculado y ausencia de try/catch post-commit | Tiempo Real / Resiliencia | Socket.io / Service | Media | Clientes Socket.io conectados a `encargado`, `sala:encargados`, `supervisor` y `mapa` | `POST /api/eventos-atp/9ee56b03-.../vinculos` con `{"incidenteIds":["8eba9228-..."]}` | Todas las salas de mando incluyendo `sala:encargados` reciben `evento_atp:vinculado` dentro de bloque resiliente `try/catch` | `encargado`, `supervisor` y `mapa` reciben el evento; `sala:encargados` no lo recibe (timeout) y falta `try/catch` | ABIERTO | 18/11/2026 23:42 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H60-API-07` | Documentación docs/api desactualizada, consulta N+1 en listado ATP, formato 400 sin errors y brechas en tests | Documentación / Rendimiento | Docs / Service / Tests | Media | Revisión de `docs/api/`, `evento-atp.service.ts`, `vinculos/route.ts` y suites Vitest | Inspección de `docs/api/eventos-atp.md`, `incidentes.md`, `contarVinculosEventoAtp` y tests de módulo | Documentación actualizada, conteo agregado sin N+1, `{ message, errors }` en `400` y cobertura de listado/detalle/repositorios | `docs/api/` sin cambios de H60, N+1 de 4*N queries en `listarEventosAtpService`, `400` sin `errors` y falta de tests | ABIERTO | 18/11/2026 23:43 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H60-API-01` | Listado de Eventos ATP filtrando exclusivamente estado ACTIVO para el selector (CA-2) | Funcional / Consulta | API Live / Integration | Crítica | Eventos ATP registrados en estados `ACTIVO`, `FINALIZADO` y `CANCELADO` | `GET /api/eventos-atp?estado=ACTIVO` con `Authorization: Bearer <token_encargado>` | HTTP `200 OK` retornando únicamente los 5 eventos en estado `ACTIVO` y excluyendo `FINALIZADO`/`CANCELADO` | HTTP `200 OK` retornando exclusivamente los 5 registros con `estado: "ACTIVO"` y `meta.total: 5` | APROBADO | 18/11/2026 23:38 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-02` | Búsqueda textual y paginación en catálogo de Eventos ATP | Funcional / Consulta | API Live | Media | Evento `ATP-2026-MAYO` registrado en BD | `GET /api/eventos-atp?busqueda=MAYO` con `Authorization: Bearer <token_encargado>` | HTTP `200 OK` filtrando por coincidencia parcial `ilike` sobre código o nombre | HTTP `200 OK` retornando únicamente `ATP-2026-MAYO` (`total: 1`) | APROBADO | 18/11/2026 23:42 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-03` | Consulta de detalle de Evento ATP con vínculos agrupados y totalVinculados (CA-3) | Funcional / Consulta | API Live | Alta | Evento ATP `9ee56b03-...` con 4 entidades vinculadas (una por cada tipo) | `GET /api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531` con `Authorization: Bearer <token_encargado>` | HTTP `200 OK` con `data.vinculos` agrupado en 4 arreglos y `totalVinculados: 4` | HTTP `200 OK` exponiendo las 4 listas pobladas y `totalVinculados: 4` | APROBADO | 18/11/2026 23:38 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-04` | Vinculación en lote simultánea de incidente, prevención, recuperación y asistencia social (CA-3, CA-4) | Funcional / Transaccional | API Live / BD | Crítica | Evento ATP `ACTIVO` y 1 registro de cada una de las 4 tablas | `POST /api/eventos-atp/9ee56b03-.../vinculos` con `incidenteIds`, `eventoPrevencionIds`, `recuperacionIds` y `eventoAsistenciaSocialIds` | HTTP `200 OK`, `accion: "VINCULADO"` y persistencia atómica de `evento_atp_id` en las 4 tablas | HTTP `200 OK` vinculando las 4 entidades atómicamente en `db.transaction()` | APROBADO | 18/11/2026 23:38 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-05` | Reasignación de entidad vinculada previamente a otro Evento ATP reportada en reasignadas | Funcional / Negocio | API Live | Alta | `INC-90523930` vinculado previamente a `9ee56b03-...` (`ATP1`) | `POST /api/eventos-atp/c1613cd9-.../vinculos` con `{"incidenteIds":["8eba9228-..."]}` | HTTP `200 OK` actualizando `evento_atp_id` hacia `ATP2` e informando `eventoAtpIdAnterior` en `reasignadas` | HTTP `200 OK` con `reasignadas[0].eventoAtpIdAnterior: "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531"` | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-06` | Desvinculación de entidades estableciendo evento_atp_id = NULL sin destruir el registro (CA-5) | Funcional / Integridad | API Live / BD | Crítica | Entidades vinculadas al Evento ATP `9ee56b03-...` y `c1613cd9-...` | `DELETE /api/eventos-atp/c1613cd9-.../vinculos` con `{"incidenteIds":["8eba9228-..."]}` | HTTP `200 OK` con `accion: "DESVINCULADO"`, `evento_atp_id = NULL` y entidad intacta en BD | HTTP `200 OK` y `GET /api/incidentes/8eba9228-...` retorna `eventoAtpId: null` con datos preservados | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-07` | Preservación de vínculos pertenecientes a otro Evento ATP reportados en noDesvinculadas | Funcional / Negocio | API Live | Alta | `INC-90523930` vinculado a `ATP2` mientras `PREV1`, `REC1` y `ASIS1` pertenecen a `ATP1` | `DELETE /api/eventos-atp/9ee56b03-.../vinculos` enviando las 4 entidades | Desvincula solo las de `ATP1` y reporta `INC-90523930` en `noDesvinculadas` sin alterar su vínculo a `ATP2` | HTTP `200 OK`: desvinculó `PREV1`, `REC1`, `ASIS1` y reportó `INC-90523930` en `noDesvinculadas` | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-08` | Bloqueo HTTP 409 Conflict al intentar vincular entidades a un Evento ATP en estado FINALIZADO | Regla de Negocio | API Live / Service | Crítica | Evento ATP `ATP-2026-FIN1` (`50000000-...0099`) en estado `FINALIZADO` | `POST /api/eventos-atp/50000000-0000-4000-8000-000000000099/vinculos` con `{"incidenteIds":["8eba9228-..."]}` | HTTP `409 Conflict` impidiendo nuevas vinculaciones sobre eventos finalizados | HTTP `409 Conflict`: `"El Evento ATP 'ATP-2026-FIN1' se encuentra en estado FINALIZADO y no admite nuevas vinculaciones."` | APROBADO | 18/11/2026 23:38 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-09` | Bloqueo HTTP 409 Conflict al crear recuperación o asistencia social vinculada a Evento ATP FINALIZADO | Regla de Negocio | API Live | Alta | Evento ATP `ATP-2026-FIN1` en estado `FINALIZADO` | `POST /api/eventos-atp/recuperacion` y `POST /api/eventos-atp/asistencia-social` con `eventoAtpId: "50000000-...0099"` | HTTP `409 Conflict` rechazando la vinculación al crear la entidad | HTTP `409 Conflict` en ambos endpoints: `"El Evento ATP 'ATP-2026-FIN1' no está ACTIVO y no admite vinculaciones."` | APROBADO | 18/11/2026 23:42 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-10` | Filtro rápido por eventoAtpId en tablero Kanban de incidentes (CA-6) | Funcional / Filtro | API Live | Crítica | Incidentes vinculados y no vinculados en BD | `GET /api/incidentes?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531` | HTTP `200 OK` retornando exclusivamente incidentes asociados al Evento ATP solicitado | HTTP `200 OK` con `meta.total: 1` y `data[0].eventoAtpId === "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531"` | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-11` | Filtro por eventoAtpId en listado de eventos de prevención (CA-6) | Funcional / Filtro | API Live | Alta | `PREV-2026-0001` vinculado al Evento ATP `9ee56b03-...` | `GET /api/eventos-atp/prevencion?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531` | HTTP `200 OK` filtrando eventos de prevención por `eventoAtpId` | HTTP `200 OK` con `total: 1` y `data[0].codigo: "PREV-2026-0001"` | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-12` | Filtro por eventoAtpId en listado de operativos de recuperación (CA-6) | Funcional / Filtro | API Live | Alta | `REC-2026-0001` vinculado al Evento ATP `9ee56b03-...` | `GET /api/eventos-atp/recuperacion?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531` | HTTP `200 OK` filtrando operativos de recuperación por `eventoAtpId` | HTTP `200 OK` con `total: 1` y `data[0].codigo: "REC-2026-0001"` | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-13` | Filtro por eventoAtpId en listado de eventos de asistencia social (CA-6) | Funcional / Filtro | API Live | Alta | `AS-2026-0001` vinculado al Evento ATP `9ee56b03-...` | `GET /api/eventos-atp/asistencia-social?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531` | HTTP `200 OK` filtrando casos de asistencia social por `eventoAtpId` | HTTP `200 OK` con `total: 1` y `data[0].codigo: "AS-2026-0001"` | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-14` | Exposición de eventoAtpId en detalle de incidente GET /api/incidentes/{id} (CA-1) | Funcional / Contrato | API Live / Schema | Alta | Incidente existente en base de datos | `GET /api/incidentes/8eba9228-87ab-4c06-840a-b889dd0d5d5b` | HTTP `200 OK` incluyendo la propiedad `eventoAtpId` (`UUID` o `null`) | HTTP `200 OK` con `"eventoAtpId": null` tras desvincular | APROBADO | 18/11/2026 23:39 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-15` | Emisión WebSocket evento_atp:vinculado a salas encargado, supervisor y mapa (CA-7) | Tiempo Real / Socket.io | Integración Live | Crítica | Servidor Socket.io activo y clientes unidos a `encargado`, `supervisor` y `mapa` | `POST /api/eventos-atp/9ee56b03-.../vinculos` con `{"incidenteIds":["8eba9228-..."]}` | Los clientes en `encargado`, `supervisor` y `mapa` reciben el evento `evento_atp:vinculado` | Confirmado en vivo: `encargado`, `supervisor` y `mapa` recibieron `evento_atp:vinculado` | APROBADO | 18/11/2026 23:42 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-16` | Rechazo HTTP 401 Unauthorized sin token Bearer JWT en rutas protegidas de H60 (CA-8) | Seguridad / Auth | API Live / Route | Crítica | Petición sin cabecera `Authorization` | `POST /api/eventos-atp/9ee56b03-.../vinculos` sin headers de autenticación | HTTP `401 Unauthorized` rechazando acceso anónimo | HTTP `401 Unauthorized`: `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | APROBADO | 18/11/2026 23:38 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-17` | Rechazo HTTP 403 Forbidden para usuario autenticado sin permiso eventos_atp:vincular (CA-8) | Seguridad / RBAC | API Live / Vitest | Crítica | Usuario `callcenter@valdivia.cl` sin permiso `eventos_atp:vincular` | `POST /api/eventos-atp/9ee56b03-.../vinculos` con Bearer de Call Center | HTTP `403 Forbidden` denegando la operación de vinculación | HTTP `403 Forbidden` rechazando al usuario no autorizado | APROBADO | 18/11/2026 23:38 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-18` | Validación Zod HTTP 400 Bad Request para UUID inválido o payload vacío sin entidades | Validación / Borde | API Live / Schema | Media | Token Encargado válido | `POST /vinculos` con `{}`; `GET /api/eventos-atp/no-es-uuid`; `GET /api/incidentes?eventoAtpId=invalido` | HTTP `400 Bad Request` rechazando payload sin entidades y UUIDs malformados | HTTP `400 Bad Request` en los tres escenarios | APROBADO | 18/11/2026 23:42 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-19` | Rechazo HTTP 404 Not Found cuando el Evento ATP indicado no existe | Manejo de Errores | API Live | Alta | UUID de Evento ATP inexistente (`50000000-0000-4000-8000-999999999999`) | `GET /api/eventos-atp/50000000-...9999` y `POST /api/eventos-atp/50000000-...9999/vinculos` | HTTP `404 Not Found` indicando que el Evento ATP no existe | HTTP `404 Not Found`: `"El Evento ATP '50000000-0000-4000-8000-999999999999' no existe en el sistema."` | APROBADO | 18/11/2026 23:42 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |
| `CP-H60-API-20` | Ejecución limpia y reversible de migración 073 en PostgreSQL 16 y suites Vitest de H60 | Integridad BD / Automatización | Migración / Vitest | Crítica | Base de datos limpia con migraciones `001`–`072` y entorno Vitest | `npm run db:migrate` en BD limpia, `down(db)`/`up(db)` de `073` y suites Vitest H60 | Migración `073` reversible y suites Vitest sin fallos (`63/63` H60; `804/804` API completa) | `073 down ok`, `073 re-up ok`, `63/63` tests H60 y `804/804` tests globales aprobados | APROBADO | 18/11/2026 23:43 | — | feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H60-API-01	Desfase bloqueante de rama frente a develop con 5 conflictos de fusión y migraciones faltantes (035_, 042_, 061_, 071_)	Integración / Migraciones	Git / Base de Datos	Crítica	Rama feature/H60-vincular-evento-atp comparada contra develop y BD con migraciones de develop	git merge-tree --write-tree develop HEAD y npm run db:migrate	Fusión limpia sin conflictos y migración 073 ejecutada sin errores sobre BD develop	5 conflictos en openapi/index.ts e incidente-kanban.*; db:migrate aborta por migración 035 faltante	ABIERTO	18/11/2026 23:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H60-API-02	Clasificación errónea de noEncontradas hardcodeada a INCIDENTE y emisión WebSocket sin entidades modificadas	Funcional / Contrato	Service / API Live	Alta	Evento ATP ACTIVO (9ee56b03-c2ad-4fdf-9fc1-012c84d6c531) y UUIDs inexistentes por tipo	POST /api/eventos-atp/9ee56b03-.../vinculos con eventoPrevencionIds, recuperacionIds y eventoAsistenciaSocialIds inexistentes	Reportar cada ID con su tipo real (EVENTO_PREVENCION, RECUPERACION, EVENTO_ASISTENCIA_SOCIAL) y no emitir WS ante 0 cambios	Retorna los 3 IDs con "tipo": "INCIDENTE", HTTP 200 OK y emite evento_atp:vinculado con 0 cambios	ABIERTO	18/11/2026 23:39	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H60-API-03	Condición de carrera TOCTOU entre Eventos ATP distintos, respuesta falsa en DELETE concurrente y omisión de actualizado_en	Concurrencia / Auditoría	Repository / API Live	Alta	Incidente INC-90523930 vinculado a ATP1 (9ee56b03-...) y segundo evento ATP2 (c1613cd9-...) ACTIVO	Promise.all con DELETE /ATP1/vinculos y POST /ATP2/vinculos sobre INC-90523930; consulta GET /api/incidentes/{id}	Serialización mediante .forUpdate() por entidad, entidades consistente con filas mutadas y actualizado_en actualizado	DELETE_ATP1 reporta entCount: 1 mientras INC1 queda en ATP2; actualizadoEn permanece inalterado (2026-09-30T02:16:49.522Z)	ABIERTO	18/11/2026 23:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H60-API-04	Control RBAC restrictivo en listados de prevención y recuperación y mensajes 403 imprecisos	Seguridad / RBAC	Service / API Live	Alta	Usuario SUPERVISOR autenticado y usuario CALL_CENTER sin permiso eventos_atp:vincular	GET /api/eventos-atp/prevencion y /recuperacion con JWT SUPERVISOR; POST /vinculos con JWT CALL_CENTER	Permitir consulta operativa a roles con lectura/creación de módulo y retornar mensaje 403 citando eventos_atp:vincular	SUPERVISOR recibe 403 y ambos roles reciben mensaje erróneo "permisos de gestión de roles"	ABIERTO	18/11/2026 23:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H60-API-05	Especificación OpenAPI 3.0 inválida con securitySchemes undefined y respuestas 404/409 omitidas en asistencia social	Contrato API / OpenAPI	OpenAPI Spec	Alta	Servidor activo exponiendo GET /openapi.json	GET /openapi.json inspeccionando components.securitySchemes y /api/eventos-atp/asistencia-social	securitySchemes definido y alineado con security, más respuestas 404 y 409 en POST /asistencia-social	components.securitySchemes es undefined y POST /asistencia-social solo documenta 201, 400, 401, 403, 500	ABIERTO	18/11/2026 23:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H60-API-06	Omisión de sala sala:encargados en emitirEventoAtpVinculado y ausencia de try/catch post-commit	Tiempo Real / Resiliencia	Socket.io / Service	Media	Clientes Socket.io conectados a encargado, sala:encargados, supervisor y mapa	POST /api/eventos-atp/9ee56b03-.../vinculos con {"incidenteIds":["8eba9228-..."]}	Todas las salas de mando incluyendo sala:encargados reciben evento_atp:vinculado dentro de bloque resiliente try/catch	encargado, supervisor y mapa reciben el evento; sala:encargados no lo recibe (timeout) y falta try/catch	ABIERTO	18/11/2026 23:42	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H60-API-07	Documentación docs/api desactualizada, consulta N+1 en listado ATP, formato 400 sin errors y brechas en tests	Documentación / Rendimiento	Docs / Service / Tests	Media	Revisión de docs/api/, evento-atp.service.ts, vinculos/route.ts y suites Vitest	Inspección de docs/api/eventos-atp.md, incidentes.md, contarVinculosEventoAtp y tests de módulo	Documentación actualizada, conteo agregado sin N+1, { message, errors } en 400 y cobertura de listado/detalle/repositorios	docs/api/ sin cambios de H60, N+1 de 4*N queries en listarEventosAtpService, 400 sin errors y falta de tests	ABIERTO	18/11/2026 23:43	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H60-API-01	Listado de Eventos ATP filtrando exclusivamente estado ACTIVO para el selector (CA-2)	Funcional / Consulta	API Live / Integration	Crítica	Eventos ATP registrados en estados ACTIVO, FINALIZADO y CANCELADO	GET /api/eventos-atp?estado=ACTIVO con Authorization: Bearer <token_encargado>	HTTP 200 OK retornando únicamente los 5 eventos en estado ACTIVO y excluyendo FINALIZADO/CANCELADO	HTTP 200 OK retornando exclusivamente los 5 registros con estado: "ACTIVO" y meta.total: 5	APROBADO	18/11/2026 23:38	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-02	Búsqueda textual y paginación en catálogo de Eventos ATP	Funcional / Consulta	API Live	Media	Evento ATP-2026-MAYO registrado en BD	GET /api/eventos-atp?busqueda=MAYO con Authorization: Bearer <token_encargado>	HTTP 200 OK filtrando por coincidencia parcial ilike sobre código o nombre	HTTP 200 OK retornando únicamente ATP-2026-MAYO (total: 1)	APROBADO	18/11/2026 23:42	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-03	Consulta de detalle de Evento ATP con vínculos agrupados y totalVinculados (CA-3)	Funcional / Consulta	API Live	Alta	Evento ATP 9ee56b03-... con 4 entidades vinculadas (una por cada tipo)	GET /api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531 con Authorization: Bearer <token_encargado>	HTTP 200 OK con data.vinculos agrupado en 4 arreglos y totalVinculados: 4	HTTP 200 OK exponiendo las 4 listas pobladas y totalVinculados: 4	APROBADO	18/11/2026 23:38	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-04	Vinculación en lote simultánea de incidente, prevención, recuperación y asistencia social (CA-3, CA-4)	Funcional / Transaccional	API Live / BD	Crítica	Evento ATP ACTIVO y 1 registro de cada una de las 4 tablas	POST /api/eventos-atp/9ee56b03-.../vinculos con incidenteIds, eventoPrevencionIds, recuperacionIds y eventoAsistenciaSocialIds	HTTP 200 OK, accion: "VINCULADO" y persistencia atómica de evento_atp_id en las 4 tablas	HTTP 200 OK vinculando las 4 entidades atómicamente en db.transaction()	APROBADO	18/11/2026 23:38	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-05	Reasignación de entidad vinculada previamente a otro Evento ATP reportada en reasignadas	Funcional / Negocio	API Live	Alta	INC-90523930 vinculado previamente a 9ee56b03-... (ATP1)	POST /api/eventos-atp/c1613cd9-.../vinculos con {"incidenteIds":["8eba9228-..."]}	HTTP 200 OK actualizando evento_atp_id hacia ATP2 e informando eventoAtpIdAnterior en reasignadas	HTTP 200 OK con reasignadas[0].eventoAtpIdAnterior: "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531"	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-06	Desvinculación de entidades estableciendo evento_atp_id = NULL sin destruir el registro (CA-5)	Funcional / Integridad	API Live / BD	Crítica	Entidades vinculadas al Evento ATP 9ee56b03-... y c1613cd9-...	DELETE /api/eventos-atp/c1613cd9-.../vinculos con {"incidenteIds":["8eba9228-..."]}	HTTP 200 OK con accion: "DESVINCULADO", evento_atp_id = NULL y entidad intacta en BD	HTTP 200 OK y GET /api/incidentes/8eba9228-... retorna eventoAtpId: null con datos preservados	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-07	Preservación de vínculos pertenecientes a otro Evento ATP reportados en noDesvinculadas	Funcional / Negocio	API Live	Alta	INC-90523930 vinculado a ATP2 mientras PREV1, REC1 y ASIS1 pertenecen a ATP1	DELETE /api/eventos-atp/9ee56b03-.../vinculos enviando las 4 entidades	Desvincula solo las de ATP1 y reporta INC-90523930 en noDesvinculadas sin alterar su vínculo a ATP2	HTTP 200 OK: desvinculó PREV1, REC1, ASIS1 y reportó INC-90523930 en noDesvinculadas	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-08	Bloqueo HTTP 409 Conflict al intentar vincular entidades a un Evento ATP en estado FINALIZADO	Regla de Negocio	API Live / Service	Crítica	Evento ATP ATP-2026-FIN1 (50000000-...0099) en estado FINALIZADO	POST /api/eventos-atp/50000000-0000-4000-8000-000000000099/vinculos con {"incidenteIds":["8eba9228-..."]}	HTTP 409 Conflict impidiendo nuevas vinculaciones sobre eventos finalizados	HTTP 409 Conflict: "El Evento ATP 'ATP-2026-FIN1' se encuentra en estado FINALIZADO y no admite nuevas vinculaciones."	APROBADO	18/11/2026 23:38	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-09	Bloqueo HTTP 409 Conflict al crear recuperación o asistencia social vinculada a Evento ATP FINALIZADO	Regla de Negocio	API Live	Alta	Evento ATP ATP-2026-FIN1 en estado FINALIZADO	POST /api/eventos-atp/recuperacion y POST /api/eventos-atp/asistencia-social con eventoAtpId: "50000000-...0099"	HTTP 409 Conflict rechazando la vinculación al crear la entidad	HTTP 409 Conflict en ambos endpoints: "El Evento ATP 'ATP-2026-FIN1' no está ACTIVO y no admite vinculaciones."	APROBADO	18/11/2026 23:42	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-10	Filtro rápido por eventoAtpId en tablero Kanban de incidentes (CA-6)	Funcional / Filtro	API Live	Crítica	Incidentes vinculados y no vinculados en BD	GET /api/incidentes?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531	HTTP 200 OK retornando exclusivamente incidentes asociados al Evento ATP solicitado	HTTP 200 OK con meta.total: 1 y data[0].eventoAtpId === "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531"	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-11	Filtro por eventoAtpId en listado de eventos de prevención (CA-6)	Funcional / Filtro	API Live	Alta	PREV-2026-0001 vinculado al Evento ATP 9ee56b03-...	GET /api/eventos-atp/prevencion?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531	HTTP 200 OK filtrando eventos de prevención por eventoAtpId	HTTP 200 OK con total: 1 y data[0].codigo: "PREV-2026-0001"	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-12	Filtro por eventoAtpId en listado de operativos de recuperación (CA-6)	Funcional / Filtro	API Live	Alta	REC-2026-0001 vinculado al Evento ATP 9ee56b03-...	GET /api/eventos-atp/recuperacion?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531	HTTP 200 OK filtrando operativos de recuperación por eventoAtpId	HTTP 200 OK con total: 1 y data[0].codigo: "REC-2026-0001"	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-13	Filtro por eventoAtpId en listado de eventos de asistencia social (CA-6)	Funcional / Filtro	API Live	Alta	AS-2026-0001 vinculado al Evento ATP 9ee56b03-...	GET /api/eventos-atp/asistencia-social?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531	HTTP 200 OK filtrando casos de asistencia social por eventoAtpId	HTTP 200 OK con total: 1 y data[0].codigo: "AS-2026-0001"	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-14	Exposición de eventoAtpId en detalle de incidente GET /api/incidentes/{id} (CA-1)	Funcional / Contrato	API Live / Schema	Alta	Incidente existente en base de datos	GET /api/incidentes/8eba9228-87ab-4c06-840a-b889dd0d5d5b	HTTP 200 OK incluyendo la propiedad eventoAtpId (UUID o null)	HTTP 200 OK con "eventoAtpId": null tras desvincular	APROBADO	18/11/2026 23:39	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-15	Emisión WebSocket evento_atp:vinculado a salas encargado, supervisor y mapa (CA-7)	Tiempo Real / Socket.io	Integración Live	Crítica	Servidor Socket.io activo y clientes unidos a encargado, supervisor y mapa	POST /api/eventos-atp/9ee56b03-.../vinculos con {"incidenteIds":["8eba9228-..."]}	Los clientes en encargado, supervisor y mapa reciben el evento evento_atp:vinculado	Confirmado en vivo: encargado, supervisor y mapa recibieron evento_atp:vinculado	APROBADO	18/11/2026 23:42	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-16	Rechazo HTTP 401 Unauthorized sin token Bearer JWT en rutas protegidas de H60 (CA-8)	Seguridad / Auth	API Live / Route	Crítica	Petición sin cabecera Authorization	POST /api/eventos-atp/9ee56b03-.../vinculos sin headers de autenticación	HTTP 401 Unauthorized rechazando acceso anónimo	HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>."	APROBADO	18/11/2026 23:38	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-17	Rechazo HTTP 403 Forbidden para usuario autenticado sin permiso eventos_atp:vincular (CA-8)	Seguridad / RBAC	API Live / Vitest	Crítica	Usuario callcenter@valdivia.cl sin permiso eventos_atp:vincular	POST /api/eventos-atp/9ee56b03-.../vinculos con Bearer de Call Center	HTTP 403 Forbidden denegando la operación de vinculación	HTTP 403 Forbidden rechazando al usuario no autorizado	APROBADO	18/11/2026 23:38	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-18	Validación Zod HTTP 400 Bad Request para UUID inválido o payload vacío sin entidades	Validación / Borde	API Live / Schema	Media	Token Encargado válido	POST /vinculos con {}; GET /api/eventos-atp/no-es-uuid; GET /api/incidentes?eventoAtpId=invalido	HTTP 400 Bad Request rechazando payload sin entidades y UUIDs malformados	HTTP 400 Bad Request en los tres escenarios	APROBADO	18/11/2026 23:42	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-19	Rechazo HTTP 404 Not Found cuando el Evento ATP indicado no existe	Manejo de Errores	API Live	Alta	UUID de Evento ATP inexistente (50000000-0000-4000-8000-999999999999)	GET /api/eventos-atp/50000000-...9999 y POST /api/eventos-atp/50000000-...9999/vinculos	HTTP 404 Not Found indicando que el Evento ATP no existe	HTTP 404 Not Found: "El Evento ATP '50000000-0000-4000-8000-999999999999' no existe en el sistema."	APROBADO	18/11/2026 23:42	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
CP-H60-API-20	Ejecución limpia y reversible de migración 073 en PostgreSQL 16 y suites Vitest de H60	Integridad BD / Automatización	Migración / Vitest	Crítica	Base de datos limpia con migraciones 001–072 y entorno Vitest	npm run db:migrate en BD limpia, down(db)/up(db) de 073 y suites Vitest H60	Migración 073 reversible y suites Vitest sin fallos (63/63 H60; 804/804 API completa)	073 down ok, 073 re-up ok, 63/63 tests H60 y 804/804 tests globales aprobados	APROBADO	18/11/2026 23:43	—	feat(eventos-atp): implementar vinculacion de entidades a eventos ATP (H60)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Reales

### 5.1. Verificación Estática, Compilación y Suites Automatizadas (Vitest)

```bash
# 1. Regeneración de tipos Next.js y chequeo estático TypeScript
rm -rf .next/types .next/dev && npx next typegen && npx tsc --noEmit
# Resultado observado: ✓ Types generated successfully (código de salida 0)

# 2. Análisis estático ESLint
npm run lint
# Resultado observado: 0 errores, 11 advertencias preexistentes fuera de H60

# 3. Compilación de producción
npm run build
# Resultado observado: ✓ Compiled successfully in 3.9s / ✓ Finished TypeScript in 11.3s

# 4. Ejecución filtrada por HU-60 con Vitest
npm test -- -t "\(H60\)"
# Resultado observado: Test Files 8 passed | 61 skipped (69), Tests 39 passed | 765 skipped (804)

# 5. Ejecución dirigida de los archivos cubiertos en H60
npx vitest run \
  src/modules/eventos-atp/__tests__/vinculacion.schema.test.ts \
  src/modules/eventos-atp/__tests__/vinculacion.service.test.ts \
  src/app/api/eventos-atp/__tests__/route.test.ts \
  "src/app/api/eventos-atp/[id]/__tests__/route.test.ts" \
  "src/app/api/eventos-atp/[id]/vinculos/__tests__/route.test.ts" \
  src/lib/db/migrations/__tests__/073_evento_atp_vinculacion.test.ts \
  src/modules/incidentes/__tests__/incidente-kanban.schema.test.ts \
  src/modules/eventos-atp/__tests__/asistencia-social.schema.test.ts
# Resultado observado: Test Files 8 passed (8), Tests 63 passed (63)

# 6. Suite completa de la API
npm test
# Resultado observado: Test Files 69 passed (69), Tests 804 passed (804)
```

### 5.2. Verificación de Integración Git y Migraciones Kysely

```bash
# Chequeo de conflictos contra develop
git merge-tree --write-tree develop HEAD
# Salida observada:
# CONFLICTO (contenido): Conflicto de fusión en src/lib/openapi/index.ts
# CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/__tests__/incidente-kanban.service.test.ts
# CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/incidente-kanban.repository.ts
# CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/incidente-kanban.schema.ts
# CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/incidente-kanban.service.ts

# Chequeo de migraciones contra una copia de la BD con estado de develop
DATABASE_URL=postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_h60 npm run db:migrate
# Salida observada:
# Error al ejecutar migraciones Kysely: Error: corrupted migrations: previously executed migration 035_permiso_misiones_terreno_verificar is missing
```

### 5.3. Pruebas HTTP Replicables mediante cURL

Los siguientes comandos fueron ejecutados contra el servidor compilado en `http://localhost:3099` conectado a una instancia aislada de PostgreSQL 16 (`sgrai_qa_h60`) con migraciones `001`–`073` aplicadas.

#### Caso 1: Selector de Eventos ATP Activos (`200 OK` — `CP-H60-API-01`)
```bash
curl -s -i "http://localhost:3099/api/eventos-atp?estado=ACTIVO" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 200 OK
content-type: application/json

{
  "message": "Listado de Eventos ATP obtenido exitosamente.",
  "data": [
    {
      "id": "52d1ce84-1122-4f11-981d-2be3d0288493",
      "codigo": "ATP-2026-MAYO",
      "nombre": "Evento Manual Mayo",
      "estado": "ACTIVO",
      "totalVinculados": 0
    },
    {
      "id": "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531",
      "codigo": "ATP-2026-0001",
      "nombre": "Sistema Frontal Auto 1",
      "estado": "ACTIVO",
      "totalVinculados": 0
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Caso 2: Vinculación en Lote de las 4 Entidades (`200 OK` — `CP-H60-API-04`)
```bash
curl -s -i -X POST "http://localhost:3099/api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531/vinculos" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteIds": ["8eba9228-87ab-4c06-840a-b889dd0d5d5b"],
    "eventoPrevencionIds": ["91d99083-b0a4-4a23-a269-1df58dd60dbb"],
    "recuperacionIds": ["5837deb6-fe38-4b28-847c-0a59f4b0e602"],
    "eventoAsistenciaSocialIds": ["70000000-0000-4000-8000-000000000001"]
  }'
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 200 OK
content-type: application/json

{
  "message": "Entidades vinculadas al Evento ATP exitosamente.",
  "data": {
    "eventoAtpId": "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531",
    "accion": "VINCULADO",
    "entidades": {
      "incidentes": [{"tipo":"INCIDENTE","id":"8eba9228-87ab-4c06-840a-b889dd0d5d5b","codigo":"INC-90523930","nombre":"Caída de árbol","eventoAtpIdAnterior":null}],
      "eventosPrevencion": [{"tipo":"EVENTO_PREVENCION","id":"91d99083-b0a4-4a23-a269-1df58dd60dbb","codigo":"PREV-2026-0001","nombre":"Limpieza y monitoreo de sumideros en Angachilla","eventoAtpIdAnterior":null}],
      "recuperaciones": [{"tipo":"RECUPERACION","id":"5837deb6-fe38-4b28-847c-0a59f4b0e602","codigo":"REC-2026-0001","nombre":"Test Recuperacion CLI","eventoAtpIdAnterior":null}],
      "eventosAsistenciaSocial": [{"tipo":"EVENTO_ASISTENCIA_SOCIAL","id":"70000000-0000-4000-8000-000000000001","codigo":"AS-2026-0001","nombre":"VIVIENDA_ANEGADA","eventoAtpIdAnterior":null}]
    },
    "reasignadas": [],
    "noEncontradas": [],
    "noDesvinculadas": [],
    "vinculadoPorId": "00000000-0000-4000-8000-000000000003",
    "ocurridoEn": "2026-11-19T02:38:42.748Z"
  }
}
```

#### Caso 3: Bloqueo sobre Evento ATP `FINALIZADO` (`409 Conflict` — `CP-H60-API-08`)
```bash
curl -s -i -X POST "http://localhost:3099/api/eventos-atp/50000000-0000-4000-8000-000000000099/vinculos" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{"incidenteIds":["8eba9228-87ab-4c06-840a-b889dd0d5d5b"]}'
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"El Evento ATP 'ATP-2026-FIN1' se encuentra en estado FINALIZADO y no admite nuevas vinculaciones."}
```

#### Caso 4: Reproducción de `BUG-H60-API-02` — Entidades Inexistentes Clasificadas como `INCIDENTE`
```bash
curl -s -i -X POST "http://localhost:3099/api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531/vinculos" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventoPrevencionIds": ["99999999-9999-4999-8999-999999999992"],
    "recuperacionIds": ["99999999-9999-4999-8999-999999999991"],
    "eventoAsistenciaSocialIds": ["99999999-9999-4999-8999-999999999993"]
  }'
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Entidades vinculadas al Evento ATP exitosamente.","data":{"eventoAtpId":"9ee56b03-c2ad-4fdf-9fc1-012c84d6c531","accion":"VINCULADO","entidades":{"incidentes":[],"eventosPrevencion":[],"recuperaciones":[],"eventosAsistenciaSocial":[]},"reasignadas":[],"noEncontradas":[{"tipo":"INCIDENTE","id":"99999999-9999-4999-8999-999999999992"},{"tipo":"INCIDENTE","id":"99999999-9999-4999-8999-999999999991"},{"tipo":"INCIDENTE","id":"99999999-9999-4999-8999-999999999993"}],"noDesvinculadas":[],"vinculadoPorId":"00000000-0000-4000-8000-000000000003","ocurridoEn":"2026-11-19T02:39:38.125Z"}}
```

#### Caso 5: Filtros por `eventoAtpId` en Centro de Mando (`200 OK` — `CP-H60-API-10` a `13`)
```bash
curl -s -i "http://localhost:3099/api/incidentes?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"

curl -s -i "http://localhost:3099/api/eventos-atp/prevencion?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"

curl -s -i "http://localhost:3099/api/eventos-atp/recuperacion?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"

curl -s -i "http://localhost:3099/api/eventos-atp/asistencia-social?eventoAtpId=9ee56b03-c2ad-4fdf-9fc1-012c84d6c531" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```
**Respuestas HTTP/JSON obtenidas:**  
Todas respondieron `HTTP/1.1 200 OK` retornando exclusivamente el registro vinculado (`INC-90523930`, `PREV-2026-0001`, `REC-2026-0001`, `AS-2026-0001`) con `"eventoAtpId": "9ee56b03-c2ad-4fdf-9fc1-012c84d6c531"`.

#### Caso 6: Desvinculación (`DELETE`) y Preservación del Registro (`200 OK` — `CP-H60-API-06`, `CP-H60-API-14`)
```bash
curl -s -i -X DELETE "http://localhost:3099/api/eventos-atp/c1613cd9-9f2b-4a11-8ef7-6b62fde4728b/vinculos" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{"incidenteIds":["8eba9228-87ab-4c06-840a-b889dd0d5d5b"]}'

curl -s -i "http://localhost:3099/api/incidentes/8eba9228-87ab-4c06-840a-b889dd0d5d5b" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Detalle de incidente obtenido exitosamente.","data":{"id":"8eba9228-87ab-4c06-840a-b889dd0d5d5b","codigo":"INC-90523930","codigoSeguimiento":"90523930","tipoAfectacion":"Caída de árbol","descripcion":"aplasto una casa de dos pisos","direccion":"toribio medina","latitud":-39.825411,"longitud":-73.2383937,"estado":"REPORTADO","prioridad":"MEDIA","requiereAsistenciaSocial":false,"fuenteOrigen":"CHATBOT","asteriskCallId":null,"asteriskCallerPhone":null,"informante":{"id":"d64230e9-c590-4afc-8003-51db6e1375bf","rut":"21827375-0","nombre":"Alen Rupailaf","telefono":"+56957023359"},"delegacion":null,"creadoPor":null,"encargado":null,"misiones":[],"recursosAsociados":[],"eventoAtpId":null,"creadoEn":"2026-09-30T02:16:49.522Z","actualizadoEn":"2026-09-30T02:16:49.522Z"}}
```

#### Caso 7: Reproducción de `BUG-H60-API-04` — RBAC en Listados y Mensajes `403`
```bash
curl -s -i "http://localhost:3099/api/eventos-atp/prevencion" \
  -H "Authorization: Bearer <TOKEN_JWT_SUPERVISOR>"

curl -s -i -X POST "http://localhost:3099/api/eventos-atp/9ee56b03-c2ad-4fdf-9fc1-012c84d6c531/vinculos" \
  -H "Authorization: Bearer <TOKEN_JWT_CALL_CENTER>" \
  -H "Content-Type: application/json" \
  -d '{"incidenteIds":["8eba9228-87ab-4c06-840a-b889dd0d5d5b"]}'
```
**Respuesta HTTP/JSON obtenida:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (Alcance Backend API)

| Criterio de Aceptación (CA) | Cobertura en `sgrai-api` | Casos / Defectos Asociados | Estado QA |
|---|---|---|:---:|
| **CA-1:** Selector de vinculación en drawer de incidente, prevención, recuperación y asistencia social | `GET /api/incidentes/{id}`, `GET /api/eventos-atp/prevencion`, `/recuperacion`, `/asistencia-social` exponen `eventoAtpId`; selector UI corresponde a `sgrai-web` | `CP-H60-API-04`, `CP-H60-API-14` | **CUMPLIDO EN API** |
| **CA-2:** El selector lista únicamente Eventos ATP en estado `ACTIVO` y bloquea `FINALIZADO` | `GET /api/eventos-atp?estado=ACTIVO` filtra estado `ACTIVO`; `POST /vinculos` bloquea `FINALIZADO` y `CANCELADO` con `409` | `CP-H60-API-01`, `CP-H60-API-08`, `CP-H60-API-09` | **CUMPLIDO EN API** |
| **CA-3:** Desde detalle de Evento ATP permitir vinculación múltiple/en lote | `GET /api/eventos-atp/{id}` expone `vinculos` y `POST /api/eventos-atp/{id}/vinculos` procesa arreglos por tipo | `CP-H60-API-03`, `CP-H60-API-04`, `CP-H60-API-05`, `BUG-H60-API-02` | **PARCIAL (OBSERVADO)** |
| **CA-4:** Al confirmar vinculación actualizar `evento_atp_id` en las cuatro tablas | Actualización transaccional de `evento_atp_id` en `incidente`, `evento_prevencion`, `recuperacion` y `evento_asistencia_social` | `CP-H60-API-04`, `BUG-H60-API-03` | **PARCIAL (OBSERVADO)** |
| **CA-5:** Permitir desvincular estableciendo `evento_atp_id = NULL` sin destruir el registro | `DELETE /api/eventos-atp/{id}/vinculos` fija `evento_atp_id = NULL` conservando el registro íntegro | `CP-H60-API-06`, `CP-H60-API-07`, `BUG-H60-API-03` | **PARCIAL (OBSERVADO)** |
| **CA-6:** Filtro rápido por `eventoAtpId` en tablero Kanban de incidentes y listados del Centro de Mando | Query param `eventoAtpId` operativo en los 4 listados; limitado en RBAC de prevención/recuperación para `SUPERVISOR` y sin `docs/api/` | `CP-H60-API-10` a `13`, `BUG-H60-API-01`, `BUG-H60-API-04`, `BUG-H60-API-07` | **PARCIAL (OBSERVADO)** |
| **CA-7:** Emitir evento WebSocket `evento_atp:vinculado` a `encargado`, `supervisor` y `mapa` | Emisión verificada en `encargado`, `supervisor` y `mapa`, aunque omite `sala:encargados` y carece de `try/catch` | `CP-H60-API-15`, `BUG-H60-API-06` | **PARCIAL (OBSERVADO)** |
| **CA-8:** Requerir permiso RBAC `eventos_atp:vincular` | Migración `073` crea el permiso y lo asigna a Administrador y Encargado; validación activa en rutas con mensaje `403` mejorable | `CP-H60-API-16`, `CP-H60-API-17`, `CP-H60-API-20`, `BUG-H60-API-04`, `BUG-H60-API-05` | **PARCIAL (OBSERVADO)** |

