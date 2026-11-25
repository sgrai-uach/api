import { db } from "@/lib/db";
import type {
  CrearEventoRecuperacionInput,
  EventoRecuperacionResponse,
  ListarRecuperacionesInput,
  ListarRecuperacionesResponse,
  AsignarRecursosRecuperacionInput,
  AsignarRecursosRecuperacionResponseData,
  RecuperacionDetalleResponseData,
  PrioridadRecuperacion,
  EstadoRecuperacion,
} from "./recuperacion.schema";
import { ListarRecuperacionesQuerySchema } from "./recuperacion.schema";
import * as repo from "./recuperacion.repository";
import {
  emitirRecuperacionCreada,
  emitirRecuperacionActualizada,
  emitirRecursoActualizado,
  emitirPatrullaActualizada,
} from "@/lib/socket";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import {
  PERMISO_LEER_RECUPERACION,
  PERMISO_LEER_MISION,
  PERMISO_CREAR_RECUPERACION,
  PERMISO_ASIGNAR_MISION,
} from "@/modules/seguridad/permisos.constants";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

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

export class ConflictoEstadoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictoEstadoError";
  }
}

/**
 * Servicio para registrar un evento de recuperación en terreno y despachar patrulla (HU-29).
 */
export async function crearEventoRecuperacionService(
  input: CrearEventoRecuperacionInput,
  usuarioId: string
): Promise<EventoRecuperacionResponse> {
  const { resultado, socketPayloads } = await db.transaction().execute(async (trx) => {
    // 1. Validar existencia y disponibilidad de la patrulla verificadora
    const patrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId, true);
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

    // 3. Bloquear filas de recursos para validación de stock atómica
    const recursosDb = await repo.obtenerRecursosParaBloqueo(trx, recursoIds);
    if (recursosDb.length !== recursoIds.length) {
      throw new NotFoundError("Uno o más recursos solicitados no fueron encontrados en el inventario.");
    }

    const mapaRecursosDb = new Map(recursosDb.map((r) => [r.id, r]));
    const recursosDescontadosParaRespuesta: Array<{
      recursoId: string;
      nombre: string;
      cantidadAsignada: number;
    }> = [];
    const recursosParaSocket: Array<{ id: string; stockDisponible: number; estado: string }> = [];

    // 4. Validar disponibilidad y descontar inventario
    for (const [recursoId, cantidadRequerida] of mapaRecursosSolicitados.entries()) {
      const recurso = mapaRecursosDb.get(recursoId)!;
      const inventario = Number(recurso.cantidad_inventario);
      const enUso = Number(recurso.cantidad_en_uso ?? 0);
      const stockDisponible = Math.max(0, inventario - enUso);

      if (stockDisponible < cantidadRequerida) {
        throw new StockInsuficienteError(
          `Stock insuficiente para el recurso "${recurso.nombre}". Solicitado: ${cantidadRequerida}, Disponible: ${stockDisponible}.`
        );
      }

      await repo.descontarStockRecurso(trx, recursoId, cantidadRequerida);

      const nuevoDisponible = stockDisponible - cantidadRequerida;
      let nuevoEstado = "DISPONIBLE";
      if (nuevoDisponible === 0) {
        nuevoEstado = recurso.es_individual ? "ASIGNADO" : "NO_DISPONIBLE";
      } else if (nuevoDisponible <= Number(recurso.cantidad_minima ?? 0)) {
        nuevoEstado = "BAJO_STOCK";
      }

      recursosDescontadosParaRespuesta.push({
        recursoId,
        nombre: recurso.nombre,
        cantidadAsignada: cantidadRequerida,
      });

      recursosParaSocket.push({
        id: recurso.id,
        stockDisponible: nuevoDisponible,
        estado: nuevoEstado,
      });
    }

    // 5. Determinar delegación territorial
    const delegacionIdEfectiva = input.delegacionId ?? patrulla.delegacion_id;

    // 6. Generar correlativos oficiales
    const codigoRecuperacion = await repo.generarSiguienteCodigoRecuperacion(trx);
    const codigoMision = await repo.generarSiguienteCodigoMision(trx);

    // 7. Insertar registro de recuperación
    const recuperacionCreada = await repo.insertarRecuperacion(trx, {
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

    // 8. Crear misión táctica de recuperación
    const misionCreada = await repo.insertarMisionRecuperacion(trx, {
      codigo: codigoMision,
      titulo: input.nombre,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      patrullaId: patrulla.id,
      recuperacionId: recuperacionCreada.id,
      encargadoId: usuarioId,
      creadoPorId: usuarioId,
    });

    // 9. Registrar hito inicial de despacho
    await repo.registrarHitoMisionInicial(
      trx,
      misionCreada.id,
      usuarioId,
      `Misión táctica despachada a terreno con la patrulla "${patrulla.nombre}".`
    );

    // 10. Vincular recursos entregados
    await repo.insertarRecursosRecuperacion(
      trx,
      recursosDescontadosParaRespuesta.map((r) => ({
        recuperacionId: recuperacionCreada.id,
        recursoId: r.recursoId,
        cantidad: r.cantidadAsignada,
      }))
    );

    // 11. Transicionar estado de la patrulla verificadora y su líder
    const patrullaActualizada = await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_RECUPERACION");
    if (patrulla.usuario_lider_id) {
      await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
    }

    // 12. Obtener datos complementarios de delegación
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

    const respuesta: EventoRecuperacionResponse = {
      id: recuperacionCreada.id,
      codigo: recuperacionCreada.codigo,
      nombre: recuperacionCreada.nombre,
      descripcion: recuperacionCreada.descripcion,
      sector: recuperacionCreada.sector,
      direccionTexto: recuperacionCreada.direccion_texto,
      prioridad: recuperacionCreada.prioridad as PrioridadRecuperacion,
      contactoNombre: recuperacionCreada.contacto_nombre,
      contactoTelefono: recuperacionCreada.contacto_telefono,
      latitud: Number(recuperacionCreada.latitud),
      longitud: Number(recuperacionCreada.longitud),
      estado: recuperacionCreada.estado as EstadoRecuperacion,
      familiasAfectadas: Number(recuperacionCreada.familias_afectadas),
      delegacion: delegacionData,
      mision: {
        id: misionCreada.id,
        codigo: misionCreada.codigo,
        titulo: misionCreada.titulo,
        estado: misionCreada.estado,
        tipoMision: misionCreada.tipo_mision,
      },
      patrulla: {
        id: patrullaActualizada?.id ?? patrulla.id,
        nombre: patrullaActualizada?.nombre ?? patrulla.nombre,
        estado: (patrullaActualizada?.estado ?? "EN_RECUPERACION") as string,
      },
      recursos: recursosDescontadosParaRespuesta,
      creadoPorId: recuperacionCreada.creado_por_id,
      creadoEn: recuperacionCreada.creado_en instanceof Date ? recuperacionCreada.creado_en.toISOString() : String(recuperacionCreada.creado_en),
      actualizadoEn: recuperacionCreada.actualizado_en instanceof Date ? recuperacionCreada.actualizado_en.toISOString() : String(recuperacionCreada.actualizado_en),
    };

    return {
      resultado: respuesta,
      socketPayloads: {
        recursos: recursosParaSocket,
        patrulla: {
          id: patrulla.id,
          estado: "EN_RECUPERACION",
          nombre: patrulla.nombre,
          delegacionId: patrulla.delegacion_id,
        },
      },
    };
  });

  // Emisiones WebSockets asíncronas
  try {
    emitirRecuperacionCreada(resultado);
  } catch (err) {
    console.error("Error al emitir evento socket recuperacion:creada:", err);
  }

  for (const rec of socketPayloads.recursos) {
    try {
      emitirRecursoActualizado({
        id: rec.id,
        stockDisponible: rec.stockDisponible,
        estado: rec.estado,
      });
    } catch (err) {
      console.error(`Error al emitir socket recurso:actualizado (${rec.id}):`, err);
    }
  }

  try {
    emitirPatrullaActualizada(socketPayloads.patrulla);
  } catch (err) {
    console.error("Error al emitir evento socket patrulla:actualizada:", err);
  }

  return resultado;
}

/**
 * Servicio para asignar patrulla y recursos logísticos a un evento de recuperación existente (HU-32).
 */
export async function asignarRecursosRecuperacionService(
  recuperacionId: string,
  input: AsignarRecursosRecuperacionInput,
  usuarioId: string
): Promise<AsignarRecursosRecuperacionResponseData> {
  const { resultado, recursosParaSocket, patrullaPayload } = await db.transaction().execute(async (trx) => {
    const evento = await repo.buscarRecuperacionPorId(trx, recuperacionId, true);
    if (!evento) {
      throw new NotFoundError("El evento de recuperación indicado no fue encontrado.");
    }

    if (evento.estado === "COMPLETADA" || evento.estado === "CANCELADA") {
      throw new ConflictoEstadoError(
        `No es posible asignar recursos a un evento de recuperación en estado ${evento.estado}.`
      );
    }

    const patrulla = await repo.buscarPatrullaPorId(trx, input.patrullaId, true);
    if (!patrulla) {
      throw new NotFoundError("La patrulla verificadora indicada no fue encontrada.");
    }

    if (patrulla.estado !== "DISPONIBLE") {
      throw new PatrullaNoDisponibleError(
        `La patrulla "${patrulla.nombre}" no está disponible para asignación (estado actual: ${patrulla.estado}).`
      );
    }

    const mapaRecursosSolicitados = new Map<string, number>();
    for (const item of input.recursos) {
      const acumulado = mapaRecursosSolicitados.get(item.recursoId) ?? 0;
      mapaRecursosSolicitados.set(item.recursoId, acumulado + item.cantidad);
    }
    const recursoIds = Array.from(mapaRecursosSolicitados.keys());

    const recursosDb = await repo.obtenerRecursosParaBloqueo(trx, recursoIds);
    if (recursosDb.length !== recursoIds.length) {
      throw new NotFoundError("Uno o más recursos solicitados no fueron encontrados en el inventario.");
    }

    const mapaRecursosDb = new Map(recursosDb.map((r) => [r.id, r]));
    const recursosActualizados: Array<{
      recursoId: string;
      nombre: string;
      esIndividual: boolean;
      cantidadAsignada: number;
      cantidadEnUso: number;
      estadoRecurso: string;
    }> = [];
    const recursosSocket: Array<{ id: string; stockDisponible: number; estado: string }> = [];

    for (const [recursoId, cantidadRequerida] of mapaRecursosSolicitados.entries()) {
      const recurso = mapaRecursosDb.get(recursoId)!;
      const inventario = Number(recurso.cantidad_inventario);
      const enUso = Number(recurso.cantidad_en_uso ?? 0);
      const stockDisponible = Math.max(0, inventario - enUso);

      if (stockDisponible < cantidadRequerida) {
        throw new StockInsuficienteError(
          `Stock insuficiente para el recurso "${recurso.nombre}". Solicitado: ${cantidadRequerida}, Disponible: ${stockDisponible}.`
        );
      }

      let recursoActualizadoDb;
      if (recurso.es_individual) {
        recursoActualizadoDb = await repo.actualizarRecursoIndividualAsignado(trx, recursoId);
      } else {
        recursoActualizadoDb = await repo.actualizarRecursoGranelUso(trx, recursoId, cantidadRequerida);
      }

      const nuevoEnUso = Number(recursoActualizadoDb.cantidad_en_uso ?? 0);
      const nuevoDisponible = Math.max(0, Number(recursoActualizadoDb.cantidad_inventario) - nuevoEnUso);

      recursosActualizados.push({
        recursoId,
        nombre: recursoActualizadoDb.nombre,
        esIndividual: Boolean(recursoActualizadoDb.es_individual),
        cantidadAsignada: cantidadRequerida,
        cantidadEnUso: nuevoEnUso,
        estadoRecurso: recursoActualizadoDb.estado,
      });

      recursosSocket.push({
        id: recurso.id,
        stockDisponible: nuevoDisponible,
        estado: recursoActualizadoDb.estado,
      });
    }

    const codigoMision = await repo.generarSiguienteCodigoMision(trx);
    const misionCreada = await repo.insertarMisionRecuperacion(trx, {
      codigo: codigoMision,
      titulo: evento.nombre,
      descripcion: input.instrucciones ?? evento.descripcion,
      prioridad: evento.prioridad as PrioridadIncidente,
      patrullaId: patrulla.id,
      recuperacionId: evento.id,
      encargadoId: usuarioId,
      creadoPorId: usuarioId,
    });

    await repo.registrarHitoMisionInicial(
      trx,
      misionCreada.id,
      usuarioId,
      `Misión táctica ${misionCreada.codigo} despachada a terreno con la patrulla "${patrulla.nombre}".`
    );

    await repo.insertarRecursosRecuperacionConMision(
      trx,
      recursosActualizados.map((r) => ({
        recuperacionId: evento.id,
        recursoId: r.recursoId,
        misionId: misionCreada.id,
        cantidad: r.cantidadAsignada,
      }))
    );

    const patrullaActualizada = await repo.actualizarEstadoPatrulla(trx, patrulla.id, "EN_RECUPERACION");
    if (patrulla.usuario_lider_id) {
      await repo.actualizarEstadoPersonalLider(trx, patrulla.usuario_lider_id, "en_mision");
    }

    const payloadRespuesta: AsignarRecursosRecuperacionResponseData = {
      evento: {
        id: evento.id,
        codigo: evento.codigo,
        nombre: evento.nombre,
        estado: evento.estado as EstadoRecuperacion,
      },
      mision: {
        id: misionCreada.id,
        codigo: misionCreada.codigo,
        titulo: misionCreada.titulo,
        estado: misionCreada.estado,
        tipoMision: misionCreada.tipo_mision,
      },
      patrulla: {
        id: patrullaActualizada?.id ?? patrulla.id,
        nombre: patrullaActualizada?.nombre ?? patrulla.nombre,
        estado: patrullaActualizada?.estado ?? "EN_RECUPERACION",
      },
      recursos: recursosActualizados,
      asignadoEn: new Date().toISOString(),
    };

    return {
      resultado: payloadRespuesta,
      recursosParaSocket: recursosSocket,
      patrullaPayload: {
        id: patrulla.id,
        estado: "EN_RECUPERACION",
        nombre: patrulla.nombre,
        delegacionId: patrulla.delegacion_id,
      },
    };
  });

  try {
    emitirRecuperacionActualizada({
      id: resultado.evento.id,
      codigo: resultado.evento.codigo,
      estado: resultado.evento.estado,
      misionId: resultado.mision.id,
      patrullaId: resultado.patrulla.id,
    });
  } catch (err) {
    console.error("Error al emitir socket recuperacion:actualizada:", err);
  }

  for (const rec of recursosParaSocket) {
    try {
      emitirRecursoActualizado({
        id: rec.id,
        stockDisponible: rec.stockDisponible,
        estado: rec.estado,
      });
    } catch (err) {
      console.error(`Error al emitir socket recurso:actualizado (${rec.id}):`, err);
    }
  }

  try {
    emitirPatrullaActualizada(patrullaPayload);
  } catch (err) {
    console.error("Error al emitir evento socket patrulla:actualizada:", err);
  }

  return resultado;
}

/**
 * Helper para verificar autorización en lectura de recuperación.
 * Acepta 'recuperacion:leer', 'misiones:leer', 'recuperacion:crear' o 'misiones:asignar'.
 */
export async function verificarAutorizacionLecturaRecuperacion(usuarioId?: string | null) {
  try {
    await verificarPermiso(usuarioId, PERMISO_LEER_RECUPERACION);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      try {
        await verificarPermiso(usuarioId, PERMISO_LEER_MISION);
      } catch {
        try {
          await verificarPermiso(usuarioId, PERMISO_CREAR_RECUPERACION);
        } catch {
          await verificarPermiso(usuarioId, PERMISO_ASIGNAR_MISION);
        }
      }
    } else {
      throw err;
    }
  }
}

