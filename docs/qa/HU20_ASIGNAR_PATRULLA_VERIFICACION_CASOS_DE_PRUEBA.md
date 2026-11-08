# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-20 — Asignar Patrulla Verificadora a Incidente (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones Tácticas e Incidentes (`sgrai-api` — `POST /api/misiones` y `GET /api/patrullas?estado=DISPONIBLE`).  
> **Historia de Usuario:** HU-20 — *"Como Encargado Quiero asignar una patrulla verificadora disponible a un incidente para que evalúe y verifique las necesidades reales en terreno. Para desplegar de inmediato personal calificado que levante el diagnóstico técnico antes de movilizar recursos pesados o cuadrillas."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h20-asignar-patrulla-verificacion`  
> **Commits Evaluados en la Rama:**  
> * `c21f554`: `feat(misiones): crear migracion y tipos para tabla mision_hito (HU-20)`  
> * `c489888`: `feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)`  
> * `07ee529`: `feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)`  
> * `4023948`: `test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)`  
> * `60fe22d`: `feat(seed): agregar script para sembrar patrullas verificadoras de prueba`  
> * `58ba175`: `test(misiones): tipar mock de usuario autenticado en pruebas de ruta`  
> * `9c050ac`: `merge: integrar develop en feature/h20-asignar-patrulla-verificacion resolviendo conflictos`  
>  
> **Fecha de Auditoría:** 06/11/2026 12:38.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense estática y dinámica del código fuente, revisión de transacciones ACID en Kysely/PostgreSQL, encadenamiento de migraciones respecto a `develop`, validación de reglas de negocio del Sistema de Comando de Incidentes (ICS), difusión de eventos en tiempo real vía Socket.io/Redis, contratos OpenAPI 3.0 y pruebas automatizadas en Vitest sobre la rama `feature/h20-asignar-patrulla-verificacion`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** debido a la detección de **5 defectos reales** (2 críticos, 2 altos y 1 medio) que afectan la protección de concurrencia sobre el incidente, la integridad del árbol de migraciones y aislamiento de la rama, la generación secuencial sin colisiones del código de misión, la trazabilidad de tiempos e hitos en la bitácora y la propagación de eventos en el broker Redis.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H20-API-01` a `05`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io (`CP-H20-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Validación Zod de payload, RBAC `misiones:asignar`, bloqueo `409` ante patrulla ocupada o incidente no `REPORTADO`, transacción `mision`/`incidente`/`patrulla_verificadora`/`mision_hito` y OpenAPI |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de entorno o infraestructura |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere el 100.0% (0 defectos abiertos) en Re-Test para aprobar la integración a `develop` |
| **Suite Automatizada de Misiones (Vitest)** | **26/26 tests pass (con mocks)** | `mision.schema.test.ts` (11), `mision.service.test.ts` (4), `route.test.ts` (10) y `openapi.json` (1) |
| **Análisis Estático ESLint (Módulo Misiones)** | **0 errores** | 0 errores de linter en los archivos del módulo `misiones` |
| **Secuencia de Migraciones Kysely** | 🔴 **Doble colisión (`032_` y `033_`)** | La rama arrastra `032_patrulla_desactivacion_baja_logica.ts` (HU-85) y colisiona en `033_mision_hito_bitacora.ts` con `033_patrullas_codigo_vehiculo.ts` de `develop` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H20-API-01`: Condición de Carrera TOCTOU sobre el Incidente — Ausencia de Bloqueo Pesimista (`forUpdate()`) y de Condición Atómica `.where("estado", "=", "REPORTADO")` al Actualizar `incidente`, Permitiendo Doble Despacho de Patrullas a un Mismo Incidente
* **Severidad:** **CRÍTICA** (Violación de Atomicidad Transaccional y Flujo de Evaluación Primaria ICS).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 358-372 y 447-456).
* **Descripción Técnica del Defecto:**  
  En `crearMisionVerificacionRepo` (`mision.repository.ts`), aunque la actualización de `patrulla_verificadora` incluye `.where("estado", "=", "DISPONIBLE")` (L.382), la verificación y actualización del incidente carece de control de concurrencia:
  1. En el paso 1 (L.358-362), la lectura del incidente se realiza mediante un `SELECT` plano sin adquirir bloqueo de fila (`forUpdate()`):
     ```typescript
     const incidente = await trx
       .selectFrom("incidente")
       .select(["id", "codigo", "estado", "prioridad", "tipo_afectacion", "delegacion_id"])
       .where("id", "=", input.incidenteId)
       .executeTakeFirst();
     ```
  2. En el paso 5 (L.448-456), la transición a `'VERIFICANDO'` se ejecuta sin condicionar `.where("estado", "=", "REPORTADO")`:
     ```typescript
     const incidenteActualizado = await trx
       .updateTable("incidente")
       .set({
         estado: "VERIFICANDO",
         actualizado_en: new Date(),
       })
       .where("id", "=", input.incidenteId)
       .returning(["id", "codigo", "estado", "prioridad"])
       .executeTakeFirstOrThrow();
     ```
  Si dos operadores despachan simultáneamente dos patrullas distintas (`Patrulla A` y `Patrulla B`) hacia el mismo incidente en estado `'REPORTADO'`, ambas transacciones leen `incidente.estado === 'REPORTADO'` concurrentemente, bloquean cada una una patrulla distinta, insertan dos misiones activas con `tipo_mision = 'VERIFICACION'` para el mismo incidente y sobrescriben `incidente.estado = 'VERIFICANDO'` sin que la segunda petición aborte con `409 Conflict`. Asimismo, si el incidente cambió a `'EN_ATENCION'` o `'RESUELTO'` entre el paso 1 y el paso 5, el `UPDATE` sin cláusula `WHERE estado = 'REPORTADO'` revierte silenciosamente el estado del incidente a `'VERIFICANDO'`.
* **Pasos para Reproducir:**
  1. Disponer de un incidente en estado `'REPORTADO'` y dos patrullas disponibles (`Patrulla A` y `Patrulla B`).
  2. Enviar dos peticiones concurrentes `POST /api/misiones` hacia el mismo `incidenteId`, una con `patrullaId = Patrulla A` y otra con `patrullaId = Patrulla B`.
* **Comportamiento Actual:** Ambas peticiones responden `201 Created`, dejando el mismo incidente con dos misiones de verificación activas y dos patrullas comprometidas en estado `'EN_VERIFICACION'`.
* **Comportamiento Esperado:** La primera transacción debe bloquear la fila del incidente con `.forUpdate()` y actualizarla condicionando `.where("estado", "=", "REPORTADO")`, mientras que la petición concurrente debe abortar la transacción y responder `409 Conflict` indicando que el incidente ya no se encuentra en estado `'REPORTADO'`.
* **Sugerencia Técnica de Solución:**  
  Añadir `.forUpdate()` en la consulta inicial de `incidente` (L.361) y agregar `.where("estado", "=", "REPORTADO")` en el `.updateTable("incidente")` (L.454), lanzando `ConflictError` si `incidenteActualizado` no retorna fila.

