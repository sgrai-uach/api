# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-70 — Transmisión y Retransmisión de Telemetría GPS en Terreno (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Geolocalización, Misiones y Tiempo Real (`sgrai-api` — Socket.io, Redis Cache/PubSub y `GET /api/geolocalizacion/posiciones`).  
> **Historia de Usuario:** HU-70 — *"Como Delegado de cuadrilla / Patrulla verificadora Quiero que mi dispositivo móvil transmita automáticamente mis coordenadas geográficas en segundo plano mientras me encuentro en misión activa Para que el Centro de Mando visualice la posición en tiempo real de las unidades en el mapa y optimice los tiempos de respuesta y despacho."*  
> **Desarrollador Asignado:** DsAlenRupailaf  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Redis 7 + ioredis 6.0 + Socket.io 4.8 + Zod + OpenAPI 3.0 + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H70-telemetria-gps-terreno`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(redis): implementar cliente ioredis y servicio de cache para telemetria`  
> * `feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto`  
> * `feat(socket): incorporar listener de telemetria con broker redis pubsub y retransmision a sala mapa`  
> * `feat(api): implementar endpoint get de consulta de ultimas posiciones y registrar openapi`  
> * `test(telemetria): agregar pruebas unitarias de esquemas y pruebas de integracion socket y redis`  
> * `docs(api): documentar protocolo websocket y endpoint rest de telemetria en misiones.md`  
> * `docs(qa): documentar casos de prueba para hu-70`  
> * `style(geolocalizacion): normalizar saltos de linea y formato de archivos`  
> * `merge: sincronizar origin/develop en feature/H70-telemetria-gps-terreno resolviendo conflictos de socket, openapi y docs`  
> * `fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70)`  
> * `fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)`  
> * `fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70)`  
> * `test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70)`  
> * `docs(api): actualizar protocolo de telemetria, RBAC y eventos telemetria:inactiva en misiones.md (HU-70)`  
>  
> **Fecha de Auditoría Inicial:** 24/11/2026 23:45.  
> **Fecha de Re-Test y Certificación Final:** 25/11/2026 00:01.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Cumplidos — 7 Defectos Subsanados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la inspección forense de código fuente, revisión de reglas de negocio del Sistema de Comando de Incidentes (ICS), controles de seguridad JWT/RBAC, persistencia volátil y Pub/Sub en Redis 7, contratos OpenAPI 3.0, pruebas automatizadas en Vitest y ejecución en vivo contra PostgreSQL 16 y Redis 7 sobre la rama `feature/H70-telemetria-gps-terreno`, se dictamina el estado **CERTIFICADO / APROBADO** al comprobarse la resolución íntegra de los **7 defectos reales** detectados durante la auditoría inicial (`BUG-H70-API-01` a `BUG-H70-API-07`).

### Verificación de Correcciones en Re-Test (25/11/2026 00:01)

1. **Seguridad Socket.io, Pertenencia y Reglas ICS de Misión Activa (`BUG-H70-API-01` — Resuelto):** Se implementaron `verificarHabilitacionTelemetriaUnidadRepo` (`src/modules/geolocalizacion/telemetria.repository.ts`) y `procesarTelemetriaPosicionService` (`src/modules/geolocalizacion/telemetria.service.ts`) exigiendo sesión JWT autenticada, usuario activo, pertenencia a la patrulla/cuadrilla (o perfil `ADMIN`), unidad no `DISPONIBLE` y misión en estado `EN_CURSO`. Se restringió además el acceso anónimo (`join`/`unirse`) a salas operativas (`mapa`, `encargado`, `supervisor`, `patrulla:*`, `cuadrilla:*`) y se conectó la purga automática de telemetría con evento `telemetria:inactiva` al liberarse una unidad a `DISPONIBLE`.
2. **Control RBAC en `GET /api/geolocalizacion/posiciones` (`BUG-H70-API-02` — Resuelto):** `listarPosicionesActivasService` exige permiso `misiones:leer` (o perfil `Administrador`) verificando usuario activo en PostgreSQL mediante `verificarPermiso`, devolviendo `401 Unauthorized` o `403 Forbidden` según corresponda, e incorporando validación Zod de filtros opcionales (`tipoUnidad`, `unidadId`) con respuesta `400 Bad Request`.
3. **Broker Redis Pub/Sub Multi-Instancia y Handler Desacoplado (`BUG-H70-API-03` — Resuelto):** Se extrajo la capa Socket.io a `src/lib/socket/telemetria.handler.ts` y se incorporó `emitirYPropagarPorRedis` con `originInstanceId` (`SOCKET_INSTANCE_ID`) en `src/lib/socket/index.ts`, garantizando replicación multi-instancia sin emisiones duplicadas en el nodo de origen.
4. **Sincronización con `origin/develop`, SemVer y Esquema OpenAPI `BearerAuth` (`BUG-H70-API-04` — Resuelto):** Se integró `origin/develop` preservando `notificacion:ack` y el resto de contratos recientes, se corrigió el esquema de seguridad de `bearerAuth` a `BearerAuth`, se registraron todos los esquemas de telemetría en `components.schemas` con respuestas `200`, `400`, `401`, `403` y `500`, y se actualizó SemVer a `0.13.0`.
5. **Validación Estricta de `timestamp` y Finitud Numérica en Zod (`BUG-H70-API-05` — Resuelto):** Se incorporó `TimestampTelemetriaSchema` con `superRefine` y `.finite()` en todos los campos numéricos de `TelemetriaPosicionPayloadSchema`, evitando excepciones `RangeError` y enmascaramientos silenciosos ante marcas temporales corruptas.
6. **Confiabilidad de Pipeline Redis, Monotonicidad Temporal y Purga Inmediata (`BUG-H70-API-06` — Resuelto):** Se agregó `enableOfflineQueue: false` en `src/lib/redis/index.ts`, verificación de errores por comando en `pipeline.exec()`, control de monotonicidad para omitir tramas GPS atrasadas tras reconexión, ordenamiento determinista y `eliminarPosicionUnidad`.
7. **Pruebas Reales con Simulador Socket.io y Estándar Documental QA (`BUG-H70-API-07` — Resuelto):** Se implementaron pruebas de integración Socket.io end-to-end con simulador de coordenadas WebSocket, verificación en vivo contra PostgreSQL 16 y Redis 7, y documentación formal bajo estándar institucional de 13 columnas.

