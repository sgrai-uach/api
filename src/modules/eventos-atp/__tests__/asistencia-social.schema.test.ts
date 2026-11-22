import { describe, it, expect } from "vitest";
import {
  CrearEventoAsistenciaSocialInputSchema,
  ListarEventosAsistenciaSocialQuerySchema,
  DerivarAsistenciaSocialIncidenteInputSchema,
  DerivarAsistenciaSocialIncidenteResponseSchema,
} from "../asistencia-social.schema";

describe("asistencia-social.schema - Validaciones Zod (H28)", () => {
  const payloadValido = {
    descripcion: "Familia requiere levantamiento de FIBE de urgencia tras desborde menor.",
    tipoAfectacion: "VIVIENDA_ANEGADA",
    direccionTexto: "Calle Los Alerces 1420, Sector Collico",
    latitud: -39.8234,
    longitud: -73.2189,
    personasAfectadas: 4,
    familiasAfectadas: 1,
    prioridad: "ALTA",
    contactoNombre: "María González",
    contactoTelefono: "+56912345678",
    contactoRut: "12.345.678-9",
    delegacionId: "30000000-0000-4000-8000-000000000001",
  };

  it("debe validar exitosamente un payload completo y correcto", () => {
    const parsed = CrearEventoAsistenciaSocialInputSchema.safeParse(payloadValido);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.descripcion).toBe(payloadValido.descripcion);
      expect(parsed.data.personasAfectadas).toBe(4);
      expect(parsed.data.familiasAfectadas).toBe(1);
      expect(parsed.data.incidenteId).toBeUndefined();
    }
  });

  it("debe permitir la creación de un evento huérfano de incidente (sin incidenteId)", () => {
    const payloadSinIncidente = {
      ...payloadValido,
      incidenteId: null,
    };
    const parsed = CrearEventoAsistenciaSocialInputSchema.safeParse(payloadSinIncidente);
    expect(parsed.success).toBe(true);
  });

  it("debe asignar valores por defecto para prioridad ('MEDIA'), personasAfectadas (0) y familiasAfectadas (0)", () => {
    const payloadMinimo = {
      descripcion: "Caso excepcional de vivienda aislada sin incidente mayor.",
      tipoAfectacion: "AISLAMIENTO_ADULTO_MAYOR",
      direccionTexto: "Camino Curiñanco Km 12",
      latitud: -39.75,
      longitud: -73.35,
    };

    const parsed = CrearEventoAsistenciaSocialInputSchema.safeParse(payloadMinimo);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.prioridad).toBe("MEDIA");
      expect(parsed.data.personasAfectadas).toBe(0);
      expect(parsed.data.familiasAfectadas).toBe(0);
    }
  });

  it("debe fallar si la descripción está vacía o tiene menos de 5 caracteres", () => {
    const payloadInvalido = {
      ...payloadValido,
      descripcion: "   ",
    };
    const parsed = CrearEventoAsistenciaSocialInputSchema.safeParse(payloadInvalido);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("descripcion"))).toBe(true);
    }
  });

  it("debe fallar si la dirección está vacía", () => {
    const payloadInvalido = {
      ...payloadValido,
      direccionTexto: " ",
    };
    const parsed = CrearEventoAsistenciaSocialInputSchema.safeParse(payloadInvalido);
    expect(parsed.success).toBe(false);
  });

  it("debe fallar si las coordenadas geográficas son inválidas o están fuera de rango", () => {
    const latInvalida = {
      ...payloadValido,
      latitud: 95, // Fuera de [-90, 90]
    };
    expect(CrearEventoAsistenciaSocialInputSchema.safeParse(latInvalida).success).toBe(false);

    const lngInvalida = {
      ...payloadValido,
      longitud: -200, // Fuera de [-180, 180]
    };
    expect(CrearEventoAsistenciaSocialInputSchema.safeParse(lngInvalida).success).toBe(false);
  });

  it("debe validar correctamente los query params de listado", () => {
    const query = {
      pagina: "2",
      limite: "25",
      estado: "PENDIENTE",
      prioridad: "CRITICA",
      busqueda: "Collico",
    };
    const parsed = ListarEventosAsistenciaSocialQuerySchema.safeParse(query);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pagina).toBe(2);
      expect(parsed.data.limite).toBe(25);
      expect(parsed.data.estado).toBe("PENDIENTE");
      expect(parsed.data.prioridad).toBe("CRITICA");
    }
  });

  it("debe validar detallesEvaluacion con desglose por familia y campos demográficos homologados H38/H39", () => {
    const payloadConFamilias = {
      ...payloadValido,
      personasAfectadas: 5,
      familiasAfectadas: 1,
      detallesEvaluacion: {
        nivelCompromisoVivienda: "MODERADO",
        danosEstimados: "Ingreso de agua en dormitorio y comedor",
        familias: [
          {
            referencia: "Familia González",
            nucleoFamiliarTotal: 5,
            cantidadNinos: 2,
            cantidadAdultosMayores: 0,
            personasDiscapacitadas: 1,
            personasElectrodependientes: 0,
            mascotasAfectadas: 0,
            nivelCompromisoVivienda: "MODERADO",
          },
        ],
      },
    };

    const parsed = CrearEventoAsistenciaSocialInputSchema.safeParse(payloadConFamilias);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.detallesEvaluacion?.familias).toHaveLength(1);
      expect(parsed.data.detallesEvaluacion?.familias?.[0].nucleoFamiliarTotal).toBe(5);
      expect(parsed.data.detallesEvaluacion?.familias?.[0].cantidadNinos).toBe(2);
      expect(parsed.data.detallesEvaluacion?.familias?.[0].personasDiscapacitadas).toBe(1);
    }
  });

  it("debe rechazar detallesEvaluacion si niños + adultos mayores, discapacidad o electrodependientes superan nucleoFamiliarTotal", () => {
    const payloadNinosExceden = {
      ...payloadValido,
      detallesEvaluacion: {
        familias: [
          {
            nucleoFamiliarTotal: 5,
            cantidadNinos: 6,
          },
        ],
      },
    };
    expect(CrearEventoAsistenciaSocialInputSchema.safeParse(payloadNinosExceden).success).toBe(false);

    const payloadDiscapExcede = {
      ...payloadValido,
      detallesEvaluacion: {
        familias: [
          {
            nucleoFamiliarTotal: 5,
            personasDiscapacitadas: 10,
          },
        ],
      },
    };
    expect(CrearEventoAsistenciaSocialInputSchema.safeParse(payloadDiscapExcede).success).toBe(false);

    const payloadElectroExcede = {
      ...payloadValido,
      detallesEvaluacion: {
        familias: [
          {
            nucleoFamiliarTotal: 5,
            personasElectrodependientes: 6,
          },
        ],
      },
    };
    expect(CrearEventoAsistenciaSocialInputSchema.safeParse(payloadElectroExcede).success).toBe(false);
  });

  it("debe aceptar contacto preliminar por familia (contactoNombre, contactoTelefono, contactoRut válido) y rechazar RUT inválido", () => {
    const valido = CrearEventoAsistenciaSocialInputSchema.safeParse({
      ...payloadValido,
      detallesEvaluacion: {
        familias: [
          {
            referencia: "Familia Veas",
            nucleoFamiliarTotal: 5,
            cantidadNinos: 2,
            personasDiscapacitadas: 1,
            contactoNombre: "Ana Veas",
            contactoTelefono: "+56912345678",
            contactoRut: "11.111.111-1",
          },
        ],
      },
    });
    expect(valido.success).toBe(true);

    const rutInvalido = CrearEventoAsistenciaSocialInputSchema.safeParse({
      ...payloadValido,
      detallesEvaluacion: {
        familias: [
          {
            nucleoFamiliarTotal: 5,
            contactoRut: "11.111.111-9",
          },
        ],
      },
    });
    expect(rutInvalido.success).toBe(false);
  });

  it("debe aceptar asistenteSocialId UUID opcional válido al crear evento (Opción A H31) y rechazar UUID inválido", () => {
    const valido = CrearEventoAsistenciaSocialInputSchema.safeParse({
      ...payloadValido,
      asistenteSocialId: "00000000-0000-4000-8000-000000000006",
    });
    expect(valido.success).toBe(true);

    const invalido = CrearEventoAsistenciaSocialInputSchema.safeParse({
      ...payloadValido,
      asistenteSocialId: "id-invalido",
    });
    expect(invalido.success).toBe(false);
  });

  it("debe validar DerivarAsistenciaSocialIncidenteInputSchema, filtros H25 en query y respuesta canónica (HU-25)", () => {
    const filtroH25 = ListarEventosAsistenciaSocialQuerySchema.safeParse({
      incidenteId: "a1000000-0000-4000-8000-000000000006",
      asistenteSocialId: "00000000-0000-4000-8000-000000000019",
    });
    expect(filtroH25.success).toBe(true);

    const inputValido = DerivarAsistenciaSocialIncidenteInputSchema.safeParse({
      asistenteSocialId: "00000000-0000-4000-8000-000000000019",
      observaciones: "Priorizar evaluación FIBE domiciliaria por pérdida de enseres.",
      prioridad: "ALTA",
    });
    expect(inputValido.success).toBe(true);

    const inputInvalido = DerivarAsistenciaSocialIncidenteInputSchema.safeParse({
      asistenteSocialId: "no-es-uuid",
    });
    expect(inputInvalido.success).toBe(false);

    const respuestaValida = DerivarAsistenciaSocialIncidenteResponseSchema.safeParse({
      message: "Incidente derivado a Asistencia Social y profesional asignado para levantamiento de ficha FIBE.",
      accion: "CREADO",
      data: {
        id: "70000000-0000-4000-8000-000000000010",
        codigo: "AS-2026-0001",
        descripcion: "Anexo de vivienda inundado",
        tipoAfectacion: "Inundación",
        personasAfectadas: 4,
        familiasAfectadas: 1,
        direccionTexto: "Av. Pedro Montt 1100, Valdivia",
        latitud: -39.831,
        longitud: -73.238,
        prioridad: "ALTA",
        estado: "ASIGNADO",
        contactoNombre: "Juan Pérez",
        contactoTelefono: "+56991112233",
        contactoRut: "12.345.678-5",
        delegacionId: "30000000-0000-4000-8000-000000000002",
        delegacionNombre: "Delegación Municipal Sur",
        incidenteId: "a1000000-0000-4000-8000-000000000006",
        incidenteCodigo: "INC-2026-0006",
        asistenteSocialId: "00000000-0000-4000-8000-000000000019",
        asistenteSocialNombre: "Claudia Rojas Vidal",
        detallesEvaluacion: null,
        creadoPor: {
          id: "00000000-0000-4000-8000-000000000003",
          nombre: "Encargado de Operaciones",
        },
        creadoEn: "2026-11-21T20:00:00.000Z",
        actualizadoEn: "2026-11-21T20:00:00.000Z",
      },
      hito: {
        id: "80000000-0000-4000-8000-000000000001",
        misionId: "d1000000-0000-4000-8000-000000000004",
        hito: "DERIVACION_ASISTENCIA_SOCIAL",
        descripcion: "Incidente INC-2026-0006 derivado a Asistencia Social (DGRD / FIBE).",
        registradoPorId: "00000000-0000-4000-8000-000000000003",
        metadatos: { eventoAsistenciaSocialCodigo: "AS-2026-0001" },
        creadoEn: "2026-11-21T20:00:00.000Z",
      },
    });
    expect(respuestaValida.success).toBe(true);
  });
});
