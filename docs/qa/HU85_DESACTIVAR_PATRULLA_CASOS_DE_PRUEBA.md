# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-85 — Desactivar Patrulla Verificadora mediante Baja Lógica (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Patrullas Verificadoras (`sgrai-api` — `DELETE /api/patrullas/[id]`).  
> **Historia de Usuario:** HU-85 — *"Como Administrador Quiero desactivar mediante baja lógica una patrulla verificadora que ya no prestará servicios. Para impedir que sea seleccionada en nuevos despachos, conservando la auditoría de los reportes técnicos en los que actuó."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H85-desactivar-patrulla`  
> **Commits Evaluados en la Rama:**  
> * `feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)`  
> * `merge: resolver conflictos con develop integrando openapi de cuadrillas (H81) y patrullas (HU-84/HU-85)`  
> * `merge: sincronizar con develop resolviendo conflicto de tipado y renumerando migracion a 033`  
> * `merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)`  
> * `feat(seguridad): exponer unidadActiva, unidadId y unidadNombre en perfil de sesion y usuario activo (H85)`  
> * `merge: sincronizar feature/H85-desactivar-patrulla con develop integrando HU-84`  
> * `fix(recursos-y-personal): corregir tipo de mockAdminUsuario en tests de patrulla.service`  
>  
> **Fecha de Auditoría Inicial:** 03/11/2026 21:58.  
> **Fecha de Certificación Re-Test:** 08/11/2026 21:32.  
> **Estado de Certificación:** 🟢 **APROBADO PARA INTEGRACIÓN (100% PASS TRAS RE-TEST)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Ciclo de Re-Test

Tras ejecutar el ciclo formal de **Re-Test** sobre la rama `feature/H85-desactivar-patrulla` (sincronizada con `develop` e integrando HU-82, HU-83 y HU-84), se certifica que los **6 defectos detectados** durante la auditoría inicial (`BUG-H85-API-01` a `BUG-H85-API-06`) fueron subsanados en su totalidad y verificados mediante inspección forense de código, análisis estático (`eslint` y `tsc --noEmit`) y ejecución de las suites automatizadas de pruebas unitarias e integración en Vitest.

| Métrica de Calidad | Evaluación Inicial (03/11/2026) | Ciclo Re-Test (08/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **26** | **26** | 6 Defectos Auditados y Subsanados (`BUG-H85-API-01` a `06`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io (`CP-H85-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | **26** | 100% de los casos funcionales, transaccionales, de concurrencia, seguridad RBAC y regresión aprobados |
| **Defectos Abiertos / Fallidos (Failed)** | **6** | **0** | Los 6 defectos detectados (2 críticos, 3 altos, 1 medio) fueron corregidos y verificados en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Sin bloqueos de entorno o infraestructura |
| **Tasa de Aprobación Global (% Pass)** | **76.9%** | **100.0%** | Cumplimiento íntegro de todos los Criterios de Aceptación y de la Regla Crítica §3.7 |
| **Suite Automatizada de Patrullas y Seguridad (Vitest)** | **75/75 tests pass** | **155/155 tests pass** | `patrulla.schema.test.ts` (24), `patrulla.service.test.ts` (37), `api/patrullas/route.test.ts` (36), `openapi.json/route.test.ts` (1) y `seguridad.test.ts` (57) |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores** | **0 errores** | 0 errores en todo el repositorio |
| **Chequeo de Tipos TypeScript (`npx tsc --noEmit`)** | **Con observaciones** | **0 errores** | Compilación estricta limpia tras unificar el mock `UsuarioAutenticado` en `patrulla.service.test.ts` |
| **Secuencia de Migraciones Kysely** | 🔴 **Colisión en `032_`** | 🟢 **Secuencia limpia (`034_`)** | Coexistencia ordenada: `032_cuadrilla_baja_logica_activo.ts` (HU-82), `033_patrullas_codigo_vehiculo.ts` (HU-83) y `034_patrulla_desactivacion_baja_logica.ts` (HU-85) |

---

## 2. Registro Técnico de Defectos Detectados y Verificación de Subsanación (Re-Test)

### `BUG-H85-API-01`: Ausencia de Bloqueo Operativo para Estados de Despliegue en Terreno (`EN_PREVENCION`, `EN_RECUPERACION`, `EN_MISION`) y Condición de Carrera TOCTOU sin `SELECT ... FOR UPDATE` en `desactivarPatrullaService` / `desactivarPatrullaTransaccionalRepo`
* **Severidad:** **CRÍTICA** (Criterio de Aceptación 3 y Control de Concurrencia en Operaciones ICS).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 08/11/2026 21:32)**.
* **Archivos Afectados:**
  * `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 610-653)
  * `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 692-733)
