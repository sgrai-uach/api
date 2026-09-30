import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

/**
 * Esquema de permiso asignado a un perfil, incluyendo datos de auditoría.
 */
export const PermisoAsignadoSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "UUID del permiso",
      example: "10000000-0000-0000-0000-000000000003",
    }),
    codigo: z.string().openapi({
      description: "Código único de autorización del permiso",
      example: "seguridad:roles:leer",
    }),
    nombre: z.string().openapi({
      description: "Nombre legible del permiso",
      example: "Visualizar Roles y Permisos",
    }),
    descripcion: z.string().nullable().openapi({
      description: "Descripción detallada de la acción permitida",
      example: "Permite consultar el listado y detalle de perfiles y sus permisos actuales",
    }),
    modulo: z.string().openapi({
      description: "Módulo funcional al que pertenece el permiso",
      example: "Seguridad",
    }),
    asignadoEn: z.string().openapi({
      description: "Fecha y hora ISO de la asignación del permiso al rol",
      example: "2026-09-13T23:00:00.000Z",
    }),
    asignadoPorId: z.string().uuid().nullable().openapi({
      description: "UUID del usuario administrador que realizó la asignación",
      example: "00000000-0000-0000-0000-000000000001",
    }),
  })
  .openapi("PermisoAsignado");

export type PermisoAsignado = z.infer<typeof PermisoAsignadoSchema>;

/**
 * Esquema de un Perfil/Rol con su lista de permisos y metadatos de auditoría.
 */
export const RolItemSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "UUID del rol/perfil",
      example: "20000000-0000-0000-0000-000000000001",
    }),
    nombre: z.string().openapi({
      description: "Nombre del perfil institucional",
      example: "Administrador",
    }),
    descripcion: z.string().nullable().openapi({
      description: "Descripción de las responsabilidades del perfil",
      example: "Acceso total y configuración del sistema",
    }),
    activo: z.boolean().openapi({
      description: "Indica si el perfil se encuentra activo en el sistema",
      example: true,
    }),
    esSistema: z.boolean().openapi({
      description: "Indica si es un perfil base protegido del sistema",
      example: true,
    }),
    cantidadPermisos: z.number().int().nonnegative().openapi({
      description: "Total de permisos actualmente asignados al rol",
      example: 9,
    }),
    permisos: z.array(PermisoAsignadoSchema).openapi({
      description: "Lista de permisos asignados. Si no posee ninguno, retorna un arreglo vacío",
    }),
    creadoEn: z.string().openapi({
      description: "Fecha y hora ISO de creación del perfil",
      example: "2026-09-13T23:00:00.000Z",
    }),
    actualizadoEn: z.string().openapi({
      description: "Fecha y hora ISO de la última actualización del perfil",
      example: "2026-09-13T23:00:00.000Z",
    }),
  })
  .openapi("RolItem");

export type RolItem = z.infer<typeof RolItemSchema>;

/**
 * Esquema de respuesta para el listado de roles y permisos.
 */
export const ListarRolesResponseSchema = z
  .object({
    data: z.array(RolItemSchema).openapi({
      description: "Colección de perfiles con sus permisos asignados",
    }),
    total: z.number().int().nonnegative().openapi({
      description: "Cantidad total de perfiles registrados",
      example: 8,
    }),
  })
  .openapi("ListarRolesResponse");

export type ListarRolesResponse = z.infer<typeof ListarRolesResponseSchema>;

/**
 * Esquema de respuesta para el detalle de un rol específico.
 */
export const RolDetalleResponseSchema = z
  .object({
    data: RolItemSchema.openapi({
      description: "Detalle del perfil y sus permisos asignados",
    }),
  })
  .openapi("RolDetalleResponse");

export type RolDetalleResponse = z.infer<typeof RolDetalleResponseSchema>;

/**
 * Esquema de un ítem del catálogo general de permisos clasificado por módulo.
 */
