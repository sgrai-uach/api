# Módulo de Seguridad, Roles y Permisos — Documentación Técnica de API

Este documento describe la operativa técnica del módulo de **Seguridad y Control de Acceso (RBAC)** en `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Administración) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Seguridad** centraliza la autenticación, perfiles de usuario, roles y permisos granulares en el SGRAI:

1. **Control de Acceso Basado en Roles (RBAC):**
   - La visualización y gestión de la matriz de perfiles y permisos está restringida **exclusiva y estrictamente a usuarios con perfil `'Administrador'`**.
   - Cualquier invocación sin credenciales válidas o proveniente de otro rol (`Call Center`, `Encargado`, `Patrulla Verificadora`, etc.) es rechazada inmediatamente con `403 Forbidden`.
2. **Perfiles sin permisos asignados:**
   - Si un perfil no cuenta con permisos registrados en la base de datos (ej. perfiles de prueba o de acceso restringido), la API retorna explícitamente `cantidadPermisos: 0` y `permisos: []` para que `sgrai-web` despliegue el mensaje *"Sin permisos asignados"*.
3. **Auditoría de Asignaciones y Actividad:**
   - Cada relación entre rol y permiso registra la marca temporal `asignado_en` y el identificador `asignado_por_id` del administrador responsable.
   - Los usuarios y roles poseen banderas de estado `activo` para evitar el acceso de funcionarios inactivos o perfiles deshabilitados.
   - El flag `es_sistema` protege perfiles base institucionales contra eliminaciones accidentales.
4. **Clasificación Funcional por Módulo:**
   - Cada permiso pertenece a un `modulo` operativo (`'Seguridad'`, `'Incidentes'`, `'Recursos y Personal'`, `'Misiones'`, `'Eventos ATP'`), permitiendo a `sgrai-web` presentar tablas o tarjetas agrupadas de manera intuitiva para las historias H4 y H5.
5. **Rendimiento y Latencia:**
   - La consulta de perfiles se realiza en una única operación agrupada mediante `LEFT JOIN` e índices dedicados, asegurando tiempos de respuesta inferiores a **1.5 segundos**.

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

> Nota: La especificación completa de contratos OpenAPI y los tipos de request/response se generan automáticamente desde los esquemas Zod en `GET /openapi.json`.

---

## 4. Códigos de Error Esperables no Obvios

- **`401 Unauthorized` en `GET /api/seguridad/roles` o `/api/seguridad/roles/{id}`**:
  - Falta la cabecera `X-User-Id` (o `Authorization: Bearer <usuario_id>`).
  - El usuario indicado en la cabecera no existe en la tabla `usuario`.
  - El usuario existe pero tiene `activo = false` (funcionario inactivo o dado de baja).
- **`403 Forbidden` en `GET /api/seguridad/roles` o `/api/seguridad/roles/{id}`**:
  - El usuario está autenticado y activo, pero su perfil asignado **no es `'Administrador'`** (ej. operador de Call Center intentando inspeccionar la configuración de seguridad).
- **`404 Not Found` en `GET /api/seguridad/roles/{id}`**:
  - El `UUID` provisto en la ruta no corresponde a ningún perfil registrado en la tabla `rol`.

---

## 5. Trazabilidad con Frontends

- **`sgrai-web`**: Consume `GET /api/seguridad/roles` para renderizar la grilla/tabla de roles en el panel de Administración, y utiliza `GET /api/seguridad/roles/{id}` para vistas de detalle o paneles laterales expansibles.
- **Contrato de tipos**: Los frontends ejecutan `openapi-typescript` o equivalente contra `GET /openapi.json` para derivar automáticamente las interfaces TypeScript sin redactarlas a mano.
