/**
 * Fixture de datos QA para HU-73 — Listar y Visualizar Operativos de Recuperación Post-Desastre.
 *
 * Objetivo:
 *   Poblar la base de datos con un conjunto diverso de operativos de recuperación en Valdivia
 *   para permitir probar y tomar capturas de pantalla reales en `sgrai-web`:
 *   - Tabla en `/gestion/centro-incidentes` (pestaña Recuperación).
 *   - Todos los estados posibles: PLANIFICADA, EN_EJECUCION, COMPLETADA, CANCELADA.
 *   - Distribución territorial en las 4 delegaciones (Costa, Norte, Sur, Calle-Calle).
 *   - Distintas prioridades (BAJA, MEDIA, ALTA, CRITICA).
 *   - Asignación de insumos/recursos con cantidades y desglose.
 *   - Misiones tácticas asociadas e hitos cronológicos para el drawer de detalle.
 *
 * Uso:
 *   npm run seed:h73            # Siembra o actualiza el fixture (idempotente)
 *   npm run seed:h73 -- --clean # Limpia únicamente los datos de este fixture
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";

const IDS = {
  usuarioEncargado: "00000000-0000-4000-8000-000000000003", // encargado@valdivia.cl
  delegaciones: {
    norte: "30000000-0000-4000-8000-000000000001",
    sur: "30000000-0000-4000-8000-000000000002",
    costa: "30000000-0000-4000-8000-000000000003",
    calleCalle: "30000000-0000-4000-8000-000000000004",
  },
  recursos: {
    planchasZinc: "73000000-0000-4000-8000-000000000001",
    cajasAlimentos: "73000000-0000-4000-8000-000000000002",
    frazadas: "73000000-0000-4000-8000-000000000003",
    sacosFluviales: "73000000-0000-4000-8000-000000000004",
    motosierras: "73000000-0000-4000-8000-000000000005",
    kitHerramientas: "73000000-0000-4000-8000-000000000006",
  },
  patrullaCosta: "f1000000-0000-4000-8000-000000000030",
  patrullaNorte: "f1000000-0000-4000-8000-000000000010",
  operativos: {
    rec1: "73100000-0000-4000-8000-000000000001",
    rec2: "73100000-0000-4000-8000-000000000002",
    rec3: "73100000-0000-4000-8000-000000000003",
    rec4: "73100000-0000-4000-8000-000000000004",
    rec5: "73100000-0000-4000-8000-000000000005",
    rec6: "73100000-0000-4000-8000-000000000006",
  },
  misiones: {
    mis1: "73200000-0000-4000-8000-000000000001",
    mis2: "73200000-0000-4000-8000-000000000002",
    mis4: "73200000-0000-4000-8000-000000000004",
  },
  hitos: {
    hito1_1: "73300000-0000-4000-8000-000000000001",
    hito1_2: "73300000-0000-4000-8000-000000000002",
    hito2_1: "73300000-0000-4000-8000-000000000003",
    hito2_2: "73300000-0000-4000-8000-000000000004",
  },
  reportes: {
    rep1: "73400000-0000-4000-8000-000000000001",
  },
};

export async function limpiarFixtureH73(executor: any = db) {
  console.log("Limpiando fixture H73 (operativos de recuperación de prueba)...");

  const recIds = Object.values(IDS.operativos);
  const recCodigos = [
    'REC-2026-0011',
    'REC-2026-0012',
    'REC-2026-0013',
    'REC-2026-0014',
    'REC-2026-0015',
    'REC-2026-0016',
  ];
  const misIds = Object.values(IDS.misiones);
  const recuIds = Object.values(IDS.recursos);

  // Eliminar hitos y reportes vinculados a las misiones del fixture
  await sql`DELETE FROM mision_hito WHERE mision_id IN (${sql.join(misIds.map((id) => sql`${id}`))})`.execute(executor);
  await sql`DELETE FROM reporte_terreno WHERE mision_id IN (${sql.join(misIds.map((id) => sql`${id}`))})`.execute(executor);
  await sql`DELETE FROM mision WHERE id IN (${sql.join(misIds.map((id) => sql`${id}`))})`.execute(executor);

  // Eliminar asignación de recursos a recuperación del fixture
  await sql`
    DELETE FROM recuperacion_recurso 
    WHERE recuperacion_id IN (${sql.join(recIds.map((id) => sql`${id}`))})
       OR recuperacion_id IN (SELECT id FROM recuperacion WHERE codigo IN (${sql.join(recCodigos.map((c) => sql`${c}`))}))
  `.execute(executor);

  // Eliminar operativos del fixture (por id o por código)
  await sql`
    DELETE FROM recuperacion 
    WHERE id IN (${sql.join(recIds.map((id) => sql`${id}`))})
       OR codigo IN (${sql.join(recCodigos.map((c) => sql`${c}`))})
  `.execute(executor);

  // Eliminar recursos del fixture
  await sql`DELETE FROM recurso WHERE id IN (${sql.join(recuIds.map((id) => sql`${id}`))})`.execute(executor);

  console.log("Limpieza de fixture H73 completada.");
}

export async function sembrarFixtureH73() {
  await db.transaction().execute(async (trx) => {
    await limpiarFixtureH73(trx);
    console.log("Sembrando fixture H73 en la base de datos dentro de transacción...");

    // Verificar existencia de patrullas para salvaguardar restricción FK mision_patrulla_id_fkey (BUG-H73-API-06)
    const patrullasExistentes = await sql<{ id: string }>`
      SELECT id FROM patrulla_verificadora WHERE id IN (${IDS.patrullaCosta}, ${IDS.patrullaNorte})
    `.execute(trx);
    const idsPatrullas = new Set(patrullasExistentes.rows.map((r) => r.id));

    let patrullaCostaFinal: string | null = idsPatrullas.has(IDS.patrullaCosta) ? IDS.patrullaCosta : null;
    let patrullaNorteFinal: string | null = idsPatrullas.has(IDS.patrullaNorte) ? IDS.patrullaNorte : null;

    if (!patrullaCostaFinal || !patrullaNorteFinal) {
      const fallbackPatrullas = await sql<{ id: string }>`SELECT id FROM patrulla_verificadora LIMIT 2`.execute(trx);
      if (!patrullaCostaFinal && fallbackPatrullas.rows[0]) {
        patrullaCostaFinal = fallbackPatrullas.rows[0].id;
      }
      if (!patrullaNorteFinal && fallbackPatrullas.rows[1]) {
        patrullaNorteFinal = fallbackPatrullas.rows[1].id;
      }
    }

    // 1. Recursos e Insumos
    await sql`
      INSERT INTO recurso (
        id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
        latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
      ) VALUES
      (
        ${IDS.recursos.planchasZinc},
        'Planchas de Zinc Acanaladas 3.66m',
        false, 'DISPONIBLE', 500, 110, 50,
        -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Planchas de zinc galvanizado para reparación de techumbres post-temporal',
        ${IDS.delegaciones.costa}, ${IDS.usuarioEncargado}
      ),
      (
        ${IDS.recursos.cajasAlimentos},
        'Cajas de Alimentos de Emergencia Familiar',
        false, 'DISPONIBLE', 300, 45, 30,
        -39.8310, -73.2289, ST_SetSRID(ST_MakePoint(-73.2289, -39.8310), 4326),
        'Canasta familiar de contingencia con víveres no perecibles para 4 personas',
        ${IDS.delegaciones.sur}, ${IDS.usuarioEncargado}
      ),
      (
        ${IDS.recursos.frazadas},
        'Frazadas Térmicas y Ropa de Cama Polar',
        false, 'DISPONIBLE', 400, 80, 40,
        -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Frazadas de alta densidad para abrigo inmediato en viviendas anegadas',
        ${IDS.delegaciones.costa}, ${IDS.usuarioEncargado}
      ),
      (
        ${IDS.recursos.sacosFluviales},
        'Sacos Fluviales de Arena para Contención',
        false, 'DISPONIBLE', 1000, 250, 100,
        -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
        'Sacos de geotextil rellenos con arena gruesa para barreras perimetrales',
        ${IDS.delegaciones.calleCalle}, ${IDS.usuarioEncargado}
      ),
      (
        ${IDS.recursos.motosierras},
        'Motosierras de Despeje Stihl MS 382',
        true, 'DISPONIBLE', 8, 4, 2,
        -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
        'Equipos a combustión para corte de ramas y trozado de árboles caídos',
        ${IDS.delegaciones.norte}, ${IDS.usuarioEncargado}
      ),
      (
        ${IDS.recursos.kitHerramientas},
        'Kits de Carretillas y Palas de Despeje',
        false, 'DISPONIBLE', 50, 18, 10,
        -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
        'Juegos de herramientas manuales para remoción comunal de lodo y escombros',
        ${IDS.delegaciones.norte}, ${IDS.usuarioEncargado}
      );
    `.execute(trx);

    // 2. Operativos de Recuperación
    await sql`
      INSERT INTO recuperacion (
        id, codigo, nombre, descripcion, sector, direccion_texto, prioridad,
        contacto_nombre, contacto_telefono, latitud, longitud, ubicacion,
        estado, familias_afectadas, delegacion_id, creado_por_id,
        creado_en, actualizado_en, fecha_cierre, observaciones_cierre
      ) VALUES
      (
        ${IDS.operativos.rec1},
        'REC-2026-0011',
        'Entrega de techumbres y materiales de habitabilidad',
        'Despliegue de entrega de planchas de zinc y frazadas a viviendas con voladura de techos por temporal costero.',
        'Sector Niebla Alto',
        'Calle Miramar #450, Niebla',
        'ALTA',
        'Mariana Cárdenas (Pdta. JJVV Niebla)',
        '+56987654321',
        -39.8682, -73.3965, ST_SetSRID(ST_MakePoint(-73.3965, -39.8682), 4326),
        'EN_EJECUCION',
        18,
        ${IDS.delegaciones.costa},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '30 minutes',
        NULL, NULL
      ),
      (
        ${IDS.operativos.rec2},
        'REC-2026-0012',
        'Despeje de ramas y rehabilitación de callejones vecinales',
        'Operativo de trozado de ramas caídas y despeje de accesos peatonales para vecinos aislados.',
        'Villa Las Américas - Las Ánimas',
        'Pasaje Los Ciruelos s/n',
        'MEDIA',
        'Carlos Gómez',
        '+56976543210',
        -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
        'COMPLETADA',
        35,
        ${IDS.delegaciones.norte},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '4 hours',
        NOW() - INTERVAL '4 hours',
        'Operativo finalizado satisfactoriamente. Accesos despejados y escombros retirados por cuadrilla municipal.'
      ),
      (
        ${IDS.operativos.rec3},
        'REC-2026-0013',
        'Distribución de víveres y kits de calefacción en campamento',
        'Entrega de cajas de alimentos de emergencia y ropa de abrigo a familias afectadas por anegamiento.',
        'Campamento Los Jazmines, Angachilla',
        'Acceso Sur Poniente s/n',
        'CRITICA',
        'Rosa Alarcón',
        '+56965432109',
        -39.8310, -73.2289, ST_SetSRID(ST_MakePoint(-73.2289, -39.8310), 4326),
        'PLANIFICADA',
        42,
        ${IDS.delegaciones.sur},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '1 hour',
        NULL, NULL
      ),
      (
        ${IDS.operativos.rec4},
        'REC-2026-0014',
        'Instalación de barreras y sacos fluviales en ribera',
        'Refuerzo de bordes fluviales para evitar desbordes menores hacia predios colindantes.',
        'Ribera Río Calle Calle - Collico',
        'Av. Balmaceda altura #1200',
        'ALTA',
        'Jorge Soto',
        '+56954321098',
        -39.8150, -73.2100, ST_SetSRID(ST_MakePoint(-73.2100, -39.8150), 4326),
        'EN_EJECUCION',
        12,
        ${IDS.delegaciones.calleCalle},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '5 hours',
        NOW() - INTERVAL '1 hour',
        NULL, NULL
      ),
      (
        ${IDS.operativos.rec5},
        'REC-2026-0015',
        'Operativo de apoyo con polietileno y carbón',
        'Distribución inicial planificada para familias del borde costero interior.',
        'Los Molinos interior',
        'Camino a San Ignacio km 2',
        'BAJA',
        'Claudio Vera',
        '+56943210987',
        -39.8550, -73.3850, ST_SetSRID(ST_MakePoint(-73.3850, -39.8550), 4326),
        'CANCELADA',
        5,
        ${IDS.delegaciones.costa},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '12 hours',
        NOW() - INTERVAL '12 hours',
        'Operativo cancelado. La junta de vecinos coordinó ayuda con fondos autogestionados y no requiere insumos municipales.'
      ),
      (
        ${IDS.operativos.rec6},
        'REC-2026-0016',
        'Rehabilitación de techumbres en pasaje Los Coigües',
        'Reposición de planchas y caballetes en 8 viviendas tras fuertes ráfagas de viento.',
        'Sector Corvi',
        'Pasaje Los Coigües #234',
        'MEDIA',
        'Gladys Muñoz',
        '+56932109876',
        -39.8220, -73.2350, ST_SetSRID(ST_MakePoint(-73.2350, -39.8220), 4326),
        'COMPLETADA',
        8,
        ${IDS.delegaciones.calleCalle},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day',
        'Trabajos de fijación de techumbres concluidos.'
      );
    `.execute(trx);

    // 3. Asignación de Recursos a Operativos
    await sql`
      INSERT INTO recuperacion_recurso (id, recuperacion_id, recurso_id, cantidad_asignada)
      VALUES
        (gen_random_uuid(), ${IDS.operativos.rec1}, ${IDS.recursos.planchasZinc}, 80),
        (gen_random_uuid(), ${IDS.operativos.rec1}, ${IDS.recursos.frazadas}, 20),
        (gen_random_uuid(), ${IDS.operativos.rec2}, ${IDS.recursos.motosierras}, 4),
        (gen_random_uuid(), ${IDS.operativos.rec2}, ${IDS.recursos.kitHerramientas}, 10),
        (gen_random_uuid(), ${IDS.operativos.rec3}, ${IDS.recursos.cajasAlimentos}, 45),
        (gen_random_uuid(), ${IDS.operativos.rec3}, ${IDS.recursos.frazadas}, 60),
        (gen_random_uuid(), ${IDS.operativos.rec4}, ${IDS.recursos.sacosFluviales}, 250),
        (gen_random_uuid(), ${IDS.operativos.rec4}, ${IDS.recursos.kitHerramientas}, 8),
        (gen_random_uuid(), ${IDS.operativos.rec6}, ${IDS.recursos.planchasZinc}, 30);
    `.execute(trx);

    // 4. Misiones Tácticas de Recuperación (para detalle y drawer)
    await sql`
      INSERT INTO mision (
        id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
        recuperacion_id, patrulla_id, creado_por_id, fecha_inicio, creado_en
      ) VALUES
      (
        ${IDS.misiones.mis1},
        'MIS-2026-0073-1',
        'Despliegue operativo Niebla Alto',
        'Entrega directa de insumos a familias catastradas',
        'RECUPERACION',
        'EN_CURSO',
        'ALTA',
        ${IDS.operativos.rec1},
        ${patrullaCostaFinal},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '3 hours'
      ),
      (
        ${IDS.misiones.mis2},
        'MIS-2026-0073-2',
        'Operativo de corte y despeje Las Ánimas',
        'Despeje y retiro de ramas de gran tamaño',
        'RECUPERACION',
        'COMPLETADA',
        'MEDIA',
        ${IDS.operativos.rec2},
        ${patrullaNorteFinal},
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '2 days'
      ),
      (
        ${IDS.misiones.mis4},
        'MIS-2026-0073-4',
        'Instalación de barreras Collico',
        'Colocación de sacos de arena en ribera Calle Calle',
        'RECUPERACION',
        'EN_CURSO',
        'ALTA',
        ${IDS.operativos.rec4},
        NULL,
        ${IDS.usuarioEncargado},
        NOW() - INTERVAL '4 hours',
        NOW() - INTERVAL '5 hours'
      );
    `.execute(trx);

    // 5. Hitos de Misión y Reportes de Terreno (para historial cronológico del drawer)
    await sql`
      INSERT INTO mision_hito (id, mision_id, hito, descripcion, creado_en, registrado_por_id)
      VALUES
        (
          ${IDS.hitos.hito1_1},
          ${IDS.misiones.mis1},
          'SALIDA_BASE',
          'Patrulla inicia traslado con camión de carga hacia Niebla',
          NOW() - INTERVAL '2 hours',
          ${IDS.usuarioEncargado}
        ),
        (
          ${IDS.hitos.hito1_2},
          ${IDS.misiones.mis1},
          'ARRIBO_SECTOR',
          'Llegada al punto de encuentro en JJVV Niebla Alto e inicio de descarga',
          NOW() - INTERVAL '1 hour',
          ${IDS.usuarioEncargado}
        ),
        (
          ${IDS.hitos.hito2_1},
          ${IDS.misiones.mis2},
          'INICIO_TRABAJOS',
          'Inicio de trozado de ramas con motosierra en pasaje Los Ciruelos',
          NOW() - INTERVAL '30 hours',
          ${IDS.usuarioEncargado}
        ),
        (
          ${IDS.hitos.hito2_2},
          ${IDS.misiones.mis2},
          'FIN_TRABAJOS',
          'Término de despeje y entrega de área a vecinos',
          NOW() - INTERVAL '4 hours',
          ${IDS.usuarioEncargado}
        );
    `.execute(trx);

    await sql`
      INSERT INTO reporte_terreno (id, mision_id, evaluador_id, resumen_tecnico, acciones_realizadas, creado_en)
      VALUES
        (
          ${IDS.reportes.rep1},
          ${IDS.misiones.mis1},
          ${IDS.usuarioEncargado},
          'Avance de distribución de techumbres y frazadas',
          'Se entregaron 60 planchas de zinc y 20 frazadas a las primeras 12 familias. Restan 6 familias por recibir apoyo en la tarde.',
          NOW() - INTERVAL '45 minutes'
        );
    `.execute(trx);

    console.log("Fixture H73 sembrado exitosamente dentro de transacción.");
  });
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--clean")) {
      await db.transaction().execute(async (trx) => {
        await limpiarFixtureH73(trx);
      });
    } else {
      await sembrarFixtureH73();
    }
    process.exit(0);
  } catch (error) {
    console.error("Error al ejecutar fixture H73:", error);
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.includes("seed-h73")) {
  main();
}
