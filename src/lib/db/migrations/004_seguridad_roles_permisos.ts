import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Extensiones requeridas
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);

  // 2. Tabla permiso (Catálogo de capacidades operativas agrupadas por módulo)
  await db.schema
    .createTable("permiso")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("descripcion", "text")
    .addColumn("modulo", "varchar(100)", (col) => col.notNull())
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 3. Tabla rol (Catálogo de perfiles con flags de sistema y actividad)
  await db.schema
    .createTable("rol")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("nombre", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("es_sistema", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 4. Tabla usuario (Operadores y funcionarios institucionales)
  await db.schema
    .createTable("usuario")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("rut", "varchar(12)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(150)", (col) => col.notNull())
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("rol_id", "uuid", (col) => col.notNull().references("rol.id"))
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 5. Tabla rol_permiso (N:N con trazabilidad y auditoría completa)
  await db.schema
    .createTable("rol_permiso")
    .ifNotExists()
    .addColumn("rol_id", "uuid", (col) => col.notNull().references("rol.id").onDelete("cascade"))
    .addColumn("permiso_id", "uuid", (col) => col.notNull().references("permiso.id").onDelete("cascade"))
    .addColumn("asignado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("asignado_por_id", "uuid", (col) => col.references("usuario.id").onDelete("set null"))
    .addPrimaryKeyConstraint("pk_rol_permiso", ["rol_id", "permiso_id"])
    .execute();

  // Asegurar columnas requeridas si las tablas ya existían previamente
  await sql`
    ALTER TABLE permiso ADD COLUMN IF NOT EXISTS modulo VARCHAR(100) NOT NULL DEFAULT 'General';
    ALTER TABLE rol ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE rol ADD COLUMN IF NOT EXISTS es_sistema BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE rol ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE rol_permiso ADD COLUMN IF NOT EXISTS asignado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE rol_permiso ADD COLUMN IF NOT EXISTS asignado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;
  `.execute(db);

  // 6. Índices para consultas optimizadas (< 1.5 segundos)
  await sql`CREATE INDEX IF NOT EXISTS idx_permiso_codigo ON permiso (codigo)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_permiso_modulo ON permiso (modulo)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rol_nombre ON rol (nombre)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rol_permiso_rol ON rol_permiso (rol_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rol_permiso_permiso ON rol_permiso (permiso_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_rol ON usuario (rol_id)`.execute(db);

  // 7. Semillas para Roles institucionales (UUIDs v4 RFC 4122 válidos)
  await sql`
    INSERT INTO rol (id, nombre, descripcion, activo, es_sistema)
    VALUES
      ('20000000-0000-4000-8000-000000000001', 'Administrador', 'Acceso total y configuración del sistema', true, true),
      ('20000000-0000-4000-8000-000000000002', 'Call Center', 'Recepción de avisos y despacho primario', true, true),
      ('20000000-0000-4000-8000-000000000003', 'Encargado', 'Gestión táctica de operaciones y misiones', true, true),
      ('20000000-0000-4000-8000-000000000004', 'Patrulla Verificadora', 'Evaluación y verificación en terreno', true, true),
      ('20000000-0000-4000-8000-000000000005', 'Delegado de Cuadrilla', 'Líder operativo de cuadrilla en terreno', true, true),
      ('20000000-0000-4000-8000-000000000006', 'Asistente Social', 'Levantamiento de ficha FIBE y vulnerabilidad social', true, true),
      ('20000000-0000-4000-8000-000000000007', 'Informante', 'Ciudadano o entidad que reporta emergencias', true, true),
      ('20000000-0000-4000-8000-000000000008', 'Observador Sin Permisos', 'Perfil de auditoría sin permisos operativos activos', true, false)
    ON CONFLICT (nombre) DO NOTHING
  `.execute(db);

  // 8. Semillas para Permisos base (UUIDs v4 RFC 4122 válidos)
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'recursos:crear', 'Crear Recursos', 'Permite crear nuevos recursos en el inventario logístico', 'Recursos y Personal'),
      ('10000000-0000-4000-8000-000000000002', 'crear_incidente_manual', 'Crear Incidente Manual', 'Permite el ingreso manual de incidentes desde Call Center o funcionarios', 'Incidentes'),
      ('10000000-0000-4000-8000-000000000003', 'seguridad:roles:leer', 'Visualizar Roles y Permisos', 'Permite consultar el listado y detalle de perfiles y sus permisos actuales', 'Seguridad'),
      ('10000000-0000-4000-8000-000000000004', 'seguridad:roles:gestionar', 'Gestionar Roles y Permisos', 'Permite asignar o revocar permisos a los perfiles del sistema', 'Seguridad'),
      ('10000000-0000-4000-8000-000000000005', 'incidentes:avisos:leer', 'Listar Bandeja de Avisos', 'Permite consultar los avisos pendientes en la bandeja de Call Center', 'Incidentes'),
      ('10000000-0000-4000-8000-000000000006', 'incidentes:avisos:verificar', 'Verificar Avisos', 'Permite verificar y promover un reporte a incidente formal ICS', 'Incidentes'),
      ('10000000-0000-4000-8000-000000000007', 'incidentes:avisos:descartar', 'Descartar Avisos', 'Permite descartar avisos con justificación motivada', 'Incidentes'),
      ('10000000-0000-4000-8000-000000000008', 'misiones:asignar', 'Asignar Misiones', 'Permite asignar misiones operativas a cuadrillas y patrullas', 'Misiones'),
      ('10000000-0000-4000-8000-000000000009', 'eventos_atp:crear', 'Crear Eventos ATP', 'Permite registrar puntos críticos y eventos de atención preventiva', 'Eventos ATP')
    ON CONFLICT (codigo) DO NOTHING
  `.execute(db);

  // 9. Semillas para Usuarios iniciales (UUIDs v4 RFC 4122 válidos)
  await sql`
    INSERT INTO usuario (id, rut, nombre, email, rol_id, activo)
    VALUES
      ('00000000-0000-4000-8000-000000000001', '11111111-1', 'Administrador General', 'admin@valdivia.cl', '20000000-0000-4000-8000-000000000001', true),
      ('00000000-0000-4000-8000-000000000002', '22222222-2', 'Operador Call Center', 'callcenter@valdivia.cl', '20000000-0000-4000-8000-000000000002', true)
    ON CONFLICT (email) DO NOTHING
  `.execute(db);

  // 10. Asignación de Permisos a Perfiles (rol_permiso)
  // Administrador: Todos los permisos
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT r.id, p.id, u.id
    FROM rol r
    CROSS JOIN permiso p
    LEFT JOIN usuario u ON u.email = 'admin@valdivia.cl'
    WHERE r.nombre = 'Administrador'
    ON CONFLICT DO NOTHING;
  `.execute(db);

  // Call Center: Avisos e incidentes manuales
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT r.id, p.id, u.id
    FROM rol r
    CROSS JOIN permiso p
    LEFT JOIN usuario u ON u.email = 'admin@valdivia.cl'
    WHERE r.nombre = 'Call Center'
      AND p.codigo IN (
        'crear_incidente_manual',
        'incidentes:avisos:leer',
        'incidentes:avisos:verificar',
        'incidentes:avisos:descartar'
      )
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("rol_permiso").ifExists().execute();
  await db.schema.dropTable("usuario").ifExists().execute();
  await db.schema.dropTable("rol").ifExists().execute();
  await db.schema.dropTable("permiso").ifExists().execute();
}
