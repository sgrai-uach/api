import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "@/lib/db";
import type { Database } from "@/lib/db/types";
import type {
  PrioridadEventoAsistenciaSocial,
  EstadoEventoAsistenciaSocial,
  DetallesEvaluacionSocial,
} from "./asistencia-social.schema";

export class AsistenteSocialRepoError extends Error {
  constructor(
    public readonly motivo: "ASISTENTE_NO_ENCONTRADO" | "ASISTENTE_NO_ELEGIBLE",
    message: string
  ) {
    super(message);
    this.name = "AsistenteSocialRepoError";
  }
}

export interface DatosInsertarEventoAsistenciaSocialRepo {
  codigo: string;
  descripcion: string;
  tipoAfectacion: string;
  personasAfectadas: number;
  familiasAfectadas: number;
  direccionTexto: string;
  latitud: number;
  longitud: number;
  prioridad: PrioridadEventoAsistenciaSocial;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  contactoRut?: string | null;
  delegacionId?: string | null;
  incidenteId?: string | null;
  asistenteSocialId?: string | null;
  detallesEvaluacion?: DetallesEvaluacionSocial | null;
  creadoPorId: string;
}

export interface FilaEventoAsistenciaSocialConRelaciones {
  id: string;
  codigo: string;
  descripcion: string;
  tipo_afectacion: string;
  personas_afectadas: number;
  familias_afectadas: number;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  prioridad: string;
  estado: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_rut: string | null;
  delegacion_id: string | null;
  delegacion_nombre: string | null;
  incidente_id: string | null;
  asistente_social_id: string | null;
  asistente_social_nombre: string | null;
  detalles_evaluacion?: Record<string, unknown> | string | null;
  creado_por_id: string;
  creado_por_nombre: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface FiltrosListarEventosAsistenciaSocial {
  estado?: EstadoEventoAsistenciaSocial;
  delegacionId?: string;
  prioridad?: PrioridadEventoAsistenciaSocial;
  busqueda?: string;
}

export interface OpcionesPaginacion {
  pagina: number;
  limite: number;
}

type DbExecutor = Kysely<Database> | Transaction<Database>;

function consultarEventoConRelacionesBase(executor: DbExecutor) {
  return executor
    .selectFrom("evento_asistencia_social")
    .leftJoin("delegacion", "delegacion.id", "evento_asistencia_social.delegacion_id")
    .innerJoin("usuario as creador", "creador.id", "evento_asistencia_social.creado_por_id")
    .leftJoin("usuario as asistente", "asistente.id", "evento_asistencia_social.asistente_social_id")
    .select([
      "evento_asistencia_social.id",
      "evento_asistencia_social.codigo",
      "evento_asistencia_social.descripcion",
      "evento_asistencia_social.tipo_afectacion",
      "evento_asistencia_social.personas_afectadas",
      "evento_asistencia_social.familias_afectadas",
      "evento_asistencia_social.direccion_texto",
      "evento_asistencia_social.latitud",
      "evento_asistencia_social.longitud",
      "evento_asistencia_social.prioridad",
      "evento_asistencia_social.estado",
      "evento_asistencia_social.contacto_nombre",
      "evento_asistencia_social.contacto_telefono",
      "evento_asistencia_social.contacto_rut",
      "evento_asistencia_social.delegacion_id",
      sql<string | null>`COALESCE(delegacion.nombre, delegacion.nombre_delegacion)`.as("delegacion_nombre"),
      "evento_asistencia_social.incidente_id",
      "evento_asistencia_social.asistente_social_id",
      "asistente.nombre as asistente_social_nombre",
      "evento_asistencia_social.detalles_evaluacion",
      "evento_asistencia_social.creado_por_id",
      "creador.nombre as creado_por_nombre",
      "evento_asistencia_social.creado_en",
      "evento_asistencia_social.actualizado_en",
    ]);
}

async function validarAsistenteSocialElegibleEnTrx(
  trx: Transaction<Database>,
  asistenteSocialId: string
): Promise<
  | { ok: true }
  | { ok: false; motivo: "ASISTENTE_NO_ENCONTRADO" | "ASISTENTE_NO_ELEGIBLE"; detalle: string }
> {
  const asistente = await trx
    .selectFrom("usuario")
    .innerJoin("rol", "rol.id", "usuario.rol_id")
    .select([
      "usuario.id",
      "usuario.activo",
      "usuario.estado_operativo",
      "rol.codigo as rol_codigo",
    ])
    .where("usuario.id", "=", asistenteSocialId)
    .executeTakeFirst();

  if (!asistente) {
    return {
      ok: false,
      motivo: "ASISTENTE_NO_ENCONTRADO",
      detalle: "El asistente social especificado no existe.",
    };
  }

  if (!asistente.activo || asistente.rol_codigo !== "ASISTENTE_SOCIAL") {
    return {
      ok: false,
      motivo: "ASISTENTE_NO_ELEGIBLE",
      detalle: "El usuario seleccionado no está activo o no posee el rol ASISTENTE_SOCIAL.",
    };
  }

  if (asistente.estado_operativo !== "disponible") {
    return {
      ok: false,
      motivo: "ASISTENTE_NO_ELEGIBLE",
      detalle: `El asistente social seleccionado se encuentra en estado '${asistente.estado_operativo}' y debe estar 'disponible'.`,
    };
  }

  return { ok: true };
}

/**
 * Genera el siguiente código correlativo anual institucional con formato AS-YYYY-0001 (H28).
 */
export async function generarSiguienteCodigoAsistenciaSocial(): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `AS-${anio}-`;

