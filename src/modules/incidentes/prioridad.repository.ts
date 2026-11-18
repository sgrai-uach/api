import { sql } from "kysely";
import { db } from "@/lib/db";
import type { PrioridadIncidente } from "@/lib/db/types";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";
import {
  calcularPrioridadSugerida,
  generarResumenTecnicoEvaluacion,
} from "./prioridad.utils";
import type {
  ActualizarPrioridadIncidenteInput,
  CalcularPrioridadInput,
  CalcularPrioridadResponse,
  ReporteEvaluacionTerrenoItem,
} from "./prioridad.schema";

export interface ActualizarPrioridadRepoResult {
  incidente: {
    id: string;
    codigo: string;
    estado: string;
    prioridad: PrioridadIncidente;
    prioridadSugerida: PrioridadIncidente;
    modificoPrioridadSugerida: boolean;
    justificacionPrioridad: string | null;
    requiereAsistenciaSocial: boolean;
    tipoIncidenteId: string | null;
    tipoAfectacion: string | null;
    actualizadoEn: string;
  };
  reporteTerreno: ReporteEvaluacionTerrenoItem;
  hito: {
    id: string;
    misionId: string;
    hito: string;
    descripcion: string;
    registradoPorId: string | null;
    creadoEn: string;
  };
  mision: {
    id: string;
    codigo: string;
    estado: string;
    tipoMision: string;
    patrullaId: string | null;
    fechaInicio: string | null;
  };
}

const CLAVES_EVALUACION_RAIZ = [
  "familias",
  "familiasAfectadas",
  "familias_afectadas",
  "nucleoFamiliarTotal",
  "nucleo_familiar_total",
  "personasAfectadas",
  "personas_afectadas",
  "cantidadNinos",
  "cantidad_ninos",
  "cantidadAdultosMayores",
  "cantidad_adultos_mayores",
  "personasDiscapacitadas",
  "personas_discapacitadas",
  "personasElectrodependientes",
  "personas_electrodependientes",
  "mascotasAfectadas",
  "mascotas_afectadas",
  "viviendasAfectadas",
  "viviendas_afectadas",
  "nivelCompromisoVivienda",
  "nivel_compromiso_vivienda",
  "requiereEvacuacion",
  "requiere_evacuacion",
  "requiereAsistenciaSocial",
  "requiere_asistencia_social",
  "riesgosActivos",
  "riesgos_activos",
  "riesgoElectrico",
  "riesgo_electrico",
  "riesgoEstructural",
  "riesgo_estructural",
  "riesgoQuimicoSanitario",
  "riesgo_quimico_sanitario",
  "aislamientoVial",
  "aislamiento_vial",
];

function contieneDatosEvaluacion(input: Record<string, unknown>): boolean {
  if (input.evaluacion && typeof input.evaluacion === "object") {
    return true;
  }
  return CLAVES_EVALUACION_RAIZ.some((clave) => input[clave] !== undefined);
}

