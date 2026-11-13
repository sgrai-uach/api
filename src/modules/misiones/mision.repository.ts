import { db } from "@/lib/db";
import { sql } from "kysely";
import { NotFoundError, ConflictError, ForbiddenError } from "@/modules/seguridad/errors";
import type { CrearMisionVerificacionInput } from "./mision.schema";

export interface MisionDetalleQueryResult {
  mision: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    tipo_mision: string;
    estado: string;
    prioridad: string;
    justificacion_rechazo: string | null;
    incidente_id: string | null;
    prevencion_id: string | null;
    cuadrilla_id: string | null;
    patrulla_id: string | null;
    encargado_id: string | null;
    creado_por_id: string;
    fecha_inicio: Date | string | null;
    fecha_cierre: Date | string | null;
    creado_en: Date | string;
    actualizado_en: Date | string;

    // Incidente
    incidente_codigo?: string | null;
    incidente_codigo_seguimiento?: string | null;
    incidente_tipo_afectacion?: string | null;
    incidente_descripcion?: string | null;
    incidente_direccion?: string | null;
    incidente_latitud?: number | string | null;
    incidente_longitud?: number | string | null;
    incidente_estado?: string | null;
    incidente_prioridad?: string | null;
    incidente_requiere_asistencia_social?: boolean | null;
    incidente_delegacion_nombre?: string | null;

    // Prevención
    prevencion_codigo?: string | null;
    prevencion_nombre?: string | null;
    prevencion_descripcion?: string | null;
    prevencion_latitud?: number | string | null;
    prevencion_longitud?: number | string | null;
    prevencion_delegacion_nombre?: string | null;

    // Creador
    creador_id?: string | null;
    creador_nombre?: string | null;
    creador_email?: string | null;

    // Encargado
    encargado_id_res?: string | null;
    encargado_nombre?: string | null;
    encargado_email?: string | null;

    // Cuadrilla
    cuadrilla_nombre?: string | null;
    cuadrilla_estado?: string | null;
    cuadrilla_delegacion_nombre?: string | null;
    delegado_id?: string | null;
    delegado_nombre?: string | null;
    delegado_email?: string | null;

    // Patrulla
    patrulla_nombre?: string | null;
    patrulla_estado?: string | null;
    patrulla_delegacion_nombre?: string | null;
    lider_id?: string | null;
    lider_nombre?: string | null;
    lider_email?: string | null;
  };
  recursosCuadrilla: Array<{
    id: string;
    nombre: string;
    tipo: string;
    cantidadAsignada: number;
  }>;
  reportesTerreno: Array<{
    id: string;
    mision_id: string;
    evaluador_id: string;
    resumen_tecnico: string;
    acciones_realizadas: string | null;
    requiere_apoyo_adicional: boolean;
    danos_estimados: string | null;
    observaciones: string | null;
    personas_afectadas: number;
    estado_terreno: string;
    creado_en: Date | string;
    actualizado_en: Date | string;
    evaluador_nombre: string | null;
    evaluador_email: string | null;
    evaluador_rut: string | null;
    adjuntos: Array<{
      id: string;
      nombre_archivo: string;
      url: string;
      tipo_mime: string;
      tamano_bytes: number | string | bigint;
      creado_en: Date | string;
    }>;
  }>;
  hitos?: Array<{
    id: string;
    mision_id: string;
    hito: string;
    descripcion: string;
    registrado_por_id: string | null;
    latitud: number | string | null;
    longitud: number | string | null;
    creado_en: Date | string;
  }>;
}

/**
 * Consulta la base de datos para obtener el detalle exhaustivo de una misión por su ID.
 * Realiza los JOIN correspondientes entre Misión, Incidente, Prevención, Cuadrilla, Patrulla,
 * Reportes de Terreno y sus Evidencias Adjuntas.
 */
