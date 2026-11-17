# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-38 — Asignar o Modificar Prioridad del Incidente por Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Incidentes / Operaciones de Terreno (`sgrai-api` — `POST /api/incidentes/[id]/prioridad/calcular` y `PATCH /api/incidentes/[id]/prioridad`).  
> **Historia de Usuario:** HU-38 — *"Como Patrulla verificadora Quiero asignar o modificar la prioridad del incidente basándose en la sugerencia del sistema y la evaluación técnica en terreno. Para garantizar que los recursos tácticos pesados y cuadrillas se destinen prioritariamente a las emergencias con mayor nivel de gravedad."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h38-patrulla-asignar-prioridad`  
> **Commits Evaluados en la Rama:**  
> * `feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)`  
> * `merge: rama 'develop' hacia feature/h38-patrulla-asignar-prioridad`  
>  
> **Fecha de Auditoría:** 17/11/2026 14:28.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense del código fuente, verificación de reglas de validación Zod y cálculo determinista de severidad, revisión de control de acceso horizontal y vertical (RBAC), análisis de transacciones ACID y concurrencia en PostgreSQL/Kysely, auditoría de secuencia de migraciones respecto a `develop`, validación de contratos OpenAPI 3.0, inspección de difusión en tiempo real vía Redis Pub/Sub y Socket.io, ejecución de pruebas automatizadas en Vitest y pruebas funcionales/adversariales en vivo mediante `cURL` sobre la rama `feature/h38-patrulla-asignar-prioridad`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** debido a la detección de **5 defectos reales** (**2 críticos, 2 altos y 1 medio**).

Entre los hallazgos bloqueantes destacan la posibilidad de eludir la validación obligatoria de `justificacion_prioridad` (`CA-3`) enviando `prioridadSugerida` desde el cliente o mediante `familias` en la raíz del payload, la pérdida silenciosa de banderas de riesgo en formato `snake_case` dentro de `riesgosActivos`, el bypass de pertenencia a patrulla verificadora cuando `mision.patrulla_id` es `NULL` (ej. misiones `ATENCION_CUADRILLA` en curso) y la mutación sin control de acceso en `/prioridad/calcular` incluso sobre incidentes `RESUELTO`, la ruptura de la secuencia de migraciones frente a `develop` (33 commits de desfase y fallo de `npm run db:migrate`), una condición de carrera que permite duplicar `version_reporte = 1` ante peticiones concurrentes, y regresiones en OpenAPI 3.0 y Socket.io.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H38-API-01` a `05`) + 20 Casos Funcionales, Seguridad RBAC, ICS, Contrato y Suite (`CP-H38-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Flujo nominal de cálculo y actualización versionada (`#1`, `#2`...), validación de enum canónico, rechazo `< 5` caracteres ante discrepancia sin override, `401`, `403`, `404`, `409` en misión `DESPACHADA`, eventos `incidente:actualizado` en Redis y suites Vitest |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Pruebas en vivo verificadas aislando la migración `053`–`055` sobre clon temporal de PostgreSQL 16 + Redis 7 |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere el 100.0% (0 defectos abiertos) en Re-Test para aprobar la integración a `develop` |
| **Suite Completa del Repositorio (Vitest)** | **74/74 archivos (835/835 tests pass)** | Ejecución con mocks de base de datos y servicios |
| **Suite Focalizada HU-38 (Vitest)** | **8/8 archivos (34/34 tests pass)** | `prioridad/__tests__/route.test.ts` (7), `prioridad.repository.test.ts` (5), `prioridad.service.test.ts` (1), `prioridad.utils.test.ts` (6), `053_...test.ts` (2), `incidente-kanban.service.test.ts` (6), `mision.service.test.ts` (6) y `openapi.json` (1) |
| **Compilación de Tipos (`npx tsc --noEmit`)** | **0 errores** | Verificación estricta de TypeScript aprobada |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores / 1 warning** | 1 warning de variable no usada (`BadRequestError`) en `src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts:13` |
| **Compilación de Producción (`npm run build`)** | **Exitosa** | Next.js 16.3.4 (Turbopack) compila todas las rutas API incluyendo `/prioridad` y `/prioridad/calcular` |
| **Secuencia de Migraciones Kysely (`npm run db:migrate`)** | 🔴 **Fallo crítico (`EXIT 1`)** | Rama 33 commits detrás de `develop`; `npm run db:migrate` aborta por migración faltante `042_cuadrilla_patrulla_integrantes_vistas` y colisiona `052_`–`055_` con `035_`, `061_` y `071_` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H38-API-01`: Bypass de Validación Autoritativa de `prioridad_sugerida` y Justificación Obligatoria (`CA-3`), Pérdida Silenciosa de Riesgos `snake_case` y Omisión de `familias` en Raíz
* **Severidad:** **CRÍTICA** (Evasión de Regla de Negocio CA-3 y Corrupción de Datos de Priorización).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/incidentes/prioridad.schema.ts` (Líneas 16-27, 272-306 y 387-419)
  * `src/modules/incidentes/prioridad.repository.ts` (Líneas 54-92 y 261-300)
  * `src/modules/incidentes/prioridad.utils.ts` (Líneas 221-250)
* **Descripción Técnica del Defecto:**  
  Se detectaron tres fallas encadenadas en la validación y cálculo de `prioridad_sugerida`:
  1. **Prioridad sugerida manipulable desde el cliente (`prioridad.schema.ts:392-405` y `prioridad.repository.ts:270-279`):** Aunque el contrato OpenAPI (`prioridad.schema.ts:323`) y la documentación del repositorio (`prioridad.repository.ts:146`) indican que si se envía la evaluación en terreno se recalcula `prioridad_sugerida` autoritativamente en el servidor, ambos módulos priorizan el valor enviado por el cliente (`prioridadSugerida ?? prioridad_sugerida`):
     ```typescript
     // prioridad.repository.ts:273-279
     const prioridadSugerida: PrioridadIncidente = prioridadSugeridaExplicita
       ? prioridadSugeridaExplicita
       : envioDatosEvaluacion
         ? calculo.prioridadSugerida
         : ((incidenteExistente.prioridad_sugerida ??
             incidenteExistente.prioridad ??
             "MEDIA") as PrioridadIncidente);
     ```
     Si una petición envía `prioridad: "BAJA"` y `prioridadSugerida: "BAJA"` junto con una evaluación de riesgo vital (`personasElectrodependientes: 2`, `nivelCompromisoVivienda: "GRAVE_INHABITABLE"`, `requiereEvacuacion: true`, que el servidor evalúa en `185 pts` = `"CRITICA"`), el sistema acepta la operación con `200 OK`, omite por completo exigir `justificacion_prioridad` y sobrescribe `incidente.prioridad_sugerida` y `reporte_terreno.prioridad_sugerida` con `"BAJA"`. Lo mismo ocurre si `POST /calcular` ya había persistido `"CRITICA"` en `incidente.prioridad_sugerida` y luego se envía `PATCH` sin `evaluacion` pero forzando `prioridadSugerida: "BAJA"`.
  2. **Anulación silenciosa de riesgos `snake_case` en `RiesgosActivosEvaluacionSchema` (`prioridad.schema.ts:16-27` y `prioridad.utils.ts:221-250`):** `RiesgosActivosEvaluacionSchema` declara `.default(false).optional()` en las propiedades `camelCase` (`riesgoElectrico`, `riesgoEstructural`, `riesgoQuimicoSanitario`, `aislamientoVial`). Al ejecutar `safeParse` sobre un objeto con claves `snake_case` (ej. `{ riesgosActivos: { riesgo_electrico: true, riesgo_estructural: true, aislamiento_vial: true } }`), Zod inyecta `riesgoElectrico: false`, `riesgoEstructural: false` y `aislamientoVial: false`. Luego, en `prioridad.utils.ts:223`, la expresión `riesgosRaw.riesgoElectrico ?? riesgosRaw.riesgo_electrico` evalúa `false ?? true`, retornando `false` y descartando todas las banderas `snake_case` (`BAJA`, `0 pts` en lugar de `CRITICA`, `60 pts`).
  3. **Omisión de `familias` en la detección de evaluación en raíz (`prioridad.schema.ts:272-306` y `prioridad.repository.ts:54-92`):** Ni `tieneCamposEvaluacionEnRaiz` ni `CLAVES_EVALUACION_RAIZ` contemplan `"familias"`, `"familiasAfectadas"`, `"familias_afectadas"`, `"requiereAsistenciaSocial"` o `"requiere_asistencia_social"`. Enviar `familias` en el nivel raíz del payload de `PATCH /prioridad` (sin envolverlo en `evaluacion`) provoca que `envioDatosEvaluacion` sea `false` y no se recalcule `prioridad_sugerida` ni se exija justificación ante discrepancia. Además, `prioridad.schema.ts:397` evalúa `data.evaluacion ?? data` mientras `prioridad.repository.ts:264` fusiona `{ ...rawObj, ...input.evaluacion }`, generando posibles divergencias entre capas.
* **Pasos para Reproducir:**
  1. Invocar `POST /api/incidentes/{id}/prioridad/calcular` con payload `{"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}}`.
  2. Invocar `PATCH /api/incidentes/{id}/prioridad` con `{"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}` (sin `justificacion_prioridad`).
  3. Invocar `PATCH /api/incidentes/{id}/prioridad` con `{"prioridad":"BAJA","familias":[{"nucleoFamiliarTotal":3,"personasElectrodependientes":1}]}` (sin `justificacion_prioridad`).
* **Comportamiento Actual:**
  * Caso 1 retorna `200 OK` con `prioridadSugerida: "BAJA"` y `puntajeTotal: 0`.
  * Caso 2 retorna `200 OK` (`modificoPrioridadSugerida: false`), guarda `prioridad: "BAJA"` y `prioridad_sugerida: "BAJA"` pese a registrar `puntajeTotal: 185` en el mismo reporte.
  * Caso 3 retorna `200 OK` heredando `prioridadSugerida` previa (`"BAJA"`) e ignorando al paciente electrodependiente declarado en `familias`.
* **Comportamiento Esperado:**
  * Cuando existan datos de evaluación en terreno (incluyendo `familias`), el servidor debe calcular autoritativamente `prioridadSugerida` ignorando cualquier `prioridadSugerida` enviada por el cliente; y si no hay datos de evaluación nuevos, debe usar el valor persistido en `incidente.prioridad_sugerida` (o `incidente.prioridad` si es `NULL`), exigiendo siempre `justificacion_prioridad >= 5` caracteres cuando `prioridadAsignada !== prioridadSugerida`.
  * `RiesgosActivosEvaluacionSchema` no debe aplicar `.default(false)` en propiedades `camelCase` para permitir el fallback real hacia los alias `snake_case`.
  * `tieneCamposEvaluacionEnRaiz` y `CLAVES_EVALUACION_RAIZ` deben incluir `familias`, `familiasAfectadas`, `familias_afectadas`, `requiereAsistenciaSocial` y `requiere_asistencia_social`.
* **Sugerencia Técnica de Solución:**  
  1. En `src/modules/incidentes/prioridad.schema.ts`: remover `.default(false)` de `RiesgosActivosEvaluacionSchema`, incorporar `"familias"`, `"familiasAfectadas"`, `"familias_afectadas"`, `"requiereAsistenciaSocial"` y `"requiere_asistencia_social"` en `tieneCamposEvaluacionEnRaiz`, y en `superRefine` recalcular `prioridadSugeridaReferencia` siempre desde `{ ...data, ...(data.evaluacion ?? {}) }` cuando exista evaluación (dando prioridad al cálculo del servidor sobre `data.prioridadSugerida`).
  2. En `src/modules/incidentes/prioridad.repository.ts`: invertir el orden de precedencia en la línea 273 para priorizar `envioDatosEvaluacion ? calculo.prioridadSugerida : (incidenteExistente.prioridad_sugerida ?? prioridadSugeridaExplicita ?? incidenteExistente.prioridad ?? "MEDIA")`, y sincronizar `CLAVES_EVALUACION_RAIZ` con el esquema Zod.

---

### `BUG-H38-API-02`: Bypass de Autorización Horizontal de Patrulla Verificadora (`patrulla_id IS NULL` / Misiones `ATENCION_CUADRILLA`) y Mutación Sin Control de Acceso en `POST /prioridad/calcular`
* **Severidad:** **CRÍTICA** (Brecha de Seguridad Horizontal entre Unidades Operativas y Violación del Protocolo ICS).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/incidentes/prioridad.repository.ts` (Líneas 99-140 y 164-258).
* **Descripción Técnica del Defecto:**  
  1. **Bypass de pertenencia cuando `misionSeleccionada.patrulla_id` es `NULL` y ausencia de filtro `tipo_mision = 'VERIFICACION'` (`prioridad.repository.ts:187-258`):**  
     La consulta `queryMision` selecciona todas las misiones del incidente sin restringir `mision.tipo_mision = 'VERIFICACION'` ni `mision.patrulla_id IS NOT NULL`, y el control de autorización (línea 237) condiciona la verificación a la existencia de `patrulla_id`:
     ```typescript
     if (!esAdmin && misionSeleccionada.patrulla_id) {
       ...
     }
     ```
     Si un incidente tiene una misión de cuadrilla operativa en estado `EN_CURSO` (`tipo_mision = 'ATENCION_CUADRILLA'`, `cuadrilla_id !== null`, `patrulla_id === null`, caso real del incidente `INC-2026-0004` / `MIS-2026-0002` tras liberar la patrulla en HU-21), la condición `!esAdmin && misionSeleccionada.patrulla_id` evalúa a `false`. En consecuencia, **cualquier patrullero de cualquier unidad** con el permiso `misiones:terreno:verificar` evade la validación de pertenencia, modifica la prioridad del incidente en estado `EN_ATENCION` y adjunta un `reporte_terreno` (`estado_terreno: "EN_VERIFICACION"`) y un hito `PRIORIDAD_ASIGNADA` directamente sobre la misión de la cuadrilla. Asimismo, tampoco se valida que la patrulla asignada no haya sido dada de baja lógica (`patrulla_verificadora.eliminado_en IS NULL`) ni que el incidente no se encuentre en un estado cerrado (`RESUELTO` o `NO_ABORDABLE`).
  2. **Mutación sin autorización de unidad ni estado en `calcularPrioridadPreliminar` (`prioridad.repository.ts:99-140`):**  
     El endpoint `POST /api/incidentes/[id]/prioridad/calcular` ejecuta `UPDATE incidente SET prioridad_sugerida = ...` sobre cualquier `incidente.id` existente sin verificar si el usuario pertenece a la patrulla verificadora asignada, si existe una misión `VERIFICACION` en curso o si el incidente está cerrado (`RESUELTO` / `NO_ABORDABLE`).
* **Pasos para Reproducir:**
  1. Utilizar el incidente `INC-2026-0004` (`a1000000-0000-4000-8000-000000000004`, estado `EN_ATENCION`, prioridad `ALTA`), cuya única misión activa es `MIS-2026-0002` (`ATENCION_CUADRILLA`, `EN_CURSO`, `patrulla_id = NULL`).
  2. Invocar `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/prioridad` autenticado como `Pedro Valenzuela` (`x-user-id: d1000000-0000-4000-8000-000000000001`), quien no está asignado a ese incidente ni a esa cuadrilla.
  3. Invocar `POST /api/incidentes/a1000000-0000-4000-8000-000000000006/prioridad/calcular` sobre el incidente cerrado `INC-2026-0006` (`estado = 'RESUELTO'`) con el mismo usuario.
* **Comportamiento Actual:** Ambas peticiones retornan `200 OK`; la primera degrada `INC-2026-0004` de `ALTA` a `BAJA` creando reporte `#1` sobre la misión `ATENCION_CUADRILLA`, y la segunda sobrescribe `prioridad_sugerida` en un incidente `RESUELTO`.
* **Comportamiento Esperado:**
  1. `PATCH /api/incidentes/{id}/prioridad` debe restringirse a misiones con `tipo_mision = 'VERIFICACION'` y `patrulla_id IS NOT NULL` cuya patrulla se encuentre activa (`eliminado_en IS NULL`), rechazando con `409 Conflict` si el incidente está cerrado (`RESUELTO`, `NO_ABORDABLE`) o si no posee misión de verificación activa con patrulla asignada, y exigiendo siempre pertenencia a la patrulla cuando `!esAdmin`.
  2. `POST /api/incidentes/{id}/prioridad/calcular` debe validar la pertenencia del usuario a la patrulla asignada (salvo Administrador) y rechazar incidentes cerrados o sin misión de verificación en curso antes de persistir `incidente.prioridad_sugerida`.
* **Sugerencia Técnica de Solución:**  
  En `prioridad.repository.ts`, filtrar `queryMision` por `mision.tipo_mision = 'VERIFICACION'`, verificar `incidenteExistente.estado` (`!['RESUELTO', 'NO_ABORDABLE'].includes(...)`), comprobar `misionSeleccionada.patrulla_id !== null` y `patrulla_eliminado_en === null` antes del chequeo `!esAdmin` (eliminando la condición `&& misionSeleccionada.patrulla_id` del `if`), y aplicar las mismas comprobaciones en `calcularPrioridadPreliminar` (o delegar el cálculo como consulta pura sin mutar `incidente` hasta el `PATCH`).

---

### `BUG-H38-API-03`: Desfase de 33 Commits con `develop`, Corrupción/Colisión de Migraciones Kysely (`052_`–`055_`), Fallo `500` (`42703`) en Endpoints y DDL de Runtime Divergente
* **Severidad:** **ALTA** (Bloqueo de Despliegue/Migración Continua, Error `500` en Endpoints y Regresión de Correcciones Previas).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/db/migrations/052_permiso_misiones_terreno_verificar.ts`
  * `src/lib/db/migrations/053_incidente_prioridad_y_evaluacion_terreno.ts`
  * `src/lib/db/migrations/054_resync_titulo_mision_verificacion.ts`
  * `src/lib/db/migrations/055_mision_hito_metadatos.ts`
  * `src/lib/db/migrator.ts`
  * `src/modules/incidentes/prioridad.repository.ts` (Líneas 574-604)
  * `src/modules/misiones/mision.repository.ts`
  * `package.json`
* **Descripción Técnica del Defecto:**  
  1. **Desfase con `develop` y colisión/corrupción en Kysely (`npm run db:migrate`):** La rama `feature/h38-patrulla-asignar-prioridad` está **33 commits por detrás de `develop`** (carece de los merges de HU-36, HU-35, HU-22 y unificación OpenAPI). En `develop` ya se encuentran registradas y ejecutadas en base de datos las migraciones `035_permiso_misiones_terreno_verificar`, `042_cuadrilla_patrulla_integrantes_vistas`, `061_notificaciones_mision` y `071_indices_listado_cuadrillas`. Esta rama introduce `052_permiso_misiones_terreno_verificar.ts` (duplicado idéntico de `035_`), `053_`, `054_` y `055_` (con numeración inferior a `061_` y `071_`), y carece en disco de `042_` y `061_`. Al ejecutar `npm run db:migrate`, `reconciliarMigracionesRenumeradas` renombra `035_` a `052_` y Kysely aborta inmediatamente con `Error: corrupted migrations: previously executed migration 042_cuadrilla_patrulla_integrantes_vistas is missing` (código de salida `1`).
  2. **Error `HTTP 500` (`42703`) en `/prioridad` y `/prioridad/calcular`:** Debido a que `053_incidente_prioridad_y_evaluacion_terreno.ts` no logra ejecutarse, ambas rutas lanzan `error: column "prioridad_sugerida" does not exist` (`42703`) al consultar la tabla `incidente` y responden `500 Internal Server Error`.
  3. **DDL en tiempo de ejecución divergente y redundancia entre `054_` y `055_`:** La función `asegurarColumnasHu38EnEsquema()` (`prioridad.repository.ts:580-604`) ejecuta `ALTER TABLE` en caliente desde consultas `GET` (`incidente-kanban.repository.ts` y `mision.repository.ts`) creando `prioridad_sugerida varchar(30)` sin restricción `CHECK chk_incidente_prioridad_sugerida`, `detalles_evaluacion jsonb` nullable (en lugar de `NOT NULL DEFAULT '{}'::jsonb`) y sin el índice `idx_reporte_terreno_mision_version`, mientras `prioridad.repository.ts` ni siquiera la invoca. Además, `054_` ya agrega `mision_hito.metadatos` antes de `055_mision_hito_metadatos.ts`.
  4. **Regresión de módulos ya estabilizados en `develop`:** El diff respecto a `develop` revierte la versión `0.12.0` y el ajuste de `build` en `package.json`, así como las correcciones de `BUG-H36-API-01`/`BUG-H36-API-04` y la trazabilidad de notificaciones de HU-35 en `src/modules/misiones/mision.repository.ts`.
* **Pasos para Reproducir:**
  1. En un clon de la base de datos de `develop`, ejecutar `npm run db:migrate` desde `feature/h38-patrulla-asignar-prioridad`.
  2. Iniciar el servidor y enviar `POST /api/incidentes/{id}/prioridad/calcular` o `PATCH /api/incidentes/{id}/prioridad`.
* **Comportamiento Actual:** `npm run db:migrate` termina con código `1` (`corrupted migrations`), y ambos endpoints responden `HTTP 500 Internal Server Error` con error PostgreSQL `42703` en el log del servidor.
* **Comportamiento Esperado:** La rama debe integrar `develop` (`git merge origin/develop`), eliminar la migración duplicada `052_permiso_misiones_terreno_verificar.ts` (ya existe `035_`), consolidar y renumerar las migraciones nuevas a correlativos posteriores a `071_` (`072_...`, `073_...`), eliminar DDL en tiempo de ejecución (`asegurarColumnasHu38EnEsquema`) y preservar las correcciones de `develop` en `mision.repository.ts`, `socket/index.ts`, `openapi/index.ts` y `package.json`.
* **Sugerencia Técnica de Solución:**  
  Ejecutar `git merge origin/develop`, eliminar `052_permiso_misiones_terreno_verificar.ts`, renumerar `053_incidente_prioridad_y_evaluacion_terreno.ts` y `054_resync_titulo_mision_verificacion.ts` (consolidando `055_` dentro de `054_` o como `074_`) a `072_` y `073_` respetando `035_`, `042_`, `061_` y `071_`, y verificar `npm run db:migrate` con salida `0`.

---

### `BUG-H38-API-04`: Condición de Carrera (TOCTOU) en Versionado de Reportes (`version_reporte` Duplicado) y Captura Silenciosa de Errores SQL Dentro de Transacciones
* **Severidad:** **ALTA** (Integridad Transaccional, Corrupción de Versionado de Reportes y Enmascaramiento de Fallos en Base de Datos).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/incidentes/prioridad.repository.ts` (Líneas 118-129, 164-209, 308-333, 380-421 y 448-459)
  * `src/lib/db/migrations/053_incidente_prioridad_y_evaluacion_terreno.ts`
* **Descripción Técnica del Defecto:**  
  1. **Condición de carrera en `version_reporte` por ausencia de bloqueo pesimista (`.forUpdate()`) e índice único:**  
     En `actualizarPrioridadIncidente`, ni la consulta de `incidente` (línea 164) ni la de `mision` (línea 187) adquieren bloqueo pesimista `.forUpdate()`. El correlativo `versionReporte` (líneas 309-332) se calcula mediante `SELECT count(id)::int FROM reporte_terreno WHERE mision_id = ...` + 1, y la migración `053` crea un índice no único (`CREATE INDEX` en lugar de `CREATE UNIQUE INDEX` sobre `(mision_id, version_reporte)`). Bajo el aislamiento `READ COMMITTED` de PostgreSQL, dos envíos paralelos de `PATCH /api/incidentes/{id}/prioridad` (ej. doble pulsación en la PWA) leen `total = 0`, insertan dos registros distintos con `version_reporte = 1`, `es_rectificacion = false`, etiqueta `"Reporte de Evaluación #1 (Inicial)"`, y registran dos hitos `PRIORIDAD_ASIGNADA` duplicados en `mision_hito`.
  2. **Bloques `try { ... } catch {}` que silencian errores SQL reales (`prioridad.repository.ts:118-129, 308-330, 380-421, 448-459`):**  
     Se envolvieron operaciones de base de datos en `try/catch` vacíos o con fallbacks de datos ficticios para acomodar mocks parciales de tests unitarios:
     - En `calcularPrioridadPreliminar` (líneas 118-129), si `UPDATE incidente SET prioridad_sugerida = ...` falla en PostgreSQL, el error se descarta y el endpoint retorna `200 OK` sin haber persistido el dato.
     - Dentro de la transacción `db.transaction()` (líneas 308-330, 380-421 y 448-459), cualquier error SQL en `reporte_terreno` o `mision` es capturado e ignorado (fabricando incluso un UUID ficticio `e0000000-0000-4000-8000-000000000001`), dejando la transacción de PostgreSQL en estado abortado (`25P02`) para el resto de sentencias.
* **Pasos para Reproducir:**
  1. Disponer del incidente `INC-2026-0003` (`a1000000-0000-4000-8000-000000000003`) con misión `MIS-2026-0001` (`EN_CURSO`, 0 reportes previos).
  2. Enviar dos peticiones `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` concurrentemente (`& ... & wait`).
  3. Consultar `SELECT id, version_reporte, es_rectificacion FROM reporte_terreno WHERE mision_id = 'd1000000-0000-4000-8000-000000000001'` y `SELECT hito FROM mision_hito WHERE mision_id = 'd1000000-0000-4000-8000-000000000001'`.
* **Comportamiento Actual:** Ambas peticiones retornan `200 OK` con `versionReporte: 1` (`esRectificacion: false`), creando 2 filas con `version_reporte = 1` en `reporte_terreno` y 2 hitos `PRIORIDAD_ASIGNADA` en `mision_hito`.
* **Comportamiento Esperado:** La transacción debe bloquear la fila de la misión con `.forUpdate("mision")`, calcular `COALESCE(MAX(version_reporte), 0) + 1` bajo dicho bloqueo (respaldado por `UNIQUE INDEX` en `(mision_id, version_reporte)` cuando `version_reporte` se serializa), generar estrictamente versión `#1 (Inicial)` y `#2 (Rectificación)` en orden secuencial, y nunca silenciar errores reales de PostgreSQL mediante `try/catch` con datos ficticios.
* **Sugerencia Técnica de Solución:**  
  1. En `prioridad.repository.ts`, adquirir `.forUpdate("mision")` al consultar `mision`, usar `MAX(version_reporte)` en lugar de `COUNT(id)` (evitando reutilización ante eventuales borrados) y eliminar los bloques `try/catch` alrededor de consultas reales de Kysely (ajustando los mocks de `prioridad.repository.test.ts` en lugar de degradar el código productivo).
  2. En la migración de `reporte_terreno`, crear un índice único parcial o compuesto `UNIQUE (mision_id, version_reporte)` para garantizar unicidad de versiones a nivel de motor PostgreSQL.

---

### `BUG-H38-API-05`: Desalineación de Contrato OpenAPI 3.0 (`bearerAuth` No Declarado y Versión `0.10.0` vs `0.12.0`) y Regresión de Difusión WebSocket en `src/lib/socket/index.ts`
* **Severidad:** **MEDIA** (Inconsistencia de Especificación OpenAPI para Generación de Clientes y Duplicidad/Omisión de Salas WebSocket).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts` (Líneas 2587 y 2626, y comparación con `develop`)
  * `src/modules/incidentes/prioridad.schema.ts` (Líneas 243-265)
  * `src/lib/socket/index.ts` (Líneas 184-198 y 838-864)
  * `docs/api/incidentes.md` (Secciones 3 y 5)
* **Descripción Técnica del Defecto:**  
  1. **Esquema de seguridad OpenAPI inválido (`bearerAuth` vs `BearerAuth`):** Los endpoints `POST /api/incidentes/{id}/prioridad/calcular` y `PATCH /api/incidentes/{id}/prioridad` en `src/lib/openapi/index.ts` declaran `security: [{ bearerAuth: [] }]` (minúscula), un esquema de seguridad que no está registrado en `components.securitySchemes` (`undefined` al consultar `GET /openapi.json`), mientras en `develop` el esquema oficial registrado es `BearerAuth` (PascalCase) y la versión de API es `0.12.0` (frente a `0.10.0` en esta rama). Además, `CalcularPrioridadResponseSchema.data.evaluacionNormalizada` omite la propiedad opcional `familias` que sí retorna `normalizarEvaluacionTerreno()`.
  2. **Duplicación en memoria y omisión de salas en Redis en `src/lib/socket/index.ts`:**
     - En `notificarIncidenteActualizado` (línea 192) y `notificarMisionActualizada` (línea 847), la rama `if (ioInstance)` ejecuta `(ioInstance as any).emit(...)` como broadcast global además de `.to("sala:encargados")`, `.to("encargado")` y `.to("mapa")`/`.to("supervisor")`, duplicando el evento para todos los clientes suscritos a dichas salas.
     - En `notificarMisionActualizada` (líneas 851-863), cuando opera con Redis Pub/Sub (`ioInstance === null`), publica únicamente a `room: "encargado"`, omitiendo `"sala:encargados"` y `"supervisor"` (regresión de `BUG-H36-API-05` ya resuelto en `develop`).
  3. **Documentación parcial de errores en `docs/api/incidentes.md`:** Las secciones 3 y 5 de `docs/api/incidentes.md` no listan los códigos de error (`400`, `403`, `404`, `409`) ni ejemplos reproducibles de `/api/incidentes/{id}/prioridad` y `/prioridad/calcular`.
* **Pasos para Reproducir:**
  1. Consultar `GET /openapi.json` y revisar `info.version`, `components.securitySchemes` y `paths["/api/incidentes/{id}/prioridad"].patch.security`.
  2. Suscribirse al canal Redis `sgrai:socket-events` (`redis-cli SUBSCRIBE sgrai:socket-events`) y ejecutar `PATCH /api/incidentes/{id}/prioridad`.
* **Comportamiento Actual:** `GET /openapi.json` devuelve `version: "0.10.0"`, `securitySchemes: undefined` y `security: [{ bearerAuth: [] }]`; y en Redis Pub/Sub `mision:actualizada` solo se publica hacia `"room": "encargado"` sin `"sala:encargados"` ni `"supervisor"`.
* **Comportamiento Esperado:** OpenAPI debe declarar `BearerAuth` registrado en `components.securitySchemes` y alinearse con la versión `0.12.0` de `develop`, incluir `familias` en `CalcularPrioridadResponseSchema`, y `src/lib/socket/index.ts` debe emitir consistentemente a `["encargado", "sala:encargados", "supervisor"]` en `notificarMisionActualizada` sin broadcasts globales duplicados en memoria.
* **Sugerencia Técnica de Solución:**  
  Al integrar `develop`, conservar el componente `BearerAuth` y las rutas/versionado `0.12.0`, cambiar `bearerAuth` a `BearerAuth` en las rutas de `/prioridad` y `/prioridad/calcular`, agregar `familias: z.array(z.record(z.string(), z.unknown())).optional()` en `CalcularPrioridadResponseSchema`, mantener la implementación de `notificarMisionActualizada` de `develop`, retirar el broadcast global en `notificarIncidenteActualizado` y completar la Sección 3 de `docs/api/incidentes.md`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H38-API-01` | Bypass de cálculo autoritativo y justificación obligatoria enviando `prioridadSugerida` o `familias` en raíz, y anulación de riesgos `snake_case` en `riesgosActivos` | Seguridad / Validación Zod / Regla de Negocio (CA-3) | Schema / Utils / Endpoint | Crítica | Incidente con misión `VERIFICACION` en estado `EN_CURSO` | `POST .../prioridad/calcular` con `{"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}}` y `PATCH .../prioridad` con `{"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}` y payload con `familias` en raíz | Cálculo autoritativo `CRITICA` (60/185/55 pts) y rechazo `400 Bad Request` si se intenta asignar `BAJA` sin justificación >= 5 caracteres | `POST /calcular` retorna `BAJA` (`0 pts`) por `.default(false)` en camelCase; `PATCH` retorna `200 OK` guardando `prioridadSugerida: "BAJA"` sin justificación en ambos casos | ABIERTO | 17/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H38-API-02` | Bypass de autorización horizontal de patrulla cuando `patrulla_id` es `NULL` (`ATENCION_CUADRILLA`) y mutación sin control en `POST /prioridad/calcular` sobre incidentes `RESUELTO` | Seguridad / Autorización Horizontal / Regla ICS | Repositorio / Endpoint | Crítica | Incidente `INC-2026-0004` (`EN_ATENCION`) con misión `ATENCION_CUADRILLA` (`patrulla_id = null`) e incidente `INC-2026-0006` (`RESUELTO`), usuario patrulla ajeno `d1000000-...001` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/prioridad` y `POST /api/incidentes/a1000000-0000-4000-8000-000000000006/prioridad/calcular` con `x-user-id: d1000000-0000-4000-8000-000000000001` | HTTP `403 Forbidden` o `409 Conflict` impidiendo que una patrulla ajena modifique incidentes en atención por cuadrilla o ya resueltos | Ambos retornan `200 OK`; degrada `INC-2026-0004` a `BAJA` adjuntando `reporte_terreno` a la cuadrilla y muta `prioridad_sugerida` en `INC-2026-0006` (`RESUELTO`) | ABIERTO | 17/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H38-API-03` | Desfase de 33 commits con `develop`, corrupción/colisión de migraciones Kysely (`052_`–`055_` vs `035_`, `042_`, `061_`, `071_`), error `500` (`42703`) y DDL de runtime divergente | Integración / Base de Datos | Migraciones / Infraestructura | Alta | Base de datos sincronizada con `develop` (migraciones `001` a `071` aplicadas) | `npm run db:migrate`, `POST .../prioridad/calcular` y `PATCH .../prioridad` | `npm run db:migrate` aplica migraciones `> 071` limpiamente sin colisión ni regresiones sobre `mision.repository.ts` y `package.json` | `npm run db:migrate` aborta con exit code `1` (`previously executed migration 042_cuadrilla_patrulla_integrantes_vistas is missing`); ambos endpoints fallan con `HTTP 500` (`42703: column "prioridad_sugerida" does not exist`) | ABIERTO | 17/11/2026 14:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H38-API-04` | Condición de carrera en `version_reporte` bajo peticiones concurrentes (duplicación de versión `#1` e hito `PRIORIDAD_ASIGNADA`) y captura silenciosa `try/catch` de errores SQL | Concurrencia / Integridad ACID | Repositorio / BD | Alta | Incidente `INC-2026-0003` con misión `MIS-2026-0001` (`EN_CURSO`) sin reportes previos | Dos peticiones paralelas `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `x-user-id: 00000000-0000-4000-8000-000000000001` | Serialización con `.forUpdate("mision")` generando versiones secuenciales `#1` y `#2` (respaldadas por índice único) sin silenciar fallos SQL | Ambas peticiones retornan `200 OK` con `versionReporte: 1` (`esRectificacion: false`), insertando 2 filas con `version_reporte = 1` y 2 hitos `PRIORIDAD_ASIGNADA` | ABIERTO | 17/11/2026 14:25 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H38-API-05` | Esquema OpenAPI `bearerAuth` no declarado (versión `0.10.0` vs `0.12.0` de `develop`) y regresión WebSocket en `notificarMisionActualizada` / `notificarIncidenteActualizado` | Contrato API / Tiempo Real | OpenAPI / Socket.io / Redis | Media | Servidor con `REDIS_URL` activo y consulta a `GET /openapi.json` | `GET /openapi.json` y suscripción Redis `SUBSCRIBE sgrai:socket-events` durante `PATCH .../prioridad` | `components.securitySchemes.BearerAuth` declarado en `0.12.0`, `BearerAuth` consistente en rutas HU-38 y publicación Redis a `encargado`, `sala:encargados` y `supervisor` sin broadcast global duplicado | `openapi.json` retorna `version: "0.10.0"`, `securitySchemes: undefined` y `[{"bearerAuth":[]}]`; Redis solo recibe `mision:actualizada` en sala `encargado` omitiendo `sala:encargados` y `supervisor` | ABIERTO | 17/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H38-API-01` | Cálculo preliminar de `prioridad_sugerida` (`ALTA`, `47 pts`) mediante `POST /api/incidentes/{id}/prioridad/calcular` | Funcional / Positiva (CA-1) | Integración / Endpoint | Crítica | Esquema `053` aplicado en BD; incidente `INC-2026-9932` (`dd7db71e-...`) existente | `POST /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular` con `{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}` | HTTP `200 OK` con `prioridadSugerida: "ALTA"`, `puntajeTotal: 47`, `factoresGatillantes` y `requiereAsistenciaSocialSugerido: true` | HTTP `200 OK` retornando `prioridadSugerida: "ALTA"`, `puntajeTotal: 47` y `requiereAsistenciaSocialSugerido: true` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-02` | Confirmación de prioridad sugerida (`ALTA`) sin justificación creando Reporte #1 (Inicial) y registrando hito `PRIORIDAD_ASIGNADA` en `mision_hito` (`200 OK`) | Funcional / Positiva (CA-4) | Integración / Transacción ACID | Crítica | Misión `MIS-2026-0008` aceptada (`EN_CURSO`) para `Patrulla Rápida Las Ánimas` (`d1000000-...001`) | `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad` con `{"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}` | HTTP `200 OK` actualizando `incidente.prioridad` y `prioridad_sugerida` a `"ALTA"`, creando `reporte_terreno` `#1` y `mision_hito` `PRIORIDAD_ASIGNADA` | HTTP `200 OK` con `modificoPrioridadSugerida: false`, `versionReporte: 1`, `esRectificacion: false` e hito `PRIORIDAD_ASIGNADA` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-03` | Modificación y rectificación de prioridad (`ALTA` -> `CRITICA`) con justificación técnica >= 5 caracteres generando Reporte #2 (Rectificación) e hito `PRIORIDAD_RECTIFICADA` | Funcional / Positiva (CA-3, CA-4) | Integración / Transacción ACID | Crítica | Incidente `INC-2026-9932` con Reporte #1 previo en misión `MIS-2026-0008` | `PATCH .../prioridad` con `{"prioridad":"CRITICA","justificacion_prioridad":"Se eleva a CRITICA por riesgo de colapso en muro medianero junto a adulto mayor.","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}` | HTTP `200 OK` persistiendo `prioridad: "CRITICA"`, `prioridadSugerida: "ALTA"`, `justificacionPrioridad`, `versionReporte: 2`, `esRectificacion: true` y `hito: "PRIORIDAD_RECTIFICADA"` | HTTP `200 OK` con Reporte `#2 (Rectificación)` y trazabilidad completa en `incidente`, `reporte_terreno` y `mision_hito` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-04` | Validación de los cuatro niveles canónicos del enum `PrioridadIncidente` (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y rechazo de valores fuera de catálogo | Validación / Contrato (CA-2) | Schema Zod | Alta | Esquema `PrioridadCanonicaEnum` y `ActualizarPrioridadIncidenteInputSchema` | `PrioridadCanonicaEnum.options` y `safeParse({ prioridad: "EXTREMA" })` | Enum exacto `["BAJA","MEDIA","ALTA","CRITICA"]` y rechazo `success: false` ante `"EXTREMA"` | Retorna exactamente `['BAJA','MEDIA','ALTA','CRITICA']` y rechaza `"EXTREMA"` con error en `path: ['prioridad']` | APROBADO | 17/11/2026 14:28 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-05` | Rechazo `400 Bad Request` al cambiar `prioridad_sugerida` (`MEDIA` -> `CRITICA`) sin proporcionar `justificacion_prioridad` | Regla de Negocio / Negativa (CA-3) | Integración / Schema Zod | Crítica | Usuario autenticado con permiso `misiones:terreno:verificar` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `{"prioridad":"CRITICA","prioridad_sugerida":"MEDIA"}` | HTTP `400 Bad Request` indicando obligatoriedad de justificación técnica >= 5 caracteres | HTTP `400 Bad Request` con `errors[0].campo = "justificacion_prioridad"` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-06` | Rechazo `400 Bad Request` cuando `justificacion_prioridad` ante discrepancia tiene menos de 5 caracteres (`"mal"` / `"abc"`) | Valor Límite / Validación (CA-3) | Integración / Endpoint y Unit | Crítica | Misión `MIS-2026-0008` en estado `EN_CURSO` | `PATCH .../prioridad` con `{"prioridad":"CRITICA","justificacion_prioridad":"mal","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}` | HTTP `400 Bad Request` rechazando justificación inferior a 5 caracteres | HTTP `400 Bad Request` con mensaje de mínimo 5 caracteres en `justificacion_prioridad` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-07` | Rechazo de petición sin credenciales de autenticación (`401 Unauthorized`) y con token JWT Bearer inválido (`401 Unauthorized`) | Seguridad / Autenticación | Integración / Endpoint | Crítica | Peticiones sin `Authorization`/`x-user-id` y con `Authorization: Bearer token.invalido.123` | `PATCH /api/incidentes/{id}/prioridad` sin cabeceras y con token JWT manipulado | HTTP `401 Unauthorized` rechazando acceso no autenticado o firma inválida | HTTP `401 Unauthorized` (`"Se requiere cabecera..."` y `"Token de sesión inválido o expirado."`) | APROBADO | 17/11/2026 14:26 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-08` | Flujo autenticado con JWT Bearer (`Authorization: Bearer <token>`) emitido por `POST /api/seguridad/login` para patrulla verificadora (`200 OK`) | Seguridad / Integración JWT (CA-6) | Integración / Endpoint | Crítica | Usuario `pedro.patrulla@valdivia.cl` activo con rol `PATRULLA_VERIFICADORA` | Login en `/api/seguridad/login` y `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad` con `Authorization: Bearer <JWT>` | HTTP `200 OK` identificando al evaluador Pedro Valenzuela mediante token JWT | HTTP `200 OK` registrando Reporte #5 a nombre de Pedro Valenzuela | APROBADO | 17/11/2026 14:26 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-09` | Rechazo RBAC `403 Forbidden` para usuario sin permiso `misiones:terreno:verificar` (`CALL_CENTER`) | Seguridad / RBAC (CA-6) | Integración / Endpoint | Crítica | Usuario `c1111111-1111-4111-8111-111111111111` con rol `CALL_CENTER` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `x-user-id: c1111111-1111-4111-8111-111111111111` | HTTP `403 Forbidden` indicando ausencia de `misiones:terreno:verificar` | HTTP `403 Forbidden`: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-10` | Rechazo `403 Forbidden` al intentar evaluar un incidente cuya misión `VERIFICACION` está asignada a otra patrulla verificadora | Seguridad / Autorización | Integración / Endpoint | Alta | Incidente `INC-2026-0003` (`MIS-2026-0001` asignada a `Patrulla Rápida Costa-1`) | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad` con `x-user-id: d1000000-0000-4000-8000-000000000001` | HTTP `403 Forbidden` impidiendo modificar prioridades de misiones de otra patrulla | HTTP `403 Forbidden`: `{"message":"No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."}` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-11` | Rechazo `400 Bad Request` por parámetro de ruta `id` no UUID y por cuerpo JSON malformado | Validación / Robustez | Integración / Endpoint | Media | Parámetro `id-invalido` o body `{malformed` | `PATCH /api/incidentes/id-invalido/prioridad` y `PATCH .../prioridad` con `-d '{malformed'` | HTTP `400 Bad Request` en ambos casos con mensaje descriptivo | HTTP `400 Bad Request` (`"El identificador del incidente proporcionado no es un UUID válido."` y `"El cuerpo de la petición no es un JSON válido."`) | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-12` | Rechazo `404 Not Found` cuando el identificador UUID del incidente no existe en base de datos | Funcional / Negativa | Integración / Endpoint | Alta | UUID inexistente `50000000-0000-4000-8000-000000000999` | `PATCH /api/incidentes/50000000-0000-4000-8000-000000000999/prioridad` con `{"prioridad":"ALTA"}` | HTTP `404 Not Found` con mensaje de incidente no encontrado | HTTP `404 Not Found`: `{"message":"No se encontró ningún incidente con el identificador proporcionado."}` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-13` | Bloqueo `409 Conflict` cuando la misión de verificación aún está en estado `DESPACHADA` (pendiente de aceptación por patrulla) | Regla de Negocio ICS | Integración / Endpoint | Alta | Incidente `INC-2026-9932` con misión `MIS-2026-0008` en estado `DESPACHADA` | `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad` previo a `POST .../aceptar` | HTTP `409 Conflict` exigiendo aceptar la misión antes de asignar prioridad | HTTP `409 Conflict`: `{"message":"La patrulla debe aceptar la misión asignada antes de poder asignar o modificar la prioridad del incidente en terreno."}` | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-14` | Reglas deterministas de motor de sugerencia: disparo directo a `CRITICA` con electrodependientes y ajuste de `nucleoFamiliarTotal` por vulnerables | Funcional / Lógica de Dominio | Unitaria (`prioridad.utils`) | Alta | Funciones `calcularPrioridadSugerida` y `normalizarEvaluacionTerreno` | `npm test -- src/modules/incidentes/__tests__/prioridad.utils.test.ts` | `6/6` tests aprobados validando niveles `BAJA`, `MEDIA`, `ALTA`, `CRITICA` y resúmenes versionados | `6/6` tests aprobados (`9ms`) | APROBADO | 17/11/2026 14:22 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-15` | Publicación del evento WebSocket `incidente:actualizado` en Redis Pub/Sub hacia `sala:encargados`, `encargado` y `mapa` con prioridad y `reporteTerreno` (`CA-5`) | Tiempo Real / Socket.io | Integración / Redis Pub/Sub | Alta | Suscriptor Redis en canal `sgrai:socket-events` durante ejecución de `PATCH .../prioridad` | `docker exec grupo1_redis redis-cli SUBSCRIBE sgrai:socket-events` + `PATCH .../prioridad` | Mensajes publicados en `sala:encargados`, `encargado` y `mapa` conteniendo `prioridad`, `prioridadSugerida`, `justificacionPrioridad`, `verificado: true` y `reporteTerreno` | Eventos `incidente:actualizado` verificados en las tres salas con payload íntegro para Reportes #1 y #2 | APROBADO | 17/11/2026 14:24 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-16` | Proyección de `prioridad`, `prioridadSugerida`, `justificacionPrioridad`, `totalReportesTerreno` y `reportesEvaluacionTerreno` en Kanban (`GET /api/incidentes`) y detalle (`GET /api/incidentes/{id}`) | Funcional / Integración Lectura (CA-5) | Integración / Endpoint | Alta | Incidente `INC-2026-9932` actualizado en BD y token JWT de `encargado@valdivia.cl` | `GET /api/incidentes?busqueda=INC-2026-9932` y `GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38` | HTTP `200 OK` proyectando prioridad actualizada, `totalReportesTerreno` e historial `reportesEvaluacionTerreno` | HTTP `200 OK` con `totalReportesTerreno: 4`, `verificado: true` y detalle completo de reportes | APROBADO | 17/11/2026 14:25 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-17` | Proyección de hitos `PRIORIDAD_ASIGNADA`/`PRIORIDAD_RECTIFICADA`, reportes versionados y resumen `evaluaciones` en `GET /api/misiones/{id}` | Funcional / Trazabilidad ICS | Integración / Endpoint | Media | Misión `MIS-2026-0008` con evaluaciones registradas y token JWT `encargado@valdivia.cl` | `GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02` | HTTP `200 OK` con `bitacoraTiempos`, `reportesTerreno` y `evaluaciones.prioridadEvaluada: true` | HTTP `200 OK` reflejando hitos cronológicos e historial versionado de prioridad | APROBADO | 17/11/2026 14:25 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-18` | Validación de sentencias SQL `up`/`down` de la migración `053_incidente_prioridad_y_evaluacion_terreno.ts` sobre Kysely | Base de Datos / Migración | Unitaria (`Kysely`) | Media | Archivo `053_incidente_prioridad_y_evaluacion_terreno.ts` y su suite de test | `npm test -- src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts` | `2/2` tests aprobados validando columnas `prioridad_sugerida`, `justificacion_prioridad`, `version_reporte`, `es_rectificacion` y `detalles_evaluacion` | `2/2` tests aprobados (`13ms`) | APROBADO | 17/11/2026 14:22 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-19` | Ejecución completa de las suites automatizadas focalizadas de HU-38 y regresión general en Vitest | Automatización / Regresión | Unitaria / Mocked Integration | Alta | Entorno Node.js con dependencias instaladas | `npm test` y ejecución focalizada de los 8 archivos de HU-38/Incidentes/Misiones/OpenAPI | `34/34` tests focalizados y `835/835` tests globales (`74/74` archivos) aprobados | `34/34` focalizados (`2.15s`) y `835/835` totales (`7.31s`) aprobados | APROBADO | 17/11/2026 14:22 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |
| `CP-H38-API-20` | Verificación de tipado estricto TypeScript (`tsc --noEmit`), linter (`eslint`) y compilación de producción (`next build`) | Calidad Estática / Build | Compilación / Lint | Alta | Código fuente completo de la rama `feature/h38-patrulla-asignar-prioridad` | `npm run lint && npx tsc --noEmit && npm run build` | `0` errores de TypeScript, `0` errores de ESLint y compilación `next build` exitosa | `tsc`: `0` errores; `eslint`: `0` errores (`1` warning heredado en `tipologia`); `next build`: compilación limpia | APROBADO | 17/11/2026 14:23 | - | feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H38-API-01	Bypass de cálculo autoritativo y justificación obligatoria enviando prioridadSugerida o familias en raíz, y anulación de riesgos snake_case en riesgosActivos	Seguridad / Validación Zod / Regla de Negocio (CA-3)	Schema / Utils / Endpoint	Crítica	Incidente con misión VERIFICACION en estado EN_CURSO	POST .../prioridad/calcular con {"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}} y PATCH .../prioridad con {"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}} y payload con familias en raíz	Cálculo autoritativo CRITICA (60/185/55 pts) y rechazo 400 Bad Request si se intenta asignar BAJA sin justificación >= 5 caracteres	POST /calcular retorna BAJA (0 pts) por .default(false) en camelCase; PATCH retorna 200 OK guardando prioridadSugerida: "BAJA" sin justificación en ambos casos	ABIERTO	17/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-API-02	Bypass de autorización horizontal de patrulla cuando patrulla_id es NULL (ATENCION_CUADRILLA) y mutación sin control en POST /prioridad/calcular sobre incidentes RESUELTO	Seguridad / Autorización Horizontal / Regla ICS	Repositorio / Endpoint	Crítica	Incidente INC-2026-0004 (EN_ATENCION) con misión ATENCION_CUADRILLA (patrulla_id = null) e incidente INC-2026-0006 (RESUELTO), usuario patrulla ajeno d1000000-...001	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/prioridad y POST /api/incidentes/a1000000-0000-4000-8000-000000000006/prioridad/calcular con x-user-id: d1000000-0000-4000-8000-000000000001	HTTP 403 Forbidden o 409 Conflict impidiendo que una patrulla ajena modifique incidentes en atención por cuadrilla o ya resueltos	Ambos retornan 200 OK; degrada INC-2026-0004 a BAJA adjuntando reporte_terreno a la cuadrilla y muta prioridad_sugerida en INC-2026-0006 (RESUELTO)	ABIERTO	17/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-API-03	Desfase de 33 commits con develop, corrupción/colisión de migraciones Kysely (052_–055_ vs 035_, 042_, 061_, 071_), error 500 (42703) y DDL de runtime divergente	Integración / Base de Datos	Migraciones / Infraestructura	Alta	Base de datos sincronizada con develop (migraciones 001 a 071 aplicadas)	npm run db:migrate, POST .../prioridad/calcular y PATCH .../prioridad	npm run db:migrate aplica migraciones > 071 limpiamente sin colisión ni regresiones sobre mision.repository.ts y package.json	npm run db:migrate aborta con exit code 1 (previously executed migration 042_cuadrilla_patrulla_integrantes_vistas is missing); ambos endpoints fallan con HTTP 500 (42703: column "prioridad_sugerida" does not exist)	ABIERTO	17/11/2026 14:23	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-API-04	Condición de carrera en version_reporte bajo peticiones concurrentes (duplicación de versión #1 e hito PRIORIDAD_ASIGNADA) y captura silenciosa try/catch de errores SQL	Concurrencia / Integridad ACID	Repositorio / BD	Alta	Incidente INC-2026-0003 con misión MIS-2026-0001 (EN_CURSO) sin reportes previos	Dos peticiones paralelas PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con x-user-id: 00000000-0000-4000-8000-000000000001	Serialización con .forUpdate("mision") generando versiones secuenciales #1 y #2 (respaldadas por índice único) sin silenciar fallos SQL	Ambas peticiones retornan 200 OK con versionReporte: 1 (esRectificacion: false), insertando 2 filas con version_reporte = 1 y 2 hitos PRIORIDAD_ASIGNADA	ABIERTO	17/11/2026 14:25	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-API-05	Esquema OpenAPI bearerAuth no declarado (versión 0.10.0 vs 0.12.0 de develop) y regresión WebSocket en notificarMisionActualizada / notificarIncidenteActualizado	Contrato API / Tiempo Real	OpenAPI / Socket.io / Redis	Media	Servidor con REDIS_URL activo y consulta a GET /openapi.json	GET /openapi.json y suscripción Redis SUBSCRIBE sgrai:socket-events durante PATCH .../prioridad	components.securitySchemes.BearerAuth declarado en 0.12.0, BearerAuth consistente en rutas HU-38 y publicación Redis a encargado, sala:encargados y supervisor sin broadcast global duplicado	openapi.json retorna version: "0.10.0", securitySchemes: undefined y [{"bearerAuth":[]}]; Redis solo recibe mision:actualizada en sala encargado omitiendo sala:encargados y supervisor	ABIERTO	17/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H38-API-01	Cálculo preliminar de prioridad_sugerida (ALTA, 47 pts) mediante POST /api/incidentes/{id}/prioridad/calcular	Funcional / Positiva (CA-1)	Integración / Endpoint	Crítica	Esquema 053 aplicado en BD; incidente INC-2026-9932 (dd7db71e-...) existente	POST /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular con {"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}	HTTP 200 OK con prioridadSugerida: "ALTA", puntajeTotal: 47, factoresGatillantes y requiereAsistenciaSocialSugerido: true	HTTP 200 OK retornando prioridadSugerida: "ALTA", puntajeTotal: 47 y requiereAsistenciaSocialSugerido: true	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-02	Confirmación de prioridad sugerida (ALTA) sin justificación creando Reporte #1 (Inicial) y registrando hito PRIORIDAD_ASIGNADA en mision_hito (200 OK)	Funcional / Positiva (CA-4)	Integración / Transacción ACID	Crítica	Misión MIS-2026-0008 aceptada (EN_CURSO) para Patrulla Rápida Las Ánimas (d1000000-...001)	PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad con {"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}	HTTP 200 OK actualizando incidente.prioridad y prioridad_sugerida a "ALTA", creando reporte_terreno #1 y mision_hito PRIORIDAD_ASIGNADA	HTTP 200 OK con modificoPrioridadSugerida: false, versionReporte: 1, esRectificacion: false e hito PRIORIDAD_ASIGNADA	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-03	Modificación y rectificación de prioridad (ALTA -> CRITICA) con justificación técnica >= 5 caracteres generando Reporte #2 (Rectificación) e hito PRIORIDAD_RECTIFICADA	Funcional / Positiva (CA-3, CA-4)	Integración / Transacción ACID	Crítica	Incidente INC-2026-9932 con Reporte #1 previo en misión MIS-2026-0008	PATCH .../prioridad con {"prioridad":"CRITICA","justificacion_prioridad":"Se eleva a CRITICA por riesgo de colapso en muro medianero junto a adulto mayor.","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}	HTTP 200 OK persistiendo prioridad: "CRITICA", prioridadSugerida: "ALTA", justificacionPrioridad, versionReporte: 2, esRectificacion: true y hito: "PRIORIDAD_RECTIFICADA"	HTTP 200 OK con Reporte #2 (Rectificación) y trazabilidad completa en incidente, reporte_terreno y mision_hito	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-04	Validación de los cuatro niveles canónicos del enum PrioridadIncidente (BAJA, MEDIA, ALTA, CRITICA) y rechazo de valores fuera de catálogo	Validación / Contrato (CA-2)	Schema Zod	Alta	Esquema PrioridadCanonicaEnum y ActualizarPrioridadIncidenteInputSchema	PrioridadCanonicaEnum.options y safeParse({ prioridad: "EXTREMA" })	Enum exacto ["BAJA","MEDIA","ALTA","CRITICA"] y rechazo success: false ante "EXTREMA"	Retorna exactamente ['BAJA','MEDIA','ALTA','CRITICA'] y rechaza "EXTREMA" con error en path: ['prioridad']	APROBADO	17/11/2026 14:28	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-05	Rechazo 400 Bad Request al cambiar prioridad_sugerida (MEDIA -> CRITICA) sin proporcionar justificacion_prioridad	Regla de Negocio / Negativa (CA-3)	Integración / Schema Zod	Crítica	Usuario autenticado con permiso misiones:terreno:verificar	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con {"prioridad":"CRITICA","prioridad_sugerida":"MEDIA"}	HTTP 400 Bad Request indicando obligatoriedad de justificación técnica >= 5 caracteres	HTTP 400 Bad Request con errors[0].campo = "justificacion_prioridad"	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-06	Rechazo 400 Bad Request cuando justificacion_prioridad ante discrepancia tiene menos de 5 caracteres ("mal" / "abc")	Valor Límite / Validación (CA-3)	Integración / Endpoint y Unit	Crítica	Misión MIS-2026-0008 en estado EN_CURSO	PATCH .../prioridad con {"prioridad":"CRITICA","justificacion_prioridad":"mal","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}	HTTP 400 Bad Request rechazando justificación inferior a 5 caracteres	HTTP 400 Bad Request con mensaje de mínimo 5 caracteres en justificacion_prioridad	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-07	Rechazo de petición sin credenciales de autenticación (401 Unauthorized) y con token JWT Bearer inválido (401 Unauthorized)	Seguridad / Autenticación	Integración / Endpoint	Crítica	Peticiones sin Authorization/x-user-id y con Authorization: Bearer token.invalido.123	PATCH /api/incidentes/{id}/prioridad sin cabeceras y con token JWT manipulado	HTTP 401 Unauthorized rechazando acceso no autenticado o firma inválida	HTTP 401 Unauthorized ("Se requiere cabecera..." y "Token de sesión inválido o expirado.")	APROBADO	17/11/2026 14:26	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-08	Flujo autenticado con JWT Bearer (Authorization: Bearer <token>) emitido por POST /api/seguridad/login para patrulla verificadora (200 OK)	Seguridad / Integración JWT (CA-6)	Integración / Endpoint	Crítica	Usuario pedro.patrulla@valdivia.cl activo con rol PATRULLA_VERIFICADORA	Login en /api/seguridad/login y PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad con Authorization: Bearer <JWT>	HTTP 200 OK identificando al evaluador Pedro Valenzuela mediante token JWT	HTTP 200 OK registrando Reporte #5 a nombre de Pedro Valenzuela	APROBADO	17/11/2026 14:26	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-09	Rechazo RBAC 403 Forbidden para usuario sin permiso misiones:terreno:verificar (CALL_CENTER)	Seguridad / RBAC (CA-6)	Integración / Endpoint	Crítica	Usuario c1111111-1111-4111-8111-111111111111 con rol CALL_CENTER	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con x-user-id: c1111111-1111-4111-8111-111111111111	HTTP 403 Forbidden indicando ausencia de misiones:terreno:verificar	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-10	Rechazo 403 Forbidden al intentar evaluar un incidente cuya misión VERIFICACION está asignada a otra patrulla verificadora	Seguridad / Autorización	Integración / Endpoint	Alta	Incidente INC-2026-0003 (MIS-2026-0001 asignada a Patrulla Rápida Costa-1)	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad con x-user-id: d1000000-0000-4000-8000-000000000001	HTTP 403 Forbidden impidiendo modificar prioridades de misiones de otra patrulla	HTTP 403 Forbidden: {"message":"No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."}	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-11	Rechazo 400 Bad Request por parámetro de ruta id no UUID y por cuerpo JSON malformado	Validación / Robustez	Integración / Endpoint	Media	Parámetro id-invalido o body {malformed	PATCH /api/incidentes/id-invalido/prioridad y PATCH .../prioridad con -d '{malformed'	HTTP 400 Bad Request en ambos casos con mensaje descriptivo	HTTP 400 Bad Request ("El identificador del incidente proporcionado no es un UUID válido." y "El cuerpo de la petición no es un JSON válido.")	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-12	Rechazo 404 Not Found cuando el identificador UUID del incidente no existe en base de datos	Funcional / Negativa	Integración / Endpoint	Alta	UUID inexistente 50000000-0000-4000-8000-000000000999	PATCH /api/incidentes/50000000-0000-4000-8000-000000000999/prioridad con {"prioridad":"ALTA"}	HTTP 404 Not Found con mensaje de incidente no encontrado	HTTP 404 Not Found: {"message":"No se encontró ningún incidente con el identificador proporcionado."}	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-13	Bloqueo 409 Conflict cuando la misión de verificación aún está en estado DESPACHADA (pendiente de aceptación por patrulla)	Regla de Negocio ICS	Integración / Endpoint	Alta	Incidente INC-2026-9932 con misión MIS-2026-0008 en estado DESPACHADA	PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad previo a POST .../aceptar	HTTP 409 Conflict exigiendo aceptar la misión antes de asignar prioridad	HTTP 409 Conflict: {"message":"La patrulla debe aceptar la misión asignada antes de poder asignar o modificar la prioridad del incidente en terreno."}	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-14	Reglas deterministas de motor de sugerencia: disparo directo a CRITICA con electrodependientes y ajuste de nucleoFamiliarTotal por vulnerables	Funcional / Lógica de Dominio	Unitaria (prioridad.utils)	Alta	Funciones calcularPrioridadSugerida y normalizarEvaluacionTerreno	npm test -- src/modules/incidentes/__tests__/prioridad.utils.test.ts	6/6 tests aprobados validando niveles BAJA, MEDIA, ALTA, CRITICA y resúmenes versionados	6/6 tests aprobados (9ms)	APROBADO	17/11/2026 14:22	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-15	Publicación del evento WebSocket incidente:actualizado en Redis Pub/Sub hacia sala:encargados, encargado y mapa con prioridad y reporteTerreno (CA-5)	Tiempo Real / Socket.io	Integración / Redis Pub/Sub	Alta	Suscriptor Redis en canal sgrai:socket-events durante ejecución de PATCH .../prioridad	docker exec grupo1_redis redis-cli SUBSCRIBE sgrai:socket-events + PATCH .../prioridad	Mensajes publicados en sala:encargados, encargado y mapa conteniendo prioridad, prioridadSugerida, justificacionPrioridad, verificado: true y reporteTerreno	Eventos incidente:actualizado verificados en las tres salas con payload íntegro para Reportes #1 y #2	APROBADO	17/11/2026 14:24	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-16	Proyección de prioridad, prioridadSugerida, justificacionPrioridad, totalReportesTerreno y reportesEvaluacionTerreno en Kanban (GET /api/incidentes) y detalle (GET /api/incidentes/{id})	Funcional / Integración Lectura (CA-5)	Integración / Endpoint	Alta	Incidente INC-2026-9932 actualizado en BD y token JWT de encargado@valdivia.cl	GET /api/incidentes?busqueda=INC-2026-9932 y GET /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38	HTTP 200 OK proyectando prioridad actualizada, totalReportesTerreno e historial reportesEvaluacionTerreno	HTTP 200 OK con totalReportesTerreno: 4, verificado: true y detalle completo de reportes	APROBADO	17/11/2026 14:25	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-17	Proyección de hitos PRIORIDAD_ASIGNADA/PRIORIDAD_RECTIFICADA, reportes versionados y resumen evaluaciones en GET /api/misiones/{id}	Funcional / Trazabilidad ICS	Integración / Endpoint	Media	Misión MIS-2026-0008 con evaluaciones registradas y token JWT encargado@valdivia.cl	GET /api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02	HTTP 200 OK con bitacoraTiempos, reportesTerreno y evaluaciones.prioridadEvaluada: true	HTTP 200 OK reflejando hitos cronológicos e historial versionado de prioridad	APROBADO	17/11/2026 14:25	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-18	Validación de sentencias SQL up/down de la migración 053_incidente_prioridad_y_evaluacion_terreno.ts sobre Kysely	Base de Datos / Migración	Unitaria (Kysely)	Media	Archivo 053_incidente_prioridad_y_evaluacion_terreno.ts y su suite de test	npm test -- src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts	2/2 tests aprobados validando columnas prioridad_sugerida, justificacion_prioridad, version_reporte, es_rectificacion y detalles_evaluacion	2/2 tests aprobados (13ms)	APROBADO	17/11/2026 14:22	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-19	Ejecución completa de las suites automatizadas focalizadas de HU-38 y regresión general en Vitest	Automatización / Regresión	Unitaria / Mocked Integration	Alta	Entorno Node.js con dependencias instaladas	npm test y ejecución focalizada de los 8 archivos de HU-38/Incidentes/Misiones/OpenAPI	34/34 tests focalizados y 835/835 tests globales (74/74 archivos) aprobados	34/34 focalizados (2.15s) y 835/835 totales (7.31s) aprobados	APROBADO	17/11/2026 14:22	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
CP-H38-API-20	Verificación de tipado estricto TypeScript (tsc --noEmit), linter (eslint) y compilación de producción (next build)	Calidad Estática / Build	Compilación / Lint	Alta	Código fuente completo de la rama feature/h38-patrulla-asignar-prioridad	npm run lint && npx tsc --noEmit && npm run build	0 errores de TypeScript, 0 errores de ESLint y compilación next build exitosa	tsc: 0 errores; eslint: 0 errores (1 warning heredado en tipologia); next build: compilación limpia	APROBADO	17/11/2026 14:23	-	feat(incidentes): implementar modelo de evaluacion de prioridad en terreno y consolidacion de afectacion (H38)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Pruebas Automatizadas (Vitest), Linter, TypeScript y Build

#### 5.1.1 Suite Focalizada de HU-38 y Módulos Relacionados (`CP-H38-API-14`, `CP-H38-API-18`, `CP-H38-API-19`)
```bash
npm test -- src/app/api/incidentes/\[id\]/prioridad/__tests__/route.test.ts src/modules/incidentes/__tests__/prioridad.repository.test.ts src/modules/incidentes/__tests__/prioridad.service.test.ts src/modules/incidentes/__tests__/prioridad.utils.test.ts src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts src/modules/incidentes/__tests__/incidente-kanban.service.test.ts src/modules/misiones/__tests__/mision.service.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/incidentes/__tests__/prioridad.utils.test.ts (6 tests) 9ms
 ✓ src/modules/misiones/__tests__/mision.service.test.ts (6 tests) 24ms
 ✓ src/lib/db/migrations/__tests__/053_incidente_prioridad_y_evaluacion_terreno.test.ts (2 tests) 13ms
 ✓ src/modules/incidentes/__tests__/incidente-kanban.service.test.ts (6 tests) 21ms
 ✓ src/modules/incidentes/__tests__/prioridad.service.test.ts (1 test) 12ms
 ✓ src/modules/incidentes/__tests__/prioridad.repository.test.ts (5 tests) 29ms
 ✓ src/app/api/incidentes/[id]/prioridad/__tests__/route.test.ts (7 tests) 69ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 361ms

 Test Files  8 passed (8)
      Tests  34 passed (34)
   Start at  14:22:33
   Duration  2.15s
```

#### 5.1.2 Ejecución de Suite Completa y Pruebas Focalizadas por Patrón (`-t`)
```bash
npm test
npm test -- -t "Route Handlers de Prioridad de Incidente en Terreno \(HU-38\)"
npm test -- -t "PrioridadRepository \(HU-38\)"
npm test -- -t "Motor de Cálculo de Prioridad Sugerida en Terreno \(HU-38\)"
```

**Salida de Consola (`npm test`):**
```text
 Test Files  74 passed (74)
      Tests  835 passed (835)
   Start at  14:16:39
   Duration  7.31s
```

#### 5.1.3 Verificación Estática y Compilación (`CP-H38-API-20`)
```bash
npm run lint && npx tsc --noEmit && npm run build
```

**Salida de Consola:**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts
  13:3  warning  'BadRequestError' is defined but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (0 errors, 1 warning)

=== TSC ===
(0 errors)

=== BUILD ===
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 3.2s
✓ Finished TypeScript in 12.5s
✓ Generating static pages using 15 workers (26/26) in 182ms
```

---

### 5.2 Evidencia de Fallo en Migraciones Kysely y Error `500` Previo a Migración (`BUG-H38-API-03`)

#### 5.2.1 Ejecución de `npm run db:migrate` contra Esquema de `develop`
```bash
DATABASE_URL=postgresql://sgrai:sgrai_dev@localhost:5001/sgrai_qa_h38 npm run db:migrate
```

**Salida de Consola:**
```text
Ejecutando migraciones Kysely de base de datos...
[RECONCILIACIÓN] Migración renumerada actualizada en kysely_migration: "035_permiso_misiones_terreno_verificar" -> "052_permiso_misiones_terreno_verificar"
Error al ejecutar migraciones Kysely: Error: corrupted migrations: previously executed migration 042_cuadrilla_patrulla_integrantes_vistas is missing
    at Migrator.#ensureNoMissingMigrations (/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/node_modules/kysely/dist/migration/migrator.js:500:23)
EXIT_CODE=1
```

#### 5.2.2 Fallo `500` en Endpoints al No Aplicarse la Migración `053`
```bash
curl -s -i -X POST "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad/calcular" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"nucleoFamiliarTotal":4,"cantidadNinos":1,"nivelCompromisoVivienda":"MODERADO"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"nivelCompromisoVivienda":"MODERADO"}}'
```

**Respuestas HTTP/JSON Obtenidas:**
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{"message":"Error interno del servidor al calcular la prioridad sugerida del incidente."}
```
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{"message":"Error interno del servidor al procesar la asignación de prioridad del incidente."}
```
*(Log del servidor: `error: column "prioridad_sugerida" does not exist`, código PostgreSQL `42703` en `src/modules/incidentes/prioridad.repository.ts:164`.)*

---

### 5.3 Pruebas Replicables HTTP/cURL y Reproducción de Defectos (Con Esquema `053`–`055` Aplicado en BD de Pruebas)

#### Caso 1: Rechazo `401 Unauthorized` y `403 Forbidden` RBAC (`CP-H38-API-07`, `CP-H38-API-09`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "Authorization: Bearer token.invalido.123" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: c1111111-1111-4111-8111-111111111111" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 401 Unauthorized
{"message":"Token de sesión inválido o expirado."}

HTTP/1.1 403 Forbidden
{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 2: Rechazos `400 Bad Request` (UUID Inválido, JSON Malformado y Discrepancia sin Justificación — `CP-H38-API-05`, `CP-H38-API-11`)
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
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
{"message":"El identificador del incidente proporcionado no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador del incidente debe ser un UUID válido."}]}

HTTP/1.1 400 Bad Request
{"message":"El cuerpo de la petición no es un JSON válido."}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para la evaluación y asignación de prioridad del incidente.","errors":[{"campo":"justificacion_prioridad","mensaje":"Debe ingresar una justificación técnica de al menos 5 caracteres cuando modifica la prioridad sugerida por el sistema."}]}
```

