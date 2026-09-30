# Guía de Handover Técnico para Frontend (`sgrai-web` y `sgrai-pwa`): Eliminación de Recursos (HU-9)

> **Destinatario:** Equipos de desarrollo frontend (`sgrai-web`, `sgrai-pwa`) y Asistente IA.  
> **Origen:** Backend monolítico modular `sgrai-api` (`feature/H9-eliminar-recurso`).  
> **Versión API:** `v0.7.0` (SemVer).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json`.  
> **Endpoint Principal:** `DELETE /api/recursos/{id}`.  

---

## 1. Contexto y Criterios de Aceptación (HU-9)

### Historia de Usuario
> **Como** Administrador  
> **Quiero** eliminar un recurso del sistema  
> **Para** mantener el inventario de recursos actualizado y acorde a la realidad de disponibilidad.

### Criterios de Aceptación a Implementar en los Clientes Frontend:
1. **Acceso y Protección RBAC:** El botón "Eliminar" (ícono de basurero / acción de peligro) en el listado de recursos (`/recursos`) solo debe estar visible y habilitado para usuarios con rol `Administrador` (o permiso `recursos:eliminar`).
2. **Modal de Confirmación Interactivo:** Al hacer clic en "Eliminar", se debe desplegar un modal de confirmación advirtiendo al usuario:
   - Nombre y tipo del recurso a dar de baja.
   - Advertencia de que el recurso dejará de estar disponible para futuras misiones, pero se preservará su historial operativo.
   - Botón secundario "Cancelar" y botón primario destructivo "Sí, eliminar recurso".
3. **Petición HTTP Destructiva:** Al confirmar, invocar `DELETE /api/recursos/{id}` con la cabecera `X-User-Id` del administrador autenticado.
4. **Manejo de Bloqueo Operativo (`409 Conflict`):** Si el recurso se encuentra actualmente asignado a una misión activa o cuadrilla en terreno, el backend responderá con `409 Conflict`. El frontend debe capturar este error y mostrar una alerta explicativa (ej. *"No es posible eliminar el recurso porque actualmente se encuentra asignado a una misión en terreno"*), manteniendo el recurso en la lista.
5. **Notificación de Éxito y Retiro Dinámico:** Si la respuesta es exitosa (`200 OK`):
   - Mostrar toast/notificación visual verde: *"Recurso eliminado exitosamente"*.
   - Retirar dinámicamente el elemento de la tabla o invalidar la caché de React Query / SWR sin recargar la página (`window.location.reload()` prohibido).
6. **Sincronización en Tiempo Real (Socket.io):**
   - Escuchar el evento `"recurso:eliminado"` en el cliente Socket.io.
   - Al recibir `{ id, nombre }`, retirar automáticamente la fila en la pantalla de cualquier otro encargado o supervisor que tenga la vista abierta.

---

## 2. Contrato de API: `DELETE /api/recursos/{id}`

### Petición
```http
DELETE /api/recursos/40000000-0000-4000-8000-000000000001 HTTP/1.1
Host: localhost:3000
X-User-Id: 00000000-0000-4000-8000-000000000001
Content-Type: application/json
```

### Respuestas Posibles

#### 1. Éxito (`200 OK`)
```json
{
  "message": "Recurso dado de baja exitosamente del inventario.",
  "id": "40000000-0000-4000-8000-000000000001",
  "nombre": "Camioneta Rescate 4x4",
  "eliminadoEn": "2026-09-30T19:30:00.000Z",
  "eliminadoPorId": "00000000-0000-4000-8000-000000000001"
}
```

#### 2. Bloqueo por Misión o Cuadrilla Activa (`409 Conflict`)
```json
{
  "message": "El recurso 'Camioneta Rescate 4x4' tiene 1 unidades actualmente en uso en terreno."
}
```
*O bien:*
```json
{
  "message": "El recurso 'Camioneta Rescate 4x4' se encuentra asignado a cuadrillas con misiones activas o en terreno (Cuadrilla Vías y Calles)."
}
```

#### 3. No Autenticado (`401 Unauthorized`)
```json
{
  "message": "Cabecera X-User-Id requerida para autenticación."
}
```

#### 4. Acceso Denegado (`403 Forbidden`)
```json
{
  "message": "Acceso denegado. Se requiere el perfil de Administrador para acceder al listado y gestión de permisos."
}
```

#### 5. Recurso Inexistente o Ya Eliminado (`404 Not Found`)
```json
{
  "message": "Recurso con ID '40000000-0000-4000-8000-000000000001' no encontrado."
}
```

---

## 3. Integración con Socket.io en Frontend

Para que todos los clientes en tiempo real retiren el recurso dado de baja:

```typescript
// En el hook o componente de listado de inventario
useEffect(() => {
  socket.on("recurso:eliminado", (data: { id: string; nombre: string }) => {
    // 1. Quitar el recurso del estado local o caché
    setRecursos((prev) => prev.filter((r) => r.id !== data.id));

    // 2. Notificación informativa opcional
    toast.info(`El recurso "${data.nombre}" fue dado de baja del inventario.`);
  });

  return () => {
    socket.off("recurso:eliminado");
  };
}, []);
```
