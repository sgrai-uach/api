import {
  emitirAvisoDescartado,
  emitirAvisoVerificado,
  emitirNuevoAviso,
  notificarIncidenteCreado,
} from "../../lib/socket";
import { incidentesRepository, IncidentesRepository } from "./repository";
import type {
  CrearAvisoInput,
  DescartarAvisoInput,
  ListarAvisosQuery,
  VerificarAvisoInput,
} from "./schema";
import type {
  AvisoDetalleDTO,
  AvisoItemDTO,
  PaginacionResultado,
  OrigenReporte,
  EstadoAviso,
} from "./types";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class IncidentesService {
  constructor(private repo: IncidentesRepository = incidentesRepository) {}

  /**
   * Calcula los minutos transcurridos desde la creación hasta el momento actual.
   */
  calcularMinutosEnEspera(creadoEn: Date | string): number {
    const fecha = typeof creadoEn === "string" ? new Date(creadoEn) : creadoEn;
    const diffMs = Date.now() - fecha.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  /**
   * Registra un nuevo aviso emitido por un informante y notifica a los operadores.
   */
  async crearAviso(input: CrearAvisoInput) {
    const row = await this.repo.insertarAviso(input);

    const avisoItem: AvisoItemDTO = {
      id: row.id,
      codigoSeguimiento: row.codigo_seguimiento,
      tipoAfectacion: row.tipo_afectacion,
      tipoPreliminarNombre: row.tipo_afectacion,
      direccionTexto: row.direccion_texto,
      descripcion: row.descripcion,
      latitud: Number(row.latitud),
      longitud: Number(row.longitud),
      informanteNombre: row.informante_nombre,
      informanteRut: row.informante_rut,
      informanteTelefono: row.informante_telefono,
      origenReporte: row.origen_reporte as OrigenReporte,
      estado: row.estado as EstadoAviso,
      esDuplicado: row.es_duplicado,
      avisoOriginalId: row.aviso_original_id,
      motivoDescarte: row.motivo_descarte ?? null,
      operadorId: row.operador_id ?? null,
      incidenteId: row.incidente_id ?? null,
      delegacionNombre: row.delegacion_manual || null,
      minutosEnEspera: 0,
      creadoEn: new Date(row.creado_en).toISOString(),
      actualizadoEn: new Date(row.actualizado_en).toISOString(),
    };

    // Emitir evento en tiempo real
    emitirNuevoAviso(avisoItem as unknown as Record<string, unknown>);

    return avisoItem;
  }

  /**
   * Consulta paginada de avisos ordenados por mayor tiempo de espera
   * aplicando filtros multicriterio (delegación, estado, búsqueda y canal de origen).
   */
  async listarAvisos(
    query: ListarAvisosQuery
  ): Promise<PaginacionResultado<AvisoItemDTO>> {
    const { rows, total } = await this.repo.obtenerAvisosPaginados(query);

    const data: AvisoItemDTO[] = rows.map((row) => ({
      id: row.id,
      codigoSeguimiento: row.codigoSeguimiento,
      tipoAfectacion: row.tipoAfectacion,
      tipoPreliminarNombre: row.tipoPreliminarNombre,
      direccionTexto: row.direccionTexto,
      descripcion: row.descripcion,
      latitud: Number(row.latitud),
      longitud: Number(row.longitud),
      informanteNombre: row.informanteNombre,
      informanteRut: row.informanteRut,
      informanteTelefono: row.informanteTelefono,
      origenReporte: row.origenReporte as OrigenReporte,
      estado: row.estado as EstadoAviso,
      esDuplicado: row.esDuplicado,
      avisoOriginalId: row.avisoOriginalId,
      motivoDescarte: row.motivoDescarte ?? null,
      operadorId: row.operadorId ?? null,
      incidenteId: row.incidenteId ?? null,
      delegacionNombre: row.delegacionNombre ?? null,
      minutosEnEspera: this.calcularMinutosEnEspera(row.creadoEn),
      creadoEn: new Date(row.creadoEn).toISOString(),
      actualizadoEn: new Date(row.actualizadoEn).toISOString(),
    }));

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      message: "Avisos obtenidos exitosamente",
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    };
  }

  /**
   * Consulta el detalle completo de un aviso por su ID.
   */
  async obtenerDetalleAviso(id: string): Promise<AvisoDetalleDTO> {
    const row = await this.repo.obtenerAvisoPorId(id);

    if (!row) {
      throw new NotFoundError(`Aviso con ID ${id} no encontrado`);
    }

    return {
      id: row.id,
      codigoSeguimiento: row.codigoSeguimiento,
      tipoAfectacion: row.tipoAfectacion,
      tipoPreliminarNombre: row.tipoPreliminarNombre,
      direccionTexto: row.direccionTexto,
      descripcion: row.descripcion,
      latitud: Number(row.latitud),
      longitud: Number(row.longitud),
      informanteNombre: row.informanteNombre,
      informanteRut: row.informanteRut,
      informanteTelefono: row.informanteTelefono,
      origenReporte: row.origenReporte as OrigenReporte,
      estado: row.estado as EstadoAviso,
      esDuplicado: row.esDuplicado,
      avisoOriginalId: row.avisoOriginalId,
      motivoDescarte: row.motivoDescarte ?? null,
      operadorId: row.operadorId ?? null,
      incidenteId: row.incidenteId ?? null,
      delegacionNombre: row.delegacionNombre ?? null,
      minutosEnEspera: this.calcularMinutosEnEspera(row.creadoEn),
      creadoEn: new Date(row.creadoEn).toISOString(),
      actualizadoEn: new Date(row.actualizadoEn).toISOString(),
      datosInformante: row.datosInformante,
      adjuntos: (row.adjuntos || []).map((adj) => ({
        id: adj.id,
        nombreArchivo: adj.nombreArchivo,
        url: adj.url,
        tipoMime: adj.tipoMime,
        tamanoBytes: Number(adj.tamanoBytes),
        creadoEn: new Date(adj.creadoEn).toISOString(),
      })),
    };
  }

  /**
   * Procesa la acción "Verificar y Enviar" atómicamente a Incidente.
   */
  async verificarAviso(
    avisoId: string,
    input: VerificarAvisoInput,
    operadorId: string
  ) {
    try {
      const resultado = await this.repo.verificarYCrearIncidenteTrx(
        avisoId,
        input,
        operadorId
      );

      // Notificar vía Socket.io a Call Center y Encargado
      emitirAvisoVerificado({
        avisoId,
        incidenteId: resultado.incidente.id,
        folio: resultado.incidente.folio ?? resultado.incidente.codigo,
      });

      // Notificar en tiempo real al Centro de Mando (Encargados)
      const fechaIncidenteStr =
        typeof resultado.incidente.creado_en === "string"
          ? resultado.incidente.creado_en
          : resultado.incidente.creado_en.toISOString();

      notificarIncidenteCreado({
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo || resultado.incidente.folio,
        tipoAfectacion: resultado.incidente.tipo_afectacion || "Afectación no especificada",
        direccion: resultado.incidente.direccion_texto || "Dirección no especificada",
        latitud: Number(resultado.incidente.latitud),
        longitud: Number(resultado.incidente.longitud),
        estado: "REPORTADO",
        prioridad: (resultado.incidente.prioridad as "BAJA" | "MEDIA" | "ALTA" | "CRITICA" | undefined) || "MEDIA",
        requiereAsistenciaSocial: Boolean(resultado.incidente.requiere_asistencia_social),
        creadoEn: fechaIncidenteStr,
      });

      return {
        mensaje: "Aviso verificado exitosamente y promovido a Incidente",
        avisoId,
        incidenteId: resultado.incidente.id,
        folio: resultado.incidente.folio,
        estado: resultado.incidente.estado,
        incidente: {
          id: resultado.incidente.id,
          folio: resultado.incidente.folio,
          tipoIncidenteId: resultado.incidente.tipo_incidente_id,
          estado: resultado.incidente.estado,
          descripcion: resultado.incidente.descripcion,
          latitud: Number(resultado.incidente.latitud),
          longitud: Number(resultado.incidente.longitud),
          requiereAsistenciaSocial: resultado.incidente.requiere_asistencia_social,
          creadoPorId: resultado.incidente.creado_por_id,
          creadoEn: new Date(resultado.incidente.creado_en).toISOString(),
        },
        aviso: {
          id: resultado.aviso.id,
          estado: resultado.aviso.estado,
          incidenteId: resultado.aviso.incidente_id,
          operadorId: resultado.aviso.operador_id,
          actualizadoEn: new Date(resultado.aviso.actualizado_en).toISOString(),
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "AVISO_NOT_FOUND") {
          throw new NotFoundError(`Aviso con ID ${avisoId} no encontrado`);
        }
        if (error.message === "AVISO_ALREADY_PROCESSED") {
          throw new ConflictError(
            "El aviso ya fue procesado o verificado previamente por otro operador"
          );
        }
      }
      throw error;
    }
  }

  /**
   * Descarta un aviso con justificación obligatoria.
   */
  async descartarAviso(
    avisoId: string,
    input: DescartarAvisoInput,
    operadorId: string
  ) {
    try {
      const actualizado = await this.repo.descartarAviso(
        avisoId,
        input.motivoDescarte,
        operadorId
      );

      emitirAvisoDescartado({
        avisoId,
        motivoDescarte: input.motivoDescarte,
      });

      return {
        mensaje: "Aviso descartado exitosamente",
        avisoId,
        aviso: {
          id: actualizado.id,
          estado: actualizado.estado,
          motivoDescarte: actualizado.motivo_descarte,
          operadorId: actualizado.operador_id,
          actualizadoEn: new Date(actualizado.actualizado_en).toISOString(),
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "AVISO_NOT_FOUND") {
          throw new NotFoundError(`Aviso con ID ${avisoId} no encontrado`);
        }
        if (error.message === "AVISO_ALREADY_PROCESSED") {
          throw new ConflictError(
            "El aviso ya fue procesado o descartado previamente"
          );
        }
      }
      throw error;
    }
  }

  /**
   * Obtiene todos los tipos de incidente habilitados en el sistema.
   */
  async listarTiposIncidentes() {
    const tipos = await this.repo.obtenerTiposIncidentes();
    return tipos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      activo: t.activo,
      creadoEn: t.creado_en ? new Date(t.creado_en).toISOString() : null,
    }));
  }
}

export const incidentesService = new IncidentesService();
