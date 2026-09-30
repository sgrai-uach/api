import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getRolesHandler } from "../../../app/api/seguridad/roles/route";
import { GET as getRolDetalleHandler } from "../../../app/api/seguridad/roles/[id]/route";
import { GET as getPermisosHandler } from "../../../app/api/seguridad/permisos/route";
import { PUT as putRolPermisosHandler } from "../../../app/api/seguridad/roles/[id]/permisos/route";
import { GET as getUsuarioActivoHandler } from "../../../app/api/seguridad/usuario-activo/route";
import { db } from "../../../lib/db";
import { generarOpenApiSpec } from "../../../lib/openapi";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../errors";
import { PERMISO_GESTIONAR_ROLES } from "../permisos.constants";
import {
  seguridadRepository,
  type SeguridadRepository,
  SeguridadRepository as SeguridadRepositoryClass,
} from "../repository";
import {
  ActualizarPermisosRolInputSchema,
  ActualizarPermisosRolResponseSchema,
  ListarPermisosResponseSchema,
  ListarRolesResponseSchema,
  PermisoAsignadoSchema,
  PermisoCatalogoItemSchema,
  RolDetalleResponseSchema,
  RolItemSchema,
  UsuarioActivoItemSchema,
  UsuarioActivoResponseSchema,
  UsuarioActivoRolSchema,
} from "../schema";
import { SeguridadService } from "../service";
import type {
  PermisoCatalogoItemDTO,
  RolItemDTO,
  UsuarioAutenticado,
} from "../types";

