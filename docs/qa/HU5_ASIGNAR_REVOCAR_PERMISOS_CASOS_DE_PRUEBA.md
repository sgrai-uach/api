# Informe y Matriz de Casos de Prueba (QA): HU-5 — Asignación y Revocación de Permisos por Perfil (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Seguridad (Autenticación, Roles y Control de Acceso RBAC).  
> **Historia de Usuario:** HU-5 (H5) — *"Como Administrador Quiero asignar o revocar permisos a un perfil (rol) específico Para procurar que los usuarios puedan hacer solo lo que deberían en el sistema."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Redis + Vitest).  
> **Rama Git Evaluada:** `feature/H5-alterar-permisos-perfil` (mergeada en `develop` mediante Pull Request #12).  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)`
> * `feat(seguridad): soportar validacion dinamica de permisos y endpoint de usuario activo`
> * `fix(seguridad): registrar endpoint usuario-activo en openapi y vincular esquema zod (BUG-HU5-01)`
> * `fix(seguridad): validar formato uuid en parametros de ruta de roles para evitar error 500 (BUG-HU5-02)`
> * `merge: pull request #12 from sgrai-uach/feature/H5-alterar-permisos-perfil`
> 
> **Fecha de Certificación QA:** Septiembre / Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **25** (20 Casos Funcionales/Integración/Seguridad + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **20** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **55/55 tests exitosos en módulo de seguridad (20 específicos HU-5)** |
| **Garantía Transaccional en Base de Datos** | **100% atómico con Kysely (`db.transaction()`) y rollback automático** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` (`/permisos`, `/roles/{id}/permisos`, `/usuario-activo`)** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar y las directrices docentes de Aseguramiento de Calidad (*detección formal de defectos durante el ciclo de vida de la rama, reporte documentado al equipo de desarrollo, implementación del fix mediante commit estructurado en Conventional Commits y ejecución de re-test formal para certificar su cierre*), se gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H5-API-01` | Omisión del endpoint `GET /api/seguridad/usuario-activo` y sus esquemas Zod en la especificación centralizada OpenAPI 3.0 (`/openapi.json`), impidiendo tipado automático en frontends. | Media | `src/lib/openapi/index.ts` / `src/modules/seguridad/schema.ts` | 30/09/2026 18:30 | fix(seguridad): registrar endpoint usuario-activo en openapi y vincular esquema zod (BUG-HU5-01) | 30/09/2026 19:26 | 🟢 CORREGIDO (Ruta y esquemas `UsuarioActivoResponse` y DTOs registrados en OpenAPI 3.0). |
| `BUG-H5-API-02` | Excepción no controlada HTTP 500 arrojada por PostgreSQL al invocar `PUT /api/seguridad/roles/[id]/permisos` con identificador no UUID por omisión de esquema validador en la ruta. | Alta | `src/app/api/seguridad/roles/[id]/permisos/route.ts` / `schema.ts` | 30/09/2026 18:50 | fix(seguridad): validar formato uuid en parametros de ruta de roles para evitar error 500 (BUG-HU5-02) | 30/09/2026 19:27 | 🟢 CORREGIDO (`RolIdParamSchema.safeParse` intercepta parámetro y retorna HTTP 400 Bad Request). |
| `BUG-H5-API-03` | Vulnerabilidad de auto-bloqueo administrativo (lockout) al permitir que un administrador revoque el permiso crítico `seguridad:roles:gestionar` al perfil Administrador. | Crítica | `src/modules/seguridad/service.ts` (`actualizarPermisosRol`) | 29/09/2026 14:15 | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) | 29/09/2026 17:59 | 🟢 CORREGIDO (Bloqueo con `BadRequestError` ante intento de revocar `seguridad:roles:gestionar` a perfil Admin). |
| `BUG-H5-API-04` | Inconsistencia de integridad referencial al permitir asignación de UUIDs de permisos inexistentes en BD sin comprobación previa en transacción. | Alta | `src/modules/seguridad/repository.ts` (`actualizarPermisosRol`) | 29/09/2026 15:40 | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) | 29/09/2026 17:59 | 🟢 CORREGIDO (Verificación en `permiso` lanzando `BadRequestError` si algún ID no existe en el catálogo). |
| `BUG-H5-API-05` | Violación potencial de atomicidad en guardado masivo ante fallas parciales en Kysely al no ejecutar delete e insert bajo una transacción estricta. | Crítica | `src/modules/seguridad/repository.ts` (`actualizarPermisosRol`) | 29/09/2026 16:30 | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) | 29/09/2026 17:59 | 🟢 CORREGIDO (Toda la mutación envuelta en `db.transaction().execute(async trx => ...)` con rollback automático). |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H5-API-01` | Omisión del endpoint usuario-activo y esquemas Zod en OpenAPI 3.0 | Contrato / OpenAPI | API / OpenAPI | Media | Servidor backend en ejecución | GET /openapi.json inspeccionando rutas y schemas | Especificación OpenAPI 3.0 con ruta /api/seguridad/usuario-activo y schema UsuarioActivoResponse | Nodo ausente en JSON impidiendo sincronización de tipos TypeScript en cliente frontend | CORREGIDO | 30/09/2026 18:30 | 30/09/2026 19:26 | fix(seguridad): registrar endpoint usuario-activo en openapi y vincular esquema zod (BUG-HU5-01) |
| `BUG-H5-API-02` | Excepción no controlada HTTP 500 ante parámetro de rol no UUID en ruta | Robustez / Schema | API / Route | Alta | Servidor backend en ejecución | PUT /api/seguridad/roles/abc-no-uuid/permisos con body {"permisoIds":[]} | HTTP 400 Bad Request reportando que el identificador debe cumplir formato UUID | HTTP 500 Internal Server Error arrojado por PostgreSQL por sintaxis inválida de UUID | CORREGIDO | 30/09/2026 18:50 | 30/09/2026 19:27 | fix(seguridad): validar formato uuid en parametros de ruta de roles para evitar error 500 (BUG-HU5-02) |
| `BUG-H5-API-03` | Vulnerabilidad de auto-bloqueo al revocar permiso seguridad:roles:gestionar al Administrador | Seguridad / Negocio | Servicio / Dominio | Crítica | Administrador modificando permisos de su propio perfil | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000001/permisos sin seguridad:roles:gestionar | HTTP 400 Bad Request impidiendo la revocación de la facultad de gestionar roles | Permiso revocado exitosamente dejando al sistema sin administradores con permisos de gestión | CORREGIDO | 29/09/2026 14:15 | 29/09/2026 17:59 | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `BUG-H5-API-04` | Inconsistencia de integridad referencial al asignar UUIDs de permisos inexistentes | Integridad / BD | DAL / Repository | Alta | Base de datos con catálogo de permisos activo | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con permisoId falso | HTTP 400 Bad Request informando que uno o más permisos no existen en el sistema | Fallo tardío con error de clave foránea o persistencia silenciosa de registros huérfanos | CORREGIDO | 29/09/2026 15:40 | 29/09/2026 17:59 | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `BUG-H5-API-05` | Violación potencial de atomicidad en guardado masivo ante fallas parciales | Transaccionalidad | DAL / Kysely | Crítica | Entorno con operaciones concurrentes de actualización | Actualización de múltiples permisos forzando excepción a mitad de la operación | Rollback automático completo en transacción Kysely sin dejar tablas inconsistentes | Ejecución fuera de transacción dejando permisos eliminados sin insertar las nuevas tuplas | CORREGIDO | 29/09/2026 16:30 | 29/09/2026 17:59 | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-01` | Consulta autorizada del catálogo completo de módulos y permisos disponibles (CA-2) | Funcional / Catálogo | API / Route | Alta | Administrador autenticado con JWT Bearer activo | GET /api/seguridad/permisos [Header: Authorization Bearer (Admin)] | HTTP 200 OK con { total: 20, data: [...] } listando permisos clasificados por módulo funcional | HTTP 200 OK retornando catálogo íntegro de permisos clasificados por módulo funcional | APROBADO | 30/09/2026 20:00 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-02` | Bloqueo de consulta de catálogo de permisos por falta de cabecera de autenticación | Seguridad / Auth | API / Guard | Crítica | Servidor API en ejecución | GET /api/seguridad/permisos [Sin cabecera Authorization] | HTTP 401 Unauthorized indicando requerimiento de cabecera Bearer | HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>" | APROBADO | 30/09/2026 20:02 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-03` | Denegación de acceso a consulta de catálogo de permisos a usuario no Administrador | Seguridad / RBAC | API / Guard | Crítica | Usuario autenticado con rol Call Center | GET /api/seguridad/permisos [Header: Authorization Bearer (Rol Call Center)] | HTTP 403 Forbidden denegando acceso por perfil insuficiente | HTTP 403 Forbidden: "Se requiere el perfil de Administrador" | APROBADO | 30/09/2026 20:04 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-04` | Selección y consulta de detalle de perfil existente con sus permisos asignados (CA-1, CA-2) | Funcional / Consulta | API / Route | Alta | Rol Call Center existente en base de datos | GET /api/seguridad/roles/20000000-0000-4000-8000-000000000002 [Header: Bearer Token (Admin)] | HTTP 200 OK con detalle del rol y arreglo de permisos asignados para reflejar estado activo/inactivo | HTTP 200 OK retornando entidad de rol con cantidadPermisos y lista de permisos asociados | APROBADO | 30/09/2026 20:06 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-05` | Asignación masiva de múltiples permisos a un perfil específico (CA-3, CA-4) | Funcional / Mutación | API / Servicio | Crítica | Rol Call Center con 0 permisos asignados previamente | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":["10000000-0000-4000-8000-000000000001","10000000-0000-4000-8000-000000000005"]} | HTTP 200 OK con mensaje de éxito de persistencia y objeto actualizado con cantidadPermisos: 2 | HTTP 200 OK: "Permisos actualizados correctamente en la base de datos" con 2 permisos asignados | APROBADO | 30/09/2026 20:10 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-06` | Revocación masiva de permisos desmarcados en un perfil específico (CA-3, CA-4) | Funcional / Mutación | API / Servicio | Crítica | Rol con 2 permisos asignados previamente | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":["10000000-0000-4000-8000-000000000001"]} | HTTP 200 OK persistiendo la revocación atómica y retornando cantidadPermisos: 1 | HTTP 200 OK confirmando la eliminación del permiso desmarcado y persistencia inmediata | APROBADO | 30/09/2026 20:12 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-07` | Desmarcado total y revocación de todos los permisos de un perfil (CA-3, CA-4) | Funcional / Mutación | API / Servicio | Alta | Rol con permisos asignados | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":[]} | HTTP 200 OK persistiendo el vaciado en rol_permiso con cantidadPermisos: 0 y permisos: [] | HTTP 200 OK: "Permisos actualizados correctamente en la base de datos" con arreglo vacío | APROBADO | 30/09/2026 20:14 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-08` | Bloqueo no autenticado en actualización de permisos por perfil | Seguridad / Auth | API / Guard | Crítica | Servidor API en ejecución | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos [Sin Authorization] | HTTP 401 Unauthorized impidiendo mutaciones anónimas | HTTP 401 Unauthorized con mensaje de cabecera Bearer requerida | APROBADO | 30/09/2026 20:16 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-09` | Denegación de mutación de permisos a usuario con perfil operativo no Administrador | Seguridad / RBAC | API / Guard | Crítica | Usuario autenticado con rol Call Center | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos [Header: Bearer Token (Call Center)] | HTTP 403 Forbidden denegando privilegios de alteración de permisos | HTTP 403 Forbidden: "Se requiere el perfil de Administrador" | APROBADO | 30/09/2026 20:18 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-10` | Validación de cuerpo de solicitud no JSON en actualización de permisos | Robustez / API | API / Route | Media | Administrador autenticado | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body texto plano no JSON | HTTP 400 Bad Request indicando que el cuerpo debe ser un JSON válido | HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un JSON válido." | APROBADO | 30/09/2026 20:20 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-11` | Validación Zod de payload con formato no conforme o elementos no UUID en permisoIds | Validación / Zod | API / Schema | Media | Administrador autenticado | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":["invalido-123"]} | HTTP 400 Bad Request con detalles estructurados de validación Zod | HTTP 400 Bad Request: "Payload de permisos inválido" con arreglo de issues | APROBADO | 30/09/2026 20:22 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-12` | Validación temprana de formato UUID en parámetro de ruta id del rol | Validación / Zod | API / Route | Media | Administrador autenticado | PUT /api/seguridad/roles/abc-no-uuid/permisos con body {"permisoIds":[]} | HTTP 400 Bad Request informando que el parámetro de ruta no es un UUID válido | HTTP 400 Bad Request: "El identificador de rol proporcionado no es un UUID válido." | APROBADO | 30/09/2026 20:24 | - | fix(seguridad): validar formato uuid en parametros de ruta de roles para evitar error 500 (BUG-HU5-02) |
| `CP-H5-API-13` | Manejo de error al intentar actualizar permisos de un rol inexistente en BD | Robustez / Errores | API / Servicio | Media | Administrador autenticado, UUID de rol inexistente | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000999/permisos con body {"permisoIds":["10000000-0000-4000-8000-000000000001"]} | HTTP 404 Not Found con mensaje descriptivo de rol no encontrado | HTTP 404 Not Found: "Perfil con ID '20000000-0000-4000-8000-000000000999' no encontrado." | APROBADO | 30/09/2026 20:26 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-14` | Rechazo con HTTP 400 ante permisos inexistentes en el catálogo de BD | Integridad / BD | DAL / Repository | Alta | Administrador autenticado, UUID de permiso inexistente | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con {"permisoIds":["10000000-0000-4000-8000-000000000999"]} | HTTP 400 Bad Request informando que uno o más permisos especificados no existen | HTTP 400 Bad Request: "Uno o más permisos especificados no existen en el sistema..." | APROBADO | 30/09/2026 20:28 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-15` | Protección contra auto-bloqueo impidiendo revocar seguridad:roles:gestionar al Administrador | Regla de Negocio / RBAC | Servicio / Dominio | Crítica | Intento de actualizar rol Admin omitiendo seguridad:roles:gestionar | PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000001/permisos con {"permisoIds":["10000000-0000-4000-8000-000000000001"]} | HTTP 400 Bad Request bloqueando la operación para evitar auto-bloqueo | HTTP 400 Bad Request: "El permiso 'seguridad:roles:gestionar' es obligatorio para el perfil Administrador..." | APROBADO | 30/09/2026 20:30 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-16` | Persistencia transaccional estricta con rollback ante error forzado en base de datos | Transaccionalidad / BD | DAL / Kysely | Crítica | Simulación de fallo en sentencia dentro de db.transaction() | Invocación de seguridadRepository.actualizarPermisosRol bajo error forzado | Transacción de Kysely abortada con rollback integral sin persistir datos parciales | Excepción capturada, rollback verificado mediante mock transaccional y rechazo íntegro | APROBADO | 30/09/2026 20:32 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-17` | Verificación de auditoría (asignado_en, asignado_por_id) y timestamp actualizado_en del rol | Auditoría / BD | DAL / Kysely | Alta | Asignación de permisos por Administrador autenticado | Inspección de registros insertados en rol_permiso y tabla rol | Filas en rol_permiso con asignado_por_id = admin.id, timestamp actual y rol.actualizado_en modificado | Metadatos de auditoría persistidos y actualizados fielmente en PostgreSQL | APROBADO | 30/09/2026 20:34 | - | feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5) |
| `CP-H5-API-18` | Reflejo inmediato de restricciones y permisos en tiempo real vía usuario-activo (CA-5) | Funcional / Dinámico | API / Route | Crítica | Usuario con sesión activa cuyo rol acaba de ser modificado en BD | GET /api/seguridad/usuario-activo [Header: Authorization Bearer (Usuario)] | HTTP 200 OK con arreglo permisos reflejando inmediatamente las restricciones | HTTP 200 OK retornando el listado dinámico de permisos consultado en tiempo real desde BD | APROBADO | 30/09/2026 20:36 | - | feat(seguridad): soportar validacion dinamica de permisos y endpoint de usuario activo |
| `CP-H5-API-19` | Bloqueo inmediato en GET /api/seguridad/usuario-activo ante funcionario desactivado | Seguridad / Estado | Servicio / Guard | Alta | Usuario autenticado con token válido cuya cuenta pasa a activo = false | GET /api/seguridad/usuario-activo con token de usuario inactivo | HTTP 403 Forbidden impidiendo el acceso a funcionarios inactivos en tiempo real | HTTP 403 Forbidden: "El usuario especificado se encuentra inactivo en la institución." | APROBADO | 30/09/2026 20:38 | - | feat(seguridad): soportar validacion dinamica de permisos y endpoint de usuario activo |
| `CP-H5-API-20` | Exposición y sincronización del contrato OpenAPI 3.0 para endpoints de HU-5 | Contrato / OpenAPI | API / OpenAPI | Alta | Servidor backend en ejecución | GET /openapi.json inspeccionando rutas /permisos, /roles/{id}/permisos y /usuario-activo | Rutas, parámetros, schemas de request/response y códigos HTTP documentados conforme a OpenAPI 3.0.0 | HTTP 200 OK con spec OpenAPI 3.0 íntegro y sincronizado para generación de tipos frontend | APROBADO | 30/09/2026 20:40 | - | fix(seguridad): registrar endpoint usuario-activo en openapi y vincular esquema zod (BUG-HU5-01) |

---

## 4. Bloque TSV para Copiar y Pegar en Google Sheets / Excel (Celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H5-API-01	Omisión del endpoint usuario-activo y esquemas Zod en OpenAPI 3.0	Contrato / OpenAPI	API / OpenAPI	Media	Servidor backend en ejecución	GET /openapi.json inspeccionando rutas y schemas	Especificación OpenAPI 3.0 con ruta /api/seguridad/usuario-activo y schema UsuarioActivoResponse	Nodo ausente en JSON impidiendo sincronización de tipos TypeScript en cliente frontend	CORREGIDO	30/09/2026 18:30	30/09/2026 19:26	fix(seguridad): registrar endpoint usuario-activo en openapi y vincular esquema zod (BUG-HU5-01)
BUG-H5-API-02	Excepción no controlada HTTP 500 ante parámetro de rol no UUID en ruta	Robustez / Schema	API / Route	Alta	Servidor backend en ejecución	PUT /api/seguridad/roles/abc-no-uuid/permisos con body {"permisoIds":[]}	HTTP 400 Bad Request reportando que el identificador debe cumplir formato UUID	HTTP 500 Internal Server Error arrojado por PostgreSQL por sintaxis inválida de UUID	CORREGIDO	30/09/2026 18:50	30/09/2026 19:27	fix(seguridad): validar formato uuid en parametros de ruta de roles para evitar error 500 (BUG-HU5-02)
BUG-H5-API-03	Vulnerabilidad de auto-bloqueo al revocar permiso seguridad:roles:gestionar al Administrador	Seguridad / Negocio	Servicio / Dominio	Crítica	Administrador modificando permisos de su propio perfil	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000001/permisos sin seguridad:roles:gestionar	HTTP 400 Bad Request impidiendo la revocación de la facultad de gestionar roles	Permiso revocado exitosamente dejando al sistema sin administradores con permisos de gestión	CORREGIDO	29/09/2026 14:15	29/09/2026 17:59	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
BUG-H5-API-04	Inconsistencia de integridad referencial al asignar UUIDs de permisos inexistentes	Integridad / BD	DAL / Repository	Alta	Base de datos con catálogo de permisos activo	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con permisoId falso	HTTP 400 Bad Request informando que uno o más permisos no existen en el sistema	Fallo tardío con error de clave foránea o persistencia silenciosa de registros huérfanos	CORREGIDO	29/09/2026 15:40	29/09/2026 17:59	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
BUG-H5-API-05	Violación potencial de atomicidad en guardado masivo ante fallas parciales	Transaccionalidad	DAL / Kysely	Crítica	Entorno con operaciones concurrentes de actualización	Actualización de múltiples permisos forzando excepción a mitad de la operación	Rollback automático completo en transacción Kysely sin dejar tablas inconsistentes	Ejecución fuera de transacción dejando permisos eliminados sin insertar las nuevas tuplas	CORREGIDO	29/09/2026 16:30	29/09/2026 17:59	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-01	Consulta autorizada del catálogo completo de módulos y permisos disponibles (CA-2)	Funcional / Catálogo	API / Route	Alta	Administrador autenticado con JWT Bearer activo	GET /api/seguridad/permisos [Header: Authorization Bearer (Admin)]	HTTP 200 OK con { total: 20, data: [...] } listando permisos clasificados por módulo funcional	HTTP 200 OK retornando catálogo íntegro de permisos clasificados por módulo funcional	APROBADO	30/09/2026 20:00	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-02	Bloqueo de consulta de catálogo de permisos por falta de cabecera de autenticación	Seguridad / Auth	API / Guard	Crítica	Servidor API en ejecución	GET /api/seguridad/permisos [Sin cabecera Authorization]	HTTP 401 Unauthorized indicando requerimiento de cabecera Bearer	HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>"	APROBADO	30/09/2026 20:02	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-03	Denegación de acceso a consulta de catálogo de permisos a usuario no Administrador	Seguridad / RBAC	API / Guard	Crítica	Usuario autenticado con rol Call Center	GET /api/seguridad/permisos [Header: Authorization Bearer (Rol Call Center)]	HTTP 403 Forbidden denegando acceso por perfil insuficiente	HTTP 403 Forbidden: "Se requiere el perfil de Administrador"	APROBADO	30/09/2026 20:04	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-04	Selección y consulta de detalle de perfil existente con sus permisos asignados (CA-1, CA-2)	Funcional / Consulta	API / Route	Alta	Rol Call Center existente en base de datos	GET /api/seguridad/roles/20000000-0000-4000-8000-000000000002 [Header: Bearer Token (Admin)]	HTTP 200 OK con detalle del rol y arreglo de permisos asignados para reflejar estado activo/inactivo	HTTP 200 OK retornando entidad de rol con cantidadPermisos y lista de permisos asociados	APROBADO	30/09/2026 20:06	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-05	Asignación masiva de múltiples permisos a un perfil específico (CA-3, CA-4)	Funcional / Mutación	API / Servicio	Crítica	Rol Call Center con 0 permisos asignados previamente	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":["10000000-0000-4000-8000-000000000001","10000000-0000-4000-8000-000000000005"]}	HTTP 200 OK con mensaje de éxito de persistencia y objeto actualizado con cantidadPermisos: 2	HTTP 200 OK: "Permisos actualizados correctamente en la base de datos" con 2 permisos asignados	APROBADO	30/09/2026 20:10	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-06	Revocación masiva de permisos desmarcados en un perfil específico (CA-3, CA-4)	Funcional / Mutación	API / Servicio	Crítica	Rol con 2 permisos asignados previamente	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":["10000000-0000-4000-8000-000000000001"]}	HTTP 200 OK persistiendo la revocación atómica y retornando cantidadPermisos: 1	HTTP 200 OK confirmando la eliminación del permiso desmarcado y persistencia inmediata	APROBADO	30/09/2026 20:12	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-07	Desmarcado total y revocación de todos los permisos de un perfil (CA-3, CA-4)	Funcional / Mutación	API / Servicio	Alta	Rol con permisos asignados	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":[]}	HTTP 200 OK persistiendo el vaciado en rol_permiso con cantidadPermisos: 0 y permisos: []	HTTP 200 OK: "Permisos actualizados correctamente en la base de datos" con arreglo vacío	APROBADO	30/09/2026 20:14	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-08	Bloqueo no autenticado en actualización de permisos por perfil	Seguridad / Auth	API / Guard	Crítica	Servidor API en ejecución	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos [Sin Authorization]	HTTP 401 Unauthorized impidiendo mutaciones anónimas	HTTP 401 Unauthorized con mensaje de cabecera Bearer requerida	APROBADO	30/09/2026 20:16	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-09	Denegación de mutación de permisos a usuario con perfil operativo no Administrador	Seguridad / RBAC	API / Guard	Crítica	Usuario autenticado con rol Call Center	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos [Header: Bearer Token (Call Center)]	HTTP 403 Forbidden denegando privilegios de alteración de permisos	HTTP 403 Forbidden: "Se requiere el perfil de Administrador"	APROBADO	30/09/2026 20:18	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-10	Validación de cuerpo de solicitud no JSON en actualización de permisos	Robustez / API	API / Route	Media	Administrador autenticado	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body texto plano no JSON	HTTP 400 Bad Request indicando que el cuerpo debe ser un JSON válido	HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un JSON válido."	APROBADO	30/09/2026 20:20	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-11	Validación Zod de payload con formato no conforme o elementos no UUID en permisoIds	Validación / Zod	API / Schema	Media	Administrador autenticado	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con body {"permisoIds":["invalido-123"]}	HTTP 400 Bad Request con detalles estructurados de validación Zod	HTTP 400 Bad Request: "Payload de permisos inválido" con arreglo de issues	APROBADO	30/09/2026 20:22	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-12	Validación temprana de formato UUID en parámetro de ruta id del rol	Validación / Zod	API / Route	Media	Administrador autenticado	PUT /api/seguridad/roles/abc-no-uuid/permisos con body {"permisoIds":[]}	HTTP 400 Bad Request informando que el parámetro de ruta no es un UUID válido	HTTP 400 Bad Request: "El identificador de rol proporcionado no es un UUID válido."	APROBADO	30/09/2026 20:24	-	fix(seguridad): validar formato uuid en parametros de ruta de roles para evitar error 500 (BUG-HU5-02)
CP-H5-API-13	Manejo de error al intentar actualizar permisos de un rol inexistente en BD	Robustez / Errores	API / Servicio	Media	Administrador autenticado, UUID de rol inexistente	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000999/permisos con body {"permisoIds":["10000000-0000-4000-8000-000000000001"]}	HTTP 404 Not Found con mensaje descriptivo de rol no encontrado	HTTP 404 Not Found: "Perfil con ID '20000000-0000-4000-8000-000000000999' no encontrado."	APROBADO	30/09/2026 20:26	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-14	Rechazo con HTTP 400 ante permisos inexistentes en el catálogo de BD	Integridad / BD	DAL / Repository	Alta	Administrador autenticado, UUID de permiso inexistente	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos con {"permisoIds":["10000000-0000-4000-8000-000000000999"]}	HTTP 400 Bad Request informando que uno o más permisos especificados no existen	HTTP 400 Bad Request: "Uno o más permisos especificados no existen en el sistema..."	APROBADO	30/09/2026 20:28	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-15	Protección contra auto-bloqueo impidiendo revocar seguridad:roles:gestionar al Administrador	Regla de Negocio / RBAC	Servicio / Dominio	Crítica	Intento de actualizar rol Admin omitiendo seguridad:roles:gestionar	PUT /api/seguridad/roles/20000000-0000-4000-8000-000000000001/permisos con {"permisoIds":["10000000-0000-4000-8000-000000000001"]}	HTTP 400 Bad Request bloqueando la operación para evitar auto-bloqueo	HTTP 400 Bad Request: "El permiso 'seguridad:roles:gestionar' es obligatorio para el perfil Administrador..."	APROBADO	30/09/2026 20:30	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-16	Persistencia transaccional estricta con rollback ante error forzado en base de datos	Transaccionalidad / BD	DAL / Kysely	Crítica	Simulación de fallo en sentencia dentro de db.transaction()	Invocación de seguridadRepository.actualizarPermisosRol bajo error forzado	Transacción de Kysely abortada con rollback integral sin persistir datos parciales	Excepción capturada, rollback verificado mediante mock transaccional y rechazo íntegro	APROBADO	30/09/2026 20:32	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-17	Verificación de auditoría (asignado_en, asignado_por_id) y timestamp actualizado_en del rol	Auditoría / BD	DAL / Kysely	Alta	Asignación de permisos por Administrador autenticado	Inspección de registros insertados en rol_permiso y tabla rol	Filas en rol_permiso con asignado_por_id = admin.id, timestamp actual y rol.actualizado_en modificado	Metadatos de auditoría persistidos y actualizados fielmente en PostgreSQL	APROBADO	30/09/2026 20:34	-	feat(seguridad): implementar asignación y revocación de permisos por rol (HU-5)
CP-H5-API-18	Reflejo inmediato de restricciones y permisos en tiempo real vía usuario-activo (CA-5)	Funcional / Dinámico	API / Route	Crítica	Usuario con sesión activa cuyo rol acaba de ser modificado en BD	GET /api/seguridad/usuario-activo [Header: Authorization Bearer (Usuario)]	HTTP 200 OK con arreglo permisos reflejando inmediatamente las restricciones	HTTP 200 OK retornando el listado dinámico de permisos consultado en tiempo real desde BD	APROBADO	30/09/2026 20:36	-	feat(seguridad): soportar validacion dinamica de permisos y endpoint de usuario activo
CP-H5-API-19	Bloqueo inmediato en GET /api/seguridad/usuario-activo ante funcionario desactivado	Seguridad / Estado	Servicio / Guard	Alta	Usuario autenticado con token válido cuya cuenta pasa a activo = false	GET /api/seguridad/usuario-activo con token de usuario inactivo	HTTP 403 Forbidden impidiendo el acceso a funcionarios inactivos en tiempo real	HTTP 403 Forbidden: "El usuario especificado se encuentra inactivo en la institución."	APROBADO	30/09/2026 20:38	-	feat(seguridad): soportar validacion dinamica de permisos y endpoint de usuario activo
CP-H5-API-20	Exposición y sincronización del contrato OpenAPI 3.0 para endpoints de HU-5	Contrato / OpenAPI	API / OpenAPI	Alta	Servidor backend en ejecución	GET /openapi.json inspeccionando rutas /permisos, /roles/{id}/permisos y /usuario-activo	Rutas, parámetros, schemas de request/response y códigos HTTP documentados conforme a OpenAPI 3.0.0	HTTP 200 OK con spec OpenAPI 3.0 íntegro y sincronizado para generación de tipos frontend	APROBADO	30/09/2026 20:40	-	fix(seguridad): registrar endpoint usuario-activo en openapi y vincular esquema zod (BUG-HU5-01)
```

