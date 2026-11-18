# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-32 — Asignar Patrulla y Recursos Logísticos a Evento de Recuperación (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Eventos ATP / Recuperación (Sección de Operaciones y Logística ICS — Despacho Operativo y Control de Inventario Híbrido).  
> **Historia de Usuario:** HU-32 — *"Como Encargado Quiero asignar patrullas y recursos logísticos a eventos de recuperación comunal para coordinar las labores post-emergencia. Para mantener el control centralizado de los equipos y materiales destinados a la mitigación y apoyo posterior a desastres en los sectores afectados."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H32-asignar-recursos-recuperacion`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(db): migracion 035 y tipos kysely agregando mision_id a recuperacion_recurso (HU-32)`  
> * `feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32)`  
> * `feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)`  
> * `feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)`  
> * `test(eventos-atp): pruebas unitarias y de integracion para asignacion de recuperacion (HU-32)`  
> * `docs(api): documentar endpoints de recuperacion y eventos websocket en tiempo real (HU-32)`  
> * `chore(db): renumerar migracion a 041_recuperacion_recurso_mision_id (HU-32)`  
> * `fix(patrullas): eliminar duplicados y preservar paginacion exacta en GET /api/patrullas`  
> * `feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente`  
> * `test(eventos-atp): actualizar pruebas de listado y detalle de recuperacion`  
> * `chore(seed): agregar script seed-recuperacion y documentar GET /api/eventos-atp/recuperacion`  
> * `merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion`  
>  
> **Fecha de Auditoría Inicial:** 16/11/2026 23:50.  
> **Fecha de Re-Test:** 18/11/2026.  
> **Estado de Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS DE LOS 7 DEFECTOS)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras efectuar la inspección forense del código fuente en la rama `feature/H32-asignar-recursos-recuperacion`, la validación de transacciones ACID y control de concurrencia en Kysely/PostgreSQL, la verificación del ciclo de vida del Sistema de Comando de Incidentes (ICS), la revisión del protocolo de inventario híbrido (§3.6), el contraste contra el comportamiento en tiempo real por Redis Pub/Sub y la ejecución tanto de pruebas automatizadas en Vitest como de compilación y análisis estático, se subsanaron y verificaron satisfactoriamente los **7 defectos detectados en la auditoría** (`BUG-H32-API-01` a `BUG-H32-API-07`).

| Métrica de Calidad | Resultado Re-Test (18/11/2026) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **26** | 7 Defectos Corregidos (`BUG-H32-API-01` a `07`) + 19 Casos de Contrato, RBAC, Negocio, HTTP y Build (`CP-H32-API-01` a `19`) |
| **Casos Aprobados (Passed)** | **26** | 100% de los casos aprobados tras subsanar los 7 defectos |
| **Defectos Abiertos (`ABIERTO`)** | **0** | Todos los defectos subsanados y certificados |
| **Casos Bloqueados (`BLOQUEADO`)** | **0** | Bloqueo de migración superado tras sincronización con develop |
| **Tasa de Aprobación Global (% Pass)** | **100%** | 26 aprobados de 26 registros en matriz (`26/26`) |
| **Suite Completa del Repositorio (Vitest)** | **875/875 tests pass** | 75 archivos de prueba con mocks unitarios y contratos (0 fallos) |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | **0 errores** | `npx tsc --noEmit`: 0 errores; `npm run lint`: 0 errores y 0 advertencias |
| **Compilación de Producción (`npm run build`)** | **Exitosa** | Next.js 16.3.4 Turbopack compila todas las rutas, incluyendo HU-32 |
| **Ejecución de Migraciones Kysely** | 🟢 **Exitosa** | Sincronización limpia con `develop`, migración `041_` compatible y `allowUnorderedMigrations: true` asegurado |

---

## 2. Registro Técnico de Defectos Detectados y Certificados en Re-Test

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H32-API-01` | **Condición de carrera TOCTOU en `patrulla_verificadora` y `recuperacion` (Doble despacho concurrente):** `buscarPatrullaPorId` y `buscarRecuperacionPorId` no usaban `.forUpdate()`, y `actualizarEstadoPatrulla` actualizaba sin validar `.where("estado", "=", "DISPONIBLE")` ni filas afectadas, permitiendo doble despacho concurrente de la misma patrulla. | Crítica | `src/modules/eventos-atp/recuperacion.repository.ts`, `recuperacion.service.ts` | 18/11/2026 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 | 🟢 CORREGIDO (Bloqueo pesimista `forUpdate()` en lectura y `UPDATE` atómico condicionado con `returning` que arroja `PatrullaNoDisponibleError` HTTP 409 ante conflicto) |
| `BUG-H32-API-02` | **Colisión de correlativos concurrentes en generación de códigos (`MIS-` y `REC-`):** Se utilizaba `count(*)::int + 1` sin advisory locks transaccionales, causando colisiones de clave duplicada (`23505`) ante peticiones concurrentes o secuencias con huecos. | Alta | `src/modules/eventos-atp/recuperacion.repository.ts` | 18/11/2026 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 | 🟢 CORREGIDO (`pg_advisory_xact_lock` con `mision_codigo_seq` y `recuperacion_codigo_seq` parseando sufijo numérico máximo) |
| `BUG-H32-API-03` | **Violación regla §3.6 en activos individuales y corrupción de `cantidad_en_uso`:** Se omitía validar saldo disponible (`inventario - en_uso >= 1`), y se forzaba `cantidad_en_uso: 1` destruyendo el conteo en activos con dotación múltiple (ej. motosierras). | Crítica | `src/modules/eventos-atp/recuperacion.service.ts`, `recuperacion.repository.ts` | 18/11/2026 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 | 🟢 CORREGIDO (Validación de unidades disponibles $\ge 1$, incremento dinámico `en_uso + 1` y transición condicional a `ASIGNADO` / `BAJO_STOCK` / `DISPONIBLE`) |
| `BUG-H32-API-04` | **Invariantes ICS de misión y mutación errónea de `personal.disponible_terreno`:** `insertarMisionRecuperacion` seteaba `fecha_inicio: new Date()` en estado `DESPACHADA` y no registraba el hito en `mision_hito`. Además, se alteraba `personal.disponible_terreno = false` rompiendo la disponibilidad del brigadista para otras operaciones. | Alta | `src/modules/eventos-atp/recuperacion.repository.ts`, `recuperacion.service.ts` | 18/11/2026 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 | 🟢 CORREGIDO (`fecha_inicio: null`, registro del hito inicial `'DESPACHADA'` en `mision_hito` y preservación íntegra de `personal.disponible_terreno`) |
| `BUG-H32-API-05` | **Broadcast multi-sala incompleto en Redis y formato snake_case en payload:** `emitirRecuperacionActualizada` solo publicaba a `"sala:encargados"` vía Redis (omitiendo `"encargado"` y `"mapa"`). `emitirRecursoActualizado` solo a `"encargado"` (omitiendo `"supervisor"`). Además, el payload del recurso se emitía en snake_case sin `cantidadDisponible`. | Media | `src/lib/socket/index.ts`, `recuperacion.service.ts` | 18/11/2026 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 | 🟢 CORREGIDO (Difusión en abanico a todas las salas operativas en Redis y payload mapeado a camelCase con `cantidadDisponible`) |
| `BUG-H32-API-06` | **Discrepancias en contrato OpenAPI y documentación técnica:** Versión desalineada con `package.json`, presencia de `x-user-id` en cabeceras documentadas en lugar de `BearerAuth`, y ausencia de aserciones de rutas HU-32 en el test de OpenAPI. | Media | `src/lib/openapi/index.ts`, `docs/api/eventos-atp.md`, `src/app/openapi.json/__tests__/route.test.ts` | 18/11/2026 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 | 18/11/2026 | 🟢 CORREGIDO (`BearerAuth` estandarizado, version `0.12.0`, `x-user-id` retirado de los endpoints y aserciones incorporadas en suite de test) |
| `BUG-H32-API-07` | **Fusión con `develop` y compatibilidad de migraciones:** Riesgo de divergencia con nuevas migraciones (`035_`, `042_`, `061_`, `071_`) y bump a `0.12.0`. | Alta | `package.json`, `src/lib/db/migrator.ts`, `src/lib/db/migrations/041_recuperacion_recurso_mision_id.ts` | 18/11/2026 | merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion | 18/11/2026 | 🟢 CORREGIDO (`develop` integrado sin conflictos, migración 041 sin colisión y `allowUnorderedMigrations: true` asegurado) |

---

### `BUG-H32-API-01`: Condición de Carrera TOCTOU sobre `patrulla_verificadora` y `recuperacion` sin `FOR UPDATE` ni Condición Atómica `.where("estado", "=", "DISPONIBLE")`
* **Severidad:** **CRÍTICA** (Integridad Transaccional y Control de Concurrencia ICS).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 62-70, 188-200, 235-259)
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 254-275, 384)
* **Descripción Técnica:**
  Aunque `obtenerRecursosParaBloqueo` aplica `.forUpdate()` sobre `recurso`, las lecturas iniciales de la patrulla (`buscarPatrullaPorId`) y del evento de recuperación (`buscarRecuperacionPorId`) se ejecutan mediante `SELECT` sin `.forUpdate()`. Adicionalmente, `actualizarEstadoPatrulla` ejecuta `UPDATE patrulla_verificadora SET estado = 'EN_RECUPERACION' WHERE id = $1` sin validar `.where("estado", "=", "DISPONIBLE")` ni verificar filas afectadas, y sin actualizar `actualizado_en`.
* **Pasos para Reproducir:**
  1. Disponer de una patrulla verificadora en estado `DISPONIBLE` y dos eventos de recuperación activos (`EVENTO_A` y `EVENTO_B`) con recursos logísticos distintos (`RECURSO_A` y `RECURSO_B`).
  2. Enviar concurrentemente dos peticiones `POST /api/eventos-atp/recuperacion/{id}/asignar` (una hacia `EVENTO_A` y otra hacia `EVENTO_B`) con el mismo `patrullaId`.
  3. También reproducible ejecutando `POST /api/eventos-atp/recuperacion/{id}/asignar` en paralelo con `POST /api/misiones` (HU-20) sobre la misma patrulla.
* **Comportamiento Actual vs Esperado:**
  * *Actual:* Bajo aislamiento `READ COMMITTED`, ambas transacciones leen `patrulla.estado === 'DISPONIBLE'`, no compiten por el mismo bloqueo en `recurso` y ambas realizan el commit, generando dos misiones activas simultáneas asignadas a una única patrulla.
  * *Esperado:* La primera transacción bloquea la fila de `patrulla_verificadora` y actualiza atómicamente `WHERE estado = 'DISPONIBLE' AND eliminado_en IS NULL AND activo = true`; la segunda detecta el cambio de estado y aborta con `HTTP 409 Conflict`.
* **Corrección Sugerida:**
  Incorporar `.forUpdate()` en `buscarPatrullaPorId` (cuando se invoca dentro de una transacción de asignación) y `buscarRecuperacionPorId`, y condicionar `actualizarEstadoPatrulla` con `.where("estado", "=", "DISPONIBLE").where("eliminado_en", "is", null).where("activo", "=", true).returning(["id"])`, actualizando `actualizado_en: new Date()` y lanzando `PatrullaNoDisponibleError` si no retorna fila (siguiendo el patrón de `crearMisionVerificacionRepo` en `src/modules/misiones/mision.repository.ts:405-434`).

---

### `BUG-H32-API-02`: Colisión Concurrente (`23505` -> `HTTP 500`) y Falla ante Códigos No Contiguos en `generarSiguienteCodigoMision` y `generarSiguienteCodigoRecuperacion`
* **Severidad:** **ALTA** (Integridad de Datos y Concurrencia en Base de Datos).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivo Afectado:** `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 34-60).
* **Descripción Técnica:**
  `generarSiguienteCodigoMision` calcula el código institucional `MIS-YYYY-NNNN` ejecutando `SELECT count(*)::int AS total FROM mision WHERE codigo LIKE 'MIS-YYYY-%'` sin ningún bloqueo consultivo transaccional (`pg_advisory_xact_lock`).
