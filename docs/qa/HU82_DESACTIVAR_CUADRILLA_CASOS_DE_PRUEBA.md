# Informe de Auditoría Forense y Matriz de Casos de Prueba (QA): HU-82 — Desactivar Cuadrilla Operativa (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Cuadrillas Operativas (`sgrai-api` — `DELETE /api/cuadrillas/[id]`).  
> **Historia de Usuario:** HU-82 — *"Como Administrador Quiero desactivar mediante baja lógica una cuadrilla operativa que haya sido disuelta o retirada de servicio Para evitar que sea asignada a nuevos incidentes, preservando el historial completo de misiones e informes técnicos en los que participó."*  
> **Desarrollador Asignado:** Cristobal  
> **QA Lead / Auditor Técnico:** Antigravity QA Lead — Equipo de Aseguramiento de Calidad SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + Zod + Socket.io + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H82-desactivar-cuadrilla`  
> **Commits Evaluados en la Rama (Conventional Commits sin hash):**  
> * `feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar`  
> * `feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica`  
> * `feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0`  
> * `test(cuadrillas): pruebas unitarias de servicio y ruta para baja logica de cuadrilla`  
> * `docs(api): documentar endpoint DELETE /api/cuadrillas/[id] en recursos-y-personal.md`  
> * `merge: sincronizar con develop resolviendo conflicto en permisos.constants y adaptando schema de usuario`  
>  
> **Fecha de Auditoría QA:** 02/11/2026 14:20.  
> **Estado de Certificación QA:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Reales Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Forense de QA

Tras ejecutar la inspección forense de código fuente, revisión de transacciones ACID en Kysely/PostgreSQL, encadenamiento de migraciones contra `origin/develop`, auditoría de reglas de negocio ICS, contratos OpenAPI y suites automatizadas en Vitest sobre la rama `feature/H82-desactivar-cuadrilla` de `sgrai-api`, se dictamina el **RECHAZO TEMPORAL (`Changes Requested`)** del Pull Request.

En cumplimiento irrestricto de la **Regla de Oro de QA**, ningún archivo en `src/` fue modificado por QA. Todos los defectos han sido formalizados en este documento para su corrección por parte del desarrollador asignado.

| Métrica de Calidad | Resultado de Auditoría | Observaciones |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H82-API-01` a `05`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io |
| **Casos Aprobados (Passed)** | **20** | Validación Zod, RBAC `cuadrillas:eliminar`, bloqueo `409 Conflict` con misiones activas, reversión de delegado y evento Socket.io |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de infraestructura |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Requiere 100% (0 defectos abiertos) para certificación de merge a `develop` |
| **Suite Automatizada de Cuadrillas (Vitest)** | **52/52 tests pass (con mocks)** | `route.test.ts` (28 tests) y `cuadrilla.service.test.ts` (24 tests) pasan con repositorio mockeado |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores (2 warnings en test)** | `NotFoundError` y `BadRequestError` sin usar en `src/app/api/cuadrillas/__tests__/route.test.ts` |
| **Sincronización con `origin/develop`** | 🔴 **Desfasada (Colisión `031_` y regresión HU-81)** | Falta integrar PR #34 (`efd57bb`) y PR #30 (`6e6c278`) de `origin/develop` |
| **Cumplimiento de Regla de Oro de QA** | **100%** | Código fuente en `src/` intacto sin ediciones de QA |

---

## 2. Inspección Forense de Código y Detección de Defectos Reales (Bugs)

### `BUG-H82-API-01`: Fuga y Bloqueo Permanente de Inventario Logístico — `desactivarCuadrillaTransaccional` NO Decrementa `recurso.cantidad_en_uso` en la Tabla `recurso` (Violación Directa del CA-5)
* **Severidad:** **CRÍTICA** (Corrupción de Inventario en Bodega / Incumplimiento del Criterio de Aceptación 5).
* **Estado:** `FALLIDO` (`ABIERTO`).
* **Archivo Afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 910-928).
* **Descripción Técnica del Defecto:**  
  El quinto Criterio de Aceptación de la HU-82 exige taxativamente:
  > *"Los recursos asociados en `cuadrilla_recurso` deben quedar desvinculados y **disponibles en el inventario central**."*
  
  Sin embargo, en `desactivarCuadrillaTransaccional` (`cuadrilla.repository.ts` líneas 910-928), el paso 3 de la transacción ejecuta únicamente:
  ```typescript
  // 3. Desvincular recursos activos en cuadrilla_recurso preservando histórico
  const recursosActivos = await trx
    .selectFrom("cuadrilla_recurso")
    .select(["id"])
    .where("cuadrilla_id", "=", cuadrillaId)
    .where("desvinculado_en", "is", null)
    .execute();

  if (recursosActivos.length > 0) {
    await trx
      .updateTable("cuadrilla_recurso")
      .set({
        activo: false,
        desvinculado_en: fechaEliminado,
      })
      .where("cuadrilla_id", "=", cuadrillaId)
      .where("desvinculado_en", "is", null)
      .execute();
  }
  ```
  El código solo selecciona `["id"]` y marca `cuadrilla_recurso.activo = false` y `desvinculado_en = fechaEliminado`, pero **jamás resta `cantidad_asignada` de la columna `recurso.cantidad_en_uso` en la tabla maestra `recurso`**.  
  Dado que todo el ecosistema SGRAI (`cuadrilla.service.ts` en `develop`, `evento-prevencion.service.ts`, `recuperacion.service.ts`, `recurso.service.ts`) calcula el stock disponible en bodega como `disponible = cantidad_inventario - cantidad_en_uso`, cuando se da de baja una cuadrilla que tenía asignadas unidades logísticas, **`recurso.cantidad_en_uso` permanece inflado indefinidamente con las unidades de la cuadrilla disuelta, dejando los recursos bloqueados e indisponibles en el inventario central**.
* **Pasos para Reproducir:**
  1. Asignar 2 motobombas (`cantidad_asignada = 2`) a una cuadrilla activa (lo que incrementa `recurso.cantidad_en_uso` en `+2`).
  2. Ejecutar `DELETE /api/cuadrillas/{id}` para desactivar la cuadrilla.
  3. Consultar `SELECT id, nombre, cantidad_inventario, cantidad_en_uso FROM recurso WHERE id = ...`.
* **Comportamiento Actual:** `cuadrilla_recurso.desvinculado_en` se llena, pero `recurso.cantidad_en_uso` no disminuye en 2 unidades; las motobombas siguen figurando como en uso y no están disponibles en el inventario central.
* **Comportamiento Esperado:** Dentro de la misma transacción Kysely (`trx`), antes de marcar `desvinculado_en`, se deben obtener `recurso_id` y `cantidad_asignada` de cada fila activa en `cuadrilla_recurso` y decrementar `recurso.cantidad_en_uso` atómicamente.
* **Sugerencia Técnica de Solución:**  
  En `cuadrilla.repository.ts` (L. 911-928):
  ```typescript
  const recursosActivos = await trx
    .selectFrom("cuadrilla_recurso")
    .select(["id", "recurso_id", "cantidad_asignada"])
    .where("cuadrilla_id", "=", cuadrillaId)
    .where("desvinculado_en", "is", null)
    .execute();

  if (recursosActivos.length > 0) {
    for (const rec of recursosActivos) {
      const cantLiberada = Number(rec.cantidad_asignada ?? 0);
      if (cantLiberada > 0) {
        await trx
          .updateTable("recurso")
          .set({
            cantidad_en_uso: sql`GREATEST(0, COALESCE(cantidad_en_uso, 0) - ${cantLiberada})`,
          })
          .where("id", "=", rec.recurso_id)
          .execute();
      }
    }

    await trx
      .updateTable("cuadrilla_recurso")
      .set({
        activo: false,
        desvinculado_en: fechaEliminado,
      })
      .where("cuadrilla_id", "=", cuadrillaId)
      .where("desvinculado_en", "is", null)
      .execute();
  }
  ```

---

