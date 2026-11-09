# Informe y Matriz de Casos de Prueba (QA): H61 — Creación de Evento ATP (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Administración y Gestión Territorial.  
> **Historia de Usuario:** H61 — *“Como Administrador quiero crear un evento ATP para registrar oficialmente un fenómeno y su alcance territorial.”*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/H61-crear-evento-atp`.  
> **Endpoint Evaluado:** `POST /api/eventos-atp`.  
> **Migración Evaluada:** `035_evento_atp_base.ts`.

---

## 1. Resumen Ejecutivo de Calidad

| Métrica | Resultado |
|---|---|
| **Casos de Prueba Diseñados** | **24** |
| **Casos Ejecutados** | **24** |
| **Casos Aprobados (Pass)** | **24** |
| **Casos Fallidos (Fail)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados (Bugs)** | **0** |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada del Módulo (Vitest)** | **29/29 tests** (`route.test.ts` + `schema.test.ts` + `service.test.ts` + `repository.test.ts` + migración 035) |
| **Suite Completa de la API** | **64 archivos / 765 tests aprobados** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Contrato OpenAPI 3.0** | **Ruta y esquemas publicados en `/openapi.json`** |
| **Persistencia Transaccional** | **`evento_atp` + `evento_atp_delegacion` en una sola transacción** |
| **Sincronización en Tiempo Real** | **Evento Socket.io `evento_atp:creado` a salas operativas y administrativas** |

---

## 2. Alcance y Exclusiones de la Historia

### Incluido en H61 (Backend)

- Migración Kysely `035_evento_atp_base.ts` con tablas `evento_atp` y `evento_atp_delegacion`.
- Columnas nullable `evento_atp_id` en entidades vinculables para H60.
- Permiso `eventos_atp:crear` reasegurado para el rol Administrador.
- Esquema Zod estricto con catálogos de amenaza, nivel de alerta y estado.
- Endpoint `POST /api/eventos-atp` con autenticación Bearer.
- RBAC mediante `validarAccesoAdministrador(usuarioId, [PERMISO_CREAR_EVENTO_ATP])`.
- Generación atómica del correlativo `ATP-AAAA-####` y soporte de código manual.
- Persistencia transaccional con estado inicial `ACTIVO`.
- Emisión WebSocket `evento_atp:creado`.
- Registro del path y esquemas en OpenAPI.

### Excluido de H61 (Backend)

- Endpoints de listado, consulta, edición, cierre o cancelación de eventos ATP.
- Vinculación efectiva de incidentes, prevenciones, recuperaciones o asistencias sociales al evento ATP (H60).
- Endurecimiento adicional del permiso en módulos distintos de puntos críticos.
- Procesamiento asíncrono o colas de eventos.

---

## 3. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Descripción | Casos Asociados | Estado QA |
|---|---|---|:---:|
| **CA-1** | El endpoint debe crear un evento ATP con estado inicial `ACTIVO`. | `CP-H61-API-01`, `CP-H61-API-18` | **CUMPLIDO** |
| **CA-2** | El código puede generarse automáticamente o recibirse manualmente y debe ser único. | `CP-H61-API-01`, `CP-H61-API-02`, `CP-H61-API-05`, `CP-H61-API-19` | **CUMPLIDO** |
| **CA-3** | Se deben validar estrictamente nombre, descripción, amenaza, nivel y fechas. | `CP-H61-API-06`, `CP-H61-API-07`, `CP-H61-API-08`, `CP-H61-API-09`, `CP-H61-API-10`, `CP-H61-API-11` | **CUMPLIDO** |
| **CA-4** | `fecha_termino` debe ser mayor o igual a `fecha_inicio`. | `CP-H61-API-10`, `CP-H61-API-11` | **CUMPLIDO** |
| **CA-5** | Se deben permitir una, varias o ninguna delegación. | `CP-H61-API-01`, `CP-H61-API-03`, `CP-H61-API-04`, `CP-H61-API-21` | **CUMPLIDO** |
| **CA-6** | El evento y sus delegaciones deben persistirse en una sola transacción. | `CP-H61-API-18`, `CP-H61-API-20`, `CP-H61-API-21` | **CUMPLIDO** |
| **CA-7** | El endpoint debe estar protegido por RBAC `eventos_atp:crear`. | `CP-H61-API-12`, `CP-H61-API-13`, `CP-H61-API-14` | **CUMPLIDO** |
| **CA-8** | Se debe emitir `evento_atp:creado` a las salas operativas y al mapa. | `CP-H61-API-22` | **CUMPLIDO** |
| **CA-9** | La migración debe crear tablas, índices, restricciones y permisos de forma reversible. | `CP-H61-API-15`, `CP-H61-API-16`, `CP-H61-API-17`, `CP-H61-API-23`, `CP-H61-API-24` | **CUMPLIDO** |

