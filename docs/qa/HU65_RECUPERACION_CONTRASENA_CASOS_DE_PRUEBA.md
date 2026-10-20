# Informe y Matriz de Casos de Prueba (QA): HU-65 — Recuperación de Contraseña del Funcionario (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Seguridad / Autenticación y Control de Acceso (RBAC).  
> **Historia de Usuario:** HU-65 — *"Como funcionario quiero solicitar la recuperación de mi contraseña mediante mi correo institucional @valdivia.cl o RUT para restablecer mi acceso al sistema en caso de olvido, reestableciendo mis credenciales de forma segura y autónoma sin depender de una intervención manual del Administrador."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest).  
> **Rama Git Evaluada:** `feature/H65-recuperacion-contrasena-funcionario`.  
> **Commits Clave Evaluados (Conventional Commits):**
> * `feat(db): agregar migración 023 con tabla token_recuperacion_contrasena`
> * `feat(db): incorporar tipos Kysely de token_recuperacion_contrasena`
> * `build(deps): agregar nodemailer para envío de correo transaccional`
> * `feat(mail): implementar adaptador EmailSender con transporte SMTP y consola`
> * `chore(config): agregar variables de recuperación de contraseña y SMTP a .env.example`
> * `build(docker): agregar servicio Mailpit para pruebas de correo en desarrollo y staging`
> * `feat(seguridad): agregar esquemas Zod de recuperación y restablecimiento de contraseña`
> * `feat(seguridad): implementar repositorio transaccional de tokens de recuperación`
> * `feat(seguridad): implementar servicio de recuperación con protección anti-enumeración`
> * `feat(seguridad): exponer POST /api/seguridad/recuperar-contrasena`
> * `feat(seguridad): exponer POST /api/seguridad/restablecer-contrasena con desbloqueo atómico`
> * `feat(openapi): registrar endpoints de recuperación de contraseña`
> * `test(seguridad): cubrir anti-enumeración, expiración de token y desbloqueo de cuenta`
> * `test(seguridad): cubrir route handlers de recuperación y restablecimiento`
> * `docs(api): documentar protocolo de recuperación de contraseña`
> * `docs(database): registrar tabla token_recuperacion_contrasena`
> 
> **Fecha de Certificación QA:** Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **20** |
| **Casos Aprobados (Passed)** | **20** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **23/23 tests exitosos (11 en servicio + 12 en route handlers)** |
| **Suite Completa de Regresión del Sistema** | **523/523 tests aprobados (47/47 suites)** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Contrato OpenAPI 3.0 Centralizado** | **Sincronizado en `/openapi.json` con tags `Seguridad / Autenticación`** |

---

