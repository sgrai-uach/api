import {
  actualizarEstadoNotificacionIdempotenteRepo,
  listarMisionesPendientesTerrenoRepo,
  obtenerPatrullaDeUsuarioRepo,
} from "./notificacion-mision.repository";
import type {
  ActualizarEstadoNotificacionResponse,
  ListarMisionesPendientesResponse,
} from "./notificacion-mision.schema";
import { notificarTrazabilidadActualizada } from "@/lib/socket";
import { ForbiddenError } from "@/modules/seguridad/errors";

/**
 * Servicio para procesar el acuse de recibo o lectura de una notificación de misión de terreno.
 * Ejecuta la actualización idempotente y emite la actualización a la Central de Operaciones.
 */
export async function actualizarEstadoNotificacionService(
  notificacionId: string,
  nuevoEstado: "RECIBIDA" | "LEIDA",
  usuarioId: string,
  esAdmin = false
): Promise<ActualizarEstadoNotificacionResponse> {
  const detalle = await actualizarEstadoNotificacionIdempotenteRepo(
    notificacionId,
    nuevoEstado,
    usuarioId,
    esAdmin
  );

  // Emitir evento de trazabilidad a la Central de Operaciones (sala:encargados, encargado, supervisor)
  try {
    notificarTrazabilidadActualizada({
      notificacionId: detalle.id,
      misionId: detalle.misionId,
      patrullaId: detalle.patrullaId,
      estado: detalle.estado,
      intentosEnvio: detalle.intentosEnvio,
      creadaAt: detalle.creadaAt,
      enviadaAt: detalle.enviadaAt,
      recibidaAt: detalle.recibidaAt,
      leidaAt: detalle.leidaAt,
      actualizadoEn: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al emitir notificacion:trazabilidad_actualizada:", error);
  }

  return {
    message: "Estado de notificación actualizado exitosamente.",
    data: detalle,
  };
}

/**
 * Servicio para consultar las misiones pendientes de entrega para la patrulla del usuario autenticado.
 */
export async function listarMisionesPendientesTerrenoService(
  usuarioId: string,
  esAdmin = false,
  patrullaIdQuery?: string | null
): Promise<ListarMisionesPendientesResponse> {
  let patrullaId: string | null = null;

  if (esAdmin && patrullaIdQuery) {
    patrullaId = patrullaIdQuery;
  } else {
    const patrulla = await obtenerPatrullaDeUsuarioRepo(usuarioId);
    if (!patrulla) {
      if (esAdmin) {
        return {
          message: "Misiones pendientes obtenidas exitosamente.",
          data: [],
          total: 0,
        };
      }
      throw new ForbiddenError(
        "El usuario autenticado no está asignado a ninguna patrulla verificadora activa."
      );
    }
    patrullaId = patrulla.id;
  }

  const pendientes = await listarMisionesPendientesTerrenoRepo(patrullaId);

  return {
    message: "Misiones pendientes obtenidas exitosamente.",
    data: pendientes,
    total: pendientes.length,
  };
}
