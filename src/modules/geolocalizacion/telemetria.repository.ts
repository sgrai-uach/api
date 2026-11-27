import { db } from "@/lib/db";
import type { TipoUnidadTelemetria } from "./telemetria.schema";

export type CodigoRechazoTelemetria =
  | "USUARIO_INACTIVO"
  | "UNIDAD_NO_ENCONTRADA"
  | "SIN_PERTENENCIA_UNIDAD"
  | "UNIDAD_DISPONIBLE"
  | "MISION_NO_EN_CURSO";

export type ResultadoHabilitacionTelemetria =
  | {
      habilitada: true;
      misionActivaId: string;
      unidadNombre: string;
    }
  | {
      habilitada: false;
      codigo: CodigoRechazoTelemetria;
      mensaje: string;
    };

export type ResultadoPertenenciaUnidad =
  | {
      autorizada: true;
      unidadNombre: string;
    }
  | {
      autorizada: false;
      codigo: "USUARIO_INACTIVO" | "UNIDAD_NO_ENCONTRADA" | "SIN_PERTENENCIA_UNIDAD";
      mensaje: string;
    };

async function obtenerUsuarioActivoYRol(usuarioId: string) {
  return db
    .selectFrom("usuario")
    .innerJoin("rol", "rol.id", "usuario.rol_id")
    .select(["usuario.id", "usuario.activo", "rol.codigo as rol_codigo", "rol.nombre as rol_nombre"])
    .where("usuario.id", "=", usuarioId)
    .executeTakeFirst();
}

function esUsuarioAdmin(rolCodigo?: string | null, rolNombre?: string | null): boolean {
  return rolCodigo === "ADMIN" || rolNombre === "Administrador";
}

/**
 * Verifica que el usuario autenticado esté activo y pertenezca a la unidad indicada (o sea ADMIN).
 */
export async function verificarPertenenciaUnidadRepo(params: {
  usuarioId: string;
  unidadId: string;
  tipoUnidad: TipoUnidadTelemetria;
}): Promise<ResultadoPertenenciaUnidad> {
  const usuario = await obtenerUsuarioActivoYRol(params.usuarioId);
  if (!usuario || !usuario.activo) {
    return {
      autorizada: false,
      codigo: "USUARIO_INACTIVO",
      mensaje: "El usuario autenticado no existe o se encuentra inactivo en el sistema.",
    };
  }

  const esAdmin = esUsuarioAdmin(usuario.rol_codigo, usuario.rol_nombre);

  if (params.tipoUnidad === "PATRULLA") {
    const patrulla = await db
      .selectFrom("patrulla_verificadora")
      .select(["id", "nombre", "usuario_lider_id"])
      .where("id", "=", params.unidadId)
      .where("activo", "=", true)
      .where("eliminado_en", "is", null)
      .executeTakeFirst();

    if (!patrulla) {
      return {
        autorizada: false,
        codigo: "UNIDAD_NO_ENCONTRADA",
        mensaje: `La patrulla verificadora '${params.unidadId}' no existe o está desactivada.`,
      };
    }

    if (!esAdmin && patrulla.usuario_lider_id !== params.usuarioId) {
      const integrante = await db
        .selectFrom("patrulla_personal")
        .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
        .select("patrulla_personal.id")
        .where("patrulla_personal.patrulla_id", "=", params.unidadId)
        .where("personal.usuario_id", "=", params.usuarioId)
        .executeTakeFirst();

      if (!integrante) {
        return {
          autorizada: false,
          codigo: "SIN_PERTENENCIA_UNIDAD",
          mensaje: "El usuario autenticado no pertenece a la patrulla verificadora indicada.",
        };
      }
    }

    return { autorizada: true, unidadNombre: patrulla.nombre };
  }

  const cuadrilla = await db
    .selectFrom("cuadrilla")
    .select(["id", "nombre", "usuario_delegado_id"])
    .where("id", "=", params.unidadId)
    .where("activo", "=", true)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();

  if (!cuadrilla) {
    return {
      autorizada: false,
      codigo: "UNIDAD_NO_ENCONTRADA",
      mensaje: `La cuadrilla operativa '${params.unidadId}' no existe o está desactivada.`,
    };
  }

  if (!esAdmin && cuadrilla.usuario_delegado_id !== params.usuarioId) {
    const integrante = await db
      .selectFrom("cuadrilla_personal")
      .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
      .select("cuadrilla_personal.id")
      .where("cuadrilla_personal.cuadrilla_id", "=", params.unidadId)
      .where("personal.usuario_id", "=", params.usuarioId)
      .where("cuadrilla_personal.activo", "=", true)
      .executeTakeFirst();

    if (!integrante) {
      return {
        autorizada: false,
        codigo: "SIN_PERTENENCIA_UNIDAD",
        mensaje: "El usuario autenticado no pertenece a la cuadrilla operativa indicada.",
      };
    }
  }

  return { autorizada: true, unidadNombre: cuadrilla.nombre };
}

