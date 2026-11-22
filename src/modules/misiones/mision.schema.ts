import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  EstadoNotificacionMisionEnum,
  NotificacionMisionDetalleSchema,
} from "./notificacion-mision.schema";
import {
  FamiliaAfectadaInputSchema,
  validarCoherenciaFamilia,
  validarContactosFamiliasFibe,
} from "@/modules/shared/familia-afectada.schema";

extendZodWithOpenApi(z);

export const EstadoMisionEnum = z.enum([
  "PLANIFICADA",
  "DESPACHADA",
  "EN_CURSO",
  "COMPLETADA",
  "CANCELADA",
  "RECHAZADA",
]);

export const TipoMisionEnum = z.enum([
  "VERIFICACION",
  "ATENCION_CUADRILLA",
  "PREVENCION",
  "RECUPERACION",
  "ASISTENCIA_SOCIAL",
]);

export const PrioridadMisionEnum = z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]);

export const DictamenAtencionEnum = z.enum(["REQUIERE_CUADRILLA", "NO_ABORDABLE"]);

export const EstadoTerrenoVerificacionEnum = z.enum([
  "CRITICO",
  "ESTABLE",
  "INACCESIBLE",
  "CONTROLADO",
  "EN_VERIFICACION",
  "FINALIZADO",
]);

export const EstadoTerrenoCierreEnum = z.enum([
  "CONTROLADO",
  "ESTABLE",
  "FINALIZADO",
  "REQUIERE_SEGUIMIENTO",
  "CRITICO",
  "INACCESIBLE",
]);

export const MaterialConsumidoBodySchema = z
  .object({
    recurso_id: z
      .string()
      .uuid("El identificador del recurso debe ser un UUID válido.")
      .openapi({
        description: "Identificador único UUID del recurso material o insumo consumido",
        example: "b0000000-0000-4000-8000-000000000010",
      }),
    cantidad: z
      .number({ message: "La cantidad consumida debe ser un número entero." })
      .int("La cantidad consumida debe ser un número entero.")
      .min(1, "La cantidad consumida debe ser al menos 1.")
      .openapi({
        description: "Cantidad física de unidades consumidas durante la faena",
        example: 15,
      }),
    unidad: z
      .string()
      .trim()
      .min(1, "La unidad de medida no puede estar vacía.")
      .max(50, "La unidad de medida no puede exceder los 50 caracteres.")
      .optional()
      .openapi({
        description: "Unidad de medida referencial (ej. sacos, unidades, litros)",
        example: "sacos",
      }),
    observacion: z
      .string()
      .trim()
      .max(300, "La observación del material no puede exceder los 300 caracteres.")
      .optional()
      .openapi({
        description: "Observación específica sobre el consumo del material",
        example: "Utilizados para contención perimetral en acceso norte",
      }),
  })
  .openapi("MaterialConsumidoBody");

export type MaterialConsumidoBody = z.infer<typeof MaterialConsumidoBodySchema>;

export const MaterialConsumidoDetalleSchema = z
  .object({
    recursoId: z.string().uuid().openapi({ description: "UUID del recurso consumido" }),
    nombre: z.string().openapi({ description: "Nombre del recurso material", example: "Sacos de arena 25kg" }),
    cantidad: z.number().int().min(1).openapi({ description: "Cantidad consumida", example: 15 }),
    unidad: z.string().nullable().optional().openapi({ description: "Unidad de medida", example: "sacos" }),
    observacion: z.string().nullable().optional().openapi({ description: "Observación adicional del consumo" }),
    stockAnterior: z.number().int().nonnegative().optional().openapi({ description: "Stock en inventario previo al descuento" }),
    stockPosterior: z.number().int().nonnegative().optional().openapi({ description: "Stock en inventario posterior al descuento" }),
  })
  .openapi("MaterialConsumidoDetalle");

export type MaterialConsumidoDetalle = z.infer<typeof MaterialConsumidoDetalleSchema>;

// Parámetro de ruta para consultar detalle de misión
export const MisionIdParamSchema = z.string().uuid({
  message: "El identificador de la misión debe ser un UUID válido.",
}).openapi({
  description: "Identificador único UUID de la misión",
  example: "60000000-0000-4000-8000-000000000001",
});

// Evidencia multimedia adjunta
export const AdjuntoEvidenciaSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del archivo adjunto" }),
  nombreArchivo: z.string().openapi({ description: "Nombre original del archivo", example: "foto_evaluacion_1.jpg" }),
  url: z.string().openapi({
    description: "Ruta de acceso pública o relativa del recurso estático bajo Caddy",
    example: "/uploads/evidencia/foto_evaluacion_1.jpg",
  }),
  tipoMime: z.string().openapi({ description: "MIME type del archivo", example: "image/jpeg" }),
  tamanoBytes: z.number().openapi({ description: "Tamaño en bytes del archivo", example: 1048576 }),
  creadoEn: z.string().openapi({ description: "Fecha y hora de carga del archivo en formato ISO 8601" }),
});

export type AdjuntoEvidencia = z.infer<typeof AdjuntoEvidenciaSchema>;

// Funcionario / Evaluador en terreno
export const EvaluadorTerrenoSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del usuario" }),
  nombre: z.string().openapi({ description: "Nombre completo del evaluador" }),
  email: z.string().email().openapi({ description: "Correo institucional" }),
  rut: z.string().nullable().optional().openapi({ description: "RUT del funcionario" }),
});

export type EvaluadorTerreno = z.infer<typeof EvaluadorTerrenoSchema>;

// Reporte de terreno
export const ReporteTerrenoDetalleSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del reporte de terreno" }),
  misionId: z.string().uuid().openapi({ description: "Identificador de la misión asociada" }),
  tipoReporte: z.string().optional().openapi({ description: "Naturaleza del reporte (EVALUACION_PRIORIDAD, VERIFICACION_CIERRE, REPORTE_CUADRILLA)", example: "VERIFICACION_CIERRE" }),
  dictamen: DictamenAtencionEnum.nullable().optional().openapi({ description: "Dictamen operativo de la patrulla verificadora al cerrar la verificación (HU-39)", example: "REQUIERE_CUADRILLA" }),
  motivoNoAbordable: z.string().nullable().optional().openapi({ description: "Justificación obligatoria cuando el dictamen es NO_ABORDABLE (HU-39 / HU-86)" }),
  requiereAsistenciaSocial: z.boolean().optional().openapi({ description: "Indica si se solicitó derivación social / Ficha FIBE en este reporte (HU-39)" }),
  versionReporte: z.number().int().optional().openapi({ description: "Número correlativo de versión del reporte en esta misión (1 = inicial, 2+ = rectificaciones)", example: 1 }),
  esRectificacion: z.boolean().optional().openapi({ description: "Indica si es una modificación/reenvío de evaluación en terreno", example: false }),
  etiquetaReporte: z.string().optional().openapi({ description: "Etiqueta legible del número de reporte para el Centro de Mando", example: "Reporte de Evaluación #1 (Inicial)" }),
  prioridadSugerida: PrioridadMisionEnum.nullable().optional().openapi({ description: "Prioridad sugerida por el sistema en este reporte (HU-38)" }),
  prioridadAsignada: PrioridadMisionEnum.nullable().optional().openapi({ description: "Prioridad confirmada por la patrulla en este reporte (HU-38)" }),
  justificacionPrioridad: z.string().nullable().optional().openapi({ description: "Justificación técnica si se modificó la prioridad sugerida (HU-38)" }),
  detallesEvaluacion: z.record(z.string(), z.unknown()).optional().openapi({ description: "Desglose del formulario de evaluación en terreno (núcleo familiar, niños, discapacitados, mascotas, vivienda, riesgos)" }),
  evaluador: EvaluadorTerrenoSchema.openapi({ description: "Datos del funcionario o patrullero que emitió el reporte" }),
  resumenTecnico: z.string().openapi({ description: "Diagnóstico técnico consolidado de la intervención" }),
  accionesRealizadas: z.string().nullable().openapi({ description: "Labores y maniobras ejecutadas en terreno" }),
  requiereApoyoAdicional: z.boolean().openapi({ description: "Indica si se requiere escalamiento logístico o relevo" }),
  danosEstimados: z.string().nullable().openapi({ description: "Descripción o estimación preliminar de daños observados" }),
  observaciones: z.string().nullable().openapi({ description: "Observaciones de seguridad o condiciones de terreno" }),
  personasAfectadas: z.number().openapi({ description: "Cantidad estimada de personas o familias afectadas" }),
  estadoTerreno: z.string().openapi({ description: "Estado operativo al momento del reporte (ej. FINALIZADO, EN_CURSO)" }),
  horasHombre: z.number().nullable().optional().openapi({ description: "Horas hombre invertidas por la cuadrilla (HU-68)", example: 6.5 }),
  materialesConsumidos: z.array(MaterialConsumidoDetalleSchema).optional().openapi({ description: "Listado de materiales e insumos consumidos en la faena (HU-68)" }),
  adjuntos: z.array(AdjuntoEvidenciaSchema).openapi({
    description: "Fotografías, videos o documentos levantados como evidencia en terreno",
  }),
  creadoEn: z.string().openapi({ description: "Fecha y hora del levantamiento del reporte en formato ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha y hora de última modificación en formato ISO 8601" }),
});

