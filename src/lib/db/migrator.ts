import fs from "fs/promises";
import path from "path";
import { Migrator, type MigrationResult, type MigrationProvider, type Migration } from "kysely/migration";
import { db, pool } from "./index";
import * as m1 from "./migrations/001_initial_schema";
import * as m2 from "./migrations/002_avisos_incidentes";
import * as m3 from "./migrations/003_alinear_erd_informante_incidente";
import * as m4 from "./migrations/004_alineacion_erd_misiones_kanban";
import * as mSeg from "./migrations/004_seguridad_roles_permisos";
import * as mDelRec from "./migrations/005_delegacion_y_recurso";

/**
 * Runner integral de migraciones para sgrai-api.
 * Ejecuta tanto las migraciones Kysely TypeScript como las migraciones SQL complementarias.
 */
export async function migrateToLatest() {
  console.log("Iniciando ejecución de migraciones Kysely en la base de datos...");
  const provider: MigrationProvider = {
    async getMigrations(): Promise<Record<string, Migration>> {
      return {
        "001_initial_schema": m1,
        "002_avisos_incidentes": m2,
        "003_alinear_erd_informante_incidente": m3,
        "004_alineacion_erd_misiones_kanban": m4,
        "004_seguridad_roles_permisos": mSeg,
        "005_delegacion_y_recurso": mDelRec,
      };
    },
  };

  const migrator = new Migrator({
    db,
    provider,
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

  // 2. Ejecutar migraciones SQL complementarias si existen (H12 / Auditoría / Personal)
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const { rows: appliedRows } = await client.query<{ name: string }>(
        "SELECT name FROM _migrations ORDER BY id ASC;"
      );
      const appliedSet = new Set(appliedRows.map((r) => r.name));

      const migrationsDir = path.join(process.cwd(), "src/lib/db/migrations");
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

      for (const file of sqlFiles) {
        if (appliedSet.has(file)) {
          continue;
        }

        console.log(`▶️  Aplicando migración SQL complementaria: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sqlContent = await fs.readFile(filePath, "utf-8");

        await client.query("BEGIN");
        try {
          await client.query(sqlContent);
          await client.query("INSERT INTO _migrations (name) VALUES ($1);", [file]);
          await client.query("COMMIT");
          console.log(`✅ Migración SQL aplicada exitosamente: ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`❌ Error al aplicar migración SQL ${file}:`, err);
          throw err;
        }
      }
    } finally {
      client.release();
    }
  } catch (sqlErr) {
    console.warn("Aviso al ejecutar migraciones SQL:", sqlErr);
  }

  console.log("Migraciones completadas correctamente.");
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.includes("migrator")) {
  migrateToLatest().then(async () => {
    await db.destroy();
  });
}
