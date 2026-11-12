import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  vincularEntidadesEventoAtpService,
  desvincularEntidadesEventoAtpService,
} from "../vinculacion.service";
import { seguridadService } from "@/modules/seguridad/service";
import * as repo from "../vinculacion.repository";
import * as socket from "@/lib/socket";
import { ConflictError, NotFoundError } from "@/modules/seguridad/errors";
import type { FilaEntidadVinculable } from "../vinculacion.repository";

vi.mock("@/modules/seguridad/service", () => ({
  seguridadService: {
    validarAccesoRoles: vi.fn(),
  },
}));

vi.mock("../vinculacion.repository", () => ({
  buscarEventoAtpParaVinculacion: vi.fn(),
  obtenerEntidadesExistentes: vi.fn(),
  actualizarEventoAtpDeEntidades: vi.fn(),
  desvincularEntidadesDelEvento: vi.fn(),
  ejecutarTransaccionVinculacion: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  emitirEventoAtpVinculado: vi.fn(),
}));

const usuario = {
  id: "00000000-0000-4000-8000-000000000003",
  rut: "33333333-3",
  nombre: "Encargado Operativo",
  email: "encargado@valdivia.cl",
  rolId: "20000000-0000-4000-8000-000000000003",
  rolNombre: "Encargado",
  activo: true,
};

const eventoAtpId = "50000000-0000-4000-8000-000000000001";
const otroEventoAtpId = "50000000-0000-4000-8000-000000000002";
const incidenteId = "a0000000-0000-4000-8000-000000000001";
const prevencionId = "b0000000-0000-4000-8000-000000000001";

const eventoCreado = {
  id: eventoAtpId,
  codigo: "ATP-2026-0001",
  estado: "ACTIVO",
};

function fila(
  tipo: FilaEntidadVinculable["tipo"],
  id: string,
  eventoAtpIdActual: string | null
): FilaEntidadVinculable {
  return {
    tipo,
    id,
    codigo: `COD-${id.slice(0, 4)}`,
    nombre: `Entidad ${id.slice(0, 4)}`,
    evento_atp_id: eventoAtpIdActual,
  };
}

