import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columna mision_id a evento_prevencion_recurso para vincular insumos a misiones tácticas específicas (HU-33)
  await sql`
    ALTER TABLE evento_prevencion_recurso
    ADD COLUMN IF NOT EXISTS mision_id UUID REFERENCES mision(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice de apoyo para consultar insumos por misión preventiva
  await db.schema
    .createIndex("idx_evento_prevencion_recurso_mision")
    .ifNotExists()
    .on("evento_prevencion_recurso")
    .column("mision_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex("idx_evento_prevencion_recurso_mision")
    .ifExists()
    .execute();

  await sql`
    ALTER TABLE evento_prevencion_recurso
    DROP COLUMN IF EXISTS mision_id;
  `.execute(db);
}
