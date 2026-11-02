# Informe y Matriz de Casos de Prueba (QA): HU-84 — Modificar Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Operaciones ICS — Equipos de Evaluación y Verificación de Terreno).  
> **Historia de Usuario:** HU-84 — *"Como Administrador Quiero modificar la delegación base, vehículo o personal asignado a una patrulla verificadora registrada Para adecuar la composición del equipo verificador ante rotaciones o mantenimiento vehicular."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/h84-editar-patrulla`  
> **Desarrollador Asignado:** Cristóbal Veas  
> **QA Lead Responsable:** Antigravity QA Lead / Equipo de Control de Calidad SGRAI  
> **Commits Clave Evaluados (Conventional Commits):**
> * `merge: rama 'feature/h84-editar-patrulla' de github.com:sgrai-uach/api hacia feature/h84-editar-patrulla`
> * `merge: sincronizar con develop y resolver conflictos en openapi y patrullas`
> * `feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)`
> * `fix(patrullas): corregir tipos e incompatibilidades zod para build de produccion`
> * `docs(api): documentar endpoint POST /api/patrullas y eventos socket en recursos-y-personal.md (HU-83)`
> * `feat(patrullas): implementar alta de patrullas verificadoras con validacion zod, rbac y socket (HU-83)`
> * `refactor(db): renombrar migracion de patrullas verificadoras a 026`
>
> **Fecha de Auditoría Inicial:** 29/10/2026.  
> **Fecha de Ejecución de Re-Test:** 02/11/2026 12:05.  
> **Estado de Certificación QA:** 🔴 **RE-TEST FALLIDO / CHANGES STILL REQUESTED (5 Defectos Persisten — Solo se realizó merge con develop)**.

---

## 1. Resumen Ejecutivo de Auditoría de Código, Pruebas y Re-Test

Tras completar la inspección forense de arquitectura, base de datos relacional (PostgreSQL + PostGIS), contratos OpenAPI y ejecución de suites automatizadas de pruebas en la rama `feature/h84-editar-patrulla`, se determinó inicialmente que la entrega técnica **NO CUMPLÍA con los estándares de calidad, integridad de datos e invariantes operacionales del Sistema de Comando de Incidentes (ICS)**.

### Resultado de la Re-Evaluación Técnica (Re-Test — 02/11/2026):
Ante la notificación del desarrollador respecto a la realización de cambios para subsanar los defectos, el equipo de QA procedió a una auditoría exhaustiva del árbol de trabajo y del historial Git. Se constató que los commits incorporados por el desarrollador (`f09e246` y `9133063`) corresponden **exclusivamente a una sincronización con la rama `develop` (resolución de conflictos de merge con HU-81 y compatibilidad de esquema con la migración 025)**, sin haber implementado ninguna modificación en el código fuente de `src/` para corregir los 5 defectos reportados.

Por consiguiente, los **5 defectos reales continúan abiertos y reproducibles** en el código fuente actual de la rama.

| Métrica de Calidad | Evaluación Inicial (29/10) | Re-Test Formal (02/11) | Estado Actual |
|---|:---:|:---:|:---:|
| **Total Casos Diseñados en Matriz** | 26 Casos | 26 Casos | 26 Casos |
| **Casos Aprobados (Passed)** | 21 | 21 | 21 Casos |
| **Defectos Abiertos / Re-Test Fallido** | 5 (`BUG-H84-API-01` a `05`) | 5 (`BUG-H84-API-01` a `05`) | 🔴 **5 Defectos Persistentes** |
| **Estado Global de la Rama** | 🔴 RECHAZADO | 🔴 **RE-TEST FALLIDO** | **Changes Still Requested** |
| **Tasa de Aprobación (% Pass)** | 80.77% | 80.77% | **80.77% (Bloqueada)** |
| **Chequeo Estático ESLint (`npm run lint`)** | 0 errores | 0 errores | Limpio |
| **Tests de Route Handler (`route.test.ts`)** | 10/10 pasados (con mocks) | 10/10 pasados (con mocks) | Pasado (Capa HTTP) |
| **Tests Unitarios de Dominio (`patrulla.service.test.ts`)** | ❌ 0% cobertura (0 tests) | ❌ 0% cobertura (0 tests) | **0% Cobertura Dominio** |
| **Subsanación de Defectos en Código Fuente** | N/A | ❌ 0/5 corregidos | **No implementados** |

---

## 2. Registro Forense de Defectos Detectados (Bugs)

A continuación se detallan los 5 defectos reales identificados en la implementación, categorizados según su impacto funcional y técnico:

### `BUG-H84-API-01`: Disociación e Inconsistencia Crítica entre `patrulla_verificadora.usuario_lider_id` y `patrulla_personal.rol_en_patrulla`
* **Severidad:** Crítica (Integridad de Datos / Lógica Operativa ICS).
* **Estado Post Re-Test (02/11/2026):** 🔴 **RE-TEST FALLIDO — Persiste en Código (Línea 599 de `patrulla.repository.ts`).**
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 597-610) y `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 464-475).
* **Descripción del Defecto:**  
  En `modificarPatrullaTransaccionalRepo`, al reinsertar la dotación de funcionarios en la tabla intermedia `patrulla_personal`, el código evalúa de manera fija:
  ```typescript
  for (let i = 0; i < idsNuevos.length; i++) {
    const personalId = idsNuevos[i];
    const esLider = i === 0; // <-- ASUNCIÓN RÍGIDA INCORRECTA
    await trx.insertInto("patrulla_personal").values({
      patrulla_id: datos.id,
      personal_id: personalId,
      rol_en_patrulla: esLider ? "LIDER" : "OPERATIVO",
      asignado_en: sql`CURRENT_TIMESTAMP`,
    }).execute();
  }
  ```
  Sin embargo, el DTO de entrada `ModificarPatrullaInputDTO` permite designar a cualquier integrante como líder mediante el parámetro `usuarioLiderId`. Si se envía una dotación `personalIds: [idFuncionarioA, idFuncionarioB]` y se indica como líder al Funcionario B (`usuarioLiderId = usuarioIdB`), ocurre lo siguiente:
  1. En `patrulla_verificadora.usuario_lider_id` se guarda el UUID de Usuario B.
  2. En `patrulla_personal`, al Funcionario A (`i = 0`) se le asigna `rol_en_patrulla = 'LIDER'`, y al Funcionario B (`i = 1`) se le asigna `rol_en_patrulla = 'OPERATIVO'`.
  3. Al consultar `GET /api/patrullas/{id}`, el objeto raíz muestra a Usuario B como líder, pero en el arreglo `integrantes` el Funcionario B figura como `OPERATIVO` y el Funcionario A como `LIDER`.
* **Comportamiento Esperado:**  
  El rol `LIDER` en `patrulla_personal` debe coincidir exactamente con el funcionario cuyo `usuario_id` sea igual a `usuarioLiderId`.
