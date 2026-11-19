import { db } from "@/lib/db";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import type {
  CrearEventoPrevencionInput,
  EditarEventoPrevencionInput,
  EstadoEventoPrevencion,
  EventoPrevencionEditado,
  EventoPrevencionListadoItem,
  EventoPrevencionResponse,
  ListarEventosPrevencionQuery,
  ListarEventosPrevencionResponse,
  PrioridadEventoPrevencion,
} from "./evento-prevencion.schema";
import * as repo from "./evento-prevencion.repository";
import {
  emitirEventoPrevencionActualizado,
  emitirEventoPrevencionCreado,
} from "@/lib/socket";

export class PatrullaNoDisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatrullaNoDisponibleError";
  }
}

export class StockInsuficienteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockInsuficienteError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class EventoPrevencionNoEditableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventoPrevencionNoEditableError";
  }
}

/**
 * Servicio de negocio para la creación atómica de eventos de prevención (HU-30).
 * Valida disponibilidad de patrulla, existencia de delegación y punto crítico (si aplica),
 * valida y reserva recursos solicitados, y despacha la misión preventiva notificando en tiempo real.
 */
export async function crearEventoPrevencionService(
  input: CrearEventoPrevencionInput,
  usuarioId: string
): Promise<EventoPrevencionResponse> {
  const eventoCreado = await db.transaction().execute(async (trx) => {
    // 1. Validar existencia y disponibilidad de la patrulla verificadora
    const patrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId);
    if (!patrulla) {
      throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
    }

    if (patrulla.estado !== "DISPONIBLE") {
      throw new PatrullaNoDisponibleError(
        `La patrulla "${patrulla.nombre}" no está disponible para asignación (estado actual: ${patrulla.estado}).`
      );
    }

    // 2. Validar existencia de la delegación territorial
    const delegacion = await repo.buscarDelegacionPorId(trx, input.delegacionId);
    if (!delegacion) {
      throw new NotFoundError("La delegación territorial indicada no fue encontrada.");
    }

    // 3. Validar punto crítico si fue especificado
    let puntoCriticoData = null;
    if (input.puntoCriticoId) {
      const pc = await repo.buscarPuntoCriticoPorId(trx, input.puntoCriticoId);
      if (!pc) {
        throw new NotFoundError("El punto crítico indicado no fue encontrado.");
      }
      puntoCriticoData = {
        id: pc.id,
        codigo: pc.codigo,
        nombre: pc.nombre,
      };
    }

    // 4. Si se indicaron recursos, consolidar y validar stock
    const mapaRecursosSolicitados = new Map<string, number>();
    if (input.recursos && input.recursos.length > 0) {
      for (const item of input.recursos) {
        const acumulado = mapaRecursosSolicitados.get(item.recursoId) ?? 0;
        mapaRecursosSolicitados.set(item.recursoId, acumulado + item.cantidad);
      }
    }

    const recursoIds = Array.from(mapaRecursosSolicitados.keys());
    const mapaNombresRecursos = new Map<string, string>();

    if (recursoIds.length > 0) {
      const recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, recursoIds);
      if (recursosEnBd.length !== recursoIds.length) {
        const encontrados = new Set(recursosEnBd.map((r) => r.id));
        const faltantes = recursoIds.filter((id) => !encontrados.has(id));
        throw new NotFoundError(
          `Uno o más recursos solicitados no existen en el inventario: ${faltantes.join(", ")}`
        );
      }

      for (const recurso of recursosEnBd) {
        mapaNombresRecursos.set(recurso.id, recurso.nombre);
        const cantidadSolicitada = mapaRecursosSolicitados.get(recurso.id)!;
        const inventario = Number(recurso.cantidad_inventario);
        const enUso = Number(recurso.cantidad_en_uso ?? 0);
        const disponible = Math.max(0, inventario - enUso);

        if (disponible < cantidadSolicitada) {
          throw new StockInsuficienteError(
            `Stock insuficiente para el recurso "${recurso.nombre}". Solicitado: ${cantidadSolicitada}, Disponible: ${disponible}.`
          );
        }
      }
    }

    // 5. Generar correlativos institucionales
    const codigoPrevencion = await repo.generarSiguienteCodigoPrevencion(trx);
    const codigoMision = await repo.generarSiguienteCodigoMision(trx);

    // 6. Insertar evento de prevención con coordenadas PostGIS
    const nuevoEvento = await repo.insertarEventoPrevencion(trx, {
      codigo: codigoPrevencion,
      nombre: input.nombre,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      sector: input.sector,
      direccionTexto: input.direccionTexto,
      puntoCriticoId: input.puntoCriticoId,
      delegacionId: input.delegacionId,
      latitud: input.latitud,
      longitud: input.longitud,
      fechaEstimadaFin: input.fechaEstimadaFin ? new Date(input.fechaEstimadaFin) : null,
      creadoPorId: usuarioId,
    });

    // 7. Insertar misión táctica preventiva vinculada
    const nuevaMision = await repo.insertarMisionPrevencion(trx, {
      codigo: codigoMision,
      titulo: input.nombre,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      eventoPrevencionId: nuevoEvento.id,
      puntoCriticoId: input.puntoCriticoId,
      patrullaId: patrulla.id,
      encargadoId: usuarioId,
      creadoPorId: usuarioId,
    });

    // 8. Asignar recursos si aplica
    if (recursoIds.length > 0) {
      const asignaciones = Array.from(mapaRecursosSolicitados.entries()).map(([recursoId, cantidad]) => ({
        eventoPrevencionId: nuevoEvento.id,
        recursoId,
        cantidad,
      }));
      await repo.insertarRecursosPrevencion(trx, asignaciones);

      for (const [recursoId, cantidad] of mapaRecursosSolicitados.entries()) {
        await repo.descontarStockRecurso(trx, recursoId, cantidad);
      }
    }

    // 9. Actualizar estado de la patrulla a "EN_PREVENCION"
    await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_PREVENCION");

    // 10. Actualizar disponibilidad del líder si aplica
    if (patrulla.usuario_lider_id) {
      await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
    }

    // 11. Formatear respuesta estructurada
    const recursosRespuesta = Array.from(mapaRecursosSolicitados.entries()).map(([recursoId, cantidad]) => ({
      recursoId,
      nombre: mapaNombresRecursos.get(recursoId) || "Recurso",
      cantidadAsignada: cantidad,
    }));

    const respuesta: EventoPrevencionResponse = {
      id: nuevoEvento.id,
      codigo: nuevoEvento.codigo,
      nombre: nuevoEvento.nombre,
      descripcion: nuevoEvento.descripcion,
      sector: nuevoEvento.sector,
      direccionTexto: nuevoEvento.direccion_texto,
      prioridad: nuevoEvento.prioridad,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      estado: nuevoEvento.estado as any,
      latitud: Number(nuevoEvento.latitud),
      longitud: Number(nuevoEvento.longitud),
      puntoCritico: puntoCriticoData,
      delegacion: {
        id: delegacion.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        codigo: (delegacion as any).codigo || (delegacion as any).codigo_delegacion || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombre: (delegacion as any).nombre || (delegacion as any).nombre_delegacion || "",
      },
      mision: {
        id: nuevaMision.id,
        codigo: nuevaMision.codigo,
        titulo: nuevaMision.titulo,
        estado: nuevaMision.estado,
        tipoMision: nuevaMision.tipo_mision,
      },
      patrulla: {
        id: patrulla.id,
        nombre: patrulla.nombre,
        estado: "EN_PREVENCION",
      },
      recursos: recursosRespuesta,
      fechaEstimadaFin: toIsoString(nuevoEvento.fecha_estimada_fin),
      creadoPorId: usuarioId,
      actualizadoPorId: nuevoEvento.actualizado_por_id ?? null,
      creadoEn: nuevoEvento.creado_en instanceof Date
        ? nuevoEvento.creado_en.toISOString()
        : String(nuevoEvento.creado_en),
      actualizadoEn: nuevoEvento.actualizado_en instanceof Date
        ? nuevoEvento.actualizado_en.toISOString()
        : String(nuevoEvento.actualizado_en),
    };

    return respuesta;
  });

  // 12. Notificar en tiempo real vía Socket.io
  try {
    emitirEventoPrevencionCreado(eventoCreado);
  } catch (err) {
    console.error("Error al emitir notificación Socket.io de evento de prevención:", err);
  }

  return eventoCreado;
}

