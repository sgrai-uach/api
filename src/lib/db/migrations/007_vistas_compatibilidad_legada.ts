import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Limpieza condicional defensiva si existían como BASE TABLE previo a crear vistas
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios' AND table_type = 'BASE TABLE') THEN
        DROP TABLE public.usuarios CASCADE;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles' AND table_type = 'BASE TABLE') THEN
        DROP TABLE public.roles CASCADE;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delegaciones' AND table_type = 'BASE TABLE') THEN
        DROP TABLE public.delegaciones CASCADE;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rol_permisos' AND table_type = 'BASE TABLE') THEN
        DROP TABLE public.rol_permisos CASCADE;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permisos' AND table_type = 'BASE TABLE') THEN
        DROP TABLE public.permisos CASCADE;
      END IF;
    END $$;
  `.execute(db);

  // 2. Vistas de compatibilidad en plural para servicios legados y consultas directas
  await sql`CREATE OR REPLACE VIEW usuarios AS SELECT * FROM usuario;`.execute(db);
  await sql`CREATE OR REPLACE VIEW roles AS SELECT * FROM rol;`.execute(db);
  await sql`CREATE OR REPLACE VIEW delegaciones AS SELECT * FROM delegacion;`.execute(db);
  await sql`CREATE OR REPLACE VIEW rol_permisos AS SELECT * FROM rol_permiso;`.execute(db);
  await sql`CREATE OR REPLACE VIEW permisos AS SELECT * FROM permiso;`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP VIEW IF EXISTS permisos;`.execute(db);
  await sql`DROP VIEW IF EXISTS rol_permisos;`.execute(db);
  await sql`DROP VIEW IF EXISTS delegaciones;`.execute(db);
  await sql`DROP VIEW IF EXISTS roles;`.execute(db);
  await sql`DROP VIEW IF EXISTS usuarios;`.execute(db);
}