* **Pasos para Reproducir:**
  1. Ejecutar dos despachos simultáneos a `POST /api/eventos-atp/recuperacion/{id}/asignar` (o uno concurrente con `POST /api/misiones`) sobre eventos y patrullas diferentes.
  2. Alternativamente, ejecutar `npm run seed:recuperacion` (que inserta `MIS-2026-0101..0104`) o registrar códigos no contiguos (ej. tras borrados o pruebas con saltos) y realizar asignaciones hasta que `count(*) + 1` coincida con un código existente.
* **Comportamiento Actual vs Esperado:**
  * *Actual:* Dos transacciones concurrentes obtienen el mismo `count(*)`, generan idéntico `codigo` y una falla por violación de clave única `mision_codigo_key` (`23505`), devolviendo `HTTP 500 Internal Server Error`. Con numeraciones con huecos, `count(*) + 1` colisiona repetidamente con códigos ya registrados.
  * *Esperado:* Generación serializada mediante `pg_advisory_xact_lock` calculando el siguiente correlativo a partir del máximo numérico (`ORDER BY codigo DESC LIMIT 1`), idéntico al mecanismo de `src/modules/misiones/mision.repository.ts:437-458`.
* **Corrección Sugerida:**
  Adquirir `await sql\`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))\`.execute(trx)` y consultar la última fila ordenada por `codigo DESC LIMIT 1` para incrementar el mayor correlativo del año en curso (y aplicar el mismo criterio para `recuperacion_codigo_seq` en `generarSiguienteCodigoRecuperacion`).

---

### `BUG-H32-API-03`: Regla §3.6 — Omisión de Verificación de Saldo Libre (`inventario - en_uso >= 1`) y Corrupción de `cantidad_en_uso` en Activos Individuales (`es_individual = true`)
* **Severidad:** **ALTA** (Regla de Negocio §3.6 e Integridad del Inventario Logístico).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 299-320, 365-366)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 311-333)
* **Descripción Técnica:**
  1. Para `recurso.es_individual = true`, `asignarRecursosRecuperacionService` valida únicamente `cantidadSolicitada === 1` y `recurso.estado` (`EN_MANTENCION`, `NO_DISPONIBLE`, `ASIGNADO`), sin comprobar que `cantidad_inventario - cantidad_en_uso >= 1`. En el módulo de cuadrillas (`src/modules/recursos-y-personal/cuadrilla.repository.ts:1018-1024`), al dotar una cuadrilla solo se incrementa `recurso.cantidad_en_uso` sin cambiar `recurso.estado` en tabla (permanece `'DISPONIBLE'` mientras `recurso.service.ts` calcula `'ASIGNADO'` dinámicamente). En consecuencia, HU-32 permite asignar un activo individual cuya única unidad ya está en uso por una cuadrilla.
  2. `actualizarRecursoIndividualAsignado` sobrescribe fijamente `cantidad_en_uso: 1` y `estado: "ASIGNADO"`. Sin embargo, la semilla oficial (`src/lib/db/seed-kanban.ts:63-103`) y la tabla `recurso` en BD registran activos individuales con múltiples unidades (`Motobomba Caudal 4"`: `es_individual = true, cantidad_inventario = 3, cantidad_en_uso = 1, estado = 'DISPONIBLE'`; `Motosierra Stihl MS 382`: `es_individual = true, cantidad_inventario = 6, cantidad_en_uso = 2, estado = 'DISPONIBLE'`).
* **Pasos para Reproducir:**
  1. Caso A: Asignar en `PUT /api/cuadrillas/[id]` un recurso individual con `cantidad_inventario = 1` (quedando `cantidad_en_uso = 1`, `estado = 'DISPONIBLE'` en tabla `recurso`), y luego invocar `POST /api/eventos-atp/recuperacion/{id}/asignar` con ese `recursoId`.
  2. Caso B: Invocar `POST /api/eventos-atp/recuperacion/{id}/asignar` solicitando `cantidad: 1` de `"Motosierra Stihl MS 382 Profesional"` (`cantidad_inventario: 6`, `cantidad_en_uso: 2`).
* **Comportamiento Actual vs Esperado:**
  * *Actual:* En Caso A, la asignación es aceptada generando doble uso sobre una única unidad física. En Caso B, `cantidad_en_uso` retrocede corruptamente de `2` a `1` y el estado cambia a `ASIGNADO`, bloqueando las 3 unidades libres restantes.
  * *Esperado:* Validar en ambos casos `disponible = Math.max(0, inventario - enUso) >= 1` (`409 Conflict` si es `0`), incrementar `cantidad_en_uso` en `1` (`enUso + 1`) y asignar `estado = "ASIGNADO"` únicamente cuando `inventario - nuevoEnUso === 0` (o `BAJO_STOCK`/`DISPONIBLE` si aún quedan unidades disponibles).
* **Corrección Sugerida:**
  Incorporar la validación de `disponible >= 1` para `es_individual = true` en `recuperacion.service.ts`, y actualizar `actualizarRecursoIndividualAsignado` para incrementar `cantidad_en_uso` en `+1` derivando `estado` con la misma lógica de `calcularDisponibilidadOperativa` (`src/modules/recursos-y-personal/recurso.utils.ts`).

---

### `BUG-H32-API-04`: Violación del Ciclo de Vida ICS de Misión (`fecha_inicio` Prematura, Ausencia de Hito en `mision_hito`) y Corrupción de `personal.disponible_terreno`
* **Severidad:** **ALTA** (Regla de Negocio ICS y Disponibilidad de Personal).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivos Afectados:**
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 116-134, 202-225)
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 338-347, 385-387)
* **Descripción Técnica:**
  1. `insertarMisionRecuperacion` crea el registro en `mision` con `estado: "DESPACHADA"` pero establece `fecha_inicio: new Date()` en lugar de `null`, y no inserta el hito inicial `"DESPACHADA"` en la tabla `mision_hito`. Cuando se consulta la misión en `GET /api/misiones/{id}` (`src/modules/misiones/mision.service.ts:61-86`), la ausencia de hitos activa el fallback que genera prematuramente el evento `"DESPLIEGUE_INICIO"` antes de que la patrulla acepte o inicie el desplazamiento.
  2. `actualizarEstadoPersonalLider` actualiza `personal.disponible_terreno = false` y `usuario.estado_operativo = 'en_mision'` sin estampar `actualizado_en` en `usuario`. Conforme a `src/modules/recursos-y-personal/estado-operativo.ts` y la migración `025_disponibilidad_usuario.ts`, `disponible_terreno` representa la aptitud permanente para terreno (solo deshabilitada ante baja o reasignación administrativa) y ningún flujo de cierre de misión restablece `disponible_terreno = true`, inhabilitando al funcionario para futuras cuadrillas (`cuadrilla.service.ts:429`).
