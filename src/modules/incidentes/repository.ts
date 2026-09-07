import { sql } from "kysely";
import { db } from "../../lib/db";
import type { CrearAvisoInput, VerificarAvisoInput } from "./schema";

export class IncidentesRepository {
  /**
   * Inserta un nuevo aviso generado por un informante.
   */
  async insertarAviso(input: CrearAvisoInput) {
    const res = await db
      .insertInto("aviso_incidente")
      .values({
        descripcion: input.descripcion,
        latitud: input.latitud,
        longitud: input.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${input.longitud}, ${input.latitud}), 4326)`,
        tipo_preliminar_id: input.tipoPreliminarId || null,
        origen_reporte: input.origenReporte,
        datos_informante: input.datosInformante || {},
        estado: "NO_VERIFICADO",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return res;
  }

  /**
   * Obtiene la lista paginada de avisos ordenados por fecha de creación ascendente
   * (destacando los que llevan más tiempo esperando revisión).
   */
  async obtenerAvisosPaginados(page: number, limit: number, estado: string) {
    const offset = (page - 1) * limit;

    const baseQuery = db
      .selectFrom("aviso_incidente")
      .where("aviso_incidente.estado", "=", estado as "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO");

    // Conteo total de registros con el filtro dado
    const totalResult = await baseQuery
      .select(sql<string | number>`count(*)`.as("count"))
      .executeTakeFirst();

    const total = Number(totalResult?.count || 0);

    // Consulta de datos con join al catálogo tipo_incidente
    const rows = await db
      .selectFrom("aviso_incidente")
      .leftJoin("tipo_incidente", "tipo_incidente.id", "aviso_incidente.tipo_preliminar_id")
      .where("aviso_incidente.estado", "=", estado as "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO")
      .select([
        "aviso_incidente.id",
        "aviso_incidente.tipo_preliminar_id as tipoPreliminarId",
        "tipo_incidente.nombre as tipoPreliminarNombre",
        "aviso_incidente.descripcion",
        "aviso_incidente.latitud",
        "aviso_incidente.longitud",
        "aviso_incidente.origen_reporte as origenReporte",
        "aviso_incidente.estado",
        "aviso_incidente.motivo_descarte as motivoDescarte",
        "aviso_incidente.operador_id as operadorId",
        "aviso_incidente.incidente_id as incidenteId",
        "aviso_incidente.creado_en as creadoEn",
        "aviso_incidente.actualizado_en as actualizadoEn",
      ])
      .orderBy("aviso_incidente.creado_en", "asc")
      .limit(limit)
      .offset(offset)
      .execute();

    return { rows, total };
  }

  /**
   * Obtiene el detalle completo de un aviso por su UUID, incluyendo adjuntos.
   */
  async obtenerAvisoPorId(id: string) {
    const aviso = await db
      .selectFrom("aviso_incidente")
      .leftJoin("tipo_incidente", "tipo_incidente.id", "aviso_incidente.tipo_preliminar_id")
      .where("aviso_incidente.id", "=", id)
      .select([
        "aviso_incidente.id",
        "aviso_incidente.tipo_preliminar_id as tipoPreliminarId",
        "tipo_incidente.nombre as tipoPreliminarNombre",
        "aviso_incidente.descripcion",
        "aviso_incidente.latitud",
        "aviso_incidente.longitud",
        "aviso_incidente.datos_informante as datosInformante",
        "aviso_incidente.origen_reporte as origenReporte",
        "aviso_incidente.estado",
        "aviso_incidente.motivo_descarte as motivoDescarte",
        "aviso_incidente.operador_id as operadorId",
        "aviso_incidente.incidente_id as incidenteId",
        "aviso_incidente.creado_en as creadoEn",
        "aviso_incidente.actualizado_en as actualizadoEn",
      ])
      .executeTakeFirst();

    if (!aviso) return null;

    const adjuntos = await db
      .selectFrom("adjunto")
      .where("aviso_id", "=", id)
      .select([
        "id",
        "nombre_archivo as nombreArchivo",
        "url",
        "tipo_mime as tipoMime",
        "tamano_bytes as tamanoBytes",
        "creado_en as creadoEn",
      ])
      .execute();

    return {
      ...aviso,
      adjuntos,
    };
  }

  /**
   * Transacción atómica PostgreSQL: Transforma un aviso en incidente formal.
   * Utiliza FOR UPDATE para garantizar exclusión mutua frente a operadores concurrentes.
   */
  async verificarYCrearIncidenteTrx(
    avisoId: string,
    input: VerificarAvisoInput,
    operadorId: string
  ) {
    return await db.transaction().execute(async (trx) => {
      // 1. Bloqueo pesimista de fila
      const aviso = await trx
        .selectFrom("aviso_incidente")
        .where("id", "=", avisoId)
        .selectAll()
        .forUpdate()
        .executeTakeFirst();

      if (!aviso) {
        throw new Error("AVISO_NOT_FOUND");
      }

      if (aviso.estado !== "NO_VERIFICADO") {
        throw new Error("AVISO_ALREADY_PROCESSED");
      }

      // 2. Generar folio único (ej: INC-2026-XXXX)
      const countResult = await trx
        .selectFrom("incidente")
        .select(sql<string | number>`count(*)`.as("count"))
        .executeTakeFirst();

      const nextNumber = Number(countResult?.count || 0) + 1;
      const year = new Date().getFullYear();
      const folio = `INC-${year}-${String(nextNumber).padStart(4, "0")}`;

      // 3. Crear registro formal en la tabla incidente
      const descripcionFinal = input.descripcion || aviso.descripcion;
      const nuevoIncidente = await trx
        .insertInto("incidente")
        .values({
          folio,
          tipo_incidente_id: input.tipoIncidenteId,
          estado: "Reportado", // Estado inicial ICS
          descripcion: descripcionFinal,
          latitud: Number(aviso.latitud),
          longitud: Number(aviso.longitud),
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${Number(aviso.longitud)}, ${Number(aviso.latitud)}), 4326)`,
          requiere_asistencia_social: input.requiereAsistenciaSocial,
          aviso_id: avisoId,
          creado_por_id: operadorId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. Actualizar aviso a estado VERIFICADO
      const avisoActualizado = await trx
        .updateTable("aviso_incidente")
        .set({
          estado: "VERIFICADO",
          incidente_id: nuevoIncidente.id,
          operador_id: operadorId,
          actualizado_en: new Date(),
        })
        .where("id", "=", avisoId)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Vincular los adjuntos existentes del aviso al nuevo incidente
      await trx
        .updateTable("adjunto")
        .set({ incidente_id: nuevoIncidente.id })
        .where("aviso_id", "=", avisoId)
        .execute();

      return {
        aviso: avisoActualizado,
        incidente: nuevoIncidente,
      };
    });
  }

  /**
   * Descarta un aviso con justificación obligatoria.
   */
  async descartarAviso(avisoId: string, motivoDescarte: string, operadorId: string) {
    return await db.transaction().execute(async (trx) => {
      const aviso = await trx
        .selectFrom("aviso_incidente")
        .where("id", "=", avisoId)
        .selectAll()
        .forUpdate()
        .executeTakeFirst();

      if (!aviso) {
        throw new Error("AVISO_NOT_FOUND");
      }

      if (aviso.estado !== "NO_VERIFICADO") {
        throw new Error("AVISO_ALREADY_PROCESSED");
      }

      const actualizado = await trx
        .updateTable("aviso_incidente")
        .set({
          estado: "DESCARTADO",
          motivo_descarte: motivoDescarte,
          operador_id: operadorId,
          actualizado_en: new Date(),
        })
        .where("id", "=", avisoId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return actualizado;
    });
  }
}

export const incidentesRepository = new IncidentesRepository();
