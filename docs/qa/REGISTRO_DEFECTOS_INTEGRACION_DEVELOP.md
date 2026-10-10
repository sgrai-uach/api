# Registro y Gestión de Defectos de Integración y Regresión (Post-Merge en Rama Develop) — SGRAI

Este documento formaliza el registro, seguimiento y certificación del ciclo de vida de los defectos detectados durante la **integración continua y pruebas de regresión** en la rama principal `develop`, tras la aprobación y merge de los Pull Requests (PRs) de las distintas historias de usuario del proyecto SGRAI (Dirección de Gestión de Riesgos de Desastres - Municipalidad de Valdivia).

El estándar aplicado se fundamenta en las directrices de aseguramiento de calidad de software **IEEE 829 / ISO/IEC/IEEE 29119**.

---

## 1. Ficha Técnica de Integración y Regresión

| Parámetro | Detalle |
|---|---|
| **Proyecto** | Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) |
| **Repositorios Auditados** | `sgrai-api` (Backend monolítico modular) / `sgrai-web` (Frontend de mando y operación) |
| **Rama Integrada** | `develop` |
| **Estrategia de Flujo Git** | Gitflow (Integración continua mediante Pull Requests con Pair Review y PO Review) |
| **Fase del Ciclo de Vida** | Post-Merge / Pruebas de Integración de Sistema (SIT) y Regresión Automatizada |
| **Entorno de Pruebas** | Local & CI (Node.js v20+, Next.js 15 Turbopack, PostgreSQL 16 + PostGIS, Redis, Vitest) |
| **Fecha de Monitoreo** | 29/09/2026 – 05/10/2026 |
| **Estado Global de Integración** | 🟢 **100% RESUELTO Y CERTIFICADO EN DEVELOP** |

---

## 2. Resumen Ejecutivo de Métricas de Integración

| Métrica | Valor | Observación |
|---|:---:|---|
| **Total Defectos Detectados Post-Merge** | **14** | Hallados en rama `develop` tras merges concurrentes de PRs |
| **Defectos Críticos / Bloqueantes** | **7** | Corrupción de migraciones BD, fallas de compilación y linter bloqueante |
| **Defectos Mayores** | **6** | Fallas en suites de pruebas unitarias/componentes y discrepancias de contrato OpenAPI |
| **Defectos de Severidad Media** | **1** | Infracción de estándar TypeScript (`any` explícito en hook) |
| **Defectos Resueltos y Verificados (Re-Test)** | **14** | 100% de los defectos cuentan con fix implementado y validado |
| **Tasa de Éxito de Cierre (Resolution Rate)** | **100%** | Rama `develop` compila limpiamente, pasa suites de test y migraciones sin error |

### Distribución por Dominio Afectado:
* **Base de Datos / Kysely / Migraciones:** 4 defectos (`BUG-INT-01`, `BUG-INT-08`, `BUG-INT-09`, `BUG-INT-12`)
* **API REST / Seguridad / OpenAPI:** 4 defectos (`BUG-INT-02`, `BUG-INT-06`, `BUG-INT-07`, `BUG-INT-11`, `BUG-INT-14`)
* **Frontend Web / Vitest / ESLint / React:** 5 defectos (`BUG-INT-03`, `BUG-INT-04`, `BUG-INT-05`, `BUG-INT-10`, `BUG-INT-13`)

---

## 3. Casos de Prueba de Integración Vinculados (CP-INT)

Los defectos fueron detectados durante la ejecución de los siguientes procedimientos estándar de verificación en `develop`:

* **`CP-INT-00 (Setup BD)`:** Verificación de inicialización de base de datos desde cero y aplicación secuencial de migraciones Kysely (`npm run db:migrate`).
* **`CP-INT-01 (Build API)`:** Compilación completa y generación de bundle del backend (`npm run build`).
* **`CP-INT-02 (Contrato OpenAPI)`:** Verificación de sincronización entre esquemas Zod, versión semántica y endpoint `GET /openapi.json`.
* **`CP-INT-03 (Lint Frontend)`:** Verificación de análisis estático de código y reglas de ESLint en sgrai-web (`npm run lint`).
* **`CP-INT-04 (Tests Componentes / Hooks)`:** Ejecución completa de suites de pruebas unitarias y de componentes con Vitest (`npm test`).
* **`CP-INT-05 (Auth Endpoints Protegidos)`:** Validación de flujo de autenticación JWT y extracción del token Bearer en endpoints de misiones y recursos.

