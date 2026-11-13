import {
  notificarIncidenteActualizado,
  notificarMisionActualizada,
} from "@/lib/socket";
import {
  prioridadRepository,
  PrioridadRepository,
} from "./prioridad.repository";
import type {
  ActualizarPrioridadIncidenteInput,
  ActualizarPrioridadIncidenteResponse,
  CalcularPrioridadInput,
  CalcularPrioridadResponse,
} from "./prioridad.schema";

export class PrioridadService {
  constructor(private repo: PrioridadRepository = prioridadRepository) {}

  /**
   * Calcula la `prioridad_sugerida` a partir del formulario de evaluación en terreno
   * y devuelve el puntaje y factores gatillantes para mostrar en la PWA.
   */
  async calcularPrioridadSugerida(
    incidenteId: string,
    input: CalcularPrioridadInput
  ): Promise<CalcularPrioridadResponse> {
    const data = await this.repo.calcularPrioridadPreliminar(incidenteId, input);

    return {
      message:
        "Prioridad sugerida calculada exitosamente según evaluación de terreno.",
      data,
    };
  }

  /**
   * Procesa la confirmación o modificación de prioridad del incidente y el envío del
   * reporte de evaluación en terreno al Centro de Mando (HU-38):
   * 1. Ejecuta la transacción atómica en base de datos (`incidente`, `reporte_terreno` versionado y `mision_hito`).
   * 2. Emite `incidente:actualizado` y `mision:actualizada` por Socket.io para actualizar el badge de
   *    prioridad en el tablero Kanban y entregar el reporte de evaluación al Centro de Mando.
   */
  async actualizarPrioridadIncidente(
    incidenteId: string,
    usuarioId: string,
    esAdmin = false,
    input: ActualizarPrioridadIncidenteInput
  ): Promise<ActualizarPrioridadIncidenteResponse> {
    const resultado = await this.repo.actualizarPrioridadIncidente(
      incidenteId,
      usuarioId,
      esAdmin,
      input
    );

    // Emisión reactiva en tiempo real hacia el Centro de Mando
    try {
      notificarIncidenteActualizado({
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo,
        nuevoEstado: resultado.incidente.estado,
        prioridad: resultado.incidente.prioridad,
        prioridadSugerida: resultado.incidente.prioridadSugerida,
        justificacionPrioridad: resultado.incidente.justificacionPrioridad,
        requiereAsistenciaSocial: resultado.incidente.requiereAsistenciaSocial,
        verificado: true,
        tipoIncidenteId: resultado.incidente.tipoIncidenteId,
        tipoAfectacion: resultado.incidente.tipoAfectacion ?? undefined,
        justificacion: resultado.incidente.justificacionPrioridad,
        reporteTerreno:
          resultado.reporteTerreno as unknown as Record<string, unknown>,
        actualizadoEn: resultado.incidente.actualizadoEn,
      });

      notificarMisionActualizada({
        misionId: resultado.mision.id,
        codigo: resultado.mision.codigo,
        estado: resultado.mision.estado,
        tipoMision: resultado.mision.tipoMision,
        patrullaId: resultado.mision.patrullaId,
        incidenteId: resultado.incidente.id,
        fechaInicio: resultado.mision.fechaInicio,
        hito: {
          id: resultado.hito.id,
          hito: resultado.hito.hito,
          descripcion: resultado.hito.descripcion,
          registradoPorId: resultado.hito.registradoPorId,
          creadoEn: resultado.hito.creadoEn,
        },
        actualizadoEn: resultado.incidente.actualizadoEn,
      });
    } catch (socketError) {
      console.error(
        "Error no bloqueante al emitir notificación WebSocket tras actualizar prioridad:",
        socketError
      );
    }

    const numeroVersion = resultado.reporteTerreno.versionReporte;
    const mensaje = resultado.reporteTerreno.esRectificacion
      ? `Evaluación en terreno rectificada y prioridad del incidente actualizada exitosamente (Reporte #${numeroVersion} — Rectificación).`
      : `Evaluación en terreno y prioridad del incidente registradas exitosamente (Reporte #${numeroVersion}).`;

    return {
      message: mensaje,
      data: {
        incidente: {
          id: resultado.incidente.id,
          codigo: resultado.incidente.codigo,
          estado: resultado.incidente.estado,
          prioridad: resultado.incidente.prioridad,
          prioridadSugerida: resultado.incidente.prioridadSugerida,
          modificoPrioridadSugerida:
            resultado.incidente.modificoPrioridadSugerida,
          justificacionPrioridad: resultado.incidente.justificacionPrioridad,
          requiereAsistenciaSocial:
            resultado.incidente.requiereAsistenciaSocial,
          actualizadoEn: resultado.incidente.actualizadoEn,
        },
        reporteTerreno: resultado.reporteTerreno,
        hito: resultado.hito,
      },
    };
  }
}

export const prioridadService = new PrioridadService();

