# Guía de Handover Técnico para Frontend (`sgrai-web`): Edición de Recursos (HU-8)

> **Destinatario:** Equipo de desarrollo frontend (`sgrai-web`) y Asistente IA.  
> **Origen:** Backend monolítico modular `sgrai-api` (`feature/H8-editar-caracteristicas-recurso`).  
> **Versión API:** `v0.4.0` (SemVer).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json` (o puerto activo).  
> **Ruta del Frontend Asociada:** `/recursos/[id]/editar` (o modal interactivo desde `/recursos`).

---

## 1. Contexto y Objetivos de la Historia de Usuario

### Historia de Usuario
> **Como** Administrador  
> **Quiero** editar características de un recurso  
> **Para** mantener el sistema actualizado y asegurar que el inventario refleje la realidad operativa de la dirección.

### Criterios de Aceptación a Implementar en `sgrai-web`:
1. **Acceso al Formulario:** Proporcionar un botón/acción de edición (ícono de lápiz o "Editar") accesible en cada fila del listado de inventario (`/recursos`) que redirija a `/recursos/[id]/editar` o abra un modal de edición.
2. **Pre-carga de Datos:** Al abrir la pantalla/modal de edición, realizar un `GET /api/recursos/[id]` para pre-cargar todos los campos del formulario con los valores actuales en la base de datos (nombre, inventario, mínimo, mantención, coordenadas, descripción, delegación territorial y especificaciones técnicas).
3. **Validación en Cliente y Servidor:** Validar que los campos obligatorios no se envíen vacíos, que las cantidades sean números enteros $\ge 0$, y que las coordenadas de latitud (-90 a 90) y longitud (-180 a 180) sean válidas.
4. **Inmutabilidad de Tipo:** El campo `esIndividual` (si es vehículo/maquinaria o material a granel) es de **solo lectura**. Debe mostrarse como badge informativo inalterable.
5. **Guardado y Feedback Visual:** Al enviar el formulario con `PUT /api/recursos/[id]`, mostrar un spinner/estado de carga en el botón de guardar. Al recibir respuesta exitosa (`200 OK`), mostrar un toast o notificación de éxito verde ("Recurso actualizado exitosamente") y redirigir o refrescar el listado.
6. **Manejo de Errores Operativos (ej. Reducción de Stock Indebida):** Si la API responde con `400 Bad Request` indicando que no se puede reducir el inventario por debajo de las unidades en uso en terreno (`cantidadInventario < cantidadEnUso`), mostrar un mensaje descriptivo en el formulario indicando exactamente cuántas unidades están retenidas en terreno.
7. **Actualizaciones en Tiempo Real (Socket.io):** Escuchar el evento `"recurso:actualizado"` en las vistas activas para actualizar el inventario automáticamente sin requerir F5.
8. **Protección RBAC:** Vista restringida para el rol **Administrador** (o permiso `recursos:editar`).

---

## 2. Contratos de API para Consumo Frontend

### Autenticación y Cabeceras
Incluir en todas las peticiones:
```http
X-User-Id: 00000000-0000-4000-8000-000000000001
Content-Type: application/json
```

---

### Endpoint 1: Pre-cargar Datos (`GET /api/recursos/{id}`)

#### Petición
```http
GET /api/recursos/40000000-0000-4000-8000-000000000001
X-User-Id: 00000000-0000-4000-8000-000000000001
```

#### Respuesta Exitosa (`200 OK`)
```json
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
  "descripcion": "Unidad de apoyo logístico y despliegue rápido",
  "detalles": {
    "patente": "ABCD-12",
    "marca": "Toyota",
    "modelo": "Hilux",
    "anio": 2023,
    "kilometraje": 45000,
    "tipoCombustible": "DIESEL"
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

### Endpoint 2: Guardar Modificación (`PUT /api/recursos/{id}`)

#### Petición
```http
PUT /api/recursos/40000000-0000-4000-8000-000000000001
Content-Type: application/json
X-User-Id: 00000000-0000-4000-8000-000000000001

{
  "nombre": "Camioneta Rescate 4x4 - Actualizada",
  "cantidadInventario": 1,
  "cantidadMinima": 0,
  "enMantencion": false,
  "latitud": -39.8142,
  "longitud": -73.2459,
  "descripcion": "Unidad con mantención al día y operativa",
  "detalles": {
    "patente": "ABCD-12",
    "marca": "Toyota",
    "modelo": "Hilux",
    "anio": 2023,
    "kilometraje": 48000,
    "tipoCombustible": "DIESEL"
  },
  "delegacionId": "30000000-0000-4000-8000-000000000001"
}
```

#### Respuesta Exitosa (`200 OK`)
```json
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
    "descripcion": "Unidad con mantención al día y operativa",
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

## 3. Escucha de Eventos en Tiempo Real (Socket.io)

En el cliente `sgrai-web`, unirse a las salas operativas y suscribirse al evento:

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// Unirse a la sala según el perfil
socket.emit("join", "encargado"); // o "supervisor"

// Escuchar actualización de recursos
socket.on("recurso:actualizado", (recursoActualizado) => {
  // 1. Si estamos en la lista de recursos (/recursos), actualizar el registro en la tabla
  // 2. Si estamos en el tablero Kanban del Encargado, refrescar la disponibilidad del recurso
});
```

---

## 4. Códigos de Error de la API y Manejo en Frontend

| Código | Significado | Causa | Acción en Frontend |
|---|---|---|---|
| `400 Bad Request` | Validación inválida | Campos vacíos, negativos, o `cantidadInventario < cantidadEnUso`. | Mostrar mensaje de error bajo el campo o toast rojo con la explicación retornada por la API. |
| `401 Unauthorized` | Sesión no válida | Falta cabecera `X-User-Id` o usuario inactivo. | Redirigir a `/login`. |
| `403 Forbidden` | Sin permisos | El usuario no posee rol Administrador. | Mostrar pantalla institucional de "Acceso Denegado". |
| `404 Not Found` | No encontrado | El UUID del recurso no existe en el sistema. | Mostrar página o mensaje "Recurso no encontrado" con botón para volver al inventario. |
| `500 Server Error` | Falla interna | Error en base de datos. | Mostrar alerta "Error interno del servidor, intente nuevamente". |
