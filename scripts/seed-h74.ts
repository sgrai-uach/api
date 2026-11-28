/**
 * Fixture de datos QA para HU-74 — Editar Planificación de Operativos de Recuperación.
 *
 * Basado en el fixture de H73 y adaptado al esquema de `feature/H74-editar-operativo-recuperacion`
 * (incluyendo `fecha_estimada_fin` y patrullas disponibles para probar reasignación).
 *
 * Uso:
 *   npm run seed:h74            # Siembra o actualiza el fixture (idempotente)
 *   npm run seed:h74 -- --clean # Limpia únicamente los datos de este fixture
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";

const IDS = {
  usuarioEncargado: "00000000-0000-4000-8000-000000000003",
  delegaciones: {
    norte: "30000000-0000-4000-8000-000000000001",
    sur: "30000000-0000-4000-8000-000000000002",
    costa: "30000000-0000-4000-8000-000000000003",
    calleCalle: "30000000-0000-4000-8000-000000000004",
  },
  recursos: {
    planchasZinc: "74000000-0000-4000-8000-000000000001",
    cajasAlimentos: "74000000-0000-4000-8000-000000000002",
    frazadas: "74000000-0000-4000-8000-000000000003",
    sacosFluviales: "74000000-0000-4000-8000-000000000004",
  },
  patrullas: {
    ocupada: "74500000-0000-4000-8000-000000000001",
    disponible: "74500000-0000-4000-8000-000000000002",
  },
  operativos: {
    enEjecucion: "74100000-0000-4000-8000-000000000001",
    planificada: "74100000-0000-4000-8000-000000000002",
    completada: "74100000-0000-4000-8000-000000000003",
    cancelada: "74100000-0000-4000-8000-000000000004",
  },
  misiones: {
    mis1: "74200000-0000-4000-8000-000000000001",
    mis2: "74200000-0000-4000-8000-000000000002",
    mis3: "74200000-0000-4000-8000-000000000003",
  },
};

export async function limpiarFixtureH74() {
  console.log("Limpiando fixture H74 (operativos de recuperación)...");

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

  console.log("Limpieza de fixture H74 completada.");
}

export async function sembrarFixtureH74() {
  await limpiarFixtureH74();
  console.log("Sembrando fixture H74 en la base de datos...");

  // 1. Recursos e Insumos
  await sql`
    INSERT INTO recurso (
      id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
      latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
    ) VALUES
    (
      ${IDS.recursos.planchasZinc},
      'Planchas de Zinc Acanaladas 3.66m (H74)',
      false, 'DISPONIBLE', 500, 0, 50,
      -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
      'Planchas de zinc galvanizado para reparación de techumbres post-temporal',
      ${IDS.delegaciones.costa}, ${IDS.usuarioEncargado}
    ),
    (
      ${IDS.recursos.cajasAlimentos},
      'Cajas de Alimentos de Emergencia (H74)',
      false, 'DISPONIBLE', 300, 0, 30,
      -39.8310, -73.2289, ST_SetSRID(ST_MakePoint(-73.2289, -39.8310), 4326),
      'Canasta familiar de contingencia con víveres no perecibles',
      ${IDS.delegaciones.sur}, ${IDS.usuarioEncargado}
    ),
    (
      ${IDS.recursos.frazadas},
      'Frazadas Térmicas Polar (H74)',
      false, 'DISPONIBLE', 400, 0, 40,
      -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
      'Frazadas de alta densidad para abrigo inmediato',
      ${IDS.delegaciones.costa}, ${IDS.usuarioEncargado}
    ),
    (
      ${IDS.recursos.sacosFluviales},
      'Sacos Fluviales de Arena (H74)',
      false, 'DISPONIBLE', 1000, 0, 100,
      -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
      'Sacos de geotextil rellenos con arena para contención fluvial',
      ${IDS.delegaciones.calleCalle}, ${IDS.usuarioEncargado}
    );
  `.execute(db);

  // 2. Patrullas Verificadoras (una en recuperación y otra disponible para reasignación)
  await sql`
    INSERT INTO patrulla_verificadora (
      id, codigo, nombre, estado, delegacion_id
    ) VALUES
    (
      ${IDS.patrullas.ocupada},
      'PV-H74-01',
      'Patrulla Verificadora Costa H74',
      'EN_RECUPERACION',
      ${IDS.delegaciones.costa}
    ),
    (
      ${IDS.patrullas.disponible},
      'PV-H74-02',
      'Patrulla Verificadora Norte H74',
      'DISPONIBLE',
      ${IDS.delegaciones.norte}
    )
    ON CONFLICT (id) DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nombre = EXCLUDED.nombre,
      estado = EXCLUDED.estado,
      delegacion_id = EXCLUDED.delegacion_id;
  `.execute(db);

  // 3. Operativos de Recuperación en los 4 estados
  await sql`
    INSERT INTO recuperacion (
      id, codigo, nombre, descripcion, sector, direccion_texto, prioridad,
      contacto_nombre, contacto_telefono, latitud, longitud, ubicacion,
      estado, familias_afectadas, delegacion_id, fecha_estimada_fin,
      creado_por_id, creado_en, actualizado_en
    ) VALUES
    (
      ${IDS.operativos.enEjecucion},
      'REC-2026-7401',
      'Entrega de techumbres y habitabilidad Niebla Alto',
      'Despliegue de entrega de planchas de zinc y frazadas a viviendas afectadas.',
      'Sector Niebla Alto',
      'Calle Miramar #450, Niebla',
      'ALTA',
      'Mariana Cárdenas',
      '+56987654321',
      -39.8682, -73.3965, ST_SetSRID(ST_MakePoint(-73.3965, -39.8682), 4326),
      'EN_EJECUCION',
      18,
      ${IDS.delegaciones.costa},
      NOW() + INTERVAL '2 days',
      ${IDS.usuarioEncargado},
      NOW() - INTERVAL '3 hours',
      NOW() - INTERVAL '30 minutes'
    ),
    (
      ${IDS.operativos.planificada},
      'REC-2026-7402',
      'Distribución preventiva de cajas de alimentos Angachilla',
      'Operativo planificado para entrega de canastas de emergencia.',
      'Angachilla',
      'Av. Simpson #1200',
      'MEDIA',
      'Pedro Soto',
      '+56911223344',
      -39.8456, -73.2389, ST_SetSRID(ST_MakePoint(-73.2389, -39.8456), 4326),
      'PLANIFICADA',
      12,
      ${IDS.delegaciones.sur},
      NOW() + INTERVAL '3 days',
      ${IDS.usuarioEncargado},
      NOW() - INTERVAL '1 hour',
      NOW() - INTERVAL '1 hour'
    ),
    (
      ${IDS.operativos.completada},
      'REC-2026-7403',
      'Reposición de techumbres Las Ánimas (Completado)',
      'Operativo finalizado — debe bloquear edición con 409 Conflict.',
      'Las Ánimas',
      'Av. Pedro Aguirre Cerda #890',
      'ALTA',
      'Luis Morales',
      '+56955667788',
      -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
      'COMPLETADA',
      8,
      ${IDS.delegaciones.norte},
      NOW() - INTERVAL '1 day',
      ${IDS.usuarioEncargado},
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '1 day'
    ),
    (
      ${IDS.operativos.cancelada},
      'REC-2026-7404',
      'Contención fluvial Collico (Cancelado)',
      'Operativo cancelado — debe bloquear edición con 409 Conflict.',
      'Collico',
      'Calle Balmaceda #1245',
      'BAJA',
      'Ana Vega',
      '+56999887766',
      -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
      'CANCELADA',
      0,
      ${IDS.delegaciones.calleCalle},
      NULL,
      ${IDS.usuarioEncargado},
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '1 day'
    );
  `.execute(db);

  // 4. Recursos asignados
  await sql`
    INSERT INTO recuperacion_recurso (id, recuperacion_id, recurso_id, cantidad_asignada)
    VALUES
      (gen_random_uuid(), ${IDS.operativos.enEjecucion}, ${IDS.recursos.planchasZinc}, 80),
      (gen_random_uuid(), ${IDS.operativos.enEjecucion}, ${IDS.recursos.frazadas}, 20),
      (gen_random_uuid(), ${IDS.operativos.planificada}, ${IDS.recursos.cajasAlimentos}, 45),
      (gen_random_uuid(), ${IDS.operativos.completada}, ${IDS.recursos.sacosFluviales}, 100);
  `.execute(db);

  // 5. Misiones tácticas vinculadas
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      recuperacion_id, patrulla_id, creado_por_id, fecha_inicio, creado_en
    ) VALUES
    (
      ${IDS.misiones.mis1},
      'MIS-2026-7401',
      'Entrega de techumbres y habitabilidad Niebla Alto',
      'Despliegue de entrega de planchas de zinc y frazadas a viviendas afectadas.',
      'RECUPERACION',
      'EN_CURSO',
      'ALTA',
      ${IDS.operativos.enEjecucion},
      ${IDS.patrullas.ocupada},
      ${IDS.usuarioEncargado},
      NOW() - INTERVAL '2 hours',
      NOW() - INTERVAL '3 hours'
    ),
    (
      ${IDS.misiones.mis2},
      'MIS-2026-7402',
      'Distribución preventiva de cajas de alimentos Angachilla',
      'Operativo planificado para entrega de canastas de emergencia.',
      'RECUPERACION',
      'DESPACHADA',
      'MEDIA',
      ${IDS.operativos.planificada},
      ${IDS.patrullas.ocupada},
      ${IDS.usuarioEncargado},
      NULL,
      NOW() - INTERVAL '1 hour'
    ),
    (
      ${IDS.misiones.mis3},
      'MIS-2026-7403',
      'Reposición de techumbres Las Ánimas (Completado)',
      'Operativo finalizado — debe bloquear edición con 409 Conflict.',
      'RECUPERACION',
      'COMPLETADA',
      'ALTA',
      ${IDS.operativos.completada},
      NULL,
      ${IDS.usuarioEncargado},
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '3 days'
    );
  `.execute(db);

  // 6. Asegurar asignación de permiso RBAC recuperacion:editar a ENCARGADO y ADMIN
  await sql`
    DO $$
    DECLARE
      v_permiso_id UUID;
      v_target_id UUID := '10000000-0000-4000-8000-000000000045';
      v_admin_rol_id UUID := '20000000-0000-4000-8000-000000000001';
      v_encargado_rol_id UUID := '20000000-0000-4000-8000-000000000003';
    BEGIN
      SELECT id INTO v_permiso_id FROM permiso WHERE codigo = 'recuperacion:editar';

      IF v_permiso_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM permiso WHERE id = v_target_id) THEN
          INSERT INTO permiso (codigo, nombre, descripcion, modulo)
          VALUES (
            'recuperacion:editar',
            'Editar Operativo de Recuperación',
            'Permite modificar la descripción, fecha estimada de término y dotación de insumos de operativos de recuperación activos',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
        ELSE
          INSERT INTO permiso (id, codigo, nombre, descripcion, modulo)
          VALUES (
            v_target_id,
            'recuperacion:editar',
            'Editar Operativo de Recuperación',
            'Permite modificar la descripción, fecha estimada de término y dotación de insumos de operativos de recuperación activos',
            'Eventos ATP'
          )
          RETURNING id INTO v_permiso_id;
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

  console.log("Fixture H74 sembrado exitosamente (4 operativos: EN_EJECUCION, PLANIFICADA, COMPLETADA, CANCELADA y permiso RBAC asegurado).");
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--clean")) {
      await limpiarFixtureH74();
    } else {
      await sembrarFixtureH74();
    }
    process.exit(0);
  } catch (error) {
    console.error("Error al ejecutar fixture H74:", error);
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.includes("seed-h74")) {
  main();
}
