# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-43 — Adjuntar Evidencia Multimedia a Incidentes y Misiones desde Terreno (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Evidencia / Operaciones de Terreno e Incidentes (`sgrai-api` — `POST /api/evidencia/adjuntos` y `GET /uploads/evidencia/[filename]`).  
> **Historia de Usuario:** HU-43 — *"Como Delegado de cuadrilla Quiero adjuntar fotografías, videos y documentos técnicos al incidente y su misión desde el dispositivo móvil. Para respaldar las condiciones del lugar, documentar los trabajos ejecutados y contar con evidencia técnica para la auditoría operativa."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16.3.4 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Sharp 0.35.5 + FFmpeg + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h43-adjuntar-evidencia-multimedia`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)`  
> * `feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)`  
> * `chore(docker): configurar ffmpeg y volumen persistente uploads_data para evidencias (HU-43)`  
> * `test(evidencia): agregar pruebas unitarias para migracion 058, almacenamiento, servicio y rutas (HU-43)`  
> * `docs(api): registrar endpoint POST /api/evidencia/adjuntos en OpenAPI y documentar modulo de evidencia (HU-43)`  
> * `merge: integrar H39 (informe tecnico de verificacion y cierre) en feature/h43-adjuntar-evidencia-multimedia`  
>  
> **Fecha de Auditoría QA:** 24/11/2026 14:26.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW (`Changes Requested`) — 6 DEFECTOS REALES ABIERTOS PENDIENTES DE CORRECCIÓN**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la auditoría integral sobre la rama `feature/h43-adjuntar-evidencia-multimedia` mediante inspección estática de código fuente, verificación de seguridad RBAC/JWT y reglas del Sistema de Comando de Incidentes (ICS), validación del pipeline de migraciones Kysely (`npm run db:migrate`), compilación de producción (`npx tsc --noEmit` y `npm run build`), análisis estático ESLint (`npm run lint`), revisión del contrato OpenAPI 3.0, suscripción al canal Redis Pub/Sub (`sgrai:socket-events`), ejecución de la suite Vitest y pruebas funcionales/adversariales en vivo contra PostgreSQL 16 + Redis 7 + FFmpeg + Sharp, se detectaron **6 defectos reales** (**2 de severidad CRÍTICA**, **3 de severidad ALTA** y **1 de severidad MEDIA**) que impiden aprobar el Pull Request en su estado actual.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba Diseñados y Evaluados** | **26** | 6 defectos abiertos (`BUG-H43-API-01` a `06`) + 20 casos aprobados de autenticación, validación, optimización, streaming y tiempo real (`CP-H43-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Flujos positivos de carga JPEG/PNG/WebP/PDF/MP4, deduplicación SHA-256, `206 Partial Content`, path traversal, RBAC base y emisión Redis |
| **Defectos Abiertos (Failed / Open)** | **6** | `BUG-H43-API-01` a `BUG-H43-API-06` detallados en la Sección 2 |
| **Casos Bloqueados (Blocked)** | **0** | Entorno completo operativo (PostgreSQL 16, Redis 7, FFmpeg y Next.js 16.3.4) |
| **Tasa de Aprobación Actual (% Pass)** | **76.9%** | Se requiere 100.0% de aprobación en Re-Test para certificar el merge a `develop` |
| **Suite Directa HU-43 (Vitest)** | 🟢 **16/16 tests pass** | 5 archivos de prueba (`route.test.ts` adjuntos, `route.test.ts` uploads, `058_...test.ts`, `evidencia.service.test.ts`, `evidencia.storage.test.ts`) |
| **Suite Global del Repositorio (`npm test`)** | 🟢 **954/954 tests pass** | 95 archivos de prueba ejecutados en `6.47s` sin fallos |
| **Compilación y Linter (`tsc`, `build`, `lint`)** | 🟢 **0 errores** | `npx tsc --noEmit` y `npm run build` limpios; `npm run lint` con `0 errors` (`1 warning` preexistente fuera del módulo `evidencia`) |
| **Sincronización con rama `develop`** | 🔴 **Desfasada (65 commits detrás)** | Faltan migraciones `035_`, `041_`, `051_` y `072_` de `develop`; colisión y sobrescritura de `reportes:crear` entre migración `058` y `056` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H43-API-01`: Omisión de Exposición de Adjuntos Asociados a `incidente_id` en Centro de Mando (`GET /api/incidentes/{id}` y `GET /api/misiones/{id}`), Ausencia de `GET /api/evidencia/adjuntos` e Inconsistencia Relacional con `reporte_terreno_id`
* **Severidad:** **CRÍTICA** (Incumplimiento directo de Criterios de Aceptación CA-4 y CA-6 e Integridad Relacional en Base de Datos).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/incidentes/incidente-kanban.repository.ts` (Líneas 589–622)
  * `src/modules/incidentes/incidente-kanban.service.ts` (Líneas 364–436)
  * `src/modules/incidentes/incidente-kanban.schema.ts` (Líneas 186–339)
  * `src/modules/misiones/mision.repository.ts` (Líneas 374–404)
  * `src/modules/evidencia/evidencia.repository.ts` (Líneas 28–93)
  * `src/app/api/evidencia/adjuntos/route.ts` (exporta únicamente `POST`)
* **Descripción Técnica:**
  1. El Criterio de Aceptación CA-4 exige persistir los metadatos asociando el archivo a `reporte_terreno_id` o `incidente_id`, y el CA-6 exige que los adjuntos se visualicen en la galería de evidencia del Centro de Mando. Sin embargo, tanto `obtenerDetalleIncidentePorIdRepo` (`GET /api/incidentes/{id}`) como `obtenerMisionDetallePorIdRepo` (`GET /api/misiones/{id}`) consultan exclusivamente `adjunto` filtrando por `reporte_terreno_id IN (...)`. Ninguno de los dos endpoints consulta las filas de `adjunto` vinculadas directamente por `incidente_id`, ni existe un endpoint `GET /api/evidencia/adjuntos` para consultar la galería por incidente o reporte. Además, el actor principal de HU-43 (`DELEGADO_CUADRILLA`) no dispone en esta rama de endpoint propio para emitir un `reporte_terreno`, por lo que sus evidencias asociadas a `incidente_id` quedan completamente invisibles al consultar el Centro de Mando.
  2. Cuando `POST /api/evidencia/adjuntos` recibe únicamente `reporte_terreno_id` (sin `incidente_id`), `insertarAdjuntoRepository` inserta `incidente_id = null` sin resolver el `incidente_id` perteneciente a la misión del reporte (`reporte_terreno -> mision -> incidente_id`), provocando que el evento WebSocket `adjunto:creado` se emita con `"incidenteId": null` (y sin `misionId`), impidiendo al Centro de Mando asociar en tiempo real el archivo a la ficha del incidente abierto.
  3. Si el cliente envía simultáneamente un `reporte_terreno_id` perteneciente a un incidente A (`INC-2026-0003`) y un `incidente_id` de un incidente B distinto (`INC-2026-0006`), `insertarAdjuntoRepository` valida ambos IDs por separado y persiste una relación cruzada corrupta.
* **Pasos para Reproducir:**
  1. Subir un archivo vía `POST /api/evidencia/adjuntos` enviando `incidente_id=a1000000-0000-4000-8000-000000000004` (sin `reporte_terreno_id`).
  2. Consultar `GET /api/incidentes/a1000000-0000-4000-8000-000000000004` y `GET /api/misiones/d1000000-0000-4000-8000-000000000002` con token de `ENCARGADO`.
  3. Subir un segundo archivo enviando únicamente `reporte_terreno_id` (asociado a `MIS-2026-0001` / `INC-2026-0003`) y observar la respuesta JSON y el evento en `sgrai:socket-events`.
  4. Subir un tercer archivo combinando ese `reporte_terreno_id` con `incidente_id=a1000000-0000-4000-8000-000000000006`.
* **Comportamiento Actual:**
  - `GET /api/incidentes/{id}` y `GET /api/misiones/{id}` no devuelven el arreglo de adjuntos del incidente (`reportesEvaluacionTerreno: []`, `reportesTerreno: []`); `GET /api/evidencia/adjuntos` responde `HTTP 405 Method Not Allowed`.
  - Con `reporte_terreno_id` solo, la respuesta HTTP y el evento Redis publican `"incidenteId": null`.
  - Con `reporte_terreno_id` e `incidente_id` de incidentes distintos, responde `HTTP 201 Created` persistiendo la incoherencia relacional.
* **Comportamiento Esperado:**
  - `GET /api/incidentes/{id}` (y opcionalmente `GET /api/misiones/{id}` y/o `GET /api/evidencia/adjuntos?incidente_id=...`) debe exponer en el objeto principal los adjuntos vinculados directamente a `incidente_id` además de los adjuntos anidados en cada `reporte_terreno`.
  - Al recibir `reporte_terreno_id`, `insertarAdjuntoRepository` debe obtener `mision.incidente_id` mediante `JOIN` con `mision`: si también se envía `incidente_id` y difiere del de la misión, debe rechazar con `400 Bad Request` / `409 Conflict`; si `incidente_id` se omite, debe autocompletarse con el `incidente_id` de la misión e incluirse tanto en la respuesta HTTP como en el evento `adjunto:creado` (junto con `misionId` cuando corresponda).
* **Sugerencia Técnica de Corrección:**
  - En `obtenerDetalleIncidentePorIdRepo` y `IncidenteDetalleSchema`, consultar `.selectFrom("adjunto").where("incidente_id", "=", id)` (ordenado por `creado_en ASC`) y exponer el arreglo `adjuntos` en `IncidenteDetalle` (normalizando `/` inicial en `url`); replicar en `obtenerMisionDetallePorIdRepo` o habilitar `GET /api/evidencia/adjuntos` protegido por RBAC.
  - En `insertarAdjuntoRepository`, consultar `reporte_terreno` con `innerJoin("mision", "mision.id", "reporte_terreno.mision_id")` para validar coherencia con `incidente_id` y derivar automáticamente `incidente_id` y `mision_id`.

---

### `BUG-H43-API-02`: Bypass de Autenticación JWT mediante Cabecera Plana `x-user-id`, Ausencia de Autorización Horizontal (Pertenencia a Misión) y Omisión de `security` en OpenAPI
* **Severidad:** **CRÍTICA** (Brecha de Seguridad de Autenticación, Control de Acceso Horizontal e Invariantes Operativas ICS).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/app/api/evidencia/adjuntos/route.ts` (Líneas 30–34)
  * `src/modules/evidencia/evidencia.repository.ts` (Líneas 28–58)
  * `src/lib/openapi/index.ts` (Líneas 2770–2830)
* **Descripción Técnica:**
  1. En `src/app/api/evidencia/adjuntos/route.ts:30-32`, el controlador implementa un fallback hacia la cabecera no firmada `x-user-id`:
     ```ts
     const tokenUserId = await extraerUsuarioId(request);
     const headerUserId = request.headers.get("x-user-id");
     const usuarioId = tokenUserId || headerUserId;
     ```
     Cualquier cliente externo no autenticado puede omitir `Authorization: Bearer <token>` y enviar `-H "x-user-id: 00000000-0000-4000-8000-000000000001"` (Administrador) o el UUID de cualquier funcionario de terreno para suplantar su identidad y subir archivos arbitrarios sin validar firma JWT.
  2. A diferencia de los demás endpoints operativos de terreno (`POST /api/misiones/[id]/aceptar`, `POST /api/misiones/[id]/reporte`, `PATCH /api/incidentes/[id]/prioridad`), `insertarAdjuntoRepository` nunca valida que el usuario autenticado (salvo Administrador) pertenezca a la patrulla (`patrulla_verificadora.usuario_lider_id` / `patrulla_personal`) o cuadrilla (`cuadrilla_personal`) asignada a una misión activa del incidente o del reporte, ni restringe el adjunto cuando el incidente ya está cerrado (`RESUELTO` o `NO_ABORDABLE`).
  3. La definición de `POST /api/evidencia/adjuntos` en `src/lib/openapi/index.ts:2770-2830` omite el bloque `security: [{ BearerAuth: [] }]`.
* **Pasos para Reproducir:**
  1. Enviar `POST /api/evidencia/adjuntos` sin cabecera `Authorization`, enviando `-H "x-user-id: 00000000-0000-4000-8000-000000000001"`.
  2. Enviar `POST /api/evidencia/adjuntos` con JWT de `pedro.patrulla@valdivia.cl` (asignado únicamente a `MIS-2026-0008`) hacia el incidente `a1000000-0000-4000-8000-000000000006` (`INC-2026-0006`, estado `RESUELTO`).
  3. Consultar `GET /openapi.json` en `paths["/api/evidencia/adjuntos"].post`.
* **Comportamiento Actual:**
  - La petición sin JWT pero con `x-user-id` retorna `HTTP 201 Created`.
  - El usuario de patrulla ajena logra adjuntar archivos (`HTTP 201 Created`) a un incidente cerrado en estado `RESUELTO` donde su unidad no participa.
  - OpenAPI no declara `security` en la operación `post` de `/api/evidencia/adjuntos`.
* **Comportamiento Esperado:**
  - Exigir estrictamente token JWT Bearer válido mediante `exigirUsuarioId(request)` sin aceptar `x-user-id`, respondiendo `401 Unauthorized` cuando falte `Authorization: Bearer <token>`.
  - Validar pertenencia operativa de la cuadrilla o patrulla del usuario autenticado (salvo rol `ADMIN`) a una misión vinculada al incidente/reporte y bloquear con `409 Conflict` los envíos sobre incidentes cerrados (`RESUELTO`, `NO_ABORDABLE`), o documentar explícitamente la excepción operativa si aplica a rectificaciones autorizadas.
  - Registrar `security: [{ BearerAuth: [] }]` en `src/lib/openapi/index.ts`.
* **Sugerencia Técnica de Corrección:**
  - Reemplazar las líneas 30–34 de `src/app/api/evidencia/adjuntos/route.ts` por `const usuarioId = await exigirUsuarioId(request); const usuario = await verificarPermiso(usuarioId, PERMISO_CREAR_REPORTES);` y propagar `usuario.id` y `esAdmin` al servicio/repositorio para validar pertenencia e invariantes ICS.

---

### `BUG-H43-API-03`: Truncamiento Silencioso del Cuerpo Multipart a 10 MB por `src/proxy.ts` (`proxyClientMaxBodySize` por Defecto), Devolviendo `400 Bad Request` en Archivos Válidos Cercanos a 10 MB y en Excesos de 10–11 MB o Chunked
* **Severidad:** **ALTA** (Falla Funcional del Límite de 10 MB del Criterio de Aceptación CA-3 en Entorno de Producción/Runtime Next.js 16).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `next.config.ts` (Líneas 3–30, carece de `experimental.proxyClientMaxBodySize`)
  * `src/proxy.ts` (Líneas 30–32, `matcher: ["/api/:path*", "/openapi.json"]`)
  * `src/app/api/evidencia/adjuntos/route.ts` (Líneas 44–64)
* **Descripción Técnica:**
  En Next.js 16.3.4, cuando existe `src/proxy.ts` interceptando `/api/:path*`, el framework almacena en buffer el cuerpo HTTP de la petición antes de pasarla al Route Handler con un límite por defecto de **10 MB** (`experimental.proxyClientMaxBodySize = '10mb'` = `10,485,760` bytes para toda la carga HTTP, incluyendo límites multipart y campos del formulario). Al superarse los 10 MB totales, Next.js trunca silenciosamente el stream del cuerpo y registra la advertencia:
  `Request body exceeded 10MB for /api/evidencia/adjuntos. Only the first 10MB will be available unless configured.`
  En consecuencia:
  1. Un archivo completamente válido cercano al máximo permitido de CA-3 (ej. `10,485,500` bytes < 10 MB) más la sobrecarga de cabeceras multipart (~300 bytes) supera los `10,485,760` bytes del proxy, se trunca en tránsito y `await request.formData()` falla devolviendo `HTTP 400 Bad Request` (`"No se pudo parsear el cuerpo multipart/form-data."`) en lugar de `201 Created`.
  2. Un archivo que excede el límite de 10 MB por menos de 1 MB (ej. `10,485,860` bytes = 10 MB + 100 B) supera la guarda de `content-length > MAX_ADJUNTO_SIZE_BYTES + 1024 * 1024` en `route.ts:48`, es truncado por el proxy y retorna `HTTP 400 Bad Request` en lugar de `HTTP 413 Payload Too Large`.
  3. Cualquier envío `> 10 MB` con `Transfer-Encoding: chunked` (sin `Content-Length`) también se trunca en `400 Bad Request` en lugar de `413 Payload Too Large`.
* **Pasos para Reproducir:**
  1. Generar un PDF válido de `10,485,500` bytes (`<= 10 MB`) y enviarlo por `POST /api/evidencia/adjuntos`.
  2. Generar un PDF de `10,485,860` bytes (`10 MB + 100 B`) y enviarlo por `POST /api/evidencia/adjuntos`.
  3. Enviar un archivo de `12 MB` con `-H "Transfer-Encoding: chunked"`.
* **Comportamiento Actual:** En los tres casos la API responde `HTTP 400 Bad Request` con `{"message":"No se pudo parsear el cuerpo multipart/form-data."}`.
* **Comportamiento Esperado:** El archivo válido de `10,485,500` bytes (`<= 10 MB`) debe aceptarse con `HTTP 201 Created`, y los archivos superiores a `10,485,760` bytes (con o sin `Content-Length`) deben rechazarse con `HTTP 413 Payload Too Large`.
* **Sugerencia Técnica de Corrección:**
  - Configurar `experimental: { proxyClientMaxBodySize: "15mb" }` en `next.config.ts` para permitir el paso íntegro de archivos de hasta 10 MB más sobrecarga multipart y que archivos de 10–14 MB alcancen `validarArchivoEvidencia` retornando `413 Payload Too Large`; adicionalmente, si el tamaño excede el límite en `request.formData()`, capturar la condición de límite adecuadamente.

---

### `BUG-H43-API-04`: Excepción No Controlada `500` en `sharp` ante Imágenes Corruptas, Fuga de Archivos Huérfanos en Disco tras Error `404`/`500`, Falsos Positivos `ftyp` en Magic Bytes y Falta de `try/catch` en Emisión Socket
* **Severidad:** **ALTA** (Estabilidad del Servicio, Integridad de Almacenamiento en Disco y Validación Binaria CA-3).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/modules/evidencia/evidencia.storage.ts` (Líneas 84–101, 168–182, 246–295)
  * `src/modules/evidencia/evidencia.service.ts` (Líneas 21–36, 54–63)
* **Descripción Técnica:**
  1. `detectarMimePorMagicBytes` inspecciona únicamente los primeros bytes de cabecera (`FF D8 FF` para JPEG, `89 50 4E 47...` para PNG, `RIFF....WEBP` para WebP). Si un archivo posee esos magic bytes pero su contenido está corrupto o truncado, `validarArchivoEvidencia` aprueba el archivo y `sharp(buffer)...toBuffer()` lanza una excepción genérica (`Error: Input buffer has corrupt header: VipsJpeg: premature end of JPEG image`), no capturada como error de cliente, provocando un **`500 Internal Server Error`**.
  2. En `subirEvidenciaService` (`evidencia.service.ts:21-36`), se invoca `guardarArchivoEvidencia` escribiendo el archivo en `${UPLOAD_DIR}/evidencia/<sha256>.<ext>` **antes** de que `insertarAdjuntoRepository` verifique en PostgreSQL que el `incidente_id` o `reporte_terreno_id` existan. Ante cualquier `404 Not Found` o fallo de inserción en base de datos, el archivo permanece huérfano indefinidamente en disco.
  3. En `detectarMimePorMagicBytes` (`evidencia.storage.ts:94-101`), cualquier archivo ISO Base Media con box `ftyp` distinto de `qt  ` (como imágenes `.heic` / `.avif` o audio `.m4a`) es aceptado como `video/mp4`; al enviarlo como `video/mp4`, `ffmpeg` falla silenciosamente en el bloque `catch {}` sin registrar el error ni rechazar contenedores inválidos, almacenando un `.mp4` corrupto o no reproducible con `201 Created`. De forma análoga, `1A 45 DF A3` acepta archivos Matroska `.mkv` sin verificar el `DocType` `webm`.
  4. En `evidencia.service.ts:54-63`, `notificarAdjuntoCreado(...)` no está envuelto en `try/catch` (a diferencia del resto de servicios del módulo `misiones`), por lo que una excepción síncrona del emisor revertiría la respuesta HTTP a `500` tras haberse confirmado la escritura en base de datos y disco.
* **Pasos para Reproducir:**
  1. Enviar por `POST /api/evidencia/adjuntos` un archivo de 16 bytes con cabecera JPEG (`FF D8 FF E0...`) y `type=image/jpeg`.
  2. Enviar una imagen válida JPEG contra `incidente_id=99999999-9999-4999-8999-999999999999` y listar el directorio `uploads/evidencia/`.
  3. Enviar un buffer con cabecera `ftypheic` (`24` bytes) declarado como `video/mp4`.
* **Comportamiento Actual:**
  - La imagen corrupta con magic bytes JPEG responde `HTTP 500 Internal Server Error`.
  - Tras el `HTTP 404 Not Found`, el contador de archivos en `uploads/evidencia/` aumenta de 4 a 5 quedando `92ce9ec2c1ac...webp` huérfano en disco.
  - `falso_heic.mp4` responde `HTTP 201 Created` persistiendo un falso MP4.
* **Comportamiento Esperado:**
  - Imágenes corruptas/ilegibles para `sharp` deben lanzar `UnsupportedMediaTypeError` (`415`) o `BadRequestError` (`400`).
  - La existencia de `incidente_id` / `reporte_terreno_id` y la autorización deben validarse **antes** de escribir en disco (y en caso de fallo posterior en BD, eliminar el archivo recién creado si no existía previamente).
  - Validar las marcas `ftyp` permitidas para MP4/QuickTime (ej. `isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V `, `qt  `) y `webm` en EBML, además de envolver `notificarAdjuntoCreado` en `try/catch`.

---

### `BUG-H43-API-05`: Desfase de 65 Commits respecto a `develop`, Divergencia de Migraciones (`052_` vs `035_`/`051_` y Omisión de `041_`/`072_`), y Sobrescritura/Destrucción de `reportes:crear` entre Migración `058` y `056`
* **Severidad:** **ALTA** (Integración Continua, Consistencia del Historial Kysely y Riesgo de Regresión al Mergear).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/lib/db/migrations/058_permiso_reportes_crear_y_adjuntos.ts` (Líneas 42–49, 85–94)
  * `src/lib/db/migrations/052_permiso_misiones_terreno_verificar.ts` (renombrada desde `035_`)
  * `src/lib/db/migrator.ts` (Líneas 84–90)
  * `package.json` (script `build`)
* **Descripción Técnica:**
  1. La rama `feature/h43-adjuntar-evidencia-multimedia` se encuentra **65 commits por detrás de `develop`** (`git rev-list --count HEAD..develop` = `65`). En `develop` ya fueron integradas las migraciones `035_permiso_misiones_terreno_verificar.ts`, `041_recuperacion_recurso_mision_id.ts`, `051_permiso_misiones_terreno_verificar.ts` y `072_evento_atp_base.ts`, además de la unificación de contratos OpenAPI y el fix de limpieza `.next/dev` en `npm run build`.
  2. La rama renombró `035_permiso_misiones_terreno_verificar.ts` a `052_...` e incorporó las migraciones `053_` a `057_` de ramas previas sin integrar `develop`, provocando que `migrator.ts` elimine entradas existentes en `kysely_migration` o altere la correlatividad respecto a `develop`.
  3. La migración `058_permiso_reportes_crear_y_adjuntos.ts` entra en conflicto funcional con `056_reporte_verificacion_cierre_y_no_abordable.ts`: en `up()`, si `reportes:crear` ya fue creado por `056` (módulo `'Misiones'`), `058` sobrescribe `nombre` y `modulo` a `'Evidencia'`; y en `down()`, ejecuta `DELETE FROM permiso WHERE codigo = 'reportes:crear'`, destruyendo el permiso del que depende HU-39 (`POST /api/misiones/[id]/reporte`) si se revierte `058`.
* **Pasos para Reproducir:**
  1. Ejecutar `git rev-list --count HEAD..develop` y comparar `src/lib/db/migrations/` entre `develop` y `HEAD`.
  2. Ejecutar `npm run db:migrate` y consultar `SELECT id, codigo, nombre, modulo FROM permiso WHERE codigo = 'reportes:crear';` antes y después de la migración `058`.
* **Comportamiento Actual:** Desfase de 65 commits respecto a `develop`, ausencia de migraciones `041_`/`051_`/`072_`, sobrescritura del registro `reportes:crear` de `056` al aplicar `058` y eliminación incondicional del permiso en `058.down()`.
* **Comportamiento Esperado:** Sincronizar la rama con `develop`, alinear los correlativos de migración sin colisionar ni eliminar migraciones ya presentes en `develop`, evitar que `058.down()` elimine `reportes:crear` si ya existía previamente (o separar la migración de columna `sha256_hash` del sembrado idempotente no destructivo de `reportes:crear`), y mantener el script `build` sincronizado con `develop`.

---

### `BUG-H43-API-06`: Ausencia de Cabeceras CORS y `X-Content-Type-Options: nosniff` en `GET /uploads/evidencia/[filename]` y Falta de Cobertura OpenAPI en Pruebas de Contrato
* **Severidad:** **MEDIA** (Interoperabilidad Cross-Origin con `sgrai-web`/`sgrai-pwa`, Endurecimiento HTTP y Cobertura de Contrato).
* **Estado Actual:** 🔴 **ABIERTO**.
* **Archivos Afectados:**
  * `src/app/uploads/evidencia/[filename]/route.ts` (Líneas 81–105)
  * `next.config.ts` (Líneas 5–29) y `src/proxy.ts` (Líneas 30–32)
  * `src/app/openapi.json/__tests__/route.test.ts`
  * `src/lib/openapi/index.ts` (Líneas 2770–2830)
* **Descripción Técnica:**
  1. Tanto `next.config.ts` como `src/proxy.ts` aplican cabeceras CORS únicamente sobre `/api/:path*` y `/openapi.json`. Al solicitar `GET /uploads/evidencia/[filename]` con cabecera `Origin: http://localhost:3000` (desde `sgrai-web` o `sgrai-pwa` vía `fetch()`, visor PDF o Service Worker), la respuesta `200 OK` / `206 Partial Content` omite `Access-Control-Allow-Origin`, provocando bloqueo CORS en el navegador fuera de reverse proxy unificado, además de omitir `X-Content-Type-Options: nosniff`.
  2. La suite `src/app/openapi.json/__tests__/route.test.ts` no contiene aserciones para `POST /api/evidencia/adjuntos` ni para `AdjuntoCreadoResponse`, ni `src/lib/openapi/index.ts` documenta la ruta `GET /uploads/evidencia/{filename}`.
* **Pasos para Reproducir:**
  1. Ejecutar `curl -s -I -H "Origin: http://localhost:3000" "http://localhost:3001/uploads/evidencia/<archivo>.webp"`.
  2. Revisar `src/app/openapi.json/__tests__/route.test.ts` y `GET /openapi.json`.
* **Comportamiento Actual:** La respuesta de `/uploads/evidencia/<archivo>` carece de cabeceras `Access-Control-Allow-Origin` y `X-Content-Type-Options: nosniff`; `GET /uploads/evidencia/{filename}` no figura en `openapi.json`.
* **Comportamiento Esperado:** Incluir soporte CORS (`Access-Control-Allow-Origin` y manejo de `OPTIONS` si corresponde en `/uploads/:path*`) y `X-Content-Type-Options: nosniff` en `GET /uploads/evidencia/[filename]`, y cubrir `/api/evidencia/adjuntos` en `src/app/openapi.json/__tests__/route.test.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H43-API-01` | Omisión de adjuntos asociados a `incidente_id` en Centro de Mando (`GET /api/incidentes/{id}` y `GET /api/misiones/{id}`), ausencia de `GET /api/evidencia/adjuntos` e incoherencia con `reporte_terreno_id` | Integración / Contrato CA-4 y CA-6 | Repositorio / API | Crítica | Evidencia subida vía `POST /api/evidencia/adjuntos` con `incidente_id` y prueba con `reporte_terreno_id` solo y cruzado | `GET /api/incidentes/a1000000-0000-4000-8000-000000000004`, `GET /api/misiones/d1000000-0000-4000-8000-000000000002`, `GET /api/evidencia/adjuntos` y `POST` con `reporte_terreno_id` solo/cruzado | Centro de Mando expone adjuntos vinculados al incidente; `reporte_terreno_id` resuelve `incidenteId` para `adjunto:creado` y rechaza cruce con otro incidente | `GET /api/incidentes/{id}` y `GET /api/misiones/{id}` omiten los adjuntos del incidente; `GET /api/evidencia/adjuntos` da `405`; `reporte_terreno_id` solo emite `incidenteId: null` y acepta cruce inválido | ABIERTO | 24/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-API-02` | Bypass de autenticación JWT mediante cabecera plana `x-user-id`, ausencia de autorización horizontal de misión/unidad e invariantes ICS, y falta de `security` en OpenAPI | Seguridad / Auth / RBAC | Route / Repo / OpenAPI | Crítica | Petición sin `Authorization: Bearer` usando `x-user-id`, usuario de otra patrulla sobre incidente `RESUELTO` y consulta a `openapi.json` | `POST /api/evidencia/adjuntos` con `-H "x-user-id: 00000000-0000-4000-8000-000000000001"` y `POST` con JWT de `pedro.patrulla@valdivia.cl` sobre `a1000000-...0006` (`RESUELTO`) | `401 Unauthorized` sin JWT válido; `403`/`409` ante unidad ajena o incidente cerrado; `BearerAuth` declarado en OpenAPI | Acepta `x-user-id` con `201 Created`; patrulla ajena adjunta archivo a incidente `RESUELTO` (`201 Created`); OpenAPI omite `security` | ABIERTO | 24/11/2026 14:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-API-03` | Truncamiento silencioso del cuerpo multipart a 10 MB por `src/proxy.ts` (`proxyClientMaxBodySize`), retornando `400` en archivos válidos de 9.999 MB y en excesos de 10–11 MB o chunked | Límite / Middleware Next.js 16 CA-3 | Proxy / Route | Alta | Servidor Next.js 16.3.4 activo con `src/proxy.ts` en `/api/:path*` y archivos de 10,485,500 B y 10,485,860 B | `POST /api/evidencia/adjuntos` con `casi_10mb.pdf` (10,485,500 B), `grande_10mb.pdf` (10,485,860 B) y `grande_12mb.pdf` con `Transfer-Encoding: chunked` | `201 Created` para 10,485,500 B (`<= 10 MB`) y `413 Payload Too Large` para archivos `> 10 MB` (con o sin `Content-Length`) | El proxy trunca el stream a 10 MB y los tres casos retornan `HTTP 400 Bad Request` (`No se pudo parsear el cuerpo multipart/form-data.`) | ABIERTO | 24/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-API-04` | Error `500` no controlado en `sharp` por imagen corrupta, fuga de archivos huérfanos en disco tras `404`, falsos positivos `ftyp` (HEIC como MP4) y falta de `try/catch` en Socket | Robustez / Almacenamiento CA-3 y CA-4 | Storage / Service | Alta | Imagen JPEG truncada `corrupto.jpg` (16 B), `incidente_id` inexistente `99999999-...` y `falso_heic.mp4` (`ftypheic`) | `POST /api/evidencia/adjuntos` con `corrupto.jpg`, `foto_orphan.jpg` hacia `99999999-...` y `falso_heic.mp4` como `video/mp4` | `400`/`415` para JPEG corrupto y HEIC; sin archivos huérfanos en `uploads/evidencia/` tras `404`; emisión socket tolerante a fallos | JPEG corrupto lanza error en `sharp` devolviendo `HTTP 500`; tras `404` queda archivo `.webp` huérfano en disco; `falso_heic.mp4` responde `201 Created` | ABIERTO | 24/11/2026 14:23 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-API-05` | Desfase de 65 commits con `develop`, divergencia de migraciones (`052_` vs `035_`/`051_` y omisión `041_`/`072_`), sobrescritura/borrado de `reportes:crear` entre `058` y `056` | Integración / Base de Datos | Git / Migraciones | Alta | Comparación entre `feature/h43-adjuntar-evidencia-multimedia` y `develop` y ejecución de `npm run db:migrate` | `git rev-list --count HEAD..develop`, diff de `src/lib/db/migrations/` y tabla `permiso` post-`058` | Rama al día con `develop`, secuencia de migraciones consistente y `058` sin sobrescribir ni borrar en `down()` el permiso de `056` | 65 commits de desfase; faltan `041_`/`051_`/`072_`; `058` sobrescribe `modulo='Evidencia'` en registro `...0039` de `056` y `down()` lo elimina | ABIERTO | 24/11/2026 14:16 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-API-06` | Ausencia de cabeceras CORS y `nosniff` en `GET /uploads/evidencia/[filename]` y falta de cobertura de `/api/evidencia/adjuntos` en tests OpenAPI | Interoperabilidad / Seguridad HTTP CA-6 | Route / Config / Test | Media | Archivo de evidencia servido en `/uploads/evidencia/` y consulta desde origen distinto (`http://localhost:3000`) | `curl -I -H "Origin: http://localhost:3000" http://localhost:3001/uploads/evidencia/<hash>.webp` y `route.test.ts` de OpenAPI | Cabeceras `Access-Control-Allow-Origin` y `X-Content-Type-Options: nosniff` presentes y ruta verificada en test OpenAPI | Respuesta `200 OK` omite `Access-Control-Allow-Origin` y `nosniff`; `openapi.json/__tests__/route.test.ts` no valida `/api/evidencia/adjuntos` | ABIERTO | 24/11/2026 14:24 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H43-API-01` | Rechazo de petición `POST /api/evidencia/adjuntos` sin credenciales de autenticación (`401 Unauthorized`) | Seguridad / Auth | Route Handler | Crítica | Servidor activo; petición sin cabecera `Authorization` ni `x-user-id` | `POST /api/evidencia/adjuntos` con `informe.pdf` e `incidente_id=a1000000-0000-4000-8000-000000000004` sin headers auth | `HTTP 401 Unauthorized` con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | `HTTP 401 Unauthorized` con mensaje exacto esperado | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-02` | Rechazo RBAC para usuario autenticado sin permiso `reportes:crear` (`403 Forbidden` — CA-7) | Seguridad / RBAC | Route / Auth | Crítica | Usuario `callcenter@valdivia.cl` (`CALL_CENTER`) autenticado vía JWT | `POST /api/evidencia/adjuntos` con `Authorization: Bearer <TOKEN_CALLCENTER>` y `informe.pdf` | `HTTP 403 Forbidden` indicando ausencia del permiso `reportes:crear` | `HTTP 403 Forbidden`: `{"message":"No cuenta con el permiso requerido: reportes:crear"}` | APROBADO | 24/11/2026 14:23 | - | feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43) |
| `CP-H43-API-03` | Verificación de asignación del permiso `reportes:crear` a `DELEGADO_CUADRILLA`, `PATRULLA_VERIFICADORA` y `ADMIN` (CA-7) | Seguridad / RBAC | BD / Endpoint | Alta | Migración `058` ejecutada y usuarios sembrados en PostgreSQL | `GET /api/seguridad/usuario-activo` con JWT de `supervisor@valdivia.cl` y consulta SQL a `rol_permiso` | Los 3 roles poseen `reportes:crear` en `rol_permiso` y en el perfil activo | `GET /api/seguridad/usuario-activo` retorna `rol: 'DELEGADO_CUADRILLA'` y `reportes:crear` incluido; 3 filas en `rol_permiso` | APROBADO | 24/11/2026 14:25 | - | feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43) |
| `CP-H43-API-04` | Rechazo de petición sin formato `multipart/form-data` (`400 Bad Request`) | Validación / Contrato | Route Handler | Media | Usuario autorizado con JWT de `DELEGADO_CUADRILLA` | `POST /api/evidencia/adjuntos` con `-H "Content-Type: application/json" -d '{}'` | `HTTP 400 Bad Request` indicando que debe enviarse como `multipart/form-data` | `HTTP 400 Bad Request`: `{"message":"La solicitud debe enviarse en formato multipart/form-data."}` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-05` | Rechazo de petición `multipart/form-data` sin campo binario `file` (`400 Bad Request`) | Validación / Multipart | Route Handler | Media | Usuario autorizado con JWT de `DELEGADO_CUADRILLA` | `POST /api/evidencia/adjuntos` enviando únicamente `-F "incidente_id=a1000000-0000-4000-8000-000000000004"` | `HTTP 400 Bad Request` solicitando el campo `file` | `HTTP 400 Bad Request`: `{"message":"Debe adjuntar un archivo en el campo 'file'."}` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-06` | Rechazo de archivo vacío de `0` bytes (`400 Bad Request`) | Validación / Límite | Storage / Route | Media | Archivo `vacio.jpg` de `0` bytes | `POST /api/evidencia/adjuntos` con `vacio.jpg;type=image/jpeg` e `incidente_id` válido | `HTTP 400 Bad Request` indicando que el archivo está vacío | `HTTP 400 Bad Request`: `{"message":"El archivo proporcionado está vacío."}` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-07` | Rechazo cuando se omiten ambos identificadores de asociación `incidente_id` y `reporte_terreno_id` (`400 Bad Request` — CA-4) | Validación / Zod | Schema / Route | Alta | Archivo `informe.pdf` válido y usuario autorizado | `POST /api/evidencia/adjuntos` con `-F "file=@informe.pdf;type=application/pdf"` sin IDs | `HTTP 400 Bad Request` exigiendo al menos `incidente_id` o `reporte_terreno_id` | `HTTP 400 Bad Request` con error en campo `asociacion` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-08` | Rechazo por formato UUID inválido en `incidente_id` o `reporte_terreno_id` (`400 Bad Request`) | Validación / Zod | Schema / Route | Media | Archivo válido y usuario autorizado | `POST /api/evidencia/adjuntos` con `incidente_id=no-es-uuid` | `HTTP 400 Bad Request` detallando error en campo `incidente_id` | `HTTP 400 Bad Request` con `errors[0].campo: "incidente_id"` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-09` | Rechazo de archivo superior a `11 MB` con cabecera `Content-Length` (`413 Payload Too Large` — CA-3) | Validación / Límite | Route Handler | Alta | Archivo `grande_12mb.pdf` de `12,582,912` bytes | `POST /api/evidencia/adjuntos` con `grande_12mb.pdf;type=application/pdf` e `incidente_id` | `HTTP 413 Payload Too Large` indicando límite máximo de 10 MB | `HTTP 413 Payload Too Large`: `{"message":"El archivo excede el tamaño máximo permitido de 10 MB."}` | APROBADO | 24/11/2026 14:24 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-10` | Rechazo de tipo MIME no autorizado en lista blanca (`application/x-msdownload` — CA-3) | Seguridad / Validación | Storage / Route | Crítica | Archivo `malware.exe` con cabecera `MZ` | `POST /api/evidencia/adjuntos` con `malware.exe;type=application/x-msdownload` e `incidente_id` | `HTTP 415 Unsupported Media Type` rechazando el archivo | `HTTP 415 Unsupported Media Type` con listado de tipos permitidos | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-11` | Rechazo de suplantación de extensión/MIME mediante inspección binaria de magic bytes (`415 Unsupported Media Type` — CA-3) | Seguridad / Magic Bytes | Storage / Route | Crítica | Archivo `informe.pdf` (`%PDF-1.4`) declarado maliciosamente como `image/jpeg` | `POST /api/evidencia/adjuntos` con `informe.pdf;type=image/jpeg` e `incidente_id` | `HTTP 415 Unsupported Media Type` detectando discrepancia entre `application/pdf` real y `image/jpeg` declarado | `HTTP 415 Unsupported Media Type`: `{"message":"El contenido binario del archivo (application/pdf) no coincide con el tipo declarado (image/jpeg)."}` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-12` | Rechazo HTTP `404 Not Found` cuando `incidente_id` o `reporte_terreno_id` no existe en PostgreSQL | Funcional / Negativa | Repository / Route | Alta | UUID inexistente `99999999-9999-4999-8999-999999999999` | `POST /api/evidencia/adjuntos` con `foto_orphan.jpg` e `incidente_id=99999999-9999-4999-8999-999999999999` | `HTTP 404 Not Found` indicando inexistencia del incidente | `HTTP 404 Not Found`: `{"message":"No existe ningún incidente con el identificador 99999999-9999-4999-8999-999999999999."}` | APROBADO | 24/11/2026 14:24 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-13` | Carga exitosa, redimensionamiento (`<= 1920px`) y compresión WebP de imagen `image/png` (`201 Created` — CA-3 y CA-4) | Funcional / Optimización | End-to-End API | Crítica | Imagen `foto_valida.png` (`2200x1400`, `11,226` B) y JWT de `DELEGADO_CUADRILLA` | `POST /api/evidencia/adjuntos` con `foto_valida.png;type=image/png` e `incidente_id=a1000000-0000-4000-8000-000000000004` | `HTTP 201 Created`, conversión a `image/webp` con reducción de peso, hash SHA-256 y fila en `adjunto` | `HTTP 201 Created` con `tipoMime: "image/webp"`, `tamanoBytes: 4292`, `url: "/uploads/evidencia/e4148a...webp"` | APROBADO | 24/11/2026 14:24 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-14` | Carga exitosa y optimización a WebP de imágenes `image/jpeg` e `image/webp` (`201 Created` — CA-3 y CA-4) | Funcional / Positiva | End-to-End API | Alta | `foto_orphan.jpg` (`3,120` B) y `foto_webp.webp` (`628` B) | `POST /api/evidencia/adjuntos` con `image/jpeg` e `image/webp` hacia `incidente_id=a1000000-0000-4000-8000-000000000004` | `HTTP 201 Created` con `tipoMime: "image/webp"` y registro persistido en tabla `adjunto` | `HTTP 201 Created` (`tamanoBytes: 952` para JPEG y `628` para WebP) persistidos en `adjunto` | APROBADO | 24/11/2026 14:25 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-15` | Carga exitosa de documento técnico `application/pdf` y persistencia en tabla `adjunto` (`201 Created` — CA-3 y CA-4) | Funcional / Positiva | End-to-End API | Alta | Documento `informe.pdf` (`77` B) con firma `%PDF-1.4` | `POST /api/evidencia/adjuntos` con `informe.pdf;type=application/pdf` e `incidente_id` válido | `HTTP 201 Created` preservando `tipoMime: "application/pdf"`, `tamanoBytes: 77` y `sha256_hash` en BD | `HTTP 201 Created` y registro en `adjunto` con `sha256_hash: 68d3dbe223d4...` | APROBADO | 24/11/2026 14:23 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-16` | Carga exitosa y transcodificación de video `video/mp4` con `ffmpeg` (`201 Created`) | Funcional / Multimedia | End-to-End API | Alta | Video MP4 real (`1600x900`, `4,781` B) y binario `ffmpeg` disponible en entorno | `POST /api/evidencia/adjuntos` con `video_prueba.mp4;type=video/mp4` e `incidente_id=a1000000-0000-4000-8000-000000000004` | `HTTP 201 Created` con video escalado a 720p/H.264/AAC y tamaño optimizado en disco | `HTTP 201 Created` con `tipoMime: "video/mp4"`, `tamanoBytes: 4301` (`url: "/uploads/evidencia/cff02a...mp4"`) | APROBADO | 24/11/2026 14:24 | - | chore(docker): configurar ffmpeg y volumen persistente uploads_data para evidencias (HU-43) |
| `CP-H43-API-17` | Deduplicación física en disco mediante `sha256_hash` ante reintentos offline repetidos (`201 Created` — CA-5) | Integridad / Almacenamiento | Storage / BD | Alta | Misma imagen `foto_valida.png` subida dos veces consecutivas | Dos peticiones `POST /api/evidencia/adjuntos` con `foto_valida.png` | Ambas respuestas comparten el mismo `url` (`/uploads/evidencia/<hash>.webp`) y existe un único archivo físico en disco | Segundo envío devuelve idéntica URL `e4148a...webp` y un único archivo en `uploads/evidencia/` | APROBADO | 24/11/2026 14:24 | - | feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43) |
| `CP-H43-API-18` | Descarga (`200 OK`), streaming `Range` (`206 Partial Content`), bloqueo de path traversal (`400`) y no encontrado (`404`) en `GET /uploads/evidencia/[filename]` | Funcional / Seguridad | Route Handler | Alta | Archivos almacenados en `${UPLOAD_DIR}/evidencia/` | `GET` normal, `GET` con `Range: bytes=0-15`, `GET ../..secret.mp4` y `GET inexistente.webp` | `200 OK` con `Accept-Ranges: bytes`, `206 Partial Content` (`bytes 0-15/4301`), `400` en traversal y `404` si no existe | `200 OK`, `206 Partial Content` (`content-range: bytes 0-15/4301`), `400` (`Nombre de archivo inválido.`) y `404` (`Archivo no encontrado.`) | APROBADO | 24/11/2026 14:24 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-19` | Emisión del evento WebSocket `adjunto:creado` en Redis Pub/Sub (`sgrai:socket-events`) al subir adjunto con `incidente_id` (CA-6) | Tiempo Real / Socket.io | Service / Redis | Alta | Redis activo en `localhost:6001` y suscriptor en canal `sgrai:socket-events` | Subida de `foto_valida.png` y `video_prueba.mp4` con `incidente_id=a1000000-0000-4000-8000-000000000004` | Publicación simétrica de `adjunto:creado` hacia salas `encargado`, `sala:encargados` y `supervisor` | Canal `sgrai:socket-events` recibió 3 mensajes por adjunto con `id`, `url`, `tipoMime`, `tamanoBytes`, `incidenteId` y `creadoEn` | APROBADO | 24/11/2026 14:24 | - | feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43) |
| `CP-H43-API-20` | Compilación limpia (`tsc` / `next build`), linter (`eslint`) y ejecución de suite Vitest (HU-43 y global) | Automatización / CI | Unit / Build | Alta | Código fuente de la rama y dependencias instaladas | `npx tsc --noEmit`, `npm run build`, `npm run lint` y `npm test` (5 archivos HU-43 y 95 globales) | `0` errores en TypeScript, build y ESLint; 100% de pruebas unitarias pasando | `tsc` y `build` exit `0`; `eslint` `0 errors`; Vitest `16/16` en HU-43 y `954/954` global (`95/95` archivos) | APROBADO | 24/11/2026 14:26 | - | test(evidencia): agregar pruebas unitarias para migracion 058, almacenamiento, servicio y rutas (HU-43) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H43-API-01	Omisión de adjuntos asociados a incidente_id en Centro de Mando (GET /api/incidentes/{id} y GET /api/misiones/{id}), ausencia de GET /api/evidencia/adjuntos e incoherencia con reporte_terreno_id	Integración / Contrato CA-4 y CA-6	Repositorio / API	Crítica	Evidencia subida vía POST /api/evidencia/adjuntos con incidente_id y prueba con reporte_terreno_id solo y cruzado	GET /api/incidentes/a1000000-0000-4000-8000-000000000004, GET /api/misiones/d1000000-0000-4000-8000-000000000002, GET /api/evidencia/adjuntos y POST con reporte_terreno_id solo/cruzado	Centro de Mando expone adjuntos vinculados al incidente; reporte_terreno_id resuelve incidenteId para adjunto:creado y rechaza cruce con otro incidente	GET /api/incidentes/{id} y GET /api/misiones/{id} omiten los adjuntos del incidente; GET /api/evidencia/adjuntos da 405; reporte_terreno_id solo emite incidenteId: null y acepta cruce inválido	ABIERTO	24/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-API-02	Bypass de autenticación JWT mediante cabecera plana x-user-id, ausencia de autorización horizontal de misión/unidad e invariantes ICS, y falta de security en OpenAPI	Seguridad / Auth / RBAC	Route / Repo / OpenAPI	Crítica	Petición sin Authorization: Bearer usando x-user-id, usuario de otra patrulla sobre incidente RESUELTO y consulta a openapi.json	POST /api/evidencia/adjuntos con -H "x-user-id: 00000000-0000-4000-8000-000000000001" y POST con JWT de pedro.patrulla@valdivia.cl sobre a1000000-...0006 (RESUELTO)	401 Unauthorized sin JWT válido; 403/409 ante unidad ajena o incidente cerrado; BearerAuth declarado en OpenAPI	Acepta x-user-id con 201 Created; patrulla ajena adjunta archivo a incidente RESUELTO (201 Created); OpenAPI omite security	ABIERTO	24/11/2026 14:23	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-API-03	Truncamiento silencioso del cuerpo multipart a 10 MB por src/proxy.ts (proxyClientMaxBodySize), retornando 400 en archivos válidos de 9.999 MB y en excesos de 10–11 MB o chunked	Límite / Middleware Next.js 16 CA-3	Proxy / Route	Alta	Servidor Next.js 16.3.4 activo con src/proxy.ts en /api/:path* y archivos de 10,485,500 B y 10,485,860 B	POST /api/evidencia/adjuntos con casi_10mb.pdf (10,485,500 B), grande_10mb.pdf (10,485,860 B) y grande_12mb.pdf con Transfer-Encoding: chunked	201 Created para 10,485,500 B (<= 10 MB) y 413 Payload Too Large para archivos > 10 MB (con o sin Content-Length)	El proxy trunca el stream a 10 MB y los tres casos retornan HTTP 400 Bad Request (No se pudo parsear el cuerpo multipart/form-data.)	ABIERTO	24/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-API-04	Error 500 no controlado en sharp por imagen corrupta, fuga de archivos huérfanos en disco tras 404, falsos positivos ftyp (HEIC como MP4) y falta de try/catch en Socket	Robustez / Almacenamiento CA-3 y CA-4	Storage / Service	Alta	Imagen JPEG truncada corrupto.jpg (16 B), incidente_id inexistente 99999999-... y falso_heic.mp4 (ftypheic)	POST /api/evidencia/adjuntos con corrupto.jpg, foto_orphan.jpg hacia 99999999-... y falso_heic.mp4 como video/mp4	400/415 para JPEG corrupto y HEIC; sin archivos huérfanos en uploads/evidencia/ tras 404; emisión socket tolerante a fallos	JPEG corrupto lanza error en sharp devolviendo HTTP 500; tras 404 queda archivo .webp huérfano en disco; falso_heic.mp4 responde 201 Created	ABIERTO	24/11/2026 14:23	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-API-05	Desfase de 65 commits con develop, divergencia de migraciones (052_ vs 035_/051_ y omisión 041_/072_), sobrescritura/borrado de reportes:crear entre 058 y 056	Integración / Base de Datos	Git / Migraciones	Alta	Comparación entre feature/h43-adjuntar-evidencia-multimedia y develop y ejecución de npm run db:migrate	git rev-list --count HEAD..develop, diff de src/lib/db/migrations/ y tabla permiso post-058	Rama al día con develop, secuencia de migraciones consistente y 058 sin sobrescribir ni borrar en down() el permiso de 056	65 commits de desfase; faltan 041_/051_/072_; 058 sobrescribe modulo='Evidencia' en registro ...0039 de 056 y down() lo elimina	ABIERTO	24/11/2026 14:16	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-API-06	Ausencia de cabeceras CORS y nosniff en GET /uploads/evidencia/[filename] y falta de cobertura de /api/evidencia/adjuntos en tests OpenAPI	Interoperabilidad / Seguridad HTTP CA-6	Route / Config / Test	Media	Archivo de evidencia servido en /uploads/evidencia/ y consulta desde origen distinto (http://localhost:3000)	curl -I -H "Origin: http://localhost:3000" http://localhost:3001/uploads/evidencia/<hash>.webp y route.test.ts de OpenAPI	Cabeceras Access-Control-Allow-Origin y X-Content-Type-Options: nosniff presentes y ruta verificada en test OpenAPI	Respuesta 200 OK omite Access-Control-Allow-Origin y nosniff; openapi.json/__tests__/route.test.ts no valida /api/evidencia/adjuntos	ABIERTO	24/11/2026 14:24	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H43-API-01	Rechazo de petición POST /api/evidencia/adjuntos sin credenciales de autenticación (401 Unauthorized)	Seguridad / Auth	Route Handler	Crítica	Servidor activo; petición sin cabecera Authorization ni x-user-id	POST /api/evidencia/adjuntos con informe.pdf e incidente_id=a1000000-0000-4000-8000-000000000004 sin headers auth	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	HTTP 401 Unauthorized con mensaje exacto esperado	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-02	Rechazo RBAC para usuario autenticado sin permiso reportes:crear (403 Forbidden — CA-7)	Seguridad / RBAC	Route / Auth	Crítica	Usuario callcenter@valdivia.cl (CALL_CENTER) autenticado vía JWT	POST /api/evidencia/adjuntos con Authorization: Bearer <TOKEN_CALLCENTER> y informe.pdf	HTTP 403 Forbidden indicando ausencia del permiso reportes:crear	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: reportes:crear"}	APROBADO	24/11/2026 14:23	-	feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)
CP-H43-API-03	Verificación de asignación del permiso reportes:crear a DELEGADO_CUADRILLA, PATRULLA_VERIFICADORA y ADMIN (CA-7)	Seguridad / RBAC	BD / Endpoint	Alta	Migración 058 ejecutada y usuarios sembrados en PostgreSQL	GET /api/seguridad/usuario-activo con JWT de supervisor@valdivia.cl y consulta SQL a rol_permiso	Los 3 roles poseen reportes:crear en rol_permiso y en el perfil activo	GET /api/seguridad/usuario-activo retorna rol: 'DELEGADO_CUADRILLA' y reportes:crear incluido; 3 filas en rol_permiso	APROBADO	24/11/2026 14:25	-	feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)
CP-H43-API-04	Rechazo de petición sin formato multipart/form-data (400 Bad Request)	Validación / Contrato	Route Handler	Media	Usuario autorizado con JWT de DELEGADO_CUADRILLA	POST /api/evidencia/adjuntos con -H "Content-Type: application/json" -d '{}'	HTTP 400 Bad Request indicando que debe enviarse como multipart/form-data	HTTP 400 Bad Request: {"message":"La solicitud debe enviarse en formato multipart/form-data."}	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-05	Rechazo de petición multipart/form-data sin campo binario file (400 Bad Request)	Validación / Multipart	Route Handler	Media	Usuario autorizado con JWT de DELEGADO_CUADRILLA	POST /api/evidencia/adjuntos enviando únicamente -F "incidente_id=a1000000-0000-4000-8000-000000000004"	HTTP 400 Bad Request solicitando el campo file	HTTP 400 Bad Request: {"message":"Debe adjuntar un archivo en el campo 'file'."}	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-06	Rechazo de archivo vacío de 0 bytes (400 Bad Request)	Validación / Límite	Storage / Route	Media	Archivo vacio.jpg de 0 bytes	POST /api/evidencia/adjuntos con vacio.jpg;type=image/jpeg e incidente_id válido	HTTP 400 Bad Request indicando que el archivo está vacío	HTTP 400 Bad Request: {"message":"El archivo proporcionado está vacío."}	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-07	Rechazo cuando se omiten ambos identificadores de asociación incidente_id y reporte_terreno_id (400 Bad Request — CA-4)	Validación / Zod	Schema / Route	Alta	Archivo informe.pdf válido y usuario autorizado	POST /api/evidencia/adjuntos con -F "file=@informe.pdf;type=application/pdf" sin IDs	HTTP 400 Bad Request exigiendo al menos incidente_id o reporte_terreno_id	HTTP 400 Bad Request con error en campo asociacion	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-08	Rechazo por formato UUID inválido en incidente_id o reporte_terreno_id (400 Bad Request)	Validación / Zod	Schema / Route	Media	Archivo válido y usuario autorizado	POST /api/evidencia/adjuntos con incidente_id=no-es-uuid	HTTP 400 Bad Request detallando error en campo incidente_id	HTTP 400 Bad Request con errors[0].campo: "incidente_id"	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-09	Rechazo de archivo superior a 11 MB con cabecera Content-Length (413 Payload Too Large — CA-3)	Validación / Límite	Route Handler	Alta	Archivo grande_12mb.pdf de 12,582,912 bytes	POST /api/evidencia/adjuntos con grande_12mb.pdf;type=application/pdf e incidente_id	HTTP 413 Payload Too Large indicando límite máximo de 10 MB	HTTP 413 Payload Too Large: {"message":"El archivo excede el tamaño máximo permitido de 10 MB."}	APROBADO	24/11/2026 14:24	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-10	Rechazo de tipo MIME no autorizado en lista blanca (application/x-msdownload — CA-3)	Seguridad / Validación	Storage / Route	Crítica	Archivo malware.exe con cabecera MZ	POST /api/evidencia/adjuntos con malware.exe;type=application/x-msdownload e incidente_id	HTTP 415 Unsupported Media Type rechazando el archivo	HTTP 415 Unsupported Media Type con listado de tipos permitidos	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-11	Rechazo de suplantación de extensión/MIME mediante inspección binaria de magic bytes (415 Unsupported Media Type — CA-3)	Seguridad / Magic Bytes	Storage / Route	Crítica	Archivo informe.pdf (%PDF-1.4) declarado maliciosamente como image/jpeg	POST /api/evidencia/adjuntos con informe.pdf;type=image/jpeg e incidente_id	HTTP 415 Unsupported Media Type detectando discrepancia entre application/pdf real y image/jpeg declarado	HTTP 415 Unsupported Media Type: {"message":"El contenido binario del archivo (application/pdf) no coincide con el tipo declarado (image/jpeg)."}	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-12	Rechazo HTTP 404 Not Found cuando incidente_id o reporte_terreno_id no existe en PostgreSQL	Funcional / Negativa	Repository / Route	Alta	UUID inexistente 99999999-9999-4999-8999-999999999999	POST /api/evidencia/adjuntos con foto_orphan.jpg e incidente_id=99999999-9999-4999-8999-999999999999	HTTP 404 Not Found indicando inexistencia del incidente	HTTP 404 Not Found: {"message":"No existe ningún incidente con el identificador 99999999-9999-4999-8999-999999999999."}	APROBADO	24/11/2026 14:24	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-13	Carga exitosa, redimensionamiento (<= 1920px) y compresión WebP de imagen image/png (201 Created — CA-3 y CA-4)	Funcional / Optimización	End-to-End API	Crítica	Imagen foto_valida.png (2200x1400, 11,226 B) y JWT de DELEGADO_CUADRILLA	POST /api/evidencia/adjuntos con foto_valida.png;type=image/png e incidente_id=a1000000-0000-4000-8000-000000000004	HTTP 201 Created, conversión a image/webp con reducción de peso, hash SHA-256 y fila en adjunto	HTTP 201 Created con tipoMime: "image/webp", tamanoBytes: 4292, url: "/uploads/evidencia/e4148a...webp"	APROBADO	24/11/2026 14:24	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-14	Carga exitosa y optimización a WebP de imágenes image/jpeg e image/webp (201 Created — CA-3 y CA-4)	Funcional / Positiva	End-to-End API	Alta	foto_orphan.jpg (3,120 B) y foto_webp.webp (628 B)	POST /api/evidencia/adjuntos con image/jpeg e image/webp hacia incidente_id=a1000000-0000-4000-8000-000000000004	HTTP 201 Created con tipoMime: "image/webp" y registro persistido en tabla adjunto	HTTP 201 Created (tamanoBytes: 952 para JPEG y 628 para WebP) persistidos en adjunto	APROBADO	24/11/2026 14:25	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-15	Carga exitosa de documento técnico application/pdf y persistencia en tabla adjunto (201 Created — CA-3 y CA-4)	Funcional / Positiva	End-to-End API	Alta	Documento informe.pdf (77 B) con firma %PDF-1.4	POST /api/evidencia/adjuntos con informe.pdf;type=application/pdf e incidente_id válido	HTTP 201 Created preservando tipoMime: "application/pdf", tamanoBytes: 77 y sha256_hash en BD	HTTP 201 Created y registro en adjunto con sha256_hash: 68d3dbe223d4...	APROBADO	24/11/2026 14:23	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-16	Carga exitosa y transcodificación de video video/mp4 con ffmpeg (201 Created)	Funcional / Multimedia	End-to-End API	Alta	Video MP4 real (1600x900, 4,781 B) y binario ffmpeg disponible en entorno	POST /api/evidencia/adjuntos con video_prueba.mp4;type=video/mp4 e incidente_id=a1000000-0000-4000-8000-000000000004	HTTP 201 Created con video escalado a 720p/H.264/AAC y tamaño optimizado en disco	HTTP 201 Created con tipoMime: "video/mp4", tamanoBytes: 4301 (url: "/uploads/evidencia/cff02a...mp4")	APROBADO	24/11/2026 14:24	-	chore(docker): configurar ffmpeg y volumen persistente uploads_data para evidencias (HU-43)
CP-H43-API-17	Deduplicación física en disco mediante sha256_hash ante reintentos offline repetidos (201 Created — CA-5)	Integridad / Almacenamiento	Storage / BD	Alta	Misma imagen foto_valida.png subida dos veces consecutivas	Dos peticiones POST /api/evidencia/adjuntos con foto_valida.png	Ambas respuestas comparten el mismo url (/uploads/evidencia/<hash>.webp) y existe un único archivo físico en disco	Segundo envío devuelve idéntica URL e4148a...webp y un único archivo en uploads/evidencia/	APROBADO	24/11/2026 14:24	-	feat(db): agregar migracion 058, permiso reportes:crear y columna sha256_hash en adjunto (HU-43)
CP-H43-API-18	Descarga (200 OK), streaming Range (206 Partial Content), bloqueo de path traversal (400) y no encontrado (404) en GET /uploads/evidencia/[filename]	Funcional / Seguridad	Route Handler	Alta	Archivos almacenados en ${UPLOAD_DIR}/evidencia/	GET normal, GET con Range: bytes=0-15, GET ..secret.mp4 y GET inexistente.webp	200 OK con Accept-Ranges: bytes, 206 Partial Content (bytes 0-15/4301), 400 en traversal y 404 si no existe	200 OK, 206 Partial Content (content-range: bytes 0-15/4301), 400 (Nombre de archivo inválido.) y 404 (Archivo no encontrado.)	APROBADO	24/11/2026 14:24	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-19	Emisión del evento WebSocket adjunto:creado en Redis Pub/Sub (sgrai:socket-events) al subir adjunto con incidente_id (CA-6)	Tiempo Real / Socket.io	Service / Redis	Alta	Redis activo en localhost:6001 y suscriptor en canal sgrai:socket-events	Subida de foto_valida.png y video_prueba.mp4 con incidente_id=a1000000-0000-4000-8000-000000000004	Publicación simétrica de adjunto:creado hacia salas encargado, sala:encargados y supervisor	Canal sgrai:socket-events recibió 3 mensajes por adjunto con id, url, tipoMime, tamanoBytes, incidenteId y creadoEn	APROBADO	24/11/2026 14:24	-	feat(evidencia): implementar modulo de almacenamiento optimizado y endpoints multipart/streaming (HU-43)
CP-H43-API-20	Compilación limpia (tsc / next build), linter (eslint) y ejecución de suite Vitest (HU-43 y global)	Automatización / CI	Unit / Build	Alta	Código fuente de la rama y dependencias instaladas	npx tsc --noEmit, npm run build, npm run lint y npm test (5 archivos HU-43 y 95 globales)	0 errores en TypeScript, build y ESLint; 100% de pruebas unitarias pasando	tsc y build exit 0; eslint 0 errors; Vitest 16/16 en HU-43 y 954/954 global (95/95 archivos)	APROBADO	24/11/2026 14:26	-	test(evidencia): agregar pruebas unitarias para migracion 058, almacenamiento, servicio y rutas (HU-43)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Verificación de Pruebas Automatizadas (Vitest), Compilación, Linter y Migraciones

#### A. Suite Directa de HU-43 y Filtro `-t "HU-43"` (`CP-H43-API-20`)
```bash
npm test -- -t "HU-43"
```
**Salida real obtenida:**
```text
 Test Files  5 passed | 90 skipped (95)
      Tests  16 passed | 938 skipped (954)
   Duration  15.09s
