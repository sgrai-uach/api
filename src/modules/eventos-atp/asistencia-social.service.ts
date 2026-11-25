import { verificarPermiso } from "@/modules/seguridad/auth.service";
import {
  PERMISO_CREAR_ASISTENCIA_SOCIAL,
  PERMISO_LEER_ASISTENCIA_SOCIAL,
  PERMISO_GESTIONAR_FIBE,
} from "@/modules/seguridad/permisos.constants";
import {
  emitirAsistenciaSocialCreada,
  emitirAsistenciaSocialActualizada,
  notificarIncidenteActualizado,
} from "@/lib/socket";
import {
  generarSiguienteCodigoAsistenciaSocial,
  insertarEventoAsistenciaSocial,
  listarEventosAsistenciaSocialPaginados,
  contarEventosAsistenciaSocial,
  asignarAsistenteSocialEventoRepo,
  derivarIncidenteAAsistenciaSocialRepo,
  registrarFichaFibeRepo,
  AsistenteSocialRepoError,
  type FilaEventoAsistenciaSocialConRelaciones,
  type DatosInsertarEventoAsistenciaSocialRepo,
} from "./asistencia-social.repository";
import {
  CrearEventoAsistenciaSocialInputSchema,
  ListarEventosAsistenciaSocialQuerySchema,
  AsignarAsistenteSocialInputSchema,
  DerivarAsistenciaSocialIncidenteInputSchema,
  RegistrarFichaFibeInputSchema,
  DetallesEvaluacionSocialSchema,
  type CrearEventoAsistenciaSocialInput,
  type ListarEventosAsistenciaSocialQuery,
  type AsignarAsistenteSocialInput,
  type DerivarAsistenciaSocialIncidenteInput,
  type DerivarAsistenciaSocialIncidenteResponse,
  type RegistrarFichaFibeInput,
  type EventoAsistenciaSocialResponse,
  type ListarEventosAsistenciaSocialResponse,
  type PrioridadEventoAsistenciaSocial,
  type EstadoEventoAsistenciaSocial,
  type DetallesEvaluacionSocial,
  type FamiliaAfectadaSocial,
  type NivelCompromisoViviendaSocial,
} from "./asistencia-social.schema";
import { extraerContactoPrincipalDesdeFamilias } from "@/modules/shared/familia-afectada.schema";

export class EventoAsistenciaSocialNotFoundError extends Error {
  constructor(message = "El evento de asistencia social solicitado no existe.") {
    super(message);
    this.name = "EventoAsistenciaSocialNotFoundError";
  }
}

export class AsistenteSocialNotFoundError extends Error {
  constructor(message = "El asistente social especificado no existe.") {
    super(message);
    this.name = "AsistenteSocialNotFoundError";
  }
}

export class EstadoEventoAsistenciaSocialInvalidoError extends Error {
  constructor(message = "El evento de asistencia social no se encuentra en estado PENDIENTE.") {
    super(message);
    this.name = "EstadoEventoAsistenciaSocialInvalidoError";
  }
}

export class AsistenteSocialNoDisponibleError extends Error {
  constructor(message = "El usuario seleccionado no tiene rol ASISTENTE_SOCIAL o no está disponible.") {
    super(message);
    this.name = "AsistenteSocialNoDisponibleError";
  }
}

export class IncidenteNoEncontradoError extends Error {
  constructor(message = "El incidente especificado no existe.") {
    super(message);
    this.name = "IncidenteNoEncontradoError";
  }
}

export class IncidenteNoElegibleAsistenciaSocialError extends Error {
  constructor(
    message = "El incidente debe estar en estado RESUELTO y registrar afectación o marca de asistencia social."
  ) {
    super(message);
    this.name = "IncidenteNoElegibleAsistenciaSocialError";
  }
}

export class EventoAsistenciaSocialEnProcesoError extends Error {
  constructor(
    message = "El incidente ya posee un evento de asistencia social en evaluación FIBE o finalizado."
  ) {
    super(message);
    this.name = "EventoAsistenciaSocialEnProcesoError";
  }
}

