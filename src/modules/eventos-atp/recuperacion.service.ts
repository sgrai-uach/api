import { db } from "@/lib/db";
import type {
  CrearEventoRecuperacionInput,
  EditarEventoRecuperacionInput,
  EventoRecuperacionResponse,
  ListarRecuperacionesInput,
  ListarRecuperacionesResponse,
  RecuperacionDetalleResponse,
  AsignarRecursosRecuperacionInput,
  AsignarRecursosRecuperacionResponseData,
  RecuperacionDetalleResponseData,
  RecursoAsignadoDetalle,
  PrioridadRecuperacion,
  EstadoRecuperacion,
} from "./recuperacion.schema";
import { ListarRecuperacionesQuerySchema } from "./recuperacion.schema";
import * as repo from "./recuperacion.repository";
import type { KyselyTrx } from "./recuperacion.repository";
import {
  emitirRecuperacionCreada,
  emitirRecuperacionActualizada,
  emitirPatrullaLiberadaDeOperativo,
  notificarMisionAsignada,
  emitirRecursoActualizado,
  emitirPatrullaActualizada,
} from "@/lib/socket";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_LEER_RECUPERACION } from "@/modules/seguridad/permisos.constants";

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

export class RecuperacionNoEditableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecuperacionNoEditableError";
  }
}

export class FechaEstimadaInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FechaEstimadaInvalidaError";
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

