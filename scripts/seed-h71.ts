/**
 * Fixture de datos QA para HU-71 — Registro de Ficha Básica de Emergencia (FIBE).
 *
 * Objetivo:
 *   Dejar la base de datos con los usuarios RBAC y 5 casos en `evento_asistencia_social`
 *   necesarios para probar de punta a punta la consola de Asistencia Social en `sgrai-web`:
 *   1. Usuarios RBAC (`asistente.social@valdivia.cl`, `admin@valdivia.cl`, `encargado@valdivia.cl`).
 *   2. AS-H71-0001 (`ASIGNADO` con `detalles_evaluacion` y `nivelCompromisoVivienda: "MODERADO"`).
 *   3. AS-H71-0002 (`ASIGNADO` sin `detalles_evaluacion` ni folio, para probar selector vacío y 409 duplicado).
 *   4. AS-H71-0003 (`EN_EVALUACION_FIBE` con folio `FIBE-2026-0001`, `GRAVE_INHABITABLE` y observaciones).
 *   5. AS-H71-0004 (`PENDIENTE` sin asignar).
 *   6. AS-H71-0005 (`FINALIZADO` con folio cerrado `FIBE-2026-0002`).
 *
 * Uso:
 *   npm run seed:h71            # Siembra (limpia y recrea el fixture)
 *   npm run seed:h71 -- --clean # Solo elimina los eventos del fixture
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import bcrypt from "bcryptjs";
import { sql } from "kysely";
import { db } from "../src/lib/db";

const FIXTURE_EVENT_IDS = [
  "77100000-0000-4000-8000-000000000001",
  "77100000-0000-4000-8000-000000000002",
  "77100000-0000-4000-8000-000000000003",
  "77100000-0000-4000-8000-000000000004",
  "77100000-0000-4000-8000-000000000005",
] as const;

const DEFAULT_DEV_PASSWORD = "Valdivia2026!";

async function limpiarEventosFixture() {
  await sql`
    DELETE FROM evento_asistencia_social
    WHERE id IN (${sql.join(FIXTURE_EVENT_IDS.map((id) => sql`${id}::uuid`))})
       OR codigo IN ('AS-H71-0001', 'AS-H71-0002', 'AS-H71-0003', 'AS-H71-0004', 'AS-H71-0005')
       OR UPPER(TRIM(folio_fibe)) IN ('FIBE-2026-0001', 'FIBE-2026-0002');
  `.execute(db);
}

async function seedH71() {
  const soloLimpiar = process.argv.includes("--clean");
  if (soloLimpiar) {
    await limpiarEventosFixture();
    console.log("[seed:h71] Fixture HU-71 eliminado correctamente.");
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_DEV_PASSWORD, 10);

  // 1. Obtener delegaciones existentes
  const delegaciones = await db
    .selectFrom("delegacion")
    .select(["id", "codigo"])
    .execute();
  const delegacionDefaultId = delegaciones[0]?.id ?? null;

  // 2. Garantizar usuarios RBAC de prueba (ADMINISTRADOR, ENCARGADO, ASISTENTE_SOCIAL)
  const rolAdminId = "20000000-0000-4000-8000-000000000001";
  const rolEncargadoId = "20000000-0000-4000-8000-000000000003";
  const rolAsistenteSocialId = "20000000-0000-4000-8000-000000000006";

  await sql`
    INSERT INTO usuario (id, rut, nombres, apellidos, email, password_hash, rol_id, delegacion_id, activo, estado_operativo)
    VALUES
      ('00000000-0000-4000-8000-000000000001', '11.111.111-1', 'Administrador', 'SGRAI', 'admin@valdivia.cl', ${passwordHash}, ${rolAdminId}, ${delegacionDefaultId}, true, 'disponible'),
      ('00000000-0000-4000-8000-000000000003', '13.333.333-3', 'Encargado', 'Operaciones', 'encargado@valdivia.cl', ${passwordHash}, ${rolEncargadoId}, ${delegacionDefaultId}, true, 'disponible'),
      ('00000000-0000-4000-8000-000000000019', '17.444.555-6', 'Claudia', 'Rojas Vidal', 'asistente.social@valdivia.cl', ${passwordHash}, ${rolAsistenteSocialId}, ${delegacionDefaultId}, true, 'disponible')
    ON CONFLICT (email) DO UPDATE SET
      password_hash = COALESCE(usuario.password_hash, EXCLUDED.password_hash),
      rol_id = EXCLUDED.rol_id,
      activo = true,
      estado_operativo = 'disponible';
  `.execute(db);

  const usuarios = await db
    .selectFrom("usuario")
    .select(["id", "email"])
    .where("email", "in", [
      "admin@valdivia.cl",
      "encargado@valdivia.cl",
      "asistente.social@valdivia.cl",
    ])
    .execute();

  const idPorEmail = new Map(usuarios.map((u) => [u.email, u.id]));
  const adminId = idPorEmail.get("admin@valdivia.cl") ?? "00000000-0000-4000-8000-000000000001";
  const encargadoId = idPorEmail.get("encargado@valdivia.cl") ?? "00000000-0000-4000-8000-000000000003";
  const asistenteSocialId =
    idPorEmail.get("asistente.social@valdivia.cl") ?? "00000000-0000-4000-8000-000000000019";

  // 3. Limpiar registros previos del fixture para asegurar idempotencia
  await limpiarEventosFixture();

  // 4. Insertar los 5 casos en evento_asistencia_social
  const detallesCaso1 = JSON.stringify({
    familias: [
      {
        referencia: "Hogar 1",
        nucleoFamiliarTotal: 4,
        cantidadNinos: 1,
        cantidadAdultosMayores: 1,
        personasDiscapacitadas: 0,
        personasElectrodependientes: 0,
        mascotasAfectadas: 1,
        nivelCompromisoVivienda: "MODERADO",
        contactoNombre: "María González",
        contactoTelefono: "+56912345678",
      },
    ],
    familiasAfectadas: 1,
    nucleoFamiliarTotal: 4,
    cantidadNinos: 1,
    cantidadAdultosMayores: 1,
    personasDiscapacitadas: 0,
    personasElectrodependientes: 0,
    mascotasAfectadas: 1,
    nivelCompromisoVivienda: "MODERADO",
    danosEstimados: "Filtración en techumbre y humedad en dormitorio principal.",
  });

  await sql`
    INSERT INTO evento_asistencia_social (
      id, codigo, descripcion, tipo_afectacion, personas_afectadas, familias_afectadas,
      direccion_texto, latitud, longitud, ubicacion,
      contacto_nombre, contacto_telefono, contacto_rut,
      prioridad, estado, delegacion_id, asistente_social_id,
      detalles_evaluacion, folio_fibe, nivel_dano_vivienda, observaciones_fibe,
      fibe_registrada_en, fibe_registrada_por_id, creado_por_id, actualizado_por_id
    )
    VALUES
      (
        ${FIXTURE_EVENT_IDS[0]}::uuid,
        'AS-H71-0001',
        'Caso asignado con evaluación preliminar de patrulla verificadora para precarga FIBE.',
        'VIVIENDA_ANEGADA',
        4,
        1,
        'Calle Los Alerces 1420, Sector Collico',
        -39.8174,
        -73.2145,
        ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326),
        'María González',
        '+56912345678',
        '12.345.678-9',
        'ALTA',
        'ASIGNADO',
        ${delegacionDefaultId},
        ${asistenteSocialId},
        ${detallesCaso1}::jsonb,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        ${encargadoId},
        NULL
      ),
      (
        ${FIXTURE_EVENT_IDS[1]}::uuid,
        'AS-H71-0002',
        'Caso asignado sin evaluación preliminar previa (ideal para probar selector vacío y 409 folio duplicado).',
        'DANO_ESTRUCTURAL',
        2,
        1,
        'Av. Ramón Picarte 1520, Valdivia',
        -39.8245,
        -73.2312,
        ST_SetSRID(ST_MakePoint(-73.2312, -39.8245), 4326),
        'Juan Pérez',
        '+56987654321',
        '14.222.333-4',
        'MEDIA',
        'ASIGNADO',
        ${delegacionDefaultId},
        ${asistenteSocialId},
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        ${encargadoId},
        NULL
      ),
      (
        ${FIXTURE_EVENT_IDS[2]}::uuid,
        'AS-H71-0003',
        'Caso con Ficha FIBE ya registrada en terreno, listo para edición y validación de folio único.',
        'VIVIENDA_ANEGADA',
        5,
        1,
        'Av. España 890, Las Ánimas',
        -39.8052,
        -73.2295,
        ST_SetSRID(ST_MakePoint(-73.2295, -39.8052), 4326),
        'Camila Soto',
        '+56955551111',
        '15.444.555-2',
        'CRITICA',
        'EN_EVALUACION_FIBE',
        ${delegacionDefaultId},
        ${asistenteSocialId},
        NULL,
        'FIBE-2026-0001',
        'GRAVE_INHABITABLE',
        'Vivienda con daño estructural severo tras anegamiento; familia requiere apoyo de emergencia.',
        CURRENT_TIMESTAMP,
        ${asistenteSocialId},
        ${encargadoId},
        ${asistenteSocialId}
      ),
      (
        ${FIXTURE_EVENT_IDS[3]}::uuid,
        'AS-H71-0004',
        'Caso pendiente sin asistente social asignado (no debe habilitar acción FIBE).',
        'ANEGAMIENTO',
        3,
        1,
        'General Lagos 1190, Valdivia',
        -39.8221,
        -73.2498,
        ST_SetSRID(ST_MakePoint(-73.2498, -39.8221), 4326),
        'Rodrigo Fuentes',
        '+56966662222',
        '16.777.888-1',
        'MEDIA',
        'PENDIENTE',
        ${delegacionDefaultId},
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        ${encargadoId},
        NULL
      ),
      (
        ${FIXTURE_EVENT_IDS[4]}::uuid,
        'AS-H71-0005',
        'Caso finalizado con Ficha FIBE cerrada (no debe permitir registro ni edición).',
        'VOLADURA_TECHUMBRE',
        2,
        1,
        'Camino a Niebla Km 3, Torobayo',
        -39.8451,
        -73.2812,
        ST_SetSRID(ST_MakePoint(-73.2812, -39.8451), 4326),
        'Javiera Morales',
        '+56977773333',
        '18.111.222-K',
        'BAJA',
        'FINALIZADO',
        ${delegacionDefaultId},
        ${asistenteSocialId},
        NULL,
        'FIBE-2026-0002',
        'LEVE',
        'Caso cerrado tras entrega de ayuda inicial en DGRD.',
        CURRENT_TIMESTAMP,
        ${asistenteSocialId},
        ${adminId},
        ${asistenteSocialId}
      );
  `.execute(db);

  console.log("[seed:h71] Fixture HU-71 sembrado exitosamente:");
  console.log("  - Usuarios (clave dev: Valdivia2026!):");
  console.log(`    * asistente.social@valdivia.cl (${asistenteSocialId}) [con asistencia_social:fibe:gestionar]`);
  console.log(`    * admin@valdivia.cl            (${adminId}) [con asistencia_social:fibe:gestionar]`);
  console.log(`    * encargado@valdivia.cl        (${encargadoId}) [sin asistencia_social:fibe:gestionar]`);
  console.log("  - Casos en evento_asistencia_social:");
  console.log("    * AS-H71-0001 -> ASIGNADO (con detalles_evaluacion MODERADO, 4 personas)");
  console.log("    * AS-H71-0002 -> ASIGNADO (sin detalles_evaluacion, 2 personas)");
  console.log("    * AS-H71-0003 -> EN_EVALUACION_FIBE (folio FIBE-2026-0001, GRAVE_INHABITABLE)");
  console.log("    * AS-H71-0004 -> PENDIENTE (sin asignar)");
  console.log("    * AS-H71-0005 -> FINALIZADO (folio FIBE-2026-0002, LEVE)");
}

seedH71()
  .catch((err) => {
    console.error("[seed:h71] Error al ejecutar el fixture HU-71:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
