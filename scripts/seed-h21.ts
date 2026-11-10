/**
 * Fixture de datos QA para HU-21 — Asignar Cuadrilla a Incidente y Liberar Patrulla.
 *
 * Objetivo:
 *   Dejar la base de datos en un estado que permita probar de punta a punta la HU-21:
 *   1. Personal operativo (brigadistas, patrulleros y delegado de cuadrilla).
 *   2. Dos patrullas verificadoras DISPONIBLES con sus integrantes.
 *   3. Una cuadrilla operativa DISPONIBLE con dotación completa (personal + recursos).
 *   4. INC-H21-QA-001 en estado REPORTADO  -> para practicar "Verificar / Asignar Patrulla".
 *   5. INC-H21-QA-002 en estado VERIFICANDO con evaluación técnica ya cerrada
 *      (reporte_terreno + hito EVALUACION_COMPLETADA) -> listo para asignar cuadrilla.
 *
 * Uso:
 *   npm run seed:h21            # Siembra (limpia y recrea el fixture)
 *   npm run seed:h21 -- --clean # Solo elimina los datos del fixture
 *
 * Notas:
 *   - Es idempotente: cada ejecución reinicia únicamente los registros de este fixture.
 *   - No toca los datos preexistentes del equipo (p. ej. incidentes, cuadrillas o patrullas
 *     creados manualmente durante las pruebas manuales).
 *   - Todos los usuarios creados usan la contraseña institucional de desarrollo: Valdivia2026!
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Identificadores fijos del fixture (UUID deterministas para re-ejecuciones)
// ---------------------------------------------------------------------------
const IDS = {
  usuarios: {
    brigadista1: "b2100000-0000-4000-8000-000000000001",
    brigadista2: "b2100000-0000-4000-8000-000000000002",
    brigadista3: "b2100000-0000-4000-8000-000000000003",
    patrullero1: "b2100000-0000-4000-8000-000000000004",
    patrullero2: "b2100000-0000-4000-8000-000000000005",
    patrullero3: "b2100000-0000-4000-8000-000000000006",
    patrullero4: "b2100000-0000-4000-8000-000000000007",
    delegado: "b2100000-0000-4000-8000-000000000008",
  },
  personal: {
    brigadista1: "c2100000-0000-4000-8000-000000000001",
    brigadista2: "c2100000-0000-4000-8000-000000000002",
    brigadista3: "c2100000-0000-4000-8000-000000000003",
    patrullero1: "c2100000-0000-4000-8000-000000000004",
    patrullero2: "c2100000-0000-4000-8000-000000000005",
    patrullero3: "c2100000-0000-4000-8000-000000000006",
    patrullero4: "c2100000-0000-4000-8000-000000000007",
    delegado: "c2100000-0000-4000-8000-000000000008",
  },
  recursos: {
    vehiculoPatrulla1: "d2100000-0000-4000-8000-000000000001",
    vehiculoPatrulla2: "d2100000-0000-4000-8000-000000000002",
    vehiculoCuadrilla: "d2100000-0000-4000-8000-000000000003",
    motobomba: "d2100000-0000-4000-8000-000000000004",
    motosierra: "d2100000-0000-4000-8000-000000000005",
    sacos: "d2100000-0000-4000-8000-000000000006",
  },
  patrullas: {
    pv1: "e2100000-0000-4000-8000-000000000001",
    pv2: "e2100000-0000-4000-8000-000000000002",
  },
  cuadrilla: "f2100000-0000-4000-8000-000000000001",
  informante: "a2100000-0000-4000-8000-000000000009",
  incidentes: {
    reportado: "a2100000-0000-4000-8000-000000000001",
    verificado: "a2100000-0000-4000-8000-000000000002",
    verificado2: "a2100000-0000-4000-8000-000000000003",
  },
  misionVerificacion: "f3100000-0000-4000-8000-000000000001",
  misionVerificacion2: "f3100000-0000-4000-8000-000000000002",
  reporteTerreno: "e3100000-0000-4000-8000-000000000001",
  reporteTerreno2: "e3100000-0000-4000-8000-000000000002",
  hitoEvaluacion: "c3100000-0000-4000-8000-000000000001",
  hitoEvaluacion2: "c3100000-0000-4000-8000-000000000002",
} as const;

const USUARIOS_QA = Object.values(IDS.usuarios);
const PATRULLAS_QA = Object.values(IDS.patrullas);
const RECURSOS_QA = Object.values(IDS.recursos);
const INCIDENTES_QA = Object.values(IDS.incidentes);
const MISIONES_VERIFICACION_QA = [IDS.misionVerificacion, IDS.misionVerificacion2];

const SOLO_LIMPIEZA = process.argv.includes("--clean");

/**
 * Elimina exclusivamente los registros del fixture QA de HU-21.
 * El orden respeta las dependencias de claves foráneas (hijos antes que padres).
 */