* **Pasos para Reproducir:**
  1. Ejecutar `POST /api/eventos-atp/recuperacion/{id}/asignar` con una patrulla disponible que tenga `usuario_lider_id` con ficha en `personal`.
  2. Consultar la misión generada mediante `GET /api/misiones/{misionId}` y revisar `personal.disponible_terreno` del líder en PostgreSQL.
* **Comportamiento Actual vs Esperado:**
  * *Actual:* La misión nace en estado `DESPACHADA` con `fecha_inicio` no nula, sin registros en `mision_hito` (generando `"DESPLIEGUE_INICIO"` prematuro en bitácora) y dejando al líder con `personal.disponible_terreno = false`.
  * *Esperado:* Misión en estado `'DESPACHADA'` con `fecha_inicio: null`, hito inicial `'DESPACHADA'` registrado en `mision_hito` dentro de la transacción (patrón de `mision.repository.ts:478-511`), e integridad inalterada de `personal.disponible_terreno`.
* **Corrección Sugerida:**
  Fijar `fecha_inicio: null` en `insertarMisionRecuperacion`, insertar el hito `'DESPACHADA'` en `mision_hito` dentro de la transacción, y remover la mutación `disponible_terreno: false` en `actualizarEstadoPersonalLider`.

---

### `BUG-H32-API-05`: Difusión Incompleta en Redis Pub/Sub (`recuperacion:actualizada` y `recurso:actualizado`) e Inconsistencia de Contrato en Payload WebSocket
* **Severidad:** **ALTA** (Sincronización en Tiempo Real — Criterio de Aceptación 7).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (Líneas 260-284, 387-413)
  * `src/modules/eventos-atp/recuperacion.service.ts` (Líneas 380, 430-433)
* **Descripción Técnica:**
  1. En despliegues Next.js donde los Route Handlers ejecutan fuera del contexto en memoria del servidor HTTP (`ioInstance === null`), `src/lib/socket/index.ts` publica eventos vía `REDIS_SOCKET_CHANNEL`. En esa rama Redis, `emitirRecuperacionActualizada` publica únicamente a `"sala:encargados"`, omitiendo `"encargado"` y `"mapa"`; análogamente, `emitirRecursoActualizado` publica únicamente a `"encargado"`, omitiendo `"supervisor"`.
  2. `asignarRecursosRecuperacionService` envía en `emitirRecursoActualizado(recurso)` la fila cruda de PostgreSQL en `snake_case` (`es_individual`, `cantidad_inventario`, `cantidad_en_uso`, `cantidad_minima`) sin el campo `cantidadDisponible`, discrepando del formato `camelCase` emitido por `recurso.service.ts:343-378` y `patrulla.service.ts:677-682`.
* **Pasos para Reproducir:**
  1. Conectar clientes Socket.io unidos a las salas `"mapa"` y `"supervisor"` contra `src/server.ts` con `REDIS_URL` configurado.
  2. Invocar `POST /api/eventos-atp/recuperacion/{id}/asignar` desde un worker o Route Handler donde `ioInstance` es `null`.
* **Comportamiento Actual vs Esperado:**
  * *Actual:* Los clientes en sala `"mapa"` y `"encargado"` no reciben `recuperacion:actualizada` vía Redis Pub/Sub, los clientes en `"supervisor"` no reciben `recurso:actualizado`, y el payload de `recurso:actualizado` llega en `snake_case`.
  * *Esperado:* Publicación en `REDIS_SOCKET_CHANNEL` para todas las salas de cada evento (`["sala:encargados", "encargado", "mapa"]` y `["encargado", "supervisor"]`) y payload normalizado en `camelCase` con `cantidadDisponible`.
* **Corrección Sugerida:**
  Iterar sobre la lista completa de salas al publicar en `REDIS_SOCKET_CHANNEL` dentro de `emitirRecuperacionActualizada` y `emitirRecursoActualizado` (siguiendo el patrón de `notificarPatrullaActualizada` en `src/lib/socket/index.ts:636-648`) y transformar el objeto de recurso a `camelCase` en `recuperacion.service.ts`.

---

### `BUG-H32-API-06`: Discrepancia en Contrato OpenAPI / Documentación vs `auth.guard.ts` (`x-user-id`), Versión Desfasada (`0.10.0` vs `0.11.0`) y Omisión en Suite OpenAPI
* **Severidad:** **MEDIA** (Contrato OpenAPI 3.0 y Trazabilidad Documental).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivos Afectados:**
  * `src/lib/openapi/index.ts` (Líneas 1653-1832, 2529)
  * `docs/api/eventos-atp.md` (Líneas 979, 1075)
  * `src/app/openapi.json/__tests__/route.test.ts` (Líneas 37-40)
* **Descripción Técnica:**
  1. Los registros OpenAPI de `GET /api/eventos-atp/recuperacion/{id}` y `POST /api/eventos-atp/recuperacion/{id}/asignar` omiten `security` y declaran las cabeceras opcionales `authorization` y `x-user-id`. De igual modo, `docs/api/eventos-atp.md` documenta `X-User-Id` como alternativa válida. Sin embargo, `extraerUsuarioId` (`src/modules/seguridad/auth.guard.ts:20-46`) exige estrictamente `Authorization: Bearer <token>` y responde `401 Unauthorized` si solo se envía `x-user-id`.
  2. `generarOpenAPISpec()` expone `info.version: "0.10.0"`, desincronizada respecto a `package.json` (`"0.11.0"`).
  3. `src/app/openapi.json/__tests__/route.test.ts` no valida la presencia de las rutas de HU-32 (`GET /api/eventos-atp/recuperacion`, `GET /api/eventos-atp/recuperacion/{id}` y `POST /api/eventos-atp/recuperacion/{id}/asignar`).
* **Pasos para Reproducir:**
  1. Consultar `GET /openapi.json` y observar `info.version` y `paths["/api/eventos-atp/recuperacion/{id}/asignar"].post.parameters`.
  2. Ejecutar `curl -i -X POST http://localhost:3001/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar -H "x-user-id: 00000000-0000-4000-8000-000000000003" -H "Content-Type: application/json" -d '{...}'`.
* **Comportamiento Actual vs Esperado:**
  * *Actual:* `GET /openapi.json` publica `version: "0.10.0"` y sugiere `x-user-id`, pero la petición con `x-user-id` falla con `HTTP 401 Unauthorized`.
  * *Esperado:* Contrato OpenAPI y `docs/api/eventos-atp.md` alineados exclusivamente con autenticación `Bearer` (`security`), `info.version` sincronizada con `package.json` y aserciones de regresión en `src/app/openapi.json/__tests__/route.test.ts`.
* **Corrección Sugerida:**
  Agregar `security` Bearer en las operaciones de recuperación, eliminar la declaración de `x-user-id` en `src/lib/openapi/index.ts` y `docs/api/eventos-atp.md`, actualizar `info.version` y añadir las aserciones de rutas HU-32 en `route.test.ts`.

---

### `BUG-H32-API-07`: Desincronización de Rama frente a `origin/develop` (Conflicto en `package.json`) y Bloqueo de Migración Kysely `041_recuperacion_recurso_mision_id`
* **Severidad:** **ALTA** (Integración Gitflow, Migraciones Kysely y Despliegue CI/CD).
* **Estado:** 🔴 **`ABIERTO`** (Detectado el 16/11/2026 23:50).
* **Archivos Afectados:**
  * `package.json`
  * `src/lib/db/migrator.ts`
  * `src/lib/db/migrations/041_recuperacion_recurso_mision_id.ts`
* **Descripción Técnica:**
  La rama `feature/H32-asignar-recursos-recuperacion` quedó rezagada respecto a `origin/develop`, donde ya se integraron las migraciones `035_permiso_misiones_terreno_verificar`, `042_cuadrilla_patrulla_integrantes_vistas`, `061_notificaciones_mision` y `071_indices_listado_cuadrillas`, la actualización de `src/lib/db/migrator.ts` y la versión `0.12.0` en `package.json` (produciendo conflicto de fusión en `package.json` al proyectar `git merge-tree HEAD origin/develop`). Al ejecutar `npm run db:migrate` sobre la BD del entorno compartido, Kysely aborta por migraciones faltantes (`035_permiso_misiones_terreno_verificar is missing`), impidiendo aplicar `041_recuperacion_recurso_mision_id.ts`. Como efecto directo, la columna `recuperacion_recurso.mision_id` no existe en la BD: `GET /api/eventos-atp/recuperacion/[id]` cae al fallback devolviendo `misionId: null`, y `POST /asignar` fallaría con error SQL `42703` en `insertarRecursosRecuperacionConMision`.
