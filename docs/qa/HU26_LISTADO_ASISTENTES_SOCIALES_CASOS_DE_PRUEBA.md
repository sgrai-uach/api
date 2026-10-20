# Informe y Matriz de Casos de Prueba (QA): HU-26 — Listado de Asistentes Sociales y Disponibilidad (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Asistencia Social (Operaciones ICS).  
> **Historia de Usuario:** HU-26 — *"Como Encargado Quiero visualizar en el Centro de Mando el listado de asistentes sociales disponibles y ocupadas con sus asignaciones activas Para tener el panorama completo de los recursos humanos del área social desplegados y planificar la cobertura en terreno para el levantamiento de fichas FIBE"*.  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest v3.2.7).  
> **Rama Git Evaluada:** `H26-listado-asistentes-sociales`.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Ejecutados** | **13** |
| **Casos Aprobados (Passed)** | **13** |
| **Casos Fallidos (Failed)** | **0** |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **13/13 tests específicos de HU-26** (8 unitarias schema/service + 5 integración route handler) |
| **Suite Completa del Repositorio** | **506/506 tests aprobados en 45 archivos de prueba** |
| **Compilación de Producción (Next.js Turbopack)** | **Exitosa (`npm run build`)** |
| **Contrato Centralizado OpenAPI 3.0** | **100% sincronizado en `/openapi.json` con ruta `GET /api/personal` (H26)** |
| **Migración de Optimización** | **`024_indice_asistente_social_casos.ts` sobre `evento_asistencia_social(asistente_social_id, estado)`** |

---

## 2. Matriz Consolidada de Casos de Prueba

