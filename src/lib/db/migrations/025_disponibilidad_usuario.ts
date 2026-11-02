import { Kysely, sql } from "kysely";

/**
 * H11 - Normalización de la disponibilidad operacional.
 *
 * El estado operativo (disponible, en_mision, en_patrulla, descanso, licencia, inactivo)
 * pasa a residir en `usuario.estado_operativo`, porque la disponibilidad es un atributo
 * de TODAS las cuentas del sistema y no sólo de quienes possuem ficha de terreno.
 *
 * `personal` queda como ficha opcional de terreno, cuya única capacidad operativa
 * persistida es `disponible_terreno` (aptitud), mientras el estado vive en `usuario`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Renombrar el enum `estado_operativo_personal` a `estado_operativo`
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'estado_operativo_personal' AND n.nspname = 'public'
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'estado_operativo' AND n.nspname = 'public'
        ) THEN
          ALTER TYPE estado_operativo_personal RENAME TO estado_operativo;
        END IF;
      ELSIF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'estado_operativo' AND n.nspname = 'public'
      ) THEN
        CREATE TYPE estado_operativo AS ENUM (
          'disponible',
          'en_mision',
          'en_patrulla',
          'descanso',
          'licencia',
          'inactivo'
        );
      END IF;
    END $$;
  `.execute(db);

  // 2. Agregar `usuario.estado_operativo` con default 'disponible'
  await sql`
    ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS estado_operativo estado_operativo NOT NULL DEFAULT 'disponible';
  `.execute(db);

  // 3. Copiar el estado histórico existente desde la ficha de personal
  await sql`
    UPDATE usuario u
    SET estado_operativo = p.estado_operativo
    FROM personal p
    WHERE p.usuario_id = u.id
      AND p.estado_operativo IS NOT NULL;
  `.execute(db);

  // 4. Forzar 'inactivo' para cuentas deshabilitadas (activo = false)
  await sql`
    UPDATE usuario
    SET estado_operativo = 'inactivo'
    WHERE activo = false
      AND estado_operativo <> 'inactivo';
  `.execute(db);

  // 5. Eliminar `personal.estado_operativo` (deja una sola fuente de verdad)
  await sql`DROP INDEX IF EXISTS idx_personal_estado_operativo;`.execute(db);
  await sql`ALTER TABLE personal DROP COLUMN IF EXISTS estado_operativo;`.execute(db);

  // 6. Índice dedicado sobre la nueva columna canónica
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usuario_estado_operativo ON usuario(estado_operativo);
  `.execute(db);

  // 7. Refrescar la vista de compatibilidad `usuarios` para exponer la nueva columna
  await sql`DROP VIEW IF EXISTS usuarios;`.execute(db);
  await sql`CREATE VIEW usuarios AS SELECT * FROM usuario;`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // 0. Retirar la vista de compatibilidad `usuarios` (depende de `usuario.estado_operativo`)
  await sql`DROP VIEW IF EXISTS usuarios;`.execute(db);

  // 1. Restaurar `personal.estado_operativo`
  await sql`
    ALTER TABLE personal
      ADD COLUMN IF NOT EXISTS estado_operativo estado_operativo NOT NULL DEFAULT 'disponible';
  `.execute(db);

  // 2. Copiar el estado desde `usuario` hacia `personal`
  await sql`
    UPDATE personal p
    SET estado_operativo = u.estado_operativo
    FROM usuario u
    WHERE u.id = p.usuario_id;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_personal_estado_operativo ON personal(estado_operativo);
  `.execute(db);

  // 3. Eliminar la columna de `usuario`
  await sql`DROP INDEX IF EXISTS idx_usuario_estado_operativo;`.execute(db);
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS estado_operativo;`.execute(db);

  // 4. Restaurar el nombre original del enum
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'estado_operativo' AND n.nspname = 'public'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'estado_operativo_personal' AND n.nspname = 'public'
      ) THEN
        ALTER TYPE estado_operativo RENAME TO estado_operativo_personal;
      END IF;
    END $$;
  `.execute(db);

  // 5. Refrescar la vista de compatibilidad `usuarios`
  await sql`DROP VIEW IF EXISTS usuarios;`.execute(db);
  await sql`CREATE VIEW usuarios AS SELECT * FROM usuario;`.execute(db);
}
