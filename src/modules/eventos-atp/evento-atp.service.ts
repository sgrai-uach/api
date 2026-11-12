import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_CREAR_EVENTO_ATP,
  PERMISO_VINCULAR_EVENTO_ATP,
} from "@/modules/seguridad/permisos.constants";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/modules/seguridad/errors";
import { emitirEventoAtpCreado } from "@/lib/socket";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import {
  CrearEventoAtpInputSchema,
  ListarEventosAtpQuerySchema,
  type CrearEventoAtpInput,
  type EventoAtpResponse,
  type EventoAtpResumen,
  type EventoAtpDetalle,
  type ListarEventosAtpQuery,
  type ListarEventosAtpResponse,
} from "./evento-atp.schema";
import {
  existeCodigoEventoAtp,
  insertarEventoAtpConDelegaciones,
  verificarDelegacionesExisten,
  listarEventosAtpPaginadosRepo,
  obtenerEventoAtpPorId,
  obtenerVinculosEventoAtp,
  contarVinculosEventoAtp,
  type DatosCrearEventoAtpRepo,
  type FilaEventoAtp,
  type FilaDelegacionEventoAtp,
} from "./evento-atp.repository";

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
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_CREAR_EVENTO_ATP,
  ]);

  // 2. Validación estricta del contrato de entrada
  const datosValidados = CrearEventoAtpInputSchema.parse(input);

  const codigoManual = datosValidados.codigo?.trim().toUpperCase();

  // 3. Verificar duplicidad del código manual antes de insertar
  if (codigoManual && (await existeCodigoEventoAtp(codigoManual))) {
    throw new ConflictError(
      `Ya existe un Evento ATP registrado con el código '${codigoManual}'.`
    );
  }

  // 4. Verificar que todas las delegaciones seleccionadas existan
  const delegacionIds = Array.from(new Set(datosValidados.delegacionIds ?? []));
  const { faltantes } = await verificarDelegacionesExisten(delegacionIds);

  if (faltantes.length > 0) {
    throw new BadRequestError(
      `Las siguientes delegaciones no existen en el sistema: ${faltantes.join(", ")}.`
    );
  }

  // 5. Preparar payload de persistencia transaccional
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

  // 6. Notificar en tiempo real a las salas operativas y administrativas
  emitirEventoAtpCreado(respuesta);

  return respuesta;
}

/* ==========================================================================
   H60 - Listado y detalle de Eventos ATP
   ========================================================================== */

/**
 * Lista Eventos ATP con filtros y paginación.
 * Requiere el permiso `eventos_atp:vincular` porque alimenta los selectores
 * de vinculación y el detalle operativo del evento.
 */
export async function listarEventosAtpService(
  query: ListarEventosAtpQuery,
  usuarioId: string
): Promise<ListarEventosAtpResponse> {
  await seguridadService.validarAccesoRoles(usuarioId, [
    PERMISO_VINCULAR_EVENTO_ATP,
  ]);

  const filtros = ListarEventosAtpQuerySchema.parse(query);
  const { page, limit, ...filtrosRepo } = filtros;

  const { eventos, delegaciones, total } = await listarEventosAtpPaginadosRepo(
    filtrosRepo,
    { page, limit }
  );

  const conteos = await Promise.all(
    eventos.map((evento) => contarVinculosEventoAtp(evento.id))
  );

  const data: EventoAtpResumen[] = eventos.map((evento, indice) => ({
    ...mapearEventoAtp(evento, delegaciones.get(evento.id) ?? []),
    totalVinculados: conteos[indice],
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
  await seguridadService.validarAccesoRoles(usuarioId, [
    PERMISO_VINCULAR_EVENTO_ATP,
  ]);

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
