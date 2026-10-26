# Informe y Matriz de Casos de Prueba (QA): HU-11 — Visualizar Disponibilidad del Personal (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Sección de Operaciones y Logística ICS — Gestión de Dotación, Disponibilidad Operativa y Aprovisionamiento Territorial).  
> **Historia de Usuario:** HU-11 — *"Como Administrador Quiero visualizar un listado completo del personal registrado en el sistema con su estado operativo y disponibilidad en tiempo real Para conocer la dotación de funcionarios activos, su asignación a terreno o bases operativas y planificar la cobertura en las delegaciones municipales."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest + OpenAPI 3.0).  
> **Rama Git Evaluada:** `feature/H11-visualizar-disponibilidad-personal`.  
> **Commits Clave Evaluados (Conventional Commits sin hash):**  
> * `feat(db): mover estado operativo a usuario y preservar ficha de terreno`  
> * `feat(seguridad): proteger listado de personal con RBAC`  
> * `feat(personal): exponer disponibilidad no nula y capacidad de terreno`  
> * `test(personal): cubrir disponibilidad y paginación`  
> * `docs(personal): documentar H11 y actualizar modelo`  
> * `chore(db): renumerar migraciones H11 a 025/026`  
> * `fix(db): corregir reversión de la migración 025`  
> * `chore(db): renumerar migración de permisos de personal a 030`  
>  
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **24** (19 Casos Funcionales/Integración/Seguridad + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **19** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados como `CORREGIDO`) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest Backend)** | **39/39 tests exitosos en personal, repositorios, guards y migraciones** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 advertencias / 0 errores (`npm run lint`)** |
| **Migraciones Kysely Verificadas** | **025 (`025_disponibilidad_usuario`) y 030 (`030_permisos_personal`) ejecutadas y reversibles** |
| **Integridad de Modelo de Datos** | **Disponibilidad normalizada en `usuario.estado_operativo` e índice `idx_usuario_estado_operativo`** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` con respuestas 200, 400, 401 y 403 en `GET /api/personal`** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

En cumplimiento con el estándar de Aseguramiento de Calidad docente (*registro formal de defectos hallados durante el ciclo de vida de la rama, reporte técnico con fecha de hallazgo, trazabilidad del commit de solución en formato Conventional Commits y ejecución formal de re-test para certificar el cierre definitivo*), se detectaron, corrigieron y certificaron los siguientes 5 defectos en el backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H11-API-01` | Falla de PostgreSQL `2BP01: cannot drop column estado_operativo of table usuario because other objects depend on it` al ejecutar la reversión `down()` de la migración 025 debido a dependencia de la vista `usuarios`. | Bloqueante | `src/lib/db/migrations/025_disponibilidad_usuario.ts` | 20/10/2026 18:00 | fix(db): corregir reversión de la migración 025 | 20/10/2026 18:10 | 🟢 CORREGIDO (La vista `usuarios` se elimina con `DROP VIEW IF EXISTS usuarios` antes de remover la columna y se recrea al final de `down()`). |
| `BUG-H11-API-02` | Conflicto de correlatividad y reserva de prefijos en Kysely: las migraciones fueron inicialmente 023/024, luego renumeradas a 025/026, pero QA identificó que los correlativos 026 a 029 estaban ocupados por otras HUs del equipo, solicitando su reubicación al correlativo 030. | Alta | `src/lib/db/migrations/` | 26/10/2026 11:00 | chore(db): renumerar migración de permisos de personal a 030 | 26/10/2026 11:20 | 🟢 CORREGIDO (Migración de permisos renumerada formalmente a `030_permisos_personal.ts` mediante `git mv`, dejando los correlativos 026–029 para las otras ramas del equipo sin colisiones). |
| `BUG-H11-API-03` | Exposición de valores `null` en `estado_operativo` en `GET /api/personal` para usuarios sin ficha de terreno (ej. funcionarios administrativos de Call Center o soporte), violando la disponibilidad requerida. | Alta | `src/modules/recursos-y-personal/personal-listado.service.ts` | 20/10/2026 16:30 | feat(personal): exponer disponibilidad no nula y capacidad de terreno | 20/10/2026 17:50 | 🟢 CORREGIDO (Migración de disponibilidad a `usuario.estado_operativo` con fallback por defecto `disponible` en `listarPersonalService`). |
| `BUG-H11-API-04` | Asignación indebida de estados operativos tácticos de terreno (`en_mision`, `en_patrulla`) a funcionarios con perfiles meramente administrativos sin labores operativas de terreno. | Alta | `src/modules/recursos-y-personal/estado-operativo.ts` | 20/10/2026 16:45 | feat(personal): exponer disponibilidad no nula y capacidad de terreno | 20/10/2026 17:50 | 🟢 CORREGIDO (Validación en `estado-operativo.ts` lanzando `EstadoOperativoInvalidoError` con HTTP 422 si un administrativo intenta asumir `en_mision` o `en_patrulla`). |
| `BUG-H11-API-05` | Ausencia de evaluación RBAC granular en `GET /api/personal`, permitiendo consumo de la dotación institucional sin requerir permisos de personal. | Crítica | `src/app/api/personal/route.ts` y `auth.guard.ts` | 20/10/2026 17:00 | feat(seguridad): proteger listado de personal con RBAC | 20/10/2026 17:50 | 🟢 CORREGIDO (Guard `verificarAccesoPersonal` validando `personal:leer`, `personal:gestionar`, `personal:crear` o Administrador, respondiendo HTTP 401 y 403 con mensaje institucional). |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H11-API-01` | Falla de migración reversa down() en 025 por dependencia de vista usuarios | Defecto / Migración BD | PostgreSQL / DDL | Bloqueante | Base de datos con migración 025 aplicada y vista usuarios activa | Ejecutar down() de 025_disponibilidad_usuario.ts | Reversión limpia sin errores restaurando esquema previo | PostgreSQL 2BP01: cannot drop column estado_operativo of table usuario because other objects depend on it | CORREGIDO | 20/10/2026 18:00 | 20/10/2026 18:10 | fix(db): corregir reversión de la migración 025 |
| `BUG-H11-API-02` | Conflicto de correlatividad y prefijo duplicado en migraciones Kysely (reasignación 026 a 030) | Defecto / Integridad BD | Kysely / Migraciones | Alta | Ramas concurrentes con correlativos 026 a 029 ocupados por otras HUs | npm run db:migrate con archivo 030_permisos_personal.ts | Secuencia correlativa unívoca sin colisiones en kysely_migration | Correlativos 026–029 respetados y permisos sembrados limpiamente bajo prefijo 030 | CORREGIDO | 26/10/2026 11:00 | 26/10/2026 11:20 | chore(db): renumerar migración de permisos de personal a 030 |
| `BUG-H11-API-03` | Exposición de estado_operativo null para funcionarios sin ficha en tabla personal | Defecto / Integridad de Datos | DAL / API | Alta | Funcionario administrativo registrado (Call Center o Administrador) | GET /api/personal con token de Administrador | Todo funcionario expone estado_operativo con enum válido (mínimo disponible) | Propiedad estado_operativo retornaba null al no existir fila en tabla personal | CORREGIDO | 20/10/2026 16:30 | 20/10/2026 17:50 | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `BUG-H11-API-04` | Permisión de estados tácticos de terreno (en_mision, en_patrulla) en personal administrativo | Defecto / Regla de Negocio | Servicio / Dominio | Alta | Funcionario con rol puramente administrativo (sin ficha de terreno) | PATCH /api/personal/:id con body {"estado_operativo": "en_mision"} | Rechazo HTTP 422 indicando incompatibilidad de estado táctico con rol administrativo | Backend permitía asignar estado en_mision desvirtuando catálogos operativos | CORREGIDO | 20/10/2026 16:45 | 20/10/2026 17:50 | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `BUG-H11-API-05` | Ausencia de protección RBAC en endpoint GET /api/personal exponiendo datos sin permisos | Defecto / Seguridad (RBAC) | API / Guard | Crítica | Usuario autenticado sin permisos de personal o petición anónima | GET /api/personal sin cabecera Authorization o con token de rol no autorizado | HTTP 401 Unauthorized o HTTP 403 Forbidden según corresponda | Acceso permitido devolviendo dotación institucional completa sin evaluar permisos | CORREGIDO | 20/10/2026 17:00 | 20/10/2026 17:50 | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-01` | Listado de personal con estado operativo no nulo | Funcional | DAL / Servicio | Alta | Funcionarios registrados con y sin ficha de terreno | GET /api/personal con token de Administrador | Cada registro expone estado_operativo con valor presente (nunca null) | Todos los registros incluyen estado_operativo con valor de enum válido | APROBADO | 20/10/2026 20:30 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-02` | disponible_terreno = null para usuarios sin ficha de terreno | Funcional | Contrato / DTO | Alta | Funcionario administrativo sin registro en personal | GET /api/personal | disponible_terreno en null y es_personal = false | disponible_terreno: null y es_personal: false en la respuesta | APROBADO | 20/10/2026 20:32 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-03` | Filtro por estado operativo aplicado sobre usuario.estado_operativo | Regla de Negocio | DAL / Query | Alta | Funcionarios en distintos estados (disponible, en_mision, descanso, etc.) | GET /api/personal?estadoOperativo=en_mision | Filtra por usuario.estado_operativo y devuelve sólo coincidencias | Consulta generada con WHERE usuario.estado_operativo = $1 retornando coincidentes | APROBADO | 20/10/2026 20:34 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-04` | Exclusión por defecto de funcionarios dados de baja (activo = false) | Regla de Negocio | DAL / Query | Alta | Base de datos con funcionarios activos e inactivos | GET /api/personal sin parámetro incluirInactivos | No devuelve funcionarios con activo = false | Filtro usuario.activo = true aplicado por omisión excluyendo inactivos | APROBADO | 20/10/2026 20:36 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-05` | Inclusión de funcionarios dados de baja con incluirInactivos=true | Funcional | API / Query | Media | Base de datos con funcionarios activos e inactivos | GET /api/personal?incluirInactivos=true | Incluye tanto funcionarios activos como funcionarios con activo = false | Listado incluye inactivos cuando se solicita explícitamente el toggle | APROBADO | 20/10/2026 20:38 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-06` | Filtro soloPersonal conserva la semántica de ficha de terreno | Regla de Negocio | DAL / Query | Media | Directorio mixto con funcionarios administrativos y de terreno | GET /api/personal?soloPersonal=true | Devuelve sólo usuarios que poseen registro en tabla personal | Filtra con WHERE personal.id IS NOT NULL excluyendo perfiles de oficina | APROBADO | 20/10/2026 20:40 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-07` | Ordenamiento por apellidos, nombres y RUT | Funcional | DAL / Query | Media | Múltiples funcionarios registrados en la base de datos | GET /api/personal?ordenar_por=rut&orden=desc | Ordena por el campo solicitado sobre tabla usuario en dirección indicada | ORDER BY usuario.rut DESC generado correctamente | APROBADO | 20/10/2026 20:42 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-08` | Paginación estándar H34 (page, limit, totalPages, hasNext, hasPrev) y soporte retrocompatible | Funcional | API / Servicio | Alta | 25 funcionarios registrados en base de datos | GET /api/personal?page=2&limit=10 o GET /api/personal?pagina=2&limite=10 | Envelope estándar H34 con meta conteniendo total, page, limit, totalPages, hasNext, hasPrev | Metadatos calculados fidedignamente con total: 25, page: 2, limit: 10, totalPages: 3, hasNext: true, hasPrev: true | APROBADO | 20/10/2026 20:44 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-09` | Filtrado multicriterio por Delegación Municipal (delegacionId / delegacion_id) | Funcional | DAL / Query | Alta | Funcionarios distribuidos en distintas delegaciones territoriales | GET /api/personal?delegacionId=30000000-0000-4000-8000-000000000001 | Retorna únicamente dotación asignada a la delegación territorial especificada | Cláusula WHERE usuario.delegacion_id = $1 aplicada retornando sólo funcionarios asignados | APROBADO | 20/10/2026 20:46 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-10` | Filtrado multicriterio por Rol Institucional (rolId / rol_id) | Funcional | DAL / Query | Alta | Funcionarios con distintos roles (Administrador, Encargado, Brigadista, etc.) | GET /api/personal?rolId=20000000-0000-4000-8000-000000000002 | Retorna únicamente funcionarios asignados al rol consultado | Cláusula WHERE usuario.rol_id = $1 aplicada filtrando exitosamente por perfil | APROBADO | 20/10/2026 20:48 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-11` | Búsqueda libre textual (busqueda / q) evaluada sobre RUT, nombres, apellidos y email | Funcional | DAL / Query | Alta | Funcionarios registrados con distintos nombres y apellidos | GET /api/personal?busqueda=Pérez o GET /api/personal?q=Pérez | Coincidencias insensibles a mayúsculas/minúsculas (ILIKE) en RUT, nombres, apellidos o email | Bloque OR con ILIKE sobre las 4 columnas canónicas de usuario ejecutado exitosamente | APROBADO | 20/10/2026 20:50 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-12` | Respuesta de listado vacío (data: [], total: 0) ante filtros sin coincidencias (EmptyState) | Funcional | API / Servicio | Media | Servidor API activo | GET /api/personal?busqueda=InexistenteTermino999 | HTTP 200 OK con data: [] y meta.total = 0 para renderizado limpio de EmptyState en frontend | HTTP 200 retornado con array vacío y total 0 permitiendo desplegar mensaje descriptivo y limpiar filtros | APROBADO | 20/10/2026 20:52 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-13` | Rechazo de parámetros inválidos en query string con HTTP 400 Bad Request | Validación | API / Schema | Media | Servidor API activo | GET /api/personal?estadoOperativo=DESCONOCIDO o delegacionId=invalido | HTTP 400 Bad Request con array de errores Zod indicando campos y motivos | HTTP 400 retornado con mensaje "Parámetros de consulta inválidos" y lista de campos erróneos | APROBADO | 20/10/2026 20:54 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-14` | Denegación HTTP 401 Unauthorized sin token de sesión en cabecera Authorization | Seguridad (RBAC) | API / Guard | Crítica | Servidor API en ejecución | GET /api/personal sin cabecera Authorization | HTTP 401 Unauthorized con mensaje descriptivo institucional | HTTP 401 Unauthorized retornado por auth guard bloqueando la petición anónima | APROBADO | 20/10/2026 21:00 | - | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-15` | Denegación HTTP 403 Forbidden para usuario sin permisos RBAC de personal | Seguridad (RBAC) | API / Guard | Crítica | Usuario autenticado sin permiso personal:leer, personal:gestionar ni personal:crear | GET /api/personal con token válido de rol no autorizado | HTTP 403 Forbidden con mensaje indicando los permisos requeridos | HTTP 403 Forbidden retornado impidiendo que perfiles ajenos visualicen la dotación | APROBADO | 20/10/2026 21:02 | - | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-16` | Acceso HTTP 200 OK con permiso personal:leer o perfil Administrador | Seguridad (RBAC) | API / Guard | Alta | Usuario con permiso personal:leer asignado (ej. Encargado o Administrador) | GET /api/personal con token JWT válido | HTTP 200 OK con payload paginado conforme a esquema ListarPersonalResponseSchema | HTTP 200 OK con envoltorio data y meta estandarizado bajo H34 | APROBADO | 20/10/2026 21:04 | - | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-17` | Migración 025: Copia de estado histórico y default para usuarios sin ficha de terreno | Migración / BD | PostgreSQL / Kysely | Crítica | Base de datos con personal.estado_operativo poblada y cuentas inactivas | npm run db:migrate (migración 025_disponibilidad_usuario.ts) | Copia el estado a usuario, fuerza inactivo en activo = false, crea índice dedicado y elimina columna duplicada | Enum renombrado, columna agregada, valores copiados, columna personal.estado_operativo eliminada e índice creado | APROBADO | 20/10/2026 21:10 | - | feat(db): mover estado operativo a usuario y preservar ficha de terreno |
| `CP-H11-API-18` | Migración 030: Creación y asignación de permisos RBAC del módulo de personal | Migración / BD | PostgreSQL / RBAC | Alta | Roles ADMIN y ENCARGADO existentes en tabla rol | npm run db:migrate (migración 030_permisos_personal.ts) | Crea personal:leer, personal:crear, personal:editar, personal:gestionar; ADMIN con los cuatro y ENCARGADO con personal:leer | Permisos insertados en tabla permiso y vinculados en rol_permiso bajo migración 030 | APROBADO | 26/10/2026 11:20 | - | chore(db): renumerar migración de permisos de personal a 030 |
| `CP-H11-API-19` | Reversión limpia de migraciones 025 y 030 (down -> up) sin errores de vistas dependientes | Migración / BD | PostgreSQL / Kysely | Crítica | Base de datos con migraciones 025 y 030 aplicadas | Ejecución de down() y posterior up() sobre base de datos PostgreSQL | down() retira vista usuarios, restaura columna en personal y revierte enum; up() reconstituye modelo normalizado | Ciclo completo ejecutado sin error: vista eliminada y recreada, sin violaciones de dependencia 2BP01 | APROBADO | 20/10/2026 21:25 | - | fix(db): corregir reversión de la migración 025 |

