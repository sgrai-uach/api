# Informe de Auditoría Técnica, Re-Test y Certificación QA: HU-38 — Asignar o Modificar Prioridad del Incidente por Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Incidentes / Operaciones de Terreno (`sgrai-api` — `POST /api/incidentes/[id]/prioridad/calcular` y `PATCH /api/incidentes/[id]/prioridad`).  
> **Historia de Usuario:** HU-38 — *"Como Patrulla verificadora Quiero asignar o modificar la prioridad del incidente basándose en la sugerencia del sistema y la evaluación técnica en terreno. Para garantizar que los recursos tácticos pesados y cuadrillas se destinen prioritariamente a las emergencias con mayor nivel de gravedad."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h38-patrulla-asignar-prioridad`  
> **Commits Evaluados en la Rama:**  
> * `feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)`  
> * `docs(qa): documentar primera versión de casos de prueba para HU-38`  
> * `merge: integrar develop en feature/h38-patrulla-asignar-prioridad conservando migracion 052`  
> * `fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)`  
> * `test(incidentes): agregar pruebas de validacion autoritativa, pertenencia y concurrencia (HU-38)`  
> * `docs(api): documentar errores y ejemplos de prioridad en terreno (HU-38)`  
>  
> **Fecha de Auditoría Inicial:** 17/11/2026 14:28  
> **Fecha de Re-Test y Certificación Final:** 18/11/2026 02:34  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (Re-Test 100% — 5 Defectos Subsanados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

En la primera fase de auditoría técnica ejecutada el **17/11/2026**, la rama `feature/h38-patrulla-asignar-prioridad` recibió dictamen **Rechazado en Code Review (`Changes Requested`)** al detectarse **5 defectos reales** (**2 críticos, 2 altos y 1 medio**: `BUG-H38-API-01` a `BUG-H38-API-05`), relacionados con evasión de cálculo autoritativo y justificación obligatoria de prioridad (`CA-3`), pérdida de banderas `snake_case` en `riesgosActivos`, bypass de autorización horizontal en patrullas (`patrulla_id IS NULL`) y en `POST /prioridad/calcular`, desfase e inconsistencia de migraciones Kysely frente a `develop`, condición de carrera en `version_reporte` y regresiones en OpenAPI 3.0 y Redis Pub/Sub / Socket.io.

Tras la integración de `develop` y los commits de corrección aplicados por el equipo de desarrollo, se ejecutó el **Re-Test completo el 18/11/2026**, verificando en vivo mediante PostgreSQL 16 (con migraciones ejecutadas limpiamente tanto sobre un clon de `develop` como desde base vacía), Redis 7 (`SUBSCRIBE sgrai:socket-events`), peticiones HTTP/cURL autorizadas con JWT Bearer y cabecera de servicio, `GET /openapi.json`, compilación estricta TypeScript, análisis estático ESLint, build de producción Next.js y ejecución íntegra de Vitest. Todos los defectos (`BUG-H38-API-01` a `BUG-H38-API-05`) fueron subsanados satisfactoriamente y los 20 casos funcionales, de seguridad RBAC, reglas ICS, contrato y regresión (`CP-H38-API-01` a `CP-H38-API-20`) pasaron sin observaciones bloqueantes, alcanzando una **tasa de aprobación del 100.0% (`CERTIFICADO / APROBADO`)**.

| Métrica de Calidad | Auditoría Inicial (17/11/2026) | Re-Test Final (18/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | **25** | 5 Defectos (`BUG-H38-API-01` a `05`) + 20 Casos Funcionales, RBAC, ICS, Contrato y Regresión (`CP-H38-API-01` a `20`) |
| **Casos Aprobados / Corregidos** | **20** | **25** | 5 defectos en estado `CORREGIDO` + 20 casos en estado `APROBADO` |
| **Defectos Abiertos / Fallidos** | **5** | **0** | 0 Críticos, 0 Altos y 0 Medios pendientes tras verificación en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Pruebas ejecutadas de extremo a extremo contra PostgreSQL 16 y Redis 7 con migración oficial |
| **Tasa de Aprobación (% Pass)** | **80.0%** | **100.0%** | Cumple el 100.0% requerido para aprobación e integración hacia `develop` |
| **Suite Completa del Repositorio (Vitest)** | **74/74 (835/835)** | **80/80 archivos (885/885 tests pass)** | Duración total `7.30s`; sin pruebas omitidas ni fallidas |
| **Suite Focalizada HU-38 (Vitest)** | **8/8 (34/34)** | **8/8 archivos (35/35 tests pass)** | `prioridad.utils.test.ts` (7), `mision.service.test.ts` (6), `053_...test.ts` (2), `incidente-kanban.service.test.ts` (6), `prioridad.service.test.ts` (1), `prioridad.repository.test.ts` (5), `prioridad/__tests__/route.test.ts` (7), `openapi.json/__tests__/route.test.ts` (1) (`3.86s`) |
| **Compilación de Tipos (`npx tsc --noEmit`)** | **0 errores** | **0 errores** | Verificación estricta de tipos TypeScript aprobada (`exit code 0`) |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores / 1 warning** | **0 errores / 1 warning** | 1 warning heredado de variable no usada (`BadRequestError`) en `src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts:13:3` |
| **Compilación de Producción (`npm run build`)** | **Exitosa** | **Exitosa** | Next.js 16.3.4 (Turbopack) compilado en `2.3s`; `27/27` páginas estáticas generadas en `195ms` |
| **Secuencia de Migraciones (`npm run db:migrate`)** | 🔴 **Fallo (`EXIT 1`)** | 🟢 **Exitosa (`EXIT 0`)** | Validada en clon de `develop` (`035_` -> `052_`, más `053_`–`055_`) y en BD limpia (`001` a `071`, 40 migraciones totales) |

---

## 2. Registro Técnico de Defectos Detectados y Verificación de Re-Test

### `BUG-H38-API-01`: Bypass de Validación Autoritativa de `prioridad_sugerida` y Justificación Obligatoria (`CA-3`), Pérdida Silenciosa de Riesgos `snake_case` y Omisión de `familias` en Raíz
* **Severidad:** **CRÍTICA** (Evasión de Regla de Negocio CA-3 y Corrupción de Datos de Priorización).
* **Estado:** 🟢 **CORREGIDO** *(Detectado: 17/11/2026 — Verificado en Re-Test: 18/11/2026)*.
* **Archivos Afectados:**
  * `src/modules/incidentes/prioridad.schema.ts`
  * `src/modules/incidentes/prioridad.repository.ts`
  * `src/modules/incidentes/prioridad.utils.ts`
* **Descripción del Defecto Original:**  
  1. `prioridad.schema.ts` y `prioridad.repository.ts` priorizaban `prioridadSugerida` enviada en el cuerpo de la petición sobre el cálculo autoritativo del servidor (`calculo.prioridadSugerida`) y sobre el valor ya persistido en base de datos, permitiendo enviar `prioridad: "BAJA"` con `prioridadSugerida: "BAJA"` sin exigir `justificacion_prioridad` incluso frente a factores de riesgo críticos.
  2. `RiesgosActivosEvaluacionSchema` declaraba `.default(false)` en las claves `camelCase`, anulando los alias `snake_case` (`riesgo_electrico`, `riesgo_estructural`, `aislamiento_vial`) al caer en el operador `??` de `prioridad.utils.ts`.
  3. Ni `tieneCamposEvaluacionEnRaiz` ni `CLAVES_EVALUACION_RAIZ` reconocían `familias`, `familiasAfectadas` ni `requiereAsistenciaSocial` en la raíz del payload.
* **Resolución Implementada y Verificación en Re-Test (18/11/2026):**  
  * **Corrección aplicada (`fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)`):** Se eliminó `.default(false)` de `RiesgosActivosEvaluacionSchema`; se incorporaron `familias`, `familiasAfectadas` y `requiereAsistenciaSocial` en `tieneCamposEvaluacionEnRaiz` (y su homólogo en repositorio); el `superRefine` pasó a calcular `prioridadSugerida` incondicionalmente cuando `hayEvaluacion` es verdadero; y `prioridad.repository.ts` pasó a imponer `envioDatosEvaluacion ? calculo.prioridadSugerida : ...` con precedencia autoritativa sobre el payload del cliente.
  * **Resultados de Re-Test en vivo:**
    * `POST /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular` con `{"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}}` retornó `HTTP/1.1 200 OK` con `"prioridadSugerida":"CRITICA"`, `"puntajeTotal":60` y `"riesgosActivos":{"riesgoElectrico":true,"riesgoEstructural":true,"riesgoQuimicoSanitario":false,"aislamientoVial":true}`.
    * `PATCH .../prioridad` con `{"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}` fue rechazado con `HTTP/1.1 400 Bad Request` (`campo: "justificacion_prioridad"`).
    * `PATCH .../prioridad` con `{"prioridad":"BAJA","familias":[{"nucleoFamiliarTotal":3,"personasElectrodependientes":1}]}` en la raíz fue rechazado con `HTTP/1.1 400 Bad Request` (`campo: "justificacion_prioridad"`).
    * `PATCH .../prioridad` sin `evaluacion` enviando `{"prioridad":"BAJA","prioridadSugerida":"BAJA"}` contra un incidente cuya `prioridad_sugerida` persistida en BD era `"CRITICA"` fue rechazado con `HTTP/1.1 400 Bad Request`.

---

### `BUG-H38-API-02`: Bypass de Autorización Horizontal de Patrulla Verificadora (`patrulla_id IS NULL` / Misiones `ATENCION_CUADRILLA`) y Mutación Sin Control de Acceso en `POST /prioridad/calcular`
* **Severidad:** **CRÍTICA** (Brecha de Seguridad Horizontal entre Unidades Operativas y Violación del Protocolo ICS).
* **Estado:** 🟢 **CORREGIDO** *(Detectado: 17/11/2026 — Verificado en Re-Test: 18/11/2026)*.
* **Archivo Afectado:** `src/modules/incidentes/prioridad.repository.ts`
* **Descripción del Defecto Original:**  
  1. La consulta de misión en `actualizarPrioridadIncidente` no filtraba `mision.tipo_mision = 'VERIFICACION'` y omitía verificar pertenencia cuando `misionSeleccionada.patrulla_id` era `NULL` (como en misiones `ATENCION_CUADRILLA`), ni validaba el estado operativo activo de la patrulla ni el cierre del incidente (`RESUELTO` / `NO_ABORDABLE`).
  2. `calcularPrioridadPreliminar` (`POST /api/incidentes/[id]/prioridad/calcular`) persistía `incidente.prioridad_sugerida` sin verificar pertenencia a la patrulla verificadora ni bloquear incidentes cerrados.
* **Resolución Implementada y Verificación en Re-Test (18/11/2026):**  
  * **Corrección aplicada (`fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)`):** Se agregó filtro `.where("mision.tipo_mision", "=", "VERIFICACION")`, validación de `patrulla_activo` y `patrulla_eliminado_en`, rechazo con `ConflictError` (`409`) ante incidentes en estado `RESUELTO` o `NO_ABORDABLE` o sin misión de verificación asociada, verificación obligatoria de `misionSeleccionada.patrulla_id`, y aplicación de controles equivalentes en `calcularPrioridadPreliminar`.
  * **Resultados de Re-Test en vivo:**
    * `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/prioridad` (`ATENCION_CUADRILLA`, `patrulla_id = null`) con `x-user-id: d1000000-0000-4000-8000-000000000001` retornó `HTTP/1.1 409 Conflict` con `"No existe una misión de verificación asociada a este incidente para registrar la evaluación de prioridad en terreno."`.
    * `POST /api/incidentes/a1000000-0000-4000-8000-000000000006/prioridad/calcular` (`RESUELTO`) retornó `HTTP/1.1 409 Conflict` con `"No se puede recalcular la prioridad de un incidente en estado 'RESUELTO'."`.
    * `POST /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad/calcular` (asignado a otra patrulla verificadora) retornó `HTTP/1.1 403 Forbidden` con `"No está autorizado para evaluar la prioridad de un incidente asignado a otra patrulla verificadora."`.

---

### `BUG-H38-API-03`: Desfase de 33 Commits con `develop`, Corrupción/Colisión de Migraciones Kysely (`052_`–`055_`), Fallo `500` (`42703`) en Endpoints y DDL de Runtime Divergente
* **Severidad:** **ALTA** (Bloqueo de Despliegue/Migración Continua, Error `500` en Endpoints y Regresión de Correcciones Previas).
* **Estado:** 🟢 **CORREGIDO** *(Detectado: 17/11/2026 — Verificado en Re-Test: 18/11/2026)*.
* **Archivos Afectados:**
  * `src/lib/db/migrations/*` (`042_`, `052_`, `053_`, `054_`, `055_`, `061_`, `071_`)
  * `src/modules/incidentes/prioridad.repository.ts`
  * `src/modules/incidentes/incidente-kanban.repository.ts`
  * `src/modules/misiones/mision.repository.ts`
  * `package.json`
* **Descripción del Defecto Original:**  
  La rama acumulaba un desfase de 33 commits respecto a `develop`, provocando fallo `EXIT 1` en `npm run db:migrate` por ausencia de `042_cuadrilla_patrulla_integrantes_vistas`, colisión frente a `035_`, `061_` y `071_`, error PostgreSQL `42703` (`500 Internal Server Error`) en endpoints, presencia de DDL en caliente (`asegurarColumnasHu38EnEsquema`) y regresión de `0.12.0` / `trazabilidad_notificacion`.
* **Resolución Implementada y Verificación en Re-Test (18/11/2026):**  
  * **Corrección aplicada (`merge: integrar develop en feature/h38-patrulla-asignar-prioridad conservando migracion 052` y `fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)`):** Se integró `develop` incorporando `042_`, `061_` y `071_`, se conservó la reconciliación limpia `035_ -> 052_`, se eliminó `asegurarColumnasHu38EnEsquema` de `prioridad.repository.ts`, `incidente-kanban.repository.ts` y `mision.repository.ts`, y se preservaron `trazabilidad_notificacion` y la versión `0.12.0`.
  * **Resultados de Re-Test en vivo:**
    * Sobre base de datos clonada desde `develop` (`sgrai_qa_retest`): `npm run db:migrate` reconcilió `"035_permiso_misiones_terreno_verificar" -> "052_permiso_misiones_terreno_verificar"`, aplicó `053_incidente_prioridad_y_evaluacion_terreno`, `054_resync_titulo_mision_verificacion` y `055_mision_hito_metadatos`, y finalizó con `EXIT 0`.
    * Sobre base de datos creada desde cero (`sgrai_qa_fresh` con PostGIS): `npm run db:migrate` ejecutó las 40 migraciones (`001` a `071`) secuencialmente con `EXIT 0`.
    * Verificación de esquema PostgreSQL confirmada: restricción `chk_incidente_prioridad_sugerida` en `incidente` e índice único `uq_reporte_terreno_mision_version` sobre `reporte_terreno (mision_id, version_reporte)`.

---

### `BUG-H38-API-04`: Condición de Carrera (TOCTOU) en Versionado de Reportes (`version_reporte` Duplicado) y Captura Silenciosa de Errores SQL Dentro de Transacciones
* **Severidad:** **ALTA** (Integridad Transaccional, Corrupción de Versionado de Reportes y Enmascaramiento de Fallos en Base de Datos).
* **Estado:** 🟢 **CORREGIDO** *(Detectado: 17/11/2026 — Verificado en Re-Test: 18/11/2026)*.
* **Archivos Afectados:**
  * `src/modules/incidentes/prioridad.repository.ts`
  * `src/lib/db/migrations/053_incidente_prioridad_y_evaluacion_terreno.ts`
* **Descripción del Defecto Original:**  
  Bajo aislamiento `READ COMMITTED`, `actualizarPrioridadIncidente` no adquiría bloqueo pesimista `.forUpdate()`, calculaba `versionReporte` mediante `COUNT(id)` sin índice único en `(mision_id, version_reporte)` (produciendo duplicidad de `version_reporte = 1` y dos hitos `PRIORIDAD_ASIGNADA` ante peticiones simultáneas) y envolvía consultas reales en bloques `try/catch` que silenciaban fallos SQL.
* **Resolución Implementada y Verificación en Re-Test (18/11/2026):**  
  * **Corrección aplicada (`fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)`):** Se incorporó bloqueo pesimista `.forUpdate()` sobre `incidente` y `.forUpdate("mision")` sobre la misión, se reemplazó el conteo por `coalesce(max(version_reporte), 0)::int`, se eliminaron los bloques `try/catch` silenciosos alrededor de operaciones Kysely y se garantizó el índice único `uq_reporte_terreno_mision_version` en `(mision_id, version_reporte)`.
  * **Resultados de Re-Test en vivo:**
    * Al disparar dos peticiones concurrentes `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` (`x-user-id: 00000000-0000-4000-8000-000000000001`), la transacción serializó ambas operaciones: una obtuvo `versionReporte: 1` (`esRectificacion: false`, hito `PRIORIDAD_ASIGNADA`) y la otra obtuvo `versionReporte: 2` (`esRectificacion: true`, hito `PRIORIDAD_RECTIFICADA`), verificando consistencia exacta en `reporte_terreno` y `mision_hito`.

---

### `BUG-H38-API-05`: Desalineación de Contrato OpenAPI 3.0 (`bearerAuth` No Declarado y Versión `0.10.0` vs `0.12.0`) y Regresión de Difusión WebSocket en `src/lib/socket/index.ts`
* **Severidad:** **MEDIA** (Inconsistencia de Especificación OpenAPI para Generación de Clientes y Duplicidad/Omisión de Salas WebSocket).
* **Estado:** 🟢 **CORREGIDO** *(Detectado: 17/11/2026 — Verificado en Re-Test: 18/11/2026)*.
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts`
  * `src/modules/incidentes/prioridad.schema.ts`
  * `src/lib/socket/index.ts`
  * `docs/api/incidentes.md`
* **Descripción del Defecto Original:**  
  `openapi.json` reportaba versión `0.10.0` sin `components.securitySchemes`, usando `bearerAuth` (minúscula) en rutas HU-38 y omitiendo `familias` en `CalcularPrioridadResponseSchema.data.evaluacionNormalizada`; en `src/lib/socket/index.ts`, existían broadcasts globales duplicados en memoria y `notificarMisionActualizada` omitía las salas `sala:encargados` y `supervisor` en Redis Pub/Sub; y `docs/api/incidentes.md` requería ejemplos y errores completos.
* **Resolución Implementada y Verificación en Re-Test (18/11/2026):**  
  * **Corrección aplicada (`fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)` y `docs(api): documentar errores y ejemplos de prioridad en terreno (HU-38)`):** Se restableció OpenAPI `0.12.0` con `components.securitySchemes.BearerAuth` y `[{ BearerAuth: [] }]` en `/prioridad` y `/prioridad/calcular`, se agregó `familias` a `CalcularPrioridadResponseSchema`, se retiró el broadcast global duplicado `(ioInstance as any).emit("incidente:actualizado", payload)` alineando `rooms = ["encargado", "sala:encargados", "supervisor"]` en `notificarMisionActualizada`, y se documentaron errores y ejemplos en `docs/api/incidentes.md`.
  * **Resultados de Re-Test en vivo:**
    * `GET /openapi.json` retornó `version: "0.12.0"`, `components.securitySchemes.BearerAuth` definido, `patchSec: [{ BearerAuth: [] }]`, `calcSec: [{ BearerAuth: [] }]` y `hasFamiliasInResp: true`. *(Observación menor no bloqueante: la especificación OpenAPI de `POST /api/incidentes/{id}/prioridad/calcular` declara códigos `200, 400, 401, 403, 404, 500`, mientras en tiempo de ejecución el handler retorna también `409 Conflict` documentado en `docs/api/incidentes.md`).*
    * Redis `SUBSCRIBE sgrai:socket-events` confirmó emisión limpia de `incidente:actualizado` en las salas `sala:encargados`, `encargado` y `mapa`, así como `mision:actualizada` en `encargado`, `sala:encargados` y `supervisor`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H38-API-01` | Bypass de cálculo autoritativo y justificación obligatoria enviando `prioridadSugerida` o `familias` en raíz, y anulación de riesgos `snake_case` en `riesgosActivos` | Seguridad / Validación Zod / Regla de Negocio (CA-3) | Schema / Utils / Endpoint | Crítica | Incidente con misión `VERIFICACION` en estado `EN_CURSO` | `POST .../prioridad/calcular` con `{"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}}` y `PATCH .../prioridad` con `{"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}`, con `familias` en raíz y sin `evaluacion` ante BD `CRITICA` | Cálculo autoritativo `CRITICA` (`60 pts`) en `snake_case` y rechazo `400 Bad Request` si se intenta asignar `BAJA` sin justificación >= 5 caracteres | `POST /calcular` retorna `CRITICA` (`60 pts`) con flags `true`; las tres variantes `PATCH` sin justificación son rechazadas con `HTTP 400 Bad Request` (`campo: "justificacion_prioridad"`) | CORREGIDO | 17/11/2026 14:24 | 18/11/2026 02:32 | fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38) |
