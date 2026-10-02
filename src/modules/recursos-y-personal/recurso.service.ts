import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_LEER_RECURSO,
  PERMISO_CREAR_RECURSO,
  PERMISO_ELIMINAR_RECURSO,
} from "@/modules/seguridad/permisos.constants";
import { BadRequestError, NotFoundError, ConflictError } from "@/modules/seguridad/errors";
import { emitirRecursoActualizado, emitirRecursoEliminado } from "@/lib/socket";
import {
  determinarEstadoRecurso,
  calcularDisponibilidadOperativa,
  obtenerEtiquetaTipoRecurso,
} from "./recurso.utils";
import {
  insertarRecurso,
  obtenerRecursoPorId,
  actualizarRecurso,
  listarRecursosPaginados,
  contarRecursos,
  verificarAsignacionesActivasRecurso,
  marcarRecursoEliminado,
  type DatosInsertarRecurso,
  type DatosActualizarRecurso,
  type FiltrosListarRecursos,
} from "./recurso.repository";
import type {
  CrearRecursoInput,
  ActualizarRecursoInput,
  RecursoResponse,
  RecursoDetalleResponse,
  EliminarRecursoResponse,
  ListarRecursosQuerySchema,
  ListarRecursosPaginadosResponse,
  RecursoItemResponse,
  EstadoRecurso,
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
  // 1. Validar autorización RBAC (requiere permiso recursos:leer o rol Administrador)
  await seguridadService.validarAccesoAdministrador(usuarioId, [PERMISO_LEER_RECURSO]);

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
  // 1. Validar autorización RBAC (requiere permiso recursos:crear o rol Administrador)
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [PERMISO_CREAR_RECURSO]);

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

/**
 * Obtiene el detalle completo de un recurso para precargar el formulario de edición (HU-8).
 */
export async function obtenerRecursoDetalle(
  id: string,
  usuarioId?: string | null
): Promise<RecursoDetalleResponse> {
  // 1. Validar autenticación de administrador
  await seguridadService.validarAccesoAdministrador(usuarioId);

  // 2. Obtener recurso desde BD
  const fila = await obtenerRecursoPorId(id);
  if (!fila) {
    throw new NotFoundError(`Recurso con ID '${id}' no encontrado.`);
  }

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
    delegacionId: fila.delegacion_id,
    creadoPorId: fila.creado_por_id,
    actualizadoPorId: fila.actualizado_por_id,
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

/**
 * Actualiza las características, inventario y estado de un recurso (HU-8).
 */
export async function editarRecurso(
  id: string,
  input: ActualizarRecursoInput,
  usuarioId?: string | null
): Promise<RecursoDetalleResponse> {
  // 1. Validar autenticación de administrador
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId);

  // 2. Verificar existencia del recurso
  const recursoExistente = await obtenerRecursoPorId(id);
  if (!recursoExistente) {
    throw new NotFoundError(`Recurso con ID '${id}' no encontrado.`);
  }

  const cantidadEnUso = Number(recursoExistente.cantidad_en_uso);

  // 3. Validar consistencia operativa: el inventario físico no puede ser menor a lo actualmente desplegado
  if (input.cantidadInventario < cantidadEnUso) {
    throw new BadRequestError(
      `No es posible reducir la cantidad en inventario (${input.cantidadInventario}) por debajo de las unidades actualmente en uso en terreno (${cantidadEnUso}).`
    );
  }

  // 4. Validar que recursos a granel / materiales no admitan estado de mantenimiento técnico
  if (!recursoExistente.es_individual && input.enMantencion) {
    throw new BadRequestError(
      "Los materiales o recursos a granel no admiten estado de mantenimiento técnico."
    );
  }

  // 5. Determinar estado operativo
  let nuevoEstado: EstadoRecurso;
  if (input.enMantencion) {
    nuevoEstado = "EN_MANTENCION";
  } else if (input.cantidadInventario === 0) {
    nuevoEstado = "NO_DISPONIBLE";
  } else {
    nuevoEstado = calcularDisponibilidadOperativa(
      "DISPONIBLE",
      input.cantidadInventario,
      cantidadEnUso,
      input.cantidadMinima
    );
  }

  // 5. Preparar datos y actualizar en BD
  const datosParaActualizar: DatosActualizarRecurso = {
    nombre: input.nombre,
    estado: nuevoEstado,
    cantidad_inventario: input.cantidadInventario,
    cantidad_minima: input.cantidadMinima,
    latitud: input.latitud,
    longitud: input.longitud,
    descripcion: input.descripcion ?? null,
    detalles: (input.detalles ?? {}) as Record<string, unknown>,
    delegacion_id: input.delegacionId ?? null,
    actualizado_por_id: usuario.id,
  };

  await actualizarRecurso(id, datosParaActualizar);

  // 6. Consultar registro con datos de delegación actualizados
  const recursoActualizado = await obtenerRecursoPorId(id);
  const filaFinal = recursoActualizado ?? recursoExistente;

  const cantidadInventario = Number(filaFinal.cantidad_inventario);
  const cantidadDisponible = Math.max(0, cantidadInventario - cantidadEnUso);

  const respuesta: RecursoDetalleResponse = {
    id: filaFinal.id,
    nombre: filaFinal.nombre,
    tipo: obtenerEtiquetaTipoRecurso(filaFinal.es_individual),
    esIndividual: filaFinal.es_individual,
    estado: filaFinal.estado,
    cantidadInventario,
    cantidadEnUso,
    cantidadDisponible,
    cantidadMinima: Number(filaFinal.cantidad_minima),
    latitud: Number(filaFinal.latitud),
    longitud: Number(filaFinal.longitud),
    descripcion: filaFinal.descripcion,
    detalles: (filaFinal.detalles ?? {}) as Record<string, unknown>,
    delegacion: filaFinal.delegacion_id
      ? {
          id: filaFinal.delegacion_id,
          codigo: filaFinal.delegacion_codigo || "",
          nombre: filaFinal.delegacion_nombre || "",
        }
      : null,
    delegacionId: filaFinal.delegacion_id,
    creadoPorId: filaFinal.creado_por_id,
    actualizadoPorId: filaFinal.actualizado_por_id,
    creadoEn:
      typeof filaFinal.creado_en === "string"
        ? filaFinal.creado_en
        : filaFinal.creado_en.toISOString(),
    actualizadoEn:
      typeof filaFinal.actualizado_en === "string"
        ? filaFinal.actualizado_en
        : filaFinal.actualizado_en.toISOString(),
  };

  // 7. Notificación en tiempo real vía Socket.io a Encargado y Supervisor
  emitirRecursoActualizado(respuesta as unknown as Record<string, unknown>);

  return respuesta;
}

