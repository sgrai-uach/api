# Guía de Handover y Contratos de API: HU-7 — Listar Recursos

Esta guía técnica está dirigida a los desarrolladores de **`sgrai-web`** para la integración y renderizado del listado de inventario logístico municipal, cumpliendo con los criterios de aceptación de la historia de usuario **HU-7: Listar Recursos**.

---

## 1. Endpoint y Parámetros

- **Método:** `GET`
- **Ruta:** `/api/recursos`
- **Autenticación Requerida:** Cabecera `X-User-Id` (o `Authorization: Bearer <usuarioId>`) correspondiente a un usuario con rol de **Administrador**.

### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `pagina` | `number` | `1` | Número de página para paginación o carga infinita. |
| `limite` | `number` | `10` | Cantidad de registros por página (máx. 100). |
| `delegacionId` | `UUID` | - | Filtrar por identificador de delegación. |
| `estado` | `string` | - | Filtrar por estado: `DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`. |
| `esIndividual` | `boolean` | - | Filtrar por tipo: `true` (Vehículo/Maquinaria) o `false` (Materiales/Insumos). |
| `busqueda` | `string` | - | Texto para búsqueda en tiempo real sobre nombre o descripción. |

---

## 2. Contrato de Respuesta JSON (`200 OK`)

```typescript
export interface RecursoItem {
  id: string;
  nombre: string;
  tipo: "Vehículo o Maquinaria" | "Material o Insumo";
  esIndividual: boolean;
  estado: "DISPONIBLE" | "ASIGNADO" | "EN_MANTENCION" | "BAJO_STOCK" | "NO_DISPONIBLE";
  cantidadInventario: number;
  cantidadEnUso: number;
  cantidadDisponible: number;
  cantidadMinima: number;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  detalles: Record<string, unknown>;
  delegacion: {
    id: string;
    codigo: string; // ej. "DEL_NORTE", "DEL_SUR", "DEL_COSTA", "DEL_CALLE_CALLE"
    nombre: string; // ej. "Delegación Municipal Norte"
  } | null;
  creadoPorId: string;
  creadoEn: string; // ISO 8601
  actualizadoEn: string;
}

export interface ListarRecursosPaginadosResponse {
  data: RecursoItem[];
  meta: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
}
```

---

## 3. Criterios de Aceptación y Renderizado en el Frontend

### 3.1. Badges Visuales de Disponibilidad

Se recomienda aplicar los siguientes estilos de badges acordes a la paleta institucional municipal:

| Estado | Color de Fondo | Color de Texto | Significado |
|---|---|---|---|
| `DISPONIBLE` | `#E8F5E9` (Verde claro) | `#2E7D32` (Verde oscuro) | Recurso disponible en base para asignación inmediata. |
| `ASIGNADO` | `#E3F2FD` (Azul claro) | `#1565C0` (Azul oscuro) | Recurso desplegado en terreno en misión activa. |
| `EN_MANTENCION` | `#FFF3E0` (Naranja claro) | `#E65100` (Naranja oscuro) | En taller técnico o mantenimiento preventivo. |
| `BAJO_STOCK` | `#FFFDE7` (Amarillo claro) | `#F57F17` (Ámbar oscuro) | Stock libre inferior o igual al umbral mínimo de alerta. |
| `NO_DISPONIBLE` | `#FFEBEE` (Rojo claro) | `#C62828` (Rojo oscuro) | Stock en 0 o inhabilitado administrativamente. |

### 3.2. Estado de Inventario Vacío (Empty State)

Cuando `data.length === 0` (y `meta.total === 0`):
* El sistema **NO** debe mostrar error ni alerta roja.
* Mostrar un recuadro amigable con el mensaje explícito:
  > **"No hay recursos registrados"**
  > *Actualmente no existen recursos ingresados en el inventario logístico municipal o no hay coincidencias con los filtros aplicados.*
* Ofrecer el botón directo **"+ Registrar Nuevo Recurso"** que redirige a `/recursos/nuevo`.

---

## 4. Ejemplo de Integración con Hook / SWR en `sgrai-web`

```typescript
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, {
    headers: {
      "X-User-Id": "00000000-0000-4000-8000-000000000001", // ID del administrador en sesión
    },
  }).then((res) => {
    if (!res.ok) throw new Error("Error al obtener inventario");
    return res.json();
  });

export function useRecursos(pagina = 1, limite = 10, estado?: string, busqueda?: string) {
  const params = new URLSearchParams({
    pagina: String(pagina),
    limite: String(limite),
    ...(estado ? { estado } : {}),
    ...(busqueda ? { busqueda } : {}),
  });

  const { data, error, isLoading, mutate } = useSWR(
    `http://localhost:3001/api/recursos?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: true }
  );

  return {
    recursos: data?.data ?? [],
    meta: data?.meta,
    cargando: isLoading,
    error,
    recargar: mutate,
  };
}
```

---

## 5. Tipos Automáticos desde OpenAPI

La especificación completa del endpoint `GET /api/recursos` y sus esquemas Zod se encuentran disponibles en:
```bash
GET http://localhost:3001/openapi.json
```
Pueden ejecutar el generador de tipos (`openapi-typescript`) en `sgrai-web` para sincronizar los tipos de TypeScript sin escribirlos manualmente.
