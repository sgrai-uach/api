import type { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RedisSocketMessage,
} from "./types";

export type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: TypedSocketServer | null = null;
let redisPublisher: Redis | null = null;

export const REDIS_SOCKET_CHANNEL = "sgrai:socket-events";

export function setSocketServer(server: TypedSocketServer): void {
  io = server;
}

export function getSocketServer(): TypedSocketServer | null {
  return io;
}

function getRedisPublisher(): Redis | null {
  if (!redisPublisher && process.env.REDIS_URL) {
    redisPublisher = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
  }
  return redisPublisher;
}

/**
 * Emite a las salas de Socket.IO tanto localmente como por Redis Pub/Sub
 * para garantizar que eventos desde Workers o Route Handlers aislados se entreguen.
 */
function emitirEvento<E extends keyof ServerToClientEvents>(
  room: string,
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0]
): void {
  // 1. Emisión directa en memoria si io está inicializado en el proceso
  if (io) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (io.to(room) as any).emit(event, payload);
    return;
  }

  // 2. Emisión vía Redis Pub/Sub para alcanzar el servidor Socket.io desde scripts o workers externos
  const publisher = getRedisPublisher();
  if (publisher) {
    const message: RedisSocketMessage = { room, event, payload };
    publisher.publish(REDIS_SOCKET_CHANNEL, JSON.stringify(message)).catch((err) => {
      console.error("[Socket.io Redis Publisher Error]:", err);
    });
  }
}

export function emitirNuevoAviso(aviso: Record<string, unknown>): void {
  emitirEvento("call-center", "aviso:nuevo", aviso);
}

export function emitirAvisoVerificado(payload: {
  avisoId: string;
  incidenteId: string;
  folio: string;
}): void {
  emitirEvento("call-center", "aviso:verificado", payload);
  emitirEvento("encargado", "incidente:creado", payload);
}

export function emitirAvisoDescartado(payload: {
  avisoId: string;
  motivoDescarte: string;
}): void {
  emitirEvento("call-center", "aviso:descartado", payload);
}

export * from "./types";
