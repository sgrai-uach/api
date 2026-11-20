/**
 * Fixture de datos QA para HU-75 — Cerrar Operativo de Recuperación.
 *
 * Siembra de forma idempotente:
 *   - Un operativo en estado `EN_EJECUCION` con misión `EN_CURSO`, patrulla `EN_RECUPERACION`
 *     y dos recursos a granel descontados listos para probar reintegro de remanentes.
 *   - Un operativo `PLANIFICADA` y otro `COMPLETADA` para probar respuestas `409 Conflict`.
 *   - El permiso RBAC `recuperacion:cerrar` asignado a ADMIN y ENCARGADO.
 *
 * Uso:
 *   npm run seed:h75            # Siembra o actualiza el fixture (idempotente)
 *   npm run seed:h75 -- --clean # Limpia únicamente los datos de este fixture
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";

const IDS = {
  usuarioEncargado: "00000000-0000-4000-8000-000000000003",
  delegacionCosta: "30000000-0000-4000-8000-000000000003",
  recursos: {
    kitsEmergencia: "75000000-0000-4000-8000-000000000001",
    frazadas: "75000000-0000-4000-8000-000000000002",
  },
  patrullas: {
    enRecuperacion: "75500000-0000-4000-8000-000000000001",
  },
  operativos: {
    enEjecucion: "75100000-0000-4000-8000-000000000001",
    planificada: "75100000-0000-4000-8000-000000000002",
    completada: "75100000-0000-4000-8000-000000000003",
  },
  misiones: {
    enCurso: "75200000-0000-4000-8000-000000000001",
    despachada: "75200000-0000-4000-8000-000000000002",
  },
};

export async function limpiarFixtureH75() {
  console.log("Limpiando fixture H75 (cierre de operativos de recuperación)...");

  const recIds = Object.values(IDS.operativos);
  const misIds = Object.values(IDS.misiones);
  const recuIds = Object.values(IDS.recursos);
  const patIds = Object.values(IDS.patrullas);

  await sql`DELETE FROM mision_hito WHERE mision_id IN (${sql.join(misIds.map((id) => sql`${id}`))})`.execute(db);
  await sql`DELETE FROM mision WHERE id IN (${sql.join(misIds.map((id) => sql`${id}`))})`.execute(db);
  await sql`DELETE FROM recuperacion_recurso WHERE recuperacion_id IN (${sql.join(recIds.map((id) => sql`${id}`))})`.execute(db);
  await sql`DELETE FROM recuperacion WHERE id IN (${sql.join(recIds.map((id) => sql`${id}`))})`.execute(db);
  await sql`DELETE FROM patrulla_verificadora WHERE id IN (${sql.join(patIds.map((id) => sql`${id}`))})`.execute(db);
  await sql`DELETE FROM recurso WHERE id IN (${sql.join(recuIds.map((id) => sql`${id}`))})`.execute(db);

  console.log("Limpieza de fixture H75 completada.");
}

export async function sembrarFixtureH75() {
  await limpiarFixtureH75();
  console.log("Sembrando fixture H75 en la base de datos...");

  await sql`
    INSERT INTO recurso (
      id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
      latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
    ) VALUES
    (
      ${IDS.recursos.kitsEmergencia},
      'Kits de Emergencia Familiar (H75)',
      false, 'DISPONIBLE', 40, 0, 10,
      -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
      'Kits de emergencia básica para entrega en terreno',
      ${IDS.delegacionCosta}, ${IDS.usuarioEncargado}
    ),
    (
      ${IDS.recursos.frazadas},
      'Frazadas Térmicas (H75)',
      false, 'BAJO_STOCK', 8, 0, 10,
      -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
      'Frazadas térmicas para familias damnificadas',
      ${IDS.delegacionCosta}, ${IDS.usuarioEncargado}
    );
  `.execute(db);

  await sql`
    INSERT INTO patrulla_verificadora (
      id, nombre, codigo, estado, delegacion_id, creado_por_id, activo
    ) VALUES (
      ${IDS.patrullas.enRecuperacion},
      'Patrulla Recuperación H75-Alfa',
      'PAT-H75-01',
      'EN_RECUPERACION',
      ${IDS.delegacionCosta},
      ${IDS.usuarioEncargado},
      true
    );
  `.execute(db);

  await sql`
    INSERT INTO recuperacion (
      id, codigo, nombre, descripcion, sector, direccion_texto, prioridad,
      latitud, longitud, ubicacion, estado, familias_afectadas, delegacion_id, creado_por_id
    ) VALUES
    (
      ${IDS.operativos.enEjecucion},
      'REC-2026-7501',
      'Entrega de Kits y Frazadas Niebla (H75)',
      'Operativo en ejecución listo para declarar concluido y reintegrar remanentes.',
      'Niebla',
      'Camino Real 450',
      'ALTA',
      -39.8685, -73.3958, ST_SetSRID(ST_MakePoint(-73.3958, -39.8685), 4326),
      'EN_EJECUCION', 12, ${IDS.delegacionCosta}, ${IDS.usuarioEncargado}
    ),
    (
      ${IDS.operativos.planificada},
      'REC-2026-7502',
      'Operativo Planificado Prueba 409 (H75)',
      'Operativo aún en planificación (no cerrable).',
      'Los Molinos',
      'Sector Playa',
      'MEDIA',
      -39.8490, -73.3980, ST_SetSRID(ST_MakePoint(-73.3980, -39.8490), 4326),
      'PLANIFICADA', 4, ${IDS.delegacionCosta}, ${IDS.usuarioEncargado}
    ),
    (
      ${IDS.operativos.completada},
      'REC-2026-7503',
      'Operativo ya Completado Prueba 409 (H75)',
      'Operativo ya concluido para verificar idempotencia 409.',
      'Curiñanco',
      'Ruta T-340 Km 12',
      'BAJA',
      -39.7320, -73.4010, ST_SetSRID(ST_MakePoint(-73.4010, -39.7320), 4326),
      'COMPLETADA', 2, ${IDS.delegacionCosta}, ${IDS.usuarioEncargado}
    );
  `.execute(db);

  await sql`
    INSERT INTO recuperacion_recurso (recuperacion_id, recurso_id, cantidad_asignada) VALUES
    (${IDS.operativos.enEjecucion}, ${IDS.recursos.kitsEmergencia}, 10),
    (${IDS.operativos.enEjecucion}, ${IDS.recursos.frazadas}, 12);
  `.execute(db);

  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      patrulla_id, recuperacion_id, encargado_id, creado_por_id, fecha_inicio
    ) VALUES
    (
      ${IDS.misiones.enCurso},
      'MIS-2026-7501',
      'Despliegue Recuperación Niebla H75',
      'Entrega en curso en Niebla.',
      'RECUPERACION', 'EN_CURSO', 'ALTA',
      ${IDS.patrullas.enRecuperacion}, ${IDS.operativos.enEjecucion},
      ${IDS.usuarioEncargado}, ${IDS.usuarioEncargado}, NOW()
    ),
    (
      ${IDS.misiones.despachada},
      'MIS-2026-7502',
      'Despliegue Planificado H75',
      'Misión planificada de prueba.',
      'RECUPERACION', 'DESPACHADA', 'MEDIA',
      NULL, ${IDS.operativos.planificada},
      ${IDS.usuarioEncargado}, ${IDS.usuarioEncargado}, NOW()
    );
  `.execute(db);

  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000081';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:cerrar';

      IF v_permiso_id IS NULL THEN
        INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
        VALUES (
          v_target_id,
          'recuperacion:cerrar',
          'Cerrar Operativo de Recuperación',
          'Permite decretar la conclusión formal de un operativo de recuperación en ejecución, reintegrar remanentes y liberar patrullas',
          'Eventos ATP'
        )
        ON CONFLICT (codigo) DO NOTHING
        RETURNING id INTO v_permiso_id;

        IF v_permiso_id IS NULL THEN
          SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:cerrar';
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM rol WHERE id = v_admin_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id)
        VALUES (v_admin_rol_id, v_permiso_id)
        ON CONFLICT (rol_id, permiso_id) DO NOTHING;
      END IF;

      IF EXISTS (SELECT 1 FROM rol WHERE id = v_encargado_rol_id) THEN
        INSERT INTO rol_permiso (rol_id, permiso_id)
        VALUES (v_encargado_rol_id, v_permiso_id)
        ON CONFLICT (rol_id, permiso_id) DO NOTHING;
      END IF;
    END $$;
  `.execute(db);

  console.log("Fixture H75 sembrado exitosamente.");
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--clean")) {
      await limpiarFixtureH75();
    } else {
      await sembrarFixtureH75();
    }
    process.exit(0);
  } catch (error) {
    console.error("Error al ejecutar fixture H75:", error);
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.includes("seed-h75")) {
  main();
}
