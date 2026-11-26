import { db } from "../src/lib/db";
import { sql } from "kysely";

export async function sembrarEstadosIncidentes() {
  console.log("Iniciando carga de incidentes y cuadrillas en todos los estados...");

  // 1. Obtener delegaciones
  const delegaciones = await db.selectFrom("delegacion").selectAll().execute();
  const delNorte = delegaciones.find((d) => d.codigo === "DEL_NORTE")?.id ?? delegaciones[0]?.id;
  const delSur = delegaciones.find((d) => d.codigo === "DEL_SUR")?.id ?? delegaciones[0]?.id;
  const delCosta = delegaciones.find((d) => d.codigo === "DEL_COSTA")?.id ?? delegaciones[0]?.id;
  const delCalleCalle = delegaciones.find((d) => d.codigo === "DEL_CALLE_CALLE")?.id ?? delegaciones[0]?.id;

  // 2. Obtener tipos de incidentes
  const tipos = await db.selectFrom("tipo_incidente").selectAll().execute();
  const tipoInundacion = tipos.find((t) => t.nombre.toLowerCase().includes("inundac"))?.id ?? tipos[0]?.id;
  const tipoArbol = tipos.find((t) => t.nombre.toLowerCase().includes("árbol") || t.nombre.toLowerCase().includes("arbol"))?.id ?? tipos[0]?.id;
  const tipoDeslizamiento = tipos.find((t) => t.nombre.toLowerCase().includes("deslizam"))?.id ?? tipos[0]?.id;
  const tipoAnegamiento = tipos.find((t) => t.nombre.toLowerCase().includes("anegam"))?.id ?? tipos[0]?.id;
  const tipoOtro = tipos.find((t) => t.nombre.toLowerCase().includes("otro"))?.id ?? tipos[0]?.id;

  // 3. Fuentes
  const fuentes = await db.selectFrom("fuente_incidente").selectAll().execute();
  const fuenteChatbot = fuentes.find((f) => f.nombre === "CHATBOT")?.id ?? fuentes[0]?.id;
  const fuenteLlamada = fuentes.find((f) => f.nombre === "LLAMADA_TELEFONICA")?.id ?? fuentes[0]?.id;
  const fuenteTerreno = fuentes.find((f) => f.nombre === "FUNCIONARIO_TERRENO")?.id ?? fuentes[0]?.id;

  // 4. Roles y Usuarios
  const rolDelegado = await db.selectFrom("rol").where("codigo", "=", "DELEGADO_CUADRILLA").selectAll().executeTakeFirst();
  const rolDelegadoId = rolDelegado?.id ?? "20000000-0000-4000-8000-000000000005";

  const rolBrigadista = await db.selectFrom("rol").where("codigo", "=", "BRIGADISTA").selectAll().executeTakeFirst();
  const rolBrigadistaId = rolBrigadista?.id ?? "20000000-0000-4000-8000-000000000009";

  const rolSupervisor = await db.selectFrom("rol").where("codigo", "=", "SUPERVISOR").selectAll().executeTakeFirst();
  const rolSupervisorId = rolSupervisor?.id ?? "20000000-0000-4000-8000-000000000010";

  const encargado = await db.selectFrom("usuario").where("email", "=", "encargado@valdivia.cl").selectAll().executeTakeFirst();
  const encargadoId = encargado?.id ?? "00000000-0000-4000-8000-000000000003";

  const admin = await db.selectFrom("usuario").where("email", "=", "admin@valdivia.cl").selectAll().executeTakeFirst();
  const adminId = admin?.id ?? "00000000-0000-4000-8000-000000000001";

  // Hash oficial de desarrollo 'Valdivia2026!'
  const HASH_VALDIVIA_2026 = "$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm";
  // 5. Asegurar usuarios Delegados de Cuadrilla y dotación de brigadistas
  await sql`
    INSERT INTO usuario (id, rut, nombres, apellidos, email, password_hash, rol_id, delegacion_id, activo, estado_operativo)
    VALUES
      (
        '00000000-0000-4000-8000-000000000005',
        '15.111.222-3',
        'Carlos',
        'Morales Delegado',
        'carlos.delegado@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delNorte},
        true,
        'disponible'
      ),
      (
        '00000000-0000-4000-8000-000000000006',
        '16.789.012-3',
        'Andrés',
        'Morales Ríos',
        'andres.morales@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delCosta},
        true,
        'disponible'
      ),
      (
        'd1e10000-0000-4000-8000-000000000010',
        '17.654.321-0',
        'Felipe',
        'Sandoval Cárdenas',
        'felipe.sandoval@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delSur},
        true,
        'disponible'
      ),
      (
        '00000000-0000-4000-8000-000000000011',
        '18.123.789-4',
        'Matías',
        'Oyarzún Vera',
        'matias.oyarzun@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delCalleCalle},
        true,
        'disponible'
      ),
      (
        'd1e10000-0000-4000-8000-000000000012',
        '19.101.112-3',
        'Diego',
        'Núñez Delegado',
        'diego.nunez.delegado@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delNorte},
        true,
        'disponible'
      ),
      (
        'd1e10000-0000-4000-8000-000000000013',
        '19.202.223-4',
        'Paula',
        'Rivas Delegado',
        'paula.rivas.delegado@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delNorte},
        true,
        'disponible'
      ),
      (
        'd1e10000-0000-4000-8000-000000000014',
        '19.303.334-5',
        'Tomás',
        'Vega Delegado',
        'tomas.vega.delegado@valdivia.cl',
        ${HASH_VALDIVIA_2026},
        ${rolDelegadoId},
        ${delCalleCalle},
        true,
        'disponible'
      ),
      -- Brigadistas de dotación para las cuadrillas EST
      ('d1e10000-0000-4000-8000-000000000101', '19.800.001-1', 'Brigadista', 'EST Norte Uno',   'brigadista.est1a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delNorte},      true, 'en_mision'),
      ('d1e10000-0000-4000-8000-000000000102', '19.800.002-2', 'Brigadista', 'EST Norte Dos',   'brigadista.est1b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delNorte},      true, 'en_mision'),
      ('d1e10000-0000-4000-8000-000000000201', '19.800.003-3', 'Brigadista', 'EST Norte Tres',  'brigadista.est2a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delNorte},      true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000202', '19.800.004-4', 'Brigadista', 'EST Norte Cuatro','brigadista.est2b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delNorte},      true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000301', '19.800.005-5', 'Brigadista', 'EST Sur Uno',     'brigadista.est3a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delSur},        true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000302', '19.800.006-6', 'Brigadista', 'EST Sur Dos',     'brigadista.est3b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delSur},        true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000401', '19.800.007-7', 'Brigadista', 'EST Calle Uno',   'brigadista.est4a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delCalleCalle}, true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000402', '19.800.008-8', 'Brigadista', 'EST Calle Dos',   'brigadista.est4b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delCalleCalle}, true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000501', '19.800.009-9', 'Brigadista', 'EST Costa Uno',   'brigadista.est5a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delCosta},      true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000502', '19.800.010-K', 'Brigadista', 'EST Costa Dos',   'brigadista.est5b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delCosta},      true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000601', '19.800.011-1', 'Brigadista', 'EST Norte Cinco', 'brigadista.est6a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delNorte},      true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000602', '19.800.012-2', 'Brigadista', 'EST Norte Seis',  'brigadista.est6b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delNorte},      true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000701', '19.800.013-3', 'Brigadista', 'EST Calle Tres',  'brigadista.est7a@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delCalleCalle}, true, 'disponible'),
      ('d1e10000-0000-4000-8000-000000000702', '19.800.014-4', 'Brigadista', 'EST Calle Cuatro','brigadista.est7b@valdivia.cl', ${HASH_VALDIVIA_2026}, ${rolBrigadistaId}, ${delCalleCalle}, true, 'disponible')
    ON CONFLICT (id) DO UPDATE SET
      nombres = EXCLUDED.nombres,
      apellidos = EXCLUDED.apellidos,
      email = EXCLUDED.email,
      rol_id = EXCLUDED.rol_id,
      delegacion_id = EXCLUDED.delegacion_id,
      activo = true,
      estado_operativo = EXCLUDED.estado_operativo;
  `.execute(db);

  // 5.1 Restaurar la cuenta del Supervisor, que versiones previas del seed
  // sobrescribían con el ID 00000000-0000-4000-8000-000000000010.
  await sql`
    INSERT INTO usuario (id, rut, nombres, apellidos, email, password_hash, rol_id, delegacion_id, activo, estado_operativo)
    VALUES (
      '00000000-0000-4000-8000-000000000010',
      '44444444-4',
      'Supervisor',
      'Estratégico',
      'supervisor@valdivia.cl',
      ${HASH_VALDIVIA_2026},
      ${rolSupervisorId},
      ${delNorte},
      true,
      'disponible'
    )
    ON CONFLICT (id) DO UPDATE SET
      rut = EXCLUDED.rut,
      nombres = EXCLUDED.nombres,
      apellidos = EXCLUDED.apellidos,
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      rol_id = EXCLUDED.rol_id,
      delegacion_id = EXCLUDED.delegacion_id,
      activo = true,
      estado_operativo = 'disponible';
  `.execute(db);

  // 5.2 Fichas de personal de delegados y brigadistas EST.
  await sql`
    INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, disponible_terreno)
    VALUES
      ('c1e10000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', ${delNorte},      'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', ${delCosta},      'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000010', 'd1e10000-0000-4000-8000-000000000010', ${delSur},        'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', ${delCalleCalle}, 'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000012', 'd1e10000-0000-4000-8000-000000000012', ${delNorte},      'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000013', 'd1e10000-0000-4000-8000-000000000013', ${delNorte},      'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000014', 'd1e10000-0000-4000-8000-000000000014', ${delCalleCalle}, 'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true),
      ('c1e10000-0000-4000-8000-000000000101', 'd1e10000-0000-4000-8000-000000000101', ${delNorte},      'Despeje, bombeo y mitigación', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000102', 'd1e10000-0000-4000-8000-000000000102', ${delNorte},      'Control de tránsito y perímetro', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000201', 'd1e10000-0000-4000-8000-000000000201', ${delNorte},      'Poda, tala y mitigación de riesgos', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000202', 'd1e10000-0000-4000-8000-000000000202', ${delNorte},      'Despeje, bombeo y mitigación', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000301', 'd1e10000-0000-4000-8000-000000000301', ${delSur},        'Operación de motobomba y achique', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000302', 'd1e10000-0000-4000-8000-000000000302', ${delSur},        'Control de tránsito y perímetro', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000401', 'd1e10000-0000-4000-8000-000000000401', ${delCalleCalle}, 'Poda, tala y mitigación de riesgos', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000402', 'd1e10000-0000-4000-8000-000000000402', ${delCalleCalle}, 'Despeje, bombeo y mitigación', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000501', 'd1e10000-0000-4000-8000-000000000501', ${delCosta},      'Operación de motobomba y achique', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000502', 'd1e10000-0000-4000-8000-000000000502', ${delCosta},      'Control de tránsito y perímetro', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000601', 'd1e10000-0000-4000-8000-000000000601', ${delNorte},      'Poda, tala y mitigación de riesgos', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000602', 'd1e10000-0000-4000-8000-000000000602', ${delNorte},      'Despeje, bombeo y mitigación', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000701', 'd1e10000-0000-4000-8000-000000000701', ${delCalleCalle}, 'Operación de motobomba y achique', 'Brigadista Operativo', true),
      ('c1e10000-0000-4000-8000-000000000702', 'd1e10000-0000-4000-8000-000000000702', ${delCalleCalle}, 'Control de tránsito y perímetro', 'Brigadista Operativo', true)
    ON CONFLICT (usuario_id) DO UPDATE SET
      delegacion_id = EXCLUDED.delegacion_id,
      especialidad = EXCLUDED.especialidad,
      cargo = EXCLUDED.cargo,
      disponible_terreno = true;
  `.execute(db);

  // 6. Informantes
  await sql`
    INSERT INTO informante (id, rut, nombre, telefono)
    VALUES
      ('b1000000-0000-4000-8000-000000000001', '12.345.678-5', 'Juan Pérez González', '+56991112233'),
      ('b1000000-0000-4000-8000-000000000002', '15.678.901-2', 'María Rodríguez Soto', '+56992223344'),
      ('b1000000-0000-4000-8000-000000000003', '18.901.234-K', 'Carlos Muñoz Silva', '+56993334455'),
      ('b1000000-0000-4000-8000-000000000004', '9.876.543-2', 'Ana Valenzuela Morales', '+56994445566')
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  // 7. Sembrar Cuadrillas Operativas con sus Delegados
  // Limpiar cuadrillas legacy de seeds anteriores que quedaron sin dotación
  // y que aparecían como DISPONIBLES vacías en la vista de cuadrillas.
  await sql`
    DELETE FROM cuadrilla_recurso
    WHERE cuadrilla_id IN (
      SELECT c.id FROM cuadrilla c
      WHERE c.id IN (
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000003',
        'c1000000-0000-4000-8000-000000000003',
        'c1000000-0000-4000-8000-000000000004',
        'c1000000-0000-4000-8000-000000000005'
      )
        AND NOT EXISTS (SELECT 1 FROM mision WHERE mision.cuadrilla_id = c.id)
    )
  `.execute(db);

  await sql`
    DELETE FROM cuadrilla_personal
    WHERE cuadrilla_id IN (
      SELECT c.id FROM cuadrilla c
      WHERE c.id IN (
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000003',
        'c1000000-0000-4000-8000-000000000003',
        'c1000000-0000-4000-8000-000000000004',
        'c1000000-0000-4000-8000-000000000005'
      )
        AND NOT EXISTS (SELECT 1 FROM mision WHERE mision.cuadrilla_id = c.id)
    )
  `.execute(db);

  await sql`
    DELETE FROM cuadrilla
    WHERE id IN (
      '50000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000003',
      'c1000000-0000-4000-8000-000000000003',
      'c1000000-0000-4000-8000-000000000004',
      'c1000000-0000-4000-8000-000000000005'
    )
      AND NOT EXISTS (SELECT 1 FROM mision WHERE mision.cuadrilla_id = cuadrilla.id)
  `.execute(db);

  await sql`
    INSERT INTO cuadrilla (id, nombre, estado, delegacion_id, usuario_delegado_id, creado_por_id, creado_en)
    VALUES
      -- Cuadrilla 1: En misión
      (
        'c1e10000-0000-4000-8000-000000000001',
        'Cuadrilla EST Aguas Lluvias Alfa',
        'EN_MISION',
        ${delNorte},
        '00000000-0000-4000-8000-000000000005',
        ${adminId},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      -- Cuadrilla 2: DISPONIBLE
      (
        'c1e10000-0000-4000-8000-000000000002',
        'Cuadrilla EST Vías y Despeje Urbano',
        'DISPONIBLE',
        ${delNorte},
        'd1e10000-0000-4000-8000-000000000012',
        ${adminId},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      -- Cuadrilla 3: DISPONIBLE
      (
        'c1e10000-0000-4000-8000-000000000003',
        'Cuadrilla EST Operativa Sur - Despeje y Bombeo',
        'DISPONIBLE',
        ${delSur},
        'd1e10000-0000-4000-8000-000000000010',
        ${adminId},
        CURRENT_TIMESTAMP - interval '2 days'
      ),
      -- Cuadrilla 4: DISPONIBLE
      (
        'c1e10000-0000-4000-8000-000000000004',
        'Cuadrilla EST Cuenca y Ribera Calle Calle',
        'DISPONIBLE',
        ${delCalleCalle},
        '00000000-0000-4000-8000-000000000011',
        ${adminId},
        CURRENT_TIMESTAMP - interval '1 day'
      ),
      -- Cuadrilla 5: DISPONIBLE
      (
        'c1e10000-0000-4000-8000-000000000005',
        'Cuadrilla EST Mitigación Costera Niebla',
        'DISPONIBLE',
        ${delCosta},
        '00000000-0000-4000-8000-000000000006',
        ${adminId},
        CURRENT_TIMESTAMP - interval '1 day'
      ),
      -- IDs de fallback compatibles con frontend
      (
        'c1e10000-0000-4000-8000-000000000006',
        'Cuadrilla EST Vías y Despeje Urbano Norte',
        'DISPONIBLE',
        ${delNorte},
        'd1e10000-0000-4000-8000-000000000013',
        ${adminId},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      (
        'c1e10000-0000-4000-8000-000000000007',
        'Cuadrilla EST Bombeo y Desagüe Calle Calle',
        'DISPONIBLE',
        ${delCalleCalle},
        'd1e10000-0000-4000-8000-000000000014',
        ${adminId},
        CURRENT_TIMESTAMP - interval '2 days'
      )
    ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      nombre = EXCLUDED.nombre,
      delegacion_id = EXCLUDED.delegacion_id,
      usuario_delegado_id = EXCLUDED.usuario_delegado_id,
      actualizado_por_id = EXCLUDED.creado_por_id,
      actualizado_en = CURRENT_TIMESTAMP,
      eliminado_en = NULL,
      activo = true;
  `.execute(db);

  // 7.1 Dotación humana de las cuadrillas EST
  await sql`
    INSERT INTO cuadrilla_personal (cuadrilla_id, personal_id, activo)
    VALUES
      ('c1e10000-0000-4000-8000-000000000001', 'c1e10000-0000-4000-8000-000000000101', true),
      ('c1e10000-0000-4000-8000-000000000001', 'c1e10000-0000-4000-8000-000000000102', true),
      ('c1e10000-0000-4000-8000-000000000002', 'c1e10000-0000-4000-8000-000000000201', true),
      ('c1e10000-0000-4000-8000-000000000002', 'c1e10000-0000-4000-8000-000000000202', true),
      ('c1e10000-0000-4000-8000-000000000003', 'c1e10000-0000-4000-8000-000000000301', true),
      ('c1e10000-0000-4000-8000-000000000003', 'c1e10000-0000-4000-8000-000000000302', true),
      ('c1e10000-0000-4000-8000-000000000004', 'c1e10000-0000-4000-8000-000000000401', true),
      ('c1e10000-0000-4000-8000-000000000004', 'c1e10000-0000-4000-8000-000000000402', true),
      ('c1e10000-0000-4000-8000-000000000005', 'c1e10000-0000-4000-8000-000000000501', true),
      ('c1e10000-0000-4000-8000-000000000005', 'c1e10000-0000-4000-8000-000000000502', true),
      ('c1e10000-0000-4000-8000-000000000006', 'c1e10000-0000-4000-8000-000000000601', true),
      ('c1e10000-0000-4000-8000-000000000006', 'c1e10000-0000-4000-8000-000000000602', true),
      ('c1e10000-0000-4000-8000-000000000007', 'c1e10000-0000-4000-8000-000000000701', true),
      ('c1e10000-0000-4000-8000-000000000007', 'c1e10000-0000-4000-8000-000000000702', true)
    ON CONFLICT (cuadrilla_id, personal_id) WHERE desvinculado_en IS NULL DO UPDATE SET
      activo = true;
  `.execute(db);

  // 7.2 Recursos y equipamiento de las cuadrillas EST
  await sql`
    INSERT INTO recurso (
      id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
      latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
    )
    VALUES
      ('e1e10000-0000-4000-8000-000000000001', 'Camioneta Cuadrilla EST Norte Alfa (Patente: EST-N1)', true, 'DISPONIBLE', 1, 0, 0, -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delNorte}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000002', 'Camioneta Cuadrilla EST Vías Norte (Patente: EST-N2)', true, 'DISPONIBLE', 1, 0, 0, -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delNorte}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000003', 'Camioneta Cuadrilla EST Sur (Patente: EST-S1)', true, 'DISPONIBLE', 1, 0, 0, -39.8310, -73.2289, ST_SetSRID(ST_MakePoint(-73.2289, -39.8310), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delSur}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000004', 'Camioneta Cuadrilla EST Calle Calle (Patente: EST-C1)', true, 'DISPONIBLE', 1, 0, 0, -39.8174, -73.2145, ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delCalleCalle}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000005', 'Camioneta Cuadrilla EST Costa (Patente: EST-CO1)', true, 'DISPONIBLE', 1, 0, 0, -39.8451, -73.2812, ST_SetSRID(ST_MakePoint(-73.2812, -39.8451), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delCosta}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000006', 'Camioneta Cuadrilla EST Norte Dos (Patente: EST-N3)', true, 'DISPONIBLE', 1, 0, 0, -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delNorte}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000007', 'Camioneta Cuadrilla EST Calle Calle Dos (Patente: EST-C2)', true, 'DISPONIBLE', 1, 0, 0, -39.8174, -73.2145, ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delCalleCalle}, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000008', 'Motosierras de despeje EST', false, 'DISPONIBLE', 14, 0, 2, -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326), 'Motosierras para despeje de vías y trozado de árboles', NULL, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000009', 'Motobombas EST', false, 'DISPONIBLE', 7, 0, 1, -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326), 'Motobombas para desagüe y achique', NULL, ${adminId}),
      ('e1e10000-0000-4000-8000-000000000010', 'Sacos de Arena EST', false, 'DISPONIBLE', 500, 0, 50, -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326), 'Sacos para contención fluvial y protección domiciliaria', NULL, ${adminId})
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      estado = EXCLUDED.estado,
      cantidad_inventario = EXCLUDED.cantidad_inventario,
      cantidad_en_uso = EXCLUDED.cantidad_en_uso,
      cantidad_minima = EXCLUDED.cantidad_minima,
      delegacion_id = EXCLUDED.delegacion_id;
  `.execute(db);

  await sql`
    INSERT INTO cuadrilla_recurso (id, cuadrilla_id, recurso_id, cantidad_asignada, activo)
    VALUES
      ('cd1e1000-0000-4000-8000-000000000001', 'c1e10000-0000-4000-8000-000000000001', 'e1e10000-0000-4000-8000-000000000001', 1, true),
      ('cd1e1000-0000-4000-8000-000000000002', 'c1e10000-0000-4000-8000-000000000001', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000003', 'c1e10000-0000-4000-8000-000000000001', 'e1e10000-0000-4000-8000-000000000009', 1, true),
      ('cd1e1000-0000-4000-8000-000000000004', 'c1e10000-0000-4000-8000-000000000001', 'e1e10000-0000-4000-8000-000000000010', 20, true),
      ('cd1e1000-0000-4000-8000-000000000005', 'c1e10000-0000-4000-8000-000000000002', 'e1e10000-0000-4000-8000-000000000002', 1, true),
      ('cd1e1000-0000-4000-8000-000000000006', 'c1e10000-0000-4000-8000-000000000002', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000007', 'c1e10000-0000-4000-8000-000000000002', 'e1e10000-0000-4000-8000-000000000010', 20, true),
      ('cd1e1000-0000-4000-8000-000000000008', 'c1e10000-0000-4000-8000-000000000003', 'e1e10000-0000-4000-8000-000000000003', 1, true),
      ('cd1e1000-0000-4000-8000-000000000009', 'c1e10000-0000-4000-8000-000000000003', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000010', 'c1e10000-0000-4000-8000-000000000003', 'e1e10000-0000-4000-8000-000000000009', 1, true),
      ('cd1e1000-0000-4000-8000-000000000011', 'c1e10000-0000-4000-8000-000000000003', 'e1e10000-0000-4000-8000-000000000010', 20, true),
      ('cd1e1000-0000-4000-8000-000000000012', 'c1e10000-0000-4000-8000-000000000004', 'e1e10000-0000-4000-8000-000000000004', 1, true),
      ('cd1e1000-0000-4000-8000-000000000013', 'c1e10000-0000-4000-8000-000000000004', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000014', 'c1e10000-0000-4000-8000-000000000004', 'e1e10000-0000-4000-8000-000000000010', 20, true),
      ('cd1e1000-0000-4000-8000-000000000015', 'c1e10000-0000-4000-8000-000000000005', 'e1e10000-0000-4000-8000-000000000005', 1, true),
      ('cd1e1000-0000-4000-8000-000000000016', 'c1e10000-0000-4000-8000-000000000005', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000017', 'c1e10000-0000-4000-8000-000000000005', 'e1e10000-0000-4000-8000-000000000009', 1, true),
      ('cd1e1000-0000-4000-8000-000000000018', 'c1e10000-0000-4000-8000-000000000005', 'e1e10000-0000-4000-8000-000000000010', 20, true),
      ('cd1e1000-0000-4000-8000-000000000019', 'c1e10000-0000-4000-8000-000000000006', 'e1e10000-0000-4000-8000-000000000006', 1, true),
      ('cd1e1000-0000-4000-8000-000000000020', 'c1e10000-0000-4000-8000-000000000006', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000021', 'c1e10000-0000-4000-8000-000000000006', 'e1e10000-0000-4000-8000-000000000010', 20, true),
      ('cd1e1000-0000-4000-8000-000000000022', 'c1e10000-0000-4000-8000-000000000007', 'e1e10000-0000-4000-8000-000000000007', 1, true),
      ('cd1e1000-0000-4000-8000-000000000023', 'c1e10000-0000-4000-8000-000000000007', 'e1e10000-0000-4000-8000-000000000008', 2, true),
      ('cd1e1000-0000-4000-8000-000000000024', 'c1e10000-0000-4000-8000-000000000007', 'e1e10000-0000-4000-8000-000000000009', 1, true),
      ('cd1e1000-0000-4000-8000-000000000025', 'c1e10000-0000-4000-8000-000000000007', 'e1e10000-0000-4000-8000-000000000010', 20, true)
    ON CONFLICT (id) DO UPDATE SET
      cantidad_asignada = EXCLUDED.cantidad_asignada,
      activo = true;
  `.execute(db);

  // 8. Asegurar Patrullas Verificadoras
  await sql`
    INSERT INTO patrulla_verificadora (
      id, codigo, nombre, estado, delegacion_id, vehiculo_id, activo,
      eliminado_en, creado_en, actualizado_en
    )
    VALUES
      (
        'f1000000-0000-4000-8000-000000000001',
        'PV-COSTA-01',
        'Patrulla Rápida Costa-1',
        'EN_VERIFICACION',
        ${delCosta},
        (SELECT id FROM recurso WHERE id = 'b1000000-0000-4000-8000-000000000003'::uuid),
        true,
        NULL,
        CURRENT_TIMESTAMP - interval '3 days',
        CURRENT_TIMESTAMP
      ),
      (
        'f1000000-0000-4000-8000-000000000002',
        'PV-CENTROSUR-01',
        'Patrulla Rápida Centro-Sur',
        'EN_VERIFICACION',
        ${delSur},
        (SELECT id FROM recurso WHERE id = 'b1000000-0000-4000-8000-000000000002'::uuid),
        true,
        NULL,
        CURRENT_TIMESTAMP - interval '3 days',
        CURRENT_TIMESTAMP
      ),
      (
        'f1000000-0000-4000-8000-000000000020',
        'PV-EST-020',
        'Patrulla Rápida Angachilla',
        'DISPONIBLE',
        ${delSur},
        NULL,
        true,
        NULL,
        CURRENT_TIMESTAMP - interval '3 days',
        CURRENT_TIMESTAMP
      ),
      (
        'f1000000-0000-4000-8000-000000000030',
        'PV-EST-030',
        'Patrulla Rápida Niebla-Costa',
        'DISPONIBLE',
        ${delCosta},
        NULL,
        true,
        NULL,
        CURRENT_TIMESTAMP - interval '3 days',
        CURRENT_TIMESTAMP
      ),
      (
        'f1000000-0000-4000-8000-000000000050',
        'PV-EST-050',
        'Patrulla Central Urbana - Isla Teja',
        'DISPONIBLE',
        ${delNorte},
        NULL,
        true,
        NULL,
        CURRENT_TIMESTAMP - interval '3 days',
        CURRENT_TIMESTAMP
      )
    ON CONFLICT (id) DO UPDATE SET
      codigo = COALESCE(patrulla_verificadora.codigo, EXCLUDED.codigo),
      estado = EXCLUDED.estado,
      nombre = EXCLUDED.nombre,
      delegacion_id = EXCLUDED.delegacion_id,
      activo = true,
      eliminado_en = NULL,
      actualizado_en = CURRENT_TIMESTAMP;
  `.execute(db);

  // 9. Limpiar misiones previas de los incidentes objetivo
  const incidentesIds = [
    'a1e10000-0000-4000-8000-000000000001',
    'a1e10000-0000-4000-8000-000000000002',
    'a1e10000-0000-4000-8000-000000000003',
    'a1e10000-0000-4000-8000-000000000013',
    'a1e10000-0000-4000-8000-000000000004',
    'a1e10000-0000-4000-8000-000000000006',
    'a1e10000-0000-4000-8000-000000000007',
  ];

  await sql`
    DELETE FROM mision_hito WHERE mision_id IN (
      SELECT id FROM mision WHERE incidente_id IN (${sql.join(incidentesIds)})
    );
  `.execute(db);

  await sql`
    DELETE FROM reporte_terreno WHERE mision_id IN (
      SELECT id FROM mision WHERE incidente_id IN (${sql.join(incidentesIds)})
    );
  `.execute(db);

  await sql`
    DELETE FROM mision WHERE incidente_id IN (${sql.join(incidentesIds)});
  `.execute(db);

  // 10. Sembrar Incidentes en TODOS los estados requeridos
  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, folio, informante_id, tipo_incidente_id, delegacion_id, fuente_incidente_id,
      tipo_afectacion, descripcion, direccion_texto, latitud, longitud, ubicacion,
      estado, prioridad, requiere_asistencia_social, fuente_origen, creado_por_id, encargado_id,
      creado_en, actualizado_en
    )
    VALUES
      -- 1. REPORTADO (Pendiente de Verificación, sin patrulla aún)
      (
        'a1e10000-0000-4000-8000-000000000001',
        'INC-EST-0001',
        '91000001',
        'FOL-EST-0001',
        'b1000000-0000-4000-8000-000000000001',
        ${tipoInundacion},
        ${delSur},
        ${fuenteChatbot},
        'Inundación',
        'Acumulación desmedida de aguas lluvias en vereda y calzada, amenazando con ingresar a antejardines',
        'Av. Ramón Picarte 1850, Sector Regional, Valdivia',
        -39.8245,
        -73.2356,
        ST_SetSRID(ST_MakePoint(-73.2356, -39.8245), 4326),
        'REPORTADO',
        'ALTA',
        false,
        'CHATBOT',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '15 minutes',
        CURRENT_TIMESTAMP - interval '15 minutes'
      ),
      -- 2. REPORTADO (Pendiente de Verificación, sin patrulla aún)
      (
        'a1e10000-0000-4000-8000-000000000002',
        'INC-EST-0002',
        '91000002',
        'FOL-EST-0002',
        'b1000000-0000-4000-8000-000000000002',
        ${tipoArbol},
        ${delCosta},
        ${fuenteLlamada},
        'Caída de árbol',
        'Rama gruesa desgajada de un roble sobre vereda, bloquea paso peatonal frente a plaza comunitaria',
        'Los Robles 420, Isla Teja, Valdivia',
        -39.8105,
        -73.2512,
        ST_SetSRID(ST_MakePoint(-73.2512, -39.8105), 4326),
        'REPORTADO',
        'MEDIA',
        false,
        'LLAMADA_TELEFONICA',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '30 minutes',
        CURRENT_TIMESTAMP - interval '30 minutes'
      ),
      -- 3. VERIFICANDO (SIN VERIFICAR AÚN / EN EVALUACIÓN DE TERRENO - Rechaza cuadrilla con 409)
      (
        'a1e10000-0000-4000-8000-000000000003',
        'INC-EST-0003',
        '91000003',
        'FOL-EST-0003',
        'b1000000-0000-4000-8000-000000000003',
        ${tipoDeslizamiento},
        ${delCosta},
        ${fuenteTerreno},
        'Deslizamiento de tierra',
        'Desprendimiento parcial de ladera de barro sobre berma del camino costero con riesgo de corte de ruta (Patrulla en terreno evaluando)',
        'Ruta T-350 Km 8, Camino a Niebla, Valdivia',
        -39.8590,
        -73.3750,
        ST_SetSRID(ST_MakePoint(-73.3750, -39.8590), 4326),
        'VERIFICANDO',
        'CRITICA',
        true,
        'FUNCIONARIO_TERRENO',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '45 minutes',
        CURRENT_TIMESTAMP - interval '20 minutes'
      ),
      -- 4. VERIFICANDO (VERIFICADO / CON REPORTE DE TERRENO - Listo para asignación de Cuadrilla HU-21)
      (
        'a1e10000-0000-4000-8000-000000000013',
        'INC-EST-0013',
        '91000013',
        'FOL-EST-0013',
        'b1000000-0000-4000-8000-000000000001',
        ${tipoAnegamiento},
        ${delSur},
        ${fuenteChatbot},
        'Anegamiento de calzada',
        'Anegamiento severo verificado por patrulla: sumideros colapsados requieren motobomba de alto caudal y cuadrilla táctica',
        'Av. Francia con San Jorge 450, Valdivia',
        -39.8362,
        -73.2351,
        ST_SetSRID(ST_MakePoint(-73.2351, -39.8362), 4326),
        'VERIFICANDO',
        'ALTA',
        false,
        'CHATBOT',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '50 minutes',
        CURRENT_TIMESTAMP - interval '10 minutes'
      ),
      -- 5. EN_ATENCION (Cuadrilla Despachada / Operando en Terreno)
      (
        'a1e10000-0000-4000-8000-000000000004',
        'INC-EST-0004',
        '91000004',
        'FOL-EST-0004',
        'b1000000-0000-4000-8000-000000000004',
        ${tipoAnegamiento},
        ${delNorte},
        ${fuenteChatbot},
        'Anegamiento de calzada',
        'Sumideros tapados por hojas y basura, calzada inundada frente a locales comerciales',
        'Av. Alemania 780, Sector Centro-Norte, Valdivia',
        -39.8170,
        -73.2420,
        ST_SetSRID(ST_MakePoint(-73.2420, -39.8170), 4326),
        'EN_ATENCION',
        'ALTA',
        false,
        'CHATBOT',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '2 hours',
        CURRENT_TIMESTAMP - interval '25 minutes'
      ),
      -- 6. RESUELTO (Operación Cerrada Exitosamente)
      (
        'a1e10000-0000-4000-8000-000000000006',
        'INC-EST-0006',
        '91000006',
        'FOL-EST-0006',
        'b1000000-0000-4000-8000-000000000001',
        ${tipoInundacion},
        ${delSur},
        ${fuenteChatbot},
        'Inundación',
        'Desobstrucción de colector principal y extracción de agua mediante motobomba, vía habilitada al 100%',
        'Av. Pedro Montt 1100, Valdivia',
        -39.8310,
        -73.2380,
        ST_SetSRID(ST_MakePoint(-73.2380, -39.8310), 4326),
        'RESUELTO',
        'MEDIA',
        false,
        'CHATBOT',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '5 hours',
        CURRENT_TIMESTAMP - interval '1 hour'
      ),
      -- 7. NO_ABORDABLE (Fuera de Ámbito Municipal / Derivado a Empresa Eléctrica)
      (
        'a1e10000-0000-4000-8000-000000000007',
        'INC-EST-0007',
        '91000007',
        'FOL-EST-0007',
        'b1000000-0000-4000-8000-000000000003',
        ${tipoOtro},
        ${delCosta},
        ${fuenteLlamada},
        'Otro',
        'Falla interna en empalme eléctrico particular de vivienda, derivado a cuadrilla técnica de SAESA',
        'Los Laureles 145, Isla Teja, Valdivia',
        -39.8120,
        -73.2500,
        ST_SetSRID(ST_MakePoint(-73.2500, -39.8120), 4326),
        'NO_ABORDABLE',
        'BAJA',
        false,
        'LLAMADA_TELEFONICA',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '6 hours',
        CURRENT_TIMESTAMP - interval '2 hours'
      )
    ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      prioridad = EXCLUDED.prioridad,
      descripcion = EXCLUDED.descripcion,
      tipo_afectacion = EXCLUDED.tipo_afectacion,
      direccion_texto = EXCLUDED.direccion_texto,
      latitud = EXCLUDED.latitud,
      longitud = EXCLUDED.longitud,
      ubicacion = EXCLUDED.ubicacion,
      actualizado_en = EXCLUDED.actualizado_en;
  `.execute(db);

  // 11. Misiones Tácticas
  // Misión 1: Verificación en curso para INC-EST-0003 (SIN reporte_terreno)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1e10000-0000-4000-8000-000000000001',
      'MIS-EST-0001',
      'Evaluación preliminar de derrumbe en ruta T-350',
      'Acudir en patrulla rápida, delimitar perímetro con conos y evaluar estabilidad del terreno',
      'VERIFICACION',
      'EN_CURSO',
      'CRITICA',
      'a1e10000-0000-4000-8000-000000000003',
      'f1000000-0000-4000-8000-000000000001',
      NULL,
      ${encargadoId},
      ${adminId},
      CURRENT_TIMESTAMP - interval '20 minutes',
      NULL,
      CURRENT_TIMESTAMP - interval '25 minutes'
    );
  `.execute(db);

  await sql`
    INSERT INTO mision_hito (
      id, mision_id, hito, descripcion, registrado_por_id, latitud, longitud, creado_en
    )
    VALUES (
      gen_random_uuid(),
      'd1e10000-0000-4000-8000-000000000001',
      'PATRULLA_EN_TRANSITO',
      'Patrulla Rápida Costa-1 en desplazamiento hacia el lugar de la contingencia',
      ${encargadoId},
      -39.8590,
      -73.3750,
      CURRENT_TIMESTAMP - interval '18 minutes'
    );
  `.execute(db);

  // Misión 2: Verificación para INC-EST-0013 (CON reporte_terreno emitido -> LISTO PARA CUADRILLA HU-21)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1e10000-0000-4000-8000-000000000005',
      'MIS-EST-0005',
      'Verificación técnica de anegamiento en Av. Francia',
      'Evaluar cota de agua, sumideros y riesgo a viviendas aledañas',
      'VERIFICACION',
      'COMPLETADA',
      'ALTA',
      'a1e10000-0000-4000-8000-000000000013',
      'f1000000-0000-4000-8000-000000000002',
      NULL,
      ${encargadoId},
      ${adminId},
      CURRENT_TIMESTAMP - interval '40 minutes',
      CURRENT_TIMESTAMP - interval '10 minutes',
      CURRENT_TIMESTAMP - interval '45 minutes'
    );
  `.execute(db);

  await sql`
    INSERT INTO reporte_terreno (
      id, mision_id, evaluador_id, resumen_tecnico, acciones_realizadas,
      requiere_apoyo_adicional, danos_estimados, observaciones, personas_afectadas,
      estado_terreno, version_reporte, es_rectificacion, prioridad_sugerida,
      prioridad_asignada, justificacion_prioridad, detalles_evaluacion,
      creado_en, actualizado_en
    )
    VALUES (
      'e1e10000-0000-4000-8000-000000000013',
      'd1e10000-0000-4000-8000-000000000005',
      ${encargadoId},
      'Evaluación técnica concluida: Anegamiento de 45 cm de altura sobre calzada por colapso de sumidero pluvial. Se constata riesgo inminente de anegamiento en tres viviendas particulares.',
      'Perímetro asegurado con conos y cinta reflectante. Tránsito peatonal desviado.',
      true,
      'Sin daños estructurales aún, posible daño a antejardines si el nivel sube 10 cm más.',
      'Se solicita despacho urgente de Cuadrilla con Motobomba de succión pesada.',
      8,
      'FINALIZADO',
      1,
      false,
      'ALTA',
      'ALTA',
      NULL,
      '{"nucleoFamiliarTotal": 8, "viviendasAfectadas": 3, "nivelCompromisoVivienda": "MODERADO", "requiereApoyoAdicional": true}'::jsonb,
      CURRENT_TIMESTAMP - interval '15 minutes',
      CURRENT_TIMESTAMP - interval '15 minutes'
    );
  `.execute(db);

  await sql`
    INSERT INTO mision_hito (
      id, mision_id, hito, descripcion, registrado_por_id, latitud, longitud, creado_en
    )
    VALUES (
      gen_random_uuid(),
      'd1e10000-0000-4000-8000-000000000005',
      'EVALUACION_COMPLETADA',
      'Reporte de terreno registrado. Patrulla confirma necesidad de escalamiento a cuadrilla operativa.',
      ${encargadoId},
      -39.8362,
      -73.2351,
      CURRENT_TIMESTAMP - interval '15 minutes'
    );
  `.execute(db);

  // Misión 3: Cuadrilla operando en INC-EST-0004 (EN_ATENCION)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1e10000-0000-4000-8000-000000000002',
      'MIS-EST-0002',
      'Desagüe y limpieza de sumideros en Av. Alemania',
      'Instalación de motobomba de 4 pulgadas y sacos de contención',
      'ATENCION_CUADRILLA',
      'EN_CURSO',
      'ALTA',
      'a1e10000-0000-4000-8000-000000000004',
      NULL,
      'c1e10000-0000-4000-8000-000000000001',
      ${encargadoId},
      ${adminId},
      CURRENT_TIMESTAMP - interval '1 hour',
      NULL,
      CURRENT_TIMESTAMP - interval '1 hour 15 minutes'
    );
  `.execute(db);

  // Misión 4: Misión completada para INC-EST-0006 (RESUELTO)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1e10000-0000-4000-8000-000000000004',
      'MIS-EST-0004',
      'Mitigación y succión en Av. Pedro Montt',
      'Trabajos finalizados con éxito, escurrimiento normalizado',
      'ATENCION_CUADRILLA',
      'COMPLETADA',
      'MEDIA',
      'a1e10000-0000-4000-8000-000000000006',
      NULL,
      'c1e10000-0000-4000-8000-000000000001',
      ${encargadoId},
      ${adminId},
      CURRENT_TIMESTAMP - interval '4 hours',
      CURRENT_TIMESTAMP - interval '1 hour',
      CURRENT_TIMESTAMP - interval '4 hours 30 minutes'
    );
  `.execute(db);

  console.log("¡Carga de incidentes y cuadrillas operativas completada con éxito!");
}

if (process.argv[1]?.includes("seed-estados-incidentes")) {
  sembrarEstadosIncidentes()
    .then(async () => {
      await db.destroy();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Error al sembrar incidentes y cuadrillas:", err);
      await db.destroy();
      process.exit(1);
    });
}
