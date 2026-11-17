# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-37 — Categorizar o Reclasificar Tipología del Incidente en Terreno (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Incidentes / Operaciones de Terreno y Bitácora (`sgrai-api` — `GET /api/incidentes/tipos`, `PATCH /api/incidentes/[id]/tipologia`, `GET /api/incidentes`, `GET /api/incidentes/[id]`, `GET /api/misiones/[id]`).  
> **Historia de Usuario:** HU-37 — *"Como Patrulla verificadora Quiero categorizar o corregir la tipología del incidente tras la evaluación presencial en terreno. Para asegurar un registro técnico fidedigno de la naturaleza real de la emergencia, corrigiendo clasificaciones inexactas hechas por informantes ciudadanos."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h37-patrulla-categorizar-incidente`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `test(seguridad): actualizar asercion de version openapi a 0.10.0`  
> * `feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)`  
> * `chore(incidentes): formatear archivos del modulo de tipologia`  
> * `fix(misiones): transicionar incidente a VERIFICANDO y emitir evento socket al aceptar mision y reclasificar tipologia`  
> * `feat(incidentes): computar tieneMisionDespachada para incidentes en reporte (H69)`  
> * `fix(incidentes): sincronizar incidentes con misiones en curso a estado verificando y agregar flag tieneMisionEnCurso`  
> * `feat(seguridad): resolver asignacion de patrulla y cuadrilla en usuario-activo para operadores de terreno`  
> * `fix(tipado): corregir subconsulta en kanban repository y resolucion de unidad en seguridad repository`  
> * `feat(misiones): consultar hitos reales en detalle de mision y registrar reclasificacion en bitacora (HU-37)`  
> * `merge: integrar develop en feature/h37-patrulla-categorizar-incidente resolviendo conflictos y renumerando migraciones`  
> * `fix(incidentes): persistir estado verificado y reclasificado en consulta kanban`  
> * `fix(incidentes): persistir campos de verificacion en detalle y proteger paginacion con valores por defecto`  
> * `fix(test): alinear mocks de detalle incidente con esquema verificado y justificacionReclasificacion`  
>  
> **Fecha de Auditoría:** 17/11/2026 00:25.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense del código fuente, auditoría de autenticación y control de acceso RBAC, revisión de transacciones ACID e invariantes del Sistema de Comando de Incidentes (ICS) en Kysely/PostgreSQL, análisis de sincronización de migraciones respecto a `develop`, verificación de difusión en tiempo real vía Socket.io/Redis, revisión del contrato OpenAPI 3.0 y pruebas funcionales y negativas sobre servidor activo (`PORT=3099`) y suite Vitest sobre la rama `feature/h37-patrulla-categorizar-incidente`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** al detectarse **5 defectos reales** (**2 de severidad CRÍTICA**, **2 de severidad ALTA** y **1 de severidad MEDIA**).

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H37-API-01` a `05`) + 20 Casos Funcionales, RBAC, Validación Zod, Bitácora y Contrato (`CP-H37-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Catálogo `?catalogo=true`/`?detallado=true`, validaciones Zod de UUID/JSON/justificación, rechazo `400` para tipo inactivo, `401` sin credenciales, `403` por rol o patrulla ajena con `patrulla_id` presente, `409` en misión `DESPACHADA`, persistencia de `tipo_incidente_id`/`tipo_afectacion` e inserción en `mision_hito` |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Entorno integrado operativo (PostgreSQL 16 + PostGIS en puerto `5001`, Redis 7 en puerto `6001`) |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere el 100.0% (0 defectos abiertos) en ciclo de Re-Test para autorizar el merge a `develop` |
| **Suite Automatizada Focalizada HU-37 (Vitest)** | 🟢 **36/36 tests pass (con mocks)** | 8 archivos: `tipos/route.test.ts` (2), `tipologia/route.test.ts` (8), `tipologia.service.test.ts` (3), `tipologia.repository.test.ts` (6), `incidente-kanban.service.test.ts` (5), `incidentes/[id]/route.test.ts` (5), `mision.service.test.ts` (6), `openapi.json/route.test.ts` (1) |
| **Suite Completa del Repositorio (Vitest)** | 🟢 **813/813 tests pass** | 69 archivos de prueba ejecutados (`npm test`) |
| **Análisis Estático ESLint (`npm run lint`)** | 🟡 **0 errores / 2 warnings** | Warnings `@typescript-eslint/no-unused-vars`: `BadRequestError` en `tipologia/__tests__/route.test.ts:13` y `hitos` en `mision.service.ts:65` |
| **Compilación y Tipado (`npm run build` / `tsc --noEmit`)** | 🟢 **Compilación exitosa** | Requiere depuración previa de caché `.next` obsoleta |
| **Secuencia de Migraciones Kysely (`npm run db:migrate`)** | 🔴 **Fallo crítico (Exit code 1)** | Rama 35 commits detrás de `develop`; colisión `052_` vs `035_`, faltan `042_` y `061_`, y aborto por `corrupted migrations` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H37-API-01`: Bypass de Autenticación JWT mediante Cabecera Plana `x-user-id` en `PATCH /api/incidentes/[id]/tipologia` y Exposición en Contrato OpenAPI
* **Severidad:** **CRÍTICA** (Brecha de Seguridad / Suplantación de Identidad Administrativa y Evasión de Autorización Horizontal).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/app/api/incidentes/[id]/tipologia/route.ts` (Líneas 41-48)
  * `src/lib/openapi/index.ts` (Líneas 962-967)
* **Descripción Técnica del Defecto:**
  1. En `PATCH /api/incidentes/[id]/tipologia` (`src/app/api/incidentes/[id]/tipologia/route.ts:41-44`), el controlador realiza un fallback hacia la cabecera plana no verificada `x-user-id`:
     ```typescript
     const tokenUserId = await extraerUsuarioId(request);
     const headerUserId = request.headers.get("x-user-id");
     const usuarioId = tokenUserId || headerUserId;
     ```
     Cualquier cliente no autenticado puede omitir `Authorization: Bearer <token>` y enviar únicamente `-H "x-user-id: 00000000-0000-4000-8000-000000000001"` (UUID del Administrador). Al resolver dicho usuario, `verificarPermiso` otorga acceso y el controlador fija `esAdmin = true`, permitiendo al atacante suplantar al Administrador y reclasificar cualquier incidente del sistema sin verificar pertenencia a ninguna patrulla.
  2. En `src/lib/openapi/index.ts:964-967`, el contrato OpenAPI del endpoint declara `authorization` como opcional y expone la cabecera `x-user-id` (`"ID de usuario para entornos de prueba"`), contraviniendo la política estricta `BearerAuth` aplicada en `develop`.
* **Pasos para Reproducir:**
  1. Enviar `PATCH http://localhost:3099/api/incidentes/{incidenteId}/tipologia` omitiendo la cabecera `Authorization`.
  2. Incluir únicamente `-H "x-user-id: 00000000-0000-4000-8000-000000000001"` y un cuerpo JSON válido (`tipoIncidenteId` y `justificacion`).
* **Comportamiento Actual:** El servidor acepta la petición sin firma JWT, autentica como `Administrador` (`registradoPorId: "00000000-0000-4000-8000-000000000001"`) y ejecuta la reclasificación retornando `HTTP 200 OK`.
* **Comportamiento Esperado:** El endpoint debe rechazar toda petición sin un token JWT Bearer válido con `HTTP 401 Unauthorized`, ignorando por completo la cabecera `x-user-id` tanto en runtime como en la especificación OpenAPI.
* **Sugerencia Técnica de Solución:**
  * En `src/app/api/incidentes/[id]/tipologia/route.ts`, reemplazar las líneas 41-48 por `const usuarioId = await exigirUsuarioId(request);` (o `verificarTerrenoMisiones(request)` tras sincronizar con `develop`) seguido de `verificarPermiso(usuarioId, PERMISO_VERIFICAR_MISION_TERRENO)`.
  * En `src/lib/openapi/index.ts`, remover `x-user-id` de los parámetros de `/api/incidentes/{id}/tipologia` y exigir `authorization` en `bearerAuth`.

---

### `BUG-H37-API-02`: Bypass de Pertenencia de Patrulla con `patrulla_id = NULL`, Omisión de Filtro `tipo_mision = 'VERIFICACION'`, Falta de Validación de Estado ICS/Patrulla Activa y Ausencia de Bloqueo Pesimista (`forUpdate()`)
* **Severidad:** **CRÍTICA** (Control de Acceso Horizontal entre Unidades, Corrupción de Ciclo de Vida ICS y Condición de Carrera TOCTOU).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/incidentes/tipologia.repository.ts` (Líneas 98-186).
* **Descripción Técnica del Defecto:**
  En `TipologiaRepository.reclasificarTipologia`:
  1. **Omisión de filtro `tipo_mision = 'VERIFICACION'` y bypass cuando `patrulla_id` es `NULL` (líneas 110-172):** La consulta sobre `mision` no restringe `mision.tipo_mision = 'VERIFICACION'` ni ordena los resultados. Cuando un incidente tiene una misión de cuadrilla `ATENCION_CUADRILLA` en estado `EN_CURSO` (cuya columna `patrulla_id` es `NULL`, como `MIS-2026-0002` del incidente `INC-2026-0004` en estado `EN_ATENCION`), `misionEnCurso` selecciona dicha misión de cuadrilla. Posteriormente, la condición `if (!esAdmin && misionSeleccionada.patrulla_id)` (línea 155) evalúa a `false`, omitiendo toda verificación de pertenencia y permitiendo que cualquier patrullero no asignado modifique el incidente e inserte el hito `'TIPOLOGIA_RECLASIFICADA'` dentro de la misión de la cuadrilla.
  2. **Ausencia de validación de estado canónico del incidente (líneas 99-107 y 175-185):** El repositorio lee `incidente.estado` pero nunca valida que el incidente se encuentre en evaluación (`VERIFICANDO` o `REPORTADO`). En consecuencia, permite reclasificar incidentes en estado cerrado (`RESUELTO`, `NO_ABORDABLE`) o ya transferidos a cuadrilla (`EN_ATENCION`).
  3. **Ausencia de validación de patrulla activa (líneas 112-120):** No verifica `patrulla_verificadora.activo = true` ni `patrulla_verificadora.eliminado_en IS NULL`, permitiendo operar con patrullas dadas de baja lógica.
  4. **Ausencia de bloqueo pesimista `.forUpdate()`:** Las lecturas iniciales de `incidente` y `mision` carecen de `.forUpdate()`, dejando abierta una condición de carrera frente a `POST /api/misiones` (despacho de cuadrilla que cierra la misión de verificación y pasa el incidente a `EN_ATENCION`).
* **Pasos para Reproducir:**
  1. Autenticarse como `pedro.patrulla@valdivia.cl` (`PATRULLA_VERIFICADORA`) e invocar `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/tipologia` (`INC-2026-0004`, en estado `EN_ATENCION` con misión `MIS-2026-0002` de tipo `ATENCION_CUADRILLA`).
  2. Invocar `PATCH /api/incidentes/{id}/tipologia` sobre un incidente en estado `RESUELTO` con una misión `EN_CURSO`, o usando una patrulla con `activo = false` y `eliminado_en IS NOT NULL`.
* **Comportamiento Actual:** Todas las invocaciones anteriores retornan `HTTP 200 OK`, alterando `incidente.tipo_incidente_id`/`tipo_afectacion` e insertando hitos sobre misiones de cuadrilla o incidentes resueltos.
* **Comportamiento Esperado:**
  1. Filtrar estrictamente `mision.tipo_mision = 'VERIFICACION'` (ordenando por `creado_en DESC`) y exigir `misionSeleccionada.patrulla_id !== null`; en caso contrario lanzar `ConflictError`.
  2. Rechazar con `409 Conflict` si `incidente.estado` es `'EN_ATENCION'`, `'RESUELTO'` o `'NO_ABORDABLE'`.
  3. Validar que la patrulla verificadora asignada esté activa (`activo = true` y `eliminado_en IS NULL`), rechazando con `403`/`409` en caso contrario.
  4. Aplicar `.forUpdate()` sobre `incidente` y `mision` dentro de la transacción.
* **Sugerencia Técnica de Solución:**
  En `src/modules/incidentes/tipologia.repository.ts`, bloquear la fila del incidente con `.forUpdate()`, validar `if (!["REPORTADO", "VERIFICANDO"].includes(incidenteExistente.estado)) throw new ConflictError(...)`, filtrar `.where("mision.tipo_mision", "=", "VERIFICACION").orderBy("mision.creado_en", "desc").forUpdate()` (en `mision`), verificar `if (!misionSeleccionada.patrulla_id)` lanzando `ConflictError`, comprobar `patrulla_activo === true && patrulla_eliminado_en === null`, y mantener incondicionalmente la validación en `patrulla_personal` cuando `!esAdmin`.

---

### `BUG-H37-API-03`: Corrupción Semántica de `verificado` y `reclasificadoEnTerreno` en Tablero Kanban (Contradicción con `VERIFICACION_EN_CURSO` de HU-21) y Mutación de BD en Consulta `GET`
* **Severidad:** **ALTA** (Inconsistencia Funcional entre Tablero Kanban y Despacho de Cuadrillas HU-21, y Violación de Semántica HTTP `GET`).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/incidentes/incidente-kanban.repository.ts` (Líneas 36-54 y 189-240)
  * `src/modules/incidentes/incidente-kanban.service.ts` (Líneas 41-43, 82-85 y 164-166)
* **Descripción Técnica del Defecto:**
  1. **Falso positivo `verificado: true` en incidente sin evaluación finalizada:** Tanto `listarIncidentesPaginadosRepo` (líneas 189-203, 232-239) como `obtenerDetalleIncidenteService` (líneas 82-85) asignan `verificado: true` cuando existe el hito `'TIPOLOGIA_RECLASIFICADA'` aunque la misión de verificación siga en `'EN_CURSO'` y no exista `reporte_terreno` ni hito de cierre de evaluación. Esto provoca que el Encargado vea el incidente como verificado en `GET /api/incidentes` y `GET /api/incidentes/{id}`, pero al intentar despachar una cuadrilla mediante `POST /api/misiones` (HU-21), `asignarCuadrillaIncidenteRepo` bloquea el despacho con **`HTTP 409 Conflict (codigo: "VERIFICACION_EN_CURSO")`**.
  2. **Falso positivo `reclasificadoEnTerreno: true` cuando no hubo reclasificación:** `listarIncidentesPaginadosRepo` (líneas 205-219) y `incidente-kanban.service.ts` (líneas 42 y 165) calculan `reclasificadoEnTerreno` con `mision.estado = 'COMPLETADA' OR mision_hito.hito = 'TIPOLOGIA_RECLASIFICADA'` (`Boolean(fila.verificado || fila.reclasificado_en_terreno)` / `esVerificado`). Como resultado, cualquier incidente cuya verificación culminó sin reclasificación tipológica retorna erróneamente `reclasificadoEnTerreno: true` con `justificacionReclasificacion: null`.
  3. **Efecto secundario de escritura en petición `GET` (`incidente-kanban.repository.ts:36-54`):** Cada llamada a `GET /api/incidentes` ejecuta un `UPDATE incidente SET estado = 'VERIFICANDO', actualizado_en = CURRENT_TIMESTAMP`, mutando el estado de la base de datos y su marca de tiempo en una operación de lectura sin emitir eventos WebSocket.
* **Pasos para Reproducir:**
  1. Reclasificar un incidente en estado `VERIFICANDO` con misión de verificación `EN_CURSO` mediante `PATCH /api/incidentes/{id}/tipologia`.
  2. Consultar `GET /api/incidentes` y `GET /api/incidentes/{id}`, y luego intentar asignar una cuadrilla disponible mediante `POST /api/misiones`.
  3. En paralelo, consultar `GET /api/incidentes` y `GET /api/incidentes/{id}` para un incidente cuya misión `VERIFICACION` esté `COMPLETADA` sin hitos `TIPOLOGIA_RECLASIFICADA`.
* **Comportamiento Actual:** En el paso 2, `GET /api/incidentes` y `GET /api/incidentes/{id}` devuelven `verificado: true`, mientras `POST /api/misiones` responde `409 Conflict` (`codigo: "VERIFICACION_EN_CURSO"`). En el paso 3, retornan `reclasificadoEnTerreno: true` y `justificacionReclasificacion: null`.
* **Comportamiento Esperado:** `verificado` debe derivarse exclusivamente de la finalización efectiva de la evaluación (`mision.estado = 'COMPLETADA'`, existencia de `reporte_terreno` o hitos de cierre `EVALUACION_COMPLETADA` / `VERIFICACION_COMPLETADA`, alineado con HU-21); `reclasificadoEnTerreno` debe ser `true` únicamente cuando exista al menos un hito `TIPOLOGIA_RECLASIFICADA`; y `GET /api/incidentes` no debe ejecutar sentencias `UPDATE` en la base de datos.
* **Sugerencia Técnica de Solución:**
  * Desacoplar las subconsultas de `verificado` y `reclasificado_en_terreno` en `incidente-kanban.repository.ts` y `incidente-kanban.service.ts`: `verificado` debe evaluar cierre de verificación/reporte (no `TIPOLOGIA_RECLASIFICADA`), y `reclasificadoEnTerreno` debe evaluar exclusivamente `mision_hito.hito = 'TIPOLOGIA_RECLASIFICADA'`.
  * Eliminar el `UPDATE incidente` dentro de `listarIncidentesPaginadosRepo`.

---

### `BUG-H37-API-04`: Desfase de 35 Commits con `develop`, Colisión de Migración Kysely (`052_` vs `035_`), Fallo de `npm run db:migrate`, 8 Conflictos de Fusión y Regresión de Fixes HU-36
* **Severidad:** **ALTA** (Ruptura de Integración Continua, Bloqueo de Migraciones Kysely y Conflictos de Merge).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/db/migrations/052_permiso_misiones_terreno_verificar.ts` (vs `035_permiso_misiones_terreno_verificar.ts`, `042_cuadrilla_patrulla_integrantes_vistas.ts` y `061_notificaciones_mision.ts` en `develop`)
  * `src/modules/misiones/mision.repository.ts`, `src/modules/misiones/mision.service.ts`, `src/lib/socket/index.ts`, `src/lib/openapi/index.ts`, `docs/api/misiones.md`, `src/modules/seguridad/permisos.constants.ts`
  * `src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts` (Línea 13) y `src/modules/misiones/mision.service.ts` (Línea 65) — 2 warnings ESLint
* **Descripción Técnica del Defecto:**
  1. La rama `feature/h37-patrulla-categorizar-incidente` está **35 commits por detrás de `develop`** (carece de las integraciones de HU-35, HU-36 final, HU-22, HU-85 final, versión `0.11.0` y unificación OpenAPI).
  2. La rama conserva `052_permiso_misiones_terreno_verificar.ts` mientras en `develop` la migración oficial fue consolidada y ejecutada como `035_permiso_misiones_terreno_verificar.ts` (junto con `042_cuadrilla_patrulla_integrantes_vistas.ts` y `061_notificaciones_mision.ts`). Al ejecutar `npm run db:migrate`, Kysely aborta con código `1`: `Error: corrupted migrations: previously executed migration 035_permiso_misiones_terreno_verificar is missing`.
  3. Al simular la fusión con `develop` (`git merge-tree --write-tree develop HEAD`), se producen **8 conflictos** (conflicto de renombre `034_` -> `035_` vs `052_` y conflictos de contenido en `docs/api/misiones.md`, `incidente-kanban.{repository,schema,service}.ts`, `mision.{repository,schema,service}.ts` y `permisos.constants.ts`), además de conservar código obsoleto de HU-36 (`aceptarMisionPatrullaRepo` sin `.forUpdate()` ni validación completa de `patrulla_personal`, y `notificarMisionActualizada` con omisión de salas en Redis).
  4. `npm run lint` reporta 2 warnings `@typescript-eslint/no-unused-vars` (`BadRequestError` en `tipologia/__tests__/route.test.ts:13` y `hitos` en `mision.service.ts:65`).
* **Pasos para Reproducir:**
  1. Ejecutar `npm run db:migrate` sobre la base de datos integrada del entorno de pruebas.
  2. Ejecutar `git log HEAD..develop --oneline` y `git merge-tree --write-tree --name-only develop HEAD`.
  3. Ejecutar `npm run lint`.
* **Comportamiento Actual:** `npm run db:migrate` falla con código de salida `1` (`corrupted migrations`), la rama acumula 35 commits de desfase con 8 conflictos de fusión frente a `develop` y el linter emite 2 warnings por símbolos sin uso.
* **Comportamiento Esperado:** La rama debe estar sincronizada con `develop` (`git merge develop`), preservando las migraciones `035_`, `042_` y `061_` sin duplicar `052_permiso_misiones_terreno_verificar.ts`, sin revertir los fixes de HU-36 ni de OpenAPI/versión `0.11.0`, con `npm run db:migrate` finalizando con código `0` y `npm run lint` sin errores ni warnings nuevos.
* **Sugerencia Técnica de Solución:**
  Integrar `develop` en `feature/h37-patrulla-categorizar-incidente` conservando `035_permiso_misiones_terreno_verificar.ts` (eliminando `052_permiso_misiones_terreno_verificar.ts`) y las versiones actualizadas de `mision.{repository,service}.ts` y `socket/index.ts`, resolver los conflictos manteniendo los cambios propios de HU-37, remover los símbolos sin uso (`BadRequestError` y `hitos`) y validar `npm run db:migrate`, `npm run lint` y `npm test`.

---

### `BUG-H37-API-05`: Omisión de Query Params y Esquema Detallado `?catalogo=true` en OpenAPI para `GET /api/incidentes/tipos`, Discrepancia de Catálogo `"Incendio"` y Broadcast Global Duplicado en `notificarIncidenteActualizado`
* **Severidad:** **MEDIA** (Discrepancia de Contrato OpenAPI para Generación de Tipos en `sgrai-pwa`, Consistencia de Catálogo y Duplicidad WebSocket en Memoria).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts` (Líneas 861-882)
  * `src/app/api/incidentes/tipos/route.ts` (Líneas 15-37) y `src/modules/incidentes/aviso-incidente.schema.ts` (Líneas 7-20)
  * `src/lib/socket/index.ts` (Líneas 179-192)
* **Descripción Técnica del Defecto:**
  1. **Contrato OpenAPI incompleto para `GET /api/incidentes/tipos` (`src/lib/openapi/index.ts:861-882`):** Aunque el archivo registra los esquemas `TipoIncidenteCatalogoItem` y `ListarTiposIncidenteResponse` (líneas 948-949), la definición de ruta `/api/incidentes/tipos` no declara los query parameters `catalogo` / `detallado` ni contempla `ListarTiposIncidenteResponseSchema` en la respuesta `200`, declarando únicamente `data: string[]`. Esto impide que los clientes tipados generados automáticamente desde `/openapi.json` en `sgrai-pwa` obtengan los UUIDs de `tipo_incidente`.
  2. **Discrepancia entre catálogo simple y tabla `tipo_incidente`:** `GET /api/incidentes/tipos` sin parámetros retorna `TIPOS_AFECTACION` (12 cadenas, incluyendo `"Incendio"`), mientras la tabla oficial `tipo_incidente` contiene 11 registros activos donde solo existe `"Incendio estructural / forestal"` y no existe `"Incendio"`.
  3. **Broadcast global duplicado en `notificarIncidenteActualizado` (`src/lib/socket/index.ts:187`):** En modo en memoria (`if (ioInstance)`), tras emitir a `"sala:encargados"`, `"encargado"` y `"mapa"`, se ejecuta `(ioInstance as any).emit("incidente:actualizado", payload)`. Esto provoca que los clientes suscritos a esas salas reciban el evento duplicado y expone el payload interno a sockets conectados que no pertenecen al Centro de Mando, a diferencia de la rama Redis Pub/Sub (líneas 196-223).
* **Pasos para Reproducir:**
  1. Consultar `GET http://localhost:3099/openapi.json` e inspeccionar `paths["/api/incidentes/tipos"].get`.
  2. Comparar la respuesta de `GET /api/incidentes/tipos` contra `GET /api/incidentes/tipos?catalogo=true`.
  3. Inspeccionar `notificarIncidenteActualizado` en `src/lib/socket/index.ts:179-192`.
* **Comportamiento Actual:** OpenAPI omite `?catalogo`/`?detallado` y el esquema `{ id, nombre, descripcion, activo }[]`; `"Incendio"` aparece en el listado simple sin respaldo en `tipo_incidente`; y `notificarIncidenteActualizado` ejecuta broadcast global en memoria.
* **Comportamiento Esperado:** `GET /api/incidentes/tipos` en OpenAPI debe documentar `catalogo` y `detallado` en `request.query` y soportar `oneOf` entre el formato simple y `ListarTiposIncidenteResponseSchema`; la taxonomía oficial debe mantenerse alineada con `tipo_incidente`; y `notificarIncidenteActualizado` debe emitir únicamente a las salas `["sala:encargados", "encargado", "mapa"]` tanto en memoria como en Redis Pub/Sub.
* **Sugerencia Técnica de Solución:**
  * En `src/lib/openapi/index.ts`, agregar `request: { query: z.object({ catalogo: z.enum(["true", "false"]).optional(), detallado: z.enum(["true", "false"]).optional() }) }` y `schema: z.union([z.object({ message: z.string(), data: z.array(z.string()) }), ListarTiposIncidenteResponseSchema])` en `/api/incidentes/tipos`.
  * Alinear el catálogo `TIPOS_AFECTACION` o resolver ambos modos desde `tipo_incidente` respetando retrocompatibilidad.
  * Remover `(ioInstance as any).emit("incidente:actualizado", payload)` de `src/lib/socket/index.ts:187`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H37-API-01` | Bypass de autenticación JWT mediante cabecera plana `x-user-id` en `PATCH /api/incidentes/[id]/tipologia` y exposición en OpenAPI | Seguridad / Autenticación | Route Handler / OpenAPI | Crítica | Petición sin `Authorization: Bearer <token>` utilizando cabecera `x-user-id` con UUID de Administrador | `PATCH /api/incidentes/{id}/tipologia` con header `x-user-id: 00000000-0000-4000-8000-000000000001` y body válido | `HTTP 401 Unauthorized` exigiendo JWT Bearer válido y OpenAPI sin `x-user-id` | Acepta `x-user-id` sin JWT, ejecuta reclasificación como Admin (`HTTP 200 OK`) y OpenAPI expone `x-user-id` | ABIERTO | 17/11/2026 00:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-API-02` | Bypass de pertenencia con `patrulla_id` null, omisión de filtro `tipo_mision = 'VERIFICACION'`, falta de validación de estado ICS/patrulla activa y falta de `.forUpdate()` | Seguridad / Concurrencia ICS | Repositorio / BD | Crítica | Incidente `EN_ATENCION` con misión `ATENCION_CUADRILLA` (`patrulla_id = null`), incidente `RESUELTO` o patrulla dada de baja lógica | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/tipologia` con JWT de `pedro.patrulla@valdivia.cl` | Rechazo `409 Conflict` / `403 Forbidden` si no hay misión `VERIFICACION` activa con patrulla asignada, si incidente está `EN_ATENCION`/`RESUELTO` o patrulla inactiva | Retorna `HTTP 200 OK`, altera incidente `EN_ATENCION`/`RESUELTO` y patrulla eliminada, e inserta hito en misión de cuadrilla sin `.forUpdate()` | ABIERTO | 17/11/2026 00:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-API-03` | Corrupción semántica de `verificado` y `reclasificadoEnTerreno` en Kanban (contradicción `VERIFICACION_EN_CURSO` con HU-21) y `UPDATE` en `GET /api/incidentes` | Funcional / Integridad ICS | Repositorio / Servicio | Alta | Incidente reclasificado con misión `VERIFICACION` aún `EN_CURSO` sin `reporte_terreno`, o verificación `COMPLETADA` sin reclasificación | `GET /api/incidentes`, `GET /api/incidentes/{id}` y `POST /api/misiones` (`ATENCION_CUADRILLA`) | `verificado: false` hasta completar verificación; `reclasificadoEnTerreno: true` solo si existe `TIPOLOGIA_RECLASIFICADA`; `GET` sin escrituras | `GET /api/incidentes` y detalle devuelven `verificado: true` mientras HU-21 devuelve `409 VERIFICACION_EN_CURSO`; `reclasificadoEnTerreno: true` sin reclasificación y `GET` ejecuta `UPDATE` | ABIERTO | 17/11/2026 00:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-API-04` | Desfase de 35 commits con `develop`, colisión de migración `052_` vs `035_`, fallo de `npm run db:migrate`, 8 conflictos de fusión y regresión HU-36 | Integración / CI | Migraciones / Git / Lint | Alta | BD sincronizada con `develop` (`035_`, `042_`, `061_`) | `npm run db:migrate`, `git merge-tree --write-tree develop HEAD` y `npm run lint` | Migración y fusión limpias sin colisiones ni regresiones HU-36; `0` errores y `0` warnings | `npm run db:migrate` falla (`corrupted migrations: 035_permiso_misiones_terreno_verificar is missing`), 8 conflictos de merge, regresión HU-36 y 2 warnings ESLint | ABIERTO | 17/11/2026 00:14 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-API-05` | Omisión de `?catalogo=true` y `ListarTiposIncidenteResponse` en OpenAPI de `GET /api/incidentes/tipos`, discrepancia `"Incendio"` y broadcast global Socket.io en memoria | Contrato API / Tiempo Real | OpenAPI / Catálogo / Socket | Media | Servidor con `/openapi.json` y `notificarIncidenteActualizado` con `ioInstance` activo | `GET /openapi.json`, `GET /api/incidentes/tipos` e inspección de `src/lib/socket/index.ts` | OpenAPI con query params y esquema detallado de `GET /api/incidentes/tipos`, catálogo alineado con BD y emisión Socket.io solo por salas | OpenAPI solo documenta `string[]` sin query params; listado simple incluye `"Incendio"` ausente en `tipo_incidente`; memoria ejecuta `(ioInstance as any).emit` global duplicado | ABIERTO | 17/11/2026 00:20 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H37-API-01` | Consulta del catálogo oficial detallado de tipos de incidente mediante `GET /api/incidentes/tipos?catalogo=true` (`200 OK`) | Funcional / Positiva | Integración / Endpoint | Crítica | Tabla `tipo_incidente` poblada con 11 registros activos | `GET /api/incidentes/tipos?catalogo=true` | `HTTP 200 OK` retornando arreglo de 11 objetos `{ id, nombre, descripcion, activo }` ordenados alfabéticamente | Retorna `HTTP 200 OK` con los 11 registros oficiales de `tipo_incidente` y sus UUIDs | APROBADO | 17/11/2026 00:20 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-02` | Consulta del catálogo oficial detallado mediante alias `?detallado=true` y preservación del modo simple para Chatbot (`200 OK`) | Funcional / Regresión | Integración / Endpoint | Alta | Endpoint `GET /api/incidentes/tipos` operativo | `GET /api/incidentes/tipos?detallado=true` y `GET /api/incidentes/tipos` | `HTTP 200 OK` con catálogo detallado cuando `?detallado=true` y `string[]` cuando no se envían parámetros | Ambos modos responden `HTTP 200 OK` preservando retrocompatibilidad del Chatbot | APROBADO | 17/11/2026 00:20 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-03` | Reclasificación exitosa de tipología con `tipoIncidenteId` (`camelCase`) por líder de patrulla asignada (`200 OK`) | Funcional / Positiva | Integración / Endpoint | Crítica | Incidente en `VERIFICANDO` con misión `VERIFICACION` `EN_CURSO` asignada a la patrulla del usuario autenticado | `PATCH /api/incidentes/{id}/tipologia` con JWT de `pedro.patrulla@valdivia.cl`, `tipoIncidenteId` (`Inundación`) y `justificacion` | `HTTP 200 OK`, actualización de `incidente.tipo_incidente_id` y `tipo_afectacion`, e inserción en `mision_hito` | Retorna `HTTP 200 OK` actualizando `tipo_incidente_id`, `tipo_afectacion: "Inundación"` e hito `TIPOLOGIA_RECLASIFICADA` | APROBADO | 17/11/2026 00:23 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-04` | Reclasificación exitosa usando alias `tipo_incidente_id` (`snake_case`) y actualización del tipo en BD (`200 OK`) | Funcional / Contrato | Integración / Schema | Alta | Incidente en `VERIFICANDO` con misión `VERIFICACION` `EN_CURSO` del patrullero autenticado | `PATCH /api/incidentes/{id}/tipologia` con `{"tipo_incidente_id":"40000000-0000-4000-8000-000000000002","justificacion":"..."}` | `HTTP 200 OK` aceptando `tipo_incidente_id` y actualizando `tipoAfectacion` a `"Deslizamiento de tierra"` | Retorna `HTTP 200 OK` actualizando `tipo_incidente_id` y `tipoAfectacion: "Deslizamiento de tierra"` | APROBADO | 17/11/2026 00:23 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-05` | Autorización exitosa para integrante de `patrulla_personal` (no líder) perteneciente a la patrulla asignada (`200 OK`) | Seguridad / Autorización | Integración / Repositorio | Alta | Usuario `matias.patrulla@valdivia.cl` registrado en `patrulla_personal` de `Patrulla verificadora alen` | `PATCH /api/incidentes/{id}/tipologia` con JWT de `matias.patrulla@valdivia.cl` | `HTTP 200 OK` registrando `registradoPorId` con el UUID del integrante evaluador | Retorna `HTTP 200 OK` con `registradoPorId: "d1000000-0000-4000-8000-000000000003"` | APROBADO | 17/11/2026 00:24 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-06` | Registro automático del hito `'TIPOLOGIA_RECLASIFICADA'` con texto `'Tipología reclasificada en terreno a: [Nombre del Tipo]'` y exposición en `GET /api/misiones/[id]` | Funcional / Trazabilidad ICS | Integración / Bitácora | Crítica | Reclasificación ejecutada sobre misión de verificación `EN_CURSO` | `GET /api/misiones/{misionId}` con JWT de `encargado@valdivia.cl` | `bitacoraTiempos` incluye hito `TIPOLOGIA_RECLASIFICADA` con la glosa exigida y `titulo` actualizado con nueva tipología | `GET /api/misiones/{id}` expone ambos hitos cronológicos en `bitacoraTiempos` y actualiza el `titulo` dinámico | APROBADO | 17/11/2026 00:23 | - | feat(misiones): consultar hitos reales en detalle de mision y registrar reclasificacion en bitacora (HU-37) |
| `CP-H37-API-07` | Emisión de notificación en tiempo real `incidente:actualizado` por Redis Pub/Sub hacia `sala:encargados`, `encargado` y `mapa` | Tiempo Real / Socket.io | Integración / Redis + WS | Crítica | Cliente WebSocket unido a `sala:encargados` y suscriptor Redis en `sgrai:socket-events` | `PATCH /api/incidentes/{id}/tipologia` exitoso con cambio de tipología | Recepción en tiempo real del evento `incidente:actualizado` con `id`, `codigo`, `tipoIncidenteId`, `tipoAfectacion`, `nuevoEstado` y `justificacion` | Cliente WebSocket recibe el evento y Redis publica 3 mensajes dirigidos a `sala:encargados`, `encargado` y `mapa` | APROBADO | 17/11/2026 00:23 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-08` | Rechazo de petición sin credenciales ni cabeceras de autenticación (`401 Unauthorized`) | Seguridad / Autenticación | Endpoint | Crítica | Petición sin `Authorization` ni `x-user-id` | `PATCH /api/incidentes/{id}/tipologia` sin cabeceras de autenticación | `HTTP 401 Unauthorized` con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | Retorna `HTTP 401 Unauthorized` con el mensaje esperado | APROBADO | 17/11/2026 00:20 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-09` | Rechazo por token JWT Bearer inválido o malformado (`401 Unauthorized`) | Seguridad / Autenticación | Endpoint / JWT | Crítica | Cabecera `Authorization: Bearer token.invalido.jwt` | `PATCH /api/incidentes/{id}/tipologia` con JWT manipulado | `HTTP 401 Unauthorized` con mensaje `"Token de sesión inválido o expirado."` | Retorna `HTTP 401 Unauthorized`: `{"message":"Token de sesión inválido o expirado."}` | APROBADO | 17/11/2026 00:20 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-10` | Rechazo RBAC para usuarios `CALL_CENTER` y `ENCARGADO` sin permiso `misiones:terreno:verificar` (`403 Forbidden`) | Seguridad / RBAC | Endpoint / Auth | Crítica | Tokens JWT válidos de `callcenter@valdivia.cl` y `encargado@valdivia.cl` | `PATCH /api/incidentes/{id}/tipologia` con `Authorization: Bearer <token_callcenter>` y `<token_encargado>` | `HTTP 403 Forbidden` indicando ausencia de `misiones:terreno:verificar` | Ambos retornan `HTTP 403 Forbidden`: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-11` | Rechazo de patrullero perteneciente a otra patrulla verificadora cuando la misión tiene `patrulla_id` asignado (`403 Forbidden`) | Seguridad / Autorización | Integración / Repositorio | Alta | Incidente `a1000000-0000-4000-8000-000000000003` asignado a `Patrulla Rápida Costa-1` | `PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia` con JWT de `pedro.patrulla@valdivia.cl` | `HTTP 403 Forbidden` impidiendo reclasificar incidente ajeno | Retorna `HTTP 403 Forbidden`: `{"message":"No está autorizado para reclasificar la tipología de un incidente asignado a otra patrulla verificadora."}` | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-12` | Rechazo de parámetro de ruta `id` con formato UUID inválido (`400 Bad Request`) | Validación / Contrato | Endpoint / Zod | Media | Usuario autenticado con permiso `misiones:terreno:verificar` | `PATCH /api/incidentes/id-no-es-uuid/tipologia` con JWT válido | `HTTP 400 Bad Request` detallando error en campo `id` | Retorna `HTTP 400 Bad Request`: `"El identificador del incidente proporcionado no es un UUID válido."` | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-13` | Rechazo por cuerpo de petición JSON malformado (`400 Bad Request`) | Validación / Robustez | Endpoint | Media | Usuario autorizado enviando JSON sintácticamente inválido | `PATCH /api/incidentes/{id}/tipologia` con body `{malformed` | `HTTP 400 Bad Request` con mensaje `"El cuerpo de la petición no es un JSON válido."` | Retorna `HTTP 400 Bad Request` con el mensaje esperado | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-14` | Rechazo por `justificacion` menor a 5 caracteres o compuesta únicamente por espacios en blanco (`400 Bad Request`) | Validación / Schema Zod | Endpoint / Zod | Alta | Usuario autorizado enviando `justificacion: "abc"` o `"     "` | `PATCH /api/incidentes/{id}/tipologia` con `justificacion: "abc"` y `"     "` | `HTTP 400 Bad Request` indicando mínimo de 5 caracteres en `justificacion` | Ambos retornan `HTTP 400 Bad Request` con `errors[0].campo = "justificacion"` | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-15` | Rechazo por ausencia de `tipoIncidenteId` y `tipo_incidente_id` en el payload (`400 Bad Request`) | Validación / Schema Zod | Endpoint / Zod | Alta | Usuario autorizado enviando únicamente `justificacion` | `PATCH /api/incidentes/{id}/tipologia` con `{"justificacion":"Constatacion en terreno sin tipo"}` | `HTTP 400 Bad Request` exigiendo especificar `tipoIncidenteId` o `tipo_incidente_id` | Retorna `HTTP 400 Bad Request` con error estructurado en `tipoIncidenteId` | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-16` | Rechazo cuando se selecciona un `tipo_incidente` con estado `activo = false` (`400 Bad Request`) | Regla de Negocio / Catálogo | Integración / Repositorio | Alta | Registro en `tipo_incidente` con `activo = false` | `PATCH /api/incidentes/{id}/tipologia` con UUID del tipo inactivo | `HTTP 400 Bad Request` indicando que el tipo seleccionado no se encuentra activo | Retorna `HTTP 400 Bad Request`: `{"message":"El tipo de incidente seleccionado no se encuentra activo en el catálogo oficial."}` | APROBADO | 17/11/2026 00:23 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-17` | Rechazo cuando el `incidenteId` o el `tipoIncidenteId` no existen en la base de datos (`404 Not Found`) | Funcional / Negativa | Integración / Repositorio | Alta | UUID inexistente en tabla `incidente` o en `tipo_incidente` | `PATCH /api/incidentes/99999999-.../tipologia` y `tipoIncidenteId: "49999999-..."` | `HTTP 404 Not Found` diferenciando incidente inexistente vs tipo de incidente inexistente | Ambos retornan `HTTP 404 Not Found` con sus respectivos mensajes descriptivos | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-18` | Bloqueo cuando la patrulla aún no ha aceptado la misión asignada y permanece en estado `DESPACHADA` (`409 Conflict`) | Regla de Negocio ICS | Integración / Repositorio | Crítica | Misión `MIS-2026-0008` en estado `DESPACHADA` asignada a la patrulla de Pedro | `PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/tipologia` con JWT de `pedro.patrulla@valdivia.cl` | `HTTP 409 Conflict` indicando que la patrulla debe aceptar la misión antes de reclasificar | Retorna `HTTP 409 Conflict`: `{"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}` | APROBADO | 17/11/2026 00:21 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-19` | Resiliencia del servicio si la emisión del evento WebSocket `incidente:actualizado` lanza una excepción | Tolerancia a Fallos | Unitaria / Servicio | Media | `notificarIncidenteActualizado` arrojando excepción simulada tras confirmar transacción | `npm test -- -t "TipologiaService \(HU-37\)"` | La transacción en BD se mantiene y el servicio retorna respuesta exitosa sin abortar | `TipologiaService` captura la excepción en `try/catch` y retorna el resultado completo | APROBADO | 17/11/2026 00:25 | - | feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39) |
| `CP-H37-API-20` | Ejecución de suites unitarias Vitest y compilación Next.js / TypeScript de los módulos de tipología, Kanban y detalle de misión | Automatización / Build | Unit / Build / TS | Alta | Código fuente de la rama `feature/h37-patrulla-categorizar-incidente` | `npm test` (813/813) y `rm -rf .next && npm run build && npx tsc --noEmit` | 100% de pruebas unitarias aprobadas y compilación de producción sin errores TypeScript | 813/813 tests aprobados en Vitest (36/36 focalizados HU-37), `npm run build` y `tsc --noEmit` exit code `0` | APROBADO | 17/11/2026 00:24 | - | fix(test): alinear mocks de detalle incidente con esquema verificado y justificacionReclasificacion |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H37-API-01	Bypass de autenticación JWT mediante cabecera plana x-user-id en PATCH /api/incidentes/[id]/tipologia y exposición en OpenAPI	Seguridad / Autenticación	Route Handler / OpenAPI	Crítica	Petición sin Authorization: Bearer <token> utilizando cabecera x-user-id con UUID de Administrador	PATCH /api/incidentes/{id}/tipologia con header x-user-id: 00000000-0000-4000-8000-000000000001 y body válido	HTTP 401 Unauthorized exigiendo JWT Bearer válido y OpenAPI sin x-user-id	Acepta x-user-id sin JWT, ejecuta reclasificación como Admin (HTTP 200 OK) y OpenAPI expone x-user-id	ABIERTO	17/11/2026 00:23	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-API-02	Bypass de pertenencia con patrulla_id null, omisión de filtro tipo_mision = 'VERIFICACION', falta de validación de estado ICS/patrulla activa y falta de .forUpdate()	Seguridad / Concurrencia ICS	Repositorio / BD	Crítica	Incidente EN_ATENCION con misión ATENCION_CUADRILLA (patrulla_id = null), incidente RESUELTO o patrulla dada de baja lógica	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000004/tipologia con JWT de pedro.patrulla@valdivia.cl	Rechazo 409 Conflict / 403 Forbidden si no hay misión VERIFICACION activa con patrulla asignada, si incidente está EN_ATENCION/RESUELTO o patrulla inactiva	Retorna HTTP 200 OK, altera incidente EN_ATENCION/RESUELTO y patrulla eliminada, e inserta hito en misión de cuadrilla sin .forUpdate()	ABIERTO	17/11/2026 00:23	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-API-03	Corrupción semántica de verificado y reclasificadoEnTerreno en Kanban (contradicción VERIFICACION_EN_CURSO con HU-21) y UPDATE en GET /api/incidentes	Funcional / Integridad ICS	Repositorio / Servicio	Alta	Incidente reclasificado con misión VERIFICACION aún EN_CURSO sin reporte_terreno, o verificación COMPLETADA sin reclasificación	GET /api/incidentes, GET /api/incidentes/{id} y POST /api/misiones (ATENCION_CUADRILLA)	verificado: false hasta completar verificación; reclasificadoEnTerreno: true solo si existe TIPOLOGIA_RECLASIFICADA; GET sin escrituras	GET /api/incidentes y detalle devuelven verificado: true mientras HU-21 devuelve 409 VERIFICACION_EN_CURSO; reclasificadoEnTerreno: true sin reclasificación y GET ejecuta UPDATE	ABIERTO	17/11/2026 00:23	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-API-04	Desfase de 35 commits con develop, colisión de migración 052_ vs 035_, fallo de npm run db:migrate, 8 conflictos de fusión y regresión HU-36	Integración / CI	Migraciones / Git / Lint	Alta	BD sincronizada con develop (035_, 042_, 061_)	npm run db:migrate, git merge-tree --write-tree develop HEAD y npm run lint	Migración y fusión limpias sin colisiones ni regresiones HU-36; 0 errores y 0 warnings	npm run db:migrate falla (corrupted migrations: 035_permiso_misiones_terreno_verificar is missing), 8 conflictos de merge, regresión HU-36 y 2 warnings ESLint	ABIERTO	17/11/2026 00:14	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-API-05	Omisión de ?catalogo=true y ListarTiposIncidenteResponse en OpenAPI de GET /api/incidentes/tipos, discrepancia "Incendio" y broadcast global Socket.io en memoria	Contrato API / Tiempo Real	OpenAPI / Catálogo / Socket	Media	Servidor con /openapi.json y notificarIncidenteActualizado con ioInstance activo	GET /openapi.json, GET /api/incidentes/tipos e inspección de src/lib/socket/index.ts	OpenAPI con query params y esquema detallado de GET /api/incidentes/tipos, catálogo alineado con BD y emisión Socket.io solo por salas	OpenAPI solo documenta string[] sin query params; listado simple incluye "Incendio" ausente en tipo_incidente; memoria ejecuta (ioInstance as any).emit global duplicado	ABIERTO	17/11/2026 00:20	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H37-API-01	Consulta del catálogo oficial detallado de tipos de incidente mediante GET /api/incidentes/tipos?catalogo=true (200 OK)	Funcional / Positiva	Integración / Endpoint	Crítica	Tabla tipo_incidente poblada con 11 registros activos	GET /api/incidentes/tipos?catalogo=true	HTTP 200 OK retornando arreglo de 11 objetos { id, nombre, descripcion, activo } ordenados alfabéticamente	Retorna HTTP 200 OK con los 11 registros oficiales de tipo_incidente y sus UUIDs	APROBADO	17/11/2026 00:20	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-02	Consulta del catálogo oficial detallado mediante alias ?detallado=true y preservación del modo simple para Chatbot (200 OK)	Funcional / Regresión	Integración / Endpoint	Alta	Endpoint GET /api/incidentes/tipos operativo	GET /api/incidentes/tipos?detallado=true y GET /api/incidentes/tipos	HTTP 200 OK con catálogo detallado cuando ?detallado=true y string[] cuando no se envían parámetros	Ambos modos responden HTTP 200 OK preservando retrocompatibilidad del Chatbot	APROBADO	17/11/2026 00:20	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-03	Reclasificación exitosa de tipología con tipoIncidenteId (camelCase) por líder de patrulla asignada (200 OK)	Funcional / Positiva	Integración / Endpoint	Crítica	Incidente en VERIFICANDO con misión VERIFICACION EN_CURSO asignada a la patrulla del usuario autenticado	PATCH /api/incidentes/{id}/tipologia con JWT de pedro.patrulla@valdivia.cl, tipoIncidenteId (Inundación) y justificacion	HTTP 200 OK, actualización de incidente.tipo_incidente_id y tipo_afectacion, e inserción en mision_hito	Retorna HTTP 200 OK actualizando tipo_incidente_id, tipo_afectacion: "Inundación" e hito TIPOLOGIA_RECLASIFICADA	APROBADO	17/11/2026 00:23	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-04	Reclasificación exitosa usando alias tipo_incidente_id (snake_case) y actualización del tipo en BD (200 OK)	Funcional / Contrato	Integración / Schema	Alta	Incidente en VERIFICANDO con misión VERIFICACION EN_CURSO del patrullero autenticado	PATCH /api/incidentes/{id}/tipologia con {"tipo_incidente_id":"40000000-0000-4000-8000-000000000002","justificacion":"..."}	HTTP 200 OK aceptando tipo_incidente_id y actualizando tipoAfectacion a "Deslizamiento de tierra"	Retorna HTTP 200 OK actualizando tipo_incidente_id y tipoAfectacion: "Deslizamiento de tierra"	APROBADO	17/11/2026 00:23	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-05	Autorización exitosa para integrante de patrulla_personal (no líder) perteneciente a la patrulla asignada (200 OK)	Seguridad / Autorización	Integración / Repositorio	Alta	Usuario matias.patrulla@valdivia.cl registrado en patrulla_personal de Patrulla verificadora alen	PATCH /api/incidentes/{id}/tipologia con JWT de matias.patrulla@valdivia.cl	HTTP 200 OK registrando registradoPorId con el UUID del integrante evaluador	Retorna HTTP 200 OK con registradoPorId: "d1000000-0000-4000-8000-000000000003"	APROBADO	17/11/2026 00:24	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-06	Registro automático del hito 'TIPOLOGIA_RECLASIFICADA' con texto 'Tipología reclasificada en terreno a: [Nombre del Tipo]' y exposición en GET /api/misiones/[id]	Funcional / Trazabilidad ICS	Integración / Bitácora	Crítica	Reclasificación ejecutada sobre misión de verificación EN_CURSO	GET /api/misiones/{misionId} con JWT de encargado@valdivia.cl	bitacoraTiempos incluye hito TIPOLOGIA_RECLASIFICADA con la glosa exigida y titulo actualizado con nueva tipología	GET /api/misiones/{id} expone ambos hitos cronológicos en bitacoraTiempos y actualiza el titulo dinámico	APROBADO	17/11/2026 00:23	-	feat(misiones): consultar hitos reales en detalle de mision y registrar reclasificacion en bitacora (HU-37)
CP-H37-API-07	Emisión de notificación en tiempo real incidente:actualizado por Redis Pub/Sub hacia sala:encargados, encargado y mapa	Tiempo Real / Socket.io	Integración / Redis + WS	Crítica	Cliente WebSocket unido a sala:encargados y suscriptor Redis en sgrai:socket-events	PATCH /api/incidentes/{id}/tipologia exitoso con cambio de tipología	Recepción en tiempo real del evento incidente:actualizado con id, codigo, tipoIncidenteId, tipoAfectacion, nuevoEstado y justificacion	Cliente WebSocket recibe el evento y Redis publica 3 mensajes dirigidos a sala:encargados, encargado y mapa	APROBADO	17/11/2026 00:23	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-08	Rechazo de petición sin credenciales ni cabeceras de autenticación (401 Unauthorized)	Seguridad / Autenticación	Endpoint	Crítica	Petición sin Authorization ni x-user-id	PATCH /api/incidentes/{id}/tipologia sin cabeceras de autenticación	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	Retorna HTTP 401 Unauthorized con el mensaje esperado	APROBADO	17/11/2026 00:20	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-09	Rechazo por token JWT Bearer inválido o malformado (401 Unauthorized)	Seguridad / Autenticación	Endpoint / JWT	Crítica	Cabecera Authorization: Bearer token.invalido.jwt	PATCH /api/incidentes/{id}/tipologia con JWT manipulado	HTTP 401 Unauthorized con mensaje "Token de sesión inválido o expirado."	Retorna HTTP 401 Unauthorized: {"message":"Token de sesión inválido o expirado."}	APROBADO	17/11/2026 00:20	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-10	Rechazo RBAC para usuarios CALL_CENTER y ENCARGADO sin permiso misiones:terreno:verificar (403 Forbidden)	Seguridad / RBAC	Endpoint / Auth	Crítica	Tokens JWT válidos de callcenter@valdivia.cl y encargado@valdivia.cl	PATCH /api/incidentes/{id}/tipologia con Authorization: Bearer <token_callcenter> y <token_encargado>	HTTP 403 Forbidden indicando ausencia de misiones:terreno:verificar	Ambos retornan HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-11	Rechazo de patrullero perteneciente a otra patrulla verificadora cuando la misión tiene patrulla_id asignado (403 Forbidden)	Seguridad / Autorización	Integración / Repositorio	Alta	Incidente a1000000-0000-4000-8000-000000000003 asignado a Patrulla Rápida Costa-1	PATCH /api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia con JWT de pedro.patrulla@valdivia.cl	HTTP 403 Forbidden impidiendo reclasificar incidente ajeno	Retorna HTTP 403 Forbidden: {"message":"No está autorizado para reclasificar la tipología de un incidente asignado a otra patrulla verificadora."}	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-12	Rechazo de parámetro de ruta id con formato UUID inválido (400 Bad Request)	Validación / Contrato	Endpoint / Zod	Media	Usuario autenticado con permiso misiones:terreno:verificar	PATCH /api/incidentes/id-no-es-uuid/tipologia con JWT válido	HTTP 400 Bad Request detallando error en campo id	Retorna HTTP 400 Bad Request: "El identificador del incidente proporcionado no es un UUID válido."	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-13	Rechazo por cuerpo de petición JSON malformado (400 Bad Request)	Validación / Robustez	Endpoint	Media	Usuario autorizado enviando JSON sintácticamente inválido	PATCH /api/incidentes/{id}/tipologia con body {malformed	HTTP 400 Bad Request con mensaje "El cuerpo de la petición no es un JSON válido."	Retorna HTTP 400 Bad Request con el mensaje esperado	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-14	Rechazo por justificacion menor a 5 caracteres o compuesta únicamente por espacios en blanco (400 Bad Request)	Validación / Schema Zod	Endpoint / Zod	Alta	Usuario autorizado enviando justificacion: "abc" o "     "	PATCH /api/incidentes/{id}/tipologia con justificacion: "abc" y "     "	HTTP 400 Bad Request indicando mínimo de 5 caracteres en justificacion	Ambos retornan HTTP 400 Bad Request con errors[0].campo = "justificacion"	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-15	Rechazo por ausencia de tipoIncidenteId y tipo_incidente_id en el payload (400 Bad Request)	Validación / Schema Zod	Endpoint / Zod	Alta	Usuario autorizado enviando únicamente justificacion	PATCH /api/incidentes/{id}/tipologia con {"justificacion":"Constatacion en terreno sin tipo"}	HTTP 400 Bad Request exigiendo especificar tipoIncidenteId o tipo_incidente_id	Retorna HTTP 400 Bad Request con error estructurado en tipoIncidenteId	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-16	Rechazo cuando se selecciona un tipo_incidente con estado activo = false (400 Bad Request)	Regla de Negocio / Catálogo	Integración / Repositorio	Alta	Registro en tipo_incidente con activo = false	PATCH /api/incidentes/{id}/tipologia con UUID del tipo inactivo	HTTP 400 Bad Request indicando que el tipo seleccionado no se encuentra activo	Retorna HTTP 400 Bad Request: {"message":"El tipo de incidente seleccionado no se encuentra activo en el catálogo oficial."}	APROBADO	17/11/2026 00:23	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-17	Rechazo cuando el incidenteId o el tipoIncidenteId no existen en la base de datos (404 Not Found)	Funcional / Negativa	Integración / Repositorio	Alta	UUID inexistente en tabla incidente o en tipo_incidente	PATCH /api/incidentes/99999999-.../tipologia y tipoIncidenteId: "49999999-..."	HTTP 404 Not Found diferenciando incidente inexistente vs tipo de incidente inexistente	Ambos retornan HTTP 404 Not Found con sus respectivos mensajes descriptivos	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-18	Bloqueo cuando la patrulla aún no ha aceptado la misión asignada y permanece en estado DESPACHADA (409 Conflict)	Regla de Negocio ICS	Integración / Repositorio	Crítica	Misión MIS-2026-0008 en estado DESPACHADA asignada a la patrulla de Pedro	PATCH /api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/tipologia con JWT de pedro.patrulla@valdivia.cl	HTTP 409 Conflict indicando que la patrulla debe aceptar la misión antes de reclasificar	Retorna HTTP 409 Conflict: {"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}	APROBADO	17/11/2026 00:21	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-19	Resiliencia del servicio si la emisión del evento WebSocket incidente:actualizado lanza una excepción	Tolerancia a Fallos	Unitaria / Servicio	Media	notificarIncidenteActualizado arrojando excepción simulada tras confirmar transacción	npm test -- -t "TipologiaService \(HU-37\)"	La transacción en BD se mantiene y el servicio retorna respuesta exitosa sin abortar	TipologiaService captura la excepción en try/catch y retorna el resultado completo	APROBADO	17/11/2026 00:25	-	feat(incidentes): implementar endpoint PATCH /api/incidentes/[id]/tipologia para reclasificacion en terreno (#39)
CP-H37-API-20	Ejecución de suites unitarias Vitest y compilación Next.js / TypeScript de los módulos de tipología, Kanban y detalle de misión	Automatización / Build	Unit / Build / TS	Alta	Código fuente de la rama feature/h37-patrulla-categorizar-incidente	npm test (813/813) y rm -rf .next && npm run build && npx tsc --noEmit	100% de pruebas unitarias aprobadas y compilación de producción sin errores TypeScript	813/813 tests aprobados en Vitest (36/36 focalizados HU-37), npm run build y tsc --noEmit exit code 0	APROBADO	17/11/2026 00:24	-	fix(test): alinear mocks de detalle incidente con esquema verificado y justificacionReclasificacion
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Focalizada de Tipología, Kanban, Misiones y Contrato OpenAPI
```bash
npm test -- \
  src/app/api/incidentes/tipos/__tests__/route.test.ts \
  src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts \
  src/modules/incidentes/__tests__/tipologia.service.test.ts \
  src/modules/incidentes/__tests__/tipologia.repository.test.ts \
  src/modules/incidentes/__tests__/incidente-kanban.service.test.ts \
  src/app/api/incidentes/[id]/__tests__/route.test.ts \
  src/modules/misiones/__tests__/mision.service.test.ts \
  src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (6 tests) 13ms
 ✓ src/modules/incidentes/__tests__/incidente-kanban.service.test.ts (5 tests) 11ms
 ✓ src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts (8 tests) 26ms
 ✓ src/modules/incidentes/__tests__/tipologia.service.test.ts (3 tests) 16ms
 ✓ src/modules/incidentes/__tests__/tipologia.repository.test.ts (6 tests) 17ms
 ✓ src/app/api/incidentes/[id]/__tests__/route.test.ts (5 tests) 14ms
 ✓ src/app/api/incidentes/tipos/__tests__/route.test.ts (2 tests) 13ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 136ms

 Test Files  8 passed (8)
      Tests  36 passed (36)
   Start at  00:24:30
   Duration  1.05s (transform 1.01s, setup 0ms, collect 2.84s, tests 247ms, environment 2ms, prepare 752ms)
```

#### 5.1.2 Ejecución Individual por Nombre de Suite (`-t`) y Suite Completa
```bash
npm test -- -t "Endpoint GET /api/incidentes/tipos"
npm test -- -t "Route Handler PATCH /api/incidentes/\[id\]/tipologia \(HU-37\)"
npm test -- -t "TipologiaService \(HU-37\)"
npm test -- -t "TipologiaRepository \(HU-37\)"
npm test
```

**Resumen Suite Completa (`npm test`):**
```text
 Test Files  69 passed (69)
      Tests  813 passed (813)
   Start at  00:13:52
   Duration  6.62s
```

#### 5.1.3 Evidencia de Análisis Estático (`npm run lint`) y Migraciones Kysely (`BUG-H37-API-04`)
```bash
npm run lint
```

**Salida de Consola:**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/app/api/incidentes/[id]/tipologia/__tests__/route.test.ts
  13:3  warning  'BadRequestError' is defined but never used  @typescript-eslint/no-unused-vars

/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/src/modules/misiones/mision.service.ts
  65:68  warning  'hitos' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)
```

```bash
npm run db:migrate
```

**Salida de Consola:**
```text
Ejecutando migraciones Kysely de base de datos...
Error al ejecutar migraciones Kysely: Error: corrupted migrations: previously executed migration 035_permiso_misiones_terreno_verificar is missing
    at Migrator.#ensureNoMissingMigrations (/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/node_modules/kysely/dist/migration/migrator.js:500:23)
```

```bash
git merge-tree --write-tree --name-only develop HEAD
```

**Salida de Consola (Extracto):**
```text
CONFLICTO (contenido): Conflicto de fusión en docs/api/misiones.md
CONFLICTO (renombrar / renombrar): src/lib/db/migrations/034_permiso_misiones_terreno_verificar.ts renombrado a src/lib/db/migrations/035_permiso_misiones_terreno_verificar.ts en develop y src/lib/db/migrations/052_permiso_misiones_terreno_verificar.ts en HEAD.
CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/incidente-kanban.repository.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/incidente-kanban.schema.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/incidentes/incidente-kanban.service.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/misiones/mision.repository.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/misiones/mision.schema.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/misiones/mision.service.ts
CONFLICTO (contenido): Conflicto de fusión en src/modules/seguridad/permisos.constants.ts
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`PORT=3099`)

#### Preparación: Obtención de Tokens JWT Reales
```bash
TOKEN_PEDRO=$(curl -s -X POST "http://localhost:3099/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data.token);')

TOKEN_CALL=$(curl -s -X POST "http://localhost:3099/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data.token);')

TOKEN_ENC=$(curl -s -X POST "http://localhost:3099/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.data.token);')
```

#### Caso 1: Consulta del Catálogo Oficial con IDs (`200 OK` — `CP-H37-API-01`)
```bash
curl -s -i "http://localhost:3099/api/incidentes/tipos?catalogo=true"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Catálogo oficial de tipos de incidente obtenido exitosamente.","data":[{"id":"a0000000-0000-4000-8000-000000000001","nombre":"Anegamiento","descripcion":"Acumulación de aguas lluvias en vías o propiedades","activo":true},{"id":"40000000-0000-4000-8000-000000000004","nombre":"Anegamiento de calzada","descripcion":"Saturación de sumideros y acumulación de aguas lluvias en vías públicas","activo":true},{"id":"40000000-0000-4000-8000-000000000003","nombre":"Caída de árbol","descripcion":"Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles","activo":true},{"id":"a0000000-0000-4000-8000-000000000006","nombre":"Corte de agua potable","descripcion":"Corte o rotura matriz en la red de agua potable","activo":true},{"id":"a0000000-0000-4000-8000-000000000003","nombre":"Corte de energía","descripcion":"Interrupción del suministro eléctrico o peligro por cables caídos","activo":true},{"id":"a0000000-0000-4000-8000-000000000005","nombre":"Daño estructural","descripcion":"Colapso parcial o daño grave en techumbre, muros o edificaciones","activo":true},{"id":"a0000000-0000-4000-8000-000000000004","nombre":"Deslizamiento","descripcion":"Movimiento de laderas, socavón o remoción de terreno","activo":true},{"id":"40000000-0000-4000-8000-000000000002","nombre":"Deslizamiento de tierra","descripcion":"Movimiento de masa de suelo o laderas en zonas de riesgo","activo":true},{"id":"40000000-0000-4000-8000-000000000005","nombre":"Incendio estructural / forestal","descripcion":"Focos de fuego en estructuras o vegetación urbana/rural","activo":true},{"id":"40000000-0000-4000-8000-000000000001","nombre":"Inundación","descripcion":"Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales","activo":true},{"id":"40000000-0000-4000-8000-000000000006","nombre":"Otro","descripcion":"Cualquier otro incidente que requiera atención de emergencia municipal","activo":true}]}
```

#### Caso 2: Rechazo Sin Credenciales y con Token Inválido (`401 Unauthorized` — `CP-H37-API-08` y `CP-H37-API-09`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Prueba sin token"}'

curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Authorization: Bearer token.invalido.jwt" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Prueba token invalido"}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Token de sesión inválido o expirado."}
```

#### Caso 3: Evidencia de Bypass JWT mediante Cabecera `x-user-id` (`BUG-H37-API-01`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/id-no-es-uuid/tipologia" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Suplantacion sin JWT"}'
```

**Respuesta HTTP/JSON (elude autenticación `401` y alcanza validación de ruta):**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"El identificador del incidente proporcionado no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador del incidente debe ser un UUID válido."}]}
```
*(Al enviar un UUID de incidente válido con misión `EN_CURSO` usando únicamente `x-user-id: 00000000-0000-4000-8000-000000000001`, el endpoint ejecuta la mutación como Administrador y responde `HTTP 200 OK`)*

#### Caso 4: Rechazo RBAC para Roles `CALL_CENTER` y `ENCARGADO` (`403 Forbidden` — `CP-H37-API-10`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Authorization: Bearer $TOKEN_CALL" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Prueba call center"}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 5: Rechazo por Patrulla Ajena con `patrulla_id` Presente (`403 Forbidden` — `CP-H37-API-11`) y Misión `DESPACHADA` (`409 Conflict` — `CP-H37-API-18`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento desde otra patrulla"}'

curl -s -i -X PATCH "http://localhost:3099/api/incidentes/dd7db71e-e878-4b58-a115-a848dc88bb38/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento antes de aceptar mision"}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No está autorizado para reclasificar la tipología de un incidente asignado a otra patrulla verificadora."}
```
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}
```

#### Caso 6: Validaciones de Entrada Zod y Not Found (`400` y `404` — `CP-H37-API-12` a `CP-H37-API-17`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"     "}'

curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"49999999-9999-4999-8999-999999999999","justificacion":"Prueba tipo inexistente"}'
```

