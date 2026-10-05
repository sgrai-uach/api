# Módulo: Eventos ATP (Prevención y Puntos Críticos) — Documentación Técnica de API

Este documento describe la operativa técnica de los endpoints y reglas de negocio del módulo de **Eventos ATP** (Alerta Temprana Preventiva, Prevención y Puntos Críticos) en el backend monolítico modular `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Monitoreo del Administrador) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Eventos ATP** gestiona los puntos críticos, sectores de alta vulnerabilidad y eventos de mitigación/prevención en la comuna de Valdivia:

1. **Monitoreo de Puntos Críticos y Sectores Vulnerables (HU-57):**
   - El sistema almacena y cataloga los sectores geográficos vulnerables recurrentes de Valdivia (ej. humedales, riberas de ríos, laderas de cerros propensas a remoción en masa, zonas bajas propensas a anegamiento).
   - Se gestionan en la base de datos relacional mediante la tabla `prevencion`.
2. **Despacho Preventivo sin Incidente Formal Previo:**
   - Conforme a la regla de dominio crítica de `GEMINI.md` (Sección 6), las misiones preventivas de cuadrillas o patrullas pueden despacharse directamente sobre un punto crítico (`mision.prevencion_id`) **sin necesidad de que exista un incidente formal reportado previamente**.
3. **Procedencia Territorial por Delegaciones:**
   - Cada punto crítico puede estar asignado a una de las cuatro delegaciones territoriales de Valdivia:
     - **Delegación Municipal Norte**
     - **Delegación Municipal Sur**
     - **Delegación Municipal Costa**
     - **Delegación Municipal Calle Calle**
   - Aquellos registros sin delegación asignada (`delegacion_id = null`) corresponden a puntos monitoreados por la central comunal de emergencias.
4. **Geolocalización Espacial (PostGIS):**
   - Todo punto crítico almacena sus coordenadas geográficas en EPSG:4326 (`latitud`, `longitud`) y las indexa con GIST sobre la columna geométrica `ubicacion` (`Point`), permitiendo visualizaciones en mapas interactivos y futuros cálculos de proximidad de recursos.
5. **Control de Acceso Basado en Roles (RBAC):**
   - La consulta y visualización de la lista de puntos críticos (`GET /api/puntos-criticos`) está **restringida estrictamente al rol `Administrador`** del sistema.
   - Cualquier petición anónima es rechazada con `401 Unauthorized`.
   - Cualquier petición proveniente de un usuario con un perfil distinto a `Administrador` es rechazada con `403 Forbidden`.
   - La autenticación se verifica a través de la cabecera HTTP `X-User-Id: <UUID>` o el token Bearer (`Authorization: Bearer <UUID>`).
6. **Respuesta ante Lista Vacía (Criterio de Aceptación 3):**
   - Si no existen puntos críticos registrados en la base de datos (o si los filtros aplicados no retornan coincidencias), la API responde `200 OK` con un arreglo vacío `data: []` y `total: 0`. Esto permite al frontend (`sgrai-web`) desplegar de forma limpia su mensaje de estado vacío ("No hay puntos críticos registrados") sin incurrir en excepciones.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/puntos-criticos` | Listar los puntos críticos y sectores vulnerables monitoreados con paginación, filtros territoriales/prioridad y datos de delegación asociada (HU-57). |
| `POST` | `/api/puntos-criticos` | Registrar un nuevo punto crítico con coordenadas PostGIS, código autogenerado y emisión en tiempo real vía Socket.io (HU-58). |

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
  "message": "Acceso denegado. Se requiere el perfil de Administrador para acceder al listado y gestión de permisos."
}
```

---

## 4. Detalle de Endpoint: `POST /api/puntos-criticos` (HU-58)

Registra un nuevo punto crítico o sector vulnerable en la base de datos relacional y lo geolocaliza en PostGIS (EPSG:4326). El código institucional se autogenera con el prefijo territorial de la delegación asignada (ej. `PC-SUR-001`, `PC-NOR-001`) o el prefijo general comunal (`PC-VAL-001`).

Al completarse el registro, el sistema emite el evento `"punto_critico:creado"` a través de Socket.io hacia las salas `"administrador"`, `"supervisor"` y `"encargado"` para reflejar en tiempo real la nueva coordenada en sus capas cartográficas.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con perfil `Administrador` activo. |

### Cuerpo de la Petición (Request Body)

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

#### Parámetros del Body

| Campo | Tipo | Obligatorio | Validación | Descripción |
|---|---|---|---|---|
| `nombre` | `string` | Sí | Min 3, Max 150 caracteres | Nombre descriptivo del punto o sector vulnerable. |
| `descripcion` | `string` | No | Max 1000 caracteres | Detalle situacional y factores de riesgo del sector. |
| `tipoRiesgo` | `string` | No | Max 100 caracteres | Amenaza recurrente. Opciones sugeridas: `Inundación y anegamiento`, `Deslizamiento / Remoción en masa`, `Desborde de cauce / humedal`, `Incendio forestal / pastizales`, `Colapso estructural / socavón`, `Viento / Voladura de techumbres`, `Otro` (o texto personalizado). |
| `prioridad` | `string` | No | Default: `"MEDIA"` | Nivel de gravedad: `"BAJA"`, `"MEDIA"`, `"ALTA"`, `"CRITICA"`. |
| `delegacionId` | `UUID` | No | UUID válido | Identificador de la delegación territorial asignada. |
| `latitud` | `number` | Sí | [-90, 90] | Coordenada latitud en grados decimales (WGS84 EPSG:4326). |
| `longitud` | `number` | Sí | [-180, 180] | Coordenada longitud en grados decimales (WGS84 EPSG:4326). |

### Respuestas HTTP Esperadas

#### `201 Created` — Creación exitosa
```json
{
  "id": "40000000-0000-4000-8000-000000000099",
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

#### `400 Bad Request` — Datos de creación inválidos o delegación inexistente
```json
{
  "message": "Datos de creación de punto crítico inválidos.",
  "errors": [
    {
      "campo": "nombre",
      "mensaje": "El nombre debe tener al menos 3 caracteres."
    },
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

#### `409 Conflict` — Código institucional duplicado
```json
{
  "message": "El código institucional de punto crítico ya se encuentra registrado."
}
```