describe("Módulo de Seguridad — Esquemas Zod", () => {
  it("debe validar un permiso asignado con todos sus campos de auditoría", () => {
    const permisoValido = {
      id: "10000000-0000-4000-8000-000000000003",
      codigo: "seguridad:roles:leer",
      nombre: "Visualizar Roles y Permisos",
      descripcion: "Permite consultar el listado y detalle de perfiles",
      modulo: "Seguridad",
      asignadoEn: new Date().toISOString(),
      asignadoPorId: "00000000-0000-4000-8000-000000000001",
    };

    const resultado = PermisoAsignadoSchema.safeParse(permisoValido);
    expect(resultado.success).toBe(true);
  });

  it("debe validar un rol con múltiples permisos y auditoría", () => {
    const rolConPermisos = {
      id: "20000000-0000-4000-8000-000000000001",
      nombre: "Administrador",
      descripcion: "Acceso total y configuración del sistema",
      activo: true,
      esSistema: true,
      cantidadPermisos: 1,
      permisos: [
        {
          id: "10000000-0000-4000-8000-000000000003",
          codigo: "seguridad:roles:leer",
          nombre: "Visualizar Roles y Permisos",
          descripcion: null,
          modulo: "Seguridad",
          asignadoEn: new Date().toISOString(),
          asignadoPorId: null,
        },
      ],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    const resultado = RolItemSchema.safeParse(rolConPermisos);
    expect(resultado.success).toBe(true);
  });

  it("debe validar un rol sin permisos asignados (Criterio 4: 'Sin permisos asignados')", () => {
    const rolVacio = {
      id: "20000000-0000-4000-8000-000000000008",
      nombre: "Observador Sin Permisos",
      descripcion: "Perfil de auditoría sin permisos operativos",
      activo: true,
      esSistema: false,
      cantidadPermisos: 0,
      permisos: [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    const resultado = RolItemSchema.safeParse(rolVacio);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.permisos).toHaveLength(0);
      expect(resultado.data.cantidadPermisos).toBe(0);
    }
  });

  it("debe rechazar un rol con UUID inválido", () => {
    const rolInvalido = {
      id: "no-es-uuid",
      nombre: "Rol Invalido",
      descripcion: null,
      activo: true,
      esSistema: false,
      cantidadPermisos: 0,
      permisos: [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    const resultado = RolItemSchema.safeParse(rolInvalido);
    expect(resultado.success).toBe(false);
  });

  it("debe validar la estructura completa de ListarRolesResponse", () => {
    const respuesta = {
      data: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          nombre: "Administrador",
          descripcion: "Acceso total",
          activo: true,
          esSistema: true,
          cantidadPermisos: 0,
          permisos: [],
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        },
      ],
      total: 1,
    };

    const resultado = ListarRolesResponseSchema.safeParse(respuesta);
    expect(resultado.success).toBe(true);
  });

  it("debe validar la estructura completa de RolDetalleResponse", () => {
    const detalle = {
      data: {
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Administrador",
        descripcion: "Acceso total",
        activo: true,
        esSistema: true,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
    };

    const resultado = RolDetalleResponseSchema.safeParse(detalle);
    expect(resultado.success).toBe(true);
  });

  it("debe validar un ítem del catálogo de permisos (PermisoCatalogoItemSchema)", () => {
    const item = {
      id: "10000000-0000-4000-8000-000000000001",
      codigo: "recursos:crear",
      nombre: "Crear Recursos",
      descripcion: "Permite crear nuevos recursos en el inventario logístico",
      modulo: "Recursos y Personal",
    };

    const resultado = PermisoCatalogoItemSchema.safeParse(item);
    expect(resultado.success).toBe(true);
  });

  it("debe rechazar un ítem del catálogo de permisos con UUID inválido o campos faltantes", () => {
    const invalido = {
      id: "no-es-uuid",
      codigo: "recursos:crear",
      nombre: "Crear Recursos",
    };

    const resultado = PermisoCatalogoItemSchema.safeParse(invalido);
    expect(resultado.success).toBe(false);
  });

  it("debe validar ListarPermisosResponseSchema con múltiples permisos clasificados", () => {
    const respuesta = {
      data: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          codigo: "recursos:crear",
          nombre: "Crear Recursos",
          descripcion: null,
          modulo: "Recursos y Personal",
        },
      ],
      total: 1,
    };

    const resultado = ListarPermisosResponseSchema.safeParse(respuesta);
    expect(resultado.success).toBe(true);
  });

  it("debe validar ActualizarPermisosRolInputSchema con arreglo de UUIDs válido", () => {
    const inputValido = {
      permisoIds: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000003",
      ],
    };

    const resultado = ActualizarPermisosRolInputSchema.safeParse(inputValido);
    expect(resultado.success).toBe(true);
  });

  it("debe rechazar ActualizarPermisosRolInputSchema si contiene UUIDs no conformes", () => {
    const inputInvalido = {
      permisoIds: ["no-uuid", "10000000-0000-4000-8000-000000000001"],
    };

    const resultado = ActualizarPermisosRolInputSchema.safeParse(inputInvalido);
    expect(resultado.success).toBe(false);
  });

  it("debe validar ActualizarPermisosRolResponseSchema", () => {
    const respuesta = {
      message: "Permisos actualizados correctamente en la base de datos",
      data: {
        id: "20000000-0000-4000-8000-000000000002",
        nombre: "Call Center",
        descripcion: "Recepción de avisos y despacho primario",
        activo: true,
        esSistema: true,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
    };

    const resultado = ActualizarPermisosRolResponseSchema.safeParse(respuesta);
    expect(resultado.success).toBe(true);
  });

  it("debe validar la estructura completa de UsuarioActivoResponseSchema", () => {
    const payloadValido = {
      data: {
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Administrador Municipal",
        email: "admin@valdivia.cl",
        activo: true,
        delegacionId: "30000000-0000-4000-8000-000000000001",
        rol: {
          id: "20000000-0000-4000-8000-000000000001",
          nombre: "Administrador",
          codigo: "ADMIN",
          esAdmin: true,
        },
        permisos: ["seguridad:roles:leer", "seguridad:roles:gestionar"],
      },
    };

    const resultado = UsuarioActivoResponseSchema.safeParse(payloadValido);
    expect(resultado.success).toBe(true);
  });

  it("debe aceptar UsuarioActivoResponseSchema con delegacionId nulo u omitido", () => {
    const payloadSinDelegacion = {
      data: {
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Administrador Central",
        email: "admin@valdivia.cl",
        activo: true,
        delegacionId: null,
        rol: {
          id: "20000000-0000-4000-8000-000000000001",
          nombre: "Administrador",
          codigo: "ADMIN",
          esAdmin: true,
        },
        permisos: [],
      },
    };

    expect(UsuarioActivoResponseSchema.safeParse(payloadSinDelegacion).success).toBe(true);
  });

  it("debe rechazar UsuarioActivoResponseSchema con email inválido o UUID incorrecto", () => {
    const payloadInvalido = {
      data: {
        id: "no-es-uuid",
        rut: "11111111-1",
        nombre: "Usuario Test",
        email: "correo-invalido",
        activo: true,
        rol: {
          id: "20000000-0000-4000-8000-000000000001",
          nombre: "Call Center",
          codigo: "CALL_CENTER",
          esAdmin: false,
        },
        permisos: [],
      },
    };

    expect(UsuarioActivoResponseSchema.safeParse(payloadInvalido).success).toBe(false);
  });
});

