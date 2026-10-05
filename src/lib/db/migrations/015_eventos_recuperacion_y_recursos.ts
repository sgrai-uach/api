import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla recuperacion (Eventos e intervenciones territoriales de recuperación)
  await db.schema
    .createTable("recuperacion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("sector", "varchar(150)", (col) => col.notNull())
    .addColumn("direccion_texto", "varchar(255)")
    .addColumn("prioridad", "varchar(20)", (col) => col.notNull().defaultTo("MEDIA"))
    .addColumn("contacto_nombre", "varchar(150)")
    .addColumn("contacto_telefono", "varchar(50)")
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("estado", "varchar(50)", (col) => col.notNull().defaultTo("PLANIFICADA"))
    .addColumn("familias_afectadas", "integer", (col) => col.notNull().defaultTo(0).check(sql`familias_afectadas >= 0`))
    .addColumn("delegacion_id", "uuid", (col) => col.references("delegacion.id").onDelete("set null"))
    .addColumn("creado_por_id", "uuid", (col) => col.notNull().references("usuario.id").onDelete("restrict"))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_ubicacion ON recuperacion USING GIST (ubicacion);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_estado ON recuperacion (estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_delegacion ON recuperacion (delegacion_id);`.execute(db);

  // 2. Tabla recuperacion_recurso (Insumos logísticos entregados o asignados al evento de recuperación)
  await db.schema
    .createTable("recuperacion_recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("recuperacion_id", "uuid", (col) => col.notNull().references("recuperacion.id").onDelete("cascade"))
    .addColumn("recurso_id", "uuid", (col) => col.notNull().references("recurso.id").onDelete("restrict"))
    .addColumn("cantidad_asignada", "integer", (col) => col.notNull().check(sql`cantidad_asignada > 0`))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_recurso_rec ON recuperacion_recurso (recuperacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_recuperacion_recurso_rec_id ON recuperacion_recurso (recurso_id);`.execute(db);

  // 3. Vincular recuperacion_id en mision
  await sql`
    ALTER TABLE mision 
    ADD COLUMN IF NOT EXISTS recuperacion_id UUID REFERENCES recuperacion(id) ON DELETE SET NULL;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_mision_recuperacion ON mision (recuperacion_id);`.execute(db);

  // 4. Registrar permiso RBAC recuperacion:crear y asignarlo a ENCARGADO y ADMIN
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000016';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:crear';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'recuperacion:crear',
            'Crear Evento de Recuperación',
            'Permite generar eventos de recuperación y despachar patrullas con recursos sin incidente formal previo',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'recuperacion:crear',
            'Crear Evento de Recuperación',
            'Permite generar eventos de recuperación y despachar patrullas con recursos sin incidente formal previo',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      IF v_permiso_id IS NOT NULL THEN
        -- Asignar a Administrador
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        -- Asignar a Encargado
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_encargado_rol_id, v_permiso_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso 
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'recuperacion:crear');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'recuperacion:crear';`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_mision_recuperacion;`.execute(db);
  await sql`ALTER TABLE mision DROP COLUMN IF EXISTS recuperacion_id;`.execute(db);

  await db.schema.dropTable("recuperacion_recurso").ifExists().execute();
  await db.schema.dropTable("recuperacion").ifExists().execute();
}
