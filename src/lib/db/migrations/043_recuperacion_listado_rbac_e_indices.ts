import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Ampliar tabla recuperacion con columnas para cierre y borrado lógico (H73)
  // Nota: evento_atp_id es gestionado en la migración 072_evento_atp_base (H61)
  await sql`
    ALTER TABLE recuperacion
    ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS observaciones_cierre TEXT,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
  `.execute(db);

  // 2. Índices de optimización para listado, ordenamiento y filtros (H73)
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_creado_en ON recuperacion (creado_en DESC);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_delegacion_estado ON recuperacion (delegacion_id, estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_eliminado_en ON recuperacion (eliminado_en);`.execute(db);

  // 3. Registrar permiso RBAC 'recuperacion:leer' y asignarlo a ADMIN, ENCARGADO y SUPERVISOR
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000043';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
      v_supervisor_rol_id UUID := '20000000-0000-4000-8000-000000000010';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:leer';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'recuperacion:leer',
            'Visualizar Operativos de Recuperación',
            'Permite consultar el listado paginado y detalle de operativos de recuperación post-desastre',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'recuperacion:leer',
            'Visualizar Operativos de Recuperación',
            'Permite consultar el listado paginado y detalle de operativos de recuperación post-desastre',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE rol_id = v_admin_rol_id LIMIT 1;
      IF v_admin_user_id IS NULL THEN
        v_admin_user_id := '00000000-0000-4000-8000-000000000001';
      END IF;

      -- Asignar permiso a rol ADMIN
      IF EXISTS (SELECT 1 FROM rol WHERE id = v_admin_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Asignar permiso a rol ENCARGADO
      IF EXISTS (SELECT 1 FROM rol WHERE id = v_encargado_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_encargado_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Asignar permiso a rol SUPERVISOR
      IF EXISTS (SELECT 1 FROM rol WHERE id = v_supervisor_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_supervisor_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // 1. Eliminar asignaciones de rol_permiso y permiso
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'recuperacion:leer');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'recuperacion:leer';`.execute(db);

  // 2. Eliminar índices
  await sql`DROP INDEX IF EXISTS idx_recuperacion_eliminado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_recuperacion_delegacion_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_recuperacion_creado_en;`.execute(db);

  // 3. Eliminar columnas añadidas
  await sql`
    ALTER TABLE recuperacion
    DROP COLUMN IF EXISTS fecha_cierre,
    DROP COLUMN IF EXISTS observaciones_cierre,
    DROP COLUMN IF EXISTS eliminado_en;
  `.execute(db);
}
