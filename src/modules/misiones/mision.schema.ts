import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

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
  evaluador: EvaluadorTerrenoSchema.openapi({ description: "Datos del funcionario o patrullero que emitió el reporte" }),
  resumenTecnico: z.string().openapi({ description: "Diagnóstico técnico consolidado de la intervención" }),
  accionesRealizadas: z.string().nullable().openapi({ description: "Labores y maniobras ejecutadas en terreno" }),
  requiereApoyoAdicional: z.boolean().openapi({ description: "Indica si se requiere escalamiento logístico o relevo" }),
  danosEstimados: z.string().nullable().openapi({ description: "Descripción o estimación preliminar de daños observados" }),
  observaciones: z.string().nullable().openapi({ description: "Observaciones de seguridad o condiciones de terreno" }),
  personasAfectadas: z.number().openapi({ description: "Cantidad estimada de personas o familias afectadas" }),
  estadoTerreno: z.string().openapi({ description: "Estado operativo al momento del reporte (ej. FINALIZADO, EN_CURSO)" }),
  adjuntos: z.array(AdjuntoEvidenciaSchema).openapi({
    description: "Fotografías, videos o documentos levantados como evidencia en terreno",
  }),
  creadoEn: z.string().openapi({ description: "Fecha y hora del levantamiento del reporte en formato ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha y hora de última modificación en formato ISO 8601" }),
});

export type ReporteTerrenoDetalle = z.infer<typeof ReporteTerrenoDetalleSchema>;

// Bitácora de tiempos simplificada (Opción 1 - HU-17 / Hito previo a H23)
export const MisionBitacoraHitoSchema = z.object({
  hito: z.string().openapi({ description: "Hito temporal de la misión", example: "PLANIFICACION" }),
  fecha: z.string().openapi({ description: "Fecha del hito en formato YYYY-MM-DD", example: "2026-10-02" }),
  hora: z.string().openapi({ description: "Hora del hito en formato HH:MM:SS", example: "14:30:00" }),
  timestamp: z.string().openapi({ description: "Timestamp completo ISO 8601" }),
  descripcion: z.string().openapi({ description: "Glosa descriptiva del hito operativo" }),
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
  requiereAsistenciaSocial: z.boolean().openapi({ description: "Requiere derivación social / ficha FIBE" }),
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
  fechaInicio: z.string().nullable().openapi({ description: "Fecha y hora de despliegue o inicio en terreno (ISO 8601)" }),
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
});

export type MisionDetalleCompleto = z.infer<typeof MisionDetalleCompletoSchema>;

// Respuesta HTTP 200 para GET /api/misiones/{id}
export const MisionDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle de misión obtenido exitosamente." }),
  data: MisionDetalleCompletoSchema,
});

export type MisionDetalleResponse = z.infer<typeof MisionDetalleResponseSchema>;

// Input para POST /api/misiones (HU-20: Asignación de Patrulla Verificadora a Incidente)
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
});

export type CrearMisionVerificacionInput = z.infer<typeof CrearMisionVerificacionSchema>;

export const MisionCreadaResumenSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  titulo: z.string(),
  descripcion: z.string().nullable(),
  tipoMision: TipoMisionEnum,
  estado: EstadoMisionEnum,
  prioridad: PrioridadMisionEnum,
  incidenteId: z.string().uuid(),
  patrullaId: z.string().uuid(),
  encargadoId: z.string().uuid().nullable(),
  fechaInicio: z.string().nullable(),
  creadoEn: z.string(),
});

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
  }),
});

export type CrearMisionResponse = z.infer<typeof CrearMisionResponseSchema>;
