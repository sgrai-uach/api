import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";

export async function sembrarPuntosCriticos() {
  console.log("Iniciando inserción de puntos críticos de prueba...");

  // 1. Obtener delegaciones
  const delegaciones = await db.selectFrom("delegacion").selectAll().execute();
  const delNorte = delegaciones.find((d) => d.codigo === "DEL_NORTE")?.id || "30000000-0000-4000-8000-000000000001";
  const delSur = delegaciones.find((d) => d.codigo === "DEL_SUR")?.id || "30000000-0000-4000-8000-000000000002";
  const delCosta = delegaciones.find((d) => d.codigo === "DEL_COSTA")?.id || "30000000-0000-4000-8000-000000000003";
  const delCalleCalle = delegaciones.find((d) => d.codigo === "DEL_CALLE_CALLE")?.id || "30000000-0000-4000-8000-000000000004";

  // 2. Obtener un usuario creador (Admin o Encargado)
  const usuario = await db.selectFrom("usuario").selectAll().executeTakeFirst();
  const usuarioId = usuario?.id || "00000000-0000-4000-8000-000000000001";

  // 3. Puntos Críticos de prueba
  const puntosCriticos = [
    {
      id: "40000000-0000-4000-8000-000000000001",
      codigo: "PC-ANG-01",
      nombre: "Sector Humedal Angachilla - Pasaje Los Robles",
      descripcion: "Zona baja susceptible a inundación fluvial y anegamiento en periodo invernal",
      tipo_riesgo: "Inundación y anegamiento fluvial",
      prioridad: "ALTA",
      latitud: -39.8456,
      longitud: -73.2389,
      delegacion_id: delSur,
      activo: true,
    },
    {
      id: "40000000-0000-4000-8000-000000000002",
      codigo: "PC-COL-02",
      nombre: "Sector Collico - Borde Río Calle Calle",
      descripcion: "Sector ribereño con riesgo de desborde y anegamiento de calzada por crecida de marea",
      tipo_riesgo: "Desborde de cauce e inundación de calzada",
      prioridad: "MEDIA",
      latitud: -39.8182,
      longitud: -73.2120,
      delegacion_id: delCalleCalle,
      activo: true,
    },
    {
      id: "40000000-0000-4000-8000-000000000003",
      codigo: "PC-NIE-03",
      nombre: "Camino a Niebla - Curva Los Pelúes",
      descripcion: "Ladera de cerro con historial de remoción en masa y caída de árboles sobre la ruta T-350",
      tipo_riesgo: "Remoción en masa y deslizamiento de ladera",
      prioridad: "CRITICA",
      latitud: -39.8510,
      longitud: -73.3850,
      delegacion_id: delCosta,
      activo: true,
    },
    {
      id: "40000000-0000-4000-8000-000000000004",
      codigo: "PC-ANIM-04",
      nombre: "Las Ánimas - Calle Sedeño con Bombero Schade",
      descripcion: "Intersección urbana con reiterado colapso de sumideros de aguas lluvias",
      tipo_riesgo: "Colapso de colectores y anegamiento",
      prioridad: "MEDIA",
      latitud: -39.8055,
      longitud: -73.2325,
      delegacion_id: delNorte,
      activo: true,
    },
    {
      id: "40000000-0000-4000-8000-000000000005",
      codigo: "PC-ISLA-05",
      nombre: "Isla Teja - Humedal Prochelle / Los Robles",
      descripcion: "Saturación freática con anegamiento de áreas verdes y accesos peatonales",
      tipo_riesgo: "Anegamiento urbano",
      prioridad: "BAJA",
      latitud: -39.8120,
      longitud: -73.2540,
      delegacion_id: delNorte,
      activo: true,
    },
    {
      id: "40000000-0000-4000-8000-000000000006",
      codigo: "PC-GUA-06",
      nombre: "Sector Guacamayo - Pasaje Los Canelos",
      descripcion: "Punto crítico de anegamiento de patios y riesgo de ingreso de agua a viviendas",
      tipo_riesgo: "Inundación y anegamiento",
      prioridad: "ALTA",
      latitud: -39.8620,
      longitud: -73.2310,
      delegacion_id: delSur,
      activo: true,
    },
  ];

  for (const pc of puntosCriticos) {
    await sql`
      INSERT INTO prevencion (
        id, codigo, nombre, descripcion, tipo_riesgo, prioridad,
        latitud, longitud, ubicacion, delegacion_id, activo, creado_en
      )
      VALUES (
        ${pc.id},
        ${pc.codigo},
        ${pc.nombre},
        ${pc.descripcion},
        ${pc.tipo_riesgo},
        ${pc.prioridad},
        ${pc.latitud},
        ${pc.longitud},
        ST_SetSRID(ST_MakePoint(${pc.longitud}, ${pc.latitud}), 4326),
        ${pc.delegacion_id},
        ${pc.activo},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (codigo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        tipo_riesgo = EXCLUDED.tipo_riesgo,
        prioridad = EXCLUDED.prioridad,
        latitud = EXCLUDED.latitud,
        longitud = EXCLUDED.longitud,
        ubicacion = EXCLUDED.ubicacion,
        delegacion_id = EXCLUDED.delegacion_id,
        activo = true,
        eliminado_en = NULL,
        eliminado_por_id = NULL;
    `.execute(db);
  }

  console.log(`[OK] ${puntosCriticos.length} puntos críticos insertados/actualizados.`);

  // 4. Insertar una misión preventiva activa asociada a PC-COL-02 para probar el bloqueo 409 Conflict
  const misionPreventivaId = "50000000-0000-4000-8000-000000000001";
  await sql`
    INSERT INTO mision (
      id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
      prevencion_id, creado_por_id, creado_en, actualizado_en
    )
    VALUES (
      ${misionPreventivaId},
      'MIS-PREV-2026-001',
      'Monitoreo y limpieza preventiva de sumideros en Collico',
      'Despliegue operativo preventivo de cuadrilla para despeje de alcantarillado previo a frente de mal tiempo',
      'PREVENCION',
      'EN_CURSO',
      'MEDIA',
      '40000000-0000-4000-8000-000000000002',
      ${usuarioId},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (codigo) DO UPDATE SET
      estado = 'EN_CURSO',
      prevencion_id = '40000000-0000-4000-8000-000000000002';
  `.execute(db);

  console.log("[OK] Misión preventiva activa (MIS-PREV-2026-001 en estado EN_CURSO) vinculada a PC-COL-02.");
  console.log("\n--- Resumen para pruebas de interfaz ---");
  console.log("1. Puntos listos para eliminar con éxito (200 OK):");
  console.log("   - PC-ANG-01 (Sector Humedal Angachilla)");
  console.log("   - PC-NIE-03 (Camino a Niebla - Curva Los Pelúes)");
  console.log("   - PC-ANIM-04 (Las Ánimas)");
  console.log("   - PC-ISLA-05 (Isla Teja)");
  console.log("   - PC-GUA-06 (Sector Guacamayo)");
  console.log("\n2. Punto con misión activa para probar bloqueo (409 Conflict):");
  console.log("   - PC-COL-02 (Sector Collico - Borde Río Calle Calle): tiene la misión MIS-PREV-2026-001 en curso.");

  await db.destroy();
}

if (process.argv[1]?.includes("seed-puntos-criticos")) {
  sembrarPuntosCriticos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error al sembrar puntos críticos:", err);
      process.exit(1);
    });
}
