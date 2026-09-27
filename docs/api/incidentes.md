# Módulo: Incidentes (Recepción Ciudadana, Ingreso Manual y Tablero Kanban)

Documentación técnica de los endpoints, eventos en tiempo real y lógica de negocio del módulo de **Incidentes**, alineado con el **Diagrama Entidad-Relación (ERD)** oficial del SGRAI para:
1. La recepción de reportes ciudadanos mediante interfaz conversacional guiada (chatbot) y consulta de estado de seguimiento sin jerga técnica.
2. El ingreso manual de incidentes por parte de operadores de **Call Center** (llamadas telefónicas) o **Funcionarios en terreno**, con autoverificación implícita, resolución geográfica y promoción inmediata al Encargado.
3. La gestión operativa centralizada para el **Encargado de Emergencias** mediante el tablero Kanban en tiempo real y consulta exhaustiva del detalle de incidentes.

---

## 1. Reglas de Negocio y Modelo de Datos (ERD Alignment)

- **Alineación con Diagrama Entidad-Relación:**
  - El sistema no utiliza tablas intermedias artificiales (no existe `aviso_incidente`).
  - Las entidades de persistencia son **`Informante`** (ciudadano que ingresa el reporte) e **`Incidente`** (entidad operativa central del SGRAI).
  - Un informante puede tener múltiples incidentes reportados (`Informante 1 -- tiene -- N Incidente`).

- **Ciclo de Vida de los Incidentes (ICS) - Sección 6 de GEMINI.md:**
  - Todo reporte ingresado al sistema crea un registro en `informante` (si no existe previamente por su RUT) y se registra en `incidente` con estado inicial **`REPORTADO`**.
  - **Avisos ciudadanos (Chatbot):** Nace en estado `REPORTADO`, requiriendo despacho de patrulla verificadora (`VERIFICANDO`).
  - **Ingreso manual (Call Center / Terreno):** Registrado por operador o funcionario autorizado, se inserta en `informante` e `incidente` con estado inicial **`REPORTADO`**, quedando visible e indexado inmediatamente para el Encargado.
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

- **Política de No Expiración y Sanitización:**
  - El código de seguimiento **no expira**.
  - Si un incidente ya fue resuelto o cerrado, el informante continuará teniendo acceso a su panel de seguimiento, observando el estado final (`Resuelto` o `No Abordable`) y la fecha de cierre.
  - La respuesta de seguimiento es pública mediante el código de 8 dígitos y **nunca expone** datos personales protegidos (RUT del informante, teléfono, nombres de operadores ni notas reservadas internas).

- **Geocodificación y Detección Espacial de Duplicados en Valdivia:**
  - El backend resuelve coordenadas geográficas automáticas centradas en Valdivia mediante PostGIS (`geometry(Point, 4326)` con índice GiST).
  - Detección espacial de reportes similares en un radio de 300 metros y ventana de 24 horas.
  - **Capa 1 (Pre-consulta visual):** El frontend puede consultar `POST /api/incidentes/verificar-duplicado` para alertar al operador en tiempo real mientras completa el formulario.
  - **Capa 2 (Confirmación en guardado):** Si `forzarCreacion` es `false` y el backend detecta duplicados al intentar persistir en `POST /api/incidentes/manual`, responde `409 Conflict` adjuntando la lista de coincidencias. Con `forzarCreacion: true`, se permite registrar el incidente forzosamente.

- **Tiempo Real (Socket.io):**
  - Cada informante conectado en su panel de seguimiento se une a la sala: `sala:seguimiento:{codigoSeguimiento}`, recibiendo `incidente:estado_actualizado`.
  - Para los encargados y operadores en su puesto de comando, el backend emite a `sala:encargados`:
    - `incidente:creado`: nueva tarjeta en tiempo real.
    - `incidente:actualizado`: cambio de estado, prioridad o gestión operativa para actualizar el tablero Kanban.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Permiso Requerido | Propósito |
|---|---|---|---|
| `POST` | `/api/incidentes/avisos` | Público | Registrar reporte guiado del chatbot de informante ciudadano con código numérico de seguimiento. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Público | Consultar el estado de avance de un reporte a partir de su código numérico de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Público | Obtener el catálogo oficial de tipos de afectación (`Anegamiento`, `Caída de árbol`, etc.). |
| `POST` | `/api/incidentes/manual` | `crear_incidente_manual` | Ingresar manualmente un reporte de incidente (llamada o funcionario), registrándolo en `informante` e `incidente` con estado `REPORTADO`. |
| `POST` | `/api/incidentes/verificar-duplicado` | `crear_incidente_manual` | Consultar coincidencias de incidentes cercanos antes de enviar el formulario. |
| `GET` | `/api/incidentes` | `incidentes:kanban` | Listar incidentes registrados con paginación Kysely y filtros para el tablero Kanban del Encargado. |
| `GET` | `/api/incidentes/{id}` | `incidentes:kanban` | Consultar detalle exhaustivo de un caso particular (informante, misiones, cuadrilla, patrulla y recursos asociados). |

