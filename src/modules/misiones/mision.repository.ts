import { db } from "@/lib/db";
import { sql } from "kysely";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";
import type { ReportarLlegadaBody } from "./mision-llegada.schema";

export interface MisionDetalleQueryResult {
  mision: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    tipo_mision: string;
    estado: string;
    prioridad: string;
    justificacion_rechazo: string | null;
    incidente_id: string | null;
    prevencion_id: string | null;
    cuadrilla_id: string | null;
    patrulla_id: string | null;
    encargado_id: string | null;
    creado_por_id: string;
    fecha_inicio: Date | string | null;
    fecha_cierre: Date | string | null;
    creado_en: Date | string;
    actualizado_en: Date | string;

    // Incidente
    incidente_codigo?: string | null;
    incidente_codigo_seguimiento?: string | null;
    incidente_tipo_afectacion?: string | null;
    incidente_descripcion?: string | null;
    incidente_direccion?: string | null;
    incidente_latitud?: number | string | null;
    incidente_longitud?: number | string | null;
    incidente_estado?: string | null;
    incidente_prioridad?: string | null;
    incidente_requiere_asistencia_social?: boolean | null;
    incidente_delegacion_nombre?: string | null;

    // Prevención
    prevencion_codigo?: string | null;
    prevencion_nombre?: string | null;
    prevencion_descripcion?: string | null;
    prevencion_latitud?: number | string | null;
    prevencion_longitud?: number | string | null;
    prevencion_delegacion_nombre?: string | null;

    // Creador
    creador_id?: string | null;
    creador_nombre?: string | null;
    creador_email?: string | null;

    // Encargado
    encargado_id_res?: string | null;
    encargado_nombre?: string | null;
    encargado_email?: string | null;

    // Cuadrilla
    cuadrilla_nombre?: string | null;
    cuadrilla_estado?: string | null;
    cuadrilla_delegacion_nombre?: string | null;
    delegado_id?: string | null;
    delegado_nombre?: string | null;
    delegado_email?: string | null;

    // Patrulla
    patrulla_nombre?: string | null;
    patrulla_estado?: string | null;
    patrulla_delegacion_nombre?: string | null;
    lider_id?: string | null;
    lider_nombre?: string | null;
    lider_email?: string | null;
  };
  recursosCuadrilla: Array<{
    id: string;
    nombre: string;
    tipo: string;
    cantidadAsignada: number;
  }>;
  reportesTerreno: Array<{
    id: string;
    mision_id: string;
    evaluador_id: string;
    resumen_tecnico: string;
    acciones_realizadas: string | null;
    requiere_apoyo_adicional: boolean;
    danos_estimados: string | null;
    observaciones: string | null;
    personas_afectadas: number;
    estado_terreno: string;
    creado_en: Date | string;
    actualizado_en: Date | string;
    evaluador_nombre: string | null;
    evaluador_email: string | null;
    evaluador_rut: string | null;
    adjuntos: Array<{
      id: string;
      nombre_archivo: string;
      url: string;
      tipo_mime: string;
      tamano_bytes: number | string | bigint;
      creado_en: Date | string;
    }>;
  }>;
}

/**
 * Consulta la base de datos para obtener el detalle exhaustivo de una misión por su ID.
 * Realiza los JOIN correspondientes entre Misión, Incidente, Prevención, Cuadrilla, Patrulla,
 * Reportes de Terreno y sus Evidencias Adjuntas.
 */
