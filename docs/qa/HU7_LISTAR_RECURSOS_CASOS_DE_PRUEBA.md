# Informe y Matriz de Casos de Prueba (QA): HU-7 — Listar Recursos

> **Documento Oficial de Aseguramiento de Calidad (QA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Logística / Operaciones ICS).  
> **Historia de Usuario:** HU-7 — *"Como Administrador Quiero ver un listado de los recursos Para corroborar la disponibilidad de estos"*.  
> **Versión API:** `v0.3.0` | **Rama Git:** `feature/H7-listar-recursos` | **Commit Evaluado:** `4b288a9`  
> **Entorno:** Local (PostgreSQL 16 + PostGIS en Docker, Node.js v20.x, Vitest v2.1.9).  
> **Fecha de Certificación:** 21 de Septiembre de 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PULL REQUEST (100% PASS)**.

---

## 1. Resumen Ejecutivo de Pruebas

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Ejecutados** | **13** |
| **Casos Aprobados (Passed)** | **13** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Críticos Detectados (Bugs)** | **0** |
| **Tasa de Aprobación (% Pass)** | **100%** |
| **Suite Unitaria Automatizada (Vitest)** | **63/63 tests exitosos** |
| **Compilación de Producción (Next.js Build)** | **Exitosa (0 errores TS)** |

---

## 2. Matriz de Casos de Prueba (Consolidado para Revisión Rápida)

*(Esta tabla puede ser copiada y pegada directamente en Google Sheets o Excel para la reunión de QA).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|---|---|---|---|:---:|
| `CP-HU07-01` | Bloqueo de acceso sin cabecera de autenticación | Seguridad | API | Crítica | API levantada en puerto 3001 | `GET /api/recursos` (sin cabeceras) | HTTP 401 Unauthorized | HTTP 401 `"Cabecera X-User-Id requerida..."` | ✅ APROBADO |
| `CP-HU07-02` | Bloqueo de acceso a usuario con rol no Administrador | Seguridad (RBAC) | API | Crítica | Usuario Call Center existente en DB | `X-User-Id: 00000000-0000-4000-8000-000000000002` | HTTP 403 Forbidden | HTTP 403 `"Acceso denegado. Se requiere el perfil de Administrador"` | ✅ APROBADO |
| `CP-HU07-03` | Consulta de inventario autorizada por rol Administrador | Funcional | API | Alta | Usuario Admin activo en DB | `X-User-Id: 00000000-0000-4000-8000-000000000001` | HTTP 200 OK con payload `{ data, meta }` | HTTP 200 OK `{ data: [...], meta: {...} }` | ✅ APROBADO |
| `CP-HU07-04` | Manejo de inventario vacío (Empty State) | Funcional | Unitaria / API | Alta | Base de datos sin recursos registrados | `GET /api/recursos?pagina=1&limite=10` | HTTP 200 OK con `data: []` y `meta.total: 0` | HTTP 200 OK `data: []`, `total: 0`, `totalPaginas: 0` | ✅ APROBADO |
| `CP-HU07-05` | Cruce territorial (JOIN) con tabla Delegación | Integración | DB / Kysely | Alta | Tabla `delegacion` con semillas sembradas | Recurso vinculado a `DEL_NORTE` | Campo `delegacion` anidado con `id`, `codigo` y `nombre` | Objeto `delegacion` presente con nombre oficial | ✅ APROBADO |
| `CP-HU07-06` | Compatibilidad con recursos sin delegación (NULL) | Integración | DB / Schema | Media | Recurso creado con `delegacionId: null` | `GET /api/recursos` | `delegacion: null` sin error en tiempo de ejecución | `delegacion: null` retornado correctamente | ✅ APROBADO |
| `CP-HU07-07` | Cálculo automático de disponibilidad operativa | Negocio / Lógica | Unitaria | Alta | Recurso con inventario y uso | Estados: DISPONIBLE, ASIGNADO, EN_MANTENCION, BAJO_STOCK, NO_DISPONIBLE | Estado calculado según stock y cantidad en uso | Estados calculados exactamente según ICS | ✅ APROBADO |
| `CP-HU07-08` | Paginación en servidor y cálculo de total de páginas | Funcional | API | Alta | Inventario con múltiples registros | `?pagina=1&limite=10` | `meta.totalPaginas` calculado como `Math.ceil(total/limite)` | Metadatos `pagina: 1`, `limite: 10`, `totalPaginas` correcto | ✅ APROBADO |
| `CP-HU07-09` | Filtro por estado de disponibilidad operativa | Funcional | API | Media | Recursos en diversos estados en inventario | `?estado=BAJO_STOCK` | Retorna únicamente recursos en estado `BAJO_STOCK` | Solo registros coincidentes retornados | ✅ APROBADO |
| `CP-HU07-10` | Filtro por delegación territorial | Funcional | API | Media | Recursos en diversas delegaciones | `?delegacionId=30000000-0000-4000-8000-000000000001` | Retorna solo recursos de Delegación Norte | Solo recursos de la delegación indicada | ✅ APROBADO |
| `CP-HU07-11` | Búsqueda textual insensible a mayúsculas | Funcional | API | Media | Recursos con nombres diversos | `?busqueda=camioneta` | Coincidencias en nombre o descripción | Retorna coincidencias ignorando mayúsculas | ✅ APROBADO |
| `CP-HU07-12` | Validación de parámetros de paginación inválidos | Robustez | API | Media | Parámetros fuera de límites | `?pagina=0&limite=200` | HTTP 400 Bad Request con detalle de error Zod | HTTP 400 `"Parámetros de consulta inválidos."` | ✅ APROBADO |
| `CP-HU07-13` | Especificación OpenAPI v0.3.0 disponible | Contrato | API / Contrato | Alta | Servidor levantado en puerto 3001 | `GET /openapi.json` | HTTP 200 OK con ruta `/api/recursos` en `paths` | Ruta `/api/recursos` registrada con GET y POST | ✅ APROBADO |

