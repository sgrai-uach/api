# Estándar de Filtros y Paginación en Listados SGRAI

Este documento establece las convenciones transversales y obligatorias de arquitectura para todos los endpoints de listado y consulta tabular del backend **SGRAI** (`sgrai-api`), implementadas a partir de la historia **H34 (Filtros en Listados del Encargado)**.

---

## 1. Convenciones transversales

Todo endpoint que retorne colecciones de datos paginadas debe ceñirse a las siguientes directrices:

### 1.1 Paginación estándar (`page` / `limit`)
- **Parámetros de consulta (Query Params):** Se utiliza siempre `page` (número de página, 1-indexed, default: 1) y `limit` (elementos por página, default: 20, máximo: 100).
- **Esquema Zod:** Todo esquema de query para listados debe extender de `PaginationQuerySchema` (`src/lib/shared/pagination.schema.ts`).
- **Respuesta de metadatos:** Toda respuesta debe incluir el objeto `meta` validado con `PaginationMetaSchema`:

```typescript
export interface PaginationMeta {
  total: number;       // Conteo total de filas coincidentes en la base de datos
  page: number;        // Página actual retornada
  limit: number;       // Límite de elementos por página solicitado
  totalPages: number;  // Cantidad total de páginas (0 si total es 0)
  hasNext: boolean;    // true si existe página siguiente
  hasPrev: boolean;    // true si existe página previa
}
```

- **Helper:** Utilizar la función utilitaria `buildPaginationMeta(total, page, limit)` provista en `src/lib/shared/pagination.schema.ts`.

### 1.2 Filtro por Delegación Territorial (`delegacionId`)
- El parámetro de consulta para filtrar por delegación territorial **SIEMPRE** se llama `delegacionId` y recibe el **UUID** canónico de la delegación (`delegacion.id`).
- Nunca utilizar nombres textuales o descripciones en nuevos endpoints. (Para endpoints existentes con parámetros legados como `delegacion` en avisos, se preserva compatibilidad retroactiva pero `delegacionId` tiene prioridad resolutiva).
- En la base de datos se filtra directamente por la columna `delegacion_id` UUID o mediante JOINs territoriales.

### 1.3 Filtro por Estado Operativo (`estado`)
- El parámetro de consulta para filtrar por estado se llama `estado`.
- Los valores de estado se manejan canónicamente en **MAYÚSCULAS** y se validan mediante un `z.enum([...])` estricto en el esquema Zod.

### 1.4 Búsqueda Textual Libre (`busqueda`)
- El parámetro para búsqueda textual sobre múltiples atributos (código, nombres, descripciones, direcciones) se llama `busqueda`.
- En PostgreSQL se implementa mediante comparaciones case-insensitive `ILIKE` combinadas con `OR`.
- Se debe sanitizar comodines `%` y `_` cuando corresponda para evitar búsquedas de costo computacional desmedido.

---

## 2. Estructura de Respuesta Estándar

```json
{
  "message": "Listado de registros obtenido exitosamente",
  "data": [
    { "id": "...", "codigo": "..." }
  ],
  "meta": {
    "total": 45,
    "page": 2,
    "limit": 20,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## 3. Guía de Implementación para Futuros Endpoints

A continuación se documentan los esquemas predefinidos que **DEBEN** utilizarse al momento de implementar los endpoints de terreno pendientes:

### 3.1 Futuro `GET /api/patrullas` (Listado de Patrullas Verificadoras)

```typescript
import { z } from "zod";
import { PaginationQuerySchema } from "@/lib/shared/pagination.schema";

export const EstadoPatrullaEnum = z.enum([
  "DISPONIBLE",
  "EN_VERIFICACION",
  "NO_DISPONIBLE",
]);

export const ListarPatrullasQuerySchema = PaginationQuerySchema.extend({
  estado: EstadoPatrullaEnum.optional().openapi({
    description: "Filtrar por estado operativo de la patrulla",
    example: "DISPONIBLE",
  }),
  delegacionId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de delegación territorial asignada",
  }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda por nombre de la patrulla o personal líder",
  }),
});
```

### 3.2 Futuro `GET /api/cuadrillas` (Listado de Cuadrillas Operativas)

```typescript
import { z } from "zod";
import { PaginationQuerySchema } from "@/lib/shared/pagination.schema";

export const EstadoCuadrillaEnum = z.enum([
  "DISPONIBLE",
  "EN_MISION",
  "NO_DISPONIBLE",
]);

export const ListarCuadrillasQuerySchema = PaginationQuerySchema.extend({
  estado: EstadoCuadrillaEnum.optional().openapi({
    description: "Filtrar por estado operativo de la cuadrilla",
    example: "DISPONIBLE",
  }),
  delegacionId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de delegación territorial asignada",
  }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda por nombre de cuadrilla o delegado",
  }),
});
```

---

## 4. Endpoints de Catálogo para Poblar Controles de Filtros

Para poblar dinámicamente los menús desplegables de filtrado en el frontend (`sgrai-web` y `sgrai-pwa`), se debe consumir:
- `GET /api/catalogos`
  - `delegaciones`: Retorna lista `{ id: UUID, codigo: string, nombre: string }`.
  - `roles`: Retorna lista `{ id: UUID, codigo: string, nombre: string }`.
  - `cargos`: Lista de cadenas de cargos operativos existentes.
  - `especialidades`: Lista de cadenas de especialidades técnicas.
- Los enums de estado (`EstadoIncidente`, `EstadoMision`, `EstadoRecurso`, `EstadoOperativoPersonal`) son definiciones fijas del negocio modeladas en los contratos OpenAPI.