export async function obtenerMisionDetallePorIdRepo(
  id: string
): Promise<MisionDetalleQueryResult | null> {
  const mision = await db
    .selectFrom("mision")
    .leftJoin("incidente", "incidente.id", "mision.incidente_id")
    .leftJoin("delegacion as delegacion_incidente", "delegacion_incidente.id", "incidente.delegacion_id")
    .leftJoin("prevencion", "prevencion.id", "mision.prevencion_id")
    .leftJoin("delegacion as delegacion_prevencion", "delegacion_prevencion.id", "prevencion.delegacion_id")
    .leftJoin("usuario as creador", "creador.id", "mision.creado_por_id")
    .leftJoin("usuario as encargado", "encargado.id", "mision.encargado_id")
    .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
    .leftJoin("delegacion as delegacion_cuadrilla", "delegacion_cuadrilla.id", "cuadrilla.delegacion_id")
    .leftJoin("usuario as delegado", "delegado.id", "cuadrilla.usuario_delegado_id")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .leftJoin("delegacion as delegacion_patrulla", "delegacion_patrulla.id", "patrulla_verificadora.delegacion_id")
    .leftJoin("usuario as lider", "lider.id", "patrulla_verificadora.usuario_lider_id")
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.descripcion",
      "mision.tipo_mision",
      "mision.estado",
      "mision.prioridad",
      "mision.justificacion_rechazo",
      "mision.incidente_id",
      "mision.prevencion_id",
      "mision.cuadrilla_id",
      "mision.patrulla_id",
      "mision.encargado_id",
      "mision.creado_por_id",
      "mision.fecha_inicio",
      "mision.fecha_cierre",
      "mision.creado_en",
      "mision.actualizado_en",

      // Incidente
      "incidente.codigo as incidente_codigo",
      "incidente.codigo_seguimiento as incidente_codigo_seguimiento",
      "incidente.tipo_afectacion as incidente_tipo_afectacion",
      "incidente.descripcion as incidente_descripcion",
      "incidente.direccion_texto as incidente_direccion",
      "incidente.latitud as incidente_latitud",
      "incidente.longitud as incidente_longitud",
      "incidente.estado as incidente_estado",
      "incidente.prioridad as incidente_prioridad",
      "incidente.requiere_asistencia_social as incidente_requiere_asistencia_social",
      "delegacion_incidente.nombre as incidente_delegacion_nombre",

      // Prevención
      "prevencion.codigo as prevencion_codigo",
      "prevencion.nombre as prevencion_nombre",
      "prevencion.descripcion as prevencion_descripcion",
      "prevencion.latitud as prevencion_latitud",
      "prevencion.longitud as prevencion_longitud",
      "delegacion_prevencion.nombre as prevencion_delegacion_nombre",

      // Creador
      "creador.id as creador_id",
      "creador.nombre as creador_nombre",
      "creador.email as creador_email",

      // Encargado
      "encargado.id as encargado_id_res",
      "encargado.nombre as encargado_nombre",
      "encargado.email as encargado_email",

      // Cuadrilla
      "cuadrilla.nombre as cuadrilla_nombre",
      "cuadrilla.estado as cuadrilla_estado",
      "delegacion_cuadrilla.nombre as cuadrilla_delegacion_nombre",
      "delegado.id as delegado_id",
      "delegado.nombre as delegado_nombre",
      "delegado.email as delegado_email",

      // Patrulla
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
      "delegacion_patrulla.nombre as patrulla_delegacion_nombre",
      "lider.id as lider_id",
      "lider.nombre as lider_nombre",
      "lider.email as lider_email",
    ])
    .where("mision.id", "=", id)
    .executeTakeFirst();

  if (!mision) {
    return null;
  }

  // Recursos asignados a la cuadrilla de la misión (si corresponde)
  let recursosCuadrilla: Array<{
    id: string;
    nombre: string;
    tipo: string;
    cantidadAsignada: number;
  }> = [];

  if (mision.cuadrilla_id) {
    const filasRecursos = await db
      .selectFrom("cuadrilla_recurso")
      .innerJoin("recurso", "recurso.id", "cuadrilla_recurso.recurso_id")
      .select([
        "recurso.id",
        "recurso.nombre",
        "recurso.es_individual",
        "cuadrilla_recurso.cantidad_asignada",
      ])
      .where("cuadrilla_recurso.cuadrilla_id", "=", mision.cuadrilla_id)
      .execute();

    recursosCuadrilla = filasRecursos.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      tipo: r.es_individual ? "INDIVIDUAL" : "GRUPAL",
      cantidadAsignada: Number(r.cantidad_asignada),
    }));
  }

  // Reportes de terreno elaborados para esta misión
  const reportesFilas = await db
    .selectFrom("reporte_terreno")
    .leftJoin("usuario as evaluador", "evaluador.id", "reporte_terreno.evaluador_id")
    .select([
      "reporte_terreno.id",
      "reporte_terreno.mision_id",
      "reporte_terreno.evaluador_id",
      "reporte_terreno.resumen_tecnico",
      "reporte_terreno.acciones_realizadas",
      "reporte_terreno.requiere_apoyo_adicional",
      "reporte_terreno.danos_estimados",
      "reporte_terreno.observaciones",
      "reporte_terreno.personas_afectadas",
      "reporte_terreno.estado_terreno",
      "reporte_terreno.creado_en",
      "reporte_terreno.actualizado_en",
      "evaluador.nombre as evaluador_nombre",
      "evaluador.email as evaluador_email",
      "evaluador.rut as evaluador_rut",
    ])
    .where("reporte_terreno.mision_id", "=", id)
    .orderBy("reporte_terreno.creado_en", "asc")
    .execute();

  const reporteIds = reportesFilas.map((r) => r.id);
  type AdjuntoFila = {
    id: string;
    nombre_archivo: string;
    url: string;
    tipo_mime: string;
    tamano_bytes: number | string | bigint;
    reporte_terreno_id: string | null;
    creado_en: Date | string;
  };

  let adjuntosFilas: AdjuntoFila[] = [];

  if (reporteIds.length > 0) {
    adjuntosFilas = (await db
      .selectFrom("adjunto")
      .select([
        "id",
        "nombre_archivo",
        "url",
        "tipo_mime",
        "tamano_bytes",
        "reporte_terreno_id",
        "creado_en",
      ])
      .where("reporte_terreno_id", "in", reporteIds)
      .orderBy("creado_en", "asc")
      .execute()) as AdjuntoFila[];
  }

  // Asociar adjuntos a sus respectivos reportes de terreno
  const reportesTerreno = reportesFilas.map((rep) => ({
    ...rep,
    adjuntos: adjuntosFilas
      .filter((adj) => adj.reporte_terreno_id === rep.id)
      .map((adj) => ({
        id: adj.id,
        nombre_archivo: adj.nombre_archivo,
        url: adj.url,
        tipo_mime: adj.tipo_mime,
        tamano_bytes: adj.tamano_bytes,
        creado_en: adj.creado_en,
      })),
  }));

  return {
    mision,
    recursosCuadrilla,
    reportesTerreno,
  };
}

