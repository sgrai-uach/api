# Guía de Handover Técnico para Frontend (`sgrai-web`): Listado e Inventario de Recursos (HU-7)

> **Destinatario:** Equipo de desarrollo frontend (`sgrai-web`) y Asistente IA.  
> **Origen:** Backend monolítico modular `sgrai-api` (`feature/H7-listar-recursos`).  
> **Versión API:** `v0.3.0` (SemVer).  
> **Especificación OpenAPI:** `GET http://localhost:3001/openapi.json`.  
> **Ruta del Frontend Asociada:** `/recursos` (o `app/(admin)/recursos/page.tsx`).

---

## 1. Contexto y Objetivos de la Historia de Usuario

### Historia de Usuario
> **Como** Administrador  
> **Quiero** ver un listado de los recursos  
> **Para** corroborar la disponibilidad de estos.

### Criterios de Aceptación a Implementar en `sgrai-web`:
1. **Visualización de Tabla/Listado de Inventario:** El sistema debe desplegar una tabla responsiva con todos los recursos logísticos registrados en la base de datos municipal.
2. **Columnas e Información Esencial por Fila:**
   - **Nombre del recurso:** Nombre descriptivo (ej. *Camioneta Rescate 4x4*, *Sacos de Arena*, *Motobomba 3 HP*).
   - **Tipo:** Diferenciar claramente entre *"Vehículo o Maquinaria"* (individual serializado) y *"Material o Insumo"* (a granel/volumen).
   - **Disponibilidad y Stock:** Mostrar la cantidad disponible para despacho (`cantidadDisponible`), la cantidad en terreno/uso (`cantidadEnUso`) y el inventario total (`cantidadInventario`), junto con la cantidad mínima de alerta (`cantidadMinima`).
   - **Procedencia Territorial (Delegación):** Mostrar el nombre de la delegación territorial a la que pertenece (*Delegación Municipal Norte, Sur, Costa o Calle Calle*), o un indicador de *"Reserva Central"* si no tiene delegación asignada.
   - **Badge de Estado de Disponibilidad Actual:** Mostrar badges de colores diferenciados para cada uno de los 5 estados posibles (`DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`).
3. **Paginación y Filtros en Servidor:**
   - Controles de paginación para navegar páginas y cambiar el límite de elementos por página (`10`, `25`, `50`).
   - Barra de búsqueda de texto en tiempo real con *debounce* (busca por nombre y descripción).
   - Filtros desplegables por **Estado de Disponibilidad** y por **Delegación Territorial**.
4. **Mensaje de Estado Vacío (*Empty State*):**
   - Si no hay recursos registrados (o los filtros devuelven 0 resultados), mostrar un recuadro institucional con el mensaje claro: **"No hay recursos registrados"**, acompañado de un botón directo para **"+ Registrar Nuevo Recurso"** hacia `/recursos/nuevo`.
5. **Control de Acceso (RBAC):** La vista es exclusiva para el rol **"Administrador"**. Si un usuario de otro rol intenta ingresar, mostrar la pantalla/alerta de acceso denegado (`403 Forbidden`).
6. **Rendimiento (< 1.5s):** Desplegar *Skeleton Loaders* en la tabla durante el estado de carga (`isLoading`).
7. **Detalle Técnico Interactivo:** Permitir hacer clic en una fila de un activo individual (vehículo, grúa, motobomba) para abrir un modal o panel lateral que muestre sus especificaciones técnicas (`detalles`: patente, horómetro, caudal, combustible, etc.).

---

## 2. Contrato de API y Comunicación Backend

### Dirección Base y Cabeceras
La API corre en:
```
http://localhost:3001
```
*(Nota: Si el puerto 3000 está ocupado por `sgrai-web`, la API utiliza automáticamente el puerto 3001 con cabeceras CORS habilitadas para `*`).*

Todos los llamados deben incluir la cabecera de autenticación con el identificador del usuario:
```http
X-User-Id: <UUID-DEL-USUARIO>
```
*(O alternativamente: `Authorization: Bearer <UUID-DEL-USUARIO>`)*.

