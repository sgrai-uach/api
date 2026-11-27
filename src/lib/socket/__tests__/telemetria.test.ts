import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { Server as SocketIOServer } from "socket.io";
import WebSocket from "ws";
import type Redis from "ioredis";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setRedisClientForTesting } from "@/lib/redis";
import { generarTokenJwt } from "@/modules/seguridad/jwt";
import * as telemetriaRepo from "@/modules/geolocalizacion/telemetria.repository";
import { limpiarCacheTelemetria } from "@/modules/geolocalizacion/telemetria-cache.service";
import type { PosicionUnidadActivaDTO } from "@/modules/geolocalizacion/telemetria.schema";
import {
  setSocketServer,
  setRedisPublisherForTesting,
  notificarTelemetriaPosicion,
  notificarTelemetriaInactiva,
  REDIS_SOCKET_CHANNEL,
  SOCKET_INSTANCE_ID,
} from "../index";
import {
  esSalaRestringida,
  registrarMiddlewareAuthSocket,
  registrarHandlersBaseYTelemetria,
  procesarMensajeRedisSocket,
  type TypedSocketIOServer,
} from "../telemetria.handler";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../types";

/**
 * Cliente ligero Socket.io v4 sobre WebSocket real (Engine.IO v4) para pruebas
 * de integración end-to-end del simulador de coordenadas sin dependencias extra.
 */
