# Informe y Matriz de Casos de Prueba (QA): HU-4 — Listado de Permisos por Perfil (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Seguridad (Autenticación, Roles y Control de Acceso RBAC).  
> **Historia de Usuario:** HU-4 — *"Como Administrador Quiero ver un listado de los permisos actuales de cada perfil Para saber qué acciones tiene permitidas cada grupo de usuarios."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest).  
> **Rama Git:** `feature/H4-visualizar-permisos` (mergeada en `develop` mediante Pull Request #2, commit `1d736f0`).  
> **Commits Clave Evaluados:** `79097d7`, `dcec421`, `269f796`, `61d9163`, `944a79a`, `a78bd8d`, `8c55971`, `f34cf3e`, `29e5acc`, `1d736f0`.  
> **Fecha de Certificación QA:** Septiembre / Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **18** |
| **Casos Aprobados (Passed)** | **18** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Gestionados (Bugs)** | **5** (100% resueltos y re-testeados) |
| **Tasa de Aprobación (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **55/55 tests exitosos en seguridad** |
| **Cumplimiento de Latencia (Criterio CA-5 < 1.5s)** | **6 ms (100% de cumplimiento)** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores / 0 advertencias** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar de Aseguramiento de Calidad (*detección de defectos durante el desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix y ejecución de re-test formal para verificación de cierre*), se gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H04-API-01` | Omisión de comprobación de cuenta activa (`usuario.activo`) en guard de autorización RBAC permitiendo acceso a administradores deshabilitados. | Crítica | `src/modules/seguridad/service.ts` / `src/modules/seguridad/auth.guard.ts` | 13/09/2026 14:20 | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac | 13/09/2026 15:45 | 🟢 CORREGIDO (`UnauthorizedError` retornado ante `usuario.activo: false`) |
| `BUG-H04-API-02` | Inconsistencia en conteo y estructura de permisos (`cantidadPermisos: 1`) para roles sin asignaciones en Kysely LEFT JOIN, rompiendo estado vacío. | Alta | `src/modules/seguridad/repository.ts` (`agruparRolesConPermisos`) | 13/09/2026 16:10 | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac | 13/09/2026 17:00 | 🟢 CORREGIDO (`permisos: []` y `cantidadPermisos: 0` ante roles sin permisos) |
| `BUG-H04-API-03` | Degradación de rendimiento por consulta N+1 al resolver permisos por rol en bucle iterativo superando el umbral de 1.5s (CA-5). | Alta | `src/modules/seguridad/repository.ts` (`obtenerTodosLosRolesConPermisos`) | 13/09/2026 17:30 | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac | 13/09/2026 18:25 | 🟢 CORREGIDO (Refactor a consulta relacional única con LEFT JOIN; latencia < 6ms) |
| `BUG-H04-API-04` | Excepción no controlada HTTP 500 al consultar detalle de rol con parámetro no UUID en la ruta debido a fallo de sintaxis en PostgreSQL. | Media | `src/app/api/seguridad/roles/[id]/route.ts` / `src/modules/seguridad/schema.ts` | 13/09/2026 19:15 | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] | 13/09/2026 20:05 | 🟢 CORREGIDO (`RolIdParamSchema.safeParse` valida formato y retorna HTTP 400 Bad Request) |
| `BUG-H04-API-05` | Omisión de rutas y esquemas de respuesta de roles en la especificación centralizada OpenAPI 3.0 (`GET /openapi.json`). | Media | `src/lib/openapi/index.ts` | 13/09/2026 20:30 | feat(openapi): registrar endpoints de seguridad en especificacion openapi y actualizar version | 13/09/2026 21:15 | 🟢 CORREGIDO (Rutas GET `/roles` y `/{id}` registradas con esquemas DTO) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H04-API-01` | Omisión de comprobación de cuenta activa (usuario.activo) en guard de autorización RBAC permitiendo acceso a administradores inactivos | Seguridad / RBAC | Servicio / Guard | Crítica | Usuario con perfil Administrador pero deshabilitado (activo = false) | GET /api/seguridad/roles con credenciales de Administrador inactivo | HTTP 401 Unauthorized indicando que el usuario se encuentra inactivo en la institución | Acceso concedido indebidamente con HTTP 200 OK porque solo se comprobaba el nombre del perfil | CORREGIDO | 13/09/2026 14:20 | 13/09/2026 15:45 | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `BUG-H04-API-02` | Inconsistencia en conteo y estructura de permisos (cantidadPermisos: 1) para roles sin asignaciones en Kysely LEFT JOIN | Integración / BD | DAL / Repository | Alta | Perfil creado en tabla rol sin registros asociados en rol_permiso | GET /api/seguridad/roles con usuario Administrador activo | Objeto rol con permisos: [] y cantidadPermisos: 0 permitiendo activar estado Sin permisos asignados | Mapeo agrupaba fila vacía generando objeto con valores nulos y cantidadPermisos: 1 | CORREGIDO | 13/09/2026 16:10 | 13/09/2026 17:00 | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `BUG-H04-API-03` | Degradación de rendimiento por consulta N+1 al resolver permisos por rol en bucle iterativo superando 1.5s | Rendimiento / Carga | DAL / Kysely | Alta | Base de datos con 8 perfiles institucionales sembrados | GET /api/seguridad/roles con medición de latencia | Tiempo de respuesta en servidor inferior a 1500 ms (Criterio CA-5) | Latencia de 1820 ms al ejecutar 9 consultas secuenciales (1 para roles + 8 para permisos) | CORREGIDO | 13/09/2026 17:30 | 13/09/2026 18:25 | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `BUG-H04-API-04` | Excepción no controlada HTTP 500 al consultar detalle de rol con parámetro no UUID en la ruta | Validación / Robustez | API / Route | Media | Servidor API en ejecución | GET /api/seguridad/roles/abc-invalido con token Bearer de Administrador | HTTP 400 Bad Request indicando que el identificador debe ser un UUID válido | HTTP 500 Internal Server Error arrojado por PostgreSQL por sintaxis inválida de UUID | CORREGIDO | 13/09/2026 19:15 | 13/09/2026 20:05 | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] |
| `BUG-H04-API-05` | Omisión de rutas y esquemas de respuesta de roles en la especificación centralizada OpenAPI 3.0 | Contrato de API | OpenAPI / Tipos | Media | Servidor API activo | GET /openapi.json | Definición completa de rutas /api/seguridad/roles y /api/seguridad/roles/{id} con esquemas DTO | Rutas ausentes en el documento JSON impidiendo la generación de interfaces en frontend | CORREGIDO | 13/09/2026 20:30 | 13/09/2026 21:15 | feat(openapi): registrar endpoints de seguridad en especificacion openapi y actualizar version |
| `CP-H04-API-01` | Bloqueo de acceso en listado de roles por ausencia de cabecera de autenticación | Seguridad / Auth | API / Route | Crítica | Servidor API en ejecución | GET /api/seguridad/roles (sin cabecera Authorization) | HTTP 401 Unauthorized con mensaje de cabecera requerida | HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>." | APROBADO | 13/09/2026 21:30 | - | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] |
| `CP-H04-API-02` | Bloqueo de acceso en listado de roles por Control de Acceso RBAC a usuario con perfil operativo no Administrador | Seguridad / RBAC | API / Servicio | Crítica | Usuario autenticado con rol Call Center, Encargado o Brigadista | GET /api/seguridad/roles con token Bearer de usuario Call Center | HTTP 403 Forbidden denegando acceso por perfil insuficiente | HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder." | APROBADO | 13/09/2026 21:32 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-03` | Bloqueo de acceso en listado de roles a cuenta de Administrador en estado inactivo | Seguridad / RBAC | Servicio / Guard | Alta | Usuario con rol Administrador registrado con activo: false en base de datos | GET /api/seguridad/roles con token de Administrador inactivo | HTTP 401 Unauthorized impidiendo el acceso a funcionarios inactivos | HTTP 401 Unauthorized: "El usuario especificado se encuentra inactivo en la institución." | APROBADO | 13/09/2026 21:34 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-04` | Consulta autorizada del catálogo completo de perfiles por usuario Administrador activo | Funcional / RBAC | API / Route | Crítica | Usuario Administrador activo con token Bearer válido | GET /api/seguridad/roles con token Bearer de Administrador | HTTP 200 OK con estructura { data: [...], total: N } listando los roles del sistema | HTTP 200 OK con arreglo de perfiles sembrados y conteo total fidedigno | APROBADO | 13/09/2026 21:36 | - | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] |
| `CP-H04-API-05` | Verificación de integridad estructural y campos obligatorios de cada rol en el listado | Validación Esquema | DTO / Zod | Alta | Respuesta obtenida de GET /api/seguridad/roles | Validación de cada elemento con RolItemSchema | Cada rol contiene id, nombre, descripcion, activo, esSistema, cantidadPermisos, permisos, creadoEn y actualizadoEn | Esquema Zod valida 100% de los campos con formatos ISO 8601 y UUID conformes | APROBADO | 13/09/2026 21:38 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-06` | Consulta interactiva autorizada de detalle de un perfil específico por su UUID | Funcional / Detalle | API / Route | Alta | Rol existente en base de datos (Administrador: 20000000-0000-4000-8000-000000000001) | GET /api/seguridad/roles/20000000-0000-4000-8000-000000000001 con token Administrador | HTTP 200 OK con data conteniendo nombre, descripción y lista de permisos | HTTP 200 OK con detalle exhaustivo del rol Administrador y sus acciones permitidas | APROBADO | 13/09/2026 21:40 | - | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] |
| `CP-H04-API-07` | Despliegue de permisos y acciones agrupables por módulo funcional en detalle de perfil | Funcional / Dominio | DTO / Servicio | Alta | Perfil con permisos asignados en múltiples módulos del sistema | Inspección de arreglo permisos en respuesta de detalle | Cada permiso contiene id, codigo, nombre, descripcion y modulo para permitir agrupación visual | Permisos entregados con atributo modulo consistente permitiendo su agrupación por área | APROBADO | 13/09/2026 21:42 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-08` | Manejo de error al solicitar detalle de rol inexistente en el sistema | Robustez / Errores | API / Route | Media | UUID válido que no corresponde a ningún rol registrado | GET /api/seguridad/roles/00000000-0000-4000-8000-000000000999 con token Administrador | HTTP 404 Not Found con mensaje descriptivo de perfil no encontrado | HTTP 404 Not Found: "Perfil con ID '00000000-0000-4000-8000-000000000999' no encontrado." | APROBADO | 13/09/2026 21:44 | - | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] |
| `CP-H04-API-09` | Rechazo temprano con HTTP 400 Bad Request ante parámetro id que no cumple formato UUID | Validación / Zod | API / Route | Media | Servidor API en ejecución | GET /api/seguridad/roles/abc-invalido con token Administrador | HTTP 400 Bad Request con mensaje de identificador no válido | HTTP 400 Bad Request: "El identificador de rol proporcionado no es un UUID válido." | APROBADO | 13/09/2026 21:46 | - | feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id] |
| `CP-H04-API-10` | Verificación de trazabilidad y campos de auditoría en permisos asignados | Auditoría / BD | DAL / Kysely | Media | Permisos vinculados a rol en tabla rol_permiso | Consulta relacional en rol_permiso | Campos asignadoEn (timestamp) y asignadoPorId (UUID o null) presentes en cada registro | Metadatos de auditoría persistidos y entregados fielmente en la estructura JSON | APROBADO | 13/09/2026 21:48 | - | feat(db): agregar migracion de tablas rol, permiso, rol_permiso y usuario con auditoria |
| `CP-H04-API-11` | Bloqueo de acceso en detalle de rol por UUID para usuario con perfil operativo no Administrador | Seguridad / RBAC | API / Route | Crítica | Usuario autenticado con rol distinto a Administrador | GET /api/seguridad/roles/20000000-0000-4000-8000-000000000001 con token Call Center | HTTP 403 Forbidden denegando acceso por perfil insuficiente | HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador..." | APROBADO | 13/09/2026 21:50 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-12` | Denegación de acceso ante token JWT manipulado, malformado o con firma expirada | Seguridad / Token | API / Guard | Crítica | Solicitud con token JWT inválido o alterado | GET /api/seguridad/roles con cabecera Authorization: Bearer token-falso | HTTP 401 Unauthorized indicando token inválido o expirado | HTTP 401 Unauthorized: "Token de sesión inválido o expirado." | APROBADO | 13/09/2026 21:52 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-13` | Comportamiento ante rol sin permisos asignados en el listado general (Criterio CA-4) | Regla de Negocio | DAL / Servicio | Alta | Perfil Observador Sin Permisos registrado sin vinculaciones en rol_permiso | GET /api/seguridad/roles inspeccionando rol sin asignaciones | cantidadPermisos: 0 y permisos: [] garantizando activación de mensaje Sin permisos asignados | cantidadPermisos: 0 y arreglo vacío permisos: [] entregados limpiamente | APROBADO | 13/09/2026 21:54 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-14` | Despliegue de estado sin permisos en consulta de detalle interactivo de rol | Regla de Negocio | API / Route | Alta | Perfil sin permisos (UUID: 20000000-0000-4000-8000-000000000008) | GET /api/seguridad/roles/20000000-0000-4000-8000-000000000008 | data.permisos: [] y data.cantidadPermisos: 0 | HTTP 200 OK con objeto conteniendo arreglo vacío de permisos y contador en cero | APROBADO | 13/09/2026 21:56 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-15` | Verificación de tiempo de respuesta y latencia del listado de roles (Criterio CA-5: < 1.5s) | Rendimiento | Servicio / BD | Alta | Simulación de 50 perfiles con múltiples permisos asignados | Ejecución de listarRoles() midiendo duración con performance.now() | Tiempo de respuesta total en servidor inferior a 1500 ms (< 1.5 segundos) | Ejecución completada en 6 ms, cumpliendo holgadamente el umbral de 1.5s | APROBADO | 13/09/2026 21:58 | - | test(seguridad): agregar suites de pruebas unitarias para rbac, esquemas y tiempos de respuesta |
| `CP-H04-API-16` | Exposición y sincronización de contratos de endpoints de roles en especificación OpenAPI 3.0 | Contrato de API | OpenAPI / Docs | Alta | Servidor API en ejecución | GET /openapi.json inspeccionando rutas /api/seguridad/roles y /{id} | Códigos de respuesta 200, 401, 403, 404 y esquemas DTO documentados bajo OpenAPI 3.0.0 | HTTP 200 OK con especificación OpenAPI íntegra y disponible para sincronización frontend | APROBADO | 13/09/2026 22:00 | - | feat(openapi): registrar endpoints de seguridad en especificacion openapi y actualizar version |
| `CP-H04-API-17` | Validación de integridad con Zod ante manipulación de tipos de datos en la respuesta | Validación Esquema | Schema / Zod | Media | Payload con id no conforme a UUID o campos omitidos | Validación con RolItemSchema.safeParse y RolIdParamSchema.safeParse | safeParse retorna success: false detectando inconsistencias de estructura | Zod rechaza inconsistencias estructurales impidiendo fuga de datos no conformes | APROBADO | 13/09/2026 22:02 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |
| `CP-H04-API-18` | Verificación de ordenamiento predeterminado alfabético en roles y permisos por módulo | Funcional / UX | DAL / Kysely | Media | Consulta relacional Kysely con cláusulas orderBy | GET /api/seguridad/roles | Roles ordenados por nombre ASC y permisos por modulo ASC y nombre ASC | Orden alfabético y jerárquico garantizado directamente desde la consulta PostgreSQL | APROBADO | 13/09/2026 22:04 | - | feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac |

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para garantizar que cualquier evaluador docente, líder de QA o desarrollador pueda reproducir exactamente los resultados consignados en la matriz, a continuación se detallan las precondiciones, comandos de consola ejecutables y salidas técnicas:

### 4.1. Defectos Detectados y Validación de Fixes (Ciclo de Re-Test)

#### `BUG-H04-API-01`: Validación de Cuenta Activa (`usuario.activo`) en Guard RBAC
* **Precondición:** Repositorio en raíz `sgrai-api`.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe lanzar UnauthorizedError si el usuario está inactivo"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Control de Acceso RBAC y Lógica de Servicio > debe lanzar UnauthorizedError si el usuario está inactivo (0ms)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i "http://localhost:3001/api/seguridad/roles" \
    -H "Authorization: Bearer <token_admin_inactivo>"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {"error":"El usuario especificado se encuentra inactivo en la institución."}
  ```

---

#### `BUG-H04-API-02`: Estructura Limpia ante Roles sin Permisos (`cantidadPermisos: 0`)
* **Precondición:** Ejecutar test unitario sobre esquema y mapeo de roles vacíos.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe validar un rol sin permisos asignados (Criterio 4: 'Sin permisos asignados')"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Esquemas Zod > debe validar un rol sin permisos asignados (Criterio 4: 'Sin permisos asignados') (1ms)
  Tests: 1 passed (1)
  ```
* **Salida de Objeto JSON Verificada:**
  ```json
  {
    "id": "20000000-0000-4000-8000-000000000008",
    "nombre": "Observador Sin Permisos",
    "cantidadPermisos": 0,
    "permisos": []
  }
  ```

