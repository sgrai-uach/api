import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as personalListadoService from "@/modules/recursos-y-personal/personal-listado.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import { PERMISO_LEER_ASISTENCIA_SOCIAL } from "@/modules/seguridad/permisos.constants";
import type { ListarPersonalResponse } from "@/modules/recursos-y-personal/personal-listado.schema";

describe("HU-26: Listado de Asistentes Sociales y Disponibilidad (GET /api/personal)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockRespuestaAsistentes: ListarPersonalResponse = {
    data: [
      {
        usuario_id: "00000000-0000-4000-8000-000000000010",
        rut: "15.678.901-2",
        nombres: "Claudia",
        apellidos: "Morales Pavez",
        email: "claudia.morales@valdivia.cl",
        telefono: "+56987654321",
        usuario_activo: true,
        fecha_ingreso: "2026-01-15",
        fecha_salida: null,
        rol_id: "20000000-0000-4000-8000-000000000006",
        rol_codigo: "ASISTENTE_SOCIAL",
        rol_nombre: "Asistente Social",
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        delegacion_codigo: "NORTE",
        delegacion_nombre: "Delegación Municipal Norte",
        personal_id: "40000000-0000-4000-8000-000000000010",
        especialidad: "Evaluación FIBE",
        cargo: "Asistente Social Terreno",
        estado_operativo: "disponible",
        disponible_terreno: true,
        observaciones: null,
        personal_updated_at: new Date(),
        es_personal: true,
        casos_fibe_asignados: 2,
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
  };

  it("debe retornar 200 y la lista de asistentes sociales con casos_fibe_asignados cuando el usuario tiene permiso (CA-2, CA-6)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado Municipal",
      rol: "Encargado",
    });
    vi.spyOn(personalListadoService, "listarPersonalService").mockResolvedValueOnce(
      mockRespuestaAsistentes
    );

    const req = new NextRequest(
      "http://localhost:3000/api/personal?rolCodigo=ASISTENTE_SOCIAL&delegacionId=30000000-0000-4000-8000-000000000001&estadoOperativo=disponible",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-encargado-valido",
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(authService.verificarPermiso).toHaveBeenCalledWith(
      usuarioEncargadoId,
      PERMISO_LEER_ASISTENCIA_SOCIAL
    );
    expect(body.data).toHaveLength(1);
    expect(body.data[0].rol_codigo).toBe("ASISTENTE_SOCIAL");
    expect(body.data[0].casos_fibe_asignados).toBe(2);
    expect(body.data[0].estado_operativo).toBe("disponible");
  });

  it("debe retornar 401 si se consulta por ASISTENTE_SOCIAL sin cabecera de autenticación", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3000/api/personal?rolCodigo=ASISTENTE_SOCIAL",
      {
        method: "GET",
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.message).toContain("Se requiere cabecera de autenticación");
  });

  it("debe retornar 403 si el usuario autenticado no posee el permiso asistencia_social:leer (CA-6)", async () => {
    const usuarioOperadorId = "00000000-0000-4000-8000-000000000099";
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioOperadorId);
    vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: asistencia_social:leer")
    );

    const req = new NextRequest(
      "http://localhost:3000/api/personal?rolCodigo=ASISTENTE_SOCIAL",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-operador-sin-permiso",
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.message).toContain("asistencia_social:leer");
  });

  it("debe permitir consultas de personal general sin exigir permiso de asistencia social", async () => {
    const spyPermiso = vi.spyOn(authService, "verificarPermiso");
    vi.spyOn(personalListadoService, "listarPersonalService").mockResolvedValueOnce({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/personal?busqueda=Pérez", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(spyPermiso).not.toHaveBeenCalled();
  });

  it("debe responder 400 si los query params son inválidos (ej. UUID mal formado)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/personal?delegacionId=uuid-invalido",
      {
        method: "GET",
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.message).toBe("Parámetros de consulta inválidos");
  });
});
