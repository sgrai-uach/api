import { promises as fs } from "fs";
import path from "path";
import { FileMigrationProvider, Migrator } from "kysely";
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

  console.log("Iniciando ejecución de migraciones en la base de datos...");
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
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

  await db.destroy();
  console.log("Migraciones completadas correctamente.");
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.includes("migrator")) {
  migrateToLatest();
}
