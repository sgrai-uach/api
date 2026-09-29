import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/personal
 *
 * Lista y busca empleados/usuarios para los selectores del frontend.
 * Soporta query params:
 * - q: término de búsqueda (RUT, nombres, apellidos, email)
 * - solo_personal: 'true' si solo se buscan usuarios con ficha operativa en 'personal'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const soloPersonal = searchParams.get("solo_personal") === "true";
    const delegacionId = searchParams.get("delegacion_id")?.trim();
    const rolId = searchParams.get("rol_id")?.trim();
    const ordenarPor = searchParams.get("ordenar_por") || "apellidos"; // apellidos | nombres | rut
    const orden = searchParams.get("orden")?.toLowerCase() === "desc" ? "desc" : "asc";

    let query = db
      .selectFrom("usuarios")
      .leftJoin("roles", "roles.id", "usuarios.rol_id")
      .leftJoin("delegaciones", "delegaciones.id", "usuarios.delegacion_id")
      .leftJoin("personal", "personal.usuario_id", "usuarios.id")
      .select([
        "usuarios.id as usuario_id",
        "usuarios.rut",
        "usuarios.nombres",
        "usuarios.apellidos",
        "usuarios.email",
        "usuarios.telefono",
        "usuarios.activo as usuario_activo",
        "usuarios.fecha_ingreso",
        "usuarios.fecha_salida",
        "roles.id as rol_id",
        "roles.codigo as rol_codigo",
        "roles.nombre as rol_nombre",
        "delegaciones.id as delegacion_id",
        "delegaciones.codigo as delegacion_codigo",
        "delegaciones.nombre as delegacion_nombre",
        "personal.id as personal_id",
        "personal.especialidad",
        "personal.cargo",
        "personal.estado_operativo",
        "personal.disponible_terreno",
        "personal.observaciones",
        "personal.updated_at as personal_updated_at",
      ]);

    if (soloPersonal) {
      query = query.where("personal.id", "is not", null);
    }

    if (delegacionId) {
      query = query.where("usuarios.delegacion_id", "=", delegacionId);
    }

    if (rolId) {
      query = query.where("usuarios.rol_id", "=", rolId);
    }

    if (q) {
      const term = `%${q}%`;
      query = query.where((eb) =>
        eb.or([
          eb("usuarios.rut", "ilike", term),
          eb("usuarios.nombres", "ilike", term),
          eb("usuarios.apellidos", "ilike", term),
          eb("usuarios.email", "ilike", term),
        ])
      );
    }

    if (ordenarPor === "rut") {
      query = query.orderBy("usuarios.rut", orden);
    } else if (ordenarPor === "nombres") {
      query = query.orderBy("usuarios.nombres", orden).orderBy("usuarios.apellidos", orden);
    } else {
      query = query.orderBy("usuarios.apellidos", orden).orderBy("usuarios.nombres", orden);
    }

    const empleados = await query.limit(50).execute();

    return NextResponse.json({
      data: empleados.map((e) => ({
        ...e,
        es_personal: e.personal_id !== null,
      })),
    });
  } catch (error) {
    console.error("Error al listar empleados:", error);
    return NextResponse.json(
      { error: "Error interno al obtener lista de empleados" },
      { status: 500 }
    );
  }
}