---

## 4. Matriz Consolidada de Defectos de Integración (12 Columnas)

| ID Defecto | Caso Asociado | Severidad | Módulo Afectado | Descripción del Defecto | Pasos para Reproducir | Resultado Obtenido | Estado | Responsable Asignado | Fecha / Hora Detección | Fecha / Hora Re-Test | Solución / Commit |
|:---|:---|:---|:---|:---|:---|:---|:---:|:---|:---:|:---:|:---|
| **BUG-INT-01** | `CP-INT-00 (Setup BD)` | Bloqueante | Base de Datos / Kysely / API | Colisión y corrupción de migraciones al integrar ramas en develop: Existen múltiples archivos con numeración duplicada (002, 003, 004) y discrepancias en esquemas de tablas compartidas. | 1. Hacer checkout a rama develop.<br>2. Ejecutar `npm run db:migrate`. | Falla con Error: corrupted migrations. Impide levantar el backend desde cero. | **RESUELTO** | Arquitecto | 29/09/2026 17:50 | 30/09/2026 01:30 | Se realizó la corrección de esta corrupción en los archivos duplicados de migraciones, al igual que se estandarizó la base de datos. |
| **BUG-INT-02** | `CP-INT-01 (Build API)` | Bloqueante | API / Seguridad / Permisos | Colisión sintáctica al mergear PR #12 en develop: Constantes `PERMISO_KANBAN_INCIDENTES` y `PERMISO_CREAR_INCIDENTE_MANUAL` declaradas y exportadas dos veces. | 1. Situarse en develop de sgrai-api.<br>2. Ejecutar `npm run build` o `npm test`. | Turbopack y esbuild fallan con error crítico impidiendo compilar la API y haciendo fallar 9 suites de pruebas. | **RESUELTO** | Dev HU-5 | 01/10/2026 18:20 | 30/09/2026 19:10 | fix: duplicación en el módulo de permisos. Borré las 2 líneas repetidas al mergear (No me dio conflicto en el merge, pero sí al compilar). |
| **BUG-INT-03** | `CP-INT-04 (Tests Call Center)` | Mayor | Web / Call Center / AvisosFiltros | Falla de regresión en pruebas de AvisosFiltros tras merge de PR #12: Selectores de etiquetas no coinciden con labels del componente y falta jest-dom en configuración de pruebas. | 1. Situarse en develop de sgrai-web.<br>2. Ejecutar `npm test src/components/call_center/__tests__/AvisosFiltros.test.tsx`. | 8 pruebas fallan con *"Invalid Chai property: toBeInTheDocument"* y *"Unable to find a label with text of: dictador"*. | **RESUELTO** | Dev HU-54 | 01/10/2026 18:22 | 03/10/2026 14:48 | fix(qa): corregir setup de vitest con jest-dom y storage mock, y alinear selectores en pruebas de filtros [Commit `a492394` / Merge `05bca20`]. |
| **BUG-INT-04** | `CP-INT-04 (Tests Informante)` | Mayor | Web / Portal Informante / useChatbot | Entorno de pruebas Vitest no inicializa `localStorage` en Node.js, provocando falla general en la suite del hook `useChatbot`. | 1. Situarse en develop de sgrai-web.<br>2. Ejecutar `npm test src/hooks/useChatbot.test.ts`. | 14 pruebas fallan con *"TypeError: Cannot read properties of undefined (reading 'clear')"* en el `beforeEach`. | **RESUELTO** | QA | 01/10/2026 18:23 | 03/10/2026 14:48 | Se implementó polyfill/mock de Storage en `src/test/setup.ts` registrado en `setupFiles` de `vitest.config.ts` [Commit `a492394` / Merge `05bca20`]. |
| **BUG-INT-05** | `CP-INT-03 (Lint Frontend)` | Media | Web / Mapas / useLocationPickerMap | Infracción de estándar de calidad por uso de tipo `'any'` explícito en el hook de geolocalización. | 1. Situarse en develop de sgrai-web.<br>2. Ejecutar `npm run lint`. | Falla con código 1: *"Unexpected any. Specify a different type (@typescript-eslint/no-explicit-any)"* en línea 151:47. | **RESUELTO** | QA | 01/10/2026 18:24 | 30/09/2026 22:42 | fix(recursos): remover set-state sincrono en efecto y eliminar tipos any en pruebas y mapa [Commit `b31544a`]. |
| **BUG-INT-06** | `CP-INT-05 (Auth Misiones)` | Bloqueante | API / Misiones / Detalle Misión | Colisión de autenticación en `GET /api/misiones/[id]` tras merge de PR #18 sobre PR #13: El route handler ignora la cabecera `Authorization: Bearer` y solo lee `x-user-id`, rechazando con 401 a usuarios con sesión activa. | 1. Iniciar sesión en `/api/seguridad/login` con usuario Encargado o Admin.<br>2. Enviar `GET /api/misiones/[id]` con cabecera `Authorization: Bearer <token>`. | Falla con HTTP 401 Unauthorized: *"Se requiere cabecera de autenticación Authorization Bearer <token>"*. | **RESUELTO** | QA | 04/10/2026 17:23 | 04/10/2026 17:34 | fix(auth): unificar extracción de token JWT en misiones y recursos individuales tras merge de h17 y h8 [Commit `369e5e4` / Merge `375ae4f`]. |
| **BUG-INT-07** | `CP-INT-05 (Auth Recursos)` | Bloqueante | API / Recursos y Personal / Recursos | Falla de resolución de identidad en `GET` y `PUT /api/recursos/[id]` tras integración JWT: Helper local defectuoso asigna el token Bearer en bruto como UUID de usuario en lugar de decodificar el payload sub. | 1. Iniciar sesión como Administrador en `/api/seguridad/login`.<br>2. Enviar `GET` o `PUT /api/recursos/[id]` con `Authorization: Bearer <token>`. | Falla con HTTP 401 Unauthorized: *"Usuario con ID 'eyJhbGci...' no existe o no está registrado en el sistema"*. | **RESUELTO** | QA | 04/10/2026 17:25 | 04/10/2026 17:34 | fix(auth): reemplazar helper local por `extraerUsuarioDeToken()` oficial de `auth.guard` en route handlers de recursos [Commit `369e5e4` / Merge `375ae4f`]. |
| **BUG-INT-08** | `CP-INT-00 (Setup BD)` | Bloqueante | Base de Datos / Kysely / Migraciones | Colisión de migraciones tras integrar PRs de H13 y H57 en develop: Se introdujo el archivo duplicado `013_prevencion_riesgo_prioridad.ts` con misma numeración que índices KPIs e idéntico contenido a 012. | 1. Realizar `git pull` de develop tras merges remotos.<br>2. Revisar archivos en `src/lib/db/migrations/` o ejecutar `npm run db:migrate`. | Kysely ejecuta dos veces la misma definición de esquema bajo numeraciones 012 y 013 provocando inconsistencias en el historial de migraciones. | **RESUELTO** | Arquitecto / Equipo Backend | 04/10/2026 19:34 | 04/10/2026 19:36 | chore(db): eliminar archivo duplicado `013_prevencion_riesgo_prioridad.ts` y unificar correlatividad de Kysely [Commit `abc0789`]. |
| **BUG-INT-09** | `CP-INT-00 (Setup BD)` | Bloqueante | Base de Datos / Kysely / Migraciones | Corrupción de historial de migraciones en develop: La tabla `kysely_migration` registra la migración 015 (ejecutada desde rama H56 no mergeada), mientras que develop solo contiene hasta la 014. Kysely aborta con error al faltar el archivo en el código fuente. | 1. Situarse en develop de sgrai-api tras merges recientes.<br>2. Ejecutar `npm run db:migrate`. | Falla con código 1: *"Error: corrupted migrations: previously executed migration 015_prevencion_borrado_logico is missing"*. Impide migraciones automáticas en develop. | **RESUELTO** | DevOps / Backend | 05/10/2026 02:35 | 05/10/2026 02:40 | Se depuró el registro huérfano 015 de la tabla `kysely_migration` en BD local; develop queda alineado y validado en `014_recurso_borrado_logico`. |
| **BUG-INT-10** | `CP-INT-03 (Lint Frontend)` | Bloqueante | Web / Mando / IncidenteDetalle y MisionDetalle | Fallo de linter en sgrai-web tras merge a develop: Regla `react-hooks/set-state-in-effect` rechaza llamadas síncronas a `setCargando(true)` dentro del cuerpo de `useEffect` en `IncidenteDetalleDrawer.tsx` y `MisionDetalleModal.tsx`. | 1. Situarse en develop de sgrai-web.<br>2. Ejecutar `npm run lint`. | Falla con código 1: *"Calling setState synchronously within an effect can trigger cascading renders"* (2 errores bloqueantes de ESLint). | **RESUELTO** | Dev Frontend / QA | 05/10/2026 02:37 | 05/10/2026 14:35 | fix(mando): diferir `setState` con `queueMicrotask` en `IncidenteDetalleDrawer` y eliminar efecto huérfano en `MisionDetalleModal` [Commit `7c9c6c8` / Merge `19b56f8`]. |
| **BUG-INT-11** | `CP-INT-02 (Contrato OpenAPI)` | Mayor | API / OpenAPI / Seguridad y Versión | Desincronización de contrato OpenAPI en `GET /openapi.json`: La spec declaraba `info.version 0.7.0` (desactualizada respecto a 0.8.0 de `package.json`) y documentaba cabecera `x-user-id` en endpoints protegidos que en runtime exigen token JWT Bearer. | 1. Consultar `GET /openapi.json` y revisar versión y headers de `/puntos-criticos` y `/api/incidentes/{id}`.<br>2. Enviar petición con `x-user-id` según documentación OpenAPI. | Backend responde HTTP 401 Unauthorized requiriendo `Authorization: Bearer <token>`, discrepando del contrato publicado en OpenAPI. | **RESUELTO** | Dev Backend / Arquitecto | 05/10/2026 02:38 | 05/10/2026 14:36 | docs(openapi): actualizar info version a 0.8.0 y unificar esquemas de seguridad y endpoints de H29 y H56 [Merge `b445a0e`]. |
| **BUG-INT-12** | `CP-INT-00 (Setup BD)` | Bloqueante | Base de Datos / Kysely / Migraciones | Colisión de prefijos y corrupción de correlatividad en migraciones tras merge de ramas H50 y H28: Ambas ramas introdujeron migración con prefijo numérico 018 en develop. | 1. Situarse en develop de sgrai-api tras merges recientes.<br>2. Ejecutar `npm run db:migrate`. | Falla con código 1: *"Error: corrupted migrations: previously executed migration... / duplicate prefix 018"*. | **RESUELTO** | DevOps / Backend | 05/10/2026 14:40 | 05/10/2026 14:55 | fix(db): renumerar migración supervisor a 018 y migración asistencia social a 019 garantizando secuencia lineal en Kysely. |
| **BUG-INT-13** | `CP-INT-03 (Lint Frontend)` | Bloqueante | Web / Mando / MapaOperativoMando | Fallo de linter en sgrai-web tras merge de PR #23 (H29/H30): Uso de `'any'` explícito en prop `eventosPrevencion` viola regla `@typescript-eslint/no-explicit-any` en `MapaOperativoMando.tsx` y `MapaOperativoMandoInner.tsx`. | 1. Situarse en develop de sgrai-web.<br>2. Ejecutar `npm run lint`. | Falla con código 1: *"Unexpected any. Specify a different type @typescript-eslint/no-explicit-any"* (2 errores bloqueantes). | **RESUELTO** | Dev Frontend / QA | 05/10/2026 14:41 | 05/10/2026 15:09 | fix(mando): reemplazar tipo any por unknown en prop `eventosPrevencion` en componentes de mapa operativo [Commit `4bd6261` / Merge `9778f7f`]. |
| **BUG-INT-14** | `CP-INT-02 (Contrato OpenAPI)` | Mayor | API / OpenAPI / Puntos Críticos | Declaración duplicada de ruta `GET /api/puntos-criticos` en el registro de OpenAPI: Merges concurrentes registraron la misma ruta dos veces en el generador de especificación. | 1. Consultar `src/lib/openapi/index.ts` tras merges en develop.<br>2. Ejecutar `curl -s http://localhost:3000/openapi.json`. | Aparecía dos veces la definición de la misma ruta en `paths['/api/puntos-criticos']`, generando advertencias de duplicidad en parsers OpenAPI. | **RESUELTO** | Dev Backend / QA | 05/10/2026 14:42 | 05/10/2026 14:55 | fix(openapi): remover registro duplicado de `GET /api/puntos-criticos` y armonizar tags de Swagger. |

