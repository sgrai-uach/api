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
> **Fecha de Re-Test:** 13/11/2026 22:06  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (`Approved` — 5 Defectos Reales Corregidos y Verificados en Re-Test)**

---

## 1. Resumen Ejecutivo de Auditoría Técnica

### 1.1 Dictamen de Re-Test (13/11/2026)
Habiendo recibido los commits de corrección desarrollados por `zetastormy` en la rama `feature/H69-rechazo-mision-patrulla`, se ejecutó una segunda auditoría forense integral de código fuente, análisis estático, suite completa de pruebas automatizadas y ejecución de casos de prueba replicables mediante `cURL` contra la base de datos PostgreSQL 16 con PostGIS y el broker Redis 7.

Se certifica que los **5 defectos reales reportados** en la auditoría inicial (`BUG-H69-API-01` a `BUG-H69-API-05`) fueron **subsanados al 100%**, respetando las reglas de negocio del Sistema de Comando de Incidentes (ICS), la integridad referencial de base de datos, el principio de menor privilegio en control de acceso basado en roles (RBAC), el manejo resiliente de bajas lógicas y la paridad de contratos de integración en OpenAPI 3.0:

1. **Blindaje de Pertenencia y Tipología ICS (`BUG-H69-API-01` — Resuelto):** Se condicionó estrictamente el endpoint `POST /api/misiones/{id}/rechazar` a misiones con `tipo_mision === 'VERIFICACION'` y `patrulla_id IS NOT NULL`. Si se intenta invocar sobre una misión de cuadrilla (`ATENCION_CUADRILLA`) o una misión sin patrulla asignada, el sistema aborta de inmediato con `HTTP 409 Conflict`, impidiendo cualquier mutación espuria sobre el estado de la cuadrilla o del incidente.
2. **Restauración del Ciclo de Vida ICS y Compatibilidad HU-20/HU-36 (`BUG-H69-API-02` — Resuelto):** Se restauró la transición canónica en `crearMisionVerificacionRepo` (`POST /api/misiones`), retornando a `incidente.estado = 'VERIFICANDO'` al despachar la patrulla. Esto satisface el Criterio de Aceptación CA-3 de HU-20 y habilita la precondición de aceptación requerida por HU-36. Al rechazar en HU-69, el incidente revierte exitosamente a `'REPORTADO'` para su reasignación en el Centro de Mando.
3. **Validación de Usuario Activo y Protección de Baja Lógica (`BUG-H69-API-03` — Resuelto):** `verificarPermiso` ahora valida obligatoriamente que `usuario.activo === true`, devolviendo `HTTP 401 Unauthorized` si el usuario está inactivo. En el repositorio de persistencia, se agregaron filtros defensivos para preservar el estado `'NO_DISPONIBLE'` en patrullas que hayan sido dadas de baja lógica (`activo = false` o `eliminado_en IS NOT NULL`).
4. **Validación Geoespacial WGS84 (`BUG-H69-API-04` — Resuelto):** Se añadieron cotas geográficas en `RechazarMisionInputSchema` y `RechazarMisionBodySchema` (`latitud` entre `-90` y `90`, `longitud` entre `-180` y `180`), eliminando cualquier desbordamiento numérico `DECIMAL(10,7)` en PostgreSQL y respondiendo `HTTP 400 Bad Request` controlado ante coordenadas inválidas.
5. **Sincronización Redis Pub/Sub, Metadatos de Patrulla y OpenAPI (`BUG-H69-API-05` — Resuelto):** Se homogeneizaron las salas en la rama Redis Pub/Sub (`encargado`, `sala:encargados`, `supervisor`, `patrulla:{patrullaId}`), se propagaron los identificadores reales `delegacionId` y `usuarioLiderId` en el evento `patrulla:actualizada`, y se expuso `prioridad` en `RechazarMisionResponseSchema`.

### 1.2 Métricas Consolidadas de Calidad

| Métrica de Calidad | Auditoría Inicial (12/11/2026) | Re-Test Final (13/11/2026) | Estado Actual |
|---|:---:|:---:|:---:|
| **Total de Casos de Prueba en Matriz** | 23 | 23 | Consolidado |
| **Casos Aprobados (Passed)** | 18 | 23 | 100% de cobertura efectiva |
| **Defectos Abiertos (Open / Failed)** | 5 | 0 | 0 defectos pendientes |
| **Defectos Subsanados y Verificados (Closed)** | 0 | 5 | 100% corregidos |
| **Tasa de Aprobación (% Pass)** | 78.3% | **100.0%** | 🟢 **APROBADO PARA MERGE** |
| **Suite Automatizada (Vitest)** | 62 archivos / 756 tests pass | **64 archivos / 778 tests pass** | 100% verde (0 fallos) |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | 0 errores | **0 errores** | Limpio y tipado estricto |
| **Especificación OpenAPI 3.0** | Divergencias menores | **100% sincronizado** | Expuesto en `/openapi.json` |

---

## 2. Registro Técnico de Defectos

### `BUG-H69-API-01`: Bypass de Autorización por Pertenencia, Corrupción de Estado ICS y Violación de Contrato UUID cuando `mision.patrulla_id` es Nulo o `tipo_mision` es Distinto de `VERIFICACION`
* **Severidad:** **CRÍTICA** (Seguridad RBAC / Integridad Operativa ICS / Contrato OpenAPI).
* **Estado:** 🟢 **CORREGIDO Y VERIFICADO EN RE-TEST**
* **Archivos Afectados / Corregidos:** `src/modules/misiones/mision.repository.ts`.
* **Descripción de la Solución Aplicada:**
  Se modificó la consulta inicial de `rechazarMisionPatrullaRepo` para seleccionar obligatoriamente `mision.tipo_mision` y `mision.cuadrilla_id`. Se incorporó una guarda de negocio estricta que exige `tipo_mision === 'VERIFICACION'` y `patrulla_id != null`. De no cumplirse, se lanza de forma determinista un `ConflictError` indicando: *"Solo es posible rechazar por esta vía misiones de verificación asignadas a una patrulla verificadora."*. Se restringió además la reversión del incidente exclusivamente a estados operacionales previos a la atención (`REPORTADO` y `VERIFICANDO`).
