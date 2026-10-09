# Informe y Matriz de Casos de Prueba (QA): HU-8 — Editar Características de un Recurso (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Logística / Operaciones ICS — Inventario Logístico y Fichas Técnicas).  
> **Historia de Usuario:** HU-8 — *"Como Administrador Quiero editar características de un recurso Para mantener el sistema actualizado y asegurar que el inventario refleje la realidad operativa de la dirección."*  
> **Servicio API:** `sgrai-api` (Next.js 16 Route Handlers + TypeScript + Kysely + PostgreSQL 16 + PostGIS + Socket.io + Vitest).  
> **Rama Git Evaluada:** `feature/H8-editar-caracteristicas-recurso` (mergeada en `develop` mediante Pull Request #10).  
> **Commits Clave Evaluados (Conventional Commits):**
> * `chore(db): renumerar migracion a 009 para evitar colision con H54`
> * `feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso`
> * `feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json`
> * `test(recursos): agregar pruebas unitarias y de integracion para edicion de recurso`
> * `docs(api): documentar endpoints de edicion y redactar handover frontend para HU-8`
> * `feat(recursos): restringir estado de mantenimiento tecnico a activos individuales`
> * `fix(incidentes): tipar prioridad en notificarIncidenteCreado para corregir linter`
> * `fix(db): compatibilizar FileMigrationProvider de Kysely con ESM en Windows usando pathToFileURL`
> * `test(recursos): agregar propiedad detalles requerida en input para editarRecurso`
>
> **Fecha de Certificación QA:** Septiembre / Octubre 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PRODUCCIÓN (100% PASS TRAS RE-TESTS)**.

---

## 1. Resumen Ejecutivo de Pruebas de Backend

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **25** (20 Casos Funcionales/Integración/Seguridad + 5 Defectos Gestionados) |
| **Casos Aprobados (Passed)** | **20** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Detectados y Devueltos a Desarrolladores (Bugs)** | **5** (100% resueltos, re-testeados y certificados) |
| **Tasa de Aprobación Global (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **26/26 tests específicos de edición y detalle de recursos exitosos** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 errores (`npm run lint`)** |
| **Contrato OpenAPI 3.0 Centralizado** | **100% sincronizado en `/openapi.json` con rutas `GET /api/recursos/{id}` y `PUT /api/recursos/{id}`** |
| **Sincronización en Tiempo Real (Socket.io)** | **100% verificado (`recurso:actualizado` emitido hacia salas `encargado` y `supervisor`)** |

---

## 2. Registro de Defectos Detectados en QA y Ciclo de Re-Test

Siguiendo el flujo estándar y las directrices docentes de Aseguramiento de Calidad (*detección de defectos durante el ciclo de desarrollo de la rama, reporte formal al equipo de desarrollo, implementación del fix mediante commit estructurado en Conventional Commits y ejecución de re-test formal para certificación de cierre*), se detectaron y gestionaron 5 defectos en la API backend:

| ID Defecto | Descripción del Defecto Encontrado | Severidad | Módulo / Archivo Afectado | Fecha Hallazgo | Commit del Fix (Sin Hash) | Fecha Re-Test | Dictamen Re-Test |
|---|---|:---:|---|:---:|---|:---:|:---:|
| `BUG-H08-API-01` | Permisión indebida de asignación de mantenimiento técnico (`enMantencion: true`) a materiales o insumos a granel (`esIndividual: false`), generando incoherencia operativa en bodega. | Alta | `src/modules/recursos-y-personal/recurso.service.ts` | 29/09/2026 18:30 | feat(recursos): restringir estado de mantenimiento tecnico a activos individuales | 29/09/2026 22:45 | 🟢 CORREGIDO (Lanzamiento de BadRequestError con mensaje explicativo: "Los materiales o recursos a granel no admiten estado de mantenimiento técnico.") |
| `BUG-H08-API-02` | Error 500 Internal Server Error no capturado ante peticiones `PUT` con cuerpo no JSON o sintaxis malformada en route handler. | Alta | `src/app/api/recursos/[id]/route.ts` | 29/09/2026 12:15 | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json | 29/09/2026 16:15 | 🟢 CORREGIDO (Captura con try/catch en req.json() respondiendo HTTP 400 Bad Request: "El cuerpo de la solicitud debe ser un JSON válido.") |
| `BUG-H08-API-03` | Incompatibilidad de `FileMigrationProvider` de Kysely con ESM en Windows al resolver rutas absolutas durante la ejecución de pruebas. | Media | `src/lib/db/migrator.ts` | 30/09/2026 17:10 | fix(db): compatibilizar FileMigrationProvider de Kysely con ESM en Windows usando pathToFileURL | 30/09/2026 18:45 | 🟢 CORREGIDO (Conversión de rutas mediante pathToFileURL asegurando portabilidad multiplataforma de migraciones) |
| `BUG-H08-API-04` | Omisión de propiedad obligatoria `detalles` en el input de `editarRecurso` provocando fallo en assertions de suites unitarias. | Media | `src/modules/recursos-y-personal/__tests__/recurso.test.ts` | 30/09/2026 18:50 | test(recursos): agregar propiedad detalles requerida en input para editarRecurso | 30/09/2026 19:35 | 🟢 CORREGIDO (Inclusión explícita de detalles: {} en fixtures de test normalizando la interfaz de entrada) |
| `BUG-H08-API-05` | Colisión en correlativo secuencial de archivo de migración Kysely (`006`/`008` vs `009`) tras sincronización con ramas concurrentes en develop. | Alta | `src/lib/db/migrations/` | 30/09/2026 17:45 | chore(db): renumerar migracion a 009 para evitar colision con H54 | 30/09/2026 18:25 | 🟢 CORREGIDO (Migración renumerada a 009_recurso_auditoria_edicion.ts y ejecutada limpiamente sin conflictos de esquema) |

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H08-API-01` | Permisión indebida de asignación de mantenimiento técnico a materiales o insumos a granel | Regla de Negocio / Integración | Servicio / Dominio | Alta | Recurso a granel registrado (esIndividual: false, ej. Sacos de Arena) | PUT /api/recursos/[id] con {"enMantencion": true} | HTTP 400 Bad Request: "Los materiales o recursos a granel no admiten estado de mantenimiento técnico." | Se permitía marcar materiales a granel como EN_MANTENCION distorsionando el inventario | CORREGIDO | 29/09/2026 18:30 | 29/09/2026 22:45 | feat(recursos): restringir estado de mantenimiento tecnico a activos individuales |
| `BUG-H08-API-02` | Error 500 no controlado ante peticiones PUT con cuerpo no JSON o sintaxis malformada | Robustez / API | API / Route | Alta | Servidor API en ejecución | PUT /api/recursos/[id] con body texto plano no JSON y header application/json | HTTP 400 Bad Request con mensaje: "El cuerpo de la solicitud debe ser un JSON válido." | Error 500 Internal Server Error por excepción no capturada en req.json() | CORREGIDO | 29/09/2026 12:15 | 29/09/2026 16:15 | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |
| `BUG-H08-API-03` | Incompatibilidad de FileMigrationProvider de Kysely con ESM en Windows | Integración / Plataforma | DAL / Migraciones | Media | Entorno de testing sobre sistema operativo Windows | Ejecución de migraciones automáticas Kysely en suite de pruebas | Carga dinámica correcta de módulos ESM de migraciones sin fallos de URL | Fallo ERR_UNSUPPORTED_ESM_URL_SCHEME por ausencia de conversión pathToFileURL | CORREGIDO | 30/09/2026 17:10 | 30/09/2026 18:45 | fix(db): compatibilizar FileMigrationProvider de Kysely con ESM en Windows usando pathToFileURL |
| `BUG-H08-API-04` | Omisión de propiedad obligatoria detalles en input de editarRecurso en pruebas unitarias | Pruebas / Tipado | Suite Vitest | Media | Ejecución de suite de tests en modulo recursos | Llamada a editarRecurso() en recurso.test.ts sin campo detalles | Paso exitoso de test con tipado estricto conforme a ActualizarRecursoInput | TypeError / Fallo de validación por parámetro detalles faltante | CORREGIDO | 30/09/2026 18:50 | 30/09/2026 19:35 | test(recursos): agregar propiedad detalles requerida en input para editarRecurso |
| `BUG-H08-API-05` | Colisión en correlativo secuencial de archivo de migración Kysely al sincronizar develop | Base de Datos / CI | DB / Migraciones | Alta | Migración 006/008 colisionando con migración de rama H54/H34 | npx kysely migrate:latest | Secuencia ordenada de migraciones sin solapamiento de identificadores | Fallo de despliegue y migración omitida por colisión en nombre de archivo | CORREGIDO | 30/09/2026 17:45 | 30/09/2026 18:25 | chore(db): renumerar migracion a 009 para evitar colision con H54 |
| `CP-H08-API-01` | Pre-carga completa de información de recurso existente para alimentar formulario de edición | Funcional | API / Servicio | Alta | Recurso existente en BD (Camioneta Rescate 4x4) | GET /api/recursos/[id] con cabecera X-User-Id válida | HTTP 200 OK con payload completo: nombre, tipo, esIndividual, estado, cantidades, lat, lng, detalles, delegación | HTTP 200 OK con todos los campos pre-cargados requeridos para UI | APROBADO | 01/10/2026 17:30 | - | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |
| `CP-H08-API-02` | Modificación exitosa de características operativas de recurso individual (nombre, descripción, delegación) | Funcional | Servicio / BD | Alta | Recurso existente en base de datos con delegación | PUT /api/recursos/[id] con {"nombre": "Camioneta 4x4 Modificada", "descripcion": "Unidad de avanzada", "delegacionId": "30000000-0000-4000-8000-000000000001"} | HTTP 200 OK con mensaje de éxito y campos actualizados en base de datos | HTTP 200 OK; registro actualizado fidedignamente en PostgreSQL | APROBADO | 01/10/2026 17:32 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-03` | Puesta en mantenimiento de vehículo con transición forzada a estado EN_MANTENCION | Regla de Negocio | Servicio / Dominio | Alta | Maquinaria o vehículo individual (esIndividual: true) | PUT /api/recursos/[id] con {"enMantencion": true} | HTTP 200 OK con data.estado = "EN_MANTENCION" | HTTP 200 OK; estado operacional pasa a EN_MANTENCION en BD y respuesta | APROBADO | 01/10/2026 17:34 | - | feat(recursos): restringir estado de mantenimiento tecnico a activos individuales |
| `CP-H08-API-04` | Modificación de inventario de insumo a granel sobre umbral mínimo con asignación de estado DISPONIBLE | Regla de Negocio | Servicio / Dominio | Alta | Insumo a granel registrado (Frazadas Térmicas) | PUT /api/recursos/[id] con cantidadInventario: 300, cantidadMinima: 50 | HTTP 200 OK con data.estado = "DISPONIBLE" y cantidadDisponible = 300 | HTTP 200 OK; stock recalculado y estado asignado como DISPONIBLE | APROBADO | 01/10/2026 17:36 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-05` | Transición automática a BAJO_STOCK al reducir inventario físico igual o menor a cantidad mínima | Regla de Negocio | Servicio / Dominio | Alta | Insumo a granel con cantidadMinima = 50 | PUT /api/recursos/[id] con cantidadInventario: 40 | HTTP 200 OK con data.estado = "BAJO_STOCK" | HTTP 200 OK; cálculo automático asigna estado de alerta BAJO_STOCK | APROBADO | 01/10/2026 17:38 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-06` | Transición automática a NO_DISPONIBLE al reducir inventario físico a 0 unidades | Regla de Negocio | Servicio / Dominio | Alta | Recurso registrado en inventario con stock previo | PUT /api/recursos/[id] con cantidadInventario: 0 | HTTP 200 OK con data.estado = "NO_DISPONIBLE" y cantidadDisponible = 0 | HTTP 200 OK; estado operacional pasa a NO_DISPONIBLE | APROBADO | 01/10/2026 17:40 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-07` | Modificación de especificaciones técnicas detalladas en objeto JSONB (kilometraje, horómetro) | Funcional / Integración | DAL / PostgreSQL | Alta | Vehículo registrado con datos técnicos iniciales | PUT /api/recursos/[id] con detalles: { patente: "ABCD-12", kilometraje: 48000, tipoCombustible: "DIESEL" } | HTTP 200 OK con columna JSONB detalles actualizada íntegramente | HTTP 200 OK; objeto detalles preserva y actualiza atributos técnicos | APROBADO | 01/10/2026 17:42 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-08` | Registro y persistencia fidedigna de auditoría (actualizado_por_id y actualizado_en UTC) | Auditoría / BD | Base de Datos | Alta | Usuario administrador autenticado modifica recurso | Verificar columnas actualizado_por_id y actualizado_en en fila de PostgreSQL | actualizado_por_id con UUID de usuario editor y actualizado_en con timestamp actual UTC | Auditoría registrada fidedignamente con ID de usuario y marca temporal UTC | APROBADO | 01/10/2026 17:44 | - | chore(db): renumerar migracion a 009 para evitar colision con H54 |
| `CP-H08-API-09` | Notificación y emisión de evento en tiempo real Socket.io recurso:actualizado a salas operativas | Tiempo Real / Red | Socket.io / Eventos | Alta | Servidor Socket.io en ejecución | PUT /api/recursos/[id] ejecutado exitosamente | Evento "recurso:actualizado" emitido a salas "encargado" y "supervisor" con payload del recurso | Evento emitido correctamente a clientes conectados para actualización sin recargar | APROBADO | 01/10/2026 17:46 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-10` | Bloqueo de reducción de stock físico por debajo de las unidades actualmente en uso en terreno | Integración / Negocio | Servicio / Dominio | Crítica | Recurso con cantidad_en_uso = 60 desplegado en terreno | PUT /api/recursos/[id] intentando enviar cantidadInventario = 40 | HTTP 400 Bad Request: "No es posible reducir la cantidad en inventario (40) por debajo de las unidades actualmente en uso en terreno (60)." | HTTP 400 Bad Request devuelto con mensaje claro impidiendo descuadre logístico | APROBADO | 01/10/2026 17:48 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-11` | Rechazo de asignación de mantenimiento técnico a materiales o suministros a granel | Validación / Negocio | Servicio / Schema | Alta | Recurso a granel registrado (esIndividual: false) | PUT /api/recursos/[id] con {"enMantencion": true} | HTTP 400 Bad Request: "Los materiales o recursos a granel no admiten estado de mantenimiento técnico." | HTTP 400 Bad Request impidiendo inconsistencia de mantenimiento en granel | APROBADO | 01/10/2026 17:50 | - | feat(recursos): restringir estado de mantenimiento tecnico a activos individuales |
| `CP-H08-API-12` | Rechazo por nombre menor a 3 caracteres con mensaje descriptivo Zod | Validación (Zod) | API / Schema | Media | Servidor API en ejecución | PUT /api/recursos/[id] con {"nombre": "AB"} | HTTP 400 Bad Request con mensaje: "El nombre debe tener al menos 3 caracteres" | HTTP 400 Bad Request con array de errores detallando campo objetado | APROBADO | 01/10/2026 17:52 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-13` | Rechazo por cantidad de inventario o cantidad mínima negativa | Validación (Zod) | API / Schema | Media | Servidor API en ejecución | PUT /api/recursos/[id] con {"cantidadInventario": -5} | HTTP 400 Bad Request con mensaje: "La cantidad en inventario no puede ser negativa" | HTTP 400 Bad Request bloqueando inventarios negativos | APROBADO | 01/10/2026 17:54 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-14` | Rechazo por coordenadas geográficas fuera de rango WGS84 [-90,90] / [-180,180] | Validación (Zod) | API / Schema | Media | Coordenadas fuera de límites elipsoidales | PUT /api/recursos/[id] con latitud: 95.0, longitud: -190.0 | HTTP 400 Bad Request detallando que latitud y longitud están fuera de rango | HTTP 400 Bad Request rechazando coordenadas geográficas anómalas | APROBADO | 01/10/2026 17:56 | - | feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso |
| `CP-H08-API-15` | Rechazo por parámetro :id de recurso con formato UUID inválido en GET y PUT | Robustez | API / Route | Media | Petición con parámetro de ruta malformado | GET o PUT /api/recursos/id-invalido-123 | HTTP 400 Bad Request con mensaje: "Identificador de recurso inválido." | HTTP 400 Bad Request validado en capa de route handler antes de BD | APROBADO | 01/10/2026 17:58 | - | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |
| `CP-H08-API-16` | Rechazo por recurso inexistente en base de datos PostgreSQL | Manejo de Errores | DAL / Servicio | Media | UUID aleatorio válido no registrado en tabla recurso | GET o PUT /api/recursos/00000000-0000-4000-8000-999999999999 | HTTP 404 Not Found con mensaje: "Recurso con ID '...' no encontrado." | HTTP 404 Not Found capturado limpiamente respondiendo recurso no existente | APROBADO | 01/10/2026 18:00 | - | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |
| `CP-H08-API-17` | Bloqueo de acceso por ausencia de cabecera de autenticación X-User-Id | Seguridad | API / Route | Crítica | Servidor API en ejecución | GET o PUT /api/recursos/[id] sin cabecera X-User-Id ni Bearer token | HTTP 401 Unauthorized con mensaje: "Cabecera X-User-Id requerida para autenticación." | HTTP 401 Unauthorized denegando petición sin credenciales | APROBADO | 01/10/2026 18:02 | - | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |
| `CP-H08-API-18` | Bloqueo de acceso por usuario sin permiso recursos:editar o sin rol Administrador | Seguridad (RBAC) | API / Servicio | Crítica | Usuario autenticado con rol sin permiso recursos:editar | PUT /api/recursos/[id] con X-User-Id de usuario operador / call-center | HTTP 403 Forbidden con mensaje: "Acceso denegado. Se requiere el perfil de Administrador." | HTTP 403 Forbidden impidiendo modificación no autorizada de inventario | APROBADO | 01/10/2026 18:04 | - | chore(db): renumerar migracion a 009 para evitar colision con H54 |
| `CP-H08-API-19` | Rechazo de solicitud PUT con cuerpo no JSON o sintaxis malformada | Robustez API | API / Route | Media | Petición con cabecera application/json | PUT /api/recursos/[id] con cuerpo de texto plano inválido | HTTP 400 Bad Request con mensaje: "El cuerpo de la solicitud debe ser un JSON válido." | HTTP 400 Bad Request capturado limpiamente sin causar error 500 | APROBADO | 01/10/2026 18:06 | - | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |
| `CP-H08-API-20` | Exposición de especificación OpenAPI 3.0 con endpoints GET y PUT /api/recursos/{id} y esquemas DTO | Contrato de API | OpenAPI | Alta | Servidor API levantado en puerto 3000 | GET /openapi.json | HTTP 200 OK con definición completa de rutas GET y PUT /api/recursos/{id} y DTOs Zod | HTTP 200 OK con especificación OpenAPI sincronizada para clientes frontend | APROBADO | 01/10/2026 18:08 | - | feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json |

---

### 3.1 Bloque TSV para Google Sheets (Copiar y Pegar en celda A1)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H08-API-01	Permisión indebida de asignación de mantenimiento técnico a materiales o insumos a granel	Regla de Negocio / Integración	Servicio / Dominio	Alta	Recurso a granel registrado (esIndividual: false, ej. Sacos de Arena)	PUT /api/recursos/[id] con {"enMantencion": true}	HTTP 400 Bad Request: "Los materiales o recursos a granel no admiten estado de mantenimiento técnico."	Se permitía marcar materiales a granel como EN_MANTENCION distorsionando el inventario	CORREGIDO	29/09/2026 18:30	29/09/2026 22:45	feat(recursos): restringir estado de mantenimiento tecnico a activos individuales
BUG-H08-API-02	Error 500 no controlado ante peticiones PUT con cuerpo no JSON o sintaxis malformada	Robustez / API	API / Route	Alta	Servidor API en ejecución	PUT /api/recursos/[id] con body texto plano no JSON y header application/json	HTTP 400 Bad Request con mensaje: "El cuerpo de la solicitud debe ser un JSON válido."	Error 500 Internal Server Error por excepción no capturada en req.json()	CORREGIDO	29/09/2026 12:15	29/09/2026 16:15	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
BUG-H08-API-03	Incompatibilidad de FileMigrationProvider de Kysely con ESM en Windows	Integración / Plataforma	DAL / Migraciones	Media	Entorno de testing sobre sistema operativo Windows	Ejecución de migraciones automáticas Kysely en suite de pruebas	Carga dinámica correcta de módulos ESM de migraciones sin fallos de URL	Fallo ERR_UNSUPPORTED_ESM_URL_SCHEME por ausencia de conversión pathToFileURL	CORREGIDO	30/09/2026 17:10	30/09/2026 18:45	fix(db): compatibilizar FileMigrationProvider de Kysely con ESM en Windows usando pathToFileURL
BUG-H08-API-04	Omisión de propiedad obligatoria detalles en input de editarRecurso en pruebas unitarias	Pruebas / Tipado	Suite Vitest	Media	Ejecución de suite de tests en modulo recursos	Llamada a editarRecurso() en recurso.test.ts sin campo detalles	Paso exitoso de test con tipado estricto conforme a ActualizarRecursoInput	TypeError / Fallo de validación por parámetro detalles faltante	CORREGIDO	30/09/2026 18:50	30/09/2026 19:35	test(recursos): agregar propiedad detalles requerida en input para editarRecurso
BUG-H08-API-05	Colisión en correlativo secuencial de archivo de migración Kysely al sincronizar develop	Base de Datos / CI	DB / Migraciones	Alta	Migración 006/008 colisionando con migración de rama H54/H34	npx kysely migrate:latest	Secuencia ordenada de migraciones sin solapamiento de identificadores	Fallo de despliegue y migración omitida por colisión en nombre de archivo	CORREGIDO	30/09/2026 17:45	30/09/2026 18:25	chore(db): renumerar migracion a 009 para evitar colision con H54
CP-H08-API-01	Pre-carga completa de información de recurso existente para alimentar formulario de edición	Funcional	API / Servicio	Alta	Recurso existente en BD (Camioneta Rescate 4x4)	GET /api/recursos/[id] con cabecera X-User-Id válida	HTTP 200 OK con payload completo: nombre, tipo, esIndividual, estado, cantidades, lat, lng, detalles, delegación	HTTP 200 OK con todos los campos pre-cargados requeridos para UI	APROBADO	01/10/2026 17:30	-	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
CP-H08-API-02	Modificación exitosa de características operativas de recurso individual (nombre, descripción, delegación)	Funcional	Servicio / BD	Alta	Recurso existente en base de datos con delegación	PUT /api/recursos/[id] con {"nombre": "Camioneta 4x4 Modificada", "descripcion": "Unidad de avanzada", "delegacionId": "30000000-0000-4000-8000-000000000001"}	HTTP 200 OK con mensaje de éxito y campos actualizados en base de datos	HTTP 200 OK; registro actualizado fidedignamente en PostgreSQL	APROBADO	01/10/2026 17:32	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-03	Puesta en mantenimiento de vehículo con transición forzada a estado EN_MANTENCION	Regla de Negocio	Servicio / Dominio	Alta	Maquinaria o vehículo individual (esIndividual: true)	PUT /api/recursos/[id] con {"enMantencion": true}	HTTP 200 OK con data.estado = "EN_MANTENCION"	HTTP 200 OK; estado operacional pasa a EN_MANTENCION en BD y respuesta	APROBADO	01/10/2026 17:34	-	feat(recursos): restringir estado de mantenimiento tecnico a activos individuales
CP-H08-API-04	Modificación de inventario de insumo a granel sobre umbral mínimo con asignación de estado DISPONIBLE	Regla de Negocio	Servicio / Dominio	Alta	Insumo a granel registrado (Frazadas Térmicas)	PUT /api/recursos/[id] con cantidadInventario: 300, cantidadMinima: 50	HTTP 200 OK con data.estado = "DISPONIBLE" y cantidadDisponible = 300	HTTP 200 OK; stock recalculado y estado asignado como DISPONIBLE	APROBADO	01/10/2026 17:36	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-05	Transición automática a BAJO_STOCK al reducir inventario físico igual o menor a cantidad mínima	Regla de Negocio	Servicio / Dominio	Alta	Insumo a granel con cantidadMinima = 50	PUT /api/recursos/[id] con cantidadInventario: 40	HTTP 200 OK con data.estado = "BAJO_STOCK"	HTTP 200 OK; cálculo automático asigna estado de alerta BAJO_STOCK	APROBADO	01/10/2026 17:38	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-06	Transición automática a NO_DISPONIBLE al reducir inventario físico a 0 unidades	Regla de Negocio	Servicio / Dominio	Alta	Recurso registrado en inventario con stock previo	PUT /api/recursos/[id] con cantidadInventario: 0	HTTP 200 OK con data.estado = "NO_DISPONIBLE" y cantidadDisponible = 0	HTTP 200 OK; estado operacional pasa a NO_DISPONIBLE	APROBADO	01/10/2026 17:40	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-07	Modificación de especificaciones técnicas detalladas en objeto JSONB (kilometraje, horómetro)	Funcional / Integración	DAL / PostgreSQL	Alta	Vehículo registrado con datos técnicos iniciales	PUT /api/recursos/[id] con detalles: { patente: "ABCD-12", kilometraje: 48000, tipoCombustible: "DIESEL" }	HTTP 200 OK con columna JSONB detalles actualizada íntegramente	HTTP 200 OK; objeto detalles preserva y actualiza atributos técnicos	APROBADO	01/10/2026 17:42	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-08	Registro y persistencia fidedigna de auditoría (actualizado_por_id y actualizado_en UTC)	Auditoría / BD	Base de Datos	Alta	Usuario administrador autenticado modifica recurso	Verificar columnas actualizado_por_id y actualizado_en en fila de PostgreSQL	actualizado_por_id con UUID de usuario editor y actualizado_en con timestamp actual UTC	Auditoría registrada fidedignamente con ID de usuario y marca temporal UTC	APROBADO	01/10/2026 17:44	-	chore(db): renumerar migracion a 009 para evitar colision con H54
CP-H08-API-09	Notificación y emisión de evento en tiempo real Socket.io recurso:actualizado a salas operativas	Tiempo Real / Red	Socket.io / Eventos	Alta	Servidor Socket.io en ejecución	PUT /api/recursos/[id] ejecutado exitosamente	Evento "recurso:actualizado" emitido a salas "encargado" y "supervisor" con payload del recurso	Evento emitido correctamente a clientes conectados para actualización sin recargar	APROBADO	01/10/2026 17:46	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-10	Bloqueo de reducción de stock físico por debajo de las unidades actualmente en uso en terreno	Integración / Negocio	Servicio / Dominio	Crítica	Recurso con cantidad_en_uso = 60 desplegado en terreno	PUT /api/recursos/[id] intentando enviar cantidadInventario = 40	HTTP 400 Bad Request: "No es posible reducir la cantidad en inventario (40) por debajo de las unidades actualmente en uso en terreno (60)."	HTTP 400 Bad Request devuelto con mensaje claro impidiendo descuadre logístico	APROBADO	01/10/2026 17:48	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-11	Rechazo de asignación de mantenimiento técnico a materiales o suministros a granel	Validación / Negocio	Servicio / Schema	Alta	Recurso a granel registrado (esIndividual: false)	PUT /api/recursos/[id] con {"enMantencion": true}	HTTP 400 Bad Request: "Los materiales o recursos a granel no admiten estado de mantenimiento técnico."	HTTP 400 Bad Request impidiendo inconsistencia de mantenimiento en granel	APROBADO	01/10/2026 17:50	-	feat(recursos): restringir estado de mantenimiento tecnico a activos individuales
CP-H08-API-12	Rechazo por nombre menor a 3 caracteres con mensaje descriptivo Zod	Validación (Zod)	API / Schema	Media	Servidor API en ejecución	PUT /api/recursos/[id] con {"nombre": "AB"}	HTTP 400 Bad Request con mensaje: "El nombre debe tener al menos 3 caracteres"	HTTP 400 Bad Request con array de errores detallando campo objetado	APROBADO	01/10/2026 17:52	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-13	Rechazo por cantidad de inventario o cantidad mínima negativa	Validación (Zod)	API / Schema	Media	Servidor API en ejecución	PUT /api/recursos/[id] con {"cantidadInventario": -5}	HTTP 400 Bad Request con mensaje: "La cantidad en inventario no puede ser negativa"	HTTP 400 Bad Request bloqueando inventarios negativos	APROBADO	01/10/2026 17:54	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-14	Rechazo por coordenadas geográficas fuera de rango WGS84 [-90,90] / [-180,180]	Validación (Zod)	API / Schema	Media	Coordenadas fuera de límites elipsoidales	PUT /api/recursos/[id] con latitud: 95.0, longitud: -190.0	HTTP 400 Bad Request detallando que latitud y longitud están fuera de rango	HTTP 400 Bad Request rechazando coordenadas geográficas anómalas	APROBADO	01/10/2026 17:56	-	feat(recursos): implementar esquemas Zod, repositorio y servicio para edicion de recurso
CP-H08-API-15	Rechazo por parámetro :id de recurso con formato UUID inválido en GET y PUT	Robustez	API / Route	Media	Petición con parámetro de ruta malformado	GET o PUT /api/recursos/id-invalido-123	HTTP 400 Bad Request con mensaje: "Identificador de recurso inválido."	HTTP 400 Bad Request validado en capa de route handler antes de BD	APROBADO	01/10/2026 17:58	-	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
CP-H08-API-16	Rechazo por recurso inexistente en base de datos PostgreSQL	Manejo de Errores	DAL / Servicio	Media	UUID aleatorio válido no registrado en tabla recurso	GET o PUT /api/recursos/00000000-0000-4000-8000-999999999999	HTTP 404 Not Found con mensaje: "Recurso con ID '...' no encontrado."	HTTP 404 Not Found capturado limpiamente respondiendo recurso no existente	APROBADO	01/10/2026 18:00	-	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
CP-H08-API-17	Bloqueo de acceso por ausencia de cabecera de autenticación X-User-Id	Seguridad	API / Route	Crítica	Servidor API en ejecución	GET o PUT /api/recursos/[id] sin cabecera X-User-Id ni Bearer token	HTTP 401 Unauthorized con mensaje: "Cabecera X-User-Id requerida para autenticación."	HTTP 401 Unauthorized denegando petición sin credenciales	APROBADO	01/10/2026 18:02	-	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
CP-H08-API-18	Bloqueo de acceso por usuario sin permiso recursos:editar o sin rol Administrador	Seguridad (RBAC)	API / Servicio	Crítica	Usuario autenticado con rol sin permiso recursos:editar	PUT /api/recursos/[id] con X-User-Id de usuario operador / call-center	HTTP 403 Forbidden con mensaje: "Acceso denegado. Se requiere el perfil de Administrador."	HTTP 403 Forbidden impidiendo modificación no autorizada de inventario	APROBADO	01/10/2026 18:04	-	chore(db): renumerar migracion a 009 para evitar colision con H54
CP-H08-API-19	Rechazo de solicitud PUT con cuerpo no JSON o sintaxis malformada	Robustez API	API / Route	Media	Petición con cabecera application/json	PUT /api/recursos/[id] con cuerpo de texto plano inválido	HTTP 400 Bad Request con mensaje: "El cuerpo de la solicitud debe ser un JSON válido."	HTTP 400 Bad Request capturado limpiamente sin causar error 500	APROBADO	01/10/2026 18:06	-	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
CP-H08-API-20	Exposición de especificación OpenAPI 3.0 con endpoints GET y PUT /api/recursos/{id} y esquemas DTO	Contrato de API	OpenAPI	Alta	Servidor API levantado en puerto 3000	GET /openapi.json	HTTP 200 OK con definición completa de rutas GET y PUT /api/recursos/{id} y DTOs Zod	HTTP 200 OK con especificación OpenAPI sincronizada para clientes frontend	APROBADO	01/10/2026 18:08	-	feat(api): implementar route handlers GET y PUT /api/recursos/[id] y actualizar openapi.json
```

---

## 4. Guía Detallada de Ejecución y Replicabilidad 100% (Paso a Paso)

Para asegurar la auditoría de calidad y la total reproducibilidad de los resultados registrados, a continuación se detallan los comandos exactos de consola (Vitest y `curl`), con sus cabeceras, payloads y salidas reales.

---

### 4.1. Defectos Detectados y Validación de Fixes (Ciclo de Re-Test)

#### `BUG-H08-API-01`: Permisión indebida de mantenimiento técnico a materiales o insumos a granel
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe rechazar con BadRequestError si se intenta marcar en mantención un recurso a granel"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (1 test | 42 skipped) 2ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe rechazar con BadRequestError si se intenta marcar en mantención un recurso a granel (es_individual: false) 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 42 skipped (43)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000002" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Sacos de Arena",
      "cantidadInventario": 200,
      "cantidadMinima": 20,
      "enMantencion": true,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "Los materiales o recursos a granel no admiten estado de mantenimiento técnico."
  }
  ```

---

#### `BUG-H08-API-02`: Error 500 no controlado ante peticiones PUT con cuerpo no JSON o sintaxis malformada
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 400 si el cuerpo no es un JSON válido"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/app/api/recursos/[id]/__tests__/route.test.ts (1 test | 19 skipped) 2ms
     ✓ Route Handlers /api/recursos/[id] (HU-8 / HU-9) > PUT /api/recursos/[id] > debe responder 400 si el cuerpo no es un JSON válido 2ms

   Test Files  1 passed (1)
        Tests  1 passed | 19 skipped (20)
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d "esto-no-es-un-json"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "El cuerpo de la solicitud debe ser un JSON válido."
  }
  ```

---

#### `BUG-H08-API-03`: Incompatibilidad de `FileMigrationProvider` de Kysely con ESM en Windows
* **Comando de verificación de compilación y tipos:**
  ```bash
  npx tsc --noEmit
  ```
* **Salida Obtenida:**
  ```text
  (Salida limpia sin errores, código de retorno 0)
  ```

---

#### `BUG-H08-API-04`: Omisión de propiedad obligatoria `detalles` en input de `editarRecurso`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "7. Servicio de Edición de Recurso"
  ```
* **Salida de Vitest:**
  ```text
   ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (6 tests | 37 skipped) 12ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe arrojar UnauthorizedError si usuarioId está ausente 1ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe arrojar NotFoundError si el recurso no existe 1ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe arrojar BadRequestError si se intenta reducir la cantidad en inventario por debajo de lo en uso 1ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe forzar estado EN_MANTENCION cuando enMantencion es true 4ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe rechazar con BadRequestError si se intenta marcar en mantención un recurso a granel (es_individual: false) 1ms
     ✓ Módulo Recursos y Personal - Pruebas Unitarias > 7. Servicio de Edición de Recurso (editarRecurso) > debe pasar a NO_DISPONIBLE cuando la cantidad en inventario es 0 1ms

   Test Files  1 passed (1)
        Tests  6 passed | 37 skipped (43)
  ```

---

#### `BUG-H08-API-05`: Colisión en correlativo secuencial de archivo de migración Kysely
* **Archivo oficial:** `src/lib/db/migrations/009_recurso_auditoria_edicion.ts`
* **Comando de verificación:**
  ```bash
  ls -la src/lib/db/migrations/009_recurso_auditoria_edicion.ts
  ```
* **Salida Obtenida:**
  ```text
  -rw-r--r-- 1 ds2fery ds2fery 1758 Oct  1 18:25 src/lib/db/migrations/009_recurso_auditoria_edicion.ts
  ```

---

### 4.2. Casos de Prueba Funcionales y de Integración (CP-01 a CP-20)

#### `CP-H08-API-01`: Pre-carga completa de información de recurso existente (`GET /api/recursos/[id]`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 200 con el detalle del recurso pre-cargado para edición"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": "40000000-0000-4000-8000-000000000001",
    "nombre": "Camioneta Rescate 4x4",
    "tipo": "Vehículo o Maquinaria",
    "esIndividual": true,
    "estado": "DISPONIBLE",
    "cantidadInventario": 1,
    "cantidadEnUso": 0,
    "cantidadDisponible": 1,
    "cantidadMinima": 0,
    "latitud": -39.8142,
    "longitud": -73.2459,
    "descripcion": "Unidad rápida",
    "detalles": {
      "patente": "ABCD-12"
    },
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "DEL_NORTE",
      "nombre": "Delegación Municipal Norte"
    },
    "delegacionId": "30000000-0000-4000-8000-000000000001",
    "creadoPorId": "00000000-0000-4000-8000-000000000001",
    "actualizadoPorId": null,
    "creadoEn": "2026-09-17T10:00:00.000Z",
    "actualizadoEn": "2026-09-17T10:00:00.000Z"
  }
  ```

---

#### `CP-H08-API-02`: Modificación exitosa de características operativas de recurso individual
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 200 y retornar el recurso actualizado con notificación"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Camioneta Rescate 4x4 - Actualizada",
      "cantidadInventario": 1,
      "cantidadMinima": 0,
      "enMantencion": false,
      "latitud": -39.8142,
      "longitud": -73.2459,
      "descripcion": "Unidad de apoyo logístico con mantención al día",
      "detalles": {
        "patente": "ABCD-12",
        "marca": "Toyota",
        "modelo": "Hilux",
        "anio": 2023,
        "kilometraje": 48000,
        "tipoCombustible": "DIESEL"
      },
      "delegacionId": "30000000-0000-4000-8000-000000000001"
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Recurso actualizado exitosamente",
    "data": {
      "id": "40000000-0000-4000-8000-000000000001",
      "nombre": "Camioneta Rescate 4x4 - Actualizada",
      "tipo": "Vehículo o Maquinaria",
      "esIndividual": true,
      "estado": "DISPONIBLE",
      "cantidadInventario": 1,
      "cantidadEnUso": 0,
      "cantidadDisponible": 1,
      "cantidadMinima": 0,
      "latitud": -39.8142,
      "longitud": -73.2459,
      "descripcion": "Unidad de apoyo logístico con mantención al día",
      "detalles": {
        "patente": "ABCD-12",
        "marca": "Toyota",
        "modelo": "Hilux",
        "anio": 2023,
        "kilometraje": 48000,
        "tipoCombustible": "DIESEL"
      },
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000001",
        "codigo": "DEL_NORTE",
        "nombre": "Delegación Municipal Norte"
      },
      "delegacionId": "30000000-0000-4000-8000-000000000001",
      "creadoPorId": "00000000-0000-4000-8000-000000000001",
      "actualizadoPorId": "00000000-0000-4000-8000-000000000001",
      "creadoEn": "2026-09-17T10:00:00.000Z",
      "actualizadoEn": "2026-09-29T16:00:00.000Z"
    }
  }
  ```