```

```bash
npm test -- \
  src/app/api/evidencia/adjuntos/__tests__/route.test.ts \
  src/app/uploads/evidencia/[filename]/__tests__/route.test.ts \
  src/lib/db/migrations/__tests__/058_permiso_reportes_crear_y_adjuntos.test.ts \
  src/modules/evidencia/__tests__/evidencia.service.test.ts \
  src/modules/evidencia/__tests__/evidencia.storage.test.ts
```
**Salida real obtenida:**
```text
 ✓ src/modules/evidencia/__tests__/evidencia.service.test.ts (1 test) 9ms
 ✓ src/lib/db/migrations/__tests__/058_permiso_reportes_crear_y_adjuntos.test.ts (2 tests) 10ms
 ✓ src/app/api/evidencia/adjuntos/__tests__/route.test.ts (6 tests) 52ms
 ✓ src/app/uploads/evidencia/[filename]/__tests__/route.test.ts (3 tests) 33ms
 ✓ src/modules/evidencia/__tests__/evidencia.storage.test.ts (4 tests) 681ms

 Test Files  5 passed (5)
      Tests  16 passed (16)
   Duration  1.72s
```

#### B. Suite Global del Repositorio, Compilación y ESLint (`CP-H43-API-20`)
```bash
npm test && npx tsc --noEmit && npm run build && npm run lint
```
**Salidas reales obtenidas:**
```text
Vitest Global:
 Test Files  95 passed (95)
      Tests  954 passed (954)
   Duration  6.47s