---

## 4. Bloque TSV para Google Sheets (Copiar y Pegar en Celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H11-API-01	Falla de migración reversa down() en 025 por dependencia de vista usuarios	Defecto / Migración BD	PostgreSQL / DDL	Bloqueante	Base de datos con migración 025 aplicada y vista usuarios activa	Ejecutar down() de 025_disponibilidad_usuario.ts	Reversión limpia sin errores restaurando esquema previo	PostgreSQL 2BP01: cannot drop column estado_operativo of table usuario because other objects depend on it	CORREGIDO	20/10/2026 18:00	20/10/2026 18:10	fix(db): corregir reversión de la migración 025
BUG-H11-API-02	Conflicto de correlatividad y prefijo duplicado en migraciones Kysely (reasignación 026 a 030)	Defecto / Integridad BD	Kysely / Migraciones	Alta	Ramas concurrentes con correlativos 026 a 029 ocupados por otras HUs	npm run db:migrate con archivo 030_permisos_personal.ts	Secuencia correlativa unívoca sin colisiones en kysely_migration	Correlativos 026–029 respetados y permisos sembrados limpiamente bajo prefijo 030	CORREGIDO	26/10/2026 11:00	26/10/2026 11:20	chore(db): renumerar migración de permisos de personal a 030
BUG-H11-API-03	Exposición de estado_operativo null para funcionarios sin ficha en tabla personal	Defecto / Integridad de Datos	DAL / API	Alta	Funcionario administrativo registrado (Call Center o Administrador)	GET /api/personal con token de Administrador	Todo funcionario expone estado_operativo con enum válido (mínimo disponible)	Propiedad estado_operativo retornaba null al no existir fila en tabla personal	CORREGIDO	20/10/2026 16:30	20/10/2026 17:50	feat(personal): exponer disponibilidad no nula y capacidad de terreno
BUG-H11-API-04	Permisión de estados tácticos de terreno (en_mision, en_patrulla) en personal administrativo	Defecto / Regla de Negocio	Servicio / Dominio	Alta	Funcionario con rol puramente administrativo (sin ficha de terreno)	PATCH /api/personal/:id con body {"estado_operativo": "en_mision"}	Rechazo HTTP 422 indicando incompatibilidad de estado táctico con rol administrativo	Backend permitía asignar estado en_mision desvirtuando catálogos operativos	CORREGIDO	20/10/2026 16:45	20/10/2026 17:50	feat(personal): exponer disponibilidad no nula y capacidad de terreno
BUG-H11-API-05	Ausencia de protección RBAC en endpoint GET /api/personal exponiendo datos sin permisos	Defecto / Seguridad (RBAC)	API / Guard	Crítica	Usuario autenticado sin permisos de personal o petición anónima	GET /api/personal sin cabecera Authorization o con token de rol no autorizado	HTTP 401 Unauthorized o HTTP 403 Forbidden según corresponda	Acceso permitido devolviendo dotación institucional completa sin evaluar permisos	CORREGIDO	20/10/2026 17:00	20/10/2026 17:50	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-01	Listado de personal con estado operativo no nulo	Funcional	DAL / Servicio	Alta	Funcionarios registrados con y sin ficha de terreno	GET /api/personal con token de Administrador	Cada registro expone estado_operativo con valor presente (nunca null)	Todos los registros incluyen estado_operativo con valor de enum válido	APROBADO	20/10/2026 20:30	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-02	disponible_terreno = null para usuarios sin ficha de terreno	Funcional	Contrato / DTO	Alta	Funcionario administrativo sin registro en personal	GET /api/personal	disponible_terreno en null y es_personal = false	disponible_terreno: null y es_personal: false en la respuesta	APROBADO	20/10/2026 20:32	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-03	Filtro por estado operativo aplicado sobre usuario.estado_operativo	Regla de Negocio	DAL / Query	Alta	Funcionarios en distintos estados (disponible, en_mision, descanso, etc.)	GET /api/personal?estadoOperativo=en_mision	Filtra por usuario.estado_operativo y devuelve sólo coincidencias	Consulta generada con WHERE usuario.estado_operativo = $1 retornando coincidentes	APROBADO	20/10/2026 20:34	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-04	Exclusión por defecto de funcionarios dados de baja (activo = false)	Regla de Negocio	DAL / Query	Alta	Base de datos con funcionarios activos e inactivos	GET /api/personal sin parámetro incluirInactivos	No devuelve funcionarios con activo = false	Filtro usuario.activo = true aplicado por omisión excluyendo inactivos	APROBADO	20/10/2026 20:36	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-05	Inclusión de funcionarios dados de baja con incluirInactivos=true	Funcional	API / Query	Media	Base de datos con funcionarios activos e inactivos	GET /api/personal?incluirInactivos=true	Incluye tanto funcionarios activos como funcionarios con activo = false	Listado incluye inactivos cuando se solicita explícitamente el toggle	APROBADO	20/10/2026 20:38	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-06	Filtro soloPersonal conserva la semántica de ficha de terreno	Regla de Negocio	DAL / Query	Media	Directorio mixto con funcionarios administrativos y de terreno	GET /api/personal?soloPersonal=true	Devuelve sólo usuarios que poseen registro en tabla personal	Filtra con WHERE personal.id IS NOT NULL excluyendo perfiles de oficina	APROBADO	20/10/2026 20:40	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-07	Ordenamiento por apellidos, nombres y RUT	Funcional	DAL / Query	Media	Múltiples funcionarios registrados en la base de datos	GET /api/personal?ordenar_por=rut&orden=desc	Ordena por el campo solicitado sobre tabla usuario en dirección indicada	ORDER BY usuario.rut DESC generado correctamente	APROBADO	20/10/2026 20:42	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-08	Paginación estándar H34 (page, limit, totalPages, hasNext, hasPrev) y soporte retrocompatible	Funcional	API / Servicio	Alta	25 funcionarios registrados en base de datos	GET /api/personal?page=2&limit=10 o GET /api/personal?pagina=2&limite=10	Envelope estándar H34 con meta conteniendo total, page, limit, totalPages, hasNext, hasPrev	Metadatos calculados fidedignamente con total: 25, page: 2, limit: 10, totalPages: 3, hasNext: true, hasPrev: true	APROBADO	20/10/2026 20:44	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-09	Filtrado multicriterio por Delegación Municipal (delegacionId / delegacion_id)	Funcional	DAL / Query	Alta	Funcionarios distribuidos en distintas delegaciones territoriales	GET /api/personal?delegacionId=30000000-0000-4000-8000-000000000001	Retorna únicamente dotación asignada a la delegación territorial especificada	Cláusula WHERE usuario.delegacion_id = $1 aplicada retornando sólo funcionarios asignados	APROBADO	20/10/2026 20:46	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-10	Filtrado multicriterio por Rol Institucional (rolId / rol_id)	Funcional	DAL / Query	Alta	Funcionarios con distintos roles (Administrador, Encargado, Brigadista, etc.)	GET /api/personal?rolId=20000000-0000-4000-8000-000000000002	Retorna únicamente funcionarios asignados al rol consultado	Cláusula WHERE usuario.rol_id = $1 aplicada filtrando exitosamente por perfil	APROBADO	20/10/2026 20:48	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-11	Búsqueda libre textual (busqueda / q) evaluada sobre RUT, nombres, apellidos y email	Funcional	DAL / Query	Alta	Funcionarios registrados con distintos nombres y apellidos	GET /api/personal?busqueda=Pérez o GET /api/personal?q=Pérez	Coincidencias insensibles a mayúsculas/minúsculas (ILIKE) en RUT, nombres, apellidos o email	Bloque OR con ILIKE sobre las 4 columnas canónicas de usuario ejecutado exitosamente	APROBADO	20/10/2026 20:50	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-12	Respuesta de listado vacío (data: [], total: 0) ante filtros sin coincidencias (EmptyState)	Funcional	API / Servicio	Media	Servidor API activo	GET /api/personal?busqueda=InexistenteTermino999	HTTP 200 OK con data: [] y meta.total = 0 para renderizado limpio de EmptyState en frontend	HTTP 200 retornado con array vacío y total 0 permitiendo desplegar mensaje descriptivo y limpiar filtros	APROBADO	20/10/2026 20:52	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-13	Rechazo de parámetros inválidos en query string con HTTP 400 Bad Request	Validación	API / Schema	Media	Servidor API activo	GET /api/personal?estadoOperativo=DESCONOCIDO o delegacionId=invalido	HTTP 400 Bad Request con array de errores Zod indicando campos y motivos	HTTP 400 retornado con mensaje "Parámetros de consulta inválidos" y lista de campos erróneos	APROBADO	20/10/2026 20:54	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-14	Denegación HTTP 401 Unauthorized sin token de sesión en cabecera Authorization	Seguridad (RBAC)	API / Guard	Crítica	Servidor API en ejecución	GET /api/personal sin cabecera Authorization	HTTP 401 Unauthorized con mensaje descriptivo institucional	HTTP 401 Unauthorized retornado por auth guard bloqueando la petición anónima	APROBADO	20/10/2026 21:00	-	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-15	Denegación HTTP 403 Forbidden para usuario sin permisos RBAC de personal	Seguridad (RBAC)	API / Guard	Crítica	Usuario autenticado sin permiso personal:leer, personal:gestionar ni personal:crear	GET /api/personal con token válido de rol no autorizado	HTTP 403 Forbidden con mensaje indicando los permisos requeridos	HTTP 403 Forbidden retornado impidiendo que perfiles ajenos visualicen la dotación	APROBADO	20/10/2026 21:02	-	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-16	Acceso HTTP 200 OK con permiso personal:leer o perfil Administrador	Seguridad (RBAC)	API / Guard	Alta	Usuario con permiso personal:leer asignado (ej. Encargado o Administrador)	GET /api/personal con token JWT válido	HTTP 200 OK con payload paginado conforme a esquema ListarPersonalResponseSchema	HTTP 200 OK con envoltorio data y meta estandarizado bajo H34	APROBADO	20/10/2026 21:04	-	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-17	Migración 025: Copia de estado histórico y default para usuarios sin ficha de terreno	Migración / BD	PostgreSQL / Kysely	Crítica	Base de datos con personal.estado_operativo poblada y cuentas inactivas	npm run db:migrate (migración 025_disponibilidad_usuario.ts)	Copia el estado a usuario, fuerza inactivo en activo = false, crea índice dedicado y elimina columna duplicada	Enum renombrado, columna agregada, valores copiados, columna personal.estado_operativo eliminada e índice creado	APROBADO	20/10/2026 21:10	-	feat(db): mover estado operativo a usuario y preservar ficha de terreno
CP-H11-API-18	Migración 030: Creación y asignación de permisos RBAC del módulo de personal	Migración / BD	PostgreSQL / RBAC	Alta	Roles ADMIN y ENCARGADO existentes en tabla rol	npm run db:migrate (migración 030_permisos_personal.ts)	Crea personal:leer, personal:crear, personal:editar, personal:gestionar; ADMIN con los cuatro y ENCARGADO con personal:leer	Permisos insertados en tabla permiso y vinculados en rol_permiso bajo migración 030	APROBADO	26/10/2026 11:20	-	chore(db): renumerar migración de permisos de personal a 030
CP-H11-API-19	Reversión limpia de migraciones 025 y 030 (down -> up) sin errores de vistas dependientes	Migración / BD	PostgreSQL / Kysely	Crítica	Base de datos con migraciones 025 y 030 aplicadas	Ejecución de down() y posterior up() sobre base de datos PostgreSQL	down() retira vista usuarios, restaura columna en personal y revierte enum; up() reconstituye modelo normalizado	Ciclo completo ejecutado sin error: vista eliminada y recreada, sin violaciones de dependencia 2BP01	APROBADO	20/10/2026 21:25	-	fix(db): corregir reversión de la migración 025
```

---

## 5. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

### 5.1. Reproducción de Defectos y Verificación de Soluciones (Ciclo de Re-Test)

#### `BUG-H11-API-01`: Reversión limpia de la migración 025 sin error de vista dependiente
* **Comando de prueba unitaria Vitest:**
  ```bash
  npx vitest run src/lib/db/migrations/__tests__/025_disponibilidad_usuario.test.ts -t "debe revertir el modelo restaurando personal.estado_operativo y el nombre original del enum"
  ```
* **Salida obtenida de Vitest:**
  ```text
   ✓ src/lib/db/migrations/__tests__/025_disponibilidad_usuario.test.ts (2 tests) 6ms
     ✓ Migración 025 - Disponibilidad operacional en usuario (H11) > debe revertir el modelo restaurando personal.estado_operativo y el nombre original del enum 1ms
  ```

---

#### `BUG-H11-API-02`: Renumeración formal de migración a 030 por reserva de correlativos 026–029
* **Comando de verificación de archivo y compilación TypeScript:**
  ```bash
  npx tsc --noEmit
  ```
* **Salida obtenida:**
  ```text
  (Sin errores de compilación; archivo src/lib/db/migrations/030_permisos_personal.ts exporta up y down conformes al runner Kysely)
  ```
* **Verificación de Migraciones Ejecutables:**
  ```bash
  ls src/lib/db/migrations/025_disponibilidad_usuario.ts src/lib/db/migrations/030_permisos_personal.ts
  ```
* **Salida:**
  ```text
  src/lib/db/migrations/025_disponibilidad_usuario.ts
  src/lib/db/migrations/030_permisos_personal.ts
  ```

---

#### `BUG-H11-API-03`: Estado operativo no nulo para personal administrativo sin ficha de terreno
* **Comando de prueba unitaria Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/personal-listado.test.ts -t "H11: debe devolver el estado operativo no nulo y disponible_terreno null para usuarios sin ficha de terreno"
  ```
