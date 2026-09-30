import { geocodificarDireccion } from "@/modules/geolocalizacion/geocoding.service";
import * as repository from "./aviso-incidente.repository";
import {
  normalizarRutChileno,
  generarCodigoSeguimientoNumerico,
} from "./aviso-incidente.utils";
import {
  notificarActualizacionSeguimiento,
  notificarIncidenteCreado,
  notificarIncidenteActualizado,
  emitirNuevoAviso,
} from "@/lib/socket";
import {
  DETALLE_ESTADOS_SEGUIMIENTO,
  type CrearAvisoIncidenteInput,
  type AvisoIncidenteResponse,
  type ConsultaSeguimientoResponse,
  type EstadoIncidente,
  type CrearIncidenteManualInput,
  type CrearIncidenteManualResponse,
  type VerificarDuplicadoInput,
  type VerificarDuplicadoResponse,
} from "./aviso-incidente.schema";

export async function registrarAvisoDesdeChatbot(
  input: CrearAvisoIncidenteInput
): Promise<AvisoIncidenteResponse> {
  const rutNormalizado = normalizarRutChileno(input.informanteRut);

  // 1. Determinar coordenadas geográficas (usar provistas o geocodificar la dirección en Valdivia)
  const coordenadas =
    input.latitud != null && input.longitud != null
      ? { latitud: input.latitud, longitud: input.longitud }
      : await geocodificarDireccion(input.direccion);

  // 2. Comprobar si ya existe un reporte similar cercano (radio de 300m, ventana de 24 horas)
  const duplicadoExistente = await repository.buscarIncidenteDuplicadoCercano({
    tipoAfectacion: input.tipoAfectacion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    radioMetros: 300,
    horasVentana: 24,
  });

  // 3. Caso A: Se detectó duplicado (SAESA-style)
  if (duplicadoExistente) {
    const registroDuplicado = await repository.insertarIncidenteDesdeChatbot({
      codigo_seguimiento: duplicadoExistente.codigo_seguimiento,
      tipo_afectacion: input.tipoAfectacion,
      direccion_texto: input.direccion,
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      descripcion: input.descripcion ?? null,
      informante_nombre: input.informanteNombre,
      informante_rut: rutNormalizado,
      informante_telefono: input.informanteTelefono ?? null,
      origen_reporte: input.origenReporte ?? "CHATBOT",
      estado: "PENDIENTE_VERIFICACION",
      es_duplicado: true,
      aviso_original_id: duplicadoExistente.id,
    });

    const fechaCreadoStr =
      typeof registroDuplicado.creado_en === "string"
        ? registroDuplicado.creado_en
        : registroDuplicado.creado_en.toISOString();

    // Notificar en tiempo real a los operadores del Call Center
    emitirNuevoAviso({
      id: registroDuplicado.id,
      codigoSeguimiento: duplicadoExistente.codigo_seguimiento,
      tipoAfectacion: registroDuplicado.tipo_afectacion,
      tipoPreliminarNombre: registroDuplicado.tipo_afectacion,
      direccionTexto: registroDuplicado.direccion_texto,
      descripcion: registroDuplicado.descripcion,
      latitud: Number(registroDuplicado.latitud),
      longitud: Number(registroDuplicado.longitud),
      informanteNombre: registroDuplicado.informante_nombre,
      informanteRut: registroDuplicado.informante_rut,
      informanteTelefono: registroDuplicado.informante_telefono,
      origenReporte: registroDuplicado.origen_reporte,
      estado: registroDuplicado.estado,
      esDuplicado: true,
      avisoOriginalId: duplicadoExistente.id,
      motivoDescarte: null,
      operadorId: null,
      incidenteId: null,
      minutosEnEspera: 0,
      creadoEn: fechaCreadoStr,
      actualizadoEn: fechaCreadoStr,
    });

    return {
      id: registroDuplicado.id,
      codigoSeguimiento: duplicadoExistente.codigo_seguimiento,
      esDuplicado: true,
      mensaje:
        "Este incidente ya ha sido reportado previamente en esta zona. Se ha asociado su reporte al número de seguimiento existente.",
      tipoAfectacion: registroDuplicado.tipo_afectacion,
      direccion: registroDuplicado.direccion_texto,
      estado: registroDuplicado.estado === "PENDIENTE_VERIFICACION" ? "REPORTADO" : registroDuplicado.estado,
      creadoEn: fechaCreadoStr,
      avisoOriginalId: duplicadoExistente.id,
    };
  }

  // 4. Caso B: Reporte nuevo
  const nuevoCodigo = generarCodigoSeguimientoNumerico();
  const nuevoRegistro = await repository.insertarIncidenteDesdeChatbot({
    codigo_seguimiento: nuevoCodigo,
    tipo_afectacion: input.tipoAfectacion,
    direccion_texto: input.direccion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    descripcion: input.descripcion ?? null,
    informante_nombre: input.informanteNombre,
    informante_rut: rutNormalizado,
    informante_telefono: input.informanteTelefono ?? null,
    origen_reporte: input.origenReporte ?? "CHATBOT",
    estado: "PENDIENTE_VERIFICACION",
    es_duplicado: false,
    aviso_original_id: null,
  });

  const fechaCreadoStr =
    typeof nuevoRegistro.creado_en === "string"
      ? nuevoRegistro.creado_en
      : nuevoRegistro.creado_en.toISOString();

  // Notificar en tiempo real a la bandeja de recepción de Call Center
  emitirNuevoAviso({
    id: nuevoRegistro.id,
    codigoSeguimiento: nuevoRegistro.codigo_seguimiento,
    tipoAfectacion: nuevoRegistro.tipo_afectacion,
    tipoPreliminarNombre: nuevoRegistro.tipo_afectacion,
    direccionTexto: nuevoRegistro.direccion_texto,
    descripcion: nuevoRegistro.descripcion,
    latitud: Number(nuevoRegistro.latitud),
    longitud: Number(nuevoRegistro.longitud),
    informanteNombre: nuevoRegistro.informante_nombre,
    informanteRut: nuevoRegistro.informante_rut,
    informanteTelefono: nuevoRegistro.informante_telefono,
    origenReporte: nuevoRegistro.origen_reporte,
    estado: nuevoRegistro.estado,
    esDuplicado: false,
    avisoOriginalId: null,
    motivoDescarte: null,
    operadorId: null,
    incidenteId: null,
    minutosEnEspera: 0,
    creadoEn: fechaCreadoStr,
    actualizadoEn: fechaCreadoStr,
  });

  return {
    id: nuevoRegistro.id,
    codigoSeguimiento: nuevoRegistro.codigo_seguimiento,
    esDuplicado: false,
    mensaje: "Aviso de incidente registrado exitosamente. Guarde su número de seguimiento.",
    tipoAfectacion: nuevoRegistro.tipo_afectacion,
    direccion: nuevoRegistro.direccion_texto,
    estado: nuevoRegistro.estado === "PENDIENTE_VERIFICACION" ? "REPORTADO" : nuevoRegistro.estado,
    creadoEn: fechaCreadoStr,
    avisoOriginalId: null,
  };
}

