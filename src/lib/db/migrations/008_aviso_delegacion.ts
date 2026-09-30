import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas delegacion_id y delegacion_manual a aviso_incidente
  await db.schema
    .alterTable("aviso_incidente")
    .addColumn("delegacion_id", "uuid", (col) =>
      col.references("delegacion.id").onDelete("set null")
    )
    .execute();

  await db.schema
    .alterTable("aviso_incidente")
    .addColumn("delegacion_manual", "varchar(100)")
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_delegacion_id ON aviso_incidente (delegacion_id);`.execute(db);

  // 2. Crear vista avisos_incidentes en plural para compatibilidad
  await sql`CREATE OR REPLACE VIEW avisos_incidentes AS SELECT * FROM aviso_incidente;`.execute(db);

  // 3. Poblar delegacion_id en avisos existentes de acuerdo a dirección en Valdivia
  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_COSTA')
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%niebla%' OR direccion_texto ILIKE '%molinos%' OR direccion_texto ILIKE '%torobayo%'
    );
  `.execute(db);

  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_NORTE')
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%alemania%' OR direccion_texto ILIKE '%ánimas%' OR direccion_texto ILIKE '%animas%' OR direccion_texto ILIKE '%cabo blanco%'
    );
  `.execute(db);

  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_SUR')
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%francia%' OR direccion_texto ILIKE '%simpson%' OR direccion_texto ILIKE '%picarte%' OR direccion_texto ILIKE '%angachilla%' OR direccion_texto ILIKE '%guacamayo%' OR direccion_texto ILIKE '%toribio%'
    );
  `.execute(db);

  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_CALLE_CALLE')
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%collico%' OR direccion_texto ILIKE '%corvi%' OR direccion_texto ILIKE '%balmaceda%'
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP VIEW IF EXISTS avisos_incidentes;`.execute(db);
  await db.schema.alterTable("aviso_incidente").dropColumn("delegacion_manual").execute();
  await db.schema.alterTable("aviso_incidente").dropColumn("delegacion_id").execute();
}