* **Pasos para Reproducir:**
  1. En `feature/H32-asignar-recursos-recuperacion`, ejecutar `git merge-tree --write-tree HEAD origin/develop`.
  2. Ejecutar `npm run db:migrate` en el entorno conectado a PostgreSQL donde `origin/develop` ya aplicó `035_`..`071_`.
* **Comportamiento Actual vs Esperado:**
  * *Actual:* `git merge-tree` reporta `CONFLICTO (contenido): Conflicto de fusión en package.json`, y `npm run db:migrate` termina con código 1 (`Error: corrupted migrations: previously executed migration 035_permiso_misiones_terreno_verificar is missing`).
  * *Esperado:* Rama sincronizada limpiamente con `origin/develop` sin conflictos y migración de HU-32 ejecutada sin errores creando la columna e índice `mision_id` en `recuperacion_recurso`.
* **Corrección Sugerida:**
  Integrar `origin/develop` en `feature/H32-asignar-recursos-recuperacion` resolviendo el conflicto de `package.json` (manteniendo `"version": "0.12.0"` y el script `"seed:recuperacion"`), validar el orden de `041_recuperacion_recurso_mision_id.ts` junto a `migrator.ts` de `develop`, y ejecutar `npm run db:migrate`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H32-API-01` | Bloqueo pesimista FOR UPDATE y condición atómica WHERE estado = DISPONIBLE en patrulla_verificadora y recuperacion para prevenir doble despacho TOCTOU | Concurrencia / ICS | Repositorio / Servicio | Crítica | Patrulla en estado DISPONIBLE y dos eventos de recuperación activos con recursos distintos | 2 peticiones concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar con mismo patrullaId | Primera petición responde 200 OK y bloquea la patrulla; segunda aborta con 409 Conflict sin crear misión duplicada | Bloqueo pesimista y actualización atómica verificados en Vitest y runtime | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-02` | Generación secuencial segura de mision.codigo y recuperacion.codigo mediante pg_advisory_xact_lock y ORDER BY codigo DESC | Concurrencia / Integridad | Repositorio / BD | Alta | Múltiples asignaciones concurrentes o códigos con huecos (ej. MIS-2026-0101 de seed-recuperacion) | 2 peticiones concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar | Correlativos únicos MIS-YYYY-NNNN sin colisión de clave única (23505) ni error HTTP 500 | Advisory lock transaccional y cálculo de máximo numérico implementado y probado | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-03` | Regla §3.6 para activos individuales (es_individual = true): validación de saldo libre (inventario - en_uso >= 1) e incremento +1 de cantidad_en_uso sin corrupción multiunidad | Regla de Negocio (§3.6) | Servicio / Repositorio | Alta | Activo individual con cantidad_inventario = 6 y cantidad_en_uso = 2 (o activo con inventario = 1, en_uso = 1 y estado DISPONIBLE desde cuadrilla) | POST /api/eventos-atp/recuperacion/{id}/asignar con recursoId individual (cantidad: 1) | Rechaza 409 si disponible < 1; si disponible >= 1 incrementa cantidad_en_uso a 3 y deriva estado según remanente | Validación disponible >= 1 e incremento dinámico verificado sin corrupción multiunidad | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-04` | Ciclo de vida ICS en misión DESPACHADA (fecha_inicio null y registro de hito inicial en mision_hito) y preservación de personal.disponible_terreno | Regla de Negocio ICS | Repositorio / BD | Alta | Patrulla disponible con usuario_lider_id vinculado a tabla personal | POST /api/eventos-atp/recuperacion/{id}/asignar seguido de GET /api/misiones/{misionId} | Misión creada con fecha_inicio: null, hito 'DESPACHADA' en mision_hito y personal.disponible_terreno inalterado | Misión nace en DESPACHADA con fecha_inicio null, hito registrado y disponible_terreno intacto | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-05` | Difusión completa en broker Redis Pub/Sub de recuperacion:actualizada (sala:encargados, encargado, mapa) y recurso:actualizado (encargado, supervisor) en camelCase | Tiempo Real / Redis | Socket / Servicio | Alta | Route Handler con ioInstance = null emitiendo vía REDIS_SOCKET_CHANNEL hacia server.ts | Asignación exitosa con clientes conectados a salas mapa, encargado y supervisor | Redis Pub/Sub difunde recuperacion:actualizada a las 3 salas y recurso:actualizado a encargado y supervisor en camelCase con cantidadDisponible | Publicación en abanico multi-sala verificada en Redis y payload en camelCase | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-06` | Alineación de especificación OpenAPI (/openapi.json) y docs/api/eventos-atp.md con auth.guard (solo Bearer), versión de package.json y cobertura en route.test.ts | Contrato OpenAPI | OpenAPI / Docs / Tests | Media | Especificación generada en GET /openapi.json y documentación técnica | GET /openapi.json y POST .../asignar con header x-user-id sin Bearer | OpenAPI define seguridad Bearer sin x-user-id, info.version sincronizada con package.json y rutas HU-32 testeadas en route.test.ts | Contrato OpenAPI y docs actualizados a versión 0.12.0 y BearerAuth con tests validados | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `BUG-H32-API-07` | Sincronización de rama con origin/develop sin conflictos y ejecución limpia de migración 041_recuperacion_recurso_mision_id.ts en Kysely | Integración / Migraciones | Git / Base de Datos | Alta | BD compartida con migraciones de develop (035_, 042_, 061_, 071_) y archivo 041_ en rama | git merge-tree --write-tree HEAD origin/develop y npm run db:migrate | Merge limpio con develop y aplicación exitosa de columna e índice mision_id en recuperacion_recurso | Rama sincronizada con origin/develop sin conflictos y migración 041_ validada | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion |
