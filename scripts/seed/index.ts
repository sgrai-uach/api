import { db, parseSeedArgs, preflightSchema } from "./core";
import { sembrarPatrullasVerificadoras } from "../seed-patrullas";
import { sembrarDatosKanban } from "../../src/lib/db/seed-kanban";
import { sembrarEstadosIncidentes } from "../seed-estados-incidentes";
import { sembrarPuntosCriticos } from "../seed-puntos-criticos";
import { sembrarEventosRecuperacion } from "../seed-recuperacion";
import { sembrarEventosPrevencion } from "../seed-eventos-prevencion";
import { sembrarFixtureH21 } from "../seed-h21";
import { sembrarFixtureH38 } from "./h38";
import { sembrarFixtureH41 } from "./h41";

interface SeedModule {
  id: string;
  descripcion: string;
  run: () => Promise<void>;
}

/**
 * Orquestador único de seeds del SGRAI.
 *
 * `npm run seed` ejecuta todos los módulos en orden. Los módulos son idempotentes:
 * pueden ejecutarse múltiples veces sin duplicar registros ni romper claves únicas.
 *
 * Uso:
 *   npm run seed
 *   npm run seed -- --only=h38
 *   npm run seed -- --only=h21,h38
 *   npm run seed -- --only=h41
 *   npm run seed -- --skip=estados
 *   npm run seed -- --clean
 */
const MODULES: SeedModule[] = [
  {
    id: "patrullas",
    descripcion: "Usuarios PATRULLA, personal, vehículos y patrullas verificadoras base",
    run: () => sembrarPatrullasVerificadoras(),
  },
  {
    id: "kanban",
    descripcion: "Incidentes, misiones, cuadrillas y recursos del tablero Kanban",
    run: () => sembrarDatosKanban(),
  },
  {
    id: "estados",
    descripcion: "Incidentes y misiones adicionales en todos los estados operativos",
    run: () => sembrarEstadosIncidentes(),
  },
  {
    id: "puntos-criticos",
    descripcion: "Puntos críticos de prevención y misión preventiva activa",
    run: () => sembrarPuntosCriticos(),
  },
  {
    id: "recuperacion",
    descripcion: "Eventos de recuperación, misiones e insumos asociados",
    run: () => sembrarEventosRecuperacion(),
  },
  {
    id: "eventos-prevencion",
    descripcion: "Eventos de prevención en puntos críticos y misiones preventivas (H76)",
    run: () => sembrarEventosPrevencion(),
  },
  {
    id: "h21",
    descripcion: "Fixture QA HU-21: asignar cuadrilla y liberar patrulla",
    run: () => sembrarFixtureH21(),
  },
  {
    id: "h38",
    descripcion: "Fixture QA HU-38: evaluar terreno y asignar/modificar prioridad",
    run: () => sembrarFixtureH38(),
  },
  {
    id: "h41",
    descripcion: "Fixture QA HU-41: cuadrillas con dotación y rechazo de misión",
    run: () => sembrarFixtureH41(),
  },
];

function imprimirAyuda(): void {
  console.log("");
  console.log("Orquestador de seeds SGRAI");
  console.log("");
  console.log("Uso:");
  console.log("  npm run seed                         Ejecuta todos los módulos");
  console.log("  npm run seed -- --only=h38           Ejecuta solo el módulo indicado");
  console.log("  npm run seed -- --only=h21,h38       Ejecuta varios módulos");
  console.log("  npm run seed -- --only=h41           Fixture H41 (rechazo de cuadrilla)");
  console.log("  npm run seed -- --skip=estados       Omite módulos");
  console.log("  npm run seed -- --clean              Limpia fixtures QA y vuelve a sembrar");
  console.log("");
  console.log("Módulos disponibles:");
  for (const modulo of MODULES) {
    console.log(`  - ${modulo.id.padEnd(16)} ${modulo.descripcion}`);
  }
  console.log("");
  console.log("Sembrador REST aleatorio (requiere API levantada):");
  console.log("  npx tsx scripts/seed.ts [cantidad] [--promover]");
  console.log("");
}

async function main(): Promise<void> {
  const options = parseSeedArgs();

  if (options.help) {
    imprimirAyuda();
    return;
  }

  await preflightSchema();

  const idsDisponibles = new Set(MODULES.map((m) => m.id));

  if (options.only) {
    const desconocidos = options.only.filter((id) => !idsDisponibles.has(id));
    if (desconocidos.length > 0) {
      throw new Error(
        `Módulos desconocidos: ${desconocidos.join(", ")}. Disponibles: ${[...idsDisponibles].join(", ")}.`
      );
    }
  }

  const modulosSeleccionados = MODULES.filter((modulo) => {
    if (options.only && !options.only.includes(modulo.id)) return false;
    if (options.skip.includes(modulo.id)) return false;
    return true;
  });

  if (modulosSeleccionados.length === 0) {
    console.log("No hay módulos seleccionados para ejecutar.");
    return;
  }

  if (options.clean) {
    console.log(
      "Modo --clean: los fixtures QA (h21 y h38) se limpian y recrean. " +
        "Los módulos de datos base se actualizan por upsert."
    );
  }

  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log(" SGRAI — Orquestador de seeds");
  console.log("════════════════════════════════════════════════════════════");
  console.log(` Módulos: ${modulosSeleccionados.map((m) => m.id).join(" → ")}`);
  console.log("════════════════════════════════════════════════════════════");

  for (const [indice, modulo] of modulosSeleccionados.entries()) {
    console.log("");
    console.log(
      `[${indice + 1}/${modulosSeleccionados.length}] ${modulo.id.toUpperCase()} — ${modulo.descripcion}`
    );
    console.log("────────────────────────────────────────────────────────────");
    await modulo.run();
  }

  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log(" Seeds ejecutados correctamente.");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
}

main()
  .then(async () => {
    await db.destroy();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error("");
    console.error("Error ejecutando los seeds:", error);
    await db.destroy();
    process.exit(1);
  });