* **Sugerencia de Solución Técnica:**  
  En `patrulla.service.ts`, determinar el `personalLiderId` correspondiente al `usuarioLiderId` verificado y transferirlo en la estructura `DatosModificarPatrullaRepo`. En el repositorio, asignar `rol_en_patrulla: personalId === datos.personalLiderId ? "LIDER" : "OPERATIVO"`.

---

### `BUG-H84-API-02`: Desasignación y Pérdida Silenciosa de Vehículo Institucional al Omitir el Campo Opcional `vehiculoId`
* **Severidad:** Alta (Pérdida Involuntaria de Asignación / Regresión de Inventario).
* **Estado Post Re-Test (02/11/2026):** 🔴 **RE-TEST FALLIDO — Persiste en Código (Líneas 437-441 y 481 de `patrulla.service.ts`).**
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 412-441, 481).
* **Descripción del Defecto:**  
  En el esquema Zod `ModificarPatrullaInputSchema`, la propiedad `vehiculoId` fue definida como `.nullable().optional()`. No obstante, en la capa de servicio se implementó:
  ```typescript
  if (input.vehiculoId) {
    // Valida vehículo nuevo...
  } else {
    // Se desasigna el vehículo
    latitud = null;
    longitud = null;
  }
  ...
  await modificarPatrullaTransaccionalRepo({
    id,
    ...,
    vehiculoId: input.vehiculoId ?? null,
  });
  ```
  Si un cliente frontend envía una petición `PUT /api/patrullas/{id}` donde solo desea actualizar la delegación o el nombre (omitiendo la clave `vehiculoId`), `input.vehiculoId` es `undefined`. La condición `if (input.vehiculoId)` evalúa a `false`, cayendo en el `else` que pasa `vehiculoId: null`. En el repositorio, esto gatilla la liberación del vehículo en la tabla `recurso` (`estado = 'DISPONIBLE'`) y sobreescribe `vehiculo_id = NULL` en la patrulla. El vehículo queda desasignado sin que el usuario lo haya solicitado.
* **Comportamiento Esperado:**  
  Si `vehiculoId` no se envía (`undefined`), se debe **conservar** el vehículo previamente asignado. La desasignación vehicular solo debe proceder si el cliente envía explícitamente `vehiculoId: null`.
* **Sugerencia de Solución Técnica:**  
  Distinguir en el servicio entre `undefined` (mantener valor actual) y `null` (desasignar):
  ```typescript
  const vehiculoIdFinal = input.vehiculoId === undefined 
    ? patrullaExistente.fila.vehiculo_id 
    : input.vehiculoId;
  ```

---

### `BUG-H84-API-03`: Ausencia de Validación de Disponibilidad Operativa de Funcionarios Reasignados (Colisión de Dotaciones)
* **Severidad:** Alta (Violación de Reglas Operativas ICS / Integridad de Recursos).
* **Estado Post Re-Test (02/11/2026):** 🔴 **RE-TEST FALLIDO — Persiste en Código (Líneas 444-461 de `patrulla.service.ts`).**
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 444-461) y `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 320-335).
* **Descripción del Defecto:**  
  Al validar los `personalIds` entrantes en `modificarPatrullaService`, la función `obtenerPersonalParaPatrullaRepo` solo comprueba que el funcionario exista, que su usuario esté activo y que tenga rol `PATRULLA_VERIFICADORA`. Sin embargo, **no valida el campo `p.estado_operativo`**.  
  Si un funcionario ya se encuentra asignado a otra patrulla activa (`estado_operativo = 'en_patrulla'`), o está en una cuadrilla (`en_cuadrilla`), o desplegado en misión táctica (`en_mision`), o con licencia médica (`licencia` / `no_disponible`), el servicio permite su asignación sin objeción. La base de datos no tiene una restricción `UNIQUE` sobre `personal_id` en `patrulla_personal`, por lo que el funcionario queda duplicado en dos patrullas operativas al mismo tiempo.
* **Comportamiento Esperado:**  
  Para todo nuevo integrante que no perteneciera previamente a la patrulla modificada, se debe verificar que `p.estado_operativo === 'disponible'`. Si algún funcionario está ocupado o no disponible, debe responderse con código `409 Conflict` (o `400 Bad Request`) impidiendo la colisión de dotaciones.
* **Sugerencia de Solución Técnica:**  
  Obtener los `personal_id` que ya conformaban la patrulla (`idsPrevios`). Filtrar los nuevos postulantes (`idsNuevos.filter(id => !idsPrevios.includes(id))`) y validar que su `estado_operativo` sea `'disponible'`. Si no lo es, lanzar `ConflictError(`El funcionario '${p.nombre}' no se encuentra disponible (estado actual: ${p.estado_operativo}).`)`.

---

### `BUG-H84-API-04`: Inconsistencia Geoespacial y Persistencia de Marca Temporal Huérfana al Desasignar Vehículo
* **Severidad:** Media (Integridad Espacial PostGIS / Metadatos).
* **Estado Post Re-Test (02/11/2026):** 🔴 **RE-TEST FALLIDO — Persiste en Código (Líneas 552-558 de `patrulla.repository.ts`).**
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts` (Líneas 552-558) y `src/modules/recursos-y-personal/patrulla.service.ts` (Líneas 437-441).
* **Descripción del Defecto:**  
  Cuando un vehículo se desasigna (`vehiculoId: null`), `modificarPatrullaTransaccionalRepo` actualiza:
  ```typescript
  updateBuilder = updateBuilder.set({
    latitud: null,
    longitud: null,
    ubicacion: null,
  });
  ```
  Sin embargo, **no actualiza ni limpia la columna `ultima_actualizacion_ubicacion`**, la cual conserva un timestamp antiguo mientras las coordenadas geométricas son `NULL`. Adicionalmente, forzar la nulidad de las coordenadas solo por desvincular un vehículo destruye la georreferenciación de la patrulla si esta se encuentra operando a pie o reportando mediante su teléfono móvil institucional (`PATCH /api/patrullas/{id}`).
* **Comportamiento Esperado:**  
  Si se eliminan las coordenadas elipsoidales, la columna `ultima_actualizacion_ubicacion` debe setearse en `NULL`. Además, no se debe eliminar la geolocalización previa de la patrulla si el equipo continúa operativo en terreno.
* **Sugerencia de Solución Técnica:**  
  Setear `ultima_actualizacion_ubicacion: null` cuando las coordenadas pasen a `NULL`. Preservar las coordenadas actuales si no se provee nueva telemetría.

---

### `BUG-H84-API-05`: Ausencia Absoluta de Pruebas Unitarias de Servicio para `modificarPatrullaService` en la Capa de Dominio
* **Severidad:** Media (Deuda Técnica / Cobertura de QA).
* **Estado Post Re-Test (02/11/2026):** 🔴 **RE-TEST FALLIDO — Persiste (0 pruebas unitarias para `modificarPatrullaService`).**
* **Módulo / Archivo Afectado:** `src/modules/recursos-y-personal/__tests__/patrulla.service.test.ts`.
* **Descripción del Defecto:**  
  La suite de pruebas unitarias `patrulla.service.test.ts` contiene 13 tests, pero **ninguno** de ellos prueba la función `modificarPatrullaService`. La cobertura se limitó a `route.test.ts`, donde todas las reglas de negocio del servicio fueron mockeadas (`vi.spyOn(patrullaService, "modificarPatrullaService")`).  
  Como consecuencia, la lógica de negocio pura (bloqueo por estado `EN_VERIFICACION`, bloqueo por misión activa, validación de vehículo ocupado, verificación de rol de funcionarios, asignación de líder y llamadas transaccionales) carece de validación automatizada en la capa de servicio.
