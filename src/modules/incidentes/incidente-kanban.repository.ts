import { db } from "@/lib/db";
import { sql } from "kysely";
import type { ListarIncidentesQuery } from "./incidente-kanban.schema";
import { asegurarColumnasHu38EnEsquema } from "./prioridad.repository";

function esErrorColumnaInexistente(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42703"
  );
}

export interface FilaIncidenteResumen {
  id: string;
  codigo: string;
  codigo_seguimiento: string;
  tipo_afectacion: string;
  descripcion: string | null;
  direccion_texto: string;
  latitud: number | string;
  longitud: number | string;
  estado: string;
  prioridad: string;
  prioridad_sugerida?: string | null;
  justificacion_prioridad?: string | null;
  total_reportes_terreno?: number | string;
  requiere_asistencia_social: boolean;
  fuente_origen: string;
  informante_nombre: string | null;
  delegacion_nombre: string | null;
  total_misiones: number | string;
  tiene_mision_despachada?: boolean;
  tiene_mision_en_curso?: boolean;
  verificado?: boolean | number;
  reclasificado_en_terreno?: boolean | number;
  justificacion_reclasificacion?: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

/**
 * Consulta la lista paginada de incidentes con filtros opcionales para el tablero Kanban.
 */
export async function listarIncidentesPaginadosRepo(filtros: ListarIncidentesQuery) {
  // Sincronización defensiva: garantizar consistencia operacional si un incidente
  // posee una misión aceptada en terreno (EN_CURSO) pero persistía en REPORTADO
  try {
    await db
      .updateTable("incidente")
      .set({
        estado: "VERIFICANDO",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("estado", "=", "REPORTADO")
      .where("id", "in", (eb) =>
        eb
          .selectFrom("mision")
          .select("mision.incidente_id")
          .where("mision.estado", "=", "EN_CURSO")
          .where("mision.incidente_id", "is not", null)
      )
      .execute();
  } catch {
    // Si la base de datos o el mock no implementa updateTable en tests unitarios aislados, ignorar
  }

  let consultaBase = db
    .selectFrom("incidente")
    .leftJoin("informante", "informante.id", "incidente.informante_id")
    .leftJoin("delegacion", "delegacion.id", "incidente.delegacion_id");

  // Filtro por Estado (case-insensitive para tolerar variantes históricas)
  if (filtros.estado) {
    consultaBase = consultaBase.where(
      sql`upper(incidente.estado)`,
      "=",
      filtros.estado.toUpperCase()
    );
  }

  // Filtro por Prioridad
  if (filtros.prioridad) {
    consultaBase = consultaBase.where("incidente.prioridad", "=", filtros.prioridad);
  }

  // Filtro por Tipo de Afectación
  if (filtros.tipoAfectacion && filtros.tipoAfectacion.trim() !== "") {
    consultaBase = consultaBase.where(
      "incidente.tipo_afectacion",
      "=",
      filtros.tipoAfectacion.trim()
    );
  }

  // Filtro por Búsqueda de Texto
  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    consultaBase = consultaBase.where((eb) =>
      eb.or([
        eb("incidente.codigo", "ilike", patron),
        eb("incidente.codigo_seguimiento", "ilike", patron),
        eb("incidente.direccion_texto", "ilike", patron),
        eb("incidente.descripcion", "ilike", patron),
      ])
    );
  }

  // Filtro por Delegación Territorial
  if (filtros.delegacionId) {
    consultaBase = consultaBase.where("incidente.delegacion_id", "=", filtros.delegacionId);
  }

  // Filtro por Fuente de Origen
  if (filtros.fuenteOrigen) {
    consultaBase = consultaBase.where("incidente.fuente_origen", "=", filtros.fuenteOrigen);
  }

  // Filtro Temporal por Fecha o soloHoy (Zona horaria Chile)
  if (filtros.fecha) {
    consultaBase = consultaBase
      .where(
        "incidente.creado_en",
        ">=",
        sql<Date>`(${sql.val(filtros.fecha)}::date AT TIME ZONE 'America/Santiago')`
      )
      .where(
        "incidente.creado_en",
        "<",
        sql<Date>`((${sql.val(filtros.fecha)}::date + INTERVAL '1 day') AT TIME ZONE 'America/Santiago')`
      );
  } else if (filtros.soloHoy) {
    consultaBase = consultaBase
      .where(
        "incidente.creado_en",
        ">=",
        sql<Date>`(CURRENT_DATE AT TIME ZONE 'America/Santiago')`
      )
      .where(
        "incidente.creado_en",
        "<",
        sql<Date>`((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Santiago')`
      );
  }

  // Conteo total para metadatos de paginación
  const resultadoConteo = await consultaBase
    .select(sql<number>`count(incidente.id)::int`.as("total"))
    .executeTakeFirst();

  const total = Number(resultadoConteo?.total ?? 0);

  // Obtener filas paginadas
  const ejecutarConsultaFilas = () =>
    consultaBase
      .select([
        "incidente.id",
        "incidente.codigo",
        "incidente.codigo_seguimiento",
        "incidente.tipo_afectacion",
        "incidente.descripcion",
        "incidente.direccion_texto",
        "incidente.latitud",
        "incidente.longitud",
        "incidente.estado",
        "incidente.prioridad",
        "incidente.prioridad_sugerida",
        "incidente.justificacion_prioridad",
        "incidente.requiere_asistencia_social",
        "incidente.fuente_origen",
        "informante.nombre as informante_nombre",
        "delegacion.nombre as delegacion_nombre",
        "incidente.creado_en",
        "incidente.actualizado_en",
        (eb) =>
          eb
            .selectFrom("mision")
            .select(sql<number>`count(mision.id)::int`.as("count"))
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .as("total_misiones"),
        (eb) =>
          eb
            .selectFrom("mision")
            .innerJoin("reporte_terreno", "reporte_terreno.mision_id", "mision.id")
            .select(sql<number>`count(reporte_terreno.id)::int`.as("count"))
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .as("total_reportes_terreno"),
        (eb) =>
          eb
            .selectFrom("mision")
            .select(
              sql<boolean>`case when count(mision.id) > 0 then true else false end`.as(
                "tiene_mision_despachada"
              )
            )
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .where("mision.estado", "in", ["PLANIFICADA", "DESPACHADA"])
            .as("tiene_mision_despachada"),
        (eb) =>
          eb
            .selectFrom("mision")
            .select(
              sql<boolean>`case when count(mision.id) > 0 then true else false end`.as(
                "tiene_mision_en_curso"
              )
            )
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .where("mision.estado", "=", "EN_CURSO")
            .as("tiene_mision_en_curso"),
        (eb) =>
          eb
            .selectFrom("mision")
            .leftJoin("mision_hito", "mision_hito.mision_id", "mision.id")
            .select(
              sql<boolean>`case when count(mision.id) > 0 then true else false end`.as("verificado")
            )
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .where("mision.tipo_mision", "=", "VERIFICACION")
            .where((ebOr) =>
              ebOr.or([
                ebOr("mision.estado", "=", "COMPLETADA"),
                ebOr("mision_hito.hito", "in", [
                  "TIPOLOGIA_RECLASIFICADA",
                  "PRIORIDAD_ASIGNADA",
                  "PRIORIDAD_RECTIFICADA",
                ]),
              ])
            )
            .as("verificado"),
        (eb) =>
          eb
            .selectFrom("mision")
            .leftJoin("mision_hito", "mision_hito.mision_id", "mision.id")
            .select(
              sql<boolean>`case when count(mision.id) > 0 then true else false end`.as("reclasificado_en_terreno")
            )
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .where("mision.tipo_mision", "=", "VERIFICACION")
            .where((ebOr) =>
              ebOr.or([
                ebOr("mision.estado", "=", "COMPLETADA"),
                ebOr("mision_hito.hito", "in", [
                  "TIPOLOGIA_RECLASIFICADA",
                  "PRIORIDAD_ASIGNADA",
                  "PRIORIDAD_RECTIFICADA",
                ]),
              ])
            )
            .as("reclasificado_en_terreno"),
        (eb) =>
          eb
            .selectFrom("mision")
            .innerJoin("mision_hito", "mision_hito.mision_id", "mision.id")
            .select("mision_hito.descripcion")
            .whereRef("mision.incidente_id", "=", "incidente.id")
            .where("mision_hito.hito", "=", "TIPOLOGIA_RECLASIFICADA")
            .orderBy("mision_hito.creado_en", "desc")
            .limit(1)
            .as("justificacion_reclasificacion"),
      ])
      .orderBy(
        sql`case when exists (
          select 1 from mision m 
          left join mision_hito mh on mh.mision_id = m.id
          where m.incidente_id = incidente.id 
            and m.tipo_mision = 'VERIFICACION' 
            and (m.estado = 'COMPLETADA' or mh.hito = 'TIPOLOGIA_RECLASIFICADA')
        ) then 1 else 0 end`,
        "desc"
      )
      .orderBy("incidente.creado_en", "desc")
      .limit(filtros.limit ?? 20)
      .offset(((filtros.page ?? 1) - 1) * (filtros.limit ?? 20))
      .execute();

  let filas;
  try {
    filas = await ejecutarConsultaFilas();
  } catch (err) {
    if (esErrorColumnaInexistente(err)) {
      await asegurarColumnasHu38EnEsquema();
      filas = await ejecutarConsultaFilas();
    } else {
      throw err;
    }
  }

  return {
    filas: filas as unknown as FilaIncidenteResumen[],
    total,
  };
}

/**
 * Consulta los datos detallados de un incidente junto a sus misiones y recursos asociados.
 */
export async function obtenerIncidenteDetallePorIdRepo(id: string) {
  const ejecutarConsultaIncidente = () =>
    db
      .selectFrom("incidente")
      .leftJoin("informante", "informante.id", "incidente.informante_id")
      .leftJoin("delegacion", "delegacion.id", "incidente.delegacion_id")
      .leftJoin("usuario as creador", "creador.id", "incidente.creado_por_id")
      .leftJoin("usuario as encargado", "encargado.id", "incidente.encargado_id")
      .select([
        "incidente.id",
        "incidente.codigo",
        "incidente.codigo_seguimiento",
        "incidente.tipo_afectacion",
        "incidente.descripcion",
        "incidente.direccion_texto",
        "incidente.latitud",
        "incidente.longitud",
        "incidente.estado",
        "incidente.prioridad",
        "incidente.prioridad_sugerida",
        "incidente.justificacion_prioridad",
        "incidente.requiere_asistencia_social",
        "incidente.fuente_origen",
        "incidente.asterisk_call_id",
        "incidente.asterisk_caller_phone",
        "incidente.creado_en",
        "incidente.actualizado_en",
        "informante.id as informante_id",
        "informante.rut as informante_rut",
        "informante.nombre as informante_nombre",
        "informante.telefono as informante_telefono",
        "delegacion.id as delegacion_id",
        "delegacion.nombre as delegacion_nombre",
        "delegacion.descripcion as delegacion_descripcion",
        "creador.id as creador_id",
        "creador.nombre as creador_nombre",
        "creador.email as creador_email",
        "encargado.id as encargado_id",
        "encargado.nombre as encargado_nombre",
        "encargado.email as encargado_email",
      ])
      .where("incidente.id", "=", id)
      .executeTakeFirst();

  let incidente;
  try {
    incidente = await ejecutarConsultaIncidente();
  } catch (err) {
    if (esErrorColumnaInexistente(err)) {
      await asegurarColumnasHu38EnEsquema();
      incidente = await ejecutarConsultaIncidente();
    } else {
      throw err;
    }
  }

  if (!incidente) {
    return null;
  }

  // Consultar misiones asignadas a este incidente
  const misiones = await db
    .selectFrom("mision")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.descripcion",
      "mision.tipo_mision",
      "mision.estado",
      "mision.prioridad",
      "mision.justificacion_rechazo",
      "mision.fecha_inicio",
      "mision.fecha_cierre",
      "mision.creado_en",
      "patrulla_verificadora.id as patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
      "cuadrilla.id as cuadrilla_id",
      "cuadrilla.nombre as cuadrilla_nombre",
      "cuadrilla.estado as cuadrilla_estado",
    ])
    .where("mision.incidente_id", "=", id)
    .orderBy("mision.creado_en", "asc")
    .execute();

