import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Crear tabla Tipo Incidente según ERD
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

  await sql`
    INSERT INTO tipo_incidente (nombre, descripcion)
    VALUES 
      ('Inundación', 'Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales'),
      ('Deslizamiento de tierra', 'Movimiento de masa de suelo o laderas en zonas de riesgo'),
      ('Caída de árbol', 'Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles'),
      ('Anegamiento de calzada', 'Saturación de sumideros y acumulación de aguas lluvias en vías públicas'),
      ('Incendio estructural / forestal', 'Focos de fuego en estructuras o vegetación urbana/rural'),
      ('Otro', 'Cualquier otro incidente que requiera atención de emergencia municipal')
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  // 2. Crear tabla Informante según el Diagrama ER
  await db.schema
    .createTable("informante")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("rut", "varchar(12)")
    .addColumn("nombre", "varchar(150)")
    .addColumn("telefono", "varchar(20)")
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_informante_rut ON informante (rut)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_informante_telefono ON informante (telefono)`.execute(db);

  // 3. Crear tabla Incidente según el Diagrama ER consolidando los atributos de reporte y gestión
  await db.schema
    .createTable("incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("folio", "varchar(50)", (col) => col.unique())
    .addColumn("codigo", "varchar(50)", (col) => col.unique())
    .addColumn("codigo_seguimiento", "varchar(50)")
    .addColumn("informante_id", "uuid", (col) =>
      col.references("informante.id").onDelete("set null")
    )
    .addColumn("tipo_incidente_id", "uuid", (col) =>
      col.references("tipo_incidente.id").onDelete("set null")
    )
    .addColumn("aviso_id", "uuid", (col) =>
      col.references("aviso_incidente.id").onDelete("set null")
    )
    .addColumn("tipo_afectacion", "varchar(100)")
    .addColumn("descripcion", "text")
    .addColumn("direccion_texto", "text")
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`, (col) => col.notNull())
    .addColumn("estado", "varchar(50)", (col) =>
      col.notNull().defaultTo("REPORTADO")
    )
    .addColumn("prioridad", "varchar(20)", (col) =>
      col.notNull().defaultTo("MEDIA")
    )
    .addColumn("requiere_asistencia_social", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn("fuente_origen", "varchar(50)", (col) =>
      col.notNull().defaultTo("CHATBOT")
    )
    .addColumn("asterisk_call_id", "varchar(100)")
    .addColumn("asterisk_caller_phone", "varchar(30)")
    .addColumn("creado_por_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("operador_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("encargado_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Asegurar columnas requeridas si la tabla ya existía previamente
  await sql`
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS codigo_seguimiento VARCHAR(50);
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS informante_id UUID REFERENCES informante(id) ON DELETE SET NULL;
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS tipo_afectacion VARCHAR(100);
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS direccion_texto TEXT;
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) DEFAULT 'MEDIA';
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS fuente_origen VARCHAR(50) DEFAULT 'CHATBOT';
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS asterisk_call_id VARCHAR(100);
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS asterisk_caller_phone VARCHAR(30);
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS operador_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
    ALTER TABLE incidente ADD COLUMN IF NOT EXISTS encargado_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
    UPDATE incidente SET codigo = folio WHERE codigo IS NULL;
  `.execute(db);

  // Índices para búsquedas espaciales, código de seguimiento, tipo, estado e informante
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_ubicacion ON incidente USING GIST (ubicacion)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo ON incidente (codigo)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_folio ON incidente (folio)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo_seguimiento ON incidente (codigo_seguimiento)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_estado ON incidente (estado)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_informante ON incidente (informante_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_tipo_id ON incidente (tipo_incidente_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_aviso_id ON incidente (aviso_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_creado_en ON incidente (creado_en)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_tipo_creado ON incidente (tipo_afectacion, creado_en)`.execute(db);

  // Trigger para autocompletar atributos de incidente desde aviso_incidente si provienen de promoción
  await sql`
    CREATE OR REPLACE FUNCTION trg_incidente_autofill_from_aviso()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.aviso_id IS NOT NULL THEN
        IF NEW.tipo_afectacion IS NULL THEN
          SELECT tipo_afectacion INTO NEW.tipo_afectacion FROM aviso_incidente WHERE id = NEW.aviso_id;
        END IF;
        IF NEW.direccion_texto IS NULL THEN
          SELECT direccion_texto INTO NEW.direccion_texto FROM aviso_incidente WHERE id = NEW.aviso_id;
        END IF;
        IF NEW.codigo IS NULL THEN
          NEW.codigo := COALESCE(NEW.folio, 'INC-' || SUBSTRING(NEW.id::text FROM 1 FOR 8));
        END IF;
        IF NEW.codigo_seguimiento IS NULL THEN
          SELECT codigo_seguimiento INTO NEW.codigo_seguimiento FROM aviso_incidente WHERE id = NEW.aviso_id;
        END IF;
      END IF;
      
      IF NEW.tipo_afectacion IS NULL THEN
        NEW.tipo_afectacion := 'Emergencia';
      END IF;
      IF NEW.direccion_texto IS NULL THEN
        NEW.direccion_texto := 'Valdivia';
      END IF;
      IF NEW.codigo IS NULL THEN
        NEW.codigo := COALESCE(NEW.folio, 'INC-' || SUBSTRING(NEW.id::text FROM 1 FOR 8));
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_incidente_autofill ON incidente;
    CREATE TRIGGER trg_incidente_autofill
      BEFORE INSERT ON incidente
      FOR EACH ROW
      EXECUTE FUNCTION trg_incidente_autofill_from_aviso();
  `.execute(db);

  // 4. Crear tabla Adjunto para evidencias multimedia de avisos e incidentes
  await db.schema
    .createTable("adjunto")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("nombre_archivo", "varchar(255)", (col) => col.notNull())
    .addColumn("url", "varchar(500)", (col) => col.notNull())
    .addColumn("tipo_mime", "varchar(100)", (col) => col.notNull())
    .addColumn("tamano_bytes", "bigint", (col) => col.notNull())
    .addColumn("aviso_id", "uuid", (col) =>
      col.references("aviso_incidente.id").onDelete("cascade")
    )
    .addColumn("incidente_id", "uuid", (col) =>
      col.references("incidente.id").onDelete("set null")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_adjunto_aviso_id ON adjunto (aviso_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_adjunto_incidente_id ON adjunto (incidente_id)`.execute(db);

  // 5. Traspasar informantes existentes desde aviso_incidente si los hay (sin eliminar aviso_incidente)
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aviso_incidente') THEN
        INSERT INTO informante (rut, nombre, telefono, creado_en)
        SELECT DISTINCT ON (informante_rut)
          informante_rut,
          informante_nombre,
          informante_telefono,
          creado_en
        FROM aviso_incidente
        WHERE informante_rut IS NOT NULL
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);

  // 6. Semillas de Seguridad: Permiso 'crear_incidente_manual', Rol 'Call Center' y asignaciones
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion)
    VALUES (
      '10000000-0000-0000-0000-000000000002',
      'crear_incidente_manual',
      'Crear Incidente Manual',
      'Permite el ingreso manual de incidentes desde Call Center o funcionarios en terreno'
    )
    ON CONFLICT (codigo) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO rol (id, nombre, descripcion)
    VALUES (
      '20000000-0000-0000-0000-000000000002',
      'Call Center',
      'Rol para operadores de Call Center encargados de la recepción y derivación de incidentes'
    )
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    VALUES (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
    ON CONFLICT DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )
    ON CONFLICT DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO usuario (id, rut, nombre, email, rol_id)
    VALUES (
      '00000000-0000-0000-0000-000000000002',
      '22222222-2',
      'Operador Call Center',
      'callcenter@valdivia.cl',
      '20000000-0000-0000-0000-000000000002'
    )
    ON CONFLICT (email) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO usuario (id, rut, nombre, email, rol_id)
    VALUES (
      'a0000000-0000-0000-0000-000000000001',
      '99999999-9',
      'Operador QA Call Center',
      'operador.qa@valdivia.cl',
      '20000000-0000-0000-0000-000000000002'
    )
    ON CONFLICT (email) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("adjunto").ifExists().execute();
  await db.schema.dropTable("incidente").ifExists().execute();
  await db.schema.dropTable("informante").ifExists().execute();
  await db.schema.dropTable("tipo_incidente").ifExists().execute();
  await sql`DELETE FROM usuario WHERE id IN ('00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001')`.execute(db);
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-0000-0000-000000000002'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'crear_incidente_manual'`.execute(db);
  await sql`DELETE FROM rol WHERE id = '20000000-0000-0000-0000-000000000002'`.execute(db);
}
