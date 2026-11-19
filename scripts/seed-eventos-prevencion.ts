import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { sql } from "kysely";
import { db } from "../src/lib/db";

export async function sembrarEventosPrevencion() {
  console.log("Iniciando inserción de eventos de prevención de prueba (H76)...");

  // 1. Obtener delegaciones territoriales
  const delegaciones = await db.selectFrom("delegacion").selectAll().execute();
  const delNorte =
    delegaciones.find((d) => d.codigo === "DEL_NORTE")?.id ||
    "30000000-0000-4000-8000-000000000001";
  const delSur =
    delegaciones.find((d) => d.codigo === "DEL_SUR")?.id ||
    "30000000-0000-4000-8000-000000000002";
  const delCosta =
    delegaciones.find((d) => d.codigo === "DEL_COSTA")?.id ||
    "30000000-0000-4000-8000-000000000003";
  const delCalleCalle =
    delegaciones.find((d) => d.codigo === "DEL_CALLE_CALLE")?.id ||
    "30000000-0000-4000-8000-000000000004";

  // 2. Obtener usuario creador (Encargado o Admin)
  const usuario = await db
    .selectFrom("usuario")
    .select("id")
    .where("activo", "=", true)
    .executeTakeFirst();
  const usuarioId = usuario?.id || "00000000-0000-4000-8000-000000000001";

  // 3. Obtener puntos críticos existentes (si existen de seed:puntos-criticos)
  const puntosCriticos = await db
    .selectFrom("prevencion")
    .select(["id", "codigo"])
    .where("activo", "=", true)
    .where("eliminado_en", "is", null)
    .execute();

  const pcMap = new Map(puntosCriticos.map((pc) => [pc.codigo, pc.id]));

  // 4. Obtener patrullas, cuadrillas y recursos disponibles (opcionales)
  const patrulla = await db
    .selectFrom("patrulla_verificadora")
    .select("id")
    .where("activo", "=", true)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();

  const cuadrilla = await db
    .selectFrom("cuadrilla")
    .select("id")
    .where("activo", "=", true)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();

  const recurso = await db
    .selectFrom("recurso")
    .select("id")
    .where("eliminado_en", "is", null)
    .executeTakeFirst();

  // 5. Eventos de prevención de prueba (cubre los 4 estados y 4 delegaciones)
  const eventosPrueba = [
    {
      id: "81000000-0000-4000-8000-000000000001",
      codigo: "PREV-2026-9001",
      nombre: "Limpieza preventiva de sumideros en Angachilla",
      descripcion:
        "Despeje de colectores y rejillas de aguas lluvias previo a sistema frontal.",
      prioridad: "ALTA",
      estado: "EN_CURSO",
      sector: "Humedal Angachilla",
      direccionTexto: "Pasaje Los Robles s/n con Av. Simpson",
      puntoCriticoId: pcMap.get("PC-ANG-01") ?? null,
      delegacionId: delSur,
      latitud: -39.8456,
      longitud: -73.2389,
      mision: {
        id: "82000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-9001",
        estado: "EN_CURSO",
        patrullaId: patrulla?.id ?? null,
        cuadrillaId: null,
        fechaInicio: new Date("2026-11-18T09:00:00.000Z"),
        fechaCierre: null,
      },
    },
    {
      id: "81000000-0000-4000-8000-000000000002",
      codigo: "PREV-2026-9002",
      nombre: "Faja cortafuego y desmalezado Camino a Niebla",
      descripcion:
        "Construcción y mantención de faja cortafuego preventiva en ladera boscosa.",
      prioridad: "CRITICA",
      estado: "PLANIFICADA",
      sector: "Curva Los Pelúes",
      direccionTexto: "Ruta T-350 km 6",
      puntoCriticoId: pcMap.get("PC-NIE-03") ?? null,
      delegacionId: delCosta,
      latitud: -39.851,
      longitud: -73.385,
      mision: {
        id: "82000000-0000-4000-8000-000000000002",
        codigo: "MIS-2026-9002",
        estado: "DESPACHADA",
        patrullaId: null,
        cuadrillaId: cuadrilla?.id ?? null,
        fechaInicio: new Date("2026-11-19T08:30:00.000Z"),
        fechaCierre: null,
      },
    },
    {
      id: "81000000-0000-4000-8000-000000000003",
      codigo: "PREV-2026-9003",
      nombre: "Despeje de colectores en Las Ánimas",
      descripcion:
        "Mantención preventiva de cámaras y sumideros en intersección crítica.",
      prioridad: "MEDIA",
      estado: "COMPLETADA",
      sector: "Las Ánimas",
      direccionTexto: "Calle Sedeño con Bombero Schade",
      puntoCriticoId: pcMap.get("PC-ANIM-04") ?? null,
      delegacionId: delNorte,
      latitud: -39.8055,
      longitud: -73.2325,
      mision: {
        id: "82000000-0000-4000-8000-000000000003",
        codigo: "MIS-2026-9003",
        estado: "COMPLETADA",
        patrullaId: patrulla?.id ?? null,
        cuadrillaId: cuadrilla?.id ?? null,
        fechaInicio: new Date("2026-11-15T10:00:00.000Z"),
        fechaCierre: new Date("2026-11-15T16:30:00.000Z"),
      },
    },
    {
      id: "81000000-0000-4000-8000-000000000004",
      codigo: "PREV-2026-9004",
      nombre: "Inspección preventiva de ribera en Collico",
      descripcion:
        "Monitoreo de borde fluvial y verificación de defensas ribereñas.",
      prioridad: "MEDIA",
      estado: "CANCELADA",
      sector: "Collico",
      direccionTexto: "Borde Río Calle Calle s/n",
      puntoCriticoId: pcMap.get("PC-COL-02") ?? null,
      delegacionId: delCalleCalle,
      latitud: -39.8182,
      longitud: -73.212,
      mision: {
        id: "82000000-0000-4000-8000-000000000004",
        codigo: "MIS-2026-9004",
        estado: "CANCELADA",
        patrullaId: patrulla?.id ?? null,
        cuadrillaId: null,
        fechaInicio: new Date("2026-11-14T11:00:00.000Z"),
        fechaCierre: new Date("2026-11-14T12:00:00.000Z"),
      },
    },
    {
      id: "81000000-0000-4000-8000-000000000005",
      codigo: "PREV-2026-9005",
      nombre: "Operativo preventivo sin punto crítico catalogado (Guacamayo)",
      descripcion:
        "Limpieza de zanja de evacuación con coordenadas directas de terreno.",
      prioridad: "BAJA",
      estado: "PLANIFICADA",
      sector: "Guacamayo",
      direccionTexto: "Av. Circunvalación Sur altura 2400",
      puntoCriticoId: null,
      delegacionId: delSur,
      latitud: -39.864,
      longitud: -73.2295,
      mision: {
        id: "82000000-0000-4000-8000-000000000005",
        codigo: "MIS-2026-9005",
        estado: "DESPACHADA",
        patrullaId: patrulla?.id ?? null,
        cuadrillaId: null,
        fechaInicio: new Date("2026-11-19T14:00:00.000Z"),
        fechaCierre: null,
      },
    },
  ];

  for (const ev of eventosPrueba) {
    await sql`
      INSERT INTO evento_prevencion (
        id, codigo, nombre, descripcion, prioridad, estado, sector, direccion_texto,
        punto_critico_id, delegacion_id, latitud, longitud, ubicacion,
        creado_por_id, activo, eliminado_en, creado_en, actualizado_en
      )
      VALUES (
        ${ev.id},
        ${ev.codigo},
        ${ev.nombre},
        ${ev.descripcion},
        ${ev.prioridad},
        ${ev.estado},
        ${ev.sector},
        ${ev.direccionTexto},
        ${ev.puntoCriticoId},
        ${ev.delegacionId},
        ${ev.latitud},
        ${ev.longitud},
        ST_SetSRID(ST_MakePoint(${ev.longitud}, ${ev.latitud}), 4326),
        ${usuarioId},
        true,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (codigo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        prioridad = EXCLUDED.prioridad,
        estado = EXCLUDED.estado,
        sector = EXCLUDED.sector,
        direccion_texto = EXCLUDED.direccion_texto,
        punto_critico_id = EXCLUDED.punto_critico_id,
        delegacion_id = EXCLUDED.delegacion_id,
        latitud = EXCLUDED.latitud,
        longitud = EXCLUDED.longitud,
        ubicacion = EXCLUDED.ubicacion,
        activo = true,
        eliminado_en = NULL,
        actualizado_en = CURRENT_TIMESTAMP;
    `.execute(db);

    await sql`
      INSERT INTO mision (
        id, codigo, titulo, descripcion, tipo_mision, estado, prioridad,
        evento_prevencion_id, prevencion_id, patrulla_id, cuadrilla_id,
        encargado_id, creado_por_id, fecha_inicio, fecha_cierre, creado_en, actualizado_en
      )
      VALUES (
        ${ev.mision.id},
        ${ev.mision.codigo},
        ${ev.nombre},
        ${ev.descripcion},
        'PREVENCION',
        ${ev.mision.estado},
        ${ev.prioridad},
        ${ev.id},
        ${ev.puntoCriticoId},
        ${ev.mision.patrullaId},
        ${ev.mision.cuadrillaId},
        ${usuarioId},
        ${usuarioId},
        ${ev.mision.fechaInicio},
        ${ev.mision.fechaCierre},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (codigo) DO UPDATE SET
        estado = EXCLUDED.estado,
        evento_prevencion_id = EXCLUDED.evento_prevencion_id,
        prevencion_id = EXCLUDED.prevencion_id,
        patrulla_id = EXCLUDED.patrulla_id,
        cuadrilla_id = EXCLUDED.cuadrilla_id,
        fecha_inicio = EXCLUDED.fecha_inicio,
        fecha_cierre = EXCLUDED.fecha_cierre,
        actualizado_en = CURRENT_TIMESTAMP;
    `.execute(db);

    if (recurso) {
      const existeAsignacion = await db
        .selectFrom("evento_prevencion_recurso")
        .select("id")
        .where("evento_prevencion_id", "=", ev.id)
        .where("recurso_id", "=", recurso.id)
        .executeTakeFirst();

      if (!existeAsignacion) {
        await db
          .insertInto("evento_prevencion_recurso")
          .values({
            evento_prevencion_id: ev.id,
            recurso_id: recurso.id,
            cantidad_asignada: 4,
          })
          .execute();
      }
    }
  }

  console.log(
    `✅ ${eventosPrueba.length} eventos de prevención de prueba sembrados correctamente.`
  );
}

if (require.main === module) {
  sembrarEventosPrevencion()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error al sembrar eventos de prevención:", err);
      process.exit(1);
    });
}
