import {
  HASH_VALDIVIA_2026,
  db,
  listaUuids,
  resolverDelegacion,
  resolverFuenteIncidente,
  resolverRol,
  resolverTipoIncidente,
  resolverUsuario,
  sql,
} from "./core";

/**
 * Fixture de datos QA para HU-41 — Rechazo motivado de una misión por cuadrilla.
 *
 * Deja la base lista para probar el flujo completo:
 *   1. Cuatro cuadrillas operativas con dotación real (delegado, brigadistas y recursos).
 *   2. Tres cuadrillas DISPONIBLES para asignación manual desde el Centro de Mando.
 *   3. Una cuadrilla EN_MISION con una misión DESPACHADA lista para rechazar desde la PWA.
 *   4. Incidentes en REPORTADO para practicar la asignación de cuadrilla.
 *
 * Uso:
 *   npm run seed -- --only=h41
 *   npm run seed -- --only=h41 --clean
 *
 * Credenciales institucionales de desarrollo: Valdivia2026!
 */

const IDS = {
  usuarios: {
    delegadoAlfa: "f4100000-0000-4000-8000-000000000001",
    delegadoBeta: "f4100000-0000-4000-8000-000000000002",
    delegadoGamma: "f4100000-0000-4000-8000-000000000003",
    delegadoDelta: "f4100000-0000-4000-8000-000000000004",
    brigadistaAlfa1: "f4100000-0000-4000-8000-000000000005",
    brigadistaAlfa2: "f4100000-0000-4000-8000-000000000006",
    brigadistaAlfa3: "f4100000-0000-4000-8000-000000000007",
    brigadistaBeta1: "f4100000-0000-4000-8000-000000000008",
    brigadistaBeta2: "f4100000-0000-4000-8000-000000000009",
    brigadistaBeta3: "f4100000-0000-4000-8000-000000000010",
    brigadistaGamma1: "f4100000-0000-4000-8000-000000000011",
    brigadistaGamma2: "f4100000-0000-4000-8000-000000000012",
    brigadistaGamma3: "f4100000-0000-4000-8000-000000000013",
    brigadistaDelta1: "f4100000-0000-4000-8000-000000000014",
    brigadistaDelta2: "f4100000-0000-4000-8000-000000000015",
    brigadistaDelta3: "f4100000-0000-4000-8000-000000000016",
    patrulla: "f4100000-0000-4000-8000-000000000017",
  },
  personal: {
    delegadoAlfa: "f4110000-0000-4000-8000-000000000001",
    delegadoBeta: "f4110000-0000-4000-8000-000000000002",
    delegadoGamma: "f4110000-0000-4000-8000-000000000003",
    delegadoDelta: "f4110000-0000-4000-8000-000000000004",
    brigadistaAlfa1: "f4110000-0000-4000-8000-000000000005",
    brigadistaAlfa2: "f4110000-0000-4000-8000-000000000006",
    brigadistaAlfa3: "f4110000-0000-4000-8000-000000000007",
    brigadistaBeta1: "f4110000-0000-4000-8000-000000000008",
    brigadistaBeta2: "f4110000-0000-4000-8000-000000000009",
    brigadistaBeta3: "f4110000-0000-4000-8000-000000000010",
    brigadistaGamma1: "f4110000-0000-4000-8000-000000000011",
    brigadistaGamma2: "f4110000-0000-4000-8000-000000000012",
    brigadistaGamma3: "f4110000-0000-4000-8000-000000000013",
    brigadistaDelta1: "f4110000-0000-4000-8000-000000000014",
    brigadistaDelta2: "f4110000-0000-4000-8000-000000000015",
    brigadistaDelta3: "f4110000-0000-4000-8000-000000000016",
    patrulla: "f4110000-0000-4000-8000-000000000017",
  },
  cuadrillas: {
    alfa: "f4120000-0000-4000-8000-000000000001",
    beta: "f4120000-0000-4000-8000-000000000002",
    gamma: "f4120000-0000-4000-8000-000000000003",
    delta: "f4120000-0000-4000-8000-000000000004",
  },
  patrulla: "f4125000-0000-4000-8000-000000000001",
  incidentes: {
    despachado: "f4130000-0000-4000-8000-000000000001",
    reportadoSur: "f4130000-0000-4000-8000-000000000002",
    reportadoCosta: "f4130000-0000-4000-8000-000000000003",
  },
  misiones: {
    cuadrillaDespachada: "f4140000-0000-4000-8000-000000000001",
    verificacionCompletada: "f4140000-0000-4000-8000-000000000002",
  },
  recursos: {
    vehiculoAlfa: "f4150000-0000-4000-8000-000000000001",
    motobombaAlfa: "f4150000-0000-4000-8000-000000000002",
    vehiculoBeta: "f4150000-0000-4000-8000-000000000003",
    motosierraBeta: "f4150000-0000-4000-8000-000000000004",
    vehiculoGamma: "f4150000-0000-4000-8000-000000000005",
    motobombaGamma: "f4150000-0000-4000-8000-000000000006",
    vehiculoDelta: "f4150000-0000-4000-8000-000000000007",
    motosierrasDelta: "f4150000-0000-4000-8000-000000000008",
    sacos: "f4150000-0000-4000-8000-000000000009",
    vehiculoPatrulla: "f4150000-0000-4000-8000-000000000010",
  },
  informante: "f4160000-0000-4000-8000-000000000001",
  reporteTerreno: "f4170000-0000-4000-8000-000000000001",
  hitos: {
    evaluacion: "f4180000-0000-4000-8000-000000000001",
    despacho: "f4180000-0000-4000-8000-000000000002",
  },
} as const;