export class FolioFibeDuplicadoError extends Error {
  constructor(
    message = "El folio oficial de Ficha FIBE ya se encuentra registrado en otro expediente."
  ) {
    super(message);
    this.name = "FolioFibeDuplicadoError";
  }
}

/**
 * Deserializa defensivamente la columna JSONB `detalles_evaluacion` desde PostgreSQL.
 * Retorna null cuando el evento fue registrado en modo aproximado o el objeto está vacío.
 */
function parsearDetallesEvaluacionFila(
  raw: Record<string, unknown> | string | null | undefined
): DetallesEvaluacionSocial | null {
  if (!raw) return null;

  let obj: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "{}") return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }

  if (Object.keys(obj as Record<string, unknown>).length === 0) {
    return null;
  }

  const parsed = DetallesEvaluacionSocialSchema.safeParse(obj);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;
  const tieneFamilias = Array.isArray(data.familias) && data.familias.length > 0;
  const tieneContadores =
    (data.cantidadNinos ?? 0) > 0 ||
    (data.cantidadAdultosMayores ?? 0) > 0 ||
    (data.personasDiscapacitadas ?? 0) > 0 ||
    (data.personasElectrodependientes ?? 0) > 0 ||
    (data.mascotasAfectadas ?? 0) > 0;

  if (
    !tieneFamilias &&
    !tieneContadores &&
    !data.nivelCompromisoVivienda &&
    !data.danosEstimados
  ) {
    return null;
  }

  return data;
}

/**
 * Consolida los totales de personas/familias y el objeto `detallesEvaluacion` en el servidor.
 * Regla de negocio: si se ingresan familias en `familias[]`, sus totales descartan y sobrescriben
 * cualquier estimación aproximada previa en `personasAfectadas` y `familiasAfectadas`.
 */
