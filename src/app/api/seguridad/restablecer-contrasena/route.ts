import { NextRequest, NextResponse } from "next/server";
import { BadRequestError } from "@/modules/seguridad/errors";
import { RestablecerContrasenaRequestSchema } from "@/modules/seguridad/schema";
import { recuperacionContrasenaService } from "@/modules/seguridad/recuperacion-contrasena.service";

/**
 * POST /api/seguridad/restablecer-contrasena
 *
 * Restablece la contraseña de un funcionario mediante token criptográfico de un solo uso.
 * Aplica hashing bcrypt (factor 10), invalida el token y reinicia atómicamente los contadores de bloqueo.
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

    const parseResult = RestablecerContrasenaRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Datos de solicitud inválidos",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const response = await recuperacionContrasenaService.restablecerContrasena(
      parseResult.data
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(
      "Error en POST /api/seguridad/restablecer-contrasena:",
      error
    );
    return NextResponse.json(
      { error: "Error interno al procesar el restablecimiento de contraseña" },
      { status: 500 }
    );
  }
}