export class PrioridadRepository {
  /**
   * Calcula la prioridad sugerida para un incidente a partir del formulario de terreno
   * y persiste preliminarmente `incidente.prioridad_sugerida`.
   */
  async calcularPrioridadPreliminar(
    incidenteId: string,
    input: CalcularPrioridadInput,
    usuarioId?: string,
    esAdmin = false
  ): Promise<CalcularPrioridadResponse["data"]> {
    const incidenteExistente = await db
      .selectFrom("incidente")
      .select(["id", "estado", "prioridad", "prioridad_sugerida"])
      .where("id", "=", incidenteId)
      .executeTakeFirst();

    if (!incidenteExistente) {
      throw new NotFoundError(
        "No se encontró ningún incidente con el identificador proporcionado."
      );
    }

    if (
      incidenteExistente.estado &&
      ["RESUELTO", "NO_ABORDABLE"].includes(incidenteExistente.estado.toUpperCase())
    ) {
      throw new ConflictError(
        `No se puede recalcular la prioridad de un incidente en estado '${incidenteExistente.estado}'.`
      );
    }

    if (usuarioId && !esAdmin) {
      const misionesVerif = await db
        .selectFrom("mision")
        .leftJoin(
          "patrulla_verificadora",
          "patrulla_verificadora.id",
          "mision.patrulla_id"
        )
        .select([
          "mision.id",
          "mision.estado",
          "mision.patrulla_id",
          "patrulla_verificadora.activo as patrulla_activo",
          "patrulla_verificadora.eliminado_en as patrulla_eliminado_en",
          "patrulla_verificadora.usuario_lider_id as patrulla_lider_id",
        ])
        .where("mision.incidente_id", "=", incidenteId)
        .where("mision.tipo_mision", "=", "VERIFICACION")
        .orderBy("mision.creado_en", "desc")
        .execute();

      const misionActiva =
        misionesVerif.find((m) => m.estado === "EN_CURSO") || misionesVerif[0];

      if (!misionActiva || !misionActiva.patrulla_id) {
        throw new ConflictError(
          "No existe una misión de verificación con patrulla asignada para este incidente."
        );
      }

      if (
        misionActiva.patrulla_activo === false ||
        (misionActiva.patrulla_eliminado_en !== undefined &&
          misionActiva.patrulla_eliminado_en !== null)
      ) {
        throw new ConflictError(
          "La patrulla verificadora asignada a la misión ha sido desactivada o dada de baja."
        );
      }

      if (misionActiva.patrulla_lider_id !== usuarioId) {
        const integrante = await db
          .selectFrom("patrulla_personal")
          .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
          .select("patrulla_personal.id")
          .where("patrulla_personal.patrulla_id", "=", misionActiva.patrulla_id)
          .where("personal.usuario_id", "=", usuarioId)
          .executeTakeFirst();

        if (!integrante) {
          throw new ForbiddenError(
            "No está autorizado para evaluar la prioridad de un incidente asignado a otra patrulla verificadora."
          );
        }
      }
    }

    const rawObj = input as unknown as Record<string, unknown>;
    const fuenteEval = (
      input.evaluacion && typeof input.evaluacion === "object"
        ? { ...rawObj, ...(input.evaluacion as Record<string, unknown>) }
        : rawObj
    ) as Record<string, unknown>;
    const calculo = calcularPrioridadSugerida(fuenteEval);

    await db
      .updateTable("incidente")
      .set({
        prioridad_sugerida: calculo.prioridadSugerida,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", incidenteId)
      .execute();

    return {
      incidenteId: incidenteExistente.id,
      prioridadActual: (incidenteExistente.prioridad as PrioridadIncidente) ?? "MEDIA",
      prioridadSugerida: calculo.prioridadSugerida,
      puntajeTotal: calculo.puntajeTotal,
      factoresGatillantes: calculo.factoresGatillantes,
      requiereAsistenciaSocialSugerido: calculo.requiereAsistenciaSocialSugerido,
      evaluacionNormalizada: calculo.evaluacionNormalizada,
    };
  }

  /**
   * Ejecuta dentro de una transacción atómica (HU-38):
   * 1. Validación de existencia del incidente y misión activa (`EN_CURSO`).
   * 2. Validación de pertenencia a la patrulla verificadora asignada (salvo Administrador).
   * 3. Cálculo autoritativo de `prioridad_sugerida` y validación de `justificacion_prioridad` (>= 5 caracteres si hay discrepancia).
   * 4. Cálculo del número correlativo de versión del reporte (`version_reporte = N + 1`) e inserción de un nuevo registro en `reporte_terreno`.
   * 5. Actualización de `incidente.prioridad`, `incidente.prioridad_sugerida`, `incidente.justificacion_prioridad` y `mision.prioridad`.
   * 6. Registro del hito en `mision_hito` (`PRIORIDAD_ASIGNADA` o `PRIORIDAD_RECTIFICADA`).
   */
  async actualizarPrioridadIncidente(
    incidenteId: string,
    usuarioId: string,
    esAdmin: boolean,
    input: ActualizarPrioridadIncidenteInput
  ): Promise<ActualizarPrioridadRepoResult> {
    const prioridadAsignada = (input.prioridad ??
      input.prioridadAsignada ??
      input.prioridad_asignada) as PrioridadIncidente;
    const misionIdFiltro = input.misionId || input.mision_id;

    return await db.transaction().execute(async (trx) => {
      // 1. Verificar existencia del incidente y bloquear fila
      const incidenteExistente = await trx
        .selectFrom("incidente")
        .select([
          "id",
          "codigo",
          "estado",
          "prioridad",
          "prioridad_sugerida",
          "justificacion_prioridad",
          "requiere_asistencia_social",
          "tipo_incidente_id",
          "tipo_afectacion",
        ])
        .where("id", "=", incidenteId)
        .forUpdate()
        .executeTakeFirst();

      if (!incidenteExistente) {
        throw new NotFoundError(
          "No se encontró ningún incidente con el identificador proporcionado."
        );
      }

      if (
        incidenteExistente.estado &&
        ["RESUELTO", "NO_ABORDABLE"].includes(incidenteExistente.estado.toUpperCase())
      ) {
        throw new ConflictError(
          `El incidente se encuentra en estado '${incidenteExistente.estado}'. No se puede modificar su prioridad en terreno.`
        );
      }

      // 2. Buscar misión de verificación asociada al incidente y bloquear fila de mision
      let queryMision = trx
        .selectFrom("mision")
        .leftJoin(
          "patrulla_verificadora",
          "patrulla_verificadora.id",
          "mision.patrulla_id"
        )
        .select([
          "mision.id",
          "mision.codigo",
          "mision.estado",
          "mision.tipo_mision",
          "mision.patrulla_id",
          "mision.fecha_inicio",
          "patrulla_verificadora.activo as patrulla_activo",
          "patrulla_verificadora.eliminado_en as patrulla_eliminado_en",
          "patrulla_verificadora.usuario_lider_id as patrulla_lider_id",
        ])
        .where("mision.incidente_id", "=", incidenteId)
        .where("mision.tipo_mision", "=", "VERIFICACION");

      if (misionIdFiltro) {
        queryMision = queryMision.where("mision.id", "=", misionIdFiltro);
      }

      const misiones = await queryMision
        .orderBy("mision.creado_en", "desc")
        .forUpdate("mision")
        .execute();

      if (misiones.length === 0) {
        if (misionIdFiltro) {
          throw new NotFoundError(
            "La misión especificada no se encuentra asociada a este incidente."
          );
        }
        throw new ConflictError(
          "No existe una misión de verificación asociada a este incidente para registrar la evaluación de prioridad en terreno."
        );
      }

      const misionEnCurso = misiones.find((m) => m.estado === "EN_CURSO");
      const misionSeleccionada = misionEnCurso || misiones[0];

      if (misionSeleccionada.estado !== "EN_CURSO") {
        if (misionSeleccionada.estado === "DESPACHADA") {
          throw new ConflictError(
            "La patrulla debe aceptar la misión asignada antes de poder asignar o modificar la prioridad del incidente en terreno."
          );
        }
        throw new ConflictError(
          `La misión se encuentra en estado '${misionSeleccionada.estado}'. Solo se puede evaluar la prioridad en misiones aceptadas y en curso.`
        );
      }

      if (!misionSeleccionada.patrulla_id) {
        throw new ConflictError(
          "La misión de verificación no tiene una patrulla verificadora asignada."
        );
      }

      if (
        misionSeleccionada.patrulla_activo === false ||
        (misionSeleccionada.patrulla_eliminado_en !== undefined &&
          misionSeleccionada.patrulla_eliminado_en !== null)
      ) {
        throw new ConflictError(
          "La patrulla verificadora asignada a la misión ha sido desactivada o dada de baja."
        );
      }

      // 3. Validar pertenencia del usuario a la patrulla verificadora asignada (salvo Administrador)
      if (!esAdmin) {
        const esLider = misionSeleccionada.patrulla_lider_id === usuarioId;
        if (!esLider) {
          const integrante = await trx
            .selectFrom("patrulla_personal")
            .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
            .select("patrulla_personal.id")
            .where(
              "patrulla_personal.patrulla_id",
              "=",
              misionSeleccionada.patrulla_id
            )
            .where("personal.usuario_id", "=", usuarioId)
            .executeTakeFirst();

          if (!integrante) {
            throw new ForbiddenError(
              "No está autorizado para evaluar o modificar la prioridad de un incidente asignado a otra patrulla verificadora."
            );
          }
        }
      }

      // 4. Calcular prioridad sugerida autoritativamente y normalizar evaluación de terreno
      const rawObj = input as unknown as Record<string, unknown>;
      const fuenteEval = (
        input.evaluacion && typeof input.evaluacion === "object"
          ? { ...rawObj, ...(input.evaluacion as Record<string, unknown>) }
          : rawObj
      ) as Record<string, unknown>;

      const calculo = calcularPrioridadSugerida(fuenteEval);
      const envioDatosEvaluacion = contieneDatosEvaluacion(rawObj);
      const prioridadSugeridaExplicita = (input.prioridadSugerida ??
        input.prioridad_sugerida) as PrioridadIncidente | undefined;

      const prioridadSugerida: PrioridadIncidente = envioDatosEvaluacion
        ? calculo.prioridadSugerida
        : ((incidenteExistente.prioridad_sugerida ??
            prioridadSugeridaExplicita ??
            incidenteExistente.prioridad ??
            "MEDIA") as PrioridadIncidente);

      // 5. Validar obligatoriedad de justificación cuando difiere de la prioridad sugerida
      const justificacionRaw =
        input.justificacionPrioridad ??
        input.justificacion_prioridad ??
        input.justificacion;
      const justificacionLimpia =
        typeof justificacionRaw === "string" && justificacionRaw.trim().length > 0
          ? justificacionRaw.trim()
          : null;

      const modificoPrioridadSugerida = prioridadAsignada !== prioridadSugerida;

      if (
        modificoPrioridadSugerida &&
        (!justificacionLimpia || justificacionLimpia.length < 5)
      ) {
        throw new BadRequestError(
          "Debe ingresar una justificación técnica de al menos 5 caracteres cuando modifica la prioridad sugerida por el sistema."
        );
      }

      // 6. Determinar el número de versión del reporte de evaluación para esta misión
      const resMaxVersion = await trx
        .selectFrom("reporte_terreno")
        .select(sql<number>`coalesce(max(version_reporte), 0)::int`.as("max_version"))
        .where("mision_id", "=", misionSeleccionada.id)
        .executeTakeFirst();

      const versionReporte = Number(resMaxVersion?.max_version ?? 0) + 1;

      const usr = await trx
        .selectFrom("usuario")
        .select(["nombre", "email", "rut"])
        .where("id", "=", usuarioId)
        .executeTakeFirst();

      const evaluadorNombre = usr?.nombre ?? "Patrullero en Terreno";
      const evaluadorEmail = usr?.email ?? "patrulla@valdivia.cl";
      const evaluadorRut: string | null = usr?.rut ?? null;
      const esRectificacion = versionReporte > 1;
      const etiquetaReporte = esRectificacion
        ? `Reporte de Evaluación #${versionReporte} (Rectificación)`
        : `Reporte de Evaluación #1 (Inicial)`;

      const ev = calculo.evaluacionNormalizada;
      const resumenTecnicoFinal =
        (typeof input.resumenTecnico === "string" && input.resumenTecnico.trim()) ||
        (typeof input.resumen_tecnico === "string" && input.resumen_tecnico.trim()) ||
        generarResumenTecnicoEvaluacion(
          versionReporte,
          ev,
          prioridadSugerida,
          prioridadAsignada
        );

      const detallesEvaluacionPayload: Record<string, unknown> = {
        ...ev,
        versionReporte,
        esRectificacion,
        prioridadSugerida,
        prioridadAsignada,
        modificoPrioridadSugerida,
        justificacionPrioridad: justificacionLimpia,
        puntajeTotal: calculo.puntajeTotal,
        factoresGatillantes: calculo.factoresGatillantes,
      };

      // 7. Insertar el nuevo reporte versionado en reporte_terreno (siempre crea un registro distinto)
      const reporteInsertado = (await trx
        .insertInto("reporte_terreno")
        .values({
          mision_id: misionSeleccionada.id,
          evaluador_id: usuarioId,
          version_reporte: versionReporte,
          es_rectificacion: esRectificacion,
          prioridad_sugerida: prioridadSugerida,
          prioridad_asignada: prioridadAsignada,
          justificacion_prioridad: justificacionLimpia,
          resumen_tecnico: resumenTecnicoFinal,
          acciones_realizadas: ev.accionesRealizadas,
          requiere_apoyo_adicional: ev.requiereApoyoAdicional,
          danos_estimados: ev.danosEstimados,
          observaciones: ev.detallesAdicionales,
          personas_afectadas: ev.nucleoFamiliarTotal,
          estado_terreno: "EN_VERIFICACION",
          detalles_evaluacion: JSON.stringify(detallesEvaluacionPayload),
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as {
        id: string;
        mision_id: string;
        version_reporte?: number;
        es_rectificacion?: boolean;
        prioridad_sugerida?: string | null;
        prioridad_asignada?: string | null;
        justificacion_prioridad?: string | null;
        resumen_tecnico: string;
        personas_afectadas: number;
        requiere_apoyo_adicional: boolean;
        observaciones: string | null;
        acciones_realizadas: string | null;
        danos_estimados: string | null;
        detalles_evaluacion?: Record<string, unknown> | string;
        creado_en: Date | string;
      };

      // 8. Actualizar incidente atómicamente (prioridad, prioridad_sugerida, justificacion_prioridad, requiere_asistencia_social)
      const requiereAsistenciaSocialFinal =
        input.requiereAsistenciaSocial !== undefined ||
        input.requiere_asistencia_social !== undefined
          ? ev.requiereAsistenciaSocial
          : Boolean(
              incidenteExistente.requiere_asistencia_social ||
                calculo.requiereAsistenciaSocialSugerido
            );

      const incidenteActualizado = await trx
        .updateTable("incidente")
        .set({
          prioridad: prioridadAsignada,
          prioridad_sugerida: prioridadSugerida,
          justificacion_prioridad: justificacionLimpia,
          requiere_asistencia_social: requiereAsistenciaSocialFinal,
          estado: sql`CASE WHEN estado = 'REPORTADO' THEN 'VERIFICANDO' ELSE estado END`,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", incidenteId)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 9. Sincronizar prioridad táctica en la misión asociada
      await trx
        .updateTable("mision")
        .set({
          prioridad: prioridadAsignada,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", misionSeleccionada.id)
        .execute();

      // 10. Registrar el hito de cambio/confirmación de prioridad en mision_hito
      const codigoHito = esRectificacion
        ? "PRIORIDAD_RECTIFICADA"
        : "PRIORIDAD_ASIGNADA";

      const prioridadPrevia = incidenteExistente.prioridad ?? "MEDIA";
      const sufijoJustificacion = justificacionLimpia
        ? ` Justificación: ${justificacionLimpia}`
        : " Confirmada conforme a prioridad sugerida por el sistema.";

      const descripcionHito = esRectificacion
        ? `Reporte de evaluación #${versionReporte} (Rectificación): Prioridad actualizada en terreno de ${prioridadPrevia} a ${prioridadAsignada} (Sugerida: ${prioridadSugerida}).${sufijoJustificacion}`
        : `Reporte de evaluación #1: Prioridad asignada en terreno a ${prioridadAsignada} (Sugerida: ${prioridadSugerida}).${sufijoJustificacion}`;

      const hitoRegistrado = await trx
        .insertInto("mision_hito")
        .values({
          mision_id: misionSeleccionada.id,
          hito: codigoHito,
          descripcion: descripcionHito,
          registrado_por_id: usuarioId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const actualizadoEnIso = incidenteActualizado.actualizado_en
        ? new Date(incidenteActualizado.actualizado_en).toISOString()
        : new Date().toISOString();

      const hitoCreadoEnIso = hitoRegistrado.creado_en
        ? new Date(hitoRegistrado.creado_en).toISOString()
        : new Date().toISOString();

      const reporteCreadoEnIso = reporteInsertado.creado_en
        ? new Date(reporteInsertado.creado_en).toISOString()
        : actualizadoEnIso;

      return {
        incidente: {
          id: incidenteActualizado.id,
          codigo: incidenteActualizado.codigo,
          estado: incidenteActualizado.estado,
          prioridad: (incidenteActualizado.prioridad as PrioridadIncidente) ?? prioridadAsignada,
          prioridadSugerida:
            (incidenteActualizado.prioridad_sugerida as PrioridadIncidente) ??
            prioridadSugerida,
          modificoPrioridadSugerida,
          justificacionPrioridad:
            incidenteActualizado.justificacion_prioridad !== undefined
              ? incidenteActualizado.justificacion_prioridad
              : justificacionLimpia,
          requiereAsistenciaSocial: Boolean(
            incidenteActualizado.requiere_asistencia_social ??
              requiereAsistenciaSocialFinal
          ),
          tipoIncidenteId: incidenteActualizado.tipo_incidente_id ?? null,
          tipoAfectacion: incidenteActualizado.tipo_afectacion ?? null,
          actualizadoEn: actualizadoEnIso,
        },
        reporteTerreno: {
          id: reporteInsertado.id,
          misionId: misionSeleccionada.id,
          versionReporte,
          esRectificacion,
          etiquetaReporte,
          prioridadSugerida,
          prioridadAsignada,
          justificacionPrioridad: justificacionLimpia,
          resumenTecnico: reporteInsertado.resumen_tecnico ?? resumenTecnicoFinal,
          personasAfectadas: Number(
            reporteInsertado.personas_afectadas ?? ev.nucleoFamiliarTotal
          ),
          requiereApoyoAdicional: Boolean(
            reporteInsertado.requiere_apoyo_adicional ?? ev.requiereApoyoAdicional
          ),
          detallesAdicionales: reporteInsertado.observaciones ?? ev.detallesAdicionales,
          accionesRealizadas:
            reporteInsertado.acciones_realizadas ?? ev.accionesRealizadas,
          danosEstimados: reporteInsertado.danos_estimados ?? ev.danosEstimados,
          evaluacion: detallesEvaluacionPayload,
          evaluador: {
            id: usuarioId,
            nombre: evaluadorNombre,
            email: evaluadorEmail,
            rut: evaluadorRut,
          },
          creadoEn: reporteCreadoEnIso,
        },
        hito: {
          id: hitoRegistrado.id,
          misionId: hitoRegistrado.mision_id,
          hito: hitoRegistrado.hito,
          descripcion: hitoRegistrado.descripcion,
          registradoPorId: hitoRegistrado.registrado_por_id,
          creadoEn: hitoCreadoEnIso,
        },
        mision: {
          id: misionSeleccionada.id,
          codigo: misionSeleccionada.codigo,
          estado: misionSeleccionada.estado,
          tipoMision: misionSeleccionada.tipo_mision ?? "VERIFICACION",
          patrullaId: misionSeleccionada.patrulla_id,
          fechaInicio: misionSeleccionada.fecha_inicio
            ? new Date(misionSeleccionada.fecha_inicio).toISOString()
            : null,
        },
      };
    });
  }
}

export const prioridadRepository = new PrioridadRepository();


