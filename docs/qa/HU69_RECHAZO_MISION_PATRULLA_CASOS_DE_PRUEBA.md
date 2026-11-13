# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-69 — Rechazo de Asignación de Misión por Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones Tácticas en Terreno (`sgrai-api` — `POST /api/misiones/{id}/rechazar`).  
> **Historia de Usuario:** HU-69 — *"Como Patrulla verificadora Quiero tener la opción de rechazar una asignación de misión de verificación en terreno ingresando una justificación obligatoria. Para informar oportunamente al Centro de Mando ante imposibilidad de concurrir (desperfecto mecánico, corte de ruta, emergencia prioritaria) y permitir la reasignación inmediata del incidente."*  
> **Desarrollador Asignado:** `zetastormy`  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H69-rechazo-mision-patrulla`  
> **Fecha de Auditoría Inicial:** 12/11/2026 13:13  
> **Fecha de Re-Test:** (Pendiente)  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested` — 5 Defectos Reales Abiertos)**

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras efectuar la inspección forense de código fuente sobre la rama `feature/H69-rechazo-mision-patrulla` frente a `develop`, el análisis de reglas de negocio del Sistema de Comando de Incidentes (ICS), la verificación de transacciones en PostgreSQL/Kysely, el contraste de contratos OpenAPI 3.0 y la ejecución de pruebas automatizadas (Vitest) y peticiones HTTP reales (`cURL`) contra el entorno local (PostgreSQL 16 + PostGIS + Redis 7), se dictamina el estado **RECHAZADO (`Changes Requested`)** al haberse identificado **5 defectos reales** (`BUG-H69-API-01` a `BUG-H69-API-05`), dos de ellos de severidad **CRÍTICA**, dos de severidad **ALTA** y uno de severidad **MEDIA**.

Aunque la validación básica de longitud mínima de `justificacion_rechazo` (≥ 5 caracteres tras `.trim()`), el flujo feliz sobre una misión `VERIFICACION` en estado `DESPACHADA` y la suite unitaria simulada con mocks pasan satisfactoriamente, las pruebas de integración reales contra la base de datos revelaron fallos estructurales en aislamiento de autorización por tipo de misión, regresión de estado sobre el flujo certificado de HU-20/HU-36, ausencia de guardas de baja lógica/vigencia en usuarios y patrullas, desbordamiento numérico (`500`) en coordenadas geográficas y desincronización de difusión Redis Pub/Sub.

| Métrica de Calidad | Auditoría Inicial (12/11/2026) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | 23 | 5 Defectos Abiertos (`BUG-H69-API-01` a `05`) + 18 Casos Aprobados (`CP-H69-API-01` a `18`) |
| **Casos Aprobados (Passed)** | 18 | Validación Zod de motivo, códigos HTTP base, RBAC estándar, transacción base y OpenAPI |
| **Defectos Abiertos (Failed / Open)** | 5 | 2 Críticos (`BUG-H69-API-01`, `BUG-H69-API-02`), 2 Altos (`BUG-H69-API-03`, `BUG-H69-API-04`), 1 Medio (`BUG-H69-API-05`) |
| **Casos Bloqueados (Blocked)** | 0 | Entorno PostgreSQL, Redis y Next.js operativo durante toda la auditoría |
| **Tasa de Aprobación (% Pass)** | **78.3%** | Bloqueado para merge a `develop` hasta subsanar los 5 defectos abiertos |
| **Suite Completa Vitest** | 62 archivos / 756 tests pass | Las pruebas de HU-69 (`mision-rechazar.*.test.ts`) operan exclusivamente con mocks y no cubren PostgreSQL real |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | 0 errores | Tras regenerar `.next/types` (`npx next typegen`), compilación y linter sin errores en los archivos auditados |
| **Secuencia de Migraciones Kysely** | 🟢 Sin colisión (`051_`) | `051_permiso_misiones_terreno_verificar.ts` es idempotente respecto a `035_permiso_misiones_terreno_verificar` |

---

## 2. Registro Técnico de Defectos

### `BUG-H69-API-01`: Bypass de Autorización por Pertenencia, Corrupción de Estado ICS y Violación de Contrato UUID cuando `mision.patrulla_id` es Nulo o `tipo_mision` es Distinto de `VERIFICACION`
* **Severidad:** **CRÍTICA** (Seguridad RBAC / Integridad Operativa ICS / Contrato OpenAPI).
* **Estado:** 🔴 **ABIERTO**
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (líneas 611-657, 722-740 y 764-774).
* **Descripción Técnica:**
  En `rechazarMisionPatrullaRepo`, la consulta inicial no selecciona `mision.tipo_mision` ni `mision.cuadrilla_id`, y la validación de pertenencia de la línea 640 está condicionada a `if (!esAdmin && misionExistente.patrulla_id)`. Cuando una misión en estado `'DESPACHADA'` pertenece a una cuadrilla (`tipo_mision = 'ATENCION_CUADRILLA'`, `patrulla_id = NULL`, `cuadrilla_id != NULL`) o corresponde a una misión operativa sin patrulla ni incidente (`PREVENCION` / `RECUPERACION`):
  1. Se omite por completo el control de pertenencia, permitiendo que cualquier usuario con permiso `misiones:terreno:verificar` rechace la misión de una cuadrilla u otra unidad.
  2. La misión pasa a `'RECHAZADA'` sin liberar a la `cuadrilla` (que permanece atascada en `'EN_MISION'`), y el `incidente` asociado se revierte incondicionalmente a `'REPORTADO'` incluso si estaba en `'EN_ATENCION'` al faltar una guarda `.where("estado", "in", ["REPORTADO", "VERIFICANDO"])`.
  3. La respuesta retorna `"patrulla": { "id": "", "nombre": "Patrulla Verificadora", "estado": "DISPONIBLE" }` (e `"incidente": { "id": "" }` si no hay incidente), violando `RechazarMisionResponseSchema` (`z.string().uuid()`).
* **Pasos para Reproducir:**
  1. Contar con una misión en estado `'DESPACHADA'` de tipo `'ATENCION_CUADRILLA'` con `patrulla_id = NULL` y `cuadrilla_id` en estado `'EN_MISION'` sobre un incidente en `'EN_ATENCION'`.
  2. Ejecutar `POST /api/misiones/{id}/rechazar` autenticado como un usuario `PATRULLA_VERIFICADORA`.
  3. Observar respuesta `200 OK` con `data.patrulla.id = ""`, la cuadrilla intacta en `'EN_MISION'` y el incidente degradado a `'REPORTADO'`.