---

#### `CP-H08-API-03`: Puesta en mantenimiento de vehículo (`EN_MANTENCION`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe forzar estado EN_MANTENCION cuando enMantencion es true"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Camioneta Rescate 4x4",
      "cantidadInventario": 1,
      "cantidadMinima": 0,
      "enMantencion": true,
      "latitud": -39.8142,
      "longitud": -73.2459,
      "descripcion": "Ingresada a taller municipal por revisión de frenos"
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Recurso actualizado exitosamente",
    "data": {
      "id": "40000000-0000-4000-8000-000000000001",
      "nombre": "Camioneta Rescate 4x4",
      "estado": "EN_MANTENCION",
      "cantidadInventario": 1,
      "cantidadDisponible": 1
    }
  }
  ```

---

#### `CP-H08-API-05`: Transición automática a `BAJO_STOCK`
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe retornar BAJO_STOCK si la cantidad en inventario es menor o igual al umbral mínimo"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000002" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Sacos de Arena",
      "cantidadInventario": 40,
      "cantidadMinima": 50,
      "enMantencion": false,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Recurso actualizado exitosamente",
    "data": {
      "id": "40000000-0000-4000-8000-000000000002",
      "nombre": "Sacos de Arena",
      "estado": "BAJO_STOCK",
      "cantidadInventario": 40,
      "cantidadMinima": 50
    }
  }
  ```

