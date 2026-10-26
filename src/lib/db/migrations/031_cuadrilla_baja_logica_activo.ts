import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Incorporar columna activo e índice para baja lógica en cuadrilla
  await sql`
    ALTER TABLE cuadrilla
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_activo 
    ON cuadrilla (activo) 
    WHERE eliminado_en IS NULL;
  `.execute(db);

  // 2. Incorporar trazabilidad histórica en asignaciones logísticas (cuadrilla_recurso)
  await sql`
    ALTER TABLE cuadrilla_recurso
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS desvinculado_en TIMESTAMPTZ DEFAULT NULL;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_recurso_activo 
    ON cuadrilla_recurso (cuadrilla_id, activo);
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_recurso_desvinculado_en 
    ON cuadrilla_recurso (desvinculado_en);
  `.execute(db);

  // 3. Incorporar trazabilidad histórica en dotación humana (cuadrilla_personal)
  await sql`
    ALTER TABLE cuadrilla_personal
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS desvinculado_en TIMESTAMPTZ DEFAULT NULL;
  `.execute(db);

  // Reemplazar restricción estática por índice único parcial para asignaciones activas
  await sql`
    ALTER TABLE cuadrilla_personal 
    DROP CONSTRAINT IF EXISTS uq_cuadrilla_personal;
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cuadrilla_personal_activa 
    ON cuadrilla_personal (cuadrilla_id, personal_id) 
    WHERE desvinculado_en IS NULL;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_personal_desvinculado_en 
    ON cuadrilla_personal (desvinculado_en);
  `.execute(db);

  // 4. Registrar permiso RBAC específico cuadrillas:eliminar (HU-82)
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000031';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_admin_user_id UUID;
    BEGIN
      -- Verificar si ya existe el permiso por código único
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'cuadrillas:eliminar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'cuadrillas:eliminar',
            'Desactivar Cuadrillas',
            'Permite dar de baja lógica cuadrillas operativas y liberar dotación de recursos y personal',
            'Recursos y Personal'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'cuadrillas:eliminar',
            'Desactivar Cuadrillas',
            'Permite dar de baja lógica cuadrillas operativas y liberar dotación de recursos y personal',
            'Recursos y Personal'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      -- Obtener el ID del usuario administrador inicial
      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      -- Asignar el permiso al rol Administrador si no se encuentra asignado
      IF v_permiso_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // 1. Eliminar asignación de rol y permiso
  await sql`
    DELETE FROM rol_permiso 
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'cuadrillas:eliminar');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'cuadrillas:eliminar';`.execute(db);

  // 2. Revertir índices y columnas en cuadrilla_personal
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_personal_desvinculado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_personal_activa;`.execute(db);

  await sql`
    ALTER TABLE cuadrilla_personal
    ADD CONSTRAINT uq_cuadrilla_personal UNIQUE (cuadrilla_id, personal_id);
  `.execute(db);

  await sql`
    ALTER TABLE cuadrilla_personal
    DROP COLUMN IF EXISTS desvinculado_en,
    DROP COLUMN IF EXISTS activo;
  `.execute(db);

  // 3. Revertir índices y columnas en cuadrilla_recurso
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_recurso_desvinculado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_recurso_activo;`.execute(db);

  await sql`
    ALTER TABLE cuadrilla_recurso
    DROP COLUMN IF EXISTS desvinculado_en,
    DROP COLUMN IF EXISTS activo;
  `.execute(db);

  // 4. Revertir columnas e índices en cuadrilla
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_activo;`.execute(db);

  await sql`
    ALTER TABLE cuadrilla
    DROP COLUMN IF EXISTS activo;
  `.execute(db);
}
