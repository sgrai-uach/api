import { sql, type Transaction } from "kysely";
import { db } from "@/lib/db";
import type { Database, EstadoRecurso, EstadoPatrulla, EstadoOperativo, PrioridadIncidente } from "@/lib/db/types";
import type {
  ListarRecuperacionesQuery,
  OperativoRecuperacionItem,
  RecuperacionDetalleResponse,
  HistorialRecuperacionItem,
} from "./recuperacion.schema";

export type KyselyTrx = Transaction<Database>;

export interface DatosInsertarRecuperacionRepo {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  sector: string;
  direccionTexto?: string | null;
  prioridad: PrioridadIncidente;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  latitud: number;
  longitud: number;
  familiasAfectadas: number;
  delegacionId?: string | null;
  creadoPorId: string;
}

export interface DatosInsertarMisionRecuperacionRepo {
  codigo: string;
  titulo: string;
  descripcion?: string | null;
  prioridad: PrioridadIncidente;
  patrullaId: string;
  recuperacionId: string;
  encargadoId: string;
  creadoPorId: string;
}

export async function generarSiguienteCodigoRecuperacion(trx: KyselyTrx): Promise<string> {
  await sql`SELECT pg_advisory_xact_lock(hashtext('recuperacion_codigo_seq'))`.execute(trx);
  const anio = new Date().getFullYear();
  const prefijo = `REC-${anio}-`;

  const ultimaRecuperacion = await trx
    .selectFrom("recuperacion")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .orderBy("codigo", "desc")
    .limit(1)
    .executeTakeFirst();

  let correlativo = 1;
  if (ultimaRecuperacion?.codigo) {
    const partes = ultimaRecuperacion.codigo.split("-");
    const num = parseInt(partes[2] || "0", 10);
    if (!isNaN(num) && num >= 1) {
      correlativo = num + 1;
    }
  }
  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
}