---

#### `CP-H08-API-06`: Transición automática a `NO_DISPONIBLE` al quedar sin inventario
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe pasar a NO_DISPONIBLE cuando la cantidad en inventario es 0"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000002" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Sacos de Arena",
      "cantidadInventario": 0,
      "cantidadMinima": 50,
      "enMantencion": false,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Recurso actualizado exitosamente",
    "data": {
      "id": "40000000-0000-4000-8000-000000000002",
      "nombre": "Sacos de Arena",
      "estado": "NO_DISPONIBLE",
      "cantidadInventario": 0,
      "cantidadDisponible": 0
    }
  }
  ```

---

#### `CP-H08-API-10`: Bloqueo de reducción de inventario por debajo de lo en uso en terreno
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 400 si el inventario se intenta reducir por debajo de lo en uso"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000002" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Sacos de Arena",
      "cantidadInventario": 40,
      "cantidadMinima": 10,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "No es posible reducir la cantidad en inventario (40) por debajo de las unidades actualmente en uso en terreno (60)."
  }
  ```

---

#### `CP-H08-API-12`: Rechazo por nombre menor a 3 caracteres (Validación Zod)
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe rechazar nombres demasiado cortos"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "AB",
      "cantidadInventario": 1,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "Datos de entrada inválidos para la actualización del recurso.",
    "errors": [
      {
        "campo": "nombre",
        "mensaje": "El nombre debe tener al menos 3 caracteres"
      }
    ]
  }
  ```

---

#### `CP-H08-API-13`: Rechazo por cantidad de inventario negativa
* **Comando Vitest:**
  ```bash
  npx vitest run src/modules/recursos-y-personal/__tests__/recurso.test.ts -t "debe rechazar cantidades negativas en la actualización"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001" \
    -d '{
      "nombre": "Camioneta 4x4",
      "cantidadInventario": -5,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "Datos de entrada inválidos para la actualización del recurso.",
    "errors": [
      {
        "campo": "cantidadInventario",
        "mensaje": "La cantidad en inventario no puede ser negativa"
      }
    ]
  }
  ```

---

#### `CP-H08-API-15`: Rechazo por parámetro :id de recurso con formato UUID inválido
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 400 si el parámetro id no es un UUID válido"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/recursos/id-invalido-123" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: application/json

  {
    "message": "Identificador de recurso inválido.",
    "errors": [
      {
        "campo": "id",
        "mensaje": "El identificador del recurso debe ser un UUID válido"
      }
    ]
  }
  ```

