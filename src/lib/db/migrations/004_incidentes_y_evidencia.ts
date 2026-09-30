import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla incidente (Gestión formal de emergencias según ICS)
  await db.schema
    .createTable("incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_ubicacion ON incidente USING GIST (ubicacion);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo ON incidente (codigo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_folio ON incidente (folio);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo_seguimiento ON incidente (codigo_seguimiento);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_estado ON incidente (estado);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_informante ON incidente (informante_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_tipo_id ON incidente (tipo_incidente_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_aviso_id ON incidente (aviso_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_creado_en ON incidente (creado_en);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_tipo_creado ON incidente (tipo_afectacion, creado_en);`.execute(db);

  // 2. Trigger para autocompletar atributos de incidente desde aviso_incidente si provienen de promoción
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

  // 3. Tabla adjunto (Evidencias multimedia asociadas a avisos o incidentes)
  await db.schema
    .createTable("adjunto")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
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

  await sql`CREATE INDEX IF NOT EXISTS idx_adjunto_aviso_id ON adjunto (aviso_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_adjunto_incidente_id ON adjunto (incidente_id);`.execute(db);

  // 4. Clave foránea bidireccional en aviso_incidente.incidente_id
  await sql`
    DO $$ BEGIN
      ALTER TABLE aviso_incidente 
      ADD CONSTRAINT fk_aviso_incidente_incidente 
      FOREIGN KEY (incidente_id) REFERENCES incidente(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE aviso_incidente DROP CONSTRAINT IF EXISTS fk_aviso_incidente_incidente;`.execute(db);
  await db.schema.dropTable("adjunto").ifExists().execute();
  await sql`DROP TRIGGER IF EXISTS trg_incidente_autofill ON incidente;`.execute(db);
  await sql`DROP FUNCTION IF EXISTS trg_incidente_autofill_from_aviso;`.execute(db);
  await db.schema.dropTable("incidente").ifExists().execute();
}