---

## 3. Códigos de Estado y Errores Esperables

- **`GET /api/incidentes` (Tablero Kanban Paginado):**
  - **`200 OK`:** Retorna la lista de incidentes resumidos (`data`) y los metadatos de paginación (`paginacion: { total, pagina, limite, totalPaginas, tieneSiguiente, tieneAnterior }`).
  - **`400 Bad Request`:** Parámetros de query fuera de rango (ej. `page < 1` o `limit > 100`).
  - **`401 Unauthorized`:** Cabecera `X-User-Id` ausente o no registrada.
  - **`403 Forbidden`:** El usuario no posee el permiso `incidentes:kanban`.
  - **`500 Internal Server Error`:** Falla de conexión o error no controlado en base de datos.

- **`GET /api/incidentes/{id}` (Detalle del Incidente):**
  - **`200 OK`:** Incidente encontrado. Retorna datos geográficos, informante, delegación, misiones operativas, cuadrillas y recursos asociados.
  - **`400 Bad Request`:** El parámetro `id` no es un UUID válido.
  - **`401 Unauthorized`:** Cabecera `X-User-Id` ausente.
  - **`403 Forbidden`:** Usuario no autorizado sin permiso `incidentes:kanban`.
  - **`404 Not Found`:** No existe ningún incidente con el UUID proporcionado.
  - **`500 Internal Server Error`:** Error interno del servidor.

- **`POST /api/incidentes/manual`:**
  - **`201 Created`:** Incidente creado exitosamente en estado `REPORTADO`. Retorna datos del incidente y código de seguimiento.
  - **`400 Bad Request`:** Cuerpo JSON inválido, RUT con dígito verificador incorrecto o campos requeridos ausentes.
  - **`401 Unauthorized`:** Cabecera `X-User-Id` ausente o usuario inexistente.
  - **`403 Forbidden`:** El usuario no posee el permiso `crear_incidente_manual`.
  - **`409 Conflict`:** Se detectaron incidentes similares cercanos. Retorna coincidencias. Para forzar, enviar `forzarCreacion: true`.
  - **`500 Internal Server Error`:** Falla de conexión a base de datos o error interno.

- **`POST /api/incidentes/verificar-duplicado`:**
  - **`200 OK`:** Verificación completada exitosamente. Retorna `{ hayDuplicados: boolean, coincidencias: [...] }`.
  - **`400 Bad Request`:** Dirección vacía o tipo de afectación no reconocido.
  - **`401 / 403`:** Falta de autenticación o permisos.
  - **`500 Internal Server Error`:** Error interno del servidor.

- **`POST /api/incidentes/avisos`:**
  - **`201 Created`:** Aviso registrado exitosamente como nuevo reporte ciudadano.
  - **`200 OK`:** Reporte detectado como duplicado; se retorna el código de seguimiento existente.
  - **`400 Bad Request`:** Datos inválidos o RUT chileno inválido (módulo 11).
  - **`500 Internal Server Error`:** Error interno del servidor.

- **`GET /api/incidentes/avisos/seguimiento/{codigo}`:**
  - **`200 OK`:** Incidente encontrado. Retorna estado comprensible, descripción ciudadana, tipo de afectación, dirección y fechas.
  - **`400 Bad Request`:** Código de seguimiento ausente o inválido.
  - **`404 Not Found`:** No existe ningún aviso asociado al código numérico ingresado.
  - **`500 Internal Server Error`:** Error interno del servidor.

---

## 4. Integración con Frontends (`sgrai-web` y `sgrai-pwa`)

- **Tipado Automático:** Los clientes web y PWA deben generar automáticamente sus tipos TypeScript a partir de `GET /openapi.json`.
- **Cabeceras de Autenticación:** Las solicitudes operativas deben adjuntar la cabecera `X-User-Id: <UUID-DEL-USUARIO>`.
- **Manejo de Duplicados en Frontend (Call Center):**
  1. Al desenfocar el campo dirección o tipo de afectación, llamar opcionalmente a `/api/incidentes/verificar-duplicado` para mostrar una advertencia visual.
  2. Si la API responde `409 Conflict`, mostrar un modal con los duplicados encontrados y los botones *"Omitir reporte"* (descartar) o *"Continuar de todos modos"* (reenviar con `forzarCreacion: true`).
- **Conexión en Tiempo Real (Socket.io) para Tablero Kanban:**
  1. Al cargar la vista Kanban del Encargado, realizar llamada inicial a `GET /api/incidentes?page=1&limit=20` con cabecera `X-User-Id`.
  2. Emitir `socket.emit("unirse", "sala:encargados")`.
  3. Escuchar `incidente:creado` e `incidente:actualizado` para mover las tarjetas en tiempo real entre columnas.
