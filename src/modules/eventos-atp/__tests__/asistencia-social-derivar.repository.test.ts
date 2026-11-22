/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { derivarIncidenteAAsistenciaSocialRepo } from "../asistencia-social.repository";
import { db } from "@/lib/db";

const mockTrx: any = {
  selectFrom: vi.fn(),
  leftJoin: vi.fn(),
  innerJoin: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  forUpdate: vi.fn(),
  updateTable: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  insertInto: vi.fn(),
  values: vi.fn(),
  executeTakeFirst: vi.fn(),
  executeTakeFirstOrThrow: vi.fn(),
  execute: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe("HU-25: asistencia-social.repository - derivarIncidenteAAsistenciaSocialRepo", () => {
  const incidenteId = "a1000000-0000-4000-8000-000000000006";
  const asistenteId = "00000000-0000-4000-8000-000000000019";
  const usuarioId = "00000000-0000-4000-8000-000000000003";
  const delegacionId = "30000000-0000-4000-8000-000000000002";
  const misionId = "d1000000-0000-4000-8000-000000000004";
  const eventoId = "70000000-0000-4000-8000-000000000050";

  const incidenteResueltoBase = {
    id: incidenteId,
    codigo: "INC-2026-0006",
    estado: "RESUELTO",
    prioridad: "ALTA",
    tipo_afectacion: "Inundación",
    descripcion: "Anegamiento de vivienda con daños en primer nivel.",
    direccion_texto: "Av. Pedro Montt 1100, Valdivia",
    latitud: -39.831,
    longitud: -73.238,
    requiere_asistencia_social: true,
    delegacion_id: delegacionId,
    aviso_id: null,
    evento_atp_id: null,
    asterisk_caller_phone: "+56988887777",
    informante_nombre: "Juan Pérez González",
    informante_telefono: "+56991112233",
    informante_rut: "12.345.678-5",
  };

  const eventoDetalleCompletoBase = {
    id: eventoId,
    codigo: "AS-2026-0005",
    descripcion: "Anegamiento de vivienda con daños en primer nivel.",
    tipo_afectacion: "Inundación",
    personas_afectadas: 4,
    familias_afectadas: 1,
    direccion_texto: "Av. Pedro Montt 1100, Valdivia",
    latitud: -39.831,
    longitud: -73.238,
    prioridad: "ALTA",
    estado: "ASIGNADO",
    contacto_nombre: "Ana Veas",
    contacto_telefono: "+56912345678",
    contacto_rut: "11.111.111-1",
    delegacion_id: delegacionId,
    delegacion_nombre: "Delegación Municipal Sur",
    incidente_id: incidenteId,
    incidente_codigo: "INC-2026-0006",
    asistente_social_id: asistenteId,
    asistente_social_nombre: "Claudia Rojas Vidal",
    detalles_evaluacion: null,
    creado_por_id: usuarioId,
    creado_por_nombre: "Encargado de Operaciones",
    creado_en: new Date("2026-11-21T20:00:00Z"),
    actualizado_en: new Date("2026-11-21T20:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrx.selectFrom.mockReturnValue(mockTrx);
    mockTrx.leftJoin.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.orderBy.mockReturnValue(mockTrx);
    mockTrx.limit.mockReturnValue(mockTrx);
    mockTrx.forUpdate.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockReturnValue(mockTrx);
    mockTrx.set.mockReturnValue(mockTrx);
    mockTrx.returning.mockReturnValue(mockTrx);
    mockTrx.insertInto.mockReturnValue(mockTrx);
    mockTrx.values.mockReturnValue(mockTrx);
    mockTrx.execute.mockResolvedValue([]);

    vi.mocked(db.transaction).mockReturnValue({
      execute: (cb: (trx: typeof mockTrx) => Promise<unknown>) => cb(mockTrx),
    } as any);
  });

  it("debe rechazar con INCIDENTE_NO_ENCONTRADO cuando el incidente no existe", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce(undefined);

    const res = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });

    expect(res).toEqual({
      ok: false,
      motivo: "INCIDENTE_NO_ENCONTRADO",
      detalle: expect.stringContaining("No se encontró"),
    });
  });

  it("debe rechazar con INCIDENTE_NO_RESUELTO cuando el incidente sigue en EN_ATENCION", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      ...incidenteResueltoBase,
      estado: "EN_ATENCION",
    });

    const res = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.motivo).toBe("INCIDENTE_NO_RESUELTO");
    }
  });

  it("debe rechazar con INCIDENTE_SIN_AFECTACION_SOCIAL cuando no tiene personas_afectadas > 0 ni requiere_asistencia_social", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      ...incidenteResueltoBase,
      requiere_asistencia_social: false,
    });
    mockTrx.execute.mockResolvedValueOnce([
      {
        id: "rep-01",
        mision_id: misionId,
        tipo_reporte: "REPORTE_CUADRILLA",
        version_reporte: 1,
        personas_afectadas: 0,
        requiere_asistencia_social: false,
        danos_estimados: null,
        detalles_evaluacion: null,
        creado_en: new Date("2026-11-21T19:00:00Z"),
      },
    ]);

    const res = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.motivo).toBe("INCIDENTE_SIN_AFECTACION_SOCIAL");
    }
  });

  it("debe rechazar con ASISTENTE_NO_ENCONTRADO / ASISTENTE_NO_ELEGIBLE si el profesional no existe, no tiene rol ASISTENTE_SOCIAL o no está disponible", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(incidenteResueltoBase)
      .mockResolvedValueOnce(undefined);
    mockTrx.execute.mockResolvedValueOnce([]);

    const noExiste = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });
    expect(noExiste).toMatchObject({ ok: false, motivo: "ASISTENTE_NO_ENCONTRADO" });

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(incidenteResueltoBase)
      .mockResolvedValueOnce({
        id: asistenteId,
        nombre: "Profesional",
        activo: true,
        estado_operativo: "descanso",
        rol_codigo: "ASISTENTE_SOCIAL",
      });
    mockTrx.execute.mockResolvedValueOnce([]);

    const noDisponible = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });
    expect(noDisponible).toMatchObject({ ok: false, motivo: "ASISTENTE_NO_ELEGIBLE" });
  });

  it("debe rechazar con EVENTO_EN_PROCESO_O_FINALIZADO si ya existe un evento en EN_EVALUACION_FIBE o FINALIZADO", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(incidenteResueltoBase)
      .mockResolvedValueOnce({
        id: asistenteId,
        nombre: "Claudia Rojas Vidal",
        activo: true,
        estado_operativo: "disponible",
        rol_codigo: "ASISTENTE_SOCIAL",
      })
      .mockResolvedValueOnce({
        id: eventoId,
        codigo: "AS-2026-0001",
        estado: "EN_EVALUACION_FIBE",
      });
    mockTrx.execute.mockResolvedValueOnce([]);

    const res = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });

    expect(res).toMatchObject({
      ok: false,
      motivo: "EVENTO_EN_PROCESO_O_FINALIZADO",
    });
  });

  it("debe crear un evento nuevo en estado ASIGNADO copiando contacto, dirección y familias del incidente y registrar hito DERIVACION_ASISTENCIA_SOCIAL", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        ...incidenteResueltoBase,
        requiere_asistencia_social: false,
      }) // incidente FOR UPDATE
      .mockResolvedValueOnce({
        id: asistenteId,
        nombre: "Claudia Rojas Vidal",
        activo: true,
        estado_operativo: "disponible",
        rol_codigo: "ASISTENTE_SOCIAL",
      }) // validarAsistenteSocialElegibleEnTrx
      .mockResolvedValueOnce(undefined) // evento_asistencia_social activo previo
      .mockResolvedValueOnce({ max_seq: 4 }) // generarSiguienteCodigoAsistenciaSocial
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0006",
        estado: "RESUELTO",
        prioridad: "ALTA",
        requiere_asistencia_social: true,
        actualizado_en: new Date("2026-11-21T20:00:00Z"),
      }) // UPDATE incidente
      .mockResolvedValueOnce(eventoDetalleCompletoBase); // SELECT detalle final

    mockTrx.execute
      .mockResolvedValueOnce([
        {
          id: "rep-cuad-1",
          mision_id: misionId,
          tipo_reporte: "REPORTE_CUADRILLA",
          version_reporte: 1,
          personas_afectadas: 4,
          requiere_asistencia_social: false,
          danos_estimados: "Anegamiento primer nivel",
          detalles_evaluacion: {
            familias: [
              {
                referencia: "Familia Veas",
                nucleoFamiliarTotal: 4,
                cantidadNinos: 1,
                cantidadAdultosMayores: 1,
                contactoNombre: "Ana Veas",
                contactoTelefono: "+56912345678",
                contactoRut: "11.111.111-1",
              },
            ],
          },
          creado_en: new Date("2026-11-21T19:00:00Z"),
        },
      ]) // SELECT reporte_terreno
      .mockResolvedValueOnce([
        {
          id: misionId,
          codigo: "MIS-2026-0004",
          tipo_mision: "ATENCION_CUADRILLA",
          estado: "COMPLETADA",
          fecha_cierre: new Date("2026-11-21T19:00:00Z"),
          creado_en: new Date("2026-11-21T18:00:00Z"),
        },
      ]); // SELECT mision

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ id: eventoId }) // INSERT evento_asistencia_social
      .mockResolvedValueOnce({
        id: "hito-001",
        mision_id: misionId,
        hito: "DERIVACION_ASISTENCIA_SOCIAL",
        descripcion:
          "Incidente INC-2026-0006 derivado a Asistencia Social (DGRD / FIBE) mediante evento AS-2026-0005, asignado a Claudia Rojas Vidal.",
        registrado_por_id: usuarioId,
        metadatos: { eventoAsistenciaSocialCodigo: "AS-2026-0005" },
        creado_en: new Date("2026-11-21T20:00:00Z"),
      }); // INSERT mision_hito

    const res = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
      observaciones: "Visita prioritaria DGRD.",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.accion).toBe("CREADO");
      expect(res.evento.estado).toBe("ASIGNADO");
      expect(res.evento.codigo).toBe("AS-2026-0005");
      expect(res.hito?.hito).toBe("DERIVACION_ASISTENCIA_SOCIAL");
      expect(res.incidente.requiere_asistencia_social).toBe(true);
    }

    expect(mockTrx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: "AS-2026-0005",
        estado: "ASIGNADO",
        incidente_id: incidenteId,
        asistente_social_id: asistenteId,
        personas_afectadas: 4,
        familias_afectadas: 1,
        contacto_nombre: "Ana Veas",
        contacto_telefono: "+56912345678",
        contacto_rut: "11.111.111-1",
      })
    );
    expect(mockTrx.insertInto).toHaveBeenCalledWith("mision_hito");
  });

  it("debe actualizar un evento existente en estado PENDIENTE o ASIGNADO y retornar accion = ACTUALIZADO (y hito: null si no hay misiones)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(incidenteResueltoBase) // incidente
      .mockResolvedValueOnce({
        id: asistenteId,
        nombre: "Claudia Rojas Vidal",
        activo: true,
        estado_operativo: "disponible",
        rol_codigo: "ASISTENTE_SOCIAL",
      }) // asistente
      .mockResolvedValueOnce({
        id: eventoId,
        codigo: "AS-2026-0001",
        estado: "PENDIENTE",
        personas_afectadas: 3,
        familias_afectadas: 1,
        contacto_nombre: "Juan Pérez González",
        contacto_telefono: "+56991112233",
        contacto_rut: "12.345.678-5",
        delegacion_id: delegacionId,
        evento_atp_id: null,
        detalles_evaluacion: null,
      }) // evento previo PENDIENTE
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0006",
        estado: "RESUELTO",
        prioridad: "ALTA",
        requiere_asistencia_social: true,
        actualizado_en: new Date("2026-11-21T20:10:00Z"),
      }) // UPDATE incidente
      .mockResolvedValueOnce({
        ...eventoDetalleCompletoBase,
        id: eventoId,
        codigo: "AS-2026-0001",
        contacto_nombre: "Juan Pérez González",
        contacto_telefono: "+56991112233",
      }); // SELECT detalle final

    mockTrx.execute
      .mockResolvedValueOnce([]) // SELECT reporte_terreno (sin reportes, habilitado por marca social del incidente)
      .mockResolvedValueOnce([]) // UPDATE evento_asistencia_social
      .mockResolvedValueOnce([]); // SELECT mision (sin misiones)

    const res = await derivarIncidenteAAsistenciaSocialRepo({
      incidenteId,
      asistenteSocialId: asistenteId,
      usuarioId,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.accion).toBe("ACTUALIZADO");
      expect(res.evento.codigo).toBe("AS-2026-0001");
      expect(res.hito).toBeNull();
    }
    expect(mockTrx.updateTable).toHaveBeenCalledWith("evento_asistencia_social");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