**Respuestas HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos para la reclasificación de tipología.","errors":[{"campo":"justificacion","mensaje":"La justificación debe contener al menos 5 caracteres."}]}
```
```http
HTTP/1.1 404 Not Found
content-type: application/json

{"message":"El tipo de incidente seleccionado no existe en el catálogo oficial."}
```

#### Caso 7: Evidencia de Bypass sobre Misión `ATENCION_CUADRILLA` (`patrulla_id = NULL`, `INC-2026-0004` en `EN_ATENCION`) (`BUG-H37-API-02`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/a1000000-0000-4000-8000-000000000004/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Prueba QA: patrullero ajeno mutando incidente EN_ATENCION con mision ATENCION_CUADRILLA."}'
```

**Respuesta HTTP/JSON Obtenida (Defecto):**
```http
HTTP/1.1 200 OK
content-type: application/json

{
  "message": "Tipología del incidente reclasificada exitosamente en terreno.",
  "data": {
    "incidente": {
      "id": "a1000000-0000-4000-8000-000000000004",
      "codigo": "INC-2026-0004",
      "tipoIncidenteId": "40000000-0000-4000-8000-000000000001",
      "tipoAfectacion": "Inundación",
      "estado": "EN_ATENCION",
      "prioridad": "ALTA",
      "actualizadoEn": "2026-11-17T03:23:23.631Z"
    },
    "hito": {
      "id": "81a01529-618e-475f-93e0-a0568e64c1b4",
      "misionId": "d1000000-0000-4000-8000-000000000002",
      "hito": "TIPOLOGIA_RECLASIFICADA",
      "descripcion": "Tipología reclasificada en terreno a: Inundación. Justificación: Prueba QA: patrullero ajeno mutando incidente EN_ATENCION con mision ATENCION_CUADRILLA.",
      "registradoPorId": "d1000000-0000-4000-8000-000000000001",
      "creadoEn": "2026-11-17T03:23:23.631Z"
    }
  }
}
```

