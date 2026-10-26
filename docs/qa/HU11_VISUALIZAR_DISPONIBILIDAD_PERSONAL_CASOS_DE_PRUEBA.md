# Informe y Matriz de Casos de Prueba (QA): HU-11 — Visualizar Disponibilidad del Personal (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Sección de Operaciones y Logística ICS).  
> **Historia de Usuario:** HU-11 — *"Como administrador quiero ver un listado del personal para visualizar la disponibilidad de los empleados."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + Vitest + OpenAPI 3.0).  
> **Rama Git Evaluada:** `feature/H11-visualizar-disponibilidad-personal`.  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(db): mover estado operativo a usuario y preservar ficha de terreno`
> * `feat(seguridad): proteger listado de personal con RBAC`
> * `feat(personal): exponer disponibilidad no nula y capacidad de terreno`
> * `test(personal): cubrir disponibilidad y paginación`
> * `docs(personal): documentar H11 y actualizar modelo`
> * `chore(db): renumerar migraciones H11 a 025/026`
> * `fix(db): corregir reversión de la migración 025`
>
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **19** (12 Funcionales/Regla de Negocio + 4 Seguridad/RBAC + 3 Migración) |
| **Casos Aprobados (Passed)** | **19** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **521/521 tests aprobados (47 archivos)** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Migraciones Kysely** | **025 (`025_disponibilidad_usuario`) y 030 (`030_permisos_personal`) ejecutadas correctamente** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado con 401 y 403 documentados en `GET /api/personal` y `GET /api/personal/{id}`** |

---

## 2. Nota de Compatibilidad y Decisión de Modelo (H11)

El issue original de la HU-11 situaba el enum de estado operativo en la tabla `personal`.
La ejecución del plan normalizó el modelo a **`usuario.estado_operativo`** por las siguientes razones:

1. **Cobertura funcional:** la disponibilidad es un atributo de **todas** las cuentas del
   sistema (administrativos, call center, encargados y terreno), no sólo de quienes poseen
   ficha en `personal`.
2. **Una sola fuente de verdad:** mantener el estado en dos tablas obligaba a duplicar la
   lógica de alta, edición, baja y filtrado, con riesgo de divergencia.
3. **Coherencia del filtro:** el listado de personal filtra por estado; con el estado en
   `usuario` el filtro es directo e indexado (`idx_usuario_estado_operativo`).
4. **`personal` queda como ficha opcional de terreno** (relación 1:0..1), cuya única
   capacidad persistida es `disponible_terreno` (aptitud), que **no** es un estado.

Esta decisión queda explícita en `api/docs/database/README.md` y en
`api/docs/api/recursos-y-personal.md`.

### 2.1 Renumeración de migraciones (reserva de correlativos del equipo)

Las migraciones de H11 se renumeraron de `023`/`024` a **`025_disponibilidad_usuario`** y
**`030_permisos_personal`**. El correlativo **025** corresponde a la primera migración de H11 y
el **030** a la segunda; los correlativos `023`, `024` y `026`–`029` quedaron reservados para
otras historias del equipo. La renumeración se realizó con `git mv` (sin pérdida de
historial) y no altera el contenido de los scripts.

Consecuencias operativas para los ambientes donde ya se habían aplicado:

```sql
UPDATE kysely_migration SET name = '025_disponibilidad_usuario' WHERE name = '023_disponibilidad_usuario';
UPDATE kysely_migration SET name = '030_permisos_personal'     WHERE name IN ('024_permisos_personal', '026_permisos_personal');
```

No debe borrarse la fila para forzar la re-ejecución: la migración 025 no es re-ejecutable
de forma idempotente, ya que su paso 3 lee `personal.estado_operativo`, columna que la
propia migración elimina en el paso 5.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `CP-H11-API-01` | Listado de personal con estado operativo no nulo | Funcional | DAL / Servicio | Alta | Funcionarios registrados con y sin ficha de terreno | `GET /api/personal` con token de Administrador | Cada registro expone `estado_operativo` con valor presente (nunca `null`) | Todos los registros incluyen `estado_operativo` con valor de enum válido | APROBADO | 20/10/2026 20:30 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-02` | `disponible_terreno = null` para usuarios sin ficha de terreno | Funcional | Contrato | Alta | Funcionario administrativo sin registro en `personal` | `GET /api/personal` | `disponible_terreno` en `null` y `es_personal = false` | `disponible_terreno: null` y `es_personal: false` en la respuesta | APROBADO | 20/10/2026 20:32 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-03` | Filtro por estado operativo aplicado sobre `usuario.estado_operativo` | Regla de Negocio | DAL / Query | Alta | Funcionarios en distintos estados | `GET /api/personal?estadoOperativo=en_mision` | Filtra por `usuario.estado_operativo` y devuelve sólo coincidencias | Consulta generada con `WHERE usuario.estado_operativo = $1` | APROBADO | 20/10/2026 20:34 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-04` | Exclusión por defecto de funcionarios dados de baja | Regla de Negocio | DAL / Query | Alta | Funcionarios con `activo = false` | `GET /api/personal` sin `incluirInactivos` | No devuelve funcionarios con `activo = false` | Filtro `usuario.activo = true` aplicado por omisión | APROBADO | 20/10/2026 20:36 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-05` | Inclusión de funcionarios dados de baja con `incluirInactivos=true` | Funcional | API / Query | Media | Funcionarios activos e inactivos | `GET /api/personal?incluirInactivos=true` | Incluye tambien los funcionarios con `activo = false` | Listado incluye inactivos cuando se solicita explícitamente | APROBADO | 20/10/2026 20:38 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-06` | Filtro `soloPersonal` conserva la semántica de ficha de terreno | Regla de Negocio | DAL / Query | Media | Funcionarios con y sin ficha en `personal` | `GET /api/personal?soloPersonal=true` | Devuelve sólo usuarios con registro en `personal` | Filtra por `personal.id IS NOT NULL` | APROBADO | 20/10/2026 20:40 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-07` | Ordenamiento por apellidos, nombres y RUT | Funcional | DAL / Query | Media | Varios funcionarios registrados | `GET /api/personal?ordenar_por=rut&orden=desc` | Ordena por el campo solicitado sobre `usuario` | `ORDER BY usuario.rut DESC` generado correctamente | APROBADO | 20/10/2026 20:42 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-08` | Alta de funcionario administrativo: estado en `usuario` y sin ficha de terreno | Integración | Servicio / DB | Alta | Rol administrativo (Call Center) | `POST /api/personal` con `estado_operativo=disponible` | `usuario.estado_operativo = 'disponible'` y sin inserción en `personal` | Estado persistido en `usuario`; `personal` no creado | APROBADO | 20/10/2026 20:45 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-09` | Alta de funcionario de terreno: ficha creada con `disponible_terreno = true` | Integración | Servicio / DB | Alta | Rol `BRIGADISTA` | `POST /api/personal` con rol de terreno | Se crea `personal` con `disponible_terreno = true` y sin columna de estado | Ficha creada con capacidad `true`; estado sólo en `usuario` | APROBADO | 20/10/2026 20:47 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-10` | Cambio de rol de terreno a administrativo elimina la ficha y conserva el estado | Regla de Negocio | Servicio / DB | Alta | Funcionario de terreno con ficha en `personal` | `PATCH /api/personal/:id` con `rol_id` administrativo | Se elimina la ficha y el estado permanece en `usuario` | Ficha eliminada y `usuario.estado_operativo` conservado/reasignado | APROBADO | 20/10/2026 20:50 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-11` | Baja lógica: `activo = false` y `estado_operativo = 'inactivo'` | Regla de Negocio | Servicio / DB | Crítica | Funcionario activo (con y sin ficha de terreno) | `DELETE /api/personal/:id` | `usuario.activo = false`, `usuario.estado_operativo = 'inactivo'`, `personal.disponible_terreno = false` | Actualización atómica de `usuario` y `personal` según corresponda | APROBADO | 20/10/2026 20:52 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-12` | Estados de terreno rechazados para funcionarios administrativos | Regla de Negocio | Servicio | Alta | Funcionario administrativo activo | `PATCH /api/personal/:id` con `estado_operativo=en_mision` | HTTP 422 con mensaje explicativo | `EstadoOperativoInvalidoError` → HTTP 422 | APROBADO | 20/10/2026 20:55 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-13` | Deshabilitar la cuenta fuerza el estado `inactivo` | Regla de Negocio | Servicio | Alta | Funcionario de terreno activo | `PATCH /api/personal/:id` con `activo=false` | `estado_operativo='inactivo'` y `disponible_terreno=false` |Ambos valores forzados en la misma transacción | APROBADO | 20/10/2026 20:57 | - | feat(personal): exponer disponibilidad no nula y capacidad de terreno |
| `CP-H11-API-14` | Denegación HTTP 401 sin token de sesión | Seguridad (RBAC) | API / Guard | Crítica | Servidor API en ejecución | `GET /api/personal` sin cabecera `Authorization` | HTTP 401 Unauthorized | HTTP 401 Unauthorized con mensaje institucional | APROBADO | 20/10/2026 21:00 | - | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-15` | Denegación HTTP 403 sin permisos de personal | Seguridad (RBAC) | API / Guard | Crítica | Usuario autenticado sin `personal:leer`, `personal:gestionar` ni `personal:crear` | `GET /api/personal` con token válido | HTTP 403 Forbidden | HTTP 403 Forbidden con mensaje indicando los permisos requeridos | APROBADO | 20/10/2026 21:02 | - | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-16` | Acceso HTTP 200 con permiso `personal:leer` | Seguridad (RBAC) | API / Guard | Alta | Rol `Encargado` con permiso `personal:leer` | `GET /api/personal` con token de Encargado | HTTP 200 OK con listado paginado | HTTP 200 OK con `data` y `meta` estandarizados | APROBADO | 20/10/2026 21:04 | - | feat(seguridad): proteger listado de personal con RBAC |
| `CP-H11-API-17` | Migración 025: copia del estado histórico y default para usuarios sin ficha | Migración / BD | PostgreSQL / Kysely | Crítica | Base de datos con `personal.estado_operativo` poblada | `npm run db:migrate` (migración 025) | Copia el estado a `usuario`, fuerza `inactivo` en `activo=false` y elimina la columna duplicada | Enum renombrado, columna agregada, valores copiados, columna `personal.estado_operativo` eliminada e índice creado | APROBADO | 20/10/2026 21:10 | - | feat(db): mover estado operativo a usuario y preservar ficha de terreno |
| `CP-H11-API-18` | Migración 030: permisos del módulo de personal | Migración / BD | PostgreSQL / RBAC | Alta | Roles `ADMIN` y `ENCARGADO` existentes | `npm run db:migrate` (migración 030) | Crea `personal:leer`, `personal:crear`, `personal:editar`, `personal:gestionar`; ADMIN con los cuatro y ENCARGADO con `personal:leer` | Permisos creados y asignados correctamente | APROBADO | 20/10/2026 21:11 | - | feat(db): mover estado operativo a usuario y preservar ficha de terreno |
| `CP-H11-API-19` | Reversión de las migraciones 025 y 030 (`down` → `up`) | Migración / BD | PostgreSQL / Kysely | Crítica | Base de datos migrada con `025` y `030` aplicadas | Ejecución de `down` y posterior `up` de 025 y 030 sobre base de datos de prueba | `down` elimina `usuario.estado_operativo`, restaura `personal.estado_operativo` y el enum original; `up` restituye el modelo normalizado | Ciclo completo ejecutado sin error: `usuario.estado_operativo` presente, 4 permisos `personal:*` y enum `estado_operativo` | APROBADO | 20/10/2026 21:25 | - | fix(db): corregir reversión de la migración 025 |

---

### 3.1 Bloque TSV para Google Sheets (Copiar y Pegar en Celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
CP-H11-API-01	Listado de personal con estado operativo no nulo	Funcional	DAL / Servicio	Alta	Funcionarios registrados con y sin ficha de terreno	GET /api/personal con token de Administrador	Cada registro expone estado_operativo con valor presente (nunca null)	Todos los registros incluyen estado_operativo con valor de enum válido	APROBADO	20/10/2026 20:30	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-02	disponible_terreno = null para usuarios sin ficha de terreno	Funcional	Contrato	Alta	Funcionario administrativo sin registro en personal	GET /api/personal	disponible_terreno en null y es_personal = false	disponible_terreno: null y es_personal: false en la respuesta	APROBADO	20/10/2026 20:32	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-03	Filtro por estado operativo aplicado sobre usuario.estado_operativo	Regla de Negocio	DAL / Query	Alta	Funcionarios en distintos estados	GET /api/personal?estadoOperativo=en_mision	Filtra por usuario.estado_operativo y devuelve sólo coincidencias	Consulta generada con WHERE usuario.estado_operativo = $1	APROBADO	20/10/2026 20:34	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-04	Exclusión por defecto de funcionarios dados de baja	Regla de Negocio	DAL / Query	Alta	Funcionarios con activo = false	GET /api/personal sin incluirInactivos	No devuelve funcionarios con activo = false	Filtro usuario.activo = true aplicado por omisión	APROBADO	20/10/2026 20:36	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-05	Inclusión de funcionarios dados de baja con incluirInactivos=true	Funcional	API / Query	Media	Funcionarios activos e inactivos	GET /api/personal?incluirInactivos=true	Incluye tambien los funcionarios con activo = false	Listado incluye inactivos cuando se solicita explícitamente	APROBADO	20/10/2026 20:38	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-06	Filtro soloPersonal conserva la semántica de ficha de terreno	Regla de Negocio	DAL / Query	Media	Funcionarios con y sin ficha en personal	GET /api/personal?soloPersonal=true	Devuelve sólo usuarios con registro en personal	Filtra por personal.id IS NOT NULL	APROBADO	20/10/2026 20:40	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-07	Ordenamiento por apellidos, nombres y RUT	Funcional	DAL / Query	Media	Varios funcionarios registrados	GET /api/personal?ordenar_por=rut&orden=desc	Ordena por el campo solicitado sobre usuario	ORDER BY usuario.rut DESC generado correctamente	APROBADO	20/10/2026 20:42	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-08	Alta de funcionario administrativo: estado en usuario y sin ficha de terreno	Integración	Servicio / DB	Alta	Rol administrativo (Call Center)	POST /api/personal con estado_operativo=disponible	usuario.estado_operativo = disponible y sin inserción en personal	Estado persistido en usuario; personal no creado	APROBADO	20/10/2026 20:45	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-09	Alta de funcionario de terreno: ficha creada con disponible_terreno = true	Integración	Servicio / DB	Alta	Rol BRIGADISTA	POST /api/personal con rol de terreno	Se crea personal con disponible_terreno = true y sin columna de estado	Ficha creada con capacidad true; estado sólo en usuario	APROBADO	20/10/2026 20:47	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-10	Cambio de rol de terreno a administrativo elimina la ficha y conserva el estado	Regla de Negocio	Servicio / DB	Alta	Funcionario de terreno con ficha en personal	PATCH /api/personal/:id con rol_id administrativo	Se elimina la ficha y el estado permanece en usuario	Ficha eliminada y usuario.estado_operativo conservado/reasignado	APROBADO	20/10/2026 20:50	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-11	Baja lógica: activo = false y estado_operativo = inactivo	Regla de Negocio	Servicio / DB	Crítica	Funcionario activo (con y sin ficha de terreno)	DELETE /api/personal/:id	usuario.activo = false, usuario.estado_operativo = inactivo, personal.disponible_terreno = false	Actualización atómica de usuario y personal según corresponda	APROBADO	20/10/2026 20:52	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-12	Estados de terreno rechazados para funcionarios administrativos	Regla de Negocio	Servicio	Alta	Funcionario administrativo activo	PATCH /api/personal/:id con estado_operativo=en_mision	HTTP 422 con mensaje explicativo	EstadoOperativoInvalidoError → HTTP 422	APROBADO	20/10/2026 20:55	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-13	Deshabilitar la cuenta fuerza el estado inactivo	Regla de Negocio	Servicio	Alta	Funcionario de terreno activo	PATCH /api/personal/:id con activo=false	estado_operativo=inactivo y disponible_terreno=false	Ambos valores forzados en la misma transacción	APROBADO	20/10/2026 20:57	-	feat(personal): exponer disponibilidad no nula y capacidad de terreno
CP-H11-API-14	Denegación HTTP 401 sin token de sesión	Seguridad (RBAC)	API / Guard	Crítica	Servidor API en ejecución	GET /api/personal sin cabecera Authorization	HTTP 401 Unauthorized	HTTP 401 Unauthorized con mensaje institucional	APROBADO	20/10/2026 21:00	-	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-15	Denegación HTTP 403 sin permisos de personal	Seguridad (RBAC)	API / Guard	Crítica	Usuario autenticado sin personal:leer, personal:gestionar ni personal:crear	GET /api/personal con token válido	HTTP 403 Forbidden	HTTP 403 Forbidden con mensaje indicando los permisos requeridos	APROBADO	20/10/2026 21:02	-	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-16	Acceso HTTP 200 con permiso personal:leer	Seguridad (RBAC)	API / Guard	Alta	Rol Encargado con permiso personal:leer	GET /api/personal con token de Encargado	HTTP 200 OK con listado paginado	HTTP 200 OK con data y meta estandarizados	APROBADO	20/10/2026 21:04	-	feat(seguridad): proteger listado de personal con RBAC
CP-H11-API-17	Migración 025: copia del estado histórico y default para usuarios sin ficha	Migración / BD	PostgreSQL / Kysely	Crítica	Base de datos con personal.estado_operativo poblada	npm run db:migrate (migración 025)	Copia el estado a usuario, fuerza inactivo en activo=false y elimina la columna duplicada	Enum renombrado, columna agregada, valores copiados, columna personal.estado_operativo eliminada e índice creado	APROBADO	20/10/2026 21:10	-	feat(db): mover estado operativo a usuario y preservar ficha de terreno
CP-H11-API-18	Migración 030: permisos del módulo de personal	Migración / BD	PostgreSQL / RBAC	Alta	Roles ADMIN y ENCARGADO existentes	npm run db:migrate (migración 030)	Crea personal:leer, personal:crear, personal:editar, personal:gestionar; ADMIN con los cuatro y ENCARGADO con personal:leer	Permisos creados y asignados correctamente	APROBADO	20/10/2026 21:11	-	feat(db): mover estado operativo a usuario y preservar ficha de terreno
CP-H11-API-19	Reversión de las migraciones 025 y 030 (down → up)	Migración / BD	PostgreSQL / Kysely	Crítica	Base de datos migrada con 025 y 030 aplicadas	Ejecución de down y posterior up de 025 y 030 sobre base de datos de prueba	down elimina usuario.estado_operativo, restaura personal.estado_operativo y el enum original; up restituye el modelo normalizado	Ciclo completo ejecutado sin error: usuario.estado_operativo presente, 4 permisos personal:* y enum estado_operativo	APROBADO	20/10/2026 21:25	-	fix(db): corregir reversión de la migración 025
```

