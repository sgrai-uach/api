import * as path from "path";
import { promises as fs } from "fs";
import { Migrator, FileMigrationProvider, type MigrationResult } from "kysely/migration";
import { db, pool } from "./index";

/**
 * Runner integral de migraciones para sgrai-api.
 * Ejecuta tanto las migraciones Kysely TypeScript como las migraciones SQL complementarias.
 */
export async function migrateToLatest() {
  console.log("Ejecutando migraciones Kysely de base de datos...");
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
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

  // Ejecutar migraciones SQL complementarias si existen (.sql)
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

  console.log("Todas las migraciones se completaron correctamente.");
  await db.destroy();
}

if (process.argv[1]?.includes("migrator")) {
  migrateToLatest();
}