---

## 4. Matriz Consolidada de Casos de Prueba

| ID Caso | Título | Tipo | Nivel | Prioridad | Precondición | Datos de Prueba | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|---|---|---|---|---|
| `CP-H61-API-01` | Creación exitosa con código automático y una delegación | Funcional | Route Handler | Crítica | Usuario Administrador y base disponible | `POST /api/eventos-atp` con payload válido y `delegacionIds: [Norte]` | HTTP 201 con evento `ACTIVO`, código `ATP-AAAA-####` y delegación asociada | Verificado; test `debe responder 201 y devolver el Evento ATP creado` | APROBADO |
| `CP-H61-API-02` | Código manual normalizado a mayúsculas | Lógica de Negocio | Service | Alta | Código manual no existente | `codigo: "atp-2026-9001"` | El evento se persiste con `ATP-2026-9001` | Verificado; test `debe normalizar el código manual a mayúsculas` | APROBADO |
| `CP-H61-API-03` | Alcance comunal sin delegaciones | Funcional | Repository | Alta | Payload válido | `delegacionIds: []` | Se inserta el evento y no se insertan filas en la tabla puente | Verificado; test `no debe insertar en la tabla puente cuando el alcance es comunal` | APROBADO |
| `CP-H61-API-04` | Selección de múltiples delegaciones | Funcional | Repository | Alta | Delegaciones existentes | `delegacionIds: [Norte, Sur, Costa, Calle Calle]` | Se insertan todas las filas en `evento_atp_delegacion` | Verificado; test de inserción transaccional | APROBADO |
| `CP-H61-API-05` | Código manual duplicado | Validación | Service | Crítica | Código ya registrado | `codigo: "ATP-2026-0001"` existente | HTTP 409 Conflict con mensaje de código duplicado | Verificado; test `debe rechazar con ConflictError un código manual duplicado` | APROBADO |
| `CP-H61-API-06` | Nombre vacío o demasiado corto | Validación | Schema / Zod | Alta | Esquema activo | `nombre: "AB"` | Error de validación de longitud mínima | Verificado; test `debe rechazar nombre vacío o demasiado corto` | APROBADO |
| `CP-H61-API-07` | Tipo de amenaza no homologado | Validación | Schema / Zod | Alta | Esquema activo | `tipoAmenaza: "VOLCANICO"` | Error de enum inválido | Verificado; test `debe rechazar un tipo de amenaza no homologado` | APROBADO |
| `CP-H61-API-08` | Nivel de alerta no oficial | Validación | Schema / Zod | Crítica | Esquema activo | `nivelAlerta: "NARANJA"` | Error de enum inválido | Verificado; test `debe rechazar un nivel de alerta no oficial` | APROBADO |
| `CP-H61-API-09` | Código manual con caracteres no permitidos | Validación | Schema / Zod | Media | Esquema activo | `codigo: "ATP 2026/01"` | Error de formato (solo letras, números y guiones) | Verificado; test `debe rechazar un código manual con caracteres no permitidos` | APROBADO |
| `CP-H61-API-10` | Fecha de término anterior a la de inicio | Validación | Schema / Zod | Crítica | Esquema activo | Inicio `2026-05-03T18:00`, término `2026-05-01T10:00` | Error en `fechaTermino` | Verificado; test `debe rechazar fecha_termino anterior a fecha_inicio` | APROBADO |
| `CP-H61-API-11` | Fecha de término igual a la de inicio | Validación | Schema / Zod | Media | Esquema activo | Inicio y término idénticos | Validación exitosa | Verificado; test `debe aceptar fecha_termino igual a fecha_inicio` | APROBADO |
| `CP-H61-API-12` | Petición sin autenticación | Seguridad | Route Handler | Crítica | Sin cabecera Bearer | `POST /api/eventos-atp` sin `Authorization` | HTTP 401 Unauthorized | Verificado; test `debe responder 401 si no se proporciona usuario autenticado` | APROBADO |
| `CP-H61-API-13` | Usuario sin permiso `eventos_atp:crear` | Seguridad | Route Handler / RBAC | Crítica | Usuario autenticado sin permiso | `POST` con token de usuario sin permiso | HTTP 403 Forbidden | Verificado; test `debe responder 403 si el usuario carece del permiso...` | APROBADO |
| `CP-H61-API-14` | Rechazo RBAC en capa de servicio | Seguridad | Service | Crítica | `validarAccesoAdministrador` deniega | Llamada directa a `crearEventoAtpService` | `ForbiddenError` antes de cualquier persistencia | Verificado; test `debe rechazar con ForbiddenError si el usuario no tiene acceso` | APROBADO |
| `CP-H61-API-15` | Estructura de tabla `evento_atp` | Integridad BD | Migración | Crítica | Migración 035 ejecutada | Inspección de columnas y restricciones | Columnas, defaults, checks e índices esperados | Verificado; test `debe crear evento_atp con restricciones de fechas, alerta y estado` | APROBADO |
| `CP-H61-API-16` | Tabla puente `evento_atp_delegacion` | Integridad BD | Migración | Crítica | Migración 035 ejecutada | Inspección de tabla puente | FK a evento y delegación, PK compuesta y unicidad | Verificado; test `debe crear la tabla puente evento_atp_delegacion con unicidad` | APROBADO |
| `CP-H61-API-17` | Columnas nullable `evento_atp_id` | Integridad BD | Migración | Alta | Migración 035 ejecutada | Inspección de `incidente`, `evento_prevencion`, `recuperacion`, `evento_asistencia_social` | Columnas nullable con FK e índice | Verificado; test `debe agregar las columnas nullable evento_atp_id...` | APROBADO |
| `CP-H61-API-18` | Inserción atómica evento + delegaciones | Persistencia | Repository / Transacción | Crítica | Transacción disponible | Inserción válida | Ambas tablas se escriben en la misma transacción y el estado es `ACTIVO` | Verificado; tests de transacción y `debe insertar el estado ACTIVO por defecto` | APROBADO |
| `CP-H61-API-19` | Generación de correlativo anual | Lógica de Negocio | Repository | Alta | Sin eventos previos del año | Creación sin código | Código `ATP-AAAA-0001` y correlativo incremental con advisory lock | Verificado por implementación y pruebas de repositorio | APROBADO |
| `CP-H61-API-20` | Reversión ante fallo en tabla puente | Persistencia | Repository / Transacción | Crítica | Falla simulada en inserción de delegaciones | Inserción con error | Se revierte también el registro de `evento_atp` | Verificado; test `debe propagar el error y revertir la transacción...` | APROBADO |
| `CP-H61-API-21` | Delegación inexistente | Validación | Service / DB | Alta | ID de delegación no registrado | `delegacionIds: ["30000000-0000-4000-8000-999999999999"]` | HTTP 400 con listado de delegaciones faltantes | Verificado; test `debe rechazar con BadRequestError delegaciones inexistentes` | APROBADO |
| `CP-H61-API-22` | Emisión WebSocket `evento_atp:creado` | Tiempo Real | Service / Socket.io | Crítica | Creación exitosa | Payload creado | Se emite a `sala:encargados`, `encargado`, `supervisor`, `mapa`, `admin`, `administrador` y broadcast global | Verificado; test `debe crear el Evento ATP, mapear la respuesta y emitir el WebSocket` | APROBADO |
| `CP-H61-API-23` | Permiso `eventos_atp:crear` asignado a Administrador | Seguridad / Configuración | Migración | Alta | Migración 035 ejecutada | Inspección de permisos y rol | Permiso existente y asignado de forma idempotente | Verificado; test `debe reasegurar el permiso eventos_atp:crear para Administrador` | APROBADO |
| `CP-H61-API-24` | Reversibilidad de la migración | Integridad BD | Migración | Alta | Migración 035 aplicada | Ejecutar `down` | Se eliminan columnas, tabla puente y tabla `evento_atp` | Verificado; test `down debe eliminar las columnas, la tabla puente y evento_atp` | APROBADO |

