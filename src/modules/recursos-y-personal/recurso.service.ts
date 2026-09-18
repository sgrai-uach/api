import { seguridadService } from "@/modules/seguridad/service";
import {
  determinarEstadoRecurso,
  calcularDisponibilidadOperativa,
  obtenerEtiquetaTipoRecurso,
} from "./recurso.utils";
import {
  insertarRecurso,
  listarRecursosPaginados,
  contarRecursos,
  type DatosInsertarRecurso,
  type FiltrosListarRecursos,
} from "./recurso.repository";
import type {
  CrearRecursoInput,
  RecursoResponse,
  ListarRecursosQuerySchema,
  ListarRecursosPaginadosResponse,
  RecursoItemResponse,
} from "./recurso.schema";
import type { z } from "zod";

export type ListarRecursosInputQuery = z.input<typeof ListarRecursosQuerySchema>;

/**
 * Consulta y lista los recursos del inventario logístico con paginación y filtros.
 * Accesible exclusivamente por usuarios con perfil de Administrador activo.
 */
export async function listarRecursos(
  query: ListarRecursosInputQuery,
  usuarioId?: string | null
): Promise<ListarRecursosPaginadosResponse> {
  // 1. Validar autorización RBAC (requiere rol Administrador)
  await seguridadService.validarAccesoAdministrador(usuarioId);

  const pagina = Number(query.pagina ?? 1) || 1;
  const limite = Number(query.limite ?? 10) || 10;

  const esIndividual =
    typeof query.esIndividual === "boolean"
      ? query.esIndividual
      : query.esIndividual === "true"
      ? true
      : query.esIndividual === "false"
      ? false
      : undefined;

  const filtros: FiltrosListarRecursos = {
    delegacionId: query.delegacionId,
    estado: query.estado,
    esIndividual,
    busqueda: query.busqueda,
  };

  // 2. Consultar registros y conteo total en paralelo
  const [filas, total] = await Promise.all([
    listarRecursosPaginados(filtros, { pagina, limite }),
    contarRecursos(filtros),
  ]);

  // 3. Mapear cada registro aplicando cálculo de disponibilidad operativa y relación territorial
  const data: RecursoItemResponse[] = filas.map((fila) => {
    const cantidadInventario = Number(fila.cantidad_inventario);
    const cantidadEnUso = Number(fila.cantidad_en_uso);
    const cantidadMinima = Number(fila.cantidad_minima);
    const cantidadDisponible = Math.max(0, cantidadInventario - cantidadEnUso);

    const estadoCalculado = calcularDisponibilidadOperativa(
      fila.estado,
      cantidadInventario,
      cantidadEnUso,
      cantidadMinima
    );

    return {
      id: fila.id,
      nombre: fila.nombre,
      tipo: obtenerEtiquetaTipoRecurso(fila.es_individual),
      esIndividual: fila.es_individual,
      estado: estadoCalculado,
      cantidadInventario,
      cantidadEnUso,
      cantidadDisponible,
      cantidadMinima,
      latitud: Number(fila.latitud),
      longitud: Number(fila.longitud),
      descripcion: fila.descripcion,
      detalles: (fila.detalles ?? {}) as Record<string, unknown>,
      delegacion: fila.delegacion_id
        ? {
            id: fila.delegacion_id,
            codigo: fila.delegacion_codigo || "",
            nombre: fila.delegacion_nombre || "",
          }
        : null,
      creadoPorId: fila.creado_por_id,
      creadoEn:
        typeof fila.creado_en === "string"
          ? fila.creado_en
          : fila.creado_en.toISOString(),
      actualizadoEn:
        typeof fila.actualizado_en === "string"
          ? fila.actualizado_en
          : fila.actualizado_en.toISOString(),
    };
  });

  const totalPaginas = total > 0 ? Math.ceil(total / limite) : 0;

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
 * Registra un nuevo recurso en el inventario logístico (proveniente de H6).
 */
export async function crearRecurso(
  input: CrearRecursoInput,
  usuarioId: string | null | undefined
): Promise<RecursoResponse> {
  // 1. Validar autenticación de administrador
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId);

  // 2. Determinar estado inicial según stock e inventario
  const estado = determinarEstadoRecurso(input.cantidadInventario, input.cantidadMinima);

  // 3. Preparar entidad a insertar
  const datosParaInsertar: DatosInsertarRecurso = {
    nombre: input.nombre,
    es_individual: input.esIndividual,
    estado,
    cantidad_inventario: input.cantidadInventario,
    cantidad_en_uso: 0,
    cantidad_minima: input.cantidadMinima,
    latitud: input.latitud,
    longitud: input.longitud,
    descripcion: input.descripcion ?? null,
    detalles: (input.detalles ?? {}) as Record<string, unknown>,
    delegacion_id: input.delegacionId ?? null,
    creado_por_id: usuario.id,
  };

  // 4. Persistir en base de datos
  const fila = await insertarRecurso(datosParaInsertar);

  // 5. Mapear a contrato de respuesta
  return {
    id: fila.id,
    nombre: fila.nombre,
    esIndividual: fila.es_individual,
    estado: fila.estado,
    cantidadInventario: Number(fila.cantidad_inventario),
    cantidadEnUso: Number(fila.cantidad_en_uso),
    cantidadMinima: Number(fila.cantidad_minima),
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    descripcion: fila.descripcion,
    detalles: (fila.detalles ?? {}) as Record<string, unknown>,
    delegacionId: fila.delegacion_id,
    creadoPorId: fila.creado_por_id,
    creadoEn:
      typeof fila.creado_en === "string"
        ? fila.creado_en
        : fila.creado_en.toISOString(),
    actualizadoEn:
      typeof fila.actualizado_en === "string"
        ? fila.actualizado_en
        : fila.actualizado_en.toISOString(),
  };
}
