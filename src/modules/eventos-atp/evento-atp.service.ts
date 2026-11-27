import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_CREAR_EVENTO_ATP,
  PERMISO_LEER_ASISTENCIA_SOCIAL,
  PERMISO_LEER_MISION,
  PERMISO_KANBAN_INCIDENTES,
  PERMISO_VINCULAR_EVENTO_ATP,
} from "@/modules/seguridad/permisos.constants";
import { NotFoundError } from "@/modules/seguridad/errors";
import { emitirEventoAtpCreado } from "@/lib/socket";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import {
  CrearEventoAtpInputSchema,
  ListarEventosAtpQuerySchema,
  type CrearEventoAtpInput,
  type EventoAtpDetalle,
  type EventoAtpResponse,
  type EventoAtpResumen,
  type ListarEventosAtpQuery,
  type ListarEventosAtpResponse,
} from "./evento-atp.schema";
import {
  contarVinculosPorEventoAtp,
  insertarEventoAtpConDelegaciones,
  listarEventosAtpPaginadosRepo,
  obtenerEventoAtpPorId,
  obtenerVinculosEventoAtp,
  type DatosCrearEventoAtpRepo,
  type FilaEventoAtp,
  type FilaDelegacionEventoAtp,
} from "./evento-atp.repository";

/**
 * Mensaje institucional de denegación de acceso al módulo de Eventos ATP.
 */
export const MENSAJE_ACCESO_DENEGADO_EVENTO_ATP =
  "Acceso denegado. Se requiere el perfil de Administrador o el permiso eventos_atp:crear.";

function aISO(fecha: Date | string): string {
  return fecha instanceof Date
    ? fecha.toISOString()
    : new Date(fecha).toISOString();
}

/**
 * Mapea una fila de base de datos al contrato canónico de respuesta.
 */
export function mapearEventoAtp(
  fila: FilaEventoAtp,
  delegaciones: FilaDelegacionEventoAtp[]
): EventoAtpResponse {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tipoAmenaza: fila.tipo_amenaza,
    nivelAlerta: fila.nivel_alerta,
    fechaInicio: aISO(fila.fecha_inicio),
    fechaTermino: aISO(fila.fecha_termino),
    estado: fila.estado,
    delegaciones: delegaciones.map((delegacion) => ({
      id: delegacion.id,
      codigo: delegacion.codigo,
      nombre: delegacion.nombre,
    })),
    creadoPorId: fila.creado_por_id ?? null,
    creadoEn: aISO(fila.creado_en),
    actualizadoEn: aISO(fila.actualizado_en),
  };
}

/**
 * Crea un Evento de Alerta Temprana Preventiva (H61).
 *
 * Reglas de negocio:
 * - Requiere rol Administrador o el permiso explícito eventos_atp:crear.
 * - Valida estrictamente fechas, campos obligatorios y delegaciones.
 * - Persiste el evento y su tabla puente en una sola transacción.
 * - Emite evento_atp:creado a las salas operativas y administrativas.
 */
export async function crearEventoAtpService(
  input: CrearEventoAtpInput,
  usuarioId?: string | null
): Promise<EventoAtpResponse> {
  // 1. Control de acceso RBAC
  const usuario = await seguridadService.validarAccesoRoles(
    usuarioId,
    [PERMISO_CREAR_EVENTO_ATP],
    MENSAJE_ACCESO_DENEGADO_EVENTO_ATP
  );

  // 2. Validación estricta del contrato de entrada
  const datosValidados = CrearEventoAtpInputSchema.parse(input);

  const codigoManual = datosValidados.codigo?.trim().toUpperCase();

  // 3. Normalizar las delegaciones seleccionadas (sin duplicados)
  const delegacionIds = Array.from(new Set(datosValidados.delegacionIds ?? []));

  // 4. Preparar payload de persistencia transaccional.
  //    La unicidad del código y la existencia de las delegaciones activas se
  //    validan dentro de la misma transacción en el repositorio, evitando
  //    condiciones de carrera (TOCTOU) entre la verificación y el INSERT.
  const datosParaInsertar: DatosCrearEventoAtpRepo = {
    codigo: codigoManual,
    nombre: datosValidados.nombre,
    descripcion: datosValidados.descripcion,
    tipoAmenaza: datosValidados.tipoAmenaza,
    nivelAlerta: datosValidados.nivelAlerta,
    fechaInicio: new Date(datosValidados.fechaInicio),
    fechaTermino: new Date(datosValidados.fechaTermino),
    delegacionIds,
    creadoPorId: usuario.id,
  };

  const { evento, delegaciones } =
    await insertarEventoAtpConDelegaciones(datosParaInsertar);

  const respuesta = mapearEventoAtp(evento, delegaciones);

  // 5. Notificar en tiempo real a las salas operativas y administrativas
  emitirEventoAtpCreado(respuesta);

  return respuesta;
}

