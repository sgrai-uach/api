import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Ampliar tabla patrulla_verificadora con auditoría, borrado lógico y geolocalización
  await sql`
    ALTER TABLE patrulla_verificadora
    ADD COLUMN IF NOT EXISTS latitud DECIMAL(10, 7) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS longitud DECIMAL(10, 7) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ubicacion GEOMETRY(Point, 4326) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ultima_actualizacion_ubicacion TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL;
  `.execute(db);

  // 2. Índices de auditoría y espaciales para patrulla_verificadora
  await db.schema
    .createIndex("idx_patrulla_eliminado_en")
    .ifNotExists()
    .on("patrulla_verificadora")
    .column("eliminado_en")
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_patrulla_ubicacion
    ON patrulla_verificadora USING GIST (ubicacion);
  `.execute(db);

  // 3. Crear tabla patrulla_personal para asignación de funcionarios de terreno múltiples
  await sql`
    CREATE TABLE IF NOT EXISTS patrulla_personal (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patrulla_id UUID NOT NULL REFERENCES patrulla_verificadora(id) ON DELETE CASCADE,
      personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
      rol_en_patrulla VARCHAR(50) NOT NULL DEFAULT 'OPERATIVO',
      asignado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_patrulla_personal UNIQUE (patrulla_id, personal_id)
    );
  `.execute(db);

  await db.schema
    .createIndex("idx_patrulla_personal_patrulla")
    .ifNotExists()
    .on("patrulla_personal")
    .column("patrulla_id")
    .execute();

  await db.schema
    .createIndex("idx_patrulla_personal_personal")
    .ifNotExists()
    .on("patrulla_personal")
    .column("personal_id")
    .execute();

  // 4. Sembrar coordenadas iniciales en Valdivia para patrullas existentes
  await sql`
    UPDATE patrulla_verificadora
    SET
      latitud = -39.865230,
      longitud = -73.398410,
      ubicacion = ST_SetSRID(ST_MakePoint(-73.398410, -39.865230), 4326),
      ultima_actualizacion_ubicacion = CURRENT_TIMESTAMP
    WHERE id = 'f1000000-0000-4000-8000-000000000001' AND latitud IS NULL;
  `.execute(db);

  await sql`
    UPDATE patrulla_verificadora
    SET
      latitud = -39.825120,
      longitud = -73.238490,
      ubicacion = ST_SetSRID(ST_MakePoint(-73.238490, -39.825120), 4326),
      ultima_actualizacion_ubicacion = CURRENT_TIMESTAMP
    WHERE id = 'f1000000-0000-4000-8000-000000000002' AND latitud IS NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("patrulla_personal").ifExists().execute();

  await sql`
    ALTER TABLE patrulla_verificadora
    DROP COLUMN IF EXISTS latitud,
    DROP COLUMN IF EXISTS longitud,
    DROP COLUMN IF EXISTS ubicacion,
    DROP COLUMN IF EXISTS ultima_actualizacion_ubicacion,
    DROP COLUMN IF EXISTS actualizado_en,
    DROP COLUMN IF EXISTS eliminado_en;
  `.execute(db);
}