* **Comportamiento Esperado:**  
  Debe existir un bloque `describe("modificarPatrullaService (HU-84)", ...)` con al menos 8 tests unitarios que aíslen y certifiquen cada rama del servicio con mocks de repositorio.
* **Sugerencia de Solución Técnica:**  
  Incorporar tests unitarios en `patrulla.service.test.ts` cubriendo: caso de éxito, RBAC, 404 de patrulla/delegación/vehículo, 409 de estado `EN_VERIFICACION`, 409 de misión táctica activa, 400 de funcionarios sin rol y 400 de líder no perteneciente a la dotación.

---

## 3. Mensaje Formal de Code Review para Mantener Rechazado el Pull Request (GitHub — Re-Test Fallido)

```markdown
## ❌ Code Review QA: Changes Still Requested (Re-Test Fallido) — HU-84 (Modificar Patrulla Verificadora)

Estimado @CristobalVeas,

He realizado la re-evaluación técnica formal (Re-Test) sobre la rama `feature/h84-editar-patrulla` tras el aviso de cambios.

Al auditar el historial de commits y el diff de la rama, se observa que los últimos commits incorporados (`f09e246` y `9133063`):
* Corresponden **únicamente a sincronización con develop** (`merge: sincronizar con develop y resolver conflictos en openapi y patrullas`) para absorber los cambios de HU-81 y la migración 025.
* **No incluyeron código de solución para ninguno de los 5 defectos reportados en la auditoría técnica de QA.**

Tras ejecutar nuevamente las pruebas y auditar el código fuente en `src/modules/recursos-y-personal/`, se confirma que **los 5 defectos persisten abiertos y reproducibles**:

1. **`BUG-H84-API-01` (Crítica):** En `patrulla.repository.ts` (L. 599), `const esLider = i === 0;` sigue asignando rígidamente el rol `LIDER` al primer elemento del array, provocando disociación si `usuarioLiderId` apunta a otro integrante.
2. **`BUG-H84-API-02` (Alta):** En `patrulla.service.ts` (L. 437-441, 481), si se omite `vehiculoId` (`undefined`), el servicio lo evalúa como falso y pasa `vehiculoId: null`, desasignando y liberando el vehículo involuntariamente en el inventario.
3. **`BUG-H84-API-03` (Alta):** En `patrulla.service.ts` (L. 444-461), sigue sin validarse `p.estado_operativo === 'disponible'` en el personal nuevo entrante, permitiendo doble dotación de funcionarios.
4. **`BUG-H84-API-04` (Media):** En `patrulla.repository.ts` (L. 552-558), al desasignar vehículo se limpian latitud/longitud pero no se resetea `ultima_actualizacion_ubicacion`.
5. **`BUG-H84-API-05` (Media):** En `patrulla.service.test.ts`, siguen habiendo **0 pruebas unitarias** para `modificarPatrullaService`.

### 🛠️ Acciones Requeridas para Aprobar el Pull Request:
Por favor aplica los fixes directamente en `src/modules/recursos-y-personal/` con Conventional Commits descriptivos (ej. `fix(patrullas): ...` y `test(patrullas): ...`) y avísame para ejecutar el re-test definitivo y emitir la certificación QA aprobada.
```

---

## 4. Matriz Consolidada de Casos de Prueba (13 Columnas)

