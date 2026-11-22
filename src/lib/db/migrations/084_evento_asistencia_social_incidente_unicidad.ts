import { sql, type Kysely } from "kysely";

/**
 * Migración 084: Garantiza a nivel de PostgreSQL que un incidente resuelto o atendido
 * tenga como máximo un evento activo de asistencia social (`eliminado_en IS NULL` y
 * `estado <> 'DESCARTADO'`), evitando duplicidad de derivaciones FIBE concurrentes (HU-25).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_asistencia_social_incidente_activo
    ON evento_asistencia_social (incidente_id)
    WHERE incidente_id IS NOT NULL
      AND eliminado_en IS NULL
      AND estado <> 'DESCARTADO';
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS uq_evento_asistencia_social_incidente_activo;
  `.execute(db);
}
