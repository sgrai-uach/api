import { Kysely, sql } from "kysely";

/**
 * HU-68 - Informe Técnico Final de Cuadrilla y Cierre de Misión en Terreno.
 *
 * 1. Añade a `reporte_terreno` las columnas `horas_hombre` y `materiales_consumidos`.
 * 2. Añade la restricción `chk_reporte_terreno_horas_hombre` (`horas_hombre IS NULL OR horas_hombre >= 0`).
 * 3. Garantiza de forma idempotente la asignación de los permisos RBAC `misiones:terreno:ejecutar`
 *    (ADMIN y DELEGADO_CUADRILLA) y `recursos:leer` (DELEGADO_CUADRILLA).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Columnas de cierre operativo de cuadrilla en reporte_terreno
  await sql`
    ALTER TABLE reporte_terreno
    ADD COLUMN IF NOT EXISTS horas_hombre NUMERIC(6, 2) NULL,
    ADD COLUMN IF NOT EXISTS materiales_consumidos JSONB NOT NULL DEFAULT '[]'::jsonb;
  `.execute(db);

  // 2. Restricción de integridad para horas hombre
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_reporte_terreno_horas_hombre'
      ) THEN
        ALTER TABLE reporte_terreno
        ADD CONSTRAINT chk_reporte_terreno_horas_hombre
        CHECK (horas_hombre IS NULL OR horas_hombre >= 0);
      END IF;
    END $$;
  `.execute(db);

  // 3. Garantizar permisos RBAC para cierre de misión de cuadrilla y lectura de insumos
  await sql`
    DO $$
    DECLARE
      v_permiso_ejecutar_id UUID;
      v_permiso_recursos_leer_id UUID;
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_delegado_rol_id UUID := '20000000-0000-4000-8000-000000000005';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      SELECT id INTO v_permiso_ejecutar_id FROM permiso WHERE codigo = 'misiones:terreno:ejecutar';
      IF v_permiso_ejecutar_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES
          (v_admin_rol_id, v_permiso_ejecutar_id, v_admin_user_id),
          (v_delegado_rol_id, v_permiso_ejecutar_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;

      SELECT id INTO v_permiso_recursos_leer_id FROM permiso WHERE codigo = 'recursos:leer';
      IF v_permiso_recursos_leer_id IS NOT NULL THEN
        INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
        VALUES (v_delegado_rol_id, v_permiso_recursos_leer_id, v_admin_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM rol_permiso
    WHERE rol_id = '20000000-0000-4000-8000-000000000005'
      AND permiso_id IN (
        SELECT id FROM permiso WHERE codigo = 'recursos:leer'
      );
  `.execute(db);

  await sql`
    ALTER TABLE reporte_terreno
    DROP CONSTRAINT IF EXISTS chk_reporte_terreno_horas_hombre;
  `.execute(db);

  await sql`
    ALTER TABLE reporte_terreno
    DROP COLUMN IF EXISTS materiales_consumidos,
    DROP COLUMN IF EXISTS horas_hombre;
  `.execute(db);
}
