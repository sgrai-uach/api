import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columna mision_id a recuperacion_recurso para vincular insumos a misiones tácticas específicas
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recuperacion_recurso' AND column_name = 'mision_id'
      ) THEN
        ALTER TABLE recuperacion_recurso 
        ADD COLUMN mision_id UUID REFERENCES mision(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recuperacion_recurso_mision 
    ON recuperacion_recurso (mision_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_recuperacion_recurso_mision;`.execute(db);
  await sql`ALTER TABLE recuperacion_recurso DROP COLUMN IF EXISTS mision_id;`.execute(db);
}