  const conteo = await db
    .selectFrom("evento_asistencia_social")
    .where("codigo", "like", `${prefijo}%`)
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  const secuencia = (conteo?.total ?? 0) + 1;
  return `${prefijo}${String(secuencia).padStart(4, "0")}`;
}

/**
 * Inserta un nuevo evento de asistencia social en PostgreSQL con geometría PostGIS
 * y asignación opcional inmediata de asistente social (H28 / H31 Opción A).
 */
export async function insertarEventoAsistenciaSocial(
  datos: DatosInsertarEventoAsistenciaSocialRepo
): Promise<FilaEventoAsistenciaSocialConRelaciones> {
  const detallesEvaluacionJson = datos.detallesEvaluacion
    ? JSON.stringify(datos.detallesEvaluacion)
    : null;
  const asistenteIdLimpio = datos.asistenteSocialId?.trim() || null;

  if (asistenteIdLimpio) {
    return db.transaction().execute(async (trx) => {
      const validacionAsistente = await validarAsistenteSocialElegibleEnTrx(
        trx,
        asistenteIdLimpio
      );
      if (!validacionAsistente.ok) {
        throw new AsistenteSocialRepoError(validacionAsistente.motivo, validacionAsistente.detalle);
      }

      const [insertado] = await trx
        .insertInto("evento_asistencia_social")
        .values({
          codigo: datos.codigo,
          descripcion: datos.descripcion,
          tipo_afectacion: datos.tipoAfectacion,
          personas_afectadas: datos.personasAfectadas,
          familias_afectadas: datos.familiasAfectadas,
          direccion_texto: datos.direccionTexto,
          latitud: datos.latitud,
          longitud: datos.longitud,
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
          prioridad: datos.prioridad,
          estado: "ASIGNADO",
          contacto_nombre: datos.contactoNombre ?? null,
          contacto_telefono: datos.contactoTelefono ?? null,
          contacto_rut: datos.contactoRut ?? null,
          delegacion_id: datos.delegacionId ?? null,
          incidente_id: datos.incidenteId ?? null,
          asistente_social_id: asistenteIdLimpio,
          detalles_evaluacion: detallesEvaluacionJson,
          creado_por_id: datos.creadoPorId,
        })
        .returning("id")
        .execute();

      const eventoDetalle = await consultarEventoConRelacionesBase(trx)
        .where("evento_asistencia_social.id", "=", insertado.id)
        .where("evento_asistencia_social.eliminado_en", "is", null)
        .executeTakeFirst();

      if (!eventoDetalle) {
        throw new Error("No se pudo recuperar el evento de asistencia social recién creado.");
      }

      return eventoDetalle as unknown as FilaEventoAsistenciaSocialConRelaciones;
    });
  }

  const [insertado] = await db
    .insertInto("evento_asistencia_social")
    .values({
      codigo: datos.codigo,
      descripcion: datos.descripcion,
      tipo_afectacion: datos.tipoAfectacion,
      personas_afectadas: datos.personasAfectadas,
      familias_afectadas: datos.familiasAfectadas,
      direccion_texto: datos.direccionTexto,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      prioridad: datos.prioridad,
      estado: "PENDIENTE",
      contacto_nombre: datos.contactoNombre ?? null,
      contacto_telefono: datos.contactoTelefono ?? null,
      contacto_rut: datos.contactoRut ?? null,
      delegacion_id: datos.delegacionId ?? null,
      incidente_id: datos.incidenteId ?? null,
      asistente_social_id: null,
      detalles_evaluacion: detallesEvaluacionJson,
      creado_por_id: datos.creadoPorId,
    })
    .returning("id")
    .execute();

  const eventoDetalle = await buscarEventoAsistenciaSocialPorId(insertado.id);
  if (!eventoDetalle) {
    throw new Error("No se pudo recuperar el evento de asistencia social recién creado.");
  }

  return eventoDetalle;
}

