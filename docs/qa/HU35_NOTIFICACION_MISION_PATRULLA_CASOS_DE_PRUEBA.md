# Informe y Matriz de Casos de Prueba (QA): HU-35 — Notificación de Misión Asignada a Patrulla en Terreno y Trazabilidad de ACK (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones (Operaciones Tácticas, Puestos de Mando y Despacho en Terreno).  
> **Historia de Usuario:** HU-35 — *"Como Patrulla verificadora en terreno (y Central de Operaciones como actor secundario de monitoreo) Quiero recibir una notificación visual y sonora inmediata en el dispositivo móvil al ser asignada a un nuevo incidente, emitiendo confirmaciones automáticas de recepción y lectura hacia el servidor Para enterarme rápidamente del requerimiento operativo, coordinar la salida inmediata del equipo hacia el lugar de los hechos y garantizar a la Central la trazabilidad exacta de si la alerta llegó al dispositivo o si la patrulla se encuentra sin cobertura"*.  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Redis + Vitest).  
> **Rama Git:** `feature/h35-notificacion-mision-patrulla-pwa`  
> **Fecha de Certificación QA:** Noviembre 2026.  
> **Estado Global:** 🟢 **CERTIFICADO (100% PASS EN TEST SUITE AUTOMATIZADA Y CONTRATOS API)**.

---

## 1. Resumen Ejecutivo de Ejecución

| Métrica | Valor |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Verificados** | **12** |
| **Casos Aprobados (Passed)** | **12** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **772/772 tests exitosos en el repositorio (37 tests específicos del módulo de notificaciones y terreno)** |
| **Chequeo de Tipos y Linters (`npm run lint`)** | **0 errores TypeScript / ESLint** |
| **Especificación OpenAPI 3.0 (`GET /openapi.json`)** | **100% registrada y validada en versión `0.11.0`** |

---

## 2. Matriz Consolidada de Casos de Prueba (HU-35)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|:---:|---|---|---|---|:---:|
| `CP-HU35-01` | Despacho de misión con patrulla online (Socket conectado) | Funcional / Integración | API / WebSocket | Crítica | Patrulla suscrita a sala `patrulla:{id}`, incidente en estado `REPORTADO` | `POST /api/misiones` con `incidenteId` y `patrullaId` | Notificación creada en BD, actualizada a `ENVIADA`, emisión de `mision:asignada` y `notificacion:trazabilidad_actualizada` | Estado `ENVIADA`, `enviadaAt` registrado, socket emitido | ✅ APROBADO |
| `CP-HU35-02` | Despacho de misión con patrulla offline (Sin cobertura) | Funcional / Offline | API / Persistencia | Crítica | Patrulla sin sockets conectados en su sala, incidente en `REPORTADO` | `POST /api/misiones` | Notificación se persiste en base de datos en estado `PENDIENTE_ENVIO` con `enviada_at = null` | Estado `PENDIENTE_ENVIO`, no revienta error, espera reconexión | ✅ APROBADO |
| `CP-HU35-03` | Confirmación automática de recepción (ACK técnico 'RECIBIDA') | Funcional / Ciclo de Vida | API REST / DAL | Alta | Notificación en estado `ENVIADA` o `PENDIENTE_ENVIO` | `PATCH /api/terreno/notificaciones/{id}/estado` con `{ "estado": "RECIBIDA" }` | HTTP 200 OK, `estado = 'RECIBIDA'`, `recibida_at` registrado en UTC, emisión a Central | Estado `RECIBIDA`, `recibidaAt` ISO UTC retornado | ✅ APROBADO |
| `CP-HU35-04` | Confirmación operativa de lectura (ACK 'LEIDA') | Funcional / Ciclo de Vida | API REST / DAL | Alta | Notificación en estado `RECIBIDA` | `PATCH /api/terreno/notificaciones/{id}/estado` con `{ "estado": "LEIDA" }` | HTTP 200 OK, `estado = 'LEIDA'`, `leida_at` registrado en UTC, emisión a Central | Estado `LEIDA`, `leidaAt` ISO UTC retornado | ✅ APROBADO |
| `CP-HU35-05` | Idempotencia ante reintentos de ACK ('RECIBIDA' duplicado) | Robustez / Idempotencia | API REST / DAL | Alta | Notificación ya se encuentra en estado `RECIBIDA` con timestamp previo | `PATCH /api/terreno/notificaciones/{id}/estado` con `{ "estado": "RECIBIDA" }` | HTTP 200 OK, datos actuales sin alterar el timestamp `recibida_at` original | Timestamp `recibidaAt` inmutable, respuesta 200 OK | ✅ APROBADO |
| `CP-HU35-06` | Prohibición estricta de retroceso de estado ('LEIDA' a 'RECIBIDA') | Integridad / Regla de Negocio | API REST / DAL | Alta | Notificación ya se encuentra en estado `LEIDA` | `PATCH /api/terreno/notificaciones/{id}/estado` con `{ "estado": "RECIBIDA" }` | HTTP 200 OK, el estado se mantiene inmutable en `LEIDA` sin degradar el ciclo de vida | Estado `LEIDA` preservado, no retrocede | ✅ APROBADO |
| `CP-HU35-07` | Salto directo a 'LEIDA' con autocompletado cronológico | Integridad / Timestamps | API REST / DAL | Media | Notificación en `PENDIENTE_ENVIO` sin paso previo por `RECIBIDA` | `PATCH /api/terreno/notificaciones/{id}/estado` con `{ "estado": "LEIDA" }` | HTTP 200 OK, autocompleta `enviada_at`, `recibida_at` y `leida_at` coherentemente | Timestamps completados sin valores huérfanos | ✅ APROBADO |
| `CP-HU35-08` | Reconciliación offline vía consulta de misiones pendientes | Offline-First / Sync | API REST / Query | Crítica | Patrulla recupera cobertura de red tras periodo en modo avión | `GET /api/terreno/misiones/pendientes` con token de la patrulla | HTTP 200 OK con array de misiones en `PENDIENTE_ENVIO` o `ENVIADA` con datos completos | Retorna misiones pendientes con IDs para disparar ACKs | ✅ APROBADO |
| `CP-HU35-09` | Control de Acceso: Rechazo 401 ante petición sin token | Seguridad / Auth | API Guard | Crítica | Petición sin cabecera `Authorization: Bearer <token>` | `PATCH` o `GET` a rutas `/api/terreno/*` sin credenciales | HTTP 401 Unauthorized con mensaje de cabecera requerida | HTTP 401 Unauthorized recibido | ✅ APROBADO |
| `CP-HU35-10` | Control de Acceso: Rechazo 403 por falta de permiso RBAC | Seguridad / RBAC | API Guard | Crítica | Usuario autenticado cuyo rol carece de `misiones:terreno:verificar` | `PATCH` o `GET` con token de rol no autorizado (ej. Informante) | HTTP 403 Forbidden con detalle de permiso denegado | HTTP 403 Forbidden recibido | ✅ APROBADO |
| `CP-HU35-11` | Control de Acceso: Rechazo 403 por patrulla ajena (Ownership) | Seguridad / Propiedad | API Guard / DAL | Crítica | Usuario pertenece a la Patrulla A e intenta confirmar notificación de la Patrulla B | `PATCH /api/terreno/notificaciones/{id}/estado` con token de otra patrulla | HTTP 403 Forbidden ("No está autorizado para confirmar notificaciones asignadas a otra patrulla") | HTTP 403 Forbidden recibido | ✅ APROBADO |
| `CP-HU35-12` | Validación Zod y rechazo 400 ante payloads o IDs inválidos | Validación de Esquema | API / Zod | Media | UUID malformado o cuerpo JSON con estados no soportados | `PATCH` con `{ "estado": "CANCELADA" }` o ID `id-invalido` | HTTP 400 Bad Request con array de errores Zod descriptivos | HTTP 400 Bad Request recibido | ✅ APROBADO |