### Usuarios de Prueba Sembrados en Base de Datos

| Perfil | UUID (`X-User-Id`) | Email | Acceso al Listado |
|---|---|---|---|
| **Administrador General** | `00000000-0000-4000-8000-000000000001` | `admin@valdivia.cl` | **Permitido (`200 OK`)** |
| **Operador Call Center** | `00000000-0000-4000-8000-000000000002` | `callcenter@valdivia.cl` | **Denegado (`403 Forbidden`)** |

---

### Endpoint: `GET /api/recursos`

#### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `pagina` | `number` | No | `1` | Número de página (inicia en 1). |
| `limite` | `number` | No | `10` | Cantidad de registros por página (máx. 100). |
| `delegacionId` | `UUID` | No | - | Filtrar por UUID de delegación territorial. |
| `estado` | `string` | No | - | `DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`. |
| `esIndividual` | `boolean` | No | - | `true` (vehículos/maquinaria) o `false` (materiales/insumos). |
| `busqueda` | `string` | No | - | Texto para búsqueda insensible a mayúsculas sobre nombre/descripción. |

#### Ejemplo de Petición
```http
GET http://localhost:3001/api/recursos?pagina=1&limite=10&estado=DISPONIBLE&busqueda=camioneta HTTP/1.1
Host: localhost:3001
X-User-Id: 00000000-0000-4000-8000-000000000001
```

#### Formato de Respuesta Exitosa (`200 OK`)
```json
{
  "data": [
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
      "latitud": -39.8142000,
      "longitud": -73.2459000,
      "descripcion": "Unidad de apoyo logístico y despliegue rápido",
      "detalles": {
        "patente": "ABCD-12",
        "marca": "Toyota",
        "modelo": "Hilux",
        "anio": 2023,
        "kilometraje": 45000,
        "tipoCombustible": "DIESEL",
        "capacidadPasajeros": 5
      },
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000001",
        "codigo": "DEL_NORTE",
        "nombre": "Delegación Municipal Norte"
      },
      "creadoPorId": "00000000-0000-4000-8000-000000000001",
      "creadoEn": "2026-09-17T10:00:00.000Z",
      "actualizadoEn": "2026-09-17T10:00:00.000Z"
    },
    {
      "id": "40000000-0000-4000-8000-000000000002",
      "nombre": "Sacos de Arena",
      "tipo": "Material o Insumo",
      "esIndividual": false,
      "estado": "BAJO_STOCK",
      "cantidadInventario": 80,
      "cantidadEnUso": 0,
      "cantidadDisponible": 80,
      "cantidadMinima": 100,
      "latitud": -39.8210000,
      "longitud": -73.2380000,
      "descripcion": "Sacos para contención de anegamientos y desbordes",
      "detalles": {},
      "delegacion": {
        "id": "30000000-0000-4000-8000-000000000002",
        "codigo": "DEL_SUR",
        "nombre": "Delegación Municipal Sur"
      },
      "creadoPorId": "00000000-0000-4000-8000-000000000001",
      "creadoEn": "2026-09-17T11:00:00.000Z",
      "actualizadoEn": "2026-09-17T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "pagina": 1,
    "limite": 10,
    "totalPaginas": 1
  }
}
```

