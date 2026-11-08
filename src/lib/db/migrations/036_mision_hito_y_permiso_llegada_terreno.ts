import { sql, type Kysely } from "kysely";

/**
 * Migración 036: Tabla mision_hito y permiso RBAC misiones:terreno:ejecutar (HU-42)
 *
 * 1. Crea la tabla mision_hito si no existe para la bitácora cronológica de hitos de misión.
 * 2. Registra el permiso RBAC 'misiones:terreno:ejecutar' y lo asigna a DELEGADO_CUADRILLA y ADMIN.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla mision_hito (Bitácora cronológica e inmutable de eventos e hitos en terreno)
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
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Asegurar que si la tabla ya existía sin la columna PostGIS 'ubicacion', se incorpore de forma segura
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mision_hito' AND column_name = 'ubicacion'
      ) THEN
        ALTER TABLE mision_hito ADD COLUMN ubicacion GEOMETRY(Point, 4326);
      END IF;
    END $$;
  `.execute(db);

  // Índices para acelerar consultas de bitácora y análisis geoespacial
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

  await sql`CREATE INDEX IF NOT EXISTS idx_mision_hito_ubicacion ON mision_hito USING GIST (ubicacion);`.execute(db);

  // 2. Permiso RBAC 'misiones:terreno:ejecutar'
  const permisoId = "10000000-0000-4000-8000-000000000042";
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      ${permisoId},
      'misiones:terreno:ejecutar',
      'Ejecutar Misiones en Terreno',
      'Permite a cuadrillas y personal operativo reportar hitos en terreno como llegada y avances',
      'Misiones'
    )
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      modulo = EXCLUDED.modulo;
  `.execute(db);

  // 3. Asignar permiso a DELEGADO_CUADRILLA y ADMIN
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT r.id, p.id, '00000000-0000-4000-8000-000000000001'::uuid
    FROM rol r
    CROSS JOIN permiso p
    WHERE p.codigo = 'misiones:terreno:ejecutar'
      AND r.codigo IN ('DELEGADO_CUADRILLA', 'ADMIN')
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso 
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'misiones:terreno:ejecutar');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'misiones:terreno:ejecutar';`.execute(db);
  await db.schema.dropTable("mision_hito").ifExists().execute();
}

