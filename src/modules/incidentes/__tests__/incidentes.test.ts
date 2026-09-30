import { describe, expect, it, vi } from "vitest";
import { generarOpenApiSpec } from "../../../lib/openapi";
import type { IncidentesRepository } from "../repository";
import {
  CrearAvisoInputSchema,
  DescartarAvisoInputSchema,
  ListarAvisosQuerySchema,
  VerificarAvisoInputSchema,
} from "../schema";
import {
  ConflictError,
  IncidentesService,
  NotFoundError,
} from "../service";

describe("Módulo de Incidentes — Pruebas de Esquemas Zod", () => {
  it("debe validar correctamente un reporte de aviso válido", () => {
    const inputValido = {
      descripcion: "Anegamiento severo en calle Picarte con avenida Simpson",
      latitud: -39.8215,
      longitud: -73.2389,
      origenReporte: "WEB" as const,
      datosInformante: {
        nombre: "Juan Pérez",
        telefono: "+56912345678",
      },
    };

    const resultado = CrearAvisoInputSchema.safeParse(inputValido);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.descripcion).toBe(inputValido.descripcion);
      expect(resultado.data.latitud).toBe(-39.8215);
      expect(resultado.data.origenReporte).toBe("WEB");
    }
  });

  it("debe rechazar un aviso con coordenadas fuera de rango", () => {
    const inputInvalido = {
      descripcion: "Anegamiento en sector céntrico",
      latitud: 95.0, // Inválida (> 90)
      longitud: -73.2459,
    };

    const resultado = CrearAvisoInputSchema.safeParse(inputInvalido);
    expect(resultado.success).toBe(false);
  });

  it("debe rechazar un aviso con descripción menor a 5 caracteres", () => {
    const inputInvalido = {
      descripcion: "Agua",
      latitud: -39.8142,
      longitud: -73.2459,
    };

    const resultado = CrearAvisoInputSchema.safeParse(inputInvalido);
    expect(resultado.success).toBe(false);
  });

  it("debe exigir justificación de al menos 5 caracteres al descartar aviso", () => {
    const valido = DescartarAvisoInputSchema.safeParse({
      motivoDescarte: "Reporte duplicado con respecto al aviso anterior",
    });
    expect(valido.success).toBe(true);

    const invalido = DescartarAvisoInputSchema.safeParse({
      motivoDescarte: "no",
    });
    expect(invalido.success).toBe(false);
  });

  it("debe validar los parámetros de verificación hacia Incidente formal", () => {
    const valido = VerificarAvisoInputSchema.safeParse({
      tipoIncidenteId: "123e4567-e89b-12d3-a456-426614174000",
      requiereAsistenciaSocial: true,
    });
    expect(valido.success).toBe(true);

    const sinUUID = VerificarAvisoInputSchema.safeParse({
      tipoIncidenteId: "no-es-uuid",
    });
    expect(sinUUID.success).toBe(false);
  });

  it("debe aplicar defaults y coerción en ListarAvisosQuerySchema", () => {
    const parsed = ListarAvisosQuerySchema.parse({
      page: "2",
      limit: "15",
    });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(15);
    expect(parsed.estado).toBe("NO_VERIFICADO");
  });

  it("debe aceptar y normalizar delegación Calle-Calle a Calle Calle", () => {
    const parsed = ListarAvisosQuerySchema.parse({
      delegacion: "Calle-Calle",
      busqueda: "inundación",
      origen: "WEB",
    });

    expect(parsed.delegacion).toBe("Calle Calle");
    expect(parsed.busqueda).toBe("inundación");
    expect(parsed.origen).toBe("WEB");
  });
});