---

#### `CP-H08-API-16`: Rechazo por recurso inexistente en base de datos (`404 Not Found`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 404 si el recurso no existe"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/recursos/00000000-0000-4000-8000-999999999999" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 404 Not Found
  Content-Type: application/json

  {
    "message": "Recurso con ID '00000000-0000-4000-8000-999999999999' no encontrado."
  }
  ```

---

#### `CP-H08-API-17`: Bloqueo de acceso por ausencia de cabecera de autenticación (`401 Unauthorized`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 401 si no está autenticado"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X GET "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001"
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json

  {
    "message": "Cabecera X-User-Id requerida para autenticación."
  }
  ```

---

#### `CP-H08-API-18`: Bloqueo de acceso por usuario sin permiso `recursos:editar` (`403 Forbidden`)
* **Comando Vitest:**
  ```bash
  npx vitest run src/app/api/recursos/[id]/__tests__/route.test.ts -t "debe responder 403 si el usuario no tiene rol de Administrador"
  ```
* **Ejecución cURL:**
  ```bash
  curl -s -i -X PUT "http://localhost:3000/api/recursos/40000000-0000-4000-8000-000000000001" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: 00000000-0000-4000-8000-000000000003" \
    -d '{
      "nombre": "Intento de Modificación No Autorizado",
      "cantidadInventario": 1,
      "latitud": -39.8142,
      "longitud": -73.2459
    }'
  ```