### `BUG-H82-API-02`: Colisión de Prefijo de Migraciones Kysely (`031_` Duplicado + Archivo Obsoleto `029_`) y Regresión de los Fixes de HU-81 por Desfase con `origin/develop`
* **Severidad:** **CRÍTICA** (Ruptura de Secuencia de Migraciones DB / Regresión de Integridad ICS e Inventario al Mergear a `develop`).
* **Estado:** `FALLIDO` (`ABIERTO`).
* **Archivos Afectados:**
  * `src/lib/db/migrations/029_cuadrilla_personal_y_auditoria.ts`
  * `src/lib/db/migrations/031_cuadrilla_baja_logica_activo.ts`
  * `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 647-767)
  * `src/modules/recursos-y-personal/cuadrilla.service.ts` (Líneas 370-452)
* **Descripción Técnica del Defecto:**  
  La rama `feature/H82-desactivar-cuadrilla` se encuentra **19 commits por detrás de `origin/develop`** (no incluye el merge de PR #30 `6e6c278` ni el merge de PR #34 `efd57bb` de `feature/H81-editar-cuadrilla`). Esto produce dos problemas críticos:
  1. **Colisión de Migraciones Kysely (`031_` duplicado):** En `origin/develop`, la migración de HU-81 ya fue renumerada y mergeada como `031_cuadrilla_personal_y_auditoria.ts`. En `feature/H82-desactivar-cuadrilla`, aún persiste el archivo viejo `029_cuadrilla_personal_y_auditoria.ts` y la migración de HU-82 fue bautizada `031_cuadrilla_baja_logica_activo.ts`. Al integrar con `develop`, habrá dos migraciones `031_*` y una migración duplicada (`029_` y `031_` creando la misma tabla `cuadrilla_personal`).
  2. **Regresión de los Fixes de HU-81 y Borrado Físico de Historial al Editar:** En esta rama, `cuadrilla.service.ts` y `cuadrilla.repository.ts` tienen la versión antigua de `editarCuadrilla` (sin validación de stock neto `cantidad_inventario - cantidad_en_uso`, sin validación ICS de asignación dual/multicuadrilla y sin ajuste de `cantidad_en_uso`). Además, `actualizarCuadrillaConDotacionTransaccional` (líneas 733 y 751) ejecuta `.deleteFrom("cuadrilla_personal").where("cuadrilla_id", "=", datos.id)` y `.deleteFrom("cuadrilla_recurso").where("cuadrilla_id", "=", datos.id)` **borrando físicamente también los registros históricos desvinculados (`desvinculado_en IS NOT NULL`)** que la migración de HU-82 busca preservar.
* **Pasos para Reproducir:**
  1. Ejecutar `git log HEAD..origin/develop --oneline` y `git ls-tree origin/develop src/lib/db/migrations/`.
  2. Observar la colisión entre `031_cuadrilla_personal_y_auditoria.ts` (en `develop`) y `031_cuadrilla_baja_logica_activo.ts` (en `feature/H82-desactivar-cuadrilla`), así como la presencia de `029_cuadrilla_personal_y_auditoria.ts`.
* **Comportamiento Actual:** Desfase de 19 commits respecto a `origin/develop`, colisión de índice `031_` y reversión de las validaciones de stock neto e ICS de HU-81.
* **Comportamiento Esperado:** Sincronizar la rama con `origin/develop` (`git merge origin/develop`), eliminar el duplicado `029_cuadrilla_personal_y_auditoria.ts`, renumerar la migración de HU-82 a `032_cuadrilla_baja_logica_activo.ts` y preservar intactas las validaciones de HU-81 en `cuadrilla.service.ts` y `cuadrilla.repository.ts` (filtrando `.where("desvinculado_en", "is", null)` en ` verificarDelegadoAsignadoAOtraCuadrilla`, `obtenerTrabajadoresAsignadosAOtrasCuadrillas` y al reconciliar dotación).
* **Sugerencia Técnica de Solución:**  
  1. Ejecutar `git merge origin/develop`, conservar `031_cuadrilla_personal_y_auditoria.ts` de `develop`, eliminar `029_cuadrilla_personal_y_auditoria.ts` y renombrar `031_cuadrilla_baja_logica_activo.ts` a `032_cuadrilla_baja_logica_activo.ts`.
  2. En `actualizarCuadrillaConDotacionTransaccional`, filtrar siempre `.where("desvinculado_en", "is", null)` para no destruir el historial de asignaciones previas.

---

### `BUG-H82-API-03`: Imposibilidad de Consultar o Auditar Cuadrillas Dadas de Baja en `GET /api/cuadrillas` y `GET /api/cuadrillas/[id]` (Filtro Rígido `eliminado_en IS NULL` y Omisión de `activo` / `eliminadoEn`)
* **Severidad:** **ALTA** (Incumplimiento de Trazabilidad Histórica / Incompatibilidad con Filtro de Inactivas en Frontend).
* **Estado:** `FALLIDO` (`ABIERTO`).
* **Archivos Afectados:**
  * `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 112-136, 211-275 y 360-384)
  * `src/modules/recursos-y-personal/cuadrilla.schema.ts` (Líneas 221-230)
  * `src/modules/recursos-y-personal/cuadrilla.service.ts` (Líneas 212-270)
* **Descripción Técnica del Defecto:**  
  Al desactivar una cuadrilla (`DELETE /api/cuadrillas/[id]`), `desactivarCuadrillaTransaccional` aplica:
  ```typescript
  activo: false,
  estado: "NO_DISPONIBLE",
  eliminado_en: fechaEliminado,
  ```
  Sin embargo, en `listarCuadrillasPaginadas` (`cuadrilla.repository.ts` línea 216):
  ```typescript
  let consultaBase = db
    .selectFrom("cuadrilla")
    .innerJoin("delegacion", "delegacion.id", "cuadrilla.delegacion_id")
    .innerJoin("usuario", "usuario.id", "cuadrilla.usuario_delegado_id")
    .where("cuadrilla.eliminado_en", "is", null);
  ```
  Esto ocasiona tres fallos funcionales al consultar el historial de cuadrillas:
  1. **El filtro `GET /api/cuadrillas?estado=NO_DISPONIBLE` siempre devuelve `0` resultados:** Como toda cuadrilla desactivada pasa a `estado = 'NO_DISPONIBLE'` junto con `eliminado_en = fechaEliminado`, la cláusula fija `.where("cuadrilla.eliminado_en", "is", null)` excluye el 100% de las cuadrillas dadas de baja.
  2. **Rechazo `400 Bad Request` ante filtros del frontend (`estado=INACTIVAS` o `estado=TODAS`):** `ListarCuadrillasQuerySchema` (`cuadrilla.schema.ts` L. 221-230) solo acepta `DISPONIBLE | EN_MISION | NO_DISPONIBLE` y no soporta `incluirInactivas` ni los valores `INACTIVAS` / `TODAS` que envía `CuadrillasFiltros.tsx` en `sgrai-web`.
  3. **Omisión de campos `activo`, `eliminadoEn` y `eliminadoPorId` en el listado y bloqueo `404` en detalle:** `listarCuadrillasPaginadas` no incluye `cuadrilla.activo`, `cuadrilla.eliminado_en` ni `cuadrilla.eliminado_por_id` en el `.select([...])` (líneas 255-270), y `obtenerCuadrillaDetalleUnitario` (línea 136) filtra `.where("cuadrilla.eliminado_en", "is", null)`, impidiendo al Administrador abrir el drawer de detalle de una cuadrilla histórica dada de baja.
* **Pasos para Reproducir:**
  1. Desactivar una cuadrilla mediante `DELETE /api/cuadrillas/{id}` (responde `200 OK` con `estado: "NO_DISPONIBLE"`, `activo: false`, `eliminadoEn: "..."`).
  2. Consultar `GET /api/cuadrillas?estado=NO_DISPONIBLE` o `GET /api/cuadrillas/{id}`.
* **Comportamiento Actual:** `GET /api/cuadrillas?estado=NO_DISPONIBLE` retorna `data: []` (`total: 0`), `GET /api/cuadrillas?estado=INACTIVAS` retorna `400 Bad Request`, y `GET /api/cuadrillas/{id}` retorna `404 Not Found`.
* **Comportamiento Esperado:**
  1. Cuando se consulte `estado=NO_DISPONIBLE`, `estado=INACTIVAS`, `estado=TODAS` o `incluirInactivas=true`, `listarCuadrillasPaginadas` debe permitir listar las cuadrillas con `activo = false` / `eliminado_en IS NOT NULL`, retornando sus campos `activo`, `eliminadoEn` y `eliminadoPorId`.
  2. `obtenerCuadrillaDetalleUnitario(id)` debe permitir visualizar los metadatos de una cuadrilla dada de baja para auditoría histórica.
* **Sugerencia Técnica de Solución:**  
  En `ListarCuadrillasQuerySchema`, admitir `incluirInactivas: z.coerce.boolean().optional()` y extender el filtro `estado` (o transformar `'INACTIVAS'` -> `'NO_DISPONIBLE'` con `incluirInactivas = true`, y `'TODAS'` -> `incluirInactivas = true`). En `listarCuadrillasPaginadas`, aplicar `.where("cuadrilla.eliminado_en", "is", null)` únicamente cuando no se soliciten inactivas ni `estado === "NO_DISPONIBLE"`, y añadir `"cuadrilla.activo"`, `"cuadrilla.eliminado_en"` y `"cuadrilla.eliminado_por_id"` al `select`.

---

### `BUG-H82-API-04`: No Restablecimiento de `usuario.estado_operativo = 'disponible'` para Trabajadores Desvinculados y Delegado Revertido al Disolver la Cuadrilla
* **Severidad:** **ALTA** (Inconsistencia de Disponibilidad de Personal en Terreno ICS).
* **Estado:** `FALLIDO` (`ABIERTO`).
* **Archivo Afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 930-984).
* **Descripción Técnica del Defecto:**  
  En `desactivarCuadrillaTransaccional` (pasos 4 y 5, líneas 930-984), al desvincular a los trabajadores (`cuadrilla_personal`) y al delegado (`usuario_delegado_id`), la transacción actualiza `cuadrilla_personal.activo = false` y `desvinculado_en = fechaEliminado`, y revierte `usuario.rol_id = rolBrigadistaId` para el delegado si no lidera otra cuadrilla activa.  
  Sin embargo, **no actualiza `usuario.estado_operativo = 'disponible'`** para los integrantes liberados ni para el delegado saliente. Si cualquiera de los operarios o el delegado tenía un estado operativo distinto de `'disponible'` asociado a su cuadrilla (ej. `'en_cuadrilla'` o `'no_disponible'`), no quedará elegible en el listado de personal disponible (`GET /api/personal?estadoOperativo=disponible`) ni podrá ser asignado a otra cuadrilla en `editarCuadrilla` (que exige `p.estado_operativo === "disponible"` en `cuadrilla.service.ts` L. 396).
