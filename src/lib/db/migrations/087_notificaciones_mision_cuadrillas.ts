import { sql, type Kysely } from "kysely";

/**
 * Migración 087 (Estandarización de Notificaciones y Lectura Terreno):
 * Extiende `notificaciones_mision` para soportar despachos tanto hacia `patrulla_verificadora`
 * como hacia `cuadrilla`, manteniendo integridad referencial exclusiva entre ambas unidades.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE notificaciones_mision
      ALTER COLUMN patrulla_id DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS cuadrilla_id UUID REFERENCES cuadrilla(id) ON DELETE CASCADE;
  `.execute(db);

  await sql`
    ALTER TABLE notificaciones_mision
      DROP CONSTRAINT IF EXISTS chk_notificaciones_mision_destinatario;
  `.execute(db);

  await sql`
    ALTER TABLE notificaciones_mision
      ADD CONSTRAINT chk_notificaciones_mision_destinatario
      CHECK (
        (patrulla_id IS NOT NULL AND cuadrilla_id IS NULL)
        OR (patrulla_id IS NULL AND cuadrilla_id IS NOT NULL)
      );
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_notificaciones_mision_cuadrilla_estado
    ON notificaciones_mision (cuadrilla_id, estado)
    WHERE cuadrilla_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_notificaciones_mision_cuadrilla_estado;`.execute(db);
  await sql`
    ALTER TABLE notificaciones_mision
      DROP CONSTRAINT IF EXISTS chk_notificaciones_mision_destinatario;
  `.execute(db);
  await sql`
    ALTER TABLE notificaciones_mision
      DROP COLUMN IF EXISTS cuadrilla_id;
  `.execute(db);
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM notificaciones_mision WHERE patrulla_id IS NULL) THEN
        ALTER TABLE notificaciones_mision ALTER COLUMN patrulla_id SET NOT NULL;
      END IF;
    END $$;
  `.execute(db);
}