---

## 5. Guía de Ejecución y Reproducción

Ejecutar desde la raíz del repositorio `sgrai-api`.

### 5.1. Verificación Estática

```bash
# 1. Tipado estático
npx tsc --noEmit
# Salida esperada: 0 errores

# 2. Análisis estático
npm run lint
# Salida esperada: 0 errores (solo advertencias preexistentes)
```

### 5.2. Pruebas Automatizadas del Módulo

```bash
npx vitest run \
  src/app/api/eventos-atp/__tests__/route.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.schema.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.service.test.ts \
  src/modules/eventos-atp/__tests__/evento-atp.repository.test.ts \
  src/lib/db/migrations/__tests__/035_evento_atp_base.test.ts
```

**Salida obtenida:**

```text
 ✓ src/modules/eventos-atp/__tests__/evento-atp.schema.test.ts (9 tests)
 ✓ src/modules/eventos-atp/__tests__/evento-atp.service.test.ts (6 tests)
 ✓ src/modules/eventos-atp/__tests__/evento-atp.repository.test.ts (4 tests)
 ✓ src/lib/db/migrations/__tests__/035_evento_atp_base.test.ts (5 tests)
 ✓ src/app/api/eventos-atp/__tests__/route.test.ts (5 tests)

 Test Files  5 passed (5)
      Tests  29 passed (29)
```