export type ReporteTerrenoDetalle = z.infer<typeof ReporteTerrenoDetalleSchema>;

// Bitácora de tiempos simplificada (Opción 1 - HU-17 / Hito previo a H23)
export const MisionBitacoraHitoSchema = z.object({
  id: z.string().uuid().optional().openapi({ description: "UUID del registro en mision_hito si aplica" }),
  hito: z.string().openapi({ description: "Hito temporal de la misión", example: "PLANIFICACION" }),
  fecha: z.string().openapi({ description: "Fecha del hito en formato YYYY-MM-DD", example: "2026-10-02" }),
  hora: z.string().openapi({ description: "Hora del hito en formato HH:MM:SS", example: "14:30:00" }),
  timestamp: z.string().openapi({ description: "Timestamp completo ISO 8601" }),
  descripcion: z.string().openapi({ description: "Glosa descriptiva del hito operativo" }),
  registradoPor: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      email: z.string().email().optional(),
    })
    .nullable()
    .optional()
    .openapi({
      description: "Funcionario que registró el hito en terreno o Centro de Mando",
    }),
  metadatos: z.record(z.string(), z.unknown()).nullable().optional().openapi({
    description: "Metadatos estructurados del hito (ej. tipoAnterior y tipoNuevo en TIPOLOGIA_RECLASIFICADA)",
  }),
});

export type MisionBitacoraHito = z.infer<typeof MisionBitacoraHitoSchema>;

// Resumen del incidente vinculado (si aplica)
export const IncidenteMisionResumenSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del incidente" }),
  codigo: z.string().openapi({ description: "Código interno del incidente (ej. INC-2026-001)" }),
  codigoSeguimiento: z.string().openapi({ description: "Código de seguimiento entregado al informante" }),
  tipoAfectacion: z.string().openapi({ description: "Tipo de emergencia o afectación" }),
  descripcion: z.string().nullable().openapi({ description: "Relato del incidente" }),
  direccion: z.string().openapi({ description: "Dirección o punto geográfico en Valdivia" }),
  latitud: z.number().openapi({ description: "Latitud WGS84" }),
  longitud: z.number().openapi({ description: "Longitud WGS84" }),
  estado: z.string().openapi({ description: "Estado actual del incidente (REPORTADO, VERIFICANDO, EN_ATENCION, RESUELTO)" }),
  prioridad: z.string().openapi({ description: "Prioridad del incidente (BAJA, MEDIA, ALTA, CRITICA)" }),
  prioridadSugerida: z.string().nullable().optional().openapi({ description: "Prioridad sugerida preliminarmente por el sistema (HU-38)" }),
  justificacionPrioridad: z.string().nullable().optional().openapi({ description: "Justificación técnica del ajuste de prioridad en terreno (HU-38)" }),
  requiereAsistenciaSocial: z.boolean().openapi({ description: "Requiere derivación social / ficha FIBE" }),
  fechaCierre: z.string().nullable().optional().openapi({ description: "Fecha y hora de cierre del incidente si fue cerrado o declarado NO_ABORDABLE" }),
  motivoNoAbordable: z.string().nullable().optional().openapi({ description: "Motivo fundado registrado si el incidente fue declarado NO_ABORDABLE" }),
  delegacionNombre: z.string().nullable().openapi({ description: "Delegación territorial asignada" }),
});

export type IncidenteMisionResumen = z.infer<typeof IncidenteMisionResumenSchema>;

// Resumen del punto crítico preventivo (si la misión es de prevención sin incidente formal)
export const PrevencionMisionResumenSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador del punto crítico de prevención" }),
  codigo: z.string().openapi({ description: "Código del punto crítico (ej. PREV-001)" }),
  nombre: z.string().openapi({ description: "Nombre del sector monitoreado" }),
  descripcion: z.string().nullable().openapi({ description: "Detalle de vulnerabilidad del sector" }),
  latitud: z.number().openapi({ description: "Latitud WGS84" }),
  longitud: z.number().openapi({ description: "Longitud WGS84" }),
  delegacionNombre: z.string().nullable().openapi({ description: "Delegación territorial" }),
});

export type PrevencionMisionResumen = z.infer<typeof PrevencionMisionResumenSchema>;

// Recursos logísticos asignados a la cuadrilla
export const RecursoAsignadoMisionSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador del recurso" }),
  nombre: z.string().openapi({ description: "Nombre o descripción del recurso o vehículo" }),
  tipo: z.string().openapi({ description: "Categoría del recurso (HERRAMIENTA, VEHICULO, EQUIPO, etc.)" }),
  cantidadAsignada: z.number().openapi({ description: "Cantidad física asignada a la cuadrilla" }),
  esIndividual: z.boolean().optional().openapi({ description: "Indica si es maquinaria/vehículo individual (true) o insumo consumible/granel (false)" }),
  unidad: z.string().nullable().optional().openapi({ description: "Unidad de medida declarada en el detalle del recurso" }),
});

export type RecursoAsignadoMision = z.infer<typeof RecursoAsignadoMisionSchema>;

// Cuadrilla operativa asignada
export const CuadrillaMisionDetalleSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID de la cuadrilla" }),
  nombre: z.string().openapi({ description: "Nombre identificador de la cuadrilla" }),
  estado: z.string().openapi({ description: "Estado operativo de la cuadrilla (DISPONIBLE, EN_MISION, NO_DISPONIBLE)" }),
  delegacionNombre: z.string().nullable().openapi({ description: "Delegación territorial base" }),
  delegado: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
    email: z.string().email(),
  }).nullable().openapi({ description: "Delegado responsable de la brigada" }),
  recursos: z.array(RecursoAsignadoMisionSchema).openapi({ description: "Inventario de recursos asignados a la cuadrilla" }),
});

export type CuadrillaMisionDetalle = z.infer<typeof CuadrillaMisionDetalleSchema>;

// Patrulla verificadora asignada
export const PatrullaMisionDetalleSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID de la patrulla" }),
  nombre: z.string().openapi({ description: "Nombre identificador de la patrulla verificadora" }),
  estado: z.string().openapi({ description: "Estado operativo (DISPONIBLE, EN_VERIFICACION, NO_DISPONIBLE)" }),
  delegacionNombre: z.string().nullable().openapi({ description: "Delegación territorial base" }),
  lider: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
    email: z.string().email(),
  }).nullable().openapi({ description: "Líder de patrulla a cargo de la evaluación primaria" }),
});

export type PatrullaMisionDetalle = z.infer<typeof PatrullaMisionDetalleSchema>;

