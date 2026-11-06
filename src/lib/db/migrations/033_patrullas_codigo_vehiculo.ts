import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Agregar columnas codigo y vehiculo_id a patrulla_verificadora
  await sql`
    ALTER TABLE patrulla_verificadora
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(50),
    ADD COLUMN IF NOT EXISTS vehiculo_id UUID REFERENCES recurso(id) ON DELETE SET NULL;
  `.execute(db);

  // 2. Sembrar códigos únicos para patrullas preexistentes de pruebas
  await sql`
    UPDATE patrulla_verificadora
    SET codigo = 'PV-COSTA-01'
    WHERE id = 'f1000000-0000-4000-8000-000000000001' AND codigo IS NULL;
  `.execute(db);

  await sql`
    UPDATE patrulla_verificadora
    SET codigo = 'PV-CENTROSUR-01'
    WHERE id = 'f1000000-0000-4000-8000-000000000002' AND codigo IS NULL;
  `.execute(db);

  // Sembrar código para cualquier otra patrulla preexistente
  await sql`
    UPDATE patrulla_verificadora
    SET codigo = 'PV-' || UPPER(SUBSTRING(id::text, 1, 8))
    WHERE codigo IS NULL;
  `.execute(db);

  // 3. Crear restricción de unicidad para código de patrulla activa
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patrulla_codigo_unico
    ON patrulla_verificadora (LOWER(codigo))
    WHERE eliminado_en IS NULL;
  `.execute(db);

  // 4. Crear índice sobre vehiculo_id para optimizar consultas de inventario
  await db.schema
    .createIndex("idx_patrulla_vehiculo")
    .ifNotExists()
    .on("patrulla_verificadora")
    .column("vehiculo_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_patrulla_vehiculo").ifExists().execute();
  await sql`DROP INDEX IF EXISTS idx_patrulla_codigo_unico;`.execute(db);

  await sql`
    ALTER TABLE patrulla_verificadora
    DROP COLUMN IF EXISTS vehiculo_id,
    DROP COLUMN IF EXISTS codigo;
  `.execute(db);
}