| Métrica de Calidad | Auditoría Inicial (24/11/2026) | Re-Test Final (25/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | 25 | **25** | 7 Defectos Subsanados (`BUG-H70-API-01` a `07`) + 18 Casos Funcionales, Seguridad, Redis, Socket.io y OpenAPI (`CP-H70-API-01` a `18`) |
| **Casos Aprobados / Corregidos** | 18 | **25** | 100% de casos aprobados y defectos corregidos y certificados |
| **Defectos Abiertos / Fallidos** | 7 | **0** | 7/7 defectos resueltos y verificados en Re-Test |
| **Casos Bloqueados** | 0 | **0** | Sin bloqueos de entorno (PostgreSQL 16 y Redis 7 saludables en Docker) |
| **Tasa de Aprobación (% Pass)** | 72.0% | **100.0%** | Cumplimiento íntegro de criterios de aceptación para integración en `develop` |
| **Suite Focalizada HU-70 (Vitest)** | 14/14 tests | **33/33 tests** | 6 archivos: `telemetria.schema` (8), `telemetria-cache` (5), `telemetria.service` (7), `posiciones/route` (6), `socket/telemetria` (6), `openapi.json` (1) |
| **Suite Global de Regresión (Vitest)** | 793/793 tests | **1040/1040 tests** | 99/99 archivos de prueba aprobados tras sincronización con `origin/develop` |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | 0 errores | **0 errores / 0 warnings** | Compilación limpia y código libre de advertencias |

---

## 2. Registro Técnico de Defectos Subsanados

### `BUG-H70-API-01`: Ausencia de Autenticación Obligatoria en Eventos/Salas Socket.io y Omisión de Validación de Pertenencia y Estado `EN_CURSO` (CA-1 y CA-4)
* **Severidad:** **CRÍTICA** (Seguridad / Spoofing de Coordenadas y Reglas de Negocio ICS).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/server.ts`, `src/lib/socket/telemetria.handler.ts`, `src/modules/geolocalizacion/telemetria.repository.ts`, `src/modules/geolocalizacion/telemetria.service.ts`, `src/modules/misiones/mision.service.ts`, `src/modules/recursos-y-personal/patrulla.service.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  El middleware JWT en `src/server.ts` omitía la validación cuando un cliente se conectaba sin token, permitiendo suscripciones anónimas a la sala `mapa` y emisión anónima de `telemetria:posicion` para cualquier `unidadId`. Además, el servidor aceptaba y retransmitía posiciones aun cuando el emisor no pertenecía a la unidad o esta ya se encontraba en estado `DISPONIBLE` sin misión `EN_CURSO`, manteniendo marcadores residuales en Redis hasta por 300 segundos.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se bloqueó el ingreso anónimo a salas operativas restringidas (`esSalaRestringida`), se exigió `socket.data.userId` en `telemetria:posicion` y `telemetria:detener`, se validó en PostgreSQL que el usuario esté activo, pertenezca a la patrulla/cuadrilla (o sea `ADMIN`) y que la unidad no esté `DISPONIBLE` con misión `EN_CURSO`. Al retornar a `DISPONIBLE` o rechazar/finalizar misión, se purga la clave en Redis y se emite `telemetria:inactiva` hacia la sala `mapa`.

### `BUG-H70-API-02`: Omisión de Validación RBAC (`misiones:leer`) y de Vigencia del Usuario en `GET /api/geolocalizacion/posiciones`
* **Severidad:** **CRÍTICA** (Seguridad / Autorización RBAC).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/app/api/geolocalizacion/posiciones/route.ts`, `src/modules/geolocalizacion/telemetria.service.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  El endpoint solo verificaba la firma del JWT mediante `extraerUsuarioId` sin consultar si el usuario seguía activo en base de datos ni exigir permiso RBAC, exponiendo la ubicación en vivo de unidades municipales a roles sin acceso operativo (ej. `CALL_CENTER`) y a cuentas desactivadas con JWT vigente.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se delegó la consulta a `listarPosicionesActivasService`, que valida el usuario activo y el permiso `misiones:leer` (o perfil `Administrador`) mediante `verificarPermiso`, devolviendo `401 Unauthorized` o `403 Forbidden`, además de validar con Zod (`ListarPosicionesQuerySchema`) los filtros opcionales `tipoUnidad` y `unidadId` (`400 Bad Request`).

### `BUG-H70-API-03`: Retransmisión de Telemetría Aislada en Memoria Local sin Replicación por Broker Redis Pub/Sub Multi-Instancia y Handler Acoplado en `src/server.ts`
* **Severidad:** **ALTA** (Arquitectura en Tiempo Real y Testabilidad).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/server.ts`, `src/lib/socket/index.ts`, `src/lib/socket/types.ts`, `src/lib/socket/telemetria.handler.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  El listener `telemetria:posicion` en `src/server.ts` emitía solo vía `io.to("mapa").emit(...)` sin publicar en el canal Redis `sgrai:socket-events`, mientras `emitirEvento` en `src/lib/socket/index.ts` retornaba tempranamente cuando `ioInstance` existía, impidiendo la difusión hacia otras instancias en despliegues escalados. Además, la lógica inline en `src/server.ts` impedía ejecutar pruebas automatizadas reales sobre el handler.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se desacopló la gestión de middleware JWT, salas y telemetría en `src/lib/socket/telemetria.handler.ts` y se incorporó `emitirYPropagarPorRedis` con identificador de nodo `originInstanceId = SOCKET_INSTANCE_ID`. El suscriptor Redis en `procesarMensajeRedisSocket` filtra sus propios mensajes para evitar duplicación local mientras garantiza entrega inmediata al resto de instancias.

### `BUG-H70-API-04`: Desincronización con `origin/develop`, Regresión SemVer (`0.11.0` vs `0.12.0`) y Referencia Inválida `bearerAuth` en OpenAPI
* **Severidad:** **ALTA** (Integración, Contrato OpenAPI y Versionado).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `package.json`, `src/lib/openapi/index.ts`, `src/server.ts`, `src/lib/socket/types.ts`, `src/lib/socket/index.ts`, `docs/api/misiones.md`.
* **Descripción Técnica del Defecto Inicial:**  
  La ruta `/api/geolocalizacion/posiciones` declaraba `security: [{ bearerAuth: [] }]` (minúscula), incompatible con el esquema oficial `BearerAuth` registrado en `components.securitySchemes` de `origin/develop`, omitía el registro de componentes de esquema y respuestas `400`/`403`, y la rama presentaba desfase respecto a `origin/develop` (`0.12.0`).
* **Solución Aplicada y Verificada en Re-Test:**  
  Se integró `origin/develop` resolviendo todos los conflictos sin pérdida de funcionalidad (`notificacion:ack`, eventos y rutas recientes), se alineó el esquema de seguridad a `BearerAuth`, se registraron `TelemetriaPosicionPayload`, `TelemetriaInactivaPayload`, `ListarPosicionesQuery`, `PosicionUnidadActiva` y `PosicionesActivasResponse` en OpenAPI, y se elevó la versión SemVer a `0.13.0`.

### `BUG-H70-API-05`: Excepción No Controlada `RangeError` y Enmascaramiento Silencioso de `timestamp` Inválido en Esquema Zod
* **Severidad:** **MEDIA** (Validación de Datos y Estabilidad).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/geolocalizacion/telemetria.schema.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  Al recibir un `timestamp` numérico fuera de rango (`9e18`, `NaN`, `Infinity`), `new Date(val).toISOString()` dentro de `.transform()` arrojaba `RangeError: Invalid time value` fuera del `try/catch` del listener. Adicionalmente, cadenas malformadas (`"no-es-una-fecha"`) eran aceptadas silenciosamente reemplazándolas por la fecha actual.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se reemplazó la transformación por `TimestampTelemetriaSchema` con validación previa vía `superRefine` (rango 2000–2100 y fecha válida) y `.finite()` en `lat`, `lng`, `rumbo`, `precision` y `velocidad`, garantizando rechazo limpio en `safeParse()`.

### `BUG-H70-API-06`: Falta de Validación de Errores en `pipeline.exec()` de Redis, Ausencia de Control de Paquetes Desordenados y Sin Purga Inmediata
* **Severidad:** **MEDIA** (Persistencia Volátil y Consistencia en Terreno).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/lib/redis/index.ts`, `src/modules/geolocalizacion/telemetria-cache.service.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  `guardarPosicionUnidad` no inspeccionaba errores por comando devueltos por `pipeline.exec()` en `ioredis`, sobrescribía coordenadas recientes con tramas GPS más antiguas tras reconexiones de red móvil y carecía de función `eliminarPosicionUnidad` para retirar unidades que volvían a `DISPONIBLE`.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se configuró `enableOfflineQueue: false` y reconexión en `status === "end"` en `src/lib/redis/index.ts`, se inspeccionaron las tuplas `[err, result]` de `pipeline.exec()` activando fallback en memoria ante error, se implementó control de monotonicidad por `timestamp` y se agregó `eliminarPosicionUnidad` junto con ordenamiento descendente por `recibidoEn`.

### `BUG-H70-API-07`: Cobertura Insuficiente de Integración Socket.io con Simulador de Coordenadas y Ausencia de Matriz QA Estándar
* **Severidad:** **MEDIA** (Aseguramiento de Calidad y Trazabilidad).
* **Estado Post Re-Test (25/11/2026 00:01):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/lib/socket/__tests__/telemetria.test.ts`, `docs/qa/HU70_TELEMETRIA_GPS_TERRENO_CASOS_DE_PRUEBA.md`.
* **Descripción Técnica del Defecto Inicial:**  
  Las pruebas iniciales solo verificaban un mock de `ioInstance` sin levantar un servidor Socket.io real ni simular clientes emisor/receptor de coordenadas, y el documento de QA carecía de matriz consolidada de 13 columnas, bloque TSV y evidencias replicables Vitest/cURL.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se implementó un simulador real de clientes Socket.io v4 sobre WebSocket en `src/lib/socket/__tests__/telemetria.test.ts`, se ejecutaron verificaciones en vivo contra PostgreSQL 16 y Redis 7 y se consolidó el informe técnico completo en `docs/qa/HU70_TELEMETRIA_GPS_TERRENO_CASOS_DE_PRUEBA.md`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H70-API-01` | Bloqueo de spoofing anónimo en sala mapa y validación de pertenencia + misión EN_CURSO en telemetria:posicion | Seguridad / ICS | Socket.io / Servicio / BD | Crítica | Servidor Socket.io activo con BD PostgreSQL y unidad en estado DISPONIBLE o sin pertenencia | Cliente sin JWT emitiendo join("mapa") y telemetria:posicion; cliente autenticado emitiendo para unidad ajena o en estado DISPONIBLE | join("mapa") anónimo rechazado; telemetria:posicion sin JWT responde NO_AUTENTICADO; unidad DISPONIBLE responde UNIDAD_DISPONIBLE, purga Redis y emite telemetria:inactiva | Anónimo bloqueado en mapa y telemetría; unidad DISPONIBLE (delta) rechazada con UNIDAD_DISPONIBLE y clave purgada | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70) |
