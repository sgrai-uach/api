# Módulo de Seguridad, Autenticación, Roles y Permisos — Documentación Técnica de API

Este documento describe la operativa técnica del módulo de **Seguridad, Autenticación (H59) y Control de Acceso (RBAC - HU-4 / HU-5)** en `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz de Administración y Login) y `sgrai-pwa`.

---

## 1. Contexto y Reglas de Negocio Aplicadas

El módulo **Seguridad** centraliza la autenticación formal de funcionarios, emisión de sesiones JWT stateless, perfiles de usuario, roles y permisos granulares en el SGRAI:

1. **Autenticación Unificada y Sesiones Stateless (H59):**
   - El endpoint `POST /api/seguridad/login` es la puerta de entrada oficial al sistema.
   - Toda la API utiliza estrictamente la cabecera estándar `Authorization: Bearer <token_jwt>`. La cabecera transitoria legacy `X-User-Id` y el paso de UUIDs planos en Bearer han sido **completamente eliminados**.
   - El token es un JSON Web Token (JWT) autocontenido y firmado criptográficamente (algoritmo HMAC-SHA256 / `HS256`) con una clave secreta institucional (`JWT_SECRET`) y vigencia definida (`JWT_EXPIRES_IN`, por defecto 8 horas correspondientes a un turno operativo).
2. **Validación Criptográfica y Contraseña Estándar:**
   - La contraseña se valida contra el hash seguro almacenado (`usuario.password_hash`) utilizando el algoritmo **bcrypt** con factor de costo 10.
   - En entornos de desarrollo y pruebas, todos los usuarios semilla institucionales cuentan con la contraseña estándar **`Valdivia2026!`**.
3. **Normalización Inteligente de Identificadores:**
   - Admite inicio de sesión con correo corporativo (`@valdivia.cl`, sensible a minúsculas) o RUT chileno con guion y dígito verificador.
   - El backend normaliza el RUT entrante (removiendo puntos y espacios, y estandarizando la letra 'K' a mayúsculas: ej. `11.111.111-1` o `11111111-k` &rarr; `11111111-K`).
4. **Protección Contra Ataques de Fuerza Bruta y Bloqueo en Base de Datos (H59):**
   - La tabla `usuario` gestiona de forma atómica los campos `intentos_fallidos` (INTEGER) y `bloqueado_hasta` (TIMESTAMPTZ).
   - Cada ingreso fallido incrementa `intentos_fallidos`. Al alcanzar **5 intentos fallidos consecutivos** (`AUTH_MAX_FAILED_ATTEMPTS`), la cuenta se bloquea automáticamente por **15 minutos** (`AUTH_LOCKOUT_MINUTES`), fijando la marca `bloqueado_hasta`.
   - Cualquier intento de acceso durante el bloqueo es rechazado con `403 Forbidden`.
   - Una vez transcurridos los 15 minutos, el sistema desbloquea automáticamente la cuenta en el siguiente intento, permitiendo el ingreso si las credenciales son correctas.
5. **Mitigación de Enumeración de Cuentas:**
   - Ante identificadores no registrados o contraseñas inválidas, la API responde uniformemente con `401 Unauthorized` y el mensaje genérico: *"Credenciales inválidas. Verifique su identificador o contraseña."*
6. **Validación de Cuenta Activa y Auditoría de Acceso:**
   - Si las credenciales coinciden pero `usuario.activo = false`, se impide el acceso con `403 Forbidden` (*"Su cuenta se encuentra deshabilitada. Contacte al Administrador."*).
   - Tras un inicio de sesión exitoso, se ejecutan en persistencia:
     - `intentos_fallidos = 0`
     - `bloqueado_hasta = NULL`
     - `ultimo_acceso = CURRENT_TIMESTAMP`
7. **Control de Acceso Basado en Roles (RBAC - HU-4 / HU-5):**
   - La gestión y visualización de la matriz de perfiles y permisos está restringida **exclusiva y estrictamente a usuarios con perfil `'Administrador'`** activo.
   - Cualquier invocación sin token válido o proveniente de otro rol (`Call Center`, `Encargado`, `Patrulla Verificadora`, etc.) es rechazada con `401 Unauthorized` o `403 Forbidden`.
8. **Protección contra Auto-bloqueo (HU-5):**
   - Si se modifican los permisos del perfil `Administrador`, el sistema impide categóricamente la revocación del permiso crítico `seguridad:roles:gestionar` con `400 Bad Request`.

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

| Método | Ruta | Propósito | Autenticación Requerida |
|---|---|---|---|
| `POST` | `/api/seguridad/login` | Iniciar sesión institucional mediante correo o RUT y contraseña. Retorna JWT y perfil. | **Pública** |
| `POST` | `/api/seguridad/recuperar-contrasena` | Solicitar restablecimiento de contraseña mediante correo o RUT. Responde 200 OK genérico anti-enumeración. | **Pública** |
| `POST` | `/api/seguridad/restablecer-contrasena` | Restablecer contraseña con token efímero, invalidándolo y desbloqueando la cuenta atómicamente. | **Pública** |
| `GET` | `/api/seguridad/usuario-activo` | Obtener datos del usuario autenticado, su rol y la lista de todos sus permisos dinámicos en tiempo real. | `Bearer <JWT>` |
| `GET` | `/api/seguridad/roles` | Listar todos los perfiles registrados con sus permisos asignados y metadatos de auditoría. | `Bearer <JWT>` (Admin) |
| `GET` | `/api/seguridad/roles/{id}` | Obtener el detalle interactivo de un rol específico con la lista completa de sus acciones autorizadas. | `Bearer <JWT>` (Admin) |
| `GET` | `/api/seguridad/permisos` | Listar el catálogo completo de permisos disponibles clasificados por módulo funcional. | `Bearer <JWT>` (Admin) |
| `PUT` | `/api/seguridad/roles/{id}/permisos` | Actualizar atómica y masivamente los permisos asociados a un rol específico (`{ "permisoIds": string[] }`). | `Bearer <JWT>` (Admin) |

> Nota: La especificación técnica OpenAPI 3.0 completa y los tipos se generan automáticamente desde los esquemas Zod en `GET /openapi.json`.

---

## 4. Contrato de Entrada y Salida: `POST /api/seguridad/login`

### Request Body (`LoginRequest`)
```json
{
  "identificador": "admin@valdivia.cl",
  "password": "Valdivia2026!"
}
```
*(También admite `"identificador": "11.111.111-1"` o `"11111111-1"`)*.

### Response `200 OK` (`LoginResponse`)
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tipoToken": "Bearer",
    "expiraEn": "2026-10-01T04:28:18.000Z",
    "usuario": {
      "id": "00000000-0000-4000-8000-000000000001",
      "rut": "11111111-1",
      "nombre": "Administrador General",
      "email": "admin@valdivia.cl",
      "rolId": "20000000-0000-4000-8000-000000000001",
      "rolNombre": "Administrador",
      "rolCodigo": "ADMIN",
      "delegacionId": "30000000-0000-4000-8000-000000000001",
      "permisos": [
        "seguridad:roles:leer",
        "seguridad:roles:gestionar",
        "recursos:crear",
        "crear_incidente_manual",
        "incidentes:avisos:leer",
        "incidentes:avisos:verificar",
        "incidentes:avisos:descartar",
        "misiones:asignar",
        "eventos_atp:crear",
        "recursos:leer",
        "incidentes:kanban"
      ]
    }
  }
}
```

