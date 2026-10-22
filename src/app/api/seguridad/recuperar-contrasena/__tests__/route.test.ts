import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as recuperarHandler } from "../route";
import {
  recuperacionContrasenaService,
  MENSAJE_RECUPERACION_GENERICO,
} from "@/modules/seguridad/recuperacion-contrasena.service";

describe("Endpoint POST /api/seguridad/recuperar-contrasena", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 200 OK con mensaje genérico para un correo @valdivia.cl válido", async () => {
    vi.spyOn(
      recuperacionContrasenaService,
      "solicitarRecuperacion"
    ).mockResolvedValueOnce({
      message: MENSAJE_RECUPERACION_GENERICO,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/recuperar-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          identificador: "funcionario.operativo@valdivia.cl",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await recuperarHandler(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe(MENSAJE_RECUPERACION_GENERICO);
    expect(
      recuperacionContrasenaService.solicitarRecuperacion
    ).toHaveBeenCalledWith({
      identificador: "funcionario.operativo@valdivia.cl",
    });
  });

  it("debe retornar 200 OK con mensaje genérico para un RUT chileno válido", async () => {
    vi.spyOn(
      recuperacionContrasenaService,
      "solicitarRecuperacion"
    ).mockResolvedValueOnce({
      message: MENSAJE_RECUPERACION_GENERICO,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/recuperar-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          identificador: "11111111-1",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await recuperarHandler(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe(MENSAJE_RECUPERACION_GENERICO);
  });

  it("debe retornar 400 Bad Request si el identificador es un correo no institucional (ej. gmail.com)", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/recuperar-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          identificador: "externo@gmail.com",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await recuperarHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Datos de solicitud inválidos");
    expect(json.details.identificador[0]).toContain(
      "correo institucional (@valdivia.cl) o un RUT chileno válido"
    );
  });

  it("debe retornar 400 Bad Request si el identificador está vacío", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/recuperar-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          identificador: "   ",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await recuperarHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Datos de solicitud inválidos");
  });

  it("debe retornar 400 Bad Request si el cuerpo de la solicitud no es JSON válido", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/recuperar-contrasena",
      {
        method: "POST",
        body: "cuerpo-mal-formado-no-json",
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await recuperarHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Cuerpo de solicitud inválido o JSON mal formado");
  });

  it("debe retornar 500 si ocurre un error inesperado no controlado en el servicio", async () => {
    vi.spyOn(
      recuperacionContrasenaService,
      "solicitarRecuperacion"
    ).mockRejectedValueOnce(new Error("Fallo de conexión a la base de datos"));

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/recuperar-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          identificador: "admin@valdivia.cl",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await recuperarHandler(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      "Error interno al procesar la solicitud de recuperación de contraseña"
    );
  });
});