/**
 * Permite a cualquier ciudadano informante consultar el estado de avance de su incidente
 * a partir de su código de seguimiento numérico de 8 dígitos.
 * Retorna datos completamente sanitizados (sin PII) y descripciones comprensibles sin tecnicismos.
 */
export async function consultarSeguimientoPorCodigo(
  codigoSeguimiento: string
): Promise<ConsultaSeguimientoResponse | null> {
  const incidente = await repository.buscarIncidentePorCodigoSeguimiento(codigoSeguimiento);
  if (!incidente) {
    return null;
  }

  // Mapear estado a catálogo amigable para el ciudadano
  const estadoClave: EstadoIncidente =
    incidente.estado in DETALLE_ESTADOS_SEGUIMIENTO
      ? (incidente.estado as EstadoIncidente)
      : "REPORTADO";

  const detalleEstado = DETALLE_ESTADOS_SEGUIMIENTO[estadoClave];

  return {
    codigoSeguimiento: incidente.codigo_seguimiento,
    estado: estadoClave,
    estadoEtiqueta: detalleEstado.etiqueta,
    estadoDescripcion: detalleEstado.descripcion,
    tipoAfectacion: incidente.tipo_afectacion,
    direccionAproximada: incidente.direccion_texto,
    descripcion: incidente.descripcion,
    creadoEn:
      typeof incidente.creado_en === "string"
        ? incidente.creado_en
        : incidente.creado_en.toISOString(),
    actualizadoEn:
      typeof incidente.actualizado_en === "string"
        ? incidente.actualizado_en
        : incidente.actualizado_en.toISOString(),
    esDuplicado: false,
  };
}