describe("Módulo de Seguridad — Control de Acceso RBAC y Lógica de Servicio", () => {
  it("debe lanzar UnauthorizedError si no se proporciona usuarioId", async () => {
    const service = new SeguridadService({} as unknown as SeguridadRepository);

    await expect(service.validarAccesoAdministrador(undefined)).rejects.toThrow(
      UnauthorizedError
    );
    await expect(service.validarAccesoAdministrador("")).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("debe lanzar UnauthorizedError si el usuario no existe en el sistema", async () => {
    const mockRepo = {
      obtenerUsuarioConRolPorId: vi.fn().mockResolvedValue(null),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    await expect(
      service.validarAccesoAdministrador("00000000-0000-4000-8000-000000000999")
    ).rejects.toThrow(UnauthorizedError);
  });

  it("debe lanzar UnauthorizedError si el usuario está inactivo", async () => {
    const mockRepo = {
      obtenerUsuarioConRolPorId: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin Inactivo",
        email: "admin_inactivo@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: false,
      } as UsuarioAutenticado),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    await expect(
      service.validarAccesoAdministrador("00000000-0000-4000-8000-000000000001")
    ).rejects.toThrow(UnauthorizedError);
  });

  it("debe lanzar ForbiddenError si el usuario tiene un perfil distinto a Administrador", async () => {
    const mockRepo = {
      obtenerUsuarioConRolPorId: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000002",
        rut: "22222222-2",
        nombre: "Operador Call Center",
        email: "callcenter@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000002",
        rolNombre: "Call Center",
        activo: true,
      } as UsuarioAutenticado),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    await expect(
      service.validarAccesoAdministrador("00000000-0000-4000-8000-000000000002")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe permitir el acceso si el usuario está activo y posee rol de Administrador", async () => {
    const mockUser: UsuarioAutenticado = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
      activo: true,
    };

    const mockRepo = {
      obtenerUsuarioConRolPorId: vi.fn().mockResolvedValue(mockUser),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    const user = await service.validarAccesoAdministrador(mockUser.id);
    expect(user.rolNombre).toBe("Administrador");
    expect(user.activo).toBe(true);
  });

  it("debe listar correctamente todos los roles con permisos y conteos", async () => {
    const mockRoles: RolItemDTO[] = [
      {
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Administrador",
        descripcion: "Acceso total",
        activo: true,
        esSistema: true,
        cantidadPermisos: 2,
        permisos: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            codigo: "recursos:crear",
            nombre: "Crear Recursos",
            descripcion: null,
            modulo: "Recursos y Personal",
            asignadoEn: new Date().toISOString(),
            asignadoPorId: null,
          },
          {
            id: "10000000-0000-4000-8000-000000000003",
            codigo: "seguridad:roles:leer",
            nombre: "Visualizar Roles",
            descripcion: null,
            modulo: "Seguridad",
            asignadoEn: new Date().toISOString(),
            asignadoPorId: null,
          },
        ],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
      {
        id: "20000000-0000-4000-8000-000000000008",
        nombre: "Observador Sin Permisos",
        descripcion: "Sin permisos",
        activo: true,
        esSistema: false,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
    ];

    const mockRepo = {
      obtenerTodosLosRolesConPermisos: vi.fn().mockResolvedValue(mockRoles),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    const resultado = await service.listarRoles();

    expect(resultado.total).toBe(2);
    expect(resultado.data).toHaveLength(2);
    expect(resultado.data[0].cantidadPermisos).toBe(2);
    expect(resultado.data[1].cantidadPermisos).toBe(0);
    expect(resultado.data[1].permisos).toEqual([]);
  });

  it("debe retornar el detalle de un rol existente", async () => {
    const mockRol: RolItemDTO = {
      id: "20000000-0000-4000-8000-000000000001",
      nombre: "Administrador",
      descripcion: "Acceso total",
      activo: true,
      esSistema: true,
      cantidadPermisos: 0,
      permisos: [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    const mockRepo = {
      obtenerRolPorId: vi.fn().mockResolvedValue(mockRol),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    const resultado = await service.obtenerDetalleRol(mockRol.id);

    expect(resultado.data.nombre).toBe("Administrador");
    expect(resultado.data.id).toBe(mockRol.id);
  });

  it("debe lanzar NotFoundError al solicitar detalle de rol inexistente", async () => {
    const mockRepo = {
      obtenerRolPorId: vi.fn().mockResolvedValue(null),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);
    await expect(
      service.obtenerDetalleRol("00000000-0000-4000-8000-000000000999")
    ).rejects.toThrow(NotFoundError);
  });

  it("debe responder en menos de 1.5 segundos (Criterio de Aceptación: < 1.5s)", async () => {
    const mockRoles: RolItemDTO[] = Array.from({ length: 50 }).map((_, i) => ({
      id: `20000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`,
      nombre: `Rol ${i}`,
      descripcion: `Descripción ${i}`,
      activo: true,
      esSistema: false,
      cantidadPermisos: 5,
      permisos: Array.from({ length: 5 }).map((_, j) => ({
        id: `10000000-0000-4000-8000-0000000000${String(j).padStart(2, "0")}`,
        codigo: `modulo${j}:accion${j}`,
        nombre: `Permiso ${j}`,
        descripcion: null,
        modulo: `Modulo ${j}`,
        asignadoEn: new Date().toISOString(),
        asignadoPorId: null,
      })),
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    }));

    const mockRepo = {
      obtenerTodosLosRolesConPermisos: vi.fn().mockResolvedValue(mockRoles),
    } as unknown as SeguridadRepository;

    const service = new SeguridadService(mockRepo);

    const inicio = performance.now();
    const resultado = await service.listarRoles();
    const fin = performance.now();
    const duracionMs = fin - inicio;

    expect(resultado.total).toBe(50);
    expect(duracionMs).toBeLessThan(1500);
  });

  describe("HU-5: Gestión y Mutación de Permisos en SeguridadService", () => {
    it("debe listar el catálogo de permisos completo", async () => {
      const mockPermisos: PermisoCatalogoItemDTO[] = [
        {
          id: "10000000-0000-4000-8000-000000000001",
          codigo: "recursos:crear",
          nombre: "Crear Recursos",
          descripcion: null,
          modulo: "Recursos y Personal",
        },
        {
          id: "10000000-0000-4000-8000-000000000004",
          codigo: PERMISO_GESTIONAR_ROLES,
          nombre: "Gestionar Roles",
          descripcion: null,
          modulo: "Seguridad",
        },
      ];

      const mockRepo = {
        obtenerTodosLosPermisos: vi.fn().mockResolvedValue(mockPermisos),
      } as unknown as SeguridadRepository;

      const service = new SeguridadService(mockRepo);
      const resultado = await service.listarPermisos();

      expect(resultado.total).toBe(2);
      expect(resultado.data).toEqual(mockPermisos);
    });

    it("debe lanzar NotFoundError al actualizar permisos de un rol inexistente", async () => {
      const mockRepo = {
        obtenerRolPorId: vi.fn().mockResolvedValue(null),
      } as unknown as SeguridadRepository;

      const service = new SeguridadService(mockRepo);
      const admin: UsuarioAutenticado = {
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      };

      await expect(
        service.actualizarPermisosRol(
          "20000000-0000-4000-8000-000000000999",
          ["10000000-0000-4000-8000-000000000001"],
          admin
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("debe rechazar con BadRequestError si se intenta revocar 'seguridad:roles:gestionar' al Administrador (Protección Auto-bloqueo)", async () => {
      const rolAdmin: RolItemDTO = {
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Administrador",
        descripcion: "Acceso total",
        activo: true,
        esSistema: true,
        cantidadPermisos: 1,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      const mockRepo = {
        obtenerRolPorId: vi.fn().mockResolvedValue(rolAdmin),
        obtenerPermisoPorCodigo: vi.fn().mockResolvedValue({
          id: "10000000-0000-4000-8000-000000000004",
          codigo: PERMISO_GESTIONAR_ROLES,
          nombre: "Gestionar Roles",
          descripcion: null,
          modulo: "Seguridad",
        }),
      } as unknown as SeguridadRepository;

      const service = new SeguridadService(mockRepo);
      const admin: UsuarioAutenticado = {
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      };

      // Se intenta asignar sólo un permiso que NO es seguridad:roles:gestionar
      await expect(
        service.actualizarPermisosRol(
          rolAdmin.id,
          ["10000000-0000-4000-8000-000000000001"],
          admin
        )
      ).rejects.toThrow(
        "El permiso 'seguridad:roles:gestionar' es obligatorio para el perfil Administrador y no puede ser revocado."
      );
    });

    it("debe actualizar exitosamente los permisos de un rol y retornar la respuesta con mensaje y detalle", async () => {
      const rolCallCenter: RolItemDTO = {
        id: "20000000-0000-4000-8000-000000000002",
        nombre: "Call Center",
        descripcion: "Recepción de avisos",
        activo: true,
        esSistema: true,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      const rolActualizado: RolItemDTO = {
        ...rolCallCenter,
        cantidadPermisos: 1,
        permisos: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            codigo: "recursos:crear",
            nombre: "Crear Recursos",
            descripcion: null,
            modulo: "Recursos y Personal",
            asignadoEn: new Date().toISOString(),
            asignadoPorId: "00000000-0000-4000-8000-000000000001",
          },
        ],
      };

      const mockRepo = {
        obtenerRolPorId: vi
          .fn()
          .mockResolvedValueOnce(rolCallCenter)
          .mockResolvedValueOnce(rolActualizado),
        actualizarPermisosRol: vi.fn().mockResolvedValue(undefined),
      } as unknown as SeguridadRepository;

      const service = new SeguridadService(mockRepo);
      const admin: UsuarioAutenticado = {
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      };

      const resultado = await service.actualizarPermisosRol(
        rolCallCenter.id,
        ["10000000-0000-4000-8000-000000000001"],
        admin
      );

      expect(resultado.message).toBe(
        "Permisos actualizados correctamente en la base de datos"
      );
      expect(resultado.data.id).toBe(rolCallCenter.id);
      expect(resultado.data.cantidadPermisos).toBe(1);
      expect(mockRepo.actualizarPermisosRol).toHaveBeenCalledWith(
        rolCallCenter.id,
        ["10000000-0000-4000-8000-000000000001"],
        admin.id
      );
    });
  });
});

describe("Módulo de Seguridad — Route Handlers HTTP", () => {
  it("GET /api/seguridad/roles debe retornar 401 si falta la cabecera X-User-Id", async () => {
    const request = new NextRequest("http://localhost:3000/api/seguridad/roles");
    const response = await getRolesHandler(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Cabecera X-User-Id requerida");
  });

  it("GET /api/seguridad/roles debe retornar 403 si el usuario no tiene rol Administrador", async () => {
    vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000002",
      rut: "22222222-2",
      nombre: "Operador Call Center",
      email: "callcenter@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000002",
      rolNombre: "Call Center",
      activo: true,
    });
    vi.spyOn(seguridadRepository, "obtenerPermisosDeRol").mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost:3000/api/seguridad/roles", {
      headers: {
        "x-user-id": "00000000-0000-4000-8000-000000000002",
      },
    });

    const response = await getRolesHandler(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Se requiere el perfil de Administrador");
  });

  it("GET /api/seguridad/roles debe retornar 200 con la lista de roles si es Administrador", async () => {
    vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Admin General",
      email: "admin@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
      activo: true,
    });

    vi.spyOn(seguridadRepository, "obtenerTodosLosRolesConPermisos").mockResolvedValueOnce([
      {
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Administrador",
        descripcion: "Acceso total",
        activo: true,
        esSistema: true,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
    ]);

    const request = new NextRequest("http://localhost:3000/api/seguridad/roles", {
      headers: {
        "x-user-id": "00000000-0000-4000-8000-000000000001",
      },
    });

    const response = await getRolesHandler(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nombre).toBe("Administrador");
  });

  it("GET /api/seguridad/roles/[id] debe retornar 404 si el perfil no existe", async () => {
    vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Admin General",
      email: "admin@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
      activo: true,
    });

    vi.spyOn(seguridadRepository, "obtenerRolPorId").mockResolvedValueOnce(null);

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/roles/00000000-0000-4000-8000-000000000999",
      {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      }
    );

    const response = await getRolDetalleHandler(request, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000999" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("no encontrado");
  });

  it("GET /api/seguridad/roles/[id] debe retornar 200 con el detalle del rol", async () => {
    vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Admin General",
      email: "admin@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
      activo: true,
    });

    vi.spyOn(seguridadRepository, "obtenerRolPorId").mockResolvedValueOnce({
      id: "20000000-0000-4000-8000-000000000001",
      nombre: "Administrador",
      descripcion: "Acceso total",
      activo: true,
      esSistema: true,
      cantidadPermisos: 0,
      permisos: [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000001",
      {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      }
    );

    const response = await getRolDetalleHandler(request, {
      params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.nombre).toBe("Administrador");
  });

  describe("HU-5: Endpoints GET /api/seguridad/permisos y PUT /api/seguridad/roles/[id]/permisos", () => {
    it("GET /api/seguridad/permisos debe retornar 401 si falta cabecera X-User-Id", async () => {
      const request = new NextRequest("http://localhost:3000/api/seguridad/permisos");
      const response = await getPermisosHandler(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("Cabecera X-User-Id requerida");
    });

    it("GET /api/seguridad/permisos debe retornar 403 si el usuario no es Administrador", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000002",
        rut: "22222222-2",
        nombre: "Operador Call Center",
        email: "callcenter@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000002",
        rolNombre: "Call Center",
        activo: true,
      });
      vi.spyOn(seguridadRepository, "obtenerPermisosDeRol").mockResolvedValueOnce([]);

      const request = new NextRequest("http://localhost:3000/api/seguridad/permisos", {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000002",
        },
      });

      const response = await getPermisosHandler(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Se requiere el perfil de Administrador");
    });

    it("GET /api/seguridad/permisos debe retornar 200 con la lista de permisos clasificados por módulo", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin General",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(seguridadRepository, "obtenerTodosLosPermisos").mockResolvedValueOnce([
        {
          id: "10000000-0000-4000-8000-000000000001",
          codigo: "recursos:crear",
          nombre: "Crear Recursos",
          descripcion: "Permite crear recursos",
          modulo: "Recursos y Personal",
        },
      ]);

      const request = new NextRequest("http://localhost:3000/api/seguridad/permisos", {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      });

      const response = await getPermisosHandler(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.total).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].codigo).toBe("recursos:crear");
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 401 si falta cabecera X-User-Id", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos",
        {
          method: "PUT",
          body: JSON.stringify({ permisoIds: [] }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }),
      });

      expect(response.status).toBe(401);
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 403 si el usuario no es Administrador", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000002",
        rut: "22222222-2",
        nombre: "Operador Call Center",
        email: "callcenter@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000002",
        rolNombre: "Call Center",
        activo: true,
      });
      vi.spyOn(seguridadRepository, "obtenerPermisosDeRol").mockResolvedValueOnce([]);

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000002",
          },
          body: JSON.stringify({ permisoIds: [] }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }),
      });

      expect(response.status).toBe(403);
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si el body no es JSON válido", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000001",
          },
          body: "no-es-json-valido",
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("JSON válido");
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si el payload no contiene un arreglo de UUIDs", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000001",
          },
          body: JSON.stringify({ permisoIds: ["invalido"] }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Payload de permisos inválido");
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 404 si el rol no existe", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(seguridadRepository, "obtenerRolPorId").mockResolvedValueOnce(null);

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000999/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000001",
          },
          body: JSON.stringify({
            permisoIds: ["10000000-0000-4000-8000-000000000001"],
          }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000999" }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("no encontrado");
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si se intenta revocar seguridad:roles:gestionar al Administrador", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(seguridadRepository, "obtenerRolPorId").mockResolvedValueOnce({
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Administrador",
        descripcion: "Acceso total",
        activo: true,
        esSistema: true,
        cantidadPermisos: 1,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      });

      vi.spyOn(seguridadRepository, "obtenerPermisoPorCodigo").mockResolvedValueOnce({
        id: "10000000-0000-4000-8000-000000000004",
        codigo: PERMISO_GESTIONAR_ROLES,
        nombre: "Gestionar Roles",
        descripcion: null,
        modulo: "Seguridad",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000001/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000001",
          },
          body: JSON.stringify({
            permisoIds: ["10000000-0000-4000-8000-000000000001"],
          }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000001" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("seguridad:roles:gestionar");
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 400 si se especifican permisos inexistentes en BD", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(seguridadRepository, "obtenerRolPorId").mockResolvedValueOnce({
        id: "20000000-0000-4000-8000-000000000002",
        nombre: "Call Center",
        descripcion: "Recepción",
        activo: true,
        esSistema: true,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      });

      vi.spyOn(seguridadRepository, "actualizarPermisosRol").mockRejectedValueOnce(
        new BadRequestError(
          "Uno o más permisos especificados no existen en el sistema: 10000000-0000-4000-8000-000000000999"
        )
      );

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000001",
          },
          body: JSON.stringify({
            permisoIds: ["10000000-0000-4000-8000-000000000999"],
          }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("no existen");
    });

    it("PUT /api/seguridad/roles/[id]/permisos debe retornar 200 con el rol actualizado", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioConRolPorId").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      const rolCallCenter: RolItemDTO = {
        id: "20000000-0000-4000-8000-000000000002",
        nombre: "Call Center",
        descripcion: "Recepción",
        activo: true,
        esSistema: true,
        cantidadPermisos: 0,
        permisos: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      const rolActualizado: RolItemDTO = {
        ...rolCallCenter,
        cantidadPermisos: 1,
        permisos: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            codigo: "recursos:crear",
            nombre: "Crear Recursos",
            descripcion: null,
            modulo: "Recursos y Personal",
            asignadoEn: new Date().toISOString(),
            asignadoPorId: "00000000-0000-4000-8000-000000000001",
          },
        ],
      };

      vi.spyOn(seguridadRepository, "obtenerRolPorId")
        .mockResolvedValueOnce(rolCallCenter)
        .mockResolvedValueOnce(rolActualizado);

      vi.spyOn(seguridadRepository, "actualizarPermisosRol").mockResolvedValueOnce(undefined);

      const request = new NextRequest(
        "http://localhost:3000/api/seguridad/roles/20000000-0000-4000-8000-000000000002/permisos",
        {
          method: "PUT",
          headers: {
            "x-user-id": "00000000-0000-4000-8000-000000000001",
          },
          body: JSON.stringify({
            permisoIds: ["10000000-0000-4000-8000-000000000001"],
          }),
        }
      );

      const response = await putRolPermisosHandler(request, {
        params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe("Permisos actualizados correctamente en la base de datos");
      expect(body.data.cantidadPermisos).toBe(1);
    });
  });

  describe("HU-5: Endpoint GET /api/seguridad/usuario-activo (Resolución de permisos en tiempo real - CP-HU5-18)", () => {
    it("GET /api/seguridad/usuario-activo debe retornar 200 con datos del usuario y permisos dinámicos", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioCompletoConPermisos").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Administrador General",
        email: "admin@valdivia.cl",
        activo: true,
        delegacionId: null,
        rol: {
          id: "20000000-0000-4000-8000-000000000001",
          nombre: "Administrador",
          codigo: "ADMIN",
          esAdmin: true,
        },
        permisos: ["seguridad:roles:leer", "seguridad:roles:gestionar"],
      });

      const request = new NextRequest("http://localhost:3000/api/seguridad/usuario-activo", {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      });

      const response = await getUsuarioActivoHandler(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.data.id).toBe("00000000-0000-4000-8000-000000000001");
      expect(body.data.rol.nombre).toBe("Administrador");
      expect(body.data.rol.esAdmin).toBe(true);
      expect(body.data.permisos).toContain("seguridad:roles:gestionar");
    });

    it("GET /api/seguridad/usuario-activo debe retornar 401 si falta cabecera de autenticación", async () => {
      const request = new NextRequest("http://localhost:3000/api/seguridad/usuario-activo");
      const response = await getUsuarioActivoHandler(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("Cabecera X-User-Id requerida");
    });

    it("GET /api/seguridad/usuario-activo debe retornar 401 si el usuario no existe", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioCompletoConPermisos").mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/seguridad/usuario-activo", {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000099",
        },
      });

      const response = await getUsuarioActivoHandler(request);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("no existe o no está registrado");
    });

    it("GET /api/seguridad/usuario-activo debe retornar 403 si el usuario existe pero se encuentra inactivo", async () => {
      vi.spyOn(seguridadRepository, "obtenerUsuarioCompletoConPermisos").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000005",
        rut: "55555555-5",
        nombre: "Usuario Desactivado",
        email: "inactivo@valdivia.cl",
        activo: false,
        delegacionId: null,
        rol: {
          id: "20000000-0000-4000-8000-000000000002",
          nombre: "Call Center",
          codigo: "CALL_CENTER",
          esAdmin: false,
        },
        permisos: [],
      });

      const request = new NextRequest("http://localhost:3000/api/seguridad/usuario-activo", {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000005",
        },
      });

      const response = await getUsuarioActivoHandler(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("inactivo");
    });
  });
});

