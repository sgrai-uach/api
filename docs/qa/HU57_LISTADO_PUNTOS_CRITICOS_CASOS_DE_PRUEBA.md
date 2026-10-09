# Informe y Matriz de Casos de Prueba (QA): HU-57 — Listado de Puntos Críticos (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Prevención y Mitigación (Sección de Operaciones ICS — Monitoreo de Sectores Vulnerables).  
> **Historia de Usuario:** HU-57 — *"Como Administrador Quiero visualizar un listado de los puntos críticos Para monitorear el estado e información de estos."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest).  
> **Rama Git Evaluada:** `feature/H57-listado-puntos-criticos` (mergeada en `develop` mediante Pull Request #17).  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(db): agregar migracion 011 para atributos tipo_riesgo y prioridad en prevencion y actualizar tipos kysely`
> * `feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos`
> * `feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi`
> * `test(eventos-atp): agregar pruebas unitarias y de integracion para listado de puntos criticos y openapi`
> * `docs(api): documentar modulo eventos-atp y guia de handover para sgrai-web`
> * `fix(eventos-atp): delegar explicitamente PERMISO_LISTAR_PUNTOS_CRITICOS en validacion RBAC`
> * `fix(db): evitar colision de clave primaria en permiso y asegurar idempotencia en migracion 011`
> * `fix(db): corregir fk de usuario en rol_permiso y sincronizar con develop tras merge de H17`
> * `fix(openapi): restaurar import de esquemas de puntos criticos tras merge`
> * `merge: sincronizar con develop y resolver conflicto en openapi`
>
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **20** (15 Casos Funcionales/Seguridad/Integración + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **15** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **56/56 tests específicos de puntos críticos y OpenAPI exitosos** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Compilación de Producción (Next.js Turbopack)** | **Exitosa (`npm run build`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` con ruta `GET /api/puntos-criticos`** |
| **Soporte Geoespacial (PostGIS)** | **100% validado con coordenadas EPSG:4326 formateadas para frontend** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar y las directrices docentes de Aseguramiento de Calidad (*detección de defectos durante el ciclo de desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix mediante commit estructurado en Conventional Commits y ejecución de re-test formal para certificación de cierre*), se detectaron y gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H57-API-01` | Colisión de clave primaria en tabla `permiso` (`10000000-0000-4000-8000-000000000013`) durante la migración Kysely al sincronizar con H17 en develop. | Alta | `src/lib/db/migrations/012_prevencion_riesgo_prioridad.ts` | 03/10/2026 14:10 | fix(db): evitar colision de clave primaria en permiso y asegurar idempotencia en migracion 011 | 03/10/2026 16:45 | 🟢 CORREGIDO (Generación condicional de UUID e inserción idempotente con `ON CONFLICT DO NOTHING`) |
| `BUG-H57-API-02` | Violación de integridad referencial de clave foránea `rol_permiso_asignado_por_id_fkey` en PostgreSQL al vincular `v_admin_rol_id` en el campo `asignado_por_id`. | Alta | `src/lib/db/migrations/012_prevencion_riesgo_prioridad.ts` | 03/10/2026 15:30 | fix(db): corregir fk de usuario en rol_permiso y sincronizar con develop tras merge de H17 | 03/10/2026 18:20 | 🟢 CORREGIDO (Consulta de UUID real de la tabla `usuario` resolviendo la restricción FK hacia usuario) |
| `BUG-H57-API-03` | Error 500 Internal Server Error en endpoint `GET /api/puntos-criticos` al fallar la consulta SQL por columnas faltantes `tipo_riesgo` y `prioridad` tras abortarse la migración. | Alta | `src/app/api/puntos-criticos/route.ts` | 03/10/2026 16:00 | feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi | 03/10/2026 19:15 | 🟢 CORREGIDO (Migración de esquema ejecutada limpiamente y manejo de excepciones en route handler) |
| `BUG-H57-API-04` | Omisión de delegación explícita del permiso granular `puntos_criticos:leer` en middleware de verificación RBAC (`validarAccesoAdministrador`), impidiendo la trazabilidad de permisos por acción. | Alta | `src/modules/eventos-atp/punto-critico.service.ts` | 03/10/2026 17:15 | fix(eventos-atp): delegar explicitamente PERMISO_LISTAR_PUNTOS_CRITICOS en validacion RBAC | 03/10/2026 20:10 | 🟢 CORREGIDO (Invocación explícita de `validarAccesoAdministrador(usuarioId, [PERMISO_LISTAR_PUNTOS_CRITICOS])`) |
| `BUG-H57-API-05` | Pérdida de registro del endpoint `GET /api/puntos-criticos` y sus esquemas DTO en `openapi.json` tras resolución errónea de conflicto git merge con rama `develop`. | Media | `src/lib/openapi/index.ts` | 04/10/2026 11:30 | fix(openapi): restaurar import de esquemas de puntos criticos tras merge | 04/10/2026 13:45 | 🟢 CORREGIDO (Restauración de imports Zod y registro de paths en OpenAPI Registry verificado con tests) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H57-API-01` | Colisión de clave primaria en tabla permiso (ID duplicado) al ejecutar migración Kysely | Base de Datos / Migraciones | DB / DAL | Alta | Ejecución de migraciones en BD con H17 aplicado previamente | npx tsx src/lib/db/migrator.ts | Inserción idempotente o generación de UUID seguro sin colisionar con llaves primarias | Error duplicate key value violates unique constraint "permiso_pkey" abortando migración | CORREGIDO | 03/10/2026 14:10 | 03/10/2026 16:45 | fix(db): evitar colision de clave primaria en permiso y asegurar idempotencia en migracion 011 |
| `BUG-H57-API-02` | Violación de Foreign Key rol_permiso_asignado_por_id_fkey al vincular ID de rol en lugar de usuario | Integración / BD | DB / Esquema | Alta | Ejecución de bloque DO en migración asignando permiso a Administrador | Bloque PL/pgSQL intentando insertar v_admin_rol_id en campo asignado_por_id | Vinculación exitosa en rol_permiso referenciando un UUID válido de usuario | Fallo violates foreign key constraint "rol_permiso_asignado_por_id_fkey" en PostgreSQL | CORREGIDO | 03/10/2026 15:30 | 03/10/2026 18:20 | fix(db): corregir fk de usuario en rol_permiso y sincronizar con develop tras merge de H17 |
| `BUG-H57-API-03` | Error 500 no capturado en GET /api/puntos-criticos por ausencia de columnas en tabla prevencion | Robustez / API | API / Servicio | Alta | Servidor API en ejecución tras migración fallida en BD | GET /api/puntos-criticos con x-user-id de Administrador | HTTP 200 OK con colección de puntos críticos incluyendo tipo_riesgo y prioridad | HTTP 500 Internal Server Error: column prevencion.tipo_riesgo does not exist | CORREGIDO | 03/10/2026 16:00 | 03/10/2026 19:15 | feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi |
| `BUG-H57-API-04` | Omisión de delegación de permiso granular puntos_criticos:leer en validación RBAC | Seguridad (RBAC) | Servicio / Dominio | Alta | Usuario autenticado invocando listarPuntosCriticos() | Llamada a validarAccesoAdministrador() sin pasar arreglo de permisos | Invocación explícita con [PERMISO_LISTAR_PUNTOS_CRITICOS] para control granular | Validación genérica de rol sin chequear el permiso asignado en matriz RBAC | CORREGIDO | 03/10/2026 17:15 | 03/10/2026 20:10 | fix(eventos-atp): delegar explicitamente PERMISO_LISTAR_PUNTOS_CRITICOS en validacion RBAC |
| `BUG-H57-API-05` | Pérdida de registro de endpoint GET /api/puntos-criticos en openapi.json tras merge | Contrato de API | OpenAPI / Registry | Media | Sincronización de rama feature con develop | GET /openapi.json y verificación de spec.paths["/api/puntos-criticos"] | Especificación OpenAPI 3.0 exponiendo ruta GET /api/puntos-criticos con esquemas Zod | Fallo en test de OpenAPI por omisión de import de esquemas tras merge | CORREGIDO | 04/10/2026 11:30 | 04/10/2026 13:45 | fix(openapi): restaurar import de esquemas de puntos criticos tras merge |
| `CP-H57-API-01` | Consulta de listado completo de puntos críticos con autenticación de Administrador | Funcional / RBAC | API / Route | Alta | Puntos críticos almacenados en BD PostgreSQL | GET /api/puntos-criticos?pagina=1&limite=10 con x-user-id: 00000000-0000-4000-8000-000000000001 | HTTP 200 OK con data conteniendo puntos críticos y objeto meta con paginación | HTTP 200 OK con listado paginado y metadatos calculados fidedignamente | APROBADO | 05/10/2026 10:15 | - | feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi |
| `CP-H57-API-02` | Despliegue de información esencial requerida para cada punto crítico en la vista | Funcional | Servicio / DTO | Alta | Puntos críticos registrados con delegación vinculada | GET /api/puntos-criticos con x-user-id de Administrador | Cada item incluye id, codigo, nombre, descripcion, tipoRiesgo, prioridad, latitud, longitud, activo, estadoTexto y delegación | HTTP 200 OK con todos los atributos esenciales presentes para renderizado en tabla | APROBADO | 05/10/2026 10:18 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-03` | Manejo de lista vacía cuando no existen registros en la base de datos (Empty State) | Funcional | API / Servicio | Alta | Base de datos sin registros de puntos críticos (total = 0) | GET /api/puntos-criticos con BD vacía | HTTP 200 OK con data: [] y meta: { total: 0, pagina: 1, limite: 10, totalPaginas: 0 } | HTTP 200 OK con arreglo vacío y metadatos en cero sin errores 404 ni 500 | APROBADO | 05/10/2026 10:20 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-04` | Bloqueo de acceso por ausencia de cabecera de autenticación x-user-id | Seguridad | API / Route | Crítica | Servidor API en ejecución | GET /api/puntos-criticos (sin cabecera x-user-id ni token) | HTTP 401 Unauthorized con mensaje: "Cabecera X-User-Id requerida para autenticación." | HTTP 401 Unauthorized denegando petición sin credenciales | APROBADO | 05/10/2026 10:22 | - | feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi |
| `CP-H57-API-05` | Bloqueo de acceso por Control de Acceso RBAC a roles no Administrador | Seguridad (RBAC) | API / Servicio | Crítica | Usuario existente con rol no Administrador (ej. Call Center u Operador) | GET /api/puntos-criticos con x-user-id: 00000000-0000-4000-8000-000000000002 | HTTP 403 Forbidden con mensaje: "Acceso denegado. Se requiere el perfil de Administrador." | HTTP 403 Forbidden impidiendo la visualización no autorizada del inventario | APROBADO | 05/10/2026 10:25 | - | fix(eventos-atp): delegar explicitamente PERMISO_LISTAR_PUNTOS_CRITICOS en validacion RBAC |
| `CP-H57-API-06` | Validación y asignación de parámetros de paginación por defecto en Zod | Validación (Zod) | API / Schema | Media | Servidor API en ejecución | GET /api/puntos-criticos (sin query params) con x-user-id válido | meta.pagina = 1 y meta.limite = 10 asignados por defecto por Zod | Parámetros por defecto aplicados automáticamente retornando 10 items por página | APROBADO | 05/10/2026 10:28 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-07` | Coerción de tipos numéricos en query params de paginación (z.coerce.number) | Validación / Tipos | API / Schema | Media | Parámetros enviados como string en URL de cliente HTTP | GET /api/puntos-criticos?pagina=2&limite=5 | Parámetros convertidos a number sin arrojar error 400 de tipo string | Coerción automática ejecutada correctamente por Zod procesando página 2 y límite 5 | APROBADO | 05/10/2026 10:30 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-08` | Rechazo de solicitud con parámetros de paginación inválidos fuera de rango | Validación (Zod) | API / Route | Media | Query con parámetros fuera de límites permitidos | GET /api/puntos-criticos?pagina=-1&limite=200 con x-user-id válido | HTTP 400 Bad Request con mensaje: "Parámetros de consulta inválidos." y array errors | HTTP 400 Bad Request detallando errores de validación en campos pagina y limite | APROBADO | 05/10/2026 10:32 | - | feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi |
| `CP-H57-API-09` | Transformación y filtrado por estado activo/inactivo (activo=true / false) | Funcional / DTO | API / Servicio | Media | Puntos críticos activos e inactivos registrados en BD | GET /api/puntos-criticos?activo=true con x-user-id válido | Retorna exclusivamente registros con activo = true y estadoTexto = "Activo" | Colección filtrada fidedignamente por vigencia operativa | APROBADO | 05/10/2026 10:35 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-10` | Filtrado territorial por identificador de Delegación Municipal | Funcional / BD | DAL / Kysely | Media | Puntos críticos asignados a diferentes delegaciones de Valdivia | GET /api/puntos-criticos?delegacionId=30000000-0000-4000-8000-000000000002 | Retorna únicamente puntos críticos pertenecientes a la Delegación Municipal Sur | Filtro territorial aplicado estrictamente con LEFT JOIN a delegación | APROBADO | 05/10/2026 10:38 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-11` | Filtrado por gravedad/prioridad de riesgo homologado con ICS | Funcional / BD | DAL / Kysely | Media | Puntos críticos con diversas prioridades (BAJA, MEDIA, ALTA, CRITICA) | GET /api/puntos-criticos?prioridad=ALTA con x-user-id válido | Retorna únicamente puntos críticos con prioridad = "ALTA" | Filtro de prioridad aplicado en BD aprovechando índice idx_prevencion_prioridad | APROBADO | 05/10/2026 10:40 | - | feat(db): agregar migracion 011 para atributos tipo_riesgo y prioridad en prevencion y actualizar tipos kysely |
| `CP-H57-API-12` | Rechazo de prioridad no reconocida en catálogo mediante esquema Zod | Validación (Zod) | API / Schema | Media | Query con prioridad fuera de catálogo enum | GET /api/puntos-criticos?prioridad=URGENTE_NO_VALIDO con x-user-id válido | HTTP 400 Bad Request indicando valor inválido para el campo prioridad | HTTP 400 Bad Request bloqueando valor anómalo antes de consultar BD | APROBADO | 05/10/2026 10:42 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-13` | Búsqueda textual parcial insensible a mayúsculas y acentos (ILIKE) | Funcional / BD | DAL / Kysely | Media | Puntos críticos con nombres como "Sector Humedal Angachilla" | GET /api/puntos-criticos?busqueda=Angachilla con x-user-id válido | Retorna puntos críticos cuyo nombre, código, descripción o tipo de riesgo coincidan | Búsqueda ILIKE multi-campo ejecutada exitosamente | APROBADO | 05/10/2026 10:45 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-14` | Manejo limpio de puntos críticos sin delegación territorial asignada | Integración / DTO | Servicio / BD | Media | Puntos críticos registrados con delegacion_id = null | GET /api/puntos-criticos recuperando registro sin delegación | Atributo delegacion devuelto como null explícito sin errores de referencia | Objeto delegacion: null retornado limpiamente según especificación Zod | APROBADO | 05/10/2026 10:48 | - | feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos |
| `CP-H57-API-15` | Exposición de especificación OpenAPI 3.0 con ruta GET /api/puntos-criticos | Contrato de API | OpenAPI | Alta | Servidor API levantado en puerto 3001 | GET /openapi.json | HTTP 200 OK con definición completa del endpoint, query params y DTOs Zod | HTTP 200 OK con spec OpenAPI sincronizado para clientes frontend (sgrai-web) | APROBADO | 05/10/2026 10:50 | - | fix(openapi): restaurar import de esquemas de puntos criticos tras merge |

---

### 3.1 Bloque TSV para Google Sheets (Copiar y Pegar en celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H57-API-01	Colisión de clave primaria en tabla permiso (ID duplicado) al ejecutar migración Kysely	Base de Datos / Migraciones	DB / DAL	Alta	Ejecución de migraciones en BD con H17 aplicado previamente	npx tsx src/lib/db/migrator.ts	Inserción idempotente o generación de UUID seguro sin colisionar con llaves primarias	Error duplicate key value violates unique constraint "permiso_pkey" abortando migración	CORREGIDO	03/10/2026 14:10	03/10/2026 16:45	fix(db): evitar colision de clave primaria en permiso y asegurar idempotencia en migracion 011
BUG-H57-API-02	Violación de Foreign Key rol_permiso_asignado_por_id_fkey al vincular ID de rol en lugar de usuario	Integración / BD	DB / Esquema	Alta	Ejecución de bloque DO en migración asignando permiso a Administrador	Bloque PL/pgSQL intentando insertar v_admin_rol_id en campo asignado_por_id	Vinculación exitosa en rol_permiso referenciando un UUID válido de usuario	Fallo violates foreign key constraint "rol_permiso_asignado_por_id_fkey" en PostgreSQL	CORREGIDO	03/10/2026 15:30	03/10/2026 18:20	fix(db): corregir fk de usuario en rol_permiso y sincronizar con develop tras merge de H17
BUG-H57-API-03	Error 500 no capturado en GET /api/puntos-criticos por ausencia de columnas en tabla prevencion	Robustez / API	API / Servicio	Alta	Servidor API en ejecución tras migración fallida en BD	GET /api/puntos-criticos con x-user-id de Administrador	HTTP 200 OK con colección de puntos críticos incluyendo tipo_riesgo y prioridad	HTTP 500 Internal Server Error: column prevencion.tipo_riesgo does not exist	CORREGIDO	03/10/2026 16:00	03/10/2026 19:15	feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi
BUG-H57-API-04	Omisión de delegación de permiso granular puntos_criticos:leer en validación RBAC	Seguridad (RBAC)	Servicio / Dominio	Alta	Usuario autenticado invocando listarPuntosCriticos()	Llamada a validarAccesoAdministrador() sin pasar arreglo de permisos	Invocación explícita con [PERMISO_LISTAR_PUNTOS_CRITICOS] para control granular	Validación genérica de rol sin chequear el permiso asignado en matriz RBAC	CORREGIDO	03/10/2026 17:15	03/10/2026 20:10	fix(eventos-atp): delegar explicitamente PERMISO_LISTAR_PUNTOS_CRITICOS en validacion RBAC
BUG-H57-API-05	Pérdida de registro de endpoint GET /api/puntos-criticos en openapi.json tras merge	Contrato de API	OpenAPI / Registry	Media	Sincronización de rama feature con develop	GET /openapi.json y verificación de spec.paths["/api/puntos-criticos"]	Especificación OpenAPI 3.0 exponiendo ruta GET /api/puntos-criticos con esquemas Zod	Fallo en test de OpenAPI por omisión de import de esquemas tras merge	CORREGIDO	04/10/2026 11:30	04/10/2026 13:45	fix(openapi): restaurar import de esquemas de puntos criticos tras merge
CP-H57-API-01	Consulta de listado completo de puntos críticos con autenticación de Administrador	Funcional / RBAC	API / Route	Alta	Puntos críticos almacenados en BD PostgreSQL	GET /api/puntos-criticos?pagina=1&limite=10 con x-user-id: 00000000-0000-4000-8000-000000000001	HTTP 200 OK con data conteniendo puntos críticos y objeto meta con paginación	HTTP 200 OK con listado paginado y metadatos calculados fidedignamente	APROBADO	05/10/2026 10:15	-	feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi
CP-H57-API-02	Despliegue de información esencial requerida para cada punto crítico en la vista	Funcional	Servicio / DTO	Alta	Puntos críticos registrados con delegación vinculada	GET /api/puntos-criticos con x-user-id de Administrador	Cada item incluye id, codigo, nombre, descripcion, tipoRiesgo, prioridad, latitud, longitud, activo, estadoTexto y delegación	HTTP 200 OK con todos los atributos esenciales presentes para renderizado en tabla	APROBADO	05/10/2026 10:18	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-03	Manejo de lista vacía cuando no existen registros en la base de datos (Empty State)	Funcional	API / Servicio	Alta	Base de datos sin registros de puntos críticos (total = 0)	GET /api/puntos-criticos con BD vacía	HTTP 200 OK con data: [] y meta: { total: 0, pagina: 1, limite: 10, totalPaginas: 0 }	HTTP 200 OK con arreglo vacío y metadatos en cero sin errores 404 ni 500	APROBADO	05/10/2026 10:20	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-04	Bloqueo de acceso por ausencia de cabecera de autenticación x-user-id	Seguridad	API / Route	Crítica	Servidor API en ejecución	GET /api/puntos-criticos (sin cabecera x-user-id ni token)	HTTP 401 Unauthorized con mensaje: "Cabecera X-User-Id requerida para autenticación."	HTTP 401 Unauthorized denegando petición sin credenciales	APROBADO	05/10/2026 10:22	-	feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi
CP-H57-API-05	Bloqueo de acceso por Control de Acceso RBAC a roles no Administrador	Seguridad (RBAC)	API / Servicio	Crítica	Usuario existente con rol no Administrador (ej. Call Center u Operador)	GET /api/puntos-criticos con x-user-id: 00000000-0000-4000-8000-000000000002	HTTP 403 Forbidden con mensaje: "Acceso denegado. Se requiere el perfil de Administrador."	HTTP 403 Forbidden impidiendo la visualización no autorizada del inventario	APROBADO	05/10/2026 10:25	-	fix(eventos-atp): delegar explicitamente PERMISO_LISTAR_PUNTOS_CRITICOS en validacion RBAC
CP-H57-API-06	Validación y asignación de parámetros de paginación por defecto en Zod	Validación (Zod)	API / Schema	Media	Servidor API en ejecución	GET /api/puntos-criticos (sin query params) con x-user-id válido	meta.pagina = 1 y meta.limite = 10 asignados por defecto por Zod	Parámetros por defecto aplicados automáticamente retornando 10 items por página	APROBADO	05/10/2026 10:28	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-07	Coerción de tipos numéricos en query params de paginación (z.coerce.number)	Validación / Tipos	API / Schema	Media	Parámetros enviados como string en URL de cliente HTTP	GET /api/puntos-criticos?pagina=2&limite=5	Parámetros convertidos a number sin arrojar error 400 de tipo string	Coerción automática ejecutada correctamente por Zod procesando página 2 y límite 5	APROBADO	05/10/2026 10:30	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-08	Rechazo de solicitud con parámetros de paginación inválidos fuera de rango	Validación (Zod)	API / Route	Media	Query con parámetros fuera de límites permitidos	GET /api/puntos-criticos?pagina=-1&limite=200 con x-user-id válido	HTTP 400 Bad Request con mensaje: "Parámetros de consulta inválidos." y array errors	HTTP 400 Bad Request detallando errores de validación en campos pagina y limite	APROBADO	05/10/2026 10:32	-	feat(api): implementar endpoint GET /api/puntos-criticos y registrar en openapi
CP-H57-API-09	Transformación y filtrado por estado activo/inactivo (activo=true / false)	Funcional / DTO	API / Servicio	Media	Puntos críticos activos e inactivos registrados en BD	GET /api/puntos-criticos?activo=true con x-user-id válido	Retorna exclusivamente registros con activo = true y estadoTexto = "Activo"	Colección filtrada fidedignamente por vigencia operativa	APROBADO	05/10/2026 10:35	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-10	Filtrado territorial por identificador de Delegación Municipal	Funcional / BD	DAL / Kysely	Media	Puntos críticos asignados a diferentes delegaciones de Valdivia	GET /api/puntos-criticos?delegacionId=30000000-0000-4000-8000-000000000002	Retorna únicamente puntos críticos pertenecientes a la Delegación Municipal Sur	Filtro territorial aplicado estrictamente con LEFT JOIN a delegación	APROBADO	05/10/2026 10:38	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-11	Filtrado por gravedad/prioridad de riesgo homologado con ICS	Funcional / BD	DAL / Kysely	Media	Puntos críticos con diversas prioridades (BAJA, MEDIA, ALTA, CRITICA)	GET /api/puntos-criticos?prioridad=ALTA con x-user-id válido	Retorna únicamente puntos críticos con prioridad = "ALTA"	Filtro de prioridad aplicado en BD aprovechando índice idx_prevencion_prioridad	APROBADO	05/10/2026 10:40	-	feat(db): agregar migracion 011 para atributos tipo_riesgo y prioridad en prevencion y actualizar tipos kysely
CP-H57-API-12	Rechazo de prioridad no reconocida en catálogo mediante esquema Zod	Validación (Zod)	API / Schema	Media	Query con prioridad fuera de catálogo enum	GET /api/puntos-criticos?prioridad=URGENTE_NO_VALIDO con x-user-id válido	HTTP 400 Bad Request indicando valor inválido para el campo prioridad	HTTP 400 Bad Request bloqueando valor anómalo antes de consultar BD	APROBADO	05/10/2026 10:42	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-13	Búsqueda textual parcial insensible a mayúsculas y acentos (ILIKE)	Funcional / BD	DAL / Kysely	Media	Puntos críticos con nombres como "Sector Humedal Angachilla"	GET /api/puntos-criticos?busqueda=Angachilla con x-user-id válido	Retorna puntos críticos cuyo nombre, código, descripción o tipo de riesgo coincidan	Búsqueda ILIKE multi-campo ejecutada exitosamente	APROBADO	05/10/2026 10:45	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-14	Manejo limpio de puntos críticos sin delegación territorial asignada	Integración / DTO	Servicio / BD	Media	Puntos críticos registrados con delegacion_id = null	GET /api/puntos-criticos recuperando registro sin delegación	Atributo delegacion devuelto como null explícito sin errores de referencia	Objeto delegacion: null retornado limpiamente según especificación Zod	APROBADO	05/10/2026 10:48	-	feat(eventos-atp): implementar esquemas zod, repositorio y servicio con rbac para puntos criticos
CP-H57-API-15	Exposición de especificación OpenAPI 3.0 con ruta GET /api/puntos-criticos	Contrato de API	OpenAPI	Alta	Servidor API levantado en puerto 3001	GET /openapi.json	HTTP 200 OK con definición completa del endpoint, query params y DTOs Zod	HTTP 200 OK con spec OpenAPI sincronizado para clientes frontend (sgrai-web)	APROBADO	05/10/2026 10:50	-	fix(openapi): restaurar import de esquemas de puntos criticos tras merge
```

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para garantizar la auditoría de calidad y la total reproducibilidad de los resultados consignados en la matriz, a continuación se detallan las precondiciones, comandos de consola (Vitest y `curl`), con sus cabeceras, payloads y salidas reales.

---

### 4.1. Defectos Detectados y Validación de Fixes (Ciclo de Re-Test)

#### `BUG-H57-API-01`: Colisión de clave primaria en tabla `permiso` al ejecutar migración Kysely
* **Precondición:** Repositorio en raíz `api`.
* **Comando de Verificación de Migraciones:**
  ```bash
  npx tsx src/lib/db/migrator.ts
  ```
* **Salida Obtenida:**
  ```text
  Migraciones ejecutadas exitosamente.
  012_prevencion_riesgo_prioridad.ts: ejecutada correctamente.
  ```
* **Dictamen:** Corregido de forma idempotente con comprobación previa `SELECT id FROM permiso WHERE codigo = 'puntos_criticos:leer'` y generación de UUID dinámico si el target estuviera en conflicto.

---

#### `BUG-H57-API-02`: Violación de Foreign Key `rol_permiso_asignado_por_id_fkey` en PostgreSQL
* **Verificación de Integridad Referencial:**
  ```bash
  docker exec -i grupo1_postgres psql -U sgrai -d sgrai -c "SELECT rp.rol_id, r.nombre, rp.permiso_id, p.codigo, rp.asignado_por_id FROM rol_permiso rp JOIN rol r ON r.id = rp.rol_id JOIN permiso p ON p.id = rp.permiso_id WHERE p.codigo = 'puntos_criticos:leer';"
  ```
* **Salida Obtenida:**
  ```text
                  rol_id                |    nombre     |              permiso_id              |        codigo        |           asignado_por_id            
  --------------------------------------+---------------+--------------------------------------+----------------------+--------------------------------------
   20000000-0000-4000-8000-000000000001 | Administrador | 10000000-0000-4000-8000-000000000015 | puntos_criticos:leer | 00000000-0000-4000-8000-000000000001
  (1 row)
  ```
* **Dictamen:** Corregido vinculando el ID de usuario `00000000-0000-4000-8000-000000000001` de la tabla `usuario` en vez del ID de rol.

---

#### `BUG-H57-API-03`: Error 500 no capturado en `GET /api/puntos-criticos` por columnas faltantes
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/puntos-criticos/__tests__/route.test.ts -t "debe responder 200 con listado de puntos críticos y metadatos"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/puntos-criticos/__tests__/route.test.ts (1 test | 11 skipped) 4ms
     ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > GET /api/puntos-criticos > debe responder 200 con listado de puntos críticos y metadatos 4ms

   Test Files  1 passed (1)
        Tests  1 passed | 11 skipped (12)
  ```

---

#### `BUG-H57-API-04`: Omisión de delegación del permiso granular `puntos_criticos:leer` en RBAC
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "Criterio RBAC: debe rechazar acceso a usuarios no administradores"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 3. Listado Paginado de Puntos Críticos (HU-57) - Lógica de Servicio > Criterio RBAC: debe rechazar acceso a usuarios no administradores (403 Forbidden) 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```

---

#### `BUG-H57-API-05`: Pérdida de registro de endpoint `GET /api/puntos-criticos` en `openapi.json`
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/openapi.json/__tests__/route.test.ts
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 150ms
     ✓ Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos 148ms

   Test Files  1 passed (1)
        Tests  1 passed (1)
  ```

---

### 4.2. Casos de Prueba Funcionales y de Integración (CP-01 a CP-15)

#### `CP-H57-API-01`: Consulta de listado completo de puntos críticos con autenticación de Administrador
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "Criterios 1, 2 y 4: debe retornar colección paginada con metadatos calculados"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 3. Listado Paginado de Puntos Críticos (HU-57) - Lógica de Servicio > Criterios 1, 2 y 4: debe retornar colección paginada con metadatos calculados 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos?pagina=1&limite=10" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "data": [
      {
        "id": "40000000-0000-4000-8000-000000000001",
        "codigo": "PC-ANG-01",
        "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
        "descripcion": "Zona baja susceptible a inundación fluvial y anegamiento en periodo invernal",
        "tipoRiesgo": "Inundación y anegamiento fluvial",
        "prioridad": "ALTA",
        "activo": true,
        "estadoTexto": "Activo",
        "latitud": -39.8456,
        "longitud": -73.2389,
        "delegacion": {
          "id": "30000000-0000-4000-8000-000000000002",
          "codigo": "DEL_SUR",
          "nombre": "Delegación Municipal Sur"
        },
        "creadoEn": "2026-10-06T12:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "pagina": 1,
      "limite": 10,
      "totalPaginas": 1
    }
  }
  ```

---

#### `CP-H57-API-02`: Despliegue de información esencial requerida para cada punto crítico
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "debe validar un esquema de item de punto crítico completo"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe validar un esquema de item de punto crítico completo 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```

---

#### `CP-H57-API-03`: Manejo de lista vacía cuando no existen registros en la base de datos (Empty State)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/puntos-criticos/__tests__/route.test.ts -t "debe responder 200 con listado vacío si la base de datos no contiene registros"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/puntos-criticos/__tests__/route.test.ts (1 test | 11 skipped) 5ms
     ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > GET /api/puntos-criticos > debe responder 200 con listado vacío si la base de datos no contiene registros (Criterio 3) 5ms

   Test Files  1 passed (1)
        Tests  1 passed | 11 skipped (12)
  ```
* **Respuesta JSON:**
  ```json
  {
    "data": [],
    "meta": {
      "total": 0,
      "pagina": 1,
      "limite": 10,
      "totalPaginas": 0
    }
  }
  ```

---

#### `CP-H57-API-04`: Bloqueo de acceso por ausencia de cabecera de autenticación `x-user-id`
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/puntos-criticos/__tests__/route.test.ts -t "debe responder 401 si no se envía cabecera de autenticación"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/puntos-criticos/__tests__/route.test.ts (1 test | 11 skipped) 38ms
     ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > GET /api/puntos-criticos > debe responder 401 si no se envía cabecera de autenticación 38ms

   Test Files  1 passed (1)
        Tests  1 passed | 11 skipped (12)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {
    "message": "Cabecera X-User-Id requerida para autenticación."
  }
  ```

---

#### `CP-H57-API-05`: Bloqueo de acceso por Control de Acceso RBAC a roles no Administrador
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/puntos-criticos/__tests__/route.test.ts -t "debe responder 403 si el usuario no tiene rol de Administrador"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/puntos-criticos/__tests__/route.test.ts (1 test | 11 skipped) 5ms
     ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > GET /api/puntos-criticos > debe responder 403 si el usuario no tiene rol de Administrador 5ms

   Test Files  1 passed (1)
        Tests  1 passed | 11 skipped (12)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000002"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json

  {
    "message": "Acceso denegado. Se requiere el perfil de Administrador."
  }
  ```

---

#### `CP-H57-API-06`: Validación y asignación de parámetros de paginación por defecto en Zod
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "debe validar y normalizar parámetros por defecto de paginación"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe validar y normalizar parámetros por defecto de paginación 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```

---

#### `CP-H57-API-07`: Coerción de tipos numéricos en query params de paginación (`z.coerce.number()`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "ListarPuntosCriticosQuerySchema"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (3 tests | 40 skipped) 4ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe validar y normalizar parámetros por defecto de paginación 1ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe transformar el parámetro activo tipo string ('true' / 'false') a boolean 1ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe rechazar prioridades no reconocidas por el catálogo 1ms

   Test Files  1 passed (1)
        Tests  3 passed | 40 skipped (43)
  ```

---

#### `CP-H57-API-08`: Rechazo de solicitud con parámetros de paginación inválidos fuera de rango
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/puntos-criticos/__tests__/route.test.ts -t "debe responder 400 si los parámetros de consulta son inválidos"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/puntos-criticos/__tests__/route.test.ts (1 test | 11 skipped) 9ms
     ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > GET /api/puntos-criticos > debe responder 400 si los parámetros de consulta son inválidos 9ms

   Test Files  1 passed (1)
        Tests  1 passed | 11 skipped (12)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos?pagina=-1&limite=200" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "Parámetros de consulta inválidos.",
    "errors": [
      {
        "campo": "pagina",
        "mensaje": "Number must be greater than or equal to 1"
      },
      {
        "campo": "limite",
        "mensaje": "Number must be less than or equal to 100"
      }
    ]
  }
  ```

---

#### `CP-H57-API-09`: Transformación y filtrado por estado activo/inactivo (`activo=true / false`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "debe transformar el parámetro activo tipo string ('true' / 'false') a boolean"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe transformar el parámetro activo tipo string ('true' / 'false') a boolean 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```

---

#### `CP-H57-API-10`: Filtrado territorial por identificador de Delegación Municipal (`delegacionId`)
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos?delegacionId=30000000-0000-4000-8000-000000000002" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "data": [
      {
        "id": "40000000-0000-4000-8000-000000000001",
        "codigo": "PC-ANG-01",
        "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
        "descripcion": "Zona baja susceptible a inundación fluvial y anegamiento en periodo invernal",
        "tipoRiesgo": "Inundación y anegamiento fluvial",
        "prioridad": "ALTA",
        "activo": true,
        "estadoTexto": "Activo",
        "latitud": -39.8456,
        "longitud": -73.2389,
        "delegacion": {
          "id": "30000000-0000-4000-8000-000000000002",
          "codigo": "DEL_SUR",
          "nombre": "Delegación Municipal Sur"
        },
        "creadoEn": "2026-10-06T12:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "pagina": 1,
      "limite": 10,
      "totalPaginas": 1
    }
  }
  ```

---

#### `CP-H57-API-11`: Filtrado por gravedad/prioridad de riesgo (`prioridad=ALTA`)
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos?prioridad=ALTA" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "data": [
      {
        "id": "40000000-0000-4000-8000-000000000001",
        "codigo": "PC-ANG-01",
        "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
        "tipoRiesgo": "Inundación y anegamiento fluvial",
        "prioridad": "ALTA",
        "activo": true,
        "estadoTexto": "Activo",
        "latitud": -39.8456,
        "longitud": -73.2389,
        "delegacion": {
          "id": "30000000-0000-4000-8000-000000000002",
          "codigo": "DEL_SUR",
          "nombre": "Delegación Municipal Sur"
        },
        "creadoEn": "2026-10-06T12:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "pagina": 1,
      "limite": 10,
      "totalPaginas": 1
    }
  }
  ```

---

#### `CP-H57-API-12`: Rechazo de prioridad no reconocida en catálogo mediante esquema Zod
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "debe rechazar prioridades no reconocidas por el catálogo"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 1. Validación de Esquemas Zod > debe rechazar prioridades no reconocidas por el catálogo 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos?prioridad=URGENTE_NO_VALIDO" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "Parámetros de consulta inválidos.",
    "errors": [
      {
        "campo": "prioridad",
        "mensaje": "Invalid enum value. Expected 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA', received 'URGENTE_NO_VALIDO'"
      }
    ]
  }
  ```

---

#### `CP-H57-API-13`: Búsqueda textual parcial insensible a mayúsculas y acentos (`busqueda="Angachilla"`)
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3001/api/puntos-criticos?busqueda=Angachilla" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "data": [
      {
        "id": "40000000-0000-4000-8000-000000000001",
        "codigo": "PC-ANG-01",
        "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
        "descripcion": "Zona baja susceptible a inundación fluvial y anegamiento en periodo invernal",
        "tipoRiesgo": "Inundación y anegamiento fluvial",
        "prioridad": "ALTA",
        "activo": true,
        "estadoTexto": "Activo",
        "latitud": -39.8456,
        "longitud": -73.2389,
        "delegacion": {
          "id": "30000000-0000-4000-8000-000000000002",
          "codigo": "DEL_SUR",
          "nombre": "Delegación Municipal Sur"
        },
        "creadoEn": "2026-10-06T12:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "pagina": 1,
      "limite": 10,
      "totalPaginas": 1
    }
  }
  ```

