import { Kysely, sql } from "kysely";

/**
 * Añade la columna `metadatos` (JSONB NULL) a `mision_hito` para persistir
 * trazabilidad estructurada de cambios en terreno (ej. tipología anterior y nueva
 * al reclasificar un incidente en `TIPOLOGIA_RECLASIFICADA`).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE mision_hito
    ADD COLUMN IF NOT EXISTS metadatos JSONB NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE mision_hito
    DROP COLUMN IF EXISTS metadatos;
  `.execute(db);
}

