import { Kysely, sql } from "kysely";

/**
 * HU-36 / HU-69 - Permiso RBAC para confirmación, aceptación y rechazo de misión por Patrulla Verificadora en terreno.
 *
 * Se registra el permiso `misiones:terreno:verificar` en el módulo 'Misiones' y se asigna
 * a los roles `PATRULLA_VERIFICADORA` y `ADMIN`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000036';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_patrulla_rol_id UUID := '20000000-0000-4000-8000-000000000004';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'misiones:terreno:verificar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'misiones:terreno:verificar',
            'Verificar y Aceptar Misiones en Terreno',
            'Permite a la patrulla verificadora gestionar, aceptar o rechazar misiones asignadas desde terreno',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'misiones:terreno:verificar',
            'Verificar y Aceptar Misiones en Terreno',
            'Permite a la patrulla verificadora gestionar, aceptar o rechazar misiones asignadas desde terreno',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      ELSE
        UPDATE permiso
        SET
          nombre = 'Verificar y Aceptar Misiones en Terreno',
          descripcion = 'Permite a la patrulla verificadora gestionar, aceptar o rechazar misiones asignadas desde terreno',
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
        (v_patrulla_rol_id, v_permiso_id, v_admin_user_id)
      ON CONFLICT DO NOTHING;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'misiones:terreno:verificar'
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'misiones:terreno:verificar';
  `.execute(db);
}

