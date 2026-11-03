import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Columnas de auditoría y borrado lógico en cuadrilla (idempotente)
  await sql`
    ALTER TABLE cuadrilla
    ADD COLUMN IF NOT EXISTS creado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice único para nombre de cuadrilla (case-insensitive) en registros activos
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cuadrilla_nombre_unique 
    ON cuadrilla (LOWER(TRIM(nombre))) 
    WHERE eliminado_en IS NULL;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_actualizado_en ON cuadrilla (actualizado_en);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_eliminado_en ON cuadrilla (eliminado_en);`.execute(db);

  // 3. Tabla puente cuadrilla_personal (Dotación humana operativa asignada)
  await db.schema
    .createTable("cuadrilla_personal")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("cuadrilla_id", "uuid", (col) =>
      col.notNull().references("cuadrilla.id").onDelete("cascade")
    )
    .addColumn("personal_id", "uuid", (col) =>
      col.notNull().references("personal.id").onDelete("restrict")
    )
    .addColumn("asignado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addUniqueConstraint("uq_cuadrilla_personal", ["cuadrilla_id", "personal_id"])
    .execute();

  // 4. Índices para cuadrilla_personal
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_personal_cuadrilla ON cuadrilla_personal (cuadrilla_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_personal_personal ON cuadrilla_personal (personal_id);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_personal_personal;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_personal_cuadrilla;`.execute(db);
  await db.schema.dropTable("cuadrilla_personal").ifExists().execute();

  await sql`DROP INDEX IF EXISTS idx_cuadrilla_eliminado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_actualizado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_nombre_unique;`.execute(db);

  await sql`
    ALTER TABLE cuadrilla
    DROP COLUMN IF EXISTS eliminado_por_id,
    DROP COLUMN IF EXISTS eliminado_en,
    DROP COLUMN IF EXISTS actualizado_en,
    DROP COLUMN IF EXISTS actualizado_por_id,
    DROP COLUMN IF EXISTS creado_por_id;
  `.execute(db);
}
