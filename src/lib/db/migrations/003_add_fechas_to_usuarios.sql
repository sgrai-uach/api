-- ============================================================================
-- Migración 003: Fechas de ingreso y salida municipal para usuarios
-- ============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_salida DATE;

CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_ingreso ON usuarios(fecha_ingreso);