| `CP-H32-API-01` | Validación de esquema Zod AsignarRecursosRecuperacionInputSchema con patrullaId UUID y arreglo válido de recursos | Validación de Esquema | Unitaria / Zod | Alta | Esquema Zod importado en suite Vitest | {patrullaId:'50000000-0000-4000-8000-000000000001',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]} | safeParse retorna success: true con datos tipados | Validación exitosa confirmada en Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32) |
| `CP-H32-API-02` | Rechazo con HTTP 400 / fallo Zod cuando patrullaId no tiene formato UUID válido | Validación de Esquema | Unitaria / Zod | Alta | Esquema AsignarRecursosRecuperacionInputSchema | {patrullaId:'id-invalido',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]} | safeParse retorna success: false y HTTP 400 en Route Handler | Rechazo validado en Vitest (schema y route.test.ts) | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32) |
| `CP-H32-API-03` | Rechazo con HTTP 400 Bad Request cuando la lista de recursos está vacía (recursos: []) | Validación de Entrada | API HTTP / Vitest | Alta | Servidor activo y token JWT de Encargado | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con {patrullaId:'f1000000-0000-4000-8000-000000000002',recursos:[]} | HTTP 400 indicando que debe asignar al menos un recurso | HTTP 400 con error en campo 'recursos' verificado en HTTP real y Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-04` | Rechazo con HTTP 400 Bad Request cuando la cantidad de recurso es menor o igual a 0 | Validación de Entrada | API HTTP / Vitest | Alta | Servidor activo y token JWT de Encargado | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con cantidad: 0 | HTTP 400 indicando 'La cantidad debe ser mayor a 0' | HTTP 400 con error en campo 'recursos.0.cantidad' verificado en HTTP real y Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-05` | Rechazo con HTTP 400 Bad Request ante parámetro de ruta :id no UUID o cuerpo JSON sintácticamente inválido | Robustez / Validación | API HTTP / Vitest | Media | Servidor activo y token JWT de Encargado | GET .../recuperacion/id-no-valido y POST .../id-no-valido/asignar y body 'no-json' | HTTP 400 Bad Request con mensaje descriptivo del identificador o payload inválido | HTTP 400 verificado para parámetro :id inválido y cuerpo JSON malformado | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-06` | Denegación con HTTP 401 Unauthorized cuando las rutas de recuperación se invocan sin token JWT Bearer | Seguridad / Auth | API HTTP / Vitest | Crítica | Peticiones sin cabecera Authorization | GET .../recuperacion, GET .../recuperacion/{id} y POST .../recuperacion/{id}/asignar sin Authorization | HTTP 401 Unauthorized impidiendo acceso anónimo | HTTP 401: 'Se requiere cabecera de autenticación Authorization: Bearer <token>.' en los 3 endpoints | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-07` | Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar | Seguridad / RBAC | API HTTP / Vitest | Crítica | Usuario autenticado con rol Call Center (callcenter@valdivia.cl) sin permiso misiones:asignar | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con Bearer de Call Center | HTTP 403 Forbidden exigiendo permiso misiones:asignar | HTTP 403: 'No cuenta con el permiso requerido: misiones:asignar' en HTTP real y Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-08` | Consulta exitosa (HTTP 200) de ficha de detalle GET /api/eventos-atp/recuperacion/[id] y rechazo HTTP 404 para UUID inexistente | Funcional / Consulta | API HTTP / Servicio | Alta | Evento REC-2026-0001 existente en BD y usuario Encargado | GET /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602 y UUID 70000000-0000-4000-8000-000000000999 | HTTP 200 con detalle, misiones y recursosAsignados; HTTP 404 para UUID inexistente | HTTP 200 retornando REC-2026-0001 (misionId: null por fallback) y HTTP 404 para inexistente | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente |
| `CP-H32-API-09` | Consulta de listado GET /api/eventos-atp/recuperacion para mapa operativo con autenticación válida | Funcional / Consulta | API HTTP / Servicio | Alta | Evento REC-2026-0001 en BD y token JWT de Encargado | GET /api/eventos-atp/recuperacion con Authorization: Bearer <token_encargado> | HTTP 200 OK con total y arreglo data georreferenciado | HTTP 200 OK retornando total: 1 y datos completos de REC-2026-0001 | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente |
| `CP-H32-API-10` | Rechazo con HTTP 404 Not Found en POST /asignar si el evento, la patrulla o algún recurso no existe | Manejo de Errores | API HTTP / Vitest | Alta | UUID inexistente de evento o patrulla en BD | POST .../70000000-0000-4000-8000-000000000999/asignar y patrullaId 50000000-0000-4000-8000-000000000999 | HTTP 404 Not Found informando la entidad no encontrada | HTTP 404 verificado en HTTP real y Vitest (evento, patrulla y recurso faltante) | APROBADO | 16/11/2026 23:50 | N/A | feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32) |
| `CP-H32-API-11` | Rechazo con HTTP 409 Conflict si el evento de recuperación se encuentra en estado COMPLETADA o CANCELADA | Regla de Negocio | Unitaria / Servicio | Alta | Evento mockeado en estado COMPLETADA | asignarRecursosRecuperacionService sobre evento con estado: 'COMPLETADA' | Lanza ConflictoEstadoError mapeado a HTTP 409 Conflict | Rechazo con ConflictoEstadoError verificado en Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-12` | Rechazo con HTTP 409 Conflict si la patrulla verificadora seleccionada no está en estado DISPONIBLE | Regla de Negocio | API HTTP / Vitest | Crítica | Patrulla f1000000-0000-4000-8000-000000000002 en estado EN_VERIFICACION en BD | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con patrulla en EN_VERIFICACION | HTTP 409 Conflict indicando el estado actual de la patrulla | HTTP 409: 'La patrulla "Patrulla Rápida Centro-Sur" no está disponible para asignación (estado actual: EN_VERIFICACION).' | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-13` | Bloqueo pesimista FOR UPDATE sobre tabla recurso y rechazo HTTP 409 ante sobregiro de stock en insumos a granel | Concurrencia / §3.6 | Servicio / Repo | Crítica | Recurso a granel (inventario: 10, en_uso: 8 -> disponible: 2) | Solicitud de cantidad: 5 para recurso a granel en asignarRecursosRecuperacionService | obtenerRecursosParaBloqueo aplica .forUpdate() y servicio lanza StockInsuficienteError (HTTP 409) | .forUpdate() verificado en repositorio y StockInsuficienteError verificado en Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-14` | Rechazo con HTTP 400 Bad Request cuando se solicita cantidad superior a 1 para un activo individual | Regla de Negocio (§3.6) | Servicio / Unitaria | Crítica | Recurso con es_individual = true | Solicitud de cantidad: 2 para activo individual en asignarRecursosRecuperacionService | Lanza BadRequestError mapeado a HTTP 400 Bad Request | BadRequestError verificado en Vitest | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-15` | Rechazo con HTTP 409 Conflict cuando el activo individual se encuentra en EN_MANTENCION, NO_DISPONIBLE o ASIGNADO | Regla de Negocio (§3.6) | Servicio / Unitaria | Crítica | Recurso con es_individual = true en estado EN_MANTENCION o ASIGNADO | Solicitud de cantidad: 1 para activo en EN_MANTENCION o ASIGNADO | Lanza RecursoNoDisponibleError mapeado a HTTP 409 Conflict | RecursoNoDisponibleError verificado en Vitest para EN_MANTENCION y ASIGNADO (e inspeccionado NO_DISPONIBLE) | APROBADO | 16/11/2026 23:50 | N/A | feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32) |
| `CP-H32-API-16` | Flujo nominal de asignación en servicio con mocks Vitest (creación de misión RECUPERACION, actualización de granel y emisión de sockets) | Funcional / Unitaria | Servicio (Mocks) | Crítica | Mocks de transacción Kysely, repositorios y emisores Socket.io | asignarRecursosRecuperacionService con 10 unidades granel + 1 activo individual disponible | Retorna evento, misión RECUPERACION, patrulla EN_RECUPERACION, recursos actualizados e invoca emisores Socket | 16/16 pruebas en recuperacion.asignar.service.test.ts y 9/9 en route.test.ts aprobadas | APROBADO | 16/11/2026 23:50 | N/A | test(eventos-atp): pruebas unitarias y de integracion para asignacion de recuperacion (HU-32) |
| `CP-H32-API-17` | Paginación exacta y eliminación de duplicados en listado de patrullas GET /api/patrullas?page=1&limit=5 | Regresión / Consulta | API HTTP / Repo | Alta | 9 patrullas registradas en BD | GET /api/patrullas?page=1&limit=5 con Bearer de Encargado | HTTP 200 OK retornando meta.total = 9, totalPages = 2 y exactamente 5 elementos únicos | HTTP 200 OK con meta.total = 9 y data.length = 5 verificado en HTTP real y Vitest | APROBADO | 16/11/2026 23:50 | N/A | fix(patrullas): eliminar duplicados y preservar paginacion exacta en GET /api/patrullas |
| `CP-H32-API-18` | Ejecución integral POST /api/eventos-atp/recuperacion/[id]/asignar contra PostgreSQL real validando inserción de recuperacion_recurso.mision_id | Integración E2E BD | API HTTP / PostgreSQL | Crítica | Migración 041_ aplicada en PostgreSQL y patrulla en estado DISPONIBLE | POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar contra BD real | HTTP 200 OK con fila en recuperacion_recurso vinculada a mision_id y actualización de recurso/patrulla | Integración transaccional validada y migración 041 ejecutada exitosamente | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |
| `CP-H32-API-19` | Validación de tipos estáticos TypeScript, ESLint y compilación de producción Next.js Turbopack | Calidad Estática / Build | Build / CI | Alta | Entorno Node.js con dependencias instaladas | npx next typegen && npx tsc --noEmit && npm run lint && npm run build | 0 errores de tipos, 0 errores ESLint y compilación exitosa incluyendo rutas HU-32 | 0 errores en tsc --noEmit, 0 errores en lint y build exitoso | APROBADO | 16/11/2026 23:50 | 18/11/2026 03:40 | fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07 |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H32-API-01	Bloqueo pesimista FOR UPDATE y condición atómica WHERE estado = DISPONIBLE en patrulla_verificadora y recuperacion para prevenir doble despacho TOCTOU	Concurrencia / ICS	Repositorio / Servicio	Crítica	Patrulla en estado DISPONIBLE y dos eventos de recuperación activos con recursos distintos	2 peticiones concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar con mismo patrullaId	Primera petición responde 200 OK y bloquea la patrulla; segunda aborta con 409 Conflict sin crear misión duplicada	Bloqueo pesimista y actualización atómica verificados en Vitest y runtime	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-02	Generación secuencial segura de mision.codigo y recuperacion.codigo mediante pg_advisory_xact_lock y ORDER BY codigo DESC	Concurrencia / Integridad	Repositorio / BD	Alta	Múltiples asignaciones concurrentes o códigos con huecos (ej. MIS-2026-0101 de seed-recuperacion)	2 peticiones concurrentes POST /api/eventos-atp/recuperacion/{id}/asignar	Correlativos únicos MIS-YYYY-NNNN sin colisión de clave única (23505) ni error HTTP 500	Advisory lock transaccional y cálculo de máximo numérico implementado y probado	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-03	Regla §3.6 para activos individuales (es_individual = true): validación de saldo libre (inventario - en_uso >= 1) e incremento +1 de cantidad_en_uso sin corrupción multiunidad	Regla de Negocio (§3.6)	Servicio / Repositorio	Alta	Activo individual con cantidad_inventario = 6 y cantidad_en_uso = 2 (o activo con inventario = 1, en_uso = 1 y estado DISPONIBLE desde cuadrilla)	POST /api/eventos-atp/recuperacion/{id}/asignar con recursoId individual (cantidad: 1)	Rechaza 409 si disponible < 1; si disponible >= 1 incrementa cantidad_en_uso a 3 y deriva estado según remanente	Validación disponible >= 1 e incremento dinámico verificado sin corrupción multiunidad	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-04	Ciclo de vida ICS en misión DESPACHADA (fecha_inicio null y registro de hito inicial en mision_hito) y preservación de personal.disponible_terreno	Regla de Negocio ICS	Repositorio / BD	Alta	Patrulla disponible con usuario_lider_id vinculado a tabla personal	POST /api/eventos-atp/recuperacion/{id}/asignar seguido de GET /api/misiones/{misionId}	Misión creada con fecha_inicio: null, hito 'DESPACHADA' en mision_hito y personal.disponible_terreno inalterado	Misión nace en DESPACHADA con fecha_inicio null, hito registrado y disponible_terreno intacto	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-05	Difusión completa en broker Redis Pub/Sub de recuperacion:actualizada (sala:encargados, encargado, mapa) y recurso:actualizado (encargado, supervisor) en camelCase	Tiempo Real / Redis	Socket / Servicio	Alta	Route Handler con ioInstance = null emitiendo vía REDIS_SOCKET_CHANNEL hacia server.ts	Asignación exitosa con clientes conectados a salas mapa, encargado y supervisor	Redis Pub/Sub difunde recuperacion:actualizada a las 3 salas y recurso:actualizado a encargado y supervisor en camelCase con cantidadDisponible	Publicación en abanico multi-sala verificada en Redis y payload en camelCase	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-06	Alineación de especificación OpenAPI (/openapi.json) y docs/api/eventos-atp.md con auth.guard (solo Bearer), versión de package.json y cobertura en route.test.ts	Contrato OpenAPI	OpenAPI / Docs / Tests	Media	Especificación generada en GET /openapi.json y documentación técnica	GET /openapi.json y POST .../asignar con header x-user-id sin Bearer	OpenAPI define seguridad Bearer sin x-user-id, info.version sincronizada con package.json y rutas HU-32 testeadas en route.test.ts	Contrato OpenAPI y docs actualizados a versión 0.12.0 y BearerAuth con tests validados	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
BUG-H32-API-07	Sincronización de rama con origin/develop sin conflictos y ejecución limpia de migración 041_recuperacion_recurso_mision_id.ts en Kysely	Integración / Migraciones	Git / Base de Datos	Alta	BD compartida con migraciones de develop (035_, 042_, 061_, 071_) y archivo 041_ en rama	git merge-tree --write-tree HEAD origin/develop y npm run db:migrate	Merge limpio con develop y aplicación exitosa de columna e índice mision_id en recuperacion_recurso	Rama sincronizada con origin/develop sin conflictos y migración 041_ validada	APROBADO	16/11/2026 23:50	18/11/2026 03:40	merge: sincronizar origin/develop en feature/H32-asignar-recursos-recuperacion
CP-H32-API-01	Validación de esquema Zod AsignarRecursosRecuperacionInputSchema con patrullaId UUID y arreglo válido de recursos	Validación de Esquema	Unitaria / Zod	Alta	Esquema Zod importado en suite Vitest	{patrullaId:'50000000-0000-4000-8000-000000000001',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]}	safeParse retorna success: true con datos tipados	Validación exitosa confirmada en Vitest	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32)
CP-H32-API-02	Rechazo con HTTP 400 / fallo Zod cuando patrullaId no tiene formato UUID válido	Validación de Esquema	Unitaria / Zod	Alta	Esquema AsignarRecursosRecuperacionInputSchema	{patrullaId:'id-invalido',recursos:[{recursoId:'80000000-0000-4000-8000-000000000001',cantidad:10}]}	safeParse retorna success: false y HTTP 400 en Route Handler	Rechazo validado en Vitest (schema y route.test.ts)	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): esquemas zod y contratos openapi para asignacion de recuperacion (HU-32)
CP-H32-API-03	Rechazo con HTTP 400 Bad Request cuando la lista de recursos está vacía (recursos: [])	Validación de Entrada	API HTTP / Vitest	Alta	Servidor activo y token JWT de Encargado	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con {patrullaId:'f1000000-0000-4000-8000-000000000002',recursos:[]}	HTTP 400 indicando que debe asignar al menos un recurso	HTTP 400 con error en campo 'recursos' verificado en HTTP real y Vitest	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-04	Rechazo con HTTP 400 Bad Request cuando la cantidad de recurso es menor o igual a 0	Validación de Entrada	API HTTP / Vitest	Alta	Servidor activo y token JWT de Encargado	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con cantidad: 0	HTTP 400 indicando 'La cantidad debe ser mayor a 0'	HTTP 400 con error en campo 'recursos.0.cantidad' verificado en HTTP real y Vitest	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-05	Rechazo con HTTP 400 Bad Request ante parámetro de ruta :id no UUID o cuerpo JSON sintácticamente inválido	Robustez / Validación	API HTTP / Vitest	Media	Servidor activo y token JWT de Encargado	GET .../recuperacion/id-no-valido y POST .../id-no-valido/asignar y body 'no-json'	HTTP 400 Bad Request con mensaje descriptivo del identificador o payload inválido	HTTP 400 verificado para parámetro :id inválido y cuerpo JSON malformado	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-06	Denegación con HTTP 401 Unauthorized cuando las rutas de recuperación se invocan sin token JWT Bearer	Seguridad / Auth	API HTTP / Vitest	Crítica	Peticiones sin cabecera Authorization	GET .../recuperacion, GET .../recuperacion/{id} y POST .../recuperacion/{id}/asignar sin Authorization	HTTP 401 Unauthorized impidiendo acceso anónimo	HTTP 401: 'Se requiere cabecera de autenticación Authorization: Bearer <token>.' en los 3 endpoints	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-07	Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar	Seguridad / RBAC	API HTTP / Vitest	Crítica	Usuario autenticado con rol Call Center (callcenter@valdivia.cl) sin permiso misiones:asignar	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con Bearer de Call Center	HTTP 403 Forbidden exigiendo permiso misiones:asignar	HTTP 403: 'No cuenta con el permiso requerido: misiones:asignar' en HTTP real y Vitest	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-08	Consulta exitosa (HTTP 200) de ficha de detalle GET /api/eventos-atp/recuperacion/[id] y rechazo HTTP 404 para UUID inexistente	Funcional / Consulta	API HTTP / Servicio	Alta	Evento REC-2026-0001 existente en BD y usuario Encargado	GET /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602 y UUID 70000000-0000-4000-8000-000000000999	HTTP 200 con detalle, misiones y recursosAsignados; HTTP 404 para UUID inexistente	HTTP 200 retornando REC-2026-0001 (misionId: null por fallback) y HTTP 404 para inexistente	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente
CP-H32-API-09	Consulta de listado GET /api/eventos-atp/recuperacion para mapa operativo con autenticación válida	Funcional / Consulta	API HTTP / Servicio	Alta	Evento REC-2026-0001 en BD y token JWT de Encargado	GET /api/eventos-atp/recuperacion con Authorization: Bearer <token_encargado>	HTTP 200 OK con total y arreglo data georreferenciado	HTTP 200 OK retornando total: 1 y datos completos de REC-2026-0001	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): implementar GET /api/eventos-atp/recuperacion y endurecer detalle ante migracion pendiente
CP-H32-API-10	Rechazo con HTTP 404 Not Found en POST /asignar si el evento, la patrulla o algún recurso no existe	Manejo de Errores	API HTTP / Vitest	Alta	UUID inexistente de evento o patrulla en BD	POST .../70000000-0000-4000-8000-000000000999/asignar y patrullaId 50000000-0000-4000-8000-000000000999	HTTP 404 Not Found informando la entidad no encontrada	HTTP 404 verificado en HTTP real y Vitest (evento, patrulla y recurso faltante)	APROBADO	16/11/2026 23:50	N/A	feat(api): route handlers GET /api/eventos-atp/recuperacion/[id] y POST /asignar (HU-32)
CP-H32-API-11	Rechazo con HTTP 409 Conflict si el evento de recuperación se encuentra en estado COMPLETADA o CANCELADA	Regla de Negocio	Unitaria / Servicio	Alta	Evento mockeado en estado COMPLETADA	asignarRecursosRecuperacionService sobre evento con estado: 'COMPLETADA'	Lanza ConflictoEstadoError mapeado a HTTP 409 Conflict	Rechazo con ConflictoEstadoError verificado en Vitest	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-12	Rechazo con HTTP 409 Conflict si la patrulla verificadora seleccionada no está en estado DISPONIBLE	Regla de Negocio	API HTTP / Vitest	Crítica	Patrulla f1000000-0000-4000-8000-000000000002 en estado EN_VERIFICACION en BD	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar con patrulla en EN_VERIFICACION	HTTP 409 Conflict indicando el estado actual de la patrulla	HTTP 409: 'La patrulla "Patrulla Rápida Centro-Sur" no está disponible para asignación (estado actual: EN_VERIFICACION).'	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-13	Bloqueo pesimista FOR UPDATE sobre tabla recurso y rechazo HTTP 409 ante sobregiro de stock en insumos a granel	Concurrencia / §3.6	Servicio / Repo	Crítica	Recurso a granel (inventario: 10, en_uso: 8 -> disponible: 2)	Solicitud de cantidad: 5 para recurso a granel en asignarRecursosRecuperacionService	obtenerRecursosParaBloqueo aplica .forUpdate() y servicio lanza StockInsuficienteError (HTTP 409)	.forUpdate() verificado en repositorio y StockInsuficienteError verificado en Vitest	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-14	Rechazo con HTTP 400 Bad Request cuando se solicita cantidad superior a 1 para un activo individual	Regla de Negocio (§3.6)	Servicio / Unitaria	Crítica	Recurso con es_individual = true	Solicitud de cantidad: 2 para activo individual en asignarRecursosRecuperacionService	Lanza BadRequestError mapeado a HTTP 400 Bad Request	BadRequestError verificado en Vitest	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-15	Rechazo con HTTP 409 Conflict cuando el activo individual se encuentra en EN_MANTENCION, NO_DISPONIBLE o ASIGNADO	Regla de Negocio (§3.6)	Servicio / Unitaria	Crítica	Recurso con es_individual = true en estado EN_MANTENCION o ASIGNADO	Solicitud de cantidad: 1 para activo en EN_MANTENCION o ASIGNADO	Lanza RecursoNoDisponibleError mapeado a HTTP 409 Conflict	RecursoNoDisponibleError verificado en Vitest para EN_MANTENCION y ASIGNADO (e inspeccionado NO_DISPONIBLE)	APROBADO	16/11/2026 23:50	N/A	feat(eventos-atp): logica transaccional for update e inventario hibrido para recuperacion (HU-32)
CP-H32-API-16	Flujo nominal de asignación en servicio con mocks Vitest (creación de misión RECUPERACION, actualización de granel y emisión de sockets)	Funcional / Unitaria	Servicio (Mocks)	Crítica	Mocks de transacción Kysely, repositorios y emisores Socket.io	asignarRecursosRecuperacionService con 10 unidades granel + 1 activo individual disponible	Retorna evento, misión RECUPERACION, patrulla EN_RECUPERACION, recursos actualizados e invoca emisores Socket	16/16 pruebas en recuperacion.asignar.service.test.ts y 9/9 en route.test.ts aprobadas	APROBADO	16/11/2026 23:50	N/A	test(eventos-atp): pruebas unitarias y de integracion para asignacion de recuperacion (HU-32)
CP-H32-API-17	Paginación exacta y eliminación de duplicados en listado de patrullas GET /api/patrullas?page=1&limit=5	Regresión / Consulta	API HTTP / Repo	Alta	9 patrullas registradas en BD	GET /api/patrullas?page=1&limit=5 con Bearer de Encargado	HTTP 200 OK retornando meta.total = 9, totalPages = 2 y exactamente 5 elementos únicos	HTTP 200 OK con meta.total = 9 y data.length = 5 verificado en HTTP real y Vitest	APROBADO	16/11/2026 23:50	N/A	fix(patrullas): eliminar duplicados y preservar paginacion exacta en GET /api/patrullas
CP-H32-API-18	Ejecución integral POST /api/eventos-atp/recuperacion/[id]/asignar contra PostgreSQL real validando inserción de recuperacion_recurso.mision_id	Integración E2E BD	API HTTP / PostgreSQL	Crítica	Migración 041_ aplicada en PostgreSQL y patrulla en estado DISPONIBLE	POST /api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar contra BD real	HTTP 200 OK con fila en recuperacion_recurso vinculada a mision_id y actualización de recurso/patrulla	Integración transaccional validada y migración 041 ejecutada exitosamente	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
CP-H32-API-19	Validación de tipos estáticos TypeScript, ESLint y compilación de producción Next.js Turbopack	Calidad Estática / Build	Build / CI	Alta	Entorno Node.js con dependencias instaladas	npx next typegen && npx tsc --noEmit && npm run lint && npm run build	0 errores de tipos, 0 errores ESLint y compilación exitosa incluyendo rutas HU-32	0 errores en tsc --noEmit, 0 errores en lint y build exitoso	APROBADO	16/11/2026 23:50	18/11/2026 03:40	fix(eventos-atp): subsanar defectos QA BUG-H32-API-01 a BUG-H32-API-07
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Pruebas Automatizadas en Vitest, Tipos Estáticos, Linter y Migraciones

#### 5.1.1 Suite Completa del Repositorio
```bash
npm test
```

**Salida Observada:**
```text
 Test Files  62 passed (62)
      Tests  768 passed (768)
   Start at  23:43:13
   Duration  5.26s
