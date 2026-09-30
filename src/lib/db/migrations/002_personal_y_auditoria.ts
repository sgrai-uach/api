import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tipo enum para estado operativo de personal
  await sql`
    DO $$ BEGIN
      CREATE TYPE estado_operativo_personal AS ENUM (
        'disponible',
        'en_mision',
        'en_patrulla',
        'descanso',
        'licencia',
        'inactivo'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  // 2. Tabla personal (Funcionarios operativos desplegables a terreno)
  await sql`
    CREATE TABLE IF NOT EXISTS personal (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID UNIQUE NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      delegacion_id UUID NOT NULL REFERENCES delegacion(id) ON DELETE RESTRICT,
      especialidad VARCHAR(100),
      cargo VARCHAR(100),
      estado_operativo estado_operativo_personal NOT NULL DEFAULT 'disponible',
      disponible_terreno BOOLEAN NOT NULL DEFAULT TRUE,
      ultima_ubicacion GEOMETRY(Point, 4326),
      ultima_actualizacion_ubicacion TIMESTAMPTZ,
      observaciones TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_personal_usuario_id ON personal(usuario_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_personal_delegacion_id ON personal(delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_personal_estado_operativo ON personal(estado_operativo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_personal_disponible_terreno ON personal(disponible_terreno);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_personal_ultima_ubicacion ON personal USING GIST(ultima_ubicacion);`.execute(db);

  // 3. Tabla log_cambios_usuarios (Auditoría de modificaciones a empleados y usuarios)
  await db.schema
    .createTable("log_cambios_usuarios")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("usuario_modificado_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("cascade")
    )
    .addColumn("modificado_por_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("campos_modificados", "jsonb", (col) => col.notNull())
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_log_cambios_usuarios_usuario ON log_cambios_usuarios(usuario_modificado_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_log_cambios_usuarios_admin ON log_cambios_usuarios(modificado_por_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_log_cambios_usuarios_created ON log_cambios_usuarios(creado_en);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("log_cambios_usuarios").ifExists().execute();
  await db.schema.dropTable("personal").ifExists().execute();
  await sql`DROP TYPE IF EXISTS estado_operativo_personal;`.execute(db);
}
