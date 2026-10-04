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
| `GET` | `/api/puntos-criticos/{id}` | Obtener detalle de un punto crítico con delegación para precargar formulario de edición (HU-55). |
| `PUT` | `/api/puntos-criticos/{id}` | Editar características, factores de riesgo y ubicación geográfica de un punto crítico con PostGIS y Socket.io (HU-55). |

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

#### `404 Not Found` — Punto crítico no encontrado
```json
{
  "message": "Punto crítico con ID '40000000-0000-4000-8000-000000000001' no encontrado."
}
```

---

## 5. Detalle de Endpoint: `PUT /api/puntos-criticos/{id}` (HU-55)

Permite al Administrador modificar las características, factores de riesgo y ubicación geográfica interactiva de un punto crítico comunal.

### Reglas de Negocio Específicas de Edición:
1. **Inmutabilidad del Código:** El código institucional (`codigo`) es inmutable tras la creación para salvaguardar la consistencia con bitácoras e informes históricos. No se incluye en el cuerpo de la petición.
2. **Exclusión del Estado Operativo:** El estado `activo` no es editable en este formulario; la vigencia se gestiona exclusivamente mediante el ciclo de borrado lógico. Puntos inactivos no pueden ser editados (`409 Conflict`).
3. **Reubicación Dinámica con Notificación en Tiempo Real (Opción A):** El Administrador puede actualizar las coordenadas geográficas en cualquier momento. El backend recalcula la geometría PostGIS y difunde de inmediato el evento `"punto_critico:actualizado"` vía Socket.io a la central de despacho, supervisores y patrullas/cuadrillas en terreno para que visualicen el nuevo emplazamiento sin refrescar la pantalla.
4. **Persistencia Geoespacial PostGIS:** Al actualizar coordenadas numéricas WGS84, el backend recalcula y persiste la geometría espacial `ubicacion = ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)`.
5. **Auditoría de Modificación:** Se actualiza `actualizado_en = CURRENT_TIMESTAMP` y se almacena `actualizado_por_id` con el UUID del administrador autenticado.
6. **Sincronización Reactiva (Socket.io):** Al completarse la actualización, se emite el evento `"punto_critico:actualizado"` a las salas `"encargado"`, `"supervisor"` y `"administrador"`, garantizando que los tableros cartográficos reflejen el cambio de inmediato.

### Cabeceras Requeridas

| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | Identificador del usuario con rol `Administrador` y permiso `puntos_criticos:editar`. |
| `Content-Type` | `string` | Sí | `application/json` |

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

#### `401 Unauthorized` — No autenticado
```json
{
  "message": "No autorizado. Se requiere cabecera de autenticación válida."
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