export interface ReportarLlegadaResultado {
  hito: {
    id: string;
    misionId: string;
    codigoMision: string;
    hito: "LLEGADA_TERRENO";
    descripcion: string;
    latitud: number;
    longitud: number;
    registradoEn: string;
    registradoPor: {
      id: string;
      nombre: string;
    };
    estadoMision: string;
    miembrosActualizados: number;
  };
  mision: {
    id: string;
    codigo: string;
    estado: string;
    cuadrillaId: string | null;
  };
}

/**
 * Registra atómicamente la llegada a terreno de una cuadrilla (HU-42).
 *
 * 1. Verifica la existencia de la misión y bloquea la fila para evitar concurrencia.
 * 2. Valida que la misión posea una cuadrilla asignada y que el usuario sea el delegado de la misma (o Administrador).
 * 3. Valida que el estado permita el reporte (rechaza COMPLETADA, CANCELADA o RECHAZADA con 409 Conflict).
 * 4. Valida que no se haya reportado previamente el hito LLEGADA_TERRENO (409 Conflict).
 * 5. Inserta el hito 'LLEGADA_TERRENO' en 'mision_hito' con coordenadas PostGIS.
 * 6. Actualiza 'mision.estado' a 'EN_CURSO' y 'mision.fecha_inicio' con CURRENT_TIMESTAMP.
 * 7. Actualiza 'personal.ultima_ubicacion' y 'personal.ultima_actualizacion_ubicacion' para los miembros de la cuadrilla y su delegado.
 */
