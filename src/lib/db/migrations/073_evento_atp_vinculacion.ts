import { sql, type Kysely } from "kysely";

/**
 * Migración de vinculación de entidades a Eventos ATP (H60).
 *
 * 1. Renombra el estado CERRADO a FINALIZADO para alinear el dominio con la
 *    historia de usuario y la matriz QA de H60.
 * 2. Crea el permiso RBAC `eventos_atp:vincular` y lo asigna a los roles
 *    Administrador y Encargado.
 *
 * IMPORTANTE: no modifica la migración 072. La FK `evento_atp_id` ya existe en
 * las cuatro entidades vinculables desde H61.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Renombrar CERRADO -> FINALIZADO
  await sql`
    UPDATE evento_atp
    SET estado = 'FINALIZADO'
    WHERE estado = 'CERRADO';
  `.execute(db);

  await sql`
    ALTER TABLE evento_atp
    DROP CONSTRAINT IF EXISTS evento_atp_estado_valido;
  `.execute(db);

  await sql`
    ALTER TABLE evento_atp
    ADD CONSTRAINT evento_atp_estado_valido
    CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'CANCELADO'));
  `.execute(db);

  // 2. Permiso RBAC para vincular y desvincular entidades
  await sql`
    INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
    VALUES (
      gen_random_uuid(),
      'eventos_atp:vincular',
      'Vincular entidades a Eventos ATP',
      'Permite vincular y desvincular incidentes, eventos de prevención, operativos de recuperación y casos de asistencia social a un Evento ATP activo',
      'Eventos ATP'
    )
    ON CONFLICT (codigo) DO NOTHING;
  `.execute(db);

  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT
      rol.id,
      p.id,
      '00000000-0000-4000-8000-000000000001'
    FROM (VALUES
      ('20000000-0000-4000-8000-000000000001'::uuid),
      ('20000000-0000-4000-8000-000000000003'::uuid)
    ) AS rol(id)
    CROSS JOIN permiso p
    WHERE p.codigo = 'eventos_atp:vincular'
    ON CONFLICT DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // 1. Eliminar asignaciones y permiso
  await sql`
    DELETE FROM rol_permiso
    WHERE permiso_id IN (
      SELECT id FROM permiso WHERE codigo = 'eventos_atp:vincular'
    );
  `.execute(db);

  await sql`
    DELETE FROM permiso
    WHERE codigo = 'eventos_atp:vincular';
  `.execute(db);

  // 2. Restaurar el estado CERRADO
  await sql`
    ALTER TABLE evento_atp
    DROP CONSTRAINT IF EXISTS evento_atp_estado_valido;
  `.execute(db);

  await sql`
    UPDATE evento_atp
    SET estado = 'CERRADO'
    WHERE estado = 'FINALIZADO';
  `.execute(db);

  await sql`
    ALTER TABLE evento_atp
    ADD CONSTRAINT evento_atp_estado_valido
    CHECK (estado IN ('ACTIVO', 'CERRADO', 'CANCELADO'));
  `.execute(db);
}
