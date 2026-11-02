import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as restablecerHandler } from "../route";
import {
  recuperacionContrasenaService,
  MENSAJE_RESTABLECIMIENTO_EXITOSO,
  MENSAJE_TOKEN_INVALIDO,
} from "@/modules/seguridad/recuperacion-contrasena.service";
import { BadRequestError } from "@/modules/seguridad/errors";

describe("Endpoint POST /api/seguridad/restablecer-contrasena", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const tokenPrueba = "token-valido-base64url-prueba-12345";
  const passwordValida = "Valdivia2026!Nueva";

  it("debe retornar 200 OK cuando los datos y el token son válidos", async () => {
    vi.spyOn(
      recuperacionContrasenaService,
      "restablecerContrasena"
    ).mockResolvedValueOnce({
      message: MENSAJE_RESTABLECIMIENTO_EXITOSO,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/restablecer-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          token: tokenPrueba,
          nuevaPassword: passwordValida,
          confirmacionPassword: passwordValida,
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await restablecerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe(MENSAJE_RESTABLECIMIENTO_EXITOSO);
    expect(
      recuperacionContrasenaService.restablecerContrasena
    ).toHaveBeenCalledWith({
      token: tokenPrueba,
      nuevaPassword: passwordValida,
      confirmacionPassword: passwordValida,
    });
  });

  it("debe retornar 400 Bad Request si la confirmación de contraseña no coincide", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/restablecer-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          token: tokenPrueba,
          nuevaPassword: passwordValida,
          confirmacionPassword: "DiferentePassword2026!",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await restablecerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Datos de solicitud inválidos");
    expect(json.details.confirmacionPassword[0]).toContain(
      "Las contraseñas no coinciden"
    );
  });

  it("debe retornar 400 Bad Request si la contraseña no cumple la política (ej. sin número o menor a 8 caracteres)", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/restablecer-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          token: tokenPrueba,
          nuevaPassword: "corta",
          confirmacionPassword: "corta",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await restablecerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Datos de solicitud inválidos");
    expect(json.details.nuevaPassword).toBeDefined();
  });

  it("debe retornar 400 Bad Request con mensaje de error de dominio si el token es inválido o expiró", async () => {
    vi.spyOn(
      recuperacionContrasenaService,
      "restablecerContrasena"
    ).mockRejectedValueOnce(new BadRequestError(MENSAJE_TOKEN_INVALIDO));

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/restablecer-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          token: "token-expirado",
          nuevaPassword: passwordValida,
          confirmacionPassword: passwordValida,
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await restablecerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe(MENSAJE_TOKEN_INVALIDO);
  });

  it("debe retornar 400 Bad Request si el cuerpo de solicitud no es un JSON válido", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/restablecer-contrasena",
      {
        method: "POST",
        body: "no-es-un-json",
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await restablecerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Cuerpo de solicitud inválido o JSON mal formado");
  });

  it("debe retornar 500 ante un error no controlado en el servidor", async () => {
    vi.spyOn(
      recuperacionContrasenaService,
      "restablecerContrasena"
    ).mockRejectedValueOnce(new Error("Error catastrófico de base de datos"));

    const request = new NextRequest(
      "http://localhost:3000/api/seguridad/restablecer-contrasena",
      {
        method: "POST",
        body: JSON.stringify({
          token: tokenPrueba,
          nuevaPassword: passwordValida,
          confirmacionPassword: passwordValida,
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await restablecerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      "Error interno al procesar el restablecimiento de contraseña"
    );
  });
});
