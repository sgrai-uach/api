import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  AvisoDetalleResponseSchema,
  AvisosPaginadosResponseSchema,
  CrearAvisoInputSchema,
  DescartarAvisoInputSchema,
  ListarAvisosQuerySchema,
  VerificarAvisoInputSchema,
} from "../../modules/incidentes/schema";

export const registry = new OpenAPIRegistry();

// 1. GET /api/incidentes/avisos
registry.registerPath({
  method: "get",
  path: "/api/incidentes/avisos",
  summary: "Listar avisos pendientes para Call Center",
  description:
    "Retorna una lista paginada de avisos ordenados por mayor tiempo de espera (creado_en ASC) calculando minutosEnEspera.",
  tags: ["Incidentes / Avisos"],
  request: {
    query: ListarAvisosQuerySchema,
  },
  responses: {
    200: {
      description: "Listado paginado de avisos",
      content: {
        "application/json": {
          schema: AvisosPaginadosResponseSchema,
        },
      },
    },
    400: {
      description: "Parámetros de consulta inválidos",
    },
  },
});

// 2. POST /api/incidentes/avisos
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos",
  summary: "Registrar aviso preliminar de informante",
  description:
    "Permite a un informante ingresar un reporte de emergencia. Notifica en tiempo real vía Socket.io a la sala call-center.",
  tags: ["Incidentes / Avisos"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CrearAvisoInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Aviso creado con éxito",
    },
    400: {
      description: "Datos del aviso inválidos",
    },
  },
});

// 3. GET /api/incidentes/avisos/{id}
registry.registerPath({
  method: "get",
  path: "/api/incidentes/avisos/{id}",
  summary: "Obtener detalle completo de un aviso",
  description:
    "Retorna información detallada de un aviso incluyendo coordenadas, informante y evidencia multimedia adjunta.",
  tags: ["Incidentes / Avisos"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: "UUID del aviso" }),
    }),
  },
  responses: {
    200: {
      description: "Detalle del aviso encontrado",
      content: {
        "application/json": {
          schema: AvisoDetalleResponseSchema,
        },
      },
    },
    404: {
      description: "Aviso no encontrado",
    },
  },
});

// 4. POST /api/incidentes/avisos/{id}/verificar
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos/{id}/verificar",
  summary: "Verificar aviso y promover a Incidente formal",
  description:
    "Transacción atómica PostgreSQL que crea el Incidente formal en estado 'Reportado' y marca el aviso como 'VERIFICADO'.",
  tags: ["Incidentes / Avisos"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: "UUID del aviso" }),
    }),
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del operador que verifica" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: VerificarAvisoInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Aviso verificado y registro en Incidente creado exitosamente",
    },
    401: {
      description: "Cabecera X-User-Id faltante",
    },
    404: {
      description: "Aviso no encontrado",
    },
    409: {
      description: "El aviso ya fue verificado o procesado previamente",
    },
  },
});

// 5. POST /api/incidentes/avisos/{id}/descartar
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos/{id}/descartar",
  summary: "Descartar aviso con justificación",
  description:
    "Marca un aviso en estado 'DESCARTADO' registrando motivo de descarte obligatorio y operador responsable.",
  tags: ["Incidentes / Avisos"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: "UUID del aviso" }),
    }),
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del operador que descarta" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: DescartarAvisoInputSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Aviso descartado con éxito",
    },
    400: {
      description: "Motivo de descarte inválido o menor a 5 caracteres",
    },
    401: {
      description: "Cabecera X-User-Id faltante",
    },
    404: {
      description: "Aviso no encontrado",
    },
    409: {
      description: "El aviso ya fue procesado previamente",
    },
  },
});

/**
 * Genera el documento OpenAPI 3.0 en formato JSON.
 */
export function generarOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "SGRAI API - Municipalidad de Valdivia",
      version: "0.2.0",
      description:
        "Especificación OpenAPI generada automáticamente desde esquemas Zod para la plataforma SGRAI (Dirección de Gestión de Riesgos de Desastres).",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Servidor de desarrollo local",
      },
    ],
  });
}
