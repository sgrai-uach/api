import type { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

/**
 * Registra la instancia global del servidor Socket.io.
 */
export function setSocketServer(server: SocketIOServer): void {
  io = server;
}

/**
 * Obtiene la instancia activa de Socket.io.
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emite el evento de nuevo aviso a los operadores del Call Center.
 */
export function emitirNuevoAviso(aviso: Record<string, unknown>): void {
  if (!io) return;
  io.to("call-center").emit("aviso:nuevo", aviso);
  // También emitimos globalmente en caso de que el cliente no se haya unido a la sala
  io.emit("aviso:nuevo", aviso);
}

/**
 * Emite la notificación de aviso verificado y convertido a incidente.
 */
export function emitirAvisoVerificado(payload: {
  avisoId: string;
  incidenteId: string;
  folio: string;
}): void {
  if (!io) return;
  io.to("call-center").emit("aviso:verificado", payload);
  io.to("encargado").emit("incidente:creado", payload);
  io.emit("aviso:verificado", payload);
  io.emit("incidente:creado", payload);
}

/**
 * Emite la notificación de aviso descartado por el Call Center.
 */
export function emitirAvisoDescartado(payload: {
  avisoId: string;
  motivoDescarte: string;
}): void {
  if (!io) return;
  io.to("call-center").emit("aviso:descartado", payload);
  io.emit("aviso:descartado", payload);
}
