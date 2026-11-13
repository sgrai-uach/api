import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { calcularPrioridadSugerida } from "./prioridad.utils";

extendZodWithOpenApi(z);

export const PrioridadCanonicaEnum = z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]);

export const NivelCompromisoViviendaEnum = z.enum([
  "SIN_DANO",
  "LEVE",
  "MODERADO",
  "GRAVE_INHABITABLE",
]);

export const RiesgosActivosEvaluacionSchema = z
  .object({
    riesgoElectrico: z.boolean().default(false).optional(),
    riesgo_electrico: z.boolean().optional(),
    riesgoEstructural: z.boolean().default(false).optional(),
    riesgo_estructural: z.boolean().optional(),
    riesgoQuimicoSanitario: z.boolean().default(false).optional(),
    riesgo_quimico_sanitario: z.boolean().optional(),
    aislamientoVial: z.boolean().default(false).optional(),
    aislamiento_vial: z.boolean().optional(),
  })
  .openapi("RiesgosActivosEvaluacion");

export const FamiliaAfectadaInputSchema = z
  .object({
    id: z.string().optional(),
    referencia: z.string().max(100).optional(),
    nucleoFamiliarTotal: z.number().int().min(0).max(5000).optional(),
    nucleo_familiar_total: z.number().int().min(0).max(5000).optional(),
    cantidadNinos: z.number().int().min(0).max(1000).optional(),
    cantidad_ninos: z.number().int().min(0).max(1000).optional(),
    cantidadAdultosMayores: z.number().int().min(0).max(1000).optional(),
    cantidad_adultos_mayores: z.number().int().min(0).max(1000).optional(),
    personasDiscapacitadas: z.number().int().min(0).max(1000).optional(),
    personas_discapacitadas: z.number().int().min(0).max(1000).optional(),
    personasElectrodependientes: z.number().int().min(0).max(500).optional(),
    personas_electrodependientes: z.number().int().min(0).max(500).optional(),
    mascotasAfectadas: z.number().int().min(0).max(1000).optional(),
    mascotas_afectadas: z.number().int().min(0).max(1000).optional(),
    nivelCompromisoVivienda: NivelCompromisoViviendaEnum.optional(),
    nivel_compromiso_vivienda: NivelCompromisoViviendaEnum.optional(),
    requiereAsistenciaSocial: z.boolean().optional(),
    requiere_asistencia_social: z.boolean().optional(),
  })
  .openapi("FamiliaAfectadaInput");

/**
 * Esquema del formulario de evaluación técnica y vulnerabilidad en terreno (HU-38).
 */