* **Comportamiento Esperado vs. Actual:**
  * **Esperado:** Rechazar con `HTTP 403 Forbidden` o `HTTP 409 Conflict` cualquier intento de rechazar en este endpoint misiones que no tengan `patrulla_id` asignado o cuyo `tipo_mision` no corresponda a verificación por patrulla; restringir la reversión de `incidente.estado` únicamente cuando corresponda (`REPORTADO` / `VERIFICANDO`).
  * **Actual:** Retorna `HTTP 200 OK` con `patrulla.id: ""`, altera misiones de cuadrilla y deja huérfano el estado de la cuadrilla.

---

### `BUG-H69-API-02`: Regresión de Contrato sobre HU-20 (`crearMisionVerificacionRepo`) Manteniendo `incidente.estado = 'REPORTADO'` e Incompatibilidad Bloqueante con HU-36
* **Severidad:** **CRÍTICA** (Violación del Ciclo de Vida ICS / Regresión sobre Funcionalidad Certificada en `develop` / Bloqueo de Integración).
* **Estado:** 🔴 **ABIERTO**
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (líneas 497-512)
  * `src/modules/misiones/mision.service.ts` (línea 269)
  * `src/lib/openapi/index.ts` (línea 2354)
  * `docs/api/misiones.md` (líneas 260, 309 vs. línea 439)
* **Descripción Técnica:**
  El commit `fix(misiones): mantener incidente en REPORTADO al despachar patrulla y agregar tiene_mision_despachada` alteró el comportamiento ya certificado y mergeado en `develop` de `POST /api/misiones` (HU-20), eliminando `estado: "VERIFICANDO"` de `crearMisionVerificacionRepo`. Esta modificación:
  1. Provoca una regresión directa sobre el Criterio de Aceptación CA-3 de HU-20 (`incidente.estado = 'VERIFICANDO'`) y contradice el ciclo ICS documentado en `GEMINI.md` §6 (`REPORTADO → VERIFICANDO → EN_ATENCION → NO_ABORDABLE / RESUELTO`).
  2. Rompe la integración con HU-36 (`aceptarMisionPatrullaRepo`), la cual exige explícitamente `incidente.estado === 'VERIFICANDO'` como precondición para que la patrulla pueda aceptar la misión (lanzando `409 Conflict` si el incidente sigue en `'REPORTADO'`).
  3. Genera inconsistencia interna en `docs/api/misiones.md`, donde la línea 260 indica mantener `'REPORTADO'` pero la línea 439 sigue documentando la transición `"a VERIFICANDO al despachar"`.
  4. Introduce `tieneMisionDespachada` en `incidente-kanban.*` sin cobertura de pruebas unitarias para el caso positivo (`true`).
* **Comportamiento Esperado vs. Actual:**
  * **Esperado:** `HU-69` debe garantizar que, al rechazar la misión, el incidente quede/vuelva a `'REPORTADO'` (`rechazarMisionPatrullaRepo` ya ejecuta `estado = 'REPORTADO'`), sin romper la máquina de estados `REPORTADO → VERIFICANDO` de `HU-20` ni bloquear `HU-36` (o, en su defecto, cualquier cambio de máquina de estados transversal debe estar coordinado y aplicado en `HU-20`, `HU-36`, `sgrai-web` y `sgrai-pwa` de forma conjunta).
  * **Actual:** `POST /api/misiones` deja el incidente en `'REPORTADO'`, rompiendo HU-20 y bloqueando el flujo de aceptación de HU-36.

---

### `BUG-H69-API-03`: Omisión de Validación de Usuario Activo (`usuario.activo`) en `verificarPermiso` y de Baja Lógica de Patrulla (`eliminado_en IS NULL`, `activo = true`) al Liberar a `DISPONIBLE`
* **Severidad:** **ALTA** (Seguridad RBAC / Integridad de Baja Lógica HU-85).
* **Estado:** 🔴 **ABIERTO**
* **Archivos Afectados:**
  * `src/modules/seguridad/auth.service.ts` (líneas 23-40)
  * `src/modules/misiones/mision.repository.ts` (líneas 611-633 y 701-716)
* **Descripción Técnica:**
  1. La función `verificarPermiso` (`src/modules/seguridad/auth.service.ts`) consulta `usuario` y `rol`, pero no selecciona ni verifica `usuario.activo = true` (a diferencia de `SeguridadService.validarAccesoRoles`). En consecuencia, un usuario de patrulla desactivado (`activo = false`) sigue autorizado para rechazar misiones.
  2. En `rechazarMisionPatrullaRepo` (`src/modules/misiones/mision.repository.ts:702-710`), la actualización de `patrulla_verificadora` a `'DISPONIBLE'` se ejecuta únicamente filtrando `.where("id", "=", misionExistente.patrulla_id)`, sin comprobar `eliminado_en IS NULL` ni `activo = true`. Si una patrulla dada de baja lógica (HU-85: `activo = false`, `eliminado_en != null`, `estado = 'NO_DISPONIBLE'`) tenía una misión previa pendiente, el rechazo la devuelve erróneamente a estado operativo `'DISPONIBLE'`.