#### Caso 3: Rechazos `404 Not Found`, `409 Conflict` (`DESPACHADA`) y `403 Forbidden` (Patrulla Ajena) (`CP-H38-API-10`, `CP-H38-API-12`, `CP-H38-API-13`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/50000000-0000-4000-8000-000000000999/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"ALTA","justificacion_prioridad":"Evaluación en terreno"}'

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{"prioridad":"CRITICA"}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
{"message":"No se encontró ningún incidente con el identificador proporcionado."}

HTTP/1.1 409 Conflict
{"message":"La patrulla debe aceptar la misión asignada antes de poder asignar o modificar la prioridad del incidente en terreno."}

HTTP/1.1 403 Forbidden
{"message":"No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."}
```

#### Caso 4: Flujo Completo de Patrulla con JWT Bearer (`POST /aceptar`, `POST /calcular`, `PATCH /prioridad` #1 y #2, Redis Pub/Sub, Kanban y Detalle — `CP-H38-API-01`, `02`, `03`, `06`, `08`, `15`, `16`, `17`)
```bash
# 1. Aceptar misión MIS-2026-0008
curl -s -i -X POST "http://localhost:3001/api/misiones/247be4dd-a0b8-490f-8d66-4de1144ddd02/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588,"longitud":-73.245209}'

