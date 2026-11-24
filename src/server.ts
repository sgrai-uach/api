import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import { loadEnvConfig } from "@next/env";
import {
  setSocketServer,
  REDIS_SOCKET_CHANNEL,
  registrarSocketEnSala,
  removerSocketDeSala,
  limpiarPresenciaSocket,
  limpiarPresenciaSalasRedis,
} from "./lib/socket";
import { actualizarEstadoNotificacionService } from "./modules/misiones/notificacion-mision.service";
import { verificarTokenJwt } from "./modules/seguridad/jwt";
import { TelemetriaPosicionPayloadSchema } from "./modules/geolocalizacion/telemetria.schema";
import { guardarPosicionUnidad } from "./modules/geolocalizacion/telemetria-cache.service";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RedisSocketMessage,
} from "./lib/socket/types";

// Cargar variables de entorno desde .env, .env.local, etc.
loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function bootstrap() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Recuperación de estado de conexión tras microcortes
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  // Suscribirse al canal de Redis para recibir eventos de Workers / Route Handlers
  if (process.env.REDIS_URL) {
    try {
      const redisSubscriber = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 500, 5000),
        lazyConnect: true,
      });
      redisSubscriber.on("error", () => {});
      redisSubscriber.on("ready", () => {
        void redisSubscriber.subscribe(REDIS_SOCKET_CHANNEL).catch(() => {});
      });

      await redisSubscriber.connect();
      await redisSubscriber.subscribe(REDIS_SOCKET_CHANNEL);
      void limpiarPresenciaSalasRedis();

      redisSubscriber.on("message", (channel, message) => {
        if (channel === REDIS_SOCKET_CHANNEL) {
          try {
            const { room, event, payload } = JSON.parse(message) as RedisSocketMessage;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (io.to(room) as any).emit(event, payload);
          } catch (e) {
            console.error("Error al parsear mensaje de Redis Socket:", e);
          }
        }
      });
      console.log("> Conectado a Redis Pub/Sub para eventos de Socket.io.");
    } catch {
      console.warn("> Advertencia: Redis no disponible para Socket.io, operando en memoria.");
    }
  }

  // Middleware de autenticación opcional / progresivo para sockets conectados con JWT
  io.use(async (socket, next) => {
    const rawToken =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.headers?.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : null);

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

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => {
      socket.join(room);
      void registrarSocketEnSala(room, socket.id);
    });

    socket.on("unirse", (room: string) => {
      socket.join(room);
      void registrarSocketEnSala(room, socket.id);
    });

    socket.on("leave", (room: string) => {
      socket.leave(room);
      void removerSocketDeSala(room, socket.id);
    });

    socket.on("salir", (room: string) => {
      socket.leave(room);
      void removerSocketDeSala(room, socket.id);
    });

    socket.on("disconnecting", () => {
      void limpiarPresenciaSocket(socket.rooms, socket.id);
    });

    socket.on("notificacion:ack", async (payload, callback) => {
      try {
        if (!payload || !payload.notificacionId || !["RECIBIDA", "LEIDA"].includes(payload.estado)) {
          callback?.({ ok: false, error: "Payload inválido para notificacion:ack." });
          return;
        }

        const usuarioId = socket.data?.userId ?? "00000000-0000-4000-8000-000000000001";
        const esAdmin = socket.data?.role === "ADMIN" || !socket.data?.userId;

        const resultado = await actualizarEstadoNotificacionService(
          payload.notificacionId,
          payload.estado,
          usuarioId,
          esAdmin
        );

        callback?.({ ok: true, message: resultado.message, data: resultado.data });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar acuse de notificación.";
        callback?.({ ok: false, error: msg });
      }
    });

    socket.on("telemetria:posicion", async (data) => {
      const validacion = TelemetriaPosicionPayloadSchema.safeParse(data);
      if (!validacion.success) {
        console.warn("[Socket Telemetria]: Coordenadas o payload inválido recibido:", validacion.error.issues);
        return;
      }

      try {
        const posicionPersistida = await guardarPosicionUnidad(validacion.data);
        io.to("mapa").emit("telemetria:posicion", posicionPersistida);
      } catch (err) {
        console.error("[Socket Telemetria]: Error procesando telemetría:", err);
      }
    });
  });

  setSocketServer(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Servidor SGRAI API + WebSockets listo en http://${hostname}:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Error al inicializar el servidor:", err);
  process.exit(1);
});
