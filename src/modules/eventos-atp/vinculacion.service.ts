import { seguridadService } from "@/modules/seguridad/service";
import {
  ConflictError,
  NotFoundError,
} from "@/modules/seguridad/errors";
import { PERMISO_VINCULAR_EVENTO_ATP } from "@/modules/seguridad/permisos.constants";
import { emitirEventoAtpVinculado } from "@/lib/socket";
import {
  VincularEntidadesInputSchema,
  type TipoEntidadVinculable,
  type VincularEntidadesInput,
} from "./vinculacion.schema";
import type {
  ResultadoVinculacion,
  VinculosEventoAtp,
} from "./evento-atp.schema";
import {
  actualizarEventoAtpDeEntidades,
  buscarEventoAtpParaVinculacion,
  desvincularEntidadesDelEvento,
  ejecutarTransaccionVinculacion,
  obtenerEntidadesExistentes,
  type FilaEntidadVinculable,
  type GruposEntidades,
} from "./vinculacion.repository";

interface EntidadResumen {
  tipo: TipoEntidadVinculable;
  id: string;
  codigo: string;
  nombre: string | null;
  eventoAtpIdAnterior?: string | null;
}

const GRUPO_POR_TIPO: Record<TipoEntidadVinculable, keyof VinculosEventoAtp> = {
  INCIDENTE: "incidentes",
  EVENTO_PREVENCION: "eventosPrevencion",
  RECUPERACION: "recuperaciones",
  EVENTO_ASISTENCIA_SOCIAL: "eventosAsistenciaSocial",
};

function agruparEntidades(
  filas: EntidadResumen[]
): Record<keyof VinculosEventoAtp, EntidadResumen[]> {
  const agrupadas: Record<keyof VinculosEventoAtp, EntidadResumen[]> = {
    incidentes: [],
    eventosPrevencion: [],
    recuperaciones: [],
    eventosAsistenciaSocial: [],
  };

  for (const fila of filas) {
    agrupadas[GRUPO_POR_TIPO[fila.tipo]].push(fila);
  }

  return agrupadas;
}

function aResumen(fila: FilaEntidadVinculable): EntidadResumen {
  return {
    tipo: fila.tipo,
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    eventoAtpIdAnterior: fila.evento_atp_id,
  };
}

/**
 * Resumen de una entidad ya modificada. No expone `eventoAtpIdAnterior`
 * porque el `RETURNING` refleja el nuevo vínculo, no el estado previo.
 */
function aResumenActualizada(fila: FilaEntidadVinculable): EntidadResumen {
  return {
    tipo: fila.tipo,
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
  };
}

function normalizarGrupos(input: VincularEntidadesInput): GruposEntidades {
  const unicos = (ids: string[]) => Array.from(new Set(ids));
  return {
    incidenteIds: unicos(input.incidenteIds),
    eventoPrevencionIds: unicos(input.eventoPrevencionIds),
    recuperacionIds: unicos(input.recuperacionIds),
    eventoAsistenciaSocialIds: unicos(input.eventoAsistenciaSocialIds),
  };
}

/**
 * Detecta los identificadores no encontrados validando cada grupo contra las
 * filas de su propio tipo. Evita enmascaramientos entre tablas que compartan
 * un mismo UUID y reporta siempre el tipo real solicitado.
 */
function construirNoEncontradas(
  grupos: GruposEntidades,
  existentes: FilaEntidadVinculable[]
): Array<{ tipo: TipoEntidadVinculable; id: string }> {
  const idsPorTipo = (tipo: TipoEntidadVinculable) =>
    new Set(
      existentes
        .filter((fila) => fila.tipo === tipo)
        .map((fila) => fila.id)
    );

  const detectar = (
    ids: string[],
    tipo: TipoEntidadVinculable
  ): Array<{ tipo: TipoEntidadVinculable; id: string }> => {
    const encontrados = idsPorTipo(tipo);
    return ids
      .filter((id) => !encontrados.has(id))
      .map((id) => ({ tipo, id }));
  };

  return [
    ...detectar(grupos.incidenteIds, "INCIDENTE"),
    ...detectar(grupos.eventoPrevencionIds, "EVENTO_PREVENCION"),
    ...detectar(grupos.recuperacionIds, "RECUPERACION"),
    ...detectar(
      grupos.eventoAsistenciaSocialIds,
      "EVENTO_ASISTENCIA_SOCIAL"
    ),
  ];
}

/**
 * Cantidad de entidades realmente afectadas por la operación, construida
 * desde las filas devueltas por los UPDATE.
 */
function contarEntidadesAfectadas(resultado: ResultadoVinculacion): number {
  return (
    resultado.entidades.incidentes.length +
    resultado.entidades.eventosPrevencion.length +
    resultado.entidades.recuperaciones.length +
    resultado.entidades.eventosAsistenciaSocial.length
  );
}

/**
 * Vincula entidades a un Evento ATP activo (H60).
 *
 * - Requiere el permiso `eventos_atp:vincular`.
 * - Valida que el Evento ATP exista y esté ACTIVO.
 * - Actualiza `evento_atp_id` en una sola transacción en las cuatro tablas.
 * - Reasigna entidades que ya pertenecían a otro Evento ATP y las reporta.
 * - Emite `evento_atp:vinculado` a las salas encargado, sala:encargados,
 *   supervisor y mapa, solo si hubo filas modificadas.
 */
