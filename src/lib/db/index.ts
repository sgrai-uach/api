import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

/**
 * Configuración del pool de PostgreSQL con soporte para PostGIS.
 */
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://sgrai:sgrai_dev@localhost:5432/sgrai",
  max: 10,
});

/**
 * Instancia global de Kysely configurada para la base de datos relacional del SGRAI.
 */
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export * from "./types";
