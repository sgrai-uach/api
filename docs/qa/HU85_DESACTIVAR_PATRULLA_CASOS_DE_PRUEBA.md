# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-85 — Desactivar Patrulla Verificadora mediante Baja Lógica (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Patrullas Verificadoras (`sgrai-api` — `DELETE /api/patrullas/[id]`).  
> **Historia de Usuario:** HU-85 — *"Como Administrador Quiero desactivar mediante baja lógica una patrulla verificadora que ya no prestará servicios. Para impedir que sea seleccionada en nuevos despachos, conservando la auditoría de los reportes técnicos en los que actuó."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Servicio Backend Auditado:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Zod + Socket.io + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H85-desactivar-patrulla`  
> **Commits Evaluados en la Rama:**  
> * `feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)`  
> * `merge: resolver conflictos con develop integrando openapi de cuadrillas (H81) y patrullas (HU-84/HU-85)`  
>  
> **Fecha de Auditoría:** 03/11/2026 21:58.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (6 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección estática y dinámica del código fuente, revisión de transacciones ACID en Kysely/PostgreSQL, encadenamiento de migraciones contra `develop` y `feature/H82-desactivar-cuadrilla`, validación de reglas de negocio del Sistema de Comando de Incidentes (ICS), contratos OpenAPI 3.0 y pruebas automatizadas en Vitest sobre la rama `feature/H85-desactivar-patrulla`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** debido a la detección de **6 defectos reales** (2 críticos, 3 altos y 1 medio) que comprometen la protección de patrullas desplegadas en terreno, la liberación íntegra y segura del personal operativo, la preservación del historial vehicular, la auditabilidad de unidades desactivadas y la secuencia de migraciones Kysely (`032_` duplicada con HU-82).

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **26** | 6 Defectos Detectados (`BUG-H85-API-01` a `06`) + 20 Casos de Contrato, RBAC, ICS, Kysely y Socket.io (`CP-H85-API-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Validación Zod de UUID, RBAC `recursos:eliminar`, bloqueo `409` en `EN_VERIFICACION` y misiones activas, baja lógica y eventos Socket.io |
| **Defectos Abiertos / Fallidos (Failed)** | **6** | **2 Críticos, 3 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de entorno o infraestructura |
| **Tasa de Aprobación Actual (% Pass)** | **76.9%** | Se requiere el 100.0% (0 defectos abiertos) en Re-Test para aprobar la integración a `develop` |
| **Suite Automatizada de Patrullas (Vitest)** | **75/75 tests pass (con mocks)** | `patrulla.schema.test.ts` (21), `patrulla.service.test.ts` (18), `route.test.ts` (35) y `openapi.json` (1) |
| **Análisis Estático ESLint (`npm run lint`)** | **0 errores** | 0 errores en los archivos del módulo de patrullas |
| **Secuencia de Migraciones Kysely** | 🔴 **Colisión en correlativo `032_`** | `032_patrulla_desactivacion_baja_logica.ts` colisiona con `032_cuadrilla_baja_logica_activo.ts` (HU-82); debe renumerarse a `033_` |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H85-API-01`: Ausencia de Bloqueo Operativo para Estados de Despliegue en Terreno (`EN_PREVENCION`, `EN_RECUPERACION`, `EN_MISION`) y Condición de Carrera TOCTOU sin `SELECT ... FOR UPDATE` en `desactivarPatrullaService` / `desactivarPatrullaTransaccionalRepo`
* **Severidad:** **CRÍTICA** (Incumplimiento del Criterio de Aceptación 3 y Vulnerabilidad de Concurrencia en Operaciones ICS).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 551-568)
  * `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 661-677)