export async function vincularEntidadesEventoAtpService(
  eventoAtpId: string,
  input: VincularEntidadesInput,
  usuarioId: string
): Promise<ResultadoVinculacion> {
  const usuario = await seguridadService.validarAccesoRoles(
    usuarioId,
    [PERMISO_VINCULAR_EVENTO_ATP],
    "Acceso denegado. Se requiere el permiso 'eventos_atp:vincular' para vincular o desvincular entidades de un Evento ATP."
  );

  const datos = VincularEntidadesInputSchema.parse(input);
  const grupos = normalizarGrupos(datos);

  const resultado = await ejecutarTransaccionVinculacion(async (trx) => {
    const evento = await buscarEventoAtpParaVinculacion(trx, eventoAtpId);

    if (!evento) {
      throw new NotFoundError(
        `El Evento ATP '${eventoAtpId}' no existe en el sistema.`
      );
    }

    if (evento.estado !== "ACTIVO") {
      throw new ConflictError(
        `El Evento ATP '${evento.codigo}' se encuentra en estado ${evento.estado} y no admite nuevas vinculaciones.`
      );
    }

    const existentes = await obtenerEntidadesExistentes(trx, grupos);
    const noEncontradas = construirNoEncontradas(grupos, existentes);

    const reasignadas = existentes.filter(
      (fila) =>
        fila.evento_atp_id !== null && fila.evento_atp_id !== eventoAtpId
    );

    const actualizadas = await actualizarEventoAtpDeEntidades(
      trx,
      eventoAtpId,
      grupos
    );

    const agrupadas = agruparEntidades(actualizadas.map(aResumenActualizada));

    return {
      eventoAtpId,
      accion: "VINCULADO" as const,
      entidades: {
        incidentes: agrupadas.incidentes,
        eventosPrevencion: agrupadas.eventosPrevencion,
        recuperaciones: agrupadas.recuperaciones,
        eventosAsistenciaSocial: agrupadas.eventosAsistenciaSocial,
      },
      reasignadas: reasignadas.map(aResumen),
      noEncontradas,
      noDesvinculadas: [],
      vinculadoPorId: usuario.id,
      ocurridoEn: new Date().toISOString(),
    };
  });

  if (contarEntidadesAfectadas(resultado) > 0) {
    try {
      emitirEventoAtpVinculado(resultado);
    } catch (error) {
      console.error(
        "Error al emitir evento_atp:vinculado tras la vinculación:",
        error
      );
    }
  }

  return resultado;
}

/**
 * Desvincula entidades de un Evento ATP (H60).
 *
 * - Establece `evento_atp_id = NULL` sin eliminar la entidad.
 * - Solo desvincula registros que pertenecen al Evento ATP indicado.
 * - Reporta las entidades que pertenecen a otro evento en `noDesvinculadas`.
 * - Emite `evento_atp:vinculado` con acción DESVINCULADO.
 */
export async function desvincularEntidadesEventoAtpService(
  eventoAtpId: string,
  input: VincularEntidadesInput,
  usuarioId: string
): Promise<ResultadoVinculacion> {
  const usuario = await seguridadService.validarAccesoRoles(
    usuarioId,
    [PERMISO_VINCULAR_EVENTO_ATP],
    "Acceso denegado. Se requiere el permiso 'eventos_atp:vincular' para vincular o desvincular entidades de un Evento ATP."
  );

  const datos = VincularEntidadesInputSchema.parse(input);
  const grupos = normalizarGrupos(datos);

  const resultado = await ejecutarTransaccionVinculacion(async (trx) => {
    const evento = await buscarEventoAtpParaVinculacion(trx, eventoAtpId);

    if (!evento) {
      throw new NotFoundError(
        `El Evento ATP '${eventoAtpId}' no existe en el sistema.`
      );
    }

    const existentes = await obtenerEntidadesExistentes(trx, grupos);
    const noEncontradas = construirNoEncontradas(grupos, existentes);

    const noDesvinculadas = existentes.filter(
      (fila) => fila.evento_atp_id !== eventoAtpId
    );

    const desvinculadas = await desvincularEntidadesDelEvento(
      trx,
      eventoAtpId,
      grupos
    );

    const agrupadas = agruparEntidades(
      desvinculadas.map(aResumenActualizada)
    );

    return {
      eventoAtpId,
      accion: "DESVINCULADO" as const,
      entidades: {
        incidentes: agrupadas.incidentes,
        eventosPrevencion: agrupadas.eventosPrevencion,
        recuperaciones: agrupadas.recuperaciones,
        eventosAsistenciaSocial: agrupadas.eventosAsistenciaSocial,
      },
      reasignadas: [],
      noEncontradas,
      noDesvinculadas: noDesvinculadas.map(aResumen),
      vinculadoPorId: usuario.id,
      ocurridoEn: new Date().toISOString(),
    };
  });

  if (contarEntidadesAfectadas(resultado) > 0) {
    try {
      emitirEventoAtpVinculado(resultado);
    } catch (error) {
      console.error(
        "Error al emitir evento_atp:vinculado tras la desvinculación:",
        error
      );
    }
  }

  return resultado;
}
