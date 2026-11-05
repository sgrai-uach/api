# Informe y Matriz de Casos de Prueba (QA): HU-82 — Desactivar Cuadrilla Operativa (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Cuadrillas Operativas (`sgrai-api` — `DELETE /api/cuadrillas/[id]`).  
> **Historia de Usuario:** HU-82 — *"Como Administrador Quiero desactivar mediante baja lógica una cuadrilla operativa que haya sido disuelta o retirada de servicio Para evitar que sea asignada a nuevos incidentes, preservando el historial completo de misiones e informes técnicos en los que participó."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + Zod + Socket.io + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H82-desactivar-cuadrilla`.  
> **Commits Clave Evaluados (Conventional Commits sin hash):**  
> * `feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar`  
> * `feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica`  
> * `feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0`  
> * `test(cuadrillas): pruebas unitarias de servicio y ruta para baja logica de cuadrilla`  
> * `docs(api): documentar endpoint DELETE /api/cuadrillas/[id] en recursos-y-personal.md`  
> * `merge: sincronizar con origin/develop integrando fixes de HU-81, patrullas y eventos de socket`  
> * `fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)`  
>  
> **Fecha de Evaluación Inicial QA:** 02/11/2026.  
> **Fecha de Certificación Re-Test QA:** 03/11/2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TEST)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Evaluación Inicial (02/11/2026) | Ciclo Re-Test (03/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **25** | **25** | 20 Casos Funcionales/Integración/Seguridad/API + 5 Defectos Gestionados |
| **Casos Aprobados (Passed)** | **20** | **25** | 100% de los casos funcionales, transaccionales, de concurrencia y de regresión aprobados |
| **Casos Fallidos (Failed)** | **5** | **0** | Los 5 defectos detectados fueron subsanados y verificados en Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Sin bloqueos de infraestructura |
| **Defectos Detectados y Gestionados (Bugs)** | **5 Abiertos** | **5 Corregidos** | 100% resueltos, re-testeados y certificados como `CORREGIDO` / `APROBADO` |
| **Tasa de Aprobación Global (% Pass)** | **80.0%** | **100.0%** | Cumplimiento íntegro de criterios de aceptación y calidad |
| **Suite Automatizada de Pruebas (Vitest)** | **52/52 tests pass** | **69/69 tests pass** | `cuadrilla.repository.test.ts` (8), `cuadrilla.service.test.ts` (32), `api/cuadrillas/[id]/route.test.ts` (21), `api/cuadrillas/route.test.ts` (8) |
| **Chequeo de Tipos Estáticos (TypeScript)** | **Con observaciones** | **0 errores (`npx tsc --noEmit`)** | Compilación estricta limpia sin discrepancias de tipos |
| **Sincronización con `origin/develop`** | **Desfasada** | **Sincronizada (`032_`)** | Incluye PR #34 (HU-81) y migración renumerada a `032_cuadrilla_baja_logica_activo.ts` |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado** | **100% sincronizado** | Ruta `DELETE /api/cuadrillas/{id}` y schema `DesactivarCuadrillaResponse` registrados |
| **Sincronización en Tiempo Real (Socket.io)** | **100% verificado** | **100% verificado** | Evento `cuadrilla:desactivada` emitido hacia salas `operaciones`, `encargado` y `supervisor` |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Durante el ciclo de aseguramiento de calidad sobre la rama `feature/H82-desactivar-cuadrilla`, se identificaron, reportaron y verificaron en Re-Test los siguientes 5 defectos en el backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H82-API-01` | `desactivarCuadrillaTransaccional` desvinculaba las filas en `cuadrilla_recurso` (`activo = false`, `desvinculado_en = NOW()`), pero omitía decrementar `recurso.cantidad_en_uso` en la tabla `recurso`, dejando el stock bloqueado en el inventario central (CA-5). | Crítica | `src/modules/recursos-y-personal/cuadrilla.repository.ts` | 02/11/2026 14:20 | `fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)` | 03/11/2026 16:40 | 🟢 CORREGIDO (Decremento atómico `GREATEST(0, COALESCE(cantidad_en_uso, 0) - cantidad_asignada)` dentro de la transacción Kysely) |
| `BUG-H82-API-02` | Colisión de correlativo de migración Kysely (`031_` duplicado con HU-81 en `develop` y permanencia de `029_`) y borrado físico de registros históricos en `actualizarCuadrillaConDotacionTransaccional`. | Crítica | `src/lib/db/migrations/032_cuadrilla_baja_logica_activo.ts` y `cuadrilla.repository.ts` | 02/11/2026 14:22 | `fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)` | 03/11/2026 16:40 | 🟢 CORREGIDO (Sincronización con `origin/develop`, migración renumerada a `032_` y desvinculación lógica preservando historial en edición) |
| `BUG-H82-API-03` | Cláusula rígida `eliminado_en IS NULL` en `listarCuadrillasPaginadas` y `obtenerCuadrillaDetalleUnitario` impedía listar o consultar la ficha histórica de cuadrillas dadas de baja (`estado=INACTIVAS`, `activo=false`). | Alta | `src/modules/recursos-y-personal/cuadrilla.repository.ts` y `cuadrilla.schema.ts` | 02/11/2026 14:25 | `fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)` | 03/11/2026 16:40 | 🟢 CORREGIDO (Soporte de filtros `estado=INACTIVAS`, `TODAS`, `activo=false` y consulta de detalle y dotación histórica por ID) |
| `BUG-H82-API-04` | Al desvincular la dotación en `cuadrilla_personal` y revertir el rol del delegado, no se restauraba `usuario.estado_operativo = 'disponible'` para el personal liberado que no integraba otra unidad activa. | Alta | `src/modules/recursos-y-personal/cuadrilla.repository.ts` | 02/11/2026 14:28 | `fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)` | 03/11/2026 16:40 | 🟢 CORREGIDO (Verificación mediante `verificarUsuarioEnOtrasUnidadesActivas` y restauración de `estado_operativo = 'disponible'`) |
| `BUG-H82-API-05` | Ausencia de bloqueo pesimista `FOR UPDATE` y de revalidación de misiones activas dentro de la transacción `trx` (ventana TOCTOU), omisión de filtro `activo = true` en consultas previas y falta de pruebas unitarias de repositorio. | Media | `src/modules/recursos-y-personal/cuadrilla.repository.ts` y `cuadrilla.repository.test.ts` | 02/11/2026 14:30 | `fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)` | 03/11/2026 16:40 | 🟢 CORREGIDO (Bloqueo `.forUpdate()`, revalidación de misiones en `trx`, filtro `activo = true` y 8 pruebas unitarias en `cuadrilla.repository.test.ts`) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H82-API-01` | Fuga de inventario central: desactivarCuadrillaTransaccional decrementa recurso.cantidad_en_uso al desvincular recursos (CA-5) | Defecto / Integridad DB | Repositorio / ACID | Crítica | Cuadrilla activa con recursos asignados en cuadrilla_recurso y cantidad_en_uso > 0 | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token>` | Decremento atómico de recurso.cantidad_en_uso en la tabla recurso liberando el stock al inventario central | `desactivarCuadrillaTransaccional` resta `cantidad_asignada` de `recurso.cantidad_en_uso` con `GREATEST(0, ...)` y desvincula `cuadrilla_recurso` | APROBADO | 02/11/2026 14:20 | 03/11/2026 16:40 | fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia) |
| `BUG-H82-API-02` | Sincronización de migraciones Kysely (032_cuadrilla_baja_logica_activo.ts) y preservación de fixes de HU-81 con develop | Defecto / Migración & Git | DB / Servicio | Crítica | Rama feature/H82-desactivar-cuadrilla sincronizada con origin/develop (PR #34 mergeado) | `git diff origin/develop...HEAD` e inspección de `src/lib/db/migrations/` | Secuencia correlativa única (`032_cuadrilla_baja_logica_activo.ts`), baja lógica en edición y preservación de validaciones ICS/stock de HU-81 | Migración renombrada a `032_`, `029_` eliminada, y `actualizarCuadrillaConDotacionTransaccional` preserva registros históricos con `activo=false` | APROBADO | 02/11/2026 14:22 | 03/11/2026 16:40 | fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia) |
| `BUG-H82-API-03` | Consulta y auditoría histórica de cuadrillas desactivadas en GET /api/cuadrillas y GET /api/cuadrillas/[id] | Defecto / Trazabilidad | Repo / Schema Zod | Alta | Cuadrilla dada de baja con activo=false, estado=NO_DISPONIBLE y eliminado_en!=null | `GET /api/cuadrillas?estado=INACTIVAS`, `GET /api/cuadrillas?activo=false` y `GET /api/cuadrillas/{id}` | Listado y detalle permiten auditar cuadrillas dadas de baja incluyendo campos `activo`, `eliminadoEn` y dotación histórica | `listarCuadrillasPaginadas` y `obtenerCuadrillaDetalleUnitario` retornan cuadrillas inactivas con `activo: false`, `eliminadoEn` y dotación histórica | APROBADO | 02/11/2026 14:25 | 03/11/2026 16:40 | fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia) |
| `BUG-H82-API-04` | Restablecimiento de usuario.estado_operativo a disponible para trabajadores y delegado desvinculados | Defecto / Lógica ICS | Repositorio / ACID | Alta | Trabajadores asignados en cuadrilla_personal y delegado en cuadrilla que se desactiva | Ejecución de `desactivarCuadrillaTransaccional(cuadrillaId, adminId, rolBrigadistaId)` | Actualización de `usuario.estado_operativo = 'disponible'` para el personal y delegado liberados sin otra asignación activa | `desactivarCuadrillaTransaccional` verifica `verificarUsuarioEnOtrasUnidadesActivas` y restaura `usuario.estado_operativo = 'disponible'` | APROBADO | 02/11/2026 14:28 | 03/11/2026 16:40 | fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia) |
| `BUG-H82-API-05` | Bloqueo FOR UPDATE contra condición de carrera TOCTOU, filtro activo=true y tests unitarios en repositorio transaccional | Defecto / Concurrencia & QA | Repo / Unit Test | Media | Peticiones concurrentes de despacho/baja sobre la misma cuadrilla y suite Vitest | Ejecución de `cuadrilla.repository.test.ts` y `cuadrilla.service.test.ts` | Bloqueo `FOR UPDATE` validando `activo=true` y ausencia de misiones dentro de `trx` + 8 tests unitarios de repositorio | `desactivarCuadrillaTransaccional` aplica `.forUpdate()`, revalida misiones activas dentro de `trx` y pasa los 8 tests de `cuadrilla.repository.test.ts` | APROBADO | 02/11/2026 14:30 | 03/11/2026 16:40 | fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia) |
| `CP-H82-API-01` | Migración 032 agrega columna activo en cuadrilla y columnas activo y desvinculado_en en tablas puente (CA-4, CA-5) | Esquema / DB | Migración Kysely | Alta | Base de datos PostgreSQL con esquema base de cuadrillas | Ejecución de `up(db)` en `032_cuadrilla_baja_logica_activo.ts` | Creación idempotente de columnas `activo`, `desvinculado_en` e índices parciales de trazabilidad | Columnas e índices `idx_cuadrilla_activo`, `idx_cuadrilla_recurso_activo` e `idx_cuadrilla_personal_activa` creados | APROBADO | 02/11/2026 14:32 | 03/11/2026 16:40 | feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar |
| `CP-H82-API-02` | Semilla idempotente del permiso RBAC `cuadrillas:eliminar` y asignación al rol Administrador en migración (CA-1) | Seguridad / DB | Migración Kysely | Alta | Tabla `permiso` y `rol_permiso` en PostgreSQL | Bloque PL/pgSQL insertando `codigo = 'cuadrillas:eliminar'` y vinculando a `v_admin_rol_id` | Permiso registrado en módulo 'Recursos y Personal' y asignado automáticamente al rol Administrador | Permiso `cuadrillas:eliminar` creado y constante `PERMISO_ELIMINAR_CUADRILLA` exportada en `permisos.constants.ts` | APROBADO | 02/11/2026 14:34 | 03/11/2026 16:40 | feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar |
| `CP-H82-API-03` | Reversión limpia (`down`) de la migración eliminando permiso, índices y columnas de baja lógica | Esquema / DB | Migración Kysely | Media | Migración de baja lógica aplicada previamente | Ejecución de `down(db)` en `032_cuadrilla_baja_logica_activo.ts` | Eliminación de `rol_permiso`, `permiso`, índices y columnas `desvinculado_en` y `activo` restaurando constraint | Función `down` revierte en orden inverso todas las alteraciones de esquema sin dejar objetos huérfanos | APROBADO | 02/11/2026 14:35 | 03/11/2026 16:40 | feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar |
| `CP-H82-API-04` | Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta `[id]` no es un UUID válido | Validación / Schema | Route Handler | Media | Petición HTTP a `DELETE /api/cuadrillas/id-invalido` | `DELETE /api/cuadrillas/id-invalido` con `Authorization: Bearer <token>` | HTTP 400 Bad Request con `{ statusCode: 400, error: "Bad Request", message: "Identificador de cuadrilla inválido." }` | `CuadrillaIdParamSchema.safeParse` intercepta el ID malformado y retorna HTTP 400 con detalle de campo | APROBADO | 02/11/2026 14:36 | 03/11/2026 16:40 | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-05` | Rechazo con HTTP 401 Unauthorized cuando la petición carece de token JWT o cabecera de autenticación | Seguridad / Auth | Route Handler | Crítica | Solicitud anónima sin cabecera `Authorization` ni `x-user-id` | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` sin headers de sesión | HTTP 401 Unauthorized con `{ statusCode: 401, error: "Unauthorized", message: "No autenticado" }` | `extraerUsuarioId(req)` lanza `UnauthorizedError` y el route handler responde HTTP 401 | APROBADO | 02/11/2026 14:37 | 03/11/2026 16:40 | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-06` | Rechazo con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso `cuadrillas:eliminar` (CA-1) | Seguridad / RBAC | Route / Service | Crítica | Usuario con rol Operador Call Center, Supervisor o Brigadista | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` con token sin `cuadrillas:eliminar` | HTTP 403 Forbidden con `{ statusCode: 403, error: "Forbidden", message: "Acceso denegado..." }` | `validarAccesoAdministrador(usuarioId, [PERMISO_ELIMINAR_CUADRILLA])` lanza `ForbiddenError` (403) | APROBADO | 02/11/2026 14:38 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-07` | Autorización exitosa para usuario con rol Administrador o permiso explícito `cuadrillas:eliminar` (CA-1) | Seguridad / RBAC | Service | Alta | Usuario Administrador (`00000000-0000-4000-8000-000000000001`) | Invocación de `desactivarCuadrilla(id, usuarioAdminId)` | El guardia RBAC autoriza la operación y continúa al flujo de validación de negocio | `seguridadService.validarAccesoAdministrador` resuelve el perfil del administrador satisfactoriamente | APROBADO | 02/11/2026 14:39 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-08` | Rechazo con HTTP 404 Not Found si la cuadrilla especificada no existe o ya fue desactivada previamente | Robustez / Negocio | Service / Route | Alta | UUID inexistente o cuadrilla con `activo = false` / `eliminado_en IS NOT NULL` | `DELETE /api/cuadrillas/99999999-9999-4999-8999-999999999999` | HTTP 404 Not Found: `"La cuadrilla operativa especificada no existe o ya fue desactivada."` | `obtenerCuadrillaPorIdParaEdicion` retorna `undefined` y el servicio lanza `NotFoundError` (404) | APROBADO | 02/11/2026 14:40 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-09` | Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla posee misiones en estado PLANIFICADA, DESPACHADA o EN_CURSO (CA-3) | Regla de Negocio / ICS | Service / Repo | Crítica | Cuadrilla con misión asociada en tabla `mision` en estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO` | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` con `verificarMisionesActivasCuadrilla = true` | HTTP 409 Conflict: `"No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."` | `verificarMisionesActivasCuadrilla` y la revalidación en `trx` detectan la misión activa y lanzan `ConflictError` (409) | APROBADO | 02/11/2026 14:41 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-10` | Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla se encuentra en estado operativo EN_MISION (CA-3) | Regla de Negocio / ICS | Service | Crítica | Cuadrilla con `estado = 'EN_MISION'` en tabla `cuadrilla` | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000002` | HTTP 409 Conflict: `"No es posible desactivar una cuadrilla que se encuentra actualmente en misión activa en terreno."` | El servicio evalúa `estadoCuadrilla === "EN_MISION"` y rechaza inmediatamente con `ConflictError` (409) | APROBADO | 02/11/2026 14:42 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-11` | Bloqueo con HTTP 409 Conflict cuando la cuadrilla está en estado EN_TRANSITO o EN_OPERACION (CA-3) | Regla de Negocio / ICS | Service | Alta | Cuadrilla en estado táctico `EN_TRANSITO` o `EN_OPERACION` | Invocación de `desactivarCuadrilla` sobre unidad en tránsito/operación | HTTP 409 Conflict protegiendo la integridad de la operación en terreno | El condicional bloquea ambos estados transicionales antes de tocar la base de datos | APROBADO | 02/11/2026 14:43 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-12` | Baja estrictamente lógica aplicando `activo = false`, `estado = 'NO_DISPONIBLE'`, `eliminado_en` y `eliminado_por_id` (CA-4) | Integridad / Auditoría | Repositorio Kysely | Crítica | Cuadrilla `DISPONIBLE` sin misiones activas | Ejecución de `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` | Registro preservado en tabla `cuadrilla` con `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminado_en` y `eliminado_por_id` | `updateTable("cuadrilla")` aplica soft delete inmutable cumpliendo Regla Crítica §3.7 | APROBADO | 02/11/2026 14:44 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-13` | Desvinculación histórica de recursos en `cuadrilla_recurso` estampando `activo = false` y `desvinculado_en` (CA-5) | Integridad / Historial | Repositorio Kysely | Alta | Cuadrilla con filas activas (`desvinculado_en IS NULL`) en `cuadrilla_recurso` | Ejecución de `desactivarCuadrillaTransaccional` | Se conserva la fila histórica en `cuadrilla_recurso` con `activo = false` y `desvinculado_en = fechaEliminado` | `updateTable("cuadrilla_recurso")` desvincula los recursos sin ejecutar borrado físico y retorna `recursosDesvinculados` | APROBADO | 02/11/2026 14:45 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-14` | Desvinculación histórica de trabajadores en `cuadrilla_personal` estampando `activo = false` y `desvinculado_en` | Integridad / Historial | Repositorio Kysely | Alta | Cuadrilla con brigadistas activos (`desvinculado_en IS NULL`) en `cuadrilla_personal` | Ejecución de `desactivarCuadrillaTransaccional` | Se preserva el historial en `cuadrilla_personal` con `activo = false` y `desvinculado_en = fechaEliminado` | `updateTable("cuadrilla_personal")` actualiza asignaciones activas y reporta `trabajadoresDesvinculados` | APROBADO | 02/11/2026 14:46 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-15` | Reversión automática del rol del Delegado a `BRIGADISTA` y registro en `log_cambios_usuarios` si no lidera otra cuadrilla | Regla de Negocio / RBAC | Repositorio Kysely | Alta | Delegado de la cuadrilla desactivada no lidera ninguna otra cuadrilla activa (`tieneOtras = false`) | Ejecución de paso 5 en `desactivarCuadrillaTransaccional` | `usuario.rol_id` cambia a `BRIGADISTA`, se inserta auditoría en `log_cambios_usuarios` y `delegadoRevertido = true` | Rol revertido atómicamente con motivo de auditoría y bandera `delegadoRevertido: true` en el payload de respuesta | APROBADO | 02/11/2026 14:47 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-16` | Liberación de recursos individuales (`es_individual = true`) para reasignación en otras cuadrillas tras `desvinculado_en` (CA-5) | Regla de Negocio | Repositorio Kysely | Alta | Camioneta 4x4 previamente asignada a cuadrilla desactivada (`desvinculado_en IS NOT NULL`) | Consulta `obtenerRecursosIndividualesAsignadosAOtrasCuadrillas` al asignar la camioneta a otra cuadrilla | La consulta filtra `.where("cuadrilla_recurso.desvinculado_en", "is", null)`, permitiendo reutilizar el vehículo | El vehículo individual desvinculado ya no genera colisión `409` en `obtenerRecursosIndividualesAsignadosAOtrasCuadrillas` | APROBADO | 02/11/2026 14:48 | 03/11/2026 16:40 | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-17` | Emisión de evento WebSocket en tiempo real `cuadrilla:desactivada` a salas operativas tras baja exitosa | Tiempo Real / Socket | Service / Socket | Alta | Baja lógica completada exitosamente en base de datos | Invocación de `emitirCuadrillaDesactivada(respuesta.data)` | Emisión del evento `cuadrilla:desactivada` hacia salas `operaciones`, `encargado` y `supervisor` | `emitirCuadrillaDesactivada` transmite el payload `DesactivarCuadrillaData` sin bloquear la respuesta HTTP si Socket falla | APROBADO | 02/11/2026 14:49 | 03/11/2026 16:40 | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-18` | Registro del contrato `DELETE /api/cuadrillas/{id}` y schema `DesactivarCuadrillaResponse` en OpenAPI 3.0 | Contrato OpenAPI | OpenAPI Registry | Media | Generación de especificación en `src/lib/openapi/index.ts` | Inspección de `registry.registerPath({ method: "delete", path: "/api/cuadrillas/{id}", ... })` | Respuestas `200`, `400`, `401`, `403`, `404`, `409` y `500` documentadas con `DesactivarCuadrillaResponseSchema` | Endpoint registrado en `src/lib/openapi/index.ts` con seguridad `BearerAuth` | APROBADO | 02/11/2026 14:50 | 03/11/2026 16:40 | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-19` | Documentación técnica del endpoint `DELETE /api/cuadrillas/{id}` en `docs/api/recursos-y-personal.md` | Documentación | Docs API | Media | Revisión de `docs/api/recursos-y-personal.md` sección 3.8 | Verificación de permisos, bloqueo `409`, baja lógica, liberación de dotación, reversión de delegado y ejemplo JSON | Documentación alineada con el contrato HTTP y reglas de negocio de HU-82 | Sección `3.8. DELETE /api/cuadrillas/{id}` actualizada incluyendo liberación de stock, restauración de disponibilidad y concurrencia | APROBADO | 02/11/2026 14:51 | 03/11/2026 16:40 | docs(api): documentar endpoint DELETE /api/cuadrillas/[id] en recursos-y-personal.md |
| `CP-H82-API-20` | Ejecución de suite automatizada completa de pruebas unitarias para módulo Cuadrillas en Vitest (69 tests) | Automatización QA | Unit / Repo, Service & Route | Alta | Suite Vitest en `sgrai-api` | `npx vitest run src/app/api/cuadrillas src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts` | 69/69 tests aprobados en los 4 archivos de prueba del módulo de cuadrillas | 69/69 pruebas automatizadas pasando en 801ms | APROBADO | 02/11/2026 14:52 | 03/11/2026 16:40 | fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia) |

