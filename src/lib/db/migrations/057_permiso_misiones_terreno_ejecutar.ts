import { Kysely, sql } from "kysely";

/**
<<<<<<<< HEAD:src/lib/db/migrations/057_permiso_misiones_terreno_ejecutar.ts
 * HU-41 - Permiso RBAC para ejecutar y rechazar misiones asignadas a Cuadrilla en terreno.
========
 * HU-36 / HU-69 - Permiso RBAC para confirmación, aceptación y rechazo de misión por Patrulla Verificadora en terreno.
>>>>>>>> develop:src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts
 *
 * Se registra el permiso `misiones:terreno:ejecutar` en el módulo 'Misiones' y se asigna
 * a los roles `DELEGADO_CUADRILLA` y `ADMIN` de forma idempotente.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000042';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_delegado_rol_id UUID := '20000000-0000-4000-8000-000000000005';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'misiones:terreno:ejecutar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
<<<<<<<< HEAD:src/lib/db/migrations/057_permiso_misiones_terreno_ejecutar.ts
            'misiones:terreno:ejecutar',
            'Ejecutar Misiones en Terreno',
            'Permite al delegado de cuadrilla gestionar, rechazar o ejecutar misiones asignadas en terreno',
========
            'misiones:terreno:verificar',
            'Verificar y Aceptar Misiones en Terreno',
            'Permite a la patrulla verificadora gestionar, aceptar o rechazar misiones asignadas desde terreno',
>>>>>>>> develop:src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
<<<<<<<< HEAD:src/lib/db/migrations/057_permiso_misiones_terreno_ejecutar.ts
            'misiones:terreno:ejecutar',
            'Ejecutar Misiones en Terreno',
            'Permite al delegado de cuadrilla gestionar, rechazar o ejecutar misiones asignadas en terreno',
========
            'misiones:terreno:verificar',
            'Verificar y Aceptar Misiones en Terreno',
            'Permite a la patrulla verificadora gestionar, aceptar o rechazar misiones asignadas desde terreno',
>>>>>>>> develop:src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      ELSE
        UPDATE permiso
        SET
<<<<<<<< HEAD:src/lib/db/migrations/057_permiso_misiones_terreno_ejecutar.ts
          nombre = 'Ejecutar Misiones en Terreno',
          descripcion = 'Permite al delegado de cuadrilla gestionar, rechazar o ejecutar misiones asignadas en terreno',
========
          nombre = 'Verificar y Aceptar Misiones en Terreno',
          descripcion = 'Permite a la patrulla verificadora gestionar, aceptar o rechazar misiones asignadas desde terreno',
>>>>>>>> develop:src/lib/db/migrations/051_permiso_misiones_terreno_verificar.ts
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
        (v_delegado_rol_id, v_permiso_id, v_admin_user_id)
      ON CONFLICT DO NOTHING;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'misiones:terreno:ejecutar'
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'misiones:terreno:ejecutar';
  `.execute(db);
}
