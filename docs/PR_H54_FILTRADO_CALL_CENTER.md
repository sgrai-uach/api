## Descripción

Este Pull Request implementa la funcionalidad completa del backend para el **filtrado reactivo multicriterio, gestión de disponibilidad y cálculo de tiempos de espera en la bandeja de avisos del Call Center**, correspondiente a la **Historia de Usuario HU-54 (Módulo: Incidentes / Seguridad / Geolocalización)** del sistema SGRAI de la Municipalidad de Valdivia. Permite a los operadores con rol `Call Center` y `Administrador` consultar, buscar y segmentar reportes preliminares de emergencia provenientes del portal web, chatbot municipal o ingreso telefónico, garantizando el cumplimiento estricto de los Criterios de Aceptación (CA-1 al CA-7) definidos para la mesa de atención ciudadana.

Incorpora el Route Handler optimizado `GET /api/incidentes/avisos` con soporte para filtros combinados mediante lógica conjuntiva (`AND`): delegación territorial (`Norte`, `Sur`, `Costa`, `Calle Calle`, `Calle-Calle` y `TODAS`), estado operativo (`NO_VERIFICADO`, `VERIFICADO`, `DESCARTADO` y `TODOS`), canal de origen (`WEB`, `CHATBOT`, `TELEFONO`) y búsqueda textual libre insensible a mayúsculas/minúsculas sobre dirección, descripción, nombre del informante o código de seguimiento numérico. Asimismo, implementa control de acceso basado en roles (RBAC) con el permiso oficial `incidentes:avisos:leer` (respondiendo `401 Unauthorized` ante peticiones sin autenticación y `403 Forbidden` ante roles no facultados), sanitización robusta contra inyección SQL y comodines LIKE (`%`, `_`), cálculo dinámico en tiempo real de `minutosEnEspera` ordenado descendentemente por antigüedad (`creado_en ASC`) para preservar el semáforo de urgencia del Call Center (<15 min, 15-30 min, >30 min), metadatos de paginación congruentes (`page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`), retorno seguro de estados vacíos (`200 OK` con `data: []` y `total: 0`), especificación OpenAPI v0.6.0 en `/openapi.json`, y suite completa de pruebas unitarias e integración en Vitest (17 suites y 151 pruebas pasando al 100%).

---

## Tipo de Cambio

- [x] Nueva funcionalidad (New feature)
- [x] Corrección de errores (Bug fix)
- [ ] Refactorización sin cambios funcionales (Refactoring)
- [x] Actualización de documentación (Documentation update)
- [x] Infraestructura / Configuración (Infrastructure / Configuration)
- [x] Integridad de datos y validaciones de dominio (Domain validations)

---

## Cambios Realizados

