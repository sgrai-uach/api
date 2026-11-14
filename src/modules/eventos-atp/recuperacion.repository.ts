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

export async function buscarDelegacionPorId(trx: KyselyTrx, delegacionId: string) {
  return trx
    .selectFrom("delegacion")
    .select(["id", "codigo", "codigo_delegacion", "nombre", "nombre_delegacion"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
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
 */
export async function obtenerRecuperacionDetallePorIdRepo(
  id: string
): Promise<RecuperacionDetalleResponse | null> {
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
      "recuperacion_recurso.recurso_id",
      "recurso.nombre as recurso_nombre",
      "recuperacion_recurso.cantidad_asignada",
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
    .executeTakeFirst();

  // Historial cronológico unificado
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
        creadoEn:
          h.creado_en instanceof Date
            ? h.creado_en.toISOString()
            : new Date(h.creado_en).toISOString(),
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
      tipo: "ESTADO_OPERATIVO",
      titulo: `Operativo ${recuperacion.estado === "COMPLETADA" ? "Completado" : "Cancelado"}`,
      descripcion: recuperacion.observaciones_cierre ?? null,
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
    prioridad: recuperacion.prioridad as RecuperacionDetalleResponse["prioridad"],
    contactoNombre: recuperacion.contacto_nombre,
    contactoTelefono: recuperacion.contacto_telefono,
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
      id: recuperacion.creado_por_id,
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
