import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setSocketServer } from "./lib/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    // Unirse a salas por rol o área operativa
    socket.on("join", (room: string) => {
      socket.join(room);
    });

    socket.on("leave", (room: string) => {
      socket.leave(room);
    });
  });

  setSocketServer(io);

  httpServer.listen(port, () => {
    console.log(`> Servidor SGRAI API + WebSockets listo en http://${hostname}:${port}`);
  });
});
