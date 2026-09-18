import { NextResponse } from "next/server";
import { generarOpenApiSpec } from "@/lib/openapi";

/**
 * GET /openapi.json
 *
 * Endpoint público que expone la especificación OpenAPI generada
 * automáticamente a partir de los esquemas Zod de los endpoints.
 * Consumido por sgrai-web y sgrai-pwa para generar tipos automáticamente.
 */
export async function GET() {
  const spec = generarOpenApiSpec();
  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}
