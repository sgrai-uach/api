# Guía de Handover Técnico para Frontend (`sgrai-web` y `sgrai-pwa`): Crear Evento Manual de Prevención (HU-30)

> **Destinatario:** Desarrolladores de Frontend (`sgrai-web`), App Móvil (`sgrai-pwa`) y Asistentes de IA.  
> **Origen:** Backend monolítico modular `sgrai-api` (rama `feature/H30-crear-evento-manual-prevencion`).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json` (Tag: `Eventos ATP`).  
> **Endpoint Principal:** `POST /api/eventos-atp/prevencion`.  
> **Evento en Tiempo Real (Socket.io):** `prevencion:creada`.

---

## 1. Contexto de la Historia de Usuario y Criterios de Aceptación

### Historia de Usuario
> **Como** Encargado de Operaciones  
> **Quiero** tener la opción de generar eventos nuevos de prevención  
> **Para** enviar patrullas a trabajar en puntos críticos y evitar potenciales incidentes.

### Criterios de Aceptación a Implementar en `sgrai-web` y `sgrai-pwa`:
1. **Acceso al Formulario:**
   - Botón visible y accesible para el rol **Encargado** en el panel principal de mando y en el visor cartográfico: **"Nuevo Evento de Prevención"** (o **"Crear Prevención"**).
   - Al hacer clic, desplegar un **Modal** o **Drawer lateral** responsive (con soporte táctil en tablets y móviles).
2. **Campos Obligatorios:**
   - **Nombre / Título:** Identificador de la labor preventiva (mínimo 3 caracteres).
   - **Descripción:** Instrucciones tácticas de mitigación (mínimo 5 caracteres). **Obligatorio por regla de negocio**.
   - **Delegación Municipal:** Selector obligatorio (`Norte`, `Sur`, `Costa` o `Calle Calle`).
   - **Punto Crítico Georreferenciado:** Integración con mapa interactivo (Leaflet) para hacer clic y seleccionar coordenadas (`latitud`, `longitud`), o seleccionar un punto crítico preexistente del catálogo.
3. **Asignación de Patrulla Verificadora:**
   - Desplegable de patrullas verificadoras con filtro estricto de estado `DISPONIBLE`.
   - La patrulla asignada pasará inmediatamente al estado `'EN_PREVENCION'`.
4. **Asignación Opcional de Recursos Logísticos:**
   - Permite agregar insumos o herramientas requeridas (ej. sacos de arena, motobombas).
   - El formulario debe validar visualmente que no se sobrepase el stock disponible en bodega.
5. **Notificación en Tiempo Real y Actualización Cartográfica:**
   - Una vez confirmado y guardado, la patrulla seleccionada recibe una alerta WebSocket en su dispositivo móvil (`sgrai-pwa`).
   - El evento aparece inmediatamente en la vista cartográfica y en los listados de misiones del Encargado sin recargar la página.

---

## 2. Contrato de API: `POST /api/eventos-atp/prevencion`

### Cabeceras HTTP
| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `Authorization` | `string` | Sí | `Bearer <token_jwt>` de un usuario con rol `ENCARGADO` o `ADMIN` (permiso `prevencion:eventos:crear`). |
| `Content-Type` | `string` | Sí | `application/json` |

### Usuarios de Prueba Sembrados en Base de Datos
| Rol | Email | Contraseña | Permiso `prevencion:eventos:crear` | Resultado esperado |
|---|---|---|---|---|
| **Encargado de Operaciones** | `encargado@valdivia.cl` | `Password123!` | Sí (asignado en migración 015) | **`201 Created`** |
| **Administrador General** | `admin@valdivia.cl` | `Password123!` | Sí (asignado en migración 015) | **`201 Created`** |
| **Operador Call Center** | `callcenter@valdivia.cl` | `Password123!` | No | **`403 Forbidden`** |

---

## 3. Tipos TypeScript para `sgrai-web`

Copia estas interfaces en tu proyecto web (ej. `src/types/evento-prevencion.ts`):

```typescript
export type PrioridadEventoPrevencion = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
export type EstadoEventoPrevencion = "PLANIFICADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";

export interface ItemRecursoSolicitadoPrevencion {
  recursoId: string;
  cantidad: number;
}

export interface CrearEventoPrevencionPayload {
  nombre: string;
  descripcion: string;
  sector?: string | null;
  direccionTexto?: string | null;
  prioridad?: PrioridadEventoPrevencion;
  delegacionId: string;
  puntoCriticoId?: string | null;
  latitud: number;
  longitud: number;
  patrullaId: string;
  recursos?: ItemRecursoSolicitadoPrevencion[];
}

export interface RecursoAsignadoPrevencionDTO {
  recursoId: string;
  nombre: string;
  cantidadAsignada: number;
}

export interface MisionPrevencionResumenDTO {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  tipoMision: string;
}

