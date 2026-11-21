import { describe, it, expect } from "vitest";
import {
  CrearReporteVerificacionInputSchema,
  DictamenAtencionEnum,
  EnviarReporteVerificacionResponseSchema,
} from "../mision.schema";

describe("Esquemas Zod de Informe Técnico de Verificación en Terreno (HU-39 / HU-86)", () => {
  it("debe aceptar solo REQUIERE_CUADRILLA o NO_ABORDABLE en DictamenAtencionEnum", () => {
    expect(DictamenAtencionEnum.safeParse("REQUIERE_CUADRILLA").success).toBe(true);
    expect(DictamenAtencionEnum.safeParse("NO_ABORDABLE").success).toBe(true);
    expect(DictamenAtencionEnum.safeParse("OTRO_DICTAMEN").success).toBe(false);
  });

  it("debe validar un informe completo en camelCase con dictamen REQUIERE_CUADRILLA y requerimiento de asistencia social con familias y contacto preliminar", () => {
    const res = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico:
        "Se constata colapso de colector de aguas lluvias y anegamiento de dos viviendas.",
      estadoTerreno: "CRITICO",
      personasAfectadas: 6,
      danosEstimados: "Daño en pisos y enseres de primer nivel.",
      observaciones: "Acceso libre para motobomba por pasaje interior.",
      requiereAsistenciaSocial: true,
      familias: [
        {
          referencia: "Familia Veas",
          nucleoFamiliarTotal: 6,
          cantidadNinos: 2,
          personasDiscapacitadas: 1,
          contactoNombre: "Ana Veas",
          contactoTelefono: "+56912345678",
          contactoRut: "11.111.111-1",
        },
      ],
      adjuntoIds: ["f0000000-0000-4000-8000-000000000001"],
      latitud: -39.819588,
      longitud: -73.245209,
    });

    expect(res.success).toBe(true);
  });

  it("debe rechazar cuando requiere_asistencia_social es true sin familias o sin contacto preliminar por familia", () => {
    const sinFamilias = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico: "Se requiere evaluación social posterior en vivienda anegada.",
      requiereAsistenciaSocial: true,
    });
    expect(sinFamilias.success).toBe(false);

    const sinContacto = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico: "Se requiere evaluación social posterior en vivienda anegada.",
      requiereAsistenciaSocial: true,
      familias: [{ nucleoFamiliarTotal: 4, cantidadNinos: 1 }],
    });
    expect(sinContacto.success).toBe(false);

    const incoherente = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico: "Se requiere evaluación social posterior en vivienda anegada.",
      requiereAsistenciaSocial: true,
      familias: [
        {
          nucleoFamiliarTotal: 5,
          cantidadNinos: 6,
          contactoNombre: "Ana Veas",
          contactoTelefono: "+56912345678",
        },
      ],
    });
    expect(incoherente.success).toBe(false);
  });

  it("debe aceptar alias en snake_case y omitir personas_afectadas para rescate desde HU-38", () => {
    const res = CrearReporteVerificacionInputSchema.safeParse({
      dictamen_atencion: "REQUIERE_CUADRILLA",
      resumen_tecnico: "Caída de árbol de gran envergadura bloqueando calzada norte.",
      estado_terreno: "CRITICO",
      danos_estimados: "Cierre total de pista y daño en cerco.",
      requiere_asistencia_social: false,
      adjuntos: [
        {
          nombreArchivo: "evidencia_arbol.jpg",
          url: "/uploads/evidencia/evidencia_arbol.jpg",
          tipoMime: "image/jpeg",
          tamanoBytes: 102400,
        },
      ],
    });

    expect(res.success).toBe(true);
  });

  it("debe rechazar resumen_tecnico menor a 10 caracteres o ausente", () => {
    const resCorto = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumen_tecnico: "Muy corto",
    });

    expect(resCorto.success).toBe(false);
    if (!resCorto.success) {
      expect(
        resCorto.error.issues.some((i) => i.message.includes("al menos 10 caracteres"))
      ).toBe(true);
    }

    const resSinResumen = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
    });
    expect(resSinResumen.success).toBe(false);
  });

  it("debe exigir motivo_no_abordable de al menos 15 caracteres cuando dictamen es NO_ABORDABLE", () => {
    const sinMotivo = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "NO_ABORDABLE",
      resumen_tecnico: "Se acude al punto y el acceso corresponde a recinto privado.",
    });
    expect(sinMotivo.success).toBe(false);

    const motivoCorto = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "NO_ABORDABLE",
      motivo_no_abordable: "Falsa alarma",
      resumen_tecnico: "Se acude al punto y no existe afectación en la vía pública.",
    });
    expect(motivoCorto.success).toBe(false);
    if (!motivoCorto.success) {
      expect(
        motivoCorto.error.issues.some((i) => i.message.includes("al menos 15 caracteres"))
      ).toBe(true);
    }

    const motivoValido = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "NO_ABORDABLE",
      motivo_no_abordable:
        "Emergencia ubicada dentro de predio privado inaccesible sin autorización de propietario.",
      resumen_tecnico: "Inspección visual desde el exterior sin afectación a bien nacional de uso público.",
      estado_terreno: "INACCESIBLE",
      personas_afectadas: 0,
      requiere_asistencia_social: false,
    });
    expect(motivoValido.success).toBe(true);
  });

  it("debe rechazar personas_afectadas negativas o coordenadas fuera de rango WGS84", () => {
    const resNeg = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico: "Anegamiento en vía pública de mediana complejidad.",
      personasAfectadas: -2,
    });
    expect(resNeg.success).toBe(false);

    const resGeo = CrearReporteVerificacionInputSchema.safeParse({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico: "Anegamiento en vía pública de mediana complejidad.",
      latitud: -95,
      longitud: 200,
    });
    expect(resGeo.success).toBe(false);
  });

  it("debe validar el esquema de respuesta EnviarReporteVerificacionResponseSchema", () => {
    const payload = {
      message: "Informe técnico de verificación registrado y misión cerrada exitosamente.",
      data: {
        reporteTerreno: {
          id: "e0000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          tipoReporte: "VERIFICACION_CIERRE",
          dictamen: "REQUIERE_CUADRILLA" as const,
          motivoNoAbordable: null,
          requiereAsistenciaSocial: true,
          versionReporte: 2,
          esRectificacion: false,
          etiquetaReporte: "Informe Técnico de Verificación (Cierre — Requiere Cuadrilla)",
          evaluador: {
            id: "00000000-0000-4000-8000-000000000004",
            nombre: "Líder Patrulla",
            email: "patrulla@valdivia.cl",
            rut: "15.111.222-3",
          },
          resumenTecnico: "Se requiere despacho de cuadrilla vial.",
          accionesRealizadas: null,
          requiereApoyoAdicional: true,
          danosEstimados: "Anegamiento de calzada",
          observaciones: null,
          personasAfectadas: 4,
          estadoTerreno: "CRITICO",
          adjuntos: [],
          creadoEn: "2026-11-16T00:00:00.000Z",
          actualizadoEn: "2026-11-16T00:00:00.000Z",
        },
        mision: {
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0001",
          titulo: "Verificación de Incidente",
          tipoMision: "VERIFICACION" as const,
          estado: "COMPLETADA" as const,
          prioridad: "ALTA" as const,
          incidenteId: "a0000000-0000-4000-8000-000000000001",
          patrullaId: "f1000000-0000-4000-8000-000000000001",
          fechaInicio: "2026-11-15T23:00:00.000Z",
          fechaCierre: "2026-11-16T00:00:00.000Z",
          actualizadoEn: "2026-11-16T00:00:00.000Z",
        },
        patrulla: {
          id: "f1000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Costa-1",
          estado: "DISPONIBLE",
        },
        incidente: {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0001",
          estado: "VERIFICANDO",
          prioridad: "ALTA",
          requiereAsistenciaSocial: true,
          fechaCierre: null,
          motivoNoAbordable: null,
        },
        hito: {
          id: "70000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          hito: "VERIFICACION_COMPLETADA",
          descripcion: "Informe técnico enviado y misión cerrada.",
          registradoPorId: "00000000-0000-4000-8000-000000000004",
          latitud: null,
          longitud: null,
          metadatos: { dictamen: "REQUIERE_CUADRILLA" },
          creadoEn: "2026-11-16T00:00:00.000Z",
        },
      },
    };

    expect(EnviarReporteVerificacionResponseSchema.safeParse(payload).success).toBe(true);
  });
});
