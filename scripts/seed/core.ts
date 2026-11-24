import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { sql } from "kysely";
import { db } from "../../src/lib/db";

export { db, sql };

/** Hash bcrypt de la contraseña institucional de desarrollo `Valdivia2026!`. */
export const HASH_VALDIVIA_2026 =
  "$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm";

export const USUARIOS_INSTITUCIONALES = {
  admin: "00000000-0000-4000-8000-000000000001",
  callcenter: "00000000-0000-4000-8000-000000000002",
  encargado: "00000000-0000-4000-8000-000000000003",
  supervisor: "00000000-0000-4000-8000-000000000010",
} as const;

export const ROLES = {
  admin: "20000000-0000-4000-8000-000000000001",
  patrullaVerificadora: "20000000-0000-4000-8000-000000000004",
  delegadoCuadrilla: "20000000-0000-4000-8000-000000000005",
  brigadista: "20000000-0000-4000-8000-000000000009",
} as const;

export interface SeedCliOptions {
  /** Si se indica, solo se ejecutan estos módulos. */
  only: string[] | null;
  /** Si se indica, se omiten estos módulos. */
  skip: string[];
  /** Limpia los fixtures QA antes de sembrar. */
  clean: boolean;
  /** Ejecuta el sembrador REST aleatorio (requiere API levantada). */
  random: boolean;
  help: boolean;
}

/**
 * Parseo simple de argumentos del orquestador de seeds.
 *
 * Ejemplos:
 *   npm run seed
 *   npm run seed -- --only=h38
 *   npm run seed -- --only=h21,h38 --clean
 *   npm run seed -- --skip=estados
 *   npm run seed -- --random
 */
export function parseSeedArgs(argv: string[] = process.argv.slice(2)): SeedCliOptions {
  const options: SeedCliOptions = {
    only: null,
    skip: [],
    clean: false,
    random: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--clean") {
      options.clean = true;
      continue;
    }
    if (arg === "--random") {
      options.random = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg.startsWith("--only=")) {
      options.only = arg
        .slice("--only=".length)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith("--skip=")) {
      options.skip = arg
        .slice("--skip=".length)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      continue;
    }
  }

  return options;
}

/** Resuelve una delegación por su código institucional (ej. DEL_SUR). */
export async function resolverDelegacion(codigo: string): Promise<{ id: string; nombre: string }> {
  const delegacion = await db
    .selectFrom("delegacion")
    .select(["id", "nombre"])
    .where("codigo", "=", codigo)
    .executeTakeFirst();

  if (!delegacion) {
    throw new Error(
      `No se encontró la delegación '${codigo}'. Ejecute 'npm run db:migrate' para cargar los catálogos base.`
    );
  }
  return delegacion;
}

/** Resuelve un rol por su código (ej. PATRULLA_VERIFICADORA). */
export async function resolverRol(codigo: string): Promise<{ id: string; codigo: string }> {
  const rol = await db
    .selectFrom("rol")
    .select(["id", "codigo"])
    .where("codigo", "=", codigo)
    .executeTakeFirst();

  if (!rol) {
    throw new Error(
      `No se encontró el rol '${codigo}'. Ejecute 'npm run db:migrate' para cargar los catálogos base.`
    );
  }
  return { id: rol.id, codigo: rol.codigo ?? codigo };
}

/** Resuelve un usuario institucional por correo. */
export async function resolverUsuario(email: string): Promise<{ id: string }> {
  const usuario = await db
    .selectFrom("usuario")
    .select(["id"])
    .where("email", "=", email)
    .executeTakeFirst();

  if (!usuario) {
    throw new Error(
      `No se encontró el usuario '${email}'. Ejecute 'npm run db:migrate' para cargar los usuarios base.`
    );
  }
  return usuario;
}

/** Resuelve un tipo de incidente por coincidencia parcial de nombre. */
export async function resolverTipoIncidente(
  ...candidatos: string[]
): Promise<{ id: string; nombre: string }> {
  const tipos = await db
    .selectFrom("tipo_incidente")
    .select(["id", "nombre"])
    .execute();

  for (const candidato of candidatos) {
    const normalizado = candidato.toLowerCase();
    const encontrado = tipos.find((t) => t.nombre.toLowerCase().includes(normalizado));
    if (encontrado) return encontrado;
  }

  if (tipos[0]) return tipos[0];

  throw new Error(
    "No hay tipos de incidente cargados. Ejecute 'npm run db:migrate' para cargar los catálogos base."
  );
}

/** Resuelve una fuente de incidente por nombre exacto. */
export async function resolverFuenteIncidente(nombre: string): Promise<{ id: string; nombre: string }> {
  const fuente = await db
    .selectFrom("fuente_incidente")
    .select(["id", "nombre"])
    .where("nombre", "=", nombre)
    .executeTakeFirst();

  if (!fuente) {
    throw new Error(
      `No se encontró la fuente de incidente '${nombre}'. Ejecute 'npm run db:migrate' para cargar los catálogos base.`
    );
  }
  return fuente;
}

/**
 * Verifica que la base de datos tenga el esquema mínimo requerido por los seeds.
 * Evita errores crípticos cuando faltan migraciones.
 */
export async function preflightSchema(): Promise<void> {
  const requeridos: Array<[string, string]> = [
    ["patrulla_verificadora", "codigo"],
    ["patrulla_verificadora", "activo"],
    ["patrulla_verificadora", "eliminado_en"],
    ["patrulla_verificadora", "vehiculo_id"],
    ["cuadrilla", "activo"],
    ["cuadrilla", "actualizado_por_id"],
    ["cuadrilla", "actualizado_en"],
    ["cuadrilla_recurso", "activo"],
    ["cuadrilla_personal", "activo"],
    ["reporte_terreno", "version_reporte"],
    ["reporte_terreno", "es_rectificacion"],
    ["reporte_terreno", "prioridad_sugerida"],
    ["reporte_terreno", "prioridad_asignada"],
    ["reporte_terreno", "justificacion_prioridad"],
    ["reporte_terreno", "detalles_evaluacion"],
    ["recuperacion_recurso", "mision_id"],
    ["mision_hito", "descripcion"],
    ["incidente", "prioridad_sugerida"],
    ["incidente", "justificacion_prioridad"],
  ];

  const resultado = await sql<{ table_name: string; column_name: string }>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `.execute(db);

  const existentes = new Set(
    resultado.rows.map((fila) => `${fila.table_name}.${fila.column_name}`)
  );

  const faltantes = requeridos
    .map(([tabla, columna]) => `${tabla}.${columna}`)
    .filter((clave) => !existentes.has(clave));

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan columnas requeridas por los seeds: ${faltantes.join(", ")}. ` +
        "Ejecute 'npm run db:migrate' antes de sembrar."
    );
  }
}

/** Utilidad para ejecutar SQL con placeholders de listas de UUID. */
export function listaUuids(valores: readonly string[]) {
  return sql.join(valores.map((valor) => sql`${valor}::uuid`));
}
