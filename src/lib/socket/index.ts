import type { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RedisSocketMessage,
} from "./types";

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

export interface IncidenteActualizadoPayload {
  id: string;
  codigo: string;
  nuevoEstado: string;
  prioridad: string;
  actualizadoEn: string;
}

export type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let ioInstance: TypedSocketServer | SocketIOServer | null = null;
let redisPublisher: Redis | null = null;

export const REDIS_SOCKET_CHANNEL = "sgrai:socket-events";

export function setSocketServer(server: TypedSocketServer | SocketIOServer): void {
  ioInstance = server;
}

export function getSocketServer(): TypedSocketServer | SocketIOServer | null {
  return ioInstance;
}

function getRedisPublisher(): Redis | null {
  if (!redisPublisher && process.env.REDIS_URL) {
    redisPublisher = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    redisPublisher.on("error", () => {});
  }
  return redisPublisher;
}

/**
 * Emite a las salas de Socket.IO tanto localmente como por Redis Pub/Sub
 */
function emitirEvento<E extends keyof ServerToClientEvents>(
  room: string,
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0]
): void {
  if (ioInstance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to(room) as any).emit(event, payload);
    return;
  }

  const publisher = getRedisPublisher();
  if (publisher) {
    const message: RedisSocketMessage = { room, event, payload };
    publisher.publish(REDIS_SOCKET_CHANNEL, JSON.stringify(message)).catch((err) => {
      console.error("[Socket.io Redis Publisher Error]:", err);
    });
  }
}

/**
 * Emite una notificación en tiempo real a la sala de encargados cuando se registra
 * un nuevo incidente manual o verificado.
 */
export function notificarIncidenteCreado(incidente: IncidenteNotificacionPayload): boolean {
  if (ioInstance) {
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

  const publisher = getRedisPublisher();
  if (publisher) {
    publisher.publish(
      REDIS_SOCKET_CHANNEL,
      JSON.stringify({
        room: "sala:encargados",
        event: "incidente:creado",
        payload: { evento: "incidente:creado", datos: incidente, emitidoEn: new Date().toISOString() },
      })
    ).catch(() => {});
    return true;
  }

  return false;
}

/**
 * Emite una actualización en tiempo real a la sala específica del informante
 * identificada por su código de seguimiento numérico.
 */
export function notificarActualizacionSeguimiento(datos: SeguimientoEstadoPayload): boolean {
  if (ioInstance) {
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

  const publisher = getRedisPublisher();
  if (publisher) {
    publisher.publish(
      REDIS_SOCKET_CHANNEL,
      JSON.stringify({
        room: `sala:seguimiento:${datos.codigoSeguimiento}`,
        event: "incidente:estado_actualizado",
        payload: { evento: "incidente:estado_actualizado", datos, emitidoEn: new Date().toISOString() },
      })
    ).catch(() => {});
    return true;
  }

  return false;
}

/**
 * Emite una actualización en tiempo real a la sala de encargados cuando se modifica
 * el estado, prioridad o gestión operativa de un incidente.
 */
export function notificarIncidenteActualizado(datos: IncidenteActualizadoPayload): boolean {
  if (ioInstance) {
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

  const publisher = getRedisPublisher();
  if (publisher) {
    publisher.publish(
      REDIS_SOCKET_CHANNEL,
      JSON.stringify({
        room: "sala:encargados",
        event: "incidente:actualizado",
        payload: { evento: "incidente:actualizado", datos, emitidoEn: new Date().toISOString() },
      })
    ).catch(() => {});
    return true;
  }

  return false;
}

/**
 * Emite el evento de nuevo aviso a los operadores del Call Center.
 */
export function emitirNuevoAviso(aviso: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitirEvento("call-center", "aviso:nuevo", aviso as any);
}

/**
 * Emite la notificación de aviso verificado y convertido a incidente.
 */
export function emitirAvisoVerificado(payload: {
  avisoId: string;
  incidenteId: string;
  folio: string;
}): void {
  emitirEvento("call-center", "aviso:verificado", payload);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitirEvento("encargado", "incidente:creado" as any, payload as any);
}

/**
 * Emite la notificación de aviso descartado por el Call Center.
 */
export function emitirAvisoDescartado(payload: {
  avisoId: string;
  motivoDescarte: string;
}): void {
  emitirEvento("call-center", "aviso:descartado", payload);
}

/**
 * Emite la notificación de recurso actualizado a las vistas de Encargado y Supervisor.
 */
export function emitirRecursoActualizado(recurso: Record<string, unknown>): void {
  if (ioInstance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("encargado") as any).emit("recurso:actualizado", recurso);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("supervisor") as any).emit("recurso:actualizado", recurso);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance as any).emit("recurso:actualizado", recurso);
    return;
  }

  const publisher = getRedisPublisher();
  if (publisher) {
    publisher
      .publish(
        REDIS_SOCKET_CHANNEL,
        JSON.stringify({
          room: "encargado",
          event: "recurso:actualizado",
          payload: recurso,
        })
      )
      .catch(() => {});
  }
}

/**
 * Emite la notificación de recurso eliminado a las vistas de Encargado, Supervisor y Administrador.
 */
export function emitirRecursoEliminado(payload: {
  id: string;
  nombre: string;
  eliminadoPorId: string;
  eliminadoEn: string;
}): void {
  if (ioInstance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("encargado") as any).emit("recurso:eliminado", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("supervisor") as any).emit("recurso:eliminado", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance as any).emit("recurso:eliminado", payload);
    return;
  }

  const publisher = getRedisPublisher();
  if (publisher) {
    publisher
      .publish(
        REDIS_SOCKET_CHANNEL,
        JSON.stringify({
          room: "encargado",
          event: "recurso:eliminado",
          payload,
        })
      )
      .catch(() => {});
  }
}

/**
 * Emite la notificación de nuevo evento de prevención creado a las vistas de Encargado,
 * al mapa interactivo y a la sala específica de la patrulla asignada (HU-30).
 */
export function emitirEventoPrevencionCreado(payload: {
  id: string;
  codigo: string;
  nombre: string;
  patrulla: { id: string; nombre: string; estado: string };
  [key: string]: unknown;
}): void {
  const patrullaRoom = `patrulla:${payload.patrulla.id}`;

  if (ioInstance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("sala:encargados") as any).emit("prevencion:creada", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("encargado") as any).emit("prevencion:creada", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to("mapa") as any).emit("prevencion:creada", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to(patrullaRoom) as any).emit("prevencion:creada", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance.to(`sala:${patrullaRoom}`) as any).emit("prevencion:creada", payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ioInstance as any).emit("prevencion:creada", payload);
    return;
  }

  const publisher = getRedisPublisher();
  if (publisher) {
    publisher
      .publish(
        REDIS_SOCKET_CHANNEL,
        JSON.stringify({
          room: "sala:encargados",
          event: "prevencion:creada",
          payload,
        })
      )
      .catch(() => {});

    publisher
      .publish(
        REDIS_SOCKET_CHANNEL,
        JSON.stringify({
          room: patrullaRoom,
          event: "prevencion:creada",
          payload,
        })
      )
      .catch(() => {});
  }
}

export * from "./types";

