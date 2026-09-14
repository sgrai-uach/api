# Handover Técnico para Frontend (`sgrai-web`): Visualización de Permisos por Perfil (HU-4)

> **Destinatario:** Equipo de desarrollo frontend (`sgrai-web`) y Asistente IA (Gemini 3.8 Flash).  
> **Origen:** Backend monolítico `sgrai-api` (`feature/H4-visualizar-permisos`).  
> **Versión API:** `v0.3.0` (SemVer).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json`.  

---

## 1. Contexto y Objetivos de la Historia de Usuario

### Historia de Usuario
> **Como** Administrador  
> **Quiero** ver un listado de los permisos actuales de cada perfil  
> **Para** saber qué acciones tiene permitidas cada grupo de usuarios en la plataforma.

### Criterios de Aceptación a Implementar en Frontend:
1. **Listado de perfiles:** Presentar una interfaz que liste todos los roles/perfiles del sistema (`Administrador`, `Encargado`, `Call Center`, `Patrulla Verificadora`, `Delegado de Cuadrilla`, `Asistente Social`, `Informante`, etc.).
2. **Despliegue interactivo de permisos:** Al hacer clic o interactuar con un rol, desplegar claramente los permisos y acciones a las que tiene acceso, **agrupados visualmente por `modulo`** (`Seguridad`, `Incidentes`, `Recursos y Personal`, `Misiones`, `Eventos ATP`).
3. **Control de Acceso RBAC:** La vista debe ser accesible **únicamente por usuarios con rol de "Administrador"**. Si un usuario sin este rol intenta ingresar, mostrar pantalla o alerta de acceso denegado (`403 Forbidden`).
4. **Estado vacío ("Sin permisos asignados"):** Si un rol no tiene permisos asignados en la base de datos (`permisos: []` y `cantidadPermisos: 0`), mostrar un estado visual claro indicando *"Sin permisos asignados"*.
5. **Rendimiento:** El tiempo de carga total percibido no debe superar los **1.5 segundos** (implementar Skeleton Loaders durante la carga).
6. **Escalabilidad hacia H5:** La vista debe estar maquetada pensando en que la siguiente historia de usuario (**H5**) permitirá interactuar para asignar o revocar permisos sobre este mismo panel (dejar placeholders o componentes preparados para toggles/checkboxes de edición).

---

## 2. Contrato de API y Endpoints Disponibles

La API corre por defecto en `http://localhost:3000` y expone cabeceras CORS habilitadas para `sgrai-web`.

### Autenticación Requerida
Todos los endpoints de seguridad requieren identificar al usuario mediante la cabecera HTTP:
```http
X-User-Id: <UUID-DEL-USUARIO>
```
*(También se admite `Authorization: Bearer <UUID-DEL-USUARIO>`)*.

> **Usuarios de Prueba Sembrados en Base de Datos:**
> - **Administrador General (Acceso Permitido):**  
>   `X-User-Id: 00000000-0000-4000-8000-000000000001`  
>   *(RUT: `11111111-1`, Email: `admin@valdivia.cl`, Rol: `Administrador`)*
> - **Operador Call Center (Acceso Denegado 403):**  
>   `X-User-Id: 00000000-0000-4000-8000-000000000002`  
>   *(RUT: `22222222-2`, Email: `callcenter@valdivia.cl`, Rol: `Call Center`)*

---

