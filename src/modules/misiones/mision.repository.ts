import { db } from "@/lib/db";
import { sql, type Transaction } from "kysely";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";
import type { Database } from "@/lib/db/types";
import type { ReportarLlegadaBody } from "./mision-llegada.schema";
import type {
  CrearMisionVerificacionInput,
  AsignarCuadrillaMisionInput,
  AceptarMisionInput,
} from "./mision.schema";
import { crearNotificacionMisionRepo } from "./notificacion-mision.repository";
import type { NotificacionMisionDetalle } from "./notificacion-mision.schema";

export type MisionTrx = Transaction<Database>;

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
    trazabilidad_notificacion?: string | null;
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
  hitos?: Array<{
    id: string;
    mision_id: string;
    hito: string;
    descripcion: string;
    registrado_por_id: string | null;
    latitud: number | string | null;
    longitud: number | string | null;
    creado_en: Date | string;
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
      sql<string | null>`(
        SELECT nm.estado
        FROM notificaciones_mision nm
        WHERE nm.mision_id = mision.id
        ORDER BY nm.creada_at DESC
        LIMIT 1
      )`.as("trazabilidad_notificacion"),
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

  // Consultar bitácora cronológica de hitos operacionales
  const hitosFilas = await db
    .selectFrom("mision_hito")
    .select([
      "id",
      "mision_id",
      "hito",
      "descripcion",
      "registrado_por_id",
      "latitud",
      "longitud",
      "creado_en",
    ])
    .where("mision_id", "=", id)
    .orderBy("creado_en", "asc")
    .execute();

  return {
    mision,
    recursosCuadrilla,
    reportesTerreno,
    hitos: hitosFilas,
  };
}