---

### 3.1. Bloque TSV para Exportación Tabular

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H82-API-01	Fuga de inventario central: desactivarCuadrillaTransaccional decrementa recurso.cantidad_en_uso al desvincular recursos (CA-5)	Defecto / Integridad DB	Repositorio / ACID	Crítica	Cuadrilla activa con recursos asignados en cuadrilla_recurso y cantidad_en_uso > 0	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 con Authorization: Bearer <token>	Decremento atómico de recurso.cantidad_en_uso en la tabla recurso liberando el stock al inventario central	desactivarCuadrillaTransaccional resta cantidad_asignada de recurso.cantidad_en_uso con GREATEST(0, ...) y desvincula cuadrilla_recurso	APROBADO	02/11/2026 14:20	03/11/2026 16:40	fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)
BUG-H82-API-02	Sincronización de migraciones Kysely (032_cuadrilla_baja_logica_activo.ts) y preservación de fixes de HU-81 con develop	Defecto / Migración & Git	DB / Servicio	Crítica	Rama feature/H82-desactivar-cuadrilla sincronizada con origin/develop (PR #34 mergeado)	git diff origin/develop...HEAD e inspección de src/lib/db/migrations/	Secuencia correlativa única (032_cuadrilla_baja_logica_activo.ts), baja lógica en edición y preservación de validaciones ICS/stock de HU-81	Migración renombrada a 032_, 029_ eliminada, y actualizarCuadrillaConDotacionTransaccional preserva registros históricos con activo=false	APROBADO	02/11/2026 14:22	03/11/2026 16:40	fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)
BUG-H82-API-03	Consulta y auditoría histórica de cuadrillas desactivadas en GET /api/cuadrillas y GET /api/cuadrillas/[id]	Defecto / Trazabilidad	Repo / Schema Zod	Alta	Cuadrilla dada de baja con activo=false, estado=NO_DISPONIBLE y eliminado_en!=null	GET /api/cuadrillas?estado=INACTIVAS, GET /api/cuadrillas?activo=false y GET /api/cuadrillas/{id}	Listado y detalle permiten auditar cuadrillas dadas de baja incluyendo campos activo, eliminadoEn y dotación histórica	listarCuadrillasPaginadas y obtenerCuadrillaDetalleUnitario retornan cuadrillas inactivas con activo: false, eliminadoEn y dotación histórica	APROBADO	02/11/2026 14:25	03/11/2026 16:40	fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)
BUG-H82-API-04	Restablecimiento de usuario.estado_operativo a disponible para trabajadores y delegado desvinculados	Defecto / Lógica ICS	Repositorio / ACID	Alta	Trabajadores asignados en cuadrilla_personal y delegado en cuadrilla que se desactiva	Ejecución de desactivarCuadrillaTransaccional(cuadrillaId, adminId, rolBrigadistaId)	Actualización de usuario.estado_operativo = 'disponible' para el personal y delegado liberados sin otra asignación activa	desactivarCuadrillaTransaccional verifica verificarUsuarioEnOtrasUnidadesActivas y restaura usuario.estado_operativo = 'disponible'	APROBADO	02/11/2026 14:28	03/11/2026 16:40	fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)
BUG-H82-API-05	Bloqueo FOR UPDATE contra condición de carrera TOCTOU, filtro activo=true y tests unitarios en repositorio transaccional	Defecto / Concurrencia & QA	Repo / Unit Test	Media	Peticiones concurrentes de despacho/baja sobre la misma cuadrilla y suite Vitest	Ejecución de cuadrilla.repository.test.ts y cuadrilla.service.test.ts	Bloqueo FOR UPDATE validando activo=true y ausencia de misiones dentro de trx + 8 tests unitarios de repositorio	desactivarCuadrillaTransaccional aplica .forUpdate(), revalida misiones activas dentro de trx y pasa los 8 tests de cuadrilla.repository.test.ts	APROBADO	02/11/2026 14:30	03/11/2026 16:40	fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)
CP-H82-API-01	Migración 032 agrega columna activo en cuadrilla y columnas activo y desvinculado_en en tablas puente (CA-4, CA-5)	Esquema / DB	Migración Kysely	Alta	Base de datos PostgreSQL con esquema base de cuadrillas	Ejecución de up(db) en 032_cuadrilla_baja_logica_activo.ts	Creación idempotente de columnas activo, desvinculado_en e índices parciales de trazabilidad	Columnas e índices idx_cuadrilla_activo, idx_cuadrilla_recurso_activo e idx_cuadrilla_personal_activa creados	APROBADO	02/11/2026 14:32	03/11/2026 16:40	feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar
CP-H82-API-02	Semilla idempotente del permiso RBAC cuadrillas:eliminar y asignación al rol Administrador en migración (CA-1)	Seguridad / DB	Migración Kysely	Alta	Tabla permiso y rol_permiso en PostgreSQL	Bloque PL/pgSQL insertando codigo = 'cuadrillas:eliminar' y vinculando a v_admin_rol_id	Permiso registrado en módulo 'Recursos y Personal' y asignado automáticamente al rol Administrador	Permiso cuadrillas:eliminar creado y constante PERMISO_ELIMINAR_CUADRILLA exportada en permisos.constants.ts	APROBADO	02/11/2026 14:34	03/11/2026 16:40	feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar
CP-H82-API-03	Reversión limpia (down) de la migración eliminando permiso, índices y columnas de baja lógica	Esquema / DB	Migración Kysely	Media	Migración de baja lógica aplicada previamente	Ejecución de down(db) en 032_cuadrilla_baja_logica_activo.ts	Eliminación de rol_permiso, permiso, índices y columnas desvinculado_en y activo restaurando constraint	Función down revierte en orden inverso todas las alteraciones de esquema sin dejar objetos huérfanos	APROBADO	02/11/2026 14:35	03/11/2026 16:40	feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar
CP-H82-API-04	Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta [id] no es un UUID válido	Validación / Schema	Route Handler	Media	Petición HTTP a DELETE /api/cuadrillas/id-invalido	DELETE /api/cuadrillas/id-invalido con Authorization: Bearer <token>	HTTP 400 Bad Request con { statusCode: 400, error: "Bad Request", message: "Identificador de cuadrilla inválido." }	CuadrillaIdParamSchema.safeParse intercepta el ID malformado y retorna HTTP 400 con detalle de campo	APROBADO	02/11/2026 14:36	03/11/2026 16:40	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-05	Rechazo con HTTP 401 Unauthorized cuando la petición carece de token JWT o cabecera de autenticación	Seguridad / Auth	Route Handler	Crítica	Solicitud anónima sin cabecera Authorization ni x-user-id	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 sin headers de sesión	HTTP 401 Unauthorized con { statusCode: 401, error: "Unauthorized", message: "No autenticado" }	extraerUsuarioId(req) lanza UnauthorizedError y el route handler responde HTTP 401	APROBADO	02/11/2026 14:37	03/11/2026 16:40	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-06	Rechazo con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso cuadrillas:eliminar (CA-1)	Seguridad / RBAC	Route / Service	Crítica	Usuario con rol Operador Call Center, Supervisor o Brigadista	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 con token sin cuadrillas:eliminar	HTTP 403 Forbidden con { statusCode: 403, error: "Forbidden", message: "Acceso denegado..." }	validarAccesoAdministrador(usuarioId, [PERMISO_ELIMINAR_CUADRILLA]) lanza ForbiddenError (403)	APROBADO	02/11/2026 14:38	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-07	Autorización exitosa para usuario con rol Administrador o permiso explícito cuadrillas:eliminar (CA-1)	Seguridad / RBAC	Service	Alta	Usuario Administrador (00000000-0000-4000-8000-000000000001)	Invocación de desactivarCuadrilla(id, usuarioAdminId)	El guardia RBAC autoriza la operación y continúa al flujo de validación de negocio	seguridadService.validarAccesoAdministrador resuelve el perfil del administrador satisfactoriamente	APROBADO	02/11/2026 14:39	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-08	Rechazo con HTTP 404 Not Found si la cuadrilla especificada no existe o ya fue desactivada previamente	Robustez / Negocio	Service / Route	Alta	UUID inexistente o cuadrilla con activo = false / eliminado_en IS NOT NULL	DELETE /api/cuadrillas/99999999-9999-4999-8999-999999999999	HTTP 404 Not Found: "La cuadrilla operativa especificada no existe o ya fue desactivada."	obtenerCuadrillaPorIdParaEdicion retorna undefined y el servicio lanza NotFoundError (404)	APROBADO	02/11/2026 14:40	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-09	Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla posee misiones en estado PLANIFICADA, DESPACHADA o EN_CURSO (CA-3)	Regla de Negocio / ICS	Service / Repo	Crítica	Cuadrilla con misión asociada en tabla mision en estado PLANIFICADA, DESPACHADA o EN_CURSO	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 con verificarMisionesActivasCuadrilla = true	HTTP 409 Conflict: "No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."	verificarMisionesActivasCuadrilla y la revalidación en trx detectan la misión activa y lanzan ConflictError (409)	APROBADO	02/11/2026 14:41	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-10	Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla se encuentra en estado operativo EN_MISION (CA-3)	Regla de Negocio / ICS	Service	Crítica	Cuadrilla con estado = 'EN_MISION' en tabla cuadrilla	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000002	HTTP 409 Conflict: "No es posible desactivar una cuadrilla que se encuentra actualmente en misión activa en terreno."	El servicio evalúa estadoCuadrilla === "EN_MISION" y rechaza inmediatamente con ConflictError (409)	APROBADO	02/11/2026 14:42	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-11	Bloqueo con HTTP 409 Conflict cuando la cuadrilla está en estado EN_TRANSITO o EN_OPERACION (CA-3)	Regla de Negocio / ICS	Service	Alta	Cuadrilla en estado táctico EN_TRANSITO o EN_OPERACION	Invocación de desactivarCuadrilla sobre unidad en tránsito/operación	HTTP 409 Conflict protegiendo la integridad de la operación en terreno	El condicional bloquea ambos estados transicionales antes de tocar la base de datos	APROBADO	02/11/2026 14:43	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-12	Baja estrictamente lógica aplicando activo = false, estado = 'NO_DISPONIBLE', eliminado_en y eliminado_por_id (CA-4)	Integridad / Auditoría	Repositorio Kysely	Crítica	Cuadrilla DISPONIBLE sin misiones activas	Ejecución de DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001	Registro preservado en tabla cuadrilla con activo: false, estado: "NO_DISPONIBLE", eliminado_en y eliminado_por_id	updateTable("cuadrilla") aplica soft delete inmutable cumpliendo Regla Crítica §3.7	APROBADO	02/11/2026 14:44	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-13	Desvinculación histórica de recursos en cuadrilla_recurso estampando activo = false y desvinculado_en (CA-5)	Integridad / Historial	Repositorio Kysely	Alta	Cuadrilla con filas activas (desvinculado_en IS NULL) en cuadrilla_recurso	Ejecución de desactivarCuadrillaTransaccional	Se conserva la fila histórica en cuadrilla_recurso con activo = false y desvinculado_en = fechaEliminado	updateTable("cuadrilla_recurso") desvincula los recursos sin ejecutar borrado físico y retorna recursosDesvinculados	APROBADO	02/11/2026 14:45	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-14	Desvinculación histórica de trabajadores en cuadrilla_personal estampando activo = false y desvinculado_en	Integridad / Historial	Repositorio Kysely	Alta	Cuadrilla con brigadistas activos (desvinculado_en IS NULL) en cuadrilla_personal	Ejecución de desactivarCuadrillaTransaccional	Se preserva el historial en cuadrilla_personal con activo = false y desvinculado_en = fechaEliminado	updateTable("cuadrilla_personal") actualiza asignaciones activas y reporta trabajadoresDesvinculados	APROBADO	02/11/2026 14:46	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-15	Reversión automática del rol del Delegado a BRIGADISTA y registro en log_cambios_usuarios si no lidera otra cuadrilla	Regla de Negocio / RBAC	Repositorio Kysely	Alta	Delegado de la cuadrilla desactivada no lidera ninguna otra cuadrilla activa (tieneOtras = false)	Ejecución de paso 5 en desactivarCuadrillaTransaccional	usuario.rol_id cambia a BRIGADISTA`, se inserta auditoría en `log_cambios_usuarios` y `delegadoRevertido = true`	Rol revertido atómicamente con motivo de auditoría y bandera delegadoRevertido: true en el payload de respuesta	APROBADO	02/11/2026 14:47	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-16	Liberación de recursos individuales (es_individual = true) para reasignación en otras cuadrillas tras desvinculado_en (CA-5)	Regla de Negocio	Repositorio Kysely	Alta	Camioneta 4x4 previamente asignada a cuadrilla desactivada (desvinculado_en IS NOT NULL)	Consulta obtenerRecursosIndividualesAsignadosAOtrasCuadrillas al asignar la camioneta a otra cuadrilla	La consulta filtra .where("cuadrilla_recurso.desvinculado_en", "is", null), permitiendo reutilizar el vehículo	El vehículo individual desvinculado ya no genera colisión 409 en obtenerRecursosIndividualesAsignadosAOtrasCuadrillas	APROBADO	02/11/2026 14:48	03/11/2026 16:40	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-17	Emisión de evento WebSocket en tiempo real cuadrilla:desactivada a salas operativas tras baja exitosa	Tiempo Real / Socket	Service / Socket	Alta	Baja lógica completada exitosamente en base de datos	Invocación de emitirCuadrillaDesactivada(respuesta.data)	Emisión del evento cuadrilla:desactivada hacia salas operaciones, encargado y supervisor	emitirCuadrillaDesactivada transmite el payload DesactivarCuadrillaData sin bloquear la respuesta HTTP si Socket falla	APROBADO	02/11/2026 14:49	03/11/2026 16:40	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-18	Registro del contrato DELETE /api/cuadrillas/{id} y schema DesactivarCuadrillaResponse en OpenAPI 3.0	Contrato OpenAPI	OpenAPI Registry	Media	Generación de especificación en src/lib/openapi/index.ts	Inspección de registry.registerPath({ method: "delete", path: "/api/cuadrillas/{id}", ... })	Respuestas 200, 400, 401, 403, 404, 409 y 500 documentadas con DesactivarCuadrillaResponseSchema	Endpoint registrado en src/lib/openapi/index.ts con seguridad BearerAuth	APROBADO	02/11/2026 14:50	03/11/2026 16:40	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-19	Documentación técnica del endpoint DELETE /api/cuadrillas/{id} en docs/api/recursos-y-personal.md	Documentación	Docs API	Media	Revisión de docs/api/recursos-y-personal.md sección 3.8	Verificación de permisos, bloqueo 409, baja lógica, liberación de dotación, reversión de delegado y ejemplo JSON	Documentación alineada con el contrato HTTP y reglas de negocio de HU-82	Sección 3.8. DELETE /api/cuadrillas/{id} actualizada incluyendo liberación de stock, restauración de disponibilidad y concurrencia	APROBADO	02/11/2026 14:51	03/11/2026 16:40	docs(api): documentar endpoint DELETE /api/cuadrillas/[id] en recursos-y-personal.md
CP-H82-API-20	Ejecución de suite automatizada completa de pruebas unitarias para módulo Cuadrillas en Vitest (69 tests)	Automatización QA	Unit / Repo, Service & Route	Alta	Suite Vitest en sgrai-api	npx vitest run src/app/api/cuadrillas src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts	69/69 tests aprobados en los 4 archivos de prueba del módulo de cuadrillas	69/69 pruebas automatizadas pasando en 801ms	APROBADO	02/11/2026 14:52	03/11/2026 16:40	fix(cuadrillas): resolver defectos de QA para HU-82 (stock en uso, auditoria historica, estados operativos y concurrencia)
````

---

## 4. Guía Detallada de Ejecución y Replicabilidad Paso a Paso

### 4.1. Ejecución Completa de la Suite Automatizada de Cuadrillas en Vitest

```bash
npx vitest run src/app/api/cuadrillas src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts
```

**Salida Obtenida:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts (8 tests) 12ms
 ✓ src/app/api/cuadrillas/__tests__/route.test.ts (8 tests) 21ms
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts (32 tests) 41ms
 ✓ src/app/api/cuadrillas/[id]/__tests__/route.test.ts (21 tests) 29ms

 Test Files  4 passed (4)
      Tests  69 passed (69)
   Start at  16:39:03
   Duration  801ms (transform 385ms, setup 0ms, collect 1.50s, tests 103ms, environment 1ms, prepare 301ms)
```