export class ConflictoDuplicadoError extends Error {
  public coincidencias: unknown[];

  constructor(mensaje: string, coincidencias: unknown[]) {
    super(mensaje);
    this.name = "ConflictoDuplicadoError";
    this.coincidencias = coincidencias;
  }
}

/**
 * Permite al Call Center consultar si una dirección y tipo de afectación ya tiene
 * reportes o incidentes cercanos registrados, para alertar visualmente en el formulario.
 */
export async function verificarDuplicadosManual(
  input: VerificarDuplicadoInput
): Promise<VerificarDuplicadoResponse> {
  const coordenadas =
    input.latitud != null && input.longitud != null
      ? { latitud: input.latitud, longitud: input.longitud }
      : await geocodificarDireccion(input.direccion);

  const coincidencias = await repository.buscarIncidentesYDuplicadosCercanos({
    tipoAfectacion: input.tipoAfectacion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    radioMetros: input.radioMetros ?? 300,
    horasVentana: input.horasVentana ?? 24,
  });

  return {
    hayDuplicados: coincidencias.length > 0,
    coincidencias,
  };
}

/**
 * Registra manualmente un incidente desde Call Center o funcionario en terreno.
 * Valida o resuelve coordenadas, verifica duplicados a menos que se fuerce la creación,
 * y en una sola transacción atómica inserta informante e incidente con estado REPORTADO.
 */