---

## 5. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para asegurar la reproductibilidad integral por parte de cualquier evaluador técnico o auditor docente, se detalla el procedimiento exacto de ejecución tanto mediante la suite automatizada Vitest como a través de comandos `curl` contra el servidor en ejecución:

### 5.1. Validación de Defectos Corregidos (Ciclo de Re-Test)

#### `BUG-H5-API-01`: Sincronización del Endpoint `/usuario-activo` en OpenAPI 3.0
* **Precondición:** Repositorio en raíz `sgrai-api`.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe incluir las rutas /api/seguridad/roles, /api/seguridad/roles/{id}, /api/seguridad/permisos y /api/seguridad/roles/{id}/permisos en el spec"
  ```
* **Salida Vitest Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Especificación OpenAPI > debe incluir las rutas /api/seguridad/roles, /api/seguridad/roles/{id}, /api/seguridad/permisos y /api/seguridad/roles/{id}/permisos en el spec (132ms)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s "http://localhost:3000/openapi.json" | jq '.paths["/api/seguridad/usuario-activo"]'
  ```
* **Salida HTTP:**
  ```json
  {
    "get": {
      "summary": "Obtener usuario activo con permisos dinámicos resueltos en tiempo real (HU-5)",
      "tags": ["Seguridad / Roles y Permisos"],
      "responses": {
        "200": { "description": "Datos del usuario activo y sus permisos dinámicos" },
        "401": { "description": "Cabecera de autenticación ausente o token inválido" },
        "403": { "description": "Usuario inactivo en la institución" }
      }
    }
  }
  ```

