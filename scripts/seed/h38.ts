import {
  HASH_VALDIVIA_2026,
  db,
  sql,
  resolverDelegacion,
  resolverFuenteIncidente,
  resolverRol,
  resolverTipoIncidente,
  resolverUsuario,
} from "./core";

/**
 * Fixture de datos QA para HU-38 — Evaluar terreno y asignar/modificar prioridad.
 *
 * Deja la base lista para probar el flujo completo desde la PWA de Patrulla:
 *   1. Usuario PATRULLA_VERIFICADORA con contraseña institucional.
 *   2. Patrulla activa liderada por ese usuario.
 *   3. Caso A: incidente en VERIFICANDO con misión EN_CURSO y sin reporte previo.
 *   4. Caso B: incidente en VERIFICANDO con misión EN_CURSO y reporte de evaluación
 *      versión 1 (sugerida ALTA, asignada CRITICA) para probar rectificación.
 *
 * Uso:
 *   npm run seed -- --only=h38
 *   npm run seed -- --only=h38 --clean
 */

const IDS = {
  usuario: "d3800000-0000-4000-8000-000000000001",
  personal: "c3800000-0000-4000-8000-000000000001",
  patrulla: "e3800000-0000-4000-8000-000000000001",
  informante: "b3800000-0000-4000-8000-000000000001",
  incidentes: {
    inicial: "a3800000-0000-4000-8000-000000000001",
    rectificacion: "a3800000-0000-4000-8000-000000000002",
  },
  misiones: {
    inicial: "f3800000-0000-4000-8000-000000000001",
    rectificacion: "f3800000-0000-4000-8000-000000000002",
  },
  reporteRectificacion: "e3800000-0000-4000-8000-000000000001",
  hitos: {
    aceptadaInicial: "b3800000-0000-4000-8000-000000000001",
    transitoInicial: "b3800000-0000-4000-8000-000000000002",
    aceptadaRectificacion: "b3800000-0000-4000-8000-000000000003",
    prioridadAsignada: "b3800000-0000-4000-8000-000000000004",
  },
} as const;

const EMAIL_H38 = "patrulla.h38@valdivia.cl";
const PASSWORD_H38 = "Valdivia2026!";

const INCIDENTES_IDS = Object.values(IDS.incidentes);
const MISIONES_IDS = Object.values(IDS.misiones);

async function limpiarFixtureH38(): Promise<void> {
  await sql`
    DELETE FROM notificaciones_mision
    WHERE mision_id IN (${sql.join(MISIONES_IDS.map((id) => sql`${id}::uuid`))})
       OR patrulla_id = ${IDS.patrulla}::uuid
  `.execute(db);

  await sql`
    DELETE FROM adjunto
    WHERE reporte_terreno_id IN (
      SELECT id FROM reporte_terreno WHERE mision_id IN (
        ${sql.join(MISIONES_IDS.map((id) => sql`${id}::uuid`))}
      )
    )
       OR incidente_id IN (
        ${sql.join(INCIDENTES_IDS.map((id) => sql`${id}::uuid`))}
      )
  `.execute(db);

  await sql`
    DELETE FROM mision_hito
    WHERE mision_id IN (${sql.join(MISIONES_IDS.map((id) => sql`${id}::uuid`))})
       OR registrado_por_id = ${IDS.usuario}::uuid
  `.execute(db);

  await sql`
    DELETE FROM reporte_terreno
    WHERE mision_id IN (${sql.join(MISIONES_IDS.map((id) => sql`${id}::uuid`))})
       OR evaluador_id = ${IDS.usuario}::uuid
  `.execute(db);

  await sql`
    DELETE FROM mision
    WHERE id IN (${sql.join(MISIONES_IDS.map((id) => sql`${id}::uuid`))})
       OR incidente_id IN (${sql.join(INCIDENTES_IDS.map((id) => sql`${id}::uuid`))})
  `.execute(db);

  await sql`
    DELETE FROM incidente
    WHERE id IN (${sql.join(INCIDENTES_IDS.map((id) => sql`${id}::uuid`))})
  `.execute(db);

  await sql`
    DELETE FROM patrulla_personal
    WHERE patrulla_id = ${IDS.patrulla}::uuid
       OR personal_id = ${IDS.personal}::uuid
  `.execute(db);

  await sql`
    DELETE FROM patrulla_verificadora
    WHERE id = ${IDS.patrulla}::uuid
       OR lower(codigo) = 'pv-h38-01'
  `.execute(db);

  await sql`
    DELETE FROM personal
    WHERE id = ${IDS.personal}::uuid
       OR usuario_id = ${IDS.usuario}::uuid
  `.execute(db);

  await sql`
    DELETE FROM informante
    WHERE id = ${IDS.informante}::uuid
  `.execute(db);

  await sql`
    DELETE FROM usuario
    WHERE id = ${IDS.usuario}::uuid
       OR email = ${EMAIL_H38}
  `.execute(db);
}

