import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Modificar tabla aviso_incidente con campos de origen, Asterisk y operador
  await db.schema
    .alterTable("aviso_incidente")
    .addColumn("origen_reporte", "varchar(50)", (col) =>
      col.notNull().defaultTo("CHATBOT")
    )
    .addColumn("asterisk_call_id", "varchar(100)")
    .addColumn("asterisk_caller_phone", "varchar(30)")
    .addColumn("operador_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .execute();

  // 2. Crear tabla Incidente
  await db.schema
    .createTable("incidente")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("codigo", "varchar(20)", (col) => col.notNull().unique())
    .addColumn("tipo_afectacion", "varchar(100)", (col) => col.notNull())
    .addColumn("descripcion", "text", (col) => col.notNull())
    .addColumn("direccion_texto", "text", (col) => col.notNull())
    .addColumn("latitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("longitud", "decimal(10, 7)", (col) => col.notNull())
    .addColumn("ubicacion", sql`geometry(Point, 4326)`, (col) => col.notNull())
    .addColumn("estado", "varchar(50)", (col) =>
      col.notNull().defaultTo("SIN_ATENDER")
    )
    .addColumn("prioridad", "varchar(20)", (col) =>
      col.notNull().defaultTo("MEDIA")
    )
    .addColumn("requiere_asistencia_social", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn("aviso_origen_id", "uuid", (col) =>
      col.notNull().references("aviso_incidente.id").onDelete("restrict")
    )
    .addColumn("creado_por_id", "uuid", (col) =>
      col.notNull().references("usuario.id").onDelete("restrict")
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

  // 3. Índices para tabla Incidente (espacial, código correlativo, estado y fecha de creación)
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_ubicacion ON incidente USING GIST (ubicacion)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_codigo ON incidente (codigo)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_estado ON incidente (estado)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_incidente_creado_en ON incidente (creado_en)`.execute(db);

  // 4. Agregar clave foránea desde aviso_incidente.incidente_id hacia incidente.id
  await sql`
    ALTER TABLE aviso_incidente
    ADD CONSTRAINT fk_aviso_incidente_incidente
    FOREIGN KEY (incidente_id) REFERENCES incidente(id) ON DELETE SET NULL
  `.execute(db);

  // 5. Semillas de Seguridad: Permiso 'crear_incidente_manual', Rol 'Call Center' y asignaciones
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

  // Asignar permiso crear_incidente_manual a Call Center
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    VALUES (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
    ON CONFLICT DO NOTHING
  `.execute(db);

  // Asignar permiso crear_incidente_manual a Administrador (superusuario)
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )
    ON CONFLICT DO NOTHING
  `.execute(db);

  // Usuario operador de Call Center para pruebas y entorno de desarrollo
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
  await sql`ALTER TABLE aviso_incidente DROP CONSTRAINT IF EXISTS fk_aviso_incidente_incidente`.execute(db);
  await db.schema.dropTable("incidente").ifExists().execute();
  await db.schema
    .alterTable("aviso_incidente")
    .dropColumn("origen_reporte")
    .dropColumn("asterisk_call_id")
    .dropColumn("asterisk_caller_phone")
    .dropColumn("operador_id")
    .execute();
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-0000-0000-000000000002'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'crear_incidente_manual'`.execute(db);
  await sql`DELETE FROM usuario WHERE id = '00000000-0000-0000-0000-000000000002'`.execute(db);
  await sql`DELETE FROM rol WHERE id = '20000000-0000-0000-0000-000000000002'`.execute(db);
}