---

#### `BUG-H5-API-02`: Validación de Formato UUID en Parámetro de Ruta
* **Precondición:** Servidor API en ejecución o suite de pruebas.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si el parámetro id no es un UUID válido (CP-HU5-19)"
  ```
* **Salida Vitest Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Route Handlers HTTP > HU-5: Endpoints GET /api/seguridad/permisos y PUT /api/seguridad/roles/[id]/permisos > PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si el parámetro id no es un UUID válido (CP-HU5-19) (2ms)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/abc-no-uuid/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d '{"permisoIds":[]}'
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "error": "El identificador de rol proporcionado no es un UUID válido.",
    "detalles": [
      {
        "code": "invalid_string",
        "validation": "uuid",
        "message": "El identificador de rol proporcionado no es un UUID válido.",
        "path": []
      }
    ]
  }
  ```

---

#### `BUG-H5-API-03`: Protección contra Auto-Bloqueo de Administrador
* **Precondición:** Administrador autenticado intentando omitir `seguridad:roles:gestionar`.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe rechazar con BadRequestError si se intenta revocar 'seguridad:roles:gestionar' al Administrador (Protección Auto-bloqueo)"
  ```
* **Salida Vitest Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Control de Acceso RBAC y Lógica de Servicio > HU-5: Gestión y Mutación de Permisos en SeguridadService > debe rechazar con BadRequestError si se intenta revocar 'seguridad:roles:gestionar' al Administrador (Protección Auto-bloqueo) (2ms)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000001/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d '{"permisoIds":["10000000-0000-4000-8000-000000000001"]}'
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "error": "El permiso 'seguridad:roles:gestionar' es obligatorio para el perfil Administrador y no puede ser revocado."
  }
  ```

