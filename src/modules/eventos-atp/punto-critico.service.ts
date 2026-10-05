import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_LISTAR_PUNTOS_CRITICOS,
  PERMISO_CREAR_PUNTO_CRITICO,
} from "@/modules/seguridad/permisos.constants";
import { BadRequestError } from "@/modules/seguridad/errors";
import { emitirPuntoCriticoCreado } from "@/lib/socket";
import {
  listarPuntosCriticosPaginados,
  contarPuntosCriticos,
  obtenerDelegacionPorId,
  determinarPrefijoPuntoCritico,
  generarSiguienteCodigoPuntoCritico,
  insertarPuntoCritico,
  type FiltrosListarPuntosCriticos,
  type FilaPuntoCriticoConDelegacion,
  type DatosCrearPuntoCritico,
} from "./punto-critico.repository";
import {
  ListarPuntosCriticosInput,
  ListarPuntosCriticosResponse,
  PuntoCriticoItemResponse,
  CrearPuntoCriticoInput,
  CrearPuntoCriticoBodySchema,
  PuntoCriticoDetalleResponse,
} from "./punto-critico.schema";

/**
 * Transforma un registro de la base de datos relacional al formato canónico del frontend.
 */
export function mapearFilaPuntoCritico(
  fila: FilaPuntoCriticoConDelegacion
): PuntoCriticoItemResponse {
  const activo = Boolean(fila.activo);

  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? null,
    tipoRiesgo: fila.tipo_riesgo ?? null,
    prioridad: fila.prioridad || "MEDIA",
    activo,
    estadoTexto: activo ? "Activo" : "Inactivo",
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    delegacion: fila.delegacion_id
      ? {
          id: fila.delegacion_id,
          codigo: fila.delegacion_codigo ?? "",
          nombre: fila.delegacion_nombre ?? "",
        }
      : null,
    creadoEn:
      fila.creado_en instanceof Date
        ? fila.creado_en.toISOString()
        : new Date(fila.creado_en).toISOString(),
  };
}

/**
 * Transforma un registro de la base de datos relacional al formato detallado con auditoría.
 */
export function mapearFilaPuntoCriticoDetalle(
  fila: FilaPuntoCriticoConDelegacion
): PuntoCriticoDetalleResponse {
  const base = mapearFilaPuntoCritico(fila);

  return {
    ...base,
    creadoPorId: fila.creado_por_id ?? null,
  };
}

/**
 * Consulta y entrega el listado paginado de puntos críticos del SGRAI.
 * Valida que el usuario solicitante cuente con perfil de Administrador activo.
 */
export async function listarPuntosCriticos(
  query: ListarPuntosCriticosInput,
  usuarioId?: string | null
): Promise<ListarPuntosCriticosResponse> {
  // 1. Control de Acceso RBAC: Requiere rol Administrador o permiso explícito puntos_criticos:leer
  await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_LISTAR_PUNTOS_CRITICOS,
  ]);

  const pagina = Number(query.pagina ?? 1) || 1;
  const limite = Number(query.limite ?? 10) || 10;

  const activo =
    typeof query.activo === "boolean"
      ? query.activo
      : query.activo === "true"
      ? true
      : query.activo === "false"
      ? false
      : undefined;

  const filtros: FiltrosListarPuntosCriticos = {
    delegacionId: query.delegacionId,
    activo,
    prioridad: query.prioridad,
    busqueda: query.busqueda,
  };

  // 2. Consulta paralela de datos y conteo total
  const [filas, total] = await Promise.all([
    listarPuntosCriticosPaginados(filtros, { pagina, limite }),
    contarPuntosCriticos(filtros),
  ]);

  const totalPaginas = limite > 0 ? Math.ceil(total / limite) : 0;
  const data = filas.map(mapearFilaPuntoCritico);

  return {
    data,
    meta: {
      total,
      pagina,
      limite,
      totalPaginas,
    },
  };
}

/**
 * Registra un nuevo punto crítico o sector vulnerable en el sistema (HU-58).
 * - Restringido exclusivamente al perfil Administrador con permiso puntos_criticos:crear.
 * - Genera automáticamente el código correlativo según la delegación territorial o general (PC-VAL-001, etc.).
 * - Persiste las coordenadas geográficas con PostGIS (EPSG:4326) y registra la auditoría del creador.
 * - Emite notificación reactiva vía Socket.io para actualización inmediata en mapas interactivos y salas operativas.
 */
export async function crearPuntoCritico(
  input: CrearPuntoCriticoInput,
  usuarioId?: string | null
): Promise<PuntoCriticoDetalleResponse> {
  // 1. Control de Acceso RBAC: Requiere rol Administrador con permiso puntos_criticos:crear
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_CREAR_PUNTO_CRITICO,
    "eventos_atp:crear",
  ]);

  // Validar y normalizar datos de entrada con el esquema Zod
  const datosValidados = CrearPuntoCriticoBodySchema.parse(input);

  // 2. Validar existencia de la delegación territorial si se proporciona y obtener su código
  let prefijo = "PC-VAL";
  if (datosValidados.delegacionId) {
    const delegacion = await obtenerDelegacionPorId(datosValidados.delegacionId);
    if (!delegacion) {
      throw new BadRequestError(
        `La delegación territorial con ID '${datosValidados.delegacionId}' no existe en el sistema.`
      );
    }
    prefijo = determinarPrefijoPuntoCritico(delegacion.codigo);
  }

  // 3. Generar automáticamente código institucional único
  const codigo = await generarSiguienteCodigoPuntoCritico(prefijo);

  // 4. Preparar datos y persistir con PostGIS y auditoría
  const datosParaInsertar: DatosCrearPuntoCritico = {
    codigo,
    nombre: datosValidados.nombre,
    descripcion: datosValidados.descripcion,
    tipoRiesgo: datosValidados.tipoRiesgo,
    prioridad: datosValidados.prioridad,
    delegacionId: datosValidados.delegacionId,
    latitud: Number(datosValidados.latitud),
    longitud: Number(datosValidados.longitud),
  };

  const filaGuardada = await insertarPuntoCritico(datosParaInsertar, usuario.id);
  const respuesta = mapearFilaPuntoCriticoDetalle(filaGuardada);

  // 5. Notificar en tiempo real vía Socket.io al módulo cartográfico y salas operativas
  emitirPuntoCriticoCreado(respuesta as unknown as Record<string, unknown>);

  return respuesta;
}