// Estructura completa de la misión para el Detalle Exhaustivo
export const MisionDetalleCompletoSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID de la misión" }),
  codigo: z.string().openapi({ description: "Código oficial de la misión (ej. MIS-2026-001)" }),
  titulo: z.string().openapi({ description: "Título descriptivo de la misión operativa" }),
  descripcion: z.string().nullable().openapi({ description: "Instrucciones tácticas u objetivos de la misión" }),
  tipoMision: TipoMisionEnum.openapi({ description: "Clasificación de la misión" }),
  estado: EstadoMisionEnum.openapi({ description: "Estado de ejecución actual de la misión" }),
  prioridad: PrioridadMisionEnum.openapi({ description: "Nivel de prioridad o urgencia" }),
  justificacionRechazo: z.string().nullable().openapi({ description: "Motivo documentado en caso de rechazo por la cuadrilla" }),
  trazabilidadNotificacion: EstadoNotificacionMisionEnum.optional().openapi({
    description: "Estado actual de entrega y lectura de la notificación de esta misión (HU-35)",
  }),
  fechaInicio: z.string().nullable().openapi({ description: "Fecha de inicio de trabajos en terreno (ISO 8601)" }),
  fechaCierre: z.string().nullable().openapi({ description: "Fecha y hora de cierre formal de la misión (ISO 8601)" }),
  creadoEn: z.string().openapi({ description: "Fecha y hora de creación de la misión en formato ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Última fecha y hora de actualización en formato ISO 8601" }),
  creadoPor: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
    email: z.string().email(),
  }).nullable().openapi({ description: "Usuario creador / operador que despachó la misión" }),
  encargado: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
    email: z.string().email(),
  }).nullable().openapi({ description: "Encargado de operaciones asignado al monitoreo" }),
  incidente: IncidenteMisionResumenSchema.nullable().openapi({
    description: "Incidente formal atendido (null si es misión de prevención u otro origen directo)",
  }),
  prevencion: PrevencionMisionResumenSchema.nullable().openapi({
    description: "Punto crítico preventivo atendido (null si proviene de un incidente formal)",
  }),
  cuadrilla: CuadrillaMisionDetalleSchema.nullable().openapi({
    description: "Cuadrilla operativa asignada (null si fue asignada una patrulla verificadora)",
  }),
  patrulla: PatrullaMisionDetalleSchema.nullable().openapi({
    description: "Patrulla verificadora asignada (null si fue asignada una cuadrilla operativa)",
  }),
  bitacoraTiempos: z.array(MisionBitacoraHitoSchema).openapi({
    description: "Hitos cronológicos de tiempo de la misión para análisis táctico (HU-17)",
  }),
  reportesTerreno: z.array(ReporteTerrenoDetalleSchema).openapi({
    description: "Informes técnicos levantados en terreno con su respectiva evidencia multimedia (vacío si no hay reportes)",
  }),
  adjuntos: z.array(AdjuntoEvidenciaSchema).optional().openapi({
    description: "Evidencia multimedia cargada durante la misión o vinculada al incidente asociado (HU-43)",
  }),
  evaluaciones: z
    .object({
      tipologiaEvaluada: z.boolean(),
      tipologiaEvaluadaEn: z.string().nullable(),
      prioridadEvaluada: z.boolean(),
      prioridadEvaluadaEn: z.string().nullable(),
      versionReportePrioridad: z.number().int().nullable(),
      personasAfectadasPrevias: z.number().int().optional(),
      reporteVerificacionEnviado: z.boolean().optional(),
      reporteVerificacionEnviadoEn: z.string().nullable().optional(),
      dictamenVerificacion: DictamenAtencionEnum.nullable().optional(),
      reporteCuadrillaEnviado: z.boolean().optional(),
      reporteCuadrillaEnviadoEn: z.string().nullable().optional(),
    })
    .optional()
    .openapi({
      description: "Estado consolidado de evaluaciones en terreno realizadas en la misión (HU-37 / HU-38 / HU-39)",
    }),
});

export type MisionDetalleCompleto = z.infer<typeof MisionDetalleCompletoSchema>;

// Respuesta HTTP 200 para GET /api/misiones/{id}
export const MisionDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle de misión obtenido exitosamente." }),
  data: MisionDetalleCompletoSchema,
});

export type MisionDetalleResponse = z.infer<typeof MisionDetalleResponseSchema>;

// ==========================================
// HU-20: Asignación de Patrulla Verificadora a Incidente
// ==========================================

export const CrearMisionVerificacionSchema = z.object({
  incidenteId: z.string().uuid({
    message: "El identificador del incidente debe ser un UUID válido.",
  }).openapi({
    description: "Identificador único UUID del incidente a verificar",
    example: "50000000-0000-4000-8000-000000000001",
  }),
  patrullaId: z.string().uuid({
    message: "El identificador de la patrulla verificadora debe ser un UUID válido.",
  }).openapi({
    description: "Identificador único UUID de la patrulla verificadora disponible",
    example: "f1000000-0000-4000-8000-000000000001",
  }),
  tipoMision: z.literal("VERIFICACION").default("VERIFICACION").optional().openapi({
    description: "Tipo de misión operativa a despachar (fijo en VERIFICACION para evaluación preliminar)",
    example: "VERIFICACION",
  }),
  titulo: z.string().min(3, "El título debe contener al menos 3 caracteres.").max(150, "El título no puede exceder 150 caracteres.").optional().openapi({
    description: "Título descriptivo opcional para la misión de verificación",
    example: "Verificación en terreno: Aniego en Las Ánimas",
  }),
  descripcion: z.string().max(1000, "La descripción no puede exceder 1000 caracteres.").nullable().optional().openapi({
    description: "Instrucciones tácticas preliminares para la patrulla",
    example: "Evaluar anegamiento en calzada y riesgo de ingreso a viviendas.",
  }),
  prioridad: PrioridadMisionEnum.optional().openapi({
    description: "Nivel de prioridad o urgencia táctica (si se omite, hereda la del incidente)",
    example: "ALTA",
  }),
}).openapi("CrearMisionVerificacionInput");

export type CrearMisionVerificacionInput = z.infer<typeof CrearMisionVerificacionSchema>;

export const MisionCreadaResumenSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().openapi({ example: "MIS-2026-0005" }),
  titulo: z.string(),
  descripcion: z.string().nullable(),
  tipoMision: TipoMisionEnum,
  estado: EstadoMisionEnum.openapi({ example: "DESPACHADA" }),
  prioridad: PrioridadMisionEnum,
  incidenteId: z.string().uuid(),
  patrullaId: z.string().uuid().nullable().optional(),
  cuadrillaId: z.string().uuid().nullable().optional(),
  encargadoId: z.string().uuid().nullable(),
  creadoPorId: z.string().uuid().nullable().optional(),
  fechaInicio: z.string().nullable().optional(),
  creadoEn: z.string(),
}).openapi("MisionCreadaResumen");

export type MisionCreadaResumen = z.infer<typeof MisionCreadaResumenSchema>;

export const CrearMisionResponseSchema = z.object({
  message: z.string().openapi({ example: "Misión de verificación creada y patrulla despachada exitosamente." }),
  data: z.object({
    mision: MisionCreadaResumenSchema,
    incidente: z.object({
      id: z.string().uuid(),
      codigo: z.string(),
      estado: z.string(),
    }),
    patrulla: z.object({
      id: z.string().uuid(),
      nombre: z.string(),
      estado: z.string(),
    }),
    hitoInicial: z.object({
      id: z.string().uuid(),
      hito: z.string(),
      descripcion: z.string(),
      creadoEn: z.string(),
    }),
    notificacion: NotificacionMisionDetalleSchema.optional(),
  }),
}).openapi("CrearMisionResponse");

export type CrearMisionResponse = z.infer<typeof CrearMisionResponseSchema>;

// ==========================================
// HU-36: Aceptación de Misión por Patrulla Verificadora
// ==========================================

export const AceptarMisionInputSchema = z
  .object({
    latitud: z
      .number({ message: "La latitud debe ser un número válido." })
      .min(-90, "La latitud no puede ser menor a -90.")
      .max(90, "La latitud no puede ser mayor a 90.")
      .optional()
      .openapi({
        description: "Coordenada GPS opcional de latitud (WGS84) al momento de aceptar la misión desde la PWA",
        example: -39.819588,
      }),
    longitud: z
      .number({ message: "La longitud debe ser un número válido." })
      .min(-180, "La longitud no puede ser menor a -180.")
      .max(180, "La longitud no puede ser mayor a 180.")
      .optional()
      .openapi({
        description: "Coordenada GPS opcional de longitud (WGS84) al momento de aceptar la misión desde la PWA",
        example: -73.245209,
      }),
  })
  .optional()
  .refine(
    (data) => !data || (data.latitud !== undefined) === (data.longitud !== undefined),
    {
      message: "Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS.",
      path: ["longitud"],
    }
  )
  .openapi("AceptarMisionInput");

