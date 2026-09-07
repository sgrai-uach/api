@AGENTS.md

# GEMINI.md — sgrai-api

Este archivo da contexto arquitectónico a cualquier asistente de IA que trabaje sobre este repositorio, que es el **backend monolítico** del Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI), de la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

## 1. Rol de este repositorio en el sistema

`sgrai-api` es el **único** backend del sistema. Es un monolito modular: toda la lógica de negocio vive aquí, contra **una sola base de datos relacional**. No hay descomposición en microservicios por dominio.

Dos clientes de presentación consumen esta API por HTTPS/REST (y Socket.io para tiempo real), pero **nunca contienen lógica de negocio propia**, solo la invocan aquí:

- `sgrai-web` — plataforma web para Informante, Call Center, Encargado, Supervisor, Administrador y Asistente Social.
- `sgrai-pwa` — app de terreno (Patrulla Verificadora, Delegado de Cuadrilla).

Si estás modificando este repositorio, cualquier regla de negocio, validación o cálculo debe implementarse **aquí**, no en los frontends.

> Nota sobre diseño de UI: este repositorio no tiene interfaz de usuario, así que la guía de paleta de colores y estilo visual (basada en el sitio institucional de la Municipalidad de Valdivia) no aplica aquí — está definida en `GEMINI.md` de `sgrai-web` y `sgrai-pwa`.

## 2. Por qué sigue siendo "monolítico" pese a estar en un repositorio separado de los frontends

Separar `sgrai-api` en su propio repositorio es una decisión de **topología de despliegue** (permite ciclos de CI/CD independientes entre backend y frontends con un equipo de 4 personas), no una migración a microservicios. El término "monolito" aquí se refiere a que:

- Hay un único servicio desplegable que concentra toda la lógica de negocio.
- Hay una única base de datos (`DB Relacional SGRAI`, PostgreSQL + PostGIS).
- No hay descomposición por dominio en servicios independientes con sus propios despliegues.

No dividas este repositorio en servicios separados por módulo (ej. un servicio aparte solo para Cartografía o solo para Notificaciones) sin que sea una decisión arquitectónica explícita y documentada — eso sí rompería el carácter monolítico del backend.

## 3. Stack tecnológico de este repositorio

- **Framework:** Next.js (API Routes / Route Handlers) con TypeScript. Next.js aquí actúa exclusivamente como capa de backend (no renderiza vistas de usuario final).
- **Base de datos:** PostgreSQL con extensión PostGIS (datos espaciales), acceso mediante **Kysely** (query builder, no ORM).
- **Caché y tareas en segundo plano:** Redis.
- **Tiempo real:** Socket.io, para geolocalización en vivo y notificaciones push.
- **Comunicaciones externas:** Asterisk (IVR telefónico) y whatsapp-web.js (mensajería automatizada) — integrados como sistemas externos, no como lógica de negocio interna.
- **Infraestructura:** Docker + Docker Compose, On-Premise, Caddy como reverse proxy (SSL/TLS automático) delante de este servicio.

## 4. Estructura interna de dominio (paquetes/módulos)

La lógica de negocio se organiza en los siguientes módulos de dominio (ver diagrama de paquetes). Respeta estas fronteras y las dependencias `Use` documentadas al ubicar código nuevo:

| Módulo | Responsabilidad | Depende de (Use) |
|---|---|---|
| **Incidentes** | Registrar incidente, clasificar incidente, actualizar estado del incidente | Recursos y Personal, Geolocalización, Seguridad, Eventos ATP |
| **Misiones** | Asignar misión, gestionar bitácora (log de misión), cerrar misión / generar informe final | Evidencia, Recursos y Personal, Eventos ATP, Notificaciones |
| **Recursos y Personal** | Asignar recurso/personal, consultar disponibilidad, administrar delegaciones y conformación de cuadrillas | Geolocalización, Eventos ATP |
| **Eventos ATP** | Generar evento de recuperación/prevención/asistencia social, asignar beneficio a evento | Notificaciones, Recursos y Personal, Seguridad |
| **Evidencia** | Adjuntar archivo, generar reporte de terreno | — |
| **Notificaciones** | Enviar notificación | — |
| **Geolocalización** | Obtener ubicación, mapa interactivo | — |
| **Seguridad** | Autenticar usuario, gestionar roles y permisos, registrar informante | — |
| **Reportería y Analítica** | Generar informe, generar y calcular estadísticas de gestión (incluye Informe Alfa 37G para SENAPRED) | Misiones, Incidentes, Recursos y Personal, Notificaciones, Seguridad |

Componentes de infraestructura interna que soportan estos módulos: **Cache y Colas** (Redis), **Adjunto y Evidencia**, **Cartografía/Geo**, **Usuarios/Roles/Permisos** (autenticación/autorización central que todos los demás módulos consultan).

## 5. Modelo de datos

La fuente de verdad del modelo de datos es el diagrama Entidad-Relación (`Diagrama Entidad-Relación - SGRAI.png`, fuera de este repositorio, referenciar desde documentación del proyecto). Entidades principales que este backend debe modelar con Kysely:

- **Incidentes y Eventos:** `Avisos Incidentes`, `Tipo Incidente`, `Incidente`, `EventoATP`, `Punto Crítico`.
- **Organización:** `Delegación` (Norte, Sur, Costa, Calle Calle), `Usuario`, `Rol`.
- **Operaciones:** `Cuadrilla`, `Personal`, `Recurso`, `Misión`, `Reporte Terreno`, `Adjunto`.
- **Especializados:** `Asistente`, `Asistencia Social`, `Beneficio`.