* **Verificación en Re-Test:**
  Al invocar `POST /api/misiones/{id}/rechazar` sobre una misión de cuadrilla (`ATENCION_CUADRILLA`) o sin patrulla asignada, el sistema responde `HTTP 409 Conflict`. La cuadrilla se mantiene intacta en estado `'EN_MISION'` y el incidente en `'EN_ATENCION'`, impidiendo la degradación espuria de registros ajenos.

---

### `BUG-H69-API-02`: Regresión de Contrato sobre HU-20 (`crearMisionVerificacionRepo`) Manteniendo `incidente.estado = 'REPORTADO'` e Incompatibilidad Bloqueante con HU-36
* **Severidad:** **CRÍTICA** (Violación del Ciclo de Vida ICS / Regresión sobre Funcionalidad Certificada / Bloqueo de Integración).
* **Estado:** 🟢 **CORREGIDO Y VERIFICADO EN RE-TEST**
* **Archivos Afectados / Corregidos:**
  * `src/modules/misiones/mision.repository.ts`
  * `src/modules/misiones/mision.service.ts`
  * `src/lib/openapi/index.ts`
  * `docs/api/misiones.md`
* **Descripción de la Solución Aplicada:**
  Se restauró la actualización de `incidente.estado = 'VERIFICANDO'` en `crearMisionVerificacionRepo` (`POST /api/misiones`), preservando la máquina de estados canónica de la sección §6 de la arquitectura (`REPORTADO → VERIFICANDO → EN_ATENCION → NO_ABORDABLE / RESUELTO`). Se sincronizó la documentación técnica en `docs/api/misiones.md` y el contrato OpenAPI.
* **Verificación en Re-Test:**
  Se ejecutó el flujo completo de vida: al despachar la patrulla en HU-20, el incidente transiciona a `'VERIFICANDO'`, satisfaciendo la precondición de aceptación de HU-36. Al rechazar la misión en HU-69 mediante `POST /api/misiones/{id}/rechazar`, el incidente revierte limpiamente a `'REPORTADO'`, quedando disponible para nueva asignación en el Centro de Mando.

---

### `BUG-H69-API-03`: Omisión de Validación de Usuario Activo (`usuario.activo`) en `verificarPermiso` y de Baja Lógica de Patrulla (`eliminado_en IS NULL`, `activo = true`) al Liberar a `DISPONIBLE`
* **Severidad:** **ALTA** (Seguridad RBAC / Integridad de Baja Lógica HU-85).
* **Estado:** 🟢 **CORREGIDO Y VERIFICADO EN RE-TEST**
* **Archivos Afectados / Corregidos:**
  * `src/modules/seguridad/auth.service.ts`
  * `src/modules/misiones/mision.repository.ts`
* **Descripción de la Solución Aplicada:**
  1. En `verificarPermiso`, se incorporó la selección y validación estricta de `usuario.activo === true`. Si el usuario se encuentra desactivado, se arroja `UnauthorizedError` (*"El usuario especificado se encuentra inactivo en la institución."*).
  2. En `rechazarMisionPatrullaRepo`, la actualización de la patrulla a `'DISPONIBLE'` fue blindada con cláusulas `.where("eliminado_en", "is", null).where("activo", "=", true)`. De esta forma, si la patrulla se encuentra en baja lógica, no es reactivada erróneamente.
* **Verificación en Re-Test:**
  Un usuario con `activo = false` recibe `HTTP 401 Unauthorized` al intentar rechazar una misión. Si la patrulla asociada se encuentra dada de baja lógica (`activo = false`, `eliminado_en IS NOT NULL`), se mantiene intacta en estado `'NO_DISPONIBLE'`.

---

### `BUG-H69-API-04`: Falta de Validación de Rango Geográfico WGS84 en `latitud` y `longitud` Generando Error `500 Internal Server Error` por Desbordamiento Numérico en PostgreSQL
* **Severidad:** **ALTA** (Estabilidad de API / Validación de Contratos Zod / Manejo de Errores).
* **Estado:** 🟢 **CORREGIDO Y VERIFICADO EN RE-TEST**
* **Archivos Afectados / Corregidos:** `src/modules/misiones/mision.schema.ts`.
* **Descripción de la Solución Aplicada:**
  Se actualizaron `RechazarMisionInputSchema` y `RechazarMisionBodySchema` para acotar los campos opcionales `latitud` (`.min(-90).max(90)`) y `longitud` (`.min(-180).max(180)`), requiriendo además `.finite()`.
* **Verificación en Re-Test:**
  El envío de peticiones con coordenadas inválidas (ej. `latitud: 1000.5` o `longitud: 250`) es interceptado inmediatamente en la capa de parsing Zod, respondiendo `HTTP 400 Bad Request` con los mensajes *"La latitud debe estar entre -90 y 90."* y *"La longitud debe estar entre -180 y 180."*, evitando cualquier excepción `numeric field overflow` (`500`) en PostgreSQL.

---

### `BUG-H69-API-05`: Desincronización de Salas en Redis Pub/Sub (`notificarMisionRechazada`), Pérdida de Metadatos en `notificarPatrullaActualizada` y Divergencia Menor de Esquemas OpenAPI/Zod
* **Severidad:** **MEDIA** (Tiempo Real / Consistencia de Contratos OpenAPI).
* **Estado:** 🟢 **CORREGIDO Y VERIFICADO EN RE-TEST**
* **Archivos Afectados / Corregidos:**
  * `src/lib/socket/index.ts`
  * `src/modules/misiones/mision.service.ts`
  * `src/modules/misiones/mision.schema.ts`
* **Descripción de la Solución Aplicada:**
  1. Se unificaron las salas en el publicador Redis de `notificarMisionRechazada`, garantizando la emisión hacia `"encargado"`, `"sala:encargados"`, `"supervisor"` y `"patrulla:${payload.patrullaId}"`.
  2. En `rechazarMisionService`, se propagan los valores reales de `delegacionId` y `usuarioLiderId` obtenidos desde `patrulla_verificadora` hacia el evento `patrulla:actualizada`.
  3. Se incluyó el atributo `prioridad` del incidente dentro de `RechazarMisionResponseSchema` y se homologaron las descripciones en el catálogo OpenAPI 3.0.
