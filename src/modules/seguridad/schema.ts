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
