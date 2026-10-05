# Handover Técnico: HU-13 y Adaptación de API para Administración y Baja de Empleados

**Fecha:** 29 de Septiembre de 2026  
**Módulo:** Recursos y Personal — Administración de Empleados (HU-12 / HU-13)  
**Rama:** `feature/H13-eliminar-empleado`  
**Proyectos involucrados:** `api` (Backend), `web` (Frontend)

---

## 1. Diagnóstico: Por qué el Frontend dejó de responder a la API

Al actualizar el frontend en la rama `feature/H13-eliminar-empleado` y realizar la refactorización modular según `docs/ARCHITECTURE.md`, se identificaron tres causas principales que provocaron fallas de conexión y errores en las consultas:

1. **Aislamiento de ramas y rutas faltantes en el servidor:**
   - La rama `feature/H13-eliminar-empleado` del backend había sido creada a partir de un commit previo a la integración global de endpoints (`test/integracion`).
   - El frontend actualizado requiere endpoints activos para incidentes, catálogos, personal y sockets en tiempo real. Al levantar la API de forma aislada, muchas consultas transversales retornaban `404 Not Found` o fallaban por timeout de WebSocket.

2. **Divergencia en el esquema de base de datos y tipado Kysely:**
   - Coexisten dos tablas en PostgreSQL: `usuario` (singular, utilizada por autenticación RBAC/Kanban) y `usuarios` (plural, tabla de funcionarios con `nombres`, `apellidos`, `password_hash`, etc. creada por migraciones de personal).
   - En `src/lib/db/types.ts`, `usuarios` estaba mapeada al tipo de `usuario`, provocando inconsistencias en consultas Kysely y fallas de compilación TypeScript.
   - La migración `003_alinear_erd_informante_incidente.ts` intentaba recrear columnas existentes en bases de datos locales previas, bloqueando la inicialización del esquema.

3. **Discrepancia en contratos de respuesta (`ApiResponse<T>`) y Códigos de Error:**
   - El cliente de frontend (`web/src/lib/utils/errorUtils.ts` y `web/src/types/common.ts`) espera respuestas estandarizadas con las propiedades `data`, `message` (o `error`), y listas de errores de validación en `detalles` o `errors`.
   - Las rutas de personal retornaban únicamente `mensaje` en español, sin la propiedad estándar `message`, lo que causaba que capturas de error genéricas mostraran mensajes de fallback.
   - En auditoría (`log_cambios_usuarios`), si el encabezado `x-user-id` enviado por el frontend contenía un UUID que no existía en la tabla `usuarios`, PostgreSQL lanzaba un error de clave foránea (`foreign key constraint violation`), provocando un `500 Internal Server Error` inesperado al intentar dar de baja o actualizar un empleado.

---

## 2. Adaptaciones Implementadas en la API

### 2.1. Endpoints Estandarizados (`/api/personal`)

#### A. Baja Lógica de Empleado (`DELETE /api/personal/[id]`)
- **Ruta:** `DELETE /api/personal/:id`
- **Comportamiento:**
  - Resuelve polimórficamente si `:id` es un `usuarios.id` o un `personal.id`.
  - Ejecuta una transacción atómica que:
    1. Marca `usuarios.activo = false`.
    2. Establece `usuarios.fecha_salida` (si no poseía una).
    3. Si posee ficha operativa en `personal`, fija `estado_operativo = 'inactivo'` y `disponible_terreno = false`.
    4. Valida defensivamente el encabezado `x-user-id`: si existe en `usuarios`, se asocia a la auditoría; si no existe, se registra como `null` para prevenir violación de llave foránea.
- **Respuesta:**
  ```json
  {
    "message": "Empleado dado de baja exitosamente",
    "mensaje": "Empleado dado de baja exitosamente",
    "data": {
      "usuario_id": "c13876eb-c7b4-4e44-8d43-02f6a7042571",
      "activo": false,
      "fecha_salida": "2026-09-29"
    }
  }
  ```