```

#### 5.1.2 Suite Focalizada de HU-32 y Contrato OpenAPI
```bash
npx vitest run src/modules/eventos-atp/__tests__/recuperacion.asignar.service.test.ts src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts src/app/api/eventos-atp/recuperacion/[id]/asignar/__tests__/route.test.ts src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida Observada:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/eventos-atp/__tests__/recuperacion.asignar.service.test.ts (16 tests) 45ms
 ✓ src/app/api/eventos-atp/recuperacion/[id]/__tests__/route.test.ts (5 tests) 42ms
 ✓ src/app/api/eventos-atp/recuperacion/[id]/asignar/__tests__/route.test.ts (9 tests) 53ms
 ✓ src/app/api/eventos-atp/recuperacion/__tests__/route.test.ts (10 tests) 55ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 317ms

 Test Files  5 passed (5)
      Tests  41 passed (41)
   Start at  23:48:23
   Duration  1.92s
```

#### 5.1.3 Ejecución Individual por Patrón de Nombre (`-t`)
```bash
npm test -- -t "Asignación de Recursos a Recuperación \(HU-32\)"
npm test -- -t "POST /api/eventos-atp/recuperacion/\[id\]/asignar \(HU-32\)"
npm test -- -t "GET /api/eventos-atp/recuperacion/\[id\] \(HU-32\)"
```

#### 5.1.4 Validación de Tipos, ESLint, Build y Migración Kysely
```bash
npx next typegen && npx tsc --noEmit
npm run lint
rm -rf .next/dev && npm run build
npm run db:migrate
```

**Salida Observada en `npm run db:migrate` (`BUG-H32-API-07`):**
```text
Ejecutando migraciones Kysely de base de datos...
Error al ejecutar migraciones Kysely: Error: corrupted migrations: previously executed migration 035_permiso_misiones_terreno_verificar is missing
```

**Salida Observada en `git merge-tree --write-tree HEAD origin/develop` (`BUG-H32-API-07`):**
```text
Auto-fusionando package.json
CONFLICTO (contenido): Conflicto de fusión en package.json
```

---

### 5.2 Pruebas HTTP Replicables con cURL (`http://localhost:3001` / Entorno Local)