const USUARIOS_IDS = Object.values(IDS.usuarios);
const PERSONAL_IDS = Object.values(IDS.personal);
const CUADRILLAS_IDS = Object.values(IDS.cuadrillas);
const INCIDENTES_IDS = Object.values(IDS.incidentes);
const MISIONES_IDS = Object.values(IDS.misiones);
const RECURSOS_IDS = Object.values(IDS.recursos);

const PASSWORD_H41 = "Valdivia2026!";

/**
 * Elimina exclusivamente los registros del fixture HU-41.
 * El orden respeta las dependencias de claves foráneas (hijos antes que padres).
 */
async function limpiarFixtureH41(): Promise<void> {
  await sql`
    DELETE FROM notificaciones_mision
    WHERE mision_id IN (${listaUuids(MISIONES_IDS)})
       OR patrulla_id = ${IDS.patrulla}::uuid
  `.execute(db);

  await sql`
    DELETE FROM adjunto
    WHERE reporte_terreno_id = ${IDS.reporteTerreno}::uuid
       OR incidente_id IN (${listaUuids(INCIDENTES_IDS)})
  `.execute(db);

  await sql`
    DELETE FROM mision_hito
    WHERE mision_id IN (${listaUuids(MISIONES_IDS)})
       OR registrado_por_id IN (${listaUuids(USUARIOS_IDS)})
  `.execute(db);

  await sql`
    DELETE FROM reporte_terreno
    WHERE mision_id IN (${listaUuids(MISIONES_IDS)})
       OR evaluador_id IN (${listaUuids(USUARIOS_IDS)})
  `.execute(db);

  await sql`
    DELETE FROM mision
    WHERE id IN (${listaUuids(MISIONES_IDS)})
       OR incidente_id IN (${listaUuids(INCIDENTES_IDS)})
       OR cuadrilla_id IN (${listaUuids(CUADRILLAS_IDS)})
       OR patrulla_id = ${IDS.patrulla}::uuid
  `.execute(db);

  await sql`DELETE FROM incidente WHERE id IN (${listaUuids(INCIDENTES_IDS)})`.execute(db);

  await sql`DELETE FROM cuadrilla_recurso WHERE cuadrilla_id IN (${listaUuids(CUADRILLAS_IDS)})`.execute(db);
  await sql`DELETE FROM cuadrilla_personal WHERE cuadrilla_id IN (${listaUuids(CUADRILLAS_IDS)})`.execute(db);
  await sql`DELETE FROM cuadrilla WHERE id IN (${listaUuids(CUADRILLAS_IDS)})`.execute(db);

  await sql`
    DELETE FROM patrulla_personal
    WHERE patrulla_id = ${IDS.patrulla}::uuid
       OR personal_id IN (${listaUuids(PERSONAL_IDS)})
  `.execute(db);
  await sql`DELETE FROM patrulla_verificadora WHERE id = ${IDS.patrulla}::uuid`.execute(db);

  await sql`
    DELETE FROM personal
    WHERE usuario_id IN (${listaUuids(USUARIOS_IDS)})
       OR id IN (${listaUuids(PERSONAL_IDS)})
  `.execute(db);
  await sql`DELETE FROM usuario WHERE id IN (${listaUuids(USUARIOS_IDS)})`.execute(db);
  await sql`DELETE FROM recurso WHERE id IN (${listaUuids(RECURSOS_IDS)})`.execute(db);
  await sql`DELETE FROM informante WHERE id = ${IDS.informante}::uuid`.execute(db);
}