class SimuladorSocketIOClient {
  private ws: WebSocket;
  private ackCounter = 1;
  private ackResolvers = new Map<number, (payload: unknown) => void>();
  private eventListeners = new Map<string, Array<(payload: unknown) => void>>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
  }

  static conectar(port: number, token?: string): Promise<SimuladorSocketIOClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
      const client = new SimuladorSocketIOClient(ws);
      let resuelto = false;

      ws.on("message", (raw) => {
        const msg = raw.toString();

        // Engine.IO OPEN ("0{...}") -> enviar Socket.IO CONNECT ("40{...}")
        if (msg.startsWith("0")) {
          const authPayload = token ? JSON.stringify({ token }) : "";
          ws.send(`40${authPayload}`);
          return;
        }

        // Engine.IO PING ("2") -> PONG ("3")
        if (msg === "2") {
          ws.send("3");
          return;
        }

        // Socket.IO CONNECT_ERROR ("44{...}")
        if (msg.startsWith("44")) {
          if (!resuelto) {
            resuelto = true;
            reject(new Error(msg.slice(2)));
          }
          return;
        }

        // Socket.IO CONNECTED ("40{...}")
        if (msg.startsWith("40")) {
          if (!resuelto) {
            resuelto = true;
            resolve(client);
          }
          return;
        }

        // Socket.IO ACK ("43<id>[...]")
        if (msg.startsWith("43")) {
          const match = /^43(\d+)(.*)$/.exec(msg);
          if (match) {
            const id = Number(match[1]);
            const args = JSON.parse(match[2]) as unknown[];
            const resolver = client.ackResolvers.get(id);
            if (resolver) {
              client.ackResolvers.delete(id);
              resolver(args[0]);
            }
          }
          return;
        }

        // Socket.IO EVENT ("42[event, payload]")
        if (msg.startsWith("42")) {
          const [event, payload] = JSON.parse(msg.slice(2)) as [string, unknown];
          const listeners = client.eventListeners.get(event) ?? [];
          for (const listener of listeners) {
            listener(payload);
          }
        }
      });

      ws.on("error", (err) => {
        if (!resuelto) {
          resuelto = true;
          reject(err);
        }
      });
    });
  }

  emitConAck<T = unknown>(event: string, payload: unknown): Promise<T> {
    const id = this.ackCounter++;
    return new Promise((resolve) => {
      this.ackResolvers.set(id, (res) => resolve(res as T));
      this.ws.send(`42${id}${JSON.stringify([event, payload])}`);
    });
  }

  esperarEvento<T = unknown>(event: string, timeoutMs = 2000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout esperando evento '${event}'`));
      }, timeoutMs);

      const lista = this.eventListeners.get(event) ?? [];
      const handler = (payload: unknown) => {
        clearTimeout(timer);
        const restantes = (this.eventListeners.get(event) ?? []).filter((h) => h !== handler);
        this.eventListeners.set(event, restantes);
        resolve(payload as T);
      };
      lista.push(handler);
      this.eventListeners.set(event, lista);
    });
  }

  cerrar(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      this.ws.once("close", () => resolve());
      this.ws.close();
    });
  }
}

describe("Socket.io Telemetría — Unitarias Broker Redis e Integración Real (HU-70)", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  const dummyPosicion: PosicionUnidadActivaDTO = {
    unidadId: "f1000000-0000-4000-8000-000000000001",
    tipoUnidad: "PATRULLA",
    lat: -39.81422,
    lng: -73.24589,
    timestamp: "2026-11-24T15:00:00.000Z",
    rumbo: 180,
    precision: 8.5,
    velocidad: 12.0,
    recibidoEn: "2026-11-24T15:00:01.000Z",
  };

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    setRedisClientForTesting(null);
    setRedisPublisherForTesting(null);
    setSocketServer(null);
    await limpiarCacheTelemetria();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setSocketServer(null);
    setRedisPublisherForTesting(null);
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it("debe emitir telemetria:posicion a 'mapa' localmente Y publicar en Redis Pub/Sub con originInstanceId (BUG-H70-API-03)", () => {
    const emitMock = vi.fn();
    const toMock = vi.fn().mockReturnValue({ emit: emitMock });
    const publishMock = vi.fn().mockResolvedValue(1);

    setSocketServer({ to: toMock } as unknown as TypedSocketIOServer);
    setRedisPublisherForTesting({ publish: publishMock } as unknown as Redis);

    notificarTelemetriaPosicion(dummyPosicion);

    expect(toMock).toHaveBeenCalledWith("mapa");
    expect(emitMock).toHaveBeenCalledWith("telemetria:posicion", dummyPosicion);
    expect(publishMock).toHaveBeenCalledWith(
      REDIS_SOCKET_CHANNEL,
      JSON.stringify({
        room: "mapa",
        event: "telemetria:posicion",
        payload: dummyPosicion,
        originInstanceId: SOCKET_INSTANCE_ID,
      })
    );
  });

  it("debe emitir telemetria:inactiva hacia 'mapa' y replicar por Redis Pub/Sub", () => {
    const emitMock = vi.fn();
    const toMock = vi.fn().mockReturnValue({ emit: emitMock });
    const publishMock = vi.fn().mockResolvedValue(1);

    setSocketServer({ to: toMock } as unknown as TypedSocketIOServer);
    setRedisPublisherForTesting({ publish: publishMock } as unknown as Redis);

    const payload = {
      unidadId: dummyPosicion.unidadId,
      tipoUnidad: "PATRULLA" as const,
      motivo: "UNIDAD_DISPONIBLE",
      detenidoEn: "2026-11-24T15:05:00.000Z",
    };

    notificarTelemetriaInactiva(payload);

    expect(toMock).toHaveBeenCalledWith("mapa");
    expect(emitMock).toHaveBeenCalledWith("telemetria:inactiva", payload);
    expect(publishMock).toHaveBeenCalledTimes(1);
  });

  it("procesarMensajeRedisSocket debe descartar mensajes de la misma instancia y retransmitir los de otras instancias", () => {
    const emitMock = vi.fn();
    const toMock = vi.fn().mockReturnValue({ emit: emitMock });
    const mockIo = { to: toMock } as unknown as TypedSocketIOServer;

    const mensajePropio = JSON.stringify({
      room: "mapa",
      event: "telemetria:posicion",
      payload: dummyPosicion,
      originInstanceId: "instancia-A",
    });
    expect(procesarMensajeRedisSocket(mockIo, mensajePropio, "instancia-A")).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();

    const mensajeOtraInstancia = JSON.stringify({
      room: "mapa",
      event: "telemetria:posicion",
      payload: dummyPosicion,
      originInstanceId: "instancia-B",
    });
    expect(procesarMensajeRedisSocket(mockIo, mensajeOtraInstancia, "instancia-A")).toBe(true);
    expect(toMock).toHaveBeenCalledWith("mapa");
    expect(emitMock).toHaveBeenCalledWith("telemetria:posicion", dummyPosicion);
  });

  it("esSalaRestringida debe proteger salas operativas y permitir salas públicas de seguimiento", () => {
    expect(esSalaRestringida("mapa")).toBe(true);
    expect(esSalaRestringida("encargado")).toBe(true);
    expect(esSalaRestringida("patrulla:123")).toBe(true);
    expect(esSalaRestringida("seguimiento:58291045")).toBe(false);
  });

  describe("Integración real Socket.io con simulador de coordenadas (CA-2, CA-3, CA-4)", () => {
    let httpServer: HttpServer;
    let io: TypedSocketIOServer;
    let port: number;
    let tokenEncargado: string;
    let tokenPatrulla: string;

    beforeEach(async () => {
      httpServer = createServer();
      io = new SocketIOServer<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
      >(httpServer, { path: "/socket.io/" });

      registrarMiddlewareAuthSocket(io);
      registrarHandlersBaseYTelemetria(io);
      setSocketServer(io);

      await new Promise<void>((resolve) => {
        httpServer.listen(0, "127.0.0.1", () => resolve());
      });
      port = (httpServer.address() as AddressInfo).port;

      tokenEncargado = (
        await generarTokenJwt({
          sub: "00000000-0000-4000-8000-000000000003",
          rut: "33333333-3",
          email: "encargado@valdivia.cl",
          rolId: "20000000-0000-4000-8000-000000000003",
          rolCodigo: "ENCARGADO",
          rolNombre: "Encargado",
          delegacionId: null,
        })
      ).token;

      tokenPatrulla = (
        await generarTokenJwt({
          sub: "d1000000-0000-4000-8000-000000000001",
          rut: "17888999-1",
          email: "pedro.patrulla@valdivia.cl",
          rolId: "20000000-0000-4000-8000-000000000004",
          rolCodigo: "PATRULLA_VERIFICADORA",
          rolNombre: "Patrulla Verificadora",
          delegacionId: null,
        })
      ).token;
    });

    afterEach(async () => {
      setSocketServer(null);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    it("debe rechazar handshake con JWT corrupto y bloquear join a sala 'mapa' sin autenticación", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(SimuladorSocketIOClient.conectar(port, "token.invalido.123")).rejects.toThrow();

      const anonimo = await SimuladorSocketIOClient.conectar(port);
      const resJoin = await anonimo.emitConAck<{ ok: boolean; error?: string }>("join", "mapa");
      expect(resJoin.ok).toBe(false);
      expect(resJoin.error).toContain("autenticación JWT");

      const resPublico = await anonimo.emitConAck<{ ok: boolean }>("join", "seguimiento:12345678");
      expect(resPublico.ok).toBe(true);

      const resSpoof = await anonimo.emitConAck<{ ok: boolean; codigo?: string }>(
        "telemetria:posicion",
        dummyPosicion
      );
      expect(resSpoof.ok).toBe(false);
      expect(resSpoof.codigo).toBe("NO_AUTENTICADO");

      await anonimo.cerrar();
    });

    it("debe retransmitir coordenadas simuladas desde patrulla en misión EN_CURSO hacia cliente en sala 'mapa' y pausar con telemetria:detener", async () => {
      vi.spyOn(telemetriaRepo, "verificarHabilitacionTelemetriaUnidadRepo").mockResolvedValue({
        habilitada: true,
        misionActivaId: "60000000-0000-4000-8000-000000000001",
        unidadNombre: "Patrulla Rápida Las Ánimas",
      });
      vi.spyOn(telemetriaRepo, "verificarPertenenciaUnidadRepo").mockResolvedValue({
        autorizada: true,
        unidadNombre: "Patrulla Rápida Las Ánimas",
      });

      const mapaClient = await SimuladorSocketIOClient.conectar(port, tokenEncargado);
      const joinAck = await mapaClient.emitConAck<{ ok: boolean }>("join", "mapa");
      expect(joinAck.ok).toBe(true);

      const pwaClient = await SimuladorSocketIOClient.conectar(port, tokenPatrulla);

      // Simular envío de trama GPS #1 y recepción en sala 'mapa'
      const promesaPosicion = mapaClient.esperarEvento<PosicionUnidadActivaDTO>(
        "telemetria:posicion"
      );
      const ackPosicion = await pwaClient.emitConAck<{ ok: boolean; data?: PosicionUnidadActivaDTO }>(
        "telemetria:posicion",
        {
          unidadId: "f1000000-0000-4000-8000-000000000010",
          tipoUnidad: "PATRULLA",
          lat: -39.81422,
          lng: -73.24589,
          timestamp: "2026-11-24T15:10:00.000Z",
          rumbo: 225.5,
          precision: 7.4,
          velocidad: 8.3,
        }
      );

      expect(ackPosicion.ok).toBe(true);
      const recibida = await promesaPosicion;
      expect(recibida.unidadId).toBe("f1000000-0000-4000-8000-000000000010");
      expect(recibida.lat).toBe(-39.81422);
      expect(recibida.lng).toBe(-73.24589);
      expect(recibida.rumbo).toBe(225.5);
      expect(recibida.precision).toBe(7.4);
      expect(recibida.recibidoEn).toBeDefined();

      // Simular payload malformado: descarte silencioso sin desconectar
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const ackInvalido = await pwaClient.emitConAck<{ ok: boolean; codigo?: string }>(
        "telemetria:posicion",
        { unidadId: "invalido", tipoUnidad: "PATRULLA", lat: 999, lng: 0, timestamp: "bad" }
      );
      expect(ackInvalido.ok).toBe(false);
      expect(ackInvalido.codigo).toBe("PAYLOAD_INVALIDO");

      // Simular pausa al concluir misión -> recepción de telemetria:inactiva en sala 'mapa'
      const promesaInactiva = mapaClient.esperarEvento<{
        unidadId: string;
        tipoUnidad: string;
        motivo: string;
      }>("telemetria:inactiva");
      const ackDetener = await pwaClient.emitConAck<{ ok: boolean }>("telemetria:detener", {
        unidadId: "f1000000-0000-4000-8000-000000000010",
        tipoUnidad: "PATRULLA",
        motivo: "MISION_COMPLETADA",
      });

      expect(ackDetener.ok).toBe(true);
      const eventoInactiva = await promesaInactiva;
      expect(eventoInactiva.unidadId).toBe("f1000000-0000-4000-8000-000000000010");
      expect(eventoInactiva.motivo).toBe("MISION_COMPLETADA");

      await pwaClient.cerrar();
      await mapaClient.cerrar();
    });
  });
});
