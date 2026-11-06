import { db } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/modules/seguridad/errors";
import type { CrearMisionVerificacionInput } from "./mision.schema";

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

export interface MisionVerificacionCreadaResult {
  mision: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    tipoMision: "VERIFICACION" | "ATENCION_CUADRILLA" | "PREVENCION" | "RECUPERACION" | "ASISTENCIA_SOCIAL";
    estado: "PLANIFICADA" | "DESPACHADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" | "RECHAZADA";
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    incidenteId: string;
    patrullaId: string;
    encargadoId: string | null;
    fechaInicio: string | null;
    creadoEn: string;
  };
  incidente: {
    id: string;
    codigo: string;
    estado: string;
    prioridad: string;
  };
  patrulla: {
    id: string;
    nombre: string;
    estado: string;
    delegacionId: string | null;
    usuarioLiderId: string | null;
  };
  hitoInicial: {
    id: string;
    hito: string;
    descripcion: string;
    creadoEn: string;
  };
}

/**
 * HU-20 - Ejecuta la transacción atómica de asignación y despacho de patrulla verificadora.
 * 1. Verifica que el incidente exista y esté en estado 'REPORTADO'.
 * 2. Actualiza atómicamente la patrulla verificadora a 'EN_VERIFICACION' asegurando que esté 'DISPONIBLE'.
 * 3. Crea la misión con tipo 'VERIFICACION' y estado 'DESPACHADA'.
 * 4. Actualiza el estado del incidente a 'VERIFICANDO'.
 * 5. Registra el hito inicial 'DESPACHADA' en la bitácora de la misión ('mision_hito').
 */
export async function crearMisionVerificacionRepo(
  input: CrearMisionVerificacionInput,
  operadorId: string
): Promise<MisionVerificacionCreadaResult> {
  return await db.transaction().execute(async (trx) => {
    // 1. Validar existencia y estado del incidente
    const incidente = await trx
      .selectFrom("incidente")
      .select(["id", "codigo", "estado", "prioridad", "tipo_afectacion", "delegacion_id"])
      .where("id", "=", input.incidenteId)
      .executeTakeFirst();

    if (!incidente) {
      throw new NotFoundError(`Incidente con ID '${input.incidenteId}' no encontrado.`);
    }

    if (incidente.estado !== "REPORTADO") {
      throw new ConflictError(
        `El incidente se encuentra en estado '${incidente.estado}', por lo que no puede ser asignado a una patrulla verificadora. Solo se pueden verificar incidentes en estado 'REPORTADO'.`
      );
    }

    // 2. Bloqueo y actualización atómica de la patrulla verificadora
    const patrullaActualizada = await trx
      .updateTable("patrulla_verificadora")
      .set({
        estado: "EN_VERIFICACION",
        actualizado_en: new Date(),
      })
      .where("id", "=", input.patrullaId)
      .where("estado", "=", "DISPONIBLE")
      .where("eliminado_en", "is", null)
      .returning(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
      .executeTakeFirst();

    if (!patrullaActualizada) {
      // Diferenciar entre inexistencia y conflicto concurrente
      const patrullaExistente = await trx
        .selectFrom("patrulla_verificadora")
        .select(["id", "nombre", "estado", "eliminado_en"])
        .where("id", "=", input.patrullaId)
        .executeTakeFirst();

      if (!patrullaExistente || patrullaExistente.eliminado_en !== null) {
        throw new NotFoundError(
          `Patrulla verificadora con ID '${input.patrullaId}' no existe o ha sido desactivada.`
        );
      }

      throw new ConflictError(
        `La patrulla verificadora '${patrullaExistente.nombre}' ya no se encuentra en estado 'DISPONIBLE' (estado actual: '${patrullaExistente.estado}').`
      );
    }

    // 3. Generar código correlativo único para la misión
    const year = new Date().getFullYear();
    let codigo = "";
    let colision = true;
    while (colision) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      codigo = `MIS-${year}-${randomNum}`;
      const existe = await trx
        .selectFrom("mision")
        .select("id")
        .where("codigo", "=", codigo)
        .executeTakeFirst();
      if (!existe) {
        colision = false;
      }
    }

    // 4. Crear registro en la tabla mision
    const titulo = input.titulo?.trim() || `Verificación de Incidente ${incidente.codigo}`;
    const descripcion = input.descripcion?.trim() || null;
    const prioridad = (input.prioridad || incidente.prioridad || "MEDIA") as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    const fechaInicio = new Date();

    const nuevaMision = await trx
      .insertInto("mision")
      .values({
        codigo,
        titulo,
        descripcion,
        tipo_mision: "VERIFICACION",
        estado: "DESPACHADA",
        prioridad,
        incidente_id: input.incidenteId,
        patrulla_id: input.patrullaId,
        encargado_id: operadorId,
        creado_por_id: operadorId,
        fecha_inicio: fechaInicio,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 5. Actualizar incidente a VERIFICANDO
    const incidenteActualizado = await trx
      .updateTable("incidente")
      .set({
        estado: "VERIFICANDO",
        actualizado_en: new Date(),
      })
      .where("id", "=", input.incidenteId)
      .returning(["id", "codigo", "estado", "prioridad"])
      .executeTakeFirstOrThrow();

    // 6. Registrar hito inicial en mision_hito
    const hitoInicial = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: nuevaMision.id,
        hito: "DESPACHADA",
        descripcion: `Misión de verificación asignada y despachada a la patrulla ${patrullaActualizada.nombre}.`,
        registrado_por_id: operadorId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      mision: {
        id: nuevaMision.id,
        codigo: nuevaMision.codigo,
        titulo: nuevaMision.titulo,
        descripcion: nuevaMision.descripcion,
        tipoMision: nuevaMision.tipo_mision as MisionVerificacionCreadaResult["mision"]["tipoMision"],
        estado: nuevaMision.estado as MisionVerificacionCreadaResult["mision"]["estado"],
        prioridad: nuevaMision.prioridad as MisionVerificacionCreadaResult["mision"]["prioridad"],
        incidenteId: input.incidenteId,
        patrullaId: input.patrullaId,
        encargadoId: nuevaMision.encargado_id,
        fechaInicio: nuevaMision.fecha_inicio ? new Date(nuevaMision.fecha_inicio).toISOString() : null,
        creadoEn: new Date(nuevaMision.creado_en).toISOString(),
      },
      incidente: {
        id: incidenteActualizado.id,
        codigo: incidenteActualizado.codigo,
        estado: incidenteActualizado.estado,
        prioridad: incidenteActualizado.prioridad,
      },
      patrulla: {
        id: patrullaActualizada.id,
        nombre: patrullaActualizada.nombre,
        estado: patrullaActualizada.estado,
        delegacionId: patrullaActualizada.delegacion_id,
        usuarioLiderId: patrullaActualizada.usuario_lider_id,
      },
      hitoInicial: {
        id: hitoInicial.id,
        hito: hitoInicial.hito,
        descripcion: hitoInicial.descripcion,
        creadoEn: new Date(hitoInicial.creado_en).toISOString(),
      },
    };
  });
}

