export type EstadoAviso = "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO";

export type EstadoIncidente =
  | "Reportado"
  | "Verificando"
  | "En Atención"
  | "No Abordable"
  | "Resuelto";

export type OrigenReporte = "WEB" | "CHATBOT" | "TELEFONO";

export interface DatosInformante {
  nombre?: string;
  telefono?: string;
  rut?: string;
  direccionAproximada?: string;
}

export interface AvisoItemDTO {
  id: string;
  tipoPreliminarId: string | null;
  tipoPreliminarNombre: string | null;
  descripcion: string;
  latitud: number;
  longitud: number;
  origenReporte: OrigenReporte;
  estado: EstadoAviso;
  motivoDescarte: string | null;
  operadorId: string | null;
  incidenteId: string | null;
  minutosEnEspera: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface AvisoDetalleDTO extends AvisoItemDTO {
  datosInformante: DatosInformante;
  adjuntos: Array<{
    id: string;
    nombreArchivo: string;
    url: string;
    tipoMime: string;
    tamanoBytes: number;
    creadoEn: string;
  }>;
}

export interface PaginacionResultado<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
