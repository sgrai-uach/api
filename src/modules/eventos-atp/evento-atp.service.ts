import { seguridadService } from "@/modules/seguridad/service";
import { PERMISO_CREAR_EVENTO_ATP } from "@/modules/seguridad/permisos.constants";
import { emitirEventoAtpCreado } from "@/lib/socket";
import {
  CrearEventoAtpInputSchema,
  type CrearEventoAtpInput,
  type EventoAtpResponse,
} from "./evento-atp.schema";
import {
  insertarEventoAtpConDelegaciones,
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
