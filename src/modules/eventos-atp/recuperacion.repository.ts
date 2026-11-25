import { sql, type Transaction } from "kysely";
import { db } from "@/lib/db";
import type { Database, EstadoRecurso, EstadoPatrulla, EstadoOperativo, PrioridadIncidente } from "@/lib/db/types";
import type {
  ListarRecuperacionesQuery,
  OperativoRecuperacionItem,
  RecuperacionDetalleResponseData,
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
  usuarioId: string,
  descripcion: string
) {
  return trx
    .insertInto("mision_hito")
    .values({
      mision_id: misionId,
      hito: "DESPACHADA",
      descripcion,
      registrado_por_id: usuarioId,
      latitud: null,
      longitud: null,
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
  let query = trx
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
      sql<string | null>`COALESCE(delegacion.codigo, delegacion.codigo_delegacion)`.as("delegacion_codigo"),
      sql<string | null>`COALESCE(delegacion.nombre, delegacion.nombre_delegacion)`.as("delegacion_nombre"),
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

// ==========================================
// CONSULTAS PARA LISTADO PAGINADO Y DRAWER H73
// ==========================================

/**
 * Consulta paginada y filtrable de operativos de recuperación (H73).
 * Retorna las filas mapeadas con su delegación y el resumen consolidado de recursos asignados.
 */
export async function listarRecuperacionesPaginadoRepo(
  filtros: ListarRecuperacionesQuery
): Promise<{ filas: OperativoRecuperacionItem[]; total: number }> {
  // BUG-H73-API-03: Soporte de aliases pagina y limite sin ser descartados
  const page = filtros.page ?? filtros.pagina ?? 1;
  const limit = filtros.limit ?? filtros.limite ?? 10;
  const offset = (page - 1) * limit;
  const orden = filtros.orden ?? "desc";

  let baseQuery = db
    .selectFrom("recuperacion")
    .leftJoin("delegacion", "delegacion.id", "recuperacion.delegacion_id")
    .where("recuperacion.eliminado_en", "is", null);

  if (filtros.delegacionId) {
    baseQuery = baseQuery.where("recuperacion.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.estado) {
    baseQuery = baseQuery.where("recuperacion.estado", "=", filtros.estado);
  }

  if (filtros.prioridad) {
    baseQuery = baseQuery.where("recuperacion.prioridad", "=", filtros.prioridad);
  }

  // BUG-H73-API-02: Manejo de fechas seguro
  if (filtros.fechaDesde && filtros.fechaDesde.trim() !== "") {
    baseQuery = baseQuery.where("recuperacion.creado_en", ">=", new Date(filtros.fechaDesde));
  }

  if (filtros.fechaHasta && filtros.fechaHasta.trim() !== "") {
    baseQuery = baseQuery.where("recuperacion.creado_en", "<=", new Date(filtros.fechaHasta));
  }

  // BUG-H73-API-04: Sanitización de caracteres comodín SQL (%, _, \)
  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const busquedaLimpia = filtros.busqueda.trim();
    const busquedaEscapada = busquedaLimpia.replace(/[%_\\]/g, "\\$&");
    const patron = `%${busquedaEscapada}%`;

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
  // BUG-H73-API-05: Ordenamiento jerárquico ICS para prioridad
  if (filtros.ordenarPor === "prioridad") {
    const sqlPrioridad = sql`CASE recuperacion.prioridad
      WHEN 'CRITICA' THEN 4
      WHEN 'ALTA' THEN 3
      WHEN 'MEDIA' THEN 2
      WHEN 'BAJA' THEN 1
      ELSE 0 END`;
    baseQuery = baseQuery.orderBy(sqlPrioridad, orden);
  } else if (filtros.ordenarPor === "codigo") {
    baseQuery = baseQuery.orderBy("recuperacion.codigo", orden);
  } else if (filtros.ordenarPor === "nombre") {
    baseQuery = baseQuery.orderBy("recuperacion.nombre", orden);
  } else if (filtros.ordenarPor === "estado") {
    baseQuery = baseQuery.orderBy("recuperacion.estado", orden);
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
      "recuperacion.fecha_cierre",
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
      creadoEn:
        fila.creado_en instanceof Date
          ? fila.creado_en.toISOString()
          : new Date(fila.creado_en).toISOString(),
      actualizadoEn:
        fila.actualizado_en instanceof Date
          ? fila.actualizado_en.toISOString()
          : new Date(fila.actualizado_en).toISOString(),
      fechaCierre: fila.fecha_cierre
        ? fila.fecha_cierre instanceof Date
          ? fila.fecha_cierre.toISOString()
          : new Date(fila.fecha_cierre).toISOString()
        : null,
    };
  });

  return { filas, total };
}

/**
 * Consulta el detalle exhaustivo de un operativo de recuperación para el drawer lateral (H73).
 * Incluye recursos detallados, misión, patrulla asignada y línea de tiempo unificada.
 * Es compatible tanto con el contrato HU-32 como con el de HU-73.
 */
export async function obtenerRecuperacionDetallePorIdRepo(
  id: string
): Promise<RecuperacionDetalleResponseData | null> {
  const recuperacion = await db
    .selectFrom("recuperacion")
    .leftJoin("delegacion", "delegacion.id", "recuperacion.delegacion_id")
    .innerJoin("usuario as creador", "creador.id", "recuperacion.creado_por_id")
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
      "creador.nombre as creador_nombre",
      "recuperacion.fecha_cierre",
      "recuperacion.observaciones_cierre",
      "recuperacion.creado_en",
      "recuperacion.actualizado_en",
    ])
    .where("recuperacion.id", "=", id)
    .where("recuperacion.eliminado_en", "is", null)
    .executeTakeFirst();

  if (!recuperacion) {
    return null;
  }

  // Recursos asignados con detalle
  const insumos = await db
    .selectFrom("recuperacion_recurso")
    .innerJoin("recurso", "recurso.id", "recuperacion_recurso.recurso_id")
    .select([
      "recuperacion_recurso.id as asignacion_id",
      "recuperacion_recurso.recurso_id",
      "recuperacion_recurso.cantidad_asignada",
      "recuperacion_recurso.mision_id",
      "recuperacion_recurso.creado_en as asignacion_creado_en",
      "recurso.nombre as recurso_nombre",
      "recurso.es_individual as recurso_es_individual",
    ])
    .where("recuperacion_recurso.recuperacion_id", "=", id)
    .execute();

  let cantidadTotalUnidades = 0;
  const recursos = insumos.map((i) => {
    const cant = Number(i.cantidad_asignada ?? 0);
    cantidadTotalUnidades += cant;
    return {
      recursoId: i.recurso_id,
      nombre: i.recurso_nombre,
      cantidadAsignada: cant,
    };
  });

  const recursosAsignados = insumos.map((i) => ({
    id: i.asignacion_id,
    recursoId: i.recurso_id,
    nombre: i.recurso_nombre,
    esIndividual: Boolean(i.recurso_es_individual),
    cantidadAsignada: Number(i.cantidad_asignada ?? 0),
    misionId: i.mision_id,
    creadoEn:
      i.asignacion_creado_en instanceof Date
        ? i.asignacion_creado_en.toISOString()
        : new Date(i.asignacion_creado_en).toISOString(),
  }));

  // Misiones vinculadas (ordenadas descendente por creado_en para determinismo)
  const misionesRaw = await db
    .selectFrom("mision")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .select([
      "mision.id as mision_id",
      "mision.codigo as mision_codigo",
      "mision.titulo as mision_titulo",
      "mision.estado as mision_estado",
      "mision.tipo_mision as mision_tipo",
      "mision.creado_en as mision_creado_en",
      "patrulla_verificadora.id as patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
    ])
    .where("mision.recuperacion_id", "=", id)
    .orderBy("mision.creado_en", "desc")
    .execute();

  const misiones = misionesRaw.map((m) => ({
    id: m.mision_id,
    codigo: m.mision_codigo,
    titulo: m.mision_titulo,
    estado: m.mision_estado,
    tipoMision: m.mision_tipo,
    patrulla: m.patrulla_id
      ? {
          id: m.patrulla_id,
          nombre: m.patrulla_nombre || "Patrulla Verificadora",
          estado: m.patrulla_estado || "EN_RECUPERACION",
        }
      : null,
    creadoEn:
      m.mision_creado_en instanceof Date
        ? m.mision_creado_en.toISOString()
        : new Date(m.mision_creado_en).toISOString(),
  }));

  const misionMasReciente = misionesRaw[0] ?? null;

  // Historial cronológico unificado (Drawer H73)
  const historial: HistorialRecuperacionItem[] = [];

  // 1. Creación
  historial.push({
    id: `rec-creacion-${recuperacion.id}`,
    tipo: "CREACION",
    titulo: "Operativo Planificado y Despachado",
    descripcion: recuperacion.descripcion ?? "Despliegue de recuperación registrado en el sistema.",
    registradoPor: {
      id: recuperacion.creado_por_id,
      nombre: recuperacion.creador_nombre || "Encargado de Operaciones",
    },
    creadoEn:
      recuperacion.creado_en instanceof Date
        ? recuperacion.creado_en.toISOString()
        : new Date(recuperacion.creado_en).toISOString(),
  });

  // 2. Hitos de todas las misiones asociadas
  if (misionesRaw.length > 0) {
    const misionIds = misionesRaw.map((m) => m.mision_id);
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
      .where("mision_hito.mision_id", "in", misionIds)
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
        creadoEn:
          h.creado_en instanceof Date
            ? h.creado_en.toISOString()
            : new Date(h.creado_en).toISOString(),
      });
    }

    // 3. Reportes de terreno
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
      .where("reporte_terreno.mision_id", "in", misionIds)
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
        creadoEn:
          r.creado_en instanceof Date
            ? r.creado_en.toISOString()
            : new Date(r.creado_en).toISOString(),
      });
    }
  }

  // 4. Cierre o cancelación si aplica
  if (recuperacion.estado === "COMPLETADA" || recuperacion.estado === "CANCELADA") {
    historial.push({
      id: `rec-cierre-${recuperacion.id}`,
      tipo: "CIERRE",
      titulo: `Operativo ${recuperacion.estado === "COMPLETADA" ? "Completado" : "Cancelado"}`,
      descripcion: recuperacion.observaciones_cierre ?? "Operativo finalizado.",
      registradoPor: null,
      creadoEn: recuperacion.fecha_cierre
        ? recuperacion.fecha_cierre instanceof Date
          ? recuperacion.fecha_cierre.toISOString()
          : new Date(recuperacion.fecha_cierre).toISOString()
        : recuperacion.actualizado_en instanceof Date
          ? recuperacion.actualizado_en.toISOString()
          : new Date(recuperacion.actualizado_en).toISOString(),
    });
  }

  // Ordenar cronológicamente
  historial.sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());

  return {
    id: recuperacion.id,
    codigo: recuperacion.codigo,
    nombre: recuperacion.nombre,
    descripcion: recuperacion.descripcion,
    sector: recuperacion.sector,
    direccionTexto: recuperacion.direccion_texto,
    prioridad: recuperacion.prioridad as RecuperacionDetalleResponseData["prioridad"],
    contactoNombre: recuperacion.contacto_nombre,
    contactoTelefono: recuperacion.contacto_telefono,
    latitud: Number(recuperacion.latitud),
    longitud: Number(recuperacion.longitud),
    estado: recuperacion.estado as RecuperacionDetalleResponseData["estado"],
    familiasAfectadas: Number(recuperacion.familias_afectadas ?? 0),
    delegacion: recuperacion.delegacion_id
      ? {
          id: recuperacion.delegacion_id,
          codigo: recuperacion.delegacion_codigo || "",
          nombre: recuperacion.delegacion_nombre || "",
        }
      : null,
    creador: {
      id: recuperacion.creado_por_id,
      nombre: recuperacion.creador_nombre || "Encargado de Operaciones",
    },
    creadoPor: {
      id: recuperacion.creado_por_id,
      nombre: recuperacion.creador_nombre || "Encargado de Operaciones",
    },
    creadoPorId: recuperacion.creado_por_id,
    mision: misionMasReciente
      ? {
          id: misionMasReciente.mision_id,
          codigo: misionMasReciente.mision_codigo,
          titulo: misionMasReciente.mision_titulo,
          estado: misionMasReciente.mision_estado,
          tipoMision: misionMasReciente.mision_tipo,
        }
      : null,
    misiones,
    patrulla: misionMasReciente?.patrulla_id
      ? {
          id: misionMasReciente.patrulla_id,
          nombre: misionMasReciente.patrulla_nombre || "Patrulla Verificadora",
          estado: misionMasReciente.patrulla_estado || "EN_RECUPERACION",
        }
      : null,
    recursos,
    recursosAsignados,
    cantidadInsumosAsignados: cantidadTotalUnidades,
    totalTiposInsumos: recursos.length,
    historial,
    creadoEn:
      recuperacion.creado_en instanceof Date
        ? recuperacion.creado_en.toISOString()
        : new Date(recuperacion.creado_en).toISOString(),
    actualizadoEn:
      recuperacion.actualizado_en instanceof Date
        ? recuperacion.actualizado_en.toISOString()
        : new Date(recuperacion.actualizado_en).toISOString(),
    fechaCierre: recuperacion.fecha_cierre
      ? recuperacion.fecha_cierre instanceof Date
        ? recuperacion.fecha_cierre.toISOString()
        : new Date(recuperacion.fecha_cierre).toISOString()
      : null,
    observacionesCierre: recuperacion.observaciones_cierre ?? null,
  };
}
