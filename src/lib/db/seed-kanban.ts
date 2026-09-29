import { db } from "./index";
import { sql } from "kysely";

export async function sembrarDatosKanban() {
  console.log("Iniciando inserción de datos de prueba para el Tablero Kanban...");

  // 1. Obtener IDs de delegaciones maestras
  const delegaciones = await db.selectFrom("delegacion").selectAll().execute();
  const delNorte = delegaciones.find((d) => d.nombre === "Norte")?.id;
  const delSur = delegaciones.find((d) => d.nombre === "Sur")?.id;
  const delCosta = delegaciones.find((d) => d.nombre === "Costa")?.id;
  const delCalleCalle = delegaciones.find((d) => d.nombre === "Calle Calle")?.id;

  // 2. Obtener IDs de tipos de incidente
  const tipos = await db.selectFrom("tipo_incidente").selectAll().execute();
  const tipoInundacion = tipos.find((t) => t.nombre === "Inundación")?.id;
  const tipoArbol = tipos.find((t) => t.nombre === "Caída de árbol")?.id;
  const tipoDeslizamiento = tipos.find((t) => t.nombre === "Deslizamiento de tierra")?.id;
  const tipoAnegamiento = tipos.find((t) => t.nombre === "Anegamiento de calzada")?.id;
  const tipoOtro = tipos.find((t) => t.nombre === "Otro")?.id;

  // 3. Obtener IDs de fuentes
  const fuentes = await db.selectFrom("fuente_incidente").selectAll().execute();
  const fuenteChatbot = fuentes.find((f) => f.nombre === "CHATBOT")?.id;
  const fuenteLlamada = fuentes.find((f) => f.nombre === "LLAMADA_TELEFONICA")?.id;
  const fuenteTerreno = fuentes.find((f) => f.nombre === "FUNCIONARIO_TERRENO")?.id;

  // 4. Usuario Administrador y Encargado
  const usuarioAdmin = await db
    .selectFrom("usuario")
    .where("email", "=", "admin@valdivia.cl")
    .selectAll()
    .executeTakeFirst();
  const adminId = usuarioAdmin?.id ?? "00000000-0000-0000-0000-000000000001";

  const usuarioEncargado = await db
    .selectFrom("usuario")
    .where("email", "=", "encargado@valdivia.cl")
    .selectAll()
    .executeTakeFirst();
  const encargadoId = usuarioEncargado?.id ?? "00000000-0000-4000-8000-000000000003";

  // 5. Informantes Ciudadanos
  await sql`
    INSERT INTO informante (id, rut, nombre, telefono)
    VALUES
      ('b1000000-0000-4000-8000-000000000001', '12.345.678-5', 'Juan Pérez González', '+56991112233'),
      ('b1000000-0000-4000-8000-000000000002', '15.678.901-2', 'María Rodríguez Soto', '+56992223344'),
      ('b1000000-0000-4000-8000-000000000003', '18.901.234-K', 'Carlos Muñoz Silva', '+56993334455'),
      ('b1000000-0000-4000-8000-000000000004', '9.876.543-2', 'Ana Valenzuela Morales', '+56994445566'),
      ('b1000000-0000-4000-8000-000000000005', '14.567.890-1', 'Roberto Gómez Castro', '+56995556677')
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  // 6. Inventario Logístico de Recursos
  await sql`
    INSERT INTO recurso (
      id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
      latitud, longitud, ubicacion, descripcion, creado_por_id
    )
    VALUES
      (
        'e1000000-0000-4000-8000-000000000001',
        'Motobomba Caudal 4"',
        true,
        'DISPONIBLE',
        3,
        1,
        1,
        -39.8142,
        -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Motobomba diésel de alta succión para anegamientos urbanos',
        ${adminId}
      ),
      (
        'e1000000-0000-4000-8000-000000000002',
        'Camioneta 4x4 Cuadrilla Navara (Patente: CD-FG-23)',
        true,
        'DISPONIBLE',
        4,
        2,
        1,
        -39.8142,
        -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Vehículo de tracción para traslado de cuadrillas y equipos pesados',
        ${adminId}
      ),
      (
        'e1000000-0000-4000-8000-000000000003',
        'Motosierra Stihl MS 382 Profesional',
        true,
        'DISPONIBLE',
        6,
        2,
        2,
        -39.8142,
        -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Herramienta de poda y trozado de árboles caídos en calzadas',
        ${adminId}
      ),
      (
        'e1000000-0000-4000-8000-000000000004',
        'Sacos de Arena de Contención Fluvial',
        false,
        'DISPONIBLE',
        250,
        50,
        50,
        -39.8142,
        -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Sacos para diques provisionales de desborde y protección domiciliaria',
        ${adminId}
      )
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  // 7. Equipos Operativos: Patrullas Verificadoras y Cuadrillas
  await sql`
    INSERT INTO patrulla_verificadora (id, nombre, estado, delegacion_id, usuario_lider_id)
    VALUES
      ('f1000000-0000-4000-8000-000000000001', 'Patrulla Rápida Costa-1', 'EN_VERIFICACION', ${delCosta ?? null}, ${encargadoId}),
      ('f1000000-0000-4000-8000-000000000002', 'Patrulla Rápida Centro-Sur', 'DISPONIBLE', ${delSur ?? null}, ${encargadoId})
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  await sql`
    INSERT INTO cuadrilla (id, nombre, estado, delegacion_id, usuario_delegado_id)
    VALUES
      ('c1000000-0000-4000-8000-000000000001', 'Cuadrilla Aguas Lluvias Alfa', 'EN_MISION', ${delSur ?? null}, ${encargadoId}),
      ('c1000000-0000-4000-8000-000000000002', 'Cuadrilla Vías y Despeje Urbano', 'EN_MISION', ${delNorte ?? null}, ${encargadoId})
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  // 8. Asignación de Recursos a Cuadrillas
  await sql`
    INSERT INTO cuadrilla_recurso (id, cuadrilla_id, recurso_id, cantidad_asignada)
    VALUES
      ('cd100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1),
      ('cd100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 1),
      ('cd100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', 2),
      ('cd100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000004', 50)
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  // 9. Incidentes de Prueba (Cubriendo todos los estados del Tablero Kanban)
  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, informante_id, tipo_incidente_id, delegacion_id, fuente_incidente_id,
      tipo_afectacion, descripcion, direccion_texto, latitud, longitud, ubicacion,
      estado, prioridad, requiere_asistencia_social, fuente_origen, creado_por_id, encargado_id,
      creado_en, actualizado_en
    )
    VALUES
      -- 1. REPORTADO (Pendiente de Verificación)
      (
        'a1000000-0000-4000-8000-000000000001',
        'INC-2026-0001',
        '10000001',
        'b1000000-0000-4000-8000-000000000001',
        ${tipoInundacion ?? null},
        ${delSur ?? null},
        ${fuenteChatbot ?? null},
        'Inundación',
        'Acumulación desmedida de aguas lluvias en vereda y calzada, amenazando con ingresar a antejardines',
        'Av. Ramón Picarte 1850, Sector Regional, Valdivia',
        -39.8245000,
        -73.2356000,
        ST_SetSRID(ST_MakePoint(-73.2356000, -39.8245000), 4326),
        'REPORTADO',
        'ALTA',
        false,
        'CHATBOT',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '15 minutes',
        CURRENT_TIMESTAMP - interval '15 minutes'
      ),
      -- 2. REPORTADO (Pendiente de Verificación)
      (
        'a1000000-0000-4000-8000-000000000002',
        'INC-2026-0002',
        '10000002',
        'b1000000-0000-4000-8000-000000000002',
        ${tipoArbol ?? null},
        ${delCosta ?? null},
        ${fuenteLlamada ?? null},
        'Caída de árbol',
        'Rama gruesa desgajada de un roble sobre vereda, bloquea paso peatonal frente a plaza comunitaria',
        'Los Robles 420, Isla Teja, Valdivia',
        -39.8105000,
        -73.2512000,
        ST_SetSRID(ST_MakePoint(-73.2512000, -39.8105000), 4326),
        'REPORTADO',
        'MEDIA',
        false,
        'LLAMADA_TELEFONICA',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '30 minutes',
        CURRENT_TIMESTAMP - interval '30 minutes'
      ),
      -- 3. VERIFICANDO (Patrulla Despachada / Evaluando en Terreno)
      (
        'a1000000-0000-4000-8000-000000000003',
        'INC-2026-0003',
        '10000003',
        'b1000000-0000-4000-8000-000000000003',
        ${tipoDeslizamiento ?? null},
        ${delCosta ?? null},
        ${fuenteTerreno ?? null},
        'Deslizamiento de tierra',
        'Desprendimiento parcial de ladera de barro sobre berma del camino costero con riesgo de corte de ruta',
        'Ruta T-350 Km 8, Camino a Niebla, Valdivia',
        -39.8590000,
        -73.3750000,
        ST_SetSRID(ST_MakePoint(-73.3750000, -39.8590000), 4326),
        'VERIFICANDO',
        'CRITICA',
        true,
        'FUNCIONARIO_TERRENO',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '45 minutes',
        CURRENT_TIMESTAMP - interval '20 minutes'
      ),
      -- 4. EN_ATENCION (Cuadrilla Operando en Terreno)
      (
        'a1000000-0000-4000-8000-000000000004',
        'INC-2026-0004',
        '10000004',
        'b1000000-0000-4000-8000-000000000004',
        ${tipoAnegamiento ?? null},
        ${delNorte ?? null},
        ${fuenteChatbot ?? null},
        'Anegamiento de calzada',
        'Sumideros tapados por hojas y basura, calzada inundada frente a terminal y locales comerciales',
        'Av. Alemania 780, Sector Centro-Norte, Valdivia',
        -39.8170000,
        -73.2420000,
        ST_SetSRID(ST_MakePoint(-73.2420000, -39.8170000), 4326),
        'EN_ATENCION',
        'ALTA',
        false,
        'CHATBOT',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '2 hours',
        CURRENT_TIMESTAMP - interval '25 minutes'
      ),
      -- 5. EN_ATENCION (Emergencia con Asistencia Social / Cuadrilla y Motosierras)
      (
        'a1000000-0000-4000-8000-000000000005',
        'INC-2026-0005',
        '10000005',
        'b1000000-0000-4000-8000-000000000005',
        ${tipoArbol ?? null},
        ${delCalleCalle ?? null},
        ${fuenteLlamada ?? null},
        'Caída de árbol',
        'Árbol añoso colapsó sobre techumbre de vivienda social, familia afectada requiere ficha FIBE urgente',
        'Calle Los Pelúes 230, Sector Collico, Valdivia',
        -39.8080000,
        -73.2250000,
        ST_SetSRID(ST_MakePoint(-73.2250000, -39.8080000), 4326),
        'EN_ATENCION',
        'CRITICA',
        true,
        'LLAMADA_TELEFONICA',
        ${adminId},
        ${encargadoId},
        CURRENT_TIMESTAMP - interval '3 hours',
        CURRENT_TIMESTAMP - interval '40 minutes'
      ),
      -- 6. RESUELTO (Operación Cerrada Exitosamente)
      (
        'a1000000-0000-4000-8000-000000000006',
        'INC-2026-0006',
        '10000006',
        'b1000000-0000-4000-8000-000000000001',
        ${tipoInundacion ?? null},
        ${delSur ?? null},
        ${fuenteChatbot ?? null},
        'Inundación',
        'Desobstrucción de colector principal y extracción de agua mediante motobomba, vía habilitada al 100%',
        'Av. Pedro Montt 1100, Valdivia',
        -39.8310000,
        -73.2380000,
        ST_SetSRID(ST_MakePoint(-73.2380000, -39.8310000), 4326),
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
        'b1000000-0000-4000-8000-000000000003',
        ${tipoOtro ?? null},
        ${delCosta ?? null},
        ${fuenteLlamada ?? null},
        'Otro',
        'Falla interna en empalme eléctrico particular de vivienda, derivado a cuadrilla técnica de SAESA',
        'Los Laureles 145, Isla Teja, Valdivia',
        -39.8120000,
        -73.2500000,
        ST_SetSRID(ST_MakePoint(-73.2500000, -39.8120000), 4326),
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
      tipo_incidente_id = EXCLUDED.tipo_incidente_id,
      delegacion_id = EXCLUDED.delegacion_id,
      fuente_incidente_id = EXCLUDED.fuente_incidente_id,
      actualizado_en = EXCLUDED.actualizado_en;
  `.execute(db);

  // 10. Misiones Tácticas Asociadas
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en
    )
    VALUES
      -- Misión de verificación para incidente 3
      (
        'd1000000-0000-4000-8000-000000000001',
        'MIS-2026-0001',
        'Evaluación preliminar de riesgo de derrumbe en ruta T-350',
        'Acudir en patrulla rápida, delimitar perímetro con conos y evaluar estabilidad del terreno',
        'VERIFICACION',
        'EN_CURSO',
        'CRITICA',
        'a1000000-0000-4000-8000-000000000003',
        'f1000000-0000-4000-8000-000000000001',
        NULL,
        ${encargadoId},
        ${adminId},
        CURRENT_TIMESTAMP - interval '25 minutes',
        NULL,
        CURRENT_TIMESTAMP - interval '30 minutes'
      ),
      -- Misión de desagüe con motobomba para incidente 4
      (
        'd1000000-0000-4000-8000-000000000002',
        'MIS-2026-0002',
        'Desagüe y limpieza de sumideros en Av. Alemania',
        'Instalación de motobomba de 4 pulgadas y sacos de contención para evitar ingreso a comercios',
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
      ),
      -- Misión de trozado de árbol para incidente 5
      (
        'd1000000-0000-4000-8000-000000000003',
        'MIS-2026-0003',
        'Trozado y despeje de ramas sobre vivienda en Collico',
        'Corte con motosierras, aseguramiento de perímetro y apoyo para rescate de enseres',
        'ATENCION_CUADRILLA',
        'EN_CURSO',
        'CRITICA',
        'a1000000-0000-4000-8000-000000000005',
        NULL,
        'c1000000-0000-4000-8000-000000000002',
        ${encargadoId},
        ${adminId},
        CURRENT_TIMESTAMP - interval '2 hours',
        NULL,
        CURRENT_TIMESTAMP - interval '2 hours 15 minutes'
      ),
      -- Misión completada para incidente 6
      (
        'd1000000-0000-4000-8000-000000000004',
        'MIS-2026-0004',
        'Mitigación y succión en Av. Pedro Montt',
        'Trabajos finalizados con éxito, escurrimiento normalizado y retiro de escombros',
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
      )
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  console.log("¡Datos de prueba para el Tablero Kanban sembrados exitosamente!");
}

if (process.argv[1]?.includes("seed-kanban")) {
  sembrarDatosKanban()
    .then(async () => {
      await db.destroy();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Error al sembrar datos:", err);
      await db.destroy();
      process.exit(1);
    });
}
