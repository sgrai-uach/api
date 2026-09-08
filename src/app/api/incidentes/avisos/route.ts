import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  CrearAvisoInputSchema,
  ListarAvisosQuerySchema,
} from "@/modules/incidentes/schema";
import { incidentesService } from "@/modules/incidentes/service";

/**
 * GET /api/incidentes/avisos
 * Consulta paginada de avisos para el Call Center.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsedQuery = ListarAvisosQuerySchema.parse(searchParams);

    const resultado = await incidentesService.listarAvisos(parsedQuery);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Parámetros de consulta inválidos",
          detalles: error.issues,
        },
        { status: 400 }
      );
    }
    console.error("Error en GET /api/incidentes/avisos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar avisos" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incidentes/avisos
 * Registro de un nuevo aviso preliminar generado por un informante.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedInput = CrearAvisoInputSchema.parse(body);

    const avisoCreado = await incidentesService.crearAviso(parsedInput);
    return NextResponse.json(
      {
        mensaje: "Aviso preliminar registrado exitosamente",
        data: avisoCreado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos del aviso inválidos",
          detalles: error.issues,
        },
        { status: 400 }
      );
    }
    console.error("Error en POST /api/incidentes/avisos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al registrar el aviso" },
      { status: 500 }
    );
  }
}
