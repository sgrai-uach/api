import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getRolesHandler } from "../../../app/api/seguridad/roles/route";
import { GET as getRolDetalleHandler } from "../../../app/api/seguridad/roles/[id]/route";
import { generarOpenApiSpec } from "../../../lib/openapi";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors";
import { seguridadRepository, type SeguridadRepository } from "../repository";
import {
  ListarRolesResponseSchema,
  PermisoAsignadoSchema,
  RolDetalleResponseSchema,
  RolItemSchema,
} from "../schema";
import { SeguridadService } from "../service";
import type { RolItemDTO, UsuarioAutenticado } from "../types";

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
});

describe("Módulo de Seguridad — Especificación OpenAPI", () => {
  it("debe incluir las rutas /api/seguridad/roles y /api/seguridad/roles/{id} en el spec OpenAPI", () => {
    const spec = generarOpenApiSpec();

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.version).toBe("0.4.0");
    expect(spec.paths).toBeDefined();

    expect(spec.paths["/api/seguridad/roles"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles"]?.get).toBeDefined();
    expect(spec.paths["/api/seguridad/roles"]?.get?.tags).toContain(
      "Seguridad / Roles y Permisos"
    );

    expect(spec.paths["/api/seguridad/roles/{id}"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}"]?.get).toBeDefined();
  });
});