| `BUG-H38-API-02` | Bypass de autorización horizontal de patrulla cuando `patrulla_id` es `NULL` (`ATENCION_CUADRILLA`) y mutación sin control en `POST /prioridad/calcular` sobre incidentes `RESUELTO` o ajenos | Seguridad / Autorización Horizontal / Regla ICS | Repositorio / Endpoint | Crítica | Incidente `INC-2026-0004` (`ATENCION_CUADRILLA`, `patrulla_id = null`), `INC-2026-0006` (`RESUELTO`) e `INC-2026-0003` (otra patrulla), usuario `d1000000-...001` | `PATCH .../a1000000-...004/prioridad`, `POST .../a1000000-...006/prioridad/calcular` y `POST .../a1000000-...003/prioridad/calcular` con `x-user-id: d1000000-0000-4000-8000-000000000001` | HTTP `409 Conflict` para `ATENCION_CUADRILLA` y `RESUELTO`, y `403 Forbidden` para incidente asignado a otra patrulla verificadora | Retorna `HTTP 409 Conflict` en `ATENCION_CUADRILLA` y `RESUELTO`, y `HTTP 403 Forbidden` en `/calcular` sobre patrulla ajena | CORREGIDO | 17/11/2026 14:24 | 18/11/2026 02:32 | fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38) |
| `BUG-H38-API-03` | Desfase de 33 commits con `develop`, corrupción/colisión de migraciones Kysely (`052_`–`055_` vs `035_`, `042_`, `061_`, `071_`), error `500` (`42703`) y DDL de runtime divergente | Integración / Base de Datos | Migraciones / Infraestructura | Alta | BD clonada desde `develop` (`001`–`071`) y BD vacía con PostGIS | `npm run db:migrate` en clon `develop`, `npm run db:migrate` en BD vacía e inspección de restricciones PostgreSQL | `npm run db:migrate` finaliza con `EXIT 0` en ambos entornos, sin `asegurarColumnasHu38EnEsquema` ni regresiones sobre `develop` | `npm run db:migrate` exit `0` en clon (reconcilia `035_` -> `052_` y aplica `053_`–`055_`) y en BD vacía (40 migraciones `001`–`071`); `uq_reporte_terreno_mision_version` y `chk_incidente_prioridad_sugerida` verificados | CORREGIDO | 17/11/2026 14:23 | 18/11/2026 02:31 | merge: integrar develop en feature/h38-patrulla-asignar-prioridad conservando migracion 052 |
| `BUG-H38-API-04` | Condición de carrera en `version_reporte` bajo peticiones concurrentes (duplicación de versión `#1` e hito `PRIORIDAD_ASIGNADA`) y captura silenciosa `try/catch` de errores SQL | Concurrencia / Integridad ACID | Repositorio / BD | Alta | Incidente `INC-2026-0003` con misión `MIS-2026-0001` (`EN_CURSO`) sin reportes previos | Dos peticiones paralelas `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `x-user-id: 00000000-0000-4000-8000-000000000001` | Serialización mediante `.forUpdate()` / `.forUpdate("mision")` generando versiones secuenciales `#1` y `#2` e hitos sin duplicados ni `try/catch` silenciosos | Peticiones serializadas generando `versionReporte: 1` (`PRIORIDAD_ASIGNADA`) y `versionReporte: 2` (`PRIORIDAD_RECTIFICADA`) verificados en `reporte_terreno` y `mision_hito` | CORREGIDO | 17/11/2026 14:25 | 18/11/2026 02:32 | fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38) |
| `BUG-H38-API-05` | Esquema OpenAPI `bearerAuth` no declarado (versión `0.10.0` vs `0.12.0` de `develop`), omisión de `familias`, regresión WebSocket y documentación API incompleta | Contrato API / Tiempo Real | OpenAPI / Socket.io / Redis / Docs | Media | Servidor con `REDIS_URL` activo, consulta `GET /openapi.json` y revisión `docs/api/incidentes.md` | `GET /openapi.json` y suscripción Redis `SUBSCRIBE sgrai:socket-events` durante `PATCH .../prioridad` | `components.securitySchemes.BearerAuth` en `0.12.0`, `hasFamiliasInResp: true`, emisión Redis a `encargado`, `sala:encargados` y `supervisor` sin duplicados, y `docs/api/incidentes.md` completo | `openapi.json` retorna `version: "0.12.0"`, `BearerAuth` consistente y `hasFamiliasInResp: true`; Redis confirma salas completas de `incidente:actualizado` y `mision:actualizada`; `docs/api/incidentes.md` actualizado | CORREGIDO | 17/11/2026 14:24 | 18/11/2026 02:33 | fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38) |
| `CP-H38-API-01` | Cálculo preliminar de `prioridad_sugerida` (`ALTA`, `47 pts`) mediante `POST /api/incidentes/{id}/prioridad/calcular` | Funcional / Positiva (CA-1) | Integración / Endpoint | Crítica | Migración `053` aplicada en BD; incidente `INC-2026-9932` (`dd7db71e-...`) en `VERIFICACION` asignado a la patrulla | `POST /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular` con `{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}` | HTTP `200 OK` con `prioridadSugerida: "ALTA"`, `puntajeTotal: 47`, `factoresGatillantes` y `requiereAsistenciaSocialSugerido: true` | HTTP `200 OK` retornando `prioridadSugerida: "ALTA"`, `puntajeTotal: 47` y `requiereAsistenciaSocialSugerido: true` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-02` | Confirmación de prioridad sugerida (`ALTA`) sin justificación creando Reporte #1 (Inicial) y registrando hito `PRIORIDAD_ASIGNADA` en `mision_hito` (`200 OK`) | Funcional / Positiva (CA-4) | Integración / Transacción ACID | Crítica | Misión `MIS-2026-0008` aceptada (`EN_CURSO`) para `Patrulla Rápida Las Ánimas` (`d1000000-...001`) | `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad` con `{"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}` | HTTP `200 OK` actualizando `incidente.prioridad` y `prioridad_sugerida` a `"ALTA"`, creando `reporte_terreno` `#1` y `mision_hito` `PRIORIDAD_ASIGNADA` | HTTP `200 OK` con `modificoPrioridadSugerida: false`, `versionReporte: 1`, `esRectificacion: false` e hito `PRIORIDAD_ASIGNADA` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-03` | Modificación y rectificación de prioridad (`ALTA` -> `CRITICA`) con justificación técnica >= 5 caracteres generando Reporte #2 (Rectificación) e hito `PRIORIDAD_RECTIFICADA` | Funcional / Positiva (CA-3, CA-4) | Integración / Transacción ACID | Crítica | Incidente `INC-2026-9932` con Reporte #1 previo en misión `MIS-2026-0008` | `PATCH .../prioridad` con `{"prioridad":"CRITICA","justificacion_prioridad":"...>=5 caracteres...","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}` | HTTP `200 OK` persistiendo `prioridad: "CRITICA"`, `prioridadSugerida: "ALTA"`, `justificacionPrioridad`, `versionReporte: 2`, `esRectificacion: true` y `hito: "PRIORIDAD_RECTIFICADA"` | HTTP `200 OK` con Reporte `#2 (Rectificación)` y trazabilidad completa en `incidente`, `reporte_terreno` y `mision_hito` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-04` | Validación de los cuatro niveles canónicos del enum `PrioridadIncidente` (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y rechazo de valores fuera de catálogo | Validación / Contrato (CA-2) | Schema Zod | Alta | Esquema `PrioridadCanonicaEnum` y `ActualizarPrioridadIncidenteInputSchema` | `PrioridadCanonicaEnum.options` y `safeParse({ prioridad: "EXTREMA" })` | Enum exacto `["BAJA","MEDIA","ALTA","CRITICA"]` y rechazo `success: false` ante `"EXTREMA"` | Retorna exactamente `['BAJA','MEDIA','ALTA','CRITICA']` y rechaza `"EXTREMA"` con error en `path: ['prioridad']` | APROBADO | 17/11/2026 14:28 | 18/11/2026 02:31 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-05` | Rechazo `400 Bad Request` al cambiar `prioridad_sugerida` (`MEDIA` -> `CRITICA`) sin proporcionar `justificacion_prioridad` | Regla de Negocio / Negativa (CA-3) | Integración / Schema Zod | Crítica | Usuario autenticado con permiso `misiones:terreno:verificar` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `{"prioridad":"CRITICA","prioridad_sugerida":"MEDIA"}` | HTTP `400 Bad Request` indicando obligatoriedad de justificación técnica >= 5 caracteres | HTTP `400 Bad Request` con `errors[0].campo = "justificacion_prioridad"` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-06` | Rechazo `400 Bad Request` cuando `justificacion_prioridad` ante discrepancia tiene menos de 5 caracteres (`"mal"` / `"abc"`) | Valor Límite / Validación (CA-3) | Integración / Endpoint y Unit | Crítica | Misión `MIS-2026-0008` en estado `EN_CURSO` | `PATCH .../prioridad` con `{"prioridad":"CRITICA","justificacion_prioridad":"mal","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}` | HTTP `400 Bad Request` rechazando justificación inferior a 5 caracteres | HTTP `400 Bad Request` con mensaje de mínimo 5 caracteres en `justificacion_prioridad` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-07` | Rechazo de petición sin credenciales de autenticación (`401 Unauthorized`) y con token JWT Bearer inválido (`401 Unauthorized`) | Seguridad / Autenticación | Integración / Endpoint | Crítica | Peticiones sin `Authorization`/`x-user-id` y con `Authorization: Bearer token.invalido.123` | `PATCH /api/incidentes/{id}/prioridad` sin cabeceras y con token JWT manipulado | HTTP `401 Unauthorized` rechazando acceso no autenticado o firma inválida | HTTP `401 Unauthorized` verificando bloqueo sin cabecera y con firma inválida | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-08` | Flujo autenticado con JWT Bearer (`Authorization: Bearer <token>`) emitido por `POST /api/seguridad/login` para patrulla verificadora (`200 OK`) | Seguridad / Integración JWT (CA-6) | Integración / Endpoint | Crítica | Usuario `pedro.patrulla@valdivia.cl` activo con rol `PATRULLA_VERIFICADORA` | Login en `/api/seguridad/login` y ejecución de `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad` #1 (`ALTA`) y #2 (`CRITICA`) con `Authorization: Bearer <JWT>` | HTTP `200 OK` identificando al evaluador Pedro Valenzuela mediante token JWT | HTTP `200 OK` en ambas operaciones generando Reporte #1 y Reporte #2 a nombre de Pedro Valenzuela | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-09` | Rechazo RBAC `403 Forbidden` para usuario sin permiso `misiones:terreno:verificar` (`CALL_CENTER`) | Seguridad / RBAC (CA-6) | Integración / Endpoint | Crítica | Usuario `c1111111-1111-4111-8111-111111111111` con rol `CALL_CENTER` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `x-user-id: c1111111-1111-4111-8111-111111111111` | HTTP `403 Forbidden` indicando ausencia de `misiones:terreno:verificar` | HTTP `403 Forbidden`: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-10` | Rechazo `403 Forbidden` al intentar evaluar un incidente cuya misión `VERIFICACION` está asignada a otra patrulla verificadora | Seguridad / Autorización | Integración / Endpoint | Alta | Incidente `INC-2026-0003` (`MIS-2026-0001` asignada a `Patrulla Rápida Costa-1`) | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `x-user-id: d1000000-0000-4000-8000-000000000001` | HTTP `403 Forbidden` impidiendo modificar prioridades de misiones de otra patrulla | HTTP `403 Forbidden`: `{"message":"No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."}` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-11` | Rechazo `400 Bad Request` por parámetro de ruta `id` no UUID y por cuerpo JSON malformado | Validación / Robustez | Integración / Endpoint | Media | Parámetro `id-invalido` o body `{malformed` | `PATCH /api/incidentes/id-invalido/prioridad` y `PATCH .../prioridad` con `-d '{malformed'` | HTTP `400 Bad Request` en ambos casos con mensaje descriptivo | HTTP `400 Bad Request` (`"El identificador del incidente proporcionado no es un UUID válido."` y `"El cuerpo de la petición no es un JSON válido."`) | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-12` | Rechazo `404 Not Found` cuando el identificador UUID del incidente no existe en base de datos | Funcional / Negativa | Integración / Endpoint | Alta | UUID inexistente `50000000-0000-4000-8000-000000000999` | `PATCH /api/incidentes/50000000-0000-4000-8000-000000000999/prioridad` con `{"prioridad":"ALTA"}` | HTTP `404 Not Found` con mensaje de incidente no encontrado | HTTP `404 Not Found`: `{"message":"No se encontró ningún incidente con el identificador proporcionado."}` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-13` | Bloqueo `409 Conflict` cuando la misión de verificación aún está en estado `DESPACHADA` (pendiente de aceptación por patrulla) | Regla de Negocio ICS | Integración / Endpoint | Alta | Incidente `INC-2026-0001` / `INC-2026-9932` con misión en estado `DESPACHADA` | `PATCH /api/incidentes/{id}/prioridad` previo a `POST .../aceptar` | HTTP `409 Conflict` exigiendo aceptar la misión antes de asignar prioridad | HTTP `409 Conflict`: `{"message":"La patrulla debe aceptar la misión asignada antes de poder asignar o modificar la prioridad del incidente en terreno."}` | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-14` | Reglas deterministas de motor de sugerencia: disparo directo a `CRITICA` con electrodependientes, alias `snake_case` y ajuste de `nucleoFamiliarTotal` | Funcional / Lógica de Dominio | Unitaria (`prioridad.utils`) | Alta | Funciones `calcularPrioridadSugerida` y `normalizarEvaluacionTerreno` | `npm test -- src/modules/incidentes/__tests__/prioridad.utils.test.ts` | `7/7` tests aprobados validando niveles `BAJA`, `MEDIA`, `ALTA`, `CRITICA`, riesgos `snake_case` y resúmenes versionados | `7/7` tests aprobados en Re-Test | APROBADO | 17/11/2026 14:22 | 18/11/2026 02:31 | test(incidentes): agregar pruebas de validacion autoritativa, pertenencia y concurrencia (HU-38) |
| `CP-H38-API-15` | Publicación de eventos WebSocket `incidente:actualizado` (`sala:encargados`, `encargado`, `mapa`) y `mision:actualizada` (`encargado`, `sala:encargados`, `supervisor`) en Redis Pub/Sub (`CA-5`) | Tiempo Real / Socket.io | Integración / Redis Pub/Sub | Alta | Suscriptor Redis en canal `sgrai:socket-events` durante ejecución de `PATCH .../prioridad` | `docker exec grupo1_redis redis-cli SUBSCRIBE sgrai:socket-events` + `PATCH .../prioridad` | Mensajes publicados en todas las salas requeridas conteniendo `prioridad`, `prioridadSugerida`, `justificacionPrioridad`, `verificado: true` y `reporteTerreno` | Eventos `incidente:actualizado` y `mision:actualizada` verificados en todas las salas esperadas con payload íntegro | APROBADO | 17/11/2026 14:24 | 18/11/2026 02:33 | fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38) |
| `CP-H38-API-16` | Proyección de `prioridad`, `prioridadSugerida`, `justificacionPrioridad`, `totalReportesTerreno`, `trazabilidadNotificacion` y `reportesEvaluacionTerreno` en Kanban y detalle (`GET /api/incidentes`) | Funcional / Integración Lectura (CA-5) | Integración / Endpoint | Alta | Incidente `INC-2026-9932` actualizado en BD y token JWT de `encargado@valdivia.cl` | `GET /api/incidentes?busqueda=INC-2026-9932` y `GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38` | HTTP `200 OK` proyectando prioridad actualizada, `totalReportesTerreno`, `trazabilidadNotificacion` e historial `reportesEvaluacionTerreno` | HTTP `200 OK` con `totalReportesTerreno: 2`, `trazabilidadNotificacion: "PENDIENTE_ENVIO"`, `verificado: true` y `versiones: [2, 1]` | APROBADO | 17/11/2026 14:25 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-17` | Proyección de hitos `PRIORIDAD_ASIGNADA`/`PRIORIDAD_RECTIFICADA`, reportes versionados y resumen `evaluaciones` en `GET /api/misiones/{id}` | Funcional / Trazabilidad ICS | Integración / Endpoint | Media | Misión `MIS-2026-0008` con evaluaciones #1 y #2 registradas y token JWT `encargado@valdivia.cl` | `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` | HTTP `200 OK` con `bitacoraTiempos`, `reportesTerreno` y `evaluaciones.versionReportePrioridad: 2` | HTTP `200 OK` retornando `evaluaciones.versionReportePrioridad: 2` e hitos `['DESPACHADA','MISION_ACEPTADA','PRIORIDAD_ASIGNADA','PRIORIDAD_RECTIFICADA']` | APROBADO | 17/11/2026 14:25 | 18/11/2026 02:32 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-18` | Validación de sentencias SQL `up`/`down` de la migración `053_incidente_prioridad_y_evaluacion_terreno.ts` sobre Kysely | Base de Datos / Migración | Unitaria (`Kysely`) | Media | Archivo `053_incidente_prioridad_y_evaluacion_terreno.ts` y su suite de test | `npm test -- src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts` | `2/2` tests aprobados validando columnas `prioridad_sugerida`, `justificacion_prioridad`, `version_reporte`, `es_rectificacion` y `detalles_evaluacion` | `2/2` tests aprobados en Re-Test | APROBADO | 17/11/2026 14:22 | 18/11/2026 02:31 | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-19` | Ejecución completa de las suites automatizadas focalizadas de HU-38 y regresión general en Vitest | Automatización / Regresión | Unitaria / Mocked Integration | Alta | Entorno Node.js con dependencias instaladas | `npm test` y ejecución focalizada de los 8 archivos de HU-38/Incidentes/Misiones/OpenAPI | `35/35` tests focalizados (`8/8` archivos) y `885/885` tests globales (`80/80` archivos) aprobados | `35/35` focalizados (`3.86s`) y `885/885` globales (`80/80` archivos, `7.30s`) aprobados sin omisiones | APROBADO | 17/11/2026 14:22 | 18/11/2026 02:31 | test(incidentes): agregar pruebas de validacion autoritativa, pertenencia y concurrencia (HU-38) |
| `CP-H38-API-20` | Verificación de tipado estricto TypeScript (`tsc --noEmit`), linter (`eslint`), compilación de producción (`next build`) y documentación API (`docs/api/incidentes.md`) | Calidad Estática / Build / Docs | Compilación / Lint / Docs | Alta | Código fuente completo de la rama `feature/h38-patrulla-asignar-prioridad` | `npm run lint && npx tsc --noEmit && npm run build` + revisión de `docs/api/incidentes.md` | `0` errores de TypeScript, `0` errores de ESLint, `next build` exitoso y errores/ejemplos documentados en `docs/api/incidentes.md` | `tsc`: `0` errores; `eslint`: `0` errores (`1` warning heredado en `tipologia`); `next build`: `2.3s` (`27/27` páginas en `195ms`); `docs/api/incidentes.md` actualizado | APROBADO | 17/11/2026 14:23 | 18/11/2026 02:31 | docs(api): documentar errores y ejemplos de prioridad en terreno (HU-38) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H38-API-01	Bypass de cálculo autoritativo y justificación obligatoria enviando prioridadSugerida o familias en raíz, y anulación de riesgos snake_case en riesgosActivos	Seguridad / Validación Zod / Regla de Negocio (CA-3)	Schema / Utils / Endpoint	Crítica	Incidente con misión VERIFICACION en estado EN_CURSO	POST .../prioridad/calcular con {"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}} y PATCH .../prioridad con {"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}, con familias en raíz y sin evaluacion ante BD CRITICA	Cálculo autoritativo CRITICA (60 pts) en snake_case y rechazo 400 Bad Request si se intenta asignar BAJA sin justificación >= 5 caracteres	POST /calcular retorna CRITICA (60 pts) con flags true; las tres variantes PATCH sin justificación son rechazadas con HTTP 400 Bad Request (campo: "justificacion_prioridad")	CORREGIDO	17/11/2026 14:24	18/11/2026 02:32	fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)
BUG-H38-API-02	Bypass de autorización horizontal de patrulla cuando patrulla_id es NULL (ATENCION_CUADRILLA) y mutación sin control en POST /prioridad/calcular sobre incidentes RESUELTO o ajenos	Seguridad / Autorización Horizontal / Regla ICS	Repositorio / Endpoint	Crítica	Incidente INC-2026-0004 (ATENCION_CUADRILLA, patrulla_id = null), INC-2026-0006 (RESUELTO) e INC-2026-0003 (otra patrulla), usuario d1000000-...001	PATCH .../a1000000-...004/prioridad, POST .../a1000000-...006/prioridad/calcular y POST .../a1000000-...003/prioridad/calcular con x-user-id: d1000000-0000-4000-8000-000000000001	HTTP 409 Conflict para ATENCION_CUADRILLA y RESUELTO, y 403 Forbidden para incidente asignado a otra patrulla verificadora	Retorna HTTP 409 Conflict en ATENCION_CUADRILLA y RESUELTO, y HTTP 403 Forbidden en /calcular sobre patrulla ajena	CORREGIDO	17/11/2026 14:24	18/11/2026 02:32	fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)
BUG-H38-API-03	Desfase de 33 commits con develop, corrupción/colisión de migraciones Kysely (052_–055_ vs 035_, 042_, 061_, 071_), error 500 (42703) y DDL de runtime divergente	Integración / Base de Datos	Migraciones / Infraestructura	Alta	BD clonada desde develop (001–071) y BD vacía con PostGIS	npm run db:migrate en clon develop, npm run db:migrate en BD vacía e inspección de restricciones PostgreSQL	npm run db:migrate finaliza con EXIT 0 en ambos entornos, sin asegurarColumnasHu38EnEsquema ni regresiones sobre develop	npm run db:migrate exit 0 en clon (reconcilia 035_ -> 052_ y aplica 053_–055_) y en BD vacía (40 migraciones 001–071); uq_reporte_terreno_mision_version y chk_incidente_prioridad_sugerida verificados	CORREGIDO	17/11/2026 14:23	18/11/2026 02:31	merge: integrar develop en feature/h38-patrulla-asignar-prioridad conservando migracion 052
BUG-H38-API-04	Condición de carrera en version_reporte bajo peticiones concurrentes (duplicación de versión #1 e hito PRIORIDAD_ASIGNADA) y captura silenciosa try/catch de errores SQL	Concurrencia / Integridad ACID	Repositorio / BD	Alta	Incidente INC-2026-0003 con misión MIS-2026-0001 (EN_CURSO) sin reportes previos	Dos peticiones paralelas PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con x-user-id: 00000000-0000-4000-8000-000000000001	Serialización mediante .forUpdate() / .forUpdate("mision") generando versiones secuenciales #1 y #2 e hitos sin duplicados ni try/catch silenciosos	Peticiones serializadas generando versionReporte: 1 (PRIORIDAD_ASIGNADA) y versionReporte: 2 (PRIORIDAD_RECTIFICADA) verificados en reporte_terreno y mision_hito	CORREGIDO	17/11/2026 14:25	18/11/2026 02:32	fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)
BUG-H38-API-05	Esquema OpenAPI bearerAuth no declarado (versión 0.10.0 vs 0.12.0 de develop), omisión de familias, regresión WebSocket y documentación API incompleta	Contrato API / Tiempo Real	OpenAPI / Socket.io / Redis / Docs	Media	Servidor con REDIS_URL activo, consulta GET /openapi.json y revisión docs/api/incidentes.md	GET /openapi.json y suscripción Redis SUBSCRIBE sgrai:socket-events durante PATCH .../prioridad	components.securitySchemes.BearerAuth en 0.12.0, hasFamiliasInResp: true, emisión Redis a encargado, sala:encargados y supervisor sin duplicados, y docs/api/incidentes.md completo	openapi.json retorna version: "0.12.0", BearerAuth consistente y hasFamiliasInResp: true; Redis confirma salas completas de incidente:actualizado y mision:actualizada; docs/api/incidentes.md actualizado	CORREGIDO	17/11/2026 14:24	18/11/2026 02:33	fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)
CP-H38-API-01	Cálculo preliminar de prioridad_sugerida (ALTA, 47 pts) mediante POST /api/incidentes/{id}/prioridad/calcular	Funcional / Positiva (CA-1)	Integración / Endpoint	Crítica	Migración 053 aplicada en BD; incidente INC-2026-9932 (dd7db71e-...) en VERIFICACION asignado a la patrulla	POST /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular con {"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}	HTTP 200 OK con prioridadSugerida: "ALTA", puntajeTotal: 47, factoresGatillantes y requiereAsistenciaSocialSugerido: true	HTTP 200 OK retornando prioridadSugerida: "ALTA", puntajeTotal: 47 y requiereAsistenciaSocialSugerido: true	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-02	Confirmación de prioridad sugerida (ALTA) sin justificación creando Reporte #1 (Inicial) y registrando hito PRIORIDAD_ASIGNADA en mision_hito (200 OK)	Funcional / Positiva (CA-4)	Integración / Transacción ACID	Crítica	Misión MIS-2026-0008 aceptada (EN_CURSO) para Patrulla Rápida Las Ánimas (d1000000-...001)	PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad con {"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}	HTTP 200 OK actualizando incidente.prioridad y prioridad_sugerida a "ALTA", creando reporte_terreno #1 y mision_hito PRIORIDAD_ASIGNADA	HTTP 200 OK con modificoPrioridadSugerida: false, versionReporte: 1, esRectificacion: false e hito PRIORIDAD_ASIGNADA	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-03	Modificación y rectificación de prioridad (ALTA -> CRITICA) con justificación técnica >= 5 caracteres generando Reporte #2 (Rectificación) e hito PRIORIDAD_RECTIFICADA	Funcional / Positiva (CA-3, CA-4)	Integración / Transacción ACID	Crítica	Incidente INC-2026-9932 con Reporte #1 previo en misión MIS-2026-0008	PATCH .../prioridad con {"prioridad":"CRITICA","justificacion_prioridad":"...>=5 caracteres...","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}	HTTP 200 OK persistiendo prioridad: "CRITICA", prioridadSugerida: "ALTA", justificacionPrioridad, versionReporte: 2, esRectificacion: true y hito: "PRIORIDAD_RECTIFICADA"	HTTP 200 OK con Reporte #2 (Rectificación) y trazabilidad completa en incidente, reporte_terreno y mision_hito	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-04	Validación de los cuatro niveles canónicos del enum PrioridadIncidente (BAJA, MEDIA, ALTA, CRITICA) y rechazo de valores fuera de catálogo	Validación / Contrato (CA-2)	Schema Zod	Alta	Esquema PrioridadCanonicaEnum y ActualizarPrioridadIncidenteInputSchema	PrioridadCanonicaEnum.options y safeParse({ prioridad: "EXTREMA" })	Enum exacto ["BAJA","MEDIA","ALTA","CRITICA"] y rechazo success: false ante "EXTREMA"	Retorna exactamente ['BAJA','MEDIA','ALTA','CRITICA'] y rechaza "EXTREMA" con error en path: ['prioridad']	APROBADO	17/11/2026 14:28	18/11/2026 02:31	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-05	Rechazo 400 Bad Request al cambiar prioridad_sugerida (MEDIA -> CRITICA) sin proporcionar justificacion_prioridad	Regla de Negocio / Negativa (CA-3)	Integración / Schema Zod	Crítica	Usuario autenticado con permiso misiones:terreno:verificar	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con {"prioridad":"CRITICA","prioridad_sugerida":"MEDIA"}	HTTP 400 Bad Request indicando obligatoriedad de justificación técnica >= 5 caracteres	HTTP 400 Bad Request con errors[0].campo = "justificacion_prioridad"	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-06	Rechazo 400 Bad Request cuando justificacion_prioridad ante discrepancia tiene menos de 5 caracteres ("mal" / "abc")	Valor Límite / Validación (CA-3)	Integración / Endpoint y Unit	Crítica	Misión MIS-2026-0008 en estado EN_CURSO	PATCH .../prioridad con {"prioridad":"CRITICA","justificacion_prioridad":"mal","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}	HTTP 400 Bad Request rechazando justificación inferior a 5 caracteres	HTTP 400 Bad Request con mensaje de mínimo 5 caracteres en justificacion_prioridad	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-07	Rechazo de petición sin credenciales de autenticación (401 Unauthorized) y con token JWT Bearer inválido (401 Unauthorized)	Seguridad / Autenticación	Integración / Endpoint	Crítica	Peticiones sin Authorization/x-user-id y con Authorization: Bearer token.invalido.123	PATCH /api/incidentes/{id}/prioridad sin cabeceras y con token JWT manipulado	HTTP 401 Unauthorized rechazando acceso no autenticado o firma inválida	HTTP 401 Unauthorized verificando bloqueo sin cabecera y con firma inválida	APROBADO	17/11/2026 14:26	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-08	Flujo autenticado con JWT Bearer (Authorization: Bearer <token>) emitido por POST /api/seguridad/login para patrulla verificadora (200 OK)	Seguridad / Integración JWT (CA-6)	Integración / Endpoint	Crítica	Usuario pedro.patrulla@valdivia.cl activo con rol PATRULLA_VERIFICADORA	Login en /api/seguridad/login y ejecución de PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad #1 (ALTA) y #2 (CRITICA) con Authorization: Bearer <JWT>	HTTP 200 OK identificando al evaluador Pedro Valenzuela mediante token JWT	HTTP 200 OK en ambas operaciones generando Reporte #1 y Reporte #2 a nombre de Pedro Valenzuela	APROBADO	17/11/2026 14:26	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-09	Rechazo RBAC 403 Forbidden para usuario sin permiso misiones:terreno:verificar (CALL_CENTER)	Seguridad / RBAC (CA-6)	Integración / Endpoint	Crítica	Usuario c1111111-1111-4111-8111-111111111111 con rol CALL_CENTER	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con x-user-id: c1111111-1111-4111-8111-111111111111	HTTP 403 Forbidden indicando ausencia de misiones:terreno:verificar	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-10	Rechazo 403 Forbidden al intentar evaluar un incidente cuya misión VERIFICACION está asignada a otra patrulla verificadora	Seguridad / Autorización	Integración / Endpoint	Alta	Incidente INC-2026-0003 (MIS-2026-0001 asignada a Patrulla Rápida Costa-1)	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con x-user-id: d1000000-0000-4000-8000-000000000001	HTTP 403 Forbidden impidiendo modificar prioridades de misiones de otra patrulla	HTTP 403 Forbidden: {"message":"No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."}	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-11	Rechazo 400 Bad Request por parámetro de ruta id no UUID y por cuerpo JSON malformado	Validación / Robustez	Integración / Endpoint	Media	Parámetro id-invalido o body {malformed	PATCH /api/incidentes/id-invalido/prioridad y PATCH .../prioridad con -d '{malformed'	HTTP 400 Bad Request en ambos casos con mensaje descriptivo	HTTP 400 Bad Request ("El identificador del incidente proporcionado no es un UUID válido." y "El cuerpo de la petición no es un JSON válido.")	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-12	Rechazo 404 Not Found cuando el identificador UUID del incidente no existe en base de datos	Funcional / Negativa	Integración / Endpoint	Alta	UUID inexistente 50000000-0000-4000-8000-000000000999	PATCH /api/incidentes/50000000-0000-4000-8000-000000000999/prioridad con {"prioridad":"ALTA"}	HTTP 404 Not Found con mensaje de incidente no encontrado	HTTP 404 Not Found: {"message":"No se encontró ningún incidente con el identificador proporcionado."}	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-13	Bloqueo 409 Conflict cuando la misión de verificación aún está en estado DESPACHADA (pendiente de aceptación por patrulla)	Regla de Negocio ICS	Integración / Endpoint	Alta	Incidente INC-2026-0001 / INC-2026-9932 con misión en estado DESPACHADA	PATCH /api/incidentes/{id}/prioridad previo a POST .../aceptar	HTTP 409 Conflict exigiendo aceptar la misión antes de asignar prioridad	HTTP 409 Conflict: {"message":"La patrulla debe aceptar la misión asignada antes de poder asignar o modificar la prioridad del incidente en terreno."}	APROBADO	17/11/2026 14:24	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-14	Reglas deterministas de motor de sugerencia: disparo directo a CRITICA con electrodependientes, alias snake_case y ajuste de nucleoFamiliarTotal	Funcional / Lógica de Dominio	Unitaria (prioridad.utils)	Alta	Funciones calcularPrioridadSugerida y normalizarEvaluacionTerreno	npm test -- src/modules/incidentes/__tests__/prioridad.utils.test.ts	7/7 tests aprobados validando niveles BAJA, MEDIA, ALTA, CRITICA, riesgos snake_case y resúmenes versionados	7/7 tests aprobados en Re-Test	APROBADO	17/11/2026 14:22	18/11/2026 02:31	test(incidentes): agregar pruebas de validacion autoritativa, pertenencia y concurrencia (HU-38)
CP-H38-API-15	Publicación de eventos WebSocket incidente:actualizado (sala:encargados, encargado, mapa) y mision:actualizada (encargado, sala:encargados, supervisor) en Redis Pub/Sub (CA-5)	Tiempo Real / Socket.io	Integración / Redis Pub/Sub	Alta	Suscriptor Redis en canal sgrai:socket-events durante ejecución de PATCH .../prioridad	docker exec grupo1_redis redis-cli SUBSCRIBE sgrai:socket-events + PATCH .../prioridad	Mensajes publicados en todas las salas requeridas conteniendo prioridad, prioridadSugerida, justificacionPrioridad, verificado: true y reporteTerreno	Eventos incidente:actualizado y mision:actualizada verificados en todas las salas esperadas con payload íntegro	APROBADO	17/11/2026 14:24	18/11/2026 02:33	fix(incidentes): resolver hallazgos QA BUG-H38-API-01 a BUG-H38-API-05 (HU-38)
CP-H38-API-16	Proyección de prioridad, prioridadSugerida, justificacionPrioridad, totalReportesTerreno, trazabilidadNotificacion y reportesEvaluacionTerreno en Kanban y detalle (GET /api/incidentes)	Funcional / Integración Lectura (CA-5)	Integración / Endpoint	Alta	Incidente INC-2026-9932 actualizado en BD y token JWT de encargado@valdivia.cl	GET /api/incidentes?busqueda=INC-2026-9932 y GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38	HTTP 200 OK proyectando prioridad actualizada, totalReportesTerreno, trazabilidadNotificacion e historial reportesEvaluacionTerreno	HTTP 200 OK con totalReportesTerreno: 2, trazabilidadNotificacion: "PENDIENTE_ENVIO", verificado: true y versiones: [2, 1]	APROBADO	17/11/2026 14:25	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-17	Proyección de hitos PRIORIDAD_ASIGNADA/PRIORIDAD_RECTIFICADA, reportes versionados y resumen evaluaciones en GET /api/misiones/{id}	Funcional / Trazabilidad ICS	Integración / Endpoint	Media	Misión MIS-2026-0008 con evaluaciones #1 y #2 registradas y token JWT encargado@valdivia.cl	GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02	HTTP 200 OK con bitacoraTiempos, reportesTerreno y evaluaciones.versionReportePrioridad: 2	HTTP 200 OK retornando evaluaciones.versionReportePrioridad: 2 e hitos ['DESPACHADA','MISION_ACEPTADA','PRIORIDAD_ASIGNADA','PRIORIDAD_RECTIFICADA']	APROBADO	17/11/2026 14:25	18/11/2026 02:32	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-18	Validación de sentencias SQL up/down de la migración 053_incidente_prioridad_y_evaluacion_terreno.ts sobre Kysely	Base de Datos / Migración	Unitaria (Kysely)	Media	Archivo 053_incidente_prioridad_y_evaluacion_terreno.ts y su suite de test	npm test -- src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts	2/2 tests aprobados validando columnas prioridad_sugerida, justificacion_prioridad, version_reporte, es_rectificacion y detalles_evaluacion	2/2 tests aprobados en Re-Test	APROBADO	17/11/2026 14:22	18/11/2026 02:31	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-19	Ejecución completa de las suites automatizadas focalizadas de HU-38 y regresión general en Vitest	Automatización / Regresión	Unitaria / Mocked Integration	Alta	Entorno Node.js con dependencias instaladas	npm test y ejecución focalizada de los 8 archivos de HU-38/Incidentes/Misiones/OpenAPI	35/35 tests focalizados (8/8 archivos) y 885/885 tests globales (80/80 archivos) aprobados	35/35 focalizados (3.86s) y 885/885 globales (80/80 archivos, 7.30s) aprobados sin omisiones	APROBADO	17/11/2026 14:22	18/11/2026 02:31	test(incidentes): agregar pruebas de validacion autoritativa, pertenencia y concurrencia (HU-38)
CP-H38-API-20	Verificación de tipado estricto TypeScript (tsc --noEmit), linter (eslint), compilación de producción (next build) y documentación API (docs/api/incidentes.md)	Calidad Estática / Build / Docs	Compilación / Lint / Docs	Alta	Código fuente completo de la rama feature/h38-patrulla-asignar-prioridad	npm run lint && npx tsc --noEmit && npm run build + revisión de docs/api/incidentes.md	0 errores de TypeScript, 0 errores de ESLint, next build exitoso y errores/ejemplos documentados en docs/api/incidentes.md	tsc: 0 errores; eslint: 0 errores (1 warning heredado en tipologia); next build: 2.3s (27/27 páginas en 195ms); docs/api/incidentes.md actualizado	APROBADO	17/11/2026 14:23	18/11/2026 02:31	docs(api): documentar errores y ejemplos de prioridad en terreno (HU-38)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test 18/11/2026)

### 5.1 Pruebas Automatizadas (Vitest), Linter, TypeScript y Compilación de Producción

#### 5.1.1 Suite Focalizada de HU-38 y Módulos Relacionados (`CP-H38-API-14`, `CP-H38-API-18`, `CP-H38-API-19`)
```bash
npm test -- src/app/api/incidentes/\[id\]/prioridad/__tests__/route.test.ts src/modules/incidentes/__tests__/prioridad.repository.test.ts src/modules/incidentes/__tests__/prioridad.service.test.ts src/modules/incidentes/__tests__/prioridad.utils.test.ts src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts src/modules/incidentes/__tests__/incidente-kanban.service.test.ts src/modules/misiones/__tests__/mision.service.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Resultado en Re-Test (18/11/2026):**
```text
 ✓ src/modules/incidentes/__tests__/prioridad.utils.test.ts (7 tests)
 ✓ src/modules/misiones/__tests__/mision.service.test.ts (6 tests)
 ✓ src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts (2 tests)
 ✓ src/modules/incidentes/__tests__/incidente-kanban.service.test.ts (6 tests)
 ✓ src/modules/incidentes/__tests__/prioridad.service.test.ts (1 test)
 ✓ src/modules/incidentes/__tests__/prioridad.repository.test.ts (5 tests)
 ✓ src/app/api/incidentes/[id]/prioridad/__tests__/route.test.ts (7 tests)
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test)

 Test Files  8 passed (8)
      Tests  35 passed (35)
   Duration  3.86s
```