async function construirRespuestaRecuperacion(
  trx: KyselyTrx,
  registro: NonNullable<Awaited<ReturnType<typeof repo.buscarRecuperacionPorId>>>,
  recursosRespuesta: Array<{ recursoId: string; nombre: string; cantidadAsignada: number }>
): Promise<EventoRecuperacionResponse> {
  let delegacionData = null;
  if (registro.delegacion_id) {
    const del = await repo.buscarDelegacionPorId(trx, registro.delegacion_id);
    if (del) {
      delegacionData = {
        id: del.id,
        codigo: del.codigo || del.codigo_delegacion || "",
        nombre: del.nombre || del.nombre_delegacion || "",
      };
    }
  }

  const mision = await repo.buscarMisionPorRecuperacionId(trx, registro.id);
  const patrulla = mision?.patrulla_id
    ? await repo.buscarPatrullaPorId(trx, mision.patrulla_id)
    : null;

  return {
    id: registro.id,
    codigo: registro.codigo,
    nombre: registro.nombre,
    descripcion: registro.descripcion,
    sector: registro.sector,
    direccionTexto: registro.direccion_texto,
    prioridad: registro.prioridad,
    contactoNombre: registro.contacto_nombre,
    contactoTelefono: registro.contacto_telefono,
    latitud: Number(registro.latitud),
    longitud: Number(registro.longitud),
    estado: registro.estado,
    familiasAfectadas: Number(registro.familias_afectadas),
    delegacion: delegacionData,
    mision: mision
      ? {
          id: mision.id,
          codigo: mision.codigo,
          titulo: mision.titulo,
          estado: mision.estado,
          tipoMision: mision.tipo_mision,
        }
      : null,
    patrulla: patrulla
      ? {
          id: patrulla.id,
          nombre: patrulla.nombre,
          estado: patrulla.estado,
        }
      : null,
    recursos: recursosRespuesta,
    creadoPorId: registro.creado_por_id,
    fechaEstimadaFin: registro.fecha_estimada_fin
      ? registro.fecha_estimada_fin instanceof Date
        ? registro.fecha_estimada_fin.toISOString()
        : String(registro.fecha_estimada_fin)
      : null,
    actualizadoPorId: registro.actualizado_por_id ?? null,
    creadoEn:
      registro.creado_en instanceof Date
        ? registro.creado_en.toISOString()
        : String(registro.creado_en),
    actualizadoEn:
      registro.actualizado_en instanceof Date
        ? registro.actualizado_en.toISOString()
        : String(registro.actualizado_en),
  };
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
    // 1. Validar existencia del evento de recuperación con bloqueo transaccional
    const evento = await repo.buscarRecuperacionPorId(trx, recuperacionId, true);
    if (!evento) {
      throw new NotFoundError("El evento de recuperación indicado no fue encontrado.");
    }

    if (evento.estado === "COMPLETADA" || evento.estado === "CANCELADA") {
      throw new ConflictoEstadoError(
        `No es posible asignar recursos a un evento de recuperación en estado ${evento.estado}.`
      );
    }

    // 2. Validar existencia y disponibilidad de la patrulla verificadora con bloqueo pesimista
    const patrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId, true);
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

        const inventario = Number(recurso.cantidad_inventario);
        const enUso = Number(recurso.cantidad_en_uso ?? 0);
        const disponible = Math.max(0, inventario - enUso);
        if (disponible < 1) {
          throw new RecursoNoDisponibleError(
            `El activo individual "${recurso.nombre}" no cuenta con unidades disponibles para asignación (inventario: ${inventario}, en uso: ${enUso}).`
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

    // 7. Insertar misión táctica tipo RECUPERACION (fecha_inicio en null para estado DESPACHADA)
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

    // 7.1. Registrar hito inicial en bitácora táctica (mision_hito)
    await repo.registrarHitoMisionInicial(trx, nuevaMision.id, usuarioId, patrulla.nombre);

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

      const inv = Number(recursoActualizado.cantidad_inventario);
      const uso = Number(recursoActualizado.cantidad_en_uso);

      recursosDetalleRespuesta.push({
        recursoId: recursoActualizado.id,
        nombre: recursoActualizado.nombre,
        esIndividual: recursoActualizado.es_individual,
        cantidadAsignada: cantidadSolicitada,
        cantidadEnUso: uso,
        estadoRecurso: recursoActualizado.estado,
      });

      recursosParaSocket.push({
        id: recursoActualizado.id,
        nombre: recursoActualizado.nombre,
        esIndividual: recursoActualizado.es_individual,
        estado: recursoActualizado.estado,
        cantidadInventario: inv,
        cantidadEnUso: uso,
        cantidadDisponible: Math.max(0, inv - uso),
        cantidadMinima: Number(recursoActualizado.cantidad_minima ?? 0),
        actualizadoEn: new Date().toISOString(),
      });
    }

    // 9. Actualizar patrulla a EN_RECUPERACION atómicamente verificando concurrencia
    const patrullaActualizada = await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_RECUPERACION");
    if (!patrullaActualizada) {
      throw new PatrullaNoDisponibleError(
        `La patrulla "${patrulla.nombre}" ya no se encuentra en estado 'DISPONIBLE' (fue modificada concurrentemente).`
      );
    }

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
export async function obtenerDetalleRecuperacionEventoService(
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
      nombre: r.recurso_nombre ?? "Recurso",
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

/**
 * Lista todos los eventos de recuperación territoriales registrados con sus misiones tácticas,
 * patrulla asignada y recursos logísticos despachados para visualización táctica en el mapa operativo.
 */
export async function listarEventosRecuperacionService(): Promise<EventoRecuperacionResponse[]> {
  const eventosDb = await repo.listarRecuperacionesRepo(db);
  if (eventosDb.length === 0) return [];

  const ids = eventosDb.map((e) => e.id);
  const misionesDb = await repo.listarMisionesPorRecuperacionIds(ids);
  const recursosDb = await repo.listarRecursosPorRecuperacionIds(ids);

  const misionesPorRecuperacion = new Map<string, typeof misionesDb>();
  for (const m of misionesDb) {
    if (!m.recuperacion_id) continue;
    const lista = misionesPorRecuperacion.get(m.recuperacion_id) || [];
    lista.push(m);
    misionesPorRecuperacion.set(m.recuperacion_id, lista);
  }

  const recursosPorRecuperacion = new Map<string, typeof recursosDb>();
  for (const r of recursosDb) {
    const lista = recursosPorRecuperacion.get(r.recuperacion_id) || [];
    lista.push(r);
    recursosPorRecuperacion.set(r.recuperacion_id, lista);
  }

  return eventosDb.map((ev) => {
    const misiones = misionesPorRecuperacion.get(ev.id) || [];
    const primeraMision = misiones[0];
    const recursos = recursosPorRecuperacion.get(ev.id) || [];

    return {
      id: ev.id,
      codigo: ev.codigo,
      nombre: ev.nombre,
      descripcion: ev.descripcion,
      sector: ev.sector,
      direccionTexto: ev.direccion_texto,
      prioridad: ev.prioridad as PrioridadRecuperacion,
      contactoNombre: ev.contacto_nombre,
      contactoTelefono: ev.contacto_telefono,
      latitud: Number(ev.latitud),
      longitud: Number(ev.longitud),
      estado: ev.estado as EstadoRecuperacion,
      familiasAfectadas: Number(ev.familias_afectadas),
      delegacion: ev.delegacion_id
        ? {
          id: ev.delegacion_id,
          codigo: ev.delegacion_codigo || "",
          nombre: ev.delegacion_nombre || "",
        }
        : null,
      mision: primeraMision
        ? {
          id: primeraMision.id,
          codigo: primeraMision.codigo,
          titulo: primeraMision.titulo,
          estado: primeraMision.estado,
          tipoMision: primeraMision.tipo_mision,
        }
        : {
          id: "00000000-0000-0000-0000-000000000000",
          codigo: "SIN-MISION",
          titulo: "Sin misión táctica asignada",
          estado: "PLANIFICADA",
          tipoMision: "RECUPERACION",
        },
      patrulla: primeraMision?.patrulla_id
        ? {
          id: primeraMision.patrulla_id,
          nombre: primeraMision.patrulla_nombre || "Patrulla",
          estado: primeraMision.patrulla_estado || "EN_RECUPERACION",
        }
        : null,
      recursos: recursos.map((r) => ({
        recursoId: r.recurso_id,
        nombre: r.recurso_nombre,
        cantidadAsignada: Number(r.cantidad_asignada),
      })),
      creadoPorId: ev.creado_por_id,
      creadoEn: ev.creado_en instanceof Date ? ev.creado_en.toISOString() : String(ev.creado_en),
      actualizadoEn: ev.actualizado_en instanceof Date ? ev.actualizado_en.toISOString() : String(ev.actualizado_en),
    };
  });
}

/**
 * Servicio de listado paginado y filtrable de operativos de recuperación post-desastre (H73).
 * Valida permiso RBAC 'recuperacion:leer', calcula metadatos H34 y retorna filas con desglose de insumos.
 */
export async function listarRecuperacionesService(
  filtros: ListarRecuperacionesInput,
  usuarioId?: string | null
): Promise<ListarRecuperacionesResponse> {
  // 1. Control de Acceso RBAC
  await verificarPermiso(usuarioId, PERMISO_LEER_RECUPERACION);

  // 2. Validar y normalizar parámetros
  const queryValidada = ListarRecuperacionesQuerySchema.parse(filtros);

  // 3. Consulta paginada y conteo en repositorio
  const { filas, total } = await repo.listarRecuperacionesPaginadoRepo(queryValidada);

  // 4. Metadatos bajo estándar H34
  const page = queryValidada.page ?? queryValidada.pagina ?? 1;
  const limit = queryValidada.limit ?? queryValidada.limite ?? 20;
  const meta = buildPaginationMeta(total, page, limit);

  return {
    message: "Listado de operativos de recuperación obtenido exitosamente",
    data: filas,
    meta,
  };
}

/**
 * Obtiene el detalle completo de un operativo de recuperación para precarga de edición (HU-74).
 */
export async function obtenerEventoRecuperacionPorIdService(
  recuperacionId: string
): Promise<EventoRecuperacionResponse> {
  return db.transaction().execute(async (trx) => {
    const registro = await repo.buscarRecuperacionPorId(trx, recuperacionId);
    if (!registro) {
      throw new NotFoundError("El operativo de recuperación indicado no fue encontrado.");
    }

    const asignaciones = await repo.listarRecursosAsignadosRecuperacion(trx, recuperacionId);
    const recursosRespuesta = asignaciones.map((r) => ({
      recursoId: r.recursoId,
      nombre: r.nombre,
      cantidadAsignada: Number(r.cantidadAsignada),
    }));

    return construirRespuestaRecuperacion(trx, registro, recursosRespuesta);
  });
}

/**
 * Servicio de negocio para editar la planificación de un operativo de recuperación activo (HU-74).
 * Bloquea la edición en estados COMPLETADA o CANCELADA, registra auditoría (actualizado_en, actualizado_por_id),
 * recalcula diferencias de stock de recursos de forma atómica, permite reasignar patrulla verificadora
 * liberando la anterior y sincroniza la misión asociada.
 */
export async function editarEventoRecuperacionService(
  recuperacionId: string,
  input: EditarEventoRecuperacionInput,
  usuarioId: string
): Promise<EventoRecuperacionResponse> {
  type PatrullaReasignadaData = {
    misionId: string;
    codigoMision: string;
    patrullaAnteriorId: string | null;
    patrullaNuevaId: string;
    prioridad: string;
    direccion: string | null;
    notificacionId?: string;
  };
  let patrullaReasignadaData: PatrullaReasignadaData | null = null;
  const recursosParaSocket: Array<{
    id: string;
    nombre: string;
    esIndividual: boolean;
    estado: string;
    cantidadInventario: number;
    cantidadEnUso: number;
    cantidadMinima: number;
  }> = [];
  const patrullasParaSocket: Array<{
    patrullaId: string;
    nombre: string;
    estado: string;
    delegacionId: string | null;
    usuarioLiderId: string | null;
    misionActivaId?: string | null;
  }> = [];

  const { eventoActualizado, patrullaReasignadaInfo } = await db.transaction().execute(async (trx) => {
    // 1. Verificar existencia del operativo con bloqueo pesimista FOR UPDATE (BUG-H74-API-01)
    const actual = await repo.buscarRecuperacionPorId(trx, recuperacionId, true);
    if (!actual) {
      throw new NotFoundError("El operativo de recuperación indicado no fue encontrado.");
    }

    // 2. Bloquear edición si el operativo ya culminó o fue cancelado
    if (actual.estado === "COMPLETADA" || actual.estado === "CANCELADA") {
      throw new RecuperacionNoEditableError(
        `No es posible editar un operativo de recuperación en estado ${actual.estado}.`
      );
    }

    // 3. Validar fecha estimada de término si fue proporcionada
    let fechaEstimadaFinParsed: Date | null | undefined = undefined;
    if (input.fechaEstimadaFin !== undefined) {
      if (input.fechaEstimadaFin === null) {
        fechaEstimadaFinParsed = null;
      } else {
        fechaEstimadaFinParsed = new Date(input.fechaEstimadaFin);
        const creadoEn =
          actual.creado_en instanceof Date
            ? actual.creado_en
            : new Date(String(actual.creado_en));
        if (fechaEstimadaFinParsed.getTime() < creadoEn.getTime()) {
          throw new FechaEstimadaInvalidaError(
            "La fecha estimada de término no puede ser anterior a la fecha de creación del operativo."
          );
        }
      }
    }

    // Obtener misión activa actual (para preservar mision_id en recursos y reasignaciones)
    let misionActual = await repo.buscarMisionPorRecuperacionId(trx, recuperacionId);

    // 4. Reasignación diferencial de recursos si se envió el arreglo `recursos`
    const asignacionesActuales = await repo.listarRecursosAsignadosRecuperacion(
      trx,
      recuperacionId
    );
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

      const mapaActuales = new Map<
        string,
        { cantidad: number; nombre: string; misionId: string | null }
      >();
      for (const item of asignacionesActuales) {
        mapaActuales.set(item.recursoId, {
          cantidad: Number(item.cantidadAsignada),
          nombre: item.nombre,
          misionId: item.misionId ?? null,
        });
      }

      const todosIds = Array.from(
        new Set([...mapaNuevos.keys(), ...mapaActuales.keys()])
      ).sort();

      const recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, todosIds);
      const mapaRecursosBd = new Map(recursosEnBd.map((r) => [r.id, r]));

      // Validar existencia, estado operativo (no EN_MANTENCION) y stock suficiente para incrementos
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
          if (
            recursoBd.estado === "EN_MANTENCION" ||
            recursoBd.estado === "NO_DISPONIBLE"
          ) {
            throw new StockInsuficienteError(
              `El recurso "${recursoBd.nombre}" no está disponible para asignación (estado actual: ${recursoBd.estado}).`
            );
          }

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

      const registrarSocketRecurso = (
        r: Awaited<ReturnType<typeof repo.descontarStockRecurso>> | undefined
      ) => {
        if (!r) return;
        recursosParaSocket.push({
          id: r.id,
          nombre: r.nombre,
          esIndividual: Boolean(r.es_individual),
          estado: r.estado,
          cantidadInventario: Number(r.cantidad_inventario),
          cantidadEnUso: Number(r.cantidad_en_uso ?? 0),
          cantidadMinima: Number(r.cantidad_minima ?? 0),
        });
      };

      // Devolver stock de recursos removidos completamente
      for (const [recursoId, infoActual] of mapaActuales.entries()) {
        if (!mapaNuevos.has(recursoId)) {
          const rAct = await repo.devolverStockRecurso(trx, recursoId, infoActual.cantidad);
          registrarSocketRecurso(rAct);
        }
      }

      // Ajustar stock según delta para recursos presentes en la nueva lista
      for (const [recursoId, cantidadNueva] of mapaNuevos.entries()) {
        const cantidadAnterior = mapaActuales.get(recursoId)?.cantidad ?? 0;
        const delta = cantidadNueva - cantidadAnterior;
        if (delta > 0) {
          const rAct = await repo.descontarStockRecurso(trx, recursoId, delta);
          registrarSocketRecurso(rAct);
        } else if (delta < 0) {
          const rAct = await repo.devolverStockRecurso(trx, recursoId, -delta);
          registrarSocketRecurso(rAct);
        }
      }

      // Reemplazar asignaciones en recuperacion_recurso preservando mision_id (BUG-H74-API-06)
      await repo.eliminarRecursosRecuperacion(trx, recuperacionId);
      const nuevasAsignaciones = Array.from(mapaNuevos.entries()).map(
        ([recursoId, cantidad]) => ({
          recuperacionId,
          recursoId,
          cantidad,
          misionId: mapaActuales.get(recursoId)?.misionId ?? misionActual?.id ?? null,
        })
      );
      await repo.insertarRecursosRecuperacion(trx, nuevasAsignaciones);

      recursosRespuesta = Array.from(mapaNuevos.entries()).map(([recursoId, cantidad]) => ({
        recursoId,
        nombre: mapaRecursosBd.get(recursoId)?.nombre ?? "Recurso",
        cantidadAsignada: cantidad,
      }));
    }

    // 5. Reasignar patrulla verificadora si se proporcionó `patrullaId`
    if (input.patrullaId !== undefined) {
      const nuevaPatrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId, true);
      if (!nuevaPatrulla) {
        throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
      }

      const patrullaAnteriorId = misionActual?.patrulla_id ?? null;

      if (patrullaAnteriorId !== input.patrullaId) {
        if (nuevaPatrulla.estado !== "DISPONIBLE") {
          throw new PatrullaNoDisponibleError(
            `La patrulla "${nuevaPatrulla.nombre}" no está disponible para asignación (estado actual: ${nuevaPatrulla.estado}).`
          );
        }

        // Actualizar estado de la nueva patrulla con precondición atómica DISPONIBLE (BUG-H74-API-01)
        const patrullaAsignada = await repo.actualizarEstadoPatrulla(
          trx,
          nuevaPatrulla.id,
          "EN_RECUPERACION"
        );
        if (!patrullaAsignada) {
          throw new PatrullaNoDisponibleError(
            `La patrulla "${nuevaPatrulla.nombre}" ya fue asignada por otra operación concurrente.`
          );
        }

        patrullasParaSocket.push({
          patrullaId: patrullaAsignada.id,
          nombre: patrullaAsignada.nombre,
          estado: patrullaAsignada.estado,
          delegacionId: patrullaAsignada.delegacion_id,
          usuarioLiderId: patrullaAsignada.usuario_lider_id,
          misionActivaId: misionActual?.id ?? null,
        });

        // Liberar patrulla anterior si no tiene otras misiones activas (BUG-H74-API-02)
        if (patrullaAnteriorId) {
          const otrasMisiones = await repo.contarOtrasMisionesActivasPatrulla(
            trx,
            patrullaAnteriorId,
            misionActual?.id
          );
          if (otrasMisiones === 0) {
            const patrullaLiberada = await repo.liberarPatrullaOperativo(trx, patrullaAnteriorId);
            if (patrullaLiberada) {
              patrullasParaSocket.push({
                patrullaId: patrullaLiberada.id,
                nombre: patrullaLiberada.nombre,
                estado: patrullaLiberada.estado,
                delegacionId: patrullaLiberada.delegacion_id,
                usuarioLiderId: patrullaLiberada.usuario_lider_id,
                misionActivaId: null,
              });
            }

            const integrantes = await repo.listarIntegrantesPatrullaIds(trx, patrullaAnteriorId);
            const usuariosALiberar = new Set<string>(integrantes);
            if (patrullaLiberada?.usuario_lider_id) {
              usuariosALiberar.add(patrullaLiberada.usuario_lider_id);
            }

            for (const uid of usuariosALiberar) {
              const otrasAsig = await repo.contarOtrasAsignacionesActivasUsuario(
                trx,
                uid,
                patrullaAnteriorId
              );
              if (otrasAsig === 0) {
                await repo.actualizarEstadoPersonalLider(trx, uid, "disponible");
              }
            }
          }
        }

        // Si el operativo no tenía misión previa, crear misión táctica + hito inicial (BUG-H74-API-02)
        if (!misionActual) {
          const codigoMision = await repo.generarSiguienteCodigoMision(trx);
          misionActual = await repo.insertarMisionRecuperacion(trx, {
            codigo: codigoMision,
            titulo: actual.nombre,
            descripcion: input.descripcion ?? actual.descripcion ?? undefined,
            prioridad: actual.prioridad,
            patrullaId: nuevaPatrulla.id,
            recuperacionId,
            encargadoId: usuarioId,
            creadoPorId: usuarioId,
          });
          await repo.registrarHitoMisionInicial(
            trx,
            misionActual.id,
            usuarioId,
            nuevaPatrulla.nombre
          );
        } else {
          misionActual = await repo.reasignarPatrullaMision(
            trx,
            misionActual.id,
            nuevaPatrulla.id
          );
          await repo.registrarHitoReasignacionMision(trx, {
            misionId: misionActual.id,
            descripcion: `Patrulla reasignada a "${nuevaPatrulla.nombre}" durante edición de operativo ${actual.codigo}.`,
            registradoPorId: usuarioId,
            latitud: Number(actual.latitud),
            longitud: Number(actual.longitud),
          });
        }

        const notif = await repo.insertarNotificacionMisionRecuperacion(
          trx,
          misionActual.id,
          nuevaPatrulla.id
        );

        patrullaReasignadaData = {
          misionId: misionActual.id,
          codigoMision: misionActual.codigo,
          patrullaAnteriorId,
          patrullaNuevaId: nuevaPatrulla.id,
          prioridad: actual.prioridad,
          direccion: actual.direccion_texto ?? actual.sector,
          notificacionId: notif?.id,
        };

        // Marcar líder e integrantes de la nueva patrulla como en_mision
        const integrantesNuevos = await repo.listarIntegrantesPatrullaIds(trx, nuevaPatrulla.id);
        const usuariosAOcupar = new Set<string>(integrantesNuevos);
        if (nuevaPatrulla.usuario_lider_id) {
          usuariosAOcupar.add(nuevaPatrulla.usuario_lider_id);
        }
        for (const uid of usuariosAOcupar) {
          await repo.actualizarEstadoPersonalLider(trx, uid, "en_mision");
        }
      }
    }

    // 6. Actualizar evento de recuperación con precondición de estado y auditoría (BUG-H74-API-01)
    const actualizada = await repo.actualizarRecuperacion(trx, recuperacionId, {
      descripcion: input.descripcion,
      fechaEstimadaFin: fechaEstimadaFinParsed,
      actualizadoPorId: usuarioId,
    });
    if (!actualizada) {
      throw new RecuperacionNoEditableError(
        "El operativo de recuperación cambió a un estado no editable durante la operación."
      );
    }

    // 7. Sincronizar descripción de misión vinculada si cambió la descripción
    if (input.descripcion !== undefined) {
      await repo.sincronizarDescripcionMisionRecuperacion(
        trx,
        recuperacionId,
        input.descripcion
      );
    }

    // 8. Construir respuesta estructurada
    const respuesta = await construirRespuestaRecuperacion(trx, actualizada, recursosRespuesta);
    return {
      eventoActualizado: respuesta,
      patrullaReasignadaInfo: patrullaReasignadaData,
    };
  });

  // 9. Notificar en tiempo real vía Socket.io y Redis (BUG-H74-API-05)
  try {
    emitirRecuperacionActualizada(eventoActualizado);

    const ahoraIso = new Date().toISOString();
    for (const r of recursosParaSocket) {
      emitirRecursoActualizado({
        recursoId: r.id,
        nombre: r.nombre,
        esIndividual: r.esIndividual,
        estado: r.estado,
        cantidadInventario: r.cantidadInventario,
        cantidadEnUso: r.cantidadEnUso,
        cantidadMinima: r.cantidadMinima,
        actualizadoEn: ahoraIso,
      });
    }

    for (const p of patrullasParaSocket) {
      emitirPatrullaActualizada({
        patrullaId: p.patrullaId,
        nombre: p.nombre,
        estado: p.estado,
        delegacionId: p.delegacionId,
        usuarioLiderId: p.usuarioLiderId,
        misionActivaId: p.misionActivaId ?? null,
        incidenteId: null,
        actualizadoEn: ahoraIso,
      });
    }

    if (patrullaReasignadaInfo) {
      notificarMisionAsignada({
        notificacionId: patrullaReasignadaInfo.notificacionId,
        misionId: patrullaReasignadaInfo.misionId,
        codigo: patrullaReasignadaInfo.codigoMision,
        tipoMision: "RECUPERACION",
        patrullaId: patrullaReasignadaInfo.patrullaNuevaId,
        direccion: patrullaReasignadaInfo.direccion,
        prioridad: patrullaReasignadaInfo.prioridad,
        asignadoEn: eventoActualizado.actualizadoEn,
      });

      if (patrullaReasignadaInfo.patrullaAnteriorId) {
        emitirPatrullaLiberadaDeOperativo({
          recuperacionId,
          misionId: patrullaReasignadaInfo.misionId,
          codigoMision: patrullaReasignadaInfo.codigoMision,
          patrullaAnteriorId: patrullaReasignadaInfo.patrullaAnteriorId,
          patrullaNuevaId: patrullaReasignadaInfo.patrullaNuevaId,
        });
      }
    }
  } catch (err) {
    console.error("Error al emitir notificación Socket.io de actualización de recuperación:", err);
  }

  return eventoActualizado;
}

/**
 * Servicio para consultar el detalle exhaustivo de un operativo de recuperación (H73 - Drawer).
 * Valida permiso RBAC 'recuperacion:leer' y retorna detalle de recursos, misión e historial.
 */
export async function obtenerDetalleRecuperacionService(
  id: string,
  usuarioId?: string | null
): Promise<RecuperacionDetalleResponse> {
  // 1. Control de Acceso RBAC
  await verificarPermiso(usuarioId, PERMISO_LEER_RECUPERACION);

  // 2. Consulta en repositorio
  const detalle = await repo.obtenerRecuperacionDetallePorIdRepo(id);
  if (!detalle) {
    throw new NotFoundError(`Operativo de recuperación con ID '${id}' no encontrado.`);
  }

  return detalle;
}