A continuación se presenta la matriz oficial en el formato tabular institucional de 13 columnas. Los defectos detectados se listan al inicio con estado `RE-TEST FALLIDO (ABIERTO)`, documentando la persistencia de las no conformidades tras la auditoría técnica de Re-Test:

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H84-API-01` | Inconsistencia crítica entre patrulla_verificadora.usuario_lider_id y patrulla_personal.rol_en_patrulla | Integridad / Regla de Negocio | Repositorio / DAL | Crítica | Patrulla registrada con dotación de 2 o más funcionarios | PUT /api/patrullas/[id] con usuarioLiderId apuntando al segundo integrante | Coherencia total: integrante con usuario_id del líder debe tener rol_en_patrulla = 'LIDER' | rol_en_patrulla = 'LIDER' asignado ciegamente al primer integrante (i=0) y 'OPERATIVO' al verdadero líder; persiste en L. 599 | RE-TEST FALLIDO (ABIERTO) | 29/10/2026 22:30 | 02/11/2026 12:05 | Pendiente (Re-Test Fallido - Solo sincronizó develop) |
| `BUG-H84-API-02` | Desasignación involuntaria de vehículo institucional al omitir la clave opcional vehiculoId | Integridad / Inventario | Servicio / Dominio | Alta | Patrulla con vehículo institucional previamente asignado | PUT /api/patrullas/[id] omitiendo la propiedad vehiculoId del payload JSON | Preservación del vehículo actual asignado si la propiedad no viene en la petición | El vehículo se desasigna automáticamente, liberándose en recurso y quedando vehiculo_id = NULL; persiste en L. 437 | RE-TEST FALLIDO (ABIERTO) | 29/10/2026 22:32 | 02/11/2026 12:05 | Pendiente (Re-Test Fallido - Solo sincronizó develop) |
| `BUG-H84-API-03` | Ausencia de validación de disponibilidad operativa de funcionarios permitiendo doble dotación | Validación / Negocio ICS | Servicio / Dominio | Alta | Funcionario activo asignado a otra patrulla (estado_operativo = 'en_patrulla') | PUT /api/patrullas/[id] agregando dicho funcionario a una nueva patrulla | HTTP 409 Conflict impidiendo asignar funcionarios que no estén con estado disponible | HTTP 200 OK asignando al funcionario y dejándolo simultáneamente en dos patrullas operativas; persiste en L. 444 | RE-TEST FALLIDO (ABIERTO) | 29/10/2026 22:34 | 02/11/2026 12:05 | Pendiente (Re-Test Fallido - Solo sincronizó develop) |
| `BUG-H84-API-04` | Metadatos geoespaciales huérfanos al desasignar vehículo con marca temporal activa y coordenadas nulas | Integridad / Geoespacial | DAL / PostgreSQL | Media | Patrulla con coordenadas y marca temporal de ubicación | PUT /api/patrullas/[id] con {"vehiculoId": null} | ultima_actualizacion_ubicacion fijado en NULL si se limpian las coordenadas elipsoidales | latitud y longitud pasan a NULL pero ultima_actualizacion_ubicacion retiene timestamp desactualizado; persiste en L. 552 | RE-TEST FALLIDO (ABIERTO) | 29/10/2026 22:36 | 02/11/2026 12:05 | Pendiente (Re-Test Fallido - Solo sincronizó develop) |
| `BUG-H84-API-05` | Ausencia absoluta de pruebas unitarias para modificarPatrullaService en suite de servicio | Cobertura / QA | Suite Vitest | Media | Ejecución de vitest en módulo recursos-y-personal | npm test -- patrulla.service.test.ts | Suite de pruebas unitarias cubriendo lógica aislada de modificarPatrullaService | 0 pruebas implementadas para modificarPatrullaService; cobertura de servicio se mantiene en 0% | RE-TEST FALLIDO (ABIERTO) | 29/10/2026 22:38 | 02/11/2026 12:05 | Pendiente (Re-Test Fallido - Solo sincronizó develop) |
| `CP-H84-API-01` | Modificación exitosa de patrulla verificadora disponible reasignando vehículo, delegación y personal | Funcional | API / Servicio | Crítica | Patrulla en estado DISPONIBLE y usuario con permiso recursos:editar | PUT /api/patrullas/[id] con payload completo válido y cabecera Authorization | HTTP 200 OK con mensaje de éxito y campos actualizados fidedignamente | HTTP 200 OK con objeto patrulla modificado y relaciones sincronizadas | APROBADO | 29/10/2026 22:40 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-02` | Desasignación voluntaria y explícita de vehículo institucional mediante vehiculoId en null | Regla de Negocio | Servicio / DAL | Alta | Patrulla con vehículo asignado previamente | PUT /api/patrullas/[id] enviando explícitamente {"vehiculoId": null} | HTTP 200 OK, vehículo liberado a DISPONIBLE con cantidad_en_uso = 0 y patrulla con vehiculo: null | HTTP 200 OK, recurso desvinculado y devuelto al inventario disponible | APROBADO | 29/10/2026 22:42 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-03` | Reemplazo atómico de vehículo previo por un nuevo vehículo disponible en inventario | Regla de Negocio | Servicio / BD | Alta | Vehículo actual asignado y nuevo vehículo en estado DISPONIBLE | PUT /api/patrullas/[id] con nuevo vehiculoId disponible | HTTP 200 OK, vehículo anterior liberado a DISPONIBLE y nuevo vehículo marcado ASIGNADO | HTTP 200 OK, transición transaccional correcta de inventario de recursos | APROBADO | 29/10/2026 22:44 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-04` | Sincronización de funcionarios liberando a salientes y activando a nuevos integrantes | Regla de Negocio | Servicio / DAL | Alta | Dotación previa registrada en tabla intermedia patrulla_personal | PUT /api/patrullas/[id] con personalIds reemplazando integrantes | Funcionarios salientes pasan a 'disponible' y nuevos pasan a 'en_patrulla' | Estados operativos de personal actualizados atómicamente | APROBADO | 29/10/2026 22:46 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-05` | Asignación automática del primer funcionario como líder cuando se omite usuarioLiderId | Funcional / Default | Servicio / Dominio | Media | Lista de personalIds válida y usuarioLiderId omitido o nulo | PUT /api/patrullas/[id] con usuarioLiderId omitido | HTTP 200 OK asignando como líder al usuario del primer funcionario de personalIds | HTTP 200 OK asignando al primer integrante como líder por defecto | APROBADO | 29/10/2026 22:48 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-06` | Registro y persistencia fidedigna de auditoría temporal actualizado_en en cada edición | Auditoría / BD | Base de Datos | Alta | Patrulla existente en base de datos PostgreSQL | Ejecutar PUT /api/patrullas/[id] y verificar actualizado_en | actualizado_en actualizado a CURRENT_TIMESTAMP posterior a la fecha anterior | Columna actualizado_en actualizada con la marca temporal UTC del momento de edición | APROBADO | 29/10/2026 22:50 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-07` | Emisión reactiva en tiempo real del evento Socket.io patrulla:actualizada a salas operativas | Tiempo Real / Red | Socket.io / Eventos | Alta | Servidor WebSocket activo con clientes suscritos | PUT /api/patrullas/[id] ejecutado exitosamente | Evento "patrulla:actualizada" emitido a salas "encargado", "supervisor" y "mapa" | Evento emitido a las salas de centro de mando y supervisor | APROBADO | 29/10/2026 22:52 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-08` | Bloqueo estricto con HTTP 409 Conflict si la patrulla se encuentra en estado EN_VERIFICACION | Regla de Negocio ICS | Servicio / Dominio | Crítica | Patrulla registrada con estado = 'EN_VERIFICACION' | PUT /api/patrullas/[id] intentando modificar cualquier atributo | HTTP 409 Conflict con mensaje descriptivo bloqueando la edición | HTTP 409 Conflict: "No es posible modificar una patrulla verificadora que se encuentra en estado 'EN_VERIFICACION'..." | APROBADO | 29/10/2026 22:54 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-09` | Bloqueo estricto con HTTP 409 Conflict si la patrulla cuenta con una misión activa en terreno | Regla de Negocio ICS | Servicio / Dominio | Crítica | Patrulla con misión en estado PLANIFICADA, DESPACHADA o EN_CURSO | PUT /api/patrullas/[id] intentando modificar dotación | HTTP 409 Conflict impidiendo modificar equipo en misión táctica en curso | HTTP 409 Conflict bloqueando la alteración de la patrulla durante misión activa | APROBADO | 29/10/2026 22:56 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-10` | Bloqueo con HTTP 409 Conflict al intentar asignar un vehículo no disponible o ya asignado | Regla de Negocio | Servicio / Dominio | Alta | Recurso vehicular con estado = 'ASIGNADO' o cantidad_en_uso > 0 | PUT /api/patrullas/[id] con vehiculoId ocupado por otra dotación | HTTP 409 Conflict: "El vehículo institucional '...' no se encuentra disponible..." | HTTP 409 Conflict bloqueando la doble asignación de vehículos | APROBADO | 29/10/2026 22:58 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-11` | Rechazo con HTTP 400 Bad Request si el recurso vehicular asignado no es de tipo individual | Validación / Regla | Servicio / Dominio | Alta | Recurso con es_individual = false (ej. cono o chaleco a granel) | PUT /api/patrullas/[id] con UUID de recurso a granel | HTTP 400 Bad Request: "El recurso '...' no es un recurso individual..." | HTTP 400 Bad Request denegando asignación de suministros a granel como vehículo | APROBADO | 29/10/2026 23:00 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-12` | Rechazo con HTTP 400 Bad Request si algún funcionario carece del rol PATRULLA_VERIFICADORA | Validación / RBAC | Servicio / Dominio | Alta | Funcionario registrado pero con rol BRIGADISTA o SUPERVISOR | PUT /api/patrullas/[id] incluyendo dicho funcionario en personalIds | HTTP 400 Bad Request listando los funcionarios sin rol operativo de patrulla | HTTP 400 Bad Request: "Los siguientes funcionarios no cuentan con el rol operativo 'PATRULLA_VERIFICADORA'..." | APROBADO | 29/10/2026 23:02 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-13` | Rechazo con HTTP 400 Bad Request si el líder designado no pertenece a la dotación asignada | Validación / Consistencia | Servicio / Dominio | Alta | Dotación personalIds no contiene al usuario especificado en usuarioLiderId | PUT /api/patrullas/[id] con usuarioLiderId ajeno a la lista de personal | HTTP 400 Bad Request: "El funcionario designado como líder debe pertenecer a la dotación..." | HTTP 400 Bad Request rechazando designación de líder externo | APROBADO | 29/10/2026 23:04 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-14` | Rechazo con HTTP 400 Bad Request si personalIds está vacío según validación Zod | Validación (Zod) | API / Schema | Media | Servidor API en ejecución | PUT /api/patrullas/[id] con personalIds: [] | HTTP 400 Bad Request detallando que debe asignar al menos un funcionario | HTTP 400 Bad Request con array de errores indicando campo objetado | APROBADO | 29/10/2026 23:06 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-15` | Rechazo con HTTP 400 Bad Request si el parámetro de ruta :id no es un UUID válido | Validación (Zod) | API / Route | Media | Parámetro de ruta malformado | PUT /api/patrullas/id-no-valido | HTTP 400 Bad Request con mensaje: "Identificador de patrulla inválido." | HTTP 400 Bad Request capturado en capa de route handler | APROBADO | 29/10/2026 23:08 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-16` | Rechazo con HTTP 400 Bad Request si el cuerpo de la petición no es JSON válido | Robustez API | API / Route | Media | Payload con sintaxis malformada o texto plano | PUT /api/patrullas/[id] con body "texto-invalido" | HTTP 400 Bad Request con mensaje: "El cuerpo de la petición debe ser un JSON válido." | HTTP 400 Bad Request capturado limpiamente en bloque try/catch | APROBADO | 29/10/2026 23:10 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-17` | Denegación con HTTP 401 Unauthorized ante peticiones sin credenciales de autenticación | Seguridad | API / AuthGuard | Crítica | Petición sin cabecera Authorization ni X-User-Id | PUT /api/patrullas/[id] sin cabeceras de identidad | HTTP 401 Unauthorized denegando acceso anónimo | HTTP 401 Unauthorized con mensaje de error de autenticación | APROBADO | 29/10/2026 23:12 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-18` | Denegación con HTTP 403 Forbidden para usuarios sin rol Administrador ni permiso recursos:editar | Seguridad (RBAC) | Servicio / RBAC | Crítica | Usuario autenticado con rol Informante o Call Center | PUT /api/patrullas/[id] con usuario sin permiso recursos:editar | HTTP 403 Forbidden con mensaje de denegación de privilegios | HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador..." | APROBADO | 29/10/2026 23:14 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-19` | Retorno de HTTP 404 Not Found si la patrulla verificadora no existe o fue eliminada | Manejo de Errores | DAL / Servicio | Media | UUID aleatorio válido no existente en tabla patrulla_verificadora | PUT /api/patrullas/00000000-0000-4000-8000-999999999999 | HTTP 404 Not Found: "La patrulla verificadora con ID '...' no existe o ha sido eliminada." | HTTP 404 Not Found devuelto al no encontrar el registro | APROBADO | 29/10/2026 23:16 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-20` | Retorno de HTTP 404 Not Found si la delegación municipal o vehículo no existen en catálogo | Manejo de Errores | DAL / Servicio | Media | delegacionId o vehiculoId con UUID inexistente en BD | PUT /api/patrullas/[id] con delegacionId o vehiculoId no registrados | HTTP 404 Not Found indicando entidad municipal o recurso faltante | HTTP 404 Not Found impidiendo vinculación a llaves foráneas huérfanas | APROBADO | 29/10/2026 23:18 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |
| `CP-H84-API-21` | Verificación de contrato OpenAPI 3.0 para la ruta PUT /api/patrullas/{id} y esquemas DTO | Contrato de API | OpenAPI / Spec | Alta | Servidor API levantado | Consulta a spec OpenAPI generado automáticamente | Ruta PUT /api/patrullas/{id} documentada con tag Recursos y Personal y schemas Zod | Contrato OpenAPI sincronizado con códigos de respuesta 200, 400, 401, 403, 404, 409 y 500 | APROBADO | 29/10/2026 23:20 | - | feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84) |