#### 5.1.2 Suite Completa del Repositorio y Ejecución por Patrón (`-t`)
```bash
npm test
npm test -- -t "Route Handlers de Prioridad de Incidente en Terreno \(HU-38\)"
npm test -- -t "PrioridadRepository \(HU-38\)"
npm test -- -t "Motor de Cálculo de Prioridad Sugerida en Terreno \(HU-38\)"
```

**Salida de Consola (`npm test`):**
```text
 Test Files  80 passed (80)
      Tests  885 passed (885)
   Duration  7.30s
```

#### 5.1.3 Verificación Estática y Compilación (`CP-H38-API-20`)
```bash
npm run lint && npx tsc --noEmit && npm run build
```

**Salida de Consola en Re-Test:**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts
  13:3  warning  'BadRequestError' is defined but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (0 errors, 1 warning)

=== TSC ===
(0 errors, exit code 0)

=== BUILD ===
✓ Compiled successfully in 2.3s
✓ Generating static pages using 15 workers (27/27) in 195ms
```

---

### 5.2 Verificación de Migraciones Kysely y Esquema PostgreSQL en Re-Test (`BUG-H38-API-03`)

```bash
# 1. Base clonada desde develop (conteniendo 035_, 042_, 061_, 071_)
DATABASE_URL=postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_retest npm run db:migrate

