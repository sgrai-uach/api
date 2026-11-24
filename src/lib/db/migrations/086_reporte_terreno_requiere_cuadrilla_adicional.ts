import { sql, type Kysely } from "kysely";

/**
 * Migración 086 (HU-44):
 * Agrega la columna `requiere_cuadrilla_adicional` en `reporte_terreno` para indicar
 * explícitamente desde terreno si la solicitud de apoyo requiere despachar una cuadrilla
 * adicional con una misión distinta a la original, junto con un índice parcial para
 * acelerar consultas del tablero Kanban.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE reporte_terreno
    ADD COLUMN IF NOT EXISTS requiere_cuadrilla_adicional BOOLEAN NOT NULL DEFAULT false;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reporte_terreno_apoyo_cuadrilla_adicional
    ON reporte_terreno (mision_id)
    WHERE requiere_apoyo_adicional = true AND requiere_cuadrilla_adicional = true;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_reporte_terreno_apoyo_cuadrilla_adicional;`.execute(db);
  await sql`
    ALTER TABLE reporte_terreno
    DROP COLUMN IF EXISTS requiere_cuadrilla_adicional;
  `.execute(db);
}