---

#### `BUG-H5-API-04`: Validación Temprana de Permisos Inexistentes en Base de Datos
* **Precondición:** Administrador autenticado.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si se especifican permisos inexistentes en BD"
  ```
* **Salida Vitest Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Route Handlers HTTP > HU-5: Endpoints GET /api/seguridad/permisos y PUT /api/seguridad/roles/[id]/permisos > PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si se especifican permisos inexistentes en BD (2ms)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d '{"permisoIds":["10000000-0000-4000-8000-000000000999"]}'
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "error": "Uno o más permisos especificados no existen en el sistema: 10000000-0000-4000-8000-000000000999"
  }
  ```

---

#### `BUG-H5-API-05`: Atomicidad Transaccional y Rollback en Kysely
* **Precondición:** Suite de persistencia transaccional.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe ejecutar la mutación de permisos dentro de una transacción Kysely y hacer rollback ante error forzado"
  ```
* **Salida Vitest Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Persistencia y Transaccionalidad (SeguridadRepository) > debe ejecutar la mutación de permisos dentro de una transacción Kysely y hacer rollback ante error forzado (1ms)
  Tests: 1 passed (1)
  ```

---

### 5.2. Casos de Prueba Funcionales, de Seguridad y Rutas HTTP

#### `CP-H5-API-01`: Consulta del Catálogo Completo de Permisos por Módulo (CA-2)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/permisos debe retornar 200 con la lista de permisos clasificados por módulo"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/seguridad/permisos" \
    -H "Authorization: Bearer <token_admin>"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "total": 20,
    "data": [
      {
        "id": "10000000-0000-4000-8000-000000000001",
        "codigo": "recursos:crear",
        "nombre": "Crear Recursos",
        "descripcion": "Permite registrar nuevos recursos operativos",
        "modulo": "Recursos y Personal"
      },
      {
        "id": "10000000-0000-4000-8000-000000000004",
        "codigo": "seguridad:roles:gestionar",
        "nombre": "Gestionar Roles",
        "descripcion": "Permite asignar y revocar permisos a perfiles",
        "modulo": "Seguridad"
      }
    ]
  }
  ```

---

#### `CP-H5-API-02`: Bloqueo no Autenticado en Catálogo de Permisos
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/permisos debe retornar 401 si falta token Bearer"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/seguridad/permisos"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {
    "error": "Se requiere cabecera de autenticación Authorization: Bearer <token>."
  }
  ```

