/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setSocketServer,
  setRedisPublisherForTest,
  notificarMisionAsignada,
  notificarMisionActualizada,
  notificarIncidenteActualizado,
  emitirCuadrillaActualizada,
  notificarTrazabilidadActualizada,
  tieneConexionEnSala,
  registrarSocketEnSala,
  removerSocketDeSala,
  REDIS_SOCKET_ROOM_PREFIX,
} from "../index";

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

  it("debe emitir mision:actualizada al aceptar asignación de cuadrilla (HU-40) con cuadrillaNombre, incidenteCodigo y prioridad hacia encargado, sala:encargados, supervisor, mapa y cuadrilla:{id}", () => {
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
      estado: "EN_CURSO",
      tipoMision: "ATENCION_CUADRILLA",
      cuadrillaId: "50000000-0000-4000-8000-000000000001",
      cuadrillaNombre: "Cuadrilla Vías y Canales 1",
      patrullaId: null,
      patrullaNombre: null,
      incidenteId: "30000000-0000-4000-8000-000000000001",
      incidenteCodigo: "INC-2026-0001",
      prioridad: "ALTA",
      fechaInicio: "2026-11-22T14:00:00.000Z",
      hito: {
        id: "hito-aceptar-001",
        hito: "MISION_ACEPTADA",
        descripcion: "Asignación Aceptada por Cuadrilla",
        registradoPorId: "d0000000-0000-4000-8000-000000000001",
        creadoEn: "2026-11-22T14:00:00.000Z",
      },
      actualizadoEn: "2026-11-22T14:00:00.000Z",
    });

    expect(roomsEmitidos).toEqual(
      expect.arrayContaining([
        "encargado",
        "sala:encargados",
        "supervisor",
        "mapa",
        "cuadrilla:50000000-0000-4000-8000-000000000001",
      ])
    );
    expect(emitMock).toHaveBeenCalledWith(
      "mision:actualizada",
      expect.objectContaining({
        estado: "EN_CURSO",
        cuadrillaNombre: "Cuadrilla Vías y Canales 1",
        incidenteCodigo: "INC-2026-0001",
        prioridad: "ALTA",
      })
    );
  });

  it("no debe emitir broadcast global io.emit en notificarMisionAsignada y debe incluir incidenteId/tipoUnidad en trazabilidad", () => {
    const roomsEmitidos: string[] = [];
    const emitSalaMock = vi.fn();
    const emitGlobalMock = vi.fn();

    const ioMock: any = {
      to: vi.fn((room: string) => {
        roomsEmitidos.push(room);
        return { emit: emitSalaMock };
      }),
      emit: emitGlobalMock,
    };

    setSocketServer(ioMock);

    notificarMisionAsignada({
      notificacionId: "80000000-0000-4000-8000-000000000011",
      misionId: "70000000-0000-4000-8000-000000000011",
      codigo: "MIS-2026-0011",
      tipoMision: "ATENCION_CUADRILLA",
      tipoUnidad: "CUADRILLA",
      patrullaId: null,
      cuadrillaId: "50000000-0000-4000-8000-000000000001",
      incidenteId: "30000000-0000-4000-8000-000000000001",
      asignadoEn: "2026-11-24T12:00:00.000Z",
    });

    expect(emitGlobalMock).not.toHaveBeenCalled();
    expect(roomsEmitidos).toContain("cuadrilla:50000000-0000-4000-8000-000000000001");
    expect(roomsEmitidos).toContain("encargado");

    notificarTrazabilidadActualizada({
      notificacionId: "80000000-0000-4000-8000-000000000011",
      misionId: "70000000-0000-4000-8000-000000000011",
      incidenteId: "30000000-0000-4000-8000-000000000001",
      patrullaId: null,
      cuadrillaId: "50000000-0000-4000-8000-000000000001",
      tipoUnidad: "CUADRILLA",
      estado: "LEIDA",
      intentosEnvio: 1,
      creadaAt: "2026-11-24T12:00:00.000Z",
      enviadaAt: "2026-11-24T12:00:01.000Z",
      recibidaAt: "2026-11-24T12:00:02.000Z",
      leidaAt: "2026-11-24T12:00:03.000Z",
      actualizadoEn: "2026-11-24T12:00:03.000Z",
    });

    expect(emitSalaMock).toHaveBeenCalledWith(
      "notificacion:trazabilidad_actualizada",
      expect.objectContaining({
        incidenteId: "30000000-0000-4000-8000-000000000001",
        cuadrillaId: "50000000-0000-4000-8000-000000000001",
        tipoUnidad: "CUADRILLA",
        estado: "LEIDA",
      })
    );
  });

  it("usa Redis como fallback en tieneConexionEnSala cuando getSocketServer() es null (Route Handlers aislados)", async () => {
    setSocketServer(null as any);
    const redisMock = {
      sadd: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      scard: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    };
    setRedisPublisherForTest(redisMock as any);

    try {
      const room = "cuadrilla:50000000-0000-4000-8000-000000000099";
      await registrarSocketEnSala(room, "sock-cuad-1");
      expect(redisMock.sadd).toHaveBeenCalledWith(
        `${REDIS_SOCKET_ROOM_PREFIX}${room}`,
        "sock-cuad-1"
      );

      expect(await tieneConexionEnSala(room)).toBe(true);
      await removerSocketDeSala(room, "sock-cuad-1");
      expect(redisMock.srem).toHaveBeenCalledWith(
        `${REDIS_SOCKET_ROOM_PREFIX}${room}`,
        "sock-cuad-1"
      );
      expect(await tieneConexionEnSala(room)).toBe(false);
    } finally {
      setRedisPublisherForTest(null);
    }
  });
});
