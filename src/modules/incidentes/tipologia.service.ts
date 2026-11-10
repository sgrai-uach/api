import { notificarIncidenteActualizado } from "@/lib/socket";
import { tipologiaRepository, TipologiaRepository } from "./tipologia.repository";
import type {
  ReclasificarTipologiaInput,
  ReclasificarTipologiaResponse,
  TipoIncidenteCatalogoItem,
} from "./tipologia.schema";

export class TipologiaService {
  constructor(private repo: TipologiaRepository = tipologiaRepository) {}

  /**
   * Obtiene la colección completa de tipos de incidente activos en el sistema.
   */
  async listarTipos(): Promise<TipoIncidenteCatalogoItem[]> {
    return await this.repo.listarTiposIncidente();
  }

  /**
   * Procesa la reclasificación tipológica en terreno por la patrulla verificadora:
   * 1. Ejecuta la actualización atómica en base de datos e inserción en mision_hito.
   * 2. Emite el evento WebSocket `incidente:actualizado` hacia la sala de encargados
   *    para refrescar en tiempo real la tarjeta en el tablero Kanban.
   */
  async reclasificarTipologia(
    incidenteId: string,
    usuarioId: string,
    esAdmin = false,
    input: ReclasificarTipologiaInput
  ): Promise<ReclasificarTipologiaResponse> {
    const resultado = await this.repo.reclasificarTipologia(
      incidenteId,
      usuarioId,
      esAdmin,
      input
    );

    // Emisión reactiva al Centro de Mando
    try {
      notificarIncidenteActualizado({
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo,
        nuevoEstado: resultado.incidente.estado,
        prioridad: resultado.incidente.prioridad,
        tipoIncidenteId: resultado.incidente.tipoIncidenteId,
        tipoAfectacion: resultado.incidente.tipoAfectacion,
        justificacion: input.justificacion.trim(),
        actualizadoEn: resultado.incidente.actualizadoEn,
      });
    } catch (socketError) {
      console.error(
        "Error no bloqueante al emitir notificación WebSocket incidente:actualizado:",
        socketError
      );
    }

    return {
      message: "Tipología del incidente reclasificada exitosamente en terreno.",
      data: {
        incidente: resultado.incidente,
        hito: resultado.hito,
      },
    };
  }
}

export const tipologiaService = new TipologiaService();
