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
import {
  CrearAvisoIncidenteInputSchema,
  AvisoIncidenteResponseSchema,
  ConsultaSeguimientoResponseSchema,
  CrearIncidenteManualInputSchema,
  CrearIncidenteManualResponseSchema,
  VerificarDuplicadoInputSchema,
  VerificarDuplicadoResponseSchema,
  IncidenteResponseSchema,
} from "@/modules/incidentes/aviso-incidente.schema";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Registrar esquemas de Recursos y Personal
registry.register("CrearRecursoInput", CrearRecursoInputSchema);
registry.register("RecursoResponse", RecursoResponseSchema);

// Registrar esquemas de Incidentes
registry.register("CrearAvisoIncidenteInput", CrearAvisoIncidenteInputSchema);
registry.register("AvisoIncidenteResponse", AvisoIncidenteResponseSchema);
registry.register("ConsultaSeguimientoResponse", ConsultaSeguimientoResponseSchema);
registry.register("CrearIncidenteManualInput", CrearIncidenteManualInputSchema);
registry.register("CrearIncidenteManualResponse", CrearIncidenteManualResponseSchema);
registry.register("VerificarDuplicadoInput", VerificarDuplicadoInputSchema);
registry.register("VerificarDuplicadoResponse", VerificarDuplicadoResponseSchema);
registry.register("IncidenteResponse", IncidenteResponseSchema);

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

// Registrar ruta POST /api/incidentes/manual
registry.registerPath({
  method: "post",
  path: "/api/incidentes/manual",
  description:
    "Permite el ingreso manual de un incidente desde Call Center (llamada telefónica) o funcionario en terreno. Registra al informante e inserta el incidente en estado REPORTADO, y notifica en tiempo real al Encargado.",
  summary: "Ingreso manual de incidente (Call Center / Terreno)",
  tags: ["Incidentes"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("ID del operador o funcionario autenticado"),
    }),
    body: {
      description: "Datos del reporte de incidente manual",
      content: {
        "application/json": {
          schema: CrearIncidenteManualInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Incidente creado exitosamente en estado REPORTADO",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: CrearIncidenteManualResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Datos de entrada inválidos o faltantes (ej. RUT inválido, descripción muy corta)",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente o usuario inexistente",
    },
    403: {
      description: "No cuenta con el permiso requerido: crear_incidente_manual",
    },
    409: {
      description:
        "Posible incidente duplicado detectado en la zona. Requiere confirmación con forzarCreacion: true.",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// Registrar ruta POST /api/incidentes/verificar-duplicado
registry.registerPath({
  method: "post",
  path: "/api/incidentes/verificar-duplicado",
  description:
    "Consulta si existen incidentes previos similares cercanos (por defecto radio 300m y ventana 24h) para alertar al operador en el formulario antes del envío.",
  summary: "Verificar posibles duplicados de incidente",
  tags: ["Incidentes"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("ID del operador o funcionario autenticado"),
    }),
    body: {
      description: "Dirección/coordenadas y tipo de afectación a verificar",
      content: {
        "application/json": {
          schema: VerificarDuplicadoInputSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Resultado de la verificación espacial",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: VerificarDuplicadoResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Parámetros inválidos",
    },
    401: {
      description: "No autenticado",
    },
    403: {
      description: "No autorizado",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// Registrar ruta POST /api/incidentes/avisos
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos",
  description:
    "Recepcionar reporte de incidente guiado desde el chatbot de informante. Valida RUT, geocodifica la dirección y detecta duplicados cercanos con PostGIS.",
  summary: "Registrar aviso de incidente (Chatbot Informante)",
  tags: ["Incidentes"],
  request: {
    body: {
      description: "Datos consolidados del flujo conversacional del informante",
      content: {
        "application/json": {
          schema: CrearAvisoIncidenteInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Aviso de incidente registrado exitosamente como nuevo reporte",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: AvisoIncidenteResponseSchema,
          }),
        },
      },
    },
    200: {
      description: "Reporte detectado como duplicado; se retorna el código de seguimiento existente",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: AvisoIncidenteResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Datos de entrada inválidos (RUT erróneo, campos requeridos faltantes o dirección muy corta)",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// Registrar ruta GET /api/incidentes/avisos/seguimiento/{codigo}
registry.registerPath({
  method: "get",
  path: "/api/incidentes/avisos/seguimiento/{codigo}",
  description:
    "Permite al ciudadano informante consultar el estado de avance de su reporte mediante su código de seguimiento numérico.",
  summary: "Consultar seguimiento de aviso",
  tags: ["Incidentes"],
  request: {
    params: z.object({
      codigo: z.string().describe("Código de seguimiento numérico de 8 dígitos entregado al informante"),
    }),
  },
  responses: {
    200: {
      description: "Estado del aviso obtenido exitosamente",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: ConsultaSeguimientoResponseSchema,
          }),
        },
      },
    },
    404: {
      description: "No se encontró ningún reporte con el código de seguimiento indicado",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// Registrar ruta GET /api/incidentes/tipos
registry.registerPath({
  method: "get",
  path: "/api/incidentes/tipos",
  description:
    "Retorna el listado de opciones de afectación válidas para poblar los botones de respuesta rápida en el chatbot de sgrai-web y sgrai-pwa.",
  summary: "Obtener catálogo de tipos de afectación",
  tags: ["Incidentes"],
  responses: {
    200: {
      description: "Listado de tipos de afectación",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: z.array(z.string()),
          }),
        },
      },
    },
  },
});

export function generarOpenAPISpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "0.4.0",
      title: "SGRAI API",
      description:
        "Documentación técnica de la API del Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI).",
    },
    servers: [{ url: "/" }],
  });
}
