/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setSocketServer,
  notificarMisionActualizada,
  notificarIncidenteActualizado,
  emitirCuadrillaActualizada,
  emitirAsistenciaSocialCreada,
  emitirAsistenciaSocialActualizada,
  REDIS_SOCKET_CHANNEL,
} from "../index";

const publishSpy = vi.fn().mockResolvedValue(1);

vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      publish: publishSpy,
    })),
  };
});

describe("Socket.io Salas Destino - mision:actualizada, incidente:actualizado y cuadrilla:actualizada (HU-68)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setSocketServer(null as any);
  });

  it("debe emitir mision:actualizada hacia las salas encargado y mapa (además de sala:encargados, supervisor y cuadrilla)", () => {
    const roomsEmitidos: string[] = [];
    const emitMock = vi.fn();

    const ioMock: any = {
      to: vi.fn((room: string) => {
        roomsEmitidos.push(room);
        return { emit: emitMock };
      }),
    };

    setSocketServer(ioMock);

    notificarMisionActualizada({
      misionId: "70000000-0000-4000-8000-000000000001",
      codigo: "MIS-2026-0005",
      estado: "COMPLETADA",
      tipoMision: "ATENCION_CUADRILLA",
      cuadrillaId: "50000000-0000-4000-8000-000000000001",
      incidenteId: "30000000-0000-4000-8000-000000000001",
      fechaInicio: "2026-11-18T14:00:00.000Z",
      fechaCierre: "2026-11-18T19:00:00.000Z",
      hito: {
        id: "hito-001",
        hito: "MISION_COMPLETADA",
        descripcion: "Misión cerrada por cuadrilla.",
        registradoPorId: "d0000000-0000-4000-8000-000000000001",
        creadoEn: "2026-11-18T19:00:00.000Z",
      },
      actualizadoEn: "2026-11-18T19:00:00.000Z",
    });

    expect(roomsEmitidos).toContain("encargado");
    expect(roomsEmitidos).toContain("mapa");
    expect(roomsEmitidos).toContain("sala:encargados");
    expect(roomsEmitidos).toContain("supervisor");
    expect(roomsEmitidos).toContain("cuadrilla:50000000-0000-4000-8000-000000000001");
    expect(emitMock).toHaveBeenCalledWith(
      "mision:actualizada",
      expect.objectContaining({ estado: "COMPLETADA" })
    );
  });

  it("debe emitir incidente:actualizado y cuadrilla:actualizada incluyendo las salas encargado y mapa", () => {
    const roomsEmitidos: string[] = [];
    const emitMock = vi.fn();

    const ioMock: any = {
      to: vi.fn((room: string) => {
        roomsEmitidos.push(room);
        return { emit: emitMock };
      }),
      emit: emitMock,
    };

    setSocketServer(ioMock);

    notificarIncidenteActualizado({
      id: "30000000-0000-4000-8000-000000000001",
      codigo: "INC-2026-0042",
      nuevoEstado: "EN_ATENCION",
      prioridad: "ALTA",
      actualizadoEn: "2026-11-18T19:00:00.000Z",
    });

    expect(roomsEmitidos).toContain("encargado");
    expect(roomsEmitidos).toContain("mapa");
    expect(roomsEmitidos).toContain("sala:encargados");

    roomsEmitidos.length = 0;

    emitirCuadrillaActualizada({
      id: "50000000-0000-4000-8000-000000000001",
      nombre: "Cuadrilla Vías y Canales 1",
      estado: "DISPONIBLE",
    });

    expect(roomsEmitidos).toContain("encargado");
    expect(roomsEmitidos).toContain("mapa");
    expect(roomsEmitidos).toContain("sala:encargados");
    expect(roomsEmitidos).toContain("supervisor");
  });

  it("comparte ioInstance vía globalThis aunque se importe getSocketServer tras setSocketServer", () => {
    const ioMock: any = { to: vi.fn(() => ({ emit: vi.fn() })) };
    setSocketServer(ioMock);
    expect((globalThis as { __sgraiSocketIo?: unknown }).__sgraiSocketIo).toBe(ioMock);

    notificarMisionActualizada({
      misionId: "70000000-0000-4000-8000-000000000002",
      codigo: "MIS-2026-0002",
      estado: "COMPLETADA",
      tipoMision: "ATENCION_CUADRILLA",
      cuadrillaId: "50000000-0000-4000-8000-000000000001",
      cuadrillaNombre: "Cuadrilla Aguas Lluvias Alfa",
      incidenteId: "a1000000-0000-4000-8000-000000000004",
      incidenteCodigo: "INC-2026-0004",
      fechaInicio: "2026-11-18T14:00:00.000Z",
      fechaCierre: "2026-11-18T19:00:00.000Z",
      hito: {
        id: "hito-002",
        hito: "MISION_COMPLETADA",
        descripcion: "Misión cerrada por cuadrilla.",
        registradoPorId: "d0000000-0000-4000-8000-000000000001",
        creadoEn: "2026-11-18T19:00:00.000Z",
      },
      actualizadoEn: "2026-11-18T19:00:00.000Z",
    });

    expect(ioMock.to).toHaveBeenCalledWith("encargado");
    setSocketServer(null as any);
    expect((globalThis as { __sgraiSocketIo?: unknown }).__sgraiSocketIo).toBeNull();
  });

  it("debe emitir asistencia_social:creada y asistencia_social:actualizada a las salas asistente_social y encargado vía Socket.io y Redis Pub/Sub (HU-25)", () => {
    const roomsEmitidos: string[] = [];
    const emitMock = vi.fn();
    const ioMock: any = {
      to: vi.fn((room: string) => {
        roomsEmitidos.push(room);
        return { emit: emitMock };
      }),
      emit: emitMock,
    };

    setSocketServer(ioMock);
    const payload = { id: "ev-1", codigo: "AS-2026-0001", estado: "ASIGNADO" };
    emitirAsistenciaSocialCreada(payload);

    expect(roomsEmitidos).toContain("asistente_social");
    expect(roomsEmitidos).toContain("encargado");
    expect(roomsEmitidos).toContain("sala:encargados");
    expect(roomsEmitidos).toContain("centro_mando");
    expect(roomsEmitidos).toContain("administrador");
    expect(emitMock).toHaveBeenCalledWith("asistencia_social:creada", payload);

    roomsEmitidos.length = 0;
    emitirAsistenciaSocialActualizada(payload);
    expect(roomsEmitidos).toContain("asistente_social");
    expect(roomsEmitidos).toContain("encargado");
    expect(emitMock).toHaveBeenCalledWith("asistencia_social:actualizada", payload);

    // Rama Redis Pub/Sub multi-sala sin instancia directa de Socket.io
    setSocketServer(null as any);
    const redisAnterior = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://localhost:6379";

    try {
      emitirAsistenciaSocialCreada(payload);
      const canalesPublicados = publishSpy.mock.calls.map(([canal, msg]) => ({
        canal,
        parsed: JSON.parse(msg as string),
      }));
      expect(
        canalesPublicados.some(
          (c) =>
            c.canal === REDIS_SOCKET_CHANNEL &&
            c.parsed.event === "asistencia_social:creada" &&
            c.parsed.room === "asistente_social"
        )
      ).toBe(true);
      expect(
        canalesPublicados.some(
          (c) =>
            c.canal === REDIS_SOCKET_CHANNEL &&
            c.parsed.event === "asistencia_social:creada" &&
            c.parsed.room === "encargado"
        )
      ).toBe(true);
    } finally {
      if (redisAnterior === undefined) {
        delete process.env.REDIS_URL;
      } else {
        process.env.REDIS_URL = redisAnterior;
      }
    }
  });
});
