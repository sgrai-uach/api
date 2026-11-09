import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrx = {
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  insertInto: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  where: vi.fn(),
  select: vi.fn(),
  selectAll: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
  returningAll: vi.fn(),
  orderBy: vi.fn(),
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  executeTakeFirstOrThrow: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    selectFrom: (...args: unknown[]) => mockTrx.selectFrom(...args),
    updateTable: (...args: unknown[]) => mockTrx.updateTable(...args),
    insertInto: (...args: unknown[]) => mockTrx.insertInto(...args),
    transaction: () => ({
      execute: (cb: (trx: typeof mockTrx) => unknown) => cb(mockTrx),
    }),
  },
}));

import {
  crearNotificacionMisionRepo,
  marcarNotificacionEnviadaRepo,
  actualizarEstadoNotificacionIdempotenteRepo,
  listarMisionesPendientesTerrenoRepo,
  obtenerPatrullaDeUsuarioRepo,
} from "../notificacion-mision.repository";
import { NotFoundError, ForbiddenError } from "@/modules/seguridad/errors";

describe("Notificacion Mision Repository (HU-35)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTrx.selectFrom.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockReturnValue(mockTrx);
    mockTrx.insertInto.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.leftJoin.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.selectAll.mockReturnValue(mockTrx);
    mockTrx.set.mockReturnValue(mockTrx);
    mockTrx.values.mockReturnValue(mockTrx);
    mockTrx.returningAll.mockReturnValue(mockTrx);
    mockTrx.orderBy.mockReturnValue(mockTrx);
  });

  describe("crearNotificacionMisionRepo", () => {
    it("debe insertar en notificaciones_mision con estado inicial PENDIENTE_ENVIO", async () => {
      const mockResult = {
        id: "70000000-0000-4000-8000-000000000001",
        mision_id: "60000000-0000-4000-8000-000000000001",
        patrulla_id: "f1000000-0000-4000-8000-000000000001",
        estado: "PENDIENTE_ENVIO",
        intentos_envio: 0,
        creada_at: new Date("2026-11-09T17:00:00Z"),
        enviada_at: null,
        recibida_at: null,
        leida_at: null,
      };

      mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce(mockResult);

      const res = await crearNotificacionMisionRepo(
        mockResult.mision_id,
        mockResult.patrulla_id,
        mockTrx
      );

      expect(mockTrx.insertInto).toHaveBeenCalledWith("notificaciones_mision");
      expect(mockTrx.values).toHaveBeenCalledWith(
        expect.objectContaining({
          mision_id: mockResult.mision_id,
          patrulla_id: mockResult.patrulla_id,
          estado: "PENDIENTE_ENVIO",
          intentos_envio: 0,
        })
      );
      expect(res.estado).toBe("PENDIENTE_ENVIO");
      expect(res.intentosEnvio).toBe(0);
    });
  });

  describe("marcarNotificacionEnviadaRepo", () => {
    it("debe actualizar el estado a ENVIADA e incrementar intentos_envio", async () => {
      const mockResult = {
        id: "70000000-0000-4000-8000-000000000001",
        mision_id: "60000000-0000-4000-8000-000000000001",
        patrulla_id: "f1000000-0000-4000-8000-000000000001",
        estado: "ENVIADA",
        intentos_envio: 1,
        creada_at: new Date("2026-11-09T17:00:00Z"),
        enviada_at: new Date("2026-11-09T17:00:01Z"),
        recibida_at: null,
        leida_at: null,
      };

      mockTrx.executeTakeFirst.mockResolvedValueOnce(mockResult);

      const res = await marcarNotificacionEnviadaRepo(mockResult.id, mockTrx);

      expect(mockTrx.updateTable).toHaveBeenCalledWith("notificaciones_mision");
      expect(res?.estado).toBe("ENVIADA");
      expect(res?.intentosEnvio).toBe(1);
    });
  });

  describe("actualizarEstadoNotificacionIdempotenteRepo", () => {
    const notificacionBase = {
      id: "70000000-0000-4000-8000-000000000001",
      mision_id: "60000000-0000-4000-8000-000000000001",
      patrulla_id: "f1000000-0000-4000-8000-000000000001",
      estado: "ENVIADA",
      intentos_envio: 1,
      creada_at: new Date("2026-11-09T17:00:00Z"),
      enviada_at: new Date("2026-11-09T17:00:01Z"),
      recibida_at: null,
      leida_at: null,
    };

    it("debe lanzar NotFoundError si la notificación no existe", async () => {
      mockTrx.executeTakeFirst.mockResolvedValueOnce(null);

      await expect(
        actualizarEstadoNotificacionIdempotenteRepo(
          "70000000-0000-4000-8000-000000000099",
          "RECIBIDA",
          "user-1",
          true
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar ForbiddenError si el usuario no es líder ni integrante de la patrulla", async () => {
      mockTrx.executeTakeFirst
        .mockResolvedValueOnce(notificacionBase) // 1. notificacion
        .mockResolvedValueOnce({ id: notificacionBase.patrulla_id, usuario_lider_id: "otro-lider" }) // 2. patrulla
        .mockResolvedValueOnce(null); // 3. integrante en patrulla_personal

      await expect(
        actualizarEstadoNotificacionIdempotenteRepo(
          notificacionBase.id,
          "RECIBIDA",
          "usuario-ajeno",
          false
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe transicionar a RECIBIDA si el usuario es líder de la patrulla", async () => {
      const fechaRecibida = new Date("2026-11-09T17:00:05Z");
      mockTrx.executeTakeFirst
        .mockResolvedValueOnce(notificacionBase)
        .mockResolvedValueOnce({ id: notificacionBase.patrulla_id, usuario_lider_id: "lider-1" });

      mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
        ...notificacionBase,
        estado: "RECIBIDA",
        recibida_at: fechaRecibida,
      });

      const res = await actualizarEstadoNotificacionIdempotenteRepo(
        notificacionBase.id,
        "RECIBIDA",
        "lider-1",
        false
      );

      expect(res.estado).toBe("RECIBIDA");
      expect(res.recibidaAt).toBe(fechaRecibida.toISOString());
    });

    it("debe ser idempotente y no modificar timestamps si ya se encuentra en RECIBIDA", async () => {
      const yaRecibida = {
        ...notificacionBase,
        estado: "RECIBIDA",
        recibida_at: new Date("2026-11-09T17:00:05Z"),
      };

      mockTrx.executeTakeFirst
        .mockResolvedValueOnce(yaRecibida)
        .mockResolvedValueOnce({ id: yaRecibida.patrulla_id, usuario_lider_id: "lider-1" });

      const res = await actualizarEstadoNotificacionIdempotenteRepo(
        yaRecibida.id,
        "RECIBIDA",
        "lider-1",
        false
      );

      // No debe ejecutar updateTable
      expect(mockTrx.updateTable).not.toHaveBeenCalled();
      expect(res.estado).toBe("RECIBIDA");
      expect(res.recibidaAt).toBe(yaRecibida.recibida_at.toISOString());
    });

    it("debe impedir retroceso de LEIDA a RECIBIDA manteniendo LEIDA intacto", async () => {
      const yaLeida = {
        ...notificacionBase,
        estado: "LEIDA",
        recibida_at: new Date("2026-11-09T17:00:05Z"),
        leida_at: new Date("2026-11-09T17:00:15Z"),
      };

      mockTrx.executeTakeFirst
        .mockResolvedValueOnce(yaLeida)
        .mockResolvedValueOnce({ id: yaLeida.patrulla_id, usuario_lider_id: "lider-1" });

      const res = await actualizarEstadoNotificacionIdempotenteRepo(
        yaLeida.id,
        "RECIBIDA",
        "lider-1",
        false
      );

      expect(mockTrx.updateTable).not.toHaveBeenCalled();
      expect(res.estado).toBe("LEIDA");
      expect(res.leidaAt).toBe(yaLeida.leida_at.toISOString());
    });
  });

  describe("listarMisionesPendientesTerrenoRepo", () => {
    it("debe consultar notificaciones en PENDIENTE_ENVIO o ENVIADA para la patrulla", async () => {
      const filaMock = {
        notificacion_id: "70000000-0000-4000-8000-000000000001",
        notificacion_estado: "PENDIENTE_ENVIO",
        patrulla_id: "f1000000-0000-4000-8000-000000000001",
        creada_at: new Date("2026-11-09T17:00:00Z"),
        enviada_at: null,
        mision_id: "60000000-0000-4000-8000-000000000001",
        mision_codigo: "MIS-2026-0001",
        mision_titulo: "Verificación de Aniego",
        mision_descripcion: null,
        tipo_mision: "VERIFICACION",
        mision_prioridad: "ALTA",
        mision_estado: "DESPACHADA",
        incidente_id: "50000000-0000-4000-8000-000000000001",
        incidente_codigo: "INC-2026-8869",
        incidente_folio: "FOL-8869",
        incidente_tipo_afectacion: "Anegamiento",
        incidente_direccion: "Calle Errázuriz 400",
        incidente_latitud: "-39.8150000",
        incidente_longitud: "-73.2420000",
      };

      mockTrx.execute.mockResolvedValueOnce([filaMock]);

      const res = await listarMisionesPendientesTerrenoRepo("f1000000-0000-4000-8000-000000000001");

      expect(res).toHaveLength(1);
      expect(res[0].codigoMision).toBe("MIS-2026-0001");
      expect(res[0].latitud).toBe(-39.815);
      expect(res[0].longitud).toBe(-73.242);
      expect(res[0].estadoNotificacion).toBe("PENDIENTE_ENVIO");
    });
  });

  describe("obtenerPatrullaDeUsuarioRepo", () => {
    it("debe retornar la patrulla cuando el usuario es líder directo", async () => {
      mockTrx.executeTakeFirst.mockResolvedValueOnce({
        id: "f1000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Norte 1",
      });

      const res = await obtenerPatrullaDeUsuarioRepo("user-lider");
      expect(res?.nombre).toBe("Patrulla Norte 1");
    });

    it("debe retornar la patrulla cuando el usuario es integrante en patrulla_personal", async () => {
      mockTrx.executeTakeFirst
        .mockResolvedValueOnce(null) // no es líder
        .mockResolvedValueOnce({
          id: "f1000000-0000-4000-8000-000000000002",
          nombre: "Patrulla Sur 2",
        }); // es integrante

      const res = await obtenerPatrullaDeUsuarioRepo("user-integrante");
      expect(res?.nombre).toBe("Patrulla Sur 2");
    });
  });
});
