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

export interface SeguimientoEstadoPayload {
  codigoSeguimiento: string;
  estado: string;
  estadoEtiqueta: string;
  estadoDescripcion: string;
  actualizadoEn: string;
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
 * un nuevo incidente.
 */
export function notificarIncidenteCreado(incidente: IncidenteNotificacionPayload): boolean {
  if (!ioInstance) {
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

/**
 * Emite una actualización en tiempo real a la sala específica del informante
 * identificada por su código de seguimiento numérico.
 * Sala: 'sala:seguimiento:{codigoSeguimiento}'
 * Evento: 'incidente:estado_actualizado'
 */
export function notificarActualizacionSeguimiento(datos: SeguimientoEstadoPayload): boolean {
  if (!ioInstance) {
    return false;
  }

  try {
    ioInstance.to(`sala:seguimiento:${datos.codigoSeguimiento}`).emit("incidente:estado_actualizado", {
      evento: "incidente:estado_actualizado",
      datos,
      emitidoEn: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Error al emitir actualización de seguimiento vía Socket.io:", error);
    return false;
  }
}

export interface IncidenteActualizadoPayload {
  id: string;
  codigo: string;
  nuevoEstado: string;
  prioridad: string;
  actualizadoEn: string;
}

/**
 * Emite una actualización en tiempo real a la sala de encargados cuando se modifica
 * el estado, prioridad o gestión operativa de un incidente.
 * Sala: 'sala:encargados'
 * Evento: 'incidente:actualizado'
 */
export function notificarIncidenteActualizado(datos: IncidenteActualizadoPayload): boolean {
  if (!ioInstance) {
    return false;
  }

  try {
    ioInstance.to("sala:encargados").emit("incidente:actualizado", {
      evento: "incidente:actualizado",
      datos,
      emitidoEn: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Error al emitir actualización de incidente vía Socket.io:", error);
    return false;
  }
}
