import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Crear tabla mision_hito para registrar la trazabilidad cronológica de hitos de la misión
  await db.schema
    .createTable("mision_hito")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("mision_id", "uuid", (col) =>
      col.notNull().references("mision.id").onDelete("cascade")
    )
    .addColumn("hito", "varchar(50)", (col) => col.notNull())
    .addColumn("descripcion", "text", (col) => col.notNull())
    .addColumn("registrado_por_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("latitud", "decimal(10, 7)")
    .addColumn("longitud", "decimal(10, 7)")
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 2. Índices para acelerar consultas por misión y orden temporal
  await db.schema
    .createIndex("idx_mision_hito_mision_id")
    .ifNotExists()
    .on("mision_hito")
    .column("mision_id")
    .execute();

  await db.schema
    .createIndex("idx_mision_hito_creado_en")
    .ifNotExists()
    .on("mision_hito")
    .column("creado_en")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("mision_hito").ifExists().execute();
}
