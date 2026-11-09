import { db } from "@/lib/db";
import type {
  CrearEventoRecuperacionInput,
  EventoRecuperacionResponse,
  AsignarRecursosRecuperacionInput,
  AsignarRecursosRecuperacionResponseData,
  RecuperacionDetalleResponseData,
  RecursoAsignadoDetalle,
} from "./recuperacion.schema";
import * as repo from "./recuperacion.repository";
import {
  emitirRecuperacionCreada,
  emitirRecuperacionActualizada,
  emitirRecursoActualizado,
  emitirPatrullaActualizada,
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

/**
 * Servicio de negocio para la creación atómica de eventos de recuperación (HU-29).
 * Valida disponibilidad de patrulla, existencia y stock de inventario, descuenta insumos
 * y despacha la misión operativa con notificación en tiempo real.
 */
export async function crearEventoRecuperacionService(
  input: CrearEventoRecuperacionInput,
  usuarioId: string
): Promise<EventoRecuperacionResponse> {
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

    // 2. Consolidar recursos requeridos agrupando cantidades por recursoId
    const mapaRecursosSolicitados = new Map<string, number>();
    for (const item of input.recursos) {
      const acumulado = mapaRecursosSolicitados.get(item.recursoId) ?? 0;
      mapaRecursosSolicitados.set(item.recursoId, acumulado + item.cantidad);
    }
    const recursoIds = Array.from(mapaRecursosSolicitados.keys());

    // 3. Bloquear filas de recursos para evitar colisiones y validar existencia
    const recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, recursoIds);
    if (recursosEnBd.length !== recursoIds.length) {
      const encontrados = new Set(recursosEnBd.map((r) => r.id));
      const faltantes = recursoIds.filter((id) => !encontrados.has(id));
      throw new NotFoundError(
        `Uno o más recursos solicitados no existen en el inventario: ${faltantes.join(", ")}`
      );
    }

    // 4. Validar stock disponible para cada insumo (cantidad_inventario - cantidad_en_uso)
    const mapaNombresRecursos = new Map<string, string>();
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

    // 5. Generar correlativos oficiales
    const codigoRecuperacion = await repo.generarSiguienteCodigoRecuperacion(trx);
    const codigoMision = await repo.generarSiguienteCodigoMision(trx);

    // 6. Insertar evento de recuperación
    const delegacionIdEfectiva = input.delegacionId ?? patrulla.delegacion_id;
    const nuevaRecuperacion = await repo.insertarRecuperacion(trx, {
      codigo: codigoRecuperacion,
      nombre: input.nombre,
      descripcion: input.descripcion,
      sector: input.sector,
      direccionTexto: input.direccionTexto,
      prioridad: input.prioridad,
      contactoNombre: input.contactoNombre,
      contactoTelefono: input.contactoTelefono,
      latitud: input.latitud,
      longitud: input.longitud,
      familiasAfectadas: input.familiasAfectadas,
      delegacionId: delegacionIdEfectiva,
      creadoPorId: usuarioId,
    });

    // 7. Insertar misión táctica vinculada
    const nuevaMision = await repo.insertarMisionRecuperacion(trx, {
      codigo: codigoMision,
      titulo: input.nombre,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      patrullaId: patrulla.id,
      recuperacionId: nuevaRecuperacion.id,
      encargadoId: usuarioId,
      creadoPorId: usuarioId,
    });

    // 8. Registrar asignaciones de recursos e impactar inventario (Opción B: descuento directo)
    const asignaciones = Array.from(mapaRecursosSolicitados.entries()).map(([recursoId, cantidad]) => ({
      recuperacionId: nuevaRecuperacion.id,
      recursoId,
      cantidad,
    }));
    await repo.insertarRecursosRecuperacion(trx, asignaciones);

    for (const [recursoId, cantidad] of mapaRecursosSolicitados.entries()) {
      await repo.descontarStockRecurso(trx, recursoId, cantidad);
    }

    // 9. Actualizar estado de la patrulla a "EN_RECUPERACION"
    await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_RECUPERACION");

    // 10. Actualizar disponibilidad del funcionario líder si aplica
    if (patrulla.usuario_lider_id) {
      await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
    }

    // 11. Obtener datos de delegación para la respuesta estructurada
    let delegacionData = null;
    if (delegacionIdEfectiva) {
      const del = await repo.buscarDelegacionPorId(trx, delegacionIdEfectiva);
      if (del) {
        delegacionData = {
          id: del.id,
          codigo: del.codigo || del.codigo_delegacion || "",
          nombre: del.nombre || del.nombre_delegacion || "",
        };
      }
    }

    // 12. Construir respuesta estructurada
    const recursosRespuesta = Array.from(mapaRecursosSolicitados.entries()).map(([recursoId, cantidad]) => ({
      recursoId,
      nombre: mapaNombresRecursos.get(recursoId) || "Recurso",
      cantidadAsignada: cantidad,
    }));

    const respuesta: EventoRecuperacionResponse = {
      id: nuevaRecuperacion.id,
      codigo: nuevaRecuperacion.codigo,
      nombre: nuevaRecuperacion.nombre,
      descripcion: nuevaRecuperacion.descripcion,
      sector: nuevaRecuperacion.sector,
      direccionTexto: nuevaRecuperacion.direccion_texto,
      prioridad: nuevaRecuperacion.prioridad,
      contactoNombre: nuevaRecuperacion.contacto_nombre,
      contactoTelefono: nuevaRecuperacion.contacto_telefono,
      latitud: Number(nuevaRecuperacion.latitud),
      longitud: Number(nuevaRecuperacion.longitud),
      estado: nuevaRecuperacion.estado,
      familiasAfectadas: Number(nuevaRecuperacion.familias_afectadas),
      delegacion: delegacionData,
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
        estado: "EN_RECUPERACION",
      },
      recursos: recursosRespuesta,
      creadoPorId: usuarioId,
      creadoEn: nuevaRecuperacion.creado_en instanceof Date 
        ? nuevaRecuperacion.creado_en.toISOString() 
        : String(nuevaRecuperacion.creado_en),
      actualizadoEn: nuevaRecuperacion.actualizado_en instanceof Date 
        ? nuevaRecuperacion.actualizado_en.toISOString() 
        : String(nuevaRecuperacion.actualizado_en),
    };

    return respuesta;
  });

  // 13. Notificar en tiempo real vía Socket.io y Redis a las salas de monitoreo
  try {
    emitirRecuperacionCreada(eventoCreado);
  } catch (err) {
    console.error("Error al emitir notificación Socket.io de evento de recuperación:", err);
  }

  return eventoCreado;
}

