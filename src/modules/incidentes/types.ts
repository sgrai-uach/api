export type EstadoAviso = "PENDIENTE_VERIFICACION" | "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO";

export type EstadoIncidente =
  | "REPORTADO"
  | "VERIFICANDO"
  | "EN_ATENCION"
  | "NO_ABORDABLE"
  | "RESUELTO"
  | "Reportado"
  | "Verificando"
  | "En Atención"
  | "No Abordable"
  | "Resuelto";

export type OrigenReporte = "WEB" | "CHATBOT" | "LLAMADA_TELEFONICA";

export interface DatosInformante {
  nombre?: string;
  telefono?: string;
  rut?: string;
  direccionAproximada?: string;
}

export interface AvisoItemDTO {
  id: string;
  codigoSeguimiento: string;
  tipoAfectacion: string;
  tipoPreliminarNombre: string | null;
  direccionTexto: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  informanteNombre: string;
  informanteRut: string;
  informanteTelefono: string | null;
  origenReporte: OrigenReporte;
  estado: EstadoAviso;
  esDuplicado: boolean;
  avisoOriginalId?: string | null;
  motivoDescarte: string | null;
  operadorId: string | null;
  incidenteId: string | null;
  delegacionNombre: string | null;
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
  message?: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}
