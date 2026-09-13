# Módulo: Incidentes (Avisos Ciudadanos e Ingreso Manual de Incidentes)

Documentación técnica de los endpoints y lógica de negocio del módulo de **Incidentes** para:
1. La recepción de reportes ciudadanos mediante interfaz conversacional guiada (chatbot) y consulta de estado de seguimiento.
2. El ingreso manual de incidentes por parte de operadores de **Call Center** (llamadas telefónicas) o **Funcionarios en terreno**, con autoverificación implícita, resolución geográfica y promoción inmediata al Encargado.

---

## 1. Reglas de Negocio Aplicadas

- **Ciclo de Vida de los Incidentes (ICS):**
  - **Avisos ciudadanos:** Todo reporte ingresado a través del chatbot nace como aviso con estado inicial `PENDIENTE_VERIFICACION`, requiriendo despacho de patrulla verificadora.
  - **Ingreso manual (Call Center / Terreno):** Al ser ingresado manualmente por un operador autorizado o funcionario, el reporte se considera **implícitamente verificado**. En una **única transacción atómica**, el sistema inserta el registro en `aviso_incidente` y lo promueve inmediatamente a la tabla `incidente` en estado inicial **`SIN_ATENDER`**, quedando indexado y visible para el Encargado.
  - **Ciclo de Estados del Incidente Promovido:**
    - `SIN_ATENDER`: Estado inicial del incidente. A la espera de que el Encargado asigne recursos o cuadrillas.
    - `ASIGNADO`: Recursos o cuadrillas designadas por el Encargado, en trayecto al lugar.
    - `EN_TERRENO`: Cuadrilla o personal operando en el sitio de la afectación.
    - `RESUELTO`: Misión concluida y afectación mitigada.
    - `DESCARTADO`: Duplicado tardío, falsa alarma o no abordable.

- **Geocodificación y Geolocalización en Valdivia:**
  - El operador puede ingresar una dirección textual (ej. `"Av. Alemania 550"`, `"Picarte 2000"`, `"Isla Teja"`), y el backend geocodifica automáticamente la ubicación a coordenadas `(latitud, longitud)` y geometría PostGIS `geometry(Point, 4326)` con índice GiST.
  - Si el operador envía coordenadas GPS exactas obtenidas desde un mapa interactivo, el sistema las prioriza directamente.

- **Diferenciación de Origen y Soporte Telefónico (Asterisk):**
  - El formulario exige indicar el origen: `"LLAMADA_TELEFONICA"` o `"FUNCIONARIO_TERRENO"`.
  - Se admiten campos opcionales `asteriskCallId` y `asteriskCallerPhone` para la futura integración directa con la centralita IVR de Asterisk.

- **Detección Espacial de Duplicados en Doble Capa:**
  - Para evitar duplicidad de cuadrillas y recursos, el sistema busca incidentes y avisos activos con el mismo tipo de afectación en un radio de **300 metros** y una ventana de **24 horas**.
  - **Capa 1 (Pre-consulta visual):** El frontend puede consultar `POST /api/incidentes/verificar-duplicado` para alertar al operador en tiempo real mientras completa el formulario.
  - **Capa 2 (Confirmación en guardado):** Si `forzarCreacion` es `false` y el backend detecta duplicados al intentar persistir en `POST /api/incidentes/manual`, responde `409 Conflict` adjuntando la lista de coincidencias y distancias en metros. Si el operador decide continuar, el frontend envía `forzarCreacion: true`, registrando el incidente y vinculando el aviso original.

- **Validación de Identidad Ciudadana:**
  - El RUT del informante es obligatorio en el ingreso manual y es validado algorítmicamente mediante módulo 11 chileno.

- **Control de Acceso (RBAC):**
  - El ingreso manual y la verificación de duplicados requieren la cabecera `X-User-Id` correspondiente a un usuario con el permiso **`crear_incidente_manual`** (roles `Call Center` y `Administrador`).