### Claims del Token JWT (`payload`)
El token generado contiene en su cuerpo los claims esenciales para inspección segura o decodificación en frontends:
* `sub`: UUID del usuario (`usuario.id`).
* `rut`: RUT del funcionario.
* `email`: Correo.
* `rolId`: UUID del rol asignado.
* `rolCodigo`: Código canónico (`ADMIN`, `CALL_CENTER`, etc.).
* `rolNombre`: Nombre legible del perfil.
* `delegacionId`: UUID de la delegación (o `null`).
* `iat`: Marca Unix de emisión.
* `exp`: Marca Unix de expiración.

---

## 5. Protocolo de Recuperación y Restablecimiento Seguro de Contraseñas (HU-65)

### 5.1 Flujo Anti-Enumeración (`POST /api/seguridad/recuperar-contrasena`)
* **Propósito:** Permite a cualquier funcionario solicitar el restablecimiento autónomo de sus credenciales ingresando su correo `@valdivia.cl` o RUT chileno.
* **Protección Anti-Enumeración:** Para impedir que un atacante determine qué usuarios o correos existen en el sistema, el endpoint responde **siempre `200 OK` con el mensaje genérico:**
  ```json
  {
    "message": "Si el identificador corresponde a una cuenta registrada, se enviará un enlace de recuperación."
  }
  ```
  La respuesta es idéntica byte a byte independientemente de si la cuenta existe, no existe o está inactiva.
