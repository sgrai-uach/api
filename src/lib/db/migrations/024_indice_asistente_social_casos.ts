import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Índice para optimizar el cómputo y filtrado de casos FIBE asignados y activos por asistente social (H26)
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_asistente_estado ON evento_asistencia_social(asistente_social_id, estado) WHERE eliminado_en IS NULL;`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_evento_asistencia_social_asistente_estado;`.execute(db);
}