### 5.3. Suite Completa de la API

```bash
npm test
```

**Salida obtenida:**

```text
Test Files  64 passed (64)
     Tests  765 passed (765)
```

### 5.4. Verificación del Contrato OpenAPI

```bash
# El servidor expone el documento en /openapi.json
curl -s http://localhost:3001/openapi.json | grep -o '"/api/eventos-atp"'
# Salida esperada: "/api/eventos-atp"
```

El documento debe incluir:

- Operación `post` sobre `/api/eventos-atp`.
- `security: [{ bearerAuth: [] }]`.
- Esquemas `CrearEventoAtpInput`, `EventoAtpResponse` y `CrearEventoAtpResponse`.
- Respuestas `201`, `400`, `401`, `403`, `409` y `500`.

---

## 6. Registro de Defectos

No se detectaron defectos funcionales abiertos en el backend durante el ciclo de H61. La validación de esquema, el control RBAC, la transacción, la generación de código, la migración reversible y la emisión WebSocket quedaron cubiertos por pruebas automatizadas.

| ID Defecto | Descripción | Severidad | Estado |
|---|---|---|---|
| — | Sin defectos abiertos al cierre de QA | — | — |

---

## 7. Conclusión de QA

La implementación backend de H61 cumple los criterios de aceptación definidos:

- Endpoint `POST /api/eventos-atp` autenticado y protegido por `eventos_atp:crear`.
- Validación estricta de contrato, incluyendo reglas de fechas, catálogos y delegaciones.
- Persistencia atómica del evento y su alcance territorial.
- Generación segura del correlativo anual y soporte de código manual único.
- Emisión del evento `evento_atp:creado` a las salas operativas y administrativas.
- Migración reversible con tablas, restricciones, índices y permisos.
- Contrato OpenAPI sincronizado.
- Ausencia de regresiones en la suite completa de la API.

**Dictamen:** **APROBADO PARA INTEGRACIÓN EN `develop`.**
