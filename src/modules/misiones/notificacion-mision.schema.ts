import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const EstadoNotificacionMisionEnum = z.enum([
  "PENDIENTE_ENVIO",
  "ENVIADA",
  "RECIBIDA",
  "LEIDA",
]);

export type EstadoNotificacionMision = z.infer<typeof EstadoNotificacionMisionEnum>;

// Schema para el parámetro de ruta :id de notificación
export const NotificacionIdParamSchema = z.string().uuid({
  message: "El identificador de la notificación debe ser un UUID válido.",
}).openapi({
  description: "Identificador único UUID de la notificación de despacho",
  example: "70000000-0000-4000-8000-000000000001",
});

// Input para actualizar estado (ACK de recepción o lectura)
export const ActualizarEstadoNotificacionInputSchema = z.object({
  estado: z.enum(["RECIBIDA", "LEIDA"], {
    message: "El estado a actualizar debe ser 'RECIBIDA' o 'LEIDA'.",
  }).openapi({
    description: "Nuevo estado de confirmación reportado por el cliente de terreno",
    example: "RECIBIDA",
  }),
}).openapi({
  title: "ActualizarEstadoNotificacionInput",
  description: "Payload para emisión de acuse de recibo o lectura de notificación de misión",
});

export type ActualizarEstadoNotificacionInput = z.infer<
  typeof ActualizarEstadoNotificacionInputSchema
>;

// Representación detallada de la notificación de misión
export const NotificacionMisionDetalleSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único de la notificación" }),
  misionId: z.string().uuid().openapi({ description: "Identificador de la misión asociada" }),
  patrullaId: z.string().uuid().openapi({ description: "Identificador de la patrulla destinataria" }),
  estado: EstadoNotificacionMisionEnum.openapi({ description: "Estado actual del ciclo de vida de la notificación" }),
  intentosEnvio: z.number().int().openapi({ description: "Contador de emisiones hacia la patrulla", example: 1 }),
  creadaAt: z.string().openapi({ description: "Marca temporal UTC de registro en base de datos" }),
  enviadaAt: z.string().nullable().openapi({ description: "Marca temporal UTC de emisión hacia la sala de la patrulla" }),
  recibidaAt: z.string().nullable().openapi({ description: "Marca temporal UTC del acuse de recibo técnico automático" }),
  leidaAt: z.string().nullable().openapi({ description: "Marca temporal UTC del acuse de lectura operativa" }),
}).openapi({
  title: "NotificacionMisionDetalle",
  description: "Trazabilidad completa de la notificación de misión despachada",
});

export type NotificacionMisionDetalle = z.infer<typeof NotificacionMisionDetalleSchema>;

// Respuesta de actualización de estado
export const ActualizarEstadoNotificacionResponseSchema = z.object({
  message: z.string().openapi({ example: "Estado de notificación actualizado exitosamente." }),
  data: NotificacionMisionDetalleSchema,
}).openapi({
  title: "ActualizarEstadoNotificacionResponse",
});

export type ActualizarEstadoNotificacionResponse = z.infer<
  typeof ActualizarEstadoNotificacionResponseSchema
>;

// Misión pendiente para reconciliación offline
export const MisionPendienteTerrenoSchema = z.object({
  notificacionId: z.string().uuid().openapi({ description: "Identificador de la notificación para envío de ACK" }),
  misionId: z.string().uuid().openapi({ description: "Identificador único de la misión" }),
  codigoMision: z.string().openapi({ description: "Código oficial de la orden táctica", example: "MIS-2026-0001" }),
  titulo: z.string().openapi({ description: "Título descriptivo de la misión" }),
  descripcion: z.string().nullable().openapi({ description: "Instrucciones de trabajo en terreno" }),
  tipoMision: z.string().openapi({ description: "Tipo de misión (ej. VERIFICACION)", example: "VERIFICACION" }),
  prioridad: z.string().openapi({ description: "Prioridad operativa (BAJA, MEDIA, ALTA, CRITICA)", example: "ALTA" }),
  estadoMision: z.string().openapi({ description: "Estado actual de la misión en el sistema", example: "DESPACHADA" }),
  estadoNotificacion: EstadoNotificacionMisionEnum.openapi({ description: "Estado de entrega de la notificación", example: "PENDIENTE_ENVIO" }),
  patrullaId: z.string().uuid().openapi({ description: "Identificador de la patrulla asignada" }),
  incidenteId: z.string().uuid().nullable().openapi({ description: "Identificador del incidente asociado si aplica" }),
  incidenteCodigo: z.string().nullable().openapi({ description: "Código del incidente atendido", example: "INC-2026-8869" }),
  incidenteFolio: z.string().nullable().openapi({ description: "Folio correlativo institucional", example: "FOL-8869" }),
  tipoAfectacion: z.string().nullable().openapi({ description: "Tipología de afectación preliminar", example: "Inundación" }),
  direccion: z.string().nullable().openapi({ description: "Dirección o punto de referencia en la comuna", example: "Av. Ramón Picarte 1500" }),
  latitud: z.number().nullable().openapi({ description: "Latitud WGS84 del punto a atender" }),
  longitud: z.number().nullable().openapi({ description: "Longitud WGS84 del punto a atender" }),
  creadaAt: z.string().openapi({ description: "Fecha de generación de la orden" }),
  enviadaAt: z.string().nullable().openapi({ description: "Fecha de emisión al canal" }),
}).openapi({
  title: "MisionPendienteTerreno",
  description: "Datos requeridos por la PWA para desplegar la alerta y emitir ACK tras perder cobertura",
});

export type MisionPendienteTerreno = z.infer<typeof MisionPendienteTerrenoSchema>;

export const ListarMisionesPendientesResponseSchema = z.object({
  message: z.string().openapi({ example: "Misiones pendientes obtenidas exitosamente." }),
  data: z.array(MisionPendienteTerrenoSchema),
  total: z.number().openapi({ example: 1 }),
}).openapi({
  title: "ListarMisionesPendientesResponse",
});

export type ListarMisionesPendientesResponse = z.infer<
  typeof ListarMisionesPendientesResponseSchema
>;
