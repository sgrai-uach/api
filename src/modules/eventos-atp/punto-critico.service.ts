import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_LISTAR_PUNTOS_CRITICOS,
  PERMISO_ELIMINAR_PUNTO_CRITICO,
} from "@/modules/seguridad/permisos.constants";
import {
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import { emitirPuntoCriticoEliminado } from "@/lib/socket";
import {
  listarPuntosCriticosPaginados,
  contarPuntosCriticos,
  obtenerPuntoCriticoPorId,
  verificarMisionesActivasPuntoCritico,
  marcarPuntoCriticoEliminado,
  type FiltrosListarPuntosCriticos,
  type FilaPuntoCriticoConDelegacion,
} from "./punto-critico.repository";
import type {
  ListarPuntosCriticosInput,
  ListarPuntosCriticosResponse,
  PuntoCriticoItemResponse,
  EliminarPuntoCriticoResponse,
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
 * Aplica el borrado lógico (soft delete) a un punto crítico garantizando la trazabilidad histórica (HU-56).
 * Bloquea la eliminación si existen misiones activas (PLANIFICADA, DESPACHADA, EN_CURSO) asociadas al punto.
 */
export async function eliminarPuntoCritico(
  id: string,
  usuarioId?: string | null
): Promise<EliminarPuntoCriticoResponse> {
  // 1. Control de Acceso RBAC: Requiere rol Administrador con permiso puntos_criticos:eliminar
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_ELIMINAR_PUNTO_CRITICO,
  ]);

  // 2. Verificar existencia del punto crítico
  const puntoExistente = await obtenerPuntoCriticoPorId(id);
  if (!puntoExistente) {
    throw new NotFoundError(`Punto crítico con ID '${id}' no encontrado.`);
  }

  // 3. Si ya se encuentra inactivo / eliminado lógicamente
  if (!puntoExistente.activo) {
    throw new ConflictError(
      `El punto crítico '${puntoExistente.nombre}' ya se encuentra desactivado del sistema.`
    );
  }

  // 4. Validar dependencias operativas activas (misiones preventivas o patrullas en curso/despachadas)
  const dependencias = await verificarMisionesActivasPuntoCritico(id);
  if (dependencias.tieneMisionesActivas) {
    const detalleMisiones =
      dependencias.codigos.length > 0
        ? ` (Misiones asociadas: ${dependencias.codigos.join(", ")})`
        : "";
    throw new ConflictError(
      `No es posible eliminar el punto crítico '${puntoExistente.nombre}' porque cuenta con ${dependencias.totalMisiones} misión(es) preventivas activas o patrullas asignadas en terreno${detalleMisiones}.`
    );
  }

  // 5. Aplicar borrado lógico con estampa de auditoría
  const resultado = await marcarPuntoCriticoEliminado(id, usuario.id);
  if (!resultado) {
    throw new NotFoundError(
      `Punto crítico con ID '${id}' no encontrado o no pudo ser desactivado.`
    );
  }

  const eliminadoEnStr =
    resultado.eliminado_en instanceof Date
      ? resultado.eliminado_en.toISOString()
      : typeof resultado.eliminado_en === "string"
      ? resultado.eliminado_en
      : new Date().toISOString();

  // 6. Emitir evento Socket.io para actualización reactiva en tiempo real del mapa y la tabla
  emitirPuntoCriticoEliminado({
    id: resultado.id,
    codigo: resultado.codigo,
    nombre: resultado.nombre,
    eliminadoPorId: usuario.id,
    eliminadoEn: eliminadoEnStr,
  });

  return {
    message: "Punto crítico desactivado exitosamente del sistema.",
    id: resultado.id,
    codigo: resultado.codigo,
    nombre: resultado.nombre,
    activo: false,
    eliminadoEn: eliminadoEnStr,
    eliminadoPorId: usuario.id,
  };
}
