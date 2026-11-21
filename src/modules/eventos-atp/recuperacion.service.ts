import { db } from "@/lib/db";
import type {
  CrearEventoRecuperacionInput,
  EditarEventoRecuperacionInput,
  EventoRecuperacionResponse,
  ListarRecuperacionesInput,
  ListarRecuperacionesResponse,
  RecuperacionDetalleResponse,
  CerrarRecuperacionInput,
  CerrarRecuperacionResponseData,
  ConsumoRecursoCierre,
  RecursoReintegradoCierre,
} from "./recuperacion.schema";
import { ListarRecuperacionesQuerySchema } from "./recuperacion.schema";
import * as repo from "./recuperacion.repository";
import type { KyselyTrx } from "./recuperacion.repository";
import {
  emitirRecuperacionCreada,
  emitirRecuperacionActualizada,
  emitirPatrullaLiberadaDeOperativo,
  emitirRecursoActualizado,
  notificarMisionAsignada,
  notificarMisionActualizada,
  notificarPatrullaActualizada,
  type MisionActualizadaPayload,
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

export class ConsumoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsumoInvalidoError";
  }
}

export class RecuperacionNoCerrableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecuperacionNoCerrableError";
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
  registro: Awaited<ReturnType<typeof repo.actualizarRecuperacion>>,
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
      : {
        id: "00000000-0000-0000-0000-000000000000",
        codigo: "",
        titulo: registro.nombre,
        estado: registro.estado,
        tipoMision: "RECUPERACION",
      },
    patrulla: patrulla
      ? {
        id: patrulla.id,
        nombre: patrulla.nombre,
        estado: patrulla.estado,
      }
      : {
        id: "00000000-0000-0000-0000-000000000000",
        nombre: "Sin patrulla asignada",
        estado: "DISPONIBLE",
      },
    recursos: recursosRespuesta,
    creadoPorId: registro.creado_por_id,
    fechaEstimadaFin: registro.fecha_estimada_fin
      ? registro.fecha_estimada_fin instanceof Date
        ? registro.fecha_estimada_fin.toISOString()
        : String(registro.fecha_estimada_fin)
      : null,
    actualizadoPorId: registro.actualizado_por_id ?? null,
    fechaCierre: registro.fecha_cierre
      ? registro.fecha_cierre instanceof Date
        ? registro.fecha_cierre.toISOString()
        : String(registro.fecha_cierre)
      : null,
    observacionesCierre: registro.observaciones_cierre ?? null,
    cerradoPorId: registro.cerrado_por_id ?? null,
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
 * Servicio de listado paginado y filtrable de operativos de recuperación post-desastre (H73).
 * Valida permiso RBAC 'recuperacion:leer', calcula metadatos H34 y retorna filas con desglose de insumos.
 */
