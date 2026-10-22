import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RegistrarEmpleadoSchema } from "@/modules/recursos-y-personal/schemas/registrar-empleado.schema";
import {
  registrarEmpleado,
  RutDuplicadoError,
  EmailDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "@/modules/recursos-y-personal/services/registrar-empleado.service";
import { ListarPersonalQuerySchema } from "@/modules/recursos-y-personal/personal-listado.schema";
import { listarPersonalService } from "@/modules/recursos-y-personal/personal-listado.service";
import { extraerUsuarioId, verificarAdministrador } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_LEER_ASISTENCIA_SOCIAL } from "@/modules/seguridad/permisos.constants";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

/**
 * GET /api/personal
 *
 * Lista y busca empleados/usuarios para los selectores del frontend.
 * Soporta paginación estándar (page, limit) y filtros:
 * - rolCodigo / rol_codigo: código canónico del rol (ej. ASISTENTE_SOCIAL)
 * - q / busqueda: término de búsqueda (RUT, nombres, apellidos, email)
 * - solo_personal / soloPersonal: 'true' si solo se buscan usuarios con ficha operativa en 'personal'
 * - delegacion_id / delegacionId: UUID de delegación territorial
 * - rol_id / rolId: UUID de rol
 * - ordenar_por / ordenarPor: apellidos | nombres | rut
 * - orden: asc | desc
 *
 * Si se consulta por rol ASISTENTE_SOCIAL, valida el permiso 'asistencia_social:leer' (H26).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryRaw = Object.fromEntries(searchParams.entries());

    const validacion = ListarPersonalQuerySchema.safeParse(queryRaw);
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos",
          errors: validacion.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const rolCodigo = validacion.data.rolCodigo ?? validacion.data.rol_codigo;
    if (rolCodigo?.toUpperCase() === "ASISTENTE_SOCIAL") {
      const usuarioId =
        (await extraerUsuarioId(request)) ||
        request.headers.get("x-user-id")?.trim() ||
        null;

      if (!usuarioId) {
        return NextResponse.json(
          { message: "Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id." },
          { status: 401 }
        );
      }

      await verificarPermiso(usuarioId, PERMISO_LEER_ASISTENCIA_SOCIAL);
    }

    const resultado = await listarPersonalService(validacion.data);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

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
