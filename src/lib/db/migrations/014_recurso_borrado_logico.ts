import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para borrado lógico y auditoría
  await sql`
    ALTER TABLE recurso 
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índices para optimizar consultas de recursos activos y auditoría
  await db.schema
    .createIndex("idx_recurso_eliminado_en")
    .ifNotExists()
    .on("recurso")
    .column("eliminado_en")
    .execute();

  await db.schema
    .createIndex("idx_recurso_eliminado_por")
    .ifNotExists()
    .on("recurso")
    .column("eliminado_por_id")
    .execute();

  // 3. Permiso RBAC para eliminar (dar de baja lógica) recursos (HU-9)
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000012',
      'recursos:eliminar',
      'Eliminar Recursos',
      'Permite dar de baja lógica recursos del inventario',
      'Recursos y Personal'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  // 4. Asignar permiso 'recursos:eliminar' al rol Administrador
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    VALUES (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000001'
    )
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000012'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'recursos:eliminar'`.execute(db);

  await db.schema.dropIndex("idx_recurso_eliminado_por").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_eliminado_en").ifExists().execute();
  await sql`
    ALTER TABLE recurso 
    DROP COLUMN IF EXISTS eliminado_por_id,
    DROP COLUMN IF EXISTS eliminado_en;
  `.execute(db);
}