export async function reportarLlegadaCuadrillaRepo(
  misionId: string,
  usuarioId: string,
  esAdmin: boolean,
  input: ReportarLlegadaBody
): Promise<ReportarLlegadaResultado> {
  return await db.transaction().execute(async (trx) => {
    // 1. Obtener la misión con su cuadrilla asignada y bloquear para actualización
    const mision = await trx
      .selectFrom("mision")
      .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
      .select([
        "mision.id",
        "mision.codigo",
        "mision.estado",
        "mision.tipo_mision",
        "mision.cuadrilla_id",
        "mision.fecha_inicio",
        "cuadrilla.usuario_delegado_id",
        "cuadrilla.nombre as cuadrilla_nombre",
      ])
      .where("mision.id", "=", misionId)
      .forUpdate()
      .executeTakeFirst();

    if (!mision) {
      throw new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.");
    }

    if (!mision.cuadrilla_id) {
      throw new BadRequestError("La misión no tiene una cuadrilla operativa asignada.");
    }

    // 2. Validar pertenencia táctica: solo el delegado asignado o un Administrador pueden reportar arribo
    if (!esAdmin && mision.usuario_delegado_id !== usuarioId) {
      throw new ForbiddenError(
        "Acceso denegado. Solo el delegado asignado a la cuadrilla de esta misión puede reportar la llegada a terreno."
      );
    }

    // 3. Validar estado operativo de la misión
    const estadosInvalidos = ["COMPLETADA", "CANCELADA", "RECHAZADA"];
    if (estadosInvalidos.includes(mision.estado)) {
      throw new ConflictError(
        `No es posible reportar llegada a terreno para una misión con estado ${mision.estado}.`
      );
    }

    // 4. Validar que no se haya reportado la llegada con anterioridad
    const hitoPrevio = await trx
      .selectFrom("mision_hito")
      .select("id")
      .where("mision_id", "=", misionId)
      .where("hito", "=", "LLEGADA_TERRENO")
      .executeTakeFirst();

    if (hitoPrevio) {
      throw new ConflictError("La llegada a terreno ya fue reportada previamente para esta misión.");
    }

    // 5. Insertar hito LLEGADA_TERRENO en mision_hito
    const glosaHito = input.observaciones
      ? `Llegada a terreno reportada. ${input.observaciones}`
      : "Llegada a terreno reportada por la brigada operativa.";

    const hitoInsertado = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: misionId,
        hito: "LLEGADA_TERRENO",
        descripcion: glosaHito,
        registrado_por_id: usuarioId,
        latitud: input.latitud,
        longitud: input.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${input.longitud}, ${input.latitud}), 4326)`,
        creado_en: sql`CURRENT_TIMESTAMP`,
      })
      .returning([
        "id",
        "mision_id",
        "hito",
        "descripcion",
        "latitud",
        "longitud",
        "registrado_por_id",
        "creado_en",
      ])
      .executeTakeFirstOrThrow();

    // 6. Transicionar misión a EN_CURSO y fijar fecha_inicio para cálculo de tiempos de respuesta
    const nuevoEstado =
      mision.estado === "PLANIFICADA" || mision.estado === "DESPACHADA"
        ? "EN_CURSO"
        : mision.estado;

    await trx
      .updateTable("mision")
      .set({
        estado: nuevoEstado,
        fecha_inicio: mision.fecha_inicio ?? sql`CURRENT_TIMESTAMP`,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", misionId)
      .execute();

    // 7. Actualizar última ubicación en personal para miembros de la cuadrilla y delegado
    const integrantesCuadrilla = await trx
      .selectFrom("cuadrilla_personal")
      .select("personal_id")
      .where("cuadrilla_id", "=", mision.cuadrilla_id)
      .execute();

    const personalIds = integrantesCuadrilla.map((i) => i.personal_id);

    let miembrosActualizados = 0;
    const updateResult = await trx
      .updateTable("personal")
      .set({
        ultima_ubicacion: sql`ST_SetSRID(ST_MakePoint(${input.longitud}, ${input.latitud}), 4326)`,
        ultima_actualizacion_ubicacion: sql`CURRENT_TIMESTAMP`,
      })
      .where((eb) => {
        const condiciones = [];
        if (personalIds.length > 0) {
          condiciones.push(eb("id", "in", personalIds));
        }
        if (mision.usuario_delegado_id) {
          condiciones.push(eb("usuario_id", "=", mision.usuario_delegado_id));
        }
        if (condiciones.length === 0) {
          return eb(sql`false`, "=", true);
        }
        return eb.or(condiciones);
      })
      .executeTakeFirst();

    miembrosActualizados = Number(updateResult.numUpdatedRows ?? 0);

    // 8. Consultar nombre del usuario para el payload
    const usuarioRegistrador = await trx
      .selectFrom("usuario")
      .select(["id", "nombre"])
      .where("id", "=", usuarioId)
      .executeTakeFirst();

    const fechaIso =
      hitoInsertado.creado_en instanceof Date
        ? hitoInsertado.creado_en.toISOString()
        : new Date(hitoInsertado.creado_en).toISOString();

    return {
      hito: {
        id: hitoInsertado.id,
        misionId: hitoInsertado.mision_id,
        codigoMision: mision.codigo,
        hito: "LLEGADA_TERRENO",
        descripcion: hitoInsertado.descripcion,
        latitud: Number(hitoInsertado.latitud),
        longitud: Number(hitoInsertado.longitud),
        registradoEn: fechaIso,
        registradoPor: {
          id: usuarioRegistrador?.id ?? usuarioId,
          nombre: usuarioRegistrador?.nombre ?? "Delegado de Cuadrilla",
        },
        estadoMision: nuevoEstado,
        miembrosActualizados,
      },
      mision: {
        id: mision.id,
        codigo: mision.codigo,
        estado: nuevoEstado,
        cuadrillaId: mision.cuadrilla_id,
      },
    };
  });
}

