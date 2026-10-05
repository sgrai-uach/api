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

## 4. Detalle de Endpoint: `POST /api/eventos-atp/prevencion` (HU-30)

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
*(O en caso de falta de stock)*:
```json
{
  "message": "Stock insuficiente para el recurso \"Motobomba 5HP\". Solicitado: 5, Disponible: 2."
}
```

---

## 5. Eventos en Tiempo Real (Socket.io)

Al registrarse exitosamente un evento de prevención mediante `POST /api/eventos-atp/prevencion`, el backend emite automáticamente el evento WebSocket `prevencion:creada`:

* **Salas receptoras:**
  - `sala:encargados` y `encargado`: Actualización en vivo del listado de misiones activas y panel del Encargado.
  - `mapa`: Visualización inmediata del nuevo marcador preventivo en el mapa interactivo comunal (Leaflet).
  - `patrulla:<patrullaId>` y `sala:patrulla:<patrullaId>`: Notificación push / WebSocket directa a la patrulla de terreno (PWA) con los detalles técnicos de la misión.
* **Payload emitido:**
  El objeto completo retornado en `data` de la respuesta `201 Created`.