export const EvaluacionTerrenoInputSchema = z
  .object({
    familias: z.array(FamiliaAfectadaInputSchema).optional().openapi({
      description: "Listado de familias u hogares individualizados con su vivienda asociada",
    }),
    nucleoFamiliarTotal: z
      .number({ message: "El tamaño del núcleo familiar debe ser un número entero." })
      .int("El tamaño del núcleo familiar debe ser un número entero.")
      .min(0, "El tamaño del núcleo familiar no puede ser negativo.")
      .max(5000, "El tamaño del núcleo familiar excede el máximo permitido.")
      .optional()
      .openapi({
        description: "Cantidad total de integrantes del núcleo familiar o personas afectadas en el punto",
        example: 4,
      }),
    nucleo_familiar_total: z.number().int().min(0).max(5000).optional(),
    personasAfectadas: z.number().int().min(0).max(5000).optional(),
    personas_afectadas: z.number().int().min(0).max(5000).optional(),
    familiasAfectadas: z
      .number()
      .int()
      .min(0, "La cantidad de familias afectadas no puede ser negativa.")
      .max(1000)
      .optional()
      .openapi({
        description: "Cantidad de núcleos familiares u hogares afectados",
        example: 1,
      }),
    familias_afectadas: z.number().int().min(0).max(1000).optional(),
    cantidadNinos: z
      .number()
      .int()
      .min(0, "La cantidad de niños no puede ser negativa.")
      .max(1000)
      .optional()
      .openapi({
        description: "Cantidad de niños, niñas y adolescentes (< 14 años) afectados",
        example: 2,
      }),
    cantidad_ninos: z.number().int().min(0).max(1000).optional(),
    cantidadAdultosMayores: z
      .number()
      .int()
      .min(0, "La cantidad de adultos mayores no puede ser negativa.")
      .max(1000)
      .optional()
      .openapi({
        description: "Cantidad de personas adultas mayores (>= 65 años) afectadas",
        example: 1,
      }),
    cantidad_adultos_mayores: z.number().int().min(0).max(1000).optional(),
    personasDiscapacitadas: z
      .number()
      .int()
      .min(0, "La cantidad de personas con discapacidad no puede ser negativa.")
      .max(1000)
      .optional()
      .openapi({
        description: "Cantidad de personas con discapacidad o movilidad reducida afectadas",
        example: 1,
      }),
    personas_discapacitadas: z.number().int().min(0).max(1000).optional(),
    personasElectrodependientes: z
      .number()
      .int()
      .min(0, "La cantidad de personas electrodependientes no puede ser negativa.")
      .max(500)
      .optional()
      .openapi({
        description: "Cantidad de pacientes electrodependientes con soporte vital en el lugar",
        example: 0,
      }),
    personas_electrodependientes: z.number().int().min(0).max(500).optional(),
    mascotasAfectadas: z
      .number()
      .int()
      .min(0, "La cantidad de mascotas afectadas no puede ser negativa.")
      .max(1000)
      .optional()
      .openapi({
        description: "Cantidad de mascotas o animales domésticos afectados o en riesgo",
        example: 2,
      }),
    mascotas_afectadas: z.number().int().min(0).max(1000).optional(),
    viviendasAfectadas: z
      .number()
      .int()
      .min(0, "La cantidad de viviendas afectadas no puede ser negativa.")
      .max(1000)
      .optional()
      .openapi({
        description: "Cantidad de inmuebles/viviendas con algún grado de afectación",
        example: 1,
      }),
    viviendas_afectadas: z.number().int().min(0).max(1000).optional(),
    nivelCompromisoVivienda: NivelCompromisoViviendaEnum.optional().openapi({
      description: "Nivel de daño estructural o habitacional constatado",
      example: "MODERADO",
    }),
    nivel_compromiso_vivienda: NivelCompromisoViviendaEnum.optional(),
    requiereEvacuacion: z.boolean().optional().openapi({
      description: "Indica si se requiere evacuación preventiva o inmediata de los ocupantes",
      example: false,
    }),
    requiere_evacuacion: z.boolean().optional(),
    requiereAsistenciaSocial: z.boolean().optional().openapi({
      description: "Indica si el grupo familiar requiere derivación para levantamiento de ficha FIBE",
      example: true,
    }),
    requiere_asistencia_social: z.boolean().optional(),
    requiereApoyoAdicional: z.boolean().optional().openapi({
      deprecated: true,
      description:
        "(Deprecado) Indica si la patrulla solicita despacho de cuadrilla pesada o recursos adicionales",
      example: false,
    }),
    requiere_apoyo_adicional: z.boolean().optional(),
    riesgosActivos: RiesgosActivosEvaluacionSchema.optional(),
    riesgos_activos: RiesgosActivosEvaluacionSchema.optional(),
    riesgoElectrico: z.boolean().optional(),
    riesgo_electrico: z.boolean().optional(),
    riesgoEstructural: z.boolean().optional(),
    riesgo_estructural: z.boolean().optional(),
    riesgoQuimicoSanitario: z.boolean().optional(),
    riesgo_quimico_sanitario: z.boolean().optional(),
    aislamientoVial: z.boolean().optional(),
    aislamiento_vial: z.boolean().optional(),
    detallesAdicionales: z
      .string()
      .max(2000, "Los detalles adicionales no pueden exceder los 2000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Observaciones detalladas y notas técnicas levantadas por la patrulla en terreno",
        example:
          "Ingreso de agua a primer nivel de vivienda. Adulto mayor requiere traslado asistido.",
      }),
    detalles_adicionales: z.string().max(2000).nullable().optional(),
    observaciones: z.string().max(2000).nullable().optional(),
    accionesRealizadas: z
      .string()
      .max(1000, "Las acciones realizadas no pueden exceder los 1000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Maniobras preliminares ejecutadas por la patrulla verificadora",
        example: "Corte preventivo de suministro eléctrico e inspección perimetral.",
      }),
    acciones_realizadas: z.string().max(1000).nullable().optional(),
    danosEstimados: z
      .string()
      .max(1000, "Los daños estimados no pueden exceder los 1000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Descripción preliminar de daños materiales constatados",
        example: "Anegamiento de piso flotante y pérdida de enseres menores.",
      }),
    danos_estimados: z.string().max(1000).nullable().optional(),
  })
  .openapi("EvaluacionTerrenoInput");

