import { NextRequest, NextResponse } from "next/server";
import { BadRequestError } from "@/modules/seguridad/errors";
import { RecuperarContrasenaRequestSchema } from "@/modules/seguridad/schema";
import { recuperacionContrasenaService } from "@/modules/seguridad/recuperacion-contrasena.service";

/**
 * POST /api/seguridad/recuperar-contrasena
 *
 * Solicita el restablecimiento de contraseña mediante correo institucional (@valdivia.cl) o RUT.
 * Aplica protección estricta contra enumeración de cuentas respondiendo siempre 200 OK con mensaje genérico.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de solicitud inválido o JSON mal formado" },
        { status: 400 }
      );
    }

    const parseResult = RecuperarContrasenaRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Datos de solicitud inválidos",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const response = await recuperacionContrasenaService.solicitarRecuperacion(
      parseResult.data
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(
      "Error en POST /api/seguridad/recuperar-contrasena:",
      error
    );
    return NextResponse.json(
      { error: "Error interno al procesar la solicitud de recuperación de contraseña" },
      { status: 500 }
    );
  }
}