async function asegurarPermisoPatrulla(adminId: string, rolPatrullaId: string): Promise<void> {
  await sql`
    INSERT INTO rol_permiso (rol_id, permiso_id, asignado_por_id)
    SELECT ${rolPatrullaId}::uuid, p.id, ${adminId}::uuid
    FROM permiso p
    WHERE p.codigo = 'misiones:terreno:verificar'
    ON CONFLICT DO NOTHING
  `.execute(db);
}

export async function sembrarFixtureH38(
  options: { cleanOnly?: boolean } = {}
): Promise<void> {
  const { cleanOnly = false } = options;

  console.log("Iniciando fixture de pruebas HU-38 (evaluar terreno / asignar prioridad)...");

  const [delegacion, rolPatrulla, admin, encargado, tipoIncidente, fuente] = await Promise.all([
    resolverDelegacion("DEL_SUR"),
    resolverRol("PATRULLA_VERIFICADORA"),
    resolverUsuario("admin@valdivia.cl"),
    resolverUsuario("encargado@valdivia.cl"),
    resolverTipoIncidente("inundac", "anegam"),
    resolverFuenteIncidente("FUNCIONARIO_TERRENO"),
  ]);

  await limpiarFixtureH38();
  console.log("Fixture H38 anterior limpiado.");

  if (cleanOnly) {
    console.log("Modo --clean: no se siembran datos nuevos de H38.");
    return;
  }

  // 1. Usuario patrulla con credenciales de desarrollo.
  await sql`
    INSERT INTO usuario (
      id, rut, nombres, apellidos, email, password_hash, rol_id, delegacion_id,
      activo, estado_operativo, fecha_ingreso
    )
    VALUES (
      ${IDS.usuario}::uuid,
      '19380001-1',
      'Paula',
      'H38 Verificadora',
      ${EMAIL_H38},
      ${HASH_VALDIVIA_2026},
      ${rolPatrulla.id}::uuid,
      ${delegacion.id}::uuid,
      true,
      'disponible',
      CURRENT_DATE - interval '30 days'
    )
  `.execute(db);

  await sql`
    INSERT INTO personal (
      id, usuario_id, delegacion_id, especialidad, cargo, disponible_terreno
    )
    VALUES (
      ${IDS.personal}::uuid,
      ${IDS.usuario}::uuid,
      ${delegacion.id}::uuid,
      'Evaluación técnica de emergencias y priorización en terreno',
      'Inspector Técnico de Terreno',
      true
    )
  `.execute(db);

  // 2. Patrulla verificadora liderada por el usuario H38.
  await sql`
    INSERT INTO patrulla_verificadora (
      id, codigo, nombre, estado, delegacion_id, usuario_lider_id,
      latitud, longitud, ubicacion, activo, eliminado_en, creado_en, actualizado_en
    )
    VALUES (
      ${IDS.patrulla}::uuid,
      'PV-H38-01',
      'Patrulla Verificadora H38',
      'DISPONIBLE',
      ${delegacion.id}::uuid,
      ${IDS.usuario}::uuid,
      -39.8142,
      -73.2459,
      ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
      true,
      NULL,
      CURRENT_TIMESTAMP - interval '2 days',
      CURRENT_TIMESTAMP
    )
  `.execute(db);

  await sql`
    INSERT INTO patrulla_personal (patrulla_id, personal_id, rol_en_patrulla)
    VALUES (${IDS.patrulla}::uuid, ${IDS.personal}::uuid, 'LIDER')
    ON CONFLICT (patrulla_id, personal_id)
    DO UPDATE SET rol_en_patrulla = 'LIDER'
  `.execute(db);

  await asegurarPermisoPatrulla(admin.id, rolPatrulla.id);

  // 3. Informante del fixture.
  await sql`
    INSERT INTO informante (id, rut, nombre, telefono)
    VALUES (
      ${IDS.informante}::uuid,
      '19380002-2',
      'Vecina Sector H38',
      '+56938000001'
    )
  `.execute(db);

  // 4. Incidentes: caso A (sin evaluación) y caso B (con evaluación previa).
  await sql`
    INSERT INTO incidente (
      id, codigo, codigo_seguimiento, folio, informante_id, tipo_incidente_id,
      delegacion_id, fuente_incidente_id, tipo_afectacion, descripcion,
      direccion_texto, latitud, longitud, ubicacion, estado, prioridad,
      prioridad_sugerida, justificacion_prioridad, requiere_asistencia_social,
      fuente_origen, creado_por_id, encargado_id, creado_en, actualizado_en
    )
    VALUES
      (
        ${IDS.incidentes.inicial}::uuid,
        'INC-H38-QA-001',
        '38000001',
        'FOL-H38-0001',
        ${IDS.informante}::uuid,
        ${tipoIncidente.id}::uuid,
        ${delegacion.id}::uuid,
        ${fuente.id}::uuid,
        'Inundación',
        'Anegamiento de patio y acceso principal por acumulación de aguas lluvias. Familia solicita evaluación técnica en terreno.',
        'Pasaje Los Canelos 145, Sector Guacamayo, Valdivia',
        -39.8620,
        -73.2310,
        ST_SetSRID(ST_MakePoint(-73.2310, -39.8620), 4326),
        'VERIFICANDO',
        'MEDIA',
        NULL,
        NULL,
        false,
        'FUNCIONARIO_TERRENO',
        ${admin.id}::uuid,
        ${encargado.id}::uuid,
        CURRENT_TIMESTAMP - interval '20 minutes',
        CURRENT_TIMESTAMP - interval '10 minutes'
      ),
      (
        ${IDS.incidentes.rectificacion}::uuid,
        'INC-H38-QA-002',
        '38000002',
        'FOL-H38-0002',
        ${IDS.informante}::uuid,
        ${tipoIncidente.id}::uuid,
        ${delegacion.id}::uuid,
        ${fuente.id}::uuid,
        'Inundación',
        'Filtración severa en dormitorio principal con riesgo eléctrico activo. Adulto mayor electrodependiente en el hogar.',
        'Calle Balmaceda 1245, Sector Collico, Valdivia',
        -39.8174,
        -73.2145,
        ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326),
        'VERIFICANDO',
        'CRITICA',
        'ALTA',
        'Se eleva a CRITICA por riesgo eléctrico activo y adulto mayor electrodependiente.',
        true,
        'FUNCIONARIO_TERRENO',
        ${admin.id}::uuid,
        ${encargado.id}::uuid,
        CURRENT_TIMESTAMP - interval '45 minutes',
        CURRENT_TIMESTAMP - interval '15 minutes'
      )
  `.execute(db);

  // 5. Misiones de verificación en curso.
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      incidente_id, patrulla_id, cuadrilla_id, encargado_id, creado_por_id,
      fecha_inicio, fecha_cierre, creado_en, actualizado_en
    )
    VALUES
      (
        ${IDS.misiones.inicial}::uuid,
        'MIS-H38-0001',
        'Evaluación inicial de anegamiento en Guacamayo',
        'Evaluar condiciones de vivienda, núcleo familiar y riesgos activos para asignar prioridad oficial.',
        'VERIFICACION',
        'EN_CURSO',
        'MEDIA',
        ${IDS.incidentes.inicial}::uuid,
        ${IDS.patrulla}::uuid,
        NULL,
        ${encargado.id}::uuid,
        ${admin.id}::uuid,
        CURRENT_TIMESTAMP - interval '10 minutes',
        NULL,
        CURRENT_TIMESTAMP - interval '15 minutes',
        CURRENT_TIMESTAMP - interval '10 minutes'
      ),
      (
        ${IDS.misiones.rectificacion}::uuid,
        'MIS-H38-0002',
        'Evaluación y rectificación de prioridad en Collico',
        'Revisar evaluación previa, confirmar riesgo eléctrico y rectificar prioridad si corresponde.',
        'VERIFICACION',
        'EN_CURSO',
        'CRITICA',
        ${IDS.incidentes.rectificacion}::uuid,
        ${IDS.patrulla}::uuid,
        NULL,
        ${encargado.id}::uuid,
        ${admin.id}::uuid,
        CURRENT_TIMESTAMP - interval '30 minutes',
        NULL,
        CURRENT_TIMESTAMP - interval '35 minutes',
        CURRENT_TIMESTAMP - interval '15 minutes'
      )
  `.execute(db);

  // 6. Reporte de evaluación versión 1 para el caso B.
  const detallesEvaluacion = {
    familias: [
      {
        id: "fam-h38-1",
        referencia: "Familia Soto",
        nucleoFamiliarTotal: 4,
        cantidadNinos: 1,
        cantidadAdultosMayores: 1,
        personasDiscapacitadas: 1,
        personasElectrodependientes: 1,
        mascotasAfectadas: 0,
        nivelCompromisoVivienda: "GRAVE_INHABITABLE",
        requiereAsistenciaSocial: true,
      },
    ],
    nucleoFamiliarTotal: 4,
    familiasAfectadas: 1,
    cantidadNinos: 1,
    cantidadAdultosMayores: 1,
    personasDiscapacitadas: 1,
    personasElectrodependientes: 1,
    mascotasAfectadas: 0,
    viviendasAfectadas: 1,
    nivelCompromisoVivienda: "GRAVE_INHABITABLE",
    requiereEvacuacion: true,
    requiereAsistenciaSocial: true,
    requiereApoyoAdicional: true,
    riesgosActivos: {
      riesgoElectrico: true,
      riesgoEstructural: true,
      riesgoQuimicoSanitario: false,
      aislamientoVial: false,
    },
    accionesRealizadas:
      "Se delimitó el perímetro, se solicitó corte de suministro eléctrico y se coordinó albergue transitorio.",
    danosEstimados:
      "Filtración activa sobre dormitorio, tablero eléctrico comprometido y muro con humedad severa.",
    detallesAdicionales:
      "Hogar con adulto mayor electrodependiente y niño menor de 5 años.",
    versionReporte: 1,
    esRectificacion: false,
    prioridadSugerida: "ALTA",
    prioridadAsignada: "CRITICA",
    modificoPrioridadSugerida: true,
    justificacionPrioridad:
      "Se eleva a CRITICA por riesgo eléctrico activo y adulto mayor electrodependiente.",
    puntajeTotal: 85,
    factoresGatillantes: [
      "Riesgo eléctrico activo",
      "Vivienda grave-inhabitable",
      "Persona electrodependiente",
    ],
  };

  await sql`
    INSERT INTO reporte_terreno (
      id, mision_id, evaluador_id, resumen_tecnico, acciones_realizadas,
      requiere_apoyo_adicional, danos_estimados, observaciones, personas_afectadas,
      estado_terreno, version_reporte, es_rectificacion, prioridad_sugerida,
      prioridad_asignada, justificacion_prioridad, detalles_evaluacion,
      creado_en, actualizado_en
    )
    VALUES (
      ${IDS.reporteRectificacion}::uuid,
      ${IDS.misiones.rectificacion}::uuid,
      ${IDS.usuario}::uuid,
      'Reporte de Evaluación #1 (Inicial): prioridad sugerida ALTA, asignada CRITICA. ' ||
      'Se constata filtración severa, riesgo eléctrico y adulto mayor electrodependiente.',
      'Perímetro delimitado, corte de suministro solicitado y coordinación de albergue.',
      true,
      'Filtración activa sobre dormitorio y tablero eléctrico comprometido.',
      'Hogar con adulto mayor electrodependiente y niño menor de 5 años.',
      4,
      'EN_VERIFICACION',
      1,
      false,
      'ALTA',
      'CRITICA',
      'Se eleva a CRITICA por riesgo eléctrico activo y adulto mayor electrodependiente.',
      ${JSON.stringify(detallesEvaluacion)}::jsonb,
      CURRENT_TIMESTAMP - interval '15 minutes',
      CURRENT_TIMESTAMP - interval '15 minutes'
    )
  `.execute(db);

  // 7. Hitos de trazabilidad para la PWA y el Centro de Mando.
  await sql`
    INSERT INTO mision_hito (
      id, mision_id, hito, descripcion, registrado_por_id,
      latitud, longitud, creado_en
    )
    VALUES
      (
        ${IDS.hitos.aceptadaInicial}::uuid,
        ${IDS.misiones.inicial}::uuid,
        'MISION_ACEPTADA',
        'Patrulla Verificadora H38 aceptó la misión de verificación.',
        ${IDS.usuario}::uuid,
        -39.8620,
        -73.2310,
        CURRENT_TIMESTAMP - interval '9 minutes'
      ),
      (
        ${IDS.hitos.transitoInicial}::uuid,
        ${IDS.misiones.inicial}::uuid,
        'PATRULLA_EN_TRANSITO',
        'Patrulla en desplazamiento hacia Pasaje Los Canelos 145.',
        ${IDS.usuario}::uuid,
        -39.8620,
        -73.2310,
        CURRENT_TIMESTAMP - interval '8 minutes'
      ),
      (
        ${IDS.hitos.aceptadaRectificacion}::uuid,
        ${IDS.misiones.rectificacion}::uuid,
        'MISION_ACEPTADA',
        'Patrulla Verificadora H38 aceptó la misión de evaluación y rectificación.',
        ${IDS.usuario}::uuid,
        -39.8174,
        -73.2145,
        CURRENT_TIMESTAMP - interval '29 minutes'
      ),
      (
        ${IDS.hitos.prioridadAsignada}::uuid,
        ${IDS.misiones.rectificacion}::uuid,
        'PRIORIDAD_ASIGNADA',
        'Reporte de evaluación #1: Prioridad asignada en terreno a CRITICA (Sugerida: ALTA). ' ||
        'Justificación: Se eleva a CRITICA por riesgo eléctrico activo y adulto mayor electrodependiente.',
        ${IDS.usuario}::uuid,
        -39.8174,
        -73.2145,
        CURRENT_TIMESTAMP - interval '15 minutes'
      )
  `.execute(db);

  console.log("");
  console.log("Fixture HU-38 sembrado correctamente.");
  console.log("────────────────────────────────────────────────────────────");
  console.log(` Usuario      : ${EMAIL_H38} / ${PASSWORD_H38}`);
  console.log(" Rol          : PATRULLA_VERIFICADORA");
  console.log(` Patrulla     : PV-H38-01 (${IDS.patrulla})`);
  console.log("");
  console.log(" Caso A — evaluación inicial (sin reporte previo):");
  console.log(`   Incidente : INC-H38-QA-001 (${IDS.incidentes.inicial})`);
  console.log(`   Misión    : MIS-H38-0001 (${IDS.misiones.inicial})`);
  console.log("   Esperado  : la PWA muestra el formulario H38 vacío.");
  console.log("");
  console.log(" Caso B — rectificación (con reporte versión 1):");
  console.log(`   Incidente : INC-H38-QA-002 (${IDS.incidentes.rectificacion})`);
  console.log(`   Misión    : MIS-H38-0002 (${IDS.misiones.rectificacion})`);
  console.log("   Esperado  : la PWA muestra la evaluación previa (sugerida ALTA, asignada CRITICA)");
  console.log("               y permite reenviar una rectificación (versión 2).");
  console.log("");
  console.log(" Endpoint  : PATCH /api/incidentes/{id}/prioridad");
  console.log("────────────────────────────────────────────────────────────");
}

const EJECUTADO_DIRECTAMENTE =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (EJECUTADO_DIRECTAMENTE || process.argv[1]?.includes("seed/h38")) {
  sembrarFixtureH38({ cleanOnly: process.argv.includes("--clean") })
    .then(async () => {
      await db.destroy();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error("Error al sembrar el fixture HU-38:", error);
      await db.destroy();
      process.exit(1);
    });
}