* **Pasos para Reproducir:**
  1. Disponer de un usuario con rol `PATRULLA_VERIFICADORA` marcado con `activo = false` y una patrulla con `activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, `estado = 'NO_DISPONIBLE'`, vinculada a una misión en `'DESPACHADA'`.
  2. Invocar `POST /api/misiones/{id}/rechazar` con `x-user-id` del usuario inactivo.
  3. Verificar que el endpoint responde `HTTP 200 OK` y modifica `patrulla_verificadora.estado = 'DISPONIBLE'` manteniendo `activo = false` y `eliminado_en IS NOT NULL`.
* **Comportamiento Esperado vs. Actual:**
  * **Esperado:** `verificarPermiso` debe denegar con `401 Unauthorized` si `usuario.activo === false`; `rechazarMisionPatrullaRepo` debe impedir rechazar/reactivar una patrulla dada de baja lógica (o no transicionarla a `'DISPONIBLE'` si `eliminado_en IS NOT NULL` / `activo = false`).
  * **Actual:** El usuario inactivo logra rechazar la misión (`200 OK`) y la patrulla dada de baja pasa a estado `'DISPONIBLE'`.

---

### `BUG-H69-API-04`: Falta de Validación de Rango Geográfico WGS84 en `latitud` y `longitud` Generando Error `500 Internal Server Error` por Desbordamiento Numérico en PostgreSQL
* **Severidad:** **ALTA** (Estabilidad de API / Validación de Contratos Zod / Manejo de Errores).
* **Estado:** 🔴 **ABIERTO**
* **Archivos Afectados:**
  * `src/modules/misiones/mision.schema.ts` (líneas 301-302 y 309-310)
  * `src/modules/misiones/mision.repository.ts` (líneas 750-751)
* **Descripción Técnica:**
  Tanto `RechazarMisionInputSchema` como `RechazarMisionBodySchema` definen `latitud: z.number().optional()` y `longitud: z.number().optional()` sin cotas geográficas (`min(-90).max(90)` para latitud, `min(-180).max(180)` para longitud y `.finite()`). Dado que las columnas `latitud` y `longitud` en `mision_hito` son de tipo `DECIMAL(10, 7)` (máximo 3 dígitos enteros antes del punto decimal), cualquier coordenada >= `1000` o <= `-1000` supera la validación Zod, alcanza el `INSERT INTO mision_hito` y provoca una excepción `numeric field overflow` (SQLSTATE `22003`) en PostgreSQL, traduciéndose en un `HTTP 500 Internal Server Error` no controlado con rollback completo.
* **Pasos para Reproducir:**
  1. Enviar `POST /api/misiones/{id}/rechazar` autenticado sobre una misión válida en `'DESPACHADA'` con body: `{"justificacion_rechazo":"Prueba de coordenada fuera de rango","latitud":1000,"longitud":-200}`.
  2. Observar respuesta `HTTP 500 Internal Server Error`.
* **Comportamiento Esperado vs. Actual:**
  * **Esperado:** Rechazar en capa de validación Zod con `HTTP 400 Bad Request` indicando que `latitud` debe estar en `[-90, 90]` y `longitud` en `[-180, 180]`.
  * **Actual:** Responde `HTTP 500 Internal Server Error` con el mensaje `"Error interno del servidor al procesar el rechazo de la misión."`.

---

### `BUG-H69-API-05`: Desincronización de Salas en Redis Pub/Sub (`notificarMisionRechazada`), Pérdida de Metadatos en `notificarPatrullaActualizada` y Divergencia Menor de Esquemas OpenAPI/Zod
* **Severidad:** **MEDIA** (Tiempo Real / Consistencia de Contratos OpenAPI).
* **Estado:** 🔴 **ABIERTO**
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (líneas 768-809)
  * `src/modules/misiones/mision.service.ts` (líneas 384-395)
  * `src/modules/misiones/mision.schema.ts` (líneas 293-364)
* **Descripción Técnica:**
  1. En `notificarMisionRechazada` (`src/lib/socket/index.ts:785-808`), cuando el Route Handler opera con `ioInstance === null` mediante el publicador Redis (`REDIS_SOCKET_CHANNEL`), solo publica hacia `"encargado"` y `"sala:encargados"`, omitiendo `"supervisor"` y `patrulla:${payload.patrullaId}` que sí se emiten en la rama en memoria (`L.775-779`).
  2. En `rechazarMisionService` (`src/modules/misiones/mision.service.ts:384-395`), `notificarPatrullaActualizada` se invoca con `delegacionId: null` y `usuarioLiderId: null` fijos en lugar de propagar los valores reales desde `patrulla_verificadora`, arriesgando sobrescribir con `null` dichos atributos en los clientes conectados.
  3. En `mision.schema.ts`, `RechazarMisionBodySchema` (registrado en OpenAPI) no refleja el alias `justificacionRechazo` ni las cotas geográficas, mientras que `rechazarMisionService` retorna `data.incidente.prioridad` sin declararlo en `RechazarMisionResponseSchema`.
* **Comportamiento Esperado vs. Actual:**
  * **Esperado:** Paridad total de salas entre memoria y Redis (`encargado`, `sala:encargados`, `supervisor`, `patrulla:{id}`), propagación de `delegacionId` y `usuarioLiderId` reales en `patrulla:actualizada`, y alineación exacta entre los esquemas Zod de runtime y OpenAPI.
  * **Actual:** Redis omite salas emitidas en memoria, se envían metadatos nulos en `patrulla:actualizada` y existen divergencias menores entre `RechazarMisionBodySchema`, `RechazarMisionInputSchema` y `RechazarMisionResponseSchema`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H69-API-01` | Bypass de pertenencia, corrupción de cuadrilla/incidente y UUID vacío al rechazar misión sin patrulla_id o ATENCION_CUADRILLA | Seguridad / ICS | Repositorio / API | Crítica | Misión ATENCION_CUADRILLA en estado DESPACHADA con patrulla_id NULL y cuadrilla EN_MISION | POST /api/misiones/{id}/rechazar con x-user-id de patrulla ajena y {"justificacion_rechazo":"Rechazo indebido de mision de cuadrilla"} | HTTP 403 o 409 bloqueando rechazo de misión no asignada a patrulla verificadora | HTTP 200 OK retornando patrulla.id="", cuadrilla queda EN_MISION e incidente EN_ATENCION pasa a REPORTADO | ABIERTO | 12/11/2026 13:13 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H69-API-02` | Regresión sobre HU-20 en crearMisionVerificacionRepo manteniendo incidente en REPORTADO e incompatibilidad con HU-36 | Regresión / ICS | Repositorio / Integración | Crítica | Incidente en REPORTADO y patrulla DISPONIBLE despachados vía POST /api/misiones | POST /api/misiones seguido de flujo HU-36 (aceptar) y HU-69 (rechazar) | Transición coherente con HU-20 (VERIFICANDO) y HU-36 sin romper contratos certificados | crearMisionVerificacionRepo mantiene incidente en REPORTADO rompiendo HU-20 CA-3 y bloqueando precondición de HU-36 | ABIERTO | 12/11/2026 13:10 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H69-API-03` | Omisión de usuario.activo en verificarPermiso y de eliminado_en/activo en patrulla_verificadora al liberar a DISPONIBLE | Seguridad / Baja Lógica | Auth / Repositorio | Alta | Usuario patrulla con activo=false y patrulla dada de baja (activo=false, eliminado_en!=null, estado=NO_DISPONIBLE) | POST /api/misiones/{id}/rechazar con x-user-id del usuario inactivo | HTTP 401 Unauthorized por usuario inactivo y bloqueo de reactivación de patrulla dada de baja | HTTP 200 OK permitiendo rechazar con usuario inactivo y pasando la patrulla dada de baja a estado DISPONIBLE | ABIERTO | 12/11/2026 13:13 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H69-API-04` | Desbordamiento numérico DECIMAL(10,7) en PostgreSQL (HTTP 500) por falta de rango WGS84 en latitud y longitud | Validación / Robustez | Schema / API / BD | Alta | Misión VERIFICACION en estado DESPACHADA | POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Prueba de coordenada fuera de rango","latitud":1000,"longitud":-200} | HTTP 400 Bad Request validando latitud [-90,90] y longitud [-180,180] | HTTP 500 Internal Server Error por excepción numeric field overflow en mision_hito | ABIERTO | 12/11/2026 13:13 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H69-API-05` | Desincronización Redis Pub/Sub en notificarMisionRechazada, metadatos nulos en patrulla:actualizada y divergencia OpenAPI/Zod | Tiempo Real / Contrato | Socket / Service / OpenAPI | Media | Worker Next.js sin ioInstance emitiendo vía Redis y esquemas en mision.schema.ts | Inspección de notificarMisionRechazada, rechazarMisionService y RechazarMisionResponseSchema | Paridad de salas en Redis, delegacionId/usuarioLiderId reales y esquemas alineados | Redis omite salas supervisor y patrulla:{id}; servicio envía delegacionId:null y usuarioLiderId:null; incidente.prioridad fuera de schema | ABIERTO | 12/11/2026 13:11 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H69-API-01` | Rechazo exitoso (200 OK) de misión de verificación DESPACHADA por líder de patrulla con justificación válida | Funcional | API / E2E Local | Crítica | Misión VERIFICACION en estado DESPACHADA asignada a patrulla con líder activo | POST /api/misiones/{id}/rechazar con x-user-id de líder y {"justificacion_rechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","latitud":-39.81422,"longitud":-73.24589} | HTTP 200 OK retornando misión RECHAZADA, patrulla DISPONIBLE, incidente REPORTADO e hito RECHAZADA | HTTP 200 OK con DTO de respuesta completo y estados esperados | APROBADO | 12/11/2026 13:13 | - | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-02` | Persistencia transaccional atómica en BD: mision.estado=RECHAZADA, fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y mision_hito | Integridad / ACID | Repositorio / BD | Crítica | Misión VERIFICACION DESPACHADA, patrulla EN_VERIFICACION e incidente asociado | Ejecución de POST /api/misiones/{id}/rechazar y consulta directa en PostgreSQL | Las 4 tablas actualizadas dentro de una única transacción Kysely db.transaction() | Verificado en PostgreSQL: mision=RECHAZADA con fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y fila en mision_hito | APROBADO | 12/11/2026 13:13 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-03` | Validación de alias camelCase justificacionRechazo y recorte .trim() con mínimo de 5 caracteres en RechazarMisionInputSchema | Validación (Zod) | Unitaria / Schema | Alta | Esquema RechazarMisionInputSchema | RechazarMisionInputSchema.safeParse({justificacionRechazo:"Ruta cortada por caída de árbol en camino Niebla"}) | Validación exitosa normalizando al campo interno justificacionRechazo | Esquema acepta snake_case y camelCase >= 5 caracteres aplicando .trim() | APROBADO | 12/11/2026 13:09 | - | test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69) |
| `CP-H69-API-04` | Persistencia de coordenadas geográficas válidas (latitud, longitud) en tabla mision_hito durante el rechazo | Funcional / Geo | Repositorio / BD | Media | Misión VERIFICACION en estado DESPACHADA | Payload con latitud: -39.81422 y longitud: -73.24589 | Registro en mision_hito almacena latitud -39.8142200 y longitud -73.2458900 | Verificado en PostgreSQL SELECT de mision_hito tras HTTP 200 OK | APROBADO | 12/11/2026 13:13 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-05` | Autorización exitosa para integrante operativo en patrulla_personal o usuario con rol Administrador | Seguridad / RBAC | Repositorio / Auth | Alta | Usuario en patrulla_personal con permiso misiones:terreno:verificar o usuario Administrador | POST /api/misiones/{id}/rechazar como integrante de patrulla_personal o rol ADMIN | Acceso permitido para ejecutar el rechazo de la misión asignada | rechazarMisionPatrullaRepo valida usuario_lider_id, tabla patrulla_personal y bypass controlado para esAdmin | APROBADO | 12/11/2026 13:08 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-06` | Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo tiene 4 caracteres (límite inferior Regla §3.3) | Validación / Límite | API / Schema | Crítica | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Pana"} | HTTP 400 Bad Request indicando mínimo 5 caracteres | HTTP 400 Bad Request con error en campo justificacion_rechazo y 0 mutaciones en BD | APROBADO | 12/11/2026 13:12 | - | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-07` | Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo está ausente, en blanco o con espacios ("    ") | Validación / Límite | API / Schema | Crítica | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"    "} y {} | HTTP 400 Bad Request rechazando cadenas vacías o espacios insuficientes tras .trim() | HTTP 400 Bad Request tanto en cURL real como en pruebas unitarias de esquema y ruta | APROBADO | 12/11/2026 13:12 | - | test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69) |
| `CP-H69-API-08` | Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta id no cumple el formato UUID | Validación / Contrato | API / Route | Media | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/no-es-uuid/rechazar con justificación válida | HTTP 400 Bad Request indicando que el identificador no es un UUID válido | HTTP 400 Bad Request: "El identificador de la misión proporcionado no es un UUID válido." | APROBADO | 12/11/2026 13:12 | - | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-09` | Rechazo con HTTP 400 Bad Request ante cuerpo JSON sintácticamente malformado | Robustez / Contrato | API / Route | Media | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con Content-Type: application/json y body "json-invalido-{{{" | HTTP 400 Bad Request indicando que el cuerpo debe ser un JSON válido | HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido." | APROBADO | 12/11/2026 13:12 | - | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-10` | Denegación con HTTP 401 Unauthorized ante ausencia de credenciales o token JWT Bearer inválido | Seguridad / Auth | API / AuthGuard | Crítica | Petición sin cabeceras de autenticación o con Bearer token inválido | POST /api/misiones/{id}/rechazar sin headers y con Authorization: Bearer token-invalido-123 | HTTP 401 Unauthorized impidiendo acceso anónimo o con token adulterado | HTTP 401 Unauthorized en ambos escenarios verificados vía cURL real | APROBADO | 12/11/2026 13:13 | - | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-11` | Denegación con HTTP 403 Forbidden cuando el usuario carece del permiso RBAC misiones:terreno:verificar | Seguridad / RBAC | API / AuthGuard | Crítica | Usuario autenticado con rol CALL_CENTER sin permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con x-user-id: 00000000-0000-4000-8000-000000000002 | HTTP 403 Forbidden indicando falta del permiso misiones:terreno:verificar | HTTP 403 Forbidden: "No cuenta con el permiso requerido: misiones:terreno:verificar" | APROBADO | 12/11/2026 13:12 | - | feat(db): agregar permiso RBAC misiones:terreno:verificar (HU-69) |
| `CP-H69-API-12` | Denegación con HTTP 403 Forbidden cuando una patrulla verificadora distinta intenta rechazar la misión de otra patrulla | Seguridad / RBAC | Repositorio / API | Crítica | Misión asignada a PV-SUR-02 y petición emitida por líder de PV-NORTE-01 | POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar con x-user-id d1000000-0000-4000-8000-000000000001 | HTTP 403 Forbidden bloqueando el rechazo cruzado entre patrullas | HTTP 403 Forbidden: "No está autorizado para rechazar una misión asignada a otra patrulla verificadora." | APROBADO | 12/11/2026 13:12 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-13` | Rechazo con HTTP 404 Not Found cuando el UUID de misión no existe en la base de datos | Manejo de Errores | Repositorio / API | Alta | UUID válido inexistente en tabla mision | POST /api/misiones/60000000-0000-4000-8000-999999999999/rechazar | HTTP 404 Not Found indicando que la misión no fue encontrada | HTTP 404 Not Found: "No se encontró ninguna misión con el identificador proporcionado." | APROBADO | 12/11/2026 13:12 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-14` | Rechazo con HTTP 409 Conflict ante doble rechazo o misión fuera del estado DESPACHADA (ej. EN_CURSO) | Concurrencia / ICS | Repositorio / API | Crítica | Misión en estado RECHAZADA o EN_CURSO | POST /api/misiones/{id}/rechazar sobre misión ya rechazada y sobre misión EN_CURSO | HTTP 409 Conflict abortando la transición con control condicional WHERE estado = DESPACHADA | HTTP 409 Conflict en ambos casos ("La misión ya ha sido rechazada previamente." y "no se encuentra en estado 'DESPACHADA'") | APROBADO | 12/11/2026 13:13 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-15` | Emisión de eventos WebSocket mision:rechazada hacia sala encargado, incidente:actualizado con prioridad real y patrulla:actualizada | Tiempo Real / Socket.io | Servicio / Unitaria | Alta | Servicio rechazarMisionService invocado con mocks de repositorio y socket | rechazarMisionService con incidente prioridad ALTA | Llamada a notificarMisionRechazada, notificarIncidenteActualizado (prioridad ALTA) y notificarPatrullaActualizada | Eventos emitidos con payload esperado en prueba unitaria de servicio | APROBADO | 12/11/2026 13:09 | - | fix(misiones): propagar prioridad real del incidente en evento socket tras rechazo de mision |
| `CP-H69-API-16` | Resiliencia de respuesta HTTP 200 OK si ocurre una excepción en el broker Socket.io/Redis tras el commit | Resiliencia | Servicio / Unitaria | Media | Transacción exitosa en repositorio y error simulado en notificarMisionRechazada | Mock de notificarMisionRechazada lanzando Error("Redis connection offline") | Error capturado en try/catch sin abortar la respuesta del servicio | rechazarMisionService captura la excepción y retorna estado RECHAZADA | APROBADO | 12/11/2026 13:09 | - | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-17` | Idempotencia DDL y numeración de migración 051_permiso_misiones_terreno_verificar.ts asignando permiso a PATRULLA_VERIFICADORA y ADMIN | Base de Datos | Migración Kysely | Alta | Directorio de migraciones con 035_permiso_misiones_terreno_verificar aplicada en BD | Revisión de src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts | Migración dentro del rango 51-60 sin colisiones e idempotente sobre permiso y rol_permiso | Secuencia sin colisión y cláusulas IF/ON CONFLICT DO NOTHING verificadas | APROBADO | 12/11/2026 13:08 | - | refactor(db): renumerar migracion de permiso terreno a 051 dentro del rango 51-60 (HU-69) |
| `CP-H69-API-18` | Registro del endpoint POST /api/misiones/{id}/rechazar en OpenAPI 3.0, compilación TypeScript, ESLint y suite Vitest | Contrato / Build | OpenAPI / CI | Alta | Especificación generada en GET /openapi.json y suite Vitest | GET /openapi.json, npx tsc --noEmit, npx eslint y npm test -- --run | Contrato OpenAPI expuesto, 0 errores TS/ESLint y suite Vitest verde | GET /openapi.json expone la ruta; 62 archivos / 756 tests pasan; 0 errores en tsc y eslint | APROBADO | 12/11/2026 13:09 | - | docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y transiciones de estado (HU-69) |

---

## 4. Bloque TSV para Google Sheets

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H69-API-01	Bypass de pertenencia, corrupción de cuadrilla/incidente y UUID vacío al rechazar misión sin patrulla_id o ATENCION_CUADRILLA	Seguridad / ICS	Repositorio / API	Crítica	Misión ATENCION_CUADRILLA en estado DESPACHADA con patrulla_id NULL y cuadrilla EN_MISION	POST /api/misiones/{id}/rechazar con x-user-id de patrulla ajena y {"justificacion_rechazo":"Rechazo indebido de mision de cuadrilla"}	HTTP 403 o 409 bloqueando rechazo de misión no asignada a patrulla verificadora	HTTP 200 OK retornando patrulla.id="", cuadrilla queda EN_MISION e incidente EN_ATENCION pasa a REPORTADO	ABIERTO	12/11/2026 13:13	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-API-02	Regresión sobre HU-20 en crearMisionVerificacionRepo manteniendo incidente en REPORTADO e incompatibilidad con HU-36	Regresión / ICS	Repositorio / Integración	Crítica	Incidente en REPORTADO y patrulla DISPONIBLE despachados vía POST /api/misiones	POST /api/misiones seguido de flujo HU-36 (aceptar) y HU-69 (rechazar)	Transición coherente con HU-20 (VERIFICANDO) y HU-36 sin romper contratos certificados	crearMisionVerificacionRepo mantiene incidente en REPORTADO rompiendo HU-20 CA-3 y bloqueando precondición de HU-36	ABIERTO	12/11/2026 13:10	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-API-03	Omisión de usuario.activo en verificarPermiso y de eliminado_en/activo en patrulla_verificadora al liberar a DISPONIBLE	Seguridad / Baja Lógica	Auth / Repositorio	Alta	Usuario patrulla con activo=false y patrulla dada de baja (activo=false, eliminado_en!=null, estado=NO_DISPONIBLE)	POST /api/misiones/{id}/rechazar con x-user-id del usuario inactivo	HTTP 401 Unauthorized por usuario inactivo y bloqueo de reactivación de patrulla dada de baja	HTTP 200 OK permitiendo rechazar con usuario inactivo y pasando la patrulla dada de baja a estado DISPONIBLE	ABIERTO	12/11/2026 13:13	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-API-04	Desbordamiento numérico DECIMAL(10,7) en PostgreSQL (HTTP 500) por falta de rango WGS84 en latitud y longitud	Validación / Robustez	Schema / API / BD	Alta	Misión VERIFICACION en estado DESPACHADA	POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Prueba de coordenada fuera de rango","latitud":1000,"longitud":-200}	HTTP 400 Bad Request validando latitud [-90,90] y longitud [-180,180]	HTTP 500 Internal Server Error por excepción numeric field overflow en mision_hito	ABIERTO	12/11/2026 13:13	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-API-05	Desincronización Redis Pub/Sub en notificarMisionRechazada, metadatos nulos en patrulla:actualizada y divergencia OpenAPI/Zod	Tiempo Real / Contrato	Socket / Service / OpenAPI	Media	Worker Next.js sin ioInstance emitiendo vía Redis y esquemas en mision.schema.ts	Inspección de notificarMisionRechazada, rechazarMisionService y RechazarMisionResponseSchema	Paridad de salas en Redis, delegacionId/usuarioLiderId reales y esquemas alineados	Redis omite salas supervisor y patrulla:{id}; servicio envía delegacionId:null y usuarioLiderId:null; incidente.prioridad fuera de schema	ABIERTO	12/11/2026 13:11	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H69-API-01	Rechazo exitoso (200 OK) de misión de verificación DESPACHADA por líder de patrulla con justificación válida	Funcional	API / E2E Local	Crítica	Misión VERIFICACION en estado DESPACHADA asignada a patrulla con líder activo	POST /api/misiones/{id}/rechazar con x-user-id de líder y {"justificacion_rechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","latitud":-39.81422,"longitud":-73.24589}	HTTP 200 OK retornando misión RECHAZADA, patrulla DISPONIBLE, incidente REPORTADO e hito RECHAZADA	HTTP 200 OK con DTO de respuesta completo y estados esperados	APROBADO	12/11/2026 13:13	-	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-02	Persistencia transaccional atómica en BD: mision.estado=RECHAZADA, fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y mision_hito	Integridad / ACID	Repositorio / BD	Crítica	Misión VERIFICACION DESPACHADA, patrulla EN_VERIFICACION e incidente asociado	Ejecución de POST /api/misiones/{id}/rechazar y consulta directa en PostgreSQL	Las 4 tablas actualizadas dentro de una única transacción Kysely db.transaction()	Verificado en PostgreSQL: mision=RECHAZADA con fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y fila en mision_hito	APROBADO	12/11/2026 13:13	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-03	Validación de alias camelCase justificacionRechazo y recorte .trim() con mínimo de 5 caracteres en RechazarMisionInputSchema	Validación (Zod)	Unitaria / Schema	Alta	Esquema RechazarMisionInputSchema	RechazarMisionInputSchema.safeParse({justificacionRechazo:"Ruta cortada por caída de árbol en camino Niebla"})	Validación exitosa normalizando al campo interno justificacionRechazo	Esquema acepta snake_case y camelCase >= 5 caracteres aplicando .trim()	APROBADO	12/11/2026 13:09	-	test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69)
CP-H69-API-04	Persistencia de coordenadas geográficas válidas (latitud, longitud) en tabla mision_hito durante el rechazo	Funcional / Geo	Repositorio / BD	Media	Misión VERIFICACION en estado DESPACHADA	Payload con latitud: -39.81422 y longitud: -73.24589	Registro en mision_hito almacena latitud -39.8142200 y longitud -73.2458900	Verificado en PostgreSQL SELECT de mision_hito tras HTTP 200 OK	APROBADO	12/11/2026 13:13	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-05	Autorización exitosa para integrante operativo en patrulla_personal o usuario con rol Administrador	Seguridad / RBAC	Repositorio / Auth	Alta	Usuario en patrulla_personal con permiso misiones:terreno:verificar o usuario Administrador	POST /api/misiones/{id}/rechazar como integrante de patrulla_personal o rol ADMIN	Acceso permitido para ejecutar el rechazo de la misión asignada	rechazarMisionPatrullaRepo valida usuario_lider_id, tabla patrulla_personal y bypass controlado para esAdmin	APROBADO	12/11/2026 13:08	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-06	Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo tiene 4 caracteres (límite inferior Regla §3.3)	Validación / Límite	API / Schema	Crítica	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Pana"}	HTTP 400 Bad Request indicando mínimo 5 caracteres	HTTP 400 Bad Request con error en campo justificacion_rechazo y 0 mutaciones en BD	APROBADO	12/11/2026 13:12	-	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-07	Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo está ausente, en blanco o con espacios ("    ")	Validación / Límite	API / Schema	Crítica	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"    "} y {}	HTTP 400 Bad Request rechazando cadenas vacías o espacios insuficientes tras .trim()	HTTP 400 Bad Request tanto en cURL real como en pruebas unitarias de esquema y ruta	APROBADO	12/11/2026 13:12	-	test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69)
CP-H69-API-08	Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta id no cumple el formato UUID	Validación / Contrato	API / Route	Media	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/no-es-uuid/rechazar con justificación válida	HTTP 400 Bad Request indicando que el identificador no es un UUID válido	HTTP 400 Bad Request: "El identificador de la misión proporcionado no es un UUID válido."	APROBADO	12/11/2026 13:12	-	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-09	Rechazo con HTTP 400 Bad Request ante cuerpo JSON sintácticamente malformado	Robustez / Contrato	API / Route	Media	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con Content-Type: application/json y body "json-invalido-{{{"	HTTP 400 Bad Request indicando que el cuerpo debe ser un JSON válido	HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido."	APROBADO	12/11/2026 13:12	-	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-10	Denegación con HTTP 401 Unauthorized ante ausencia de credenciales o token JWT Bearer inválido	Seguridad / Auth	API / AuthGuard	Crítica	Petición sin cabeceras de autenticación o con Bearer token inválido	POST /api/misiones/{id}/rechazar sin headers y con Authorization: Bearer token-invalido-123	HTTP 401 Unauthorized impidiendo acceso anónimo o con token adulterado	HTTP 401 Unauthorized en ambos escenarios verificados vía cURL real	APROBADO	12/11/2026 13:13	-	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-11	Denegación con HTTP 403 Forbidden cuando el usuario carece del permiso RBAC misiones:terreno:verificar	Seguridad / RBAC	API / AuthGuard	Crítica	Usuario autenticado con rol CALL_CENTER sin permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con x-user-id: 00000000-0000-4000-8000-000000000002	HTTP 403 Forbidden indicando falta del permiso misiones:terreno:verificar	HTTP 403 Forbidden: "No cuenta con el permiso requerido: misiones:terreno:verificar"	APROBADO	12/11/2026 13:12	-	feat(db): agregar permiso RBAC misiones:terreno:verificar (HU-69)
CP-H69-API-12	Denegación con HTTP 403 Forbidden cuando una patrulla verificadora distinta intenta rechazar la misión de otra patrulla	Seguridad / RBAC	Repositorio / API	Crítica	Misión asignada a PV-SUR-02 y petición emitida por líder de PV-NORTE-01	POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar con x-user-id d1000000-0000-4000-8000-000000000001	HTTP 403 Forbidden bloqueando el rechazo cruzado entre patrullas	HTTP 403 Forbidden: "No está autorizado para rechazar una misión asignada a otra patrulla verificadora."	APROBADO	12/11/2026 13:12	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-13	Rechazo con HTTP 404 Not Found cuando el UUID de misión no existe en la base de datos	Manejo de Errores	Repositorio / API	Alta	UUID válido inexistente en tabla mision	POST /api/misiones/60000000-0000-4000-8000-999999999999/rechazar	HTTP 404 Not Found indicando que la misión no fue encontrada	HTTP 404 Not Found: "No se encontró ninguna misión con el identificador proporcionado."	APROBADO	12/11/2026 13:12	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-14	Rechazo con HTTP 409 Conflict ante doble rechazo o misión fuera del estado DESPACHADA (ej. EN_CURSO)	Concurrencia / ICS	Repositorio / API	Crítica	Misión en estado RECHAZADA o EN_CURSO	POST /api/misiones/{id}/rechazar sobre misión ya rechazada y sobre misión EN_CURSO	HTTP 409 Conflict abortando la transición con control condicional WHERE estado = DESPACHADA	HTTP 409 Conflict en ambos casos ("La misión ya ha sido rechazada previamente." y "no se encuentra en estado 'DESPACHADA'")	APROBADO	12/11/2026 13:13	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-15	Emisión de eventos WebSocket mision:rechazada hacia sala encargado, incidente:actualizado con prioridad real y patrulla:actualizada	Tiempo Real / Socket.io	Servicio / Unitaria	Alta	Servicio rechazarMisionService invocado con mocks de repositorio y socket	rechazarMisionService con incidente prioridad ALTA	Llamada a notificarMisionRechazada, notificarIncidenteActualizado (prioridad ALTA) y notificarPatrullaActualizada	Eventos emitidos con payload esperado en prueba unitaria de servicio	APROBADO	12/11/2026 13:09	-	fix(misiones): propagar prioridad real del incidente en evento socket tras rechazo de mision
CP-H69-API-16	Resiliencia de respuesta HTTP 200 OK si ocurre una excepción en el broker Socket.io/Redis tras el commit	Resiliencia	Servicio / Unitaria	Media	Transacción exitosa en repositorio y error simulado en notificarMisionRechazada	Mock de notificarMisionRechazada lanzando Error("Redis connection offline")	Error capturado en try/catch sin abortar la respuesta del servicio	rechazarMisionService captura la excepción y retorna estado RECHAZADA	APROBADO	12/11/2026 13:09	-	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-17	Idempotencia DDL y numeración de migración 051_permiso_misiones_terreno_verificar.ts asignando permiso a PATRULLA_VERIFICADORA y ADMIN	Base de Datos	Migración Kysely	Alta	Directorio de migraciones con 035_permiso_misiones_terreno_verificar aplicada en BD	Revisión de src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts	Migración dentro del rango 51-60 sin colisiones e idempotente sobre permiso y rol_permiso	Secuencia sin colisión y cláusulas IF/ON CONFLICT DO NOTHING verificadas	APROBADO	12/11/2026 13:08	-	refactor(db): renumerar migracion de permiso terreno a 051 dentro del rango 51-60 (HU-69)
CP-H69-API-18	Registro del endpoint POST /api/misiones/{id}/rechazar en OpenAPI 3.0, compilación TypeScript, ESLint y suite Vitest	Contrato / Build	OpenAPI / CI	Alta	Especificación generada en GET /openapi.json y suite Vitest	GET /openapi.json, npx tsc --noEmit, npx eslint y npm test -- --run	Contrato OpenAPI expuesto, 0 errores TS/ESLint y suite Vitest verde	GET /openapi.json expone la ruta; 62 archivos / 756 tests pasan; 0 errores en tsc y eslint	APROBADO	12/11/2026 13:09	-	docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y transiciones de estado (HU-69)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas (Vitest, TypeScript y ESLint)

#### 5.1.1 Suite Focalizada de HU-69 mediante Filtro `-t`
```bash
npm test -- -t "HU-69"
```

**Salida de Consola:**
```text
 ✓ src/modules/misiones/__tests__/mision-rechazar.service.test.ts (2 tests) 29ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.schema.test.ts (9 tests) 24ms
 ✓ src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts (9 tests) 20ms

 Test Files  3 passed | 59 skipped (62)
      Tests  20 passed | 736 skipped (756)