* **Descripción Técnica del Defecto:**  
  1. **Validación incompleta de estados de despliegue operativo:** El ciclo de vida operativo de una patrulla verificadora en SGRAI (`EstadoPatrullaEnum` en `patrulla.schema.ts:13-20`) contempla cuatro estados de despliegue activo en terreno: `EN_VERIFICACION`, `EN_PREVENCION` (operativos preventivos en puntos críticos, HU-30), `EN_RECUPERACION` (eventos de recuperación territorial, HU-29) y `EN_MISION` (actualizable vía `PATCH /api/patrullas/[id]`). Sin embargo, `desactivarPatrullaService` (`patrulla.service.ts:552`) evalúa únicamente:
     ```typescript
     if (patrullaExistente.fila.patrulla_estado === "EN_VERIFICACION") {
       throw new ConflictError(...);
     }
     ```
     Si una patrulla fue cambiada a estado `EN_PREVENCION`, `EN_RECUPERACION` o `EN_MISION` (por ejemplo, a través de `PATCH /api/patrullas/[id]` antes de vincular la misión o en transición operativa), el servicio **no rechaza la solicitud con `409 Conflict`** y permite desactivar una unidad desplegada en terreno.
  2. **Condición de carrera TOCTOU (Time-Of-Check to Time-Of-Use):** Las consultas `obtenerPatrullaPorIdRepo(id)` (línea 544) y `verificarMisionesActivasPatrullaRepo(id)` (línea 559) se ejecutan fuera de la transacción `db.transaction()`. Al entrar en `desactivarPatrullaTransaccionalRepo` (`patrulla.repository.ts:667-672`), el `SELECT` inicial sobre `patrulla_verificadora` no adquiere bloqueo pesimista `.forUpdate()` ni re-verifica el estado operativo ni la ausencia de filas activas en la tabla `mision` (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`). Si un Encargado despacha la patrulla concurrentemente mientras el Administrador ejecuta `DELETE /api/patrullas/[id]`, la patrulla es dada de baja con una misión activa en curso.
* **Pasos para Reproducir:**
  1. Actualizar el estado de una patrulla a `EN_MISION`, `EN_PREVENCION` o `EN_RECUPERACION` mediante `PATCH /api/patrullas/{id}` sin fila activa en `mision` (o enviar un despacho concurrente al `DELETE`).
  2. Ejecutar `DELETE /api/patrullas/{id}` con credenciales de Administrador.
* **Comportamiento Actual:** La API acepta la petición y responde `HTTP 200 OK`, desactivando la patrulla desplegada.
* **Comportamiento Esperado:** El servicio y la transacción (con bloqueo `SELECT ... FOR UPDATE`) deben rechazar con `HTTP 409 Conflict` cualquier intento de baja cuando la patrulla se encuentre en cualquiera de los estados operativos activos en terreno (`EN_VERIFICACION`, `EN_PREVENCION`, `EN_RECUPERACION`, `EN_MISION`) o posea misiones en estado `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`.
* **Sugerencia Técnica de Solución:**  
  1. Definir la constante `ESTADOS_PATRULLA_EN_TERRENO = ["EN_VERIFICACION", "EN_PREVENCION", "EN_RECUPERACION", "EN_MISION"]` en `patrulla.service.ts` y `patrulla.repository.ts` y validar pertenencia tanto en el servicio como dentro de `desactivarPatrullaTransaccionalRepo`.
  2. En `desactivarPatrullaTransaccionalRepo`, encadenar `.forUpdate()` al `selectFrom("patrulla_verificadora")` y re-consultar `mision` dentro de `trx` antes de mutar las tablas.

---

### `BUG-H85-API-02`: Liberación Incompleta y Corrupción de Disponibilidad (`usuario.estado_operativo`) al Ignorar `usuario_lider_id` y Sobrescribir Incondicionalmente el Estado de los Integrantes en `desactivarPatrullaTransaccionalRepo`
* **Severidad:** **CRÍTICA** (Violación del Criterio de Aceptación 5 y Corrupción de Disponibilidad de Personal en Base de Datos).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 666-730).
* **Descripción Técnica del Defecto:**  
  El Criterio de Aceptación 5 exige: *"El vehículo y personal asignados deben quedar liberados a disponibilidad en el inventario comunal"*. En `desactivarPatrullaTransaccionalRepo` (`patrulla.repository.ts:693-717`), la liberación de personal presenta tres defectos:
  1. **Omisión del funcionario líder (`patrulla_verificadora.usuario_lider_id`):** La consulta de la línea 671 solo selecciona `["id", "codigo", "nombre", "vehiculo_id"]`, ignorando `usuario_lider_id`. En patrullas donde el líder está registrado en `patrulla_verificadora.usuario_lider_id` pero no figura en `patrulla_personal` (como las patrullas preexistentes sembradas en `006_operaciones_misiones_kanban.ts` y `seed-kanban.ts`), o cuando los eventos ATP (`evento-prevencion.service.ts:160`, `recuperacion.service.ts:137`) cambian el estado del `usuario_lider_id`, dicho líder nunca es liberado a `'disponible'`.
  2. **Sobrescritura incondicional de `usuario.estado_operativo = 'disponible'`:** En las líneas 702-717:
     ```typescript
     await trx
       .updateTable("usuario")
       .set({ estado_operativo: "disponible" })
       .where("id", "in", trx.selectFrom("personal").select("usuario_id").where("id", "in", personalLiberadoIds))
       .execute();
     ```
     Esta actualización fuerza `estado_operativo = 'disponible'` sin verificar:
     * Si el funcionario forma parte de otra `patrulla_verificadora` activa (`eliminado_en IS NULL`) o de una `cuadrilla` activa (`cuadrilla_personal` / `cuadrilla.usuario_delegado_id` con `eliminado_en IS NULL`).
     * Si el usuario tiene `activo = false`, `estado_operativo = 'inactivo'` o `'fuera_de_servicio'`, reactivando indebidamente en el inventario comunal a funcionarios dados de baja o con licencia médica.
  3. **Vínculos activos remanentes en `patrulla_personal`:** Al no registrar la desvinculación en `patrulla_personal` (ni limpiar/filtrar por patrullas activas), los registros en `patrulla_personal` permanecen idénticos a los de una patrulla activa.
* **Pasos para Reproducir:**
  1. Tener una patrulla con `usuario_lider_id` asignado y un integrante en `patrulla_personal` cuyo `usuario.estado_operativo` sea `'fuera_de_servicio'` (o que pertenezca a otra unidad activa).
  2. Ejecutar `DELETE /api/patrullas/{id}`.
* **Comportamiento Actual:** El `usuario_lider_id` no es considerado si no está en `patrulla_personal`, y el integrante con `'fuera_de_servicio'` o asignado a otra unidad activa es forzado a `estado_operativo = 'disponible'`.
* **Comportamiento Esperado:** Se debe liberar a `'disponible'` tanto a los integrantes de `patrulla_personal` como al `usuario_lider_id` únicamente cuando `usuario.activo === true`, su estado sea `'en_patrulla'` (no `'inactivo'` ni `'fuera_de_servicio'`) y no pertenezcan a ninguna otra patrulla o cuadrilla activa (`eliminado_en IS NULL`).
* **Sugerencia Técnica de Solución:**  
  Seleccionar `usuario_lider_id` en `patrullaActual`, consolidar los `usuario_id` de `patrulla_personal` junto con `usuario_lider_id`, y filtrar en el `UPDATE usuario` aquellos usuarios con `activo = true`, `estado_operativo = 'en_patrulla'` que no tengan presencia en otra `patrulla_verificadora` o `cuadrilla` con `eliminado_en IS NULL`.

---

### `BUG-H85-API-03`: Pérdida de Trazabilidad del Vehículo Histórico — `desactivarPatrullaTransaccionalRepo` Sobrescribe `patrulla_verificadora.vehiculo_id = null` Eliminando el Vínculo de Auditoría
* **Severidad:** **ALTA** (Violación de la Regla Crítica §3.7 de Borrado Lógico y Auditoría Inmutable).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 719-730).
* **Descripción Técnica del Defecto:**  
  La historia HU-85 exige conservar la auditoría histórica de la patrulla verificadora bajo la Regla Crítica §3.7 de borrado lógico e inmutabilidad. No obstante, en `desactivarPatrullaTransaccionalRepo` (`patrulla.repository.ts:720-730`), al ejecutar el `UPDATE` sobre `patrulla_verificadora` se establece:
  ```typescript
  const patrullaActualizada = await trx
    .updateTable("patrulla_verificadora")
    .set({
      activo: false,
      estado: "NO_DISPONIBLE",
      vehiculo_id: null,
      eliminado_en: sql`CURRENT_TIMESTAMP`,
      eliminado_por_id: usuarioId ?? null,
      actualizado_en: sql`CURRENT_TIMESTAMP`,
    })
  ```
  Dado que el esquema no posee una tabla histórica intermedia `patrulla_vehiculo`, sobrescribir `vehiculo_id: null` en `patrulla_verificadora` destruye de forma irreversible el dato de con qué vehículo institucional operaba la patrulla al momento de su retiro. Cabe destacar que la liberación del vehículo hacia el inventario comunal ya se realiza en las líneas 681-691 actualizando la tabla `recurso` (`estado: "DISPONIBLE"`, `cantidad_en_uso: 0`), y que la validación de disponibilidad al crear o editar otra patrulla (`crearPatrullaService` L.181 y `modificarPatrullaService` L.437) evalúa `recurso.estado === "DISPONIBLE"` y `recurso.cantidad_en_uso === 0` (además de que `patrulla_verificadora.vehiculo_id` no posee restricción `UNIQUE`).
* **Pasos para Reproducir:**
  1. Desactivar una patrulla que cuenta con el vehículo `e1000000-0000-4000-8000-000000000002` mediante `DELETE /api/patrullas/{id}`.
  2. Consultar en base de datos el registro histórico de `patrulla_verificadora` para auditar qué vehículo tuvo asignado.
* **Comportamiento Actual:** La columna `patrulla_verificadora.vehiculo_id` queda en `NULL`, perdiéndose el rastro histórico del móvil asignado a la unidad.
* **Comportamiento Esperado:** La liberación del vehículo al inventario comunal debe actualizar `recurso.estado = 'DISPONIBLE'` y `recurso.cantidad_en_uso = 0` conservando la referencia histórica en `patrulla_verificadora.vehiculo_id` (o registrando la desvinculación sin perder el identificador del vehículo histórico), asegurando que cualquier validación de vehículo en uso filtre únicamente patrullas activas (`eliminado_en IS NULL`).
* **Sugerencia Técnica de Solución:**  
  Mantener `vehiculo_id` en `patrulla_verificadora` al aplicar la baja lógica (liberando el recurso en la tabla `recurso` con `estado = 'DISPONIBLE'` y `cantidad_en_uso = 0`), y si alguna consulta verifica asignación en `patrulla_verificadora`, filtrar siempre por `.where("eliminado_en", "is", null)`.

---

### `BUG-H85-API-04`: Imposibilidad de Consultar o Auditar Patrullas Desactivadas en `GET /api/patrullas` y `GET /api/patrullas/[id]` (Filtro Rígido `eliminado_en IS NULL` y Omisión de `activo`, `eliminadoEn` y `eliminadoPorId`)
* **Severidad:** **ALTA** (Incumplimiento de Auditoría de Reportes Técnicos e Inconsistencia en Endpoints de Consulta).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 65-71, 105-138, 190-242)
  * `src/modules/recursos-y-personal/patrulla.schema.ts` (Líneas 27-49, 116-160)
  * `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 57-133)