/**
 * Valida las reglas de negocio ICS (CA-1 y CA-4) antes de aceptar y retransmitir telemetría GPS:
 * 1. El usuario emisor existe y está activo en PostgreSQL.
 * 2. La unidad (patrulla o cuadrilla) existe, está activa y el usuario pertenece a ella (o es ADMIN).
 * 3. La unidad no está en estado DISPONIBLE y posee una misión activa en estado EN_CURSO.
 */
export async function verificarHabilitacionTelemetriaUnidadRepo(params: {
  usuarioId: string;
  unidadId: string;
  tipoUnidad: TipoUnidadTelemetria;
}): Promise<ResultadoHabilitacionTelemetria> {
  const pertenencia = await verificarPertenenciaUnidadRepo(params);
  if (!pertenencia.autorizada) {
    return {
      habilitada: false,
      codigo: pertenencia.codigo,
      mensaje: pertenencia.mensaje,
    };
  }

  if (params.tipoUnidad === "PATRULLA") {
    const patrulla = await db
      .selectFrom("patrulla_verificadora")
      .select(["id", "nombre", "estado"])
      .where("id", "=", params.unidadId)
      .executeTakeFirst();

    if (!patrulla || patrulla.estado === "DISPONIBLE") {
      return {
        habilitada: false,
        codigo: "UNIDAD_DISPONIBLE",
        mensaje:
          "La patrulla verificadora se encuentra en estado DISPONIBLE; la transmisión de telemetría debe pausarse.",
      };
    }

    const misionEnCurso = await db
      .selectFrom("mision")
      .select(["id"])
      .where("patrulla_id", "=", params.unidadId)
      .where("estado", "=", "EN_CURSO")
      .executeTakeFirst();

    if (!misionEnCurso) {
      return {
        habilitada: false,
        codigo: "MISION_NO_EN_CURSO",
        mensaje:
          "La patrulla verificadora no posee una misión en estado EN_CURSO para transmitir telemetría.",
      };
    }

    return {
      habilitada: true,
      misionActivaId: misionEnCurso.id,
      unidadNombre: patrulla.nombre,
    };
  }

  const cuadrilla = await db
    .selectFrom("cuadrilla")
    .select(["id", "nombre", "estado"])
    .where("id", "=", params.unidadId)
    .executeTakeFirst();

  if (!cuadrilla || cuadrilla.estado === "DISPONIBLE") {
    return {
      habilitada: false,
      codigo: "UNIDAD_DISPONIBLE",
      mensaje:
        "La cuadrilla operativa se encuentra en estado DISPONIBLE; la transmisión de telemetría debe pausarse.",
    };
  }

  const misionEnCurso = await db
    .selectFrom("mision")
    .select(["id"])
    .where("cuadrilla_id", "=", params.unidadId)
    .where("estado", "=", "EN_CURSO")
    .executeTakeFirst();

  if (!misionEnCurso) {
    return {
      habilitada: false,
      codigo: "MISION_NO_EN_CURSO",
      mensaje:
        "La cuadrilla operativa no posee una misión en estado EN_CURSO para transmitir telemetría.",
    };
  }

  return {
    habilitada: true,
    misionActivaId: misionEnCurso.id,
    unidadNombre: cuadrilla.nombre,
  };
}