export type AceptarMisionInput = z.infer<typeof AceptarMisionInputSchema>;

export const MisionHitoRegistradoSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Identificador único UUID del hito registrado en mision_hito" }),
    misionId: z.string().uuid().openapi({ description: "Identificador único UUID de la misión" }),
    hito: z.string().openapi({ description: "Código canónico del hito", example: "MISION_ACEPTADA" }),
    descripcion: z.string().openapi({
      description: "Glosa descriptiva del hito operativo",
      example: "Misión Aceptada por Patrulla",
    }),
    registradoPorId: z.string().uuid().nullable().openapi({
      description: "UUID del funcionario de patrulla en sesión que confirmó la salida",
    }),
    latitud: z.number().nullable().openapi({ description: "Latitud reportada al momento del hito" }),
    longitud: z.number().nullable().openapi({ description: "Longitud reportada al momento del hito" }),
    creadoEn: z.string().openapi({ description: "Fecha y hora del hito en formato ISO 8601" }),
  })
  .openapi("MisionHitoRegistrado");

export type MisionHitoRegistrado = z.infer<typeof MisionHitoRegistradoSchema>;

export const AceptarMisionResponseSchema = z
  .object({
    message: z.string().openapi({
      example: "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
    }),
    data: z.object({
      mision: z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        titulo: z.string(),
        descripcion: z.string().nullable(),
        tipoMision: TipoMisionEnum,
        estado: EstadoMisionEnum.openapi({ example: "EN_CURSO" }),
        prioridad: PrioridadMisionEnum,
        incidenteId: z.string().uuid().nullable(),
        patrullaId: z.string().uuid().nullable(),
        fechaInicio: z.string().openapi({
          description: "Timestamp ISO 8601 fijado al momento de aceptar la misión",
        }),
        actualizadoEn: z.string(),
      }),
      patrulla: z
        .object({
          id: z.string().uuid(),
          nombre: z.string(),
          estado: z.string().openapi({
            description: "Se mantiene en EN_VERIFICACION durante el trayecto y evaluación",
            example: "EN_VERIFICACION",
          }),
        })
        .nullable(),
      incidente: z
        .object({
          id: z.string().uuid(),
          codigo: z.string(),
          estado: z.string().openapi({
            description: "Permanece en estado canónico VERIFICANDO (no 'En camino')",
            example: "VERIFICANDO",
          }),
        })
        .nullable(),
      hito: MisionHitoRegistradoSchema,
    }),
  })
  .openapi("AceptarMisionResponse");

export type AceptarMisionResponse = z.infer<typeof AceptarMisionResponseSchema>;

// ==========================================
// HU-21: Asignar Cuadrilla a Incidente y Liberar Patrulla
// ==========================================

export const AsignarCuadrillaMisionInputSchema = z
  .object({
    tipoMision: z
      .literal("ATENCION_CUADRILLA")
      .openapi({
        description: "Tipo de misión táctica a despachar",
        example: "ATENCION_CUADRILLA",
      }),
    incidenteId: z
      .string()
      .uuid("El identificador del incidente debe ser un UUID válido.")
      .openapi({
        description: "UUID del incidente en estado REPORTADO o VERIFICANDO a atender",
        example: "30000000-0000-4000-8000-000000000001",
      }),
    cuadrillaId: z
      .string()
      .uuid("El identificador de la cuadrilla debe ser un UUID válido.")
      .openapi({
        description: "UUID de la cuadrilla operativa disponible a despachar",
        example: "50000000-0000-4000-8000-000000000001",
      }),
    titulo: z
      .string()
      .min(3, "El título debe contener al menos 3 caracteres.")
      .max(150, "El título no puede exceder 150 caracteres.")
      .optional()
      .openapi({
        description: "Título descriptivo de la misión operativa (se autogenera si se omite)",
        example: "Atención y despeje táctico - Incidente INC-2026-001",
      }),
    descripcion: z
      .string()
      .max(1000, "La descripción no puede exceder 1000 caracteres.")
      .optional()
      .openapi({
        description: "Instrucciones tácticas u observaciones impartidas a la cuadrilla",
        example: "Despejar ramas caídas sobre tendido eléctrico en sector Las Ánimas.",
      }),
    prioridad: PrioridadMisionEnum.optional().openapi({
      description:
        "Nivel de prioridad. Si se omite, se hereda de la misión de verificación activa de la patrulla o del incidente.",
      example: "ALTA",
    }),
  })
  .openapi("AsignarCuadrillaMisionInput");

export type AsignarCuadrillaMisionInput = z.infer<typeof AsignarCuadrillaMisionInputSchema>;

export const PatrullaLiberadaSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string(),
    estado: z.string().openapi({ example: "DISPONIBLE" }),
    misionPreviaId: z.string().uuid().nullable().optional(),
  })
  .openapi("PatrullaLiberada");

export type PatrullaLiberada = z.infer<typeof PatrullaLiberadaSchema>;

export const AsignarCuadrillaMisionResponseSchema = z
  .object({
    message: z.string().openapi({
      example: "Cuadrilla asignada y despachada exitosamente al incidente. Patrulla verificadora liberada.",
    }),
    data: z.object({
      mision: MisionCreadaResumenSchema,
      cuadrilla: z.object({
        id: z.string().uuid(),
        nombre: z.string(),
        estado: z.string().openapi({ example: "EN_MISION" }),
        delegacionId: z.string().uuid().nullable().optional(),
      }),
      incidente: z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        estado: z.string().openapi({ example: "EN_ATENCION" }),
        prioridad: z.string(),
      }),
      patrullaLiberada: PatrullaLiberadaSchema.nullable().openapi({
        description: "Datos de la patrulla verificadora previa que fue liberada automáticamente (null si no había patrulla)",
      }),
      hitoCuadrilla: z.object({
        id: z.string().uuid(),
        misionId: z.string().uuid(),
        hito: z.string().openapi({ example: "CUADRILLA_DESPACHADA" }),
        descripcion: z.string(),
        creadoEn: z.string(),
      }),
      hitoPatrulla: z
        .object({
          id: z.string().uuid(),
          misionId: z.string().uuid(),
          hito: z.string().openapi({ example: "VERIFICACION_FINALIZADA" }),
          descripcion: z.string(),
          creadoEn: z.string(),
        })
        .nullable()
        .optional(),
    }),
  })
  .openapi("AsignarCuadrillaMisionResponse");

export type AsignarCuadrillaMisionResponse = z.infer<typeof AsignarCuadrillaMisionResponseSchema>;

// ==========================================
// HU-69 / HU-41: Rechazo de Misión por Patrulla Verificadora o Cuadrilla (Regla §3.3)
// ==========================================

export const RechazarMisionBodySchema = z
  .object({
    justificacion_rechazo: z
      .string()
      .trim()
      .min(5, "El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres.")
      .openapi({
        description:
          "Justificación técnica obligatoria del rechazo de la misión (mínimo 5 caracteres según Regla §3.3)",
        example: "Camión tolva presenta falla hidráulica en ruta de salida desde base.",
      }),
    latitud: z
      .number({ message: "La latitud debe ser un número válido." })
      .finite("La latitud debe ser un número finito.")
      .min(-90, "La latitud debe estar entre -90 y 90.")
      .max(90, "La latitud debe estar entre -90 y 90.")
      .optional()
      .openapi({
        description: "Latitud WGS84 opcional de la unidad al momento del rechazo (-90 a 90)",
        example: -39.81422,
      }),
    longitud: z
      .number({ message: "La longitud debe ser un número válido." })
      .finite("La longitud debe ser un número finito.")
      .min(-180, "La longitud debe estar entre -180 y 180.")
      .max(180, "La longitud debe estar entre -180 y 180.")
      .optional()
      .openapi({
        description: "Longitud WGS84 opcional de la unidad al momento del rechazo (-180 a 180)",
        example: -73.24589,
      }),
  })
  .openapi("RechazarMisionBody");

