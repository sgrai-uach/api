# Módulo: Recursos y Personal — Documentación Técnica

Documentación técnica de los endpoints, modelo de datos y reglas de negocio del módulo de **Recursos y Personal** del backend del SGRAI (Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia).

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Recursos y Personal** es responsable de administrar el inventario logístico municipal y el personal operativo disponible para la atención de emergencias, conformación de cuadrillas y patrullas verificadoras, y la gestión territorial mediante delegaciones.

### 1.1 Inventario Logístico (ICS Sección de Logística)
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
- **Restricción de Estado de Mantenimiento (`enMantencion`):**
  - El estado de mantenimiento preventivo o correctivo aplica exclusivamente a maquinaria o vehículos (`esIndividual: true`). Los recursos y suministros a granel (`esIndividual: false`, ej. sacos de arena, combustible, frazadas) no admiten este estado.
- **Sincronización en Tiempo Real (Socket.io):**
  - Ante cualquier modificación de características, inventario o estado, el servidor emite el evento `"recurso:actualizado"` a las salas `"encargado"`, `"supervisor"` y a nivel global.

### 1.2 Gestión de Personal Operativo y Empleados (ICS Sección de Operaciones)
- **Todos los involucrados son empleados/usuarios:** La entidad `usuarios` modela a cualquier funcionario del sistema (Administrador, Encargado, Supervisor, Call Center, Asistente Social, Personal Operativo). A cada usuario se le asocia un rol con permisos específicos.
- **Personal como especialización operativa para terreno:** La entidad `personal` representa a los usuarios habilitados para labores de campo (patrullas de verificación rápida, miembros de cuadrillas, delegados de cuadrilla y operadores de maquinaria/herramientas). Cuenta con atributos de estado operativo en tiempo real (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`) y coordenadas geográficas (`ultima_ubicacion` PostGIS).
- **Trazabilidad de Auditoría:** Toda modificación a perfiles y atributos de personal registra un evento inmutable en `log_cambios_usuarios` con el usuario responsable (`x-user-id`) y el diff de campos alterados en JSONB.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/recursos` | Listar los recursos del inventario logístico con paginación, filtros territoriales/disponibilidad y delegación. |
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock, geolocalización y atributos técnicos. |
| `GET` | `/api/recursos/{id}` | Obtener detalle completo de un recurso para precargar el formulario de edición. |
| `PUT` | `/api/recursos/{id}` | Modificar características, inventario físico, especificaciones técnicas y estado de un recurso. |
| `GET` | `/api/personal` | Listar y buscar empleados/usuarios para selectores con soporte de búsqueda textual y filtro de activos/terreno. |
| `PATCH` | `/api/personal/:id` | Modificar datos de un empleado actualizando concurrentemente `usuarios` y `personal` en una transacción atómica. |
| `DELETE` | `/api/personal/:id` | Dar de baja lógica a un funcionario preservando trazabilidad histórica (H13). |
| `GET` | `/api/catalogos` | Entregar catálogos de referencia (roles, delegaciones activas, especialidades y cargos) para selectores. |


---

## 3. Detalle de Endpoints

### 3.1. `GET /api/recursos` (HU-7: Listar Recursos)
Retorna una lista paginada de los recursos registrados en el inventario, incluyendo su estado de disponibilidad operativa calculado y los datos de su delegación territorial.

#### Parámetros de Consulta (Query Params)
- `pagina` (`number`, default `1`): Número de página.
- `limite` (`number`, default `10`, max `100`): Cantidad por página.
- `delegacionId` (`UUID`): Filtra por delegación.
- `estado` (`string`): Filtra por estado de disponibilidad (`DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`).
- `esIndividual` (`boolean`): Filtra por tipo (maquinaria individual vs granel).
- `busqueda` (`string`): Búsqueda textual insensible a mayúsculas/minúsculas.

### 3.2. `POST /api/recursos` (HU-6: Crear Recurso)
Registra un nuevo recurso individual o a granel en el inventario municipal calculando automáticamente su estado inicial.

### 3.3. `GET /api/personal`
Lista y busca empleados/usuarios para los selectores y tablas del frontend.
- `q`: Término de búsqueda (RUT, nombres, apellidos, email).
- `solo_personal`: `true` para restringir solo a personal con ficha operativa de terreno.
- `incluir_inactivos`: `true` para incluir funcionarios inactivos (`activo = false`). Por omisión (`false`), solo se devuelven activos.
- `delegacion_id`: Filtro por delegación.
- `rol_id`: Filtro por rol institucional.
- `ordenar_por`: `apellidos` | `nombres` | `rut`.
- `orden`: `asc` | `desc`.

### 3.4. `PATCH /api/personal/:id` (HU-12: Editar Empleado)
Modifica los datos de un empleado en el sistema SGRAI, actualizando tanto la tabla general `usuarios` como la tabla especializada `personal` (si corresponde).
- El parámetro `:id` puede ser el UUID de `personal` o el UUID de `usuarios`.

#### Request Body (`application/json`)
```json
{
  "nombres": "Juan Carlos",
  "apellidos": "Pérez González",
  "email": "juan.perez@valdivia.cl",
  "telefono": "+56912345678",
  "rol_id": "6e206d80-b1ab-4b5a-8dda-c65e9e1fce68",
  "delegacion_id": "3bccea9e-289a-4fcc-88aa-50386c8e59fa",
  "activo": true,
  "especialidad": "Motosierrista y Conductor",
  "cargo": "Brigadista Terreno",
  "estado_operativo": "disponible",
  "disponible_terreno": true,
  "observaciones": "Apto para faenas pesadas"
}
```

#### Respuestas
- **`200 OK`**: Datos actualizados exitosamente.
- **`400 Bad Request`**: Rol o delegación inexistente en el sistema.
- **`404 Not Found`**: El identificador de empleado no existe en la base de datos.
- **`409 Conflict`**: El correo electrónico o RUT especificado ya pertenece a otro usuario registrado.
- **`422 Unprocessable Entity`**: Formato o tipo de datos inválido según el esquema Zod.

### 3.5. `DELETE /api/personal/:id` (HU-13: Baja Lógica de Empleado)
Ejecuta la baja lógica de un empleado preservando la integridad referencial histórica para auditoría y reportes.
- **Parámetro `:id`:** UUID de `personal` o UUID de `usuarios`.
- **Efectos:**
  1. En `usuarios`: `activo = false` y se registra la `fecha_salida` con la fecha actual. Revoca de inmediato el acceso al sistema.
  2. En `personal` (si aplica): `estado_operativo = 'inactivo'` y `disponible_terreno = false`.
  3. En `log_cambios_usuarios`: Registra la traza de auditoría con tipo de operación `BAJA_LOGICA_H13`.
- **Respuestas:**
  - **`200 OK`**: Empleado dado de baja exitosamente.
  - **`400 Bad Request`**: El parámetro `:id` no posee un formato UUID válido.
  - **`401 Unauthorized`**: Falta de cabecera de autenticación (`x-user-id` o token Bearer ausente/inválido).
  - **`403 Forbidden`**: El usuario no cuenta con rol Administrador.
  - **`404 Not Found`**: El identificador no corresponde a un funcionario existente.
  - **`409 Conflict`**: Empleado con misión activa, asignado a patrulla en verificación o delegado en cuadrilla en misión.
  - **`500 Internal Server Error`**: Error interno del servidor.

### 3.6. `GET /api/catalogos`
Retorna listas de roles activos, delegaciones activas, cargos y especialidades registradas para alimentar selects de UI.
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

- **`200 OK`:** Solicitud procesada correctamente / Consulta o actualización realizada con éxito.
- **`201 Created`:** Recurso validado, geolocalizado e insertado exitosamente.
- **`400 Bad Request`:**
  - Parámetros de consulta o cuerpo JSON inválidos según esquema Zod (ej. `nombre` menor a 3 caracteres, cantidad negativa).
  - Intento de reducir la cantidad de inventario por debajo de las unidades actualmente en uso en terreno (`cantidadInventario < cantidadEnUso`).
  - Intento de asignar estado de mantenimiento (`enMantencion: true`) a un recurso o material a granel (`esIndividual === false`).
  - Identificadores de rol/delegación inexistentes o inválidos.
- **`401 Unauthorized`:** Cabecera `X-User-Id` (o `Authorization: Bearer`) ausente, vacía o usuario no autenticado.
- **`403 Forbidden`:** Usuario no cuenta con permisos suficientes (requiere rol Administrador o permiso explícito).
- **`404 Not Found`:** Recurso o empleado no encontrado en el sistema.
- **`409 Conflict`:** Correo electrónico o RUT duplicado en otro usuario.
- **`422 Unprocessable Entity`:** Formato o tipo de datos inválido según validación Zod.
- **`500 Internal Server Error`:** Falla de conexión a base de datos PostgreSQL o error de servidor no controlado.

