# Informe y Matriz de Casos de Prueba (QA): HU-2 — Panel de Seguimiento de Incidente (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Municipalidad de Valdivia.  
> **Módulo:** Incidentes y Avisos Ciudadanos (Operaciones ICS / Informante).  
> **Historia de Usuario:** HU-2 — *"Como informante quiero tener un panel tras reportar un incidente para poder ver el estado actual y hacer seguimiento a la atención de este mismo"*.  
> **Versión API:** `v0.9.0` | **Rama Git:** `feature/H2-panel-seguimiento` (mergeada a `develop`)  
> **Commits Clave:** `feat(incidentes): implementar consulta de seguimiento con descripciones ciudadanas y actualizacion socket`, `test(incidentes): agregar pruebas unitarias para seguimiento, socket y openapi 0.5.0`, `docs(api): documentar panel de seguimiento y actualizar modelo de datos en gemini.md`, `merge: pull request #6 desde sgrai-uach/feature/H1-chatbot-informante`  
> **Entorno de Pruebas:** Local (Docker Compose: PostgreSQL 16 + PostGIS, Redis 7; Node.js v20+, Next.js v16.3.4, Vitest v3.2.7).  
> **Fecha de Certificación:** 06 de Octubre de 2026.  
> **Estado de Certificación:** 🟢 **CERTIFICADO EN DEVELOP (100% PASS - CICLO DE RE-TEST COMPLETADO)**.

---

## 1. Ficha Técnica de la Historia de Usuario

| Parámetro | Detalle |
|---|---|
| **Proyecto** | Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) |
| **Módulo** | Incidentes (Atención Ciudadana / Seguimiento Informante) |
| **Historia de Usuario (HU)** | HU-2: Panel de Seguimiento de Incidente para Informante |
| **QA Responsable** | Equipo de Aseguramiento de Calidad (QA) SGRAI |
| **Desarrollador / Rama** | `feature/H2-panel-seguimiento` (integrada en `develop`) |
| **Entorno de Pruebas** | Local (PostgreSQL 16 PostGIS, Redis 7, Socket.io v4, Vitest v3.2.7) |
| **Total de Casos Evaluados** | 22 casos (5 Defectos/Bugs corregidos + 17 Casos de Prueba funcionales y no funcionales) |
| **Estado Global** | 🟢 **CERTIFICADO (100% PASSED TRAS RE-TEST)** |

---

## 2. Resumen Ejecutivo de Ejecución

