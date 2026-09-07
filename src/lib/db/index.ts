import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://sgrai:sgrai_dev@localhost:5432/sgrai",
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export type { Database } from "./types";
