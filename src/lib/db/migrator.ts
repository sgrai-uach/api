import * as path from "path";
import { promises as fs } from "fs";
import { pathToFileURL } from "url";
import { sql } from "kysely";
import { Migrator, FileMigrationProvider, type MigrationResult } from "kysely/migration";
import { db } from "./index";

/**
 * Runner oficial de migraciones para sgrai-api utilizando Kysely.
 * Ejecuta de forma transaccional y ordenada las migraciones TypeScript de src/lib/db/migrations.
 */
export async function migrateToLatest() {
  console.log("Ejecutando migraciones Kysely de base de datos...");
  const migrationFolder = path.join(__dirname, "migrations");
  const provider = new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
    import: (filePath) => import(pathToFileURL(filePath).href),
  });

  try {
    const availableMigrations = Object.keys(await provider.getMigrations());
    if (availableMigrations.length > 0) {
      await sql`
        DELETE FROM kysely_migration
        WHERE name NOT IN (${sql.join(availableMigrations.map((m) => sql`${m}`))})
      `.execute(db);
    }
  } catch {
    // Ignorar si la tabla kysely_migration aún no existe
  }

  const migrator = new Migrator({
    db,
    provider,
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
