import { db } from "@/lib/db";
import { sql } from "kysely";
import type {
  ListarPatrullasQuery,
  EstadoPatrullaType,
} from "./patrulla.schema";

export interface FilaPatrullaConsulta {
  patrulla_id: string;
  patrulla_codigo: string | null;
  patrulla_nombre: string;
  patrulla_estado: EstadoPatrullaType;
  patrulla_latitud: number | string | null;
  patrulla_longitud: number | string | null;
  patrulla_ultima_actualizacion_ubicacion: Date | string | null;
  patrulla_creado_en: Date | string;
  patrulla_actualizado_en: Date | string;
  delegacion_id: string | null;
  delegacion_nombre: string | null;
  delegacion_codigo: string | null;
  vehiculo_id: string | null;
  vehiculo_nombre: string | null;
  vehiculo_detalles: Record<string, unknown> | null;
  vehiculo_estado: string | null;
  lider_id: string | null;
  lider_nombre: string | null;
  lider_email: string | null;
  lider_telefono: string | null;
  lider_rut: string | null;
  mision_id: string | null;
  mision_codigo: string | null;
  mision_titulo: string | null;
  mision_tipo: string | null;
  mision_estado: string | null;
  mision_prioridad: string | null;
  incidente_id: string | null;
  incidente_codigo: string | null;
  incidente_folio: string | null;
  incidente_tipo_afectacion: string | null;
  incidente_direccion: string | null;
}

export interface FilaIntegranteConsulta {
  patrulla_id: string;
  personal_id: string;
  usuario_id: string;
  nombre: string;
  email: string;
  telefono: string | null | undefined;
  rut: string | null;
  cargo: string | null;
  especialidad: string | null;
  rol_en_patrulla: string;
  estado_operativo: string;
}

/**
 * Consulta paginada de patrullas verificadoras con delegación, vehículo, líder, integrantes y misión activa.
 */