export const RechazarMisionInputSchema = z
  .object({
    justificacion_rechazo: z.string().optional(),
    justificacionRechazo: z.string().optional(),
    latitud: z
      .number({ message: "La latitud debe ser un número válido." })
      .finite("La latitud debe ser un número finito.")
      .min(-90, "La latitud debe estar entre -90 y 90.")
      .max(90, "La latitud debe estar entre -90 y 90.")
      .optional(),
    longitud: z
      .number({ message: "La longitud debe ser un número válido." })
      .finite("La longitud debe ser un número finito.")
      .min(-180, "La longitud debe estar entre -180 y 180.")
      .max(180, "La longitud debe estar entre -180 y 180.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const motivo = (data.justificacion_rechazo ?? data.justificacionRechazo ?? "").trim();
    if (motivo.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El motivo de rechazo (justificacion_rechazo) debe contener al menos 5 caracteres.",
        path: ["justificacion_rechazo"],
      });
    }
    if ((data.latitud !== undefined) !== (data.longitud !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS.",
        path: ["longitud"],
      });
    }
  })
  .transform((data) => ({
    justificacionRechazo: (data.justificacion_rechazo ?? data.justificacionRechazo ?? "").trim(),
    latitud: data.latitud,
    longitud: data.longitud,
  }));

export type RechazarMisionInput = {
  justificacionRechazo: string;
  latitud?: number;
  longitud?: number;
};

export const RechazarMisionResponseSchema = z
  .object({
    message: z.string().openapi({
      example:
        "Misión rechazada exitosamente. La unidad ha vuelto a estado DISPONIBLE y el incidente ha retornado para su reasignación.",
    }),
    data: z.object({
      mision: z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        tipoMision: TipoMisionEnum.optional(),
        estado: EstadoMisionEnum.openapi({ example: "RECHAZADA" }),
        justificacionRechazo: z.string(),
        fechaCierre: z.string().optional(),
        actualizadoEn: z.string(),
      }),
      patrulla: z
        .object({
          id: z.string().uuid(),
          nombre: z.string(),
          estado: z.string().openapi({ example: "DISPONIBLE" }),
          delegacionId: z.string().uuid().nullable().optional(),
          usuarioLiderId: z.string().uuid().nullable().optional(),
        })
        .nullable()
        .optional(),
      cuadrilla: z
        .object({
          id: z.string().uuid(),
          nombre: z.string(),
          estado: z.string().openapi({ example: "DISPONIBLE" }),
          delegacionId: z.string().uuid().nullable().optional(),
          usuarioDelegadoId: z.string().uuid().nullable().optional(),
        })
        .nullable()
        .optional(),
      incidente: z
        .object({
          id: z.string().uuid(),
          codigo: z.string(),
          estado: z.string().openapi({ example: "VERIFICANDO" }),
          prioridad: z.string().optional(),
        })
        .nullable(),
      hito: z.object({
        id: z.string().uuid(),
        misionId: z.string().uuid().optional(),
        hito: z.string(),
        descripcion: z.string(),
        registradoPorId: z.string().uuid().nullable().optional(),
        latitud: z.number().nullable().optional(),
        longitud: z.number().nullable().optional(),
        creadoEn: z.string(),
      }),
    }),
  })
  .openapi("RechazarMisionResponse");

export type RechazarMisionResponse = z.infer<typeof RechazarMisionResponseSchema>;

// ==========================================
// HU-39: Informe Técnico de Verificación en Terreno y Cierre de Misión
// ==========================================

/**
 * Sección preparada para integración con subida de evidencia fotográfica (HU-43).
 */
export const AdjuntoReporteInputSchema = z
  .object({
    id: z.string().uuid("El identificador del adjunto debe ser un UUID válido.").optional(),
    nombreArchivo: z.string().max(255).optional(),
    nombre_archivo: z.string().max(255).optional(),
    url: z.string().max(500).optional(),
    tipoMime: z.string().max(100).optional(),
    tipo_mime: z.string().max(100).optional(),
    tamanoBytes: z.number().int().nonnegative().optional(),
    tamano_bytes: z.number().int().nonnegative().optional(),
  })
  .openapi("AdjuntoReporteInput");

export type AdjuntoReporteInput = z.infer<typeof AdjuntoReporteInputSchema>;

