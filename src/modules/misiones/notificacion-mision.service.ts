import {
  actualizarEstadoNotificacionIdempotenteRepo,
  listarMisionesPendientesTerrenoRepo,
  obtenerCuadrillaDeUsuarioRepo,
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
      incidenteId: detalle.incidenteId ?? null,
      patrullaId: detalle.patrullaId ?? null,
      cuadrillaId: detalle.cuadrillaId ?? null,
      tipoUnidad:
        detalle.tipoUnidad ?? (detalle.cuadrillaId ? "CUADRILLA" : "PATRULLA"),
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
 * Servicio para consultar las misiones pendientes de entrega para la patrulla o cuadrilla del usuario autenticado.
 */
export async function listarMisionesPendientesTerrenoService(
  usuarioId: string,
  esAdmin = false,
  patrullaIdQuery?: string | null,
  cuadrillaIdQuery?: string | null,
  rolUsuario?: string | null
): Promise<ListarMisionesPendientesResponse> {
  let destino: { patrullaId?: string; cuadrillaId?: string } | null = null;
  const rolNormalizado = rolUsuario?.toUpperCase() ?? "";
  const priorizarCuadrilla =
    rolNormalizado === "DELEGADO_CUADRILLA" ||
    rolNormalizado.includes("CUADRILLA") ||
    Boolean(cuadrillaIdQuery && !patrullaIdQuery);

  if (esAdmin && patrullaIdQuery) {
    destino = { patrullaId: patrullaIdQuery };
  } else if (esAdmin && cuadrillaIdQuery) {
    destino = { cuadrillaId: cuadrillaIdQuery };
  } else if (priorizarCuadrilla) {
    const cuadrilla =
      typeof obtenerCuadrillaDeUsuarioRepo === "function"
        ? cuadrillaIdQuery
          ? await obtenerCuadrillaDeUsuarioRepo(usuarioId, cuadrillaIdQuery)
          : await obtenerCuadrillaDeUsuarioRepo(usuarioId)
        : null;
    if (cuadrilla) {
      destino = { cuadrillaId: cuadrilla.id };
    } else {
      const patrulla = patrullaIdQuery
        ? await obtenerPatrullaDeUsuarioRepo(usuarioId, patrullaIdQuery)
        : await obtenerPatrullaDeUsuarioRepo(usuarioId);
      if (patrulla) {
        destino = { patrullaId: patrulla.id };
      }
    }
  } else {
    const patrulla = patrullaIdQuery
      ? await obtenerPatrullaDeUsuarioRepo(usuarioId, patrullaIdQuery)
      : await obtenerPatrullaDeUsuarioRepo(usuarioId);
    if (patrulla) {
      destino = { patrullaId: patrulla.id };
    } else {
      const cuadrilla =
        typeof obtenerCuadrillaDeUsuarioRepo === "function"
          ? cuadrillaIdQuery
            ? await obtenerCuadrillaDeUsuarioRepo(usuarioId, cuadrillaIdQuery)
            : await obtenerCuadrillaDeUsuarioRepo(usuarioId)
          : null;
      if (cuadrilla) {
        destino = { cuadrillaId: cuadrilla.id };
      }
    }
  }

  if (!destino) {
    if (esAdmin) {
      return {
        message: "Misiones pendientes obtenidas exitosamente.",
        data: [],
        total: 0,
      };
    }
    throw new ForbiddenError(
      "El usuario autenticado no está asignado a ninguna patrulla verificadora o cuadrilla operativa activa."
    );
  }

  const pendientes = await listarMisionesPendientesTerrenoRepo(
    destino.cuadrillaId ? { cuadrillaId: destino.cuadrillaId } : destino.patrullaId!
  );

  return {
    message: "Misiones pendientes obtenidas exitosamente.",
    data: pendientes,
    total: pendientes.length,
  };
}