---

## 5. Bloque TSV para Google Sheets (Copiar y Pegar en celda A1)

A continuación se incluye el bloque TSV listo para copiar y pegar directamente con un solo clic en la celda **A1** de Google Sheets:

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H84-API-01	Inconsistencia crítica entre patrulla_verificadora.usuario_lider_id y patrulla_personal.rol_en_patrulla	Integridad / Regla de Negocio	Repositorio / DAL	Crítica	Patrulla registrada con dotación de 2 o más funcionarios	PUT /api/patrullas/[id] con usuarioLiderId apuntando al segundo integrante	Coherencia total: integrante con usuario_id del líder debe tener rol_en_patrulla = 'LIDER'	rol_en_patrulla = 'LIDER' asignado ciegamente al primer integrante (i=0) y 'OPERATIVO' al verdadero líder; persiste en L. 599	RE-TEST FALLIDO (ABIERTO)	29/10/2026 22:30	02/11/2026 12:05	Pendiente (Re-Test Fallido - Solo sincronizó develop)
BUG-H84-API-02	Desasignación involuntaria de vehículo institucional al omitir la clave opcional vehiculoId	Integridad / Inventario	Servicio / Dominio	Alta	Patrulla con vehículo institucional previamente asignado	PUT /api/patrullas/[id] omitiendo la propiedad vehiculoId del payload JSON	Preservación del vehículo actual asignado si la propiedad no viene en la petición	El vehículo se desasigna automáticamente, liberándose en recurso y quedando vehiculo_id = NULL; persiste en L. 437	RE-TEST FALLIDO (ABIERTO)	29/10/2026 22:32	02/11/2026 12:05	Pendiente (Re-Test Fallido - Solo sincronizó develop)
BUG-H84-API-03	Ausencia de validación de disponibilidad operativa de funcionarios permitiendo doble dotación	Validación / Negocio ICS	Servicio / Dominio	Alta	Funcionario activo asignado a otra patrulla (estado_operativo = 'en_patrulla')	PUT /api/patrullas/[id] agregando dicho funcionario a una nueva patrulla	HTTP 409 Conflict impidiendo asignar funcionarios que no estén con estado disponible	HTTP 200 OK asignando al funcionario y dejándolo simultáneamente en dos patrullas operativas; persiste en L. 444	RE-TEST FALLIDO (ABIERTO)	29/10/2026 22:34	02/11/2026 12:05	Pendiente (Re-Test Fallido - Solo sincronizó develop)
BUG-H84-API-04	Metadatos geoespaciales huérfanos al desasignar vehículo con marca temporal activa y coordenadas nulas	Integridad / Geoespacial	DAL / PostgreSQL	Media	Patrulla con coordenadas y marca temporal de ubicación	PUT /api/patrullas/[id] con {"vehiculoId": null}	ultima_actualizacion_ubicacion fijado en NULL si se limpian las coordenadas elipsoidales	latitud y longitud pasan a NULL pero ultima_actualizacion_ubicacion retiene timestamp desactualizado; persiste en L. 552	RE-TEST FALLIDO (ABIERTO)	29/10/2026 22:36	02/11/2026 12:05	Pendiente (Re-Test Fallido - Solo sincronizó develop)
BUG-H84-API-05	Ausencia absoluta de pruebas unitarias para modificarPatrullaService en suite de servicio	Cobertura / QA	Suite Vitest	Media	Ejecución de vitest en módulo recursos-y-personal	npm test -- patrulla.service.test.ts	Suite de pruebas unitarias cubriendo lógica aislada de modificarPatrullaService	0 pruebas implementadas para modificarPatrullaService; cobertura de servicio se mantiene en 0%	RE-TEST FALLIDO (ABIERTO)	29/10/2026 22:38	02/11/2026 12:05	Pendiente (Re-Test Fallido - Solo sincronizó develop)
CP-H84-API-01	Modificación exitosa de patrulla verificadora disponible reasignando vehículo, delegación y personal	Funcional	API / Servicio	Crítica	Patrulla en estado DISPONIBLE y usuario con permiso recursos:editar	PUT /api/patrullas/[id] con payload completo válido y cabecera Authorization	HTTP 200 OK con mensaje de éxito y campos actualizados fidedignamente	HTTP 200 OK con objeto patrulla modificado y relaciones sincronizadas	APROBADO	29/10/2026 22:40	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-02	Desasignación voluntaria y explícita de vehículo institucional mediante vehiculoId en null	Regla de Negocio	Servicio / DAL	Alta	Patrulla con vehículo asignado previamente	PUT /api/patrullas/[id] enviando explícitamente {"vehiculoId": null}	HTTP 200 OK, vehículo liberado a DISPONIBLE con cantidad_en_uso = 0 y patrulla con vehiculo: null	HTTP 200 OK, recurso desvinculado y devuelto al inventario disponible	APROBADO	29/10/2026 22:42	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-03	Reemplazo atómico de vehículo previo por un nuevo vehículo disponible en inventario	Regla de Negocio	Servicio / BD	Alta	Vehículo actual asignado y nuevo vehículo en estado DISPONIBLE	PUT /api/patrullas/[id] con nuevo vehiculoId disponible	HTTP 200 OK, vehículo anterior liberado a DISPONIBLE y nuevo vehículo marcado ASIGNADO	HTTP 200 OK, transición transaccional correcta de inventario de recursos	APROBADO	29/10/2026 22:44	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-04	Sincronización de funcionarios liberando a salientes y activando a nuevos integrantes	Regla de Negocio	Servicio / DAL	Alta	Dotación previa registrada en tabla intermedia patrulla_personal	PUT /api/patrullas/[id] con personalIds reemplazando integrantes	Funcionarios salientes pasan a 'disponible' y nuevos pasan a 'en_patrulla'	Estados operativos de personal actualizados atómicamente	APROBADO	29/10/2026 22:46	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-05	Asignación automática del primer funcionario como líder cuando se omite usuarioLiderId	Funcional / Default	Servicio / Dominio	Media	Lista de personalIds válida y usuarioLiderId omitido o nulo	PUT /api/patrullas/[id] con usuarioLiderId omitido	HTTP 200 OK asignando como líder al usuario del primer funcionario de personalIds	HTTP 200 OK asignando al primer integrante como líder por defecto	APROBADO	29/10/2026 22:48	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-06	Registro y persistencia fidedigna de auditoría temporal actualizado_en en cada edición	Auditoría / BD	Base de Datos	Alta	Patrulla existente en base de datos PostgreSQL	Ejecutar PUT /api/patrullas/[id] y verificar actualizado_en	actualizado_en actualizado a CURRENT_TIMESTAMP posterior a la fecha anterior	Columna actualizado_en actualizada con la marca temporal UTC del momento de edición	APROBADO	29/10/2026 22:50	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-07	Emisión reactiva en tiempo real del evento Socket.io patrulla:actualizada a salas operativas	Tiempo Real / Red	Socket.io / Eventos	Alta	Servidor WebSocket activo con clientes suscritos	PUT /api/patrullas/[id] ejecutado exitosamente	Evento "patrulla:actualizada" emitido a salas "encargado", "supervisor" y "mapa"	Evento emitido a las salas de centro de mando y supervisor	APROBADO	29/10/2026 22:52	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-08	Bloqueo estricto con HTTP 409 Conflict si la patrulla se encuentra en estado EN_VERIFICACION	Regla de Negocio ICS	Servicio / Dominio	Crítica	Patrulla registrada con estado = 'EN_VERIFICACION'	PUT /api/patrullas/[id] intentando modificar cualquier atributo	HTTP 409 Conflict con mensaje descriptivo bloqueando la edición	HTTP 409 Conflict: "No es posible modificar una patrulla verificadora que se encuentra en estado 'EN_VERIFICACION'..."	APROBADO	29/10/2026 22:54	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-09	Bloqueo estricto con HTTP 409 Conflict si la patrulla cuenta con una misión activa en terreno	Regla de Negocio ICS	Servicio / Dominio	Crítica	Patrulla con misión en estado PLANIFICADA, DESPACHADA o EN_CURSO	PUT /api/patrullas/[id] intentando modificar dotación	HTTP 409 Conflict impidiendo modificar equipo en misión táctica en curso	HTTP 409 Conflict bloqueando la alteración de la patrulla durante misión activa	APROBADO	29/10/2026 22:56	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-10	Bloqueo con HTTP 409 Conflict al intentar asignar un vehículo no disponible o ya asignado	Regla de Negocio	Servicio / Dominio	Alta	Recurso vehicular con estado = 'ASIGNADO' o cantidad_en_uso > 0	PUT /api/patrullas/[id] con vehiculoId ocupado por otra dotación	HTTP 409 Conflict: "El vehículo institucional '...' no se encuentra disponible..."	HTTP 409 Conflict bloqueando la doble asignación de vehículos	APROBADO	29/10/2026 22:58	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-11	Rechazo con HTTP 400 Bad Request si el recurso vehicular asignado no es de tipo individual	Validación / Regla	Servicio / Dominio	Alta	Recurso con es_individual = false (ej. cono o chaleco a granel)	PUT /api/patrullas/[id] con UUID de recurso a granel	HTTP 400 Bad Request: "El recurso '...' no es un recurso individual..."	HTTP 400 Bad Request denegando asignación de suministros a granel como vehículo	APROBADO	29/10/2026 23:00	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-12	Rechazo con HTTP 400 Bad Request si algún funcionario carece del rol PATRULLA_VERIFICADORA	Validación / RBAC	Servicio / Dominio	Alta	Funcionario registrado pero con rol BRIGADISTA o SUPERVISOR	PUT /api/patrullas/[id] incluyendo dicho funcionario en personalIds	HTTP 400 Bad Request listando los funcionarios sin rol operativo de patrulla	HTTP 400 Bad Request: "Los siguientes funcionarios no cuentan con el rol operativo 'PATRULLA_VERIFICADORA'..."	APROBADO	29/10/2026 23:02	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-13	Rechazo con HTTP 400 Bad Request si el líder designado no pertenece a la dotación asignada	Validación / Consistencia	Servicio / Dominio	Alta	Dotación personalIds no contiene al usuario especificado en usuarioLiderId	PUT /api/patrullas/[id] con usuarioLiderId ajeno a la lista de personal	HTTP 400 Bad Request: "El funcionario designado como líder debe pertenecer a la dotación..."	HTTP 400 Bad Request rechazando designación de líder externo	APROBADO	29/10/2026 23:04	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-14	Rechazo con HTTP 400 Bad Request si personalIds está vacío según validación Zod	Validación (Zod)	API / Schema	Media	Servidor API en ejecución	PUT /api/patrullas/[id] con personalIds: []	HTTP 400 Bad Request detallando que debe asignar al menos un funcionario	HTTP 400 Bad Request con array de errores indicando campo objetado	APROBADO	29/10/2026 23:06	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-15	Rechazo con HTTP 400 Bad Request si el parámetro de ruta :id no es un UUID válido	Validación (Zod)	API / Route	Media	Parámetro de ruta malformado	PUT /api/patrullas/id-no-valido	HTTP 400 Bad Request con mensaje: "Identificador de patrulla inválido."	HTTP 400 Bad Request capturado en capa de route handler	APROBADO	29/10/2026 23:08	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-16	Rechazo con HTTP 400 Bad Request si el cuerpo de la petición no es JSON válido	Robustez API	API / Route	Media	Payload con sintaxis malformada o texto plano	PUT /api/patrullas/[id] con body "texto-invalido"	HTTP 400 Bad Request con mensaje: "El cuerpo de la petición debe ser un JSON válido."	HTTP 400 Bad Request capturado limpiamente en bloque try/catch	APROBADO	29/10/2026 23:10	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-17	Denegación con HTTP 401 Unauthorized ante peticiones sin credenciales de autenticación	Seguridad	API / AuthGuard	Crítica	Petición sin cabecera Authorization ni X-User-Id	PUT /api/patrullas/[id] sin cabeceras de identidad	HTTP 401 Unauthorized denegando acceso anónimo	HTTP 401 Unauthorized con mensaje de error de autenticación	APROBADO	29/10/2026 23:12	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-18	Denegación con HTTP 403 Forbidden para usuarios sin rol Administrador ni permiso recursos:editar	Seguridad (RBAC)	Servicio / RBAC	Crítica	Usuario autenticado con rol Informante o Call Center	PUT /api/patrullas/[id] con usuario sin permiso recursos:editar	HTTP 403 Forbidden con mensaje de denegación de privilegios	HTTP 403 Forbidden: "Acceso denegado. Se requiere el perfil de Administrador..."	APROBADO	29/10/2026 23:14	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-19	Retorno de HTTP 404 Not Found si la patrulla verificadora no existe o fue eliminada	Manejo de Errores	DAL / Servicio	Media	UUID aleatorio válido no existente en tabla patrulla_verificadora	PUT /api/patrullas/00000000-0000-4000-8000-999999999999	HTTP 404 Not Found: "La patrulla verificadora con ID '...' no existe o ha sido eliminada."	HTTP 404 Not Found devuelto al no encontrar el registro	APROBADO	29/10/2026 23:16	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-20	Retorno de HTTP 404 Not Found si la delegación municipal o vehículo no existen en catálogo	Manejo de Errores	DAL / Servicio	Media	delegacionId o vehiculoId con UUID inexistente en BD	PUT /api/patrullas/[id] con delegacionId o vehiculoId no registrados	HTTP 404 Not Found indicando entidad municipal o recurso faltante	HTTP 404 Not Found impidiendo vinculación a llaves foráneas huérfanas	APROBADO	29/10/2026 23:18	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
CP-H84-API-21	Verificación de contrato OpenAPI 3.0 para la ruta PUT /api/patrullas/{id} y esquemas DTO	Contrato de API	OpenAPI / Spec	Alta	Servidor API levantado	Consulta a spec OpenAPI generado automáticamente	Ruta PUT /api/patrullas/{id} documentada con tag Recursos y Personal y schemas Zod	Contrato OpenAPI sincronizado con códigos de respuesta 200, 400, 401, 403, 404, 409 y 500	APROBADO	29/10/2026 23:20	-	feat(patrullas): implementar endpoint PUT /api/patrullas/[id] para modificar patrulla verificadora (HU-84)
```

---

## 6. Guía Paso a Paso 100% Replicable de Ejecución de Pruebas

Para garantizar la replicabilidad técnica del reporte de aseguramiento de calidad, a continuación se detallan los comandos exactos de consola y peticiones cURL:

### 6.1 Ejecución Automatizada de Suite en Vitest
Para ejecutar las pruebas del Route Handler implementadas para HU-84:
```bash
npm test -- src/app/api/patrullas/__tests__/route.test.ts -t "PUT /api/patrullas"
```
**Salida de consola obtenida:**
```text
 ✓ src/app/api/patrullas/__tests__/route.test.ts (28 tests | 18 skipped) 52ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 200 OK y la patrulla modificada cuando los datos son válidos y tiene permiso recursos:editar 24ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 400 Bad Request si el id no es un UUID válido 5ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 400 Bad Request si el cuerpo de la petición no es JSON válido 3ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 400 Bad Request si la validación Zod falla (ej. personalIds vacío) 3ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 401 Unauthorized si el usuario no está autenticado 2ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 403 Forbidden si el usuario carece de permiso recursos:editar 3ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 404 Not Found si la patrulla, delegación o vehículo no existen 2ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 409 Conflict si la patrulla se encuentra en estado EN_VERIFICACION 2ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 409 Conflict si la patrulla cuenta con una misión activa 2ms
   ✓ Route Handlers /api/patrullas > PUT /api/patrullas/[id] (Modificar Patrulla - HU-84) > debe retornar 409 Conflict si el nuevo vehículo ya está asignado o no disponible 2ms

 Test Files  1 passed (1)
      Tests  10 passed | 18 skipped (28)
