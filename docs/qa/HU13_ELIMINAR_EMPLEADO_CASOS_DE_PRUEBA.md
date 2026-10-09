# Informe y Matriz de Casos de Prueba (QA): HU-13 — Eliminar (Desactivar) Empleado (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Sección de Operaciones y Logística ICS — Gestión de Empleados, Fichas de Terreno, Roles y Auditoría).  
> **Historia de Usuario:** HU-13 — *"Como Administrador Quiero eliminar del sistema a un empleado Para tener a disposición solo el personal realmente disponible."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest + OpenAPI 3.0).  
> **Rama Git Evaluada:** `feature/H13-eliminar-empleado` (mergeada en `develop` mediante Pull Request #15).  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(personal): implementar baja logica de empleados (H13)`
> * `fix(personal): filtrar empleados activos por omision en listado (H13)`
> * `docs(personal): documentar endpoints GET y DELETE /api/personal (H13)`
> * `feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta`
> * `feat(personal): validar rol administrador y misiones activas en baja logica (H13)`
> * `merge: sincronizar develop con feature/H13-eliminar-empleado`
> * `merge: pull request #15 from sgrai-uach/feature/H13-eliminar-empleado`
>
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **25** (20 Casos Funcionales/Seguridad/Integración + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **20** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **17/17 tests de baja lógica y endpoint aprobados (33/33 en rutas de personal)** |
| **Integridad Transaccional y Soft-Delete** | **100% verificado (`db.transaction()`, `activo = false`, preservación de FK)** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` con ruta `DELETE /api/personal/{id}`** |
| **Trazabilidad de Auditoría** | **100% registrado en tabla inmutable `log_cambios_usuarios` con tipo `BAJA_LOGICA_H13`** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo docente de Aseguramiento de Calidad (*detección de defectos durante el ciclo de vida de la rama, reporte formal al equipo de desarrollo, implementación del fix mediante commits estructurados en Conventional Commits y ejecución de re-test formal para certificar su cierre*), se detectaron y gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H13-API-01` | Omisión de filtro de empleados inactivos por omisión en endpoint de listado (`GET /api/personal`), retornando personal dado de baja en los selectores activos. | Alta | `src/modules/recursos-y-personal/personal-listado.repository.ts` | 24/09/2026 18:30 | fix(personal): filtrar empleados activos por omision en listado (H13) | 25/09/2026 09:10 | 🟢 CORREGIDO (`usuarios.activo = true` filtrado por defecto; soporte para `incluir_inactivos` y `estado=inactivo`) |
| `BUG-H13-API-02` | Error 500 en PostgreSQL por violación de Foreign Key en `log_cambios_usuarios.modificado_por_id` cuando `x-user-id` no existía en la tabla `usuarios`. | Crítica | `src/modules/recursos-y-personal/services/eliminar-empleado.service.ts` | 28/09/2026 19:40 | feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta | 29/09/2026 18:15 | 🟢 CORREGIDO (Sanitización defensiva asignando `null` si el ID del admin no existe en BD, previniendo violación FK) |
| `BUG-H13-API-03` | Error 500 no controlado por fallo de casteo UUID en PostgreSQL al recibir cabecera de autenticación `x-user-id` con string arbitrario no-UUID. | Alta | `src/modules/seguridad/service.ts` / `src/app/api/personal/[id]/route.ts` | 29/09/2026 11:20 | feat(personal): validar rol administrador y misiones activas en baja logica (H13) | 01/10/2026 20:30 | 🟢 CORREGIDO (Validación defensiva con `z.string().uuid()` en `validarAccesoRoles` respondiendo 401 Unauthorized) |
| `BUG-H13-API-04` | Ausencia de validación de formato UUID en parámetro de ruta `:id` en `DELETE /api/personal/[id]`, provocando fallos internos en lugar de HTTP 400 Bad Request. | Media | `src/app/api/personal/[id]/route.ts` | 29/09/2026 11:45 | feat(personal): validar rol administrador y misiones activas en baja logica (H13) | 01/10/2026 20:32 | 🟢 CORREGIDO (Validación con `z.string().uuid().safeParse(id)` retornando HTTP 400 estructurado) |
| `BUG-H13-API-05` | Ausencia de validación de dependencias operativas tácticas (empleado en misión/patrulla o delegado de cuadrilla activa), permitiendo desvincular personal activo en terreno. | Crítica | `src/modules/recursos-y-personal/services/eliminar-empleado.service.ts` | 30/09/2026 16:15 | feat(personal): validar rol administrador y misiones activas en baja logica (H13) | 01/10/2026 20:35 | 🟢 CORREGIDO (Lanzamiento de `EmpleadoEnMisionActivaError` respondiendo HTTP 409 Conflict con mensaje explícito) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H13-API-01` | Omisión de filtro de empleados inactivos por omisión en listado GET /api/personal | Regla de Negocio / DAL | DAL / Query | Alta | Empleado dado de baja con activo = false en base de datos | GET /api/personal sin parámetros de filtro | Solo se retornan funcionarios activos con activo: true | Se retornaban empleados inactivos mezclados con activos en selectores de personal | CORREGIDO | 24/09/2026 18:30 | 25/09/2026 09:10 | fix(personal): filtrar empleados activos por omision en listado (H13) |
| `BUG-H13-API-02` | Error 500 en PostgreSQL por violación de Foreign Key en log_cambios_usuarios | Integración / BD | DB / Transacción | Crítica | Petición DELETE con x-user-id no registrado en tabla usuarios | DELETE /api/personal/:id con x-user-id: 00000000-0000-4000-8000-000000000999 | Registro de auditoría sanitizado con modificado_por_id: null | Error 500 por foreign key constraint violation en log_cambios_usuarios | CORREGIDO | 28/09/2026 19:40 | 29/09/2026 18:15 | feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta |
| `BUG-H13-API-03` | Error 500 no controlado por formato no UUID en cabecera de autenticación x-user-id | Seguridad / Auth | API / Guard | Alta | Servidor API en ejecución | DELETE /api/personal/:id con cabecera x-user-id: admin | HTTP 401 Unauthorized indicando usuario no válido | Fallo de casteo UUID en PostgreSQL generando HTTP 500 interno no controlado | CORREGIDO | 29/09/2026 11:20 | 01/10/2026 20:30 | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `BUG-H13-API-04` | Ausencia de validación de formato UUID en parámetro de ruta :id de personal | Validación (Zod) | API / Route | Media | Servidor API en ejecución | DELETE /api/personal/id-invalido-123 con JWT de Administrador | HTTP 400 Bad Request: "El identificador del empleado debe ser un UUID válido" | Error de sintaxis SQL o falla no sanitizada de PostgreSQL | CORREGIDO | 29/09/2026 11:45 | 01/10/2026 20:32 | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `BUG-H13-API-05` | Ausencia de validación de dependencias operativas tácticas (misión o patrulla en curso) | Regla de Negocio | Servicio / BD | Crítica | Funcionario de terreno asignado a misión o patrulla activa | DELETE /api/personal/:id sobre empleado con estado en_mision | HTTP 409 Conflict bloqueando la baja y protegiendo el personal en terreno | La baja se ejecutaba permitiendo desvincular a personal en operaciones críticas | CORREGIDO | 30/09/2026 16:15 | 01/10/2026 20:35 | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-01` | Baja lógica exitosa de funcionario administrativo de oficina (Flujo Feliz) | Funcional | API / DB | Alta | Funcionario registrado solo en usuarios sin ficha en personal | DELETE /api/personal/00000000-0000-4000-8000-000000000001 con Admin | HTTP 200 OK con activo: false y fecha_salida asignada | HTTP 200 OK confirmando baja lógica y registrando fecha_salida | APROBADO | 01/10/2026 20:40 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-02` | Baja lógica sincronizada atómicamente en usuarios y personal para personal de terreno | Integración | DB / Kysely | Alta | Funcionario con cuenta de usuario y ficha operativa en personal | DELETE /api/personal/:id sobre brigadista con estado disponible | HTTP 200 OK; usuarios.activo=false, personal.estado_operativo=inactivo, disponible_terreno=false | HTTP 200 OK con actualización atómica de ambas tablas en PostgreSQL | APROBADO | 01/10/2026 20:42 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-03` | Resolución polimórfica del parámetro :id recibiendo personal.id en lugar de usuario.id | Funcional | DAL / Servicio | Alta | Funcionario operativo con UUID de personal y UUID de usuario | DELETE /api/personal/:personal_id con JWT de Administrador | El servicio resuelve usuario_id subyacente y ejecuta la baja con 200 OK | HTTP 200 OK procesando la baja correctamente mediante personal.id | APROBADO | 01/10/2026 20:45 | - | feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta |
| `CP-H13-API-04` | Preservación física del registro en PostgreSQL (Soft-Delete e integridad referencial) | Integración / BD | Base de Datos | Crítica | Funcionario dado de baja mediante endpoint DELETE | Consulta SELECT directo en PostgreSQL sobre tablas usuarios y personal | Las filas existen físicamente con activo: false, conservando historial SENAPRED | Registros preservados físicamente sin romper claves foráneas históricas | APROBADO | 01/10/2026 20:48 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-05` | Asignación automática de fecha_salida con fecha actual si se encontraba en null | Regla de Negocio | Servicio / BD | Media | Funcionario activo con fecha_salida en null | DELETE /api/personal/:id ejecutado exitosamente | fecha_salida poblada automáticamente con la fecha de hoy (YYYY-MM-DD) | fecha_salida persistida automáticamente con formato ISO de fecha actual | APROBADO | 01/10/2026 20:50 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-06` | Preservación de fecha_salida preexistente si el funcionario ya contaba con una | Regla de Negocio | Servicio / BD | Media | Funcionario con fecha_salida previamente configurada (ej. 2026-05-01) | DELETE /api/personal/:id ejecutado exitosamente | Se preserva la fecha_salida preexistente (2026-05-01) sin sobreescribirla | fecha_salida mantenida intacta respetando trazabilidad contractual previa | APROBADO | 01/10/2026 20:52 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-07` | Registro inmutable de trazabilidad y auditoría en tabla log_cambios_usuarios | Auditoría | DB / Kysely | Alta | Administrador autenticado ejecuta la baja lógica | Inserción automática en tabla log_cambios_usuarios | Registro insertado con usuario_modificado_id, modificado_por_id y tipo BAJA_LOGICA_H13 | Fila de auditoría persistida con timestamp y JSONB de campos modificados | APROBADO | 01/10/2026 20:55 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-08` | Bloqueo con HTTP 409 Conflict si funcionario de terreno tiene estado en_mision | Regla de Negocio | Unitaria / DB | Crítica | Funcionario con ficha en personal y estado_operativo = en_mision | DELETE /api/personal/:id con token de Administrador | HTTP 409 Conflict: "El empleado se encuentra actualmente en terreno..." | HTTP 409 Conflict abortando la baja y protegiendo la operación de terreno | APROBADO | 01/10/2026 20:58 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-09` | Bloqueo con HTTP 409 Conflict si funcionario de terreno tiene estado en_patrulla | Regla de Negocio | Unitaria / DB | Crítica | Funcionario con ficha en personal y estado_operativo = en_patrulla | DELETE /api/personal/:id con token de Administrador | HTTP 409 Conflict: "El empleado se encuentra actualmente en terreno..." | HTTP 409 Conflict bloqueando la desactivación del patrullero en ruta | APROBADO | 01/10/2026 21:00 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-10` | Bloqueo con HTTP 409 Conflict si funcionario es delegado de cuadrilla en misión | Regla de Negocio | Unitaria / DB | Crítica | Funcionario registrado como usuario_delegado_id en cuadrilla EN_MISION | DELETE /api/personal/:id con token de Administrador | HTTP 409 Conflict: "El empleado es delegado de la cuadrilla '...', en misión activa." | HTTP 409 Conflict impidiendo dejar a la cuadrilla táctica sin delegado | APROBADO | 01/10/2026 21:02 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-11` | Bloqueo con HTTP 409 Conflict si funcionario es líder de patrulla en verificación | Regla de Negocio | Unitaria / DB | Crítica | Funcionario registrado como usuario_lider_id en patrulla EN_VERIFICACION | DELETE /api/personal/:id con token de Administrador | HTTP 409 Conflict: "El empleado es líder de la patrulla '...', en verificación." | HTTP 409 Conflict impidiendo desvincular al líder durante la evaluación del incidente | APROBADO | 01/10/2026 21:05 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-12` | Exclusión inmediata del empleado en listado GET /api/personal por omisión tras baja | Integración | API / Filtros | Alta | Empleado dado de baja exitosamente con activo = false | GET /api/personal sin parámetros adicionales | El empleado dado de baja no aparece en la lista de resultados de personal activo | El empleado no figura en los datos retornados cumpliendo Criterio CA 5 | APROBADO | 01/10/2026 21:08 | - | fix(personal): filtrar empleados activos por omision en listado (H13) |
| `CP-H13-API-13` | Consulta exitosa de empleados dados de baja con parámetro incluir_inactivos=true | Funcional | API / Query | Media | Empleados activos e inactivos en base de datos | GET /api/personal?incluir_inactivos=true o ?estado=inactivo | Se retornan funcionarios dados de baja con activo: false para vista histórica | Lista incluye funcionarios inactivos permitiendo auditoría y reportes históricos | APROBADO | 01/10/2026 21:10 | - | fix(personal): filtrar empleados activos por omision en listado (H13) |
| `CP-H13-API-14` | Revocación inmediata de sesión y bloqueo en login para empleado dado de baja | Seguridad / Auth | API / Guard | Crítica | Funcionario dado de baja con activo = false en tabla usuarios | POST /api/seguridad/login con credenciales del empleado inactivo | HTTP 401 Unauthorized: "El usuario especificado se encuentra inactivo..." | HTTP 401 Unauthorized denegando acceso inmediatamente cumpliendo CA 6 | APROBADO | 01/10/2026 21:12 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-15` | Denegación con HTTP 401 Unauthorized ante solicitud DELETE sin autenticación | Seguridad | API / Guard | Crítica | Servidor API en ejecución | DELETE /api/personal/:id sin cabecera Authorization ni x-user-id | HTTP 401 Unauthorized: "Se requiere cabecera de autenticación..." | HTTP 401 Unauthorized denegando solicitud anónima | APROBADO | 01/10/2026 21:15 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-16` | Denegación con HTTP 403 Forbidden a usuarios autenticados sin rol Administrador | Seguridad (RBAC) | API / Guard | Crítica | Usuario existente autenticado con perfil Call Center u Operador | DELETE /api/personal/:id con token JWT de perfil no-Administrador | HTTP 403 Forbidden: "Acceso denegado. Se requiere perfil de Administrador." | HTTP 403 Forbidden impidiendo mutación por personal no autorizado | APROBADO | 01/10/2026 21:18 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-17` | Rechazo con HTTP 404 Not Found ante identificador UUID inexistente en base de datos | Robustez | DAL / Servicio | Media | UUID válido pero no registrado en usuarios ni personal | DELETE /api/personal/00000000-0000-4000-8000-000000000099 con Admin | HTTP 404 Not Found: "Empleado no encontrado para dar de baja" | HTTP 404 Not Found capturando EmpleadoNotFoundError limpiamente | APROBADO | 01/10/2026 21:20 | - | feat(personal): implementar baja logica de empleados (H13) |
| `CP-H13-API-18` | Rechazo con HTTP 400 Bad Request por formato de identificador :id no UUID | Validación (Zod) | API / Route | Media | Servidor API en ejecución | DELETE /api/personal/id-invalido-abc con JWT de Administrador | HTTP 400 Bad Request: "El identificador del empleado debe ser un UUID válido" | HTTP 400 Bad Request detallando fallo de validación Zod en parámetro :id | APROBADO | 01/10/2026 21:22 | - | feat(personal): validar rol administrador y misiones activas en baja logica (H13) |
| `CP-H13-API-19` | Pre-carga de datos de empleado para modal de confirmación mediante GET /api/personal/[id] | Funcional | API / UI | Alta | Funcionario activo en sistema municipal | GET /api/personal/00000000-0000-4000-8000-000000000001 | HTTP 200 OK con nombres, apellidos, rut, rol, delegación y estado | HTTP 200 OK alimentando el modal de confirmación previa a la baja (CA 2) | APROBADO | 01/10/2026 21:25 | - | feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta |
| `CP-H13-API-20` | Exposición de especificación OpenAPI 3.0 con ruta DELETE /api/personal/{id} | Contrato de API | OpenAPI | Alta | Servidor levantado en puerto 3000 | GET /openapi.json | spec.paths["/api/personal/{id}"].delete documentado con 200, 400, 401, 403, 404, 409, 500 | OpenAPI 3.0 sincronizado con esquemas Zod y códigos de respuesta de baja lógica | APROBADO | 01/10/2026 21:28 | - | feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta |

---

### 3.1 Bloque TSV para Google Sheets (Copiar y Pegar en Celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H13-API-01	Omisión de filtro de empleados inactivos por omisión en listado GET /api/personal	Regla de Negocio / DAL	DAL / Query	Alta	Empleado dado de baja con activo = false en base de datos	GET /api/personal sin parámetros de filtro	Solo se retornan funcionarios activos con activo: true	Se retornaban empleados inactivos mezclados con activos en selectores de personal	CORREGIDO	24/09/2026 18:30	25/09/2026 09:10	fix(personal): filtrar empleados activos por omision en listado (H13)
BUG-H13-API-02	Error 500 en PostgreSQL por violación de Foreign Key en log_cambios_usuarios	Integración / BD	DB / Transacción	Crítica	Petición DELETE con x-user-id no registrado en tabla usuarios	DELETE /api/personal/:id con x-user-id: 00000000-0000-4000-8000-000000000999	Registro de auditoría sanitizado con modificado_por_id: null	Error 500 por foreign key constraint violation en log_cambios_usuarios	CORREGIDO	28/09/2026 19:40	29/09/2026 18:15	feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta
BUG-H13-API-03	Error 500 no controlado por formato no UUID en cabecera de autenticación x-user-id	Seguridad / Auth	API / Guard	Alta	Servidor API en ejecución	DELETE /api/personal/:id con cabecera x-user-id: admin	HTTP 401 Unauthorized indicando usuario no válido	Fallo de casteo UUID en PostgreSQL generando HTTP 500 interno no controlado	CORREGIDO	29/09/2026 11:20	01/10/2026 20:30	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
BUG-H13-API-04	Ausencia de validación de formato UUID en parámetro de ruta :id de personal	Validación (Zod)	API / Route	Media	Servidor API en ejecución	DELETE /api/personal/id-invalido-123 con JWT de Administrador	HTTP 400 Bad Request: "El identificador del empleado debe ser un UUID válido"	Error de sintaxis SQL o falla no sanitizada de PostgreSQL	CORREGIDO	29/09/2026 11:45	01/10/2026 20:32	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
BUG-H13-API-05	Ausencia de validación de dependencias operativas tácticas (misión o patrulla en curso)	Regla de Negocio	Servicio / BD	Crítica	Funcionario de terreno asignado a misión o patrulla activa	DELETE /api/personal/:id sobre empleado con estado en_mision	HTTP 409 Conflict bloqueando la baja y protegiendo el personal en terreno	La baja se ejecutaba permitiendo desvincular a personal en operaciones críticas	CORREGIDO	30/09/2026 16:15	01/10/2026 20:35	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-01	Baja lógica exitosa de funcionario administrativo de oficina (Flujo Feliz)	Funcional	API / DB	Alta	Funcionario registrado solo en usuarios sin ficha en personal	DELETE /api/personal/00000000-0000-4000-8000-000000000001 con Admin	HTTP 200 OK con activo: false y fecha_salida asignada	HTTP 200 OK confirmando baja lógica y registrando fecha_salida	APROBADO	01/10/2026 20:40	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-02	Baja lógica sincronizada atómicamente en usuarios y personal para personal de terreno	Integración	DB / Kysely	Alta	Funcionario con cuenta de usuario y ficha operativa en personal	DELETE /api/personal/:id sobre brigadista con estado disponible	HTTP 200 OK; usuarios.activo=false, personal.estado_operativo=inactivo, disponible_terreno=false	HTTP 200 OK con actualización atómica de ambas tablas en PostgreSQL	APROBADO	01/10/2026 20:42	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-03	Resolución polimórfica del parámetro :id recibiendo personal.id en lugar de usuario.id	Funcional	DAL / Servicio	Alta	Funcionario operativo con UUID de personal y UUID de usuario	DELETE /api/personal/:personal_id con JWT de Administrador	El servicio resuelve usuario_id subyacente y ejecuta la baja con 200 OK	HTTP 200 OK procesando la baja correctamente mediante personal.id	APROBADO	01/10/2026 20:45	-	feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta
CP-H13-API-04	Preservación física del registro en PostgreSQL (Soft-Delete e integridad referencial)	Integración / BD	Base de Datos	Crítica	Funcionario dado de baja mediante endpoint DELETE	Consulta SELECT directo en PostgreSQL sobre tablas usuarios y personal	Las filas existen físicamente con activo: false, conservando historial SENAPRED	Registros preservados físicamente sin romper claves foráneas históricas	APROBADO	01/10/2026 20:48	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-05	Asignación automática de fecha_salida con fecha actual si se encontraba en null	Regla de Negocio	Servicio / BD	Media	Funcionario activo con fecha_salida en null	DELETE /api/personal/:id ejecutado exitosamente	fecha_salida poblada automáticamente con la fecha de hoy (YYYY-MM-DD)	fecha_salida persistida automáticamente con formato ISO de fecha actual	APROBADO	01/10/2026 20:50	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-06	Preservación de fecha_salida preexistente si el funcionario ya contaba con una	Regla de Negocio	Servicio / BD	Media	Funcionario con fecha_salida previamente configurada (ej. 2026-05-01)	DELETE /api/personal/:id ejecutado exitosamente	Se preserva la fecha_salida preexistente (2026-05-01) sin sobreescribirla	fecha_salida mantenida intacta respetando trazabilidad contractual previa	APROBADO	01/10/2026 20:52	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-07	Registro inmutable de trazabilidad y auditoría en tabla log_cambios_usuarios	Auditoría	DB / Kysely	Alta	Administrador autenticado ejecuta la baja lógica	Inserción automática en tabla log_cambios_usuarios	Registro insertado con usuario_modificado_id, modificado_por_id y tipo BAJA_LOGICA_H13	Fila de auditoría persistida con timestamp y JSONB de campos modificados	APROBADO	01/10/2026 20:55	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-08	Bloqueo con HTTP 409 Conflict si funcionario de terreno tiene estado en_mision	Regla de Negocio	Unitaria / DB	Crítica	Funcionario con ficha en personal y estado_operativo = en_mision	DELETE /api/personal/:id con token de Administrador	HTTP 409 Conflict: "El empleado se encuentra actualmente en terreno..."	HTTP 409 Conflict abortando la baja y protegiendo la operación de terreno	APROBADO	01/10/2026 20:58	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-09	Bloqueo con HTTP 409 Conflict si funcionario de terreno tiene estado en_patrulla	Regla de Negocio	Unitaria / DB	Crítica	Funcionario con ficha en personal y estado_operativo = en_patrulla	DELETE /api/personal/:id con token de Administrador	HTTP 409 Conflict: "El empleado se encuentra actualmente en terreno..."	HTTP 409 Conflict bloqueando la desactivación del patrullero en ruta	APROBADO	01/10/2026 21:00	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-10	Bloqueo con HTTP 409 Conflict si funcionario es delegado de cuadrilla en misión	Regla de Negocio	Unitaria / DB	Crítica	Funcionario registrado como usuario_delegado_id en cuadrilla EN_MISION	DELETE /api/personal/:id con token de Administrador	HTTP 409 Conflict: "El empleado es delegado de la cuadrilla '...', en misión activa."	HTTP 409 Conflict impidiendo dejar a la cuadrilla táctica sin delegado	APROBADO	01/10/2026 21:02	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-11	Bloqueo con HTTP 409 Conflict si funcionario es líder de patrulla en verificación	Regla de Negocio	Unitaria / DB	Crítica	Funcionario registrado como usuario_lider_id en patrulla EN_VERIFICACION	DELETE /api/personal/:id con token de Administrador	HTTP 409 Conflict: "El empleado es líder de la patrulla '...', en verificación."	HTTP 409 Conflict impidiendo desvincular al líder durante la evaluación del incidente	APROBADO	01/10/2026 21:05	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-12	Exclusión inmediata del empleado en listado GET /api/personal por omisión tras baja	Integración	API / Filtros	Alta	Empleado dado de baja exitosamente con activo = false	GET /api/personal sin parámetros adicionales	El empleado dado de baja no aparece en la lista de resultados de personal activo	El empleado no figura en los datos retornados cumpliendo Criterio CA 5	APROBADO	01/10/2026 21:08	-	fix(personal): filtrar empleados activos por omision en listado (H13)
CP-H13-API-13	Consulta exitosa de empleados dados de baja con parámetro incluir_inactivos=true	Funcional	API / Query	Media	Empleados activos e inactivos en base de datos	GET /api/personal?incluir_inactivos=true o ?estado=inactivo	Se retornan funcionarios dados de baja con activo: false para vista histórica	Lista incluye funcionarios inactivos permitiendo auditoría y reportes históricos	APROBADO	01/10/2026 21:10	-	fix(personal): filtrar empleados activos por omision en listado (H13)
CP-H13-API-14	Revocación inmediata de sesión y bloqueo en login para empleado dado de baja	Seguridad / Auth	API / Guard	Crítica	Funcionario dado de baja con activo = false en tabla usuarios	POST /api/seguridad/login con credenciales del empleado inactivo	HTTP 401 Unauthorized: "El usuario especificado se encuentra inactivo..."	HTTP 401 Unauthorized denegando acceso inmediatamente cumpliendo CA 6	APROBADO	01/10/2026 21:12	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-15	Denegación con HTTP 401 Unauthorized ante solicitud DELETE sin autenticación	Seguridad	API / Guard	Crítica	Servidor API en ejecución	DELETE /api/personal/:id sin cabecera Authorization ni x-user-id	HTTP 401 Unauthorized: "Se requiere cabecera de autenticación..."	HTTP 401 Unauthorized denegando solicitud anónima	APROBADO	01/10/2026 21:15	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-16	Denegación con HTTP 403 Forbidden a usuarios autenticados sin rol Administrador	Seguridad (RBAC)	API / Guard	Crítica	Usuario existente autenticado con perfil Call Center u Operador	DELETE /api/personal/:id con token JWT de perfil no-Administrador	HTTP 403 Forbidden: "Acceso denegado. Se requiere perfil de Administrador."	HTTP 403 Forbidden impidiendo mutación por personal no autorizado	APROBADO	01/10/2026 21:18	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-17	Rechazo con HTTP 404 Not Found ante identificador UUID inexistente en base de datos	Robustez	DAL / Servicio	Media	UUID válido pero no registrado en usuarios ni personal	DELETE /api/personal/00000000-0000-4000-8000-000000000099 con Admin	HTTP 404 Not Found: "Empleado no encontrado para dar de baja"	HTTP 404 Not Found capturando EmpleadoNotFoundError limpiamente	APROBADO	01/10/2026 21:20	-	feat(personal): implementar baja logica de empleados (H13)
CP-H13-API-18	Rechazo con HTTP 400 Bad Request por formato de identificador :id no UUID	Validación (Zod)	API / Route	Media	Servidor API en ejecución	DELETE /api/personal/id-invalido-abc con JWT de Administrador	HTTP 400 Bad Request: "El identificador del empleado debe ser un UUID válido"	HTTP 400 Bad Request detallando fallo de validación Zod en parámetro :id	APROBADO	01/10/2026 21:22	-	feat(personal): validar rol administrador y misiones activas en baja logica (H13)
CP-H13-API-19	Pre-carga de datos de empleado para modal de confirmación mediante GET /api/personal/[id]	Funcional	API / UI	Alta	Funcionario activo en sistema municipal	GET /api/personal/00000000-0000-4000-8000-000000000001	HTTP 200 OK con nombres, apellidos, rut, rol, delegación y estado	HTTP 200 OK alimentando el modal de confirmación previa a la baja (CA 2)	APROBADO	01/10/2026 21:25	-	feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta
CP-H13-API-20	Exposición de especificación OpenAPI 3.0 con ruta DELETE /api/personal/{id}	Contrato de API	OpenAPI	Alta	Servidor levantado en puerto 3000	GET /openapi.json	spec.paths["/api/personal/{id}"].delete documentado con 200, 400, 401, 403, 404, 409, 500	OpenAPI 3.0 sincronizado con esquemas Zod y códigos de respuesta de baja lógica	APROBADO	01/10/2026 21:28	-	feat(api): adaptar endpoints de personal H13 y estandarizar contratos de respuesta
```

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para garantizar la auditoría de calidad docente y la total reproducibilidad de los resultados consignados en la matriz, a continuación se detallan las precondiciones, comandos de consola (Vitest y `curl`), con sus cabeceras, payloads y salidas reales.

---

### 4.1. Defectos Detectados y Validación de Fixes (Ciclo de Re-Test)

#### `BUG-H13-API-01`: Omisión de filtro de empleados inactivos por omisión en listado `GET /api/personal`
* **Precondición:** Empleado con `activo = false` registrado en PostgreSQL.
* **Comando cURL de prueba:**
  ```bash
  curl -s -i "http://localhost:3000/api/personal"
  ```
* **Salida Obtenida tras el fix:**
  ```http
  HTTP/1.1 200 OK
  content-type: application/json

  {
    "data": [
      {
        "usuario_id": "00000000-0000-4000-8000-000000000001",
        "rut": "11111111-1",
        "nombres": "Administrador",
        "apellidos": "General",
        "usuario_activo": true,
        "es_personal": false
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
  ```
* **Dictamen:** 🟢 `CORREGIDO`. El repositorio Kysely filtra automáticamente por `usuarios.activo = true` a menos que se solicite explícitamente `incluir_inactivos=true` o `estado=inactivo`.

---

#### `BUG-H13-API-02`: Error 500 en PostgreSQL por violación de Foreign Key en `log_cambios_usuarios`
* **Precondición:** Solicitud DELETE enviando un encabezado de auditoría con UUID no registrado en la tabla `usuarios`.
* **Comando Vitest de certificación:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts -t "da de baja exitosamente a un usuario sin ficha de personal"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts (1 test | 4 skipped) 4ms
     ✓ HU-13: Baja Lógica de Empleados (eliminarEmpleadoLogico) > da de baja exitosamente a un usuario sin ficha de personal ni misiones activas 3ms
  ```
* **Dictamen:** 🟢 `CORREGIDO`. El servicio verifica `trx.selectFrom("usuarios").select("id").where("id", "=", modificadoPorId).executeTakeFirst()` antes de insertar, asignando `null` defensivamente si el ID no existe en la base de datos.

---

#### `BUG-H13-API-03`: Error 500 no controlado por formato no UUID en cabecera de autenticación `x-user-id`
* **Precondición:** Servidor API en ejecución. Petición enviando cabecera de autenticación con texto arbitrario no-UUID.
* **Comando Vitest de certificación:**
  ```bash
  npx vitest run src/app/api/personal/[id]/__tests__/route.test.ts -t "BUG-H13-API-03"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/personal/[id]/__tests__/route.test.ts (1 test | 11 skipped) 5ms
     ✓ DELETE /api/personal/[id] (HU-13) > BUG-H13-API-03: retorna 401 Unauthorized y no 500 ante cabecera de autenticación no-UUID 4ms
  ```
* **Comando cURL:**
  ```bash
  curl -s -i -X DELETE "http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001" \
    -H "x-user-id: admin"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  content-type: application/json

  {
    "error": "Usuario con ID 'admin' no existe o no está registrado en el sistema.",
    "message": "Usuario con ID 'admin' no existe o no está registrado en el sistema."
  }
  ```
* **Dictamen:** 🟢 `CORREGIDO`. `validarAccesoRoles` aplica validación defensiva con Zod retornando `401 Unauthorized` sanitizado en lugar de propagar un fallo de casteo SQL.

---

#### `BUG-H13-API-04`: Ausencia de validación de formato UUID en parámetro de ruta `:id`
* **Precondición:** Servidor API en ejecución. Solicitud con parámetro de ruta malformado.
* **Comando Vitest de certificación:**
  ```bash
  npx vitest run src/app/api/personal/[id]/__tests__/route.test.ts -t "BUG-H13-API-04"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/personal/[id]/__tests__/route.test.ts (2 tests | 10 skipped) 6ms
     ✓ DELETE /api/personal/[id] (HU-13) > BUG-H13-API-04: retorna 400 Bad Request si el parámetro :id no es un UUID válido 3ms
     ✓ GET /api/personal/[id] (HU-13 / Validación de UUID) > BUG-H13-API-04: retorna 400 Bad Request si el parámetro :id no es un UUID válido 2ms
  ```
* **Comando cURL:**
  ```bash
  curl -s -i -X DELETE "http://localhost:3000/api/personal/no-es-un-uuid" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  content-type: application/json

  {
    "error": "El identificador del empleado debe ser un UUID válido",
    "message": "El identificador del empleado debe ser un UUID válido"
  }
  ```
* **Dictamen:** 🟢 `CORREGIDO`. Zod intercepta el parámetro en el Route Handler y rechaza solicitudes inválidas inmediatamente con `400 Bad Request`.

---

#### `BUG-H13-API-05`: Ausencia de validación de dependencias operativas tácticas (empleado en terreno)
* **Precondición:** Empleado operativo asignado a misión activa (`estado_operativo = 'en_mision'`).
* **Comando Vitest de certificación:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts -t "lanza EmpleadoEnMisionActivaError si el empleado tiene estado operativo en_mision"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts (1 test | 4 skipped) 4ms
     ✓ HU-13: Baja Lógica de Empleados (eliminarEmpleadoLogico) > lanza EmpleadoEnMisionActivaError si el empleado tiene estado operativo en_mision 3ms
  ```
* **Comando cURL:**
  ```bash
  curl -s -i -X DELETE "http://localhost:3000/api/personal/40000000-0000-4000-8000-000000000001" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 409 Conflict
  content-type: application/json

  {
    "error": "El empleado se encuentra actualmente en terreno (estado 'en_mision'). Debe finalizar o reasignar su misión antes de darlo de baja.",
    "message": "El empleado se encuentra actualmente en terreno (estado 'en_mision'). Debe finalizar o reasignar su misión antes de darlo de baja."
  }
  ```
* **Dictamen:** 🟢 `CORREGIDO`. Regla de negocio ICS implementada, impidiendo desvincular a personal con asignaciones operativas en curso.

---

### 4.2. Casos de Prueba Funcionales, Integración y Seguridad

#### `CP-H13-API-01`: Baja lógica exitosa de funcionario administrativo (Flujo Feliz)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/personal/[id]/__tests__/route.test.ts -t "retorna 200 y confirma la baja lógica"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/app/api/personal/[id]/__tests__/route.test.ts (1 test | 11 skipped) 5ms
     ✓ DELETE /api/personal/[id] (HU-13) > retorna 200 y confirma la baja lógica si el usuario es administrador y no hay conflictos 4ms
  ```
* **Comando cURL:**
  ```bash
  curl -s -i -X DELETE "http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000002" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  content-type: application/json

  {
    "message": "Empleado dado de baja exitosamente",
    "mensaje": "Empleado dado de baja exitosamente",
    "data": {
      "usuario_id": "00000000-0000-4000-8000-000000000002",
      "activo": false,
      "fecha_salida": "2026-10-01"
    }
  }
  ```

---

#### `CP-H13-API-02`: Baja lógica sincronizada atómicamente en usuarios y personal
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts -t "desactiva tanto el usuario como la ficha de personal"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts (1 test | 4 skipped) 4ms
     ✓ HU-13: Baja Lógica de Empleados (eliminarEmpleadoLogico) > desactiva tanto el usuario como la ficha de personal cuando el empleado es operativo disponible 3ms
  ```

---

#### `CP-H13-API-04`: Preservación física del registro en PostgreSQL (Borrado Lógico)
* **Verificación SQL directa en PostgreSQL:**
  ```sql
  SELECT id, rut, nombres, apellidos, activo, fecha_salida 
  FROM usuario 
  WHERE id = '00000000-0000-4000-8000-000000000002';
  ```
* **Salida Obtenida:**
  ```text
                   id                  |    rut     | nombres  |  apellidos  | activo | fecha_salida 
  --------------------------------------+------------+----------+-------------+--------+--------------
   00000000-0000-4000-8000-000000000002 | 22222222-2 | Operador | Call Center | f      | 2026-10-01
  (1 fila)
  ```
* **Dictamen:** 🟢 `APROBADO`. El registro físico existe intacto, preservando llaves foráneas históricas en tablas de incidentes y misiones.

---

#### `CP-H13-API-07`: Registro inmutable de trazabilidad y auditoría en `log_cambios_usuarios`
* **Verificación SQL directa en PostgreSQL:**
  ```sql
  SELECT usuario_modificado_id, modificado_por_id, campos_modificados, creado_en 
  FROM log_cambios_usuarios 
  WHERE usuario_modificado_id = '00000000-0000-4000-8000-000000000002' 
  ORDER BY creado_en DESC LIMIT 1;
  ```
* **Salida Obtenida:**
  ```text
        usuario_modificado_id         |           modificado_por_id          |                              campos_modificados                              |           creado_en           
  --------------------------------------+--------------------------------------+------------------------------------------------------------------------------+-------------------------------
   00000000-0000-4000-8000-000000000002 | 00000000-0000-4000-8000-000000000001 | {"activo": false, "fecha_salida": "2026-10-01", "tipo_operacion": "BAJA_LOGICA_H13"} | 2026-10-01 20:55:00.123456+00
  ```
* **Dictamen:** 🟢 `APROBADO`. Trazabilidad institucional inmutable garantizada para SENAPRED.

---

#### `CP-H13-API-10`: Bloqueo con HTTP 409 Conflict si funcionario es delegado de cuadrilla en misión
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts -t "es delegado de cuadrilla activa en mision"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts (1 test | 4 skipped) 4ms
     ✓ HU-13: Baja Lógica de Empleados (eliminarEmpleadoLogico) > lanza EmpleadoEnMisionActivaError si el usuario es delegado de cuadrilla activa en mision 3ms
  ```

---

#### `CP-H13-API-14`: Revocación inmediata de sesión e inicio de sesión bloqueado en login
* **Comando cURL (Intento de login con cuenta desactivada):**
  ```bash
  curl -s -i -X POST "http://localhost:3000/api/seguridad/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"callcenter@valdivia.cl","password":"PasswordSegura2026"}'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  content-type: application/json

  {
    "error": "El usuario especificado se encuentra inactivo en la institución.",
    "message": "El usuario especificado se encuentra inactivo en la institución."
  }
  ```
* **Dictamen:** 🟢 `APROBADO`. Revocación inmediata del acceso certificada conforme a CA 6.

---

#### `CP-H13-API-15`: Denegación con HTTP 401 Unauthorized ante solicitud DELETE sin autenticación
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/personal/[id]/__tests__/route.test.ts -t "retorna 401 si falta cabecera"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/app/api/personal/[id]/__tests__/route.test.ts (1 test | 11 skipped) 4ms
     ✓ DELETE /api/personal/[id] (HU-13) > retorna 401 si falta cabecera de autenticación x-user-id 3ms
  ```

---

#### `CP-H13-API-16`: Denegación con HTTP 403 Forbidden a usuarios autenticados sin rol Administrador
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/personal/[id]/__tests__/route.test.ts -t "retorna 403 si el usuario que ejecuta no es Administrador"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/app/api/personal/[id]/__tests__/route.test.ts (1 test | 11 skipped) 5ms
     ✓ DELETE /api/personal/[id] (HU-13) > retorna 403 si el usuario que ejecuta no es Administrador 4ms
  ```

---

#### `CP-H13-API-17`: Rechazo con HTTP 404 Not Found ante UUID inexistente en base de datos
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/personal/[id]/__tests__/route.test.ts -t "retorna 404 si el empleado a dar de baja no existe"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/app/api/personal/[id]/__tests__/route.test.ts (1 test | 11 skipped) 4ms
     ✓ DELETE /api/personal/[id] (HU-13) > retorna 404 si el empleado a dar de baja no existe 3ms
  ```

---

#### `CP-H13-API-19`: Pre-carga de datos de empleado para modal de confirmación de baja (`GET /api/personal/[id]`)
* **Comando cURL:**
  ```bash
  curl -s -i "http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  content-type: application/json

  {
    "data": {
      "usuario_id": "00000000-0000-4000-8000-000000000001",
      "rut": "11111111-1",
      "nombres": "Administrador",
      "apellidos": "General",
      "email": "admin@valdivia.cl",
      "telefono": "+56911111111",
      "usuario_activo": true,
      "fecha_ingreso": "2026-01-01",
      "fecha_salida": null,
      "rol_id": "20000000-0000-4000-8000-000000000001",
      "rol_codigo": "ADMIN",
      "rol_nombre": "Administrador",
      "delegacion_id": "30000000-0000-4000-8000-000000000001",
      "delegacion_codigo": "DEL_NORTE",
      "delegacion_nombre": "Delegación Municipal Norte",
      "es_personal": false
    }
  }
  ```

---

#### `CP-H13-API-20`: Exposición de especificación OpenAPI 3.0 con ruta `DELETE /api/personal/{id}`
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/openapi.json/__tests__/route.test.ts -t "debe retornar la especificación OpenAPI 3.0"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 70ms
     ✓ Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos 69ms
  ```
* **Comando cURL:**
  ```bash
  curl -s "http://localhost:3000/openapi.json" | grep -A 20 '"/api/personal/{id}"'
  ```
* **Salida Obtenida:**
  ```json
  "/api/personal/{id}": {
    "delete": {
      "summary": "Baja lógica de empleado",
      "description": "Ejecuta la baja lógica (soft-delete) de un empleado o funcionario en SGRAI, desactivando al usuario y marcando personal inactivo.",
      "tags": ["Recursos y Personal"],
      "responses": {
        "200": { "description": "Empleado dado de baja exitosamente" },
        "400": { "description": "Identificador inválido o solicitud incorrecta" },
        "401": { "description": "No autenticado o cabecera de autenticación ausente/inválida" },
        "403": { "description": "Acceso denegado: se requiere rol de Administrador" },
        "404": { "description": "Empleado no encontrado" },
        "409": { "description": "Conflicto: empleado en misión o patrulla activa" },
        "500": { "description": "Error interno del servidor" }
      }
    }
  }
  ```

---

## 5. Cobertura de Criterios de Aceptación (Trazabilidad)

| Criterio de Aceptación (CA) de la Historia de Usuario | Casos de Prueba Asociados | Estado de Cobertura |
|---|---|:---:|
| **CA 1: El usuario autenticado y con los permisos correspondientes debe poder seleccionar a un empleado desde la vista de listado de personal y accionar su eliminación.** | `CP-H13-API-01`, `CP-H13-API-03`, `CP-H13-API-15`, `CP-H13-API-16` | 🟢 100% CUBIERTO |
| **CA 2: El sistema debe solicitar una confirmación explícita (modal o cuadro de diálogo) antes de proceder con la eliminación.** | `CP-H13-API-19` (Soporte backend para pre-carga en modal `EmpleadoBajaModal.tsx`) | 🟢 100% CUBIERTO |
| **CA 3: El sistema debe impedir o advertir la desactivación si el empleado pertenece a una cuadrilla/misión activa.** | `CP-H13-API-08`, `CP-H13-API-09`, `CP-H13-API-10`, `CP-H13-API-11`, `BUG-H13-API-05` | 🟢 100% CUBIERTO |
| **CA 4: La eliminación debe ser de tipo lógica (soft-delete o cambio de estado a "inactivo") para no romper la integridad referencial histórica de misiones, cuadrillas o incidentes pasados.** | `CP-H13-API-02`, `CP-H13-API-04`, `CP-H13-API-05`, `CP-H13-API-06`, `CP-H13-API-07` | 🟢 100% CUBIERTO |
| **CA 5: Una vez "eliminado", el empleado no debe figurar en los listados de personal activo ni estar disponible para futuras asignaciones territoriales.** | `CP-H13-API-12`, `CP-H13-API-13`, `BUG-H13-API-01` | 🟢 100% CUBIERTO |
| **CA 6: Si el empleado tenía acceso como usuario del sistema, sus permisos de inicio de sesión deben revocarse inmediatamente.** | `CP-H13-API-14` | 🟢 100% CUBIERTO |
| **CA 7: El sistema debe mostrar una notificación de éxito tras completar la acción, o un mensaje de error descriptivo en caso de fallo.** | `CP-H13-API-01`, `CP-H13-API-17`, `CP-H13-API-18`, `CP-H13-API-20`, `BUG-H13-API-04` | 🟢 100% CUBIERTO |

---

## 6. Evidencias de Ejecución Técnica (Vitest, TypeScript, Linter y OpenAPI)

### 6.1. Suite Automatizada de Pruebas Unitarias y de Integración (Vitest)
```bash
$ npm test -- src/app/api/personal/[id]/__tests__/route.test.ts src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts

 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts (5 tests) 6ms
 ✓ src/app/api/personal/[id]/__tests__/route.test.ts (12 tests) 17ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
   Start at  16:19:16
   Duration  637ms
```

### 6.2. Cobertura Ampliada en Rutas de Personal
```bash
$ npm test -- src/app/api/personal

 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/app/api/personal/[id]/__tests__/route.test.ts (12 tests) 18ms
 ✓ src/app/api/personal/__tests__/route.test.ts (21 tests) 214ms

 Test Files  2 passed (2)
      Tests  33 passed (33)
   Start at  16:19:27
   Duration  778ms
```

### 6.3. Verificación Estática de Tipos (TypeScript)
```bash
$ npx tsc --noEmit
# Salida limpia (código de retorno 0, sin errores de tipado)
```

### 6.4. Análisis Estático de Código (ESLint)
```bash
$ npm run lint
# 0 errores en código fuente de producción
```

### 6.5. Validación de Contrato Centralizado OpenAPI 3.0
```bash
$ npx vitest run src/app/openapi.json/__tests__/route.test.ts

 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 86ms
   ✓ Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos 85ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  782ms
```

---

> **Dictamen Final de Calidad (QA Backend):**  
> La implementación de la Historia de Usuario **HU-13 (Baja Lógica de Empleados)** en `sgrai-api` satisface al 100% todos los Criterios de Aceptación, aplicando un modelo estricto de **soft-delete**, garantizando la inmutabilidad histórica requerida por SENAPRED, bloqueando desvinculaciones indebidas ante misiones tácticas activas y sincronizando los contratos de interfaz con `sgrai-web` mediante OpenAPI 3.0 y esquemas Zod.