/**
 * Da de baja lógica a un recurso del sistema garantizando la preservación del historial (HU-9).
 */
export async function eliminarRecurso(
  id: string,
  usuarioId?: string | null
): Promise<EliminarRecursoResponse> {
  // 1. Validar autenticación y rol de administrador o permiso de eliminación
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_ELIMINAR_RECURSO,
  ]);

  // 2. Verificar existencia del recurso activo
  const recursoExistente = await obtenerRecursoPorId(id);
  if (!recursoExistente) {
    throw new NotFoundError(`Recurso con ID '${id}' no encontrado.`);
  }

  // 3. Validar dependencias operativas activas (unidades en uso o asignado a misiones en curso)
  const verificacionUso = await verificarAsignacionesActivasRecurso(id);
  if (verificacionUso.enUso) {
    throw new ConflictError(
      verificacionUso.motivo ??
        `No es posible eliminar el recurso '${recursoExistente.nombre}' porque se encuentra actualmente asignado a una misión activa o cuadrilla en terreno.`
    );
  }

  // 4. Aplicar borrado lógico con estampa de auditoría
  const resultadoEliminacion = await marcarRecursoEliminado(id, usuario.id);
  if (!resultadoEliminacion) {
    throw new NotFoundError(`Recurso con ID '${id}' no encontrado o ya fue dado de baja.`);
  }

  const eliminadoEnStr =
    typeof resultadoEliminacion.eliminado_en === "string"
      ? resultadoEliminacion.eliminado_en
      : (resultadoEliminacion.eliminado_en as Date).toISOString();

  // 5. Emitir evento Socket.io para actualización dinámica en tiempo real
  emitirRecursoEliminado({
    id: resultadoEliminacion.id,
    nombre: resultadoEliminacion.nombre,
    eliminadoPorId: usuario.id,
    eliminadoEn: eliminadoEnStr,
  });

  return {
    message: "Recurso dado de baja exitosamente del inventario.",
    id: resultadoEliminacion.id,
    nombre: resultadoEliminacion.nombre,
    eliminadoEn: eliminadoEnStr,
    eliminadoPorId: usuario.id,
  };
}


