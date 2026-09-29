import { NextRequest, NextResponse } from "next/server";
import { consultarAvisoPorSeguimiento } from "@/modules/incidentes/aviso-incidente.service";

interface RouteContext {
  params: Promise<{ codigo: string }>;
}

export async function GET(_req: NextRequest, props: RouteContext) {
  try {
    const { codigo } = await props.params;

    if (!codigo || typeof codigo !== "string" || codigo.trim() === "") {
      return NextResponse.json(
        { message: "El código de seguimiento es obligatorio." },
        { status: 400 }
      );
    }

    const aviso = await consultarAvisoPorSeguimiento(codigo.trim());

    if (!aviso) {
      return NextResponse.json(
        { message: "No se encontró ningún reporte asociado al código de seguimiento proporcionado." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Reporte encontrado exitosamente.",
        data: aviso,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al consultar aviso por código:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar el reporte de incidente." },
      { status: 500 }
    );
  }
}
