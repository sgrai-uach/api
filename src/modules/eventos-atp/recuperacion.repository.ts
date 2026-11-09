import { sql, type Transaction } from "kysely";
import { db } from "@/lib/db";
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

export async function descontarStockRecurso(
  trx: KyselyTrx,
  recursoId: string,
  cantidadADescontar: number
) {
  const recurso = await trx
    .selectFrom("recurso")
    .select(["cantidad_inventario", "cantidad_en_uso", "cantidad_minima"])
    .where("id", "=", recursoId)
    .executeTakeFirstOrThrow();

  const nuevoInventario = Math.max(0, Number(recurso.cantidad_inventario) - cantidadADescontar);
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
  nuevoEstado: EstadoOperativo = "en_mision"
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
      disponible_terreno: false,
      updated_at: new Date(),
    })
    .where("usuario_id", "=", usuarioLiderId)
    .execute();
}

export async function buscarDelegacionPorId(trx: KyselyTrx | typeof db, delegacionId: string) {
  return trx
    .selectFrom("delegacion")
    .select(["id", "codigo", "codigo_delegacion", "nombre", "nombre_delegacion"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

export async function buscarRecuperacionPorId(trx: KyselyTrx | typeof db, recuperacionId: string) {
  return trx
    .selectFrom("recuperacion")
    .selectAll()
    .where("id", "=", recuperacionId)
    .executeTakeFirst();
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
  return trx
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
  return db
    .selectFrom("recuperacion_recurso")
    .innerJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
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
}