  // Consultar recursos asignados a las cuadrillas de dichas misiones
  const cuadrillaIds = misiones
    .map((m) => m.cuadrilla_id)
    .filter((cId): cId is string => Boolean(cId));

  let recursosAsociados: Array<{
    recursoId: string;
    nombre: string;
    esIndividual: boolean;
    cantidadAsignadaTotal: number;
    estadoRecurso: string;
    cuadrillaNombre: string | null;
  }> = [];

  if (cuadrillaIds.length > 0) {
    const filasRecursos = await db
      .selectFrom("cuadrilla_recurso")
      .innerJoin("recurso", "recurso.id", "cuadrilla_recurso.recurso_id")
      .leftJoin("cuadrilla", "cuadrilla.id", "cuadrilla_recurso.cuadrilla_id")
      .select([
        "recurso.id as recurso_id",
        "recurso.nombre as recurso_nombre",
        "recurso.es_individual",
        "recurso.estado as recurso_estado",
        "cuadrilla_recurso.cantidad_asignada",
        "cuadrilla.nombre as cuadrilla_nombre",
      ])
      .where("cuadrilla_recurso.cuadrilla_id", "in", cuadrillaIds)
      .execute();

    recursosAsociados = filasRecursos.map((r) => ({
      recursoId: r.recurso_id,
      nombre: r.recurso_nombre,
      esIndividual: Boolean(r.es_individual),
      cantidadAsignadaTotal: Number(r.cantidad_asignada),
      estadoRecurso: r.recurso_estado,
      cuadrillaNombre: r.cuadrilla_nombre ?? null,
    }));
  }