---

## 5. Detalle Técnico de Resolución y Ciclo de Re-Test

### `BUG-INT-01`: Corrupción y colisión de correlativos en migraciones Kysely
* **Causa Raíz:** Integración paralela de ramas tempranas generando archivos duplicados `002_`, `003_` y `004_` con tablas de incidentes y personal definidas de forma inconsistente.
* **Acción de Solución:** Estandarización de las migraciones base en un histórico limpio y lineal (`001_initial_schema.ts` a `006_recursos_y_operaciones.ts`), restableciendo la base de datos de desarrollo.
* **Resultado del Re-Test:** `npm run db:migrate` ejecuta de 0 a fin sin colisiones.

### `BUG-INT-02`: Duplicación sintáctica de constantes de permisos
* **Causa Raíz:** Git resolvió el merge del PR #12 sin marcar conflicto textual pero duplicó las sentencias de exportación de constantes.
* **Acción de Solución:** Eliminación de las líneas duplicadas en el archivo de constantes de permisos del módulo de seguridad.
* **Resultado del Re-Test:** Compilación `npm run build` exitosa en Turbopack sin errores de símbolos redeclarados.

### `BUG-INT-03`: Falla de selectores y ausencia de `jest-dom` en pruebas de Call Center
* **Causa Raíz:** Componente `AvisosFiltros` cambió sus etiquetas de accesibilidad y el entorno de pruebas carecía de los matchers de Testing Library.
* **Acción de Solución:** Inclusión de `@testing-library/jest-dom` en `vitest.config.ts` y alineación de selectores `getByRole` y `getByLabelText`.
* **Resultado del Re-Test:** 8/8 pruebas de filtros pasando exitosamente.