npx tsc --noEmit -> exit code 0
npm run build    -> ✓ Compiled successfully / ✓ Finished TypeScript in 12.1s
npm run lint     -> ✖ 1 problem (0 errors, 1 warning en tipologia/__tests__/route.test.ts)
```

#### C. Migraciones Kysely y Desfase Git respecto a `develop` (`BUG-H43-API-05`)
```bash
git rev-list --count HEAD..develop
npm run db:migrate
docker exec grupo1_postgres psql -U sgrai -d sgrai -c "SELECT id, codigo, nombre, modulo FROM permiso WHERE codigo = 'reportes:crear';"
```
**Salidas reales obtenidas:**
```text
65

[RECONCILIACIÓN] Migración renumerada actualizada en kysely_migration: "035_permiso_misiones_terreno_verificar" -> "052_permiso_misiones_terreno_verificar"
[OK] Migración Kysely ejecutada con éxito: "056_reporte_verificacion_cierre_y_no_abordable"
[OK] Migración Kysely ejecutada con éxito: "058_permiso_reportes_crear_y_adjuntos"

                  id                  |     codigo     |               nombre                |  modulo   
--------------------------------------+----------------+-------------------------------------+-----------
 10000000-0000-4000-8000-000000000039 | reportes:crear | Crear Reportes y Adjuntar Evidencia | Evidencia