async function limpiarFixture(): Promise<void> {
  await sql`
    DELETE FROM mision_hito
    WHERE mision_id IN (
      SELECT id FROM mision
      WHERE incidente_id IN (${sql.join(INCIDENTES_QA)})
         OR id IN (${sql.join(MISIONES_VERIFICACION_QA)})
    )
       OR registrado_por_id IN (${sql.join(USUARIOS_QA)})
  `.execute(db);

  await sql`
    DELETE FROM reporte_terreno
    WHERE mision_id IN (
      SELECT id FROM mision
      WHERE incidente_id IN (${sql.join(INCIDENTES_QA)})
         OR id IN (${sql.join(MISIONES_VERIFICACION_QA)})
    )
       OR evaluador_id IN (${sql.join(USUARIOS_QA)})
  `.execute(db);

  await sql`
    DELETE FROM mision
    WHERE incidente_id IN (${sql.join(INCIDENTES_QA)})
       OR id IN (${sql.join(MISIONES_VERIFICACION_QA)})
       OR creado_por_id IN (${sql.join(USUARIOS_QA)})
  `.execute(db);

  await sql`DELETE FROM cuadrilla_recurso WHERE cuadrilla_id = ${IDS.cuadrilla}`.execute(db);
  await sql`DELETE FROM cuadrilla_personal WHERE cuadrilla_id = ${IDS.cuadrilla}`.execute(db);
  await sql`
    DELETE FROM patrulla_personal
    WHERE patrulla_id IN (${sql.join(PATRULLAS_QA)})
  `.execute(db);

  await sql`DELETE FROM incidente WHERE id IN (${sql.join(INCIDENTES_QA)})`.execute(db);
  await sql`DELETE FROM cuadrilla WHERE id = ${IDS.cuadrilla}`.execute(db);
  await sql`DELETE FROM patrulla_verificadora WHERE id IN (${sql.join(PATRULLAS_QA)})`.execute(db);
  await sql`DELETE FROM personal WHERE usuario_id IN (${sql.join(USUARIOS_QA)})`.execute(db);
  await sql`DELETE FROM usuario WHERE id IN (${sql.join(USUARIOS_QA)})`.execute(db);
  await sql`DELETE FROM recurso WHERE id IN (${sql.join(RECURSOS_QA)})`.execute(db);
  await sql`DELETE FROM informante WHERE id = ${IDS.informante}`.execute(db);
}

/**
 * Siembra el fixture completo de pruebas HU-21.
 */
