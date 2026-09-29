# Plan y Matriz de Casos de Prueba — HU-52: Recepción y Verificación de Avisos por Call Center

**Proyecto:** SGRAI (Sistema de Gestión de Recursos para Atención de Incidentes)  
**Módulo:** Incidentes (`sgrai-api`)  
**Historia de Usuario:** HU-52 — Recepción y verificación de avisos por operador de Call Center  
**Rol Responsable:** Quality Assurance (QA)  
**Rama evaluada:** `feature/H52-recepcion-avisos`  
**Versión:** `0.2.0`  
**Fecha de Ejecución:** Septiembre 2026  
**Resultado Global:** **APROBADO (PASS - 100%)**

---

## 1. Objetivos del Plan de Pruebas de QA

1. **Asegurar la Calidad del Software:** Verificar que las reglas de negocio del Sistema de Comando de Incidentes (ICS) descritas en la arquitectura monolítica modular (`GEMINI.md`) se cumplan sin desvíos.
2. **Prevenir Regresiones y Conflictos:** Garantizar que las modificaciones y armonizaciones con otras ramas (H1 Chatbot e H6 Recursos) no hayan roto contratos de API ni la integridad de datos.
3. **Validar la Transaccionalidad Atómica:** Comprobar la exclusión mutua pesimista (`FOR UPDATE`) ante operadores concurrentes en la verificación de avisos.
4. **Cumplir los Criterios de Calidad del Proyecto:**
   - 0 errores de ESLint (`npm run lint`).
   - 100% de pruebas unitarias aprobadas (`npm test`).
   - Build de producción limpio con Next.js Turbopack (`npm run build`).
   - Contrato OpenAPI 3.0 actualizado y expuesto en `/openapi.json`.

---

## 2. Entorno y Precondiciones de Prueba

- **Motor de Base de Datos:** PostgreSQL 16 + PostGIS 3.4 en contenedor Docker (`api-postgres-1` en puerto 5432).
- **Caché y Mensajería:** Redis 7 en contenedor Docker (`api-redis-1` en puerto 6379).
- **Backend API:** Node.js v20+ / Next.js 16 con servidor Socket.io en puerto 3001.
- **Auditoría:** Cabecera `X-User-Id` con UUID de operador válido (`a0000000-0000-0000-0000-000000000001`).

---

## 3. Matriz de Casos de Prueba (Test Cases)

