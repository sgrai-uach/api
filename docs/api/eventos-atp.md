# Módulo: Eventos ATP (Prevención, Puntos Críticos y Recuperación) — Documentación Técnica de API

Este documento describe la operativa técnica de los endpoints y reglas de negocio del módulo de **Eventos ATP** (Alerta Temprana Preventiva, Prevención, Puntos Críticos y Recuperación) en el backend monolítico modular `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Monitoreo del Administrador y Centro de Mando) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Eventos ATP** gestiona los puntos críticos, sectores de alta vulnerabilidad, eventos de mitigación/prevención y recuperación en la comuna de Valdivia:

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
   - La creación de eventos de recuperación está habilitada para `Encargado de Operaciones` y `Administrador` (permiso `recuperacion:crear`).
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
11. **Creación de Eventos de Recuperación y Despacho Directo (HU-29):**
    - El Encargado puede registrar eventos de recuperación en terreno para entregar insumos y asistencia a sectores o familias damnificadas sin necesidad de un incidente formal previo.
    - El sistema valida atómicamente la existencia y disponibilidad de la patrulla verificadora seleccionada (`patrulla_verificadora.estado = 'DISPONIBLE'`).
    - El sistema comprueba mediante bloqueo transaccional (`FOR UPDATE`) que haya stock suficiente en bodega (`cantidad_inventario - cantidad_en_uso >= cantidad_solicitada`).
    - En la misma transacción atómica de Kysely, se descuentan los recursos del inventario disponible (`cantidad_inventario`), se actualiza la patrulla al estado `'EN_RECUPERACION'`, se genera una misión táctica en estado `'DESPACHADA'` y se emite el evento WebSocket `recuperacion:creada` en tiempo real.
12. **Sincronización Reactiva en Tiempo Real (Socket.io):**
    - Al crearse, modificarse o eliminarse lógicamente un punto crítico, o registrarse un evento de recuperación, la API emite eventos dedicados (`"punto_critico:creado"`, `"punto_critico:actualizado"`, `"punto_critico:eliminado"`, `"recuperacion:creada"`) a las salas correspondientes (`"administrador"`, `"encargado"`, `"supervisor"`, `"mapa"`), permitiendo al visor cartográfico de `sgrai-web` actualizar el mapa interactivo y las tablas instantáneamente sin recargar la página.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/puntos-criticos` | Listar los puntos críticos y sectores vulnerables monitoreados con paginación, filtros territoriales/prioridad y datos de delegación asociada (HU-57). |
| `POST` | `/api/puntos-criticos` | Registrar un nuevo punto crítico con coordenadas PostGIS, código autogenerado y emisión en tiempo real vía Socket.io (HU-58). |
| `GET` | `/api/puntos-criticos/{id}` | Obtener detalle de un punto crítico con delegación para precargar formulario de edición (HU-55). |
| `PUT` | `/api/puntos-criticos/{id}` | Editar características, factores de riesgo y ubicación geográfica de un punto crítico con PostGIS y Socket.io (HU-55). |
| `POST` | `/api/eventos-atp/recuperacion` | Registrar un nuevo evento de recuperación, reservar/descontar stock de bodega y despachar una patrulla verificadora a terreno sin incidente previo (HU-29). |
| `GET` | `/api/eventos-atp/asistencia-social` | Listar eventos de asistencia social y casos pendientes de levantamiento FIBE con filtros territoriales y paginación (H28). |
| `POST` | `/api/eventos-atp/asistencia-social` | Registrar un nuevo evento excepcional de asistencia social para levantamiento de FIBE sin vincular a un incidente formal (H28). |

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
      "descripcion": "Zona baja con riesgo recurrente de anegamiento por desborde en temporada invernal",
      "tipoRiesgo": "Inundación y anegamiento",
      "prioridad": "ALTA",
      "activo": true,
      "estadoTexto": "Activo",
      "latitud": -39.8456,
      "longitud": -73.2389,
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000002",
        "codigo": "DEL_SUR",
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

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con rol `Administrador` y permiso `puntos_criticos:editar`. |
| `Content-Type` | `string` | Sí | `application/json` |

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

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `Authorization` | `string` | No | Token Bearer JWT de sesión. |
| `X-User-Id` | `UUID` | No | Identificador del usuario con rol `Administrador` y permiso `puntos_criticos:eliminar`. |

