import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla delegacion (Dependencias territoriales de la Municipalidad de Valdivia)
  await db.schema
    .createTable("delegacion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo_delegacion", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("nombre_delegacion", "varchar(150)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex("idx_delegacion_codigo")
    .ifNotExists()
    .on("delegacion")
    .column("codigo_delegacion")
    .execute();

  // 2. Semillas iniciales para Delegaciones Territoriales de Valdivia
  await sql`
    INSERT INTO delegacion (id, codigo_delegacion, nombre_delegacion, descripcion, activo)
    VALUES
      ('30000000-0000-4000-8000-000000000001', 'DEL_NORTE', 'Delegación Municipal Norte', 'Jurisdicción y cobertura territorial norte de Valdivia (Las Ánimas, Cabo Blanco)', true),
      ('30000000-0000-4000-8000-000000000002', 'DEL_SUR', 'Delegación Municipal Sur', 'Jurisdicción y cobertura territorial sur de Valdivia (Angachilla, Guacamayo)', true),
      ('30000000-0000-4000-8000-000000000003', 'DEL_COSTA', 'Delegación Municipal Costa', 'Jurisdicción y cobertura territorial zona costera (Niebla, Los Molinos, Corral)', true),
      ('30000000-0000-4000-8000-000000000004', 'DEL_CALLE_CALLE', 'Delegación Municipal Calle Calle', 'Jurisdicción y cobertura territorial eje fluvial e interior (Collico, Corvi)', true)
    ON CONFLICT (codigo_delegacion) DO NOTHING;
  `.execute(db);

  // 3. Tabla recurso (Inventario de materiales, maquinaria y vehículos)
  await db.schema
    .createTable("recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(255)", (col) => col.notNull())
    .addColumn("es_individual", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("estado", "varchar(50)", (col) => col.notNull().defaultTo("DISPONIBLE"))
    .addColumn("cantidad_inventario", "integer", (col) => col.notNull().check(sql`cantidad_inventario >= 0`))
    .addColumn("cantidad_en_uso", "integer", (col) => col.notNull().defaultTo(0).check(sql`cantidad_en_uso >= 0`))
    .addColumn("cantidad_minima", "integer", (col) => col.notNull().defaultTo(0).check(sql`cantidad_minima >= 0`))
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("descripcion", "text")
    .addColumn("detalles", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("delegacion_id", "uuid", (col) => col.references("delegacion.id").onDelete("set null"))
    .addColumn("creado_por_id", "uuid", (col) => col.notNull().references("usuario.id"))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Asegura columna delegacion_id si recurso ya existía localmente
  await sql`
    ALTER TABLE recurso 
    ADD COLUMN IF NOT EXISTS delegacion_id UUID REFERENCES delegacion(id) ON DELETE SET NULL;
  `.execute(db);

  // 4. Índices para optimización de consultas (< 1.5s) y filtros
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

  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_ubicacion ON recurso USING GIST (ubicacion)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recurso_detalles ON recurso USING GIN (detalles)`.execute(db);

  // 5. Permiso RBAC para consultar el inventario logístico
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000010',
      'recursos:leer',
      'Listar Recursos',
      'Permite consultar el listado del inventario logístico y verificar la disponibilidad de recursos',
      'Recursos y Personal'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  // Asignar permiso 'recursos:leer' al Administrador
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    VALUES (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000001'
    )
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_recurso_detalles").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_ubicacion").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_creado_en").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_estado").ifExists().execute();
  await db.schema.dropIndex("idx_recurso_delegacion").ifExists().execute();
  await db.schema.dropTable("recurso").ifExists().execute();

  await db.schema.dropIndex("idx_delegacion_codigo").ifExists().execute();
  await db.schema.dropTable("delegacion").ifExists().execute();

  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000010'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'recursos:leer'`.execute(db);
}
