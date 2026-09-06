import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Endpoint de health check. Devuelve el estado del servicio
 * y un timestamp para verificar que la API está operativa.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
