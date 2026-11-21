import { verificarPermiso } from "@/modules/seguridad/auth.service";
import {
  PERMISO_CREAR_ASISTENCIA_SOCIAL,
  PERMISO_LEER_ASISTENCIA_SOCIAL,
} from "@/modules/seguridad/permisos.constants";
import {
  emitirAsistenciaSocialCreada,
  emitirAsistenciaSocialActualizada,
} from "@/lib/socket";
import {
  generarSiguienteCodigoAsistenciaSocial,
  insertarEventoAsistenciaSocial,
  listarEventosAsistenciaSocialPaginados,
  contarEventosAsistenciaSocial,
  asignarAsistenteSocialEventoRepo,
  type FilaEventoAsistenciaSocialConRelaciones,
  type DatosInsertarEventoAsistenciaSocialRepo,
} from "./asistencia-social.repository";
import {
  CrearEventoAsistenciaSocialInputSchema,
  ListarEventosAsistenciaSocialQuerySchema,
  AsignarAsistenteSocialInputSchema,
  type CrearEventoAsistenciaSocialInput,
  type ListarEventosAsistenciaSocialQuery,
  type AsignarAsistenteSocialInput,
  type EventoAsistenciaSocialResponse,
  type ListarEventosAsistenciaSocialResponse,
  type PrioridadEventoAsistenciaSocial,
  type EstadoEventoAsistenciaSocial,
} from "./asistencia-social.schema";

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
    asistenteSocialId: fila.asistente_social_id ?? null,
    asistenteSocialNombre: fila.asistente_social_nombre ?? null,
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
 * Servicio para registrar un evento excepcional de asistencia social (H28).
 * - Restringido al rol Encargado (y Administrador) mediante el permiso asistencia_social:crear.
 * - Soporta la creación de eventos sin asociación obligatoria a un incidente.
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

  // 3. Generar código correlativo oficial (AS-YYYY-XXXX)
  const codigo = await generarSiguienteCodigoAsistenciaSocial();

  // 4. Preparar payload de inserción
  const datosParaInsertar: DatosInsertarEventoAsistenciaSocialRepo = {
    codigo,
    descripcion: datosValidados.descripcion,
    tipoAfectacion: datosValidados.tipoAfectacion,
    personasAfectadas: datosValidados.personasAfectadas,
    familiasAfectadas: datosValidados.familiasAfectadas,
    direccionTexto: datosValidados.direccionTexto,
    latitud: datosValidados.latitud,
    longitud: datosValidados.longitud,
    prioridad: datosValidados.prioridad,
    contactoNombre: datosValidados.contactoNombre,
    contactoTelefono: datosValidados.contactoTelefono,
    contactoRut: datosValidados.contactoRut,
    delegacionId: datosValidados.delegacionId,
    incidenteId: datosValidados.incidenteId ?? null,
    creadoPorId: usuario.id,
  };

  // 5. Insertar en base de datos relacional con geometría PostGIS
  const filaInsertada = await insertarEventoAsistenciaSocial(datosParaInsertar);
  const respuesta = mapearFilaEventoAsistenciaSocial(filaInsertada);

  // 6. Notificar en tiempo real al panel de eventos pendientes y salas operativas
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