export const CrearReporteVerificacionInputSchema = z
  .object({
    dictamen: DictamenAtencionEnum.optional().openapi({
      description: "Dictamen operativo de verificación en terreno: 'REQUIERE_CUADRILLA' o 'NO_ABORDABLE'",
      example: "REQUIERE_CUADRILLA",
    }),
    dictamenAtencion: DictamenAtencionEnum.optional(),
    dictamen_atencion: DictamenAtencionEnum.optional(),
    motivoNoAbordable: z
      .string()
      .max(2000, "El motivo de no abordabilidad no puede exceder los 2000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description:
          "Motivo técnico obligatorio (mínimo 15 caracteres) cuando el dictamen es NO_ABORDABLE (predio privado inaccesible, faja fiscal externa o falsa alarma)",
        example:
          "Emergencia emplazada dentro de predio privado cercado sin autorización de ingreso ni riesgo para vía pública.",
      }),
    motivo_no_abordable: z
      .string()
      .max(2000, "El motivo de no abordabilidad no puede exceder los 2000 caracteres.")
      .nullable()
      .optional(),
    resumenTecnico: z
      .string()
      .max(2000, "El resumen técnico no puede exceder los 2000 caracteres.")
      .optional()
      .openapi({
        description: "Resumen técnico consolidado del siniestro constatado en terreno (obligatorio, mínimo 10 caracteres)",
        example:
          "Se constata obstrucción completa de sumidero y socavón en berma norte; requiere cuadrilla vial con motobomba.",
      }),
    resumen_tecnico: z
      .string()
      .max(2000, "El resumen técnico no puede exceder los 2000 caracteres.")
      .optional(),
    estadoTerreno: z
      .string()
      .trim()
      .min(1, "El estado del terreno no puede estar vacío.")
      .max(50, "El estado del terreno no puede exceder los 50 caracteres.")
      .optional()
      .openapi({
        description: "Estado operativo constatado del terreno (ej. CRITICO, ESTABLE, INACCESIBLE, CONTROLADO, FINALIZADO)",
        example: "CRITICO",
      }),
    estado_terreno: z
      .string()
      .trim()
      .min(1, "El estado del terreno no puede estar vacío.")
      .max(50, "El estado del terreno no puede exceder los 50 caracteres.")
      .optional(),
    personasAfectadas: z
      .number({ message: "La cantidad de personas afectadas debe ser un número entero." })
      .int("La cantidad de personas afectadas debe ser un número entero.")
      .min(0, "La cantidad de personas afectadas no puede ser negativa.")
      .max(5000, "La cantidad de personas afectadas excede el máximo permitido.")
      .optional()
      .openapi({
        description:
          "Estimación de personas damnificadas. Si se omite, se rescata automáticamente del reporte de prioridad previo (HU-38); si se envía, permite confirmar o rectificar dicho conteo.",
        example: 4,
      }),
    personas_afectadas: z
      .number({ message: "La cantidad de personas afectadas debe ser un número entero." })
      .int("La cantidad de personas afectadas debe ser un número entero.")
      .min(0, "La cantidad de personas afectadas no puede ser negativa.")
      .max(5000, "La cantidad de personas afectadas excede el máximo permitido.")
      .optional(),
    danosEstimados: z
      .string()
      .max(2000, "Los daños estimados no pueden exceder los 2000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Descripción o estimación cuantitativa/cualitativa de daños materiales observados",
        example: "Anegamiento de primer nivel en 2 viviendas y daño en cerco perimetral.",
      }),
    danos_estimados: z
      .string()
      .max(2000, "Los daños estimados no pueden exceder los 2000 caracteres.")
      .nullable()
      .optional(),
    observaciones: z
      .string()
      .max(2000, "Las observaciones no pueden exceder los 2000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Observaciones generales, condiciones de acceso o seguridad en terreno",
        example: "Acceso despejado para camión aljibe por calle paralela.",
      }),
    accionesRealizadas: z
      .string()
      .max(1000, "Las acciones realizadas no pueden exceder los 1000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Maniobras preliminares de contención o señalización realizadas por la patrulla",
        example: "Instalación de conos preventivos y entrevista con vecinos afectados.",
      }),
    acciones_realizadas: z
      .string()
      .max(1000, "Las acciones realizadas no pueden exceder los 1000 caracteres.")
      .nullable()
      .optional(),
    requiereAsistenciaSocial: z
      .boolean()
      .optional()
      .openapi({
        description: "Casilla de verificación que indica si requiere derivación a Asistente Social para Ficha FIBE (trasladada desde HU-38)",
        example: true,
      }),
    requiere_asistencia_social: z.boolean().optional(),
    familias: z
      .array(FamiliaAfectadaInputSchema)
      .optional()
      .openapi({
        description:
          "Desglose preliminar por familia u hogar afectado. Cuando requiere_asistencia_social es true, se exige al menos 1 familia coherente con nombre y teléfono de contacto preliminares (no constituye una FIBE).",
      }),
    adjuntoIds: z
      .array(z.string().uuid("Cada identificador de adjunto debe ser un UUID válido."))
      .max(20, "No se pueden vincular más de 20 adjuntos por reporte.")
      .optional()
      .openapi({
        description: "Listado opcional de UUIDs de evidencias fotográficas previamente cargadas (integración preparada para HU-43)",
      }),
    adjunto_ids: z
      .array(z.string().uuid("Cada identificador de adjunto debe ser un UUID válido."))
      .max(20)
      .optional(),
    adjuntos: z
      .array(AdjuntoReporteInputSchema)
      .max(20, "No se pueden adjuntar más de 20 archivos por reporte.")
      .optional()
      .openapi({
        description: "Metadatos opcionales de fotografías de evidencia técnica (sección reservada para integración con HU-43)",
      }),
    latitud: z
      .number({ message: "La latitud debe ser un número válido." })
      .finite("La latitud debe ser un número finito válido.")
      .min(-90, "La latitud no puede ser menor a -90.")
      .max(90, "La latitud no puede ser mayor a 90.")
      .optional()
      .openapi({
        description: "Coordenada GPS opcional de latitud (WGS84) al cerrar la verificación",
        example: -39.819588,
      }),
    longitud: z
      .number({ message: "La longitud debe ser un número válido." })
      .finite("La longitud debe ser un número finito válido.")
      .min(-180, "La longitud no puede ser menor a -180.")
      .max(180, "La longitud no puede ser mayor a 180.")
      .optional()
      .openapi({
        description: "Coordenada GPS opcional de longitud (WGS84) al cerrar la verificación",
        example: -73.245209,
      }),
  })
  .superRefine((data, ctx) => {
    const dictamen =
      data.dictamen ?? data.dictamenAtencion ?? data.dictamen_atencion;

    if (!dictamen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dictamen"],
        message:
          "Debe seleccionar el dictamen de atención operativa ('REQUIERE_CUADRILLA' o 'NO_ABORDABLE').",
      });
    }

    const resumenRaw = data.resumenTecnico ?? data.resumen_tecnico;
    const resumenLimpio = typeof resumenRaw === "string" ? resumenRaw.trim() : "";
    if (resumenLimpio.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resumen_tecnico"],
        message:
          "El resumen técnico del siniestro es obligatorio y debe contener al menos 10 caracteres.",
      });
    }

    const motivoRaw = data.motivoNoAbordable ?? data.motivo_no_abordable;
    const motivoLimpio = typeof motivoRaw === "string" ? motivoRaw.trim() : "";
    if (dictamen === "NO_ABORDABLE" && motivoLimpio.length < 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["motivo_no_abordable"],
        message:
          "Cuando el dictamen es 'NO_ABORDABLE', el campo 'motivo_no_abordable' es obligatorio y debe contener al menos 15 caracteres.",
      });
    }

    const requiereAsistenciaSocial = Boolean(
      data.requiereAsistenciaSocial ?? data.requiere_asistencia_social ?? false
    );
    if (requiereAsistenciaSocial) {
      validarContactosFamiliasFibe(
        data.familias as Array<Record<string, unknown>> | undefined,
        ctx,
        ["familias"]
      );
    } else if (Array.isArray(data.familias) && data.familias.length > 0) {
      data.familias.forEach((fam, idx) => {
        validarCoherenciaFamilia(
          fam as Record<string, unknown>,
          ctx,
          ["familias", idx],
          { minimoIntegrantes: 0, validarRutSiExiste: true }
        );
      });
    }
  })
  .openapi("CrearReporteVerificacionInput");

export type CrearReporteVerificacionInput = z.infer<typeof CrearReporteVerificacionInputSchema>;

export const EnviarReporteVerificacionResponseSchema = z
  .object({
    message: z.string().openapi({
      example:
        "Informe técnico de verificación registrado y misión cerrada exitosamente.",
    }),
    data: z.object({
      reporteTerreno: ReporteTerrenoDetalleSchema,
      mision: z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        titulo: z.string(),
        tipoMision: TipoMisionEnum,
        estado: EstadoMisionEnum.openapi({ example: "COMPLETADA" }),
        prioridad: PrioridadMisionEnum,
        incidenteId: z.string().uuid().nullable(),
        patrullaId: z.string().uuid().nullable(),
        fechaInicio: z.string().nullable(),
        fechaCierre: z.string(),
        actualizadoEn: z.string(),
      }),
      patrulla: z
        .object({
          id: z.string().uuid(),
          nombre: z.string(),
          estado: z.string().openapi({ example: "DISPONIBLE" }),
        })
        .nullable(),
      incidente: z
        .object({
          id: z.string().uuid(),
          codigo: z.string(),
          estado: z.string().openapi({ example: "VERIFICANDO" }),
          prioridad: z.string(),
          requiereAsistenciaSocial: z.boolean(),
          fechaCierre: z.string().nullable(),
          motivoNoAbordable: z.string().nullable(),
        })
        .nullable(),
      hito: MisionHitoRegistradoSchema.extend({
        metadatos: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    }),
  })
  .openapi("EnviarReporteVerificacionResponse");

export type EnviarReporteVerificacionResponse = z.infer<
  typeof EnviarReporteVerificacionResponseSchema
>;

// ==========================================
// HU-68: Informe Técnico Final y Cierre de Misión de Cuadrilla
// ==========================================