/**
 * Servicio para asignar patrulla y recursos logísticos a un evento de recuperación existente (HU-32).
 * Aplica bloqueo transaccional FOR UPDATE sobre recurso, valida disponibilidad y stock híbrido (§3.6),
 * genera misión táctica RECUPERACION, actualiza patrulla a EN_RECUPERACION y emite WebSockets.
 */
export async function asignarRecursosRecuperacionService(
  recuperacionId: string,
  input: AsignarRecursosRecuperacionInput,
  usuarioId: string
): Promise<AsignarRecursosRecuperacionResponseData> {
  const { resultado, recursosParaSocket, patrullaPayload } = await db.transaction().execute(async (trx) => {
    // 1. Validar existencia del evento de recuperación
    const evento = await repo.buscarRecuperacionPorId(trx, recuperacionId);
    if (!evento) {
      throw new NotFoundError("El evento de recuperación indicado no fue encontrado.");
    }

    if (evento.estado === "COMPLETADA" || evento.estado === "CANCELADA") {
      throw new ConflictoEstadoError(
        `No es posible asignar recursos a un evento de recuperación en estado ${evento.estado}.`
      );
    }

    // 2. Validar existencia y disponibilidad de la patrulla verificadora
    const patrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId);
    if (!patrulla) {
      throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
    }

    if (patrulla.estado !== "DISPONIBLE") {
      throw new PatrullaNoDisponibleError(
        `La patrulla "${patrulla.nombre}" no está disponible para asignación (estado actual: ${patrulla.estado}).`
      );
    }

    // 3. Consolidar recursos requeridos agrupando cantidades por recursoId
    const mapaRecursosSolicitados = new Map<string, number>();
    for (const item of input.recursos) {
      const acumulado = mapaRecursosSolicitados.get(item.recursoId) ?? 0;
      mapaRecursosSolicitados.set(item.recursoId, acumulado + item.cantidad);
    }
    const recursoIds = Array.from(mapaRecursosSolicitados.keys());

    // 4. Bloquear filas de recursos con FOR UPDATE para evitar sobregiro concurrente
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
        if (recurso.estado === "ASIGNADO") {
          throw new RecursoNoDisponibleError(
            `El activo individual "${recurso.nombre}" ya se encuentra asignado a otra misión u operación activa.`
          );
        }
      } else {
        // Insumo a granel
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

    // 6. Generar correlativo de misión oficial
    const codigoMision = await repo.generarSiguienteCodigoMision(trx);

    // 7. Insertar misión táctica tipo RECUPERACION
    const nuevaMision = await repo.insertarMisionRecuperacion(trx, {
      codigo: codigoMision,
      titulo: `Despacho operativo: ${evento.nombre}`,
      descripcion: evento.descripcion,
      prioridad: evento.prioridad,
      patrullaId: patrulla.id,
      recuperacionId: evento.id,
      encargadoId: usuarioId,
      creadoPorId: usuarioId,
    });

    // 8. Registrar asignaciones de recursos vinculadas a la misión e impactar inventario
    const asignaciones = Array.from(mapaRecursosSolicitados.entries()).map(([recursoId, cantidad]) => ({
      recuperacionId: evento.id,
      recursoId,
      misionId: nuevaMision.id,
      cantidad,
    }));
    await repo.insertarRecursosRecuperacionConMision(trx, asignaciones);

    const recursosDetalleRespuesta: RecursoAsignadoDetalle[] = [];
    const recursosParaSocket: Record<string, unknown>[] = [];

    for (const recurso of recursosEnBd) {
      const cantidadSolicitada = mapaRecursosSolicitados.get(recurso.id)!;
      let recursoActualizado;

      if (recurso.es_individual) {
        recursoActualizado = await repo.actualizarRecursoIndividualAsignado(trx, recurso.id);
      } else {
        recursoActualizado = await repo.actualizarRecursoGranelUso(trx, recurso.id, cantidadSolicitada);
      }

      recursosDetalleRespuesta.push({
        recursoId: recursoActualizado.id,
        nombre: recursoActualizado.nombre,
        esIndividual: recursoActualizado.es_individual,
        cantidadAsignada: cantidadSolicitada,
        cantidadEnUso: Number(recursoActualizado.cantidad_en_uso),
        estadoRecurso: recursoActualizado.estado,
      });

      recursosParaSocket.push(recursoActualizado as unknown as Record<string, unknown>);
    }

    // 9. Actualizar patrulla a EN_RECUPERACION
    await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_RECUPERACION");
    if (patrulla.usuario_lider_id) {
      await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
    }

    const asignadoEn = new Date().toISOString();

    const patrullaPayload = {
      patrullaId: patrulla.id,
      nombre: patrulla.nombre,
      estado: "EN_RECUPERACION",
      delegacionId: patrulla.delegacion_id,
      usuarioLiderId: patrulla.usuario_lider_id,
      misionActivaId: nuevaMision.id,
      incidenteId: null,
      actualizadoEn: asignadoEn,
    };

    const resultado: AsignarRecursosRecuperacionResponseData = {
      evento: {
        id: evento.id,
        codigo: evento.codigo,
        nombre: evento.nombre,
        estado: evento.estado,
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
        estado: "EN_RECUPERACION",
      },
      recursos: recursosDetalleRespuesta,
      asignadoEn,
    };

    return { resultado, recursosParaSocket, patrullaPayload };
  });

  // 10. Emisiones en tiempo real vía WebSockets / Redis
  try {
    emitirRecuperacionActualizada(resultado);
    for (const recurso of recursosParaSocket) {
      emitirRecursoActualizado(recurso);
    }
    emitirPatrullaActualizada(patrullaPayload);
  } catch (err) {
    console.error("Error al emitir notificaciones Socket.io tras asignación a recuperación:", err);
  }

  return resultado;
}

