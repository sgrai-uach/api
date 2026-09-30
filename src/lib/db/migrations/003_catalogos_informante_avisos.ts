import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla tipo_incidente (Catálogo estandarizado según ERD)
  await db.schema
    .createTable("tipo_incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Semillas para tipos de incidente
  await sql`
    INSERT INTO tipo_incidente (id, nombre, descripcion, activo)
    VALUES
      ('40000000-0000-4000-8000-000000000001', 'Inundación', 'Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales', true),
      ('40000000-0000-4000-8000-000000000002', 'Deslizamiento de tierra', 'Movimiento de masa de suelo o laderas en zonas de riesgo', true),
      ('40000000-0000-4000-8000-000000000003', 'Caída de árbol', 'Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles', true),
      ('40000000-0000-4000-8000-000000000004', 'Anegamiento de calzada', 'Saturación de sumideros y acumulación de aguas lluvias en vías públicas', true),
      ('40000000-0000-4000-8000-000000000005', 'Incendio estructural / forestal', 'Focos de fuego en estructuras o vegetación urbana/rural', true),
      ('40000000-0000-4000-8000-000000000006', 'Otro', 'Cualquier otro incidente que requiera atención de emergencia municipal', true),
      ('a0000000-0000-4000-8000-000000000001', 'Anegamiento', 'Acumulación de aguas lluvias en vías o propiedades', true),
      ('a0000000-0000-4000-8000-000000000003', 'Corte de energía', 'Interrupción del suministro eléctrico o peligro por cables caídos', true),
      ('a0000000-0000-4000-8000-000000000004', 'Deslizamiento', 'Movimiento de laderas, socavón o remoción de terreno', true),
      ('a0000000-0000-4000-8000-000000000005', 'Daño estructural', 'Colapso parcial o daño grave en techumbre, muros o edificaciones', true),
      ('a0000000-0000-4000-8000-000000000006', 'Corte de agua potable', 'Corte o rotura matriz en la red de agua potable', true)
    ON CONFLICT (nombre) DO UPDATE SET
      descripcion = EXCLUDED.descripcion,
      activo = EXCLUDED.activo;
  `.execute(db);

  // 2. Tabla informante (Ciudadanos o entidades que originan avisos)
  await db.schema
    .createTable("informante")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("rut", "varchar(12)")
    .addColumn("nombre", "varchar(150)")
    .addColumn("telefono", "varchar(20)")
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_informante_rut ON informante (rut);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_informante_telefono ON informante (telefono);`.execute(db);

  // 3. Tabla aviso_incidente (Recepción inicial por Chatbot o Call Center)
  await db.schema
    .createTable("aviso_incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo_seguimiento", "varchar(20)", (col) => col.notNull())
    .addColumn("tipo_afectacion", "varchar(100)", (col) => col.notNull())
    .addColumn("direccion_texto", "text", (col) => col.notNull())
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`, (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("informante_nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("informante_rut", "varchar(12)", (col) => col.notNull())
    .addColumn("informante_telefono", "varchar(20)")
    .addColumn("origen_reporte", "varchar(50)", (col) => col.notNull().defaultTo("CHATBOT"))
    .addColumn("estado", "varchar(50)", (col) => col.notNull().defaultTo("PENDIENTE_VERIFICACION"))
    .addColumn("es_duplicado", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("aviso_original_id", "uuid", (col) =>
      col.references("aviso_incidente.id").onDelete("set null")
    )
    .addColumn("motivo_descarte", "text")
    .addColumn("operador_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("incidente_id", "uuid")
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_ubicacion ON aviso_incidente USING GIST (ubicacion);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_codigo ON aviso_incidente (codigo_seguimiento);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_tipo_creado ON aviso_incidente (tipo_afectacion, creado_en);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_estado_fecha ON aviso_incidente (estado, creado_en ASC);`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("aviso_incidente").ifExists().execute();
  await db.schema.dropTable("informante").ifExists().execute();
  await db.schema.dropTable("tipo_incidente").ifExists().execute();
}