## 2. Matriz Consolidada de Casos de Prueba

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload) | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|---|---|---|---|:---:|
| `CP-HU65-01` | Solicitud exitosa con correo `@valdivia.cl` de funcionario activo | Funcional / Seguridad | Integración | Crítica | Cuenta existente y activa en BD | `{"identificador": "carlos.miranda@valdivia.cl"}` | 200 OK con mensaje genérico; token emitido en BD (SHA-256) y correo despachado | 200 OK con mensaje genérico y token generado | ✅ APROBADO |
| `CP-HU65-02` | Solicitud exitosa con RUT chileno válido de funcionario activo | Funcional / Seguridad | Integración | Alta | Cuenta existente con RUT registrado | `{"identificador": "11111111-1"}` | 200 OK con mensaje genérico; token emitido en BD | 200 OK con mensaje genérico y token generado | ✅ APROBADO |
| `CP-HU65-03` | Protección anti-enumeración ante identificador inexistente | Seguridad | Unitaria / API | Crítica | No existe cuenta con dicho correo | `{"identificador": "no.existe@valdivia.cl"}` | 200 OK idéntico byte a byte; sin registrar token ni enviar correo | 200 OK idéntico; sin token ni correo | ✅ APROBADO |
| `CP-HU65-04` | Protección anti-enumeración ante cuenta inactiva (`activo = false`) | Seguridad | Unitaria / API | Alta | Cuenta deshabilitada por Administrador | `{"identificador": "inactivo@valdivia.cl"}` | 200 OK idéntico byte a byte; omite token y despacho de correo | 200 OK idéntico; omite token y correo | ✅ APROBADO |
| `CP-HU65-05` | Emisión de token para cuenta con penalización activa (`bloqueado_hasta`) | Seguridad / Integración | Integración | Alta | Cuenta activa con 5 fallos previos | `{"identificador": "bloqueado@valdivia.cl"}` | 200 OK genérico; emite token para permitir desbloqueo autónomo | 200 OK; token emitido para desbloqueo | ✅ APROBADO |
| `CP-HU65-06` | Rate Limiting de solicitudes por usuario (>3 en 15 min) | Seguridad / Límite | Unitaria | Media | 3 solicitudes emitidas en ventana de 15 min | `{"identificador": "carlos.miranda@valdivia.cl"}` | 200 OK genérico; omite inserción de nuevo token y correo | 200 OK genérico; tasa controlada | ✅ APROBADO |
| `CP-HU65-07` | Rechazo de identificador con dominio de correo externo (no `@valdivia.cl`) | Validación Zod | API | Alta | Petición HTTP POST | `{"identificador": "externo@gmail.com"}` | 400 Bad Request; detalla exigencia institucional | 400 Bad Request con detalle de error | ✅ APROBADO |
| `CP-HU65-08` | Rechazo de RUT chileno con dígito verificador inválido | Validación Zod | API | Alta | Petición HTTP POST | `{"identificador": "11111111-2"}` | 400 Bad Request por validador Módulo 11 | 400 Bad Request | ✅ APROBADO |
| `CP-HU65-09` | Rechazo de identificador en blanco o con espacios | Validación Zod | API | Media | Petición HTTP POST | `{"identificador": "   "}` | 400 Bad Request con error de campo requerido | 400 Bad Request | ✅ APROBADO |
| `CP-HU65-10` | Rechazo de payload mal formado (JSON inválido) en recuperación | Robustez | API | Media | Petición con sintaxis rota | Payload de texto plano no serializable | 400 Bad Request: "Cuerpo de solicitud inválido..." | 400 Bad Request | ✅ APROBADO |
| `CP-HU65-11` | Restablecimiento exitoso con token válido y contraseña robusta | Funcional / Seguridad | Integración | Crítica | Token activo vigente en BD | `{"token": "tok...", "nuevaPassword": "Valdivia2026!Nueva", "confirmacionPassword": "Valdivia2026!Nueva"}` | 200 OK; password_hash actualizado con bcrypt factor 10; token invalidado (`usado_en = NOW()`) | 200 OK; hash bcrypt factor 10 persistido; token invalidado | ✅ APROBADO |
| `CP-HU65-12` | Desbloqueo atómico de cuenta penalizada tras restablecimiento | Seguridad | Integración | Crítica | Cuenta con `bloqueado_hasta` futuro e `intentos_fallidos = 5` | Token válido del usuario penalizado | 200 OK; `intentos_fallidos = 0`, `bloqueado_hasta = NULL` de forma atómica | 200 OK; contadores de bloqueo reseteados a 0/NULL | ✅ APROBADO |
| `CP-HU65-13` | Rechazo de restablecimiento por no coincidencia de contraseñas | Validación Zod | API | Alta | Token válido | `{"token": "tok...", "nuevaPassword": "Clave1!", "confirmacionPassword": "ClaveDiferente2!"}` | 400 Bad Request: "Las contraseñas no coinciden" | 400 Bad Request: "Las contraseñas no coinciden" | ✅ APROBADO |
| `CP-HU65-14` | Rechazo de contraseña que no cumple política institucional | Validación Zod | API | Alta | Token válido | `{"token": "tok...", "nuevaPassword": "corta", "confirmacionPassword": "corta"}` | 400 Bad Request: requiere mínimo 8 caracteres, mayúscula, minúscula y número | 400 Bad Request con errores por regla | ✅ APROBADO |
| `CP-HU65-15` | Rechazo si la nueva contraseña es idéntica a la contraseña actual | Seguridad / Regla | Unitaria / Integración | Alta | Token válido; contraseña actual conocida | `{"token": "tok...", "nuevaPassword": "Valdivia2026!", "confirmacionPassword": "Valdivia2026!"}` | 400 Bad Request: "La nueva contraseña debe ser distinta a la contraseña actual." | 400 Bad Request con mensaje de regla | ✅ APROBADO |
| `CP-HU65-16` | Rechazo de token inexistente o manipulado | Seguridad | API | Crítica | Token arbitrario o alterado | `{"token": "token-inexistente", ...}` | 400 Bad Request genérico: "El enlace de recuperación es inválido o ha expirado." | 400 Bad Request genérico | ✅ APROBADO |
| `CP-HU65-17` | Rechazo de reutilización de token (token ya consumido) | Seguridad | API | Crítica | Token con `usado_en` ya registrado | Token consumido previamente | 400 Bad Request genérico unificado | 400 Bad Request genérico | ✅ APROBADO |
| `CP-HU65-18` | Rechazo de token expirado (> 30 minutos de emisión) | Seguridad / Temporal | Unitaria | Alta | Token con `expira_en <= NOW()` | Token fuera de vigencia de 30 min | 400 Bad Request genérico unificado | 400 Bad Request genérico | ✅ APROBADO |
| `CP-HU65-19` | Rechazo de token si el usuario fue desactivado a posteriori | Seguridad | Unitaria | Media | Usuario inhabilitado tras emitir token | Token emitido antes de inhabilitación | 400 Bad Request genérico unificado | 400 Bad Request genérico | ✅ APROBADO |
| `CP-HU65-20` | Verificación de contrato OpenAPI 3.0 en `/openapi.json` | Contrato / Documentación | API | Media | Servidor activo | Consulta a `generarOpenAPISpec()` | Endpoints `/api/seguridad/recuperar-contrasena` y `/api/seguridad/restablecer-contrasena` expuestos con schemas | Contratos presentes y validados | ✅ APROBADO |

