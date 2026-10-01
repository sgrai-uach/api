import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Vistas de compatibilidad en plural para servicios legados y consultas directas
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