/**
 * Busca un evento de asistencia social por su UUID con los nombres de delegación, creador y asistente social.
 */
export async function buscarEventoAsistenciaSocialPorId(
  id: string
): Promise<FilaEventoAsistenciaSocialConRelaciones | null> {
  const fila = await consultarEventoConRelacionesBase(db)
    .where("evento_asistencia_social.id", "=", id)
    .where("evento_asistencia_social.eliminado_en", "is", null)
    .executeTakeFirst();

  return (fila as unknown as FilaEventoAsistenciaSocialConRelaciones) ?? null;
}

/**
 * Consulta paginada de eventos de asistencia social para el panel de pendientes y monitoreo.
 */
export async function listarEventosAsistenciaSocialPaginados(
  filtros: FiltrosListarEventosAsistenciaSocial,
  paginacion: OpcionesPaginacion
): Promise<FilaEventoAsistenciaSocialConRelaciones[]> {
  const { pagina, limite } = paginacion;
  const offset = (pagina - 1) * limite;

  let query = consultarEventoConRelacionesBase(db).where(
    "evento_asistencia_social.eliminado_en",
    "is",
    null
  );

  if (filtros.estado) {
    query = query.where("evento_asistencia_social.estado", "=", filtros.estado);
  }

  if (filtros.delegacionId) {
    query = query.where("evento_asistencia_social.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.prioridad) {
    query = query.where("evento_asistencia_social.prioridad", "=", filtros.prioridad);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("evento_asistencia_social.codigo", "ilike", patron),
        eb("evento_asistencia_social.descripcion", "ilike", patron),
        eb("evento_asistencia_social.direccion_texto", "ilike", patron),
        eb("evento_asistencia_social.contacto_nombre", "ilike", patron),
        eb("evento_asistencia_social.tipo_afectacion", "ilike", patron),
        eb(
          sql<string>`CAST(evento_asistencia_social.detalles_evaluacion AS TEXT)`,
          "ilike",
          patron
        ),
      ])
    );
  }

  const filas = await query
    .orderBy("evento_asistencia_social.creado_en", "desc")
    .limit(limite)
    .offset(offset)
    .execute();

  return filas as unknown as FilaEventoAsistenciaSocialConRelaciones[];
}

/**
 * Cuenta la cantidad total de eventos de asistencia social que coinciden con los filtros.
 */