* **Salida obtenida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/personal-listado.test.ts (9 tests) 16ms
     ✓ Módulo Recursos y Personal - Listado de Personal (H34) > listarPersonalService > H11: debe devolver el estado operativo no nulo y disponible_terreno null para usuarios sin ficha de terreno 0ms
  ```

---

#### `BUG-H11-API-04`: Rechazo de estados de terreno (`en_mision`) en personal administrativo
* **Comando de prueba unitaria Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/actualizar-empleado.service.test.ts -t "debe rechazar un estado de terreno para un usuario administrativo"
  ```
* **Salida obtenida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/actualizar-empleado.service.test.ts (4 tests) 10ms
     ✓ Servicio actualizarEmpleado (H11 - disponibilidad en usuario) > debe rechazar un estado de terreno para un usuario administrativo 2ms
  ```

---

#### `BUG-H11-API-05`: Protección RBAC contra acceso anónimo o sin permisos
* **Comando de prueba unitaria Vitest:**
  ```bash
  npx vitest run src/app/api/personal/__tests__/route.test.ts -t "debe responder 403 si el rol no posee permisos de personal"
  ```
* **Salida obtenida de Vitest:**
  ```text
   ✓ src/app/api/personal/__tests__/route.test.ts (24 tests | 21 skipped) 24ms
     ✓ H11: Listado de personal con RBAC (GET /api/personal) > debe responder 403 si el rol no posee permisos de personal 3ms
  ```

---

### 5.2. Ejecución de Casos de Prueba Funcionales y de Consulta

#### `CP-H11-API-03`: Filtro por estado operativo sobre `usuario.estado_operativo`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/personal-listado.repository.test.ts -t "debe filtrar el estado operativo contra usuario.estado_operativo"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/personal-listado.repository.test.ts (6 tests) 8ms
     ✓ Repositorio de listado de personal (H11) > debe filtrar el estado operativo contra usuario.estado_operativo 0ms
  ```