export type EvaluacionTerrenoInput = z.infer<typeof EvaluacionTerrenoInputSchema>;

/**
 * Input para POST /api/incidentes/{id}/prioridad/calcular
 */
export const CalcularPrioridadInputSchema = EvaluacionTerrenoInputSchema.extend({
  evaluacion: EvaluacionTerrenoInputSchema.optional(),
}).openapi("CalcularPrioridadInput");

export type CalcularPrioridadInput = z.infer<typeof CalcularPrioridadInputSchema>;

/**
 * Respuesta de POST /api/incidentes/{id}/prioridad/calcular
 */
export const CalcularPrioridadResponseSchema = z
  .object({
    message: z.string().openapi({
      example: "Prioridad sugerida calculada exitosamente según evaluación de terreno.",
    }),
    data: z.object({
      incidenteId: z.string().uuid(),
      prioridadActual: PrioridadCanonicaEnum,
      prioridadSugerida: PrioridadCanonicaEnum,
      puntajeTotal: z.number(),
      factoresGatillantes: z.array(z.string()),
      requiereAsistenciaSocialSugerido: z.boolean(),
      evaluacionNormalizada: z.object({
        nucleoFamiliarTotal: z.number(),
        familiasAfectadas: z.number(),
        cantidadNinos: z.number(),
        cantidadAdultosMayores: z.number(),
        personasDiscapacitadas: z.number(),
        personasElectrodependientes: z.number(),
        mascotasAfectadas: z.number(),
        viviendasAfectadas: z.number(),
        nivelCompromisoVivienda: NivelCompromisoViviendaEnum,
        requiereEvacuacion: z.boolean(),
        requiereAsistenciaSocial: z.boolean(),
        requiereApoyoAdicional: z.boolean(),
        riesgosActivos: z.object({
          riesgoElectrico: z.boolean(),
          riesgoEstructural: z.boolean(),
          riesgoQuimicoSanitario: z.boolean(),
          aislamientoVial: z.boolean(),
        }),
        detallesAdicionales: z.string().nullable(),
        accionesRealizadas: z.string().nullable(),
        danosEstimados: z.string().nullable(),
      }),
    }),
  })
  .openapi("CalcularPrioridadResponse");

export type CalcularPrioridadResponse = z.infer<typeof CalcularPrioridadResponseSchema>;

const tieneCamposEvaluacionEnRaiz = (data: Record<string, unknown>): boolean => {
  const clavesEvaluacion = [
    "nucleoFamiliarTotal",
    "nucleo_familiar_total",
    "personasAfectadas",
    "personas_afectadas",
    "cantidadNinos",
    "cantidad_ninos",
    "cantidadAdultosMayores",
    "cantidad_adultos_mayores",
    "personasDiscapacitadas",
    "personas_discapacitadas",
    "personasElectrodependientes",
    "personas_electrodependientes",
    "mascotasAfectadas",
    "mascotas_afectadas",
    "viviendasAfectadas",
    "viviendas_afectadas",
    "nivelCompromisoVivienda",
    "nivel_compromiso_vivienda",
    "requiereEvacuacion",
    "requiere_evacuacion",
    "riesgosActivos",
    "riesgos_activos",
    "riesgoElectrico",
    "riesgo_electrico",
    "riesgoEstructural",
    "riesgo_estructural",
    "riesgoQuimicoSanitario",
    "riesgo_quimico_sanitario",
    "aislamientoVial",
    "aislamiento_vial",
  ];
  return clavesEvaluacion.some((k) => data[k] !== undefined);
};

/**
 * Input para PATCH /api/incidentes/{id}/prioridad (HU-38)
 */
