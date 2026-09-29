# Módulo: Recursos y Personal

Documentación técnica de los endpoints y lógica del módulo de **Recursos y Personal** del backend del SGRAI (Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia).

---

## 1. Reglas de Negocio Aplicadas

- **Gestión Logística y Sección de Operaciones (ICS):** El módulo administra el inventario logístico del sistema que posteriormente podrá ser asignado a cuadrillas o desplegado en terreno ante incidentes o eventos de prevención/recuperación (ATP).
- **Procedencia Territorial por Delegaciones:**
  - Cada recurso puede asociarse a una dependencia territorial municipal (`delegacion_id` opcional): **Delegación Municipal Norte**, **Delegación Municipal Sur**, **Delegación Municipal Costa** y **Delegación Municipal Calle Calle**.
  - Los recursos sin delegación asignada representan reservas centrales de la bodega municipal.
- **Modelo Híbrido Granel vs. Serializado:** 
  - Los recursos a granel o materiales (`esIndividual: false`, ej. sacos de arena, frazadas, combustible) se controlan por volumen o recuento agregado (`cantidadInventario`).
  - Los recursos individuales o maquinaria (`esIndividual: true`, ej. camionetas de rescate, grúas pluma, motobombas) se gestionan por unidades singulares (`cantidadInventario: 1`) y contienen especificaciones técnicas adicionales en el objeto `detalles` (patente, horómetro, caudal en LPM, diámetro en pulgadas, potencia HP, etc.).
- **Estados de Disponibilidad Operativa:**
  - `DISPONIBLE`: Stock libre en depósito o base para asignación inmediata (`cantidadDisponible > cantidadMinima`).
  - `ASIGNADO`: En terreno o desplegado en una misión u operación (`cantidadDisponible === 0` y `cantidadEnUso > 0`).
  - `EN_MANTENCION`: En taller o fuera de servicio por mantenimiento preventivo o correctivo.
  - `BAJO_STOCK`: Operativo pero con inventario disponible menor o igual a la cantidad mínima (alerta de reposición).
  - `NO_DISPONIBLE`: Stock agotado (0 unidades) o inhabilitado administrativamente.
- **Geolocalización Espacial (PostGIS):** Todo recurso almacena sus coordenadas geográficas en EPSG:4326 (`latitud`, `longitud`) y genera una columna geométrica `ubicacion` de tipo `Point` indexada mediante GIST para consultas en mapas interactivos y cálculo de proximidad.
- **Seguridad y Control de Acceso Basado en Roles (RBAC):**
  - La consulta y visualización del inventario logístico (`GET /api/recursos`) requiere que el usuario posea el rol **Administrador** activo o el permiso explícito **`recursos:leer`**.
  - La creación de recursos (`POST /api/recursos`) requiere rol **Administrador** o permiso **`recursos:crear`**.
  - La edición de recursos (`PUT /api/recursos/[id]`) requiere rol **Administrador** o permiso **`recursos:editar`**.
  - La autenticación se verifica mediante la cabecera `X-User-Id` o el token `Authorization: Bearer <usuarioId>`.
- **Inmutabilidad del Tipo de Recurso (`esIndividual`):**
  - El atributo `esIndividual` no es modificable en las operaciones de edición para evitar inconsistencias graves de inventario (ej. transformar materiales a granel como sacos de arena en vehículos con patente).
- **Auditoría de Modificaciones:**
  - Toda actualización registra en la base de datos `actualizado_por_id` (UUID del usuario que editó) y la fecha/hora en `actualizado_en`.
- **Consistencia Operativa y Validación de Inventario:**
  - El sistema no permite reducir la `cantidadInventario` por debajo de las unidades actualmente comprometidas en misiones activas en terreno (`cantidadEnUso`).
