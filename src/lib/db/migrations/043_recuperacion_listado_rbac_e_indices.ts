import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Ampliar tabla recuperacion con columnas para enlace ATP, cierre y borrado lógico
  await sql`
    ALTER TABLE recuperacion
    ADD COLUMN IF NOT EXISTS evento_atp_id UUID REFERENCES evento_atp(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS observaciones_cierre TEXT,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
  `.execute(db);

  // 2. Índices de optimización para listado, ordenamiento y filtros
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_creado_en ON recuperacion (creado_en DESC);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_delegacion_estado ON recuperacion (delegacion_id, estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_eliminado_en ON recuperacion (eliminado_en);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_evento_atp_id ON recuperacion (evento_atp_id);`.execute(db);

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

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      IF v_permiso_id IS NOT NULL THEN
        -- Asignar a Administrador
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        -- Asignar a Encargado
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_encargado_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        -- Asignar a Supervisor Estratégico
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_supervisor_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'recuperacion:leer');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'recuperacion:leer';`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_recuperacion_evento_atp_id;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_recuperacion_eliminado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_recuperacion_delegacion_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_recuperacion_creado_en;`.execute(db);

  await sql`
    ALTER TABLE recuperacion
    DROP COLUMN IF EXISTS evento_atp_id,
    DROP COLUMN IF EXISTS fecha_cierre,
    DROP COLUMN IF EXISTS observaciones_cierre,
    DROP COLUMN IF EXISTS eliminado_en;
  `.execute(db);
}

