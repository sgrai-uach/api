import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla token_recuperacion_contrasena
  await db.schema
    .createTable("token_recuperacion_contrasena")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("usuario_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("cascade")
    )
    .addColumn("token_hash", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("expira_en", "timestamptz", (col) => col.notNull())
    .addColumn("usado_en", "timestamptz")
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 2. Constraint de validación temporal
  await sql`
    ALTER TABLE token_recuperacion_contrasena
    ADD CONSTRAINT chk_token_recuperacion_expiracion
    CHECK (expira_en > creado_en);
  `.execute(db);

  // 3. Índices para optimización de consultas de seguridad
  await sql`
    CREATE INDEX IF NOT EXISTS idx_token_rec_usuario_creado
    ON token_recuperacion_contrasena (usuario_id, creado_en DESC);
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_token_rec_expira_en
    ON token_recuperacion_contrasena (expira_en);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_token_rec_expira_en;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_token_rec_usuario_creado;`.execute(db);
  await db.schema.dropTable("token_recuperacion_contrasena").ifExists().execute();
}
