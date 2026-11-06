import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Columnas de auditoría y borrado lógico en cuadrilla
  await sql`
    ALTER TABLE cuadrilla
    ADD COLUMN IF NOT EXISTS creado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actualizado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Índice único para nombre de cuadrilla (case-insensitive y sin espacios superfluos) para registros activos
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cuadrilla_nombre_unique 
    ON cuadrilla (LOWER(TRIM(nombre))) 
    WHERE eliminado_en IS NULL;
  `.execute(db);

  // 3. Índices de optimización en cuadrilla
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_delegacion ON cuadrilla (delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_usuario_delegado ON cuadrilla (usuario_delegado_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_creado_por ON cuadrilla (creado_por_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_eliminado_en ON cuadrilla (eliminado_en);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_eliminado_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_creado_por;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_usuario_delegado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_delegacion;`.execute(db);
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