export async function sembrarFixtureH21(): Promise<void> {
  console.log("Iniciando fixture de pruebas HU-21 (asignar cuadrilla / liberar patrulla)...");

  // -------------------------------------------------------------------------
  // 1. Resolver catálogos y usuarios institutionales
  // -------------------------------------------------------------------------
  const delegacionSur = await db
    .selectFrom("delegacion")
    .select(["id", "nombre"])
    .where("codigo", "=", "DEL_SUR")
    .executeTakeFirst();

  if (!delegacionSur) {
    throw new Error("No se encontró la delegación DEL_SUR. Revisa las migraciones de catálogos base.");
  }

  const roles = await db.selectFrom("rol").select(["id", "codigo"]).execute();
  const rolPorCodigo = new Map(roles.map((r) => [r.codigo, r.id]));

  const idRolBrigadista = rolPorCodigo.get("BRIGADISTA");
  const idRolPatrulla = rolPorCodigo.get("PATRULLA_VERIFICADORA");
  const idRolDelegado = rolPorCodigo.get("DELEGADO_CUADRILLA");

  if (!idRolBrigadista || !idRolPatrulla || !idRolDelegado) {
    throw new Error("No se encontraron los roles BRIGADISTA, PATRULLA_VERIFICADORA o DELEGADO_CUADRILLA.");
  }

  const admin = await db
    .selectFrom("usuario")
    .select(["id"])
    .where("email", "=", "admin@valdivia.cl")
    .executeTakeFirst();
  const encargado = await db
    .selectFrom("usuario")
    .select(["id"])
    .where("email", "=", "encargado@valdivia.cl")
    .executeTakeFirst();

  if (!admin || !encargado) {
    throw new Error("No se encontraron los usuarios institutionales admin@valdivia.cl / encargado@valdivia.cl.");
  }

  const tipos = await db.selectFrom("tipo_incidente").select(["id", "nombre"]).execute();
  const tipoAnegamiento =
    tipos.find((t) => t.nombre === "Anegamiento de calzada") ??
    tipos.find((t) => t.nombre.toLowerCase().includes("anegam")) ??
    tipos[0];
  if (!tipoAnegamiento) {
    throw new Error("No hay tipos de incidente cargados en la base de datos.");
  }

  const fuentes = await db.selectFrom("fuente_incidente").select(["id", "nombre"]).execute();
  const fuenteChatbot =
    fuentes.find((f) => f.nombre === "CHATBOT") ?? fuentes[0];
  if (!fuenteChatbot) {
    throw new Error("No hay fuentes de incidente cargadas en la base de datos.");
  }

  // -------------------------------------------------------------------------
  // 2. Limpiar el fixture previo (idempotencia)
  // -------------------------------------------------------------------------
  await limpiarFixture();
  console.log("Fixture anterior limpiado.");

  if (SOLO_LIMPIEZA) {
    console.log("Modo --clean: no se siembran datos nuevos.");
    return;
  }

  // -------------------------------------------------------------------------
  // 3. Personal operativo: brigadistas, patrulleros y delegado de cuadrilla
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO usuario (id, rut, nombres, apellidos, email, rol_id, delegacion_id, activo, estado_operativo)
    VALUES
      (${IDS.usuarios.brigadista1}, '21000001-1', 'Brigadista', 'Uno QA',        'brigadista1.h21@valdivia.cl', ${idRolBrigadista}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.brigadista2}, '21000002-2', 'Brigadista', 'Dos QA',         'brigadista2.h21@valdivia.cl', ${idRolBrigadista}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.brigadista3}, '21000003-3', 'Brigadista', 'Tres QA',        'brigadista3.h21@valdivia.cl', ${idRolBrigadista}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.patrullero1}, '21000004-4', 'Patrullero', 'Uno QA',         'patrullero1.h21@valdivia.cl', ${idRolPatrulla}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.patrullero2}, '21000005-5', 'Patrullero', 'Dos QA',         'patrullero2.h21@valdivia.cl', ${idRolPatrulla}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.patrullero3}, '21000006-6', 'Patrullero', 'Tres QA',        'patrullero3.h21@valdivia.cl', ${idRolPatrulla}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.patrullero4}, '21000007-7', 'Patrullero', 'Cuatro QA',      'patrullero4.h21@valdivia.cl', ${idRolPatrulla}, ${delegacionSur.id}, true, 'disponible'),
      (${IDS.usuarios.delegado}, '21000008-8', 'Delegado', 'Cuadrilla QA',       'delegado.h21@valdivia.cl', ${idRolDelegado}, ${delegacionSur.id}, true, 'disponible')
  `.execute(db);

  await sql`
    INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, disponible_terreno)
    VALUES
      (${IDS.personal.brigadista1}, ${IDS.usuarios.brigadista1}, ${delegacionSur.id}, 'Poda, tala y mitigación de riesgos', 'Brigadista Operativo', true),
      (${IDS.personal.brigadista2}, ${IDS.usuarios.brigadista2}, ${delegacionSur.id}, 'Operación de motobomba y achique', 'Brigadista Operativo', true),
      (${IDS.personal.brigadista3}, ${IDS.usuarios.brigadista3}, ${delegacionSur.id}, 'Control de tránsito y perímetro', 'Brigadista Operativo', true),
      (${IDS.personal.patrullero1}, ${IDS.usuarios.patrullero1}, ${delegacionSur.id}, 'Evaluación y diagnóstico rápido de emergencias', 'Inspector Técnico de Terreno', true),
      (${IDS.personal.patrullero2}, ${IDS.usuarios.patrullero2}, ${delegacionSur.id}, 'Apoyo en evaluación y toma de evidencia', 'Inspector Técnico de Terreno', true),
      (${IDS.personal.patrullero3}, ${IDS.usuarios.patrullero3}, ${delegacionSur.id}, 'Evaluación y diagnóstico rápido de emergencias', 'Inspector Técnico de Terreno', true),
      (${IDS.personal.patrullero4}, ${IDS.usuarios.patrullero4}, ${delegacionSur.id}, 'Apoyo en evaluación y toma de evidencia', 'Inspector Técnico de Terreno', true),
      (${IDS.personal.delegado}, ${IDS.usuarios.delegado}, ${delegacionSur.id}, 'Mando y coordinación de cuadrilla', 'Delegado de Cuadrilla', true)
  `.execute(db);

  console.log("Personal operativo creado (3 brigadistas, 4 patrulleros, 1 delegado).");

  // -------------------------------------------------------------------------
  // 4. Recursos logísticos
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO recurso (
      id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
      latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
    )
    VALUES
      (
        ${IDS.recursos.vehiculoPatrulla1},
        'Camioneta Toyota Hilux 4x4 - Patrulla H21-01 (TH-81-22)',
        true, 'DISPONIBLE', 1, 0, 0,
        -39.8142, -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Vehículo de inspección y transporte ágil de patrulla verificadora',
        ${delegacionSur.id}, ${admin.id}
      ),
      (
        ${IDS.recursos.vehiculoPatrulla2},
        'Camioneta Nissan Navara 4x4 - Patrulla H21-02 (NN-45-67)',
        true, 'DISPONIBLE', 1, 0, 0,
        -39.8310, -73.2289,
        ST_SetSRID(ST_MakePoint(-73.2289, -39.8310), 4326),
        'Vehículo de inspección y transporte ágil de patrulla verificadora',
        ${delegacionSur.id}, ${admin.id}
      ),
      (
        ${IDS.recursos.vehiculoCuadrilla},
        'Camioneta Cuadrilla Nissan Navara 4x4 (CD-FG-23)',
        true, 'DISPONIBLE', 1, 0, 0,
        -39.8170, -73.2420,
        ST_SetSRID(ST_MakePoint(-73.2420, -39.8170), 4326),
        'Vehículo de tracción para traslado de cuadrillas y equipos pesados',
        ${delegacionSur.id}, ${admin.id}
      ),
      (
        ${IDS.recursos.motobomba},
        'Motobomba Caudal 4 pulgadas',
        true, 'DISPONIBLE', 1, 0, 0,
        -39.8142, -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Motobomba diésel de alta succión para anegamientos urbanos',
        ${delegacionSur.id}, ${admin.id}
      ),
      (
        ${IDS.recursos.motosierra},
        'Motosierra Stihl MS 382 Profesional',
        true, 'DISPONIBLE', 2, 0, 0,
        -39.8142, -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Herramienta de poda y trozado de árboles caídos en calzadas',
        ${delegacionSur.id}, ${admin.id}
      ),
      (
        ${IDS.recursos.sacos},
        'Sacos de Arena de Contención Fluvial',
        false, 'DISPONIBLE', 100, 0, 0,
        -39.8142, -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Sacos para diques provisionales de desborde y protección domiciliaria',
        ${delegacionSur.id}, ${admin.id}
      )
  `.execute(db);

  console.log("Recursos logísticos creados (vehículos, motobomba, motosierra y sacos).");

  // -------------------------------------------------------------------------
  // 5. Patrullas verificadoras (2, ambas DISPONIBLES)
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO patrulla_verificadora (
      id, codigo, nombre, estado, delegacion_id, usuario_lider_id, vehiculo_id,
      latitud, longitud, ubicacion, activo, eliminado_en
    )
    VALUES
      (
        ${IDS.patrullas.pv1},
        'PV-H21-QA-01',
        'Patrulla Rápida H21-01',
        'DISPONIBLE',
        ${delegacionSur.id},
        ${IDS.usuarios.patrullero1},
        ${IDS.recursos.vehiculoPatrulla1},
        -39.8142, -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        true, NULL
      ),
      (
        ${IDS.patrullas.pv2},
        'PV-H21-QA-02',
        'Patrulla Rápida H21-02',
        'DISPONIBLE',
        ${delegacionSur.id},
        ${IDS.usuarios.patrullero3},
        ${IDS.recursos.vehiculoPatrulla2},
        -39.8310, -73.2289,
        ST_SetSRID(ST_MakePoint(-73.2289, -39.8310), 4326),
        true, NULL
      )
  `.execute(db);

  await sql`
    INSERT INTO patrulla_personal (patrulla_id, personal_id, rol_en_patrulla)
    VALUES
      (${IDS.patrullas.pv1}, ${IDS.personal.patrullero1}, 'LIDER'),
      (${IDS.patrullas.pv1}, ${IDS.personal.patrullero2}, 'OPERATIVO'),
      (${IDS.patrullas.pv2}, ${IDS.personal.patrullero3}, 'LIDER'),
      (${IDS.patrullas.pv2}, ${IDS.personal.patrullero4}, 'OPERATIVO')
  `.execute(db);

  console.log("Patrullas verificadoras creadas (PV-H21-QA-01 y PV-H21-QA-02, ambas DISPONIBLES).");

  // -------------------------------------------------------------------------
  // 6. Cuadrilla operativa DISPONIBLE con dotación completa
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO cuadrilla (
      id, nombre, estado, delegacion_id, usuario_delegado_id,
      creado_por_id, creado_en, actualizado_en, eliminado_en, activo
    )
    VALUES (
      ${IDS.cuadrilla},
      'Cuadrilla H21 QA',
      'DISPONIBLE',
      ${delegacionSur.id},
      ${IDS.usuarios.delegado},
      ${admin.id},
      CURRENT_TIMESTAMP - interval '3 days',
      CURRENT_TIMESTAMP,
      NULL,
      true
    )
  `.execute(db);

  await sql`
    INSERT INTO cuadrilla_personal (cuadrilla_id, personal_id, activo)
    VALUES
      (${IDS.cuadrilla}, ${IDS.personal.brigadista1}, true),
      (${IDS.cuadrilla}, ${IDS.personal.brigadista2}, true),
      (${IDS.cuadrilla}, ${IDS.personal.brigadista3}, true)
  `.execute(db);

  await sql`
    INSERT INTO cuadrilla_recurso (cuadrilla_id, recurso_id, cantidad_asignada, activo)
    VALUES
      (${IDS.cuadrilla}, ${IDS.recursos.vehiculoCuadrilla}, 1, true),
      (${IDS.cuadrilla}, ${IDS.recursos.motobomba}, 1, true),
      (${IDS.cuadrilla}, ${IDS.recursos.motosierra}, 2, true),
      (${IDS.cuadrilla}, ${IDS.recursos.sacos}, 50, true)
  `.execute(db);

  console.log("Cuadrilla 'Cuadrilla H21 QA' creada (DISPONIBLE, con 3 brigadistas y 4 recursos).");

  // -------------------------------------------------------------------------
  // 7. Informante ciudadano del escenario
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO informante (id, rut, nombre, telefono)
    VALUES (
      ${IDS.informante},
      '21212121-1',
      'QA H21 Informante',
      '+56991234567'
    )
  `.execute(db);

  // -------------------------------------------------------------------------
  // 8. Incidente A — REPORTADO (practicar verificación + asignación de patrulla)
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, folio, informante_id, tipo_incidente_id, delegacion_id,
      fuente_incidente_id, tipo_afectacion, descripcion, direccion_texto, latitud, longitud,
      ubicacion, estado, prioridad, requiere_asistencia_social, fuente_origen,
      creado_por_id, encargado_id, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.incidentes.reportado},
      'INC-H21-QA-001',
      '21000001',
      'FOL-H21-QA-001',
      ${IDS.informante},
      ${tipoAnegamiento.id},
      ${delegacionSur.id},
      ${fuenteChatbot.id},
      'Anegamiento',
      'Reporte ciudadano QA: acumulación de aguas en calzada con sumideros colapsados. Pendiente de verificación en terreno.',
      'Av. Ramón Picarte 1850, Sector Regional, Valdivia',
      -39.8245,
      -73.2356,
      ST_SetSRID(ST_MakePoint(-73.2356, -39.8245), 4326),
      'REPORTADO',
      'ALTA',
      false,
      'CHATBOT',
      ${admin.id},
      ${encargado.id},
      CURRENT_TIMESTAMP - interval '45 minutes',
      CURRENT_TIMESTAMP - interval '45 minutes'
    )
  `.execute(db);

  // -------------------------------------------------------------------------
  // 9. Incidente B — VERIFICANDO con evaluación técnica cerrada (listo para H21)
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, folio, informante_id, tipo_incidente_id, delegacion_id,
      fuente_incidente_id, tipo_afectacion, descripcion, direccion_texto, latitud, longitud,
      ubicacion, estado, prioridad, requiere_asistencia_social, fuente_origen,
      creado_por_id, encargado_id, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.incidentes.verificado},
      'INC-H21-QA-002',
      '21000002',
      'FOL-H21-QA-002',
      ${IDS.informante},
      ${tipoAnegamiento.id},
      ${delegacionSur.id},
      ${fuenteChatbot.id},
      'Anegamiento',
      'Anegamiento verificado por patrulla: sumideros colapsados con riesgo de ingreso de agua a viviendas. Requiere despliegue de cuadrilla con motobomba.',
      'Av. Francia con San Jorge 450, Valdivia',
      -39.8362,
      -73.2351,
      ST_SetSRID(ST_MakePoint(-73.2351, -39.8362), 4326),
      'VERIFICANDO',
      'ALTA',
      false,
      'CHATBOT',
      ${admin.id},
      ${encargado.id},
      CURRENT_TIMESTAMP - interval '90 minutes',
      CURRENT_TIMESTAMP - interval '10 minutes'
    )
  `.execute(db);

  // -------------------------------------------------------------------------
  // 10. Misión de verificación completada + reporte de terreno + hito
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.misionVerificacion},
      'MIS-2026-9001',
      'Verificación técnica de anegamiento en Av. Francia',
      'Evaluar cota de agua, sumideros colapsados y riesgo a viviendas aledañas antes de escalar a cuadrilla operativa.',
      'VERIFICACION',
      'COMPLETADA',
      'ALTA',
      ${IDS.incidentes.verificado},
      ${IDS.patrullas.pv2},
      NULL,
      ${encargado.id},
      ${admin.id},
      CURRENT_TIMESTAMP - interval '40 minutes',
      CURRENT_TIMESTAMP - interval '10 minutes',
      CURRENT_TIMESTAMP - interval '45 minutes',
      CURRENT_TIMESTAMP - interval '10 minutes'
    )
  `.execute(db);

  await sql`
    INSERT INTO reporte_terreno (
      id, mision_id, evaluador_id, resumen_tecnico, acciones_realizadas,
      requiere_apoyo_adicional, danos_estimados, observaciones, personas_afectadas,
      estado_terreno, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.reporteTerreno},
      ${IDS.misionVerificacion},
      ${IDS.usuarios.patrullero3},
      'Evaluación técnica concluida: anegamiento de 45 cm sobre calzada por colapso de sumidero pluvial. Existe riesgo inminente de ingreso de agua en tres viviendas particulares.',
      'Perímetro asegurado con conos y cinta reflectante. Tránsito peatonal desviado por vereda alterna.',
      true,
      'Sin daños estructurales observados; posible daño a antejardines si el nivel sube 10 cm.',
      'Se solicita despacho urgente de cuadrilla con motobomba de succión pesada.',
      6,
      'FINALIZADO',
      CURRENT_TIMESTAMP - interval '15 minutes',
      CURRENT_TIMESTAMP - interval '15 minutes'
    )
  `.execute(db);

  await sql`
    INSERT INTO mision_hito (id, mision_id, hito, descripcion, registrado_por_id, latitud, longitud, creado_en)
    VALUES (
      ${IDS.hitoEvaluacion},
      ${IDS.misionVerificacion},
      'EVALUACION_COMPLETADA',
      'Reporte de terreno registrado. La patrulla confirma la necesidad de escalamiento a cuadrilla operativa.',
      ${IDS.usuarios.patrullero3},
      -39.8362,
      -73.2351,
      CURRENT_TIMESTAMP - interval '12 minutes'
    )
  `.execute(db);

  console.log("Incidentes creados (uno REPORTADO y otro VERIFICANDO con reporte de terreno).");

  // -------------------------------------------------------------------------
  // 10.1. Incidente C — VERIFICANDO con evaluación cerrada (para probar el rechazo
  //      de doble asignación de una misma cuadrilla ya despachada)
  // -------------------------------------------------------------------------
  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, folio, informante_id, tipo_incidente_id, delegacion_id,
      fuente_incidente_id, tipo_afectacion, descripcion, direccion_texto, latitud, longitud,
      ubicacion, estado, prioridad, requiere_asistencia_social, fuente_origen,
      creado_por_id, encargado_id, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.incidentes.verificado2},
      'INC-H21-QA-003',
      '21000003',
      'FOL-H21-QA-003',
      ${IDS.informante},
      ${tipoAnegamiento.id},
      ${delegacionSur.id},
      ${fuenteChatbot.id},
      'Anegamiento',
      'Segundo incidente verificado para QA: sirve para comprobar que una cuadrilla ya despachada no puede volver a asignarse.',
      'Av. Alemania 780, Sector Centro-Norte, Valdivia',
      -39.8170,
      -73.2420,
      ST_SetSRID(ST_MakePoint(-73.2420, -39.8170), 4326),
      'VERIFICANDO',
      'ALTA',
      false,
      'CHATBOT',
      ${admin.id},
      ${encargado.id},
      CURRENT_TIMESTAMP - interval '30 minutes',
      CURRENT_TIMESTAMP - interval '5 minutes'
    )
  `.execute(db);

  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.misionVerificacion2},
      'MIS-2026-9101',
      'Verificación técnica de anegamiento en Av. Alemania',
      'Evaluar el anegamiento y dejarlo escalado para el despacho de una cuadrilla operativa.',
      'VERIFICACION',
      'COMPLETADA',
      'ALTA',
      ${IDS.incidentes.verificado2},
      ${IDS.patrullas.pv1},
      NULL,
      ${encargado.id},
      ${admin.id},
      CURRENT_TIMESTAMP - interval '25 minutes',
      CURRENT_TIMESTAMP - interval '5 minutes',
      CURRENT_TIMESTAMP - interval '30 minutes',
      CURRENT_TIMESTAMP - interval '5 minutes'
    )
  `.execute(db);

  await sql`
    INSERT INTO reporte_terreno (
      id, mision_id, evaluador_id, resumen_tecnico, acciones_realizadas,
      requiere_apoyo_adicional, danos_estimados, observaciones, personas_afectadas,
      estado_terreno, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.reporteTerreno2},
      ${IDS.misionVerificacion2},
      ${IDS.usuarios.patrullero3},
      'Evaluación técnica del segundo incidente QA: anegamiento verificado y listo para escalamiento a cuadrilla operativa.',
      'Perímetro delimitado y evaluación de daños realizada.',
      true,
      'Sin daños estructurales observados.',
      'Se solicita despacho de cuadrilla con motobomba.',
      4,
      'FINALIZADO',
      CURRENT_TIMESTAMP - interval '10 minutes',
      CURRENT_TIMESTAMP - interval '10 minutes'
    )
  `.execute(db);

  await sql`
    INSERT INTO mision_hito (id, mision_id, hito, descripcion, registrado_por_id, latitud, longitud, creado_en)
    VALUES (
      ${IDS.hitoEvaluacion2},
      ${IDS.misionVerificacion2},
      'EVALUACION_COMPLETADA',
      'Reporte de terreno registrado para el segundo incidente QA.',
      ${IDS.usuarios.patrullero3},
      -39.8170,
      -73.2420,
      CURRENT_TIMESTAMP - interval '8 minutes'
    )
  `.execute(db);

  // -------------------------------------------------------------------------
  // 11. Resumen operativo
  // -------------------------------------------------------------------------
  console.log("");
  console.log("────────────────────────────────────────────────────────────");
  console.log(" FIXTURE HU-21 LISTO");
  console.log("────────────────────────────────────────────────────────────");
  console.log(" Práctica de asignación de patrulla (HU-20):");
  console.log(`   Incidente : INC-H21-QA-001 (REPORTADO)`);
  console.log(`   Patrulla : PV-H21-QA-01 - Patrulla Rápida H21-01`);
  console.log("");
  console.log(" Prueba de asignación de cuadrilla (HU-21):");
  console.log(`   Incidente : INC-H21-QA-002 (VERIFICANDO, con reporte de terreno)`);
  console.log(`   Cuadrilla : Cuadrilla H21 QA (DISPONIBLE)`);
  console.log("");
  console.log(" Prueba de rechazo por doble asignación (HU-21):");
  console.log(`   Incidente : INC-H21-QA-003 (VERIFICANDO, con reporte de terreno)`);
  console.log(`   Expectativa: tras asignar la cuadrilla al 002, el 003 rechaza con 409`);
  console.log("");
  console.log(" Credenciales de prueba:");
  console.log("   encargado@valdivia.cl / Valdivia2026!   (rol ENCARGADO, permiso misiones:asignar)");
  console.log("   admin@valdivia.cl     / Valdivia2026!");
  console.log("────────────────────────────────────────────────────────────");
}

if (require.main === module || process.argv[1]?.includes("seed-h21")) {
  sembrarFixtureH21()
    .then(async () => {
      await db.destroy();
      process.exit(0);
    })
    .catch(async (err: unknown) => {
      console.error("Error al sembrar el fixture HU-21:", err);
      await db.destroy();
      process.exit(1);
    });
}