export async function obtenerMisionDetallePorIdRepo(
  id: string
): Promise<MisionDetalleQueryResult | null> {
  const mision = await db
    .selectFrom("mision")
    .leftJoin("incidente", "incidente.id", "mision.incidente_id")
    .leftJoin("delegacion as delegacion_incidente", "delegacion_incidente.id", "incidente.delegacion_id")
    .leftJoin("prevencion", "prevencion.id", "mision.prevencion_id")
    .leftJoin("delegacion as delegacion_prevencion", "delegacion_prevencion.id", "prevencion.delegacion_id")
    .leftJoin("usuario as creador", "creador.id", "mision.creado_por_id")
    .leftJoin("usuario as encargado", "encargado.id", "mision.encargado_id")
    .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
    .leftJoin("delegacion as delegacion_cuadrilla", "delegacion_cuadrilla.id", "cuadrilla.delegacion_id")
    .leftJoin("usuario as delegado", "delegado.id", "cuadrilla.usuario_delegado_id")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .leftJoin("delegacion as delegacion_patrulla", "delegacion_patrulla.id", "patrulla_verificadora.delegacion_id")
    .leftJoin("usuario as lider", "lider.id", "patrulla_verificadora.usuario_lider_id")
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.descripcion",
      "mision.tipo_mision",
      "mision.estado",
      "mision.prioridad",
      "mision.justificacion_rechazo",
      "mision.incidente_id",
      "mision.prevencion_id",
      "mision.cuadrilla_id",
      "mision.patrulla_id",
      "mision.encargado_id",
      "mision.creado_por_id",
      "mision.fecha_inicio",
      "mision.fecha_cierre",
      "mision.creado_en",
      "mision.actualizado_en",

      // Incidente
      "incidente.codigo as incidente_codigo",
      "incidente.codigo_seguimiento as incidente_codigo_seguimiento",
      "incidente.tipo_afectacion as incidente_tipo_afectacion",
      "incidente.descripcion as incidente_descripcion",
      "incidente.direccion_texto as incidente_direccion",
      "incidente.latitud as incidente_latitud",
      "incidente.longitud as incidente_longitud",
      "incidente.estado as incidente_estado",
      "incidente.prioridad as incidente_prioridad",
      "incidente.requiere_asistencia_social as incidente_requiere_asistencia_social",
      "delegacion_incidente.nombre as incidente_delegacion_nombre",

      // Prevención
      "prevencion.codigo as prevencion_codigo",
      "prevencion.nombre as prevencion_nombre",
      "prevencion.descripcion as prevencion_descripcion",
      "prevencion.latitud as prevencion_latitud",
      "prevencion.longitud as prevencion_longitud",
      "delegacion_prevencion.nombre as prevencion_delegacion_nombre",

      // Creador
      "creador.id as creador_id",
      "creador.nombre as creador_nombre",
      "creador.email as creador_email",

      // Encargado
      "encargado.id as encargado_id_res",
      "encargado.nombre as encargado_nombre",
      "encargado.email as encargado_email",

      // Cuadrilla
      "cuadrilla.nombre as cuadrilla_nombre",
      "cuadrilla.estado as cuadrilla_estado",
      "delegacion_cuadrilla.nombre as cuadrilla_delegacion_nombre",
      "delegado.id as delegado_id",
      "delegado.nombre as delegado_nombre",
      "delegado.email as delegado_email",

      // Patrulla
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
      "delegacion_patrulla.nombre as patrulla_delegacion_nombre",
      "lider.id as lider_id",
      "lider.nombre as lider_nombre",
      "lider.email as lider_email",
    ])
    .where("mision.id", "=", id)
    .executeTakeFirst();

  if (!mision) {
    return null;
  }

  // Recursos asignados a la cuadrilla de la misión (si corresponde)
  let recursosCuadrilla: Array<{
    id: string;
    nombre: string;
    tipo: string;
    cantidadAsignada: number;
  }> = [];

  if (mision.cuadrilla_id) {
    const filasRecursos = await db
      .selectFrom("cuadrilla_recurso")
      .innerJoin("recurso", "recurso.id", "cuadrilla_recurso.recurso_id")
      .select([
        "recurso.id",
        "recurso.nombre",
        "recurso.es_individual",
        "cuadrilla_recurso.cantidad_asignada",
      ])
      .where("cuadrilla_recurso.cuadrilla_id", "=", mision.cuadrilla_id)
      .execute();

    recursosCuadrilla = filasRecursos.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      tipo: r.es_individual ? "INDIVIDUAL" : "GRUPAL",
      cantidadAsignada: Number(r.cantidad_asignada),
    }));
  }

  // Reportes de terreno elaborados para esta misión
  const reportesFilas = await db
    .selectFrom("reporte_terreno")
    .leftJoin("usuario as evaluador", "evaluador.id", "reporte_terreno.evaluador_id")
    .select([
      "reporte_terreno.id",
      "reporte_terreno.mision_id",
      "reporte_terreno.evaluador_id",
      "reporte_terreno.resumen_tecnico",
      "reporte_terreno.acciones_realizadas",
      "reporte_terreno.requiere_apoyo_adicional",
      "reporte_terreno.danos_estimados",
      "reporte_terreno.observaciones",
      "reporte_terreno.personas_afectadas",
      "reporte_terreno.estado_terreno",
      "reporte_terreno.creado_en",
      "reporte_terreno.actualizado_en",
      "evaluador.nombre as evaluador_nombre",
      "evaluador.email as evaluador_email",
      "evaluador.rut as evaluador_rut",
    ])
    .where("reporte_terreno.mision_id", "=", id)
    .orderBy("reporte_terreno.creado_en", "asc")
    .execute();

  const reporteIds = reportesFilas.map((r) => r.id);
  type AdjuntoFila = {
    id: string;
    nombre_archivo: string;
    url: string;
    tipo_mime: string;
    tamano_bytes: number | string | bigint;
    reporte_terreno_id: string | null;
    creado_en: Date | string;
  };

  let adjuntosFilas: AdjuntoFila[] = [];

  if (reporteIds.length > 0) {
    adjuntosFilas = (await db
      .selectFrom("adjunto")
      .select([
        "id",
        "nombre_archivo",
        "url",
        "tipo_mime",
        "tamano_bytes",
        "reporte_terreno_id",
        "creado_en",
      ])
      .where("reporte_terreno_id", "in", reporteIds)
      .orderBy("creado_en", "asc")
      .execute()) as AdjuntoFila[];
  }

  // Asociar adjuntos a sus respectivos reportes de terreno
  const reportesTerreno = reportesFilas.map((rep) => ({
    ...rep,
    adjuntos: adjuntosFilas
      .filter((adj) => adj.reporte_terreno_id === rep.id)
      .map((adj) => ({
        id: adj.id,
        nombre_archivo: adj.nombre_archivo,
        url: adj.url,
        tipo_mime: adj.tipo_mime,
        tamano_bytes: adj.tamano_bytes,
        creado_en: adj.creado_en,
      })),
  }));

  // Consultar bitácora cronológica de hitos operacionales
  const hitosFilas = await db
    .selectFrom("mision_hito")
    .select([
      "id",
      "mision_id",
      "hito",
      "descripcion",
      "registrado_por_id",
      "latitud",
      "longitud",
      "creado_en",
    ])
    .where("mision_id", "=", id)
    .orderBy("creado_en", "asc")
    .execute();

  return {
    mision,
    recursosCuadrilla,
    reportesTerreno,
    hitos: hitosFilas,
  };
}