### `BUG-INT-04`: Falla de inicialización de `localStorage` en tests de Chatbot
* **Causa Raíz:** En entorno Node.js, `window.localStorage` es `undefined`, lo que provocaba excepción no capturada en `beforeEach` del hook `useChatbot`.
* **Acción de Solución:** Implementación de un mock completo de `Storage` en `src/test/setup.ts` inyectado automáticamente en cada suite.
* **Resultado del Re-Test:** 14/14 pruebas unitarias de `useChatbot` aprobadas.

### `BUG-INT-05` & `BUG-INT-13`: Violación de estándar TypeScript por tipo `any` explícito
* **Causa Raíz:** Merges rápidos sin correr linter estricto introdujeron firmas con `: any` en `useLocationPickerMap` y `MapaOperativoMando`.
* **Acción de Solución:** Sustitución por tipos estrictos de dominio (`Coordenadas`, `EventoPrevencion[]`) y `unknown` con type guards según estándar de ESLint.
* **Resultado del Re-Test:** `npm run lint` finaliza con 0 advertencias y 0 errores.

### `BUG-INT-06` & `BUG-INT-07`: Colisiones y desalineación en guardias de autenticación JWT
* **Causa Raíz:** Fusión de código antiguo de pruebas (que leía `x-user-id`) con los route handlers oficiales de recursos y misiones que requieren validación de firma JWT.
* **Acción de Solución:** Adopción obligatoria y homogénea de la función utilitaria `extraerUsuarioDeToken()` proveniente de `auth.guard.ts`.
* **Resultado del Re-Test:** Peticiones HTTP con `Authorization: Bearer <token>` resuelven identidad y permisos RBAC con precisión.

