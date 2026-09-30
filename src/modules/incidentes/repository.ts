import { sql } from "kysely";
import { db } from "../../lib/db";
import type {
  CrearAvisoInput,
  ListarAvisosQuery,
  VerificarAvisoInput,
} from "./schema";

export class IncidentesRepository {
  /**
   * Inserta un nuevo aviso generado por un informante o chatbot.
   */
  async insertarAviso(input: CrearAvisoInput) {
    const codigoSeguimiento = Math.floor(10000000 + Math.random() * 90000000).toString();
    const tipoAfectacion = input.tipoAfectacion || "Anegamiento";
    const direccionTexto = input.direccion || input.datosInformante?.direccionAproximada || "Valdivia";
    const informanteNombre = input.informanteNombre || input.datosInformante?.nombre || "Vecino Valdivia";
    const informanteRut = input.informanteRut || input.datosInformante?.rut || "11111111-1";
    const informanteTelefono = input.informanteTelefono || input.datosInformante?.telefono || null;

    const res = await db
      .insertInto("aviso_incidente")
      .values({
        codigo_seguimiento: codigoSeguimiento,
        tipo_afectacion: tipoAfectacion,
        direccion_texto: direccionTexto,
        descripcion: input.descripcion || null,
        latitud: input.latitud,
        longitud: input.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${input.longitud}, ${input.latitud}), 4326)`,
        informante_nombre: informanteNombre,
        informante_rut: informanteRut,
        informante_telefono: informanteTelefono,
        origen_reporte: input.origenReporte || "WEB",
        estado: "PENDIENTE_VERIFICACION",
        es_duplicado: false,
        aviso_original_id: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return res;
  }

  /**
   * Obtiene la lista paginada de avisos ordenados por mayor tiempo de espera
   * aplicando filtros multicriterio (delegación, estado, búsqueda y canal de origen).
   */
  async obtenerAvisosPaginados(
    filtrosOrPage: ListarAvisosQuery | number,
    limitParam?: number,
    estadoParam?: string
  ) {
    const filtros: ListarAvisosQuery =
      typeof filtrosOrPage === "number"
        ? {
            page: filtrosOrPage,
            limit: limitParam || 20,
            estado: (estadoParam as any) || "NO_VERIFICADO",
          }
        : filtrosOrPage;

    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;
    const estado = filtros.estado;
    const delegacion = filtros.delegacion;
    const terminoBusqueda = filtros.busqueda || filtros.q;
    const origen = filtros.origen;

    let baseQuery = db
      .selectFrom("aviso_incidente as a")
      .leftJoin("delegacion as d", "a.delegacion_id", "d.id");

    // 1. Filtro condicional por Estado
    if (estado && estado !== "TODOS") {
      if (estado === "NO_VERIFICADO") {
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb("a.estado", "=", "NO_VERIFICADO"),
            eb("a.estado", "=", "PENDIENTE_VERIFICACION"),
          ])
        );
      } else {
        baseQuery = baseQuery.where("a.estado", "=", estado);
      }
    }

    // 2. Filtro condicional por Delegación Territorial
    if (delegacion && delegacion !== "TODAS") {
      const normDelegacion = delegacion.toLowerCase();
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb("d.nombre", "=", delegacion),
          eb(sql`LOWER(d.nombre)`, "like", `%${normDelegacion}%`),
          eb("a.delegacion_manual", "=", delegacion),
          eb(sql`LOWER(a.delegacion_manual)`, "like", `%${normDelegacion}%`),
        ])
      );
    }

    // 3. Filtro condicional por Canal de Origen
    if (origen) {
      baseQuery = baseQuery.where("a.origen_reporte", "=", origen);
    }

    // 4. Filtro condicional por Búsqueda Textual (q / busqueda)
    if (terminoBusqueda && terminoBusqueda.trim() !== "") {
      const pattern = `%${terminoBusqueda.trim().toLowerCase()}%`;
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb(sql`LOWER(a.descripcion)`, "like", pattern),
          eb(sql`LOWER(a.direccion_texto)`, "like", pattern),
          eb(sql`LOWER(a.informante_nombre)`, "like", pattern),
          eb(sql`LOWER(a.codigo_seguimiento)`, "like", pattern),
        ])
      );
    }

    // Conteo total coherente con los mismos filtros
    const totalResult = await baseQuery
      .select(sql<number>`count(a.id)::int`.as("total"))
      .executeTakeFirst();

    const total = Number(totalResult?.total || 0);

    // Consulta de registros ordenados por antigüedad (creado_en asc = mayor tiempo de espera)
    const rows = await baseQuery
      .select([
        "a.id",
        "a.codigo_seguimiento as codigoSeguimiento",
        "a.tipo_afectacion as tipoAfectacion",
        "a.tipo_afectacion as tipoPreliminarNombre",
        "a.direccion_texto as direccionTexto",
        "a.descripcion",
        "a.latitud",
        "a.longitud",
        "a.informante_nombre as informanteNombre",
        "a.informante_rut as informanteRut",
        "a.informante_telefono as informanteTelefono",
        "a.origen_reporte as origenReporte",
        "a.estado",
        "a.es_duplicado as esDuplicado",
        "a.aviso_original_id as avisoOriginalId",
        "a.motivo_descarte as motivoDescarte",
        "a.operador_id as operadorId",
        "a.incidente_id as incidenteId",
        "a.creado_en as creadoEn",
        "a.actualizado_en as actualizadoEn",
        // Delegación canónica resuelta
        sql<string | null>`
          CASE
            WHEN COALESCE(d.nombre, a.delegacion_manual) ILIKE '%norte%' THEN 'Norte'
            WHEN COALESCE(d.nombre, a.delegacion_manual) ILIKE '%sur%' THEN 'Sur'
            WHEN COALESCE(d.nombre, a.delegacion_manual) ILIKE '%costa%' THEN 'Costa'
            WHEN COALESCE(d.nombre, a.delegacion_manual) ILIKE '%calle%calle%' THEN 'Calle Calle'
            ELSE COALESCE(d.nombre, a.delegacion_manual)
          END
        `.as("delegacionNombre"),
      ])
      .orderBy("a.creado_en", "asc")
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
      .leftJoin("delegacion as d", "aviso_incidente.delegacion_id", "d.id")
      .where("aviso_incidente.id", "=", id)
      .select([
        "aviso_incidente.id",
        "aviso_incidente.codigo_seguimiento as codigoSeguimiento",
        "aviso_incidente.tipo_afectacion as tipoAfectacion",
        "aviso_incidente.tipo_afectacion as tipoPreliminarNombre",
        "aviso_incidente.direccion_texto as direccionTexto",
        "aviso_incidente.descripcion",
        "aviso_incidente.latitud",
        "aviso_incidente.longitud",
        "aviso_incidente.informante_nombre as informanteNombre",
        "aviso_incidente.informante_rut as informanteRut",
        "aviso_incidente.informante_telefono as informanteTelefono",
        "aviso_incidente.origen_reporte as origenReporte",
        "aviso_incidente.estado",
        "aviso_incidente.es_duplicado as esDuplicado",
        "aviso_incidente.aviso_original_id as avisoOriginalId",
        "aviso_incidente.motivo_descarte as motivoDescarte",
        "aviso_incidente.operador_id as operadorId",
        "aviso_incidente.incidente_id as incidenteId",
        "aviso_incidente.creado_en as creadoEn",
        "aviso_incidente.actualizado_en as actualizadoEn",
        sql<string | null>`
          CASE
            WHEN COALESCE(d.nombre, aviso_incidente.delegacion_manual) ILIKE '%norte%' THEN 'Norte'
            WHEN COALESCE(d.nombre, aviso_incidente.delegacion_manual) ILIKE '%sur%' THEN 'Sur'
            WHEN COALESCE(d.nombre, aviso_incidente.delegacion_manual) ILIKE '%costa%' THEN 'Costa'
            WHEN COALESCE(d.nombre, aviso_incidente.delegacion_manual) ILIKE '%calle%calle%' THEN 'Calle Calle'
            ELSE COALESCE(d.nombre, aviso_incidente.delegacion_manual)
          END
        `.as("delegacionNombre"),
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
      datosInformante: {
        nombre: aviso.informanteNombre,
        rut: aviso.informanteRut,
        telefono: aviso.informanteTelefono || "",
        direccionAproximada: aviso.direccionTexto,
      },
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

      if (aviso.estado !== "PENDIENTE_VERIFICACION") {
        throw new Error("AVISO_ALREADY_PROCESSED");
      }

      // 2. Resolver operadorId seguro (respetando clave foránea en tabla usuario)
      let operadorValidoId: string | null = null;
      if (operadorId) {
        const existeUsuario = await trx
          .selectFrom("usuario")
          .select("id")
          .where("id", "=", operadorId)
          .executeTakeFirst();
        if (existeUsuario) {
          operadorValidoId = existeUsuario.id;
        } else {
          const userDefault = await trx
            .selectFrom("usuario")
            .select("id")
            .where("rol_id", "=", "20000000-0000-4000-8000-000000000002")
            .limit(1)
            .executeTakeFirst();
          operadorValidoId = userDefault?.id ?? null;
        }
      }

      // 3. Resolver tipoIncidenteId seguro (respetando clave foránea en tabla tipo_incidente)
      let tipoIncidenteValidoId: string | null = null;
      if (input.tipoIncidenteId) {
        const existeTipo = await trx
          .selectFrom("tipo_incidente")
          .select("id")
          .where("id", "=", input.tipoIncidenteId)
          .executeTakeFirst();
        if (existeTipo) {
          tipoIncidenteValidoId = existeTipo.id;
        } else {
          const tipoCoincidente = await trx
            .selectFrom("tipo_incidente")
            .select("id")
            .where((eb) =>
              eb.or([
                eb("nombre", "ilike", `%${aviso.tipo_afectacion}%`),
                eb("activo", "=", true),
              ])
            )
            .limit(1)
            .executeTakeFirst();
          tipoIncidenteValidoId = tipoCoincidente?.id ?? null;
        }
      }

      // 4. Generar folio y código único garantizado
      const year = new Date().getFullYear();
      let folio = "";
      let codigo = "";
      let colision = true;
      while (colision) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        folio = `INC-${year}-${randomNum}`;
        codigo = folio;
        const existe = await trx
          .selectFrom("incidente")
          .select("id")
          .where((eb) => eb.or([eb("codigo", "=", codigo), eb("folio", "=", folio)]))
          .executeTakeFirst();
        if (!existe) {
          colision = false;
        }
      }

      // 5. Crear registro formal en la tabla incidente
      const descripcionFinal = input.descripcion || aviso.descripcion || aviso.tipo_afectacion;
      const nuevoIncidente = await trx
        .insertInto("incidente")
        .values({
          folio,
          codigo,
          codigo_seguimiento: aviso.codigo_seguimiento,
          tipo_incidente_id: tipoIncidenteValidoId,
          tipo_afectacion: aviso.tipo_afectacion,
          direccion_texto: aviso.direccion_texto,
          estado: "REPORTADO", // Estado inicial ICS
          prioridad: "MEDIA",
          descripcion: descripcionFinal,
          latitud: Number(aviso.latitud),
          longitud: Number(aviso.longitud),
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${Number(aviso.longitud)}, ${Number(aviso.latitud)}), 4326)`,
          requiere_asistencia_social: input.requiereAsistenciaSocial,
          aviso_id: avisoId,
          creado_por_id: operadorValidoId,
          operador_id: operadorValidoId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 6. Actualizar aviso a estado VERIFICADO
      const avisoActualizado = await trx
        .updateTable("aviso_incidente")
        .set({
          estado: "VERIFICADO",
          incidente_id: nuevoIncidente.id,
          operador_id: operadorValidoId,
          actualizado_en: new Date(),
        })
        .where("id", "=", avisoId)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 7. Vincular los adjuntos existentes del aviso al nuevo incidente
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

      if (aviso.estado !== "PENDIENTE_VERIFICACION") {
        throw new Error("AVISO_ALREADY_PROCESSED");
      }

      // Resolver operadorId seguro (respetando clave foránea en tabla usuario)
      let operadorValidoId: string | null = null;
      if (operadorId) {
        const existeUsuario = await trx
          .selectFrom("usuario")
          .select("id")
          .where("id", "=", operadorId)
          .executeTakeFirst();
        if (existeUsuario) {
          operadorValidoId = existeUsuario.id;
        } else {
          const userDefault = await trx
            .selectFrom("usuario")
            .select("id")
            .where("rol_id", "=", "20000000-0000-4000-8000-000000000002")
            .limit(1)
            .executeTakeFirst();
          operadorValidoId = userDefault?.id ?? null;
        }
      }

      const actualizado = await trx
        .updateTable("aviso_incidente")
        .set({
          estado: "DESCARTADO",
          motivo_descarte: motivoDescarte,
          operador_id: operadorValidoId,
          actualizado_en: new Date(),
        })
        .where("id", "=", avisoId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return actualizado;
    });
  }

  /**
   * Obtiene la lista de tipos de incidentes activos ordenados alfabéticamente.
   */
  async obtenerTiposIncidentes() {
    return await db
      .selectFrom("tipo_incidente")
      .selectAll()
      .where("activo", "=", true)
      .orderBy("nombre", "asc")
      .execute();
  }
}

export const incidentesRepository = new IncidentesRepository();
