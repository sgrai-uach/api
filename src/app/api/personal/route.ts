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
import { EstadoOperativoInvalidoError } from "@/modules/recursos-y-personal/estado-operativo";
import { ListarPersonalQuerySchema } from "@/modules/recursos-y-personal/personal-listado.schema";
import { listarPersonalService } from "@/modules/recursos-y-personal/personal-listado.service";
import { verificarAdministrador, verificarAccesoPersonal } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

/**
 * GET /api/personal
 *
 * Lista y busca empleados/usuarios para los selectores del frontend.
 * Soporta paginación estándar (page, limit) y filtros:
 * - q / busqueda: término de búsqueda (RUT, nombres, apellidos, email)
 * - solo_personal / soloPersonal: 'true' si solo se buscan usuarios con ficha operativa en 'personal'
 * - delegacion_id / delegacionId: UUID de delegación territorial
 * - rol_id / rolId: UUID de rol
 * - estadoOperativo: estado operativo (disponibilidad actual) del funcionario
 * - incluirInactivos: 'true' para incluir funcionarios dados de baja (activo = false)
 * - ordenar_por / ordenarPor: apellidos | nombres | rut
 * - orden: asc | desc
 *
 * Requiere sesión autenticada con permiso 'personal:leer', 'personal:gestionar' o
 * 'personal:crear' (o rol Administrador).
 */
export async function GET(request: NextRequest) {
  try {
    await verificarAccesoPersonal(request);

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

    const resultado = await listarPersonalService(validacion.data);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message, message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message, message: error.message }, { status: 403 });
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

    if (error instanceof EstadoOperativoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
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