### `BUG-INT-08`, `BUG-INT-09` & `BUG-INT-12`: Conflictos de correlatividad y registros huérfanos en migraciones
* **Causa Raíz:** Ramas concurrentes (`feature/H13`, `feature/H57`, `feature/H50`, `feature/H28`) asignaron de forma descoordinada los correlativos `013`, `015` y `018`.
* **Acción de Solución:** 
  1. Depuración del registro fantasma `015` en `kysely_migration`.
  2. Eliminación del duplicado `013_prevencion_riesgo_prioridad.ts`.
  3. Renumeración secuencial definitiva: `017_` (Índices y KPIs), `018_` (Supervisor), `019_` (Asistencia Social).
* **Resultado del Re-Test:** Migrador Kysely ejecuta en orden estricto sin saltos ni abortos.

### `BUG-INT-10`: Efectos cascada por `setState` síncrono en cuerpo de `useEffect`
* **Causa Raíz:** Componentes de detalle llamaban a `setCargando(true)` síncronamente al montar, violando la regla `react-hooks/set-state-in-effect`.
* **Acción de Solución:** Diferimiento de la actualización de estado utilizando `queueMicrotask` y remoción de variables de estado redundantes.
* **Resultado del Re-Test:** Validación de ESLint y renderizado de drawers sin flickering.

