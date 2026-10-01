import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla recurso (Inventario logístico, maquinaria, vehículos y materiales)
  await db.schema
    .createTable("recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(255)", (col) => col.notNull())
    .addColumn("es_individual", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("estado", "varchar(50)", (col) => col.notNull().defaultTo("DISPONIBLE"))
    .addColumn("cantidad_inventario", "integer", (col) =>
      col.notNull().check(sql`cantidad_inventario >= 0`)
    )
    .addColumn("cantidad_en_uso", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`cantidad_en_uso >= 0`)
    )
    .addColumn("cantidad_minima", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`cantidad_minima >= 0`)
    )
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("descripcion", "text")
    .addColumn("detalles", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("delegacion_id", "uuid", (col) =>
      col.references("delegacion.id").onDelete("set null")
    )
    .addColumn("creado_por_id", "uuid", (col) =>
      col.notNull().references("usuario.id")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await db.schema
    .createIndex("idx_recurso_delegacion")
    .ifNotExists()
    .on("recurso")
    .column("delegacion_id")
    .execute();

  await db.schema
    .createIndex("idx_recurso_estado")
    .ifNotExists()
    .on("recurso")
    .column("estado")
    .execute();

  await db.schema
    .createIndex("idx_recurso_creado_en")
    .ifNotExists()
    .on("recurso")
    .column("creado_en")
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_ubicacion ON recurso USING GIST (ubicacion);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_detalles ON recurso USING GIN (detalles);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_recurso_detalles").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_ubicacion").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_creado_en").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_estado").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_delegacion").ifExists().execute();
  await db.schema.dropTable("recurso").ifExists().execute();
}
