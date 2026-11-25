import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegistrarFichaFibeInputSchema } from "../asistencia-social.schema";

const mockVerificarPermiso = vi.fn();
const mockRegistrarFichaFibeRepo = vi.fn();
const mockEmitirAsistenciaSocialActualizada = vi.fn();

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: (...args: unknown[]) => mockVerificarPermiso(...args),
}));

vi.mock("../asistencia-social.repository", () => ({
  generarSiguienteCodigoAsistenciaSocial: vi.fn(),
  insertarEventoAsistenciaSocial: vi.fn(),
  listarEventosAsistenciaSocialPaginados: vi.fn(),
  contarEventosAsistenciaSocial: vi.fn(),
  asignarAsistenteSocialEventoRepo: vi.fn(),
  derivarIncidenteAAsistenciaSocialRepo: vi.fn(),
  registrarFichaFibeRepo: (...args: unknown[]) => mockRegistrarFichaFibeRepo(...args),
  AsistenteSocialRepoError: class extends Error {
    constructor(public motivo: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("@/lib/socket", () => ({
  emitirAsistenciaSocialCreada: vi.fn(),
  emitirAsistenciaSocialActualizada: (...args: unknown[]) =>
    mockEmitirAsistenciaSocialActualizada(...args),
  notificarIncidenteActualizado: vi.fn(),
}));

import {
  registrarFichaFibeService,
  EventoAsistenciaSocialNotFoundError,
  EstadoEventoAsistenciaSocialInvalidoError,
  FolioFibeDuplicadoError,
} from "../asistencia-social.service";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";
import { PERMISO_GESTIONAR_FIBE } from "@/modules/seguridad/permisos.constants";

const EVENTO_ID = "70000000-0000-4000-8000-000000000001";
const USUARIO_ID = "00000000-0000-4000-8000-000000000019";

function crearFilaEventoMock(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENTO_ID,
    codigo: "AS-2026-0001",
    descripcion: "Familia damnificada por anegamiento.",
    tipo_afectacion: "VIVIENDA_ANEGADA",
    personas_afectadas: 4,
    familias_afectadas: 1,
    direccion_texto: "Calle Los Alerces 1420",
    latitud: -39.8234,
    longitud: -73.2189,
    prioridad: "ALTA",
    estado: "EN_EVALUACION_FIBE",
    contacto_nombre: "María González",
    contacto_telefono: "+56912345678",
    contacto_rut: "12.345.678-9",
    delegacion_id: "30000000-0000-4000-8000-000000000001",
    delegacion_nombre: "Delegación Costa",
    incidente_id: null,
    incidente_codigo: null,
    asistente_social_id: USUARIO_ID,
    asistente_social_nombre: "Claudia Rojas",
    detalles_evaluacion: null,
    folio_fibe: "FIBE-2026-0001",
    nivel_dano_vivienda: "MODERADO",
    observaciones_fibe: "Requiere apoyo de enseres",
    fibe_registrada_en: new Date("2026-11-24T15:00:00.000Z"),
    fibe_registrada_por_id: USUARIO_ID,
    creado_por_id: "00000000-0000-4000-8000-000000000003",
    creado_por_nombre: "Encargado",
    creado_en: new Date("2026-11-24T12:00:00.000Z"),
    actualizado_en: new Date("2026-11-24T15:00:00.000Z"),
    ...overrides,
  };
}

describe("HU-71 - Registro de Ficha FIBE (Schema y Servicio)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RegistrarFichaFibeInputSchema", () => {
    it("valida correctamente un payload completo y normaliza folioFibe a mayúsculas", () => {
      const parsed = RegistrarFichaFibeInputSchema.parse({
        folioFibe: " fibe-2026-0042 ",
        personasAfectadas: 5,
        nivelDanoVivienda: "GRAVE_INHABITABLE",
        observacionesSociales: "Familia con adulto mayor.",
      });

      expect(parsed).toEqual({
        folioFibe: "FIBE-2026-0042",
        personasAfectadas: 5,
        nivelDanoVivienda: "GRAVE_INHABITABLE",
        observacionesSociales: "Familia con adulto mayor.",
      });
    });

    it("permite omitir personasAfectadas, nivelDanoVivienda y observacionesSociales para reutilizar valores del evento", () => {
      const parsed = RegistrarFichaFibeInputSchema.parse({
        folioFibe: "ABC123",
      });

      expect(parsed.folioFibe).toBe("ABC123");
      expect(parsed.personasAfectadas).toBeUndefined();
      expect(parsed.nivelDanoVivienda).toBeUndefined();
    });

    it("rechaza folioFibe vacío o con caracteres no alfanuméricos", () => {
      expect(() =>
        RegistrarFichaFibeInputSchema.parse({ folioFibe: "   " })
      ).toThrow();
      expect(() =>
        RegistrarFichaFibeInputSchema.parse({ folioFibe: "FIBE 2026!" })
      ).toThrow();
    });

    it("rechaza nivelDanoVivienda fuera del catálogo o personasAfectadas negativas", () => {
      expect(() =>
        RegistrarFichaFibeInputSchema.parse({
          folioFibe: "FIBE-1",
          nivelDanoVivienda: "INEXISTENTE",
        })
      ).toThrow();

      expect(() =>
        RegistrarFichaFibeInputSchema.parse({
          folioFibe: "FIBE-1",
          personasAfectadas: -1,
        })
      ).toThrow();
    });
  });

  describe("registrarFichaFibeService", () => {
    it("exige permiso asistencia_social:fibe:gestionar", async () => {
      mockVerificarPermiso.mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado")
      );

      await expect(
        registrarFichaFibeService(
          EVENTO_ID,
          { folioFibe: "FIBE-2026-0001" },
          USUARIO_ID
        )
      ).rejects.toThrow(ForbiddenError);

      expect(mockVerificarPermiso).toHaveBeenCalledWith(
        USUARIO_ID,
        PERMISO_GESTIONAR_FIBE
      );
      expect(mockRegistrarFichaFibeRepo).not.toHaveBeenCalled();
    });

    it("lanza FolioFibeDuplicadoError cuando el folio ya existe en otro expediente", async () => {
      mockVerificarPermiso.mockResolvedValueOnce({ id: USUARIO_ID });
      mockRegistrarFichaFibeRepo.mockResolvedValueOnce({
        ok: false,
        motivo: "FOLIO_DUPLICADO",
        detalle: "El folio FIBE FIBE-2026-0001 ya existe.",
      });

      await expect(
        registrarFichaFibeService(
          EVENTO_ID,
          { folioFibe: "FIBE-2026-0001" },
          USUARIO_ID
        )
      ).rejects.toThrow(FolioFibeDuplicadoError);
    });

    it("lanza EstadoEventoAsistenciaSocialInvalidoError cuando el evento está en estado PENDIENTE o FINALIZADO", async () => {
      mockVerificarPermiso.mockResolvedValueOnce({ id: USUARIO_ID });
      mockRegistrarFichaFibeRepo.mockResolvedValueOnce({
        ok: false,
        motivo: "ESTADO_INVALIDO",
        detalle: "Estado inválido",
      });

      await expect(
        registrarFichaFibeService(
          EVENTO_ID,
          { folioFibe: "FIBE-2026-0001" },
          USUARIO_ID
        )
      ).rejects.toThrow(EstadoEventoAsistenciaSocialInvalidoError);
    });

    it("lanza EventoAsistenciaSocialNotFoundError cuando el evento no existe", async () => {
      mockVerificarPermiso.mockResolvedValueOnce({ id: USUARIO_ID });
      mockRegistrarFichaFibeRepo.mockResolvedValueOnce({
        ok: false,
        motivo: "EVENTO_NO_ENCONTRADO",
        detalle: "No existe",
      });

      await expect(
        registrarFichaFibeService(
          EVENTO_ID,
          { folioFibe: "FIBE-2026-0001" },
          USUARIO_ID
        )
      ).rejects.toThrow(EventoAsistenciaSocialNotFoundError);
    });

    it("persiste la Ficha FIBE, retorna DTO actualizado y emite asistencia_social:actualizada", async () => {
      mockVerificarPermiso.mockResolvedValueOnce({ id: USUARIO_ID });
      mockRegistrarFichaFibeRepo.mockResolvedValueOnce({
        ok: true,
        evento: crearFilaEventoMock(),
      });

      const res = await registrarFichaFibeService(
        EVENTO_ID,
        {
          folioFibe: "fibe-2026-0001",
          personasAfectadas: 4,
          nivelDanoVivienda: "MODERADO",
          observacionesSociales: "Requiere apoyo de enseres",
        },
        USUARIO_ID
      );

      expect(res.estado).toBe("EN_EVALUACION_FIBE");
      expect(res.folioFibe).toBe("FIBE-2026-0001");
      expect(res.nivelDanoVivienda).toBe("MODERADO");
      expect(res.observacionesFibe).toBe("Requiere apoyo de enseres");
      expect(mockEmitirAsistenciaSocialActualizada).toHaveBeenCalledWith(res);
    });
  });
});