---

### 4.2. Verificación de Compilación TypeScript

```bash
npx tsc --noEmit
```
**Salida Obtenida:**
```text
(Exit code 0 — Sin errores de compilación)
```

---

### 4.3. Comandos Específicos por Capa

#### 1. Pruebas Unitarias de Capa de Persistencia Kysely (`cuadrilla.repository.test.ts`)
```bash
npm test -- run src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts
```
**Salida Obtenida:**
```text
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.repository.test.ts (8 tests) 12ms
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 1. desactivarCuadrillaTransaccional (BUG-H82-API-01, BUG-H82-API-04, BUG-H82-API-05) > debe aplicar bloqueo FOR UPDATE sobre la fila de cuadrilla para evitar condiciones de carrera (BUG-H82-API-05)
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 1. desactivarCuadrillaTransaccional (BUG-H82-API-01, BUG-H82-API-04, BUG-H82-API-05) > debe rechazar con error si la cuadrilla posee misiones activas detectadas dentro del bloqueo (BUG-H82-API-05)
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 1. desactivarCuadrillaTransaccional (BUG-H82-API-01, BUG-H82-API-04, BUG-H82-API-05) > debe decrementar cantidad_en_uso en la tabla recurso para cada equipo desvinculado (CA-5 / BUG-H82-API-01)
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 1. desactivarCuadrillaTransaccional (BUG-H82-API-01, BUG-H82-API-04, BUG-H82-API-05) > debe restaurar usuario.estado_operativo = 'disponible' para trabajadores y delegado liberados (BUG-H82-API-04)
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 2. obtenerCuadrillaPorIdParaEdicion y contarOtrasCuadrillasActivasPorDelegado (BUG-H82-API-05) > obtenerCuadrillaPorIdParaEdicion debe filtrar activo = true y eliminado_en IS NULL
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 2. obtenerCuadrillaPorIdParaEdicion y contarOtrasCuadrillasActivasPorDelegado (BUG-H82-API-05) > contarOtrasCuadrillasActivasPorDelegado debe filtrar activo = true y eliminado_en IS NULL
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 3. Consultas históricas de cuadrillas desactivadas (BUG-H82-API-03) > obtenerCuadrillaDetalleUnitario debe permitir consultar cuadrillas desactivadas proyectando activo y eliminado_en
   ✓ Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes) > 3. Consultas históricas de cuadrillas desactivadas (BUG-H82-API-03) > listarCuadrillasPaginadas debe consultar cuadrillas inactivas cuando estado = 'INACTIVAS' o activo = false
```

