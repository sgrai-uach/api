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
  - La autenticación se verifica mediante la cabecera `X-User-Id` o el token `Authorization: Bearer <usuarioId>`.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/recursos` | Listar los recursos del inventario logístico con paginación, filtros territoriales/disponibilidad y procedencia de delegación. |
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock, geolocalización y atributos técnicos. |

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

## 4. Códigos de Estado y Errores Esperables

- **`200 OK`:** Consulta realizada con éxito. Retorna arreglo de recursos y metadatos de paginación.
- **`201 Created`:** Recurso validado, geolocalizado e insertado exitosamente.
- **`400 Bad Request`:**
  - Parámetros de consulta o cuerpo JSON inválidos según esquema Zod (ej. `pagina < 1`, `limite > 100`, `nombre` menor a 3 caracteres, coordenadas fuera de rango).
- **`401 Unauthorized`:**
  - La cabecera `X-User-Id` (o `Authorization: Bearer`) está ausente, vacía o el usuario no existe/está inactivo.
- **`403 Forbidden`:**
  - El usuario está autenticado pero no cuenta con el perfil de **Administrador** requerido para acceder al módulo.
- **`500 Internal Server Error`:**
  - Falla de conexión a la base de datos PostgreSQL o error no controlado del servidor.
