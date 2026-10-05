# Guía de Handover Técnico para Frontend (`sgrai-web`): Crear Evento de Recuperación (HU-29)

> **Destinatario:** Desarrolladores de Frontend (`sgrai-web`) y Agentes de IA en el repositorio web.  
> **Origen:** Backend monolítico modular `sgrai-api` (`feature/H29-crear-evento-manual-recuperación`).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json` (Tag: `Eventos ATP / Recuperación`).  
> **Endpoint Principal:** `POST /api/eventos-atp/recuperacion`.  
> **Evento en Tiempo Real:** Socket.io `recuperacion:creada`.

---

## 1. Contexto de la Historia de Usuario y Criterios de Aceptación

### Historia de Usuario
> **Como** Encargado de Operaciones  
> **Quiero** tener la opción de generar eventos nuevos de recuperación  
> **Para** enviar patrullas específicas a entregar recursos directamente en terreno o zonas afectadas, sin la necesidad estricta de registrar un incidente formal previamente.

### Criterios de Aceptación a Implementar en `sgrai-web`:
1. **Acceso al Formulario:**
   - Debe presentarse un botón accesible desde el panel del encargado (o barra de herramientas del mapa operativo): **"Nuevo Evento de Recuperación"** (o **"Crear Recuperación"**).
   - Al presionarlo, desplegar un **Modal** o **Drawer lateral** con el formulario de creación.
2. **Selección Geográfica (Integración con Mapa Leaflet):**
   - El formulario debe permitir ingresar la dirección o hacer clic directamente en el mapa para capturar las coordenadas (`latitud`, `longitud`).
   - Un marcador temporal debe posicionarse en el mapa indicando el punto de intervención en Valdivia.
3. **Selección Dinámica de Recursos Logísticos y Validación de Stock:**
   - Permitir seleccionar uno o más insumos desde el inventario municipal (consultado desde `GET /api/recursos`).
   - Mostrar el stock disponible en bodega (`cantidadDisponible = cantidadInventario - cantidadEnUso`).
   - El frontend debe impedir solicitar más unidades de las disponibles en tiempo real (validación visual antes del envío).
4. **Asignación de Patrulla Verificadora:**
   - Selector de patrullas disponibles (filtrando por `estado === 'DISPONIBLE'`).
5. **Transición y Feedback de Creación:**
   - Al confirmar exitosamente, la patrulla asignada queda marcada como `'EN_RECUPERACION'` y los recursos son descontados del inventario.
   - Mostrar una notificación *toast* de éxito: *"Evento de recuperación registrado y patrulla despachada exitosamente"*.
6. **Monitoreo en Tiempo Real (Socket.io):**
   - El mapa operativo (Leaflet) debe escuchar el evento WebSocket `recuperacion:creada` y dibujar inmediatamente el nuevo marcador de recuperación con un ícono y color distintivo, sin requerir recargar la página.

---

## 2. Contrato de API: `POST /api/eventos-atp/recuperacion`

### Cabeceras HTTP
| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | `UUID` | Sí | ID del usuario con rol `ENCARGADO` o `ADMIN` (permiso `recuperacion:crear`). También se admite `Authorization: Bearer <token>`. |
| `Content-Type` | `string` | Sí | `application/json` |

### Usuarios de Prueba Sembrados en Base de Datos
| Rol | UUID (`X-User-Id`) | Email | Acceso |
|---|---|---|---|
| **Encargado de Operaciones** | `00000000-0000-4000-8000-000000000003` | `encargado@valdivia.cl` | **Permitido (`201 Created`)** |
| **Administrador General** | `00000000-0000-4000-8000-000000000001` | `admin@valdivia.cl` | **Permitido (`201 Created`)** |
| **Operador Call Center** | `00000000-0000-4000-8000-000000000002` | `callcenter@valdivia.cl` | **Denegado (`403 Forbidden`)** |

---

## 3. Tipos TypeScript para `sgrai-web`

Copia estas interfaces en tu módulo de tipos en el frontend (ej. `src/types/recuperacion.ts`):

```typescript
export type PrioridadRecuperacion = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export type EstadoRecuperacion = "PLANIFICADA" | "EN_EJECUCION" | "COMPLETADA" | "CANCELADA";

export interface ItemRecursoSolicitado {
  recursoId: string; // UUID
  cantidad: number;  // Entero > 0
}

export interface CrearEventoRecuperacionInput {
  nombre: string;              // 3 a 150 caracteres
  descripcion?: string | null; // Opcional, máx 1000 caracteres
  sector: string;              // 2 a 150 caracteres (ej. "Collico")
  direccionTexto?: string | null; // Punto de referencia o calle
  prioridad?: PrioridadRecuperacion; // Default "MEDIA"
  contactoNombre?: string | null;    // Nombre referente vecinal
  contactoTelefono?: string | null;  // Teléfono referente
  latitud: number;             // WGS84 (-90 a 90)
  longitud: number;            // WGS84 (-180 a 180)
  delegacionId?: string | null;// Opcional (UUID)
  patrullaId: string;          // UUID de patrulla DISPONIBLE
  familiasAfectadas?: number;  // Default 0
  recursos: ItemRecursoSolicitado[]; // Mínimo 1 elemento
}