* **Descripción Técnica del Defecto Original:**  
  1. `desactivarPatrullaService` solo evaluaba `patrulla_estado === "EN_VERIFICACION"`, permitiendo desactivar unidades desplegadas en estados `EN_PREVENCION`, `EN_RECUPERACION` o `EN_MISION`.
  2. `desactivarPatrullaTransaccionalRepo` no adquiría bloqueo pesimista `.forUpdate()` sobre la fila de `patrulla_verificadora` ni re-validaba atómicamente dentro de `db.transaction()` el estado en terreno y la ausencia de misiones activas (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`).
* **Verificación Técnica en Re-Test:**
  1. En `patrulla.service.ts` (líneas 611-626), se define `ESTADOS_PATRULLA_EN_TERRENO = ["EN_VERIFICACION", "EN_PREVENCION", "EN_RECUPERACION", "EN_MISION"] as const` y se lanza `ConflictError` (`HTTP 409`) ante cualquiera de los cuatro estados de despliegue operativo.
  2. En `patrulla.repository.ts` (líneas 694-732), `desactivarPatrullaTransaccionalRepo` ejecuta `.forUpdate()` sobre `patrulla_verificadora`, re-valida dentro de la transacción `trx` los 4 estados de despliegue en terreno y consulta atómicamente la tabla `mision` (`estado IN ('PLANIFICADA', 'DESPACHADA', 'EN_CURSO')`), abortando con `CONFLICT:...` que el servicio transforma en `ConflictError` (`HTTP 409`).
  3. Verificado mediante pruebas unitarias en `patrulla.service.test.ts` (líneas 1103-1119 y 1138-1149).

---

### `BUG-H85-API-02`: Liberación Incompleta y Corrupción de Disponibilidad (`usuario.estado_operativo`) al Ignorar `usuario_lider_id` y Sobrescribir Incondicionalmente el Estado de los Integrantes en `desactivarPatrullaTransaccionalRepo`
* **Severidad:** **CRÍTICA** (Criterio de Aceptación 5 e Integridad de Disponibilidad de Personal en Base de Datos).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 08/11/2026 21:32)**.
* **Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 698, 749-811).
* **Descripción Técnica del Defecto Original:**  
  `desactivarPatrullaTransaccionalRepo` no seleccionaba `usuario_lider_id` y ejecutaba un `UPDATE usuario SET estado_operativo = 'disponible'` incondicional sobre todos los integrantes de `patrulla_personal`, sin comprobar si el funcionario tenía `activo = true`, si su estado era `'en_patrulla'` (frente a `'inactivo'` o `'fuera_de_servicio'`) o si pertenecía simultáneamente a otra patrulla o cuadrilla activa.
* **Verificación Técnica en Re-Test:**
  1. En `patrulla.repository.ts` (líneas 698 y 758-766), se selecciona `usuario_lider_id` de `patrulla_verificadora` y se consolida en el conjunto `usuarioIdsCandidatos` junto con los `usuario_id` de `patrulla_personal`.
  2. En las líneas 770-811, la sentencia SQL de liberación actualiza `usuario.estado_operativo = 'disponible'` exclusivamente cuando se cumplen todas las condiciones de integridad:
     * `activo = true` y `estado_operativo = 'en_patrulla'`.
     * `NOT EXISTS` en otra `patrulla_verificadora` activa (`pv2.eliminado_en IS NULL AND pv2.id != :id`) como integrante (`patrulla_personal`) ni como líder (`usuario_lider_id`).
     * `NOT EXISTS` en una `cuadrilla` activa (`c.eliminado_en IS NULL AND c.activo = true`) como brigadista (`cuadrilla_personal`) ni como delegado (`usuario_delegado_id`).
  3. Adicionalmente, en `src/modules/seguridad/repository.ts` y `service.ts` (`feat(seguridad): exponer unidadActiva, unidadId y unidadNombre en perfil de sesion y usuario activo (H85)`), el perfil de sesión expone `unidadActiva` para reflejar el estado de vigencia de la unidad asignada.

---

### `BUG-H85-API-03`: Pérdida de Trazabilidad del Vehículo Histórico — `desactivarPatrullaTransaccionalRepo` Sobrescribe `patrulla_verificadora.vehiculo_id = null` Eliminando el Vínculo de Auditoría
* **Severidad:** **ALTA** (Regla Crítica §3.7 de Borrado Lógico y Auditoría Inmutable).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 08/11/2026 21:32)**.
* **Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 736-747, 813-833).
* **Descripción Técnica del Defecto Original:**  
  Al ejecutar la baja lógica, `desactivarPatrullaTransaccionalRepo` sobrescribía `vehiculo_id: null` en `patrulla_verificadora`, destruyendo el registro histórico de qué vehículo institucional operó con la patrulla.
* **Verificación Técnica en Re-Test:**
  En `patrulla.repository.ts` (líneas 737-747 y 814-823), el vehículo institucional es liberado al inventario comunal en la tabla `recurso` (`estado = 'DISPONIBLE'`, `cantidad_en_uso = 0`), mientras que el `UPDATE` sobre `patrulla_verificadora` conserva intacta la columna `vehiculo_id`, preservando la trazabilidad histórica completa del móvil asignado a la patrulla dada de baja.

---

### `BUG-H85-API-04`: Imposibilidad de Consultar o Auditar Patrullas Desactivadas en `GET /api/patrullas` y `GET /api/patrullas/[id]` (Filtro Rígido `eliminado_en IS NULL` y Omisión de `activo`, `eliminadoEn` y `eliminadoPorId`)
* **Severidad:** **ALTA** (Auditoría de Reportes Técnicos y Contrato de Consulta).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 08/11/2026 21:32)**.
* **Archivos Afectados:**
  * `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 41-43, 74-78, 146-148, 201-251)
  * `src/modules/recursos-y-personal/patrulla.schema.ts` (Líneas 49-71, 181-184)
  * `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 132-135, 354, 415, 602)
* **Descripción Técnica del Defecto Original:**  
  `obtenerPatrullaPorIdRepo` y `listarPatrullasRepo` aplicaban de forma rígida `.where("pv.eliminado_en", "is", null)`, retornando `404 Not Found` al consultar el detalle de una patrulla desactivada e impidiendo listar unidades dadas de baja; además, `PatrullaItemResponseSchema` omitía `activo`, `eliminadoEn` y `eliminadoPorId`.
* **Verificación Técnica en Re-Test:**
  1. `obtenerPatrullaPorIdRepo` (`patrulla.repository.ts:201-251`) permite recuperar el detalle histórico de patrullas desactivadas incluyendo `patrulla_activo`, `patrulla_eliminado_en` y `patrulla_eliminado_por_id`, mientras que las operaciones mutadoras (`actualizarEstadoPatrullaService`, `modificarPatrullaService`, `desactivarPatrullaService`) verifican explícitamente `patrulla_activo === false || Boolean(patrulla_eliminado_en)` para rechazar con `404 Not Found` cualquier modificación o doble baja.
  2. `ListarPatrullasQuerySchema` (`patrulla.schema.ts:49-71`) y `listarPatrullasRepo` (`patrulla.repository.ts:74-78`) soportan los parámetros `activo` (`true` / `false`) e `incluirInactivas` (`true` / `false`), manteniendo por defecto solo patrullas activas (`eliminado_en IS NULL AND activo = true`) cuando no se especifican.
  3. `PatrullaItemResponseSchema` y `mapearFilaAPatrullaDTO` exponen `activo`, `eliminadoEn` y `eliminadoPorId`.

---

### `BUG-H85-API-05`: Consultas de Despacho en Eventos ATP (HU-29 y HU-30) No Filtran `activo = true` ni `eliminado_en IS NULL`, y Documentación Técnica (`docs/api/recursos-y-personal.md`) Contradice la Migración 025
* **Severidad:** **MEDIA** (Defensa en Profundidad en Despachos Transversales y Alineación Documental).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 08/11/2026 21:32)**.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-prevencion.repository.ts` (Líneas 6-14)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 61-69)
  * `docs/api/recursos-y-personal.md` (Líneas 610-611, 686-696)
  * `src/lib/openapi/index.ts` (Líneas 2083-2089)
* **Descripción Técnica del Defecto Original:**  
  `buscarPatrullaPorId` en `evento-prevencion.repository.ts` y `recuperacion.repository.ts` no filtraba `eliminado_en IS NULL` ni `activo = true`; `docs/api/recursos-y-personal.md` referenciaba la columna `estado_operativo` en la tabla `personal` en lugar de `usuario`; y `src/lib/openapi/index.ts` omitía el header opcional `x-user-id` en `DELETE /api/patrullas/{id}`.
* **Verificación Técnica en Re-Test:**
  1. Ambos repositorios de Eventos ATP (`evento-prevencion.repository.ts:11-12` y `recuperacion.repository.ts:66-67`) filtran `.where("eliminado_en", "is", null).where("activo", "=", true)`.
  2. `docs/api/recursos-y-personal.md` (líneas 610 y 695) documenta con precisión la actualización de `estado_operativo` en la tabla `usuario`, el bloqueo en los 4 estados de terreno y la preservación de `vehiculo_id`.
  3. `src/lib/openapi/index.ts` (líneas 2083-2089) declara el header opcional `x-user-id` en `DELETE /api/patrullas/{id}`.

---

