# Informe y Matriz de Casos de Prueba (QA): HU-85 — Desactivar Patrulla Verificadora (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Gestión de Patrullas Verificadoras (`sgrai-api` — `DELETE /api/patrullas/[id]`).  
> **Historia de Usuario:** HU-85 — *"Como Administrador Quiero desactivar mediante baja lógica una patrulla verificadora que ya no prestará servicios operacionales Para evitar que sea asignada a nuevas misiones de verificación, liberando sus recursos al inventario comunal y preservando el historial completo de misiones e informes técnicos en los que actuó."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + Zod + Socket.io + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H85-desactivar-patrulla`.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TEST Y SINCRONIZACIÓN CON DEVELOP)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Evaluación Inicial QA | Ciclo Re-Test / Merge Develop | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **20** | **26** | 20 funcionales/integración + 6 defectos gestionados |
| **Casos Aprobados (Passed)** | **14** | **26** | 100% de cobertura en flujos normales, extremos y de concurrencia |
| **Casos Fallidos (Failed)** | **6** | **0** | Todos los defectos subsanados en código, repositorio y base de datos |
| **Defectos Detectados y Subsanados (Bugs)** | **6 Abiertos** | **6 Subsanados** | 100% resueltos, re-testeados y certificados |
| **Tasa de Aprobación Global (% Pass)** | **70.0%** | **100.0%** | Criterios de aceptación cumplidos íntegramente |
| **Suite Automatizada de Pruebas (Vitest)** | **74 tests pass** | **83/83 tests pass (Patrullas)**<br>**707/707 tests pass (Global API)** | Módulos de Patrullas, Cuadrillas, Recursos, Seguridad y ATP probados sin regresiones |
| **Chequeo de Tipos Estáticos (TypeScript)** | **Con observaciones** | **0 errores (`npx tsc --noEmit`)** | Tipado estricto verificado en modo incremental sin emisión |
| **Encadenamiento Secuencial de Migraciones** | **Colisión (`032_`)** | **Secuencial limpia (`034_`)** | Migración encadenada tras `033_patrullas_codigo_vehiculo.ts` de `develop` |
| **Contrato OpenAPI 3.0 Centralizado** | **Sin `x-user-id`** | **100% sincronizado** | Endpoint documentado con parámetros de ruta, headers opcionales y códigos 200/400/401/403/404/409/500 |
| **Sincronización en Tiempo Real (Socket.io)** | **100% verificado** | **100% verificado** | Emisión de `patrulla:desactivada`, `patrulla:actualizada` y `recurso:actualizado` |

---

## 2. Registro de Defectos Detectados y Verificación de Re-Test

### 🔴 BUG-H85-API-01: Ausencia de Bloqueo Operativo para Estados de Terreno y Condición de Carrera TOCTOU sin `SELECT ... FOR UPDATE`
* **Severidad:** CRÍTICA | **Estado:** 🟢 **CORREGIDO Y VERIFICADO**
* **Módulo Afectado:** `src/modules/recursos-y-personal/patrulla.service.ts` y `patrulla.repository.ts`
* **Causa Raíz:** Solo se bloqueaba el estado `EN_VERIFICACION`, permitiendo dar de baja patrullas en `EN_PREVENCION`, `EN_RECUPERACION` o `EN_MISION`. Además, las consultas no adquirían bloqueo pesimista en base de datos.
* **Solución Implementada:**
  - Incorporación de `ESTADOS_PATRULLA_EN_TERRENO = ["EN_VERIFICACION", "EN_PREVENCION", "EN_RECUPERACION", "EN_MISION"]`.
  - En `desactivarPatrullaTransaccionalRepo`, adquisición de bloqueo pesimista `SELECT ... FOR UPDATE` sobre `patrulla_verificadora`.
  - Re-validación atómica dentro de la transacción (`trx`) para estados de terreno y ausencia de misiones activas en `PLANIFICADA`, `DESPACHADA` o `EN_CURSO`.
* **Evidencia:** Tests unitarios agregados en Vitest verifican rechazo con `ConflictError` ante los 4 estados de terreno y propagación de conflictos concurrentes.

---

### 🔴 BUG-H85-API-02: Liberación Incompleta del Líder y Sobrescritura Incondicional de `usuario.estado_operativo` en la Dotación
* **Severidad:** CRÍTICA | **Estado:** 🟢 **CORREGIDO Y VERIFICADO**
* **Módulo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts`
* **Causa Raíz:** La consulta no seleccionaba `usuario_lider_id` y forzaba ciegamente `estado_operativo = 'disponible'` sin evaluar si el funcionario integraba otra patrulla o cuadrilla activa, o si estaba inactivo.
* **Solución Implementada:**
  - Consolidación de integrantes de `patrulla_personal` junto con `usuario_lider_id`.
  - Mutación en `usuario` condicionada a:
    1. `usuario.activo = true`.
    2. `usuario.estado_operativo = 'en_patrulla'`.
    3. `NOT EXISTS` en otra patrulla verificadora activa (`eliminado_en IS NULL` y `id != patrullaId`, como líder o integrante).
    4. `NOT EXISTS` en una cuadrilla operativa activa (`activo = true` y `eliminado_en IS NULL`, como delegado o integrante).
