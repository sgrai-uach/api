# Módulo: Eventos ATP (Prevención y Puntos Críticos) — Documentación Técnica de API

Este documento describe la operativa técnica de los endpoints y reglas de negocio del módulo de **Eventos ATP** (Alerta Temprana Preventiva, Prevención y Puntos Críticos) en el backend monolítico modular `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Monitoreo del Administrador y panel del Encargado) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Eventos ATP** gestiona los puntos críticos, sectores de alta vulnerabilidad y eventos de mitigación/prevención en la comuna de Valdivia:

1. **Monitoreo de Puntos Críticos y Sectores Vulnerables (HU-57):**
   - El sistema almacena y cataloga los sectores geográficos vulnerables recurrentes de Valdivia (ej. humedales, riberas de ríos, laderas de cerros propensas a remoción en masa, zonas bajas propensas a anegamiento).
   - Se gestionan en la base de datos relacional mediante la tabla `prevencion`.
2. **Despacho Preventivo sin Incidente Formal Previo (HU-30):**
   - Conforme a la regla de dominio crítica de `GEMINI.md` (Sección 6), las misiones preventivas de cuadrillas o patrullas pueden despacharse directamente sobre un punto crítico o coordenadas libres (`mision.evento_prevencion_id`) **sin necesidad de que exista un incidente formal reportado previamente**.
3. **Procedencia Territorial por Delegaciones:**
   - Cada punto crítico y evento preventivo está asignado a una de las cuatro delegaciones territoriales de Valdivia:
     - **Delegación Municipal Norte**
     - **Delegación Municipal Sur**
     - **Delegación Municipal Costa**
     - **Delegación Municipal Calle Calle**
   - Aquellos registros sin delegación asignada (`delegacion_id = null`) corresponden a puntos monitoreados por la central comunal de emergencias.
4. **Geolocalización Espacial (PostGIS):**
   - Todo punto crítico y evento almacena sus coordenadas geográficas en EPSG:4326 (`latitud`, `longitud`) y las indexa con GIST sobre la columna geométrica `ubicacion` (`Point`), permitiendo visualizaciones en mapas interactivos y futuros cálculos de proximidad de recursos.
5. **Control de Acceso Basado en Roles (RBAC):**
   - La consulta y edición de puntos críticos (`/api/puntos-criticos`) está **restringida estrictamente al rol `Administrador`** del sistema (`puntos_criticos:leer`, `puntos_criticos:editar`, `puntos_criticos:eliminar`).
   - La creación de eventos de prevención (`POST /api/eventos-atp/prevencion`) requiere el permiso institucional `prevencion:eventos:crear`, asignado a los roles `Encargado` y `Administrador`.
   - Cualquier petición anónima es rechazada con `401 Unauthorized`.
   - Peticiones no autorizadas se rechazan con `403 Forbidden`.
6. **Respuesta ante Lista Vacía (Criterio de Aceptación 3):**
   - Si no existen puntos críticos registrados en la base de datos (o si los filtros aplicados no retornan coincidencias), la API responde `200 OK` con un arreglo vacío `data: []` y `total: 0`. Esto permite al frontend (`sgrai-web`) desplegar de forma limpia su mensaje de estado vacío ("No hay puntos críticos registrados") sin incurrir en excepciones.
7. **Edición y Reubicación Dinámica con Notificación en Tiempo Real (HU-55):**
   - El Administrador puede modificar los datos descriptivos y reubicar las coordenadas de un punto crítico en cualquier momento. El backend recalcula la geometría PostGIS y difunde el evento `"punto_critico:actualizado"` vía Socket.io a la central, supervisores y unidades en terreno para su actualización inmediata.
   - El código institucional es inmutable. No se permite editar puntos inactivos (`409 Conflict`).
8. **Borrado Lógico y Auditoría (HU-56):**
   - Para mantener la trazabilidad de eventos preventivos pasados asociados a una coordenada (y el histórico requerido para reportería SENAPRED), la desactivación de un punto crítico **no destruye físicamente el registro**. En su lugar, se actualiza `activo = false`, registrando de forma inmutable la estampa de tiempo `eliminado_en` y el UUID del usuario responsable `eliminado_por_id`.
9. **Protección de Operaciones Activas en Terreno (HU-56):**
   - Si el punto crítico se encuentra vinculado a una misión preventiva activa (estados `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`) o tiene una patrulla/cuadrilla asignada, la API **rechaza la solicitud de eliminación con código HTTP `409 Conflict`**, evitando dejar unidades operativas huérfanas o desarticular el plan de contingencia en curso.
10. **Sincronización Reactiva en Tiempo Real (Socket.io):**
    - Al procesarse la eliminación lógica, la API emite el evento `"punto_critico:eliminado"` a las salas `"encargado"` y `"supervisor"`, así como en difusión global.
    - Al crearse un evento preventivo, se emite el evento `"prevencion:creada"` a `sala:encargados`, `mapa` y la sala de la patrulla asignada (`patrulla:<patrullaId>`).

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/puntos-criticos` | Listar los puntos críticos y sectores vulnerables monitoreados con paginación, filtros territoriales/prioridad y datos de delegación asociada (HU-57). |
| `GET` | `/api/puntos-criticos/{id}` | Obtener detalle de un punto crítico con delegación para precargar formulario de edición (HU-55). |
| `PUT` | `/api/puntos-criticos/{id}` | Editar características, factores de riesgo y ubicación geográfica de un punto crítico con PostGIS y Socket.io (HU-55). |
| `DELETE` | `/api/puntos-criticos/{id}` | Desactivar (borrado lógico) un punto crítico comunal, validando dependencias operativas y notificando vía Socket.io (HU-56). |
| `POST` | `/api/eventos-atp/prevencion` | Registrar un nuevo evento de prevención georreferenciado, asignar recursos y despachar patrulla verificadora en tiempo real (HU-30). |