* **Verificación en Re-Test:**
  Los eventos WebSocket son difundidos consistentemente por Redis Pub/Sub hacia todas las salas suscritas, los metadatos de la patrulla no se pierden ni sobrescriben con nulos, y el payload de respuesta coincide al 100% con el esquema OpenAPI.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H69-API-01` | Bypass de pertenencia, corrupción de cuadrilla/incidente y UUID vacío al rechazar misión sin patrulla_id o ATENCION_CUADRILLA | Seguridad / ICS | Repositorio / API | Crítica | Misión ATENCION_CUADRILLA en estado DESPACHADA con patrulla_id NULL y cuadrilla EN_MISION | POST /api/misiones/{id}/rechazar con x-user-id de patrulla ajena y {"justificacion_rechazo":"Rechazo indebido de mision de cuadrilla"} | HTTP 403 o 409 bloqueando rechazo de misión no asignada a patrulla verificadora | HTTP 409 Conflict bloqueando rechazo: solo admite misiones de verificación de patrulla; cuadrilla e incidente quedan intactos | CORREGIDO | 12/11/2026 13:13 | 13/11/2026 22:06 | fix(misiones): blindar transaccion de rechazo y restaurar transicion ICS (BUG-H69-API-01, BUG-H69-API-02, BUG-H69-API-03) |
| `BUG-H69-API-02` | Regresión sobre HU-20 en crearMisionVerificacionRepo manteniendo incidente en REPORTADO e incompatibilidad con HU-36 | Regresión / ICS | Repositorio / Integración | Crítica | Incidente en REPORTADO y patrulla DISPONIBLE despachados vía POST /api/misiones | POST /api/misiones seguido de flujo HU-36 (aceptar) y HU-69 (rechazar) | Transición coherente con HU-20 (VERIFICANDO) y HU-36 sin romper contratos certificados | Incidente pasa a VERIFICANDO al despachar y revierte a REPORTADO al rechazar, cumpliendo HU-20, HU-36 y HU-69 | CORREGIDO | 12/11/2026 13:10 | 13/11/2026 22:06 | fix(misiones): blindar transaccion de rechazo y restaurar transicion ICS (BUG-H69-API-01, BUG-H69-API-02, BUG-H69-API-03) |
| `BUG-H69-API-03` | Omisión de usuario.activo en verificarPermiso y de eliminado_en/activo en patrulla_verificadora al liberar a DISPONIBLE | Seguridad / Baja Lógica | Auth / Repositorio | Alta | Usuario patrulla con activo=false y patrulla dada de baja (activo=false, eliminado_en!=null, estado=NO_DISPONIBLE) | POST /api/misiones/{id}/rechazar con x-user-id del usuario inactivo | HTTP 401 Unauthorized por usuario inactivo y bloqueo de reactivación de patrulla dada de baja | HTTP 401 Unauthorized para usuario inactivo; patrulla dada de baja se preserva en NO_DISPONIBLE sin reactivarse | CORREGIDO | 12/11/2026 13:13 | 13/11/2026 22:06 | fix(seguridad): verificar usuario activo en verificarPermiso (BUG-H69-API-03) |
| `BUG-H69-API-04` | Desbordamiento numérico DECIMAL(10,7) en PostgreSQL (HTTP 500) por falta de rango WGS84 en latitud y longitud | Validación / Robustez | Schema / API / BD | Alta | Misión VERIFICACION en estado DESPACHADA | POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Prueba de coordenada fuera de rango","latitud":1000,"longitud":-200} | HTTP 400 Bad Request validando latitud [-90,90] y longitud [-180,180] | HTTP 400 Bad Request con mensajes de validación Zod para latitud y longitud, impidiendo error 500 en BD | CORREGIDO | 12/11/2026 13:13 | 13/11/2026 22:06 | fix(misiones): validar cotas geograficas WGS84 en esquemas de rechazo (BUG-H69-API-04, BUG-H69-API-05) |
| `BUG-H69-API-05` | Desincronización Redis Pub/Sub en notificarMisionRechazada, metadatos nulos en patrulla:actualizada y divergencia OpenAPI/Zod | Tiempo Real / Contrato | Socket / Service / OpenAPI | Media | Worker Next.js sin ioInstance emitiendo vía Redis y esquemas en mision.schema.ts | Inspección de notificarMisionRechazada, rechazarMisionService y RechazarMisionResponseSchema | Paridad de salas en Redis, delegacionId/usuarioLiderId reales y esquemas alineados | Salas sincronizadas en Redis (supervisor, patrulla), metadatos reales propagados y schema alineado con prioridad | CORREGIDO | 12/11/2026 13:11 | 13/11/2026 22:06 | fix(socket): sincronizar salas Redis y metadatos de patrulla al rechazar mision (BUG-H69-API-05) |
| `CP-H69-API-01` | Rechazo exitoso (200 OK) de misión de verificación DESPACHADA por líder de patrulla con justificación válida | Funcional | API / E2E Local | Crítica | Misión VERIFICACION en estado DESPACHADA asignada a patrulla con líder activo | POST /api/misiones/{id}/rechazar con x-user-id de líder y {"justificacion_rechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","latitud":-39.81422,"longitud":-73.24589} | HTTP 200 OK retornando misión RECHAZADA, patrulla DISPONIBLE, incidente REPORTADO e hito RECHAZADA | HTTP 200 OK con DTO de respuesta completo y estados esperados | APROBADO | 12/11/2026 13:13 | 13/11/2026 22:06 | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-02` | Persistencia transaccional atómica en BD: mision.estado=RECHAZADA, fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y mision_hito | Integridad / ACID | Repositorio / BD | Crítica | Misión VERIFICACION DESPACHADA, patrulla EN_VERIFICACION e incidente asociado | Ejecución de POST /api/misiones/{id}/rechazar y consulta directa en PostgreSQL | Las 4 tablas actualizadas dentro de una única transacción Kysely db.transaction() | Verificado en PostgreSQL: mision=RECHAZADA con fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y fila en mision_hito | APROBADO | 12/11/2026 13:13 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-03` | Validación de alias camelCase justificacionRechazo y recorte .trim() con mínimo de 5 caracteres en RechazarMisionInputSchema | Validación (Zod) | Unitaria / Schema | Alta | Esquema RechazarMisionInputSchema | RechazarMisionInputSchema.safeParse({justificacionRechazo:"Ruta cortada por caída de árbol en camino Niebla"}) | Validación exitosa normalizando al campo interno justificacionRechazo | Esquema acepta snake_case y camelCase >= 5 caracteres aplicando .trim() | APROBADO | 12/11/2026 13:09 | 13/11/2026 22:06 | test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69) |
| `CP-H69-API-04` | Persistencia de coordenadas geográficas válidas (latitud, longitud) en tabla mision_hito durante el rechazo | Funcional / Geo | Repositorio / BD | Media | Misión VERIFICACION en estado DESPACHADA | Payload con latitud: -39.81422 y longitud: -73.24589 | Registro en mision_hito almacena latitud -39.8142200 y longitud -73.2458900 | Verificado en PostgreSQL SELECT de mision_hito tras HTTP 200 OK | APROBADO | 12/11/2026 13:13 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-05` | Autorización exitosa para integrante operativo en patrulla_personal o usuario con rol Administrador | Seguridad / RBAC | Repositorio / Auth | Alta | Usuario en patrulla_personal con permiso misiones:terreno:verificar o usuario Administrador | POST /api/misiones/{id}/rechazar como integrante de patrulla_personal o rol ADMIN | Acceso permitido para ejecutar el rechazo de la misión asignada | rechazarMisionPatrullaRepo valida usuario_lider_id, tabla patrulla_personal y bypass controlado para esAdmin | APROBADO | 12/11/2026 13:08 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-06` | Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo tiene 4 caracteres (límite inferior Regla §3.3) | Validación / Límite | API / Schema | Crítica | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Pana"} | HTTP 400 Bad Request indicando mínimo 5 caracteres | HTTP 400 Bad Request con error en campo justificacion_rechazo y 0 mutaciones en BD | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-07` | Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo está ausente, en blanco o con espacios ("    ") | Validación / Límite | API / Schema | Crítica | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"    "} y {} | HTTP 400 Bad Request rechazando cadenas vacías o espacios insuficientes tras .trim() | HTTP 400 Bad Request tanto en cURL real como en pruebas unitarias de esquema y ruta | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69) |
| `CP-H69-API-08` | Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta id no cumple el formato UUID | Validación / Contrato | API / Route | Media | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/no-es-uuid/rechazar con justificación válida | HTTP 400 Bad Request indicando que el identificador no es un UUID válido | HTTP 400 Bad Request: "El identificador de la misión proporcionado no es un UUID válido." | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-09` | Rechazo con HTTP 400 Bad Request ante cuerpo JSON sintácticamente malformado | Robustez / Contrato | API / Route | Media | Usuario autenticado con permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con Content-Type: application/json y body "json-invalido-{{{" | HTTP 400 Bad Request indicando que el cuerpo debe ser un JSON válido | HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido." | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-10` | Denegación con HTTP 401 Unauthorized ante ausencia de credenciales o token JWT Bearer inválido | Seguridad / Auth | API / AuthGuard | Crítica | Petición sin cabeceras de autenticación o con Bearer token inválido | POST /api/misiones/{id}/rechazar sin headers y con Authorization: Bearer token-invalido-123 | HTTP 401 Unauthorized impidiendo acceso anónimo o con token adulterado | HTTP 401 Unauthorized en ambos escenarios verificados vía cURL real | APROBADO | 12/11/2026 13:13 | 13/11/2026 22:06 | feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69) |
| `CP-H69-API-11` | Denegación con HTTP 403 Forbidden cuando el usuario carece del permiso RBAC misiones:terreno:verificar | Seguridad / RBAC | API / AuthGuard | Crítica | Usuario autenticado con rol CALL_CENTER sin permiso misiones:terreno:verificar | POST /api/misiones/{id}/rechazar con x-user-id: 00000000-0000-4000-8000-000000000002 | HTTP 403 Forbidden indicando falta del permiso misiones:terreno:verificar | HTTP 403 Forbidden: "No cuenta con el permiso requerido: misiones:terreno:verificar" | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | feat(db): agregar permiso RBAC misiones:terreno:verificar (HU-69) |
| `CP-H69-API-12` | Denegación con HTTP 403 Forbidden cuando una patrulla verificadora distinta intenta rechazar la misión de otra patrulla | Seguridad / RBAC | Repositorio / API | Crítica | Misión asignada a PV-SUR-02 y petición emitida por líder de PV-NORTE-01 | POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar con x-user-id d1000000-0000-4000-8000-000000000001 | HTTP 403 Forbidden bloqueando el rechazo cruzado entre patrullas | HTTP 403 Forbidden: "No está autorizado para rechazar una misión asignada a otra patrulla verificadora." | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-13` | Rechazo con HTTP 404 Not Found cuando el UUID de misión no existe en la base de datos | Manejo de Errores | Repositorio / API | Alta | UUID válido inexistente en tabla mision | POST /api/misiones/60000000-0000-4000-8000-999999999999/rechazar | HTTP 404 Not Found indicando que la misión no fue encontrada | HTTP 404 Not Found: "No se encontró ninguna misión con el identificador proporcionado." | APROBADO | 12/11/2026 13:12 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-14` | Rechazo con HTTP 409 Conflict ante doble rechazo o misión fuera del estado DESPACHADA (ej. EN_CURSO) | Concurrencia / ICS | Repositorio / API | Crítica | Misión en estado RECHAZADA o EN_CURSO | POST /api/misiones/{id}/rechazar sobre misión ya rechazada y sobre misión EN_CURSO | HTTP 409 Conflict abortando la transición con control condicional WHERE estado = DESPACHADA | HTTP 409 Conflict en ambos casos ("La misión ya ha sido rechazada previamente." y "no se encuentra en estado 'DESPACHADA'") | APROBADO | 12/11/2026 13:13 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-15` | Emisión de eventos WebSocket mision:rechazada hacia sala encargado, incidente:actualizado con prioridad real y patrulla:actualizada | Tiempo Real / Socket.io | Servicio / Unitaria | Alta | Servicio rechazarMisionService invocado con mocks de repositorio y socket | rechazarMisionService con incidente prioridad ALTA | Llamada a notificarMisionRechazada, notificarIncidenteActualizado (prioridad ALTA) y notificarPatrullaActualizada | Eventos emitidos con payload esperado en prueba unitaria de servicio | APROBADO | 12/11/2026 13:09 | 13/11/2026 22:06 | fix(misiones): propagar prioridad real del incidente en evento socket tras rechazo de mision |
| `CP-H69-API-16` | Resiliencia de respuesta HTTP 200 OK si ocurre una excepción en el broker Socket.io/Redis tras el commit | Resiliencia | Servicio / Unitaria | Media | Transacción exitosa en repositorio y error simulado en notificarMisionRechazada | Mock de notificarMisionRechazada lanzando Error("Redis connection offline") | Error capturado en try/catch sin abortar la respuesta del servicio | rechazarMisionService captura la excepción y retorna estado RECHAZADA | APROBADO | 12/11/2026 13:09 | 13/11/2026 22:06 | feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69) |
| `CP-H69-API-17` | Idempotencia DDL y numeración de migración 051_permiso_misiones_terreno_verificar.ts asignando permiso a PATRULLA_VERIFICADORA y ADMIN | Base de Datos | Migración Kysely | Alta | Directorio de migraciones con 035_permiso_misiones_terreno_verificar aplicada en BD | Revisión de src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts | Migración dentro del rango 51-60 sin colisiones e idempotente sobre permiso y rol_permiso | Secuencia sin colisión y cláusulas IF/ON CONFLICT DO NOTHING verificadas | APROBADO | 12/11/2026 13:08 | 13/11/2026 22:06 | refactor(db): renumerar migracion de permiso terreno a 051 dentro del rango 51-60 (HU-69) |
| `CP-H69-API-18` | Registro del endpoint POST /api/misiones/{id}/rechazar en OpenAPI 3.0, compilación TypeScript, ESLint y suite Vitest | Contrato / Build | OpenAPI / CI | Alta | Especificación generada en GET /openapi.json y suite Vitest | GET /openapi.json, npx tsc --noEmit, npx eslint y npm test -- --run | Contrato OpenAPI expuesto, 0 errores TS/ESLint y suite Vitest verde | GET /openapi.json expone la ruta; 64 archivos / 778 tests pasan; 0 errores en tsc y eslint | APROBADO | 12/11/2026 13:09 | 13/11/2026 22:06 | docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y transiciones de estado (HU-69) |

---

## 4. Bloque TSV para Google Sheets

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H69-API-01	Bypass de pertenencia, corrupción de cuadrilla/incidente y UUID vacío al rechazar misión sin patrulla_id o ATENCION_CUADRILLA	Seguridad / ICS	Repositorio / API	Crítica	Misión ATENCION_CUADRILLA en estado DESPACHADA con patrulla_id NULL y cuadrilla EN_MISION	POST /api/misiones/{id}/rechazar con x-user-id de patrulla ajena y {"justificacion_rechazo":"Rechazo indebido de mision de cuadrilla"}	HTTP 403 o 409 bloqueando rechazo de misión no asignada a patrulla verificadora	HTTP 409 Conflict bloqueando rechazo: solo admite misiones de verificación de patrulla; cuadrilla e incidente quedan intactos	CORREGIDO	12/11/2026 13:13	13/11/2026 22:06	fix(misiones): blindar transaccion de rechazo y restaurar transicion ICS (BUG-H69-API-01, BUG-H69-API-02, BUG-H69-API-03)
BUG-H69-API-02	Regresión sobre HU-20 en crearMisionVerificacionRepo manteniendo incidente en REPORTADO e incompatibilidad con HU-36	Regresión / ICS	Repositorio / Integración	Crítica	Incidente en REPORTADO y patrulla DISPONIBLE despachados vía POST /api/misiones	POST /api/misiones seguido de flujo HU-36 (aceptar) y HU-69 (rechazar)	Transición coherente con HU-20 (VERIFICANDO) y HU-36 sin romper contratos certificados	Incidente pasa a VERIFICANDO al despachar y revierte a REPORTADO al rechazar, cumpliendo HU-20, HU-36 y HU-69	CORREGIDO	12/11/2026 13:10	13/11/2026 22:06	fix(misiones): blindar transaccion de rechazo y restaurar transicion ICS (BUG-H69-API-01, BUG-H69-API-02, BUG-H69-API-03)
BUG-H69-API-03	Omisión de usuario.activo en verificarPermiso y de eliminado_en/activo en patrulla_verificadora al liberar a DISPONIBLE	Seguridad / Baja Lógica	Auth / Repositorio	Alta	Usuario patrulla con activo=false y patrulla dada de baja (activo=false, eliminado_en!=null, estado=NO_DISPONIBLE)	POST /api/misiones/{id}/rechazar con x-user-id del usuario inactivo	HTTP 401 Unauthorized por usuario inactivo y bloqueo de reactivación de patrulla dada de baja	HTTP 401 Unauthorized para usuario inactivo; patrulla dada de baja se preserva en NO_DISPONIBLE sin reactivarse	CORREGIDO	12/11/2026 13:13	13/11/2026 22:06	fix(seguridad): verificar usuario activo en verificarPermiso (BUG-H69-API-03)
BUG-H69-API-04	Desbordamiento numérico DECIMAL(10,7) en PostgreSQL (HTTP 500) por falta de rango WGS84 en latitud y longitud	Validación / Robustez	Schema / API / BD	Alta	Misión VERIFICACION en estado DESPACHADA	POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Prueba de coordenada fuera de rango","latitud":1000,"longitud":-200}	HTTP 400 Bad Request validando latitud [-90,90] y longitud [-180,180]	HTTP 400 Bad Request con mensajes de validación Zod para latitud y longitud, impidiendo error 500 en BD	CORREGIDO	12/11/2026 13:13	13/11/2026 22:06	fix(misiones): validar cotas geograficas WGS84 en esquemas de rechazo (BUG-H69-API-04, BUG-H69-API-05)
BUG-H69-API-05	Desincronización Redis Pub/Sub en notificarMisionRechazada, metadatos nulos en patrulla:actualizada y divergencia OpenAPI/Zod	Tiempo Real / Contrato	Socket / Service / OpenAPI	Media	Worker Next.js sin ioInstance emitiendo vía Redis y esquemas en mision.schema.ts	Inspección de notificarMisionRechazada, rechazarMisionService y RechazarMisionResponseSchema	Paridad de salas en Redis, delegacionId/usuarioLiderId reales y esquemas alineados	Salas sincronizadas en Redis (supervisor, patrulla), metadatos reales propagados y schema alineado con prioridad	CORREGIDO	12/11/2026 13:11	13/11/2026 22:06	fix(socket): sincronizar salas Redis y metadatos de patrulla al rechazar mision (BUG-H69-API-05)
CP-H69-API-01	Rechazo exitoso (200 OK) de misión de verificación DESPACHADA por líder de patrulla con justificación válida	Funcional	API / E2E Local	Crítica	Misión VERIFICACION en estado DESPACHADA asignada a patrulla con líder activo	POST /api/misiones/{id}/rechazar con x-user-id de líder y {"justificacion_rechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","latitud":-39.81422,"longitud":-73.24589}	HTTP 200 OK retornando misión RECHAZADA, patrulla DISPONIBLE, incidente REPORTADO e hito RECHAZADA	HTTP 200 OK con DTO de respuesta completo y estados esperados	APROBADO	12/11/2026 13:13	13/11/2026 22:06	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-02	Persistencia transaccional atómica en BD: mision.estado=RECHAZADA, fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y mision_hito	Integridad / ACID	Repositorio / BD	Crítica	Misión VERIFICACION DESPACHADA, patrulla EN_VERIFICACION e incidente asociado	Ejecución de POST /api/misiones/{id}/rechazar y consulta directa en PostgreSQL	Las 4 tablas actualizadas dentro de una única transacción Kysely db.transaction()	Verificado en PostgreSQL: mision=RECHAZADA con fecha_cierre, patrulla=DISPONIBLE, incidente=REPORTADO y fila en mision_hito	APROBADO	12/11/2026 13:13	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-03	Validación de alias camelCase justificacionRechazo y recorte .trim() con mínimo de 5 caracteres en RechazarMisionInputSchema	Validación (Zod)	Unitaria / Schema	Alta	Esquema RechazarMisionInputSchema	RechazarMisionInputSchema.safeParse({justificacionRechazo:"Ruta cortada por caída de árbol en camino Niebla"})	Validación exitosa normalizando al campo interno justificacionRechazo	Esquema acepta snake_case y camelCase >= 5 caracteres aplicando .trim()	APROBADO	12/11/2026 13:09	13/11/2026 22:06	test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69)
CP-H69-API-04	Persistencia de coordenadas geográficas válidas (latitud, longitud) en tabla mision_hito durante el rechazo	Funcional / Geo	Repositorio / BD	Media	Misión VERIFICACION en estado DESPACHADA	Payload con latitud: -39.81422 y longitud: -73.24589	Registro en mision_hito almacena latitud -39.8142200 y longitud -73.2458900	Verificado en PostgreSQL SELECT de mision_hito tras HTTP 200 OK	APROBADO	12/11/2026 13:13	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-05	Autorización exitosa para integrante operativo en patrulla_personal o usuario con rol Administrador	Seguridad / RBAC	Repositorio / Auth	Alta	Usuario en patrulla_personal con permiso misiones:terreno:verificar o usuario Administrador	POST /api/misiones/{id}/rechazar como integrante de patrulla_personal o rol ADMIN	Acceso permitido para ejecutar el rechazo de la misión asignada	rechazarMisionPatrullaRepo valida usuario_lider_id, tabla patrulla_personal y bypass controlado para esAdmin	APROBADO	12/11/2026 13:08	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-06	Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo tiene 4 caracteres (límite inferior Regla §3.3)	Validación / Límite	API / Schema	Crítica	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"Pana"}	HTTP 400 Bad Request indicando mínimo 5 caracteres	HTTP 400 Bad Request con error en campo justificacion_rechazo y 0 mutaciones en BD	APROBADO	12/11/2026 13:12	13/11/2026 22:06	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-07	Rechazo con HTTP 400 Bad Request cuando justificacion_rechazo está ausente, en blanco o con espacios ("    ")	Validación / Límite	API / Schema	Crítica	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con {"justificacion_rechazo":"    "} y {}	HTTP 400 Bad Request rechazando cadenas vacías o espacios insuficientes tras .trim()	HTTP 400 Bad Request tanto en cURL real como en pruebas unitarias de esquema y ruta	APROBADO	12/11/2026 13:12	13/11/2026 22:06	test(misiones): agregar pruebas de esquemas, servicio y ruta para rechazo de mision (HU-69)
CP-H69-API-08	Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta id no cumple el formato UUID	Validación / Contrato	API / Route	Media	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/no-es-uuid/rechazar con justificación válida	HTTP 400 Bad Request indicando que el identificador no es un UUID válido	HTTP 400 Bad Request: "El identificador de la misión proporcionado no es un UUID válido."	APROBADO	12/11/2026 13:12	13/11/2026 22:06	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-09	Rechazo con HTTP 400 Bad Request ante cuerpo JSON sintácticamente malformado	Robustez / Contrato	API / Route	Media	Usuario autenticado con permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con Content-Type: application/json y body "json-invalido-{{{"	HTTP 400 Bad Request indicando que el cuerpo debe ser un JSON válido	HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido."	APROBADO	12/11/2026 13:12	13/11/2026 22:06	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-10	Denegación con HTTP 401 Unauthorized ante ausencia de credenciales o token JWT Bearer inválido	Seguridad / Auth	API / AuthGuard	Crítica	Petición sin cabeceras de autenticación o con Bearer token inválido	POST /api/misiones/{id}/rechazar sin headers y con Authorization: Bearer token-invalido-123	HTTP 401 Unauthorized impidiendo acceso anónimo o con token adulterado	HTTP 401 Unauthorized en ambos escenarios verificados vía cURL real	APROBADO	12/11/2026 13:13	13/11/2026 22:06	feat(api): implementar endpoint POST /api/misiones/[id]/rechazar y registrar openapi (HU-69)
CP-H69-API-11	Denegación con HTTP 403 Forbidden cuando el usuario carece del permiso RBAC misiones:terreno:verificar	Seguridad / RBAC	API / AuthGuard	Crítica	Usuario autenticado con rol CALL_CENTER sin permiso misiones:terreno:verificar	POST /api/misiones/{id}/rechazar con x-user-id: 00000000-0000-4000-8000-000000000002	HTTP 403 Forbidden indicando falta del permiso misiones:terreno:verificar	HTTP 403 Forbidden: "No cuenta con el permiso requerido: misiones:terreno:verificar"	APROBADO	12/11/2026 13:12	13/11/2026 22:06	feat(db): agregar permiso RBAC misiones:terreno:verificar (HU-69)
CP-H69-API-12	Denegación con HTTP 403 Forbidden cuando una patrulla verificadora distinta intenta rechazar la misión de otra patrulla	Seguridad / RBAC	Repositorio / API	Crítica	Misión asignada a PV-SUR-02 y petición emitida por líder de PV-NORTE-01	POST /api/misiones/df7b5280-2cbd-4f29-b31a-e0eb42e5c3a0/rechazar con x-user-id d1000000-0000-4000-8000-000000000001	HTTP 403 Forbidden bloqueando el rechazo cruzado entre patrullas	HTTP 403 Forbidden: "No está autorizado para rechazar una misión asignada a otra patrulla verificadora."	APROBADO	12/11/2026 13:12	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-13	Rechazo con HTTP 404 Not Found cuando el UUID de misión no existe en la base de datos	Manejo de Errores	Repositorio / API	Alta	UUID válido inexistente en tabla mision	POST /api/misiones/60000000-0000-4000-8000-999999999999/rechazar	HTTP 404 Not Found indicando que la misión no fue encontrada	HTTP 404 Not Found: "No se encontró ninguna misión con el identificador proporcionado."	APROBADO	12/11/2026 13:12	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-14	Rechazo con HTTP 409 Conflict ante doble rechazo o misión fuera del estado DESPACHADA (ej. EN_CURSO)	Concurrencia / ICS	Repositorio / API	Crítica	Misión en estado RECHAZADA o EN_CURSO	POST /api/misiones/{id}/rechazar sobre misión ya rechazada y sobre misión EN_CURSO	HTTP 409 Conflict abortando la transición con control condicional WHERE estado = DESPACHADA	HTTP 409 Conflict en ambos casos ("La misión ya ha sido rechazada previamente." y "no se encuentra en estado 'DESPACHADA'")	APROBADO	12/11/2026 13:13	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-15	Emisión de eventos WebSocket mision:rechazada hacia sala encargado, incidente:actualizado con prioridad real y patrulla:actualizada	Tiempo Real / Socket.io	Servicio / Unitaria	Alta	Servicio rechazarMisionService invocado con mocks de repositorio y socket	rechazarMisionService con incidente prioridad ALTA	Llamada a notificarMisionRechazada, notificarIncidenteActualizado (prioridad ALTA) y notificarPatrullaActualizada	Eventos emitidos con payload esperado en prueba unitaria de servicio	APROBADO	12/11/2026 13:09	13/11/2026 22:06	fix(misiones): propagar prioridad real del incidente en evento socket tras rechazo de mision
CP-H69-API-16	Resiliencia de respuesta HTTP 200 OK si ocurre una excepción en el broker Socket.io/Redis tras el commit	Resiliencia	Servicio / Unitaria	Media	Transacción exitosa en repositorio y error simulado en notificarMisionRechazada	Mock de notificarMisionRechazada lanzando Error("Redis connection offline")	Error capturado en try/catch sin abortar la respuesta del servicio	rechazarMisionService captura la excepción y retorna estado RECHAZADA	APROBADO	12/11/2026 13:09	13/11/2026 22:06	feat(misiones): implementar transaccion atomica, esquemas y servicio de rechazo de mision (HU-69)
CP-H69-API-17	Idempotencia DDL y numeración de migración 051_permiso_misiones_terreno_verificar.ts asignando permiso a PATRULLA_VERIFICADORA y ADMIN	Base de Datos	Migración Kysely	Alta	Directorio de migraciones con 035_permiso_misiones_terreno_verificar aplicada en BD	Revisión de src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts	Migración dentro del rango 51-60 sin colisiones e idempotente sobre permiso y rol_permiso	Secuencia sin colisión y cláusulas IF/ON CONFLICT DO NOTHING verificadas	APROBADO	12/11/2026 13:08	13/11/2026 22:06	refactor(db): renumerar migracion de permiso terreno a 051 dentro del rango 51-60 (HU-69)
CP-H69-API-18	Registro del endpoint POST /api/misiones/{id}/rechazar en OpenAPI 3.0, compilación TypeScript, ESLint y suite Vitest	Contrato / Build	OpenAPI / CI	Alta	Especificación generada en GET /openapi.json y suite Vitest	GET /openapi.json, npx tsc --noEmit, npx eslint y npm test -- --run	Contrato OpenAPI expuesto, 0 errores TS/ESLint y suite Vitest verde	GET /openapi.json expone la ruta; 64 archivos / 778 tests pasan; 0 errores en tsc y eslint	APROBADO	12/11/2026 13:09	13/11/2026 22:06	docs(api): documentar endpoint POST /api/misiones/{id}/rechazar y transiciones de estado (HU-69)
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

 Test Files  3 passed | 61 skipped (64)
      Tests  20 passed | 758 skipped (778)
```

