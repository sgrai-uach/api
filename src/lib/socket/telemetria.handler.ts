import { randomUUID } from "crypto";
import type { Server as SocketIOServer } from "socket.io";
import { verificarTokenJwt } from "@/modules/seguridad/jwt";
import {
  procesarTelemetriaPosicionService,
  procesarDetencionTelemetriaClienteService,
} from "@/modules/geolocalizacion/telemetria.service";
import { SOCKET_INSTANCE_ID } from "./index";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RedisSocketMessage,
} from "./types";

export type TypedSocketIOServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const SALAS_OPERATIVAS_EXACTAS = new Set([
  "mapa",
  "encargado",
  "sala:encargados",
  "supervisor",
  "operaciones",
  "call-center",
  "admin",
  "administrador",
]);

const PREFIJOS_SALAS_OPERATIVAS = ["patrulla:", "cuadrilla:", "sala:"];

/**
 * Determina si una sala de Socket.io corresponde a información operativa restringida
 * que requiere sesión autenticada mediante JWT (ej. 'mapa', 'encargado', 'patrulla:{id}').
 * Salas públicas de seguimiento ciudadano (ej. 'seguimiento:{codigo}') permanecen abiertas.
 */
export function esSalaRestringida(room: string): boolean {
  const normalizada = room.trim().toLowerCase();
  if (SALAS_OPERATIVAS_EXACTAS.has(normalizada)) {
    return true;
  }
  return PREFIJOS_SALAS_OPERATIVAS.some((prefijo) => normalizada.startsWith(prefijo));
}

/**
 * Middleware JWT en handshake de Socket.io.
 * Si el cliente presenta token (auth.token o cabecera Authorization: Bearer), lo verifica
 * criptográficamente y adjunta userId/role a socket.data; rechaza conexiones con token inválido.
 */
export function registrarMiddlewareAuthSocket(io: TypedSocketIOServer): void {
  io.use(async (socket, next) => {
    const authToken =
      typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token.trim() : null;
    const headerAuth =
      typeof socket.handshake.headers?.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "").trim()
        : null;
    const rawToken = authToken || headerAuth;

    if (rawToken) {
      try {
        const payload = await verificarTokenJwt(rawToken);
        socket.data.userId = payload.sub;
        socket.data.role = payload.rolCodigo;
      } catch (err) {
        console.warn("[Socket.io Auth Warning]: Token inválido en handshake:", err);
        return next(new Error("Autenticación inválida: token no válido o expirado"));
      }
    }

    return next();
  });
}

/**
 * Procesa mensajes entrantes desde el canal Redis Pub/Sub filtrando eventos originados
 * por la misma instancia del servidor para evitar retransmisiones duplicadas.
 */
export function procesarMensajeRedisSocket(
  io: TypedSocketIOServer,
  rawMessage: string,
  instanceId: string = SOCKET_INSTANCE_ID
): boolean {
  try {
    const parsed = JSON.parse(rawMessage) as RedisSocketMessage;
    if (!parsed || !parsed.room || !parsed.event) {
      return false;
    }

    if (parsed.originInstanceId && parsed.originInstanceId === instanceId) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (io.to(parsed.room) as any).emit(parsed.event, parsed.payload);
    return true;
  } catch (e) {
    console.error("Error al parsear mensaje de Redis Socket:", e);
    return false;
  }
}

/**
 * Registra los listeners base de gestión de salas (con protección de salas operativas)
 * y los listeners de telemetría GPS (`telemetria:posicion` y `telemetria:detener`).
 */
export function registrarHandlersBaseYTelemetria(io: TypedSocketIOServer): void {
  io.on("connection", (socket) => {
    const manejarIngresoSala = (
      room: string,
      callback?: (response: { ok: boolean; error?: string }) => void
    ) => {
      if (typeof room !== "string" || room.trim() === "") {
        callback?.({ ok: false, error: "Nombre de sala inválido." });
        return;
      }

      if (esSalaRestringida(room) && !socket.data.userId) {
        console.warn(
          `[Socket.io Security]: Intento anónimo bloqueado para unirse a sala '${room}' (${socket.id}).`
        );
        callback?.({
          ok: false,
          error: `Se requiere autenticación JWT para suscribirse a la sala '${room}'.`,
        });
        return;
      }

      socket.join(room);
      callback?.({ ok: true });
    };

    socket.on("join", manejarIngresoSala);
    socket.on("unirse", manejarIngresoSala);

    socket.on("leave", (room: string) => {
      if (typeof room === "string") {
        socket.leave(room);
      }
    });

    socket.on("salir", (room: string) => {
      if (typeof room === "string") {
        socket.leave(room);
      }
    });

    socket.on("telemetria:posicion", async (data, callback) => {
      try {
        const resultado = await procesarTelemetriaPosicionService(data, {
          usuarioId: socket.data.userId,
          rolCodigo: socket.data.role,
        });
        callback?.(resultado);
      } catch (err) {
        console.error("[Socket Telemetria]: Error inesperado procesando telemetría:", err);
        callback?.({
          ok: false,
          codigo: "ERROR_INTERNO",
          error: "Error interno al procesar coordenadas de telemetría.",
        });
      }
    });

    socket.on("telemetria:detener", async (data, callback) => {
      try {
        const resultado = await procesarDetencionTelemetriaClienteService(data, {
          usuarioId: socket.data.userId,
          rolCodigo: socket.data.role,
        });
        callback?.(resultado);
      } catch (err) {
        console.error("[Socket Telemetria]: Error al detener telemetría:", err);
        callback?.({
          ok: false,
          codigo: "ERROR_INTERNO",
          error: "Error interno al detener telemetría de la unidad.",
        });
      }
    });
  });
}

export function generarInstanceIdPrueba(): string {
  return randomUUID();
}