# 2. Base vacía creada desde cero (con PostGIS)
DATABASE_URL=postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_fresh npm run db:migrate
```

**Evidencia Obtenida en Re-Test:**
* En `sgrai_qa_retest`: `npm run db:migrate` finalizó con **código `0`**, reconciliando `"035_permiso_misiones_terreno_verificar" -> "052_permiso_misiones_terreno_verificar"` y aplicando `053_incidente_prioridad_y_evaluacion_terreno`, `054_resync_titulo_mision_verificacion` y `055_mision_hito_metadatos`.
* En `sgrai_qa_fresh`: `npm run db:migrate` ejecutó las **40 migraciones (`001` a `071`)** con **código `0`**.
* Verificación de DDL en PostgreSQL: confirmada la existencia del índice único `uq_reporte_terreno_mision_version` sobre `reporte_terreno (mision_id, version_reporte)` y la restricción `chk_incidente_prioridad_sugerida` en `incidente`.

---

### 5.3 Pruebas Replicables HTTP/cURL (Casos Negativos RBAC/Validación/ICS y Flujo End-to-End con JWT)

#### 5.3.1 Rechazos de Autenticación (`401`), RBAC (`403`) y Autorización Horizontal (`403`) (`CP-H38-API-07`, `09`, `10`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "Authorization: Bearer token.invalido.123" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: c1111111-1111-4111-8111-111111111111" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"CRITICA"}'
```

