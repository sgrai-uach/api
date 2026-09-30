# Módulo de Seguridad, Roles y Permisos — Documentación Técnica de API

Este documento describe la operativa técnica del módulo de **Seguridad y Control de Acceso (RBAC)** en `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Administración) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Seguridad** centraliza la autenticación, perfiles de usuario, roles y permisos granulares en el SGRAI:

1. **Control de Acceso Basado en Roles (RBAC):**
   - La visualización y gestión de la matriz de perfiles y permisos está restringida **exclusiva y estrictamente a usuarios con perfil `'Administrador'`** activo.
   - Cualquier invocación sin credenciales válidas o proveniente de otro rol (`Call Center`, `Encargado`, `Patrulla Verificadora`, etc.) es rechazada inmediatamente con `403 Forbidden`.
2. **Catálogo Completo de Permisos (HU-5):**
   - El endpoint `GET /api/seguridad/permisos` expone el universo total de permisos disponibles en la base de datos, clasificados por módulo funcional (`modulo`, `nombre`, `codigo`, `descripcion`).
3. **Mutación Masiva Atómica y Transaccionalidad Estricta (HU-5):**
   - La asignación y revocación de permisos (`PUT /api/seguridad/roles/{id}/permisos`) se ejecuta dentro de una transacción en PostgreSQL utilizando Kysely (`db.transaction().execute(...)`).
   - Aplica un reemplazo diferencial asegurando que si falla cualquier validación o inserción se ejecute un **rollback total** que garantice la consistencia del estado.
4. **Trazabilidad y Auditoría Continua:**
   - Cada nueva relación en `rol_permiso` persiste la marca temporal `asignado_en = CURRENT_TIMESTAMP` y el identificador `asignado_por_id = <UUID del Administrador>` extraído de la cabecera `X-User-Id`.
   - Se actualiza automáticamente el campo `actualizado_en` en la tabla `rol`.
   - Los usuarios y roles poseen banderas de estado `activo` para evitar el acceso de funcionarios inactivos o perfiles deshabilitados.
   - El flag `es_sistema` protege perfiles base institucionales contra eliminaciones accidentales.
5. **Protección contra Auto-bloqueo (Regla de Dominio Crítica - HU-5):**
   - Si se están modificando los permisos del rol `Administrador`, el sistema **impide categóricamente** la revocación del permiso crítico `seguridad:roles:gestionar`.
   - Si el payload no incluye el ID o código de dicho permiso, la API rechaza la solicitud con `400 Bad Request` indicando que dicho permiso es indispensable para la gobernanza del sistema.
6. **Perfiles sin permisos asignados:**
   - Si un perfil no cuenta con permisos registrados en la base de datos (ej. perfiles de prueba o de acceso restringido), la API retorna explícitamente `cantidadPermisos: 0` y `permisos: []` para que `sgrai-web` despliegue el mensaje *"Sin permisos asignados"*.
7. **Rendimiento y Latencia:**
   - La consulta de perfiles y permisos se realiza mediante consultas optimizadas e índices dedicados, asegurando tiempos de respuesta inferiores a **1.5 segundos**.

---

## 2. Roles Base del Sistema

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

---

## 3. Endpoints del Módulo

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/api/seguridad/roles` | Listar todos los perfiles registrados con sus permisos asignados y metadatos de auditoría. |
| `GET` | `/api/seguridad/roles/{id}` | Obtener el detalle interactivo de un rol específico con la lista completa de sus acciones autorizadas. |
| `GET` | `/api/seguridad/permisos` | Listar el catálogo completo de permisos disponibles clasificados por módulo funcional. |
| `PUT` | `/api/seguridad/roles/{id}/permisos` | Actualizar atómica y masivamente los permisos asociados a un rol específico (`{ "permisoIds": string[] }`). |
| `GET` | `/api/seguridad/usuario-activo` | Obtener datos del usuario autenticado, su rol y la lista de todos sus permisos dinámicos en tiempo real (HU-5). |

> Nota: La especificación completa de contratos OpenAPI y los tipos de request/response se generan automáticamente desde los esquemas Zod en `GET /openapi.json`.

---

## 4. Códigos de Error Esperables no Obvios

- **`400 Bad Request` en `PUT /api/seguridad/roles/{id}/permisos`**:
  - El cuerpo de la solicitud no es un JSON válido o no cumple con el esquema `{ "permisoIds": string[] }` (UUIDs RFC 4122 válidos).
  - Intento de revocar el permiso crítico `seguridad:roles:gestionar` al perfil `'Administrador'`.
  - Uno o más UUIDs en `permisoIds` no existen en la tabla `permiso`.
- **`401 Unauthorized` en cualquier endpoint del módulo**:
  - Falta la cabecera `X-User-Id` (o `Authorization: Bearer <usuario_id>`).
  - El usuario indicado en la cabecera no existe en la tabla `usuario`.
  - El usuario existe pero tiene `activo = false` (funcionario inactivo o dado de baja).
- **`403 Forbidden` en endpoints de administración de roles**:
  - El usuario está autenticado y activo, pero su perfil asignado **no es `'Administrador'`** (ej. operador de Call Center o Patrulla Verificadora).
- **`403 Forbidden` en `GET /api/seguridad/usuario-activo`**:
  - El usuario autenticado se encuentra inactivo en la institución (`activo = false`).
- **`404 Not Found` en `/api/seguridad/roles/{id}` y `/api/seguridad/roles/{id}/permisos`**:
  - El `UUID` provisto en la ruta no corresponde a ningún perfil registrado en la tabla `rol`.

---

## 5. Trazabilidad con Frontends

- **`sgrai-web`**:
  - Consume `GET /api/seguridad/roles` para la tabla principal de perfiles.
  - Consume `GET /api/seguridad/permisos` para popular el catálogo interactivo de permisos por módulo.
  - Consume `PUT /api/seguridad/roles/{id}/permisos` para guardar los cambios de asignación y revocación desde la vista de edición de permisos.
  - Consume `GET /api/seguridad/usuario-activo` para inicializar y sincronizar el estado global de permisos en sesión del usuario en tiempo real.
- **`sgrai-pwa`**:
  - Consume `GET /api/seguridad/usuario-activo` para resolver los accesos operativos del usuario autenticado en terreno (Patrulla Verificadora, Delegado de Cuadrilla).
- **Contrato de tipos**: Los frontends ejecutan `openapi-typescript` contra `GET /openapi.json` para derivar automáticamente las interfaces TypeScript sin redactarlas a mano.
