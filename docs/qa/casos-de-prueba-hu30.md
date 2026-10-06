# Plan y Matriz de Casos de Prueba — HU-30: Crear Evento Manual de Prevención

**Proyecto:** SGRAI (Sistema de Gestión de Recursos para Atención de Incidentes)  
**Módulo:** Eventos ATP (`sgrai-api`)  
**Historia de Usuario:** HU-30 — Generar eventos nuevos de prevención  
**Rol Responsable:** Quality Assurance (QA)  
**Rama evaluada:** `feature/H30-crear-evento-manual-prevencion`  
**Versión API:** `0.9.0`  
**Resultado Global:** **🟢 CERTIFICADO EN RE-TEST (PASS - 100%)**

---

## 1. Objetivos del Plan de Pruebas de QA

1. **Asegurar la Calidad del Software:** Verificar que las reglas de negocio del Sistema de Comando de Incidentes (ICS) y la excepción operativa de prevención territorial sin incidente formal previo se cumplan rigurosamente.
2. **Validar la Transaccionalidad Atómica:** Comprobar que la creación del evento de prevención, la generación de la misión táctica, la asignación de recursos y la transición de estado de la patrulla se ejecuten de manera indivisible bajo Kysely.
3. **Validar la Seguridad y RBAC:** Verificar la exigencia del permiso `prevencion:eventos:crear` para los roles autorizados (`ENCARGADO` y `ADMIN`) y el bloqueo efectivo de perfiles no autorizados (`403 Forbidden`) y peticiones anónimas (`401 Unauthorized`).
4. **Validar la Difusión en Tiempo Real:** Constatar la correcta emisión del evento Socket.io `prevencion:creada` hacia los canales del Encargado, mapa interactivo y la sala exclusiva de la patrulla asignada.
5. **Cumplir los Criterios de Calidad del Proyecto:**
   - 0 errores de ESLint (`npm run lint`).
   - 0 errores de compilación estática TypeScript (`npx tsc --noEmit`).
   - 100% de pruebas unitarias y de integración aprobadas (`npm test` — 408 tests).
   - Contrato OpenAPI 3.0 actualizado y expuesto en `/openapi.json`.
   - Sincronización limpia sin conflictos con `origin/develop`.

---

## 2. Entorno y Precondiciones de Prueba

- **Motor de Base de Datos:** PostgreSQL 16 + PostGIS 3.4 (`api-postgres-1` en puerto 5432).
- **Caché y Mensajería:** Redis 7 (`api-redis-1` en puerto 6379).
- **Backend API:** Node.js v20+ / Next.js 16 con servidor Socket.io en puerto 3001.
- **Autenticación:** Cabecera `Authorization: Bearer <token_jwt>` con usuarios sembrados de Encargado y Administrador.

---

## 3. Matriz de Casos de Prueba (Test Cases)

