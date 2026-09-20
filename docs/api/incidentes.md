# Módulo: Incidentes (Avisos Ciudadanos e Ingreso Manual de Incidentes)

Documentación técnica de los endpoints y lógica de negocio del módulo de **Incidentes** para:
1. La recepción de reportes ciudadanos mediante interfaz conversacional guiada (chatbot) y consulta de estado de seguimiento.
2. El ingreso manual de incidentes por parte de operadores de **Call Center** (llamadas telefónicas) o **Funcionarios en terreno**, con autoverificación implícita, resolución geográfica y promoción inmediata al Encargado.

---

## 1. Reglas de Negocio Aplicadas

- **Ciclo de Vida de los Incidentes (ICS):**
  - Todo reporte ingresado al sistema crea un registro en la tabla `informante` (si no existe previamente por su RUT) y se registra en la tabla `incidente` con estado inicial `REPORTADO`.
  - **Avisos ciudadanos (Chatbot):** Nace en estado inicial `REPORTADO`, requiriendo despacho de patrulla verificadora (`VERIFICANDO`).
  - **Ingreso manual (Call Center / Terreno):** Registrado por operador o funcionario autorizado, se inserta en `informante` e `incidente` con estado inicial **`REPORTADO`**, quedando visible e indexado inmediatamente para el Encargado.
  - **Ciclo de Estados del Incidente según ICS (GEMINI.md Sección 6):**
    - `REPORTADO`: Estado inicial del reporte ingresado (chatbot, llamada telefónica o funcionario).
    - `VERIFICANDO`: Patrulla verificadora en evaluación y constatación de afectación en terreno.
    - `EN_ATENCION`: Cuadrilla operativa o recursos asignados trabajando en el sitio.
    - `NO_ABORDABLE`: Evaluación concluyó que no compete al ámbito municipal o no se constató afectación.
    - `RESUELTO`: Misión concluida y afectación mitigada con éxito.

- **Geocodificación y Geolocalización en Valdivia:**
  - El operador puede ingresar una dirección textual (ej. `"Av. Alemania 550"`, `"Picarte 2000"`, `"Isla Teja"`), y el backend geocodifica automáticamente la ubicación a coordenadas `(latitud, longitud)` y geometría PostGIS `geometry(Point, 4326)` con índice GiST.
  - Si el operador envía coordenadas GPS exactas obtenidas desde un mapa interactivo, el sistema las prioriza directamente.

- **Diferenciación de Origen y Soporte Telefónico (Asterisk):**
  - El formulario exige indicar el origen: `"LLAMADA_TELEFONICA"` o `"FUNCIONARIO_TERRENO"`.
  - Se admiten campos opcionales `asteriskCallId` y `asteriskCallerPhone` para la futura integración directa con la centralita IVR de Asterisk.

- **Detección Espacial de Duplicados en Doble Capa:**
  - Para evitar duplicidad de cuadrillas y recursos, el sistema busca incidentes activos con el mismo tipo de afectación en un radio de **300 metros** y una ventana de **24 horas**.
  - **Capa 1 (Pre-consulta visual):** El frontend puede consultar `POST /api/incidentes/verificar-duplicado` para alertar al operador en tiempo real mientras completa el formulario.
  - **Capa 2 (Confirmación en guardado):** Si `forzarCreacion` es `false` y el backend detecta duplicados al intentar persistir en `POST /api/incidentes/manual`, responde `409 Conflict` adjuntando la lista de coincidencias y distancias en metros. Si el operador decide continuar, el frontend envía `forzarCreacion: true`, registrando el incidente.

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
| `POST` | `/api/incidentes/manual` | `crear_incidente_manual` | Ingresar manualmente un reporte de incidente (llamada o funcionario), registrándolo en `informante` e `incidente` con estado `REPORTADO`. |
| `POST` | `/api/incidentes/verificar-duplicado` | `crear_incidente_manual` | Consultar coincidencias de incidentes cercanos antes de enviar el formulario. |
| `POST` | `/api/incidentes/avisos` | Público | Registrar reporte guiado del chatbot de informante ciudadano con código numérico de seguimiento. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Público | Consultar el estado de avance de un reporte a partir de su código numérico de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Público | Obtener el catálogo oficial de tipos de afectación (`Anegamiento`, `Caída de árbol`, etc.). |

---

## 3. Códigos de Estado y Errores Esperables

- **`POST /api/incidentes/manual`:**
  - **`201 Created`:** Incidente creado exitosamente en estado `REPORTADO`. Retorna datos del incidente y código de seguimiento.
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
