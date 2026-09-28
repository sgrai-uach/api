-- ============================================================================
-- Migración 004: Harmonización de Usuarios/Roles, Tipos de Incidente RFC y Seed de Personal
-- Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)
-- Municipalidad de Valdivia
-- ============================================================================

-- 1. Actualizar claves foráneas para soportar ON UPDATE CASCADE
ALTER TABLE IF EXISTS usuario 
  DROP CONSTRAINT IF EXISTS usuario_rol_id_fkey,
  ADD CONSTRAINT usuario_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES rol(id) ON UPDATE CASCADE;

ALTER TABLE IF EXISTS rol_permiso
  DROP CONSTRAINT IF EXISTS rol_permiso_rol_id_fkey,
  ADD CONSTRAINT rol_permiso_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES rol(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE IF EXISTS recurso
  DROP CONSTRAINT IF EXISTS recurso_creado_por_id_fkey,
  ADD CONSTRAINT recurso_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS incidente
  DROP CONSTRAINT IF EXISTS incidente_creado_por_id_fkey,
  ADD CONSTRAINT incidente_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS incidente
  DROP CONSTRAINT IF EXISTS incidente_operador_id_fkey,
  ADD CONSTRAINT incidente_operador_id_fkey FOREIGN KEY (operador_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS incidente
  DROP CONSTRAINT IF EXISTS incidente_encargado_id_fkey,
  ADD CONSTRAINT incidente_encargado_id_fkey FOREIGN KEY (encargado_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS patrulla_verificadora
  DROP CONSTRAINT IF EXISTS patrulla_verificadora_usuario_lider_id_fkey,
  ADD CONSTRAINT patrulla_verificadora_usuario_lider_id_fkey FOREIGN KEY (usuario_lider_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS cuadrilla
  DROP CONSTRAINT IF EXISTS cuadrilla_usuario_delegado_id_fkey,
  ADD CONSTRAINT cuadrilla_usuario_delegado_id_fkey FOREIGN KEY (usuario_delegado_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS mision
  DROP CONSTRAINT IF EXISTS mision_encargado_id_fkey,
  ADD CONSTRAINT mision_encargado_id_fkey FOREIGN KEY (encargado_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS mision
  DROP CONSTRAINT IF EXISTS mision_creado_por_id_fkey,
  ADD CONSTRAINT mision_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE IF EXISTS rol_permiso
  DROP CONSTRAINT IF EXISTS rol_permiso_asignado_por_id_fkey,
  ADD CONSTRAINT rol_permiso_asignado_por_id_fkey FOREIGN KEY (asignado_por_id) REFERENCES usuario(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE IF EXISTS incidente
  DROP CONSTRAINT IF EXISTS incidente_tipo_incidente_id_fkey,
  ADD CONSTRAINT incidente_tipo_incidente_id_fkey FOREIGN KEY (tipo_incidente_id) REFERENCES tipo_incidente(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 2. Harmonizar Roles del sistema RBAC a UUIDs RFC4122 v4
UPDATE rol SET id = '20000000-0000-4000-8000-000000000001' WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE rol SET id = '20000000-0000-4000-8000-000000000002' WHERE id = '20000000-0000-0000-0000-000000000002';

INSERT INTO rol (id, nombre, descripcion, activo, es_sistema)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'Administrador', 'Acceso total y configuración del sistema', true, true),
  ('20000000-0000-4000-8000-000000000002', 'Call Center', 'Recepción de avisos y despacho primario', true, true),
  ('20000000-0000-4000-8000-000000000003', 'Encargado', 'Gestión táctica de operaciones y misiones', true, true)
ON CONFLICT (nombre) DO UPDATE SET activo = true;

-- 3. Harmonizar Usuarios iniciales de RBAC a UUIDs RFC4122 v4
UPDATE usuario SET id = '00000000-0000-4000-8000-000000000001', rol_id = '20000000-0000-4000-8000-000000000001' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE usuario SET id = '00000000-0000-4000-8000-000000000002', rol_id = '20000000-0000-4000-8000-000000000002' WHERE id = '00000000-0000-0000-0000-000000000002';

INSERT INTO usuario (id, rut, nombre, email, rol_id, activo)
VALUES
  ('00000000-0000-4000-8000-000000000001', '11111111-1', 'Administrador General', 'admin@valdivia.cl', '20000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000002', '22222222-2', 'Operador Call Center', 'callcenter@valdivia.cl', '20000000-0000-4000-8000-000000000002', true),
  ('00000000-0000-4000-8000-000000000003', '33333333-3', 'Encargado de Operaciones', 'encargado@valdivia.cl', '20000000-0000-4000-8000-000000000003', true)
ON CONFLICT (email) DO UPDATE SET activo = true, rol_id = EXCLUDED.rol_id;

-- 4. Asegurar matriz completa de permisos en rol_permiso
-- Administrador: todos los permisos del sistema
INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
SELECT '20000000-0000-4000-8000-000000000001', p.id, '00000000-0000-4000-8000-000000000001'
FROM permiso p
ON CONFLICT DO NOTHING;

-- Call Center: permisos de avisos y creación
INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
SELECT '20000000-0000-4000-8000-000000000002', p.id, '00000000-0000-4000-8000-000000000001'
FROM permiso p
WHERE p.codigo IN (
  'crear_incidente_manual',
  'incidentes:avisos:leer',
  'incidentes:avisos:verificar',
  'incidentes:avisos:descartar'
)
ON CONFLICT DO NOTHING;

-- Encargado: kanban y misiones
INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
SELECT '20000000-0000-4000-8000-000000000003', p.id, '00000000-0000-4000-8000-000000000001'
FROM permiso p
WHERE p.codigo IN (
  'incidentes:kanban',
  'misiones:asignar'
)
ON CONFLICT DO NOTHING;

-- 5. Standardizar Catálogo de Tipos de Incidente con UUIDs RFC4122 v4
UPDATE tipo_incidente SET id = 'a0000000-0000-4000-8000-000000000002' WHERE nombre = 'Caída de árbol';
UPDATE tipo_incidente SET id = 'a0000000-0000-4000-8000-000000000007' WHERE nombre = 'Otro';

INSERT INTO tipo_incidente (id, nombre, descripcion, activo)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Anegamiento', 'Acumulación de aguas lluvias en vías públicas o predios', true),
  ('a0000000-0000-4000-8000-000000000002', 'Caída de árbol', 'Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles', true),
  ('a0000000-0000-4000-8000-000000000003', 'Corte de energía', 'Interrupción del suministro eléctrico en sectores urbanos o rurales', true),
  ('a0000000-0000-4000-8000-000000000004', 'Deslizamiento', 'Movimiento de masa o tierra en laderas o cerros', true),
  ('a0000000-0000-4000-8000-000000000005', 'Daño estructural', 'Afectación grave o colapso parcial de viviendas o edificaciones', true),
  ('a0000000-0000-4000-8000-000000000006', 'Corte de agua potable', 'Interrupción del suministro de agua potable en la red comunal', true),
  ('a0000000-0000-4000-8000-000000000007', 'Otro', 'Cualquier otro incidente que requiera atención de emergencia municipal', true)
ON CONFLICT (id) DO UPDATE SET activo = true, nombre = EXCLUDED.nombre;

-- 6. Semillas en `usuarios` (H12) y `personal`
-- Usuarios administradores y operadores en tabla `usuarios`
INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  '00000000-0000-4000-8000-000000000001'::uuid, '11.111.111-1', 'Administrador', 'General', 'admin@valdivia.cl', '+56900000001', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2022-01-01'
FROM roles r, delegaciones d WHERE r.codigo = 'ADMIN' AND d.codigo = 'DEL_CALLE_CALLE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  '00000000-0000-4000-8000-000000000002'::uuid, '22.222.222-2', 'Operador', 'Call Center', 'callcenter@valdivia.cl', '+56900000002', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2023-01-01'
FROM roles r, delegaciones d WHERE r.codigo = 'CALL_CENTER' AND d.codigo = 'DEL_CALLE_CALLE'
ON CONFLICT (rut) DO NOTHING;

-- 10 Funcionarios y brigadistas en terreno
INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000001'::uuid, '12.345.678-9', 'Carlos', 'Valenzuela Díaz', 'carlos.valenzuela@valdivia.cl', '+56911223344', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-01-15'
FROM roles r, delegaciones d WHERE r.codigo = 'DELEGADO_CUADRILLA' AND d.codigo = 'DEL_NORTE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000001'::uuid, u.id, u.delegacion_id, 'Motosierrista', 'Jefe de Cuadrilla', 'disponible', true, 'Certificado en despeje de arbolado urbano'
FROM usuarios u WHERE u.rut = '12.345.678-9'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000002'::uuid, '14.567.890-1', 'Patricia', 'Morales Sepúlveda', 'patricia.morales@valdivia.cl', '+56922334455', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-02-01'
FROM roles r, delegaciones d WHERE r.codigo = 'PATRULLA_VERIFICADORA' AND d.codigo = 'DEL_NORTE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000002'::uuid, u.id, u.delegacion_id, 'Verificador', 'Patrullero Verificador', 'disponible', true, 'Manejo de equipo de evaluación rápida y dron'
FROM usuarios u WHERE u.rut = '14.567.890-1'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000003'::uuid, '15.678.901-2', 'Roberto', 'Araya Henríquez', 'roberto.araya@valdivia.cl', '+56933445566', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-03-10'
FROM roles r, delegaciones d WHERE r.codigo = 'BRIGADISTA' AND d.codigo = 'DEL_SUR'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000003'::uuid, u.id, u.delegacion_id, 'Operador de Bomba', 'Operador Técnico', 'disponible', true, 'Especialista en achique de aguas y motobombas'
FROM usuarios u WHERE u.rut = '15.678.901-2'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000004'::uuid, '16.789.012-3', 'Marcela', 'Castillo Fuentes', 'marcela.castillo@valdivia.cl', '+56944556677', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-01-20'
FROM roles r, delegaciones d WHERE r.codigo = 'ASISTENTE_SOCIAL' AND d.codigo = 'DEL_SUR'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000004'::uuid, u.id, u.delegacion_id, 'Asistente Social', 'Trabajador Social', 'disponible', true, 'Acreditada para aplicación de encuesta FIBE'
FROM usuarios u WHERE u.rut = '16.789.012-3'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000005'::uuid, '13.456.789-0', 'Jorge', 'Riquelme Alarcón', 'jorge.riquelme@valdivia.cl', '+56955667788', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2023-11-05'
FROM roles r, delegaciones d WHERE r.codigo = 'DELEGADO_CUADRILLA' AND d.codigo = 'DEL_COSTA'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000005'::uuid, u.id, u.delegacion_id, 'Conductor', 'Jefe de Cuadrilla', 'disponible', true, 'Licencia A4/A2 para vehículos de emergencia y camiones'
FROM usuarios u WHERE u.rut = '13.456.789-0'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000006'::uuid, '17.890.123-4', 'Francisca', 'Soto Vidal', 'francisca.soto@valdivia.cl', '+56966778899', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-04-12'
FROM roles r, delegaciones d WHERE r.codigo = 'BRIGADISTA' AND d.codigo = 'DEL_COSTA'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000006'::uuid, u.id, u.delegacion_id, 'Rescatista', 'Brigadista de Emergencia', 'disponible', true, 'Primeros auxilios y rescate en áreas aisladas'
FROM usuarios u WHERE u.rut = '17.890.123-4'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000007'::uuid, '18.901.234-5', 'Manuel', 'Cárdenas Oyarzún', 'manuel.cardenas@valdivia.cl', '+56977889900', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-02-18'
FROM roles r, delegaciones d WHERE r.codigo = 'PATRULLA_VERIFICADORA' AND d.codigo = 'DEL_CALLE_CALLE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000007'::uuid, u.id, u.delegacion_id, 'Verificador', 'Patrullero Verificador', 'disponible', true, 'Experiencia en evaluación de cauces y riberas'
FROM usuarios u WHERE u.rut = '18.901.234-5'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000008'::uuid, '19.012.345-6', 'Andrea', 'Poblete Lagos', 'andrea.poblete@valdivia.cl', '+56988990011', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2024-03-25'
FROM roles r, delegaciones d WHERE r.codigo = 'BRIGADISTA' AND d.codigo = 'DEL_CALLE_CALLE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000008'::uuid, u.id, u.delegacion_id, 'Cuadrillero', 'Brigadista de Emergencia', 'disponible', true, 'Cuadrillera de refuerzo en turnos rotativos'
FROM usuarios u WHERE u.rut = '19.012.345-6'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000009'::uuid, '11.234.567-8', 'Esteban', 'Delgado Paredes', 'esteban.delgado@valdivia.cl', '+56999001122', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2023-08-01'
FROM roles r, delegaciones d WHERE r.codigo = 'BRIGADISTA' AND d.codigo = 'DEL_NORTE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000009'::uuid, u.id, u.delegacion_id, 'Conductor', 'Operador Técnico', 'disponible', true, 'Conducción de retroexcavadora y maquinaria menor'
FROM usuarios u WHERE u.rut = '11.234.567-8'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO usuarios (id, rut, nombres, apellidos, email, telefono, password_hash, rol_id, delegacion_id, activo, fecha_ingreso)
SELECT 
  'e0000000-0000-4000-8000-000000000010'::uuid, '10.987.654-3', 'Lorena', 'Reyes Carrasco', 'lorena.reyes@valdivia.cl', '+56900112233', '$2b$10$hashedpasswordplaceholder', r.id, d.id, true, '2022-05-10'
FROM roles r, delegaciones d WHERE r.codigo = 'ENCARGADO' AND d.codigo = 'DEL_CALLE_CALLE'
ON CONFLICT (rut) DO NOTHING;

INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, estado_operativo, disponible_terreno, observaciones)
SELECT 
  'f0000000-0000-4000-8000-000000000010'::uuid, u.id, u.delegacion_id, 'Coordinación Operativa', 'Coordinador de Terreno', 'disponible', true, 'Supervisión directa de operaciones en delegación'
FROM usuarios u WHERE u.rut = '10.987.654-3'
ON CONFLICT (usuario_id) DO NOTHING;