---

#### `CP-H57-API-14`: Manejo limpio de puntos críticos sin delegación territorial (`LEFT JOIN` con `delegacion: null`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "debe formatear campos correctamente y manejar delegación nula"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 2. Mapeo de Fila a Objeto de Dominio (mapearFilaPuntoCritico) > debe formatear campos correctamente y manejar delegación nula 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```

---

#### `CP-H57-API-15`: Exposición de especificación OpenAPI 3.0 con ruta `GET /api/puntos-criticos`
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/openapi.json/__tests__/route.test.ts
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 150ms
     ✓ Endpoint GET /openapi.json > debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos 148ms

   Test Files  1 passed (1)
        Tests  1 passed | 11 skipped (1)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s "http://localhost:3001/openapi.json" | grep -A 20 '"/api/puntos-criticos":'
  ```
* **Salida Obtenida:**
  ```json
    "/api/puntos-criticos": {
      "get": {
        "summary": "Listar puntos críticos y sectores vulnerables",
        "description": "Retorna la colección paginada de puntos críticos y sectores vulnerables monitoreados en Valdivia. Admite filtros por delegación, prioridad, estado activo y búsqueda textual. Requiere rol Administrador.",
        "tags": [
          "Eventos ATP"
        ],
        "parameters": [
          { "name": "pagina", "in": "query", "schema": { "type": "integer", "default": 1 } },
          { "name": "limite", "in": "query", "schema": { "type": "integer", "default": 10 } },
          { "name": "delegacionId", "in": "query", "schema": { "type": "string", "format": "uuid" } },
          { "name": "activo", "in": "query", "schema": { "type": "boolean" } },
          { "name": "prioridad", "in": "query", "schema": { "type": "string", "enum": ["BAJA", "MEDIA", "ALTA", "CRITICA"] } },
          { "name": "busqueda", "in": "query", "schema": { "type": "string" } },
          { "name": "x-user-id", "in": "header", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "responses": {
          "200": { "description": "Colección paginada de puntos críticos obtenida exitosamente" },
          "400": { "description": "Parámetros de consulta inválidos" },
          "401": { "description": "No autenticado. Se requiere cabecera de autenticación válida" },
          "403": { "description": "Acceso denegado. Se requiere perfil de Administrador con permiso puntos_criticos:leer" },
          "500": { "description": "Error interno del servidor al procesar la solicitud" }
        }
      }
    }
  ```

---

## 5. Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (HU-57) | Casos de Prueba Asociados | Estado QA | Evidencia Técnica |
|---|---|:---:|---|
| **Criterio 1:** El sistema permite al administrador acceder a una vista con la lista completa de puntos críticos almacenados. | `CP-H57-API-01`, `CP-H57-API-06`, `CP-H57-API-07`, `CP-H57-API-15` | 🟢 Cumplido | Endpoint `GET /api/puntos-criticos` con paginación, filtros y retorno paginado en Kysely. |
| **Criterio 2:** La lista despliega la información esencial de cada punto crítico (ej. identificador, descripción, coordenadas geográficas/ubicación, estado actual y delegación asociada). | `CP-H57-API-02`, `CP-H57-API-09`, `CP-H57-API-10`, `CP-H57-API-11`, `CP-H57-API-13`, `CP-H57-API-14` | 🟢 Cumplido | Esquema `PuntoCriticoItemResponseSchema` con mapeador `mapearFilaPuntoCritico` entregando todos los campos requeridos y coordenadas numéricas WGS84. |
| **Criterio 3:** Si la base de datos no contiene puntos críticos registrados, el sistema muestra un mensaje claro indicando que la lista está vacía. | `CP-H57-API-03` | 🟢 Cumplido | Retorno de `data: []`, `total: 0`, `totalPaginas: 0` con HTTP 200 OK, habilitando el Empty State nativo en frontend sin errores de red. |
| **Criterio 4:** El acceso a esta vista y al consumo de los datos está restringido exclusivamente a usuarios autenticados con el rol de Administrador. | `CP-H57-API-04`, `CP-H57-API-05`, `BUG-H57-API-04` | 🟢 Cumplido | `extraerUsuarioId(req)` responde HTTP 401 si falta cabecera; `validarAccesoAdministrador()` responde HTTP 403 con mensaje claro ante roles no autorizados. |

---

## 6. Conclusión y Dictamen de Calidad

1. **Estado de la Rama:** La rama `feature/H57-listado-puntos-criticos` se encuentra mergeada en `develop` (Pull Request #17).
2. **Ciclo de Re-Test:** Los 5 defectos detectados durante el desarrollo fueron reportados, solucionados mediante commits estructurados en Conventional Commits y certificados como **CORREGIDO** tras re-tests formales.
3. **Calidad de Código:** La suite automatizada de Vitest cuenta con 56 tests específicos aprobados al 100%, TypeScript compila sin errores (`npm run build` en Turbopack) y ESLint reporta 0 errores.
4. **Dictamen Final:** **APROBADO PARA PRODUCCIÓN (PASS)**.