> Nota: Los contratos OpenAPI 3.0 se autogeneran a partir de los esquemas Zod y están expuestos públicamente en `GET /openapi.json`.

---

## 3. Detalle de Endpoint: `GET /api/puntos-criticos` (HU-57)

Retorna una lista paginada de los puntos críticos registrados, incluyendo sus factores de riesgo, prioridad operativa, coordenadas y la delegación municipal responsable.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con rol `Administrador`. |

### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `pagina` | `number` | No | `1` | Número de página (inicia en 1). |
| `limite` | `number` | No | `10` | Cantidad de elementos por página (máximo: 100). |
| `delegacionId` | `UUID` | No | - | Filtra por identificador de delegación municipal. |
| `activo` | `boolean` | No | - | Filtra por vigencia operativa (`true` o `false`). |
| `prioridad` | `string` | No | - | Filtra por nivel de riesgo (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). |
| `busqueda` | `string` | No | - | Búsqueda insensible a mayúsculas por código, nombre, tipo de riesgo o descripción. |

---

## 4. Detalle de Endpoint: `GET /api/puntos-criticos/{id}` (HU-55)

Obtiene el detalle completo de un punto crítico específico para precargar los datos en el formulario de edición en `sgrai-web`.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con rol `Administrador`. |

### Parámetros de Ruta

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | `UUID` | Sí | Identificador único del punto crítico. |

---

## 5. Detalle de Endpoint: `PUT /api/puntos-criticos/{id}` (HU-55)

Permite al Administrador modificar las características, factores de riesgo y ubicación geográfica interactiva de un punto crítico comunal.

### Reglas de Negocio Específicas de Edición:
1. **Inmutabilidad del Código:** El código institucional (`codigo`) es inmutable tras la creación.
2. **Exclusión del Estado Operativo:** El estado `activo` no es editable en este formulario; la vigencia se gestiona exclusivamente mediante el ciclo de borrado lógico. Puntos inactivos no pueden ser editados (`409 Conflict`).
3. **Reubicación Dinámica con Notificación en Tiempo Real:** Emite `"punto_critico:actualizado"` vía Socket.io a la central de despacho, supervisores y patrullas/cuadrillas en terreno.
4. **Persistencia Geoespacial PostGIS:** Al actualizar coordenadas numéricas WGS84, el backend recalcula y persiste la geometría espacial `ubicacion = ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)`.
5. **Auditoría de Modificación:** Se actualiza `actualizado_en = CURRENT_TIMESTAMP` y `actualizado_por_id`.

---

## 6. Detalle de Endpoint: `DELETE /api/puntos-criticos/{id}` (HU-56)

Aplica el **borrado lógico** (*soft delete*) de un punto crítico del catálogo comunal. El registro se desactiva (`activo: false`) y se estampan los metadatos de auditoría `eliminado_en` y `eliminado_por_id`.

Si el punto crítico está vinculado a una misión preventiva en curso o tiene personal desplegado en el lugar, la eliminación es rechazada con código `409 Conflict`.

---

## 7. Detalle de Endpoint: `POST /api/eventos-atp/prevencion` (HU-30)

Permite al **Encargado de Operaciones** (o Administrador) registrar un nuevo Evento de Prevención georreferenciado sobre un punto crítico o mediante coordenadas libres en una delegación de Valdivia, asignando recursos logísticos opcionales y despachando de manera atómica una misión a una patrulla verificadora disponible.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `Authorization` | `string` | Sí | Token Bearer JWT institucional (`Bearer <token>`). El usuario debe tener rol `ENCARGADO` o `ADMIN`, o poseer el permiso `prevencion:eventos:crear`. |

### Cuerpo de la Petición (Request Body JSON)

```json
{
  "nombre": "Inspección preventiva y limpieza de colectores en Angachilla",
  "descripcion": "Monitoreo preventivo del caudal e inspección de alcantarillas por alerta de temporal.",
  "sector": "Humedal Angachilla",
  "direccionTexto": "Pasaje Los Robles s/n con Av. Simpson",
  "prioridad": "ALTA",
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "puntoCriticoId": "40000000-0000-4000-8000-000000000001",
  "latitud": -39.8456,
  "longitud": -73.2389,
  "patrullaId": "50000000-0000-4000-8000-000000000001",
  "recursos": [
    {
      "recursoId": "00000000-0000-4000-8000-000000000001",
      "cantidad": 5
    }
  ]
}
```

