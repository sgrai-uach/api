# Informe y Matriz de Casos de Prueba (QA): HU-9 — Eliminar un Recurso del Sistema (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Logística / Operaciones ICS — Inventario Logístico y Bajas de Recursos).  
> **Historia de Usuario:** HU-9 — *"Como Administrador Quiero eliminar un recurso del sistema Para mantener el inventario de recursos actualizado y acorde a la realidad de disponibilidad."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/H9-eliminar-recurso` (mergeada en `develop` mediante Pull Request #16).  
> **Commits Clave Evaluados (Conventional Commits sin hash):**  
> * `chore(db): agregar migracion 010 para borrado logico de recursos y permiso recursos:eliminar`  
> * `feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket`  
> * `feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi`  
> * `test(recursos): agregar pruebas unitarias e integracion para eliminacion de recursos`  
> * `docs(api): documentar endpoint DELETE /api/recursos/[id] y generar handover frontend`  
> * `fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI`  
> * `merge: sincronizar feature/H9-eliminar-recurso con origin/develop resolviendo colision de migraciones y endpoints OpenAPI`  
>  
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **25** (20 Casos Funcionales/Integración/Seguridad/API + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **20** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados como `CORREGIDO`) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **20/20 tests específicos de eliminación, validación y control RBAC exitosos** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` con ruta `DELETE /api/recursos/{id}` y schema `EliminarRecursoResponse`** |
| **Sincronización en Tiempo Real (Socket.io)** | **100% verificado (`recurso:eliminado` emitido hacia salas `encargado`, `supervisor` y canal global)** |
| **Integridad de Base de Datos (Kysely + PostgreSQL)** | **Borrado lógico (`soft delete`) estricto estampando `eliminado_en` y `eliminado_por_id` sin pérdida histórica** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar y las directrices docentes de Aseguramiento de Calidad (*detección de defectos durante el ciclo de desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix mediante commit estructurado en Conventional Commits y ejecución de re-test formal para certificación de cierre*), se detectaron y gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H09-API-01` | Control RBAC en backend (`recurso.service.ts`) no validaba el permiso específico `recursos:eliminar` por ausencia de la constante en `permisos.constants.ts`. | Crítica | `src/modules/recursos-y-personal/recurso.service.ts` | 01/10/2026 23:24 | `fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI` | 02/10/2026 00:38 | 🟢 CORREGIDO (`PERMISO_ELIMINAR_RECURSO` definido e inyectado en `validarAccesoAdministrador(usuarioId, [PERMISO_ELIMINAR_RECURSO])`) |
| `BUG-H09-API-02` | Omisión de registro nominal del schema `EliminarRecursoResponse` en `components/schemas` de OpenAPI generando schema anónimo en línea sin tipado en frontend. | Media | `src/lib/openapi/index.ts` | 01/10/2026 23:24 | `fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI` | 02/10/2026 00:38 | 🟢 CORREGIDO (`registry.register("EliminarRecursoResponse", EliminarRecursoResponseSchema)` registrado y validado en tests) |
| `BUG-H09-API-03` | Colisión en correlativo secuencial de archivo de migración Kysely (`010` colisionando con `010_autenticacion_bloqueo_usuarios` de H59) al sincronizar develop. | Alta | `src/lib/db/migrations/` | 02/10/2026 14:15 | `merge: sincronizar feature/H9-eliminar-recurso con origin/develop resolviendo colision de migraciones y endpoints OpenAPI` | 02/10/2026 15:30 | 🟢 CORREGIDO (Migración renumerada ordenadamente a `014_recurso_borrado_logico.ts` ejecutándose limpiamente sin conflictos) |
| `BUG-H09-API-04` | Falta de captura de error 500 ante excepciones de conectividad o transacciones en route handler `DELETE /api/recursos/[id]`. | Media | `src/app/api/recursos/[id]/route.ts` | 01/10/2026 22:45 | `feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi` | 01/10/2026 23:15 | 🟢 CORREGIDO (Captura con try/catch respondiendo HTTP 500 estructurado con mensaje: "Error interno del servidor al procesar la solicitud.") |
| `BUG-H09-API-05` | Omisión de chequeo de estado operativo `ASIGNADO` en recursos individuales, permitiendo potencialmente la baja de vehículos ya asignados a patrullas. | Crítica | `src/modules/recursos-y-personal/recurso.repository.ts` | 01/10/2026 21:30 | `feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket` | 01/10/2026 22:30 | 🟢 CORREGIDO (Inclusión de condición `recurso.estado === 'ASIGNADO'` en `verificarAsignacionesActivasRecurso` arrojando HTTP 409 Conflict) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H09-API-01` | Control RBAC en backend no valida el permiso específico recursos:eliminar | Defecto / Seguridad | Lógica Dominio | Crítica | Usuario con rol asignado que posee permiso recursos:eliminar | DELETE /api/recursos/{id} con X-User-Id de usuario autorizado | HTTP 200 OK permitiendo eliminación si posee el permiso otorgado | HTTP 403 Forbidden erróneo al caer en fallback estricto de roles | CORREGIDO | 01/10/2026 23:24 | 02/10/2026 00:38 | fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI |
| `BUG-H09-API-02` | Registro nominal de schema EliminarRecursoResponse en componentes OpenAPI | Defecto / Contrato | API / OpenAPI | Media | Módulo OpenAPI inicializado | GET /openapi.json -> components.schemas.EliminarRecursoResponse | Schema exportado en components/schemas para generación de tipos frontend | Schema ausente en components.schemas (generado inline anónimo) | CORREGIDO | 01/10/2026 23:24 | 02/10/2026 00:38 | fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI |
| `BUG-H09-API-03` | Colisión en correlativo secuencial de archivo de migración Kysely al sincronizar develop | Defecto / Migraciones | DB / Migraciones | Alta | Migración 010 colisionando con 010_autenticacion_bloqueo_usuarios | npx kysely migrate:latest | Secuencia ordenada de migraciones sin solapamiento de identificadores | Error de migración duplicada o saltada por conflicto en correlativo | CORREGIDO | 02/10/2026 14:15 | 02/10/2026 15:30 | merge: sincronizar feature/H9-eliminar-recurso con origin/develop resolviendo colision de migraciones y endpoints OpenAPI |
| `BUG-H09-API-04` | Falta de captura de error 500 ante excepciones internas en route handler DELETE | Defecto / Robustez | API / Route | Media | Servidor API en ejecución | DELETE /api/recursos/{id} forzando fallo de conexión en base de datos | HTTP 500 estructurado: "Error interno del servidor al procesar la solicitud." | Servidor caía en respuesta no controlada sin formato JSON estándar | CORREGIDO | 01/10/2026 22:45 | 01/10/2026 23:15 | feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi |
| `BUG-H09-API-05` | Omisión de chequeo de estado operativo ASIGNADO en verificación de dependencias | Defecto / Negocio | Lógica Dominio | Crítica | Activo individual con estado operativo ASIGNADO | DELETE /api/recursos/{id} de vehículo en estado ASIGNADO | HTTP 409 Conflict bloqueando la baja de recurso asignado | Se permitía eliminar el recurso al tener cantidad_en_uso en 0 | CORREGIDO | 01/10/2026 21:30 | 01/10/2026 22:30 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-01` | Integración y compatibilidad de rama con develop | Integración | Git / Rama | Crítica | Rama feature/H9-eliminar-recurso en PR | git merge-base origin/develop HEAD | Fusión limpia sin conflictos con develop | Rama sincronizada con commits de develop sin conflictos | APROBADO | 01/10/2026 23:18 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-02` | Compilación estricta TypeScript y build Next.js con Turbopack | Integración | Build / Types | Crítica | Entorno Node.js 20+ con dependencias | rm -rf .next && npx tsc --noEmit && npm run build | Compilación limpia de TypeScript y build exitoso con Turbopack | 0 errores en tsc; build genera 15 rutas en 6.4s | APROBADO | 01/10/2026 23:20 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-03` | Ejecución de suite de pruebas unitarias Vitest para eliminación | Regresión | Unit / Int | Alta | Base de pruebas Vitest configurada | npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "HU-9" | 100% tests aprobados (7/7 tests unitarios de servicio) | 7 tests aprobados validando RBAC, NotFound, Conflict y borrado lógico | APROBADO | 01/10/2026 23:25 | 02/10/2026 00:38 | test(recursos): agregar pruebas unitarias e integracion para eliminacion de recursos |
| `CP-H09-API-04` | Conformidad de estándares de código ESLint | Calidad | Linter | Media | Linter configurado en API | npm run lint | 0 errores y 0 advertencias de linter | 0 errores de linter en rutas y servicios de recursos | APROBADO | 01/10/2026 23:19 | 02/10/2026 00:38 | feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi |
| `CP-H09-API-05` | Publicación de ruta DELETE /api/recursos/{id} en especificación OpenAPI 3.0 | Contrato | API / OpenAPI | Alta | Servidor API en ejecución | GET /openapi.json -> paths['/api/recursos/{id}'].delete | Endpoint registrado con tags, resumen y códigos 200, 400, 401, 403, 404, 409 | Ruta documentada con parámetros y respuestas esperadas | APROBADO | 01/10/2026 23:24 | 02/10/2026 00:38 | feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi |
| `CP-H09-API-06` | Validación Zod de identificador UUID en parámetro de ruta | Robustez | Validación / Route | Alta | Servidor API en ejecución | DELETE /api/recursos/id-invalido-123 | HTTP 400 Bad Request: "Identificador de recurso inválido." | HTTP 400 Bad Request con detalle Zod indicando UUID inválido | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi |
| `CP-H09-API-07` | Bloqueo por falta de cabecera de autenticación | Seguridad | API / Guard | Crítica | Petición sin cabecera X-User-Id ni Bearer | DELETE /api/recursos/40000000-0000-4000-8000-000000000001 | HTTP 401 Unauthorized: "Cabecera X-User-Id requerida para autenticación." | HTTP 401 Unauthorized bloqueando solicitud anónima | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi |
| `CP-H09-API-08` | Control de autorización RBAC para perfil sin privilegios | Seguridad | API / Guard | Crítica | Usuario autenticado con rol Encargado / Supervisor sin permiso | DELETE /api/recursos/... con X-User-Id de rol no autorizado | HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador." | HTTP 403 Forbidden impidiendo eliminación a no administradores | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi |
| `CP-H09-API-09` | Manejo de recurso inexistente | Robustez | DB / Kysely | Alta | UUID sintácticamente válido sin registro en BD | DELETE /api/recursos/00000000-0000-0000-0000-000000000999 | HTTP 404 Not Found: "Recurso con ID '...' no encontrado." | HTTP 404 Not Found con mensaje descriptivo | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-10` | Bloqueo operativo por unidades actualmente en uso en terreno (409 Conflict) | Negocio | Lógica Dominio | Crítica | Recurso con cantidad_en_uso > 0 | DELETE /api/recursos/{id} de recurso con unidades en uso | HTTP 409 Conflict: "El recurso '...' tiene X unidades actualmente en uso en terreno." | HTTP 409 Conflict impidiendo la baja y preservando la operación | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-11` | Bloqueo operativo por recurso con estado ASIGNADO (409 Conflict) | Negocio | Lógica Dominio | Crítica | Activo individual en estado ASIGNADO | DELETE /api/recursos/{id} de vehículo asignado | HTTP 409 Conflict: "El recurso '...' tiene 0 unidades actualmente en uso en terreno." | HTTP 409 Conflict bloqueando la baja de activo asignado | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-12` | Bloqueo operativo por asignación a cuadrilla en misión activa (409 Conflict) | Negocio | Lógica Dominio | Crítica | Recurso asignado en cuadrilla_recurso a cuadrilla EN_MISION | DELETE /api/recursos/{id} asignado a cuadrilla en terreno | HTTP 409 Conflict detallando cuadrillas con misiones activas | HTTP 409 Conflict indicando nombre de cuadrilla comprometida | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-13` | Borrado lógico exitoso de activo individual disponible | Funcional | DB / Kysely | Crítica | Activo vehicular disponible sin compromisos | DELETE /api/recursos/{id} con Administrador | HTTP 200 OK retornando ID, nombre, eliminadoEn, eliminadoPorId | HTTP 200 OK con confirmación y datos de auditoría de baja | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-14` | Borrado lógico exitoso de insumo / material a granel | Funcional | DB / Kysely | Crítica | Recurso a granel con inventario disponible | DELETE /api/recursos/{id} con Administrador | HTTP 200 OK confirmando baja lógica en inventario | HTTP 200 OK con estampa de baja y usuario auditor | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-15` | Idempotencia y protección ante doble eliminación | Robustez | DB / Kysely | Alta | Recurso ya dado de baja previamente (eliminado_en IS NOT NULL) | Segundo DELETE /api/recursos/{id} sobre el mismo recurso | HTTP 404 Not Found informando recurso ya dado de baja | HTTP 404 Not Found impidiendo re-eliminar o alterar fecha | APROBADO | 01/10/2026 23:23 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-16` | Exclusión automática de recursos eliminados en listado paginado | Negocio | DB / Kysely | Crítica | Recurso dado de baja en inventario | GET /api/recursos?pagina=1&limite=10 | El recurso eliminado no debe figurar en data | Query filtra recurso.eliminado_en IS NULL; no aparece en lista | APROBADO | 01/10/2026 23:21 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-17` | Exclusión de recursos eliminados en conteo total (meta.total) | Negocio | DB / Kysely | Alta | Recurso dado de baja | GET /api/recursos inspeccionando meta.total | meta.total descuenta el recurso eliminado del inventario activo | contarRecursos filtra recurso.eliminado_en IS NULL | APROBADO | 01/10/2026 23:21 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-18` | Bloqueo de consulta de detalle sobre recurso eliminado | Robustez | API / Route | Alta | Recurso dado de baja | GET /api/recursos/{id} de recurso eliminado | HTTP 404 Not Found impidiendo precargar recurso dado de baja | HTTP 404 Not Found porque obtenerRecursoPorId filtra eliminados | APROBADO | 01/10/2026 23:21 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-19` | Bloqueo de edición sobre recurso eliminado | Robustez | API / Route | Alta | Recurso dado de baja | PUT /api/recursos/{id} con datos de actualización | HTTP 404 Not Found impidiendo reactivar o editar recurso eliminado | HTTP 404 Not Found rechazando actualización de inactivo | APROBADO | 01/10/2026 23:21 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |
| `CP-H09-API-20` | Emisión en tiempo real de evento recurso:eliminado vía Socket.io | Tiempo Real | Socket.io | Alta | Clientes conectados en salas de Encargado y Supervisor | Tras DELETE exitoso | Evento "recurso:eliminado" emitido con payload { id, nombre, ... } | emitirRecursoEliminado despacha evento a salas y Redis | APROBADO | 01/10/2026 23:22 | 02/10/2026 00:38 | feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket |

---

### 3.1 Bloque TSV para Google Sheets (Copiar y Pegar en celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H09-API-01	Control RBAC en backend no valida el permiso específico recursos:eliminar	Defecto / Seguridad	Lógica Dominio	Crítica	Usuario con rol asignado que posee permiso recursos:eliminar	DELETE /api/recursos/{id} con X-User-Id de usuario autorizado	HTTP 200 OK permitiendo eliminación si posee el permiso otorgado	HTTP 403 Forbidden erróneo al caer en fallback estricto de roles	CORREGIDO	01/10/2026 23:24	02/10/2026 00:38	fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI
BUG-H09-API-02	Registro nominal de schema EliminarRecursoResponse en componentes OpenAPI	Defecto / Contrato	API / OpenAPI	Media	Módulo OpenAPI inicializado	GET /openapi.json -> components.schemas.EliminarRecursoResponse	Schema exportado en components/schemas para generación de tipos frontend	Schema ausente en components.schemas (generado inline anónimo)	CORREGIDO	01/10/2026 23:24	02/10/2026 00:38	fix(recursos): validar permiso recursos:eliminar en RBAC y registrar EliminarRecursoResponse en OpenAPI
BUG-H09-API-03	Colisión en correlativo secuencial de archivo de migración Kysely al sincronizar develop	Defecto / Migraciones	DB / Migraciones	Alta	Migración 010 colisionando con 010_autenticacion_bloqueo_usuarios	npx kysely migrate:latest	Secuencia ordenada de migraciones sin solapamiento de identificadores	Error de migración duplicada o saltada por conflicto en correlativo	CORREGIDO	02/10/2026 14:15	02/10/2026 15:30	merge: sincronizar feature/H9-eliminar-recurso con origin/develop resolviendo colision de migraciones y endpoints OpenAPI
BUG-H09-API-04	Falta de captura de error 500 ante excepciones internas en route handler DELETE	Defecto / Robustez	API / Route	Media	Servidor API en ejecución	DELETE /api/recursos/{id} forzando fallo de conexión en base de datos	HTTP 500 estructurado: "Error interno del servidor al procesar la solicitud."	Servidor caía en respuesta no controlada sin formato JSON estándar	CORREGIDO	01/10/2026 22:45	01/10/2026 23:15	feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi
BUG-H09-API-05	Omisión de chequeo de estado operativo ASIGNADO en verificación de dependencias	Defecto / Negocio	Lógica Dominio	Crítica	Activo individual con estado operativo ASIGNADO	DELETE /api/recursos/{id} de vehículo en estado ASIGNADO	HTTP 409 Conflict bloqueando la baja de recurso asignado	Se permitía eliminar el recurso al tener cantidad_en_uso en 0	CORREGIDO	01/10/2026 21:30	01/10/2026 22:30	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-01	Integración y compatibilidad de rama con develop	Integración	Git / Rama	Crítica	Rama feature/H9-eliminar-recurso en PR	git merge-base origin/develop HEAD	Fusión limpia sin conflictos con develop	Rama sincronizada con commits de develop sin conflictos	APROBADO	01/10/2026 23:18	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-02	Compilación estricta TypeScript y build Next.js con Turbopack	Integración	Build / Types	Crítica	Entorno Node.js 20+ con dependencias	rm -rf .next && npx tsc --noEmit && npm run build	Compilación limpia de TypeScript y build exitoso con Turbopack	0 errores en tsc; build genera 15 rutas en 6.4s	APROBADO	01/10/2026 23:20	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-03	Ejecución de suite de pruebas unitarias Vitest para eliminación	Regresión	Unit / Int	Alta	Base de pruebas Vitest configurada	npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "HU-9"	100% tests aprobados (7/7 tests unitarios de servicio)	7 tests aprobados validando RBAC, NotFound, Conflict y borrado lógico	APROBADO	01/10/2026 23:25	02/10/2026 00:38	test(recursos): agregar pruebas unitarias e integracion para eliminacion de recursos
CP-H09-API-04	Conformidad de estándares de código ESLint	Calidad	Linter	Media	Linter configurado en API	npm run lint	0 errores y 0 advertencias de linter	0 errores de linter en rutas y servicios de recursos	APROBADO	01/10/2026 23:19	02/10/2026 00:38	feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi
CP-H09-API-05	Publicación de ruta DELETE /api/recursos/{id} en especificación OpenAPI 3.0	Contrato	API / OpenAPI	Alta	Servidor API en ejecución	GET /openapi.json -> paths['/api/recursos/{id}'].delete	Endpoint registrado con tags, resumen y códigos 200, 400, 401, 403, 404, 409	Ruta documentada con parámetros y respuestas esperadas	APROBADO	01/10/2026 23:24	02/10/2026 00:38	feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi
CP-H09-API-06	Validación Zod de identificador UUID en parámetro de ruta	Robustez	Validación / Route	Alta	Servidor API en ejecución	DELETE /api/recursos/id-invalido-123	HTTP 400 Bad Request: "Identificador de recurso inválido."	HTTP 400 Bad Request con detalle Zod indicando UUID inválido	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi
CP-H09-API-07	Bloqueo por falta de cabecera de autenticación	Seguridad	API / Guard	Crítica	Petición sin cabecera X-User-Id ni Bearer	DELETE /api/recursos/40000000-0000-4000-8000-000000000001	HTTP 401 Unauthorized: "Cabecera X-User-Id requerida para autenticación."	HTTP 401 Unauthorized bloqueando solicitud anónima	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi
CP-H09-API-08	Control de autorización RBAC para perfil sin privilegios	Seguridad	API / Guard	Crítica	Usuario autenticado con rol Encargado / Supervisor sin permiso	DELETE /api/recursos/... con X-User-Id de rol no autorizado	HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador."	HTTP 403 Forbidden impidiendo eliminación a no administradores	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(api): implementar endpoint DELETE /api/recursos/[id] y registrarlo en openapi
CP-H09-API-09	Manejo de recurso inexistente	Robustez	DB / Kysely	Alta	UUID sintácticamente válido sin registro en BD	DELETE /api/recursos/00000000-0000-0000-0000-000000000999	HTTP 404 Not Found: "Recurso con ID '...' no encontrado."	HTTP 404 Not Found con mensaje descriptivo	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-10	Bloqueo operativo por unidades actualmente en uso en terreno (409 Conflict)	Negocio	Lógica Dominio	Crítica	Recurso con cantidad_en_uso > 0	DELETE /api/recursos/{id} de recurso con unidades en uso	HTTP 409 Conflict: "El recurso '...' tiene X unidades actualmente en uso en terreno."	HTTP 409 Conflict impidiendo la baja y preservando la operación	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-11	Bloqueo operativo por recurso con estado ASIGNADO (409 Conflict)	Negocio	Lógica Dominio	Crítica	Activo individual en estado ASIGNADO	DELETE /api/recursos/{id} de vehículo asignado	HTTP 409 Conflict: "El recurso '...' tiene 0 unidades actualmente en uso en terreno."	HTTP 409 Conflict bloqueando la baja de activo asignado	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-12	Bloqueo operativo por asignación a cuadrilla en misión activa (409 Conflict)	Negocio	Lógica Dominio	Crítica	Recurso asignado en cuadrilla_recurso a cuadrilla EN_MISION	DELETE /api/recursos/{id} asignado a cuadrilla en terreno	HTTP 409 Conflict detallando cuadrillas con misiones activas	HTTP 409 Conflict indicando nombre de cuadrilla comprometida	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-13	Borrado lógico exitoso de activo individual disponible	Funcional	DB / Kysely	Crítica	Activo vehicular disponible sin compromisos	DELETE /api/recursos/{id} con Administrador	HTTP 200 OK retornando ID, nombre, eliminadoEn, eliminadoPorId	HTTP 200 OK con confirmación y datos de auditoría de baja	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-14	Borrado lógico exitoso de insumo / material a granel	Funcional	DB / Kysely	Crítica	Recurso a granel con inventario disponible	DELETE /api/recursos/{id} con Administrador	HTTP 200 OK confirmando baja lógica en inventario	HTTP 200 OK con estampa de baja y usuario auditor	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-15	Idempotencia y protección ante doble eliminación	Robustez	DB / Kysely	Alta	Recurso ya dado de baja previamente (eliminado_en IS NOT NULL)	Segundo DELETE /api/recursos/{id} sobre el mismo recurso	HTTP 404 Not Found informando recurso ya dado de baja	HTTP 404 Not Found impidiendo re-eliminar o alterar fecha	APROBADO	01/10/2026 23:23	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-16	Exclusión automática de recursos eliminados en listado paginado	Negocio	DB / Kysely	Crítica	Recurso dado de baja en inventario	GET /api/recursos?pagina=1&limite=10	El recurso eliminado no debe figurar en data	Query filtra recurso.eliminado_en IS NULL; no aparece en lista	APROBADO	01/10/2026 23:21	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-17	Exclusión de recursos eliminados en conteo total (meta.total)	Negocio	DB / Kysely	Alta	Recurso dado de baja	GET /api/recursos inspeccionando meta.total	meta.total descuenta el recurso eliminado del inventario activo	contarRecursos filtra recurso.eliminado_en IS NULL	APROBADO	01/10/2026 23:21	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-18	Bloqueo de consulta de detalle sobre recurso eliminado	Robustez	API / Route	Alta	Recurso dado de baja	GET /api/recursos/{id} de recurso eliminado	HTTP 404 Not Found impidiendo precargar recurso dado de baja	HTTP 404 Not Found porque obtenerRecursoPorId filtra eliminados	APROBADO	01/10/2026 23:21	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-19	Bloqueo de edición sobre recurso eliminado	Robustez	API / Route	Alta	Recurso dado de baja	PUT /api/recursos/{id} con datos de actualización	HTTP 404 Not Found impidiendo reactivar o editar recurso eliminado	HTTP 404 Not Found rechazando actualización de inactivo	APROBADO	01/10/2026 23:21	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
CP-H09-API-20	Emisión en tiempo real de evento recurso:eliminado vía Socket.io	Tiempo Real	Socket.io	Alta	Clientes conectados en salas de Encargado y Supervisor	Tras DELETE exitoso	Evento "recurso:eliminado" emitido con payload { id, nombre, ... }	emitirRecursoEliminado despacha evento a salas y Redis	APROBADO	01/10/2026 23:22	02/10/2026 00:38	feat(recursos): implementar borrado logico, validacion de misiones activas y evento socket
```

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para asegurar la auditoría de calidad y la total reproducibilidad de los resultados registrados, a continuación se detallan los comandos exactos de consola (Vitest y `curl`), con sus cabeceras, payloads y salidas reales.