* **Descripción Técnica del Defecto:**  
  1. **Bloqueo `404 Not Found` al auditar el detalle de una patrulla dada de baja (`GET /api/patrullas/[id]`):** En `obtenerPatrullaPorIdRepo` (`patrulla.repository.ts:203`), se aplica incondicionalmente `.where("pv.eliminado_en", "is", null)`. Cuando un Administrador o Auditor inspecciona un reporte técnico histórico o misión cerrada e intenta consultar la ficha de la patrulla desactivada vía `GET /api/patrullas/{id}`, el endpoint responde `HTTP 404 Not Found`. Además, impide distinguir en operaciones de lectura si la patrulla existe en estado histórico inactivo.
  2. **Imposibilidad de listar patrullas dadas de baja (`GET /api/patrullas`):** En `listarPatrullasRepo` (`patrulla.repository.ts:70`), la consulta base filtra de manera fija `.where("pv.eliminado_en", "is", null)` y `ListarPatrullasQuerySchema` (`patrulla.schema.ts:27-49`) no admite parámetros como `activo`, `incluirInactivas` o `incluir_inactivas`. Dado que toda patrulla desactivada queda con `estado = 'NO_DISPONIBLE'` y `eliminado_en IS NOT NULL`, incluso filtrar por `GET /api/patrullas?estado=NO_DISPONIBLE` excluye el 100% de las patrullas dadas de baja.
  3. **Omisión de metadatos de baja lógica en el DTO de respuesta (`PatrullaItemResponseSchema`):** Ni `PatrullaItemResponseSchema` (`patrulla.schema.ts:116-160`) ni `mapearFilaAPatrullaDTO` (`patrulla.service.ts:57-133`) exponen los atributos `activo`, `eliminadoEn` ni `eliminadoPorId`.
* **Pasos para Reproducir:**
  1. Desactivar una patrulla mediante `DELETE /api/patrullas/{id}` (responde `200 OK` con `activo: false`, `estado: "NO_DISPONIBLE"`).
  2. Consultar `GET /api/patrullas/{id}` o `GET /api/patrullas?incluirInactivas=true` / `GET /api/patrullas?activo=false`.
* **Comportamiento Actual:** `GET /api/patrullas/{id}` devuelve `404 Not Found` y `GET /api/patrullas` no retorna patrullas desactivadas ni expone `activo` o `eliminadoEn`.
* **Comportamiento Esperado:**
  1. `GET /api/patrullas/{id}` debe permitir consultar el detalle unitario histórico de una patrulla desactivada exponiendo `activo: false`, `eliminadoEn` y `eliminadoPorId` (mientras que `PUT`, `PATCH` y `DELETE` deben verificar que `activo === true` / `eliminado_en === null`).
  2. `ListarPatrullasQuerySchema` y `listarPatrullasRepo` deben mantener por omisión solo patrullas activas (`eliminado_en IS NULL` para impedir su selección en despachos), pero permitir consultar inactivas cuando se envíe `incluirInactivas=true`, `incluir_inactivas=true` o `activo=false`.
* **Sugerencia Técnica de Solución:**  
  Añadir `activo`, `eliminadoEn` y `eliminadoPorId` a `FilaPatrullaConsulta`, `PatrullaItemResponseSchema` y `mapearFilaAPatrullaDTO`; extender `ListarPatrullasQuerySchema` con `activo` e `incluirInactivas`; y permitir a `obtenerPatrullaPorIdRepo` un parámetro opcional `{ incluirEliminadas?: boolean }` para que `GET /api/patrullas/[id]` consulte el registro histórico sin afectar el bloqueo en `PATCH`, `PUT` y `DELETE`.

---

### `BUG-H85-API-05`: Consultas de Despacho en Eventos ATP (HU-29 y HU-30) No Filtran `activo = true` ni `eliminado_en IS NULL`, y Documentación Técnica (`docs/api/recursos-y-personal.md`) Contradice la Migración 025
* **Severidad:** **MEDIA** (Defensa en Profundidad en Despachos Transversales y Desalineación Documental).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/modules/eventos-atp/evento-prevencion.repository.ts` (Líneas 6-12)
  * `src/modules/eventos-atp/recuperacion.repository.ts` (Líneas 61-67)
  * `docs/api/recursos-y-personal.md` (Líneas 609, 693)
  * `src/lib/openapi/index.ts` (Líneas 2071-2113)
* **Descripción Técnica del Defecto:**  
  1. **Omisión de filtro `eliminado_en IS NULL` y `activo = true` en repositorios de despacho ATP:** En `evento-prevencion.repository.ts:6-12` y `recuperacion.repository.ts:61-67`, la función `buscarPatrullaPorId` consulta `patrulla_verificadora` únicamente por `.where("id", "=", patrullaId)` sin verificar `.where("eliminado_en", "is", null)` ni `.where("activo", "=", true)`. Aunque `desactivarPatrullaTransaccionalRepo` cambia el estado a `NO_DISPONIBLE`, si una patrulla desactivada fuese invocada o su estado alterado, no se valida explícitamente su condición de baja lógica.
  2. **Error conceptual en `docs/api/recursos-y-personal.md`:** En la sección `3.9. DELETE /api/patrullas/{id}` (línea 693) agregada en este PR, se documenta:
     > *"Personal de Terreno: Los funcionarios asignados a la dotación en `patrulla_personal` pasan en la tabla `personal` a `estado_operativo = 'disponible'`"*
     Desde la migración `025_disponibilidad_usuario.ts` (HU-11), la columna `estado_operativo` fue eliminada de `personal` y reside exclusivamente en `usuario.estado_operativo`.
  3. **Omisión de header `x-user-id` en el contrato OpenAPI de `DELETE /api/patrullas/{id}`:** En `src/lib/openapi/index.ts` (líneas 2071-2113), el registro de `DELETE /api/patrullas/{id}` no documenta el header opcional `x-user-id` que `extraerUsuarioId(req)` soporta en `route.ts:250`.
* **Pasos para Reproducir:**
  1. Inspeccionar `buscarPatrullaPorId` en `evento-prevencion.repository.ts` y `recuperacion.repository.ts`.
  2. Inspeccionar `docs/api/recursos-y-personal.md` línea 693 y `/openapi.json` en la operación `DELETE /api/patrullas/{id}`.
* **Comportamiento Actual:** `buscarPatrullaPorId` no filtra `eliminado_en IS NULL` ni `activo = true`; la documentación afirma que `estado_operativo` está en la tabla `personal`; y el OpenAPI de `DELETE /api/patrullas/{id}` omite `x-user-id` en `request.headers`.
* **Comportamiento Esperado:** `buscarPatrullaPorId` debe filtrar `.where("eliminado_en", "is", null)` y `.where("activo", "=", true)`; `docs/api/recursos-y-personal.md` debe referenciar `usuario.estado_operativo`; y `src/lib/openapi/index.ts` debe documentar las cabeceras de autenticación consistentes con el resto del módulo.
* **Sugerencia Técnica de Solución:**  
  Agregar `.where("eliminado_en", "is", null)` en `buscarPatrullaPorId` de ambos repositorios ATP, corregir la referencia a la tabla `usuario` (`usuario.estado_operativo`) en `docs/api/recursos-y-personal.md` (líneas 609 y 693) e incluir `headers` opcionales en `src/lib/openapi/index.ts`.

---

### `BUG-H85-API-06`: Colisión de Numeración Secuencial de Migraciones Kysely (`032_patrulla_desactivacion_baja_logica.ts` Duplica el Correlativo `032` de `032_cuadrilla_baja_logica_activo.ts` en HU-82)
* **Severidad:** **ALTA** (Colisión en el Encadenamiento de Migraciones de Base de Datos al Integrar con `develop` / HU-82).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/lib/db/migrations/032_patrulla_desactivacion_baja_logica.ts`.
* **Descripción Técnica del Defecto:**  
  En la rama `feature/H82-desactivar-cuadrilla` (correspondiente a la baja lógica de cuadrillas, HU-82), el correlativo `032` ya se encuentra ocupado por la migración `src/lib/db/migrations/032_cuadrilla_baja_logica_activo.ts`. En `feature/H85-desactivar-patrulla`, la migración para la baja lógica de patrullas fue creada con el mismo prefijo numérico: `src/lib/db/migrations/032_patrulla_desactivacion_baja_logica.ts`.
  * El ejecutor de migraciones `FileMigrationProvider` de Kysely ordena las migraciones alfabéticamente por nombre de archivo y exige que toda migración nueva sea lexicográficamente posterior a la última migración registrada en `kysely_migration`.
  * Si en un entorno de base de datos se ejecuta primero `032_patrulla_desactivacion_baja_logica` y posteriormente se integra `032_cuadrilla_baja_logica_activo` (dado que `'032_cuadrilla...' < '032_patrulla...'`), Kysely aborta el proceso de migración con el error `corrupted migration: previously executed migration 032_patrulla_desactivacion_baja_logica is after unexecuted migration 032_cuadrilla_baja_logica_activo`.
  * Además, rompe la convención institucional de correlativos únicos secuenciales en `src/lib/db/migrations/`.
