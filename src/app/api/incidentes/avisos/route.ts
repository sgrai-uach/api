import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { CrearAvisoIncidenteInputSchema } from "@/modules/incidentes/aviso-incidente.schema";
import { registrarAvisoDesdeChatbot } from "@/modules/incidentes/aviso-incidente.service";
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
 * Registro de reporte guiado del chatbot o aviso preliminar.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    // 1. Si incluye origenReporte o campos de aviso general para bandeja de verificación Call Center (HU-52)
    if (typeof body === "object" && body !== null && "origenReporte" in body) {
      const validacionGeneral = CrearAvisoInputSchema.safeParse(body);
      if (validacionGeneral.success) {
        const avisoCreado = await incidentesService.crearAviso(validacionGeneral.data);
        return NextResponse.json(
          {
            mensaje: "Aviso preliminar registrado exitosamente",
            data: avisoCreado,
          },
          { status: 201 }
        );
      }
    }

    // 2. Probar validación de Chatbot / Informante ciudadano (ERD alignment)
    const validacionChatbot = CrearAvisoIncidenteInputSchema.safeParse(body);
    if (validacionChatbot.success) {
      const aviso = await registrarAvisoDesdeChatbot(validacionChatbot.data);
      const statusCode = aviso.esDuplicado ? 200 : 201;
      return NextResponse.json(
        {
          message: aviso.mensaje,
          data: aviso,
        },
        { status: statusCode }
      );
    }

    // 3. Probar validación alternativa (HU-52 aviso general)
    const validacionGeneral = CrearAvisoInputSchema.safeParse(body);
    if (validacionGeneral.success) {
      const avisoCreado = await incidentesService.crearAviso(validacionGeneral.data);
      return NextResponse.json(
        {
          mensaje: "Aviso preliminar registrado exitosamente",
          data: avisoCreado,
        },
        { status: 201 }
      );
    }

    // Si ninguna validación pasó, retornar errores detallados del esquema principal
    return NextResponse.json(
      {
        message: "Datos de entrada inválidos.",
        errors: validacionChatbot.error.issues.map((issue) => ({
          campo: issue.path.join("."),
          mensaje: issue.message,
        })),
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error al registrar aviso de incidente:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el reporte de incidente." },
      { status: 500 }
    );
  }
}