### Parámetros de Ruta (Path Params)

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `UUID` | Sí | Identificador único del punto crítico a desactivar. |

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

#### `400 Bad Request` — Identificador UUID inválido
```json
{
  "message": "Identificador de punto crítico inválido."
}
```

#### `401 Unauthorized` — Falta cabecera de autenticación
```json
{
  "message": "Cabecera X-User-Id o token Bearer requerido para autenticación."
}
```

#### `403 Forbidden` — Acceso denegado
```json
{
  "message": "Acceso denegado. Se requiere el perfil de Administrador con permiso puntos_criticos:eliminar."
}
```

#### `404 Not Found` — Punto crítico inexistente
```json
{
  "message": "Punto crítico con ID '40000000-0000-4000-8000-000000000099' no encontrado."
}
```
#### `409 Conflict` — Misiones preventivas o patrullas activas en el lugar
```json
{
  "message": "No es posible eliminar el punto crítico 'Sector Humedal Angachilla - Pasaje Los Robles' porque cuenta con 1 misión(es) preventivas activas o patrullas asignadas en terreno (Misiones asociadas: MIS-2026-004)."
}
```

---

## 8. Detalle de Endpoint: `POST /api/eventos-atp/recuperacion` (HU-29)

Permite al perfil **Encargado de Operaciones** (o Administrador) crear un evento de recuperación territorial y despachar una patrulla verificadora con insumos y recursos logísticos hacia un sector afectado, de forma atómica y sin requerir un incidente formal.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario autenticado con permiso `recuperacion:crear` (Encargado o Administrador). |
| `Content-Type` | `string` | Sí | `application/json` |

### Cuerpo de la Solicitud (Payload JSON)

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `nombre` | `string` | Sí | Título descriptivo del evento (3 a 150 caracteres). |
| `descripcion` | `string` | No | Detalle o instrucciones para la patrulla (máx. 1000 caracteres). |
| `sector` | `string` | Sí | Sector geográfico o población en Valdivia (ej. `"Collico"`, `"Isla Teja"`). |
| `direccionTexto` | `string` | No | Dirección o punto de referencia en terreno. |
| `prioridad` | `enum` | No | Nivel de urgencia: `'BAJA'`, `'MEDIA'`, `'ALTA'`, `'CRITICA'` (default: `'MEDIA'`). |
| `contactoNombre` | `string` | No | Nombre del referente vecinal o solicitante en terreno. |
| `contactoTelefono` | `string` | No | Teléfono de contacto en terreno. |
| `latitud` | `number` | Sí | Latitud geográfica WGS84 (-90 a 90). |
| `longitud` | `number` | Sí | Longitud geográfica WGS84 (-180 a 180). |
| `delegacionId` | `UUID` | No | Identificador de la delegación territorial (si se omite, se hereda de la patrulla). |
| `patrullaId` | `UUID` | Sí | Identificador de la patrulla verificadora asignada (debe estar en estado `'DISPONIBLE'`). |
| `familiasAfectadas` | `number` | No | Cantidad estimada de familias beneficiarias (default: `0`). |
| `recursos` | `array` | Sí | Arreglo de insumos solicitados con `{ recursoId: UUID, cantidad: number > 0 }` (mínimo 1 elemento). |

