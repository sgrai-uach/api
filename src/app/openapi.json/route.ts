import { NextResponse } from "next/server";
import { generarOpenAPISpec } from "@/lib/openapi";

/**
 * GET /openapi.json
 *
 * Endpoint público que expone la especificación OpenAPI generada
 * automáticamente a partir de los esquemas Zod de los endpoints.
 * Consumido por sgrai-web y sgrai-pwa para generar tipos automáticamente.
 */
export async function GET() {
  const spec = generarOpenAPISpec();
  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
