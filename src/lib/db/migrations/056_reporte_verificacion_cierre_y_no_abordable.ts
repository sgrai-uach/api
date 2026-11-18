import { Kysely, sql } from "kysely";

/**
 * HU-39 / HU-86 - Informe Técnico de Verificación en Terreno, Cierre de Misión
 * de Patrullaje y Declaración Fundada de No Abordabilidad (`NO_ABORDABLE`).
 *
 * 1. Añade a `incidente` las columnas `fecha_cierre` y `motivo_no_abordable`.
 * 2. Añade a `reporte_terreno` las columnas `tipo_reporte`, `dictamen`,
 *    `motivo_no_abordable` y `requiere_asistencia_social`.
 * 3. Crea el permiso RBAC `reportes:crear` en el módulo `'Misiones'` y lo asigna
 *    a los roles `ADMIN`, `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Columnas de cierre y descarte fundado en incidente
  await sql`
    ALTER TABLE incidente
    ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS motivo_no_abordable TEXT NULL;
  `.execute(db);

  // 2. Columnas de dictamen, tipo de reporte y asistencia social en reporte_terreno
  await sql`
    ALTER TABLE reporte_terreno
    ADD COLUMN IF NOT EXISTS tipo_reporte VARCHAR(40) NOT NULL DEFAULT 'EVALUACION_PRIORIDAD',
    ADD COLUMN IF NOT EXISTS dictamen VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS motivo_no_abordable TEXT NULL,
    ADD COLUMN IF NOT EXISTS requiere_asistencia_social BOOLEAN NOT NULL DEFAULT false;
  `.execute(db);

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_reporte_terreno_dictamen'
      ) THEN
        ALTER TABLE reporte_terreno
        ADD CONSTRAINT chk_reporte_terreno_dictamen
        CHECK (dictamen IS NULL OR dictamen IN ('REQUIERE_CUADRILLA', 'NO_ABORDABLE'));
      END IF;
    END $$;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reporte_terreno_tipo_reporte
    ON reporte_terreno (mision_id, tipo_reporte);
  `.execute(db);

  // 3. Permiso RBAC `reportes:crear`
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000039';
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
            'Crear Reportes Técnicos de Terreno',
            'Permite a patrullas verificadoras y cuadrillas emitir informes técnicos de terreno y cerrar misiones operativas',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'reportes:crear',
            'Crear Reportes Técnicos de Terreno',
            'Permite a patrullas verificadoras y cuadrillas emitir informes técnicos de terreno y cerrar misiones operativas',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      ELSE
        UPDATE permiso
        SET
          nombre = 'Crear Reportes Técnicos de Terreno',
          descripcion = 'Permite a patrullas verificadoras y cuadrillas emitir informes técnicos de terreno y cerrar misiones operativas',
          modulo = 'Misiones'
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

      -- Garantizar que Patrulla Verificadora y Delegado de Cuadrilla posean 'misiones:leer' para consultar detalle de misión
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'misiones:leer';
      IF v_permiso_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES
          (v_patrulla_rol_id, v_permiso_id, v_admin_user_id),
          (v_delegado_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'reportes:crear'
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'reportes:crear';
  `.execute(db);

  await sql`DROP INDEX IF EXISTS idx_reporte_terreno_tipo_reporte;`.execute(db);

  await sql`
    ALTER TABLE reporte_terreno
    DROP CONSTRAINT IF EXISTS chk_reporte_terreno_dictamen;
  `.execute(db);

  await sql`
    ALTER TABLE reporte_terreno
    DROP COLUMN IF EXISTS requiere_asistencia_social,
    DROP COLUMN IF EXISTS motivo_no_abordable,
    DROP COLUMN IF EXISTS dictamen,
    DROP COLUMN IF EXISTS tipo_reporte;
  `.execute(db);

  await sql`
    ALTER TABLE incidente
    DROP COLUMN IF EXISTS motivo_no_abordable,
    DROP COLUMN IF EXISTS fecha_cierre;
  `.execute(db);
}
