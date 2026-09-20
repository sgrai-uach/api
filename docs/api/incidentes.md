# Módulo: Incidentes (Recepción Ciudadana y Panel de Seguimiento)

Documentación técnica de los endpoints, eventos en tiempo real y lógica de negocio del módulo de **Incidentes**, alineado con el **Diagrama Entidad-Relación (ERD)** oficial del SGRAI para la recepción de reportes ciudadanos y consulta del panel de seguimiento para informantes.

---

## 1. Reglas de Negocio y Modelo de Datos (ERD Alignment)

- **Alineación con Diagrama Entidad-Relación:**
  - El sistema no utiliza tablas intermedias artificiales (no existe `aviso_incidente`).
  - Las entidades de persistencia son **`Informante`** (ciudadano que ingresa el reporte) e **`Incidente`** (entidad operativa central del SGRAI).
  - Un informante puede tener múltiples incidentes reportados (`Informante 1 -- tiene -- N Incidente`).

- **Ciclo de Vida de los Incidentes (ICS):**
  - Todo reporte ingresado por la ciudadanía a través del chatbot nace con el estado inicial **`REPORTADO`**.
  - Al asignarse una patrulla verificadora en terreno, el estado avanza a **`VERIFICANDO`**.
  - Al confirmarse la emergencia y despacharse cuadrillas o recursos logísticos, avanza a **`EN_ATENCION`**.
  - Si la situación fue mitigada satisfactoriamente, culmina en **`RESUELTO`**.
  - Si tras la verificación se constata que no corresponde al ámbito municipal o fue una falsa alarma, se clasifica como **`NO_ABORDABLE`**.

- **Catálogo de Estados y Descripciones Ciudadanas (Sin Jerga Técnica):**
  Para que cualquier vecino comprenda fácilmente el estado de su emergencia en el panel de seguimiento, la API provee directamente la etiqueta formal, la etiqueta amigable y su explicación clara:

| Estado (`enum`) | Etiqueta Amigable | Descripción Ciudadana (Clara y sin tecnicismos) |
|---|---|---|
| **`REPORTADO`** | Reportado | *Hemos recibido tu reporte de emergencia en nuestra central. Pronto será evaluado por el equipo de operaciones.* |
| **`VERIFICANDO`** | En Verificación | *Una patrulla municipal de respuesta rápida se dirige o se encuentra en el lugar evaluando la situación y los riesgos en terreno.* |
| **`EN_ATENCION`** | En Atención | *El incidente fue confirmado en terreno y una cuadrilla operativa municipal está trabajando en el lugar para atender la emergencia.* |
| **`NO_ABORDABLE`** | No Abordable | *El caso fue evaluado por el equipo pero no corresponde al ámbito de acción municipal, o bien no se constató afectación en el lugar.* |
| **`RESUELTO`** | Resuelto | *Los trabajos de mitigación y respuesta municipal han finalizado con éxito en el lugar de la emergencia.* |

- **Política de No Expiración:**
  - El código de seguimiento **no expira**.
  - Si un incidente ya fue resuelto o cerrado, el informante continuará teniendo acceso a su panel de seguimiento, donde observará el estado final (`Resuelto` o `No Abordable`) y la fecha de cierre.

- **Sanitización Estricta de Datos Sensibles:**
  - La respuesta de seguimiento es pública mediante el código de 8 dígitos y **nunca expone** datos personales protegidos (RUT del informante, teléfono, nombres de operadores ni notas reservadas internas).

- **Geocodificación y Detección de Duplicados en Valdivia:**
  - El backend resuelve coordenadas geográficas automáticas centradas en Valdivia mediante PostGIS (`geometry(Point, 4326)` con índice GiST).
  - Detección espacial de reportes similares en un radio de 300 metros y ventana de 24 horas. Ante duplicados, se retorna el código de seguimiento existente.

- **Tiempo Real (Socket.io):**
  - Cada informante conectado en su panel de seguimiento se une a la sala:
    `sala:seguimiento:{codigoSeguimiento}`
  - Ante cualquier cambio de estado gestionado por la central o en terreno, el backend emite el evento:
    `incidente:estado_actualizado`
  - El payload del evento incluye el nuevo estado, la etiqueta amigable, la descripción ciudadana actualizada y la marca de tiempo.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `POST` | `/api/incidentes/avisos` | Registrar reporte guiado del chatbot, crear o vincular al informante, registrar incidente y entregar código de seguimiento. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Consultar el estado de avance de un incidente para el panel del informante por su código numérico de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Obtener el catálogo oficial de tipos de afectación para las opciones del chatbot. |

---

## 3. Códigos de Estado y Errores Esperables

- **`GET /api/incidentes/avisos/seguimiento/{codigo}`:**
  - **`200 OK`:** Incidente encontrado exitosamente. Retorna estado normalizado, etiqueta comprensible, descripción clara sin tecnicismos, tipo de afectación, dirección de referencia y fechas.
  - **`400 Bad Request`:** Código de seguimiento ausente o compuesto únicamente por espacios en blanco.
  - **`404 Not Found`:** No existe ningún incidente asociado al código numérico ingresado.
  - **`500 Internal Server Error`:** Error interno del servidor o falla de base de datos.

- **`POST /api/incidentes/avisos`:**
  - **`201 Created`:** Incidente y registro de informante creados exitosamente. Retorna código de 8 dígitos generado.
  - **`200 OK`:** Duplicado detectado en la zona. Retorna el código de seguimiento del reporte existente.
  - **`400 Bad Request`:** RUT chileno inválido (falla módulo 11), dirección menor a 5 caracteres o tipo no reconocido.
  - **`500 Internal Server Error`:** Error interno no controlado.

---

## 4. Integración con Frontends (`sgrai-web` y `sgrai-pwa`)

- **Tipado Automático:** Los clientes deben generar sus tipos TypeScript consumiendo `GET /openapi.json`.
- **Conexión en Tiempo Real (Socket.io):**
  1. Al cargar la vista del panel de seguimiento con el código `58291045`, el cliente realiza la llamada inicial a `GET /api/incidentes/avisos/seguimiento/58291045`.
  2. El cliente emite `socket.emit("unirse", "sala:seguimiento:58291045")`.
  3. El cliente escucha `socket.on("incidente:estado_actualizado", (data) => ...)` para actualizar dinámicamente el badge de estado, la barra de progreso y la descripción sin recargar la página.
