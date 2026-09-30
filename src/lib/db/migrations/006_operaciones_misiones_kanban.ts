import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla fuente_incidente (Canales de ingreso formal ICS)
  await db.schema
    .createTable("fuente_incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`
    INSERT INTO fuente_incidente (id, nombre, descripcion)
    VALUES
      ('50000000-0000-4000-8000-000000000001', 'CHATBOT', 'Reporte automático ingresado por ciudadano vía chatbot institucional'),
      ('50000000-0000-4000-8000-000000000002', 'LLAMADA_TELEFONICA', 'Ingreso manual por operador de Call Center telefónico'),
      ('50000000-0000-4000-8000-000000000003', 'FUNCIONARIO_TERRENO', 'Aviso registrado directamente por patrulla o funcionario en terreno'),
      ('50000000-0000-4000-8000-000000000004', 'SENAPRED', 'Derivación oficial de alerta temprana preventiva desde SENAPRED')
    ON CONFLICT (nombre) DO UPDATE SET
      descripcion = EXCLUDED.descripcion;
  `.execute(db);

  // 2. Tabla prevencion (Puntos críticos y sectores vulnerables monitoreados)
  await db.schema
    .createTable("prevencion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  await sql`CREATE INDEX IF NOT EXISTS idx_prevencion_ubicacion ON prevencion USING GIST (ubicacion);`.execute(db);

  // 3. Tabla patrulla_verificadora (Evaluación primaria en terreno)
  await db.schema
    .createTable("patrulla_verificadora")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  // 4. Tabla cuadrilla (Unidades tácticas y brigadas de respuesta operativa)
  await db.schema
    .createTable("cuadrilla")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  // 5. Tabla cuadrilla_recurso (Asignación logística de recursos a cuadrillas)
  await db.schema
    .createTable("cuadrilla_recurso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_recurso_cuadrilla ON cuadrilla_recurso (cuadrilla_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_cuadrilla_recurso_recurso ON cuadrilla_recurso (recurso_id);`.execute(db);

  // 6. Tabla mision (Operaciones tácticas derivadas de incidentes o prevención)
  await db.schema
    .createTable("mision")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  await sql`CREATE INDEX IF NOT EXISTS idx_mision_incidente ON mision (incidente_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_prevencion ON mision (prevencion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_cuadrilla ON mision (cuadrilla_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_patrulla ON mision (patrulla_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_mision_estado ON mision (estado);`.execute(db);

  // 7. Vincular columnas delegacion_id y fuente_incidente_id en incidente
  await sql`
    DO $$ BEGIN
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

  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_delegacion_id ON incidente (delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_fuente_id ON incidente (fuente_incidente_id);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE incidente DROP COLUMN IF EXISTS fuente_incidente_id;`.execute(db);
  await sql`ALTER TABLE incidente DROP COLUMN IF EXISTS delegacion_id;`.execute(db);
  await db.schema.dropTable("mision").ifExists().execute();
  await db.schema.dropTable("cuadrilla_recurso").ifExists().execute();
  await db.schema.dropTable("cuadrilla").ifExists().execute();
  await db.schema.dropTable("patrulla_verificadora").ifExists().execute();
  await db.schema.dropTable("prevencion").ifExists().execute();
  await db.schema.dropTable("fuente_incidente").ifExists().execute();
}