#### Caso 8: Flujo Exitoso de Reclasificación, Bitácora en `GET /api/misiones/{id}` y Contradicción Kanban vs HU-21 (`CP-H37-API-03`, `CP-H37-API-06`, `CP-H37-API-07`, `BUG-H37-API-03`)
```bash
curl -s -i -X PATCH "http://localhost:3099/api/incidentes/eeee0000-0000-4000-8000-000000000010/tipologia" \
  -H "Authorization: Bearer $TOKEN_PEDRO" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Se constata inundación por desborde fluvial, no caída de árbol."}'
```

**Respuesta HTTP/JSON (`PATCH /api/incidentes/{id}/tipologia`):**
```json
{
  "message": "Tipología del incidente reclasificada exitosamente en terreno.",
  "data": {
    "incidente": {
      "id": "eeee0000-0000-4000-8000-000000000010",
      "codigo": "INC-QA-H37-01",
      "tipoIncidenteId": "40000000-0000-4000-8000-000000000001",
      "tipoAfectacion": "Inundación",
      "estado": "VERIFICANDO",
      "prioridad": "MEDIA",
      "actualizadoEn": "2026-11-17T03:23:23.247Z"
    },
    "hito": {
      "id": "4628c40c-1249-449d-8dae-f8fda7b1dc31",
      "misionId": "eeee0000-0000-4000-8000-000000000020",
      "hito": "TIPOLOGIA_RECLASIFICADA",
      "descripcion": "Tipología reclasificada en terreno a: Inundación. Justificación: Se constata inundación por desborde fluvial, no caída de árbol.",
      "registradoPorId": "d1000000-0000-4000-8000-000000000001",
      "creadoEn": "2026-11-17T03:23:23.247Z"
    }
  }
}
```

