import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  CrearRecursoInputSchema,
  RecursoResponseSchema,
  ListarRecursosQuerySchema,
  ListarRecursosPaginadosResponseSchema,
} from "@/modules/recursos-y-personal/recurso.schema";

import {
  AvisoDetalleResponseSchema,
  AvisosPaginadosResponseSchema,
  CrearAvisoInputSchema,
  DescartarAvisoInputSchema,
  ListarAvisosQuerySchema,
  VerificarAvisoInputSchema,
} from "@/modules/incidentes/schema";

import {
  CrearAvisoIncidenteInputSchema,
  AvisoIncidenteResponseSchema,
  ConsultaSeguimientoResponseSchema,
  CrearIncidenteManualInputSchema,
  CrearIncidenteManualResponseSchema,
  VerificarDuplicadoInputSchema,
  VerificarDuplicadoResponseSchema,
} from "@/modules/incidentes/aviso-incidente.schema";

import {
  ListarRolesResponseSchema,
  RolDetalleResponseSchema,
} from "@/modules/seguridad/schema";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Registrar esquemas de Recursos y Personal
registry.register("CrearRecursoInput", CrearRecursoInputSchema);
registry.register("RecursoResponse", RecursoResponseSchema);

// Registrar esquemas de Incidentes
registry.register("CrearAvisoIncidenteInput", CrearAvisoIncidenteInputSchema);
registry.register("AvisoIncidenteResponse", AvisoIncidenteResponseSchema);
registry.register("ConsultaSeguimientoResponse", ConsultaSeguimientoResponseSchema);
registry.register("CrearAvisoInput", CrearAvisoInputSchema);
registry.register("AvisoDetalleResponse", AvisoDetalleResponseSchema);
registry.register("AvisosPaginadosResponse", AvisosPaginadosResponseSchema);
registry.register("DescartarAvisoInput", DescartarAvisoInputSchema);
registry.register("VerificarAvisoInput", VerificarAvisoInputSchema);
registry.register("CrearIncidenteManualInput", CrearIncidenteManualInputSchema);
registry.register("CrearIncidenteManualResponse", CrearIncidenteManualResponseSchema);
registry.register("VerificarDuplicadoInput", VerificarDuplicadoInputSchema);
registry.register("VerificarDuplicadoResponse", VerificarDuplicadoResponseSchema);

// Registrar esquemas de Seguridad
registry.register("ListarRolesResponse", ListarRolesResponseSchema);
registry.register("RolDetalleResponse", RolDetalleResponseSchema);

// 1. POST /api/recursos (HU-6)
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

// 2. GET /api/recursos (HU-7)
registry.registerPath({
  method: "get",
  path: "/api/recursos",
  summary: "Listar recursos logísticos y verificar disponibilidad",
  description:
    "Retorna una lista paginada de los recursos registrados en el inventario, incluyendo estado de disponibilidad operativa, cantidades y delegación territorial asociada. Accesible por rol Administrador.",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
    query: ListarRecursosQuerySchema,
  },
  responses: {
    200: {
      description: "Listado paginado de recursos de inventario",
      content: {
        "application/json": {
          schema: ListarRecursosPaginadosResponseSchema,
        },
      },
    },
    400: {
      description: "Parámetros de consulta inválidos",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// 3. POST /api/incidentes/manual (HU-53)
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

// 4. POST /api/incidentes/verificar-duplicado (HU-53)
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

// 5. GET /api/incidentes/avisos
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

// 6. POST /api/incidentes/avisos
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos",
  description:
    "Recepcionar reporte de incidente guiado desde el chatbot de informante o aviso preliminar de informante.",
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

// 7. GET /api/incidentes/avisos/{id}
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

// 8. POST /api/incidentes/avisos/{id}/verificar
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

// 9. POST /api/incidentes/avisos/{id}/descartar
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos/{id}/descartar",
  summary: "Descartar aviso motivado",
  description:
    "Descarta un aviso no procedente registrando la justificación obligatoria del operador.",
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
      description: "Aviso descartado correctamente",
    },
    400: {
      description: "Justificación de descarte inválida o faltante",
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

// 10. GET /api/incidentes/avisos/seguimiento/{codigo}
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

// 11. GET /api/incidentes/tipos
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

// 12. GET /api/seguridad/roles
registry.registerPath({
  method: "get",
  path: "/api/seguridad/roles",
  summary: "Listar perfiles y permisos actuales",
  description:
    "Retorna el listado completo de perfiles/roles registrados con sus respectivos permisos asignados y metadatos de auditoría. Accesible exclusivamente por el rol Administrador.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
  },
  responses: {
    200: {
      description: "Listado completo de roles y permisos",
      content: {
        "application/json": {
          schema: ListarRolesResponseSchema,
        },
      },
    },
    401: {
      description: "Cabecera de autenticación X-User-Id ausente o usuario no válido",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
  },
});

// 13. GET /api/seguridad/roles/{id}
registry.registerPath({
  method: "get",
  path: "/api/seguridad/roles/{id}",
  summary: "Obtener detalle de perfil y sus permisos",
  description:
    "Despliega claramente los permisos, módulos y acciones a los que tiene acceso un perfil específico. Accesible exclusivamente por el rol Administrador.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: "UUID del rol/perfil a consultar" }),
    }),
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
  },
  responses: {
    200: {
      description: "Detalle del perfil y sus permisos asignados",
      content: {
        "application/json": {
          schema: RolDetalleResponseSchema,
        },
      },
    },
    401: {
      description: "Cabecera de autenticación X-User-Id ausente o usuario no válido",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
    404: {
      description: "Perfil no encontrado",
    },
  },
});

/**
 * Genera el documento OpenAPI 3.0 en formato JSON.
 */
export function generarOpenAPISpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "SGRAI API",
      version: "0.4.0",
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

export const generarOpenApiSpec = generarOpenAPISpec;
