import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const DetallesRecursoSchema = z
  .object({
    // Identificación general de activos serializados
    patente: z.string().trim().optional(),
    numeroSerie: z.string().trim().optional(),
    marca: z.string().trim().optional(),
    modelo: z.string().trim().optional(),
    anio: z.number().int().min(1900, "Año inválido").max(2100, "Año inválido").optional(),

    // Camionetas y Vehículos de transporte
    kilometraje: z.number().min(0, "El kilometraje no puede ser negativo").optional(),
    tipoCombustible: z.enum(["GASOLINA", "DIESEL", "ELECTRICO", "HIBRIDO", "OTRO"]).optional(),
    capacidadPasajeros: z.number().int().positive("Capacidad de pasajeros debe ser positiva").optional(),
    numeroChasis: z.string().trim().optional(),

    // Grúas y Maquinaria Pesada
    capacidadCargaKg: z.number().positive("La capacidad de carga debe ser mayor a 0").optional(),
    alcanceMaximoMetros: z.number().positive("El alcance máximo debe ser mayor a 0").optional(),
    tipoGrua: z.string().trim().optional(),
    horometro: z.number().min(0, "El horómetro no puede ser negativo").optional(),

    // Motobombas y Equipos de Achique / Fluidos
    caudalMaximoLpm: z.number().positive("El caudal debe ser mayor a 0").optional(),
    diametroPulgadas: z.number().positive("El diámetro debe ser mayor a 0").optional(),
    potenciaHp: z.number().positive("La potencia en HP debe ser mayor a 0").optional(),

    // Generadores Eléctricos
    potenciaKva: z.number().positive("La potencia en kVA debe ser mayor a 0").optional(),
  })
  .passthrough();

export const CrearRecursoInputSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres"),
  esIndividual: z.boolean().default(false),
  cantidadInventario: z
    .number({ message: "La cantidad en inventario es obligatoria" })
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad en inventario no puede ser negativa"),
  cantidadMinima: z
    .number()
    .int("La cantidad mínima debe ser un número entero")
    .min(0, "La cantidad mínima no puede ser negativa")
    .default(0),
  latitud: z
    .number({ message: "La latitud es obligatoria" })
    .min(-90, "La latitud debe estar entre -90 y 90")
    .max(90, "La latitud debe estar entre -90 y 90"),
  longitud: z
    .number({ message: "La longitud es obligatoria" })
    .min(-180, "La longitud debe estar entre -180 y 180")
    .max(180, "La longitud debe estar entre -180 y 180"),
  descripcion: z.string().trim().optional(),
  detalles: DetallesRecursoSchema.optional().default({}),
});

export type CrearRecursoInput = z.infer<typeof CrearRecursoInputSchema>;
export type DetallesRecurso = z.infer<typeof DetallesRecursoSchema>;

export const RecursoResponseSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  esIndividual: z.boolean(),
  estado: z.enum(["DISPONIBLE", "NO_DISPONIBLE", "BAJO_STOCK"]),
  cantidadInventario: z.number().int(),
  cantidadEnUso: z.number().int(),
  cantidadMinima: z.number().int(),
  latitud: z.number(),
  longitud: z.number(),
  descripcion: z.string().nullable(),
  detalles: z.record(z.string(), z.unknown()),
  creadoPorId: z.string().uuid(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type RecursoResponse = z.infer<typeof RecursoResponseSchema>;