- **Base de datos y persistencia (PostgreSQL + PostGIS + Kysely):**
  - Implementación de la migración Kysely `008_aviso_delegacion.ts`:
    - Adición de las columnas `delegacion_id` (UUID nullable con clave foránea a `delegacion(id)`) y `delegacion_manual` (varchar(100) nullable) en la tabla `aviso_incidente` con `IF NOT EXISTS` garantizando idempotencia en migraciones.
    - Creación de la vista de compatibilidad `avisos_incidentes` para desacoplar modelos y asegurar consistencia relacional.
    - Retrocompatibilidad y backfill territorial de registros históricos existentes en base a geolocalización y direcciones textuales.
  - Migración `007_vistas_compatibilidad_legada.ts` blindada con limpieza defensiva previa (`DROP TABLE ... CASCADE` condicional) para esquemas legados.
  - Mapeo de tipos Kysely en `src/lib/db/types.ts` (`AvisoIncidenteTable`).
  - Repositorio `src/modules/incidentes/repository.ts`:
    - Construcción de consulta dinámica multicriterio en `obtenerAvisosPaginados` con Kysely (`leftJoin` a `delegacion`).
    - Resolución SQL canónica de nombres de delegación territorial (`Norte`, `Sur`, `Costa`, `Calle Calle`) combinando `delegacion.nombre` y `delegacion_manual`.
    - Sanitización y escape de comodines SQL (`%`, `_`, `\`) en expresiones `LIKE` para prevenir coincidencias globales no deseadas o vulnerabilidades de inyección.
    - Ejecución dual de conteo (`count(*)`) y paginación (`LIMIT`/`OFFSET`) aplicando exactamente el mismo árbol de condiciones `WHERE`.

- **Control de Acceso (RBAC) y Seguridad:**
  - Nueva constante de permiso `PERMISO_LISTAR_AVISOS = "incidentes:avisos:leer"` en `src/modules/seguridad/permisos.constants.ts`.
  - Validación de acceso en Route Handler `GET /api/incidentes/avisos` mediante `verificarPermiso()`:
    - Retorno de `HTTP 401 Unauthorized` si no se incluye la cabecera `X-User-Id` o token Bearer.
    - Retorno de `HTTP 403 Forbidden` si el usuario autenticado carece del permiso `incidentes:avisos:leer` (ej. perfil `Encargado`, `Observador` o usuarios inactivos).
    - Acceso autorizado exclusivo para perfiles operativos facultados (`Call Center` y `Administrador`).

- **Lógica de negocio y esquemas Zod (Módulo Incidentes):**
  - Esquema `ListarAvisosQuerySchema` en `src/modules/incidentes/schema.ts`:
    - Coerción numérica y validación de límites: `page` (entero $\ge 1$), `limit` (entero de 1 a 100).
    - Normalización de alias: soporte para `Calle-Calle` transformándolo automáticamente a `Calle Calle`.
    - Enums estrictos para `estado` (`PENDIENTE_VERIFICACION`, `NO_VERIFICADO`, `VERIFICADO`, `DESCARTADO`, `TODOS`) y canal `origen` (`WEB`, `CHATBOT`, `TELEFONO`).
    - Parámetros de búsqueda textual libre `busqueda` y `q` con longitud máxima sanitizada (`max(100)`).
  - DTOs en `src/modules/incidentes/types.ts`:
    - `AvisoItemDTO`: Inclusión de atributos calculados `delegacionNombre: string | null` y `minutosEnEspera: number`.
    - `PaginacionResultado`: Interfaz completa con metadatos de navegación (`total`, `totalPages`, `hasNext`, `hasPrev`, `message`).
  - Servicio `src/modules/incidentes/service.ts`:
    - Algoritmo `calcularMinutosEnEspera(creadoEn)` para cálculo reactivo en milisegundos con piso garantizado en 0 (`Math.max(0, ...)`).
    - Mapeo estricto del listado paginado sin pérdida de tipado estricto (eliminación completa de casts a `any`).
  - Asignación territorial automática al registrar nuevos reportes en `src/modules/incidentes/aviso-incidente.repository.ts` e `incidentes/repository.ts` basada en coincidencia de sectores urbanos de Valdivia (Niebla, Isla Teja, Las Ánimas, Collico, etc.).

- **Aseguramiento de Calidad:**
  - Suite de pruebas automatizadas en Vitest:
    - Fixtures deterministas con hooks `beforeAll` y `afterAll` en `src/app/api/incidentes/avisos/__tests__/route.test.ts` para aislamiento total en CI/CD.
    - Pruebas unitarias de esquemas y lógica de negocio en `src/modules/incidentes/__tests__/incidentes.test.ts`.
    - Pruebas de integración para todos los Criterios de Aceptación (CA-1 al CA-7), seguridad (401/403), validación de parámetros (400), orden por semáforo y escape de comodines LIKE en `src/app/api/incidentes/avisos/__tests__/route.test.ts`.
    - Total: 17 suites de pruebas y 151 tests pasando al 100%.
  - Linter sin errores ni advertencias (`npm run lint` -> 0 errors, 0 warnings).
  - Compilación de producción con Turbopack exitosa (`npm run build`).
  - Contrato OpenAPI v0.6.0 actualizado y expuesto en `/openapi.json` con registro de esquemas de entrada, cabeceras de seguridad y respuestas HTTP (200, 400, 401, 403).
  - Documentación técnica del módulo y reglas de negocio registrada en `/docs/api/incidentes.md`.

---

## Cómo Probar

1. **Ejecutar migraciones y suite de pruebas automatizadas:**
   ```bash
   npm run db:migrate
   npm test
   npm run lint
   npm run build
   ```

2. **Iniciar servidor en desarrollo:**
   ```bash
   npm run dev
   ```

3. **Verificar bloqueo no autenticado (`401 Unauthorized`):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos"
   ```
   *Respuesta esperada: HTTP 401 con mensaje `"Se requiere cabecera de autenticación X-User-Id."`.*

4. **Verificar bloqueo por rol no autorizado (`403 Forbidden`):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos" \
     -H "X-User-Id: 00000000-0000-4000-8000-000000000003"
   ```
   *Respuesta esperada: HTTP 403 con mensaje `"No cuenta con el permiso requerido: incidentes:avisos:leer"` (usuario Encargado sin permiso de bandeja).*

5. **Consulta general autenticada para Call Center (`200 OK`):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos" \
     -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
   ```
   *Respuesta esperada: HTTP 200 con listado de avisos pendientes ordenados por antigüedad y `delegacionNombre` mapeado.*

6. **Filtrar por delegación territorial simple (`200 OK` - CA-1):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos?delegacion=Norte" \
     -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
   ```
   *Respuesta esperada: HTTP 200 donde todos los elementos devueltos poseen `delegacionNombre: "Norte"`.*

7. **Normalización de delegación con formato guion (`200 OK` - CA-1):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos?delegacion=Calle-Calle" \
     -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
   ```
   *Respuesta esperada: HTTP 200 con registros normalizados a `"Calle Calle"`.*

8. **Filtrar por estado operativo pendiente (`200 OK` - CA-2):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos?estado=NO_VERIFICADO" \
     -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
   ```
   *Respuesta esperada: HTTP 200 retornando registros con estado `NO_VERIFICADO` o `PENDIENTE_VERIFICACION`.*

9. **Filtro multicriterio combinado simultáneo (`200 OK` - CA-3):**
   ```bash
   curl -i "http://localhost:3000/api/incidentes/avisos?delegacion=Norte&estado=NO_VERIFICADO&origen=WEB" \
     -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
   ```
   *Respuesta esperada: HTTP 200 aplicando la intersección lógica (AND) de los tres criterios.*

10. **Búsqueda textual libre y resistencia a comodines SQL (`200 OK`):**
    ```bash
    curl -i "http://localhost:3000/api/incidentes/avisos?busqueda=%25" \
      -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
    ```
    *Respuesta esperada: HTTP 200 con `data: []` y `total: 0` (busca el carácter literal `%` y no realiza volcado masivo).*

11. **Retorno seguro ante consulta sin coincidencias (`200 OK` - CA-5):**
    ```bash
    curl -i "http://localhost:3000/api/incidentes/avisos?delegacion=Inexistente" \
      -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
    ```
    *Respuesta esperada: HTTP 200 con `data: []`, `total: 0`, `totalPages: 1` (nunca 404 ni 500).*

12. **Validación de parámetros fuera de rango (`400 Bad Request` - CA-6):**
    ```bash
    curl -i "http://localhost:3000/api/incidentes/avisos?page=0&limit=500&estado=INVALIDO" \
      -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
    ```
    *Respuesta esperada: HTTP 400 con arreglo de errores Zod indicando `page > 0`, `limit <= 100` y enum `estado` no válido.*

13. **Enriquecimiento dinámico de tiempos de espera y delegación (`200 OK` - CA-7):**
    ```bash
    curl -i "http://localhost:3000/api/incidentes/avisos?estado=TODOS&limit=10" \
      -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
    ```
    *Respuesta esperada: HTTP 200 donde cada objeto retornado en `data` incluye el atributo `minutosEnEspera` (número entero $\ge 0$ calculado en tiempo real según la fecha de creación para alimentar el semáforo de urgencia del Call Center) y la propiedad `delegacionNombre: string | null` debidamente resuelta a partir de la relación territorial (`Norte`, `Sur`, `Costa`, `Calle Calle`).*

---

## Lista de Verificación

- [x] Cumple con directrices arquitectónicas del monolito modular en `GEMINI.md`.
- [x] Cumplimiento de todos los Criterios de Aceptación (CA-1 al CA-7) de HU-54.
- [x] Control de acceso RBAC estricto mediante cabecera `X-User-Id` y permiso `incidentes:avisos:leer`.
- [x] Sanitización completa contra inyección SQL y comodines `LIKE` (`%`, `_`).
- [x] Cálculo dinámico de `minutosEnEspera` y ordenamiento prioritario para semáforo de Call Center.
- [x] Paginación coherente (`total` y `totalPages` reflejan exactamente la búsqueda filtrada).
- [x] Pruebas automatizadas pasando al 100% (151/151 en Vitest).
- [x] Linter sin errores ni advertencias (`npm run lint`).
- [x] Compilación de producción exitosa (`npm run build`).
- [x] Contrato OpenAPI v0.6.0 actualizado y expuesto en `/openapi.json`.
- [x] Documentación técnica generada en `/docs/api/incidentes.md`.
- [x] Commits atómicos siguiendo la convención Conventional Commits.
- [ ] Pair Review aprobada por otro desarrollador.
- [ ] PO Review aprobada por el Product Owner.

---

## Incidencias Relacionadas

- Resolves sgrai-uach/docs#54
- Relacionado con Historia de Usuario HU-54 (sgrai-web: `feature/H54-filtrar-bandeja-call-center`)
