import { NextResponse } from "next/server";
import { generarOpenAPISpec } from "@/lib/openapi";

export async function GET() {
  const spec = generarOpenAPISpec();
  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
