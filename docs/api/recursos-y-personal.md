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
- **Seguridad y Control de Acceso Basado en Permisos (RBAC Estricto):**
  - **Principio Fundamental:** El sistema depende **estrictamente de los permisos asignados**, nunca del nombre del rol institucional. Los roles actúan únicamente como contenedores organizacionales de permisos en la base de datos (`rol_permiso`), pero ninguna regla de negocio, ruta o componente de interfaz debe evaluar nombres de rol (`rol === 'Supervisor'` o `rol === 'Administrador'`) directamente:
    - **`recursos:leer`**: Autoriza la consulta del inventario logístico y la visualización de fichas técnicas (`GET /api/recursos`, `GET /api/recursos/[id]`). Cualquier usuario que posea este permiso tiene acceso de lectura (sea Administrador, Encargado, Supervisor, o roles futuros).
    - **`recursos:crear`**: Autoriza exclusivamente el registro y alta de nuevos recursos (`POST /api/recursos`).
    - **`recursos:editar`**: Autoriza la modificación de características, inventario físico y estado operativo (`PUT /api/recursos/[id]`).
  - La autenticación se verifica mediante el token estándar `Authorization: Bearer <jwt>` (o `X-User-Id` para retrocompatibilidad interna).
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
- **Todos los involucrados son empleados/usuarios:** La entidad `usuario` modela a cualquier funcionario del sistema (Administrador, Encargado, Supervisor, Call Center, Asistente Social, Personal Operativo). A cada usuario se le asocia un rol con permisos específicos.
- **Disponibilidad en `usuario` (normalización H11):** El estado operativo (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`) reside en **`usuario.estado_operativo`** y representa la *disponibilidad actual* de la cuenta. Antes residía en `personal.estado_operativo`; la normalización se aplica porque la disponibilidad es un atributo de **todas** las cuentas del sistema y no sólo de quienes poseen ficha de terreno.
- **Personal como perfil opcional de terreno:** La entidad `personal` es la **ficha opcional de terreno** (patrullas de verificación rápida, miembros de cuadrillas, delegados de cuadrilla y operadores de maquinaria/herramientas). Conserva la **capacidad** de salir a terreno (`disponible_terreno`) y las coordenadas geográficas (`ultima_ubicacion` PostGIS), pero **no** el estado.
- **Tres conceptos diferenciados:**
  | Concepto | Ubicación | Significado |
  |---|---|---|
  | Estado operativo | `usuario.estado_operativo` | Disponibilidad actual del funcionario (siempre presente). |
  | Cuenta activa | `usuario.activo` | Pertenencia y acceso al sistema (baja lógica). |
  | Capacidad de terreno | `personal.disponible_terreno` | Aptitud para ser desplegado (`null` = no aplica, no posee ficha de terreno). |
- **Trazabilidad de Auditoría:** Toda modificación a perfiles y atributos de personal registra un evento inmutable en `log_cambios_usuarios` con el usuario responsable (`x-user-id`) y el diff de campos alterados en JSONB.
- **Control de Acceso del Módulo (RBAC - H11):**
  - **`personal:leer`**: Autoriza la consulta del directorio y de la disponibilidad (`GET /api/personal`, `GET /api/personal/[id]`).
  - **`personal:crear`**: Autoriza el registro de funcionarios (`POST /api/personal`).
  - **`personal:editar`**: Autoriza la modificación de datos y disponibilidad (`PATCH /api/personal/[id]`).
  - **`personal:gestionar`**: Autoriza la baja lógica de funcionarios (`DELETE /api/personal/[id]`).
  - El rol `Administrador` posee los cuatro permisos; el rol `Encargado` posee `personal:leer`.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/recursos` | Listar los recursos del inventario logístico con paginación, filtros territoriales/disponibilidad y delegación. |
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock, geolocalización y atributos técnicos. |
| `GET` | `/api/recursos/{id}` | Obtener detalle completo de un recurso para precargar el formulario de edición. |
| `PUT` | `/api/recursos/{id}` | Modificar características, inventario físico, especificaciones técnicas y estado de un recurso. |
| `DELETE` | `/api/recursos/{id}` | Eliminar un recurso del inventario mediante borrado lógico (soft delete) y trazabilidad completa. |
| `GET` | `/api/cuadrillas` | Listar cuadrillas operativas con paginación, filtros territoriales, de estado y búsqueda (H81/H79). |
| `POST` | `/api/cuadrillas` | Registrar y dar de alta una nueva cuadrilla operativa en el sistema con líder delegado (H79). |
| `GET` | `/api/cuadrillas/{id}` | Obtener detalle unitario consolidado de una cuadrilla con sus recursos y trabajadores asignados. |
| `PUT` | `/api/cuadrillas/{id}` | Modificar datos, reasignar delegado y dotación de trabajadores/recursos de una cuadrilla (H81). |
| `GET` | `/api/personal` | Listar y buscar empleados/usuarios para selectores con soporte de búsqueda textual y filtro de activos/terreno. |
| `POST` | `/api/personal` | Registrar a un nuevo funcionario municipal con credenciales y ficha de terreno condicional (HU-10). |
| `PATCH` | `/api/personal/:id` | Modificar datos de un empleado actualizando concurrentemente `usuarios` y `personal` en una transacción atómica. |
| `DELETE` | `/api/personal/:id` | Dar de baja lógica a un funcionario preservando trazabilidad histórica (H13). |
| `GET` | `/api/catalogos` | Entregar catálogos de referencia (roles, delegaciones activas, especialidades y cargos) para selectores. |
| `GET` | `/api/patrullas` | Listar patrullas verificadoras con paginación estricta, filtros por delegación/estado, líder, integrantes y misión activa (HU-16). |
| `POST` | `/api/patrullas` | Registrar una nueva patrulla verificadora en estado canónico DISPONIBLE con código, dotación y vehículo (HU-83). |
| `GET` | `/api/patrullas/{id}` | Consultar detalle completo de una patrulla verificadora. |
| `PATCH` | `/api/patrullas/{id}` | Actualizar estado operativo canónico y/o geolocalización de una patrulla con emisión en tiempo real vía WebSocket. |
| `PUT` | `/api/patrullas/{id}` | Modificar delegación base, vehículo asignado y dotación de personal de una patrulla verificadora (HU-84). |
| `DELETE` | `/api/patrullas/{id}` | Desactivar mediante baja lógica una patrulla verificadora liberando personal y vehículo asignados (HU-85). |


---

## 3. Detalle de Endpoints

### 3.1. `GET /api/recursos` (HU-7: Listar Recursos / HU-50: Listado de Recursos para Supervisor)
Retorna una lista paginada de los recursos registrados en el inventario, incluyendo su estado de disponibilidad operativa calculado y los datos de su delegación territorial.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` para retrocompatibilidad interna).
- **Perfiles autorizados:** `Administrador` o cualquier usuario con permiso `recursos:leer` activo (como `Supervisor` y `Encargado`).
- **Regla RBAC de Solo Lectura (HU-50):** El perfil `Supervisor` posee exclusivamente permisos de lectura (`recursos:leer`). Intentos de invocación a mutaciones como `POST /api/recursos` (crear), `PUT /api/recursos/[id]` (editar) o `DELETE /api/recursos/[id]` (eliminar) retornarán `HTTP 403 Forbidden`.
- **Credenciales Institucionales de Prueba para Supervisor (Semilla Migración 015):**
  - **Email:** `supervisor@valdivia.cl`
  - **RUT:** `44444444-4`
  - **Contraseña:** `Valdivia2026!`
  - **Rol:** `Supervisor Estratégico` (`SUPERVISOR`)

#### Parámetros de Consulta (Query Params)
- `page` / `pagina` (`number`, default `1`): Número de página (estándar SGRAI `page`, alias legado `pagina`).
- `limit` / `limite` (`number`, default `10`, max `100`): Cantidad por página (estándar SGRAI `limit`, alias legado `limite`).
- `delegacionId` (`UUID`): Filtra por delegación.
- `estado` (`string`): Filtra por estado de disponibilidad (`DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`).
- `esIndividual` (`boolean`): Filtra por tipo (maquinaria individual vs granel).
- `busqueda` (`string`): Búsqueda textual insensible a mayúsculas/minúsculas.
- `soloLectura` (`boolean`, opcional, default `undefined`): Indicador de consulta en modo solo lectura para auditoría o visualización de perfiles estratégicos/supervisores.

### 3.2. `POST /api/recursos` (HU-6: Crear Recurso)
Registra un nuevo recurso individual o a granel en el inventario municipal calculando automáticamente su estado inicial.

### 3.3. `GET /api/personal` (H34: Listado de Personal / H11: Disponibilidad / H26: Asistentes Sociales y Casos FIBE)
Lista y busca empleados/usuarios para los selectores del frontend, tablas de administración y la gestión operativa del Encargado (incluyendo la nómina de Asistentes Sociales para el levantamiento de fichas FIBE - HU-26), con paginación estándar transversal SGRAI y soporte multicriterio.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`.
- **Permisos aceptados (RBAC H11):** `personal:leer`, `personal:gestionar` o `personal:crear` (el rol `Administrador` accede por ser propietario de los permisos).
- **Permiso adicional (H26):** Si se consulta la nómina de asistentes sociales (`rolCodigo=ASISTENTE_SOCIAL`), se exige además el permiso `asistencia_social:leer`.
- **Errores de control de acceso:**
  - **`401 Unauthorized`**: Token ausente, inválido o expirado.
  - **`403 Forbidden`**: El rol no posee ninguno de los permisos aceptados para el módulo de Personal, o no cuenta con `asistencia_social:leer` al consultar asistentes sociales.
- **Parámetros de consulta (Query Params):**
- `page` / `pagina` (`number`, default `1`): Número de página (inicia en 1).
- `limit` / `limite` (`number`, default `20`, máx `100`): Cantidad de registros por página.
- `rolCodigo` / `rol_codigo` (`string`, opcional): Filtro por código canónico de rol institucional (ej. `ASISTENTE_SOCIAL`).
- `delegacionId` / `delegacion_id` (`UUID`): Filtro por delegación territorial.
- `rolId` / `rol_id` (`UUID`): Filtro por rol institucional.
- `estadoOperativo` / `estado_operativo`: Filtro por estado operativo (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`). Se aplica sobre `usuario.estado_operativo`.
- `cargo` (`string`): Filtro por cargo funcional (búsqueda parcial `ILIKE`).
- `especialidad` (`string`): Filtro por especialidad técnica (búsqueda parcial `ILIKE`).
- `soloPersonal` / `solo_personal` (`boolean`): `true` para restringir solo a personal con ficha operativa de terreno (`personal.id IS NOT NULL`).
- `busqueda` / `q` (`string`): Búsqueda textual insensible a mayúsculas sobre RUT, nombres, apellidos o email.
- `incluirInactivos` / `incluir_inactivos` (`boolean`, default `false`): Por omisión (`false`), solo se devuelven funcionarios activos (`activo = true`). Si es `true`, incluye también funcionarios dados de baja.
- `estado` (`string`): `'activo'` | `'inactivo'` | `'todos'`. Permite filtrar funcionarios por estado laboral.
- `ordenarPor` / `ordenar_por`: `apellidos` (default) | `nombres` | `rut`.
- `orden`: `asc` (default) | `desc`.

#### Reglas de Negocio y Seguridad RBAC (HU-26)
- **Cómputo de Casos FIBE Asignados:** Cada registro retornado incluye `casos_fibe_asignados` (entero no negativo). Para asistentes sociales, calcula en tiempo real mediante subconsulta optimizada los eventos de asistencia social (`evento_asistencia_social`) en estados `'ASIGNADO'` o `'EN_EVALUACION_FIBE'` que no han sido dados de baja (`eliminado_en IS NULL`).
- **Control de Acceso RBAC:** Toda consulta exige autenticación y posesión de los permisos de personal (`personal:leer`, `personal:gestionar` o `personal:crear`). Adicionalmente, si la consulta solicita la nómina de asistentes sociales (`rolCodigo=ASISTENTE_SOCIAL`), el endpoint exige el permiso `asistencia_social:leer` (asignado a los roles Encargado, Administrador y Asistente Social). Si la llamada carece de sesión responde `HTTP 401 Unauthorized`, y si el perfil no posee los permisos requeridos responde `HTTP 403 Forbidden`.

**Respuesta:** Retorna `{ data: PersonalItem[], meta: PaginationMeta }` con el arreglo de funcionarios y el objeto `meta` de paginación. Cada ítem incluye el campo `casos_fibe_asignados: number`.

**Campos de disponibilidad (H11):**
- `estado_operativo`: **siempre presente** (enum no nulable) con la disponibilidad actual del funcionario.
- `disponible_terreno`: `boolean | null`. El valor `null` significa que el usuario **no posee ficha de terreno** (no aplica).
- `es_personal`: `true` cuando el usuario tiene ficha en `personal`.

```json
{
  "data": [
    {
      "usuario_id": "00000000-0000-4000-8000-000000000002",
      "rut": "22222222-2",
      "nombres": "María",
      "apellidos": "González",
      "email": "maria.gonzalez@valdivia.cl",
      "telefono": "+56912345678",
      "usuario_activo": true,
      "estado_operativo": "disponible",
      "rol_id": "20000000-0000-4000-8000-000000000002",
      "rol_codigo": "CALL_CENTER",
      "rol_nombre": "Call Center",
      "delegacion_id": "30000000-0000-4000-8000-000000000001",
      "delegacion_codigo": "DEL_NORTE",
      "delegacion_nombre": "Delegación Municipal Norte",
      "personal_id": null,
      "especialidad": null,
      "cargo": null,
      "disponible_terreno": null,
      "observaciones": null,
      "es_personal": false
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```

### 3.4. `POST /api/personal` (HU-10: Registrar Nuevo Funcionario)
Registra un nuevo funcionario municipal en el sistema SGRAI, aprovisionando su cuenta en `usuario` y su ficha operativa en `personal` si el rol es de terreno o se proveen atributos de campo.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (perfil `Administrador`).
- **Validaciones de negocio aplicadas:**
  - **RUT Chileno:** Validación sintáctica y algorítmica obligatoria (algoritmo Módulo 11 con dígito verificador). Normalización previa a persistencia eliminando puntos y espacios (`12345678-K`).
  - **Unicidad Anti-colisión:** Verificación de no duplicidad de `rut` ni `email` en la base de datos (`HTTP 409 Conflict`).
  - **Cifrado Seguro:** Hash criptográfico de contraseña con `bcrypt` (factor de costo 10), compatible con `POST /api/seguridad/login`.
  - **Delegación Territorial:** El parámetro `delegacion_id` es obligatorio para todo funcionario.
  - **Disponibilidad inicial (H11):** `estado_operativo` se persiste siempre en `usuario`. Por defecto es `disponible` si la cuenta queda activa e `inactivo` si la cuenta se crea deshabilitada. Los estados `en_mision` y `en_patrulla` sólo se admiten para perfiles de terreno.
  - **Ficha de terreno condicional:** Sólo se inserta en `personal` si el rol es de terreno (`PATRULLA_VERIFICADORA`, `DELEGADO_CUADRILLA`, `BRIGADISTA`) o si se envían atributos de terreno. `disponible_terreno` es la capacidad de despliegue y por defecto vale `true` para roles de terreno.
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
Modifica los datos de un empleado en el sistema SGRAI, actualizando tanto la tabla general `usuario` como la ficha opcional de terreno `personal` (si corresponde).
- El parámetro `:id` puede ser el UUID de `personal` o el UUID de `usuario`.
- **Reglas de disponibilidad (H11):**
  - `estado_operativo` se persiste siempre en `usuario.estado_operativo`.
  - Si el rol deja de ser de terreno, la ficha `personal` se elimina y un estado de terreno (`en_mision` / `en_patrulla`) se reasigna a `disponible`.
  - Si el rol pasa a ser de terreno y el usuario no tenía ficha, se crea con `disponible_terreno = true`.
  - Si `activo = false`, el estado se fuerza a `inactivo` y `disponible_terreno` a `false`.

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
- **Parámetro `:id`:** UUID de `personal` o UUID de `usuario`.
- **Efectos:**
  1. En `usuario`: `activo = false`, `estado_operativo = 'inactivo'` y se registra la `fecha_salida` con la fecha actual. Revoca de inmediato el acceso al sistema.
  2. En `personal` (si aplica): `disponible_terreno = false` (deja de ser desplegable en terreno).
  3. En `log_cambios_usuarios`: Registra la traza de auditoría con tipo de operación `BAJA_LOGICA_H13`.
- **Bloqueo operativo:** la baja se rechaza con `409 Conflict` si el funcionario está `en_mision` o `en_patrulla`, si es delegado de una cuadrilla en misión o si lidera una patrulla en verificación.
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

### 3.7. `DELETE /api/recursos/{id}` (HU-9: Eliminar Recurso - Borrado Lógico)
Aplica un **borrado lógico (soft delete)** sobre un recurso existente en el sistema. Preserva el registro físico en la base de datos para no alterar el historial de misiones pasadas, asignaciones previas ni reportes institucionales (ej. Informe Alfa 37G de SENAPRED).

#### Reglas de Negocio
1. **Control de Acceso (RBAC):** Requiere autenticación de usuario activo con rol de `Administrador` o permiso `recursos:eliminar`.
2. **Protección Operativa de Terreno:** Impide la eliminación y responde con código **`409 Conflict`** si el recurso se encuentra en cualquiera de los siguientes estados:
   - Tiene unidades en uso (`cantidadEnUso > 0` o `estado === 'ASIGNADO'`).
   - Se encuentra asignado en `cuadrilla_recurso` a una cuadrilla en estado `EN_MISION` o adscrita a una misión `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`.
3. **Auditoría:** Registra en la base de datos la fecha/hora exacta en `eliminado_en` y el usuario responsable en `eliminado_por_id`.
4. **Sincronización en Tiempo Real:** Emite el evento WebSocket `recurso:eliminado` a las salas `encargado`, `supervisor` y canal global para actualizar dinámicamente las listas en `sgrai-web` y `sgrai-pwa`.

#### Ejemplo de Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Recurso dado de baja exitosamente del inventario.",
  "id": "40000000-0000-4000-8000-000000000001",
  "nombre": "Pala Cuadrada",
  "eliminadoEn": "2026-09-30T19:30:00.000Z",
  "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
}
```

### 3.8. `GET /api/patrullas` y `PATCH /api/patrullas/{id}` (HU-16: Patrullas Verificadoras y Estado Operativo)

Permite al **Encargado de Operaciones** visualizar en el Centro de Mando la dotación inmediata de equipos de evaluación rápida (patrullas verificadoras) y su estado operativo en tiempo real para asignarlos oportunamente a la verificación de incidentes reportados.

#### 3.8.1 Estados Canónicos en Base de Datos
La columna `patrulla_verificadora.estado` maneja estrictamente los siguientes valores canónicos (en mayúsculas):
- `DISPONIBLE`: Patrulla libre en base territorial, apta para asignación y despacho inmediato.
- `EN_VERIFICACION`: Patrulla despachada a terreno realizando el triage y evaluación preliminar de un incidente formal.
- `EN_PREVENCION`: Patrulla desplegada en patrullaje preventivo o mitigación en punto crítico (Evento ATP Preventivo).
- `EN_RECUPERACION`: Patrulla ejecutando labores operativas post-emergencia (Evento ATP de Recuperación).
- `EN_MISION`: Patrulla participando en otra misión táctica asignada.
- `NO_DISPONIBLE`: Patrulla fuera de servicio, sin vehículo o inhabilitada administrativamente.

*(Nota: Queda estrictamente prohibido el uso de valores no canónicos como `'Ocupada'`, `'LIBRE'` o emojis en backend o frontend).*

#### 3.8.2 Control de Acceso (RBAC Estricto)
- **Autenticación:** Requiere `Authorization: Bearer <token_jwt>`.
- **Permiso requerido:** `misiones:leer` (asignado a roles `Encargado`, `Administrador` y `Supervisor`).

#### 3.8.3 Parámetros de Consulta para `GET /api/patrullas`
- `page` (`number`, default `1`): Número de página (1-indexed).
- `limit` (`number`, default `20`, máx `100`): Cantidad de registros por página.
- `delegacionId` (`UUID`, opcional): Filtra por delegación territorial asignada (`delegacion.id`).
- `estado` (`string`, opcional): Filtro por estado operativo canónico (`DISPONIBLE`, `EN_VERIFICACION`, etc.).
- `busqueda` (`string`, opcional): Búsqueda parcial insensible a mayúsculas sobre nombre de patrulla o líder.

#### 3.8.4 Estructura del Contrato de Respuesta (`GET /api/patrullas`)
```json
{
  "message": "Listado de patrullas verificadoras obtenido exitosamente.",
  "data": [
    {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Rápida Costa-1",
      "estado": "EN_VERIFICACION",
      "latitud": -39.86523,
      "longitud": -73.39841,
      "ultimaActualizacionUbicacion": "2026-10-20T22:00:00.000Z",
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000003",
        "nombre": "Delegación Municipal Costa",
        "codigo": "DEL_COSTA"
      },
      "lider": {
        "id": "00000000-0000-4000-8000-000000000003",
        "nombre": "Encargado de Operaciones",
        "email": "encargado@valdivia.cl",
        "telefono": "+56911112222",
        "rut": "33333333-3"
      },
      "integrantes": [
        {
          "id": "b1000000-0000-4000-8000-000000000001",
          "usuarioId": "c1000000-0000-4000-8000-000000000001",
          "nombre": "Juan Brigadista",
          "email": "juan@valdivia.cl",
          "telefono": "+56999998888",
          "rut": "18111222-3",
          "cargo": "Evaluador Rápido",
          "especialidad": "Riesgos Geológicos",
          "rolEnPatrulla": "OPERATIVO",
          "estadoOperativo": "en_patrulla"
        }
      ],
      "misionActiva": {
        "id": "d1000000-0000-4000-8000-000000000001",
        "codigo": "MIS-2026-0001",
        "titulo": "Evaluación preliminar de riesgo de derrumbe en ruta T-350",
        "tipoMision": "VERIFICACION",
        "estado": "EN_CURSO",
        "prioridad": "CRITICA",
        "incidenteId": "a1000000-0000-4000-8000-000000000003",
        "incidenteCodigo": "INC-2026-0003",
        "incidenteFolio": "FOL-2026-0003",
        "incidenteTipoAfectacion": "Deslizamiento de Tierra",
        "incidenteDireccion": "Ruta T-350 km 12, Valdivia"
      },
      "creadoEn": "2026-10-20T10:00:00.000Z",
      "actualizadoEn": "2026-10-20T22:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### 3.8.5 Mutación de Estado (`PATCH /api/patrullas/{id}`)
Permite modificar el estado operativo de una patrulla y/o sus coordenadas geográficas.
- **Body JSON:**
  ```json
  {
    "estado": "DISPONIBLE",
    "motivo": "Verificación finalizada y patrulla retornada a base",
    "latitud": -39.819588,
    "longitud": -73.245209
  }
  ```
- **Respuesta (`200 OK`):** Retorna `{ message, data }` con la patrulla actualizada.

#### 3.8.6 Alta de Patrulla Verificadora (`POST /api/patrullas`) (HU-83)
Permite al Administrador dar de alta una nueva patrulla verificadora para labores de triage y evaluación preliminar en terreno:
- **Autenticación requerida:** `Authorization: Bearer <jwt>` (o `X-User-Id` para retrocompatibilidad).
- **Autorización RBAC:** Requiere rol `Administrador` o poseer el permiso `recursos:crear`.
- **Reglas de Negocio:**
  - El `codigo` debe ser único e inmutable en el sistema (ej. `PV-NORTE-01`). Ante duplicados se responde con `HTTP 409 Conflict`.
  - El registro nace obligatoriamente con estado inicial canónico `DISPONIBLE`.
  - El vehículo institucional asignado (`vehiculoId`) debe existir, ser un recurso individual (`es_individual: true`) y encontrarse en estado `DISPONIBLE`. Al registrarse la patrulla, el vehículo pasa atómicamente a estado `ASIGNADO` con `cantidad_en_uso = 1`.
  - Los funcionarios asignados en `personalIds` deben tener cuenta activa y rol `PATRULLA_VERIFICADORA`. Sus estados pasan a `en_patrulla`.
  - Se emite de inmediato el evento WebSocket `patrulla:creada` hacia la sala de encargados y mapa del Centro de Mando.

- **Body JSON:**
  ```json
  {
    "codigo": "PV-NORTE-01",
    "nombre": "Patrulla Rápida Norte 1",
    "delegacionId": "30000000-0000-4000-8000-000000000001",
    "vehiculoId": "e1000000-0000-4000-8000-000000000002",
    "personalIds": [
      "b1000000-0000-4000-8000-000000000001",
      "b1000000-0000-4000-8000-000000000002"
    ],
    "usuarioLiderId": "c1000000-0000-4000-8000-000000000001"
  }
  ```

- **Respuesta (`201 Created`):**
  ```json
  {
    "message": "Patrulla verificadora registrada exitosamente.",
    "data": {
      "id": "f1000000-0000-4000-8000-000000000099",
      "codigo": "PV-NORTE-01",
      "nombre": "Patrulla Rápida Norte 1",
      "estado": "DISPONIBLE",
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000001",
        "nombre": "Delegación Municipal Norte",
        "codigo": "DEL_NORTE"
      },
      "vehiculo": {
        "id": "e1000000-0000-4000-8000-000000000002",
        "nombre": "Camioneta 4x4 Navara",
        "detalles": { "patente": "CD-FG-23" },
        "estado": "ASIGNADO"
      },
      "lider": {
        "id": "c1000000-0000-4000-8000-000000000001",
        "nombre": "Juan Líder",
        "email": "juan@valdivia.cl"
      },
      "integrantes": [...],
      "misionActiva": null,
      "creadoEn": "2026-10-24T18:00:00.000Z",
      "actualizadoEn": "2026-10-24T18:00:00.000Z"
    }
  }
  ```

#### 3.8.7 Modificación de Patrulla Verificadora (`PUT /api/patrullas/{id}`) (HU-84)
Permite al Administrador adecuar la composición del equipo verificador ante rotaciones o mantenimiento vehicular, reasignando su vehículo, delegación municipal base y dotación de funcionarios asociados:
- **Autenticación requerida:** `Authorization: Bearer <jwt>` (o `X-User-Id` para retrocompatibilidad).
- **Autorización RBAC:** Requiere rol `Administrador` o poseer el permiso `recursos:editar`.
- **Reglas de Negocio:**
  - **Bloqueo Operativo Estricto:** Si la patrulla se encuentra en estado `EN_VERIFICACION` o cuenta con una misión táctica activa en terreno (`PLANIFICADA`, `DESPACHADA` o `EN_CURSO`), el backend rechaza la modificación con código `HTTP 409 Conflict`.
  - **Reasignación Vehicular Atómica:** 
    - Si se desasigna el vehículo previo (`vehiculoId: null`) o se reemplaza por otro, el vehículo anterior se libera automáticamente (`estado = 'DISPONIBLE'`, `cantidad_en_uso = 0`).
    - Si se especifica un nuevo vehículo, este debe existir, ser un recurso individual (`es_individual: true`) y encontrarse disponible (`estado === 'DISPONIBLE'`). Al asignarse, pasa a estado `ASIGNADO` con `cantidad_en_uso = 1`.
  - **Dotación de Personal:**
    - Los funcionarios desvinculados de la patrulla retornan a `estado_operativo = 'disponible'` en la tabla `personal`.
    - Los nuevos funcionarios asignados deben contar con rol `PATRULLA_VERIFICADORA` y pasan a `estado_operativo = 'en_patrulla'`.
  - **Auditoría:** Cada modificación registra la fecha y hora de actualización en la columna `actualizado_en = CURRENT_TIMESTAMP`.
  - **Sincronización en Tiempo Real:** Emite el evento WebSocket `patrulla:actualizada` a las salas `"encargado"`, `"supervisor"`, `"mapa"` y `"patrulla:{patrullaId}"`.

- **Body JSON:**
  ```json
  {
    "nombre": "Patrulla Costa 01 - Reforzada",
    "delegacionId": "30000000-0000-4000-8000-000000000003",
    "vehiculoId": "e1000000-0000-4000-8000-000000000005",
    "personalIds": [
      "b1000000-0000-4000-8000-000000000001",
      "b1000000-0000-4000-8000-000000000002"
    ],
    "usuarioLiderId": "c1000000-0000-4000-8000-000000000001"
  }
  ```

- **Respuesta (`200 OK`):**
  ```json
  {
    "message": "Patrulla verificadora modificada exitosamente.",
    "data": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "codigo": "PV-COSTA-01",
      "nombre": "Patrulla Costa 01 - Reforzada",
      "estado": "DISPONIBLE",
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000003",
        "nombre": "Delegación Costa",
        "codigo": "DEL_COSTA"
      },
      "vehiculo": {
        "id": "e1000000-0000-4000-8000-000000000005",
        "nombre": "Camioneta 4x4 Hilux",
        "detalles": { "patente": "GH-JK-89" },
        "estado": "ASIGNADO"
      },
      "lider": {
        "id": "c1000000-0000-4000-8000-000000000001",
        "nombre": "Juan Líder",
        "email": "juan@valdivia.cl"
      },
      "integrantes": [...],
      "misionActiva": null,
      "creadoEn": "2026-10-20T10:00:00.000Z",
      "actualizadoEn": "2026-10-26T12:00:00.000Z"
    }
  }
  ```

#### 3.8.8 Eventos en Tiempo Real (Socket.io)
Ante cambios de estado, asignación, alta o modificación de patrulla, el backend emite:
1. `patrulla:creada`:
   - **Salas destino:** `"encargado"`, `"supervisor"`, `"mapa"`, `"sala:encargados"`.
   - **Payload:** `{ patrullaId, codigo, nombre, estado, delegacionId, vehiculoId, usuarioLiderId, creadoEn }`.
2. `patrulla:actualizada`:
   - **Salas destino:** `"encargado"`, `"supervisor"`, `"mapa"`, `"patrulla:{patrullaId}"`.
   - **Payload:** `{ patrullaId, nombre, estado, delegacionId, usuarioLiderId, misionActivaId, incidenteId, actualizadoEn }`.
3. `patrulla:desactivada`:
   - **Salas destino:** `"encargado"`, `"supervisor"`, `"mapa"`, `"administrador"`, `"patrulla:{patrullaId}"`.
   - **Payload:** `{ patrullaId, nombre, eliminadoPorId, eliminadoEn }`.
4. `mision:asignada`:
   - **Salas destino:** `"encargado"`, `"supervisor"`.
   - **Payload:** `{ misionId, codigo, tipoMision, patrullaId, incidenteId, asignadoEn }`.

---

### 3.9. `DELETE /api/patrullas/{id}` (HU-85: Desactivar Patrulla Verificadora)
Desactiva mediante **baja lógica (soft delete)** una patrulla verificadora que ya no prestará servicios operacionales, impidiendo su selección en nuevos despachos mientras preserva íntegramente la auditoría de los reportes técnicos (`reporte_terreno`) y misiones tácticas en las que actuó.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` para retrocompatibilidad interna).
- **Perfiles y permisos autorizados:** Perfil `Administrador` o usuarios que cuenten con el permiso `recursos:eliminar`.

#### Reglas de Negocio Críticas Aplicadas:
1. **Validación de Bloqueo por Misiones o Verificación en Terreno (`HTTP 409 Conflict`):**
   - Si la patrulla se encuentra en estado `EN_VERIFICACION`, la baja es rechazada inmediatamente con `409 Conflict`.
   - Si la patrulla cuenta con misiones activas en curso (`PLANIFICADA`, `DESPACHADA` o `EN_CURSO`), la baja es rechazada con `409 Conflict`.
2. **Aplicación Estricta de Baja Lógica (Regla Crítica §3.7):**
   - No se realiza eliminación física (`DELETE`) en la base de datos relacional.
   - Se actualizan los atributos: `activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, `eliminado_por_id = usuarioId` y `estado = 'NO_DISPONIBLE'`.
3. **Liberación Inmediata de Inventario y Dotación Comunal:**
   - **Vehículo:** Si la patrulla tenía un vehículo institucional asignado (`vehiculo_id`), este se desasocia y en la tabla `recurso` pasa inmediatamente a `estado = 'DISPONIBLE'` y `cantidad_en_uso = 0`.
   - **Personal de Terreno:** Los funcionarios asignados a la dotación en `patrulla_personal` pasan en la tabla `personal` a `estado_operativo = 'disponible'`, quedando listos para conformar nuevas dotaciones o asignaciones.
4. **Preservación Inmutable de Evidencia e Informes Técnicos:**
   - Los registros de `reporte_terreno` vinculados a misiones históricas ejecutadas por esta patrulla no sufren ninguna alteración, garantizando trazabilidad para auditorías y fiscalizaciones comunales (SENAPRED / DGRD).
5. **Sincronización en Tiempo Real:**
   - Emite el evento `patrulla:desactivada` y `patrulla:actualizada` a las salas del Centro de Mando.
   - Si se liberó un vehículo, emite `recurso:actualizado` para refrescar los módulos de inventario en vivo.

#### Parámetros de Ruta
- `id` (`UUID`, obligatorio): Identificador único de la patrulla verificadora a desactivar.

#### Respuesta Exitosa (`HTTP 200 OK`)
```json
{
  "message": "Patrulla verificadora desactivada exitosamente.",
  "data": {
    "id": "f1000000-0000-4000-8000-000000000001",
    "codigo": "PV-COSTA-01",
    "nombre": "Patrulla Costa 01",
    "estado": "NO_DISPONIBLE",
    "activo": false,
    "eliminadoEn": "2026-10-26T15:30:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001",
    "vehiculoLiberadoId": "e1000000-0000-4000-8000-000000000002",
    "personalLiberadoIds": [
      "b1000000-0000-4000-8000-000000000001",
      "b1000000-0000-4000-8000-000000000002"
    ]
  }
}
```

---

### 3.8. `GET /api/cuadrillas` (Listado Paginado de Cuadrillas con Filtros - H81 / H79)
Retorna la nómina paginada de cuadrillas operativas municipales con sus respectivos delegados, recursos asignados y dotación de trabajadores.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` para retrocompatibilidad interna).
- **Perfiles y permisos autorizados:** Requiere permiso RBAC `recursos:leer`, `recursos:gestionar` o rol `ADMIN`.
- **Parámetros de Consulta (Query Params):**
  - `pagina` / `page` (`number`, default `1`): Número de página.
  - `limite` / `limit` (`number`, default `10`, max `100`): Cantidad de registros por página.
  - `q` / `busqueda` (`string`): Búsqueda parcial insensible a mayúsculas sobre nombre de cuadrilla, o nombre o RUT del delegado.
  - `delegacionId` (`UUID`): Filtra por delegación municipal adscrita.
  - `estado` (`string`): Filtra por estado operativo (`DISPONIBLE`, `EN_MISION`, `NO_DISPONIBLE`).

