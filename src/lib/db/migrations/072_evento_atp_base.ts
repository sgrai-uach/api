import { sql, type Kysely } from "kysely";

/**
 * Migración base del módulo de Alerta Temprana Preventiva (ATP) - H61.
 *
 * Crea las entidades principales del fenómeno (evento_atp) y su relación
 * territorial (evento_atp_delegacion). Además deja preparadas las columnas
 * nullable evento_atp_id en las entidades que se vincularán en H60.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Tabla evento_atp (marco oficial del fenómeno)
  await db.schema
    .createTable("evento_atp")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("codigo", "varchar(30)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text", (col) => col.notNull())
    .addColumn("tipo_amenaza", "varchar(50)", (col) => col.notNull())
    .addColumn("nivel_alerta", "varchar(20)", (col) => col.notNull())
    .addColumn("fecha_inicio", "timestamptz", (col) => col.notNull())
    .addColumn("fecha_termino", "timestamptz", (col) => col.notNull())
    .addColumn("estado", "varchar(20)", (col) =>
      col.notNull().defaultTo("ACTIVO")
    )
    .addColumn("creado_por_id", "uuid", (col) =>
      col.references("usuario.id").onDelete("set null")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("actualizado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addCheckConstraint(
      "evento_atp_fechas_validas",
      sql`fecha_termino >= fecha_inicio`
    )
    .addCheckConstraint(
      "evento_atp_nivel_alerta_valido",
      sql`nivel_alerta IN ('VERDE', 'AMARILLA', 'ROJA')`
    )
    .addCheckConstraint(
      "evento_atp_estado_valido",
      sql`estado IN ('ACTIVO', 'CERRADO', 'CANCELADO')`
    )
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_atp_codigo ON evento_atp (codigo);
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_atp_estado ON evento_atp (estado);
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_atp_fechas ON evento_atp (fecha_inicio, fecha_termino);
  `.execute(db);

  // 2. Tabla puente evento_atp_delegacion (alcance territorial del fenómeno)
  await db.schema
    .createTable("evento_atp_delegacion")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("evento_atp_id", "uuid", (col) =>
      col.notNull().references("evento_atp.id").onDelete("cascade")
    )
    .addColumn("delegacion_id", "uuid", (col) =>
      col.notNull().references("delegacion.id").onDelete("cascade")
    )
    .addColumn("creado_en", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addUniqueConstraint("evento_atp_delegacion_unica", [
      "evento_atp_id",
      "delegacion_id",
    ])
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_atp_delegacion_evento
    ON evento_atp_delegacion (evento_atp_id);
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_evento_atp_delegacion_delegacion
    ON evento_atp_delegacion (delegacion_id);
  `.execute(db);

  // 3. Columnas nullable para la futura vinculación de entidades (H60)
  //    Se dejan preparadas para que la historia de vinculación no requiera
  //    una migración estructural adicional.
  const entidadesConEventoAtp = [
    "incidente",
    "evento_prevencion",
    "recuperacion",
    "evento_asistencia_social",
  ];

  for (const tabla of entidadesConEventoAtp) {
    await sql`
      ALTER TABLE ${sql.table(tabla)}
      ADD COLUMN IF NOT EXISTS evento_atp_id UUID
      REFERENCES evento_atp(id) ON DELETE SET NULL;
    `.execute(db);

    await sql`
      CREATE INDEX IF NOT EXISTS ${sql.id(`idx_${tabla}_evento_atp`)}
      ON ${sql.table(tabla)} (evento_atp_id);
    `.execute(db);
  }

  // 4. Permiso RBAC abstracto. Ya existe desde la migración 001, pero se
  //    actualiza su descripción y se reasegura la asignación al Administrador.
  await sql`
    UPDATE permiso
    SET
      descripcion = 'Permite crear y gestionar Eventos de Alerta Temprana Preventiva (ATP) y sus entidades asociadas',
      modulo = 'Eventos ATP'
    WHERE codigo = 'eventos_atp:crear';
  `.execute(db);

  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT
      '20000000-0000-4000-8000-000000000001',
      p.id,
      '00000000-0000-4000-8000-000000000001'
    FROM permiso p
    WHERE p.codigo = 'eventos_atp:crear'
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // 1. Eliminar columnas y sus índices en entidades vinculables
  const entidadesConEventoAtp = [
    "incidente",
    "evento_prevencion",
    "recuperacion",
    "evento_asistencia_social",
  ];

  for (const tabla of entidadesConEventoAtp) {
    await sql`
      DROP INDEX IF EXISTS ${sql.id(`idx_${tabla}_evento_atp`)};
    `.execute(db);
    await sql`
      ALTER TABLE ${sql.table(tabla)}
      DROP COLUMN IF EXISTS evento_atp_id;
    `.execute(db);
  }

  // 2. Eliminar tabla puente y entidad principal
  await db.schema.dropTable("evento_atp_delegacion").ifExists().execute();
  await db.schema.dropTable("evento_atp").ifExists().execute();

  // 3. Restaurar descripción original del permiso
  await sql`
    UPDATE permiso
    SET
      descripcion = 'Permite registrar puntos críticos y eventos de atención preventiva',
      modulo = 'Eventos ATP'
    WHERE codigo = 'eventos_atp:crear';
  `.execute(db);
}