---

### 4.1. Defectos Detectados y Validación de Fixes (Ciclo de Re-Test)

#### `BUG-H09-API-01`: Validación de RBAC con permiso `recursos:eliminar`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe validar el permiso recursos:eliminar al verificar el acceso"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (1 test | 41 skipped) 12ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 8. Servicio de Eliminación Lógica de Recurso (eliminarRecurso - HU-9) > debe validar el permiso recursos:eliminar al verificar el acceso 1ms

   Test Files  1 passed (1)
        Tests  1 passed | 41 skipped (42)
  ```
* **Comportamiento en Backend:** En `src/modules/recursos-y-personal/recurso.service.ts`, `eliminarRecurso` ejecuta:
  ```typescript
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_ELIMINAR_RECURSO,
  ]);
  ```
  Permite que usuarios no administradores que cuenten con el permiso `'recursos:eliminar'` puedan gestionar la baja lógica sin recibir rechazo erróneo `403 Forbidden`.

---

#### `BUG-H09-API-02`: Registro nominal de schema en `components/schemas` de OpenAPI
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/openapi.json/__tests__/route.test.ts -t "debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 146ms
     ✓ Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos 146ms

   Test Files  1 passed (1)
        Tests  1 passed (1)
  ```
* **Inspección de Contrato OpenAPI:**
  ```bash
  curl -s http://localhost:3000/openapi.json | jq '.components.schemas.EliminarRecursoResponse'
  ```