---

### `BUG-H20-API-02`: Contaminación de Rama con Código Ajeno de HU-85 y Colisión Doble de Correlativos en Migraciones Kysely (`032_` y `033_`) contra `develop`
* **Severidad:** **CRÍTICA** (Integridad de Control de Versiones Gitflow y Secuencia de Migraciones en CI/CD).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/db/migrations/032_patrulla_desactivacion_baja_logica.ts` (colisiona con `032_cuadrilla_baja_logica_activo.ts`)
  * `src/lib/db/migrations/033_mision_hito_bitacora.ts` (colisiona con `033_patrullas_codigo_vehiculo.ts`)
  * `src/app/api/patrullas/[id]/route.ts`, `src/modules/recursos-y-personal/patrulla.repository.ts`, `src/modules/recursos-y-personal/patrulla.service.ts`, `src/modules/recursos-y-personal/patrulla.schema.ts`, `src/app/api/patrullas/__tests__/route.test.ts`, `src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts`, `src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts`, `docs/api/recursos-y-personal.md` (archivos arrastrados desde el commit `0efb165` de HU-85).
* **Descripción Técnica del Defecto:**  
  1. **Ramificación desde una rama distinta a `develop`:** La subtarea de versionado establece *"Crear la rama `feature/h20-asignar-patrulla-verificacion` a partir de `develop`"*. Sin embargo, el historial de Git evidencia que la rama partió sobre el commit `0efb165` (`feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)`), incorporando en el diff contra `develop` la implementación de baja lógica de patrullas correspondiente a HU-85 (la cual presenta defectos abiertos en su propia auditoría).
  2. **Doble colisión de prefijos en `src/lib/db/migrations/`:** Tras el merge de `develop` (`9c050ac`), el directorio `src/lib/db/migrations/` contiene dos pares de migraciones con idéntico correlativo numérico:
     * `032_cuadrilla_baja_logica_activo.ts` y `032_patrulla_desactivacion_baja_logica.ts`
     * `033_mision_hito_bitacora.ts` y `033_patrullas_codigo_vehiculo.ts`
* **Pasos para Reproducir:**
  1. Ejecutar `git diff develop...feature/h20-asignar-patrulla-verificacion --stat` y `ls -1 src/lib/db/migrations/03*.ts`.
* **Comportamiento Actual:** Existen dos archivos con prefijo `032_` y dos archivos con prefijo `033_`, además de 9 archivos modificados pertenecientes a HU-85 (`DELETE /api/patrullas/[id]`).
* **Comportamiento Esperado:** La rama `feature/h20-asignar-patrulla-verificacion` debe contener exclusivamente los cambios relativos a HU-20 respecto a `develop`, y la migración de `mision_hito` debe poseer un correlativo único posterior al último de `develop` (`034_mision_hito_bitacora.ts`).
* **Sugerencia Técnica de Solución:**  
  Revertir de la rama los cambios pertenecientes al commit `0efb165` (HU-85) para dejar intacto el estado de `develop` en los archivos de baja lógica de patrullas, y renombrar `src/lib/db/migrations/033_mision_hito_bitacora.ts` a `src/lib/db/migrations/034_mision_hito_bitacora.ts`.

---

### `BUG-H20-API-03`: Generación Pseudoaleatoria No Secuencial de `mision.codigo` (`Math.random()`) con Riesgo de Colisión Concurrente (`23505` -> `500`) y Degradación por Agotamiento en `crearMisionVerificacionRepo`
* **Severidad:** **ALTA** (Integridad de Datos, Nomenclatura Institucional y Concurrencia en Base de Datos).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 406-421).
* **Descripción Técnica del Defecto:**  
  Tanto el comentario del método como la documentación oficial (`docs/api/misiones.md:258`) especifican que la misión se crea con un *"código autogenerado correlativo único (`MIS-YYYY-NNNN`)"*. Sin embargo, en `crearMisionVerificacionRepo` (`mision.repository.ts:406-421`) se implementó:
  ```typescript
  const year = new Date().getFullYear();
  let codigo = "";
  let colision = true;
  while (colision) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    codigo = `MIS-${year}-${randomNum}`;
    const existe = await trx
      .selectFrom("mision")
      .select("id")
      .where("codigo", "=", codigo)
      .executeTakeFirst();
    if (!existe) {
      colision = false;
    }
  }
  ```
  Esta implementación presenta tres problemas técnicos:
  1. **Ausencia de correlativo secuencial:** Genera números pseudoaleatorios desordenados entre `1000` y `9999` en lugar de una secuencia correlativa (`MIS-2026-0001`, `MIS-2026-0002`, etc.).
  2. **Condición de carrera en unicidad (`mision_codigo_key`):** Al verificar con un `SELECT` sin bloqueo y luego ejecutar `INSERT`, dos transacciones concurrentes que obtengan el mismo código ven `existe === undefined` y la segunda falla en el `INSERT` con error PostgreSQL `23505` (`unique_violation`), devolviendo un `500 Internal Server Error` no controlado.
  3. **Riesgo de bucle infinito:** Al restringir el espacio a 9.000 combinaciones (`1000..9999`), si el volumen anual alcanza dicho umbral, el bucle `while (colision)` se vuelve infinito dentro de una transacción con filas bloqueadas.
* **Pasos para Reproducir:**
  1. Despachar dos misiones consecutivas mediante `POST /api/misiones` e inspeccionar `data.mision.codigo`.
  2. Simular colisión concurrente de código en dos transacciones paralelas.
* **Comportamiento Actual:** Los códigos generados son números aleatorios no correlativos (ej. `MIS-2026-8341`, luego `MIS-2026-1904`) y vulnerables a colisión concurrente `23505`.
* **Comportamiento Esperado:** El código de misión debe generarse de manera correlativa secuencial (`MIS-YYYY-NNNN` con `padStart(4, "0")`) calculando el siguiente correlativo anual de forma segura ante concurrencia (con `advisory lock` transaccional o reintento ante `23505`).
* **Sugerencia Técnica de Solución:**  
  Implementar un generador correlativo secuencial protegido con `pg_advisory_xact_lock` (ej. `SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`) que calcule `MAX` del correlativo anual `MIS-${year}-%` + 1 formateado con `String(correlativo).padStart(4, "0")`.

---

### `BUG-H20-API-04`: Asignación Prematura de `mision.fecha_inicio` en Estado `'DESPACHADA'` y Omisión de Lectura de `mision_hito` en `obtenerMisionDetallePorIdRepo` (`GET /api/misiones/{id}`)
* **Severidad:** **ALTA** (Inconsistencia en Bitácora Cronológica de Misión y Ciclo de Vida ICS).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 111-306 y 427-445)
  * `src/modules/misiones/mision.service.ts` (Líneas 58-100)
* **Descripción Técnica del Defecto:**  
  1. **Fijación prematura de `fecha_inicio` al despachar:** En `crearMisionVerificacionRepo` (`mision.repository.ts:427, 442`), la misión se inserta con `estado: "DESPACHADA"` pero se fija inmediatamente `fecha_inicio: new Date()`. Conforme al contrato `MisionDetalleCompletoSchema` (`mision.schema.ts:172`: *"Fecha y hora de despliegue o inicio en terreno"*) y al flujo ICS (donde la patrulla acepta la misión en terreno pasando a `'EN_CURSO'` en HU-36, o la rechaza pasando a `'RECHAZADA'` en HU-69), una misión recién `'DESPACHADA'` aún no ha iniciado operaciones en terreno y su `fecha_inicio` debe ser `null` al momento del despacho.
  2. **Falso hito `"DESPLIEGUE_INICIO"` y omisión de `mision_hito` en `GET /api/misiones/{id}`:** En `obtenerDetalleMisionService` (`mision.service.ts:71-79`), el servicio evalúa `if (mision.fecha_inicio)` para agregar el hito `"DESPLIEGUE_INICIO"` (*"Inicio formal de operaciones y traslado a terreno"*). Al haberse fijado `fecha_inicio` en el despacho, cualquier misión en estado `'DESPACHADA'` (o rechazada posteriormente) muestra falsamente que inició operaciones en terreno. Además, `obtenerMisionDetallePorIdRepo` no consulta la tabla `mision_hito` creada en esta historia, por lo que el hito `'DESPACHADA'` registrado en `mision_hito` (CA-3) no se incluye en `bitacoraTiempos`.
* **Pasos para Reproducir:**
  1. Ejecutar `POST /api/misiones` para despachar una patrulla a un incidente.
  2. Consultar `GET /api/misiones/{id}` para la misión recién creada en estado `'DESPACHADA'`.
* **Comportamiento Actual:** `data.mision.fechaInicio` retorna un timestamp no nulo estando en estado `'DESPACHADA'`, y `GET /api/misiones/{id}` no retorna los hitos persistidos en `mision_hito` sino hitos sintéticos que incluyen `"DESPLIEGUE_INICIO"` antes de que la patrulla acepte la misión.
* **Comportamiento Esperado:** Al despachar la misión en `POST /api/misiones`, `fecha_inicio` debe ser `null` (fijándose cuando la misión pase a `'EN_CURSO'`), y `obtenerMisionDetallePorIdRepo` / `obtenerDetalleMisionService` debe consultar e incorporar los hitos reales registrados en la tabla `mision_hito` ordenados cronológicamente.
* **Sugerencia Técnica de Solución:**  
  Establecer `fecha_inicio: null` al insertar la misión en estado `'DESPACHADA'` en `crearMisionVerificacionRepo` (L.442), y consultar `mision_hito` en `obtenerMisionDetallePorIdRepo` para poblar `bitacoraTiempos` con los hitos reales registrados en base de datos.

---

### `BUG-H20-API-05`: Publicación Incompleta de Eventos WebSocket en el Broker Redis (`notificarPatrullaActualizada` y `notificarMisionAsignada`) Omitiendo las Salas `mapa`, `supervisor` y `sala:encargados`
* **Severidad:** **MEDIA** (Desincronización de Tiempo Real en Mapa Interactivo y Panel de Supervisión vía Redis Pub/Sub).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/lib/socket/index.ts` (Líneas 602-614 y 739-764).
* **Descripción Técnica del Defecto:**  
  La subtarea técnica de Backend exige *"Configurar la emisión de eventos Socket.io hacia las salas correspondientes a través del broker Redis"*. En `src/lib/socket/index.ts`, cuando la emisión se realiza desde el Route Handler a través del publicador Redis (`publisher.publish(REDIS_SOCKET_CHANNEL, ...)` cuando `ioInstance` es `null`):
  1. En `notificarPatrullaActualizada` (L.602-614), mientras que la rama en memoria (`if (ioInstance)`) emite a `"encargado"`, `"sala:encargados"`, `"supervisor"`, `"mapa"` y `patrulla:${id}`, la rama Redis publica **únicamente** a la sala `"encargado"`, omitiendo `"mapa"`, `"supervisor"`, `"sala:encargados"` y `patrulla:${id}`.
  2. En `notificarMisionAsignada` (L.739-764), la rama Redis publica únicamente a `"encargado"` y `patrulla:${id}`, omitiendo `"sala:encargados"` y `"supervisor"` que sí están presentes en la rama `if (ioInstance)` (L.727-729).
