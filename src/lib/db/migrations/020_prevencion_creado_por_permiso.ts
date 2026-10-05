import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columna para auditoría y trazabilidad del creador en la tabla prevencion
  await sql`
    ALTER TABLE prevencion 
    ADD COLUMN IF NOT EXISTS creado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice para consultas de auditoría por usuario creador
  await db.schema
    .createIndex("idx_prevencion_creado_por")
    .ifNotExists()
    .on("prevencion")
    .column("creado_por_id")
    .execute();

  // 3. Registrar permiso RBAC para crear puntos críticos (HU-58)
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000018';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'puntos_criticos:crear';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'puntos_criticos:crear',
            'Crear Puntos Críticos',
            'Permite registrar nuevos puntos críticos y sectores vulnerables en el mapa y catálogo comunal',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'puntos_criticos:crear',
            'Crear Puntos Críticos',
            'Permite registrar nuevos puntos críticos y sectores vulnerables en el mapa y catálogo comunal',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      -- Obtener el ID del usuario administrador si existe, o usar el default seed
      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      -- 4. Asignar permiso 'puntos_criticos:crear' al rol Administrador
      IF v_permiso_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'puntos_criticos:crear');
    DELETE FROM permiso WHERE codigo = 'puntos_criticos:crear';
  `.execute(db);

  await db.schema.dropIndex("idx_prevencion_creado_por").ifExists().execute();
  await sql`ALTER TABLE prevencion DROP COLUMN IF EXISTS creado_por_id;`.execute(db);
}