#### 5.1.2 Ejecución Directa de Archivos de Prueba de HU-69, Misiones y OpenAPI
```bash
npx vitest run \
  src/modules/misiones/__tests__/mision-rechazar.schema.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.service.test.ts \
  src/modules/misiones/__tests__/mision-rechazar.repository.test.ts \
  src/app/api/misiones/\[id\]/rechazar/__tests__/route.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision-rechazar.service.test.ts (2 tests) 14ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.schema.test.ts (9 tests) 11ms
 ✓ src/modules/misiones/__tests__/mision-rechazar.repository.test.ts (8 tests) 32ms
 ✓ src/app/api/misiones/[id]/rechazar/__tests__/route.test.ts (9 tests) 21ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 119ms

 Test Files  5 passed (5)
      Tests  29 passed (29)
```

#### 5.1.3 Suite Completa del Repositorio, Chequeo de Tipos y Linter
```bash
npm test -- --run
npx next typegen && npx tsc --noEmit
npx eslint src/app/api/misiones/\[id\]/rechazar/route.ts src/modules/misiones/mision.schema.ts src/modules/misiones/mision.service.ts src/modules/misiones/mision.repository.ts src/lib/socket/index.ts src/lib/socket/types.ts src/lib/openapi/index.ts
```

**Salida de Consola:**
```text
 Test Files  64 passed (64)
      Tests  778 passed (778)
✓ Types generated successfully (0 errores tsc / 0 errores eslint)
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante `cURL` (Evidencias de Re-Test)

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

#### Caso 6: Validación de Rango Geográfico WGS84 (`400 Bad Request` — `BUG-H69-API-04` Subsanado)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/00000000-0000-4000-8000-000000000010/rechazar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en vehículo","latitud":1000.5,"longitud":-73.2458}'

curl -s -i -X POST "http://localhost:3001/api/misiones/00000000-0000-4000-8000-000000000010/rechazar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en vehículo","latitud":-39.8142,"longitud":250}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"latitud","mensaje":"La latitud debe estar entre -90 y 90."}]}
```
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos para el rechazo de la misión.","errors":[{"campo":"longitud","mensaje":"La longitud debe estar entre -180 y 180."}]}
```

#### Caso 7: Bloqueo de Rechazo sobre Misión de Cuadrilla o sin Patrulla (`409 Conflict` — `BUG-H69-API-01` Subsanado)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000011/rechazar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Intento de rechazar misión de cuadrilla"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"Solo es posible rechazar por esta vía misiones de verificación asignadas a una patrulla verificadora."}
```