### `BUG-H85-API-06`: Colisión de Numeración Secuencial de Migraciones Kysely (`032_patrulla_desactivacion_baja_logica.ts` Duplica el Correlativo `032` de `032_cuadrilla_baja_logica_activo.ts` en HU-82)
* **Severidad:** **ALTA** (Secuencia de Migraciones Kysely en Integración con `develop`).
* **Estado:** 🟢 **`CORREGIDO` (Verificado en Re-Test — 08/11/2026 21:32)**.
* **Archivo Afectado:** `src/lib/db/migrations/034_patrulla_desactivacion_baja_logica.ts`.
* **Descripción Técnica del Defecto Original:**  
  La migración de baja lógica de patrullas utilizaba el correlativo `032_`, colisionando con `032_cuadrilla_baja_logica_activo.ts` (HU-82).
* **Verificación Técnica en Re-Test:**
  Tras sincronizar la rama con `develop` (integrando HU-82 y HU-83), la migración fue renumerada secuencialmente a `src/lib/db/migrations/034_patrulla_desactivacion_baja_logica.ts`, quedando en orden estrictamente monotónico detrás de `032_cuadrilla_baja_logica_activo.ts` y `033_patrullas_codigo_vehiculo.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H85-API-01` | Bloqueo 409 Conflict para todos los estados de despliegue en terreno (EN_VERIFICACION, EN_PREVENCION, EN_RECUPERACION, EN_MISION) y bloqueo pesimista SELECT FOR UPDATE transaccional | Regla de Negocio / Concurrencia | Service / Repo | Crítica | Patrulla verificadora en estado EN_VERIFICACION, EN_PREVENCION, EN_RECUPERACION o EN_MISION o despacho concurrente | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `x-user-id: 00000000-0000-4000-8000-000000000001` | HTTP 409 Conflict bloqueando la baja en cualquiera de los 4 estados de despliegue en terreno y re-validación atómica con `.forUpdate()` en `trx` | `desactivarPatrullaService` y `desactivarPatrullaTransaccionalRepo` (con `.forUpdate()`) validan `ESTADOS_PATRULLA_EN_TERRENO` y misiones activas lanzando `409 Conflict` | APROBADO | 03/11/2026 18:10 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `BUG-H85-API-02` | Liberación íntegra del líder (`usuario_lider_id`) y dotación condicionada a usuarios activos en `'en_patrulla'` sin presencia en otras unidades activas | Integridad / DB | Repository | Crítica | Patrulla con `usuario_lider_id` e integrantes en `patrulla_personal` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | Libera al líder y a los integrantes a `'disponible'` solo si están activos, en `'en_patrulla'` y `NOT EXISTS` en otra patrulla o cuadrilla activa | `desactivarPatrullaTransaccionalRepo` consolida `usuario_lider_id` e integrantes y ejecuta `UPDATE usuario` con guardas `activo = true`, `estado_operativo = 'en_patrulla'` y `NOT EXISTS` | APROBADO | 03/11/2026 18:12 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `BUG-H85-API-03` | Preservación de la trazabilidad del vehículo histórico en `patrulla_verificadora.vehiculo_id` al liberar el recurso durante la baja lógica | Auditoría / DB | Repository | Alta | Patrulla activa con vehículo institucional asignado (`vehiculo_id = e1000000-0000-4000-8000-000000000002`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | El vehículo pasa a `DISPONIBLE` (`cantidad_en_uso = 0`) en tabla `recurso` conservando `vehiculo_id` en `patrulla_verificadora` | Se libera el vehículo en `recurso` y se conserva intacto `vehiculo_id` en la fila inactiva de `patrulla_verificadora` cumpliendo la Regla Crítica §3.7 | APROBADO | 03/11/2026 18:14 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `BUG-H85-API-04` | Consulta histórica de patrullas dadas de baja en `GET /api/patrullas/[id]` y `GET /api/patrullas` exponiendo `activo`, `eliminadoEn` y `eliminadoPorId` | Funcional / Contrato | Repo / Schema / Service | Alta | Patrulla verificadora desactivada con `activo = false` y `eliminado_en IS NOT NULL` | `GET /api/patrullas/f1000000-0000-4000-8000-000000000001` y `GET /api/patrullas?incluirInactivas=true` | `GET /api/patrullas/[id]` retorna la ficha histórica con `activo: false`, `eliminadoEn` y `eliminadoPorId`; `GET /api/patrullas` soporta `activo` e `incluirInactivas` | Ficha histórica consultable por ID y filtros `activo` / `incluirInactivas` operativos con campos de auditoría mapeados en `PatrullaItemResponseSchema` | APROBADO | 03/11/2026 18:16 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `BUG-H85-API-05` | Filtro de vigencia (`eliminado_en IS NULL` y `activo = true`) en `buscarPatrullaPorId` de Eventos ATP y alineación documental de `usuario.estado_operativo` y OpenAPI | Integridad / Docs | Repo ATP / Docs / OpenAPI | Media | Patrulla desactivada invocada en despacho ATP y revisión de `docs/api/recursos-y-personal.md` y `src/lib/openapi/index.ts` | `buscarPatrullaPorId(trx, patrullaId)` y lectura de `docs/api/recursos-y-personal.md:695` | Repositorios ATP filtran `eliminado_en IS NULL` y `activo = true`; documentación referencia `usuario.estado_operativo` y OpenAPI incluye `x-user-id` | Filtros `.where("eliminado_en", "is", null).where("activo", "=", true)` aplicados en ambos repositorios ATP y documentación/OpenAPI actualizados | APROBADO | 03/11/2026 18:18 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `BUG-H85-API-06` | Renumeración secuencial de migración Kysely a `034_patrulla_desactivacion_baja_logica.ts` sin colisión con HU-82 (`032_`) ni HU-83 (`033_`) | Integridad / Migraciones | DB / CI | Alta | Existencia de `032_cuadrilla_baja_logica_activo.ts` y `033_patrullas_codigo_vehiculo.ts` en `develop` | Inspección de `src/lib/db/migrations/` y orden lexicográfico de `FileMigrationProvider` | La migración de HU-85 se numera como `034_patrulla_desactivacion_baja_logica.ts` sin colisionar con HU-82 ni HU-83 | Archivo renombrado a `034_patrulla_desactivacion_baja_logica.ts` garantizando ejecución determinista en Kysely | APROBADO | 03/11/2026 21:55 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `CP-H85-API-01` | Desactivación exitosa (baja lógica) de patrulla verificadora en estado DISPONIBLE sin misiones activas | Funcional | Route / Service / Repo | Crítica | Patrulla activa en estado `DISPONIBLE` con vehículo y dotación asignada, sin misiones en curso | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token_admin>` | HTTP 200 OK con `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminadoEn`, `eliminadoPorId`, `vehiculoLiberadoId` y `personalLiberadoIds` | HTTP 200 OK retornando estructura `DesactivarPatrullaResponseSchema` completa | APROBADO | 03/11/2026 18:20 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-02` | Rechazo con HTTP 409 Conflict al intentar desactivar una patrulla en estado EN_VERIFICACION (CA-3) | Regla de Negocio / ICS | Service / Route | Crítica | Patrulla activa desplegada en terreno con `estado = 'EN_VERIFICACION'` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token_admin>` | HTTP 409 Conflict con mensaje indicando que la patrulla se encuentra en terreno en estado `'EN_VERIFICACION'` | HTTP 409 Conflict bloqueando la baja lógica de la unidad en verificación | APROBADO | 03/11/2026 18:20 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-03` | Rechazo con HTTP 409 Conflict cuando la patrulla posee misiones tácticas activas (PLANIFICADA, DESPACHADA o EN_CURSO) (CA-3) | Regla de Negocio / ICS | Service / Repo | Crítica | Patrulla con misión asociada en tabla `mision` en estado `EN_CURSO` (`MIS-2026-0001`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token_admin>` | HTTP 409 Conflict listando el código de la misión activa en curso (`MIS-2026-0001`) | HTTP 409 Conflict: `"No es posible desactivar la patrulla verificadora '...' porque cuenta con misiones tácticas activas en curso (MIS-2026-0001)."` | APROBADO | 03/11/2026 18:21 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-04` | Persistencia de atributos de baja lógica (`activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, `eliminado_por_id`) (CA-4) | Integridad / DB | Repository / DB | Crítica | Patrulla activa sin misiones en curso | Ejecución de `desactivarPatrullaTransaccionalRepo(id, adminId)` | Registro preservado físicamente en `patrulla_verificadora` con `activo = false`, `estado = 'NO_DISPONIBLE'`, `eliminado_en` y `eliminado_por_id` | Actualización atómica en Kysely retornando `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminadoEn` ISO y `eliminadoPorId` | APROBADO | 03/11/2026 18:21 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-05` | Liberación transaccional del vehículo institucional asignado a estado DISPONIBLE y `cantidad_en_uso = 0` (CA-5) | Regla de Negocio / Inventario | Repository / DB | Crítica | Patrulla con vehículo `e1000000-0000-4000-8000-000000000002` en estado `ASIGNADO` (`cantidad_en_uso = 1`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | Tabla `recurso` actualiza el vehículo a `estado = 'DISPONIBLE'`, `cantidad_en_uso = 0` y retorna `vehiculoLiberadoId` | Vehículo actualizado a `DISPONIBLE` dentro de la misma transacción y devuelto en `data.vehiculoLiberadoId` | APROBADO | 03/11/2026 18:21 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-06` | Desactivación exitosa de patrulla verificadora sin vehículo asignado (`vehiculo_id = null`) | Caso de Borde | Service / Repo | Media | Patrulla activa conformada solo por personal a pie (`vehiculo_id = null`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000002` | HTTP 200 OK con `vehiculoLiberadoId: null`, liberando únicamente a los integrantes y omitiendo `emitirRecursoActualizado` | HTTP 200 OK procesado sin errores cuando la patrulla no posee vehículo asignado | APROBADO | 03/11/2026 18:22 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-07` | Preservación inalterada de misiones cerradas y reportes de terreno históricos (`reporte_terreno`) tras la baja lógica | Auditoría / Regla §3.7 | Base de Datos | Crítica | Patrulla con misiones históricas en estado `COMPLETADA` y registros en `reporte_terreno` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | No se ejecuta `DELETE` físico en `patrulla_verificadora`; claves foráneas en `mision.patrulla_id` y `reporte_terreno` se mantienen intactas | Trazabilidad histórica de misiones finalizadas e informes técnicos preservada al 100% | APROBADO | 03/11/2026 18:22 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-08` | Exclusión automática de la patrulla desactivada en el listado operativo por defecto (`GET /api/patrullas`) para impedir nuevos despachos | Funcional / Integración | Repository / Service | Alta | Patrulla recién desactivada con `eliminado_en IS NOT NULL` y `activo = false` | `GET /api/patrullas?estado=DISPONIBLE` | La patrulla dada de baja no aparece en el selector de patrullas disponibles para despacho | Excluida del listado operativo general impidiendo su selección en nuevos despachos | APROBADO | 03/11/2026 18:22 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-09` | Liberación del código identificador único (`idx_patrulla_codigo_unico` parcial `WHERE eliminado_en IS NULL`) tras baja lógica | Integridad / DB | Migración 033 | Media | Patrulla con código `PV-COSTA-01` dada de baja (`eliminado_en IS NOT NULL`) | `POST /api/patrullas` creando nueva patrulla con `codigo: "PV-COSTA-01"` | El índice único parcial `WHERE eliminado_en IS NULL` y `buscarPatrullaPorCodigoRepo` permiten reutilizar el código institucional | El código queda disponible para reasignación sin colisión de clave única | APROBADO | 03/11/2026 18:22 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-10` | Rechazo con HTTP 401 Unauthorized cuando no se envía token JWT ni cabecera de autenticación | Seguridad / Auth | Route Handler | Crítica | Petición anónima sin cabeceras `Authorization` ni `x-user-id` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` sin headers | HTTP 401 Unauthorized impidiendo la ejecución del servicio | Retorna HTTP 401 Unauthorized con mensaje de error de autenticación | APROBADO | 03/11/2026 18:23 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-11` | Rechazo con HTTP 403 Forbidden para usuario autenticado sin perfil Administrador ni permiso `recursos:eliminar` | Seguridad / RBAC | Service / Guard | Crítica | Usuario autenticado con rol `CALL_CENTER` o `INFORMANTE` sin permiso `recursos:eliminar` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con token sin privilegios | HTTP 403 Forbidden denegando la baja lógica | Retorna HTTP 403 Forbidden mediante `verificarPermiso(usuarioId, PERMISO_ELIMINAR_RECURSO)` | APROBADO | 03/11/2026 18:23 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-12` | Autorización exitosa mediante perfil Administrador o permiso explícito `recursos:eliminar` | Seguridad / RBAC | Service / Guard | Alta | Usuario autenticado con rol `ADMIN` o permiso `recursos:eliminar` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `x-user-id` de Administrador | Acceso autorizado hacia `desactivarPatrullaService` | Validación RBAC superada exitosamente ejecutando la baja lógica | APROBADO | 03/11/2026 18:23 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-13` | Rechazo con HTTP 400 Bad Request ante parámetro de ruta `id` con formato no UUID | Validación / Zod | Route Handler | Media | Parámetro `:id` malformado en la URL | `DELETE /api/patrullas/id-no-valido` | HTTP 400 Bad Request con `"Identificador de patrulla inválido."` y detalle en `errors` | Retorna HTTP 400 validado por `PatrullaIdParamSchema.safeParse` | APROBADO | 03/11/2026 18:23 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-14` | Rechazo con HTTP 404 Not Found cuando la patrulla no existe o ya fue desactivada previamente (idempotencia de segunda baja) | Robustez / Negocio | Service / Route | Alta | UUID inexistente o patrulla previamente dada de baja (`activo = false` / `eliminado_en IS NOT NULL`) | `DELETE /api/patrullas/f9999999-0000-4000-8000-000000000999` | HTTP 404 Not Found indicando que la patrulla no existe o ya ha sido desactivada | Retorna HTTP 404 Not Found capturando `NotFoundError` | APROBADO | 03/11/2026 18:24 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-15` | Validación de contrato de salida con `DesactivarPatrullaResponseSchema` y `PatrullaItemResponseSchema` en Zod | Contrato / Schema | Unit / Zod | Alta | Objeto de respuesta de baja lógica y ficha de patrulla inactiva | `DesactivarPatrullaResponseSchema.safeParse(payloadBaja)` y `PatrullaItemResponseSchema.safeParse(patrullaInactiva)` | Validación exitosa exigiendo `activo` booleano, `estado` canónico, `eliminadoEn`, `eliminadoPorId` y `personalLiberadoIds` | Esquemas validan payloads activos e inactivos con sus metadatos de auditoría | APROBADO | 03/11/2026 18:24 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-16` | Emisión de eventos WebSocket `patrulla:desactivada`, `patrulla:actualizada` y `recurso:actualizado` en tiempo real | Tiempo Real / Socket.io | Service / Socket | Alta | Baja lógica exitosa de patrulla con vehículo asignado | Ejecución de `desactivarPatrullaService` | Se invocan `notificarPatrullaDesactivada`, `notificarPatrullaActualizada` y `emitirRecursoActualizado` hacia las salas operacionales | Los 3 eventos Socket.io se emiten con los payloads esperados | APROBADO | 03/11/2026 18:24 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-17` | Estructura DDL e idempotencia (`up` y `down`) de `034_patrulla_desactivacion_baja_logica.ts` en `patrulla_verificadora` | Base de Datos | Migración Kysely | Alta | Esquema PostgreSQL con tabla `patrulla_verificadora` | Ejecución de `up(db)` y `down(db)` de `034_patrulla_desactivacion_baja_logica.ts` | Agrega columnas `activo` (`DEFAULT true`) y `eliminado_por_id` (`REFERENCES usuario(id) ON DELETE SET NULL`) e índices `idx_patrulla_activo` e `idx_patrulla_eliminado_por` | Sentencias DDL idempotentes con `IF NOT EXISTS` y rollback limpio en `down` | APROBADO | 03/11/2026 18:24 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `CP-H85-API-18` | Registro y exposición del endpoint `DELETE /api/patrullas/{id}` en la especificación pública `GET /openapi.json` | Contrato OpenAPI | OpenAPI 3.0 | Alta | Generador OpenAPI en `src/lib/openapi/index.ts` | `GET /openapi.json` | `spec.paths["/api/patrullas/{id}"].delete` registrado con códigos `200`, `400`, `401`, `403`, `404`, `409` y `500`, header `x-user-id` y esquema `DesactivarPatrullaResponse` | Endpoint y esquemas exportados en `/openapi.json` versión `0.10.0` | APROBADO | 03/11/2026 18:25 | 08/11/2026 21:32 | merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034) |
| `CP-H85-API-19` | Manejo controlado de excepciones inesperadas de base de datos retornando HTTP 500 Internal Server Error | Robustez / Error Handling | Route Handler | Media | Fallo no controlado en capa de persistencia | Excepción genérica en `desactivarPatrullaService` | HTTP 500 Internal Server Error con mensaje `"Error interno del servidor al desactivar la patrulla verificadora."` sin filtrar trazas SQL | Captura segura en bloque `catch` de `DELETE` en `route.ts` | APROBADO | 03/11/2026 18:25 | 08/11/2026 21:32 | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-20` | Ejecución íntegra de las suites automatizadas de pruebas unitarias de patrullas, seguridad y contrato OpenAPI en Vitest | Automatización | Unit / Integration | Alta | Suite Vitest configurada en `sgrai-api` | `npm test -- src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts src/app/api/patrullas/__tests__/route.test.ts src/app/openapi.json/__tests__/route.test.ts src/modules/seguridad/__tests__/seguridad.test.ts` | 155/155 pruebas unitarias aprobadas sin errores ni advertencias de tipos | 155/155 tests pasando en 5 archivos de prueba (2.33s) y `tsc --noEmit` con 0 errores | APROBADO | 03/11/2026 18:25 | 08/11/2026 21:32 | fix(recursos-y-personal): corregir tipo de mockAdminUsuario en tests de patrulla.service |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H85-API-01	Bloqueo 409 Conflict para todos los estados de despliegue en terreno (EN_VERIFICACION, EN_PREVENCION, EN_RECUPERACION, EN_MISION) y bloqueo pesimista SELECT FOR UPDATE transaccional	Regla de Negocio / Concurrencia	Service / Repo	Crítica	Patrulla verificadora en estado EN_VERIFICACION, EN_PREVENCION, EN_RECUPERACION o EN_MISION o despacho concurrente	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con x-user-id: 00000000-0000-4000-8000-000000000001	HTTP 409 Conflict bloqueando la baja en cualquiera de los 4 estados de despliegue en terreno y re-validación atómica con .forUpdate() en trx	desactivarPatrullaService y desactivarPatrullaTransaccionalRepo (con .forUpdate()) validan ESTADOS_PATRULLA_EN_TERRENO y misiones activas lanzando 409 Conflict	APROBADO	03/11/2026 18:10	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
BUG-H85-API-02	Liberación íntegra del líder (usuario_lider_id) y dotación condicionada a usuarios activos en 'en_patrulla' sin presencia en otras unidades activas	Integridad / DB	Repository	Crítica	Patrulla con usuario_lider_id e integrantes en patrulla_personal	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	Libera al líder y a los integrantes a 'disponible' solo si están activos, en 'en_patrulla' y NOT EXISTS en otra patrulla o cuadrilla activa	desactivarPatrullaTransaccionalRepo consolida usuario_lider_id e integrantes y ejecuta UPDATE usuario con guardas activo = true, estado_operativo = 'en_patrulla' y NOT EXISTS	APROBADO	03/11/2026 18:12	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
BUG-H85-API-03	Preservación de la trazabilidad del vehículo histórico en patrulla_verificadora.vehiculo_id al liberar el recurso durante la baja lógica	Auditoría / DB	Repository	Alta	Patrulla activa con vehículo institucional asignado (vehiculo_id = e1000000-0000-4000-8000-000000000002)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	El vehículo pasa a DISPONIBLE (cantidad_en_uso = 0) en tabla recurso conservando vehiculo_id en patrulla_verificadora	Se libera el vehículo en recurso y se conserva intacto vehiculo_id en la fila inactiva de patrulla_verificadora cumpliendo la Regla Crítica §3.7	APROBADO	03/11/2026 18:14	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
BUG-H85-API-04	Consulta histórica de patrullas dadas de baja en GET /api/patrullas/[id] y GET /api/patrullas exponiendo activo, eliminadoEn y eliminadoPorId	Funcional / Contrato	Repo / Schema / Service	Alta	Patrulla verificadora desactivada con activo = false y eliminado_en IS NOT NULL	GET /api/patrullas/f1000000-0000-4000-8000-000000000001 y GET /api/patrullas?incluirInactivas=true	GET /api/patrullas/[id] retorna la ficha histórica con activo: false, eliminadoEn y eliminadoPorId; GET /api/patrullas soporta activo e incluirInactivas	Ficha histórica consultable por ID y filtros activo / incluirInactivas operativos con campos de auditoría mapeados en PatrullaItemResponseSchema	APROBADO	03/11/2026 18:16	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
BUG-H85-API-05	Filtro de vigencia (eliminado_en IS NULL y activo = true) en buscarPatrullaPorId de Eventos ATP y alineación documental de usuario.estado_operativo y OpenAPI	Integridad / Docs	Repo ATP / Docs / OpenAPI	Media	Patrulla desactivada invocada en despacho ATP y revisión de docs/api/recursos-y-personal.md y src/lib/openapi/index.ts	buscarPatrullaPorId(trx, patrullaId) y lectura de docs/api/recursos-y-personal.md:695	Repositorios ATP filtran eliminado_en IS NULL y activo = true; documentación referencia usuario.estado_operativo y OpenAPI incluye x-user-id	Filtros .where("eliminado_en", "is", null).where("activo", "=", true) aplicados en ambos repositorios ATP y documentación/OpenAPI actualizados	APROBADO	03/11/2026 18:18	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
BUG-H85-API-06	Renumeración secuencial de migración Kysely a 034_patrulla_desactivacion_baja_logica.ts sin colisión con HU-82 (032_) ni HU-83 (033_)	Integridad / Migraciones	DB / CI	Alta	Existencia de 032_cuadrilla_baja_logica_activo.ts y 033_patrullas_codigo_vehiculo.ts en develop	Inspección de src/lib/db/migrations/ y orden lexicográfico de FileMigrationProvider	La migración de HU-85 se numera como 034_patrulla_desactivacion_baja_logica.ts sin colisionar con HU-82 ni HU-83	Archivo renombrado a 034_patrulla_desactivacion_baja_logica.ts garantizando ejecución determinista en Kysely	APROBADO	03/11/2026 21:55	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
CP-H85-API-01	Desactivación exitosa (baja lógica) de patrulla verificadora en estado DISPONIBLE sin misiones activas	Funcional	Route / Service / Repo	Crítica	Patrulla activa en estado DISPONIBLE con vehículo y dotación asignada, sin misiones en curso	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con Authorization: Bearer <token_admin>	HTTP 200 OK con activo: false, estado: "NO_DISPONIBLE", eliminadoEn, eliminadoPorId, vehiculoLiberadoId y personalLiberadoIds	HTTP 200 OK retornando estructura DesactivarPatrullaResponseSchema completa	APROBADO	03/11/2026 18:20	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-02	Rechazo con HTTP 409 Conflict al intentar desactivar una patrulla en estado EN_VERIFICACION (CA-3)	Regla de Negocio / ICS	Service / Route	Crítica	Patrulla activa desplegada en terreno con estado = 'EN_VERIFICACION'	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con Authorization: Bearer <token_admin>	HTTP 409 Conflict con mensaje indicando que la patrulla se encuentra en terreno en estado 'EN_VERIFICACION'	HTTP 409 Conflict bloqueando la baja lógica de la unidad en verificación	APROBADO	03/11/2026 18:20	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-03	Rechazo con HTTP 409 Conflict cuando la patrulla posee misiones tácticas activas (PLANIFICADA, DESPACHADA o EN_CURSO) (CA-3)	Regla de Negocio / ICS	Service / Repo	Crítica	Patrulla con misión asociada en tabla mision en estado EN_CURSO (MIS-2026-0001)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con Authorization: Bearer <token_admin>	HTTP 409 Conflict listando el código de la misión activa en curso (MIS-2026-0001)	HTTP 409 Conflict: "No es posible desactivar la patrulla verificadora '...' porque cuenta con misiones tácticas activas en curso (MIS-2026-0001)."	APROBADO	03/11/2026 18:21	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-04	Persistencia de atributos de baja lógica (activo = false, eliminado_en = CURRENT_TIMESTAMP, eliminado_por_id) (CA-4)	Integridad / DB	Repository / DB	Crítica	Patrulla activa sin misiones en curso	Ejecución de desactivarPatrullaTransaccionalRepo(id, adminId)	Registro preservado físicamente en patrulla_verificadora con activo = false, estado = 'NO_DISPONIBLE', eliminado_en y eliminado_por_id	Actualización atómica en Kysely retornando activo: false, estado: "NO_DISPONIBLE", eliminadoEn ISO y eliminadoPorId	APROBADO	03/11/2026 18:21	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-05	Liberación transaccional del vehículo institucional asignado a estado DISPONIBLE y cantidad_en_uso = 0 (CA-5)	Regla de Negocio / Inventario	Repository / DB	Crítica	Patrulla con vehículo e1000000-0000-4000-8000-000000000002 en estado ASIGNADO (cantidad_en_uso = 1)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	Tabla recurso actualiza el vehículo a estado = 'DISPONIBLE', cantidad_en_uso = 0 y retorna vehiculoLiberadoId	Vehículo actualizado a DISPONIBLE dentro de la misma transacción y devuelto en data.vehiculoLiberadoId	APROBADO	03/11/2026 18:21	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-06	Desactivación exitosa de patrulla verificadora sin vehículo asignado (vehiculo_id = null)	Caso de Borde	Service / Repo	Media	Patrulla activa conformada solo por personal a pie (vehiculo_id = null)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000002	HTTP 200 OK con vehiculoLiberadoId: null, liberando únicamente a los integrantes y omitiendo emitirRecursoActualizado	HTTP 200 OK procesado sin errores cuando la patrulla no posee vehículo asignado	APROBADO	03/11/2026 18:22	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-07	Preservación inalterada de misiones cerradas y reportes de terreno históricos (reporte_terreno) tras la baja lógica	Auditoría / Regla §3.7	Base de Datos	Crítica	Patrulla con misiones históricas en estado COMPLETADA y registros en reporte_terreno	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	No se ejecuta DELETE físico en patrulla_verificadora; claves foráneas en mision.patrulla_id y reporte_terreno se mantienen intactas	Trazabilidad histórica de misiones finalizadas e informes técnicos preservada al 100%	APROBADO	03/11/2026 18:22	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-08	Exclusión automática de la patrulla desactivada en el listado operativo por defecto (GET /api/patrullas) para impedir nuevos despachos	Funcional / Integración	Repository / Service	Alta	Patrulla recién desactivada con eliminado_en IS NOT NULL y activo = false	GET /api/patrullas?estado=DISPONIBLE	La patrulla dada de baja no aparece en el selector de patrullas disponibles para despacho	Excluida del listado operativo general impidiendo su selección en nuevos despachos	APROBADO	03/11/2026 18:22	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-09	Liberación del código identificador único (idx_patrulla_codigo_unico parcial WHERE eliminado_en IS NULL) tras baja lógica	Integridad / DB	Migración 033	Media	Patrulla con código PV-COSTA-01 dada de baja (eliminado_en IS NOT NULL)	POST /api/patrullas creando nueva patrulla con codigo: "PV-COSTA-01"	El índice único parcial WHERE eliminado_en IS NULL y buscarPatrullaPorCodigoRepo permiten reutilizar el código institucional	El código queda disponible para reasignación sin colisión de clave única	APROBADO	03/11/2026 18:22	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-10	Rechazo con HTTP 401 Unauthorized cuando no se envía token JWT ni cabecera de autenticación	Seguridad / Auth	Route Handler	Crítica	Petición anónima sin cabeceras Authorization ni x-user-id	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 sin headers	HTTP 401 Unauthorized impidiendo la ejecución del servicio	Retorna HTTP 401 Unauthorized con mensaje de error de autenticación	APROBADO	03/11/2026 18:23	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-11	Rechazo con HTTP 403 Forbidden para usuario autenticado sin perfil Administrador ni permiso recursos:eliminar	Seguridad / RBAC	Service / Guard	Crítica	Usuario autenticado con rol CALL_CENTER o INFORMANTE sin permiso recursos:eliminar	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con token sin privilegios	HTTP 403 Forbidden denegando la baja lógica	Retorna HTTP 403 Forbidden mediante verificarPermiso(usuarioId, PERMISO_ELIMINAR_RECURSO)	APROBADO	03/11/2026 18:23	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-12	Autorización exitosa mediante perfil Administrador o permiso explícito recursos:eliminar	Seguridad / RBAC	Service / Guard	Alta	Usuario autenticado con rol ADMIN o permiso recursos:eliminar	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con x-user-id de Administrador	Acceso autorizado hacia desactivarPatrullaService	Validación RBAC superada exitosamente ejecutando la baja lógica	APROBADO	03/11/2026 18:23	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-13	Rechazo con HTTP 400 Bad Request ante parámetro de ruta id con formato no UUID	Validación / Zod	Route Handler	Media	Parámetro :id malformado en la URL	DELETE /api/patrullas/id-no-valido	HTTP 400 Bad Request con "Identificador de patrulla inválido." y detalle en errors	Retorna HTTP 400 validado por PatrullaIdParamSchema.safeParse	APROBADO	03/11/2026 18:23	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-14	Rechazo con HTTP 404 Not Found cuando la patrulla no existe o ya fue desactivada previamente (idempotencia de segunda baja)	Robustez / Negocio	Service / Route	Alta	UUID inexistente o patrulla previamente dada de baja (activo = false / eliminado_en IS NOT NULL)	DELETE /api/patrullas/f9999999-0000-4000-8000-000000000999	HTTP 404 Not Found indicando que la patrulla no existe o ya ha sido desactivada	Retorna HTTP 404 Not Found capturando NotFoundError	APROBADO	03/11/2026 18:24	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-15	Validación de contrato de salida con DesactivarPatrullaResponseSchema y PatrullaItemResponseSchema en Zod	Contrato / Schema	Unit / Zod	Alta	Objeto de respuesta de baja lógica y ficha de patrulla inactiva	DesactivarPatrullaResponseSchema.safeParse(payloadBaja) y PatrullaItemResponseSchema.safeParse(patrullaInactiva)	Validación exitosa exigiendo activo booleano, estado canónico, eliminadoEn, eliminadoPorId y personalLiberadoIds	Esquemas validan payloads activos e inactivos con sus metadatos de auditoría	APROBADO	03/11/2026 18:24	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-16	Emisión de eventos WebSocket patrulla:desactivada, patrulla:actualizada y recurso:actualizado en tiempo real	Tiempo Real / Socket.io	Service / Socket	Alta	Baja lógica exitosa de patrulla con vehículo asignado	Ejecución de desactivarPatrullaService	Se invocan notificarPatrullaDesactivada, notificarPatrullaActualizada y emitirRecursoActualizado hacia las salas operacionales	Los 3 eventos Socket.io se emiten con los payloads esperados	APROBADO	03/11/2026 18:24	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-17	Estructura DDL e idempotencia (up y down) de 034_patrulla_desactivacion_baja_logica.ts en patrulla_verificadora	Base de Datos	Migración Kysely	Alta	Esquema PostgreSQL con tabla patrulla_verificadora	Ejecución de up(db) y down(db) de 034_patrulla_desactivacion_baja_logica.ts	Agrega columnas activo (DEFAULT true) y eliminado_por_id (REFERENCES usuario(id) ON DELETE SET NULL) e índices idx_patrulla_activo e idx_patrulla_eliminado_por	Sentencias DDL idempotentes con IF NOT EXISTS y rollback limpio en down	APROBADO	03/11/2026 18:24	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
CP-H85-API-18	Registro y exposición del endpoint DELETE /api/patrullas/{id} en la especificación pública GET /openapi.json	Contrato OpenAPI	OpenAPI 3.0	Alta	Generador OpenAPI en src/lib/openapi/index.ts	GET /openapi.json	spec.paths["/api/patrullas/{id}"].delete registrado con códigos 200, 400, 401, 403, 404, 409 y 500, header x-user-id y esquema DesactivarPatrullaResponse	Endpoint y esquemas exportados en /openapi.json versión 0.10.0	APROBADO	03/11/2026 18:25	08/11/2026 21:32	merge: sincronizar con develop integrando HU-83 y resolver defectos de QA para HU-85 (baja logica y migracion 034)
CP-H85-API-19	Manejo controlado de excepciones inesperadas de base de datos retornando HTTP 500 Internal Server Error	Robustez / Error Handling	Route Handler	Media	Fallo no controlado en capa de persistencia	Excepción genérica en desactivarPatrullaService	HTTP 500 Internal Server Error con mensaje "Error interno del servidor al desactivar la patrulla verificadora." sin filtrar trazas SQL	Captura segura en bloque catch de DELETE en route.ts	APROBADO	03/11/2026 18:25	08/11/2026 21:32	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-20	Ejecución íntegra de las suites automatizadas de pruebas unitarias de patrullas, seguridad y contrato OpenAPI en Vitest	Automatización	Unit / Integration	Alta	Suite Vitest configurada en sgrai-api	npm test -- src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts src/app/api/patrullas/__tests__/route.test.ts src/app/openapi.json/__tests__/route.test.ts src/modules/seguridad/__tests__/seguridad.test.ts	155/155 pruebas unitarias aprobadas sin errores ni advertencias de tipos	155/155 tests pasando en 5 archivos de prueba (2.33s) y tsc --noEmit con 0 errores	APROBADO	03/11/2026 18:25	08/11/2026 21:32	fix(recursos-y-personal): corregir tipo de mockAdminUsuario en tests de patrulla.service
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Completa del Módulo de Patrullas, Seguridad y Contrato OpenAPI
```bash
npm test -- src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts src/app/api/patrullas/__tests__/route.test.ts src/app/openapi.json/__tests__/route.test.ts src/modules/seguridad/__tests__/seguridad.test.ts
```

**Salida de Consola (Re-Test):**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts (24 tests) 43ms
 ✓ src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts (37 tests) 80ms
 ✓ src/app/api/patrullas/__tests__/route.test.ts (36 tests) 90ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 272ms
 ✓ src/modules/seguridad/__tests__/seguridad.test.ts (57 tests) 388ms

 Test Files  5 passed (5)
      Tests  155 passed (155)
   Start at  21:32:22
   Duration  2.33s (transform 1.33s, setup 0ms, collect 4.83s, tests 873ms, environment 2ms, prepare 708ms)
```

#### 5.1.2 Ejecución Focalizada por Casos de HU-85 (`-t`)
```bash
npx vitest run src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts -t "desactivarPatrullaService \(HU-85\)"
npx vitest run src/app/api/patrullas/__tests__/route.test.ts -t "DELETE /api/patrullas/\[id\] \(HU-85\)"
npx vitest run src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts -t "DesactivarPatrullaResponseSchema \(HU-85\)"
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`DELETE /api/patrullas/[id]` y `GET /api/patrullas/[id]`)

#### Caso 1: Rechazo por Falta de Autenticación (`401 Unauthorized` — `CP-H85-API-10`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "message": "No autenticado: Se requiere cabecera Authorization Bearer o X-User-Id válida."
}
```

#### Caso 2: Rechazo por Parámetro UUID Inválido (`400 Bad Request` — `CP-H85-API-13`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/id-no-valido" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Identificador de patrulla inválido.",
  "errors": [
    {
      "campo": "id",
      "mensaje": "El identificador de la patrulla debe ser un UUID válido."
    }
  ]
}
```

#### Caso 3: Rechazo por Falta de Permisos RBAC (`403 Forbidden` — `CP-H85-API-11`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000002"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "message": "Acceso denegado. Se requiere el perfil de Administrador."
}
```

#### Caso 4: Bloqueo Operativo por Patrulla Desplegada en Terreno (`EN_VERIFICACION`, `EN_PREVENCION`, `EN_RECUPERACION` o `EN_MISION` — `409 Conflict` — `CP-H85-API-02` / `BUG-H85-API-01`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "No es posible desactivar la patrulla verificadora 'Patrulla Rápida Costa-1' porque se encuentra actualmente en terreno en estado 'EN_VERIFICACION'."
}
```

#### Caso 5: Bloqueo Operativo por Misión Táctica Activa en Curso (`409 Conflict` — `CP-H85-API-03`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "No es posible desactivar la patrulla verificadora 'Patrulla Rápida Costa-1' porque cuenta con misiones tácticas activas en curso (MIS-2026-0001)."
}
```

#### Caso 6: Baja Lógica Exitosa y Liberación de Vehículo y Personal (`200 OK` — `CP-H85-API-01` / `BUG-H85-API-02` / `BUG-H85-API-03`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000002" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Patrulla verificadora desactivada exitosamente.",
  "data": {
    "id": "f1000000-0000-4000-8000-000000000002",
    "codigo": "PV-CENTROSUR-01",
    "nombre": "Patrulla Centro-Sur 1",
    "estado": "NO_DISPONIBLE",
    "activo": false,
    "eliminadoEn": "2026-11-08T21:32:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001",
    "vehiculoLiberadoId": "e1000000-0000-4000-8000-000000000002",
    "personalLiberadoIds": [
      "b1000000-0000-4000-8000-000000000001"
    ]
  }
}
```

#### Caso 7: Consulta de Auditoría Histórica de Patrulla Dada de Baja (`200 OK` — `BUG-H85-API-04`)
```bash
curl -s -i -X GET "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000002" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Detalle de patrulla verificadora obtenido exitosamente.",
  "data": {
    "id": "f1000000-0000-4000-8000-000000000002",
    "codigo": "PV-CENTROSUR-01",
    "nombre": "Patrulla Centro-Sur 1",
    "estado": "NO_DISPONIBLE",
    "activo": false,
    "eliminadoEn": "2026-11-08T21:32:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001",
    "vehiculo": {
      "id": "e1000000-0000-4000-8000-000000000002",
      "nombre": "Camioneta 4x4 Navara",
      "estado": "DISPONIBLE"
    }
  }
}
```

#### Caso 8: Rechazo por Patrulla Inexistente o Previamente Desactivada (`404 Not Found` — `CP-H85-API-14`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000002" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "message": "La patrulla verificadora con ID 'f1000000-0000-4000-8000-000000000002' no existe o ya ha sido desactivada."
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (Post Re-Test)

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** En el panel de administración, debe proveerse la acción 'Desactivar Patrulla'. | `CP-H85-API-01`, `CP-H85-API-12`, `CP-H85-API-18` | 🟢 **CUMPLIDO** | Endpoint `DELETE /api/patrullas/[id]` expuesto y registrado en `/openapi.json` con control de acceso RBAC (`recursos:eliminar` / rol `Administrador`). |
| **CA-2:** Modal de confirmación advirtiendo sobre el impacto de la acción. | `CP-H85-API-08`, `BUG-H85-API-04` | 🟢 **CUMPLIDO** | `GET /api/patrullas/[id]` y `GET /api/patrullas` exponen `activo`, `eliminadoEn` y `eliminadoPorId`, permitiendo previsualizar el impacto antes de la baja y auditar registros históricos tras la desactivación. |
| **CA-3:** La API debe rechazar la baja con `409 Conflict` si la patrulla se encuentra en estado `EN_VERIFICACION` o posee misiones activas. | `CP-H85-API-02`, `CP-H85-API-03`, `BUG-H85-API-01` | 🟢 **CUMPLIDO** | Bloquea con `409 Conflict` todos los estados de despliegue en terreno (`EN_VERIFICACION`, `EN_PREVENCION`, `EN_RECUPERACION`, `EN_MISION`) y misiones activas (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`), con bloqueo pesimista `SELECT ... FOR UPDATE` en `db.transaction()`. |
| **CA-4:** Si no posee misiones activas, se aplica baja lógica: `activo = false` y `eliminado_en = CURRENT_TIMESTAMP`. | `CP-H85-API-04`, `CP-H85-API-07`, `CP-H85-API-17`, `BUG-H85-API-03`, `BUG-H85-API-06` | 🟢 **CUMPLIDO** | Aplica `activo = false`, `estado = 'NO_DISPONIBLE'`, `eliminado_en = CURRENT_TIMESTAMP` y `eliminado_por_id`, preservando el `vehiculo_id` histórico, los reportes de terreno (`reporte_terreno`) y la secuencia de migraciones en `034_patrulla_desactivacion_baja_logica.ts`. |
| **CA-5:** El vehículo y personal asignados deben quedar liberados a disponibilidad en el inventario comunal. | `CP-H85-API-05`, `CP-H85-API-06`, `CP-H85-API-16`, `BUG-H85-API-02` | 🟢 **CUMPLIDO** | Libera el vehículo a `DISPONIBLE` (`cantidad_en_uso = 0`) y restituye `usuario.estado_operativo = 'disponible'` para el líder (`usuario_lider_id`) y los integrantes activos en `'en_patrulla'` que no pertenezcan a otra patrulla o cuadrilla activa. |