---

## 3. Ficha Extendida de Casos de Prueba Clave

### `CP-HU35-01`: Despacho y Trazabilidad con Patrulla Conectada
* **Criterio de Aceptación:** Persistencia y máquina de estados auditable en UTC; emisión inmediata de evento WebSocket al canal específico.
* **Precondición:** Patrulla suscrita mediante WebSocket a `patrulla:{patrullaId}`. Incidente en estado `REPORTADO`.
* **Pasos de Ejecución:**
  1. Invocar `POST /api/misiones` enviando `incidenteId` y `patrullaId`.
  2. Verificar respuesta HTTP 201 Created.
  3. Comprobar que en la base de datos se insertó la fila en `notificaciones_mision` y se actualizó a `ENVIADA`.
  4. Verificar que el broker emitió `mision:asignada` con el `notificacionId`.
* **Resultado:** Notificación despachada, persistida con `intentos_envio = 1` y emitida a la sala correspondiente.

### `CP-HU35-05`: Idempotencia y Protección de Timestamps ante Microcortes
* **Criterio de Aceptación:** La aplicación debe garantizar idempotencia; reenviar un ACK no debe alterar los timestamps originales ni reiniciar contadores.
* **Precondición:** Notificación en estado `RECIBIDA` con `recibida_at = 2026-11-09T17:00:05.000Z`.
* **Pasos de Ejecución:**
  1. Emitir petición `PATCH /api/terreno/notificaciones/{id}/estado` con `{ "estado": "RECIBIDA" }`.
  2. Verificar que responde HTTP 200 OK.
  3. Consultar en base de datos el valor de `recibida_at`.
* **Resultado:** Responde HTTP 200 OK y `recibida_at` permanece idéntico al valor previo sin ninguna mutación.

### `CP-HU35-08`: Sincronización Offline-First tras Modo Avión
* **Criterio de Aceptación:** Si la patrulla estaba sin cobertura, al reconectarse debe poder consultar misiones pendientes y disparar el acuse `RECIBIDA`.
* **Precondición:** Dos misiones asignadas a la patrulla en estado `PENDIENTE_ENVIO` (fuera de señal).
* **Pasos de Ejecución:**
  1. Patrulla recupera conectividad e invoca `GET /api/terreno/misiones/pendientes`.
  2. Verificar que retorna la lista con las dos misiones y sus respectivos `notificacionId`.
  3. Disparar `PATCH` por cada una enviando `{ "estado": "RECIBIDA" }`.
* **Resultado:** La lista se obtiene exitosamente con códigos de incidente y orden táctica, permitiendo completar el flujo de ACK.

---

## 4. Dictamen Final de Certificación

El desarrollo de la **HU-35** en el repositorio monolítico `sgrai-api` da cumplimiento estricto y riguroso a la totalidad de los criterios de aceptación técnicos y de negocio:
- ✅ Máquina de estados persistente en PostgreSQL (`notificaciones_mision`).
- ✅ Idempotencia total ante reintentos de red y preservación cronológica de marcas temporales en UTC.
- ✅ Respaldo a la arquitectura Offline-First para clientes móviles de terreno (`sgrai-pwa`).
- ✅ Control de acceso granular por permisos RBAC (`misiones:terreno:verificar`) y propiedad de patrulla.
- ✅ Integración completa con la especificación OpenAPI 3.0 (`GET /openapi.json`).
- ✅ 100% de la suite de pruebas unitarias y de integración superada exitosamente (772/772 tests).

