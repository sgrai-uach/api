import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas tipo_riesgo y prioridad a la tabla prevencion
  await sql`
    ALTER TABLE prevencion 
    ADD COLUMN IF NOT EXISTS tipo_riesgo VARCHAR(100),
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) NOT NULL DEFAULT 'MEDIA';
  `.execute(db);

  // 2. Índice para acelerar filtros de monitoreo por prioridad y estado activo
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prevencion_prioridad ON prevencion (prioridad);
    CREATE INDEX IF NOT EXISTS idx_prevencion_activo ON prevencion (activo);
  `.execute(db);

  // 3. Registrar capacidad de RBAC para listar y monitorear puntos críticos
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      '10000000-0000-4000-8000-000000000013',
      'puntos_criticos:leer',
      'Listar Puntos Críticos',
      'Permite acceder al inventario y monitoreo territorial de puntos críticos en Valdivia',
      'Eventos ATP'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  // 4. Asignar permiso al perfil de Administrador del SGRAI
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    VALUES (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-000000000001'
    )
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM rol_permiso WHERE permiso_id = '10000000-0000-4000-8000-000000000013'`.execute(db);
  await sql`DELETE FROM permiso WHERE codigo = 'puntos_criticos:leer'`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_prevencion_prioridad;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_prevencion_activo;`.execute(db);

  await sql`
    ALTER TABLE prevencion 
    DROP COLUMN IF EXISTS prioridad,
    DROP COLUMN IF EXISTS tipo_riesgo;
  `.execute(db);
}
