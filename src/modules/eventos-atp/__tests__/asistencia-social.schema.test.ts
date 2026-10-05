import { describe, it, expect } from "vitest";
import {
  CrearEventoAsistenciaSocialInputSchema,
  ListarEventosAsistenciaSocialQuerySchema,
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
});
