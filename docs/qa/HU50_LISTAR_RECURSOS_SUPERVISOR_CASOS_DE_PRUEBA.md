# Informe y Matriz de Casos de Prueba de Backend (QA): HU-50 — Listado de Recursos para Supervisor

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Módulo de Inventario Logístico y Autorización RBAC).  
> **Historia de Usuario:** HU-50 — *"Como Supervisor Quiero ver un listado de los recursos Para monitorear la disponibilidad y estado de los recursos de emergencia sin alterar los registros"*.  
> **Servicio API:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest).  
> **Rama Git:** `feature/H50-listado-recursos-supervisor` | **Commit Evaluado:** `afda6c2`  
> **Fecha de Evaluación:** 04 de Octubre de 2026.  
> **Estado de Certificación:** 🟡 **OBSERVADO / EN ESPERA DE MERGE CON DEVELOP Y RENUMERACIÓN DE MIGRACIÓN (SUITE FUNCIONAL 100% PASS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba de API Diseñados y Ejecutados** | **15** |
| **Casos de Prueba Aprobados (Passed)** | **15 (100%)** |
| **Casos de Prueba Fallidos (Failed)** | **0** |
| **Total de Defectos Registrados (Bugs)** | **6** |
| **Defectos Corregidos y Verificados en Re-Test** | **5 (`BUG-H50-API-01` a `BUG-H50-API-05`)** |
| **Defectos Abiertos Pendientes de Corrección** | **1 (`BUG-H50-API-06` - Conflicto de numeración en migración)** |
| **Suite Unitaria Automatizada (`npm test`)** | **22/22 suites pasadas (260/260 tests en verde)** |
| **Pruebas Específicas de RBAC Supervisor** | **5/5 tests aprobados (`supervisor-rbac.test.ts`)** |
| **Compilación de Producción (`next build`)** | **Exitosa (0 errores TypeScript en Turbopack)** |
| **Análisis Estático Linter (`npm run lint`)** | **0 errores, 0 advertencias** |

---

## 2. Registro de Defectos (Bugs) Encontrados en el Ciclo de Desarrollo y QA

Siguiendo el principio de QA de registrar formalmente los incidentes, derivarlos al equipo de desarrollo y realizar el correspondiente **re-test**, a continuación se documentan los 6 defectos detectados en esta historia de usuario para el repositorio `sgrai-api`:

| ID Defecto | Título del Defecto | Tipo / Nivel | Prioridad | Causa Raíz / Comportamiento Anómalo | Solución Aplicada / Commit | Estado |
|---|---|---|:---:|---|---|:---:|
| `BUG-H50-API-01` | Extracción incompleta de token JWT en endpoints individuales de recursos | Seguridad / Auth | Crítica | `GET` y `PUT /api/recursos/[id]` usaban una función síncrona local que no soportaba la verificación asíncrona de JWT Bearer estandarizada. | Reemplazo por `await extraerUsuarioId(req)` centralizado en `auth.guard.ts` (commit `f6716d9`). | 🟢 CORREGIDO |
| `BUG-H50-API-02` | Validación dura por rol Administrador bloqueando acceso a Supervisor | Seguridad / RBAC | Crítica | `recurso.service.ts` invocaba `validarAccesoAdministrador(usuarioId)` sin especificar permisos, denegando acceso con 403 Forbidden a roles de solo lectura. | Delegación de permiso explícito `[PERMISO_LEER_RECURSO]` en consulta de recursos (commit `f6716d9`). | 🟢 CORREGIDO |
| `BUG-H50-API-03` | Ausencia de permiso `recursos:leer` en rol Supervisor y falta de usuario semilla | DB / Semilla | Alta | La base de datos no vinculaba `recursos:leer` al rol Supervisor ni existía un usuario para autenticación con contraseña `Valdivia2026!`. | Creación de migración sembrando permiso en `rol_permiso` y usuario `supervisor@valdivia.cl` (commit `8668864`). | 🟢 CORREGIDO |
| `BUG-H50-API-04` | Omisión de parámetro de consulta `soloLectura` en esquema OpenAPI y contrato Zod | Contrato / OpenAPI | Media | `ListarRecursosQuerySchema` rechazaba el parámetro `soloLectura=true` enviado por clientes de consulta al no estar declarado en el esquema Zod. | Incorporación de preproceso booleano `soloLectura` en Zod y registro en OpenAPI (commit `36b02dd`). | 🟢 CORREGIDO |
| `BUG-H50-API-05` | Acoplamiento de permisos de edición exigiendo rol en vez de permiso `recursos:editar` | Arquitectura / RBAC | Alta | La lógica de edición en `recurso.service.ts` no validaba el permiso granular específico, impidiendo desacoplar roles de lectura y mutación. | Integración del permiso `[PERMISO_EDITAR_RECURSO]` en `validarAccesoAdministrador` (commits `f6716d9` y `afda6c2`). | 🟢 CORREGIDO |
| `BUG-H50-API-06` | Colisión de numeración en migración Kysely por desincronización con `origin/develop` | Integración / DB | Crítica | La migración se nombró `011_supervisor_semilla_y_permisos.ts`, pero en `develop` ya existen las migraciones `011`, `012` y `013`. | **Pendiente desarrollador:** Mergear `origin/develop` y renumerar a `014_supervisor_semilla_y_permisos.ts`. | 🔴 ABIERTO |

---

## 3. Matriz de Casos de Prueba Backend (Para Planilla Excel / Google Sheets)

*(Esta tabla consolida los 6 defectos y los 15 casos de prueba ejecutados para ser exportados a la hoja de cálculo de seguimiento).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-test | Solución / Commit |
|---|---|---|---|:---:|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H50-API-01` | Extracción incompleta de token JWT en endpoints individuales de recursos | Seguridad / Auth | API / Guard | Crítica | Petición con cabecera `Authorization: Bearer <jwt-supervisor>` | `GET /api/recursos/[id]` | Debe extraer el usuario del JWT y autorizar la consulta según permisos vigentes | Fallaba la validación al usar función síncrona local obsoleta | CORREGIDO | 01/10/2026 19:15 | 01/10/2026 20:37 | f6716d9 fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `BUG-H50-API-02` | Validación dura por rol Administrador bloqueando acceso a Supervisor | Seguridad / RBAC | Servicio / RBAC | Crítica | Usuario Supervisor con permiso `recursos:leer` activo | `GET /api/recursos` y `GET /api/recursos/[id]` | HTTP 200 OK con datos del recurso respetando el principio de autorización granular | Retornaba HTTP 403 Forbidden por comprobación estricta de rol | CORREGIDO | 01/10/2026 19:40 | 01/10/2026 20:37 | f6716d9 fix(recursos): estandarizar autenticacion jwt en endpoint recursos por id y validar permisos rbac especificos |
| `BUG-H50-API-03` | Ausencia de permiso recursos:leer en rol Supervisor y falta de usuario semilla | DB / Semilla | Base de Datos | Alta | Base de datos municipal inicializada | Consulta relacional en tablas `usuario` y `rol_permiso` | Rol Supervisor vinculado a `recursos:leer` y cuenta `supervisor@valdivia.cl` habilitada | Rol sin permiso de lectura y usuario supervisor inexistente | CORREGIDO | 01/10/2026 20:00 | 01/10/2026 20:37 | 8668864 feat(recursos): asignar permisos recursos:leer y sembrar cuenta de supervisor en migracion 011 |
| `BUG-H50-API-04` | Omisión de parámetro de consulta soloLectura en esquema OpenAPI y contrato Zod | Contrato / OpenAPI | API / Schema | Media | Consulta con query parameter `soloLectura=true` | `GET /api/recursos?soloLectura=true` | HTTP 200 OK reconociendo el parámetro booleano y documentado en OpenAPI | Parámetro no reconocido o no documentado en la especificación | CORREGIDO | 01/10/2026 20:45 | 01/10/2026 21:10 | 36b02dd feat(recursos): incorporar parametro soloLectura y documentar acceso de supervisor para H50 |
| `BUG-H50-API-05` | Acoplamiento de permisos de edición exigiendo rol en vez de permiso recursos:editar | Arquitectura / RBAC | Servicio / Lógica | Alta | Usuario con `recursos:leer` intentando mutación | `PUT /api/recursos/[id]` | Bloqueo por falta de `recursos:editar` con mensaje descriptivo y código HTTP 403 | Comprobación acoplada al rol sin validar permiso específico | CORREGIDO | 01/10/2026 21:15 | 01/10/2026 22:00 | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `BUG-H50-API-06` | Colisión de numeración en migración Kysely por desincronización con origin/develop | Integración / DB | Base de Datos | Crítica | Rama origin/develop actualizada con migraciones 011, 012 y 013 | Inspeccionar carpeta `src/lib/db/migrations/` | Las migraciones deben tener orden secuencial estricto sin colisión de prefijos numéricos | Colisión de nombre con migración 011 existente en develop | ABIERTO | 04/10/2026 19:50 | - | Pendiente dev (Mergear origin/develop y renumerar a 014_supervisor_semilla_y_permisos.ts) |
| `CP-H50-API-01` | Consulta autorizada de inventario para Supervisor con token JWT Bearer | Funcional / Auth | API / Route | Crítica | Usuario Supervisor activo con token JWT válido | `GET /api/recursos` con header `Authorization: Bearer <jwt>` | HTTP 200 OK con payload `{ data: [...], meta: {...} }` | HTTP 200 OK con listado paginado y metadatos correctos | APROBADO | 04/10/2026 19:10 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-02` | Consulta autorizada de inventario mediante cabecera de fallback X-User-Id del Supervisor | Compatibilidad / Auth | API / Header | Alta | UUID de supervisor provisto en cabecera | `GET /api/recursos` con `x-user-id: 00000000-0000-4000-8000-000000000010` | HTTP 200 OK reconociendo la identidad institucional del usuario | HTTP 200 OK autorizado correctamente | APROBADO | 04/10/2026 19:12 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-03` | Bloqueo de consulta de recursos por ausencia total de credenciales | Seguridad / Auth | API / Guard | Crítica | Petición sin cabeceras de autorización | `GET /api/recursos` (sin token ni x-user-id) | HTTP 401 Unauthorized con mensaje descriptivo | HTTP 401 "Se requiere cabecera de autenticación..." | APROBADO | 04/10/2026 19:14 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-04` | Bloqueo de consulta de recursos para roles sin permiso recursos:leer (Call Center) | Seguridad / RBAC | API / Permisos | Crítica | Usuario autenticado con rol Call Center u Observador | `GET /api/recursos` con credenciales de Call Center | HTTP 403 Forbidden con detalle de permisos insuficientes | HTTP 403 "Acceso denegado. Se requiere el perfil de Administrador o permisos..." | APROBADO | 04/10/2026 19:16 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-05` | Recepción y validación de parámetro soloLectura=true en query string | Contrato / Zod | API / Query | Media | Query parameter booleano en solicitud | `GET /api/recursos?pagina=1&limite=10&soloLectura=true` | HTTP 200 OK procesando el parámetro sin rechazo de esquema Zod | HTTP 200 OK con payload válido procesado | APROBADO | 04/10/2026 19:18 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-06` | Manejo de inventario vacío (Empty State) retornando payload consistente | Funcional / Robustez | API / Payload | Alta | Base de datos sin recursos registrados | `GET /api/recursos?pagina=1&limite=10` | HTTP 200 OK con `data: []`, `meta.total: 0` y `meta.totalPaginas: 0` | HTTP 200 OK con arreglo vacío y metadatos en cero | APROBADO | 04/10/2026 19:20 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-07` | Consulta autorizada de ficha técnica de recurso individual para Supervisor | Funcional / RBAC | API / Route | Alta | ID válido de recurso existente en base de datos | `GET /api/recursos/e1000000-0000-4000-8000-000000000001` con token Supervisor | HTTP 200 OK con ficha completa (detalles, stock, coordenadas y delegación) | HTTP 200 OK con objeto íntegro del recurso | APROBADO | 04/10/2026 19:22 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-08` | Consulta de recurso individual inexistente retornando HTTP 404 Not Found | Robustez / Manejo Error | API / Route | Media | UUID aleatorio sin coincidencia en BD | `GET /api/recursos/00000000-9999-4000-8000-000000000099` | HTTP 404 Not Found con mensaje "Recurso no encontrado" | HTTP 404 retornado limpiamente | APROBADO | 04/10/2026 19:24 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-09` | Validación de formato UUID en parámetro de ruta [id] ante identificador malformado | Validación / Zod | API / Params | Media | Cadena no UUID en URL (ej. "abc-123") | `GET /api/recursos/abc-123` | HTTP 400 Bad Request indicando formato UUID requerido | HTTP 400 con detalle descriptivo de Zod | APROBADO | 04/10/2026 19:26 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-10` | Bloqueo de creación de recursos para perfil Supervisor (Restricción Solo Lectura) | Seguridad / Mutación | API / POST | Crítica | Intento de alta por usuario con rol Supervisor | `POST /api/recursos` con datos válidos de recurso | HTTP 403 Forbidden por carecer de permiso `recursos:crear` | HTTP 403 "Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:crear" | APROBADO | 04/10/2026 19:28 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-11` | Bloqueo de edición de recursos para perfil Supervisor (Restricción Solo Lectura) | Seguridad / Mutación | API / PUT | Crítica | Intento de actualización de recurso por Supervisor | `PUT /api/recursos/[id]` con modificaciones de stock | HTTP 403 Forbidden por carecer de permiso `recursos:editar` | HTTP 403 "Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:editar" | APROBADO | 04/10/2026 19:30 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-12` | Cálculo exacto de disponibilidad operativa (cantidadDisponible) | Lógica de Negocio | Servicio / Cálculo | Alta | Recurso con inventario total y unidades en uso | Stock: 5, En uso: 2 | Campo `cantidadDisponible` calculado automáticamente en 3 | `cantidadDisponible: 3` en payload de respuesta | APROBADO | 04/10/2026 19:32 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-13` | Cruce relacional JOIN con tabla delegacion retornando entidad territorial | Integración / DB | Base de Datos | Alta | Recurso asociado a `DEL_NORTE` | Consulta a endpoint de recursos | Objeto `delegacion` poblado con `id`, `codigo` y `nombre` oficial | `delegacion: { id, codigo: "DEL_NORTE", nombre: "Delegación Municipal Norte" }` | APROBADO | 04/10/2026 19:34 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-14` | Filtrado en servidor por estado operativo, delegación y búsqueda textual | Funcional / Filtros | API / Query | Alta | Inventario con múltiples recursos sembrados | `?estado=DISPONIBLE&delegacionId=...&busqueda=Bomba` | La consulta SQL filtra por cláusulas WHERE combinadas y retorna solo coincidencias | Filtro combinado ejecutado con exactitud en Kysely | APROBADO | 04/10/2026 19:36 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |
| `CP-H50-API-15` | Sincronización de especificación OpenAPI 3.0 con contratos de HU-50 | Contrato / OpenAPI | API / Spec | Alta | Servidor levantado en puerto 3001 | `GET /openapi.json` | Ruta `/api/recursos` documentada con soporte de permisos de Supervisor y parámetro soloLectura | Especificación OpenAPI 3.0 completa y tipada | APROBADO | 04/10/2026 19:38 | - | afda6c2 docs(recursos): formalizar principio de autorizacion estricta por permisos y no por rol |

---

## 4. Detalle del Defecto Activo a Devolver a los Desarrolladores (`BUG-H50-API-06`)

### 📋 Ficha de Defecto de QA:
* **Identificador:** `BUG-H50-API-06`
* **Severidad / Prioridad:** Crítica (Riesgo de corrupción o falla de migraciones en despliegue)
* **Archivo afectado:** `src/lib/db/migrations/011_supervisor_semilla_y_permisos.ts`
* **Causa Raíz:**
  La rama `feature/H50-listado-recursos-supervisor` se desincronizó de `origin/develop`. En `origin/develop`, ya fueron fusionadas previamente las siguientes migraciones:
  * `011_reporte_terreno_y_adjuntos.ts` (HU-17)
  * `012_prevencion_riesgo_prioridad.ts` (HU-57)
  * `013_indices_kpis_incidentes.ts` (HU-18)
  
  Al tener esta rama una migración nombrada con el prefijo `011_`, si se intenta mergear a `develop`, existirá una colisión de prefijos numéricos que romperá el orden secuencial de Kysely.

### Instrucción para el Equipo de Desarrollo:
1. Actualizar la rama con `origin/develop`:
   ```bash
   git fetch origin
   git merge origin/develop
   ```
2. Renumerar el archivo de migración:
   * **Nombre actual:** `src/lib/db/migrations/011_supervisor_semilla_y_permisos.ts`
   * **Nuevo nombre requerido:** `src/lib/db/migrations/014_supervisor_semilla_y_permisos.ts`
3. Ejecutar `npm test` y `npm run db:migrate` para certificar que todas las 14 migraciones corran limpiamente en orden secuencial.
4. Notificar a QA para ejecutar el **Re-Test** de `BUG-H50-API-06` y autorizar la aprobación del Pull Request.

---

## 5. Dictamen de Calidad de Backend (QA Sign-off)

* **Funcionalidad y Criterios de Aceptación:** 🟢 **100% CUMPLIDOS**. Endpoints de lectura accesibles para Supervisor (`recursos:leer`), endpoints de mutación estrictamente bloqueados con HTTP 403 (`recursos:crear`, `recursos:editar`).
* **Suites de Pruebas Automatizadas:** 🟢 **260/260 pruebas pasando (22 suites en verde)**.
* **Compilación de Producción:** 🟢 **Exitosa con Next.js Turbopack**.
* **Linter de Código:** 🟢 **0 errores, 0 advertencias**.
* **Integración con Develop y Migraciones:** 🔴 **OBSERVADO**. Requiere merge con `origin/develop` y renumeración de migración a `014_` (`BUG-H50-API-06`).
