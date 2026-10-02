import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla reporte_terreno (Informe técnico estructurado emitido tras intervención en terreno)
  await db.schema
    .createTable("reporte_terreno")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("mision_id", "uuid", (col) =>
      col.notNull().references("mision.id").onDelete("cascade")
    )
    .addColumn("evaluador_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("restrict")
    )
    .addColumn("resumen_tecnico", "text", (col) => col.notNull())
    .addColumn("acciones_realizadas", "text")
    .addColumn("requiere_apoyo_adicional", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn("danos_estimados", "text")
    .addColumn("observaciones", "text")
    .addColumn("personas_afectadas", "integer", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("estado_terreno", "varchar(50)", (col) =>
      col.notNull().defaultTo("FINALIZADO")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_reporte_terreno_mision_id ON reporte_terreno (mision_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_reporte_terreno_evaluador_id ON reporte_terreno (evaluador_id);`.execute(db);

  // 2. Asociar evidencia multimedia (adjunto) al reporte de terreno
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'adjunto' AND column_name = 'reporte_terreno_id'
      ) THEN
        ALTER TABLE adjunto 
        ADD COLUMN reporte_terreno_id UUID REFERENCES reporte_terreno(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_adjunto_reporte_terreno_id ON adjunto (reporte_terreno_id);`.execute(db);

  // 3. Permiso RBAC para visualizar detalle de misiones (HU-17)
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000013',
      'misiones:leer',
      'Visualizar Detalle de Misiones',
      'Permite consultar el detalle exhaustivo de misiones operativas, incidentes asociados y reportes de terreno',
      'Misiones'
    )
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      modulo = EXCLUDED.modulo;
  `.execute(db);

  // 4. Asignar permiso 'misiones:leer' a Administrador, Encargado y Supervisor
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    VALUES
      ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001'),
      ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001'),
      ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001')
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000013';`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'misiones:leer';`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_adjunto_reporte_terreno_id;`.execute(db);
  await sql`ALTER TABLE adjunto DROP COLUMN IF EXISTS reporte_terreno_id;`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_reporte_terreno_evaluador_id;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_reporte_terreno_mision_id;`.execute(db);
  await db.schema.dropTable("reporte_terreno").ifExists().execute();
}
