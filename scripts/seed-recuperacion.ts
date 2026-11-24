import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";
import type { PrioridadIncidente, EstadoMision } from "../src/lib/db/types";
import type { EstadoRecuperacion } from "../src/modules/eventos-atp/recuperacion.schema";

export async function sembrarEventosRecuperacion() {
  console.log("Iniciando siembra de eventos de recuperación georreferenciados para el mapa operativo...");

  // 1. Obtener usuario creador (Admin o Encargado)
  const usuario = await db.selectFrom("usuario").selectAll().executeTakeFirst();
  const usuarioId = usuario?.id || "00000000-0000-4000-8000-000000000001";

  // 2. Obtener delegaciones
  const delegaciones = await db.selectFrom("delegacion").selectAll().execute();
  const delNorte = delegaciones.find((d) => d.codigo === "DEL_NORTE")?.id || delegaciones[0]?.id || null;
  const delSur = delegaciones.find((d) => d.codigo === "DEL_SUR")?.id || delegaciones[1]?.id || null;
  const delCalleCalle = delegaciones.find((d) => d.codigo === "DEL_CALLE_CALLE")?.id || delegaciones[3]?.id || null;

  // 3. Obtener o asegurar patrullas verificadoras
  const patrullas = await db.selectFrom("patrulla_verificadora").selectAll().execute();
  let patrullaNorte = patrullas.find((p) => p.delegacion_id === delNorte) || patrullas[0];
  const patrullaSur = patrullas.find((p) => p.delegacion_id === delSur) || patrullas[1] || patrullas[0];
  const patrullaCalle = patrullas.find((p) => p.delegacion_id === delCalleCalle) || patrullas[2] || patrullas[0];

  if (!patrullaNorte) {
    const nueva = await db
      .insertInto("patrulla_verificadora")
      .values({
        id: "50000000-0000-4000-8000-000000000001",
        codigo: "PAT-REC-01",
        nombre: "Patrulla Verificadora Las Ánimas",
        estado: "EN_RECUPERACION",
        delegacion_id: delNorte,
        activo: true,
        creado_en: new Date(),
        actualizado_en: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    patrullaNorte = nueva;
  }

  // 4. Obtener o asegurar recursos
  const recursosExistentes = await db.selectFrom("recurso").selectAll().execute();

  async function asegurarRecurso(nombre: string, esIndividual: boolean, inventario: number, enUso: number) {
    const hallado = recursosExistentes.find((r) => r.nombre.toLowerCase().includes(nombre.toLowerCase()));
    if (hallado) return hallado;

    return await db
      .insertInto("recurso")
      .values({
        nombre,
        descripcion: `Insumo logístico de emergencia: ${nombre}`,
        es_individual: esIndividual,
        cantidad_inventario: inventario,
        cantidad_en_uso: enUso,
        cantidad_minima: 5,
        latitud: -39.8142,
        longitud: -73.2459,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326)`,
        estado: "DISPONIBLE",
        creado_por_id: usuarioId,
        creado_en: new Date(),
        actualizado_en: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  const zinc = await asegurarRecurso("Planchas de Zinc 3.66m", false, 150, 24);
  const carbon = await asegurarRecurso("Carbón vegetal 5kg", false, 200, 12);
  const sacos = await asegurarRecurso("Sacos de Arena 25kg", false, 300, 60);
  const motobomba = await asegurarRecurso("Motobomba de achique 3'' Honda", true, 5, 1);
  const frazadas = await asegurarRecurso("Frazadas térmicas polares", false, 80, 12);
  const alimentos = await asegurarRecurso("Cajas Alimentos Emergencia", false, 50, 6);
  const nylon = await asegurarRecurso("Nylon pesado impermeable 100m", false, 30, 4);

  // 5. Datos de eventos de recuperación georreferenciados en Valdivia
  const eventos = [
    {
      id: "70000000-0000-4000-8000-000000000001",
      codigo: "REC-2026-0001",
      nombre: "Entrega de planchas de zinc y carbón en Las Ánimas",
      descripcion: "Familias con voladura de techumbre por ráfagas de viento costeras en población El Laurel.",
      sector: "Las Ánimas",
      direccion_texto: "Avenida Pedro Aguirre Cerda 1420",
      prioridad: "ALTA",
      contacto_nombre: "Marta Gómez (Delegada Vecinal)",
      contacto_telefono: "+56987654321",
      latitud: -39.8052,
      longitud: -73.2295,
      estado: "EN_EJECUCION",
      familias_afectadas: 6,
      delegacion_id: delNorte,
      patrulla_id: patrullaNorte.id,
      mision_codigo: "MIS-2026-0101",
      mision_titulo: "Distribución de Techumbre y Calefacción Las Ánimas",
      mision_estado: "EN_CURSO",
      recursos_asignados: [
        { recurso_id: zinc.id, cantidad: 24 },
        { recurso_id: carbon.id, cantidad: 12 },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000002",
      codigo: "REC-2026-0002",
      nombre: "Mitigación y diques con sacos de arena en Borde Río Collico",
      descripcion: "Desborde de cauce ribereño amenazando 12 viviendas en sector bajo de Collico.",
      sector: "Collico",
      direccion_texto: "Calle Balmaceda 1245 con Ribera",
      prioridad: "CRITICA",
      contacto_nombre: "Carlos Valenzuela (Junta de Vecinos)",
      contacto_telefono: "+56976543210",
      latitud: -39.8174,
      longitud: -73.2145,
      estado: "EN_EJECUCION",
      familias_afectadas: 12,
      delegacion_id: delCalleCalle,
      patrulla_id: patrullaCalle?.id || patrullaNorte.id,
      mision_codigo: "MIS-2026-0102",
      mision_titulo: "Instalación de Contención Fluvial y Bombeo Collico",
      mision_estado: "EN_CURSO",
      recursos_asignados: [
        { recurso_id: sacos.id, cantidad: 60 },
        { recurso_id: motobomba.id, cantidad: 1 },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000003",
      codigo: "REC-2026-0003",
      nombre: "Asistencia de abrigo y kits de alimentos en Isla Teja",
      descripcion: "Viviendas con filtraciones de agua lluvia y adultos mayores afectados en Los Pelúes.",
      sector: "Isla Teja",
      direccion_texto: "Los Lingues 430 con Calle Los Laureles",
      prioridad: "MEDIA",
      contacto_nombre: "Raquel Soto",
      contacto_telefono: "+56965432109",
      latitud: -39.8105,
      longitud: -73.2511,
      estado: "PLANIFICADA",
      familias_afectadas: 3,
      delegacion_id: delNorte,
      patrulla_id: patrullaNorte.id,
      mision_codigo: "MIS-2026-0103",
      mision_titulo: "Entrega de Abrigo y Víveres Teja Norte",
      mision_estado: "DESPACHADA",
      recursos_asignados: [
        { recurso_id: frazadas.id, cantidad: 12 },
        { recurso_id: alimentos.id, cantidad: 6 },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000004",
      codigo: "REC-2026-0004",
      nombre: "Impermeabilización de techumbres con nylon en Angachilla",
      descripcion: "Anegamiento de patio y filtraciones en 8 viviendas del Pasaje Los Robles.",
      sector: "Angachilla",
      direccion_texto: "Pasaje Los Robles 512, Sector Humedal",
      prioridad: "ALTA",
      contacto_nombre: "Héctor Cárdenas",
      contacto_telefono: "+56954321098",
      latitud: -39.8450,
      longitud: -73.2350,
      estado: "EN_EJECUCION",
      familias_afectadas: 8,
      delegacion_id: delSur,
      patrulla_id: patrullaSur?.id || patrullaNorte.id,
      mision_codigo: "MIS-2026-0104",
      mision_titulo: "Operativo Protección Impermeable Angachilla",
      mision_estado: "EN_CURSO",
      recursos_asignados: [
        { recurso_id: nylon.id, cantidad: 4 },
        { recurso_id: sacos.id, cantidad: 20 },
      ],
    },
  ];

  for (const ev of eventos) {
    // Upsert evento de recuperación
    const existe = await db
      .selectFrom("recuperacion")
      .select("id")
      .where("codigo", "=", ev.codigo)
      .executeTakeFirst();

    let recId = ev.id;
    if (existe) {
      recId = existe.id;
      await db
        .updateTable("recuperacion")
        .set({
          nombre: ev.nombre,
          descripcion: ev.descripcion,
          sector: ev.sector,
          direccion_texto: ev.direccion_texto,
          prioridad: ev.prioridad as PrioridadIncidente,
          contacto_nombre: ev.contacto_nombre,
          contacto_telefono: ev.contacto_telefono,
          latitud: ev.latitud,
          longitud: ev.longitud,
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${ev.longitud}, ${ev.latitud}), 4326)`,
          estado: ev.estado as EstadoRecuperacion,
          familias_afectadas: ev.familias_afectadas,
          delegacion_id: ev.delegacion_id,
          actualizado_en: new Date(),
        })
        .where("id", "=", recId)
        .execute();
      console.log(`Evento ${ev.codigo} actualizado.`);
    } else {
      await db
        .insertInto("recuperacion")
        .values({
          id: ev.id,
          codigo: ev.codigo,
          nombre: ev.nombre,
          descripcion: ev.descripcion,
          sector: ev.sector,
          direccion_texto: ev.direccion_texto,
          prioridad: ev.prioridad as PrioridadIncidente,
          contacto_nombre: ev.contacto_nombre,
          contacto_telefono: ev.contacto_telefono,
          latitud: ev.latitud,
          longitud: ev.longitud,
          ubicacion: sql`ST_SetSRID(ST_MakePoint(${ev.longitud}, ${ev.latitud}), 4326)`,
          estado: ev.estado as EstadoRecuperacion,
          familias_afectadas: ev.familias_afectadas,
          delegacion_id: ev.delegacion_id,
          creado_por_id: usuarioId,
          creado_en: new Date(),
          actualizado_en: new Date(),
        })
        .execute();
      console.log(`Evento ${ev.codigo} creado en sector ${ev.sector}.`);
    }

    // Upsert misión vinculada
    const misionExiste = await db
      .selectFrom("mision")
      .select("id")
      .where("codigo", "=", ev.mision_codigo)
      .executeTakeFirst();

    let misId: string;
    if (misionExiste) {
      misId = misionExiste.id;
      await db
        .updateTable("mision")
        .set({
          titulo: ev.mision_titulo,
          estado: ev.mision_estado as EstadoMision,
          recuperacion_id: recId,
          patrulla_id: ev.patrulla_id,
        })
        .where("id", "=", misId)
        .execute();
    } else {
      const nuevaMision = await db
        .insertInto("mision")
        .values({
          codigo: ev.mision_codigo,
          titulo: ev.mision_titulo,
          descripcion: ev.descripcion,
          tipo_mision: "RECUPERACION",
          estado: ev.mision_estado as EstadoMision,
          prioridad: ev.prioridad as PrioridadIncidente,
          patrulla_id: ev.patrulla_id,
          recuperacion_id: recId,
          encargado_id: usuarioId,
          creado_por_id: usuarioId,
          fecha_inicio: new Date(),
          creado_en: new Date(),
          actualizado_en: new Date(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      misId = nuevaMision.id;
    }

    // Vincular recursos asignados
    await db.deleteFrom("recuperacion_recurso").where("recuperacion_id", "=", recId).execute();
    for (const r of ev.recursos_asignados) {
      await db
        .insertInto("recuperacion_recurso")
        .values({
          recuperacion_id: recId,
          recurso_id: r.recurso_id,
          cantidad_asignada: r.cantidad,
          creado_en: new Date(),
        })
        .execute();
    }
  }

  console.log("Siembra de eventos de recuperación finalizada con éxito.");
}

async function main() {
  try {
    await sembrarEventosRecuperacion();
    process.exit(0);
  } catch (error) {
    console.error("Error sembrando eventos de recuperación:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  main();
}
