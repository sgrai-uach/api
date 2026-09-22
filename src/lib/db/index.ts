import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

/**
 * Configuración de Kysely (query builder) para PostgreSQL + PostGIS.
 * Gestiona el pool de conexiones contra la base de datos relacional del SGRAI.
 */

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://sgrai:sgrai_dev@localhost:5432/sgrai";

const globalForDb = globalThis as unknown as {
  dbPool?: Pool;
  kyselyDb?: Kysely<Database>;
};

export const pool =
  globalForDb.dbPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbPool = pool;
}

export const db =
  globalForDb.kyselyDb ??
  new Kysely<Database>({
    dialect: new PostgresDialect({
      pool,
    }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.kyselyDb = db;
}

export * from "./types";
