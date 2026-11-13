import * as path from "path";
import { promises as fs } from "fs";
import { pathToFileURL } from "url";
import { sql } from "kysely";
import { Migrator, FileMigrationProvider, type MigrationResult } from "kysely/migration";
import { db } from "./index";

/**
 * Reconcilia entradas en `kysely_migration` cuyos archivos fueron renumerados
 * durante integraciones de ramas (ej. `051_permiso_misiones_terreno_verificar` ->
 * `052_permiso_misiones_terreno_verificar`), evitando que Kysely aborte por
 * `corrupted migrations: previously executed migration ... is missing`.
 */
export async function reconciliarMigracionesRenumeradas(migrationFolder: string) {
  try {
    const archivos = await fs.readdir(migrationFolder);
    const nombresEnDisco = new Set(
      archivos
        .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"))
        .map((f) => f.replace(/\.(ts|js)$/, ""))
    );

    const porSufijo = new Map<string, string>();
    for (const nombre of nombresEnDisco) {
      const idx = nombre.indexOf("_");
      if (idx > 0) {
        porSufijo.set(nombre.slice(idx + 1), nombre);
      }
    }

    const res = await sql<{ name: string }>`
      SELECT name FROM kysely_migration
    `.execute(db);

    for (const fila of res.rows) {
      if (!nombresEnDisco.has(fila.name)) {
        const idx = fila.name.indexOf("_");
        const sufijo = idx > 0 ? fila.name.slice(idx + 1) : fila.name;
        const nuevoNombre = porSufijo.get(sufijo);

        if (nuevoNombre) {
          const yaExisteNuevo = res.rows.some((r) => r.name === nuevoNombre);
          if (yaExisteNuevo) {
            await sql`DELETE FROM kysely_migration WHERE name = ${fila.name}`.execute(db);
            console.log(
              `[RECONCILIACIÓN] Eliminada entrada duplicada antigua en kysely_migration: "${fila.name}" (reemplazada por "${nuevoNombre}")`
            );
          } else {
            await sql`
              UPDATE kysely_migration
              SET name = ${nuevoNombre}
              WHERE name = ${fila.name}
            `.execute(db);
            console.log(
              `[RECONCILIACIÓN] Migración renumerada actualizada en kysely_migration: "${fila.name}" -> "${nuevoNombre}"`
            );
          }
        }
      }
    }
  } catch {
    // Si la tabla kysely_migration aún no existe (base de datos virgen), continuar normalmente
  }
}

/**
 * Runner oficial de migraciones para sgrai-api utilizando Kysely.
 * Ejecuta de forma transaccional y ordenada las migraciones TypeScript de src/lib/db/migrations.
 */
export async function migrateToLatest() {
  console.log("Ejecutando migraciones Kysely de base de datos...");
  const migrationFolder = path.join(__dirname, "migrations");

  await reconciliarMigracionesRenumeradas(migrationFolder);

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
      import: (filePath) => import(pathToFileURL(filePath).href),
    }),
    allowUnorderedMigrations: true,
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it: MigrationResult) => {
    if (it.status === "Success") {
      console.log(`[OK] Migración Kysely ejecutada con éxito: "${it.migrationName}"`);
    } else if (it.status === "Error") {
      console.error(`[ERROR] Falló la ejecución de la migración Kysely: "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Error al ejecutar migraciones Kysely:", error);
    process.exit(1);
  }

  console.log("Todas las migraciones se completaron correctamente.");
  await db.destroy();
}

if (process.argv[1]?.includes("migrator")) {
  migrateToLatest();
}
