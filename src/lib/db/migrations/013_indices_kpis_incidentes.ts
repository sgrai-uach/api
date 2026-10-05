import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Índices compuestos para optimizar consultas de agregación y KPIs del dashboard
  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidente_creado_en_estado 
    ON incidente (creado_en, estado);
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidente_delegacion_creado_en_estado 
    ON incidente (delegacion_id, creado_en, estado);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_incidente_delegacion_creado_en_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_incidente_creado_en_estado;`.execute(db);
}