- **Sincronización en Tiempo Real (Socket.io):**
  - Ante cualquier modificación de características, inventario o estado, el servidor emite el evento `"recurso:actualizado"` a las salas `"encargado"`, `"supervisor"` y a nivel global.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/recursos` | Listar los recursos del inventario logístico con paginación, filtros territoriales/disponibilidad y procedencia de delegación. |
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock, geolocalización y atributos técnicos. |
| `GET` | `/api/recursos/{id}` | Obtener detalle completo de un recurso para precargar el formulario de edición. |
| `PUT` | `/api/recursos/{id}` | Modificar características, inventario físico, especificaciones técnicas y estado de un recurso. |

---

## 3. Detalle de Endpoints

### 3.1. `GET /api/recursos` (HU-7: Listar Recursos)

Retorna una lista paginada de los recursos registrados en el inventario, incluyendo su estado de disponibilidad operativa calculado y los datos de su delegación territorial.

#### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `pagina` | `number` | No (default: `1`) | Número de página actual (inicia en 1). |
| `limite` | `number` | No (default: `10`) | Cantidad de elementos por página (máximo: `100`). |
| `delegacionId` | `UUID` | No | Filtra por el identificador de la delegación territorial. |
| `estado` | `string` | No | Filtra por estado de disponibilidad (`DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`). |
| `esIndividual` | `boolean` | No | Filtra por tipo (`true`: vehículo/maquinaria individual, `false`: material a granel). |
| `busqueda` | `string` | No | Búsqueda textual insensible a mayúsculas/minúsculas sobre el nombre y descripción. |

#### Formato de Respuesta Exitosa (`200 OK`)

```json
{
  "data": [
    {
      "id": "40000000-0000-4000-8000-000000000001",
      "nombre": "Camioneta Rescate 4x4",
      "tipo": "Vehículo o Maquinaria",
      "esIndividual": true,
      "estado": "DISPONIBLE",
      "cantidadInventario": 1,
      "cantidadEnUso": 0,
      "cantidadDisponible": 1,
      "cantidadMinima": 0,
      "latitud": -39.8142,
      "longitud": -73.2459,
      "descripcion": "Unidad de apoyo logístico y despliegue rápido",
      "detalles": {
        "patente": "ABCD-12",
        "marca": "Toyota",
        "modelo": "Hilux",
        "kilometraje": 45000,
        "tipoCombustible": "DIESEL"
      },
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000001",
        "codigo": "DEL_NORTE",
        "nombre": "Delegación Municipal Norte"
      },
      "creadoPorId": "00000000-0000-4000-8000-000000000001",
      "creadoEn": "2026-09-17T10:00:00.000Z",
      "actualizadoEn": "2026-09-17T10:00:00.000Z"
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

*En caso de inventario vacío o sin coincidencias de filtros, retorna `data: []` con `total: 0` y `totalPaginas: 0` (código HTTP 200).*

---

### 3.2. `POST /api/recursos` (HU-6: Crear Recurso)

Registra un nuevo recurso individual o a granel en el inventario municipal calculando automáticamente su estado inicial.

---

### 3.3. `GET /api/recursos/{id}` (HU-8: Detalle de Recurso)

Retorna la información completa pre-cargada de un recurso específico para alimentar el formulario administrativo de edición.

#### Parámetros de Ruta

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | `UUID` | Sí | Identificador único del recurso. |

#### Formato de Respuesta Exitosa (`200 OK`)

```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "nombre": "Camioneta Rescate 4x4",
  "tipo": "Vehículo o Maquinaria",
  "esIndividual": true,
  "estado": "DISPONIBLE",
  "cantidadInventario": 1,
  "cantidadEnUso": 0,
  "cantidadDisponible": 1,
  "cantidadMinima": 0,
  "latitud": -39.8142,
  "longitud": -73.2459,
  "descripcion": "Unidad operativa para zonas anegadas",
  "detalles": {
    "patente": "ABCD-12",
    "marca": "Toyota",
    "modelo": "Hilux",
    "kilometraje": 45000,
    "tipoCombustible": "DIESEL"
  },
  "delegacion": {
    "id": "30000000-0000-4000-8000-000000000001",
    "codigo": "DEL_NORTE",
    "nombre": "Delegación Municipal Norte"
  },
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "creadoPorId": "00000000-0000-4000-8000-000000000001",
  "actualizadoPorId": "00000000-0000-4000-8000-000000000001",
  "creadoEn": "2026-09-17T10:00:00.000Z",
  "actualizadoEn": "2026-09-29T16:00:00.000Z"
}
```

---

### 3.4. `PUT /api/recursos/{id}` (HU-8: Editar Recurso)

Actualiza las características, inventario físico, ubicación espacial y estado operativo de un recurso.

#### Parámetros de Ruta

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | `UUID` | Sí | Identificador único del recurso a modificar. |

#### Cuerpo de la Petición (`application/json`)

```json
{
  "nombre": "Camioneta Rescate 4x4 - Actualizada",
  "cantidadInventario": 1,
  "cantidadMinima": 0,
  "enMantencion": false,
  "latitud": -39.8142,
  "longitud": -73.2459,
  "descripcion": "Unidad revisada y operativa",
  "detalles": {
    "patente": "ABCD-12",
    "kilometraje": 48000
  },
  "delegacionId": "30000000-0000-4000-8000-000000000001"
}
```

#### Formato de Respuesta Exitosa (`200 OK`)

```json
{
  "message": "Recurso actualizado exitosamente",
  "data": {
    "id": "40000000-0000-4000-8000-000000000001",
    "nombre": "Camioneta Rescate 4x4 - Actualizada",
    "tipo": "Vehículo o Maquinaria",
    "esIndividual": true,
    "estado": "DISPONIBLE",
    "cantidadInventario": 1,
    "cantidadEnUso": 0,
    "cantidadDisponible": 1,
    "cantidadMinima": 0,
    "latitud": -39.8142,
    "longitud": -73.2459,
    "descripcion": "Unidad revisada y operativa",
    "detalles": {
      "patente": "ABCD-12",
      "kilometraje": 48000
    },
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "DEL_NORTE",
      "nombre": "Delegación Municipal Norte"
    },
    "delegacionId": "30000000-0000-4000-8000-000000000001",
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "actualizadoPorId": "00000000-0000-4000-8000-000000000001",
    "creadoEn": "2026-09-17T10:00:00.000Z",
    "actualizadoEn": "2026-09-29T16:00:00.000Z"
  }
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`200 OK`:** Consulta o actualización realizada con éxito.
- **`201 Created`:** Recurso validado, geolocalizado e insertado exitosamente.
- **`400 Bad Request`:**
  - Parámetros de consulta o cuerpo JSON inválidos según esquema Zod (ej. `nombre` menor a 3 caracteres, cantidad negativa).
  - Intento de reducir la cantidad de inventario por debajo de las unidades actualmente en uso en terreno (`cantidadInventario < cantidadEnUso`).
- **`401 Unauthorized`:**
  - La cabecera `X-User-Id` (o `Authorization: Bearer`) está ausente, vacía o el usuario no existe/está inactivo.
- **`403 Forbidden`:**
  - El usuario está autenticado pero no cuenta con el perfil de **Administrador** requerido para acceder al módulo.
- **`404 Not Found`:**
  - El recurso con el identificador solicitado no existe en el sistema.
- **`500 Internal Server Error`:**
  - Falla de conexión a la base de datos PostgreSQL o error no controlado del servidor.