---

### 3.9. `POST /api/cuadrillas` (Alta de Cuadrilla Operativa - H79)
Permite dar de alta una nueva cuadrilla táctica municipal en estado inicial `DISPONIBLE`, adscribiéndola a una delegación base y designando a su líder delegado.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id`).
- **Perfiles y permisos autorizados:** Requiere permiso RBAC `recursos:crear` o rol `ADMIN`.
- **Reglas de Negocio:**
  - Valida nombre único insensible a mayúsculas y espacios.
  - Si el usuario seleccionado no posee el rol `DELEGADO_CUADRILLA`, lo promueve automáticamente y registra en `log_cambios_usuarios`.
  - Emite evento Socket.io `cuadrilla:creada`.

---

### 3.10. `GET /api/cuadrillas/{id}` (Detalle Unitario de Cuadrilla - H81 / H79)
Retorna el detalle completo y consolidado de una cuadrilla operativa específica por su identificador UUID.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id`).
- **Perfiles y permisos autorizados:** Requiere permiso RBAC `recursos:leer`, `recursos:gestionar` o rol `ADMIN`.
- **Respuesta:** Detalle consolidado con su delegación, delegado, lista de recursos materiales (`cuadrilla_recurso`) y trabajadores operativos (`cuadrilla_personal`).
- **Error 404:** Si la cuadrilla no existe o se encuentra eliminada lógicamente.

