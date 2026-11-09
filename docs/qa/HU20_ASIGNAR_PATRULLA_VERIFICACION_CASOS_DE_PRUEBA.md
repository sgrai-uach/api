# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-20 — Asignar Patrulla Verificadora a Incidente (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones Tácticas e Incidentes (`sgrai-api` — `POST /api/misiones` y `GET /api/patrullas?estado=DISPONIBLE`).  
> **Historia de Usuario:** HU-20 — *"Como Encargado Quiero asignar una patrulla verificadora disponible a un incidente para que evalúe y verifique las necesidades reales en terreno. Para desplegar de inmediato personal calificado que levante el diagnóstico técnico antes de movilizar recursos pesados o cuadrillas."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h20-asignar-patrulla-verificacion`  
> **Commits Evaluados en la Rama (Conventional Commits):**  
> * `feat(misiones): crear migracion y tipos para tabla mision_hito (HU-20)`  
> * `feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)`  
> * `feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)`  
> * `test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)`  
> * `feat(seed): agregar script para sembrar patrullas verificadoras de prueba`  
> * `test(misiones): tipar mock de usuario autenticado en pruebas de ruta`  
> * `merge: integrar develop en feature/h20-asignar-patrulla-verificacion resolviendo conflictos`  
> * `fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20)`  
>  
> **Fecha de Auditoría Inicial:** 06/11/2026 12:38.  
> **Fecha de Re-Test y Certificación Final:** 08/11/2026 12:28.  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Cumplidos — 5 Defectos Subsanados en Re-Test)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar la inspección forense de código fuente, verificación de transacciones ACID en Kysely/PostgreSQL, revisión del encadenamiento de migraciones respecto a `develop`, validación de reglas de negocio del Sistema de Comando de Incidentes (ICS), difusión de eventos en tiempo real vía Socket.io/Redis, contratos OpenAPI 3.0 y pruebas automatizadas en Vitest sobre la rama `feature/h20-asignar-patrulla-verificacion`, se dictamina el estado **CERTIFICADO / APROBADO (`Approved`)** tras verificar la corrección íntegra de los **5 defectos** detectados en la revisión inicial (`BUG-H20-API-01` a `BUG-H20-API-05`).

### Verificación de Correcciones en Re-Test (08/11/2026 12:28)
1. **Protección contra Doble Despacho Concurrente (`BUG-H20-API-01` — Resuelto):** En `crearMisionVerificacionRepo` (`src/modules/misiones/mision.repository.ts:387-392, 484-499`) se incorporó bloqueo pesimista `.forUpdate()` en la consulta inicial de `incidente` y la condición atómica `.where("estado", "=", "REPORTADO")` en el `UPDATE incidente`, arrojando `ConflictError` (`409 Conflict`) ante cualquier modificación concurrente.
2. **Aislamiento de Rama y Renumeración de Migración (`BUG-H20-API-02` — Resuelto):** Se eliminaron de la rama todos los archivos ajenos provenientes de HU-85 restaurando el módulo de patrullas al estado de `develop`, y se renumeró la migración de bitácora a `src/lib/db/migrations/028_mision_hito_bitacora.ts`, eliminando toda colisión de correlativos en el directorio de migraciones.
3. **Generación Secuencial e Inmutable de `mision.codigo` (`BUG-H20-API-03` — Resuelto):** En `crearMisionVerificacionRepo` (`src/modules/misiones/mision.repository.ts:436-458`) se sustituyó `Math.random()` por un bloqueo consultivo transaccional en PostgreSQL (`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`) que calcula el siguiente correlativo secuencial anual (`MIS-YYYY-NNNN`) con `padStart(4, "0")`.
4. **Ciclo de Vida ICS (`fecha_inicio: null`) y Lectura de `mision_hito` (`BUG-H20-API-04` — Resuelto):** La misión se persiste con `fecha_inicio: null` al ser despachada en estado `'DESPACHADA'` (`mision.repository.ts:478`), y `obtenerMisionDetallePorIdRepo` (`mision.repository.ts:313-334`) junto con `obtenerDetalleMisionService` (`mision.service.ts:61-66`) consultan y exponen los hitos reales registrados en la tabla `mision_hito`.
5. **Difusión Completa de Eventos WebSocket en Redis (`BUG-H20-API-05` — Resuelto):** En `src/lib/socket/index.ts` (`L.602-617` y `L.697-715`), tanto `notificarPatrullaActualizada` como `notificarMisionAsignada` publican en el canal Redis (`REDIS_SOCKET_CHANNEL`) hacia la totalidad de las salas operativas (`encargado`, `sala:encargados`, `supervisor`, `mapa` y `patrulla:{id}`).

| Métrica de Calidad | Auditoría Inicial (06/11/2026) | Re-Test Final (08/11/2026) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | 25 | **25** | 5 Defectos Subsanados (`BUG-H20-API-01` a `05`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io (`CP-H20-API-01` a `20`) |
| **Casos Aprobados (Passed)** | 20 | **25** | 100% de casos funcionales, transaccionales, concurrencia, RBAC y tiempo real aprobados |
| **Defectos Abiertos / Fallidos (Failed)** | 5 | **0** | 5/5 defectos corregidos y verificados en Re-Test |
| **Casos Bloqueados (Blocked)** | 0 | **0** | Sin bloqueos de entorno o infraestructura |
| **Tasa de Aprobación (% Pass)** | 80.0% | **100.0%** | Cumplimiento total de criterios de aceptación para merge a `develop` |
| **Suite Focalizada de Misiones (Vitest)** | 26/26 tests pass | **27/27 tests pass** | `mision.schema.test.ts` (11), `mision.service.test.ts` (5), `route.test.ts` (10) y `openapi.json` (1) |
| **Chequeo de Tipos (`tsc --noEmit`) y ESLint** | 0 errores | **0 errores** | Compilación limpia y 0 advertencias/errores en los módulos modificados |
| **Secuencia de Migraciones Kysely** | 🔴 Doble colisión (`032_` y `033_`) | 🟢 **Secuencia íntegra (`028_`)** | `028_mision_hito_bitacora.ts` sin colisiones respecto a `develop` |

---

## 2. Registro Técnico de Defectos Subsanados

### `BUG-H20-API-01`: Condición de Carrera TOCTOU sobre el Incidente — Ausencia de Bloqueo Pesimista (`forUpdate()`) y de Condición Atómica `.where("estado", "=", "REPORTADO")` al Actualizar `incidente`, Permitiendo Doble Despacho de Patrullas a un Mismo Incidente
* **Severidad:** **CRÍTICA** (Violación de Atomicidad Transaccional y Flujo de Evaluación Primaria ICS).
* **Estado Post Re-Test (08/11/2026 12:28):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 387-392 y 484-499).
* **Descripción Técnica del Defecto Inicial:**  
  En `crearMisionVerificacionRepo`, la lectura inicial de `incidente` se ejecutaba mediante un `SELECT` plano sin `.forUpdate()`, y la transición posterior a `'VERIFICANDO'` no condicionaba `.where("estado", "=", "REPORTADO")`. Esto permitía que dos peticiones concurrentes asignaran dos patrullas distintas al mismo incidente en estado `'REPORTADO'`.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se incorporó `.forUpdate()` en la consulta inicial de `incidente` dentro de la transacción Kysely y se agregó `.where("estado", "=", "REPORTADO")` en el `updateTable("incidente")`, lanzando `ConflictError` si el registro fue modificado concurrentemente:
  ```typescript
  const incidente = await trx
    .selectFrom("incidente")
    .select(["id", "codigo", "estado", "prioridad", "tipo_afectacion", "delegacion_id"])
    .where("id", "=", input.incidenteId)
    .forUpdate()
    .executeTakeFirst();
  ```
  ```typescript
  const incidenteActualizado = await trx
    .updateTable("incidente")
    .set({
      estado: "VERIFICANDO",
      actualizado_en: new Date(),
    })
    .where("id", "=", input.incidenteId)
    .where("estado", "=", "REPORTADO")
    .returning(["id", "codigo", "estado", "prioridad"])
    .executeTakeFirst();

  if (!incidenteActualizado) {
    throw new ConflictError(
      `El incidente con ID '${input.incidenteId}' ya no se encuentra en estado 'REPORTADO' (fue modificado concurrentemente).`
    );
  }
  ```

---

### `BUG-H20-API-02`: Contaminación de Rama con Código Ajeno de HU-85 y Colisión Doble de Correlativos en Migraciones Kysely (`032_` y `033_`) contra `develop`
* **Severidad:** **CRÍTICA** (Integridad de Control de Versiones Gitflow y Secuencia de Migraciones en CI/CD).
* **Estado Post Re-Test (08/11/2026 12:28):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/lib/db/migrations/028_mision_hito_bitacora.ts`.
* **Descripción Técnica del Defecto Inicial:**  
  La rama arrastraba 9 archivos del commit de HU-85 (`DELETE /api/patrullas/[id]`) y provocaba dos colisiones de correlativos en `src/lib/db/migrations/` (`032_patrulla_desactivacion_baja_logica.ts` con `032_cuadrilla_baja_logica_activo.ts`, y `033_mision_hito_bitacora.ts` con `033_patrullas_codigo_vehiculo.ts`).
