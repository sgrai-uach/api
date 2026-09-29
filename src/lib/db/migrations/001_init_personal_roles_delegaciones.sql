-- ============================================================================
-- Migración 001: Inicialización de Delegaciones, Roles, Permisos, Usuarios y Personal
-- Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)
-- Municipalidad de Valdivia
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ----------------------------------------------------------------------------
-- Función y trigger para actualizar updated_at automáticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 1. TABLA: delegaciones
-- Delegaciones territoriales municipales (Norte, Sur, Costa, Calle Calle, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS delegaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delegaciones_codigo ON delegaciones(codigo);
CREATE INDEX IF NOT EXISTS idx_delegaciones_activo ON delegaciones(activo);

CREATE TRIGGER trg_delegaciones_updated_at
    BEFORE UPDATE ON delegaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. TABLA: roles
-- Perfiles de usuario del sistema (Administrador, Encargado, Supervisor, Call Center, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_codigo ON roles(codigo);
CREATE INDEX IF NOT EXISTS idx_roles_activo ON roles(activo);

CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. TABLA: permisos y rol_permisos
-- Matriz granular de permisos por módulo/acción
-- ============================================================================
CREATE TABLE IF NOT EXISTS permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) UNIQUE NOT NULL, -- ej: incidentes:crear, personal:asignar
    modulo VARCHAR(50) NOT NULL,        -- ej: incidentes, misiones, recursos, seguridad
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permisos_codigo ON permisos(codigo);
CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON permisos(modulo);

CREATE TABLE IF NOT EXISTS rol_permisos (
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE INDEX IF NOT EXISTS idx_rol_permisos_rol ON rol_permisos(rol_id);
CREATE INDEX IF NOT EXISTS idx_rol_permisos_permiso ON rol_permisos(permiso_id);

-- ============================================================================
-- 4. TABLA: usuarios
-- Empleados/usuarios generales del sistema SGRAI con credenciales de acceso
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rut VARCHAR(20) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    delegacion_id UUID REFERENCES delegaciones(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rut ON usuarios(rut);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_delegacion_id ON usuarios(delegacion_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. TABLA: personal
-- Tipo especializado de usuario (empleado operativo que puede ir a terreno)
-- Capaz de conformar patrullas verificadoras, cuadrillas de emergencia y misiones.
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE estado_operativo_personal AS ENUM (
        'disponible',
        'en_mision',
        'en_patrulla',
        'descanso',
        'licencia',
        'inactivo'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    delegacion_id UUID NOT NULL REFERENCES delegaciones(id) ON DELETE RESTRICT,
    especialidad VARCHAR(100), -- ej: Verificador, Conductor, Motosierrista, Asistente Social, Operador
    cargo VARCHAR(100),
    estado_operativo estado_operativo_personal NOT NULL DEFAULT 'disponible',
    disponible_terreno BOOLEAN NOT NULL DEFAULT TRUE,
    ultima_ubicacion GEOMETRY(Point, 4326), -- Ubicación en vivo vía GPS/PWA
    ultima_actualizacion_ubicacion TIMESTAMP WITH TIME ZONE,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personal_usuario_id ON personal(usuario_id);
CREATE INDEX IF NOT EXISTS idx_personal_delegacion_id ON personal(delegacion_id);
CREATE INDEX IF NOT EXISTS idx_personal_estado_operativo ON personal(estado_operativo);
CREATE INDEX IF NOT EXISTS idx_personal_disponible_terreno ON personal(disponible_terreno);
CREATE INDEX IF NOT EXISTS idx_personal_ultima_ubicacion ON personal USING GIST(ultima_ubicacion);

CREATE TRIGGER trg_personal_updated_at
    BEFORE UPDATE ON personal
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED BÁSICO DE VALORES POR DEFECTO
-- ============================================================================

-- Delegaciones institucionales de Valdivia
INSERT INTO delegaciones (codigo, nombre) VALUES
('DEL_NORTE', 'Delegación Norte'),
('DEL_SUR', 'Delegación Sur'),
('DEL_COSTA', 'Delegación Costa'),
('DEL_CALLE_CALLE', 'Delegación Calle Calle')
ON CONFLICT (codigo) DO NOTHING;

-- Roles institucionales del SGRAI
INSERT INTO roles (codigo, nombre, descripcion) VALUES
('ADMIN', 'Administrador', 'Control total de la plataforma, configuración, usuarios y recursos'),
('ENCARGADO', 'Encargado Centro de Mando', 'Despacho de misiones, asignación de cuadrillas, patrullas y recursos'),
('SUPERVISOR', 'Supervisor Estratégico', 'Monitoreo gerencial, estadísticas, reportería SENAPRED (Alfa 37G)'),
('CALL_CENTER', 'Operador Call Center', 'Recepción, registro y verificación manual de avisos ciudadanos'),
('ASISTENTE_SOCIAL', 'Asistente Social', 'Levantamiento de fichas FIBE y asignación de beneficios sociales'),
('PATRULLA_VERIFICADORA', 'Patrulla Verificadora', 'Evaluación rápida de incidentes en terreno vía PWA'),
('DELEGADO_CUADRILLA', 'Delegado de Cuadrilla', 'Jefe operativo en terreno a cargo de cuadrillas y ejecución de misiones'),
('BRIGADISTA', 'Personal de Terreno / Brigadista', 'Miembro operativo ejecutor en terreno')
ON CONFLICT (codigo) DO NOTHING;