---

### 3.11. `PUT /api/cuadrillas/{id}` (H81: Modificar Cuadrilla Operativa y Dotación)
Permite modificar el nombre, delegación municipal adscrita, delegado responsable y ajustar los trabajadores y recursos logísticos (vehículos, herramientas, maquinarias) que conforman la dotación real de la cuadrilla ante rotaciones de turno o traslados.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` para retrocompatibilidad interna).
- **Perfiles y permisos autorizados:** Requiere permiso RBAC `recursos:editar` o rol `ADMIN`.
- **Integridad Operativa Crítica (Bloqueo `409 Conflict`):**
  - Si la cuadrilla se encuentra en estado `EN_MISION`, `EN_TRANSITO` o `EN_OPERACION`, o posee misiones asociadas en curso (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`), el backend **bloquea inmediatamente la modificación** respondiendo `HTTP 409 Conflict` con:
    ```json
    {
      "statusCode": 409,
      "error": "Conflict",
      "message": "No es posible modificar los datos ni la dotación de una cuadrilla que se encuentra actualmente en misión activa en terreno."
    }
    ```
- **Control de Unicidad de Nombre (`409 Conflict`):**
  - Si ya existe otra cuadrilla activa con el mismo nombre ingresado en la comuna:
    ```json
    {
      "statusCode": 409,
      "error": "Conflict",
      "message": "Ya existe otra cuadrilla operativa con el nombre ingresado."
    }
    ```