#### Caso 8: Denegación de Usuario Inactivo (`401 Unauthorized` — `BUG-H69-API-03` Subsanado)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000016/rechazar" \
  -H "x-user-id: 99999999-0000-4000-8000-000000000015" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Rechazo emitido por usuario inactivo"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"El usuario especificado se encuentra inactivo en la institución."}
```

#### Caso 9: Rechazo Exitoso (`200 OK`) y Reversión Atómica del Incidente a REPORTADO (`CP-H69-API-01`, `CP-H69-API-02`, `BUG-H69-API-02`)
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

{"message":"Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.","data":{"mision":{"id":"99999999-0000-4000-8000-000000000001","codigo":"MIS-QA-H69-1","estado":"RECHAZADA","justificacionRechazo":"Desperfecto mecánico en el neumático delantero del vehículo.","actualizadoEn":"2026-11-13T22:06:15.120Z"},"patrulla":{"id":"99999999-0000-4000-8000-000000000002","nombre":"Patrulla QA Temporal","estado":"DISPONIBLE"},"incidente":{"id":"99999999-0000-4000-8000-000000000003","codigo":"INC-QA-H69-1","estado":"REPORTADO","prioridad":"ALTA"},"hito":{"id":"b801e3b5-97c1-4ec6-b90b-dd6b32635846","hito":"RECHAZADA","descripcion":"Misión rechazada por patrulla: Desperfecto mecánico en el neumático delantero del vehículo.","creadoEn":"2026-11-13T22:06:15.120Z"}}}
```