```

#### 5.1.2 Ejecución Directa de Archivos de Prueba de HU-69 y OpenAPI
```bash
npx vitest run \
  src/modules/misiones/__tests__/mision-rechazar.schema.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.service.test.ts \
  src/app/api/misiones/\[id\]/rechazar/__tests__/route.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision-rechazar.service.test.ts (2 tests) 12ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.schema.test.ts (9 tests) 9ms
 ✓ src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts (9 tests) 20ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 121ms

 Test Files  4 passed (4)
      Tests  21 passed (21)
```

#### 5.1.3 Suite Completa del Repositorio, Chequeo de Tipos y Linter
```bash
npm test -- --run
npx next typegen && npx tsc --noEmit
npx eslint src/app/api/misiones/\[id\]/rechazar/route.ts src/modules/misiones/mision.schema.ts src/modules/misiones/mision.service.ts src/modules/misiones/mision.repository.ts src/lib/socket/index.ts src/lib/socket/types.ts src/lib/openapi/index.ts
```

**Salida de Consola:**
```text
 Test Files  62 passed (62)
      Tests  756 passed (756)
✓ Types generated successfully (0 errores tsc / 0 errores eslint)
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante `cURL`

#### Caso 1: Rechazo por Falta de Autenticación (`401 Unauthorized` — `CP-H69-API-10`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 2: Rechazo por Token JWT Inválido (`401 Unauthorized` — `CP-H69-API-10`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "Authorization: Bearer token-invalido-123" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Token de sesión inválido o expirado."}
```

#### Caso 3: Denegación por Falta de Permiso RBAC `misiones:terreno:verificar` (`403 Forbidden` — `CP-H69-API-11`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 4: Denegación por Intento de Rechazo desde Otra Patrulla (`403 Forbidden` — `CP-H69-API-12`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en el móvil"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No está autorizado para rechazar una misión asignada a otra patrulla verificadora."}
```