* **Solución Aplicada y Verificada en Re-Test:**  
  Se revirtieron todos los archivos ajenos a HU-20 restaurando el módulo de patrullas al estado exacto de `develop` y se renombró la migración de `mision_hito` a `src/lib/db/migrations/028_mision_hito_bitacora.ts`, dejando una secuencia lineal limpia (`027_`, `028_`, `030_`, `031_`, `032_`, `033_`).

---

### `BUG-H20-API-03`: Generación Pseudoaleatoria No Secuencial de `mision.codigo` (`Math.random()`) con Riesgo de Colisión Concurrente (`23505` -> `500`) y Degradación por Agotamiento en `crearMisionVerificacionRepo`
* **Severidad:** **ALTA** (Integridad de Datos, Nomenclatura Institucional y Concurrencia en Base de Datos).
* **Estado Post Re-Test (08/11/2026 12:28):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 436-458).
* **Descripción Técnica del Defecto Inicial:**  
  La generación del código de misión utilizaba `Math.floor(1000 + Math.random() * 9000)`, produciendo folios aleatorios no correlativos y expuestos a `unique_violation` (`23505`) bajo concurrencia.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se implementó un bloqueo consultivo transaccional en PostgreSQL (`pg_advisory_xact_lock`) y el cálculo secuencial del correlativo anual (`MIS-YYYY-NNNN`):
  ```typescript
  await sql`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.execute(trx);

  const year = new Date().getFullYear();
  const prefijo = `MIS-${year}-`;

  const ultimaMision = await trx
    .selectFrom("mision")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .orderBy("codigo", "desc")
    .limit(1)
    .executeTakeFirst();

  let correlativo = 1;
  if (ultimaMision?.codigo) {
    const partes = ultimaMision.codigo.split("-");
    const num = parseInt(partes[2] || "0", 10);
    if (!isNaN(num) && num >= 1) {
      correlativo = num + 1;
    }
  }
  const codigo = `${prefijo}${String(correlativo).padStart(4, "0")}`;
  ```

---

### `BUG-H20-API-04`: Asignación Prematura de `mision.fecha_inicio` en Estado `'DESPACHADA'` y Omisión de Lectura de `mision_hito` en `obtenerMisionDetallePorIdRepo` (`GET /api/misiones/{id}`)
* **Severidad:** **ALTA** (Inconsistencia en Bitácora Cronológica de Misión y Ciclo de Vida ICS).
* **Estado Post Re-Test (08/11/2026 12:28):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 312-334 y 465-481)
  * `src/modules/misiones/mision.service.ts` (Líneas 58-67)
  * `src/modules/misiones/__tests__/mision.service.test.ts` (Líneas 189-232)
* **Descripción Técnica del Defecto Inicial:**  
  Al crear la misión en estado `'DESPACHADA'`, `crearMisionVerificacionRepo` fijaba `fecha_inicio: new Date()` en lugar de `null`, generando prematuramente el hito `"DESPLIEGUE_INICIO"` en `GET /api/misiones/{id}`, además de no consultar la tabla `mision_hito`.
* **Solución Aplicada y Verificada en Re-Test:**  
  Se fijó `fecha_inicio: null` en la inserción de `mision` en estado `'DESPACHADA'`, se añadió la consulta a `mision_hito` ordenada por `creado_en ASC` en `obtenerMisionDetallePorIdRepo`, y se actualizó `obtenerDetalleMisionService` para poblar `bitacoraTiempos` a partir de los hitos persistidos en `mision_hito` (con cobertura unitaria verificada en `mision.service.test.ts`).

---

### `BUG-H20-API-05`: Publicación Incompleta de Eventos WebSocket en el Broker Redis (`notificarPatrullaActualizada` y `notificarMisionAsignada`) Omitiendo las Salas `mapa`, `supervisor` y `sala:encargados`
* **Severidad:** **MEDIA** (Desincronización de Tiempo Real en Mapa Interactivo y Panel de Supervisión vía Redis Pub/Sub).
* **Estado Post Re-Test (08/11/2026 12:28):** 🟢 **CORREGIDO Y CERTIFICADO**.
* **Archivo Afectado:** `src/lib/socket/index.ts` (Líneas 602-617 y 697-715).
* **Descripción Técnica del Defecto Inicial:**  
  Cuando `ioInstance` era `null` y los eventos se emitían mediante el publicador Redis (`REDIS_SOCKET_CHANNEL`), `notificarPatrullaActualizada` publicaba únicamente hacia `"encargado"` (omitiendo `"mapa"`, `"supervisor"`, `"sala:encargados"` y `patrulla:${id}`), y `notificarMisionAsignada` omitía `"sala:encargados"` y `"supervisor"`.
* **Solución Aplicada y Verificada en Re-Test:**  
  Ambas funciones iteran ahora sobre la lista completa de salas operativas al publicar en `REDIS_SOCKET_CHANNEL`, garantizando paridad total entre la emisión directa en memoria y la difusión por Redis Pub/Sub.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H20-API-01` | Condición de carrera TOCTOU en incidente sin SELECT FOR UPDATE ni WHERE estado = REPORTADO permitiendo doble despacho | Concurrencia / ICS | Repositorio / BD | Crítica | Incidente en estado REPORTADO y 2 patrullas en estado DISPONIBLE | 2 peticiones concurrentes POST /api/misiones al mismo incidenteId con Patrulla A y Patrulla B | Primera petición responde 201 Created; segunda petición aborta con 409 Conflict por incidente ya en VERIFICANDO | Lectura de incidente protegida con .forUpdate() y UPDATE condicionado con .where('estado', '=', 'REPORTADO') lanzando ConflictError (409) | CORREGIDO | 06/11/2026 12:38 | 08/11/2026 12:28 | fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20) |