#### Respuesta Cuando el Inventario está Vacío (`data: []`)
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "pagina": 1,
    "limite": 10,
    "totalPaginas": 0
  }
}
```

---

## 3. Manejo de Errores HTTP en Frontend

| Código HTTP | Causa en Backend | Comportamiento Esperado en Frontend |
|---|---|---|
| `401 Unauthorized` | Cabecera `X-User-Id` ausente o usuario no registrado | Redirigir al inicio de sesión o mostrar recuadro de autenticación requerida. |
| `403 Forbidden` | El usuario no tiene rol `Administrador` | Mostrar componente o alerta de acceso restringido: *"Acceso denegado: esta vista es exclusiva para Administradores"*. |
| `400 Bad Request` | Parámetros inválidos (ej. página < 1 o límite > 100) | Restablecer filtros a valores por defecto y alertar con toast. |
| `500 Internal Error`| Error inesperado del servidor o base de datos | Mostrar estado de error con botón de *"Reintentar conexión"*. |

---

## 4. Tipos TypeScript para el Frontend (`sgrai-web`)

Pueden copiar directamente estas interfaces en `src/types/recurso.ts`:

```typescript
export type EstadoRecurso =
  | "DISPONIBLE"
  | "ASIGNADO"
  | "EN_MANTENCION"
  | "BAJO_STOCK"
  | "NO_DISPONIBLE";

export interface DelegacionResumen {
  id: string;
  codigo: string;
  nombre: string;
}

export interface DetallesRecursoTecnico {
  // Comunes / Serializados
  patente?: string;
  numeroSerie?: string;
  marca?: string;
  modelo?: string;
  anio?: number;

  // Vehículos
  kilometraje?: number;
  tipoCombustible?: "GASOLINA" | "DIESEL" | "ELECTRICO" | "HIBRIDO" | "OTRO";
  capacidadPasajeros?: number;
  numeroChasis?: string;

  // Maquinaria y Grúas
  capacidadCargaKg?: number;
  alcanceMaximoMetros?: number;
  tipoGrua?: string;
  horometro?: number;

  // Motobombas y Equipos
  caudalMaximoLpm?: number;
  diametroPulgadas?: number;
  potenciaHp?: number;
  potenciaKva?: number;
}

