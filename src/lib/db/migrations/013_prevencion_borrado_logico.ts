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

  // 3. Permiso RBAC para eliminar (dar de baja lógica) puntos críticos (HU-56)
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000014',
      'puntos_criticos:eliminar',
      'Eliminar Puntos Críticos',
      'Permite dar de baja lógica puntos críticos y sectores vulnerables del catálogo comunal',
      'Eventos ATP'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  // 4. Asignar permiso 'puntos_criticos:eliminar' al rol Administrador del SGRAI
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    VALUES (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000014',
      '00000000-0000-4000-8000-000000000001'
    )
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000014'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'puntos_criticos:eliminar'`.execute(db);

  await db.schema.dropIndex("idx_prevencion_eliminado_por").ifExists().execute();
  await db.schema.dropIndex("idx_prevencion_eliminado_en").ifExists().execute();
  await sql`
    ALTER TABLE prevencion 
    DROP COLUMN IF EXISTS eliminado_por_id,
    DROP COLUMN IF EXISTS eliminado_en;
  `.execute(db);
}
