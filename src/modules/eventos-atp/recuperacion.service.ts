import { db } from "@/lib/db";
import type {
  CrearEventoRecuperacionInput,
  EventoRecuperacionResponse,
} from "./recuperacion.schema";
import * as repo from "./recuperacion.repository";
import { emitirRecuperacionCreada } from "@/lib/socket";

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
