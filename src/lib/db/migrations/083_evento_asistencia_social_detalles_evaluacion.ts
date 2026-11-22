import { sql, type Kysely } from "kysely";

/**
 * Migración 083: Persistencia del desglose demográfico y condición habitacional (`detalles_evaluacion`)
 * en eventos excepcionales de asistencia social (H28 / homologación H38-H39).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE evento_asistencia_social
    ADD COLUMN IF NOT EXISTS detalles_evaluacion JSONB NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE evento_asistencia_social
    DROP COLUMN IF EXISTS detalles_evaluacion;
  `.execute(db);
}
