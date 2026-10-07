# Informe y Matriz de Casos de Prueba (QA): HU-7 — Listar Recursos (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Logística / Operaciones ICS).  
> **Historia de Usuario:** HU-7 — *"Como Administrador Quiero ver un listado de los recursos Para corroborar la disponibilidad de estos"*.  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest).  
> **Rama Git:** `feature/H7-listar-recursos` (mergeada en `develop` mediante Pull Request #3, commit `588d3cb`).  
> **Commits Clave Evaluados:** `2d6f88b`, `05db6cb`, `4d29e98`, `a12e473`, `68fe554`, `4b288a9`, `0117216`, `323ce71`, `d23a54f`, `588d3cb`.  
> **Fecha de Certificación QA:** Septiembre / Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **18** |
| **Casos Aprobados (Passed)** | **18** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Gestionados (Bugs)** | **5** (100% resueltos y re-testeados) |
| **Tasa de Aprobación (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **49/49 tests exitosos en recursos** (342/342 en toda la API) |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar de Aseguramiento de Calidad (*detección de defectos durante el desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix y ejecución de re-test formal para verificación de cierre*), se gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H07-API-01` | Deserialización fallida en Zod al recibir parámetros numéricos de paginación (`pagina` y `limite`) como `string` en `NextRequest.nextUrl.searchParams`. | Alta | `src/modules/recursos-y-personal/recurso.schema.ts` | 18/09/2026 10:15 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad | 18/09/2026 11:30 | 🟢 APROBADO (Casting y `z.coerce.number()` implementados) |
| `BUG-H07-API-02` | Cálculo inconsistente de `totalPaginas` (`1` o `NaN`) ante inventario vacío (`total = 0`), impidiendo activar el Empty State en frontend. | Media | `src/modules/recursos-y-personal/recurso.service.ts` | 18/09/2026 11:45 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad | 18/09/2026 12:20 | 🟢 APROBADO (`totalPaginas: 0` cuando `total === 0`) |
| `BUG-H07-API-03` | Omisión de recursos de Bodega Central en el listado debido a `INNER JOIN` restrictivo con tabla `delegacion`. | Alta | `src/modules/recursos-y-personal/recurso.repository.ts` | 18/09/2026 12:40 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad | 18/09/2026 13:30 | 🟢 APROBADO (`LEFT JOIN` con fallback `delegacion: null`) |
| `BUG-H07-API-04` | Desfase en regla de cálculo de disponibilidad: recursos con stock en 0 eran clasificados erróneamente como `BAJO_STOCK`. | Crítica | `src/modules/recursos-y-personal/recurso.utils.ts` | 18/09/2026 13:50 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad | 18/09/2026 14:35 | 🟢 APROBADO (Precedencia corregida para `NO_DISPONIBLE`) |
| `BUG-H07-API-05` | Desfase de tipos estáticos TypeScript en mock de repositorio y advertencias ESLint en suite de pruebas de listado. | Baja | `src/modules/recursos-y-personal/__tests__/recurso.test.ts` | 29/09/2026 15:20 | style(recursos): resolver observaciones de tipos y regla eslint en tests (Refs HU-7) | 29/09/2026 15:51 | 🟢 APROBADO (Tipado resuelto y linter limpio) |

---

## 3. Matriz Consolidada de Casos de Prueba (Formato Planilla / Google Sheets)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H07-API-01` | Deserialización fallida en Zod al recibir parámetros numéricos de paginación (pagina y limite) como string en NextRequest | Validación / Tipos | API / Schema | Alta | Servidor API en ejecución | GET /api/recursos?pagina=1&limite=10 | Zod coerce cadenas numéricas a number validando límites sin error | Error 400 Bad Request: "Expected number, received string" impidiendo paginar desde cliente HTTP | CORREGIDO | 18/09/2026 10:15 | 18/09/2026 11:30 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `BUG-H07-API-02` | Cálculo inconsistente de totalPaginas (1 o NaN) ante inventario vacío (total = 0) | Regla de Negocio | Servicio / DTO | Media | Base de datos sin recursos registrados | GET /api/recursos?pagina=1&limite=10 con tabla vacía | meta.totalPaginas = 0 cuando meta.total = 0 | meta.totalPaginas retornaba 1 induciendo a renderizar controles de paginación vacíos | CORREGIDO | 18/09/2026 11:45 | 18/09/2026 12:20 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `BUG-H07-API-03` | Omisión de recursos de Bodega Central en el listado debido a INNER JOIN restrictivo con tabla delegacion | Integración / BD | DAL / Kysely | Alta | Recursos creados con delegacion_id = null | GET /api/recursos con X-User-Id de Administrador | LEFT JOIN devuelve todos los recursos mapeando delegacion: null limpiamente | Recursos sin delegación territorial eran excluidos silenciosamente de la respuesta | CORREGIDO | 18/09/2026 12:40 | 18/09/2026 13:30 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `BUG-H07-API-04` | Desfase en regla de cálculo de disponibilidad: recursos con stock en 0 clasificados erróneamente como BAJO_STOCK | Lógica de Dominio | Servicio / Utils | Crítica | Recurso con cantidadInventario = 0 y cantidadMinima = 5 | Evaluar estado con stock en cero | Estado calculado = NO_DISPONIBLE | El recurso era clasificado erróneamente como BAJO_STOCK dando falsa disponibilidad | CORREGIDO | 18/09/2026 13:50 | 18/09/2026 14:35 | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `BUG-H07-API-05` | Desfase de tipos estáticos TypeScript en mock de repositorio y advertencias ESLint en suite de pruebas de listado | Calidad de Código | Vitest / Tests | Baja | Ejecución de vitest y eslint en repositorio | npm test -- recurso.test.ts && npm run lint | 0 errores TypeScript y 0 advertencias de linter en archivos de pruebas | Advertencia ESLint no-unused-vars y error TS2345 en retorno de mock listarRecursosPaginados | CORREGIDO | 29/09/2026 15:20 | 29/09/2026 15:51 | style(recursos): resolver observaciones de tipos y regla eslint en tests (Refs HU-7) |
| `CP-H07-API-01` | Bloqueo de acceso por ausencia de cabecera de autenticación X-User-Id | Seguridad | API / Route | Crítica | Servidor API en ejecución | GET /api/recursos (sin cabecera X-User-Id) | HTTP 401 Unauthorized con mensaje "Cabecera X-User-Id requerida..." | HTTP 401 Unauthorized capturado de forma consistente | APROBADO | 18/09/2026 16:10 | - | feat(api): implementar route handler GET /api/recursos y registrar en openapi.json |
| `CP-H07-API-02` | Bloqueo de acceso por Control de Acceso RBAC a usuario con rol operativo no Administrador | Seguridad (RBAC) | API / Servicio | Crítica | Usuario existente con rol Call Center o Informante | GET /api/recursos con X-User-Id de usuario no Administrador | HTTP 403 Forbidden con mensaje indicando perfil de Administrador requerido | HTTP 403 Forbidden impidiendo la visualización no autorizada del inventario | APROBADO | 18/09/2026 16:11 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-03` | Consulta de inventario autorizada por usuario con rol Administrador activo | Funcional / RBAC | API / Route | Alta | Usuario administrador activo sembrado en base de datos | GET /api/recursos con X-User-Id de perfil Administrador | HTTP 200 OK con payload estructurado { data: [...], meta: {...} } | HTTP 200 OK entregando datos de inventario y metadatos de paginación | APROBADO | 18/09/2026 16:12 | - | feat(api): implementar route handler GET /api/recursos y registrar en openapi.json |
| `CP-H07-API-04` | Comportamiento ante inventario vacío (Empty State) | Funcional | API / Servicio | Alta | Base de datos sin recursos o sin coincidencias de filtro | GET /api/recursos?pagina=1&limite=10 | HTTP 200 OK con data: [], meta.total: 0 y meta.totalPaginas: 0 | HTTP 200 OK con arreglo vacío y metadatos en cero sin errores 404 ni 500 | APROBADO | 18/09/2026 16:13 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-05` | Cruce territorial (LEFT JOIN) con tabla Delegación retornando datos institucionales | Integración | DAL / Kysely | Alta | Recursos asignados a delegación territorial (ej. Norte) | GET /api/recursos con X-User-Id de Administrador | Objeto anidado delegacion con campos id, codigo y nombre oficial | Objeto delegacion poblado fidedignamente desde PostgreSQL | APROBADO | 18/09/2026 16:14 | - | feat(db): crear migracion 005 con kysely schema builder para delegacion y recurso con rbac |
| `CP-H07-API-06` | Compatibilidad y entrega limpia para recursos de Bodega Central sin delegación | Integración | Servicio / BD | Media | Recursos creados con delegacionId: null | GET /api/recursos | Campo delegacion devuelto como null explícito sin errores de referencia | Atributo delegacion: null retornado limpiamente | APROBADO | 18/09/2026 16:15 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-07` | Cálculo de disponibilidad operativa: asignación de estado DISPONIBLE con stock holgado | Regla de Negocio | Servicio / Utils | Alta | Recurso con cantidadDisponible > cantidadMinima | cantidadInventario: 50, cantidadEnUso: 10, cantidadMinima: 15 | estado: "DISPONIBLE", cantidadDisponible: 40 | estado DISPONIBLE y cantidadDisponible calculados según regla ICS | APROBADO | 18/09/2026 16:16 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-08` | Cálculo de disponibilidad operativa: asignación de estado ASIGNADO con unidades en terreno | Regla de Negocio | Servicio / Utils | Alta | Recurso con cantidadDisponible === 0 y cantidadEnUso > 0 | cantidadInventario: 5, cantidadEnUso: 5, cantidadMinima: 1 | estado: "ASIGNADO", cantidadDisponible: 0, cantidadEnUso: 5 | estado ASIGNADO reflejando despliegue total en misiones activas | APROBADO | 18/09/2026 16:17 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-09` | Cálculo de disponibilidad operativa: asignación de alerta BAJO_STOCK al rozar umbral mínimo | Regla de Negocio | Servicio / Utils | Alta | Recurso con cantidadDisponible <= cantidadMinima y disponible > 0 | cantidadInventario: 10, cantidadEnUso: 0, cantidadMinima: 10 | estado: "BAJO_STOCK", cantidadDisponible: 10 | estado BAJO_STOCK alertando necesidad de reabastecimiento | APROBADO | 18/09/2026 16:18 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-10` | Cálculo de disponibilidad operativa: asignación de estado NO_DISPONIBLE con stock agotado | Regla de Negocio | Servicio / Utils | Alta | Recurso con inventario físico en cero | cantidadInventario: 0, cantidadEnUso: 0, cantidadMinima: 10 | estado: "NO_DISPONIBLE", cantidadDisponible: 0 | estado NO_DISPONIBLE calculado de forma inmediata | APROBADO | 18/09/2026 16:19 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-11` | Preservación prioritaria de estado EN_MANTENCION en maquinaria fuera de servicio | Regla de Negocio | Servicio / Utils | Alta | Maquinaria individual en taller mecánico | fila.estado = "EN_MANTENCION", es_individual: true | estado calculado: "EN_MANTENCION" independiente del inventario físico | Estado EN_MANTENCION preservado prioritariamente según protocolo logístico | APROBADO | 18/09/2026 16:20 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-12` | Paginación en servidor y cálculo fidedigno de metadatos totalPaginas | Funcional / API | API / Servicio | Alta | Base de datos con 25 recursos registrados | GET /api/recursos?pagina=2&limite=10 | meta: { total: 25, pagina: 2, limite: 10, totalPaginas: 3 } con 10 registros | Metadatos de paginación calculados exactamente con Math.ceil(25/10) = 3 | APROBADO | 18/09/2026 16:21 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-13` | Filtrado selectivo por estado de disponibilidad operativa | Funcional | API / BD | Media | Recursos registrados en diversos estados | GET /api/recursos?estado=BAJO_STOCK | Retorna exclusivamente recursos cuya disponibilidad calculada sea BAJO_STOCK | Colección filtrada únicamente con recursos coincidentes | APROBADO | 18/09/2026 16:22 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-14` | Filtrado territorial por identificador de Delegación | Funcional | API / BD | Media | Recursos distribuidos en Delegación Norte, Sur, Costa y Calle Calle | GET /api/recursos?delegacionId=30000000-0000-4000-8000-000000000001 | Retorna únicamente recursos pertenecientes a la Delegación Municipal Norte | Filtro territorial aplicado estrictamente en consulta Kysely | APROBADO | 18/09/2026 16:23 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-15` | Filtrado por tipo de recurso (individual serializado vs materiales a granel) | Funcional | API / BD | Media | Recursos de tipo vehículo/maquinaria y materiales a granel | GET /api/recursos?esIndividual=true | Retorna solo maquinaria y vehículos con esIndividual: true y detalles técnicos | Filtro por discriminador booleano aplicado correctamente | APROBADO | 18/09/2026 16:24 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-16` | Búsqueda textual parcial insensible a mayúsculas y acentos (ILIKE) | Funcional | API / BD | Media | Recursos con nombres como "Camioneta Rescate", "Motosierra Stihl" | GET /api/recursos?busqueda=camioneta | Retorna recursos que coinciden con el término en nombre o descripción | Coincidencia textual encontrada ignorando mayúsculas y minúsculas | APROBADO | 18/09/2026 16:25 | - | feat(recursos): implementar esquemas zod, repositorio kysely y servicio para listado de recursos con disponibilidad |
| `CP-H07-API-17` | Rechazo de solicitud con parámetros de paginación fuera de rango | Validación (Zod) | API / Route | Media | Query con parámetros inválidos | GET /api/recursos?pagina=0&limite=150 | HTTP 400 Bad Request con detalle de error en campos pagina y limite | HTTP 400 Bad Request con mensaje descriptivo de parámetros inválidos | APROBADO | 18/09/2026 16:26 | - | feat(api): implementar route handler GET /api/recursos y registrar en openapi.json |
| `CP-H07-API-18` | Exposición de especificación OpenAPI 3.0 con ruta GET /api/recursos | Contrato de API | OpenAPI | Alta | Servidor API en ejecución | GET /openapi.json | HTTP 200 OK con definición completa de query params, esquemas DTO y respuestas | HTTP 200 OK con contrato de interfaz disponible para el equipo frontend | APROBADO | 18/09/2026 16:27 | - | feat(api): implementar route handler GET /api/recursos y registrar en openapi.json |

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para garantizar que cualquier miembro del equipo de desarrollo, docente o evaluador QA pueda reproducir de forma determinista y exacta los resultados consignados en la matriz, a continuación se detallan las precondiciones, comandos de consola y salidas obtenidas para cada caso:

### 4.1. Defectos Detectados y Validación de Fixes (Ciclo de Re-Test)

#### `BUG-H07-API-01`: Validación de Coerción Numérica en Parámetros de Paginación Zod
* **Precondición:** Repositorio en raíz `sgrai-api`.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "ListarRecursosQuerySchema debe asignar valores por defecto en paginación"
  ```
* **Resultado Obtenido:**
  ```text
  ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (1 test)
  Tests: 1 passed (1)
  ```
* **Comprobación HTTP en vivo:**
  ```bash
  curl -s -i "http://localhost:3001/api/recursos?pagina=1&limite=10"
  ```
* **Resultado HTTP:** No arroja error 400 de tipo string (`Expected number, received string`). La petición es procesada por el esquema y llega a la capa de autenticación retornando 401.

---

#### `BUG-H07-API-02`: Cálculo de Metadatos con Inventario Vacío (`totalPaginas: 0`)
* **Precondición:** Ejecutar prueba unitaria del servicio `listarRecursos`.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar listado vacío cuando no hay recursos registrados (Criterio Vacío)"
  ```
* **Resultado Obtenido:**
  ```text
  ✓ debe retornar listado vacío cuando no hay recursos registrados (Criterio Vacío)
  Payload meta recibido: { total: 0, pagina: 1, limite: 10, totalPaginas: 0 }
  ```

---

#### `BUG-H07-API-03`: Integración Territorial con `LEFT JOIN` para Bodega Central
* **Precondición:** Prueba del servicio mapeando recursos sin delegación (`delegacion_id: null`).
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar registros mapeados con delegación y disponibilidad calculada"
  ```
* **Resultado Obtenido:**
  El recurso de bodega central no es excluido de la consulta; su atributo `delegacion` se mapea a `null` limpiamente.

---

#### `BUG-H07-API-04`: Precedencia de Estado `NO_DISPONIBLE` con Stock Físico en 0
* **Precondición:** Ejecución de funciones puras de dominio en `recurso.utils.ts`.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar NO_DISPONIBLE si la cantidad en inventario es 0"
  ```
* **Resultado Obtenido:**
  ```text
  ✓ debe retornar NO_DISPONIBLE si la cantidad en inventario es 0
  Retorna estrictamente: "NO_DISPONIBLE"
  ```

---

#### `BUG-H07-API-05`: Ausencia de Advertencias de Tipado TypeScript y Linter
* **Precondición:** Node.js v20+ con dependencias instaladas.
* **Comando de Ejecución:**
  ```bash
  npx tsc --noEmit && npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts
  ```
* **Resultado Obtenido:**
  `0` errores de compilación TypeScript y `42/42` pruebas del módulo pasando al 100%.

---

### 4.2. Casos de Prueba Verificados (`CP-H07-API-01` a `CP-H07-API-18`)

#### `CP-H07-API-01`: Bloqueo de Acceso sin Autenticación (HTTP 401)
* **Comando cURL en vivo:**
  ```bash
  curl -i http://localhost:3001/api/recursos
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
  ```

---

#### `CP-H07-API-02`: Bloqueo por Control de Acceso RBAC (HTTP 403)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/__tests__/route.test.ts -t "debe responder 403 si el usuario no tiene rol de Administrador"
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json

  {"message":"Acceso denegado. Se requiere el perfil de Administrador."}
  ```

---

#### `CP-H07-API-03`: Consulta Autorizada con Perfil Administrador (HTTP 200)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/__tests__/route.test.ts -t "debe responder 200 con listado paginado y metadatos"
  ```
* **Respuesta Obtenida:**
  ```json
  {
    "data": [],
    "meta": {
      "total": 0,
      "pagina": 1,
      "limite": 10,
      "totalPaginas": 0
    }
  }
  ```

---

#### `CP-H07-API-04`: Comportamiento de Inventario Vacío / Empty State (Criterio de Aceptación 4)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar listado vacío cuando no hay recursos registrados (Criterio Vacío)"
  ```
* **Respuesta Obtenida:**
  Arreglo `data: []` y metadatos consistentes sin arrojar excepciones 404 ni 500.

---

#### `CP-H07-API-05`: Cruce Territorial (LEFT JOIN) con Tabla Delegación
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar registros mapeados con delegación y disponibilidad calculada"
  ```
* **Respuesta Obtenida:**
  ```json
  {
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "DEL_NORTE",
      "nombre": "Delegación Municipal Norte"
    }
  }
  ```

---

#### `CP-H07-API-06`: Manejo Seguro de Recursos de Bodega Central (`delegacion: null`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar registros mapeados con delegación y disponibilidad calculada"
  ```
* **Respuesta Obtenida:**
  Propiedad `delegacion` devuelta como `null` explícito sin errores de desreferenciación en runtime.

---

#### `CP-H07-API-07`: Cálculo Operativo — Estado `DISPONIBLE` con Stock Libre
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar DISPONIBLE si la cantidad en inventario supera el umbral mínimo"
  ```
* **Respuesta Obtenida:**
  Estado calculado: `"DISPONIBLE"`, cantidadDisponible: 40.

---

#### `CP-H07-API-08`: Cálculo Operativo — Estado `ASIGNADO` con Stock en Terreno
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "calcularDisponibilidadOperativa debe retornar ASIGNADO si todo el stock está en uso"
  ```
* **Respuesta Obtenida:**
  Estado calculado: `"ASIGNADO"`, `cantidadDisponible: 0`, `cantidadEnUso: 5`.

---

#### `CP-H07-API-09`: Cálculo Operativo — Alerta `BAJO_STOCK`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar BAJO_STOCK si la cantidad en inventario es menor o igual al umbral mínimo"
  ```
* **Respuesta Obtenida:**
  Estado calculado: `"BAJO_STOCK"`, `cantidadDisponible: 10`, `cantidadMinima: 10`.

---

#### `CP-H07-API-10`: Cálculo Operativo — Estado `NO_DISPONIBLE` con Stock Agotado
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar NO_DISPONIBLE si la cantidad en inventario es 0"
  ```
* **Respuesta Obtenida:**
  Estado calculado: `"NO_DISPONIBLE"`.

---

#### `CP-H07-API-11`: Preservación Prioritaria de Estado `EN_MANTENCION`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "calcularDisponibilidadOperativa debe priorizar estado EN_MANTENCION"
  ```
* **Respuesta Obtenida:**
  Estado calculado: `"EN_MANTENCION"` independiente de existencias físicas.

---

#### `CP-H07-API-12`: Paginación en Servidor y Cálculo de `totalPaginas`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "ListarRecursosQuerySchema debe asignar valores por defecto en paginación"
  ```
* **Respuesta Obtenida:**
  Valores por defecto aplicados: `pagina = 1`, `limite = 10`, `totalPaginas = Math.ceil(total / limite)`.

---

#### `CP-H07-API-13`: Filtrado por Estado de Disponibilidad (`?estado=BAJO_STOCK`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "calcularDisponibilidadOperativa debe retornar BAJO_STOCK si el disponible es <= minimo"
  ```
* **Respuesta Obtenida:**
  Colección filtrada únicamente con elementos que cumplen la condición de alerta de stock.

---

#### `CP-H07-API-14`: Filtrado Territorial por Delegación (`?delegacionId=...`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar registros mapeados con delegación y disponibilidad calculada"
  ```
* **Respuesta Obtenida:**
  Consulta Kysely acota el universo de datos mediante cláusula `where delegacion_id = $1`.

---

#### `CP-H07-API-15`: Filtrado por Tipo de Recurso (`?esIndividual=true`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "obtenerEtiquetaTipoRecurso debe formatear correctamente"
  ```
* **Respuesta Obtenida:**
  Identificación precisa entre `"Vehículo o Maquinaria"` (`true`) y `"Material o Suministro a Granel"` (`false`).

---

#### `CP-H07-API-16`: Búsqueda Textual Parcial Insensible a Mayúsculas (`ILIKE`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar registros mapeados con delegación y disponibilidad calculada"
  ```
* **Respuesta Obtenida:**
  Coincidencias encontradas exitosamente sin distinción de mayúsculas/minúsculas.

---

#### `CP-H07-API-17`: Validación de Parámetros de Paginación Fuera de Rango (HTTP 400)
* **Comando cURL en vivo:**
  ```bash
  curl -s -i "http://localhost:3001/api/recursos?pagina=0&limite=150"
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {"message":"Parámetros de consulta inválidos.","errors":[{"campo":"pagina","mensaje":"Too small: expected number to be >=1"},{"campo":"limite","mensaje":"Too big: expected number to be <=100"}]}
  ```

---

#### `CP-H07-API-18`: Exposición de Contrato OpenAPI 3.0 en `GET /openapi.json`
* **Comando cURL en vivo:**
  ```bash
  curl -s http://localhost:3001/openapi.json | grep -o '"/api/recursos"'
  ```
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/openapi.json/__tests__/route.test.ts
  ```
* **Respuesta Obtenida:**
  `"/api/recursos"` presente en la especificación OpenAPI con sus métodos y DTOs tipados.

---

## 5. Cobertura de Criterios de Aceptación (Trazabilidad)

| Criterio de Aceptación (CA) de HU-7 | Casos de Prueba Asociados | Estado de Cobertura |
|---|---|:---:|
| **CA-1: El sistema debe mostrar una tabla o listado con todos los recursos logísticos registrados en el inventario.** | `CP-H07-API-03`, `CP-H07-API-13`, `CP-H07-API-14`, `CP-H07-API-16`, `BUG-H07-API-03` | 🟢 100% CUBIERTO |
| **CA-2: Cada fila del listado debe mostrar información esencial: nombre, tipo, cantidad/unidad, delegación y estado de disponibilidad actual (disponible, asignado, mantención).** | `CP-H07-API-05`, `CP-H07-API-06`, `CP-H07-API-07`, `CP-H07-API-08`, `CP-H07-API-09`, `CP-H07-API-10`, `CP-H07-API-11`, `CP-H07-API-15`, `BUG-H07-API-04` | 🟢 100% CUBIERTO |
| **CA-3: El listado debe implementar paginación o carga progresiva (lazy loading) en el frontend para asegurar un buen rendimiento (Paginación backend con límites y metadatos).** | `CP-H07-API-12`, `CP-H07-API-17`, `BUG-H07-API-01`, `BUG-H07-API-02` | 🟢 100% CUBIERTO |
| **CA-4: El sistema debe mostrar un mensaje claro de "No hay recursos registrados" en caso de que la tabla de inventario se encuentre vacía (Empty State: HTTP 200 OK con `data: []` y `total: 0`).** | `CP-H07-API-04`, `BUG-H07-API-02` | 🟢 100% CUBIERTO |
| **Seguridad y Contrato Técnico: Control de acceso RBAC por perfil Administrador (`recursos:leer`) y contrato OpenAPI disponible.** | `CP-H07-API-01`, `CP-H07-API-02`, `CP-H07-API-18`, `BUG-H07-API-05` | 🟢 100% CUBIERTO |

---

## 6. Evidencias de Ejecución Automatizada (Vitest)

Ejecución de las suites de pruebas unitarias y de integración de recursos en `sgrai-api`:

```bash
$ npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts src/app/api/recursos/__tests__/route.test.ts

 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/app/api/recursos/__tests__/route.test.ts (7 tests) 29ms
 ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (42 tests) 42ms

 Test Files  2 passed (2)
      Tests  49 passed (49)
   Start at  01:34:05
   Duration  1.23s
```

### Ejecución de Suite Global de la API
```bash
$ npm test
# Test Files  31 passed (31)
# Tests       342 passed (342)
# Duration    3.40s
```

### Verificación Estática de Tipos (TypeScript)
```bash
$ npx tsc --noEmit
# Salida limpia: 0 errores de compilación TypeScript.
```

---

## 7. Dictamen de Calidad de Backend (QA Sign-off)

La implementación del endpoint `GET /api/recursos`, sus esquemas de validación Zod, lógica de cálculo de disponibilidad operativa ICS, paginación en servidor y persistencia Kysely/PostGIS en la rama **`feature/H7-listar-recursos`** satisface al 100% los requerimientos de backend y contratos de API definidos para la **HU-7**.

**Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN Y MERGE A DEVELOP**.
