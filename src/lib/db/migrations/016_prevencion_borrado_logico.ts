import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para borrado lógico y auditoría a la tabla prevencion
  await sql`
    ALTER TABLE prevencion 
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índices para optimizar consultas de puntos críticos activos y auditoría
  await db.schema
    .createIndex("idx_prevencion_eliminado_en")
    .ifNotExists()
    .on("prevencion")
    .column("eliminado_en")
    .execute();

  await db.schema
    .createIndex("idx_prevencion_eliminado_por")
    .ifNotExists()
    .on("prevencion")
    .column("eliminado_por_id")
    .execute();

  // 3. Registrar capacidad de RBAC para eliminar puntos críticos de forma segura e idempotente
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000016';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_admin_user_id UUID;
    BEGIN
      -- Verificar si ya existe el permiso por código único
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'puntos_criticos:eliminar';

      IF v_permiso_id IS NULL THEN
        -- Si el ID target estuviera ocupado, generar uno aleatorio seguro
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'puntos_criticos:eliminar',
            'Eliminar Puntos Críticos',
            'Permite dar de baja lógica puntos críticos y sectores vulnerables del catálogo comunal',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'puntos_criticos:eliminar',
            'Eliminar Puntos Críticos',
            'Permite dar de baja lógica puntos críticos y sectores vulnerables del catálogo comunal',
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
  await sql`
    DELETE FROM rol_permiso 
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'puntos_criticos:eliminar');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'puntos_criticos:eliminar';`.execute(db);

  await db.schema.dropIndex("idx_prevencion_eliminado_por").ifExists().execute();
  await db.schema.dropIndex("idx_prevencion_eliminado_en").ifExists().execute();
  await sql`
    ALTER TABLE prevencion 
    DROP COLUMN IF EXISTS eliminado_por_id,
    DROP COLUMN IF EXISTS eliminado_en;
  `.execute(db);
}