function toIsoString(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return fecha instanceof Date ? fecha.toISOString() : String(fecha);
}

/**
 * Servicio de negocio para listar eventos de prevención paginados con filtros H34 (H76).
 */
export async function listarEventosPrevencionService(
  filtros: ListarEventosPrevencionQuery
): Promise<ListarEventosPrevencionResponse> {
  const { total, eventos, misionesPorEvento, recursosPorEvento } =
    await repo.listarEventosPrevencionPaginados(filtros);

  const data: EventoPrevencionListadoItem[] = eventos.map((row) => {
    const misionRow = misionesPorEvento.get(row.ep_id);
    const recursos = recursosPorEvento.get(row.ep_id) ?? [];

    return {
      id: row.ep_id,
      codigo: row.ep_codigo,
      nombre: row.ep_nombre,
      descripcion: row.ep_descripcion,
      sector: row.ep_sector,
      direccionTexto: row.ep_direccion_texto,
      prioridad: row.ep_prioridad as PrioridadEventoPrevencion,
      estado: row.ep_estado as EstadoEventoPrevencion,
      latitud: Number(row.ep_latitud),
      longitud: Number(row.ep_longitud),
      ubicacionGeoJson: row.ep_ubicacion_geojson ?? null,
      puntoCritico: row.pc_id
        ? {
            id: row.pc_id,
            codigo: row.pc_codigo!,
            nombre: row.pc_nombre!,
            descripcion: row.pc_descripcion ?? null,
            tipoRiesgo: row.pc_tipo_riesgo ?? null,
            prioridad: (row.pc_prioridad ?? "MEDIA") as PrioridadEventoPrevencion,
            latitud: Number(row.pc_latitud),
            longitud: Number(row.pc_longitud),
            ubicacionGeoJson: row.pc_ubicacion_geojson ?? null,
          }
        : null,
      delegacion: row.del_id
        ? {
            id: row.del_id,
            codigo: row.del_codigo ?? "",
            nombre: row.del_nombre ?? "",
          }
        : null,
      mision: misionRow
        ? {
            id: misionRow.m_id,
            codigo: misionRow.m_codigo,
            titulo: misionRow.m_titulo,
            estado: misionRow.m_estado,
            tipoMision: misionRow.m_tipo_mision,
            fechaInicio: toIsoString(misionRow.m_fecha_inicio),
            fechaCierre: toIsoString(misionRow.m_fecha_cierre),
          }
        : null,
      patrulla: misionRow?.pv_id
        ? {
            id: misionRow.pv_id,
            nombre: misionRow.pv_nombre!,
            estado: misionRow.pv_estado!,
          }
        : null,
      cuadrilla: misionRow?.c_id
        ? {
            id: misionRow.c_id,
            nombre: misionRow.c_nombre!,
            estado: misionRow.c_estado!,
          }
        : null,
      recursos,
      fechaEstimadaFin: toIsoString(row.ep_fecha_estimada_fin),
      creadoPorId: row.ep_creado_por_id,
      actualizadoPorId: row.ep_actualizado_por_id ?? null,
      creadoEn: toIsoString(row.ep_creado_en)!,
      actualizadoEn: toIsoString(row.ep_actualizado_en)!,
    };
  });

  return {
    message: "Eventos de prevención obtenidos exitosamente.",
    data,
    meta: buildPaginationMeta(total, filtros.page, filtros.limit),
  };
}