- **Control de Recurso Individual en Uso (`409 Conflict`):**
  - Si un recurso de tipo individual (`esIndividual: true`, ej. camioneta o camión) ya está asignado a otra cuadrilla activa:
    ```json
    {
      "statusCode": 409,
      "error": "Conflict",
      "message": "El recurso individual ya se encuentra asignado a otra cuadrilla operativa."
    }
    ```
- **Gestión Dinámica de Delegados:**
  - Si se reasigna el delegado, el nuevo usuario es promovido a `DELEGADO_CUADRILLA` si aún no lo es (con auditoría en `log_cambios_usuarios`).
  - Si el delegado anterior ya no lidera ninguna otra cuadrilla activa, su rol es revertido automáticamente al rol base operativo (`BRIGADISTA`).
- **Validación de Dotación Humana (`cuadrilla_personal`):**
  - Cada funcionario asignado debe existir, tener `usuario_activo === true`, `disponible_terreno === true` y su `estado_operativo === 'disponible'` (no se puede asignar personal con licencia o en descanso).
- **Validación de Dotación Material (`cuadrilla_recurso`):**
  - Los recursos individuales (`es_individual === true`, ej. camionetas 4x4) solo admiten cantidad 1 y no pueden estar asignados concurrentemente a otra cuadrilla activa (`409 Conflict`).
