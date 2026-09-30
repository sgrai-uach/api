import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

/**
 * Esquema de consulta para listar avisos con paginación y filtros multicriterio.
 */
export const ListarAvisosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({
    description: "Número de página actual (inicia en 1)",
    example: 1,
  }),
  limit: z.coerce.number().int().positive().max(100).default(20).openapi({
    description: "Cantidad de elementos por página (máx. 100)",
    example: 20,
  }),
  estado: z
    .enum(["PENDIENTE_VERIFICACION", "NO_VERIFICADO", "VERIFICADO", "DESCARTADO", "TODOS"])
    .optional()
    .default("NO_VERIFICADO")
    .openapi({
      description: "Estado del aviso a consultar (por defecto NO_VERIFICADO; si es TODOS omite el filtro)",
      example: "NO_VERIFICADO",
    }),
  delegacion: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((val) => (val === "Calle-Calle" ? "Calle Calle" : val))
    .openapi({
      description: "Delegación territorial ('Norte', 'Sur', 'Costa', 'Calle Calle', 'TODAS')",
      example: "Norte",
    }),
  busqueda: z.string().trim().max(100).optional().openapi({
    description: "Texto libre para filtrar por descripción, dirección o informante",
    example: "Alemania",
  }),
  q: z.string().trim().max(100).optional().openapi({
    description: "Alias de búsqueda rápida para texto libre",
    example: "inundación",
  }),
  origen: z
    .enum(["WEB", "CHATBOT", "TELEFONO"])
    .optional()
    .openapi({
      description: "Canal por el cual ingresó el reporte",
      example: "WEB",
    }),
});

export type ListarAvisosQuery = z.infer<typeof ListarAvisosQuerySchema>;

/**
 * Esquema para el registro de un nuevo aviso por un informante o chatbot.
 */
export const CrearAvisoInputSchema = z
  .object({
    tipoAfectacion: z
      .string()
      .trim()
      .default("Anegamiento")
      .openapi({
        description: "Tipo de afectación reportada (ej: Inundación, Anegamiento, etc.)",
        example: "Anegamiento",
      }),
    direccion: z
      .string()
      .trim()
      .default("Valdivia, Los Ríos")
      .openapi({
        description: "Dirección en texto del incidente",
        example: "Avenida Los Robles con Los Laureles, Isla Teja",
      }),
    descripcion: z
      .string()
      .trim()
      .min(5, "La descripción debe tener al menos 5 caracteres")
      .optional()
      .openapi({
        description: "Descripción detallada del incidente reportado",
        example: "Desborde de río e inundación de viviendas cercanas",
      }),
    informanteNombre: z
      .string()
      .trim()
      .default("Vecino Valdivia")
      .openapi({
        description: "Nombre del informante",
        example: "Juan Pérez",
      }),
    informanteRut: z
      .string()
      .trim()
      .default("11111111-1")
      .openapi({
        description: "RUT del informante",
        example: "12345678-5",
      }),
    informanteTelefono: z
      .string()
      .trim()
      .optional()
      .openapi({
        description: "Teléfono de contacto del informante",
        example: "+56912345678",
      }),
    latitud: z
      .number()
      .min(-90, "Latitud mínima es -90")
      .max(90, "Latitud máxima es 90")
      .openapi({
        description: "Coordenada latitud en grados decimales",
        example: -39.8142,
      }),
    longitud: z
      .number()
      .min(-180, "Longitud mínima es -180")
      .max(180, "Longitud máxima es 180")
      .openapi({
        description: "Coordenada longitud en grados decimales",
        example: -73.2459,
      }),
    origenReporte: z
      .enum(["WEB", "CHATBOT", "TELEFONO"])
      .default("WEB")
      .openapi({
        description: "Canal por el cual ingresó el aviso",
        example: "WEB",
      }),
    tipoPreliminarId: z
      .string()
      .uuid("Debe ser un UUID válido")
      .optional()
      .openapi({
        description: "ID opcional del catálogo de tipo de incidente",
      }),
    datosInformante: z
      .object({
        nombre: z.string().trim().optional(),
        telefono: z.string().trim().optional(),
        rut: z.string().trim().optional(),
        direccionAproximada: z.string().trim().optional(),
      })
      .optional()
      .openapi({
        description: "Datos informante en formato JSON legacy (opcional)",
      }),
  })
  .openapi("CrearAvisoInput");

