import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { exigirUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError } from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  exigirUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  enviarReporteVerificacionService: vi.fn(),
}));

describe("POST /api/misiones/[id]/reporte — Autenticación JWT estricta (BUG-H39-API-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe rechazar con 401 si no existe token Bearer JWT aunque se envíe cabecera x-user-id", async () => {
    vi.mocked(exigirUsuarioId).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere un token JWT válido en la cabecera Authorization.")
    );

    const request = new NextRequest(
      "http://localhost:3001/api/misiones/60000000-0000-4000-8000-000000000001/reporte",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify({
          dictamen: "REQUIERE_CUADRILLA",
          resumen_tecnico: "Resumen técnico de verificación en terreno.",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(401);
    expect(exigirUsuarioId).toHaveBeenCalledTimes(1);
  });
});