| ID Caso | Nombre / Propósito de la Prueba | Tipo de Prueba | Capa Evaluada | Severidad | Precondición | Datos de Entrada / Query | Comportamiento Esperado | Resultado Obtenido | Estado | Commit Asociado |
|---|---|:---:|:---:|:---:|---|---|---|---|:---:|---|
| `CP-H26-API-01` | Validación de query param canónico `rolCodigo` en Zod | Unitaria | Schema | Alta | API en ejecución | `{ rolCodigo: "ASISTENTE_SOCIAL" }` | Objeto validado con `rolCodigo: "ASISTENTE_SOCIAL"` | Parsea correctamente sin errores | 🟢 APROBADO | `feat(personal): agregar soporte de filtro rolCodigo y campo casos_fibe_asignados en schema y openapi` |
| `CP-H26-API-02` | Validación de alias retrocompatible `rol_codigo` en Zod | Compatibilidad | Schema | Media | API en ejecución | `{ rol_codigo: "ASISTENTE_SOCIAL" }` | Objeto validado con `rol_codigo: "ASISTENTE_SOCIAL"` | Parsea correctamente sin errores | 🟢 APROBADO | `feat(personal): agregar soporte de filtro rolCodigo y campo casos_fibe_asignados en schema y openapi` |
| `CP-H26-API-03` | Validación de campo computado `casos_fibe_asignados` en PersonalItem | Unitaria | Schema | Alta | API en ejecución | PersonalItem con `casos_fibe_asignados: 2` | Objeto serializado con entero no negativo | Valida y tipifica correctamente | 🟢 APROBADO | `feat(personal): agregar soporte de filtro rolCodigo y campo casos_fibe_asignados en schema y openapi` |
| `CP-H26-API-04` | Propagación de filtros combinados (`rolCodigo`, `delegacionId`, `estadoOperativo`) | Unitaria | Service / Repo | Alta | Mock de repositorio | `{ rolCodigo: "ASISTENTE_SOCIAL", delegacionId: "...", estadoOperativo: "disponible" }` | Parámetros entregados íntegramente a `listarPersonalPaginadoRepo` | Repositorio llamado con los argumentos correctos | 🟢 APROBADO | `feat(personal): calcular subconsulta de casos activos en evento_asistencia_social (H26)` |
| `CP-H26-API-05` | Mapeo y sanitización de `casos_fibe_asignados` en servicio | Unitaria | Service | Media | Fila de DB con conteo numérico | Fila con `casos_fibe_asignados: 3` | Atributo transformado a `number` primitivo | `data[0].casos_fibe_asignados === 3` | 🟢 APROBADO | `feat(personal): calcular subconsulta de casos activos en evento_asistencia_social (H26)` |
| `CP-H26-API-06` | Consulta exitosa con usuario autorizado (`asistencia_social:leer`) | Integración | Route Handler | Crítica | Token con rol Encargado / Admin | `GET /api/personal?rolCodigo=ASISTENTE_SOCIAL` con Bearer token | HTTP 200 OK con lista de asistentes y conteo de casos | HTTP 200 con `casos_fibe_asignados` verificado | 🟢 APROBADO | `feat(personal): aplicar validacion rbac con permiso asistencia_social:leer en consulta de asistentes sociales (H26)` |
| `CP-H26-API-07` | Denegación con HTTP 401 si falta cabecera de autenticación para ASISTENTE_SOCIAL | Seguridad / Auth | Route Handler | Crítica | Petición sin Bearer ni x-user-id | `GET /api/personal?rolCodigo=ASISTENTE_SOCIAL` anónimo | HTTP 401 Unauthorized indicando requerimiento de sesión | HTTP 401 con mensaje estructurado | 🟢 APROBADO | `feat(personal): aplicar validacion rbac con permiso asistencia_social:leer en consulta de asistentes sociales (H26)` |
| `CP-H26-API-08` | Denegación con HTTP 403 si el rol no tiene permiso `asistencia_social:leer` | Seguridad / RBAC | Route Handler | Crítica | Usuario existente con perfil no autorizado (ej. Operario) | `GET /api/personal?rolCodigo=ASISTENTE_SOCIAL` con token sin permiso | HTTP 403 Forbidden: "No cuenta con el permiso requerido: asistencia_social:leer" | HTTP 403 bloqueando el acceso | 🟢 APROBADO | `feat(personal): aplicar validacion rbac con permiso asistencia_social:leer en consulta de asistentes sociales (H26)` |
| `CP-H26-API-09` | Preservación de selectores abiertos de personal general sin exigir RBAC social | Compatibilidad | Route Handler | Alta | Consulta de selector general | `GET /api/personal?busqueda=Perez` | HTTP 200 OK sin invocar guard de asistencia social | HTTP 200 sin verificación RBAC adicional | 🟢 APROBADO | `feat(personal): aplicar validacion rbac con permiso asistencia_social:leer en consulta de asistentes sociales (H26)` |
| `CP-H26-API-10` | Rechazo con HTTP 400 ante parámetros inválidos (UUID corrupto) | Robustez | Route Handler | Media | Query param corrupto | `GET /api/personal?delegacionId=uuid-invalido` | HTTP 400 Bad Request con detalle de issues Zod | HTTP 400 estructurado | 🟢 APROBADO | `feat(personal): agregar soporte de filtro rolCodigo y campo casos_fibe_asignados en schema y openapi` |
| `CP-H26-API-11` | Filtrado combinado por delegación territorial y estado operativo | Funcional | DB / Kysely | Alta | Asistentes en varias delegaciones | `GET /api/personal?rolCodigo=ASISTENTE_SOCIAL&delegacionId=...&estadoOperativo=disponible` | Retorna exclusivamente asistentes de la delegación y estado solicitados | HTTP 200 con filtros aplicados | 🟢 APROBADO | `feat(personal): calcular subconsulta de casos activos en evento_asistencia_social (H26)` |
| `CP-H26-API-12` | Subconsulta de casos activos excluyendo casos finalizados y borrados | DAL / Negocio | Kysely / SQL | Crítica | Asistente con casos finalizados y casos activos | Consulta de asistente con 2 casos ASIGNADO y 3 FINALIZADO | `casos_fibe_asignados` retorna 2 (omite finalizados) | Cálculo exacto de casos activos | 🟢 APROBADO | `feat(personal): calcular subconsulta de casos activos en evento_asistencia_social (H26)` |
| `CP-H26-API-13` | Verificación de generación de contrato OpenAPI 3.0 | Contrato | Route Handler | Alta | Endpoint `/openapi.json` | `GET /openapi.json` | Spec OpenAPI 3.0 con schema de `/api/personal` actualizado con `casos_fibe_asignados` y `rolCodigo` | Spec compilado y validado | 🟢 APROBADO | `feat(personal): agregar soporte de filtro rolCodigo y campo casos_fibe_asignados en schema y openapi` |

---

## 3. Verificación de Criterios de Aceptación (HU-26)

* [x] **CA-1: Consulta de nómina de asistentes sociales:** Endpoint `GET /api/personal?rolCodigo=ASISTENTE_SOCIAL` implementado con soporte de filtros.
* [x] **CA-2: Información requerida:** Retorna Nombre, Apellidos, Delegación municipal asignada, Teléfono institucional, Estado operativo (`disponible`, `en_mision`, `descanso`, `licencia`, `inactivo`) y Cantidad de casos FIBE asignados actualmente (`casos_fibe_asignados`).
* [x] **CA-3: Filtros por delegación y estado operativo:** Soportados mediante `delegacionId` y `estadoOperativo` en `ListarPersonalQuerySchema`.
* [x] **CA-4: Cómputo de casos activos:** Subconsulta optimizada correlacionada sobre `evento_asistencia_social` filtrando por estados `'ASIGNADO'` y `'EN_EVALUACION_FIBE'` donde `eliminado_en IS NULL`.
* [x] **CA-5: Seguridad RBAC:** Evaluado contra el permiso institucional `asistencia_social:leer`, permitiendo el acceso a Encargado, Administrador y Asistente Social, y rechazando con 401/403 a usuarios no autorizados.
* [x] **CA-6: Optimización de Base de Datos:** Migración `024_indice_asistente_social_casos.ts` incorporando índice compuesto sobre `evento_asistencia_social(asistente_social_id, estado)`.