* **Pasos para Reproducir:**
  1. Ejecutar `POST /api/misiones` en un proceso worker donde `ioInstance` es `null` y `REDIS_URL` está configurado.
  2. Inspeccionar los mensajes publicados en el canal Redis `sgrai:socket-events`.
* **Comportamiento Actual:** El evento `patrulla:actualizada` solo se publica en Redis para `room: "encargado"`, por lo que los clientes suscritos a la sala `"mapa"` o `"supervisor"` no reciben el cambio de estado de la patrulla a `'EN_VERIFICACION'`.
* **Comportamiento Esperado:** Tanto `notificarPatrullaActualizada` como `notificarMisionAsignada` deben publicar en el canal Redis hacia todas las salas operativas correspondientes (`"encargado"`, `"sala:encargados"`, `"supervisor"`, `"mapa"` y `patrulla:${id}`), manteniendo paridad exacta con la emisión directa de `ioInstance`.
* **Sugerencia Técnica de Solución:**  
  Iterar sobre el arreglo de salas destino en el bloque `if (publisher)` de `notificarPatrullaActualizada` (`["encargado", "sala:encargados", "supervisor", "mapa", patrullaRoom]`) y de `notificarMisionAsignada` (`["encargado", "sala:encargados", "supervisor", ...(patrullaRoom ? [patrullaRoom] : [])]`).

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H20-API-01` | Condición de carrera TOCTOU en incidente sin SELECT FOR UPDATE ni WHERE estado = REPORTADO permitiendo doble despacho | Concurrencia / ICS | Repositorio / BD | Crítica | Incidente en estado REPORTADO y 2 patrullas en estado DISPONIBLE | 2 peticiones concurrentes POST /api/misiones al mismo incidenteId con Patrulla A y Patrulla B | Primera petición responde 201 Created; segunda petición aborta con 409 Conflict por incidente ya en VERIFICANDO | Sin forUpdate() en incidente ni WHERE estado = 'REPORTADO' en UPDATE, dos transacciones concurrentes crean 2 misiones de verificación para el mismo incidente | ABIERTO | 06/11/2026 12:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H20-API-02` | Contaminación de rama con archivos de HU-85 y doble colisión de correlativos de migración Kysely (032_ y 033_) | Integración / Migraciones | Base de Datos / Git | Crítica | Árbol de migraciones en src/lib/db/migrations comparado con develop | git diff develop...feature/h20-asignar-patrulla-verificacion y listado de src/lib/db/migrations | Rama aislada solo con cambios de HU-20 y migración mision_hito con correlativo único 034_ | Colisión doble en 032_ (con cuadrilla) y 033_ (con 033_patrullas_codigo_vehiculo.ts) y 9 archivos de HU-85 arrastrados en el PR | ABIERTO | 06/11/2026 12:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H20-API-03` | Generación pseudoaleatoria no secuencial de mision.codigo (Math.random) con riesgo de colisión concurrente 23505 y bucle infinito | Integridad / Concurrencia | Repositorio / BD | Alta | Despacho de misiones consecutivas o simultáneas en POST /api/misiones | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Código correlativo secuencial único MIS-YYYY-NNNN protegido contra colisiones concurrentes | Usa Math.floor(1000 + Math.random() * 9000) generando códigos no secuenciales vulnerables a unique_violation 23505 bajo concurrencia | ABIERTO | 06/11/2026 12:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H20-API-04` | Asignación prematura de fecha_inicio en estado DESPACHADA y omisión de consulta a mision_hito en GET /api/misiones/{id} | Regla de Negocio ICS | Repositorio / Servicio | Alta | Misión recién creada en estado DESPACHADA vía POST /api/misiones | POST /api/misiones seguido de GET /api/misiones/{id} | fecha_inicio en null mientras está DESPACHADA y bitacoraTiempos poblada desde la tabla mision_hito | crearMisionVerificacionRepo fija fecha_inicio = new Date() al despachar y obtenerMisionDetallePorIdRepo ignora la tabla mision_hito | ABIERTO | 06/11/2026 12:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H20-API-05` | Publicación incompleta de eventos Socket.io en broker Redis omitiendo salas mapa, supervisor y sala:encargados | Tiempo Real / Redis | Infraestructura / Socket | Media | Worker HTTP sin ioInstance en memoria publicando vía REDIS_SOCKET_CHANNEL | POST /api/misiones con REDIS_URL activo | Publicación en Redis de patrulla:actualizada y mision:asignada a todas las salas (mapa, encargado, sala:encargados, supervisor, patrulla:{id}) | notificarPatrullaActualizada solo publica en Redis a la sala encargado (omite mapa y supervisor) y notificarMisionAsignada omite sala:encargados y supervisor | ABIERTO | 06/11/2026 12:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H20-API-01` | Listado de patrullas verificadoras filtrando exclusivamente unidades en estado DISPONIBLE para el selector | Funcional / Consulta | API / Integración | Crítica | Patrullas activas registradas en distintos estados operativos | GET /api/patrullas?estado=DISPONIBLE con Header Authorization: Bearer <token_encargado> | HTTP 200 OK retornando únicamente patrullas activas (eliminado_en IS NULL) cuyo estado es DISPONIBLE | HTTP 200 OK con listado filtrado exclusivamente por estado DISPONIBLE | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | merge: sincronizar con develop y adaptar repositorio de patrullas a modelo de disponibilidad (HU-11) |
| `CP-H20-API-02` | Despacho atómico exitoso de patrulla disponible a incidente REPORTADO creando misión VERIFICACION en estado DESPACHADA | Funcional / Transaccional | API / Servicio / BD | Crítica | Incidente en estado REPORTADO y patrulla en estado DISPONIBLE | POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Verificación de anegamiento","prioridad":"ALTA"} | HTTP 201 Created con mision.tipoMision = 'VERIFICACION', mision.estado = 'DESPACHADA' y patrullaId vinculada | HTTP 201 Created creando registro en mision con tipo VERIFICACION y estado DESPACHADA | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |
| `CP-H20-API-03` | Transición atómica de incidente.estado a VERIFICANDO al confirmar la asignación de patrulla | Regla de Negocio ICS | Repositorio / BD | Crítica | Incidente existente en estado REPORTADO | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Columna incidente.estado actualizada a 'VERIFICANDO' dentro de la misma transacción Kysely | data.incidente.estado retorna 'VERIFICANDO' persistido en la tabla incidente | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-04` | Transición atómica de patrulla_verificadora.estado a EN_VERIFICACION al confirmar el despacho | Regla de Negocio ICS | Repositorio / BD | Crítica | Patrulla existente activa en estado DISPONIBLE | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Columna patrulla_verificadora.estado actualizada a 'EN_VERIFICACION' de forma atómica | data.patrulla.estado retorna 'EN_VERIFICACION' persistido en patrulla_verificadora | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-05` | Registro automático del hito inicial DESPACHADA en la tabla mision_hito dentro de la transacción | Auditoría / Trazabilidad | Repositorio / BD | Crítica | Tabla mision_hito creada en base de datos | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Inserción en mision_hito con hito = 'DESPACHADA', mision_id y registrado_por_id del Encargado | data.hitoInicial retorna registro con hito = 'DESPACHADA' y descripción de asignación | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): crear migracion y tipos para tabla mision_hito (HU-20) |
| `CP-H20-API-06` | Emisión de evento WebSocket mision:asignada a la sala específica patrulla:{id} y a encargado | Tiempo Real / Socket.io | Servicio / Socket | Alta | Instancia Socket.io activa durante el despacho | POST /api/misiones con patrullaId = f1000000-0000-4000-8000-000000000001 | Emisión de evento 'mision:asignada' hacia la sala 'patrulla:f1000000-0000-4000-8000-000000000001' y 'encargado' | notificarMisionAsignada invocado con misionId, codigo, tipoMision, patrullaId e incidenteId | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-07` | Emisión de evento WebSocket incidente:actualizado a las salas encargado y mapa con nuevoEstado VERIFICANDO | Tiempo Real / Kanban | Servicio / Socket | Alta | Instancia Socket.io o Redis activa durante el despacho | POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | Emisión de 'incidente:actualizado' a 'encargado' y 'mapa' para mover tarjeta Kanban a columna VERIFICANDO | notificarIncidenteActualizado emitido con nuevoEstado = 'VERIFICANDO' a encargado y mapa | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-08` | Rechazo con HTTP 409 Conflict cuando la patrulla seleccionada cambió concurrentemente a estado no disponible | Concurrencia / ICS | Repositorio / API | Crítica | Patrulla en estado EN_VERIFICACION o NO_DISPONIBLE al ejecutar el UPDATE atómico | POST /api/misiones hacia patrullaId que ya no está en estado DISPONIBLE | HTTP 409 Conflict abortando la transacción sin crear misión ni alterar el incidente | HTTP 409 Conflict: "La patrulla verificadora '...' ya no se encuentra en estado 'DISPONIBLE' (estado actual: 'EN_VERIFICACION')." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20) |
| `CP-H20-API-09` | Rechazo con HTTP 409 Conflict cuando el incidente no se encuentra en estado REPORTADO | Regla de Negocio ICS | Repositorio / API | Crítica | Incidente en estado VERIFICANDO, EN_ATENCION o RESUELTO | POST /api/misiones con incidenteId en estado VERIFICANDO | HTTP 409 Conflict indicando que solo se pueden verificar incidentes en estado REPORTADO | HTTP 409 Conflict: "El incidente se encuentra en estado 'VERIFICANDO', por lo que no puede ser asignado a una patrulla verificadora..." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-10` | Denegación con HTTP 401 Unauthorized cuando la petición a POST /api/misiones carece de token JWT Bearer | Seguridad / Auth | API / AuthGuard | Crítica | Petición sin cabecera Authorization: Bearer <token> | POST /api/misiones sin cabeceras de autenticación | HTTP 401 Unauthorized rechazando el acceso anónimo | HTTP 401 Unauthorized devuelto por verificarAsignarMision | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |
| `CP-H20-API-11` | Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar | Seguridad / RBAC | API / AuthGuard | Crítica | Usuario con rol Call Center, Supervisor o Patrulla sin permiso misiones:asignar | POST /api/misiones con JWT de usuario sin permiso misiones:asignar | HTTP 403 Forbidden exigiendo el permiso misiones:asignar o perfil Administrador | HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador o el permiso 'misiones:asignar' para despachar misiones operativas." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-12` | Autorización exitosa para usuario con rol Encargado (poseedor del permiso misiones:asignar) o Administrador | Seguridad / RBAC | AuthGuard / Semilla BD | Alta | Rol Encargado con permiso misiones:asignar en tabla rol_permiso | POST /api/misiones con JWT de Encargado de Operaciones | Acceso permitido al servicio de asignación retornando 201 Created | verificarAsignarMision valida satisfactoriamente el permiso misiones:asignar | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-13` | Rechazo con HTTP 404 Not Found cuando el incidenteId proporcionado no existe en la base de datos | Manejo de Errores | Repositorio / API | Alta | UUID de incidente inexistente en tabla incidente | POST /api/misiones con incidenteId = 50000000-0000-4000-8000-999999999999 | HTTP 404 Not Found indicando que el incidente no fue encontrado | HTTP 404 Not Found: "Incidente con ID '...' no encontrado." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-14` | Rechazo con HTTP 404 Not Found cuando la patrullaId no existe o fue dada de baja lógica (eliminado_en IS NOT NULL) | Manejo de Errores / Baja Lógica | Repositorio / API | Alta | UUID de patrulla inexistente o con eliminado_en != null | POST /api/misiones con patrullaId = f1000000-0000-4000-8000-999999999999 | HTTP 404 Not Found impidiendo despachar patrullas inexistentes o desactivadas | HTTP 404 Not Found: "Patrulla verificadora con ID '...' no existe o ha sido desactivada." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-15` | Rechazo con HTTP 400 Bad Request ante payload con formato JSON sintácticamente inválido | Robustez / Contrato | API / Route | Media | Petición POST con cuerpo en texto plano malformado | POST /api/misiones con body "no-json-body" | HTTP 400 Bad Request indicando que el cuerpo debe ser un formato JSON válido | HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |
| `CP-H20-API-16` | Rechazo con HTTP 400 Bad Request cuando incidenteId o patrullaId no cumplen el formato UUID | Validación (Zod) | Schema / API | Media | Esquema CrearMisionVerificacionSchema | POST /api/misiones con {"incidenteId":"invalido","patrullaId":"patrulla-123"} | HTTP 400 Bad Request detallando los errores de validación por campo | HTTP 400 Bad Request con message "Datos de misión inválidos." y detalle en errors | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20) |
| `CP-H20-API-17` | Rechazo con HTTP 400 Bad Request cuando el título opcional tiene menos de 3 o más de 150 caracteres | Validación (Zod) | Schema / API | Baja | Esquema CrearMisionVerificacionSchema | POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Ok"} | HTTP 400 Bad Request indicando longitud mínima de 3 caracteres | Validación Zod rechaza con "El título debe contener al menos 3 caracteres." | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20) |
| `CP-H20-API-18` | Autogeneración de título por defecto y herencia de prioridad del incidente cuando se omiten campos opcionales | Funcional / Defaults | Esquema / Repositorio | Media | Payload mínimo solo con incidenteId y patrullaId | POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"} | tipoMision = 'VERIFICACION', titulo = 'Verificación de Incidente <CODIGO>' y prioridad heredada del incidente | Asignación por defecto aplicada en esquema Zod y repositorio | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-19` | Resiliencia de la respuesta HTTP 201 Created si ocurre una excepción al emitir eventos WebSocket | Resiliencia / Tolerancia a Fallos | Servicio | Media | Fallo simulado en el servidor Socket.io o Redis tras el commit en BD | POST /api/misiones con transacción exitosa y excepción en notificarMisionAsignada | La transacción en BD se preserva y el endpoint responde 201 Created registrando el error en log | Bloque try/catch en asignarPatrullaVerificacionService captura el error de socket sin abortar la respuesta 201 | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20) |
| `CP-H20-API-20` | Registro y exposición del contrato OpenAPI 3.0 para POST /api/misiones en GET /openapi.json | Contrato API / OpenAPI | OpenAPI Spec | Alta | Generador OpenApiGeneratorV3 en src/lib/openapi/index.ts | GET /openapi.json verificando paths["/api/misiones"].post | Operación POST /api/misiones documentada con CrearMisionVerificacionSchema, CrearMisionResponseSchema y códigos 201, 400, 401, 403, 404, 409 y 500 | Especificación OpenAPI 3.0 generada y validada sin errores | APROBADO | 06/11/2026 12:38 | 06/11/2026 12:38 | feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20) |

