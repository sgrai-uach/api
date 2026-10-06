import { db } from "@/lib/db";
import type {
  CrearEventoPrevencionInput,
  EventoPrevencionResponse,
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