export type CrearAvisoInput = z.infer<typeof CrearAvisoInputSchema>;

/**
 * Esquema para la acción "Verificar y Enviar" a Incidente formal.
 */
export const VerificarAvisoInputSchema = z
  .object({
    tipoIncidenteId: z
      .string()
      .uuid("El tipo de incidente debe ser un UUID válido")
      .openapi({
        description: "Clasificación oficial del tipo de incidente confirmado",
        example: "a0000000-0000-0000-0000-000000000001",
      }),
    descripcion: z
      .string()
      .trim()
      .min(5, "La descripción formal debe tener al menos 5 caracteres")
      .optional()
      .openapi({
        description:
          "Descripción ajustada por el operador (si se omite, usa la del aviso)",
        example:
          "Inundación moderada en sector costero por marejadas y colapso de sumideros",
      }),
    requiereAsistenciaSocial: z.boolean().default(false).openapi({
      description:
        "Indica si el incidente requiere activación de Asistencia Social (FIBE)",
      example: false,
    }),
  })
  .openapi("VerificarAvisoInput");

export type VerificarAvisoInput = z.infer<typeof VerificarAvisoInputSchema>;

/**
 * Esquema para descartar un aviso con justificación obligatoria.
 */
export const DescartarAvisoInputSchema = z
  .object({
    motivoDescarte: z
      .string()
      .trim()
      .min(5, "El motivo de descarte debe tener al menos 5 caracteres")
      .openapi({
        description:
          "Justificación obligatoria del descarte (información falsa, duplicada, etc.)",
        example: "Reporte duplicado con respecto al aviso ID #1234 verificado anteriormente",
      }),
  })
  .openapi("DescartarAvisoInput");

export type DescartarAvisoInput = z.infer<typeof DescartarAvisoInputSchema>;

/**
 * Esquema para un elemento del listado de avisos.
 */
export const AvisoItemSchema = z
  .object({
    id: z.string().uuid(),
    codigoSeguimiento: z.string(),
    tipoAfectacion: z.string(),
    tipoPreliminarNombre: z.string().nullable(),
    direccionTexto: z.string(),
    descripcion: z.string().nullable(),
    latitud: z.number(),
    longitud: z.number(),
    informanteNombre: z.string(),
    informanteRut: z.string(),
    informanteTelefono: z.string().nullable(),
    origenReporte: z.enum(["WEB", "CHATBOT", "TELEFONO"]),
    estado: z.enum(["PENDIENTE_VERIFICACION", "NO_VERIFICADO", "VERIFICADO", "DESCARTADO"]),
    esDuplicado: z.boolean(),
    avisoOriginalId: z.string().uuid().nullable().optional(),
    motivoDescarte: z.string().nullable(),
    operadorId: z.string().uuid().nullable(),
    incidenteId: z.string().uuid().nullable(),
    delegacionNombre: z.string().nullable().openapi({
      description: "Nombre de la delegación territorial asignada (ej. Norte, Sur, Costa, Calle Calle)",
      example: "Norte",
    }),
    minutosEnEspera: z.number().int().nonnegative(),
    creadoEn: z.string(),
    actualizadoEn: z.string(),
  })
  .openapi("AvisoItem");

/**
 * Esquema de respuesta para listado paginado.
 */
export const AvisosPaginadosResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Avisos obtenidos exitosamente" }),
    data: z.array(AvisoItemSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNext: z.boolean().openapi({ example: false }),
      hasPrev: z.boolean().openapi({ example: false }),
    }),
  })
  .openapi("AvisosPaginadosResponse");

/**
 * Esquema de respuesta para detalle completo del aviso.
 */
export const AvisoDetalleResponseSchema = AvisoItemSchema.extend({
  datosInformante: z.object({
    nombre: z.string().optional(),
    telefono: z.string().optional(),
    rut: z.string().optional(),
    direccionAproximada: z.string().optional(),
  }),
  adjuntos: z.array(
    z.object({
      id: z.string().uuid(),
      nombreArchivo: z.string(),
      url: z.string().url(),
      tipoMime: z.string(),
      tamanoBytes: z.number(),
      creadoEn: z.string(),
    })
  ),
}).openapi("AvisoDetalleResponse");
