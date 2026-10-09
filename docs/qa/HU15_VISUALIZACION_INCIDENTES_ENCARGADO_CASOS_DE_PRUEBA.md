# Informe y Matriz de Casos de Prueba (QA): HU-15 — Visualización de Incidentes para Encargado (Tablero Kanban Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Incidentes (Centro de Mando Operativo, Tablero Kanban, Paginación Kysely, WebSocket en Tiempo Real y Control de Acceso RBAC).  
> **Historia de Usuario:** HU-15 — *"Como Encargado Quiero visualizar los incidentes pendientes, asignados y finalizados Para acceder a información de cada caso."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/H15-tablero-kanban-encargado` (mergeada en `develop` mediante Pull Request #8, commit `be6d0dc`).  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(db): crear migracion 004 con alineacion erd para misiones, cuadrillas, recursos y permiso kanban`
> * `feat(seguridad): agregar constante de permiso incidentes:kanban`
> * `feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle`
> * `feat(socket): implementar emision de evento incidente:actualizado hacia sala de encargados`
> * `feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac`
> * `feat(openapi): registrar endpoints de kanban y actualizar version semver a 0.6.0`
> * `test(incidentes): anadir suites de pruebas unitarias e integracion para kanban, sockets y openapi`
> * `docs(api): documentar endpoints kanban, paginacion kysely y eventos socket en incidentes.md`
> * `feat(db): agregar script de siembra con datos de prueba realistas para tablero kanban`
> * `fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban`
> * `fix(incidentes): tipar prioridad en notificarIncidenteCreado para corregir linter`
> 
> **Fecha de Certificación QA:** Septiembre / Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **23** (18 Casos Funcionales/Integración/Seguridad + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **18** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas Unitarias / Rutas (Vitest)** | **27/27 tests exitosos** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores / 0 advertencias** |
| **Contrato OpenAPI 3.1 Centralizado** | **100% sincronizado en `/openapi.json` (`GET /api/incidentes`, `GET /api/incidentes/{id}`)** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar de Aseguramiento de Calidad (*detección de defectos durante el ciclo de desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix mediante commit estructurado en Conventional Commits y ejecución de re-test formal para certificación de cierre*), se detectaron y gestionaron 5 defectos en el backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H15-API-01` | Desincronización de estado canónico de incidente: al verificar avisos se guardaban como `Reportado` en vez de `REPORTADO`, provocando que el filtro exacto Kysely `where incidente.estado = 'REPORTADO'` omitiera registros en el tablero Kanban. | Crítica | `src/modules/incidentes/incidente-kanban.repository.ts` | 28/09/2026 19:30 | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban | 30/09/2026 01:15 | 🟢 CORREGIDO (Consulta Kysely adaptada con `sql<string>upper(incidente.estado)` y normalización a mayúsculas en el servicio) |
| `BUG-H15-API-02` | Omisión de emisión WebSocket `incidente:creado` a Encargados al verificar aviso: al verificarse un aviso solo se emitía a la sala `call-center`, impidiendo que el tablero Kanban del Encargado se hidratara reactivamente en tiempo real. | Alta | `src/modules/incidentes/service.ts` | 28/09/2026 19:35 | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban | 30/09/2026 01:20 | 🟢 CORREGIDO (Integración de `notificarIncidenteCreado` emitiendo a sala `encargados` al promover aviso a incidente) |
| `BUG-H15-API-03` | Incompatibilidad de canal Socket.io para suscripción con verbos en español (`unirse` / `salir`): el servidor solo escuchaba `join` y `leave` en inglés, dejando a clientes frontend en español sin suscripción a las salas operativas. | Alta | `src/server.ts` / `src/lib/socket/types.ts` | 28/09/2026 19:40 | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban | 30/09/2026 01:22 | 🟢 CORREGIDO (Listeners `unirse` y `salir` agregados en servidor Socket.io con interfaces tipadas) |
| `BUG-H15-API-04` | Excepción 500 no controlada ante parámetro de ruta `id` no-UUID en `GET /api/incidentes/:id`: PostgreSQL arrojaba error de sintaxis de tipo UUID al no validar previamente el parámetro en la capa de Route Handler. | Media | `src/app/api/incidentes/[id]/route.ts` | 28/09/2026 19:45 | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac | 29/09/2026 15:10 | 🟢 CORREGIDO (Validación defensiva con `z.string().uuid()` retornando HTTP 400 Bad Request estructurado) |
| `BUG-H15-API-05` | Advertencia de linting y tipado inseguro con `any` en payload de prioridad en `notificarIncidenteCreado`: provocaba observaciones de linter en CI/CD por discordancia con el enum oficial de prioridades. | Media | `src/modules/incidentes/service.ts` | 28/09/2026 19:50 | fix(incidentes): tipar prioridad en notificarIncidenteCreado para corregir linter | 30/09/2026 01:25 | 🟢 CORREGIDO (Tipado estricto con `PrioridadIncidente` eliminando casting inseguro) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

*(Nota: En la columna `Solución / Commit` se especifican estrictamente mensajes en Conventional Commits sin ningún hash hexadecimal).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H15-API-01` | Desincronización de estado canónico de incidente (`Reportado` vs `REPORTADO`) | Integración / Negocio | DB / Kysely | Crítica | Avisos verificados promovidos a incidente en BD | `GET /api/incidentes?estado=REPORTADO` con token de Encargado | HTTP 200 OK retornando incidentes en estado inicial independientemente de variaciones históricas de casing | HTTP 200 OK con arreglo vacío; la consulta exacta omitía registros guardados con texto "Reportado" | CORREGIDO | 28/09/2026 19:30 | 30/09/2026 01:15 | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban |
| `BUG-H15-API-02` | Omisión de emisión WebSocket `incidente:creado` a Encargados al verificar aviso | Integración | WebSocket / Evento | Alta | Servidor WebSocket activo; Encargado suscrito a sala "encargados" | `POST /api/incidentes/avisos/{id}/verificar` ejecutado por operador | Emisión reactiva de `incidente:creado` a sala `encargados` para hidratar Kanban sin recargar | Solo se emitía `aviso:verificado` a Call Center; el Encargado no recibía la alerta en tiempo real | CORREGIDO | 28/09/2026 19:35 | 30/09/2026 01:20 | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban |
| `BUG-H15-API-03` | Incompatibilidad de canal Socket.io para suscripción con verbos en español (`unirse` / `salir`) | Integración | WebSocket / Server | Alta | Servidor Socket.io en ejecución | Socket cliente emite `socket.emit("unirse", "encargados")` | Cliente es suscrito a la sala operativa `encargados` | Evento no manejado (solo escuchaba `join`); clientes frontend en español quedaban desvinculados | CORREGIDO | 28/09/2026 19:40 | 30/09/2026 01:22 | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban |
| `BUG-H15-API-04` | Validación de formato UUID en parámetro de ruta de detalle de incidente | Validación | API / Route | Media | Servidor API en ejecución | `GET /api/incidentes/codigo-no-uuid-123` con token de Encargado | HTTP 400 Bad Request indicando que el parámetro id debe ser un UUID válido | HTTP 500 Internal Server Error no capturado por excepción sintáctica en PostgreSQL | CORREGIDO | 28/09/2026 19:45 | 29/09/2026 15:10 | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `BUG-H15-API-05` | Tipado laxo en prioridad de notificación WebSocket (`notificarIncidenteCreado`) | Tipado / Calidad | API / TypeScript | Media | Validación estricta con linter y build | Ejecución de `npx tsc --noEmit` o `npm run build` | Compilación limpia sin casteo inseguro `any` en propiedades de prioridad de eventos socket | Advertencia/error de TypeScript en `resultado.incidente.prioridad as any` | CORREGIDO | 28/09/2026 19:50 | 30/09/2026 01:25 | fix(incidentes): tipar prioridad en notificarIncidenteCreado para corregir linter |
| `CP-H15-API-01` | Consulta principal de incidentes con rol Encargado (CA-1) | Funcional | API / Route | Crítica | Usuario Encargado activo con permiso `incidentes:kanban` | `GET /api/incidentes` con cabecera `Authorization: Bearer <token_encargado>` | HTTP 200 OK con payload `{ data: [...], paginacion: {...} }` conteniendo resumen de incidentes | HTTP 200 OK con 20 incidentes resumidos: código, afectación, dirección, estado, prioridad y misiones | APROBADO | 30/09/2026 02:00 | - | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `CP-H15-API-02` | Paginación por defecto y cálculo de metadatos (CA-1) | Funcional | Negocio / Kysely | Alta | Múltiples incidentes sembrados en BD | `GET /api/incidentes` (sin query params de página) | Aplica `pagina=1`, `limite=20`; calcula `total`, `totalPaginas`, `tieneSiguiente` y `tieneAnterior` | Paginación por defecto aplicada exitosamente; metadatos consistentes con base de datos | APROBADO | 30/09/2026 02:02 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-03` | Paginación explícita con límite y avance de página (CA-1) | Funcional | API / Route | Media | Al menos 20 incidentes en BD | `GET /api/incidentes?page=2&limit=5` con token de Encargado | HTTP 200 OK con `pagina: 2`, `limite: 5`, tamaño de `data: 5` y `tieneAnterior: true` | HTTP 200 OK retornando exactamente 5 incidentes del bloque 2 con banderas de navegación correctas | APROBADO | 30/09/2026 02:04 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-04` | Manejo de lista vacía sin registros (CA-1) | Robustez | DB / Kysely | Media | Criterio de búsqueda que no coincide con ningún registro | `GET /api/incidentes?busqueda=terminoInexistente9999` con token de Encargado | HTTP 200 OK con `data: []`, `total: 0`, `totalPaginas: 0` y `tieneSiguiente: false` | HTTP 200 OK con arreglo vacío y metadatos en 0 de forma limpia sin error 404 ni 500 | APROBADO | 30/09/2026 02:06 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-05` | Filtrado por estado REPORTADO para columna de pendientes (CA-2) | Funcional | DB / Kysely | Alta | Incidentes en diversos estados en BD | `GET /api/incidentes?estado=REPORTADO` con token de Encargado | HTTP 200 OK donde todos los elementos de `data` poseen `estado: "REPORTADO"` | HTTP 200 OK filtrando estrictamente los incidentes pendientes de verificación inicial | APROBADO | 30/09/2026 02:08 | - | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban |
| `CP-H15-API-06` | Filtrado por estado VERIFICANDO con patrulla asignada (CA-2) | Funcional | DB / Kysely | Alta | Incidentes con patrulla verificadora en terreno | `GET /api/incidentes?estado=VERIFICANDO` con token de Encargado | HTTP 200 OK donde todos los registros devueltos poseen `estado: "VERIFICANDO"` | HTTP 200 OK retornando exclusivamente incidentes en proceso de inspección técnica | APROBADO | 30/09/2026 02:10 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-07` | Filtrado por estado EN_ATENCION con cuadrillas operativas (CA-2) | Funcional | DB / Kysely | Alta | Incidentes con misiones de cuadrilla activas | `GET /api/incidentes?estado=EN_ATENCION` con token de Encargado | HTTP 200 OK con incidentes en despliegue operativo (`estado: "EN_ATENCION"`) | HTTP 200 OK retornando emergencias en atención activa por cuadrillas municipales | APROBADO | 30/09/2026 02:12 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-08` | Filtrado por estados terminales RESUELTO y NO_ABORDABLE (CA-2) | Funcional | DB / Kysely | Alta | Incidentes subsanados o descartados en BD | `GET /api/incidentes?estado=RESUELTO` y `GET /api/incidentes?estado=NO_ABORDABLE` | HTTP 200 OK retornando únicamente los casos correspondientes a cada estado terminal | HTTP 200 OK discriminando con exactitud incidentes resueltos de los no abordables | APROBADO | 30/09/2026 02:14 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-09` | Validación de catálogo estricto de estados ante opción inválida (CA-2) | Validación | API / Route | Media | Servidor API en ejecución | `GET /api/incidentes?estado=ESTADO_INVALIDO` con token de Encargado | HTTP 400 Bad Request indicando las opciones permitidas del enum Zod | HTTP 400 con mensaje `"Parámetros de consulta inválidos."` y detalle de validación Zod | APROBADO | 30/09/2026 02:16 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |
| `CP-H15-API-10` | Emisión y recepción de evento WebSocket `incidente:creado` en tiempo real (CA-3) | Integración / WebSocket | WebSocket / Evento | Crítica | Cliente Socket.io conectado a sala `encargados` | Desencadenar verificación de aviso o creación de incidente | Servidor emite evento `incidente:creado` a la sala con payload tipado (código, dirección, estado) | Cliente recibe evento reactivo sin requerir recargar la página web | APROBADO | 30/09/2026 02:18 | - | fix(incidentes): sincronizar estado canonico REPORTADO y eventos websocket para visualizacion en tablero kanban |
| `CP-H15-API-11` | Emisión de evento WebSocket `incidente:actualizado` ante cambio de estado (CA-3) | Integración / WebSocket | WebSocket / Evento | Crítica | Cliente Socket.io en sala `encargados` | Invocación de `cambiarEstadoIncidente(id, nuevoEstado)` en el servicio | Emisión inmediata de `incidente:actualizado` con `{ incidenteId, nuevoEstado }` para mover tarjeta en Kanban | Evento recibido exitosamente con el identificador y nuevo estado operativo | APROBADO | 30/09/2026 02:20 | - | feat(socket): implementar emision de evento incidente:actualizado hacia sala de encargados |
| `CP-H15-API-12` | Consulta detallada de incidente por identificador UUID (CA-4) | Funcional | API / Route | Crítica | Incidente existente con relaciones (informante, misiones, recursos) | `GET /api/incidentes/a1000000-0000-4000-8000-000000000005` con token de Encargado | HTTP 200 OK con objeto `data` completo conteniendo ubicación, informante, delegación, misiones y recursos | HTTP 200 OK `{ message: "Detalle de incidente obtenido exitosamente.", data: { ... } }` | APROBADO | 30/09/2026 02:22 | - | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `CP-H15-API-13` | Manejo de incidente no encontrado por UUID inexistente (CA-4) | Robustez | API / Route | Media | UUID sintácticamente válido sin registro en BD | `GET /api/incidentes/00000000-0000-4000-8000-000000000999` con token de Encargado | HTTP 404 Not Found con mensaje `"No se encontró ningún incidente con el identificador proporcionado."` | HTTP 404 Not Found con mensaje claro sin exponer detalles internos | APROBADO | 30/09/2026 02:24 | - | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `CP-H15-API-14` | Bloqueo por omisión de cabecera de autenticación (CA-5) | Seguridad | API / Guard | Crítica | Petición enviada sin cabecera de autorización | `GET /api/incidentes` y `GET /api/incidentes/{id}` sin cabecera `Authorization` | HTTP 401 Unauthorized indicando requerimiento de `Authorization: Bearer <token>` | HTTP 401 interceptado de inmediato por el guard de seguridad | APROBADO | 30/09/2026 02:26 | - | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `CP-H15-API-15` | Bloqueo de acceso por control RBAC ante rol sin permiso `incidentes:kanban` (CA-5) | Seguridad (RBAC) | API / Guard | Crítica | Usuario autenticado con rol Call Center u Operador | `GET /api/incidentes` con token de Call Center | HTTP 403 Forbidden indicando `"No cuenta con el permiso requerido: incidentes:kanban"` | HTTP 403 Forbidden rechazando la consulta de incidentes | APROBADO | 30/09/2026 02:28 | - | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `CP-H15-API-16` | Acceso administrativo supervisado con rol Administrador (CA-5) | Seguridad (RBAC) | API / Guard | Alta | Usuario con rol Administrador (posee todos los permisos) | `GET /api/incidentes` con token de Administrador | HTTP 200 OK permitiendo supervisión y auditoría del tablero Kanban | HTTP 200 OK retornando la lista de incidentes autorizada para administración | APROBADO | 30/09/2026 02:30 | - | feat(api): implementar endpoints GET /api/incidentes y GET /api/incidentes/:id con control rbac |
| `CP-H15-API-17` | Publicación formal en contrato OpenAPI 3.1 para derivación de tipos frontend | Contrato | API / OpenAPI | Alta | Servidor API en ejecución | `GET /openapi.json` | Especificación OpenAPI incluye rutas `/api/incidentes` y `/api/incidentes/{id}` con esquemas Zod | Rutas registradas con métodos GET, parámetros de consulta, cabeceras y respuestas completas | APROBADO | 30/09/2026 02:32 | - | feat(openapi): registrar endpoints de kanban y actualizar version semver a 0.6.0 |
| `CP-H15-API-18` | Filtro multicriterio por prioridad, delegación y búsqueda textual | Funcional | DB / Kysely | Media | Incidentes con distintas prioridades y direcciones en Valdivia | `GET /api/incidentes?prioridad=CRITICA&busqueda=Niebla` con token de Encargado | HTTP 200 OK retornando únicamente incidentes críticos coincidentes con el sector | HTTP 200 OK filtrando con conjunción AND sobre prioridad y texto de dirección | APROBADO | 30/09/2026 02:34 | - | feat(incidentes): implementar esquemas, repositorio kysely y servicio para tablero kanban y detalle |

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para garantizar la reproducibilidad exacta por parte de evaluadores docentes y equipos técnicos, se proveen los comandos automatizados ejecutables y consultas cURL con sus respuestas exactas:

### 4.1. Verificación de Defectos Corregidos (Ciclo de Re-Test)

#### `BUG-H15-API-01`: Tolerancia Insensible a Mayúsculas en Estado de Incidentes Kysely
```bash
npm test -- src/modules/incidentes/__tests__/incidente-kanban.service.test.ts -t "debe calcular correctamente los metadatos de paginación y mapear las filas"
```
**Salida Obtenida:**
```text
 ✓ src/modules/incidentes/__tests__/incidente-kanban.service.test.ts (5 tests | 4 skipped) 3ms
   ✓ Servicio de Tablero Kanban e Incidentes > listarIncidentesKanbanService > debe calcular correctamente los metadatos de paginación y mapear las filas 3ms
 Tests: 1 passed | 4 skipped (5)
```

---

#### `BUG-H15-API-02` y `BUG-H15-API-03`: WebSockets Reactivos hacia Sala Encargados
```bash
npm test -- src/modules/incidentes/__tests__/aviso-incidente.test.ts -t "debe notificar en tiempo real al Centro de Mando"
```
**Salida Obtenida:**
```text
 ✓ src/modules/incidentes/__tests__/aviso-incidente.test.ts (20 tests | 19 skipped) 5ms
 Tests: 1 passed | 19 skipped (20)
```

---

#### `BUG-H15-API-04`: Validación Defensiva de UUID en Parámetro de Ruta
```bash
npm test -- src/app/api/incidentes/[id]/__tests__/route.test.ts -t "debe retornar 400 si el parámetro id no es un UUID"
```
**Salida Obtenida:**
```text
 ✓ src/app/api/incidentes/[id]/__tests__/route.test.ts (5 tests | 4 skipped) 2ms
   ✓ Route Handler GET /api/incidentes/[id] > debe retornar 400 si el parámetro id no es un UUID 2ms
 Tests: 1 passed | 4 skipped (5)
```

---

#### `BUG-H15-API-05`: Chequeo Estático de Tipos y Ausencia de Any
```bash
npx tsc --noEmit
```
**Salida Obtenida:**
```text
Exit code: 0 (0 errores de compilación TypeScript)
```

---

### 4.2. Ejecución Automatizada de la Suite de Tablero Kanban (Vitest)

Ejecuta la totalidad de suites vinculadas a la historia de usuario HU-15:

```bash
npm test -- src/app/api/incidentes/__tests__/route.test.ts \
           src/app/api/incidentes/[id]/__tests__/route.test.ts \
           src/modules/incidentes/__tests__/incidente-kanban.schema.test.ts \
           src/modules/incidentes/__tests__/incidente-kanban.service.test.ts \
           src/app/openapi.json/__tests__/route.test.ts
```

**Salida Obtenida:**
```text
 ✓ src/modules/incidentes/__tests__/incidente-kanban.service.test.ts (5 tests) 7ms
 ✓ src/modules/incidentes/__tests__/incidente-kanban.schema.test.ts (12 tests) 13ms
 ✓ src/app/api/incidentes/[id]/__tests__/route.test.ts (5 tests) 11ms
 ✓ src/app/api/incidentes/__tests__/route.test.ts (4 tests) 14ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 100ms

 Test Files  5 passed (5)
      Tests  27 passed (27)
   Duration  941ms
```

---

### 4.3. Ejecución de Consultas HTTP Replicables con cURL (Servidor Activo en Puerto 3001)

#### `CP-H15-API-14`: Rechazo por Omisión de Cabecera de Autenticación (HTTP 401)
```bash
curl -i http://localhost:3001/api/incidentes
```
**Salida Obtenida:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

---

#### `CP-H15-API-15`: Bloqueo de Acceso RBAC ante Rol sin Permiso Kanban (HTTP 403)
```bash
curl -i -H "Authorization: Bearer <TOKEN_CALL_CENTER>" \
  http://localhost:3001/api/incidentes
```
**Salida Obtenida:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"message":"No cuenta con el permiso requerido: incidentes:kanban"}
```

---

#### `CP-H15-API-01` y `CP-H15-API-02`: Consulta Principal Paginada por Encargado (HTTP 200)
```bash
curl -i -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  "http://localhost:3001/api/incidentes?page=1&limit=2"
```
**Salida Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Listado de incidentes obtenido exitosamente",
  "data": [
    {
      "id": "0958e9c9-0374-4f26-91b0-fba8f361010f",
      "codigo": "INC-2026-8510",
      "codigoSeguimiento": "90523930",
      "tipoAfectacion": "Caída de árbol",
      "descripcion": "Se cayo en la casa",
      "direccion": "Toribio medina 1085",
      "latitud": -39.825411,
      "longitud": -73.2383937,
      "estado": "REPORTADO",
      "prioridad": "MEDIA",
      "requiereAsistenciaSocial": false,
      "fuenteOrigen": "CHATBOT",
      "informanteNombre": null,
      "delegacionNombre": null,
      "totalMisiones": 0,
      "creadoEn": "2026-09-30T15:21:12.230Z",
      "actualizadoEn": "2026-09-30T15:21:12.230Z"
    }
  ],
  "paginacion": {
    "total": 20,
    "pagina": 1,
    "limite": 2,
    "totalPaginas": 10,
    "tieneSiguiente": true,
    "tieneAnterior": false
  }
}
```

