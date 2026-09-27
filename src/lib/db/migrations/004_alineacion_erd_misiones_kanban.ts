import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla Delegación (Norte, Sur, Costa, Calle Calle según GEMINI.md)
  await db.schema
    .createTable("delegacion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("codigo_delegacion", "varchar(50)", (col) => col.unique())
    .addColumn("nombre", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("nombre_delegacion", "varchar(150)")
    .addColumn("descripcion", "text")
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 2. Tabla Tipo Incidente
  await db.schema
    .createTable("tipo_incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("nombre", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 3. Tabla Fuente del Incidente
  await db.schema
    .createTable("fuente_incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("nombre", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 4. Tabla Prevención (ex. Puntos críticos)
  await db.schema
    .createTable("prevencion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("codigo", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`)
    .addColumn("delegacion_id", "uuid", (col) =>
      col.references("delegacion.id").onDelete("set null")
    )
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_prevencion_ubicacion ON prevencion USING GIST (ubicacion)`.execute(db);

  // 5. Tabla Patrulla Verificadora
  await db.schema
    .createTable("patrulla_verificadora")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("nombre", "varchar(100)", (col) => col.notNull())
    .addColumn("estado", "varchar(50)", (col) =>
      col.notNull().defaultTo("DISPONIBLE")
    )
    .addColumn("delegacion_id", "uuid", (col) =>
      col.references("delegacion.id").onDelete("set null")
    )
    .addColumn("usuario_lider_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 6. Tabla Cuadrilla
  await db.schema
    .createTable("cuadrilla")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("nombre", "varchar(100)", (col) => col.notNull())
    .addColumn("estado", "varchar(50)", (col) =>
      col.notNull().defaultTo("DISPONIBLE")
    )
    .addColumn("delegacion_id", "uuid", (col) =>
      col.references("delegacion.id").onDelete("set null")
    )
    .addColumn("usuario_delegado_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // 7. Tabla CuadrillaRecurso (Relación Cuadrilla <-> Recurso según DER)
  await db.schema
    .createTable("cuadrilla_recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("cuadrilla_id", "uuid", (col) =>
      col.notNull().references("cuadrilla.id").onDelete("cascade")
    )
    .addColumn("recurso_id", "uuid", (col) =>
      col.notNull().references("recurso.id").onDelete("restrict")
    )
    .addColumn("cantidad_asignada", "integer", (col) =>
      col.notNull().check(sql`cantidad_asignada > 0`)
    )
    .addColumn("asignado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_recurso_cuadrilla ON cuadrilla_recurso (cuadrilla_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_recurso_recurso ON cuadrilla_recurso (recurso_id)`.execute(db);

  // 8. Tabla Misión (Operaciones tácticas derivadas de Incidente o Prevención)
  await db.schema
    .createTable("mision")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("codigo", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("titulo", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("tipo_mision", "varchar(50)", (col) => col.notNull())
    .addColumn("estado", "varchar(50)", (col) =>
      col.notNull().defaultTo("PLANIFICADA")
    )
    .addColumn("prioridad", "varchar(20)", (col) =>
      col.notNull().defaultTo("MEDIA")
    )
    .addColumn("justificacion_rechazo", "text")
    .addColumn("incidente_id", "uuid", (col) =>
      col.references("incidente.id").onDelete("set null")
    )
    .addColumn("prevencion_id", "uuid", (col) =>
      col.references("prevencion.id").onDelete("set null")
    )
    .addColumn("cuadrilla_id", "uuid", (col) =>
      col.references("cuadrilla.id").onDelete("set null")
    )
    .addColumn("patrulla_id", "uuid", (col) =>
      col.references("patrulla_verificadora.id").onDelete("set null")
    )
    .addColumn("encargado_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("creado_por_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("restrict")
    )
    .addColumn("fecha_inicio", "timestamptz")
    .addColumn("fecha_cierre", "timestamptz")
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_mision_incidente ON mision (incidente_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_prevencion ON mision (prevencion_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_cuadrilla ON mision (cuadrilla_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_patrulla ON mision (patrulla_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_estado ON mision (estado)`.execute(db);

  // 9. Vincular claves foráneas en tabla 'incidente' según DER
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'incidente' AND column_name = 'tipo_incidente_id'
      ) THEN
        ALTER TABLE incidente ADD COLUMN tipo_incidente_id UUID REFERENCES tipo_incidente(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'incidente' AND column_name = 'delegacion_id'
      ) THEN
        ALTER TABLE incidente ADD COLUMN delegacion_id UUID REFERENCES delegacion(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'incidente' AND column_name = 'fuente_incidente_id'
      ) THEN
        ALTER TABLE incidente ADD COLUMN fuente_incidente_id UUID REFERENCES fuente_incidente(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_tipo_id ON incidente (tipo_incidente_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_delegacion_id ON incidente (delegacion_id)`.execute(db);

  // 10. Semillas de Delegaciones
  await sql`
    INSERT INTO delegacion (id, codigo_delegacion, nombre, nombre_delegacion, descripcion, activo)
    VALUES
      ('30000000-0000-4000-8000-000000000001', 'DEL_NORTE', 'Norte', 'Delegación Municipal Norte', 'Jurisdicción y cobertura territorial norte de Valdivia (Las Ánimas, Cabo Blanco)', true),
      ('30000000-0000-4000-8000-000000000002', 'DEL_SUR', 'Sur', 'Delegación Municipal Sur', 'Jurisdicción y cobertura territorial sur de Valdivia (Angachilla, Guacamayo)', true),
      ('30000000-0000-4000-8000-000000000003', 'DEL_COSTA', 'Costa', 'Delegación Municipal Costa', 'Jurisdicción y cobertura territorial zona costera (Niebla, Los Molinos, Corral)', true),
      ('30000000-0000-4000-8000-000000000004', 'DEL_CALLE_CALLE', 'Calle Calle', 'Delegación Municipal Calle Calle', 'Jurisdicción y cobertura territorial eje fluvial e interior (Collico, Corvi)', true)
    ON CONFLICT (nombre) DO UPDATE SET
      codigo_delegacion = EXCLUDED.codigo_delegacion,
      nombre_delegacion = EXCLUDED.nombre_delegacion,
      activo = EXCLUDED.activo
  `.execute(db);

  // 11. Semillas de Tipos de Incidente
  await sql`
    INSERT INTO tipo_incidente (id, nombre, descripcion, activo)
    VALUES
      ('40000000-0000-4000-8000-000000000001', 'Inundación', 'Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales', true),
      ('40000000-0000-4000-8000-000000000002', 'Deslizamiento de tierra', 'Movimiento de masa de suelo o laderas en zonas de riesgo', true),
      ('40000000-0000-4000-8000-000000000003', 'Caída de árbol', 'Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles', true),
      ('40000000-0000-4000-8000-000000000004', 'Anegamiento de calzada', 'Saturación de sumideros y acumulación de aguas lluvias en vías públicas', true),
      ('40000000-0000-4000-8000-000000000005', 'Incendio', 'Focos de fuego en estructuras o vegetación urbana/rural', true),
      ('40000000-0000-4000-8000-000000000006', 'Otro', 'Cualquier otro incidente que requiera atención de emergencia municipal', true)
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  // 12. Semillas de Fuentes del Incidente
  await sql`
    INSERT INTO fuente_incidente (id, nombre, descripcion)
    VALUES
      ('50000000-0000-4000-8000-000000000001', 'CHATBOT', 'Reporte automático ingresado por ciudadano vía chatbot institucional'),
      ('50000000-0000-4000-8000-000000000002', 'LLAMADA_TELEFONICA', 'Ingreso manual por operador de Call Center telefónico'),
      ('50000000-0000-4000-8000-000000000003', 'FUNCIONARIO_TERRENO', 'Aviso registrado directamente por patrulla o funcionario en terreno'),
      ('50000000-0000-4000-8000-000000000004', 'SENAPRED', 'Derivación oficial de alerta temprana preventiva desde SENAPRED')
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  // 13. Semillas de Seguridad: Permiso 'incidentes:kanban', Rol 'Encargado' y asignaciones
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion)
    VALUES (
      '10000000-0000-4000-8000-000000000015',
      'incidentes:kanban',
      'Tablero Kanban de Incidentes',
      'Permite visualizar, filtrar y acceder al detalle de los incidentes en el tablero Kanban del Encargado'
    )
    ON CONFLICT (codigo) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO rol (id, nombre, descripcion)
    VALUES (
      '20000000-0000-4000-8000-000000000003',
      'Encargado',
      'Rol de Encargado de Operaciones tácticas del SGRAI'
    )
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  // Asignar permiso incidentes:kanban al rol Encargado
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    SELECT r.id, p.id
    FROM rol r, permiso p
    WHERE r.nombre = 'Encargado' AND p.codigo = 'incidentes:kanban'
    ON CONFLICT DO NOTHING
  `.execute(db);

  // Asignar permiso incidentes:kanban al rol Administrador
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    SELECT r.id, p.id
    FROM rol r, permiso p
    WHERE r.nombre = 'Administrador' AND p.codigo = 'incidentes:kanban'
    ON CONFLICT DO NOTHING
  `.execute(db);

  // Usuario Encargado de prueba
  await sql`
    INSERT INTO usuario (id, rut, nombre, email, rol_id)
    VALUES (
      '00000000-0000-4000-8000-000000000003',
      '33333333-3',
      'Encargado de Operaciones',
      'encargado@valdivia.cl',
      '20000000-0000-4000-8000-000000000003'
    )
    ON CONFLICT (email) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE incidente DROP COLUMN IF EXISTS fuente_incidente_id`.execute(db);
  await sql`ALTER TABLE incidente DROP COLUMN IF EXISTS delegacion_id`.execute(db);
  await sql`ALTER TABLE incidente DROP COLUMN IF EXISTS tipo_incidente_id`.execute(db);

  await db.schema.dropTable("mision").ifExists().execute();
  await db.schema.dropTable("cuadrilla_recurso").ifExists().execute();
  await db.schema.dropTable("cuadrilla").ifExists().execute();
  await db.schema.dropTable("patrulla_verificadora").ifExists().execute();
  await db.schema.dropTable("prevencion").ifExists().execute();
  await db.schema.dropTable("fuente_incidente").ifExists().execute();
  await db.schema.dropTable("tipo_incidente").ifExists().execute();
  await db.schema.dropTable("delegacion").ifExists().execute();

  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000015'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'incidentes:kanban'`.execute(db);
  await sql`DELETE FROM usuario WHERE id = '00000000-0000-4000-8000-000000000003'`.execute(db);
  await sql`DELETE FROM rol WHERE id = '20000000-0000-4000-8000-000000000003'`.execute(db);
}