**Evidencia WebSocket (`sala:encargados`) y Contradicción Kanban vs HU-21 (`BUG-H37-API-03`):**
```text
42["incidente:actualizado",{"evento":"incidente:actualizado","datos":{"id":"eeee0000-0000-4000-8000-000000000010","codigo":"INC-QA-H37-01","nuevoEstado":"VERIFICANDO","prioridad":"MEDIA","tipoIncidenteId":"40000000-0000-4000-8000-000000000001","tipoAfectacion":"Inundación","justificacion":"Se constata inundación por desborde fluvial, no caída de árbol.","actualizadoEn":"2026-11-17T03:23:23.247Z"},"emitidoEn":"2026-11-17T03:23:23.266Z"}]

GET /api/incidentes?busqueda=INC-QA-H37-01 -> verificado: true, reclasificadoEnTerreno: true
GET /api/incidentes/eeee0000-0000-4000-8000-000000000010 -> verificado: true, reclasificadoEnTerreno: true
POST /api/misiones -> HTTP 409 {"statusCode":409,"error":"Conflict","codigo":"VERIFICACION_EN_CURSO","message":"No es posible despachar una cuadrilla operativa: la patrulla verificadora asignada ('Patrulla Rápida Las Ánimas') aún no ha finalizado la evaluación técnica en terreno.",...}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La pantalla de evaluación en la PWA debe proveer un selector desplegable con las categorías oficiales de incidentes. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de componente selector en el repositorio `sgrai-pwa`. |
| **CA-2:** El selector debe alimentarse del catálogo oficial `GET /api/incidentes/tipos` (ej. Inundación, Caída de árbol, Derrumbe, Incendio estructural, etc.). | `CP-H37-API-01`, `CP-H37-API-02`, `BUG-H37-API-05` | 🟡 **PARCIAL (`BUG-H37-API-05`)** | `GET /api/incidentes/tipos?catalogo=true` y `?detallado=true` retornan los 11 tipos activos de `tipo_incidente` con sus UUIDs, pero OpenAPI omite los parámetros `catalogo`/`detallado` y el esquema `ListarTiposIncidenteResponse`, y el modo simple incluye `"Incendio"` sin correspondencia en `tipo_incidente`. |
| **CA-3:** La patrulla debe poder seleccionar el tipo que mejor describe la situación real constatada en terreno. | `CP-H37-API-03`, `CP-H37-API-04`, `CP-H37-API-05`, `CP-H37-API-16`, `BUG-H37-API-02` | 🔴 **CON DEFECTO (`BUG-H37-API-02`)** | Valida existencia y estado `activo = true` en `tipo_incidente`, pero omite filtrar `tipo_mision = 'VERIFICACION'`, permite operar con patrullas desactivadas o `patrulla_id = null`, y no bloquea estados `EN_ATENCION`/`RESUELTO`/`NO_ABORDABLE`. |
| **CA-4:** Al guardar, el sistema debe actualizar el campo `incidente.tipo_incidente_id` en la base de datos. | `CP-H37-API-03`, `CP-H37-API-04`, `CP-H37-API-20`, `BUG-H37-API-02`, `BUG-H37-API-03` | 🔴 **CON DEFECTO (`BUG-H37-API-02`, `BUG-H37-API-03`)** | Actualiza atómicamente `tipo_incidente_id` y `tipo_afectacion` junto a la inserción en `mision_hito`, pero carece de `.forUpdate()`, permite mutar incidentes cerrados/en atención (`BUG-H37-API-02`) y corrompe el indicador `verificado` / `reclasificadoEnTerreno` en Kanban (`BUG-H37-API-03`). |
| **CA-5:** Se debe registrar automáticamente un hito en `mision_hito` indicando: `'Tipología reclasificada en terreno a: [Nombre del Tipo]'`. | `CP-H37-API-03`, `CP-H37-API-06` | 🟢 **APROBADO** | Persiste el hito `TIPOLOGIA_RECLASIFICADA` con la descripción `'Tipología reclasificada en terreno a: [Nombre]. Justificación: [Texto]'` y lo expone en `GET /api/misiones/{id}`. |
| **CA-6:** El sistema debe emitir la notificación WebSocket `incidente:actualizado` al Centro de Mando para actualizar la tarjeta en el tablero Kanban. | `CP-H37-API-07`, `CP-H37-API-19`, `BUG-H37-API-05` | 🟡 **PARCIAL (`BUG-H37-API-05`)** | Emite `incidente:actualizado` hacia `sala:encargados`, `encargado` y `mapa` por Redis Pub/Sub con resiliencia `try/catch`, pero en modo en memoria ejecuta además un broadcast global duplicado `(ioInstance as any).emit`. |
| **CA-7:** El endpoint de actualización debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H37-API-08`, `CP-H37-API-09`, `CP-H37-API-10`, `CP-H37-API-11`, `BUG-H37-API-01`, `BUG-H37-API-02`, `BUG-H37-API-04` | 🔴 **CON DEFECTO (`BUG-H37-API-01`, `BUG-H37-API-02`, `BUG-H37-API-04`)** | Exige `misiones:terreno:verificar` con JWT válido, pero permite suplantación sin JWT vía `x-user-id` (`BUG-H37-API-01`), omite control de pertenencia cuando `patrulla_id` es `null` (`BUG-H37-API-02`) y arrastra colisión `052_` vs `035_` en migraciones Kysely (`BUG-H37-API-04`). |

