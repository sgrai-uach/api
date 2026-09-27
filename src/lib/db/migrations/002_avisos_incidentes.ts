import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Tabla AvisoIncidente
  await db.schema
    .createTable("aviso_incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo_seguimiento", "varchar(20)", (col) => col.notNull())
    .addColumn("tipo_afectacion", "varchar(100)", (col) => col.notNull())
    .addColumn("direccion_texto", "text", (col) => col.notNull())
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`, (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("informante_nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("informante_rut", "varchar(12)", (col) => col.notNull())
    .addColumn("informante_telefono", "varchar(20)")
    .addColumn("estado", "varchar(50)", (col) => col.notNull().defaultTo("PENDIENTE_VERIFICACION"))
    .addColumn("es_duplicado", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("aviso_original_id", "uuid", (col) => col.references("aviso_incidente.id").onDelete("set null"))
    .addColumn("incidente_id", "uuid")
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Índices para búsquedas espaciales, código de seguimiento y detección de duplicados
  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_ubicacion ON aviso_incidente USING GIST (ubicacion)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_codigo ON aviso_incidente (codigo_seguimiento)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_tipo_creado ON aviso_incidente (tipo_afectacion, creado_en)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("aviso_incidente").ifExists().execute();
}