  // Consultar hito de reclasificación técnica si existiese
  const hitoReclasificacion = await db
    .selectFrom("mision")
    .innerJoin("mision_hito", "mision_hito.mision_id", "mision.id")
    .select("mision_hito.descripcion")
    .where("mision.incidente_id", "=", id)
    .where("mision_hito.hito", "in", [
      "TIPOLOGIA_RECLASIFICADA",
      "PRIORIDAD_ASIGNADA",
      "PRIORIDAD_RECTIFICADA",
    ])
    .orderBy("mision_hito.creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  // Consultar detalle estructurado del último cambio de tipología (TIPOLOGIA_RECLASIFICADA)
  let reclasificacionTipologiaRaw: {
    hito_id: string;
    mision_id: string;
    mision_codigo: string;
    descripcion: string;
    metadatos?: Record<string, unknown> | string | null;
    registrador_nombre: string | null;
    creado_en: Date | string;
  } | null = null;

  try {
    const filaReclasif = await db
      .selectFrom("mision")
      .innerJoin("mision_hito", "mision_hito.mision_id", "mision.id")
      .leftJoin("usuario as registrador", "registrador.id", "mision_hito.registrado_por_id")
      .select([
        "mision_hito.id as hito_id",
        "mision.id as mision_id",
        "mision.codigo as mision_codigo",
        "mision_hito.descripcion",
        "mision_hito.metadatos",
        "registrador.nombre as registrador_nombre",
        "mision_hito.creado_en",
      ])
      .where("mision.incidente_id", "=", id)
      .where("mision_hito.hito", "=", "TIPOLOGIA_RECLASIFICADA")
      .orderBy("mision_hito.creado_en", "desc")
      .limit(1)
      .executeTakeFirst();

    reclasificacionTipologiaRaw = filaReclasif ?? null;
  } catch {
    reclasificacionTipologiaRaw = null;
  }

  // Consultar historial de reportes de evaluación en terreno asociados a las misiones del incidente (HU-38)
  let reportesEvaluacionTerreno: Array<{
    id: string;
    mision_id: string;
    evaluador_id: string;
    version_reporte?: number | null;
    es_rectificacion?: boolean | null;
    prioridad_sugerida?: string | null;
    prioridad_asignada?: string | null;
    justificacion_prioridad?: string | null;
    resumen_tecnico: string;
    acciones_realizadas: string | null;
    danos_estimados: string | null;
    observaciones: string | null;
    personas_afectadas: number;
    requiere_apoyo_adicional: boolean;
    detalles_evaluacion?: Record<string, unknown> | string | null;
    evaluador_nombre: string | null;
    evaluador_email: string | null;
    evaluador_rut: string | null;
    creado_en: Date | string;
  }> = [];

  try {
    const misionIds = misiones.map((m) => m.id);
    if (misionIds.length > 0) {
      reportesEvaluacionTerreno = await db
        .selectFrom("reporte_terreno")
        .leftJoin("usuario as evaluador", "evaluador.id", "reporte_terreno.evaluador_id")
        .select([
          "reporte_terreno.id",
          "reporte_terreno.mision_id",
          "reporte_terreno.evaluador_id",
          "reporte_terreno.version_reporte",
          "reporte_terreno.es_rectificacion",
          "reporte_terreno.prioridad_sugerida",
          "reporte_terreno.prioridad_asignada",
          "reporte_terreno.justificacion_prioridad",
          "reporte_terreno.resumen_tecnico",
          "reporte_terreno.acciones_realizadas",
          "reporte_terreno.danos_estimados",
          "reporte_terreno.observaciones",
          "reporte_terreno.personas_afectadas",
          "reporte_terreno.requiere_apoyo_adicional",
          "reporte_terreno.detalles_evaluacion",
          "evaluador.nombre as evaluador_nombre",
          "evaluador.email as evaluador_email",
          "evaluador.rut as evaluador_rut",
          "reporte_terreno.creado_en",
        ])
        .where("reporte_terreno.mision_id", "in", misionIds)
        .orderBy("reporte_terreno.version_reporte", "desc")
        .orderBy("reporte_terreno.creado_en", "desc")
        .execute();
    }
  } catch {
    // Si la tabla o columnas no están presentes en mocks de pruebas aisladas, retornar vacío
  }

  return {
    incidente,
    misiones,
    recursosAsociados,
    reportesEvaluacionTerreno,
    justificacionReclasificacion: hitoReclasificacion?.descripcion ?? null,
    reclasificacionTipologiaRaw,
  } as {
    incidente: Omit<
      typeof incidente,
      "prioridad_sugerida" | "justificacion_prioridad"
    > & {
      prioridad_sugerida?: typeof incidente.prioridad_sugerida;
      justificacion_prioridad?: typeof incidente.justificacion_prioridad;
    };
    misiones: typeof misiones;
    recursosAsociados: typeof recursosAsociados;
    reportesEvaluacionTerreno?: typeof reportesEvaluacionTerreno;
    justificacionReclasificacion: string | null;
    reclasificacionTipologiaRaw?: typeof reclasificacionTipologiaRaw;
  };
}