export function consolidarEvaluacionSocialParaPersistencia(
  personasAproximadas: number,
  familiasAproximadas: number,
  detalles?: DetallesEvaluacionSocial | null
): {
  personasAfectadas: number;
  familiasAfectadas: number;
  detallesEvaluacion: DetallesEvaluacionSocial | null;
} {
  if (!detalles) {
    return {
      personasAfectadas: personasAproximadas,
      familiasAfectadas: familiasAproximadas,
      detallesEvaluacion: null,
    };
  }

  const nivelCompromiso = detalles.nivelCompromisoVivienda ?? null;
  const danos = detalles.danosEstimados?.trim() || null;
  const familiasEntrada = Array.isArray(detalles.familias) ? detalles.familias : [];

  if (familiasEntrada.length > 0) {
    const familiasLimpias: FamiliaAfectadaSocial[] = familiasEntrada.map((f) => ({
      ...(f.id?.trim() ? { id: f.id.trim() } : {}),
      ...(f.referencia?.trim() ? { referencia: f.referencia.trim() } : {}),
      nucleoFamiliarTotal: Math.trunc(f.nucleoFamiliarTotal),
      cantidadNinos: Math.trunc(f.cantidadNinos ?? 0),
      cantidadAdultosMayores: Math.trunc(f.cantidadAdultosMayores ?? 0),
      personasDiscapacitadas: Math.trunc(f.personasDiscapacitadas ?? 0),
      personasElectrodependientes: Math.trunc(f.personasElectrodependientes ?? 0),
      mascotasAfectadas: Math.trunc(f.mascotasAfectadas ?? 0),
      ...(f.nivelCompromisoVivienda ? { nivelCompromisoVivienda: f.nivelCompromisoVivienda } : {}),
      ...(f.contactoNombre?.trim() ? { contactoNombre: f.contactoNombre.trim() } : {}),
      ...(f.contactoTelefono?.trim() ? { contactoTelefono: f.contactoTelefono.trim() } : {}),
      ...(f.contactoRut?.trim() ? { contactoRut: f.contactoRut.trim() } : {}),
    }));

    const totales = familiasLimpias.reduce(
      (acc, fam) => ({
        nucleoFamiliarTotal: acc.nucleoFamiliarTotal + fam.nucleoFamiliarTotal,
        cantidadNinos: acc.cantidadNinos + fam.cantidadNinos,
        cantidadAdultosMayores: acc.cantidadAdultosMayores + fam.cantidadAdultosMayores,
        personasDiscapacitadas: acc.personasDiscapacitadas + fam.personasDiscapacitadas,
        personasElectrodependientes:
          acc.personasElectrodependientes + fam.personasElectrodependientes,
        mascotasAfectadas: acc.mascotasAfectadas + fam.mascotasAfectadas,
      }),
      {
        nucleoFamiliarTotal: 0,
        cantidadNinos: 0,
        cantidadAdultosMayores: 0,
        personasDiscapacitadas: 0,
        personasElectrodependientes: 0,
        mascotasAfectadas: 0,
      }
    );

    return {
      personasAfectadas: totales.nucleoFamiliarTotal,
      familiasAfectadas: familiasLimpias.length,
      detallesEvaluacion: {
        familias: familiasLimpias,
        familiasAfectadas: familiasLimpias.length,
        ...totales,
        nivelCompromisoVivienda: nivelCompromiso,
        danosEstimados: danos,
      },
    };
  }

  const tieneContadoresSueltos =
    (detalles.cantidadNinos ?? 0) > 0 ||
    (detalles.cantidadAdultosMayores ?? 0) > 0 ||
    (detalles.personasDiscapacitadas ?? 0) > 0 ||
    (detalles.personasElectrodependientes ?? 0) > 0 ||
    (detalles.mascotasAfectadas ?? 0) > 0;

  if (!nivelCompromiso && !danos && !tieneContadoresSueltos) {
    return {
      personasAfectadas: personasAproximadas,
      familiasAfectadas: familiasAproximadas,
      detallesEvaluacion: null,
    };
  }

  return {
    personasAfectadas: personasAproximadas,
    familiasAfectadas: familiasAproximadas,
    detallesEvaluacion: {
      ...(tieneContadoresSueltos
        ? {
            cantidadNinos: Math.trunc(detalles.cantidadNinos ?? 0),
            cantidadAdultosMayores: Math.trunc(detalles.cantidadAdultosMayores ?? 0),
            personasDiscapacitadas: Math.trunc(detalles.personasDiscapacitadas ?? 0),
            personasElectrodependientes: Math.trunc(detalles.personasElectrodependientes ?? 0),
            mascotasAfectadas: Math.trunc(detalles.mascotasAfectadas ?? 0),
          }
        : {}),
      nivelCompromisoVivienda: nivelCompromiso,
      danosEstimados: danos,
    },
  };
}

/**
 * Mapea una fila de base de datos relacional al formato canónico de respuesta de la API.
 */