export interface ReportarLlegadaResultado {
  hito: {
    id: string;
    hitoId: string;
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
    folio?: string | null;
    tipoAfectacion?: string | null;
    direccion?: string | null;
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
  notificacion: NotificacionMisionDetalle;
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
    // 1. Validar existencia y estado del incidente con bloqueo pesimista (FOR UPDATE)
    const incidente = await trx
      .selectFrom("incidente")
      .select([
        "id",
        "codigo",
        "folio",
        "estado",
        "prioridad",
        "tipo_afectacion",
        "direccion_texto",
        "delegacion_id",
      ])
      .where("id", "=", input.incidenteId)
      .forUpdate()
      .executeTakeFirst();

    if (!incidente) {
      throw new NotFoundError(`Incidente con ID '${input.incidenteId}' no encontrado.`);
    }

    if (incidente.estado !== "REPORTADO") {
      throw new ConflictError(
        `El incidente se encuentra en estado '${incidente.estado}', por lo que no puede ser asignado a una patrulla verificadora. Solo se pueden verificar incidentes en estado 'REPORTADO'.`
      );
    }

    // Validar que no posea ya una misión activa en curso o pendiente de confirmación
    const misionActiva = await trx
      .selectFrom("mision")
      .select(["id", "codigo", "estado"])
      .where("incidente_id", "=", input.incidenteId)
      .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
      .executeTakeFirst();

    if (misionActiva) {
      throw new ConflictError(
        `El incidente ya posee una misión activa (${misionActiva.codigo} en estado '${misionActiva.estado}').`
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

    // 3. Generar código correlativo único secuencial protegido contra colisiones concurrentes (advisory lock)
    await sql`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.execute(trx);

    const year = new Date().getFullYear();
    const prefijo = `MIS-${year}-`;

    const ultimaMision = await trx
      .selectFrom("mision")
      .select("codigo")
      .where("codigo", "like", `${prefijo}%`)
      .orderBy("codigo", "desc")
      .limit(1)
      .executeTakeFirst();

    let correlativo = 1;
    if (ultimaMision?.codigo) {
      const partes = ultimaMision.codigo.split("-");
      const num = parseInt(partes[2] || "0", 10);
      if (!isNaN(num) && num >= 1) {
        correlativo = num + 1;
      }
    }
    const codigo = `${prefijo}${String(correlativo).padStart(4, "0")}`;

    // 4. Crear registro en la tabla mision (fecha_inicio en null para estado DESPACHADA)
    const titulo = input.titulo?.trim() || `Verificación de Incidente ${incidente.codigo}`;
    const descripcion = input.descripcion?.trim() || null;
    const prioridad = (input.prioridad || incidente.prioridad || "MEDIA") as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

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
        fecha_inicio: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 5. Actualizar incidente a VERIFICANDO validando que se mantenga en REPORTADO
    const incidenteActualizado = await trx
      .updateTable("incidente")
      .set({
        estado: "VERIFICANDO",
        actualizado_en: new Date(),
      })
      .where("id", "=", input.incidenteId)
      .where("estado", "=", "REPORTADO")
      .returning(["id", "codigo", "estado", "prioridad"])
      .executeTakeFirst();

    if (!incidenteActualizado) {
      throw new ConflictError(
        `El incidente con ID '${input.incidenteId}' ya no se encuentra en estado 'REPORTADO' (fue modificado concurrentemente).`
      );
    }

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

    // 7. Crear registro inicial de notificación en estado PENDIENTE_ENVIO
    const notificacionInicial = await crearNotificacionMisionRepo(
      nuevaMision.id,
      input.patrullaId,
      trx
    );

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
        folio: incidente.folio ?? null,
        tipoAfectacion: incidente.tipo_afectacion ?? null,
        direccion: incidente.direccion_texto ?? null,
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
      notificacion: notificacionInicial,
    };
  });
}

// ========================================================
// HU-21: Asignar Cuadrilla a Incidente y Liberar Patrulla
// ========================================================

export interface AsignarCuadrillaResult {
  mision: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    tipoMision: "ATENCION_CUADRILLA";
    estado: "DESPACHADA";
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    incidenteId: string;
    cuadrillaId: string;
    encargadoId: string | null;
    creadoPorId: string;
    fechaInicio: string | null;
    creadoEn: string;
  };
  cuadrilla: {
    id: string;
    nombre: string;
    estado: "EN_MISION";
    delegacionId?: string | null;
  };
  incidente: {
    id: string;
    codigo: string;
    estado: "EN_ATENCION";
    prioridad: string;
  };
  patrullaLiberada: {
    id: string;
    nombre: string;
    estado: "DISPONIBLE";
    misionPreviaId?: string | null;
  } | null;
  hitoCuadrilla: {
    id: string;
    misionId: string;
    hito: string;
    descripcion: string;
    creadoEn: string;
  };
  hitoPatrulla: {
    id: string;
    misionId: string;
    hito: string;
    descripcion: string;
    creadoEn: string;
  } | null;
}

/**
 * Sincroniza la disponibilidad operativa de la dotación humana de una cuadrilla.
 *
 * Cuando una cuadrilla es despachada a terreno, su dotación (integrantes activos de
 * `cuadrilla_personal` y el delegado de la cuadrilla) debe quedar en estado 'en_mision',
 * que es el atributo que consume la vista de personal del SGRAI
 * (`usuario.estado_operativo`, única fuente de verdad desde la migración 025).
 *
 * Reglas:
 * - Solo se actualizan usuarios activos.
 * - No se sobrescriben estados no operativos ('licencia', 'descanso', 'inactivo').
 * - No se altera `personal.disponible_terreno` (aptitud para terreno, no disponibilidad).
 */
export async function marcarDotacionCuadrillaEnMision(
  trx: MisionTrx,
  cuadrillaId: string,
  usuarioDelegadoId: string | null
): Promise<void> {
  // 1. Integrantes activos de la cuadrilla
  await trx
    .updateTable("usuario")
    .set({
      estado_operativo: "en_mision",
      actualizado_en: sql`CURRENT_TIMESTAMP`,
    })
    .where("activo", "=", true)
    .where("estado_operativo", "in", ["disponible", "en_mision"])
    .where(
      "id",
      "in",
      trx
        .selectFrom("cuadrilla_personal")
        .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
        .select("personal.usuario_id")
        .where("cuadrilla_personal.cuadrilla_id", "=", cuadrillaId)
        .where("cuadrilla_personal.activo", "=", true)
        .where("cuadrilla_personal.desvinculado_en", "is", null)
    )
    .execute();

  // 2. Delegado de la cuadrilla (puede no estar registrado en cuadrilla_personal)
  if (usuarioDelegadoId) {
    await trx
      .updateTable("usuario")
      .set({
        estado_operativo: "en_mision",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", usuarioDelegadoId)
      .where("activo", "=", true)
      .where("estado_operativo", "in", ["disponible", "en_mision"])
      .execute();
  }
}

export async function asignarCuadrillaIncidenteRepo(
  input: AsignarCuadrillaMisionInput,
  usuarioId: string
): Promise<AsignarCuadrillaResult> {
  return await db.transaction().execute(async (trx) => {
    // 1. Bloqueo pesimista en lecturas iniciales (BUG-H21-API-01)
    const incidente = await trx
      .selectFrom("incidente")
      .select(["id", "codigo", "estado", "prioridad", "delegacion_id", "tipo_afectacion"])
      .where("id", "=", input.incidenteId)
      .forUpdate()
      .executeTakeFirst();

    if (!incidente) {
      throw new NotFoundError("No se encontró ningún incidente con el identificador proporcionado.");
    }

    if (incidente.estado !== "REPORTADO" && incidente.estado !== "VERIFICANDO") {
      throw new ConflictError(
        `El incidente no puede ser asignado a cuadrilla porque su estado actual es '${incidente.estado}'. Solo se pueden despachar cuadrillas a incidentes en estado 'REPORTADO' o 'VERIFICANDO'.`
      );
    }

    // 2. Bloqueo pesimista y validación de cuadrilla activa (BUG-H21-API-01, BUG-H21-API-02)
    const cuadrilla = await trx
      .selectFrom("cuadrilla")
      .select(["id", "nombre", "estado", "delegacion_id", "usuario_delegado_id"])
      .where("id", "=", input.cuadrillaId)
      .where("eliminado_en", "is", null)
      .where("activo", "=", true)
      .forUpdate()
      .executeTakeFirst();

    if (!cuadrilla) {
      throw new NotFoundError("No se encontró ninguna cuadrilla con el identificador proporcionado.");
    }

    if (cuadrilla.estado !== "DISPONIBLE") {
      throw new ConflictError(
        `La cuadrilla '${cuadrilla.nombre}' no está disponible para asignación (estado actual: '${cuadrilla.estado}'). Solo cuadrillas en estado 'DISPONIBLE' pueden ser despachadas.`
      );
    }

    // 3. Buscar si el incidente tiene una misión de verificación activa y patrulla asignada
    const misionVerificacionActiva = await trx
      .selectFrom("mision")
      .innerJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
      .select([
        "mision.id as mision_id",
        "mision.codigo as mision_codigo",
        "mision.estado as mision_estado",
        "mision.prioridad as mision_prioridad",
        "patrulla_verificadora.id as patrulla_id",
        "patrulla_verificadora.nombre as patrulla_nombre",
        "patrulla_verificadora.estado as patrulla_estado",
      ])
      .where("mision.incidente_id", "=", input.incidenteId)
      .where("mision.tipo_mision", "=", "VERIFICACION")
      .where("mision.estado", "in", ["DESPACHADA", "EN_CURSO", "COMPLETADA"])
      .orderBy("mision.creado_en", "desc")
      .executeTakeFirst();

    // 3.1. Validación previa: Si está VERIFICANDO y hay patrulla asignada, debe existir reporte técnico de terreno
    if (misionVerificacionActiva && incidente.estado === "VERIFICANDO") {
      const reporteTerreno = await trx
        .selectFrom("reporte_terreno")
        .select("id")
        .where("mision_id", "=", misionVerificacionActiva.mision_id)
        .executeTakeFirst();

      const hitoEvaluacion = await trx
        .selectFrom("mision_hito")
        .select("id")
        .where("mision_id", "=", misionVerificacionActiva.mision_id)
        .where("hito", "in", [
          "EVALUACION_COMPLETADA",
          "REPORTE_EMITIDO",
          "VERIFICACION_COMPLETADA",
          "EVALUACION_FINALIZADA",
          "REPORTE_TERRENO_REGISTRADO",
        ])
        .executeTakeFirst();

      if (!reporteTerreno && !hitoEvaluacion) {
        throw new ConflictError(
          `No es posible despachar una cuadrilla operativa: la patrulla verificadora asignada ('${misionVerificacionActiva.patrulla_nombre}') aún no ha finalizado la evaluación técnica en terreno.`,
          "VERIFICACION_EN_CURSO",
          {
            incidenteId: input.incidenteId,
            misionVerificacionId: misionVerificacionActiva.mision_id,
            patrullaId: misionVerificacionActiva.patrulla_id,
            patrullaNombre: misionVerificacionActiva.patrulla_nombre,
            estadoMision: misionVerificacionActiva.mision_estado,
          }
        );
      }
    }

    // 4. Determinar prioridad: heredar de misión de verificación activa o incidente
    const prioridadFinal = (
      input.prioridad ??
      misionVerificacionActiva?.mision_prioridad ??
      incidente.prioridad ??
      "MEDIA"
    ) as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

    // 5. Generar código correlativo de misión protegido contra colisiones concurrentes (advisory lock) (BUG-H21-API-01)
    await sql`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.execute(trx);

    const year = new Date().getFullYear();
    const prefijo = `MIS-${year}-`;

    const ultimaMision = await trx
      .selectFrom("mision")
      .select("codigo")
      .where("codigo", "like", `${prefijo}%`)
      .orderBy("codigo", "desc")
      .limit(1)
      .executeTakeFirst();

    let correlativo = 1;
    if (ultimaMision?.codigo) {
      const partes = ultimaMision.codigo.split("-");
      const num = parseInt(partes[2] || "0", 10);
      if (!isNaN(num) && num >= 1) {
        correlativo = num + 1;
      }
    }
    const nuevoCodigo = `${prefijo}${String(correlativo).padStart(4, "0")}`;
    const tituloFinal = input.titulo?.trim() || `Atención táctica - Incidente ${incidente.codigo}`;

    // 6. Crear misión para la cuadrilla (DESPACHADA, fecha_inicio = null)
    const nuevaMision = await trx
      .insertInto("mision")
      .values({
        codigo: nuevoCodigo,
        titulo: tituloFinal,
        descripcion: input.descripcion?.trim() || null,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "DESPACHADA",
        prioridad: prioridadFinal,
        incidente_id: input.incidenteId,
        cuadrilla_id: input.cuadrillaId,
        encargado_id: usuarioId,
        creado_por_id: usuarioId,
        fecha_inicio: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 7. Transición atómica de cuadrilla a 'EN_MISION' con precondición de estado (BUG-H21-API-01)
    const cuadrillaActualizada = await trx
      .updateTable("cuadrilla")
      .set({
        estado: "EN_MISION",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
        actualizado_por_id: usuarioId,
      })
      .where("id", "=", input.cuadrillaId)
      .where("estado", "=", "DISPONIBLE")
      .returning("id")
      .executeTakeFirst();

    if (!cuadrillaActualizada) {
      throw new ConflictError(
        `La cuadrilla '${cuadrilla.nombre}' ya fue asignada concurrentemente a otra misión.`
      );
    }

    // 7.1. Sincronizar la disponibilidad de la dotación humana de la cuadrilla ('en_mision')
    await marcarDotacionCuadrillaEnMision(
      trx,
      input.cuadrillaId,
      cuadrilla.usuario_delegado_id
    );

    // 8. Transición atómica de incidente a 'EN_ATENCION' con precondición de estado (BUG-H21-API-01)
    const incidenteActualizado = await trx
      .updateTable("incidente")
      .set({
        estado: "EN_ATENCION",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", input.incidenteId)
      .where("estado", "in", ["REPORTADO", "VERIFICANDO"])
      .returning(["id", "codigo", "estado", "prioridad"])
      .executeTakeFirst();

    if (!incidenteActualizado) {
      throw new ConflictError(`El incidente ya fue actualizado concurrentemente a otro estado.`);
    }

    // 9. Registrar hito en mision_hito para la nueva misión de cuadrilla
    const hitoCuadrillaRow = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: nuevaMision.id,
        hito: "CUADRILLA_DESPACHADA",
        descripcion: "Cuadrilla despachada a terreno para resolución táctica del incidente",
        registrado_por_id: usuarioId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 10. Regla §3.2 ICS: Liberar patrulla verificadora y completar su misión si existía (BUG-H21-API-03)
    let patrullaLiberada: AsignarCuadrillaResult["patrullaLiberada"] = null;
    let hitoPatrulla: AsignarCuadrillaResult["hitoPatrulla"] = null;

    if (misionVerificacionActiva) {
      // a) Solo cerrar la misión de verificación previa e insertar hito si NO estaba ya COMPLETADA
      if (misionVerificacionActiva.mision_estado !== "COMPLETADA") {
        await trx
          .updateTable("mision")
          .set({
            estado: "COMPLETADA",
            fecha_cierre: sql`CURRENT_TIMESTAMP`,
            actualizado_en: sql`CURRENT_TIMESTAMP`,
          })
          .where("id", "=", misionVerificacionActiva.mision_id)
          .execute();

        const hitoPatrullaRow = await trx
          .insertInto("mision_hito")
          .values({
            mision_id: misionVerificacionActiva.mision_id,
            hito: "VERIFICACION_FINALIZADA",
            descripcion:
              "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
            registrado_por_id: usuarioId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        hitoPatrulla = {
          id: hitoPatrullaRow.id,
          misionId: hitoPatrullaRow.mision_id,
          hito: hitoPatrullaRow.hito,
          descripcion: hitoPatrullaRow.descripcion,
          creadoEn: new Date(hitoPatrullaRow.creado_en).toISOString(),
        };
      }

      // b) Verificar si la patrulla tiene otra misión activa (DESPACHADA o EN_CURSO) en otro incidente
      const otraMisionActiva = await trx
        .selectFrom("mision")
        .select("id")
        .where("patrulla_id", "=", misionVerificacionActiva.patrulla_id)
        .where("id", "!=", misionVerificacionActiva.mision_id)
        .where("estado", "in", ["DESPACHADA", "EN_CURSO"])
        .executeTakeFirst();

      // c) Liberar patrulla verificadora solo si no tiene otra misión activa y no está NO_DISPONIBLE
      if (!otraMisionActiva && misionVerificacionActiva.patrulla_estado !== "NO_DISPONIBLE") {
        await trx
          .updateTable("patrulla_verificadora")
          .set({
            estado: "DISPONIBLE",
            actualizado_en: sql`CURRENT_TIMESTAMP`,
          })
          .where("id", "=", misionVerificacionActiva.patrulla_id)
          .execute();

        patrullaLiberada = {
          id: misionVerificacionActiva.patrulla_id,
          nombre: misionVerificacionActiva.patrulla_nombre,
          estado: "DISPONIBLE",
          misionPreviaId: misionVerificacionActiva.mision_id,
        };
      }
    }

    return {
      mision: {
        id: nuevaMision.id,
        codigo: nuevaMision.codigo,
        titulo: nuevaMision.titulo,
        descripcion: nuevaMision.descripcion,
        tipoMision: "ATENCION_CUADRILLA",
        estado: "DESPACHADA",
        prioridad: nuevaMision.prioridad as "BAJA" | "MEDIA" | "ALTA" | "CRITICA",
        incidenteId: input.incidenteId,
        cuadrillaId: input.cuadrillaId,
        encargadoId: nuevaMision.encargado_id,
        creadoPorId: nuevaMision.creado_por_id,
        fechaInicio: nuevaMision.fecha_inicio ? new Date(nuevaMision.fecha_inicio).toISOString() : null,
        creadoEn: new Date(nuevaMision.creado_en).toISOString(),
      },
      cuadrilla: {
        id: cuadrilla.id,
        nombre: cuadrilla.nombre,
        estado: "EN_MISION",
        delegacionId: cuadrilla.delegacion_id,
      },
      incidente: {
        id: incidenteActualizado.id,
        codigo: incidenteActualizado.codigo,
        estado: "EN_ATENCION",
        prioridad: incidenteActualizado.prioridad,
      },
      patrullaLiberada,
      hitoCuadrilla: {
        id: hitoCuadrillaRow.id,
        misionId: hitoCuadrillaRow.mision_id,
        hito: hitoCuadrillaRow.hito,
        descripcion: hitoCuadrillaRow.descripcion,
        creadoEn: new Date(hitoCuadrillaRow.creado_en).toISOString(),
      },
      hitoPatrulla,
    };
  });
}

export interface AceptarMisionPatrullaResult {
  mision: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    tipoMision: "VERIFICACION" | "ATENCION_CUADRILLA" | "PREVENCION" | "RECUPERACION" | "ASISTENCIA_SOCIAL";
    estado: "PLANIFICADA" | "DESPACHADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" | "RECHAZADA";
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    incidenteId: string | null;
    patrullaId: string | null;
    cuadrillaId?: string | null;
    fechaInicio: string;
    actualizadoEn: string;
  };
  cuadrilla?: {
    id: string;
    nombre: string;
    estado: string;
    delegacionId?: string | null;
    usuarioDelegadoId?: string | null;
  } | null;
  patrulla: {
    id: string;
    nombre: string;
    estado: string;
  } | null;
  incidente: {
    id: string;
    codigo: string;
    estado: string;
    prioridad?: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  } | null;
  hito: {
    id: string;
    misionId: string;
    hito: string;
    descripcion: string;
    registradoPorId: string | null;
    latitud: number | null;
    longitud: number | null;
    creadoEn: string;
  };
}

export type AceptarMisionResult = AceptarMisionPatrullaResult;

export interface OpcionesPermisoAceptarMision {
  puedeEjecutarCuadrilla?: boolean;
  puedeVerificarPatrulla?: boolean;
}

/**
 * HU-36 / HU-40 - Ejecuta la transición atómica cuando una patrulla verificadora (HU-36)
 * o un delegado de cuadrilla (HU-40) confirma y acepta la misión asignada desde la PWA:
 * 1. Verifica con bloqueo pesimista (`FOR UPDATE OF mision`) que la misión exista y el usuario esté autorizado.
 * 2. Para Cuadrilla (`ATENCION_CUADRILLA` / `cuadrilla_id !== null`):
 *    - Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO` y fija `fecha_inicio = CURRENT_TIMESTAMP`.
 *    - Actualiza `cuadrilla.estado = 'EN_MISION'` y sincroniza dotación humana (`usuario.estado_operativo = 'en_mision'`).
 *    - Actualiza `incidente.estado = 'EN_ATENCION'`.
 *    - Registra el hito `'MISION_ACEPTADA'` (`'Asignación Aceptada por Cuadrilla'`) en `mision_hito`.
 * 3. Para Patrulla Verificadora (`VERIFICACION` / `patrulla_id !== null`):
 *    - Mantiene las invariantes ICS de HU-36 (`patrulla = EN_VERIFICACION`, `incidente = VERIFICANDO`,
 *      hito `'Misión Aceptada por Patrulla'`).
 */
export async function aceptarMisionPatrullaRepo(
  misionId: string,
  usuarioId: string,
  esAdmin: boolean,
  input?: AceptarMisionInput,
  opcionesPermiso?: OpcionesPermisoAceptarMision
): Promise<AceptarMisionPatrullaResult> {
  return await db.transaction().execute(async (trx) => {
    // 1. Consultar la misión con bloqueo pesimista (FOR UPDATE OF mision) junto a cuadrilla, patrulla e incidente asociado
    const misionExistente = await trx
      .selectFrom("mision")
      .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
      .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
      .leftJoin("incidente", "incidente.id", "mision.incidente_id")
      .select([
        "mision.id",
        "mision.codigo",
        "mision.estado",
        "mision.tipo_mision",
        "mision.prioridad",
        "mision.cuadrilla_id",
        "mision.patrulla_id",
        "mision.incidente_id",
        "cuadrilla.nombre as cuadrilla_nombre",
        "cuadrilla.estado as cuadrilla_estado",
        "cuadrilla.activo as cuadrilla_activo",
        "cuadrilla.eliminado_en as cuadrilla_eliminado_en",
        "cuadrilla.delegacion_id as cuadrilla_delegacion_id",
        "cuadrilla.usuario_delegado_id as cuadrilla_delegado_id",
        "patrulla_verificadora.nombre as patrulla_nombre",
        "patrulla_verificadora.estado as patrulla_estado",
        "patrulla_verificadora.eliminado_en as patrulla_eliminado_en",
        "patrulla_verificadora.usuario_lider_id as patrulla_lider_id",
        "incidente.codigo as incidente_codigo",
        "incidente.estado as incidente_estado",
        "incidente.prioridad as incidente_prioridad",
      ])
      .where("mision.id", "=", misionId)
      .forUpdate("mision")
      .executeTakeFirst();

    if (!misionExistente) {
      throw new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.");
    }

    const esMisionCuadrilla =
      misionExistente.tipo_mision === "ATENCION_CUADRILLA" ||
      Boolean(misionExistente.cuadrilla_id);

    if (esMisionCuadrilla) {
      // =====================================================
      // FLUJO HU-40: Aceptación de Asignación por Cuadrilla
      // =====================================================
      if (!misionExistente.cuadrilla_id) {
        throw new ConflictError(
          "La misión indicada no tiene una cuadrilla operativa asignada."
        );
      }

      if (!esAdmin && opcionesPermiso && opcionesPermiso.puedeEjecutarCuadrilla === false) {
        throw new ForbiddenError("No cuenta con el permiso requerido: misiones:terreno:ejecutar");
      }

      // Validar pertenencia del usuario a la cuadrilla asignada, salvo Administrador (patrón HU-41)
      if (!esAdmin) {
        const esDelegadoDirecto = misionExistente.cuadrilla_delegado_id === usuarioId;
        if (!esDelegadoDirecto) {
          const integrante = await trx
            .selectFrom("cuadrilla_personal")
            .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
            .select("cuadrilla_personal.id")
            .where("cuadrilla_personal.cuadrilla_id", "=", misionExistente.cuadrilla_id)
            .where("cuadrilla_personal.activo", "=", true)
            .where("cuadrilla_personal.desvinculado_en", "is", null)
            .where("personal.usuario_id", "=", usuarioId)
            .executeTakeFirst();

          if (!integrante) {
            throw new ForbiddenError(
              "No está autorizado para aceptar una misión asignada a otra cuadrilla operativa."
            );
          }
        }
      }

      // Validar invariantes ICS de cuadrilla activa e incidente no terminado
      if (
        (misionExistente.cuadrilla_eliminado_en !== undefined &&
          misionExistente.cuadrilla_eliminado_en !== null) ||
        misionExistente.cuadrilla_activo === false
      ) {
        throw new ConflictError(
          "La cuadrilla operativa asignada a la misión ha sido desactivada o dada de baja."
        );
      }

      if (misionExistente.cuadrilla_estado === "NO_DISPONIBLE") {
        throw new ConflictError(
          "La cuadrilla operativa asignada se encuentra en estado 'NO_DISPONIBLE'."
        );
      }

      if (
        misionExistente.incidente_id &&
        misionExistente.incidente_estado !== undefined &&
        misionExistente.incidente_estado !== null &&
        !["REPORTADO", "VERIFICANDO", "EN_ATENCION"].includes(misionExistente.incidente_estado)
      ) {
        throw new ConflictError(
          `El incidente asociado no se encuentra en un estado válido para atención (estado actual: '${misionExistente.incidente_estado}').`
        );
      }

      // (1) Actualizar mision.estado de DESPACHADA a EN_CURSO fijando fecha_inicio = CURRENT_TIMESTAMP
      const misionActualizada = await trx
        .updateTable("mision")
        .set({
          estado: "EN_CURSO",
          fecha_inicio: sql`CURRENT_TIMESTAMP`,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", misionId)
        .where("estado", "=", "DESPACHADA")
        .returningAll()
        .executeTakeFirst();

      if (!misionActualizada) {
        const misionReciente = await trx
          .selectFrom("mision")
          .select("estado")
          .where("id", "=", misionId)
          .executeTakeFirst();

        const estadoActual = misionReciente?.estado ?? misionExistente.estado;
        throw new ConflictError(
          `La misión no puede ser aceptada porque su estado actual es '${estadoActual}'. Solo se pueden aceptar misiones en estado 'DESPACHADA'.`
        );
      }

      // (2) Actualizar cuadrilla.estado = 'EN_MISION' y sincronizar dotación humana
      const cuadrillaActualizada = await trx
        .updateTable("cuadrilla")
        .set({
          estado: "EN_MISION",
          actualizado_en: sql`CURRENT_TIMESTAMP`,
          actualizado_por_id: usuarioId,
        })
        .where("id", "=", misionExistente.cuadrilla_id)
        .where("activo", "=", true)
        .where("eliminado_en", "is", null)
        .returning([
          "id",
          "nombre",
          "estado",
          "delegacion_id",
          "usuario_delegado_id",
        ])
        .executeTakeFirst();

      const cuadrillaNombreFinal =
        cuadrillaActualizada?.nombre ?? misionExistente.cuadrilla_nombre ?? "Cuadrilla Operativa";
      const cuadrillaDelegacionFinal =
        cuadrillaActualizada?.delegacion_id ?? misionExistente.cuadrilla_delegacion_id ?? null;
      const cuadrillaDelegadoFinal =
        cuadrillaActualizada?.usuario_delegado_id ?? misionExistente.cuadrilla_delegado_id ?? null;

      await marcarDotacionCuadrillaEnMision(
        trx,
        misionExistente.cuadrilla_id,
        cuadrillaDelegadoFinal
      );

      // (3) Actualizar incidente.estado = 'EN_ATENCION'
      let incidenteResultado: AceptarMisionPatrullaResult["incidente"] = null;
      if (misionExistente.incidente_id) {
        const incidenteActualizado = await trx
          .updateTable("incidente")
          .set({
            estado: "EN_ATENCION",
            actualizado_en: sql`CURRENT_TIMESTAMP`,
          })
          .where("id", "=", misionExistente.incidente_id)
          .where("estado", "in", ["REPORTADO", "VERIFICANDO", "EN_ATENCION"])
          .returning(["id", "codigo", "estado", "prioridad"])
          .executeTakeFirst();

        if (!incidenteActualizado) {
          throw new ConflictError(
            "El incidente asociado fue modificado concurrentemente a un estado terminal y no puede pasar a 'EN_ATENCION'."
          );
        }

        incidenteResultado = {
          id: incidenteActualizado.id,
          codigo: incidenteActualizado.codigo,
          estado: incidenteActualizado.estado,
          prioridad: (incidenteActualizado.prioridad ??
            misionExistente.incidente_prioridad ??
            misionActualizada.prioridad ??
            "MEDIA") as "BAJA" | "MEDIA" | "ALTA" | "CRITICA",
        };
      }

      // (4) Registrar hito 'Asignación Aceptada por Cuadrilla' en mision_hito
      const hitoRegistrado = await trx
        .insertInto("mision_hito")
        .values({
          mision_id: misionId,
          hito: "MISION_ACEPTADA",
          descripcion: "Asignación Aceptada por Cuadrilla",
          registrado_por_id: usuarioId,
          latitud: input?.latitud ?? null,
          longitud: input?.longitud ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const fechaInicioIso = misionActualizada.fecha_inicio
        ? new Date(misionActualizada.fecha_inicio).toISOString()
        : new Date().toISOString();
      const actualizadoEnIso = misionActualizada.actualizado_en
        ? new Date(misionActualizada.actualizado_en).toISOString()
        : new Date().toISOString();
      const hitoCreadoEnIso = hitoRegistrado.creado_en
        ? new Date(hitoRegistrado.creado_en).toISOString()
        : new Date().toISOString();

      return {
        mision: {
          id: misionActualizada.id,
          codigo: misionActualizada.codigo,
          titulo: misionActualizada.titulo,
          descripcion: misionActualizada.descripcion,
          tipoMision: misionActualizada.tipo_mision as AceptarMisionPatrullaResult["mision"]["tipoMision"],
          estado: misionActualizada.estado as AceptarMisionPatrullaResult["mision"]["estado"],
          prioridad: misionActualizada.prioridad as AceptarMisionPatrullaResult["mision"]["prioridad"],
          incidenteId: misionActualizada.incidente_id,
          patrullaId: misionActualizada.patrulla_id,
          cuadrillaId: misionActualizada.cuadrilla_id ?? misionExistente.cuadrilla_id,
          fechaInicio: fechaInicioIso,
          actualizadoEn: actualizadoEnIso,
        },
        cuadrilla: {
          id: misionExistente.cuadrilla_id,
          nombre: cuadrillaNombreFinal,
          estado: cuadrillaActualizada?.estado ?? "EN_MISION",
          delegacionId: cuadrillaDelegacionFinal,
          usuarioDelegadoId: cuadrillaDelegadoFinal,
        },
        patrulla: null,
        incidente: incidenteResultado,
        hito: {
          id: hitoRegistrado.id,
          misionId: hitoRegistrado.mision_id,
          hito: hitoRegistrado.hito,
          descripcion: hitoRegistrado.descripcion,
          registradoPorId: hitoRegistrado.registrado_por_id,
          latitud: hitoRegistrado.latitud !== null ? Number(hitoRegistrado.latitud) : null,
          longitud: hitoRegistrado.longitud !== null ? Number(hitoRegistrado.longitud) : null,
          creadoEn: hitoCreadoEnIso,
        },
      };
    }

    // =====================================================
    // FLUJO HU-36: Aceptación de Misión por Patrulla Verificadora
    // =====================================================
    if (!esAdmin && opcionesPermiso && opcionesPermiso.puedeVerificarPatrulla === false) {
      throw new ForbiddenError("No cuenta con el permiso requerido: misiones:terreno:verificar");
    }

    // 2. Validar explícitamente que la misión tenga una patrulla verificadora asignada (BUG-H36-API-01)
    if (!misionExistente.patrulla_id) {
      throw new ConflictError(
        "La misión indicada no tiene una patrulla verificadora asignada."
      );
    }

    // 3. Validar pertenencia del operador a la patrulla verificadora asignada, salvo Administrador (BUG-H36-API-01)
    if (!esAdmin) {
      const esLiderDirecto = misionExistente.patrulla_lider_id === usuarioId;
      if (!esLiderDirecto) {
        const integrante = await trx
          .selectFrom("patrulla_personal")
          .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
          .select("patrulla_personal.id")
          .where("patrulla_personal.patrulla_id", "=", misionExistente.patrulla_id)
          .where("personal.usuario_id", "=", usuarioId)
          .executeTakeFirst();

        if (!integrante) {
          throw new ForbiddenError(
            "No está autorizado para aceptar una misión asignada a otra patrulla verificadora."
          );
        }
      }
    }

    // 4. Validar invariantes ICS sobre el estado activo de la patrulla (EN_VERIFICACION) y del incidente (VERIFICANDO) (BUG-H36-API-04)
    if (
      misionExistente.patrulla_eliminado_en !== undefined &&
      misionExistente.patrulla_eliminado_en !== null
    ) {
      throw new ConflictError(
        "La patrulla verificadora asignada a la misión ha sido desactivada o dada de baja."
      );
    }

    if (
      misionExistente.patrulla_estado !== undefined &&
      misionExistente.patrulla_estado !== null &&
      misionExistente.patrulla_estado !== "EN_VERIFICACION"
    ) {
      throw new ConflictError(
        `La patrulla verificadora asignada no se encuentra en estado 'EN_VERIFICACION' (estado actual: '${misionExistente.patrulla_estado}').`
      );
    }

    if (
      misionExistente.incidente_id &&
      misionExistente.incidente_estado !== undefined &&
      misionExistente.incidente_estado !== null &&
      misionExistente.incidente_estado !== "VERIFICANDO"
    ) {
      throw new ConflictError(
        `El incidente asociado no se encuentra en estado 'VERIFICANDO' (estado actual: '${misionExistente.incidente_estado}').`
      );
    }

    // 5. Transición atómica con control de concurrencia condicional (estado = 'DESPACHADA')
    const misionActualizada = await trx
      .updateTable("mision")
      .set({
        estado: "EN_CURSO",
        fecha_inicio: sql`CURRENT_TIMESTAMP`,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", misionId)
      .where("estado", "=", "DESPACHADA")
      .returningAll()
      .executeTakeFirst();

    if (!misionActualizada) {
      const misionReciente = await trx
        .selectFrom("mision")
        .select("estado")
        .where("id", "=", misionId)
        .executeTakeFirst();

      const estadoActual = misionReciente?.estado ?? misionExistente.estado;
      throw new ConflictError(
        `La misión no puede ser aceptada porque su estado actual es '${estadoActual}'. Solo se pueden aceptar misiones en estado 'DESPACHADA'.`
      );
    }

    // 6. Registrar el hito automático en mision_hito vinculando al usuario en sesión
    const hitoRegistrado = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: misionId,
        hito: "MISION_ACEPTADA",
        descripcion: "Misión Aceptada por Patrulla",
        registrado_por_id: usuarioId,
        latitud: input?.latitud ?? null,
        longitud: input?.longitud ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const fechaInicioIso = misionActualizada.fecha_inicio
      ? new Date(misionActualizada.fecha_inicio).toISOString()
      : new Date().toISOString();
    const actualizadoEnIso = misionActualizada.actualizado_en
      ? new Date(misionActualizada.actualizado_en).toISOString()
      : new Date().toISOString();
    const hitoCreadoEnIso = hitoRegistrado.creado_en
      ? new Date(hitoRegistrado.creado_en).toISOString()
      : new Date().toISOString();

    return {
      mision: {
        id: misionActualizada.id,
        codigo: misionActualizada.codigo,
        titulo: misionActualizada.titulo,
        descripcion: misionActualizada.descripcion,
        tipoMision: misionActualizada.tipo_mision as AceptarMisionPatrullaResult["mision"]["tipoMision"],
        estado: misionActualizada.estado as AceptarMisionPatrullaResult["mision"]["estado"],
        prioridad: misionActualizada.prioridad as AceptarMisionPatrullaResult["mision"]["prioridad"],
        incidenteId: misionActualizada.incidente_id,
        patrullaId: misionActualizada.patrulla_id,
        fechaInicio: fechaInicioIso,
        actualizadoEn: actualizadoEnIso,
      },
      patrulla: {
        id: misionExistente.patrulla_id,
        nombre: misionExistente.patrulla_nombre ?? "Patrulla Verificadora",
        estado: "EN_VERIFICACION",
      },
      incidente: misionExistente.incidente_id
        ? {
            id: misionExistente.incidente_id,
            codigo: misionExistente.incidente_codigo ?? "",
            estado: "VERIFICANDO",
          }
        : null,
      hito: {
        id: hitoRegistrado.id,
        misionId: hitoRegistrado.mision_id,
        hito: hitoRegistrado.hito,
        descripcion: hitoRegistrado.descripcion,
        registradoPorId: hitoRegistrado.registrado_por_id,
        latitud: hitoRegistrado.latitud !== null ? Number(hitoRegistrado.latitud) : null,
        longitud: hitoRegistrado.longitud !== null ? Number(hitoRegistrado.longitud) : null,
        creadoEn: hitoCreadoEnIso,
      },
    };
  });
}

export const aceptarMisionCuadrillaRepo = aceptarMisionPatrullaRepo;

export interface RechazarMisionPatrullaResult {
  mision: {
    id: string;
    codigo: string;
    estado: string;
    justificacionRechazo: string;
    actualizadoEn: string;
  };
  patrulla: {
    id: string;
    nombre: string;
    estado: string;
    delegacionId?: string | null;
    usuarioLiderId?: string | null;
  };
  incidente: {
    id: string;
    codigo: string;
    estado: string;
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  };
  hito: {
    id: string;
    hito: string;
    descripcion: string;
    creadoEn: string;
  };
}

/**
 * HU-69 - Transacción atómica para rechazar una misión asignada a una patrulla verificadora.
 *
 * 1. Valida existencia y estado DESPACHADA de la misión.
 * 2. Valida tipo de misión VERIFICACION y asignación de patrulla verificadora.
 * 3. Valida pertenencia del usuario a la patrulla verificadora asignada (salvo Administrador).
 * 4. En una sola transacción atómica:
 *    - Actualiza mision.estado = 'RECHAZADA', asigna justificacion_rechazo y fecha_cierre = CURRENT_TIMESTAMP.
 *    - Transiciona patrulla.estado = 'DISPONIBLE' siempre que se encuentre activa (no dada de baja lógica).
 *    - Revierte incidente.estado = 'REPORTADO' (si estaba en REPORTADO o VERIFICANDO) para permitir su reasignación inmediata.
 *    - Registra el hito cronológico en mision_hito con hito = 'RECHAZADA'.
 */
export async function rechazarMisionPatrullaRepo(
  misionId: string,
  usuarioId: string,
  justificacionRechazo: string,
  esAdmin: boolean,
  input?: { latitud?: number; longitud?: number }
): Promise<RechazarMisionPatrullaResult> {
  return await db.transaction().execute(async (trx) => {
    // 1. Consultar la misión con su patrulla e incidente asociado
    const misionExistente = await trx
      .selectFrom("mision")
      .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
      .leftJoin("usuario as lider", "lider.id", "patrulla_verificadora.usuario_lider_id")
      .leftJoin("rol as rol_lider", "rol_lider.id", "lider.rol_id")
      .leftJoin("incidente", "incidente.id", "mision.incidente_id")
      .select([
        "mision.id",
        "mision.codigo",
        "mision.estado",
        "mision.tipo_mision",
        "mision.cuadrilla_id",
        "mision.patrulla_id",
        "mision.incidente_id",
        "patrulla_verificadora.nombre as patrulla_nombre",
        "patrulla_verificadora.estado as patrulla_estado",
        "patrulla_verificadora.activo as patrulla_activo",
        "patrulla_verificadora.eliminado_en as patrulla_eliminado_en",
        "patrulla_verificadora.delegacion_id as patrulla_delegacion_id",
        "patrulla_verificadora.usuario_lider_id as patrulla_lider_id",
        "rol_lider.codigo as lider_rol_codigo",
        "rol_lider.nombre as lider_rol_nombre",
        "incidente.codigo as incidente_codigo",
        "incidente.estado as incidente_estado",
        "incidente.prioridad as incidente_prioridad",
      ])
      .where("mision.id", "=", misionId)
      .executeTakeFirst();

    if (!misionExistente) {
      throw new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.");
    }

    // 2. Validar que la misión sea de verificación y cuente con patrulla e incidente asociados válidos
    if (misionExistente.tipo_mision !== "VERIFICACION" || !misionExistente.patrulla_id) {
      throw new ConflictError(
        "Solo es posible rechazar por esta vía misiones de verificación asignadas a una patrulla verificadora."
      );
    }

    if (!misionExistente.incidente_id) {
      throw new ConflictError("La misión de verificación no tiene un incidente asociado válido.");
    }

    // 3. Validar pertenencia a la patrulla verificadora asignada (salvo Administrador)
    if (!esAdmin) {
      const esLiderDirecto = misionExistente.patrulla_lider_id === usuarioId;
      if (!esLiderDirecto) {
        const integrante = await trx
          .selectFrom("patrulla_personal")
          .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
          .select("patrulla_personal.id")
          .where("patrulla_personal.patrulla_id", "=", misionExistente.patrulla_id)
          .where("personal.usuario_id", "=", usuarioId)
          .executeTakeFirst();

        if (!integrante) {
          throw new ForbiddenError(
            "No está autorizado para rechazar una misión asignada a otra patrulla verificadora."
          );
        }
      }
    }

    // 4. Validar estado actual de la misión
    if (misionExistente.estado === "RECHAZADA") {
      throw new ConflictError("La misión ya ha sido rechazada previamente.");
    }

    if (misionExistente.estado !== "DESPACHADA") {
      throw new ConflictError(
        `La misión no se encuentra en estado 'DESPACHADA' para ser rechazada (estado actual: '${misionExistente.estado}').`
      );
    }

    // 5. Actualizar misión atómicamente con control de concurrencia
    const misionActualizada = await trx
      .updateTable("mision")
      .set({
        estado: "RECHAZADA",
        justificacion_rechazo: justificacionRechazo,
        fecha_cierre: sql`CURRENT_TIMESTAMP`,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", misionId)
      .where("estado", "=", "DESPACHADA")
      .returning([
        "id",
        "codigo",
        "estado",
        "justificacion_rechazo",
        "patrulla_id",
        "incidente_id",
        "actualizado_en",
      ])
      .executeTakeFirst();

    if (!misionActualizada) {
      throw new ConflictError(
        "La misión ya no se encuentra en estado 'DESPACHADA' debido a una actualización concurrente."
      );
    }

    // 6. Liberar patrulla verificadora pasando a estado 'DISPONIBLE' asegurando que esté activa
    let patrullaNombre = misionExistente.patrulla_nombre ?? "Patrulla Verificadora";
    let patrullaEstado = misionExistente.patrulla_estado ?? "DISPONIBLE";
    let patrullaDelegacionId = misionExistente.patrulla_delegacion_id ?? null;
    let patrullaLiderId = misionExistente.patrulla_lider_id ?? null;

    if (misionExistente.patrulla_activo && !misionExistente.patrulla_eliminado_en) {
      const patrullaRes = await trx
        .updateTable("patrulla_verificadora")
        .set({
          estado: "DISPONIBLE",
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", misionExistente.patrulla_id)
        .where("activo", "=", true)
        .where("eliminado_en", "is", null)
        .returning(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
        .executeTakeFirst();

      if (patrullaRes) {
        patrullaNombre = patrullaRes.nombre;
        patrullaEstado = patrullaRes.estado;
        patrullaDelegacionId = patrullaRes.delegacion_id;
        patrullaLiderId = patrullaRes.usuario_lider_id;
      }
    }

    // 7. Revertir incidente a estado 'REPORTADO' para permitir reasignación inmediata (siempre que esté REPORTADO o VERIFICANDO)
    let incidenteCodigo = misionExistente.incidente_codigo ?? "";
    let incidenteEstado = "REPORTADO";
    let incidentePrioridad = (misionExistente.incidente_prioridad ?? "MEDIA") as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

    const incidenteRes = await trx
      .updateTable("incidente")
      .set({
        estado: "REPORTADO",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", misionExistente.incidente_id)
      .where("estado", "in", ["REPORTADO", "VERIFICANDO"])
      .returning(["id", "codigo", "estado", "prioridad"])
      .executeTakeFirst();

    if (incidenteRes) {
      incidenteCodigo = incidenteRes.codigo;
      incidenteEstado = incidenteRes.estado;
      if (incidenteRes.prioridad) {
        incidentePrioridad = incidenteRes.prioridad as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
      }
    } else if (misionExistente.incidente_estado) {
      incidenteEstado = misionExistente.incidente_estado;
    }

    // 8. Registrar hito en mision_hito
    const hito = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: misionId,
        hito: "RECHAZADA",
        descripcion: `Misión rechazada por patrulla: ${justificacionRechazo}`,
        registrado_por_id: usuarioId,
        latitud: input?.latitud != null ? String(input.latitud) : null,
        longitud: input?.longitud != null ? String(input.longitud) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      mision: {
        id: misionActualizada.id,
        codigo: misionActualizada.codigo,
        estado: misionActualizada.estado,
        justificacionRechazo: misionActualizada.justificacion_rechazo ?? justificacionRechazo,
        actualizadoEn: new Date(misionActualizada.actualizado_en).toISOString(),
      },
      patrulla: {
        id: misionExistente.patrulla_id,
        nombre: patrullaNombre,
        estado: patrullaEstado,
        delegacionId: patrullaDelegacionId,
        usuarioLiderId: patrullaLiderId,
      },
      incidente: {
        id: misionExistente.incidente_id,
        codigo: incidenteCodigo,
        estado: incidenteEstado,
        prioridad: incidentePrioridad,
      },
      hito: {
        id: hito.id,
        hito: hito.hito,
        descripcion: hito.descripcion,
        creadoEn: new Date(hito.creado_en).toISOString(),
      },
    };
  });
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
        hitoId: hitoInsertado.id,
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
