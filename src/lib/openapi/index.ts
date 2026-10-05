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
} from "@/modules/incidentes/schema";

import {
  ActualizarPermisosRolInputSchema,
  ActualizarPermisosRolResponseSchema,
  ListarPermisosResponseSchema,
  ListarRolesResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  PermisoCatalogoItemSchema,
  RolDetalleResponseSchema,
  UsuarioActivoResponseSchema,
} from "@/modules/seguridad/schema";

import {
  CrearRecursoInputSchema,
  ActualizarRecursoInputSchema,
  RecursoResponseSchema,
  RecursoDetalleResponseSchema,
  RecursoIdParamSchema,
  ListarRecursosQuerySchema,
  ListarRecursosPaginadosResponseSchema,
  EliminarRecursoResponseSchema,
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

import {
  ListarIncidentesResponseSchema,
  IncidenteDetalleResponseSchema,
  ListarIncidentesQuerySchema,
} from "@/modules/incidentes/incidente-kanban.schema";

import {
  IncidentesKpisQuerySchema,
  IncidentesKpisResponseSchema,
} from "@/modules/incidentes/incidente-kpi.schema";

import {
  ModificarEmpleadoSchema,
  EmpleadoConsolidadoSchema,
  ListarEmpleadosResponseSchema,
  ActualizarEmpleadoResponseSchema,
  CatalogosResponseSchema,
  DetalleEmpleadoResponseSchema,
  EliminarEmpleadoResponseSchema,
} from "@/modules/recursos-y-personal/schemas/modificar-empleado.schema";
import {
  RegistrarEmpleadoSchema,
  RegistrarEmpleadoResponseSchema,
} from "@/modules/recursos-y-personal/schemas/registrar-empleado.schema";

import {
  ListarPersonalQuerySchema,
  ListarPersonalResponseSchema,
  PersonalItemSchema,
} from "@/modules/recursos-y-personal/personal-listado.schema";

import {
  ListarMisionesQuerySchema,
  ListarMisionesResponseSchema,
  MisionItemSchema,
} from "@/modules/misiones/mision-listado.schema";

import {
  ListarPuntosCriticosQuerySchema,
  ListarPuntosCriticosResponseSchema,
  PuntoCriticoItemResponseSchema,
  CrearPuntoCriticoBodySchema,
  ActualizarPuntoCriticoBodySchema,
  PuntoCriticoDetalleResponseSchema,
  PuntoCriticoIdParamSchema,
  EliminarPuntoCriticoResponseSchema,
} from "@/modules/eventos-atp/punto-critico.schema";

import {
  CrearEventoRecuperacionInputSchema,
  CrearEventoRecuperacionResponseSchema,
  EventoRecuperacionResponseSchema,
} from "@/modules/eventos-atp/recuperacion.schema";

import {
  MisionDetalleResponseSchema,
  MisionIdParamSchema,
} from "@/modules/misiones/mision.schema";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Registrar esquemas de Recursos y Personal
registry.register("CrearRecursoInput", CrearRecursoInputSchema);
registry.register("ActualizarRecursoInput", ActualizarRecursoInputSchema);
registry.register("RecursoResponse", RecursoResponseSchema);
registry.register("RecursoDetalleResponse", RecursoDetalleResponseSchema);
registry.register("EliminarRecursoResponse", EliminarRecursoResponseSchema);
registry.register("ListarRecursosPaginadosResponse", ListarRecursosPaginadosResponseSchema);
registry.register("ModificarEmpleadoInput", ModificarEmpleadoSchema);
registry.register("RegistrarEmpleadoInput", RegistrarEmpleadoSchema);
registry.register("RegistrarEmpleadoResponse", RegistrarEmpleadoResponseSchema);
registry.register("EmpleadoConsolidado", EmpleadoConsolidadoSchema);
registry.register("ListarEmpleadosResponse", ListarEmpleadosResponseSchema);
registry.register("ActualizarEmpleadoResponse", ActualizarEmpleadoResponseSchema);
registry.register("CatalogosResponse", CatalogosResponseSchema);
registry.register("ListarPersonalResponse", ListarPersonalResponseSchema);
registry.register("PersonalItem", PersonalItemSchema);
registry.register("ListarMisionesResponse", ListarMisionesResponseSchema);
registry.register("MisionItem", MisionItemSchema);
registry.register("DetalleEmpleadoResponse", DetalleEmpleadoResponseSchema);
registry.register("EliminarEmpleadoResponse", EliminarEmpleadoResponseSchema);


// Registrar esquemas de Seguridad
registry.register("ListarRolesResponse", ListarRolesResponseSchema);
registry.register("RolDetalleResponse", RolDetalleResponseSchema);
registry.register("PermisoCatalogoItem", PermisoCatalogoItemSchema);
registry.register("ListarPermisosResponse", ListarPermisosResponseSchema);
registry.register("ActualizarPermisosRolInput", ActualizarPermisosRolInputSchema);
registry.register("ActualizarPermisosRolResponse", ActualizarPermisosRolResponseSchema);
registry.register("UsuarioActivoResponse", UsuarioActivoResponseSchema);
registry.register("LoginRequest", LoginRequestSchema);
registry.register("LoginResponse", LoginResponseSchema);

// Registrar esquemas de Avisos Call Center
registry.register("AvisosPaginadosResponse", AvisosPaginadosResponseSchema);
registry.register("AvisoDetalleResponse", AvisoDetalleResponseSchema);
registry.register("CrearAvisoInput", CrearAvisoInputSchema);
registry.register("DescartarAvisoInput", DescartarAvisoInputSchema);
registry.register("VerificarAvisoInput", VerificarAvisoInputSchema);

// Registrar esquemas de Incidentes (Chatbot, Manual, Kanban)
registry.register("CrearAvisoIncidenteInput", CrearAvisoIncidenteInputSchema);
registry.register("AvisoIncidenteResponse", AvisoIncidenteResponseSchema);
registry.register("ConsultaSeguimientoResponse", ConsultaSeguimientoResponseSchema);
registry.register("ListarIncidentesResponse", ListarIncidentesResponseSchema);
registry.register("IncidenteDetalleResponse", IncidenteDetalleResponseSchema);
registry.register("CrearIncidenteManualInput", CrearIncidenteManualInputSchema);
registry.register("CrearIncidenteManualResponse", CrearIncidenteManualResponseSchema);
registry.register("VerificarDuplicadoInput", VerificarDuplicadoInputSchema);
registry.register("VerificarDuplicadoResponse", VerificarDuplicadoResponseSchema);
registry.register("IncidenteResponse", IncidenteResponseSchema);
registry.register("IncidentesKpisResponse", IncidentesKpisResponseSchema);

// Registrar esquemas de Eventos ATP (Puntos Críticos)
registry.register("ListarPuntosCriticosResponse", ListarPuntosCriticosResponseSchema);
registry.register("PuntoCriticoItemResponse", PuntoCriticoItemResponseSchema);
registry.register("CrearPuntoCriticoBody", CrearPuntoCriticoBodySchema);
registry.register("ActualizarPuntoCriticoBody", ActualizarPuntoCriticoBodySchema);
registry.register("PuntoCriticoDetalleResponse", PuntoCriticoDetalleResponseSchema);
registry.register("EliminarPuntoCriticoResponse", EliminarPuntoCriticoResponseSchema);

// ==========================================
// RUTAS RECURSOS Y PERSONAL
// ==========================================

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
    400: { description: "Datos de entrada inválidos" },
    401: { description: "No autenticado / cabecera X-User-Id ausente" },
    403: { description: "No cuenta con el permiso requerido: recursos:crear" },
    500: { description: "Error interno del servidor" },
  },
});