```

---

### 5.2 Generación de Fixtures y Autenticación JWT para Pruebas HTTP (`cURL`)

```bash
FIXTURES=$(mktemp -d)
node -e '
const sharp = require("sharp");
const fs = require("fs");
const dir = process.argv[1];
(async () => {
  await sharp({ create: { width: 2200, height: 1400, channels: 3, background: { r: 30, g: 120, b: 200 } } })
    .png({ compressionLevel: 9 }).toFile(dir + "/foto_valida.png");
  await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg({ quality: 90 }).toFile(dir + "/foto_orphan.jpg");
  await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 40, g: 180, b: 90 } } })
    .webp({ quality: 80 }).toFile(dir + "/foto_webp.webp");
  fs.writeFileSync(dir + "/informe.pdf", "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  const b99 = Buffer.alloc(10485500, 0x20);
  Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n").copy(b99, 0);
  Buffer.from("\n%%EOF\n").copy(b99, b99.length - 7);
  fs.writeFileSync(dir + "/casi_10mb.pdf", b99);
  const b10 = Buffer.alloc(10 * 1024 * 1024 + 100, 0x20);
  Buffer.from("%PDF-1.4\n").copy(b10, 0);
  fs.writeFileSync(dir + "/grande_10mb.pdf", b10);
  const b12 = Buffer.alloc(12 * 1024 * 1024, 0x20);
  Buffer.from("%PDF-1.4\n").copy(b12, 0);
  fs.writeFileSync(dir + "/grande_12mb.pdf", b12);
  fs.writeFileSync(dir + "/vacio.jpg", Buffer.alloc(0));
  fs.writeFileSync(dir + "/malware.exe", "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff");
  fs.writeFileSync(dir + "/corrupto.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef]));
  fs.writeFileSync(dir + "/falso_heic.mp4", Buffer.from("\x00\x00\x00\x18ftypheic\x00\x00\x00\x00heicmif1", "latin1"));
})();
' "$FIXTURES"
ffmpeg -y -f lavfi -i color=c=blue:s=1600x900:d=1 -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -c:v libx264 -c:a aac "$FIXTURES/video_prueba.mp4" 2>/dev/null