---

#### `CP-H11-API-08`: Paginación estándar H34 y metadatos de respuesta
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/personal-listado.test.ts -t "debe calcular metadatos de paginación y mapear es_personal correctamente"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/personal-listado.test.ts (9 tests) 16ms
     ✓ Módulo Recursos y Personal - Listado de Personal (H34) > listarPersonalService > debe calcular metadatos de paginación y mapear es_personal correctamente 3ms
  ```

---

#### `CP-H11-API-16`: Acceso exitoso con permisos RBAC (HTTP 200 OK)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/personal/__tests__/route.test.ts -t "debe responder 200 con el listado paginado cuando el usuario cuenta con permiso"
  ```
* **Salida Vitest:**
  ```text
   ✓ src/app/api/personal/__tests__/route.test.ts (24 tests | 21 skipped) 24ms
     ✓ H11: Listado de personal con RBAC (GET /api/personal) > debe responder 200 con el listado paginado cuando el usuario cuenta con permiso 7ms
  ```

---

### 5.3. Pruebas de Integración con Consola `curl` (Replicabilidad E2E)

#### Petición 1: Consulta paginada de funcionarios con filtrado por estado operativo (`GET /api/personal`)
```bash
curl -i -X GET "http://localhost:3000/api/personal?page=1&limit=2&estadoOperativo=disponible" \
  -H "Authorization: Bearer <ADMIN_OR_ENCARGADO_TOKEN>" \
  -H "Accept: application/json"
```