// 2. GET /api/recursos (HU-7 / HU-50)
registry.registerPath({
  method: "get",
  path: "/api/recursos",
  summary: "Listar recursos logísticos y verificar disponibilidad",
  description:
    "Retorna una lista paginada de los recursos registrados en el inventario, incluyendo estado de disponibilidad operativa, cantidades y delegación territorial asociada. Accesible por perfiles con permiso recursos:leer (Administrador, Encargado, Supervisor - HU-50).",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().optional().describe("UUID del usuario autenticado (opcional si se envía Authorization: Bearer <token>)"),
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
    400: { description: "Parámetros de consulta inválidos" },
    401: { description: "No autenticado / token o cabecera de autenticación ausente" },
    403: { description: "Acceso denegado. Se requiere permiso recursos:leer o perfil Administrador" },
    500: { description: "Error interno del servidor" },
  },
});

// ==========================================
// RUTAS SEGURIDAD (AUTENTICACIÓN, ROLES Y PERMISOS)
// ==========================================

// POST /api/seguridad/login
registry.registerPath({
  method: "post",
  path: "/api/seguridad/login",
  summary: "Iniciar sesión institucional",
  description:
    "Autentica a un funcionario u operador mediante correo o RUT y contraseña. Valida hash bcrypt, vigencia de cuenta y política de bloqueo por reintentos antes de emitir el token JWT de sesión.",
  tags: ["Seguridad / Autenticación"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Inicio de sesión exitoso con token JWT y perfil de usuario retornado",
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
    },
    400: { description: "Datos de solicitud inválidos o campos obligatorios faltantes" },
    401: { description: "Credenciales inválidas. Identificador o contraseña errónea" },
    403: { description: "Cuenta deshabilitada o temporalmente bloqueada por múltiples intentos fallidos" },
    500: { description: "Error interno del servidor al procesar el inicio de sesión" },
  },
});

// 3. GET /api/seguridad/roles
registry.registerPath({
  method: "get",
  path: "/api/seguridad/roles",
  summary: "Listar perfiles y permisos actuales",
  description:
    "Retorna el listado completo de perfiles/roles registrados con sus respectivos permisos asignados y metadatos de auditoría.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del usuario administrador autenticado"),
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
    401: { description: "Cabecera de autenticación X-User-Id ausente o usuario no válido" },
    403: { description: "Acceso denegado. Se requiere perfil de Administrador" },
  },
});

// 4. GET /api/seguridad/roles/{id}
registry.registerPath({
  method: "get",
  path: "/api/seguridad/roles/{id}",
  summary: "Obtener detalle de perfil y sus permisos",
  description:
    "Despliega claramente los permisos, módulos y acciones a los que tiene acceso un perfil específico.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    params: z.object({
      id: z.string().uuid().describe("UUID del rol/perfil a consultar"),
    }),
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del usuario administrador autenticado"),
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
    400: { description: "Identificador de rol no válido (debe ser UUID)" },
    401: { description: "Cabecera de autenticación X-User-Id ausente o usuario no válido" },
    403: { description: "Acceso denegado. Se requiere perfil de Administrador" },
    404: { description: "Perfil no encontrado" },
  },
});