# 2. Pre-calcular prioridad sugerida
curl -s -i -X POST "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad/calcular" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}'

# 3. Confirmar prioridad sugerida ALTA (Reporte #1)
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}'

# 4. Modificar prioridad a CRITICA con justificación < 5 caracteres (400 Bad Request)
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"CRITICA","justificacion_prioridad":"mal","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}'

# 5. Modificar prioridad a CRITICA con justificación válida (Reporte #2 — Rectificación) y con token JWT Bearer
TOKEN_PEDRO=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}' | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.token || d.accessToken || d.data?.token || "");')

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"CRITICA","justificacion_prioridad":"Confirmado riesgo crítico en terreno por paciente electrodependiente.","evaluacion":{"nucleoFamiliarTotal":4,"cantidadNinos":1,"cantidadAdultosMayores":1,"viviendasAfectadas":1,"nivelCompromisoVivienda":"MODERADO"}}'
```

**Respuestas HTTP/JSON Reales:**
```http
HTTP/1.1 200 OK
{"message":"Prioridad sugerida calculada exitosamente según evaluación de terreno.","data":{"incidenteId":"dd7db71e-e878-4b58-a115-a848dc88bb38","prioridadActual":"MEDIA","prioridadSugerida":"ALTA","puntajeTotal":47,"factoresGatillantes":["Núcleo familiar afectado: 4 personas (+12 pts)","Niños afectados: 1 (+6 pts)","Adultos mayores afectados: 1 (+7 pts)","Compromiso de vivienda MODERADO (+22 pts)"],"requiereAsistenciaSocialSugerido":true,...}}
```
```http
HTTP/1.1 200 OK
{"message":"Evaluación en terreno y prioridad del incidente registradas exitosamente (Reporte #1).","data":{"incidente":{"id":"dd7db71e-e878-4b58-a115-a848dc88bb38","codigo":"INC-2026-9932","estado":"VERIFICANDO","prioridad":"ALTA","prioridadSugerida":"ALTA","modificoPrioridadSugerida":false,"justificacionPrioridad":null,"requiereAsistenciaSocial":true,"actualizadoEn":"2026-11-17T17:24:57.929Z"},"reporteTerreno":{"id":"565368d6-4a79-4799-805f-a9b9966c24bb","misionId":"247be4dd-a0b8-490f-8d66-4de1144ddd02","versionReporte":1,"esRectificacion":false,"etiquetaReporte":"Reporte de Evaluación #1 (Inicial)","prioridadSugerida":"ALTA","prioridadAsignada":"ALTA",...},"hito":{"id":"1de31b8a-13dc-4213-97b6-4be210990ce1","misionId":"247be4dd-a0b8-490f-8d66-4de1144ddd02","hito":"PRIORIDAD_ASIGNADA",...}}}
```
```http
HTTP/1.1 200 OK
{"message":"Evaluación en terreno rectificada y prioridad del incidente actualizada exitosamente (Reporte #2 — Rectificación).","data":{"incidente":{"id":"dd7db71e-e878-4b58-a115-a848dc88bb38","codigo":"INC-2026-9932","estado":"VERIFICANDO","prioridad":"CRITICA","prioridadSugerida":"ALTA","modificoPrioridadSugerida":true,"justificacionPrioridad":"Se eleva a CRITICA por riesgo de colapso en muro medianero junto a adulto mayor.","requiereAsistenciaSocial":true,"actualizadoEn":"2026-11-17T17:24:58.000Z"},"reporteTerreno":{"versionReporte":2,"esRectificacion":true,"etiquetaReporte":"Reporte de Evaluación #2 (Rectificación)",...},"hito":{"hito":"PRIORIDAD_RECTIFICADA",...}}}
```

#### Caso 5: Reproducción de Defectos Críticos/Altos en Vivo (`BUG-H38-API-01`, `02`, `04`, `05`)
```bash
# BUG-H38-API-01 (1): snake_case en riesgosActivos anulado por .default(false) -> BAJA 0 pts
curl -s -i -X POST "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad/calcular" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"riesgosActivos":{"riesgo_electrico":true,"riesgo_estructural":true,"aislamiento_vial":true}}'

