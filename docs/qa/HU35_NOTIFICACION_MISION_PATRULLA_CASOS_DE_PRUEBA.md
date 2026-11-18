# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-35 — Notificación de Misión Asignada a Patrulla en Terreno y Trazabilidad de ACK (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Despacho Táctico y Notificaciones en Terreno (`sgrai-api`).  
> **Historia de Usuario:** HU-35 — *"Como Patrulla verificadora en terreno (y Central de Operaciones como actor secundario de monitoreo) Quiero recibir una notificación visual y sonora inmediata en el dispositivo móvil al ser asignada a un nuevo incidente, emitiendo confirmaciones automáticas de recepción y lectura hacia el servidor Para enterarme rápidamente del requerimiento operativo, coordinar la salida inmediata del equipo hacia el lugar de los hechos y garantizar a la Central la trazabilidad exacta de si la alerta llegó al dispositivo o si la patrulla se encuentra sin cobertura"*.  
> **Desarrollador Asignado:** DsAlenRupailaf  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h35-notificacion-mision-patrulla-pwa`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): crear migracion notificaciones_mision y asegurar permiso misiones:terreno:verificar (#35)`  
> * `feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)`  
> * `feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35)`  
> * `feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)`  
> * `test(notificaciones): agregar pruebas unitarias e integracion para maquina de estados y endpoints (#35)`  
> * `docs(api): documentar endpoints de terreno, eventos websocket y matriz de casos de prueba qa (#35)`  
> * `fix(db): renumerar migracion de notificaciones a 061 para reservar rango (#35)`  
>  
> **Fecha de Auditoría Inicial:** 09/11/2026 17:45.  
> **Fecha de Re-Test y Certificación Final:** 10/11/2026 16:50.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Cumplidos — 4 Defectos Subsanados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la inspección forense de código fuente, verificación de transacciones ACID en Kysely/PostgreSQL, auditoría de la secuencia de migraciones de base de datos, validación de la máquina de estados e idempotencia bajo pérdida de señal (Offline-First), emisión de eventos en tiempo real vía Socket.io/Redis, contratos OpenAPI 3.0 y pruebas automatizadas en Vitest sobre la rama `feature/h35-notificacion-mision-patrulla-pwa`, se dictamina el estado **CERTIFICADO / APROBADO (`Approved`)** tras verificar la corrección íntegra de los **4 defectos** detectados en la revisión inicial (`BUG-H35-API-01` a `BUG-H35-API-04`).

### Verificación de Correcciones en Re-Test (10/11/2026 16:50)
1. **Renumeración de Migración y Aislamiento de Rango Asignado (`BUG-H35-API-01` — Resuelto):** La migración original había sido nombrada `035_notificaciones_mision.ts`, invadiendo correlativos de otros módulos. Se renumeró a `src/lib/db/migrations/061_notificaciones_mision.ts` dentro del rango 061-070 asignado al desarrollador, actualizando los índices y documentación en `docs/database/README.md`.
2. **Sincronización de Contrato OpenAPI y Bump SemVer (`BUG-H35-API-02` — Resuelto):** Se actualizó la versión de la API a `0.11.0` en `package.json`, registrando formalmente en `src/lib/openapi/index.ts` las operaciones `PATCH /api/terreno/notificaciones/{id}/estado` y `GET /api/terreno/misiones/pendientes`, subsanando fallos de aserción en pruebas de contrato de integración.
3. **Idempotencia Estricta, Autocompletado Cronológico y No Retroceso (`BUG-H35-API-03` — Resuelto):** En `actualizarEstadoNotificacionIdempotenteRepo` (`src/modules/misiones/notificacion-mision.repository.ts`) se implementó la jerarquía de estados `PENDIENTE_ENVIO (0) < ENVIADA (1) < RECIBIDA (2) < LEIDA (3)`, evitando que reintentos de red o microcortes sobreescriban `recibida_at` o degraden el estado `LEIDA`, y aplicando `COALESCE` para autocompletar marcas de tiempo faltantes ante transiciones directas.
4. **Trazabilidad en Despacho con Patrulla Desconectada (`BUG-H35-API-04` — Resuelto):** En `asignarPatrullaVerificacionService` (`src/modules/misiones/mision.service.ts`) se incorporó la función `tieneConexionEnSala` para evaluar presencia activa en Socket.io. Si la patrulla está offline, la notificación se conserva en base de datos como `PENDIENTE_ENVIO` sin reventar excepciones, y al estar online se promueve a `ENVIADA` con emisión inmediata a Central y a la patrulla.