TOKEN_DELEGADO=$(curl -s -X POST http://localhost:3001/api/seguridad/login -H "Content-Type: application/json" -d '{"identificador":"supervisor@valdivia.cl","password":"Valdivia2026!"}' | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.token ?? d.data?.token ?? '')")
TOKEN_PATRULLA=$(curl -s -X POST http://localhost:3001/api/seguridad/login -H "Content-Type: application/json" -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}' | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.token ?? d.data?.token ?? '')")
TOKEN_CALLCENTER=$(curl -s -X POST http://localhost:3001/api/seguridad/login -H "Content-Type: application/json" -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.token ?? d.data?.token ?? '')")
TOKEN_ENCARGADO=$(curl -s -X POST http://localhost:3001/api/seguridad/login -H "Content-Type: application/json" -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.token ?? d.data?.token ?? '')")
```

---

### 5.3 Evidencias HTTP/JSON Reales por Caso

#### Caso 1: Rechazo Sin Autenticación (`401 Unauthorized` — `CP-H43-API-01`) y Rechazo RBAC (`403 Forbidden` — `CP-H43-API-02`)
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_CALLCENTER" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"
```
**Respuestas reales:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: reportes:crear"}
```

#### Caso 2: Reproducción de Bypass JWT con `x-user-id` y Ausencia de Autorización Horizontal (`BUG-H43-API-02`)
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_PATRULLA" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000006"
```
**Respuestas reales (`201 Created` indebido):**
```http
HTTP/1.1 201 Created
content-type: application/json

{"id":"b0c92b36-a95d-4caa-ac25-7acfe1094a7c","nombreArchivo":"informe.pdf","url":"/uploads/evidencia/68d3dbe223d4659eb030429ecc280a437eb6e9b042a59797cbbd9e16f56c1d56.pdf","tipoMime":"application/pdf","tamanoBytes":77,"incidenteId":"a1000000-0000-4000-8000-000000000004","reporteTerrenoId":null,"creadoEn":"2026-11-24T17:23:56.076Z"}
```
```http
HTTP/1.1 201 Created
content-type: application/json

{"id":"62fdd1f9-439e-4c24-b811-d69cf9ea8192","nombreArchivo":"informe.pdf","url":"/uploads/evidencia/68d3dbe223d4659eb030429ecc280a437eb6e9b042a59797cbbd9e16f56c1d56.pdf","tipoMime":"application/pdf","tamanoBytes":77,"incidenteId":"a1000000-0000-4000-8000-000000000006","reporteTerrenoId":null,"creadoEn":"2026-11-24T17:24:55.712Z"}
```

#### Caso 3: Validación de Entrada, MIME y Tamaño (`CP-H43-API-04` a `CP-H43-API-11`) y Truncamiento Proxy 10 MB (`BUG-H43-API-03`)
```bash
# CP-H43-API-04: Content-Type JSON
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" -H "Content-Type: application/json" -d '{}'

# CP-H43-API-07: Sin incidente_id ni reporte_terreno_id
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/informe.pdf;type=application/pdf"

# CP-H43-API-09: Archivo > 11 MB (12 MB)
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/grande_12mb.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

# CP-H43-API-11: Magic bytes falsificados (PDF enviado como image/jpeg)
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/informe.pdf;type=image/jpeg" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

# BUG-H43-API-03: Archivo válido de 10,485,500 B (<= 10 MB) y exceso 10 MB + 100 B
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/casi_10mb.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/grande_10mb.pdf;type=application/pdf" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"
```
**Respuestas reales:**
```http
HTTP/1.1 400 Bad Request
{"message":"La solicitud debe enviarse en formato multipart/form-data."}
```
```http
HTTP/1.1 400 Bad Request
{"message":"Datos de asociación inválidos para el adjunto.","errors":[{"campo":"asociacion","mensaje":"Debe proporcionar al menos incidente_id o reporte_terreno_id."}]}
```
```http
HTTP/1.1 413 Payload Too Large
{"message":"El archivo excede el tamaño máximo permitido de 10 MB."}
```
```http
HTTP/1.1 415 Unsupported Media Type
{"message":"El contenido binario del archivo (application/pdf) no coincide con el tipo declarado (image/jpeg)."}
```
```http
# Salida real de BUG-H43-API-03 (casi_10mb.pdf y grande_10mb.pdf) + log del servidor:
HTTP/1.1 400 Bad Request
{"message":"No se pudo parsear el cuerpo multipart/form-data."}
# Log server: Request body exceeded 10MB for /api/evidencia/adjuntos. Only the first 10MB will be available unless configured.
```

#### Caso 4: Reproducción de Fallos `sharp` (`500`), Archivo Huérfano tras `404` y Falso Video `ftypheic` (`BUG-H43-API-04`)
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/corrupto.jpg;type=image/jpeg" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/foto_orphan.jpg;type=image/jpeg" \
  -F "incidente_id=99999999-9999-4999-8999-999999999999"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/falso_heic.mp4;type=video/mp4" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"
```
**Respuestas reales:**
```http
HTTP/1.1 500 Internal Server Error
{"message":"Error interno del servidor al procesar el archivo adjunto."}
```
```http
HTTP/1.1 404 Not Found
{"message":"No existe ningún incidente con el identificador 99999999-9999-4999-8999-999999999999."}
# Al inspeccionar uploads/evidencia/, el archivo 92ce9ec2c1ac...webp quedó persistido en disco (huérfano).
```
```http
HTTP/1.1 201 Created
{"id":"71cbab2a-9f90-41c5-af7e-08621b8364ae","nombreArchivo":"falso_heic.mp4","url":"/uploads/evidencia/aa851079b2c21112b6443adcd50ad28d61fb79e486786db29b90c979fded2b64.mp4","tipoMime":"video/mp4","tamanoBytes":24,"incidenteId":"a1000000-0000-4000-8000-000000000004","reporteTerrenoId":null,"creadoEn":"2026-11-24T17:23:56.825Z"}
```

#### Caso 5: Subida Exitosa de Imagen PNG -> WebP, Deduplicación SHA-256, Video MP4 (FFmpeg), Streaming `206` y Evento Redis (`CP-H43-API-13`, `16`, `17`, `18`, `19`)
```bash
curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/foto_valida.png;type=image/png" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -i -X POST http://localhost:3001/api/evidencia/adjuntos \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@$FIXTURES/video_prueba.mp4;type=video/mp4" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004"

curl -s -I -H "Origin: http://localhost:3000" \
  "http://localhost:3001/uploads/evidencia/e4148a3f13f922dd9d057d1f4912a07d16bad833d2fc0cbdd85b7290980b7ada.webp"

curl -s -i -H "Range: bytes=0-15" \
  "http://localhost:3001/uploads/evidencia/cff02aa7fdd37287725e07d5bfd363d0e59892c2e3b61d4526d5409ca0409f91.mp4" | head -n 10
```
**Respuestas reales y eventos capturados en `sgrai:socket-events`:**
```http
HTTP/1.1 201 Created
content-type: application/json

{"id":"f4f1589b-9907-4f88-808c-cd967ab0c826","nombreArchivo":"foto_valida.png","url":"/uploads/evidencia/e4148a3f13f922dd9d057d1f4912a07d16bad833d2fc0cbdd85b7290980b7ada.webp","tipoMime":"image/webp","tamanoBytes":4292,"incidenteId":"a1000000-0000-4000-8000-000000000004","reporteTerrenoId":null,"creadoEn":"2026-11-24T17:24:54.434Z"}
```
```http
HTTP/1.1 201 Created
content-type: application/json

{"id":"06a6dfc6-00d6-4cf6-8357-53672b0f9f67","nombreArchivo":"video_prueba.mp4","url":"/uploads/evidencia/cff02aa7fdd37287725e07d5bfd363d0e59892c2e3b61d4526d5409ca0409f91.mp4","tipoMime":"video/mp4","tamanoBytes":4301,"incidenteId":"a1000000-0000-4000-8000-000000000004","reporteTerrenoId":null,"creadoEn":"2026-11-24T17:24:55.434Z"}
```
```http
HTTP/1.1 200 OK
accept-ranges: bytes
cache-control: public, max-age=31536000, immutable
content-length: 4292
content-type: image/webp
```
```http
HTTP/1.1 206 Partial Content
accept-ranges: bytes
cache-control: public, max-age=31536000, immutable
content-length: 16
content-range: bytes 0-15/4301
content-type: video/mp4
```
```text
Eventos Redis Pub/Sub (canal sgrai:socket-events):
- room: "encargado"       | event: "adjunto:creado" | payload.id: "f4f1589b-9907-4f88-808c-cd967ab0c826"
- room: "sala:encargados" | event: "adjunto:creado" | payload.id: "f4f1589b-9907-4f88-808c-cd967ab0c826"
- room: "supervisor"      | event: "adjunto:creado" | payload.id: "f4f1589b-9907-4f88-808c-cd967ab0c826"
```

#### Caso 6: Verificación de Centro de Mando (`CA-6`) y `reporte_terreno_id` (`BUG-H43-API-01`)
```bash
curl -s "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000004" \
  -H "Authorization: Bearer $TOKEN_ENCARGADO" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log({ tieneAdjuntosRaiz: 'adjuntos' in d.data, reportes: d.data.reportesEvaluacionTerreno });"

curl -s -i "http://localhost:3001/api/evidencia/adjuntos"
```
**Salidas reales:**
```json
{ "tieneAdjuntosRaiz": false, "reportes": [] }
```
```http
HTTP/1.1 405 Method Not Allowed
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La PWA debe proveer un módulo de carga de evidencia multimedia dentro de la misión activa. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz en `sgrai-pwa`. El backend provee `POST /api/evidencia/adjuntos`. |
| **CA-2:** Debe permitir la captura directa desde la cámara del dispositivo móvil o la selección desde la galería de archivos. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de captura nativa/galería en `sgrai-pwa`. |
| **CA-3:** Validación estricta de archivos: solo se permiten tipos MIME autorizados (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) y un peso máximo de 10 MB por archivo. | `CP-H43-API-09` a `11`, `CP-H43-API-13` a `16`, `BUG-H43-API-03`, `BUG-H43-API-04` | 🔴 **CON DEFECTOS** | Valida magic bytes y rechaza MIME no permitidos (`415`), pero `src/proxy.ts` trunca archivos válidos cercanos a 10 MB (`10,485,500 B`) devolviendo `400`; `sharp` devuelve `500` ante JPEG corrupto; y `ftypheic` pasa como `video/mp4`. *(Nota: la API habilita además `video/mp4`, `video/webm` y `video/quicktime` en coherencia con el enunciado y subtareas de video).* |
| **CA-4:** Al cargar exitosamente, la API debe persistir los metadatos en la tabla `adjunto` asociando el archivo a `reporte_terreno_id` o `incidente_id`. | `CP-H43-API-07`, `CP-H43-API-12` a `17`, `BUG-H43-API-01`, `BUG-H43-API-04` | 🔴 **CON DEFECTOS** | Inserta en `adjunto` con `sha256_hash`, pero deja `incidente_id = null` si se envía solo `reporte_terreno_id`, admite cruces entre `reporte_terreno_id` e `incidente_id` distintos, y deja archivos huérfanos en disco tras error `404`. |
| **CA-5:** Soporte offline: almacenamiento local en IndexedDB y sincronización automática en segundo plano al recuperar red. | `CP-H43-API-17` *(parcial API)* / *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API (SOPORTADO)** | La cola IndexedDB y Service Worker corresponden a `sgrai-pwa`. El backend aporta deduplicación idempotente por `sha256_hash` ante reintentos de red. |
| **CA-6:** Los adjuntos deben visualizarse inmediatamente en la galería de evidencia del Centro de Mando. | `CP-H43-API-18`, `CP-H43-API-19`, `BUG-H43-API-01`, `BUG-H43-API-06` | 🔴 **NO CUMPLIDO** | Emite `adjunto:creado` en Redis y sirve `/uploads/evidencia/[filename]` (`200`/`206`), pero `GET /api/incidentes/{id}` y `GET /api/misiones/{id}` no exponen los adjuntos asociados a `incidente_id`, no existe `GET /api/evidencia/adjuntos`, `adjunto:creado` emite `incidenteId: null` con `reporte_terreno_id` solo, y `/uploads` carece de cabeceras CORS. |
| **CA-7:** El endpoint de subida debe requerir el permiso RBAC `reportes:crear`. | `CP-H43-API-01` a `03`, `BUG-H43-API-02`, `BUG-H43-API-05` | 🔴 **CON DEFECTOS** | Valida `reportes:crear` con token JWT (`401`/`403`), pero permite bypass total mediante cabecera `x-user-id`, omite validación horizontal de misión/estado ICS y la migración `058` colisiona con `056` en la definición y rollback del permiso. |

