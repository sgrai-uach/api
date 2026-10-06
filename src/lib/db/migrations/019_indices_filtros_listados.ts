import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Índices para filtros frecuentes del Encargado (H34)
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_delegacion_id ON incidente(delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_estado ON incidente(estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_fuente_origen ON incidente(fuente_origen);`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_mision_estado ON mision(estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_tipo_mision ON mision(tipo_mision);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_incidente_id ON mision(incidente_id);`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_personal_estado_operativo ON personal(estado_operativo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_personal_delegacion_id ON personal(delegacion_id);`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_delegacion_id ON recurso(delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_estado ON recurso(estado);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_incidente_delegacion_id;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_incidente_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_incidente_fuente_origen;`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_mision_estado;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_mision_tipo_mision;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_mision_incidente_id;`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_personal_estado_operativo;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_personal_delegacion_id;`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_recurso_delegacion_id;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_recurso_estado;`.execute(db);
}