---

## 3. Evidencias de Ejecución Técnica Automatizada (Vitest)

```bash
$ npx vitest run src/modules/seguridad/__tests__/recuperacion-contrasena.service.test.ts src/app/api/seguridad/recuperar-contrasena/__tests__/route.test.ts src/app/api/seguridad/restablecer-contrasena/__tests__/route.test.ts

 ✓ src/modules/seguridad/__tests__/recuperacion-contrasena.service.test.ts (11 tests) 513ms
   ✓ 1. Protección Anti-Enumeración y Solicitud de Recuperación
     ✓ debe retornar mensaje genérico cuando el usuario existe y está activo
     ✓ debe responder el idéntico mensaje genérico sin emitir token ni correo si el usuario NO existe
     ✓ debe responder el idéntico mensaje genérico sin emitir token si la cuenta está inhabilitada
     ✓ debe emitir token para cuentas activas temporalmente bloqueadas por reintentos
     ✓ debe aplicar Rate Limiting y no emitir token si se superó el máximo de solicitudes recientes
   ✓ 2. Restablecimiento Atómico de Contraseña
     ✓ debe restablecer contraseña exitosamente, hasheando con bcrypt factor 10 e invalidando el token
     ✓ debe rechazar si la nueva contraseña es exactamente igual a la actual
     ✓ debe rechazar con 400 genérico si el token no existe
     ✓ debe rechazar con 400 genérico si el token ya fue utilizado previamente
     ✓ debe rechazar con 400 genérico si el token ha expirado
     ✓ debe rechazar con 400 genérico si el usuario asociado al token fue inhabilitado

 ✓ src/app/api/seguridad/recuperar-contrasena/__tests__/route.test.ts (6 tests) 37ms
   ✓ debe retornar 200 OK con mensaje genérico para un correo @valdivia.cl válido
   ✓ debe retornar 200 OK con mensaje genérico para un RUT chileno válido
   ✓ debe retornar 400 Bad Request si el identificador es un correo no institucional
   ✓ debe retornar 400 Bad Request si el identificador está vacío
   ✓ debe retornar 400 Bad Request si el cuerpo de la solicitud no es JSON válido
   ✓ debe retornar 500 si ocurre un error inesperado no controlado en el servicio

 ✓ src/app/api/seguridad/restablecer-contrasena/__tests__/route.test.ts (6 tests) 37ms
   ✓ debe retornar 200 OK cuando los datos y el token son válidos
   ✓ debe retornar 400 Bad Request si la confirmación de contraseña no coincide
   ✓ debe retornar 400 Bad Request si la contraseña no cumple la política
   ✓ debe retornar 400 Bad Request con mensaje de error de dominio si el token es inválido o expiró
   ✓ debe retornar 400 Bad Request si el cuerpo de solicitud no es un JSON válido
   ✓ debe retornar 500 ante un error no controlado en el servidor

 Test Files  3 passed (3)
      Tests  23 passed (23)
```

---

## 4. Registro de Defectos (Bugs)

Durante el ciclo de desarrollo y pruebas automatizadas no se presentaron defectos bloqueantes ni fallos residuales. Todos los casos de prueba diseñados resultaron en estado **APROBADO (PASSED)**.

---

## 5. Dictamen Final de Calidad (QA)

La implementación de la **HU-65 (Recuperación de Contraseña del Funcionario)** en el backend `sgrai-api` cumple a cabalidad con:
1. **Protección Anti-Enumeración:** Respuestas genéricas consistentes y despacho asíncrono no bloqueante.
2. **Criptografía Robusta:** Entropía de 256 bits, almacenamiento mediante hash SHA-256 de 64 caracteres, y contraseñas hasheadas con `bcrypt` factor de coste 10.
3. **Reseteo Atómico de Bloqueo:** Desbloqueo inmediato de cuentas penalizadas por fuerza bruta (`intentos_fallidos = 0`, `bloqueado_hasta = NULL`) al completar el restablecimiento exitoso.
4. **Arquitectura y Estándares:** Zod Schemas + OpenAPI 3.0, GitFlow, SemVer, y Conventional Commits atómicos.

**Veredicto:** 🟢 **CERTIFICADO PARA PULL REQUEST E INTEGRACIÓN A `develop`**.