#### Ejemplo de Solicitud (Request Body)
```json
{
  "nombre": "Entrega de frazadas y techumbre en Sector Collico",
  "descripcion": "Damnificados por temporal de viento con voladura de techos",
  "sector": "Collico",
  "direccionTexto": "Calle Balmaceda 1245 con Las Palmeras",
  "prioridad": "ALTA",
  "contactoNombre": "Don Juan Pérez",
  "contactoTelefono": "+56912345678",
  "latitud": -39.8142,
  "longitud": -73.2459,
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "patrullaId": "50000000-0000-4000-8000-000000000001",
  "familiasAfectadas": 4,
  "recursos": [
    {
      "recursoId": "80000000-0000-4000-8000-000000000001",
      "cantidad": 10
    }
  ]
}
```

### Respuestas HTTP Esperadas

#### `201 Created` — Evento registrado y patrulla despachada
```json
{
  "message": "Evento de recuperación registrado y patrulla despachada exitosamente.",
  "data": {
    "id": "70000000-0000-4000-8000-000000000001",
    "codigo": "REC-2026-0001",
    "nombre": "Entrega de frazadas y techumbre en Sector Collico",
    "descripcion": "Damnificados por temporal de viento con voladura de techos",
    "sector": "Collico",
    "direccionTexto": "Calle Balmaceda 1245 con Las Palmeras",
    "prioridad": "ALTA",
    "contactoNombre": "Don Juan Pérez",
    "contactoTelefono": "+56912345678",
    "latitud": -39.8142,
    "longitud": -73.2459,
    "estado": "PLANIFICADA",
    "familiasAfectadas": 4,
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "DEL-SUR",
      "nombre": "Delegación Municipal Sur"
    },
    "mision": {
      "id": "60000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0001",
      "titulo": "Entrega de frazadas y techumbre en Sector Collico",
      "estado": "DESPACHADA",
      "tipoMision": "RECUPERACION"
    },
    "patrulla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Verificadora Alfa",
      "estado": "EN_RECUPERACION"
    },
    "recursos": [
      {
        "recursoId": "80000000-0000-4000-8000-000000000001",
        "nombre": "Frazadas Térmicas",
        "cantidadAsignada": 10
      }
    ],
    "creadoPorId": "00000000-0000-4000-8000-000000000003",
    "creadoEn": "2026-10-04T22:30:00.000Z",
    "actualizadoEn": "2026-10-04T22:30:00.000Z"
  }
}
```

#### `400 Bad Request` — Fallo de validación de datos
```json
{
  "message": "Datos de entrada inválidos para el evento de recuperación.",
  "errors": [
    {
      "campo": "recursos",
      "mensaje": "Debe asignar al menos un recurso al evento de recuperación"
    }
  ]
}
```

#### `401 Unauthorized` — Usuario no autenticado
```json
{
  "message": "Cabecera X-User-Id requerida para autenticación."
}
```

#### `403 Forbidden` — Falta permiso `recuperacion:crear`
```json
{
  "message": "No posee el permiso requerido: recuperacion:crear"
}
```

#### `404 Not Found` — Patrulla o recurso no encontrado
```json
{
  "message": "La patrulla verificadora indicada no fue encontrada."
}
```

#### `409 Conflict` — Conflicto operativo (Patrulla ocupada o Stock insuficiente)
* **Patrulla no disponible:**
```json
{
  "message": "La patrulla \"Patrulla Verificadora Alfa\" no está disponible para asignación (estado actual: EN_VERIFICACION)."
}
```
* **Stock insuficiente:**
```json
{
  "message": "Stock insuficiente para el recurso \"Frazadas Térmicas\". Solicitado: 10, Disponible: 3."
}
```

---

## 9. Detalle de Endpoint: `POST /api/eventos-atp/prevencion` (HU-30)

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
Emitido automáticamente tras un borrado lógico de punto crítico hacia las salas `"encargado"` y `"supervisor"`, así como por difusión general.## 10. Eventos de Tiempo Real (Socket.io)

### Evento: `punto_critico:creado`

Emitido automáticamente tras el registro exitoso de un nuevo punto crítico hacia las salas `"encargado"`, `"supervisor"` y `"administrador"`.

* **Consumo en Frontend:**
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

* **Payload:**
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

* **Consumo en Frontend:**
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

