import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla evento_prevencion (Eventos e intervenciones territoriales preventivas)
  await db.schema
    .createTable("evento_prevencion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text", (col) => col.notNull())
    .addColumn("prioridad", "varchar(20)", (col) => col.notNull().defaultTo("MEDIA"))
    .addColumn("estado", "varchar(50)", (col) => col.notNull().defaultTo("PLANIFICADA"))
    .addColumn("sector", "varchar(150)")
    .addColumn("direccion_texto", "varchar(255)")
    .addColumn("punto_critico_id", "uuid", (col) =>
      col.references("prevencion.id").onDelete("set null")
    )
    .addColumn("delegacion_id", "uuid", (col) =>
      col.notNull().references("delegacion.id").onDelete("restrict")
    )
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("creado_por_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("restrict")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_evento_prevencion_ubicacion ON evento_prevencion USING GIST (ubicacion);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_prevencion_estado ON evento_prevencion (estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_prevencion_delegacion ON evento_prevencion (delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_prevencion_punto_critico ON evento_prevencion (punto_critico_id);`.execute(db);

  // 2. Tabla evento_prevencion_recurso (Recursos e insumos asignados al evento preventivo)
  await db.schema
    .createTable("evento_prevencion_recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("evento_prevencion_id", "uuid", (col) =>
      col.notNull().references("evento_prevencion.id").onDelete("cascade")
    )
    .addColumn("recurso_id", "uuid", (col) =>
      col.notNull().references("recurso.id").onDelete("restrict")
    )
    .addColumn("cantidad_asignada", "integer", (col) =>
      col.notNull().check(sql`cantidad_asignada > 0`)
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_evento_prev_rec_evento ON evento_prevencion_recurso (evento_prevencion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_prev_rec_recurso ON evento_prevencion_recurso (recurso_id);`.execute(db);

  // 3. Vincular evento_prevencion_id en mision
  await sql`
    ALTER TABLE mision 
    ADD COLUMN IF NOT EXISTS evento_prevencion_id UUID REFERENCES evento_prevencion(id) ON DELETE SET NULL;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_mision_evento_prevencion ON mision (evento_prevencion_id);`.execute(db);

  // 4. Registrar permiso RBAC prevencion:eventos:crear y asignarlo a ENCARGADO y ADMIN
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000017';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'prevencion:eventos:crear';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'prevencion:eventos:crear',
            'Crear Evento de Prevención',
            'Permite generar eventos de prevención, asignar recursos y despachar patrullas a puntos críticos sin requerir incidente previo',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'prevencion:eventos:crear',
            'Crear Evento de Prevención',
            'Permite generar eventos de prevención, asignar recursos y despachar patrullas a puntos críticos sin requerir incidente previo',
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
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'prevencion:eventos:crear');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'prevencion:eventos:crear';`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_mision_evento_prevencion;`.execute(db);
  await sql`ALTER TABLE mision DROP COLUMN IF EXISTS evento_prevencion_id;`.execute(db);

  await db.schema.dropTable("evento_prevencion_recurso").ifExists().execute();
  await db.schema.dropTable("evento_prevencion").ifExists().execute();
}