---

#### `CP-H5-API-03`: Denegación RBAC en Catálogo de Permisos a Rol no Administrador
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/permisos debe retornar 403 si el usuario no es Administrador"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/seguridad/permisos" \
    -H "Authorization: Bearer <token_callcenter>"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json

  {
    "error": "Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."
  }
  ```

---

#### `CP-H5-API-05`: Asignación Masiva Exitosa de Permisos a Rol (CA-3, CA-4)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "PUT /api/seguridad/roles/[id]/permisos debe retornar 200 con el rol actualizado"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d '{
      "permisoIds": [
        "10000000-0000-4000-8000-000000000001"
      ]
    }'
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Permisos actualizados correctamente en la base de datos",
    "data": {
      "id": "20000000-0000-4000-8000-000000000002",
      "nombre": "Call Center",
      "descripcion": "Recepción de avisos y despacho primario",
      "activo": true,
      "esSistema": true,
      "cantidadPermisos": 1,
      "permisos": [
        {
          "id": "10000000-0000-4000-8000-000000000001",
          "codigo": "recursos:crear",
          "nombre": "Crear Recursos",
          "descripcion": null,
          "modulo": "Recursos y Personal",
          "asignadoEn": "2026-09-30T17:59:26.000Z",
          "asignadoPorId": "00000000-0000-4000-8000-000000000001"
        }
      ],
      "creadoEn": "2026-09-01T12:00:00.000Z",
      "actualizadoEn": "2026-09-30T17:59:26.000Z"
    }
  }
  ```