| ID | Endpoint / Operación | Tipo de Prueba | Descripción / Objetivo | Precondición | Entrada (Payload / Headers) | Resultado Esperado | Estado Inicial | Re-Test | Estado Final |
|---|---|---|---|---|---|---|:---:|:---:|:---:|
| **CP-01** | `POST /api/eventos-atp/prevencion` | Funcional Positiva (Happy Path) | Crear evento de prevención designando un punto crítico existente y asignando una patrulla disponible. | Patrulla en estado `DISPONIBLE` y punto crítico existente. | Token Encargado, JSON con `nombre`, `descripcion`, `delegacionId`, `puntoCriticoId`, coordenadas y `patrullaId`. | HTTP 201 Created. Evento creado con código `PREV-2026-XXXX`, misión `MIS-2026-XXXX` despachada, patrulla transiciona a `EN_PREVENCION`. | PASS | - | **APROBADO** |
| **CP-02** | `POST /api/eventos-atp/prevencion` | Funcional Positiva (Coordenadas Libres) | Crear evento preventivo ingresando coordenadas libres georreferenciadas sin vincular un punto crítico formal. | Patrulla en estado `DISPONIBLE`. | Token Encargado, JSON con `puntoCriticoId: null`, coordenadas válidas WGS84, `delegacionId` y `patrullaId`. | HTTP 201 Created. Registro con geometría PostGIS calculada vía `ST_SetSRID(ST_MakePoint)`. | PASS | - | **APROBADO** |
| **CP-03** | `POST /api/eventos-atp/prevencion` | Transaccional / Recursos | Asignar insumos y herramientas del inventario logístico al evento de prevención. | Recursos activos con stock disponible suficiente. | JSON incluyendo arreglo `recursos: [{ recursoId, cantidad: 5 }]`. | HTTP 201 Created. Recursos insertados en `evento_prevencion_recurso` y stock descontado del inventario. | PASS | - | **APROBADO** |
| **CP-04** | `POST /api/eventos-atp/prevencion` | Negativa / Validación | Rechazar solicitud con descripción menor a 5 caracteres o nombre menor a 3 caracteres. | API en ejecución. | Body con `descripcion: "abc"` o `nombre: "ab"`. | HTTP 400 Bad Request. Mensaje de error de validación descriptivo originado en Zod sin tocar la BD. | PASS | - | **APROBADO** |
| **CP-05** | `POST /api/eventos-atp/prevencion` | Negativa / Validación Espacial | Rechazar solicitud con coordenadas fuera del rango WGS84 (-90 a 90 / -180 a 180). | API en ejecución. | Body con `latitud: -120` o `longitud: 200`. | HTTP 400 Bad Request. Error de validación en esquema Zod. | PASS | - | **APROBADO** |
| **CP-06** | `POST /api/eventos-atp/prevencion` | Seguridad / Autenticación | Denegar creación si el token JWT no es proporcionado o se encuentra expirado. | Ninguna. | Petición POST sin cabecera `Authorization`. | HTTP 401 Unauthorized. JSON con mensaje descriptivo de falta de autenticación. | PASS | - | **APROBADO** |
| **CP-07** | `POST /api/eventos-atp/prevencion` | Seguridad / Autorización RBAC | Denegar creación si el usuario autenticado carece del permiso `prevencion:eventos:crear` (ej. Call Center). | Token válido de Operador Call Center. | Petición POST con token de Call Center. | HTTP 403 Forbidden. JSON `{ message: "Acceso denegado. Se requiere el permiso 'prevencion:eventos:crear'." }`. | PASS | - | **APROBADO** |
| **CP-08** | `POST /api/eventos-atp/prevencion` | Negativa / Integridad | Rechazar si la patrulla verificadora o delegación indicada no existen en el sistema. | Ninguna. | `patrullaId: "00000000-0000-0000-0000-000000000000"` (UUID inexistente). | HTTP 404 Not Found. JSON `{ message: "La patrulla verificadora indicada no fue encontrada." }`. | PASS | - | **APROBADO** |
| **CP-09** | `POST /api/eventos-atp/prevencion` | Concurrencia / Disponibilidad | Prevenir asignación concurrente o despacho sobre patrullas no disponibles (estado `EN_VERIFICACION` o `NO_DISPONIBLE`). | Patrulla en estado distinto a `DISPONIBLE`. | Solicitud POST seleccionando patrulla ocupada. | HTTP 409 Conflict. Mensaje explicativo indicando el estado actual de la patrulla. | PASS | - | **APROBADO** |
| **CP-10** | `POST /api/eventos-atp/prevencion` | Lógica de Inventario / Stock | Rechazar la solicitud si la cantidad solicitada de un recurso supera el stock disponible en bodega. | Recurso con stock inferior a lo solicitado. | `recursos: [{ recursoId, cantidad: 9999 }]`. | HTTP 409 Conflict. JSON `{ message: "Stock insuficiente para el recurso..." }`. Rollback completo de la transacción. | PASS | - | **APROBADO** |
| **CP-11** | WebSocket `prevencion:creada` | Tiempo Real / Socket.io | Verificar la emisión del evento `prevencion:creada` a las salas `sala:encargados`, `mapa` y `patrulla:<patrullaId>`. | Servidor Socket.io / Redis activo. | Creación exitosa de evento de prevención. | Las salas suscritas reciben el payload estructurado con los detalles del evento y coordenadas para renderizado en mapa. | PASS | - | **APROBADO** |
| **CP-12** | `GET /openapi.json` | Contrato de API | Validar que la ruta `POST /api/eventos-atp/prevencion` se encuentre registrada con esquemas Zod en OpenAPI 3.0. | API en ejecución. | `GET /openapi.json` | HTTP 200 OK. La especificación incluye la ruta, tags, esquemas de entrada y todas las respuestas (201, 400, 401, 403, 404, 409, 500). | PASS | - | **APROBADO** |
| **CP-20** | Compilación TypeScript | Calidad / Tipado | Compilación estática de tipos TypeScript sin errores (`npx tsc --noEmit`). | Código de la rama. | `npx tsc --noEmit` | Cero errores de compilación estricta. | FAIL (TS2769) | 05/10/2026 10:55 | **CORREGIDO** |
| **CP-21** | Migraciones Kysely | BD / Control de Cambios | Unicidad del historial de migraciones sin colisiones numéricas con `develop`. | Directorio `src/lib/db/migrations/`. | Comparación de archivos contra `origin/develop`. | Migración de eventos preventivos con correlativo único `017`. | FAIL (Colisión 015) | 05/10/2026 10:55 | **CORREGIDO** |
| **CP-22** | Integración Git | Control de Versiones | Compatibilidad de fusión limpia y actualización con `origin/develop`. | Rama `origin/develop`. | Fusión / sincronización Git. | Fusión limpia sin conflictos residuales y paso de CI. | FAIL (Conflictos) | 05/10/2026 10:56 | **CORREGIDO** |

---

## 4. Evidencias de Ejecución Automatizada

### 4.1. Verificación Estática de Tipos (TypeScript)
```bash
npx tsc --noEmit
```
**Resultado:**
- `Found 0 errors`. Compilación exitosa en 100% de archivos y módulos.

### 4.2. Pruebas Unitarias y de Integración (Vitest)
```bash
npm test
```
**Resultado:**
- 34 archivos de prueba ejecutados.
- 408 pruebas aprobadas (`408 passed (408)`).
- 0 fallos (`0 failed`).
- Cobertura completa en módulos de Eventos ATP, Incidentes, Seguridad, Misiones y Recursos.

### 4.3. Validación de Linter
```bash
npm run lint
```
**Resultado:**
- 0 errores (`0 errors`).
