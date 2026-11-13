import { Kysely, sql } from "kysely";

/**
 * HU-38 - Asignar o modificar la prioridad del incidente en base a evaluación técnica en terreno.
 *
 * 1. Añade a `incidente` las columnas `prioridad_sugerida` y `justificacion_prioridad`.
 * 2. Añade a `reporte_terreno` las columnas de versionado y trazabilidad de evaluación:
 *    `version_reporte`, `es_rectificacion`, `prioridad_sugerida`, `prioridad_asignada`,
 *    `justificacion_prioridad` y `detalles_evaluacion` (JSONB).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Columnas de prioridad sugerida y justificación técnica en tabla incidente
  await sql`
    ALTER TABLE incidente
    ADD COLUMN IF NOT EXISTS prioridad_sugerida VARCHAR(20),
    ADD COLUMN IF NOT EXISTS justificacion_prioridad TEXT;
  `.execute(db);

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_incidente_prioridad_sugerida'
      ) THEN
        ALTER TABLE incidente
        ADD CONSTRAINT chk_incidente_prioridad_sugerida
        CHECK (prioridad_sugerida IS NULL OR prioridad_sugerida IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA'));
      END IF;
    END $$;
  `.execute(db);

  // 2. Columnas de versionado y evaluación técnica estructurada en reporte_terreno
  await sql`
    ALTER TABLE reporte_terreno
    ADD COLUMN IF NOT EXISTS version_reporte INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS es_rectificacion BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS prioridad_sugerida VARCHAR(20),
    ADD COLUMN IF NOT EXISTS prioridad_asignada VARCHAR(20),
    ADD COLUMN IF NOT EXISTS justificacion_prioridad TEXT,
    ADD COLUMN IF NOT EXISTS detalles_evaluacion JSONB NOT NULL DEFAULT '{}'::jsonb;
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reporte_terreno_mision_version
    ON reporte_terreno (mision_id, version_reporte DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_reporte_terreno_mision_version;`.execute(db);

  await sql`
    ALTER TABLE reporte_terreno
    DROP COLUMN IF EXISTS detalles_evaluacion,
    DROP COLUMN IF EXISTS justificacion_prioridad,
    DROP COLUMN IF EXISTS prioridad_asignada,
    DROP COLUMN IF EXISTS prioridad_sugerida,
    DROP COLUMN IF EXISTS es_rectificacion,
    DROP COLUMN IF EXISTS version_reporte;
  `.execute(db);

  await sql`
    ALTER TABLE incidente
    DROP CONSTRAINT IF EXISTS chk_incidente_prioridad_sugerida;
  `.execute(db);

  await sql`
    ALTER TABLE incidente
    DROP COLUMN IF EXISTS justificacion_prioridad,
    DROP COLUMN IF EXISTS prioridad_sugerida;
  `.execute(db);
}