* **Payload:**
```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "codigo": "PC-ANG-01",
  "nombre": "Sector Humedal Angachilla - Pasaje Los Robles",
  "eliminadoPorId": "00000000-0000-4000-8000-000000000001",
  "eliminadoEn": "2026-10-04T00:30:00.000Z"
}
```

* **Consumo en Frontend:**
```typescript
socket.on("punto_critico:eliminado", ({ id }) => {
  // 1. Remover el marcador Leaflet del mapa interactivo
  mapa.removerMarcadorPuntoCritico(id);
  // 2. Retirar la fila de la tabla de puntos críticos en vivo
  tablaPuntosCriticos.removerFila(id);
});
```

### Evento: `recuperacion:creada`

Al completar exitosamente la transacción de creación del evento, el backend emite:

* **Evento:** `recuperacion:creada`
* **Salas:** `"sala:encargados"`, `"encargado"`, `"mapa"`
* **Payload:** Objeto idéntico a la propiedad `data` de la respuesta `201 Created`.
* **Propósito en Frontend (`sgrai-web`):**
  - Actualizar inmediatamente el mapa interactivo (añadiendo el nuevo marcador del evento con sus coordenadas).
  - Actualizar la tabla de misiones en curso y la lista de patrullas disponibles/ocupadas sin requerir recargar la página.

### Evento: `prevencion:creada`

Al completar exitosamente la transacción de creación del evento preventivo, el backend emite:

* **Evento:** `prevencion:creada`
* **Salas:** `"sala:encargados"`, `"encargado"`, `"mapa"`, `"patrulla:<patrullaId>"`
* **Payload:** Objeto idéntico a la propiedad `data` de la respuesta `201 Created`.
* **Propósito en Frontend (`sgrai-web`):**
  - Renderizar en vivo el nuevo marcador de prevención en el mapa territorial.
  - Actualizar el estado de la patrulla a `EN_PREVENCION` en el visor de recursos.
  - Reflejar la nueva misión despachada en el centro de mando.

### Evento: `asistencia_social:creada`

Al registrar exitosamente un evento de asistencia social excepcional, el backend emite:

* **Evento:** `asistencia_social:creada`
* **Salas:** `"sala:encargados"`, `"encargado"`, `"asistente_social"`, `"administrador"` y difusión general.
* **Payload:** Objeto del evento recién registrado (idéntico a la propiedad `data` de `POST /api/eventos-atp/asistencia-social`).
* **Propósito en Frontend (`sgrai-web`):**
  - Incorporar de forma inmediata el nuevo registro en el panel de eventos pendientes para la asignación de asistentes sociales.
  - Notificar en tiempo real al Encargado y a los Asistentes Sociales sin necesidad de recargar la página.

---

## 9. Detalle de Endpoints: Asistencia Social y FIBE (H28)

### 9.1 `POST /api/eventos-atp/asistencia-social`

Permite al rol **Encargado** (o Administrador) registrar un caso excepcional que requiere levantamiento urgente de la Ficha Básica de Emergencia (FIBE), **sin necesidad de que provenga de un incidente formal previo**.

#### Cabeceras Requeridas
| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `Authorization` | `Bearer <token>` o `X-User-Id: <UUID>` | Sí | Identificador del Encargado o Administrador con permiso `asistencia_social:crear`. |

#### Cuerpo de la Petición (Request Body)
```json
{
  "descripcion": "Familia de 4 integrantes con vivienda inundada por desborde secundario fuera de radio de incidente.",
  "tipoAfectacion": "VIVIENDA_ANEGADA",
  "direccionTexto": "Calle Los Alerces 1420, Sector Collico",
  "latitud": -39.8234,
  "longitud": -73.2189,
  "personasAfectadas": 4,
  "familiasAfectadas": 1,
  "prioridad": "ALTA",
  "contactoNombre": "María González",
  "contactoTelefono": "+56912345678",
  "contactoRut": "12.345.678-9",
  "delegacionId": "30000000-0000-4000-8000-000000000001"
}
```

