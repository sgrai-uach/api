import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { sql } from "kysely";

export async function sembrarPatrullasVerificadoras() {
  console.log("Iniciando inserción de patrullas verificadoras de prueba...");

  // 1. Delegaciones Municipales de Valdivia
  const delNorte = "30000000-0000-4000-8000-000000000001";
  const delSur = "30000000-0000-4000-8000-000000000002";
  const delCosta = "30000000-0000-4000-8000-000000000003";
  const delCalleCalle = "30000000-0000-4000-8000-000000000004";
  const rolPatrullaId = "20000000-0000-4000-8000-000000000004";

  // 2. Crear usuarios operativos con rol PATRULLA_VERIFICADORA
  const usuariosPatrulla = [
    {
      id: "d1000000-0000-4000-8000-000000000001",
      rut: "17888999-1",
      nombres: "Pedro",
      apellidos: "Valenzuela",
      email: "pedro.patrulla@valdivia.cl",
      delegacion_id: delNorte,
    },
    {
      id: "d1000000-0000-4000-8000-000000000002",
      rut: "18999000-2",
      nombres: "Loreto",
      apellidos: "Sánchez",
      email: "loreto.patrulla@valdivia.cl",
      delegacion_id: delSur,
    },
    {
      id: "d1000000-0000-4000-8000-000000000003",
      rut: "19111222-3",
      nombres: "Matías",
      apellidos: "Alarcón",
      email: "matias.patrulla@valdivia.cl",
      delegacion_id: delCosta,
    },
    {
      id: "d1000000-0000-4000-8000-000000000004",
      rut: "16333444-5",
      nombres: "Ignacio",
      apellidos: "Cárdenas",
      email: "ignacio.patrulla@valdivia.cl",
      delegacion_id: delCalleCalle,
    },
    {
      id: "d1000000-0000-4000-8000-000000000005",
      rut: "15444555-6",
      nombres: "Francisca",
      apellidos: "Morales",
      email: "francisca.patrulla@valdivia.cl",
      delegacion_id: delSur,
    },
  ];

  for (const u of usuariosPatrulla) {
    await sql`
      INSERT INTO usuario (id, rut, nombres, apellidos, email, rol_id, delegacion_id, activo, estado_operativo)
      VALUES (${u.id}, ${u.rut}, ${u.nombres}, ${u.apellidos}, ${u.email}, ${rolPatrullaId}, ${u.delegacion_id}, true, 'disponible')
      ON CONFLICT (id) DO UPDATE SET
        rol_id = EXCLUDED.rol_id,
        delegacion_id = EXCLUDED.delegacion_id,
        activo = true,
        estado_operativo = 'disponible';
    `.execute(db);

    // Ficha en tabla personal
    await sql`
      INSERT INTO personal (id, usuario_id, delegacion_id, especialidad, cargo, disponible_terreno)
      VALUES (
        gen_random_uuid(),
        ${u.id},
        ${u.delegacion_id},
        'Evaluación y Diagnóstico Rápido de Emergencias',
        'Inspector Técnico de Terreno',
        true
      )
      ON CONFLICT DO NOTHING;
    `.execute(db);
  }

  console.log("Usuarios con rol PATRULLA_VERIFICADORA y fichas de personal creados.");

  // 3. Crear vehículos institucionales para asignación de patrulla
  const vehiculos = [
    {
      id: "b1000000-0000-4000-8000-000000000001",
      nombre: "Camioneta Toyota Hilux 4x4 Patrulla Norte (Patente: TH-81-22)",
      delegacion_id: delNorte,
    },
    {
      id: "b1000000-0000-4000-8000-000000000002",
      nombre: "Camioneta Nissan Navara 4x4 Patrulla Sur (Patente: NN-45-67)",
      delegacion_id: delSur,
    },
    {
      id: "b1000000-0000-4000-8000-000000000003",
      nombre: "Furgón Hyundai H-1 Patrulla Costa (Patente: HH-90-12)",
      delegacion_id: delCosta,
    },
    {
      id: "b1000000-0000-4000-8000-000000000004",
      nombre: "Camioneta Mitsubishi L200 Patrulla Calle Calle (Patente: ML-34-56)",
      delegacion_id: delCalleCalle,
    },
  ];

  for (const v of vehiculos) {
    await sql`
      INSERT INTO recurso (
        id, nombre, es_individual, estado, cantidad_inventario, cantidad_en_uso, cantidad_minima,
        latitud, longitud, ubicacion, descripcion, delegacion_id, creado_por_id
      )
      VALUES (
        ${v.id},
        ${v.nombre},
        true,
        'DISPONIBLE',
        1,
        0,
        1,
        -39.8142,
        -73.2459,
        ST_SetSRID(ST_MakePoint(-73.2459, -39.8142), 4326),
        'Vehículo de inspección y transporte ágil de patrulla verificadora',
        ${v.delegacion_id},
        '00000000-0000-4000-8000-000000000001'
      )
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        estado = 'DISPONIBLE';
    `.execute(db);
  }

  console.log("Vehículos individuales asignables creados.");

  // 4. Actualizar patrulla preexistente para asegurar estado DISPONIBLE y código
  await sql`
    UPDATE patrulla_verificadora
    SET
      codigo = 'PV-SUR-01',
      estado = 'DISPONIBLE',
      delegacion_id = ${delSur},
      activo = true,
      eliminado_en = NULL
    WHERE id = 'f1000000-0000-4000-8000-000000000002';
  `.execute(db);

  // 5. Sembrar Patrullas Verificadoras de prueba en todas las delegaciones de Valdivia
  const patrullas = [
    {
      id: "f1000000-0000-4000-8000-000000000010",
      codigo: "PV-NORTE-01",
      nombre: "Patrulla Rápida Las Ánimas",
      estado: "DISPONIBLE",
      delegacion_id: delNorte,
      usuario_lider_id: "d1000000-0000-4000-8000-000000000001",
      vehiculo_id: "b1000000-0000-4000-8000-000000000001",
      latitud: -39.8052,
      longitud: -73.2295,
    },
    {
      id: "f1000000-0000-4000-8000-000000000020",
      codigo: "PV-SUR-02",
      nombre: "Patrulla Rápida Angachilla",
      estado: "DISPONIBLE",
      delegacion_id: delSur,
      usuario_lider_id: "d1000000-0000-4000-8000-000000000002",
      vehiculo_id: "b1000000-0000-4000-8000-000000000002",
      latitud: -39.8310,
      longitud: -73.2289,
    },
    {
      id: "f1000000-0000-4000-8000-000000000030",
      codigo: "PV-COSTA-02",
      nombre: "Patrulla Rápida Niebla-Costa",
      estado: "DISPONIBLE",
      delegacion_id: delCosta,
      usuario_lider_id: "d1000000-0000-4000-8000-000000000003",
      vehiculo_id: "b1000000-0000-4000-8000-000000000003",
      latitud: -39.8652,
      longitud: -73.3984,
    },
    {
      id: "f1000000-0000-4000-8000-000000000040",
      codigo: "PV-CALLE-01",
      nombre: "Patrulla Rápida Collico-Corvi",
      estado: "DISPONIBLE",
      delegacion_id: delCalleCalle,
      usuario_lider_id: "d1000000-0000-4000-8000-000000000004",
      vehiculo_id: "b1000000-0000-4000-8000-000000000004",
      latitud: -39.8174,
      longitud: -73.2145,
    },
    {
      id: "f1000000-0000-4000-8000-000000000050",
      codigo: "PV-CENTRO-01",
      nombre: "Patrulla Central Urbana - Isla Teja",
      estado: "DISPONIBLE",
      delegacion_id: delSur,
      usuario_lider_id: "d1000000-0000-4000-8000-000000000005",
      vehiculo_id: null,
      latitud: -39.8142,
      longitud: -73.2459,
    },
  ];

  for (const p of patrullas) {
    await sql`
      INSERT INTO patrulla_verificadora (
        id, codigo, nombre, estado, delegacion_id, usuario_lider_id, vehiculo_id,
        latitud, longitud, ubicacion, activo, eliminado_en
      )
      VALUES (
        ${p.id},
        ${p.codigo},
        ${p.nombre},
        ${p.estado},
        ${p.delegacion_id},
        ${p.usuario_lider_id},
        ${p.vehiculo_id},
        ${p.latitud},
        ${p.longitud},
        ST_SetSRID(ST_MakePoint(${p.longitud}, ${p.latitud}), 4326),
        true,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        codigo = EXCLUDED.codigo,
        nombre = EXCLUDED.nombre,
        estado = EXCLUDED.estado,
        delegacion_id = EXCLUDED.delegacion_id,
        usuario_lider_id = EXCLUDED.usuario_lider_id,
        vehiculo_id = EXCLUDED.vehiculo_id,
        latitud = EXCLUDED.latitud,
        longitud = EXCLUDED.longitud,
        ubicacion = EXCLUDED.ubicacion,
        activo = true,
        eliminado_en = NULL;
    `.execute(db);
  }

  console.log("Patrullas verificadoras de prueba sembradas exitosamente.");

  // Mostrar resumen de patrullas disponibles actuales
  const listado = await db
    .selectFrom("patrulla_verificadora")
    .select(["id", "codigo", "nombre", "estado", "delegacion_id"])
    .where("eliminado_en", "is", null)
    .execute();

  console.table(listado);
}

// Ejecutar si es invocado directamente por línea de comandos
if (require.main === module || process.argv[1]?.includes("seed-patrullas")) {
  sembrarPatrullasVerificadoras()
    .then(() => {
      console.log("Proceso de siembra finalizado exitosamente.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error al sembrar patrullas verificadoras:", error);
      process.exit(1);
    });
}
