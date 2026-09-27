import { Migrator, type MigrationResult, type MigrationProvider, type Migration } from "kysely/migration";
import { db } from "./index";
import * as m1 from "./migrations/001_initial_schema";
import * as m2 from "./migrations/002_avisos_incidentes";
import * as m3 from "./migrations/003_alinear_erd_informante_incidente";

export async function migrateToLatest() {
  const provider: MigrationProvider = {
    async getMigrations(): Promise<Record<string, Migration>> {
      return {
        "001_initial_schema": m1,
        "002_avisos_incidentes": m2,
        "003_alinear_erd_informante_incidente": m3,
      };
    },
  };

  const migrator = new Migrator({
    db,
    provider,
  });

  console.log("Ejecutando migraciones de base de datos...");
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it: MigrationResult) => {
    if (it.status === "Success") {
      console.log(`Migración "${it.migrationName}" ejecutada exitosamente.`);
    } else if (it.status === "Error") {
      console.error(`Fallo al ejecutar migración "${it.migrationName}".`);
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