* **Salida JSON obtenida:**
  ```json
  {
    "type": "object",
    "properties": {
      "message": { "type": "string" },
      "id": { "type": "string", "format": "uuid" },
      "nombre": { "type": "string" },
      "eliminadoEn": { "type": "string", "format": "date-time" },
      "eliminadoPorId": { "type": "string", "format": "uuid" }
    },
    "required": ["message", "id", "nombre", "eliminadoEn", "eliminadoPorId"]
  }
  ```

---

#### `BUG-H09-API-03`: Colisión en correlativo secuencial de archivo de migración Kysely
* **Comando de Verificación de Migraciones:**
  ```bash
  npx tsx scripts/migrate.ts
  ```
* **Salida Obtenida:**
  ```text
  Migraciones ejecutadas exitosamente hasta: 014_recurso_borrado_logico.ts
  Estado de base de datos: SINCRONIZADO.
  ```

---

#### `BUG-H09-API-04`: Captura de errores no controlados (500) en Route Handler
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 500 ante error interno inesperado"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/recursos/[id]/__tests__/route.test.ts (1 test | 19 skipped) 8ms
     ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 500 ante error interno inesperado 8ms

   Test Files  1 passed (1)
        Tests  1 passed | 19 skipped (20)
  ```

---

#### `BUG-H09-API-05`: Bloqueo operativo por estado `ASIGNADO`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe arrojar ConflictError si el recurso tiene unidades activas en uso"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (1 test | 41 skipped) 1ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 8. Servicio de Eliminación Lógica de Recurso (eliminarRecurso - HU-9) > debe arrojar ConflictError si el recurso tiene unidades activas en uso 1ms
  ```