* **Pasos para Reproducir:**
  1. Comparar el árbol de migraciones de `feature/H82-desactivar-cuadrilla` (`032_cuadrilla_baja_logica_activo.ts`) con el de `feature/H85-desactivar-patrulla` (`032_patrulla_desactivacion_baja_logica.ts`).
  2. Aplicar `032_patrulla_desactivacion_baja_logica.ts` y luego intentar ejecutar `npm run db:migrate` tras incorporar `032_cuadrilla_baja_logica_activo.ts`.
* **Comportamiento Actual:** Ambas ramas definen una migración con el número `032_`, provocando colisión de prefijo y fallo de ordenamiento en Kysely (`'032_cuadrilla...' < '032_patrulla...'`).
* **Comportamiento Esperado:** Cada migración debe poseer un número secuencial único; la migración de HU-85 debe renumerarse a `033_patrulla_desactivacion_baja_logica.ts` para ejecutarse de forma determinista después de `032_cuadrilla_baja_logica_activo.ts`.
* **Sugerencia Técnica de Solución:**  
  Renombrar el archivo mediante `git mv src/lib/db/migrations/032_patrulla_desactivacion_baja_logica.ts src/lib/db/migrations/033_patrulla_desactivacion_baja_logica.ts`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H85-API-01` | Ausencia de bloqueo 409 Conflict para estados de despliegue EN_PREVENCION, EN_RECUPERACION y EN_MISION y falta de SELECT FOR UPDATE transaccional | Regla de Negocio / Concurrencia | Service / Repo | Crítica | Patrulla verificadora en estado EN_PREVENCION, EN_RECUPERACION o EN_MISION o despacho concurrente | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `x-user-id: 00000000-0000-4000-8000-000000000001` | HTTP 409 Conflict bloqueando la baja en cualquier estado de despliegue en terreno con bloqueo pesimista FOR UPDATE | El servicio solo valida `patrulla_estado === "EN_VERIFICACION"` y la transacción carece de `.forUpdate()`, permitiendo desactivar unidades en `EN_PREVENCION`, `EN_RECUPERACION` o `EN_MISION` | ABIERTO | 03/11/2026 18:10 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H85-API-02` | Liberación incompleta del líder (`usuario_lider_id`) y sobrescritura incondicional de `usuario.estado_operativo` en dotación | Integridad / DB | Repository | Crítica | Patrulla con `usuario_lider_id` y personal con `estado_operativo = 'fuera_de_servicio'` o en otra unidad activa | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | Libera al líder y a los integrantes solo si están activos, en `'en_patrulla'` y no pertenecen a otra unidad activa | Omite `usuario_lider_id` si no figura en `patrulla_personal` y sobrescribe ciegamente `estado_operativo = 'disponible'` incluso para usuarios inactivos o con licencia | ABIERTO | 03/11/2026 18:12 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H85-API-03` | Pérdida de trazabilidad del vehículo histórico al sobrescribir `patrulla_verificadora.vehiculo_id = null` durante la baja lógica | Auditoría / DB | Repository | Alta | Patrulla activa con vehículo institucional asignado (`vehiculo_id = e1000000-0000-4000-8000-000000000002`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | El vehículo pasa a `DISPONIBLE` (`cantidad_en_uso = 0`) en tabla `recurso` conservando la trazabilidad histórica del móvil que operó en la patrulla | `desactivarPatrullaTransaccionalRepo` ejecuta `vehiculo_id: null` en `patrulla_verificadora`, borrando de la base de datos qué vehículo tuvo asignado la patrulla | ABIERTO | 03/11/2026 18:14 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H85-API-04` | Imposibilidad de auditar patrullas dadas de baja en `GET /api/patrullas/[id]` (404) y `GET /api/patrullas` y omisión de `activo` / `eliminadoEn` | Funcional / Contrato | Repo / Schema / Service | Alta | Patrulla verificadora desactivada con `activo = false` y `eliminado_en IS NOT NULL` | `GET /api/patrullas/f1000000-0000-4000-8000-000000000001` y `GET /api/patrullas?incluirInactivas=true` | `GET /api/patrullas/[id]` retorna la ficha histórica con `activo: false` y `eliminadoEn`; listado permite filtrar inactivas para auditoría | `GET /api/patrullas/[id]` retorna `404 Not Found` por cláusula fija `eliminado_en IS NULL` y `PatrullaItemResponseSchema` omite `activo` y `eliminadoEn` | ABIERTO | 03/11/2026 18:16 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H85-API-05` | Consultas `buscarPatrullaPorId` en eventos ATP no filtran `eliminado_en IS NULL` ni `activo = true` y documentación referencia columna eliminada `personal.estado_operativo` | Integridad / Docs | Repo ATP / Docs / OpenAPI | Media | Patrulla desactivada invocada en despacho ATP y revisión de `docs/api/recursos-y-personal.md` | `buscarPatrullaPorId(trx, patrullaId)` y lectura de `docs/api/recursos-y-personal.md:693` | Repositorios ATP filtran `eliminado_en IS NULL` y `activo = true`; documentación referencia `usuario.estado_operativo` | `buscarPatrullaPorId` no verifica `eliminado_en IS NULL` ni `activo = true`, y la documentación indica que `estado_operativo` pertenece a la tabla `personal` | ABIERTO | 03/11/2026 18:18 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H85-API-06` | Colisión de correlativo de migración Kysely `032_patrulla_desactivacion_baja_logica.ts` con `032_cuadrilla_baja_logica_activo.ts` de la rama H82 | Integridad / Migraciones | DB / CI | Alta | Existencia de `032_cuadrilla_baja_logica_activo.ts` en `feature/H82-desactivar-cuadrilla` | Inspección de `src/lib/db/migrations/` y ejecución secuencial de `FileMigrationProvider` | La migración de HU-85 se numera como `033_patrulla_desactivacion_baja_logica.ts` sin colisionar con HU-82 | Ambas ramas utilizan el prefijo `032_`, generando colisión de numeración y error de orden lexicográfico en Kysely al integrar con H82 | ABIERTO | 03/11/2026 21:55 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H85-API-01` | Desactivación exitosa (baja lógica) de patrulla verificadora en estado DISPONIBLE sin misiones activas | Funcional | Route / Service / Repo | Crítica | Patrulla activa en estado `DISPONIBLE` con vehículo y dotación asignada, sin misiones en curso | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token_admin>` | HTTP 200 OK con `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminadoEn`, `eliminadoPorId`, `vehiculoLiberadoId` y `personalLiberadoIds` | HTTP 200 OK retornando estructura `DesactivarPatrullaResponseSchema` completa | APROBADO | 03/11/2026 18:20 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-02` | Rechazo con HTTP 409 Conflict al intentar desactivar una patrulla en estado EN_VERIFICACION (CA-3) | Regla de Negocio / ICS | Service / Route | Crítica | Patrulla activa desplegada en terreno con `estado = 'EN_VERIFICACION'` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token_admin>` | HTTP 409 Conflict con mensaje indicando que la patrulla se encuentra en terreno en estado `'EN_VERIFICACION'` | HTTP 409 Conflict bloqueando la baja lógica de la unidad en verificación | APROBADO | 03/11/2026 18:20 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-03` | Rechazo con HTTP 409 Conflict cuando la patrulla posee misiones tácticas activas (PLANIFICADA, DESPACHADA o EN_CURSO) (CA-3) | Regla de Negocio / ICS | Service / Repo | Crítica | Patrulla con misión asociada en tabla `mision` en estado `EN_CURSO` (`MIS-2026-0001`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `Authorization: Bearer <token_admin>` | HTTP 409 Conflict listando el código de la misión activa en curso (`MIS-2026-0001`) | HTTP 409 Conflict: `"No es posible desactivar la patrulla verificadora '...' porque cuenta con misiones tácticas activas en curso (MIS-2026-0001)."` | APROBADO | 03/11/2026 18:21 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-04` | Persistencia de atributos de baja lógica (`activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, `eliminado_por_id`) (CA-4) | Integridad / DB | Repository / DB | Crítica | Patrulla activa sin misiones en curso | Ejecución de `desactivarPatrullaTransaccionalRepo(id, adminId)` | Registro preservado físicamente en `patrulla_verificadora` con `activo = false`, `estado = 'NO_DISPONIBLE'`, `eliminado_en` y `eliminado_por_id` | Actualización atómica en Kysely retornando `activo: false`, `estado: "NO_DISPONIBLE"`, `eliminadoEn` ISO y `eliminadoPorId` | APROBADO | 03/11/2026 18:21 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-05` | Liberación transaccional del vehículo institucional asignado a estado DISPONIBLE y `cantidad_en_uso = 0` (CA-5) | Regla de Negocio / Inventario | Repository / DB | Crítica | Patrulla con vehículo `e1000000-0000-4000-8000-000000000002` en estado `ASIGNADO` (`cantidad_en_uso = 1`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | Tabla `recurso` actualiza el vehículo a `estado = 'DISPONIBLE'`, `cantidad_en_uso = 0` y retorna `vehiculoLiberadoId` | Vehículo actualizado a `DISPONIBLE` dentro de la misma transacción y devuelto en `data.vehiculoLiberadoId` | APROBADO | 03/11/2026 18:21 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-06` | Desactivación exitosa de patrulla verificadora sin vehículo asignado (`vehiculo_id = null`) | Caso de Borde | Service / Repo | Media | Patrulla activa conformada solo por personal a pie (`vehiculo_id = null`) | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000002` | HTTP 200 OK con `vehiculoLiberadoId: null`, liberando únicamente a los integrantes y omitiendo `emitirRecursoActualizado` | HTTP 200 OK procesado sin errores cuando la patrulla no posee vehículo asignado | APROBADO | 03/11/2026 18:22 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-07` | Preservación inalterada de misiones cerradas y reportes de terreno históricos (`reporte_terreno`) tras la baja lógica | Auditoría / Regla §3.7 | Base de Datos | Crítica | Patrulla con misiones históricas en estado `COMPLETADA` y registros en `reporte_terreno` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` | No se ejecuta `DELETE` físico en `patrulla_verificadora`; claves foráneas en `mision.patrulla_id` y `reporte_terreno` se mantienen intactas | Trazabilidad histórica de misiones finalizadas e informes técnicos preservada al 100% | APROBADO | 03/11/2026 18:22 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-08` | Exclusión automática de la patrulla desactivada en el listado operativo por defecto (`GET /api/patrullas`) para impedir nuevos despachos | Funcional / Integración | Repository / Service | Alta | Patrulla recién desactivada con `eliminado_en IS NOT NULL` | `GET /api/patrullas?estado=DISPONIBLE` | La patrulla dada de baja no aparece en el selector de patrullas disponibles para despacho | Excluida del listado operativo general impidiendo su selección en nuevos despachos | APROBADO | 03/11/2026 18:22 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-09` | Liberación del código identificador único (`idx_patrulla_codigo_unico` parcial `WHERE eliminado_en IS NULL`) tras baja lógica | Integridad / DB | Migración 028 | Media | Patrulla con código `PV-COSTA-01` dada de baja (`eliminado_en IS NOT NULL`) | `POST /api/patrullas` creando nueva patrulla con `codigo: "PV-COSTA-01"` | El índice único parcial `WHERE eliminado_en IS NULL` y `buscarPatrullaPorCodigoRepo` permiten reutilizar el código institucional | El código queda disponible para reasignación sin colisión de clave única | APROBADO | 03/11/2026 18:22 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-10` | Rechazo con HTTP 401 Unauthorized cuando no se envía token JWT ni cabecera de autenticación | Seguridad / Auth | Route Handler | Crítica | Petición anónima sin cabeceras `Authorization` ni `x-user-id` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` sin headers | HTTP 401 Unauthorized impidiendo la ejecución del servicio | Retorna HTTP 401 Unauthorized con mensaje de error de autenticación | APROBADO | 03/11/2026 18:23 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-11` | Rechazo con HTTP 403 Forbidden para usuario autenticado sin perfil Administrador ni permiso `recursos:eliminar` | Seguridad / RBAC | Service / Guard | Crítica | Usuario autenticado con rol `CALL_CENTER` o `INFORMANTE` sin permiso `recursos:eliminar` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con token sin privilegios | HTTP 403 Forbidden denegando la baja lógica | Retorna HTTP 403 Forbidden mediante `seguridadService.validarAccesoAdministrador` | APROBADO | 03/11/2026 18:23 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-12` | Autorización exitosa mediante perfil Administrador o permiso explícito `recursos:eliminar` | Seguridad / RBAC | Service / Guard | Alta | Usuario autenticado con rol `ADMIN` o permiso `recursos:eliminar` | `DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001` con `x-user-id` de Administrador | Acceso autorizado hacia `desactivarPatrullaService` | Validación RBAC superada exitosamente ejecutando la baja lógica | APROBADO | 03/11/2026 18:23 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-13` | Rechazo con HTTP 400 Bad Request ante parámetro de ruta `id` con formato no UUID | Validación / Zod | Route Handler | Media | Parámetro `:id` malformado en la URL | `DELETE /api/patrullas/id-no-valido` | HTTP 400 Bad Request con `"Identificador de patrulla inválido."` y detalle en `errors` | Retorna HTTP 400 validado por `PatrullaIdParamSchema.safeParse` | APROBADO | 03/11/2026 18:23 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-14` | Rechazo con HTTP 404 Not Found cuando la patrulla no existe o ya fue desactivada previamente (idempotencia de segunda baja) | Robustez / Negocio | Service / Route | Alta | UUID inexistente o patrulla previamente dada de baja (`eliminado_en IS NOT NULL`) | `DELETE /api/patrullas/f9999999-0000-4000-8000-000000000999` | HTTP 404 Not Found indicando que la patrulla no existe o ya ha sido desactivada | Retorna HTTP 404 Not Found capturando `NotFoundError` | APROBADO | 03/11/2026 18:24 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-15` | Validación de contrato de salida con `DesactivarPatrullaResponseSchema` en Zod | Contrato / Schema | Unit / Zod | Alta | Objeto de respuesta de baja lógica | `DesactivarPatrullaResponseSchema.safeParse(payloadBaja)` | Validación exitosa exigiendo `activo` booleano, `estado` canónico, `eliminadoEn` y `personalLiberadoIds` | Esquema valida payloads conformes y rechaza respuestas sin el campo booleano `activo` | APROBADO | 03/11/2026 18:24 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-16` | Emisión de eventos WebSocket `patrulla:desactivada`, `patrulla:actualizada` y `recurso:actualizado` en tiempo real | Tiempo Real / Socket.io | Service / Socket | Alta | Baja lógica exitosa de patrulla con vehículo asignado | Ejecución de `desactivarPatrullaService` | Se invocan `notificarPatrullaDesactivada`, `notificarPatrullaActualizada` y `emitirRecursoActualizado` hacia las salas operacionales | Los 3 eventos Socket.io se emiten con los payloads esperados | APROBADO | 03/11/2026 18:24 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-17` | Estructura DDL e idempotencia (`up` y `down`) de columnas `activo` y `eliminado_por_id` e índices en `patrulla_verificadora` | Base de Datos | Migración Kysely | Alta | Esquema PostgreSQL con tabla `patrulla_verificadora` | Ejecución de `up(db)` y `down(db)` de la migración de baja lógica | Agrega columnas `activo` (`DEFAULT true`) y `eliminado_por_id` (`REFERENCES usuario(id) ON DELETE SET NULL`) e índices `idx_patrulla_activo` e `idx_patrulla_eliminado_por` | Sentencias DDL idempotentes con `IF NOT EXISTS` y rollback limpio en `down` | APROBADO | 03/11/2026 18:24 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-18` | Registro y exposición del endpoint `DELETE /api/patrullas/{id}` en la especificación pública `GET /openapi.json` | Contrato OpenAPI | OpenAPI 3.0 | Alta | Generador OpenAPI en `src/lib/openapi/index.ts` | `GET /openapi.json` | `spec.paths["/api/patrullas/{id}"].delete` registrado con códigos `200`, `400`, `401`, `403`, `404`, `409` y `500` y esquema `DesactivarPatrullaResponse` | Endpoint y esquemas exportados en `/openapi.json` versión `0.10.0` | APROBADO | 03/11/2026 18:25 | - | merge: resolver conflictos con develop integrando openapi de cuadrillas (H81) y patrullas (HU-84/HU-85) |
| `CP-H85-API-19` | Manejo controlado de excepciones inesperadas de base de datos retornando HTTP 500 Internal Server Error | Robustez / Error Handling | Route Handler | Media | Fallo no controlado en capa de persistencia | Excepción genérica en `desactivarPatrullaService` | HTTP 500 Internal Server Error con mensaje `"Error interno del servidor al desactivar la patrulla verificadora."` sin filtrar trazas SQL | Captura segura en bloque `catch` de `DELETE` en `route.ts` | APROBADO | 03/11/2026 18:25 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |
| `CP-H85-API-20` | Ejecución íntegra de la suite automatizada de pruebas unitarias del módulo de patrullas en Vitest | Automatización | Unit / Integration | Alta | Suite Vitest configurada en `sgrai-api` | `npm test -- src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts src/app/api/patrullas/__tests__/route.test.ts` | 74/74 pruebas unitarias de patrullas aprobadas sin errores | 74/74 tests pasando en 80ms | APROBADO | 03/11/2026 18:25 | - | feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85) |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H85-API-01	Ausencia de bloqueo 409 Conflict para estados de despliegue EN_PREVENCION, EN_RECUPERACION y EN_MISION y falta de SELECT FOR UPDATE transaccional	Regla de Negocio / Concurrencia	Service / Repo	Crítica	Patrulla verificadora en estado EN_PREVENCION, EN_RECUPERACION o EN_MISION o despacho concurrente	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con x-user-id: 00000000-0000-4000-8000-000000000001	HTTP 409 Conflict bloqueando la baja en cualquier estado de despliegue en terreno con bloqueo pesimista FOR UPDATE	El servicio solo valida patrulla_estado === "EN_VERIFICACION" y la transacción carece de .forUpdate(), permitiendo desactivar unidades en EN_PREVENCION, EN_RECUPERACION o EN_MISION	ABIERTO	03/11/2026 18:10	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-API-02	Liberación incompleta del líder (usuario_lider_id) y sobrescritura incondicional de usuario.estado_operativo en dotación	Integridad / DB	Repository	Crítica	Patrulla con usuario_lider_id y personal con estado_operativo = 'fuera_de_servicio' o en otra unidad activa	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	Libera al líder y a los integrantes solo si están activos, en 'en_patrulla' y no pertenecen a otra unidad activa	Omite usuario_lider_id si no figura en patrulla_personal y sobrescribe ciegamente estado_operativo = 'disponible' incluso para usuarios inactivos o con licencia	ABIERTO	03/11/2026 18:12	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-API-03	Pérdida de trazabilidad del vehículo histórico al sobrescribir patrulla_verificadora.vehiculo_id = null durante la baja lógica	Auditoría / DB	Repository	Alta	Patrulla activa con vehículo institucional asignado (vehiculo_id = e1000000-0000-4000-8000-000000000002)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	El vehículo pasa a DISPONIBLE (cantidad_en_uso = 0) en tabla recurso conservando la trazabilidad histórica del móvil que operó en la patrulla	desactivarPatrullaTransaccionalRepo ejecuta vehiculo_id: null en patrulla_verificadora, borrando de la base de datos qué vehículo tuvo asignado la patrulla	ABIERTO	03/11/2026 18:14	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-API-04	Imposibilidad de auditar patrullas dadas de baja en GET /api/patrullas/[id] (404) y GET /api/patrullas y omisión de activo / eliminadoEn	Funcional / Contrato	Repo / Schema / Service	Alta	Patrulla verificadora desactivada con activo = false y eliminado_en IS NOT NULL	GET /api/patrullas/f1000000-0000-4000-8000-000000000001 y GET /api/patrullas?incluirInactivas=true	GET /api/patrullas/[id] retorna la ficha histórica con activo: false y eliminadoEn; listado permite filtrar inactivas para auditoría	GET /api/patrullas/[id] retorna 404 Not Found por cláusula fija eliminado_en IS NULL y PatrullaItemResponseSchema omite activo y eliminadoEn	ABIERTO	03/11/2026 18:16	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-API-05	Consultas buscarPatrullaPorId en eventos ATP no filtran eliminado_en IS NULL ni activo = true y documentación referencia columna eliminada personal.estado_operativo	Integridad / Docs	Repo ATP / Docs / OpenAPI	Media	Patrulla desactivada invocada en despacho ATP y revisión de docs/api/recursos-y-personal.md	buscarPatrullaPorId(trx, patrullaId) y lectura de docs/api/recursos-y-personal.md:693	Repositorios ATP filtran eliminado_en IS NULL y activo = true; documentación referencia usuario.estado_operativo	buscarPatrullaPorId no verifica eliminado_en IS NULL ni activo = true, y la documentación indica que estado_operativo pertenece a la tabla personal	ABIERTO	03/11/2026 18:18	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-API-06	Colisión de correlativo de migración Kysely 032_patrulla_desactivacion_baja_logica.ts con 032_cuadrilla_baja_logica_activo.ts de la rama H82	Integridad / Migraciones	DB / CI	Alta	Existencia de 032_cuadrilla_baja_logica_activo.ts en feature/H82-desactivar-cuadrilla	Inspección de src/lib/db/migrations/ y ejecución secuencial de FileMigrationProvider	La migración de HU-85 se numera como 033_patrulla_desactivacion_baja_logica.ts sin colisionar con HU-82	Ambas ramas utilizan el prefijo 032_, generando colisión de numeración y error de orden lexicográfico en Kysely al integrar con H82	ABIERTO	03/11/2026 21:55	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H85-API-01	Desactivación exitosa (baja lógica) de patrulla verificadora en estado DISPONIBLE sin misiones activas	Funcional	Route / Service / Repo	Crítica	Patrulla activa en estado DISPONIBLE con vehículo y dotación asignada, sin misiones en curso	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con Authorization: Bearer <token_admin>	HTTP 200 OK con activo: false, estado: "NO_DISPONIBLE", eliminadoEn, eliminadoPorId, vehiculoLiberadoId y personalLiberadoIds	HTTP 200 OK retornando estructura DesactivarPatrullaResponseSchema completa	APROBADO	03/11/2026 18:20	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-02	Rechazo con HTTP 409 Conflict al intentar desactivar una patrulla en estado EN_VERIFICACION (CA-3)	Regla de Negocio / ICS	Service / Route	Crítica	Patrulla activa desplegada en terreno con estado = 'EN_VERIFICACION'	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con Authorization: Bearer <token_admin>	HTTP 409 Conflict con mensaje indicando que la patrulla se encuentra en terreno en estado 'EN_VERIFICACION'	HTTP 409 Conflict bloqueando la baja lógica de la unidad en verificación	APROBADO	03/11/2026 18:20	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-03	Rechazo con HTTP 409 Conflict cuando la patrulla posee misiones tácticas activas (PLANIFICADA, DESPACHADA o EN_CURSO) (CA-3)	Regla de Negocio / ICS	Service / Repo	Crítica	Patrulla con misión asociada en tabla mision en estado EN_CURSO (MIS-2026-0001)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con Authorization: Bearer <token_admin>	HTTP 409 Conflict listando el código de la misión activa en curso (MIS-2026-0001)	HTTP 409 Conflict: "No es posible desactivar la patrulla verificadora '...' porque cuenta con misiones tácticas activas en curso (MIS-2026-0001)."	APROBADO	03/11/2026 18:21	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-04	Persistencia de atributos de baja lógica (activo = false, eliminado_en = CURRENT_TIMESTAMP, eliminado_por_id) (CA-4)	Integridad / DB	Repository / DB	Crítica	Patrulla activa sin misiones en curso	Ejecución de desactivarPatrullaTransaccionalRepo(id, adminId)	Registro preservado físicamente en patrulla_verificadora con activo = false, estado = 'NO_DISPONIBLE', eliminado_en y eliminado_por_id	Actualización atómica en Kysely retornando activo: false, estado: "NO_DISPONIBLE", eliminadoEn ISO y eliminadoPorId	APROBADO	03/11/2026 18:21	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-05	Liberación transaccional del vehículo institucional asignado a estado DISPONIBLE y cantidad_en_uso = 0 (CA-5)	Regla de Negocio / Inventario	Repository / DB	Crítica	Patrulla con vehículo e1000000-0000-4000-8000-000000000002 en estado ASIGNADO (cantidad_en_uso = 1)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	Tabla recurso actualiza el vehículo a estado = 'DISPONIBLE', cantidad_en_uso = 0 y retorna vehiculoLiberadoId	Vehículo actualizado a DISPONIBLE dentro de la misma transacción y devuelto en data.vehiculoLiberadoId	APROBADO	03/11/2026 18:21	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-06	Desactivación exitosa de patrulla verificadora sin vehículo asignado (vehiculo_id = null)	Caso de Borde	Service / Repo	Media	Patrulla activa conformada solo por personal a pie (vehiculo_id = null)	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000002	HTTP 200 OK con vehiculoLiberadoId: null, liberando únicamente a los integrantes y omitiendo emitirRecursoActualizado	HTTP 200 OK procesado sin errores cuando la patrulla no posee vehículo asignado	APROBADO	03/11/2026 18:22	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-07	Preservación inalterada de misiones cerradas y reportes de terreno históricos (reporte_terreno) tras la baja lógica	Auditoría / Regla §3.7	Base de Datos	Crítica	Patrulla con misiones históricas en estado COMPLETADA y registros en reporte_terreno	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001	No se ejecuta DELETE físico en patrulla_verificadora; claves foráneas en mision.patrulla_id y reporte_terreno se mantienen intactas	Trazabilidad histórica de misiones finalizadas e informes técnicos preservada al 100%	APROBADO	03/11/2026 18:22	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-08	Exclusión automática de la patrulla desactivada en el listado operativo por defecto (GET /api/patrullas) para impedir nuevos despachos	Funcional / Integración	Repository / Service	Alta	Patrulla recién desactivada con eliminado_en IS NOT NULL	GET /api/patrullas?estado=DISPONIBLE	La patrulla dada de baja no aparece en el selector de patrullas disponibles para despacho	Excluida del listado operativo general impidiendo su selección en nuevos despachos	APROBADO	03/11/2026 18:22	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-09	Liberación del código identificador único (idx_patrulla_codigo_unico parcial WHERE eliminado_en IS NULL) tras baja lógica	Integridad / DB	Migración 028	Media	Patrulla con código PV-COSTA-01 dada de baja (eliminado_en IS NOT NULL)	POST /api/patrullas creando nueva patrulla con codigo: "PV-COSTA-01"	El índice único parcial WHERE eliminado_en IS NULL y buscarPatrullaPorCodigoRepo permiten reutilizar el código institucional	El código queda disponible para reasignación sin colisión de clave única	APROBADO	03/11/2026 18:22	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-10	Rechazo con HTTP 401 Unauthorized cuando no se envía token JWT ni cabecera de autenticación	Seguridad / Auth	Route Handler	Crítica	Petición anónima sin cabeceras Authorization ni x-user-id	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 sin headers	HTTP 401 Unauthorized impidiendo la ejecución del servicio	Retorna HTTP 401 Unauthorized con mensaje de error de autenticación	APROBADO	03/11/2026 18:23	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-11	Rechazo con HTTP 403 Forbidden para usuario autenticado sin perfil Administrador ni permiso recursos:eliminar	Seguridad / RBAC	Service / Guard	Crítica	Usuario autenticado con rol CALL_CENTER o INFORMANTE sin permiso recursos:eliminar	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con token sin privilegios	HTTP 403 Forbidden denegando la baja lógica	Retorna HTTP 403 Forbidden mediante seguridadService.validarAccesoAdministrador	APROBADO	03/11/2026 18:23	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-12	Autorización exitosa mediante perfil Administrador o permiso explícito recursos:eliminar	Seguridad / RBAC	Service / Guard	Alta	Usuario autenticado con rol ADMIN o permiso recursos:eliminar	DELETE /api/patrullas/f1000000-0000-4000-8000-000000000001 con x-user-id de Administrador	Acceso autorizado hacia desactivarPatrullaService	Validación RBAC superada exitosamente ejecutando la baja lógica	APROBADO	03/11/2026 18:23	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-13	Rechazo con HTTP 400 Bad Request ante parámetro de ruta id con formato no UUID	Validación / Zod	Route Handler	Media	Parámetro :id malformado en la URL	DELETE /api/patrullas/id-no-valido	HTTP 400 Bad Request con "Identificador de patrulla inválido." y detalle en errors	Retorna HTTP 400 validado por PatrullaIdParamSchema.safeParse	APROBADO	03/11/2026 18:23	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-14	Rechazo con HTTP 404 Not Found cuando la patrulla no existe o ya fue desactivada previamente (idempotencia de segunda baja)	Robustez / Negocio	Service / Route	Alta	UUID inexistente o patrulla previamente dada de baja (eliminado_en IS NOT NULL)	DELETE /api/patrullas/f9999999-0000-4000-8000-000000000999	HTTP 404 Not Found indicando que la patrulla no existe o ya ha sido desactivada	Retorna HTTP 404 Not Found capturando NotFoundError	APROBADO	03/11/2026 18:24	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-15	Validación de contrato de salida con DesactivarPatrullaResponseSchema en Zod	Contrato / Schema	Unit / Zod	Alta	Objeto de respuesta de baja lógica	DesactivarPatrullaResponseSchema.safeParse(payloadBaja)	Validación exitosa exigiendo activo booleano, estado canónico, eliminadoEn y personalLiberadoIds	Esquema valida payloads conformes y rechaza respuestas sin el campo booleano activo	APROBADO	03/11/2026 18:24	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-16	Emisión de eventos WebSocket patrulla:desactivada, patrulla:actualizada y recurso:actualizado en tiempo real	Tiempo Real / Socket.io	Service / Socket	Alta	Baja lógica exitosa de patrulla con vehículo asignado	Ejecución de desactivarPatrullaService	Se invocan notificarPatrullaDesactivada, notificarPatrullaActualizada y emitirRecursoActualizado hacia las salas operacionales	Los 3 eventos Socket.io se emiten con los payloads esperados	APROBADO	03/11/2026 18:24	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-17	Estructura DDL e idempotencia (up y down) de columnas activo y eliminado_por_id e índices en patrulla_verificadora	Base de Datos	Migración Kysely	Alta	Esquema PostgreSQL con tabla patrulla_verificadora	Ejecución de up(db) y down(db) de la migración de baja lógica	Agrega columnas activo (DEFAULT true) y eliminado_por_id (REFERENCES usuario(id) ON DELETE SET NULL) e índices idx_patrulla_activo e idx_patrulla_eliminado_por	Sentencias DDL idempotentes con IF NOT EXISTS y rollback limpio en down	APROBADO	03/11/2026 18:24	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-18	Registro y exposición del endpoint DELETE /api/patrullas/{id} en la especificación pública GET /openapi.json	Contrato OpenAPI	OpenAPI 3.0	Alta	Generador OpenAPI en src/lib/openapi/index.ts	GET /openapi.json	spec.paths["/api/patrullas/{id}"].delete registrado con códigos 200, 400, 401, 403, 404, 409 y 500 y esquema DesactivarPatrullaResponse	Endpoint y esquemas exportados en /openapi.json versión 0.10.0	APROBADO	03/11/2026 18:25	-	merge: resolver conflictos con develop integrando openapi de cuadrillas (H81) y patrullas (HU-84/HU-85)
CP-H85-API-19	Manejo controlado de excepciones inesperadas de base de datos retornando HTTP 500 Internal Server Error	Robustez / Error Handling	Route Handler	Media	Fallo no controlado en capa de persistencia	Excepción genérica en desactivarPatrullaService	HTTP 500 Internal Server Error con mensaje "Error interno del servidor al desactivar la patrulla verificadora." sin filtrar trazas SQL	Captura segura en bloque catch de DELETE en route.ts	APROBADO	03/11/2026 18:25	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
CP-H85-API-20	Ejecución íntegra de la suite automatizada de pruebas unitarias del módulo de patrullas en Vitest	Automatización	Unit / Integration	Alta	Suite Vitest configurada en sgrai-api	npm test -- src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts src/app/api/patrullas/__tests__/route.test.ts	74/74 pruebas unitarias de patrullas aprobadas sin errores	74/74 tests pasando en 80ms	APROBADO	03/11/2026 18:25	-	feat(patrullas): implementar endpoint DELETE /api/patrullas/[id] para baja logica de patrullas verificadoras (HU-85)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest

#### 5.1.1 Suite Completa del Módulo de Patrullas y Contrato OpenAPI
```bash
npm test -- src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts src/app/api/patrullas/__tests__/route.test.ts src/app/openapi.json/__tests__/route.test.ts
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts (21 tests) 19ms
 ✓ src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts (18 tests) 20ms
 ✓ src/app/api/patrullas/__tests__/route.test.ts (35 tests) 41ms
 ✓ src/app/openapi.json/__tests__/route.test.ts (1 test) 123ms

 Test Files  4 passed (4)
      Tests  75 passed (75)
   Start at  18:25:02
   Duration  929ms (transform 502ms, setup 0ms, collect 1.50s, tests 202ms, environment 1ms, prepare 327ms)
```

#### 5.1.2 Ejecución Focalizada por Casos de HU-85 (`-t`)
```bash
npx vitest run src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts -t "desactivarPatrullaService \(HU-85\)"
npx vitest run src/app/api/patrullas/__tests__/route.test.ts -t "DELETE /api/patrullas/\[id\] \(HU-85\)"
npx vitest run src/modules/recursos-y-personal/__tests__/patrulla.schema.test.ts -t "DesactivarPatrullaResponseSchema \(HU-85\)"
```

---

### 5.2 Pruebas Replicables de Contrato HTTP mediante cURL (`DELETE /api/patrullas/[id]`)

#### Caso 1: Rechazo por Falta de Autenticación (`401 Unauthorized` — `CP-H85-API-10`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "message": "No autenticado: Se requiere cabecera Authorization Bearer o X-User-Id válida."
}
```

#### Caso 2: Rechazo por Parámetro UUID Inválido (`400 Bad Request` — `CP-H85-API-13`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/id-no-valido" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "message": "Identificador de patrulla inválido.",
  "errors": [
    {
      "campo": "id",
      "mensaje": "El identificador de la patrulla debe ser un UUID válido."
    }
  ]
}
```