| `BUG-H20-API-02` | Contaminación de rama con archivos de HU-85 y doble colisión de correlativos de migración Kysely (032_ y 033_) | Integración / Migraciones | Base de Datos / Git | Crítica | Árbol de migraciones en src/lib/db/migrations comparado con develop | git diff develop...feature/h20-asignar-patrulla-verificacion y listado de src/lib/db/migrations | Rama aislada solo con cambios de HU-20 y migración mision_hito con correlativo único 028_ | Archivos de HU-85 revertidos al estado de develop y migración renumerada a 028_mision_hito_bitacora.ts sin colisiones | CORREGIDO | 06/11/2026 12:38 | 08/11/2026 12:28 | fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20) |
| `BUG-H20-API-03` | Generación pseudoaleatoria no secuencial de mision.codigo (Math.random) con riesgo de colisión concurrente 23505 y bucle infinito | Integridad / Concurrencia | Repositorio / BD | Alta | Despacho de misiones consecutivas o simultáneas en POST /api/misiones | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Código correlativo secuencial único MIS-YYYY-NNNN protegido contra colisiones concurrentes | Generación secuencial MIS-YYYY-NNNN implementada con pg_advisory_xact_lock(hashtext('mision_codigo_seq')) y padStart(4, '0') | CORREGIDO | 06/11/2026 12:38 | 08/11/2026 12:28 | fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20) |
| `BUG-H20-API-04` | Asignación prematura de fecha_inicio en estado DESPACHADA y omisión de consulta a mision_hito en GET /api/misiones/{id} | Regla de Negocio ICS | Repositorio / Servicio | Alta | Misión recién creada en estado DESPACHADA vía POST /api/misiones | POST /api/misiones seguido de GET /api/misiones/{id} | fecha_inicio en null mientras está DESPACHADA y bitacoraTiempos poblada desde la tabla mision_hito | Misión creada con fecha_inicio: null en estado DESPACHADA y bitacoraTiempos poblada desde mision_hito en obtenerDetalleMisionService | CORREGIDO | 06/11/2026 12:38 | 08/11/2026 12:28 | fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20) |
| `BUG-H20-API-05` | Publicación incompleta de eventos Socket.io en broker Redis omitiendo salas mapa, supervisor y sala:encargados | Tiempo Real / Redis | Infraestructura / Socket | Media | Worker HTTP sin ioInstance en memoria publicando vía REDIS_SOCKET_CHANNEL | POST /api/misiones con REDIS_URL activo | Publicación en Redis de patrulla:actualizada y mision:asignada a todas las salas (mapa, encargado, sala:encargados, supervisor, patrulla:{id}) | notificarPatrullaActualizada y notificarMisionAsignada publican en REDIS_SOCKET_CHANNEL hacia todas las salas operativas requeridas | CORREGIDO | 06/11/2026 12:38 | 08/11/2026 12:28 | fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20) |
| `CP-H20-API-01` | Listado de patrullas verificadoras filtrando exclusivamente unidades en estado DISPONIBLE para el selector | Funcional / Consulta | API / Integración | Crítica | Patrullas activas registradas en distintos estados operativos | GET /api/patrullas?estado=DISPONIBLE con Header Authorization: Bearer <token_encargado> | HTTP 200 OK retornando únicamente patrullas activas (eliminado_en IS NULL) cuyo estado es DISPONIBLE | HTTP 200 OK con listado filtrado exclusivamente por estado DISPONIBLE | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | merge: sincronizar con develop y adaptar repositorio de patrullas a modelo de disponibilidad (HU-11) |
| `CP-H20-API-02` | Despacho atómico exitoso de patrulla disponible a incidente REPORTADO creando misión VERIFICACION en estado DESPACHADA | Funcional / Transaccional | API / Servicio / BD | Crítica | Incidente en estado REPORTADO y patrulla en estado DISPONIBLE | POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Verificación de anegamiento","prioridad":"ALTA"} | HTTP 201 Created con mision.tipoMision = 'VERIFICACION', mision.estado = 'DESPACHADA' y patrullaId vinculada | HTTP 201 Created creando registro en mision con tipo VERIFICACION, estado DESPACHADA y fechaInicio: null | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |
| `CP-H20-API-03` | Transición atómica de incidente.estado a VERIFICANDO al confirmar la asignación de patrulla | Regla de Negocio ICS | Repositorio / BD | Crítica | Incidente existente en estado REPORTADO | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Columna incidente.estado actualizada a 'VERIFICANDO' dentro de la misma transacción Kysely | data.incidente.estado retorna 'VERIFICANDO' persistido en la tabla incidente | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-04` | Transición atómica de patrulla_verificadora.estado a EN_VERIFICACION al confirmar el despacho | Regla de Negocio ICS | Repositorio / BD | Crítica | Patrulla existente activa en estado DISPONIBLE | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Columna patrulla_verificadora.estado actualizada a 'EN_VERIFICACION' de forma atómica | data.patrulla.estado retorna 'EN_VERIFICACION' persistido en patrulla_verificadora | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-05` | Registro automático del hito inicial DESPACHADA en la tabla mision_hito dentro de la transacción | Auditoría / Trazabilidad | Repositorio / BD | Crítica | Tabla mision_hito creada en base de datos | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Inserción en mision_hito con hito = 'DESPACHADA', mision_id y registrado_por_id del Encargado | data.hitoInicial retorna registro con hito = 'DESPACHADA' y descripción de asignación | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): crear migracion y tipos para tabla mision_hito (HU-20) |
| `CP-H20-API-06` | Emisión de evento WebSocket mision:asignada a la sala específica patrulla:{id} y a encargado | Tiempo Real / Socket.io | Servicio / Socket | Alta | Instancia Socket.io activa durante el despacho | POST /api/misiones con patrullaId = f1000000-0000-4000-8000-000000000001 | Emisión de evento 'mision:asignada' hacia la sala 'patrulla:f1000000-0000-4000-8000-000000000001' y 'encargado' | notificarMisionAsignada invocado con misionId, codigo, tipoMision, patrullaId e incidenteId | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-07` | Emisión de evento WebSocket incidente:actualizado a las salas encargado y mapa con nuevoEstado VERIFICANDO | Tiempo Real / Kanban | Servicio / Socket | Alta | Instancia Socket.io o Redis activa durante el despacho | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Emisión de 'incidente:actualizado' a 'encargado' y 'mapa' para mover tarjeta Kanban a columna VERIFICANDO | notificarIncidenteActualizado emitido con nuevoEstado = 'VERIFICANDO' a encargado y mapa | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-08` | Rechazo con HTTP 409 Conflict cuando la patrulla seleccionada cambió concurrentemente a estado no disponible | Concurrencia / ICS | Repositorio / API | Crítica | Patrulla en estado EN_VERIFICACION o NO_DISPONIBLE al ejecutar el UPDATE atómico | POST /api/misiones hacia patrullaId que ya no está en estado DISPONIBLE | HTTP 409 Conflict abortando la transacción sin crear misión ni alterar el incidente | HTTP 409 Conflict: "La patrulla verificadora '...' ya no se encuentra en estado 'DISPONIBLE' (estado actual: 'EN_VERIFICACION')." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20) |
| `CP-H20-API-09` | Rechazo con HTTP 409 Conflict cuando el incidente no se encuentra en estado REPORTADO | Regla de Negocio ICS | Repositorio / API | Crítica | Incidente en estado VERIFICANDO, EN_ATENCION o RESUELTO | POST /api/misiones con incidenteId en estado VERIFICANDO | HTTP 409 Conflict indicando que solo se pueden verificar incidentes en estado REPORTADO | HTTP 409 Conflict: "El incidente se encuentra en estado 'VERIFICANDO', por lo que no puede ser asignado a una patrulla verificadora..." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-10` | Denegación con HTTP 401 Unauthorized cuando la petición a POST /api/misiones carece de token JWT Bearer | Seguridad / Auth | API / AuthGuard | Crítica | Petición sin cabecera Authorization: Bearer <token> | POST /api/misiones sin cabeceras de autenticación | HTTP 401 Unauthorized rechazando el acceso anónimo | HTTP 401 Unauthorized devuelto por verificarAsignarMision | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |
| `CP-H20-API-11` | Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar | Seguridad / RBAC | API / AuthGuard | Crítica | Usuario con rol Call Center, Supervisor o Patrulla sin permiso misiones:asignar | POST /api/misiones con JWT de usuario sin permiso misiones:asignar | HTTP 403 Forbidden exigiendo el permiso misiones:asignar o perfil Administrador | HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador o el permiso 'misiones:asignar' para despachar misiones operativas." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-12` | Autorización exitosa para usuario con rol Encargado (poseedor del permiso misiones:asignar) o Administrador | Seguridad / RBAC | AuthGuard / Semilla BD | Alta | Rol Encargado con permiso misiones:asignar en tabla rol_permiso | POST /api/misiones con JWT de Encargado de Operaciones | Acceso permitido al servicio de asignación retornando 201 Created | verificarAsignarMision valida satisfactoriamente el permiso misiones:asignar | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-13` | Rechazo con HTTP 404 Not Found cuando el incidenteId proporcionado no existe en la base de datos | Manejo de Errores | Repositorio / API | Alta | UUID de incidente inexistente en tabla incidente | POST /api/misiones con incidenteId = 50000000-0000-4000-8000-999999999999 | HTTP 404 Not Found indicando que el incidente no fue encontrado | HTTP 404 Not Found: "Incidente con ID '...' no encontrado." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-14` | Rechazo con HTTP 404 Not Found cuando la patrullaId no existe o fue dada de baja lógica (eliminado_en IS NOT NULL) | Manejo de Errores / Baja Lógica | Repositorio / API | Alta | UUID de patrulla inexistente o con eliminado_en != null | POST /api/misiones con patrullaId = f1000000-0000-4000-8000-999999999999 | HTTP 404 Not Found impidiendo despachar patrullas inexistentes o desactivadas | HTTP 404 Not Found: "Patrulla verificadora con ID '...' no existe o ha sido desactivada." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-15` | Rechazo con HTTP 400 Bad Request ante payload con formato JSON sintácticamente inválido | Robustez / Contrato | API / Route | Media | Petición POST con cuerpo en texto plano malformado | POST /api/misiones con body "no-json-body" | HTTP 400 Bad Request indicando que el cuerpo debe ser un formato JSON válido | HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |
| `CP-H20-API-16` | Rechazo con HTTP 400 Bad Request cuando incidenteId o patrullaId no cumplen el formato UUID | Validación (Zod) | Schema / API | Media | Esquema CrearMisionVerificacionSchema | POST /api/misiones con {"incidenteId":"invalido","patrullaId":"patrulla-123"} | HTTP 400 Bad Request detallando los errores de validación por campo | HTTP 400 Bad Request con message "Datos de misión inválidos." y detalle en errors | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20) |
| `CP-H20-API-17` | Rechazo con HTTP 400 Bad Request cuando el título opcional tiene menos de 3 o más de 150 caracteres | Validación (Zod) | Schema / API | Baja | Esquema CrearMisionVerificacionSchema | POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Ok"} | HTTP 400 Bad Request indicando longitud mínima de 3 caracteres | Validación Zod rechaza con "El título debe contener al menos 3 caracteres." | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20) |
| `CP-H20-API-18` | Autogeneración de título por defecto y herencia de prioridad del incidente cuando se omiten campos opcionales | Funcional / Defaults | Esquema / Repositorio | Media | Payload mínimo solo con incidenteId y patrullaId | POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | tipoMision = 'VERIFICACION', titulo = 'Verificación de Incidente <CODIGO>' y prioridad heredada del incidente | Asignación por defecto aplicada en esquema Zod y repositorio | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-19` | Resiliencia de la respuesta HTTP 201 Created si ocurre una excepción al emitir eventos WebSocket | Resiliencia / Tolerancia a Fallos | Servicio | Media | Fallo simulado en el servidor Socket.io o Redis tras el commit en BD | POST /api/misiones con transacción exitosa y excepción en notificarMisionAsignada | La transacción en BD se preserva y el endpoint responde 201 Created registrando el error en log | Bloque try/catch en asignarPatrullaVerificacionService captura el error de socket sin abortar la respuesta 201 | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-20` | Registro y exposición del contrato OpenAPI 3.0 para POST /api/misiones en GET /openapi.json | Contrato API / OpenAPI | OpenAPI Spec | Alta | Generador OpenApiGeneratorV3 en src/lib/openapi/index.ts | GET /openapi.json verificando paths["/api/misiones"].post | Operación POST /api/misiones documentada con CrearMisionVerificacionSchema, CrearMisionResponseSchema y códigos 201, 400, 401, 403, 404, 409 y 500 | Especificación OpenAPI 3.0 generada y validada sin errores | APROBADO | 06/11/2026 12:38 | 08/11/2026 12:28 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H20-API-01	Condición de carrera TOCTOU en incidente sin SELECT FOR UPDATE ni WHERE estado = REPORTADO permitiendo doble despacho	Concurrencia / ICS	Repositorio / BD	Crítica	Incidente en estado REPORTADO y 2 patrullas en estado DISPONIBLE	2 peticiones concurrentes POST /api/misiones al mismo incidenteId con Patrulla A y Patrulla B	Primera petición responde 201 Created; segunda petición aborta con 409 Conflict por incidente ya en VERIFICANDO	Lectura de incidente protegida con .forUpdate() y UPDATE condicionado con .where('estado', '=', 'REPORTADO') lanzando ConflictError (409)	CORREGIDO	06/11/2026 12:38	08/11/2026 12:28	fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20)
BUG-H20-API-02	Contaminación de rama con archivos de HU-85 y doble colisión de correlativos de migración Kysely (032_ y 033_)	Integración / Migraciones	Base de Datos / Git	Crítica	Árbol de migraciones en src/lib/db/migrations comparado con develop	git diff develop...feature/h20-asignar-patrulla-verificacion y listado de src/lib/db/migrations	Rama aislada solo con cambios de HU-20 y migración mision_hito con correlativo único 028_	Archivos de HU-85 revertidos al estado de develop y migración renumerada a 028_mision_hito_bitacora.ts sin colisiones	CORREGIDO	06/11/2026 12:38	08/11/2026 12:28	fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20)
BUG-H20-API-03	Generación pseudoaleatoria no secuencial de mision.codigo (Math.random) con riesgo de colisión concurrente 23505 y bucle infinito	Integridad / Concurrencia	Repositorio / BD	Alta	Despacho de misiones consecutivas o simultáneas en POST /api/misiones	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Código correlativo secuencial único MIS-YYYY-NNNN protegido contra colisiones concurrentes	Generación secuencial MIS-YYYY-NNNN implementada con pg_advisory_xact_lock(hashtext('mision_codigo_seq')) y padStart(4, '0')	CORREGIDO	06/11/2026 12:38	08/11/2026 12:28	fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20)
BUG-H20-API-04	Asignación prematura de fecha_inicio en estado DESPACHADA y omisión de consulta a mision_hito en GET /api/misiones/{id}	Regla de Negocio ICS	Repositorio / Servicio	Alta	Misión recién creada en estado DESPACHADA vía POST /api/misiones	POST /api/misiones seguido de GET /api/misiones/{id}	fecha_inicio en null mientras está DESPACHADA y bitacoraTiempos poblada desde la tabla mision_hito	Misión creada con fecha_inicio: null en estado DESPACHADA y bitacoraTiempos poblada desde mision_hito en obtenerDetalleMisionService	CORREGIDO	06/11/2026 12:38	08/11/2026 12:28	fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20)
BUG-H20-API-05	Publicación incompleta de eventos Socket.io en broker Redis omitiendo salas mapa, supervisor y sala:encargados	Tiempo Real / Redis	Infraestructura / Socket	Media	Worker HTTP sin ioInstance en memoria publicando vía REDIS_SOCKET_CHANNEL	POST /api/misiones con REDIS_URL activo	Publicación en Redis de patrulla:actualizada y mision:asignada a todas las salas (mapa, encargado, sala:encargados, supervisor, patrulla:{id})	notificarPatrullaActualizada y notificarMisionAsignada publican en REDIS_SOCKET_CHANNEL hacia todas las salas operativas requeridas	CORREGIDO	06/11/2026 12:38	08/11/2026 12:28	fix(misiones): resolver observaciones de qa sobre concurrencia, correlativo, migraciones y sockets (HU-20)
CP-H20-API-01	Listado de patrullas verificadoras filtrando exclusivamente unidades en estado DISPONIBLE para el selector	Funcional / Consulta	API / Integración	Crítica	Patrullas activas registradas en distintos estados operativos	GET /api/patrullas?estado=DISPONIBLE con Header Authorization: Bearer <token_encargado>	HTTP 200 OK retornando únicamente patrullas activas (eliminado_en IS NULL) cuyo estado es DISPONIBLE	HTTP 200 OK con listado filtrado exclusivamente por estado DISPONIBLE	APROBADO	06/11/2026 12:38	08/11/2026 12:28	merge: sincronizar con develop y adaptar repositorio de patrullas a modelo de disponibilidad (HU-11)
CP-H20-API-02	Despacho atómico exitoso de patrulla disponible a incidente REPORTADO creando misión VERIFICACION en estado DESPACHADA	Funcional / Transaccional	API / Servicio / BD	Crítica	Incidente en estado REPORTADO y patrulla en estado DISPONIBLE	POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Verificación de anegamiento","prioridad":"ALTA"}	HTTP 201 Created con mision.tipoMision = 'VERIFICACION', mision.estado = 'DESPACHADA' y patrullaId vinculada	HTTP 201 Created creando registro en mision con tipo VERIFICACION, estado DESPACHADA y fechaInicio: null	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
CP-H20-API-03	Transición atómica de incidente.estado a VERIFICANDO al confirmar la asignación de patrulla	Regla de Negocio ICS	Repositorio / BD	Crítica	Incidente existente en estado REPORTADO	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Columna incidente.estado actualizada a 'VERIFICANDO' dentro de la misma transacción Kysely	data.incidente.estado retorna 'VERIFICANDO' persistido en la tabla incidente	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-04	Transición atómica de patrulla_verificadora.estado a EN_VERIFICACION al confirmar el despacho	Regla de Negocio ICS	Repositorio / BD	Crítica	Patrulla existente activa en estado DISPONIBLE	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Columna patrulla_verificadora.estado actualizada a 'EN_VERIFICACION' de forma atómica	data.patrulla.estado retorna 'EN_VERIFICACION' persistido en patrulla_verificadora	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-05	Registro automático del hito inicial DESPACHADA en la tabla mision_hito dentro de la transacción	Auditoría / Trazabilidad	Repositorio / BD	Crítica	Tabla mision_hito creada en base de datos	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Inserción en mision_hito con hito = 'DESPACHADA', mision_id y registrado_por_id del Encargado	data.hitoInicial retorna registro con hito = 'DESPACHADA' y descripción de asignación	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): crear migracion y tipos para tabla mision_hito (HU-20)
CP-H20-API-06	Emisión de evento WebSocket mision:asignada a la sala específica patrulla:{id} y a encargado	Tiempo Real / Socket.io	Servicio / Socket	Alta	Instancia Socket.io activa durante el despacho	POST /api/misiones con patrullaId = f1000000-0000-4000-8000-000000000001	Emisión de evento 'mision:asignada' hacia la sala 'patrulla:f1000000-0000-4000-8000-000000000001' y 'encargado'	notificarMisionAsignada invocado con misionId, codigo, tipoMision, patrullaId e incidenteId	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-07	Emisión de evento WebSocket incidente:actualizado a las salas encargado y mapa con nuevoEstado VERIFICANDO	Tiempo Real / Kanban	Servicio / Socket	Alta	Instancia Socket.io o Redis activa durante el despacho	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Emisión de 'incidente:actualizado' a 'encargado' y 'mapa' para mover tarjeta Kanban a columna VERIFICANDO	notificarIncidenteActualizado emitido con nuevoEstado = 'VERIFICANDO' a encargado y mapa	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-08	Rechazo con HTTP 409 Conflict cuando la patrulla seleccionada cambió concurrentemente a estado no disponible	Concurrencia / ICS	Repositorio / API	Crítica	Patrulla en estado EN_VERIFICACION o NO_DISPONIBLE al ejecutar el UPDATE atómico	POST /api/misiones hacia patrullaId que ya no está en estado DISPONIBLE	HTTP 409 Conflict abortando la transacción sin crear misión ni alterar el incidente	HTTP 409 Conflict: "La patrulla verificadora '...' ya no se encuentra en estado 'DISPONIBLE' (estado actual: 'EN_VERIFICACION')."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)
CP-H20-API-09	Rechazo con HTTP 409 Conflict cuando el incidente no se encuentra en estado REPORTADO	Regla de Negocio ICS	Repositorio / API	Crítica	Incidente en estado VERIFICANDO, EN_ATENCION o RESUELTO	POST /api/misiones con incidenteId en estado VERIFICANDO	HTTP 409 Conflict indicando que solo se pueden verificar incidentes en estado REPORTADO	HTTP 409 Conflict: "El incidente se encuentra en estado 'VERIFICANDO', por lo que no puede ser asignado a una patrulla verificadora..."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-10	Denegación con HTTP 401 Unauthorized cuando la petición a POST /api/misiones carece de token JWT Bearer	Seguridad / Auth	API / AuthGuard	Crítica	Petición sin cabecera Authorization: Bearer <token>	POST /api/misiones sin cabeceras de autenticación	HTTP 401 Unauthorized rechazando el acceso anónimo	HTTP 401 Unauthorized devuelto por verificarAsignarMision	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
CP-H20-API-11	Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar	Seguridad / RBAC	API / AuthGuard	Crítica	Usuario con rol Call Center, Supervisor o Patrulla sin permiso misiones:asignar	POST /api/misiones con JWT de usuario sin permiso misiones:asignar	HTTP 403 Forbidden exigiendo el permiso misiones:asignar o perfil Administrador	HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador o el permiso 'misiones:asignar' para despachar misiones operativas."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-12	Autorización exitosa para usuario con rol Encargado (poseedor del permiso misiones:asignar) o Administrador	Seguridad / RBAC	AuthGuard / Semilla BD	Alta	Rol Encargado con permiso misiones:asignar en tabla rol_permiso	POST /api/misiones con JWT de Encargado de Operaciones	Acceso permitido al servicio de asignación retornando 201 Created	verificarAsignarMision valida satisfactoriamente el permiso misiones:asignar	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-13	Rechazo con HTTP 404 Not Found cuando el incidenteId proporcionado no existe en la base de datos	Manejo de Errores	Repositorio / API	Alta	UUID de incidente inexistente en tabla incidente	POST /api/misiones con incidenteId = 50000000-0000-4000-8000-999999999999	HTTP 404 Not Found indicando que el incidente no fue encontrado	HTTP 404 Not Found: "Incidente con ID '...' no encontrado."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-14	Rechazo con HTTP 404 Not Found cuando la patrullaId no existe o fue dada de baja lógica (eliminado_en IS NOT NULL)	Manejo de Errores / Baja Lógica	Repositorio / API	Alta	UUID de patrulla inexistente o con eliminado_en != null	POST /api/misiones con patrullaId = f1000000-0000-4000-8000-999999999999	HTTP 404 Not Found impidiendo despachar patrullas inexistentes o desactivadas	HTTP 404 Not Found: "Patrulla verificadora con ID '...' no existe o ha sido desactivada."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-15	Rechazo con HTTP 400 Bad Request ante payload con formato JSON sintácticamente inválido	Robustez / Contrato	API / Route	Media	Petición POST con cuerpo en texto plano malformado	POST /api/misiones con body "no-json-body"	HTTP 400 Bad Request indicando que el cuerpo debe ser un formato JSON válido	HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
CP-H20-API-16	Rechazo con HTTP 400 Bad Request cuando incidenteId o patrullaId no cumplen el formato UUID	Validación (Zod)	Schema / API	Media	Esquema CrearMisionVerificacionSchema	POST /api/misiones con {"incidenteId":"invalido","patrullaId":"patrulla-123"}	HTTP 400 Bad Request detallando los errores de validación por campo	HTTP 400 Bad Request con message "Datos de misión inválidos." y detalle en errors	APROBADO	06/11/2026 12:38	08/11/2026 12:28	test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)
CP-H20-API-17	Rechazo con HTTP 400 Bad Request cuando el título opcional tiene menos de 3 o más de 150 caracteres	Validación (Zod)	Schema / API	Baja	Esquema CrearMisionVerificacionSchema	POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Ok"}	HTTP 400 Bad Request indicando longitud mínima de 3 caracteres	Validación Zod rechaza con "El título debe contener al menos 3 caracteres."	APROBADO	06/11/2026 12:38	08/11/2026 12:28	test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)
CP-H20-API-18	Autogeneración de título por defecto y herencia de prioridad del incidente cuando se omiten campos opcionales	Funcional / Defaults	Esquema / Repositorio	Media	Payload mínimo solo con incidenteId y patrullaId	POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	tipoMision = 'VERIFICACION', titulo = 'Verificación de Incidente <CODIGO>' y prioridad heredada del incidente	Asignación por defecto aplicada en esquema Zod y repositorio	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-19	Resiliencia de la respuesta HTTP 201 Created si ocurre una excepción al emitir eventos WebSocket	Resiliencia / Tolerancia a Fallos	Servicio	Media	Fallo simulado en el servidor Socket.io o Redis tras el commit en BD	POST /api/misiones con transacción exitosa y excepción en notificarMisionAsignada	La transacción en BD se preserva y el endpoint responde 201 Created registrando el error en log	Bloque try/catch en asignarPatrullaVerificacionService captura el error de socket sin abortar la respuesta 201	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-20	Registro y exposición del contrato OpenAPI 3.0 para POST /api/misiones en GET /openapi.json	Contrato API / OpenAPI | OpenAPI Spec	Alta	Generador OpenApiGeneratorV3 en src/lib/openapi/index.ts	GET /openapi.json verificando paths["/api/misiones"].post	Operación POST /api/misiones documentada con CrearMisionVerificacionSchema, CrearMisionResponseSchema y códigos 201, 400, 401, 403, 404, 409 y 500	Especificación OpenAPI 3.0 generada y validada sin errores	APROBADO	06/11/2026 12:38	08/11/2026 12:28	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Completa del Módulo de Misiones y Contrato OpenAPI
```bash
npx vitest run src/modules/misiones/__tests__/mision.schema.test.ts src/modules/misiones/__tests__/mision.service.test.ts src/app/api/misiones/__tests__/route.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (5 tests) 9ms
 ✓ src/modules/misiones/__tests__/mision.schema.test.ts (11 tests) 14ms
 ✓ src/app/api/misiones/__tests__/route.test.ts (10 tests) 23ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 111ms

 Test Files  4 passed (4)
      Tests  27 passed (27)
   Start at  12:28:49
   Duration  809ms (transform 408ms, setup 0ms, collect 861ms, tests 161ms, environment 1ms, prepare 275ms)