export async function listarPatrullasRepo(filtros: ListarPatrullasQuery) {
  const page = filtros.page || 1;
  const limit = filtros.limit || 20;
  const offset = (page - 1) * limit;

  let baseQuery = db
    .selectFrom("patrulla_verificadora as pv")
    .leftJoin("delegacion as del", "del.id", "pv.delegacion_id")
    .leftJoin("usuario as u", "u.id", "pv.usuario_lider_id")
    .leftJoin("recurso as r", "r.id", "pv.vehiculo_id")
    .where("pv.eliminado_en", "is", null);

  if (filtros.delegacionId) {
    baseQuery = baseQuery.where("pv.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.estado) {
    baseQuery = baseQuery.where("pv.estado", "=", filtros.estado);
  }

  if (filtros.busqueda) {
    const term = `%${filtros.busqueda}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb("pv.nombre", "ilike", term),
        eb("pv.codigo", "ilike", term),
        eb("u.nombre", "ilike", term),
      ])
    );
  }

  // 1. Obtener conteo total para metadatos de paginación
  const conteoResult = await baseQuery
    .select(sql<number>`count(pv.id)::int`.as("total"))
    .executeTakeFirst();
  const total = conteoResult?.total ?? 0;

  // 2. Obtener filas principales con Left Join a misión activa e incidente
  const filas = await baseQuery
    .leftJoin("mision as m", (join) =>
      join
        .onRef("m.patrulla_id", "=", "pv.id")
        .on("m.estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
    )
    .leftJoin("incidente as inc", "inc.id", "m.incidente_id")
    .select([
      "pv.id as patrulla_id",
      "pv.codigo as patrulla_codigo",
      "pv.nombre as patrulla_nombre",
      "pv.estado as patrulla_estado",
      "pv.latitud as patrulla_latitud",
      "pv.longitud as patrulla_longitud",
      "pv.ultima_actualizacion_ubicacion as patrulla_ultima_actualizacion_ubicacion",
      "pv.creado_en as patrulla_creado_en",
      "pv.actualizado_en as patrulla_actualizado_en",
      "del.id as delegacion_id",
      "del.nombre as delegacion_nombre",
      "del.codigo as delegacion_codigo",
      "r.id as vehiculo_id",
      "r.nombre as vehiculo_nombre",
      "r.detalles as vehiculo_detalles",
      "r.estado as vehiculo_estado",
      "u.id as lider_id",
      "u.nombre as lider_nombre",
      "u.email as lider_email",
      "u.telefono as lider_telefono",
      "u.rut as lider_rut",
      "m.id as mision_id",
      "m.codigo as mision_codigo",
      "m.titulo as mision_titulo",
      "m.tipo_mision as mision_tipo",
      "m.estado as mision_estado",
      "m.prioridad as mision_prioridad",
      "inc.id as incidente_id",
      "inc.codigo as incidente_codigo",
      "inc.folio as incidente_folio",
      "inc.tipo_afectacion as incidente_tipo_afectacion",
      "inc.direccion_texto as incidente_direccion",
    ])
    .orderBy("pv.nombre", "asc")
    .limit(limit)
    .offset(offset)
    .execute();

  // 3. Obtener integrantes de terreno para las patrullas seleccionadas
  const patrullaIds = filas.map((f) => f.patrulla_id);
  const integrantesMap = new Map<string, FilaIntegranteConsulta[]>();

  if (patrullaIds.length > 0) {
    try {
      const integrantes = await db
        .selectFrom("patrulla_personal as pp")
        .innerJoin("personal as p", "p.id", "pp.personal_id")
        .innerJoin("usuario as pu", "pu.id", "p.usuario_id")
        .where("pp.patrulla_id", "in", patrullaIds)
        .select([
          "pp.patrulla_id",
          "p.id as personal_id",
          "pu.id as usuario_id",
          "pu.nombre",
          "pu.email",
          "pu.telefono",
          "pu.rut",
          "p.cargo",
          "p.especialidad",
          "pp.rol_en_patrulla",
          "p.estado_operativo",
        ])
        .execute();

      for (const integrante of integrantes) {
        const lista = integrantesMap.get(integrante.patrulla_id) || [];
        lista.push(integrante);
        integrantesMap.set(integrante.patrulla_id, lista);
      }
    } catch {
      // Si la tabla aún no existe o no hay registros, continúa con lista vacía
    }
  }

  return {
    total,
    filas: filas as unknown as FilaPatrullaConsulta[],
    integrantesMap,
  };
}

/**
 * Consulta el detalle unitario de una patrulla verificadora por su UUID.
 */
export async function obtenerPatrullaPorIdRepo(id: string) {
  const fila = await db
    .selectFrom("patrulla_verificadora as pv")
    .leftJoin("delegacion as del", "del.id", "pv.delegacion_id")
    .leftJoin("usuario as u", "u.id", "pv.usuario_lider_id")
    .leftJoin("recurso as r", "r.id", "pv.vehiculo_id")
    .leftJoin("mision as m", (join) =>
      join
        .onRef("m.patrulla_id", "=", "pv.id")
        .on("m.estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
    )
    .leftJoin("incidente as inc", "inc.id", "m.incidente_id")
    .where("pv.id", "=", id)
    .where("pv.eliminado_en", "is", null)
    .select([
      "pv.id as patrulla_id",
      "pv.codigo as patrulla_codigo",
      "pv.nombre as patrulla_nombre",
      "pv.estado as patrulla_estado",
      "pv.latitud as patrulla_latitud",
      "pv.longitud as patrulla_longitud",
      "pv.ultima_actualizacion_ubicacion as patrulla_ultima_actualizacion_ubicacion",
      "pv.creado_en as patrulla_creado_en",
      "pv.actualizado_en as patrulla_actualizado_en",
      "del.id as delegacion_id",
      "del.nombre as delegacion_nombre",
      "del.codigo as delegacion_codigo",
      "r.id as vehiculo_id",
      "r.nombre as vehiculo_nombre",
      "r.detalles as vehiculo_detalles",
      "r.estado as vehiculo_estado",
      "u.id as lider_id",
      "u.nombre as lider_nombre",
      "u.email as lider_email",
      "u.telefono as lider_telefono",
      "u.rut as lider_rut",
      "m.id as mision_id",
      "m.codigo as mision_codigo",
      "m.titulo as mision_titulo",
      "m.tipo_mision as mision_tipo",
      "m.estado as mision_estado",
      "m.prioridad as mision_prioridad",
      "inc.id as incidente_id",
      "inc.codigo as incidente_codigo",
      "inc.folio as incidente_folio",
      "inc.tipo_afectacion as incidente_tipo_afectacion",
      "inc.direccion_texto as incidente_direccion",
    ])
    .executeTakeFirst();

  if (!fila) {
    return null;
  }

  let integrantes: FilaIntegranteConsulta[] = [];
  try {
    integrantes = (await db
      .selectFrom("patrulla_personal as pp")
      .innerJoin("personal as p", "p.id", "pp.personal_id")
      .innerJoin("usuario as pu", "pu.id", "p.usuario_id")
      .where("pp.patrulla_id", "=", id)
      .select([
        "pp.patrulla_id",
        "p.id as personal_id",
        "pu.id as usuario_id",
        "pu.nombre",
        "pu.email",
        "pu.telefono",
        "pu.rut",
        "p.cargo",
        "p.especialidad",
        "pp.rol_en_patrulla",
        "p.estado_operativo",
      ])
      .execute()) as FilaIntegranteConsulta[];
  } catch {
    integrantes = [];
  }

  return {
    fila: fila as unknown as FilaPatrullaConsulta,
    integrantes,
  };
}

/**
 * Busca si existe una patrulla verificadora activa por su código identificador único.
 */
export async function buscarPatrullaPorCodigoRepo(codigo: string) {
  return await db
    .selectFrom("patrulla_verificadora")
    .where(sql`LOWER(codigo)`, "=", codigo.trim().toLowerCase())
    .where("eliminado_en", "is", null)
    .select(["id", "codigo", "nombre", "estado"])
    .executeTakeFirst();
}

/**
 * Consulta un recurso para verificar si es un vehículo institucional individual y su estado.
 */
export async function obtenerVehiculoPorIdRepo(id: string) {
  return await db
    .selectFrom("recurso")
    .where("id", "=", id)
    .where("eliminado_en", "is", null)
    .select([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
      "latitud",
      "longitud",
      "detalles",
    ])
    .executeTakeFirst();
}

/**
 * Obtiene funcionarios de terreno y sus usuarios correspondientes para validar la dotación.
 */
export async function obtenerPersonalParaPatrullaRepo(personalIds: string[]) {
  if (personalIds.length === 0) return [];

  return await db
    .selectFrom("personal as p")
    .innerJoin("usuario as u", "u.id", "p.usuario_id")
    .innerJoin("rol as r", "r.id", "u.rol_id")
    .where("p.id", "in", personalIds)
    .where("u.activo", "=", true)
    .select([
      "p.id as personal_id",
      "p.usuario_id",
      "u.nombre",
      "u.email",
      "u.activo",
      "r.codigo as rol_codigo",
      "p.estado_operativo",
    ])
    .execute();
}

/**
 * Verifica la existencia de una delegación activa.
 */
export async function obtenerDelegacionPorIdRepo(id: string) {
  return await db
    .selectFrom("delegacion")
    .where("id", "=", id)
    .select(["id", "nombre", "codigo"])
    .executeTakeFirst();
}

export interface DatosCrearPatrullaRepo {
  codigo: string;
  nombre: string;
  delegacionId: string;
  vehiculoId: string | null;
  usuarioLiderId: string | null;
  latitud: number | null;
  longitud: number | null;
  personalIds: string[];
}

/**
 * Registra de forma transaccional una nueva patrulla verificadora, su dotación y asigna su vehículo.
 */
export async function crearPatrullaTransaccionalRepo(datos: DatosCrearPatrullaRepo): Promise<string> {
  return await db.transaction().execute(async (trx) => {
    // 1. Insertar en patrulla_verificadora con estado inicial canónico DISPONIBLE
    const patrullaInsertada = await trx
      .insertInto("patrulla_verificadora")
      .values({
        codigo: datos.codigo.trim().toUpperCase(),
        nombre: datos.nombre.trim(),
        estado: "DISPONIBLE",
        delegacion_id: datos.delegacionId,
        vehiculo_id: datos.vehiculoId,
        usuario_lider_id: datos.usuarioLiderId,
        latitud: datos.latitud,
        longitud: datos.longitud,
        ubicacion:
          datos.latitud !== null && datos.longitud !== null
            ? sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`
            : null,
        ultima_actualizacion_ubicacion:
          datos.latitud !== null && datos.longitud !== null ? sql`CURRENT_TIMESTAMP` : null,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const patrullaId = patrullaInsertada.id;

    // 2. Insertar dotación de personal en patrulla_personal y actualizar estado operativo
    for (let i = 0; i < datos.personalIds.length; i++) {
      const personalId = datos.personalIds[i];
      const esLider = i === 0;

      await trx
        .insertInto("patrulla_personal")
        .values({
          patrulla_id: patrullaId,
          personal_id: personalId,
          rol_en_patrulla: esLider ? "LIDER" : "OPERATIVO",
          asignado_en: sql`CURRENT_TIMESTAMP`,
        })
        .execute();

      await trx
        .updateTable("personal")
        .set({
          estado_operativo: "en_patrulla",
        })
        .where("id", "=", personalId)
        .execute();
    }

    // 3. Si se asignó un vehículo institucional individual, marcarlo como ASIGNADO
    if (datos.vehiculoId) {
      await trx
        .updateTable("recurso")
        .set({
          estado: "ASIGNADO",
          cantidad_en_uso: 1,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", datos.vehiculoId)
        .execute();
    }

    return patrullaId;
  });
}

/**
 * Actualiza el estado operativo y/o coordenadas de una patrulla verificadora.
 */
export async function actualizarEstadoPatrullaRepo(
  id: string,
  nuevoEstado: EstadoPatrullaType,
  latitud?: number,
  longitud?: number
) {
  let updateQuery = db
    .updateTable("patrulla_verificadora")
    .set({
      estado: nuevoEstado,
      actualizado_en: sql`CURRENT_TIMESTAMP`,
    })
    .where("id", "=", id)
    .where("eliminado_en", "is", null);

  if (latitud !== undefined && longitud !== undefined) {
    updateQuery = updateQuery.set({
      latitud,
      longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)`,
      ultima_actualizacion_ubicacion: sql`CURRENT_TIMESTAMP`,
    });
  }

  const result = await updateQuery.executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}