---

## 3. Detalle de Casos de Prueba con Evidencias de Ejecución

### `CP-HU07-01`: Bloqueo de acceso sin cabecera de autenticación (HTTP 401)
* **Objetivo:** Verificar que el endpoint rechace de inmediato cualquier petición que no identifique al usuario solicitante.
* **Comando de Ejecución:**
  ```bash
  curl -i http://localhost:3001/api/recursos
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json
  
  {"message":"Cabecera X-User-Id requerida para autenticación."}
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-HU07-02`: Bloqueo por Control de Acceso RBAC (HTTP 403)
* **Objetivo:** Asegurar que usuarios con roles operativos distintos de Administrador (ej. Call Center, Informante) no tengan acceso al inventario logístico.
* **Comando de Ejecución:**
  ```bash
  curl -i -H "X-User-Id: 00000000-0000-4000-8000-000000000002" http://localhost:3001/api/recursos
  ```
* **Respuesta Obtenida:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json
  
  {"message":"Acceso denegado. Se requiere el perfil de Administrador para acceder al listado y gestión de permisos."}
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-HU07-04`: Comportamiento ante Inventario Vacío (Criterio de Aceptación 4)
* **Objetivo:** Garantizar que si no existen recursos en el inventario, el sistema devuelva un arreglo vacío `data: []` con `total: 0` y código HTTP 200 (sin arrojar error 404 ni 500).
* **Comando de Ejecución:**
  ```bash
  curl -i -H "X-User-Id: 00000000-0000-4000-8000-000000000001" "http://localhost:3001/api/recursos?pagina=1&limite=10"
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
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-HU07-07`: Lógica de Cálculo de Disponibilidad Operativa (Unit Test)
* **Objetivo:** Validar que la función de cálculo determine fielmente el estado según stock, mantención y misiones en terreno.
* **Casos Unitarios Evaluados:**
  1. `cantidadInventario === 0` $\rightarrow$ `NO_DISPONIBLE`.
  2. `cantidadInventario > 0` y `cantidadDisponible <= cantidadMinima` $\rightarrow$ `BAJO_STOCK`.
  3. `cantidadDisponible === 0` y `cantidadEnUso > 0` $\rightarrow$ `ASIGNADO`.
  4. `estadoBase === "EN_MANTENCION"` $\rightarrow$ `EN_MANTENCION` (independiente del stock).
  5. `cantidadDisponible > cantidadMinima` $\rightarrow$ `DISPONIBLE`.
* **Resultado en Vitest:**
  ```
  ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (21 tests) - 100% passed
  ```
* **Evaluación:** ✅ **APROBADO**.

---

### `CP-HU07-13`: Ejecución de Suite Automatizada en Vitest
* **Objetivo:** Comprobar la no-regresión de todo el backend monolítico modular (Seguridad, Incidentes, Recursos y OpenAPI).
* **Comando de Ejecución:**
  ```bash
  npx vitest run
  ```
* **Evidencia de Consola:**
  ```text
   RUN  v2.1.9 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

   ✓ src/app/openapi.json/__tests__/route.test.ts (1)
   ✓ src/modules/incidentes/__tests__/incidentes.test.ts (13)
   ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (21)
   ✓ src/modules/seguridad/__tests__/seguridad.test.ts (21)
   ✓ src/app/api/recursos/__tests__/route.test.ts (7)

   Test Files  5 passed (5)
        Tests  63 passed (63)
     Duration  1.13s
  ```
* **Evaluación:** ✅ **APROBADO**.

---

## 4. Conclusión y Dictamen de Calidad (QA Sign-off)

La rama `feature/H7-listar-recursos` cumple a cabalidad con todos los criterios de aceptación técnicos y funcionales de la historia de usuario HU-7:
* Los endpoints cuentan con validación estricta Zod y control de acceso RBAC.
* La base de datos cuenta con migración Kysely Schema Builder con índices optimizados.
* Se dispone de la especificación OpenAPI actualizada y la guía de Handover para frontend.
* No existen defectos bloqueantes ni fallas de compilación.

**Dictamen:** **APROBADA PARA PULL REQUEST**.