| `BUG-H70-API-02` | Exigencia de permiso RBAC misiones:leer y usuario activo en GET /api/geolocalizacion/posiciones | Seguridad / RBAC | API / AuthService | Crítica | Usuario con rol CALL_CENTER sin permiso misiones:leer y usuario ENCARGADO con permiso | GET /api/geolocalizacion/posiciones con Authorization: Bearer <TOKEN_CALL_CENTER> | HTTP 403 Forbidden indicando ausencia del permiso requerido misiones:leer | HTTP 403 Forbidden: "No cuenta con el permiso requerido: misiones:leer" verificado en Vitest y servidor en vivo | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70) |
| `BUG-H70-API-03` | Propagación multi-instancia por broker Redis Pub/Sub con originInstanceId sin duplicación local | Tiempo Real / Redis | Infraestructura / Socket | Alta | Instancia Socket.io activa junto a publicador/suscriptor Redis en canal sgrai:socket-events | Emisión notificarTelemetriaPosicion y recepción en procesarMensajeRedisSocket con mismo y distinto originInstanceId | Emite localmente a mapa, publica en sgrai:socket-events con originInstanceId; descarta eco propio y retransmite mensajes de otras instancias | Retransmisión local y publicación Redis con originInstanceId verificadas; deduplicación aprobada en pruebas | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70) |
| `BUG-H70-API-04` | Sincronización con origin/develop, alineación de esquema BearerAuth OpenAPI y SemVer 0.13.0 | Contrato API / Integración | OpenAPI / Git | Alta | Rama feature/H70-telemetria-gps-terreno sincronizada con origin/develop | GET /openapi.json verificando info.version, securitySchemes.BearerAuth y paths["/api/geolocalizacion/posiciones"] | Versión 0.13.0, security: [{ BearerAuth: [] }], esquemas de telemetría en components.schemas y respuestas 200/400/401/403/500 | OpenAPI 3.0 en versión 0.13.0 con BearerAuth y todos los códigos y esquemas registrados sin regresiones | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70) |
| `BUG-H70-API-05` | Rechazo seguro de timestamp corrupto o epoch fuera de rango sin lanzar RangeError en Zod | Validación (Zod) | Schema | Media | Esquema TelemetriaPosicionPayloadSchema | Payloads con timestamp "no-es-una-fecha", "", 9e18, -1, NaN e Infinity | safeParse retorna success: false sin lanzar excepciones no controladas | Todos los timestamps corruptos y numéricos no finitos rechazados limpiamente por TimestampTelemetriaSchema | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70) |
| `BUG-H70-API-06` | Detección de fallos en pipeline.exec() de Redis, protección contra paquetes GPS desordenados y purga inmediata | Resiliencia / Caché | Servicio / Redis | Media | Caché de telemetría con posición previa T2 y llegada tardía de trama T1 < T2 o error en pipeline Redis | guardarPosicionUnidad con T1 < T2; mock pipeline.exec retornando [Error, null]; eliminarPosicionUnidad | Trama atrasada omitida (actualizada: false); fallo de pipeline activa fallback en memoria; eliminación purga clave y Set | Monotonicidad, fallback por error de pipeline y purga inmediata verificados en Vitest y Redis real | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70) |
| `BUG-H70-API-07` | Pruebas reales de integración Socket.io con simulador de coordenadas y matriz QA institucional | Integración / QA | Socket.io / Documentación | Media | Servidor Socket.io levantado en entorno Vitest y servidor live con PostgreSQL 16 y Redis 7 | SimuladorSocketIOClient emitiendo telemetria:posicion y telemetria:detener hacia sala mapa | Retransmisión real verificada extremo a extremo y evidencia completa en informe QA | 6 tests de Socket.io (incluyendo simulador WebSocket real) y verificación E2E live aprobados al 100% | CORREGIDO | 24/11/2026 23:45 | 25/11/2026 00:01 | test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70) |
| `CP-H70-API-01` | Validación exitosa de payload completo de patrulla con rumbo, precisión y velocidad | Validación (Zod) | Unitaria / Schema | Alta | Esquema TelemetriaPosicionPayloadSchema | {unidadId:"f1000000-0000-4000-8000-000000000001", tipoUnidad:"PATRULLA", lat:-39.81422, lng:-73.24589, timestamp:"2026-11-24T15:00:00.000Z", rumbo:180.5, precision:12.3, velocidad:4.5} | safeParse retorna success: true preservando todas las métricas | Validación exitosa con campos tipados y preservados correctamente | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto |
| `CP-H70-API-02` | Validación exitosa de payload mínimo de cuadrilla normalizando timestamp numérico epoch a ISO 8601 | Validación (Zod) | Unitaria / Schema | Alta | Esquema TelemetriaPosicionPayloadSchema | {unidadId:"50000000-0000-4000-8000-000000000001", tipoUnidad:"CUADRILLA", lat:-39.825, lng:-73.238, timestamp:1731423600000} | safeParse exitoso con timestamp transformado a "2024-11-12T15:00:00.000Z" y opcionales undefined | Validación exitosa y normalización ISO 8601 verificada | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70) |
| `CP-H70-API-03` | Rechazo de unidadId no UUID y tipoUnidad fuera del catálogo canónico | Validación (Zod) | Unitaria / Schema | Media | Esquema TelemetriaPosicionPayloadSchema | unidadId:"patrulla-123" o tipoUnidad:"HELICOPTERO" | safeParse retorna success: false con mensaje de error por campo | Ambos casos rechazados por Zod | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto |
| `CP-H70-API-04` | Rechazo de coordenadas fuera del estándar WGS84 (-90..90, -180..180) o valores no finitos | Límite / Validación | Unitaria / Schema | Alta | Esquema TelemetriaPosicionPayloadSchema | lat:-95.0; lng:185.0; lat:NaN; lng:Infinity | safeParse rechaza todas las coordenadas fuera de rango o no finitas | Las 4 variantes inválidas fueron rechazadas por Zod | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70) |
| `CP-H70-API-05` | Rechazo de rumbo fuera de 0..360 o precisión negativa | Límite / Validación | Unitaria / Schema | Media | Esquema TelemetriaPosicionPayloadSchema | rumbo:-5, precision:-1; rumbo:361 | safeParse retorna success: false | Rechazo verificado para métricas negativas y rumbo > 360 | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto |
| `CP-H70-API-06` | Persistencia y recuperación de posición en caché Redis con TTL de 300 segundos | Funcional / Caché | Integración / Redis | Crítica | Redis operativo o caché en memoria inicializada | guardarPosicionUnidad para PATRULLA f1000000-0000-4000-8000-000000000001 | Registro persistido con campo recibidoEn y TTL 300s, recuperable por obtenerPosicionUnidad | Posición persistida y recuperada con coordenadas, rumbo y recibidoEn íntegros | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(redis): implementar cliente ioredis y servicio de cache para telemetria |
| `CP-H70-API-07` | Consulta de unidad sin registros vigentes retorna null sin excepción | Manejo de Errores | Unitaria / Caché | Media | Caché limpia sin registros para el UUID consultado | obtenerPosicionUnidad("CUADRILLA", "00000000-0000-4000-8000-000000000000") | Retorna null sin lanzar error | Retorna null correctamente | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(redis): implementar cliente ioredis y servicio de cache para telemetria |
| `CP-H70-API-08` | Listado consolidado, filtrado por tipoUnidad/unidadId y purga individual de posiciones activas | Funcional / Caché | Unitaria / Caché | Alta | 1 patrulla y 1 cuadrilla almacenadas en caché activa | obtenerTodasLasPosicionesActivas({tipoUnidad:"PATRULLA"}) y eliminarPosicionUnidad("PATRULLA", id) | Filtro retorna solo patrulla; tras eliminar, queda solo la cuadrilla | Filtrado y eliminación verificados correctamente | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70) |
| `CP-H70-API-09` | Emisión y retransmisión en vivo de telemetria:posicion desde unidad en misión EN_CURSO hacia sala mapa | Funcional / Tiempo Real | Integración / Socket.io | Crítica | Encargado conectado en sala mapa y Delegado/Patrulla autenticado con misión EN_CURSO | Evento telemetria:posicion con {unidadId:"c1000000-0000-4000-8000-000000000001", tipoUnidad:"CUADRILLA", lat:-39.81422, lng:-73.24589, rumbo:180.5, precision:10.5} | Callback {ok:true}, cliente en mapa recibe telemetria:posicion enriquecido con recibidoEn y registro disponible en Redis | Evento recibido en tiempo real en sala mapa y persistido en Redis live | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70) |
| `CP-H70-API-10` | Rechazo de conexión Socket.io en handshake cuando el token JWT está corrupto o expirado | Seguridad / Auth | Integración / Socket.io | Crítica | Middleware registrarMiddlewareAuthSocket activo | Handshake WebSocket con auth:{token:"token.invalido.123"} | Conexión rechazada con error de autenticación inválida | Handshake rechazado con paquete Socket.io CONNECT_ERROR (44) | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70) |
| `CP-H70-API-11` | Conservación de acceso abierto a salas públicas de seguimiento ciudadano (seguimiento:{codigo}) | Regresión / Seguridad | Integración / Socket.io | Alta | Cliente ciudadano anónimo conectado al servidor Socket.io | Evento join("seguimiento:12345678") sin token JWT | Suscripción permitida con callback {ok:true} sin afectar seguimiento público | join a seguimiento:12345678 responde {ok:true} mientras mapa sigue restringida | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70) |
| `CP-H70-API-12` | Descarte silencioso de payload malformado en telemetria:posicion sin desconectar al cliente | Resiliencia / Robustez | Integración / Socket.io | Alta | Cliente PWA autenticado conectado | Evento telemetria:posicion con {unidadId:"invalido", lat:999, lng:0, timestamp:"bad"} | Callback {ok:false, codigo:"PAYLOAD_INVALIDO"}, cero emisión a mapa y socket operativo | Payload descartado con PAYLOAD_INVALIDO manteniendo la conexión activa para tramas posteriores | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70) |
| `CP-H70-API-13` | Pausa explícita mediante telemetria:detener purgando Redis y emitiendo telemetria:inactiva a sala mapa | Funcional / CA-4 | Integración / Socket.io | Crítica | Unidad con posición activa en Redis y operador suscrito a sala mapa | Evento telemetria:detener {unidadId:"c1000000-0000-4000-8000-000000000001", tipoUnidad:"CUADRILLA", motivo:"MISION_FINALIZADA"} | Callback {ok:true}, sala mapa recibe telemetria:inactiva y GET /api/geolocalizacion/posiciones retorna data: [] | telemetria:inactiva recibido en mapa y GET posterior retorna 200 OK con data: [] | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70) |
| `CP-H70-API-14` | Rechazo con HTTP 401 Unauthorized en GET /api/geolocalizacion/posiciones sin token o con token expirado | Seguridad / Auth | API / Route | Crítica | Endpoint GET /api/geolocalizacion/posiciones activo | GET /api/geolocalizacion/posiciones sin cabecera Authorization y con token corrupto | HTTP 401 Unauthorized en ambos escenarios | HTTP 401: "Se requiere cabecera de autenticación Authorization: Bearer <token>." | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(api): implementar endpoint get de consulta de ultimas posiciones y registrar openapi |
| `CP-H70-API-15` | Rechazo con HTTP 400 Bad Request ante query params inválidos en GET /api/geolocalizacion/posiciones | Validación (Zod) | API / Route | Media | Usuario ENCARGADO autenticado | GET /api/geolocalizacion/posiciones?tipoUnidad=INVALIDO&unidadId=no-uuid con JWT válido | HTTP 400 Bad Request listando errores de validación en errors | HTTP 400 con message "Parámetros de consulta inválidos para posiciones de telemetría." y detalle de campos | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70) |
| `CP-H70-API-16` | Hidratación inicial exitosa HTTP 200 OK de posiciones activas para Encargado con filtro opcional | Funcional / Consulta | API / Integración | Crítica | Unidad activa en Redis y usuario ENCARGADO con permiso misiones:leer | GET /api/geolocalizacion/posiciones?tipoUnidad=CUADRILLA con Authorization: Bearer <TOKEN_ENCARGADO> | HTTP 200 OK retornando arreglo data con las posiciones vigentes desde Redis | HTTP 200 OK con datos íntegros de la cuadrilla activa desde Redis real | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70) |
| `CP-H70-API-17` | Manejo controlado con HTTP 500 Internal Server Error ante excepción inesperada en servicio | Robustez / Errores | API / Route | Media | Excepción simulada en listarPosicionesActivasService | GET /api/geolocalizacion/posiciones con JWT válido y fallo forzado | HTTP 500 Internal Server Error sin filtrar trazas internas al cliente | HTTP 500 con {"message":"Error interno al obtener posiciones de telemetría."} | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | feat(api): implementar endpoint get de consulta de ultimas posiciones y registrar openapi |
| `CP-H70-API-18` | Coherencia de regresión global de toda la API tras sincronización con origin/develop | Regresión | Suite Completa | Alta | Repositorio con merge de origin/develop y fixes HU-70 aplicados | npx tsc --noEmit && npm run lint && npm test | 0 errores de TypeScript, 0 warnings ESLint y 100% de pruebas aprobadas | 0 errores tsc, 0 warnings ESLint y 99/99 archivos (1040/1040 tests) aprobados | APROBADO | 24/11/2026 23:45 | 25/11/2026 00:01 | test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H70-API-01	Bloqueo de spoofing anónimo en sala mapa y validación de pertenencia + misión EN_CURSO en telemetria:posicion	Seguridad / ICS	Socket.io / Servicio / BD	Crítica	Servidor Socket.io activo con BD PostgreSQL y unidad en estado DISPONIBLE o sin pertenencia	Cliente sin JWT emitiendo join("mapa") y telemetria:posicion; cliente autenticado emitiendo para unidad ajena o en estado DISPONIBLE	join("mapa") anónimo rechazado; telemetria:posicion sin JWT responde NO_AUTENTICADO; unidad DISPONIBLE responde UNIDAD_DISPONIBLE, purga Redis y emite telemetria:inactiva	Anónimo bloqueado en mapa y telemetría; unidad DISPONIBLE (delta) rechazada con UNIDAD_DISPONIBLE y clave purgada	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)
BUG-H70-API-02	Exigencia de permiso RBAC misiones:leer y usuario activo en GET /api/geolocalizacion/posiciones	Seguridad / RBAC	API / AuthService	Crítica	Usuario con rol CALL_CENTER sin permiso misiones:leer y usuario ENCARGADO con permiso	GET /api/geolocalizacion/posiciones con Authorization: Bearer <TOKEN_CALL_CENTER>	HTTP 403 Forbidden indicando ausencia del permiso requerido misiones:leer	HTTP 403 Forbidden: "No cuenta con el permiso requerido: misiones:leer" verificado en Vitest y servidor en vivo	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70)
BUG-H70-API-03	Propagación multi-instancia por broker Redis Pub/Sub con originInstanceId sin duplicación local	Tiempo Real / Redis	Infraestructura / Socket	Alta	Instancia Socket.io activa junto a publicador/suscriptor Redis en canal sgrai:socket-events	Emisión notificarTelemetriaPosicion y recepción en procesarMensajeRedisSocket con mismo y distinto originInstanceId	Emite localmente a mapa, publica en sgrai:socket-events con originInstanceId; descarta eco propio y retransmite mensajes de otras instancias	Retransmisión local y publicación Redis con originInstanceId verificadas; deduplicación aprobada en pruebas	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)
BUG-H70-API-04	Sincronización con origin/develop, alineación de esquema BearerAuth OpenAPI y SemVer 0.13.0	Contrato API / Integración	OpenAPI / Git	Alta	Rama feature/H70-telemetria-gps-terreno sincronizada con origin/develop	GET /openapi.json verificando info.version, securitySchemes.BearerAuth y paths["/api/geolocalizacion/posiciones"]	Versión 0.13.0, security: [{ BearerAuth: [] }], esquemas de telemetría en components.schemas y respuestas 200/400/401/403/500	OpenAPI 3.0 en versión 0.13.0 con BearerAuth y todos los códigos y esquemas registrados sin regresiones	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70)
BUG-H70-API-05	Rechazo seguro de timestamp corrupto o epoch fuera de rango sin lanzar RangeError en Zod	Validación (Zod)	Schema	Media	Esquema TelemetriaPosicionPayloadSchema	Payloads con timestamp "no-es-una-fecha", "", 9e18, -1, NaN e Infinity	safeParse retorna success: false sin lanzar excepciones no controladas	Todos los timestamps corruptos y numéricos no finitos rechazados limpiamente por TimestampTelemetriaSchema	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70)
BUG-H70-API-06	Detección de fallos en pipeline.exec() de Redis, protección contra paquetes GPS desordenados y purga inmediata	Resiliencia / Caché	Servicio / Redis	Media	Caché de telemetría con posición previa T2 y llegada tardía de trama T1 < T2 o error en pipeline Redis	guardarPosicionUnidad con T1 < T2; mock pipeline.exec retornando [Error, null]; eliminarPosicionUnidad	Trama atrasada omitida (actualizada: false); fallo de pipeline activa fallback en memoria; eliminación purga clave y Set	Monotonicidad, fallback por error de pipeline y purga inmediata verificados en Vitest y Redis real	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70)
BUG-H70-API-07	Pruebas reales de integración Socket.io con simulador de coordenadas y matriz QA institucional	Integración / QA	Socket.io / Documentación	Media	Servidor Socket.io levantado en entorno Vitest y servidor live con PostgreSQL 16 y Redis 7	SimuladorSocketIOClient emitiendo telemetria:posicion y telemetria:detener hacia sala mapa	Retransmisión real verificada extremo a extremo y evidencia completa en informe QA	6 tests de Socket.io (incluyendo simulador WebSocket real) y verificación E2E live aprobados al 100%	CORREGIDO	24/11/2026 23:45	25/11/2026 00:01	test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70)
CP-H70-API-01	Validación exitosa de payload completo de patrulla con rumbo, precisión y velocidad	Validación (Zod)	Unitaria / Schema	Alta	Esquema TelemetriaPosicionPayloadSchema	{unidadId:"f1000000-0000-4000-8000-000000000001", tipoUnidad:"PATRULLA", lat:-39.81422, lng:-73.24589, timestamp:"2026-11-24T15:00:00.000Z", rumbo:180.5, precision:12.3, velocidad:4.5}	safeParse retorna success: true preservando todas las métricas	Validación exitosa con campos tipados y preservados correctamente	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto
CP-H70-API-02	Validación exitosa de payload mínimo de cuadrilla normalizando timestamp numérico epoch a ISO 8601	Validación (Zod)	Unitaria / Schema	Alta	Esquema TelemetriaPosicionPayloadSchema	{unidadId:"50000000-0000-4000-8000-000000000001", tipoUnidad:"CUADRILLA", lat:-39.825, lng:-73.238, timestamp:1731423600000}	safeParse exitoso con timestamp transformado a "2024-11-12T15:00:00.000Z" y opcionales undefined	Validación exitosa y normalización ISO 8601 verificada	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70)
CP-H70-API-03	Rechazo de unidadId no UUID y tipoUnidad fuera del catálogo canónico	Validación (Zod)	Unitaria / Schema	Media	Esquema TelemetriaPosicionPayloadSchema	unidadId:"patrulla-123" o tipoUnidad:"HELICOPTERO"	safeParse retorna success: false con mensaje de error por campo	Ambos casos rechazados por Zod	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto
CP-H70-API-04	Rechazo de coordenadas fuera del estándar WGS84 (-90..90, -180..180) o valores no finitos	Límite / Validación	Unitaria / Schema	Alta	Esquema TelemetriaPosicionPayloadSchema	lat:-95.0; lng:185.0; lat:NaN; lng:Infinity	safeParse rechaza todas las coordenadas fuera de rango o no finitas	Las 4 variantes inválidas fueron rechazadas por Zod	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70)
CP-H70-API-05	Rechazo de rumbo fuera de 0..360 o precisión negativa	Límite / Validación	Unitaria / Schema	Media	Esquema TelemetriaPosicionPayloadSchema	rumbo:-5, precision:-1; rumbo:361	safeParse retorna success: false	Rechazo verificado para métricas negativas y rumbo > 360	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(geolocalizacion): definir esquemas zod de telemetria y tipos dto
CP-H70-API-06	Persistencia y recuperación de posición en caché Redis con TTL de 300 segundos	Funcional / Caché	Integración / Redis	Crítica	Redis operativo o caché en memoria inicializada	guardarPosicionUnidad para PATRULLA f1000000-0000-4000-8000-000000000001	Registro persistido con campo recibidoEn y TTL 300s, recuperable por obtenerPosicionUnidad	Posición persistida y recuperada con coordenadas, rumbo y recibidoEn íntegros	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(redis): implementar cliente ioredis y servicio de cache para telemetria
CP-H70-API-07	Consulta de unidad sin registros vigentes retorna null sin excepción	Manejo de Errores	Unitaria / Caché	Media	Caché limpia sin registros para el UUID consultado	obtenerPosicionUnidad("CUADRILLA", "00000000-0000-4000-8000-000000000000")	Retorna null sin lanzar error	Retorna null correctamente	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(redis): implementar cliente ioredis y servicio de cache para telemetria
CP-H70-API-08	Listado consolidado, filtrado por tipoUnidad/unidadId y purga individual de posiciones activas	Funcional / Caché	Unitaria / Caché	Alta	1 patrulla y 1 cuadrilla almacenadas en caché activa	obtenerTodasLasPosicionesActivas({tipoUnidad:"PATRULLA"}) y eliminarPosicionUnidad("PATRULLA", id)	Filtro retorna solo patrulla; tras eliminar, queda solo la cuadrilla	Filtrado y eliminación verificados correctamente	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(geolocalizacion): endurecer validacion zod de timestamp, cache redis, monotonicidad y purga de posiciones (HU-70)
CP-H70-API-09	Emisión y retransmisión en vivo de telemetria:posicion desde unidad en misión EN_CURSO hacia sala mapa	Funcional / Tiempo Real	Integración / Socket.io	Crítica	Encargado conectado en sala mapa y Delegado/Patrulla autenticado con misión EN_CURSO	Evento telemetria:posicion con {unidadId:"c1000000-0000-4000-8000-000000000001", tipoUnidad:"CUADRILLA", lat:-39.81422, lng:-73.24589, rumbo:180.5, precision:10.5}	Callback {ok:true}, cliente en mapa recibe telemetria:posicion enriquecido con recibidoEn y registro disponible en Redis	Evento recibido en tiempo real en sala mapa y persistido en Redis live	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)
CP-H70-API-10	Rechazo de conexión Socket.io en handshake cuando el token JWT está corrupto o expirado	Seguridad / Auth	Integración / Socket.io	Crítica	Middleware registrarMiddlewareAuthSocket activo	Handshake WebSocket con auth:{token:"token.invalido.123"}	Conexión rechazada con error de autenticación inválida	Handshake rechazado con paquete Socket.io CONNECT_ERROR (44)	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)
CP-H70-API-11	Conservación de acceso abierto a salas públicas de seguimiento ciudadano (seguimiento:{codigo})	Regresión / Seguridad	Integración / Socket.io	Alta	Cliente ciudadano anónimo conectado al servidor Socket.io	Evento join("seguimiento:12345678") sin token JWT	Suscripción permitida con callback {ok:true} sin afectar seguimiento público	join a seguimiento:12345678 responde {ok:true} mientras mapa sigue restringida	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)
CP-H70-API-12	Descarte silencioso de payload malformado en telemetria:posicion sin desconectar al cliente	Resiliencia / Robustez	Integración / Socket.io	Alta	Cliente PWA autenticado conectado	Evento telemetria:posicion con {unidadId:"invalido", lat:999, lng:0, timestamp:"bad"}	Callback {ok:false, codigo:"PAYLOAD_INVALIDO"}, cero emisión a mapa y socket operativo	Payload descartado con PAYLOAD_INVALIDO manteniendo la conexión activa para tramas posteriores	APROBADO	24/11/2026 23:45	25/11/2026 00:01	test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70)
CP-H70-API-13	Pausa explícita mediante telemetria:detener purgando Redis y emitiendo telemetria:inactiva a sala mapa	Funcional / CA-4	Integración / Socket.io	Crítica	Unidad con posición activa en Redis y operador suscrito a sala mapa	Evento telemetria:detener {unidadId:"c1000000-0000-4000-8000-000000000001", tipoUnidad:"CUADRILLA", motivo:"MISION_FINALIZADA"}	Callback {ok:true}, sala mapa recibe telemetria:inactiva y GET /api/geolocalizacion/posiciones retorna data: []	telemetria:inactiva recibido en mapa y GET posterior retorna 200 OK con data: []	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(socket): validar autenticacion jwt, pertenencia, mision EN_CURSO y broker redis multi-instancia en telemetria (HU-70)
CP-H70-API-14	Rechazo con HTTP 401 Unauthorized en GET /api/geolocalizacion/posiciones sin token o con token expirado	Seguridad / Auth	API / Route	Crítica	Endpoint GET /api/geolocalizacion/posiciones activo	GET /api/geolocalizacion/posiciones sin cabecera Authorization y con token corrupto	HTTP 401 Unauthorized en ambos escenarios	HTTP 401: "Se requiere cabecera de autenticación Authorization: Bearer <token>."	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(api): implementar endpoint get de consulta de ultimas posiciones y registrar openapi
CP-H70-API-15	Rechazo con HTTP 400 Bad Request ante query params inválidos en GET /api/geolocalizacion/posiciones	Validación (Zod)	API / Route	Media	Usuario ENCARGADO autenticado	GET /api/geolocalizacion/posiciones?tipoUnidad=INVALIDO&unidadId=no-uuid con JWT válido	HTTP 400 Bad Request listando errores de validación en errors	HTTP 400 con message "Parámetros de consulta inválidos para posiciones de telemetría." y detalle de campos	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70)
CP-H70-API-16	Hidratación inicial exitosa HTTP 200 OK de posiciones activas para Encargado con filtro opcional	Funcional / Consulta	API / Integración	Crítica	Unidad activa en Redis y usuario ENCARGADO con permiso misiones:leer	GET /api/geolocalizacion/posiciones?tipoUnidad=CUADRILLA con Authorization: Bearer <TOKEN_ENCARGADO>	HTTP 200 OK retornando arreglo data con las posiciones vigentes desde Redis	HTTP 200 OK con datos íntegros de la cuadrilla activa desde Redis real	APROBADO	24/11/2026 23:45	25/11/2026 00:01	fix(api): aplicar RBAC misiones:leer, filtros query y contrato BearerAuth OpenAPI en GET /api/geolocalizacion/posiciones (HU-70)
CP-H70-API-17	Manejo controlado con HTTP 500 Internal Server Error ante excepción inesperada en servicio	Robustez / Errores	API / Route	Media	Excepción simulada en listarPosicionesActivasService	GET /api/geolocalizacion/posiciones con JWT válido y fallo forzado	HTTP 500 Internal Server Error sin filtrar trazas internas al cliente	HTTP 500 con {"message":"Error interno al obtener posiciones de telemetría."}	APROBADO	24/11/2026 23:45	25/11/2026 00:01	feat(api): implementar endpoint get de consulta de ultimas posiciones y registrar openapi
CP-H70-API-18	Coherencia de regresión global de toda la API tras sincronización con origin/develop	Regresión	Suite Completa	Alta	Repositorio con merge de origin/develop y fixes HU-70 aplicados	npx tsc --noEmit && npm run lint && npm test	0 errores de TypeScript, 0 warnings ESLint y 100% de pruebas aprobadas	0 errores tsc, 0 warnings ESLint y 99/99 archivos (1040/1040 tests) aprobados	APROBADO	24/11/2026 23:45	25/11/2026 00:01	test(telemetria): agregar pruebas de integracion Socket.io con simulador GPS, RBAC y Redis Pub/Sub (HU-70)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest, TypeScript y ESLint