describe("Módulo de Seguridad — Persistencia y Transaccionalidad (SeguridadRepository)", () => {
  it("debe ejecutar la mutación de permisos dentro de una transacción Kysely y hacer rollback ante error forzado", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([{ id: "10000000-0000-4000-8000-000000000001" }]),
          }),
        }),
      }),
      deleteFrom: vi.fn().mockImplementation(() => {
        throw new Error("Fallo transaccional forzado para verificación de rollback");
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: unknown) => Promise<unknown>) => {
        return await callback(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    const repo = new SeguridadRepositoryClass();
    await expect(
      repo.actualizarPermisosRol(
        "20000000-0000-4000-8000-000000000002",
        ["10000000-0000-4000-8000-000000000001"],
        "00000000-0000-4000-8000-000000000001"
      )
    ).rejects.toThrow("Fallo transaccional forzado para verificación de rollback");
  });

  it("debe rechazar con BadRequestError si algún ID de permiso no existe en la base de datos", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: unknown) => Promise<unknown>) => {
        return await callback(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    const repo = new SeguridadRepositoryClass();
    await expect(
      repo.actualizarPermisosRol(
        "20000000-0000-4000-8000-000000000002",
        ["10000000-0000-4000-8000-000000000999"],
        "00000000-0000-4000-8000-000000000001"
      )
    ).rejects.toThrow(BadRequestError);
  });

  it("debe persistir auditoría (asignado_en, asignado_por_id) y actualizar actualizado_en del rol", async () => {
    const insertMock = vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
    });
    const updateMock = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    const mockTrx = {
      selectFrom: vi.fn((table: string) => {
        if (table === "permiso") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                execute: vi.fn().mockResolvedValue([
                  { id: "10000000-0000-4000-8000-000000000001" },
                ]),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }),
      deleteFrom: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: insertMock,
      }),
      updateTable: updateMock,
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: unknown) => Promise<unknown>) => {
        return await callback(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    const repo = new SeguridadRepositoryClass();
    await repo.actualizarPermisosRol(
      "20000000-0000-4000-8000-000000000002",
      ["10000000-0000-4000-8000-000000000001"],
      "00000000-0000-4000-8000-000000000001"
    );

    expect(mockTrx.insertInto).toHaveBeenCalledWith("rol_permiso");
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rol_id: "20000000-0000-4000-8000-000000000002",
          permiso_id: "10000000-0000-4000-8000-000000000001",
          asignado_por_id: "00000000-0000-4000-8000-000000000001",
        }),
      ])
    );
    expect(updateMock).toHaveBeenCalledWith("rol");
  });
});