#### Caso 3: Rechazo por Falta de Permisos RBAC (`403 Forbidden` — `CP-H85-API-11`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000002"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "message": "Acceso denegado. Se requiere el perfil de Administrador."
}
```

#### Caso 4: Bloqueo Operativo por Patrulla en Estado `EN_VERIFICACION` (`409 Conflict` — `CP-H85-API-02`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "No es posible desactivar la patrulla verificadora 'Patrulla Rápida Costa-1' porque se encuentra actualmente en terreno en estado 'EN_VERIFICACION'."
}
```

#### Caso 5: Bloqueo Operativo por Misión Táctica Activa en Curso (`409 Conflict` — `CP-H85-API-03`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "message": "No es posible desactivar la patrulla verificadora 'Patrulla Rápida Costa-1' porque cuenta con misiones tácticas activas en curso (MIS-2026-0001)."
}
```

#### Caso 6: Baja Lógica Exitosa y Liberación de Vehículo y Personal (`200 OK` — `CP-H85-API-01`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000002" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Patrulla verificadora desactivada exitosamente.",
  "data": {
    "id": "f1000000-0000-4000-8000-000000000002",
    "codigo": "PV-CENTROSUR-01",
    "nombre": "Patrulla Centro-Sur 1",
    "estado": "NO_DISPONIBLE",
    "activo": false,
    "eliminadoEn": "2026-11-03T21:20:00.000Z",
    "eliminadoPorId": "00000000-0000-4000-8000-000000000001",
    "vehiculoLiberadoId": "e1000000-0000-4000-8000-000000000002",
    "personalLiberadoIds": [
      "b1000000-0000-4000-8000-000000000001"
    ]
  }
}
```