export const CerrarMisionCuadrillaBodySchema = z
  .object({
    resumen_faenas: z
      .string({ message: "El resumen de faenas ejecutadas es obligatorio." })
      .trim()
      .min(15, "El resumen de faenas ejecutadas debe contener al menos 15 caracteres.")
      .max(2000, "El resumen de faenas ejecutadas no puede exceder los 2000 caracteres.")
      .openapi({
        description: "Resumen técnico de las faenas ejecutadas en terreno (obligatorio, mínimo 15 caracteres)",
        example:
          "Despeje completo de alcantarilla obstruida, extracción de sedimentos e instalación de barrera de sacos de arena.",
      }),
    materiales_consumidos: z
      .array(MaterialConsumidoBodySchema)
      .max(50, "No se pueden reportar más de 50 ítems de materiales consumidos en un mismo cierre.")
      .optional()
      .default([])
      .openapi({
        description: "Listado de materiales e insumos consumidos con desglose de cantidades",
      }),
    horas_hombre: z
      .number({ message: "Las horas hombre invertidas son obligatorias y deben ser un número válido." })
      .finite("Las horas hombre invertidas deben ser un número finito.")
      .positive("Las horas hombre invertidas deben ser mayores a 0.")
      .max(1000, "Las horas hombre invertidas no pueden exceder las 1000 horas.")
      .openapi({
        description: "Horas hombre totales invertidas por la cuadrilla en la faena (admite decimales)",
        example: 6.5,
      }),
    estado_terreno: EstadoTerrenoCierreEnum.openapi({
      description: "Evaluación del estado final del terreno al culminar los trabajos",
      example: "CONTROLADO",
    }),
    observaciones: z
      .string()
      .max(2000, "Las observaciones no pueden exceder los 2000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Observaciones adicionales de terreno o recomendaciones post-intervención",
        example: "Calzada habilitada al tránsito; se sugiere limpieza preventiva de cámara aguas arriba.",
      }),
    danos_estimados: z
      .string()
      .max(2000, "Los daños estimados no pueden exceder los 2000 caracteres.")
      .nullable()
      .optional()
      .openapi({
        description: "Detalle de daños remanentes constatados tras la faena",
        example: "Solera poniente con desgaste superficial sin riesgo estructural.",
      }),
    requiere_apoyo_adicional: z
      .boolean()
      .optional()
      .default(false)
      .openapi({
        description: "Indica si el punto requiere apoyo posterior o seguimiento logístico adicional",
        example: false,
      }),
    requiere_asistencia_social: z
      .boolean()
      .optional()
      .default(false)
      .openapi({
        description: "Indica si durante los trabajos se detectó vulnerabilidad social que requiera Ficha FIBE",
        example: false,
      }),
    personas_afectadas: z
      .number({ message: "La cantidad de personas afectadas debe ser un número entero." })
      .int("La cantidad de personas afectadas debe ser un número entero.")
      .min(0, "La cantidad de personas afectadas no puede ser negativa.")
      .max(5000, "La cantidad de personas afectadas excede el máximo permitido.")
      .optional()
      .openapi({
        description:
          "Cantidad de personas afectadas constatadas o actualizadas al cerrar la misión de cuadrilla (opcional; si se omite hereda reportes previos del incidente)",
        example: 4,
      }),
    familias: z
      .array(FamiliaAfectadaInputSchema)
      .optional()
      .openapi({
        description:
          "Desglose preliminar opcional por familia afectada para derivación social DGRD / FIBE",
      }),
    adjunto_ids: z
      .array(z.string().uuid("Cada identificador de adjunto debe ser un UUID válido."))
      .max(20, "No se pueden vincular más de 20 adjuntos por informe.")
      .optional()
      .openapi({
        description: "Listado opcional de UUIDs de evidencias multimedia cargadas vía POST /api/evidencia/adjuntos",
      }),
    adjuntos: z
      .array(AdjuntoReporteInputSchema)
      .max(20, "No se pueden adjuntar más de 20 archivos por informe.")
      .optional()
      .openapi({
        description: "Metadatos opcionales de archivos multimedia asociados al informe técnico final",
      }),
    latitud: z
      .number({ message: "La latitud debe ser un número válido." })
      .finite("La latitud debe ser un número finito.")
      .min(-90, "La latitud debe estar entre -90 y 90.")
      .max(90, "La latitud debe estar entre -90 y 90.")
      .optional()
      .openapi({
        description: "Coordenada GPS opcional de latitud (WGS84) al cerrar la misión",
        example: -39.819588,
      }),
    longitud: z
      .number({ message: "La longitud debe ser un número válido." })
      .finite("La longitud debe ser un número finito.")
      .min(-180, "La longitud debe estar entre -180 y 180.")
      .max(180, "La longitud debe estar entre -180 y 180.")
      .optional()
      .openapi({
        description: "Coordenada GPS opcional de longitud (WGS84) al cerrar la misión",
        example: -73.245209,
      }),
  })
  .openapi("CerrarMisionCuadrillaBody");

export type CerrarMisionCuadrillaBody = z.infer<typeof CerrarMisionCuadrillaBodySchema>;

const MaterialConsumidoInputRawSchema = z.object({
  recurso_id: z.string().optional(),
  recursoId: z.string().optional(),
  cantidad: z.unknown().optional(),
  unidad: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
});

export type MaterialConsumidoInput = {
  recursoId: string;
  cantidad: number;
  unidad?: string | null;
  observacion?: string | null;
};

export type CerrarMisionCuadrillaInput = {
  resumenFaenas: string;
  materialesConsumidos: MaterialConsumidoInput[];
  horasHombre: number;
  estadoTerreno: z.infer<typeof EstadoTerrenoCierreEnum>;
  observaciones: string | null;
  danosEstimados: string | null;
  requiereApoyoAdicional: boolean;
  requiereAsistenciaSocial: boolean;
  personasAfectadas?: number;
  familias?: Array<z.infer<typeof FamiliaAfectadaInputSchema>>;
  adjuntoIds: string[];
  adjuntos: AdjuntoReporteInput[];
  latitud?: number;
  longitud?: number;
};

const uuidV4OrGenericSchema = z.string().uuid();

