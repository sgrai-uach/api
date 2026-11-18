import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas de fecha estimada de término y auditoría de edición en recuperacion (HU-74)
  await sql`
    ALTER TABLE recuperacion
    ADD COLUMN IF NOT EXISTS fecha_estimada_fin TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recuperacion_actualizado_por
    ON recuperacion (actualizado_por_id);
  `.execute(db);

  // 2. Registrar permiso RBAC recuperacion:editar y asignarlo a ENCARGADO y ADMIN
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000045';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:editar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'recuperacion:editar',
            'Editar Operativo de Recuperación',
            'Permite modificar la descripción, fecha estimada de término y dotación de insumos de operativos de recuperación activos',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'recuperacion:editar',
            'Editar Operativo de Recuperación',
            'Permite modificar la descripción, fecha estimada de término y dotación de insumos de operativos de recuperación activos',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM rol WHERE id = v_admin_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id)
        VALUES (v_admin_rol_id, v_permiso_id)
        ON CONFLICT (rol_id, permiso_id) DO NOTHING;
      END IF;

      IF EXISTS (SELECT 1 FROM rol WHERE id = v_encargado_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id)
        VALUES (v_encargado_rol_id, v_permiso_id)
        ON CONFLICT (rol_id, permiso_id) DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'recuperacion:editar');
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'recuperacion:editar';
  `.execute(db);

  await sql`DROP INDEX IF EXISTS idx_recuperacion_actualizado_por;`.execute(db);

  await sql`
    ALTER TABLE recuperacion
    DROP COLUMN IF EXISTS actualizado_por_id,
    DROP COLUMN IF EXISTS fecha_estimada_fin;
  `.execute(db);
}
