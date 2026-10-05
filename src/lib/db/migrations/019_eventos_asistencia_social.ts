import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla evento_asistencia_social (Eventos excepcionales y requerimientos de FIBE)
  await db.schema
    .createTable("evento_asistencia_social")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo", "varchar(30)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text", (col) => col.notNull())
    .addColumn("tipo_afectacion", "varchar(50)", (col) => col.notNull())
    .addColumn("personas_afectadas", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`personas_afectadas >= 0`)
    )
    .addColumn("familias_afectadas", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`familias_afectadas >= 0`)
    )
    .addColumn("direccion_texto", "varchar(255)", (col) => col.notNull())
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`, (col) => col.notNull())
    .addColumn("contacto_nombre", "varchar(150)")
    .addColumn("contacto_telefono", "varchar(50)")
    .addColumn("contacto_rut", "varchar(20)")
    .addColumn("prioridad", "varchar(20)", (col) => col.notNull().defaultTo("MEDIA"))
    .addColumn("estado", "varchar(30)", (col) => col.notNull().defaultTo("PENDIENTE"))
    .addColumn("incidente_id", "uuid", (col) =>
      col.references("incidente.id").onDelete("set null")
    )
    .addColumn("delegacion_id", "uuid", (col) =>
      col.references("delegacion.id").onDelete("set null")
    )
    .addColumn("asistente_social_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("creado_por_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("restrict")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("eliminado_en", "timestamptz")
    .addColumn("eliminado_por_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .execute();

  // 2. Índices espaciales y de consulta
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_ubicacion ON evento_asistencia_social USING GIST (ubicacion);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_estado ON evento_asistencia_social (estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_delegacion ON evento_asistencia_social (delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_incidente ON evento_asistencia_social (incidente_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_evento_asistencia_social_creado_en ON evento_asistencia_social (creado_en DESC);`.execute(db);

  // 3. Registrar permisos RBAC y asignación a roles (ENCARGADO, ADMINISTRADOR, ASISTENTE_SOCIAL)
  await sql`
    DO $$
    DECLARE
      v_permiso_crear_id UUID;
      v_permiso_leer_id UUID;
      v_target_crear_id UUID := '10000000-0000-4000-8000-000000000017';
      v_target_leer_id UUID := '10000000-0000-4000-8000-000000000019';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
      v_asistente_social_rol_id UUID := '20000000-0000-4000-8000-000000000006';
      v_admin_user_id UUID;
    BEGIN
      -- Permiso: asistencia_social:crear
      SELECT id INTO v_permiso_crear_id FROM permiso WHERE codigo = 'asistencia_social:crear';
      IF v_permiso_crear_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_crear_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'asistencia_social:crear',
            'Crear Evento de Asistencia Social',
            'Permite registrar eventos excepcionales de asistencia social y requerimientos para ficha FIBE',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_crear_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_crear_id,
            'asistencia_social:crear',
            'Crear Evento de Asistencia Social',
            'Permite registrar eventos excepcionales de asistencia social y requerimientos para ficha FIBE',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_crear_id;
        END IF;
      END IF;

      -- Permiso: asistencia_social:leer
      SELECT id INTO v_permiso_leer_id FROM permiso WHERE codigo = 'asistencia_social:leer';
      IF v_permiso_leer_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_leer_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'asistencia_social:leer',
            'Listar Eventos de Asistencia Social',
            'Permite consultar el catálogo y panel de eventos pendientes de asistencia social',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_leer_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_leer_id,
            'asistencia_social:leer',
            'Listar Eventos de Asistencia Social',
            'Permite consultar el catálogo y panel de eventos pendientes de asistencia social',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_leer_id;
        END IF;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      -- Asignaciones para asistencia_social:crear (Administrador y Encargado)
      IF v_permiso_crear_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_crear_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_encargado_rol_id, v_permiso_crear_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Asignaciones para asistencia_social:leer (Administrador, Encargado y Asistente Social)
      IF v_permiso_leer_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_leer_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_encargado_rol_id, v_permiso_leer_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_asistente_social_rol_id, v_permiso_leer_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Revertir asignaciones de permisos
  await sql`
    DELETE FROM rol_permiso WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo IN ('asistencia_social:crear', 'asistencia_social:leer')
    );
    DELETE FROM permiso WHERE codigo IN ('asistencia_social:crear', 'asistencia_social:leer');
  `.execute(db);

  // Eliminar tabla e índices asociados
  await db.schema.dropTable("evento_asistencia_social").ifExists().execute();
}