export interface MisionVerificacionCreadaResult {
  mision: {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    tipoMision: "VERIFICACION" | "ATENCION_CUADRILLA" | "PREVENCION" | "RECUPERACION" | "ASISTENCIA_SOCIAL";
    estado: "PLANIFICADA" | "DESPACHADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" | "RECHAZADA";
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    incidenteId: string;
    patrullaId: string;
    encargadoId: string | null;
    fechaInicio: string | null;
    creadoEn: string;
  };
  incidente: {
    id: string;
    codigo: string;
    estado: string;
    prioridad: string;
  };
  patrulla: {
    id: string;
    nombre: string;
    estado: string;
    delegacionId: string | null;
    usuarioLiderId: string | null;
  };
  hitoInicial: {
    id: string;
    hito: string;
    descripcion: string;
    creadoEn: string;
  };
}

/**
 * HU-20 - Ejecuta la transacción atómica de asignación y despacho de patrulla verificadora.
 * 1. Verifica que el incidente exista y esté en estado 'REPORTADO'.
 * 2. Actualiza atómicamente la patrulla verificadora a 'EN_VERIFICACION' asegurando que esté 'DISPONIBLE'.
 * 3. Crea la misión con tipo 'VERIFICACION' y estado 'DESPACHADA'.
 * 4. Actualiza el estado del incidente a 'VERIFICANDO'.
 * 5. Registra el hito inicial 'DESPACHADA' en la bitácora de la misión ('mision_hito').
 */