export const ActualizarPrioridadIncidenteInputSchema = EvaluacionTerrenoInputSchema.extend({
  prioridad: PrioridadCanonicaEnum.optional().openapi({
    description: "Nivel de prioridad asignado por la patrulla verificadora",
    example: "CRITICA",
  }),
  prioridadAsignada: PrioridadCanonicaEnum.optional().openapi({
    description: "Alias de prioridad asignada por la patrulla verificadora",
    example: "CRITICA",
  }),
  prioridad_asignada: PrioridadCanonicaEnum.optional(),
  prioridadSugerida: PrioridadCanonicaEnum.optional().openapi({
    description:
      "Prioridad sugerida preliminarmente por el sistema (si se envía el formulario 'evaluacion', se recalcula autoritativamente)",
    example: "ALTA",
  }),
  prioridad_sugerida: PrioridadCanonicaEnum.optional(),
  justificacionPrioridad: z
    .string()
    .max(1000, "La justificación no puede exceder los 1000 caracteres.")
    .nullable()
    .optional()
    .openapi({
      description:
        "Justificación técnica obligatoria (mínimo 5 caracteres) cuando la prioridad asignada difiere de la prioridad sugerida",
      example:
        "Se eleva a CRITICA debido al rápido avance del agua hacia la habitación de adulto mayor con movilidad reducida.",
    }),
  justificacion_prioridad: z
    .string()
    .max(1000, "La justificación no puede exceder los 1000 caracteres.")
    .nullable()
    .optional(),
  justificacion: z
    .string()
    .max(1000, "La justificación no puede exceder los 1000 caracteres.")
    .nullable()
    .optional(),
  misionId: z
    .string()
    .uuid({ message: "El identificador de la misión debe ser un UUID válido." })
    .optional()
    .openapi({
      description:
        "UUID opcional de la misión táctica. Si se omite, el sistema resuelve la misión EN_CURSO asociada al incidente.",
      example: "60000000-0000-4000-8000-000000000001",
    }),
  mision_id: z
    .string()
    .uuid({ message: "El identificador de la misión debe ser un UUID válido." })
    .optional(),
  resumenTecnico: z.string().max(1000).nullable().optional(),
  resumen_tecnico: z.string().max(1000).nullable().optional(),
  evaluacion: EvaluacionTerrenoInputSchema.optional().openapi({
    description:
      "Datos estructurados del formulario de evaluación en terreno (tamaño de núcleo familiar, niños, discapacitados, mascotas, vivienda, riesgos)",
  }),
})
  .superRefine((data, ctx) => {
    const prioridadElegida =
      data.prioridad ?? data.prioridadAsignada ?? data.prioridad_asignada;

    if (!prioridadElegida) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prioridad"],
        message:
          "Debe especificar el nivel de prioridad ('BAJA', 'MEDIA', 'ALTA' o 'CRITICA').",
      });
      return;
    }

    const justificacionRaw =
      data.justificacionPrioridad ?? data.justificacion_prioridad ?? data.justificacion;
    const justificacionLimpia =
      typeof justificacionRaw === "string" ? justificacionRaw.trim() : "";

    // Determinar si hay evaluación o prioridad_sugerida explícita en el payload para validar discrepancia en el acto
    const hayEvaluacion =
      data.evaluacion !== undefined ||
      tieneCamposEvaluacionEnRaiz(data as unknown as Record<string, unknown>);

    const prioridadSugeridaExplicita =
      data.prioridadSugerida ?? data.prioridad_sugerida;

    let prioridadSugeridaReferencia = prioridadSugeridaExplicita;
    if (!prioridadSugeridaReferencia && hayEvaluacion) {
      const fuenteEval = (data.evaluacion ?? data) as Record<string, unknown>;
      prioridadSugeridaReferencia =
        calcularPrioridadSugerida(fuenteEval).prioridadSugerida;
    }

    if (
      prioridadSugeridaReferencia &&
      prioridadElegida !== prioridadSugeridaReferencia &&
      justificacionLimpia.length < 5
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justificacion_prioridad"],
        message:
          "Debe ingresar una justificación técnica de al menos 5 caracteres cuando modifica la prioridad sugerida por el sistema.",
      });
    } else if (justificacionRaw !== undefined && justificacionRaw !== null && justificacionLimpia.length > 0 && justificacionLimpia.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justificacion_prioridad"],
        message: "La justificación de prioridad debe contener al menos 5 caracteres.",
      });
    }
  })
  .openapi("ActualizarPrioridadIncidenteInput");

export type ActualizarPrioridadIncidenteInput = z.infer<
  typeof ActualizarPrioridadIncidenteInputSchema
>;

/**
 * Representación de un reporte de evaluación en terreno emitido al Centro de Mando (con soporte de versiones/reenvíos).
 */
export const ReporteEvaluacionTerrenoItemSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "UUID único del reporte de evaluación en terreno" }),
    misionId: z.string().uuid().openapi({ description: "UUID de la misión de verificación asociada" }),
    versionReporte: z.number().int().openapi({
      description: "Número correlativo de envío del reporte dentro de la misión (1 = inicial, 2+ = rectificaciones)",
      example: 1,
    }),
    esRectificacion: z.boolean().openapi({
      description: "Indica si este reporte corresponde a una modificación/reenvío posterior al reporte inicial",
      example: false,
    }),
    etiquetaReporte: z.string().openapi({
      description: "Etiqueta legible para el Centro de Mando que distingue cada envío",
      example: "Reporte de Evaluación #1 (Inicial)",
    }),
    prioridadSugerida: PrioridadCanonicaEnum.nullable().openapi({
      description: "Prioridad sugerida por el sistema según los datos de este reporte",
      example: "ALTA",
    }),
    prioridadAsignada: PrioridadCanonicaEnum.nullable().openapi({
      description: "Prioridad confirmada por la patrulla en este reporte",
      example: "CRITICA",
    }),
    justificacionPrioridad: z.string().nullable().openapi({
      description: "Justificación técnica registrada si se modificó la prioridad sugerida",
    }),
    resumenTecnico: z.string().openapi({
      description: "Resumen consolidado de la evaluación en terreno",
    }),
    personasAfectadas: z.number().int().openapi({
      description: "Tamaño total del núcleo familiar / personas afectadas",
      example: 4,
    }),
    requiereApoyoAdicional: z.boolean().openapi({
      description: "Indica si requiere escalamiento a cuadrilla o maquinaria pesada",
    }),
    detallesAdicionales: z.string().nullable().openapi({
      description: "Observaciones adicionales ingresadas por la patrulla",
    }),
    accionesRealizadas: z.string().nullable().openapi({
      description: "Acciones preliminares ejecutadas en terreno",
    }),
    danosEstimados: z.string().nullable().openapi({
      description: "Estimación técnica de daños observados",
    }),
    evaluacion: z.record(z.string(), z.unknown()).openapi({
      description:
        "Objeto completo con el desglose demográfico (niños, adultos mayores, discapacitados, electrodependientes, mascotas), compromiso de vivienda, riesgos activos y puntaje",
    }),
    evaluador: z.object({
      id: z.string().uuid(),
      nombre: z.string(),
      email: z.string().optional(),
      rut: z.string().nullable().optional(),
    }),
    creadoEn: z.string().openapi({ description: "Fecha y hora de envío del reporte (ISO 8601)" }),
  })
  .openapi("ReporteEvaluacionTerrenoItem");

export type ReporteEvaluacionTerrenoItem = z.infer<
  typeof ReporteEvaluacionTerrenoItemSchema
>;

/**
 * Resumen del incidente devuelto tras actualizar prioridad (HU-38).
 */
export const IncidentePrioridadActualizadaResumenSchema = z
  .object({
    id: z.string().uuid(),
    codigo: z.string(),
    estado: z.string(),
    prioridad: PrioridadCanonicaEnum,
    prioridadSugerida: PrioridadCanonicaEnum,
    modificoPrioridadSugerida: z.boolean(),
    justificacionPrioridad: z.string().nullable(),
    requiereAsistenciaSocial: z.boolean(),
    actualizadoEn: z.string(),
  })
  .openapi("IncidentePrioridadActualizadaResumen");

/**
 * Hito registrado en mision_hito tras asignar o rectificar prioridad (HU-38).
 */
export const MisionHitoPrioridadSchema = z
  .object({
    id: z.string().uuid(),
    misionId: z.string().uuid(),
    hito: z.string().openapi({ example: "PRIORIDAD_ASIGNADA" }),
    descripcion: z.string(),
    registradoPorId: z.string().uuid().nullable(),
    creadoEn: z.string(),
  })
  .openapi("MisionHitoPrioridad");

/**
 * Respuesta HTTP 200 de PATCH /api/incidentes/{id}/prioridad (HU-38).
 */
export const ActualizarPrioridadIncidenteResponseSchema = z
  .object({
    message: z.string().openapi({
      example:
        "Evaluación en terreno y prioridad del incidente registradas exitosamente (Reporte #1).",
    }),
    data: z.object({
      incidente: IncidentePrioridadActualizadaResumenSchema,
      reporteTerreno: ReporteEvaluacionTerrenoItemSchema,
      hito: MisionHitoPrioridadSchema,
    }),
  })
  .openapi("ActualizarPrioridadIncidenteResponse");

export type ActualizarPrioridadIncidenteResponse = z.infer<
  typeof ActualizarPrioridadIncidenteResponseSchema
>;