## 6. Reglas de negocio críticas a respetar en la lógica de dominio

- El sistema se basa en el **Sistema de Comando de Incidentes (ICS)**. Alcance actual: Sección de Operaciones (completa) y Sección de Logística (parcial). Planificación y Finanzas están fuera de alcance.
- Ciclo de vida de un incidente: `Reportado → Verificando → En Atención → No Abordable / Resuelto`.
- La evaluación primaria de un incidente la hace una **patrulla verificadora**. Al escalar y despachar una cuadrilla u otro recurso, la patrulla verificadora debe quedar **liberada** en el sistema (disponible para nueva asignación).
- Las cuadrillas pueden **rechazar** una misión, pero deben ingresar una justificación obligatoria.
- Se pueden despachar misiones de **prevención** o **recuperación** ("puntos críticos") **sin necesidad de un incidente formal previo** — no fuerces esa relación como obligatoria en el modelo.
- No existe módulo de "Albergues". La vulnerabilidad social se maneja con un indicador `requiere_asistencia_social` a nivel de incidente, que deriva a un registro propio de Asistencia Social para levantar la **Ficha Básica de Emergencia (FIBE)**.
- Reportería debe poder generar los formatos requeridos por **SENAPRED** (ej. Informe Alfa 37G).

## 7. Contrato con los frontends

`sgrai-web` y `sgrai-pwa` dependen de este repositorio vía HTTP/REST y Socket.io. Mantén el contrato de API explícito y versionado:

- Cualquier cambio breaking en un endpoint requiere coordinación explícita con los equipos de `sgrai-web` / `sgrai-pwa` antes de mergear — no asumas que los frontends se van a adaptar solos.
- **Estrategia oficial: OpenAPI generado automáticamente + tipos generados en los frontends.** Nadie escribe a mano el spec de la API ni los tipos de request/response en los frontends; ambos se derivan de una única fuente de verdad para evitar que diverjan.

### Cómo se implementa en este repositorio

1. Los endpoints validan su body/query con **Zod** (esto ya sería buena práctica de todos modos):

   ```typescript
   // app/api/incidentes/route.ts
   import { z } from 'zod';

   export const CrearIncidenteSchema = z.object({
     tipo: z.enum(['Inundación', 'Deslizamiento', 'Otro']),
     descripcion: z.string(),
     lat: z.number(),
     lng: z.number(),
   });
   ```

2. A partir de esos mismos esquemas Zod, se genera el spec OpenAPI (ej. con `zod-to-openapi`), sin volver a describir los tipos a mano.

3. El spec resultante (`openapi.json`) se expone en una ruta pública de este servicio, ej. `GET /openapi.json`, para que los frontends puedan consumirlo en su propio proceso de build.

4. Cualquier cambio en un esquema Zod se refleja automáticamente en el spec la próxima vez que se regenera — no hay un archivo de documentación aparte que alguien deba recordar actualizar a mano.

**Regla práctica:** si agregas o modificas un endpoint, hazlo siempre a través de su esquema Zod, nunca escribiendo el JSON de respuesta "suelto" sin tipo — de lo contrario el endpoint queda fuera del spec generado y los frontends no podrán tipar la llamada automáticamente.

## 8. Documentación de este repositorio (equivalente al manual de usuario)

Este repositorio no tiene interfaz de usuario final, así que su "manual de usuario" es documentación técnica dirigida a quien consume la API (desarrolladores de `sgrai-web` y `sgrai-pwa`, y a futuro posibles integraciones externas). Igual que en los frontends, debe generarse junto con la implementación, no después.

- **Ubicación estándar:** `/docs/api/` en la raíz de este repositorio.
- **Convención de nombre:** un archivo por módulo de dominio o grupo de endpoints, ej. `incidentes.md`, `eventos-atp.md`, `recursos-y-personal.md` — no por HU individual, ya que un mismo endpoint suele servir a varias historias de usuario de los frontends.
- **Cuándo se crea/actualiza:** como parte del mismo PR que agrega o modifica un endpoint. El spec OpenAPI (`openapi.json`) cubre la forma técnica exacta de cada request/response, pero **no reemplaza** una explicación breve en prosa de para qué sirve el endpoint, qué reglas de negocio aplica internamente y qué errores puede devolver y por qué.
- **Contenido mínimo por módulo:**
  - Qué reglas de negocio del módulo aplica (referencia a la sección 6 de este archivo).
  - Lista de endpoints con su propósito en una línea (el detalle de parámetros vive en el OpenAPI, no lo dupliques aquí).
  - Errores esperables no obvios desde el código de estado HTTP (ej. por qué un `409` en `/misiones/{id}/rechazar` significa que falta la justificación).
- Si un manual de usuario en `sgrai-web` o `sgrai-pwa` depende de un comportamiento específico de un endpoint (ej. por qué la patrulla queda liberada automáticamente), enlaza desde `/docs/api/` al manual correspondiente en el otro repositorio para que quede trazable de punta a punta.

## 9. Flujo de trabajo de desarrollo (aplica a los 3 repositorios)

- **Ramas:** Gitflow.
- **Versionado:** SemVer.
- **Commits:** Conventional Commits.
- **Integración:** toda funcionalidad nace en una rama nueva → PR → **Pair Review** obligatoria (otro desarrollador) → **PO Review** obligatoria → merge solo con ambas aprobaciones.
