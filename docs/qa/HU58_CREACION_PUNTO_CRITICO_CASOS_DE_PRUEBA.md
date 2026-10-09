# Informe y Matriz de Casos de Prueba (QA): HU-58 — Creación de Punto Crítico (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Prevención y Mitigación (Sección de Operaciones ICS — Puntos Críticos y Monitoreo Territorial).  
> **Historia de Usuario:** HU-58 — *"Como Administrador Quiero crear un punto crítico Para tener una coordenada donde poder enviar patrullas"*.  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/H58-creacion-punto-critico` (incorporada e integrada formalmente en rama `develop` mediante Pull Request #25, commit de merge `a75c7aa`).  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(db): agregar migracion 015 con creado_por_id y permiso puntos_criticos:crear`
> * `feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)`
> * `test(eventos-atp): agregar pruebas unitarias e integracion para creacion de puntos criticos`
> * `docs(eventos-atp): documentar endpoint POST /api/puntos-criticos`
> * `fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico`
> * `merge: sincronizar con develop resolviendo colision en migracion 017 y preservando H55 y H56`
> * `merge: sincronizar con develop, resolver conflictos en socket y docs, y renumerar migración a 020`
>
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **20** (15 Casos Funcionales/Seguridad/Integración + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **15** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **76/76 tests en suites de puntos críticos exitosos (`route.test.ts` + `punto-critico.test.ts` + `[id]/route.test.ts`)** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Compilación de Producción (Next.js)** | **Exitosa (`npm run build`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Integridad de Base de Datos y Migraciones** | **100% validado con migración Kysely `020_prevencion_creado_por_permiso.ts` y PostGIS** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` con ruta `POST /api/puntos-criticos`** |
| **Sincronización en Tiempo Real** | **Evento Socket.io `punto_critico:creado` emitido reactivamente hacia clientes y salas operativas** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo las directrices docentes de Aseguramiento de Calidad (*detección de defectos durante el ciclo de vida de la rama, reporte formal al equipo de desarrollo, implementación del fix mediante commits en Conventional Commits y ejecución de re-test formal para certificación de cierre*), se detectaron y gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H58-API-01` | Fallo de validación Zod al recibir cadenas vacías `""` o literales `"null"` en campos opcionales del formulario (`descripcion`, `tipoRiesgo`, `delegacionId`), arrojando HTTP 400 Bad Request por UUID o string inválido. | Alta | `src/modules/eventos-atp/punto-critico.schema.ts` | 05/10/2026 01:15 | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico | 05/10/2026 03:40 | 🟢 CORREGIDO (Campos opcionales envueltos en `.nullish().transform(...)` transformando cadenas vacías a `null` sin fallar la validación) |
| `BUG-H58-API-02` | Rechazo de creación por capitalización o acentos en el campo `prioridad` ("Alta", "Crítica", "baja", "CRITICA") debido a validación enum rígida en el esquema inicial de Zod. | Media | `src/modules/eventos-atp/punto-critico.schema.ts` | 05/10/2026 01:45 | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico | 05/10/2026 03:45 | 🟢 CORREGIDO (Transformación tolerante en Zod que normaliza a mayúsculas y mapea prefijos "CRITIC", "ALT", "MED", "BAJ" al enum canónico) |
| `BUG-H58-API-03` | Error 500 no capturado por violación de clave foránea en base de datos al enviar un `delegacionId` inexistente, en lugar de retornar un error HTTP 400 controlado. | Alta | `src/modules/eventos-atp/punto-critico.service.ts` | 05/10/2026 02:10 | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico | 05/10/2026 03:50 | 🟢 CORREGIDO (Validación previa con `obtenerDelegacionPorId` arrojando `BadRequestError` con mensaje explicativo si la delegación no existe) |
| `BUG-H58-API-04` | Colisión de numeración correlativa en migraciones Kysely con rama develop (`015_prevencion_creado_por_permiso.ts`) al colisionar con migración 015 de HU-55 y 016 de HU-56. | Crítica | `src/lib/db/migrations/` | 05/10/2026 09:30 | merge: sincronizar con develop resolviendo colision en migracion 017 y preservando H55 y H56 | 05/10/2026 11:00 | 🟢 CORREGIDO (Migración renumerada inicialmente a 017 y posteriormente a `020_prevencion_creado_por_permiso.ts` manteniendo coherencia con el pool Kysely) |
| `BUG-H58-API-05` | Desincronización del evento Socket.io y falta de broadcast hacia módulos de cartografía y salas operativas ("administrador", "encargado", "supervisor") tras resolución de merge. | Alta | `src/lib/socket/index.ts` | 05/10/2026 19:15 | merge: sincronizar con develop, resolver conflictos en socket y docs, y renumerar migración a 020 | 05/10/2026 20:35 | 🟢 CORREGIDO (Helper `emitirPuntoCriticoCreado` emite a todas las salas operativas pertinentes y realiza broadcast global del evento `punto_critico:creado`) |

---

## 3. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Descripción del Criterio | Casos de Prueba Asociados | Estado QA |
|---|---|---|:---:|
| **CA-1** | El sistema debe permitir al usuario con rol de Administrador acceder a un formulario para la creación de un nuevo "Punto Crítico". | `CP-H58-API-01`, `CP-H58-API-02`, `CP-H58-API-12`, `CP-H58-API-13` | **CUMPLIDO** |
| **CA-2** | El formulario debe integrar un mapa interactivo que permita seleccionar visualmente la coordenada geográfica (latitud y longitud) del punto crítico. | `CP-H58-API-01`, `CP-H58-API-02`, `CP-H58-API-07`, `CP-H58-API-08`, `CP-H58-API-09`, `CP-H58-API-14` | **CUMPLIDO** |
| **CA-3** | El sistema debe requerir y validar la información obligatoria (por ejemplo: nombre, descripción, nivel de severidad/riesgo y las coordenadas exactas). | `CP-H58-API-03`, `CP-H58-API-04`, `CP-H58-API-05`, `CP-H58-API-06`, `CP-H58-API-07`, `CP-H58-API-08`, `CP-H58-API-09`, `CP-H58-API-11` | **CUMPLIDO** |
| **CA-4** | El sistema debe notificar visualmente al administrador el éxito o fracaso de la operación tras intentar guardar el registro. | `CP-H58-API-01`, `CP-H58-API-05`, `CP-H58-API-10`, `CP-H58-API-11` | **CUMPLIDO** |
| **CA-5** | Una vez creado exitosamente, el punto crítico debe persistir en la base de datos y quedar disponible para ser visualizado en los módulos cartográficos del sistema. | `CP-H58-API-01`, `CP-H58-API-02`, `CP-H58-API-14`, `CP-H58-API-15` | **CUMPLIDO** |
| **CA-6** | Si un usuario sin privilegios de Administrador intenta acceder a la creación del punto crítico, el sistema debe bloquear la acción y mostrar un error de permisos. | `CP-H58-API-12`, `CP-H58-API-13` | **CUMPLIDO** |

---

## 4. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H58-API-01` | Fallo de validación Zod con strings vacíos y cadenas null en campos opcionales del formulario | Validación | Schema / Zod | Alta | Esquema CrearPuntoCriticoBodySchema activo | Payload con descripcion: "", tipoRiesgo: "", delegacionId: "" | Zod sanitiza y transforma valores a null sin arrojar error 400 | Fallaba con 400 Bad Request por UUID o formato string inválido | CORREGIDO | 05/10/2026 01:15 | 05/10/2026 03:40 | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico |
| `BUG-H58-API-02` | Rechazo de creación por capitalización o acentos en el campo prioridad del formulario | Validación | Schema / Zod | Media | Endpoint POST /api/puntos-criticos disponible | Payload con prioridad: "Alta" o prioridad: "Crítica" | Normalización tolerante asignando valor canónico ALTA o CRITICA | HTTP 400 indicando valor no reconocido en enum estricto | CORREGIDO | 05/10/2026 01:45 | 05/10/2026 03:45 | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico |
| `BUG-H58-API-03` | Error 500 no capturado por violación de clave foránea al enviar delegacionId inexistente | Integración | DB / Service | Alta | Base de datos relacional PostgreSQL activa | Payload con delegacionId: "30000000-0000-4000-8000-999999999999" | HTTP 400 Bad Request: 'La delegación territorial con ID ... no existe en el sistema.' | Error 500 Internal Server Error no controlado por fallo FK | CORREGIDO | 05/10/2026 02:10 | 05/10/2026 03:50 | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico |
| `BUG-H58-API-04` | Colisión de numeración correlativa en migraciones Kysely con rama develop (migración 015) | Integridad BD | Migración Kysely | Crítica | Rama sincronizada con develop concurrente | Verificación correlativa de archivos en src/lib/db/migrations/ | Secuencia correlativa sin colisiones numéricas de archivos de migración | Dos archivos compartían el prefijo 015 provocando inconsistencia | CORREGIDO | 05/10/2026 09:30 | 05/10/2026 11:00 | merge: sincronizar con develop resolviendo colision en migracion 017 y preservando H55 y H56 |
| `BUG-H58-API-05` | Desincronización de evento Socket.io y falta de broadcast hacia módulos cartográficos | Integración | Socket.io / Eventos | Alta | Servidor Socket.io activo en backend | Creación exitosa de punto crítico vía crearPuntoCritico | Emisión de punto_critico:creado hacia salas operativas y broadcast global | Evento socket desalineado no llegaba a salas operativas ni broadcast | CORREGIDO | 05/10/2026 19:15 | 05/10/2026 20:35 | merge: sincronizar con develop, resolver conflictos en socket y docs, y renumerar migración a 020 |
| `CP-H58-API-01` | Creación exitosa de punto crítico sin delegación con autogeneración de código PC-VAL (CA-1, CA-2, CA-4, CA-5) | Funcional | API / Route | Crítica | Base de datos activa y usuario Administrador autenticado | POST /api/puntos-criticos con payload válido sin delegacionId y header admin | HTTP 201 Created con entidad creada, código autogenerado PC-VAL-001 y PostGIS | HTTP 201 Created con entidad completa y código autogenerado PC-VAL-001 | APROBADO | 05/10/2026 21:00 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-02` | Creación exitosa de punto crítico con delegación asignada y código territorial PC-SUR (CA-1, CA-2, CA-5) | Funcional | API / Route | Alta | Delegación territorial registrada en tabla delegacion | POST /api/puntos-criticos con delegacionId de Delegación Sur y header admin | HTTP 201 Created con código institucional territorial PC-SUR-001 y objeto delegación | HTTP 201 Created con delegación vinculada y código territorial generado | APROBADO | 05/10/2026 21:05 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-03` | Asignación automática de prioridad MEDIA por defecto si no es provista en el payload (CA-3) | Lógica de Negocio | Schema / Service | Media | Payload con solo campos obligatorios (nombre, latitud, longitud) | POST /api/puntos-criticos omitiendo campo prioridad | HTTP 201 Created con atributo prioridad = "MEDIA" asignado automáticamente | HTTP 201 Created con prioridad MEDIA asignada por defecto | APROBADO | 05/10/2026 21:10 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-04` | Admisión de tipo de riesgo personalizado (VARCHAR) y opciones sugeridas de catálogo (CA-3) | Funcional | Schema / Zod | Media | Servidor API en ejecución | POST /api/puntos-criticos con tipoRiesgo: "Afloramiento de aguas subterráneas" | HTTP 201 Created persistiendo tipo de riesgo en VARCHAR(100) | HTTP 201 Created con tipo de riesgo personalizado registrado | APROBADO | 05/10/2026 21:15 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-05` | Rechazo con HTTP 400 Bad Request si el nombre contiene menos de 3 caracteres (CA-3, CA-4) | Validación | API / Schema | Alta | Endpoint POST invocado con payload inválido | POST /api/puntos-criticos con body {"nombre": "AB", "latitud": -39.8, "longitud": -73.2} | HTTP 400 Bad Request: 'El nombre debe tener al menos 3 caracteres.' | HTTP 400 con error Zod: 'El nombre debe tener al menos 3 caracteres.' | APROBADO | 05/10/2026 21:20 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-06` | Rechazo con HTTP 400 Bad Request si el nombre excede los 150 caracteres permitidos (CA-3, CA-4) | Validación | API / Schema | Media | Endpoint POST invocado con nombre excesivo | POST /api/puntos-criticos con nombre de 151 caracteres | HTTP 400 Bad Request: 'El nombre no puede exceder los 150 caracteres.' | HTTP 400 con error Zod indicando exceso de longitud de caracteres | APROBADO | 05/10/2026 21:25 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-07` | Rechazo con HTTP 400 Bad Request si la coordenada de latitud excede rango [-90, 90] (CA-2, CA-3) | Validación | API / Schema | Alta | Coordenada geográfica errónea enviada desde formulario | POST /api/puntos-criticos con latitud: -95.5 o latitud: 95.0 | HTTP 400 Bad Request: 'La latitud debe ser mayor o igual a -90' | HTTP 400 con mensaje Zod de latitud fuera de rango | APROBADO | 05/10/2026 21:30 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-08` | Rechazo con HTTP 400 Bad Request si la coordenada de longitud excede rango [-180, 180] (CA-2, CA-3) | Validación | API / Schema | Alta | Coordenada geográfica anómala enviada desde formulario | POST /api/puntos-criticos con longitud: -190.0 o longitud: 185.0 | HTTP 400 Bad Request: 'La longitud debe ser menor o igual a 180.' | HTTP 400 con mensaje Zod de longitud fuera de rango | APROBADO | 05/10/2026 21:35 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-09` | Rechazo con HTTP 400 Bad Request ante omisión de coordenadas geográficas en payload (CA-2, CA-3) | Validación | API / Schema | Alta | Payload sin campos de latitud y longitud | POST /api/puntos-criticos con body sin latitud ni longitud | HTTP 400 Bad Request indicando ausencia obligatoria de coordenadas | HTTP 400 con error Zod por campos numéricos requeridos no provistos | APROBADO | 05/10/2026 21:40 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-10` | Rechazo con HTTP 400 Bad Request ante cuerpo de solicitud con sintaxis JSON inválida (CA-4) | Robustez | API / Route | Media | Endpoint POST invocado con formato malformado | POST /api/puntos-criticos con body "invalid-json{" y header application/json | HTTP 400 Bad Request: 'El cuerpo de la solicitud no es un JSON válido.' | HTTP 400: 'El cuerpo de la solicitud no es un JSON válido.' | APROBADO | 05/10/2026 21:45 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-11` | Rechazo con HTTP 400 Bad Request cuando la delegación territorial UUID no existe en BD (CA-3, CA-4) | Validación | Service / DB | Alta | Delegación territorial inexistente en base de datos | POST /api/puntos-criticos con delegacionId no registrado en BD | HTTP 400 Bad Request: 'La delegación territorial con ID ... no existe en el sistema.' | HTTP 400 Bad Request informando inexistencia de la delegación | APROBADO | 05/10/2026 21:50 | - | fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico |
| `CP-H58-API-12` | Control RBAC rechazando solicitudes anónimas sin cabecera de autenticación HTTP 401 (CA-1, CA-6) | Seguridad (RBAC) | API / Auth | Crítica | Endpoint POST invocado sin credenciales | POST /api/puntos-criticos sin header x-user-id ni Authorization | HTTP 401 Unauthorized informando falta de autenticación | HTTP 401: 'Cabecera X-User-Id requerida para autenticación.' | APROBADO | 05/10/2026 21:55 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-13` | Control RBAC bloqueando usuarios sin rol Administrador con HTTP 403 Forbidden (CA-1, CA-6) | Seguridad (RBAC) | API / RBAC | Crítica | Usuario existente con rol no administrativo (Informante / Call Center) | POST /api/puntos-criticos con x-user-id de Informante | HTTP 403 Forbidden: 'Acceso denegado. Se requiere el perfil de Administrador...' | HTTP 403 Forbidden impidiendo creación de puntos críticos a no administradores | APROBADO | 05/10/2026 22:00 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |
| `CP-H58-API-14` | Persistencia geoespacial PostGIS ST_SetSRID y registro estricto de auditoría creado_por_id (CA-2, CA-5) | Persistencia | DB / PostGIS | Crítica | Migración 020 aplicada con columna creado_por_id | Petición POST procesada exitosamente en el endpoint | Geometría PostGIS EPSG:4326 calculada y creado_por_id igual al UUID del admin | Punto espacial guardado con ST_MakePoint y auditoría asignada en BD | APROBADO | 05/10/2026 22:10 | - | feat(db): agregar migracion 015 con creado_por_id y permiso puntos_criticos:crear |
| `CP-H58-API-15` | Emisión reactiva de notificación WebSocket punto_critico:creado para módulo cartográfico (CA-5) | Tiempo Real | Socket.io | Crítica | Servidor Socket.io inicializado en backend | Petición POST completada exitosamente en el endpoint | Emisión de evento punto_critico:creado a salas operativas y broadcast global | Evento socket emitido con payload completo reflejando punto en mapa | APROBADO | 05/10/2026 22:20 | - | feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58) |

---

## 5. Guía de Ejecución y Casos Replicables Paso a Paso

Para auditar y reproducir de manera idéntica los resultados obtenidos en la columna **"Resultado Obtenido"**, ejecuta los siguientes comandos en la raíz del proyecto `sgrai-api`:

### 5.1. Verificación Estática y Compilación de Producción
```bash
# 1. Verificación de tipado estático TypeScript
npx tsc --noEmit
# Salida esperada: 0 errores (código de salida 0)

# 2. Análisis estático con ESLint
npm run lint
# Salida esperada: 0 errores

# 3. Compilación de producción Next.js
npm run build
# Salida esperada: ✓ Compiled successfully
```

---

### 5.2. Pruebas Automatizadas Unitarias y de Integración con Vitest

#### CP-H58-API-01, 05, 09, 10, 11, 12, 13 (Route Handler POST /api/puntos-criticos)
```bash
npx vitest run src/app/api/puntos-criticos/__tests__/route.test.ts -t "POST /api/puntos-criticos"
```
**Salida exacta obtenida:**
```text
 ✓ src/app/api/puntos-criticos/__tests__/route.test.ts (7 tests) 14ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 401 si no se envía cabecera de autenticación 4ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 403 si un usuario sin rol de Administrador intenta crear un punto crítico 2ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 400 si el body enviado no es JSON válido 1ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 400 si la validación de Zod falla (ej. faltan coordenadas o nombre inválido) 3ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 400 si el servicio lanza BadRequestError por delegación inexistente 2ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 409 si el servicio lanza ConflictError por código duplicado 1ms
   ✓ Route Handlers /api/puntos-criticos (HU-57, HU-58) > POST /api/puntos-criticos (HU-58) > debe responder 201 Created si la creación es exitosa y retornar el punto creado 1ms
 Test Files  1 passed (1)
 Tests       7 passed | 5 skipped (12)
```

#### CP-H58-API-02, 03, 04, 07, 08, 14, 15 (Esquemas Zod y Lógica de Servicio)
```bash
npx vitest run src/modules/eventos-atp/__tests__/punto-critico.test.ts -t "Creación de Puntos Críticos"
```
**Salida exacta obtenida:**
```text
 ✓ src/modules/eventos-atp/__tests__/punto-critico.test.ts (10 tests) 24ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.1 Validación de CrearPuntoCriticoBodySchema > debe validar un payload de creación completo y válido 7ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.1 Validación de CrearPuntoCriticoBodySchema > debe aplicar prioridad MEDIA por defecto si no es especificada 1ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.1 Validación de CrearPuntoCriticoBodySchema > debe rechazar nombres con menos de 3 caracteres 1ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.1 Validación de CrearPuntoCriticoBodySchema > debe rechazar coordenadas de latitud o longitud fuera de rango 1ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.1 Validación de CrearPuntoCriticoBodySchema > debe admitir opciones sugeridas de TIPOS_RIESGO_PUNTO_CRITICO y opción Otro (VARCHAR) 1ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.2 Servicio crearPuntoCritico > Flujo Feliz: debe autogenerar código PC-VAL-001, insertar y emitir notificación Socket.io 6ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.2 Servicio crearPuntoCritico > Flujo Feliz con Delegación: debe consultar delegación y generar código con prefijo territorial 1ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.2 Servicio crearPuntoCritico > debe lanzar BadRequestError si la delegación territorial proporcionada no existe 2ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.2 Servicio crearPuntoCritico > debe rechazar con ForbiddenError si el usuario no tiene rol Administrador 1ms
   ✓ Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias > 5. Creación de Puntos Críticos (HU-58) > 5.2 Servicio crearPuntoCritico > debe rechazar con UnauthorizedError si no se provee usuario 1ms
 Test Files  1 passed (1)
 Tests       10 passed | 33 skipped (43)
```

---

### 5.3. Pruebas de Integración HTTP en Vivo (Comandos cURL)

#### Caso 1: Creación Exitosa de Punto Crítico (HTTP 201 Created — CP-H58-API-01)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "nombre": "Sector Costanera Puente Calle Calle",
    "descripcion": "Zona propensa a desborde fluvial durante pleamar y temporales",
    "tipoRiesgo": "Inundación y anegamiento",
    "prioridad": "MEDIA",
    "latitud": -39.8123,
    "longitud": -73.2289
  }'
```
**Respuesta Obtenida:**
```json
{
  "id": "40000000-0000-4000-8000-000000000099",
  "codigo": "PC-VAL-001",
  "nombre": "Sector Costanera Puente Calle Calle",
  "descripcion": "Zona propensa a desborde fluvial durante pleamar y temporales",
  "tipoRiesgo": "Inundación y anegamiento",
  "prioridad": "MEDIA",
  "activo": true,
  "estadoTexto": "Activo",
  "latitud": -39.8123,
  "longitud": -73.2289,
  "delegacion": null,
  "creadoEn": "2026-10-05T00:30:00.000Z",
  "creadoPorId": "00000000-0000-4000-8000-000000000001",
  "actualizadoEn": null,
  "actualizadoPorId": null
}
HTTP_STATUS: 201
```

#### Caso 2: Creación Exitosa con Delegación Territorial (HTTP 201 Created — CP-H58-API-02)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
    "descripcion": "Monitoreo por riesgo de remoción en ladera y anegamiento",
    "tipoRiesgo": "Desborde de cauce / humedal",
    "prioridad": "ALTA",
    "delegacionId": "30000000-0000-4000-8000-000000000002",
    "latitud": -39.8456,
    "longitud": -73.2389
  }'
```
**Respuesta Obtenida:**
```json
{
  "id": "40000000-0000-4000-8000-000000000088",
  "codigo": "PC-SUR-001",
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "descripcion": "Monitoreo por riesgo de remoción en ladera y anegamiento",
  "tipoRiesgo": "Desborde de cauce / humedal",
  "prioridad": "ALTA",
  "activo": true,
  "estadoTexto": "Activo",
  "latitud": -39.8456,
  "longitud": -73.2389,
  "delegacion": {
    "id": "30000000-0000-4000-8000-000000000002",
    "codigo": "DEL_SUR",
    "nombre": "Delegación Municipal Sur"
  },
  "creadoEn": "2026-10-05T00:35:00.000Z",
  "creadoPorId": "00000000-0000-4000-8000-000000000001",
  "actualizadoEn": null,
  "actualizadoPorId": null
}
HTTP_STATUS: 201
```

#### Caso 3: Fallo de Validación por Nombre Menor a 3 Caracteres (HTTP 400 Bad Request — CP-H58-API-05)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "nombre": "AB",
    "latitud": -39.8456,
    "longitud": -73.2389
  }'
```
**Respuesta Obtenida:**
```json
{
  "message": "Datos de creación de punto crítico inválidos.",
  "errors": [
    {
      "campo": "nombre",
      "mensaje": "El nombre debe tener al menos 3 caracteres."
    }
  ]
}
HTTP_STATUS: 400
```

#### Caso 4: Fallo de Validación por Coordenada Fuera de Rango (HTTP 400 Bad Request — CP-H58-API-07)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "nombre": "Sector Coordenada Anómala",
    "latitud": -95.5,
    "longitud": -73.2389
  }'
