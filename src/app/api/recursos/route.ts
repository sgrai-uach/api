import { NextRequest, NextResponse } from "next/server";
import { CrearRecursoInputSchema } from "@/modules/recursos-y-personal/recurso.schema";
import { crearRecurso } from "@/modules/recursos-y-personal/recurso.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

export async function POST(req: NextRequest) {
  try {
    // 1. Extraer cabecera provisional de autenticación
    const usuarioId = req.headers.get("x-user-id");

    // 2. Parsear cuerpo de la petición
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    // 3. Validar esquema Zod
    const resultadoValidacion = CrearRecursoInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Invocar servicio de negocio
    const nuevoRecurso = await crearRecurso(resultadoValidacion.data, usuarioId);

    return NextResponse.json(
      {
        message: "Recurso creado exitosamente",
        data: nuevoRecurso,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al crear recurso:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
