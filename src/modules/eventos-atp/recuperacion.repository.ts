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
  // No mutar `personal.disponible_terreno` para preservar la aptitud para otras cuadrillas/patrullas
  await trx
    .updateTable("usuario")
    .set({
      estado_operativo: nuevoEstado,
    })
    .where("id", "=", usuarioLiderId)
    .execute();
}

export async function buscarDelegacionPorId(trx: KyselyTrx | typeof db, delegacionId: string) {
  return trx
    .selectFrom("delegacion")
    .select(["id", "codigo", "codigo_delegacion", "nombre", "nombre_delegacion"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

export async function buscarRecuperacionPorId(
  trx: KyselyTrx | typeof db,
  recuperacionId: string,
  bloquear: boolean = false
) {
  const query = trx
    .selectFrom("recuperacion")
    .select([
      "id",
      "codigo",
      "nombre",
      "descripcion",
      "sector",
      "direccion_texto",
      "prioridad",
      "contacto_nombre",
      "contacto_telefono",
      "latitud",
      "longitud",
      "estado",
      "familias_afectadas",
      "delegacion_id",
      "creado_por_id",
      "creado_en",
      "actualizado_en",
    ])
    .where("id", "=", recuperacionId);

  if (bloquear) {
    return query.forUpdate().executeTakeFirst();
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