export interface RecursoAsignadoItem {
  recursoId: string;
  nombre: string;
  cantidadAsignada: number;
}

export interface EventoRecuperacionResponse {
  id: string;
  codigo: string;             // Ej: "REC-2026-0001"
  nombre: string;
  descripcion: string | null;
  sector: string;
  direccionTexto: string | null;
  prioridad: PrioridadRecuperacion;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  latitud: number;
  longitud: number;
  estado: EstadoRecuperacion;
  familiasAfectadas: number;
  delegacion: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;
  mision: {
    id: string;
    codigo: string;           // Ej: "MIS-2026-0001"
    titulo: string;
    estado: string;           // "DESPACHADA"
    tipoMision: string;       // "RECUPERACION"
  };
  patrulla: {
    id: string;
    nombre: string;
    estado: string;           // "EN_RECUPERACION"
  };
  recursos: RecursoAsignadoItem[];
  creadoPorId: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearEventoRecuperacionApiResponse {
  message: string;
  data: EventoRecuperacionResponse;
}
```

---

## 4. Endpoints Complementarios para Alimentar el Formulario

Para armar el formulario, el frontend debe consultar previamente:

### A. Listado de Recursos de Inventario
* **Endpoint:** `GET /api/recursos?limite=100&estado=DISPONIBLE`
* **Campos clave a utilizar:**
  - `id`: Para enviar en `recursoId`.
  - `nombre`: Para la etiqueta visible del select.
  - `cantidadDisponible`: Para validar que el usuario no solicite más de lo existente en bodega.

### B. Listado de Delegaciones
* **Endpoint:** `GET /api/catalogos`
* **Campos clave:** `data.delegaciones` (`id`, `nombre`, `codigo`).

### C. Patrullas Verificadoras Disponibles
* En los datos de semilla oficiales del sistema:
  - **Patrulla Disponible:** `f1000000-0000-4000-8000-000000000002` (*Patrulla Rápida Centro-Sur*, Delegación Sur).
  - **Patrulla Ocupada (Prueba de error 409):** `f1000000-0000-4000-8000-000000000001` (*Patrulla Rápida Costa-1*, Estado `EN_VERIFICACION`).

---

## 5. Ejemplos de Petición y Respuesta

### Solicitud Exitosa (`POST /api/eventos-atp/recuperacion`)
```json
{
  "nombre": "Entrega de planchas de zinc y frazadas",
  "descripcion": "Familias afectadas por anegamiento y filtraciones en techos",
  "sector": "Collico",
  "direccionTexto": "Pasaje Los Cipreses 450",
  "prioridad": "ALTA",
  "contactoNombre": "Sra. María González (JJVV)",
  "contactoTelefono": "+56987654321",
  "latitud": -39.8142,
  "longitud": -73.2459,
  "delegacionId": "30000000-0000-4000-8000-000000000001",
  "patrullaId": "f1000000-0000-4000-8000-000000000002",
  "familiasAfectadas": 3,
  "recursos": [
    {
      "recursoId": "e1000000-0000-4000-8000-000000000004",
      "cantidad": 10
    }
  ]
}
```

### Respuesta Exitosa (`201 Created`)
```json
{
  "message": "Evento de recuperación registrado y patrulla despachada exitosamente.",
  "data": {
    "id": "7a35b120-1a2b-4c3d-8e4f-0123456789ab",
    "codigo": "REC-2026-0001",
    "nombre": "Entrega de planchas de zinc y frazadas",
    "descripcion": "Familias afectadas por anegamiento y filtraciones en techos",
    "sector": "Collico",
    "direccionTexto": "Pasaje Los Cipreses 450",
    "prioridad": "ALTA",
    "contactoNombre": "Sra. María González (JJVV)",
    "contactoTelefono": "+56987654321",
    "latitud": -39.8142,
    "longitud": -73.2459,
    "estado": "PLANIFICADA",
    "familiasAfectadas": 3,
    "delegacion": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "DEL-SUR",
      "nombre": "Delegación Municipal Sur"
    },
    "mision": {
      "id": "6b45c230-2b3c-4d5e-9f0a-1234567890bc",
      "codigo": "MIS-2026-0001",
      "titulo": "Entrega de planchas de zinc y frazadas",
      "estado": "DESPACHADA",
      "tipoMision": "RECUPERACION"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000002",
      "nombre": "Patrulla Rápida Centro-Sur",
      "estado": "EN_RECUPERACION"
    },
    "recursos": [
      {
        "recursoId": "e1000000-0000-4000-8000-000000000004",
        "nombre": "Sacos de Arena 25kg",
        "cantidadAsignada": 10
      }
    ],
    "creadoPorId": "00000000-0000-4000-8000-000000000003",
    "creadoEn": "2026-10-04T22:30:00.000Z",
    "actualizadoEn": "2026-10-04T22:30:00.000Z"
  }
}
```

---

## 6. Manejo de Errores en Frontend

| Código HTTP | Causa | Mensaje de la API | Acción recomendada en UI |
|---|---|---|---|
| `400 Bad Request` | Fallo de validación Zod (ej. sin recursos, cantidad $\le 0$) | `{ message, errors: [{ campo, mensaje }] }` | Resaltar los campos en rojo en el formulario y mostrar el texto del error. |
| `401 Unauthorized` | Sesión expirada o cabecera ausente | `{ message: "..." }` | Redirigir al login o renovar sesión. |
| `403 Forbidden` | Usuario sin rol Encargado/Admin | `{ message: "No posee el permiso requerido: recuperacion:crear" }` | Mostrar alerta de permisos insuficientes. |
| `404 Not Found` | Patrulla o recurso inexistente | `{ message: "La patrulla verificadora indicada no fue encontrada." }` | Mostrar toast de error y recargar listas. |
| **`409 Conflict`** | **Patrulla Ocupada** | `{ message: "La patrulla \"...\" no está disponible para asignación (estado actual: ...)." }` | Mostrar banner de advertencia: *"La patrulla seleccionada acaba de ser asignada a otra tarea. Seleccione otra patrulla disponible."* |
| **`409 Conflict`** | **Stock Insuficiente** | `{ message: "Stock insuficiente para el recurso \"...\". Solicitado: X, Disponible: Y." }` | Mostrar banner: *"Stock insuficiente en bodega. Modifique la cantidad solicitada."* |
| `500 Server Error` | Error de servidor o BD | `{ message: "..." }` | Mostrar toast de error técnico. |

---

## 7. Integración de Tiempo Real (Socket.io en Leaflet Map)

Para dar cumplimiento al **Criterio de Aceptación 5** (*El evento de recuperación debe visualizarse inmediatamente en la vista cartográfica*):

```typescript
// En tu componente de Mapa de Monitoreo (ej. MapaOperaciones.tsx o useSocketEvents.ts):
import { useEffect } from "react";
import { socket } from "@/lib/socket"; // Cliente Socket.io configurado en sgrai-web
import type { EventoRecuperacionResponse } from "@/types/recuperacion";

