# Módulo de Evidencia (`sgrai-api`)

Documentación técnica de los endpoints del módulo de **Evidencia** para la carga, optimización y consulta de respaldos multimedia en terreno (fotografías, videos y documentos PDF).

---

## 1. Reglas de Negocio y Políticas de Almacenamiento

1. **Permiso RBAC obligatorio:** Todo envío de evidencia requiere el permiso `reportes:crear` (asignado a `DELEGADO_CUADRILLA`, `PATRULLA_VERIFICADORA` y `ADMIN` en la migración `058`).
2. **Asociación obligatoria:** Cada archivo subido debe vincularse al menos a un `incidente_id` o a un `reporte_terreno_id` válido existente en base de datos.
3. **Validación estricta de formato y tamaño:**
   - Tamaño máximo permitido: **10 MB** (`10 * 1024 * 1024` bytes).
   - Tipos MIME autorizados: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`, `video/quicktime`, `application/pdf`.
   - Validación por **magic bytes** para evitar suplantación de extensión o cabecera `Content-Type`.
4. **Optimización de espacio en disco:**
   - **Imágenes:** Se redimensionan a un máximo de `1920x1920` px manteniendo relación de aspecto, se eliminan metadatos EXIF y se recomprimen a WebP (calidad `80`) mediante `sharp`.
   - **Videos:** Cuando `ffmpeg` está disponible en el entorno (ej. imagen Docker de producción), se transcodifican a MP4 (H.264 `CRF 28`, máx. `720p`, AAC `96k`, `-movflags +faststart`), conservando la versión comprimida si reduce el tamaño.
   - **Deduplicación SHA-256:** Los archivos se almacenan bajo `${UPLOAD_DIR}/evidencia/<sha256>.<ext>`. Si un archivo idéntico ya existe (por reintentos offline o cargas repetidas), no se duplica en disco.
5. **Notificación en tiempo real:** Al persistirse en `adjunto`, se emite el evento WebSocket `adjunto:creado` hacia las salas del Centro de Mando (`encargado`, `sala:encargados`, `supervisor`).

---

## 2. Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/api/evidencia/adjuntos` | Recibe un archivo `multipart/form-data`, lo optimiza, lo persiste en `adjunto` y notifica al Centro de Mando. |
| `GET` | `/uploads/evidencia/{filename}` | Sirve archivos de evidencia con soporte `Accept-Ranges: bytes` (`206 Partial Content`) para streaming de video. |

---

## 3. Errores Esperables No Obvios

- **`400 Bad Request`:** No se incluyó el campo `file`, el archivo está vacío, o no se envió ninguno de los dos identificadores (`incidente_id` ni `reporte_terreno_id`).
- **`413 Payload Too Large`:** El archivo supera los 10 MB permitidos.
- **`415 Unsupported Media Type`:** El tipo MIME declarado no está en la lista blanca o los *magic bytes* del contenido binario no coinciden con el tipo declarado.
- **`404 Not Found`:** El `incidente_id` o `reporte_terreno_id` enviado no existe en la base de datos.
