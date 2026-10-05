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

7. **Creación de Eventos de Recuperación y Despacho Directo (HU-29):**
   - El Encargado puede registrar eventos de recuperación en terreno para entregar insumos y asistencia a sectores o familias damnificadas sin necesidad de un incidente formal previo.
   - El sistema valida atómicamente la existencia y disponibilidad de la patrulla verificadora seleccionada (`patrulla_verificadora.estado = 'DISPONIBLE'`).
   - El sistema comprueba mediante bloqueo transaccional (`FOR UPDATE`) que haya stock suficiente en bodega (`cantidad_inventario - cantidad_en_uso >= cantidad_solicitada`).
   - En la misma transacción atómica de Kysely, se descuentan los recursos del inventario disponible (`cantidad_inventario`), se actualiza la patrulla al estado `'EN_RECUPERACION'`, se genera una misión táctica en estado `'DESPACHADA'` y se emite el evento WebSocket `recuperacion:creada` en tiempo real.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/puntos-criticos` | Listar los puntos críticos y sectores vulnerables monitoreados con paginación, filtros territoriales/prioridad y datos de delegación asociada. |
| `POST` | `/api/eventos-atp/recuperacion` | Registrar un nuevo evento de recuperación, reservar/descontar stock de bodega y despachar una patrulla verificadora a terreno sin incidente previo (HU-29). |

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

## 4. Detalle de Endpoint: `POST /api/eventos-atp/recuperacion` (HU-29)

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

## 5. Eventos en Tiempo Real (Socket.io & Redis Pub/Sub)

Al completar exitosamente la transacción de creación del evento, el backend emite:

* **Evento:** `recuperacion:creada`
* **Salas:** `"sala:encargados"`, `"encargado"`, `"mapa"`
* **Payload:** Objeto idéntico a la propiedad `data` de la respuesta `201 Created`.
* **Propósito en Frontend (`sgrai-web`):**
  - Actualizar inmediatamente el mapa interactivo (añadiendo el nuevo marcador del evento con sus coordenadas).
  - Actualizar la tabla de misiones en curso y la lista de patrullas disponibles/ocupadas sin requerir recargar la página.
