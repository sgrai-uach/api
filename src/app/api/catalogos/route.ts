import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/catalogos
 *
 * Entrega los catálogos de referencia (roles y delegaciones activas)
 * para alimentar los selects y evitar inconsistencias al ingresar datos.
 */
export async function GET() {
  try {
    const roles = await db
      .selectFrom("roles")
      .select(["id", "codigo", "nombre"])
      .where("activo", "=", true)
      .orderBy("nombre", "asc")
      .execute();

    const delegaciones = await db
      .selectFrom("delegaciones")
      .select(["id", "codigo", "nombre"])
      .where("activo", "=", true)
      .orderBy("nombre", "asc")
      .execute();

    const especialidades = await db
      .selectFrom("personal")
      .select("especialidad")
      .distinct()
      .where("especialidad", "is not", null)
      .where("especialidad", "!=", "")
      .orderBy("especialidad", "asc")
      .execute();

    const cargos = await db
      .selectFrom("personal")
      .select("cargo")
      .distinct()
      .where("cargo", "is not", null)
      .where("cargo", "!=", "")
      .orderBy("cargo", "asc")
      .execute();

    return NextResponse.json({
      data: {
        roles,
        delegaciones,
        especialidades: especialidades.map((e) => e.especialidad!),
        cargos: cargos.map((c) => c.cargo!),
      },
    });
  } catch (error) {
    console.error("Error al obtener catálogos:", error);
    return NextResponse.json(
      { error: "Error interno al cargar catálogos" },
      { status: 500 }
    );
  }
}
