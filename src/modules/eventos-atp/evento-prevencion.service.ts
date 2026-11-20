import { db } from "@/lib/db";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import type {
  AsignarRecursosPrevencionInput,
  AsignarRecursosPrevencionResponseData,
  CrearEventoPrevencionInput,
  EditarEventoPrevencionInput,
  EstadoEventoPrevencion,
  EventoPrevencionDetalleResponseData,
  EventoPrevencionEditado,
  EventoPrevencionListadoItem,
  EventoPrevencionResponse,
  ListarEventosPrevencionQuery,
  ListarEventosPrevencionResponse,
  PrioridadEventoPrevencion,
  RecursoAsignadoPrevencionDetalle,
} from "./evento-prevencion.schema";
import * as repo from "./evento-prevencion.repository";
import { crearNotificacionMisionRepo } from "@/modules/misiones/notificacion-mision.repository";
import {
  emitirEventoPrevencionActualizado,
  emitirEventoPrevencionCreado,
  emitirRecursoActualizado,
  notificarPatrullaActualizada,
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

export class RecursoNoDisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecursoNoDisponibleError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class ConflictoEstadoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictoEstadoError";
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
    // 1. Validar existencia y disponibilidad de la patrulla verificadora (solo si se despacha al crear)
    let patrulla: Awaited<ReturnType<typeof repo.buscarPatrullaPorId>> | null = null;
    if (input.patrullaId) {
      patrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId);
      if (!patrulla) {
        throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
      }

      if (patrulla.estado !== "DISPONIBLE") {
        throw new PatrullaNoDisponibleError(
          `La patrulla "${patrulla.nombre}" no está disponible para asignación (estado actual: ${patrulla.estado}).`
        );
      }
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

    // 4. Si hay patrulla y se indicaron recursos, consolidar y validar disponibilidad
    const mapaRecursosSolicitados = new Map<string, number>();
    if (patrulla && input.recursos && input.recursos.length > 0) {
      for (const item of input.recursos) {
        const acumulado = mapaRecursosSolicitados.get(item.recursoId) ?? 0;
        mapaRecursosSolicitados.set(item.recursoId, acumulado + item.cantidad);
      }
    }

    const recursoIds = Array.from(mapaRecursosSolicitados.keys()).sort();
    const mapaNombresRecursos = new Map<string, string>();
    let recursosEnBd: Awaited<ReturnType<typeof repo.obtenerRecursosParaBloqueo>> = [];

    if (recursoIds.length > 0) {
      recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, recursoIds);
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

    // 7. Si se indicó patrulla, generar la misión y vincular los recursos exclusivamente a esa misión
    let misionResumen: EventoPrevencionResponse["mision"] = null;
    let patrullaResumen: EventoPrevencionResponse["patrulla"] = null;

    if (patrulla) {
      const codigoMision = await repo.generarSiguienteCodigoMision(trx);
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

      if (recursoIds.length > 0) {
        const asignaciones = Array.from(mapaRecursosSolicitados.entries()).map(([recursoId, cantidad]) => ({
          eventoPrevencionId: nuevoEvento.id,
          recursoId,
          misionId: nuevaMision.id,
          cantidad,
        }));
        await repo.insertarRecursosPrevencionConMision(trx, asignaciones);

        for (const recurso of recursosEnBd) {
          const cantidadSolicitada = mapaRecursosSolicitados.get(recurso.id)!;
          if (recurso.es_individual) {
            await repo.actualizarRecursoIndividualAsignado(trx, recurso.id);
          } else {
            await repo.actualizarRecursoGranelUso(trx, recurso.id, cantidadSolicitada);
          }
        }
      }

      await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_PREVENCION");
      if (patrulla.usuario_lider_id) {
        await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
      }
      await repo.insertarHitoDespachoMisionPrevencion(trx, nuevaMision.id, patrulla.nombre, usuarioId);
      await crearNotificacionMisionRepo(nuevaMision.id, patrulla.id, trx);

      misionResumen = {
        id: nuevaMision.id,
        codigo: nuevaMision.codigo,
        titulo: nuevaMision.titulo,
        estado: nuevaMision.estado,
        tipoMision: nuevaMision.tipo_mision,
      };
      patrullaResumen = {
        id: patrulla.id,
        nombre: patrulla.nombre,
        estado: "EN_PREVENCION",
      };
    }

    // 8. Formatear respuesta estructurada
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
      mision: misionResumen,
      patrulla: patrullaResumen,
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

    // 2. Obtener dotación actual de recursos asignados a las misiones del evento (solo lectura)
    const asignacionesActuales = await repo.listarRecursosAsignadosPrevencion(trx, eventoId);
    const recursosRespuesta = asignacionesActuales.map((r) => ({
      recursoId: r.recursoId,
      nombre: r.nombre,
      cantidadAsignada: Number(r.cantidadAsignada),
    }));

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

/**
 * Servicio para asignar patrulla verificadora y recursos logísticos a un evento de prevención (HU-33).
 * Aplica bloqueo transaccional SELECT FOR UPDATE sobre evento, patrulla y recurso (§3.6),
 * valida disponibilidad efectiva para granel y prohibición de individuales en mantención/asignados,
 * genera misión táctica con tipo_mision = 'PREVENCION', persiste en evento_prevencion_recurso
 * actualizando cantidad_en_uso y emite eventos WebSocket prevencion:actualizada, recurso:actualizado y patrulla:actualizada.
 */
export async function asignarRecursosPrevencionService(
  eventoPrevencionId: string,
  input: AsignarRecursosPrevencionInput,
  usuarioId: string
): Promise<AsignarRecursosPrevencionResponseData> {
  const { resultado, recursosParaSocket, patrullaPayload } = await db
    .transaction()
    .execute(async (trx) => {
      // 1. Validar existencia y estado operativo del evento de prevención con bloqueo FOR UPDATE
      const evento = await repo.buscarEventoPrevencionParaEdicion(trx, eventoPrevencionId);
      if (!evento || evento.eliminado_en !== null) {
        throw new NotFoundError("El evento de prevención indicado no fue encontrado.");
      }

      if (!evento.activo) {
        throw new ConflictoEstadoError(
          `No es posible asignar recursos al evento de prevención "${evento.nombre}" porque se encuentra desactivado del sistema.`
        );
      }

      if (ESTADOS_NO_EDITABLES.has(evento.estado)) {
        throw new ConflictoEstadoError(
          `No es posible asignar recursos a un evento de prevención en estado ${evento.estado}.`
        );
      }

      // 2. Validar existencia y disponibilidad de la patrulla verificadora con bloqueo FOR UPDATE
      const patrulla = await repo.buscarPatrullaParaBloqueo(trx, input.patrullaId);
      if (!patrulla) {
        throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
      }

      if (patrulla.estado !== "DISPONIBLE") {
        throw new PatrullaNoDisponibleError(
          `La patrulla "${patrulla.nombre}" no está disponible para asignación (estado actual: ${patrulla.estado}).`
        );
      }

      // 3. Consolidar recursos requeridos agrupando cantidades por recursoId y ordenando IDs para evitar deadlocks
      const mapaRecursosSolicitados = new Map<string, number>();
      for (const item of input.recursos) {
        const acumulado = mapaRecursosSolicitados.get(item.recursoId) ?? 0;
        mapaRecursosSolicitados.set(item.recursoId, acumulado + item.cantidad);
      }
      const recursoIds = Array.from(mapaRecursosSolicitados.keys()).sort();

      // 4. Bloquear filas de recursos con SELECT ... FOR UPDATE
      const recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, recursoIds);
      if (recursosEnBd.length !== recursoIds.length) {
        const encontrados = new Set(recursosEnBd.map((r) => r.id));
        const faltantes = recursoIds.filter((id) => !encontrados.has(id));
        throw new NotFoundError(
          `Uno o más recursos solicitados no existen en el inventario: ${faltantes.join(", ")}`
        );
      }

      // 5. Validar regla de negocio §3.6 (Inventario híbrido)
      for (const recurso of recursosEnBd) {
        const cantidadSolicitada = mapaRecursosSolicitados.get(recurso.id)!;

        if (recurso.es_individual) {
          if (cantidadSolicitada !== 1) {
            throw new BadRequestError(
              `El activo individual o vehículo "${recurso.nombre}" solo admite una cantidad asignada de 1 unidad.`
            );
          }
          if (recurso.estado === "EN_MANTENCION") {
            throw new RecursoNoDisponibleError(
              `El activo individual "${recurso.nombre}" se encuentra en mantención y no puede ser asignado.`
            );
          }
          if (recurso.estado === "NO_DISPONIBLE") {
            throw new RecursoNoDisponibleError(
              `El activo individual "${recurso.nombre}" no se encuentra disponible.`
            );
          }
          if (recurso.estado === "ASIGNADO" || Number(recurso.cantidad_en_uso ?? 0) >= 1) {
            throw new RecursoNoDisponibleError(
              `El activo individual "${recurso.nombre}" ya se encuentra asignado a otra misión u operación activa.`
            );
          }
        } else {
          if (recurso.estado === "EN_MANTENCION") {
            throw new RecursoNoDisponibleError(
              `El recurso "${recurso.nombre}" se encuentra en mantención y no puede ser asignado.`
            );
          }
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

      // 6. Generar correlativo oficial de misión
      const codigoMision = await repo.generarSiguienteCodigoMision(trx);

      // 7. Crear misión táctica tipo PREVENCION vinculada a evento_prevencion_id (sin incidente previo §3.4)
      const nuevaMision = await repo.insertarMisionPrevencion(trx, {
        codigo: codigoMision,
        titulo: `Despacho preventivo: ${evento.nombre}`,
        descripcion: evento.descripcion,
        prioridad: evento.prioridad,
        eventoPrevencionId: evento.id,
        puntoCriticoId: evento.punto_critico_id,
        patrullaId: patrulla.id,
        encargadoId: usuarioId,
        creadoPorId: usuarioId,
      });

      // 8. Registrar asignaciones en evento_prevencion_recurso vinculadas a mision_id y actualizar cantidad_en_uso
      const asignaciones = Array.from(mapaRecursosSolicitados.entries()).map(
        ([recursoId, cantidad]) => ({
          eventoPrevencionId: evento.id,
          recursoId,
          misionId: nuevaMision.id,
          cantidad,
        })
      );
      await repo.insertarRecursosPrevencionConMision(trx, asignaciones);

      const recursosDetalleRespuesta: RecursoAsignadoPrevencionDetalle[] = [];
      const recursosParaSocket: Record<string, unknown>[] = [];

      for (const recurso of recursosEnBd) {
        const cantidadSolicitada = mapaRecursosSolicitados.get(recurso.id)!;
        const recursoActualizado = recurso.es_individual
          ? await repo.actualizarRecursoIndividualAsignado(trx, recurso.id)
          : await repo.actualizarRecursoGranelUso(trx, recurso.id, cantidadSolicitada);

        recursosDetalleRespuesta.push({
          recursoId: recursoActualizado.id,
          nombre: recursoActualizado.nombre,
          esIndividual: Boolean(recursoActualizado.es_individual),
          cantidadAsignada: cantidadSolicitada,
          cantidadEnUso: Number(recursoActualizado.cantidad_en_uso),
          estadoRecurso: recursoActualizado.estado,
        });

        recursosParaSocket.push(recursoActualizado as unknown as Record<string, unknown>);
      }

      // 9. Transicionar patrulla a EN_PREVENCION, evento a EN_CURSO y registrar hito + notificación móvil
      await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_PREVENCION");
      if (patrulla.usuario_lider_id) {
        await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
      }
      if (evento.estado === "PLANIFICADA") {
        await repo.actualizarEstadoEventoPrevencionEnCurso(trx, evento.id, usuarioId);
      } else {
        await repo.marcarActualizacionEventoPrevencion(trx, evento.id, usuarioId);
      }
      await repo.insertarHitoDespachoMisionPrevencion(trx, nuevaMision.id, patrulla.nombre, usuarioId);
      await crearNotificacionMisionRepo(nuevaMision.id, patrulla.id, trx);

      const estadoEventoActualizado =
        evento.estado === "PLANIFICADA" ? "EN_CURSO" : evento.estado;

      const asignadoEn = new Date().toISOString();

      const patrullaPayload = {
        patrullaId: patrulla.id,
        nombre: patrulla.nombre,
        estado: "EN_PREVENCION",
        delegacionId: patrulla.delegacion_id,
        usuarioLiderId: patrulla.usuario_lider_id,
        misionActivaId: nuevaMision.id,
        incidenteId: null,
        actualizadoEn: asignadoEn,
      };

      const resultado: AsignarRecursosPrevencionResponseData = {
        evento: {
          id: evento.id,
          codigo: evento.codigo,
          nombre: evento.nombre,
          estado: estadoEventoActualizado as EstadoEventoPrevencion,
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
        recursos: recursosDetalleRespuesta,
        asignadoEn,
      };

      return { resultado, recursosParaSocket, patrullaPayload };
    });

  // 11. Emisiones en tiempo real vía WebSockets / Redis PubSub
  try {
    emitirEventoPrevencionActualizado({
      id: resultado.evento.id,
      codigo: resultado.evento.codigo,
      nombre: resultado.evento.nombre,
      ...resultado,
    });
    for (const recurso of recursosParaSocket) {
      emitirRecursoActualizado(recurso);
    }
    notificarPatrullaActualizada(patrullaPayload);
  } catch (err) {
    console.error(
      "Error al emitir notificaciones Socket.io tras asignación a prevención:",
      err
    );
  }

  return resultado;
}

/**
 * Consulta el detalle integral de un evento de prevención comunal, incluyendo
 * punto crítico PostGIS asociado, delegación, misiones desplegadas y recursos asignados (HU-33).
 */
export async function obtenerDetalleEventoPrevencionService(
  eventoPrevencionId: string
): Promise<EventoPrevencionDetalleResponseData> {
  const evento = await repo.buscarEventoPrevencionDetallePorId(eventoPrevencionId);
  if (!evento) {
    throw new NotFoundError("El evento de prevención indicado no fue encontrado.");
  }

  const [misionesDb, recursosDb] = await Promise.all([
    repo.buscarMisionesPorEventoPrevencionId(evento.ep_id),
    repo.buscarRecursosAsignadosDetallePorEventoPrevencionId(evento.ep_id),
  ]);

  return {
    id: evento.ep_id,
    codigo: evento.ep_codigo,
    nombre: evento.ep_nombre,
    descripcion: evento.ep_descripcion,
    sector: evento.ep_sector,
    direccionTexto: evento.ep_direccion_texto,
    prioridad: evento.ep_prioridad as PrioridadEventoPrevencion,
    estado: evento.ep_estado as EstadoEventoPrevencion,
    latitud: Number(evento.ep_latitud),
    longitud: Number(evento.ep_longitud),
    ubicacionGeoJson: evento.ep_ubicacion_geojson ?? null,
    puntoCritico: evento.pc_id
      ? {
          id: evento.pc_id,
          codigo: evento.pc_codigo!,
          nombre: evento.pc_nombre!,
          descripcion: evento.pc_descripcion ?? null,
          tipoRiesgo: evento.pc_tipo_riesgo ?? null,
          prioridad: (evento.pc_prioridad ?? "MEDIA") as PrioridadEventoPrevencion,
          latitud: Number(evento.pc_latitud),
          longitud: Number(evento.pc_longitud),
          ubicacionGeoJson: evento.pc_ubicacion_geojson ?? null,
        }
      : null,
    delegacion: evento.del_id
      ? {
          id: evento.del_id,
          codigo: evento.del_codigo ?? "",
          nombre: evento.del_nombre ?? "",
        }
      : null,
    misiones: misionesDb.map((m) => ({
      id: m.m_id,
      codigo: m.m_codigo,
      titulo: m.m_titulo,
      estado: m.m_estado,
      tipoMision: m.m_tipo_mision,
      patrulla: m.pv_id
        ? {
            id: m.pv_id,
            nombre: m.pv_nombre!,
            estado: m.pv_estado!,
          }
        : null,
      cuadrilla: m.c_id
        ? {
            id: m.c_id,
            nombre: m.c_nombre!,
            estado: m.c_estado!,
          }
        : null,
      fechaInicio: toIsoString(m.m_fecha_inicio),
      fechaCierre: toIsoString(m.m_fecha_cierre),
      creadoEn: toIsoString(m.m_creado_en)!,
    })),
    recursosAsignados: recursosDb.map((r) => ({
      id: r.id,
      recursoId: r.recurso_id,
      nombre: r.recurso_nombre ?? "Recurso",
      esIndividual: Boolean(r.recurso_es_individual),
      cantidadAsignada: Number(r.cantidad_asignada),
      misionId: r.mision_id ?? null,
      creadoEn: toIsoString(r.creado_en)!,
    })),
    fechaEstimadaFin: toIsoString(evento.ep_fecha_estimada_fin),
    creadoPorId: evento.ep_creado_por_id,
    actualizadoPorId: evento.ep_actualizado_por_id ?? null,
    creadoEn: toIsoString(evento.ep_creado_en)!,
    actualizadoEn: toIsoString(evento.ep_actualizado_en)!,
  };
}
