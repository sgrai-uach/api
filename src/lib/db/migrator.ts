import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://sgrai:sgrai_dev@localhost:5432/sgrai";

const pool = new Pool({
  connectionString,
});

/**
 * Runner de migraciones SQL para sgrai-api.
 * Lee y ejecuta los archivos .sql secuencialmente asegurando
 * idempotencia y registrando el estado en una tabla de control.
 */
async function migrate() {
  console.log("🔄 Iniciando proceso de migración de base de datos...");
  const client = await pool.connect();

  try {
    // 1. Crear tabla de control de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Obtener lista de migraciones ya aplicadas
    const { rows: appliedRows } = await client.query<{ name: string }>(
      "SELECT name FROM _migrations ORDER BY id ASC;"
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 3. Leer archivos en src/lib/db/migrations
    const migrationsDir = path.join(process.cwd(), "src/lib/db/migrations");
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    for (const file of sqlFiles) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Migración ya aplicada: ${file}`);
        continue;
      }

      console.log(`▶️  Aplicando migración: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = await fs.readFile(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sqlContent);
        await client.query("INSERT INTO _migrations (name) VALUES ($1);", [file]);
        await client.query("COMMIT");
        console.log(`✅ Migración aplicada exitosamente: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Error al aplicar migración ${file}:`, err);
        throw err;
      }
    }

    console.log("✨ Todas las migraciones se encuentran al día.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Fallo crítico en migrador:", err);
  process.exit(1);
});