```

#### 5.1.2 Ejecución Focalizada por Casos de HU-20 (`-t`)
```bash
npm test -- -t "CrearMisionVerificacionSchema \(HU-20\)"
npm test -- -t "asignarPatrullaVerificacionService \(HU-20\)"
npm test -- -t "debe incluir los hitos reales desde mision_hito en la bitácora de la misión"
npm test -- -t "Route Handler POST /api/misiones \(HU-20: Asignar Patrulla Verificadora\)"
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`GET /api/patrullas?estado=DISPONIBLE` y `POST /api/misiones`)

#### Caso 1: Consulta de Patrullas Disponibles para el Selector del Drawer (`200 OK` — `CP-H20-API-01`)
```bash
curl -s -i -X GET "http://localhost:3000/api/patrullas?estado=DISPONIBLE&page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Listado de patrullas verificadoras obtenido exitosamente.",
  "data": [
    {
      "id": "f1000000-0000-4000-8000-000000000010",
      "codigo": "PV-NORTE-01",
      "nombre": "Patrulla Rápida Las Ánimas",
      "estado": "DISPONIBLE",
      "estadoLegible": "Disponible",
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000001",
        "nombre": "Delegación Municipal Norte",
        "codigo": "DEL_NORTE"
      },
      "lider": {
        "id": "d1000000-0000-4000-8000-000000000001",
        "nombre": "Pedro Valenzuela",
        "email": "pedro.patrulla@valdivia.cl",
        "rut": "17888999-1",
        "telefono": null
      },
      "misionActiva": null
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### Caso 2: Rechazo por Falta de Autenticación (`401 Unauthorized` — `CP-H20-API-10`)
```bash
curl -s -i -X POST "http://localhost:3000/api/misiones" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteId": "50000000-0000-4000-8000-000000000001",
    "patrullaId": "f1000000-0000-4000-8000-000000000001"
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "message": "No autenticado: Se requiere iniciar sesión o proveer un identificador de usuario válido."
}
```

#### Caso 3: Rechazo por Falta del Permiso RBAC `misiones:asignar` (`403 Forbidden` — `CP-H20-API-11`)
```bash
curl -s -i -X POST "http://localhost:3000/api/misiones" \
  -H "Authorization: Bearer <TOKEN_JWT_OPERADOR_CALL_CENTER>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteId": "50000000-0000-4000-8000-000000000001",
    "patrullaId": "f1000000-0000-4000-8000-000000000001"
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "message": "Acceso denegado. Se requiere el perfil de Administrador o el permiso 'misiones:asignar' para despachar misiones operativas."
}
```

#### Caso 4: Rechazo por Datos de Entrada Inválidos según Esquema Zod (`400 Bad Request` — `CP-H20-API-16`)
```bash
curl -s -i -X POST "http://localhost:3000/api/misiones" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteId": "no-es-uuid",
    "patrullaId": "f1000000-0000-4000-8000-000000000001",
    "titulo": "Ok"
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Datos de misión inválidos.",
  "errors": [
    {
      "campo": "incidenteId",
      "mensaje": "El identificador del incidente debe ser un UUID válido."
    },
    {
      "campo": "titulo",
      "mensaje": "El título debe contener al menos 3 caracteres."
    }
  ]
}
```

#### Caso 5: Despacho Atómico Exitoso de Patrulla Verificadora (`201 Created` — `CP-H20-API-02` a `05`, `BUG-H20-API-03`, `BUG-H20-API-04`)
```bash
curl -s -i -X POST "http://localhost:3000/api/misiones" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteId": "50000000-0000-4000-8000-000000000001",
    "patrullaId": "f1000000-0000-4000-8000-000000000001",
    "titulo": "Verificación de anegamiento",
    "descripcion": "Evaluar anegamiento en calzada",
    "prioridad": "ALTA"
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "Misión de verificación creada y patrulla despachada exitosamente.",
  "data": {
    "mision": {
      "id": "60000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0001",
      "titulo": "Verificación de anegamiento",
      "descripcion": "Evaluar anegamiento en calzada",
      "tipoMision": "VERIFICACION",
      "estado": "DESPACHADA",
      "prioridad": "ALTA",
      "incidenteId": "50000000-0000-4000-8000-000000000001",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "encargadoId": "00000000-0000-4000-8000-000000000003",
      "fechaInicio": null,
      "creadoEn": "2026-11-08T15:25:00.000Z"
    },
    "incidente": {
      "id": "50000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0001",
      "estado": "VERIFICANDO"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Norte 1",
      "estado": "EN_VERIFICACION"
    },
    "hitoInicial": {
      "id": "70000000-0000-4000-8000-000000000001",
      "hito": "DESPACHADA",
      "descripcion": "Misión de verificación asignada y despachada a la patrulla Patrulla Norte 1.",
      "creadoEn": "2026-11-08T15:25:00.000Z"
    }
  }
}
```

#### Caso 6: Bloqueo por Concurrencia si la Patrulla Cambió a No Disponible (`409 Conflict` — `CP-H20-API-08`)
```bash
curl -s -i -X POST "http://localhost:3000/api/misiones" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteId": "50000000-0000-4000-8000-000000000002",
    "patrullaId": "f1000000-0000-4000-8000-000000000001"
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "La patrulla verificadora 'Patrulla Norte 1' ya no se encuentra en estado 'DISPONIBLE' (estado actual: 'EN_VERIFICACION')."
}
```

#### Caso 7: Bloqueo si el Incidente Ya No Está en Estado `REPORTADO` (`409 Conflict` — `CP-H20-API-09` / `BUG-H20-API-01`)
```bash
curl -s -i -X POST "http://localhost:3000/api/misiones" \
  -H "Authorization: Bearer <TOKEN_JWT_ENCARGADO>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidenteId": "50000000-0000-4000-8000-000000000001",
    "patrullaId": "f1000000-0000-4000-8000-000000000010"
  }'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "El incidente se encuentra en estado 'VERIFICANDO', por lo que no puede ser asignado a una patrulla verificadora. Solo se pueden verificar incidentes en estado 'REPORTADO'."
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** Desde el detalle o drawer de un incidente en estado `REPORTADO`, el sistema debe proveer un selector accesible para asignar una patrulla verificadora. | `CP-H20-API-01`, `CP-H20-API-09`, `CP-H20-API-20` | 🟢 **CUMPLIDO** | El backend provee `GET /api/patrullas?estado=DISPONIBLE` y valida con bloqueo `.forUpdate()` en `POST /api/misiones` que el incidente esté en estado `REPORTADO`. |
| **CA-2:** El selector debe listar únicamente las patrullas que se encuentren en estado `DISPONIBLE` en la base de datos. | `CP-H20-API-01`, `CP-H20-API-14` | 🟢 **CUMPLIDO** | `listarPatrullasRepo` filtra por `pv.estado = 'DISPONIBLE'` y `pv.eliminado_en IS NULL`, y `crearMisionVerificacionRepo` exige `estado = 'DISPONIBLE'` y `eliminado_en IS NULL`. |
| **CA-3:** Al confirmar la asignación, la API debe ejecutar una transacción atómica: (1) Crear registro en `mision` con `tipo_mision = 'VERIFICACION'`, `estado = 'DESPACHADA'` y `patrulla_id`, (2) Actualizar `incidente.estado = 'VERIFICANDO'`, (3) Actualizar `patrulla_verificadora.estado = 'EN_VERIFICACION'`, y (4) Registrar el hito inicial en `mision_hito`. | `CP-H20-API-02`, `CP-H20-API-03`, `CP-H20-API-04`, `CP-H20-API-05`, `BUG-H20-API-01`, `BUG-H20-API-02`, `BUG-H20-API-03`, `BUG-H20-API-04` | 🟢 **CUMPLIDO (CERTIFICADO EN RE-TEST)** | Ejecuta las 4 operaciones atómicamente con `.forUpdate()` y `.where("estado", "=", "REPORTADO")`, código secuencial `MIS-YYYY-NNNN` con `pg_advisory_xact_lock`, `fecha_inicio: null` y lectura de `mision_hito` en `GET /api/misiones/{id}`. |
| **CA-4:** El sistema debe emitir el evento WebSocket `mision:asignada` a la sala específica de la patrulla (`patrulla:{id}`) y `incidente:actualizado` a las salas `encargado` y `mapa`. | `CP-H20-API-06`, `CP-H20-API-07`, `CP-H20-API-19`, `BUG-H20-API-05` | 🟢 **CUMPLIDO (CERTIFICADO EN RE-TEST)** | Emite en memoria (`ioInstance`) y publica en el canal Redis (`REDIS_SOCKET_CHANNEL`) hacia todas las salas operativas (`encargado`, `sala:encargados`, `supervisor`, `mapa` y `patrulla:{id}`). |
| **CA-5:** Si la patrulla seleccionada cambió de estado concurrentemente a no disponible, la API debe abortar con `409 Conflict` y notificar al Encargado. | `CP-H20-API-08`, `BUG-H20-API-01` | 🟢 **CUMPLIDO (CERTIFICADO EN RE-TEST)** | Protege atómicamente contra concurrencia tanto sobre la misma `patrulla_verificadora` como sobre el mismo `incidente`, abortando con `409 Conflict`. |
| **CA-6:** El incidente en el tablero Kanban debe moverse automáticamente a la columna 'VERIFICANDO' sin requerir refresco manual. | `CP-H20-API-03`, `CP-H20-API-07` | 🟢 **CUMPLIDO** | `notificarIncidenteActualizado` emite `incidente:actualizado` con `nuevoEstado: "VERIFICANDO"` tanto en memoria como por Redis hacia las salas `encargado`, `sala:encargados` y `mapa`. |
| **CA-7:** El endpoint `POST /api/misiones` debe exigir el permiso RBAC `misiones:asignar`. | `CP-H20-API-10`, `CP-H20-API-11`, `CP-H20-API-12` | 🟢 **CUMPLIDO** | `verificarAsignarMision` exige el permiso `misiones:asignar` (o perfil `Administrador`), devolviendo `401` sin sesión y `403` sin privilegios. |
