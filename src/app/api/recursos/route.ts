import { NextRequest, NextResponse } from "next/server";
import {
  CrearRecursoInputSchema,
  ListarRecursosQuerySchema,
} from "@/modules/recursos-y-personal/recurso.schema";
import {
  crearRecurso,
  listarRecursos,
} from "@/modules/recursos-y-personal/recurso.service";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";

function extraerUsuarioId(req: NextRequest): string | null {
  let usuarioId = req.headers.get("x-user-id");
  if (!usuarioId) {
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      usuarioId = auth.substring(7).trim();
    }
  }
  return usuarioId;
}

/**
 * GET /api/recursos
 * Consulta paginada del inventario logístico con filtros por estado y delegación.
 */
export async function GET(req: NextRequest) {
  try {
    const usuarioId = extraerUsuarioId(req);

    // Parsear parámetros de consulta (query params)
    const searchParams = req.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const resultadoValidacion = ListarRecursosQuerySchema.safeParse(queryParams);
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

    const respuestaPaginada = await listarRecursos(
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

    console.error("Error al consultar inventario de recursos:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recursos
 * Registro de un nuevo recurso en el inventario logístico (HU-6).
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = extraerUsuarioId(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = CrearRecursoInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const nuevoRecurso = await crearRecurso(resultadoValidacion.data, usuarioId);

    return NextResponse.json(
      {
        message: "Recurso creado exitosamente",
        data: nuevoRecurso,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al crear recurso:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
