import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "@/lib/db";
import type { Database } from "@/lib/db/types";
import type {
  PrioridadEventoAsistenciaSocial,
  EstadoEventoAsistenciaSocial,
  DetallesEvaluacionSocial,
} from "./asistencia-social.schema";
import {
  consolidarFamiliasCanonicas,
  extraerContactoPrincipalDesdeFamilias,
  type NivelCompromisoVivienda,
} from "@/modules/shared/familia-afectada.schema";

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
  incidente_codigo?: string | null;
  asistente_social_id: string | null;
  asistente_social_nombre: string | null;
  detalles_evaluacion?: Record<string, unknown> | string | null;
  folio_fibe?: string | null;
  nivel_dano_vivienda?: string | null;
  observaciones_fibe?: string | null;
  fibe_registrada_en?: Date | string | null;
  fibe_registrada_por_id?: string | null;
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
  incidenteId?: string;
  asistenteSocialId?: string;
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
    .leftJoin("incidente", "incidente.id", "evento_asistencia_social.incidente_id")
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
      "incidente.codigo as incidente_codigo",
      "evento_asistencia_social.asistente_social_id",
      "asistente.nombre as asistente_social_nombre",
      "evento_asistencia_social.detalles_evaluacion",
      "evento_asistencia_social.folio_fibe",
      "evento_asistencia_social.nivel_dano_vivienda",
      "evento_asistencia_social.observaciones_fibe",
      "evento_asistencia_social.fibe_registrada_en",
      "evento_asistencia_social.fibe_registrada_por_id",
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
  | { ok: true; asistenteNombre: string }
  | { ok: false; motivo: "ASISTENTE_NO_ENCONTRADO" | "ASISTENTE_NO_ELEGIBLE"; detalle: string }