export function mapearFilaEventoAsistenciaSocial(
  fila: FilaEventoAsistenciaSocialConRelaciones
): EventoAsistenciaSocialResponse {
  return {
    id: fila.id,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    tipoAfectacion: fila.tipo_afectacion,
    personasAfectadas: Number(fila.personas_afectadas ?? 0),
    familiasAfectadas: Number(fila.familias_afectadas ?? 0),
    direccionTexto: fila.direccion_texto,
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    prioridad: fila.prioridad as PrioridadEventoAsistenciaSocial,
    estado: fila.estado as EstadoEventoAsistenciaSocial,
    contactoNombre: fila.contacto_nombre ?? null,
    contactoTelefono: fila.contacto_telefono ?? null,
    contactoRut: fila.contacto_rut ?? null,
    delegacionId: fila.delegacion_id ?? null,
    delegacionNombre: fila.delegacion_nombre ?? null,
    incidenteId: fila.incidente_id ?? null,
    ...(fila.incidente_codigo !== undefined
      ? { incidenteCodigo: fila.incidente_codigo ?? null }
      : {}),
    asistenteSocialId: fila.asistente_social_id ?? null,
    asistenteSocialNombre: fila.asistente_social_nombre ?? null,
    detallesEvaluacion: parsearDetallesEvaluacionFila(fila.detalles_evaluacion),
    ...(fila.folio_fibe !== undefined ? { folioFibe: fila.folio_fibe ?? null } : {}),
    ...(fila.nivel_dano_vivienda !== undefined
      ? {
          nivelDanoVivienda:
            (fila.nivel_dano_vivienda as NivelCompromisoViviendaSocial | null) ?? null,
        }
      : {}),
    ...(fila.observaciones_fibe !== undefined
      ? { observacionesFibe: fila.observaciones_fibe ?? null }
      : {}),
    ...(fila.fibe_registrada_en !== undefined
      ? {
          fibeRegistradaEn: fila.fibe_registrada_en
            ? fila.fibe_registrada_en instanceof Date
              ? fila.fibe_registrada_en.toISOString()
              : new Date(fila.fibe_registrada_en).toISOString()
            : null,
        }
      : {}),
    ...(fila.fibe_registrada_por_id !== undefined
      ? { fibeRegistradaPorId: fila.fibe_registrada_por_id ?? null }
      : {}),
    creadoPor: {
      id: fila.creado_por_id,
      nombre: fila.creado_por_nombre ?? "Encargado de Operaciones",
    },
    creadoEn:
      fila.creado_en instanceof Date
        ? fila.creado_en.toISOString()
        : new Date(fila.creado_en).toISOString(),
    actualizadoEn:
      fila.actualizado_en instanceof Date
        ? fila.actualizado_en.toISOString()
        : new Date(fila.actualizado_en).toISOString(),
  };
}

/**
 * Servicio para registrar un evento excepcional de asistencia social (H28 / H31 Opción A).
 * - Restringido al rol Encargado (y Administrador) mediante el permiso asistencia_social:crear.
 * - Soporta la creación de eventos sin asociación obligatoria a un incidente.
 * - Soporta asignación opcional inmediata a un asistente social disponible al crear.
 * - Persiste `detallesEvaluacion` y descarta la aproximación cuando se especifican familias.
 * - Genera el correlativo institucional anual único (ej. AS-2026-0001).
 * - Persiste coordenadas PostGIS y emite evento en tiempo real vía Socket.io.
 */
