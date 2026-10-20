# Guía de Implementación Frontend — HU-65: Recuperación y Restablecimiento de Contraseña (`sgrai-web`)

> **Destinatario:** Asistente de IA / Ingeniero de Software en el repositorio `sgrai-web`.  
> **Historia de Usuario:** HU-65 — Recuperación de Contraseña del Funcionario.  
> **Servicio API:** `sgrai-api` (Endpoints ya implementados, testeados y versionados en la rama `feature/H65-recuperacion-contrasena-funcionario`).  
> **Estándares del Proyecto:** Next.js (App Router), React 19, TypeScript estricto, CSS Modules, Tokens de diseño institucional (`src/styles/tokens.css`), `openapi-fetch`, Vitest y Testing Library.

---

## 1. Criterios de Aceptación a Implementar en el Frontend

1. **Enlace en Login:** En la pantalla de inicio de sesión (`/login`), debe existir un enlace accesible e interactivo con el texto *"¿Olvidaste tu contraseña?"* que redirija a `/recuperar-contrasena`.
2. **Formulario de Solicitud (`/recuperar-contrasena`):**
   - Campo para ingresar el identificador institucional: correo `@valdivia.cl` o RUT chileno.
   - Validación en cliente antes de enviar:
     - Formato de correo institucional `@valdivia.cl` o RUT chileno válido (usando `validarRutChileno` de `@/lib/validations/rut`).
   - Botón de envío con estado de carga (*"Enviando solicitud..."*).
   - Al recibir respuesta `200 OK` del backend, presentar un mensaje informativo claro con `InlineNotice` (variante `info`): *"Si el identificador corresponde a una cuenta registrada, se enviará un enlace de recuperación."* (protección contra enumeración de cuentas).
   - Botón para *"Volver al Inicio de Sesión"*.
3. **Pantalla de Restablecimiento (`/restablecer-contrasena?token=...`):**
   - Debe leer el parámetro de consulta `token` desde la URL mediante `useSearchParams()`.
   - Si no existe el parámetro `token` en la URL, mostrar una advertencia inmediata con `InlineNotice` (variante `error`) indicando que el enlace es inválido y ofrecer botón de retorno al login.
   - Formulario con campos:
     - **Nueva Contraseña:** Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número. Indicador visual o toggle para ver/ocultar contraseña.
     - **Confirmar Nueva Contraseña:** Debe coincidir exactamente con la nueva contraseña.
   - Validaciones en cliente antes de enviar.
   - Al enviar exitosamente (`200 OK`), mostrar mensaje de éxito y redirigir al funcionario a `/login?motivo=password_restablecida` para iniciar sesión con su nueva credencial.
   - Ante errores de la API (`400 Bad Request`), mostrar el mensaje de error retornado (ej. *"El enlace de recuperación es inválido o ha expirado."* o *"La nueva contraseña debe ser distinta a la contraseña actual."*).

---

## 2. Contrato de API (Backend `sgrai-api`)

El backend expone dos endpoints públicos ya integrados en la especificación OpenAPI 3.0:

### 2.1 `POST /api/seguridad/recuperar-contrasena`
* **Autenticación:** Pública (sin token).
* **Request Body:**
  ```json
  {
    "identificador": "carlos.miranda@valdivia.cl"
  }
  ```
  *(Acepta correo `@valdivia.cl` o RUT en formatos `11111111-1`, `11.111.111-1`, etc.)*
* **Response `200 OK` (Anti-enumeración):**
  ```json
  {
    "message": "Si el identificador corresponde a una cuenta registrada, se enviará un enlace de recuperación."
  }
  ```
* **Response `400 Bad Request`:**
  ```json
  {
    "error": "Datos de solicitud inválidos",
    "details": {
      "identificador": ["El identificador debe ser un correo institucional (@valdivia.cl) o un RUT chileno válido"]
    }
  }
  ```