export interface RecursoItem {
  id: string;
  nombre: string;
  tipo: "Vehículo o Maquinaria" | "Material o Insumo";
  esIndividual: boolean;
  estado: EstadoRecurso;
  cantidadInventario: number;
  cantidadEnUso: number;
  cantidadDisponible: number;
  cantidadMinima: number;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  detalles: DetallesRecursoTecnico;
  delegacion: DelegacionResumen | null;
  creadoPorId: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ListarRecursosResponse {
  data: RecursoItem[];
  meta: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
}

export interface FiltrosRecursosState {
  pagina: number;
  limite: number;
  delegacionId?: string;
  estado?: EstadoRecurso;
  esIndividual?: boolean;
  busqueda?: string;
}
```

---

## 5. Guía de Estilo Visual y Componentes UI (Municipalidad de Valdivia)

Para cumplir con las pautas de identidad visual institucional de `GEMINI.md`:

### Paleta de Colores Oficial
* **Teal Principal Municipal:** `#14505A` (Encabezados, bordes activos, títulos primarios)
* **Teal Medio:** `#1B6F7D` (Líneas divisorias, hover de botones secundarios)
* **Menta Acento / Éxito:** `#4FAE9B` (Botón principal "+ Registrar Nuevo Recurso", badges positivos)
* **Fondo Neutro:** `#ECEFF3` y `#F8FAFC` (Fondos de tablas y contenedores secundarios)
* **Gris Carbón Texto:** `#2B2B2B` (Texto principal legible) y `#3B3F45` (Texto secundario)
* **Borde Sutil:** `#D5DCE4` (Líneas de celdas y casillas de filtros)
* **Botones:** `border-radius: 0;` (Esquinas rectas según diseño institucional de Valdivia).

### Badges de Estado de Disponibilidad

Renderizar un componente `<BadgeEstado estado={recurso.estado} />` con los siguientes estilos exactos:

| Estado | Fondo (`backgroundColor`) | Borde (`border`) | Texto (`color`) | Etiqueta en Pantalla |
|---|---|---|---|---|
| `DISPONIBLE` | `#E8F5E9` | `1px solid #A5D6A7` | `#2E7D32` | **Disponible** |
| `ASIGNADO` | `#E3F2FD` | `1px solid #90CAF9` | `#1565C0` | **En Terreno / Asignado** |
| `EN_MANTENCION` | `#FFF3E0` | `1px solid #FFCC80` | `#E65100` | **En Mantención** |
| `BAJO_STOCK` | `#FFFDE7` | `1px solid #FFF59D` | `#F57F17` | **Bajo Stock (Alerta)** |
| `NO_DISPONIBLE` | `#FFEBEE` | `1px solid #EF9A9A` | `#C62828` | **No Disponible** |

---

## 6. Estructura de Componentes Recomendada (`sgrai-web`)

```
src/
└── app/
    └── (admin)/
        └── recursos/
            ├── page.tsx                     // Contenedor de página con fetch y permisos
            └── _components/
                ├── RecursosHeader.tsx       // Título "Inventario de Recursos", total y botón "+ Registrar"
                ├── RecursosFiltros.tsx      // Input de búsqueda, select delegación y select estado
                ├── RecursosTabla.tsx        // Tabla principal con columnas, badges y acciones
                ├── RecursoRow.tsx           // Fila individual con soporte para clic y expansión
                ├── RecursoDetalleModal.tsx  // Modal con especificaciones técnicas (patente, motor, etc.)
                ├── RecursosPaginacion.tsx   // Paginador con botones "Anterior", "Siguiente" y selector de límite
                ├── RecursosEmptyState.tsx   // Estado "No hay recursos registrados" con botón "+ Registrar"
                └── RecursosSkeleton.tsx     // Skeleton loader para cumplimiento de latencia < 1.5s
```

---

## 7. Implementación de Lógica y Código de Ejemplo

### 7.1. Hook de Consumo con SWR o TanStack Query

```typescript
// src/hooks/useRecursos.ts
import useSWR from "swr";
import type { ListarRecursosResponse, FiltrosRecursosState } from "@/types/recurso";

const fetcher = (url: string) =>
  fetch(url, {
    headers: {
      "X-User-Id": "00000000-0000-4000-8000-000000000001", // Administrador en sesión
    },
  }).then(async (res) => {
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const error = new Error(errorData.message || "Error al cargar recursos");
      (error as any).status = res.status;
      throw error;
    }
    return res.json();
  });

export function useRecursos(filtros: FiltrosRecursosState) {
  const params = new URLSearchParams();
  params.set("pagina", String(filtros.pagina));
  params.set("limite", String(filtros.limite));

  if (filtros.delegacionId) params.set("delegacionId", filtros.delegacionId);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.esIndividual !== undefined) params.set("esIndividual", String(filtros.esIndividual));
  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    params.set("busqueda", filtros.busqueda.trim());
  }

  const { data, error, isLoading, mutate } = useSWR<ListarRecursosResponse>(
    `http://localhost:3001/api/recursos?${params.toString()}`,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    }
  );

  return {
    recursos: data?.data ?? [],
    meta: data?.meta ?? { total: 0, pagina: 1, limite: 10, totalPaginas: 0 },
    cargando: isLoading,
    error,
    recargar: mutate,
  };
}
```

---

### 7.2. Componente de Estado Vacío (`RecursosEmptyState.tsx`)

```tsx
import Link from "next/link";

interface Props {
  esFiltroActivo: boolean;
  onLimpiarFiltros?: () => void;
}