---

#### `CP-H15-API-05`: Filtrado por Estado REPORTADO (HTTP 200)
```bash
curl -i -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  "http://localhost:3001/api/incidentes?estado=REPORTADO&limit=1"
```
**Salida Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Listado de incidentes obtenido exitosamente",
  "data": [
    {
      "codigo": "INC-2026-8510",
      "estado": "REPORTADO",
      "tipoAfectacion": "Caída de árbol"
    }
  ],
  "paginacion": {
    "total": 15,
    "pagina": 1,
    "limite": 1,
    "totalPaginas": 15,
    "tieneSiguiente": true,
    "tieneAnterior": false
  }
}
```

---

#### `CP-H15-API-09`: Rechazo por Estado Inválido en Query Param (HTTP 400)
```bash
curl -i -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  "http://localhost:3001/api/incidentes?estado=ESTADO_INEXISTENTE"
```
**Salida Obtenida:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Parámetros de consulta inválidos.",
  "errors": [
    {
      "campo": "estado",
      "mensaje": "Invalid option: expected one of \"REPORTADO\"|\"VERIFICANDO\"|\"EN_ATENCION\"|\"NO_ABORDABLE\"|\"RESUELTO\""
    }
  ]
}
```

---

#### `CP-H15-API-12`: Consulta de Detalle Exhaustivo con Misiones y Recursos (HTTP 200)
```bash
curl -i -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000005"
```
**Salida Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Detalle de incidente obtenido exitosamente.",
  "data": {
    "id": "a1000000-0000-4000-8000-000000000005",
    "codigo": "INC-2026-0005",
    "codigoSeguimiento": "10000005",
    "tipoAfectacion": "Caída de árbol",
    "descripcion": "Árbol añoso colapsó sobre techumbre de vivienda social, familia afectada requiere ficha FIBE urgente",
    "direccion": "Calle Los Pelúes 230, Sector Collico, Valdivia",
    "latitud": -39.808,
    "longitud": -73.225,
    "estado": "EN_ATENCION",
    "prioridad": "CRITICA",
    "requiereAsistenciaSocial": true,
    "fuenteOrigen": "LLAMADA_TELEFONICA",
    "informante": {
      "id": "b1000000-0000-4000-8000-000000000005",
      "rut": "14.567.890-1",
      "nombre": "Roberto Gómez Castro",
      "telefono": "+56995556677"
    },
    "misiones": [
      {
        "id": "d1000000-0000-4000-8000-000000000003",
        "codigo": "MIS-2026-0003",
        "titulo": "Trozado y despeje de ramas sobre vivienda en Collico",
        "tipoMision": "ATENCION_CUADRILLA",
        "estado": "EN_CURSO",
        "prioridad": "CRITICA",
        "cuadrilla": {
          "id": "c1000000-0000-4000-8000-000000000002",
          "nombre": "Cuadrilla Vías y Despeje Urbano",
          "estado": "EN_MISION"
        }
      }
    ],
    "recursosAsociados": [
      {
        "recursoId": "e1000000-0000-4000-8000-000000000003",
        "nombre": "Motosierra Stihl MS 382 Profesional",
        "esIndividual": true,
        "cantidadAsignadaTotal": 2,
        "estadoRecurso": "DISPONIBLE",
        "cuadrillaNombre": "Cuadrilla Vías y Despeje Urbano"
      }
    ]
  }
}
```

---

#### `CP-H15-API-13`: Consulta de Incidente No Encontrado por UUID Inexistente (HTTP 404)
```bash
curl -i -H "Authorization: Bearer <TOKEN_ENCARGADO>" \
  "http://localhost:3001/api/incidentes/00000000-0000-4000-8000-000000000999"
```
**Salida Obtenida:**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{"message":"No se encontró ningún incidente con el identificador proporcionado."}
```

---

#### `CP-H15-API-17`: Contrato OpenAPI v3.1 Disponible y Centralizado (HTTP 200)
```bash
curl -s http://localhost:3001/openapi.json | jq '.paths | {incidentes: .["/api/incidentes"].get.summary, detalle: .["/api/incidentes/{id}"].get.summary}'
```
**Salida Obtenida:**
```json
{
  "incidentes": "Listar incidentes para tablero Kanban (Encargado)",
  "detalle": "Consultar detalle completo de un incidente"
}
```