export async function crearEventoAsistenciaSocialService(
  input: CrearEventoAsistenciaSocialInput,
  usuarioId: string
): Promise<EventoAsistenciaSocialResponse> {
  // 1. Control de Acceso RBAC: Requiere permiso asistencia_social:crear
  const usuario = await verificarPermiso(usuarioId, PERMISO_CREAR_ASISTENCIA_SOCIAL);

  // 2. Validar estructura de datos
  const datosValidados = CrearEventoAsistenciaSocialInputSchema.parse(input);

  // 3. Consolidar evaluación demográfica y descartar aproximación si existen familias desglosadas
  const evaluacionConsolidada = consolidarEvaluacionSocialParaPersistencia(
    datosValidados.personasAfectadas,
    datosValidados.familiasAfectadas,
    datosValidados.detallesEvaluacion
  );

  // 4. Generar código correlativo oficial (AS-YYYY-XXXX)
  const codigo = await generarSiguienteCodigoAsistenciaSocial();

  // 5. Preparar payload de inserción (si hay familias, descartar contacto general aproximado y sincronizar raíz desde primera familia con contacto)
  const tieneFamiliasDesglosadas =
    (evaluacionConsolidada.detallesEvaluacion?.familias?.length ?? 0) > 0;
  const contactoDesdeFamilias = tieneFamiliasDesglosadas
    ? extraerContactoPrincipalDesdeFamilias(
        evaluacionConsolidada.detallesEvaluacion?.familias
      )
    : null;

  const datosParaInsertar: DatosInsertarEventoAsistenciaSocialRepo = {
    codigo,
    descripcion: datosValidados.descripcion,
    tipoAfectacion: datosValidados.tipoAfectacion,
    personasAfectadas: evaluacionConsolidada.personasAfectadas,
    familiasAfectadas: evaluacionConsolidada.familiasAfectadas,
    direccionTexto: datosValidados.direccionTexto,
    latitud: datosValidados.latitud,
    longitud: datosValidados.longitud,
    prioridad: datosValidados.prioridad,
    contactoNombre: tieneFamiliasDesglosadas
      ? contactoDesdeFamilias!.contactoNombre
      : datosValidados.contactoNombre,
    contactoTelefono: tieneFamiliasDesglosadas
      ? contactoDesdeFamilias!.contactoTelefono
      : datosValidados.contactoTelefono,
    contactoRut: tieneFamiliasDesglosadas
      ? contactoDesdeFamilias!.contactoRut
      : datosValidados.contactoRut,
    delegacionId: datosValidados.delegacionId,
    incidenteId: datosValidados.incidenteId ?? null,
    asistenteSocialId: datosValidados.asistenteSocialId ?? null,
    detallesEvaluacion: evaluacionConsolidada.detallesEvaluacion,
    creadoPorId: usuario.id,
  };

  // 6. Insertar en base de datos relacional con geometría PostGIS
  let filaInsertada: FilaEventoAsistenciaSocialConRelaciones;
  try {
    filaInsertada = await insertarEventoAsistenciaSocial(datosParaInsertar);
  } catch (err) {
    if (err instanceof AsistenteSocialRepoError) {
      if (err.motivo === "ASISTENTE_NO_ENCONTRADO") {
        throw new AsistenteSocialNotFoundError(err.message);
      }
      throw new AsistenteSocialNoDisponibleError(err.message);
    }
    throw err;
  }

  const respuesta = mapearFilaEventoAsistenciaSocial(filaInsertada);

  // 7. Notificar en tiempo real al panel de eventos pendientes y salas operativas
  emitirAsistenciaSocialCreada(respuesta);

  return respuesta;
}

/**
 * Servicio para listar eventos de asistencia social paginados y filtrados.
 * Utilizado por el panel de eventos pendientes para la asignación de asistentes sociales.
 */
export async function listarEventosAsistenciaSocialService(
  query: ListarEventosAsistenciaSocialQuery,
  usuarioId: string
): Promise<ListarEventosAsistenciaSocialResponse> {
  // 1. Control de Acceso RBAC: Requiere permiso asistencia_social:leer
  await verificarPermiso(usuarioId, PERMISO_LEER_ASISTENCIA_SOCIAL);

  const queryValidada = ListarEventosAsistenciaSocialQuerySchema.parse(query);
  const { pagina, limite, ...filtros } = queryValidada;

  // 2. Consultar registros y totalizador en paralelo
  const [filas, total] = await Promise.all([
    listarEventosAsistenciaSocialPaginados(filtros, { pagina, limite }),
    contarEventosAsistenciaSocial(filtros),
  ]);

  const totalPaginas = Math.ceil(total / limite) || 1;

  return {
    data: filas.map(mapearFilaEventoAsistenciaSocial),
    total,
    pagina,
    limite,
    totalPaginas,
  };
}

/**
 * Servicio para asignar un asistente social disponible a un evento en estado PENDIENTE (H31).
 * - Requiere permiso RBAC `asistencia_social:crear`.
 * - Transiciona atómicamente de PENDIENTE a ASIGNADO.
 * - Emite el evento WebSocket `asistencia_social:actualizada` hacia la sala `asistente_social` y Centro de Mando.
 */