- **Auditoría:**
  - Registra automáticamente `actualizado_por_id` y `actualizado_en` (marca de tiempo actual).
- **Tiempo Real:**
  - Emite el evento WebSocket `cuadrilla:actualizada` a las salas `operaciones`, `encargado` y `supervisor`.

#### Cuerpo de la Solicitud (`PUT /api/cuadrillas/{id}`)
```json
{
  "nombre": "Cuadrilla Drenaje y Aguas Lluvias Sur",
  "delegacionId": "30000000-0000-4000-8000-000000000002",
  "usuarioDelegadoId": "00000000-0000-4000-8000-000000000012",
  "recursos": [
    {
      "recursoId": "e1000000-0000-4000-8000-000000000004",
      "cantidad": 2
    }
  ],
  "trabajadores": [
    {
      "personalId": "40000000-0000-4000-8000-000000000001"
    }
  ]
}
```

#### Ejemplo de Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Cuadrilla operativa actualizada exitosamente",
  "data": {
    "id": "50000000-0000-4000-8000-000000000003",
    "nombre": "Cuadrilla Drenaje y Aguas Lluvias Sur",
    "estado": "DISPONIBLE",
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000002",
      "nombre": "Sur",
      "codigo": "DEL_SUR"
    },
    "delegado": {
      "id": "00000000-0000-4000-8000-000000000012",
      "nombre": "Sebastián Alarcón Toledo",
      "email": "sebastian.alarcon@valdivia.cl",
      "rut": "15.987.654-2"
    },
    "recursos": [
      {
        "id": "cd300000-0000-4000-8000-000000000001",
        "recursoId": "e1000000-0000-4000-8000-000000000004",
        "nombre": "Motobomba de Achique 3\"",
        "cantidadAsignada": 2,
        "esIndividual": false
      }
    ],
    "trabajadores": [
      {
        "id": "cp300000-0000-4000-8000-000000000001",
        "personalId": "40000000-0000-4000-8000-000000000001",
        "usuarioId": "00000000-0000-4000-8000-000000000009",
        "nombre": "Pedro Obrero",
        "rut": "16.222.333-4",
        "cargo": "Motosierrista",
        "especialidad": "Poda de Altura",
        "asignadoEn": "2026-10-26T10:30:00.000Z"
      }
    ],
    "totalRecursos": 1,
    "totalTrabajadores": 1,
    "creadoEn": "2026-10-23T10:00:00.000Z",
    "actualizadoEn": "2026-10-26T10:30:00.000Z"
  }
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`200 OK`:** Solicitud procesada correctamente / Consulta, actualización o eliminación lógica realizada con éxito.
- **`201 Created`:** Recurso validado, geolocalizado e insertado exitosamente.
- **`400 Bad Request`:**
  - Parámetros de consulta o cuerpo JSON inválidos según esquema Zod (ej. `nombre` menor a 3 caracteres, cantidad negativa).
  - Intento de reducir la cantidad de inventario por debajo de las unidades actualmente en uso en terreno (`cantidadInventario < cantidadEnUso`).
  - Intento de asignar estado de mantenimiento (`enMantencion: true`) a un recurso o material a granel (`esIndividual === false`).
  - Identificadores de rol/delegación inexistentes o inválidos.
  - Funcionarios asignados a patrulla sin rol operativo `PATRULLA_VERIFICADORA`.
- **`401 Unauthorized`:** Cabecera `X-User-Id` (o `Authorization: Bearer`) ausente, vacía o usuario no autenticado.
- **`403 Forbidden`:** Usuario no cuenta con permisos suficientes (requiere rol Administrador o permiso explícito como `recursos:editar`).
- **`404 Not Found`:** Recurso, patrulla o empleado no encontrado en el sistema, o recurso ya dado de baja previamente.
- **`409 Conflict`:**
  - El recurso no se puede eliminar porque actualmente tiene unidades en uso en terreno o se encuentra asignado a cuadrillas en misión activa.
  - La patrulla verificadora no se puede modificar o desactivar porque se encuentra en estado `EN_VERIFICACION` o con una misión táctica activa en curso (HU-84 / HU-85).
  - El vehículo institucional a asignar ya se encuentra en uso o asignado a otra dotación activa.
  - Código identificador de patrulla ya registrado en otra patrulla activa.
  - Correo electrónico o RUT duplicado en otro usuario.
- **`422 Unprocessable Entity`:** Formato o tipo de datos inválido según validación Zod.
- **`500 Internal Server Error`:** Falla de conexión a base de datos PostgreSQL o error de servidor no controlado.