```

---

### 6.2 Comandos cURL Replicables y Respuestas JSON

#### Caso 1: Modificación Exitosa de Patrulla (`CP-H84-API-01`)
```bash
curl -X PUT "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "nombre": "Patrulla Costa 01 - Reforzada",
    "delegacionId": "30000000-0000-4000-8000-000000000003",
    "vehiculoId": "e1000000-0000-4000-8000-000000000002",
    "personalIds": [
      "b1000000-0000-4000-8000-000000000001"
    ],
    "usuarioLiderId": "c1000000-0000-4000-8000-000000000001"
  }'
```
**Respuesta HTTP `200 OK`:**
```json
{
  "message": "Patrulla verificadora modificada exitosamente.",
  "data": {
    "id": "f1000000-0000-4000-8000-000000000001",
    "codigo": "PV-COSTA-01",
    "nombre": "Patrulla Costa 01 - Reforzada",
    "estado": "DISPONIBLE",
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000003",
      "nombre": "Delegación Costa",
      "codigo": "DEL_COSTA"
    },
    "vehiculo": {
      "id": "e1000000-0000-4000-8000-000000000002",
      "nombre": "Camioneta 4x4 Navara",
      "detalles": { "patente": "CD-FG-23" },
      "estado": "ASIGNADO"
    },
    "lider": {
      "id": "c1000000-0000-4000-8000-000000000001",
      "nombre": "Juan Brigadista",
      "email": "juan@valdivia.cl"
    },
    "integrantes": [
      {
        "personalId": "b1000000-0000-4000-8000-000000000001",
        "usuarioId": "c1000000-0000-4000-8000-000000000001",
        "nombre": "Juan Brigadista",
        "rolEnPatrulla": "LIDER"
      }
    ],
    "misionActiva": null,
    "actualizadoEn": "2026-10-29T22:40:00.000Z"
  }
}
```

---

#### Caso 2: Bloqueo por Patrulla en `EN_VERIFICACION` (`CP-H84-API-08`)
```bash
curl -X PUT "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "delegacionId": "30000000-0000-4000-8000-000000000003",
    "personalIds": ["b1000000-0000-4000-8000-000000000001"]
  }'
