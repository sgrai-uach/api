import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para borrado lógico y auditoría en evento_prevencion (H76)
  await sql`
    ALTER TABLE evento_prevencion
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índices de apoyo para listado paginado y filtrado de registros activos
  await db.schema
    .createIndex("idx_evento_prevencion_activo_eliminado")
    .ifNotExists()
    .on("evento_prevencion")
    .columns(["activo", "eliminado_en"])
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_prevencion_creado_en_desc
    ON evento_prevencion (creado_en DESC);
  `.execute(db);

  // 3. Registrar permiso RBAC prevencion:eventos:leer y asignarlo a ADMIN, ENCARGADO y SUPERVISOR
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000046';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
      v_supervisor_rol_id UUID := '20000000-0000-4000-8000-000000000010';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'prevencion:eventos:leer';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'prevencion:eventos:leer',
            'Listar Eventos de Prevención',
            'Permite consultar el listado paginado y detalle operativo de eventos y misiones preventivas desplegadas en puntos críticos',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'prevencion:eventos:leer',
            'Listar Eventos de Prevención',
            'Permite consultar el listado paginado y detalle operativo de eventos y misiones preventivas desplegadas en puntos críticos',
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
        VALUES
          (v_admin_rol_id, v_permiso_id, v_admin_user_id),
          (v_encargado_rol_id, v_permiso_id, v_admin_user_id),
          (v_supervisor_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'prevencion:eventos:leer');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'prevencion:eventos:leer';`.execute(db);

  await db.schema.dropIndex("idx_evento_prevencion_creado_en_desc").ifExists().execute();
  await db.schema.dropIndex("idx_evento_prevencion_activo_eliminado").ifExists().execute();

  await sql`
    ALTER TABLE evento_prevencion
    DROP COLUMN IF EXISTS eliminado_por_id,
    DROP COLUMN IF EXISTS eliminado_en,
    DROP COLUMN IF EXISTS activo;
  `.execute(db);
}
