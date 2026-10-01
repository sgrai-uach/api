import * as path from "path";
import { promises as fs } from "fs";
import { pathToFileURL } from "url";
import { Migrator, FileMigrationProvider, type MigrationResult } from "kysely/migration";
import { db } from "./index";

/**
 * Runner oficial de migraciones para sgrai-api utilizando Kysely.
 * Ejecuta de forma transaccional y ordenada las migraciones TypeScript de src/lib/db/migrations.
 */
export async function migrateToLatest() {
  console.log("Ejecutando migraciones Kysely de base de datos...");
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
      import: (filePath) => import(pathToFileURL(filePath).href),
    }),
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
