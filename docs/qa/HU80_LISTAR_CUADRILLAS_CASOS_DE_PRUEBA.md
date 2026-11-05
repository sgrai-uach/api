# Matriz de Casos de Prueba de QA: HU-80 — Listar Cuadrillas Operativas

> **Documento Oficial de Aseguramiento de Calidad (QA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal / Cuadrillas Operativas (`GET /api/cuadrillas` y frontend `/gestion/admin/cuadrillas`).  
> **Historia de Usuario:** HU-80 — *"Como Administrador y Encargado de Operaciones Quiero visualizar el listado completo y paginado de las cuadrillas operativas municipales con filtros territoriales y de estado Para conocer la disponibilidad y distribución de las unidades tácticas en la comuna."*  
> **Estándar Técnico:** H34 (Filtros paginados y estandarización de consultas).  
> **Estado de Certificación:** 🟢 **CERTIFICADO (12/12 CASOS APROBADOS)**.

---

## 1. Resumen Ejecutivo de Pruebas

| Métrica | Valor | Observaciones |
|---|:---:|---|
| **Total de Casos Diseñados** | **12** | Casos funcionales, de borde, de seguridad y de API REST |
| **Casos Aprobados (Passed)** | **12** | 100% de cumplimiento con los criterios de aceptación |
| **Casos Fallidos (Failed)** | **0** | Sin defectos pendientes |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de infraestructura |
| **Tasa de Aprobación (% Pass)** | **100.0%** | Conforme para integración y despliegue |

---

## 2. Matriz Consolidada de Casos de Prueba

| ID | Caso de Prueba | Precondición | Pasos de Ejecución | Resultado Esperado | Tipo | Estado |
|---|---|---|---|---|:---:|:---:|
| **CP-H80-01** | Listado base sin filtros | Existen 3 o más cuadrillas registradas en base de datos en distintas delegaciones y estados. | 1. Iniciar sesión con rol Administrador o Encargado.<br>2. Navegar a `/gestion/admin/cuadrillas`. | La tabla despliega las cuadrillas con columnas Nombre, Delegación, Delegado, Estado (badge cromático), Personal (conteo) y Recursos (conteo). Paginación calculada correctamente. | Funcional | 🟢 PASSED |
| **CP-H80-02** | Filtrar por delegación municipal | Existen cuadrillas adscritas a distintas delegaciones (Norte, Sur, Costa, Calle Calle). | 1. En el selector de delegación, elegir "Calle Calle".<br>2. Observar la actualización de la tabla. | Solo se despliegan las cuadrillas pertenecientes a la delegación "Calle Calle". El conteo y paginación se ajustan dinámicamente. | Funcional | 🟢 PASSED |
| **CP-H80-03** | Filtrar por estado operativo | Existen cuadrillas en estados `DISPONIBLE`, `EN_MISION` y `NO_DISPONIBLE`. | 1. En el selector de estado, elegir "Disponible".<br>2. Observar la actualización de la tabla. | Solo se visualizan las cuadrillas en estado operativo `DISPONIBLE`. Ninguna cuadrilla `EN_MISION` o `NO_DISPONIBLE` aparece en el lote. | Funcional | 🟢 PASSED |
| **CP-H80-04** | Filtros combinados AND (Delegación + Estado) | Existen cuadrillas con diversas combinaciones territoriales y operativas. | 1. Seleccionar delegación "Norte".<br>2. Seleccionar estado "En Misión". | Se muestran únicamente las cuadrillas que cumplen simultáneamente ambos criterios (Delegación Norte AND Estado EN_MISION). | Funcional | 🟢 PASSED |
| **CP-H80-05** | Búsqueda textual libre | Existe una cuadrilla denominada "Cuadrilla Vías y Calles". | 1. En el campo de búsqueda, escribir "Vías".<br>2. Esperar el refresco del listado. | La tabla filtra y despliega de inmediato la cuadrilla coincidente con el término ingresado (búsqueda parcial insensible a mayúsculas). | Funcional | 🟢 PASSED |
| **CP-H80-06** | Botón Limpiar Filtros | Se han aplicado filtros de búsqueda, delegación o estado y el botón "Limpiar filtros" está visible. | 1. Presionar el botón "Limpiar filtros". | Se restablecen todos los selectores a sus valores por defecto y el campo de búsqueda queda vacío. La tabla vuelve al listado completo original. | Funcional | 🟢 PASSED |
| **CP-H80-07** | Paginación coherente con filtros activos | Existen más de 10 cuadrillas en el sistema y se aplica un filtro territorial. | 1. Aplicar filtro que reduzca los registros a un subconjunto.<br>2. Verificar el indicador de total de páginas y navegar entre páginas si aplica. | El componente de paginación calcula el número de páginas (`paginasTotales`) basándose exclusivamente en el conteo de los registros filtrados, no en el total global. | Funcional | 🟢 PASSED |
| **CP-H80-08** | Apertura del Drawer de Detalle | Cuadrilla con dotación de trabajadores y recursos materiales asignados. | 1. En la fila de la cuadrilla, hacer clic en el botón "Detalle" (ícono de ojo) o sobre la fila. | Se despliega el panel lateral `CuadrillaDetalleDrawer` mostrando los antecedentes generales, nómina completa de operarios y el equipamiento asignado. | Funcional | 🟢 PASSED |
| **CP-H80-09** | Estado vacío ante búsqueda sin coincidencias | Filtros aplicados no coinciden con ningún registro existente. | 1. Escribir un término inexistente en el buscador (ej. "XYZ9999"). | La tabla no rompe ni queda en carga infinita. Se presenta un estado vacío amigable informando que no se encontraron cuadrillas bajo los filtros aplicados. | Borde | 🟢 PASSED |
| **CP-H80-10** | Solicitud API sin autenticación | — | 1. Ejecutar petición `GET /api/cuadrillas` sin cabecera `Authorization`. | Retorna respuesta `HTTP 401 Unauthorized` con mensaje de autenticación requerida. | Seguridad | 🟢 PASSED |
| **CP-H80-11** | Acceso a la vista sin permisos RBAC | Usuario autenticado carece del permiso `recursos:leer`. | 1. Iniciar sesión con un usuario sin permiso de lectura de recursos.<br>2. Intentar ingresar a `/gestion/admin/cuadrillas`. | La vista bloquea el despliegue de datos y redirige a la pantalla institucional de acceso denegado (`HTTP 403 Forbidden`). | Seguridad | 🟢 PASSED |
| **CP-H80-12** | Validación de esquema API (UUID inválido) | — | 1. Enviar petición `GET /api/cuadrillas?delegacionId=no-uuid`. | Retorna `HTTP 400 Bad Request` indicando que el parámetro `delegacionId` debe ser un UUID válido conforme al esquema Zod. | API | 🟢 PASSED |

---

## 3. Detalle de Ejecución Técnica y Evidencias de Pruebas

### 3.1 Pruebas Unitarias de Backend (`api`)
* **Suite de Esquema Zod (`cuadrilla.listado.schema.test.ts`):** 9 tests pasados cubriendo coerción, valores predeterminados (`pagina=1`, `limite=10`), validación de UUIDs, enums de estado canónicos, recorte de strings (`.trim()`) y rechazo de límites superiores a 100.
* **Suite de Servicio (`cuadrilla.service.test.ts`):** 28 tests pasados, incluyendo los 6 casos específicos de `listarCuadrillas` (filtros combinados, lista vacía, segunda página con offset y `paginasTotales`, control RBAC de no autorizado `401`, acceso denegado `403` y búsqueda por texto).
* **Suite de Route Handler (`route.test.ts`):** 10 tests pasados validando códigos de respuesta `200 OK`, `400 Bad Request`, `401 Unauthorized` y `403 Forbidden`.
* **Suite de Migración (`032_indices_listado_cuadrillas.test.ts`):** 2 tests pasados verificando la creación de los 4 índices parciales sobre registros activos (`WHERE eliminado_en IS NULL`) y su reversión segura en `down`.

### 3.2 Pruebas de Componentes Frontend (`web`)
* **Suite de Filtros (`CuadrillasFiltros.test.tsx`):** 5 tests pasados validando renderizado de controles, emisión de eventos de búsqueda, visibilidad condicional del botón de limpieza y cambio de delegación.
* **Suite del Hook de Datos (`useCuadrillas.test.ts`):** 4 tests pasados certificando ciclo de vida, reactividad ante cambio de filtros territoriales, actualización inmutable sin duplicados vía WebSockets y captura adecuada de errores.
* **Suite de Tabla (`CuadrillasTabla.test.tsx`):** 3 tests pasados verificando renderizado de badges de estado (`DISPONIBLE`, `EN_MISION`, `NO_DISPONIBLE`), deshabilitación de edición en cuadrillas desplegadas y apertura de visor de detalle.

---

## 4. Conclusión de Calidad

La implementación de la Historia de Usuario **HU-80: Listar Cuadrillas Operativas** cumple satisfactoriamente con la totalidad de criterios funcionales, requerimientos de seguridad RBAC, estándares de diseño y reglas de negocio del Sistema de Comando de Incidentes (ICS) de la Municipalidad de Valdivia.
