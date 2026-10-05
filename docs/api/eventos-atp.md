# Módulo: Eventos ATP (Prevención y Puntos Críticos) — Documentación Técnica de API

Este documento describe la operativa técnica de los endpoints y reglas de negocio del módulo de **Eventos ATP** (Alerta Temprana Preventiva, Prevención y Puntos Críticos) en el backend monolítico modular `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Monitoreo del Administrador) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Eventos ATP** gestiona los puntos críticos, sectores de alta vulnerabilidad y eventos de mitigación/prevención en la comuna de Valdivia:

1. **Monitoreo de Puntos Críticos y Sectores Vulnerables (HU-57):**
   - El sistema almacena y cataloga los sectores geográficos vulnerables recurrentes de Valdivia (ej. humedales, riberas de ríos, laderas de cerros propensas a remoción en masa, zonas bajas propensas a anegamiento).
   - Se gestionan en la base de datos relacional mediante la tabla `prevencion`.
2. **Creación de Puntos Críticos con Coordenadas PostGIS (HU-58):**
   - El Administrador puede dar de alta nuevos puntos críticos seleccionando coordenadas en un mapa interactivo.
   - El backend genera de manera automática e incremental el código institucional (`PC-VAL-001`, `PC-SUR-001`, etc.) según la delegación municipal territorial asignada.
   - La coordenada geográfica se almacena en `latitud`, `longitud` y en la columna espacial PostGIS `ubicacion` (`Point EPSG:4326`).
   - Se registra el usuario creador en `creado_por_id` para trazabilidad de auditoría.
3. **Despacho Preventivo sin Incidente Formal Previo:**
   - Conforme a la regla de dominio crítica de `GEMINI.md` (Sección 6), las misiones preventivas de cuadrillas o patrullas pueden despacharse directamente sobre un punto crítico (`mision.prevencion_id`) **sin necesidad de que exista un incidente formal reportado previamente**.
4. **Procedencia Territorial por Delegaciones:**
   - Cada punto crítico puede estar asignado a una de las cuatro delegaciones territoriales de Valdivia:
     - **Delegación Municipal Norte**
     - **Delegación Municipal Sur**
     - **Delegación Municipal Costa**
     - **Delegación Municipal Calle Calle**
   - Aquellos registros sin delegación asignada (`delegacion_id = null`) corresponden a puntos monitoreados por la central comunal de emergencias.
5. **Geolocalización Espacial (PostGIS):**
   - Todo punto crítico almacena sus coordenadas geográficas en EPSG:4326 (`latitud`, `longitud`) y las indexa con GIST sobre la columna geométrica `ubicacion` (`Point`), permitiendo visualizaciones en mapas interactivos y futuros cálculos de proximidad de recursos.
6. **Control de Acceso Basado en Roles (RBAC):**
   - La gestión de puntos críticos (`GET`, `POST`, `PUT`, `DELETE`) está **restringida estrictamente al rol `Administrador`** del sistema (permisos `puntos_criticos:leer`, `puntos_criticos:crear`, `puntos_criticos:editar`, `puntos_criticos:eliminar`).
   - Cualquier petición anónima es rechazada con `401 Unauthorized`.
   - Cualquier petición proveniente de un usuario sin los permisos requeridos es rechazada con `403 Forbidden`.
   - La autenticación se verifica a través de la cabecera HTTP `X-User-Id: <UUID>` o el token Bearer (`Authorization: Bearer <token>`).
7. **Respuesta ante Lista Vacía (HU-57):**
   - Si no existen puntos críticos registrados en la base de datos (o si los filtros aplicados no retornan coincidencias), la API responde `200 OK` con un arreglo vacío `data: []` y `total: 0`. Esto permite al frontend (`sgrai-web`) desplegar de forma limpia su mensaje de estado vacío sin excepciones.
8. **Edición y Reubicación Dinámica con Notificación en Tiempo Real (HU-55):**
   - El Administrador puede modificar los datos descriptivos y reubicar las coordenadas de un punto crítico en cualquier momento. El backend recalcula la geometría PostGIS y difunde el evento `"punto_critico:actualizado"` vía Socket.io a la central, supervisores y unidades en terreno para su actualización inmediata.
   - El código institucional es inmutable. No se permite editar puntos inactivos (`409 Conflict`).
9. **Borrado Lógico y Auditoría (HU-56):**
   - Para mantener la trazabilidad de eventos preventivos pasados asociados a una coordenada (y el histórico requerido para reportería SENAPRED), la desactivación de un punto crítico **no destruye físicamente el registro**. En su lugar, se actualiza `activo = false`, registrando de forma inmutable la estampa de tiempo `eliminado_en` y el UUID del usuario responsable `eliminado_por_id`.
10. **Protección de Operaciones Activas en Terreno (HU-56):**
    - Si el punto crítico se encuentra vinculado a una misión preventiva activa (estados `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`) o tiene una patrulla/cuadrilla asignada, la API **rechaza la solicitud de eliminación con código HTTP `409 Conflict`**, evitando dejar unidades operativas huérfanas o desarticular el plan de contingencia en curso.
11. **Sincronización Reactiva en Tiempo Real (Socket.io):**
    - Al crearse, modificarse o eliminarse lógicamente un punto crítico, la API emite eventos dedicados (`"punto_critico:creado"`, `"punto_critico:actualizado"`, `"punto_critico:eliminado"`) a las salas `"administrador"`, `"encargado"` y `"supervisor"`, así como en difusión general, permitiendo al visor cartográfico de `sgrai-web` actualizar el mapa interactivo y la tabla instantáneamente sin recargar la página.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/puntos-criticos` | Listar los puntos críticos y sectores vulnerables monitoreados con paginación, filtros territoriales/prioridad y datos de delegación asociada (HU-57). |
