import { NextRequest, NextResponse } from "next/server";
import {
  ListarPuntosCriticosQuerySchema,
  CrearPuntoCriticoBodySchema,
} from "@/modules/eventos-atp/punto-critico.schema";
import {
  listarPuntosCriticos,
  crearPuntoCritico,
} from "@/modules/eventos-atp/punto-critico.service";
import {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";

/**
 * GET /api/puntos-criticos
 * Consulta y monitoreo de la lista de puntos críticos en Valdivia (HU-57).
 * Acceso restringido exclusivamente al perfil Administrador del SGRAI.
 */
export async function GET(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    // Parsear parámetros de consulta (query params)
    const searchParams = req.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const resultadoValidacion = ListarPuntosCriticosQuerySchema.safeParse(queryParams);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const respuestaPaginada = await listarPuntosCriticos(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(respuestaPaginada, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al consultar listado de puntos críticos:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/puntos-criticos
 * Registra un nuevo punto crítico o sector vulnerable con coordenadas PostGIS (HU-58).
 * Autogenera el código correlativo y emite notificación reactiva en tiempo real vía Socket.io.
 * Acceso restringido exclusivamente al perfil Administrador del SGRAI.
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud no es un JSON válido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = CrearPuntoCriticoBodySchema.safeParse(bodyJson);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de creación de punto crítico inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const nuevoPunto = await crearPuntoCritico(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(nuevoPunto, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error al crear punto crítico:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
