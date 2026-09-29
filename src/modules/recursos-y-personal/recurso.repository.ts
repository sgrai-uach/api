import { db } from "@/lib/db";
import { sql } from "kysely";
import type { EstadoRecurso } from "@/lib/db/types";

export interface DatosInsertarRecurso {
  nombre: string;
  es_individual: boolean;
  estado: EstadoRecurso;
  cantidad_inventario: number;
  cantidad_en_uso: number;
  cantidad_minima: number;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  detalles: Record<string, unknown>;
  creado_por_id: string;
}

export async function insertarRecurso(datos: DatosInsertarRecurso) {
  const fila = await db
    .insertInto("recurso")
    .values({
      nombre: datos.nombre,
      es_individual: datos.es_individual,
      estado: datos.estado,
      cantidad_inventario: datos.cantidad_inventario,
      cantidad_en_uso: datos.cantidad_en_uso,
      cantidad_minima: datos.cantidad_minima,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      descripcion: datos.descripcion,
      detalles: datos.detalles,
      creado_por_id: datos.creado_por_id,
    })
    .returning([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
      "latitud",
      "longitud",
      "descripcion",
      "detalles",
      "creado_por_id",
      "creado_en",
      "actualizado_en",
    ])
    .executeTakeFirstOrThrow();

  return fila;
}