#### B. Consulta Individual de Empleado (`GET /api/personal/[id]`)
- **Ruta:** `GET /api/personal/:id`
- Permite al frontend recargar de forma reactiva la ficha de un empleado tras ser editado o antes de abrir el modal de confirmación de baja.
- Retorna el objeto `EmpleadoUsuario` enriquecido con `es_personal` y datos de roles y delegaciones.

#### C. Listado y Búsqueda de Personal (`GET /api/personal`)
- **Ruta:** `GET /api/personal`
- **Parámetros soportados:**
  - `q`: Término de búsqueda (RUT, nombres, apellidos, email).
  - `delegacion_id`: UUID de delegación territorial.
  - `rol_id`: UUID de rol funcional.
  - `ordenar_por`: Campo de ordenamiento (`apellidos`, `nombres`, `rut`).
  - `orden`: Dirección (`asc` o `desc`).
  - `estado`: Filtro de estado (`activo`, `inactivo`, `todos`).
  - `incluir_inactivos`: Booleano para incluir personal dado de baja.
  - `pagina` / `page`: Número de página (default 1).
  - `limite` / `limit`: Cantidad por página (default 50, máx 100).
- **Respuesta:**
  ```json
  {
    "data": [ ... ],
    "paginacion": {
      "pagina": 1,
      "limite": 50,
      "total_retornados": 24
    }
  }
  ```

#### D. Actualización de Empleado (`PATCH /api/personal/[id]`)
- **Ruta:** `PATCH /api/personal/:id`
- Valida con Zod (`ModificarEmpleadoSchema`).
- Retorna `message`, `mensaje`, `data` en caso exitoso (`200 OK`).
- En caso de errores de validación (`422 Unprocessable Entity`), entrega:
  ```json
  {
    "error": "Datos de entrada inválidos",
    "message": "Datos de entrada inválidos",
    "detalles": [
      { "campo": "rut", "mensaje": "Formato de RUT chileno inválido" }
    ],
    "errors": [
      { "campo": "rut", "mensaje": "Formato de RUT chileno inválido" }
    ]
  }
  ```
  Esto permite que el helper `formatApiError` del frontend parseé y visualice de inmediato las etiquetas de campo en `NotificationBanner`.

---

## 3. Integración con el Frontend (`web`)

El frontend en `web` interactúa directamente a través de:
- [empleadosService.ts](file:///home/jonagu/Proyectos/SGRAI/github/web/src/services/empleadosService.ts): Capa DAL que invoca `/api/personal` y `/api/catalogos`.
- [useAdminEmpleados.ts](file:///home/jonagu/Proyectos/SGRAI/github/web/src/hooks/useAdminEmpleados.ts): Hook de orquestación de estado que gestiona selección, scroll inteligente y confirmación de baja lógica.
- [EmpleadoBajaModal.tsx](file:///home/jonagu/Proyectos/SGRAI/github/web/src/components/admin/empleados/EmpleadoBajaModal.tsx): Modal atómico con retroalimentación de carga y alertas de confirmación.

Las peticiones desde el navegador son reescritas transparentemente mediante `next.config.ts` de Next.js (puerto 3001 a backend 3000):
```ts
// web/next.config.ts
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: `${apiBackendUrl}/api/:path*`,
    },
  ];
}
```

---

## 4. Pruebas y Validación

1. **Chequeo de Tipos TypeScript (`npx tsc --noEmit`):**
   - Backend `api`: 0 errores.
   - Frontend `web`: 0 errores.

2. **Suite de Pruebas Automatizadas Backend (`npm test`):**
   - 20 archivos de prueba ejecutados y aprobados (150/150 tests pasando).
   - Se incorporó la suite específica [eliminar-empleado.test.ts](file:///home/jonagu/Proyectos/SGRAI/github/api/src/modules/recursos-y-personal/__tests__/eliminar-empleado.test.ts) que valida:
     - Lanzamiento de `EmpleadoNotFoundError` (404) para IDs no existentes.
     - Baja lógica exitosa de usuarios sin ficha operativa en `personal`.
     - Desactivación concurrente de usuario y ficha operativa para personal de terreno.
     - Sanitización de auditoría frente a `modificado_por_id` inválido.