/**
 * Consulta la ficha y detalle completo de un evento de recuperación, incluyendo
 * sus misiones operativas desplegadas y los insumos logísticos asignados.
 */
export async function obtenerDetalleRecuperacionService(
  recuperacionId: string
): Promise<RecuperacionDetalleResponseData> {
  const evento = await repo.buscarRecuperacionPorId(db, recuperacionId);
  if (!evento) {
    throw new NotFoundError("El evento de recuperación no fue encontrado.");
  }

  let delegacionData = null;
  if (evento.delegacion_id) {
    const del = await repo.buscarDelegacionPorId(db, evento.delegacion_id);
    if (del) {
      delegacionData = {
        id: del.id,
        codigo: del.codigo || del.codigo_delegacion || "",
        nombre: del.nombre || del.nombre_delegacion || "",
      };
    }
  }

  const misionesDb = await repo.buscarMisionesPorRecuperacionId(evento.id);
  const recursosDb = await repo.buscarRecursosAsignadosPorRecuperacionId(evento.id);

  return {
    id: evento.id,
    codigo: evento.codigo,
    nombre: evento.nombre,
    descripcion: evento.descripcion,
    sector: evento.sector,
    direccionTexto: evento.direccion_texto,
    prioridad: evento.prioridad,
    contactoNombre: evento.contacto_nombre,
    contactoTelefono: evento.contacto_telefono,
    latitud: Number(evento.latitud),
    longitud: Number(evento.longitud),
    estado: evento.estado,
    familiasAfectadas: Number(evento.familias_afectadas),
    delegacion: delegacionData,
    misiones: misionesDb.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      titulo: m.titulo,
      estado: m.estado,
      tipoMision: m.tipo_mision,
      patrulla: m.patrulla_id
        ? {
            id: m.patrulla_id,
            nombre: m.patrulla_nombre || "Patrulla",
            estado: m.patrulla_estado || "EN_RECUPERACION",
          }
        : null,
      creadoEn: m.creado_en instanceof Date ? m.creado_en.toISOString() : String(m.creado_en),
    })),
    recursosAsignados: recursosDb.map((r) => ({
      id: r.id,
      recursoId: r.recurso_id,
      nombre: r.recurso_nombre,
      esIndividual: Boolean(r.recurso_es_individual),
      cantidadAsignada: Number(r.cantidad_asignada),
      misionId: r.mision_id ?? null,
      creadoEn: r.creado_en instanceof Date ? r.creado_en.toISOString() : String(r.creado_en),
    })),
    creadoPorId: evento.creado_por_id,
    creadoEn: evento.creado_en instanceof Date ? evento.creado_en.toISOString() : String(evento.creado_en),
    actualizadoEn: evento.actualizado_en instanceof Date ? evento.actualizado_en.toISOString() : String(evento.actualizado_en),
  };
}
