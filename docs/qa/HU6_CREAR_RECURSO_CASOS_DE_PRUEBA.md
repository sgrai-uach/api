# Informe y Matriz de Casos de Prueba (QA): HU-6 — Crear Recurso (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Logística / Operaciones ICS).  
> **Historia de Usuario:** HU-6 — *"Como Administrador Quiero crear un nuevo recurso Para que exista en el inventario logístico del sistema y pueda ser asignado a las cuadrillas o eventos de emergencia"*.  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Vitest).  
> **Rama Git:** `feature/H6-crear-recurso` (mergeada en `develop` mediante commit `9d2abc8`).  
> **Commits Clave Evaluados:** `dce6447`, `7df7a22`, `890182a`, `dccbf01`, `b5c1239`, `f327fbc`, `aca6932`, `387255b`.  
> **Fecha de Certificación QA:** Septiembre / Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **15** |
| **Casos Aprobados (Passed)** | **15** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Gestionados (Bugs)** | **5** (100% resueltos y re-testeados) |
| **Tasa de Aprobación (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **41/41 tests exitosos en recursos** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 advertencias / 0 errores** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar de Aseguramiento de Calidad (*detección de defectos durante el desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix y ejecución de re-test formal para verificación de cierre*), se gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Componente | Fecha Hallazgo | Commit del Fix | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H06-API-01` | Bloqueo de peticiones CORS desde frontend sgrai-web por ausencia de cabeceras de origen y headers. | Crítica | `next.config.ts` | 07/09/2026 15:40 | `aca6932` | 07/09/2026 16:12 | 🟢 APROBADO (Headers CORS habilitados) |
| `BUG-H06-API-02` | Error 500 no controlado ante peticiones con cuerpo no JSON o sintaxis malformada en route handler. | Alta | `src/app/api/recursos/route.ts` | 07/09/2026 13:20 | `dccbf01` | 07/09/2026 14:04 | 🟢 APROBADO (Try/catch captura JSON malformado 400) |
| `BUG-H06-API-03` | Coordenadas geográficas devueltas como cadenas de texto (strings) por el driver de PostgreSQL. | Media | `src/modules/recursos-y-personal/recurso.service.ts` | 07/09/2026 13:35 | `dccbf01` | 07/09/2026 14:04 | 🟢 APROBADO (Casteo a Number en DTO de respuesta) |
| `BUG-H06-API-04` | Ausencia de validación de rango geográfico WGS84 en esquema Zod de creación. | Alta | `src/modules/recursos-y-personal/recurso.schema.ts` | 07/09/2026 12:45 | `890182a` | 07/09/2026 13:10 | 🟢 APROBADO (Zod min/max [-90,90] y [-180,180]) |
| `BUG-H06-API-05` | Ausencia de permiso recursos:crear en matriz de permisos y control RBAC provisional. | Crítica | `src/modules/seguridad/auth.service.ts` | 07/09/2026 11:30 | `7df7a22` | 07/09/2026 12:15 | 🟢 APROBADO (Constante y verificación RBAC activa) |

---

## 3. Matriz Consolidada de Casos de Prueba (Formato Planilla / Google Sheets)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H06-API-01` | Bloqueo de peticiones CORS desde frontend sgrai-web por ausencia de cabeceras de origen y headers | Integración / Red | API / Config | Crítica | API en puerto 3000 y frontend en 4000 | Petición OPTIONS/POST desde origen cruzado con cabecera X-User-Id | Cabeceras Access-Control-Allow-Origin y Allow-Headers presentes en respuesta HTTP | Navegador bloqueaba petición por CORS Policy impidiendo comunicación frontend-backend | CORREGIDO | 07/09/2026 15:40 | 07/09/2026 16:12 | `aca6932 feat(cors): habilitar cabeceras CORS para integracion con frontend sgrai-web` |
| `BUG-H06-API-02` | Error 500 no controlado ante peticiones con cuerpo no JSON o sintaxis malformada | Robustez / API | API / Route | Alta | Servidor API activo | POST /api/recursos con Content-Type application/json pero body texto plano inválido | Respuesta HTTP 400 Bad Request con mensaje descriptivo de JSON malformado | Error 500 Internal Server Error por excepción no capturada en req.json() | CORREGIDO | 07/09/2026 13:20 | 07/09/2026 14:04 | `dccbf01 feat(api): implementar endpoint POST /api/recursos y exportar openapi.json` |
| `BUG-H06-API-03` | Coordenadas geográficas devueltas como cadenas de texto (strings) por el driver de PostgreSQL | Integración / Tipos | DAL / Servicio | Media | Inserción de recurso con latitud y longitud numéricas | Verificar tipo de dato de latitud y longitud en JSON de respuesta | latitud y longitud retornadas como números flotantes IEEE 754 (ej. -39.8142) | El driver pg devolvía los tipos numeric como strings ("-39.8142"), rompiendo contratos de OpenAPI | CORREGIDO | 07/09/2026 13:35 | 07/09/2026 14:04 | `dccbf01 feat(api): implementar endpoint POST /api/recursos y exportar openapi.json` |
| `BUG-H06-API-04` | Ausencia de validación de rango geográfico WGS84 en esquema Zod de creación | Validación | Servicio / Zod | Alta | Payload con coordenadas fuera de proyección EPSG:4326 | latitud 95.0 o longitud -185.0 en payload JSON | Rechazo con HTTP 400 indicando que latitud debe estar en [-90,90] y longitud en [-180,180] | PostGIS fallaba a nivel de inserción SQL en lugar de ser rechazado limpiamente por el validador Zod | CORREGIDO | 07/09/2026 12:45 | 07/09/2026 13:10 | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `BUG-H06-API-05` | Ausencia de permiso recursos:crear en matriz de permisos y control RBAC provisional | Seguridad / RBAC | Módulo Seguridad | Crítica | Usuario autenticado solicitando creación de recurso | POST /api/recursos con cabecera X-User-Id válida | Verificación de permiso recursos:crear para el rol del usuario permitiendo o denegando con 403 | El endpoint no validaba el permiso específico del usuario permitiendo inserción sin autorización | CORREGIDO | 07/09/2026 11:30 | 07/09/2026 12:15 | `7df7a22 feat(seguridad): implementar verificacion de permisos rbac y auth provisional` |
| `CP-H06-API-01` | Bloqueo de acceso por ausencia de cabecera de autenticación X-User-Id | Seguridad | API / Route | Crítica | Servidor API en ejecución | POST /api/recursos sin cabecera X-User-Id | HTTP 401 Unauthorized con mensaje "Cabecera X-User-Id requerida..." | HTTP 401 Unauthorized retornado de forma consistente | APROBADO | 07/09/2026 16:15 | - | `7df7a22 feat(seguridad): implementar verificacion de permisos rbac y auth provisional` |
| `CP-H06-API-02` | Bloqueo de acceso a usuario sin permiso recursos:crear (RBAC) | Seguridad (RBAC) | API / Servicio | Crítica | Usuario autenticado con rol sin facultades de logística | POST /api/recursos con X-User-Id de perfil no administrador | HTTP 403 Forbidden con mensaje indicando falta de permisos requeridos | HTTP 403 Forbidden impidiendo la inserción no autorizada | APROBADO | 07/09/2026 16:16 | - | `7df7a22 feat(seguridad): implementar verificacion de permisos rbac y auth provisional` |
| `CP-H06-API-03` | Creación exitosa de recurso a granel con alerta automática de BAJO_STOCK | Funcional / Negocio | Servicio / BD | Alta | Usuario administrador con permiso recursos:crear | Payload: nombre: "Sacos de Arena", cantidadInventario: 50, cantidadMinima: 100 | HTTP 201 Created con data.estado = "BAJO_STOCK" | HTTP 201 Created; regla de negocio calcula BAJO_STOCK automáticamente | APROBADO | 07/09/2026 16:17 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-04` | Creación exitosa de recurso a granel con disponibilidad normal | Funcional | Servicio / BD | Alta | Usuario administrador autenticado | Payload: nombre: "Frazadas de Emergencia", cantidadInventario: 300, cantidadMinima: 50 | HTTP 201 Created con data.estado = "DISPONIBLE" | HTTP 201 Created; estado DISPONIBLE y cantidades persistidas en PostgreSQL | APROBADO | 07/09/2026 16:18 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-05` | Registro de activo individual: Camioneta Operativa 4x4 con especificaciones técnicas | Funcional | Integración / BD | Alta | Camioneta con atributos técnicos definidos | esIndividual: true, detalles: { patente: "ABCD-12", kilometraje: 45000, tipoCombustible: "DIESEL", capacidadPasajeros: 5 } | HTTP 201 Created con JSONB detalles validado e íntegro | HTTP 201 Created; objeto detalles almacenado fidedignamente en base de datos | APROBADO | 07/09/2026 16:19 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-06` | Registro de maquinaria pesada: Grúa Pluma 50T con parámetros de carga y horómetro | Funcional | Integración / BD | Alta | Maquinaria pesada con capacidad de levante | esIndividual: true, detalles: { capacidadCargaKg: 50000, alcanceMaximoMetros: 38, horometro: 1200 } | HTTP 201 Created con validación de rangos numéricos positivos | HTTP 201 Created; atributos mecánicos almacenados correctamente | APROBADO | 07/09/2026 16:20 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-07` | Registro de equipo de bombeo: Motobomba de Achique 3 Pulgadas | Funcional | Integración / BD | Alta | Equipo para respuesta ante inundaciones | esIndividual: true, detalles: { caudalMaximoLpm: 1200, diametroPulgadas: 3, potenciaHp: 8.5 } | HTTP 201 Created con métricas hidráulicas validadas | HTTP 201 Created con métricas de fluidos almacenadas en JSONB | APROBADO | 07/09/2026 16:21 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-08` | Asignación automática de estado NO_DISPONIBLE con stock en 0 | Regla de Negocio | Servicio / Dominio | Alta | Recurso a registrar sin unidades en bodega | cantidadInventario: 0, cantidadMinima: 10 | HTTP 201 Created con data.estado = "NO_DISPONIBLE" | HTTP 201 Created con estado calculado sin disponibilidad operativa | APROBADO | 07/09/2026 16:22 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-09` | Rechazo por nombre menor a 3 caracteres con mensaje descriptivo Zod | Validación (Zod) | API / Schema | Media | Payload con nombre inválido | nombre: "AB", cantidadInventario: 1, latitud: -39.81, longitud: -73.24 | HTTP 400 Bad Request con error de campo: "El nombre debe tener al menos 3 caracteres" | HTTP 400 Bad Request con detalle de campo objetado | APROBADO | 07/09/2026 16:23 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-10` | Rechazo por cantidad de inventario negativa | Validación (Zod) | API / Schema | Media | Payload con stock menor a 0 | nombre: "Generador 5kVA", cantidadInventario: -1 | HTTP 400 Bad Request con mensaje: "La cantidad en inventario no puede ser negativa" | HTTP 400 Bad Request bloqueando inventario inconsistente | APROBADO | 07/09/2026 16:24 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-11` | Rechazo por coordenadas geográficas fuera de rango WGS84 [-90,90] / [-180,180] | Validación (Zod) | API / Schema | Media | Coordenadas fuera del elipsoide terrestre | latitud: 95.0, longitud: -73.2459 | HTTP 400 Bad Request con mensaje explicativo de límites de latitud/longitud | HTTP 400 Bad Request rechazando coordenadas inválidas | APROBADO | 07/09/2026 16:25 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-12` | Rechazo por atributos técnicos numéricos negativos en detalles | Validación (Zod) | API / Schema | Media | Especificaciones mecánicas inválidas | detalles: { kilometraje: -100, horometro: -1, caudalMaximoLpm: 0 } | HTTP 400 Bad Request con mensaje de error específico por atributo | HTTP 400 Bad Request impidiendo valores métricos incoherentes | APROBADO | 07/09/2026 16:26 | - | `890182a feat(recursos): implementar esquemas para camionetas, gruas y motobombas, logica de stock y repositorio` |
| `CP-H06-API-13` | Rechazo de solicitud con cuerpo no JSON o malformado | Robustez API | API / Route | Media | Petición con cabecera application/json | POST /api/recursos con body "esto no es json" | HTTP 400 Bad Request con mensaje: "El cuerpo de la solicitud debe ser un JSON válido." | HTTP 400 Bad Request capturado limpiamente sin error 500 | APROBADO | 07/09/2026 16:27 | - | `dccbf01 feat(api): implementar endpoint POST /api/recursos y exportar openapi.json` |
| `CP-H06-API-14` | Exposición de especificación OpenAPI 3.0 con ruta POST /api/recursos | Contrato de API | OpenAPI | Alta | Servidor API en ejecución | GET /openapi.json | HTTP 200 OK con definición completa del endpoint POST /api/recursos y esquemas DTO | HTTP 200 OK con especificación sincronizada para generación de clientes | APROBADO | 07/09/2026 16:28 | - | `dccbf01 feat(api): implementar endpoint POST /api/recursos y exportar openapi.json` |
| `CP-H06-API-15` | Registro de auditoría persistiendo creado_por_id y marcas de tiempo UTC en PostgreSQL | Auditoría / BD | Base de Datos | Alta | Usuario administrador crea recurso exitosamente | Verificar columnas creado_por_id, creado_en y actualizado_en en fila insertada | Columnas pobladas con UUID del usuario autenticado y timestamp actual en UTC | Auditoría persistida fidedignamente vinculada a la cuenta del usuario | APROBADO | 07/09/2026 16:29 | - | `dce6447 feat(db): configurar kysely, postgis y migracion con indices gist y gin` |

---

## 4. Cobertura de Criterios de Aceptación (Trazabilidad)

| Criterio de Aceptación (CA) de la Historia de Usuario | Casos de Prueba Asociados | Estado de Cobertura |
|---|---|:---:|
| **CA-1: Inserción y persistencia de entidad Recurso (nombre, estado, cantidad, tipo, coordenadas WGS84, specs)** | `CP-H06-API-03`, `CP-H06-API-04`, `CP-H06-API-05`, `CP-H06-API-06`, `CP-H06-API-07`, `CP-H06-API-08` | 🟢 100% CUBIERTO |
| **CA-2: Validación estricta de esquema Zod en servidor antes de inserción en base de datos** | `CP-H06-API-09`, `CP-H06-API-10`, `CP-H06-API-11`, `CP-H06-API-12`, `BUG-H06-API-04` | 🟢 100% CUBIERTO |
| **CA-3: Respuesta HTTP 201 Created y mensaje "Recurso creado exitosamente"** | `CP-H06-API-03`, `CP-H06-API-04`, `CP-H06-API-05`, `BUG-H06-API-03` | 🟢 100% CUBIERTO |
| **CA-4: Disponibilidad inmediata en la base de datos para consulta y asignación logística** | `CP-H06-API-03`, `CP-H06-API-04` | 🟢 100% CUBIERTO |
| **CA-5: Manejo robusto de errores de cliente/servidor (HTTP 400 Bad Request / 500) con mensajes claros** | `CP-H06-API-09`, `CP-H06-API-10`, `CP-H06-API-13`, `BUG-H06-API-02` | 🟢 100% CUBIERTO |
| **CA-6: Protección del endpoint mediante autenticación y verificación de permiso recursos:crear (RBAC)** | `CP-H06-API-01`, `CP-H06-API-02`, `BUG-H06-API-05` | 🟢 100% CUBIERTO |
| **CA-7: Auditoría del registro con fecha, hora (creado_en) y usuario creador (creado_por_id)** | `CP-H06-API-15` | 🟢 100% CUBIERTO |

---

## 5. Evidencias de Ejecución Automatizada (Vitest)

Ejecución de las suites de pruebas unitarias y de integración en `sgrai-api`:

```bash
$ npm test -- src/modules/recursos-y-personal/__tests__/recurso.test.ts src/app/api/recursos/__tests__/route.test.ts

 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (34 tests) 19ms
 ✓ src/app/api/recursos/__tests__/route.test.ts (7 tests) 15ms

 Test Files  2 passed (2)
      Tests  41 passed (41)
   Duration  588ms
```

### Verificación Estática de Tipos (TypeScript)
```bash
$ npx tsc --noEmit
# Salida limpia: 0 errores de compilación TypeScript.
```

---

## 6. Dictamen de Calidad de Backend (QA Sign-off)

La implementación del endpoint `POST /api/recursos`, sus esquemas de validación Zod, lógica de estados y persistencia Kysely/PostGIS en la rama **`feature/H6-crear-recurso`** satisface al 100% los requerimientos de backend y contratos de API definidos para la **HU-6**.

**Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN Y MERGE A DEVELOP**.