#### 5.1.1 Suite Focalizada del Módulo de Telemetría, Socket.io y OpenAPI
```bash
npx vitest run src/modules/geolocalizacion/__tests__/ src/app/api/geolocalizacion/posiciones/__tests__/route.test.ts src/lib/socket/__tests__/telemetria.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/geolocalizacion/__tests__/telemetria-cache.service.test.ts (5 tests) 16ms
 ✓ src/modules/geolocalizacion/__tests__/telemetria.schema.test.ts (8 tests) 27ms
 ✓ src/modules/geolocalizacion/__tests__/telemetria.service.test.ts (7 tests) 33ms
 ✓ src/app/api/geolocalizacion/posiciones/__tests__/route.test.ts (6 tests) 45ms
 ✓ src/lib/socket/__tests__/telemetria.test.ts (6 tests) 145ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 436ms

 Test Files  6 passed (6)
      Tests  33 passed (33)
   Duration  2.29s
```

#### 5.1.2 Ejecución Focalizada por Caso (`npm test -- -t`) y Regresión Completa
```bash
npm test -- -t "Telemetria Schema Tests \(HU-70\)"
npm test -- -t "Telemetria Cache Service Tests \(HU-70\)"
npm test -- -t "Telemetria Service — Reglas ICS, Seguridad y RBAC \(HU-70\)"
npm test -- -t "Integración real Socket.io con simulador de coordenadas"
npx tsc --noEmit && npm run lint && npm test
```

