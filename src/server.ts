import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import { loadEnvConfig } from "@next/env";
import { setSocketServer, REDIS_SOCKET_CHANNEL } from "./lib/socket";
import {
  registrarMiddlewareAuthSocket,
  registrarHandlersBaseYTelemetria,
  procesarMensajeRedisSocket,
} from "./lib/socket/telemetria.handler";
import { actualizarEstadoNotificacionService } from "./modules/misiones/notificacion-mision.service";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
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

  // Suscribirse al canal de Redis para recibir eventos de Workers / Route Handlers / otras instancias
  if (process.env.REDIS_URL) {
    try {
      const redisSubscriber = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: true,
      });
      redisSubscriber.on("error", () => {});

      await redisSubscriber.connect();
      await redisSubscriber.subscribe(REDIS_SOCKET_CHANNEL);

      redisSubscriber.on("message", (channel, message) => {
        if (channel === REDIS_SOCKET_CHANNEL) {
          procesarMensajeRedisSocket(io, message);
        }
      });
      console.log("> Conectado a Redis Pub/Sub para eventos de Socket.io.");
    } catch {
      console.warn("> Advertencia: Redis no disponible para Socket.io, operando en memoria.");
    }
  }

  // Middleware JWT y handlers desacoplados de salas y telemetría GPS (HU-70)
  registrarMiddlewareAuthSocket(io);
  registrarHandlersBaseYTelemetria(io);

  // Handler de acuse de lectura de notificaciones tácticas (HU-35)
  io.on("connection", (socket) => {
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

        callback?.({ ok: true, message: resultado.message });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar acuse de notificación.";
        callback?.({ ok: false, error: msg });
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