describe("Módulo de Incidentes — Lógica de Negocio y Servicio", () => {
  it("debe calcular correctamente los minutos de espera", () => {
    const service = new IncidentesService();
    const ahora = Date.now();
    const fechaHace45Min = new Date(ahora - 45 * 60 * 1000);

    const minutos = service.calcularMinutosEnEspera(fechaHace45Min);
    expect(minutos).toBe(45);
  });

  it("debe retornar 0 si la fecha es reciente o futura", () => {
    const service = new IncidentesService();
    const fechaFutura = new Date(Date.now() + 60000);

    const minutos = service.calcularMinutosEnEspera(fechaFutura);
    expect(minutos).toBe(0);
  });

  it("debe lanzar NotFoundError al consultar un aviso inexistente", async () => {
    const mockRepo = {
      obtenerAvisoPorId: vi.fn().mockResolvedValue(null),
    } as unknown as IncidentesRepository;

    const service = new IncidentesService(mockRepo);
    await expect(
      service.obtenerDetalleAviso("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si el aviso ya fue procesado al intentar verificarlo", async () => {
    const mockRepo = {
      verificarYCrearIncidenteTrx: vi
        .fn()
        .mockRejectedValue(new Error("AVISO_ALREADY_PROCESSED")),
    } as unknown as IncidentesRepository;

    const service = new IncidentesService(mockRepo);
    await expect(
      service.verificarAviso(
        "00000000-0000-0000-0000-000000000001",
        {
          tipoIncidenteId: "123e4567-e89b-12d3-a456-426614174000",
          requiereAsistenciaSocial: false,
        },
        "operador-1"
      )
    ).rejects.toThrow(ConflictError);
  });

  it("debe verificar y promover exitosamente el aviso a Incidente con estado Reportado", async () => {
    const mockRepo = {
      verificarYCrearIncidenteTrx: vi.fn().mockResolvedValue({
        aviso: {
          id: "aviso-123",
          estado: "VERIFICADO",
          incidente_id: "incidente-456",
          operador_id: "operador-1",
          actualizado_en: new Date(),
        },
        incidente: {
          id: "incidente-456",
          folio: "INC-2026-0001",
          tipo_incidente_id: "tipo-1",
          estado: "Reportado",
          descripcion: "Inundación confirmada",
          latitud: -39.8142,
          longitud: -73.2459,
          requiere_asistencia_social: true,
          creado_por_id: "operador-1",
          creado_en: new Date(),
        },
      }),
    } as unknown as IncidentesRepository;

    const service = new IncidentesService(mockRepo);
    const res = await service.verificarAviso(
      "aviso-123",
      {
        tipoIncidenteId: "tipo-1",
        requiereAsistenciaSocial: true,
      },
      "operador-1"
    );

    expect(res.incidente.estado).toBe("Reportado");
    expect(res.incidente.folio).toBe("INC-2026-0001");
    expect(res.aviso.estado).toBe("VERIFICADO");
  });

  it("debe descartar exitosamente un aviso con justificación", async () => {
    const mockRepo = {
      descartarAviso: vi.fn().mockResolvedValue({
        id: "aviso-123",
        estado: "DESCARTADO",
        motivo_descarte: "Llamada falsa o broma comprobada",
        operador_id: "operador-1",
        actualizado_en: new Date(),
      }),
    } as unknown as IncidentesRepository;

    const service = new IncidentesService(mockRepo);
    const res = await service.descartarAviso(
      "aviso-123",
      {
        motivoDescarte: "Llamada falsa o broma comprobada",
      },
      "operador-1"
    );

    expect(res.aviso.estado).toBe("DESCARTADO");
    expect(res.aviso.motivoDescarte).toBe("Llamada falsa o broma comprobada");
  });
});

describe("Módulo de Incidentes — Especificación OpenAPI", () => {
  it("debe generar un documento OpenAPI 3.0 con todas las rutas de avisos", () => {
    const spec = generarOpenApiSpec();

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toContain("SGRAI API");
    expect(spec.paths).toBeDefined();

    // Comprobar que las rutas requeridas estén expuestas
    expect(spec.paths["/api/incidentes/avisos"]).toBeDefined();
    expect(spec.paths["/api/incidentes/avisos/{id}"]).toBeDefined();
    expect(spec.paths["/api/incidentes/avisos/{id}/verificar"]).toBeDefined();
    expect(spec.paths["/api/incidentes/avisos/{id}/descartar"]).toBeDefined();
  });
});
