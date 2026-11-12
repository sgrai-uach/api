import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  VincularEntidadesInputSchema,
} from "@/modules/eventos-atp/vinculacion.schema";
import {
  desvincularEntidadesEventoAtpService,
  vincularEntidadesEventoAtpService,
} from "@/modules/eventos-atp/vinculacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";

const UuidParamSchema = z.string().uuid();

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function leerSolicitud(req: NextRequest, props: RouteContext) {
  const usuarioId = await extraerUsuarioId(req);

  if (!usuarioId) {
    throw new UnauthorizedError(
      "Se requiere cabecera de autenticación Authorization: Bearer <token>."
    );
  }

  const { id } = await props.params;
  const validacionId = UuidParamSchema.safeParse(id);

  if (!validacionId.success) {
    throw new BadRequestError(
      "El identificador del Evento ATP proporcionado no es un UUID válido."
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    throw new BadRequestError("El cuerpo de la solicitud no es un JSON válido.");
  }

  const validacionBody = VincularEntidadesInputSchema.safeParse(bodyJson);

  if (!validacionBody.success) {
    throw new BadRequestError(
      validacionBody.error.issues.map((issue) => issue.message).join(" ")
    );
  }

  return {
    usuarioId,
    eventoAtpId: validacionId.data,
    body: validacionBody.data,
  };
}

function responderError(error: unknown, contexto: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ message: error.message }, { status: 403 });
  }

  if (error instanceof BadRequestError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }

  if (error instanceof ConflictError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
  }

  console.error(`Error al ${contexto} entidades a un Evento ATP:`, error);
  return NextResponse.json(
    { message: `Error interno del servidor al ${contexto} entidades al Evento ATP.` },
    { status: 500 }
  );
}

/**
 * POST /api/eventos-atp/{id}/vinculos
 * Vincula una o varias entidades a un Evento ATP ACTIVO (H60).
 */
export async function POST(req: NextRequest, props: RouteContext) {
  try {
    const { usuarioId, eventoAtpId, body } = await leerSolicitud(req, props);

    const resultado = await vincularEntidadesEventoAtpService(
      eventoAtpId,
      body,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Entidades vinculadas al Evento ATP exitosamente.",
        data: resultado,
      },
      { status: 200 }
    );
  } catch (error) {
    return responderError(error, "vincular");
  }
}

/**
 * DELETE /api/eventos-atp/{id}/vinculos
 * Desvincula entidades del Evento ATP estableciendo evento_atp_id = NULL (H60).
 * No elimina los registros de las entidades.
 */
export async function DELETE(req: NextRequest, props: RouteContext) {
  try {
    const { usuarioId, eventoAtpId, body } = await leerSolicitud(req, props);

    const resultado = await desvincularEntidadesEventoAtpService(
      eventoAtpId,
      body,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Entidades desvinculadas del Evento ATP exitosamente.",
        data: resultado,
      },
      { status: 200 }
    );
  } catch (error) {
    return responderError(error, "desvincular");
  }
}
