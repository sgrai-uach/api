import { sql, type Kysely } from "kysely";

/**
 * Migración 042: Vistas de compatibilidad para cuadrilla_integrante y patrulla_integrante
 * Mapean a las tablas operativas físicas cuadrilla_personal y patrulla_personal.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE VIEW cuadrilla_integrante AS 
    SELECT * FROM cuadrilla_personal;
  `.execute(db);

  await sql`
    CREATE OR REPLACE VIEW patrulla_integrante AS 
    SELECT * FROM patrulla_personal;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP VIEW IF EXISTS patrulla_integrante;`.execute(db);
  await sql`DROP VIEW IF EXISTS cuadrilla_integrante;`.execute(db);
}