---

## 4. Bloque TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H20-API-01	Condición de carrera TOCTOU en incidente sin SELECT FOR UPDATE ni WHERE estado = REPORTADO permitiendo doble despacho	Concurrencia / ICS	Repositorio / BD	Crítica	Incidente en estado REPORTADO y 2 patrullas en estado DISPONIBLE	2 peticiones concurrentes POST /api/misiones al mismo incidenteId con Patrulla A y Patrulla B	Primera petición responde 201 Created; segunda petición aborta con 409 Conflict por incidente ya en VERIFICANDO	Sin forUpdate() en incidente ni WHERE estado = 'REPORTADO' en UPDATE, dos transacciones concurrentes crean 2 misiones de verificación para el mismo incidente	ABIERTO	06/11/2026 12:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H20-API-02	Contaminación de rama con archivos de HU-85 y doble colisión de correlativos de migración Kysely (032_ y 033_)	Integración / Migraciones	Base de Datos / Git	Crítica	Árbol de migraciones en src/lib/db/migrations comparado con develop	git diff develop...feature/h20-asignar-patrulla-verificacion y listado de src/lib/db/migrations	Rama aislada solo con cambios de HU-20 y migración mision_hito con correlativo único 034_	Colisión doble en 032_ (con cuadrilla) y 033_ (con 033_patrullas_codigo_vehiculo.ts) y 9 archivos de HU-85 arrastrados en el PR	ABIERTO	06/11/2026 12:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H20-API-03	Generación pseudoaleatoria no secuencial de mision.codigo (Math.random) con riesgo de colisión concurrente 23505 y bucle infinito	Integridad / Concurrencia	Repositorio / BD	Alta	Despacho de misiones consecutivas o simultáneas en POST /api/misiones	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Código correlativo secuencial único MIS-YYYY-NNNN protegido contra colisiones concurrentes	Usa Math.floor(1000 + Math.random() * 9000) generando códigos no secuenciales vulnerables a unique_violation 23505 bajo concurrencia	ABIERTO	06/11/2026 12:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H20-API-04	Asignación prematura de fecha_inicio en estado DESPACHADA y omisión de consulta a mision_hito en GET /api/misiones/{id}	Regla de Negocio ICS	Repositorio / Servicio	Alta	Misión recién creada en estado DESPACHADA vía POST /api/misiones	POST /api/misiones seguido de GET /api/misiones/{id}	fecha_inicio en null mientras está DESPACHADA y bitacoraTiempos poblada desde la tabla mision_hito	crearMisionVerificacionRepo fija fecha_inicio = new Date() al despachar y obtenerMisionDetallePorIdRepo ignora la tabla mision_hito	ABIERTO	06/11/2026 12:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H20-API-05	Publicación incompleta de eventos Socket.io en broker Redis omitiendo salas mapa, supervisor y sala:encargados	Tiempo Real / Redis	Infraestructura / Socket	Media	Worker HTTP sin ioInstance en memoria publicando vía REDIS_SOCKET_CHANNEL	POST /api/misiones con REDIS_URL activo	Publicación en Redis de patrulla:actualizada y mision:asignada a todas las salas (mapa, encargado, sala:encargados, supervisor, patrulla:{id})	notificarPatrullaActualizada solo publica en Redis a la sala encargado (omite mapa y supervisor) y notificarMisionAsignada omite sala:encargados y supervisor	ABIERTO	06/11/2026 12:38	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H20-API-01	Listado de patrullas verificadoras filtrando exclusivamente unidades en estado DISPONIBLE para el selector	Funcional / Consulta	API / Integración	Crítica	Patrullas activas registradas en distintos estados operativos	GET /api/patrullas?estado=DISPONIBLE con Header Authorization: Bearer <token_encargado>	HTTP 200 OK retornando únicamente patrullas activas (eliminado_en IS NULL) cuyo estado es DISPONIBLE	HTTP 200 OK con listado filtrado exclusivamente por estado DISPONIBLE	APROBADO	06/11/2026 12:38	06/11/2026 12:38	merge: sincronizar con develop y adaptar repositorio de patrullas a modelo de disponibilidad (HU-11)
CP-H20-API-02	Despacho atómico exitoso de patrulla disponible a incidente REPORTADO creando misión VERIFICACION en estado DESPACHADA	Funcional / Transaccional	API / Servicio / BD	Crítica	Incidente en estado REPORTADO y patrulla en estado DISPONIBLE	POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Verificación de anegamiento","prioridad":"ALTA"}	HTTP 201 Created con mision.tipoMision = 'VERIFICACION', mision.estado = 'DESPACHADA' y patrullaId vinculada	HTTP 201 Created creando registro en mision con tipo VERIFICACION y estado DESPACHADA	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
CP-H20-API-03	Transición atómica de incidente.estado a VERIFICANDO al confirmar la asignación de patrulla	Regla de Negocio ICS	Repositorio / BD	Crítica	Incidente existente en estado REPORTADO	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Columna incidente.estado actualizada a 'VERIFICANDO' dentro de la misma transacción Kysely	data.incidente.estado retorna 'VERIFICANDO' persistido en la tabla incidente	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-04	Transición atómica de patrulla_verificadora.estado a EN_VERIFICACION al confirmar el despacho	Regla de Negocio ICS	Repositorio / BD	Crítica	Patrulla existente activa en estado DISPONIBLE	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Columna patrulla_verificadora.estado actualizada a 'EN_VERIFICACION' de forma atómica	data.patrulla.estado retorna 'EN_VERIFICACION' persistido en patrulla_verificadora	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-05	Registro automático del hito inicial DESPACHADA en la tabla mision_hito dentro de la transacción	Auditoría / Trazabilidad	Repositorio / BD	Crítica	Tabla mision_hito creada en base de datos	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Inserción en mision_hito con hito = 'DESPACHADA', mision_id y registrado_por_id del Encargado	data.hitoInicial retorna registro con hito = 'DESPACHADA' y descripción de asignación	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): crear migracion y tipos para tabla mision_hito (HU-20)
CP-H20-API-06	Emisión de evento WebSocket mision:asignada a la sala específica patrulla:{id} y a encargado	Tiempo Real / Socket.io	Servicio / Socket	Alta	Instancia Socket.io activa durante el despacho	POST /api/misiones con patrullaId = f1000000-0000-4000-8000-000000000001	Emisión de evento 'mision:asignada' hacia la sala 'patrulla:f1000000-0000-4000-8000-000000000001' y 'encargado'	notificarMisionAsignada invocado con misionId, codigo, tipoMision, patrullaId e incidenteId	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-07	Emisión de evento WebSocket incidente:actualizado a las salas encargado y mapa con nuevoEstado VERIFICANDO	Tiempo Real / Kanban	Servicio / Socket	Alta	Instancia Socket.io o Redis activa durante el despacho	POST /api/misiones{"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	Emisión de 'incidente:actualizado' a 'encargado' y 'mapa' para mover tarjeta Kanban a columna VERIFICANDO	notificarIncidenteActualizado emitido con nuevoEstado = 'VERIFICANDO' a encargado y mapa	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-08	Rechazo con HTTP 409 Conflict cuando la patrulla seleccionada cambió concurrentemente a estado no disponible	Concurrencia / ICS	Repositorio / API	Crítica	Patrulla en estado EN_VERIFICACION o NO_DISPONIBLE al ejecutar el UPDATE atómico	POST /api/misiones hacia patrullaId que ya no está en estado DISPONIBLE	HTTP 409 Conflict abortando la transacción sin crear misión ni alterar el incidente	HTTP 409 Conflict: "La patrulla verificadora '...' ya no se encuentra en estado 'DISPONIBLE' (estado actual: 'EN_VERIFICACION')."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)
CP-H20-API-09	Rechazo con HTTP 409 Conflict cuando el incidente no se encuentra en estado REPORTADO	Regla de Negocio ICS	Repositorio / API	Crítica	Incidente en estado VERIFICANDO, EN_ATENCION o RESUELTO	POST /api/misiones con incidenteId en estado VERIFICANDO	HTTP 409 Conflict indicando que solo se pueden verificar incidentes en estado REPORTADO	HTTP 409 Conflict: "El incidente se encuentra en estado 'VERIFICANDO', por lo que no puede ser asignado a una patrulla verificadora..."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-10	Denegación con HTTP 401 Unauthorized cuando la petición a POST /api/misiones carece de token JWT Bearer	Seguridad / Auth	API / AuthGuard	Crítica	Petición sin cabecera Authorization: Bearer <token>	POST /api/misiones sin cabeceras de autenticación	HTTP 401 Unauthorized rechazando el acceso anónimo	HTTP 401 Unauthorized devuelto por verificarAsignarMision	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
CP-H20-API-11	Denegación con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso RBAC misiones:asignar	Seguridad / RBAC	API / AuthGuard	Crítica	Usuario con rol Call Center, Supervisor o Patrulla sin permiso misiones:asignar	POST /api/misiones con JWT de usuario sin permiso misiones:asignar	HTTP 403 Forbidden exigiendo el permiso misiones:asignar o perfil Administrador	HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador o el permiso 'misiones:asignar' para despachar misiones operativas."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-12	Autorización exitosa para usuario con rol Encargado (poseedor del permiso misiones:asignar) o Administrador	Seguridad / RBAC	AuthGuard / Semilla BD	Alta	Rol Encargado con permiso misiones:asignar en tabla rol_permiso	POST /api/misiones con JWT de Encargado de Operaciones	Acceso permitido al servicio de asignación retornando 201 Created	verificarAsignarMision valida satisfactoriamente el permiso misiones:asignar	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-13	Rechazo con HTTP 404 Not Found cuando el incidenteId proporcionado no existe en la base de datos	Manejo de Errores	Repositorio / API	Alta	UUID de incidente inexistente en tabla incidente	POST /api/misiones con incidenteId = 50000000-0000-4000-8000-999999999999	HTTP 404 Not Found indicando que el incidente no fue encontrado	HTTP 404 Not Found: "Incidente con ID '...' no encontrado."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-14	Rechazo con HTTP 404 Not Found cuando la patrullaId no existe o fue dada de baja lógica (eliminado_en IS NOT NULL)	Manejo de Errores / Baja Lógica	Repositorio / API	Alta	UUID de patrulla inexistente o con eliminado_en != null	POST /api/misiones con patrullaId = f1000000-0000-4000-8000-999999999999	HTTP 404 Not Found impidiendo despachar patrullas inexistentes o desactivadas	HTTP 404 Not Found: "Patrulla verificadora con ID '...' no existe o ha sido desactivada."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-15	Rechazo con HTTP 400 Bad Request ante payload con formato JSON sintácticamente inválido	Robustez / Contrato	API / Route	Media	Petición POST con cuerpo en texto plano malformado	POST /api/misiones con body "no-json-body"	HTTP 400 Bad Request indicando que el cuerpo debe ser un formato JSON válido	HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un formato JSON válido."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
CP-H20-API-16	Rechazo con HTTP 400 Bad Request cuando incidenteId o patrullaId no cumplen el formato UUID	Validación (Zod)	Schema / API	Media	Esquema CrearMisionVerificacionSchema	POST /api/misiones con {"incidenteId":"invalido","patrullaId":"patrulla-123"}	HTTP 400 Bad Request detallando los errores de validación por campo	HTTP 400 Bad Request con message "Datos de misión inválidos." y detalle en errors	APROBADO	06/11/2026 12:38	06/11/2026 12:38	test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)
CP-H20-API-17	Rechazo con HTTP 400 Bad Request cuando el título opcional tiene menos de 3 o más de 150 caracteres	Validación (Zod)	Schema / API	Baja	Esquema CrearMisionVerificacionSchema	POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001","titulo":"Ok"}	HTTP 400 Bad Request indicando longitud mínima de 3 caracteres	Validación Zod rechaza con "El título debe contener al menos 3 caracteres."	APROBADO	06/11/2026 12:38	06/11/2026 12:38	test(misiones): agregar pruebas unitarias e integracion para POST /api/misiones y concurrencia (HU-20)
CP-H20-API-18	Autogeneración de título por defecto y herencia de prioridad del incidente cuando se omiten campos opcionales	Funcional / Defaults	Esquema / Repositorio	Media	Payload mínimo solo con incidenteId y patrullaId	POST /api/misiones con {"incidenteId":"50000000-0000-4000-8000-000000000001","patrullaId":"f1000000-0000-4000-8000-000000000001"}	tipoMision = 'VERIFICACION', titulo = 'Verificación de Incidente <CODIGO>' y prioridad heredada del incidente	Asignación por defecto aplicada en esquema Zod y repositorio	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-19	Resiliencia de la respuesta HTTP 201 Created si ocurre una excepción al emitir eventos WebSocket	Resiliencia / Tolerancia a Fallos	Servicio	Media	Fallo simulado en el servidor Socket.io o Redis tras el commit en BD	POST /api/misiones con transacción exitosa y excepción en notificarMisionAsignada	La transacción en BD se preserva y el endpoint responde 201 Created registrando el error en log	Bloque try/catch en asignarPatrullaVerificacionService captura el error de socket sin abortar la respuesta 201	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(misiones): implementar transaccion atomica y RBAC para despacho de patrulla verificadora (HU-20)
CP-H20-API-20	Registro y exposición del contrato OpenAPI 3.0 para POST /api/misiones en GET /openapi.json	Contrato API / OpenAPI	OpenAPI Spec	Alta	Generador OpenApiGeneratorV3 en src/lib/openapi/index.ts	GET /openapi.json verificando paths["/api/misiones"].post	Operación POST /api/misiones documentada con CrearMisionVerificacionSchema, CrearMisionResponseSchema y códigos 201, 400, 401, 403, 404, 409 y 500	Especificación OpenAPI 3.0 generada y validada sin errores	APROBADO	06/11/2026 12:38	06/11/2026 12:38	feat(api): implementar endpoint POST /api/misiones y registrar contrato en openapi (HU-20)
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

 ✓ src/modules/misiones/__tests__/mision.service.test.ts (4 tests) 8ms
 ✓ src/modules/misiones/__tests__/mision.schema.test.ts (11 tests) 14ms
 ✓ src/app/api/misiones/__tests__/route.test.ts (10 tests) 21ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 106ms

 Test Files  4 passed (4)
      Tests  26 passed (26)
   Start at  12:38:28
   Duration  816ms (transform 398ms, setup 0ms, collect 837ms, tests 149ms, environment 1ms, prepare 276ms)
