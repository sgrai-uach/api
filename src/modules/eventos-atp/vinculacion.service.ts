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
 * Vincula entidades a un Evento ATP activo (H60).
 *
 * - Requiere el permiso `eventos_atp:vincular`.
 * - Valida que el Evento ATP exista y esté ACTIVO.
 * - Actualiza `evento_atp_id` en una sola transacción en las cuatro tablas.
 * - Reasigna entidades que ya pertenecían a otro Evento ATP y las reporta.
 * - Emite `evento_atp:vinculado` a las salas encargado, supervisor y mapa.
 */
export async function vincularEntidadesEventoAtpService(
  eventoAtpId: string,
  input: VincularEntidadesInput,
  usuarioId: string
): Promise<ResultadoVinculacion> {
  const usuario = await seguridadService.validarAccesoRoles(usuarioId, [
    PERMISO_VINCULAR_EVENTO_ATP,
  ]);

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
    const idsSolicitados = new Set([
      ...grupos.incidenteIds,
      ...grupos.eventoPrevencionIds,
      ...grupos.recuperacionIds,
      ...grupos.eventoAsistenciaSocialIds,
    ]);
    const idsEncontrados = new Set(existentes.map((fila) => fila.id));

    const noEncontradas = Array.from(idsSolicitados)
      .filter((id) => !idsEncontrados.has(id))
      .map((id) => ({ tipo: "INCIDENTE" as TipoEntidadVinculable, id }));

    const reasignadas = existentes.filter(
      (fila) =>
        fila.evento_atp_id !== null && fila.evento_atp_id !== eventoAtpId
    );

    await actualizarEventoAtpDeEntidades(trx, eventoAtpId, grupos);

    const afectadas = existentes.map(aResumen);
    const agrupadas = agruparEntidades(afectadas);

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

  emitirEventoAtpVinculado(resultado);

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
  const usuario = await seguridadService.validarAccesoRoles(usuarioId, [
    PERMISO_VINCULAR_EVENTO_ATP,
  ]);

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
    const idsSolicitados = new Set([
      ...grupos.incidenteIds,
      ...grupos.eventoPrevencionIds,
      ...grupos.recuperacionIds,
      ...grupos.eventoAsistenciaSocialIds,
    ]);
    const idsEncontrados = new Set(existentes.map((fila) => fila.id));

    const noEncontradas = Array.from(idsSolicitados)
      .filter((id) => !idsEncontrados.has(id))
      .map((id) => ({ tipo: "INCIDENTE" as TipoEntidadVinculable, id }));

    const noDesvinculadas = existentes.filter(
      (fila) => fila.evento_atp_id !== eventoAtpId
    );
    const desvinculadas = existentes.filter(
      (fila) => fila.evento_atp_id === eventoAtpId
    );

    await desvincularEntidadesDelEvento(trx, eventoAtpId, grupos);

    const agrupadas = agruparEntidades(desvinculadas.map(aResumen));

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

  emitirEventoAtpVinculado(resultado);

  return resultado;
}