---

## 4. Pruebas Automatizadas Agregadas (Vitest)

| Archivo de prueba | Cobertura |
|---|---|
| `src/modules/recursos-y-personal/__tests__/personal-listado.repository.test.ts` | Tablas canónicas, proyección de `usuario.estado_operativo`, filtro por estado, exclusión de inactivos, `soloPersonal` y ordenamiento. |
| `src/modules/recursos-y-personal/__tests__/personal-listado.test.ts` | Estado no nulo y `disponible_terreno = null` para usuarios sin ficha de terreno. |
| `src/modules/recursos-y-personal/__tests__/registrar-empleado.test.ts` | Estado persistido en `usuario` (por defecto y con cuenta inactiva) y ficha de terreno sin columna de estado. |
| `src/modules/recursos-y-personal/__tests__/actualizar-empleado.service.test.ts` | Cambio de rol terreno→administrativo, reseteo de estado de terreno, forzado de `inactivo` y rechazo de estados de terreno en administrativos. |
| `src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts` | Baja con `usuario.estado_operativo = inactivo` y `personal.disponible_terreno = false`. |
| `src/app/api/personal/__tests__/route.test.ts` | RBAC del listado: 401, 403 y 200 con permiso. |
| `src/app/api/personal/[id]/__tests__/route.test.ts` | RBAC del detalle: 400 por UUID inválido, 401 y 403. |
| `src/lib/db/migrations/__tests__/025_disponibilidad_usuario.test.ts` | Verificación del SQL emitido por la migración 025 (renombre de enum, copia de estado, eliminación de columna duplicada y reversión). |

---

## 5. Conclusiones de QA

- La normalización del estado operativo a `usuario.estado_operativo` cumple el objetivo de
  la HU-11: **todos** los funcionarios del directorio muestran su disponibilidad, incluidos
  los administrativos que no poseen ficha de terreno.
- El control de acceso granular (`personal:leer`, `personal:crear`, `personal:editar`,
  `personal:gestionar`) protege el directorio y satisface el principio institucional de
  depender **estrictamente de permisos**, nunca del nombre del rol.
- No se detectaron defectos funcionales, de seguridad ni de integridad referencial.