# BUG-H38-API-01 (2): Override cliente de prioridadSugerida evadiendo justificación (185 pts -> BAJA)
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"BAJA","prioridadSugerida":"BAJA","evaluacion":{"personasElectrodependientes":2,"nivelCompromisoVivienda":"GRAVE_INHABITABLE","requiereEvacuacion":true}}'

# BUG-H38-API-02: Patrulla ajena muta incidente en ATENCION_CUADRILLA (patrulla_id IS NULL) e incidente RESUELTO
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000004/prioridad" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"BAJA","prioridadSugerida":"BAJA"}'

curl -s -i -X POST "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000006/prioridad/calcular" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" -d '{}'

# BUG-H38-API-04: Condición de carrera en version_reporte bajo peticiones paralelas
curl -s -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","prioridadSugerida":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"nivelCompromisoVivienda":"MODERADO"}}' &
curl -s -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA","prioridadSugerida":"ALTA","evaluacion":{"nucleoFamiliarTotal":4,"nivelCompromisoVivienda":"MODERADO"}}' &
wait

# BUG-H38-API-05: Inspección de OpenAPI y Redis Pub/Sub
curl -s http://localhost:3001/openapi.json | node -e 'const d = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log({version: d.info.version, securitySchemes: d.components?.securitySchemes, patchSec: d.paths["/api/incidentes/{id}/prioridad"]?.patch?.security, calcSec: d.paths["/api/incidentes/{id}/prioridad/calcular"]?.post?.security});'
```

**Evidencias Obtenidas:**
```text
# BUG-H38-API-01 (1):
HTTP/1.1 200 OK -> "prioridadSugerida":"BAJA","puntajeTotal":0,"riesgosActivos":{"riesgoElectrico":false,"riesgoEstructural":false,"riesgoQuimicoSanitario":false,"aislamientoVial":false}

