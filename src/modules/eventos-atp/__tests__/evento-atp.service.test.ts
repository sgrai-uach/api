import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearEventoAtpService } from "../evento-atp.service";
import { seguridadService } from "@/modules/seguridad/service";
import * as repository from "../evento-atp.repository";
import * as socket from "@/lib/socket";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/service", () => ({
  seguridadService: {
    validarAccesoAdministrador: vi.fn(),
  },
}));

vi.mock("../evento-atp.repository", () => ({
  existeCodigoEventoAtp: vi.fn(),
  verificarDelegacionesExisten: vi.fn(),
  insertarEventoAtpConDelegaciones: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  emitirEventoAtpCreado: vi.fn(),
}));

const admin = {
  id: "00000000-0000-4000-8000-000000000001",
  rut: "11111111-1",
  nombre: "Administrador General",
  email: "admin@valdivia.cl",
  rolId: "20000000-0000-4000-8000-000000000001",
  rolNombre: "Administrador",
  activo: true,
};

const inputValido = {
  nombre: "Sistema Frontal Mayo 2026",
  descripcion:
    "Sistema frontal con precipitaciones intensas y vientos moderados a fuertes durante 48 horas.",
  tipoAmenaza: "METEOROLOGICA" as const,
  nivelAlerta: "AMARILLA" as const,
  fechaInicio: "2026-05-01T10:00",
  fechaTermino: "2026-05-03T18:00",
  delegacionIds: ["30000000-0000-4000-8000-000000000001"],
};

const eventoGuardado: repository.FilaEventoAtp = {
  id: "50000000-0000-4000-8000-000000000001",
  codigo: "ATP-2026-0001",
  nombre: inputValido.nombre,
  descripcion: inputValido.descripcion,
  tipo_amenaza: inputValido.tipoAmenaza,
  nivel_alerta: inputValido.nivelAlerta,
  fecha_inicio: new Date("2026-05-01T10:00:00.000Z"),
  fecha_termino: new Date("2026-05-03T18:00:00.000Z"),
  estado: "ACTIVO",
  creado_por_id: admin.id,
  creado_en: new Date("2026-05-01T09:55:00.000Z"),
  actualizado_en: new Date("2026-05-01T09:55:00.000Z"),
};

const delegacionGuardada: repository.FilaDelegacionEventoAtp = {
  id: "30000000-0000-4000-8000-000000000001",
  codigo: "DEL_NORTE",
  nombre: "Delegación Municipal Norte",
};

describe("evento-atp.service - Creación y RBAC (H61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(seguridadService.validarAccesoAdministrador).mockResolvedValue(
      admin
    );
    vi.mocked(repository.existeCodigoEventoAtp).mockResolvedValue(false);
    vi.mocked(repository.verificarDelegacionesExisten).mockResolvedValue({
      existentes: inputValido.delegacionIds,
      faltantes: [],
    });
    vi.mocked(repository.insertarEventoAtpConDelegaciones).mockResolvedValue({
      evento: eventoGuardado,
      delegaciones: [delegacionGuardada],
    });
  });

  it("debe rechazar con ForbiddenError si el usuario no tiene acceso", async () => {
    vi.mocked(seguridadService.validarAccesoAdministrador).mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado")
    );

    await expect(
      crearEventoAtpService(inputValido, "usuario-sin-permiso")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe crear el Evento ATP, mapear la respuesta y emitir el WebSocket", async () => {
    const resultado = await crearEventoAtpService(inputValido, admin.id);

    expect(resultado).toMatchObject({
      id: eventoGuardado.id,
      codigo: "ATP-2026-0001",
      estado: "ACTIVO",
      tipoAmenaza: "METEOROLOGICA",
      nivelAlerta: "AMARILLA",
    });
    expect(resultado.delegaciones).toEqual([delegacionGuardada]);
    expect(
      repository.insertarEventoAtpConDelegaciones
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: undefined,
        delegacionIds: inputValido.delegacionIds,
        creadoPorId: admin.id,
      })
    );
    expect(socket.emitirEventoAtpCreado).toHaveBeenCalledWith(resultado);
  });

  it("debe normalizar el código manual a mayúsculas", async () => {
    await crearEventoAtpService(
      { ...inputValido, codigo: "atp-2026-0099" },
      admin.id
    );

    expect(
      repository.insertarEventoAtpConDelegaciones
    ).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: "ATP-2026-0099" })
    );
  });

  it("debe rechazar con ConflictError un código manual duplicado", async () => {
    vi.mocked(repository.existeCodigoEventoAtp).mockResolvedValueOnce(true);

    await expect(
      crearEventoAtpService(
        { ...inputValido, codigo: "ATP-2026-0001" },
        admin.id
      )
    ).rejects.toThrow(ConflictError);

    expect(
      repository.insertarEventoAtpConDelegaciones
    ).not.toHaveBeenCalled();
  });

  it("debe rechazar con BadRequestError delegaciones inexistentes", async () => {
    vi.mocked(repository.verificarDelegacionesExisten).mockResolvedValueOnce({
      existentes: [],
      faltantes: ["30000000-0000-4000-8000-000000000099"],
    });

    await expect(
      crearEventoAtpService(inputValido, admin.id)
    ).rejects.toThrow(BadRequestError);

    expect(
      repository.insertarEventoAtpConDelegaciones
    ).not.toHaveBeenCalled();
  });

  it("debe permitir alcance comunal sin delegaciones", async () => {
    vi.mocked(repository.insertarEventoAtpConDelegaciones).mockResolvedValueOnce(
      { evento: eventoGuardado, delegaciones: [] }
    );

    const resultado = await crearEventoAtpService(
      { ...inputValido, delegacionIds: [] },
      admin.id
    );

    expect(resultado.delegaciones).toEqual([]);
    expect(
      repository.insertarEventoAtpConDelegaciones
    ).toHaveBeenCalledWith(expect.objectContaining({ delegacionIds: [] }));
  });
});