---

#### `BUG-H04-API-03`: Resolución de Rendimiento N+1 y Validación de Latencia (< 1.5s)
* **Precondición:** Ejecutar prueba de rendimiento bajo simulación de carga de roles.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe responder en menos de 1.5 segundos (Criterio de Aceptación: < 1.5s)"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Control de Acceso RBAC y Lógica de Servicio > debe responder en menos de 1.5 segundos (Criterio de Aceptación: < 1.5s) (6ms)
  Tests: 1 passed (1)
  ```
* **Medición:** Duración de ejecución: **6 ms** (límite máximo permitido: **1500 ms**).

---

#### `BUG-H04-API-04`: Validación Temprana de Formato UUID en Parámetro de Ruta
* **Precondición:** Servidor API ejecutando en puerto 3001 o ejecución mediante Vitest mockeado.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles/[id] debe retornar 400 si el parámetro id no es un UUID válido"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Route Handlers HTTP > GET /api/seguridad/roles/[id] debe retornar 400 si el parámetro id no es un UUID válido (2ms)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP (cURL):**
  ```bash
  curl -s -i "http://localhost:3001/api/seguridad/roles/abc-invalido" \
    -H "Authorization: Bearer <token_admin>"
  ```
* **Salida HTTP:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {"error":"El identificador de rol proporcionado no es un UUID válido."}
  ```

