import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
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
import {
  ListarRolesResponseSchema,
  RolDetalleResponseSchema,
} from "../../modules/seguridad/schema";
import {
  CrearRecursoInputSchema,
  RecursoResponseSchema,
  ListarRecursosQuerySchema,
  ListarRecursosPaginadosResponseSchema,
} from "../../modules/recursos-y-personal/recurso.schema";

extendZodWithOpenApi(z);

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

// 6. GET /api/seguridad/roles
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

// 7. GET /api/seguridad/roles/{id}
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

// 8. POST /api/recursos (HU-6)
registry.registerPath({
  method: "post",
  path: "/api/recursos",
  summary: "Crear nuevo recurso en el inventario logístico",
  description:
    "Registra un recurso (material fungible o vehículo/maquinaria individual) en el inventario municipal.",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario con permiso recursos:crear" }),
    }),
    body: {
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

// 9. GET /api/recursos (HU-7)
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

/**
 * Genera el documento OpenAPI 3.0 en formato JSON.
 */
export function generarOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "SGRAI API - Municipalidad de Valdivia",
      version: "0.3.0",
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