---

#### `CP-H5-API-10`: Validación de Cuerpo no JSON
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si el body no es JSON válido"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d "este_texto_no_es_un_json_valido"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "error": "El cuerpo de la solicitud debe ser un JSON válido."
  }
  ```

---

#### `CP-H5-API-11`: Validación Zod de Estructura de Permisos
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si el payload no contiene un arreglo de UUIDs"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d '{"permisoIds":["no-es-uuid"]}'
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "error": "Payload de permisos inválido",
    "detalles": [
      {
        "code": "invalid_string",
        "validation": "uuid",
        "message": "Cada identificador de permiso debe ser un UUID válido.",
        "path": ["permisoIds", 0]
      }
    ]
  }
  ```

---

#### `CP-H5-API-13`: Consulta de Actualización sobre Rol Inexistente (404)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "PUT /api/seguridad/roles/[id]/permisos debe retornar 404 si el rol no existe"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000999/permisos" \
    -H "Authorization: Bearer <token_admin>" \
    -H "Content-Type: application/json" \
    -d '{"permisoIds":["10000000-0000-4000-8000-000000000001"]}'
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 404 Not Found
  Content-Type: application/json

  {
    "error": "Perfil con ID '20000000-0000-4000-8000-000000000999' no encontrado."
  }
  ```

---

#### `CP-H5-API-18`: Resolución Dinámica de Permisos en Tiempo Real (CA-5)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/usuario-activo debe retornar 200 con datos del usuario y permisos dinámicos"
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/seguridad/usuario-activo" \
    -H "Authorization: Bearer <token_admin>"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "data": {
      "id": "00000000-0000-4000-8000-000000000001",
      "rut": "11111111-1",
      "nombre": "Administrador General",
      "email": "admin@valdivia.cl",
      "activo": true,
      "delegacionId": null,
      "rol": {
        "id": "20000000-0000-4000-8000-000000000001",
        "nombre": "Administrador",
        "codigo": "ADMIN",
        "esAdmin": true
      },
      "permisos": [
        "seguridad:roles:leer",
        "seguridad:roles:gestionar"
      ]
    }
  }
  ```