**Salida Consolidada de Regresión Global:**
```text
Test Files  99 passed (99)
     Tests  1040 passed (1040)
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`GET /api/geolocalizacion/posiciones` y `GET /openapi.json`)

#### Caso 1: Rechazo por Ausencia de Autenticación (`401 Unauthorized` — `CP-H70-API-14`)
```bash
curl -s -i -X GET "http://localhost:3001/api/geolocalizacion/posiciones"
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "message": "Se requiere cabecera de autenticación Authorization: Bearer <token>."
}
```

#### Caso 2: Rechazo por Falta de Permiso RBAC `misiones:leer` (`403 Forbidden` — `BUG-H70-API-02`)
```bash
curl -s -i -X GET "http://localhost:3001/api/geolocalizacion/posiciones" \
  -H "Authorization: Bearer <TOKEN_JWT_CALL_CENTER>"
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "message": "No cuenta con el permiso requerido: misiones:leer"
}
```

#### Caso 3: Rechazo por Filtro de Consulta Inválido (`400 Bad Request` — `CP-H70-API-15`)
```bash
curl -s -i -X GET "http://localhost:3001/api/geolocalizacion/posiciones?tipoUnidad=INVALIDO" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Parámetros de consulta inválidos para posiciones de telemetría.",
  "errors": [
    {
      "campo": "tipoUnidad",
      "mensaje": "Invalid option: expected one of \"PATRULLA\"|\"CUADRILLA\""
    }
  ]
}
```

#### Caso 4: Hidratación Exitosa de Posiciones Activas desde Redis (`200 OK` — `CP-H70-API-16`)
```bash
curl -s -i -X GET "http://localhost:3001/api/geolocalizacion/posiciones?tipoUnidad=CUADRILLA" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Posiciones activas obtenidas exitosamente.",
  "data": [
    {
      "unidadId": "c1000000-0000-4000-8000-000000000001",
      "tipoUnidad": "CUADRILLA",
      "lat": -39.81422,
      "lng": -73.24589,
      "timestamp": "2026-11-24T23:56:00.000Z",
      "rumbo": 180.5,
      "precision": 10.5,
      "velocidad": 4.2,
      "recibidoEn": "2026-11-25T03:01:31.366Z"
    }
  ]
}
```

#### Caso 5: Verificación de Contrato OpenAPI 3.0 (`200 OK` — `BUG-H70-API-04`)
```bash
curl -s "http://localhost:3001/openapi.json" | node -e 'const s = JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(JSON.stringify({ version: s.info.version, security: s.paths["/api/geolocalizacion/posiciones"].get.security, responseCodes: Object.keys(s.paths["/api/geolocalizacion/posiciones"].get.responses) }, null, 2));'
```

**Salida JSON Obtenida:**
```json
{
  "version": "0.13.0",
  "security": [
    {
      "BearerAuth": []
    }
  ],
  "responseCodes": [
    "200",
    "400",
    "401",
    "403",
    "500"
  ]
}
```

---

### 5.3 Evidencia de Emisión y Retransmisión en Tiempo Real (Socket.io + PostgreSQL 16 + Redis 7)

Ejecución en vivo contra el servidor SGRAI API (`PORT=3099`, `REDIS_URL=redis://localhost:6001`, `DATABASE_URL=postgresql://sgrai:sgrai_dev@localhost:5001/sgrai`):