* **Tokens Criptográficos Efímeros:** Si la cuenta existe y está activa (`activo = true`), el sistema genera un token seguro de 32 bytes (256 bits de entropía en codificación `base64url`). En la base de datos se almacena **exclusivamente el hash SHA-256** (`token_hash`), nunca el token en claro.
* **Vigencia y Unicidad:** Cada token tiene una vigencia máxima configurable de **30 minutos** (`PASSWORD_RESET_TOKEN_TTL_MINUTES`). Al solicitar un nuevo token, cualquier token previo activo del usuario queda invalidado atómicamente (`usado_en = CURRENT_TIMESTAMP`).
* **Control de Tasa (Rate Limiting):** Para prevenir spam y ataques de saturación, se limita a un máximo de **3 solicitudes por usuario cada 15 minutos**. Al superarse, se retorna el mismo mensaje genérico `200 OK`, pero se omite la emisión de un nuevo token y el despacho del correo.
* **Despacho Asíncrono de Correo:** El enlace se envía en segundo plano mediante `EmailSender` (transporte configurable vía `MAIL_TRANSPORT`: consola en desarrollo local, Mailpit en staging y SMTP corporativo en producción), evitando demoras de red que permitan ataques de canal lateral por análisis de tiempo (timing attacks).

### 5.2 Restablecimiento Atómico y Desbloqueo (`POST /api/seguridad/restablecer-contrasena`)
* **Propósito:** Consumir el token recibido por correo para actualizar la contraseña del usuario.
* **Validación de Token:** El token en texto plano enviado por el usuario es hasheado con SHA-256 y contrastado con la tabla `token_recuperacion_contrasena`. Debe existir, tener `usado_en IS NULL`, no haber expirado (`expira_en > NOW()`) y el usuario debe encontrarse activo.
* **Políticas de Contraseña:**
  - Longitud entre 8 y 72 caracteres (límite superior impuesto por el algoritmo bcrypt).
  - Al menos una letra mayúscula, una letra minúscula y un número.
  - La nueva contraseña debe ser distinta a la contraseña actual registrada en el sistema.
* **Desbloqueo Atómico y Sinergia con H59:**
  - La nueva contraseña se almacena con hash `bcrypt` (factor de costo 10).
  - En la misma transacción relacional, se reinician atómicamente los contadores de penalización por fuerza bruta:
    `intentos_fallidos = 0`, `bloqueado_hasta = NULL`.
    De este modo, si la cuenta se encontraba bloqueada temporalmente por reintentos fallidos (H59), el restablecimiento exitoso la desbloquea de inmediato.
  - El token queda marcado como consumido (`usado_en = CURRENT_TIMESTAMP`), impidiendo cualquier reutilización.
  - Se genera un registro inmutable en `log_cambios_usuarios` para trazabilidad institucional.

---

## 6. Códigos de Error Esperables no Obvios

