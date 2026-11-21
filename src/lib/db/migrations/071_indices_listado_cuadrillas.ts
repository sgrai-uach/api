import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Índices parciales sobre registros activos para optimizar los filtros de listado de cuadrillas (H80)
  // Filtro territorial principal
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_delegacion_id
    ON cuadrilla (delegacion_id)
    WHERE eliminado_en IS NULL;
  `.execute(db);

  // Filtro por estado operativo
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_estado
    ON cuadrilla (estado)
    WHERE eliminado_en IS NULL;
  `.execute(db);

  // Filtro combinado AND (delegación + estado)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_delegacion_estado
    ON cuadrilla (delegacion_id, estado)
    WHERE eliminado_en IS NULL;
  `.execute(db);

  // Orden predeterminado del listado (DESC)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cuadrilla_creado_en_desc
    ON cuadrilla (creado_en DESC)
    WHERE eliminado_en IS NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_creado_en_desc;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_delegacion_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cuadrilla_delegacion_id;`.execute(db);
}