export async function listarEventosRecuperacionService(
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
  };
  let patrullaReasignadaData: PatrullaReasignadaData | null = null;

  const { eventoActualizado, patrullaReasignadaInfo } = await db.transaction().execute(async (trx) => {
    // 1. Verificar existencia del operativo
    const actual = await repo.buscarRecuperacionPorId(trx, recuperacionId);
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

      // Reemplazar asignaciones en recuperacion_recurso
      await repo.eliminarRecursosRecuperacion(trx, recuperacionId);
      const nuevasAsignaciones = Array.from(mapaNuevos.entries()).map(
        ([recursoId, cantidad]) => ({
          recuperacionId,
          recursoId,
          cantidad,
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
      const nuevaPatrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId);
      if (!nuevaPatrulla) {
        throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
      }

      const misionActual = await repo.buscarMisionPorRecuperacionId(trx, recuperacionId);
      const patrullaAnteriorId = misionActual?.patrulla_id ?? null;

      if (patrullaAnteriorId !== input.patrullaId) {
        if (nuevaPatrulla.estado !== "DISPONIBLE") {
          throw new PatrullaNoDisponibleError(
            `La patrulla "${nuevaPatrulla.nombre}" no está disponible para asignación (estado actual: ${nuevaPatrulla.estado}).`
          );
        }

        // Liberar patrulla anterior si no tiene otras misiones activas
        if (patrullaAnteriorId) {
          const otrasMisiones = await repo.contarOtrasMisionesActivasPatrulla(
            trx,
            patrullaAnteriorId,
            misionActual?.id
          );
          if (otrasMisiones === 0) {
            const patrullaAnterior = await repo.buscarPatrullaPorId(trx, patrullaAnteriorId);
            await repo.actualizarEstadoPatrulla(trx, patrullaAnteriorId, "DISPONIBLE");
            if (patrullaAnterior?.usuario_lider_id) {
              await repo.actualizarEstadoPersonalLider(
                trx,
                patrullaAnterior.usuario_lider_id,
                "disponible",
                true
              );
            }
          }
        }

        // Asignar nueva patrulla a la misión y actualizar su estado operativo
        if (misionActual) {
          await repo.reasignarPatrullaMision(trx, misionActual.id, nuevaPatrulla.id);
          await repo.registrarHitoReasignacionMision(trx, {
            misionId: misionActual.id,
            descripcion: `Patrulla reasignada a "${nuevaPatrulla.nombre}" durante edición de operativo ${actual.codigo}.`,
            registradoPorId: usuarioId,
            latitud: Number(actual.latitud),
            longitud: Number(actual.longitud),
          });
          patrullaReasignadaData = {
            misionId: misionActual.id,
            codigoMision: misionActual.codigo,
            patrullaAnteriorId,
            patrullaNuevaId: nuevaPatrulla.id,
            prioridad: actual.prioridad,
            direccion: actual.direccion_texto ?? actual.sector,
          };
        }

        await repo.actualizarEstadoPatrulla(trx, nuevaPatrulla.id, "EN_RECUPERACION");
        if (nuevaPatrulla.usuario_lider_id) {
          await repo.actualizarEstadoPersonalLider(
            trx,
            nuevaPatrulla.usuario_lider_id,
            "en_mision",
            false
          );
        }
      }
    }

    // 6. Actualizar evento de recuperación con auditoría
    const actualizada = await repo.actualizarRecuperacion(trx, recuperacionId, {
      descripcion: input.descripcion,
      fechaEstimadaFin: fechaEstimadaFinParsed,
      actualizadoPorId: usuarioId,
    });

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

  // 9. Notificar en tiempo real vía Socket.io y Redis
  try {
    emitirRecuperacionActualizada(eventoActualizado);

    if (patrullaReasignadaInfo) {
      notificarMisionAsignada({
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

export interface AsignacionPendienteCierre {
  id: string;
  recursoId: string;
  nombre: string;
  esIndividual: boolean;
  cantidadAsignada: number;
}

export interface ReintegroCalculado {
  recursoId: string;
  nombre: string;
  esIndividual: boolean;
  cantidadAsignada: number;
  cantidadConsumida: number;
  remanente: number;
  filas: Array<{
    id: string;
    cantidadAsignada: number;
    cantidadConsumida: number;
    cantidadDevuelta: number;
  }>;
}

/**
 * Calcula de forma pura los montos consumidos y remanentes a reintegrar por cada recurso
 * asignado al operativo de recuperación (HU-75).
 *
 * Reglas:
 * - Todo recursoId reportado en `consumos` debe pertenecer al operativo.
 * - Los activos individuales (`esIndividual = true`) no se consumen (consumo máximo 0, remanente = asignada).
 * - Los recursos a granel omitidos en `consumos` se asumen consumidos por completo (remanente = 0).
 */
export function calcularReintegroInventario(
  asignaciones: AsignacionPendienteCierre[],
  consumos: ConsumoRecursoCierre[]
): ReintegroCalculado[] {
  const mapaAgrupado = new Map<
    string,
    {
      nombre: string;
      esIndividual: boolean;
      totalAsignada: number;
      filas: Array<{ id: string; cantidadAsignada: number }>;
    }
  >();

  for (const fila of asignaciones) {
    const actual = mapaAgrupado.get(fila.recursoId);
    if (actual) {
      actual.totalAsignada += Number(fila.cantidadAsignada);
      actual.filas.push({ id: fila.id, cantidadAsignada: Number(fila.cantidadAsignada) });
    } else {
      mapaAgrupado.set(fila.recursoId, {
        nombre: fila.nombre,
        esIndividual: Boolean(fila.esIndividual),
        totalAsignada: Number(fila.cantidadAsignada),
        filas: [{ id: fila.id, cantidadAsignada: Number(fila.cantidadAsignada) }],
      });
    }
  }

  const mapaConsumos = new Map<string, number>();
  for (const c of consumos) {
    if (!mapaAgrupado.has(c.recursoId)) {
      throw new ConsumoInvalidoError(
        `El recurso '${c.recursoId}' no está asignado a este operativo de recuperación.`
      );
    }
    mapaConsumos.set(c.recursoId, c.cantidadConsumida);
  }

  const resultados: ReintegroCalculado[] = [];

  for (const [recursoId, info] of mapaAgrupado.entries()) {
    let consumida: number;

    if (info.esIndividual) {
      const reportada = mapaConsumos.get(recursoId) ?? 0;
      if (reportada > 0) {
        throw new ConsumoInvalidoError(
          `El activo individual "${info.nombre}" no es consumible y debe reintegrarse completo (cantidadConsumida debe ser 0).`
        );
      }
      consumida = 0;
    } else if (mapaConsumos.has(recursoId)) {
      consumida = mapaConsumos.get(recursoId)!;
      if (consumida > info.totalAsignada) {
        throw new ConsumoInvalidoError(
          `La cantidad consumida (${consumida}) para "${info.nombre}" supera la cantidad asignada (${info.totalAsignada}).`
        );
      }
    } else {
      // Recurso omitido en `consumos`: se asume consumido por completo (remanente = 0).
      consumida = info.totalAsignada;
    }

    const remanente = info.totalAsignada - consumida;

    // Distribuir consumo y devolución entre las filas originales manteniendo invariantes por fila
    let consumoRestante = consumida;
    const filasDistribuidas = info.filas.map((f) => {
      const cFila = Math.min(f.cantidadAsignada, consumoRestante);
      consumoRestante -= cFila;
      return {
        id: f.id,
        cantidadAsignada: f.cantidadAsignada,
        cantidadConsumida: cFila,
        cantidadDevuelta: f.cantidadAsignada - cFila,
      };
    });

    resultados.push({
      recursoId,
      nombre: info.nombre,
      esIndividual: info.esIndividual,
      cantidadAsignada: info.totalAsignada,
      cantidadConsumida: consumida,
      remanente,
      filas: filasDistribuidas,
    });
  }

  return resultados;
}

/**
 * Concluye formalmente un operativo de recuperación en estado EN_EJECUCION (HU-75).
 * Transacciona atómicamente: bloqueo FOR UPDATE, reintegro de remanentes a `cantidad_inventario`
 * (modelo H74), cierre de misión táctica, liberación de patrulla verificadora sin otras misiones activas
 * y transición de `recuperacion.estado` a `COMPLETADA`, emitiendo eventos WebSocket post-commit.
 */
export async function cerrarRecuperacionService(
  recuperacionId: string,
  input: CerrarRecuperacionInput,
  usuarioId: string
): Promise<CerrarRecuperacionResponseData> {
  const {
    resultado,
    recursosParaSocket,
    patrullaParaSocket,
    misionParaSocket,
  } = await db.transaction().execute(async (trx) => {
    // 1. Bloquear el operativo para serializar cierres y ediciones concurrentes
    const actual = await repo.bloquearRecuperacionPorId(trx, recuperacionId);
    if (!actual) {
      throw new NotFoundError("El operativo de recuperación indicado no fue encontrado.");
    }

    if (actual.estado !== "EN_EJECUCION") {
      throw new RecuperacionNoCerrableError(
        `Solo es posible declarar concluido un operativo en estado EN_EJECUCION (estado actual: ${actual.estado}).`
      );
    }

    // 2. Obtener asignaciones pendientes de devolución y calcular remanentes
    const asignacionesPendientes = await repo.listarAsignacionesPendientesDevolucion(
      trx,
      recuperacionId
    );
    const reintegros = calcularReintegroInventario(asignacionesPendientes, input.consumos ?? []);

    // 3. Bloquear filas de recursos en orden determinista por ID para evitar deadlocks
    const recursoIdsOrdenados = reintegros.map((r) => r.recursoId).sort();
    const recursosEnBd = await repo.obtenerRecursosParaBloqueo(trx, recursoIdsOrdenados);
    const mapaRecursosBd = new Map(recursosEnBd.map((r) => [r.id, r]));

    const fechaCierre = new Date();
    const recursosReintegrados: RecursoReintegradoCierre[] = [];
    const recursosParaSocket: Record<string, unknown>[] = [];

    // 4. Reintegrar remanentes al inventario (modelo H74: cantidad_inventario) y registrar trazabilidad
    for (const item of reintegros) {
      let recursoActualizado = mapaRecursosBd.get(item.recursoId);

      if (item.esIndividual) {
        recursoActualizado = await repo.liberarRecursoIndividual(trx, item.recursoId);
      } else if (item.remanente > 0) {
        recursoActualizado = await repo.devolverStockRecursoConDetalle(
          trx,
          item.recursoId,
          item.remanente
        );
      }

      for (const fila of item.filas) {
        await repo.marcarDevolucionAsignacion(
          trx,
          fila.id,
          fila.cantidadConsumida,
          fila.cantidadDevuelta,
          fechaCierre
        );
      }

      if (recursoActualizado) {
        recursosReintegrados.push({
          recursoId: item.recursoId,
          nombre: item.nombre,
          esIndividual: item.esIndividual,
          cantidadAsignada: item.cantidadAsignada,
          cantidadConsumida: item.cantidadConsumida,
          cantidadDevuelta: item.remanente,
          cantidadInventario: Number(recursoActualizado.cantidad_inventario),
          cantidadEnUso: Number(recursoActualizado.cantidad_en_uso ?? 0),
          estadoRecurso: recursoActualizado.estado,
        });
        recursosParaSocket.push(recursoActualizado as unknown as Record<string, unknown>);
      }
    }

    // 5. Cerrar misión táctica activa asociada y registrar hito de cierre
    const misionActual = await repo.buscarMisionParaCierrePorRecuperacionId(trx, recuperacionId);
    let misionResumen: { id: string; codigo: string; estado: string } | null = null;
    let misionParaSocket: MisionActualizadaPayload | null = null;
    let patrullaLiberada: { id: string; nombre: string; estado: string } | null = null;
    let patrullaParaSocket: Parameters<typeof notificarPatrullaActualizada>[0] | null = null;

    if (misionActual) {
      const estadosCerrables = ["PLANIFICADA", "DESPACHADA", "EN_CURSO"];
      let estadoFinalMision: string = misionActual.estado;

      if (estadosCerrables.includes(misionActual.estado)) {
        const misionCerrada = await repo.completarMisionRecuperacion(
          trx,
          misionActual.id,
          fechaCierre
        );
        estadoFinalMision = misionCerrada.estado;

        const hito = await repo.registrarHitoMision(trx, {
          misionId: misionActual.id,
          hito: "OPERATIVO_CONCLUIDO",
          descripcion: `Operativo concluido por Encargado: ${input.resumenCierre}`,
          registradoPorId: usuarioId,
          latitud: Number(actual.latitud),
          longitud: Number(actual.longitud),
        });

        const fechaInicioIso = misionActual.fecha_inicio
          ? misionActual.fecha_inicio instanceof Date
            ? misionActual.fecha_inicio.toISOString()
            : String(misionActual.fecha_inicio)
          : null;

        misionParaSocket = {
          misionId: misionCerrada.id,
          codigo: misionCerrada.codigo,
          estado: misionCerrada.estado,
          tipoMision: misionCerrada.tipo_mision,
          patrullaId: misionCerrada.patrulla_id,
          cuadrillaId: misionCerrada.cuadrilla_id,
          incidenteId: misionCerrada.incidente_id,
          fechaInicio: fechaInicioIso,
          hito: {
            id: hito.id,
            hito: hito.hito,
            descripcion: hito.descripcion,
            registradoPorId: hito.registrado_por_id,
            creadoEn:
              hito.creado_en instanceof Date
                ? hito.creado_en.toISOString()
                : String(hito.creado_en),
          },
          actualizadoEn: fechaCierre.toISOString(),
        };
      }

      misionResumen = {
        id: misionActual.id,
        codigo: misionActual.codigo,
        estado: estadoFinalMision,
      };

      // 6. Liberar patrulla verificadora si no posee otras misiones activas
      if (misionActual.patrulla_id) {
        const otrasMisiones = await repo.contarOtrasMisionesActivasPatrulla(
          trx,
          misionActual.patrulla_id,
          misionActual.id
        );
        if (otrasMisiones === 0) {
          const patrulla = await repo.buscarPatrullaPorId(trx, misionActual.patrulla_id);
          await repo.actualizarEstadoPatrulla(trx, misionActual.patrulla_id, "DISPONIBLE");
          if (patrulla?.usuario_lider_id) {
            await repo.actualizarEstadoPersonalLider(
              trx,
              patrulla.usuario_lider_id,
              "disponible",
              true
            );
          }

          if (patrulla) {
            patrullaLiberada = {
              id: patrulla.id,
              nombre: patrulla.nombre,
              estado: "DISPONIBLE",
            };
            patrullaParaSocket = {
              patrullaId: patrulla.id,
              nombre: patrulla.nombre,
              estado: "DISPONIBLE",
              delegacionId: patrulla.delegacion_id,
              usuarioLiderId: patrulla.usuario_lider_id,
              misionActivaId: null,
              incidenteId: null,
              actualizadoEn: fechaCierre.toISOString(),
            };
          }
        }
      }
    }

    // 7. Actualizar estado del operativo de recuperación a COMPLETADA
    const recuperacionCerrada = await repo.cerrarRecuperacion(trx, recuperacionId, {
      observacionesCierre: input.resumenCierre,
      cerradoPorId: usuarioId,
      fechaCierre,
    });

    const recursosEvento = reintegros.map((r) => ({
      recursoId: r.recursoId,
      nombre: r.nombre,
      cantidadAsignada: r.cantidadAsignada,
      cantidadConsumida: r.cantidadConsumida,
      cantidadDevuelta: r.remanente,
      devueltoEn: fechaCierre.toISOString(),
    }));

    const evento = await construirRespuestaRecuperacion(trx, recuperacionCerrada, recursosEvento);

    const resultado: CerrarRecuperacionResponseData = {
      evento,
      recursosReintegrados,
      mision: misionResumen,
      patrullaLiberada,
    };

    return {
      resultado,
      recursosParaSocket,
      patrullaParaSocket,
      misionParaSocket,
    };
  });

  // 8. Emitir notificaciones en tiempo real post-commit
  try {
    emitirRecuperacionActualizada({
      ...resultado.evento,
      accion: "CERRADA",
    });

    for (const recurso of recursosParaSocket) {
      emitirRecursoActualizado(recurso);
    }

    if (patrullaParaSocket) {
      notificarPatrullaActualizada(patrullaParaSocket);
    }

    if (misionParaSocket) {
      notificarMisionActualizada(misionParaSocket);
    }
  } catch (err) {
    console.error("Error al emitir notificaciones Socket.io tras cierre de recuperación:", err);
  }

  return resultado;
}
