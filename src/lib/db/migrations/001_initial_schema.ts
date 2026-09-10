import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Habilitar extensiones requeridas
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "postgis"`.execute(db);

  // 2. Tabla tipo_incidente
  await sql`
    CREATE TABLE IF NOT EXISTS tipo_incidente (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nombre VARCHAR(100) UNIQUE NOT NULL,
      descripcion TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  // 3. Tabla aviso_incidente (Armonizada con H1 Chatbot e H52 Call Center)
  await sql`
    CREATE TABLE IF NOT EXISTS aviso_incidente (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      codigo_seguimiento VARCHAR(20) NOT NULL,
      tipo_afectacion VARCHAR(100) NOT NULL,
      direccion_texto TEXT NOT NULL,
      latitud DECIMAL(10, 7) NOT NULL,
      longitud DECIMAL(10, 7) NOT NULL,
      ubicacion GEOMETRY(Point, 4326) NOT NULL,
      descripcion TEXT,
      informante_nombre VARCHAR(150) NOT NULL,
      informante_rut VARCHAR(12) NOT NULL,
      informante_telefono VARCHAR(20),
      origen_reporte VARCHAR(50) NOT NULL DEFAULT 'CHATBOT',
      estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
      es_duplicado BOOLEAN NOT NULL DEFAULT FALSE,
      aviso_original_id UUID REFERENCES aviso_incidente(id) ON DELETE SET NULL,
      motivo_descarte TEXT NULL,
      operador_id UUID NULL,
      incidente_id UUID NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aviso_incidente_ubicacion 
    ON aviso_incidente USING GIST (ubicacion)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aviso_incidente_codigo 
    ON aviso_incidente (codigo_seguimiento)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aviso_incidente_tipo_creado 
    ON aviso_incidente (tipo_afectacion, creado_en)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aviso_incidente_estado_fecha 
    ON aviso_incidente(estado, creado_en ASC)
  `.execute(db);

  // 4. Tabla incidente
  await sql`
    CREATE TABLE IF NOT EXISTS incidente (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      folio VARCHAR(50) UNIQUE NOT NULL,
      tipo_incidente_id UUID NOT NULL REFERENCES tipo_incidente(id),
      estado VARCHAR(50) NOT NULL DEFAULT 'Reportado',
      descripcion TEXT NOT NULL,
      latitud DECIMAL(10, 7) NOT NULL,
      longitud DECIMAL(10, 7) NOT NULL,
      ubicacion GEOMETRY(Point, 4326),
      requiere_asistencia_social BOOLEAN NOT NULL DEFAULT FALSE,
      aviso_id UUID REFERENCES aviso_incidente(id),
      creado_por_id UUID NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidente_estado 
    ON incidente(estado)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidente_ubicacion 
    ON incidente USING GIST (ubicacion)
  `.execute(db);

  // 5. Tabla adjunto
  await sql`
    CREATE TABLE IF NOT EXISTS adjunto (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nombre_archivo VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      tipo_mime VARCHAR(100) NOT NULL,
      tamano_bytes BIGINT NOT NULL,
      aviso_id UUID REFERENCES aviso_incidente(id) ON DELETE CASCADE,
      incidente_id UUID REFERENCES incidente(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  // 6. Semillas para tipos de incidente básicos en Valdivia
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS adjunto CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS incidente CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS aviso_incidente CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS tipo_incidente CASCADE`.execute(db);
}