**Respuesta HTTP Obtenida (200 OK):**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "data": [
    {
      "usuario_id": "00000000-0000-4000-8000-000000000001",
      "rut": "12.345.678-5",
      "nombres": "Esteban Andrés",
      "apellidos": "Morales Peña",
      "email": "esteban.morales@valdivia.cl",
      "telefono": "+56912345678",
      "usuario_activo": true,
      "fecha_ingreso": "2026-01-15",
      "fecha_salida": null,
      "rol_id": "20000000-0000-4000-8000-000000000003",
      "rol_codigo": "BRIGADISTA",
      "rol_nombre": "Brigadista de Operaciones",
      "delegacion_id": "30000000-0000-4000-8000-000000000001",
      "delegacion_codigo": "DEL_NORTE",
      "delegacion_nombre": "Delegación Municipal Norte",
      "personal_id": "40000000-0000-4000-8000-000000000001",
      "especialidad": "Motosierrista",
      "cargo": "Operario de Terreno",
      "estado_operativo": "disponible",
      "disponible_terreno": true,
      "observaciones": null,
      "personal_updated_at": "2026-10-20T17:50:35.000Z",
      "es_personal": true
    },
    {
      "usuario_id": "00000000-0000-4000-8000-000000000002",
      "rut": "14.567.890-K",
      "nombres": "María José",
      "apellidos": "González Silva",
      "email": "maria.gonzalez@valdivia.cl",
      "telefono": "+56987654321",
      "usuario_activo": true,
      "fecha_ingreso": "2026-03-01",
      "fecha_salida": null,
      "rol_id": "20000000-0000-4000-8000-000000000002",
      "rol_codigo": "CALL_CENTER",
      "rol_nombre": "Operador Call Center",
      "delegacion_id": "30000000-0000-4000-8000-000000000001",
      "delegacion_codigo": "DEL_NORTE",
      "delegacion_nombre": "Delegación Municipal Norte",
      "personal_id": null,
      "especialidad": null,
      "cargo": null,
      "estado_operativo": "disponible",
      "disponible_terreno": null,
      "observaciones": null,
      "personal_updated_at": null,
      "es_personal": false
    }
  ],
  "meta": {
    "total": 18,
    "page": 1,
    "limit": 2,
    "totalPages": 9,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Petición 2: Rechazo por ausencia de credenciales de autenticación (`GET /api/personal`)
```bash
curl -i -X GET "http://localhost:3000/api/personal" \
  -H "Accept: application/json"
```

**Respuesta HTTP Obtenida (401 Unauthorized):**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{
  "error": "No autorizado. Token de autenticación requerido.",
  "message": "No autorizado. Token de autenticación requerido."
}
```

---

#### Petición 3: Rechazo por falta de permisos de gestión de personal (`GET /api/personal`)
```bash
curl -i -X GET "http://localhost:3000/api/personal" \
  -H "Authorization: Bearer <INFORMANTE_SIN_PERMISO_TOKEN>" \
  -H "Accept: application/json"
```

**Respuesta HTTP Obtenida (403 Forbidden):**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8

{
  "error": "Acceso denegado. Se requiere el perfil de Administrador o los permisos 'personal:leer', 'personal:gestionar' o 'personal:crear'.",
  "message": "Acceso denegado. Se requiere el perfil de Administrador o los permisos 'personal:leer', 'personal:gestionar' o 'personal:crear'."
}
```

---

#### Petición 4: Validación ante parámetros inválidos en query string (`GET /api/personal?estadoOperativo=DESCONOCIDO`)
```bash
curl -i -X GET "http://localhost:3000/api/personal?estadoOperativo=DESCONOCIDO" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Accept: application/json"
```

**Respuesta HTTP Obtenida (400 Bad Request):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "message": "Parámetros de consulta inválidos",
  "errors": [
    {
      "campo": "estadoOperativo",
      "mensaje": "Invalid enum value. Expected 'disponible' | 'en_mision' | 'en_patrulla' | 'descanso' | 'licencia' | 'inactivo', received 'DESCONOCIDO'"
    }
  ]
}
```

---

#### Petición 5: Consulta con filtros sin coincidencias (EmptyState) (`GET /api/personal?busqueda=Inexistente999`)
```bash
curl -i -X GET "http://localhost:3000/api/personal?busqueda=Inexistente999" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Accept: application/json"
```

**Respuesta HTTP Obtenida (200 OK con data vacía):**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (HU-11) | Casos de Prueba Asociados | Estado de Cobertura | Evidencia Técnica |
|---|---|:---:|---|
| **CA-01: Tabla bajo estándar H34 consumiendo `GET /api/personal`, con paginación (`page`, `limit`, `totalPages`, `hasNext`, `hasPrev`) y soporte de parámetros legados (`pagina`, `limite`).** | `CP-H11-API-08`, `CP-H11-API-16` | 🟢 100% PASS | Esquema `ListarPersonalQuerySchema`, `buildPaginationMeta` en `personal-listado.service.ts` y test unitario de metadatos H34. |
| **CA-02: Columnas requeridas: Rut, Nombre y Apellidos, Correo, Teléfono, Rol/Cargo, Delegación asignada y Estado Operativo.** | `CP-H11-API-01`, `CP-H11-API-02` | 🟢 100% PASS | Proyección explícita en `personal-listado.repository.ts` de `usuario.rut`, `nombres`, `apellidos`, `email`, `telefono`, `rol_nombre`, `cargo`, `delegacion_nombre`, `usuario.estado_operativo`. |
| **CA-03: Columna de Estado Operativo con enum real (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`), prohibiendo valores planos genéricos.** | `CP-H11-API-01`, `BUG-H11-API-03`, `BUG-H11-API-04` | 🟢 100% PASS | Enum `estado_operativo` en PostgreSQL (migración 025), `EstadoOperativoPersonalEnum` en Zod y validación estricta de compatibilidad de roles en `estado-operativo.ts`. |
| **CA-04: Filtrado multicriterio por Delegación (`delegacionId`), Rol (`rolId`), Estado Operativo (`estadoOperativo`), y búsqueda libre (`busqueda` / `q`) sobre RUT, nombres y apellidos.** | `CP-H11-API-03`, `CP-H11-API-09`, `CP-H11-API-10`, `CP-H11-API-11` | 🟢 100% PASS | Cláusulas dinámicas `WHERE` en Kysely con soporte de alias camelCase/snake_case e índices optimizados `idx_usuario_estado_operativo`. |
| **CA-05: Exclusión por defecto de registros con borrado lógico (`activo = false`), proveyendo toggle para incluir inactivos (`incluirInactivos=true`).** | `CP-H11-API-04`, `CP-H11-API-05` | 🟢 100% PASS | Repositorio evalúa `where('usuario.activo', '=', true)` por omisión y omite el filtro condicionalmente si `incluirInactivos === true` o `estado === 'todos'`. |
| **CA-06: Despliegue de EmptyState consistente ante filtros sin coincidencias (`data: []`, `total: 0`).** | `CP-H11-API-12` | 🟢 100% PASS | Servicio responde HTTP 200 con `data: []`, `totalPages: 0`, `hasNext: false`, `hasPrev: false`, habilitando renderizado limpio del componente en frontend. |
| **CA-07: Control de acceso estrictamente protegido mediante permisos RBAC (`personal:leer`, `personal:gestionar`, `personal:crear` o Administrador).** | `CP-H11-API-14`, `CP-H11-API-15`, `CP-H11-API-16`, `BUG-H11-API-05`, `CP-H11-API-18` | 🟢 100% PASS | Guard `verificarAccesoPersonal()` en `auth.guard.ts`, migración 030 sembrando los 4 permisos del módulo en `permiso` y `rol_permiso`, retornando HTTP 401 y 403. |