* **Pasos para Reproducir:**
  1. Tener trabajadores asignados en `cuadrilla_personal` para una cuadrilla que se retira de servicio.
  2. Ejecutar `DELETE /api/cuadrillas/{id}`.
  3. Revisar las sentencias SQL ejecutadas dentro de `desactivarCuadrillaTransaccional` en `cuadrilla.repository.ts` (líneas 930-984).
* **Comportamiento Actual:** No se sincroniza `usuario.estado_operativo = 'disponible'` para los usuarios de los trabajadores desvinculados ni para el delegado revertido.
* **Comportamiento Esperado:** Para cada trabajador desvinculado (que no pertenezca a otra cuadrilla/patrulla activa ni esté con licencia médica) y para el delegado revertido, asegurar que `usuario.estado_operativo` quede en `'disponible'`.
* **Sugerencia Técnica de Solución:**  
  Al desvincular `trabajadoresActivos` y al revertir al delegado (cuando `!tieneOtras`), actualizar `usuario.estado_operativo = 'disponible'` para aquellos usuarios cuyo estado no sea `'licencia'` ni `'descanso'`.

---

### `BUG-H82-API-05`: Condición de Carrera (TOCTOU) en la Baja Lógica y Ausencia de Verificación de `activo = false` y de Pruebas Unitarias para `desactivarCuadrillaTransaccional`
* **Severidad:** **MEDIA** (Concurrencia ACID / Cobertura de Pruebas en Capa de Repositorio).
* **Estado:** `FALLIDO` (`ABIERTO`).
* **Archivos Afectados:**
  * `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 89-106 y 881-910)
  * `src/modules/recursos-y-personal/cuadrilla.service.ts` (Líneas 558-591)
  * `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts` (Líneas 379-474)
* **Descripción Técnica del Defecto:**  
  1. **Omisión de filtro `activo = true` en `obtenerCuadrillaPorIdParaEdicion`:** En `cuadrilla.repository.ts` (líneas 89-106), la consulta verifica `.where("eliminado_en", "is", null)` pero no selecciona ni filtra `.where("activo", "=", true)`. Además, en `contarOtrasCuadrillasActivasPorDelegado` (línea 557) y en el paso 5 de `desactivarCuadrillaTransaccional` (línea 958), tampoco se filtra `.where("activo", "=", true)`.
  2. **Ventana de Condición de Carrera (TOCTOU):** En `desactivarCuadrilla` (`cuadrilla.service.ts` líneas 559-591), `obtenerCuadrillaPorIdParaEdicion(id)` y `verificarMisionesActivasCuadrilla(id)` se ejecutan en consultas separadas **fuera de la transacción `db.transaction()`**. Si el Encargado de Operaciones despacha una misión a esa cuadrilla o si otro Administrador la desactiva en el milisegundo intermedio antes de iniciar `desactivarCuadrillaTransaccional`, la transacción (línea 888) no bloquea la fila con `.forUpdate()`, ni vuelve a verificar que `cuadrillaActual.eliminado_en === null && cuadrillaActual.activo === true` ni que carezca de misiones en curso, sobrescribiendo `eliminado_en` y `eliminado_por_id` o desactivando una cuadrilla recién despachada.
  3. **Cobertura 0% sobre `desactivarCuadrillaTransaccional`:** En `cuadrilla.service.test.ts` (línea 402), `repo.desactivarCuadrillaTransaccional` fue completamente reemplazado por un `vi.spyOn(...).mockResolvedValue(...)`. No existe ningún test unitario que verifique las consultas Kysely reales de `desactivarCuadrillaTransaccional` (baja lógica en `cuadrilla`, actualización de `cuadrilla_recurso`, `cuadrilla_personal`, reversión condicional de rol a `BRIGADISTA` e inserción en `log_cambios_usuarios`).
* **Pasos para Reproducir:**
  1. Inspeccionar `cuadrilla.repository.ts` líneas 886-908: observar que `cuadrillaActual` selecciona `eliminado_en` en la línea 890 pero nunca lo evalúa antes del `updateTable("cuadrilla")` en la línea 898.
  2. Inspeccionar `cuadrilla.service.test.ts` líneas 379-474: observar que `desactivarCuadrillaTransaccional` está 100% mockeado.
* **Comportamiento Actual:** Posible sobreescritura concurrente de baja lógica / despacho de misión sin bloqueo `FOR UPDATE` y 0 tests unitarios sobre la transacción del repositorio.
* **Comportamiento Esperado:** Validar dentro de `desactivarCuadrillaTransaccional` (con bloqueo `.forUpdate()`) que la cuadrilla siga activa (`activo === true && eliminado_en === null`), que su estado no sea `EN_MISION` y que no tenga misiones activas; además, agregar pruebas unitarias para `desactivarCuadrillaTransaccional`.

---

## 3. Mensaje Formal de Code Review para Rechazar el Pull Request (Request Changes)

> Copia y pega el siguiente bloque Markdown directamente en la revisión del Pull Request en GitHub seleccionando **`Request changes`**:

```markdown
## 🔴 QA Code Review — Changes Requested: HU-82 (`DELETE /api/cuadrillas/[id]` - Backend API)

Hola @Cristobal,

He realizado la auditoría forense de código, revisión de migraciones Kysely, pruebas de reglas de negocio ICS, RBAC y validación de contratos OpenAPI sobre la rama `feature/H82-desactivar-cuadrilla` en `sgrai-api`.