```

#### 5.1.2 Ejecución Focalizada por Casos de HU-20 (`-t`)
```bash
npm test -- -t "CrearMisionVerificacionSchema \(HU-20\)"
npm test -- -t "asignarPatrullaVerificacionService \(HU-20\)"
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

#### Caso 5: Despacho Atómico Exitoso de Patrulla Verificadora (`201 Created` — `CP-H20-API-02` a `05`)
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
      "codigo": "MIS-2026-5555",
      "titulo": "Verificación de anegamiento",
      "descripcion": "Evaluar anegamiento en calzada",
      "tipoMision": "VERIFICACION",
      "estado": "DESPACHADA",
      "prioridad": "ALTA",
      "incidenteId": "50000000-0000-4000-8000-000000000001",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "encargadoId": "00000000-0000-4000-8000-000000000003",
      "fechaInicio": "2026-10-27T17:00:00.000Z",
      "creadoEn": "2026-10-27T17:00:00.000Z"
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
      "creadoEn": "2026-10-27T17:00:00.000Z"
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

#### Caso 7: Bloqueo si el Incidente Ya No Está en Estado `REPORTADO` (`409 Conflict` — `CP-H20-API-09`)
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
| **CA-1:** Desde el detalle o drawer de un incidente en estado `REPORTADO`, el sistema debe proveer un selector accesible para asignar una patrulla verificadora. | `CP-H20-API-01`, `CP-H20-API-09`, `CP-H20-API-20` | 🟢 **CUMPLIDO** | El backend provee `GET /api/patrullas?estado=DISPONIBLE` y valida en `POST /api/misiones` que el incidente esté en estado `REPORTADO`. |
| **CA-2:** El selector debe listar únicamente las patrullas que se encuentren en estado `DISPONIBLE` en la base de datos. | `CP-H20-API-01`, `CP-H20-API-14` | 🟢 **CUMPLIDO** | `listarPatrullasRepo` filtra por `pv.estado = 'DISPONIBLE'` y `pv.eliminado_en IS NULL`, y `crearMisionVerificacionRepo` exige `estado = 'DISPONIBLE'` y `eliminado_en IS NULL`. |
| **CA-3:** Al confirmar la asignación, la API debe ejecutar una transacción atómica: (1) Crear registro en `mision` con `tipo_mision = 'VERIFICACION'`, `estado = 'DESPACHADA'` y `patrulla_id`, (2) Actualizar `incidente.estado = 'VERIFICANDO'`, (3) Actualizar `patrulla_verificadora.estado = 'EN_VERIFICACION'`, y (4) Registrar el hito inicial en `mision_hito`. | `CP-H20-API-02`, `CP-H20-API-03`, `CP-H20-API-04`, `CP-H20-API-05`, `BUG-H20-API-01`, `BUG-H20-API-02`, `BUG-H20-API-03`, `BUG-H20-API-04` | 🔴 **CON DEFECTO (`BUG-H20-API-01` a `04`)** | Ejecuta las 4 operaciones dentro de `db.transaction().execute()`, pero omite `forUpdate()` y `.where("estado", "=", "REPORTADO")` en `incidente`, genera `mision.codigo` con `Math.random()`, fija prematuramente `fecha_inicio = new Date()` y presenta colisión de migración `033_`. |
| **CA-4:** El sistema debe emitir el evento WebSocket `mision:asignada` a la sala específica de la patrulla (`patrulla:{id}`) y `incidente:actualizado` a las salas `encargado` y `mapa`. | `CP-H20-API-06`, `CP-H20-API-07`, `CP-H20-API-19`, `BUG-H20-API-05` | 🟡 **PARCIAL (`BUG-H20-API-05`)** | En memoria (`ioInstance`) emite a todas las salas, pero a través del broker Redis (`REDIS_SOCKET_CHANNEL`) `notificarPatrullaActualizada` omite `mapa` y `supervisor`, y `notificarMisionAsignada` omite `sala:encargados` y `supervisor`. |
| **CA-5:** Si la patrulla seleccionada cambió de estado concurrentemente a no disponible, la API debe abortar con `409 Conflict` y notificar al Encargado. | `CP-H20-API-08`, `BUG-H20-API-01` | 🟡 **PARCIAL (`BUG-H20-API-01`)** | Protege contra concurrencia sobre la misma `patrulla_verificadora`, pero no protege contra concurrencia sobre el mismo `incidente` (permitiendo asignar dos patrullas distintas al mismo incidente en paralelo). |
| **CA-6:** El incidente en el tablero Kanban debe moverse automáticamente a la columna 'VERIFICANDO' sin requerir refresco manual. | `CP-H20-API-03`, `CP-H20-API-07` | 🟢 **CUMPLIDO (EN BACKEND)** | `notificarIncidenteActualizado` emite `incidente:actualizado` con `nuevoEstado: "VERIFICANDO"` tanto en memoria como por Redis hacia las salas `encargado`, `sala:encargados` y `mapa`. |
| **CA-7:** El endpoint `POST /api/misiones` debe exigir el permiso RBAC `misiones:asignar`. | `CP-H20-API-10`, `CP-H20-API-11`, `CP-H20-API-12` | 🟢 **CUMPLIDO** | `verificarAsignarMision` exige el permiso `misiones:asignar` (o perfil `Administrador`), devolviendo `401` sin sesión y `403` sin privilegios. |

