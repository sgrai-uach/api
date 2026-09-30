import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas para bloqueo por fuerza bruta y control de intentos fallidos
  await sql`
    ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ DEFAULT NULL;
  `.execute(db);

  // 2. Crear índice para optimizar consultas de verificación de bloqueo
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usuario_bloqueado_hasta ON usuario(bloqueado_hasta);
  `.execute(db);

  // 3. Actualizar valor por defecto de password_hash en la tabla usuario
  // Hash bcrypt de 'Valdivia2026!' con salt rounds 10
  const HASH_VALDIVIA_2026 = "$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm";

  await sql`
    ALTER TABLE usuario
    ALTER COLUMN password_hash SET DEFAULT ${HASH_VALDIVIA_2026};
  `.execute(db);

  // 4. Actualizar contraseñas de todos los usuarios institucionales predefinidos
  await sql`
    UPDATE usuario
    SET password_hash = ${HASH_VALDIVIA_2026}
    WHERE password_hash = '$2b$10$w8T9HfgdOa8m8y2hQZgE6e1GzD3M9K5wU6Zz0gV7P8H6tY7bQZgE6'
       OR email IN (
         'admin@valdivia.cl',
         'callcenter@valdivia.cl',
         'encargado@valdivia.cl',
         'operador.qa@valdivia.cl',
         'carlos.miranda@valdivia.cl',
         'patricia.valenzuela@valdivia.cl'
       );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_usuario_bloqueado_hasta;`.execute(db);

  await sql`
    ALTER TABLE usuario
    DROP COLUMN IF EXISTS intentos_fallidos,
    DROP COLUMN IF EXISTS bloqueado_hasta;
  `.execute(db);
}
