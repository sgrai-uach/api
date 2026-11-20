import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para fecha estimada de finalización y auditoría de edición en evento_prevencion (H77)
  await sql`
    ALTER TABLE evento_prevencion
    ADD COLUMN IF NOT EXISTS fecha_estimada_fin TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice de apoyo para consultas de auditoría por usuario editor
  await db.schema
    .createIndex("idx_evento_prevencion_actualizado_por")
    .ifNotExists()
    .on("evento_prevencion")
    .column("actualizado_por_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex("idx_evento_prevencion_actualizado_por")
    .ifExists()
    .execute();

  await sql`
    ALTER TABLE evento_prevencion
    DROP COLUMN IF EXISTS actualizado_por_id,
    DROP COLUMN IF EXISTS fecha_estimada_fin;
  `.execute(db);
}
