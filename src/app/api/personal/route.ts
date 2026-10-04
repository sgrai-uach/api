import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { RegistrarEmpleadoSchema } from "@/modules/recursos-y-personal/schemas/registrar-empleado.schema";
import {
  registrarEmpleado,
  RutDuplicadoError,
  EmailDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "@/modules/recursos-y-personal/services/registrar-empleado.service";
import { verificarAdministrador } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

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
    const estado = searchParams.get("estado")?.toLowerCase();
    const incluirInactivos = searchParams.get("incluir_inactivos") === "true" || estado === "todos" || estado === "inactivo";
    const delegacionId = searchParams.get("delegacion_id")?.trim();
    const rolId = searchParams.get("rol_id")?.trim();
    const ordenarPor = searchParams.get("ordenar_por") || "apellidos"; // apellidos | nombres | rut
    const orden = searchParams.get("orden")?.toLowerCase() === "desc" ? "desc" : "asc";
    const limiteParam = searchParams.get("limite") || searchParams.get("limit");
    const limite = limiteParam ? Math.min(Math.max(1, parseInt(limiteParam, 10) || 50), 100) : 50;
    const paginaParam = searchParams.get("pagina") || searchParams.get("page");
    const pagina = paginaParam ? Math.max(1, parseInt(paginaParam, 10) || 1) : 1;
    const offset = (pagina - 1) * limite;

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

    if (estado === "inactivo") {
      query = query.where("usuarios.activo", "=", false);
    } else if (!incluirInactivos) {
      query = query.where("usuarios.activo", "=", true);
    }

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

    const empleados = await query.limit(limite).offset(offset).execute();

    return NextResponse.json({
      data: empleados.map((e) => ({
        ...e,
        es_personal: e.personal_id !== null,
      })),
      paginacion: {
        pagina,
        limite,
        total_retornados: empleados.length,
      },
    });
  } catch (error) {
    console.error("Error al listar empleados:", error);
    return NextResponse.json(
      { error: "Error interno al obtener lista de empleados", message: "Error interno al obtener lista de empleados" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/personal
 *
 * Registra a un nuevo funcionario o empleado municipal en el sistema SGRAI (HU-10).
 * Persiste transaccionalmente en la tabla 'usuario' y opcionalmente en 'personal'
 * si desempeña labores operativas de terreno. Genera log de auditoría en 'log_cambios_usuarios'.
 *
 * Requiere sesión autenticada con perfil 'Administrador' (Bearer JWT).
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verificarAdministrador(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de solicitud inválido o JSON mal formado" },
        { status: 400 }
      );
    }

    const datosValidados = RegistrarEmpleadoSchema.parse(body);

    const empleadoCreado = await registrarEmpleado(datosValidados, admin.id);

    return NextResponse.json(
      {
        mensaje: "Funcionario registrado exitosamente",
        data: empleadoCreado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de entrada inválidos",
          detalles: error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 422 }
      );
    }

    if (error instanceof RutDuplicadoError || error instanceof EmailDuplicadoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof RolNotFoundError || error instanceof DelegacionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("Error no controlado al registrar funcionario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el registro del funcionario" },
      { status: 500 }
    );
  }
}