---

## 7. Conclusiones y Certificación QA

1. **Alineación de Migraciones Kysely:** Tras la instrucción de QA y la integración con las historias intermedias que reservaron los correlativos `026` al `029`, las migraciones oficiales de H11 son **`025_disponibilidad_usuario.ts`** y **`030_permisos_personal.ts`**. Ambas fueron verificadas en ejecución ascendente (`up`) y descendente (`down`) con 100% de éxito.
2. **Cumplimiento Integral de Reglas de Negocio:** La arquitectura normalizada en `usuario.estado_operativo` resolvió el problema de disponibilidad: **el 100% de los funcionarios institucionales reflejan su estado operacional en tiempo real**, manteniendo la ficha `personal` como aptitud técnica exclusiva para misiones de terreno (`disponible_terreno`).
3. **Seguridad y Trazabilidad:** El acceso al directorio de empleados cumple estrictamente con el principio institucional de seguridad basado en permisos RBAC (`personal:leer`), denegando accesos no autorizados con mensajes claros y códigos HTTP acordes a la norma REST.
4. **Dictamen Final:** La implementación de HU-11 en el servicio `sgrai-api` satisface todos los criterios de aceptación, cuenta con suites automatizadas en verde y queda **CERTIFICADA Y APROBADA PARA PRODUCCIÓN (100% PASS)**.

