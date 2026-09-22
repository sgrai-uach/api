# Módulo de Seguridad, Roles y Permisos — Documentación Técnica

## 1. Contexto y Responsabilidad
El módulo **Seguridad** centraliza la autenticación, perfiles de usuario, roles y permisos granulares en el SGRAI.

- **Usuarios como Empleados Generales:** La tabla `usuarios` representa las cuentas de todos los trabajadores y operadores del sistema (Administrador, Encargado del Centro de Mando, Supervisor Estratégico, Operador de Call Center, Asistente Social y Personal Operativo).
- **Roles:** Cada usuario posee un rol institucional asignado en `roles` que determina sus atribuciones en la plataforma.
- **Permisos Granulares:** Las tablas `permisos` y `rol_permisos` permiten definir qué acciones puede realizar cada perfil (ej: `incidentes:crear`, `misiones:asignar`, `usuarios:administrar`).

---

## 2. Modelo de Datos Relacional

### 2.1 Tabla `roles`
| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, default `uuid_generate_v4()` | Identificador único del rol |
| `codigo` | `VARCHAR(50)` | `UNIQUE NOT NULL` | Código identificador (ej: `ADMIN`, `ENCARGADO`, `CALL_CENTER`) |
| `nombre` | `VARCHAR(100)` | `NOT NULL` | Nombre descriptivo del rol |
| `descripcion` | `TEXT` | `NULL` | Detalle del alcance del rol |
| `activo` | `BOOLEAN` | `DEFAULT TRUE NOT NULL` | Indicador de rol activo |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de última modificación |

### 2.2 Tabla `usuarios`
| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, default `uuid_generate_v4()` | Identificador de usuario |
| `rut` | `VARCHAR(20)` | `UNIQUE NOT NULL` | RUT del funcionario |
| `nombres` | `VARCHAR(100)` | `NOT NULL` | Nombres del empleado |
| `apellidos` | `VARCHAR(100)` | `NOT NULL` | Apellidos del empleado |
| `email` | `VARCHAR(150)` | `UNIQUE NOT NULL` | Correo electrónico corporativo |
| `telefono` | `VARCHAR(50)` | `NULL` | Teléfono de contacto |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Hash de la contraseña |
| `rol_id` | `UUID` | `NOT NULL`, FK -> `roles(id)` | Rol asignado al usuario |
| `delegacion_id` | `UUID` | `NULL`, FK -> `delegaciones(id)` | Delegación asignada |
| `activo` | `BOOLEAN` | `DEFAULT TRUE NOT NULL` | Si el usuario puede ingresar al sistema |
| `ultimo_acceso` | `TIMESTAMPTZ` | `NULL` | Fecha/hora del último login |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de última modificación |

### 2.3 Tablas `permisos` y `rol_permisos`
Permite relacionar roles con permisos específicos en una matriz N:M:
- `permisos`: `(id, codigo, modulo, descripcion, created_at)`
- `rol_permisos`: `(rol_id, permiso_id, created_at)` con clave primaria compuesta `(rol_id, permiso_id)`.

---

## 3. Roles Base del Sistema

| Código Rol | Nombre | Ámbito de Acción |
|---|---|---|
| `ADMIN` | Administrador | Gestión de configuración, usuarios, delegaciones y perfiles |
| `ENCARGADO` | Encargado Centro de Mando | Gestión operativa de incidentes, despacho de misiones y cuadrillas |
| `SUPERVISOR` | Supervisor Estratégico | Visualización analítica, tableros, reportes SENAPRED (Alfa 37G) |
| `CALL_CENTER` | Operador Call Center | Recepción telefónica y verificación de avisos ciudadanos |
| `ASISTENTE_SOCIAL` | Asistente Social | Atención de vulnerabilidad social y levantamiento de ficha FIBE |
| `PATRULLA_VERIFICADORA`| Patrulla Verificadora | Personal de terreno asignado a verificar incidentes reportados vía PWA |
| `DELEGADO_CUADRILLA` | Delegado de Cuadrilla | Jefe operativo en terreno que coordina la cuadrilla y misión |
| `BRIGADISTA` | Personal Operativo Terreno | Miembro ejecutor de cuadrilla en labores en terreno |