| `POST` | `/api/puntos-criticos` | Registrar un nuevo punto crítico con coordenadas PostGIS, código autogenerado y emisión en tiempo real vía Socket.io (HU-58). |
| `GET` | `/api/puntos-criticos/{id}` | Obtener detalle de un punto crítico con delegación para precargar formulario de edición (HU-55). |
| `PUT` | `/api/puntos-criticos/{id}` | Editar características, factores de riesgo y ubicación geográfica de un punto crítico con PostGIS y Socket.io (HU-55). |
| `DELETE` | `/api/puntos-criticos/{id}` | Desactivar (borrado lógico) un punto crítico comunal, validando dependencias operativas y notificando vía Socket.io (HU-56). |

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

### Respuestas HTTP Esperadas

#### `200 OK` — Consulta exitosa con datos
```json
{
  "data": [
    {
      "id": "40000000-0000-4000-8000-000000000001",
      "codigo": "PC-ANG-01",
      "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
      "descripcion": "Zona baja con riesgo de anegamiento por desborde fluvial",
      "tipoRiesgo": "Inundación y anegamiento",
      "prioridad": "ALTA",
      "activo": true,
      "estadoTexto": "Activo",
      "latitud": -39.8456,
      "longitud": -73.2389,
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000001",
        "codigo": "DEL-SUR",
        "nombre": "Delegación Municipal Sur"
      },
      "creadoEn": "2026-06-15T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "pagina": 1,
    "limite": 10,
    "totalPaginas": 1
  }
}
```