/**
 * Servicio de listado paginado y filtrable de operativos de recuperación post-desastre (H73).
 * Sigue el estándar de contratos H34.
 */
export async function listarEventosRecuperacionService(
  filtros?: ListarRecuperacionesInput,
  usuarioId?: string | null
): Promise<ListarRecuperacionesResponse> {
  // 1. Control de Acceso RBAC
  if (usuarioId !== undefined) {
    await verificarAutorizacionLecturaRecuperacion(usuarioId);
  }

  // 2. Validar y normalizar parámetros
  const queryValidada = ListarRecuperacionesQuerySchema.parse(filtros ?? {});

  // 3. Consulta paginada y conteo en repositorio
  const { filas, total } = await repo.listarRecuperacionesPaginadoRepo(queryValidada);

  // 4. Metadatos bajo estándar H34 (soporte para aliases pagina y limite)
  const page = queryValidada.page ?? queryValidada.pagina ?? 1;
  const limit = queryValidada.limit ?? queryValidada.limite ?? 10;
  const meta = buildPaginationMeta(total, page, limit);

  return {
    message: "Operativos de recuperación obtenidos exitosamente.",
    data: filas,
    meta,
    total,
  };
}

/**
 * Servicio para consultar el detalle exhaustivo de un operativo de recuperación (H73 - Drawer).
 * Compatible con la respuesta enriquecida de HU-32 y HU-73.
 */
export async function obtenerDetalleRecuperacionService(
  id: string,
  usuarioId?: string | null
): Promise<RecuperacionDetalleResponseData> {
  // 1. Control de Acceso RBAC
  if (usuarioId !== undefined) {
    await verificarAutorizacionLecturaRecuperacion(usuarioId);
  }

  // 2. Consulta en repositorio
  const detalle = await repo.obtenerRecuperacionDetallePorIdRepo(id);
  if (!detalle) {
    throw new NotFoundError(`El evento de recuperación con ID '${id}' no fue encontrado.`);
  }

  return detalle;
}