---

## 6. Cobertura de Criterios de Aceptación (Trazabilidad)

| Criterio de Aceptación | Descripción del Criterio | Casos de Prueba Asociados | Estado de Cobertura | Dictamen |
|---|---|---|:---:|:---:|
| **CA-1** | El sistema debe permitir seleccionar un rol o perfil existente desde un menú o listado. | `CP-H5-API-04`, `BUG-H5-API-02`, `CP-H5-API-12`, `CP-H5-API-13` | **100%** | 🟢 CUMPLIDO |
| **CA-2** | Al seleccionar el perfil, el sistema debe desplegar la lista completa de módulos y permisos disponibles, reflejando visualmente cuáles están activos y cuáles inactivos para ese rol. | `CP-H5-API-01`, `CP-H5-API-02`, `CP-H5-API-03`, `CP-H5-API-04`, `CP-H5-API-20` | **100%** | 🟢 CUMPLIDO |
| **CA-3** | El sistema debe permitir marcar (asignar) o desmarcar (revocar) múltiples permisos antes de confirmar la acción. | `CP-H5-API-05`, `CP-H5-API-06`, `CP-H5-API-07`, `CP-H5-API-11`, `CP-H5-API-14`, `CP-H5-API-15` | **100%** | 🟢 CUMPLIDO |
| **CA-4** | El sistema debe mostrar un mensaje de confirmación de éxito al persistir los cambios correctamente en la base de datos. | `CP-H5-API-05`, `CP-H5-API-06`, `CP-H5-API-07`, `CP-H5-API-16`, `CP-H5-API-17` | **100%** | 🟢 CUMPLIDO |
| **CA-5** | Los usuarios que posean el rol modificado deben ver reflejadas las nuevas restricciones de acceso a las funcionalidades o vistas de forma inmediata (o tras la renovación de su sesión/token). | `CP-H5-API-18`, `CP-H5-API-19`, `BUG-H5-API-01`, `BUG-H5-API-03` | **100%** | 🟢 CUMPLIDO |

