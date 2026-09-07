import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  CrearRecursoInputSchema,
  RecursoResponseSchema,
} from "@/modules/recursos-y-personal/recurso.schema";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Registrar esquemas
registry.register("CrearRecursoInput", CrearRecursoInputSchema);
registry.register("RecursoResponse", RecursoResponseSchema);

// Registrar ruta POST /api/recursos
registry.registerPath({
  method: "post",
  path: "/api/recursos",
  description: "Crear un nuevo recurso en el inventario logístico del SGRAI.",
  summary: "Crear recurso",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("ID del usuario administrador autenticado"),
    }),
    body: {
      description: "Datos del nuevo recurso a registrar",
      content: {
        "application/json": {
          schema: CrearRecursoInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Recurso creado exitosamente",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: RecursoResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Datos de entrada inválidos",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente",
    },
    403: {
      description: "No cuenta con el permiso requerido: recursos:crear",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

export function generarOpenAPISpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "0.2.0",
      title: "SGRAI API",
      description:
        "Documentación técnica de la API del Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI).",
    },
    servers: [{ url: "/" }],
  });
}
