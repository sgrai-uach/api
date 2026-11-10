import { db } from "@/lib/db";
import { sql, type Transaction } from "kysely";
import { NotFoundError, ConflictError } from "@/modules/seguridad/errors";
import type { Database } from "@/lib/db/types";
import type {
  CrearMisionVerificacionInput,
  AsignarCuadrillaMisionInput,
} from "./mision.schema";

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
    // 1. Validar existencia y estado del incidente con bloqueo pesimista (FOR UPDATE)
    const incidente = await trx
      .selectFrom("incidente")
      .select(["id", "codigo", "estado", "prioridad", "tipo_afectacion", "delegacion_id"])
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