#### 2. Pruebas Unitarias del Servicio de Dominio (`cuadrilla.service.test.ts`)
```bash
npm test -- run src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts -t "desactivarCuadrilla - H82"
```

#### 3. Pruebas Unitarias del Route Handler (`route.test.ts`)
```bash
npm test -- run src/app/api/cuadrillas/[id]/__tests__/route.test.ts -t "DELETE /api/cuadrillas/\[id\] \(HU-82\)"
```

---

### 4.4. Peticiones HTTP / cURL y Respuestas JSON

#### Caso 1: Desactivación Exitosa de Cuadrilla Sin Misiones Activas (`200 OK`)
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/50000000-0000-4000-8000-000000000003" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "message": "Cuadrilla operativa desactivada exitosamente",
  "data": {
    "id": "50000000-0000-4000-8000-000000000003",
    "nombre": "Cuadrilla Drenaje y Aguas Lluvias Sur",
    "activo": false,
    "estado": "NO_DISPONIBLE",
    "recursosDesvinculados": 1,
    "trabajadoresDesvinculados": 0,
    "delegadoRevertido": true,
    "eliminadoEn": "2026-10-26T12:00:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
  }
}
```

#### Caso 2: Bloqueo `409 Conflict` cuando la Cuadrilla Posee Misiones en Estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/50000000-0000-4000-8000-000000000001" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8

{
  "statusCode": 409,
  "error": "Conflict",
  "message": "No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."
}
```