export async function generarSiguienteCodigoMision(trx: KyselyTrx): Promise<string> {
  await sql`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.execute(trx);
  const anio = new Date().getFullYear();
  const prefijo = `MIS-${anio}-`;

  const ultimaMision = await trx
    .selectFrom("mision")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .orderBy("codigo", "desc")
    .limit(1)
    .executeTakeFirst();

  let correlativo = 1;
  if (ultimaMision?.codigo) {
    const partes = ultimaMision.codigo.split("-");
    const num = parseInt(partes[2] || "0", 10);
    if (!isNaN(num) && num >= 1) {
      correlativo = num + 1;
    }
  }
  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
}

export async function buscarPatrullaPorId(trx: KyselyTrx, patrullaId: string, bloquear: boolean = false) {
  let query = trx
    .selectFrom("patrulla_verificadora")
    .select(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .where("id", "=", patrullaId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true);

  if (bloquear) {
    query = query.forUpdate();
  }

  return query.executeTakeFirst();
}

export async function obtenerRecursosParaBloqueo(trx: KyselyTrx, recursoIds: string[]) {
  if (recursoIds.length === 0) return [];

  return trx
    .selectFrom("recurso")
    .select([
      "id",
      "nombre",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
      "estado",
      "es_individual",
    ])
    .where("id", "in", recursoIds)
    .where("eliminado_en", "is", null)
    .forUpdate()
    .execute();
}

export async function insertarRecuperacion(trx: KyselyTrx, datos: DatosInsertarRecuperacionRepo) {
  return trx
    .insertInto("recuperacion")
    .values({
      codigo: datos.codigo,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      sector: datos.sector,
      direccion_texto: datos.direccionTexto ?? null,
      prioridad: datos.prioridad,
      contacto_nombre: datos.contactoNombre ?? null,
      contacto_telefono: datos.contactoTelefono ?? null,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      estado: "PLANIFICADA",
      familias_afectadas: datos.familiasAfectadas,
      delegacion_id: datos.delegacionId ?? null,
      creado_por_id: datos.creadoPorId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function insertarMisionRecuperacion(trx: KyselyTrx, datos: DatosInsertarMisionRecuperacionRepo) {
  return trx
    .insertInto("mision")
    .values({
      codigo: datos.codigo,
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      tipo_mision: "RECUPERACION",
      estado: "DESPACHADA",
      prioridad: datos.prioridad,
      patrulla_id: datos.patrullaId,
      recuperacion_id: datos.recuperacionId,
      encargado_id: datos.encargadoId,
      creado_por_id: datos.creadoPorId,
      fecha_inicio: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function registrarHitoMisionInicial(
  trx: KyselyTrx,
  misionId: string,
  operadorId: string,
  patrullaNombre: string
) {
  return trx
    .insertInto("mision_hito")
    .values({
      mision_id: misionId,
      hito: "DESPACHADA",
      descripcion: `Misión de recuperación asignada y despachada a la patrulla ${patrullaNombre}.`,
      registrado_por_id: operadorId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function insertarRecursosRecuperacion(
  trx: KyselyTrx,
  asignaciones: Array<{ recuperacionId: string; recursoId: string; cantidad: number; misionId?: string | null }>
) {
  if (asignaciones.length === 0) return;

  await trx
    .insertInto("recuperacion_recurso")
    .values(
      asignaciones.map((item) => ({
        recuperacion_id: item.recuperacionId,
        recurso_id: item.recursoId,
        cantidad_asignada: item.cantidad,
        mision_id: item.misionId ?? null,
      }))
    )
    .execute();
}

async function ajustarStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  deltaAsignado: number
) {
  const recurso = await trx
    .selectFrom("recurso")
    .select([
      "id",
      "nombre",
      "es_individual",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
    ])
    .where("id", "=", recursoId)
    .executeTakeFirstOrThrow();

  const cantidadMinima = Number(recurso.cantidad_minima ?? 0);

  if (recurso.es_individual) {
    const nuevoEnUso = Math.max(0, Number(recurso.cantidad_en_uso ?? 0) + deltaAsignado);
    const inventario = Number(recurso.cantidad_inventario);
    const disponible = Math.max(0, inventario - nuevoEnUso);

    let nuevoEstado: EstadoRecurso = "DISPONIBLE";
    if (disponible === 0) {
      nuevoEstado = "ASIGNADO";
    } else if (disponible <= cantidadMinima) {
      nuevoEstado = "BAJO_STOCK";
    }

    return trx
      .updateTable("recurso")
      .set({
        cantidad_en_uso: nuevoEnUso,
        estado: nuevoEstado,
        actualizado_en: new Date(),
      })
      .where("id", "=", recursoId)
      .returning([
        "id",
        "nombre",
        "es_individual",
        "estado",
        "cantidad_inventario",
        "cantidad_en_uso",
        "cantidad_minima",
      ])
      .executeTakeFirstOrThrow();
  }

  const nuevoInventario = Math.max(0, Number(recurso.cantidad_inventario) - deltaAsignado);
  const cantidadEnUso = Number(recurso.cantidad_en_uso ?? 0);
  const disponible = Math.max(0, nuevoInventario - cantidadEnUso);

  let nuevoEstado: EstadoRecurso = "DISPONIBLE";
  if (disponible === 0) {
    nuevoEstado = "NO_DISPONIBLE";
  } else if (disponible <= cantidadMinima) {
    nuevoEstado = "BAJO_STOCK";
  }

  return trx
    .updateTable("recurso")
    .set({
      cantidad_inventario: nuevoInventario,
      estado: nuevoEstado,
      actualizado_en: new Date(),
    })
    .where("id", "=", recursoId)
    .returning([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
    ])
    .executeTakeFirstOrThrow();
}

export async function descontarStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  cantidadADescontar: number
) {
  return ajustarStockRecurso(trx, recursoId, cantidadADescontar);
}

export async function devolverStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  cantidadADevolver: number
) {
  return ajustarStockRecurso(trx, recursoId, -cantidadADevolver);
}

export async function liberarPatrullaOperativo(
  trx: KyselyTrx,
  patrullaId: string
) {
  return trx
    .updateTable("patrulla_verificadora")
    .set({
      estado: "DISPONIBLE",
      actualizado_en: new Date(),
    })
    .where("id", "=", patrullaId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .returning(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .executeTakeFirst();
}

export async function actualizarEstadoPatrulla(
  trx: KyselyTrx,
  patrullaId: string,
  nuevoEstado: EstadoPatrulla = "EN_RECUPERACION"
) {
  return trx
    .updateTable("patrulla_verificadora")
    .set({
      estado: nuevoEstado,
      actualizado_en: new Date(),
    })
    .where("id", "=", patrullaId)
    .where("estado", "=", "DISPONIBLE")
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .returning(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .executeTakeFirst();
}

export async function actualizarEstadoPersonalLider(
  trx: KyselyTrx,
  usuarioLiderId: string,
  nuevoEstado: EstadoOperativo = "en_mision"
) {
  // H11: la disponibilidad operativa reside en `usuario.estado_operativo`
  // Solo actualizar usuarios activos
  await trx
    .updateTable("usuario")
    .set({
      estado_operativo: nuevoEstado,
    })
    .where("id", "=", usuarioLiderId)
    .where("activo", "=", true)
    .execute();
}

export async function contarOtrasAsignacionesActivasUsuario(
  trx: KyselyTrx,
  usuarioId: string,
  excluirPatrullaId?: string
): Promise<number> {
  let patQuery = trx
    .selectFrom("patrulla_verificadora as pv")
    .leftJoin("patrulla_personal as pp", "pp.patrulla_id", "pv.id")
    .leftJoin("personal as p", "p.id", "pp.personal_id")
    .select(trx.fn.countAll<string>().as("total"))
    .where((eb) =>
      eb.or([
        eb("pv.usuario_lider_id", "=", usuarioId),
        eb("p.usuario_id", "=", usuarioId),
      ])
    )
    .where("pv.estado", "in", ["EN_VERIFICACION", "EN_PREVENCION", "EN_RECUPERACION"])
    .where("pv.eliminado_en", "is", null)
    .where("pv.activo", "=", true);

  if (excluirPatrullaId) {
    patQuery = patQuery.where("pv.id", "!=", excluirPatrullaId);
  }

  const patRes = await patQuery.executeTakeFirst();

  const cuadRes = await trx
    .selectFrom("cuadrilla as c")
    .leftJoin("cuadrilla_personal as cp", "cp.cuadrilla_id", "c.id")
    .leftJoin("personal as p", "p.id", "cp.personal_id")
    .select(trx.fn.countAll<string>().as("total"))
    .where((eb) =>
      eb.or([
        eb("c.usuario_delegado_id", "=", usuarioId),
        eb("p.usuario_id", "=", usuarioId),
      ])
    )
    .where("c.estado", "=", "EN_MISION")
    .where("c.eliminado_en", "is", null)
    .where("c.activo", "=", true)
    .executeTakeFirst();

  return Number(patRes?.total ?? 0) + Number(cuadRes?.total ?? 0);
}

export async function listarIntegrantesPatrullaIds(
  trx: KyselyTrx,
  patrullaId: string
): Promise<string[]> {
  const filas = await trx
    .selectFrom("patrulla_personal as pp")
    .innerJoin("personal as p", "p.id", "pp.personal_id")
    .select("p.usuario_id")
    .where("pp.patrulla_id", "=", patrullaId)
    .where("p.usuario_id", "is not", null)
    .execute();

  return filas.map((f) => f.usuario_id).filter((id): id is string => Boolean(id));
}

export async function buscarDelegacionPorId(trx: KyselyTrx | typeof db, delegacionId: string) {
  return trx
    .selectFrom("delegacion")
    .select(["id", "codigo", "codigo_delegacion", "nombre", "nombre_delegacion"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

export async function listarRecursosAsignadosRecuperacion(
  trx: KyselyTrx,
  recuperacionId: string
) {
  return trx
    .selectFrom("recuperacion_recurso as rr")
    .innerJoin("recurso as r", "r.id", "rr.recurso_id")
    .select([
      "rr.recurso_id as recursoId",
      "r.nombre as nombre",
      "r.es_individual as esIndividual",
      "rr.cantidad_asignada as cantidadAsignada",
      "rr.mision_id as misionId",
    ])
    .where("rr.recuperacion_id", "=", recuperacionId)
    .forUpdate()
    .execute();
}

export async function buscarMisionPorRecuperacionId(
  trx: KyselyTrx,
  recuperacionId: string
) {
  return trx
    .selectFrom("mision")
    .select(["id", "codigo", "titulo", "estado", "tipo_mision", "patrulla_id"])
    .where("recuperacion_id", "=", recuperacionId)
    .where("estado", "not in", ["CANCELADA", "RECHAZADA"])
    .orderBy("creado_en", "desc")
    .executeTakeFirst();
}

export async function actualizarRecuperacion(
  trx: KyselyTrx,
  id: string,
  datos: {
    descripcion?: string | null;
    fechaEstimadaFin?: Date | null;
    actualizadoPorId: string;
  }
) {
  const valores: Record<string, unknown> = {
    actualizado_por_id: datos.actualizadoPorId,
    actualizado_en: new Date(),
  };

  if (datos.descripcion !== undefined) {
    valores.descripcion = datos.descripcion;
  }
  if (datos.fechaEstimadaFin !== undefined) {
    valores.fecha_estimada_fin = datos.fechaEstimadaFin;
  }

  return trx
    .updateTable("recuperacion")
    .set(valores)
    .where("id", "=", id)
    .where("estado", "not in", ["COMPLETADA", "CANCELADA"])
    .where("eliminado_en", "is", null)
    .returningAll()
    .executeTakeFirst();
}

export async function sincronizarDescripcionMisionRecuperacion(
  trx: KyselyTrx,
  recuperacionId: string,
  descripcion: string | null
) {
  await trx
    .updateTable("mision")
    .set({
      descripcion,
      actualizado_en: new Date(),
    })
    .where("recuperacion_id", "=", recuperacionId)
    .where("estado", "not in", ["CANCELADA", "RECHAZADA", "COMPLETADA"])
    .execute();
}

export async function eliminarRecursosRecuperacion(
  trx: KyselyTrx,
  recuperacionId: string
) {
  await trx
    .deleteFrom("recuperacion_recurso")
    .where("recuperacion_id", "=", recuperacionId)
    .execute();
}

export async function contarOtrasMisionesActivasPatrulla(
  trx: KyselyTrx,
  patrullaId: string,
  excluirMisionId?: string
): Promise<number> {
  let query = trx
    .selectFrom("mision")
    .select(trx.fn.count<string>("id").as("total"))
    .where("patrulla_id", "=", patrullaId)
    .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"]);

  if (excluirMisionId) {
    query = query.where("id", "!=", excluirMisionId);
  }

  const row = await query.executeTakeFirst();
  return Number(row?.total ?? 0);
}

export async function reasignarPatrullaMision(
  trx: KyselyTrx,
  misionId: string,
  nuevaPatrullaId: string
) {
  return trx
    .updateTable("mision")
    .set({
      patrulla_id: nuevaPatrullaId,
      estado: "DESPACHADA",
      fecha_inicio: null,
      actualizado_en: new Date(),
    })
    .where("id", "=", misionId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function insertarNotificacionMisionRecuperacion(
  trx: KyselyTrx,
  misionId: string,
  patrullaId: string
) {
  return trx
    .insertInto("notificaciones_mision")
    .values({
      mision_id: misionId,
      patrulla_id: patrullaId,
      estado: "PENDIENTE_ENVIO",
      intentos_envio: 0,
    })
    .returning("id")
    .executeTakeFirst();
}

export async function registrarHitoReasignacionMision(
  trx: KyselyTrx,
  datos: {
    misionId: string;
    descripcion: string;
    registradoPorId: string;
    latitud?: number | null;
    longitud?: number | null;
  }
) {
  await trx
    .insertInto("mision_hito")
    .values({
      mision_id: datos.misionId,
      hito: "REASIGNACION_PATRULLA",
      descripcion: datos.descripcion,
      registrado_por_id: datos.registradoPorId,
      latitud: datos.latitud ?? null,
      longitud: datos.longitud ?? null,
    })
    .execute();
}

function formatearFechaIso(fecha: unknown): string | null {
  if (!fecha) return null;
  if (fecha instanceof Date) {
    return isNaN(fecha.getTime()) ? null : fecha.toISOString();
  }
  const d = new Date(fecha as string | number);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Consulta paginada y filtrable de operativos de recuperación (H73).
 * Retorna las filas mapeadas con su delegación y el resumen consolidado de recursos asignados.
 */
export async function listarRecuperacionesPaginadoRepo(
  filtros: ListarRecuperacionesQuery
): Promise<{ filas: OperativoRecuperacionItem[]; total: number }> {
  const page = filtros.page ?? filtros.pagina ?? 1;
  const limit = filtros.limit ?? filtros.limite ?? 20;
  const offset = (page - 1) * limit;
  const orden = filtros.orden ?? "desc";

  let baseQuery = db
    .selectFrom("recuperacion")
    .leftJoin("delegacion", "delegacion.id", "recuperacion.delegacion_id")
    .where((eb) => eb(sql`to_jsonb(recuperacion)->>'eliminado_en'`, "is", null));

  if (filtros.delegacionId) {
    baseQuery = baseQuery.where("recuperacion.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.estado) {
    baseQuery = baseQuery.where("recuperacion.estado", "=", filtros.estado);
  }

  if (filtros.prioridad) {
    baseQuery = baseQuery.where("recuperacion.prioridad", "=", filtros.prioridad);
  }

  if (filtros.fechaDesde) {
    baseQuery = baseQuery.where("recuperacion.creado_en", ">=", new Date(filtros.fechaDesde));
  }

  if (filtros.fechaHasta) {
    baseQuery = baseQuery.where("recuperacion.creado_en", "<=", new Date(filtros.fechaHasta));
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb("recuperacion.codigo", "ilike", patron),
        eb("recuperacion.nombre", "ilike", patron),
        eb("recuperacion.sector", "ilike", patron),
        eb("recuperacion.descripcion", "ilike", patron),
      ])
    );
  }

  // 1. Conteo total de registros coincidentes
  const conteo = await baseQuery
    .select(sql<number>`count(recuperacion.id)::int`.as("total"))
    .executeTakeFirst();
  const total = Number(conteo?.total ?? 0);

  // 2. Ordenamiento configurable
  if (filtros.ordenarPor === "codigo") {
    baseQuery = baseQuery.orderBy("recuperacion.codigo", orden);
  } else if (filtros.ordenarPor === "prioridad") {
    baseQuery = baseQuery.orderBy("recuperacion.prioridad", orden);
  } else if (filtros.ordenarPor === "familiasAfectadas") {
    baseQuery = baseQuery.orderBy("recuperacion.familias_afectadas", orden);
  } else {
    baseQuery = baseQuery.orderBy("recuperacion.creado_en", orden);
  }

  // 3. Obtener registros paginados
  const filasRecuperacion = await baseQuery
    .select([
      "recuperacion.id",
      "recuperacion.codigo",
      "recuperacion.nombre",
      "recuperacion.descripcion",
      "recuperacion.sector",
      "recuperacion.direccion_texto",
      "recuperacion.prioridad",
      "recuperacion.estado",
      "recuperacion.familias_afectadas",
      "recuperacion.delegacion_id",
      sql<string | null>`COALESCE(delegacion.codigo, delegacion.codigo_delegacion)`.as("delegacion_codigo"),
      sql<string | null>`COALESCE(delegacion.nombre, delegacion.nombre_delegacion)`.as("delegacion_nombre"),
      sql<Date | null>`CASE WHEN (to_jsonb(recuperacion) ? 'fecha_cierre') THEN (to_jsonb(recuperacion)->>'fecha_cierre')::timestamptz ELSE NULL END`.as("fecha_cierre"),
      "recuperacion.creado_en",
      "recuperacion.actualizado_en",
    ])
    .limit(limit)
    .offset(offset)
    .execute();

  if (filasRecuperacion.length === 0) {
    return { filas: [], total };
  }

  // 4. Obtener insumos asignados agrupados por operativo
  const ids = filasRecuperacion.map((f) => f.id);
  const insumos = await db
    .selectFrom("recuperacion_recurso")
    .innerJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
    .select([
      "recuperacion_recurso.recuperacion_id",
      "recuperacion_recurso.recurso_id",
      "recurso.nombre as recurso_nombre",
      "recuperacion_recurso.cantidad_asignada",
    ])
    .where("recuperacion_recurso.recuperacion_id", "in", ids)
    .execute();

  const mapaInsumos = new Map<
    string,
    {
      totalUnidades: number;
      recursosResumen: Array<{ recursoId: string; nombre: string; cantidadAsignada: number }>;
    }
  >();

  for (const insumo of insumos) {
    const entry = mapaInsumos.get(insumo.recuperacion_id) ?? {
      totalUnidades: 0,
      recursosResumen: [],
    };
    const cantidad = Number(insumo.cantidad_asignada ?? 0);
    entry.totalUnidades += cantidad;
    entry.recursosResumen.push({
      recursoId: insumo.recurso_id,
      nombre: insumo.recurso_nombre,
      cantidadAsignada: cantidad,
    });
    mapaInsumos.set(insumo.recuperacion_id, entry);
  }

  // 5. Mapear filas a formato canónico de respuesta H34
  const filas: OperativoRecuperacionItem[] = filasRecuperacion.map((fila) => {
    const infoInsumos = mapaInsumos.get(fila.id) ?? { totalUnidades: 0, recursosResumen: [] };

    return {
      id: fila.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      sector: fila.sector,
      direccionTexto: fila.direccion_texto,
      prioridad: fila.prioridad as OperativoRecuperacionItem["prioridad"],
      estado: fila.estado as OperativoRecuperacionItem["estado"],
      familiasAfectadas: Number(fila.familias_afectadas ?? 0),
      delegacion: fila.delegacion_id
        ? {
            id: fila.delegacion_id,
            codigo: fila.delegacion_codigo || "",
            nombre: fila.delegacion_nombre || "",
          }
        : null,
      cantidadInsumosAsignados: infoInsumos.totalUnidades,
      totalTiposInsumos: infoInsumos.recursosResumen.length,
      recursosResumen: infoInsumos.recursosResumen,
      creadoEn: formatearFechaIso(fila.creado_en) ?? new Date().toISOString(),
      actualizadoEn: formatearFechaIso(fila.actualizado_en) ?? new Date().toISOString(),
      fechaCierre: formatearFechaIso(fila.fecha_cierre),
    };
  });

  return { filas, total };
}

export async function buscarRecuperacionPorId(
  trx: KyselyTrx | typeof db,
  recuperacionId: string,
  bloquear: boolean = false
) {
  let query = trx
    .selectFrom("recuperacion")
    .selectAll()
    .where("id", "=", recuperacionId)
    .where("eliminado_en", "is", null);

  if (bloquear) {
    query = query.forUpdate();
  }

  return query.executeTakeFirst();
}

export async function actualizarRecursoGranelUso(
  trx: KyselyTrx,
  recursoId: string,
  cantidadAsignada: number
) {
  const recurso = await trx
    .selectFrom("recurso")
    .select([
      "id",
      "nombre",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
      "es_individual",
    ])
    .where("id", "=", recursoId)
    .executeTakeFirstOrThrow();

  const nuevoEnUso = Number(recurso.cantidad_en_uso ?? 0) + cantidadAsignada;
  const inventario = Number(recurso.cantidad_inventario);
  const cantidadMinima = Number(recurso.cantidad_minima ?? 0);
  const nuevoDisponible = Math.max(0, inventario - nuevoEnUso);

  let nuevoEstado: EstadoRecurso = "DISPONIBLE";
  if (nuevoDisponible === 0) {
    nuevoEstado = "NO_DISPONIBLE";
  } else if (nuevoDisponible <= cantidadMinima) {
    nuevoEstado = "BAJO_STOCK";
  }

  return trx
    .updateTable("recurso")
    .set({
      cantidad_en_uso: nuevoEnUso,
      estado: nuevoEstado,
      actualizado_en: new Date(),
    })
    .where("id", "=", recursoId)
    .returning([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
    ])
    .executeTakeFirstOrThrow();
}

export async function actualizarRecursoIndividualAsignado(
  trx: KyselyTrx,
  recursoId: string
) {
  const recurso = await trx
    .selectFrom("recurso")
    .select([
      "id",
      "nombre",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
      "es_individual",
    ])
    .where("id", "=", recursoId)
    .executeTakeFirstOrThrow();

  const enUsoActual = Number(recurso.cantidad_en_uso ?? 0);
  const inventario = Number(recurso.cantidad_inventario);
  const cantidadMinima = Number(recurso.cantidad_minima ?? 0);
  const nuevoEnUso = enUsoActual + 1;
  const nuevoDisponible = Math.max(0, inventario - nuevoEnUso);

  let nuevoEstado: EstadoRecurso = "DISPONIBLE";
  if (nuevoDisponible === 0) {
    nuevoEstado = "ASIGNADO";
  } else if (nuevoDisponible <= cantidadMinima) {
    nuevoEstado = "BAJO_STOCK";
  }

  return trx
    .updateTable("recurso")
    .set({
      cantidad_en_uso: nuevoEnUso,
      estado: nuevoEstado,
      actualizado_en: new Date(),
    })
    .where("id", "=", recursoId)
    .returning([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
    ])
    .executeTakeFirstOrThrow();
}

export async function insertarRecursosRecuperacionConMision(
  trx: KyselyTrx,
  asignaciones: Array<{
    recuperacionId: string;
    recursoId: string;
    misionId: string;
    cantidad: number;
  }>
) {
  if (asignaciones.length === 0) return;

  await trx
    .insertInto("recuperacion_recurso")
    .values(
      asignaciones.map((item) => ({
        recuperacion_id: item.recuperacionId,
        recurso_id: item.recursoId,
        mision_id: item.misionId,
        cantidad_asignada: item.cantidad,
      }))
    )
    .execute();
}

export async function buscarMisionesPorRecuperacionId(recuperacionId: string) {
  return db
    .selectFrom("mision")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.estado",
      "mision.tipo_mision",
      "mision.creado_en",
      "patrulla_verificadora.id as patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
    ])
    .where("mision.recuperacion_id", "=", recuperacionId)
    .orderBy("mision.creado_en", "desc")
    .execute();
}

export async function buscarRecursosAsignadosPorRecuperacionId(recuperacionId: string) {
  try {
    return await db
      .selectFrom("recuperacion_recurso")
      .leftJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
      .select([
        "recuperacion_recurso.id",
        "recuperacion_recurso.recurso_id",
        "recuperacion_recurso.cantidad_asignada",
        "recuperacion_recurso.mision_id",
        "recuperacion_recurso.creado_en",
        "recurso.nombre as recurso_nombre",
        "recurso.es_individual as recurso_es_individual",
      ])
      .where("recuperacion_recurso.recuperacion_id", "=", recuperacionId)
      .orderBy("recuperacion_recurso.creado_en", "desc")
      .execute();
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42703" || msg.includes("mision_id")) {
      console.warn(
        "Advertencia: la columna recuperacion_recurso.mision_id no existe aún en BD (ejecute `npm run db:migrate` para aplicar la migración 041). Retornando mision_id: null."
      );
      const filasSinMision = await db
        .selectFrom("recuperacion_recurso")
        .leftJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
        .select([
          "recuperacion_recurso.id",
          "recuperacion_recurso.recurso_id",
          "recuperacion_recurso.cantidad_asignada",
          "recuperacion_recurso.creado_en",
          "recurso.nombre as recurso_nombre",
          "recurso.es_individual as recurso_es_individual",
        ])
        .where("recuperacion_recurso.recuperacion_id", "=", recuperacionId)
        .orderBy("recuperacion_recurso.creado_en", "desc")
        .execute();

      return filasSinMision.map((f) => ({
        ...f,
        mision_id: null as string | null,
      }));
    }
    throw err;
  }
}

/**
 * Consulta el detalle exhaustivo de un operativo de recuperación para el drawer lateral (H73).
 * Incluye recursos detallados, misión, patrulla asignada y línea de tiempo unificada.
 */
export async function obtenerRecuperacionDetallePorIdRepo(
  id: string
): Promise<RecuperacionDetalleResponse | null> {
  const recuperacion = await db
    .selectFrom("recuperacion")
    .leftJoin("delegacion", "delegacion.id", "recuperacion.delegacion_id")
    .leftJoin("usuario as creador", "creador.id", "recuperacion.creado_por_id")
    .select([
      "recuperacion.id",
      "recuperacion.codigo",
      "recuperacion.nombre",
      "recuperacion.descripcion",
      "recuperacion.sector",
      "recuperacion.direccion_texto",
      "recuperacion.prioridad",
      "recuperacion.contacto_nombre",
      "recuperacion.contacto_telefono",
      "recuperacion.latitud",
      "recuperacion.longitud",
      "recuperacion.estado",
      "recuperacion.familias_afectadas",
      "recuperacion.delegacion_id",
      sql<string | null>`COALESCE(delegacion.codigo, delegacion.codigo_delegacion)`.as("delegacion_codigo"),
      sql<string | null>`COALESCE(delegacion.nombre, delegacion.nombre_delegacion)`.as("delegacion_nombre"),
      "recuperacion.creado_por_id",
      sql<string | null>`COALESCE(creador.nombre, TRIM(CONCAT(COALESCE(creador.nombres, ''), ' ', COALESCE(creador.apellidos, ''))), 'Encargado de Operaciones')`.as("creador_nombre"),
      sql<Date | null>`CASE WHEN (to_jsonb(recuperacion) ? 'fecha_estimada_fin') THEN (to_jsonb(recuperacion)->>'fecha_estimada_fin')::timestamptz ELSE NULL END`.as("fecha_estimada_fin"),
      sql<string | null>`CASE WHEN (to_jsonb(recuperacion) ? 'actualizado_por_id') THEN (to_jsonb(recuperacion)->>'actualizado_por_id')::uuid ELSE NULL END`.as("actualizado_por_id"),
      sql<Date | null>`CASE WHEN (to_jsonb(recuperacion) ? 'fecha_cierre') THEN (to_jsonb(recuperacion)->>'fecha_cierre')::timestamptz ELSE NULL END`.as("fecha_cierre"),
      sql<string | null>`CASE WHEN (to_jsonb(recuperacion) ? 'observaciones_cierre') THEN (to_jsonb(recuperacion)->>'observaciones_cierre') ELSE NULL END`.as("observaciones_cierre"),
      "recuperacion.creado_en",
      "recuperacion.actualizado_en",
    ])
    .where("recuperacion.id", "=", id)
    .where((eb) => eb(sql`to_jsonb(recuperacion)->>'eliminado_en'`, "is", null))
    .executeTakeFirst();

  if (!recuperacion) {
    return null;
  }

  // Recursos asignados con detalle
  const insumos = await db
    .selectFrom("recuperacion_recurso")
    .innerJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
    .select([
      "recuperacion_recurso.recurso_id",
      "recurso.nombre as recurso_nombre",
      "recuperacion_recurso.cantidad_asignada",
    ])
    .where("recuperacion_recurso.recuperacion_id", "=", id)
    .execute();

  let cantidadTotalUnidades = 0;
  const recursos = (insumos || []).map((i) => {
    const cant = Number(i.cantidad_asignada ?? 0);
    cantidadTotalUnidades += cant;
    return {
      recursoId: i.recurso_id,
      nombre: i.recurso_nombre || "Recurso",
      cantidadAsignada: cant,
    };
  });

  // Misión y patrulla asociada
  const mision = await db
    .selectFrom("mision")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .select([
      "mision.id as mision_id",
      "mision.codigo as mision_codigo",
      "mision.titulo as mision_titulo",
      "mision.estado as mision_estado",
      "mision.tipo_mision as mision_tipo",
      "patrulla_verificadora.id as patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
    ])
    .where("mision.recuperacion_id", "=", id)
    .where("mision.estado", "not in", ["CANCELADA", "RECHAZADA"])
    .orderBy("mision.creado_en", "desc")
    .executeTakeFirst();

  // Historial cronológico unificado
  const historial: HistorialRecuperacionItem[] = [];

  // 1. Creación
  historial.push({
    id: `rec-creacion-${recuperacion.id}`,
    tipo: "CREACION",
    titulo: recuperacion.estado === "PLANIFICADA" ? "Operativo Planificado" : "Operativo Planificado y Despachado",
    descripcion: recuperacion.descripcion ?? "Despliegue de recuperación registrado en el sistema.",
    registradoPor: {
      id: recuperacion.creado_por_id || "00000000-0000-4000-8000-000000000003",
      nombre: recuperacion.creador_nombre || "Encargado de Operaciones",
    },
    creadoEn: formatearFechaIso(recuperacion.creado_en) ?? new Date().toISOString(),
  });

  // 2. Hitos de misión si existe misión
  if (mision?.mision_id) {
    const hitosMision = await db
      .selectFrom("mision_hito")
      .leftJoin("usuario", "usuario.id", "mision_hito.registrado_por_id")
      .select([
        "mision_hito.id",
        "mision_hito.hito",
        "mision_hito.descripcion",
        "mision_hito.creado_en",
        "usuario.id as usuario_id",
        "usuario.nombre as usuario_nombre",
      ])
      .where("mision_hito.mision_id", "=", mision.mision_id)
      .orderBy("mision_hito.creado_en", "asc")
      .execute();

    for (const h of hitosMision) {
      historial.push({
        id: h.id,
        tipo: "HITO_MISION",
        titulo: h.hito,
        descripcion: h.descripcion,
        registradoPor: h.usuario_id
          ? {
              id: h.usuario_id,
              nombre: h.usuario_nombre || "Personal de Terreno",
            }
          : null,
        creadoEn: formatearFechaIso(h.creado_en) ?? new Date().toISOString(),
      });
    }

    // 3. Reportes de terreno si existen
    const reportes = await db
      .selectFrom("reporte_terreno")
      .leftJoin("usuario", "usuario.id", "reporte_terreno.evaluador_id")
      .select([
        "reporte_terreno.id",
        "reporte_terreno.resumen_tecnico",
        "reporte_terreno.acciones_realizadas",
        "reporte_terreno.creado_en",
        "usuario.id as usuario_id",
        "usuario.nombre as usuario_nombre",
      ])
      .where("reporte_terreno.mision_id", "=", mision.mision_id)
      .orderBy("reporte_terreno.creado_en", "asc")
      .execute();

    for (const r of reportes) {
      historial.push({
        id: r.id,
        tipo: "REPORTE_TERRENO",
        titulo: "Reporte de Avance en Terreno",
        descripcion: r.acciones_realizadas || r.resumen_tecnico,
        registradoPor: r.usuario_id
          ? {
              id: r.usuario_id,
              nombre: r.usuario_nombre || "Patrulla Verificadora",
            }
          : null,
        creadoEn: formatearFechaIso(r.creado_en) ?? new Date().toISOString(),
      });
    }
  }

  // 4. Cierre o cancelación si aplica
  if (recuperacion.estado === "COMPLETADA" || recuperacion.estado === "CANCELADA") {
    historial.push({
      id: `rec-cierre-${recuperacion.id}`,
      tipo: "ESTADO_OPERATIVO",
      titulo: `Operativo ${recuperacion.estado === "COMPLETADA" ? "Completado" : "Cancelado"}`,
      descripcion: recuperacion.observaciones_cierre ?? null,
      registradoPor: null,
      creadoEn:
        formatearFechaIso(recuperacion.fecha_cierre) ??
        formatearFechaIso(recuperacion.actualizado_en) ??
        new Date().toISOString(),
    });
  }

  // Ordenar cronológicamente
  historial.sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());

  return {
    id: recuperacion.id,
    codigo: recuperacion.codigo,
    nombre: recuperacion.nombre,
    descripcion: recuperacion.descripcion ?? null,
    sector: recuperacion.sector,
    direccionTexto: recuperacion.direccion_texto ?? null,
    prioridad: recuperacion.prioridad as RecuperacionDetalleResponse["prioridad"],
    contactoNombre: recuperacion.contacto_nombre ?? null,
    contactoTelefono: recuperacion.contacto_telefono ?? null,
    latitud: Number(recuperacion.latitud),
    longitud: Number(recuperacion.longitud),
    estado: recuperacion.estado as RecuperacionDetalleResponse["estado"],
    familiasAfectadas: Number(recuperacion.familias_afectadas ?? 0),
    delegacion: recuperacion.delegacion_id
      ? {
          id: recuperacion.delegacion_id,
          codigo: recuperacion.delegacion_codigo || "",
          nombre: recuperacion.delegacion_nombre || "",
        }
      : null,
    creadoPor: {
      id: recuperacion.creado_por_id || "00000000-0000-4000-8000-000000000003",
      nombre: recuperacion.creador_nombre || "Encargado de Operaciones",
    },
    mision: mision?.mision_id
      ? {
          id: mision.mision_id,
          codigo: mision.mision_codigo,
          titulo: mision.mision_titulo,
          estado: mision.mision_estado,
          tipoMision: mision.mision_tipo,
        }
      : null,
    patrulla: mision?.patrulla_id
      ? {
          id: mision.patrulla_id,
          nombre: mision.patrulla_nombre || "Patrulla Verificadora",
          estado: mision.patrulla_estado || "EN_RECUPERACION",
        }
      : null,
    recursos,
    cantidadInsumosAsignados: cantidadTotalUnidades,
    totalTiposInsumos: recursos.length,
    historial,
    creadoEn: formatearFechaIso(recuperacion.creado_en) ?? new Date().toISOString(),
    actualizadoEn: formatearFechaIso(recuperacion.actualizado_en) ?? new Date().toISOString(),
    fechaEstimadaFin: formatearFechaIso(recuperacion.fecha_estimada_fin),
    actualizadoPorId: recuperacion.actualizado_por_id ?? null,
    fechaCierre: formatearFechaIso(recuperacion.fecha_cierre),
    observacionesCierre: recuperacion.observaciones_cierre ?? null,
  };
}

export async function listarRecuperacionesRepo(trx: KyselyTrx | typeof db = db) {
  return trx
    .selectFrom("recuperacion")
    .leftJoin("delegacion", "delegacion.id", "recuperacion.delegacion_id")
    .select([
      "recuperacion.id",
      "recuperacion.codigo",
      "recuperacion.nombre",
      "recuperacion.descripcion",
      "recuperacion.sector",
      "recuperacion.direccion_texto",
      "recuperacion.prioridad",
      "recuperacion.contacto_nombre",
      "recuperacion.contacto_telefono",
      "recuperacion.latitud",
      "recuperacion.longitud",
      "recuperacion.estado",
      "recuperacion.familias_afectadas",
      "recuperacion.delegacion_id",
      "recuperacion.creado_por_id",
      "recuperacion.creado_en",
      "recuperacion.actualizado_en",
      "delegacion.codigo as delegacion_codigo",
      "delegacion.nombre as delegacion_nombre",
    ])
    .where("recuperacion.eliminado_en", "is", null)
    .orderBy("recuperacion.creado_en", "desc")
    .execute();
}

export async function listarMisionesPorRecuperacionIds(recuperacionIds: string[]) {
  if (recuperacionIds.length === 0) return [];
  return db
    .selectFrom("mision")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.estado",
      "mision.tipo_mision",
      "mision.recuperacion_id",
      "mision.creado_en",
      "patrulla_verificadora.id as patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
    ])
    .where("mision.recuperacion_id", "in", recuperacionIds)
    .orderBy("mision.creado_en", "desc")
    .execute();
}

export async function listarRecursosPorRecuperacionIds(recuperacionIds: string[]) {
  if (recuperacionIds.length === 0) return [];
  return db
    .selectFrom("recuperacion_recurso")
    .innerJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
    .select([
      "recuperacion_recurso.id",
      "recuperacion_recurso.recuperacion_id",
      "recuperacion_recurso.recurso_id",
      "recuperacion_recurso.cantidad_asignada",
      "recurso.nombre as recurso_nombre",
      "recurso.es_individual as recurso_es_individual",
    ])
    .where("recuperacion_recurso.recuperacion_id", "in", recuperacionIds)
    .orderBy("recuperacion_recurso.creado_en", "desc")
    .execute();
}
