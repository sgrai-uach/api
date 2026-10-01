import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Asegurar columna codigo en delegacion para evitar fallos si no existe
  await sql`
    ALTER TABLE delegacion
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
  `.execute(db);

  await sql`
    UPDATE delegacion SET codigo = 'DEL_NORTE' WHERE codigo IS NULL AND (nombre ILIKE '%norte%');
    UPDATE delegacion SET codigo = 'DEL_SUR' WHERE codigo IS NULL AND (nombre ILIKE '%sur%');
    UPDATE delegacion SET codigo = 'DEL_COSTA' WHERE codigo IS NULL AND (nombre ILIKE '%costa%');
    UPDATE delegacion SET codigo = 'DEL_CALLE_CALLE' WHERE codigo IS NULL AND (nombre ILIKE '%calle%calle%');
  `.execute(db);

  // 2. Agregar columnas delegacion_id y delegacion_manual a aviso_incidente de forma idempotente
  await sql`
    ALTER TABLE aviso_incidente
    ADD COLUMN IF NOT EXISTS delegacion_id UUID REFERENCES delegacion(id) ON DELETE SET NULL;
  `.execute(db);

  await sql`
    ALTER TABLE aviso_incidente
    ADD COLUMN IF NOT EXISTS delegacion_manual VARCHAR(100);
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_aviso_incidente_delegacion_id ON aviso_incidente (delegacion_id);`.execute(db);

  // 3. Crear o reemplazar vista avisos_incidentes en plural para compatibilidad defensiva
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'avisos_incidentes' AND table_type = 'BASE TABLE') THEN
        DROP TABLE public.avisos_incidentes CASCADE;
      END IF;
    END $$;
  `.execute(db);

  await sql`CREATE OR REPLACE VIEW avisos_incidentes AS SELECT * FROM aviso_incidente;`.execute(db);

  // 4. Poblar delegacion_id en avisos existentes de acuerdo a dirección en Valdivia
  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_COSTA' OR nombre ILIKE '%costa%' LIMIT 1)
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%niebla%' OR direccion_texto ILIKE '%molinos%' OR direccion_texto ILIKE '%torobayo%'
    );
  `.execute(db);

  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_NORTE' OR nombre ILIKE '%norte%' LIMIT 1)
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%alemania%' OR direccion_texto ILIKE '%ánimas%' OR direccion_texto ILIKE '%animas%' OR direccion_texto ILIKE '%cabo blanco%'
    );
  `.execute(db);

  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_SUR' OR nombre ILIKE '%sur%' LIMIT 1)
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%francia%' OR direccion_texto ILIKE '%simpson%' OR direccion_texto ILIKE '%picarte%' OR direccion_texto ILIKE '%angachilla%' OR direccion_texto ILIKE '%guacamayo%' OR direccion_texto ILIKE '%toribio%'
    );
  `.execute(db);

  await sql`
    UPDATE aviso_incidente
    SET delegacion_id = (SELECT id FROM delegacion WHERE codigo = 'DEL_CALLE_CALLE' OR nombre ILIKE '%calle%calle%' LIMIT 1)
    WHERE delegacion_id IS NULL AND (
      direccion_texto ILIKE '%collico%' OR direccion_texto ILIKE '%corvi%' OR direccion_texto ILIKE '%balmaceda%'
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP VIEW IF EXISTS avisos_incidentes;`.execute(db);
  await sql`ALTER TABLE aviso_incidente DROP COLUMN IF EXISTS delegacion_manual;`.execute(db);
  await sql`ALTER TABLE aviso_incidente DROP COLUMN IF EXISTS delegacion_id;`.execute(db);
}
