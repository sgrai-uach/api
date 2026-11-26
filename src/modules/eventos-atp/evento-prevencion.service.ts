import { db } from "@/lib/db";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import type {
  CrearEventoPrevencionInput,
  EstadoEventoPrevencion,
  EventoPrevencionListadoItem,
  EventoPrevencionResponse,
  ListarEventosPrevencionQuery,
  ListarEventosPrevencionResponse,
  PrioridadEventoPrevencion,
} from "./evento-prevencion.schema";
import * as repo from "./evento-prevencion.repository";
import { emitirEventoPrevencionCreado } from "@/lib/socket";

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
      creadoPorId: usuarioId,
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

type GeoJsonPoint = { type: "Point"; coordinates: [number, number] };

function toGeoJsonPoint(raw: unknown): GeoJsonPoint | null {
  if (
    raw &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === "Point" &&
    "coordinates" in raw &&
    Array.isArray((raw as { coordinates: unknown }).coordinates) &&
    (raw as { coordinates: unknown[] }).coordinates.length >= 2
  ) {
    const coords = (raw as { coordinates: unknown[] }).coordinates;
    return {
      type: "Point",
      coordinates: [Number(coords[0]), Number(coords[1])],
    };
  }
  return null;
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
      ubicacionGeoJson: toGeoJsonPoint(row.ep_ubicacion_geojson),
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
            ubicacionGeoJson: toGeoJsonPoint(row.pc_ubicacion_geojson),
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
      creadoPorId: row.ep_creado_por_id,
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