| ID | Módulo / Endpoint | Tipo de Prueba | Descripción / Objetivo | Precondición | Entrada (Payload / Headers / Query) | Resultado Esperado | Estado |
|---|---|---|---|---|---|---|:---:|
| **CP-01** | `GET /api/incidentes/avisos` | Funcional Positiva | Listar avisos en estado pendiente ordenados por mayor tiempo de espera (`creado_en ASC`) calculando `minutosEnEspera`. | Base de datos con avisos registrados. | `GET /api/incidentes/avisos?estado=PENDIENTE_VERIFICACION` | HTTP 200. Lista ordenada ascendentemente por fecha de creación. Cada item incluye `minutosEnEspera >= 0`. | **PASS** |
| **CP-02** | `GET /api/incidentes/avisos` | Funcional / Paginación | Paginación correcta con límites y páginas solicitadas. | Existen más de 2 avisos en BD. | `GET /api/incidentes/avisos?page=1&limit=2` | HTTP 200. Retorna máximo 2 registros y objeto `pagination: { page: 1, limit: 2, total, totalPages }`. | **PASS** |
| **CP-03** | `POST /api/incidentes/avisos` | Funcional Positiva | Registrar un nuevo aviso preliminar de informante (Happy Path). | Servicios PostgreSQL y Redis activos. | JSON con `tipoAfectacion`, `direccionTexto`, `latitud`, `longitud`, `descripcion`, `datosInformante`. | HTTP 201. Objeto `data` con UUID generado, `codigoSeguimiento`, estado `PENDIENTE_VERIFICACION`. Emisión Socket `aviso:nuevo`. | **PASS** |
| **CP-04** | `POST /api/incidentes/avisos` | Negativa / Validación | Rechazar solicitud con coordenadas fuera del rango geográfico válido (-90 a 90 / -180 a 180). | API en ejecución. | Body con `latitud: 95.5` o `descripcion < 5 caracteres`. | HTTP 400 Bad Request. Mensaje de error descriptivo originado en esquema Zod sin tocar la BD. | **PASS** |
| **CP-05** | `GET /api/incidentes/avisos/:id` | Funcional Positiva | Consultar detalle completo de un aviso por su UUID, incluyendo informante y adjuntos. | Aviso existente en BD. | `GET /api/incidentes/avisos/{idValido}` | HTTP 200. Retorna detalle con `datosInformante` normalizado y arreglo `adjuntos: []`. | **PASS** |
| **CP-06** | `GET /api/incidentes/avisos/:id` | Negativa / Excepción | Consultar un aviso inexistente o con UUID no registrado. | Ninguna. | `GET /api/incidentes/avisos/00000000-0000-0000-0000-000000000000` | HTTP 404 Not Found. JSON `{ error: "Aviso de incidente no encontrado" }`. | **PASS** |
| **CP-07** | `POST /api/incidentes/avisos/:id/verificar` | Transaccional Positiva | **"Verificar y Enviar"**: Transacción atómica que crea registro formal en `incidente` y actualiza aviso a `VERIFICADO`. | Aviso en estado `PENDIENTE_VERIFICACION`. | Cabecera `X-User-Id: <UUID>`, Body: `{ tipoIncidenteId, descripcion, requiereAsistenciaSocial: false }`. | HTTP 201 Created. Generación de folio `INC-2026-XXXX`, estado inicial `'Reportado'`, aviso actualizado a `VERIFICADO` con `incidenteId` asociado. Socket `aviso:verificado` e `incidente:creado`. | **PASS** |
| **CP-08** | `POST /api/incidentes/avisos/:id/verificar` | Seguridad / Auditoría | Denegar verificación si falta la cabecera obligatoria de auditoría `X-User-Id`. | Aviso existente. | Solicitud POST sin cabecera `X-User-Id`. | HTTP 401 Unauthorized. JSON `{ error: "Cabecera X-User-Id requerida" }`. No se genera incidente. | **PASS** |
| **CP-09** | `POST /api/incidentes/avisos/:id/verificar` | Concurrencia / Idempotencia | Prevenir condición de carrera: reintentar verificar un aviso ya procesado o por dos operadores simultáneos. | Aviso ya verificado o descartado. | Solicitud POST sobre aviso con `estado != PENDIENTE_VERIFICACION`. | HTTP 409 Conflict. Exclusión mutua `FOR UPDATE` detecta estado y rechaza sin crear registros duplicados. | **PASS** |
| **CP-10** | `POST /api/incidentes/avisos/:id/descartar` | Funcional Positiva | Descartar aviso por información falsa o broma con justificación obligatoria. | Aviso en estado `PENDIENTE_VERIFICACION`. | Cabecera `X-User-Id: <UUID>`, Body: `{ motivoDescarte: "Información falsa comprobada por operador" }`. | HTTP 200 OK. Aviso transiciona a `DESCARTADO`, se persiste `operadorId` y `motivoDescarte`. Emisión Socket `aviso:descartado`. | **PASS** |
| **CP-11** | `POST /api/incidentes/avisos/:id/descartar` | Negativa / Validación | Rechazar descarte con justificación menor a 5 caracteres o vacía. | Aviso existente. | Body: `{ motivoDescarte: "no" }`. | HTTP 400 Bad Request. Validación Zod exige al menos 5 caracteres descriptivos. | **PASS** |
| **CP-12** | `POST /api/incidentes/avisos/:id/descartar` | Seguridad / Auditoría | Denegar descarte si falta la cabecera `X-User-Id`. | Aviso existente. | Solicitud POST sin `X-User-Id`. | HTTP 401 Unauthorized. | **PASS** |
| **CP-13** | `GET /api/incidentes/tipos` | Integración / Catálogo | Consultar catálogo oficial de tipos de incidente activos ordenados alfabéticamente. | Tabla `tipo_incidente` poblada con semillas de Valdivia. | `GET /api/incidentes/tipos` | HTTP 200 OK. Retorna arreglo con `Inundación`, `Caída de árbol`, `Deslizamiento`, etc. | **PASS** |
| **CP-14** | `GET /openapi.json` | Contrato de API | Validar generación automática del esquema OpenAPI 3.0 desde esquemas Zod. | Servicio en ejecución. | `GET /openapi.json` | HTTP 200 OK. JSON OpenAPI 3.0 válido con todas las rutas de avisos y esquemas de entrada/salida tipados. | **PASS** |

---

## 4. Evidencias de Ejecución Automatizada

### 4.1. Análisis Estático de Código (Linter)
```bash
$ npm run lint
✓ No issues found. 0 errors, 0 warnings.
```

### 4.2. Pruebas Unitarias de Dominio (Vitest)
```bash
$ npm test
 ✓ src/modules/incidentes/__tests__/incidentes.test.ts (13 tests)
   ✓ Módulo de Incidentes — Pruebas de Esquemas Zod (6)
   ✓ Módulo de Incidentes — Lógica de Negocio y Servicio (6)
   ✓ Módulo de Incidentes — Especificación OpenAPI (1)

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### 4.3. Compilación de Producción (Next.js Standalone Build)
```bash
$ npm run build
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 2.4s
  Finished TypeScript in 5.0s
Route (app)
├ ƒ /api/health
├ ƒ /api/incidentes/avisos
├ ƒ /api/incidentes/avisos/[id]
├ ƒ /api/incidentes/avisos/[id]/descartar
├ ƒ /api/incidentes/avisos/[id]/verificar
├ ƒ /api/incidentes/tipos
└ ƒ /openapi.json
```

---

## 5. Dictamen Final de QA

> **Dictamen:** **APROBADO PARA PULL REQUEST (PR READY)**  
> La rama `feature/H52-recepcion-avisos` cumple con todos los criterios de aceptación, integridad referencial, estándares de codificación institucional y requerimientos de auditoría del SGRAI.