- **`400 Bad Request` en `POST /api/seguridad/recuperar-contrasena`**:
  - El cuerpo de la solicitud no es un JSON válido o el campo `identificador` no corresponde a un correo institucional (`@valdivia.cl`) ni a un RUT chileno válido según el algoritmo Módulo 11.
- **`200 OK` (Anti-enumeración) en `POST /api/seguridad/recuperar-contrasena`**:
  - Se retorna intencionalmente aun cuando el usuario no exista, esté inactivo o haya excedido el rate limit.
- **`400 Bad Request` en `POST /api/seguridad/restablecer-contrasena`**:
  - Error genérico *"El enlace de recuperación es inválido o ha expirado."* retornado indistintamente si el token no existe, ya fue usado, expiró o la cuenta está inactiva (unificación para evitar fugas de información).
  - Error *"Las contraseñas no coinciden"* cuando `nuevaPassword` y `confirmacionPassword` difieren.
  - Error *"La nueva contraseña debe ser distinta a la contraseña actual."* cuando coincide con el hash previo.
  - Error de validación Zod si la contraseña no cumple la política de robustez institucional.
- **`401 Unauthorized` en `POST /api/seguridad/login`**:
  - Identificador no registrado o contraseña incorrecta (*"Credenciales inválidas. Verifique su identificador o contraseña."*).
- **`403 Forbidden` en `POST /api/seguridad/login`**:
  - Cuenta deshabilitada (`usuario.activo = false`).
  - Cuenta bloqueada temporalmente por haber alcanzado 5 intentos fallidos (*"Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente nuevamente en X minuto(s) o contacte al Administrador."*).
- **`401 Unauthorized` en rutas protegidas (`/api/seguridad/*`, `/api/incidentes/*`, `/api/recursos/*`)**:
  - Falta la cabecera `Authorization: Bearer <token>`.
  - El token es inválido, manipulado o ha expirado.
- **`403 Forbidden` en endpoints de gestión de roles**:
  - El usuario está autenticado y activo, pero su perfil asignado **no es `'Administrador'`**.
- **`404 Not Found` en `/api/seguridad/roles/{id}`**:
  - El UUID provisto no corresponde a ningún perfil registrado en la tabla `rol`.

---

## 7. Trazabilidad con Frontends (`sgrai-web` y `sgrai-pwa`)

1. **Flujo de Recuperación en la Web (`sgrai-web`):**
   - En `/login`, el botón *"¿Olvidaste tu contraseña?"* conduce a `/recuperar-contrasena`.
   - El formulario consume `POST /api/seguridad/recuperar-contrasena` enviando `{ identificador }`.
   - Muestra siempre una alerta de confirmación con el mensaje genérico retornado.
   - El usuario abre el enlace recibido por correo (`/restablecer-contrasena?token=<token>`).
   - La vista presenta el formulario para ingresar y confirmar la nueva contraseña, consumiendo `POST /api/seguridad/restablecer-contrasena`.
   - Tras el éxito, notifica al funcionario y lo redirige automáticamente a `/login`.
2. **Almacenamiento de Sesión:**
   - Tras recibir el `200 OK` de `POST /api/seguridad/login`, el cliente web o PWA debe persistir el `token` (en almacenamiento de sesión seguro o cookie HTTPOnly) y registrar el perfil de usuario en su estado global de sesión.
3. **Invocación de Endpoints:**
   - El cliente HTTP de presentación (`apiClient`) debe inyectar automáticamente la cabecera en cada solicitud:
     ```http
     Authorization: Bearer <token>
     ```
4. **Generación Automática de Tipos TypeScript:**
   - Los frontends sincronizan sus interfaces ejecutando:
     ```bash
     npx openapi-typescript http://localhost:3001/openapi.json -o src/types/api.ts
     ```
   - Esto genera automáticamente los tipos exactos para `LoginRequest`, `LoginResponse`, `RecuperarContrasenaRequest`, `RestablecerContrasenaRequest`, `MensajeGenericoResponse` y todos los esquemas asociados sin requerir tipeo manual.