#### Caso 5: Validación de Longitud Mínima con 4 Caracteres y Solo Espacios (`400 Bad Request` — `CP-H69-API-06`, `CP-H69-API-07`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Pana"}'

curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"    "}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"justificacion_rechazo","mensaje":"El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres."}]}
```

#### Caso 6: Parámetro UUID Inválido y JSON Malformado (`400 Bad Request` — `CP-H69-API-08`, `CP-H69-API-09`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/no-es-uuid/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico"}'

curl -s -i -X POST "http://localhost:3001/api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d 'json-invalido-{{{'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"El identificador de la misión proporcionado no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador de la misión debe ser un UUID válido."}]}
```
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"El cuerpo de la solicitud debe ser un formato JSON válido."}
```

#### Caso 7: Misión Inexistente (`404 Not Found` — `CP-H69-API-13`) y Misión en Curso (`409 Conflict` — `CP-H69-API-14`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/60000000-0000-4000-8000-999999999999/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en el móvil"}'

curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/rechazar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en el móvil"}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
content-type: application/json

{"message":"No se encontró ninguna misión con el identificador proporcionado."}
```
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La misión no se encuentra en estado 'DESPACHADA' para ser rechazada (estado actual: 'EN_CURSO')."}
```

#### Caso 8: Rechazo Exitoso (`200 OK`) y Doble Rechazo Concurrente/Secuencial (`409 Conflict` — `CP-H69-API-01`, `CP-H69-API-02`, `CP-H69-API-04`, `CP-H69-API-14`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000001/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","latitud":-39.81422,"longitud":-73.24589}'
```

