import { NextRequest, NextResponse } from "next/server";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import { LoginRequestSchema } from "@/modules/seguridad/schema";
import { seguridadService } from "@/modules/seguridad/service";

/**
 * POST /api/seguridad/login
 *
 * Inicia sesión con credenciales institucionales (correo o RUT y contraseña).
 * Retorna JWT de sesión y perfil completo de permisos del usuario.
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

    const parseResult = LoginRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Datos de autenticación inválidos",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const response = await seguridadService.login(parseResult.data);
    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error en POST /api/seguridad/login:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el inicio de sesión" },
      { status: 500 }
    );
  }
}