export function useRecuperacionSocket(onNuevoEvento: (evento: EventoRecuperacionResponse) => void) {
  useEffect(() => {
    // Unirse a las salas operativas si aplica
    socket.emit("join", "sala:encargados");
    socket.emit("join", "mapa");

    const handleRecuperacionCreada = (evento: EventoRecuperacionResponse) => {
      // 1. Añadir marcador interactivo en Leaflet
      onNuevoEvento(evento);

      // 2. Notificación flotante (toast)
      toast.info(`Nuevo evento de recuperación en ${evento.sector}: ${evento.codigo}`);
    };

    socket.on("recuperacion:creada", handleRecuperacionCreada);

    return () => {
      socket.off("recuperacion:creada", handleRecuperacionCreada);
    };
  }, [onNuevoEvento]);
}
```

### Marcador Recomendado en Leaflet:
* **Color:** Verde esmeralda o naranja ámbar (diferenciado de los marcadores de incidentes rojos/amarillos).
* **Ícono:** Camión de suministros o botiquín (`Truck` o `Package` de Lucide React).
* **Popup al Clic:**
  - Código: `REC-2026-XXXX` y Prioridad.
  - Sector y Dirección.
  - Patrulla Asignada.
  - Recursos y familias afectadas.
  - Código de Misión asociada (`MIS-2026-XXXX`).

---

## 8. Checklist de Tareas para el Desarrollador Frontend

- [ ] Crear tipos en `src/types/recuperacion.ts`.
- [ ] Crear servicio/hook de API (ej. `crearEventoRecuperacion(input)` vía `fetch` o `axios`).
- [ ] Construir el modal `ModalCrearEventoRecuperacion.tsx` con Tailwind CSS:
  - [ ] Input de Nombre y Sector.
  - [ ] Mini-mapa o selector de coordenadas haciendo clic.
  - [ ] Dropdown de Patrullas Verificadoras disponibles.
  - [ ] Tabla dinámica de insumos con selector de recurso, indicador de stock disponible y cantidad a enviar.
  - [ ] Manejo de estado de carga (`isSubmitting`) y deshabilitación del botón de envío.
  - [ ] Manejo de respuesta de error `409` (stock o patrulla ocupada).
- [ ] Conectar el listener `socket.on("recuperacion:creada")` en el componente del mapa interactivo de Valdivia.
- [ ] Verificar que el marcador aparezca en el mapa sin recargar la página tras crear el evento.
