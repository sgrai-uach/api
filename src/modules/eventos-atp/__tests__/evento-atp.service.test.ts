import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearEventoAtpService,
  listarEventosAtpService,
  obtenerEventoAtpDetalleService,
  MENSAJE_ACCESO_DENEGADO_EVENTO_ATP,
} from "../evento-atp.service";
import { seguridadService } from "@/modules/seguridad/service";
import { PERMISO_CREAR_EVENTO_ATP } from "@/modules/seguridad/permisos.constants";
import * as repository from "../evento-atp.repository";
import * as socket from "@/lib/socket";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/service", () => ({
  seguridadService: {
    validarAccesoRoles: vi.fn(),
  },
}));

vi.mock("../evento-atp.repository", () => ({
  insertarEventoAtpConDelegaciones: vi.fn(),
  listarEventosAtpPaginadosRepo: vi.fn(),
  obtenerEventoAtpPorId: vi.fn(),
  obtenerVinculosEventoAtp: vi.fn(),
  contarVinculosPorEventoAtp: vi.fn(),
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

    vi.mocked(seguridadService.validarAccesoRoles).mockResolvedValue(admin);
    vi.mocked(repository.insertarEventoAtpConDelegaciones).mockResolvedValue({
      evento: eventoGuardado,
      delegaciones: [delegacionGuardada],
    });
  });

  it("debe rechazar con ForbiddenError si el usuario no tiene acceso", async () => {
    vi.mocked(seguridadService.validarAccesoRoles).mockRejectedValueOnce(
      new ForbiddenError(MENSAJE_ACCESO_DENEGADO_EVENTO_ATP)
    );

    await expect(
      crearEventoAtpService(inputValido, "usuario-sin-permiso")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe validar el acceso con el permiso eventos_atp:crear y el mensaje institucional", async () => {
    await crearEventoAtpService(inputValido, admin.id);

    expect(seguridadService.validarAccesoRoles).toHaveBeenCalledWith(
      admin.id,
      [PERMISO_CREAR_EVENTO_ATP],
      "Acceso denegado. Se requiere el perfil de Administrador o el permiso eventos_atp:crear."
    );
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

  it("debe propagar el ConflictError cuando el repositorio detecta un código duplicado", async () => {
    vi.mocked(repository.insertarEventoAtpConDelegaciones).mockRejectedValueOnce(
      new ConflictError(
        "Ya existe un Evento ATP registrado con el código 'ATP-2026-0001'."
      )
    );

    await expect(
      crearEventoAtpService(
        { ...inputValido, codigo: "ATP-2026-0001" },
        admin.id
      )
    ).rejects.toThrow(ConflictError);

    expect(socket.emitirEventoAtpCreado).not.toHaveBeenCalled();
  });

  it("debe propagar el BadRequestError cuando existen delegaciones inexistentes o inactivas", async () => {
    vi.mocked(repository.insertarEventoAtpConDelegaciones).mockRejectedValueOnce(
      new BadRequestError(
        "Las siguientes delegaciones no existen en el sistema: 30000000-0000-4000-8000-000000000099."
      )
    );

    await expect(crearEventoAtpService(inputValido, admin.id)).rejects.toThrow(
      BadRequestError
    );

    expect(socket.emitirEventoAtpCreado).not.toHaveBeenCalled();
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

describe("evento-atp.service - Listado y detalle (H60)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seguridadService.validarAccesoRoles).mockResolvedValue(admin);
  });

  it("lista Eventos ATP usando un conteo agrupado y sin N+1", async () => {
    vi.mocked(repository.listarEventosAtpPaginadosRepo).mockResolvedValueOnce({
      eventos: [eventoGuardado],
      delegaciones: new Map([
        [eventoGuardado.id, [delegacionGuardada]],
      ]),
      total: 1,
    });
    vi.mocked(repository.contarVinculosPorEventoAtp).mockResolvedValueOnce(
      new Map([[eventoGuardado.id, 3]])
    );

    const resultado = await listarEventosAtpService(
      { page: 1, limit: 10 },
      admin.id
    );

    expect(repository.contarVinculosPorEventoAtp).toHaveBeenCalledWith([
      eventoGuardado.id,
    ]);
    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0].totalVinculados).toBe(3);
    expect(resultado.data[0].delegaciones).toEqual([delegacionGuardada]);
  });

  it("obtiene el detalle con sus vínculos y el total consolidado", async () => {
    vi.mocked(repository.obtenerEventoAtpPorId).mockResolvedValueOnce({
      evento: eventoGuardado,
      delegaciones: [delegacionGuardada],
    });
    vi.mocked(repository.obtenerVinculosEventoAtp).mockResolvedValueOnce({
      incidentes: [
        {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0001",
          nombre: "Inundación",
          estado: "REPORTADO",
          creadoEn: "2026-05-01T10:00:00.000Z",
        },
      ],
      eventosPrevencion: [],
      recuperaciones: [],
      eventosAsistenciaSocial: [],
    });

    const resultado = await obtenerEventoAtpDetalleService(
      eventoGuardado.id,
      admin.id
    );

    expect(resultado.totalVinculados).toBe(1);
    expect(resultado.vinculos.incidentes).toHaveLength(1);
    expect(seguridadService.validarAccesoRoles).toHaveBeenCalledWith(
      admin.id,
      expect.any(Array),
      expect.stringContaining("eventos_atp:vincular")
    );
  });

  it("lanza NotFoundError si el Evento ATP no existe", async () => {
    vi.mocked(repository.obtenerEventoAtpPorId).mockResolvedValueOnce(null);

    await expect(
      obtenerEventoAtpDetalleService(eventoGuardado.id, admin.id)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
