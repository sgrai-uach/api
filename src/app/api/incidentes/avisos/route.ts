import { NextRequest, NextResponse } from "next/server";
import { CrearAvisoIncidenteInputSchema } from "@/modules/incidentes/aviso-incidente.schema";
import { registrarAvisoDesdeChatbot } from "@/modules/incidentes/aviso-incidente.service";

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

    const resultadoValidacion = CrearAvisoIncidenteInputSchema.safeParse(body);
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

    const aviso = await registrarAvisoDesdeChatbot(resultadoValidacion.data);

    // Si es duplicado se responde 200 OK con el código existente; si es nuevo se responde 201 Created
    const statusCode = aviso.esDuplicado ? 200 : 201;

    return NextResponse.json(
      {
        message: aviso.mensaje,
        data: aviso,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error("Error al registrar aviso de incidente:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el reporte de incidente." },
      { status: 500 }
    );
  }
}
