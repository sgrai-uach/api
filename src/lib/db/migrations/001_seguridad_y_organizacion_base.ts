import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Extensiones requeridas
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "postgis"`.execute(db);

  // 2. Tabla delegacion (Dependencias territoriales municipales)
  await sql`
    CREATE TABLE IF NOT EXISTS delegacion (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      codigo VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(150) UNIQUE NOT NULL,
      codigo_delegacion VARCHAR(50) GENERATED ALWAYS AS (codigo) STORED,
      nombre_delegacion VARCHAR(150) GENERATED ALWAYS AS (nombre) STORED,
      direccion VARCHAR(255),
      descripcion TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_delegacion_codigo ON delegacion(codigo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_delegacion_activo ON delegacion(activo);`.execute(db);

  // 3. Tabla rol (Perfiles y roles institucionales SGRAI)
  await db.schema
    .createTable("rol")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("codigo", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("nombre", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("descripcion", "text")
    .addColumn("activo", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("es_sistema", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("creado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("actualizado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_rol_codigo ON rol(codigo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rol_nombre ON rol(nombre);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rol_activo ON rol(activo);`.execute(db);

  // 4. Tabla permiso (Matriz granular de capacidades por módulo)
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

  await sql`CREATE INDEX IF NOT EXISTS idx_permiso_codigo ON permiso(codigo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_permiso_modulo ON permiso(modulo);`.execute(db);

  // 5. Tabla usuario (Funcionarios y operadores del sistema)
  await sql`
    CREATE TABLE IF NOT EXISTS usuario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rut VARCHAR(20) UNIQUE NOT NULL,
      nombres VARCHAR(100) NOT NULL,
      apellidos VARCHAR(100) NOT NULL,
      nombre VARCHAR(255) GENERATED ALWAYS AS (TRIM(nombres || ' ' || apellidos)) STORED,
      email VARCHAR(150) UNIQUE NOT NULL,
      telefono VARCHAR(50),
      password_hash VARCHAR(255) NOT NULL DEFAULT '$2b$10$w8T9HfgdOa8m8y2hQZgE6e1GzD3M9K5wU6Zz0gV7P8H6tY7bQZgE6',
      rol_id UUID NOT NULL REFERENCES rol(id) ON DELETE RESTRICT,
      delegacion_id UUID REFERENCES delegacion(id) ON DELETE SET NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      ultimo_acceso TIMESTAMPTZ,
      fecha_ingreso DATE,
      fecha_salida DATE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_rut ON usuario(rut);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_rol_id ON usuario(rol_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_delegacion_id ON usuario(delegacion_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_activo ON usuario(activo);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_usuario_fecha_ingreso ON usuario(fecha_ingreso);`.execute(db);

  // 6. Tabla rol_permiso (N:N con trazabilidad)
  await db.schema
    .createTable("rol_permiso")
    .ifNotExists()
    .addColumn("rol_id", "uuid", (col) => col.notNull().references("rol.id").onDelete("cascade"))
    .addColumn("permiso_id", "uuid", (col) => col.notNull().references("permiso.id").onDelete("cascade"))
    .addColumn("asignado_en", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("asignado_por_id", "uuid", (col) => col.references("usuario.id").onDelete("set null"))
    .addPrimaryKeyConstraint("pk_rol_permiso", ["rol_id", "permiso_id"])
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_rol_permiso_rol ON rol_permiso(rol_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rol_permiso_permiso ON rol_permiso(permiso_id);`.execute(db);

  // 7. Semillas: Delegaciones de Valdivia
  await sql`
    INSERT INTO delegacion (id, codigo, nombre, direccion, descripcion, activo)
    VALUES
      ('30000000-0000-4000-8000-000000000001', 'DEL_NORTE', 'Delegación Municipal Norte', 'Las Ánimas, Valdivia', 'Jurisdicción y cobertura territorial norte de Valdivia (Las Ánimas, Cabo Blanco)', true),
      ('30000000-0000-4000-8000-000000000002', 'DEL_SUR', 'Delegación Municipal Sur', 'Angachilla, Valdivia', 'Jurisdicción y cobertura territorial sur de Valdivia (Angachilla, Guacamayo)', true),
      ('30000000-0000-4000-8000-000000000003', 'DEL_COSTA', 'Delegación Municipal Costa', 'Niebla, Valdivia', 'Jurisdicción y cobertura territorial zona costera (Niebla, Los Molinos, Corral)', true),
      ('30000000-0000-4000-8000-000000000004', 'DEL_CALLE_CALLE', 'Delegación Municipal Calle Calle', 'Collico, Valdivia', 'Jurisdicción y cobertura territorial eje fluvial e interior (Collico, Corvi)', true)
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      direccion = EXCLUDED.direccion;
  `.execute(db);

  // 8. Semillas: Roles institucionales
  await sql`
    INSERT INTO rol (id, codigo, nombre, descripcion, activo, es_sistema)
    VALUES
      ('20000000-0000-4000-8000-000000000001', 'ADMIN', 'Administrador', 'Acceso total y configuración del sistema', true, true),
      ('20000000-0000-4000-8000-000000000002', 'CALL_CENTER', 'Call Center', 'Recepción de avisos y despacho primario', true, true),
      ('20000000-0000-4000-8000-000000000003', 'ENCARGADO', 'Encargado', 'Gestión táctica de operaciones y misiones', true, true),
      ('20000000-0000-4000-8000-000000000004', 'PATRULLA_VERIFICADORA', 'Patrulla Verificadora', 'Evaluación y verificación en terreno', true, true),
      ('20000000-0000-4000-8000-000000000005', 'DELEGADO_CUADRILLA', 'Delegado de Cuadrilla', 'Líder operativo de cuadrilla en terreno', true, true),
      ('20000000-0000-4000-8000-000000000006', 'ASISTENTE_SOCIAL', 'Asistente Social', 'Levantamiento de ficha FIBE y vulnerabilidad social', true, true),
      ('20000000-0000-4000-8000-000000000007', 'INFORMANTE', 'Informante', 'Ciudadano o entidad que reporta emergencias', true, true),
      ('20000000-0000-4000-8000-000000000008', 'OBSERVADOR', 'Observador Sin Permisos', 'Perfil de auditoría sin permisos operativos activos', true, false),
      ('20000000-0000-4000-8000-000000000009', 'BRIGADISTA', 'Personal de Terreno / Brigadista', 'Miembro operativo ejecutor en terreno', true, false),
      ('20000000-0000-4000-8000-000000000010', 'SUPERVISOR', 'Supervisor Estratégico', 'Monitoreo gerencial, estadísticas, reportería SENAPRED', true, true)
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      es_sistema = EXCLUDED.es_sistema;
  `.execute(db);

  // 9. Semillas: Permisos base
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
      ('10000000-0000-4000-8000-000000000009', 'eventos_atp:crear', 'Crear Eventos ATP', 'Permite registrar puntos críticos y eventos de atención preventiva', 'Eventos ATP'),
      ('10000000-0000-4000-8000-000000000010', 'recursos:leer', 'Listar Recursos', 'Permite consultar el listado del inventario logístico y verificar stock', 'Recursos y Personal'),
      ('10000000-0000-4000-8000-000000000015', 'incidentes:kanban', 'Tablero Kanban de Incidentes', 'Permite visualizar y gestionar incidentes en el tablero Kanban', 'Incidentes')
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      modulo = EXCLUDED.modulo;
  `.execute(db);

  // 10. Semillas: Usuarios iniciales
  await sql`
    INSERT INTO usuario (id, rut, nombres, apellidos, email, rol_id, delegacion_id, activo)
    VALUES
      ('00000000-0000-4000-8000-000000000001', '11111111-1', 'Administrador', 'General', 'admin@valdivia.cl', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true),
      ('00000000-0000-4000-8000-000000000002', '22222222-2', 'Operador', 'Call Center', 'callcenter@valdivia.cl', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', true),
      ('00000000-0000-4000-8000-000000000003', '33333333-3', 'Encargado', 'de Operaciones', 'encargado@valdivia.cl', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', true),
      ('a0000000-0000-4000-8000-000000000001', '99999999-9', 'Operador QA', 'Call Center', 'operador.qa@valdivia.cl', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', true),
      ('c1111111-1111-4111-8111-111111111111', '14111111-1', 'Carlos', 'Miranda (Mesa 1)', 'carlos.miranda@valdivia.cl', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', true),
      ('c2222222-2222-4222-8222-222222222222', '15222222-2', 'Patricia', 'Valenzuela (Mesa 2)', 'patricia.valenzuela@valdivia.cl', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', true)
    ON CONFLICT (email) DO UPDATE SET
      nombres = EXCLUDED.nombres,
      apellidos = EXCLUDED.apellidos,
      rol_id = EXCLUDED.rol_id,
      delegacion_id = EXCLUDED.delegacion_id;
  `.execute(db);

  // 11. Asignaciones de permisos (rol_permiso)
  // Administrador: Todos los permisos
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT '20000000-0000-4000-8000-000000000001', p.id, '00000000-0000-4000-8000-000000000001'
    FROM permiso p
    ON CONFLICT DO NOTHING;
  `.execute(db);

  // Call Center: Avisos e incidentes manuales
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT '20000000-0000-4000-8000-000000000002', p.id, '00000000-0000-4000-8000-000000000001'
    FROM permiso p
    WHERE p.codigo IN ('crear_incidente_manual', 'incidentes:avisos:leer', 'incidentes:avisos:verificar', 'incidentes:avisos:descartar')
    ON CONFLICT DO NOTHING;
  `.execute(db);

  // Encargado: Kanban y asignación de misiones
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT '20000000-0000-4000-8000-000000000003', p.id, '00000000-0000-4000-8000-000000000001'
    FROM permiso p
    WHERE p.codigo IN ('incidentes:kanban', 'misiones:asignar', 'recursos:leer')
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("rol_permiso").ifExists().execute();
  await db.schema.dropTable("usuario").ifExists().execute();
  await db.schema.dropTable("permiso").ifExists().execute();
  await db.schema.dropTable("rol").ifExists().execute();
  await db.schema.dropTable("delegacion").ifExists().execute();
}
