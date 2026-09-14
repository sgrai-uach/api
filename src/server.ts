import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import { setSocketServer, REDIS_SOCKET_CHANNEL } from "./lib/socket";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RedisSocketMessage,
} from "./lib/socket/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

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
      const redisSubscriber = new Redis(process.env.REDIS_URL);
      await redisSubscriber.subscribe(REDIS_SOCKET_CHANNEL);

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
    } catch (err) {
      console.warn("> Advertencia: Redis no disponible para Socket.io, operando en memoria:", err);
    }
  }

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => {
      socket.join(room);
    });

    socket.on("leave", (room: string) => {
      socket.leave(room);
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