**Respuesta HTTP/JSON (`200 OK`):**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.","data":{"mision":{"id":"99999999-0000-4000-8000-000000000001","codigo":"MIS-QA-H69-1","estado":"RECHAZADA","justificacionRechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","actualizadoEn":"2026-11-12T16:13:05.214Z"},"patrulla":{"id":"99999999-0000-4000-8000-000000000002","nombre":"Patrulla QA Temporal","estado":"DISPONIBLE"},"incidente":{"id":"99999999-0000-4000-8000-000000000003","codigo":"INC-QA-H69-1","estado":"REPORTADO","prioridad":"ALTA"},"hito":{"id":"b801e3b5-97c1-4ec6-b90b-dd6b32635846","hito":"RECHAZADA","descripcion":"Misión rechazada por patrulla: Desperfecto mecánico en el neumático delantero del vehículo.","creadoEn":"2026-11-12T16:13:05.214Z"}}}
```

**Reintento sobre la misma misión (`409 Conflict`):**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La misión ya ha sido rechazada previamente."}
```

#### Caso 9: Evidencias Reales de Reproducción de Defectos (`BUG-H69-API-01`, `BUG-H69-API-03`, `BUG-H69-API-04`)
```bash
# BUG-H69-API-01: Patrulla ajena rechaza misión ATENCION_CUADRILLA (patrulla_id = NULL)
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000011/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Rechazo indebido de mision de cuadrilla"}'

# BUG-H69-API-04: Coordenadas fuera de rango WGS84 producen HTTP 500
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000016/rechazar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Prueba de coordenada fuera de rango","latitud":1000,"longitud":-200}'

# BUG-H69-API-03: Usuario inactivo rechaza misión de patrulla dada de baja y la pasa a DISPONIBLE
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000016/rechazar" \
  -H "x-user-id: 99999999-0000-4000-8000-000000000015" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Rechazo por usuario inactivo sobre patrulla dada de baja"}'
```