export async function crearIncidenteManual(
  input: CrearIncidenteManualInput,
  operadorId: string
): Promise<CrearIncidenteManualResponse> {
  const rutNormalizado = normalizarRutChileno(input.informanteRut);

  // 1. Resolver georreferenciación (coordenadas provistas o geocodificación automática en Valdivia)
  const coordenadas =
    input.latitud != null && input.longitud != null
      ? { latitud: input.latitud, longitud: input.longitud }
      : await geocodificarDireccion(input.direccion);

  // 2. Control de duplicados si no se indicó explícitamente forzarCreacion
  if (!input.forzarCreacion) {
    const coincidencias = await repository.buscarIncidentesYDuplicadosCercanos({
      tipoAfectacion: input.tipoAfectacion,
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      radioMetros: 300,
      horasVentana: 24,
    });

    if (coincidencias.length > 0) {
      throw new ConflictoDuplicadoError(
        "Se detectaron incidentes o reportes similares en la misma zona recientemente.",
        coincidencias
      );
    }
  }

  // 3. Transacción atómica: insertar informante e incidente en estado REPORTADO
  const resultado = await repository.insertarIncidenteManualTransaccional({
    origenReporte: input.origenReporte,
    tipoAfectacion: input.tipoAfectacion,
    descripcion: input.descripcion,
    direccion: input.direccion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    informanteNombre: input.informanteNombre,
    informanteRut: rutNormalizado,
    informanteTelefono: input.informanteTelefono ?? null,
    asteriskCallId: input.asteriskCallId ?? null,
    asteriskCallerPhone: input.asteriskCallerPhone ?? null,
    prioridad: input.prioridad ?? "MEDIA",
    requiereAsistenciaSocial: input.requiereAsistenciaSocial ?? false,
    esDuplicado: input.forzarCreacion,
    operadorId,
  });

  const fechaIncidenteStr =
    typeof resultado.incidente.creado_en === "string"
      ? resultado.incidente.creado_en
      : resultado.incidente.creado_en.toISOString();

  // 4. Emitir evento en tiempo real vía Socket.io a los encargados
  notificarIncidenteCreado({
    id: resultado.incidente.id,
    codigo: resultado.incidente.codigo,
    tipoAfectacion: resultado.incidente.tipo_afectacion,
    direccion: resultado.incidente.direccion_texto,
    latitud: Number(resultado.incidente.latitud),
    longitud: Number(resultado.incidente.longitud),
    estado: resultado.incidente.estado,
    prioridad: resultado.incidente.prioridad,
    requiereAsistenciaSocial: resultado.incidente.requiere_asistencia_social,
    creadoEn: fechaIncidenteStr,
  });

  return {
    mensaje: "Incidente ingresado exitosamente y disponible para el Encargado.",
    incidente: {
      id: resultado.incidente.id,
      codigo: resultado.incidente.codigo,
      codigoSeguimiento: resultado.incidente.codigo_seguimiento,
      tipoAfectacion: resultado.incidente.tipo_afectacion,
      descripcion: resultado.incidente.descripcion ?? "",
      direccion: resultado.incidente.direccion_texto,
      latitud: Number(resultado.incidente.latitud),
      longitud: Number(resultado.incidente.longitud),
      estado: resultado.incidente.estado as "REPORTADO" | "VERIFICANDO" | "EN_ATENCION" | "NO_ABORDABLE" | "RESUELTO",
      prioridad: resultado.incidente.prioridad,
      requiereAsistenciaSocial: resultado.incidente.requiere_asistencia_social,
      avisoOrigenId:
        (resultado.incidente as { aviso_origen_id?: string }).aviso_origen_id ??
        resultado.incidente.id,
      creadoPorId: resultado.incidente.creado_por_id,
      creadoEn: fechaIncidenteStr,
    },
    aviso: {
      id: resultado.aviso.id,
      codigoSeguimiento: resultado.aviso.codigo_seguimiento,
      esDuplicado: resultado.aviso.es_duplicado,
      mensaje: "Aviso verificado implícitamente por operador de Call Center / Funcionario.",
      tipoAfectacion: resultado.aviso.tipo_afectacion,
      direccion: resultado.aviso.direccion_texto,
      estado: resultado.aviso.estado,
      creadoEn:
        typeof resultado.aviso.creado_en === "string"
          ? resultado.aviso.creado_en
          : resultado.aviso.creado_en.toISOString(),
      avisoOriginalId: resultado.aviso.aviso_original_id,
    },
  };
}

// Alias de compatibilidad
export const consultarAvisoPorSeguimiento = consultarSeguimientoPorCodigo;

/**
 * Cambia el estado de un incidente (por ID o código de seguimiento)
 * y notifica automáticamente en tiempo real vía Socket.io a la sala del informante.
 */
export async function cambiarEstadoIncidente(
  idOIdCodigo: string,
  nuevoEstado: EstadoIncidente
) {
  const actualizado = await repository.actualizarEstadoIncidente(idOIdCodigo, nuevoEstado);
  if (!actualizado) {
    return null;
  }

  const detalle = DETALLE_ESTADOS_SEGUIMIENTO[nuevoEstado];
  const actualizadoEnStr =
    typeof actualizado.actualizado_en === "string"
      ? actualizado.actualizado_en
      : actualizado.actualizado_en.toISOString();

  // Emitir a la sala de seguimiento del ciudadano
  notificarActualizacionSeguimiento({
    codigoSeguimiento: actualizado.codigo_seguimiento,
    estado: nuevoEstado,
    estadoEtiqueta: detalle.etiqueta,
    estadoDescripcion: detalle.descripcion,
    actualizadoEn: actualizadoEnStr,
  });

  // Emitir a la sala de encargados para sincronización en tiempo real del Kanban
  notificarIncidenteActualizado({
    id: actualizado.id,
    codigo: actualizado.codigo,
    nuevoEstado: actualizado.estado,
    prioridad: actualizado.prioridad,
    actualizadoEn: actualizadoEnStr,
  });

  return actualizado;
}
