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

### 1.2 Gestión de Personal Operativo y Empleados (ICS Sección de Operaciones)
- **Todos los involucrados son empleados/usuarios:** La entidad `usuarios` modela a cualquier funcionario del sistema (Administrador, Encargado, Supervisor, Call Center, Asistente Social, Personal Operativo). A cada usuario se le asocia un rol con permisos específicos.
- **Personal como especialización operativa para terreno:** La entidad `personal` representa a los usuarios habilitados para labores de campo (patrullas de verificación rápida, miembros de cuadrillas, delegados de cuadrilla y operadores de maquinaria/herramientas). Cuenta con atributos de estado operativo en tiempo real (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`) y coordenadas geográficas (`ultima_ubicacion` PostGIS).
- **Trazabilidad de Auditoría:** Toda modificación a perfiles y atributos de personal registra un evento inmutable en `log_cambios_usuarios` con el usuario responsable (`x-user-id`) y el diff de campos alterados en JSONB.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/recursos` | Listar los recursos del inventario logístico con paginación, filtros territoriales/disponibilidad y delegación. |
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock y especificaciones técnicas. |
| `GET` | `/api/personal` | Listar y buscar empleados/usuarios para selectores con soporte de búsqueda textual y filtro de terreno. |
| `POST` | `/api/personal` | Registrar a un nuevo funcionario municipal con credenciales y ficha de terreno condicional (HU-10). |
| `PATCH` | `/api/personal/:id` | Modificar datos de un empleado actualizando concurrentemente `usuarios` y `personal` en una transacción atómica. |
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
Lista y busca empleados/usuarios para los selectores del frontend.
- `q`: Término de búsqueda (RUT, nombres, apellidos, email).
- `solo_personal`: `true` para restringir solo a personal con ficha operativa de terreno.
- `delegacion_id`: Filtro por delegación.
- `rol_id`: Filtro por rol institucional.
- `ordenar_por`: `apellidos` | `nombres` | `rut`.
- `orden`: `asc` | `desc`.

### 3.4. `POST /api/personal` (HU-10: Registrar Nuevo Funcionario)
Registra un nuevo funcionario municipal en el sistema SGRAI, aprovisionando su cuenta en `usuario` y su ficha operativa en `personal` si el rol es de terreno o se proveen atributos de campo.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (perfil `Administrador`).
- **Validaciones de negocio aplicadas:**
  - **RUT Chileno:** Validación sintáctica y algorítmica obligatoria (algoritmo Módulo 11 con dígito verificador). Normalización previa a persistencia eliminando puntos y espacios (`12345678-K`).
  - **Unicidad Anti-colisión:** Verificación de no duplicidad de `rut` ni `email` en la base de datos (`HTTP 409 Conflict`).
  - **Cifrado Seguro:** Hash criptográfico de contraseña con `bcrypt` (factor de costo 10), compatible con `POST /api/seguridad/login`.
  - **Delegación Territorial:** El parámetro `delegacion_id` es obligatorio para todo funcionario.
  - **Transacción Atómica:** Inserción en `usuario`, inserción condicional en `personal` y registro inmutable en `log_cambios_usuarios` con rollback total ante fallos.
  - **Omisión de Credenciales:** La respuesta excluye estrictamente el campo `password_hash`.

#### Request Body (`application/json`)
```json
{
  "rut": "12.345.678-5",
  "nombres": "Juan Carlos",
  "apellidos": "Pérez González",
  "email": "juan.perez@valdivia.cl",
  "telefono": "+56912345678",
  "password": "PasswordSegura2026",
  "rol_id": "20000000-0000-4000-8000-000000000004",
  "delegacion_id": "30000000-0000-4000-8000-000000000001",
  "cargo": "Brigadista de Rescate",
  "especialidad": "Motosierrista",
  "estado_operativo": "disponible",
  "disponible_terreno": true,
  "observaciones": "Apto para faenas pesadas"
}
```

#### Respuesta Exitosa (`HTTP 201 Created`)
```json
{
  "mensaje": "Funcionario registrado exitosamente",
  "data": {
    "usuario_id": "b3f6634c-6fa1-4328-8671-5f28f0ee0001",
    "rut": "12345678-5",
    "nombres": "Juan Carlos",
    "apellidos": "Pérez González",
    "email": "juan.perez@valdivia.cl",
    "telefono": "+56912345678",
    "usuario_activo": true,
    "fecha_ingreso": "2026-10-01",
    "rol_id": "20000000-0000-4000-8000-000000000004",
    "rol_codigo": "PATRULLA_VERIFICADORA",
    "rol_nombre": "Patrulla Verificadora",
    "delegacion_id": "30000000-0000-4000-8000-000000000001",
    "delegacion_codigo": "DEL_NORTE",
    "delegacion_nombre": "Delegación Municipal Norte",
    "personal_id": "f5e43a99-b132-4752-b883-fa4e99990001",
    "cargo": "Brigadista de Rescate",
    "especialidad": "Motosierrista",
    "estado_operativo": "disponible",
    "disponible_terreno": true,
    "observaciones": "Apto para faenas pesadas",
    "es_personal": true
  }
}
```

### 3.5. `PATCH /api/personal/:id` (HU-12: Editar Empleado)
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

### 3.6. `GET /api/catalogos`
Retorna listas de roles activos, delegaciones activas, cargos y especialidades registradas para alimentar selects de UI.

---

## 4. Códigos de Estado y Errores Esperables

- **`200 OK`:** Solicitud procesada correctamente.
- **`201 Created`:** Recurso validado, geolocalizado e insertado exitosamente.
- **`400 Bad Request`:** Parámetros o identificadores de rol/delegación inexistentes o inválidos.
- **`401 Unauthorized`:** Credenciales de usuario ausentes o inválidas (`X-User-Id` / `Authorization`).
- **`403 Forbidden`:** Usuario no cuenta con permisos suficientes (requiere rol Administrador o permiso explícito).
- **`404 Not Found`:** Recurso o empleado no encontrado en el sistema.
- **`409 Conflict`:** Correo electrónico o RUT duplicado en otro usuario.
- **`422 Unprocessable Entity`:** Formato o tipo de datos inválido según validación Zod.
- **`500 Internal Server Error`:** Falla de base de datos o error de servidor no controlado.