**Respuestas Observadas:**
```http
# BUG-H69-API-01 (200 OK erróneo con patrulla.id="" y cuadrilla huérfana en EN_MISION)
HTTP/1.1 200 OK
{"message":"Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.","data":{"mision":{"id":"99999999-0000-4000-8000-000000000011","codigo":"MIS-QA-BUG-1","estado":"RECHAZADA","justificacionRechazo":"Rechazo indebido de mision de cuadrilla","actualizadoEn":"2026-11-12T16:13:21.646Z"},"patrulla":{"id":"","nombre":"Patrulla Verificadora","estado":"DISPONIBLE"},"incidente":{"id":"99999999-0000-4000-8000-000000000013","codigo":"INC-QA-H69-B","estado":"REPORTADO","prioridad":"ALTA"},"hito":{...}}}

# BUG-H69-API-04 (500 Internal Server Error por desbordamiento DECIMAL(10,7))
HTTP/1.1 500 Internal Server Error
{"message":"Error interno del servidor al procesar el rechazo de la misión."}

# BUG-H69-API-03 (200 OK erróneo con usuario activo=false y patrulla dada de baja restaurada a DISPONIBLE)
HTTP/1.1 200 OK
{"message":"Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.","data":{...,"patrulla":{"id":"99999999-0000-4000-8000-000000000012","nombre":"Patrulla Baja QA","estado":"DISPONIBLE"},...}}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Al recibir una notificación de nueva misión en la PWA, la patrulla debe contar con la opción visible 'Rechazar Misión'. | `CP-H69-API-18` | 🟡 **N/A (Frontend `sgrai-pwa`)** | Corresponde a interfaz PWA; `sgrai-api` provee el endpoint y contrato OpenAPI `POST /api/misiones/{id}/rechazar`. |
| **CA-2:** Al presionar rechazar, la interfaz debe desplegar obligatoriamente un modal exigiendo el motivo del rechazo (`justificacion_rechazo`, mínimo 5 caracteres según Regla Crítica §3.3). No se debe permitir enviar el rechazo en blanco o con menos caracteres. | `CP-H69-API-03`, `CP-H69-API-06`, `CP-H69-API-07`, `BUG-H69-API-04` | 🟡 **PARCIAL** | El backend valida `justificacion_rechazo` >= 5 caracteres tras `.trim()` (`400 Bad Request`), pero carece de validación de rango geográfico en `latitud`/`longitud` (`BUG-H69-API-04`). |
| **CA-3:** La API debe actualizar en una sola transacción: (1) `mision.estado = 'RECHAZADA'`, (2) Persistir `justificacion_rechazo`, (3) Mantener o transicionar `patrulla.estado = 'DISPONIBLE'`, y (4) Mantener `incidente.estado = 'REPORTADO'` para reasignación. | `CP-H69-API-01`, `CP-H69-API-02`, `CP-H69-API-04`, `CP-H69-API-14`, `BUG-H69-API-01`, `BUG-H69-API-02`, `BUG-H69-API-03` | 🔴 **NO CUMPLIDO (DEFECTOS CRÍTICOS)** | Ejecuta la transacción en el flujo feliz, pero permite corromper misiones `ATENCION_CUADRILLA` (`BUG-H69-API-01`), introduce regresión sobre HU-20 y bloqueo en HU-36 (`BUG-H69-API-02`) y reactiva patrullas dadas de baja lógica (`BUG-H69-API-03`). |
| **CA-4:** El sistema debe emitir la notificación WebSocket `mision:rechazada` hacia la sala `encargado`. | `CP-H69-API-15`, `CP-H69-API-16`, `BUG-H69-API-05` | 🟡 **PARCIAL** | Emite `mision:rechazada` hacia `encargado` y `sala:encargados`, pero presenta desincronización de salas en Redis (`supervisor`, `patrulla:{id}`) y metadatos nulos en `patrulla:actualizada` (`BUG-H69-API-05`). |
| **CA-5:** El endpoint `POST /api/misiones/{id}/rechazar` debe validar autenticación de patrulla verificadora. | `CP-H69-API-05`, `CP-H69-API-10`, `CP-H69-API-11`, `CP-H69-API-12`, `CP-H69-API-17`, `BUG-H69-API-01`, `BUG-H69-API-03` | 🔴 **NO CUMPLIDO (BYPASS DE SEGURIDAD)** | Valida token, permiso `misiones:terreno:verificar` y pertenencia cuando existe `patrulla_id`, pero omite la validación de pertenencia si `patrulla_id` es `NULL` (`BUG-H69-API-01`) y no valida `usuario.activo = true` en `verificarPermiso` (`BUG-H69-API-03`). |

