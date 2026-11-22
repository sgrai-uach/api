import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para baja lógica y auditoría de desactivación a patrulla_verificadora (HU-85)
  await sql`
    ALTER TABLE patrulla_verificadora
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índices de optimización para filtrado de patrullas activas y auditoría
  await db.schema
    .createIndex("idx_patrulla_activo")
    .ifNotExists()
    .on("patrulla_verificadora")
    .column("activo")
    .execute();

  await db.schema
    .createIndex("idx_patrulla_eliminado_por")
    .ifNotExists()
    .on("patrulla_verificadora")
    .column("eliminado_por_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_patrulla_eliminado_por").ifExists().execute();
  await db.schema.dropIndex("idx_patrulla_activo").ifExists().execute();

  await sql`
    ALTER TABLE patrulla_verificadora
    DROP COLUMN IF EXISTS eliminado_por_id,
    DROP COLUMN IF EXISTS activo;
  `.execute(db);
}