### 2.2 `POST /api/seguridad/restablecer-contrasena`
* **Autenticación:** Pública (sin token).
* **Request Body:**
  ```json
  {
    "token": "token-criptografico-base64url",
    "nuevaPassword": "NuevaPassword2026!",
    "confirmacionPassword": "NuevaPassword2026!"
  }
  ```
* **Response `200 OK`:**
  ```json
  {
    "message": "Contraseña restablecida correctamente. Ya puede iniciar sesión."
  }
  ```
  *(Nota del backend: Este endpoint restablece la contraseña con bcrypt factor 10, invalida el token y reinicia atómicamente `intentos_fallidos = 0` y `bloqueado_hasta = NULL` para desbloquear la cuenta si estaba penalizada por fuerza bruta).*
* **Response `400 Bad Request`:**
  ```json
  {
    "error": "El enlace de recuperación es inválido o ha expirado."
  }
  ```
  *(O `"La nueva contraseña debe ser distinta a la contraseña actual."` / `"Las contraseñas no coinciden"`).*

---

## 3. Plan de Desarrollo Paso a Paso para `sgrai-web`

### Paso 0: Sincronización de Tipos OpenAPI
En el repositorio `sgrai-web`, con el backend ejecutándose en `http://localhost:3001` (o `3000` según configuración):
```bash
npm run generate-api-types
```
Esto regenerará automáticamente `src/types/api-generated.d.ts` incorporando los endpoints y schemas de recuperación de contraseña.

---

### Paso 1: Tipos de Dominio (`src/types/seguridad.ts`)
Exportar los tipos derivados de los schemas OpenAPI generados:
```typescript
export type RecuperarContrasenaRequest = components['schemas']['RecuperarContrasenaRequest'];
export type RestablecerContrasenaRequest = components['schemas']['RestablecerContrasenaRequest'];
export type MensajeGenericoResponse = components['schemas']['MensajeGenericoResponse'];
```

---

### Paso 2: Métodos en `src/services/seguridadService.ts`
Incorporar las funciones del servicio consumiendo `apiClient`:

```typescript
/**
 * Solicita el enlace de recuperación de contraseña mediante correo o RUT.
 * Aplica protección anti-enumeración de cuentas retornando mensaje genérico.
 */
export async function solicitarRecuperacionContrasena(
  identificador: string
): Promise<MensajeGenericoResponse> {
  try {
    const { data, error, response } = await apiClient.POST(
      '/api/seguridad/recuperar-contrasena',
      {
        body: { identificador: identificador.trim() },
      }
    );

    if (error || !response.ok || !data) {
      throw new SeguridadServiceError(
        formatApiError(error, 'Error al solicitar recuperación de contraseña'),
        response?.status || 400
      );
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof SeguridadServiceError) throw err;
    throw new SeguridadServiceError(
      { error: err instanceof Error ? err.message : 'Error de conexión con el servidor' },
      500
    );
  }
}

/**
 * Restablece la contraseña institucional validando el token de recuperación.
 */
export async function restablecerContrasena(
  datos: RestablecerContrasenaRequest
): Promise<MensajeGenericoResponse> {
  try {
    const { data, error, response } = await apiClient.POST(
      '/api/seguridad/restablecer-contrasena',
      {
        body: datos,
      }
    );

    if (error || !response.ok || !data) {
      throw new SeguridadServiceError(
        formatApiError(error, 'Error al restablecer la contraseña'),
        response?.status || 400
      );
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof SeguridadServiceError) throw err;
    throw new SeguridadServiceError(
      { error: err instanceof Error ? err.message : 'Error de conexión con el servidor' },
      500
    );
  }
}
```

---

### Paso 3: Enlace en `src/components/auth/LoginForm.tsx`
1. En `LoginForm.tsx`, ubicar el bloque de la contraseña y antes del botón de envío (`styles.submitArea`), agregar el enlace accesible:
   ```tsx
   <div className={styles.forgotPasswordWrapper}>
     <Link
       href="/recuperar-contrasena"
       className={styles.forgotPasswordLink}
       tabIndex={cargando ? -1 : 0}
     >
       ¿Olvidaste tu contraseña?
     </Link>
   </div>
   ```
