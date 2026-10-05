import {
  IncidentesKpisQuery,
  IncidentesKpisResponse,
} from "./incidente-kpi.schema";
import { obtenerContadoresIncidentesDiaRepo } from "./incidente-kpi.repository";

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD en la zona horaria de Chile ('America/Santiago').
 */
export function obtenerFechaActualChile(): string {
  const formateador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formateador.format(new Date());
}

/**
 * Servicio de negocio para obtener los KPIs y contadores de incidentes del día.
 */
export async function obtenerIncidentesKpisService(
  filtros: IncidentesKpisQuery
): Promise<IncidentesKpisResponse> {
  const fecha = filtros.fecha ?? obtenerFechaActualChile();

  const contadores = await obtenerContadoresIncidentesDiaRepo(
    fecha,
    filtros.delegacionId
  );

  return {
    message: "Contadores de incidentes del día obtenidos exitosamente.",
    data: {
      fecha,
      zonaHoraria: "America/Santiago",
      delegacionId: filtros.delegacionId ?? null,
      total: contadores.total,
      contadores: {
        reportado: contadores.reportado,
        verificando: contadores.verificando,
        enAtencion: contadores.en_atencion,
        noAbordables: contadores.no_abordable,
        resueltos: contadores.resuelto,
      },
      actualizadoEn: new Date().toISOString(),
    },
  };
}