```
**Respuesta HTTP `409 Conflict`:**
```json
{
  "message": "No es posible modificar una patrulla verificadora que se encuentra en estado 'EN_VERIFICACION' o con una misión táctica activa en terreno."
}
```

---

#### Caso 3: Bloqueo por Misión Activa en Terreno (`CP-H84-API-09`)
```bash
curl -X PUT "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000002" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "delegacionId": "30000000-0000-4000-8000-000000000001",
    "personalIds": ["b1000000-0000-4000-8000-000000000001"]
  }'
```
**Respuesta HTTP `409 Conflict`:**
```json
{
  "message": "No es posible modificar una patrulla verificadora que se encuentra en estado 'EN_VERIFICACION' o con una misión táctica activa en terreno."
}
```

---

#### Caso 4: Denegación por Falta de Permiso `recursos:editar` (`CP-H84-API-18`)
```bash
curl -X PUT "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-4000-8000-000000000004" \
  -d '{
    "delegacionId": "30000000-0000-4000-8000-000000000003",
    "personalIds": ["b1000000-0000-4000-8000-000000000001"]
  }'
```
**Respuesta HTTP `403 Forbidden`:**
```json
{
  "message": "Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."
}
```

---

#### Caso 5: Rechazo por Personal sin Rol Operativo `PATRULLA_VERIFICADORA` (`CP-H84-API-12`)
```bash
curl -X PUT "http://localhost:3000/api/patrullas/f1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
  -d '{
    "delegacionId": "30000000-0000-4000-8000-000000000003",
    "personalIds": ["b1000000-0000-4000-8000-000000000099"]
  }'
