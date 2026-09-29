import * as path from "path";
import { promises as fs } from "fs";
import { Migrator, FileMigrationProvider, type MigrationResult } from "kysely/migration";
import { db } from "./index";

export async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  console.log("Ejecutando migraciones de base de datos...");
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it: MigrationResult) => {
    if (it.status === "Success") {
      console.log(`[OK] Migración ejecutada con éxito: "${it.migrationName}"`);
    } else if (it.status === "Error") {
      console.error(`[ERROR] Falló la ejecución de la migración: "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Error al ejecutar migraciones:", error);
    process.exit(1);
  }

  console.log("Todas las migraciones se completaron correctamente.");
  await db.destroy();
}

if (process.argv[1]?.includes("migrator")) {
  migrateToLatest();
}
