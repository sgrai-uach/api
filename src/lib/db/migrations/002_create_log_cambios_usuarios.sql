-- ============================================================================
-- Migración 002: Tabla de auditoría y log de cambios de usuarios y personal
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_cambios_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_modificado_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modificado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    campos_modificados JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_log_cambios_usuarios_usuario ON log_cambios_usuarios(usuario_modificado_id);
CREATE INDEX IF NOT EXISTS idx_log_cambios_usuarios_admin ON log_cambios_usuarios(modificado_por_id);
CREATE INDEX IF NOT EXISTS idx_log_cambios_usuarios_created ON log_cambios_usuarios(created_at);