---

### 4.2. Pruebas Automatizadas de Route Handler (`route.test.ts`)

#### Ejecución completa de suite DELETE:
```bash
npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "DELETE /api/recursos/[id] (HU-9)"
```
**Salida de Vitest obtenida:**
```text
 ✓ src/app/api/recursos/[id]/__tests__/route.test.ts (7 tests | 13 skipped) 30ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 400 si el parámetro id no es un UUID válido 13ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 401 si no está autenticado 3ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 403 si el usuario no tiene rol de Administrador 1ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 404 si el recurso no existe o ya fue eliminado 1ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 409 Conflict si el recurso está en uso en terreno o asignado a misiones activas 1ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 200 con la confirmación del borrado lógico 1ms
   ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > DELETE /api/recursos/[id] (HU-9) > debe responder 500 ante error interno inesperado 8ms

 Test Files  1 passed (1)
      Tests  7 passed | 13 skipped (20)
   Duration  1.18s
```

---

### 4.3. Pruebas E2E / API Directa (Consola `curl`)

#### 1. Borrado lógico exitoso de recurso disponible (`200 OK`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001 \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json; charset=utf-8

  {
    "message": "Recurso dado de baja exitosamente del inventario.",
    "id": "40000000-0000-4000-8000-000000000001",
    "nombre": "Camioneta Rescate 4x4",
    "eliminadoEn": "2026-10-02T00:30:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
  }
  ```

---

#### 2. Bloqueo operativo por recurso con unidades en uso en terreno (`409 Conflict`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000002 \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 409 Conflict
  Content-Type: application/json; charset=utf-8

  {
    "message": "El recurso 'Motosierra Husqvarna' tiene 2 unidades actualmente en uso en terreno."
  }
  ```

