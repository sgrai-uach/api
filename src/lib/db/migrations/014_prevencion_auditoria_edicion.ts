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
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000014',
      'puntos_criticos:editar',
      'Editar Puntos Críticos',
      'Permite modificar características, factores de riesgo y coordenadas geográficas de puntos críticos existentes',
      'Eventos ATP'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  // 4. Asignar permiso 'puntos_criticos:editar' al rol Administrador
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
  await sql`DELETE FROM permiso WHERE codigo = 'puntos_criticos:editar'`.execute(db);

  await db.schema.dropIndex("idx_prevencion_actualizado_por").ifExists().execute();
  await sql`ALTER TABLE prevencion DROP COLUMN IF EXISTS actualizado_por_id;`.execute(db);
  await sql`ALTER TABLE prevencion DROP COLUMN IF EXISTS actualizado_en;`.execute(db);
}