```
**Respuesta Obtenida:**
```json
{
  "message": "Datos de creación de punto crítico inválidos.",
  "errors": [
    {
      "campo": "latitud",
      "mensaje": "La latitud debe ser mayor o igual a -90."
    }
  ]
}
HTTP_STATUS: 400
```

#### Caso 5: Fallo por Delegación Inexistente (HTTP 400 Bad Request — CP-H58-API-11)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "nombre": "Sector Prueba Delegacion Erronea",
    "delegacionId": "30000000-0000-4000-8000-999999999999",
    "latitud": -39.8456,
    "longitud": -73.2389
  }'
```
**Respuesta Obtenida:**
```json
{
  "message": "La delegación territorial con ID '30000000-0000-4000-8000-999999999999' no existe en el sistema."
}
HTTP_STATUS: 400
```

#### Caso 6: Bloqueo de Acceso Anónimo sin Identificación (HTTP 401 Unauthorized — CP-H58-API-12)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Sector Intruso",
    "latitud": -39.8456,
    "longitud": -73.2389
  }'
```
**Respuesta Obtenida:**
```json
{
  "message": "Cabecera X-User-Id requerida para autenticación."
}
HTTP_STATUS: 401
```

#### Caso 7: Bloqueo de Acceso a Rol No Administrador (HTTP 403 Forbidden — CP-H58-API-13)
```bash
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost:3001/api/puntos-criticos \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000007" \
  -d '{
    "nombre": "Sector Sin Permisos",
    "latitud": -39.8456,
    "longitud": -73.2389
  }'