### Endpoint 1: Listar Todos los Perfiles y sus Permisos
- **Método:** `GET`
- **Ruta:** `/api/seguridad/roles`
- **Cabeceras:** `X-User-Id: 00000000-0000-4000-8000-000000000001`
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "data": [
    {
      "id": "20000000-0000-4000-8000-000000000001",
      "nombre": "Administrador",
      "descripcion": "Acceso total y configuración del sistema",
      "activo": true,
      "esSistema": true,
      "cantidadPermisos": 9,
      "permisos": [
        {
          "id": "10000000-0000-4000-8000-000000000003",
          "codigo": "seguridad:roles:leer",
          "nombre": "Visualizar Roles y Permisos",
          "descripcion": "Permite consultar el listado y detalle de perfiles y sus permisos actuales",
          "modulo": "Seguridad",
          "asignadoEn": "2026-09-13T23:00:00.000Z",
          "asignadoPorId": "00000000-0000-4000-8000-000000000001"
        },
        {
          "id": "10000000-0000-4000-8000-000000000005",
          "codigo": "incidentes:avisos:leer",
          "nombre": "Listar Bandeja de Avisos",
          "descripcion": "Permite consultar los avisos pendientes en la bandeja de Call Center",
          "modulo": "Incidentes",
          "asignadoEn": "2026-09-13T23:00:00.000Z",
          "asignadoPorId": "00000000-0000-4000-8000-000000000001"
        }
      ],
      "creadoEn": "2026-09-13T23:00:00.000Z",
      "actualizadoEn": "2026-09-13T23:00:00.000Z"
    },
    {
      "id": "20000000-0000-4000-8000-000000000008",
      "nombre": "Observador Sin Permisos",
      "descripcion": "Perfil de auditoría sin permisos operativos activos",
      "activo": true,
      "esSistema": false,
      "cantidadPermisos": 0,
      "permisos": [],
      "creadoEn": "2026-09-13T23:00:00.000Z",
      "actualizadoEn": "2026-09-13T23:00:00.000Z"
    }
  ],
  "total": 8
}
```

---

### Endpoint 2: Detalle de un Perfil Específico
- **Método:** `GET`
- **Ruta:** `/api/seguridad/roles/{id}`
- **Cabeceras:** `X-User-Id: 00000000-0000-4000-8000-000000000001`
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "data": {
    "id": "20000000-0000-4000-8000-000000000001",
    "nombre": "Administrador",
    "descripcion": "Acceso total y configuración del sistema",
    "activo": true,
    "esSistema": true,
    "cantidadPermisos": 9,
    "permisos": [ ... ],
    "creadoEn": "2026-09-13T23:00:00.000Z",
    "actualizadoEn": "2026-09-13T23:00:00.000Z"
  }
}
```

---

### Errores HTTP que Frontend debe Manejar

| Código | Significado | Causa en Backend | Acción UI Recomendada |
|---|---|---|---|
| `401 Unauthorized` | Sesión no válida | No se envió cabecera `X-User-Id` o usuario inactivo | Redirigir al Login |
| `403 Forbidden` | Acceso Denegado | El usuario logueado no tiene rol `Administrador` | Mostrar componente de acceso denegado (ej. *"Se requiere perfil Administrador"* ) |
| `404 Not Found` | No Encontrado | El ID de rol solicitado en la ruta no existe | Notificación toast de error y regresar al listado |
| `500 Server Error` | Error de servidor | Fallo inesperado en base de datos | Mostrar mensaje de reintento |

---

## 3. Definición de Tipos TypeScript para Frontend

Pueden generar automáticamente los tipos desde el OpenAPI con:
```bash
npx openapi-typescript http://localhost:3000/openapi.json -o src/types/api.ts
```
O utilizar directamente estas interfaces:

```typescript
export interface PermisoAsignado {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo: string;
  asignadoEn: string;
  asignadoPorId: string | null;
}

export interface RolItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  esSistema: boolean;
  cantidadPermisos: number;
  permisos: PermisoAsignado[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface ListarRolesResponse {
  data: RolItem[];
  total: number;
}

export interface RolDetalleResponse {
  data: RolItem;
}
```

---

## 4. Guía de Diseño y Estructura UI Recomendada (`sgrai-web`)

Para cumplir con la guía de estilo institucional de la Municipalidad de Valdivia descrita en `GEMINI.md`:
- **Colores Institucionales:** Azul marino principal (`#003366` / `#0f2d59`), acentos en verde esmeralda (`#10b981`), fondos grises neutros (`#f8fafc` o dark mode correspondiente) y bordes sutiles.
- **Tipografía:** `Inter` o `Roboto`.

### Jerarquía de Componentes Sugerida