2. En `LoginForm.module.css`, agregar el estilo con tokens institucionales:
   ```css
   .forgotPasswordWrapper {
     display: flex;
     justify-content: flex-end;
     margin-top: 8px;
     margin-bottom: 20px;
   }

   .forgotPasswordLink {
     font-size: 13px;
     color: var(--color-primary-teal, #1B6F7D);
     text-decoration: underline;
     font-weight: 500;
     transition: color 0.15s ease-in-out;
   }

   .forgotPasswordLink:hover {
     color: var(--color-primary-teal-dark, #14505A);
   }

   .forgotPasswordLink:focus-visible {
     outline: 2px solid var(--color-accent-mint, #4FAE9B);
     outline-offset: 2px;
   }
   ```
3. También en `LoginForm.tsx`, dar soporte al query param `?motivo=password_restablecida` para mostrar un banner de éxito si el funcionario viene recién redirigido desde el formulario de restablecimiento:
   ```tsx
   {motivo === 'password_restablecida' && (
     <div className={`${styles.alertBox} ${styles.alertSuccess}`} role="status">
       <CheckCircle2 size={18} className={styles.alertIcon} />
       <span>Su contraseña ha sido restablecida exitosamente. Inicie sesión con su nueva credencial.</span>
     </div>
   )}
   ```

---

### Paso 4: Vistas y Componentes para `/recuperar-contrasena`

1. **Ruta:** `src/app/(auth)/recuperar-contrasena/page.tsx`:
   - Metadata de página (`title: 'Recuperar Contraseña — SGRAI'`).
   - Envuelve con `<AppHeader />`, `<AppFooter />` y `<Suspense>`.
   - Renderiza `<RecuperarContrasenaForm />`.

2. **Componente:** `src/components/auth/RecuperarContrasenaForm.tsx`:
   - Estado: `identificador`, `cargando`, `error`, `solicitudExitosa` (boolean), `mensajeServidor`.
   - Validación local:
     - No vacío.
     - Si incluye `@`: validar que pertenezca a `@valdivia.cl`.
     - Si no incluye `@`: validar con `validarRutChileno(id)`.
   - Al enviar: invocar `solicitarRecuperacionContrasena(identificador)`.
   - Tras respuesta exitosa:
     - Mostrar `<InlineNotice variant="info">` con el texto:
       *"Si los datos ingresados corresponden a un funcionario registrado, se ha enviado un correo con las instrucciones y el enlace para restablecer su contraseña. Revise su bandeja de entrada (y carpeta de spam)."*
     - Ofrecer botón de retorno a `/login` (*"Volver al inicio de sesión"*).
     - Deshabilitar el formulario para evitar reenvíos accidentales.

3. **Estilos:** `src/components/auth/RecuperarContrasenaForm.module.css`:
   - Reutilizar la estética de tarjeta `.card`, cabecera `.header` institucional verde azulado (`--color-primary-teal-dark`) y bordes menta (`--color-accent-mint`) consistente con `LoginForm.module.css`.

---

### Paso 5: Vistas y Componentes para `/restablecer-contrasena`

1. **Ruta:** `src/app/(auth)/restablecer-contrasena/page.tsx`:
   - Metadata: `title: 'Restablecer Contraseña — SGRAI'`.
   - Lee `searchParams` (`token`).
   - Renderiza `<RestablecerContrasenaForm />`.