| Métrica | Resultado |
|---|:---:|
| **Total Casos Diseñados y Ejecutados** | **22** |
| **Casos Aprobados Inicialmente (Passed)** | **17** |
| **Defectos Detectados y Corregidos (Bugs con Re-Test)** | **5** (`BUG-H2-API-01` a `05`) |
| **Casos Bloqueados (Blocked)** | **0** |
| **Tasa de Aprobación Final (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **23/23 tests específicos aprobados** |
| **Análisis Estático de Código (ESLint)** | **0 errores** |
| **Contrato de API (OpenAPI 3.0)** | **Sincronizado (`/openapi.json`)** |

---

## 3. Matriz Consolidada de 13 Columnas (Formato Hoja de Cálculo)

*(Esta tabla contiene exactamente las 13 columnas requeridas, con los defectos al inicio y commits sin hash).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H2-API-01` | Exposición de datos confidenciales (PII) en respuesta pública de seguimiento | Seguridad / Sanitización | DTO / Service | Crítica | Incidente registrado con informante (RUT y teléfono) en base de datos | `GET /api/incidentes/avisos/seguimiento/88776655` | Respuesta sin atributos `informanteRut`, `informanteTelefono` ni `operadorId` | Fuga de datos confidenciales: servicio retornaba objeto crudo de BD con `informante_rut` y `informante_telefono` | CORREGIDO | 19/09/2026 14:15 | 20/09/2026 17:40 | fix(incidentes): omitir datos sensibles (RUT y teléfono) en endpoint público de seguimiento |
| `BUG-H2-API-02` | Excepción no controlada HTTP 500 ante código con espacios en blanco o vacío | Robustez | Route Handler | Alta | Servidor API activo | `GET /api/incidentes/avisos/seguimiento/%20` con parámetro `codigo: "   "` | HTTP 400 Bad Request con mensaje `"El código de seguimiento es obligatorio."` | Error 500 Internal Server Error por consulta SQL inválida al ejecutar búsqueda con string vacío | CORREGIDO | 19/09/2026 14:30 | 20/09/2026 17:42 | fix(incidentes): validar y sanitizar código de seguimiento obligatorio con trim en route handler |
| `BUG-H2-API-03` | Omisión de prefijo de sala en evento Socket.io de actualización de seguimiento | Tiempo Real | Socket.io / Eventos | Crítica | Informante conectado a Socket.io esperando actualizaciones de su reporte | Invocación de `cambiarEstadoIncidente("55443322", "RESUELTO")` | Evento `incidente:estado_actualizado` emitido hacia la sala `sala:seguimiento:55443322` | Evento emitido a sala global no aislada, clientes del código no recibían actualización en vivo | CORREGIDO | 19/09/2026 15:00 | 20/09/2026 17:45 | fix(socket): aislar sala de seguimiento por código numérico y sincronizar con Redis pub/sub |
| `BUG-H2-API-04` | Retorno de estado técnico no amigable ante avisos preliminares descartados | Regla de Negocio | DAL / Service | Media | Aviso preliminar registrado en `aviso_incidente` con estado `DESCARTADO` | `GET /api/incidentes/avisos/seguimiento/77889900` | Mapeo canónico a estado ciudadano `NO_ABORDABLE` con explicación comprensible | Retorno de estado crudo `DESCARTADO`, rompiendo contrato visual del stepper en frontends | CORREGIDO | 19/09/2026 15:30 | 20/09/2026 17:48 | fix(incidentes): homologar estado descartado a NO_ABORDABLE con descripciones ciudadanas |
| `BUG-H2-API-05` | Ausencia del endpoint de seguimiento en especificación OpenAPI 3.0 (`/openapi.json`) | Integración | OpenAPI / Spec | Alta | Pipeline de build y generación de clientes frontend activo | `GET /openapi.json` | Ruta `/api/incidentes/avisos/seguimiento/{codigo}` documentada con schemas de respuesta 200, 400 y 404 | Ruta ausente en el objeto `paths`, provocando tipos `unknown` o faltantes en el cliente API de `web` | CORREGIDO | 19/09/2026 16:00 | 20/09/2026 17:50 | fix(openapi): registrar ruta de seguimiento y vincular ConsultaSeguimientoResponseSchema |
| `CP-H2-API-01` | Compatibilidad e integración de rama con develop | Integración | Git / Rama | Crítica | Rama `feature/H2-panel-seguimiento` integrada | `git merge-base origin/develop HEAD` | Fusión limpia sin conflictos con la base de `develop` | Rama sincronizada con develop sobre base limpia sin conflictos | APROBADO | 20/09/2026 17:52 | - | merge: sincronizar rama con develop sin conflictos |
| `CP-H2-API-02` | Compilación estricta y suite de pruebas Vitest | Calidad | Test Runner | Crítica | Dependencias instaladas y base de datos activa | `npm test` en repositorio api | 100% de suites y tests aprobados en pipeline CI | 18 suites y 211 tests aprobados al 100% | APROBADO | 20/09/2026 17:53 | - | test(incidentes): agregar pruebas unitarias para seguimiento |
| `CP-H2-API-03` | Conformidad de estándares de código ESLint | Calidad | Linter | Media | Linter configurado en API | `npm run lint` | 0 errores de sintaxis y tipado estricto | 0 errores (3 advertencias no bloqueantes de variables) | APROBADO | 20/09/2026 17:54 | - | feat(incidentes): implementar consulta de seguimiento |
| `CP-H2-API-04` | Acceso público anónimo sin cabecera de autenticación | Seguridad | Route Handler | Crítica | API en ejecución | `GET /api/incidentes/avisos/seguimiento/58291045` sin cabeceras `X-User-Id` ni `Authorization` | Acceso permitido sin respuesta HTTP 401 ni 403 (endpoint público para informante) | Petición procesada exitosamente sin requerir credenciales de operador | APROBADO | 20/09/2026 17:55 | - | feat(api): implementar endpoints de avisos, seguimiento y tipos |
| `CP-H2-API-05` | Rechazo por código de seguimiento vacío o solo espacios | Robustez | Validación / API | Alta | API en ejecución | `GET /api/incidentes/avisos/seguimiento/%20` con parámetro `codigo: "   "` | HTTP 400 Bad Request con mensaje `"El código de seguimiento es obligatorio."` | HTTP 400 Bad Request con mensaje descriptivo de validación | APROBADO | 20/09/2026 17:55 | - | feat(incidentes): validar código no vacío en route handler |
| `CP-H2-API-06` | Respuesta controlada ante código de seguimiento inexistente | Robustez | Route Handler | Alta | Base de datos activa sin coincidencia para el código provisto | `GET /api/incidentes/avisos/seguimiento/99999999` | HTTP 404 Not Found con mensaje descriptivo para el ciudadano | HTTP 404 Not Found `"No se encontró ningún reporte asociado..."` | APROBADO | 20/09/2026 17:56 | - | feat(incidentes): manejo 404 para reporte inexistente |
| `CP-H2-API-07` | Sanitización transparente de espacios en blanco en extremos | Robustez | DAL / Service | Media | Reporte registrado con código `58291045` | Petición con espacios en el parámetro: `" 58291045 "` | Búsqueda exitosa tras `codigo.trim()` y retorno HTTP 200 OK | Espacios recortados transparentemente y reporte retornado | APROBADO | 20/09/2026 17:56 | - | feat(incidentes): normalizar y aplicar trim en código |
| `CP-H2-API-08` | Inmunidad frente a inyección SQL en parámetro de consulta | Seguridad | DB / Kysely | Crítica | Base de datos PostgreSQL activa | `GET /api/incidentes/avisos/seguimiento/'%20OR%20'1'='1` | Consulta parametrizada en Kysely, sin error SQL; retorno HTTP 404 | Parametrización segura aplicada, retorno HTTP 404 sin fuga de datos | APROBADO | 20/09/2026 17:57 | - | feat(incidentes): query parametrizado en repository Kysely |
| `CP-H2-API-09` | Consulta amigable de incidente en estado REPORTADO | Funcional | API / Negocio | Alta | Incidente existente en base de datos con estado `REPORTADO` | `GET /api/incidentes/avisos/seguimiento/84920194` | HTTP 200 OK con `estado: "REPORTADO"`, `estadoEtiqueta: "Reportado"` y descripción ciudadana | Retorno con descripción amigable de recepción en central | APROBADO | 20/09/2026 17:57 | - | feat(incidentes): catálogo DETALLE_ESTADOS_SEGUIMIENTO |
| `CP-H2-API-10` | Consulta amigable de incidente en estado VERIFICANDO | Funcional | API / Negocio | Alta | Incidente con patrulla asignada en terreno (`VERIFICANDO`) | `GET /api/incidentes/avisos/seguimiento/20491823` | HTTP 200 OK con `estadoEtiqueta: "En Verificación"` y detalle de patrulla en ruta | Retorno con descripción clara de patrulla evaluando en terreno | APROBADO | 20/09/2026 17:58 | - | feat(incidentes): mapeo de estado VERIFICANDO para ciudadano |
| `CP-H2-API-11` | Consulta amigable de incidente en estado EN_ATENCION | Funcional | API / Negocio | Alta | Incidente con cuadrilla operativa trabajando en terreno | `GET /api/incidentes/avisos/seguimiento/58291045` | HTTP 200 OK con `estadoEtiqueta: "En Atención"` y mención de cuadrilla municipal | HTTP 200 con etiqueta `"En Atención"` y explicación amigable | APROBADO | 20/09/2026 17:58 | - | feat(incidentes): mapeo de estado EN_ATENCION para ciudadano |
| `CP-H2-API-12` | Consulta amigable de incidente en estado NO_ABORDABLE | Funcional | API / Negocio | Alta | Incidente evaluado no correspondiente a competencia municipal | `GET /api/incidentes/avisos/seguimiento/11223344` | HTTP 200 OK con `estadoEtiqueta: "No Abordable"` y justificación clara sin tecnicismos | HTTP 200 con explicación ciudadana sin jerga técnica | APROBADO | 20/09/2026 17:59 | - | feat(incidentes): mapeo de estado NO_ABORDABLE para ciudadano |
| `CP-H2-API-13` | Consulta amigable de incidente en estado RESUELTO | Funcional | API / Negocio | Alta | Incidente con trabajos de mitigación concluidos | `GET /api/incidentes/avisos/seguimiento/55443322` | HTTP 200 OK con `estadoEtiqueta: "Resuelto"` y mensaje de éxito municipal | HTTP 200 con confirmación de conclusión exitosa de trabajos | APROBADO | 20/09/2026 17:59 | - | feat(incidentes): mapeo de estado RESUELTO para ciudadano |
| `CP-H2-API-14` | Generación aleatoria y no secuencial de código numérico de 8 dígitos | Seguridad / Algoritmo | Utilidad | Alta | Generación de nuevo código de seguimiento | Invocación de `generarCodigoSeguimientoNumerico()` | Código numérico entero de 8 dígitos en rango [10000000, 99999999] no predecible | Código de 8 dígitos generado aleatoriamente evitando enumeración | APROBADO | 20/09/2026 18:00 | - | feat(incidentes): generador no secuencial de códigos |
| `CP-H2-API-15` | Emisión en tiempo real vía Socket.io a sala del informante y encargados | Tiempo Real | Socket.io / Eventos | Crítica | Servidor Socket.io activo, informante suscrito a sala de seguimiento | Cambio de estado mediante `cambiarEstadoIncidente("55443322", "RESUELTO")` | Emisión de evento `incidente:estado_actualizado` a `sala:seguimiento:55443322` y a `sala:encargados` | Eventos emitidos concurrentemente a ambas salas con payloads formateados | APROBADO | 20/09/2026 18:00 | - | feat(socket): notificarActualizacionSeguimiento |
| `CP-H2-API-16` | Publicación en bus Redis Pub/Sub para sockets distribuidos | Tiempo Real | Infraestructura | Alta | Servidor con Redis configurado (`REDIS_URL`) | Cambio de estado con Socket.io en modo multi-proceso | Publicación de mensaje JSON en canal `sgrai:sockets` con `room` del código | Mensaje publicado en Redis permitiendo notificación multi-instancia | APROBADO | 20/09/2026 18:01 | - | feat(socket): bus Redis en lib/socket |
| `CP-H2-API-17` | Exposición de contrato OpenAPI 3.0 en endpoint público | Contrato API | OpenAPI / Zod | Alta | API en ejecución | `GET /openapi.json` | Path `/api/incidentes/avisos/seguimiento/{codigo}` registrado con `ConsultaSeguimientoResponse` | Especificación OpenAPI v0.6.0 documentada con schemas y respuestas 200, 400 y 404 | APROBADO | 20/09/2026 18:02 | - | docs(openapi): registrar contrato en openapi.json |

---

## 4. Guía de Ejecución Paso a Paso 100% Replicable

Cada prueba puede ser verificada ejecutando directamente los comandos indicados en la terminal.

### 4.1. Defectos Corregidos (Bugs con Re-Test)

#### `BUG-H2-API-01`: Exposición de datos confidenciales (PII) en respuesta pública
* **Objetivo:** Verificar que el endpoint de seguimiento no entregue RUT ni teléfono del informante.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/incidentes/__tests__/aviso-incidente.test.ts -t "debe retornar los datos del incidente y descripciones comprensibles si el código existe"
  ```
* **Salida Obtenida:**
  ```text
   ✓ src/modules/incidentes/__tests__/aviso-incidente.test.ts (20 tests | 19 skipped) 8ms
     ✓ Módulo Incidentes - Avisos e Incidentes (ERD Alignment) > 6. Consulta de Estado de Seguimiento Ciudadano con Descripciones Claras > debe retornar los datos del incidente y descripciones comprensibles si el código existe
   Test Files 1 passed (1)
   Tests 1 passed | 19 skipped (20)
  ```
* **Verificación de Aislamiento:**
  `expect(resultado?.informanteRut).toBeUndefined()` y `expect(resultado?.informanteTelefono).toBeUndefined()` confirmados.

---

#### `BUG-H2-API-02`: Validación estricta y HTTP 400 ante código vacío o con espacios
* **Objetivo:** Asegurar que parámetros vacíos retornen HTTP 400 y no error 500 no controlado.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/app/api/incidentes/avisos/seguimiento/[codigo]/__tests__/route.test.ts -t "debe responder 400 si el código de seguimiento está vacío"
  ```
* **Salida Obtenida:**
  ```text
   ✓ src/app/api/incidentes/avisos/seguimiento/[codigo]/__tests__/route.test.ts (3 tests | 2 skipped) 12ms
     ✓ Endpoint GET /api/incidentes/avisos/seguimiento/[codigo] > debe responder 400 si el código de seguimiento está vacío o solo contiene espacios
  ```
* **Comando cURL de Prueba:**
  ```bash
  curl -s -i "http://localhost:3001/api/incidentes/avisos/seguimiento/%20"
  ```
* **Respuesta HTTP y JSON Obtenido:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "El código de seguimiento es obligatorio."
  }
  ```

---

#### `BUG-H2-API-03`: Aislamiento de sala Socket.io `sala:seguimiento:{codigo}`
* **Objetivo:** Certificar que la notificación se dirija a la sala exclusiva del código numérico.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/incidentes/__tests__/aviso-incidente.test.ts -t "debe emitir actualización por Socket.io a la sala del código de seguimiento"
  ```
* **Salida Obtenida:**
  ```text
   ✓ src/modules/incidentes/__tests__/aviso-incidente.test.ts (20 tests | 19 skipped) 15ms
     ✓ Módulo Incidentes - Avisos e Incidentes (ERD Alignment) > 6. Consulta de Estado de Seguimiento Ciudadano con Descripciones Claras > debe emitir actualización por Socket.io a la sala del código de seguimiento y a la sala de encargados al cambiar de estado
  ```

---

#### `BUG-H2-API-04`: Homologación de avisos descartados a estado NO_ABORDABLE
* **Objetivo:** Validar que los avisos descartados se traduzcan en el catálogo amigable ciudadano.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/incidentes/__tests__/aviso-incidente.test.ts -t "debe retornar la descripción ciudadana correcta para el estado NO_ABORDABLE"
  ```
* **Salida Obtenida:**
  ```text
   ✓ src/modules/incidentes/__tests__/aviso-incidente.test.ts (20 tests | 19 skipped) 7ms
     ✓ Módulo Incidentes - Avisos e Incidentes (ERD Alignment) > 6. Consulta de Estado de Seguimiento Ciudadano con Descripciones Claras > debe retornar la descripción ciudadana correcta para el estado NO_ABORDABLE
  ```
* **JSON Obtenido:**
  ```json
  {
    "estado": "NO_ABORDABLE",
    "estadoEtiqueta": "No Abordable",
    "estadoDescripcion": "El caso fue evaluado por el equipo pero no corresponde al ámbito de acción municipal, o bien no se constató afectación en el lugar."
  }
  ```

---

#### `BUG-H2-API-05`: Verificación del contrato OpenAPI 3.0
* **Objetivo:** Comprobar que la especificación contenga la ruta y schemas de seguimiento.
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/app/openapi.json/__tests__/route.test.ts
  ```
* **Salida Obtenida:**
  ```text
   ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 246ms
     ✓ Endpoint GET /openapi.json > debe retornar un spec OpenAPI 3.0 válido con paths esperados
   Test Files 1 passed (1)
   Tests 1 passed (1)
  ```

---

### 4.2. Casos de Prueba Funcionales y de API

#### `CP-H2-API-04` y `CP-H2-API-11`: Consulta exitosa en estado EN_ATENCION (Acceso Público)
* **Comando cURL de Prueba:**
  ```bash
  curl -s -i "http://localhost:3001/api/incidentes/avisos/seguimiento/58291045"
  ```
* **Respuesta HTTP y JSON Obtenido:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Reporte encontrado exitosamente.",
    "data": {
      "codigoSeguimiento": "58291045",
      "estado": "EN_ATENCION",
      "estadoEtiqueta": "En Atención",
      "estadoDescripcion": "El incidente fue confirmado en terreno y una cuadrilla operativa municipal está trabajando en el lugar para atender la emergencia.",
      "tipoAfectacion": "Anegamiento",
      "direccionAproximada": "Av. Alemania 550",
      "descripcion": null,
      "creadoEn": "2026-09-07T15:00:00.000Z",
      "actualizadoEn": "2026-09-07T16:00:00.000Z",
      "esDuplicado": false
    }
  }
  ```

---

#### `CP-H2-API-06`: Reporte no encontrado (HTTP 404)
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/app/api/incidentes/avisos/seguimiento/[codigo]/__tests__/route.test.ts -t "debe responder 404 si el reporte no existe"
  ```
* **Comando cURL de Prueba:**
  ```bash
  curl -s -i "http://localhost:3001/api/incidentes/avisos/seguimiento/99999999"
  ```
* **Respuesta HTTP y JSON Obtenido:**
  ```http
  HTTP/1.1 404 Not Found
  Content-Type: application/json

  {
    "message": "No se encontró ningún reporte asociado al código de seguimiento proporcionado."
  }
  ```

---

#### `CP-H2-API-14`: Generación aleatoria no secuencial de 8 dígitos
* **Comando de Ejecución:**
  ```bash
  npx vitest run src/modules/incidentes/__tests__/aviso-incidente.test.ts -t "Generador de Código de Seguimiento Numérico"
  ```
* **Salida Obtenida:**
  ```text
   ✓ src/modules/incidentes/__tests__/aviso-incidente.test.ts (20 tests | 18 skipped) 9ms
     ✓ Módulo Incidentes - Avisos e Incidentes (ERD Alignment) > 2. Generador de Código de Seguimiento Numérico > debe generar un código estrictamente numérico de 8 dígitos
     ✓ Módulo Incidentes - Avisos e Incidentes (ERD Alignment) > 2. Generador de Código de Seguimiento Numérico > debe generar códigos con variación aleatoria
  ```

---

## 5. Trazabilidad con Criterios de Aceptación (HU-2)

| Criterio de Aceptación | Casos de Prueba Asociados | Estado QA |
|---|---|:---:|
| **CA-1: Acceso mediante código único de seguimiento:** El informante accede mediante código numérico proporcionado tras el reporte. | `CP-H2-API-04`, `CP-H2-API-07`, `CP-H2-API-14` | 🟢 APROBADO |
| **CA-2: Visualización visual y amigable del estado:** El panel muestra claramente el estado del incidente en ciclo ICS con lenguaje ciudadano. | `BUG-H2-API-04`, `CP-H2-API-09`, `CP-H2-API-10`, `CP-H2-API-11`, `CP-H2-API-12`, `CP-H2-API-13` | 🟢 APROBADO |
| **CA-3: Resumen básico sin exponer datos confidenciales:** Presenta fecha, hora, tipo y dirección aproximada, sin exponer RUT ni teléfono. | `BUG-H2-API-01`, `CP-H2-API-09`, `CP-H2-API-11` | 🟢 APROBADO |
| **CA-4: Actualizaciones de estado en tiempo real:** Cambios gestionados por central se emiten vía Socket.io a la sala del reporte. | `BUG-H2-API-03`, `CP-H2-API-15`, `CP-H2-API-16` | 🟢 APROBADO |
| **CA-5: Manejo claro ante código inválido o inexistente:** Mensajes amigables de error ante códigos vacíos (400) o no encontrados (404). | `BUG-H2-API-02`, `CP-H2-API-05`, `CP-H2-API-06`, `CP-H2-API-08` | 🟢 APROBADO |
| **CA-6: Contrato formal de API OpenAPI:** Exposición de endpoints y schemas para tipado estricto en frontend. | `BUG-H2-API-05`, `CP-H2-API-17` | 🟢 APROBADO |

---

## 6. Veredicto Final de Calidad

La Historia de Usuario **HU-2 (Panel de Seguimiento de Incidente)** se encuentra **100% CERTIFICADA** en el backend `sgrai-api`. Todos los 5 defectos detectados durante las pruebas exploratorias e integrales fueron corregidos y retestados formalmente, logrando un 100% de éxito en la suite automatizada y garantizando la privacidad de los datos de la ciudadanía valdiviana.