| Métrica de Calidad | Auditoría Inicial (09/11/2026) | Re-Test Final (10/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | 20 | **20** | 4 Defectos Subsanados (`BUG-H35-API-01` a `04`) + 16 Casos de Integración, RBAC, Dal y Sockets (`CP-H35-API-01` a `16`) |
| **Casos Aprobados (Passed)** | 16 | **20** | 100% de casos funcionales, idempotencia, RBAC, concurrencia y tiempo real aprobados |
| **Defectos Abiertos / Fallidos (Failed)** | 4 | **0** | 4/4 defectos corregidos y verificados en Re-Test |
| **Casos Bloqueados (Blocked)** | 0 | **0** | Sin bloqueos de entorno o infraestructura |
| **Tasa de Aprobación (% Pass)** | 80.0% | **100.0%** | Cumplimiento total de criterios de aceptación para merge a `develop` |
| **Suite Automatizada de Pruebas (Vitest)** | 768/772 tests pass | **772/772 tests pass** | 36 tests específicos de notificaciones y terreno + 5 de servicio de despacho aprobados |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | 0 errores | **0 errores** | Compilación limpia y 0 advertencias/errores en módulos modificados |
| **Secuencia de Migraciones Kysely** | 🔴 Colisión fuera de rango (`035_`) | 🟢 **Rango oficial (`061_`)** | `061_notificaciones_mision.ts` encadenada en rango reservado 061-070 |

---

## 2. Registro Técnico de Defectos Subsanados

### `BUG-H35-API-01`: Asignación Inicial de Correlativo `035_notificaciones_mision.ts` Fuera del Rango Oficial 061-070 Asignado al Desarrollador
* **Severidad:** **CRÍTICA** (Integridad de Secuencia de Migraciones en CI/CD y Control de Versiones).
* **Estado Post Re-Test (10/11/2026 16:50):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/lib/db/migrations/061_notificaciones_mision.ts` y `docs/database/README.md`.
* **Descripción Técnica del Defecto Inicial:**  
  La migración para la tabla `notificaciones_mision` fue creada inicialmente como `src/lib/db/migrations/035_notificaciones_mision.ts`. Esto violaba la reserva de rangos de migración para el equipo (61 al 70), generando riesgo de colisión al integrar con ramas paralelas en `develop`.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se renombró el archivo a `src/lib/db/migrations/061_notificaciones_mision.ts`, se ajustó la documentación técnica en `docs/database/README.md` (líneas 104 y 538) y se verificó que `migrator.ts` la descubra y ejecute limpiamente con `allowUnorderedMigrations: true`.

---

### `BUG-H35-API-02`: Desincronización de Versión SemVer en Contrato OpenAPI (v0.10.0 vs v0.11.0) y Omisión Inicial de Endpoints de Terreno en Documentación
* **Severidad:** **ALTA** (Discrepancia en Contrato de Integración y Fallos en Suite Automatizada).
* **Estado Post Re-Test (10/11/2026 16:50):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `package.json`, `src/lib/openapi/index.ts`, `src/app/openapi.json/__tests__/route.test.ts`, `src/modules/seguridad/__tests__/seguridad.test.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  La introducción de nuevos endpoints públicos no contemplaba el bump de versión SemVer en `package.json`, causando discrepancias en las pruebas unitarias que validaban `spec.info.version === "0.10.0"`. Además, las operaciones de `/api/terreno/*` no estaban expuestas formalmente en el generador OpenAPI.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se realizó el bump a `0.11.0` en `package.json`, se registraron los esquemas y respuestas de `PATCH /api/terreno/notificaciones/{id}/estado` y `GET /api/terreno/misiones/pendientes` en `src/lib/openapi/index.ts`, y se actualizaron las pruebas de aserción de versión.

---

### `BUG-H35-API-03`: Riesgo de Regresión de Estado (`LEIDA` -> `RECIBIDA`) y Mutación de Marcas de Tiempo Originales ante Microcortes de Red Móvil
* **Severidad:** **ALTA** (Integridad de Auditoría Trazable y Violación de la Máquina de Estados).
* **Estado Post Re-Test (10/11/2026 16:50):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/modules/misiones/notificacion-mision.repository.ts` (Líneas 204-239) y `notificacion-mision.service.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  En escenarios de inestabilidad de red donde el dispositivo móvil envía múltiples confirmaciones `RECIBIDA` por reintento, una actualización directa de timestamp sobrescribía `recibida_at` alterando la auditoría de tiempo real. Asimismo, un mensaje `RECIBIDA` demorado podía degradar una notificación que el usuario ya había marcado como `LEIDA`.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se implementó un mapa de prioridades numéricas y cláusulas SQL `COALESCE`:
  ```typescript
  const PRIORIDAD_ESTADO: Record<EstadoNotificacionMision, number> = {
    PENDIENTE_ENVIO: 0,
    ENVIADA: 1,
    RECIBIDA: 2,
    LEIDA: 3,
  };
  if (PRIORIDAD_ESTADO[nuevoEstado] <= PRIORIDAD_ESTADO[estadoActual]) {
    return notificacionActual; // Idempotente sin mutar timestamps
  }
  ```
  Permite absorber reintentos duplicados con `200 OK` y autocompleta marcas intermedias (`enviada_at`, `recibida_at`) si el usuario interactúa directamente pasando a `LEIDA`.

---

### `BUG-H35-API-04`: Ausencia de Manejo Específico de Trazabilidad en Despacho Táctico ante Patrulla Fuera de Línea / Modo Avión
* **Severidad:** **MEDIA** (Desincronización de Monitoreo en Central de Operaciones y Excepciones de Socket).
* **Estado Post Re-Test (10/11/2026 16:50):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:** `src/modules/misiones/mision.service.ts` (Líneas 277-318) y `src/lib/socket/index.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  Al despachar una misión con la patrulla desconectada de WebSocket, el backend intentaba marcar la notificación como `ENVIADA` asumiendo conectividad activa, distorsionando la trazabilidad en la Central que interpretaba falsamente que la orden había ingresado a las redes móviles.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se implementó `tieneConexionEnSala("patrulla:" + patrullaId)`. Si la sala carece de conexiones vivas, la notificación se conserva en estado `PENDIENTE_ENVIO` en PostgreSQL con `enviada_at = null`, y solo se promueve a `ENVIADA` si el broker detecta clientes suscritos activos.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H35-API-01` | Colisión de correlativo en migración inicial 035 fuera del rango asignado al desarrollador en develop | Integración / Migraciones | Base de Datos / Git | Crítica | Rama feature con correlativo 035 | Directorio src/lib/db/migrations/ | Migración renumerada al rango 061-070 sin colisiones | Archivo renumerado a 061_notificaciones_mision.ts y documentado en README.md | CORREGIDO | 09/11/2026 17:45 | 10/11/2026 16:50 | fix(db): renumerar migracion de notificaciones a 061 para reservar rango (#35) |
| `BUG-H35-API-02` | Desincronización de versión SemVer en openapi.json (v0.10.0 vs v0.11.0) y omisión de endpoints de terreno | Contrato API / OpenAPI | OpenAPI Spec / Vitest | Alta | package.json en 0.10.0 tras agregar endpoints de terreno | GET /openapi.json y tests de ruta openapi | openapi.json versión 0.11.0 con paths de terreno documentados y tests passing | Versión 0.11.0 expuesta y validada en route.test.ts y seguridad.test.ts | CORREGIDO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `BUG-H35-API-03` | Riesgo de regresión de estado (LEIDA a RECIBIDA) y mutación de timestamp recibida_at ante reintentos | Integridad / Idempotencia | Repositorio / DAL | Alta | Notificación en estado LEIDA o RECIBIDA con timestamp previo | PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"} | HTTP 200 OK preservando timestamps originales y evitando retroceso de estado | Estado LEIDA preservado y recibida_at inmutable ante reintentos | CORREGIDO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `BUG-H35-API-04` | Ausencia de verificación de sockets activos en sala de patrulla persistiendo ENVIADA en modo avión | Tiempo Real / Sockets | Servicio / Socket | Media | Patrulla sin clientes WebSocket conectados a su sala | POST /api/misiones despachando patrulla offline | Notificación persiste en PENDIENTE_ENVIO con enviada_at en null | Notificación queda en PENDIENTE_ENVIO y solo pasa a ENVIADA con sockets activos | CORREGIDO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35) |
| `CP-H35-API-01` | Despacho táctico con patrulla online promoviendo notificación a ENVIADA y emitiendo mision:asignada | Funcional / Integración | API / WebSocket | Crítica | Patrulla conectada a sala patrulla:{id}, incidente en estado REPORTADO | POST /api/misiones con incidenteId y patrullaId | HTTP 201 Created, notificación en ENVIADA con enviadaAt y emisión de socket | Notificación creada, promovida a ENVIADA y evento emitido con notificacionId | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35) |
| `CP-H35-API-02` | Despacho táctico con patrulla offline reteniendo notificación en estado PENDIENTE_ENVIO | Funcional / Offline-First | API / Persistencia | Crítica | Patrulla sin sockets activos en su sala, incidente en estado REPORTADO | POST /api/misiones con incidenteId y patrullaId | HTTP 201 Created, notificación en PENDIENTE_ENVIO con enviadaAt = null | Registro persistido en PENDIENTE_ENVIO a la espera de reconexión móvil | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-03` | Confirmación automática de recepción (ACK técnico RECIBIDA) mediante endpoint REST | Funcional / Ciclo de Vida | API REST / DAL | Alta | Notificación en estado ENVIADA o PENDIENTE_ENVIO | PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"} | HTTP 200 OK, estado actualizado a RECIBIDA, recibidaAt registrado en UTC | HTTP 200 OK con payload actualizado y emisión a sala:encargados | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `CP-H35-API-04` | Confirmación operativa de lectura (ACK operativo LEIDA) mediante endpoint REST | Funcional / Ciclo de Vida | API REST / DAL | Alta | Notificación en estado RECIBIDA | PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"LEIDA"} | HTTP 200 OK, estado actualizado a LEIDA, leidaAt registrado en UTC | HTTP 200 OK con transición a LEIDA y emisión de trazabilidad | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `CP-H35-API-05` | Idempotencia ante recepción duplicada (doble ACK RECIBIDA por reintento de red) | Robustez / Idempotencia | API REST / DAL | Alta | Notificación ya en estado RECIBIDA con timestamp previo | PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"} | HTTP 200 OK retornando datos actuales sin modificar recibidaAt original | HTTP 200 OK con recibidaAt inmutable idéntico a la primera llamada | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-06` | Prohibición estricta de degradación de estado (intento de RECIBIDA sobre notificación LEIDA) | Regla de Negocio / Anti-retroceso | API REST / DAL | Alta | Notificación previamente confirmada en estado LEIDA | PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"} | HTTP 200 OK manteniendo el estado en LEIDA sin mutar marcas temporales | HTTP 200 OK preservando estado LEIDA y leidaAt original | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-07` | Salto directo a LEIDA autocompletando cronológicamente enviadaAt y recibidaAt con COALESCE | Integridad / Timestamps | API REST / DAL | Media | Notificación en estado PENDIENTE_ENVIO | PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"LEIDA"} | HTTP 200 OK con estado LEIDA y enviadaAt, recibidaAt y leidaAt poblados | Transición exitosa con marcas temporales autocompletadas en UTC | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-08` | Reconciliación offline-first consultando órdenes en PENDIENTE_ENVIO o ENVIADA al reconectar | Offline-First / Reconciliación | API REST / Query | Crítica | Patrulla con 2 misiones asignadas mientras estuvo sin señal | GET /api/terreno/misiones/pendientes con Bearer token de líder de patrulla | HTTP 200 OK retornando array de misiones con notificacionId y datos tácticos | HTTP 200 OK retornando las 2 misiones pendientes de confirmar | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `CP-H35-API-09` | Filtro administrativo de misiones pendientes por patrullaId para rol Administrador | Consulta Administrativa | API REST / Query | Media | Sesión de usuario con rol Administrador | GET /api/terreno/misiones/pendientes?patrullaId={id} | HTTP 200 OK retornando órdenes pendientes de la patrulla especificada | HTTP 200 OK con listado filtrado por patrullaId administrativo | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `CP-H35-API-10` | Denegación HTTP 401 Unauthorized ante peticiones sin token Bearer a rutas de terreno | Seguridad / AuthGuard | API / Guard | Crítica | Petición sin cabecera Authorization | PATCH /api/terreno/notificaciones/{id}/estado sin headers | HTTP 401 Unauthorized indicando que se requiere token de autenticación | HTTP 401 Unauthorized: "Se requiere un token de autenticación válido." | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `CP-H35-API-11` | Denegación HTTP 403 Forbidden por carecer del permiso RBAC misiones:terreno:verificar | Seguridad / RBAC | API / Guard | Crítica | Usuario autenticado con rol Informante o Call Center sin permiso | PATCH /api/terreno/notificaciones/{id}/estado con token sin permiso | HTTP 403 Forbidden exigiendo permiso misiones:terreno:verificar | HTTP 403 Forbidden: "Acceso denegado. Se requiere el permiso 'misiones:terreno:verificar'." | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(db): crear migracion notificaciones_mision y asegurar permiso misiones:terreno:verificar (#35) |
| `CP-H35-API-12` | Denegación HTTP 403 Forbidden al intentar confirmar una notificación de otra patrulla (Ownership) | Seguridad / Propiedad | API / DAL | Crítica | Usuario miembro de Patrulla A intenta confirmar notificación de Patrulla B | PATCH /api/terreno/notificaciones/{id_patrulla_b}/estado con token de Patrulla A | HTTP 403 Forbidden indicando que no está autorizado para otra patrulla | HTTP 403 Forbidden: "No está autorizado para confirmar notificaciones asignadas a otra patrulla..." | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-13` | Bypass autorizado de control de propiedad para perfil Administrador | Seguridad / Bypass Admin | API / DAL | Alta | Usuario autenticado con rol Administrador | PATCH /api/terreno/notificaciones/{id}/estado con token de Administrador | HTTP 200 OK procesando la confirmación técnica sin restricción de patrulla | Confirmación procesada exitosamente con HTTP 200 OK | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-14` | Rechazo HTTP 404 Not Found cuando la notificación no existe en la base de datos | Manejo de Errores | API / Repositorio | Alta | UUID sintácticamente válido pero inexistente en notificaciones_mision | PATCH /api/terreno/notificaciones/80000000-0000-4000-8000-999999999999/estado con {"estado":"RECIBIDA"} | HTTP 404 Not Found indicando que la notificación no existe | HTTP 404 Not Found: "Notificación con ID '...' no encontrada." | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35) |
| `CP-H35-API-15` | Rechazo HTTP 400 Bad Request ante parámetro UUID inválido o payload malformado | Validación Zod | Esquema / Route | Media | Parámetro id no UUID o body JSON con estado no permitido (ej. RECHAZADA) | PATCH /api/terreno/notificaciones/invalido/estado o body {"estado":"OTRO"} | HTTP 400 Bad Request con array de errores Zod explicativos | HTTP 400 Bad Request con mensaje descriptivo y campo observado | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35) |
| `CP-H35-API-16` | Procesamiento nativo de acuse WebSocket notificacion:ack con callback bidireccional | Tiempo Real / WebSocket | Socket.io Server | Alta | Conexión WebSocket activa emitiendo notificacion:ack | socket.emit("notificacion:ack", {notificacionId:"...", estado:"RECIBIDA"}, callback) | Callback invocado con {ok: true, message: "..."} y broadcast a Central | Callback ejecutado con ok: true y evento emitido a sala:encargados | APROBADO | 09/11/2026 17:45 | 10/11/2026 16:50 | feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H35-API-01	Colisión de correlativo en migración inicial 035 fuera del rango asignado al desarrollador en develop	Integración / Migraciones	Base de Datos / Git	Crítica	Rama feature con correlativo 035	Directorio src/lib/db/migrations/	Migración renumerada al rango 061-070 sin colisiones	Archivo renumerado a 061_notificaciones_mision.ts y documentado en README.md	CORREGIDO	09/11/2026 17:45	10/11/2026 16:50	fix(db): renumerar migracion de notificaciones a 061 para reservar rango (#35)
BUG-H35-API-02	Desincronización de versión SemVer en openapi.json (v0.10.0 vs v0.11.0) y omisión de endpoints de terreno	Contrato API / OpenAPI	OpenAPI Spec / Vitest	Alta	package.json en 0.10.0 tras agregar endpoints de terreno	GET /openapi.json y tests de ruta openapi	openapi.json versión 0.11.0 con paths de terreno documentados y tests passing	Versión 0.11.0 expuesta y validada en route.test.ts y seguridad.test.ts	CORREGIDO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
BUG-H35-API-03	Riesgo de regresión de estado (LEIDA a RECIBIDA) y mutación de timestamp recibida_at ante reintentos	Integridad / Idempotencia	Repositorio / DAL	Alta	Notificación en estado LEIDA o RECIBIDA con timestamp previo	PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"}	HTTP 200 OK preservando timestamps originales y evitando retroceso de estado	Estado LEIDA preservado y recibida_at inmutable ante reintentos	CORREGIDO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
BUG-H35-API-04	Ausencia de verificación de sockets activos en sala de patrulla persistiendo ENVIADA en modo avión	Tiempo Real / Sockets	Servicio / Socket	Media	Patrulla sin clientes WebSocket conectados a su sala	POST /api/misiones despachando patrulla offline	Notificación persiste en PENDIENTE_ENVIO con enviada_at en null	Notificación queda en PENDIENTE_ENVIO y solo pasa a ENVIADA con sockets activos	CORREGIDO	09/11/2026 17:45	10/11/2026 16:50	feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35)
CP-H35-API-01	Despacho táctico con patrulla online promoviendo notificación a ENVIADA y emitiendo mision:asignada	Funcional / Integración	API / WebSocket	Crítica	Patrulla conectada a sala patrulla:{id}, incidente en estado REPORTADO	POST /api/misiones con incidenteId y patrullaId	HTTP 201 Created, notificación en ENVIADA con enviadaAt y emisión de socket	Notificación creada, promovida a ENVIADA y evento emitido con notificacionId	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35)
CP-H35-API-02	Despacho táctico con patrulla offline reteniendo notificación en estado PENDIENTE_ENVIO	Funcional / Offline-First	API / Persistencia	Crítica	Patrulla sin sockets activos en su sala, incidente en estado REPORTADO	POST /api/misiones con incidenteId y patrullaId	HTTP 201 Created, notificación en PENDIENTE_ENVIO con enviadaAt = null	Registro persistido en PENDIENTE_ENVIO a la espera de reconexión móvil	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-03	Confirmación automática de recepción (ACK técnico RECIBIDA) mediante endpoint REST	Funcional / Ciclo de Vida	API REST / DAL	Alta	Notificación en estado ENVIADA o PENDIENTE_ENVIO	PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"}	HTTP 200 OK, estado actualizado a RECIBIDA, recibidaAt registrado en UTC	HTTP 200 OK con payload actualizado y emisión a sala:encargados	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
CP-H35-API-04	Confirmación operativa de lectura (ACK operativo LEIDA) mediante endpoint REST	Funcional / Ciclo de Vida	API REST / DAL	Alta	Notificación en estado RECIBIDA	PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"LEIDA"}	HTTP 200 OK, estado actualizado a LEIDA, leidaAt registrado en UTC	HTTP 200 OK con transición a LEIDA y emisión de trazabilidad	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
CP-H35-API-05	Idempotencia ante recepción duplicada (doble ACK RECIBIDA por reintento de red)	Robustez / Idempotencia	API REST / DAL	Alta	Notificación ya en estado RECIBIDA con timestamp previo	PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"}	HTTP 200 OK retornando datos actuales sin modificar recibidaAt original	HTTP 200 OK con recibidaAt inmutable idéntico a la primera llamada	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-06	Prohibición estricta de degradación de estado (intento de RECIBIDA sobre notificación LEIDA)	Regla de Negocio / Anti-retroceso	API REST / DAL	Alta	Notificación previamente confirmada en estado LEIDA	PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"RECIBIDA"}	HTTP 200 OK manteniendo el estado en LEIDA sin mutar marcas temporales	HTTP 200 OK preservando estado LEIDA y leidaAt original	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-07	Salto directo a LEIDA autocompletando cronológicamente enviadaAt y recibidaAt con COALESCE	Integridad / Timestamps	API REST / DAL	Media	Notificación en estado PENDIENTE_ENVIO	PATCH /api/terreno/notificaciones/{id}/estado con {"estado":"LEIDA"}	HTTP 200 OK con estado LEIDA y enviadaAt, recibidaAt y leidaAt poblados	Transición exitosa con marcas temporales autocompletadas en UTC	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-08	Reconciliación offline-first consultando órdenes en PENDIENTE_ENVIO o ENVIADA al reconectar	Offline-First / Reconciliación	API REST / Query	Crítica	Patrulla con 2 misiones asignadas mientras estuvo sin señal	GET /api/terreno/misiones/pendientes con Bearer token de líder de patrulla	HTTP 200 OK retornando array de misiones con notificacionId y datos tácticos	HTTP 200 OK retornando las 2 misiones pendientes de confirmar	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
CP-H35-API-09	Filtro administrativo de misiones pendientes por patrullaId para rol Administrador	Consulta Administrativa	API REST / Query	Media	Sesión de usuario con rol Administrador	GET /api/terreno/misiones/pendientes?patrullaId={id}	HTTP 200 OK retornando órdenes pendientes de la patrulla especificada	HTTP 200 OK con listado filtrado por patrullaId administrativo	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
CP-H35-API-10	Denegación HTTP 401 Unauthorized ante peticiones sin token Bearer a rutas de terreno	Seguridad / AuthGuard	API / Guard	Crítica	Petición sin cabecera Authorization	PATCH /api/terreno/notificaciones/{id}/estado sin headers	HTTP 401 Unauthorized indicando que se requiere token de autenticación	HTTP 401 Unauthorized: "Se requiere un token de autenticación válido."	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
CP-H35-API-11	Denegación HTTP 403 Forbidden por carecer del permiso RBAC misiones:terreno:verificar	Seguridad / RBAC	API / Guard	Crítica	Usuario autenticado con rol Informante o Call Center sin permiso	PATCH /api/terreno/notificaciones/{id}/estado con token sin permiso	HTTP 403 Forbidden exigiendo permiso misiones:terreno:verificar	HTTP 403 Forbidden: "Acceso denegado. Se requiere el permiso 'misiones:terreno:verificar'."	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(db): crear migracion notificaciones_mision y asegurar permiso misiones:terreno:verificar (#35)
CP-H35-API-12	Denegación HTTP 403 Forbidden al intentar confirmar una notificación de otra patrulla (Ownership)	Seguridad / Propiedad	API / DAL	Crítica	Usuario miembro de Patrulla A intenta confirmar notificación de Patrulla B	PATCH /api/terreno/notificaciones/{id_patrulla_b}/estado con token de Patrulla A	HTTP 403 Forbidden indicando que no está autorizado para otra patrulla	HTTP 403 Forbidden: "No está autorizado para confirmar notificaciones asignadas a otra patrulla..."	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-13	Bypass autorizado de control de propiedad para perfil Administrador	Seguridad / Bypass Admin	API / DAL	Alta	Usuario autenticado con rol Administrador	PATCH /api/terreno/notificaciones/{id}/estado con token de Administrador	HTTP 200 OK procesando la confirmación técnica sin restricción de patrulla	Confirmación procesada exitosamente con HTTP 200 OK	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-14	Rechazo HTTP 404 Not Found cuando la notificación no existe en la base de datos	Manejo de Errores	API / Repositorio	Alta	UUID sintácticamente válido pero inexistente en notificaciones_mision	PATCH /api/terreno/notificaciones/80000000-0000-4000-8000-999999999999/estado con {"estado":"RECIBIDA"}	HTTP 404 Not Found indicando que la notificación no existe	HTTP 404 Not Found: "Notificación con ID '...' no encontrada."	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(api): implementar endpoints PATCH estado notificacion y GET misiones pendientes de terreno (#35)
CP-H35-API-15	Rechazo HTTP 400 Bad Request ante parámetro UUID inválido o payload malformado	Validación Zod	Esquema / Route	Media	Parámetro id no UUID o body JSON con estado no permitido (ej. RECHAZADA)	PATCH /api/terreno/notificaciones/invalido/estado o body {"estado":"OTRO"}	HTTP 400 Bad Request con array de errores Zod explicativos	HTTP 400 Bad Request con mensaje descriptivo y campo observado	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(notificaciones): implementar esquemas zod, repositorio y servicio de trazabilidad ack (#35)
CP-H35-API-16	Procesamiento nativo de acuse WebSocket notificacion:ack con callback bidireccional	Tiempo Real / WebSocket	Socket.io Server	Alta	Conexión WebSocket activa emitiendo notificacion:ack	socket.emit("notificacion:ack", {notificacionId:"...", estado:"RECIBIDA"}, callback)	Callback invocado con {ok: true, message: "..."} y broadcast a Central	Callback ejecutado con ok: true y evento emitido a sala:encargados	APROBADO	09/11/2026 17:45	10/11/2026 16:50	feat(socket): integrar emision de mision:asignada con notificacionId y handler notificacion:ack (#35)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Focalizada de Notificaciones y Terreno (HU-35)
```bash
npx vitest run src/modules/misiones/__tests__/notificacion-mision.schema.test.ts src/modules/misiones/__tests__/notificacion-mision.repository.test.ts src/modules/misiones/__tests__/notificacion-mision.service.test.ts src/app/api/terreno/__tests__/notificaciones-estado.test.ts src/app/api/terreno/__tests__/misiones-pendientes.test.ts
```

**Salida de Consola Verificada:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/notificacion-mision.service.test.ts (5 tests) 18ms
 ✓ src/app/api/terreno/__tests__/misiones-pendientes.test.ts (4 tests) 29ms
 ✓ src/modules/misiones/__tests__/notificacion-mision.schema.test.ts (9 tests) 26ms
 ✓ src/app/api/terreno/__tests__/notificaciones-estado.test.ts (8 tests) 40ms
 ✓ src/modules/misiones/__tests__/notificacion-mision.repository.test.ts (10 tests) 20ms

 Test Files  5 passed (5)
      Tests  36 passed (36)
   Start at  16:53:54
   Duration  1.16s (transform 790ms, setup 0ms, collect 1.93s, tests 132ms, environment 2ms, prepare 816ms)
```

#### 5.1.2 Ejecución Focalizada por Filtros de Casos (`-t`)
```bash
npm test -- -t "Notificacion Mision Schema \(HU-35\)"
npm test -- -t "Notificacion Mision Repository \(HU-35\)"
npm test -- -t "Notificacion Mision Service \(HU-35\)"
npm test -- -t "Route Handler PATCH /api/terreno/notificaciones/\[id\]/estado \(HU-35\)"
npm test -- -t "Route Handler GET /api/terreno/misiones/pendientes \(HU-35\)"
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL

#### 5.2.1 Confirmación de Recepción Técnica (ACK 'RECIBIDA')
```bash
curl -X PATCH http://localhost:3000/api/terreno/notificaciones/80000000-0000-4000-8000-000000000001/estado \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_PATRULLA_VERIFICADORA>" \
  -d '{"estado": "RECIBIDA"}'
```

**Respuesta HTTP/JSON (200 OK):**
```json
{
  "message": "Estado de notificación actualizado exitosamente.",
  "data": {
    "id": "80000000-0000-4000-8000-000000000001",
    "misionId": "60000000-0000-4000-8000-000000000050",
    "patrullaId": "f1000000-0000-4000-8000-000000000001",
    "estado": "RECIBIDA",
    "intentosEnvio": 1,
    "creadaAt": "2026-11-09T22:00:00.000Z",
    "enviadaAt": "2026-11-09T22:00:01.000Z",
    "recibidaAt": "2026-11-09T22:00:04.120Z",
    "leidaAt": null
  }
}
```

#### 5.2.2 Confirmación Operativa de Lectura (ACK 'LEIDA')
```bash
curl -X PATCH http://localhost:3000/api/terreno/notificaciones/80000000-0000-4000-8000-000000000001/estado \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_PATRULLA_VERIFICADORA>" \
  -d '{"estado": "LEIDA"}'
```

**Respuesta HTTP/JSON (200 OK):**
```json
{
  "message": "Estado de notificación actualizado exitosamente.",
  "data": {
    "id": "80000000-0000-4000-8000-000000000001",
    "misionId": "60000000-0000-4000-8000-000000000050",
    "patrullaId": "f1000000-0000-4000-8000-000000000001",
    "estado": "LEIDA",
    "intentosEnvio": 1,
    "creadaAt": "2026-11-09T22:00:00.000Z",
    "enviadaAt": "2026-11-09T22:00:01.000Z",
    "recibidaAt": "2026-11-09T22:00:04.120Z",
    "leidaAt": "2026-11-09T22:00:15.845Z"
  }
}
```

#### 5.2.3 Reconciliación de Órdenes Pendientes tras Pérdida de Conectividad (Offline-First)
```bash
curl -X GET http://localhost:3000/api/terreno/misiones/pendientes \
  -H "Authorization: Bearer <TOKEN_PATRULLA_VERIFICADORA>"
```

**Respuesta HTTP/JSON (200 OK):**
```json
{
  "message": "Misiones pendientes obtenidas exitosamente.",
  "data": [
    {
      "misionId": "60000000-0000-4000-8000-000000000050",
      "codigoMision": "MIS-2026-0042",
      "tipoMision": "VERIFICACION",
      "estadoMision": "DESPACHADA",
      "incidenteId": "50000000-0000-4000-8000-000000000001",
      "incidenteCodigo": "INC-2026-0089",
      "incidenteFolio": "FOL-1042",
      "tipoAfectacion": "Inundación por desborde",
      "prioridad": "ALTA",
      "direccion": "Av. Simpson con Errázuriz",
      "latitud": -39.8142,
      "longitud": -73.2459,
      "instrucciones": "Verificar anegamiento de calzada.",
      "asignadoEn": "2026-11-09T22:00:00.000Z",
      "notificacionId": "80000000-0000-4000-8000-000000000001",
      "estadoNotificacion": "PENDIENTE_ENVIO",
      "enviadaAt": null
    }
  ],
  "total": 1
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA)

| Criterio de Aceptación (HU-35) | Componentes Técnicos Implementados | Casos de Prueba Asociados | Estado de Cobertura |
|---|---|---|:---:|
| **CA-01: Suscripción e Identificación de Canal:** PWA suscrita a `patrulla:{id}` y emisión dirigida al canal de la patrulla. | `src/lib/socket/index.ts` (`notificarMisionAsignada`, `tieneConexionEnSala`) | `CP-H35-API-01`, `CP-H35-API-16` | 🟢 Cumplido al 100% |
| **CA-02: Persistencia y Máquina de Estados:** Transición auditable en UTC: `PENDIENTE_ENVIO` → `ENVIADA` → `RECIBIDA` → `LEIDA`. | `src/lib/db/migrations/061_notificaciones_mision.ts`, `notificacion-mision.repository.ts` | `CP-H35-API-01` a `CP-H35-API-07`, `BUG-H35-API-03` | 🟢 Cumplido al 100% |
| **CA-03: Contenido Mínimo del Payload:** Exposición de `notificacionId`, código de misión/incidente, folio, dirección, afectación y prioridad. | `src/lib/socket/types.ts` (`MisionAsignadaPayload`), `mision.service.ts` | `CP-H35-API-01`, `CP-H35-API-08` | 🟢 Cumplido al 100% |
| **CA-04: Acuse de Recibo Automático (ACK Técnico):** `PATCH /api/terreno/notificaciones/{id}/estado` transita a `RECIBIDA` y notifica a Central. | `src/app/api/terreno/notificaciones/[id]/estado/route.ts`, `notificarTrazabilidadActualizada` | `CP-H35-API-03`, `CP-H35-API-05`, `CP-H35-API-16` | 🟢 Cumplido al 100% |
| **CA-05: Acuse de Lectura Operativo (ACK Lectura):** Transición a `LEIDA` con marca `leida_at` y redirección en frontend. | `notificacion-mision.service.ts`, `notificacion-mision.repository.ts` | `CP-H35-API-04`, `CP-H35-API-06`, `CP-H35-API-07` | 🟢 Cumplido al 100% |
| **CA-06: Soporte Offline-First y Reconciliación:** `GET /api/terreno/misiones/pendientes` entrega órdenes estancadas en `PENDIENTE_ENVIO` o `ENVIADA`. | `src/app/api/terreno/misiones/pendientes/route.ts`, `listarMisionesPendientesTerrenoRepo` | `CP-H35-API-02`, `CP-H35-API-08`, `CP-H35-API-09` | 🟢 Cumplido al 100% |
| **CA-07: Seguridad y Control de Acceso RBAC:** Validación de permiso `misiones:terreno:verificar` y pertenencia a la patrulla destinataria. | `src/modules/seguridad/auth.guard.ts`, `verificarUsuarioPerteneceAPatrulla` | `CP-H35-API-10` a `CP-H35-API-13` | 🟢 Cumplido al 100% |
| **CA-08: Idempotencia y No Retroceso:** Prohibición de degradar `LEIDA` a `RECIBIDA` e inmutabilidad de timestamps ante reintentos. | `notificacion-mision.repository.ts` (`PRIORIDAD_ESTADO`, `COALESCE`) | `CP-H35-API-05`, `CP-H35-API-06`, `BUG-H35-API-03` | 🟢 Cumplido al 100% |

---

## 7. Extensión de Contrato OpenAPI y Proyección Persistente para Centro de Mando (`12/11/2026`)

Para habilitar la reconstrucción persistente del último estado de notificación tras recargas en `sgrai-web` (`BUG-H35-WEB-06` / `TC-H35-WEB-18`) manteniendo sincronizado el cliente generado desde OpenAPI (`api-generated.d.ts`), se incorporaron los siguientes ajustes verificados en `feature/h35-notificacion-mision-patrulla-pwa`:

1. **Proyección de `trazabilidadNotificacion` en consultas operativas (`2e72aa8`):**
   - `GET /api/incidentes` (`incidente-kanban.repository.ts` / `incidente-kanban.service.ts` / `incidente-kanban.schema.ts`): incluye el campo opcional `trazabilidadNotificacion` (`PENDIENTE_ENVIO` | `ENVIADA` | `RECIBIDA` | `LEIDA`) derivado del registro más reciente en `notificaciones_mision` asociado a las misiones del incidente.
   - `GET /api/incidentes/{id}` (`MisionDetalleSchema`): cada misión del arreglo `data.misiones` expone `trazabilidadNotificacion` persistida en base de datos.
   - `GET /api/misiones` y `GET /api/misiones/{id}` (`mision-listado.*`, `mision.*`): exponen `trazabilidadNotificacion` en sus esquemas Zod, consultas SQL y mapeos de servicio.
2. **Completitud del registro OpenAPI en `src/lib/openapi/index.ts` (`90fd047`):**
   - Registro de `ListarCuadrillasQuerySchema` y cabeceras opcionales (`authorization`, `x-user-id`) en `GET /api/cuadrillas`, `GET /api/cuadrillas/{id}`, `DELETE /api/cuadrillas/{id}` y `POST /api/misiones`.
   - Marcado `required: true` en el cuerpo de `POST /api/misiones` y tipificación explícita de respuestas de error `400`/`401`/`403`/`404`/`409`/`500` con `MensajeGenericoResponseSchema` en `DELETE /api/cuadrillas/{id}` y `POST /api/misiones`.
3. **Pruebas unitarias de regresión y validación integral (`5b0c9a7`):**
   - Aserciones agregadas en `src/modules/incidentes/__tests__/incidente-kanban.service.test.ts` y `src/modules/misiones/__tests__/mision-listado.test.ts`.
   - Validación ejecutada el `12/11/2026`:
     - `npx tsc --noEmit`: `0` errores.
     - `npm test`: `Test Files 64 passed (64)` | `Tests 772 passed (772)`.
     - `npm run lint`: `0 errors` (`11` warnings preexistentes fuera del alcance de HU-35).
     - `npm run build`: compilación de producción (`next build`) completada con `0` errores.