```text
> Conectado a Redis Pub/Sub para eventos de Socket.io.
WS_ANON_JOIN_MAPA: {"ok":false,"error":"Se requiere autenticación JWT para suscribirse a la sala 'mapa'."}
WS_ANON_TELEMETRIA: {"ok":false,"codigo":"NO_AUTENTICADO","error":"Se requiere autenticación JWT válida para transmitir telemetría GPS."}
WS_ENCARGADO_JOIN_MAPA: {"ok":true}
WS_EMIT_OK: {"ok":true,"omitidaPorObsoleta":false,"data":{"unidadId":"c1000000-0000-4000-8000-000000000001","tipoUnidad":"CUADRILLA","lat":-39.81422,"lng":-73.24589,"timestamp":"2026-11-24T23:56:00.000Z","rumbo":180.5,"precision":10.5,"velocidad":4.2,"recibidoEn":"2026-11-25T03:01:31.366Z"}}
WS_MAPA_RECEIVED: {"unidadId":"c1000000-0000-4000-8000-000000000001","tipoUnidad":"CUADRILLA","lat":-39.81422,"lng":-73.24589,"timestamp":"2026-11-24T23:56:00.000Z","rumbo":180.5,"precision":10.5,"velocidad":4.2,"recibidoEn":"2026-11-25T03:01:31.366Z"}
WS_UNIDAD_DISPONIBLE: {"ok":false,"codigo":"UNIDAD_DISPONIBLE","error":"La cuadrilla operativa se encuentra en estado DISPONIBLE; la transmisión de telemetría debe pausarse."}
WS_DETENER_ACK: {"ok":true}
WS_MAPA_INACTIVA: {"unidadId":"c1000000-0000-4000-8000-000000000001","tipoUnidad":"CUADRILLA","motivo":"MISION_FINALIZADA","detenidoEn":"2026-11-25T03:01:31.450Z"}
HTTP_200_POST_DETENER: 200 {"message":"Posiciones activas obtenidas exitosamente.","data":[]}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Cuando la patrulla o cuadrilla acepte una misión (`EN_CURSO`), la PWA debe solicitar permisos de geolocalización y activar la captura de coordenadas GPS. | `BUG-H70-API-01`, `CP-H70-API-09` | 🟢 **CUMPLIDO (ALCANCE BACKEND)** | El backend valida autoritativamente en PostgreSQL que la unidad emisora mantenga una misión en estado `EN_CURSO` y pertenencia del usuario antes de aceptar tramas. La captura del navegador corresponde a `sgrai-pwa`. |
| **CA-2:** La PWA debe emitir periódicamente (cada 30 a 60 segundos) un evento WebSocket `telemetria:posicion` conteniendo `{ unidadId, tipoUnidad, lat, lng, timestamp }` hacia el servidor. | `CP-H70-API-01` a `06`, `CP-H70-API-09`, `BUG-H70-API-05` | 🟢 **CUMPLIDO** | Listener `telemetria:posicion` tipado en `ClientToServerEvents`, validado con `TelemetriaPosicionPayloadSchema` (WGS84, finitud numérica, `timestamp` ISO/epoch válido y opcionales `rumbo`, `precision`, `velocidad`) y persistido en Redis con TTL de 300s. |
| **CA-3:** El servidor Socket.io en la API debe retransmitir estas posiciones hacia la sala `mapa`. | `CP-H70-API-09`, `CP-H70-API-16`, `BUG-H70-API-02`, `BUG-H70-API-03`, `BUG-H70-API-04` | 🟢 **CUMPLIDO (CERTIFICADO EN RE-TEST)** | Retransmite en vivo a `io.to("mapa")`, propaga vía Redis Pub/Sub (`sgrai:socket-events` con `originInstanceId` sin duplicación) y provee hidratación inicial vía `GET /api/geolocalizacion/posiciones` protegido con `misiones:leer` y `BearerAuth`. |
| **CA-4:** La transmisión debe pausarse automáticamente cuando la unidad finalice la misión o vuelva a estado `DISPONIBLE`. | `BUG-H70-API-01`, `BUG-H70-API-06`, `CP-H70-API-08`, `CP-H70-API-13` | 🟢 **CUMPLIDO (CERTIFICADO EN RE-TEST)** | El backend rechaza tramas de unidades en `DISPONIBLE` o sin misión `EN_CURSO`, purga inmediatamente su clave en Redis, emite `telemetria:inactiva` a la sala `mapa` y engancha la purga al liberarse patrullas en `mision.service.ts` y `patrulla.service.ts`, además de aceptar pausa explícita `telemetria:detener`. |
| **CA-5:** Si el dispositivo pierde conectividad, no debe interrumpir el funcionamiento de la app ni generar alertas bloqueantes en pantalla. | `BUG-H70-API-06`, `CP-H70-API-12`, `CP-H70-API-17` | 🟢 **CUMPLIDO (ALCANCE BACKEND)** | `connectionStateRecovery` activo (2 min), descarte no bloqueante de tramas malformadas, protección de monotonicidad temporal ante paquetes atrasados tras reconexión móvil y degradación segura en memoria si Redis no está disponible. |