export async function crearMisionVerificacionRepo(
  input: CrearMisionVerificacionInput,
  operadorId: string
): Promise<MisionVerificacionCreadaResult> {
  return await db.transaction().execute(async (trx) => {
    // 1. Validar existencia y estado del incidente con bloqueo pesimista (FOR UPDATE)
    const incidente = await trx
      .selectFrom("incidente")
      .select(["id", "codigo", "estado", "prioridad", "tipo_afectacion", "delegacion_id"])
      .where("id", "=", input.incidenteId)
      .forUpdate()
      .executeTakeFirst();

    if (!incidente) {
      throw new NotFoundError(`Incidente con ID '${input.incidenteId}' no encontrado.`);
    }

    if (incidente.estado !== "REPORTADO") {
      throw new ConflictError(
        `El incidente se encuentra en estado '${incidente.estado}', por lo que no puede ser asignado a una patrulla verificadora. Solo se pueden verificar incidentes en estado 'REPORTADO'.`
      );
    }

    // Validar que no posea ya una misión activa en curso o pendiente de confirmación
    const misionActiva = await trx
      .selectFrom("mision")
      .select(["id", "codigo", "estado"])
      .where("incidente_id", "=", input.incidenteId)
      .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
      .executeTakeFirst();

    if (misionActiva) {
      throw new ConflictError(
        `El incidente ya posee una misión activa (${misionActiva.codigo} en estado '${misionActiva.estado}').`
      );
    }

    // 2. Bloqueo y actualización atómica de la patrulla verificadora
    const patrullaActualizada = await trx
      .updateTable("patrulla_verificadora")
      .set({
        estado: "EN_VERIFICACION",
        actualizado_en: new Date(),
      })
      .where("id", "=", input.patrullaId)
      .where("estado", "=", "DISPONIBLE")
      .where("eliminado_en", "is", null)
      .returning(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
      .executeTakeFirst();

    if (!patrullaActualizada) {
      // Diferenciar entre inexistencia y conflicto concurrente
      const patrullaExistente = await trx
        .selectFrom("patrulla_verificadora")
        .select(["id", "nombre", "estado", "eliminado_en"])
        .where("id", "=", input.patrullaId)
        .executeTakeFirst();

      if (!patrullaExistente || patrullaExistente.eliminado_en !== null) {
        throw new NotFoundError(
          `Patrulla verificadora con ID '${input.patrullaId}' no existe o ha sido desactivada.`
        );
      }

      throw new ConflictError(
        `La patrulla verificadora '${patrullaExistente.nombre}' ya no se encuentra en estado 'DISPONIBLE' (estado actual: '${patrullaExistente.estado}').`
      );
    }

    // 3. Generar código correlativo único secuencial protegido contra colisiones concurrentes (advisory lock)
    await sql`SELECT pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.execute(trx);

    const year = new Date().getFullYear();
    const prefijo = `MIS-${year}-`;

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
    const codigo = `${prefijo}${String(correlativo).padStart(4, "0")}`;

    // 4. Crear registro en la tabla mision (fecha_inicio en null para estado DESPACHADA)
    const titulo = input.titulo?.trim() || `Verificación de Incidente ${incidente.codigo}`;
    const descripcion = input.descripcion?.trim() || null;
    const prioridad = (input.prioridad || incidente.prioridad || "MEDIA") as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

    const nuevaMision = await trx
      .insertInto("mision")
      .values({
        codigo,
        titulo,
        descripcion,
        tipo_mision: "VERIFICACION",
        estado: "DESPACHADA",
        prioridad,
        incidente_id: input.incidenteId,
        patrulla_id: input.patrullaId,
        encargado_id: operadorId,
        creado_por_id: operadorId,
        fecha_inicio: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 5. Actualizar incidente a VERIFICANDO
    const incidenteActualizado = await trx
      .updateTable("incidente")
      .set({
        estado: "VERIFICANDO",
        actualizado_en: new Date(),
      })
      .where("id", "=", input.incidenteId)
      .where("estado", "=", "REPORTADO")
      .returning(["id", "codigo", "estado", "prioridad"])
      .executeTakeFirst();

    if (!incidenteActualizado) {
      throw new ConflictError(
        `El incidente con ID '${input.incidenteId}' ya no se encuentra en estado 'REPORTADO' (fue modificado concurrentemente).`
      );
    }

    // 6. Registrar hito inicial en mision_hito
    const hitoInicial = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: nuevaMision.id,
        hito: "DESPACHADA",
        descripcion: `Misión de verificación asignada y despachada a la patrulla ${patrullaActualizada.nombre}.`,
        registrado_por_id: operadorId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      mision: {
        id: nuevaMision.id,
        codigo: nuevaMision.codigo,
        titulo: nuevaMision.titulo,
        descripcion: nuevaMision.descripcion,
        tipoMision: nuevaMision.tipo_mision as MisionVerificacionCreadaResult["mision"]["tipoMision"],
        estado: nuevaMision.estado as MisionVerificacionCreadaResult["mision"]["estado"],
        prioridad: nuevaMision.prioridad as MisionVerificacionCreadaResult["mision"]["prioridad"],
        incidenteId: input.incidenteId,
        patrullaId: input.patrullaId,
        encargadoId: nuevaMision.encargado_id,
        fechaInicio: nuevaMision.fecha_inicio ? new Date(nuevaMision.fecha_inicio).toISOString() : null,
        creadoEn: new Date(nuevaMision.creado_en).toISOString(),
      },
      incidente: {
        id: incidenteActualizado.id,
        codigo: incidenteActualizado.codigo,
        estado: incidenteActualizado.estado,
        prioridad: incidenteActualizado.prioridad,
      },
      patrulla: {
        id: patrullaActualizada.id,
        nombre: patrullaActualizada.nombre,
        estado: patrullaActualizada.estado,
        delegacionId: patrullaActualizada.delegacion_id,
        usuarioLiderId: patrullaActualizada.usuario_lider_id,
      },
      hitoInicial: {
        id: hitoInicial.id,
        hito: hitoInicial.hito,
        descripcion: hitoInicial.descripcion,
        creadoEn: new Date(hitoInicial.creado_en).toISOString(),
      },
    };
  });
}

export interface RechazarMisionPatrullaResult {
  mision: {
    id: string;
    codigo: string;
    estado: string;
    justificacionRechazo: string;
    actualizadoEn: string;
  };
  patrulla: {
    id: string;
    nombre: string;
    estado: string;
    delegacionId?: string | null;
    usuarioLiderId?: string | null;
  };
  incidente: {
    id: string;
    codigo: string;
    estado: string;
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  };
  hito: {
    id: string;
    hito: string;
    descripcion: string;
    creadoEn: string;
  };
}

/**
 * HU-69 - Transacción atómica para rechazar una misión asignada a una patrulla verificadora.
 *
 * 1. Valida existencia y estado DESPACHADA de la misión.
 * 2. Valida tipo de misión VERIFICACION y asignación de patrulla verificadora.
 * 3. Valida pertenencia del usuario a la patrulla verificadora asignada (salvo Administrador).
 * 4. En una sola transacción atómica:
 *    - Actualiza mision.estado = 'RECHAZADA', asigna justificacion_rechazo y fecha_cierre = CURRENT_TIMESTAMP.
 *    - Transiciona patrulla.estado = 'DISPONIBLE' siempre que se encuentre activa (no dada de baja lógica).
 *    - Revierte incidente.estado = 'REPORTADO' (si estaba en REPORTADO o VERIFICANDO) para permitir su reasignación inmediata.
 *    - Registra el hito cronológico en mision_hito con hito = 'RECHAZADA'.
 */
export async function rechazarMisionPatrullaRepo(
  misionId: string,
  usuarioId: string,
  justificacionRechazo: string,
  esAdmin: boolean,
  input?: { latitud?: number; longitud?: number }
): Promise<RechazarMisionPatrullaResult> {
  return await db.transaction().execute(async (trx) => {
    // 1. Consultar la misión con su patrulla e incidente asociado
    const misionExistente = await trx
      .selectFrom("mision")
      .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
      .leftJoin("usuario as lider", "lider.id", "patrulla_verificadora.usuario_lider_id")
      .leftJoin("rol as rol_lider", "rol_lider.id", "lider.rol_id")
      .leftJoin("incidente", "incidente.id", "mision.incidente_id")
      .select([
        "mision.id",
        "mision.codigo",
        "mision.estado",
        "mision.tipo_mision",
        "mision.cuadrilla_id",
        "mision.patrulla_id",
        "mision.incidente_id",
        "patrulla_verificadora.nombre as patrulla_nombre",
        "patrulla_verificadora.estado as patrulla_estado",
        "patrulla_verificadora.activo as patrulla_activo",
        "patrulla_verificadora.eliminado_en as patrulla_eliminado_en",
        "patrulla_verificadora.delegacion_id as patrulla_delegacion_id",
        "patrulla_verificadora.usuario_lider_id as patrulla_lider_id",
        "rol_lider.codigo as lider_rol_codigo",
        "rol_lider.nombre as lider_rol_nombre",
        "incidente.codigo as incidente_codigo",
        "incidente.estado as incidente_estado",
        "incidente.prioridad as incidente_prioridad",
      ])
      .where("mision.id", "=", misionId)
      .executeTakeFirst();

    if (!misionExistente) {
      throw new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.");
    }

    // 2. Validar que la misión sea de verificación y cuente con patrulla e incidente asociados válidos
    if (misionExistente.tipo_mision !== "VERIFICACION" || !misionExistente.patrulla_id) {
      throw new ConflictError(
        "Solo es posible rechazar por esta vía misiones de verificación asignadas a una patrulla verificadora."
      );
    }

    if (!misionExistente.incidente_id) {
      throw new ConflictError("La misión de verificación no tiene un incidente asociado válido.");
    }

    // 3. Validar pertenencia a la patrulla verificadora asignada (salvo Administrador)
    if (!esAdmin) {
      const esLiderDirecto = misionExistente.patrulla_lider_id === usuarioId;
      if (!esLiderDirecto) {
        const integrante = await trx
          .selectFrom("patrulla_personal")
          .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
          .select("patrulla_personal.id")
          .where("patrulla_personal.patrulla_id", "=", misionExistente.patrulla_id)
          .where("personal.usuario_id", "=", usuarioId)
          .executeTakeFirst();

        if (!integrante) {
          throw new ForbiddenError(
            "No está autorizado para rechazar una misión asignada a otra patrulla verificadora."
          );
        }
      }
    }

    // 4. Validar estado actual de la misión
    if (misionExistente.estado === "RECHAZADA") {
      throw new ConflictError("La misión ya ha sido rechazada previamente.");
    }

    if (misionExistente.estado !== "DESPACHADA") {
      throw new ConflictError(
        `La misión no se encuentra en estado 'DESPACHADA' para ser rechazada (estado actual: '${misionExistente.estado}').`
      );
    }

    // 5. Actualizar misión atómicamente con control de concurrencia
    const misionActualizada = await trx
      .updateTable("mision")
      .set({
        estado: "RECHAZADA",
        justificacion_rechazo: justificacionRechazo,
        fecha_cierre: sql`CURRENT_TIMESTAMP`,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", misionId)
      .where("estado", "=", "DESPACHADA")
      .returning([
        "id",
        "codigo",
        "estado",
        "justificacion_rechazo",
        "patrulla_id",
        "incidente_id",
        "actualizado_en",
      ])
      .executeTakeFirst();

    if (!misionActualizada) {
      throw new ConflictError(
        "La misión ya no se encuentra en estado 'DESPACHADA' debido a una actualización concurrente."
      );
    }

    // 6. Liberar patrulla verificadora pasando a estado 'DISPONIBLE' asegurando que esté activa
    let patrullaNombre = misionExistente.patrulla_nombre ?? "Patrulla Verificadora";
    let patrullaEstado = misionExistente.patrulla_estado ?? "DISPONIBLE";
    let patrullaDelegacionId = misionExistente.patrulla_delegacion_id ?? null;
    let patrullaLiderId = misionExistente.patrulla_lider_id ?? null;

    if (misionExistente.patrulla_activo && !misionExistente.patrulla_eliminado_en) {
      const patrullaRes = await trx
        .updateTable("patrulla_verificadora")
        .set({
          estado: "DISPONIBLE",
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", misionExistente.patrulla_id)
        .where("activo", "=", true)
        .where("eliminado_en", "is", null)
        .returning(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
        .executeTakeFirst();

      if (patrullaRes) {
        patrullaNombre = patrullaRes.nombre;
        patrullaEstado = patrullaRes.estado;
        patrullaDelegacionId = patrullaRes.delegacion_id;
        patrullaLiderId = patrullaRes.usuario_lider_id;
      }
    }

    // 7. Revertir incidente a estado 'REPORTADO' para permitir reasignación inmediata (siempre que esté REPORTADO o VERIFICANDO)
    let incidenteCodigo = misionExistente.incidente_codigo ?? "";
    let incidenteEstado = "REPORTADO";
    let incidentePrioridad = (misionExistente.incidente_prioridad ?? "MEDIA") as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

    const incidenteRes = await trx
      .updateTable("incidente")
      .set({
        estado: "REPORTADO",
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", misionExistente.incidente_id)
      .where("estado", "in", ["REPORTADO", "VERIFICANDO"])
      .returning(["id", "codigo", "estado", "prioridad"])
      .executeTakeFirst();

    if (incidenteRes) {
      incidenteCodigo = incidenteRes.codigo;
      incidenteEstado = incidenteRes.estado;
      if (incidenteRes.prioridad) {
        incidentePrioridad = incidenteRes.prioridad as "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
      }
    } else if (misionExistente.incidente_estado) {
      incidenteEstado = misionExistente.incidente_estado;
    }

    // 8. Registrar hito en mision_hito
    const hito = await trx
      .insertInto("mision_hito")
      .values({
        mision_id: misionId,
        hito: "RECHAZADA",
        descripcion: `Misión rechazada por patrulla: ${justificacionRechazo}`,
        registrado_por_id: usuarioId,
        latitud: input?.latitud != null ? String(input.latitud) : null,
        longitud: input?.longitud != null ? String(input.longitud) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      mision: {
        id: misionActualizada.id,
        codigo: misionActualizada.codigo,
        estado: misionActualizada.estado,
        justificacionRechazo: misionActualizada.justificacion_rechazo ?? justificacionRechazo,
        actualizadoEn: new Date(misionActualizada.actualizado_en).toISOString(),
      },
      patrulla: {
        id: misionExistente.patrulla_id,
        nombre: patrullaNombre,
        estado: patrullaEstado,
        delegacionId: patrullaDelegacionId,
        usuarioLiderId: patrullaLiderId,
      },
      incidente: {
        id: misionExistente.incidente_id,
        codigo: incidenteCodigo,
        estado: incidenteEstado,
        prioridad: incidentePrioridad,
      },
      hito: {
        id: hito.id,
        hito: hito.hito,
        descripcion: hito.descripcion,
        creadoEn: new Date(hito.creado_en).toISOString(),
      },
    };
  });
}


