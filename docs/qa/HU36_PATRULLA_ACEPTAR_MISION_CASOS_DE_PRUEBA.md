# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-36 — Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Misiones / Operaciones de Terreno y Despliegue (`sgrai-api` — `POST /api/misiones/[id]/aceptar`).  
> **Historia de Usuario:** HU-36 — *"Como Patrulla verificadora Quiero confirmar y aceptar la misión asignada desde el dispositivo móvil para informar que el equipo se dirige al lugar. Para notificar a la central que la patrulla ha tomado conocimiento de la emergencia y va en trayecto para iniciar la evaluación."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Redis + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/h36-patrulla-aceptar-mision`  
> **Commits Evaluados en la Rama:**  
> * `feat(db): agregar tabla mision_hito y permiso misiones:terreno:verificar (#37)`  
> * `feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)`  
> * `test(misiones): agregar pruebas unitarias para aceptacion de mision por patrulla (#37)`  
> * `docs(misiones): documentar endpoint de aceptacion de mision y esquema mision_hito (#37)`  
>  
> **Fecha de Auditoría:** 09/11/2026 12:15.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección estática y dinámica del código fuente, revisión de transacciones ACID en Kysely/PostgreSQL, encadenamiento de migraciones respecto a `develop`, validación de reglas de negocio del Sistema de Comando de Incidentes (ICS), difusión de eventos en tiempo real vía Socket.io/Redis, contratos OpenAPI 3.0 y pruebas automatizadas en Vitest sobre la rama `feature/h36-patrulla-aceptar-mision`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** debido a la detección de **5 defectos reales** (2 críticos, 2 altos y 1 medio) que comprometen el control de acceso entre patrullas verificadoras, la trazabilidad del hito `'Misión Aceptada por Patrulla'` en la bitácora del Centro de Mando (`GET /api/misiones/{id}`), la integridad de la secuencia de migraciones Kysely (`033_` y `034_` en colisión con `develop`), la validación de invariantes ICS sobre patrullas e incidentes, y la paridad de difusión de eventos en el broker Redis.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H36-API-01` a `05`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io (`CP-H36-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Validación Zod de UUID y rangos GPS, RBAC `misiones:terreno:verificar`, transición `DESPACHADA` -> `EN_CURSO`, bloqueo `409 Conflict`, inserción en `mision_hito` y contrato OpenAPI |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de infraestructura externa |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere el 100.0% (0 defectos abiertos) en Re-Test para aprobar la integración a `develop` |
| **Suite Automatizada de Misiones (Vitest)** | **41/41 tests pass (con mocks)** | `route.test.ts` (7), `mision-aceptar.service.test.ts` (4), `mision-aceptar.repository.test.ts` (4), `mision.schema.test.ts` (6), `mision.service.test.ts` (3), `mision-listado.test.ts` (7), `misiones/[id]/route.test.ts` (6), `misiones/route.test.ts` (3) y `openapi.json` (1) |
| **Análisis Estático ESLint (Módulo Misiones)** | **0 errores** | 0 errores en `src/app/api/misiones`, `src/modules/misiones`, `src/lib/socket` y `src/lib/openapi` (1 error heredado en `cuadrilla.service.test.ts` por desfase con `develop`) |
| **Secuencia de Migraciones Kysely (`npm run db:migrate`)** | 🔴 **Fallo por colisión y desfase** | Rama desfasada 39 commits respecto a `develop`; omite `027_`/`032_` y colisiona en `033_` y `034_` con migraciones ya ejecutadas en `develop` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H36-API-01`: Bypass de Autorización de Patrulla Verificadora en `aceptarMisionPatrullaRepo` Cuando `patrulla_id` es `NULL` o el Líder de Patrulla Posee un Rol Distinto a `PATRULLA_VERIFICADORA`
* **Severidad:** **CRÍTICA** (Brecha de Seguridad / Control de Acceso Horizontal entre Unidades Operativas y Violación ICS).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 388-410).
* **Descripción Técnica del Defecto:**  
  En `aceptarMisionPatrullaRepo`, la validación de pertenencia del funcionario autenticado a la patrulla verificadora asignada está implementada de la siguiente forma:
  ```typescript
  // 2. Validar pertenencia a la patrulla verificadora asignada (salvo Administrador)
  if (!esAdmin && misionExistente.patrulla_id) {
    const esLiderDirecto = misionExistente.patrulla_lider_id === usuarioId;
    const liderEsPatrulla =
      misionExistente.lider_rol_codigo === "PATRULLA_VERIFICADORA" ||
      misionExistente.lider_rol_nombre === "Patrulla Verificadora";

    if (!esLiderDirecto && liderEsPatrulla) {
      const integrante = await trx
        .selectFrom("patrulla_personal")
        ...
  ```
  Esta lógica presenta dos fallas críticas de autorización:
  1. **Aceptación indebida de misiones sin patrulla asignada (`misionExistente.patrulla_id === null`):** El repositorio no verifica que la misión tenga efectivamente una patrulla verificadora asignada (`patrulla_id !== null`). Si existe una misión en estado `'DESPACHADA'` asignada a una cuadrilla operativa (`tipo_mision = 'ATENCION_CUADRILLA'`, `cuadrilla_id !== null`, `patrulla_id === null`), la condición `if (!esAdmin && misionExistente.patrulla_id)` evalúa a `false`, permitiendo que cualquier patrullero acepte la misión de una cuadrilla e inserte el hito `'Misión Aceptada por Patrulla'`.
  2. **Bypass total de pertenencia cuando el líder de la patrulla tiene otro rol o es `null` (`!liderEsPatrulla`):** Al exigir `&& liderEsPatrulla` para consultar `patrulla_personal`, si la patrulla asignada a la misión tiene como `usuario_lider_id` a un funcionario con rol distinto a `PATRULLA_VERIFICADORA` (por ejemplo, en `seed-kanban.ts` las unidades `Patrulla Rápida Costa-1` y `Patrulla Rápida Centro-Sur` tienen como líder al usuario `00000000-0000-4000-8000-000000000003` con rol `ENCARGADO`, o cuando `usuario_lider_id` es `null`), la variable `liderEsPatrulla` es `false`. En consecuencia, el bloque `if (!esLiderDirecto && liderEsPatrulla)` se omite por completo y **cualquier integrante de otra patrulla verificadora distinta** puede aceptar la misión ajena sin recibir `403 Forbidden`.
* **Pasos para Reproducir:**
  1. Disponer de la misión `68abde99-780d-41a9-aee6-f68371d226aa` (`MIS-2026-0007`, estado `DESPACHADA`), asignada a `Patrulla Rápida Centro-Sur` (`f1000000-0000-4000-8000-000000000002`), cuyo `usuario_lider_id` tiene rol `ENCARGADO`.
  2. Invocar `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` autenticado como un funcionario perteneciente a otra patrulla (ej. `Patrulla Rápida Las Ánimas`).
  3. O bien, invocar `POST /api/misiones/{id}/aceptar` sobre una misión con `patrulla_id = null` y `estado = 'DESPACHADA'`.
* **Comportamiento Actual:** El sistema omite la validación de `patrulla_personal` y permite aceptar misiones de otras patrullas o misiones sin patrulla asignada (`200 OK`).
* **Comportamiento Esperado:**
  1. Si `misionExistente.patrulla_id === null`, debe rechazar la operación con `ConflictError` (`409`) o `BadRequestError` (`400`) indicando que la misión no corresponde a una patrulla verificadora.
  2. Si `!esAdmin`, debe exigir siempre que `usuarioId === misionExistente.patrulla_lider_id` o que el usuario exista como integrante en `patrulla_personal` para `misionExistente.patrulla_id`, sin condicionar dicha verificación al rol del líder (`liderEsPatrulla`).
* **Sugerencia Técnica de Solución:**  
  En `src/modules/misiones/mision.repository.ts`:
  ```typescript
  if (!misionExistente.patrulla_id) {
    throw new ConflictError(
      "La misión indicada no tiene una patrulla verificadora asignada."
    );
  }

  if (!esAdmin) {
    const esLiderDirecto = misionExistente.patrulla_lider_id === usuarioId;
    if (!esLiderDirecto) {
      const integrante = await trx
        .selectFrom("patrulla_personal")
        .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
        .select("patrulla_personal.id")
        .where("patrulla_personal.patrulla_id", "=", misionExistente.patrulla_id)
        .where("personal.usuario_id", "=", usuarioId)
        .executeTakeFirst();

      if (!integrante) {
        throw new ForbiddenError(
          "No está autorizado para aceptar una misión asignada a otra patrulla verificadora."
        );
      }
    }
  }
  ```

---

### `BUG-H36-API-02`: Omisión de Consulta a la Tabla `mision_hito` en `obtenerMisionDetallePorIdRepo` y `obtenerDetalleMisionService` — El Hito `'Misión Aceptada por Patrulla'` No se Refleja en la Bitácora del Centro de Mando (`GET /api/misiones/{id}`)
* **Severidad:** **CRÍTICA** (Incumplimiento de Trazabilidad de Bitácora del Centro de Mando y Criterio de Aceptación 3).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/misiones/mision.repository.ts` (Líneas 112-307)
  * `src/modules/misiones/mision.service.ts` (Líneas 44-96)
* **Descripción Técnica del Defecto:**  
  El Criterio de Aceptación 3 y las tareas técnicas de la historia exigen registrar el hito `'Misión Aceptada por Patrulla'` (`hito = 'MISION_ACEPTADA'`) en la tabla `mision_hito` y reflejar dicho evento en la bitácora del Centro de Mando.
  Sin embargo, al inspeccionar `obtenerMisionDetallePorIdRepo` (`src/modules/misiones/mision.repository.ts`) y `obtenerDetalleMisionService` (`src/modules/misiones/mision.service.ts`):
  1. `obtenerMisionDetallePorIdRepo` **no realiza ninguna consulta a la tabla `mision_hito`**.
  2. `obtenerDetalleMisionService` (líneas 54-96) construye el arreglo `bitacoraTiempos` únicamente con hitos sintéticos derivados de las columnas de `mision` (`"CREACION"`, `"DESPLIEGUE_INICIO"`, `"CIERRE_MISION"`, `"ACTUALIZACION_ESTADO"`).
  3. En consecuencia, tras ejecutar `POST /api/misiones/{id}/aceptar`, cuando el Centro de Mando consulta `GET /api/misiones/{id}`, el hito `'MISION_ACEPTADA'` (`'Misión Aceptada por Patrulla'`) persistido en `mision_hito` es ignorado y nunca se expone en `data.bitacoraTiempos`.
* **Pasos para Reproducir:**
  1. Aceptar una misión en estado `DESPACHADA` mediante `POST /api/misiones/{id}/aceptar`.
  2. Consultar el detalle de la misión mediante `GET /api/misiones/{id}` y revisar el arreglo `data.bitacoraTiempos`.
* **Comportamiento Actual:** `data.bitacoraTiempos` contiene únicamente glosas sintéticas (`"CREACION"`, `"DESPLIEGUE_INICIO"`, `"ACTUALIZACION_ESTADO"`) y omite por completo los registros de `mision_hito` (`"MISION_ACEPTADA"` / `"Misión Aceptada por Patrulla"`).
* **Comportamiento Esperado:** `obtenerMisionDetallePorIdRepo` debe consultar los hitos de `mision_hito` asociados a `mision_id` ordenados cronológicamente (`ORDER BY creado_en ASC`), y `obtenerDetalleMisionService` debe poblar `bitacoraTiempos` con los hitos reales registrados en la bitácora (manteniendo el fallback a timestamps solo para misiones históricas sin registros en `mision_hito`).
* **Sugerencia Técnica de Solución:**  
  En `obtenerMisionDetallePorIdRepo` (`src/modules/misiones/mision.repository.ts`), consultar `db.selectFrom("mision_hito").selectAll().where("mision_id", "=", id).orderBy("creado_en", "asc").execute()` e incluir `hitos` en el retorno para que `obtenerDetalleMisionService` los transforme mediante `desglosarHitoTiempo(h.creado_en, h.hito, h.descripcion)`.

---

### `BUG-H36-API-03`: Desfase de 39 Commits con `develop`, Colisión de Numeración en Migraciones Kysely (`033_` y `034_`) y Fallo de `npm run db:migrate` que Impide Aplicar el Permiso `misiones:terreno:verificar`
* **Severidad:** **ALTA** (Ruptura de Integración Continua, Corrupción del Árbol de Migraciones Kysely y Bloqueo RBAC en Entorno Integrado).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/db/migrations/033_mision_hito_bitacora.ts`
  * `src/lib/db/migrations/034_permiso_misiones_terreno_verificar.ts`
* **Descripción Técnica del Defecto:**  
  1. **Desfase con la rama `develop`:** La rama `feature/h36-patrulla-aceptar-mision` fue creada a partir del commit `efd57bb` y se encuentra **39 commits por detrás de `develop`**, careciendo de las migraciones `027_cuadrilla_auditoria_y_unicidad.ts`, `032_cuadrilla_baja_logica_activo.ts`, `033_patrullas_codigo_vehiculo.ts` y `034_patrulla_desactivacion_baja_logica.ts` (además de arrastrar un error de ESLint `@typescript-eslint/no-explicit-any` en `cuadrilla.service.test.ts:374` ya corregido en `develop`).
  2. **Colisión directa de correlativos `033_` y `034_`:** En `develop` ya existen y han sido ejecutadas `033_patrullas_codigo_vehiculo.ts` y `034_patrulla_desactivacion_baja_logica.ts` (y en `feature/h20-asignar-patrulla-verificacion` se definió `034_mision_hito_bitacora.ts`). En esta rama se nombraron las migraciones como `033_mision_hito_bitacora.ts` y `034_permiso_misiones_terreno_verificar.ts`.
  3. **Bloqueo de `npm run db:migrate` y fallo `403` para Patrullas Verificadoras:** Al ejecutar `npm run db:migrate`, Kysely lanza `Error: corrupted migrations: previously executed migration 027_cuadrilla_auditoria_y_unicidad is missing` (y al sincronizar con `develop` falla porque `'033_mision_hito_bitacora' < '033_patrullas_codigo_vehiculo'`). Como consecuencia, la migración que inserta el permiso `misiones:terreno:verificar` y lo asigna al rol `PATRULLA_VERIFICADORA` no se aplica en la base de datos, provocando que todo usuario con rol `PATRULLA_VERIFICADORA` reciba `HTTP 403 Forbidden` (`{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}`).
* **Pasos para Reproducir:**
  1. Ejecutar `npm run db:migrate` en la rama `feature/h36-patrulla-aceptar-mision`.
  2. Invocar `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con un usuario de rol `PATRULLA_VERIFICADORA` (`x-user-id: d1000000-0000-4000-8000-000000000001`).
* **Comportamiento Actual:** `npm run db:migrate` termina con código de error `1` (`corrupted migrations`) y la petición del patrullero es rechazada con `403 Forbidden`.
* **Comportamiento Esperado:** La rama debe estar actualizada con `develop`, las migraciones deben poseer correlativos secuenciales posteriores a las ya existentes en `develop` (ej. `035_mision_hito_bitacora.ts` y `036_permiso_misiones_terreno_verificar.ts`), y `npm run db:migrate` junto con `npm run lint` deben finalizar con código `0`.
* **Sugerencia Técnica de Solución:**  
  Integrar `develop` en `feature/h36-patrulla-aceptar-mision` (`git merge develop`), renumerar las migraciones a los siguientes correlativos disponibles (`035_mision_hito_bitacora.ts` y `036_permiso_misiones_terreno_verificar.ts`) y verificar la ejecución limpia de `npm run db:migrate`.

---

### `BUG-H36-API-04`: Ausencia de Bloqueo Pesimista (`forUpdate()`) y de Validación de Invariantes ICS sobre Patrulla (`EN_VERIFICACION` / Activa) e Incidente (`VERIFICANDO`) en `aceptarMisionPatrullaRepo`
* **Severidad:** **ALTA** (Violación del Criterio de Aceptación 4 e Inconsistencia de Estado Operativo ICS).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/misiones/mision.repository.ts` (Líneas 361-386 y 476-489).
* **Descripción Técnica del Defecto:**  
  El Criterio de Aceptación 4 establece: *"El estado de la patrulla verificadora debe mantenerse en `EN_VERIFICACION` y el incidente permanece en `VERIFICANDO` (corrigiendo la ambigüedad de 'En camino', que no es un estado canónico de incidente)"*.
  En `aceptarMisionPatrullaRepo` (`src/modules/misiones/mision.repository.ts`):
  1. La consulta inicial sobre `mision` (líneas 361-382) no adquiere bloqueo pesimista (`.forUpdate()` de `mision`) y utiliza `LEFT JOIN` sin verificar que la patrulla verificadora asignada no haya sido dada de baja lógicamente (`patrulla_verificadora.eliminado_en IS NULL`).
  2. Tampoco valida ni garantiza que `patrulla_verificadora.estado` sea `'EN_VERIFICACION'` ni que `incidente.estado` (cuando `incidente_id !== null`) se encuentre en `'VERIFICANDO'`. Si el incidente asociado ya fue cerrado (`RESUELTO` o `NO_ABORDABLE`) o si la patrulla fue desactivada (`NO_DISPONIBLE`) o permanecía en `DISPONIBLE`, el método igualmente transiciona la misión a `EN_CURSO` y devuelve en la respuesta el estado inválido (`patrulla.estado: "NO_DISPONIBLE"` o `incidente.estado: "RESUELTO"`), contradiciendo el CA-4 y el esquema OpenAPI `AceptarMisionResponseSchema`.
* **Pasos para Reproducir:**
  1. Tener una misión en estado `DESPACHADA` cuya patrulla asignada esté en estado `NO_DISPONIBLE` (o con `eliminado_en IS NOT NULL`) o cuyo incidente esté en estado `RESUELTO`.
  2. Ejecutar `POST /api/misiones/{id}/aceptar`.
* **Comportamiento Actual:** La misión pasa a `EN_CURSO` sin rechazar la anomalía ni asegurar los estados `EN_VERIFICACION` / `VERIFICANDO`.
* **Comportamiento Esperado:** Dentro de la transacción Kysely, se debe bloquear la fila de la misión, verificar que la patrulla asignada esté activa (`eliminado_en IS NULL`), asegurar/validar que la patrulla se encuentre en `EN_VERIFICACION` y que el incidente asociado (si existe) se encuentre en `VERIFICANDO` (rechazando con `409 Conflict` si el incidente ya fue resuelto/cerrado o si la patrulla está inactiva).
* **Sugerencia Técnica de Solución:**  
  En `aceptarMisionPatrullaRepo`, verificar `patrulla_verificadora.eliminado_en === null`, validar que si existe `incidente_id` su estado sea `'VERIFICANDO'` (o rechazar con `ConflictError` si ya fue cerrado), y garantizar en la transacción que `patrulla_verificadora.estado` se mantenga en `'EN_VERIFICACION'` (actualizando además sus coordenadas si se proveen en `input`).

---

### `BUG-H36-API-05`: Asimetría de Emisión WebSocket en `notificarMisionActualizada` (Duplicidad en Memoria vs Omisión de Salas en Redis) y Falta de Validación de Paridad de Coordenadas GPS en `AceptarMisionInputSchema`
* **Severidad:** **MEDIA** (Desincronización de Tiempo Real en Redis Pub/Sub y Validación Incompleta de Payload Geográfico).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/lib/socket/index.ts` (Líneas 644-670)
  * `src/modules/misiones/mision.schema.ts` (Líneas 220-242)
* **Descripción Técnica del Defecto:**  
  1. **Asimetría entre Socket.io en memoria y Redis Pub/Sub en `notificarMisionActualizada` (`src/lib/socket/index.ts`):**
     - En la rama en memoria (`if (ioInstance)`, líneas 645-654), se emite el evento `"mision:actualizada"` a las salas `"encargado"`, `"sala:encargados"` y `"supervisor"`, e inmediatamente después se ejecuta `(ioInstance as any).emit("mision:actualizada", payload)` (broadcast global a todos los clientes conectados), ocasionando que cualquier cliente en `"encargado"` o `"sala:encargados"` reciba el mismo evento **dos veces** por cada aceptación.
     - En cambio, cuando `ioInstance` es `null` y se emplea el broker Redis (`if (publisher)`, líneas 656-669), se publica **únicamente** un mensaje hacia `room: "encargado"`, omitiendo `"sala:encargados"` y `"supervisor"`. Los clientes del Centro de Mando suscritos a `"sala:encargados"` o `"supervisor"` a través del suscriptor Redis no reciben la notificación en tiempo real.
  2. **Coordenadas GPS huérfanas en `AceptarMisionInputSchema` (`src/modules/misiones/mision.schema.ts`):**
     - `AceptarMisionInputSchema` define `latitud` y `longitud` como campos opcionales independientes sin una regla `.refine(...)` que exija que ambos se envíen juntos. Si se envía `{"latitud": -39.819588}` sin `longitud` (o viceversa), el esquema lo aprueba y persiste una coordenada incompleta (`latitud: -39.819588, longitud: null`) en `mision_hito`.
* **Pasos para Reproducir:**
  1. Ejecutar `POST /api/misiones/{id}/aceptar` con `REDIS_URL` configurado y `ioInstance = null`: verificar que en el canal `sgrai:socket-events` solo se publica a `room: "encargado"`.
  2. Enviar `POST /api/misiones/{id}/aceptar` con body `{"latitud": -39.819588}` (sin `longitud`).
* **Comportamiento Actual:** En Redis se omite `"sala:encargados"` y `"supervisor"` (mientras que en memoria se duplica por broadcast global), y el body con una sola coordenada es aceptado con `200 OK`.
* **Comportamiento Esperado:** `notificarMisionActualizada` debe emitir/publicar de forma consistente a las salas `["encargado", "sala:encargados", "supervisor"]` tanto en memoria (sin broadcast global duplicado) como en Redis Pub/Sub; y `AceptarMisionInputSchema` debe rechazar con `400 Bad Request` cuando se proporcione solo una de las dos coordenadas (`latitud` sin `longitud` o `longitud` sin `latitud`).
* **Sugerencia Técnica de Solución:**  
  1. En `src/lib/socket/index.ts`, eliminar `(ioInstance as any).emit("mision:actualizada", payload)` y en el bloque `if (publisher)` iterar sobre `["encargado", "sala:encargados", "supervisor"]`.
  2. En `src/modules/misiones/mision.schema.ts`, encadenar `.refine((data) => !data || (data.latitud !== undefined) === (data.longitud !== undefined), { message: "Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS.", path: ["longitud"] })`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H36-API-01` | Bypass de autorización de patrulla cuando patrulla_id es null o cuando el líder de la patrulla posee un rol distinto a PATRULLA_VERIFICADORA | Seguridad / Regla de Negocio ICS | Repositorio / BD | Crítica | Misión en estado DESPACHADA asignada a patrulla cuyo líder tiene rol ENCARGADO o misión sin patrulla_id | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` invocado por un patrullero de otra unidad | HTTP 403 Forbidden si el usuario no pertenece a la patrulla asignada y HTTP 409/400 si la misión no tiene patrulla asignada | La condición `if (!esLiderDirecto && liderEsPatrulla)` se salta la consulta a `patrulla_personal` cuando el líder tiene rol ENCARGADO, y `if (!esAdmin && misionExistente.patrulla_id)` permite aceptar misiones con `patrulla_id = null` | ABIERTO | 09/11/2026 12:10 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-API-02` | Omisión de consulta a mision_hito en obtenerMisionDetallePorIdRepo impidiendo reflejar el hito Misión Aceptada por Patrulla en bitácora | Funcional / Trazabilidad ICS | Repositorio / Servicio | Crítica | Misión aceptada mediante `POST /api/misiones/{id}/aceptar` con hito registrado en `mision_hito` | `GET /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa` | `data.bitacoraTiempos` incluye el hito `MISION_ACEPTADA` (`"Misión Aceptada por Patrulla"`) registrado en `mision_hito` | `obtenerMisionDetallePorIdRepo` no consulta `mision_hito`; `bitacoraTiempos` solo retorna glosas sintéticas de `mision` omitiendo el hito aceptado | ABIERTO | 09/11/2026 12:12 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-API-03` | Desfase de 39 commits con develop y colisión de migraciones Kysely 033_ y 034_ bloqueando npm run db:migrate y permiso misiones:terreno:verificar | Integración / Base de Datos | Migraciones / RBAC | Alta | Base de datos sincronizada con `develop` (migraciones hasta `034_`) | `npm run db:migrate` y `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `x-user-id: d1000000-0000-4000-8000-000000000001` | Migraciones se ejecutan secuencialmente sin colisión y el rol `PATRULLA_VERIFICADORA` recibe el permiso `misiones:terreno:verificar` | `npm run db:migrate` aborta con `corrupted migrations` por ausencia de `027_`/`032_` y colisión de `033_`/`034_`; el usuario patrulla recibe `403 Forbidden` | ABIERTO | 09/11/2026 12:14 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-API-04` | Ausencia de bloqueo pesimista forUpdate() y falta de validación de invariantes ICS sobre patrulla activa (EN_VERIFICACION) e incidente (VERIFICANDO) | Regla de Negocio / Concurrencia ICS | Repositorio / BD | Alta | Misión DESPACHADA asociada a patrulla inactiva/NO_DISPONIBLE o incidente RESUELTO | `POST /api/misiones/{id}/aceptar` | Validación con bloqueo pesimista asegurando patrulla activa en `EN_VERIFICACION` e incidente en `VERIFICANDO` (o rechazo `409 Conflict`) | No aplica `.forUpdate()` ni valida `eliminado_en IS NULL`, `patrulla.estado === 'EN_VERIFICACION'` o `incidente.estado === 'VERIFICANDO'` | ABIERTO | 09/11/2026 12:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-API-05` | Asimetría de difusión WebSocket mision:actualizada entre memoria y Redis Pub/Sub y aceptación de coordenada GPS huérfana sin paridad | Tiempo Real / Validación Zod | Socket / Schema | Media | `REDIS_URL` activo o petición con solo `{"latitud": -39.819588}` sin `longitud` | `POST /api/misiones/{id}/aceptar` con body `{"latitud": -39.819588}` | Emisión en Redis a `encargado`, `sala:encargados` y `supervisor` sin duplicación en memoria, y `400 Bad Request` ante coordenada incompleta | En Redis solo publica a `room: "encargado"` (y en memoria duplica con `ioInstance.emit`), y acepta `latitud` sin `longitud` guardando `longitud: null` | ABIERTO | 09/11/2026 12:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H36-API-01` | Aceptación exitosa de misión en estado DESPACHADA sin cuerpo en la petición (`200 OK`) | Funcional / Positiva | Integración / Route Handler | Crítica | Misión `60000000-0000-4000-8000-000000000001` en estado `DESPACHADA` y usuario autorizado | `POST /api/misiones/60000000-0000-4000-8000-000000000001/aceptar` sin body | HTTP 200 OK con `mision.estado: "EN_CURSO"`, `fechaInicio` ISO 8601 y `hito.hito: "MISION_ACEPTADA"` | HTTP 200 OK con transición a `EN_CURSO` e hito registrado | APROBADO | 09/11/2026 12:11 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-02` | Aceptación exitosa de misión en estado DESPACHADA enviando coordenadas GPS válidas desde la PWA (`200 OK`) | Funcional / Positiva | Integración / Endpoint | Crítica | Misión `68abde99-780d-41a9-aee6-f68371d226aa` en estado `DESPACHADA` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con body `{"latitud":-39.819588,"longitud":-73.245209}` | HTTP 200 OK persistiendo `latitud: -39.819588` y `longitud: -73.245209` en `data.hito` | HTTP 200 OK con coordenadas GPS almacenadas en `mision_hito` y devueltas en `data.hito` | APROBADO | 09/11/2026 12:16 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-03` | Fijación automática de `mision.fecha_inicio = CURRENT_TIMESTAMP` y `mision.actualizado_en = CURRENT_TIMESTAMP` al aceptar | Integridad / Base de Datos | Repositorio / Transacción | Crítica | Misión en estado `DESPACHADA` con `fecha_inicio = null` | `aceptarMisionPatrullaRepo(misionId, liderId, false)` | Columnas `fecha_inicio` y `actualizado_en` actualizadas con timestamp del servidor en formato ISO 8601 | `fecha_inicio` y `actualizado_en` actualizados atómicamente con `CURRENT_TIMESTAMP` | APROBADO | 09/11/2026 12:11 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-04` | Registro automático del hito `'MISION_ACEPTADA'` con glosa `'Misión Aceptada por Patrulla'` y `registrado_por_id` en `mision_hito` | Funcional / Auditoría ICS | Repositorio / Transacción | Crítica | Misión en estado `DESPACHADA` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` | Inserción en `mision_hito` con `hito: "MISION_ACEPTADA"`, `descripcion: "Misión Aceptada por Patrulla"` y `registrado_por_id` del usuario en sesión | Registro insertado en `mision_hito` y retornado en `data.hito` | APROBADO | 09/11/2026 12:16 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-05` | Preservación del estado canónico `VERIFICANDO` en el incidente y `EN_VERIFICACION` en la patrulla al aceptar misión (evitando estado ambiguo `'En camino'`) | Regla de Negocio ICS | Servicio / Repositorio | Crítica | Misión `68abde99-780d-41a9-aee6-f68371d226aa` con incidente en `VERIFICANDO` y patrulla en `EN_VERIFICACION` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` | `data.patrulla.estado === "EN_VERIFICACION"` y `data.incidente.estado === "VERIFICANDO"` (nunca `"En camino"`) | Retorna `patrulla.estado: "EN_VERIFICACION"` e `incidente.estado: "VERIFICANDO"` | APROBADO | 09/11/2026 12:16 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-06` | Emisión del evento WebSocket `mision:actualizada` al aceptar la misión exitosamente | Tiempo Real / Socket.io | Servicio | Alta | Servicio `aceptarMisionService` ejecutado exitosamente | `aceptarMisionService(misionId, usuarioPatrullaId, false, coords)` | Invocación a `notificarMisionActualizada` con `misionId`, `codigo`, `estado: "EN_CURSO"`, `fechaInicio` y objeto `hito` | `notificarMisionActualizada` invocado 1 vez con el payload estructurado | APROBADO | 09/11/2026 12:11 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-07` | Rechazo de petición sin credenciales de autenticación (`401 Unauthorized`) | Seguridad / Autenticación | Route Handler | Crítica | Petición sin cabecera `Authorization` ni `x-user-id` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` sin cabeceras | HTTP 401 Unauthorized con mensaje `"Se requiere cabecera de autenticación Authorization: Bearer <token>."` | HTTP 401 Unauthorized con el mensaje esperado | APROBADO | 09/11/2026 12:14 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-08` | Rechazo RBAC para usuario con rol sin permiso `misiones:terreno:verificar` (`403 Forbidden`) | Seguridad / RBAC | Route Handler / Auth | Crítica | Usuario con rol `CALL_CENTER` (`c1111111-1111-4111-8111-111111111111`) | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `x-user-id: c1111111-1111-4111-8111-111111111111` | HTTP 403 Forbidden indicando ausencia del permiso `misiones:terreno:verificar` | HTTP 403 Forbidden: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-09` | Rechazo por intento de aceptar misión asignada a otra patrulla verificadora cuando el líder tiene rol `PATRULLA_VERIFICADORA` (`403 Forbidden`) | Seguridad / Autorización | Repositorio / Servicio | Alta | Misión asignada a patrulla con líder de rol `PATRULLA_VERIFICADORA` e invocada por otro patrullero | `aceptarMisionPatrullaRepo(misionId, otroPatrulleroId, false)` | Lanza `ForbiddenError` (`403`) y no emite evento WebSocket | Lanza `ForbiddenError: "No está autorizado para aceptar una misión asignada a otra patrulla verificadora."` | APROBADO | 09/11/2026 12:11 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-10` | Rechazo por parámetro de ruta `id` con formato UUID inválido (`400 Bad Request`) | Validación / Contrato | Route Handler / Zod | Media | Petición con `id` no UUID en la URL | `POST /api/misiones/id-no-es-uuid/aceptar` | HTTP 400 Bad Request con mensaje `"El identificador de la misión proporcionado no es un UUID válido."` | HTTP 400 Bad Request con detalle de error en `errors[0].campo = "id"` | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-11` | Rechazo por cuerpo de petición con sintaxis JSON malformada (`400 Bad Request`) | Validación / Robustez | Route Handler | Media | Cabecera `Content-Type: application/json` y cuerpo `{malformed` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `-d "{malformed"` | HTTP 400 Bad Request con mensaje `"El cuerpo de la petición no es un JSON válido."` | HTTP 400 Bad Request: `{"message":"El cuerpo de la petición no es un JSON válido."}` | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-12` | Rechazo por coordenadas GPS fuera de rango geográfico WGS84 (`latitud < -90` o `> 90`, `longitud < -180` o `> 180`) (`400 Bad Request`) | Validación / Esquema Zod | Route Handler / Schema | Media | Payload con `{"latitud": -120, "longitud": -73.245}` | `POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar` con `{"latitud":-120,"longitud":-73.245}` | HTTP 400 Bad Request con mensaje `"Datos de entrada inválidos."` y detalle en `latitud` | HTTP 400 Bad Request: `{"message":"Datos de entrada inválidos.","errors":[{"campo":"latitud","mensaje":"La latitud no puede ser menor a -90."}]}` | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-13` | Rechazo cuando el identificador UUID de la misión no existe en la base de datos (`404 Not Found`) | Funcional / Negativa | Repositorio / Route Handler | Alta | UUID `60000000-0000-4000-8000-000000000999` inexistente en `mision` | `POST /api/misiones/60000000-0000-4000-8000-000000000999/aceptar` | HTTP 404 Not Found con mensaje `"No se encontró ninguna misión con el identificador proporcionado."` | HTTP 404 Not Found con el mensaje esperado | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-14` | Control de concurrencia e idempotencia: rechazo cuando la misión ya se encuentra en estado `EN_CURSO` (`409 Conflict`) | Concurrencia / Regla de Negocio | Repositorio / Endpoint | Crítica | Misión `d1000000-0000-4000-8000-000000000001` en estado `EN_CURSO` | `POST /api/misiones/d1000000-0000-4000-8000-000000000001/aceptar` | HTTP 409 Conflict indicando que el estado actual es `'EN_CURSO'` y solo se aceptan misiones `'DESPACHADA'` | HTTP 409 Conflict: `{"message":"La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}` | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-15` | Rechazo de transición cuando la misión se encuentra en estado cerrado `COMPLETADA`, `CANCELADA` o `RECHAZADA` (`409 Conflict`) | Regla de Negocio ICS | Repositorio / Endpoint | Alta | Misión `d1000000-0000-4000-8000-000000000004` en estado `COMPLETADA` | `POST /api/misiones/d1000000-0000-4000-8000-000000000004/aceptar` | HTTP 409 Conflict bloqueando la transición e impidiendo insertar hitos en `mision_hito` | HTTP 409 Conflict: `{"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}` | APROBADO | 09/11/2026 12:15 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-16` | Definición estructural de la tabla `mision_hito` e índices `idx_mision_hito_mision_id` e `idx_mision_hito_creado_en` | Base de Datos / Esquema | Migración / Tipos Kysely | Alta | Esquema Kysely en `src/lib/db/types.ts` y migración de bitácora | Inspección de `mision_hito` en PostgreSQL y `MisionHitoTable` en `types.ts` | Columnas `id`, `mision_id` (FK cascade), `hito`, `descripcion`, `registrado_por_id` (FK set null), `latitud`, `longitud`, `creado_en` e índices creados | Tabla `mision_hito` e interfaz `MisionHitoTable` definidas conforme al modelo relacional | APROBADO | 09/11/2026 12:11 | - | feat(db): agregar tabla mision_hito y permiso misiones:terreno:verificar (#37) |
| `CP-H36-API-17` | Registro del contrato OpenAPI 3.0 para `POST /api/misiones/{id}/aceptar` y esquemas `AceptarMisionInput`, `MisionHitoRegistrado` y `AceptarMisionResponse` | Contrato API / OpenAPI | Especificación OpenAPI | Alta | Generador OpenAPI en `src/lib/openapi/index.ts` | `npm test -- src/app/openapi.json/__tests__/route.test.ts` | Operación `POST /api/misiones/{id}/aceptar` documentada con respuestas `200`, `400`, `401`, `403`, `404`, `409` y `500` | Test de contrato OpenAPI aprobado y esquemas registrados en `openapi.json` | APROBADO | 09/11/2026 12:11 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-18` | Resiliencia del endpoint si la emisión del evento WebSocket `mision:actualizada` lanza una excepción | Robustez / Tolerancia a Fallos | Servicio | Media | `notificarMisionActualizada` rodeado de bloque `try/catch` en `aceptarMisionService` | Fallo simulado en Socket.io tras confirmar la transacción en BD | La transacción en BD se mantiene confirmada y el servicio retorna `200 OK` registrando el error en log | `aceptarMisionService` captura errores de socket sin revertir la aceptación persistida | APROBADO | 09/11/2026 12:11 | - | feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37) |
| `CP-H36-API-19` | Documentación técnica del endpoint `POST /api/misiones/{id}/aceptar` y de la tabla `mision_hito` en `docs/api/misiones.md` y `docs/database/README.md` | Documentación | Documentación Técnica | Media | Archivos `docs/api/misiones.md` y `docs/database/README.md` | Revisión de sección `3.3. POST /api/misiones/{id}/aceptar` y diccionario de datos | Reglas de transición atómica, invariantes ICS, payload y respuestas HTTP documentadas | Documentación incorporada en `docs/api/misiones.md` y `docs/database/README.md` | APROBADO | 09/11/2026 12:11 | - | docs(misiones): documentar endpoint de aceptacion de mision y esquema mision_hito (#37) |
| `CP-H36-API-20` | Ejecución completa de la suite de pruebas unitarias de aceptación de misión en Vitest | Automatización | Unit / Service / Route / Repo | Alta | Entorno de pruebas Vitest en `sgrai-api` | `npm test -- src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts src/modules/misiones/__tests__/mision-aceptar.service.test.ts src/modules/misiones/__tests__/mision-aceptar.repository.test.ts` | 15/15 tests unitarios de HU-36 aprobados (7 route + 4 service + 4 repository) | 15/15 tests aprobados sin errores | APROBADO | 09/11/2026 12:11 | - | test(misiones): agregar pruebas unitarias para aceptacion de mision por patrulla (#37) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H36-API-01	Bypass de autorización de patrulla cuando patrulla_id es null o cuando el líder de la patrulla posee un rol distinto a PATRULLA_VERIFICADORA	Seguridad / Regla de Negocio ICS	Repositorio / BD	Crítica	Misión en estado DESPACHADA asignada a patrulla cuyo líder tiene rol ENCARGADO o misión sin patrulla_id	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar invocado por un patrullero de otra unidad	HTTP 403 Forbidden si el usuario no pertenece a la patrulla asignada y HTTP 409/400 si la misión no tiene patrulla asignada	La condición if (!esLiderDirecto && liderEsPatrulla) se salta la consulta a patrulla_personal cuando el líder tiene rol ENCARGADO, y if (!esAdmin && misionExistente.patrulla_id) permite aceptar misiones con patrulla_id = null	ABIERTO	09/11/2026 12:10	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-API-02	Omisión de consulta a mision_hito en obtenerMisionDetallePorIdRepo impidiendo reflejar el hito Misión Aceptada por Patrulla en bitácora	Funcional / Trazabilidad ICS	Repositorio / Servicio	Crítica	Misión aceptada mediante POST /api/misiones/{id}/aceptar con hito registrado en mision_hito	GET /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa	data.bitacoraTiempos incluye el hito MISION_ACEPTADA ("Misión Aceptada por Patrulla") registrado en mision_hito	obtenerMisionDetallePorIdRepo no consulta mision_hito; bitacoraTiempos solo retorna glosas sintéticas de mision omitiendo el hito aceptado	ABIERTO	09/11/2026 12:12	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-API-03	Desfase de 39 commits con develop y colisión de migraciones Kysely 033_ y 034_ bloqueando npm run db:migrate y permiso misiones:terreno:verificar	Integración / Base de Datos	Migraciones / RBAC	Alta	Base de datos sincronizada con develop (migraciones hasta 034_)	npm run db:migrate y POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con x-user-id: d1000000-0000-4000-8000-000000000001	Migraciones se ejecutan secuencialmente sin colisión y el rol PATRULLA_VERIFICADORA recibe el permiso misiones:terreno:verificar	npm run db:migrate aborta con corrupted migrations por ausencia de 027_/032_ y colisión de 033_/034_; el usuario patrulla recibe 403 Forbidden	ABIERTO	09/11/2026 12:14	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-API-04	Ausencia de bloqueo pesimista forUpdate() y falta de validación de invariantes ICS sobre patrulla activa (EN_VERIFICACION) e incidente (VERIFICANDO)	Regla de Negocio / Concurrencia ICS	Repositorio / BD	Alta	Misión DESPACHADA asociada a patrulla inactiva/NO_DISPONIBLE o incidente RESUELTO	POST /api/misiones/{id}/aceptar	Validación con bloqueo pesimista asegurando patrulla activa en EN_VERIFICACION e incidente en VERIFICANDO (o rechazo 409 Conflict)	No aplica .forUpdate() ni valida eliminado_en IS NULL, patrulla.estado === 'EN_VERIFICACION' o incidente.estado === 'VERIFICANDO'	ABIERTO	09/11/2026 12:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-API-05	Asimetría de difusión WebSocket mision:actualizada entre memoria y Redis Pub/Sub y aceptación de coordenada GPS huérfana sin paridad	Tiempo Real / Validación Zod	Socket / Schema	Media	REDIS_URL activo o petición con solo {"latitud": -39.819588} sin longitud	POST /api/misiones/{id}/aceptar con body {"latitud": -39.819588}	Emisión en Redis a encargado, sala:encargados y supervisor sin duplicación en memoria, y 400 Bad Request ante coordenada incompleta	En Redis solo publica a room: "encargado" (y en memoria duplica con ioInstance.emit), y acepta latitud sin longitud guardando longitud: null	ABIERTO	09/11/2026 12:15	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H36-API-01	Aceptación exitosa de misión en estado DESPACHADA sin cuerpo en la petición (200 OK)	Funcional / Positiva	Integración / Route Handler	Crítica	Misión 60000000-0000-4000-8000-000000000001 en estado DESPACHADA y usuario autorizado	POST /api/misiones/60000000-0000-4000-8000-000000000001/aceptar sin body	HTTP 200 OK con mision.estado: "EN_CURSO", fechaInicio ISO 8601 y hito.hito: "MISION_ACEPTADA"	HTTP 200 OK con transición a EN_CURSO e hito registrado	APROBADO	09/11/2026 12:11	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-02	Aceptación exitosa de misión en estado DESPACHADA enviando coordenadas GPS válidas desde la PWA (200 OK)	Funcional / Positiva	Integración / Endpoint	Crítica	Misión 68abde99-780d-41a9-aee6-f68371d226aa en estado DESPACHADA	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con body {"latitud":-39.819588,"longitud":-73.245209}	HTTP 200 OK persistiendo latitud: -39.819588 y longitud: -73.245209 en data.hito	HTTP 200 OK con coordenadas GPS almacenadas en mision_hito y devueltas en data.hito	APROBADO	09/11/2026 12:16	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-03	Fijación automática de mision.fecha_inicio = CURRENT_TIMESTAMP y mision.actualizado_en = CURRENT_TIMESTAMP al aceptar	Integridad / Base de Datos	Repositorio / Transacción	Crítica	Misión en estado DESPACHADA con fecha_inicio = null	aceptarMisionPatrullaRepo(misionId, liderId, false)	Columnas fecha_inicio y actualizado_en actualizadas con timestamp del servidor en formato ISO 8601	fecha_inicio y actualizado_en actualizados atómicamente con CURRENT_TIMESTAMP	APROBADO	09/11/2026 12:11	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-04	Registro automático del hito 'MISION_ACEPTADA' con glosa 'Misión Aceptada por Patrulla' y registrado_por_id en mision_hito	Funcional / Auditoría ICS	Repositorio / Transacción	Crítica	Misión en estado DESPACHADA	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar	Inserción en mision_hito con hito: "MISION_ACEPTADA", descripcion: "Misión Aceptada por Patrulla" y registrado_por_id del usuario en sesión	Registro insertado en mision_hito y retornado en data.hito	APROBADO	09/11/2026 12:16	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-05	Preservación del estado canónico VERIFICANDO en el incidente y EN_VERIFICACION en la patrulla al aceptar misión (evitando estado ambiguo 'En camino')	Regla de Negocio ICS	Servicio / Repositorio	Crítica	Misión 68abde99-780d-41a9-aee6-f68371d226aa con incidente en VERIFICANDO y patrulla en EN_VERIFICACION	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar	data.patrulla.estado === "EN_VERIFICACION" y data.incidente.estado === "VERIFICANDO" (nunca "En camino")	Retorna patrulla.estado: "EN_VERIFICACION" e incidente.estado: "VERIFICANDO"	APROBADO	09/11/2026 12:16	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-06	Emisión del evento WebSocket mision:actualizada al aceptar la misión exitosamente	Tiempo Real / Socket.io	Servicio	Alta	Servicio aceptarMisionService ejecutado exitosamente	aceptarMisionService(misionId, usuarioPatrullaId, false, coords)	Invocación a notificarMisionActualizada con misionId, codigo, estado: "EN_CURSO", fechaInicio y objeto hito	notificarMisionActualizada invocado 1 vez con el payload estructurado	APROBADO	09/11/2026 12:11	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-07	Rechazo de petición sin credenciales de autenticación (401 Unauthorized)	Seguridad / Autenticación	Route Handler	Crítica	Petición sin cabecera Authorization ni x-user-id	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar sin cabeceras	HTTP 401 Unauthorized con mensaje "Se requiere cabecera de autenticación Authorization: Bearer <token>."	HTTP 401 Unauthorized con el mensaje esperado	APROBADO	09/11/2026 12:14	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-08	Rechazo RBAC para usuario con rol sin permiso misiones:terreno:verificar (403 Forbidden)	Seguridad / RBAC	Route Handler / Auth	Crítica	Usuario con rol CALL_CENTER (c1111111-1111-4111-8111-111111111111)	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con x-user-id: c1111111-1111-4111-8111-111111111111	HTTP 403 Forbidden indicando ausencia del permiso misiones:terreno:verificar	HTTP 403 Forbidden: {"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-09	Rechazo por intento de aceptar misión asignada a otra patrulla verificadora cuando el líder tiene rol PATRULLA_VERIFICADORA (403 Forbidden)	Seguridad / Autorización	Repositorio / Servicio	Alta	Misión asignada a patrulla con líder de rol PATRULLA_VERIFICADORA e invocada por otro patrullero	aceptarMisionPatrullaRepo(misionId, otroPatrulleroId, false)	Lanza ForbiddenError (403) y no emite evento WebSocket	Lanza ForbiddenError: "No está autorizado para aceptar una misión asignada a otra patrulla verificadora."	APROBADO	09/11/2026 12:11	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-10	Rechazo por parámetro de ruta id con formato UUID inválido (400 Bad Request)	Validación / Contrato	Route Handler / Zod	Media	Petición con id no UUID en la URL	POST /api/misiones/id-no-es-uuid/aceptar	HTTP 400 Bad Request con mensaje "El identificador de la misión proporcionado no es un UUID válido."	HTTP 400 Bad Request con detalle de error en errors[0].campo = "id"	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-11	Rechazo por cuerpo de petición con sintaxis JSON malformada (400 Bad Request)	Validación / Robustez	Route Handler	Media	Cabecera Content-Type: application/json y cuerpo {malformed	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con -d "{malformed"	HTTP 400 Bad Request con mensaje "El cuerpo de la petición no es un JSON válido."	HTTP 400 Bad Request: {"message":"El cuerpo de la petición no es un JSON válido."}	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-12	Rechazo por coordenadas GPS fuera de rango geográfico WGS84 (latitud < -90 o > 90, longitud < -180 o > 180) (400 Bad Request)	Validación / Esquema Zod	Route Handler / Schema	Media	Payload con {"latitud": -120, "longitud": -73.245}	POST /api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar con {"latitud":-120,"longitud":-73.245}	HTTP 400 Bad Request con mensaje "Datos de entrada inválidos." y detalle en latitud	HTTP 400 Bad Request: {"message":"Datos de entrada inválidos.","errors":[{"campo":"latitud","mensaje":"La latitud no puede ser menor a -90."}]}	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-13	Rechazo cuando el identificador UUID de la misión no existe en la base de datos (404 Not Found)	Funcional / Negativa	Repositorio / Route Handler	Alta	UUID 60000000-0000-4000-8000-000000000999 inexistente en mision	POST /api/misiones/60000000-0000-4000-8000-000000000999/aceptar	HTTP 404 Not Found con mensaje "No se encontró ninguna misión con el identificador proporcionado."	HTTP 404 Not Found con el mensaje esperado	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-14	Control de concurrencia e idempotencia: rechazo cuando la misión ya se encuentra en estado EN_CURSO (409 Conflict)	Concurrencia / Regla de Negocio	Repositorio / Endpoint	Crítica	Misión d1000000-0000-4000-8000-000000000001 en estado EN_CURSO	POST /api/misiones/d1000000-0000-4000-8000-000000000001/aceptar	HTTP 409 Conflict indicando que el estado actual es 'EN_CURSO' y solo se aceptan misiones 'DESPACHADA'	HTTP 409 Conflict: {"message":"La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-15	Rechazo de transición cuando la misión se encuentra en estado cerrado COMPLETADA, CANCELADA o RECHAZADA (409 Conflict)	Regla de Negocio ICS	Repositorio / Endpoint	Alta	Misión d1000000-0000-4000-8000-000000000004 en estado COMPLETADA	POST /api/misiones/d1000000-0000-4000-8000-000000000004/aceptar	HTTP 409 Conflict bloqueando la transición e impidiendo insertar hitos en mision_hito	HTTP 409 Conflict: {"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}	APROBADO	09/11/2026 12:15	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-16	Definición estructural de la tabla mision_hito e índices idx_mision_hito_mision_id e idx_mision_hito_creado_en	Base de Datos / Esquema	Migración / Tipos Kysely	Alta	Esquema Kysely en src/lib/db/types.ts y migración de bitácora	Inspección de mision_hito en PostgreSQL y MisionHitoTable en types.ts	Columnas id, mision_id (FK cascade), hito, descripcion, registrado_por_id (FK set null), latitud, longitud, creado_en e índices creados	Tabla mision_hito e interfaz MisionHitoTable definidas conforme al modelo relacional	APROBADO	09/11/2026 12:11	-	feat(db): agregar tabla mision_hito y permiso misiones:terreno:verificar (#37)
CP-H36-API-17	Registro del contrato OpenAPI 3.0 para POST /api/misiones/{id}/aceptar y esquemas AceptarMisionInput, MisionHitoRegistrado y AceptarMisionResponse	Contrato API / OpenAPI	Especificación OpenAPI	Alta	Generador OpenAPI en src/lib/openapi/index.ts	npm test -- src/app/openapi.json/__tests__/route.test.ts	Operación POST /api/misiones/{id}/aceptar documentada con respuestas 200, 400, 401, 403, 404, 409 y 500	Test de contrato OpenAPI aprobado y esquemas registrados en openapi.json	APROBADO	09/11/2026 12:11	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-18	Resiliencia del endpoint si la emisión del evento WebSocket mision:actualizada lanza una excepción	Robustez / Tolerancia a Fallos	Servicio	Media	notificarMisionActualizada rodeado de bloque try/catch en aceptarMisionService	Fallo simulado en Socket.io tras confirmar la transacción en BD	La transacción en BD se mantiene confirmada y el servicio retorna 200 OK registrando el error en log	aceptarMisionService captura errores de socket sin revertir la aceptación persistida	APROBADO	09/11/2026 12:11	-	feat(misiones): implementar endpoint POST /api/misiones/[id]/aceptar y evento mision:actualizada (#37)
CP-H36-API-19	Documentación técnica del endpoint POST /api/misiones/{id}/aceptar y de la tabla mision_hito en docs/api/misiones.md y docs/database/README.md	Documentación	Documentación Técnica	Media	Archivos docs/api/misiones.md y docs/database/README.md	Revisión de sección 3.3. POST /api/misiones/{id}/aceptar y diccionario de datos	Reglas de transición atómica, invariantes ICS, payload y respuestas HTTP documentadas	Documentación incorporada en docs/api/misiones.md y docs/database/README.md	APROBADO	09/11/2026 12:11	-	docs(misiones): documentar endpoint de aceptacion de mision y esquema mision_hito (#37)
CP-H36-API-20	Ejecución completa de la suite de pruebas unitarias de aceptación de misión en Vitest	Automatización	Unit / Service / Route / Repo	Alta	Entorno de pruebas Vitest en sgrai-api	npm test -- src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts src/modules/misiones/__tests__/mision-aceptar.service.test.ts src/modules/misiones/__tests__/mision-aceptar.repository.test.ts	15/15 tests unitarios de HU-36 aprobados (7 route + 4 service + 4 repository)	15/15 tests aprobados sin errores	APROBADO	09/11/2026 12:11	-	test(misiones): agregar pruebas unitarias para aceptacion de mision por patrulla (#37)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Completa del Módulo de Misiones y Contrato OpenAPI
```bash
npm test -- src/app/api/misiones src/modules/misiones src/app/openapi.json
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/misiones/__tests__/mision-aceptar.service.test.ts (4 tests) 16ms
 ✓ src/modules/misiones/__tests__/mision.service.test.ts (3 tests) 15ms
 ✓ src/modules/misiones/__tests__/mision.schema.test.ts (6 tests) 42ms
 ✓ src/modules/misiones/__tests__/mision-listado.test.ts (7 tests) 27ms
 ✓ src/app/api/misiones/__tests__/route.test.ts (3 tests) 35ms
 ✓ src/modules/misiones/__tests__/mision-aceptar.repository.test.ts (4 tests) 25ms
 ✓ src/app/api/misiones/[id]/aceptar/__tests__/route.test.ts (7 tests) 50ms
 ✓ src/app/api/misiones/[id]/__tests__/route.test.ts (6 tests) 37ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 246ms

 Test Files  9 passed (9)
      Tests  41 passed (41)
   Start at  12:11:21
   Duration  2.03s (transform 2.37s, setup 0ms, collect 5.54s, tests 493ms, environment 13ms, prepare 1.58s)
```

#### 5.1.2 Ejecución Focalizada por Casos de HU-36 (`-t`)
```bash
npm test -- -t "Route Handler POST /api/misiones/\[id\]/aceptar \(HU-36\)"
npm test -- -t "Mision Service - aceptarMisionService \(HU-36\)"
npm test -- -t "Mision Repository - aceptarMisionPatrullaRepo \(HU-36\)"
```

#### 5.1.3 Evidencia de Fallo en Migraciones Kysely (`BUG-H36-API-03`)
```bash
npm run db:migrate
```

**Salida de Consola:**
```text
Ejecutando migraciones Kysely de base de datos...
Error al ejecutar migraciones Kysely: Error: corrupted migrations: previously executed migration 027_cuadrilla_auditoria_y_unicidad is missing
    at Migrator.#ensureNoMissingMigrations (/home/ds2fery/Documentos/Proyecto/sgrai-uach/api/node_modules/kysely/dist/migration/migrator.js:500:23)
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`POST /api/misiones/[id]/aceptar`)

#### Caso 1: Rechazo por Falta de Autenticación (`401 Unauthorized` — `CP-H36-API-07`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 2: Rechazo RBAC para Usuario sin Permiso `misiones:terreno:verificar` (`403 Forbidden` — `CP-H36-API-08`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: c1111111-1111-4111-8111-111111111111"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 3: Rechazo para Patrullero por Migración `034_` Bloqueada (`403 Forbidden` — `BUG-H36-API-03`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 4: Rechazo por Parámetro UUID Inválido (`400 Bad Request` — `CP-H36-API-10`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/id-no-es-uuid/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "El identificador de la misión proporcionado no es un UUID válido.",
  "errors": [
    {
      "campo": "id",
      "mensaje": "El identificador de la misión debe ser un UUID válido."
    }
  ]
}
```

#### Caso 5: Rechazo por Cuerpo JSON Malformado (`400 Bad Request` — `CP-H36-API-11`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d "{malformed"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"message":"El cuerpo de la petición no es un JSON válido."}
```

#### Caso 6: Rechazo por Coordenadas GPS Fuera de Rango WGS84 (`400 Bad Request` — `CP-H36-API-12`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-120,"longitud":-73.245}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Datos de entrada inválidos.",
  "errors": [
    {
      "campo": "latitud",
      "mensaje": "La latitud no puede ser menor a -90."
    }
  ]
}
```

#### Caso 7: Rechazo por Misión Inexistente (`404 Not Found` — `CP-H36-API-13`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/60000000-0000-4000-8000-000000000999/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{"message":"No se encontró ninguna misión con el identificador proporcionado."}
```

#### Caso 8: Control de Concurrencia — Rechazo por Misión Ya en Estado `EN_CURSO` (`409 Conflict` — `CP-H36-API-14`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000001/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{"message":"La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}
```

#### Caso 9: Rechazo por Misión en Estado `COMPLETADA` (`409 Conflict` — `CP-H36-API-15`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000004/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}
```

#### Caso 10: Aceptación Exitosa de Misión `DESPACHADA` con Coordenadas GPS (`200 OK` — `CP-H36-API-02`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588,"longitud":-73.245209}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
  "data": {
    "mision": {
      "id": "68abde99-780d-41a9-aee6-f68371d226aa",
      "codigo": "MIS-2026-0007",
      "titulo": "Verificación: Caída de árbol - INC-2026-8510",
      "descripcion": null,
      "tipoMision": "VERIFICACION",
      "estado": "EN_CURSO",
      "prioridad": "MEDIA",
      "incidenteId": "0958e9c9-0374-4f26-91b0-fba8f361010f",
      "patrullaId": "f1000000-0000-4000-8000-000000000002",
      "fechaInicio": "2026-11-09T15:16:23.569Z",
      "actualizadoEn": "2026-11-09T15:16:23.569Z"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000002",
      "nombre": "Patrulla Rápida Centro-Sur",
      "estado": "EN_VERIFICACION"
    },
    "incidente": {
      "id": "0958e9c9-0374-4f26-91b0-fba8f361010f",
      "codigo": "INC-2026-8510",
      "estado": "VERIFICANDO"
    },
    "hito": {
      "id": "15dbc97d-eb99-43ea-b37c-4bb3276cff1e",
      "misionId": "68abde99-780d-41a9-aee6-f68371d226aa",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Misión Aceptada por Patrulla",
      "registradoPorId": "00000000-0000-4000-8000-000000000001",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-09T15:16:23.569Z"
    }
  }
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La vista de detalle de la misión asignada en la PWA debe presentar un botón prominente 'Aceptar Misión'. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | Responsabilidad de interfaz de usuario en el repositorio `sgrai-pwa`. |
| **CA-2:** Al presionar 'Aceptar Misión', la PWA debe invocar el endpoint `POST /api/misiones/{id}/aceptar`. | `CP-H36-API-01`, `CP-H36-API-02`, `CP-H36-API-10` a `15`, `CP-H36-API-17`, `BUG-H36-API-05` | 🟡 **PARCIAL (`BUG-H36-API-05`)** | El endpoint `POST /api/misiones/{id}/aceptar` está expuesto y documentado en OpenAPI, pero `AceptarMisionInputSchema` permite enviar una coordenada GPS huérfana (`latitud` sin `longitud` o viceversa). |
| **CA-3:** La API debe ejecutar una transición atómica: (1) Actualizar `mision.estado` de `DESPACHADA` a `EN_CURSO`, (2) Fijar `mision.fecha_inicio = CURRENT_TIMESTAMP`, y (3) Registrar el hito 'Misión Aceptada por Patrulla' en la tabla `mision_hito`. | `CP-H36-API-03`, `CP-H36-API-04`, `CP-H36-API-14`, `CP-H36-API-16`, `BUG-H36-API-01`, `BUG-H36-API-02` | 🔴 **CON DEFECTO (`BUG-H36-API-01`, `BUG-H36-API-02`)** | La transacción actualiza `mision` e inserta en `mision_hito`, pero omite validar pertenencia a la patrulla cuando el líder no tiene rol `PATRULLA_VERIFICADORA` o cuando `patrulla_id` es `null` (`BUG-H36-API-01`), y `GET /api/misiones/{id}` no consulta `mision_hito` para reflejar el hito en la bitácora del Centro de Mando (`BUG-H36-API-02`). |
| **CA-4:** El estado de la patrulla verificadora debe mantenerse en `EN_VERIFICACION` y el incidente permanece en `VERIFICANDO` (corrigiendo la ambigüedad de 'En camino', que no es un estado canónico de incidente). | `CP-H36-API-05`, `BUG-H36-API-04` | 🔴 **CON DEFECTO (`BUG-H36-API-04`)** | No muta el incidente al estado no canónico `'En camino'`, pero no bloquea ni valida que la patrulla asignada esté activa (`eliminado_en IS NULL`) y en `EN_VERIFICACION` ni que el incidente esté en `VERIFICANDO` dentro de la transacción (`BUG-H36-API-04`). |
| **CA-5:** El sistema debe emitir en tiempo real el evento WebSocket `mision:actualizada` hacia la sala `encargado` del Centro de Mando. | `CP-H36-API-06`, `CP-H36-API-18`, `BUG-H36-API-05` | 🟡 **PARCIAL (`BUG-H36-API-05`)** | Emite `mision:actualizada` a `"encargado"`, pero en memoria realiza además un broadcast global duplicado y en Redis Pub/Sub omite `"sala:encargados"` y `"supervisor"`. |
| **CA-6:** La PWA debe cambiar el estado de la vista a 'En Trayecto / Evaluación' habilitando los formularios de reporte técnico. | *(Alcance Frontend `sgrai-pwa`)* | ⚪ **N/A EN API** | El backend provee `data.mision.estado = "EN_CURSO"` y `data.mision.fechaInicio` para habilitar la transición de estado en `sgrai-pwa`. |
| **CA-7:** El endpoint debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H36-API-07`, `CP-H36-API-08`, `CP-H36-API-09`, `BUG-H36-API-01`, `BUG-H36-API-03` | 🔴 **CON DEFECTO (`BUG-H36-API-01`, `BUG-H36-API-03`)** | El route handler exige `misiones:terreno:verificar`, pero la migración `034_permiso_misiones_terreno_verificar.ts` colisiona con `develop` e impide que `npm run db:migrate` asigne el permiso al rol `PATRULLA_VERIFICADORA` (`BUG-H36-API-03`). |

