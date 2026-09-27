import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Crear tabla Informante según el Diagrama ER
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

  // 2. Crear tabla Incidente según el Diagrama ER consolidando los atributos de reporte y gestión
  await db.schema
    .createTable("incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("codigo", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("codigo_seguimiento", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("informante_id", "uuid", (col) =>
      col.references("informante.id").onDelete("set null")
    )
    .addColumn("tipo_afectacion", "varchar(100)", (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("direccion_texto", "text", (col) => col.notNull())
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

  // Índices para búsquedas espaciales, código de seguimiento, tipo, estado e informante
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_ubicacion ON incidente USING GIST (ubicacion)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo ON incidente (codigo)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo_seguimiento ON incidente (codigo_seguimiento)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_estado ON incidente (estado)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_informante ON incidente (informante_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_creado_en ON incidente (creado_en)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_tipo_creado ON incidente (tipo_afectacion, creado_en)`.execute(db);

  // 3. Migrar datos existentes desde aviso_incidente si la tabla existe y luego eliminarla
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aviso_incidente') THEN
        -- Traspasar informantes únicos
        INSERT INTO informante (rut, nombre, telefono, creado_en)
        SELECT DISTINCT ON (informante_rut)
          informante_rut,
          informante_nombre,
          informante_telefono,
          creado_en
        FROM aviso_incidente
        ON CONFLICT DO NOTHING;

        -- Traspasar reportes a incidente
        INSERT INTO incidente (
          id,
          codigo,
          codigo_seguimiento,
          informante_id,
          tipo_afectacion,
          descripcion,
          direccion_texto,
          latitud,
          longitud,
          ubicacion,
          estado,
          fuente_origen,
          creado_en,
          actualizado_en
        )
        SELECT
          a.id,
          'INC-' || SUBSTRING(a.codigo_seguimiento FROM 1 FOR 8),
          a.codigo_seguimiento,
          inf.id,
          a.tipo_afectacion,
          a.descripcion,
          a.direccion_texto,
          a.latitud,
          a.longitud,
          a.ubicacion,
          CASE
            WHEN a.estado = 'PENDIENTE_VERIFICACION' THEN 'REPORTADO'
            WHEN a.estado = 'VERIFICANDO' THEN 'VERIFICANDO'
            WHEN a.estado = 'EN_ATENCION' THEN 'EN_ATENCION'
            WHEN a.estado = 'RESUELTO' THEN 'RESUELTO'
            WHEN a.estado = 'DESCARTADO' THEN 'NO_ABORDABLE'
            ELSE 'REPORTADO'
          END,
          COALESCE(a.origen_reporte, 'CHATBOT'),
          a.creado_en,
          a.actualizado_en
        FROM aviso_incidente a
        LEFT JOIN informante inf ON inf.rut = a.informante_rut
        ON CONFLICT (id) DO NOTHING;

        -- Eliminar aviso_incidente para consolidar modelo ERD
        DROP TABLE aviso_incidente CASCADE;
      END IF;
    END $$;
  `.execute(db);

  // 4. Semillas de Seguridad: Permiso 'crear_incidente_manual', Rol 'Call Center' y asignaciones
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("incidente").ifExists().execute();
  await db.schema.dropTable("informante").ifExists().execute();
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-0000-0000-000000000002'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'crear_incidente_manual'`.execute(db);
  await sql`DELETE FROM usuario WHERE id = '00000000-0000-0000-0000-000000000002'`.execute(db);
  await sql`DELETE FROM rol WHERE id = '20000000-0000-0000-0000-000000000002'`.execute(db);
}