// 5. GET /api/seguridad/permisos (HU-5)
registry.registerPath({
  method: "get",
  path: "/api/seguridad/permisos",
  summary: "Listar catálogo completo de permisos",
  description:
    "Retorna el catálogo completo de permisos registrados en la base de datos clasificados por módulo funcional.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del usuario administrador autenticado"),
    }),
  },
  responses: {
    200: {
      description: "Catálogo completo de permisos clasificados por módulo",
      content: {
        "application/json": {
          schema: ListarPermisosResponseSchema,
        },
      },
    },
    401: { description: "Cabecera de autenticación X-User-Id ausente o usuario no válido" },
    403: { description: "Acceso denegado. Se requiere perfil de Administrador" },
  },
});

// 6. PUT /api/seguridad/roles/{id}/permisos (HU-5)
registry.registerPath({
  method: "put",
  path: "/api/seguridad/roles/{id}/permisos",
  summary: "Actualizar permisos de un perfil",
  description:
    "Actualiza masiva y atómicamente los permisos asignados a un rol institucional específico mediante una lista de UUIDs.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    params: z.object({
      id: z.string().uuid().describe("UUID del rol/perfil a actualizar"),
    }),
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del usuario administrador autenticado"),
    }),
    body: {
      description: "Lista de identificadores de permisos a asociar al perfil",
      content: {
        "application/json": {
          schema: ActualizarPermisosRolInputSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Permisos actualizados correctamente en la base de datos",
      content: {
        "application/json": {
          schema: ActualizarPermisosRolResponseSchema,
        },
      },
    },
    400: {
      description:
        "Identificador de rol no válido (debe ser UUID), payload inválido, permisos inexistentes o intento de revocar permiso crítico al Administrador",
    },
    401: { description: "Cabecera de autenticación X-User-Id ausente o usuario no válido" },
    403: { description: "Acceso denegado. Se requiere perfil de Administrador" },
    404: { description: "Perfil no encontrado" },
  },
});

// 7. GET /api/seguridad/usuario-activo (HU-5)
registry.registerPath({
  method: "get",
  path: "/api/seguridad/usuario-activo",
  summary: "Obtener usuario autenticado y permisos dinámicos",
  description:
    "Retorna los datos del usuario en sesión, su rol y la lista de todos los códigos de permisos asignados dinámicamente en tiempo real.",
  tags: ["Seguridad / Roles y Permisos"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del usuario autenticado"),
    }),
  },
  responses: {
    200: {
      description: "Datos del usuario activo y sus permisos dinámicos obtenidos exitosamente",
      content: {
        "application/json": {
          schema: UsuarioActivoResponseSchema,
        },
      },
    },
    401: { description: "Cabecera de autenticación ausente o usuario no registrado" },
    403: { description: "Acceso denegado o usuario inactivo en el sistema" },
    500: { description: "Error interno del servidor" },
  },
});

// ==========================================
// RUTAS AVISOS (CALL CENTER - HU-52)
// ==========================================

// 5. GET /api/incidentes/avisos
registry.registerPath({
  method: "get",
  path: "/api/incidentes/avisos",
  summary: "Listar avisos para Call Center con filtros multicriterio",
  description:
    "Retorna una lista paginada de avisos ordenados por mayor tiempo de espera calculando minutosEnEspera. Admite filtros combinados por delegación territorial, estado operativo, canal de origen y búsqueda textual libre. Requiere permiso incidentes:avisos:leer.",
  tags: ["Incidentes / Avisos"],
  request: {
    headers: z.object({
      authorization: z.string().describe("Token Bearer JWT de sesión"),
    }),
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
    400: { description: "Parámetros de consulta inválidos" },
    401: { description: "No autenticado o token Bearer inválido/expirado" },
    403: { description: "Acceso denegado. Permiso 'incidentes:avisos:leer' requerido" },
    500: { description: "Error interno del servidor" },
  },
});