```
**Respuesta HTTP `400 Bad Request`:**
```json
{
  "message": "Los siguientes funcionarios no cuentan con el rol operativo 'PATRULLA_VERIFICADORA': Pedro Cuadrilla."
}
```

---

## 7. Matriz de Trazabilidad de Criterios de Aceptación (CA)

| Criterio de Aceptación (HU-84) | Casos de Prueba Vinculados | Estado de Cobertura | Dictamen QA |
|---|---|:---:|---|
| **CA-01:** En listado y detalle debe existir la acción 'Editar Patrulla' | `CP-H84-API-01`, `CP-H84-API-21` | 🟡 Parcial | Endpoint `PUT /api/patrullas/{id}` implementado en API; la acción UI corresponde a `sgrai-web`. |
| **CA-02:** Modal permite reasignar vehículo, delegación base y funcionarios asociados | `CP-H84-API-01`, `CP-H84-API-02`, `CP-H84-API-03`, `CP-H84-API-04`, `BUG-H84-API-01`, `BUG-H84-API-02`, `BUG-H84-API-03` | 🔴 Bloqueado por Bugs | Funcionalidad presente pero bloqueada por inconsistencia de líder (`BUG-01`), borrado de vehículo por omisión (`BUG-02`) y falta de validación de disponibilidad (`BUG-03`). |
| **CA-03:** Si la patrulla está en `EN_VERIFICACION` o en misión activa, bloquear con `409 Conflict` | `CP-H84-API-08`, `CP-H84-API-09` | 🟢 Cumplido | Verificado con código `HTTP 409 Conflict` tanto para estado `EN_VERIFICACION` como para misiones en curso. |
| **CA-04:** Cada edición debe registrar auditoría (`actualizado_en`) | `CP-H84-API-06`, `BUG-H84-API-04` | 🟡 Con Observaciones | Columna `actualizado_en` se actualiza correctamente, pero `BUG-H84-API-04` deja marcas temporales huérfanas en ubicación. |
| **CA-05:** El endpoint `PUT /api/patrullas/{id}` debe requerir permiso `recursos:editar` | `CP-H84-API-17`, `CP-H84-API-18` | 🟢 Cumplido | Verificado con guardia RBAC `validarAccesoAdministrador(usuarioId, [PERMISO_EDITAR_RECURSO])` respondiendo `403 Forbidden`. |

---

## 8. Conclusión y Próximos Pasos

1. **Estado del Pull Request:** 🔴 **CHANGES STILL REQUESTED (RE-TEST FALLIDO — 02/11/2026)**.
2. **Dictamen de QA:** La auditoría técnica forense determinó que los commits recientes (`f09e246`, `9133063`) únicamente sincronizaron la rama con `develop`. Los 5 defectos de backend persisten en el código fuente. La historia de usuario **HU-84 NO se encuentra certificada** para merge a `develop`.
3. **Acción Requerida del Desarrollador (@CristobalVeas):**
   * Corregir el bucle de dotación en `patrulla.repository.ts` para que `rol_en_patrulla = 'LIDER'` coincida exactamente con `usuarioLiderId`.
   * Preservar el vehículo actual si `vehiculoId === undefined` en el payload de `patrulla.service.ts`.
   * Validar disponibilidad operativa (`u.estado_operativo === 'disponible'`) para nuevos integrantes en `patrulla.service.ts`.
   * Limpiar `ultima_actualizacion_ubicacion: null` cuando las coordenadas pasen a `NULL` en `patrulla.repository.ts`.
   * Escribir la suite completa de pruebas unitarias para `modificarPatrullaService` en `patrulla.service.test.ts`.
4. **Ciclo de Re-Test Definitivo:** Una vez que el desarrollador aplique los fixes reales con sus respectivos commits en Conventional Commits (ej. `fix(patrullas): ...`), QA ejecutará la re-verificación final para otorgar la certificación verde.
