# Módulo: Incidentes (Avisos de Incidente - Chatbot Informante)

Documentación técnica de los endpoints y lógica de negocio del módulo de **Incidentes** para la recepción de reportes ciudadanos mediante interfaz conversacional guiada (chatbot) y consulta de estado de seguimiento.

---

## 1. Reglas de Negocio Aplicadas

- **Ciclo de Vida de los Incidentes (ICS):**
  - Todo reporte ingresado por la ciudadanía a través del chatbot nace con el estado inicial `PENDIENTE_VERIFICACION`.
  - La posterior asignación y despacho de una patrulla verificadora transiciona el reporte hacia `VERIFICANDO`, y al confirmarse y escalarse en terreno hacia `EN_ATENCION` con asignación de cuadrillas y recursos logísticos.
- **Geocodificación y Geolocalización en Valdivia:**
  - El informante no está obligado a capturar coordenadas GPS en terreno. Ingresa la dirección textual (ej. calle, sector o número), y el backend geocodifica la ubicación resolviendo coordenadas geográficas `(latitud, longitud)` centradas en la comuna de Valdivia.
  - La entidad persiste una columna espacial `ubicacion` de tipo `geometry(Point, 4326)` con índice GiST para búsquedas espaciales y representación cartográfica.
- **Detección Espacial de Duplicados (Inspirado en SAESA):**
  - Para evitar la duplicidad de recursos ante un mismo evento (ej. caída de árbol o anegamiento), el sistema busca reportes previos con el **mismo tipo de afectación** dentro de un radio de **300 metros** (`ST_DWithin` sobre tipo `geography`) y una ventana de tiempo de **24 horas**.
  - Si se detecta un incidente previo:
    - Se registra el nuevo reporte con `es_duplicado = true` y `aviso_original_id` referenciando al original para métricas de analítica municipal.
    - Se responde con código HTTP `200 OK` informando la duplicidad y entregando el **código de seguimiento existente** para que el informante pueda consultar el estado de atención del reporte original.
  - Si no existe duplicado:
    - Se genera un nuevo código numérico de 8 dígitos único y se responde con código HTTP `201 Created`.
- **Validación de Identidad Ciudadana:**
  - El RUT del informante es validado algorítmicamente bajo la fórmula oficial chilena de módulo 11 antes de permitir la persistencia.
- **Acceso Público:**
  - Los endpoints de avisos y consulta de seguimiento son de acceso público para la ciudadanía y no requieren de la cabecera administrativa `X-User-Id`.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `POST` | `/api/incidentes/avisos` | Registrar reporte guiado del chatbot, ejecutar geocodificación, detección espacial de duplicados y retornar código numérico de seguimiento. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Consultar el estado de avance de un reporte a partir de su código numérico de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Obtener el catálogo oficial de tipos de afectación para poblar los botones/chips del chat en frontend (`sgrai-web` y `sgrai-pwa`). |

---

## 3. Códigos de Estado y Errores Esperables

- **`POST /api/incidentes/avisos`:**
  - **`201 Created`:** El reporte fue registrado exitosamente como un nuevo aviso con código de seguimiento generado.
  - **`200 OK`:** El reporte fue detectado como duplicado de un incidente ya informado en la misma zona. Se entrega el número de seguimiento existente.
  - **`400 Bad Request`:** Cuerpo JSON inválido, campos requeridos ausentes, dirección menor a 5 caracteres, tipo de afectación no reconocido o RUT con dígito verificador erróneo.
  - **`500 Internal Server Error`:** Falla de conexión a base de datos o error interno no controlado.

- **`GET /api/incidentes/avisos/seguimiento/{codigo}`:**
  - **`200 OK`:** Reporte encontrado; retorna estado actual (`PENDIENTE_VERIFICACION`, `VERIFICANDO`, `EN_ATENCION`, etc.), dirección y tipo de afectación.
  - **`400 Bad Request`:** Código de seguimiento vacío o no especificado.
  - **`404 Not Found`:** No existe ningún aviso asociado al código numérico ingresado.
  - **`500 Internal Server Error`:** Error interno del servidor.

- **`GET /api/incidentes/tipos`:**
  - **`200 OK`:** Retorna arreglo con las opciones de afectación válidas (`Anegamiento`, `Caída de árbol`, `Corte de energía`, `Deslizamiento`, `Daño estructural`, `Corte de agua potable`, `Otro`).

---

## 4. Integración con Frontends (`sgrai-web` y `sgrai-pwa`)

Los clientes web y PWA no deben implementar lógica de cálculo de duplicados ni validación de RUT manual divergente:
- Deben consumir la especificación generada en `GET /openapi.json` para generar automáticamente los tipos TypeScript de las peticiones y respuestas.
- El chatbot en frontend debe enviar el consolidado al endpoint `POST /api/incidentes/avisos` al finalizar las preguntas guiadas.