const ESTADOS_NO_EDITABLES = new Set<string>(["COMPLETADA", "CANCELADA"]);

/**
 * Servicio de negocio para editar tareas, prioridad, fecha estimada y recursos
 * de un evento de prevención activo (H77).
 * Bloquea con 409 Conflict si el evento está en estado COMPLETADA, CANCELADA o inactivo.
 * Registra auditoría (actualizado_en, actualizado_por_id) y ajusta inventario por delta.
 */
export async function editarEventoPrevencionService(
  eventoId: string,
  input: EditarEventoPrevencionInput,
  usuarioId: string
): Promise<EventoPrevencionEditado> {
  const eventoEditado = await db.transaction().execute(async (trx) => {
    // 1. Obtener y bloquear el evento de prevención
    const eventoActual = await repo.buscarEventoPrevencionParaEdicion(trx, eventoId);
    if (!eventoActual || eventoActual.eliminado_en !== null) {
      throw new NotFoundError("El evento de prevención indicado no fue encontrado.");
    }

    if (!eventoActual.activo) {
      throw new EventoPrevencionNoEditableError(
        `No es posible editar el evento de prevención "${eventoActual.nombre}" porque se encuentra desactivado del sistema.`
      );
    }

    if (ESTADOS_NO_EDITABLES.has(eventoActual.estado)) {
      throw new EventoPrevencionNoEditableError(
        `No es posible editar el evento de prevención en estado ${eventoActual.estado}.`
      );
    }

    // 2. Reasignación diferencial de recursos si se proporcionó `recursos`
    const asignacionesActuales = await repo.listarRecursosAsignadosPrevencion(trx, eventoId);
    let recursosRespuesta = asignacionesActuales.map((r) => ({
      recursoId: r.recursoId,
      nombre: r.nombre,
      cantidadAsignada: Number(r.cantidadAsignada),
    }));

    if (input.recursos !== undefined) {
      const mapaNuevos = new Map<string, number>();
      for (const item of input.recursos) {
        const acumulado = mapaNuevos.get(item.recursoId) ?? 0;
        mapaNuevos.set(item.recursoId, acumulado + item.cantidad);
      }

      const mapaActuales = new Map<string, { cantidad: number; nombre: string }>();
      for (const item of asignacionesActuales) {
        mapaActuales.set(item.recursoId, {
          cantidad: Number(item.cantidadAsignada),
          nombre: item.nombre,
        });
      }

      const todosIds = Array.from(
        new Set([...mapaNuevos.keys(), ...mapaActuales.keys()])
      ).sort();

      const recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, todosIds);
      const mapaRecursosBd = new Map(recursosEnBd.map((r) => [r.id, r]));

      // Validar existencia y stock suficiente para incrementos o nuevos recursos
      for (const [recursoId, cantidadNueva] of mapaNuevos.entries()) {
        const recursoBd = mapaRecursosBd.get(recursoId);
        if (!recursoBd) {
          throw new NotFoundError(
            `El recurso solicitado (${recursoId}) no existe en el inventario o fue eliminado.`
          );
        }

        const cantidadAnterior = mapaActuales.get(recursoId)?.cantidad ?? 0;
        const delta = cantidadNueva - cantidadAnterior;

        if (delta > 0) {
          const inventario = Number(recursoBd.cantidad_inventario);
          const enUso = Number(recursoBd.cantidad_en_uso ?? 0);
          const disponible = Math.max(0, inventario - enUso);

          if (disponible < delta) {
            throw new StockInsuficienteError(
              `Stock insuficiente para el recurso "${recursoBd.nombre}". Incremento solicitado: ${delta}, Disponible: ${disponible}.`
            );
          }
        }
      }

      // Devolver stock de recursos removidos completamente
      for (const [recursoId, infoActual] of mapaActuales.entries()) {
        if (!mapaNuevos.has(recursoId)) {
          await repo.devolverStockRecurso(trx, recursoId, infoActual.cantidad);
        }
      }

      // Ajustar stock según delta para recursos presentes en la nueva lista
      for (const [recursoId, cantidadNueva] of mapaNuevos.entries()) {
        const cantidadAnterior = mapaActuales.get(recursoId)?.cantidad ?? 0;
        const delta = cantidadNueva - cantidadAnterior;
        if (delta > 0) {
          await repo.descontarStockRecurso(trx, recursoId, delta);
        } else if (delta < 0) {
          await repo.devolverStockRecurso(trx, recursoId, -delta);
        }
      }

      // Reemplazar asignaciones en evento_prevencion_recurso
      await repo.eliminarRecursosPrevencion(trx, eventoId);
      if (mapaNuevos.size > 0) {
        const nuevasAsignaciones = Array.from(mapaNuevos.entries()).map(
          ([recursoId, cantidad]) => ({
            eventoPrevencionId: eventoId,
            recursoId,
            cantidad,
          })
        );
        await repo.insertarRecursosPrevencion(trx, nuevasAsignaciones);
      }

      recursosRespuesta = Array.from(mapaNuevos.entries()).map(([recursoId, cantidad]) => ({
        recursoId,
        nombre: mapaRecursosBd.get(recursoId)?.nombre ?? "Recurso",
        cantidadAsignada: cantidad,
      }));
    }

    // 3. Actualizar evento_prevencion con auditoría
    const fechaEstimadaFinDate =
      input.fechaEstimadaFin === undefined
        ? undefined
        : input.fechaEstimadaFin === null
        ? null
        : new Date(input.fechaEstimadaFin);

    const actualizado = await repo.actualizarEventoPrevencion(trx, eventoId, {
      nombre: input.nombre,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      fechaEstimadaFin: fechaEstimadaFinDate,
      actualizadoPorId: usuarioId,
    });

    // 4. Sincronizar misión táctica vinculada si cambiaron nombre, descripción o prioridad
    await repo.sincronizarMisionPrevencion(trx, eventoId, {
      titulo: input.nombre,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
    });

    // 5. Consultar relaciones para construir respuesta completa
    const delegacion = await repo.buscarDelegacionPorId(trx, actualizado.delegacion_id);
    const puntoCritico = actualizado.punto_critico_id
      ? await repo.buscarPuntoCriticoPorId(trx, actualizado.punto_critico_id)
      : null;
    const misionPatrulla = await repo.obtenerMisionYPatrullaDeEventoPrevencion(trx, eventoId);

    const respuesta: EventoPrevencionEditado = {
      id: actualizado.id,
      codigo: actualizado.codigo,
      nombre: actualizado.nombre,
      descripcion: actualizado.descripcion,
      sector: actualizado.sector,
      direccionTexto: actualizado.direccion_texto,
      prioridad: actualizado.prioridad as PrioridadEventoPrevencion,
      estado: actualizado.estado as EstadoEventoPrevencion,
      latitud: Number(actualizado.latitud),
      longitud: Number(actualizado.longitud),
      puntoCritico: puntoCritico
        ? {
            id: puntoCritico.id,
            codigo: puntoCritico.codigo,
            nombre: puntoCritico.nombre,
          }
        : null,
      delegacion: delegacion
        ? {
            id: delegacion.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            codigo: (delegacion as any).codigo || (delegacion as any).codigo_delegacion || "",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nombre: (delegacion as any).nombre || (delegacion as any).nombre_delegacion || "",
          }
        : null,
      mision: misionPatrulla
        ? {
            id: misionPatrulla.m_id,
            codigo: misionPatrulla.m_codigo,
            titulo: misionPatrulla.m_titulo,
            estado: misionPatrulla.m_estado,
            tipoMision: misionPatrulla.m_tipo_mision,
          }
        : null,
      patrulla: misionPatrulla?.pv_id
        ? {
            id: misionPatrulla.pv_id,
            nombre: misionPatrulla.pv_nombre!,
            estado: misionPatrulla.pv_estado!,
          }
        : null,
      recursos: recursosRespuesta,
      fechaEstimadaFin: toIsoString(actualizado.fecha_estimada_fin),
      creadoPorId: actualizado.creado_por_id,
      actualizadoPorId: actualizado.actualizado_por_id ?? usuarioId,
      creadoEn: toIsoString(actualizado.creado_en)!,
      actualizadoEn: toIsoString(actualizado.actualizado_en)!,
    };

    return respuesta;
  });

  // 6. Notificar en tiempo real vía Socket.io
  try {
    emitirEventoPrevencionActualizado(eventoEditado);
  } catch (err) {
    console.error("Error al emitir notificación Socket.io de edición de evento de prevención:", err);
  }

  return eventoEditado;
}
