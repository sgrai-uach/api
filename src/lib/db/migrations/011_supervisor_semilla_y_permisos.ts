import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Asignar permiso 'recursos:leer' al rol SUPERVISOR (si no lo tiene asignado)
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT 
      '20000000-0000-4000-8000-000000000010', 
      p.id, 
      '00000000-0000-4000-8000-000000000001'
    FROM permiso p
    WHERE p.codigo = 'recursos:leer'
    ON CONFLICT DO NOTHING;
  `.execute(db);

  // 2. Crear usuario de prueba para el rol Supervisor Estratégico
  // Hash bcrypt de 'Valdivia2026!' con salt rounds 10
  const HASH_VALDIVIA_2026 = "$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm";

  await sql`
    INSERT INTO usuario (
      id,
      rut,
      nombres,
      apellidos,
      email,
      password_hash,
      rol_id,
      delegacion_id,
      activo
    )
    VALUES (
      '00000000-0000-4000-8000-000000000010',
      '44444444-4',
      'Supervisor',
      'Estratégico',
      'supervisor@valdivia.cl',
      ${HASH_VALDIVIA_2026},
      '20000000-0000-4000-8000-000000000010',
      '30000000-0000-4000-8000-000000000001',
      true
    )
    ON CONFLICT (email) DO UPDATE SET
      rut = EXCLUDED.rut,
      nombres = EXCLUDED.nombres,
      apellidos = EXCLUDED.apellidos,
      rol_id = EXCLUDED.rol_id,
      delegacion_id = EXCLUDED.delegacion_id,
      password_hash = EXCLUDED.password_hash,
      activo = EXCLUDED.activo;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM usuario 
    WHERE email = 'supervisor@valdivia.cl' 
       OR id = '00000000-0000-4000-8000-000000000010';
  `.execute(db);

  await sql`
    DELETE FROM rol_permiso
    WHERE rol_id = '20000000-0000-4000-8000-000000000010'
      AND permiso_id = (SELECT id FROM permiso WHERE codigo = 'recursos:leer');
  `.execute(db);
}