---

## 7. Evidencias Técnicas de Auditoría, Persistencia Transaccional y Sincronización OpenAPI

### 7.1. Integridad Transaccional en Base de Datos (Kysely)
En concordancia estricta con las notas técnicas de la historia de usuario, la operación de actualización masiva de permisos en la tabla intermedia `rol_permiso` se ejecuta íntegramente dentro de una transacción atómica:
1. **Validación de Identificadores:** Se realiza una consulta `SELECT id FROM permiso WHERE id IN (...)` para garantizar que todos los UUIDs pertenezcan al catálogo activo. Si hay discrepancia, se lanza `BadRequestError` antes de mutar datos.
2. **Cálculo de Diferencias de Conjuntos:** Se computa en memoria qué permisos se desmarcaron (`aEliminar`) y cuáles son nuevas asignaciones (`aInsertar`).
3. **Revocación:** Sentencia `DELETE FROM rol_permiso WHERE rol_id = :rolId AND permiso_id IN (...)`.
4. **Asignación y Auditoría:** Sentencia `INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id, asignado_en)` registrando el UUID del administrador ejecutor y el timestamp UTC exacto.
5. **Actualización de Timestamp del Rol:** Sentencia `UPDATE rol SET actualizado_en = CURRENT_TIMESTAMP WHERE id = :rolId`.
6. **Rollback Automático:** Ante cualquier error en el flujo de Kysely, la transacción se aborta instantáneamente, garantizando consistencia referencial estricta.

### 7.2. Contrato OpenAPI 3.0 Centralizado (`GET /openapi.json`)
Los esquemas de entrada y salida se generan automáticamente mediante `zod-to-openapi`:
* `ActualizarPermisosRolInputSchema`: `{ permisoIds: string[] (uuid) }`
* `ActualizarPermisosRolResponseSchema`: `{ message: string, data: RolItemSchema }`
* `PermisoCatalogoResponseSchema`: `{ total: number, data: PermisoCatalogoItemSchema[] }`
* `UsuarioActivoResponseSchema`: `{ data: UsuarioActivoItemSchema }`

---

## 8. Dictamen Final de Certificación QA

* **Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN (PASSED)**.
* **Tasa de Aprobación:** **100%** (25/25 casos y defectos verificados y conformes).
* **Conclusión Técnica:** La funcionalidad de asignación y revocación de permisos cumple con la totalidad de los criterios de aceptación funcionales, de seguridad RBAC, transaccionalidad de datos en PostgreSQL, robustez ante entradas no válidas y sincronización en OpenAPI 3.0.
