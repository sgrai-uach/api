import { db } from "@/lib/db";
import { sql } from "kysely";

export interface FilaContadoresKpi {
  total: number;
  reportado: number;
  verificando: number;
  en_atencion: number;
  no_abordable: number;
  resuelto: number;
}

/**
 * Consulta de agregación condicional sobre la tabla 'incidente' para obtener los contadores
 * por estado dentro del día indicado (o día actual) según la zona horaria 'America/Santiago'.
 */
export async function obtenerContadoresIncidentesDiaRepo(
  fechaYmd: string,
  delegacionId?: string
): Promise<FilaContadoresKpi> {
  let consulta = db
    .selectFrom("incidente")
    .where(
      "incidente.creado_en",
      ">=",
      sql<Date>`(${sql.val(fechaYmd)}::date AT TIME ZONE 'America/Santiago')`
    )
    .where(
      "incidente.creado_en",
      "<",
      sql<Date>`((${sql.val(fechaYmd)}::date + INTERVAL '1 day') AT TIME ZONE 'America/Santiago')`
    );

  if (delegacionId) {
    consulta = consulta.where("incidente.delegacion_id", "=", delegacionId);
  }

  const resultado = await consulta
    .select([
      sql<number>`coalesce(count(incidente.id), 0)::int`.as("total"),
      sql<number>`coalesce(count(incidente.id) filter (where upper(incidente.estado) = 'REPORTADO'), 0)::int`.as("reportado"),
      sql<number>`coalesce(count(incidente.id) filter (where upper(incidente.estado) = 'VERIFICANDO'), 0)::int`.as("verificando"),
      sql<number>`coalesce(count(incidente.id) filter (where upper(incidente.estado) = 'EN_ATENCION'), 0)::int`.as("en_atencion"),
      sql<number>`coalesce(count(incidente.id) filter (where upper(incidente.estado) = 'NO_ABORDABLE'), 0)::int`.as("no_abordable"),
      sql<number>`coalesce(count(incidente.id) filter (where upper(incidente.estado) = 'RESUELTO'), 0)::int`.as("resuelto"),
    ])
    .executeTakeFirst();

  return {
    total: Number(resultado?.total ?? 0),
    reportado: Number(resultado?.reportado ?? 0),
    verificando: Number(resultado?.verificando ?? 0),
    en_atencion: Number(resultado?.en_atencion ?? 0),
    no_abordable: Number(resultado?.no_abordable ?? 0),
    resuelto: Number(resultado?.resuelto ?? 0),
  };
}