describe("vinculacion.service - Vinculación de entidades (H60)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(seguridadService.validarAccesoRoles).mockResolvedValue(
      usuario as never
    );
    vi.mocked(repo.ejecutarTransaccionVinculacion).mockImplementation(
      async (callback) => callback({} as never)
    );
    vi.mocked(repo.buscarEventoAtpParaVinculacion).mockResolvedValue(
      eventoCreado as never
    );
  });

  it("vincula una entidad y emite evento_atp:vinculado", async () => {
    vi.mocked(repo.obtenerEntidadesExistentes).mockResolvedValue([
      fila("INCIDENTE", incidenteId, null),
    ]);

    const resultado = await vincularEntidadesEventoAtpService(
      eventoAtpId,
      { incidenteIds: [incidenteId] } as never,
      usuario.id
    );

    expect(repo.actualizarEventoAtpDeEntidades).toHaveBeenCalledWith(
      expect.anything(),
      eventoAtpId,
      expect.objectContaining({ incidenteIds: [incidenteId] })
    );
    expect(resultado.accion).toBe("VINCULADO");
    expect(resultado.entidades.incidentes).toHaveLength(1);
    expect(resultado.reasignadas).toHaveLength(0);
    expect(socket.emitirEventoAtpVinculado).toHaveBeenCalledWith(resultado);
  });

  it("reporta como reasignadas las entidades que pertenecían a otro Evento ATP", async () => {
    vi.mocked(repo.obtenerEntidadesExistentes).mockResolvedValue([
      fila("INCIDENTE", incidenteId, otroEventoAtpId),
      fila("EVENTO_PREVENCION", prevencionId, null),
    ]);

    const resultado = await vincularEntidadesEventoAtpService(
      eventoAtpId,
      { incidenteIds: [incidenteId], eventoPrevencionIds: [prevencionId] } as never,
      usuario.id
    );

    expect(resultado.reasignadas).toHaveLength(1);
    expect(resultado.reasignadas[0].id).toBe(incidenteId);
    expect(resultado.reasignadas[0].eventoAtpIdAnterior).toBe(otroEventoAtpId);
    expect(resultado.entidades.eventosPrevencion).toHaveLength(1);
  });

  it("deduplica identificadores repetidos antes de actualizar", async () => {
    vi.mocked(repo.obtenerEntidadesExistentes).mockResolvedValue([
      fila("INCIDENTE", incidenteId, null),
    ]);

    await vincularEntidadesEventoAtpService(
      eventoAtpId,
      { incidenteIds: [incidenteId, incidenteId] } as never,
      usuario.id
    );

    expect(repo.actualizarEventoAtpDeEntidades).toHaveBeenCalledWith(
      expect.anything(),
      eventoAtpId,
      expect.objectContaining({ incidenteIds: [incidenteId] })
    );
  });

  it("lanza NotFoundError si el Evento ATP no existe", async () => {
    vi.mocked(repo.buscarEventoAtpParaVinculacion).mockResolvedValue(undefined);

    await expect(
      vincularEntidadesEventoAtpService(
        eventoAtpId,
        { incidenteIds: [incidenteId] } as never,
        usuario.id
      )
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.actualizarEventoAtpDeEntidades).not.toHaveBeenCalled();
    expect(socket.emitirEventoAtpVinculado).not.toHaveBeenCalled();
  });

  it("lanza ConflictError si el Evento ATP no está ACTIVO", async () => {
    vi.mocked(repo.buscarEventoAtpParaVinculacion).mockResolvedValue({
      ...eventoCreado,
      estado: "FINALIZADO",
    } as never);

    await expect(
      vincularEntidadesEventoAtpService(
        eventoAtpId,
        { incidenteIds: [incidenteId] } as never,
        usuario.id
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("propaga el ForbiddenError del control RBAC", async () => {
    const error = new Error("Acceso denegado");
    vi.mocked(seguridadService.validarAccesoRoles).mockRejectedValue(error);

    await expect(
      vincularEntidadesEventoAtpService(
        eventoAtpId,
        { incidenteIds: [incidenteId] } as never,
        usuario.id
      )
    ).rejects.toBe(error);
  });
});

describe("vinculacion.service - Desvinculación de entidades (H60)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(seguridadService.validarAccesoRoles).mockResolvedValue(
      usuario as never
    );
    vi.mocked(repo.ejecutarTransaccionVinculacion).mockImplementation(
      async (callback) => callback({} as never)
    );
    vi.mocked(repo.buscarEventoAtpParaVinculacion).mockResolvedValue(
      eventoCreado as never
    );
  });

  it("desvincula solo las entidades del Evento ATP indicado", async () => {
    vi.mocked(repo.obtenerEntidadesExistentes).mockResolvedValue([
      fila("INCIDENTE", incidenteId, eventoAtpId),
      fila("EVENTO_PREVENCION", prevencionId, otroEventoAtpId),
    ]);

    const resultado = await desvincularEntidadesEventoAtpService(
      eventoAtpId,
      { incidenteIds: [incidenteId], eventoPrevencionIds: [prevencionId] } as never,
      usuario.id
    );

    expect(repo.desvincularEntidadesDelEvento).toHaveBeenCalledWith(
      expect.anything(),
      eventoAtpId,
      expect.objectContaining({
        incidenteIds: [incidenteId],
        eventoPrevencionIds: [prevencionId],
      })
    );
    expect(resultado.accion).toBe("DESVINCULADO");
    expect(resultado.entidades.incidentes).toHaveLength(1);
    expect(resultado.noDesvinculadas).toHaveLength(1);
    expect(resultado.noDesvinculadas[0].id).toBe(prevencionId);
    expect(socket.emitirEventoAtpVinculado).toHaveBeenCalledWith(resultado);
  });

  it("reporta entidades inexistentes en noEncontradas", async () => {
    vi.mocked(repo.obtenerEntidadesExistentes).mockResolvedValue([]);

    const resultado = await desvincularEntidadesEventoAtpService(
      eventoAtpId,
      { incidenteIds: [incidenteId] } as never,
      usuario.id
    );

    expect(resultado.noEncontradas).toEqual([
      { tipo: "INCIDENTE", id: incidenteId },
    ]);
    expect(resultado.entidades.incidentes).toHaveLength(0);
  });

  it("permite desvincular de un Evento ATP finalizado", async () => {
    vi.mocked(repo.buscarEventoAtpParaVinculacion).mockResolvedValue({
      ...eventoCreado,
      estado: "FINALIZADO",
    } as never);
    vi.mocked(repo.obtenerEntidadesExistentes).mockResolvedValue([
      fila("INCIDENTE", incidenteId, eventoAtpId),
    ]);

    const resultado = await desvincularEntidadesEventoAtpService(
      eventoAtpId,
      { incidenteIds: [incidenteId] } as never,
      usuario.id
    );

    expect(resultado.accion).toBe("DESVINCULADO");
  });

  it("lanza NotFoundError si el Evento ATP no existe", async () => {
    vi.mocked(repo.buscarEventoAtpParaVinculacion).mockResolvedValue(undefined);

    await expect(
      desvincularEntidadesEventoAtpService(
        eventoAtpId,
        { incidenteIds: [incidenteId] } as never,
        usuario.id
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
