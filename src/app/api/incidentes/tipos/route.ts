import { NextResponse } from "next/server";
import { TIPOS_AFECTACION } from "@/modules/incidentes/aviso-incidente.schema";

export async function GET() {
  return NextResponse.json(
    {
      message: "Tipos de afectación obtenidos exitosamente.",
      data: TIPOS_AFECTACION,
    },
    { status: 200 }
  );
}