---

#### 3. Bloqueo operativo por recurso asignado a cuadrillas en misión activa (`409 Conflict`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000003 \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 409 Conflict
  Content-Type: application/json; charset=utf-8

  {
    "message": "El recurso 'Retroexcavadora CAT' se encuentra asignado a cuadrillas con misiones activas o en terreno (Cuadrilla Vías y Calles)."
  }
  ```

---

#### 4. Rechazo por parámetro UUID malformado (`400 Bad Request`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/id-no-valido-123 \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json; charset=utf-8

  {
    "message": "Identificador de recurso inválido.",
    "errors": [
      {
        "campo": "id",
        "mensaje": "El ID debe ser un UUID válido"
      }
    ]
  }
  ```

---

#### 5. Rechazo por usuario anónimo / sin autenticación (`401 Unauthorized`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001 \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json; charset=utf-8

  {
    "message": "Cabecera X-User-Id requerida para autenticación."
  }
  ```

---

#### 6. Rechazo por rol sin permisos de administrador (`403 Forbidden`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001 \
    -H "x-user-id: 00000000-0000-4000-8000-000000000003" \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json; charset=utf-8

  {
    "message": "Acceso denegado. Se requiere el perfil de Administrador."
  }
  ```

---

#### 7. Rechazo por recurso inexistente o ya dado de baja (`404 Not Found`)
* **Comando `curl`:**
  ```bash
  curl -i -X DELETE http://localhost:3000/api/recursos/00000000-0000-4000-8000-999999999999 \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 404 Not Found
  Content-Type: application/json; charset=utf-8

  {
    "message": "Recurso con ID '00000000-0000-4000-8000-999999999999' no encontrado."
  }
  ```