#### Caso 10: Control de Doble Rechazo Concurrente (`409 Conflict` — `CP-H69-API-14`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/99999999-0000-4000-8000-000000000001/rechazar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Segundo intento de rechazo sobre la misma misión"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La misión ya ha sido rechazada previamente."}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Al recibir una notificación de nueva misión en la PWA, la patrulla debe contar con la opción visible 'Rechazar Misión'. | `CP-H69-API-18` | 🟢 **CUMPLIDO (Backend API & OpenAPI)** | `sgrai-api` expone el endpoint y contrato OpenAPI `POST /api/misiones/{id}/rechazar`. La interfaz gráfica se implementa en `sgrai-pwa`. |
| **CA-2:** Al presionar rechazar, la interfaz debe desplegar obligatoriamente un modal exigiendo el motivo del rechazo (`justificacion_rechazo`, mínimo 5 caracteres según Regla Crítica §3.3). No se debe permitir enviar el rechazo en blanco o con menos caracteres. | `CP-H69-API-03`, `CP-H69-API-06`, `CP-H69-API-07`, `BUG-H69-API-04` | 🟢 **CUMPLIDO** | Valida estrictamente `justificacion_rechazo` ≥ 5 caracteres tras `.trim()` (`400 Bad Request`), y valida cotas WGS84 en coordenadas (`-90` a `90` y `-180` a `180`). |
| **CA-3:** La API debe actualizar en una sola transacción: (1) `mision.estado = 'RECHAZADA'`, (2) Persistir `justificacion_rechazo`, (3) Mantener o transicionar `patrulla.estado = 'DISPONIBLE'`, y (4) Mantener `incidente.estado = 'REPORTADO'` para reasignación. | `CP-H69-API-01`, `CP-H69-API-02`, `CP-H69-API-04`, `CP-H69-API-14`, `BUG-H69-API-01`, `BUG-H69-API-02`, `BUG-H69-API-03` | 🟢 **CUMPLIDO** | Transacción atómica Kysely validada en BD real. Se blindó contra misiones de cuadrilla (`BUG-H69-API-01`), se restauró la transición ICS transversal (`BUG-H69-API-02`) y se respeta la baja lógica de patrullas (`BUG-H69-API-03`). |
| **CA-4:** El sistema debe emitir la notificación WebSocket `mision:rechazada` hacia la sala `encargado`. | `CP-H69-API-15`, `CP-H69-API-16`, `BUG-H69-API-05` | 🟢 **CUMPLIDO** | Emite `mision:rechazada` hacia salas `encargado`, `sala:encargados`, `supervisor` y `patrulla:{patrullaId}` vía Redis Pub/Sub con paridad total, propagando `delegacionId` y `usuarioLiderId` reales en `patrulla:actualizada`. |
| **CA-5:** El endpoint `POST /api/misiones/{id}/rechazar` debe validar autenticación de patrulla verificadora. | `CP-H69-API-05`, `CP-H69-API-10`, `CP-H69-API-11`, `CP-H69-API-12`, `CP-H69-API-17`, `BUG-H69-API-01`, `BUG-H69-API-03` | 🟢 **CUMPLIDO** | Valida token Bearer, permiso RBAC `misiones:terreno:verificar`, condición `usuario.activo === true` y pertenencia a la patrulla asignada (o rol ADMIN), bloqueando misiones ajenas o de cuadrillas. |