#### Caso 3: Consulta Histórica de Cuadrillas Inactivas (`200 OK`)
```bash
curl -i -X GET "http://localhost:3001/api/cuadrillas?estado=INACTIVAS&pagina=1&limite=10" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "message": "Listado de cuadrillas obtenido exitosamente",
  "data": [
    {
      "id": "50000000-0000-4000-8000-000000000003",
      "nombre": "Cuadrilla Drenaje y Aguas Lluvias Sur",
      "estado": "NO_DISPONIBLE",
      "activo": false,
      "eliminadoEn": "2026-10-26T12:00:00.000Z",
      "totalRecursos": 0,
      "totalTrabajadores": 0
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

## 5. Matriz de Trazabilidad de Criterios de Aceptación (HU-82 — Backend API)

| # | Criterio de Aceptación (Historia de Usuario HU-82) | Casos de Prueba Asociados | Estado | Observaciones Técnicas |
|:---:|---|---|:---:|---|
| **CA-1** | En la vista de gestión de cuadrillas, debe existir la acción 'Desactivar Cuadrilla' accesible para el Administrador (`cuadrillas:eliminar` / `ADMIN`). | `CP-H82-API-02`, `CP-H82-API-05`, `CP-H82-API-06`, `CP-H82-API-07` | 🟢 **CUMPLIDO** | `DELETE /api/cuadrillas/[id]` exige autenticación y valida el permiso `cuadrillas:eliminar` o rol `Administrador`. |
| **CA-2** | Se debe solicitar confirmación explícita mediante un modal de advertencia. | N/A (Alcance Frontend `sgrai-web`) | 🟢 **CUMPLIDO EN WEB** | Cubierto en `sgrai-web` mediante `CuadrillaDesactivarModal`. |
| **CA-3** | Validación crítica de negocio en backend: si la cuadrilla posee misiones en estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`, la API debe rechazar la desactivación con código `409 Conflict`. | `CP-H82-API-09`, `CP-H82-API-10`, `CP-H82-API-11`, `BUG-H82-API-05` | 🟢 **CUMPLIDO** | Validación previa en servicio y revalidación atómica dentro de la transacción Kysely con bloqueo `.forUpdate()`. |
| **CA-4** | Si no tiene misiones activas, la baja debe ser estrictamente lógica, aplicando `activo = false` y `eliminado_en = CURRENT_TIMESTAMP`. | `CP-H82-API-01`, `CP-H82-API-12`, `BUG-H82-API-02`, `BUG-H82-API-03` | 🟢 **CUMPLIDO** | Se aplica `activo = false`, `estado = 'NO_DISPONIBLE'`, `eliminado_en` y `eliminado_por_id`, con migración correlativa `032_` y soporte de auditoría histórica en `GET /api/cuadrillas` y `GET /api/cuadrillas/[id]`. |
| **CA-5** | Los recursos asociados en `cuadrilla_recurso` deben quedar desvinculados y disponibles en el inventario central. | `CP-H82-API-13`, `CP-H82-API-14`, `CP-H82-API-15`, `CP-H82-API-16`, `BUG-H82-API-01`, `BUG-H82-API-04` | 🟢 **CUMPLIDO** | Se desvinculan lógicamente `cuadrilla_recurso` y `cuadrilla_personal`, se decrementa `recurso.cantidad_en_uso` en la tabla maestra `recurso` liberando el stock al inventario central, y se restaura `usuario.estado_operativo = 'disponible'`. |
