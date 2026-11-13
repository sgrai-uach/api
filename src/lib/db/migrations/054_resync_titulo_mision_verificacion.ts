import { Kysely, sql } from "kysely";

/**
 * Sincroniza el título de las misiones de VERIFICACION existentes con el
 * `tipo_afectacion` y `codigo` actuales del incidente asociado, corrigiendo
 * desincronizaciones históricas tras reclasificaciones en terreno (HU-37 / HU-38).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Asegurar columna metadatos en mision_hito antes de reconciliar títulos para preservar tipoAnterior histórico
  await sql`
    ALTER TABLE mision_hito
    ADD COLUMN IF NOT EXISTS metadatos JSONB NULL;
  `.execute(db);

  // Backfill de metadatos en hitos TIPOLOGIA_RECLASIFICADA existentes extrayendo tipoAnterior desde el título original
  await sql`
    UPDATE mision_hito mh
    SET metadatos = jsonb_build_object(
      'tipoAnterior',
       CASE
        WHEN m.titulo LIKE 'Verificación: % - ' || i.codigo THEN
           regexp_replace(
            substring(m.titulo FROM '^Verificación: (.*) - ' || i.codigo || '$'),
            '^\\s+|\\s+$', '', 'g'
          )
        ELSE NULL
      END,
      'tipoNuevo', i.tipo_afectacion,
      'tipoNuevoId', i.tipo_incidente_id,
      'justificacion', COALESCE(
        substring(mh.descripcion FROM 'Justificación:\\s*(.+)$'),
        mh.descripcion
      )
    )
    FROM mision m
    JOIN incidente i ON i.id = m.incidente_id
    WHERE mh.mision_id = m.id
      AND mh.hito = 'TIPOLOGIA_RECLASIFICADA'
      AND mh.metadatos IS NULL;
  `.execute(db);

  await sql`
    UPDATE mision m
    SET
      titulo = 'Verificación: ' || i.tipo_afectacion || ' - ' || i.codigo,
      actualizado_en = CURRENT_TIMESTAMP
    FROM incidente i
    WHERE m.incidente_id = i.id
      AND m.tipo_mision = 'VERIFICACION'
      AND i.tipo_afectacion IS NOT NULL
      AND i.codigo IS NOT NULL
      AND m.titulo IS DISTINCT FROM ('Verificación: ' || i.tipo_afectacion || ' - ' || i.codigo);
  `.execute(db);
}

export async function down(): Promise<void> {
  // Operación de reconciliación de datos no reversible (el estado sincronizado es el canónico).
}