### `BUG-INT-11` & `BUG-INT-14`: Desincronización y duplicidad en contrato OpenAPI
* **Causa Raíz:** La especificación pública `/openapi.json` quedó anclada a la versión `0.7.0` y registró dos veces el endpoint de puntos críticos tras merge cruzado.
* **Acción de Solución:** Sincronización de `info.version` con `package.json` (`0.8.0`), corrección del esquema de seguridad `bearerAuth` y eliminación de ruta repetida en el builder Zod OpenAPI.
* **Resultado del Re-Test:** Contrato OpenAPI validado y consumible por herramientas cliente.

---

## 6. Bloque TSV (Exportable a Hojas de Cálculo / Google Sheets)

```tsv
ID Defecto	Caso Asociado	Severidad	Módulo Afectado	Descripción del Defecto	Pasos para Reproducir	Resultado Obtenido	Estado	Responsable Asignado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-INT-01	CP-INT-00 (Setup BD)	Bloqueante	Base de Datos / Kysely / API	Colisión y corrupción de migraciones al integrar ramas en develop: Existen múltiples archivos con numeración duplicada (002, 003, 004) y discrepancias en esquemas de tablas compartidas.	1. Hacer checkout a rama develop. 2. Ejecutar npm run db:migrate.	Falla con Error: corrupted migrations. Impide levantar el backend desde cero.	RESUELTO	Arquitecto	29/09/2026 17:50	30/09/2026 01:30	Se realizó la corrección de esta corrupción en los archivos duplicados de migraciones, al igual que se estandarizó la base de datos.
BUG-INT-02	CP-INT-01 (Build API)	Bloqueante	API / Seguridad / Permisos	Colisión sintáctica al mergear PR #12 en develop: Constantes PERMISO_KANBAN_INCIDENTES y PERMISO_CREAR_INCIDENTE_MANUAL declaradas y exportadas dos veces.	1. Situarse en develop de sgrai-api. 2. Ejecutar npm run build o npm test.	Turbopack y esbuild fallan con error crítico impidiendo compilar la API y haciendo fallar 9 suites de pruebas.	RESUELTO	Dev HU-5	01/10/2026 18:20	30/09/2026 19:10	fix: duplicación en el módulo de permisos. Borré las 2 líneas repetidas al mergear (No me dio conflicto en el merge, pero sí al compilar)
BUG-INT-03	CP-INT-04 (Tests Call Center)	Mayor	Web / Call Center / AvisosFiltros	Falla de regresión en pruebas de AvisosFiltros tras merge de PR #12: Selectores de etiquetas no coinciden con labels del componente y falta jest-dom en configuración de pruebas.	1. Situarse en develop de sgrai-web. 2. Ejecutar npm test src/components/call_center/__tests__/AvisosFiltros.test.tsx	8 pruebas fallan con "Invalid Chai property: toBeInTheDocument" y "Unable to find a label with text of: dictador"	RESUELTO	Dev HU-54	01/10/2026 18:22	03/10/2026 14:48	fix(qa): corregir setup de vitest con jest-dom y storage mock, y alinear selectores en pruebas de filtros [Commit a492394 / Merge 05bca20]
BUG-INT-04	CP-INT-04 (Tests Informante)	Mayor	Web / Portal Informante / useChatbot	Entorno de pruebas Vitest no inicializa localStorage en Node.js, provocando falla general en la suite del hook useChatbot.	1. Situarse en develop de sgrai-web. 2. Ejecutar npm test src/hooks/useChatbot.test.ts	14 pruebas fallan con "TypeError: Cannot read properties of undefined (reading 'clear')" en el beforeEach.	RESUELTO	QA	01/10/2026 18:23	03/10/2026 14:48	Se implementó polyfill/mock de Storage en src/test/setup.ts registrado en setupFiles de vitest.config.ts (Commit a492394 / Merge 05bca20)
BUG-INT-05	CP-INT-03 (Lint Frontend)	Media	Web / Mapas / useLocationPickerMap	Infracción de estándar de calidad por uso de tipo 'any' explícito en el hook de geolocalización.	1. Situarse en develop de sgrai-web. 2. Ejecutar npm run lint.	Falla con código 1: "Unexpected any. Specify a different type (@typescript-eslint/no-explicit-any)" en línea 151:47.	RESUELTO	QA	01/10/2026 18:24	30/09/2026 22:42	fix(recursos): remover set-state sincrono en efecto y eliminar tipos any en pruebas y mapa (Commit b31544a)
BUG-INT-06	CP-INT-05 (Auth Misiones)	Bloqueante	API / Misiones / Detalle Misión	Colisión de autenticación en GET /api/misiones/[id] tras merge de PR #18 sobre PR #13: El route handler ignora la cabecera 'Authorization: Bearer' y solo lee 'x-user-id', rechazando con 401 a usuarios con sesión activa.	1. Iniciar sesión en /api/seguridad/login con usuario Encargado o Admin. 2. Enviar GET /api/misiones/[id] con cabecera Authorization: Bearer <token>.	Falla con HTTP 401 Unauthorized: "Se requiere cabecera de autenticación Authorization Bearer <token>".	RESUELTO	QA	04/10/2026 17:23	04/10/2026 17:34	fix(auth): unificar extraccion de token jwt en misiones y recursos individuales tras merge de h17 y h8 (Commit 369e5e4 / Merge 375ae4f)
BUG-INT-07	CP-INT-05 (Auth Recursos)	Bloqueante	API / Recursos y Personal / Recursos	Falla de resolución de identidad en GET y PUT /api/recursos/[id] tras integración JWT: Helper local defectuoso asigna el token Bearer en bruto como UUID de usuario en lugar de decodificar el payload sub.	1. Iniciar sesión como Administrador en /api/seguridad/login. 2. Enviar GET o PUT /api/recursos/[id] con Authorization: Bearer <token>.	Falla con HTTP 401 Unauthorized: "Usuario con ID 'eyJhbGci...' no existe o no está registrado en el sistema".	RESUELTO	QA	04/10/2026 17:25	04/10/2026 17:34	fix(auth): reemplazar helper local por extraerUsuarioDeToken() oficial de auth.guard en route handlers de recursos (Commit 369e5e4 / Merge 375ae4f)
BUG-INT-08	CP-INT-00 (Setup BD)	Bloqueante	Base de Datos / Kysely / Migraciones	Colisión de migraciones tras integrar PRs de H13 y H57 en develop: Se introdujo el archivo duplicado 013_prevencion_riesgo_prioridad.ts con misma numeración que índices kpis e idéntico contenido a 012.	1. Realizar git pull de develop tras merges remotos. 2. Revisar archivos en src/lib/db/migrations/ o ejecutar npm run db:migrate.	Kysely ejecuta dos veces la misma definición de esquema bajo numeraciones 012 y 013 provocando inconsistencias en el historial de migraciones.	RESUELTO	Arquitecto / Equipo Backend	04/10/2026 19:34	04/10/2026 19:36	chore(db): eliminar archivo duplicado 013_prevencion_riesgo_prioridad.ts y unificar correlatividad de Kysely [Commit abc0789]
BUG-INT-09	CP-INT-00 (Setup BD)	Bloqueante	Base de Datos / Kysely / Migraciones	Corrupción de historial de migraciones en develop: La tabla kysely_migration registra la migración 015 (ejecutada desde rama H56 no mergeada), mientras que develop solo contiene hasta la migración 014. Kysely aborta con error al faltar el archivo en el código fuente.	1. Situarse en develop de sgrai-api tras merges recientes. 2. Ejecutar npm run db:migrate.	Falla con código 1: 'Error: corrupted migrations: previously executed migration 015_prevencion_borrado_logico is missing'. Impide migraciones automáticas en develop.	RESUELTO	DevOps / Backend	05/10/2026 02:35	05/10/2026 02:40	Se depuró el registro huérfano 015 de la tabla kysely_migration en BD local; develop queda alineado y validado en 014_recurso_borrado_logico.
BUG-INT-10	CP-INT-03 (Lint Frontend)	Bloqueante	Web / Mando / IncidenteDetalle y MisionDetalle	Fallo de linter en sgrai-web tras merge a develop: Regla react-hooks/set-state-in-effect rechaza llamadas sincronas a setCargando(true) dentro del cuerpo de useEffect en IncidenteDetalleDrawer.tsx y MisionDetalleModal.tsx.	1. Situarse en develop de sgrai-web. 2. Ejecutar npm run lint.	Falla con código 1: "Calling setState synchronously within an effect can trigger cascading renders" (2 errores bloqueantes de ESLint).	RESUELTO	Dev Frontend / QA	05/10/2026 02:37	05/10/2026 14:35	fix(mando): diferir setState con queueMicrotask en IncidenteDetalleDrawer y eliminar efecto huérfano en MisionDetalleModal [Commit 7c9c6c8 / Merge 19b56f8]
BUG-INT-11	CP-INT-02 (Contrato OpenAPI)	Mayor	API / OpenAPI / Seguridad y Versión	Desincronización de contrato OpenAPI en GET /openapi.json: La spec declaraba info.version 0.7.0 (desactualizada respecto a 0.8.0 de package.json) y documentaba cabecera x-user-id en endpoints protegidos que en runtime exigen token JWT Bearer.	1. Consultar GET /openapi.json y revisar versión y headers de /puntos-criticos y /api/incidentes/{id}. 2. Enviar petición con x-user-id según documentación OpenAPI.	Backend responde HTTP 401 Unauthorized requiriendo Authorization: Bearer <token>, discrepando del contrato publicado en OpenAPI.	RESUELTO	Dev Backend / Arquitecto	05/10/2026 02:38	05/10/2026 14:36	docs(openapi): actualizar info version a 0.8.0 y unificar esquemas de seguridad e endpoints de H29 y H56 (Merge b445a0e)
BUG-INT-12	CP-INT-00 (Setup BD)	Bloqueante	Base de Datos / Kysely / Migraciones	Colisión de prefijos y corrupción de correlatividad en migraciones tras merge de ramas H50 y H28: Ambas ramas introdujeron migración con prefijo numérico 018 en develop.	1. Situarse en develop de sgrai-api tras merges recientes. 2. Ejecutar npm run db:migrate.	Falla con código 1: "Error: corrupted migrations: previously executed migration... / duplicate prefix 018".	RESUELTO	DevOps / Backend	05/10/2026 14:40	05/10/2026 14:55	fix(db): renumerar migración supervisor a 018 y migración asistencia social a 019 garantizando secuencia lineal Kysely
BUG-INT-13	CP-INT-03 (Lint Frontend)	Bloqueante	Web / Mando / MapaOperativoMando	Fallo de linter en sgrai-web tras merge de PR #23 (H29/H30): Uso de 'any' explícito en prop eventosPrevencion viola regla @typescript-eslint/no-explicit-any en MapaOperativoMando.tsx y MapaOperativoMandoInner.tsx.	1. Situarse en develop de sgrai-web. 2. Ejecutar npm run lint.	Falla con código 1: "Unexpected any. Specify a different type @typescript-eslint/no-explicit-any" (2 errores bloqueantes).	RESUELTO	Dev Frontend / QA	05/10/2026 14:41	05/10/2026 15:09	fix(mando): reemplazar tipo any por unknown en prop eventosPrevencion en componentes de mapa operativo [Commit 4bd6261 / Merge 9778f7f]
BUG-INT-14	CP-INT-02 (Contrato OpenAPI)	Mayor	API / OpenAPI / Puntos Críticos	Declaración duplicada de ruta GET /api/puntos-criticos en el registro de OpenAPI: Merges concurrentes registraron la misma ruta dos veces en el generador de especificación.	1. Consultar src/lib/openapi/index.ts tras merges en develop. 2. Ejecutar curl -s http://localhost:3000/openapi.json.	Aparecía dos veces la definición de la misma ruta en paths['/api/puntos-criticos'], generando advertencias de duplicidad en parsers OpenAPI.	RESUELTO	Dev Backend / QA	05/10/2026 14:42	05/10/2026 14:55	fix(openapi): remover registro duplicado de GET /api/puntos-criticos y armonizar tags de Swagger
```

---

## 7. Dictamen Final de QA de Integración (QA Sign-Off)

Tras la detección, aislamiento, corrección y re-test formal de los 14 defectos de integración post-merge en la rama `develop`:

1. **Estabilidad del Monolito Backend:** La base de datos relacional PostgreSQL + PostGIS aplica sus 19 migraciones en orden correlativo estricto sin colisiones. Las rutas de la API compilan y responden bajo esquemas Zod y especificación OpenAPI 3.0 coherente.
2. **Robustez del Frontend:** El portal web compila limpiamente, cumple el 100% de las reglas estrictas de ESLint y pasa todas las suites de pruebas unitarias y de componentes de Vitest con soporte a `localStorage` y `jest-dom`.
3. **Control de Regresión:** Ninguno de los defectos documentados persiste en la rama `develop`.

**Dictamen QA:** 🟢 **RAMA DEVELOP INTEGRADA, ESTABILIZADA Y CERTIFICADA (100% APROBADA).**
