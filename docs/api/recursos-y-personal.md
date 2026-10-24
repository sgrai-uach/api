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
- **Todos los involucrados son empleados/usuarios:** La entidad `usuarios` modela a cualquier funcionario del sistema (Administrador, Encargado, Supervisor, Call Center, Asistente Social, Personal Operativo). A cada usuario se le asocia un rol con permisos específicos.
- **Personal como especialización operativa para terreno:** La entidad `personal` representa a los usuarios habilitados para labores de campo (patrullas de verificación rápida, miembros de cuadrillas, delegados de cuadrilla y operadores de maquinaria/herramientas). Cuenta con atributos de estado operativo en tiempo real (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`) y coordenadas geográficas (`ultima_ubicacion` PostGIS).
- **Trazabilidad de Auditoría:** Toda modificación a perfiles y atributos de personal registra un evento inmutable en `log_cambios_usuarios` con el usuario responsable (`x-user-id`) y el diff de campos alterados en JSONB.

### 1.3 Gestión de Cuadrillas Operativas (ICS Sección de Operaciones - H79)
- **Unidad Táctica de Intervención Pesada:** Las cuadrillas representan brigadas municipales desplegables para mitigación, despeje y atención de emergencias.
- **Estructura Base Obligatoria:** Toda cuadrilla debe contar con:
  - Un **nombre identificador único** a nivel comunal (case-insensitive y normalizado con `trim()`).
  - Una **delegación municipal base** activa (`delegacion_id`), que determina su adscripción territorial.
  - Un **delegado responsable** (`usuario_delegado_id`), quien actúa como enlace con el Encargado de Operaciones y recibe las misiones en la aplicación móvil (PWA).
- **Promoción Dinámica de Delegados:** Si el usuario seleccionado no posee previamente el rol `DELEGADO_CUADRILLA`, el backend promueve automáticamente su perfil a dicho rol dentro de una transacción atómica y registra el evento en `log_cambios_usuarios`.
- **Estado Inicial Operativo:** Toda nueva cuadrilla nace con el estado `DISPONIBLE`, indicando que está lista para ser despachada a misiones tácticas en terreno.
- **Sincronización en Tiempo Real:** El alta de la cuadrilla emite el evento WebSocket `cuadrilla:creada` a las salas `operaciones`, `encargado` y `supervisor`.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/recursos` | Listar los recursos del inventario logístico con paginación, filtros territoriales/disponibilidad y delegación. |
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock, geolocalización y atributos técnicos. |
| `GET` | `/api/recursos/{id}` | Obtener detalle completo de un recurso para precargar el formulario de edición. |
| `PUT` | `/api/recursos/{id}` | Modificar características, inventario físico, especificaciones técnicas y estado de un recurso. |
| `DELETE` | `/api/recursos/{id}` | Eliminar un recurso del inventario mediante borrado lógico (soft delete) y trazabilidad completa. |
| `POST` | `/api/cuadrillas` | Registrar una nueva cuadrilla operativa en el sistema indicando nombre, delegación y delegado (H79). |
| `GET` | `/api/personal` | Listar y buscar empleados/usuarios para selectores con soporte de búsqueda textual y filtro de activos/terreno. |
| `POST` | `/api/personal` | Registrar a un nuevo funcionario municipal con credenciales y ficha de terreno condicional (HU-10). |
| `PATCH` | `/api/personal/:id` | Modificar datos de un empleado actualizando concurrentemente `usuarios` y `personal` en una transacción atómica. |
| `DELETE` | `/api/personal/:id` | Dar de baja lógica a un funcionario preservando trazabilidad histórica (H13). |
| `GET` | `/api/catalogos` | Entregar catálogos de referencia (roles, delegaciones activas, especialidades y cargos) para selectores. |


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

### 3.3. `GET /api/personal` (H34, H26: Listado de Personal, Asistentes Sociales y Casos FIBE)
Lista y busca empleados/usuarios para los selectores del frontend, tablas de administración y la gestión operativa del Encargado (incluyendo la nómina de Asistentes Sociales para el levantamiento de fichas FIBE - HU-26), con paginación estándar transversal SGRAI y soporte multicriterio.
- `page` / `pagina` (`number`, default `1`): Número de página (inicia en 1).
- `limit` / `limite` (`number`, default `20`, máx `100`): Cantidad de registros por página.
- `rolCodigo` / `rol_codigo` (`string`, opcional): Filtro por código canónico de rol institucional (ej. `ASISTENTE_SOCIAL`).
- `delegacionId` / `delegacion_id` (`UUID`): Filtro por delegación territorial.
- `rolId` / `rol_id` (`UUID`): Filtro por rol institucional.
- `estadoOperativo` / `estado_operativo`: Filtro por estado operativo (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`).
- `cargo` (`string`): Filtro por cargo funcional (búsqueda parcial `ILIKE`).
- `especialidad` (`string`): Filtro por especialidad técnica (búsqueda parcial `ILIKE`).
- `soloPersonal` / `solo_personal` (`boolean`): `true` para restringir solo a personal con ficha operativa de terreno.
- `busqueda` / `q` (`string`): Búsqueda textual insensible a mayúsculas sobre RUT, nombres, apellidos o email.
- `incluir_inactivos` / `incluirInactivos` (`boolean`, default `false`): Por omisión (`false`), solo se devuelven funcionarios activos (`activo = true`). Si es `true`, incluye también funcionarios dados de baja.
- `estado` (`string`): `'activo'` | `'inactivo'` | `'todos'`. Permite filtrar funcionarios por estado laboral.
- `ordenarPor` / `ordenar_por`: `apellidos` (default) | `nombres` | `rut`.
- `orden`: `asc` (default) | `desc`.

#### Reglas de Negocio y Seguridad RBAC (HU-26)
- **Cómputo de Casos FIBE Asignados:** Cada registro retornado incluye `casos_fibe_asignados` (entero no negativo). Para asistentes sociales, calcula en tiempo real mediante subconsulta optimizada los eventos de asistencia social (`evento_asistencia_social`) en estados `'ASIGNADO'` o `'EN_EVALUACION_FIBE'` que no han sido dados de baja (`eliminado_en IS NULL`).
- **Control de Acceso RBAC:** Si la consulta solicita la nómina de asistentes sociales (`rolCodigo=ASISTENTE_SOCIAL`), el endpoint exige autenticación obligatoria y posesión del permiso `asistencia_social:leer` (asignado a los roles Encargado, Administrador y Asistente Social). Si la llamada carece de sesión responde `HTTP 401 Unauthorized`, y si el perfil no posee el permiso responde `HTTP 403 Forbidden`. Las consultas genéricas de personal para selectores continúan operando de forma abierta.

**Respuesta:** Retorna `{ data: PersonalItem[], meta: PaginationMeta }` con el arreglo de funcionarios y el objeto `meta` de paginación. Cada ítem incluye el campo `casos_fibe_asignados: number`.

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

### 3.8. `POST /api/cuadrillas` (H79: Registrar Cuadrilla Operativa)
Permite al Administrador registrar una nueva cuadrilla operativa en el sistema indicando su nombre, delegación municipal base y asignando al delegado responsable.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` para retrocompatibilidad interna).
- **Perfiles autorizados:** `Administrador` o cualquier usuario con permiso `recursos:crear`.

#### Reglas de Negocio
1. **Unicidad de Nombre:** El nombre de la cuadrilla debe ser único a nivel comunal (insensible a mayúsculas/minúsculas y espacios superfluos). Si ya existe una cuadrilla activa con el mismo nombre, el endpoint rechaza con **`409 Conflict`**.
2. **Validación Territorial y de Personal:**
   - La delegación municipal (`delegacionId`) debe existir y estar activa (`activo = true`).
   - El usuario designado como delegado (`usuarioDelegadoId`) debe existir y estar activo en el sistema.
3. **Promoción Atómica de Delegado:** Si el usuario seleccionado no posee el rol `DELEGADO_CUADRILLA`, el sistema actualiza su `rol_id` de forma atómica en la transacción y deja registro de auditoría en `log_cambios_usuarios`.
4. **Estado Inicial:** Toda cuadrilla se crea con estado `DISPONIBLE`.
5. **Sincronización WebSocket:** Al completarse la inserción, emite el evento `"cuadrilla:creada"` con los datos de la cuadrilla, delegado y delegación hacia las salas `operaciones`, `encargado` y `supervisor`.

#### Cuerpo de la Solicitud (`POST` Body)
```json
{
  "nombre": "Cuadrilla Vías y Calles",
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "usuarioDelegadoId": "00000000-0000-4000-8000-000000000005"
}
```

#### Ejemplo de Respuesta Exitosa (`201 Created`)
```json
{
  "message": "Cuadrilla operativa creada exitosamente",
  "data": {
    "id": "50000000-0000-4000-8000-000000000001",
    "nombre": "Cuadrilla Vías y Calles",
    "estado": "DISPONIBLE",
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "nombre": "Delegación Municipal Calle Calle"
    },
    "delegado": {
      "id": "00000000-0000-4000-8000-000000000005",
      "nombre": "Carlos Operativo",
      "email": "carlos@valdivia.cl",
      "rut": "15.123.456-7"
    },
    "creadoEn": "2026-10-24T12:00:00.000Z",
    "creadoPorId": "00000000-0000-4000-8000-000000000001"
  }
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`200 OK`:** Solicitud procesada correctamente / Consulta, actualización o eliminación lógica realizada con éxito.
- **`201 Created`:** Recurso o cuadrilla operativa validada e insertada exitosamente en estado inicial `DISPONIBLE`.
- **`400 Bad Request`:**
  - Parámetros de consulta o cuerpo JSON inválidos según esquema Zod (ej. `nombre` menor a 3 caracteres, cantidad negativa).
  - Intento de reducir la cantidad de inventario por debajo de las unidades actualmente en uso en terreno (`cantidadInventario < cantidadEnUso`).
  - Intento de asignar estado de mantenimiento (`enMantencion: true`) a un recurso o material a granel (`esIndividual === false`).
  - Delegación municipal base o usuario delegado inactivo en el sistema.
  - Identificadores de rol/delegación inexistentes o inválidos.
- **`401 Unauthorized`:** Cabecera `X-User-Id` (o `Authorization: Bearer`) ausente, vacía o usuario no autenticado.
- **`403 Forbidden`:** Usuario no cuenta con permisos suficientes (requiere rol Administrador o permiso `recursos:crear`).
- **`404 Not Found`:** Recurso, delegación municipal o usuario delegado no encontrado en el sistema.
- **`409 Conflict`:**
  - Ya existe una cuadrilla operativa activa con el nombre ingresado (insensible a mayúsculas/minúsculas).
  - El recurso no se puede eliminar porque actualmente tiene unidades en uso en terreno o se encuentra asignado a cuadrillas en misión activa.
  - Correo electrónico o RUT duplicado en otro usuario.
- **`422 Unprocessable Entity`:** Formato o tipo de datos inválido según validación Zod.
- **`500 Internal Server Error`:** Falla de conexión a base de datos PostgreSQL o error de servidor no controlado.