#### Paso 0: Obtener Tokens JWT (`encargado@valdivia.cl` y `callcenter@valdivia.cl`)
```bash
TOKEN_ENCARGADO=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"encargado@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.token);")

TOKEN_CALLCENTER=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.token);")
```

#### Caso 1: Listado de Eventos de Recuperación (`GET /api/eventos-atp/recuperacion` — `200 OK` / `CP-H32-API-09`)
```bash
curl -s -i -X GET "http://localhost:3001/api/eventos-atp/recuperacion" \
  -H "Authorization: Bearer ${TOKEN_ENCARGADO}"
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"message":"Eventos de recuperación obtenidos exitosamente.","total":1,"data":[{"id":"5837deb6-fe38-4b28-847c-0a59f4b0e602","codigo":"REC-2026-0001","nombre":"Test Recuperacion CLI","descripcion":"Entrega de prueba desde CLI","sector":"Collico","direccionTexto":"Pasaje Los Cipreses 450","prioridad":"ALTA","contactoNombre":"Sra. María González","contactoTelefono":"+56987654321","latitud":-39.8142,"longitud":-73.2459,"estado":"PLANIFICADA","familiasAfectadas":3,"delegacion":{"id":"30000000-0000-4000-8000-000000000001","codigo":"DEL_NORTE","nombre":"Delegación Municipal Norte"},"mision":{"id":"f3a3c065-8c1b-4fb8-a79a-2ca53447108a","codigo":"MIS-2026-0005","titulo":"Test Recuperacion CLI","estado":"COMPLETADA","tipoMision":"RECUPERACION"},"patrulla":{"id":"f1000000-0000-4000-8000-000000000002","nombre":"Patrulla Rápida Centro-Sur","estado":"EN_VERIFICACION"},"recursos":[{"recursoId":"e1000000-0000-4000-8000-000000000004","nombre":"Sacos de Arena de Contención Fluvial","cantidadAsignada":10}],"creadoPorId":"00000000-0000-4000-8000-000000000003","creadoEn":"2026-10-05T01:57:24.323Z","actualizadoEn":"2026-10-05T01:57:24.323Z"}]}
```

#### Caso 2: Detalle del Evento de Recuperación (`GET /api/eventos-atp/recuperacion/[id]` — `200 OK` / `CP-H32-API-08`)
```bash
curl -s -i -X GET "http://localhost:3001/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602" \
  -H "Authorization: Bearer ${TOKEN_ENCARGADO}"
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"message":"Detalle del evento de recuperación obtenido exitosamente.","data":{"id":"5837deb6-fe38-4b28-847c-0a59f4b0e602","codigo":"REC-2026-0001","nombre":"Test Recuperacion CLI","descripcion":"Entrega de prueba desde CLI","sector":"Collico","direccionTexto":"Pasaje Los Cipreses 450","prioridad":"ALTA","contactoNombre":"Sra. María González","contactoTelefono":"+56987654321","latitud":-39.8142,"longitud":-73.2459,"estado":"PLANIFICADA","familiasAfectadas":3,"delegacion":{"id":"30000000-0000-4000-8000-000000000001","codigo":"DEL_NORTE","nombre":"Delegación Municipal Norte"},"misiones":[{"id":"f3a3c065-8c1b-4fb8-a79a-2ca53447108a","codigo":"MIS-2026-0005","titulo":"Test Recuperacion CLI","estado":"COMPLETADA","tipoMision":"RECUPERACION","patrulla":{"id":"f1000000-0000-4000-8000-000000000002","nombre":"Patrulla Rápida Centro-Sur","estado":"EN_VERIFICACION"},"creadoEn":"2026-10-05T01:57:24.323Z"}],"recursosAsignados":[{"id":"f0328863-be79-421e-aa81-074a85801c07","recursoId":"e1000000-0000-4000-8000-000000000004","nombre":"Sacos de Arena de Contención Fluvial","esIndividual":false,"cantidadAsignada":10,"misionId":null,"creadoEn":"2026-10-05T01:57:24.323Z"}],"creadoPorId":"00000000-0000-4000-8000-000000000003","creadoEn":"2026-10-05T01:57:24.323Z","actualizadoEn":"2026-10-05T01:57:24.323Z"}}
```

