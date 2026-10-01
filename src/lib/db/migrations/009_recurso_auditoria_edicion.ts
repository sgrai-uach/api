import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columna actualizado_por_id para trazabilidad de auditoría
  await sql`
    ALTER TABLE recurso 
    ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice para consultas de auditoría por usuario editor
  await db.schema
    .createIndex("idx_recurso_actualizado_por")
    .ifNotExists()
    .on("recurso")
    .column("actualizado_por_id")
    .execute();

  // 3. Permiso RBAC para editar recursos existentes (HU-8)
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000011',
      'recursos:editar',
      'Editar Recursos',
      'Permite modificar características, inventario y estado operativo de recursos existentes',
      'Recursos y Personal'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  // 4. Asignar permiso 'recursos:editar' al rol Administrador
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    VALUES (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000001'
    )
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000011'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'recursos:editar'`.execute(db);

  await db.schema.dropIndex("idx_recurso_actualizado_por").ifExists().execute();
  await sql`ALTER TABLE recurso DROP COLUMN IF EXISTS actualizado_por_id;`.execute(db);
}
