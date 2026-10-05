import { sql, type Transaction } from "kysely";
import type { Database, EstadoOperativoPersonal } from "@/lib/db/types";

export type Trx = Transaction<Database>;

export async function buscarPatrullaPorId(trx: Trx, patrullaId: string) {
  return await trx
    .selectFrom("patrulla_verificadora")
    .select(["id", "nombre", "estado", "delegacion_id", "usuario_lider_id"])
    .where("id", "=", patrullaId)
    .executeTakeFirst();
}

export async function actualizarEstadoPatrulla(
  trx: Trx,
  patrullaId: string,
  nuevoEstado: "DISPONIBLE" | "EN_VERIFICACION" | "EN_PREVENCION" | "NO_DISPONIBLE"
) {
  return await trx
    .updateTable("patrulla_verificadora")
    .set({ estado: nuevoEstado })
    .where("id", "=", patrullaId)
    .execute();
}

export async function actualizarEstadoPersonalLider(
  trx: Trx,
  usuarioId: string,
  estadoOperativo: EstadoOperativoPersonal
) {
  return await trx
    .updateTable("personal")
    .set({ estado_operativo: estadoOperativo })
    .where("usuario_id", "=", usuarioId)
    .execute();
}

export async function buscarDelegacionPorId(trx: Trx, delegacionId: string) {
  return await trx
    .selectFrom("delegacion")
    .selectAll()
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

export async function buscarPuntoCriticoPorId(trx: Trx, puntoCriticoId: string) {
  return await trx
    .selectFrom("prevencion")
    .select(["id", "codigo", "nombre", "activo"])
    .where("id", "=", puntoCriticoId)
    .executeTakeFirst();
}

export async function obtenerRecursosParaBloqueo(trx: Trx, recursoIds: string[]) {
  if (recursoIds.length === 0) return [];
  return await trx
    .selectFrom("recurso")
    .select(["id", "nombre", "cantidad_inventario", "cantidad_en_uso", "eliminado_en"])
    .where("id", "in", recursoIds)
    .where("eliminado_en", "is", null)
    .execute();
}

export async function descontarStockRecurso(trx: Trx, recursoId: string, cantidad: number) {
  return await trx
    .updateTable("recurso")
    .set((eb) => ({
      cantidad_inventario: eb("cantidad_inventario", "-", cantidad),
    }))
    .where("id", "=", recursoId)
    .execute();
}

export async function generarSiguienteCodigoPrevencion(trx: Trx): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `PREV-${anio}-`;

  const resultado = await trx
    .selectFrom("evento_prevencion")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .orderBy("creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  let correlativo = 1;
  if (resultado && resultado.codigo) {
    const partes = resultado.codigo.split("-");
    const ultimoNumero = parseInt(partes[2], 10);
    if (!isNaN(ultimoNumero)) {
      correlativo = ultimoNumero + 1;
    }
  }

  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
}

export async function generarSiguienteCodigoMision(trx: Trx): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `MIS-${anio}-`;

  const resultado = await trx
    .selectFrom("mision")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .orderBy("creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  let correlativo = 1;
  if (resultado && resultado.codigo) {
    const partes = resultado.codigo.split("-");
    const ultimoNumero = parseInt(partes[2], 10);
    if (!isNaN(ultimoNumero)) {
      correlativo = ultimoNumero + 1;
    }
  }

  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
}

export interface InsertarEventoPrevencionData {
  codigo: string;
  nombre: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  sector?: string | null;
  direccionTexto?: string | null;
  puntoCriticoId?: string | null;
  delegacionId: string;
  latitud: number;
  longitud: number;
  creadoPorId: string;
}

export async function insertarEventoPrevencion(trx: Trx, data: InsertarEventoPrevencionData) {
  const query = sql`
    INSERT INTO evento_prevencion (
      codigo, nombre, descripcion, prioridad, estado, sector, direccion_texto,
      punto_critico_id, delegacion_id, latitud, longitud, ubicacion, creado_por_id
    ) VALUES (
      ${data.codigo}, ${data.nombre}, ${data.descripcion}, ${data.prioridad}, 'PLANIFICADA',
      ${data.sector ?? null}, ${data.direccionTexto ?? null}, ${data.puntoCriticoId ?? null},
      ${data.delegacionId}, ${data.latitud}, ${data.longitud},
      ST_SetSRID(ST_MakePoint(${data.longitud}, ${data.latitud}), 4326),
      ${data.creadoPorId}
    )
    RETURNING id, codigo, nombre, descripcion, prioridad, estado, sector, direccion_texto,
              punto_critico_id, delegacion_id, latitud, longitud, creado_por_id, creado_en, actualizado_en
  `;

  const result = await query.execute(trx);
  return result.rows[0] as {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    estado: string;
    sector: string | null;
    direccion_texto: string | null;
    punto_critico_id: string | null;
    delegacion_id: string;
    latitud: number | string;
    longitud: number | string;
    creado_por_id: string;
    creado_en: Date;
    actualizado_en: Date;
  };
}

export interface InsertarMisionPrevencionData {
  codigo: string;
  titulo: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  eventoPrevencionId: string;
  puntoCriticoId?: string | null;
  patrullaId: string;
  encargadoId: string;
  creadoPorId: string;
}

export async function insertarMisionPrevencion(trx: Trx, data: InsertarMisionPrevencionData) {
  return await trx
    .insertInto("mision")
    .values({
      codigo: data.codigo,
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo_mision: "PREVENCION",
      estado: "DESPACHADA",
      prioridad: data.prioridad,
      evento_prevencion_id: data.eventoPrevencionId,
      prevencion_id: data.puntoCriticoId ?? null,
      patrulla_id: data.patrullaId,
      encargado_id: data.encargadoId,
      creado_por_id: data.creadoPorId,
      fecha_inicio: new Date(),
    })
    .returning(["id", "codigo", "titulo", "estado", "tipo_mision"])
    .executeTakeFirstOrThrow();
}

export interface AsignacionRecursoData {
  eventoPrevencionId: string;
  recursoId: string;
  cantidad: number;
}

export async function insertarRecursosPrevencion(
  trx: Trx,
  asignaciones: AsignacionRecursoData[]
) {
  if (asignaciones.length === 0) return;
  return await trx
    .insertInto("evento_prevencion_recurso")
    .values(
      asignaciones.map((a) => ({
        evento_prevencion_id: a.eventoPrevencionId,
        recurso_id: a.recursoId,
        cantidad_asignada: a.cantidad,
      }))
    )
    .execute();
}
