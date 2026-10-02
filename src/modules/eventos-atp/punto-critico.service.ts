import { seguridadService } from "@/modules/seguridad/service";
import {
  listarPuntosCriticosPaginados,
  contarPuntosCriticos,
  type FiltrosListarPuntosCriticos,
  type FilaPuntoCriticoConDelegacion,
} from "./punto-critico.repository";
import type {
  ListarPuntosCriticosInput,
  ListarPuntosCriticosResponse,
  PuntoCriticoItemResponse,
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
  // 1. Control de Acceso RBAC: Restringido exclusivamente al Administrador
  await seguridadService.validarAccesoAdministrador(usuarioId);

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
