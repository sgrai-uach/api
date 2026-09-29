import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Extensiones PostGIS y UUID
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "postgis"`.execute(db);

  // Tabla Permiso
  await db.schema
    .createTable("permiso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Tabla Rol
  await db.schema
    .createTable("rol")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Tabla RolPermiso (N:N según DER)
  await db.schema
    .createTable("rol_permiso")
    .ifNotExists()
    .addColumn("rol_id", "uuid", (col) => col.notNull().references("rol.id").onDelete("cascade"))
    .addColumn("permiso_id", "uuid", (col) => col.notNull().references("permiso.id").onDelete("cascade"))
    .addPrimaryKeyConstraint("pk_rol_permiso", ["rol_id", "permiso_id"])
    .execute();

  // Tabla Usuario (N:1 con Rol según DER)
  await db.schema
    .createTable("usuario")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("rut", "varchar(12)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("rol_id", "uuid", (col) => col.notNull().references("rol.id"))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Tabla Recurso
  await db.schema
    .createTable("recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(255)", (col) => col.notNull())
    .addColumn("es_individual", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("estado", "varchar(50)", (col) => col.notNull())
    .addColumn("cantidad_inventario", "integer", (col) => col.notNull().check(sql`cantidad_inventario >= 0`))
    .addColumn("cantidad_en_uso", "integer", (col) => col.notNull().defaultTo(0).check(sql`cantidad_en_uso >= 0`))
    .addColumn("cantidad_minima", "integer", (col) => col.notNull().defaultTo(0).check(sql`cantidad_minima >= 0`))
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("descripcion", "text")
    .addColumn("detalles", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("creado_por_id", "uuid", (col) => col.notNull().references("usuario.id"))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Índices espaciales y JSONB
  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_ubicacion ON recurso USING GIST (ubicacion)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_detalles ON recurso USING GIN (detalles)`.execute(db);

  // Semillas iniciales para desarrollo y testing
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion)
    VALUES ('10000000-0000-0000-0000-000000000001', 'recursos:crear', 'Crear Recursos', 'Permite crear nuevos recursos en el inventario logístico')
    ON CONFLICT (codigo) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO rol (id, nombre, descripcion)
    VALUES ('20000000-0000-0000-0000-000000000001', 'Administrador', 'Rol con acceso administrativo completo')
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
    ON CONFLICT DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO usuario (id, rut, nombre, email, rol_id)
    VALUES ('00000000-0000-0000-0000-000000000001', '11111111-1', 'Administrador General', 'admin@valdivia.cl', '20000000-0000-0000-0000-000000000001')
    ON CONFLICT (email) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("recurso").ifExists().execute();
  await db.schema.dropTable("usuario").ifExists().execute();
  await db.schema.dropTable("rol_permiso").ifExists().execute();
  await db.schema.dropTable("rol").ifExists().execute();
  await db.schema.dropTable("permiso").ifExists().execute();
}