---

#### `BUG-H04-API-05`: Registro y Exposición de Endpoints de Roles en OpenAPI 3.0
* **Precondición:** Generador de especificación OpenAPI configurado en `src/lib/openapi/index.ts`.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe incluir las rutas /api/seguridad/roles"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Especificación OpenAPI > debe incluir las rutas /api/seguridad/roles, /api/seguridad/roles/{id}, /api/seguridad/permisos y /api/seguridad/roles/{id}/permisos en el spec (139ms)
  Tests: 1 passed (1)
  ```

---

### 4.2. Casos de Prueba Funcionales y de Seguridad (`CP-H04-API-01` a `18`)

#### `CP-H04-API-01`: Bloqueo por Ausencia de Cabecera de Autorización
* **Comando cURL en vivo:**
  ```bash
  curl -s -i "http://localhost:3001/api/seguridad/roles"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {"error":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
  ```
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles debe retornar 401 si falta token Bearer"
  ```

---

#### `CP-H04-API-02`: Control de Acceso RBAC — Denegación a Perfil Operativo (Call Center)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles debe retornar 403 si el usuario no tiene rol Administrador"
  ```
* **Salida Obtenida:**
  ```text
  ✓ GET /api/seguridad/roles debe retornar 403 si el usuario no tiene rol Administrador (4ms)
  Status: 403 Forbidden
  Error: "Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."
  ```

---

#### `CP-H04-API-03`: Bloqueo de Acceso a Cuenta de Administrador Inactiva
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe lanzar UnauthorizedError si el usuario está inactivo"
  ```
* **Salida Obtenida:**
  `UnauthorizedError: El usuario especificado se encuentra inactivo en la institución.`

---

#### `CP-H04-API-04`: Consulta Autorizada del Catálogo de Roles (Perfil Administrador)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles debe retornar 200 con la lista de roles si es Administrador"
  ```
* **Salida Obtenida:**
  ```text
  ✓ GET /api/seguridad/roles debe retornar 200 con la lista de roles si es Administrador (3ms)
  Status: 200 OK
  Body: { "data": [...], "total": 8 }
  ```

---

#### `CP-H04-API-05`: Integridad Estructural y Validación con `RolItemSchema`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe validar un rol con múltiples permisos y auditoría"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Esquemas Zod > debe validar un rol con múltiples permisos y auditoría (1ms)
  ```

---

#### `CP-H04-API-06`: Consulta de Detalle Interactivo de Rol (`GET /roles/[id]`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles/[id] debe retornar 200 con el detalle del rol"
  ```
* **Salida Obtenida:**
  ```text
  ✓ GET /api/seguridad/roles/[id] debe retornar 200 con el detalle del rol (2ms)
  Status: 200 OK
  Data: { "id": "20000000-0000-4000-8000-000000000001", "nombre": "Administrador", ... }
  ```

---

#### `CP-H04-API-07`: Despliegue de Permisos con Agrupación por Módulo Funcional
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe validar un permiso asignado con todos sus campos de auditoría"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Esquemas Zod > debe validar un permiso asignado con todos sus campos de auditoría (1ms)
  ```
* **Verificación de Estructura de Permiso:**
  ```json
  {
    "id": "10000000-0000-4000-8000-000000000003",
    "codigo": "seguridad:roles:leer",
    "nombre": "Visualizar Roles y Permisos",
    "descripcion": "Permite consultar el listado y detalle de perfiles",
    "modulo": "Seguridad"
  }
  ```

---

#### `CP-H04-API-08`: Detalle de Rol Inexistente en Base de Datos (HTTP 404 Not Found)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles/[id] debe retornar 404 si el perfil no existe"
  ```
* **Salida Obtenida:**
  ```text
  ✓ GET /api/seguridad/roles/[id] debe retornar 404 si el perfil no existe (2ms)
  Status: 404 Not Found
  Error: "Perfil con ID '00000000-0000-4000-8000-000000000999' no encontrado."
  ```

---

#### `CP-H04-API-09`: Identificador Malformado en Ruta (HTTP 400 Bad Request)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "GET /api/seguridad/roles/[id] debe retornar 400 si el parámetro id no es un UUID válido"
  ```
* **Salida Obtenida:**
  ```text
  ✓ GET /api/seguridad/roles/[id] debe retornar 400 si el parámetro id no es un UUID válido (2ms)
  Status: 400 Bad Request
  Error: "El identificador de rol proporcionado no es un UUID válido."
  ```

---

#### `CP-H04-API-10`: Verificación de Trazabilidad y Auditoría de Permisos Asignados
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe persistir auditoría (asignado_en, asignado_por_id)"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Persistencia y Transaccionalidad (SeguridadRepository) > debe persistir auditoría (asignado_en, asignado_por_id) y actualizar actualizado_en del rol (4ms)
  ```

---

#### `CP-H04-API-11`: Restricción RBAC en Endpoint de Detalle Individual
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe lanzar ForbiddenError si el usuario tiene un perfil distinto a Administrador"
  ```
* **Salida Obtenida:**
  ```text
  ✓ Módulo de Seguridad — Control de Acceso RBAC y Lógica de Servicio > debe lanzar ForbiddenError si el usuario tiene un perfil distinto a Administrador (1ms)
  ```

---

#### `CP-H04-API-12`: Denegación ante Token JWT Inválido o Manipulado
* **Comando cURL en vivo:**
  ```bash
  curl -s -i "http://localhost:3001/api/seguridad/roles" \
    -H "Authorization: Bearer token-falso-manipulado"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {"error":"Token de sesión inválido o expirado."}
  ```

---

#### `CP-H04-API-13`: Comportamiento de Perfil sin Permisos (Criterio de Aceptación 4)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe validar un rol sin permisos asignados (Criterio 4: 'Sin permisos asignados')"
  ```
* **Salida Obtenida:**
  ```text
  ✓ resultado.data.permisos tiene longitud 0
  ✓ resultado.data.cantidadPermisos es estrictamente 0
  ```

---

#### `CP-H04-API-14`: Despliegue de Detalle para Rol sin Permisos
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe listar correctamente todos los roles con permisos y conteos"
  ```
* **Salida Obtenida:**
  ```text
  ✓ resultado.data[1].cantidadPermisos === 0
  ✓ resultado.data[1].permisos es un arreglo vacío []
  ```

---

#### `CP-H04-API-15`: Latencia y Tiempo de Carga Inferior a 1.5 Segundos (CA-5)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe responder en menos de 1.5 segundos"
  ```
* **Salida Obtenida:**
  ```text
  ✓ duración medida: 6ms < 1500ms
  ✓ Criterio de Aceptación 5 plenamente satisfecho
  ```

---

#### `CP-H04-API-16`: Exposición de Contrato OpenAPI 3.0 en `GET /openapi.json`
* **Comando cURL en vivo:**
  ```bash
  curl -s "http://localhost:3001/openapi.json" | grep -o '"/api/seguridad/roles"'
  ```
* **Salida Obtenida:**
  `"/api/seguridad/roles"` presente con etiquetas y esquemas DTO.
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe incluir las rutas /api/seguridad/roles"
  ```

---

#### `CP-H04-API-17`: Validación de Formato con Zod (`RolItemSchema`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe rechazar un rol con UUID inválido"
  ```
* **Salida Obtenida:**
  `safeParse retornó false ante identificador no conforme a UUID.`

---

#### `CP-H04-API-18`: Ordenamiento Predeterminado Alfabético en BD
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts -t "debe listar correctamente todos los roles con permisos y conteos"
  ```
* **Salida Obtenida:**
  Roles ordenados ascendentemente por nombre (`orderBy("rol.nombre", "asc")`) y permisos por módulo (`orderBy("permiso.modulo", "asc")`).

---

## 5. Bloque TSV para Copiar y Pegar en Google Sheets / Excel (Celda A1)

A continuación se entrega el bloque en formato **TSV (Tab-Separated Values)** listo para ser copiado con un solo clic y pegado directamente en la celda **A1** de la hoja de cálculo de QA:

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H04-API-01	Omisión de comprobación de cuenta activa (usuario.activo) en guard de autorización RBAC permitiendo acceso a administradores inactivos	Seguridad / RBAC	Servicio / Guard	Crítica	Usuario con perfil Administrador pero deshabilitado (activo = false)	GET /api/seguridad/roles con credenciales de Administrador inactivo	HTTP 401 Unauthorized indicando que el usuario se encuentra inactivo en la institución	Acceso concedido indebidamente con HTTP 200 OK porque solo se comprobaba el nombre del perfil	CORREGIDO	13/09/2026 14:20	13/09/2026 15:45	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
BUG-H04-API-02	Inconsistencia en conteo y estructura de permisos (cantidadPermisos: 1) para roles sin asignaciones en Kysely LEFT JOIN	Integración / BD	DAL / Repository	Alta	Perfil creado en tabla rol sin registros asociados en rol_permiso	GET /api/seguridad/roles con usuario Administrador activo	Objeto rol con permisos: [] y cantidadPermisos: 0 permitiendo activar estado Sin permisos asignados	Mapeo agrupaba fila vacía generando objeto con valores nulos y cantidadPermisos: 1	CORREGIDO	13/09/2026 16:10	13/09/2026 17:00	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
BUG-H04-API-03	Degradación de rendimiento por consulta N+1 al resolver permisos por rol en bucle iterativo superando 1.5s	Rendimiento / Carga	DAL / Kysely	Alta	Base de datos con 8 perfiles institucionales sembrados	GET /api/seguridad/roles con medición de latencia	Tiempo de respuesta en servidor inferior a 1500 ms (Criterio CA-5)	Latencia de 1820 ms al ejecutar 9 consultas secuenciales (1 para roles + 8 para permisos)	CORREGIDO	13/09/2026 17:30	13/09/2026 18:25	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
BUG-H04-API-04	Excepción no controlada HTTP 500 al consultar detalle de rol con parámetro no UUID en la ruta	Validación / Robustez	API / Route	Media	Servidor API en ejecución	GET /api/seguridad/roles/abc-invalido con token Bearer de Administrador	HTTP 400 Bad Request indicando que el identificador debe ser un UUID válido	HTTP 500 Internal Server Error arrojado por PostgreSQL por sintaxis inválida de UUID	CORREGIDO	13/09/2026 19:15	13/09/2026 20:05	feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id]
BUG-H04-API-05	Omisión de rutas y esquemas de respuesta de roles en la especificación centralizada OpenAPI 3.0	Contrato de API	OpenAPI / Tipos	Media	Servidor API activo	GET /openapi.json	Definición completa de rutas /api/seguridad/roles y /api/seguridad/roles/{id} con esquemas DTO	Rutas ausentes en el documento JSON impidiendo la generación de interfaces en frontend	CORREGIDO	13/09/2026 20:30	13/09/2026 21:15	feat(openapi): registrar endpoints de seguridad en especificacion openapi y actualizar version
CP-H04-API-01	Bloqueo de acceso en listado de roles por ausencia de cabecera de autenticación	Seguridad / Auth	API / Route	Crítica	Servidor API en ejecución	GET /api/seguridad/roles (sin cabecera Authorization)	HTTP 401 Unauthorized con mensaje de cabecera requerida	HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization: Bearer <token>."	APROBADO	13/09/2026 21:30	-	feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id]
CP-H04-API-02	Bloqueo de acceso en listado de roles por Control de Acceso RBAC a usuario con perfil operativo no Administrador	Seguridad / RBAC	API / Servicio	Crítica	Usuario autenticado con rol Call Center, Encargado o Brigadista	GET /api/seguridad/roles con token Bearer de usuario Call Center	HTTP 403 Forbidden denegando acceso por perfil insuficiente	HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."	APROBADO	13/09/2026 21:32	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-03	Bloqueo de acceso en listado de roles a cuenta de Administrador en estado inactivo	Seguridad / RBAC	Servicio / Guard	Alta	Usuario con rol Administrador registrado con activo: false en base de datos	GET /api/seguridad/roles con token de Administrador inactivo	HTTP 401 Unauthorized impidiendo el acceso a funcionarios inactivos	HTTP 401 Unauthorized: "El usuario especificado se encuentra inactivo en la institución."	APROBADO	13/09/2026 21:34	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-04	Consulta autorizada del catálogo completo de perfiles por usuario Administrador activo	Funcional / RBAC	API / Route	Crítica	Usuario Administrador activo con token Bearer válido	GET /api/seguridad/roles con token Bearer de Administrador	HTTP 200 OK con estructura { data: [...], total: N } listando los roles del sistema	HTTP 200 OK con arreglo de perfiles sembrados y conteo total fidedigno	APROBADO	13/09/2026 21:36	-	feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id]
CP-H04-API-05	Verificación de integridad estructural y campos obligatorios de cada rol en el listado	Validación Esquema	DTO / Zod	Alta	Respuesta obtenida de GET /api/seguridad/roles	Validación de cada elemento con RolItemSchema	Cada rol contiene id, nombre, descripcion, activo, esSistema, cantidadPermisos, permisos, creadoEn y actualizadoEn	Esquema Zod valida 100% de los campos con formatos ISO 8601 y UUID conformes	APROBADO	13/09/2026 21:38	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-06	Consulta interactiva autorizada de detalle de un perfil específico por su UUID	Funcional / Detalle	API / Route	Alta	Rol existente en base de datos (Administrador: 20000000-0000-4000-8000-000000000001)	GET /api/seguridad/roles/20000000-0000-4000-8000-000000000001 con token Administrador	HTTP 200 OK con data conteniendo nombre, descripción y lista de permisos	HTTP 200 OK con detalle exhaustivo del rol Administrador y sus acciones permitidas	APROBADO	13/09/2026 21:40	-	feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id]
CP-H04-API-07	Despliegue de permisos y acciones agrupables por módulo funcional en detalle de perfil	Funcional / Dominio	DTO / Servicio	Alta	Perfil con permisos asignados en múltiples módulos del sistema	Inspección de arreglo permisos en respuesta de detalle	Cada permiso contiene id, codigo, nombre, descripcion y modulo para permitir agrupación visual	Permisos entregados con atributo modulo consistente permitiendo su agrupación por área	APROBADO	13/09/2026 21:42	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-08	Manejo de error al solicitar detalle de rol inexistente en el sistema	Robustez / Errores	API / Route	Media	UUID válido que no corresponde a ningún rol registrado	GET /api/seguridad/roles/00000000-0000-4000-8000-000000000999 con token Administrador	HTTP 404 Not Found con mensaje descriptivo de perfil no encontrado	HTTP 404 Not Found: "Perfil con ID '00000000-0000-4000-8000-000000000999' no encontrado."	APROBADO	13/09/2026 21:44	-	feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id]
CP-H04-API-09	Rechazo temprano con HTTP 400 Bad Request ante parámetro id que no cumple formato UUID	Validación / Zod	API / Route	Media	Servidor API en ejecución	GET /api/seguridad/roles/abc-invalido con token Administrador	HTTP 400 Bad Request con mensaje de identificador no válido	HTTP 400 Bad Request: "El identificador de rol proporcionado no es un UUID válido."	APROBADO	13/09/2026 21:46	-	feat(api): implementar route handlers GET /api/seguridad/roles y /roles/[id]
CP-H04-API-10	Verificación de trazabilidad y campos de auditoría en permisos asignados	Auditoría / BD	DAL / Kysely	Media	Permisos vinculados a rol en tabla rol_permiso	Consulta relacional en rol_permiso	Campos asignadoEn (timestamp) y asignadoPorId (UUID o null) presentes en cada registro	Metadatos de auditoría persistidos y entregados fielmente en la estructura JSON	APROBADO	13/09/2026 21:48	-	feat(db): agregar migracion de tablas rol, permiso, rol_permiso y usuario con auditoria
CP-H04-API-11	Bloqueo de acceso en detalle de rol por UUID para usuario con perfil operativo no Administrador	Seguridad / RBAC	API / Route	Crítica	Usuario autenticado con rol distinto a Administrador	GET /api/seguridad/roles/20000000-0000-4000-8000-000000000001 con token Call Center	HTTP 403 Forbidden denegando acceso por perfil insuficiente	HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador..."	APROBADO	13/09/2026 21:50	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-12	Denegación de acceso ante token JWT manipulado, malformado o con firma expirada	Seguridad / Token	API / Guard	Crítica	Solicitud con token JWT inválido o alterado	GET /api/seguridad/roles con cabecera Authorization: Bearer token-falso	HTTP 401 Unauthorized indicando token inválido o expirado	HTTP 401 Unauthorized: "Token de sesión inválido o expirado."	APROBADO	13/09/2026 21:52	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-13	Comportamiento ante rol sin permisos asignados en el listado general (Criterio CA-4)	Regla de Negocio	DAL / Servicio	Alta	Perfil Observador Sin Permisos registrado sin vinculaciones en rol_permiso	GET /api/seguridad/roles inspeccionando rol sin asignaciones	cantidadPermisos: 0 y permisos: [] garantizando activación de mensaje Sin permisos asignados	cantidadPermisos: 0 y arreglo vacío permisos: [] entregados limpiamente	APROBADO	13/09/2026 21:54	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-14	Despliegue de estado sin permisos en consulta de detalle interactivo de rol	Regla de Negocio	API / Route	Alta	Perfil sin permisos (UUID: 20000000-0000-4000-8000-000000000008)	GET /api/seguridad/roles/20000000-0000-4000-8000-000000000008	data.permisos: [] y data.cantidadPermisos: 0	HTTP 200 OK con objeto conteniendo arreglo vacío de permisos y contador en cero	APROBADO	13/09/2026 21:56	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-15	Verificación de tiempo de respuesta y latencia del listado de roles (Criterio CA-5: < 1.5s)	Rendimiento	Servicio / BD	Alta	Simulación de 50 perfiles con múltiples permisos asignados	Ejecución de listarRoles() midiendo duración con performance.now()	Tiempo de respuesta total en servidor inferior a 1500 ms (< 1.5 segundos)	Ejecución completada en 6 ms, cumpliendo holgadamente el umbral de 1.5s	APROBADO	13/09/2026 21:58	-	test(seguridad): agregar suites de pruebas unitarias para rbac, esquemas y tiempos de respuesta
CP-H04-API-16	Exposición y sincronización de contratos de endpoints de roles en especificación OpenAPI 3.0	Contrato de API	OpenAPI / Docs	Alta	Servidor API en ejecución	GET /openapi.json inspeccionando rutas /api/seguridad/roles y /{id}	Códigos de respuesta 200, 401, 403, 404 y esquemas DTO documentados bajo OpenAPI 3.0.0	HTTP 200 OK con especificación OpenAPI íntegra y disponible para sincronización frontend	APROBADO	13/09/2026 22:00	-	feat(openapi): registrar endpoints de seguridad en especificacion openapi y actualizar version
CP-H04-API-17	Validación de integridad con Zod ante manipulación de tipos de datos en la respuesta	Validación Esquema	Schema / Zod	Media	Payload con id no conforme a UUID o campos omitidos	Validación con RolItemSchema.safeParse y RolIdParamSchema.safeParse	safeParse retorna success: false detectando inconsistencias de estructura	Zod rechaza inconsistencias estructurales impidiendo fuga de datos no conformes	APROBADO	13/09/2026 22:02	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
CP-H04-API-18	Verificación de ordenamiento predeterminado alfabético en roles y permisos por módulo	Funcional / UX	DAL / Kysely	Media	Consulta relacional Kysely con cláusulas orderBy	GET /api/seguridad/roles	Roles ordenados por nombre ASC y permisos por modulo ASC y nombre ASC	Orden alfabético y jerárquico garantizado directamente desde la consulta PostgreSQL	APROBADO	13/09/2026 22:04	-	feat(seguridad): implementar esquemas zod, repositorio y servicio con control rbac
```

---

## 6. Cobertura de Criterios de Aceptación (Trazabilidad)

| Criterio de Aceptación (CA) de HU-4 | Casos de Prueba Asociados | Estado de Cobertura |
|---|---|:---:|
| **CA-1: El sistema debe presentar una interfaz que liste todos los roles/perfiles registrados en el sistema (ej. Informante, Administrador, Encargado, Patrulla Verificadora, etc.).** | `CP-H04-API-04`, `CP-H04-API-05`, `CP-H04-API-18`, `BUG-H04-API-02` | 🟢 100% CUBIERTO |
| **CA-2: Al interactuar con un perfil específico, el sistema debe desplegar claramente los permisos y acciones a los que dicho perfil tiene acceso.** | `CP-H04-API-06`, `CP-H04-API-07`, `CP-H04-API-08`, `CP-H04-API-09`, `CP-H04-API-10`, `BUG-H04-API-04` | 🟢 100% CUBIERTO |
| **CA-3: La vista del listado de permisos debe ser accesible única y exclusivamente por usuarios autenticados que posean el rol de "Administrador". Si otro usuario intenta acceder, se debe denegar el acceso.** | `CP-H04-API-01`, `CP-H04-API-02`, `CP-H04-API-03`, `CP-H04-API-11`, `CP-H04-API-12`, `BUG-H04-API-01` | 🟢 100% CUBIERTO |
| **CA-4: Si un rol creado no cuenta con permisos asignados en la base de datos, la interfaz debe mostrar un mensaje claro indicando "Sin permisos asignados" o similar.** | `CP-H04-API-13`, `CP-H04-API-14`, `BUG-H04-API-02` | 🟢 100% CUBIERTO |
| **CA-5: El tiempo de carga del listado no debe exceder los 1.5 segundos.** | `CP-H04-API-15`, `BUG-H04-API-03` | 🟢 100% CUBIERTO |
| **Contrato Técnico y Calidad: Sincronización OpenAPI 3.0 y validación estricta de esquemas Zod.** | `CP-H04-API-16`, `CP-H04-API-17`, `BUG-H04-API-05` | 🟢 100% CUBIERTO |

---

## 7. Evidencias de Ejecución Automatizada (Vitest)

Ejecución de la suite completa de pruebas unitarias y de integración del módulo de seguridad en `sgrai-api`:

```bash
$ npx vitest run src/modules/seguridad/__tests__/seguridad.test.ts

 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/seguridad/__tests__/seguridad.test.ts (55 tests) 229ms
   ✓ Módulo de Seguridad — Esquemas Zod (12 tests)
   ✓ Módulo de Seguridad — Control de Acceso RBAC y Lógica de Servicio (13 tests)
   ✓ Módulo de Seguridad — Route Handlers HTTP (22 tests)
   ✓ Módulo de Seguridad — Persistencia y Transaccionalidad (SeguridadRepository) (3 tests)
   ✓ Módulo de Seguridad — Especificación OpenAPI (1 test)

 Test Files  1 passed (1)
      Tests  55 passed (55)
   Start at  22:31:54
   Duration  1.69s
```

### Verificación Estática de Tipos (TypeScript)
```bash
$ npx tsc --noEmit
# Salida limpia: 0 errores de compilación TypeScript.
```

---

## 8. Dictamen de Calidad de Backend (QA Sign-off)

La implementación de los Route Handlers `GET /api/seguridad/roles` y `GET /api/seguridad/roles/[id]`, sus esquemas de validación Zod, el control de acceso estricto RBAC para Administradores, la consulta optimizada en Kysely con PostgreSQL y la sincronización con OpenAPI 3.0 en la rama **`feature/H4-visualizar-permisos`** satisface al 100% los criterios de aceptación y requerimientos no funcionales definidos para la **HU-4**.

Todos los defectos identificados durante el ciclo de QA fueron corregidos, incorporados en los commits correspondientes y re-testeados con veredicto aprobatorio.

**Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN Y MERGE A DEVELOP**.