```
src/
└── app/
    └── (admin)/
        └── roles-permisos/
            ├── page.tsx                     // Contenedor principal con fetch y protección RBAC
            ├── _components/
            │   ├── RolesHeader.tsx          // Título, buscador y métricas totales
            │   ├── RolesGrid.tsx            // Grilla de tarjetas o tabla de perfiles
            │   ├── RolCard.tsx              // Tarjeta individual de perfil con badge contador
            │   ├── RolDetalleDrawer.tsx     // Panel lateral/modal con permisos agrupados
            │   ├── PermisosAgrupados.tsx    // Acordeón o secciones agrupadas por modulo
            │   ├── SinPermisosState.tsx     // Estado vacío para roles sin permisos (Criterio 4)
            │   └── RolesSkeleton.tsx        // Skeleton loader para cumplir latencia < 1.5s
```

---

## 5. Lógica de UI Clave para la IA de Frontend

### A. Agrupación de Permisos por Módulo en Detalle
Al abrir el detalle de un rol, transformar el arreglo plano `rol.permisos` agrupándolo por su propiedad `modulo`:

```typescript
// Helper de agrupación para el componente PermisosAgrupados.tsx
export function agruparPermisosPorModulo(permisos: PermisoAsignado[]): Record<string, PermisoAsignado[]> {
  return permisos.reduce((acc, permiso) => {
    const modulo = permiso.modulo || "General";
    if (!acc[modulo]) {
      acc[modulo] = [];
    }
    acc[modulo].push(permiso);
    return acc;
  }, {} as Record<string, PermisoAsignado[]>);
}
```

### B. Manejo del Criterio 4 ("Sin permisos asignados")
Si `rol.cantidadPermisos === 0` o `rol.permisos.length === 0`:
- **En la tarjeta/grilla:** Mostrar un badge gris o ámbar: `0 permisos asignados`.
- **En el panel de detalle:** Renderizar un contenedor con ícono de escudo o candado vacío y el texto:
  > *"Este perfil no cuenta con permisos asignados actualmente en el sistema."*

### C. Preparación Arquitectónica para HU-5 (Asignar/Revocar Permisos)
- Cada fila o chip de permiso puede renderizar un checkbox o switch deshabilitado (`disabled`), que en la historia H5 se convertirá en un control interactivo para mutar permisos.
- Diseñar el panel de detalle con un botón secundario preparado: `[Modificar Permisos]` (puede mostrar un tooltip *"Próximamente"* o estar deshabilitado hasta la implementación de H5).

### D. Ejemplo de Hook de Fetching con SWR o TanStack Query
```typescript
import { useQuery } from "@tanstack/react-query";
import type { ListarRolesResponse } from "@/types/api";

export function useRolesYPermisos(usuarioId: string) {
  return useQuery<ListarRolesResponse>({
    queryKey: ["seguridad", "roles"],
    queryFn: async () => {
      const res = await fetch("http://localhost:3000/api/seguridad/roles", {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": usuarioId,
        },
      });

      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error("ERROR_FETCH_ROLES");

      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de caché cliente
  });
}
```

---

## 6. Checklist de Verificación para Frontend

- [ ] ¿La ruta valida que el usuario logueado sea `Administrador` antes de mostrar la pantalla?
- [ ] ¿Se envía la cabecera `X-User-Id` en las peticiones a `/api/seguridad/roles`?
- [ ] ¿Se muestra la grilla con todos los perfiles (`Administrador`, `Call Center`, `Encargado`, etc.)?
- [ ] ¿Al seleccionar un perfil se despliegan sus permisos clasificados por `modulo` (`Seguridad`, `Incidentes`, etc.)?
- [ ] ¿El perfil `Observador Sin Permisos` muestra claramente el estado *"Sin permisos asignados"*?
- [ ] ¿Se renderiza un Skeleton Loader durante la carga garantizando una transición inferior a 1.5s?
- [ ] ¿Si se ingresa con un usuario no administrador, se muestra correctamente la alerta de acceso denegado (`403`)?