export async function sembrarFixtureH41(
  options: { cleanOnly?: boolean } = {}
): Promise<void> {
  const { cleanOnly = false } = options;

  console.log("Iniciando fixture de pruebas HU-41 (rechazo de misión por cuadrilla)...");

  const [delNorte, delSur, delCosta, delCalleCalle, rolDelegado, rolBrigadista, rolPatrulla, admin, encargado, tipoIncidente, fuenteTerreno] =
    await Promise.all([
      resolverDelegacion("DEL_NORTE"),
      resolverDelegacion("DEL_SUR"),
      resolverDelegacion("DEL_COSTA"),
      resolverDelegacion("DEL_CALLE_CALLE"),
      resolverRol("DELEGADO_CUADRILLA"),
      resolverRol("BRIGADISTA"),
      resolverRol("PATRULLA_VERIFICADORA"),
      resolverUsuario("admin@valdivia.cl"),
      resolverUsuario("encargado@valdivia.cl"),
      resolverTipoIncidente("inundac", "anegam", "árbol", "arbol"),
      resolverFuenteIncidente("FUNCIONARIO_TERRENO"),
    ]);

  await limpiarFixtureH41();
  console.log("Fixture H41 anterior limpiado.");

  if (cleanOnly) {
    console.log("Modo --clean: no se siembran datos nuevos de H41.");
    return;
  }

  // 1. Delegados, brigadistas y patrulla con credenciales de desarrollo.
  await sql`
    INSERT INTO usuario (
      id, rut, nombres, apellidos, email, telefono, password_hash, rol_id,
      delegacion_id, activo, estado_operativo, fecha_ingreso
    )
    VALUES
      (${IDS.usuarios.delegadoAlfa}::uuid,    '21410001-1', 'Delegado', 'H41 Alfa',    'delegado.alfa.h41qa@valdivia.cl',    '+56941000001', ${HASH_VALDIVIA_2026}, ${rolDelegado.id}::uuid,   ${delSur.id}::uuid,        true, 'disponible', CURRENT_DATE - interval '40 days'),
      (${IDS.usuarios.delegadoBeta}::uuid,    '21410002-2', 'Delegado', 'H41 Beta',    'delegado.beta.h41qa@valdivia.cl',    '+56941000002', ${HASH_VALDIVIA_2026}, ${rolDelegado.id}::uuid,   ${delNorte.id}::uuid,      true, 'en_mision',  CURRENT_DATE - interval '40 days'),
      (${IDS.usuarios.delegadoGamma}::uuid,   '21410003-3', 'Delegado', 'H41 Gamma',   'delegado.gamma.h41qa@valdivia.cl',   '+56941000003', ${HASH_VALDIVIA_2026}, ${rolDelegado.id}::uuid,   ${delCosta.id}::uuid,      true, 'disponible', CURRENT_DATE - interval '35 days'),
      (${IDS.usuarios.delegadoDelta}::uuid,   '21410004-4', 'Delegado', 'H41 Delta',   'delegado.delta.h41qa@valdivia.cl',   '+56941000004', ${HASH_VALDIVIA_2026}, ${rolDelegado.id}::uuid,   ${delCalleCalle.id}::uuid, true, 'disponible', CURRENT_DATE - interval '30 days'),
      (${IDS.usuarios.brigadistaAlfa1}::uuid,'21410005-5', 'Brigadista', 'Alfa Uno',   'brigadista1.alfa.h41qa@valdivia.cl', '+56941000005', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delSur.id}::uuid,        true, 'disponible', CURRENT_DATE - interval '25 days'),
      (${IDS.usuarios.brigadistaAlfa2}::uuid,'21410006-6', 'Brigadista', 'Alfa Dos',   'brigadista2.alfa.h41qa@valdivia.cl', '+56941000006', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delSur.id}::uuid,        true, 'disponible', CURRENT_DATE - interval '25 days'),
      (${IDS.usuarios.brigadistaAlfa3}::uuid,'21410007-7', 'Brigadista', 'Alfa Tres',  'brigadista3.alfa.h41qa@valdivia.cl', '+56941000007', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delSur.id}::uuid,        true, 'disponible', CURRENT_DATE - interval '25 days'),
      (${IDS.usuarios.brigadistaBeta1}::uuid,'21410008-8', 'Brigadista', 'Beta Uno',   'brigadista1.beta.h41qa@valdivia.cl', '+56941000008', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delNorte.id}::uuid,      true, 'en_mision',  CURRENT_DATE - interval '25 days'),
      (${IDS.usuarios.brigadistaBeta2}::uuid,'21410009-9', 'Brigadista', 'Beta Dos',   'brigadista2.beta.h41qa@valdivia.cl', '+56941000009', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delNorte.id}::uuid,      true, 'en_mision',  CURRENT_DATE - interval '25 days'),
      (${IDS.usuarios.brigadistaBeta3}::uuid,'21410010-K', 'Brigadista', 'Beta Tres',  'brigadista3.beta.h41qa@valdivia.cl', '+56941000010', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delNorte.id}::uuid,      true, 'en_mision',  CURRENT_DATE - interval '25 days'),
      (${IDS.usuarios.brigadistaGamma1}::uuid,'21410011-1','Brigadista', 'Gamma Uno',  'brigadista1.gamma.h41qa@valdivia.cl','+56941000011', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delCosta.id}::uuid,      true, 'disponible', CURRENT_DATE - interval '20 days'),
      (${IDS.usuarios.brigadistaGamma2}::uuid,'21410012-2','Brigadista', 'Gamma Dos',  'brigadista2.gamma.h41qa@valdivia.cl','+56941000012', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delCosta.id}::uuid,      true, 'disponible', CURRENT_DATE - interval '20 days'),
      (${IDS.usuarios.brigadistaGamma3}::uuid,'21410013-3','Brigadista', 'Gamma Tres', 'brigadista3.gamma.h41qa@valdivia.cl','+56941000013', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delCosta.id}::uuid,      true, 'disponible', CURRENT_DATE - interval '20 days'),
      (${IDS.usuarios.brigadistaDelta1}::uuid,'21410014-4','Brigadista', 'Delta Uno',  'brigadista1.delta.h41qa@valdivia.cl','+56941000014', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delCalleCalle.id}::uuid, true, 'disponible', CURRENT_DATE - interval '20 days'),
      (${IDS.usuarios.brigadistaDelta2}::uuid,'21410015-5','Brigadista', 'Delta Dos',  'brigadista2.delta.h41qa@valdivia.cl','+56941000015', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delCalleCalle.id}::uuid, true, 'disponible', CURRENT_DATE - interval '20 days'),
      (${IDS.usuarios.brigadistaDelta3}::uuid,'21410016-6','Brigadista', 'Delta Tres', 'brigadista3.delta.h41qa@valdivia.cl','+56941000016', ${HASH_VALDIVIA_2026}, ${rolBrigadista.id}::uuid, ${delCalleCalle.id}::uuid, true, 'disponible', CURRENT_DATE - interval '20 days'),
      (${IDS.usuarios.patrulla}::uuid,        '21410017-7', 'Paula',      'H41 Patrulla','patrulla.h41qa@valdivia.cl',         '+56941000017', ${HASH_VALDIVIA_2026}, ${rolPatrulla.id}::uuid,  ${delNorte.id}::uuid,      true, 'disponible', CURRENT_DATE - interval '40 days')
    ON CONFLICT (id) DO UPDATE SET
      nombres = EXCLUDED.nombres,
      apellidos = EXCLUDED.apellidos,
      email = EXCLUDED.email,
      telefono = EXCLUDED.telefono,
      password_hash = EXCLUDED.password_hash,
      rol_id = EXCLUDED.rol_id,
      delegacion_id = EXCLUDED.delegacion_id,
      activo = true,
      estado_operativo = EXCLUDED.estado_operativo;
  `.execute(db);

  await sql`
    INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, disponible_terreno)
    VALUES
      (${IDS.personal.delegadoAlfa}::uuid,    ${IDS.usuarios.delegadoAlfa}::uuid,    ${delSur.id}::uuid,        'Mando y coordinación de cuadrilla',                   'Delegado de Cuadrilla', true),
      (${IDS.personal.delegadoBeta}::uuid,    ${IDS.usuarios.delegadoBeta}::uuid,    ${delNorte.id}::uuid,      'Mando y coordinación de cuadrilla',                   'Delegado de Cuadrilla', true),
      (${IDS.personal.delegadoGamma}::uuid,   ${IDS.usuarios.delegadoGamma}::uuid,   ${delCosta.id}::uuid,      'Mando y coordinación de cuadrilla',                   'Delegado de Cuadrilla', true),
      (${IDS.personal.delegadoDelta}::uuid,   ${IDS.usuarios.delegadoDelta}::uuid,   ${delCalleCalle.id}::uuid, 'Mando y coordinación de cuadrilla',                   'Delegado de Cuadrilla', true),
      (${IDS.personal.brigadistaAlfa1}::uuid, ${IDS.usuarios.brigadistaAlfa1}::uuid, ${delSur.id}::uuid,        'Despeje, bombeo y mitigación',                        'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaAlfa2}::uuid, ${IDS.usuarios.brigadistaAlfa2}::uuid, ${delSur.id}::uuid,        'Control de tránsito y perímetro',                     'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaAlfa3}::uuid, ${IDS.usuarios.brigadistaAlfa3}::uuid, ${delSur.id}::uuid,        'Operación de motobomba y achique',                    'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaBeta1}::uuid, ${IDS.usuarios.brigadistaBeta1}::uuid, ${delNorte.id}::uuid,      'Poda, tala y mitigación de riesgos',                  'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaBeta2}::uuid, ${IDS.usuarios.brigadistaBeta2}::uuid, ${delNorte.id}::uuid,      'Control de tránsito y perímetro',                     'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaBeta3}::uuid, ${IDS.usuarios.brigadistaBeta3}::uuid, ${delNorte.id}::uuid,      'Despeje, bombeo y mitigación',                        'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaGamma1}::uuid,${IDS.usuarios.brigadistaGamma1}::uuid,${delCosta.id}::uuid,      'Operación de motobomba y achique',                    'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaGamma2}::uuid,${IDS.usuarios.brigadistaGamma2}::uuid,${delCosta.id}::uuid,      'Despeje, bombeo y mitigación',                        'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaGamma3}::uuid,${IDS.usuarios.brigadistaGamma3}::uuid,${delCosta.id}::uuid,      'Control de tránsito y perímetro',                     'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaDelta1}::uuid,${IDS.usuarios.brigadistaDelta1}::uuid,${delCalleCalle.id}::uuid, 'Poda, tala y mitigación de riesgos',                  'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaDelta2}::uuid,${IDS.usuarios.brigadistaDelta2}::uuid,${delCalleCalle.id}::uuid, 'Despeje, bombeo y mitigación',                        'Brigadista Operativo',  true),
      (${IDS.personal.brigadistaDelta3}::uuid,${IDS.usuarios.brigadistaDelta3}::uuid,${delCalleCalle.id}::uuid, 'Control de tránsito y perímetro',                     'Brigadista Operativo',  true),
      (${IDS.personal.patrulla}::uuid,        ${IDS.usuarios.patrulla}::uuid,        ${delNorte.id}::uuid,      'Evaluación y diagnóstico rápido de emergencias',      'Inspector Técnico de Terreno', true)
    ON CONFLICT (usuario_id) DO UPDATE SET
      delegacion_id = EXCLUDED.delegacion_id,
      especialidad = EXCLUDED.especialidad,
      cargo = EXCLUDED.cargo,
      disponible_terreno = true;
  `.execute(db);

  // 2. Cuadrillas operativas. Alfa, Gamma y Delta quedan disponibles para asignación manual.
  await sql`
    INSERT INTO cuadrilla (
      id, nombre, estado, delegacion_id, usuario_delegado_id,
      creado_por_id, creado_en, actualizado_por_id, actualizado_en, eliminado_en, activo
    )
    VALUES
      (${IDS.cuadrillas.alfa}::uuid,  'Cuadrilla H41 Alfa',  'DISPONIBLE', ${delSur.id}::uuid,        ${IDS.usuarios.delegadoAlfa}::uuid,  ${admin.id}::uuid, CURRENT_TIMESTAMP - interval '10 days', ${admin.id}::uuid, CURRENT_TIMESTAMP, NULL, true),
      (${IDS.cuadrillas.beta}::uuid,  'Cuadrilla H41 Beta',  'EN_MISION',  ${delNorte.id}::uuid,      ${IDS.usuarios.delegadoBeta}::uuid,  ${admin.id}::uuid, CURRENT_TIMESTAMP - interval '10 days', ${admin.id}::uuid, CURRENT_TIMESTAMP, NULL, true),
      (${IDS.cuadrillas.gamma}::uuid, 'Cuadrilla H41 Gamma', 'DISPONIBLE', ${delCosta.id}::uuid,      ${IDS.usuarios.delegadoGamma}::uuid, ${admin.id}::uuid, CURRENT_TIMESTAMP - interval '9 days',  ${admin.id}::uuid, CURRENT_TIMESTAMP, NULL, true),
      (${IDS.cuadrillas.delta}::uuid, 'Cuadrilla H41 Delta', 'DISPONIBLE', ${delCalleCalle.id}::uuid, ${IDS.usuarios.delegadoDelta}::uuid, ${admin.id}::uuid, CURRENT_TIMESTAMP - interval '8 days',  ${admin.id}::uuid, CURRENT_TIMESTAMP, NULL, true)
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      estado = EXCLUDED.estado,
      delegacion_id = EXCLUDED.delegacion_id,
      usuario_delegado_id = EXCLUDED.usuario_delegado_id,
      actualizado_por_id = EXCLUDED.actualizado_por_id,
      actualizado_en = CURRENT_TIMESTAMP,
      eliminado_en = NULL,
      activo = true;
  `.execute(db);

  await sql`
    INSERT INTO cuadrilla_personal (cuadrilla_id, personal_id, activo)
    VALUES
      (${IDS.cuadrillas.alfa}::uuid,  ${IDS.personal.brigadistaAlfa1}::uuid,  true),
      (${IDS.cuadrillas.alfa}::uuid,  ${IDS.personal.brigadistaAlfa2}::uuid,  true),
      (${IDS.cuadrillas.alfa}::uuid,  ${IDS.personal.brigadistaAlfa3}::uuid,  true),
      (${IDS.cuadrillas.beta}::uuid,  ${IDS.personal.brigadistaBeta1}::uuid,  true),
      (${IDS.cuadrillas.beta}::uuid,  ${IDS.personal.brigadistaBeta2}::uuid,  true),
      (${IDS.cuadrillas.beta}::uuid,  ${IDS.personal.brigadistaBeta3}::uuid,  true),
      (${IDS.cuadrillas.gamma}::uuid, ${IDS.personal.brigadistaGamma1}::uuid, true),
      (${IDS.cuadrillas.gamma}::uuid, ${IDS.personal.brigadistaGamma2}::uuid, true),
      (${IDS.cuadrillas.gamma}::uuid, ${IDS.personal.brigadistaGamma3}::uuid, true),
      (${IDS.cuadrillas.delta}::uuid, ${IDS.personal.brigadistaDelta1}::uuid, true),
      (${IDS.cuadrillas.delta}::uuid, ${IDS.personal.brigadistaDelta2}::uuid, true),
      (${IDS.cuadrillas.delta}::uuid, ${IDS.personal.brigadistaDelta3}::uuid, true)
    ON CONFLICT (cuadrilla_id, personal_id) WHERE desvinculado_en IS NULL DO UPDATE SET
      activo = true;
  `.execute(db);

  // 3. Recursos logísticos y equipamiento de cada cuadrilla.
  await sql`
    INSERT INTO recurso (
      id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
      latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
    )
    VALUES
      (${IDS.recursos.vehiculoAlfa}::uuid,   'Camioneta Cuadrilla H41 Alfa (Patente: H41-A1)',   true,  'DISPONIBLE', 1,   0, 0, -39.8245, -73.2312, ST_SetSRID(ST_MakePoint(-73.2312, -39.8245), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delSur.id}::uuid,        ${admin.id}::uuid),
      (${IDS.recursos.motobombaAlfa}::uuid,  'Motobomba H41 Alfa 4 pulgadas',                   true,  'DISPONIBLE', 1,   0, 0, -39.8245, -73.2312, ST_SetSRID(ST_MakePoint(-73.2312, -39.8245), 4326), 'Motobomba para desagüe y achique',             ${delSur.id}::uuid,        ${admin.id}::uuid),
      (${IDS.recursos.vehiculoBeta}::uuid,   'Camioneta Cuadrilla H41 Beta (Patente: H41-B1)',   true,  'DISPONIBLE', 1,   0, 0, -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delNorte.id}::uuid,      ${admin.id}::uuid),
      (${IDS.recursos.motosierraBeta}::uuid, 'Motosierra H41 Beta',                             true,  'DISPONIBLE', 1,   0, 0, -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326), 'Motosierra para trozado de árboles caídos',    ${delNorte.id}::uuid,      ${admin.id}::uuid),
      (${IDS.recursos.vehiculoGamma}::uuid,  'Camioneta Cuadrilla H41 Gamma (Patente: H41-G1)',  true,  'DISPONIBLE', 1,   0, 0, -39.8451, -73.2812, ST_SetSRID(ST_MakePoint(-73.2812, -39.8451), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delCosta.id}::uuid,      ${admin.id}::uuid),
      (${IDS.recursos.motobombaGamma}::uuid, 'Motobomba H41 Gamma 4 pulgadas',                  true,  'DISPONIBLE', 1,   0, 0, -39.8451, -73.2812, ST_SetSRID(ST_MakePoint(-73.2812, -39.8451), 4326), 'Motobomba para desagüe y achique',             ${delCosta.id}::uuid,      ${admin.id}::uuid),
      (${IDS.recursos.vehiculoDelta}::uuid,  'Camioneta Cuadrilla H41 Delta (Patente: H41-D1)',  true,  'DISPONIBLE', 1,   0, 0, -39.8174, -73.2145, ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326), 'Vehículo de traslado de cuadrilla operativa', ${delCalleCalle.id}::uuid, ${admin.id}::uuid),
      (${IDS.recursos.motosierrasDelta}::uuid,'Motosierras de despeje H41',                     false, 'DISPONIBLE', 6,   0, 2, -39.8174, -73.2145, ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326), 'Motosierras para despeje de vías',             ${delCalleCalle.id}::uuid, ${admin.id}::uuid),
      (${IDS.recursos.sacos}::uuid,          'Sacos de Arena H41',                              false, 'DISPONIBLE', 300, 0, 50, -39.8142, -73.2459, ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326), 'Sacos para contención fluvial y protección domiciliaria', NULL, ${admin.id}::uuid),
      (${IDS.recursos.vehiculoPatrulla}::uuid,'Camioneta Patrulla H41 (Patente: H41-P1)',       true,  'DISPONIBLE', 1,   0, 0, -39.8052, -73.2295, ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326), 'Vehículo de inspección de patrulla verificadora', ${delNorte.id}::uuid,   ${admin.id}::uuid)
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
      ('f4190000-0000-4000-8000-000000000001', ${IDS.cuadrillas.alfa}::uuid,  ${IDS.recursos.vehiculoAlfa}::uuid,   1,  true),
      ('f4190000-0000-4000-8000-000000000002', ${IDS.cuadrillas.alfa}::uuid,  ${IDS.recursos.motobombaAlfa}::uuid,  1,  true),
      ('f4190000-0000-4000-8000-000000000003', ${IDS.cuadrillas.alfa}::uuid,  ${IDS.recursos.sacos}::uuid,          40, true),
      ('f4190000-0000-4000-8000-000000000004', ${IDS.cuadrillas.beta}::uuid,  ${IDS.recursos.vehiculoBeta}::uuid,   1,  true),
      ('f4190000-0000-4000-8000-000000000005', ${IDS.cuadrillas.beta}::uuid,  ${IDS.recursos.motosierraBeta}::uuid, 1,  true),
      ('f4190000-0000-4000-8000-000000000006', ${IDS.cuadrillas.beta}::uuid,  ${IDS.recursos.sacos}::uuid,          30, true),
      ('f4190000-0000-4000-8000-000000000007', ${IDS.cuadrillas.gamma}::uuid, ${IDS.recursos.vehiculoGamma}::uuid,  1,  true),
      ('f4190000-0000-4000-8000-000000000008', ${IDS.cuadrillas.gamma}::uuid, ${IDS.recursos.motobombaGamma}::uuid, 1,  true),
      ('f4190000-0000-4000-8000-000000000009', ${IDS.cuadrillas.gamma}::uuid, ${IDS.recursos.sacos}::uuid,          30, true),
      ('f4190000-0000-4000-8000-000000000010', ${IDS.cuadrillas.delta}::uuid, ${IDS.recursos.vehiculoDelta}::uuid,  1,  true),
      ('f4190000-0000-4000-8000-000000000011', ${IDS.cuadrillas.delta}::uuid, ${IDS.recursos.motosierrasDelta}::uuid, 2, true),
      ('f4190000-0000-4000-8000-000000000012', ${IDS.cuadrillas.delta}::uuid, ${IDS.recursos.sacos}::uuid,          20, true)
    ON CONFLICT (id) DO UPDATE SET
      cantidad_asignada = EXCLUDED.cantidad_asignada,
      activo = true;
  `.execute(db);

  // 4. Patrulla que realizó la verificación previa del incidente listo para rechazo.
  await sql`
    INSERT INTO patrulla_verificadora (
      id, codigo, nombre, estado, delegacion_id, usuario_lider_id, vehiculo_id,
      latitud, longitud, ubicacion, activo, eliminado_en, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.patrulla}::uuid,
      'PV-H41-QA-01',
      'Patrulla Verificadora H41',
      'DISPONIBLE',
      ${delNorte.id}::uuid,
      ${IDS.usuarios.patrulla}::uuid,
      ${IDS.recursos.vehiculoPatrulla}::uuid,
      -39.8052,
      -73.2295,
      ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
      true,
      NULL,
      CURRENT_TIMESTAMP - interval '5 days',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      estado = EXCLUDED.estado,
      delegacion_id = EXCLUDED.delegacion_id,
      usuario_lider_id = EXCLUDED.usuario_lider_id,
      vehiculo_id = EXCLUDED.vehiculo_id,
      activo = true,
      eliminado_en = NULL,
      actualizado_en = CURRENT_TIMESTAMP;
  `.execute(db);

  await sql`
    INSERT INTO patrulla_personal (patrulla_id, personal_id, rol_en_patrulla)
    VALUES (${IDS.patrulla}::uuid, ${IDS.personal.patrulla}::uuid, 'LIDER')
    ON CONFLICT (patrulla_id, personal_id) DO UPDATE SET rol_en_patrulla = 'LIDER';
  `.execute(db);

  // 5. Informante e incidentes del escenario.
  await sql`
    INSERT INTO informante (id, rut, nombre, telefono)
    VALUES (${IDS.informante}::uuid, '21419999-9', 'Vecina Sector H41', '+56941009999')
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, folio, informante_id, tipo_incidente_id,
      delegacion_id, fuente_incidente_id, tipo_afectacion, descripcion,
      direccion_texto, latitud, longitud, ubicacion, estado, prioridad,
      requiere_asistencia_social, fuente_origen, creado_por_id, encargado_id,
      creado_en, actualizado_en
    )
    VALUES
      (
        ${IDS.incidentes.despachado}::uuid,
        'INC-H41-QA-001',
        '41000001',
        'FOL-H41-0001',
        ${IDS.informante}::uuid,
        ${tipoIncidente.id}::uuid,
        ${delNorte.id}::uuid,
        ${fuenteTerreno.id}::uuid,
        ${tipoIncidente.nombre},
        'Anegamiento severo en acceso a viviendas con riesgo de ingreso de agua a dormitorios. Verificación previa completada y cuadrilla despachada.',
        'Pasaje Los Canelos 145, Sector Las Ánimas, Valdivia',
        -39.8052,
        -73.2295,
        ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
        'EN_ATENCION',
        'CRITICA',
        true,
        'FUNCIONARIO_TERRENO',
        ${admin.id}::uuid,
        ${encargado.id}::uuid,
        CURRENT_TIMESTAMP - interval '3 hours',
        CURRENT_TIMESTAMP - interval '30 minutes'
      ),
      (
        ${IDS.incidentes.reportadoSur}::uuid,
        'INC-H41-QA-002',
        '41000002',
        'FOL-H41-0002',
        ${IDS.informante}::uuid,
        ${tipoIncidente.id}::uuid,
        ${delSur.id}::uuid,
        ${fuenteTerreno.id}::uuid,
        ${tipoIncidente.nombre},
        'Acumulación de aguas lluvias en calzada y vereda. Disponible para asignación manual de cuadrilla desde el Centro de Mando.',
        'Av. Ramón Picarte 1850, Sector Regional, Valdivia',
        -39.8245,
        -73.2356,
        ST_SetSRID(ST_MakePoint(-73.2356, -39.8245), 4326),
        'REPORTADO',
        'ALTA',
        false,
        'FUNCIONARIO_TERRENO',
        ${admin.id}::uuid,
        ${encargado.id}::uuid,
        CURRENT_TIMESTAMP - interval '20 minutes',
        CURRENT_TIMESTAMP - interval '20 minutes'
      ),
      (
        ${IDS.incidentes.reportadoCosta}::uuid,
        'INC-H41-QA-003',
        '41000003',
        'FOL-H41-0003',
        ${IDS.informante}::uuid,
        ${tipoIncidente.id}::uuid,
        ${delCosta.id}::uuid,
        ${fuenteTerreno.id}::uuid,
        ${tipoIncidente.nombre},
        'Desborde menor en camino costero con anegamiento de berma. Disponible para asignación manual de cuadrilla desde el Centro de Mando.',
        'Ruta T-350 Km 8, Camino a Niebla, Valdivia',
        -39.8590,
        -73.3750,
        ST_SetSRID(ST_MakePoint(-73.3750, -39.8590), 4326),
        'REPORTADO',
        'MEDIA',
        false,
        'FUNCIONARIO_TERRENO',
        ${admin.id}::uuid,
        ${encargado.id}::uuid,
        CURRENT_TIMESTAMP - interval '10 minutes',
        CURRENT_TIMESTAMP - interval '10 minutes'
      )
    ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      prioridad = EXCLUDED.prioridad,
      descripcion = EXCLUDED.descripcion,
      actualizado_en = EXCLUDED.actualizado_en;
  `.execute(db);

  // 6. Verificación previa completada y misión de cuadrilla DESPACHADA (lista para rechazo).
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en, actualizado_en
    )
    VALUES
      (
        ${IDS.misiones.verificacionCompletada}::uuid,
        'MIS-H41-QA-002',
        'Verificación técnica previa de anegamiento en Las Ánimas',
        'Patrulla verificadora evaluó el terreno y confirmó el escalamiento a cuadrilla operativa.',
        'VERIFICACION',
        'COMPLETADA',
        'CRITICA',
        ${IDS.incidentes.despachado}::uuid,
        ${IDS.patrulla}::uuid,
        NULL,
        ${encargado.id}::uuid,
        ${admin.id}::uuid,
        CURRENT_TIMESTAMP - interval '2 hours',
        CURRENT_TIMESTAMP - interval '90 minutes',
        CURRENT_TIMESTAMP - interval '2 hours',
        CURRENT_TIMESTAMP - interval '90 minutes'
      ),
      (
        ${IDS.misiones.cuadrillaDespachada}::uuid,
        'MIS-H41-QA-001',
        'Atención táctica de anegamiento en Las Ánimas',
        'Cuadrilla despachada para contención, achique y resguardo de viviendas afectadas.',
        'ATENCION_CUADRILLA',
        'DESPACHADA',
        'CRITICA',
        ${IDS.incidentes.despachado}::uuid,
        NULL,
        ${IDS.cuadrillas.beta}::uuid,
        ${encargado.id}::uuid,
        ${admin.id}::uuid,
        NULL,
        NULL,
        CURRENT_TIMESTAMP - interval '30 minutes',
        CURRENT_TIMESTAMP - interval '30 minutes'
      )
    ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      prioridad = EXCLUDED.prioridad,
      incidente_id = EXCLUDED.incidente_id,
      patrulla_id = EXCLUDED.patrulla_id,
      cuadrilla_id = EXCLUDED.cuadrilla_id,
      fecha_inicio = EXCLUDED.fecha_inicio,
      fecha_cierre = EXCLUDED.fecha_cierre,
      actualizado_en = CURRENT_TIMESTAMP;
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
      ${IDS.reporteTerreno}::uuid,
      ${IDS.misiones.verificacionCompletada}::uuid,
      ${IDS.usuarios.patrulla}::uuid,
      'Anegamiento severo con riesgo de ingreso de agua a dormitorios. Se confirma necesidad de cuadrilla operativa con motobomba.',
      'Perímetro delimitado, verificación de niveles de agua y coordinación con encargado de turno.',
      true,
      'Ingreso de agua en dos viviendas y deterioro de acceso peatonal.',
      'Se recomienda despacho inmediato de cuadrilla con equipamiento de achique.',
      4,
      'EN_VERIFICACION',
      1,
      false,
      'CRITICA',
      'CRITICA',
      'Se mantiene prioridad CRITICA por riesgo de inundación de viviendas habitadas.',
      ${JSON.stringify({
        familiasAfectadas: 2,
        nucleoFamiliarTotal: 6,
        requiereAsistenciaSocial: true,
        riesgosActivos: { riesgoElectrico: false, riesgoEstructural: false, riesgoQuimicoSanitario: false, aislamientoVial: false },
      })}::jsonb,
      CURRENT_TIMESTAMP - interval '95 minutes',
      CURRENT_TIMESTAMP - interval '90 minutes'
    )
    ON CONFLICT (id) DO UPDATE SET
      resumen_tecnico = EXCLUDED.resumen_tecnico,
      prioridad_asignada = EXCLUDED.prioridad_asignada,
      actualizado_en = CURRENT_TIMESTAMP;
  `.execute(db);

  await sql`
    INSERT INTO mision_hito (
      id, mision_id, hito, descripcion, registrado_por_id, latitud, longitud, creado_en
    )
    VALUES
      (
        ${IDS.hitos.evaluacion}::uuid,
        ${IDS.misiones.verificacionCompletada}::uuid,
        'EVALUACION_COMPLETADA',
        'Reporte de terreno registrado. Patrulla confirma necesidad de escalamiento a cuadrilla operativa.',
        ${IDS.usuarios.patrulla}::uuid,
        -39.8052,
        -73.2295,
        CURRENT_TIMESTAMP - interval '90 minutes'
      ),
      (
        ${IDS.hitos.despacho}::uuid,
        ${IDS.misiones.cuadrillaDespachada}::uuid,
        'CUADRILLA_DESPACHADA',
        'Cuadrilla H41 Beta despachada a terreno para atención táctica del incidente.',
        ${encargado.id}::uuid,
        -39.8052,
        -73.2295,
        CURRENT_TIMESTAMP - interval '30 minutes'
      )
    ON CONFLICT (id) DO NOTHING;
  `.execute(db);

  console.log("");
  console.log("Fixture HU-41 sembrado correctamente.");
  console.log("────────────────────────────────────────────────────────────");
  console.log(` Contraseña de todos los usuarios: ${PASSWORD_H41}`);
  console.log("");
  console.log(" Cuadrillas DISPONIBLES para asignación manual:");
  console.log(`   Alfa  : delegado.alfa.h41qa@valdivia.cl  (${IDS.cuadrillas.alfa})`);
  console.log(`   Gamma : delegado.gamma.h41qa@valdivia.cl (${IDS.cuadrillas.gamma})`);
  console.log(`   Delta : delegado.delta.h41qa@valdivia.cl (${IDS.cuadrillas.delta})`);
  console.log("");
  console.log(" Rechazo inmediato desde la PWA:");
  console.log(`   Cuadrilla Beta : delegado.beta.h41qa@valdivia.cl`);
  console.log(`   Misión         : MIS-H41-QA-001 (${IDS.misiones.cuadrillaDespachada})`);
  console.log(`   Incidente      : INC-H41-QA-001 (${IDS.incidentes.despachado})`);
  console.log("   Esperado       : misión RECHAZADA, cuadrilla DISPONIBLE e incidente VERIFICANDO.");
  console.log("");
  console.log(" Incidentes libres para asignar cuadrilla:");
  console.log(`   INC-H41-QA-002 (${IDS.incidentes.reportadoSur})`);
  console.log(`   INC-H41-QA-003 (${IDS.incidentes.reportadoCosta})`);
  console.log("────────────────────────────────────────────────────────────");
}

const EJECUTADO_DIRECTAMENTE =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (EJECUTADO_DIRECTAMENTE || process.argv[1]?.includes("seed/h41")) {
  sembrarFixtureH41({ cleanOnly: process.argv.includes("--clean") })
    .then(async () => {
      await db.destroy();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error("Error al sembrar el fixture HU-41:", error);
      await db.destroy();
      process.exit(1);
    });
}
