# Módulo: Eventos ATP (Prevención, Puntos Críticos y Recuperación) — Documentación Técnica de API

Este documento describe la operativa técnica de los endpoints y reglas de negocio del módulo de **Eventos ATP** (Alerta Temprana Preventiva, Prevención, Puntos Críticos y Recuperación) en el backend monolítico modular `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Monitoreo del Administrador y Centro de Mando) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Eventos ATP** gestiona los puntos críticos, sectores de alta vulnerabilidad, eventos de mitigación/prevención y recuperación en la comuna de Valdivia:

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
   - La consulta y gestión de puntos críticos está restringida al rol `Administrador`.
   - La creación de eventos de recuperación está habilitada para `Encargado de Operaciones` y `Administrador`.
   - Cualquier petición anónima es rechazada con `401 Unauthorized`.
   - La autenticación se verifica a través de la cabecera HTTP `X-User-Id: <UUID>` o el token Bearer (`Authorization: Bearer <token>`).
6. **Respuesta ante Lista Vacía (Criterio de Aceptación 3):**
   - Si no existen puntos críticos registrados en la base de datos (o si los filtros aplicados no retornan coincidencias), la API responde `200 OK` con un arreglo vacío `data: []` y `total: 0`.
7. **Edición y Reubicación Dinámica con Notificación en Tiempo Real (HU-55):**
   - El Administrador puede modificar los datos descriptivos y reubicar las coordenadas de un punto crítico en cualquier momento. El backend recalcula la geometría PostGIS y difunde el evento `"punto_critico:actualizado"` vía Socket.io a la central, supervisores y unidades en terreno para su actualización inmediata.
   - El código institucional es inmutable. No se permite editar puntos inactivos (`409 Conflict`).
8. **Borrado Lógico y Auditoría (HU-56):**
   - La desactivación de un punto crítico no destruye físicamente el registro. En su lugar, se actualiza `activo = false`, registrando `eliminado_en` y `eliminado_por_id`.
9. **Protección de Operaciones Activas en Terreno (HU-56):**
   - Si el punto crítico se encuentra vinculado a una misión preventiva activa (estados `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`) o tiene una patrulla/cuadrilla asignada, la API **rechaza la solicitud de eliminación con código HTTP `409 Conflict`**.
10. **Sincronización Reactiva en Tiempo Real (Socket.io):**
    - Al procesarse la eliminación lógica, la API emite el evento `"punto_critico:eliminado"` a las salas `"encargado"` y `"supervisor"`, así como en difusión global.
11. **Creación de Eventos de Recuperación y Despacho Directo (HU-29):**
    - El Encargado puede registrar eventos de recuperación en terreno para entregar insumos y asistencia a sectores o familias damnificadas sin necesidad de un incidente formal previo.
    - El sistema valida atómicamente la existencia y disponibilidad de la patrulla verificadora seleccionada (`patrulla_verificadora.estado = 'DISPONIBLE'`).
    - El sistema comprueba mediante bloqueo transaccional (`FOR UPDATE`) que haya stock suficiente en bodega (`cantidad_inventario - cantidad_en_uso >= cantidad_solicitada`).
    - En la misma transacción atómica de Kysely, se descuentan los recursos del inventario disponible (`cantidad_inventario`), se actualiza la patrulla al estado `'EN_RECUPERACION'`, se genera una misión táctica en estado `'DESPACHADA'` y se emite el evento WebSocket `recuperacion:creada` en tiempo real.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/puntos-criticos` | Listar los puntos críticos y sectores vulnerables monitoreados con paginación, filtros territoriales/prioridad y datos de delegación asociada (HU-57). |
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

---

## 6. Detalle de Endpoint: `DELETE /api/puntos-criticos/{id}` (HU-56)

Aplica el **borrado lógico** (*soft delete*) de un punto crítico del catálogo comunal. El registro se desactiva (`activo: false`) y se estampan los metadatos de auditoría `eliminado_en` y `eliminado_por_id`.

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

## 7. Detalle de Endpoint: `POST /api/eventos-atp/recuperacion` (HU-29)

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

## 8. Eventos de Tiempo Real (Socket.io)

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

### Evento: `punto_critico:eliminado`

Emitido automáticamente tras un borrado lógico exitoso hacia las salas `"encargado"` y `"supervisor"`, así como por difusión general.

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

### Evento: `recuperacion:creada`

Al completar exitosamente la transacción de creación del evento, el backend emite:

* **Evento:** `recuperacion:creada`
* **Salas:** `"sala:encargados"`, `"encargado"`, `"mapa"`
* **Payload:** Objeto idéntico a la propiedad `data` de la respuesta `201 Created`.
* **Propósito en Frontend (`sgrai-web`):**
  - Actualizar inmediatamente el mapa interactivo (añadiendo el nuevo marcador del evento con sus coordenadas).
  - Actualizar la tabla de misiones en curso y la lista de patrullas disponibles/ocupadas sin requerir recargar la página.

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