* **Evidencia:** Cumplimiento de normas ICS verificado en tests de servicio y repositorio.

---

### 🟠 BUG-H85-API-03: Pérdida de Trazabilidad del Vehículo Histórico al Sobrescribir `patrulla_verificadora.vehiculo_id = null`
* **Severidad:** ALTA | **Estado:** 🟢 **CORREGIDO Y VERIFICADO**
* **Módulo Afectado:** `src/modules/recursos-y-personal/patrulla.repository.ts`
* **Causa Raíz:** Se ejecutaba `vehiculo_id: null` en la fila inactiva de `patrulla_verificadora`, destruyendo el registro de auditoría del móvil con el que operó la patrulla.
* **Solución Implementada:**
  - Se eliminó la sobreescritura `vehiculo_id: null` en la mutación de baja lógica.
  - La liberación comunal del móvil se realiza en la tabla `recurso` (`estado = 'DISPONIBLE'`, `cantidad_en_uso = 0`), garantizando que la patrulla inactiva conserve la referencia histórica a su móvil.
* **Evidencia:** Verificado en `desactivarPatrullaTransaccionalRepo` y tests de integración.

---

### 🟠 BUG-H85-API-04: Imposibilidad de Consultar o Auditar Patrullas Desactivadas en `GET /api/patrullas/[id]` (`404`) y `GET /api/patrullas`, y Omisión de `activo` / `eliminadoEn` en Schemas
* **Severidad:** ALTA | **Estado:** 🟢 **CORREGIDO Y VERIFICADO**
* **Módulo Afectado:** `patrulla.schema.ts`, `patrulla.repository.ts`, `patrulla.service.ts`
* **Causa Raíz:** `obtenerPatrullaPorIdRepo` y `listarPatrullasRepo` filtraban incondicionalmente `eliminado_en IS NULL`, imposibilitando consultar patrullas dadas de baja, y los schemas omitían metadatos de baja lógica.
* **Solución Implementada:**
  - `PatrullaItemResponseSchema` enriquecido con `activo`, `eliminadoEn` y `eliminadoPorId`.
  - `ListarPatrullasQuerySchema` extendido con `activo: z.coerce.boolean()` e `incluirInactivas: z.coerce.boolean()`.
  - `obtenerPatrullaPorIdRepo` permite consultar el detalle histórico post-baja (`GET /api/patrullas/{id}` retorna `200 OK` con `activo: false`), mientras que las mutaciones operativas (`PATCH`, `PUT`, `DELETE`) rechazan patrullas inactivas con `404 Not Found`.
* **Evidencia:** Tests en `patrulla.schema.test.ts` y `route.test.ts` para consulta de patrullas inactivas.

---

### 🟡 BUG-H85-API-05: `buscarPatrullaPorId` en Eventos ATP No Filtra `eliminado_en IS NULL` ni `activo = true`, y Desalineación Documental
* **Severidad:** MEDIA | **Estado:** 🟢 **CORREGIDO Y VERIFICADO**
* **Módulo Afectado:** `evento-prevencion.repository.ts`, `recuperacion.repository.ts`, `docs/api/recursos-y-personal.md`, `openapi/index.ts`
* **Causa Raíz:** Los módulos ATP carecían de filtro de patrulla activa, la documentación referenciaba la columna deprecada `personal.estado_operativo`, y OpenAPI no declaraba el header `x-user-id`.
* **Solución Implementada:**
  - Filtrado `.where("eliminado_en", "is", null).where("activo", "=", true)` en `buscarPatrullaPorId` de `evento-prevencion.repository.ts` y `recuperacion.repository.ts`.
  - Corrección documental en `docs/api/recursos-y-personal.md` hacia `usuario.estado_operativo` (migración 025).
  - Documentación del header opcional `x-user-id` en OpenAPI para `DELETE /api/patrullas/{id}`.
* **Evidencia:** Verificado en código de repositorios ATP y spec OpenAPI.

---

### 🟠 BUG-H85-API-06: Colisión de Numeración Secuencial de Migraciones Kysely (`032_` y `033_` Ocupadas en `develop`)
* **Severidad:** ALTA | **Estado:** 🟢 **CORREGIDO Y VERIFICADO**
* **Módulo Afectado:** `src/lib/db/migrations/034_patrulla_desactivacion_baja_logica.ts`
* **Causa Raíz:** En `develop`, la migración `032_` corresponde a `032_cuadrilla_baja_logica_activo.ts` (HU-82) y la `033_` a `033_patrullas_codigo_vehiculo.ts` (HU-83).
* **Solución Implementada:**
  - Renumeración de la migración de baja lógica de patrullas a `034_patrulla_desactivacion_baja_logica.ts`, garantizando orden determinista en `FileMigrationProvider` de Kysely.
* **Evidencia:** Secuencia de migraciones `030_`, `031_`, `032_`, `033_`, `034_` estrictamente continua y sin prefijos colisionados.

