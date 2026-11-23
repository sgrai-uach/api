import { sql, type Kysely } from "kysely";

/**
 * Migración 085 (HU-44):
 * Agrega la columna `detalle_apoyo_requerido` en `reporte_terreno` para especificar
 * con exactitud los recursos materiales o humanos adicionales solicitados desde terreno,
 * crea un índice parcial para acelerar la visualización en el tablero Kanban y garantiza
 * de forma idempotente la asignación del permiso RBAC `reportes:crear`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Incorporar columna `detalle_apoyo_requerido` en `reporte_terreno`
  await sql`
    ALTER TABLE reporte_terreno
    ADD COLUMN IF NOT EXISTS detalle_apoyo_requerido TEXT NULL;
  `.execute(db);

  // 2. Índice parcial para acelerar consultas del indicador "Apoyo Solicitado" en Kanban
  await sql`
    CREATE INDEX IF NOT EXISTS idx_reporte_terreno_apoyo_adicional
    ON reporte_terreno (mision_id)
    WHERE requiere_apoyo_adicional = true;
  `.execute(db);

  // 3. Garantizar permiso RBAC `reportes:crear` y su asignación a roles operativos de terreno
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
            'Permite a patrullas verificadoras y cuadrillas emitir informes técnicos de terreno, solicitar apoyo adicional y cerrar misiones operativas',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'reportes:crear',
            'Crear Reportes Técnicos de Terreno',
            'Permite a patrullas verificadoras y cuadrillas emitir informes técnicos de terreno, solicitar apoyo adicional y cerrar misiones operativas',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      IF v_admin_user_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES
          (v_admin_rol_id, v_permiso_id, v_admin_user_id),
          (v_patrulla_rol_id, v_permiso_id, v_admin_user_id),
          (v_delegado_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_reporte_terreno_apoyo_adicional;`.execute(db);
  await sql`
    ALTER TABLE reporte_terreno
    DROP COLUMN IF EXISTS detalle_apoyo_requerido;
  `.execute(db);
}
