import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import {
  PatrullaIdParamSchema,
  ActualizarEstadoPatrullaInputSchema,
  ModificarPatrullaInputSchema,
} from "@/modules/recursos-y-personal/patrulla.schema";
import {
  obtenerDetallePatrullaService,
  actualizarEstadoPatrullaService,
  modificarPatrullaService,
} from "@/modules/recursos-y-personal/patrulla.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/patrullas/[id]
 *
 * Consulta el detalle unitario estructurado de una patrulla verificadora.
 * Requiere autorización RBAC: permiso 'misiones:leer' (Encargado, Administrador, Supervisor).
 */
export async function GET(req: NextRequest, props: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    const { id } = await props.params;

    const validacionId = PatrullaIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de patrulla inválido.",
          errors: validacionId.error.issues.map((i) => ({
            campo: "id",
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const detalle = await obtenerDetallePatrullaService(validacionId.data, usuarioId);
    if (!detalle) {
      return NextResponse.json(
        { message: "No se encontró la patrulla verificadora solicitada." },
        { status: 404 }
      );
    }

    return NextResponse.json(detalle, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/patrullas/[id]:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar la patrulla verificadora." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/patrullas/[id]
 *
 * Actualiza el estado operativo y/o geolocalización de una patrulla verificadora.
 * Emite en tiempo real el evento 'patrulla:actualizada' a la sala 'encargado'.
 * Requiere autorización RBAC: permiso 'misiones:leer' (Encargado, Administrador, Supervisor).
 */
export async function PATCH(req: NextRequest, props: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    const { id } = await props.params;

    const validacionId = PatrullaIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de patrulla inválido.",
          errors: validacionId.error.issues.map((i) => ({
            campo: "id",
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la petición debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ActualizarEstadoPatrullaInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de actualización inválidos.",
          errors: validacionBody.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await actualizarEstadoPatrullaService(
      validacionId.data,
      validacionBody.data,
      usuarioId
    );

    if (!resultado) {
      return NextResponse.json(
        { message: "No se encontró la patrulla verificadora especificada para actualizar." },
        { status: 404 }
      );
    }

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error en PATCH /api/patrullas/[id]:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al actualizar el estado de la patrulla." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/patrullas/[id]
 *
 * Modifica la delegación base, vehículo o personal asignado a una patrulla verificadora registrada (HU-84).
 * Bloquea la modificación con código 409 Conflict si la patrulla se encuentra en estado EN_VERIFICACION o en misión activa.
 * Requiere autorización RBAC: permiso 'recursos:editar' o perfil Administrador.
 */
export async function PUT(req: NextRequest, props: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    const { id } = await props.params;

    const validacionId = PatrullaIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de patrulla inválido.",
          errors: validacionId.error.issues.map((i) => ({
            campo: "id",
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la petición debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ModificarPatrullaInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de modificación inválidos.",
          errors: validacionBody.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await modificarPatrullaService(
      validacionId.data,
      validacionBody.data,
      usuarioId
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error en PUT /api/patrullas/[id]:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al modificar la patrulla verificadora." },
      { status: 500 }
    );
  }
}
