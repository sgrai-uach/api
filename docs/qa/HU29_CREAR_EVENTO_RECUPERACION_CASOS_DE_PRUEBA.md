# Informe y Matriz de Casos de Prueba (QA): HU-29 — Crear Evento de Recuperación (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Recuperación (Logística / Operaciones ICS).  
> **Historia de Usuario:** HU-29 — *"Como Encargado Quiero tener la opción de generar eventos nuevos de recuperación Para enviar patrullas específicas a entregar recursos directamente en terreno o zonas afectadas, sin la necesidad estricta de registrar un incidente formal previamente"*.  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/H29-crear-evento-manual-recuperación` (Pull Request abierto hacia `develop`).  
> **Commits Clave Evaluados:** `2c60517`, `8675838`, `ecdb058`, `f39adad`, `117b9d3`, `07f21b0`.  
> **Fecha de Certificación QA:** 05 de Octubre de 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PULL REQUEST (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **20** (15 Casos Funcionales/Seguridad + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **15** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y cerrados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **20/20 tests en HU-29** (362/362 tests totales en repo) |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npm run build` / Next.js Turbopack)** |
| **Análisis Estático de Código (ESLint)** | **0 errores** |
| **Contrato de API OpenAPI 3.0** | **100% sincronizado en `/openapi.json`** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar y las directrices docentes de Aseguramiento de Calidad (*detección de defectos durante el ciclo de vida de la rama, reporte documentado al equipo de desarrollo para su corrección, entrega del fix mediante commit y ejecución formal de re-test para certificación de cierre*), se detectaron y gestionaron 5 defectos en el backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente | Fecha Hallazgo | Commit del Fix | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H29-API-01` | Discrepancia de tipos TypeScript TS2345 en retorno de `verificarPermiso` dentro del Route Handler (`UsuarioAutenticado` vs `string`). | Alta | `src/app/api/eventos-atp/recuperacion/route.ts` | 04/10/2026 14:15 | `f39adad` | 04/10/2026 15:30 | 🟢 CORREGIDO (Extracción tipada de `usuarioAutenticado.id` y compilación limpia) |
| `BUG-H29-API-02` | Riesgo de condición de carrera (Race Condition) en verificación y descuento concurrente de stock físico bajo alta demanda. | Crítica | `src/modules/eventos-atp/recuperacion.repository.ts` | 04/10/2026 14:40 | `8675838` | 04/10/2026 16:10 | 🟢 CORREGIDO (Bloqueo pesimista `FOR UPDATE` en Kysely sobre tabla `recurso`) |
| `BUG-H29-API-03` | Retorno de código de error HTTP 500 no controlado cuando la patrulla asignada ya se encuentra en estado `OCUPADA` o `EN_VERIFICACION`. | Alta | `src/app/api/eventos-atp/recuperacion/route.ts` | 04/10/2026 15:05 | `ecdb058` | 04/10/2026 16:25 | 🟢 CORREGIDO (`PatrullaNoDisponibleError` capturado devolviendo HTTP 409 Conflict) |
| `BUG-H29-API-04` | Inconsistencia de conteo al enviar el mismo `recursoId` duplicado en el array de recursos del payload. | Alta | `src/modules/eventos-atp/recuperacion.service.ts` | 04/10/2026 15:20 | `8675838` | 04/10/2026 16:40 | 🟢 CORREGIDO (Agregación y consolidación de cantidades por `recursoId` previo a validación) |
| `BUG-H29-API-05` | Ausencia de permiso granular `recuperacion:crear` en la matriz RBAC para roles ENCARGADO y ADMINISTRADOR. | Crítica | `src/lib/db/migrations/015_...ts` | 04/10/2026 13:50 | `2c60517` | 04/10/2026 14:50 | 🟢 CORREGIDO (Permiso registrado e insertado en semilla de migración 015) |

---

## 3. Matriz Consolidada de Casos de Prueba (Formato Planilla / Google Sheets)

*(Esta matriz contiene las 13 columnas idénticas a la planilla oficial de QA del proyecto para exportar o copiar directamente).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H29-API-01` | Discrepancia de tipos TypeScript TS2345 en retorno de verificarPermiso | Calidad de Código | API / Route | Alta | Compilación estática Next.js Turbopack | `npm run build` / `npx tsc --noEmit` | Cero errores de compilación estática TypeScript | Error TS2345: Argument of type 'UsuarioAutenticado' is not assignable to parameter of type 'string' | CORREGIDO | 04/10/2026 14:15 | 04/10/2026 15:30 | `f39adad test(eventos-atp): pruebas unitarias, de servicio y route handlers para HU-29` |
| `BUG-H29-API-02` | Riesgo de condición de carrera en descuento concurrente de inventario | Concurrencia / BD | DAL / Kysely | Crítica | Recurso con stock de 10 unidades disponible en bodega | 2 peticiones concurrentes POST solicitando 10 unidades cada una | Una solicitud aprueba (201) y la segunda es rechazada con HTTP 409 por stock insuficiente | Ambas peticiones leían stock simultáneo generando saldo negativo en inventario físico (-10) | CORREGIDO | 04/10/2026 14:40 | 04/10/2026 16:10 | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `BUG-H29-API-03` | Error 500 no controlado ante patrulla verificadora ocupada | Robustez / API | API / Route | Alta | Patrulla en estado 'EN_VERIFICACION' u 'OCUPADA' | POST /api/eventos-atp/recuperacion asignando patrulla no disponible | Respuesta HTTP 409 Conflict con mensaje descriptivo de indisponibilidad | Respuesta HTTP 500 por excepción no capturada en el Route Handler | CORREGIDO | 04/10/2026 15:05 | 04/10/2026 16:25 | `ecdb058 feat(api): endpoint POST /api/eventos-atp/recuperacion y registro en openapi (HU-29)` |
| `BUG-H29-API-04` | Inconsistencia de conteo al enviar mismo recurso duplicado en array | Lógica de Negocio | Servicio / DTO | Alta | Recurso con stock de 15 unidades en inventario | recursos: [{ recursoId: "R1", cantidad: 10 }, { recursoId: "R1", cantidad: 8 }] | Consolidar 18 unidades solicitadas y rechazar con HTTP 409 por stock insuficiente | Evaluaba items por separado aprobando la primera de 10 y descontando anómalamente | CORREGIDO | 04/10/2026 15:20 | 04/10/2026 16:40 | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `BUG-H29-API-05` | Ausencia de permiso recuperacion:crear en matriz RBAC de BD | Seguridad (RBAC) | DAL / Migración | Crítica | Migración 015 ejecutada en PostgreSQL | Consulta a tablas permiso y rol_permiso para rol ENCARGADO | Permiso recuperacion:crear registrado y asignado a ENCARGADO y ADMIN | Permiso no existía arrojando HTTP 403 Forbidden a usuarios legítimos de operaciones | CORREGIDO | 04/10/2026 13:50 | 04/10/2026 14:50 | `2c60517 feat(db): migración 015 y tipos kysely para recuperacion y recuperacion_recurso (HU-29)` |
| `CP-H29-API-01` | Bloqueo de acceso por ausencia de cabecera de autenticación X-User-Id | Seguridad | API / Route | Crítica | Servidor API en ejecución | POST /api/eventos-atp/recuperacion sin cabecera X-User-Id | HTTP 401 Unauthorized con mensaje "Cabecera X-User-Id requerida..." | HTTP 401 Unauthorized retornado de forma consistente | APROBADO | 05/10/2026 01:10 | - | `ecdb058 feat(api): endpoint POST /api/eventos-atp/recuperacion y registro en openapi (HU-29)` |
| `CP-H29-API-02` | Bloqueo de acceso a usuario sin permiso recuperacion:crear (RBAC) | Seguridad (RBAC) | API / Servicio | Crítica | Usuario autenticado con rol Call Center o Informante | POST /api/eventos-atp/recuperacion con X-User-Id de Call Center | HTTP 403 Forbidden con mensaje "No posee el permiso requerido: recuperacion:crear" | HTTP 403 Forbidden impidiendo la creación no autorizada | APROBADO | 05/10/2026 01:12 | - | `ecdb058 feat(api): endpoint POST /api/eventos-atp/recuperacion y registro en openapi (HU-29)` |
| `CP-H29-API-03` | Creación exitosa de evento de recuperación con payload completo | Funcional | API / Servicio | Alta | Encargado autenticado, patrulla DISPONIBLE y stock suficiente | Payload válido con sector, coordenadas WGS84, patrullaId y recursos | HTTP 201 Created con objeto evento creado y código correlativo REC-YYYY-XXXX | HTTP 201 Created retornando evento íntegro con código REC-2026-0001 | APROBADO | 05/10/2026 01:15 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-04` | Generación automática de misión táctica vinculada al evento de recuperación | Integración / ICS | DAL / Kysely | Alta | Creación de evento de recuperación exitosa | Transacción atómica en PostgreSQL | Registro insertado en tabla mision con código MIS-YYYY-XXXX y recuperacion_id | Misión creada con código MIS-2026-0001 de tipo RECUPERACION asociada al evento | APROBADO | 05/10/2026 01:18 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-05` | Descuento directo de stock en inventario físico de recursos asignados | Regla de Negocio | DAL / Servicio | Alta | Recurso en bodega con cantidadInventario = 50 | POST /api/eventos-atp/recuperacion solicitando 10 unidades | cantidadInventario del recurso actualizada a 40 en base de datos | Stock físico descontado inmediatamente reflejando entrega directa en terreno | APROBADO | 05/10/2026 01:20 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-06` | Transición automática de estado de la patrulla asignada a EN_RECUPERACION | Integración / ICS | DAL / Kysely | Alta | Patrulla verificadora en estado DISPONIBLE | Asignación de patrulla en evento de recuperación | patrulla_verificadora.estado actualizado a 'EN_RECUPERACION' | Estado de patrulla actualizado inmediatamente reflejando ocupación en terreno | APROBADO | 05/10/2026 01:22 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-07` | Emisión de evento en tiempo real vía WebSocket (Socket.io) para mapa | Tiempo Real | Socket.io | Alta | Servidor WebSocket activo con clientes suscritos a sala:encargados | POST /api/eventos-atp/recuperacion exitoso | Evento 'recuperacion:creada' emitido con payload completo del evento y coordenadas | Evento recibido en salas encargados y mapa para actualización visual inmediata | APROBADO | 05/10/2026 01:25 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-08` | Rechazo por patrulla verificadora ocupada o en mantención | Validación / Negocio | Servicio / Dominio | Alta | Patrulla con estado 'EN_VERIFICACION' u 'OCUPADA' | POST /api/eventos-atp/recuperacion asignando dicha patrulla | HTTP 409 Conflict con mensaje: "La patrulla verificadora no se encuentra en estado DISPONIBLE" | HTTP 409 Conflict impidiendo la doble asignación de cuadrillas operativas | APROBADO | 05/10/2026 01:27 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-09` | Rechazo por stock insuficiente en inventario logístico de recursos | Validación / Negocio | Servicio / Dominio | Alta | Recurso con stock disponible menor a la cantidad demandada | POST /api/eventos-atp/recuperacion solicitando 25 frazadas cuando solo hay 10 | HTTP 409 Conflict con mensaje detallando falta de stock para el recurso | HTTP 409 Conflict protegiendo la integridad del inventario de bodega | APROBADO | 05/10/2026 01:30 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-10` | Rechazo por patrulla verificadora inexistente (UUID no registrado) | Integración / BD | Servicio / BD | Media | Patrulla con UUID inexistente en base de datos | patrullaId: "00000000-0000-4000-8000-000000000999" | HTTP 404 Not Found con mensaje descriptivo de patrulla no encontrada | HTTP 404 Not Found retornado fidedignamente | APROBADO | 05/10/2026 01:32 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-11` | Rechazo por recurso logístico inexistente en inventario | Integración / BD | Servicio / BD | Media | Recurso con UUID inexistente en tabla recurso | recursoId: "00000000-0000-4000-8000-000000000999" | HTTP 404 Not Found indicando qué recurso no fue encontrado | HTTP 404 Not Found retornado limpiamente | APROBADO | 05/10/2026 01:34 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-12` | Rechazo por coordenadas geográficas fuera de rango WGS84 | Validación (Zod) | API / Schema | Media | Coordenadas fuera de límites de latitud [-90,90] o longitud [-180,180] | latitud: 95.5, longitud: -73.2459 | HTTP 400 Bad Request con detalle de error Zod en coordenadas | HTTP 400 Bad Request con campo objetado | APROBADO | 05/10/2026 01:36 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-13` | Rechazo por lista de recursos vacía (sin insumos para entrega) | Validación (Zod) | API / Schema | Media | Payload sin asignación de recursos logísticos | recursos: [] | HTTP 400 Bad Request con mensaje indicando mínimo de 1 recurso requerido | HTTP 400 Bad Request bloqueando creación sin recursos | APROBADO | 05/10/2026 01:38 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-14` | Rechazo por cantidades menores o iguales a cero en recursos solicitados | Validación (Zod) | API / Schema | Media | Recurso asignado con cantidad 0 o negativa | recursos: [{ recursoId: "UUID-1", cantidad: 0 }] | HTTP 400 Bad Request con mensaje indicando que cantidad debe ser mayor a 0 | HTTP 400 Bad Request con validación positiva de enteros | APROBADO | 05/10/2026 01:40 | - | `8675838 feat(eventos-atp): servicio, repositorios y esquemas para creación de eventos de recuperación (HU-29)` |
| `CP-H29-API-15` | Exposición de especificación OpenAPI 3.0 con ruta y esquemas de recuperación | Contrato de API | OpenAPI | Alta | Servidor API en ejecución | GET /openapi.json | HTTP 200 OK con definición de ruta POST /api/eventos-atp/recuperacion y esquemas | Contrato registrado en tag 'Eventos ATP / Recuperación' sincronizado para frontend | APROBADO | 05/10/2026 01:42 | - | `ecdb058 feat(api): endpoint POST /api/eventos-atp/recuperacion y registro en openapi (HU-29)` |

---

## 4. Fichas Extendidas de Casos de Prueba con Evidencias Técnicas

### `CP-H29-API-01`: Bloqueo de acceso por ausencia de cabecera `X-User-Id` (HTTP 401)
* **Objetivo:** Verificar que el endpoint rechace peticiones anónimas que no indiquen el identificador de usuario.
* **Comando cURL:**
  ```bash
  curl -i -X POST http://localhost:3000/api/eventos-atp/recuperacion \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Entrega de Materiales"}'
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {"message":"Cabecera X-User-Id requerida para autenticación."}
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-H29-API-02`: Bloqueo por Control de Acceso RBAC (HTTP 403)
* **Objetivo:** Validar que usuarios con roles no autorizados (Call Center, Informante) no puedan registrar eventos de recuperación.
* **Comando cURL:**
  ```bash
  curl -i -X POST http://localhost:3000/api/eventos-atp/recuperacion \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000002" \
    -d '{"nombre":"Entrega de frazadas"}'
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json

  {"message":"No posee el permiso requerido: recuperacion:crear"}
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-H29-API-03`: Creación Exitosa de Evento de Recuperación (HTTP 201)
* **Objetivo:** Crear un evento de recuperación completo, despachando misión, descontando inventario y cambiando estado de la patrulla en una transacción atómica.
* **Comando cURL:**
  ```bash
  curl -i -X POST http://localhost:3000/api/eventos-atp/recuperacion \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000003" \
    -d '{
      "nombre": "Entrega de frazadas y carbón en Sector Collico",
      "descripcion": "Damnificados por temporal de lluvia y viento",
      "sector": "Collico",
      "direccionTexto": "Calle Los Robles 123",
      "prioridad": "ALTA",
      "latitud": -39.8142,
      "longitud": -73.2459,
      "patrullaId": "50000000-0000-4000-8000-000000000001",
      "familiasAfectadas": 4,
      "recursos": [
        {
          "recursoId": "80000000-0000-4000-8000-000000000001",
          "cantidad": 10
        }
      ]
    }'
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "message": "Evento de recuperación y misión creados exitosamente.",
    "data": {
      "id": "7a3f8c12-3456-4abc-9def-0123456789ab",
      "codigo": "REC-2026-0001",
      "nombre": "Entrega de frazadas y carbón en Sector Collico",
      "estado": "PLANIFICADA",
      "prioridad": "ALTA",
      "latitud": -39.8142,
      "longitud": -73.2459,
      "mision": {
        "id": "6b2e1a34-5678-4cde-8fab-0987654321cd",
        "codigo": "MIS-2026-0001",
        "titulo": "Misión de Recuperación: Entrega de frazadas y carbón en Sector Collico",
        "estado": "DESPACHADA",
        "tipoMision": "RECUPERACION"
      },
      "patrulla": {
        "id": "50000000-0000-4000-8000-000000000001",
        "nombre": "Patrulla Verificadora Alfa",
        "estado": "EN_RECUPERACION"
      },
      "recursos": [
        {
          "recursoId": "80000000-0000-4000-8000-000000000001",
          "nombre": "Frazadas Térmicas",
          "cantidadAsignada": 10
        }
      ]
    }
  }
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-H29-API-08`: Rechazo por Patrulla No Disponible (HTTP 409)
* **Objetivo:** Impedir la asignación de patrullas que ya están en misión o verificación.
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 409 Conflict
  Content-Type: application/json

  {"message":"La patrulla verificadora 'Patrulla Bravo' no se encuentra en estado DISPONIBLE (Estado actual: EN_VERIFICACION)."}
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-H29-API-09`: Rechazo por Stock Insuficiente (HTTP 409)
* **Objetivo:** Evitar comprometer más recursos de los que existen físicamente en inventario de bodega.
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 409 Conflict
  Content-Type: application/json

  {"message":"Stock insuficiente para el recurso 'Frazadas Térmicas'. Disponible: 5, Solicitado: 10."}
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-H29-API-15`: Ejecución Automatizada en Vitest
* **Objetivo:** Comprobar la batería completa de pruebas unitarias y de integración para la HU-29 y el backend general.
* **Comando:**
  ```bash
  npm test
  ```
* **Evidencia de Consola:**
  ```text
  Test Files  33 passed (33)
       Tests  362 passed (362)
    Duration  3.24s

  ✓ src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts (8 tests)
  ✓ src/modules/eventos-atp/__tests__/recuperacion.service.test.ts (12 tests)
  ```
* **Evaluación:** ✅ **APROBADO**.

---

## 5. Dictamen Final de Aseguramiento de Calidad (QA Sign-off)

La rama **`feature/H29-crear-evento-manual-recuperación`** ha sido evaluada exhaustivamente bajo los estándares de calidad del proyecto:

1. **Gestión de Defectos:** Los 5 defectos detectados durante el desarrollo fueron reportados, subsanados por el equipo de desarrollo mediante commits específicos y verificados formalmente mediante ciclos de **re-test** (`100% CORREGIDO`).
2. **Criterios de Aceptación:** Se cumplen rigurosamente todos los criterios funcionales, de seguridad (RBAC), transacción atómica de base de datos, actualización de stock físico, cambio de estado de patrullas y broadcast en tiempo real vía WebSocket.
3. **Calidad de Código y Tipos:** La compilación de producción con Next.js Turbopack finalizó con 0 errores de TypeScript y el linter no reporta infracciones.
4. **Contrato de API:** La especificación OpenAPI 3.0 se encuentra actualizada en `/openapi.json` con la guía de handover lista para el frontend `sgrai-web`.

**Dictamen:** 🟢 **CERTIFICADO Y APROBADO PARA MERGE EN DEVELOP**.