#### Descripción de Campos

| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
|---|---|---|---|
| `nombre` | `string` | Sí | Nombre o título descriptivo de la operación preventiva (3-150 caracteres). |
| `descripcion` | `string` | Sí | Detalle e instrucciones de la labor en terreno (5-1000 caracteres). **Obligatorio por regla de negocio**. |
| `sector` | `string` | No | Nombre del sector, población o villa en Valdivia. |
| `direccionTexto` | `string` | No | Dirección o punto de referencia en terreno. |
| `prioridad` | `string` | No | Nivel de urgencia (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). Default: `MEDIA`. |
| `delegacionId` | `UUID` | Sí | Delegación municipal responsable (`Norte`, `Sur`, `Costa` o `Calle Calle`). |
| `puntoCriticoId` | `UUID` | No | Identificador opcional si la prevención se realiza sobre un punto crítico preexistente. |
| `latitud` | `number` | Sí | Coordenada latitud en formato WGS84 (-90 a 90). |
| `longitud` | `number` | Sí | Coordenada longitud en formato WGS84 (-180 a 180). |
| `patrullaId` | `UUID` | Sí | Identificador de la patrulla verificadora. **Debe estar en estado `DISPONIBLE`**. |
| `recursos` | `array` | No | Arreglo de insumos o herramientas del inventario asignados a la patrulla. Default: `[]`. |

---

### Respuestas HTTP

#### `201 Created` — Evento Creado y Misión Despachada
```json
{
  "message": "Evento de prevención creado y patrulla despachada exitosamente.",
  "data": {
    "id": "70000000-0000-4000-8000-000000000001",
    "codigo": "PREV-2026-0001",
    "nombre": "Inspección preventiva y limpieza de colectores en Angachilla",
    "descripcion": "Monitoreo preventivo del caudal e inspección de alcantarillas por alerta de temporal.",
    "sector": "Humedal Angachilla",
    "direccionTexto": "Pasaje Los Robles s/n con Av. Simpson",
    "prioridad": "ALTA",
    "estado": "PLANIFICADA",
    "latitud": -39.8456,
    "longitud": -73.2389,
    "puntoCritico": {
      "id": "40000000-0000-4000-8000-000000000001",
      "codigo": "PC-ANG-01",
      "nombre": "Sector Humedal Angachilla"
    },
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "DEL-SUR",
      "nombre": "Delegación Municipal Sur"
    },
    "mision": {
      "id": "60000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0001",
      "titulo": "Inspección preventiva y limpieza de colectores en Angachilla",
      "estado": "DESPACHADA",
      "tipoMision": "PREVENCION"
    },
    "patrulla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Verificadora Alfa",
      "estado": "EN_PREVENCION"
    },
    "recursos": [
      {
        "recursoId": "00000000-0000-4000-8000-000000000001",
        "nombre": "Sacos de Arena 25kg",
        "cantidadAsignada": 5
      }
    ],
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "creadoEn": "2026-10-05T03:00:00.000Z",
    "actualizadoEn": "2026-10-05T03:00:00.000Z"
  }
}
```

#### `400 Bad Request` — Datos de Entrada Inválidos
```json
{
  "message": "Datos de entrada inválidos para el evento de prevención.",
  "errors": [
    {
      "campo": "descripcion",
      "mensaje": "La descripción debe tener al menos 5 caracteres"
    }
  ]
}
```

#### `401 Unauthorized` — Token Inválido o Ausente
```json
{
  "message": "Token de sesión inválido o expirado."
}
```

#### `403 Forbidden` — Sin Permiso RBAC
```json
{
  "message": "Acceso denegado. Se requiere el permiso 'prevencion:eventos:crear'."
}
```

#### `404 Not Found` — Entidad no encontrada
```json
{
  "message": "La patrulla verificadora indicada no fue encontrada."
}
```

#### `409 Conflict` — Patrulla no disponible o Stock Insuficiente
```json
{
  "message": "La patrulla \"Patrulla Verificadora Alfa\" no está disponible para asignación (estado actual: EN_VERIFICACION)."
}
```

---

## 8. Eventos en Tiempo Real (Socket.io)

### Evento: `prevencion:creada` (HU-30)
Emitido automáticamente tras el registro exitoso de un evento de prevención hacia las siguientes salas:
- `sala:encargados` y `encargado`: Actualización en vivo del listado de misiones preventivas.
- `mapa`: Visualización inmediata del nuevo marcador preventivo en el mapa interactivo.
- `patrulla:<patrullaId>` y `sala:patrulla:<patrullaId>`: Notificación a la patrulla en terreno.

### Evento: `punto_critico:actualizado` (HU-55)
Emitido automáticamente tras la edición o reubicación de un punto crítico hacia las salas `"encargado"`, `"supervisor"` y `"administrador"`.

### Evento: `punto_critico:eliminado` (HU-56)
Emitido automáticamente tras un borrado lógico de punto crítico hacia las salas `"encargado"` y `"supervisor"`, así como por difusión general.
