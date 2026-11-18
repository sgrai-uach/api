import { db } from "../src/lib/db";
import { sql } from "kysely";

export async function sembrarEstadosIncidentes() {
  console.log("Iniciando carga de incidentes y cuadrillas en todos los estados...");

  // 1. Obtener delegaciones
  const delegaciones = await db.selectFrom("delegacion").selectAll().execute();
  const delNorte = delegaciones.find((d) => d.nombre === "Norte")?.id ?? delegaciones[0]?.id;
  const delSur = delegaciones.find((d) => d.nombre === "Sur")?.id ?? delegaciones[0]?.id;
  const delCosta = delegaciones.find((d) => d.nombre === "Costa")?.id ?? delegaciones[0]?.id;
  const delCalleCalle = delegaciones.find((d) => d.nombre === "Calle Calle")?.id ?? delegaciones[0]?.id;

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

  const encargado = await db.selectFrom("usuario").where("email", "=", "encargado@valdivia.cl").selectAll().executeTakeFirst();
  const encargadoId = encargado?.id ?? "00000000-0000-4000-8000-000000000003";

  const admin = await db.selectFrom("usuario").where("email", "=", "admin@valdivia.cl").selectAll().executeTakeFirst();
  const adminId = admin?.id ?? "00000000-0000-4000-8000-000000000001";

  // Hash oficial de desarrollo 'Valdivia2026!'
  const HASH_VALDIVIA_2026 = "$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm";
  // 5. Asegurar usuarios Delegados de Cuadrilla
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
        '00000000-0000-4000-8000-000000000010',
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
      )
    ON CONFLICT (id) DO UPDATE SET
      nombres = EXCLUDED.nombres,
      apellidos = EXCLUDED.apellidos,
      rol_id = EXCLUDED.rol_id,
      delegacion_id = EXCLUDED.delegacion_id,
      activo = true,
      estado_operativo = 'disponible';
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
  await sql`
    INSERT INTO cuadrilla (id, nombre, estado, delegacion_id, usuario_delegado_id, creado_por_id, creado_en)
    VALUES
      -- Cuadrilla 1: En misión
      (
        'c1000000-0000-4000-8000-000000000001',
        'Cuadrilla Aguas Lluvias Alfa',
        'EN_MISION',
        ${delNorte},
        '00000000-0000-4000-8000-000000000005',
        ${adminId},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      -- Cuadrilla 2: DISPONIBLE
      (
        'c1000000-0000-4000-8000-000000000002',
        'Cuadrilla Vías y Despeje Urbano',
        'DISPONIBLE',
        ${delNorte},
        '00000000-0000-4000-8000-000000000005',
        ${adminId},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      -- Cuadrilla 3: DISPONIBLE
      (
        'c1000000-0000-4000-8000-000000000003',
        'Cuadrilla Operativa Sur - Despeje y Bombeo',
        'DISPONIBLE',
        ${delSur},
        '00000000-0000-4000-8000-000000000010',
        ${adminId},
        CURRENT_TIMESTAMP - interval '2 days'
      ),
      -- Cuadrilla 4: DISPONIBLE
      (
        'c1000000-0000-4000-8000-000000000004',
        'Cuadrilla Cuenca y Ribera Calle Calle',
        'DISPONIBLE',
        ${delCalleCalle},
        '00000000-0000-4000-8000-000000000011',
        ${adminId},
        CURRENT_TIMESTAMP - interval '1 day'
      ),
      -- Cuadrilla 5: DISPONIBLE
      (
        'c1000000-0000-4000-8000-000000000005',
        'Cuadrilla Mitigación Costera Niebla',
        'DISPONIBLE',
        ${delCosta},
        '00000000-0000-4000-8000-000000000006',
        ${adminId},
        CURRENT_TIMESTAMP - interval '1 day'
      ),
      -- IDs de fallback compatibles con frontend
      (
        '50000000-0000-4000-8000-000000000001',
        'Cuadrilla Vías y Despeje Urbano Norte',
        'DISPONIBLE',
        ${delNorte},
        '00000000-0000-4000-8000-000000000005',
        ${adminId},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      (
        '50000000-0000-4000-8000-000000000003',
        'Cuadrilla Bombeo y Desagüe Calle Calle',
        'DISPONIBLE',
        ${delCalleCalle},
        '00000000-0000-4000-8000-000000000011',
        ${adminId},
        CURRENT_TIMESTAMP - interval '2 days'
      )
    ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      nombre = EXCLUDED.nombre,
      delegacion_id = EXCLUDED.delegacion_id,
      usuario_delegado_id = EXCLUDED.usuario_delegado_id,
      eliminado_en = NULL;
  `.execute(db);

  // 8. Asegurar Patrullas Verificadoras
  await sql`
    INSERT INTO patrulla_verificadora (id, nombre, estado, delegacion_id, creado_en)
    VALUES
      (
        'f1000000-0000-4000-8000-000000000001',
        'Patrulla Rápida Costa-1',
        'EN_VERIFICACION',
        ${delCosta},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      (
        'f1000000-0000-4000-8000-000000000002',
        'Patrulla Rápida Centro-Sur',
        'EN_VERIFICACION',
        ${delSur},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      (
        'f1000000-0000-4000-8000-000000000020',
        'Patrulla Rápida Angachilla',
        'DISPONIBLE',
        ${delSur},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      (
        'f1000000-0000-4000-8000-000000000030',
        'Patrulla Rápida Niebla-Costa',
        'DISPONIBLE',
        ${delCosta},
        CURRENT_TIMESTAMP - interval '3 days'
      ),
      (
        'f1000000-0000-4000-8000-000000000050',
        'Patrulla Central Urbana - Isla Teja',
        'DISPONIBLE',
        ${delNorte},
        CURRENT_TIMESTAMP - interval '3 days'
      )
    ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      nombre = EXCLUDED.nombre;
  `.execute(db);

  // 9. Limpiar misiones previas de los incidentes objetivo
  const incidentesIds = [
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000013',
    'a1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000007',
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
        'a1000000-0000-4000-8000-000000000001',
        'INC-2026-0001',
        '10000001',
        'FOL-0001',
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
        'a1000000-0000-4000-8000-000000000002',
        'INC-2026-0002',
        '10000002',
        'FOL-0002',
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
        'a1000000-0000-4000-8000-000000000003',
        'INC-2026-0003',
        '10000003',
        'FOL-0003',
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
        'a1000000-0000-4000-8000-000000000013',
        'INC-2026-0013',
        '10000013',
        'FOL-0013',
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
        'a1000000-0000-4000-8000-000000000004',
        'INC-2026-0004',
        '10000004',
        'FOL-0004',
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
        'a1000000-0000-4000-8000-000000000006',
        'INC-2026-0006',
        '10000006',
        'FOL-0006',
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
        'a1000000-0000-4000-8000-000000000007',
        'INC-2026-0007',
        '10000007',
        'FOL-0007',
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
  // Misión 1: Verificación en curso para INC-2026-0003 (SIN reporte_terreno)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1000000-0000-4000-8000-000000000001',
      'MIS-2026-0001',
      'Evaluación preliminar de derrumbe en ruta T-350',
      'Acudir en patrulla rápida, delimitar perímetro con conos y evaluar estabilidad del terreno',
      'VERIFICACION',
      'EN_CURSO',
      'CRITICA',
      'a1000000-0000-4000-8000-000000000003',
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
      'd1000000-0000-4000-8000-000000000001',
      'PATRULLA_EN_TRANSITO',
      'Patrulla Rápida Costa-1 en desplazamiento hacia el lugar de la contingencia',
      ${encargadoId},
      -39.8590,
      -73.3750,
      CURRENT_TIMESTAMP - interval '18 minutes'
    );
  `.execute(db);

  // Misión 2: Verificación para INC-2026-0013 (CON reporte_terreno emitido -> LISTO PARA CUADRILLA HU-21)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1000000-0000-4000-8000-000000000005',
      'MIS-2026-0005',
      'Verificación técnica de anegamiento en Av. Francia',
      'Evaluar cota de agua, sumideros y riesgo a viviendas aledañas',
      'VERIFICACION',
      'COMPLETADA',
      'ALTA',
      'a1000000-0000-4000-8000-000000000013',
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
      estado_terreno, creado_en, actualizado_en
    )
    VALUES (
      'e1000000-0000-4000-8000-000000000013',
      'd1000000-0000-4000-8000-000000000005',
      ${encargadoId},
      'Evaluación técnica concluida: Anegamiento de 45 cm de altura sobre calzada por colapso de sumidero pluvial. Se constata riesgo inminente de anegamiento en tres viviendas particulares.',
      'Perímetro asegurado con conos y cinta reflectante. Tránsito peatonal desviado.',
      true,
      'Sin daños estructurales aún, posible daño a antejardines si el nivel sube 10 cm más.',
      'Se solicita despacho urgente de Cuadrilla con Motobomba de succión pesada.',
      8,
      'FINALIZADO',
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
      'd1000000-0000-4000-8000-000000000005',
      'EVALUACION_COMPLETADA',
      'Reporte de terreno registrado. Patrulla confirma necesidad de escalamiento a cuadrilla operativa.',
      ${encargadoId},
      -39.8362,
      -73.2351,
      CURRENT_TIMESTAMP - interval '15 minutes'
    );
  `.execute(db);

  // Misión 3: Cuadrilla operando en INC-2026-0004 (EN_ATENCION)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1000000-0000-4000-8000-000000000002',
      'MIS-2026-0002',
      'Desagüe y limpieza de sumideros en Av. Alemania',
      'Instalación de motobomba de 4 pulgadas y sacos de contención',
      'ATENCION_CUADRILLA',
      'EN_CURSO',
      'ALTA',
      'a1000000-0000-4000-8000-000000000004',
      NULL,
      'c1000000-0000-4000-8000-000000000001',
      ${encargadoId},
      ${adminId},
      CURRENT_TIMESTAMP - interval '1 hour',
      NULL,
      CURRENT_TIMESTAMP - interval '1 hour 15 minutes'
    );
  `.execute(db);

  // Misión 4: Misión completada para INC-2026-0006 (RESUELTO)
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES (
      'd1000000-0000-4000-8000-000000000004',
      'MIS-2026-0004',
      'Mitigación y succión en Av. Pedro Montt',
      'Trabajos finalizados con éxito, escurrimiento normalizado',
      'ATENCION_CUADRILLA',
      'COMPLETADA',
      'MEDIA',
      'a1000000-0000-4000-8000-000000000006',
      NULL,
      'c1000000-0000-4000-8000-000000000001',
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