export const PermisoCatalogoItemSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "UUID del permiso",
      example: "10000000-0000-4000-8000-000000000001",
    }),
    codigo: z.string().openapi({
      description: "Código único de autorización del permiso",
      example: "recursos:crear",
    }),
    nombre: z.string().openapi({
      description: "Nombre legible del permiso",
      example: "Crear Recursos",
    }),
    descripcion: z.string().nullable().openapi({
      description: "Descripción detallada de la acción permitida",
      example: "Permite crear nuevos recursos en el inventario logístico",
    }),
    modulo: z.string().openapi({
      description: "Módulo funcional al que pertenece el permiso",
      example: "Recursos y Personal",
    }),
  })
  .openapi("PermisoCatalogoItem");

export type PermisoCatalogoItem = z.infer<typeof PermisoCatalogoItemSchema>;

/**
 * Esquema de respuesta para el catálogo completo de permisos del sistema.
 */
export const ListarPermisosResponseSchema = z
  .object({
    data: z.array(PermisoCatalogoItemSchema).openapi({
      description: "Colección completa de permisos clasificados por módulo funcional",
    }),
    total: z.number().int().nonnegative().openapi({
      description: "Cantidad total de permisos registrados en el catálogo",
      example: 9,
    }),
  })
  .openapi("ListarPermisosResponse");

export type ListarPermisosResponse = z.infer<typeof ListarPermisosResponseSchema>;

/**
 * Esquema de entrada para actualizar atómicamente los permisos asignados a un rol.
 */
export const ActualizarPermisosRolInputSchema = z
  .object({
    permisoIds: z.array(z.string().uuid()).openapi({
      description: "Lista de UUIDs de permisos a asignar al perfil (reemplazo masivo atómico)",
      example: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000003",
      ],
    }),
  })
  .openapi("ActualizarPermisosRolInput");

export type ActualizarPermisosRolInput = z.infer<
  typeof ActualizarPermisosRolInputSchema
>;

/**
 * Esquema de respuesta tras la actualización exitosa de permisos de un perfil.
 */
export const ActualizarPermisosRolResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Mensaje confirmando la actualización atómica en la base de datos",
      example: "Permisos actualizados correctamente en la base de datos",
    }),
    data: RolItemSchema.openapi({
      description: "Detalle del perfil y sus permisos asignados actualizados",
    }),
  })
  .openapi("ActualizarPermisosRolResponse");

export type ActualizarPermisosRolResponse = z.infer<
  typeof ActualizarPermisosRolResponseSchema
>;

/**
 * Esquema de validación para el parámetro de ruta 'id' del rol (UUID RFC 4122).
 */
export const RolIdParamSchema = z
  .string()
  .uuid("El identificador de rol proporcionado no es un UUID válido.")
  .openapi({
    description: "UUID del rol/perfil institucional",
    example: "20000000-0000-4000-8000-000000000001",
  });

export type RolIdParam = z.infer<typeof RolIdParamSchema>;

/**
 * Esquema del rol asignado al usuario activo en sesión.
 */
export const UsuarioActivoRolSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "UUID del rol asignado",
      example: "20000000-0000-4000-8000-000000000001",
    }),
    nombre: z.string().openapi({
      description: "Nombre del rol institucional",
      example: "Administrador",
    }),
    codigo: z.string().openapi({
      description: "Código identificador del rol",
      example: "ADMIN",
    }),
    esAdmin: z.boolean().openapi({
      description: "Indica si el usuario tiene privilegios de Administrador global",
      example: true,
    }),
  })
  .openapi("UsuarioActivoRol");

export type UsuarioActivoRol = z.infer<typeof UsuarioActivoRolSchema>;

/**
 * Esquema del ítem consolidado de usuario activo con sus permisos dinámicos.
 */
export const UsuarioActivoItemSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "UUID del usuario autenticado",
      example: "00000000-0000-4000-8000-000000000001",
    }),
    rut: z.string().openapi({
      description: "RUT del funcionario o informante autenticado",
      example: "11111111-1",
    }),
    nombre: z.string().openapi({
      description: "Nombre y apellidos del usuario",
      example: "Administrador Municipal",
    }),
    email: z.string().email().openapi({
      description: "Correo institucional del usuario",
      example: "admin@valdivia.cl",
    }),
    activo: z.boolean().openapi({
      description: "Indica si la cuenta del usuario está habilitada",
      example: true,
    }),
    delegacionId: z.string().uuid().nullable().optional().openapi({
      description: "UUID de la delegación territorial a la que pertenece (si aplica)",
      example: "30000000-0000-4000-8000-000000000001",
    }),
    rol: UsuarioActivoRolSchema.openapi({
      description: "Información del rol institucional asignado",
    }),
    permisos: z.array(z.string()).openapi({
      description: "Lista de códigos de permisos asignados en tiempo real al usuario",
      example: ["seguridad:roles:leer", "seguridad:roles:gestionar"],
    }),
  })
  .openapi("UsuarioActivoItem");

