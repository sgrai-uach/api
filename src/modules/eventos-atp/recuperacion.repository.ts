import { sql, type Transaction } from "kysely";
import type { Database, EstadoRecurso, EstadoPatrulla, EstadoOperativo, PrioridadIncidente } from "@/lib/db/types";

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
  const anio = new Date().getFullYear();
  const prefijo = `REC-${anio}-`;

  const conteo = await trx
    .selectFrom("recuperacion")
    .where("codigo", "like", `${prefijo}%`)
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  const secuencia = (conteo?.total ?? 0) + 1;
  return `${prefijo}${String(secuencia).padStart(4, "0")}`;
}

export async function generarSiguienteCodigoMision(trx: KyselyTrx): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `MIS-${anio}-`;

  const conteo = await trx
    .selectFrom("mision")
    .where("codigo", "like", `${prefijo}%`)
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  const secuencia = (conteo?.total ?? 0) + 1;
  return `${prefijo}${String(secuencia).padStart(4, "0")}`;
}

export async function buscarPatrullaPorId(trx: KyselyTrx, patrullaId: string) {
  return trx
    .selectFrom("patrulla_verificadora")
    .select(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .where("id", "=", patrullaId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .executeTakeFirst();
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
      fecha_inicio: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function insertarRecursosRecuperacion(
  trx: KyselyTrx,
  asignaciones: Array<{ recuperacionId: string; recursoId: string; cantidad: number }>
) {
  if (asignaciones.length === 0) return;

  await trx
    .insertInto("recuperacion_recurso")
    .values(
      asignaciones.map((item) => ({
        recuperacion_id: item.recuperacionId,
        recurso_id: item.recursoId,
        cantidad_asignada: item.cantidad,
      }))
    )
    .execute();
}

async function ajustarStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  deltaInventario: number
) {
  const recurso = await trx
    .selectFrom("recurso")
    .select(["cantidad_inventario", "cantidad_en_uso", "cantidad_minima"])
    .where("id", "=", recursoId)
    .executeTakeFirstOrThrow();

  const nuevoInventario = Math.max(0, Number(recurso.cantidad_inventario) + deltaInventario);
  const cantidadEnUso = Number(recurso.cantidad_en_uso ?? 0);
  const cantidadMinima = Number(recurso.cantidad_minima ?? 0);
  const disponible = Math.max(0, nuevoInventario - cantidadEnUso);

  let nuevoEstado: EstadoRecurso = "DISPONIBLE";
  if (disponible === 0) {
    nuevoEstado = "NO_DISPONIBLE";
  } else if (disponible <= cantidadMinima) {
    nuevoEstado = "BAJO_STOCK";
  }

  await trx
    .updateTable("recurso")
    .set({
      cantidad_inventario: nuevoInventario,
      estado: nuevoEstado,
      actualizado_en: new Date(),
    })
    .where("id", "=", recursoId)
    .execute();
}

export async function descontarStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  cantidadADescontar: number
) {
  return ajustarStockRecurso(trx, recursoId, -cantidadADescontar);
}

export async function devolverStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  cantidadADevolver: number
) {
  return ajustarStockRecurso(trx, recursoId, cantidadADevolver);
}

export async function actualizarEstadoPatrulla(
  trx: KyselyTrx,
  patrullaId: string,
  nuevoEstado: EstadoPatrulla = "EN_RECUPERACION"
) {
  await trx
    .updateTable("patrulla_verificadora")
    .set({
      estado: nuevoEstado,
    })
    .where("id", "=", patrullaId)
    .execute();
}

export async function actualizarEstadoPersonalLider(
  trx: KyselyTrx,
  usuarioLiderId: string,
  nuevoEstado: EstadoOperativo = "en_mision",
  disponibleTerreno = false
) {
  // H11: la disponibilidad reside en `usuario.estado_operativo`
  await trx
    .updateTable("usuario")
    .set({
      estado_operativo: nuevoEstado,
    })
    .where("id", "=", usuarioLiderId)
    .execute();

  // La aptitud para terreno se mantiene en la ficha opcional de personal
  await trx
    .updateTable("personal")
    .set({
      disponible_terreno: disponibleTerreno,
      updated_at: new Date(),
    })
    .where("usuario_id", "=", usuarioLiderId)
    .execute();
}

export async function buscarDelegacionPorId(trx: KyselyTrx, delegacionId: string) {
  return trx
    .selectFrom("delegacion")
    .select(["id", "codigo", "codigo_delegacion", "nombre", "nombre_delegacion"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

export async function buscarRecuperacionPorId(trx: KyselyTrx, id: string) {
  return trx
    .selectFrom("recuperacion")
    .selectAll()
    .where("id", "=", id)
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
      "rr.cantidad_asignada as cantidadAsignada",
    ])
    .where("rr.recuperacion_id", "=", recuperacionId)
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
    .returningAll()
    .executeTakeFirstOrThrow();
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
  await trx
    .updateTable("mision")
    .set({
      patrulla_id: nuevaPatrullaId,
      actualizado_en: new Date(),
    })
    .where("id", "=", misionId)
    .execute();
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