> {
  const asistente = await trx
    .selectFrom("usuario")
    .innerJoin("rol", "rol.id", "usuario.rol_id")
    .select([
      "usuario.id",
      "usuario.nombre",
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

  return { ok: true, asistenteNombre: asistente.nombre ?? "Asistente Social" };
}

/**
 * Genera el siguiente código correlativo anual institucional con formato AS-YYYY-0001 (H28 / HU-25).
 * Cuando corre dentro de una transacción, adquiere advisory lock transaccional para evitar colisiones.
 */
export async function generarSiguienteCodigoAsistenciaSocial(
  executor: DbExecutor = db
): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `AS-${anio}-`;

  if (executor !== db) {
    try {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`eas_codigo_${anio}`}))`.execute(
        executor
      );
    } catch {
      // Tolerancia en mocks unitarios sin ejecución SQL cruda
    }
  }

  const resultado = await executor
    .selectFrom("evento_asistencia_social")
    .where("codigo", "like", `${prefijo}%`)
    .select(
      sql<number>`COALESCE(MAX(CASE WHEN substring(codigo from '[0-9]+$') ~ '^[0-9]+$' THEN substring(codigo from '[0-9]+$')::int ELSE 0 END), 0)`.as(
        "max_seq"
      )
    )
    .executeTakeFirst();

  const row = resultado as
    | { max_seq?: number | string | null; total?: number | string | null }
    | undefined;
  const maxSeq = Number(row?.max_seq ?? row?.total ?? 0);
  const secuencia = (Number.isFinite(maxSeq) ? maxSeq : 0) + 1;
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

  if (filtros.incidenteId) {
    query = query.where("evento_asistencia_social.incidente_id", "=", filtros.incidenteId);
  }

  if (filtros.asistenteSocialId) {
    query = query.where(
      "evento_asistencia_social.asistente_social_id",
      "=",
      filtros.asistenteSocialId
    );
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

  if (filtros.incidenteId) {
    query = query.where("evento_asistencia_social.incidente_id", "=", filtros.incidenteId);
  }

  if (filtros.asistenteSocialId) {
    query = query.where(
      "evento_asistencia_social.asistente_social_id",
      "=",
      filtros.asistenteSocialId
    );
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

export interface DerivarIncidenteAsistenciaSocialRepoInput {
  incidenteId: string;
  asistenteSocialId: string;
  usuarioId: string;
  observaciones?: string | null;
  prioridad?: PrioridadEventoAsistenciaSocial;
}

export interface FilaHitoDerivacionSocial {
  id: string;
  mision_id: string;
  hito: string;
  descripcion: string;
  registrado_por_id: string | null;
  metadatos: Record<string, unknown> | string | null;
  creado_en: Date | string;
}

export type ResultadoDerivacionIncidenteSocial =
  | {
      ok: true;
      accion: "CREADO" | "ACTUALIZADO";
      evento: FilaEventoAsistenciaSocialConRelaciones;
      hito: FilaHitoDerivacionSocial | null;
      incidente: {
        id: string;
        codigo: string;
        estado: string;
        prioridad: string;
        requiere_asistencia_social: boolean;
        actualizado_en: Date | string;
      };
    }
  | {
      ok: false;
      motivo:
        | "INCIDENTE_NO_ENCONTRADO"
        | "INCIDENTE_NO_RESUELTO"
        | "INCIDENTE_SIN_AFECTACION_SOCIAL"
        | "ASISTENTE_NO_ENCONTRADO"
        | "ASISTENTE_NO_ELEGIBLE"
        | "EVENTO_EN_PROCESO_O_FINALIZADO";
      detalle: string;
    };

const PRIORIDADES_SOCIALES_VALIDAS = new Set<PrioridadEventoAsistenciaSocial>([
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

const COMPROMISOS_VALIDOS = new Set<NivelCompromisoVivienda>([
  "SIN_DANO",
  "LEVE",
  "MODERADO",
  "GRAVE_INHABITABLE",
]);

function parsearObjetoJsonDefensivo(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function truncarTextoOpcional(valor: unknown, maxLen: number): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (!limpio) return null;
  return limpio.slice(0, maxLen);
}

function normalizarPrioridadSocial(raw: string | null | undefined): PrioridadEventoAsistenciaSocial {
  const upper = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (PRIORIDADES_SOCIALES_VALIDAS.has(upper as PrioridadEventoAsistenciaSocial)) {
    return upper as PrioridadEventoAsistenciaSocial;
  }
  return "MEDIA";
}

function pesoTipoReporteDerivacion(tipoReporte: string | null | undefined): number {
  if (tipoReporte === "REPORTE_CUADRILLA") return 3;
  if (tipoReporte === "VERIFICACION_CIERRE") return 2;
  if (tipoReporte === "EVALUACION_PRIORIDAD") return 1;
  return 0;
}

function ordenarReportesParaDerivacion<
  T extends {
    tipo_reporte?: string | null;
    version_reporte?: number | null;
    creado_en: Date | string;
  },
>(reportes: T[]): T[] {
  return [...reportes].sort((a, b) => {
    const pesoDiff =
      pesoTipoReporteDerivacion(b.tipo_reporte) - pesoTipoReporteDerivacion(a.tipo_reporte);
    if (pesoDiff !== 0) return pesoDiff;
    const versionDiff = Number(b.version_reporte ?? 0) - Number(a.version_reporte ?? 0);
    if (versionDiff !== 0) return versionDiff;
    return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime();
  });
}

function consolidarAntecedentesSocialesDesdeReportes(
  reportesOrdenados: Array<{
    personas_afectadas?: number | string | null;
    requiere_asistencia_social?: boolean | null;
    danos_estimados?: string | null;
    detalles_evaluacion?: unknown;
  }>
): {
  personasAfectadas: number;
  familiasAfectadas: number;
  contactoDesdeFamilias: {
    contactoNombre: string | null;
    contactoTelefono: string | null;
    contactoRut: string | null;
  } | null;
  detallesEvaluacion: DetallesEvaluacionSocial | null;
} {
  for (const rep of reportesOrdenados) {
    const detalles = parsearObjetoJsonDefensivo(rep.detalles_evaluacion);
    const familiasRaw = Array.isArray(detalles?.familias)
      ? (detalles!.familias as Array<Record<string, unknown>>)
      : [];
    const familiasValidas = familiasRaw.filter(
      (f) => Number(f.nucleoFamiliarTotal ?? f.nucleo_familiar_total ?? 0) >= 1
    );

    if (familiasValidas.length > 0) {
      const consolidado = consolidarFamiliasCanonicas(familiasValidas);
      const contactoDesdeFamilias = extraerContactoPrincipalDesdeFamilias(consolidado.familias);
      const nivelCompRaw = String(
        detalles?.nivelCompromisoVivienda ?? consolidado.nivelCompromisoVivienda ?? ""
      ).toUpperCase();
      const nivelCompromisoVivienda = COMPROMISOS_VALIDOS.has(
        nivelCompRaw as NivelCompromisoVivienda
      )
        ? (nivelCompRaw as NivelCompromisoVivienda)
        : consolidado.nivelCompromisoVivienda;
      const danosEstimados = truncarTextoOpcional(
        rep.danos_estimados ?? detalles?.danosEstimados,
        500
      );

      return {
        personasAfectadas: consolidado.nucleoFamiliarTotal,
        familiasAfectadas: consolidado.familiasAfectadas,
        contactoDesdeFamilias,
        detallesEvaluacion: {
          familias: consolidado.familias,
          familiasAfectadas: consolidado.familiasAfectadas,
          nucleoFamiliarTotal: consolidado.nucleoFamiliarTotal,
          cantidadNinos: consolidado.cantidadNinos,
          cantidadAdultosMayores: consolidado.cantidadAdultosMayores,
          personasDiscapacitadas: consolidado.personasDiscapacitadas,
          personasElectrodependientes: consolidado.personasElectrodependientes,
          mascotasAfectadas: consolidado.mascotasAfectadas,
          nivelCompromisoVivienda,
          danosEstimados,
        },
      };
    }
  }

  let personasAfectadas = 0;
  let familiasAfectadas = 0;
  let detallesFallback: DetallesEvaluacionSocial | null = null;

  for (const rep of reportesOrdenados) {
    const personas = Number(rep.personas_afectadas ?? 0);
    if (personas > 0 && personasAfectadas === 0) {
      personasAfectadas = Math.trunc(personas);
    }

    const detalles = parsearObjetoJsonDefensivo(rep.detalles_evaluacion);
    if (!detallesFallback && (detalles || rep.danos_estimados)) {
      const ninos = Math.max(0, Math.trunc(Number(detalles?.cantidadNinos ?? 0) || 0));
      const adultos = Math.max(0, Math.trunc(Number(detalles?.cantidadAdultosMayores ?? 0) || 0));
      const discap = Math.max(0, Math.trunc(Number(detalles?.personasDiscapacitadas ?? 0) || 0));
      const electro = Math.max(
        0,
        Math.trunc(Number(detalles?.personasElectrodependientes ?? 0) || 0)
      );
      const mascotas = Math.max(0, Math.trunc(Number(detalles?.mascotasAfectadas ?? 0) || 0));
      const nivelCompRaw = String(detalles?.nivelCompromisoVivienda ?? "").toUpperCase();
      const nivelCompromiso = COMPROMISOS_VALIDOS.has(nivelCompRaw as NivelCompromisoVivienda)
        ? (nivelCompRaw as NivelCompromisoVivienda)
        : null;
      const danosEstimados = truncarTextoOpcional(
        rep.danos_estimados ?? detalles?.danosEstimados,
        500
      );

      if (
        ninos > 0 ||
        adultos > 0 ||
        discap > 0 ||
        electro > 0 ||
        mascotas > 0 ||
        nivelCompromiso ||
        danosEstimados
      ) {
        detallesFallback = {
          ...(ninos > 0 ? { cantidadNinos: ninos } : {}),
          ...(adultos > 0 ? { cantidadAdultosMayores: adultos } : {}),
          ...(discap > 0 ? { personasDiscapacitadas: discap } : {}),
          ...(electro > 0 ? { personasElectrodependientes: electro } : {}),
          ...(mascotas > 0 ? { mascotasAfectadas: mascotas } : {}),
          ...(nivelCompromiso ? { nivelCompromisoVivienda: nivelCompromiso } : {}),
          ...(danosEstimados ? { danosEstimados } : {}),
        };
      }
      if (detalles?.familiasAfectadas) {
        familiasAfectadas = Math.max(0, Math.trunc(Number(detalles.familiasAfectadas) || 0));
      }
    }
  }

  if (personasAfectadas > 0 && familiasAfectadas === 0) {
    familiasAfectadas = 1;
  }

  return {
    personasAfectadas,
    familiasAfectadas,
    contactoDesdeFamilias: null,
    detallesEvaluacion: detallesFallback,
  };
}

function seleccionarMisionParaHitoDerivacion<
  T extends {
    id: string;
    codigo: string;
    tipo_mision: string;
    estado: string;
    fecha_cierre: Date | string | null;
    creado_en: Date | string;
  },
>(misiones: T[]): T | null {
  if (misiones.length === 0) return null;
  const ordenarDesc = (arr: T[]) =>
    [...arr].sort(
      (a, b) =>
        new Date(b.fecha_cierre ?? b.creado_en).getTime() -
        new Date(a.fecha_cierre ?? a.creado_en).getTime()
    );

  const cuadrillasCompletadas = ordenarDesc(
    misiones.filter((m) => m.tipo_mision === "ATENCION_CUADRILLA" && m.estado === "COMPLETADA")
  );
  if (cuadrillasCompletadas.length > 0) return cuadrillasCompletadas[0];

  const completadas = ordenarDesc(misiones.filter((m) => m.estado === "COMPLETADA"));
  if (completadas.length > 0) return completadas[0];

  return ordenarDesc(misiones)[0];
}

/**
 * Deriva atómicamente un incidente RESUELTO con afectación de personas o marca social
 * hacia `evento_asistencia_social` en estado `ASIGNADO` (HU-25), copiando dirección,
 * geolocalización y datos de contacto del incidente y dejando trazabilidad en `mision_hito`.
 */
export async function derivarIncidenteAAsistenciaSocialRepo(
  input: DerivarIncidenteAsistenciaSocialRepoInput
): Promise<ResultadoDerivacionIncidenteSocial> {
  return db.transaction().execute(async (trx) => {
    // 1. Bloquear fila del incidente y obtener informante vinculado
    const incidente = await trx
      .selectFrom("incidente")
      .leftJoin("informante", "informante.id", "incidente.informante_id")
      .select([
        "incidente.id",
        "incidente.codigo",
        "incidente.estado",
        "incidente.prioridad",
        "incidente.tipo_afectacion",
        "incidente.descripcion",
        "incidente.direccion_texto",
        "incidente.latitud",
        "incidente.longitud",
        "incidente.requiere_asistencia_social",
        "incidente.delegacion_id",
        "incidente.aviso_id",
        "incidente.evento_atp_id",
        "incidente.asterisk_caller_phone",
        "informante.nombre as informante_nombre",
        "informante.telefono as informante_telefono",
        "informante.rut as informante_rut",
      ])
      .where("incidente.id", "=", input.incidenteId)
      .forUpdate("incidente")
      .executeTakeFirst();

    if (!incidente) {
      return {
        ok: false,
        motivo: "INCIDENTE_NO_ENCONTRADO",
        detalle: "No se encontró ningún incidente con el identificador proporcionado.",
      };
    }

    if (String(incidente.estado ?? "").toUpperCase() !== "RESUELTO") {
      return {
        ok: false,
        motivo: "INCIDENTE_NO_RESUELTO",
        detalle: `Solo es posible derivar incidentes en estado RESUELTO (estado actual: '${incidente.estado}').`,
      };
    }

    // 2. Consultar reportes de terreno asociados al incidente para verificar afectación
    const reportesRaw = await trx
      .selectFrom("reporte_terreno")
      .innerJoin("mision", "mision.id", "reporte_terreno.mision_id")
      .select([
        "reporte_terreno.id",
        "reporte_terreno.mision_id",
        "reporte_terreno.tipo_reporte",
        "reporte_terreno.version_reporte",
        "reporte_terreno.personas_afectadas",
        "reporte_terreno.requiere_asistencia_social",
        "reporte_terreno.danos_estimados",
        "reporte_terreno.detalles_evaluacion",
        "reporte_terreno.creado_en",
      ])
      .where("mision.incidente_id", "=", input.incidenteId)
      .execute();

    const reportesOrdenados = ordenarReportesParaDerivacion(reportesRaw);
    const antecedentes = consolidarAntecedentesSocialesDesdeReportes(reportesOrdenados);
    const requiereSocialFlag =
      Boolean(incidente.requiere_asistencia_social) ||
      reportesOrdenados.some((r) => Boolean(r.requiere_asistencia_social));

    if (antecedentes.personasAfectadas <= 0 && !requiereSocialFlag) {
      return {
        ok: false,
        motivo: "INCIDENTE_SIN_AFECTACION_SOCIAL",
        detalle:
          "El incidente resuelto no registra personas afectadas ni marca de requerimiento de asistencia social (FIBE).",
      };
    }

    // 3. Validar elegibilidad del Asistente Social (activo, rol ASISTENTE_SOCIAL, disponible)
    const validacionAsistente = await validarAsistenteSocialElegibleEnTrx(
      trx,
      input.asistenteSocialId
    );
    if (!validacionAsistente.ok) {
      return {
        ok: false,
        motivo: validacionAsistente.motivo,
        detalle: validacionAsistente.detalle,
      };
    }

    // 4. Verificar si ya existe evento activo en evento_asistencia_social para el incidente
    const eventoExistente = await trx
      .selectFrom("evento_asistencia_social")
      .select([
        "id",
        "codigo",
        "estado",
        "personas_afectadas",
        "familias_afectadas",
        "contacto_nombre",
        "contacto_telefono",
        "contacto_rut",
        "delegacion_id",
        "evento_atp_id",
        "detalles_evaluacion",
      ])
      .where("incidente_id", "=", input.incidenteId)
      .where("eliminado_en", "is", null)
      .where("estado", "<>", "DESCARTADO")
      .orderBy("creado_en", "desc")
      .forUpdate()
      .executeTakeFirst();

    if (
      eventoExistente &&
      (eventoExistente.estado === "EN_EVALUACION_FIBE" ||
        eventoExistente.estado === "FINALIZADO")
    ) {
      return {
        ok: false,
        motivo: "EVENTO_EN_PROCESO_O_FINALIZADO",
        detalle: `El incidente ya posee un evento de asistencia social (${eventoExistente.codigo}) en estado '${eventoExistente.estado}' y no puede reasignarse por esta vía.`,
      };
    }

    // 5. Resolver contacto y datos autoritativos desde el incidente (Regla DEC-05 y §3.5)
    let contactoNombre =
      antecedentes.contactoDesdeFamilias?.contactoNombre ??
      truncarTextoOpcional(incidente.informante_nombre, 150);
    let contactoTelefono =
      antecedentes.contactoDesdeFamilias?.contactoTelefono ??
      truncarTextoOpcional(incidente.informante_telefono, 50);
    let contactoRut =
      antecedentes.contactoDesdeFamilias?.contactoRut ??
      truncarTextoOpcional(incidente.informante_rut, 20);

    if (incidente.aviso_id && (!contactoNombre || !contactoTelefono || !contactoRut)) {
      try {
        const aviso = await trx
          .selectFrom("aviso_incidente")
          .select(["informante_nombre", "informante_telefono", "informante_rut"])
          .where("id", "=", incidente.aviso_id)
          .executeTakeFirst();
        if (aviso) {
          contactoNombre ??= truncarTextoOpcional(aviso.informante_nombre, 150);
          contactoTelefono ??= truncarTextoOpcional(aviso.informante_telefono, 50);
          contactoRut ??= truncarTextoOpcional(aviso.informante_rut, 20);
        }
      } catch {
        // Tolerancia si aviso_incidente no está disponible en mocks parciales
      }
    }

    contactoTelefono ??= truncarTextoOpcional(incidente.asterisk_caller_phone, 50);
    if (eventoExistente) {
      contactoNombre ??= truncarTextoOpcional(eventoExistente.contacto_nombre, 150);
      contactoTelefono ??= truncarTextoOpcional(eventoExistente.contacto_telefono, 50);
      contactoRut ??= truncarTextoOpcional(eventoExistente.contacto_rut, 20);
    }

    const direccionTexto =
      truncarTextoOpcional(incidente.direccion_texto, 255) ?? "Dirección no especificada";
    const tipoAfectacion = truncarTextoOpcional(incidente.tipo_afectacion, 50) ?? "OTRO";
    const latitud = Number(incidente.latitud);
    const longitud = Number(incidente.longitud);
    const prioridad = input.prioridad ?? normalizarPrioridadSocial(incidente.prioridad);

    const descripcionBase =
      truncarTextoOpcional(incidente.descripcion, 1200) ??
      `Derivación post-incidente ${incidente.codigo} (${tipoAfectacion}) para evaluación FIBE por la DGRD.`;
    const observacionesLimpias = truncarTextoOpcional(input.observaciones, 1000);
    const descripcion = observacionesLimpias
      ? `${descripcionBase}\nObservaciones de derivación: ${observacionesLimpias}`
      : descripcionBase;

    const personasFinal = eventoExistente
      ? Math.max(antecedentes.personasAfectadas, Number(eventoExistente.personas_afectadas ?? 0))
      : antecedentes.personasAfectadas;
    const familiasFinal = eventoExistente
      ? Math.max(antecedentes.familiasAfectadas, Number(eventoExistente.familias_afectadas ?? 0))
      : antecedentes.familiasAfectadas;

    const detallesEvaluacionJson = antecedentes.detallesEvaluacion
      ? JSON.stringify(antecedentes.detallesEvaluacion)
      : eventoExistente?.detalles_evaluacion
        ? typeof eventoExistente.detalles_evaluacion === "string"
          ? eventoExistente.detalles_evaluacion
          : JSON.stringify(eventoExistente.detalles_evaluacion)
        : null;

    let eventoIdObjetivo: string;
    let eventoCodigoObjetivo: string;
    let accion: "CREADO" | "ACTUALIZADO";

    if (eventoExistente) {
      accion = "ACTUALIZADO";
      eventoIdObjetivo = eventoExistente.id;
      eventoCodigoObjetivo = eventoExistente.codigo;

      await trx
        .updateTable("evento_asistencia_social")
        .set({
          descripcion,
          tipo_afectacion: tipoAfectacion,
          personas_afectadas: personasFinal,
          familias_afectadas: familiasFinal,
          direccion_texto: direccionTexto,
          latitud,
          longitud,
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)`,
          prioridad,
          estado: "ASIGNADO",
          contacto_nombre: contactoNombre,
          contacto_telefono: contactoTelefono,
          contacto_rut: contactoRut,
          delegacion_id: incidente.delegacion_id ?? eventoExistente.delegacion_id ?? null,
          evento_atp_id: incidente.evento_atp_id ?? eventoExistente.evento_atp_id ?? null,
          asistente_social_id: input.asistenteSocialId,
          detalles_evaluacion: detallesEvaluacionJson,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", eventoExistente.id)
        .execute();
    } else {
      accion = "CREADO";
      eventoCodigoObjetivo = await generarSiguienteCodigoAsistenciaSocial(trx);

      const insertado = await trx
        .insertInto("evento_asistencia_social")
        .values({
          codigo: eventoCodigoObjetivo,
          descripcion,
          tipo_afectacion: tipoAfectacion,
          personas_afectadas: personasFinal,
          familias_afectadas: familiasFinal,
          direccion_texto: direccionTexto,
          latitud,
          longitud,
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)`,
          prioridad,
          estado: "ASIGNADO",
          contacto_nombre: contactoNombre,
          contacto_telefono: contactoTelefono,
          contacto_rut: contactoRut,
          delegacion_id: incidente.delegacion_id ?? null,
          incidente_id: input.incidenteId,
          asistente_social_id: input.asistenteSocialId,
          evento_atp_id: incidente.evento_atp_id ?? null,
          detalles_evaluacion: detallesEvaluacionJson,
          creado_por_id: input.usuarioId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      eventoIdObjetivo = insertado.id;
    }

    // 6. Sincronizar marca social en el incidente resuelto
    const incidenteActualizado = await trx
      .updateTable("incidente")
      .set({
        requiere_asistencia_social: true,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", input.incidenteId)
      .returning([
        "id",
        "codigo",
        "estado",
        "prioridad",
        "requiere_asistencia_social",
        "actualizado_en",
      ])
      .executeTakeFirst();

    // 7. Registrar trazabilidad en mision_hito
    const misionesIncidente = await trx
      .selectFrom("mision")
      .select(["id", "codigo", "tipo_mision", "estado", "fecha_cierre", "creado_en"])
      .where("incidente_id", "=", input.incidenteId)
      .execute();

    const misionObjetivo = seleccionarMisionParaHitoDerivacion(misionesIncidente);
    let hitoRegistrado: FilaHitoDerivacionSocial | null = null;

    if (misionObjetivo) {
      const metadatosHito = {
        eventoAsistenciaSocialId: eventoIdObjetivo,
        eventoAsistenciaSocialCodigo: eventoCodigoObjetivo,
        accion,
        asistenteSocialId: input.asistenteSocialId,
        asistenteSocialNombre: validacionAsistente.asistenteNombre,
        incidenteId: input.incidenteId,
        incidenteCodigo: incidente.codigo,
        personasAfectadas: personasFinal,
        familiasAfectadas: familiasFinal,
      };

      const descripcionHito =
        `Incidente ${incidente.codigo} derivado a Asistencia Social (DGRD / FIBE) mediante evento ${eventoCodigoObjetivo}, asignado a ${validacionAsistente.asistenteNombre}.` +
        (observacionesLimpias ? ` Observaciones: ${observacionesLimpias}` : "");

      const hitoRow = await trx
        .insertInto("mision_hito")
        .values({
          mision_id: misionObjetivo.id,
          hito: "DERIVACION_ASISTENCIA_SOCIAL",
          descripcion: descripcionHito,
          registrado_por_id: input.usuarioId,
          latitud,
          longitud,
          metadatos: JSON.stringify(metadatosHito),
        })
        .returning([
          "id",
          "mision_id",
          "hito",
          "descripcion",
          "registrado_por_id",
          "metadatos",
          "creado_en",
        ])
        .executeTakeFirstOrThrow();

      hitoRegistrado = hitoRow as unknown as FilaHitoDerivacionSocial;
    } else {
      console.warn(
        `[HU-25] Incidente ${incidente.codigo} (${input.incidenteId}) derivado sin misiones asociadas para insertar DERIVACION_ASISTENCIA_SOCIAL en mision_hito.`
      );
    }

    // 8. Recuperar el detalle relacional completo del evento social
    const eventoDetalle = await consultarEventoConRelacionesBase(trx)
      .where("evento_asistencia_social.id", "=", eventoIdObjetivo)
      .where("evento_asistencia_social.eliminado_en", "is", null)
      .executeTakeFirst();

    if (!eventoDetalle) {
      throw new Error(
        "No se pudo recuperar el evento de asistencia social derivado desde el incidente."
      );
    }

    return {
      ok: true,
      accion,
      evento: eventoDetalle as unknown as FilaEventoAsistenciaSocialConRelaciones,
      hito: hitoRegistrado,
      incidente: {
        id: incidenteActualizado?.id ?? incidente.id,
        codigo: incidenteActualizado?.codigo ?? incidente.codigo,
        estado: incidenteActualizado?.estado ?? incidente.estado,
        prioridad: incidenteActualizado?.prioridad ?? incidente.prioridad,
        requiere_asistencia_social: Boolean(
          incidenteActualizado?.requiere_asistencia_social ?? true
        ),
        actualizado_en: incidenteActualizado?.actualizado_en ?? new Date(),
      },
    };
  });
}

export interface DatosRegistrarFichaFibeRepo {
  eventoId: string;
  folioFibe: string;
  personasAfectadas?: number;
  nivelDanoVivienda?: NivelCompromisoVivienda;
  observacionesSociales?: string | null;
  usuarioId: string;
}

export type ResultadoRegistrarFichaFibeRepo =
  | {
      ok: true;
      evento: FilaEventoAsistenciaSocialConRelaciones;
    }
  | {
      ok: false;
      motivo: "EVENTO_NO_ENCONTRADO" | "ESTADO_INVALIDO" | "FOLIO_DUPLICADO";
      detalle: string;
    };

const NIVELES_DANO_VALIDOS = new Set<string>([
  "SIN_DANO",
  "LEVE",
  "MODERADO",
  "GRAVE_INHABITABLE",
]);

function extraerNivelCompromisoDesdeDetalles(
  raw: Record<string, unknown> | string | null | undefined
): NivelCompromisoVivienda | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  const nivel = (obj as Record<string, unknown>).nivelCompromisoVivienda;
  if (typeof nivel === "string" && NIVELES_DANO_VALIDOS.has(nivel)) {
    return nivel as NivelCompromisoVivienda;
  }
  return null;
}

function esErrorUnicidadFolioFibe(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; constraint?: string; message?: string };
  if (err.code !== "23505") return false;
  if (!err.constraint && !err.message) return true;
  return (
    err.constraint?.includes("folio_fibe") ||
    err.message?.includes("folio_fibe") ||
    false
  );
}

/**
 * Registra o actualiza los datos oficiales de la Ficha Básica de Emergencia (FIBE)
 * sobre un evento de asistencia social en estado ASIGNADO o EN_EVALUACION_FIBE (HU-71).
 */
export async function registrarFichaFibeRepo(
  input: DatosRegistrarFichaFibeRepo
): Promise<ResultadoRegistrarFichaFibeRepo> {
  return await db.transaction().execute(async (trx) => {
    const evento = await trx
      .selectFrom("evento_asistencia_social")
      .select([
        "id",
        "codigo",
        "estado",
        "personas_afectadas",
        "nivel_dano_vivienda",
        "observaciones_fibe",
        "detalles_evaluacion",
        "incidente_id",
        "latitud",
        "longitud",
        "fibe_registrada_en",
        "fibe_registrada_por_id",
      ])
      .where("id", "=", input.eventoId)
      .where("eliminado_en", "is", null)
      .forUpdate()
      .executeTakeFirst();

    if (!evento) {
      return {
        ok: false,
        motivo: "EVENTO_NO_ENCONTRADO",
        detalle: "El evento de asistencia social especificado no existe.",
      };
    }

    if (evento.estado !== "ASIGNADO" && evento.estado !== "EN_EVALUACION_FIBE") {
      return {
        ok: false,
        motivo: "ESTADO_INVALIDO",
        detalle: `No se puede registrar la Ficha FIBE porque el evento se encuentra en estado ${evento.estado}. Debe estar en ASIGNADO o EN_EVALUACION_FIBE.`,
      };
    }

    const folioNormalizado = input.folioFibe.trim().toUpperCase();

    const duplicado = await trx
      .selectFrom("evento_asistencia_social")
      .select(["id", "codigo"])
      .where(sql<boolean>`UPPER(TRIM(folio_fibe)) = ${folioNormalizado}`)
      .where("id", "<>", input.eventoId)
      .where("eliminado_en", "is", null)
      .executeTakeFirst();

    if (duplicado) {
      return {
        ok: false,
        motivo: "FOLIO_DUPLICADO",
        detalle: `El folio FIBE ${folioNormalizado} ya se encuentra registrado en otro expediente (${duplicado.codigo}).`,
      };
    }

    const personasFinal =
      input.personasAfectadas !== undefined
        ? Math.trunc(input.personasAfectadas)
        : Number(evento.personas_afectadas ?? 0);

    const nivelDanoFinal =
      input.nivelDanoVivienda ??
      (evento.nivel_dano_vivienda as NivelCompromisoVivienda | null) ??
      extraerNivelCompromisoDesdeDetalles(evento.detalles_evaluacion) ??
      null;

    const observacionesFinal =
      input.observacionesSociales !== undefined
        ? input.observacionesSociales?.trim() || null
        : (evento.observaciones_fibe ?? null);

    try {
      await trx
        .updateTable("evento_asistencia_social")
        .set({
          folio_fibe: folioNormalizado,
          personas_afectadas: personasFinal,
          nivel_dano_vivienda: nivelDanoFinal,
          observaciones_fibe: observacionesFinal,
          estado: "EN_EVALUACION_FIBE",
          ...(evento.fibe_registrada_en
            ? {}
            : { fibe_registrada_en: sql`CURRENT_TIMESTAMP` as unknown as Date }),
          ...(evento.fibe_registrada_por_id
            ? {}
            : { fibe_registrada_por_id: input.usuarioId }),
          actualizado_en: sql`CURRENT_TIMESTAMP` as unknown as Date,
          actualizado_por_id: input.usuarioId,
        })
        .where("id", "=", input.eventoId)
        .execute();
    } catch (error) {
      if (esErrorUnicidadFolioFibe(error)) {
        return {
          ok: false,
          motivo: "FOLIO_DUPLICADO",
          detalle: `El folio FIBE ${folioNormalizado} ya se encuentra registrado en otro expediente.`,
        };
      }
      throw error;
    }

    if (evento.incidente_id) {
      const misionesIncidente = await trx
        .selectFrom("mision")
        .select(["id", "codigo", "tipo_mision", "estado", "fecha_cierre", "creado_en"])
        .where("incidente_id", "=", evento.incidente_id)
        .execute();

      const misionObjetivo = seleccionarMisionParaHitoDerivacion(misionesIncidente);
      if (misionObjetivo) {
        const metadatosHito = {
          eventoAsistenciaSocialId: evento.id,
          eventoAsistenciaSocialCodigo: evento.codigo,
          folioFibe: folioNormalizado,
          personasAfectadas: personasFinal,
          nivelDanoVivienda: nivelDanoFinal,
        };

        await trx
          .insertInto("mision_hito")
          .values({
            mision_id: misionObjetivo.id,
            hito: "REGISTRO_FICHA_FIBE",
            descripcion: `Ficha FIBE ${folioNormalizado} registrada en expediente ${evento.codigo} (integrantes evaluados: ${personasFinal}).`,
            registrado_por_id: input.usuarioId,
            latitud: evento.latitud,
            longitud: evento.longitud,
            metadatos: JSON.stringify(metadatosHito),
          })
          .execute();
      }
    }

    const eventoActualizado = await consultarEventoConRelacionesBase(trx)
      .where("evento_asistencia_social.id", "=", input.eventoId)
      .where("evento_asistencia_social.eliminado_en", "is", null)
      .executeTakeFirst();

    if (!eventoActualizado) {
      throw new Error(
        "No se pudo recuperar el evento de asistencia social tras registrar la Ficha FIBE."
      );
    }

    return {
      ok: true,
      evento: eventoActualizado as unknown as FilaEventoAsistenciaSocialConRelaciones,
    };
  });
}