#### `200 OK` — Lista vacía (sin registros)
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "pagina": 1,
    "limite": 10,
    "totalPaginas": 0
  }
}
```

#### `400 Bad Request` — Parámetros inválidos
```json
{
  "message": "Parámetros de consulta inválidos.",
  "errors": [
    {
      "campo": "pagina",
      "mensaje": "Number must be greater than or equal to 1"
    }
  ]
}
```

#### `401 Unauthorized` — Falta cabecera de autenticación
```json
{
  "message": "Cabecera X-User-Id requerida para autenticación."
}
```

#### `403 Forbidden` — Acceso denegado (Rol no autorizado)
```json
{
  "message": "Acceso denegado. Se requiere el perfil de Administrador."
}
```

---

## 4. Detalle de Endpoint: `POST /api/puntos-criticos` (HU-58)

Crea un nuevo punto crítico o sector vulnerable en la base de datos relacional del SGRAI.

### Reglas de Negocio del Endpoint
1. **Generación Automática del Código:** El backend genera atómicamente el código correlativo (`PC-VAL-001`, `PC-NOR-001`, etc.) según la delegación seleccionada.
2. **Geolocalización Espacial PostGIS:** Almacena latitud y longitud numéricas y genera el punto PostGIS `ubicacion = ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)`.
3. **Auditoría de Creación:** Registra `creado_por_id` con el identificador del usuario administrador autenticado.
4. **Notificación en Tiempo Real:** Emite el evento `"punto_critico:creado"` a las salas `"administrador"`, `"encargado"` y `"supervisor"` vía Socket.io.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con rol `Administrador` y permiso `puntos_criticos:crear`. |
| `Content-Type` | `string` | Sí | `application/json` |

### Cuerpo de la Petición (JSON Body)

```json
{
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "descripcion": "Zona baja propensa a anegamiento por desborde en temporada invernal",
  "tipoRiesgo": "Inundación y anegamiento",
  "prioridad": "ALTA",
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "latitud": -39.8456,
  "longitud": -73.2389
}
```

### Respuestas HTTP Esperadas

#### `201 Created` — Punto crítico creado exitosamente
```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "codigo": "PC-SUR-001",
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "descripcion": "Zona baja propensa a anegamiento por desborde en temporada invernal",
  "tipoRiesgo": "Inundación y anegamiento",
  "prioridad": "ALTA",
  "activo": true,
  "estadoTexto": "Activo",
  "latitud": -39.8456,
  "longitud": -73.2389,
  "delegacion": {
    "id": "30000000-0000-4000-8000-000000000001",
    "codigo": "DEL-SUR",
    "nombre": "Delegación Municipal Sur"
  },
  "creadoEn": "2026-10-05T00:30:00.000Z",
  "creadoPorId": "00000000-0000-4000-8000-000000000001"
}
```

#### `400 Bad Request` — Datos inválidos o delegación inexistente
```json
{
  "message": "Parámetros de creación de punto crítico inválidos.",
  "errors": [
    {
      "campo": "latitud",
      "mensaje": "La latitud debe ser mayor o igual a -90."
    }
  ]
}
```

#### `401 Unauthorized` — Sin autenticación
```json
{
  "message": "Cabecera X-User-Id requerida para autenticación."
}
```

#### `403 Forbidden` — Perfil no autorizado
```json
{
  "message": "Acceso denegado. Se requiere el perfil de Administrador con permiso puntos_criticos:crear."
}
```

---

## 5. Detalle de Endpoint: `GET /api/puntos-criticos/{id}` (HU-55)

Retorna la información completa de un punto crítico específico con auditoría y delegación territorial.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con rol `Administrador`. |

### Parámetros de Ruta (Path Params)

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `UUID` | Sí | Identificador único del punto crítico. |

### Respuestas HTTP Esperadas

#### `200 OK` — Detalle obtenido exitosamente
```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "codigo": "PC-ANG-01",
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "descripcion": "Zona baja con riesgo de anegamiento por desborde fluvial",
  "tipoRiesgo": "Inundación y anegamiento",
  "prioridad": "ALTA",
  "activo": true,
  "estadoTexto": "Activo",
  "latitud": -39.8456,
  "longitud": -73.2389,
  "delegacion": {
    "id": "30000000-0000-4000-8000-000000000001",
    "codigo": "DEL-SUR",
    "nombre": "Delegación Municipal Sur"
  },
  "creadoEn": "2026-06-15T12:00:00.000Z",
  "actualizadoEn": "2026-10-04T19:00:00.000Z",
  "actualizadoPorId": "00000000-0000-4000-8000-000000000001"
}
```

#### `404 Not Found` — Punto crítico inexistente
```json
{
  "message": "Punto crítico con ID '40000000-0000-4000-8000-000000000001' no encontrado."
}
```

---

## 6. Detalle de Endpoint: `PUT /api/puntos-criticos/{id}` (HU-55)

Permite actualizar los atributos descriptivos, factores de riesgo y coordenadas geográficas de un punto crítico comunal.

### Reglas de Negocio del Endpoint
1. **Inmutabilidad del Código:** El código institucional (`codigo`) no puede modificarse.
2. **Reubicación Dinámica:** Las coordenadas pueden modificarse en cualquier momento recalculando la columna geométrica PostGIS.
3. **Auditoría de Modificación:** Se actualiza `actualizado_en` y `actualizado_por_id`.
4. **Sincronización Reactiva:** Se emite `"punto_critico:actualizado"` vía Socket.io.

### Cuerpo de la Petición (JSON Body)

```json
{
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "descripcion": "Zona baja con riesgo crítico de anegamiento e ingreso de agua a viviendas",
  "tipoRiesgo": "Inundación fluvial y anegamiento",
  "prioridad": "CRITICA",
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "latitud": -39.8465,
  "longitud": -73.2392
}
```

### Respuestas HTTP Esperadas

#### `200 OK` — Actualización exitosa
Retorna la entidad consolidada con el detalle actualizado y las estampas de auditoría.

#### `400 Bad Request` — Datos de formulario inválidos
```json
{
  "message": "Parámetros de edición de punto crítico inválidos.",
  "errors": [
    {
      "campo": "latitud",
      "mensaje": "La latitud debe ser menor o igual a 90."
    }
  ]
}
```

#### `403 Forbidden` — Permiso insuficiente
```json
{
  "message": "Acceso denegado. Se requiere perfil de Administrador con permiso puntos_criticos:editar."
}
```

#### `404 Not Found` — Punto crítico inexistente
```json
{
  "message": "Punto crítico con ID '40000000-0000-4000-8000-000000000001' no encontrado."
}
```

#### `409 Conflict` — Punto crítico inactivo
```json
{
  "message": "No es posible editar el punto crítico 'Sector Humedal Angachilla' porque se encuentra desactivado del sistema."
}
```

---

## 7. Detalle de Endpoint: `DELETE /api/puntos-criticos/{id}` (HU-56)

Aplica el **borrado lógico** (*soft delete*) de un punto crítico del catálogo comunal. El registro se desactiva (`activo: false`) y se estampan los metadatos de auditoría `eliminado_en` y `eliminado_por_id`.

Si el punto crítico está vinculado a una misión preventiva activa (estados `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`) o tiene personal desplegado en el lugar, la eliminación es rechazada con `409 Conflict`.

### Respuestas HTTP Esperadas

#### `200 OK` — Desactivación lógica exitosa
```json
{
  "message": "Punto crítico desactivado exitosamente del sistema.",
  "id": "40000000-0000-4000-8000-000000000001",
  "codigo": "PC-ANG-01",
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "activo": false,
  "eliminadoEn": "2026-10-04T00:30:00.000Z",
  "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
}
```

#### `409 Conflict` — Misiones preventivas o patrullas activas en el lugar
```json
{
  "message": "No es posible eliminar el punto crítico 'Sector Humedal Angachilla - Pasaje Los Robles' porque cuenta con 1 misión(es) preventivas activas o patrullas asignadas en terreno (Misiones asociadas: MIS-2026-004)."
}
```

---

## 8. Eventos de Tiempo Real (Socket.io)

### Evento: `punto_critico:creado`

Emitido automáticamente tras el registro exitoso de un nuevo punto crítico hacia las salas `"encargado"`, `"supervisor"` y `"administrador"`.

```typescript
socket.on("punto_critico:creado", (nuevoPunto) => {
  // 1. Agregar nuevo marcador en el mapa cartográfico
  mapa.agregarMarcador(nuevoPunto);
  // 2. Insertar fila en la tabla de puntos críticos
  tabla.agregarFila(nuevoPunto);
});
```

### Evento: `punto_critico:actualizado`

Emitido automáticamente tras una actualización exitosa de características o coordenadas hacia las salas `"encargado"`, `"supervisor"` y `"administrador"`.

```typescript
socket.on("punto_critico:actualizado", (puntoActualizado) => {
  // 1. Actualizar el marcador en el mapa cartográfico
  mapa.actualizarMarcador(puntoActualizado);
  // 2. Actualizar la fila en la tabla
  tabla.actualizarFila(puntoActualizado);
});
```

### Evento: `punto_critico:eliminado`

Emitido automáticamente tras un borrado lógico exitoso hacia las salas `"encargado"`, `"supervisor"` y difusión general.

```typescript
socket.on("punto_critico:eliminado", ({ id }) => {
  // 1. Remover el marcador Leaflet del mapa interactivo
  mapa.removerMarcadorPuntoCritico(id);
  // 2. Retirar la fila de la tabla de puntos críticos en vivo
  tablaPuntosCriticos.removerFila(id);
});
```
