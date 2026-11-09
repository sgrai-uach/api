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
  patrulla_activo?: boolean | null;
  patrulla_eliminado_en?: Date | string | null;
  patrulla_eliminado_por_id?: string | null;
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
    .leftJoin("recurso as r", "r.id", "pv.vehiculo_id");

  if (filtros.activo !== undefined) {
    baseQuery = baseQuery.where("pv.activo", "=", filtros.activo);
  } else if (!filtros.incluirInactivas) {
    baseQuery = baseQuery.where("pv.eliminado_en", "is", null).where("pv.activo", "=", true);
  }

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
      "pv.activo as patrulla_activo",
      "pv.eliminado_en as patrulla_eliminado_en",
      "pv.eliminado_por_id as patrulla_eliminado_por_id",
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
          "pu.estado_operativo",
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
      "pv.activo as patrulla_activo",
      "pv.eliminado_en as patrulla_eliminado_en",
      "pv.eliminado_por_id as patrulla_eliminado_por_id",
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
        "pu.estado_operativo",
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
      "u.estado_operativo",
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
  personalFilas?: { personal_id: string; usuario_id: string }[];
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

    // Obtener personal para mapear líderes y usuarios
    const personalFilas =
      datos.personalFilas ??
      (await trx
        .selectFrom("personal")
        .where("id", "in", datos.personalIds)
        .select(["id as personal_id", "usuario_id"])
        .execute());

    // 2. Insertar dotación de personal en patrulla_personal
    for (const personalId of datos.personalIds) {
      const personal = personalFilas.find((p) => p.personal_id === personalId);
      const esLider = Boolean(
        datos.usuarioLiderId && personal && personal.usuario_id === datos.usuarioLiderId
      );

      await trx
        .insertInto("patrulla_personal")
        .values({
          patrulla_id: patrullaId,
          personal_id: personalId,
          rol_en_patrulla: esLider ? "LIDER" : "OPERATIVO",
          asignado_en: sql`CURRENT_TIMESTAMP`,
        })
        .execute();
    }

    // Actualizar estado_operativo en la tabla usuario a 'en_patrulla'
    const usuarioIds = personalFilas.map((p) => p.usuario_id);
    if (usuarioIds.length > 0) {
      await trx
        .updateTable("usuario")
        .set({
          estado_operativo: "en_patrulla",
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "in", usuarioIds)
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

export interface DatosModificarPatrullaRepo {
  id: string;
  nombre?: string;
  delegacionId: string;
  vehiculoId: string | null;
  usuarioLiderId: string | null;
  personalLiderId?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  personalIds: string[];
}

/**
 * Modifica de forma transaccional una patrulla verificadora:
 * - Actualiza delegación, vehículo, líder y auditoría (actualizado_en).
 * - Libera el vehículo previo si cambió o se desasignó, y reserva el nuevo si aplica.
 * - Sincroniza la dotación en patrulla_personal y actualiza el estado operativo en personal.
 */
export async function modificarPatrullaTransaccionalRepo(
  datos: DatosModificarPatrullaRepo
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    // 1. Obtener la patrulla actual para conocer vehiculo_id previo
    const patrullaActual = await trx
      .selectFrom("patrulla_verificadora")
      .where("id", "=", datos.id)
      .where("eliminado_en", "is", null)
      .select(["id", "vehiculo_id"])
      .executeTakeFirst();

    if (!patrullaActual) {
      throw new Error("Patrulla verificadora no encontrada.");
    }

    const vehiculoAnteriorId = patrullaActual.vehiculo_id;
    const vehiculoNuevoId = datos.vehiculoId;

    // 2. Gestionar cambio de vehículo si aplica
    if (vehiculoAnteriorId !== vehiculoNuevoId) {
      // Liberar vehículo anterior
      if (vehiculoAnteriorId) {
        await trx
          .updateTable("recurso")
          .set({
            estado: "DISPONIBLE",
            cantidad_en_uso: 0,
            actualizado_en: sql`CURRENT_TIMESTAMP`,
          })
          .where("id", "=", vehiculoAnteriorId)
          .execute();
      }

      // Asignar nuevo vehículo
      if (vehiculoNuevoId) {
        await trx
          .updateTable("recurso")
          .set({
            estado: "ASIGNADO",
            cantidad_en_uso: 1,
            actualizado_en: sql`CURRENT_TIMESTAMP`,
          })
          .where("id", "=", vehiculoNuevoId)
          .execute();
      }
    }

    // 3. Actualizar la tabla patrulla_verificadora
    let updateBuilder = trx
      .updateTable("patrulla_verificadora")
      .set({
        delegacion_id: datos.delegacionId,
        vehiculo_id: datos.vehiculoId,
        usuario_lider_id: datos.usuarioLiderId,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", datos.id);

    if (datos.nombre && datos.nombre.trim() !== "") {
      updateBuilder = updateBuilder.set({ nombre: datos.nombre.trim() });
    }

    if (datos.latitud !== undefined && datos.longitud !== undefined) {
      if (datos.latitud !== null && datos.longitud !== null) {
        updateBuilder = updateBuilder.set({
          latitud: datos.latitud,
          longitud: datos.longitud,
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
          ultima_actualizacion_ubicacion: sql`CURRENT_TIMESTAMP`,
        });
      } else {
        updateBuilder = updateBuilder.set({
          latitud: null,
          longitud: null,
          ubicacion: null,
          ultima_actualizacion_ubicacion: null,
        });
      }
    }

    await updateBuilder.execute();

    // 4. Sincronizar dotación de personal
    const integrantesPrevios = await trx
      .selectFrom("patrulla_personal")
      .where("patrulla_id", "=", datos.id)
      .select("personal_id")
      .execute();

    const idsPrevios = integrantesPrevios.map((i) => i.personal_id);
    const idsNuevos = datos.personalIds;

    // Personal saliente
    const salientes = idsPrevios.filter((id) => !idsNuevos.includes(id));
    if (salientes.length > 0) {
      await trx
        .updateTable("usuario")
        .set({ estado_operativo: "disponible" })
        .where(
          "id",
          "in",
          trx
            .selectFrom("personal")
            .select("usuario_id")
            .where("id", "in", salientes)
        )
        .execute();
    }

    // Limpiar tabla intermedia patrulla_personal para esta patrulla
    await trx
      .deleteFrom("patrulla_personal")
      .where("patrulla_id", "=", datos.id)
      .execute();

    // Reinsertar nuevos integrantes
    for (let i = 0; i < idsNuevos.length; i++) {
      const personalId = idsNuevos[i];
      const esLider = datos.personalLiderId
        ? personalId === datos.personalLiderId
        : i === 0;

      await trx
        .insertInto("patrulla_personal")
        .values({
          patrulla_id: datos.id,
          personal_id: personalId,
          rol_en_patrulla: esLider ? "LIDER" : "OPERATIVO",
          asignado_en: sql`CURRENT_TIMESTAMP`,
        })
        .execute();
    }

    // Marcar nuevos integrantes como en_patrulla
    if (idsNuevos.length > 0) {
      await trx
        .updateTable("usuario")
        .set({ estado_operativo: "en_patrulla" })
        .where(
          "id",
          "in",
          trx
            .selectFrom("personal")
            .select("usuario_id")
            .where("id", "in", idsNuevos)
        )
        .execute();
    }
  });
}

/**
 * Verifica si una patrulla verificadora cuenta con misiones activas en terreno o planificadas.
 */
export async function verificarMisionesActivasPatrullaRepo(id: string) {
  return await db
    .selectFrom("mision")
    .where("patrulla_id", "=", id)
    .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
    .select(["id", "codigo", "titulo", "estado"])
    .execute();
}

export interface ResultadoDesactivacionPatrullaRepo {
  id: string;
  codigo: string | null;
  nombre: string;
  estado: EstadoPatrullaType;
  activo: boolean;
  eliminadoEn: string;
  eliminadoPorId: string | null;
  vehiculoLiberadoId: string | null;
  personalLiberadoIds: string[];
}

/**
 * Desactiva mediante baja lógica una patrulla verificadora de forma atómica (HU-85):
 * - Marca patrulla_verificadora como activo = false, eliminado_en = CURRENT_TIMESTAMP, estado = 'NO_DISPONIBLE', eliminado_por_id = usuarioId.
 * - Si posee vehículo asignado, lo libera en recurso (estado = 'DISPONIBLE', cantidad_en_uso = 0).
 * - Libera la dotación de funcionarios en personal (estado_operativo = 'disponible').
 * - Preserva la auditoría histórica de registros en patrulla_personal y misiones pasadas.
 */
export async function desactivarPatrullaTransaccionalRepo(
  id: string,
  usuarioId?: string | null
): Promise<ResultadoDesactivacionPatrullaRepo> {
  return await db.transaction().execute(async (trx) => {
    // 1. Obtener la patrulla actual con bloqueo pesimista FOR UPDATE (BUG-H85-API-01)
    const patrullaActual = await trx
      .selectFrom("patrulla_verificadora")
      .where("id", "=", id)
      .where("eliminado_en", "is", null)
      .select(["id", "codigo", "nombre", "estado", "vehiculo_id", "usuario_lider_id"])
      .forUpdate()
      .executeTakeFirst();

    if (!patrullaActual) {
      throw new Error("Patrulla verificadora no encontrada para dar de baja.");
    }

    // Validación atómica de estados en terreno (BUG-H85-API-01)
    const estadosEnTerreno = [
      "EN_VERIFICACION",
      "EN_PREVENCION",
      "EN_RECUPERACION",
      "EN_MISION",
    ];
    if (estadosEnTerreno.includes(patrullaActual.estado)) {
      throw new Error(
        `CONFLICT:No es posible desactivar la patrulla verificadora '${patrullaActual.nombre}' porque se encuentra actualmente en terreno en estado '${patrullaActual.estado}'.`
      );
    }

    // Validación atómica de misiones tácticas activas (BUG-H85-API-01)
    const misionesActivas = await trx
      .selectFrom("mision")
      .where("patrulla_id", "=", id)
      .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
      .select(["id", "codigo", "titulo"])
      .execute();

    if (misionesActivas.length > 0) {
      const codigos = misionesActivas.map((m) => m.codigo || m.titulo).join(", ");
      throw new Error(
        `CONFLICT:No es posible desactivar la patrulla verificadora '${patrullaActual.nombre}' porque cuenta con misiones tácticas activas en curso (${codigos}).`
      );
    }

    const vehiculoLiberadoId = patrullaActual.vehiculo_id;

    // 2. Liberar vehículo asignado si existe (BUG-H85-API-03: liberar recurso sin borrar vehiculo_id de patrulla)
    if (vehiculoLiberadoId) {
      await trx
        .updateTable("recurso")
        .set({
          estado: "DISPONIBLE",
          cantidad_en_uso: 0,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", vehiculoLiberadoId)
        .execute();
    }

    // 3. Obtener los integrantes de la dotación y consolidar con usuario_lider_id (BUG-H85-API-02)
    const integrantes = await trx
      .selectFrom("patrulla_personal as pp")
      .innerJoin("personal as p", "p.id", "pp.personal_id")
      .where("pp.patrulla_id", "=", id)
      .select(["pp.personal_id", "p.usuario_id"])
      .execute();

    const personalLiberadoIds = integrantes.map((i) => i.personal_id);
    const usuarioIdsCandidatos = new Set<string>();
    for (const i of integrantes) {
      if (i.usuario_id) usuarioIdsCandidatos.add(i.usuario_id);
    }
    if (patrullaActual.usuario_lider_id) {
      usuarioIdsCandidatos.add(patrullaActual.usuario_lider_id);
    }

    const listaUsuarioIds = Array.from(usuarioIdsCandidatos);

    // Liberar estado_operativo a 'disponible' únicamente para funcionarios activos, en estado 'en_patrulla'
    // y que no pertenezcan a ninguna otra patrulla o cuadrilla activa
    if (listaUsuarioIds.length > 0) {
      await sql`
        UPDATE usuario
        SET estado_operativo = 'disponible',
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id IN (${sql.join(listaUsuarioIds.map((uid) => sql`${uid}::uuid`))})
          AND activo = true
          AND estado_operativo = 'en_patrulla'
          AND NOT EXISTS (
            SELECT 1
            FROM patrulla_personal pp2
            JOIN patrulla_verificadora pv2 ON pv2.id = pp2.patrulla_id
            JOIN personal p2 ON p2.id = pp2.personal_id
            WHERE pv2.eliminado_en IS NULL
              AND pv2.id != ${id}::uuid
              AND p2.usuario_id = usuario.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM patrulla_verificadora pv3
            WHERE pv3.eliminado_en IS NULL
              AND pv3.id != ${id}::uuid
              AND pv3.usuario_lider_id = usuario.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM cuadrilla_personal cp
            JOIN cuadrilla c ON c.id = cp.cuadrilla_id
            JOIN personal p3 ON p3.id = cp.personal_id
            WHERE c.eliminado_en IS NULL
              AND c.activo = true
              AND p3.usuario_id = usuario.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM cuadrilla c2
            WHERE c2.eliminado_en IS NULL
              AND c2.activo = true
              AND c2.usuario_delegado_id = usuario.id
          );
      `.execute(trx);
    }

    // 4. Actualizar patrulla_verificadora aplicando baja lógica (conservando vehiculo_id - BUG-H85-API-03)
    const patrullaActualizada = await trx
      .updateTable("patrulla_verificadora")
      .set({
        activo: false,
        estado: "NO_DISPONIBLE",
        eliminado_en: sql`CURRENT_TIMESTAMP`,
        eliminado_por_id: usuarioId ?? null,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", id)
      .returning([
        "id",
        "codigo",
        "nombre",
        "estado",
        "activo",
        "eliminado_en",
        "eliminado_por_id",
      ])
      .executeTakeFirstOrThrow();

    const eliminadoEnStr =
      patrullaActualizada.eliminado_en instanceof Date
        ? patrullaActualizada.eliminado_en.toISOString()
        : typeof patrullaActualizada.eliminado_en === "string"
        ? patrullaActualizada.eliminado_en
        : new Date().toISOString();

    return {
      id: patrullaActualizada.id,
      codigo: patrullaActualizada.codigo,
      nombre: patrullaActualizada.nombre,
      estado: patrullaActualizada.estado,
      activo: patrullaActualizada.activo,
      eliminadoEn: eliminadoEnStr,
      eliminadoPorId: patrullaActualizada.eliminado_por_id,
      vehiculoLiberadoId,
      personalLiberadoIds,
    };
  });
}

