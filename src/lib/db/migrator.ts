import { Migrator, type MigrationResult, type MigrationProvider, type Migration } from "kysely/migration";
import { db } from "./index";
import * as m1 from "./migrations/001_initial_schema";
import * as m2 from "./migrations/002_avisos_incidentes";
import * as m3 from "./migrations/003_alinear_erd_informante_incidente";
import * as m4 from "./migrations/004_alineacion_erd_misiones_kanban";

export async function migrateToLatest() {
  const provider: MigrationProvider = {
    async getMigrations(): Promise<Record<string, Migration>> {
      return {
        "001_initial_schema": m1,
        "002_avisos_incidentes": m2,
        "003_alinear_erd_informante_incidente": m3,
        "004_alineacion_erd_misiones_kanban": m4,
      };
    },
  };

  const migrator = new Migrator({
    db,
    provider,
  });

  console.log("Iniciando ejecución de migraciones en la base de datos...");
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

  await db.destroy();
  console.log("Migraciones completadas correctamente.");
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.includes("migrator")) {
  migrateToLatest();
}
