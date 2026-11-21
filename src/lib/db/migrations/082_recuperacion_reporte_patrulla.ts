import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE recuperacion
    ADD COLUMN IF NOT EXISTS reporte_patrulla_resumen TEXT,
    ADD COLUMN IF NOT EXISTS reporte_patrulla_consumos JSONB,
    ADD COLUMN IF NOT EXISTS reporte_patrulla_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reporte_patrulla_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE recuperacion
    DROP COLUMN IF EXISTS reporte_patrulla_por_id,
    DROP COLUMN IF EXISTS reporte_patrulla_en,
    DROP COLUMN IF EXISTS reporte_patrulla_consumos,
    DROP COLUMN IF EXISTS reporte_patrulla_resumen;
  `.execute(db);
}