export async function contarEventosAsistenciaSocial(
  filtros: FiltrosListarEventosAsistenciaSocial
): Promise<number> {
  let query = db
    .selectFrom("evento_asistencia_social")
    .where("evento_asistencia_social.eliminado_en", "is", null);

  if (filtros.estado) {
    query = query.where("evento_asistencia_social.estado", "=", filtros.estado);
  }

  if (filtros.delegacionId) {
    query = query.where("evento_asistencia_social.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.prioridad) {
    query = query.where("evento_asistencia_social.prioridad", "=", filtros.prioridad);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("evento_asistencia_social.codigo", "ilike", patron),
        eb("evento_asistencia_social.descripcion", "ilike", patron),
        eb("evento_asistencia_social.direccion_texto", "ilike", patron),
        eb("evento_asistencia_social.contacto_nombre", "ilike", patron),
        eb("evento_asistencia_social.tipo_afectacion", "ilike", patron),
        eb(
          sql<string>`CAST(evento_asistencia_social.detalles_evaluacion AS TEXT)`,
          "ilike",
          patron
        ),
      ])
    );
  }

  const resultado = await query
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  return Number(resultado?.total ?? 0);
}

export type ResultadoAsignacionAsistenciaSocial =
  | { ok: true; evento: FilaEventoAsistenciaSocialConRelaciones }
  | { ok: false; motivo: "EVENTO_NO_ENCONTRADO" | "ESTADO_INVALIDO" | "ASISTENTE_NO_ENCONTRADO" | "ASISTENTE_NO_ELEGIBLE"; detalle?: string };

/**
 * Asigna atómicamente un asistente social disponible a un evento en estado PENDIENTE (H31).
 * Transiciona el estado de PENDIENTE a ASIGNADO y registra actualizado_en = CURRENT_TIMESTAMP.
 */
export async function asignarAsistenteSocialEventoRepo(
  eventoId: string,
  asistenteSocialId: string
): Promise<ResultadoAsignacionAsistenciaSocial> {
  return db.transaction().execute(async (trx) => {
    const eventoActual = await trx
      .selectFrom("evento_asistencia_social")
      .select(["id", "estado"])
      .where("id", "=", eventoId)
      .where("eliminado_en", "is", null)
      .forUpdate()
      .executeTakeFirst();

    if (!eventoActual) {
      return { ok: false, motivo: "EVENTO_NO_ENCONTRADO" };
    }

    if (eventoActual.estado !== "PENDIENTE") {
      return {
        ok: false,
        motivo: "ESTADO_INVALIDO",
        detalle: `El evento se encuentra en estado '${eventoActual.estado}' y solo puede asignarse desde estado 'PENDIENTE'.`,
      };
    }

    const validacionAsistente = await validarAsistenteSocialElegibleEnTrx(
      trx,
      asistenteSocialId
    );
    if (!validacionAsistente.ok) {
      return {
        ok: false,
        motivo: validacionAsistente.motivo,
        detalle: validacionAsistente.detalle,
      };
    }

    const actualizado = await trx
      .updateTable("evento_asistencia_social")
      .set({
        asistente_social_id: asistenteSocialId,
        estado: "ASIGNADO",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", eventoId)
      .where("estado", "=", "PENDIENTE")
      .where("eliminado_en", "is", null)
      .returning("id")
      .executeTakeFirst();

    if (!actualizado) {
      return {
        ok: false,
        motivo: "ESTADO_INVALIDO",
        detalle: "No se pudo completar la transición de estado de PENDIENTE a ASIGNADO.",
      };
    }

    const fila = await consultarEventoConRelacionesBase(trx)
      .where("evento_asistencia_social.id", "=", eventoId)
      .where("evento_asistencia_social.eliminado_en", "is", null)
      .executeTakeFirst();

    if (!fila) {
      return { ok: false, motivo: "EVENTO_NO_ENCONTRADO" };
    }

    return {
      ok: true,
      evento: fila as unknown as FilaEventoAsistenciaSocialConRelaciones,
    };
  });
}
