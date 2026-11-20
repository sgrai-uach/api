import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar auditoría de cierre en recuperacion (HU-75)
  await sql`
    ALTER TABLE recuperacion
    ADD COLUMN IF NOT EXISTS cerrado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recuperacion_cerrado_por
    ON recuperacion (cerrado_por_id);
  `.execute(db);

  // 2. Agregar columnas de trazabilidad de consumo y devolución en recuperacion_recurso (HU-75)
  await sql`
    ALTER TABLE recuperacion_recurso
    ADD COLUMN IF NOT EXISTS cantidad_consumida INTEGER,
    ADD COLUMN IF NOT EXISTS cantidad_devuelta INTEGER,
    ADD COLUMN IF NOT EXISTS devuelto_en TIMESTAMPTZ;
  `.execute(db);

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_recuperacion_recurso_consumida'
      ) THEN
        ALTER TABLE recuperacion_recurso
        ADD CONSTRAINT chk_recuperacion_recurso_consumida
        CHECK (cantidad_consumida >= 0 AND cantidad_consumida <= cantidad_asignada);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_recuperacion_recurso_devuelta'
      ) THEN
        ALTER TABLE recuperacion_recurso
        ADD CONSTRAINT chk_recuperacion_recurso_devuelta
        CHECK (cantidad_devuelta >= 0);
      END IF;
    END $$;
  `.execute(db);

  // 3. Registrar permiso RBAC recuperacion:cerrar y asignarlo a ENCARGADO y ADMIN
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000081';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:cerrar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'recuperacion:cerrar',
            'Cerrar Operativo de Recuperación',
            'Permite decretar la conclusión formal de un operativo de recuperación en ejecución, reintegrar remanentes y liberar patrullas',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'recuperacion:cerrar',
            'Cerrar Operativo de Recuperación',
            'Permite decretar la conclusión formal de un operativo de recuperación en ejecución, reintegrar remanentes y liberar patrullas',
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
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'recuperacion:cerrar');
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'recuperacion:cerrar';
  `.execute(db);

  await sql`
    ALTER TABLE recuperacion_recurso
    DROP CONSTRAINT IF EXISTS chk_recuperacion_recurso_devuelta,
    DROP CONSTRAINT IF EXISTS chk_recuperacion_recurso_consumida,
    DROP COLUMN IF EXISTS devuelto_en,
    DROP COLUMN IF EXISTS cantidad_devuelta,
    DROP COLUMN IF EXISTS cantidad_consumida;
  `.execute(db);

  await sql`DROP INDEX IF EXISTS idx_recuperacion_cerrado_por;`.execute(db);

  await sql`
    ALTER TABLE recuperacion
    DROP COLUMN IF EXISTS cerrado_por_id;
  `.execute(db);
}