```
**Respuesta Obtenida:**
```json
{
  "message": "Acceso denegado. Se requiere el perfil de Administrador con permiso puntos_criticos:crear."
}
HTTP_STATUS: 403
```

---

## 6. Bloque TSV para Copiar y Pegar en Google Sheets

> **Instrucciones:** Selecciona y copia el bloque completo a continuación. En tu hoja de cálculo de Google Sheets, selecciona la celda **`A1`** y presiona `Ctrl + V`.

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H58-API-01	Fallo de validación Zod con strings vacíos y cadenas null en campos opcionales del formulario	Validación	Schema / Zod	Alta	Esquema CrearPuntoCriticoBodySchema activo	Payload con descripcion: "", tipoRiesgo: "", delegacionId: ""	Zod sanitiza y transforma valores a null sin arrojar error 400	Fallaba con 400 Bad Request por UUID o formato string inválido	CORREGIDO	05/10/2026 01:15	05/10/2026 03:40	fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico
BUG-H58-API-02	Rechazo de creación por capitalización o acentos en el campo prioridad del formulario	Validación	Schema / Zod	Media	Endpoint POST /api/puntos-criticos disponible	Payload con prioridad: "Alta" o prioridad: "Crítica"	Normalización tolerante asignando valor canónico ALTA o CRITICA	HTTP 400 indicando valor no reconocido en enum estricto	CORREGIDO	05/10/2026 01:45	05/10/2026 03:45	fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico
BUG-H58-API-03	Error 500 no capturado por violación de clave foránea al enviar delegacionId inexistente	Integración	DB / Service	Alta	Base de datos relacional PostgreSQL activa	Payload con delegacionId: "30000000-0000-4000-8000-999999999999"	HTTP 400 Bad Request: 'La delegación territorial con ID ... no existe en el sistema.'	Error 500 Internal Server Error no controlado por fallo FK	CORREGIDO	05/10/2026 02:10	05/10/2026 03:50	fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico
BUG-H58-API-04	Colisión de numeración correlativa en migraciones Kysely con rama develop (migración 015)	Integridad BD	Migración Kysely	Crítica	Rama sincronizada con develop concurrente	Verificación correlativa de archivos en src/lib/db/migrations/	Secuencia correlativa sin colisiones numéricas de archivos de migración	Dos archivos compartían el prefijo 015 provocando inconsistencia	CORREGIDO	05/10/2026 09:30	05/10/2026 11:00	merge: sincronizar con develop resolviendo colision en migracion 017 y preservando H55 y H56
BUG-H58-API-05	Desincronización de evento Socket.io y falta de broadcast hacia módulos cartográficos	Integración	Socket.io / Eventos	Alta	Servidor Socket.io activo en backend	Creación exitosa de punto crítico vía crearPuntoCritico	Emisión de punto_critico:creado hacia salas operativas y broadcast global	Evento socket desalineado no llegaba a salas operativas ni broadcast	CORREGIDO	05/10/2026 19:15	05/10/2026 20:35	merge: sincronizar con develop, resolver conflictos en socket y docs, y renumerar migración a 020
CP-H58-API-01	Creación exitosa de punto crítico sin delegación con autogeneración de código PC-VAL (CA-1, CA-2, CA-4, CA-5)	Funcional	API / Route	Crítica	Base de datos activa y usuario Administrador autenticado	POST /api/puntos-criticos con payload válido sin delegacionId y header admin	HTTP 201 Created con entidad creada, código autogenerado PC-VAL-001 y PostGIS	HTTP 201 Created con entidad completa y código autogenerado PC-VAL-001	APROBADO	05/10/2026 21:00	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-02	Creación exitosa de punto crítico con delegación asignada y código territorial PC-SUR (CA-1, CA-2, CA-5)	Funcional	API / Route	Alta	Delegación territorial registrada en tabla delegacion	POST /api/puntos-criticos con delegacionId de Delegación Sur y header admin	HTTP 201 Created con código institucional territorial PC-SUR-001 y objeto delegación	HTTP 201 Created con delegación vinculada y código territorial generado	APROBADO	05/10/2026 21:05	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-03	Asignación automática de prioridad MEDIA por defecto si no es provista en el payload (CA-3)	Lógica de Negocio	Schema / Service	Media	Payload con solo campos obligatorios (nombre, latitud, longitud)	POST /api/puntos-criticos omitiendo campo prioridad	HTTP 201 Created con atributo prioridad = "MEDIA" asignado automáticamente	HTTP 201 Created con prioridad MEDIA asignada por defecto	APROBADO	05/10/2026 21:10	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-04	Admisión de tipo de riesgo personalizado (VARCHAR) y opciones sugeridas de catálogo (CA-3)	Funcional	Schema / Zod	Media	Servidor API en ejecución	POST /api/puntos-criticos con tipoRiesgo: "Afloramiento de aguas subterráneas"	HTTP 201 Created persistiendo tipo de riesgo en VARCHAR(100)	HTTP 201 Created con tipo de riesgo personalizado registrado	APROBADO	05/10/2026 21:15	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-05	Rechazo con HTTP 400 Bad Request si el nombre contiene menos de 3 caracteres (CA-3, CA-4)	Validación	API / Schema	Alta	Endpoint POST invocado con payload inválido	POST /api/puntos-criticos con body {"nombre": "AB", "latitud": -39.8, "longitud": -73.2}	HTTP 400 Bad Request: 'El nombre debe tener al menos 3 caracteres.'	HTTP 400 con error Zod: 'El nombre debe tener al menos 3 caracteres.'	APROBADO	05/10/2026 21:20	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-06	Rechazo con HTTP 400 Bad Request si el nombre excede los 150 caracteres permitidos (CA-3, CA-4)	Validación	API / Schema	Media	Endpoint POST invocado con nombre excesivo	POST /api/puntos-criticos con nombre de 151 caracteres	HTTP 400 Bad Request: 'El nombre no puede exceder los 150 caracteres.'	HTTP 400 con error Zod indicando exceso de longitud de caracteres	APROBADO	05/10/2026 21:25	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-07	Rechazo con HTTP 400 Bad Request si la coordenada de latitud excede rango [-90, 90] (CA-2, CA-3)	Validación	API / Schema	Alta	Coordenada geográfica errónea enviada desde formulario	POST /api/puntos-criticos con latitud: -95.5 o latitud: 95.0	HTTP 400 Bad Request: 'La latitud debe ser mayor o igual a -90'	HTTP 400 con mensaje Zod de latitud fuera de rango	APROBADO	05/10/2026 21:30	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-08	Rechazo con HTTP 400 Bad Request si la coordenada de longitud excede rango [-180, 180] (CA-2, CA-3)	Validación	API / Schema	Alta	Coordenada geográfica anómala enviada desde formulario	POST /api/puntos-criticos con longitud: -190.0 o longitud: 185.0	HTTP 400 Bad Request: 'La longitud debe ser menor o igual a 180.'	HTTP 400 con mensaje Zod de longitud fuera de rango	APROBADO	05/10/2026 21:35	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-09	Rechazo con HTTP 400 Bad Request ante omisión de coordenadas geográficas en payload (CA-2, CA-3)	Validación	API / Schema	Alta	Payload sin campos de latitud y longitud	POST /api/puntos-criticos con body sin latitud ni longitud	HTTP 400 Bad Request indicando ausencia obligatoria de coordenadas	HTTP 400 con error Zod por campos numéricos requeridos no provistos	APROBADO	05/10/2026 21:40	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-10	Rechazo con HTTP 400 Bad Request ante cuerpo de solicitud con sintaxis JSON inválida (CA-4)	Robustez	API / Route	Media	Endpoint POST invocado con formato malformado	POST /api/puntos-criticos con body "invalid-json{" y header application/json	HTTP 400 Bad Request: 'El cuerpo de la solicitud no es un JSON válido.'	HTTP 400: 'El cuerpo de la solicitud no es un JSON válido.'	APROBADO	05/10/2026 21:45	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-11	Rechazo con HTTP 400 Bad Request cuando la delegación territorial UUID no existe en BD (CA-3, CA-4)	Validación	Service / DB	Alta	Delegación territorial inexistente en base de datos	POST /api/puntos-criticos con delegacionId no registrado en BD	HTTP 400 Bad Request: 'La delegación territorial con ID ... no existe en el sistema.'	HTTP 400 Bad Request informando inexistencia de la delegación	APROBADO	05/10/2026 21:50	-	fix(eventos-atp): normalizar valores de formulario y robustecer creacion de punto critico
CP-H58-API-12	Control RBAC rechazando solicitudes anónimas sin cabecera de autenticación HTTP 401 (CA-1, CA-6)	Seguridad (RBAC)	API / Auth	Crítica	Endpoint POST invocado sin credenciales	POST /api/puntos-criticos sin header x-user-id ni Authorization	HTTP 401 Unauthorized informando falta de autenticación	HTTP 401: 'Cabecera X-User-Id requerida para autenticación.'	APROBADO	05/10/2026 21:55	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-13	Control RBAC bloqueando usuarios sin rol Administrador con HTTP 403 Forbidden (CA-1, CA-6)	Seguridad (RBAC)	API / RBAC	Crítica	Usuario existente con rol no administrativo (Informante / Call Center)	POST /api/puntos-criticos con x-user-id de Informante	HTTP 403 Forbidden: 'Acceso denegado. Se requiere el perfil de Administrador...'	HTTP 403 Forbidden impidiendo creación de puntos críticos a no administradores	APROBADO	05/10/2026 22:00	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
CP-H58-API-14	Persistencia geoespacial PostGIS ST_SetSRID y registro estricto de auditoría creado_por_id (CA-2, CA-5)	Persistencia	DB / PostGIS	Crítica	Migración 020 aplicada con columna creado_por_id	Petición POST procesada exitosamente en el endpoint	Geometría PostGIS EPSG:4326 calculada y creado_por_id igual al UUID del admin	Punto espacial guardado con ST_MakePoint y auditoría asignada en BD	APROBADO	05/10/2026 22:10	-	feat(db): agregar migracion 015 con creado_por_id y permiso puntos_criticos:crear
CP-H58-API-15	Emisión reactiva de notificación WebSocket punto_critico:creado para módulo cartográfico (CA-5)	Tiempo Real	Socket.io	Crítica	Servidor Socket.io inicializado en backend	Petición POST completada exitosamente en el endpoint	Emisión de evento punto_critico:creado a salas operativas y broadcast global	Evento socket emitido con payload completo reflejando punto en mapa	APROBADO	05/10/2026 22:20	-	feat(eventos-atp): implementar creacion de puntos criticos con postgis y socket.io (HU-58)
```

---

## 7. Dictamen de Certificación Final de QA

El backend monolítico modular `sgrai-api` para la **Historia de Usuario HU-58 (Crear un Punto Crítico)** cumple satisfactoriamente con el 100% de los criterios de aceptación técnicos y funcionales, las normas del Sistema de Comando de Incidentes (ICS), la autogeneración atómica de códigos correlativos institucionales, la persistencia geoespacial con PostGIS (EPSG:4326) y el control de acceso basado en roles (RBAC).

Habiéndose cerrado y re-testeado exitosamente la totalidad de los 5 defectos detectados durante el ciclo de vida de la rama `feature/H58-creacion-punto-critico` antes de su integración a `develop`, el dictamen oficial de Aseguramiento de Calidad es:

🟢 **APROBADO PARA PRODUCCIÓN (100% PASS)**
