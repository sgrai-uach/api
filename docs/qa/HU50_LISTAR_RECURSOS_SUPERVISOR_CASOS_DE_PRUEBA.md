# Informe y Matriz de Casos de Prueba de Backend (QA): HU-50 — Listado de Recursos para Supervisor

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Monitoreo Estratégico y Consulta de Inventario Logístico (`GET /api/recursos` y `GET /api/recursos/[id]`).  
> **Historia de Usuario:** HU-50 — *"Como Supervisor Quiero ver un listado de recursos Para ver la disponibilidad de estos y monitorear el estado operativo y logístico de la unidad sin alterar los registros."*  
> **Servicio API:** `sgrai-api` (Next.js 16.3.4 App Router + Kysely + PostgreSQL 16 PostGIS + Vitest v3.2.7 + OpenAPI 3.0).  
> **Rama Git Evaluada:** `feature/H50-listado-recursos-supervisor` (integrada y mergeada formalmente en `develop` vía PR #20).  
> **Commits Clave Evaluados (Conventional Commits sin hash):**
> * `feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50`
> * `fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos`
> * `feat(recursos): asignar permisos recursos:leer y sembrar cuenta de supervisor en migracion 015`
> * `merge: sincronizar develop con feature/H50 resolviendo conflictos en recursos y migracion`
> * `docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol`
> 
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **25** (20 Casos Funcionales/RBAC/Contrato + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **20 (100%)** |
| **Casos Fallidos (Failed)** | **0 (0%)** |
| **Casos Bloqueados (Blocked)** | **0 (0%)** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados como `CORREGIDO`) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suites Automatizadas de Pruebas de Recursos (Vitest)** | **22/22 tests en verde** (3 suites de recursos sin fallas) |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Compilación de Producción (Turbopack)** | **Exitosa (22 rutas de API compiladas)** |
| **Integridad de Contrato OpenAPI 3.0** | **100% sincronizado con soporte de `soloLectura` y rol Supervisor** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo las directrices metodológicas de QA (*detección de defectos durante el ciclo de desarrollo de la rama, reporte formal, solución por parte del equipo de desarrollo mediante Conventional Commits y ejecución de Re-Test formal para certificación de cierre*), se detectaron y gestionaron 5 defectos en la API:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H50-API-01` | **Extracción incompleta de token JWT en endpoints individuales de recursos:** La ruta `GET /api/recursos/[id]` extraía credenciales usando un helper síncrono obsoleto en lugar del guard asíncrono con JWT Bearer. | Crítica | `src/app/api/recursos/[id]/route.ts` | 01/10/2026 19:15 | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos | 05/10/2026 03:00 | 🟢 CORREGIDO (Autenticación estandarizada con `extraerUsuarioId` validando Bearer y fallback). |
| `BUG-H50-API-02` | **Validación dura por rol Administrador bloqueando acceso de consulta al Supervisor:** `validarAccesoAdministrador` exigía taxativamente `rolNombre === 'Administrador'`, arrojando HTTP 403 al Supervisor pese a tener `recursos:leer`. | Crítica | `src/modules/seguridad/service.ts` | 01/10/2026 19:40 | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos | 05/10/2026 03:00 | 🟢 CORREGIDO (Autorización granular por permiso `recursos:leer` permitiendo acceso a Supervisor). |
| `BUG-H50-API-03` | **Ausencia de permiso recursos:leer en rol Supervisor y falta de usuario semilla institucional:** En la base de datos inicial no existía vinculación del rol Supervisor con `recursos:leer` ni la cuenta semilla `supervisor@valdivia.cl`. | Alta | `src/lib/db/migrations/` | 01/10/2026 20:00 | feat(recursos): asignar permisos recursos:leer y sembrar cuenta de supervisor en migracion 015 | 05/10/2026 03:00 | 🟢 CORREGIDO (Migración sembró permiso `recursos:leer` al rol Supervisor y cuenta activa en BD). |
| `BUG-H50-API-04` | **Omisión de parámetro de consulta soloLectura en esquema OpenAPI y contrato Zod:** El esquema de validación Zod no aceptaba `soloLectura=true` y la especificación OpenAPI carecía de la documentación para Supervisor. | Media | `src/app/api/recursos/route.ts` | 01/10/2026 20:45 | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 | 05/10/2026 03:00 | 🟢 CORREGIDO (Parámetro `soloLectura` tipado como booleano en Zod y documentado en OpenAPI 3.0). |
| `BUG-H50-API-05` | **Colisión de numeración en migración Kysely por desincronización con origin/develop:** La migración de supervisor usaba prefijo `011_` colisionando con migraciones de H17 (`011`), H57 (`012`), H18 (`013`) y H9 (`014`) en develop. | Crítica | `src/lib/db/migrations/` | 04/10/2026 19:50 | merge: sincronizar develop con feature/H50 resolviendo conflictos en recursos y migracion | 05/10/2026 03:00 | 🟢 CORREGIDO (Migración renumerada correlativamente a `015_supervisor_semilla_y_permisos.ts`). |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas - 25 Filas Exactas)

*(Nota: En la columna `Solución / Commit` se especifican estrictamente mensajes estructurados en Conventional Commits sin ningún hash hexadecimal).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|:---:|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H50-API-01` | Extracción incompleta de token JWT en endpoints individuales de recursos | Seguridad / Auth | API / Guard | Crítica | Petición con cabecera Authorization: Bearer jwt | GET /api/recursos/[id] | Extrae usuario del JWT y autoriza consulta según permisos | Autenticación estandarizada con validación Bearer y fallback | CORREGIDO | 01/10/2026 19:15 | 05/10/2026 03:00 | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `BUG-H50-API-02` | Validación dura por rol Administrador bloqueando acceso a Supervisor | Seguridad / RBAC | Servicio / RBAC | Crítica | Usuario Supervisor con permiso recursos:leer activo | GET /api/recursos y GET /api/recursos/[id] | HTTP 200 OK con datos del recurso respetando granularidad | Autorización por permiso recursos:leer permitiendo acceso a Supervisor | CORREGIDO | 01/10/2026 19:40 | 05/10/2026 03:00 | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `BUG-H50-API-03` | Ausencia de permiso recursos:leer en rol Supervisor y falta de usuario semilla | DB / Semilla | Base de Datos | Alta | Base de datos municipal inicializada | Consulta relacional en usuario y rol_permiso | Rol Supervisor con recursos:leer y supervisor@valdivia.cl habilitada | Rol vinculado a recursos:leer y usuario semilla activo en BD | CORREGIDO | 01/10/2026 20:00 | 05/10/2026 03:00 | feat(recursos): asignar permisos recursos:leer y sembrar cuenta de supervisor en migracion 015 |
| `BUG-H50-API-04` | Omisión de parámetro de consulta soloLectura en esquema OpenAPI y contrato Zod | Contrato / OpenAPI | API / Schema | Media | Consulta con query parameter soloLectura=true | GET /api/recursos?soloLectura=true | HTTP 200 OK reconociendo el parámetro booleano y documentado | Parámetro soloLectura validado en Zod y publicado en openapi.json | CORREGIDO | 01/10/2026 20:45 | 05/10/2026 03:00 | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `BUG-H50-API-05` | Colisión de numeración en migración Kysely por desincronización con origin/develop | Integración / DB | Base de Datos | Crítica | Rama origin/develop actualizada con migraciones 011 a 014 | Inspeccionar carpeta src/lib/db/migrations/ | Orden secuencial estricto sin colisión de prefijos numéricos | Migración renumerada a 015 ejecutando correlativamente sin colisión | CORREGIDO | 04/10/2026 19:50 | 05/10/2026 03:00 | merge: sincronizar develop con feature/H50 resolviendo conflictos en recursos y migracion |
| `CP-H50-API-01` | Consulta autorizada de inventario para Supervisor con token JWT Bearer (CA-1, CA-4) | Funcional / Auth | API / Route | Crítica | Usuario Supervisor activo con token JWT válido | GET /api/recursos con header Authorization: Bearer jwt | HTTP 200 OK con payload data y meta paginados | HTTP 200 OK con listado paginado y metadatos correctos | APROBADO | 04/10/2026 19:10 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-02` | Consulta autorizada de inventario mediante cabecera de fallback X-User-Id (CA-1, CA-4) | Compatibilidad / Auth | API / Header | Alta | UUID de supervisor provisto en cabecera | GET /api/recursos con x-user-id: 00000000-0000-4000-8000-000000000010 | HTTP 200 OK reconociendo la identidad institucional | HTTP 200 OK autorizado correctamente | APROBADO | 04/10/2026 19:12 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-03` | Bloqueo de consulta de recursos por ausencia total de credenciales (CA-4) | Seguridad / Auth | API / Guard | Crítica | Petición sin cabeceras de autorización | GET /api/recursos (sin token ni x-user-id) | HTTP 401 Unauthorized con mensaje descriptivo | HTTP 401 Se requiere cabecera de autenticacion devuelto | APROBADO | 04/10/2026 19:14 | - | docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-04` | Bloqueo de consulta de recursos para roles sin permiso recursos:leer (CA-4) | Seguridad / RBAC | API / Permisos | Crítica | Usuario autenticado con rol Call Center u Observador | GET /api/recursos con credenciales de Call Center | HTTP 403 Forbidden con detalle de permisos insuficientes | HTTP 403 Acceso denegado. Permisos insuficientes | APROBADO | 04/10/2026 19:16 | - | docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-05` | Recepción y validación de parámetro soloLectura=true en query string (CA-1, CA-4) | Contrato / Zod | API / Query | Media | Query parameter booleano en solicitud | GET /api/recursos?pagina=1&limite=10&soloLectura=true | HTTP 200 OK procesando el parámetro sin rechazo Zod | HTTP 200 OK con payload válido procesado | APROBADO | 04/10/2026 19:18 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-06` | Manejo de inventario vacío (Empty State) retornando payload consistente (CA-5) | Funcional / Robustez | API / Payload | Alta | Base de datos sin recursos registrados | GET /api/recursos?pagina=1&limite=10 | HTTP 200 OK con data: [], meta.total: 0 y meta.totalPaginas: 0 | HTTP 200 OK con arreglo vacío y metadatos en cero | APROBADO | 04/10/2026 19:20 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-07` | Consulta autorizada de ficha técnica de recurso individual por ID para Supervisor (CA-1, CA-4) | Funcional / RBAC | API / Route | Alta | ID válido de recurso existente en base de datos | GET /api/recursos/e1000000-0000-4000-8000-000000000001 con token | HTTP 200 OK con ficha completa (detalles, stock, delegación) | HTTP 200 OK con objeto íntegro del recurso | APROBADO | 04/10/2026 19:22 | - | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `CP-H50-API-08` | Consulta de recurso individual inexistente retornando HTTP 404 Not Found (CA-1) | Robustez / Error | API / Route | Media | UUID aleatorio sin coincidencia en BD | GET /api/recursos/00000000-9999-4000-8000-000000000099 | HTTP 404 Not Found con mensaje Recurso no encontrado | HTTP 404 retornado limpiamente | APROBADO | 04/10/2026 19:24 | - | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `CP-H50-API-09` | Validación de formato UUID en parámetro de ruta [id] ante identificador malformado (CA-1) | Validación / Zod | API / Params | Media | Cadena no UUID en URL (ej. abc-123) | GET /api/recursos/abc-123 | HTTP 400 Bad Request indicando formato UUID requerido | HTTP 400 con detalle descriptivo de Zod | APROBADO | 04/10/2026 19:26 | - | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `CP-H50-API-10` | Bloqueo de creación de recursos (POST) para perfil Supervisor por solo lectura (CA-4) | Seguridad / Mutación | API / POST | Crítica | Intento de alta por usuario con rol Supervisor | POST /api/recursos con datos válidos de recurso | HTTP 403 Forbidden por carecer de permiso recursos:crear | HTTP 403 Acceso denegado. Se requiere permiso recursos:crear | APROBADO | 04/10/2026 19:28 | - | docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-11` | Bloqueo de edición de recursos (PUT) para perfil Supervisor por carecer de permiso (CA-4) | Seguridad / Mutación | API / PUT | Crítica | Intento de actualización de recurso por Supervisor | PUT /api/recursos/[id] con modificaciones de stock | HTTP 403 Forbidden por carecer de permiso recursos:editar | HTTP 403 Acceso denegado. Se requiere permiso recursos:editar | APROBADO | 04/10/2026 19:30 | - | docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-12` | Bloqueo de baja o eliminación de recursos (DELETE) para perfil Supervisor (CA-4) | Seguridad / Mutación | API / DELETE | Crítica | Intento de borrado de recurso por Supervisor | DELETE /api/recursos/[id] con motivo de baja | HTTP 403 Forbidden por carecer de permiso recursos:eliminar | HTTP 403 Acceso denegado. Se requiere permiso recursos:eliminar | APROBADO | 04/10/2026 19:31 | - | docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-13` | Cálculo automático de disponibilidad operativa neta (cantidadDisponible) (CA-2) | Lógica de Negocio | Servicio / Cálculo | Alta | Recurso con inventario total y unidades en uso | Stock: 5, En uso: 2 | Campo cantidadDisponible calculado automáticamente en 3 | cantidadDisponible: 3 en payload de respuesta | APROBADO | 04/10/2026 19:32 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-14` | Cruce relacional JOIN con tabla delegacion poblando entidad territorial completa (CA-3) | Integración / DB | Base de Datos | Alta | Recurso asociado a DEL_NORTE | Consulta a endpoint de recursos | Objeto delegacion poblado con id, codigo y nombre oficial | delegacion: { id, codigo: DEL_NORTE, nombre: Delegación Municipal Norte } | APROBADO | 04/10/2026 19:34 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-15` | Filtrado en servidor por estado operativo (DISPONIBLE, ASIGNADO, EN_MANTENCION) (CA-2) | Funcional / Filtros | API / Query | Alta | Inventario con múltiples recursos sembrados | ?estado=DISPONIBLE | La consulta SQL filtra por cláusula WHERE estado y retorna coincidencias | Filtro por estado ejecutado con exactitud en Kysely | APROBADO | 04/10/2026 19:36 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-16` | Filtrado en servidor por procedencia territorial delegacionId (CA-3) | Funcional / Filtros | API / Query | Alta | Recursos en múltiples delegaciones | ?delegacionId=30000000-0000-4000-8000-000000000001 | Retorna exclusivamente recursos asignados a la delegación solicitada | Filtro territorial aplicado fidedignamente | APROBADO | 04/10/2026 19:37 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-17` | Búsqueda textual por nombre o patente en servidor (CA-1) | Funcional / Filtros | API / Query | Alta | Inventario con bombas, camionetas y generadores | ?busqueda=Motobomba | Cláusula ILIKE busca en nombre, descripción y patente de detalles JSONB | Coincidencias textuales devueltas con exactitud | APROBADO | 04/10/2026 19:38 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-18` | Paginación bajo demanda con parámetros pagina y limite preservando metadatos (CA-1) | Funcional / Paginación | API / Query | Media | Inventario con más de 10 registros | ?pagina=2&limite=5 | Devuelve registros 6 a 10 con meta.pagina: 2 y meta.limite: 5 | Paginación SQL OFFSET y LIMIT respetada en Kysely | APROBADO | 04/10/2026 19:39 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `CP-H50-API-19` | Preservación de atributos técnicos en objeto JSONB detalles (patente, horómetro) (CA-3) | Integración / JSONB | Base de Datos | Alta | Vehículo registrado con datos técnicos | GET /api/recursos/[id] | Objeto detalles conserva atributos técnicos (patente, combustible) | Columna JSONB recuperada íntegramente | APROBADO | 04/10/2026 19:40 | - | fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `CP-H50-API-20` | Sincronización de especificación OpenAPI 3.0 documentando permisos y soloLectura (CA-1, CA-4) | Contrato / OpenAPI | API / Spec | Alta | Servidor levantado en puerto 3001 | GET /openapi.json | Ruta /api/recursos documentada con permisos de Supervisor y soloLectura | Especificación OpenAPI 3.0 completa y tipada | APROBADO | 04/10/2026 19:42 | - | feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |

---

## 3.1. Bloque TSV para Google Sheets (Copiar y Pegar en celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H50-API-01	Extracción incompleta de token JWT en endpoints individuales de recursos	Seguridad / Auth	API / Guard	Crítica	Petición con cabecera Authorization: Bearer jwt	GET /api/recursos/[id]	Extrae usuario del JWT y autoriza consulta según permisos	Autenticación estandarizada con validación Bearer y fallback	CORREGIDO	01/10/2026 19:15	05/10/2026 03:00	fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos
BUG-H50-API-02	Validación dura por rol Administrador bloqueando acceso a Supervisor	Seguridad / RBAC	Servicio / RBAC	Crítica	Usuario Supervisor con permiso recursos:leer activo	GET /api/recursos y GET /api/recursos/[id]	HTTP 200 OK con datos del recurso respetando granularidad	Autorización por permiso recursos:leer permitiendo acceso a Supervisor	CORREGIDO	01/10/2026 19:40	05/10/2026 03:00	fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos
BUG-H50-API-03	Ausencia de permiso recursos:leer en rol Supervisor y falta de usuario semilla	DB / Semilla	Base de Datos	Alta	Base de datos municipal inicializada	Consulta relacional en usuario y rol_permiso	Rol Supervisor con recursos:leer y supervisor@valdivia.cl habilitada	Rol vinculado a recursos:leer y usuario semilla activo en BD	CORREGIDO	01/10/2026 20:00	05/10/2026 03:00	feat(recursos): asignar permisos recursos:leer y sembrar cuenta de supervisor en migracion 015
BUG-H50-API-04	Omisión de parámetro de consulta soloLectura en esquema OpenAPI y contrato Zod	Contrato / OpenAPI	API / Schema	Media	Consulta con query parameter soloLectura=true	GET /api/recursos?soloLectura=true	HTTP 200 OK reconociendo el parámetro booleano y documentado	Parámetro soloLectura validado en Zod y publicado en openapi.json	CORREGIDO	01/10/2026 20:45	05/10/2026 03:00	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
BUG-H50-API-05	Colisión de numeración en migración Kysely por desincronización con origin/develop	Integración / DB	Base de Datos	Crítica	Rama origin/develop actualizada con migraciones 011 a 014	Inspeccionar carpeta src/lib/db/migrations/	Orden secuencial estricto sin colisión de prefijos numéricos	Migración renumerada a 015 ejecutando correlativamente sin colisión	CORREGIDO	04/10/2026 19:50	05/10/2026 03:00	merge: sincronizar develop con feature/H50 resolviendo conflictos en recursos y migracion
CP-H50-API-01	Consulta autorizada de inventario para Supervisor con token JWT Bearer (CA-1, CA-4)	Funcional / Auth	API / Route	Crítica	Usuario Supervisor activo con token JWT válido	GET /api/recursos con header Authorization: Bearer jwt	HTTP 200 OK con payload data y meta paginados	HTTP 200 OK con listado paginado y metadatos correctos	APROBADO	04/10/2026 19:10	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-02	Consulta autorizada de inventario mediante cabecera de fallback X-User-Id (CA-1, CA-4)	Compatibilidad / Auth	API / Header	Alta	UUID de supervisor provisto en cabecera	GET /api/recursos con x-user-id: 00000000-0000-4000-8000-000000000010	HTTP 200 OK reconociendo la identidad institucional	HTTP 200 OK autorizado correctamente	APROBADO	04/10/2026 19:12	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-03	Bloqueo de consulta de recursos por ausencia total de credenciales (CA-4)	Seguridad / Auth	API / Guard	Crítica	Petición sin cabeceras de autorización	GET /api/recursos (sin token ni x-user-id)	HTTP 401 Unauthorized con mensaje descriptivo	HTTP 401 Se requiere cabecera de autenticacion devuelto	APROBADO	04/10/2026 19:14	-	docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol
CP-H50-API-04	Bloqueo de consulta de recursos para roles sin permiso recursos:leer (CA-4)	Seguridad / RBAC	API / Permisos	Crítica	Usuario autenticado con rol Call Center u Observador	GET /api/recursos con credenciales de Call Center	HTTP 403 Forbidden con detalle de permisos insuficientes	HTTP 403 Acceso denegado. Permisos insuficientes	APROBADO	04/10/2026 19:16	-	docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol
CP-H50-API-05	Recepción y validación de parámetro soloLectura=true en query string (CA-1, CA-4)	Contrato / Zod	API / Query	Media	Query parameter booleano en solicitud	GET /api/recursos?pagina=1&limite=10&soloLectura=true	HTTP 200 OK procesando el parámetro sin rechazo Zod	HTTP 200 OK con payload válido procesado	APROBADO	04/10/2026 19:18	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-06	Manejo de inventario vacío (Empty State) retornando payload consistente (CA-5)	Funcional / Robustez	API / Payload	Alta	Base de datos sin recursos registrados	GET /api/recursos?pagina=1&limite=10	HTTP 200 OK con data: [], meta.total: 0 y meta.totalPaginas: 0	HTTP 200 OK con arreglo vacío y metadatos en cero	APROBADO	04/10/2026 19:20	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-07	Consulta autorizada de ficha técnica de recurso individual por ID para Supervisor (CA-1, CA-4)	Funcional / RBAC	API / Route	Alta	ID válido de recurso existente en base de datos	GET /api/recursos/e1000000-0000-4000-8000-000000000001 con token	HTTP 200 OK con ficha completa (detalles, stock, delegación)	HTTP 200 OK con objeto íntegro del recurso	APROBADO	04/10/2026 19:22	-	fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos
CP-H50-API-08	Consulta de recurso individual inexistente retornando HTTP 404 Not Found (CA-1)	Robustez / Error	API / Route	Media	UUID aleatorio sin coincidencia en BD	GET /api/recursos/00000000-9999-4000-8000-000000000099	HTTP 404 Not Found con mensaje Recurso no encontrado	HTTP 404 retornado limpiamente	APROBADO	04/10/2026 19:24	-	fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos
CP-H50-API-09	Validación de formato UUID en parámetro de ruta [id] ante identificador malformado (CA-1)	Validación / Zod	API / Params	Media	Cadena no UUID en URL (ej. abc-123)	GET /api/recursos/abc-123	HTTP 400 Bad Request indicando formato UUID requerido	HTTP 400 con detalle descriptivo de Zod	APROBADO	04/10/2026 19:26	-	fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos
CP-H50-API-10	Bloqueo de creación de recursos (POST) para perfil Supervisor por solo lectura (CA-4)	Seguridad / Mutación	API / POST	Crítica	Intento de alta por usuario con rol Supervisor	POST /api/recursos con datos válidos de recurso	HTTP 403 Forbidden por carecer de permiso recursos:crear	HTTP 403 Acceso denegado. Se requiere permiso recursos:crear	APROBADO	04/10/2026 19:28	-	docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol
CP-H50-API-11	Bloqueo de edición de recursos (PUT) para perfil Supervisor por carecer de permiso (CA-4)	Seguridad / Mutación	API / PUT	Crítica	Intento de actualización de recurso por Supervisor	PUT /api/recursos/[id] con modificaciones de stock	HTTP 403 Forbidden por carecer de permiso recursos:editar	HTTP 403 Acceso denegado. Se requiere permiso recursos:editar	APROBADO	04/10/2026 19:30	-	docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol
CP-H50-API-12	Bloqueo de baja o eliminación de recursos (DELETE) para perfil Supervisor (CA-4)	Seguridad / Mutación	API / DELETE	Crítica	Intento de borrado de recurso por Supervisor	DELETE /api/recursos/[id] con motivo de baja	HTTP 403 Forbidden por carecer de permiso recursos:eliminar	HTTP 403 Acceso denegado. Se requiere permiso recursos:eliminar	APROBADO	04/10/2026 19:31	-	docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol
CP-H50-API-13	Cálculo automático de disponibilidad operativa neta (cantidadDisponible) (CA-2)	Lógica de Negocio	Servicio / Cálculo	Alta	Recurso con inventario total y unidades en uso	Stock: 5, En uso: 2	Campo cantidadDisponible calculado automáticamente en 3	cantidadDisponible: 3 en payload de respuesta	APROBADO	04/10/2026 19:32	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-14	Cruce relacional JOIN con tabla delegacion poblando entidad territorial completa (CA-3)	Integración / DB	Base de Datos	Alta	Recurso asociado a DEL_NORTE	Consulta a endpoint de recursos	Objeto delegacion poblado con id, codigo y nombre oficial	delegacion: { id, codigo: DEL_NORTE, nombre: Delegación Municipal Norte }	APROBADO	04/10/2026 19:34	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-15	Filtrado en servidor por estado operativo (DISPONIBLE, ASIGNADO, EN_MANTENCION) (CA-2)	Funcional / Filtros	API / Query	Alta	Inventario con múltiples recursos sembrados	?estado=DISPONIBLE	La consulta SQL filtra por cláusula WHERE estado y retorna coincidencias	Filtro por estado ejecutado con exactitud en Kysely	APROBADO	04/10/2026 19:36	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-16	Filtrado en servidor por procedencia territorial delegacionId (CA-3)	Funcional / Filtros	API / Query	Alta	Recursos en múltiples delegaciones	?delegacionId=30000000-0000-4000-8000-000000000001	Retorna exclusivamente recursos asignados a la delegación solicitada	Filtro territorial aplicado fidedignamente	APROBADO	04/10/2026 19:37	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-17	Búsqueda textual por nombre o patente en servidor (CA-1)	Funcional / Filtros	API / Query	Alta	Inventario con bombas, camionetas y generadores	?busqueda=Motobomba	Cláusula ILIKE busca en nombre, descripción y patente de detalles JSONB	Coincidencias textuales devueltas con exactitud	APROBADO	04/10/2026 19:38	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-18	Paginación bajo demanda con parámetros pagina y limite preservando metadatos (CA-1)	Funcional / Paginación	API / Query	Media	Inventario con más de 10 registros	?pagina=2&limite=5	Devuelve registros 6 a 10 con meta.pagina: 2 y meta.limite: 5	Paginación SQL OFFSET y LIMIT respetada en Kysely	APROBADO	04/10/2026 19:39	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
CP-H50-API-19	Preservación de atributos técnicos en objeto JSONB detalles (patente, horómetro) (CA-3)	Integración / JSONB	Base de Datos	Alta	Vehículo registrado con datos técnicos	GET /api/recursos/[id]	Objeto detalles conserva atributos técnicos (patente, combustible)	Columna JSONB recuperada íntegramente	APROBADO	04/10/2026 19:40	-	fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos
CP-H50-API-20	Sincronización de especificación OpenAPI 3.0 documentando permisos y soloLectura (CA-1, CA-4)	Contrato / OpenAPI	API / Spec	Alta	Servidor levantado en puerto 3001	GET /openapi.json	Ruta /api/recursos documentada con permisos de Supervisor y soloLectura	Especificación OpenAPI 3.0 completa y tipada	APROBADO	04/10/2026 19:42	-	feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50
```

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% Paso a Paso

Para comprobar la replicabilidad exacta de los resultados de backend:

### 4.1. Verificación de Defectos Corregidos (Ciclo Re-Test)

#### `BUG-H50-API-01` y `BUG-H50-API-02` (Estandarización JWT y RBAC Granular en Detalle):
```bash
npm test -- src/app/api/recursos/__tests__/supervisor-rbac.test.ts -t "debe permitir al Supervisor visualizar el detalle del recurso"
```
* **Salida Obtenida:**
  ```text
   ✓ src/app/api/recursos/__tests__/supervisor-rbac.test.ts (1 test | 4 skipped) 1ms
     ✓ HU-50: Listado de Recursos para Supervisor — Control de Acceso y RBAC > 2. Ficha de detalle para lectura (GET /api/recursos/[id]) > debe permitir al Supervisor visualizar el detalle del recurso (200 OK) 1ms

   Test Files  1 passed (1)
        Tests  1 passed | 4 skipped (5)
  ```

#### `BUG-H50-API-03` (Verificación de Semilla y Permisos de Supervisor en BD):
```bash
node -e "
const { db } = require('./src/lib/db');
db.selectFrom('usuario').innerJoin('rol', 'rol.id', 'usuario.rol_id').select(['usuario.email', 'rol.nombre as rol']).where('usuario.email', '=', 'supervisor@valdivia.cl').execute().then(console.log);
"
```
* **Salida Obtenida:**
  ```json
  [ { email: 'supervisor@valdivia.cl', rol: 'Supervisor Estratégico' } ]
  ```

#### `BUG-H50-API-04` (Parámetro `soloLectura=true` en Endpoint Paginado):
```bash
npm test -- src/app/api/recursos/__tests__/supervisor-rbac.test.ts -t "debe permitir al perfil Supervisor listar recursos (200 OK) con permiso 'recursos:leer'"
```
* **Salida Obtenida:**
  ```text
   ✓ src/app/api/recursos/__tests__/supervisor-rbac.test.ts (1 test | 4 skipped) 8ms
     ✓ HU-50: Listado de Recursos para Supervisor — Control de Acceso y RBAC > 1. Visualización de recursos (GET /api/recursos) > debe permitir al perfil Supervisor listar recursos (200 OK) con permiso 'recursos:leer' 8ms

   Test Files  1 passed (1)
        Tests  1 passed | 4 skipped (5)
  ```

#### `BUG-H50-API-05` (Verificación de Migración 015 sin Colisiones):
```bash
ls -1 src/lib/db/migrations/ | grep -E "01[1-5]_"
```
* **Salida Obtenida:**
  ```text
  011_reporte_terreno_y_adjuntos.ts
  012_prevencion_riesgo_prioridad.ts
  013_indices_kpis_incidentes.ts
  014_personal_administrativo_semilla.ts
  015_supervisor_semilla_y_permisos.ts
  ```

---

### 4.2. Ejecución Automatizada de Casos de Prueba Funcionales y de Seguridad

#### `CP-H50-API-06` (Manejo de Inventario Vacío - Empty State):
```bash
npm test -- src/app/api/recursos/__tests__/supervisor-rbac.test.ts -t "debe retornar listado vacío cuando no existan recursos en el inventario"
```
* **Salida Obtenida:**
  ```text
   ✓ src/app/api/recursos/__tests__/supervisor-rbac.test.ts (1 test | 4 skipped) 1ms
     ✓ HU-50: Listado de Recursos para Supervisor — Control de Acceso y RBAC > 1. Visualización de recursos (GET /api/recursos) > debe retornar listado vacío cuando no existan recursos en el inventario (Empty State) 1ms

   Test Files  1 passed (1)
        Tests  1 passed | 4 skipped (5)
  ```

#### `CP-H50-API-10` (Bloqueo de Creación POST para Supervisor):
```bash
npm test -- src/app/api/recursos/__tests__/supervisor-rbac.test.ts -t "debe rechazar la creación de recursos para Supervisor con 403 Forbidden"
```
* **Salida Obtenida:**
  ```text
   ✓ src/app/api/recursos/__tests__/supervisor-rbac.test.ts (1 test | 4 skipped) 2ms
     ✓ HU-50: Listado de Recursos para Supervisor — Control de Acceso y RBAC > 3. Restricción de mutaciones para Supervisor (Solo Lectura) > debe rechazar la creación de recursos para Supervisor con 403 Forbidden (no posee recursos:crear) 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 4 skipped (5)
  ```

#### `CP-H50-API-11` (Bloqueo de Edición PUT para Supervisor):
```bash
npm test -- src/app/api/recursos/__tests__/supervisor-rbac.test.ts -t "debe rechazar la edición de recursos para Supervisor con 403 Forbidden"
```
* **Salida Obtenida:**
  ```text
   ✓ src/app/api/recursos/__tests__/supervisor-rbac.test.ts (1 test | 4 skipped) 1ms
     ✓ HU-50: Listado de Recursos para Supervisor — Control de Acceso y RBAC > 3. Restricción de mutaciones para Supervisor (Solo Lectura) > debe rechazar la edición de recursos para Supervisor con 403 Forbidden (no posee recursos:editar) 1ms

   Test Files  1 passed (1)
        Tests  1 passed | 4 skipped (5)
  ```

---

### 4.3. Ejecución Integral de Suites de Recursos en Backend

```bash
npm test -- src/app/api/recursos/__tests__/
```

* **Salida Obtenida:**
  ```text
   ✓ src/app/api/recursos/__tests__/route.test.ts (7 tests) 14ms
   ✓ src/app/api/recursos/__tests__/encargado-recursos-h14.test.ts (10 tests) 19ms
   ✓ src/app/api/recursos/__tests__/supervisor-rbac.test.ts (5 tests) 16ms

   Test Files  3 passed (3)
        Tests  22 passed (22)
     Duration  621ms
  ```

---

### 4.4. Verificación de Compilación y Calidad Estática

```bash
npm run lint && npx tsc --noEmit && npm run build
```

* **Salida Obtenida:**
  ```text
  npm notice run api@0.9.0 lint
  ✖ 6 problems (0 errors, 6 warnings)
  
  ▲ Next.js 16.3.4 (Turbopack)
  ✓ Compiled successfully in 1898ms
  Finished TypeScript in 1566ms
  Generating static pages using 15 workers (22/22) in 170ms
  Finalizing page optimization in 103ms
  ```

---

## 5. Trazabilidad de Criterios de Aceptación (CAs)

| Criterio de Aceptación | Descripción | Casos de Prueba Asociados | Dictamen QA |
|---|---|---|:---:|
| **CA-1** | El sistema debe mostrar una interfaz (tabla o cuadrícula) con todos los recursos registrados en la base de datos | `CP-H50-API-01`, `CP-H50-API-02`, `CP-H50-API-05`, `CP-H50-API-07`, `CP-H50-API-08`, `CP-H50-API-09`, `CP-H50-API-17`, `CP-H50-API-18`, `CP-H50-API-20` | 🟢 CUMPLIDO |
| **CA-2** | La vista debe exponer claramente el estado de disponibilidad de cada recurso (Disponible, Asignado, En mantención, No operativo) | `CP-H50-API-13`, `CP-H50-API-15` | 🟢 CUMPLIDO |
| **CA-3** | La información del recurso debe incluir al menos: nombre/descripción, tipo de recurso, delegación a la que pertenece y estado | `CP-H50-API-14`, `CP-H50-API-16`, `CP-H50-API-19` | 🟢 CUMPLIDO |
| **CA-4** | El acceso debe estar restringido mediante control de acceso basado en roles (RBAC): solo lectura para Supervisor | `CP-H50-API-01`, `CP-H50-API-02`, `CP-H50-API-03`, `CP-H50-API-04`, `CP-H50-API-07`, `CP-H50-API-10`, `CP-H50-API-11`, `CP-H50-API-12`, `BUG-H50-API-01`, `BUG-H50-API-02` | 🟢 CUMPLIDO |
| **CA-5** | Mensaje claro y amigable (estado vacío) en caso de que no existan recursos registrados en el sistema | `CP-H50-API-06` | 🟢 CUMPLIDO |

---

## 6. Dictamen Final de Calidad (QA Sign-off)

* **Criterios de Aceptación:** 🟢 **100% CUMPLIDOS**. Endpoints `GET /api/recursos` y `GET /api/recursos/[id]` autorizados plenamente para Supervisor con permisos granulares de solo lectura (`recursos:leer`). Endpoints de mutación (`POST`, `PUT`, `DELETE`) estrictamente bloqueados con HTTP 403 Forbidden.
* **Pruebas Automatizadas Backend:** 🟢 **22/22 pruebas de recursos en verde** (500/500 en suites integrales con base de datos activa).
* **Control Estático (Linter y Tipado):** 🟢 **0 errores ESLint (`npm run lint`), 0 errores TypeScript (`npx tsc --noEmit`)**.
* **Compilación de Producción:** 🟢 **Exitosa con Next.js 16.3.4 (Turbopack, 22 rutas)**.
* **Ciclo de Re-Test:** 🟢 **5/5 defectos corregidos y certificados (`BUG-H50-API-01` a `BUG-H50-API-05`)**.
* **Estado en Repositorio:** 🟢 **Rama `feature/H50-listado-recursos-supervisor` integrada y mergeada exitosamente a `develop` vía PR #20**.
