import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { POST, GET } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as personalListadoService from "@/modules/recursos-y-personal/personal-listado.service";
import * as registrarService from "@/modules/recursos-y-personal/services/registrar-empleado.service";
import {
  validarRutChileno,
  RegistrarEmpleadoSchema,
} from "@/modules/recursos-y-personal/schemas/registrar-empleado.schema";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";
import {
  RutDuplicadoError,
  EmailDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "@/modules/recursos-y-personal/services/registrar-empleado.service";

describe("H11: Listado de personal con RBAC (GET /api/personal)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const usuarioAutenticado = {
    id: "00000000-0000-4000-8000-000000000001",
    rut: "11.111.111-1",
    nombre: "Administrador General",
    email: "admin@valdivia.cl",
    rolId: "20000000-0000-4000-8000-000000000001",
    rolNombre: "Administrador",
    activo: true,
  };

  it("debe responder 401 si la petición no incluye token de sesión", async () => {
    const req = new NextRequest("http://localhost:3000/api/personal");

    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("debe responder 403 si el rol no posee permisos de personal", async () => {
    vi.spyOn(authGuard, "verificarAccesoPersonal").mockRejectedValueOnce(
      new ForbiddenError(
        "Acceso denegado. Se requiere el perfil de Administrador o los permisos 'personal:leer', 'personal:gestionar' o 'personal:crear'."
      )
    );

    const req = new NextRequest("http://localhost:3000/api/personal");

    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Acceso denegado");
  });

  it("debe responder 200 con el listado paginado cuando el usuario cuenta con permiso", async () => {
    vi.spyOn(authGuard, "verificarAccesoPersonal").mockResolvedValueOnce(usuarioAutenticado);

    vi.spyOn(personalListadoService, "listarPersonalService").mockResolvedValueOnce({
      data: [
        {
          usuario_id: "00000000-0000-4000-8000-000000000002",
          rut: "22222222-2",
          nombres: "María",
          apellidos: "González",
          email: "maria@valdivia.cl",
          telefono: null,
          usuario_activo: true,
          fecha_ingreso: null,
          fecha_salida: null,
          rol_id: "20000000-0000-4000-8000-000000000002",
          rol_codigo: "CALL_CENTER",
          rol_nombre: "Call Center",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_codigo: "DEL_NORTE",
          delegacion_nombre: "Norte",
          personal_id: null,
          especialidad: null,
          cargo: null,
          estado_operativo: "disponible",
          disponible_terreno: null,
          observaciones: null,
          personal_updated_at: null,
          es_personal: false,
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/personal?estadoOperativo=disponible");

    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].estado_operativo).toBe("disponible");
    expect(body.data[0].disponible_terreno).toBeNull();
  });
});

describe("HU-10: Registrar Nuevo Funcionario (POST /api/personal)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validador Algorítmico Módulo 11 (validarRutChileno)", () => {
    it("debe validar correctamente RUTs chilenos reales con formato con puntos y guion", () => {
      // 12.345.678-5: 1*3 + 2*2 + 3*7 + 4*6 + 5*5 + 6*4 + 7*3 + 8*2 = 3+4+21+24+25+24+21+16 = 138. 138%11 = 6. 11-6 = 5.
      expect(validarRutChileno("12.345.678-5")).toBe(true);
      expect(validarRutChileno("11.111.111-1")).toBe(true);
    });

    it("debe validar correctamente RUTs chilenos sin puntos y con minúscula", () => {
      expect(validarRutChileno("12345678-5")).toBe(true);
      expect(validarRutChileno("11111111-1")).toBe(true);
      // RUT con K
      // 7.654.321-? 7*2 + 6*7 + 5*6 + 4*5 + 3*4 + 2*3 + 1*2 = 14+42+30+20+12+6+2 = 126. 126%11 = 5. 11-5 = 6.
      // 2.222.222-2: 2*(2+3+4+5+6+7+2) = 2*29 = 58. 58%11 = 3. 11-3 = 8 != 2
      // 11.222.333-k: 1*3 + 1*2 + 2*7 + 2*6 + 2*5 + 3*4 + 3*3 + 3*2 = 3+2+14+12+10+12+9+6 = 68. 68%11 = 2. 11-2 = 9.
      // Generemos un RUT con K válido:
      // 10.000.001-K: 1*7 + 0 + 0 + 0 + 0 + 0 + 0 + 1*2 = 9. 11-9 = 2.
      // 10.000.002-9: 1*7 + 2*2 = 11. 11-11 = 0.
      // 10.000.003-7: 1*7 + 3*2 = 13. 11 - (13%11) = 9.
      // 10.000.030-K: 1*3 + 3*3 = 12. 12 % 11 = 1 -> 11 - 1 = 10 -> 'K'
      expect(validarRutChileno("10.000.030-K")).toBe(true);
      expect(validarRutChileno("10000030-k")).toBe(true);
    });

    it("debe rechazar RUTs con dígito verificador matemáticamente erróneo", () => {
      expect(validarRutChileno("12.345.678-9")).toBe(false);
      expect(validarRutChileno("12345678-0")).toBe(false);
      expect(validarRutChileno("11.111.111-K")).toBe(false);
    });

    it("debe rechazar formatos deformes o no numéricos", () => {
      expect(validarRutChileno("")).toBe(false);
      expect(validarRutChileno("invalido")).toBe(false);
      expect(validarRutChileno("123")).toBe(false);
    });
  });

  describe("2. Validación de Esquema Zod (RegistrarEmpleadoSchema)", () => {
    const payloadValido = {
      rut: "12.345.678-5",
      nombres: "Gonzalo Andrés",
      apellidos: "Valenzuela Ríos",
      email: "gonzalo.valenzuela@valdivia.cl",
      telefono: "+56987654321",
      password: "Password2026",
      rol_id: "20000000-0000-4000-8000-000000000004",
      delegacion_id: "30000000-0000-4000-8000-000000000001",
      cargo: "Operador de Maquinaria",
      especialidad: "Conductor Rescate",
      disponible_terreno: true,
      observaciones: "Turno diurno",
    };

    it("debe admitir un payload completo y válido", () => {
      const parsed = RegistrarEmpleadoSchema.safeParse(payloadValido);
      expect(parsed.success).toBe(true);
    });

    it("debe rechazar contraseñas de menos de 8 caracteres", () => {
      const parsed = RegistrarEmpleadoSchema.safeParse({
        ...payloadValido,
        password: "Pass1",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("al menos 8 caracteres");
      }
    });

    it("debe rechazar contraseñas no alfanuméricas (solo letras o solo números)", () => {
      const parsedSoloLetras = RegistrarEmpleadoSchema.safeParse({
        ...payloadValido,
        password: "sololetraslargas",
      });
      expect(parsedSoloLetras.success).toBe(false);

      const parsedSoloNumeros = RegistrarEmpleadoSchema.safeParse({
        ...payloadValido,
        password: "1234567890",
      });
      expect(parsedSoloNumeros.success).toBe(false);
    });

    it("debe rechazar omisión de delegacion_id (obligatorio para todo funcionario)", () => {
      const sinDelegacion = { ...payloadValido };
      delete (sinDelegacion as { delegacion_id?: string }).delegacion_id;
      const parsed = RegistrarEmpleadoSchema.safeParse(sinDelegacion);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.path.includes("delegacion_id"));
        expect(issue).toBeDefined();
      }
    });

    it("debe rechazar RUT con dígito verificador inválido", () => {
      const parsed = RegistrarEmpleadoSchema.safeParse({
        ...payloadValido,
        rut: "12.345.678-9",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Módulo 11");
      }
    });

    it("debe rechazar correos electrónicos inválidos", () => {
      const parsed = RegistrarEmpleadoSchema.safeParse({
        ...payloadValido,
        email: "correo-invalido",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("3. Control de Seguridad y Autorización RBAC en Route Handler", () => {
    it("debe responder 401 si no hay token de autenticación", async () => {
      vi.spyOn(authGuard, "verificarAdministrador").mockRejectedValueOnce(
        new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
      );

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authorization");
    });

    it("debe responder 403 si el usuario autenticado no posee perfil Administrador", async () => {
      vi.spyOn(authGuard, "verificarAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-operador" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Administrador");
    });
  });

  describe("4. Manejo de Errores y Validaciones de Entrada", () => {
    beforeEach(() => {
      vi.spyOn(authGuard, "verificarAdministrador").mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Administrador Municipal",
        email: "admin@valdivia.cl",
        activo: true,
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
      });
    });

    it("debe responder 400 si el cuerpo de la solicitud no es un JSON válido", async () => {
      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: "cuerpo-mal-formado",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("JSON");
    });

    it("debe responder 422 si los datos no cumplen con el esquema Zod", async () => {
      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-9", // DV inválido
          nombres: "",
          password: "corta",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe("Datos de entrada inválidos");
      expect(Array.isArray(data.detalles)).toBe(true);
    });

    it("debe responder 409 Conflict si el RUT ya está en uso", async () => {
      vi.spyOn(registrarService, "registrarEmpleado").mockRejectedValueOnce(
        new RutDuplicadoError("El RUT ingresado ya pertenece a un funcionario registrado")
      );

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-5",
          nombres: "Pedro",
          apellidos: "Soto",
          email: "pedro.soto@valdivia.cl",
          telefono: "+56911223344",
          password: "Password2026",
          rol_id: "20000000-0000-4000-8000-000000000002",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("El RUT ingresado ya pertenece a un funcionario registrado");
    });

    it("debe responder 409 Conflict si el correo electrónico ya está registrado", async () => {
      vi.spyOn(registrarService, "registrarEmpleado").mockRejectedValueOnce(
        new EmailDuplicadoError("El correo electrónico ya está en uso")
      );

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-5",
          nombres: "Pedro",
          apellidos: "Soto",
          email: "pedro.soto@valdivia.cl",
          telefono: "+56911223344",
          password: "Password2026",
          rol_id: "20000000-0000-4000-8000-000000000002",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("El correo electrónico ya está en uso");
    });

    it("debe responder 400 Bad Request si el rol o la delegación no existen", async () => {
      vi.spyOn(registrarService, "registrarEmpleado").mockRejectedValueOnce(
        new RolNotFoundError("El rol especificado no existe")
      );

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-5",
          nombres: "Pedro",
          apellidos: "Soto",
          email: "pedro.soto@valdivia.cl",
          telefono: "+56911223344",
          password: "Password2026",
          rol_id: "20000000-0000-4000-8000-000000000099",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("El rol especificado no existe");
    });

    it("debe responder 400 Bad Request si la delegación no existe", async () => {
      vi.spyOn(registrarService, "registrarEmpleado").mockRejectedValueOnce(
        new DelegacionNotFoundError("La delegación especificada no existe")
      );

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-5",
          nombres: "Pedro",
          apellidos: "Soto",
          email: "pedro.soto@valdivia.cl",
          telefono: "+56911223344",
          password: "Password2026",
          rol_id: "20000000-0000-4000-8000-000000000002",
          delegacion_id: "30000000-0000-4000-8000-000000000099",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("La delegación especificada no existe");
    });
  });

  describe("5. Registro Exitoso y Habilitación de Login", () => {
    beforeEach(() => {
      vi.spyOn(authGuard, "verificarAdministrador").mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Administrador Municipal",
        email: "admin@valdivia.cl",
        activo: true,
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
      });
    });

    it("debe responder 201 Created al registrar funcionario administrativo (solo usuario)", async () => {
      const funcionarioConsolidado = {
        usuario_id: "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5",
        rut: "12345678-5",
        nombres: "Beatriz",
        apellidos: "Riquelme",
        email: "beatriz.riquelme@valdivia.cl",
        telefono: "+56977889900",
        usuario_activo: true,
        fecha_ingreso: "2026-10-01",
        fecha_salida: null,
        rol_id: "20000000-0000-4000-8000-000000000002",
        rol_codigo: "CALL_CENTER",
        rol_nombre: "Call Center",
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        delegacion_codigo: "DEL_NORTE",
        delegacion_nombre: "Delegación Municipal Norte",
        personal_id: null,
        especialidad: null,
        cargo: null,
        estado_operativo: "disponible" as const,
        disponible_terreno: null,
        observaciones: null,
        personal_updated_at: null,
        es_personal: false,
      };

      vi.spyOn(registrarService, "registrarEmpleado").mockResolvedValueOnce(funcionarioConsolidado);

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-5",
          nombres: "Beatriz",
          apellidos: "Riquelme",
          email: "beatriz.riquelme@valdivia.cl",
          telefono: "+56977889900",
          password: "Valdivia2026!",
          rol_id: "20000000-0000-4000-8000-000000000002",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.mensaje).toBe("Funcionario registrado exitosamente");
      expect(data.data.usuario_id).toBe("a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5");
      expect(data.data.rut).toBe("12345678-5");
      expect(data.data.es_personal).toBe(false);
      // Garantizar omisión de password_hash
      expect(data.data.password_hash).toBeUndefined();
    });

    it("debe responder 201 Created al registrar funcionario con ficha operativa de terreno", async () => {
      const funcionarioTerrenoConsolidado = {
        usuario_id: "b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6",
        rut: "12345678-5",
        nombres: "Marcos",
        apellidos: "Paredes",
        email: "marcos.paredes@valdivia.cl",
        telefono: "+56944556677",
        usuario_activo: true,
        fecha_ingreso: "2026-10-01",
        fecha_salida: null,
        rol_id: "20000000-0000-4000-8000-000000000004",
        rol_codigo: "PATRULLA_VERIFICADORA",
        rol_nombre: "Patrulla Verificadora",
        delegacion_id: "30000000-0000-4000-8000-000000000002",
        delegacion_codigo: "DEL_SUR",
        delegacion_nombre: "Delegación Municipal Sur",
        personal_id: "c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7",
        especialidad: "Evaluador Rápido",
        cargo: "Patrullero Terreno",
        estado_operativo: "disponible" as const,
        disponible_terreno: true,
        observaciones: "Acreditado por SENAPRED",
        personal_updated_at: null,
        es_personal: true,
      };

      vi.spyOn(registrarService, "registrarEmpleado").mockResolvedValueOnce(funcionarioTerrenoConsolidado);

      const req = new NextRequest("http://localhost:3000/api/personal", {
        method: "POST",
        headers: { authorization: "Bearer token-valido" },
        body: JSON.stringify({
          rut: "12.345.678-5",
          nombres: "Marcos",
          apellidos: "Paredes",
          email: "marcos.paredes@valdivia.cl",
          telefono: "+56944556677",
          password: "Valdivia2026!",
          rol_id: "20000000-0000-4000-8000-000000000004",
          delegacion_id: "30000000-0000-4000-8000-000000000002",
          cargo: "Patrullero Terreno",
          especialidad: "Evaluador Rápido",
          estado_operativo: "disponible",
          disponible_terreno: true,
          observaciones: "Acreditado por SENAPRED",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.es_personal).toBe(true);
      expect(data.data.personal_id).toBe("c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7");
      expect(data.data.especialidad).toBe("Evaluador Rápido");
      expect(data.data.password_hash).toBeUndefined();
    });

    it("debe generar un hash bcrypt válido y verificable contra la contraseña provista", async () => {
      const passwordClara = "Valdivia2026!";
      const hash = await bcrypt.hash(passwordClara, 10);

      const esValida = await bcrypt.compare(passwordClara, hash);
      expect(esValida).toBe(true);

      const esInvalida = await bcrypt.compare("PasswordIncorrecta", hash);
      expect(esInvalida).toBe(false);
    });
  });
});