/* ==========================================================================
   H60 - Listado y detalle de Eventos ATP
   ========================================================================== */

/**
 * Permisos que habilitan la consulta estratégica/operativa de Eventos ATP.
 * `eventos_atp:vincular` es el permiso principal del módulo; los demás
 * permiten que perfiles como SUPERVISOR, Encargado o Asistente Social
 * consulten el catálogo sin recibir un 403 indebido.
 */
const PERMISOS_CONSULTA_EVENTO_ATP = [
  PERMISO_VINCULAR_EVENTO_ATP,
  PERMISO_LEER_MISION,
  PERMISO_KANBAN_INCIDENTES,
  PERMISO_LEER_ASISTENCIA_SOCIAL,
  PERMISO_CREAR_EVENTO_ATP,
];

const MENSAJE_ACCESO_DENEGADO_CONSULTA_ATP =
  "Acceso denegado. Se requiere el permiso 'eventos_atp:vincular' o un permiso de consulta del módulo Eventos ATP.";

/**
 * Lista Eventos ATP con filtros y paginación.
 * El conteo de entidades vinculadas se obtiene con una consulta agrupada,
 * evitando el patrón N+1.
 */
export async function listarEventosAtpService(
  query: ListarEventosAtpQuery,
  usuarioId: string
): Promise<ListarEventosAtpResponse> {
  await seguridadService.validarAccesoRoles(
    usuarioId,
    PERMISOS_CONSULTA_EVENTO_ATP,
    MENSAJE_ACCESO_DENEGADO_CONSULTA_ATP
  );

  const filtros = ListarEventosAtpQuerySchema.parse(query);
  const { page, limit, ...filtrosRepo } = filtros;

  const { eventos, delegaciones, total } = await listarEventosAtpPaginadosRepo(
    filtrosRepo,
    { page, limit }
  );

  const conteos = await contarVinculosPorEventoAtp(
    eventos.map((evento) => evento.id)
  );

  const data: EventoAtpResumen[] = eventos.map((evento) => ({
    ...mapearEventoAtp(evento, delegaciones.get(evento.id) ?? []),
    totalVinculados: conteos.get(evento.id) ?? 0,
  }));

  return {
    message: "Listado de Eventos ATP obtenido exitosamente.",
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Obtiene el detalle de un Evento ATP con sus entidades vinculadas.
 */
export async function obtenerEventoAtpDetalleService(
  id: string,
  usuarioId: string
): Promise<EventoAtpDetalle> {
  await seguridadService.validarAccesoRoles(
    usuarioId,
    PERMISOS_CONSULTA_EVENTO_ATP,
    MENSAJE_ACCESO_DENEGADO_CONSULTA_ATP
  );

  const registro = await obtenerEventoAtpPorId(id);

  if (!registro) {
    throw new NotFoundError(`El Evento ATP '${id}' no existe en el sistema.`);
  }

  const vinculos = await obtenerVinculosEventoAtp(id);
  const totalVinculados =
    vinculos.incidentes.length +
    vinculos.eventosPrevencion.length +
    vinculos.recuperaciones.length +
    vinculos.eventosAsistenciaSocial.length;

  return {
    ...mapearEventoAtp(registro.evento, registro.delegaciones),
    vinculos,
    totalVinculados,
  };
}