# BUG-H38-API-01 (2):
HTTP/1.1 200 OK -> "prioridad":"BAJA","prioridadSugerida":"BAJA","modificoPrioridadSugerida":false,"justificacionPrioridad":null ... "puntajeTotal":185

# BUG-H38-API-02:
HTTP/1.1 200 OK sobre INC-2026-0004 (MIS-2026-0002, ATENCION_CUADRILLA, patrulla_id = null) y HTTP/1.1 200 OK sobre INC-2026-0006 (RESUELTO)

# BUG-H38-API-04 (PostgreSQL reporte_terreno y mision_hito):
 4dd1637f-c0af-4d29-98d2-f7f68f246c6b |               1 | f                | ALTA               | ALTA
 cc18ec11-5f81-4fc0-95f6-dca6889efec3 |               1 | f                | ALTA               | ALTA
 (2 filas con version_reporte = 1 y 2 hitos PRIORIDAD_ASIGNADA)

# BUG-H38-API-05:
{ version: '0.10.0', securitySchemes: undefined, patchSec: [ { bearerAuth: [] } ], calcSec: [ { bearerAuth: [] } ] }
Redis sgrai:socket-events: mision:actualizada emitido únicamente a {"room":"encargado",...} (omite "sala:encargados" y "supervisor")
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La PWA debe mostrar de forma visible la `prioridad_sugerida` calculada preliminarmente por el sistema. | `CP-H38-API-01`, `CP-H38-API-14`, `BUG-H38-API-01`, `BUG-H38-API-02`, `BUG-H38-API-03` | 🔴 **CON DEFECTO (`BUG-H38-API-01`, `02`, `03`)** | El cálculo preliminar se expone en `POST /api/incidentes/{id}/prioridad/calcular`, pero `RiesgosActivosEvaluacionSchema` descarta los campos `snake_case` (`BUG-H38-API-01`), carece de control de acceso sobre incidentes ajenos o cerrados (`BUG-H38-API-02`) y falla con `500` mientras la migración `053` permanezca bloqueada (`BUG-H38-API-03`). La representación visual corresponde a `sgrai-pwa`. |
| **CA-2:** Debe proveer un selector con los cuatro niveles de prioridad canónicos del sistema: `BAJA`, `MEDIA`, `ALTA`, `CRITICA`. | `CP-H38-API-04`, `CP-H38-API-19` | 🟢 **APROBADO EN API** *(UI en `sgrai-pwa`)* | `PrioridadCanonicaEnum` valida estrictamente los cuatro niveles canónicos y rechaza valores fuera de catálogo con `400 Bad Request`. El componente selector corresponde a `sgrai-pwa`. |
| **CA-3:** Si la patrulla decide modificar la prioridad sugerida, el sistema debe desplegar un campo de texto obligatorio para ingresar la justificación técnica (`justificacion_prioridad` de al menos 5 caracteres). | `CP-H38-API-03`, `CP-H38-API-05`, `CP-H38-API-06`, `BUG-H38-API-01` | 🔴 **CON DEFECTO (`BUG-H38-API-01`)** | Valida >= 5 caracteres cuando no se sobrescribe `prioridadSugerida`, pero la regla puede evadirse enviando `prioridadSugerida` igual a `prioridad` en el payload o enviando `familias` en la raíz del cuerpo JSON (`BUG-H38-API-01`). El despliegue condicional del campo en UI corresponde a `sgrai-pwa`. |
| **CA-4:** Al confirmar, la API debe actualizar en una transacción: (1) `incidente.prioridad`, (2) `incidente.justificacion_prioridad`, y (3) Registrar el hito de cambio de prioridad en `mision_hito`. | `CP-H38-API-02`, `CP-H38-API-03`, `CP-H38-API-17`, `CP-H38-API-18`, `BUG-H38-API-03`, `BUG-H38-API-04` | 🔴 **CON DEFECTO (`BUG-H38-API-03`, `BUG-H38-API-04`)** | La transacción actualiza `incidente`, inserta en `reporte_terreno` y registra `PRIORIDAD_ASIGNADA` / `PRIORIDAD_RECTIFICADA` en `mision_hito` cuando la BD está migrada, pero carece de bloqueo `.forUpdate("mision")` e índice único generando versiones `#1` duplicadas bajo concurrencia (`BUG-H38-API-04`), silencia errores SQL en `try/catch` y requiere corregir la secuencia de migraciones (`BUG-H38-API-03`). |
| **CA-5:** El sistema debe emitir la notificación WebSocket `incidente:actualizado` al Centro de Mando, reflejando el nuevo badge de prioridad en el tablero Kanban. | `CP-H38-API-15`, `CP-H38-API-16`, `BUG-H38-API-05` | 🟡 **PARCIAL (`BUG-H38-API-05`)** | `incidente:actualizado` se emite a `sala:encargados`, `encargado` y `mapa`, y `GET /api/incidentes` / `GET /api/incidentes/{id}` proyectan `prioridad`, `prioridadSugerida` y `justificacionPrioridad`; sin embargo, en memoria ejecuta un broadcast global duplicado y `notificarMisionActualizada` omite `sala:encargados` y `supervisor` en Redis Pub/Sub (`BUG-H38-API-05`). El renderizado del badge corresponde a `sgrai-web`. |
| **CA-6:** El endpoint debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H38-API-07`, `CP-H38-API-08`, `CP-H38-API-09`, `CP-H38-API-10`, `BUG-H38-API-02`, `BUG-H38-API-03`, `BUG-H38-API-05` | 🔴 **CON DEFECTO (`BUG-H38-API-02`, `03`, `05`)** | Los route handlers verifican `PERMISO_VERIFICAR_MISION_TERRENO` (`401`/`403`), pero permiten el bypass horizontal cuando `patrulla_id` es `NULL` o en `POST /prioridad/calcular` (`BUG-H38-API-02`), duplican la migración `035_` como `052_` (`BUG-H38-API-03`) y declaran `bearerAuth` no definido en OpenAPI (`BUG-H38-API-05`). |

