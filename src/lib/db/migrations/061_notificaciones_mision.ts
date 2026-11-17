import { sql, type Kysely } from "kysely";

/**
 * HU-35: Trazabilidad y Máquina de Estados de Notificaciones de Misión para Terreno.
 *
 * 1. Asegura de forma idempotente el permiso `misiones:terreno:verificar` y su asignación
 *    a los roles `ADMIN` y `PATRULLA_VERIFICADORA`.
 * 2. Crea la tabla `notificaciones_mision` con timestamps UTC para auditar el ciclo de vida
 *    (`PENDIENTE_ENVIO` -> `ENVIADA` -> `RECIBIDA` -> `LEIDA`) e índices de optimización.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Asegurar permiso RBAC 'misiones:terreno:verificar'
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000036';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_patrulla_rol_id UUID := '20000000-0000-4000-8000-000000000004';
      v_admin_user_id UUID;
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'misiones:terreno:verificar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'misiones:terreno:verificar',
            'Verificar y Aceptar Misiones en Terreno',
            'Permite a la patrulla verificadora recibir, confirmar y gestionar notificaciones y misiones en terreno',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'misiones:terreno:verificar',
            'Verificar y Aceptar Misiones en Terreno',
            'Permite a la patrulla verificadora recibir, confirmar y gestionar notificaciones y misiones en terreno',
            'Misiones'
          )
          RETURNING id INTO v_permiso_id;
        END IF;
      ELSE
        UPDATE permiso
        SET
          nombre = 'Verificar y Aceptar Misiones en Terreno',
          descripcion = 'Permite a la patrulla verificadora recibir, confirmar y gestionar notificaciones y misiones en terreno',
          modulo = 'Misiones'
        WHERE id = v_permiso_id;
      END IF;

      SELECT id INTO v_admin_user_id FROM usuario WHERE id = '00000000-0000-4000-8000-000000000001';
      IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM usuario LIMIT 1;
      END IF;

      INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
      VALUES
        (v_admin_rol_id, v_permiso_id, v_admin_user_id),
        (v_patrulla_rol_id, v_permiso_id, v_admin_user_id)
      ON CONFLICT DO NOTHING;
    END $$;
  `.execute(db);

  // 2. Crear tabla notificaciones_mision
  await sql`
    CREATE TABLE IF NOT EXISTS notificaciones_mision (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mision_id UUID NOT NULL REFERENCES mision(id) ON DELETE CASCADE,
      patrulla_id UUID NOT NULL REFERENCES patrulla_verificadora(id) ON DELETE CASCADE,
      estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_ENVIO'
        CHECK (estado IN ('PENDIENTE_ENVIO', 'ENVIADA', 'RECIBIDA', 'LEIDA')),
      intentos_envio INTEGER NOT NULL DEFAULT 0,
      creada_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviada_at TIMESTAMPTZ DEFAULT NULL,
      recibida_at TIMESTAMPTZ DEFAULT NULL,
      leida_at TIMESTAMPTZ DEFAULT NULL
    );
  `.execute(db);

  // 3. Índices para acelerar reconciliación offline y trazabilidad
  await db.schema
    .createIndex("idx_notificaciones_mision_patrulla_estado")
    .ifNotExists()
    .on("notificaciones_mision")
    .columns(["patrulla_id", "estado"])
    .execute();

  await db.schema
    .createIndex("idx_notificaciones_mision_mision_id")
    .ifNotExists()
    .on("notificaciones_mision")
    .column("mision_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("notificaciones_mision").ifExists().execute();

  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'misiones:terreno:verificar'
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso WHERE codigo = 'misiones:terreno:verificar';
  `.execute(db);
}