#### Respuestas HTTP
* **`201 Created`:**
```json
{
  "message": "Evento de asistencia social registrado exitosamente.",
  "data": {
    "id": "70000000-0000-4000-8000-000000000001",
    "codigo": "AS-2026-0001",
    "descripcion": "Familia de 4 integrantes con vivienda inundada por desborde secundario...",
    "tipoAfectacion": "VIVIENDA_ANEGADA",
    "personasAfectadas": 4,
    "familiasAfectadas": 1,
    "direccionTexto": "Calle Los Alerces 1420, Sector Collico",
    "latitud": -39.8234,
    "longitud": -73.2189,
    "prioridad": "ALTA",
    "estado": "PENDIENTE",
    "contactoNombre": "María González",
    "contactoTelefono": "+56912345678",
    "contactoRut": "12.345.678-9",
    "delegacionId": "30000000-0000-4000-8000-000000000001",
    "delegacionNombre": "Delegación Municipal Costa",
    "incidenteId": null,
    "asistenteSocialId": null,
    "asistenteSocialNombre": null,
    "creadoPor": {
      "id": "00000000-0000-4000-8000-000000000003",
      "nombre": "Encargado de Operaciones"
    },
    "creadoEn": "2026-10-05T12:00:00.000Z",
    "actualizadoEn": "2026-10-05T12:00:00.000Z"
  }
}
```

* **`400 Bad Request`:** Coordenadas fuera de rango o campos obligatorios vacíos (`descripcion`, `direccionTexto`, `latitud`, `longitud`).
* **`401 Unauthorized`:** Cabecera de autenticación ausente o inválida.
* **`403 Forbidden`:** Usuario no posee permiso `asistencia_social:crear`.

---

### 9.2 `GET /api/eventos-atp/asistencia-social`

Consulta los eventos de asistencia social con filtros de estado, delegación, prioridad operativa y paginación. Diseñado específicamente para alimentar el **panel de eventos pendientes** previo a la asignación de Asistentes Sociales.

#### Query Params
| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `pagina` | `number` | No | `1` | Número de página (inicia en 1). |
| `limite` | `number` | No | `10` | Cantidad de elementos por página (máx. 100). |
| `estado` | `string` | No | - | Filtra por estado (`PENDIENTE`, `ASIGNADO`, `EN_EVALUACION_FIBE`, `FINALIZADO`). |
| `delegacionId` | `UUID` | No | - | Filtra por identificador de delegación municipal. |
| `prioridad` | `string` | No | - | Filtra por prioridad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). |
| `busqueda` | `string` | No | - | Búsqueda insensible a mayúsculas por código, descripción, dirección o contacto. |

#### Respuestas HTTP
* **`200 OK`:**
```json
{
  "data": [
    {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "AS-2026-0001",
      "descripcion": "Familia de 4 integrantes con vivienda inundada...",
      "tipoAfectacion": "VIVIENDA_ANEGADA",
      "personasAfectadas": 4,
      "familiasAfectadas": 1,
      "direccionTexto": "Calle Los Alerces 1420, Sector Collico",
      "latitud": -39.8234,
      "longitud": -73.2189,
      "prioridad": "ALTA",
      "estado": "PENDIENTE",
      "contactoNombre": "María González",
      "contactoTelefono": "+56912345678",
      "contactoRut": "12.345.678-9",
      "delegacionId": "30000000-0000-4000-8000-000000000001",
      "delegacionNombre": "Delegación Municipal Costa",
      "incidenteId": null,
      "asistenteSocialId": null,
      "asistenteSocialNombre": null,
      "creadoPor": {
        "id": "00000000-0000-4000-8000-000000000003",
        "nombre": "Encargado de Operaciones"
      },
      "creadoEn": "2026-10-05T12:00:00.000Z",
      "actualizadoEn": "2026-10-05T12:00:00.000Z"
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 10,
  "totalPaginas": 1
}
```