// 6. GET /api/incidentes/avisos/{id}
registry.registerPath({
  method: "get",
  path: "/api/incidentes/avisos/{id}",
  summary: "Obtener detalle completo de un aviso",
  description:
    "Retorna información detallada de un aviso incluyendo coordenadas, informante y evidencia multimedia adjunta.",
  tags: ["Incidentes / Avisos"],
  request: {
    params: z.object({
      id: z.string().uuid().describe("UUID del aviso"),
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
    404: { description: "Aviso no encontrado" },
  },
});

// 7. POST y PATCH /api/incidentes/avisos/{id}/verificar
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos/{id}/verificar",
  summary: "Verificar y promover aviso a incidente",
  description:
    "Transforma atómicamente un aviso preliminar en un incidente formal ICS con bloqueo pesimista. Requiere permiso incidentes:avisos:verificar. Admite POST y PATCH.",
  tags: ["Incidentes / Avisos"],
  request: {
    params: z.object({
      id: z.string().uuid().describe("UUID del aviso a verificar"),
    }),
    headers: z.object({
      authorization: z.string().describe("Token Bearer JWT"),
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
    200: { description: "Aviso verificado y promovido a incidente exitosamente" },
    400: { description: "Datos de entrada inválidos" },
    401: { description: "No autenticado o token Bearer inválido/expirado" },
    403: { description: "No cuenta con el permiso requerido: incidentes:avisos:verificar" },
    404: { description: "Aviso no encontrado" },
    409: { description: "El aviso ya fue verificado o descartado previamente" },
    500: { description: "Error interno del servidor" },
  },
});

// 8. POST y PATCH /api/incidentes/avisos/{id}/descartar
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos/{id}/descartar",
  summary: "Descartar aviso motivado",
  description:
    "Descarta un aviso no procedente registrando la justificación obligatoria del operador. Requiere permiso incidentes:avisos:descartar. Admite POST y PATCH.",
  tags: ["Incidentes / Avisos"],
  request: {
    params: z.object({
      id: z.string().uuid().describe("UUID del aviso"),
    }),
    headers: z.object({
      authorization: z.string().describe("Token Bearer JWT"),
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
    200: { description: "Aviso descartado correctamente" },
    400: { description: "Justificación de descarte inválida o faltante" },
    401: { description: "No autenticado o token Bearer inválido/expirado" },
    403: { description: "No cuenta con el permiso requerido: incidentes:avisos:descartar" },
    404: { description: "Aviso no encontrado" },
    409: { description: "El aviso ya fue procesado previamente" },
    500: { description: "Error interno del servidor" },
  },
});

// ==========================================
// RUTAS INCIDENTES (CHATBOT, MANUAL, KANBAN)
// ==========================================

// 9. POST /api/incidentes/avisos (Chatbot informante)
registry.registerPath({
  method: "post",
  path: "/api/incidentes/avisos",
  description:
    "Permite al chatbot registrar un nuevo reporte de emergencia ciudadana con generación de código numérico de 8 dígitos y detección de duplicados.",
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
    400: { description: "Datos de entrada inválidos" },
    500: { description: "Error interno del servidor" },
  },
});

// 10. POST /api/incidentes/manual (HU-53)
registry.registerPath({
  method: "post",
  path: "/api/incidentes/manual",
  description:
    "Permite a operadores de Call Center y funcionarios ingresar un incidente directamente en estado REPORTADO con autoverificación implícita.",
  summary: "Ingreso manual de incidente (Call Center / Terreno)",
  tags: ["Incidentes"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del operador autenticado"),
    }),
    body: {
      description: "Datos del incidente ingresado manualmente",
      content: {
        "application/json": {
          schema: CrearIncidenteManualInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Incidente manual registrado exitosamente",
      content: {
        "application/json": {
          schema: CrearIncidenteManualResponseSchema,
        },
      },
    },
    400: { description: "Datos de entrada inválidos" },
    401: { description: "No autenticado / cabecera X-User-Id ausente" },
    403: { description: "No cuenta con el permiso requerido: crear_incidente_manual" },
    409: { description: "Conflicto por duplicados cercanos" },
    500: { description: "Error interno del servidor" },
  },
});

// 11. POST /api/incidentes/verificar-duplicado (HU-53)
registry.registerPath({
  method: "post",
  path: "/api/incidentes/verificar-duplicado",
  description:
    "Permite al Call Center consultar incidentes cercanos activos en un radio espacial para alertar visualmente antes de enviar el formulario.",
  summary: "Consultar duplicados para ingreso manual",
  tags: ["Incidentes"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("UUID del operador autenticado"),
    }),
    body: {
      description: "Parámetros de búsqueda espacial de incidentes cercanos",
      content: {
        "application/json": {
          schema: VerificarDuplicadoInputSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Consulta de duplicados completada exitosamente",
      content: {
        "application/json": {
          schema: VerificarDuplicadoResponseSchema,
        },
      },
    },
    400: { description: "Datos de entrada inválidos" },
    401: { description: "No autenticado / cabecera X-User-Id ausente" },
    403: { description: "No cuenta con el permiso requerido: crear_incidente_manual" },
    500: { description: "Error interno del servidor" },
  },
});

// 12. GET /api/incidentes/avisos/seguimiento/{codigo}
registry.registerPath({
  method: "get",
  path: "/api/incidentes/avisos/seguimiento/{codigo}",
  description:
    "Permite al ciudadano informante consultar el estado de avance de su reporte mediante su código de seguimiento numérico.",
  summary: "Consultar seguimiento de aviso",
  tags: ["Incidentes"],
  request: {
    params: z.object({
      codigo: z.string().describe("Código de seguimiento numérico de 8 dígitos"),
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
    400: { description: "Código de seguimiento inválido o no proporcionado" },
    404: { description: "No se encontró ningún reporte con el código de seguimiento indicado" },
    500: { description: "Error interno del servidor" },
  },
});

// 13. GET /api/incidentes/tipos
registry.registerPath({
  method: "get",
  path: "/api/incidentes/tipos",
  description:
    "Retorna el listado de opciones de afectación válidas para poblar los botones de respuesta rápida en el chatbot.",
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

// 14. GET /api/incidentes (Tablero Kanban Paginado - HU-15)
registry.registerPath({
  method: "get",
  path: "/api/incidentes",
  description:
    "Retorna el listado paginado de incidentes registrados en el SGRAI con filtros opcionales para el tablero Kanban del Encargado.",
  summary: "Listar incidentes para tablero Kanban (Encargado)",
  tags: ["Incidentes"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("ID del usuario Encargado o Administrador autenticado"),
    }),
    query: ListarIncidentesQuerySchema,
  },
  responses: {
    200: {
      description: "Listado de incidentes y metadatos de paginación obtenidos exitosamente",
      content: {
        "application/json": {
          schema: ListarIncidentesResponseSchema,
        },
      },
    },
    400: { description: "Parámetros de consulta no válidos" },
    401: { description: "No autenticado / cabecera X-User-Id ausente o inválida" },
    403: { description: "No cuenta con el permiso requerido: incidentes:kanban" },
    500: { description: "Error interno del servidor" },
  },
});

// 15. GET /api/incidentes/{id} (Detalle de Incidente - HU-15)
registry.registerPath({
  method: "get",
  path: "/api/incidentes/{id}",
  description:
    "Obtiene la información exhaustiva de un incidente específico, incluyendo informante, delegación, misiones operativas y recursos asociados.",
  summary: "Consultar detalle completo de un incidente",
  tags: ["Incidentes"],
  request: {
    headers: z.object({
      "x-user-id": z.string().uuid().describe("ID del usuario Encargado o Administrador autenticado"),
    }),
    params: z.object({
      id: z.string().uuid().describe("Identificador UUID del incidente"),
    }),
  },
  responses: {
    200: {
      description: "Detalle completo del incidente obtenido exitosamente",
      content: {
        "application/json": {
          schema: IncidenteDetalleResponseSchema,
        },
      },
    },
    400: { description: "Identificador de incidente no válido (debe ser UUID)" },
    401: { description: "No autenticado" },
    403: { description: "No autorizado / falta permiso incidentes:kanban" },
    404: { description: "Incidente no encontrado" },
    500: { description: "Error interno del servidor" },
  },
});

// 16. GET /api/personal (Listar empleados/personal - H34)
registry.registerPath({
  method: "get",
  path: "/api/personal",
  description:
    "Lista y busca empleados y personal operativo del SGRAI con filtros territoriales (delegacionId), estado operativo, cargo, especialidad, rol y búsqueda textual, con paginación estándar.",
  summary: "Listar empleados y personal",
  tags: ["Recursos y Personal"],
  request: {
    query: ListarPersonalQuerySchema,
  },
  responses: {
    200: {
      description: "Lista paginada de empleados y personal obtenida exitosamente",
      content: {
        "application/json": {
          schema: ListarPersonalResponseSchema,
        },
      },
    },
    400: { description: "Parámetros de consulta inválidos" },
    500: { description: "Error interno del servidor" },
  },
});

// 17. POST /api/personal (HU-10: Registrar Nuevo Funcionario)
registry.registerPath({
  method: "post",
  path: "/api/personal",
  description:
    "Registra a un nuevo funcionario o empleado municipal en el sistema SGRAI, aprovisionando su cuenta institucional y opcionalmente su ficha de terreno si su rol o funciones lo requieren.",
  summary: "Registrar nuevo funcionario",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      authorization: z.string().describe("Token Bearer JWT de sesión con rol Administrador"),
    }),
    body: {
      description: "Datos personales, asignación institucional y credenciales del nuevo funcionario",
      content: {
        "application/json": {
          schema: RegistrarEmpleadoSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Funcionario registrado exitosamente",
      content: {
        "application/json": {
          schema: RegistrarEmpleadoResponseSchema,
        },
      },
    },
    400: { description: "Rol o delegación inexistente o datos de solicitud inválidos" },
    401: { description: "No autorizado: Token de sesión ausente o expirado" },
    403: { description: "Acceso denegado: Se requiere perfil de Administrador" },
    409: { description: "Conflicto: RUT o correo electrónico ya registrado en el sistema" },
    422: { description: "Error de validación de campos o RUT con dígito verificador inválido" },
    500: { description: "Error interno del servidor al procesar el registro" },
  },
});

// 17. PATCH /api/personal/{id} (HU-12: Modificar Empleado)
registry.registerPath({
  method: "patch",
  path: "/api/personal/{id}",
  description:
    "Modifica los datos de un empleado, actualizando concurrentemente la información general de usuario y la ficha operativa de personal.",
  summary: "Modificar empleado y ficha operativa",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      "x-user-id": z.string().optional().describe("UUID del administrador que realiza la modificación"),
    }),
    params: z.object({
      id: z.string().uuid().describe("UUID del usuario o de la ficha de personal"),
    }),
    body: {
      description: "Datos a actualizar del empleado",
      content: {
        "application/json": {
          schema: ModificarEmpleadoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Empleado actualizado exitosamente",
      content: {
        "application/json": {
          schema: ActualizarEmpleadoResponseSchema,
        },
      },
    },
    400: { description: "Rol o delegación inexistente o datos inválidos" },
    404: { description: "Empleado no encontrado" },
    409: { description: "Conflicto: Correo electrónico o RUT ya registrado" },
    422: { description: "Error de validación de campos" },
    500: { description: "Error interno del servidor" },
  },
});

// GET /api/personal/{id} (Obtener detalle de empleado)
registry.registerPath({
  method: "get",
  path: "/api/personal/{id}",
  description:
    "Consulta los datos detallados de un empleado por ID (usuario_id o personal_id).",
  summary: "Obtener detalle de empleado",
  tags: ["Recursos y Personal"],
  request: {
    params: z.object({
      id: z.string().uuid().describe("UUID del usuario o de la ficha de personal"),
    }),
  },
  responses: {
    200: {
      description: "Detalle del empleado obtenido exitosamente",
      content: {
        "application/json": {
          schema: DetalleEmpleadoResponseSchema,
        },
      },
    },
    400: { description: "Identificador inválido (debe ser un UUID válido)" },
    401: { description: "No autenticado" },
    403: { description: "Acceso denegado" },
    404: { description: "Empleado no encontrado" },
    409: { description: "Conflicto con el recurso" },
    500: { description: "Error interno del servidor" },
  },
});

// DELETE /api/personal/{id} (HU-13: Baja Lógica de Empleado)
registry.registerPath({
  method: "delete",
  path: "/api/personal/{id}",
  description:
    "Ejecuta la baja lógica (soft-delete) de un empleado o funcionario en SGRAI, desactivando al usuario y marcando personal inactivo.",
  summary: "Baja lógica de empleado",
  tags: ["Recursos y Personal"],
  request: {
    headers: z.object({
      "x-user-id": z.string().optional().describe("UUID del administrador autenticado que ejecuta la baja lógica"),
    }),
    params: z.object({
      id: z.string().uuid().describe("UUID del usuario o de la ficha de personal"),
    }),
  },
  responses: {
    200: {
      description: "Empleado dado de baja exitosamente",
      content: {
        "application/json": {
          schema: EliminarEmpleadoResponseSchema,
        },
      },
    },
    400: { description: "Identificador inválido o solicitud incorrecta" },
    401: { description: "No autenticado o cabecera de autenticación ausente/inválida" },
    403: { description: "Acceso denegado: se requiere rol de Administrador" },
    404: { description: "Empleado no encontrado" },
    409: { description: "Conflicto: empleado en misión o patrulla activa" },
    500: { description: "Error interno del servidor" },
  },
});

// 18. GET /api/catalogos (Catálogos de roles, delegaciones, cargos y especialidades)
registry.registerPath({
  method: "get",
  path: "/api/catalogos",
  description:
    "Retorna los catálogos de referencia activos (roles, delegaciones, especialidades y cargos) para alimentar selectores en los frontends.",
  summary: "Obtener catálogos de referencia",
  tags: ["Recursos y Personal"],
  responses: {
    200: {
      description: "Catálogos de referencia obtenidos exitosamente",
      content: {
        "application/json": {
          schema: CatalogosResponseSchema,
        },
      },
    },
    500: { description: "Error interno del servidor" },
  },
});

// 19. GET /api/recursos/{id} (HU-8)
registry.registerPath({
  method: "get",
  path: "/api/recursos/{id}",
  summary: "Obtener detalle completo de un recurso logístico",
  description:
    "Retorna la información completa pre-cargada de un recurso (cantidades, disponibilidad operativa, delegación territorial y auditoría) para alimentar el formulario de edición. Accesible por perfil de Administrador.",
  tags: ["Recursos y Personal"],
  request: {
    params: RecursoIdParamSchema,
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
  },
  responses: {
    200: {
      description: "Detalle completo del recurso",
      content: {
        "application/json": {
          schema: RecursoDetalleResponseSchema,
        },
      },
    },
    400: {
      description: "Identificador de recurso inválido",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
    404: {
      description: "Recurso no encontrado",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// 20. PUT /api/recursos/{id} (HU-8)
registry.registerPath({
  method: "put",
  path: "/api/recursos/{id}",
  summary: "Editar características de un recurso logístico",
  description:
    "Modifica inventario físico, ubicación geográfica, detalles técnicos y estado operativo del recurso. Notifica en tiempo real vía WebSockets (Socket.io) a las salas de Encargado y Supervisor. Mantiene inmutable el tipo de recurso (esIndividual).",
  tags: ["Recursos y Personal"],
  request: {
    params: RecursoIdParamSchema,
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: ActualizarRecursoInputSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Recurso actualizado exitosamente",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: RecursoDetalleResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Datos de entrada inválidos o inventario menor a unidades en uso en terreno",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
    404: {
      description: "Recurso no encontrado",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// 20. GET /api/misiones (H34: Listado de misiones para Encargado)
registry.registerPath({
  method: "get",
  path: "/api/misiones",
  summary: "Listar misiones operativas con filtros y paginación",
  description:
    "Retorna una lista paginada de misiones operativas del SGRAI para el Encargado. Admite filtros combinados por estado, tipo táctico, prioridad, delegación territorial (vía incidente o patrulla/cuadrilla) y búsqueda textual libre.",
  tags: ["Misiones"],
  request: {
    headers: z.object({
      authorization: z.string().describe("Token Bearer JWT de sesión"),
    }),
    query: ListarMisionesQuerySchema,
  },
  responses: {
    200: {
      description: "Listado de misiones y metadatos de paginación obtenidos exitosamente",
      content: {
        "application/json": {
          schema: ListarMisionesResponseSchema,
        },
      },
    },
    400: { description: "Parámetros de consulta inválidos" },
    401: { description: "No autenticado o token ausente/inválido" },
    500: { description: "Error interno del servidor" },
  },
});

// 21. DELETE /api/recursos/{id} (HU-9)
registry.registerPath({
  method: "delete",
  path: "/api/recursos/{id}",
  summary: "Eliminar recurso del inventario (borrado lógico)",
  description:
    "Aplica un borrado lógico (soft delete) a un recurso existente registrando fecha, hora y usuario responsable. Impide la eliminación con código 409 Conflict si el recurso está actualmente en uso en terreno o asignado a una misión activa / cuadrilla. Emite evento WebSocket 'recurso:eliminado' a los clientes conectados.",
  tags: ["Recursos y Personal"],
  request: {
    params: RecursoIdParamSchema,
    headers: z.object({
      authorization: z.string().optional().describe("Token Bearer JWT de sesión"),
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
  },
  responses: {
    200: {
      description: "Recurso eliminado exitosamente (baja lógica aplicada)",
      content: {
        "application/json": {
          schema: EliminarRecursoResponseSchema,
        },
      },
    },
    400: {
      description: "Identificador de recurso inválido",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
    404: {
      description: "Recurso no encontrado o ya dado de baja",
    },
    409: {
      description: "Conflicto operativo: el recurso está asignado a una misión activa o cuadrilla en terreno",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});

// 22. GET /api/misiones/{id} (HU-17: Detalle Completo de Misión)
registry.registerPath({
  method: "get",
  path: "/api/misiones/{id}",
  description:
    "Obtiene la información exhaustiva de una misión operativa específica, incluyendo el incidente asociado o punto de prevención, la cuadrilla o patrulla asignada con sus recursos, la bitácora de tiempos y los reportes de terreno levantados con su evidencia multimedia.",
  summary: "Consultar detalle completo de una misión operativa",
  tags: ["Misiones"],
  request: {
    headers: z.object({
      authorization: z.string().optional().describe("Token Bearer JWT de sesión"),
      "x-user-id": z
        .string()
        .uuid()
        .optional()
        .openapi({ description: "ID del usuario Encargado, Administrador o Supervisor autenticado" }),
    }),
    params: z.object({
      id: MisionIdParamSchema,
    }),
  },
  responses: {
    200: {
      description: "Detalle completo de la misión obtenido exitosamente",
      content: {
        "application/json": {
          schema: MisionDetalleResponseSchema,
        },
      },
    },
    400: { description: "El identificador de la misión proporcionado no es un UUID válido" },
    401: { description: "No autenticado / cabecera X-User-Id ausente o inválida" },
    403: { description: "No cuenta con el permiso requerido: misiones:leer" },
    404: { description: "Misión no encontrada" },
    500: { description: "Error interno del servidor" },
  },
});

// 22. GET /api/incidentes/kpis (HU-18)
registry.registerPath({
  method: "get",
  path: "/api/incidentes/kpis",
  summary: "Obtener contadores y KPIs de incidentes del día",
  description:
    "Retorna los contadores numéricos consolidados de incidentes agrupados por los 5 estados canónicos (REPORTADO, VERIFICANDO, EN_ATENCION, NO_ABORDABLE, RESUELTO) para el día indicado o la fecha actual en Valdivia/Chile (America/Santiago). Admite filtrado opcional por delegación territorial.",
  tags: ["Incidentes"],
  request: {
    query: IncidentesKpisQuerySchema,
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario autenticado (Encargado o Admin)" }),
    }),
  },
  responses: {
    200: {
      description: "Contadores de incidentes del día obtenidos exitosamente",
      content: {
        "application/json": {
          schema: IncidentesKpisResponseSchema,
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
      description: "Acceso denegado. Permiso insuficiente",
    },
    500: {
      description: "Error interno del servidor",
    },
  },
});


// ==========================================
// RUTAS EVENTOS ATP (PUNTOS CRÍTICOS)
// ==========================================
registry.register("PuntoCriticoItem", PuntoCriticoItemResponseSchema);
registry.register("ListarPuntosCriticosResponse", ListarPuntosCriticosResponseSchema);
registry.register("EliminarPuntoCriticoResponse", EliminarPuntoCriticoResponseSchema);

// 23. GET /api/puntos-criticos (HU-57)
registry.registerPath({
  method: "get",
  path: "/api/puntos-criticos",
  summary: "Listar puntos críticos y sectores vulnerables",
  description:
    "Retorna la colección paginada de puntos críticos y sectores vulnerables monitoreados en Valdivia. Admite filtros por delegación, prioridad, estado activo y búsqueda textual. Requiere rol Administrador.",
  tags: ["Eventos ATP"],
  request: {
    query: ListarPuntosCriticosQuerySchema,
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
  },
  responses: {
    200: {
      description: "Colección paginada de puntos críticos obtenida exitosamente",
      content: {
        "application/json": {
          schema: ListarPuntosCriticosResponseSchema,
        },
      },
    },
    400: {
      description: "Parámetros de consulta inválidos",
    },
    401: {
      description: "No autenticado. Se requiere cabecera de autenticación válida",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador con permiso puntos_criticos:leer",
    },
    500: {
      description: "Error interno del servidor al procesar la solicitud",
    },
  },
});

// 23. POST /api/puntos-criticos (HU-58)
registry.registerPath({
  method: "post",
  path: "/api/puntos-criticos",
  summary: "Crear nuevo punto crítico o sector vulnerable",
  description:
    "Registra un nuevo punto crítico o sector vulnerable con coordenadas PostGIS (EPSG:4326), autogenera su código correlativo institucional y emite notificación en tiempo real vía Socket.io. Requiere rol Administrador con permiso puntos_criticos:crear.",
  tags: ["Eventos ATP"],
  request: {
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
    body: {
      description: "Datos requeridos para la creación del punto crítico",
      content: {
        "application/json": {
          schema: CrearPuntoCriticoBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Punto crítico creado exitosamente",
      content: {
        "application/json": {
          schema: PuntoCriticoDetalleResponseSchema,
        },
      },
    },
    400: {
      description: "Datos de creación inválidos o delegación no encontrada",
    },
    401: {
      description: "No autenticado. Se requiere cabecera de autenticación válida",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador con permiso puntos_criticos:crear",
    },
    409: {
      description: "Conflicto por código duplicado",
    },
    500: {
      description: "Error interno del servidor al procesar la solicitud",
    },
  },
});

// 24. GET /api/puntos-criticos/{id} (HU-55)
registry.registerPath({
  method: "get",
  path: "/api/puntos-criticos/{id}",
  summary: "Obtener detalle de punto crítico para edición",
  description:
    "Retorna el detalle completo de un punto crítico específico con su delegación territorial y auditoría para precargar el formulario de edición. Requiere rol Administrador.",
  tags: ["Eventos ATP"],
  request: {
    params: PuntoCriticoIdParamSchema,
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
  },
  responses: {
    200: {
      description: "Detalle del punto crítico obtenido exitosamente",
      content: {
        "application/json": {
          schema: PuntoCriticoDetalleResponseSchema,
        },
      },
    },
    400: {
      description: "Identificador de punto crítico inválido",
    },
    401: {
      description: "No autenticado. Se requiere cabecera de autenticación válida",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador",
    },
    404: {
      description: "Punto crítico no encontrado",
    },
    500: {
      description: "Error interno del servidor al procesar la solicitud",
    },
  },
});

// 24. PUT /api/puntos-criticos/{id} (HU-55)
registry.registerPath({
  method: "put",
  path: "/api/puntos-criticos/{id}",
  summary: "Editar características y ubicación de un punto crítico",
  description:
    "Modifica los datos y la ubicación geográfica (PostGIS EPSG:4326) de un punto crítico comunal. El código institucional es inmutable. Permite actualizar la ubicación en cualquier momento y emite notificación reactiva vía Socket.io a la central, supervisores y cuadrillas/patrullas.",
  tags: ["Eventos ATP"],
  request: {
    params: PuntoCriticoIdParamSchema,
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario administrador autenticado" }),
    }),
    body: {
      description: "Campos actualizables del punto crítico",
      content: {
        "application/json": {
          schema: ActualizarPuntoCriticoBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Punto crítico actualizado exitosamente",
      content: {
        "application/json": {
          schema: PuntoCriticoDetalleResponseSchema,
        },
      },
    },
    400: {
      description: "Parámetros de edición o formato inválidos",
    },
    401: {
      description: "No autenticado. Se requiere cabecera de autenticación válida",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador con permiso puntos_criticos:editar",
    },
    404: {
      description: "Punto crítico no encontrado",
    },
    409: {
      description: "Conflicto operativo: no es posible editar un punto crítico que se encuentra desactivado del sistema",
    },
    500: {
      description: "Error interno del servidor al procesar la solicitud",
    },
  },
});

// 25. DELETE /api/puntos-criticos/{id} (HU-56)
registry.registerPath({
  method: "delete",
  path: "/api/puntos-criticos/{id}",
  summary: "Desactivar punto crítico (borrado lógico)",
  description:
    "Aplica un borrado lógico (soft delete) a un punto crítico comunal registrando la fecha, hora y el identificador del usuario Administrador responsable. Impide la eliminación con código 409 Conflict si existen misiones preventivas activas (PLANIFICADA, DESPACHADA, EN_CURSO) o patrullas asignadas. Emite un evento en tiempo real vía Socket.io ('punto_critico:eliminado') para la actualización reactiva del mapa interactivo y la tabla.",
  tags: ["Eventos ATP"],
  request: {
    params: PuntoCriticoIdParamSchema,
    headers: z.object({
      authorization: z
        .string()
        .optional()
        .describe("Token Bearer JWT de sesión"),
      "x-user-id": z
        .string()
        .uuid()
        .optional()
        .describe("UUID del usuario Administrador autenticado"),
    }),
  },
  responses: {
    200: {
      description: "Punto crítico desactivado exitosamente (baja lógica aplicada)",
      content: {
        "application/json": {
          schema: EliminarPuntoCriticoResponseSchema,
        },
      },
    },
    400: {
      description: "Identificador UUID de punto crítico inválido",
    },
    401: {
      description: "Cabecera de autenticación ausente o token no válido",
    },
    403: {
      description: "Acceso denegado. Se requiere perfil de Administrador con permiso puntos_criticos:eliminar",
    },
    404: {
      description: "Punto crítico no encontrado o ya dado de baja",
    },
    409: {
      description: "Conflicto operativo: existen misiones preventivas activas en curso o patrullas asignadas en el lugar",
    },
    500: {
      description: "Error interno del servidor al procesar la solicitud",
    },
  },
});

// ==========================================
// RUTAS EVENTOS ATP (RECUPERACIÓN)
// ==========================================

// 26. POST /api/eventos-atp/recuperacion (HU-29)
registry.register("CrearEventoRecuperacionInput", CrearEventoRecuperacionInputSchema);
registry.register("EventoRecuperacion", EventoRecuperacionResponseSchema);
registry.register("CrearEventoRecuperacionResponse", CrearEventoRecuperacionResponseSchema);

registry.registerPath({
  method: "post",
  path: "/api/eventos-atp/recuperacion",
  summary: "Crear evento de recuperación y despachar patrulla con recursos logísticos (HU-29)",
  description:
    "Permite al Encargado de operaciones generar un nuevo evento territorial de recuperación, asignando una patrulla verificadora disponible y recursos de inventario para su entrega directa en terreno, sin requerir la existencia formal de un incidente previo.",
  tags: ["Eventos ATP / Recuperación"],
  request: {
    headers: z.object({
      "x-user-id": z
        .string()
        .uuid()
        .openapi({ description: "UUID del usuario autenticado (Encargado o Administrador)" }),
    }),
    body: {
      description: "Datos del evento de recuperación, sector geográfico, patrulla y recursos solicitados",
      content: {
        "application/json": {
          schema: CrearEventoRecuperacionInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Evento de recuperación registrado exitosamente y patrulla despachada",
      content: {
        "application/json": {
          schema: CrearEventoRecuperacionResponseSchema,
        },
      },
    },
    400: {
      description: "Datos de entrada inválidos o faltantes en el payload",
    },
    401: {
      description: "No autenticado / cabecera X-User-Id ausente o inválida",
    },
    403: {
      description: "Acceso denegado. Se requiere permiso 'recuperacion:crear'",
    },
    404: {
      description: "Patrulla o recurso no encontrado en el sistema",
    },
    409: {
      description: "Conflicto operativo: Patrulla no disponible o stock insuficiente en bodega",
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
      version: "0.9.0",
      title: "SGRAI API",
      description:
        "Documentación técnica de la API del Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI).",
    },
    servers: [{ url: "/" }, { url: "http://localhost:3000", description: "Servidor de desarrollo local" }],
  });
}

// Alias para compatibilidad de nomenclatura
export const generarOpenApiSpec = generarOpenAPISpec;
