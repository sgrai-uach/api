import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import {
  ListarPatrullasQuerySchema,
  CrearPatrullaInputSchema,
} from "@/modules/recursos-y-personal/patrulla.schema";
import {
  listarPatrullasService,
  crearPatrullaService,
} from "@/modules/recursos-y-personal/patrulla.service";

/**
 * GET /api/patrullas
 *
 * Consulta paginada y filtrada del estado operativo de las patrullas verificadoras
 * para el Centro de Mando del Encargado (HU-16).
 *
 * Filtros admitidos en query parameters:
 * - delegacionId: UUID de la delegación territorial adscrita.
 * - estado: DISPONIBLE | EN_VERIFICACION | EN_PREVENCION | EN_RECUPERACION | EN_MISION | NO_DISPONIBLE
 * - busqueda: Filtro textual sobre el código, nombre de patrulla o líder.
 * - page: Número de página (default 1).
 * - limit: Tamaño de página (default 20, max 100).
 *
 * Requiere autorización RBAC: permiso 'misiones:leer' (Encargado, Administrador, Supervisor).
 */
export async function GET(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    const searchParams = req.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const validacion = ListarPatrullasQuerySchema.safeParse(queryParams);
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: validacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await listarPatrullasService(validacion.data, usuarioId);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/patrullas:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar patrullas verificadoras." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patrullas
 *
 * Registra una nueva patrulla verificadora ingresando su código único,
 * delegación base y asignando dotación de personal y vehículo institucional (HU-83).
 *
 * Requiere autorización RBAC: permiso 'recursos:crear' (Administrador o logística).
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const validacion = CrearPatrullaInputSchema.safeParse(body);
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para dar de alta la patrulla.",
          errors: validacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await crearPatrullaService(validacion.data, usuarioId);
    return NextResponse.json(resultado, { status: 201 });
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
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error en POST /api/patrullas:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al dar de alta la patrulla verificadora." },
      { status: 500 }
    );
  }
}
