import { geocodificarDireccion } from "@/modules/geolocalizacion/geocoding.service";
import {
  insertarAvisoIncidente,
  buscarAvisoDuplicadoCercano,
  buscarAvisoPorCodigo,
} from "./aviso-incidente.repository";
import {
  normalizarRutChileno,
  generarCodigoSeguimientoNumerico,
} from "./aviso-incidente.utils";
import type {
  CrearAvisoIncidenteInput,
  AvisoIncidenteResponse,
  ConsultaSeguimientoResponse,
} from "./aviso-incidente.schema";
import type { EstadoIncidente } from "@/lib/db/types";

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
    // Insertamos registro vinculado al informante con es_duplicado: true
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
    estado: "REPORTADO",
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
    esDuplicado: false,
  };
}