export async function asignarAsistenteSocialService(
  eventoId: string,
  input: AsignarAsistenteSocialInput,
  usuarioId: string
): Promise<EventoAsistenciaSocialResponse> {
  // 1. Control de Acceso RBAC: Requiere permiso asistencia_social:crear
  await verificarPermiso(usuarioId, PERMISO_CREAR_ASISTENCIA_SOCIAL);

  // 2. Validar entrada
  const datosValidados = AsignarAsistenteSocialInputSchema.parse(input);

  // 3. Ejecutar asignación atómica en repositorio
  const resultado = await asignarAsistenteSocialEventoRepo(
    eventoId,
    datosValidados.asistenteSocialId
  );

  if (!resultado.ok) {
    switch (resultado.motivo) {
      case "EVENTO_NO_ENCONTRADO":
        throw new EventoAsistenciaSocialNotFoundError();
      case "ASISTENTE_NO_ENCONTRADO":
        throw new AsistenteSocialNotFoundError();
      case "ESTADO_INVALIDO":
        throw new EstadoEventoAsistenciaSocialInvalidoError(resultado.detalle);
      case "ASISTENTE_NO_ELEGIBLE":
        throw new AsistenteSocialNoDisponibleError(resultado.detalle);
    }
  }

  const respuesta = mapearFilaEventoAsistenciaSocial(resultado.evento);

  // 4. Emitir notificación WebSocket hacia sala asistente_social y Centro de Mando
  emitirAsistenciaSocialActualizada(respuesta);

  return respuesta;
}

function parsearMetadatosHitoDefensivo(
  raw: Record<string, unknown> | string | null | undefined
): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }
  return null;
}

/**
 * Servicio para derivar un incidente RESUELTO con afectación a personas o marca social
 * hacia Asistencia Social, creando o actualizando su registro en `evento_asistencia_social`
 * en estado `ASIGNADO` (HU-25), registrando trazabilidad en `mision_hito` y emitiendo
 * eventos en tiempo real vía Socket.io.
 */
export async function derivarIncidenteAAsistenciaSocialService(
  incidenteId: string,
  input: DerivarAsistenciaSocialIncidenteInput,
  usuarioId: string
): Promise<DerivarAsistenciaSocialIncidenteResponse> {
  // 1. Control de Acceso RBAC: Requiere permiso asistencia_social:crear
  const usuario = await verificarPermiso(usuarioId, PERMISO_CREAR_ASISTENCIA_SOCIAL);

  // 2. Validar payload de entrada
  const datosValidados = DerivarAsistenciaSocialIncidenteInputSchema.parse(input);

  // 3. Ejecutar derivación atómica en repositorio Kysely
  const resultado = await derivarIncidenteAAsistenciaSocialRepo({
    incidenteId,
    asistenteSocialId: datosValidados.asistenteSocialId,
    usuarioId: usuario.id,
    observaciones: datosValidados.observaciones ?? null,
    prioridad: datosValidados.prioridad,
  });

  if (!resultado.ok) {
    switch (resultado.motivo) {
      case "INCIDENTE_NO_ENCONTRADO":
        throw new IncidenteNoEncontradoError(resultado.detalle);
      case "ASISTENTE_NO_ENCONTRADO":
        throw new AsistenteSocialNotFoundError(resultado.detalle);
      case "ASISTENTE_NO_ELEGIBLE":
        throw new AsistenteSocialNoDisponibleError(resultado.detalle);
      case "EVENTO_EN_PROCESO_O_FINALIZADO":
        throw new EventoAsistenciaSocialEnProcesoError(resultado.detalle);
      case "INCIDENTE_NO_RESUELTO":
      case "INCIDENTE_SIN_AFECTACION_SOCIAL":
        throw new IncidenteNoElegibleAsistenciaSocialError(resultado.detalle);
    }
  }

  const eventoDto = mapearFilaEventoAsistenciaSocial(resultado.evento);

  const hitoDto = resultado.hito
    ? {
        id: resultado.hito.id,
        misionId: resultado.hito.mision_id,
        hito: resultado.hito.hito,
        descripcion: resultado.hito.descripcion,
        registradoPorId: resultado.hito.registrado_por_id ?? null,
        metadatos: parsearMetadatosHitoDefensivo(resultado.hito.metadatos),
        creadoEn:
          resultado.hito.creado_en instanceof Date
            ? resultado.hito.creado_en.toISOString()
            : new Date(resultado.hito.creado_en).toISOString(),
      }
    : null;

  // 4. Notificaciones en tiempo real (CA-5): sala asistente_social y encargado
  emitirAsistenciaSocialCreada(eventoDto);
  if (resultado.accion === "ACTUALIZADO") {
    emitirAsistenciaSocialActualizada(eventoDto);
  }

  const incidenteActualizadoIso =
    resultado.incidente.actualizado_en instanceof Date
      ? resultado.incidente.actualizado_en.toISOString()
      : new Date(resultado.incidente.actualizado_en).toISOString();

  notificarIncidenteActualizado({
    id: resultado.incidente.id,
    codigo: resultado.incidente.codigo,
    nuevoEstado: resultado.incidente.estado,
    prioridad: resultado.incidente.prioridad,
    requiereAsistenciaSocial: true,
    actualizadoEn: incidenteActualizadoIso,
    eventoAsistenciaSocial: {
      id: eventoDto.id,
      codigo: eventoDto.codigo,
      estado: eventoDto.estado,
      asistenteSocialId: eventoDto.asistenteSocialId,
      asistenteSocialNombre: eventoDto.asistenteSocialNombre,
      personasAfectadas: eventoDto.personasAfectadas,
      familiasAfectadas: eventoDto.familiasAfectadas,
      prioridad: eventoDto.prioridad,
      actualizadoEn: eventoDto.actualizadoEn,
    },
    hitoDerivacionSocial: hitoDto,
  });

  const message =
    resultado.accion === "CREADO"
      ? "Incidente derivado a Asistencia Social y profesional asignado para levantamiento de ficha FIBE."
      : "Asignación de Asistencia Social actualizada para el incidente resuelto (FIBE / DGRD).";

  return {
    message,
    accion: resultado.accion,
    data: eventoDto,
    hito: hitoDto,
  };
}