2. **Componente:** `src/components/auth/RestablecerContrasenaForm.tsx`:
   - Extrae `const token = searchParams.get('token');` usando `useSearchParams()`.
   - Si `!token`:
     - Renderizar `<InlineNotice variant="error" title="Enlace no válido">`:
       *"El enlace para restablecer contraseña no contiene un token válido o está incompleto. Por favor solicite un nuevo enlace de recuperación."*
     - Botón: *"Solicitar nuevo enlace"* hacia `/recuperar-contrasena`.
   - Si `token` existe:
     - Campos: `nuevaPassword`, `confirmacionPassword`.
     - Toggles de visibilidad `Eye` / `EyeOff` para cada input de contraseña.
     - Validación local en tiempo real o al submit:
       - Longitud mínima de 8 caracteres.
       - Al menos una mayúscula (`/[A-Z]/`).
       - Al menos una minúscula (`/[a-z]/`).
       - Al menos un dígito (`/\d/`).
       - Coincidencia estricta: `nuevaPassword === confirmacionPassword`.
     - Al enviar: invocar `restablecerContrasena({ token, nuevaPassword, confirmacionPassword })`.
     - Al tener éxito:
       - Mostrar mensaje de confirmación y redirigir con `router.push('/login?motivo=password_restablecida')`.
     - Si falla (`SeguridadServiceError`):
       - Mostrar el mensaje exacto retornado por la API en `<InlineNotice variant="error">`.

---

## 4. Pruebas Automatizadas Exigidas (Vitest + Testing Library)

En `sgrai-web` deben construirse las siguientes suites de prueba:

1. **`src/services/__tests__/seguridadService.test.ts`:**
   - Debe llamar a `POST /api/seguridad/recuperar-contrasena` con el identificador saneado.
   - Debe retornar el objeto `{ message }` ante `200 OK`.
   - Debe lanzar `SeguridadServiceError` ante error HTTP `400` o `500`.
   - Debe llamar a `POST /api/seguridad/restablecer-contrasena` con token y contraseñas.
2. **`src/components/auth/__tests__/LoginForm.test.tsx`:**
   - Debe renderizar el enlace *"¿Olvidaste tu contraseña?"* con `href="/recuperar-contrasena"`.
   - Debe mostrar el banner de éxito si el query param es `?motivo=password_restablecida`.
3. **`src/components/auth/__tests__/RecuperarContrasenaForm.test.tsx`:**
   - Debe validar que el campo identificador sea obligatorio.
   - Debe rechazar correos no institucionales (ej. `test@gmail.com`).
   - Debe validar formato de RUT chileno.
   - Debe mostrar el mensaje de confirmación genérico ante respuesta exitosa del servicio.
4. **`src/components/auth/__tests__/RestablecerContrasenaForm.test.tsx`:**
   - Debe mostrar error inmediato si no se provee el query param `token`.
   - Debe validar requisitos de contraseña (longitud, mayúsculas, dígitos).
   - Debe validar que las contraseñas coincidan antes de despachar la petición.
   - Debe invocar al servicio de restablecimiento con el token y redirigir al login en caso de éxito.
   - Debe desplegar alerta de error si el backend responde que el token expiró o es inválido.

---

## 5. Convención GitFlow y Commits para `sgrai-web`

* **Rama:** `feature/H65-recuperacion-contrasena-web` (a partir de `develop`).
* **Secuencia recomendada de Commits Semánticos (Conventional Commits):**
  1. `chore(api): regenerar tipos typescript desde openapi.json de sgrai-api`
  2. `feat(seguridad): incorporar metodos de recuperacion y restablecimiento en seguridadService`
  3. `feat(auth): agregar enlace olvidaste tu contrasena en LoginForm`
  4. `feat(auth): implementar formulario y pagina /recuperar-contrasena`
  5. `feat(auth): implementar formulario y pagina /restablecer-contrasena con validaciones`
  6. `test(auth): agregar pruebas unitarias y de componentes para flujo de recuperacion de contrasena`
  7. `docs(qa): formalizar matriz de casos de prueba frontend para HU-65`

---

## 6. Verificación Final en `sgrai-web`

Antes de abrir el Pull Request hacia `develop`:
```bash
npm run lint
npm test
npm run build
```
Todo debe compilar sin errores y el 100% de las pruebas debe resultar en verde (`PASSED`).