---

## 3. Matriz de Casos de Prueba Ejecutados

| ID Caso | Módulo / Componente | Descripción del Escenario | Resultado |
|---|---|---|:---:|
| `CP-H85-01` | `DELETE /api/patrullas/[id]` | Desactivación exitosa de patrulla disponible con vehículo y personal | **PASS** 🟢 |
| `CP-H85-02` | `DELETE /api/patrullas/[id]` | Rechazo con 409 Conflict si la patrulla está en `EN_VERIFICACION` | **PASS** 🟢 |
| `CP-H85-03` | `DELETE /api/patrullas/[id]` | Rechazo con 409 Conflict si la patrulla está en `EN_PREVENCION` | **PASS** 🟢 |
| `CP-H85-04` | `DELETE /api/patrullas/[id]` | Rechazo con 409 Conflict si la patrulla está en `EN_RECUPERACION` | **PASS** 🟢 |
| `CP-H85-05` | `DELETE /api/patrullas/[id]` | Rechazo con 409 Conflict si la patrulla está en `EN_MISION` | **PASS** 🟢 |
| `CP-H85-06` | `DELETE /api/patrullas/[id]` | Rechazo con 409 Conflict si tiene misiones activas en curso | **PASS** 🟢 |
| `CP-H85-07` | `DELETE /api/patrullas/[id]` | Rechazo con 404 Not Found si la patrulla no existe | **PASS** 🟢 |
| `CP-H85-08` | `DELETE /api/patrullas/[id]` | Rechazo con 404 Not Found si la patrulla ya fue desactivada | **PASS** 🟢 |
| `CP-H85-09` | `DELETE /api/patrullas/[id]` | Rechazo con 403 Forbidden si el usuario no tiene permiso `recursos:eliminar` | **PASS** 🟢 |
| `CP-H85-10` | `DELETE /api/patrullas/[id]` | Rechazo con 401 Unauthorized si no hay token de autenticación | **PASS** 🟢 |
| `CP-H85-11` | `DELETE /api/patrullas/[id]` | Rechazo con 400 Bad Request ante UUID inválido | **PASS** 🟢 |
| `CP-H85-12` | Repositorio Transaccional | Bloqueo pesimista `SELECT ... FOR UPDATE` contra condiciones de carrera | **PASS** 🟢 |
| `CP-H85-13` | Repositorio Transaccional | Liberación atómica de vehículo en tabla `recurso` (`DISPONIBLE`, en_uso=0) | **PASS** 🟢 |
| `CP-H85-14` | Repositorio Transaccional | Preservación del `vehiculo_id` en `patrulla_verificadora` post-baja | **PASS** 🟢 |
| `CP-H85-15` | Repositorio Transaccional | Liberación de personal en `usuario.estado_operativo = 'disponible'` | **PASS** 🟢 |
| `CP-H85-16` | Repositorio Transaccional | Liberación del líder (`usuario_lider_id`) a estado disponible | **PASS** 🟢 |
| `CP-H85-17` | Repositorio Transaccional | No sobreescribir funcionarios inactivos o asignados a otra unidad activa | **PASS** 🟢 |
| `CP-H85-18` | `GET /api/patrullas/[id]` | Consulta exitosa de patrulla desactivada para auditoría histórica | **PASS** 🟢 |
| `CP-H85-19` | `GET /api/patrullas` | Filtrar patrullas inactivas mediante `?activo=false` o `?incluirInactivas=true` | **PASS** 🟢 |
| `CP-H85-20` | `PATCH /api/patrullas/[id]` | Rechazar actualización de estado en patrullas desactivadas (404) | **PASS** 🟢 |
| `CP-H85-21` | `PUT /api/patrullas/[id]` | Rechazar modificación de patrullas desactivadas (404) | **PASS** 🟢 |
| `CP-H85-22` | Eventos ATP Prevención | `buscarPatrullaPorId` filtra patrullas inactivas | **PASS** 🟢 |
| `CP-H85-23` | Eventos ATP Recuperación | `buscarPatrullaPorId` filtra patrullas inactivas | **PASS** 🟢 |
| `CP-H85-24` | OpenAPI 3.0 | Schema y endpoint registrados conforme a contrato centralizado | **PASS** 🟢 |
| `CP-H85-25` | Socket.io | Notificaciones en tiempo real `patrulla:desactivada` y `recurso:actualizado` | **PASS** 🟢 |
| `CP-H85-26` | Kysely Migrator | Secuencia de migración `034_` encadenada limpiamente sobre `033_` | **PASS** 🟢 |

---

## 4. Dictamen Final de Calidad

La rama `feature/H85-desactivar-patrulla` cumple al 100% con los Criterios de Aceptación de la HU-85, las reglas del Sistema de Comando de Incidentes (ICS), la política de borrado lógico y auditoría inmutable, y los lineamientos de arquitectura de `GEMINI.md`.

**Dictamen de QA:** 🟢 **APROBADO PARA MERGE A DEVELOP**.