/**
 * Servicio para registrar o actualizar los datos oficiales de la Ficha Básica de Emergencia (FIBE)
 * de un caso de asistencia social (HU-71).
 * - Exige permiso RBAC `asistencia_social:fibe:gestionar`.
 * - Valida unicidad de `folio_fibe` y transiciona el estado a `EN_EVALUACION_FIBE`.
 * - Emite evento WebSocket `asistencia_social:actualizada`.
 */
export async function registrarFichaFibeService(
  eventoId: string,
  input: RegistrarFichaFibeInput,
  usuarioId: string
): Promise<EventoAsistenciaSocialResponse> {
  // 1. Control de Acceso RBAC: Requiere permiso asistencia_social:fibe:gestionar
  const usuario = await verificarPermiso(usuarioId, PERMISO_GESTIONAR_FIBE);

  // 2. Validar payload de entrada
  const datosValidados = RegistrarFichaFibeInputSchema.parse(input);

  // 3. Ejecutar registro atómico en repositorio Kysely
  const resultado = await registrarFichaFibeRepo({
    eventoId,
    folioFibe: datosValidados.folioFibe,
    personasAfectadas: datosValidados.personasAfectadas,
    nivelDanoVivienda: datosValidados.nivelDanoVivienda,
    observacionesSociales: datosValidados.observacionesSociales,
    usuarioId: usuario.id,
  });

  if (!resultado.ok) {
    switch (resultado.motivo) {
      case "EVENTO_NO_ENCONTRADO":
        throw new EventoAsistenciaSocialNotFoundError(resultado.detalle);
      case "ESTADO_INVALIDO":
        throw new EstadoEventoAsistenciaSocialInvalidoError(resultado.detalle);
      case "FOLIO_DUPLICADO":
        throw new FolioFibeDuplicadoError(resultado.detalle);
    }
  }

  const respuesta = mapearFilaEventoAsistenciaSocial(resultado.evento);

  // 4. Emitir notificación WebSocket hacia salas correspondientes
  emitirAsistenciaSocialActualizada(respuesta);

  return respuesta;
}
