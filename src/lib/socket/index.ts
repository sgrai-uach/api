import type { Server as SocketIOServer } from "socket.io";

export interface IncidenteNotificacionPayload {
  id: string;
  codigo: string;
  tipoAfectacion: string;
  direccion: string;
  latitud: number;
  longitud: number;
  estado: string;
  prioridad: string;
  requiereAsistenciaSocial?: boolean;
  creadoEn: string;
}

// Referencia global al servidor Socket.io en runtime
let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer): void {
  ioInstance = io;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Emite una notificación en tiempo real a la sala de encargados cuando se registra
 * un nuevo incidente manual o verificado.
 * Diseñado a prueba de fallos: si Socket.io no está inicializado (ej. en tests o Next.js standalone),
 * no interrumpe el flujo HTTP.
 */
export function notificarIncidenteCreado(incidente: IncidenteNotificacionPayload): boolean {
  if (!ioInstance) {
    // Si aún no se inicializa el socket server (ej. durante pruebas unitarias o desarrollo)
    return false;
  }

  try {
    ioInstance.to("sala:encargados").emit("incidente:creado", {
      evento: "incidente:creado",
      datos: incidente,
      emitidoEn: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Error al emitir notificación de incidente vía Socket.io:", error);
    return false;
  }
}
