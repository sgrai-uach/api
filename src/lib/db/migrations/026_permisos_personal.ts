import { Kysely, sql } from "kysely";

/**
 * H11 - Permisos RBAC del módulo de Personal.
 *
 * Se crean los permisos granulares `personal:leer`, `personal:crear`, `personal:editar`
 * y `personal:gestionar`, se asignan al rol Administrador y se otorga `personal:leer`
 * al rol Encargado (necesario para dimensionar la disponibilidad en terreno).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    DECLARE
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
      v_admin_user_id UUID;
    BEGIN
      -- 1. Crear los permisos del módulo de personal (idempotente por código)
      INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
      VALUES
        ('10000000-0000-4000-8000-000000000022', 'personal:leer', 'Listar Personal',
         'Permite consultar el directorio de funcionarios y su disponibilidad operativa', 'Recursos y Personal'),
        ('10000000-0000-4000-8000-000000000023', 'personal:crear', 'Registrar Personal',
         'Permite registrar nuevos funcionarios y sus fichas de terreno', 'Recursos y Personal'),
        ('10000000-0000-4000-8000-000000000024', 'personal:editar', 'Editar Personal',
         'Permite modificar los datos institucionales y la disponibilidad de los funcionarios', 'Recursos y Personal'),
        ('10000000-0000-4000-8000-000000000025', 'personal:gestionar', 'Gestionar Personal',
         'Permite dar de baja funcionarios y administrar completamente el módulo de personal', 'Recursos y Personal')
      ON CONFLICT (codigo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        modulo = EXCLUDED.modulo;

      -- 2. Autor de las asignaciones
      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      -- 3. Administrador: acceso total al módulo de personal
      INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
      SELECT v_admin_rol_id, p.id, v_admin_user_id
      FROM permiso p
      WHERE p.codigo IN ('personal:leer', 'personal:crear', 'personal:editar', 'personal:gestionar')
      ON CONFLICT DO NOTHING;

      -- 4. Encargado: lectura del directorio y de la disponibilidad
      INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
      SELECT v_encargado_rol_id, p.id, v_admin_user_id
      FROM permiso p
      WHERE p.codigo = 'personal:leer'
      ON CONFLICT DO NOTHING;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso
      WHERE codigo IN ('personal:leer', 'personal:crear', 'personal:editar', 'personal:gestionar')
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso
    WHERE codigo IN ('personal:leer', 'personal:crear', 'personal:editar', 'personal:gestionar');
  `.execute(db);
}