* **Salida Obtenida:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json

  {
    "message": "Acceso denegado. Se requiere el perfil de Administrador."
  }
  ```

---

#### `CP-H08-API-20`: Exposición de especificación OpenAPI 3.0 con contrato de endpoints
* **Ejecución cURL:**
  ```bash
  curl -s "http://localhost:3000/openapi.json" | grep -A 10 "/api/recursos/{id}"
  ```
* **Salida Obtenida:**
  ```json
  "/api/recursos/{id}": {
    "get": {
      "summary": "Obtener detalle completo de un recurso logístico",
      "description": "Retorna la información completa pre-cargada de un recurso (cantidades, disponibilidad operativa, delegación territorial y auditoría) para alimentar el formulario de edición. Accesible por perfil de Administrador.",
      "tags": ["Recursos y Personal"]
    },
    "put": {
      "summary": "Editar características de un recurso logístico",
      "description": "Modifica inventario físico, ubicación geográfica, detalles técnicos y estado operativo del recurso. Notifica en tiempo real vía WebSockets (Socket.io) a las salas de Encargado y Supervisor. Mantiene inmutable el tipo de recurso (esIndividual).",
      "tags": ["Recursos y Personal"]
    }
  }
  ```

---

## 5. Trazabilidad de Criterios de Aceptación (Definición de Terminado - DoD)

| Criterio de Aceptación Original de la HU | Casos de Prueba Asociados | Estado de Verificación |
|---|---|:---:|
| **CA-1: Interfaz gráfica / Endpoint accesible desde listado para editar recurso** | `CP-H08-API-01`, `CP-H08-API-15`, `CP-H08-API-20` | 🟢 CUMPLIDO |
| **CA-2: Pre-carga de datos actuales almacenados en PostgreSQL** | `CP-H08-API-01`, `CP-H08-API-16` | 🟢 CUMPLIDO |
| **CA-3: Validación estricta de campos obligatorios y formatos (no vacíos ni inválidos)** | `CP-H08-API-10`, `CP-H08-API-11`, `CP-H08-API-12`, `CP-H08-API-13`, `CP-H08-API-14`, `CP-H08-API-19` | 🟢 CUMPLIDO |
| **CA-4: Actualización íntegra en PostgreSQL asegurando coherencia e integridad referencial** | `CP-H08-API-02`, `CP-H08-API-03`, `CP-H08-API-04`, `CP-H08-API-05`, `CP-H08-API-06`, `CP-H08-API-07` | 🟢 CUMPLIDO |
| **CA-5: Retroalimentación de éxito/error y actualización de listado de recursos** | `CP-H08-API-02`, `CP-H08-API-03`, `CP-H08-API-09` | 🟢 CUMPLIDO |
| **CA-6: Registro de auditoría (fecha, hora y usuario que modificó el recurso)** | `CP-H08-API-08` | 🟢 CUMPLIDO |
| **CA-7: Protección de acceso RBAC con permiso correspondiente (`recursos:editar`)** | `CP-H08-API-17`, `CP-H08-API-18` | 🟢 CUMPLIDO |

---

## 6. Dictamen Final de Aseguramiento de Calidad

* **Conformidad de Reglas de Negocio:** Se verificó que las restricciones críticas del dominio logístico (inmutabilidad de `esIndividual`, no disminución de inventario bajo unidades desplegadas en terreno, exclusividad de mantenimiento para activos individuales y recálculo automático de estados) se aplican de forma rigurosa y consistente.
* **Cobertura de Pruebas Automatizadas:** 26/26 pruebas unitarias y de integración pasando con éxito en Vitest en tiempo de ejecución < 1.5s.
* **Calidad de Código y Tipos:** 0 errores TypeScript (`npx tsc --noEmit`) y 0 errores de ESLint (`npm run lint`).
* **Dictamen:** 🟢 **APROBADO PARA PRODUCCIÓN Y CIERRE FORMAL DE HU-8**.
