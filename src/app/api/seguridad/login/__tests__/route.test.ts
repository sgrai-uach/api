import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginHandler } from "../route";
import { seguridadService } from "@/modules/seguridad/service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import { extraerUsuarioId, exigirUsuarioId } from "@/modules/seguridad/auth.guard";
import { generarTokenPrueba } from "@/lib/test-utils/auth";
import { verificarTokenJwt } from "@/modules/seguridad/jwt";

describe("Endpoint POST /api/seguridad/login", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe autenticar satisfactoriamente con correo y retornar DTO con JWT y perfil", async () => {
    const mockResponse = {
      data: {
        token: "jwt-token-valido-prueba",
        tipoToken: "Bearer" as const,
        expiraEn: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        usuario: {
          id: "00000000-0000-4000-8000-000000000001",
          rut: "11111111-1",
          nombre: "Administrador General",
          email: "admin@valdivia.cl",
          rolId: "20000000-0000-4000-8000-000000000001",
          rolNombre: "Administrador",
          rolCodigo: "ADMIN",
          delegacionId: "30000000-0000-4000-8000-000000000001",
          permisos: ["seguridad:roles:leer", "seguridad:roles:gestionar"],
        },
      },
    };

    vi.spyOn(seguridadService, "login").mockResolvedValueOnce(mockResponse);

    const request = new NextRequest("http://localhost:3000/api/seguridad/login", {
      method: "POST",
      body: JSON.stringify({
        identificador: "admin@valdivia.cl",
        password: "Valdivia2026!",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginHandler(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.token).toBe("jwt-token-valido-prueba");
    expect(json.data.tipoToken).toBe("Bearer");
    expect(json.data.usuario.email).toBe("admin@valdivia.cl");
    expect(json.data.usuario.permisos).toContain("seguridad:roles:gestionar");
  });

  it("debe responder 400 Bad Request si el cuerpo de la solicitud no es un JSON válido", async () => {
    const request = new NextRequest("http://localhost:3000/api/seguridad/login", {
      method: "POST",
      body: "no-json-body",
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("JSON mal formado");
  });

  it("debe responder 400 Bad Request si faltan campos requeridos en el formulario", async () => {
    const request = new NextRequest("http://localhost:3000/api/seguridad/login", {
      method: "POST",
      body: JSON.stringify({
        identificador: "",
        password: "",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Datos de autenticación inválidos");
    expect(json.details.identificador).toBeDefined();
    expect(json.details.password).toBeDefined();
  });

  it("debe responder 401 Unauthorized ante credenciales erróneas", async () => {
    vi.spyOn(seguridadService, "login").mockRejectedValueOnce(
      new UnauthorizedError("Credenciales inválidas. Verifique su identificador o contraseña.")
    );

    const request = new NextRequest("http://localhost:3000/api/seguridad/login", {
      method: "POST",
      body: JSON.stringify({
        identificador: "admin@valdivia.cl",
        password: "PasswordEquivocada!",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginHandler(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Credenciales inválidas. Verifique su identificador o contraseña.");
  });

  it("debe responder 403 Forbidden si la cuenta se encuentra inactiva", async () => {
    vi.spyOn(seguridadService, "login").mockRejectedValueOnce(
      new ForbiddenError("Su cuenta se encuentra deshabilitada. Contacte al Administrador.")
    );

    const request = new NextRequest("http://localhost:3000/api/seguridad/login", {
      method: "POST",
      body: JSON.stringify({
        identificador: "inactivo@valdivia.cl",
        password: "Valdivia2026!",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginHandler(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Su cuenta se encuentra deshabilitada. Contacte al Administrador.");
  });

  it("debe responder 403 Forbidden si la cuenta se encuentra bloqueada por reintentos", async () => {
    vi.spyOn(seguridadService, "login").mockRejectedValueOnce(
      new ForbiddenError("Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente nuevamente en 15 minuto(s) o contacte al Administrador.")
    );

    const request = new NextRequest("http://localhost:3000/api/seguridad/login", {
      method: "POST",
      body: JSON.stringify({
        identificador: "admin@valdivia.cl",
        password: "Valdivia2026!",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginHandler(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Cuenta temporalmente bloqueada");
  });
});

describe("Auth Guard y Verificación Estricta de JWT (Cero Retrocompatibilidad)", () => {
  it("debe extraer exitosamente el usuario con un Bearer token JWT válido", async () => {
    const token = await generarTokenPrueba("00000000-0000-4000-8000-000000000001");
    const request = new NextRequest("http://localhost:3000/api/cualquiera", {
      headers: { authorization: `Bearer ${token}` },
    });

    const usuarioId = await extraerUsuarioId(request);
    expect(usuarioId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("debe retornar null si no se envía cabecera Authorization", async () => {
    const request = new NextRequest("http://localhost:3000/api/cualquiera");
    const usuarioId = await extraerUsuarioId(request);
    expect(usuarioId).toBeNull();
  });

  it("no debe aceptar cabecera X-User-Id (cero retrocompatibilidad)", async () => {
    const request = new NextRequest("http://localhost:3000/api/cualquiera", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });

    const usuarioId = await extraerUsuarioId(request);
    expect(usuarioId).toBeNull();
  });

  it("debe lanzar UnauthorizedError si la cabecera Authorization no tiene formato Bearer", async () => {
    const request = new NextRequest("http://localhost:3000/api/cualquiera", {
      headers: { authorization: "Basic YWRtaW46cGFzc3dvcmQ=" },
    });

    await expect(extraerUsuarioId(request)).rejects.toThrow(
      "Formato de autorización no válido. Se requiere 'Authorization: Bearer <token>'."
    );
  });

  it("debe lanzar UnauthorizedError si el Bearer token es inválido o ha sido manipulado", async () => {
    const request = new NextRequest("http://localhost:3000/api/cualquiera", {
      headers: { authorization: "Bearer token-invalido-o-manipulado" },
    });

    await expect(extraerUsuarioId(request)).rejects.toThrow(
      "Token de sesión inválido o expirado."
    );
  });

  it("exigirUsuarioId debe lanzar UnauthorizedError si falta el token", async () => {
    const request = new NextRequest("http://localhost:3000/api/cualquiera");

    await expect(exigirUsuarioId(request)).rejects.toThrow(
      "Se requiere cabecera de autenticación Authorization: Bearer <token>."
    );
  });
});

describe("SeguridadService.login — Reglas de Negocio y Bloqueo de Cuentas", () => {
  // Hash bcrypt real de 'Valdivia2026!'
  const HASH_VALDIVIA_2026 =
    "$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe autenticar exitosamente con RUT normalizado y contraseña correcta", async () => {
    const usuarioMock = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      password_hash: HASH_VALDIVIA_2026,
      activo: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      delegacion_id: null,
      rol_id: "20000000-0000-4000-8000-000000000001",
      rol_nombre: "Administrador",
      rol_codigo: "ADMIN",
    };

    const spyObtener = vi
      .spyOn(seguridadService["repo"], "obtenerUsuarioParaLogin")
      .mockResolvedValueOnce(usuarioMock);
    const spyExitoso = vi
      .spyOn(seguridadService["repo"], "registrarLoginExitoso")
      .mockResolvedValueOnce();
    vi.spyOn(seguridadService["repo"], "obtenerTodosLosPermisos").mockResolvedValueOnce([
      {
        id: "10000000-0000-4000-8000-000000000003",
        codigo: "seguridad:roles:leer",
        nombre: "Visualizar Roles",
        descripcion: null,
        modulo: "Seguridad",
      },
    ]);

    const res = await seguridadService.login({
      identificador: " 11.111.111-1 ",
      password: "Valdivia2026!",
    });

    // Se normalizó el RUT removiendo puntos y espacios
    expect(spyObtener).toHaveBeenCalledWith("11111111-1");
    expect(spyExitoso).toHaveBeenCalledWith(usuarioMock.id);
    expect(res.data.token).toBeDefined();
    expect(res.data.usuario.rut).toBe("11111111-1");
    expect(res.data.usuario.rolCodigo).toBe("ADMIN");

    // Verificar que el token sea un JWT válido
    const payload = await verificarTokenJwt(res.data.token);
    expect(payload.sub).toBe(usuarioMock.id);
    expect(payload.email).toBe("admin@valdivia.cl");
  });

  it("debe incrementar intentos_fallidos si la contraseña no coincide", async () => {
    const usuarioMock = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      password_hash: HASH_VALDIVIA_2026,
      activo: true,
      intentos_fallidos: 2,
      bloqueado_hasta: null,
      delegacion_id: null,
      rol_id: "20000000-0000-4000-8000-000000000001",
      rol_nombre: "Administrador",
      rol_codigo: "ADMIN",
    };

    vi.spyOn(seguridadService["repo"], "obtenerUsuarioParaLogin").mockResolvedValueOnce(usuarioMock);
    const spyFallido = vi
      .spyOn(seguridadService["repo"], "registrarIntentoFallido")
      .mockResolvedValueOnce();

    await expect(
      seguridadService.login({
        identificador: "admin@valdivia.cl",
        password: "PasswordEquivocada",
      })
    ).rejects.toThrow("Credenciales inválidas. Verifique su identificador o contraseña.");

    expect(spyFallido).toHaveBeenCalledWith(usuarioMock.id, 3, null);
  });

  it("debe bloquear la cuenta temporalmente si se alcanza el umbral de intentos fallidos", async () => {
    const usuarioMock = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      password_hash: HASH_VALDIVIA_2026,
      activo: true,
      intentos_fallidos: 4, // 4 intentos previos
      bloqueado_hasta: null,
      delegacion_id: null,
      rol_id: "20000000-0000-4000-8000-000000000001",
      rol_nombre: "Administrador",
      rol_codigo: "ADMIN",
    };

    vi.spyOn(seguridadService["repo"], "obtenerUsuarioParaLogin").mockResolvedValueOnce(usuarioMock);
    const spyFallido = vi
      .spyOn(seguridadService["repo"], "registrarIntentoFallido")
      .mockResolvedValueOnce();

    await expect(
      seguridadService.login({
        identificador: "admin@valdivia.cl",
        password: "PasswordEquivocada",
      })
    ).rejects.toThrow("Su cuenta ha sido bloqueada temporalmente");

    // Al llegar a 5 intentos se fija fecha de bloqueo
    expect(spyFallido).toHaveBeenCalledWith(
      usuarioMock.id,
      5,
      expect.any(Date)
    );
  });

  it("debe rechazar de inmediato si la cuenta aún se encuentra bloqueada", async () => {
    const fechaBloqueoFuturo = new Date(Date.now() + 10 * 60 * 1000); // Bloqueada por 10 min más

    const usuarioMock = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      password_hash: HASH_VALDIVIA_2026,
      activo: true,
      intentos_fallidos: 5,
      bloqueado_hasta: fechaBloqueoFuturo,
      delegacion_id: null,
      rol_id: "20000000-0000-4000-8000-000000000001",
      rol_nombre: "Administrador",
      rol_codigo: "ADMIN",
    };

    vi.spyOn(seguridadService["repo"], "obtenerUsuarioParaLogin").mockResolvedValueOnce(usuarioMock);

    await expect(
      seguridadService.login({
        identificador: "admin@valdivia.cl",
        password: "Valdivia2026!",
      })
    ).rejects.toThrow("Cuenta temporalmente bloqueada por múltiples intentos fallidos");
  });

  it("debe desbloquear la cuenta si el tiempo de bloqueo ya transcurrió", async () => {
    const fechaBloqueoPasado = new Date(Date.now() - 5 * 60 * 1000); // Expiró hace 5 min

    const usuarioMock = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      password_hash: HASH_VALDIVIA_2026,
      activo: true,
      intentos_fallidos: 5,
      bloqueado_hasta: fechaBloqueoPasado,
      delegacion_id: null,
      rol_id: "20000000-0000-4000-8000-000000000001",
      rol_nombre: "Administrador",
      rol_codigo: "ADMIN",
    };

    vi.spyOn(seguridadService["repo"], "obtenerUsuarioParaLogin").mockResolvedValueOnce(usuarioMock);
    const spyReset = vi
      .spyOn(seguridadService["repo"], "registrarIntentoFallido")
      .mockResolvedValueOnce();
    vi.spyOn(seguridadService["repo"], "registrarLoginExitoso").mockResolvedValueOnce();
    vi.spyOn(seguridadService["repo"], "obtenerTodosLosPermisos").mockResolvedValueOnce([]);

    const res = await seguridadService.login({
      identificador: "admin@valdivia.cl",
      password: "Valdivia2026!",
    });

    expect(spyReset).toHaveBeenCalledWith(usuarioMock.id, 0, null);
    expect(res.data.token).toBeDefined();
  });
});