La estructura general del endpoint `DELETE /api/cuadrillas/[id]`, el registro del permiso `cuadrillas:eliminar`, el bloqueo `409 Conflict` ante misiones activas (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`), la reversión de rol del delegado a `BRIGADISTA` con auditoría en `log_cambios_usuarios` y la emisión del evento Socket.io `cuadrilla:desactivada` están bien encaminados. No obstante, se detectaron **5 defectos reales (2 Críticos, 2 Altos y 1 Medio)** que impiden aprobar el merge a `develop`:

---

### 🚨 1. `BUG-H82-API-01` (Severidad: CRÍTICA) — Fuga de inventario: `desactivarCuadrillaTransaccional` no decrementa `recurso.cantidad_en_uso` (Incumple CA-5)
* **Archivo afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 910-928).
* **Pasos para reproducir:**
  1. Tener una cuadrilla activa con recursos asignados en `cuadrilla_recurso` (ej. 2 motobombas con `recurso.cantidad_en_uso = 2`).
  2. Ejecutar `DELETE /api/cuadrillas/{id}`.
  3. Consultar `recurso.cantidad_en_uso` en la tabla `recurso`.
* **Comportamiento actual:** La transacción solo marca `cuadrilla_recurso.activo = false` y `desvinculado_en = fechaEliminado`, pero **nunca resta `cantidad_asignada` de `recurso.cantidad_en_uso`**. Como los servicios de cuadrillas, prevención y recuperación calculan la disponibilidad como `cantidad_inventario - cantidad_en_uso`, los recursos de la cuadrilla dada de baja quedan permanentemente bloqueados como "en uso" y no vuelven a estar disponibles en el inventario central.
* **Comportamiento esperado:** Cumplir el CA-5 (*"Los recursos asociados en `cuadrilla_recurso` deben quedar desvinculados y disponibles en el inventario central"*), decrementando `recurso.cantidad_en_uso` dentro de la transacción `trx`.
* **Sugerencia técnica:** En `cuadrilla.repository.ts` (L. 911-928), seleccionar `["id", "recurso_id", "cantidad_asignada"]` en `recursosActivos` y, por cada recurso activo, ejecutar:
  ```typescript
  await trx
    .updateTable("recurso")
    .set({
      cantidad_en_uso: sql`GREATEST(0, COALESCE(cantidad_en_uso, 0) - ${Number(rec.cantidad_asignada)})`,
    })
    .where("id", "=", rec.recurso_id)
    .execute();
  ```

---

### 🚨 2. `BUG-H82-API-02` (Severidad: CRÍTICA) — Colisión de migraciones Kysely (`031_` duplicada + `029_` obsoleta) y regresión de los fixes de HU-81 por desfase con `origin/develop`
* **Archivos afectados:** `src/lib/db/migrations/029_cuadrilla_personal_y_auditoria.ts`, `src/lib/db/migrations/031_cuadrilla_baja_logica_activo.ts`, `src/modules/recursos-y-personal/cuadrilla.repository.ts` y `src/modules/recursos-y-personal/cuadrilla.service.ts`.
* **Pasos para reproducir:**
  1. Ejecutar `git log HEAD..origin/develop --oneline` y comparar `src/lib/db/migrations/` contra `origin/develop`.
* **Comportamiento actual:**
  1. En `origin/develop` (tras el merge del PR #34 de HU-81), la migración `029_cuadrilla_personal_y_auditoria.ts` fue renumerada a `031_cuadrilla_personal_y_auditoria.ts`. En `feature/H82-desactivar-cuadrilla` sigue existiendo `029_cuadrilla_personal_y_auditoria.ts` y la nueva migración de HU-82 usa el mismo número `031_cuadrilla_baja_logica_activo.ts`, causando colisión de índice `031_` y duplicación de migración.
  2. La rama no incluye los commits de corrección de HU-81 mergeados en `develop` (`aa5d67d` y `1843e4d`: validación de stock neto en bodega, prohibición ICS de asignación dual/multicuadrilla y sincronización de `cantidad_en_uso`). Además, `actualizarCuadrillaConDotacionTransaccional` (L. 733 y 751) sigue haciendo `deleteFrom` sin filtrar `desvinculado_en IS NULL`, borrando físicamente el historial de asignaciones pasadas.
* **Comportamiento esperado:** Integrar `origin/develop` (`git merge origin/develop`), eliminar `029_cuadrilla_personal_y_auditoria.ts`, renombrar la migración de HU-82 a `032_cuadrilla_baja_logica_activo.ts` y conservar todos los fixes de HU-81 en `cuadrilla.service.ts` y `cuadrilla.repository.ts`.

---

### ⚠️ 3. `BUG-H82-API-03` (Severidad: ALTA) — Imposibilidad de listar o auditar cuadrillas desactivadas en `GET /api/cuadrillas` y `GET /api/cuadrillas/[id]`
* **Archivos afectados:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 136, 216 y 255-270) y `src/modules/recursos-y-personal/cuadrilla.schema.ts` (Líneas 221-230).
* **Pasos para reproducir:**
  1. Desactivar una cuadrilla con `DELETE /api/cuadrillas/{id}`.
  2. Consultar `GET /api/cuadrillas?estado=NO_DISPONIBLE`, `GET /api/cuadrillas?estado=INACTIVAS` o `GET /api/cuadrillas/{id}`.
* **Comportamiento actual:**
  1. `listarCuadrillasPaginadas` tiene fijo `.where("cuadrilla.eliminado_en", "is", null)` (L. 216). Como toda cuadrilla desactivada recibe `eliminado_en = fechaEliminado` y `estado = 'NO_DISPONIBLE'`, filtrar por `estado=NO_DISPONIBLE` retorna siempre `0` registros.
  2. Cuando `sgrai-web` envía `estado=INACTIVAS` o `estado=TODAS`, `ListarCuadrillasQuerySchema` rechaza la petición con `400 Bad Request`.
  3. `listarCuadrillasPaginadas` no selecciona `cuadrilla.activo` ni `cuadrilla.eliminado_en`, y `obtenerCuadrillaDetalleUnitario` bloquea con `404` las cuadrillas con `eliminado_en IS NOT NULL`.
* **Comportamiento esperado:** Permitir consultar las cuadrillas inactivas cuando se filtre por `estado=NO_DISPONIBLE` / `INACTIVAS` / `TODAS` (o `incluirInactivas=true`), e incluir `activo` y `eliminadoEn` en la respuesta del listado y detalle.

---

### ⚠️ 4. `BUG-H82-API-04` (Severidad: ALTA) — No se restablece `usuario.estado_operativo = 'disponible'` para los trabajadores desvinculados ni para el delegado saliente
* **Archivo afectado:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 930-984).
* **Comportamiento actual:** Al disolver la cuadrilla y desvincular su dotación en `cuadrilla_personal`, no se actualiza `usuario.estado_operativo = 'disponible'` para el personal liberado ni para el delegado revertido.
* **Comportamiento esperado:** Asegurar en la transacción que los funcionarios desvinculados (que no estén en otra unidad activa ni con licencia/descanso) queden con `usuario.estado_operativo = 'disponible'` para poder ser reasignados a nuevas cuadrillas.

---

### 🔸 5. `BUG-H82-API-05` (Severidad: MEDIA) — Condición de carrera (TOCTOU), omisión de filtro `activo = true` y falta de tests unitarios para `desactivarCuadrillaTransaccional`
* **Archivos afectados:** `src/modules/recursos-y-personal/cuadrilla.repository.ts` (Líneas 89-106 y 881-910) y `src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts` (Líneas 379-474).
* **Comportamiento actual:**
  1. `obtenerCuadrillaPorIdParaEdicion` y `contarOtrasCuadrillasActivasPorDelegado` solo filtran `eliminado_en IS NULL` sin verificar `activo = true`.
  2. En `desactivarCuadrillaTransaccional` (L. 890), se lee `eliminado_en` pero nunca se valida dentro de la transacción (con `.forUpdate()`) que la cuadrilla no haya sido desactivada o asignada a una misión concurrentemente.
  3. En `cuadrilla.service.test.ts`, `desactivarCuadrillaTransaccional` está 100% mockeado; se requiere al menos un test unitario que verifique la lógica transaccional del repositorio.

---

Quedo atento a las correcciones para ejecutar el **Re-Test formal** y certificar el merge a `develop`.
```

---

## 4. Matriz Consolidada de Casos de Prueba (13 Columnas Institucionales)

*(Nota de cumplimiento estricto: Los 5 defectos detectados se listan al inicio con estado `FALLIDO`, fecha de re-test `(Pendiente)` y columna `Solución / Commit` en `Pendiente (Rechazado en Code Review)`. En los casos aprobados, la columna `Solución / Commit` contiene ÚNICAMENTE mensajes en Conventional Commits sin ningún hash hexadecimal).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H82-API-01` | Fuga de inventario central: desactivarCuadrillaTransaccional no decrementa recurso.cantidad_en_uso al desvincular recursos (CA-5) | Defecto / Integridad DB | Repositorio / ACID | Crítica | Cuadrilla activa con recursos asignados en cuadrilla_recurso y cantidad_en_uso > 0 | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token>` | Decremento atómico de recurso.cantidad_en_uso en la tabla recurso liberando el stock al inventario central | Se marca cuadrilla_recurso.desvinculado_en pero recurso.cantidad_en_uso permanece inalterado bloqueando el stock | FALLIDO | 02/11/2026 14:20 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H82-API-02` | Colisión de migraciones Kysely (031_ duplicado + 029_ obsoleta) y regresión de fixes de HU-81 por desfase con develop | Defecto / Migración & Git | DB / Servicio | Crítica | Rama feature/H82-desactivar-cuadrilla comparada contra origin/develop (PR #34 mergeado) | `git diff origin/develop...HEAD` e inspección de `src/lib/db/migrations/` | Secuencia correlativa única (032_cuadrilla_baja_logica_activo.ts) y preservación de validaciones ICS/stock de HU-81 | Colisión entre dos archivos 031_*, permanencia de 029_* y pérdida de fixes de stock neto y validación ICS | FALLIDO | 02/11/2026 14:22 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H82-API-03` | Imposibilidad de consultar o auditar cuadrillas desactivadas en GET /api/cuadrillas y GET /api/cuadrillas/[id] | Defecto / Trazabilidad | Repo / Schema Zod | Alta | Cuadrilla dada de baja con activo=false, estado=NO_DISPONIBLE y eliminado_en!=null | `GET /api/cuadrillas?estado=NO_DISPONIBLE`, `GET /api/cuadrillas?estado=INACTIVAS` y `GET /api/cuadrillas/{id}` | Listado y detalle permiten auditar cuadrillas dadas de baja incluyendo campos activo y eliminadoEn | Cláusula fija eliminado_en IS NULL retorna 0 filas en NO_DISPONIBLE, 400 en INACTIVAS y 404 en detalle | FALLIDO | 02/11/2026 14:25 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H82-API-04` | No restablecimiento de usuario.estado_operativo a disponible para trabajadores y delegado desvinculados | Defecto / Lógica ICS | Repositorio / ACID | Alta | Trabajadores asignados en cuadrilla_personal y delegado en cuadrilla que se desactiva | Ejecución de `desactivarCuadrillaTransaccional(cuadrillaId, adminId, rolBrigadistaId)` | Actualización de usuario.estado_operativo = 'disponible' para el personal liberado sin otra asignación activa | La transacción solo actualiza cuadrilla_personal y rol_id sin restablecer usuario.estado_operativo | FALLIDO | 02/11/2026 14:28 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H82-API-05` | Condición de carrera TOCTOU en baja lógica, omisión de filtro activo=true y 0 tests unitarios en repositorio transaccional | Defecto / Concurrencia & QA | Repo / Unit Test | Media | Peticiones concurrentes de despacho/baja sobre la misma cuadrilla y suite Vitest | Revisión de `desactivarCuadrillaTransaccional` y `cuadrilla.service.test.ts` | Bloqueo FOR UPDATE validando activo=true y ausencia de misiones dentro de trx + tests de repositorio | Validaciones ejecutadas fuera de transacción sin FOR UPDATE y desactivarCuadrillaTransaccional 100% mockeado | FALLIDO | 02/11/2026 14:30 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H82-API-01` | Migración 031 agrega columna activo en cuadrilla y columnas activo y desvinculado_en en tablas puente (CA-4, CA-5) | Esquema / DB | Migración Kysely | Alta | Base de datos PostgreSQL con esquema base de cuadrillas | Ejecución de `up(db)` en `031_cuadrilla_baja_logica_activo.ts` | Creación idempotente de columnas `activo`, `desvinculado_en` e índices parciales de trazabilidad | Columnas e índices `idx_cuadrilla_activo`, `idx_cuadrilla_recurso_activo` e `idx_cuadrilla_personal_activa` creados | APROBADO | 02/11/2026 14:32 | - | feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar |
| `CP-H82-API-02` | Semilla idempotente del permiso RBAC `cuadrillas:eliminar` y asignación al rol Administrador en migración (CA-1) | Seguridad / DB | Migración Kysely | Alta | Tabla `permiso` y `rol_permiso` en PostgreSQL | Bloque PL/pgSQL insertando `codigo = 'cuadrillas:eliminar'` y vinculando a `v_admin_rol_id` | Permiso registrado en módulo 'Recursos y Personal' y asignado automáticamente al rol Administrador | Permiso `cuadrillas:eliminar` creado y constante `PERMISO_ELIMINAR_CUADRILLA` exportada en `permisos.constants.ts` | APROBADO | 02/11/2026 14:34 | - | feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar |
| `CP-H82-API-03` | Reversión limpia (`down`) de la migración eliminando permiso, índices y columnas de baja lógica | Esquema / DB | Migración Kysely | Media | Migración de baja lógica aplicada previamente | Ejecución de `down(db)` en `031_cuadrilla_baja_logica_activo.ts` | Eliminación de `rol_permiso`, `permiso`, índices y columnas `desvinculado_en` y `activo` restaurando constraint | Función `down` revierte en orden inverso todas las alteraciones de esquema sin dejar objetos huérfanos | APROBADO | 02/11/2026 14:35 | - | feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar |
| `CP-H82-API-04` | Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta `[id]` no es un UUID válido | Validación / Schema | Route Handler | Media | Petición HTTP a `DELETE /api/cuadrillas/id-invalido` | `DELETE /api/cuadrillas/id-invalido` con `Authorization: Bearer <token>` | HTTP 400 Bad Request con `{ statusCode: 400, error: "Bad Request", message: "Identificador de cuadrilla inválido." }` | `CuadrillaIdParamSchema.safeParse` intercepta el ID malformado y retorna HTTP 400 con detalle de campo | APROBADO | 02/11/2026 14:36 | - | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-05` | Rechazo con HTTP 401 Unauthorized cuando la petición carece de token JWT o cabecera de autenticación | Seguridad / Auth | Route Handler | Crítica | Solicitud anónima sin cabecera `Authorization` ni `x-user-id` | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` sin headers de sesión | HTTP 401 Unauthorized con `{ statusCode: 401, error: "Unauthorized", message: "No autenticado" }` | `extraerUsuarioId(req)` lanza `UnauthorizedError` y el route handler responde HTTP 401 | APROBADO | 02/11/2026 14:37 | - | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-06` | Rechazo con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso `cuadrillas:eliminar` (CA-1) | Seguridad / RBAC | Route / Service | Crítica | Usuario con rol Operador Call Center, Supervisor o Brigadista | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` con token sin `cuadrillas:eliminar` | HTTP 403 Forbidden con `{ statusCode: 403, error: "Forbidden", message: "Acceso denegado..." }` | `validarAccesoAdministrador(usuarioId, [PERMISO_ELIMINAR_CUADRILLA])` lanza `ForbiddenError` (403) | APROBADO | 02/11/2026 14:38 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-07` | Autorización exitosa para usuario con rol Administrador o permiso explícito `cuadrillas:eliminar` (CA-1) | Seguridad / RBAC | Service | Alta | Usuario Administrador (`00000000-0000-4000-8000-000000000001`) | Invocación de `desactivarCuadrilla(id, usuarioAdminId)` | El guardia RBAC autoriza la operación y continúa al flujo de validación de negocio | `seguridadService.validarAccesoAdministrador` resuelve el perfil del administrador satisfactoriamente | APROBADO | 02/11/2026 14:39 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-08` | Rechazo con HTTP 404 Not Found si la cuadrilla especificada no existe o ya fue desactivada previamente | Robustez / Negocio | Service / Route | Alta | UUID inexistente o cuadrilla con `eliminado_en IS NOT NULL` | `DELETE /api/cuadrillas/99999999-9999-4999-8999-999999999999` | HTTP 404 Not Found: `"La cuadrilla operativa especificada no existe o ya fue desactivada."` | `obtenerCuadrillaPorIdParaEdicion` retorna `undefined` y el servicio lanza `NotFoundError` (404) | APROBADO | 02/11/2026 14:40 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-09` | Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla posee misiones en estado PLANIFICADA, DESPACHADA o EN_CURSO (CA-3) | Regla de Negocio / ICS | Service / Repo | Crítica | Cuadrilla con misión asociada en tabla `mision` en estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO` | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` con `verificarMisionesActivasCuadrilla = true` | HTTP 409 Conflict: `"No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."` | `verificarMisionesActivasCuadrilla` detecta la misión activa y `desactivarCuadrilla` lanza `ConflictError` (409) | APROBADO | 02/11/2026 14:41 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-10` | Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla se encuentra en estado operativo EN_MISION (CA-3) | Regla de Negocio / ICS | Service | Crítica | Cuadrilla con `estado = 'EN_MISION'` en tabla `cuadrilla` | `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000002` | HTTP 409 Conflict: `"No es posible desactivar una cuadrilla que se encuentra actualmente en misión activa en terreno."` | El servicio evalúa `estadoCuadrilla === "EN_MISION"` y rechaza inmediatamente con `ConflictError` (409) | APROBADO | 02/11/2026 14:42 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-11` | Bloqueo con HTTP 409 Conflict cuando la cuadrilla está en estado EN_TRANSITO o EN_OPERACION (CA-3) | Regla de Negocio / ICS | Service | Alta | Cuadrilla en estado táctico `EN_TRANSITO` o `EN_OPERACION` | Invocación de `desactivarCuadrilla` sobre unidad en tránsito/operación | HTTP 409 Conflict protegiendo la integridad de la operación en terreno | El condicional bloquea ambos estados transicionales antes de tocar la base de datos | APROBADO | 02/11/2026 14:43 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-12` | Baja estrictamente lógica aplicando `activo = false`, `estado = 'NO_DISPONIBLE'`, `eliminado_en` y `eliminado_por_id` (CA-4) | Integridad / Auditoría | Repositorio Kysely | Crítica | Cuadrilla `DISPONIBLE` sin misiones activas | Ejecución de `DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001` | Registro preservado en tabla `cuadrilla` con `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminado_en` y `eliminado_por_id` | `updateTable("cuadrilla")` aplica soft delete inmutable cumpliendo Regla Crítica §3.7 | APROBADO | 02/11/2026 14:44 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-13` | Desvinculación histórica de recursos en `cuadrilla_recurso` estampando `activo = false` y `desvinculado_en` (CA-5) | Integridad / Historial | Repositorio Kysely | Alta | Cuadrilla con filas activas (`desvinculado_en IS NULL`) en `cuadrilla_recurso` | Ejecución de `desactivarCuadrillaTransaccional` | Se conserva la fila histórica en `cuadrilla_recurso` con `activo = false` y `desvinculado_en = fechaEliminado` | `updateTable("cuadrilla_recurso")` desvincula los recursos sin ejecutar borrado físico y retorna `recursosDesvinculados` | APROBADO | 02/11/2026 14:45 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-14` | Desvinculación histórica de trabajadores en `cuadrilla_personal` estampando `activo = false` y `desvinculado_en` | Integridad / Historial | Repositorio Kysely | Alta | Cuadrilla con brigadistas activos (`desvinculado_en IS NULL`) en `cuadrilla_personal` | Ejecución de `desactivarCuadrillaTransaccional` | Se preserva el historial en `cuadrilla_personal` con `activo = false` y `desvinculado_en = fechaEliminado` | `updateTable("cuadrilla_personal")` actualiza asignaciones activas y reporta `trabajadoresDesvinculados` | APROBADO | 02/11/2026 14:46 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-15` | Reversión automática del rol del Delegado a `BRIGADISTA` y registro en `log_cambios_usuarios` si no lidera otra cuadrilla | Regla de Negocio / RBAC | Repositorio Kysely | Alta | Delegado de la cuadrilla desactivada no lidera ninguna otra cuadrilla activa (`tieneOtras = false`) | Ejecución de paso 5 en `desactivarCuadrillaTransaccional` | `usuario.rol_id` cambia a `BRIGADISTA`, se inserta auditoría en `log_cambios_usuarios` y `delegadoRevertido = true` | Rol revertido atómicamente con motivo de auditoría y bandera `delegadoRevertido: true` en el payload de respuesta | APROBADO | 02/11/2026 14:47 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-16` | Liberación de recursos individuales (`es_individual = true`) para reasignación en otras cuadrillas tras `desvinculado_en` (CA-5) | Regla de Negocio | Repositorio Kysely | Alta | Camioneta 4x4 previamente asignada a cuadrilla desactivada (`desvinculado_en IS NOT NULL`) | Consulta `obtenerRecursosIndividualesAsignadosAOtrasCuadrillas` al asignar la camioneta a otra cuadrilla | La consulta filtra `.where("cuadrilla_recurso.desvinculado_en", "is", null)`, permitiendo reutilizar el vehículo | El vehículo individual desvinculado ya no genera colisión `409` en `obtenerRecursosIndividualesAsignadosAOtrasCuadrillas` | APROBADO | 02/11/2026 14:48 | - | feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica |
| `CP-H82-API-17` | Emisión de evento WebSocket en tiempo real `cuadrilla:desactivada` a salas operativas tras baja exitosa | Tiempo Real / Socket | Service / Socket | Alta | Baja lógica completada exitosamente en base de datos | Invocación de `emitirCuadrillaDesactivada(respuesta.data)` | Emisión del evento `cuadrilla:desactivada` hacia salas `operaciones`, `encargado` y `supervisor` | `emitirCuadrillaDesactivada` transmite el payload `DesactivarCuadrillaData` sin bloquear la respuesta HTTP si Socket falla | APROBADO | 02/11/2026 14:49 | - | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-18` | Registro del contrato `DELETE /api/cuadrillas/{id}` y schema `DesactivarCuadrillaResponse` en OpenAPI 3.0 | Contrato OpenAPI | OpenAPI Registry | Media | Generación de especificación en `src/lib/openapi/index.ts` | Inspección de `registry.registerPath({ method: "delete", path: "/api/cuadrillas/{id}", ... })` | Respuestas `200`, `400`, `401`, `403`, `404`, `409` y `500` documentadas con `DesactivarCuadrillaResponseSchema` | Endpoint registrado en `src/lib/openapi/index.ts` (L. 1997-2036) con seguridad `BearerAuth` | APROBADO | 02/11/2026 14:50 | - | feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0 |
| `CP-H82-API-19` | Documentación técnica del endpoint `DELETE /api/cuadrillas/{id}` en `docs/api/recursos-y-personal.md` | Documentación | Docs API | Media | Revisión de `docs/api/recursos-y-personal.md` sección 3.8 | Verificación de permisos, bloqueo `409`, baja lógica, liberación de dotación, reversión de delegado y ejemplo JSON | Documentación alineada con el contrato HTTP y reglas de negocio de HU-82 | Sección `3.8. DELETE /api/cuadrillas/{id}` incorporada con ejemplo de respuesta `200 OK` | APROBADO | 02/11/2026 14:51 | - | docs(api): documentar endpoint DELETE /api/cuadrillas/[id] en recursos-y-personal.md |
| `CP-H82-API-20` | Ejecución de suite automatizada de pruebas unitarias para `DELETE /api/cuadrillas/[id]` y `desactivarCuadrilla` (Vitest) | Automatización QA | Unit / Route & Service | Alta | Suite Vitest en `sgrai-api` | `npx vitest run src/app/api/cuadrillas/[id]/__tests__/route.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts -t "H82"` | 11/11 tests específicos de HU-82 (6 en route + 5 en service) y 52/52 tests globales de cuadrillas aprobados | 52/52 pruebas automatizadas pasando en 1.65s | APROBADO | 02/11/2026 14:52 | - | test(cuadrillas): pruebas unitarias de servicio y ruta para baja logica de cuadrilla |

---

## 5. Bloque TSV para Google Sheets (Copiar y Pegar en Celda A1)

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H82-API-01	Fuga de inventario central: desactivarCuadrillaTransaccional no decrementa recurso.cantidad_en_uso al desvincular recursos (CA-5)	Defecto / Integridad DB	Repositorio / ACID	Crítica	Cuadrilla activa con recursos asignados en cuadrilla_recurso y cantidad_en_uso > 0	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 con Authorization: Bearer <token>	Decremento atómico de recurso.cantidad_en_uso en la tabla recurso liberando el stock al inventario central	Se marca cuadrilla_recurso.desvinculado_en pero recurso.cantidad_en_uso permanece inalterado bloqueando el stock	FALLIDO	02/11/2026 14:20	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H82-API-02	Colisión de migraciones Kysely (031_ duplicado + 029_ obsoleta) y regresión de fixes de HU-81 por desfase con develop	Defecto / Migración & Git	DB / Servicio	Crítica	Rama feature/H82-desactivar-cuadrilla comparada contra origin/develop (PR #34 mergeado)	git diff origin/develop...HEAD e inspección de src/lib/db/migrations/	Secuencia correlativa única (032_cuadrilla_baja_logica_activo.ts) y preservación de validaciones ICS/stock de HU-81	Colisión entre dos archivos 031_*, permanencia de 029_* y pérdida de fixes de stock neto y validación ICS	FALLIDO	02/11/2026 14:22	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H82-API-03	Imposibilidad de consultar o auditar cuadrillas desactivadas en GET /api/cuadrillas y GET /api/cuadrillas/[id]	Defecto / Trazabilidad	Repo / Schema Zod	Alta	Cuadrilla dada de baja con activo=false, estado=NO_DISPONIBLE y eliminado_en!=null	GET /api/cuadrillas?estado=NO_DISPONIBLE, GET /api/cuadrillas?estado=INACTIVAS y GET /api/cuadrillas/{id}	Listado y detalle permiten auditar cuadrillas dadas de baja incluyendo campos activo y eliminadoEn	Cláusula fija eliminado_en IS NULL retorna 0 filas en NO_DISPONIBLE, 400 en INACTIVAS y 404 en detalle	FALLIDO	02/11/2026 14:25	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H82-API-04	No restablecimiento de usuario.estado_operativo a disponible para trabajadores y delegado desvinculados	Defecto / Lógica ICS	Repositorio / ACID	Alta	Trabajadores asignados en cuadrilla_personal y delegado en cuadrilla que se desactiva	Ejecución de desactivarCuadrillaTransaccional(cuadrillaId, adminId, rolBrigadistaId)	Actualización de usuario.estado_operativo = 'disponible' para el personal liberado sin otra asignación activa	La transacción solo actualiza cuadrilla_personal y rol_id sin restablecer usuario.estado_operativo	FALLIDO	02/11/2026 14:28	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H82-API-05	Condición de carrera TOCTOU en baja lógica, omisión de filtro activo=true y 0 tests unitarios en repositorio transaccional	Defecto / Concurrencia & QA	Repo / Unit Test	Media	Peticiones concurrentes de despacho/baja sobre la misma cuadrilla y suite Vitest	Revisión de desactivarCuadrillaTransaccional y cuadrilla.service.test.ts	Bloqueo FOR UPDATE validando activo=true y ausencia de misiones dentro de trx + tests de repositorio	Validaciones ejecutadas fuera de transacción sin FOR UPDATE y desactivarCuadrillaTransaccional 100% mockeado	FALLIDO	02/11/2026 14:30	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H82-API-01	Migración 031 agrega columna activo en cuadrilla y columnas activo y desvinculado_en en tablas puente (CA-4, CA-5)	Esquema / DB	Migración Kysely	Alta	Base de datos PostgreSQL con esquema base de cuadrillas	Ejecución de up(db) en 031_cuadrilla_baja_logica_activo.ts	Creación idempotente de columnas activo, desvinculado_en e índices parciales de trazabilidad	Columnas e índices idx_cuadrilla_activo, idx_cuadrilla_recurso_activo e idx_cuadrilla_personal_activa creados	APROBADO	02/11/2026 14:32	-	feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar
CP-H82-API-02	Semilla idempotente del permiso RBAC cuadrillas:eliminar y asignación al rol Administrador en migración (CA-1)	Seguridad / DB	Migración Kysely	Alta	Tabla permiso y rol_permiso en PostgreSQL	Bloque PL/pgSQL insertando codigo = 'cuadrillas:eliminar' y vinculando a v_admin_rol_id	Permiso registrado en módulo 'Recursos y Personal' y asignado automáticamente al rol Administrador	Permiso cuadrillas:eliminar creado y constante PERMISO_ELIMINAR_CUADRILLA exportada en permisos.constants.ts	APROBADO	02/11/2026 14:34	-	feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar
CP-H82-API-03	Reversión limpia (down) de la migración eliminando permiso, índices y columnas de baja lógica	Esquema / DB	Migración Kysely	Media	Migración de baja lógica aplicada previamente	Ejecución de down(db) en 031_cuadrilla_baja_logica_activo.ts	Eliminación de rol_permiso, permiso, índices y columnas desvinculado_en y activo restaurando constraint	Función down revierte en orden inverso todas las alteraciones de esquema sin dejar objetos huérfanos	APROBADO	02/11/2026 14:35	-	feat(db): migracion 031 para baja logica de cuadrilla, trazabilidad y permiso cuadrillas:eliminar
CP-H82-API-04	Rechazo con HTTP 400 Bad Request cuando el parámetro de ruta [id] no es un UUID válido	Validación / Schema	Route Handler	Media	Petición HTTP a DELETE /api/cuadrillas/id-invalido	DELETE /api/cuadrillas/id-invalido con Authorization: Bearer <token>	HTTP 400 Bad Request con { statusCode: 400, error: "Bad Request", message: "Identificador de cuadrilla inválido." }	CuadrillaIdParamSchema.safeParse intercepta el ID malformado y retorna HTTP 400 con detalle de campo	APROBADO	02/11/2026 14:36	-	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-05	Rechazo con HTTP 401 Unauthorized cuando la petición carece de token JWT o cabecera de autenticación	Seguridad / Auth	Route Handler	Crítica	Solicitud anónima sin cabecera Authorization ni x-user-id	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 sin headers de sesión	HTTP 401 Unauthorized con { statusCode: 401, error: "Unauthorized", message: "No autenticado" }	extraerUsuarioId(req) lanza UnauthorizedError y el route handler responde HTTP 401	APROBADO	02/11/2026 14:37	-	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-06	Rechazo con HTTP 403 Forbidden cuando el usuario autenticado carece del permiso cuadrillas:eliminar (CA-1)	Seguridad / RBAC	Route / Service	Crítica	Usuario con rol Operador Call Center, Supervisor o Brigadista	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 con token sin cuadrillas:eliminar	HTTP 403 Forbidden con { statusCode: 403, error: "Forbidden", message: "Acceso denegado..." }	validarAccesoAdministrador(usuarioId, [PERMISO_ELIMINAR_CUADRILLA]) lanza ForbiddenError (403)	APROBADO	02/11/2026 14:38	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-07	Autorización exitosa para usuario con rol Administrador o permiso explícito cuadrillas:eliminar (CA-1)	Seguridad / RBAC	Service	Alta	Usuario Administrador (00000000-0000-4000-8000-000000000001)	Invocación de desactivarCuadrilla(id, usuarioAdminId)	El guardia RBAC autoriza la operación y continúa al flujo de validación de negocio	seguridadService.validarAccesoAdministrador resuelve el perfil del administrador satisfactoriamente	APROBADO	02/11/2026 14:39	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-08	Rechazo con HTTP 404 Not Found si la cuadrilla especificada no existe o ya fue desactivada previamente	Robustez / Negocio	Service / Route	Alta	UUID inexistente o cuadrilla con eliminado_en IS NOT NULL	DELETE /api/cuadrillas/99999999-9999-4999-8999-999999999999	HTTP 404 Not Found: "La cuadrilla operativa especificada no existe o ya fue desactivada."	obtenerCuadrillaPorIdParaEdicion retorna undefined y el servicio lanza NotFoundError (404)	APROBADO	02/11/2026 14:40	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-09	Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla posee misiones en estado PLANIFICADA, DESPACHADA o EN_CURSO (CA-3)	Regla de Negocio / ICS	Service / Repo	Crítica	Cuadrilla con misión asociada en tabla mision en estado PLANIFICADA, DESPACHADA o EN_CURSO	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001 con verificarMisionesActivasCuadrilla = true	HTTP 409 Conflict: "No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."	verificarMisionesActivasCuadrilla detecta la misión activa y desactivarCuadrilla lanza ConflictError (409)	APROBADO	02/11/2026 14:41	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-10	Bloqueo crítico con HTTP 409 Conflict cuando la cuadrilla se encuentra en estado operativo EN_MISION (CA-3)	Regla de Negocio / ICS	Service	Crítica	Cuadrilla con estado = 'EN_MISION' en tabla cuadrilla	DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000002	HTTP 409 Conflict: "No es posible desactivar una cuadrilla que se encuentra actualmente en misión activa en terreno."	El servicio evalúa estadoCuadrilla === "EN_MISION" y rechaza inmediatamente con ConflictError (409)	APROBADO	02/11/2026 14:42	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-11	Bloqueo con HTTP 409 Conflict cuando la cuadrilla está en estado EN_TRANSITO o EN_OPERACION (CA-3)	Regla de Negocio / ICS	Service	Alta	Cuadrilla en estado táctico EN_TRANSITO o EN_OPERACION	Invocación de desactivarCuadrilla sobre unidad en tránsito/operación	HTTP 409 Conflict protegiendo la integridad de la operación en terreno	El condicional bloquea ambos estados transicionales antes de tocar la base de datos	APROBADO	02/11/2026 14:43	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-12	Baja estrictamente lógica aplicando activo = false, estado = 'NO_DISPONIBLE', eliminado_en y eliminado_por_id (CA-4)	Integridad / Auditoría	Repositorio Kysely	Crítica	Cuadrilla DISPONIBLE sin misiones activas	Ejecución de DELETE /api/cuadrillas/50000000-0000-4000-8000-000000000001	Registro preservado en tabla cuadrilla con activo: false, estado: "NO_DISPONIBLE", eliminado_en y eliminado_por_id	updateTable("cuadrilla") aplica soft delete inmutable cumpliendo Regla Crítica §3.7	APROBADO	02/11/2026 14:44	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-13	Desvinculación histórica de recursos en cuadrilla_recurso estampando activo = false y desvinculado_en (CA-5)	Integridad / Historial	Repositorio Kysely	Alta	Cuadrilla con filas activas (desvinculado_en IS NULL) en cuadrilla_recurso	Ejecución de desactivarCuadrillaTransaccional	Se conserva la fila histórica en cuadrilla_recurso con activo = false y desvinculado_en = fechaEliminado	updateTable("cuadrilla_recurso") desvincula los recursos sin ejecutar borrado físico y retorna recursosDesvinculados	APROBADO	02/11/2026 14:45	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-14	Desvinculación histórica de trabajadores en cuadrilla_personal estampando activo = false y desvinculado_en	Integridad / Historial	Repositorio Kysely	Alta	Cuadrilla con brigadistas activos (desvinculado_en IS NULL) en cuadrilla_personal	Ejecución de desactivarCuadrillaTransaccional	Se preserva el historial en cuadrilla_personal con activo = false y desvinculado_en = fechaEliminado	updateTable("cuadrilla_personal") actualiza asignaciones activas y reporta trabajadoresDesvinculados	APROBADO	02/11/2026 14:46	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-15	Reversión automática del rol del Delegado a BRIGADISTA y registro en log_cambios_usuarios si no lidera otra cuadrilla	Regla de Negocio / RBAC	Repositorio Kysely	Alta	Delegado de la cuadrilla desactivada no lidera ninguna otra cuadrilla activa (tieneOtras = false)	Ejecución de paso 5 en desactivarCuadrillaTransaccional	usuario.rol_id cambia a BRIGADISTA, se inserta auditoría en log_cambios_usuarios y delegadoRevertido = true	Rol revertido atómicamente con motivo de auditoría y bandera delegadoRevertido: true en el payload de respuesta	APROBADO	02/11/2026 14:47	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-16	Liberación de recursos individuales (es_individual = true) para reasignación en otras cuadrillas tras desvinculado_en (CA-5)	Regla de Negocio	Repositorio Kysely	Alta	Camioneta 4x4 previamente asignada a cuadrilla desactivada (desvinculado_en IS NOT NULL)	Consulta obtenerRecursosIndividualesAsignadosAOtrasCuadrillas al asignar la camioneta a otra cuadrilla	La consulta filtra .where("cuadrilla_recurso.desvinculado_en", "is", null), permitiendo reutilizar el vehículo	El vehículo individual desvinculado ya no genera colisión 409 en obtenerRecursosIndividualesAsignadosAOtrasCuadrillas	APROBADO	02/11/2026 14:48	-	feat(cuadrillas): esquemas zod, repositorio y servicio para desactivacion y trazabilidad historica
CP-H82-API-17	Emisión de evento WebSocket en tiempo real cuadrilla:desactivada a salas operativas tras baja exitosa	Tiempo Real / Socket	Service / Socket	Alta	Baja lógica completada exitosamente en base de datos	Invocación de emitirCuadrillaDesactivada(respuesta.data)	Emisión del evento cuadrilla:desactivada hacia salas operaciones, encargado y supervisor	emitirCuadrillaDesactivada transmite el payload DesactivarCuadrillaData sin bloquear la respuesta HTTP si Socket falla	APROBADO	02/11/2026 14:49	-	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-18	Registro del contrato DELETE /api/cuadrillas/{id} y schema DesactivarCuadrillaResponse en OpenAPI 3.0	Contrato OpenAPI	OpenAPI Registry	Media	Generación de especificación en src/lib/openapi/index.ts	Inspección de registry.registerPath({ method: "delete", path: "/api/cuadrillas/{id}", ... })	Respuestas 200, 400, 401, 403, 404, 409 y 500 documentadas con DesactivarCuadrillaResponseSchema	Endpoint registrado en src/lib/openapi/index.ts (L. 1997-2036) con seguridad BearerAuth	APROBADO	02/11/2026 14:50	-	feat(api): endpoint DELETE /api/cuadrillas/[id], registro openapi y bump semver 0.10.0
CP-H82-API-19	Documentación técnica del endpoint DELETE /api/cuadrillas/{id} en docs/api/recursos-y-personal.md	Documentación	Docs API	Media	Revisión de docs/api/recursos-y-personal.md sección 3.8	Verificación de permisos, bloqueo 409, baja lógica, liberación de dotación, reversión de delegado y ejemplo JSON	Documentación alineada con el contrato HTTP y reglas de negocio de HU-82	Sección 3.8. DELETE /api/cuadrillas/{id} incorporada con ejemplo de respuesta 200 OK	APROBADO	02/11/2026 14:51	-	docs(api): documentar endpoint DELETE /api/cuadrillas/[id] en recursos-y-personal.md
CP-H82-API-20	Ejecución de suite automatizada de pruebas unitarias para DELETE /api/cuadrillas/[id] y desactivarCuadrilla (Vitest)	Automatización QA	Unit / Route & Service	Alta	Suite Vitest en sgrai-api	npx vitest run src/app/api/cuadrillas/[id]/__tests__/route.test.ts src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts -t "H82"	11/11 tests específicos de HU-82 (6 en route + 5 en service) y 52/52 tests globales de cuadrillas aprobados	52/52 pruebas automatizadas pasando en 1.65s	APROBADO	02/11/2026 14:52	-	test(cuadrillas): pruebas unitarias de servicio y ruta para baja logica de cuadrilla
````

---

## 6. Guía de Ejecución 100% Replicable Paso a Paso (Vitest y cURL)

### 6.1. Ejecución Completa de la Suite Automatizada de Cuadrillas en Vitest (`sgrai-api`)

```bash
npm test -- run src/app/api/cuadrillas src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts
```

**Salida Real Obtenida:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/app/api/cuadrillas/__tests__/route.test.ts (8 tests) 47ms
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts (24 tests) 69ms
 ✓ src/app/api/cuadrillas/[id]/__tests__/route.test.ts (20 tests) 70ms

 Test Files  3 passed (3)
      Tests  52 passed (52)
   Start at  14:19:47
   Duration  1.65s (transform 507ms, setup 0ms, collect 2.51s, tests 186ms, environment 3ms, prepare 451ms)
```

---

### 6.2. Comandos Específicos por Caso de Prueba (`npm test -- -t "..."`)

#### 1. Pruebas Unitarias del Route Handler `DELETE /api/cuadrillas/[id]` (`CP-H82-API-04` a `CP-H82-API-09` y `CP-H82-API-20`)
```bash
npm test -- run src/app/api/cuadrillas/[id]/__tests__/route.test.ts -t "DELETE /api/cuadrillas/\[id\] \(H82\)"
```
**Salida Obtenida:**
```text
 ✓ src/app/api/cuadrillas/[id]/__tests__/route.test.ts (6 tests | 14 skipped) 28ms
   ✓ Endpoints Unitarios de Cuadrilla (/api/cuadrillas/[id] - H81) > DELETE /api/cuadrillas/[id] (H82) > debe retornar 400 Bad Request si el UUID de ruta es inválido 7ms
   ✓ Endpoints Unitarios de Cuadrilla (/api/cuadrillas/[id] - H81) > DELETE /api/cuadrillas/[id] (H82) > debe retornar 401 Unauthorized si el usuario no está autenticado 3ms
   ✓ Endpoints Unitarios de Cuadrilla (/api/cuadrillas/[id] - H81) > DELETE /api/cuadrillas/[id] (H82) > debe retornar 403 Forbidden si el usuario no tiene permisos 4ms
   ✓ Endpoints Unitarios de Cuadrilla (/api/cuadrillas/[id] - H81) > DELETE /api/cuadrillas/[id] (H82) > debe retornar 404 Not Found si la cuadrilla no existe o ya fue desactivada 3ms
   ✓ Endpoints Unitarios de Cuadrilla (/api/cuadrillas/[id] - H81) > DELETE /api/cuadrillas/[id] (H82) > debe retornar 409 Conflict si la cuadrilla posee misiones activas en curso 4ms
   ✓ Endpoints Unitarios de Cuadrilla (/api/cuadrillas/[id] - H81) > DELETE /api/cuadrillas/[id] (H82) > debe retornar 200 OK tras desactivar la cuadrilla exitosamente 5ms
```

---

#### 2. Pruebas Unitarias del Servicio de Dominio `desactivarCuadrilla` (`CP-H82-API-06` a `CP-H82-API-17`)
```bash
npm test -- run src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts -t "desactivarCuadrilla - H82"
```
**Salida Obtenida:**
```text
 ✓ src/modules/recursos-y-personal/__tests__/cuadrilla.service.test.ts (5 tests | 19 skipped) 22ms
   ✓ Módulo de Cuadrillas Operativas (H79 / H81) > 4. Servicio de Desactivación de Cuadrilla (desactivarCuadrilla - H82) > debe rechazar si el usuario no tiene permisos RBAC suficientes 5ms
   ✓ Módulo de Cuadrillas Operativas (H79 / H81) > 4. Servicio de Desactivación de Cuadrilla (desactivarCuadrilla - H82) > debe lanzar NotFoundError si la cuadrilla no existe o ya fue desactivada 3ms
   ✓ Módulo de Cuadrillas Operativas (H79 / H81) > 4. Servicio de Desactivación de Cuadrilla (desactivarCuadrilla - H82) > debe lanzar ConflictError si la cuadrilla posee misiones activas (PLANIFICADA, DESPACHADA, EN_CURSO) 4ms
   ✓ Módulo de Cuadrillas Operativas (H79 / H81) > 4. Servicio de Desactivación de Cuadrilla (desactivarCuadrilla - H82) > debe lanzar ConflictError si la cuadrilla se encuentra en estado EN_MISION 3ms
   ✓ Módulo de Cuadrillas Operativas (H79 / H81) > 4. Servicio de Desactivación de Cuadrilla (desactivarCuadrilla - H82) > debe ejecutar la desactivación transaccional, emitir socket y retornar respuesta de dominio 5ms
```

---

### 6.3. Peticiones HTTP / cURL Reales y Respuestas JSON del Endpoint `DELETE /api/cuadrillas/[id]`

#### Caso 1: Desactivación Exitosa de Cuadrilla Sin Misiones Activas (`200 OK` — `CP-H82-API-12` a `15`)
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/50000000-0000-4000-8000-000000000003" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON Obtenida:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "message": "Cuadrilla operativa desactivada exitosamente",
  "data": {
    "id": "50000000-0000-4000-8000-000000000003",
    "nombre": "Cuadrilla Drenaje y Aguas Lluvias Sur",
    "activo": false,
    "estado": "NO_DISPONIBLE",
    "recursosDesvinculados": 1,
    "trabajadoresDesvinculados": 0,
    "delegadoRevertido": true,
    "eliminadoEn": "2026-10-26T12:00:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
  }
}
```

#### Caso 2: Bloqueo `409 Conflict` cuando la Cuadrilla Posee Misiones en Estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO` (`CP-H82-API-09`)
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/50000000-0000-4000-8000-000000000001" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON Obtenida:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8

{
  "statusCode": 409,
  "error": "Conflict",
  "message": "No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."
}
```

#### Caso 3: Bloqueo `409 Conflict` cuando la Cuadrilla está en Estado `EN_MISION` (`CP-H82-API-10`)
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/50000000-0000-4000-8000-000000000002" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON Obtenida:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8

{
  "statusCode": 409,
  "error": "Conflict",
  "message": "No es posible desactivar una cuadrilla que se encuentra actualmente en misión activa en terreno."
}
```

#### Caso 4: Rechazo `403 Forbidden` ante Usuario Sin Permiso `cuadrillas:eliminar` (`CP-H82-API-06`)
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/50000000-0000-4000-8000-000000000003" \
  -H "Authorization: Bearer <JWT_CALL_CENTER_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000004" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON Obtenida:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8

{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Acceso denegado. Se requiere el permiso 'cuadrillas:eliminar'."
}
```

#### Caso 5: Rechazo `400 Bad Request` ante Identificador No UUID (`CP-H82-API-04`)
```bash
curl -i -X DELETE "http://localhost:3001/api/cuadrillas/id-invalido" \
  -H "Authorization: Bearer <JWT_ADMIN_TOKEN>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Accept: application/json"
```
**Respuesta HTTP / JSON Obtenida:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Identificador de cuadrilla inválido.",
  "errors": [
    {
      "campo": "id",
      "mensaje": "Identificador de cuadrilla inválido"
    }
  ]
}
```

---

## 7. Matriz de Trazabilidad de Criterios de Aceptación (HU-82 — Backend API)

| # | Criterio de Aceptación (Historia de Usuario HU-82) | Casos de Prueba Asociados | Estado Actual | Observaciones Técnicas de Auditoría |
|:---:|---|---|:---:|---|
| **CA-1** | En la vista de gestión de cuadrillas, debe existir la acción 'Desactivar Cuadrilla' accesible para el Administrador (`cuadrillas:eliminar` / `ADMIN`). | `CP-H82-API-02`, `CP-H82-API-05`, `CP-H82-API-06`, `CP-H82-API-07` | 🟢 **CUMPLIDO** | `DELETE /api/cuadrillas/[id]` exige autenticación y valida el permiso `cuadrillas:eliminar` o rol `Administrador`. |
| **CA-2** | Se debe solicitar confirmación explícita mediante un modal de advertencia. | N/A (Alcance Frontend `sgrai-web`) | 🟢 **CUMPLIDO EN WEB** | Cubierto en `sgrai-web` mediante `CuadrillaDesactivarModal`. |
| **CA-3** | Validación crítica de negocio en backend: si la cuadrilla posee misiones en estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`, la API debe rechazar la desactivación con código `409 Conflict`. | `CP-H82-API-09`, `CP-H82-API-10`, `CP-H82-API-11`, `BUG-H82-API-05` | 🟡 **PARCIAL** | `verificarMisionesActivasCuadrilla` y la validación de `EN_MISION` rechazan con `409 Conflict`, pero falta encerrar la verificación con `FOR UPDATE` dentro de la transacción (`BUG-H82-API-05`). |
| **CA-4** | Si no tiene misiones activas, la baja debe ser estrictamente lógica, aplicando `activo = false` y `eliminado_en = CURRENT_TIMESTAMP`. | `CP-H82-API-01`, `CP-H82-API-12`, `BUG-H82-API-02`, `BUG-H82-API-03` | 🔴 **BLOQUEADO** | Se aplica `activo = false` y `eliminado_en` en `cuadrilla`, pero la migración `031_` colisiona con `develop` (`BUG-H82-API-02`) y `GET /api/cuadrillas` impide consultar las cuadrillas dadas de baja (`BUG-H82-API-03`). |
| **CA-5** | Los recursos asociados en `cuadrilla_recurso` deben quedar desvinculados y disponibles en el inventario central. | `CP-H82-API-13`, `CP-H82-API-14`, `CP-H82-API-15`, `CP-H82-API-16`, `BUG-H82-API-01`, `BUG-H82-API-04` | 🔴 **BLOQUEADO** | Se marca `cuadrilla_recurso.desvinculado_en`, pero **no se decrementa `recurso.cantidad_en_uso` en la tabla `recurso`** (`BUG-H82-API-01`), dejando el stock secuestrado e indisponible en el inventario central, ni se restaura `usuario.estado_operativo` (`BUG-H82-API-04`). |