describe("Módulo de Seguridad — Especificación OpenAPI", () => {
  it("debe incluir las rutas /api/seguridad/roles, /api/seguridad/roles/{id}, /api/seguridad/permisos y /api/seguridad/roles/{id}/permisos en el spec", () => {
    const spec = generarOpenApiSpec();

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.version).toBe("0.6.0");
    expect(spec.paths).toBeDefined();

    expect(spec.paths["/api/seguridad/roles"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles"]?.get).toBeDefined();
    expect(spec.paths["/api/seguridad/roles"]?.get?.tags).toContain(
      "Seguridad / Roles y Permisos"
    );

    expect(spec.paths["/api/seguridad/roles/{id}"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}"]?.get).toBeDefined();

    // Rutas HU-5
    expect(spec.paths["/api/seguridad/permisos"]).toBeDefined();
    expect(spec.paths["/api/seguridad/permisos"]?.get).toBeDefined();
    expect(spec.paths["/api/seguridad/permisos"]?.get?.tags).toContain(
      "Seguridad / Roles y Permisos"
    );

    expect(spec.paths["/api/seguridad/roles/{id}/permisos"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}/permisos"]?.put).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}/permisos"]?.put?.tags).toContain(
      "Seguridad / Roles y Permisos"
    );

    // Ruta HU-5: usuario-activo (CP-HU5-18)
    expect(spec.paths["/api/seguridad/usuario-activo"]).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"]?.get).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"]?.get?.tags).toContain(
      "Seguridad / Roles y Permisos"
    );
    expect(spec.paths["/api/seguridad/usuario-activo"]?.get?.responses["200"]).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"]?.get?.responses["401"]).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"]?.get?.responses["403"]).toBeDefined();

    // Esquemas registrados
    expect(spec.components?.schemas?.["UsuarioActivoResponse"]).toBeDefined();
  });
});