**Respuestas HTTP Obtenidas:**
* Sin credenciales: `HTTP/1.1 401 Unauthorized`
* Token JWT inválido: `HTTP/1.1 401 Unauthorized`
* Usuario `CALL_CENTER` sin permiso `misiones:terreno:verificar`: `HTTP/1.1 403 Forbidden` (`{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}`)
* Patrulla no asignada al incidente `INC-2026-0003`: `HTTP/1.1 403 Forbidden` (`{"message":"No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."}`)

#### 5.3.2 Rechazos de Validación (`400`), Recurso Inexistente (`404`) y Regla ICS (`409`) (`CP-H38-API-05`, `06`, `11`, `12`, `13`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/id-invalido/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{malformed'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"CRITICA","prioridad_sugerida":"MEDIA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/50000000-0000-4000-8000-000000000999/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

# Incidente INC-2026-0001 con misión en estado DESPACHADA
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000001/prioridad" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'
```

**Respuestas HTTP Obtenidas:**
* UUID inválido: `HTTP/1.1 400 Bad Request`
* JSON malformado: `HTTP/1.1 400 Bad Request`
* Cambio de prioridad sin justificación >= 5 caracteres (`"mal"` o ausente): `HTTP/1.1 400 Bad Request` (`errors[0].campo = "justificacion_prioridad"`)
* UUID inexistente: `HTTP/1.1 404 Not Found`
* Misión en estado `DESPACHADA` (`INC-2026-0001`): `HTTP/1.1 409 Conflict`

#### 5.3.3 Flujo Completo de Patrulla con JWT Bearer, Lectura Kanban y Detalle de Misión (`CP-H38-API-01`, `02`, `03`, `08`, `16`, `17`)
```bash
# 1. Aceptar misión MIS-2026-0008
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588,"longitud":-73.245209}'