#### Caso 3: Rechazo por Cabecera `x-user-id` sin Bearer Documentada en OpenAPI (`401 Unauthorized` / `BUG-H32-API-06`)
```bash
curl -s -i -X POST "http://localhost:3001/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000003" \
  -d '{
    "patrullaId": "f1000000-0000-4000-8000-000000000002",
    "recursos": [{"recursoId": "e1000000-0000-4000-8000-000000000004", "cantidad": 5}]
  }'
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 4: Rechazo RBAC sin Permiso `misiones:asignar` (`403 Forbidden` / `CP-H32-API-07`)
```bash
curl -s -i -X POST "http://localhost:3001/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN_CALLCENTER}" \
  -d '{
    "patrullaId": "f1000000-0000-4000-8000-000000000002",
    "recursos": [{"recursoId": "e1000000-0000-4000-8000-000000000004", "cantidad": 5}]
  }'
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"message":"No cuenta con el permiso requerido: misiones:asignar"}
```

#### Caso 5: Rechazo de Validación de Esquema (`400 Bad Request` — `recursos` vacío / `CP-H32-API-03`)
```bash
curl -s -i -X POST "http://localhost:3001/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN_ENCARGADO}" \
  -d '{
    "patrullaId": "f1000000-0000-4000-8000-000000000002",
    "recursos": []
  }'
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"message":"Datos de entrada inválidos para la asignación de recursos a recuperación.","errors":[{"campo":"recursos","mensaje":"Debe asignar al menos un recurso al evento de recuperación"}]}
```

#### Caso 6: Rechazo por Entidad Inexistente (`404 Not Found` — Evento Inexistente / `CP-H32-API-10`)
```bash
curl -s -i -X POST "http://localhost:3001/api/eventos-atp/recuperacion/70000000-0000-4000-8000-000000000999/asignar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN_ENCARGADO}" \
  -d '{
    "patrullaId": "f1000000-0000-4000-8000-000000000002",
    "recursos": [{"recursoId": "e1000000-0000-4000-8000-000000000004", "cantidad": 5}]
  }'
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{"message":"El evento de recuperación indicado no fue encontrado."}
```

#### Caso 7: Conflicto Operativo por Patrulla No Disponible (`409 Conflict` / `CP-H32-API-12`)
```bash
curl -s -i -X POST "http://localhost:3001/api/eventos-atp/recuperacion/5837deb6-fe38-4b28-847c-0a59f4b0e602/asignar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN_ENCARGADO}" \
  -d '{
    "patrullaId": "f1000000-0000-4000-8000-000000000002",
    "recursos": [{"recursoId": "e1000000-0000-4000-8000-000000000004", "cantidad": 5}]
  }'
```

**Respuesta HTTP/JSON Obtenida:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{"message":"La patrulla \"Patrulla Rápida Centro-Sur\" no está disponible para asignación (estado actual: EN_VERIFICACION)."}
```

#### Caso 8: Paginación Exacta de Patrullas (`GET /api/patrullas?page=1&limit=5` — `200 OK` / `CP-H32-API-17`)
```bash
curl -s -X GET "http://localhost:3001/api/patrullas?page=1&limit=5" \
  -H "Authorization: Bearer ${TOKEN_ENCARGADO}" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('meta:', d.meta, 'count:', d.data.length);"
```

**Salida Observada:**
```text
meta: { total: 9, page: 1, limit: 5, totalPages: 2, hasNext: true, hasPrev: false } count: 5
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (Backend `sgrai-api`)

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Dentro de la vista de detalle de un evento de recuperación (`recuperacion`), el sistema debe proveer una sección para asignar patrullas e inventario logístico. | `CP-H32-API-08`, `CP-H32-API-09`, `CP-H32-API-17`, `BUG-H32-API-06` | 🟡 **PARCIAL / OBSERVADO** | Los endpoints `GET /api/eventos-atp/recuperacion/[id]`, `GET /api/eventos-atp/recuperacion`, `GET /api/patrullas` y `POST .../asignar` existen y responden, pero OpenAPI presenta desajustes de versión/auth (`BUG-H32-API-06`). El componente visual corresponde a `sgrai-web`. |
| **CA-2:** Permite seleccionar patrullas verificadoras disponibles. Al confirmar, se crea una misión con `tipo_mision = 'RECUPERACION'`, vinculada a la patrulla y al `recuperacion_id`, transicionando la patrulla a `EN_RECUPERACION`. | `CP-H32-API-12`, `CP-H32-API-16`, `BUG-H32-API-01`, `BUG-H32-API-02`, `BUG-H32-API-04` | 🔴 **CON DEFECTOS ABIERTOS** | Faltan `.forUpdate()` y `WHERE estado = 'DISPONIBLE'` en `patrulla_verificadora` (`BUG-H32-API-01`), `pg_advisory_xact_lock` en `mision.codigo` (`BUG-H32-API-02`), y cumplimiento ICS en `fecha_inicio: null` / `mision_hito` / `disponible_terreno` (`BUG-H32-API-04`). |
| **CA-3:** Permite seleccionar insumos y herramientas del inventario logístico (`recurso`), especificando la cantidad asignada. | `CP-H32-API-01`, `CP-H32-API-03`, `CP-H32-API-04`, `CP-H32-API-10` | 🟢 **CUMPLIDO** | `AsignarRecursosRecuperacionInputSchema` valida arreglo no vacío de `{ recursoId, cantidad >= 1 }`. |
| **CA-4:** Regla de negocio §3.6: la API debe ejecutar un bloqueo transaccional `SELECT ... FOR UPDATE` sobre `recurso`, verificando para `es_individual = false` que `cantidad_inventario - cantidad_en_uso >= cantidad_solicitada`, impidiendo la asignación si el stock es insuficiente. | `CP-H32-API-13`, `CP-H32-API-16` | 🟢 **CUMPLIDO** | `obtenerRecursosParaBloqueo` aplica `.forUpdate()` sobre `recurso` dentro de `db.transaction()` y valida el stock disponible para insumos a granel lanzando `409 Conflict`. |
| **CA-5:** Para activos individuales (`es_individual = true`, vehículos, bombas), se prohíbe la asignación si el recurso se encuentra en estado `EN_MANTENCION` o `NO_DISPONIBLE`. | `CP-H32-API-14`, `CP-H32-API-15`, `BUG-H32-API-03` | 🔴 **CON DEFECTOS ABIERTOS** | Rechaza `EN_MANTENCION`, `NO_DISPONIBLE` y `ASIGNADO`, pero omite verificar `cantidad_inventario - cantidad_en_uso >= 1` y corrompe `cantidad_en_uso` a `1` en activos multiunidad (`BUG-H32-API-03`). |
| **CA-6:** La asignación de materiales debe persistirse en la tabla `recuperacion_recurso` y actualizar el campo `cantidad_en_uso` en la tabla `recurso`. | `CP-H32-API-16`, `CP-H32-API-18`, `BUG-H32-API-03`, `BUG-H32-API-07` | 🔴 **BLOQUEADO / CON DEFECTOS** | Persistencia unitaria probada con mocks; en BD real `041_recuperacion_recurso_mision_id.ts` está bloqueada por `BUG-H32-API-07` y `es_individual = true` sobrescribe erróneamente `cantidad_en_uso` (`BUG-H32-API-03`). |
| **CA-7:** El sistema debe emitir los eventos WebSocket `recuperacion:actualizada` y `recurso:actualizado`. | `CP-H32-API-16`, `BUG-H32-API-05` | 🔴 **CON DEFECTOS ABIERTOS** | Emite ambos eventos en memoria, pero en el broker Redis Pub/Sub omite salas `"encargado"`/`"mapa"` y `"supervisor"`, y envía recurso en `snake_case` (`BUG-H32-API-05`). |
| **CA-8:** El endpoint debe requerir el permiso RBAC `misiones:asignar`. | `CP-H32-API-06`, `CP-H32-API-07` | 🟢 **CUMPLIDO** | `POST /api/eventos-atp/recuperacion/[id]/asignar` exige token JWT válido (`401`) y valida `PERMISO_ASIGNAR_MISION` (`misiones:asignar`) devolviendo `403` ante permisos insuficientes. |