export const CerrarMisionCuadrillaInputSchema = z
  .object({
    resumen_faenas: z.unknown().optional(),
    resumenFaenas: z.unknown().optional(),
    materiales_consumidos: z.array(MaterialConsumidoInputRawSchema).max(50, "No se pueden reportar más de 50 ítems de materiales consumidos.").optional(),
    materialesConsumidos: z.array(MaterialConsumidoInputRawSchema).max(50, "No se pueden reportar más de 50 ítems de materiales consumidos.").optional(),
    horas_hombre: z.unknown().optional(),
    horasHombre: z.unknown().optional(),
    estado_terreno: z.unknown().optional(),
    estadoTerreno: z.unknown().optional(),
    observaciones: z.string().max(2000, "Las observaciones no pueden exceder los 2000 caracteres.").nullable().optional(),
    danos_estimados: z.string().max(2000, "Los daños estimados no pueden exceder los 2000 caracteres.").nullable().optional(),
    danosEstimados: z.string().max(2000, "Los daños estimados no pueden exceder los 2000 caracteres.").nullable().optional(),
    requiere_apoyo_adicional: z.boolean().optional(),
    requiereApoyoAdicional: z.boolean().optional(),
    requiere_asistencia_social: z.boolean().optional(),
    requiereAsistenciaSocial: z.boolean().optional(),
    personas_afectadas: z
      .number({ message: "La cantidad de personas afectadas debe ser un número entero." })
      .int("La cantidad de personas afectadas debe ser un número entero.")
      .min(0, "La cantidad de personas afectadas no puede ser negativa.")
      .max(5000, "La cantidad de personas afectadas excede el máximo permitido.")
      .optional(),
    personasAfectadas: z
      .number({ message: "La cantidad de personas afectadas debe ser un número entero." })
      .int("La cantidad de personas afectadas debe ser un número entero.")
      .min(0, "La cantidad de personas afectadas no puede ser negativa.")
      .max(5000, "La cantidad de personas afectadas excede el máximo permitido.")
      .optional(),
    familias: z.array(FamiliaAfectadaInputSchema).optional(),
    adjunto_ids: z.array(z.string().uuid("Cada identificador de adjunto debe ser un UUID válido.")).max(20, "No se pueden vincular más de 20 adjuntos por informe.").optional(),
    adjuntoIds: z.array(z.string().uuid("Cada identificador de adjunto debe ser un UUID válido.")).max(20, "No se pueden vincular más de 20 adjuntos por informe.").optional(),
    adjuntos: z.array(AdjuntoReporteInputSchema).max(20, "No se pueden adjuntar más de 20 archivos por informe.").optional(),
    latitud: z
      .number({ message: "La latitud debe ser un número válido." })
      .finite("La latitud debe ser un número finito válido.")
      .min(-90, "La latitud debe estar entre -90 y 90.")
      .max(90, "La latitud debe estar entre -90 y 90.")
      .optional(),
    longitud: z
      .number({ message: "La longitud debe ser un número válido." })
      .finite("La longitud debe ser un número finito válido.")
      .min(-180, "La longitud debe estar entre -180 y 180.")
      .max(180, "La longitud debe estar entre -180 y 180.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Validar resumen_faenas (obligatorio, mín. 15 caracteres útiles)
    const resumenRaw = data.resumen_faenas ?? data.resumenFaenas;
    if (typeof resumenRaw !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resumen_faenas"],
        message: "El resumen de faenas ejecutadas es obligatorio y debe contener al menos 15 caracteres.",
      });
    } else {
      const resumenLimpio = resumenRaw.trim();
      if (resumenLimpio.length < 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resumen_faenas"],
          message: "El resumen de faenas ejecutadas es obligatorio y debe contener al menos 15 caracteres.",
        });
      } else if (resumenLimpio.length > 2000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resumen_faenas"],
          message: "El resumen de faenas ejecutadas no puede exceder los 2000 caracteres.",
        });
      }
    }

    // 2. Validar horas_hombre (obligatorio, finito, > 0 y <= 1000)
    const horasRaw = data.horas_hombre ?? data.horasHombre;
    if (typeof horasRaw !== "number" || !Number.isFinite(horasRaw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["horas_hombre"],
        message: "Las horas hombre invertidas son obligatorias y deben ser un número válido.",
      });
    } else if (horasRaw <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["horas_hombre"],
        message: "Las horas hombre invertidas deben ser mayores a 0.",
      });
    } else if (horasRaw > 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["horas_hombre"],
        message: "Las horas hombre invertidas no pueden exceder las 1000 horas.",
      });
    }

    // 3. Validar estado_terreno (obligatorio dentro de EstadoTerrenoCierreEnum)
    const estadoRaw = data.estado_terreno ?? data.estadoTerreno;
    const estadoVal = EstadoTerrenoCierreEnum.safeParse(estadoRaw);
    if (!estadoVal.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estado_terreno"],
        message:
          "Debe seleccionar una evaluación válida para el estado final del terreno (CONTROLADO, ESTABLE, FINALIZADO, REQUIERE_SEGUIMIENTO, CRITICO o INACCESIBLE).",
      });
    }

    // 4. Validar materiales_consumidos y prohibir recurso_id duplicados
    const materialesRaw = data.materiales_consumidos ?? data.materialesConsumidos ?? [];
    const recursosVistos = new Set<string>();
    materialesRaw.forEach((item, idx) => {
      const recursoId = (item.recurso_id ?? item.recursoId ?? "").trim();
      if (!uuidV4OrGenericSchema.safeParse(recursoId).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["materiales_consumidos", idx, "recurso_id"],
          message: "Cada material consumido debe indicar un UUID de recurso válido.",
        });
      } else if (recursosVistos.has(recursoId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["materiales_consumidos", idx, "recurso_id"],
          message: "No se permiten recursos duplicados en el listado de materiales consumidos.",
        });
      } else {
        recursosVistos.add(recursoId);
      }

      if (
        typeof item.cantidad !== "number" ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad < 1
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["materiales_consumidos", idx, "cantidad"],
          message: "La cantidad consumida debe ser un número entero mayor o igual a 1.",
        });
      }

      if (typeof item.unidad === "string" && item.unidad.trim().length > 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["materiales_consumidos", idx, "unidad"],
          message: "La unidad de medida no puede exceder los 50 caracteres.",
        });
      }

      if (typeof item.observacion === "string" && item.observacion.trim().length > 300) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["materiales_consumidos", idx, "observacion"],
          message: "La observación del material no puede exceder los 300 caracteres.",
        });
      }
    });

    // 5. Paridad estricta de coordenadas GPS
    if ((data.latitud !== undefined) !== (data.longitud !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["longitud"],
        message: "Debe proporcionar tanto latitud como longitud si incluye coordenadas GPS.",
      });
    }

    // 6. Coherencia demográfica opcional de familias afectadas (HU-25 / H39)
    if (Array.isArray(data.familias) && data.familias.length > 0) {
      data.familias.forEach((fam, idx) => {
        validarCoherenciaFamilia(
          fam as Record<string, unknown>,
          ctx,
          ["familias", idx],
          { minimoIntegrantes: 0, validarRutSiExiste: true }
        );
      });
    }
  })
  .transform((data): CerrarMisionCuadrillaInput => {
    const resumenFaenas = String(data.resumen_faenas ?? data.resumenFaenas ?? "").trim();
    const horasNum = Number(data.horas_hombre ?? data.horasHombre);
    const horasHombre = Math.round(horasNum * 100) / 100;
    const estadoTerreno = (data.estado_terreno ??
      data.estadoTerreno) as z.infer<typeof EstadoTerrenoCierreEnum>;
    const materialesRaw = data.materiales_consumidos ?? data.materialesConsumidos ?? [];
    const materialesConsumidos: MaterialConsumidoInput[] = materialesRaw.map((item) => ({
      recursoId: String(item.recurso_id ?? item.recursoId).trim(),
      cantidad: Number(item.cantidad),
      unidad: typeof item.unidad === "string" && item.unidad.trim() ? item.unidad.trim() : null,
      observacion:
        typeof item.observacion === "string" && item.observacion.trim()
          ? item.observacion.trim()
          : null,
    }));

    const obsRaw = data.observaciones;
    const observaciones =
      typeof obsRaw === "string" && obsRaw.trim().length > 0 ? obsRaw.trim() : null;
    const danosRaw = data.danos_estimados ?? data.danosEstimados;
    const danosEstimados =
      typeof danosRaw === "string" && danosRaw.trim().length > 0 ? danosRaw.trim() : null;
    const personasAfectadas = data.personas_afectadas ?? data.personasAfectadas;

    return {
      resumenFaenas,
      materialesConsumidos,
      horasHombre,
      estadoTerreno,
      observaciones,
      danosEstimados,
      requiereApoyoAdicional: Boolean(
        data.requiere_apoyo_adicional ?? data.requiereApoyoAdicional ?? false
      ),
      requiereAsistenciaSocial: Boolean(
        data.requiere_asistencia_social ?? data.requiereAsistenciaSocial ?? false
      ),
      ...(personasAfectadas !== undefined ? { personasAfectadas } : {}),
      ...(Array.isArray(data.familias) ? { familias: data.familias } : {}),
      adjuntoIds: data.adjunto_ids ?? data.adjuntoIds ?? [],
      adjuntos: data.adjuntos ?? [],
      latitud: data.latitud,
      longitud: data.longitud,
    };
  });

export const RecursoConsumidoActualizadoSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string(),
    cantidadConsumida: z.number().int().min(1),
    cantidadInventarioAnterior: z.number().int().nonnegative(),
    cantidadInventarioActual: z.number().int().nonnegative(),
    cantidadEnUsoActual: z.number().int().nonnegative(),
    estado: z.string(),
  })
  .openapi("RecursoConsumidoActualizado");

export type RecursoConsumidoActualizado = z.infer<
  typeof RecursoConsumidoActualizadoSchema
>;

export const CerrarMisionCuadrillaResponseSchema = z
  .object({
    message: z.string().openapi({
      example:
        "Informe técnico final registrado, misión cerrada y cuadrilla disponible exitosamente.",
    }),
    data: z.object({
      reporteTerreno: ReporteTerrenoDetalleSchema,
      mision: z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        titulo: z.string(),
        tipoMision: TipoMisionEnum,
        estado: EstadoMisionEnum.openapi({ example: "COMPLETADA" }),
        prioridad: PrioridadMisionEnum,
        incidenteId: z.string().uuid().nullable(),
        cuadrillaId: z.string().uuid().nullable(),
        fechaInicio: z.string().nullable(),
        fechaCierre: z.string(),
        actualizadoEn: z.string(),
      }),
      cuadrilla: z.object({
        id: z.string().uuid(),
        nombre: z.string(),
        estado: z.string().openapi({ example: "DISPONIBLE" }),
        delegacionId: z.string().uuid().nullable().optional(),
      }),
      incidente: z
        .object({
          id: z.string().uuid(),
          codigo: z.string(),
          estado: z.string().openapi({ example: "EN_ATENCION" }),
          prioridad: z.string(),
          requiereAsistenciaSocial: z.boolean(),
        })
        .nullable(),
      recursosActualizados: z.array(RecursoConsumidoActualizadoSchema),
      hito: MisionHitoRegistradoSchema.extend({
        metadatos: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    }),
  })
  .openapi("CerrarMisionCuadrillaResponse");

export type CerrarMisionCuadrillaResponse = z.infer<
  typeof CerrarMisionCuadrillaResponseSchema
>;