# 2. Autenticación JWT de patrulla verificadora
TOKEN_PEDRO=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}' | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token || d.accessToken || d.data?.token || "");')

# 3. Confirmación #1 de prioridad sugerida ALTA (Reporte #1)
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}'

# 4. Rectificación #2 a CRITICA con justificación >= 5 caracteres (Reporte #2)
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"CRITICA","justificacion_prioridad":"Confirmado riesgo crítico en terreno por paciente electrodependiente.","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}'

# 5. Verificación en Kanban, detalle de incidente y detalle de misión
curl -s "http://localhost:3001/api/incidentes?busqueda=INC-2026-9932" -H "Authorization: Bearer $TOKEN_ENCARGADO"
curl -s "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38" -H "Authorization: Bearer $TOKEN_ENCARGADO"
curl -s "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02" -H "Authorization: Bearer $TOKEN_ENCARGADO"
```

**Evidencias Verificadas en Re-Test:**
* `POST /aceptar`, `PATCH` #1 (`ALTA`) y `PATCH` #2 (`CRITICA`) respondieron `HTTP/1.1 200 OK`.
* `GET /api/incidentes?busqueda=INC-2026-9932`: `HTTP/1.1 200 OK` con `totalReportesTerreno: 2`, `trazabilidadNotificacion: "PENDIENTE_ENVIO"`, `verificado: true`.
* `GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38`: `HTTP/1.1 200 OK` con historial versionado `[2, 1]`.
* `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02`: `HTTP/1.1 200 OK` con `evaluaciones.versionReportePrioridad: 2` y bitácora de hitos `['DESPACHADA','MISION_ACEPTADA','PRIORIDAD_ASIGNADA','PRIORIDAD_RECTIFICADA']`.

---

### 5.4 Verificación en Vivo de Subsanación de Defectos en Re-Test (`BUG-H38-API-01`, `02`, `04`, `05`)

```bash
# 1. BUG-H38-API-01: snake_case en riesgosActivos y bloqueo de bypass cliente
curl -s -i -X POST "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"BAJA","familias":[{"nucleoFamiliarTotal":3,"personasElectrodependientes":1}]}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"BAJA","prioridadSugerida":"BAJA"}'