export function RecursosEmptyState({ esFiltroActivo, onLimpiarFiltros }: Props) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "#FFFFFF",
        border: "1px dashed #D5DCE4",
        margin: "24px 0",
      }}
    >
      <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
      <h3 style={{ margin: "0 0 8px 0", color: "#14505A", fontSize: "18px", fontWeight: 700 }}>
        No hay recursos registrados
      </h3>
      <p style={{ margin: "0 0 20px 0", color: "#3B3F45", fontSize: "14px" }}>
        {esFiltroActivo
          ? "No se encontraron recursos que coincidan con los filtros de búsqueda aplicados."
          : "Actualmente no existen recursos ingresados en el inventario logístico municipal."}
      </p>

      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        {esFiltroActivo && onLimpiarFiltros && (
          <button
            onClick={onLimpiarFiltros}
            style={{
              backgroundColor: "#ECEFF3",
              color: "#14505A",
              border: "1px solid #D5DCE4",
              padding: "10px 20px",
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: 0,
            }}
          >
            Limpiar Filtros
          </button>
        )}

        <Link
          href="/recursos/nuevo"
          style={{
            backgroundColor: "#4FAE9B",
            color: "#FFFFFF",
            padding: "10px 24px",
            textDecoration: "none",
            fontWeight: 700,
            borderRadius: 0,
            display: "inline-block",
          }}
        >
          + Registrar Nuevo Recurso
        </Link>
      </div>
    </div>
  );
}
```

---

### 7.3. Componente de Badge de Disponibilidad (`BadgeEstado.tsx`)

```tsx
import type { EstadoRecurso } from "@/types/recurso";

const ESTADOS_CONFIG: Record<
  EstadoRecurso,
  { label: string; bg: string; border: string; text: string }
> = {
  DISPONIBLE: {
    label: "Disponible",
    bg: "#E8F5E9",
    border: "#A5D6A7",
    text: "#2E7D32",
  },
  ASIGNADO: {
    label: "En Terreno / Asignado",
    bg: "#E3F2FD",
    border: "#90CAF9",
    text: "#1565C0",
  },
  EN_MANTENCION: {
    label: "En Mantención",
    bg: "#FFF3E0",
    border: "#FFCC80",
    text: "#E65100",
  },
  BAJO_STOCK: {
    label: "Bajo Stock (Alerta)",
    bg: "#FFFDE7",
    border: "#FFF59D",
    text: "#F57F17",
  },
  NO_DISPONIBLE: {
    label: "No Disponible",
    bg: "#FFEBEE",
    border: "#EF9A9A",
    text: "#C62828",
  },
};

export function BadgeEstado({ estado }: { estado: EstadoRecurso }) {
  const config = ESTADOS_CONFIG[estado] || ESTADOS_CONFIG.NO_DISPONIBLE;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        fontSize: "12px",
        fontWeight: 700,
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
        borderRadius: "2px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: config.text,
          marginRight: "6px",
        }}
      />
      {config.label}
    </span>
  );
}
```

---

## 8. Checklist de Verificación de Integración (QA Frontend)

- [ ] **Acceso RBAC:** ¿Al entrar con el usuario Administrador (`admin@valdivia.cl`) la pantalla carga correctamente?
- [ ] **Bloqueo RBAC:** ¿Al simular acceso con un usuario no administrador se muestra la pantalla de acceso denegado (`403 Forbidden`)?
- [ ] **Listado y Columnas:** ¿Se despliegan nombre, tipo, stock (disponible / en uso / total), delegación territorial y badge de estado?
- [ ] **Procedencia Territorial:** ¿Los recursos con delegación muestran el nombre correcto (ej. *Delegación Municipal Norte*) y los sin delegación indican *"Reserva Central"* o *"Sin delegación"*?
- [ ] **Paginación Servidor:** ¿Al cambiar de página o límite por página la tabla se actualiza sin recargar la web completa?
- [ ] **Buscador con Debounce:** ¿Al escribir en el buscador se filtran los resultados tras 300ms de inactividad de tipeo?
- [ ] **Filtros por Estado y Delegación:** ¿Al seleccionar "BAJO_STOCK" o "Delegación Sur" la tabla muestra únicamente los registros correspondientes?
- [ ] **Detalle de Activo Individual:** ¿Al hacer clic en un vehículo o motobomba se pueden visualizar sus especificaciones técnicas (`detalles`)?
- [ ] **Estado Vacío:** ¿Cuando no hay recursos registrados o los filtros no devuelven registros se despliega el mensaje *"No hay recursos registrados"* con el botón hacia `/recursos/nuevo`?
- [ ] **Skeleton Loader:** ¿Durante la carga inicial se muestra el esqueleto visual manteniendo el layout sin saltos bruscos (< 1.5s)?
