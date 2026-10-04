import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para auditoría y trazabilidad de edición a la tabla prevencion
  await sql`
    ALTER TABLE prevencion 
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice para consultas de auditoría por usuario editor
  await db.schema
    .createIndex("idx_prevencion_actualizado_por")
    .ifNotExists()
    .on("prevencion")
    .column("actualizado_por_id")
    .execute();

  // 3. Registrar permiso RBAC para editar puntos críticos existentes (HU-55)
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000017';
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'puntos_criticos:editar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'puntos_criticos:editar',
            'Editar Puntos Críticos',
            'Permite modificar características, factores de riesgo y coordenadas geográficas de puntos críticos existentes',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'puntos_criticos:editar',
            'Editar Puntos Críticos',
            'Permite modificar características, factores de riesgo y coordenadas geográficas de puntos críticos existentes',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      -- 4. Asignar permiso 'puntos_criticos:editar' al rol Administrador
      INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
      VALUES (
        '20000000-0000-4000-8000-000000000001',
        v_permiso_id,
        '00000000-0000-4000-8000-000000000001'
      )
      ON CONFLICT DO NOTHING;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'puntos_criticos:editar');
    DELETE FROM permiso WHERE codigo = 'puntos_criticos:editar';
  `.execute(db);

  await db.schema.dropIndex("idx_prevencion_actualizado_por").ifExists().execute();
  await sql`ALTER TABLE prevencion DROP COLUMN IF EXISTS actualizado_por_id;`.execute(db);
  await sql`ALTER TABLE prevencion DROP COLUMN IF EXISTS actualizado_en;`.execute(db);
}
