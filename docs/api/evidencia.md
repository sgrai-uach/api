# Módulo de Evidencia (`sgrai-api`)

Documentación técnica de los endpoints del módulo de **Evidencia** para la carga, optimización y consulta de respaldos multimedia en terreno (fotografías, videos y documentos PDF).

---

## 1. Reglas de Negocio y Políticas de Almacenamiento

1. **Autenticación JWT y permiso RBAC obligatorio:** Todo envío de evidencia requiere un token `Authorization: Bearer <token>` válido (sin fallback por cabeceras) y el permiso `reportes:crear` (asegurado de forma idempotente para `DELEGADO_CUADRILLA`, `PATRULLA_VERIFICADORA` y `ADMIN` en la migración `073`).
2. **Autorización horizontal e integridad ICS:**
   - Salvo `Administrador`, el usuario autenticado debe pertenecer a la patrulla (`usuario_lider_id` o `patrulla_personal`) o cuadrilla (`usuario_delegado_id` o `cuadrilla_personal`) asignada al reporte o incidente destino (`403 Forbidden` en caso contrario).
   - No se permite adjuntar evidencia a incidentes cerrados (`RESUELTO` o `NO_ABORDABLE`), respondiendo `409 Conflict`.
3. **Asociación obligatoria y coherencia relacional:** Cada archivo subido debe vincularse al menos a un `incidente_id` o a un `reporte_terreno_id` válido. Cuando se envía `reporte_terreno_id`, el servidor deriva automáticamente `incidente_id` y `mision_id` desde `reporte_terreno -> mision`; si además se envía un `incidente_id` que no coincide con la misión del reporte, responde `409 Conflict`.
4. **Validación estricta de formato y tamaño:**
   - Tamaño máximo permitido: **10 MB** (`10 * 1024 * 1024` bytes).
   - Tipos MIME autorizados: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`, `video/quicktime`, `application/pdf` (normalizando parámetros de códec como `video/webm;codecs=vp8`).
   - Validación por **magic bytes** estrictos (contenedores de video ISO BMFF válidos para MP4/MOV y cabecera EBML con DocType `webm`, rechazando contenedores de imagen como `ftypheic`/`ftypavif` o imágenes corruptas).
5. **Optimización de espacio en disco:**
   - **Imágenes:** Se redimensionan a un máximo de `1920x1920` px manteniendo relación de aspecto, se eliminan metadatos EXIF y se recomprimen a WebP (calidad `80`) mediante `sharp`.
   - **Videos:** Cuando `ffmpeg` está disponible en el entorno (ej. imagen Docker de producción), se transcodifican a MP4 (H.264 `CRF 28`, máx. `720p`, AAC `96k`, `-movflags +faststart`), conservando la versión comprimida si reduce el tamaño.
   - **Deduplicación SHA-256:** Los archivos se almacenan bajo `${UPLOAD_DIR}/evidencia/<sha256>.<ext>`. Si un archivo idéntico ya existe (por reintentos offline o cargas repetidas), no se duplica en disco.
6. **Notificación en tiempo real:** Al persistirse en `adjunto`, se emite el evento WebSocket `adjunto:creado` (incluyendo `incidenteId` y `misionId` cuando corresponda) hacia las salas del Centro de Mando (`encargado`, `sala:encargados`, `supervisor`).

---

## 2. Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/api/evidencia/adjuntos` | Lista evidencias multimedia filtradas por `incidente_id` y/o `reporte_terreno_id` ordenadas cronológicamente. |
| `POST` | `/api/evidencia/adjuntos` | Recibe un archivo `multipart/form-data`, valida permisos/asociación, optimiza, persiste en `adjunto` y notifica al Centro de Mando. |
| `GET` | `/uploads/evidencia/{filename}` | Sirve archivos de evidencia con cabeceras CORS, `X-Content-Type-Options: nosniff` y soporte `Accept-Ranges: bytes` (`206 Partial Content`). |

---

## 3. Errores Esperables No Obvios

- **`400 Bad Request`:** No se incluyó el campo `file`, el archivo está vacío, o no se envió ninguno de los dos identificadores (`incidente_id` ni `reporte_terreno_id`).
- **`401 Unauthorized`:** Falta token JWT `Authorization: Bearer <token>` válido.
- **`403 Forbidden`:** El usuario no posee `reportes:crear` o intenta adjuntar evidencia en un incidente/reporte asignado a otra patrulla o cuadrilla.
- **`404 Not Found`:** El `incidente_id` o `reporte_terreno_id` enviado no existe en la base de datos.
- **`409 Conflict`:** El incidente está cerrado (`RESUELTO` / `NO_ABORDABLE`) o el `incidente_id` no coincide con el de la misión del `reporte_terreno_id`.
- **`413 Payload Too Large`:** El archivo supera los 10 MB permitidos.
- **`415 Unsupported Media Type`:** El tipo MIME declarado no está permitido, la imagen está corrupta o los *magic bytes* del contenido binario no corresponden a un formato válido.
