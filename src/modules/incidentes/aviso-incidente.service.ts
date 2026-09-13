import { geocodificarDireccion } from "@/modules/geolocalizacion/geocoding.service";
import {
  insertarAvisoIncidente,
  buscarAvisoDuplicadoCercano,
  buscarAvisoPorCodigo,
  buscarIncidentesYDuplicadosCercanos,
  insertarIncidenteManualTransaccional,
} from "./aviso-incidente.repository";
import {
  normalizarRutChileno,
  generarCodigoSeguimientoNumerico,
} from "./aviso-incidente.utils";
import { notificarIncidenteCreado } from "@/lib/socket";
import type {
  CrearAvisoIncidenteInput,
  AvisoIncidenteResponse,
  ConsultaSeguimientoResponse,
  CrearIncidenteManualInput,
  CrearIncidenteManualResponse,
  VerificarDuplicadoInput,
  VerificarDuplicadoResponse,
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
  const duplicadoExistente = await buscarAvisoDuplicadoCercano({
    tipoAfectacion: input.tipoAfectacion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    radioMetros: 300,
    horasVentana: 24,
  });

  // 3. Caso A: Se detectó duplicado (SAESA-style)
  if (duplicadoExistente) {
    // Insertamos registro secundario con es_duplicado: true vinculado al original para analítica municipal
    const registroDuplicado = await insertarAvisoIncidente({
      codigo_seguimiento: duplicadoExistente.codigo_seguimiento,
      tipo_afectacion: input.tipoAfectacion,
      direccion_texto: input.direccion,
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      descripcion: input.descripcion ?? null,
      informante_nombre: input.informanteNombre,
      informante_rut: rutNormalizado,
      informante_telefono: input.informanteTelefono ?? null,
      estado: duplicadoExistente.estado,
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
  const nuevoRegistro = await insertarAvisoIncidente({
    codigo_seguimiento: nuevoCodigo,
    tipo_afectacion: input.tipoAfectacion,
    direccion_texto: input.direccion,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    descripcion: input.descripcion ?? null,
    informante_nombre: input.informanteNombre,
    informante_rut: rutNormalizado,
    informante_telefono: input.informanteTelefono ?? null,
    estado: "PENDIENTE_VERIFICACION",
    es_duplicado: false,
    aviso_original_id: null,
  });

  return {
    id: nuevoRegistro.id,
    codigoSeguimiento: nuevoRegistro.codigo_seguimiento,
    esDuplicado: false,
    mensaje: "Aviso de incidente registrado exitosamente. Guarde su número de seguimiento.",
    tipoAfectacion: nuevoRegistro.tipo_afectacion,
    direccion: nuevoRegistro.direccion_texto,
    estado: nuevoRegistro.estado,
    creadoEn:
      typeof nuevoRegistro.creado_en === "string"
        ? nuevoRegistro.creado_en
        : nuevoRegistro.creado_en.toISOString(),
    avisoOriginalId: null,
  };
}

export async function consultarAvisoPorSeguimiento(
  codigoSeguimiento: string
): Promise<ConsultaSeguimientoResponse | null> {
  const aviso = await buscarAvisoPorCodigo(codigoSeguimiento);
  if (!aviso) {
    return null;
  }

  return {
    codigoSeguimiento: aviso.codigo_seguimiento,
    estado: aviso.estado,
    tipoAfectacion: aviso.tipo_afectacion,
    direccion: aviso.direccion_texto,
    descripcion: aviso.descripcion,
    creadoEn:
      typeof aviso.creado_en === "string" ? aviso.creado_en : aviso.creado_en.toISOString(),
    esDuplicado: aviso.es_duplicado,
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

  const coincidencias = await buscarIncidentesYDuplicadosCercanos({
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
 * y en una sola transacción atómica inserta el aviso y promueve el incidente en estado SIN_ATENDER.
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
    const coincidencias = await buscarIncidentesYDuplicadosCercanos({
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

  // 3. Transacción atómica: insertar aviso y promover a incidente en estado SIN_ATENDER
  const resultado = await insertarIncidenteManualTransaccional({
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
      tipoAfectacion: resultado.incidente.tipo_afectacion,
      descripcion: resultado.incidente.descripcion,
      direccion: resultado.incidente.direccion_texto,
      latitud: Number(resultado.incidente.latitud),
      longitud: Number(resultado.incidente.longitud),
      estado: resultado.incidente.estado,
      prioridad: resultado.incidente.prioridad,
      requiereAsistenciaSocial: resultado.incidente.requiere_asistencia_social,
      avisoOrigenId: resultado.incidente.aviso_origen_id,
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