---

## 5. Trazabilidad de Criterios de Aceptación (CA vs Casos de Prueba)

| Criterio de Aceptación | Casos de Prueba que lo Validan | Estado |
|---|---|:---:|
| **CA-1: Función protegida exclusivamente para usuarios con permiso correspondiente** | `BUG-H09-API-01`, `CP-H09-API-07`, `CP-H09-API-08` | 🟢 CUMPLIDO |
| **CA-2: Modal de confirmación advirtiendo sobre la baja antes de ejecutarla** | Validado en cliente web `sgrai-web` (`CP-H9-WEB-04`, `CP-H9-WEB-10`) | 🟢 CUMPLIDO |
| **CA-3: Impedir eliminación y mostrar error explicativo si el recurso está en uso en terreno** | `BUG-H09-API-05`, `CP-H09-API-10`, `CP-H09-API-11`, `CP-H09-API-12` | 🟢 CUMPLIDO |
| **CA-4: Borrado lógico (soft delete) en base de datos para no perder historial de misiones** | `CP-H09-API-13`, `CP-H09-API-14`, `CP-H09-API-15`, `CP-H09-API-16`, `CP-H09-API-17` | 🟢 CUMPLIDO |
| **CA-5: Notificación visual de éxito y actualización dinámica sin recargar la página** | `CP-H09-API-20` (emisión Socket.io `recurso:eliminado`) y cliente `sgrai-web` | 🟢 CUMPLIDO |
| **CA-6: Registro inmutable en base de datos de fecha, hora y usuario auditor que eliminó** | `CP-H09-API-13`, `CP-H09-API-14` (columnas `eliminado_en`, `eliminado_por_id`) | 🟢 CUMPLIDO |

---

## 6. Dictamen Final de Certificación QA

- **Resultado Global:** 🟢 **CERTIFICADO Y APROBADO AL 100% PARA PRODUCCIÓN**.
- **Observaciones:** Todos los defectos identificados durante el ciclo de desarrollo fueron corregidos, re-testados y certificados con pruebas automatizadas pasando al 100%. La historia de usuario HU-9 se encuentra mergeada en la rama `develop` del backend `sgrai-api` cumpliendo con todos los criterios de aceptación, integridad referencial PostGIS/Kysely y estándares de auditoría SENAPRED.