#### Caso 7: Rechazo por Patrulla Inexistente o Previamente Desactivada (`404 Not Found` — `CP-H85-API-14`)
```bash
curl -s -i -X DELETE "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000002" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "message": "La patrulla verificadora con ID 'f1000000-0000-4000-8000-000000000002' no existe o ya ha sido desactivada."
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Backend (`sgrai-api`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** En el panel de administración, debe proveerse la acción 'Desactivar Patrulla'. | `CP-H85-API-01`, `CP-H85-API-12`, `CP-H85-API-18` | 🟢 **CUMPLIDO** | Endpoint `DELETE /api/patrullas/[id]` expuesto y registrado en `/openapi.json` con control de acceso RBAC (`recursos:eliminar` / rol `Administrador`). |
| **CA-2:** Modal de confirmación advirtiendo sobre el impacto de la acción. | `CP-H85-API-08`, `BUG-H85-API-04` | 🟡 **PARCIAL** | `GET /api/patrullas/[id]` provee los datos previos a la baja para poblar el modal, pero tras la baja bloquea la consulta histórica con `404` y omite `activo` / `eliminadoEn` (`BUG-H85-API-04`). |
| **CA-3:** La API debe rechazar la baja con `409 Conflict` si la patrulla se encuentra en estado `EN_VERIFICACION` o posee misiones activas. | `CP-H85-API-02`, `CP-H85-API-03`, `BUG-H85-API-01` | 🔴 **CON DEFECTO (`BUG-H85-API-01`)** | Bloquea `EN_VERIFICACION` y misiones en curso, pero no valida los demás estados de despliegue en terreno (`EN_PREVENCION`, `EN_RECUPERACION`, `EN_MISION`) ni aplica `SELECT ... FOR UPDATE` dentro de la transacción. |
| **CA-4:** Si no posee misiones activas, se aplica baja lógica: `activo = false` y `eliminado_en = CURRENT_TIMESTAMP`. | `CP-H85-API-04`, `CP-H85-API-07`, `CP-H85-API-17`, `BUG-H85-API-03`, `BUG-H85-API-06` | 🔴 **CON DEFECTO (`BUG-H85-API-03`, `BUG-H85-API-06`)** | Aplica `activo = false`, `eliminado_en = CURRENT_TIMESTAMP` y `eliminado_por_id`, pero sobrescribe `vehiculo_id = null` en `patrulla_verificadora` y su migración `032_` colisiona con `032_cuadrilla_baja_logica_activo.ts` de HU-82. |
| **CA-5:** El vehículo y personal asignados deben quedar liberados a disponibilidad en el inventario comunal. | `CP-H85-API-05`, `CP-H85-API-06`, `CP-H85-API-16`, `BUG-H85-API-02` | 🔴 **CON DEFECTO (`BUG-H85-API-02`)** | Libera el vehículo a `DISPONIBLE` (`cantidad_en_uso = 0`), pero omite liberar a `usuario_lider_id` si no está en `patrulla_personal` y sobrescribe incondicionalmente `usuario.estado_operativo = 'disponible'` sin verificar inactividad, licencias u otras unidades activas. |