# 2. BUG-H38-API-02: Bloqueo en ATENCION_CUADRILLA, RESUELTO y patrulla ajena en /calcular
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000004/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"BAJA","prioridadSugerida":"BAJA"}'

curl -s -i -X POST "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000006/prioridad/calcular" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{}'

curl -s -i -X POST "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad/calcular" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{}'

# 3. BUG-H38-API-04: Concurrencia serializada en reporte_terreno
curl -s -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","prioridadSugerida":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"nivelCompromisoVivienda":"MODERADO"}}' &
curl -s -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","prioridadSugerida":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"nivelCompromisoVivienda":"MODERADO"}}' &
wait

# 4. BUG-H38-API-05: Inspección OpenAPI y Redis Pub/Sub
curl -s http://localhost:3001/openapi.json | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log({version: d.info.version, hasBearerAuth: Boolean(d.components?.securitySchemes?.BearerAuth), patchSec: d.paths["/api/incidentes/{id}/prioridad"]?.patch?.security, calcSec: d.paths["/api/incidentes/{id}/prioridad/calcular"]?.post?.security});'
```

**Evidencias Verificadas en Re-Test (18/11/2026):**
```text
# BUG-H38-API-01:
POST /calcular (snake_case): HTTP/1.1 200 OK -> "prioridadSugerida":"CRITICA","puntajeTotal":60,"riesgosActivos":{"riesgoElectrico":true,"riesgoEstructural":true,"riesgoQuimicoSanitario":false,"aislamientoVial":true}
PATCH (override evaluacion), PATCH (familias en raíz) y PATCH (override vs BD CRITICA): HTTP/1.1 400 Bad Request (campo: "justificacion_prioridad")

