import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas tipo_riesgo y prioridad a la tabla prevencion
  await sql`
    ALTER TABLE prevencion 
    ADD COLUMN IF NOT EXISTS tipo_riesgo VARCHAR(100),
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) NOT NULL DEFAULT 'MEDIA';
  `.execute(db);

  // 2. Índices para acelerar filtros de monitoreo por prioridad y estado activo
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prevencion_prioridad ON prevencion (prioridad);
    CREATE INDEX IF NOT EXISTS idx_prevencion_activo ON prevencion (activo);
  `.execute(db);

  // 3. Registrar capacidad de RBAC de forma segura e idempotente (evita colisión de PK en permiso)
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000015';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
    BEGIN
      -- Verificar si ya existe el permiso por código único
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'puntos_criticos:leer';

      IF v_permiso_id IS NULL THEN
        -- Si el ID target estuviera ocupado, generar uno aleatorio seguro
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'puntos_criticos:leer',
            'Listar Puntos Críticos',
            'Permite acceder al inventario y monitoreo territorial de puntos críticos en Valdivia',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'puntos_criticos:leer',
            'Listar Puntos Críticos',
            'Permite acceder al inventario y monitoreo territorial de puntos críticos en Valdivia',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      END IF;

      -- Asignar el permiso al rol Administrador si no se encuentra asignado
      IF v_permiso_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_admin_rol_id, v_permiso_id, v_admin_rol_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso 
    WHERE permiso_id IN (SELECT id FROM permiso WHERE codigo = 'puntos_criticos:leer');
  `.execute(db);

  await sql`DELETE FROM permiso WHERE codigo = 'puntos_criticos:leer';`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_prevencion_prioridad;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_prevencion_activo;`.execute(db);

  await sql`
    ALTER TABLE prevencion 
    DROP COLUMN IF EXISTS prioridad,
    DROP COLUMN IF EXISTS tipo_riesgo;
  `.execute(db);
}
