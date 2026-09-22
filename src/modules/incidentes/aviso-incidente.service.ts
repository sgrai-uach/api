import { geocodificarDireccion } from "@/modules/geolocalizacion/geocoding.service";
import {
  insertarIncidenteDesdeChatbot,
  buscarIncidenteDuplicadoCercano,
  buscarIncidentePorCodigoSeguimiento,
  actualizarEstadoIncidente,
} from "./aviso-incidente.repository";
import {
  normalizarRutChileno,
  generarCodigoSeguimientoNumerico,
} from "./aviso-incidente.utils";
import {
  notificarActualizacionSeguimiento,
  notificarIncidenteCreado,
  notificarIncidenteActualizado,
} from "@/lib/socket";
import {
  DETALLE_ESTADOS_SEGUIMIENTO,
  type CrearAvisoIncidenteInput,
  type AvisoIncidenteResponse,
  type ConsultaSeguimientoResponse,
  type EstadoIncidente,
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
  const duplicadoExistente = await buscarIncidenteDuplicadoCercano({
    tipoAfectacion: input.tipoAfectacion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    radioMetros: 300,
    horasVentana: 24,
  });

  // 3. Caso A: Se detectó duplicado (SAESA-style)
  if (duplicadoExistente) {
    const registroDuplicado = await insertarIncidenteDesdeChatbot({
      codigo_seguimiento: duplicadoExistente.codigo_seguimiento,
      tipo_afectacion: input.tipoAfectacion,
      direccion_texto: input.direccion,
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      descripcion: input.descripcion ?? null,
      informante_nombre: input.informanteNombre,
      informante_rut: rutNormalizado,
      informante_telefono: input.informanteTelefono ?? null,
      estado: duplicadoExistente.estado as EstadoIncidente,
      es_duplicado: true,
      aviso_original_id: duplicadoExistente.id,
    });

    return {
      id: registroDuplicado.id,
      codigoSeguimiento: duplicadoExistente.codigo_seguimiento,
      esDuplicado: true,
      mensaje:
        "Este incidente ya ha sido reportado previamente en esta zona. Se ha asociado su reporte al número de seguimiento existente.",
      tipoAfectacion: registroDuplicado.tipo_afectacion,
      direccion: registroDuplicado.direccion_texto,
      estado: registroDuplicado.estado,
      creadoEn:
        typeof registroDuplicado.creado_en === "string"
          ? registroDuplicado.creado_en
          : registroDuplicado.creado_en.toISOString(),
      avisoOriginalId: duplicadoExistente.id,
    };
  }

  // 4. Caso B: Reporte nuevo
  const nuevoCodigo = generarCodigoSeguimientoNumerico();
  const nuevoRegistro = await insertarIncidenteDesdeChatbot({
    codigo_seguimiento: nuevoCodigo,
    tipo_afectacion: input.tipoAfectacion,
    direccion_texto: input.direccion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    descripcion: input.descripcion ?? null,
    informante_nombre: input.informanteNombre,
    informante_rut: rutNormalizado,
    informante_telefono: input.informanteTelefono ?? null,
    estado: "REPORTADO",
    es_duplicado: false,
    aviso_original_id: null,
  });

  const fechaCreadoStr =
    typeof nuevoRegistro.creado_en === "string"
      ? nuevoRegistro.creado_en
      : nuevoRegistro.creado_en.toISOString();

  // Emisión en tiempo real a la sala de encargados
  notificarIncidenteCreado({
    id: nuevoRegistro.id,
    codigo: nuevoRegistro.codigo,
    tipoAfectacion: nuevoRegistro.tipo_afectacion,
    direccion: nuevoRegistro.direccion_texto,
    latitud: Number(nuevoRegistro.latitud),
    longitud: Number(nuevoRegistro.longitud),
    estado: nuevoRegistro.estado,
    prioridad: nuevoRegistro.prioridad,
    creadoEn: fechaCreadoStr,
  });

  return {
    id: nuevoRegistro.id,
    codigoSeguimiento: nuevoRegistro.codigo_seguimiento,
    esDuplicado: false,
    mensaje: "Aviso de incidente registrado exitosamente. Guarde su número de seguimiento.",
    tipoAfectacion: nuevoRegistro.tipo_afectacion,
    direccion: nuevoRegistro.direccion_texto,
    estado: nuevoRegistro.estado,
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
  const incidente = await buscarIncidentePorCodigoSeguimiento(codigoSeguimiento);
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
  const actualizado = await actualizarEstadoIncidente(idOIdCodigo, nuevoEstado);
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