- **Notificaciones en Tiempo Real (Socket.io):**
  - Tras la persistencia exitosa del incidente, se emite el evento `incidente:creado` a la sala `sala:encargados`.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Permiso Requerido | Propósito |
|---|---|---|---|
| `POST` | `/api/incidentes/manual` | `crear_incidente_manual` | Ingresar manualmente un reporte de incidente (llamada o funcionario), autoverificarlo y crearlo en `incidente` con estado `SIN_ATENDER`. |
| `POST` | `/api/incidentes/verificar-duplicado` | `crear_incidente_manual` | Consultar coincidencias de incidentes o reportes cercanos antes de enviar el formulario. |
| `POST` | `/api/incidentes/avisos` | Público | Registrar reporte guiado del chatbot de informante ciudadano con código numérico de seguimiento. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Público | Consultar el estado de avance de un reporte a partir de su código numérico de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Público | Obtener el catálogo oficial de tipos de afectación (`Anegamiento`, `Caída de árbol`, etc.). |

---

## 3. Códigos de Estado y Errores Esperables

- **`POST /api/incidentes/manual`:**
  - **`201 Created`:** Incidente creado exitosamente y promovido a estado `SIN_ATENDER`. Retorna datos del incidente y del aviso asociado.
  - **`400 Bad Request`:** Cuerpo JSON inválido, RUT con dígito verificador incorrecto, campos requeridos ausentes o descripción/dirección menor a 5 caracteres.
  - **`401 Unauthorized`:** Cabecera `X-User-Id` ausente o usuario inexistente en el sistema.
  - **`403 Forbidden`:** El usuario autenticado no posee el permiso `crear_incidente_manual` (no pertenece al rol `Call Center` ni `Administrador`).
  - **`409 Conflict`:** Se detectaron incidentes o reportes similares cercanos dentro de la ventana de tiempo reciente. Retorna `{ requiereConfirmacion: true, duplicados: [...] }`. Para ignorar y forzar, enviar `forzarCreacion: true`.
  - **`500 Internal Server Error`:** Falla de conexión a base de datos o error interno no controlado.

- **`POST /api/incidentes/verificar-duplicado`:**
  - **`200 OK`:** Verificación completada exitosamente. Retorna `{ hayDuplicados: boolean, coincidencias: [...] }` con distancias calculadas en metros.
  - **`400 Bad Request`:** Dirección vacía o tipo de afectación no reconocido.
  - **`401 / 403`:** Falta de autenticación o permisos.
  - **`500 Internal Server Error`:** Error interno del servidor.

- **`POST /api/incidentes/avisos`:**
  - **`201 Created`:** Aviso registrado exitosamente como nuevo reporte ciudadano.
  - **`200 OK`:** Reporte detectado como duplicado; se retorna el código de seguimiento existente.
  - **`400 Bad Request`:** Datos inválidos.
  - **`500 Internal Server Error`:** Error interno del servidor.

- **`GET /api/incidentes/avisos/seguimiento/{codigo}`:**
  - **`200 OK`:** Reporte encontrado; retorna estado actual, dirección y tipo de afectación.
  - **`404 Not Found`:** No existe ningún aviso asociado al código numérico ingresado.
  - **`500 Internal Server Error`:** Error interno del servidor.

---

## 4. Integración con Frontends (`sgrai-web` y `sgrai-pwa`)

- **Tipado Automático:** Los clientes web y PWA deben generar automáticamente sus tipos TypeScript a partir de `GET /openapi.json`.
- **Cabecera de Autenticación:** Las solicitudes al formulario de Call Center deben adjuntar la cabecera `X-User-Id: <UUID-DEL-OPERADOR>`.
- **Manejo de Duplicados en Frontend:**
  1. Al desenfocar el campo dirección o tipo de afectación, llamar opcionalmente a `/api/incidentes/verificar-duplicado` para mostrar una advertencia visual.
  2. Al enviar el formulario, si la API responde `409 Conflict`, mostrar un modal informativo con los duplicados encontrados y los botones *"Omitir reporte"* (descartar) o *"Continuar de todos modos"* (reenviar con `forzarCreacion: true`).
