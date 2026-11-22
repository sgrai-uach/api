import { Kysely, sql } from "kysely";

/**
 * HU-43 - Permiso RBAC `reportes:crear` para adjuntar evidencia multimedia en terreno
 * y columna `sha256_hash` en `adjunto` para deduplicación de almacenamiento.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Registrar permiso `reportes:crear` y asignarlo a ADMIN, DELEGADO_CUADRILLA y PATRULLA_VERIFICADORA
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000043';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_patrulla_rol_id UUID := '20000000-0000-4000-8000-000000000004';
      v_delegado_rol_id UUID := '20000000-0000-4000-8000-000000000005';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'reportes:crear';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'reportes:crear',
            'Crear Reportes y Adjuntar Evidencia',
            'Permite subir fotografías, videos y documentos técnicos de respaldo asociados a incidentes o reportes de terreno',
            'Evidencia'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'reportes:crear',
            'Crear Reportes y Adjuntar Evidencia',
            'Permite subir fotografías, videos y documentos técnicos de respaldo asociados a incidentes o reportes de terreno',
            'Evidencia'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      ELSE
        UPDATE permiso
        SET
          nombre = 'Crear Reportes y Adjuntar Evidencia',
          descripcion = 'Permite subir fotografías, videos y documentos técnicos de respaldo asociados a incidentes o reportes de terreno',
          modulo = 'Evidencia'
        WHERE id = v_permiso_id;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
      VALUES
        (v_admin_rol_id, v_permiso_id, v_admin_user_id),
        (v_patrulla_rol_id, v_permiso_id, v_admin_user_id),
        (v_delegado_rol_id, v_permiso_id, v_admin_user_id)
      ON CONFLICT DO NOTHING;
    END $$;
  `.execute(db);

  // 2. Agregar columna sha256_hash en adjunto para trazabilidad y deduplicación de espacio
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'adjunto' AND column_name = 'sha256_hash'
      ) THEN
        ALTER TABLE adjunto
        ADD COLUMN sha256_hash VARCHAR(64);
      END IF;
    END $$;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_adjunto_sha256_hash ON adjunto (sha256_hash);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_adjunto_sha256_hash;`.execute(db);
  await sql`ALTER TABLE adjunto DROP COLUMN IF EXISTS sha256_hash;`.execute(db);

  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'reportes:crear'
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'reportes:crear';
  `.execute(db);
}