# BUG-H38-API-02:
PATCH INC-2026-0004 (ATENCION_CUADRILLA, patrulla_id = null): HTTP/1.1 409 Conflict -> "No existe una misión de verificación asociada a este incidente para registrar la evaluación de prioridad en terreno."
POST INC-2026-0006/prioridad/calcular (RESUELTO): HTTP/1.1 409 Conflict -> "No se puede recalcular la prioridad de un incidente en estado 'RESUELTO'."
POST INC-2026-0003/prioridad/calcular (patrulla ajena): HTTP/1.1 403 Forbidden -> "No está autorizado para evaluar la prioridad de un incidente asignado a otra patrulla verificadora."

# BUG-H38-API-04:
Peticiones concurrentes serializadas en PostgreSQL (.forUpdate / .forUpdate("mision")):
Respuesta A -> versionReporte: 1, esRectificacion: false, hito: "PRIORIDAD_ASIGNADA"
Respuesta B -> versionReporte: 2, esRectificacion: true, hito: "PRIORIDAD_RECTIFICADA"

# BUG-H38-API-05:
OpenAPI: { version: '0.12.0', hasBearerAuth: true, patchSec: [ { BearerAuth: [] } ], calcSec: [ { BearerAuth: [] } ], hasFamiliasInResp: true }
Redis sgrai:socket-events:
  - incidente:actualizado emitido a salas "sala:encargados", "encargado", "mapa"
  - mision:actualizada emitido a salas "encargado", "sala:encargados", "supervisor"
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (Post Re-Test)

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La PWA debe mostrar de forma visible la `prioridad_sugerida` calculada preliminarmente por el sistema. | `CP-H38-API-01`, `CP-H38-API-14`, `BUG-H38-API-01`, `BUG-H38-API-02`, `BUG-H38-API-03` | 🟢 **APROBADO EN RE-TEST (API)** *(UI en `sgrai-pwa`)* | `POST /api/incidentes/{id}/prioridad/calcular` soporta claves `camelCase` y `snake_case` (incluidos `riesgosActivos`), valida pertenencia a patrulla asignada y rechaza estados cerrados (`409 Conflict`) con migraciones limpias. La representación visual corresponde a `sgrai-pwa`. |
| **CA-2:** Debe proveer un selector con los cuatro niveles de prioridad canónicos del sistema: `BAJA`, `MEDIA`, `ALTA`, `CRITICA`. | `CP-H38-API-04`, `CP-H38-API-19` | 🟢 **APROBADO EN RE-TEST (API)** *(UI en `sgrai-pwa`)* | `PrioridadCanonicaEnum` valida estrictamente los cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y rechaza valores fuera de catálogo con `400 Bad Request`. El componente selector corresponde a `sgrai-pwa`. |
| **CA-3:** Si la patrulla decide modificar la prioridad sugerida, el sistema debe desplegar un campo de texto obligatorio para ingresar la justificación técnica (`justificacion_prioridad` de al menos 5 caracteres). | `CP-H38-API-03`, `CP-H38-API-05`, `CP-H38-API-06`, `BUG-H38-API-01` | 🟢 **APROBADO EN RE-TEST (API)** *(UI en `sgrai-pwa`)* | El esquema Zod y el repositorio imponen el cálculo autoritativo de `prioridad_sugerida` (incluyendo evaluaciones vía `familias` en la raíz o valores persistidos en BD), rechazando con `400 Bad Request` cualquier discrepancia sin `justificacion_prioridad >= 5` caracteres. El despliegue condicional en UI corresponde a `sgrai-pwa`. |
| **CA-4:** Al confirmar, la API debe actualizar en una transacción: (1) `incidente.prioridad`, (2) `incidente.justificacion_prioridad`, y (3) Registrar el hito de cambio de prioridad en `mision_hito`. | `CP-H38-API-02`, `CP-H38-API-03`, `CP-H38-API-17`, `CP-H38-API-18`, `BUG-H38-API-03`, `BUG-H38-API-04` | 🟢 **APROBADO EN RE-TEST (API)** | La transacción ACID serializa peticiones concurrentes mediante `.forUpdate()` / `.forUpdate("mision")`, índice único `uq_reporte_terreno_mision_version` y `MAX(version_reporte) + 1`, actualizando `incidente`, insertando en `reporte_terreno` y registrando `PRIORIDAD_ASIGNADA` / `PRIORIDAD_RECTIFICADA` en `mision_hito`. |
| **CA-5:** El sistema debe emitir la notificación WebSocket `incidente:actualizado` al Centro de Mando, reflejando el nuevo badge de prioridad en el tablero Kanban. | `CP-H38-API-15`, `CP-H38-API-16`, `BUG-H38-API-05` | 🟢 **APROBADO EN RE-TEST (API)** *(UI en `sgrai-web`)* | Emisión WebSocket/Redis verificada para `incidente:actualizado` (`sala:encargados`, `encargado`, `mapa`) y `mision:actualizada` (`encargado`, `sala:encargados`, `supervisor`) sin broadcasts duplicados; `GET /api/incidentes` y `GET /api/incidentes/{id}` proyectan los datos actualizados. El renderizado del badge corresponde a `sgrai-web`. |
| **CA-6:** El endpoint debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H38-API-07`, `CP-H38-API-08`, `CP-H38-API-09`, `CP-H38-API-10`, `BUG-H38-API-02`, `BUG-H38-API-03`, `BUG-H38-API-05` | 🟢 **APROBADO EN RE-TEST (API)** | Validación de `401` (sin token/inválido), `403` por RBAC (`CALL_CENTER`) y pertenencia a patrulla verificadora activa (`tipo_mision = 'VERIFICACION'`, `patrulla_id` obligatorio), `409` en `ATENCION_CUADRILLA` / `DESPACHADA` / `RESUELTO`, y contrato OpenAPI `0.12.0` con `BearerAuth`. |