export interface PatrullaPrevencionResumenDTO {
  id: string;
  nombre: string;
  estado: "EN_PREVENCION";
}

export interface EventoPrevencionDTO {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  sector: string | null;
  direccionTexto: string | null;
  prioridad: PrioridadEventoPrevencion;
  estado: EstadoEventoPrevencion;
  latitud: number;
  longitud: number;
  puntoCritico: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;
  delegacion: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;
  mision: MisionPrevencionResumenDTO;
  patrulla: PatrullaPrevencionResumenDTO;
  recursos: RecursoAsignadoPrevencionDTO[];
  creadoPorId: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearEventoPrevencionResponse {
  message: string;
  data: EventoPrevencionDTO;
}
```

---

## 4. Ejemplo de Petición Fetch / Axios

```typescript
import axios from "axios";
import type {
  CrearEventoPrevencionPayload,
  CrearEventoPrevencionResponse,
} from "@/types/evento-prevencion";

export async function despacharEventoPrevencion(
  payload: CrearEventoPrevencionPayload,
  token: string
): Promise<CrearEventoPrevencionResponse> {
  const response = await axios.post<CrearEventoPrevencionResponse>(
    "/api/eventos-atp/prevencion",
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}
```

---

## 5. Integración con Socket.io en `sgrai-web` y `sgrai-pwa`

### En `sgrai-web` (Mapa y Listado de Misiones)
```typescript
import { useEffect } from "react";
import { socket } from "@/lib/socket-client";
import type { EventoPrevencionDTO } from "@/types/evento-prevencion";

export function useEventoPrevencionRealtime(
  onEventoCreado: (evento: EventoPrevencionDTO) => void
) {
  useEffect(() => {
    // Unirse a las salas operativas de monitoreo
    socket.emit("join", "sala:encargados");
    socket.emit("join", "mapa");

    const handler = (evento: EventoPrevencionDTO) => {
      // 1. Agregar nuevo marcador al mapa Leaflet
      // 2. Insertar misión en el listado activo del Encargado
      // 3. Notificación toast visual
      onEventoCreado(evento);
    };

    socket.on("prevencion:creada", handler);

    return () => {
      socket.off("prevencion:creada", handler);
    };
  }, [onEventoCreado]);
}
```

### En `sgrai-pwa` (Aplicación de Patrullas en Terreno)
```typescript
import { useEffect } from "react";
import { socket } from "@/lib/socket-client";
import type { EventoPrevencionDTO } from "@/types/evento-prevencion";

export function usePatrullaMisionRealtime(patrullaId: string) {
  useEffect(() => {
    if (!patrullaId) return;

    // Escuchar sala específica de la patrulla
    const room = `patrulla:${patrullaId}`;
    socket.emit("join", room);

    socket.on("prevencion:creada", (evento: EventoPrevencionDTO) => {
      // Notificar a los patrulleros en terreno
      navigator.vibrate?.([200, 100, 200]);
      alert(`Nueva misión preventiva asignada: ${evento.nombre}`);
    });

    return () => {
      socket.emit("leave", room);
      socket.off("prevencion:creada");
    };
  }, [patrullaId]);
}
```

---

## 6. Manejo de Errores y Códigos HTTP

| Código | Condición | Mensaje devuelto | Acción recomendada en UI |
|---|---|---|---|
| `400` | Campos faltantes o inválidos | `Datos de entrada inválidos para el evento de prevención.` | Mostrar errores bajo cada campo del formulario. |
| `401` | Token no enviado o vencido | `Token de sesión inválido o expirado.` | Redirigir al login institucional (`/login`). |
| `403` | Rol sin permiso | `Acceso denegado. Se requiere el permiso 'prevencion:eventos:crear'.` | Toast de alerta: *"No tiene permisos para despachar eventos preventivos"*. |
| `404` | Patrulla o delegación no existe | `La patrulla verificadora indicada no fue encontrada.` | Refrescar listado de patrullas disponibles. |
| `409` | Patrulla no disponible | `La patrulla "X" no está disponible para asignación (estado actual: EN_VERIFICACION).` | Toast de conflicto y actualizar selector de patrullas. |
| `409` | Stock insuficiente | `Stock insuficiente para el recurso "X". Solicitado: N, Disponible: M.` | Resaltar selector de recursos e indicar stock máximo disponible. |
| `500` | Error de servidor / BD | `Error interno del servidor al procesar la creación del evento de prevención.` | Toast de error genérico: *"Error al guardar el evento. Intente nuevamente."* |

---

## 7. Catálogos de Apoyo Existentes en la API

* **Listar Delegaciones:** `GET /api/catalogos/delegaciones` (Norte, Sur, Costa, Calle Calle).
* **Listar Puntos Críticos Activos:** `GET /api/puntos-criticos?activo=true&limite=100`.
* **Listar Recursos en Inventario:** `GET /api/recursos?limite=100`.
