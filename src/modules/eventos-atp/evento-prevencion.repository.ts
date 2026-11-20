import { sql, type Transaction } from "kysely";
import { db } from "@/lib/db";
import type { Database, EstadoOperativo, EstadoRecurso } from "@/lib/db/types";
import type { ListarEventosPrevencionQuery } from "./evento-prevencion.schema";

export type Trx = Transaction<Database>;

export async function buscarPatrullaPorId(trx: Trx, patrullaId: string) {
  return await trx
    .selectFrom("patrulla_verificadora")
    .select(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .where("id", "=", patrullaId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .executeTakeFirst();
}

export async function buscarPatrullaParaBloqueo(trx: Trx, patrullaId: string) {
  return await trx
    .selectFrom("patrulla_verificadora")
    .select(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .where("id", "=", patrullaId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .forUpdate()
    .executeTakeFirst();
}

export async function actualizarEstadoPatrulla(
  trx: Trx,
  patrullaId: string,
  nuevoEstado: "DISPONIBLE" | "EN_VERIFICACION" | "EN_PREVENCION" | "NO_DISPONIBLE"
) {
  return await trx
    .updateTable("patrulla_verificadora")
    .set({ estado: nuevoEstado })
    .where("id", "=", patrullaId)
    .execute();
}

export async function actualizarEstadoPersonalLider(
  trx: Trx,
  usuarioId: string,
  estadoOperativo: EstadoOperativo
) {
  // H11: la disponibilidad reside en `usuario.estado_operativo`
  await trx
    .updateTable("usuario")
    .set({ estado_operativo: estadoOperativo })
    .where("id", "=", usuarioId)
    .execute();

  if (estadoOperativo === "en_mision") {
    await trx
      .updateTable("personal")
      .set({
        disponible_terreno: false,
        updated_at: new Date(),
      })
      .where("usuario_id", "=", usuarioId)
      .execute();
  }
}

export async function buscarDelegacionPorId(trx: Trx, delegacionId: string) {
  return await trx
    .selectFrom("delegacion")
    .selectAll()
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

export async function buscarPuntoCriticoPorId(trx: Trx, puntoCriticoId: string) {
  return await trx
    .selectFrom("prevencion")
    .select(["id", "codigo", "nombre", "activo"])
    .where("id", "=", puntoCriticoId)
    .executeTakeFirst();
}

export async function obtenerRecursosParaBloqueo(trx: Trx, recursoIds: string[]) {
  if (recursoIds.length === 0) return [];
  return await trx
    .selectFrom("recurso")
    .select([
      "id",
      "nombre",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
      "estado",
      "es_individual",
      "eliminado_en",
    ])
    .where("id", "in", recursoIds)
    .where("eliminado_en", "is", null)
    .orderBy("id", "asc")
    .forUpdate()
    .execute();
}

export async function descontarStockRecurso(trx: Trx, recursoId: string, cantidad: number) {
  return await trx
    .updateTable("recurso")
    .set((eb) => ({
      cantidad_inventario: eb("cantidad_inventario", "-", cantidad),
    }))
    .where("id", "=", recursoId)
    .execute();
}

export async function devolverStockRecurso(trx: Trx, recursoId: string, cantidad: number) {
  return await trx
    .updateTable("recurso")
    .set((eb) => ({
      cantidad_inventario: eb("cantidad_inventario", "+", cantidad),
    }))
    .where("id", "=", recursoId)
    .execute();
}

export async function generarSiguienteCodigoPrevencion(trx: Trx): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `PREV-${anio}-`;

  const eventos = await trx
    .selectFrom("evento_prevencion")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .execute();

  let maxCorrelativo = 0;
  for (const ev of eventos) {
    if (ev.codigo) {
      const partes = ev.codigo.split("-");
      const num = parseInt(partes[partes.length - 1], 10);
      if (!isNaN(num) && num > maxCorrelativo) {
        maxCorrelativo = num;
      }
    }
  }

  let correlativo = maxCorrelativo + 1;
  let codigoCandidato = `${prefijo}${String(correlativo).padStart(4, "0")}`;

  while (
    await trx
      .selectFrom("evento_prevencion")
      .select("id")
      .where("codigo", "=", codigoCandidato)
      .executeTakeFirst()
  ) {
    correlativo++;
    codigoCandidato = `${prefijo}${String(correlativo).padStart(4, "0")}`;
  }

  return codigoCandidato;
}

export async function generarSiguienteCodigoMision(trx: Trx): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `MIS-${anio}-`;

  const misiones = await trx
    .selectFrom("mision")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .execute();

  let maxCorrelativo = 0;
  for (const m of misiones) {
    if (m.codigo) {
      const partes = m.codigo.split("-");
      const num = parseInt(partes[partes.length - 1], 10);
      if (!isNaN(num) && num > maxCorrelativo) {
        maxCorrelativo = num;
      }
    }
  }

  let correlativo = maxCorrelativo + 1;
  let codigoCandidato = `${prefijo}${String(correlativo).padStart(4, "0")}`;

  while (
    await trx
      .selectFrom("mision")
      .select("id")
      .where("codigo", "=", codigoCandidato)
      .executeTakeFirst()
  ) {
    correlativo++;
    codigoCandidato = `${prefijo}${String(correlativo).padStart(4, "0")}`;
  }

  return codigoCandidato;
}

export interface InsertarEventoPrevencionData {
  codigo: string;
  nombre: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  sector?: string | null;
  direccionTexto?: string | null;
  puntoCriticoId?: string | null;
  delegacionId: string;
  latitud: number;
  longitud: number;
  fechaEstimadaFin?: Date | null;
  creadoPorId: string;
}

export async function insertarEventoPrevencion(trx: Trx, data: InsertarEventoPrevencionData) {
  const query = sql`
    INSERT INTO evento_prevencion (
      codigo, nombre, descripcion, prioridad, estado, sector, direccion_texto,
      punto_critico_id, delegacion_id, latitud, longitud, ubicacion, fecha_estimada_fin, creado_por_id
    ) VALUES (
      ${data.codigo}, ${data.nombre}, ${data.descripcion}, ${data.prioridad}, 'PLANIFICADA',
      ${data.sector ?? null}, ${data.direccionTexto ?? null}, ${data.puntoCriticoId ?? null},
      ${data.delegacionId}, ${data.latitud}, ${data.longitud},
      ST_SetSRID(ST_MakePoint(${data.longitud}, ${data.latitud}), 4326),
      ${data.fechaEstimadaFin ?? null},
      ${data.creadoPorId}
    )
    RETURNING id, codigo, nombre, descripcion, prioridad, estado, sector, direccion_texto,
              punto_critico_id, delegacion_id, latitud, longitud, fecha_estimada_fin,
              creado_por_id, actualizado_por_id, creado_en, actualizado_en
  `;

  const result = await query.execute(trx);
  return result.rows[0] as {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    estado: string;
    sector: string | null;
    direccion_texto: string | null;
    punto_critico_id: string | null;
    delegacion_id: string;
    latitud: number | string;
    longitud: number | string;
    fecha_estimada_fin?: Date | null;
    creado_por_id: string;
    actualizado_por_id?: string | null;
    creado_en: Date;
    actualizado_en: Date;
  };
}

export interface InsertarMisionPrevencionData {
  codigo: string;
  titulo: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  eventoPrevencionId: string;
  puntoCriticoId?: string | null;
  patrullaId: string;
  encargadoId: string;
  creadoPorId: string;
}

export async function insertarMisionPrevencion(trx: Trx, data: InsertarMisionPrevencionData) {
  return await trx
    .insertInto("mision")
    .values({
      codigo: data.codigo,
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo_mision: "PREVENCION",
      estado: "DESPACHADA",
      prioridad: data.prioridad,
      evento_prevencion_id: data.eventoPrevencionId,
      prevencion_id: data.puntoCriticoId ?? null,
      patrulla_id: data.patrullaId,
      encargado_id: data.encargadoId,
      creado_por_id: data.creadoPorId,
      fecha_inicio: null,
    })
    .returning(["id", "codigo", "titulo", "estado", "tipo_mision"])
    .executeTakeFirstOrThrow();
}

export async function actualizarEstadoEventoPrevencionEnCurso(
  trx: Trx,
  eventoId: string,
  usuarioId: string
) {
  return await trx
    .updateTable("evento_prevencion")
    .set({
      estado: "EN_CURSO",
      actualizado_en: new Date(),
      actualizado_por_id: usuarioId,
    })
    .where("id", "=", eventoId)
    .where("estado", "=", "PLANIFICADA")
    .execute();
}

export async function insertarHitoDespachoMisionPrevencion(
  trx: Trx,
  misionId: string,
  patrullaNombre: string,
  usuarioId: string
) {
  return await trx
    .insertInto("mision_hito")
    .values({
      mision_id: misionId,
      hito: "DESPACHADA",
      descripcion: `Misión preventiva asignada y despachada a la patrulla ${patrullaNombre}.`,
      registrado_por_id: usuarioId,
    })
    .execute();
}

export interface AsignacionRecursoData {
  eventoPrevencionId: string;
  recursoId: string;
  cantidad: number;
}

export async function insertarRecursosPrevencion(
  trx: Trx,
  asignaciones: AsignacionRecursoData[]
) {
  if (asignaciones.length === 0) return;
  return await trx
    .insertInto("evento_prevencion_recurso")
    .values(
      asignaciones.map((a) => ({
        evento_prevencion_id: a.eventoPrevencionId,
        recurso_id: a.recursoId,
        cantidad_asignada: a.cantidad,
      }))
    )
    .execute();
}

function escaparPatronIlike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listarEventosPrevencionPaginados(
  filtros: ListarEventosPrevencionQuery
) {
  const { page, limit, delegacionId, estado, busqueda } = filtros;
  const offset = (page - 1) * limit;

  let baseQuery = db
    .selectFrom("evento_prevencion as ep")
    .leftJoin("delegacion as d", "d.id", "ep.delegacion_id")
    .leftJoin("prevencion as pc", "pc.id", "ep.punto_critico_id")
    .where("ep.activo", "=", true)
    .where("ep.eliminado_en", "is", null);

  if (delegacionId) {
    baseQuery = baseQuery.where("ep.delegacion_id", "=", delegacionId);
  }

  if (estado) {
    baseQuery = baseQuery.where("ep.estado", "=", estado);
  }

  if (busqueda && busqueda.length > 0) {
    const patron = `%${escaparPatronIlike(busqueda)}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb("ep.codigo", "ilike", patron),
        eb("ep.nombre", "ilike", patron),
        eb("ep.sector", "ilike", patron),
        eb("pc.codigo", "ilike", patron),
        eb("pc.nombre", "ilike", patron),
      ])
    );
  }

  const totalResult = await baseQuery
    .select((eb) => eb.fn.count<string>("ep.id").as("total"))
    .executeTakeFirst();

  const total = Number(totalResult?.total ?? 0);

  if (total === 0) {
    return {
      total: 0,
      eventos: [],
      misionesPorEvento: new Map(),
      recursosPorEvento: new Map(),
    };
  }

  const eventos = await baseQuery
    .select([
      "ep.id as ep_id",
      "ep.codigo as ep_codigo",
      "ep.nombre as ep_nombre",
      "ep.descripcion as ep_descripcion",
      "ep.sector as ep_sector",
      "ep.direccion_texto as ep_direccion_texto",
      "ep.prioridad as ep_prioridad",
      "ep.estado as ep_estado",
      "ep.latitud as ep_latitud",
      "ep.longitud as ep_longitud",
      sql<unknown>`ST_AsGeoJSON(ep.ubicacion)::json`.as("ep_ubicacion_geojson"),
      "ep.fecha_estimada_fin as ep_fecha_estimada_fin",
      "ep.creado_por_id as ep_creado_por_id",
      "ep.actualizado_por_id as ep_actualizado_por_id",
      "ep.creado_en as ep_creado_en",
      "ep.actualizado_en as ep_actualizado_en",
      "d.id as del_id",
      "d.codigo as del_codigo",
      "d.nombre as del_nombre",
      "pc.id as pc_id",
      "pc.codigo as pc_codigo",
      "pc.nombre as pc_nombre",
      "pc.descripcion as pc_descripcion",
      "pc.tipo_riesgo as pc_tipo_riesgo",
      "pc.prioridad as pc_prioridad",
      "pc.latitud as pc_latitud",
      "pc.longitud as pc_longitud",
      sql<unknown>`ST_AsGeoJSON(pc.ubicacion)::json`.as("pc_ubicacion_geojson"),
    ])
    .orderBy("ep.creado_en", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  const eventoIds = eventos.map((e) => e.ep_id);

  const misionesRows = await db
    .selectFrom("mision as m")
    .leftJoin("patrulla_verificadora as pv", "pv.id", "m.patrulla_id")
    .leftJoin("cuadrilla as c", "c.id", "m.cuadrilla_id")
    .select([
      "m.evento_prevencion_id as evento_prevencion_id",
      "m.id as m_id",
      "m.codigo as m_codigo",
      "m.titulo as m_titulo",
      "m.estado as m_estado",
      "m.tipo_mision as m_tipo_mision",
      "m.fecha_inicio as m_fecha_inicio",
      "m.fecha_cierre as m_fecha_cierre",
      "pv.id as pv_id",
      "pv.nombre as pv_nombre",
      "pv.estado as pv_estado",
      "c.id as c_id",
      "c.nombre as c_nombre",
      "c.estado as c_estado",
    ])
    .where("m.evento_prevencion_id", "in", eventoIds)
    .orderBy("m.creado_en", "desc")
    .execute();

  const misionesPorEvento = new Map<string, (typeof misionesRows)[number]>();
  for (const row of misionesRows) {
    if (row.evento_prevencion_id && !misionesPorEvento.has(row.evento_prevencion_id)) {
      misionesPorEvento.set(row.evento_prevencion_id, row);
    }
  }

  const recursosRows = await db
    .selectFrom("evento_prevencion_recurso as epr")
    .innerJoin("recurso as r", "r.id", "epr.recurso_id")
    .select([
      "epr.evento_prevencion_id as evento_prevencion_id",
      "epr.recurso_id as recurso_id",
      "r.nombre as recurso_nombre",
      "epr.cantidad_asignada as cantidad_asignada",
    ])
    .where("epr.evento_prevencion_id", "in", eventoIds)
    .execute();

  const recursosPorEvento = new Map<
    string,
    Array<{ recursoId: string; nombre: string; cantidadAsignada: number }>
  >();
  for (const r of recursosRows) {
    const lista = recursosPorEvento.get(r.evento_prevencion_id) ?? [];
    lista.push({
      recursoId: r.recurso_id,
      nombre: r.recurso_nombre,
      cantidadAsignada: Number(r.cantidad_asignada),
    });
    recursosPorEvento.set(r.evento_prevencion_id, lista);
  }

  return {
    total,
    eventos,
    misionesPorEvento,
    recursosPorEvento,
  };
}


export async function buscarEventoPrevencionParaEdicion(trx: Trx, eventoId: string) {
  return await trx
    .selectFrom("evento_prevencion")
    .select([
      "id",
      "codigo",
      "nombre",
      "descripcion",
      "prioridad",
      "estado",
      "sector",
      "direccion_texto",
      "punto_critico_id",
      "delegacion_id",
      "latitud",
      "longitud",
      "fecha_estimada_fin",
      "activo",
      "eliminado_en",
      "creado_por_id",
      "actualizado_por_id",
      "creado_en",
      "actualizado_en",
    ])
    .where("id", "=", eventoId)
    .forUpdate()
    .executeTakeFirst();
}

export async function listarRecursosAsignadosPrevencion(trx: Trx, eventoId: string) {
  return await trx
    .selectFrom("evento_prevencion_recurso as epr")
    .innerJoin("recurso as r", "r.id", "epr.recurso_id")
    .select([
      "epr.recurso_id as recursoId",
      "r.nombre as nombre",
      "epr.cantidad_asignada as cantidadAsignada",
    ])
    .where("epr.evento_prevencion_id", "=", eventoId)
    .execute();
}

export async function eliminarRecursosPrevencion(trx: Trx, eventoId: string) {
  return await trx
    .deleteFrom("evento_prevencion_recurso")
    .where("evento_prevencion_id", "=", eventoId)
    .execute();
}

export interface ActualizarEventoPrevencionData {
  nombre?: string;
  descripcion?: string;
  prioridad?: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  fechaEstimadaFin?: Date | null;
  actualizadoPorId: string;
}

export async function actualizarEventoPrevencion(
  trx: Trx,
  eventoId: string,
  data: ActualizarEventoPrevencionData
) {
  const valoresUpdate: Record<string, unknown> = {
    actualizado_por_id: data.actualizadoPorId,
    actualizado_en: new Date(),
  };

  if (data.nombre !== undefined) valoresUpdate.nombre = data.nombre;
  if (data.descripcion !== undefined) valoresUpdate.descripcion = data.descripcion;
  if (data.prioridad !== undefined) valoresUpdate.prioridad = data.prioridad;
  if (data.fechaEstimadaFin !== undefined) valoresUpdate.fecha_estimada_fin = data.fechaEstimadaFin;

  return await trx
    .updateTable("evento_prevencion")
    .set(valoresUpdate)
    .where("id", "=", eventoId)
    .returning([
      "id",
      "codigo",
      "nombre",
      "descripcion",
      "prioridad",
      "estado",
      "sector",
      "direccion_texto",
      "punto_critico_id",
      "delegacion_id",
      "latitud",
      "longitud",
      "fecha_estimada_fin",
      "creado_por_id",
      "actualizado_por_id",
      "creado_en",
      "actualizado_en",
    ])
    .executeTakeFirstOrThrow();
}

export async function sincronizarMisionPrevencion(
  trx: Trx,
  eventoId: string,
  data: {
    titulo?: string;
    descripcion?: string;
    prioridad?: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  }
) {
  const valoresUpdate: Record<string, unknown> = {};
  if (data.titulo !== undefined) valoresUpdate.titulo = data.titulo;
  if (data.descripcion !== undefined) valoresUpdate.descripcion = data.descripcion;
  if (data.prioridad !== undefined) valoresUpdate.prioridad = data.prioridad;

  if (Object.keys(valoresUpdate).length === 0) return;

  valoresUpdate.actualizado_en = new Date();

  await trx
    .updateTable("mision")
    .set(valoresUpdate)
    .where("evento_prevencion_id", "=", eventoId)
    .execute();
}

export async function obtenerMisionYPatrullaDeEventoPrevencion(trx: Trx, eventoId: string) {
  return await trx
    .selectFrom("mision as m")
    .leftJoin("patrulla_verificadora as pv", "pv.id", "m.patrulla_id")
    .select([
      "m.id as m_id",
      "m.codigo as m_codigo",
      "m.titulo as m_titulo",
      "m.estado as m_estado",
      "m.tipo_mision as m_tipo_mision",
      "pv.id as pv_id",
      "pv.nombre as pv_nombre",
      "pv.estado as pv_estado",
    ])
    .where("m.evento_prevencion_id", "=", eventoId)
    .orderBy("m.creado_en", "desc")
    .executeTakeFirst();
}

export async function actualizarRecursoGranelUso(
  trx: Trx,
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
  } else if (cantidadMinima > 0 && nuevoDisponible <= cantidadMinima) {
    nuevoEstado = "BAJO_STOCK";
  }

  return await trx
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

export async function actualizarRecursoIndividualAsignado(trx: Trx, recursoId: string) {
  return await trx
    .updateTable("recurso")
    .set({
      cantidad_en_uso: 1,
      estado: "ASIGNADO",
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

export interface AsignacionRecursoConMisionData {
  eventoPrevencionId: string;
  recursoId: string;
  misionId: string;
  cantidad: number;
}

export async function insertarRecursosPrevencionConMision(
  trx: Trx,
  asignaciones: AsignacionRecursoConMisionData[]
) {
  if (asignaciones.length === 0) return;
  return await trx
    .insertInto("evento_prevencion_recurso")
    .values(
      asignaciones.map((a) => ({
        evento_prevencion_id: a.eventoPrevencionId,
        recurso_id: a.recursoId,
        mision_id: a.misionId,
        cantidad_asignada: a.cantidad,
      }))
    )
    .execute();
}

export async function marcarActualizacionEventoPrevencion(
  trx: Trx,
  eventoId: string,
  usuarioId: string
) {
  return await trx
    .updateTable("evento_prevencion")
    .set({
      actualizado_en: new Date(),
      actualizado_por_id: usuarioId,
    })
    .where("id", "=", eventoId)
    .execute();
}

export async function buscarEventoPrevencionDetallePorId(eventoId: string) {
  return await db
    .selectFrom("evento_prevencion as ep")
    .leftJoin("delegacion as d", "d.id", "ep.delegacion_id")
    .leftJoin("prevencion as pc", "pc.id", "ep.punto_critico_id")
    .select([
      "ep.id as ep_id",
      "ep.codigo as ep_codigo",
      "ep.nombre as ep_nombre",
      "ep.descripcion as ep_descripcion",
      "ep.sector as ep_sector",
      "ep.direccion_texto as ep_direccion_texto",
      "ep.prioridad as ep_prioridad",
      "ep.estado as ep_estado",
      "ep.latitud as ep_latitud",
      "ep.longitud as ep_longitud",
      sql<unknown>`ST_AsGeoJSON(ep.ubicacion)::json`.as("ep_ubicacion_geojson"),
      "ep.fecha_estimada_fin as ep_fecha_estimada_fin",
      "ep.creado_por_id as ep_creado_por_id",
      "ep.actualizado_por_id as ep_actualizado_por_id",
      "ep.creado_en as ep_creado_en",
      "ep.actualizado_en as ep_actualizado_en",
      "d.id as del_id",
      "d.codigo as del_codigo",
      "d.nombre as del_nombre",
      "pc.id as pc_id",
      "pc.codigo as pc_codigo",
      "pc.nombre as pc_nombre",
      "pc.descripcion as pc_descripcion",
      "pc.tipo_riesgo as pc_tipo_riesgo",
      "pc.prioridad as pc_prioridad",
      "pc.latitud as pc_latitud",
      "pc.longitud as pc_longitud",
      sql<unknown>`ST_AsGeoJSON(pc.ubicacion)::json`.as("pc_ubicacion_geojson"),
    ])
    .where("ep.id", "=", eventoId)
    .where("ep.activo", "=", true)
    .where("ep.eliminado_en", "is", null)
    .executeTakeFirst();
}

export async function buscarMisionesPorEventoPrevencionId(eventoId: string) {
  return await db
    .selectFrom("mision as m")
    .leftJoin("patrulla_verificadora as pv", "pv.id", "m.patrulla_id")
    .leftJoin("cuadrilla as c", "c.id", "m.cuadrilla_id")
    .select([
      "m.id as m_id",
      "m.codigo as m_codigo",
      "m.titulo as m_titulo",
      "m.estado as m_estado",
      "m.tipo_mision as m_tipo_mision",
      "m.fecha_inicio as m_fecha_inicio",
      "m.fecha_cierre as m_fecha_cierre",
      "m.creado_en as m_creado_en",
      "pv.id as pv_id",
      "pv.nombre as pv_nombre",
      "pv.estado as pv_estado",
      "c.id as c_id",
      "c.nombre as c_nombre",
      "c.estado as c_estado",
    ])
    .where("m.evento_prevencion_id", "=", eventoId)
    .orderBy("m.creado_en", "desc")
    .execute();
}

export async function buscarRecursosAsignadosDetallePorEventoPrevencionId(eventoId: string) {
  try {
    return await db
      .selectFrom("evento_prevencion_recurso as epr")
      .leftJoin("recurso as r", "r.id", "epr.recurso_id")
      .select([
        "epr.id",
        "epr.recurso_id",
        "epr.cantidad_asignada",
        "epr.mision_id",
        "epr.creado_en",
        "r.nombre as recurso_nombre",
        "r.es_individual as recurso_es_individual",
      ])
      .where("epr.evento_prevencion_id", "=", eventoId)
      .orderBy("epr.creado_en", "desc")
      .execute();
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42703" || msg.includes("mision_id")) {
      console.warn(
        "Advertencia: la columna evento_prevencion_recurso.mision_id no existe aún en BD (ejecute `npm run db:migrate` para aplicar la migración 060). Retornando mision_id: null."
      );
      const filasSinMision = await db
        .selectFrom("evento_prevencion_recurso as epr")
        .leftJoin("recurso as r", "r.id", "epr.recurso_id")
        .select([
          "epr.id",
          "epr.recurso_id",
          "epr.cantidad_asignada",
          "epr.creado_en",
          "r.nombre as recurso_nombre",
          "r.es_individual as recurso_es_individual",
        ])
        .where("epr.evento_prevencion_id", "=", eventoId)
        .orderBy("epr.creado_en", "desc")
        .execute();

      return filasSinMision.map((f) => ({
        ...f,
        mision_id: null as string | null,
      }));
    }
    throw err;
  }
}