export type UsuarioActivoItem = z.infer<typeof UsuarioActivoItemSchema>;

/**
 * Esquema de respuesta para GET /api/seguridad/usuario-activo.
 */
export const UsuarioActivoResponseSchema = z
  .object({
    data: UsuarioActivoItemSchema.openapi({
      description: "Datos del usuario activo y sus permisos dinámicos",
    }),
  })
  .openapi("UsuarioActivoResponse");

export type UsuarioActivoResponse = z.infer<typeof UsuarioActivoResponseSchema>;

/**
 * Esquema de entrada para autenticación de usuario (login).
 */
export const LoginRequestSchema = z
  .object({
    identificador: z
      .string()
      .trim()
      .min(1, "El identificador (correo o RUT) es obligatorio")
      .openapi({
        description: "Correo electrónico corporativo (@valdivia.cl) o RUT chileno del funcionario",
        example: "admin@valdivia.cl",
      }),
    password: z
      .string()
      .min(1, "La contraseña es obligatoria")
      .openapi({
        description: "Contraseña en texto plano para autenticación",
        example: "Valdivia2026!",
      }),
  })
  .openapi("LoginRequest");

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Esquema del perfil de usuario autenticado retornado en la sesión.
 */
export const UsuarioPerfilSesionSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "UUID del usuario autenticado",
      example: "00000000-0000-4000-8000-000000000001",
    }),
    rut: z.string().openapi({
      description: "RUT chileno del usuario",
      example: "11111111-1",
    }),
    nombre: z.string().openapi({
      description: "Nombre completo consolidado",
      example: "Administrador General",
    }),
    email: z.string().email().openapi({
      description: "Correo corporativo",
      example: "admin@valdivia.cl",
    }),
    rolId: z.string().uuid().openapi({
      description: "UUID del rol asignado",
      example: "20000000-0000-4000-8000-000000000001",
    }),
    rolNombre: z.string().openapi({
      description: "Nombre del rol",
      example: "Administrador",
    }),
    rolCodigo: z.string().openapi({
      description: "Código canónico del rol",
      example: "ADMIN",
    }),
    delegacionId: z.string().uuid().nullable().openapi({
      description: "UUID de la delegación territorial asignada (si aplica)",
      example: "30000000-0000-4000-8000-000000000001",
    }),
    permisos: z.array(z.string()).openapi({
      description: "Lista de códigos de permisos activos del usuario",
      example: ["seguridad:roles:leer", "seguridad:roles:gestionar"],
    }),
  })
  .openapi("UsuarioPerfilSesion");

export type UsuarioPerfilSesion = z.infer<typeof UsuarioPerfilSesionSchema>;

/**
 * Datos internos de la respuesta de inicio de sesión exitoso.
 */
export const LoginDataSchema = z
  .object({
    token: z.string().openapi({
      description: "Token JWT de sesión para cabecera Authorization: Bearer <token>",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
    tipoToken: z.literal("Bearer").openapi({
      description: "Tipo de token para uso en cabecera HTTP",
      example: "Bearer",
    }),
    expiraEn: z.string().openapi({
      description: "Fecha y hora ISO de expiración del token",
      example: "2026-10-01T04:00:00.000Z",
    }),
    usuario: UsuarioPerfilSesionSchema,
  })
  .openapi("LoginData");

export type LoginData = z.infer<typeof LoginDataSchema>;

/**
 * Esquema de respuesta para POST /api/seguridad/login.
 */
export const LoginResponseSchema = z
  .object({
    data: LoginDataSchema,
  })
  .openapi("LoginResponse");

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

