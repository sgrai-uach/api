import { sql, type Kysely } from "kysely";

/**
 * Migración 047: Agrega campos oficiales de la Ficha Básica de Emergencia (FIBE),
 * auditoría de edición/registro FIBE, índice único parcial de folio_fibe y
 * el permiso RBAC `asistencia_social:fibe:gestionar` para ASISTENTE_SOCIAL y ADMINISTRADOR (HU-71).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Columnas FIBE y auditoría en evento_asistencia_social
  await sql`
    ALTER TABLE evento_asistencia_social
      ADD COLUMN IF NOT EXISTS folio_fibe VARCHAR(50),
      ADD COLUMN IF NOT EXISTS nivel_dano_vivienda VARCHAR(30),
      ADD COLUMN IF NOT EXISTS observaciones_fibe TEXT,
      ADD COLUMN IF NOT EXISTS fibe_registrada_en TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS fibe_registrada_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice único parcial para garantizar unicidad de folio_fibe (insensible a mayúsculas y espacios)
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_asistencia_social_folio_fibe
    ON evento_asistencia_social (UPPER(TRIM(folio_fibe)))
    WHERE folio_fibe IS NOT NULL AND eliminado_en IS NULL;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_actualizado_por
    ON evento_asistencia_social (actualizado_por_id);
  `.execute(db);

  // 3. Registrar permiso RBAC asistencia_social:fibe:gestionar y asignarlo a ASISTENTE_SOCIAL y ADMINISTRADOR
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000047';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_asistente_social_rol_id UUID := '20000000-0000-4000-8000-000000000006';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'asistencia_social:fibe:gestionar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'asistencia_social:fibe:gestionar',
            'Gestionar Ficha FIBE de Asistencia Social',
            'Permite registrar y actualizar los datos oficiales de la Ficha Básica de Emergencia (FIBE) en casos de asistencia social',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'asistencia_social:fibe:gestionar',
            'Gestionar Ficha FIBE de Asistencia Social',
            'Permite registrar y actualizar los datos oficiales de la Ficha Básica de Emergencia (FIBE) en casos de asistencia social',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      IF v_permiso_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_asistente_social_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'asistencia_social:fibe:gestionar'
    );
    DELETE FROM permiso WHERE codigo = 'asistencia_social:fibe:gestionar';
  `.execute(db);

  await sql`DROP INDEX IF EXISTS idx_evento_asistencia_social_actualizado_por;`.execute(db);
  await sql`DROP INDEX IF EXISTS uq_evento_asistencia_social_folio_fibe;`.execute(db);

  await sql`
    ALTER TABLE evento_asistencia_social
      DROP COLUMN IF EXISTS actualizado_por_id,
      DROP COLUMN IF EXISTS fibe_registrada_por_id,
      DROP COLUMN IF EXISTS fibe_registrada_en,
      DROP COLUMN IF EXISTS observaciones_fibe,
      DROP COLUMN IF EXISTS nivel_dano_vivienda,
      DROP COLUMN IF EXISTS folio_fibe;
  `.execute(db);
}
